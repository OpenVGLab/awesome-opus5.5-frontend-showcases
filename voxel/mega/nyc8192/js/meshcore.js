// Column-interval tile -> instanced quads (shared by the mesh worker and Node-side checks).
let TRANS = new Uint8Array(256);
export function setTransparent(t) { TRANS = t; }

// top of the highest run per interior column (for picking / camera collision)
export function topHeights(t) {
  const S = t.n + 2, h = new Uint16Array(t.n * t.n);
  for (let z = 0; z < t.n; z++) for (let x = 0; x < t.n; x++) {
    const c = (z + 1) * S + x + 1, b = t.start[c + 1];
    h[z * t.n + x] = b > t.start[c] ? t.y1[b - 1] : 0;
  }
  return h;
}

class QuadBuf {
  constructor(cap) { this.a = new Uint16Array(cap * 8); this.n = 0; }
  push(x, y, z, d, su, sv, m, ph) {
    if ((this.n + 1) * 8 > this.a.length) { const b = new Uint16Array(this.a.length * 2); b.set(this.a); this.a = b; }
    const o = this.n * 8, a = this.a;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = d; a[o + 4] = su; a[o + 5] = sv; a[o + 6] = m; a[o + 7] = ph;
    this.n++;
    return this.n - 1;
  }
  take() { return this.a.slice(0, this.n * 8); }
}

// face visibility: does a face of material m show against neighbour material nb?
const vis = (m, nb) => nb === 0 || (!TRANS[m] && TRANS[nb]) || (TRANS[m] && TRANS[nb] && m !== nb && m > nb);

export function mesh(t) {
  const { n, start, y0, y1, mat } = t;
  const S = n + 2;
  const opq = new QuadBuf(1 << 14), trn = new QuadBuf(1 << 10);
  // pattern buffer
  let pat = new Uint8Array(1 << 14), patLen = 0;
  const patMap = new Map();
  const segM = new Uint8Array(1100), segL = new Uint16Array(1100);
  function patternId(ns, total) {
    let key = '';
    for (let k = 0; k < ns; k++) key += segL[k] + ':' + segM[k] + ',';
    let id = patMap.get(key);
    if (id !== undefined) return id;
    if (patLen + total > pat.length) { let c = pat.length * 2; while (c < patLen + total) c *= 2; const b = new Uint8Array(c); b.set(pat.subarray(0, patLen)); pat = b; }
    id = patLen;
    for (let k = 0; k < ns; k++) { pat.fill(segM[k], patLen, patLen + segL[k]); patLen += segL[k]; }
    patMap.set(key, id);
    return id;
  }

  // ---------------- top and bottom faces: bucket by y, greedy merge per level
  const levels = new Map(); // y*2+isBottom -> array of packed (z<<9|x)<<8|mat
  for (let z = 1; z <= n; z++) for (let x = 1; x <= n; x++) {
    const c = z * S + x, a = start[c], b = start[c + 1];
    for (let r = a; r < b; r++) {
      const m = mat[r];
      // top
      const above = (r + 1 < b && y0[r + 1] === y1[r]) ? mat[r + 1] : 0;
      if (vis(m, above)) { const k = y1[r] * 2; let L = levels.get(k); if (!L) levels.set(k, L = []); L.push((((z << 9) | x) << 8) | m); }
      // bottom
      if (y0[r] > 0) {
        const below = (r > a && y1[r - 1] === y0[r]) ? mat[r - 1] : 0;
        if (vis(m, below)) { const k = y0[r] * 2 + 1; let L = levels.get(k); if (!L) levels.set(k, L = []); L.push((((z << 9) | x) << 8) | m); }
      }
    }
  }
  const grid = new Uint8Array(S * S);
  for (const [k, L] of levels) {
    const y = k >> 1, bottom = k & 1;
    let x0 = S, x1 = 0, z0 = S, z1 = 0;
    for (const v of L) { const m = v & 255, xz = v >>> 8, x = xz & 511, z = xz >>> 9; grid[z * S + x] = m; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const m = grid[z * S + x]; if (!m) continue;
        let w = 1; while (x + w <= x1 && grid[z * S + x + w] === m) w++;
        let h = 1;
        outer: for (; z + h <= z1; h++) { const row = (z + h) * S; for (let i = 0; i < w; i++) if (grid[row + x + i] !== m) break outer; }
        for (let j = 0; j < h; j++) grid.fill(0, (z + j) * S + x, (z + j) * S + x + w);
        const buf = TRANS[m] ? trn : opq;
        buf.push(x - 1, y, z - 1, bottom ? 3 : 2, w, h, m, 0);
        x += w - 1;
      }
    }
  }

  // ---------------- side faces
  // dirs: 0 +x, 1 -x, 4 +z, 5 -z ; merge along z for x-faces, along x for z-faces
  const iv0 = new Uint16Array(512), iv1 = new Uint16Array(512), ivP = new Uint32Array(512), ivT = new Uint8Array(512), ivF = new Uint8Array(512);
  function exposed(c, nc, out) {
    // collect exposed intervals of column c against neighbour column nc. returns count; fills iv0/iv1 (y range), ivP (mat or pattern id + 1<<24 flag), ivT (transparent), ivF (flags)
    const a = start[c], b = start[c + 1], na = start[nc], nb = start[nc + 1];
    let cnt = 0, j = na;
    let ns = 0, segStart = -1, segEnd = -1, segTrans = 0;
    const flush = () => {
      if (ns === 0) return;
      const total = segEnd - segStart;
      iv0[cnt] = segStart; iv1[cnt] = segEnd; ivT[cnt] = segTrans;
      // ground contact: face bottom sits on neighbour's solid top (street-level darkening)
      ivF[cnt] = 0;
      if (ns === 1) ivP[cnt] = segM[0];
      else ivP[cnt] = (patternId(ns, total) + 1) * 256;
      cnt++; ns = 0; segStart = -1;
    };
    for (let r = a; r < b; r++) {
      const m = mat[r], tr = TRANS[m];
      let y = y0[r];
      const ye = y1[r];
      while (y < ye) {
        while (j < nb && y1[j] <= y) j++;
        let nm = 0, until = ye;
        if (j < nb && y0[j] <= y) { nm = mat[j]; until = Math.min(ye, y1[j]); }
        else if (j < nb) until = Math.min(ye, y0[j]);
        const v = vis(m, nm);
        if (v) {
          if (ns > 0 && (segEnd !== y || segTrans !== tr)) flush();
          if (ns === 0) { segStart = y; segTrans = tr; }
          if (ns > 0 && segM[ns - 1] === m) segL[ns - 1] += until - y;
          else { segM[ns] = m; segL[ns] = until - y; ns++; }
          segEnd = until;
        } else if (ns > 0) flush();
        y = until;
      }
    }
    flush();
    return cnt;
  }
  // x faces
  for (const [d, dx] of [[0, 1], [1, -1]]) {
    for (let x = 1; x <= n; x++) {
      let prev = []; // open quads from previous z: [y0, y1, key, trans, quadIndex]
      for (let z = 1; z <= n; z++) {
        const c = z * S + x, cnt = exposed(c, c + dx, null);
        const cur = [];
        for (let k = 0; k < cnt; k++) {
          const ya = iv0[k], yb = iv1[k], key = ivP[k], tr = ivT[k];
          let q = -1;
          for (let p = 0; p < prev.length; p++) { const o = prev[p]; if (o[0] === ya && o[1] === yb && o[2] === key && o[3] === tr) { q = o[4]; break; } }
          const buf = tr ? trn : opq;
          if (q >= 0) { buf.a[q * 8 + 4]++; cur.push([ya, yb, key, tr, q]); }
          else {
            const plain = key < 256;
            const pid = plain ? key : (key >>> 8) - 1;
            const qi = buf.push(x - 1, ya, z - 1, d, 1, yb - ya, plain ? key : (pid & 65535), plain ? 0 : (pid >>> 16) + 1);
            cur.push([ya, yb, key, tr, qi]);
          }
        }
        prev = cur;
      }
    }
  }
  // z faces
  for (const [d, dz] of [[4, 1], [5, -1]]) {
    for (let z = 1; z <= n; z++) {
      let prev = [];
      for (let x = 1; x <= n; x++) {
        const c = z * S + x, cnt = exposed(c, c + dz * S, null);
        const cur = [];
        for (let k = 0; k < cnt; k++) {
          const ya = iv0[k], yb = iv1[k], key = ivP[k], tr = ivT[k];
          let q = -1;
          for (let p = 0; p < prev.length; p++) { const o = prev[p]; if (o[0] === ya && o[1] === yb && o[2] === key && o[3] === tr) { q = o[4]; break; } }
          const buf = tr ? trn : opq;
          if (q >= 0) { buf.a[q * 8 + 4]++; cur.push([ya, yb, key, tr, q]); }
          else {
            const plain = key < 256;
            const pid = plain ? key : (key >>> 8) - 1;
            const qi = buf.push(x - 1, ya, z - 1, d, 1, yb - ya, plain ? key : (pid & 65535), plain ? 0 : (pid >>> 16) + 1);
            cur.push([ya, yb, key, tr, qi]);
          }
        }
        prev = cur;
      }
    }
  }
  return { opaque: opq.take(), nOpaque: opq.n, trans: trn.take(), nTrans: trn.n, pattern: pat.slice(0, Math.max(1, patLen)), patLen };
}

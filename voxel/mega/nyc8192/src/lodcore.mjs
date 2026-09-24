// Column-run containers and 2x2 downsampling (same rule in workers and the main thread).
import { FLAGS, F_K, F_P, F_I } from './palette.mjs';

export const YMAX = 1024;

export class Runs {
  constructor(ncols, cap = 1024) { this.start = new Uint32Array(ncols + 1); this.y0 = new Uint16Array(cap); this.y1 = new Uint16Array(cap); this.mat = new Uint8Array(cap); this.n = 0; }
  grow() { const c = this.y0.length * 2; const a = new Uint16Array(c); a.set(this.y0); this.y0 = a; const b = new Uint16Array(c); b.set(this.y1); this.y1 = b; const m = new Uint8Array(c); m.set(this.mat); this.mat = m; }
  push(a, b, m) { if (this.n >= this.y0.length) this.grow(); this.y0[this.n] = a; this.y1[this.n] = b; this.mat[this.n] = m; this.n++; }
}

const PRI = new Uint8Array(256);
for (let m = 1; m < 256; m++) PRI[m] = FLAGS[m] & F_K ? 3 : FLAGS[m] & F_P ? 2 : FLAGS[m] & F_I ? 0 : 1;
const dA = new Uint8Array(YMAX), dB = new Uint8Array(YMAX), dC = new Uint8Array(YMAX), dD = new Uint8Array(YMAX), dO = new Uint8Array(YMAX);
const hist = new Uint16Array(256);
function decodeCol(runs, c, dst) {
  let top = 0;
  for (let r = runs.start[c]; r < runs.start[c + 1]; r++) { dst.fill(runs.mat[r], runs.y0[r], runs.y1[r]); if (runs.y1[r] > top) top = runs.y1[r]; }
  return top;
}

// 2x2 columns -> 1. Rule per metre: 3-4 solid -> solid; 2 solid -> solid if a window / leaf / keep
// material is involved (keeps facades and canopies); 1 solid -> only keep materials (spires, cables).
// q > 1 quantises the result into q-metre blocks (coarse far-field levels).
export function downsample(src, S, q = 1) {
  const S2 = S >> 1, out = new Runs(S2 * S2, Math.max(1024, src.n >> 1));
  for (let Z = 0; Z < S2; Z++) for (let X = 0; X < S2; X++) {
    const c0 = (2 * Z) * S + 2 * X;
    dA.fill(0); dB.fill(0); dC.fill(0); dD.fill(0);
    let top = Math.max(decodeCol(src, c0, dA), decodeCol(src, c0 + 1, dB), decodeCol(src, c0 + S, dC), decodeCol(src, c0 + S + 1, dD));
    for (let y = 0; y < top; y++) {
      const a = dA[y], b = dB[y], c = dC[y], d = dD[y];
      const n = (a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0) + (d ? 1 : 0);
      let m = 0;
      if (n >= 1) {
        let best = 0, bp = -1, bc = 0, p, cnt;
        if (a) { p = PRI[a]; cnt = 1 + (b === a) + (c === a) + (d === a); if (p > bp || (p === bp && cnt > bc)) { bp = p; bc = cnt; best = a; } }
        if (b) { p = PRI[b]; cnt = 1 + (a === b) + (c === b) + (d === b); if (p > bp || (p === bp && cnt > bc)) { bp = p; bc = cnt; best = b; } }
        if (c) { p = PRI[c]; cnt = 1 + (a === c) + (b === c) + (d === c); if (p > bp || (p === bp && cnt > bc)) { bp = p; bc = cnt; best = c; } }
        if (d) { p = PRI[d]; cnt = 1 + (a === d) + (b === d) + (c === d); if (p > bp || (p === bp && cnt > bc)) { bp = p; bc = cnt; best = d; } }
        if (n >= 3 || (n === 2 && bp >= 2) || (n === 1 && bp === 3)) m = best;
      }
      dO[y] = m;
    }
    if (q > 1) {
      // quantise into q-metre blocks aligned to multiples of q
      const nb = Math.ceil(top / q);
      for (let k = 0; k < nb; k++) {
        const ya = k * q, yb = Math.min(top, ya + q);
        let solid = 0, best = 0, bp = -1, bc = 0;
        for (let y = ya; y < yb; y++) { const v = dO[y]; if (v) { solid++; hist[v]++; } }
        if (solid * 2 >= q) {
          for (let y = ya; y < yb; y++) { const v = dO[y]; if (!v) continue; const p = PRI[v], cnt = hist[v]; if (p > bp || (p === bp && cnt > bc)) { bp = p; bc = cnt; best = v; } }
        }
        for (let y = ya; y < yb; y++) hist[dO[y]] = 0;
        dO.fill(best, ya, ya + q);
      }
      top = nb * q;
    }
    const oc = Z * S2 + X;
    out.start[oc] = out.n;
    let y = 0;
    while (y < top) {
      const v = dO[y]; if (!v) { y++; continue; }
      let e = y + 1; while (e < top && dO[e] === v) e++;
      out.push(y, e, v); y = e;
    }
    dO.fill(0, 0, top);
  }
  out.start[S2 * S2] = out.n;
  return out;
}

// copy a window of columns from region runs into tile order
export function window(src, S, x0, z0, size) {
  const out = new Runs(size * size, 1024);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const zz = z0 + z, xx = x0 + x, o = z * size + x;
    out.start[o] = out.n;
    if (zz < 0 || xx < 0 || zz >= S || xx >= S) continue;
    const c = zz * S + xx;
    for (let r = src.start[c]; r < src.start[c + 1]; r++) out.push(src.y0[r], src.y1[r], src.mat[r]);
  }
  out.start[size * size] = out.n;
  return out;
}

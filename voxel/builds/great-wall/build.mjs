// The Great Wall of China winding over misty mountains — voxel build for a 256^3 grid (y up).
// A crest ridge follows a winding spline across the grid; the wall rides the crest with
// crenellated parapets and square watchtowers. Tall peaks rise behind (low z), a river runs
// through the front valley, and banks of mist fill the valleys and wrap the far peaks.
export default function build(world) {
  const N = world.size;
  const ok = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < N && y < N && z < N;
  const put = (x, y, z, b) => { if (ok(x, y, z)) world.set(x, y, z, b); };
  const putEmpty = (x, y, z, b) => { if (ok(x, y, z) && world.get(x, y, z) === null) world.set(x, y, z, b); };
  const h2 = (a, b, c = 0) => {
    let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  let st = 424242;
  const rand = () => { st ^= st << 13; st ^= st >>> 17; st ^= st << 5; return (st >>> 0) / 4294967296; };
  const C = (x, z) => x * N + z;

  // ---------- winding path of the wall, resampled by arc length ----------
  const ctrl = [[-6, 204], [22, 186], [52, 156], [80, 166], [106, 136], [136, 112], [162, 130], [188, 104], [214, 84], [238, 98], [262, 72]];
  const dense = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < 80; k++) {
      const t = k / 80, t2 = t * t, t3 = t2 * t;
      const f = (j) => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3);
      dense.push([f(0), f(1)]);
    }
  }
  dense.push(ctrl[ctrl.length - 1]);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const TOTAL = cum[cum.length - 1];
  let seg = 0;
  const at = (s) => { // point + unit tangent at arc length s (s must be non-decreasing between calls)
    while (seg < cum.length - 2 && cum[seg + 1] < s) seg++;
    const a = dense[seg], b = dense[seg + 1], L = cum[seg + 1] - cum[seg] || 1, u = (s - cum[seg]) / L;
    const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, tx, tz];
  };
  const crest = (s) => 78 + 26 * Math.sin(s * 0.016 + 0.3) + 10 * Math.sin(s * 0.047 + 1.1);

  // ---------- distance field to the path ----------
  const DIST = new Float32Array(N * N).fill(1e9), ARC = new Float32Array(N * N);
  seg = 0;
  for (let s = 0; s <= TOTAL; s += 1) {
    const [px, pz] = at(s);
    const R = 70;
    for (let x = Math.max(0, Math.floor(px - R)); x <= Math.min(N - 1, Math.ceil(px + R)); x++)
      for (let z = Math.max(0, Math.floor(pz - R)); z <= Math.min(N - 1, Math.ceil(pz + R)); z++) {
        const d = Math.hypot(x - px, z - pz);
        if (d < DIST[C(x, z)]) { DIST[C(x, z)] = d; ARC[C(x, z)] = s; }
      }
  }

  // ---------- heightfield ----------
  const peaks = [[40, 30, 178, 72], [112, 18, 205, 74], [182, 40, 186, 64], [244, 16, 164, 58], [0, 108, 122, 46], [78, 66, 124, 40]];
  const riverZ = (x) => 238 + 8 * Math.sin(x * 0.04) + 3 * Math.sin(x * 0.11);
  const H = new Int16Array(N * N);
  for (let x = 0; x < N; x++)
    for (let z = 0; z < N; z++) {
      const rough = 3 * Math.sin(x * 0.19 + z * 0.07) * Math.sin(z * 0.23 - x * 0.05) + 2 * Math.sin(x * 0.41 + z * 0.37) + 1.2 * Math.sin((x - z) * 0.6);
      let h = 22 + 5 * Math.sin(x * 0.05 + z * 0.03) + 4 * Math.sin(z * 0.07 - x * 0.02) + rough * 0.6;
      const d = DIST[C(x, z)];
      if (d < 200) {
        const c = crest(ARC[C(x, z)]);
        h = Math.max(h, c - (d * 1.25 + 0.012 * d * d) + rough * Math.min(1, d / 10));
      }
      for (const [px, pz, ph, pr] of peaks) {
        const pd = Math.hypot(x - px, z - pz);
        if (pd >= pr) continue;
        const ridged = 1 - Math.abs(Math.sin(Math.atan2(z - pz, x - px) * 3 + pd * 0.05));
        h = Math.max(h, ph * Math.pow(1 - pd / pr, 1.5) * (0.82 + 0.18 * ridged) + rough * 1.5);
      }
      const rd = Math.abs(z - riverZ(x));
      if (rd < 16) h = Math.min(h, 15 + Math.max(0, rd - 6) * 1.2);
      H[C(x, z)] = Math.max(2, Math.round(h));
    }
  const Hs = (x, z) => (x < 0 || z < 0 || x >= N || z >= N ? 0 : H[C(x, z)]);
  const WATER = 18;
  for (let x = 0; x < N; x++)
    for (let z = 0; z < N; z++) {
      const h = H[C(x, z)];
      const nb = [Hs(x - 1, z), Hs(x + 1, z), Hs(x, z - 1), Hs(x, z + 1)];
      const lo = Math.min(...nb), slope = Math.max(...nb.map((v) => Math.abs(v - h)));
      const snowLine = 146 + 8 * Math.sin(x * 0.07 + z * 0.05);
      const rockTop = slope >= 3 || h > 128 + 6 * Math.sin(z * 0.09);
      for (let y = Math.max(0, Math.min(h, lo) - 3); y <= h; y++) {
        let b;
        const r = h2(x, y, z);
        if (y === h) {
          if (h > snowLine && slope < 5) b = 'snow';
          else if (h <= WATER) b = r < 0.5 ? 'sand' : 'stone';
          else if (rockTop) b = r < 0.55 ? 'stone' : r < 0.8 ? 'granite' : 'gray';
          else b = r < 0.08 ? 'dirt' : 'grass';
        } else if (y >= h - 2 && !rockTop && h > WATER) b = 'dirt';
        else b = r < 0.6 ? 'stone' : r < 0.85 ? 'granite' : 'cobblestone';
        world.set(x, y, z, b);
      }
      for (let y = h + 1; y <= WATER; y++) world.set(x, y, z, 'water');
    }

  // ---------- the wall: rasterise the path into a column map, then build ----------
  const WY = new Int16Array(N * N).fill(-1), WOFF = new Float32Array(N * N).fill(99), WSIDE = new Int8Array(N * N), WARC = new Float32Array(N * N);
  seg = 0;
  for (let s = 0; s <= TOTAL; s += 0.25) {
    const [px, pz, tx, tz] = at(s);
    const wy = Math.round(crest(s)) + 9;
    for (let o = -3.5; o <= 3.5; o += 0.25) {
      const x = Math.round(px - tz * o), z = Math.round(pz + tx * o);
      if (x < 0 || z < 0 || x >= N || z >= N) continue;
      const i = C(x, z);
      if (Math.abs(o) < WOFF[i]) { WOFF[i] = Math.abs(o); WY[i] = wy; WSIDE[i] = o < 0 ? -1 : 1; WARC[i] = s; }
    }
  }
  for (let x = 0; x < N; x++)
    for (let z = 0; z < N; z++) {
      const i = C(x, z), wy = WY[i];
      if (wy < 0) continue;
      const g = Math.min(H[i], wy - 1);
      for (let y = Math.max(0, g - 2); y <= wy; y++) {
        const r = h2(x, y, z, 7);
        let b;
        if (y === wy) b = WOFF[i] < 2.75 ? (r < 0.8 ? 'light_gray' : 'concrete') : 'gray';
        else if (y < wy - 6) b = r < 0.55 ? 'stone' : r < 0.8 ? 'granite' : 'cobblestone';
        else b = r < 0.68 ? 'gray' : r < 0.9 ? 'stone' : 'light_gray';
        world.set(x, y, z, b);
      }
      if (WOFF[i] >= 2.75) {
        put(x, wy + 1, z, 'gray');
        if (WSIDE[i] < 0) {
          put(x, wy + 2, z, 'gray');
          if (Math.floor(WARC[i] / 2.2) % 2 === 0) { put(x, wy + 3, z, 'gray'); put(x, wy + 4, z, 'dark_gray'); }
        }
      }
    }

  // ---------- watchtowers ----------
  seg = 0;
  const towers = [];
  for (let s = 22; s < TOTAL - 6; s += 50) towers.push(s);
  let topTower = 0;
  towers.forEach((s, k) => { if (crest(s) > crest(towers[topTower])) topTower = k; });
  towers.forEach((s, k) => {
    const [cx, cz, tx, tz] = at(s);
    const wy = Math.round(crest(s)) + 9, top = wy + 11, half = 7.5;
    for (let x = Math.floor(cx - 12); x <= Math.ceil(cx + 12); x++)
      for (let z = Math.floor(cz - 12); z <= Math.ceil(cz + 12); z++) {
        if (x < 0 || z < 0 || x >= N || z >= N) continue;
        const u = (x - cx) * tx + (z - cz) * tz, v = -(x - cx) * tz + (z - cz) * tx;
        const au = Math.abs(u), av = Math.abs(v);
        if (au > half || av > half) continue;
        const g = Math.min(H[C(x, z)], wy - 1);
        for (let y = Math.max(0, g - 2); y <= top; y++) {
          const r = h2(x, y, z, 3);
          world.set(x, y, z, y < wy - 6 ? (r < 0.6 ? 'stone' : 'granite') : r < 0.2 ? 'gray' : 'light_gray');
        }
        const rim = au > half - 1 || av > half - 1;
        if (rim) {
          put(x, top + 1, z, 'gray');
          if (Math.floor((u + v + 20) / 2) % 2 === 0) { put(x, top + 2, z, 'gray'); put(x, top + 3, z, 'dark_gray'); }
          const along = au > half - 1 ? v : u;
          for (const w of [-3.5, 0, 3.5])
            if (Math.abs(along - w) < 0.75)
              for (const y0 of [wy + 2, wy - 5]) for (let y = y0; y <= y0 + 4; y++) if (y > g) put(x, y, z, 'black');
        }
      }
    if (k % 2 === 0 || k === topTower) {
      // small guard pavilion with a hipped grey-tile roof
      for (let x = Math.floor(cx - 6); x <= Math.ceil(cx + 6); x++)
        for (let z = Math.floor(cz - 6); z <= Math.ceil(cz + 6); z++) {
          const u = (x - cx) * tx + (z - cz) * tz, v = -(x - cx) * tz + (z - cz) * tx;
          const m = Math.max(Math.abs(u), Math.abs(v));
          if (m <= 3.5) for (let y = top + 1; y <= top + 4; y++) put(x, y, z, m > 2.7 && Math.abs(u) < 0.8 && y <= top + 3 ? 'dark_gray' : 'light_gray');
          for (let l = 0; l < 5; l++) if (m <= 4.8 - l * 1.1 && m > 3.6 - l * 1.1 - 1.2) put(x, top + 5 + l, z, 'dark_gray');
          if (m <= 0.6) put(x, top + 10, z, 'gold');
        }
    }
    if (k === topTower) {
      for (let y = top + 11; y <= top + 20; y++) put(Math.round(cx), y, Math.round(cz), 'wood');
      for (let y = top + 15; y <= top + 20; y++)
        for (let d = 1; d <= 7; d++) put(Math.round(cx + tx * d), y, Math.round(cz + tz * d), y === top + 17 ? 'yellow' : 'red');
    }
  });

  // ---------- forests: pines and autumn broadleaf on the gentler slopes ----------
  for (let k = 0; k < 2600; k++) {
    const x = Math.floor(rand() * N), z = Math.floor(rand() * N);
    const i = C(x, z), h = H[i];
    if (h <= WATER + 1 || h > 118 || DIST[i] < 8 || WY[i] >= 0) continue;
    if (Math.abs(Hs(x + 1, z) - h) > 2 || Math.abs(Hs(x, z + 1) - h) > 2) continue;
    if (rand() < 0.72) {
      const th = 5 + Math.floor(rand() * 4);
      for (let y = h + 1; y <= h + 2; y++) putEmpty(x, y, z, 'wood');
      for (let l = 0; l < th; l++) {
        const rr = (th - l) * 0.45;
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
          if (dx * dx + dz * dz <= rr * rr + 0.3) putEmpty(x + dx, h + 3 + l, z + dz, h2(x + dx, l, z + dz) < 0.25 ? 'green' : 'leaves');
      }
    } else {
      const col = ['orange', 'red', 'yellow', 'leaves', 'orange'][Math.floor(rand() * 5)];
      for (let y = h + 1; y <= h + 3; y++) putEmpty(x, y, z, 'wood');
      for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -3; dz <= 3; dz++)
        if (dx * dx + dy * dy * 2 + dz * dz <= 8 && h2(x + dx, dy, z + dz, 5) > 0.1) putEmpty(x + dx, h + 5 + dy, z + dz, col);
    }
  }

  // ---------- mist: a cloud sea in the valleys and a veil around the far peaks ----------
  for (let x = 0; x < N; x++)
    for (let z = 0; z < N; z++) {
      const i = C(x, z), h = H[i];
      const n = Math.sin(x * 0.071 + z * 0.043) + Math.sin(x * 0.023 - z * 0.061 + 2) + 0.6 * Math.sin((x + z) * 0.11);
      const my = Math.round(46 + 4 * Math.sin(x * 0.03 + z * 0.05) + n * 1.5);
      if (n > -0.35 && h < my) {
        for (let y = Math.max(h + 1, my - 4); y <= my; y++) putEmpty(x, y, z, y === my && n > 0.7 && h2(x, y, z, 9) < 0.35 ? 'white' : 'glass');
      }
      const n2 = Math.sin(x * 0.05 - z * 0.02) + Math.sin(z * 0.09 + x * 0.013 + 1);
      if (z < 100 && DIST[i] > 22 && n2 > 0.5) {
        const vy = Math.round(112 + 5 * Math.sin(x * 0.04));
        for (let y = vy; y <= vy + 2; y++) if (h < y && h2(x, y, z, 11) < 0.75) putEmpty(x, y, z, 'glass');
      }
    }
}

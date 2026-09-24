// A medieval castle on a cliff above a harbor town — voxel build for a 256^3 grid (y up).
// Layout: cliff plateau (x 4..118, z 20..168) crowned by a walled castle; a switchback road
// cut into the cliff face descends east to a terraced harbor town; quay, piers, boats, a cog,
// breakwater and beacon tower in the harbor (z > 170).
export default function build(world) {
  const N = world.size;
  const SEA = 20, PY = 104;
  const inb = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < N && y < N && z < N;
  const S = (x, y, z, b) => {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (inb(x, y, z)) world.set(x, y, z, b);
  };
  const clr = (x, y, z) => { if (inb(x, y, z)) world.clear(x, y, z); };
  const box = (x0, y0, z0, x1, y1, z1, b) => {
    const c = (v) => Math.max(0, Math.min(N - 1, Math.round(v)));
    if (Math.max(x0, x1) < 0 || Math.min(x0, x1) >= N || Math.max(z0, z1) < 0 || Math.min(z0, z1) >= N) return;
    world.fill(c(x0), c(y0), c(z0), c(x1), c(y1), c(z1), b);
  };
  const hash = (x, y, z) => {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  let rs = 91377;
  const rnd = () => { rs = (Math.imul(rs, 1103515245) + 12345) >>> 0; return rs / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const wallTex = (x, y, z) => { const r = hash(x, y, z); return r < 0.14 ? 'cobblestone' : r < 0.22 ? 'light_gray' : r < 0.26 ? 'gray' : 'stone'; };
  const keepTex = (x, y, z) => { const r = hash(x, y, z); return r < 0.18 ? 'stone' : r < 0.24 ? 'concrete' : 'light_gray'; };

  // ======================= terrain heightfield =======================
  const I = (x, z) => x * N + z;
  const H = new Int16Array(N * N), KIND = new Uint8Array(N * N), D = new Float32Array(N * N), PARA = new Uint8Array(N * N);
  // kinds: 0 plateau, 1 cliff, 2 town, 3 seabed, 4 road ramp, 5 back hills
  const edgeNoise = (x, z) => 3 * Math.sin(x * 0.21 + z * 0.07) + 2 * Math.sin(z * 0.33 - x * 0.11) + 1.5 * Math.sin((x + z) * 0.5);
  const plateauD = (x, z) => {
    const qx = Math.abs(x - 61) - 29, qz = Math.abs(z - 94) - 46;
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - 28 + edgeNoise(x, z);
  };
  const terrace = (z) => (z >= 142 ? 23 : z >= 112 ? 25 : z >= 82 ? 27 : z >= 52 ? 29 : z >= 22 ? 31 : 33);
  const baseH = (x, z) => {
    if (z > 170) return Math.round(12 - Math.min(5, (z - 170) / 12) + 1.2 * Math.sin(x * 0.13 + z * 0.09));
    if (z < 22) return Math.round(33 + (22 - z) * 0.45 + 3 * Math.sin(x * 0.08) * Math.cos(z * 0.2));
    return terrace(z);
  };
  for (let x = 0; x < N; x++)
    for (let z = 0; z < N; z++) {
      const d = plateauD(x, z), b = baseH(x, z);
      let h = b, kind = z > 170 ? 3 : z < 22 ? 5 : 2;
      if (d <= 0) { h = PY; kind = 0; }
      else {
        const w = 13 + 3 * Math.sin(z * 0.1 + x * 0.05);
        let c = PY - 96 * Math.pow(Math.min(1, d / w), 0.55);
        c += 3 * Math.sin(x * 0.9 + z * 0.3) * Math.sin(z * 0.7 + x * 0.2) + 2 * Math.sin((x - z) * 0.45);
        c = Math.round(c / 3) * 3;
        if (c > b + 1) { h = c; kind = 1; }
      }
      H[I(x, z)] = h; KIND[I(x, z)] = kind; D[I(x, z)] = d;
    }
  // switchback road on the east cliff face: top landing, ramp north, landing, ramp south into town
  const ramp1 = (z) => (z >= 90 ? PY : Math.round(67 + (z - 30) * 37 / 60));
  const ramp2 = (z) => Math.max(terrace(z), Math.round(67 - (z - 30) * 42 / 98));
  for (let z = 22; z <= 134; z++)
    for (let x = 108; x <= 131; x++) {
      let y = -1, para = 0;
      if (x < 118) { if (z >= 90 && z <= 98) { y = PY; para = x >= 114 && (z === 90 || z === 98) ? 1 : 0; } }
      else if (z <= 30) { y = 67; para = x === 131 || z === 22 ? 1 : 0; }
      else if (x <= 124 && z <= 98) { y = ramp1(z); para = x === 124 || z === 98 ? 1 : 0; }
      else if (x >= 125) { y = ramp2(z); para = x === 131 ? 1 : 0; }
      if (y < 0) continue;
      H[I(x, z)] = y; KIND[I(x, z)] = 4; PARA[I(x, z)] = para;
    }
  const Hat = (x, z) => (x < 0 || z < 0 || x >= N || z >= N ? 0 : H[I(x, z)]);
  const STRATA = ['stone', 'granite', 'stone', 'cobblestone', 'granite', 'stone', 'gray', 'stone'];
  const rock = (x, y, z) => STRATA[((Math.floor((y + 2.5 * Math.sin(x * 0.06 + z * 0.05)) / 4) % 8) + 8) % 8];
  // shell fill: each column only as deep as its lowest neighbour needs, grid borders solid
  for (let x = 0; x < N; x++)
    for (let z = 0; z < N; z++) {
      const i = I(x, z), h = H[i], k = KIND[i];
      const n = [Hat(x - 1, z), Hat(x + 1, z), Hat(x, z - 1), Hat(x, z + 1)];
      const nMin = Math.min(...n), nMax = Math.max(...n);
      const y0 = Math.max(0, Math.min(h, nMin) - 3);
      for (let y = y0; y <= h; y++) {
        let b;
        if (k === 0) b = y === h ? 'grass' : y >= h - 2 ? 'dirt' : rock(x, y, z);
        else if (k === 1) b = y === h && nMax - h <= 1 && h - nMin <= 2 && hash(x, 7, z) < 0.7 ? 'grass' : rock(x, y, z);
        else if (k === 4) b = y === h ? 'cobblestone' : wallTex(x, y, z);
        else if (k === 3) b = y < h ? 'sand' : D[i] < 25 ? (hash(x, 1, z) < 0.5 ? 'stone' : 'cobblestone') : hash(x, 2, z) < 0.12 ? 'stone' : 'sand';
        else b = y === h ? 'grass' : h - nMin >= 2 ? 'cobblestone' : 'dirt';
        world.set(x, y, z, b);
      }
      if (k === 4 && PARA[i]) {
        S(x, h + 1, z, wallTex(x, h + 1, z));
        if ((x + z) % 4 < 2) S(x, h + 2, z, wallTex(x, h + 2, z));
      }
      for (let y = h + 1; y <= SEA; y++) world.set(x, y, z, 'water');
    }
  // streets of the terraced town
  const inStreet = (x, z) => (z >= 157 && z <= 170) || (z >= 133 && z <= 141) || (z >= 103 && z <= 111) ||
    (z >= 73 && z <= 81) || (z >= 43 && z <= 51) || (x >= 159 && x <= 165) || (x >= 204 && x <= 210);
  for (let x = 118; x < N; x++)
    for (let z = 22; z <= 170; z++) {
      const i = I(x, z);
      if (KIND[i] !== 2 || !inStreet(x, z)) continue;
      world.set(x, H[i], z, z === 170 ? 'stone' : hash(x, 3, z) < 0.25 ? 'stone' : 'cobblestone');
    }

  // ======================= castle =======================
  const column = (x, z, y0, y1, tex) => { for (let y = y0; y <= y1; y++) S(x, y, z, tex(x, y, z)); };
  const disc = (cx, cz, r, y, b) => {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        if (Math.hypot(x - cx, z - cz) <= r) S(x, y, z, b);
  };
  const tower = (cx, cz, r, yTop, roofR, roofH, tex, roofB = 'roof') => {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
        const dd = Math.hypot(x - cx, z - cz);
        if (dd > r) continue;
        column(x, z, Math.min(PY - 10, Hat(x, z)), yTop, tex);
      }
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
      for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++) {
        const dd = Math.hypot(x - cx, z - cz);
        if (dd > r && dd <= r + 1) { S(x, yTop - 1, z, 'stone'); S(x, yTop, z, 'stone'); }
      }
    for (let i = 0; i <= roofH; i++) disc(cx, cz, roofR * (1 - i / roofH), yTop + 1 + i, roofB);
    S(cx, yTop + roofH + 2, cz, 'gold');
    S(cx, yTop + roofH + 3, cz, 'gold');
    for (let a = 0; a < 6; a++)
      for (let ys = PY + 8; ys + 2 < yTop - 3; ys += 12) {
        const th = a * Math.PI / 3 + 0.4 + ys * 0.05;
        const sx = Math.round(cx + (r - 0.5) * Math.cos(th)), sz = Math.round(cz + (r - 0.5) * Math.sin(th));
        for (let y = ys; y <= ys + 2; y++) S(sx, y, sz, 'black');
      }
  };
  const roof = (x0, x1, z0, z1, y, alongX, roofB, gableB, pitch = 1) => {
    const [a0, a1, b0, b1] = alongX ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
    for (let i = 0; b0 - 1 + i <= b1 + 1 - i; i++) {
      const lo = b0 - 1 + i, hi = b1 + 1 - i;
      for (let p = 0; p < pitch; p++) {
        const yy = y + i * pitch + p;
        for (let a = a0 - 1; a <= a1 + 1; a++)
          for (let b = lo; b <= hi; b++) {
            const edge = b === lo || b === hi;
            let blk;
            if (a === a0 - 1 || a === a1 + 1) { if (!edge) continue; blk = roofB; }
            else if (a === a0 || a === a1) blk = edge ? roofB : gableB;
            else blk = roofB;
            if (alongX) S(a, yy, b, blk); else S(b, yy, a, blk);
          }
      }
    }
  };
  // curtain walls with crenellations (outer face merlons)
  const WT = PY + 24;
  const wallCol = (x, z) => column(x, z, Math.min(PY - 6, Hat(x, z)), WT, (x, y, z) => (y <= PY + 2 ? 'cobblestone' : wallTex(x, y, z)));
  for (let z = 36; z <= 152; z++)
    for (let t = 0; t < 5; t++) { wallCol(18 + t, z); wallCol(102 + t, z); }
  for (let x = 18; x <= 106; x++)
    for (let t = 0; t < 5; t++) { wallCol(x, 36 + t); wallCol(x, 148 + t); }
  for (let z = 36; z <= 152; z++)
    if (z % 5 < 3) for (let y = WT + 1; y <= WT + 3; y++) { S(18, y, z, 'stone'); S(19, y, z, 'stone'); S(105, y, z, 'stone'); S(106, y, z, 'stone'); }
  for (let x = 18; x <= 106; x++)
    if (x % 5 < 3) for (let y = WT + 1; y <= WT + 3; y++) { S(x, y, 36, 'stone'); S(x, y, 37, 'stone'); S(x, y, 151, 'stone'); S(x, y, 152, 'stone'); }
  // corner and flank towers
  for (const [cx, cz] of [[20, 38], [104, 38], [20, 150], [104, 150]]) tower(cx, cz, 9, PY + 36, 11, 22, wallTex);
  tower(20, 94, 7, PY + 32, 8.5, 16, wallTex);
  tower(62, 150, 7, PY + 32, 8.5, 16, wallTex);
  // gatehouse facing the town (east)
  for (let x = 101; x <= 111; x++)
    for (let z = 88; z <= 100; z++) {
      column(x, z, Math.min(PY - 6, Hat(x, z)), PY + 30, wallTex);
      const per = x === 101 || x === 111 || z === 88 || z === 100;
      if (per && (x + z) % 4 < 2) for (let y = PY + 31; y <= PY + 33; y++) S(x, y, z, 'stone');
    }
  tower(107, 84, 7, PY + 34, 8.5, 17, wallTex);
  tower(107, 104, 7, PY + 34, 8.5, 17, wallTex);
  for (let z = 91; z <= 97; z++) {
    const dz = z - 94, top = PY + 9 + Math.round(Math.sqrt(Math.max(0, 9.5 - dz * dz)) * 1.3);
    for (let x = 99; x <= 113; x++) for (let y = PY + 1; y <= top; y++) clr(x, y, z);
    for (let y = top - 5; y <= top; y++) if (z % 2 === 0 || y % 2 === 0) S(109, y, z, 'dark_gray');
  }
  for (let x = 79; x <= 118; x++) for (let z = 91; z <= 97; z++) S(x, PY, z, hash(x, 5, z) < 0.3 ? 'stone' : 'cobblestone');
  for (let z = 93; z <= 95; z++) for (let y = PY + 15; y <= PY + 26; y++) S(112, y, z, z === 94 && y >= PY + 18 && y <= PY + 23 ? 'yellow' : 'red');
  // courtyard paving ring around the keep
  for (let x = 41; x <= 81; x++) for (let z = 71; z <= 115; z++) S(x, PY, z, hash(x, 6, z) < 0.3 ? 'stone' : 'cobblestone');
  for (let x = 47; x <= 49; x++) for (let z = 61; z <= 70; z++) S(x, PY, z, 'cobblestone');
  // keep (donjon)
  const KT = PY + 56;
  for (let x = 44; x <= 78; x++) for (let z = 74; z <= 112; z++) column(x, z, PY - 6, KT, keepTex);
  for (let x = 43; x <= 79; x++)
    for (let z = 73; z <= 113; z++) {
      if (!(x === 43 || x === 79 || z === 73 || z === 113)) continue;
      S(x, KT - 1, z, 'stone'); S(x, KT, z, 'stone');
      if ((x + z) % 4 < 2) for (let y = KT + 1; y <= KT + 3; y++) S(x, y, z, 'stone');
    }
  for (const yw of [PY + 13, PY + 27, PY + 41]) {
    for (let x = 49; x <= 73; x += 6)
      for (const z of [74, 112]) for (let dy = 0; dy < 5; dy++) { S(x, yw + dy, z, 'glass_dark'); S(x + 1, yw + dy, z, 'glass_dark'); }
    for (let z = 79; z <= 107; z += 7)
      for (const x of [44, 78]) for (let dy = 0; dy < 5; dy++) { S(x, yw + dy, z, 'glass_dark'); S(x, yw + dy, z + 1, 'glass_dark'); }
  }
  for (let z = 92; z <= 96; z++) for (let y = PY + 1; y <= PY + 8; y++) if (!(y === PY + 8 && (z === 92 || z === 96))) S(78, y, z, 'wood');
  box(79, PY + 1, 91, 80, PY + 1, 97, 'stone');
  for (const zc of [85, 103])
    for (let z = zc - 1; z <= zc + 1; z++)
      for (let y = PY + 32; y <= PY + 46; y++) if (y > PY + 32 || z === zc) S(79, y, z, z === zc && y >= PY + 36 && y <= PY + 42 ? 'yellow' : 'red');
  tower(44, 74, 4.5, KT + 10, 6, 11, keepTex);
  tower(44, 112, 4.5, KT + 10, 6, 11, keepTex);
  tower(78, 74, 4.5, KT + 10, 6, 11, keepTex);
  tower(78, 112, 8, PY + 88, 10, 24, keepTex); // great tower toward town and sea
  const FT = PY + 88 + 24 + 4;
  box(78, FT, 112, 78, FT + 10, 112, 'dark_gray');
  S(78, FT + 11, 112, 'gold');
  box(79, FT + 4, 112, 90, FT + 9, 112, 'red');
  box(79, FT + 6, 112, 90, FT + 7, 112, 'yellow');
  // great hall along the north wall
  box(26, PY + 1, 46, 70, PY + 14, 62, 'stone');
  box(26, PY + 1, 46, 70, PY + 2, 62, 'cobblestone');
  for (let x = 30; x <= 66; x += 6) for (const z of [46, 62]) box(x, PY + 5, z, x + 1, PY + 9, z, 'glass_dark');
  box(47, PY + 1, 62, 49, PY + 5, 62, 'wood');
  roof(26, 70, 46, 62, PY + 15, true, 'roof', 'stone', 1);
  // chapel with bell tower along the west wall
  box(24, PY + 1, 118, 40, PY + 17, 146, 'sandstone');
  for (let z = 122; z <= 142; z += 5) box(40, PY + 5, z, 40, PY + 11, z, 'glass_blue');
  box(31, PY + 1, 146, 33, PY + 6, 146, 'wood');
  roof(24, 40, 118, 146, PY + 18, false, 'dark_gray', 'sandstone', 2);
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) if (dx * dx + dy * dy <= 9) S(32 + dx, PY + 25 + dy, 146, dx === 0 && dy === 0 ? 'gold' : 'glass_blue');
  box(28, PY + 1, 110, 36, PY + 38, 118, 'sandstone');
  for (let y = PY + 30; y <= PY + 35; y++) {
    for (let x = 29; x <= 35; x++) for (let z = 111; z <= 117; z++) clr(x, y, z);
    for (let t = -1; t <= 1; t++) { clr(32 + t, y, 110); clr(32 + t, y, 118); clr(28, y, 114 + t); clr(36, y, 114 + t); }
  }
  box(31, PY + 31, 113, 33, PY + 34, 115, 'gold');
  S(32, PY + 35, 114, 'dark_gray');
  for (let i = 0; i <= 5; i++) box(27 + i, PY + 39 + 2 * i, 109 + i, 37 - i, PY + 40 + 2 * i, 119 - i, 'dark_gray');
  box(32, PY + 51, 114, 32, PY + 55, 114, 'gold');
  box(31, PY + 54, 114, 33, PY + 54, 114, 'gold');
  // stables near the south wall
  box(84, PY + 1, 120, 98, PY + 9, 140, 'planks');
  for (let y = PY + 1; y <= PY + 9; y++) {
    for (let z = 120; z <= 140; z += 5) { S(84, y, z, 'wood'); S(98, y, z, 'wood'); }
    for (let x = 84; x <= 98; x += 7) { S(x, y, 120, 'wood'); S(x, y, 140, 'wood'); }
  }
  for (const z0 of [123, 129, 135]) box(84, PY + 1, z0, 84, PY + 5, z0 + 2, 'brown');
  roof(84, 98, 120, 140, PY + 10, false, 'roof', 'planks', 1);
  box(81, PY + 1, 126, 82, PY + 2, 128, 'yellow');
  // well
  for (let x = 86; x <= 94; x++)
    for (let z = 60; z <= 68; z++) {
      const dd = Math.hypot(x - 90, z - 64);
      if (dd <= 2.9) { S(x, PY + 1, z, dd > 1.6 ? 'cobblestone' : 'water'); if (dd > 1.6) S(x, PY + 2, z, 'cobblestone'); }
    }
  box(88, PY + 3, 64, 88, PY + 6, 64, 'wood'); box(92, PY + 3, 64, 92, PY + 6, 64, 'wood');
  roof(88, 92, 63, 65, PY + 7, true, 'roof', 'wood', 1);

  // ======================= harbor town =======================
  const WALLS = ['white', 'white', 'white', 'concrete', 'sandstone', 'sandstone', 'planks', 'stone', 'brick'];
  const ROOFS = ['roof', 'roof', 'roof', 'brick', 'dark_brick', 'dark_brick', 'gray'];
  const SHUT = ['green', 'blue', 'cyan', 'red', 'brown'];
  const house = (x0, x1, zb, zf, gy) => {
    const wh = 7 + Math.floor(rnd() * 6), yt = gy + wh;
    const wallB = pick(WALLS), roofB = pick(ROOFS);
    const plaster = wallB === 'white' || wallB === 'concrete' || wallB === 'sandstone';
    const timber = plaster && rnd() < 0.5;
    const shutter = plaster && !timber && rnd() < 0.6 ? pick(SHUT) : null;
    box(x0, gy - 2, zb, x1, gy, zf, 'cobblestone');
    box(x0, gy + 1, zb, x1, yt, zf, wallB);
    if (timber) {
      for (let y = gy + 1; y <= yt; y++) {
        for (let x = x0; x <= x1; x += 4) { S(x, y, zb, 'brown'); S(x, y, zf, 'brown'); }
        for (let z = zb; z <= zf; z += 4) { S(x0, y, z, 'brown'); S(x1, y, z, 'brown'); }
        S(x1, y, zb, 'brown'); S(x1, y, zf, 'brown'); S(x0, y, zf, 'brown');
      }
      for (let y = gy + 5; y < yt; y += 5) {
        for (let x = x0; x <= x1; x++) { S(x, y, zb, 'brown'); S(x, y, zf, 'brown'); }
        for (let z = zb; z <= zf; z++) { S(x0, y, z, 'brown'); S(x1, y, z, 'brown'); }
      }
    }
    const mid = Math.floor((x0 + x1) / 2);
    const win = (x, y, z, alongX) => {
      S(x, y, z, 'glass_dark'); S(x, y + 1, z, 'glass_dark');
      if (!shutter) return;
      for (const s of [-1, 1]) { if (alongX) { S(x + s, y, z, shutter); S(x + s, y + 1, z, shutter); } else { S(x, y, z + s, shutter); S(x, y + 1, z + s, shutter); } }
    };
    for (let y = gy + 3; y + 1 < yt; y += 5) {
      for (let x = x0 + 2; x <= x1 - 2; x += 4)
        for (const z of [zb, zf]) { if (z === zf && y === gy + 3 && x >= mid - 1 && x <= mid + 2) continue; win(x, y, z, true); }
      for (let z = zb + 2; z <= zf - 2; z += 4) for (const x of [x0, x1]) win(x, y, z, false);
    }
    box(mid, gy + 1, zf, mid + 1, gy + 3, zf, 'wood');
    const alongX = rnd() < 0.55;
    roof(x0, x1, zb, zf, yt + 1, alongX, roofB, wallB, 1);
    if (rnd() < 0.45) {
      const rh = Math.ceil(((alongX ? zf - zb : x1 - x0) + 3) / 2);
      box(x0 + 2, yt + 1, zb + 2, x0 + 3, yt + rh + 2, zb + 3, 'brick');
    }
  };
  const rows = [{ gy: 23, front: 156 }, { gy: 25, front: 132 }, { gy: 27, front: 102 }, { gy: 29, front: 72 }, { gy: 31, front: 42 }];
  const segs = [[135, 158], [166, 203], [211, 253]];
  rows.forEach((row, ri) => {
    segs.forEach(([s0, s1], si) => {
      if (ri === 2 && si === 2) return; // church square
      let x = s0;
      while (x <= s1 - 6) {
        let w = 8 + Math.floor(rnd() * 6);
        if (x + w - 1 > s1) w = s1 - x + 1;
        if (w < 7) break;
        const dep = 9 + Math.floor(rnd() * 5);
        house(x, x + w - 1, row.front - dep + 1, row.front, row.gy);
        x += w + (rnd() < 0.3 ? 2 : 0);
      }
    });
  });
  // church with a spired tower, on the square of the third terrace
  {
    const gy = 27;
    box(223, gy - 2, 87, 250, gy + 18, 101, 'sandstone');
    for (const x of [227, 233, 239, 245]) { box(x, gy + 6, 101, x + 1, gy + 12, 101, 'glass_blue'); box(x, gy + 6, 87, x + 1, gy + 12, 87, 'glass_blue'); }
    roof(223, 250, 87, 101, gy + 19, true, 'dark_gray', 'sandstone', 1);
    box(212, gy - 2, 89, 222, gy + 43, 99, 'sandstone');
    for (let y = gy + 35; y <= gy + 40; y++)
      for (let t = 216; t <= 218; t++) { S(t, y, 89, 'black'); S(t, y, 99, 'black'); S(212, y, t - 123, 'black'); S(222, y, t - 123, 'black'); }
    box(215, gy + 25, 99, 219, gy + 29, 99, 'white');
    S(217, gy + 27, 99, 'black'); S(217, gy + 28, 99, 'black'); S(218, gy + 27, 99, 'black');
    box(216, gy + 1, 99, 218, gy + 5, 99, 'wood');
    box(211, gy + 44, 88, 223, gy + 45, 100, 'stone');
    for (let i = 0; i <= 5; i++) box(212 + i, gy + 46 + 4 * i, 89 + i, 222 - i, gy + 49 + 4 * i, 99 - i, 'dark_gray');
    box(217, gy + 70, 94, 217, gy + 74, 94, 'gold');
    box(216, gy + 73, 94, 218, gy + 73, 94, 'gold');
    for (let x = 229; x <= 239; x++)
      for (let z = 103; z <= 111; z++) {
        const dd = Math.hypot(x - 234, z - 107);
        if (dd <= 4.2) { S(x, gy + 1, z, dd > 2.8 ? 'stone' : 'water'); if (dd > 2.8) S(x, gy + 2, z, 'stone'); }
      }
    box(234, gy + 1, 107, 234, gy + 4, 107, 'stone');
    S(234, gy + 5, 107, 'light_blue');
  }
  // market stalls and cargo on the quay
  const AWN = ['red', 'yellow', 'blue', 'green', 'orange'];
  [140, 170, 190, 222, 240].forEach((x0, k) => {
    for (const [dx, dz] of [[0, 0], [5, 0], [0, 4], [5, 4]]) box(x0 + dx, 24, 163 + dz, x0 + dx, 27, 163 + dz, 'wood');
    for (let x = x0 - 1; x <= x0 + 6; x++) for (let z = 162; z <= 168; z++) S(x, 28, z, x % 2 ? AWN[k] : 'white');
    box(x0 + 1, 24, 167, x0 + 4, 24, 167, 'planks');
    for (let x = x0 + 1; x <= x0 + 4; x++) S(x, 25, 167, pick(['orange', 'red', 'lime', 'yellow', 'light_gray']));
  });
  for (let k = 0; k < 26; k++) {
    const x = 126 + Math.floor(rnd() * 126), z = 158 + Math.floor(rnd() * 3);
    S(x, 24, z, rnd() < 0.5 ? 'wood' : 'planks');
    if (rnd() < 0.3) S(x, 25, z, 'planks');
  }
  // wooden piers
  for (const [p0, p1] of [[144, 148], [180, 184], [226, 230]]) {
    box(p0, 22, 171, p1, 22, 203, 'planks');
    for (let z = 171; z <= 203; z += 5) { box(p0, 8, z, p0, 21, z, 'wood'); box(p1, 8, z, p1, 21, z, 'wood'); S(p0, 23, z, 'wood'); S(p1, 23, z, 'wood'); }
  }
  // breakwater with a beacon tower at its tip
  const bw = [[258, 164], [245, 190], [231, 212], [215, 228]];
  for (let s = 0; s < bw.length - 1; s++) {
    const [ax, az] = bw[s], [bx, bz] = bw[s + 1], L = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t <= L; t += 0.5) {
      const cx = ax + (bx - ax) * t / L, cz = az + (bz - az) * t / L;
      for (let dx = -3; dx <= 3; dx++)
        for (let dz = -3; dz <= 3; dz++) {
          const x = Math.round(cx + dx), z = Math.round(cz + dz);
          for (let y = 6; y <= 22; y++) S(x, y, z, wallTex(x, y, z));
          S(x, 23, z, 'cobblestone');
        }
      if (hash(Math.round(cx), 9, Math.round(cz)) < 0.08) {
        const ox = cx + 5 + rnd() * 2, oz = cz + 3 + rnd() * 2, r = 1.5 + rnd() * 1.5;
        for (let x = Math.floor(ox - r); x <= ox + r; x++) for (let z = Math.floor(oz - r); z <= oz + r; z++) for (let y = 14; y <= 21 + r; y++)
          if (Math.hypot(x - ox, (y - 19) * 0.8, z - oz) <= r + 1) S(x, y, z, hash(x, y, z) < 0.5 ? 'stone' : 'cobblestone');
      }
    }
  }
  {
    const cx = 215, cz = 228;
    for (let x = cx - 7; x <= cx + 7; x++)
      for (let z = cz - 7; z <= cz + 7; z++) {
        const dd = Math.hypot(x - cx, z - cz);
        if (dd <= 6.5) for (let y = 8; y <= 25; y++) S(x, y, z, 'cobblestone');
        if (dd <= 4.6) for (let y = 26; y <= 58; y++) S(x, y, z, (y % 8 < 2) ? 'stone' : keepTex(x, y, z));
        if (dd <= 6.2) S(x, 59, z, 'stone');
        if (dd > 5.2 && dd <= 6.2 && (x + z) % 3 === 0) { S(x, 60, z, 'stone'); S(x, 61, z, 'stone'); }
        if (dd <= 2.2) { S(x, 60, z, 'dark_gray'); S(x, 61, z, hash(x, 61, z) < 0.5 ? 'orange' : 'red'); }
        if (dd <= 1.5) { S(x, 62, z, 'orange'); S(x, 63, z, 'yellow'); }
      }
    S(cx, 64, cz, 'yellow');
    for (let y = 30; y <= 54; y += 8) { S(cx + 5, y, cz, 'black'); S(cx + 5, y + 1, cz, 'black'); S(cx, y + 4, cz + 5, 'black'); S(cx, y + 5, cz + 5, 'black'); }
  }
  // boats: hull with deck, optional mast and triangular sail
  const boat = (cx, cz, len, alongX, hullB, sailB) => {
    const hw0 = Math.max(2, Math.round(len * 0.18));
    const P = (u, y, v, b) => (alongX ? S(cx + u, y, cz + v, b) : S(cx + v, y, cz + u, b));
    for (let i = 0; i < len; i++) {
      const u = i - Math.floor(len / 2), hw = hw0 * Math.pow(Math.sin(Math.PI * (i + 0.5) / len), 0.6);
      for (let y = 18; y <= 21; y++) {
        const lw = Math.floor(y === 18 ? hw - 1.5 : y === 19 ? hw - 0.8 : hw);
        if (lw < 0) continue;
        for (let v = -lw; v <= lw; v++) {
          const edge = Math.abs(v) === lw || i === 0 || i === len - 1;
          if (y <= 19) P(u, y, v, hullB);
          else if (y === 20) P(u, y, v, edge ? hullB : 'planks');
          else if (edge) P(u, y, v, hullB);
        }
      }
    }
    if (!sailB) return;
    const mh = Math.round(len * 1.1);
    for (let y = 21; y <= 21 + mh; y++) P(0, y, 0, 'wood');
    for (let k = 0; k <= mh - 4; k++) for (let u = 1; u <= Math.round((mh - 4 - k) * 0.5); u++) P(-u, 23 + k, 0, sailB);
  };
  boat(139, 187, 13, false, 'wood', null);
  boat(154, 190, 16, false, 'brown', 'white');
  boat(174, 184, 12, false, 'planks', null);
  boat(191, 192, 18, false, 'wood', 'white');
  boat(219, 186, 13, false, 'brown', 'red');
  boat(66, 214, 18, true, 'wood', 'white');
  boat(118, 236, 11, true, 'planks', null);
  // a merchant cog at anchor inside the breakwater
  {
    const cx = 168, cz = 228, len = 44;
    for (let i = 0; i < len; i++) {
      const x = cx - len / 2 + i, t = (i + 0.5) / len;
      const hwT = 7 * Math.pow(Math.sin(Math.PI * Math.min(0.96, 0.12 + t * 0.84)), 0.45);
      for (let y = 15; y <= 24; y++) {
        const lw = Math.floor(hwT * (0.45 + 0.55 * Math.sqrt((y - 15) / 9)));
        for (let v = -lw; v <= lw; v++) {
          const shell = Math.abs(v) >= lw - 1 || i <= 1 || i >= len - 2;
          if (y <= 16 || y === 22 || shell) S(x, y, cz + v, y === 22 && !shell ? 'planks' : y === 21 ? 'brown' : y === 24 ? 'dark_brick' : 'wood');
          else if (y > 22) clr(x, y, cz + v);
        }
        if (i < 9 && y === 24) for (let yy = 25; yy <= 28; yy++) for (let v = -lw + 1; v <= lw - 1; v++) S(x, yy, cz + v, yy === 28 && Math.abs(v) < lw - 1 && i > 0 ? 'planks' : 'wood');
        if (i > len - 8 && y === 24) for (let yy = 25; yy <= 27; yy++) for (let v = -lw + 1; v <= lw - 1; v++) S(x, yy, cz + v, 'wood');
      }
    }
    box(cx, 22, cz, cx + 1, 70, cz + 1, 'wood');
    box(cx + 2, 62, cz - 10, cx + 2, 62, cz + 11, 'wood');
    for (let z = cz - 9; z <= cz + 10; z++)
      for (let y = 38; y <= 61; y++) {
        const belly = Math.abs(z - cz - 0.5) < 5 && y > 42 && y < 58 ? 1 : 0;
        S(cx + 2 + belly, y, z, z === cz || z === cz + 1 || y === 49 || y === 50 ? 'red' : 'white');
      }
    for (let x = cx - 2; x <= cx + 3; x++) for (let z = cz - 2; z <= cz + 3; z++) if (x < cx || x > cx + 1 || z < cz || z > cz + 1) S(x, 64, z, 'wood');
    box(cx + 2, 67, cz, cx + 8, 69, cz, 'red');
    const line = (a, b, blk) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); for (let t = 0; t <= L; t += 0.5) S(a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L, a[2] + (b[2] - a[2]) * t / L, blk); };
    line([cx + 22, 25, cz], [cx + 32, 31, cz], 'wood');
    line([cx, 65, cz], [cx + 31, 31, cz], 'brown');
    line([cx, 65, cz], [cx - 22, 29, cz], 'brown');
    for (const s of [-1, 1]) { line([cx, 60, cz], [cx - 4, 25, cz + 6 * s], 'brown'); line([cx + 1, 60, cz], [cx + 5, 25, cz + 6 * s], 'brown'); }
  }
  // sea rocks and surf below the cliff
  for (const [rx, rz, r, top] of [[10, 178, 6, 27], [30, 200, 4, 24], [60, 190, 5, 25], [100, 186, 4, 23], [84, 206, 3, 22]]) {
    for (let x = rx - r - 2; x <= rx + r + 2; x++)
      for (let z = rz - r - 2; z <= rz + r + 2; z++) {
        const dd = Math.hypot(x - rx, z - rz) + (hash(x, 4, z) - 0.5) * 2;
        if (dd <= r) { const h = Math.round(top - (dd / r) ** 2 * (top - 14)); for (let y = 6; y <= h; y++) S(x, y, z, hash(x, y, z) < 0.6 ? 'stone' : 'cobblestone'); }
        else if (dd <= r + 1.8 && hash(x, 8, z) < 0.55) S(x, SEA, z, 'white');
      }
  }
  for (let x = 0; x < 124; x++)
    for (let z = 140; z < N; z++) {
      if (Hat(x, z) >= SEA) continue;
      const nb = Math.max(Hat(x - 1, z), Hat(x + 1, z), Hat(x, z - 1), Hat(x, z + 1));
      if (nb > SEA + 3 && hash(x, 11, z) < 0.55) S(x, SEA, z, 'white');
    }

  // ======================= trees =======================
  const tree = (x, z, gy, h, r) => {
    for (let y = gy + 1; y <= gy + h; y++) S(x, y, z, 'wood');
    const cy = gy + h + 1;
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++)
        for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dy * dy * 1.4 + dz * dz > r * r + 0.5 || hash(x + dx, cy + dy, z + dz) < 0.08) continue;
          const X = x + dx, Y = cy + dy, Z = z + dz;
          if (inb(X, Y, Z) && world.get(X, Y, Z) === null) world.set(X, Y, Z, hash(X, Y, Z) < 0.2 ? 'green' : 'leaves');
        }
  };
  for (let k = 0; k < 22; k++) {
    const x = 124 + Math.floor(rnd() * 128), z = 2 + Math.floor(rnd() * 16);
    if (KIND[I(x, z)] === 5) tree(x, z, H[I(x, z)], 4 + Math.floor(rnd() * 4), 3 + Math.floor(rnd() * 2));
  }
  for (const [x, z] of [[8, 50], [9, 82], [10, 128], [12, 30], [40, 162], [72, 164], [112, 44], [113, 140], [114, 62], [30, 24], [70, 26]]) {
    if (KIND[I(x, z)] === 0) tree(x, z, PY, 5 + Math.floor(rnd() * 3), 3 + Math.floor(rnd() * 2));
  }
  for (const [x, z] of [[30, 72], [92, 80], [32, 100]]) tree(x, z, PY, 6, 4);
  for (const zt of [114, 84, 54, 24])
    for (let k = 0; k < 4; k++) {
      const x = 136 + Math.floor(rnd() * 116);
      if (KIND[I(x, zt)] === 2 || KIND[I(x, zt)] === 5) tree(x, zt, H[I(x, zt)], 4, 3);
    }
}

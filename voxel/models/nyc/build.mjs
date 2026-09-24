// New York City, 1 block = 12 m (horizontal and vertical), N = 2048.
// Frame: axes aligned to the Manhattan street grid (rotated 29 deg from true north).
//   +x = "Manhattan east" (toward Queens), -z = uptown, y = up.
// Coverage: ~24.6 km x 24.6 km — all of Manhattan (Battery to Spuyten Duyvil), the harbor down to
// the Statue of Liberty, the NJ Gold Coast + Palisades, the South Bronx, western Queens
// (LIC, Astoria, LaGuardia, Flushing) and northern Brooklyn (DUMBO, Williamsburg, Park Slope).
export default function build(world) {
  const W = world.size;
  const S = 12, X0 = 6500, Z0 = 1224, ST = 80.5;
  const TH = 29 * Math.PI / 180, CT = Math.cos(TH), SN = Math.sin(TH);
  const LAT0 = 40.758, LON0 = -73.9855, MLAT = 111034, MLON = 111320 * Math.cos(LAT0 * Math.PI / 180);

  // ---------- coordinate helpers ----------
  const X = (mE) => (mE + X0) / S;             // frame metres east -> x
  const Zn = (n) => Z0 - (n - 46) * ST / S;     // Manhattan street number -> z
  const M = (mE, n) => [X(mE), Zn(n)];
  const P = (lat, lon) => {                     // lat/lon -> [x, z]
    const dN = (lat - LAT0) * MLAT, dE = (lon - LON0) * MLON;
    const mE = dE * CT - dN * SN, mN = dE * SN + dN * CT;
    return [(mE + X0) / S, Z0 - mN / S];
  };
  const MP = (arr) => { const o = []; for (let i = 0; i < arr.length; i += 2) o.push(M(arr[i], arr[i + 1])); return o; };
  const BR = (b) => (b - 29) * Math.PI / 180;   // true bearing -> frame angle (rad, from -z toward +x)

  // ---------- blocks ----------
  const B = ['white', 'light_gray', 'gray', 'dark_gray', 'black', 'red', 'orange', 'yellow', 'lime', 'green',
    'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink', 'brown', 'stone', 'cobblestone', 'granite',
    'sandstone', 'brick', 'dark_brick', 'concrete', 'glass', 'glass_blue', 'glass_dark', 'steel', 'gold', 'copper',
    'wood', 'planks', 'roof', 'grass', 'dirt', 'sand', 'water', 'snow', 'leaves', 'asphalt'];
  const K = {}; B.forEach((b, i) => { K[b] = i; });

  // ---------- maps ----------
  const NN = W * W;
  const zone = new Uint8Array(NN);  // 0 water 1 MN 2 NJ 3 BK 4 QN 5 BX 6 island
  const use = new Uint8Array(NN);   // see U
  const ter = new Uint8Array(NN);   // ground top y
  const hgt = new Uint8Array(NN);   // building height above ground (blocks)
  const mat = new Uint8Array(NN);   // facade material
  const rfm = new Uint8Array(NN);   // roof material
  const dst = new Uint8Array(NN);   // distance to street (fabric)
  const dis = new Uint8Array(NN);   // district id
  const U = { FREE: 0, ST: 1, AVE: 2, PARK: 3, TREES: 4, PLAZA: 5, LAKE: 6, RAIL: 7, HWY: 8, RES: 9, SAND: 10,
    YARD: 11, CEM: 12, RUNWAY: 13, PIER: 14, FIELD: 15, MARSH: 16, IND: 17, TARMAC: 18 };
  const WATER_Y = 1, LAND_Y = 2;

  // ---------- hashing / noise ----------
  const hash = (x, z, s) => {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const noise = (x, z, sc, s) => {
    const fx = x / sc, fz = z / sc, ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz, ux = tx * tx * (3 - 2 * tx), uz = tz * tz * (3 - 2 * tz);
    const a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  };
  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  const pick = (arr, r) => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------- rasterisers (all coordinates in voxel units) ----------
  const xsBuf = [];
  function polySpans(pts, cb) {
    let zmin = Infinity, zmax = -Infinity;
    for (const p of pts) { if (p[1] < zmin) zmin = p[1]; if (p[1] > zmax) zmax = p[1]; }
    const z0 = Math.max(0, Math.floor(zmin)), z1 = Math.min(W - 1, Math.ceil(zmax));
    const n = pts.length;
    for (let z = z0; z <= z1; z++) {
      const zc = z + 0.5; xsBuf.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
        if ((zi > zc) !== (zj > zc)) xsBuf.push(xi + (zc - zi) / (zj - zi) * (xj - xi));
      }
      if (xsBuf.length < 2) continue;
      xsBuf.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xsBuf.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xsBuf[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xsBuf[k + 1] - 0.5));
        if (xa <= xb) cb(z, xa, xb);
      }
    }
  }
  function capsule(ax, az, bx, bz, r) {
    const a = Math.atan2(bz - az, bx - ax), pts = [];
    for (let i = 0; i <= 6; i++) { const t = a - Math.PI / 2 + i * Math.PI / 6; pts.push([bx + r * Math.cos(t), bz + r * Math.sin(t)]); }
    for (let i = 0; i <= 6; i++) { const t = a + Math.PI / 2 + i * Math.PI / 6; pts.push([ax + r * Math.cos(t), az + r * Math.sin(t)]); }
    return pts;
  }
  function lineSpans(ax, az, bx, bz, r, cb) { polySpans(capsule(ax, az, bx, bz, r), cb); }
  function plineSpans(pts, r, cb) { for (let i = 0; i + 1 < pts.length; i++) lineSpans(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, cb); }
  function ellSpans(cx, cz, rx, rz, cb, rot) {
    if (rot) {
      const pts = [], c = Math.cos(rot), s = Math.sin(rot);
      for (let i = 0; i < 32; i++) { const t = i * Math.PI / 16, ex = rx * Math.cos(t), ez = rz * Math.sin(t); pts.push([cx + ex * c - ez * s, cz + ex * s + ez * c]); }
      return polySpans(pts, cb);
    }
    const z0 = Math.max(0, Math.floor(cz - rz)), z1 = Math.min(W - 1, Math.ceil(cz + rz));
    for (let z = z0; z <= z1; z++) {
      const dz = (z + 0.5 - cz) / rz; if (dz * dz > 1) continue;
      const hw = rx * Math.sqrt(1 - dz * dz);
      const xa = Math.max(0, Math.ceil(cx - hw - 0.5)), xb = Math.min(W - 1, Math.floor(cx + hw - 0.5));
      if (xa <= xb) cb(z, xa, xb);
    }
  }
  function rectSpans(x0, z0, x1, z1, cb) {
    const xa = Math.max(0, Math.round(Math.min(x0, x1))), xb = Math.min(W - 1, Math.round(Math.max(x0, x1)));
    const za = Math.max(0, Math.round(Math.min(z0, z1))), zb = Math.min(W - 1, Math.round(Math.max(z0, z1)));
    for (let z = za; z <= zb; z++) if (xa <= xb) cb(z, xa, xb);
  }
  // rotated rectangle centred at (cx,cz), half sizes (hu along angle a, hv across), a = frame angle (rad from -z toward +x)
  function orect(cx, cz, hu, hv, a) {
    const ux = Math.sin(a), uz = -Math.cos(a), vx = Math.cos(a), vz = Math.sin(a);
    return [[cx + ux * hu + vx * hv, cz + uz * hu + vz * hv], [cx + ux * hu - vx * hv, cz + uz * hu - vz * hv],
      [cx - ux * hu - vx * hv, cz - uz * hu - vz * hv], [cx - ux * hu + vx * hv, cz - uz * hu + vz * hv]];
  }
  // span writers
  const setA = (arr, v) => (z, a, b) => arr.fill(v, z * W + a, z * W + b + 1);
  const setIf = (arr, v, pred) => (z, a, b) => { for (let i = z * W + a, e = z * W + b; i <= e; i++) if (pred(i)) arr[i] = v; };
  const onLand = (i) => zone[i] !== 0;
  const useL = (v) => setIf(use, v, onLand);
  const useFree = (v) => setIf(use, v, (i) => zone[i] !== 0 && use[i] === U.FREE);

  // =====================================================================
  // 1. LAND AND WATER (Manhattan frame metres "mE" + street number "n")
  // =====================================================================
  const landPoly = (arr, v) => polySpans(MP(arr), setA(zone, v));
  const waterLine = (pts, r) => plineSpans(pts, r, setA(zone, 0));
  // New Jersey: Liberty State Park, Jersey City, Hoboken, Weehawken, Palisades
  landPoly([-7000, -95, -7000, 250, -3580, 250, -3500, 237, -3350, 206, -3225, 176, -3123, 154, -2950, 135, -2800, 118,
    -2750, 88, -2700, 64, -2680, 49, -2600, 35, -2477, 22.6, -2300, 17, -2140, 10.8, -2000, 4, -1849, -2.2, -1700, -6,
    -1593, -12.3, -1450, -18, -1250, -25, -1115, -29.5, -1180, -33, -1350, -37, -1560, -39.5, -1730, -41.6, -1640, -45,
    -1575, -51.6, -1540, -58, -1513, -63.8, -1560, -70, -1680, -75, -1760, -80, -1900, -95], 2);
  // The Bronx (drawn first; Manhattan overwrites the overlap, the Harlem River separates them)
  landPoly([-2250, 250, -2180, 232, -2160, 219, -800, 218, -600, 213, -620, 204, -760, 195, -820, 182, -720, 172,
    -460, 163, -120, 155, 280, 146, 780, 137, 1280, 129, 1700, 125, 1900, 129, 2100, 132.8, 2600, 133.4, 2885, 133.9,
    3700, 139, 4300, 146, 4607, 151, 5100, 152, 5586, 153.1, 5700, 160, 6300, 162, 7215, 170.6, 7500, 179, 7750, 184.5,
    8031, 191.2, 8500, 186, 9046, 179.3, 10000, 186, 11000, 197, 11687, 202.2, 11350, 213, 10900, 224, 10600, 250], 5);
  // Manhattan
  const harlemC = [[1985, 104], [1990, 116], [1950, 124], [1720, 127.5], [1350, 131.5], [900, 139], [500, 147], [180, 157],
    [0, 160], [-300, 166], [-500, 174], [-580, 181.6], [-560, 188], [-470, 200], [-420, 210], [-560, 218], [-800, 222],
    [-1300, 223], [-1800, 222.5], [-2200, 221.5]];
  {
    const a = [991, -36.3, 1095, -36, 1250, -33, 1410, -30.5, 1560, -27.5, 1646, -25.5, 1750, -22.4, 1950, -19, 2105, -15.2,
      2400, -12, 2750, -9.5, 3061, -6.4, 3053, -1.9, 2950, 1, 2800, 4, 2750, 8, 2700, 10, 2600, 14, 2450, 18, 2350, 20,
      2200, 23, 2050, 26, 2000, 30, 1900, 34, 1880, 40, 1900, 44, 1940, 50, 1990, 56, 2050, 62, 2080, 70, 2100, 76,
      2150, 80, 2220, 86, 2200, 90, 2000, 93, 1890, 97, 1870, 104];
    for (const p of harlemC) a.push(p[0], p[1]);
    a.push(-2060, 218, -2080, 212, -2060, 204, -2050, 196, -2050, 186, -2030, 180, -1950, 172, -1820, 165, -1680, 160,
      -1600, 155, -1560, 145, -1520, 135, -1500, 125, -1510, 115, -1540, 105, -1550, 99, -1510, 88, -1480, 79, -1470, 70,
      -1450, 62, -1430, 55, -1430, 40, -1420, 34, -1330, 29, -1200, 25, -1041, 20.7, -900, 17.5, -788, 15, -650, 9,
      -525, 3.8, -420, 1, -320, -2, -200, -8, -111, -13, -50, -17, 34, -23.9, 140, -27, 241, -29.6, 330, -32, 471, -35.4,
      600, -37.5, 800, -38);
    landPoly(a, 1);
  }
  // Brooklyn + Queens (split later)
  landPoly([3150, -95, 3060, -74, 2950, -70.5, 2700, -71, 2454, -72.7, 2300, -69, 2150, -66, 2060, -62, 2080, -58,
    2160, -55, 2200, -52, 2250, -47, 2282, -40.8, 2260, -34, 2240, -27, 2380, -23, 2575, -21.4, 2800, -19.5, 3100, -17.5,
    3350, -15.5, 3450, -12, 3500, -8, 3560, -4, 3632, 2.4, 3700, 8, 3725, 13.3, 3650, 18, 3500, 21, 3314, 24.7, 3100, 29,
    2900, 32, 2722, 37.9, 2640, 42, 2600, 45, 2606, 51.3, 2700, 57, 2850, 63, 2950, 73, 3000, 80, 3100, 87, 3286, 92.3,
    3350, 98, 3405, 102.6, 3411, 108.9, 3600, 114, 4000, 118, 4376, 121.9, 4800, 120, 5300, 118, 5966, 118.6, 5958, 129.6,
    6500, 134, 7272, 143.4, 7600, 140, 8709, 132.8, 8900, 126, 9300, 120, 10362, 117.3, 10300, 122, 9716, 131.8,
    9300, 140, 8800, 150, 8109, 157, 8800, 165, 9600, 173, 10106, 177.1, 11000, 182, 11689, 184.8, 12500, 190,
    13566, 194.6, 14200, 188, 14709, 182, 15500, 186, 16400, 198, 19000, 205, 19000, -95], 3);
  // islands
  polySpans(capsule(X(2250), Zn(48), X(2740), Zn(87), 10), setA(zone, 6));                         // Roosevelt
  landPoly([2090, 102, 2130, 118, 2200, 131.5, 2600, 132.3, 2950, 128, 3100, 118, 3080, 108, 2800, 103, 2450, 99.5], 6); // Randalls/Wards
  landPoly([1300, -44, 1560, -47.5, 1700, -52.5, 1620, -60, 1450, -64.5, 1250, -59, 1150, -52, 1180, -47], 6);        // Governors
  landPoly([-780, -65.8, -600, -64.5, -500, -67, -650, -69.5, -790, -68.5], 6);                                         // Liberty
  landPoly([-990, -50, -720, -49.3, -690, -52, -730, -54.6, -990, -54.2], 6);                                           // Ellis
  landPoly([4800, 135, 5400, 131.5, 6000, 136, 6100, 143, 5600, 147, 5000, 145], 6);                                    // Rikers
  ellSpans(X(4154), Zn(141.3), 7, 5, setA(zone, 6)); ellSpans(X(4000), Zn(139.5), 4, 3, setA(zone, 6));               // Brothers
  ellSpans(X(2325), Zn(97.2), 4, 3, setA(zone, 6)); ellSpans(X(1800), Zn(42.3), 1.5, 1.5, setA(zone, 6));             // Mill Rock, U Thant
  // rivers and creeks
  waterLine(harlemC.slice(0, 3).map(p => M(p[0], p[1])), 8);
  waterLine(harlemC.slice(2, 12).map(p => M(p[0], p[1])), 8);
  waterLine(harlemC.slice(11).map(p => M(p[0], p[1])), 7);
  waterLine([M(1950, 124), M(2150, 132.4), M(2600, 133), M(2950, 131.5)], 2.5);                                // Bronx Kill
  waterLine([M(2860, 32.8), P(40.7390, -73.9520), P(40.7345, -73.9400), P(40.7300, -73.9300), P(40.7260, -73.9240), P(40.7200, -73.9190)], 3); // Newtown Creek
  waterLine([P(40.7300, -73.9300), P(40.7190, -73.9300), P(40.7110, -73.9290)], 2);                          // English Kills
  waterLine([M(2950, -70.8), P(40.6740, -73.9990), P(40.6800, -73.9920), P(40.6830, -73.9880)], 1.5);         // Gowanus Canal
  waterLine([M(5700, 158), P(40.8110, -73.8680), P(40.8200, -73.8700), P(40.8330, -73.8760), P(40.8460, -73.8760), P(40.8600, -73.8740), P(40.8800, -73.8730)], 3); // Bronx River
  waterLine([M(10362, 118), P(40.7520, -73.8390), P(40.7420, -73.8370)], 4);                                  // Flushing River
  ellSpans(...P(40.7340, -73.8390), 30, 60, setA(zone, 0), BR(20));                                          // Meadow Lake
  ellSpans(...P(40.7220, -73.8330), 16, 32, setA(zone, 0), BR(20));                                          // Willow Lake
  // Jamaica Bay (south-east corner) with marsh islands
  polySpans([P(40.600, -73.912), P(40.622, -73.905), P(40.629, -73.886), P(40.640, -73.876), P(40.652, -73.861),
    P(40.656, -73.846), P(40.651, -73.830), P(40.646, -73.812), P(40.640, -73.770), P(40.560, -73.770), P(40.560, -73.912)], setA(zone, 0));
  for (const [la, lo, rx, rz, a] of [[40.625, -73.860, 40, 16, 30], [40.615, -73.835, 34, 20, 70], [40.632, -73.842, 18, 10, 10],
    [40.607, -73.870, 30, 12, 40], [40.620, -73.815, 26, 12, 110]]) ellSpans(...P(la, lo), rx, rz, setA(zone, 6), BR(a));
  // boroughs: Queens = north/east of Newtown Creek and the Brooklyn line
  polySpans([M(2860, 32.8), P(40.7390, -73.9520), P(40.7345, -73.9400), P(40.7300, -73.9300), P(40.7110, -73.9290),
    P(40.7020, -73.9050), P(40.6920, -73.8850), P(40.6800, -73.8700), P(40.6600, -73.8620), P(40.6000, -73.8580),
    P(40.6000, -73.6000), P(40.9000, -73.6000), P(40.9000, -73.9300), M(3400, 120), M(3405, 102.6), M(2600, 50)],
    setIf(zone, 4, (i) => zone[i] === 3));

  // distance helpers (two-pass chamfer, units = 10 per block)
  function chamfer(out, isSrc, cap) {
    const d = new Uint16Array(NN);
    for (let i = 0; i < NN; i++) d[i] = isSrc(i) ? 0 : 65000;
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
      const i = z * W + x; let v = d[i]; if (v === 0) continue;
      if (x > 0 && d[i - 1] + 10 < v) v = d[i - 1] + 10;
      if (z > 0) {
        if (d[i - W] + 10 < v) v = d[i - W] + 10;
        if (x > 0 && d[i - W - 1] + 14 < v) v = d[i - W - 1] + 14;
        if (x < W - 1 && d[i - W + 1] + 14 < v) v = d[i - W + 1] + 14;
      }
      d[i] = v;
    }
    for (let z = W - 1; z >= 0; z--) for (let x = W - 1; x >= 0; x--) {
      const i = z * W + x; let v = d[i]; if (v === 0) continue;
      if (x < W - 1 && d[i + 1] + 10 < v) v = d[i + 1] + 10;
      if (z < W - 1) {
        if (d[i + W] + 10 < v) v = d[i + W] + 10;
        if (x < W - 1 && d[i + W + 1] + 14 < v) v = d[i + W + 1] + 14;
        if (x > 0 && d[i + W - 1] + 14 < v) v = d[i + W - 1] + 14;
      }
      d[i] = v;
    }
    for (let i = 0; i < NN; i++) { const v = Math.round(d[i] / 10); out[i] = v > cap ? cap : v; }
  }
  const dW = new Uint8Array(NN);
  chamfer(dW, (i) => zone[i] === 0, 250);

  // =====================================================================
  // 2. TERRAIN RELIEF (extra blocks above LAND_Y)
  // =====================================================================
  const lerpTab = (tab, n) => {           // tab: [n0, v0, n1, v1, ...] piecewise linear
    if (n <= tab[0]) return tab[1];
    for (let i = 2; i < tab.length; i += 2) if (n <= tab[i]) { const t = (n - tab[i - 2]) / (tab[i] - tab[i - 2]); return tab[i - 1] + t * (tab[i + 1] - tab[i - 1]); }
    return tab[tab.length - 1];
  };
  const cliffNJ = [-80, -4400, -40, -4200, -10, -3700, 10, -3450, 25, -3200, 40, -2950, 60, -2900, 90, -2950, 120, -3000, 150, -3200, 175, -3320, 206, -3430, 240, -3580];
  const palH = [-80, 3, -20, 4, 20, 5, 100, 5, 125, 7, 150, 8, 200, 9, 240, 10];
  const whEast = [135, -350, 155, -350, 160, -600, 175, -700, 188, -800, 196, -1250, 204, -1500, 222, -1550];
  const elev = new Uint8Array(NN);
  for (let z = 0; z < W; z++) {
    const n = 46 + (Z0 - z - 0.5) * S / ST;
    const cl = lerpTab(cliffNJ, n), ph = lerpTab(palH, n), we = lerpTab(whEast, n);
    for (let x = 0; x < W; x++) {
      const i = z * W + x, zn = zone[i]; if (!zn) continue;
      const mE = (x + 0.5) * S - X0; let e = 0;
      if (zn === 2) {
        const t = (cl - mE) / 24;
        if (t > 0) e = Math.round(ph * Math.min(1, t)) + (t > 3 ? Math.round(noise(x, z, 40, 7) * 1.2) : 0);
      } else if (zn === 1) {
        if (n > 133) {
          const hw = n < 155 ? 3 : n < 168 ? 4 : n < 190 ? 5 : 6;
          const t = (we - mE) / 20;
          if (t > 0) e = Math.round(hw * Math.min(1, t));
          if (n > 200 && mE > -1500) e = 0;
          if (n > 204 && mE < -1650) e = Math.round(5 * clamp((-1650 - mE) / 60, 0, 1));
        } else if (n > 106 && n < 126 && mE < -640) e = 2;
      } else if (zn === 5) {
        e = 1 + Math.round(noise(x, z, 70, 3) * 3);
        if (mE < -1000) e += 3;
        if (mE > 400 && mE < 1500 && n > 150) e += 1;                   // Grand Concourse ridge
      } else if (zn === 3) {
        const dx = (mE - 6100) / 1500, dn = (n + 58) / 22;
        e = Math.round(3.2 * Math.exp(-(dx * dx + dn * dn))) + (noise(x, z, 90, 5) > 0.6 ? 1 : 0);
        if (n > -42 && n < -22 && mE > 2380 && mE < 3000) e = Math.max(e, 1);  // Brooklyn Heights bluff
      } else if (zn === 4) {
        e = noise(x, z, 110, 9) > 0.62 ? 1 : 0;
      }
      const cap = zn === 2 ? Math.floor(dW[i] * 1.5) : zn === 1 || zn === 5 ? dW[i] - 1 : Math.floor(dW[i] / 2);
      elev[i] = Math.min(e, cap);
    }
  }
  for (let i = 0; i < NN; i++) ter[i] = zone[i] ? LAND_Y + elev[i] : WATER_Y;

  // =====================================================================
  // 3. MANHATTAN: GRID, LOWER-MANHATTAN STREET PATTERNS, PARKS, SHORE ROADS
  // =====================================================================
  const nOf = (z) => 46 + (Z0 - z - 0.5) * S / ST;
  const mEof = (x) => (x + 0.5) * S - X0;
  const lot = new Uint32Array(NN);                   // lot key per buildable cell
  const hi = (a, b, c) => (Math.floor(hash(a, b, c) * 4294967295) >>> 0) | 1;
  const D = { MAIN: 1, FIDI: 2, BPC: 3, TRIB: 4, SOHO: 5, CHINA: 6, LES: 7, WVIL: 8, GVIL: 9 };
  const gridStart = (mE) => (mE < 622 ? 14 : mE < 1150 ? 8 : 0.3);
  const WIDE = new Set([14, 23, 34, 42, 57, 72, 79, 86, 96, 106, 110, 116, 125, 135, 145, 155, 167, 181, 207]);
  // avenues: [mE, width, nMin, nMax]
  const AVES = [[-1370, 2, 22, 59], [-1300, 1, 72, 125], [-1096, 2, 14, 125], [-822, 2, 14, 192], [-548, 2, 14, 110],
    [-274, 2, 14, 155], [0, 2, 14, 153], [311, 2, 14, 147], [622, 2, 8, 142], [780, 2, 23, 142], [932, 3, 14, 132],
    [1082, 2, 21, 131], [1240, 2, 6, 129], [1456, 2, 0.3, 127], [1685, 2, 0.3, 127], [1880, 1, 59, 92], [2050, 1, 79, 90],
    [1890, 1, 0.3, 14], [2090, 1, 0.3, 14], [2290, 1, 0.3, 14], [2490, 1, 0.3, 14],
    [-1850, 1, 158, 200], [-1650, 1, 158, 196], [-1450, 2, 155, 200], [-1270, 1, 158, 190], [-950, 1, 160, 198],
    [-680, 1, 128, 175]];
  const aveRows = [];                                // per row: sorted avenue centre x list (main grid)
  for (let z = 0; z < W; z++) aveRows.push([]);
  for (const [mE, w, n0, n1] of AVES) {
    const x0 = Math.floor(X(mE) - w / 2 + 0.5), za = Math.floor(Zn(n1)), zb = Math.ceil(Zn(n0));
    for (let z = Math.max(0, za); z <= Math.min(W - 1, zb); z++) {
      aveRows[z].push(x0 + (w - 1) / 2);
      for (let x = x0; x < x0 + w; x++) { const i = z * W + x; if (zone[i] === 1 && nOf(z) >= gridStart(mEof(x))) use[i] = U.AVE; }
    }
  }
  aveRows.forEach((r) => r.sort((a, b) => a - b));
  const stRows = [];                                 // [row0, width, n]
  for (let n = 1; n <= 221; n++) {
    const w = WIDE.has(n) ? 2 : 1, r0 = Math.floor(Zn(n) - w / 2 + 0.5);
    stRows.push([r0, w, n]);
    for (let z = r0; z < r0 + w; z++) {
      if (z < 0 || z >= W) continue;
      for (let x = 0; x < W; x++) { const i = z * W + x; if (zone[i] === 1 && use[i] === U.FREE && n >= gridStart(mEof(x))) use[i] = U.ST; }
    }
  }
  // main-grid lots: 3-cell frontage lots, split front/back, full-depth lots on avenue corners
  {
    const rowBlk = new Int32Array(W).fill(-1), rowHalf = new Uint8Array(W);
    for (let k = 0; k + 1 < stRows.length; k++) {
      const a = stRows[k + 1][0] + stRows[k + 1][1], b = stRows[k][0] - 1;   // rows between street k+1 (north) and k
      const mid = (a + b) / 2;
      for (let z = Math.max(0, a); z <= Math.min(W - 1, b); z++) { rowBlk[z] = k; rowHalf[z] = z < mid ? 0 : 1; }
    }
    for (let z = 0; z < W; z++) {
      if (rowBlk[z] < 0) continue;
      const av = aveRows[z]; let p = -1;
      for (let x = 0; x < W; x++) {
        const i = z * W + x; if (zone[i] !== 1 || use[i] !== U.FREE) continue;
        if (nOf(z) < gridStart(mEof(x))) continue;
        while (p + 1 < av.length && av[p + 1] <= x) p++;
        const xa = p >= 0 ? av[p] : 0, xb = p + 1 < av.length ? av[p + 1] : W;
        const fromW = x - xa, fromE = xb - x;
        const corner = fromW <= 3.5 || fromE <= 3.5;
        const lu = corner ? (fromW <= 3.5 ? -1 : -2) : Math.floor((fromW - 3.5) / 3);
        lot[i] = hi(rowBlk[z] * 131 + (corner ? 7 : rowHalf[z]), p * 997 + lu, 11);
        dis[i] = D.MAIN;
      }
    }
  }
  // named diagonals and irregular arteries (width in cells)
  const mLine = (arr, w, v = U.AVE, pred = (i) => zone[i] === 1) => plineSpans(MP(arr), w / 2, setIf(use, v, pred));
  const BROADWAY = [773, -32.5, 800, -24, 834, -17.6, 882, -9.4, 919, 0.8, 925, 8, 830, 14.5, 622, 23.3, 311, 34.6, 0, 45.5,
    -274, 59.5, -560, 66, -822, 72.3, -900, 80, -973, 96, -1100, 116, -1100, 150, -1112, 168.6, -1083, 182, -1300, 195,
    -1472, 204.8, -1200, 212, -748, 222.7];
  mLine(BROADWAY, 2.2);
  mLine([300, 111, -150, 120, -420, 130, -560, 145, -700, 160, -820, 172], 1.6);   // St Nicholas Ave
  mLine([3000, 0.4, 1150, 0.3, 300, 0.3, -100, -0.8, -380, -1.8], 2.2);            // Houston St
  mLine([1433, -9.9, 882, -9.4, 300, -9.8, -200, -11.2], 2.2);                      // Canal St
  mLine([1150, -4, 2000, -3, 3053, -1.9], 2.2);                                     // Delancey St
  mLine([1180, -15.5, 1200, -8, 1230, 6], 1.6);                                     // Bowery
  mLine([-60, -17, 1100, -17.8], 1.6);                                              // Chambers St
  mLine([790, -31, 1330, -31.8], 1.2);                                              // Wall St
  mLine([840, -20.5, 1100, -18.5, 1433, -9.9], 1.6);                                // Park Row
  mLine([0, 14, -250, 8, -520, 3], 1.6);                                            // Hudson St / 8th Ave south
  mLine([311, 14, 250, 2, 250, -10], 1.6);                                          // 6th Ave south
  mLine([0, 14, -40, 5, 80, -2, 130, -17], 1.6);                                    // 7th Ave S / Varick
  mLine([1000, -17.5, 1000, 0.3, 1030, 8], 1.2);                                    // Lafayette / Centre
  // rotated street patterns south of the grid
  function subgrid(arr, angDeg, pu, pv, wu, wv, ox, oz, did, zf) {
    const a = angDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const Lu = pu > pv ? 3 : (pu - wu) / 2, Lv = pu > pv ? (pv - wv) / 2 : 3;
    polySpans(Array.isArray(arr[0]) ? arr : MP(arr), (z, xa, xb) => {
      for (let x = xa; x <= xb; x++) {
        const i = z * W + x; if (!zone[i]) continue;
        const dx = x + 0.5 - ox, dz = z + 0.5 - oz, u = dx * c + dz * s, v = -dx * s + dz * c;
        const mu = ((u % pu) + pu) % pu, mv = ((v % pv) + pv) % pv;
        if (use[i] !== U.FREE || dis[i] || (zf && zone[i] !== zf)) continue;
        dis[i] = did;
        if (mu < wu || mv < wv) { use[i] = U.ST; continue; }
        const bu = Math.floor(u / pu), bv = Math.floor(v / pv);
        lot[i] = hi(bu * 64 + Math.floor((mu - wu) / Lu), bv * 64 + Math.floor((mv - wv) / Lv), did);
      }
    });
  }
  const [ox0, oz0] = M(0, 0);
  subgrid([330, -17, 300, -23, 360, -28, 470, -33.2, 1000, -34.6, 1400, -29.5, 1720, -23.3, 1800, -20.2, 1400, -17.5, 1000, -17.5], 6, 8, 7, 1, 1, ox0, oz0, D.FIDI);
  subgrid([-50, -17, 330, -17, 300, -23, 360, -28, 470, -33.2, 471, -35.4, 330, -32, 241, -29.6, 140, -27, 34, -23.9], -20, 10, 7, 1, 1, ox0 + 3, oz0, D.BPC);
  subgrid([-50, -17, 1100, -17.6, 1150, -10, 882, -9.4, -150, -10.5, -111, -13], -5, 7, 6, 1, 1, ox0, oz0 + 2, D.TRIB);
  subgrid([-150, -10.5, 1150, -10, 1150, 0.3, 300, 0.3, -320, -1.8, -200, -8], 2, 7, 10, 1, 1, ox0 + 2, oz0, D.SOHO);
  subgrid([1100, -17.5, 1750, -22.4, 2105, -15.2, 2400, -12, 2750, -9.5, 3061, -6.4, 2500, -5, 1150, -10], -32, 8, 6, 1, 1, ox0, oz0, D.CHINA);
  subgrid([1150, -10, 2500, -5, 3061, -6.4, 3053, -1.9, 2950, 0.5, 1150, 0.3], 4, 6, 8, 1, 1, ox0 + 1, oz0 + 3, D.LES);
  subgrid([-320, -1.8, 300, 0.3, 450, 6, 400, 14, -788, 15, -650, 9, -525, 3.8, -420, 1], -29, 7, 6, 1, 1, ox0, oz0, D.WVIL);
  subgrid([300, 0.3, 1150, 0.3, 1150, 8, 622, 8, 622, 14, 400, 14, 450, 6], 0, 8, 6, 1, 1, ox0 + 4, oz0 + 1, D.GVIL);

  // ---- parks and open space (mE,n rectangles / polygons / ellipses) ----
  const mRect = (e0, n0, e1, n1, v, pred = onLand) => rectSpans(X(e0), Zn(n1), X(e1) - 1, Zn(n0) - 1, setIf(use, v, pred));
  const mEll = (e, n, re, rn, v, pred = onLand) => ellSpans(X(e), Zn(n), re / S, rn * ST / S, setIf(use, v, pred));
  const mPoly = (arr, v, pred = onLand) => polySpans(MP(arr), setIf(use, v, pred));
  // Central Park
  mRect(-259, 59.7, 607, 109.8, U.TREES);
  mEll(-40, 67.3, 190, 1.6, U.PARK); mEll(190, 82.8, 200, 2.1, U.PARK); mEll(150, 99.8, 260, 2.0, U.FIELD);
  mEll(260, 64.5, 120, 1.0, U.PARK); mEll(-150, 62.5, 100, 1.2, U.PARK);
  mEll(175, 91, 350, 4.9, U.LAKE);                                                   // Reservoir
  mEll(-30, 75.5, 200, 1.6, U.LAKE); mEll(70, 77.3, 120, 1.1, U.LAKE);               // The Lake
  mEll(440, 61, 110, 1.1, U.LAKE); mEll(440, 107.8, 190, 1.5, U.LAKE);               // Pond, Harlem Meer
  mEll(240, 79.6, 110, 0.5, U.LAKE); mEll(520, 73.5, 50, 0.5, U.LAKE); mEll(-150, 101, 70, 0.6, U.LAKE);
  mRect(330, 62.2, 420, 63, U.PLAZA);                                                // Wollman Rink
  mRect(100, 71.8, 180, 72.6, U.PLAZA);                                              // Bethesda Terrace
  mRect(430, 80, 607, 84.3, U.RES);                                                  // Met Museum
  mRect(520, 63.5, 607, 65, U.PLAZA);                                                // Zoo
  {
    const inCP = (i) => use[i] === U.TREES || use[i] === U.PARK || use[i] === U.FIELD;
    plineSpans(MP([-170, 61, -170, 108.3, 520, 108.3, 520, 61, -170, 61]), 0.6, setIf(use, U.ST, inCP));
    for (const n of [65.5, 79.3, 85.7, 97.3]) mRect(-259, n - 0.15, 607, n + 0.15, U.ST, inCP);
  }
  // other Manhattan parks
  mPoly([471, -35.4, 600, -37.5, 800, -38, 991, -36.3, 1000, -34.8, 600, -34.5, 470, -33.2], U.TREES);   // Battery Park
  mRect(500, 5.8, 730, 8, U.TREES); mRect(590, 6.6, 640, 7.2, U.PLAZA);             // Washington Sq (+ fountain plaza)
  mRect(760, 14.3, 900, 17.1, U.TREES); mRect(637, 23.3, 765, 25.9, U.TREES);        // Union Sq, Madison Sq
  mRect(330, 40.1, 520, 41.9, U.PARK); mRect(520, 40.1, 607, 41.9, U.RES);           // Bryant Park, NYPL
  mRect(1900, 7.1, 2080, 10, U.TREES); mRect(1380, 15.2, 1540, 17, U.TREES); mRect(990, 20.2, 1080, 21, U.TREES);
  mRect(1270, -9, 1320, 0, U.PARK);                                                  // Sara D. Roosevelt
  mPoly([830, -20.5, 1000, -17.9, 850, -17.9], U.TREES);                            // City Hall Park
  mRect(-760, 110, -600, 123, U.TREES); mRect(-480, 128, -360, 141, U.TREES);        // Morningside, St Nicholas
  mRect(-330, 145, -250, 155, U.TREES); mRect(560, 120, 700, 124, U.TREES);          // Jackie Robinson, Marcus Garvey
  mRect(-2100, 190, -1650, 204, U.TREES); mRect(-2150, 205, -1500, 223, U.TREES);   // Fort Tryon, Inwood Hill
  mRect(2060, 84, 2250, 90.5, U.TREES); mRect(1700, 111, 1880, 114, U.FIELD);        // Carl Schurz, Jefferson Park
  mRect(-1370, 30, -1096, 33, U.RAIL);                                               // Hudson Yards west rail yard
  mRect(-250, 31.2, -30, 32.8, U.RES);                                               // Madison Square Garden
  mRect(-1370, 34.2, -1150, 40, U.RES);                                              // Javits Center
  mRect(-548, 62, -822, 66, U.RES);                                                  // Lincoln Center
  mRect(311, 48, 622, 51, U.RES);                                                    // Rockefeller Center
  mRect(1685, 42, 2000, 48, U.RES);                                                  // United Nations
  mRect(1685, 14.2, 2400, 23, U.RES);                                                // Stuy Town / Peter Cooper
  mRect(-1100, 114, -822, 120, U.RES); mRect(-822, 110, -680, 113, U.RES);           // Columbia, St John the Divine
  mRect(-1370, 16, -1250, 22, U.PLAZA);                                              // Chelsea Piers apron
  // Manhattan shore roads and waterfront parks (by distance to water, split east/west by a midline)
  const midMN = [-40, 700, -10, 1400, 5, 1400, 20, 600, 40, 250, 60, 250, 100, 200, 125, 100, 140, -500, 160, -900, 180, -1300, 225, -1400];
  const eastWest = [];
  for (let z = 0; z < W; z++) eastWest.push(X(lerpTab(midMN, nOf(z))));
  for (let z = 0; z < W; z++) {
    const n = nOf(z), mx = eastWest[z];
    for (let x = 0; x < W; x++) {
      const i = z * W + x; if (zone[i] !== 1) continue;
      const d = dW[i]; if (d > 12) continue;
      const east = x > mx;
      if (use[i] === U.RES) continue;
      if (east) {
        if (n > -34 && n < 124) {
          if (d <= 1) use[i] = U.PLAZA;
          else if (d <= 3) use[i] = U.HWY;
          else if (d <= 9 && n > -5 && n < 13) use[i] = U.TREES;            // East River Park
        } else if (n >= 124 && n < 200 && d <= 2) use[i] = d <= 1 ? U.TREES : U.HWY;   // Harlem River Drive
        else if (n >= 155 && n < 198 && d <= 14 && x > X(-1000)) use[i] = U.TREES;  // Highbridge Park
      } else {
        if (n > -34 && n < 59) {
          if (d <= 1) use[i] = U.PARK;
          else if (d <= 4) use[i] = U.HWY;
        } else if (n >= 59 && n < 221) {
          if (d <= 1) use[i] = U.PARK;
          else if (d <= 3) use[i] = U.HWY;
          else if (d <= 11 && n > 70 && n < 160) use[i] = U.TREES;           // Riverside Park
          else if (d <= 7 && n >= 160) use[i] = U.TREES;                      // Fort Washington Park
        }
      }
    }
  }

  // =====================================================================
  // 4. OUTER BOROUGHS + NEW JERSEY: land use, parks, highways, airport, piers, street grids
  // =====================================================================
  const notMN = (i) => zone[i] !== 0 && zone[i] !== 1;
  const pEll = (lat, lon, rx, rz, deg, v, pred = notMN) => ellSpans(...P(lat, lon), rx, rz, setIf(use, v, pred), BR(deg));
  const pPoly = (ll, v, pred = notMN) => { const pts = []; for (let i = 0; i < ll.length; i += 2) pts.push(P(ll[i], ll[i + 1])); polySpans(pts, setIf(use, v, pred)); };
  const pLine = (ll, w, v, pred = notMN) => { const pts = []; for (let i = 0; i < ll.length; i += 2) pts.push(P(ll[i], ll[i + 1])); plineSpans(pts, w / 2, setIf(use, v, pred)); };
  // LaGuardia: extend landfill under the runways, then runways / apron / terminals
  {
    const rw = [[40.7700, -73.8870, 40.7860, -73.8700], [40.7740, -73.8860, 40.7810, -73.8550]];
    const land = (z, a, b) => { for (let i = z * W + a; i <= z * W + b; i++) if (!zone[i]) { zone[i] = 4; ter[i] = LAND_Y; } };
    for (const r of rw) plineSpans([P(r[0], r[1]), P(r[2], r[3])], 5, land);
    pPoly([40.7690, -73.8880, 40.7760, -73.8880, 40.7750, -73.8600, 40.7680, -73.8620], U.TARMAC);
    for (const r of rw) plineSpans([P(r[0], r[1]), P(r[2], r[3])], 2.2, setIf(use, U.RUNWAY, notMN));
    pPoly([40.7700, -73.8800, 40.7735, -73.8800, 40.7730, -73.8660, 40.7695, -73.8670], U.RES);
  }
  // parks, cemeteries, yards
  pPoly([40.6742, -73.9703, 40.6610, -73.9800, 40.6515, -73.9750, 40.6545, -73.9620, 40.6630, -73.9620, 40.6700, -73.9650], U.TREES); // Prospect Park
  pEll(40.6650, -73.9735, 10, 40, 20, U.PARK); pEll(40.6555, -73.9670, 22, 14, 60, U.LAKE);
  pEll(40.6742, -73.9703, 6, 6, 0, U.PLAZA);                                                 // Grand Army Plaza
  pEll(40.6712, -73.9636, 8, 5, 0, U.RES);                                                   // Brooklyn Museum
  pEll(40.6690, -73.9620, 12, 16, 20, U.TREES);                                              // Botanic Garden
  pPoly([40.7040, -74.0620, 40.7100, -74.0520, 40.7070, -74.0450, 40.6950, -74.0520, 40.6880, -74.0620], U.PARK); // Liberty State Park
  pEll(40.7081, -74.0550, 6, 5, 0, U.RES);                                                   // Liberty Science Center
  pEll(40.7075, -74.0345, 6, 3, 0, U.RES);                                                   // CRRNJ terminal
  pEll(40.7210, -73.9510, 14, 9, 0, U.PARK);                                                 // McCarren Park
  pEll(40.7790, -73.9230, 12, 20, 30, U.TREES);                                              // Astoria Park
  pPoly([40.7580, -73.8520, 40.7570, -73.8380, 40.7200, -73.8280, 40.7180, -73.8420], U.PARK); // Flushing Meadows
  pEll(40.7571, -73.8458, 11, 11, 0, U.RES); pEll(40.7497, -73.8467, 12, 9, 0, U.RES);    // Citi Field, USTA
  pEll(40.7466, -73.8448, 5, 5, 0, U.RES);                                                   // Unisphere
  pEll(40.7300, -73.9330, 55, 30, 30, U.CEM); pEll(40.7250, -73.9050, 25, 14, 80, U.CEM);   // Calvary, Mt Zion
  pPoly([40.6950, -73.9000, 40.6990, -73.8700, 40.6880, -73.8600, 40.6800, -73.8900], U.CEM); // Cypress Hills cemeteries
  pEll(40.7020, -73.8560, 90, 30, 80, U.TREES);                                              // Forest Park
  pEll(40.7480, -73.9300, 80, 12, 75, U.RAIL);                                               // Sunnyside Yard
  pEll(40.8100, -73.9130, 12, 10, 0, U.TREES); pEll(40.8390, -73.8960, 22, 14, 30, U.TREES); // St Mary's, Crotona
  pEll(40.8410, -73.9080, 9, 9, 0, U.TREES); pEll(40.8250, -73.9290, 10, 16, 20, U.PARK);   // Claremont, Macombs Dam
  pEll(40.8506, -73.8769, 45, 30, 20, U.TREES); pEll(40.8623, -73.8800, 40, 30, 20, U.TREES); // Bronx Zoo, Botanical Garden
  pEll(40.8950, -73.8900, 90, 60, 20, U.TREES); pEll(40.8790, -73.8930, 16, 22, 20, U.LAKE); // Van Cortlandt, Jerome Res.
  pEll(40.8140, -73.8680, 22, 16, 0, U.PARK); pEll(40.8050, -73.8300, 28, 18, 60, U.PARK);  // Soundview, Ferry Point
  pEll(40.8650, -73.8100, 90, 60, 30, U.TREES);                                              // Pelham Bay Park
  pEll(40.8080, -73.8750, 30, 20, 30, U.IND); pEll(40.8030, -73.9120, 25, 14, 60, U.IND);   // Hunts Point, Port Morris
  pEll(40.8130, -73.9250, 20, 8, 20, U.RAIL);                                                // Mott Haven yard
  pEll(40.7020, -73.9710, 30, 16, 20, U.IND);                                                // Brooklyn Navy Yard
  pEll(40.6760, -74.0100, 26, 18, 20, U.IND); pEll(40.7280, -73.9350, 34, 14, 80, U.IND);   // Red Hook, Newtown Creek
  pEll(40.7600, -73.9450, 10, 8, 0, U.IND);                                                  // Ravenswood power plant
  pEll(40.7870, -73.9050, 20, 10, 60, U.IND);                                                // Con Ed Astoria
  pEll(40.7200, -74.0450, 6, 5, 0, U.PARK); pEll(40.7275, -74.0440, 5, 5, 0, U.PARK);       // Van Vorst, Hamilton
  pEll(40.7350, -74.0275, 8, 5, 0, U.RES);                                                   // Hoboken Terminal
  pEll(40.7450, -74.0245, 12, 8, 0, U.TREES);                                                // Stevens / Castle Point
  pEll(40.6980, -73.9990, 5, 30, 20, U.PARK, (i) => zone[i] === 3 && dW[i] <= 6);            // Brooklyn Bridge Park
  // islands: Governors, Randalls, Roosevelt, Liberty, Ellis, Rikers, marsh
  for (let i = 0; i < NN; i++) if (zone[i] === 6) use[i] = U.PARK;
  pEll(40.6930, -74.0160, 9, 9, 0, U.RES, (i) => zone[i] === 6);                             // Fort Jay
  pEll(40.6940, -74.0195, 3, 3, 0, U.RES, (i) => zone[i] === 6);                             // Castle Williams
  pEll(40.6860, -74.0200, 20, 12, 30, U.TREES, (i) => zone[i] === 6);                        // The Hills
  mEll(2400, 60, 60, 12, U.FREE, (i) => zone[i] === 6); mEll(2600, 80, 50, 4, U.FREE, (i) => zone[i] === 6); // Roosevelt Isl. housing
  mEll(2600, 118, 300, 6, U.FIELD, (i) => zone[i] === 6);                                    // Randalls fields
  mEll(5450, 139, 400, 3.5, U.FREE, (i) => zone[i] === 6);                                   // Rikers jails
  pEll(40.6995, -74.0396, 8, 4, 0, U.RES, (i) => zone[i] === 6);                             // Ellis main building
  pEll(40.6892, -74.0445, 5, 5, 0, U.RES, (i) => zone[i] === 6);                             // Statue of Liberty
  for (const [la, lo, rx, rz, a] of [[40.625, -73.860, 40, 16, 30], [40.615, -73.835, 34, 20, 70], [40.632, -73.842, 18, 10, 10],
    [40.607, -73.870, 30, 12, 40], [40.620, -73.815, 26, 12, 110]]) pEll(la, lo, rx, rz, a, U.MARSH, (i) => zone[i] === 6);
  // highways and boulevards (drawn over parks, as in reality)
  const HW = (ll, w) => pLine(ll, w, U.HWY, (i) => notMN(i) && use[i] !== U.RES && use[i] !== U.LAKE);
  HW([40.6900, -74.0000, 40.6990, -73.9900, 40.6990, -73.9760, 40.7090, -73.9530, 40.7190, -73.9420, 40.7285, -73.9280, 40.7400, -73.9120, 40.7520, -73.9030, 40.7650, -73.8950], 3); // BQE
  HW([40.7440, -73.9510, 40.7390, -73.9100, 40.7360, -73.8700, 40.7390, -73.8300, 40.7450, -73.7900, 40.7500, -73.7400], 3);  // LIE
  HW([40.7790, -73.9200, 40.7700, -73.9000, 40.7680, -73.8700, 40.7580, -73.8430, 40.7350, -73.8250, 40.7200, -73.8050, 40.7150, -73.7700], 3); // Grand Central Pkwy
  HW([40.7500, -73.9400, 40.7430, -73.9200, 40.7390, -73.9000, 40.7350, -73.8700, 40.7250, -73.8500, 40.7100, -73.8300, 40.7050, -73.8000], 3); // Queens Blvd
  HW([40.7580, -73.8350, 40.7300, -73.8250, 40.7000, -73.8150, 40.6650, -73.8050], 3);     // Van Wyck
  HW([40.8500, -73.9380, 40.8440, -73.9270, 40.8420, -73.9000, 40.8350, -73.8700, 40.8300, -73.8350, 40.8250, -73.8000], 3); // Cross Bronx
  HW([40.8030, -73.9280, 40.8250, -73.9320, 40.8500, -73.9260, 40.8780, -73.9080, 40.9000, -73.8950], 3);  // Major Deegan
  HW([40.8050, -73.9150, 40.8150, -73.8900, 40.8250, -73.8600, 40.8280, -73.8300, 40.8350, -73.8000], 3);  // Bruckner
  HW([40.8180, -73.9280, 40.8280, -73.9220, 40.8450, -73.9120, 40.8620, -73.8980, 40.8750, -73.8850], 3);  // Grand Concourse
  HW([40.6742, -73.9703, 40.6690, -73.9300, 40.6680, -73.9000, 40.6720, -73.8800], 3);      // Eastern Parkway
  HW([40.6900, -73.9980, 40.6850, -73.9770, 40.6790, -73.9400, 40.6760, -73.9000, 40.6830, -73.8700], 2); // Atlantic Ave
  HW([40.6990, -73.9840, 40.6826, -73.9754, 40.6742, -73.9703, 40.6550, -73.9590, 40.6300, -73.9460], 2); // Flatbush Ave
  HW([40.7620, -74.0240, 40.7610, -74.0400, 40.7600, -74.0700], 3);                         // Route 495 (Lincoln Tunnel)
  HW([40.8540, -73.9650, 40.8520, -73.9800, 40.8500, -74.0000], 3);                         // I-95 approach, Fort Lee
  HW([40.6950, -74.0700, 40.7300, -74.0600, 40.7700, -74.0400, 40.8200, -74.0000, 40.8700, -73.9700], 2); // Kennedy Blvd / Palisade Ave
  // outer-borough street grids: [zone, mE0, n0, mE1, n1, frameAngle, pu, pv, district]
  const OB = [
    [2, -4400, -95, -1000, -12, -20, 8, 7, 20], [2, -3600, -12, -1600, 25, -19, 9, 6, 21], [2, -3400, 25, -2400, 150, 0, 7, 6, 22],
    [2, -4200, 150, -3000, 250, -10, 9, 8, 23], [2, -7000, -95, -3300, 250, 0, 7, 6, 24],
    [3, 2000, -95, 4200, -20, -9, 7, 6, 30], [3, 2400, -35, 5200, -8, -27, 7, 6, 31], [3, 3400, -8, 5600, 22, -9, 7, 6, 32],
    [4, 2500, 30, 4400, 62, -9, 7, 6, 40], [4, 2900, 62, 6200, 125, 31, 8, 6, 41],
    [5, -2400, 125, 3200, 250, 0, 7, 6, 50],
  ];
  for (const [zf, e0, n0, e1, n1, ang, pu, pv, did] of OB) subgrid([e0, n0, e1, n0, e1, n1, e0, n1], ang, pu, pv, 1, 1, ox0, oz0, did, zf);
  const all = [[0, 0], [W, 0], [W, W], [0, W]];
  subgrid(all, 16, 7, 6, 1, 1, ox0 + 2, oz0, 33, 3);             // rest of Brooklyn
  subgrid(all, -29, 8, 6, 1, 1, ox0, oz0 + 3, 42, 4);            // rest of Queens
  subgrid(all, -19, 7, 6, 1, 1, ox0 + 1, oz0, 51, 5);            // rest of the Bronx
  subgrid(all, -29, 8, 7, 1, 1, ox0, oz0, 60, 6);                // island housing
  // piers: perpendicular to the frame x axis, from the first water cell found scanning from `fromX`
  function pier(n, fromX, dir, len, wid) {
    const zc = Math.round(Zn(n));
    if (zc < 1 || zc >= W - 1) return;
    let x = Math.round(fromX === null ? eastWest[zc] : fromX), guard = 0;
    while (x > 0 && x < W - 1 && zone[zc * W + x] !== 0 && guard++ < 400) x += dir;
    if (guard >= 400) return;
    for (let z = zc - Math.floor(wid / 2); z < zc - Math.floor(wid / 2) + wid; z++)
      for (let k = 0; k < len; k++) {
        const xx = x + k * dir, i = z * W + xx; if (xx < 0 || xx >= W || z < 0 || z >= W || zone[i] !== 0) continue;
        zone[i] = 7; use[i] = U.PIER; ter[i] = LAND_Y;
      }
  }
  for (const [n, len, wid] of [[-1, 22, 18], [4.5, 20, 3], [8, 18, 3], [11, 16, 3], [13.2, 8, 6], [16, 20, 5], [18.5, 22, 4], [20.5, 22, 4],
    [22.5, 22, 4], [26, 16, 3], [36, 18, 5], [41, 16, 3], [43, 14, 3], [44.5, 18, 3], [46.4, 24, 3], [48.5, 26, 3],
    [50.5, 26, 3], [52.5, 26, 3], [54.5, 22, 3], [57.5, 18, 3]]) pier(n, null, -1, len, wid);
  for (const [n, len, wid] of [[-25.5, 12, 4], [-30.5, 8, 3], [-33.5, 8, 4], [-27.5, 8, 2], [18, 8, 2], [33.5, 5, 3]]) pier(n, X(800), 1, len, wid);
  for (const [n, len, wid] of [[-27.5, 14, 6], [-30.5, 16, 6], [-33.5, 16, 6], [-36, 16, 6], [-38.5, 16, 6], [-40.8, 12, 5],
    [-50, 12, 5], [-55, 14, 6], [-60, 14, 6]]) pier(n, X(3000), -1, len, wid);
  for (const [n, len, wid] of [[-3, 14, 3], [3, 12, 3], [8, 12, 3], [14, 10, 3], [-20, 10, 4], [-24, 12, 4]]) pier(n, X(-3000), 1, len, wid);

  // =====================================================================
  // 5. BUILDING FABRIC: heights, footprints and materials per lot
  // =====================================================================
  const LM = LMK();
  for (const l of LM) {                                   // reserve landmark footprints (no generic fabric there)
    const w = l.fw || l.t[0][0], d = l.fd || l.t[0][1];
    const x0 = Math.round(l.p[0] - w / 2), z0 = Math.round(l.p[1] - d / 2);
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || z < 0 || x >= W || z >= W) continue;
      const i = z * W + x; if (zone[i] && use[i] !== U.LAKE) use[i] = U.RES;
    }
  }
  const isRoad = (i) => use[i] === U.ST || use[i] === U.AVE || use[i] === U.HWY;
  chamfer(dst, isRoad, 30);
  const dAve = new Uint8Array(NN);
  chamfer(dAve, (i) => use[i] === U.AVE, 30);
  const gs = (a, b, s1, s2, amp, e, n) => { const p = (e - a) / s1, q = (n - b) / s2; return amp * Math.exp(-(p * p + q * q)); };
  function mH(mE, n) {
    let h = n < -17 ? 6 : n < 0 ? 3 : n < 14 ? 2.2 : n < 59 ? 4 : n < 110 ? 3 : n < 160 ? 2.3 : 2.4;
    h += gs(850, -28, 450, 7, 11, mE, n) + gs(450, 49, 700, 9, 11, mE, n) + gs(1300, 48, 400, 8, 3, mE, n);
    h += gs(-950, 33, 300, 4, 6, mE, n) + gs(600, 28, 600, 5, 3, mE, n) + gs(300, 57, 500, 2.5, 4, mE, n);
    h += gs(1500, 72, 500, 12, 2.5, mE, n) + gs(-900, 64, 400, 6, 4, mE, n) + gs(150, -20, 250, 5, 5, mE, n);
    h += gs(-150, 157, 180, 2.5, 5, mE, n) + gs(1450, 110, 350, 10, 3, mE, n) + gs(2700, -3, 350, 5, 3, mE, n);
    h += gs(1100, 132, 250, 3, 3, mE, n) + gs(-1200, 60, 250, 5, 5, mE, n) + gs(1300, 30, 450, 5, 2.5, mE, n);
    return h;
  }
  const OBH = { 20: 2.2, 21: 1.7, 22: 1.7, 23: 2, 24: 1.4, 30: 1.8, 31: 1.5, 32: 1.8, 33: 1.25, 40: 2.2, 41: 1.4, 42: 1.15,
    50: 1.9, 51: 1.7, 60: 3 };
  const OBP = { 20: 3, 21: 3, 22: 2, 23: 2, 24: 2, 30: 2, 31: 2, 32: 3, 33: 2, 40: 3, 41: 2, 42: 1, 50: 3, 51: 2, 60: 3 };
  const CL = [[40.6920, -73.9860, 25, 14], [40.7200, -73.9610, 12, 8], [40.7350, -73.9590, 8, 8], [40.7480, -73.9420, 18, 12],
    [40.7440, -73.9560, 14, 10], [40.7200, -74.0350, 20, 13], [40.8530, -73.9700, 18, 7], [40.7590, -73.8300, 15, 6],
    [40.7020, -73.8000, 15, 5], [40.7730, -73.9330, 8, 6], [40.8850, -73.9150, 20, 6], [40.6830, -73.9760, 10, 8],
    [40.7327, -74.0628, 10, 8], [40.7580, -74.0280, 10, 4], [40.8280, -73.9220, 20, 3], [40.8200, -73.9100, 16, 4],
    [40.6600, -73.9500, 30, 2], [40.7450, -73.8900, 25, 2], [40.8150, -73.8600, 18, 4]].map(([la, lo, r, p]) => { const q = P(la, lo); return [q[0], q[1], r, p]; });
  const PAL = {
    old: ['stone', 'light_gray', 'sandstone', 'granite', 'concrete', 'brick', 'light_gray', 'stone'],
    glass: ['glass_blue', 'glass_dark', 'glass', 'steel', 'glass_blue', 'glass_dark'],
    res: ['brick', 'dark_brick', 'sandstone', 'granite', 'light_gray', 'brown', 'stone', 'brick'],
    vil: ['brick', 'dark_brick', 'light_gray', 'sandstone', 'stone', 'white', 'brick', 'red'],
    outer: ['brick', 'dark_brick', 'sandstone', 'light_gray', 'white', 'brick', 'granite', 'concrete', 'brown'],
    ind: ['light_gray', 'gray', 'concrete', 'steel', 'brick', 'light_gray'],
  };
  const ROOF = ['dark_gray', 'gray', 'black', 'light_gray', 'white', 'gray', 'dark_gray'];
  const ROOF_OUT = ['dark_gray', 'gray', 'roof', 'light_gray', 'white', 'roof', 'black'];
  const WINDOW = new Uint8Array(40);                        // facade -> window-band material (0 = none)
  for (const b of ['stone', 'light_gray', 'sandstone', 'granite', 'concrete', 'brick', 'dark_brick', 'white', 'brown']) WINDOW[K[b]] = K.glass_dark;
  WINDOW[K.glass_blue] = K.steel; WINDOW[K.glass_dark] = K.gray; WINDOW[K.steel] = K.glass_blue;
  for (let z = 0; z < W; z++) {
    const n = nOf(z);
    for (let x = 0; x < W; x++) {
      const i = z * W + x; if (use[i] !== U.FREE || !zone[i] || !lot[i]) continue;
      const d = dis[i], key = lot[i];
      const r1 = hash(key, 1, 3), r2 = hash(key, 2, 3), r3 = hash(key, 3, 3), r4 = hash(key, 4, 3);
      let target, perim, towerP, pal, roofs = ROOF, maxH = 44;
      if (d >= 1 && d <= 9) {                               // Manhattan
        const mE = mEof(x);
        target = mH(mE, n);
        const resid = (n >= 59 && n < 220) || d === D.WVIL || d === D.GVIL;
        if (resid && d === D.MAIN) target *= dAve[i] <= 3 ? 2.0 : 0.75;
        else if (d === D.MAIN && dAve[i] <= 3) target *= 1.25;
        perim = 30; towerP = clamp((target - 3) / 22, 0, 0.3);
        pal = (n < -17 || (n > 28 && n < 60)) ? (r4 < (target > 8 ? 0.5 : 0.2) ? PAL.glass : PAL.old)
          : (d === D.WVIL || d === D.GVIL || d === D.SOHO || d === D.TRIB) ? PAL.vil
          : (r4 < clamp((target - 5) / 14, 0, 0.5) ? PAL.glass : PAL.res);
        if (d === D.BPC) { target = 9; pal = r4 < 0.5 ? PAL.glass : PAL.old; }
      } else {
        target = OBH[d] || 1.3; perim = OBP[d] || 2;
        for (const c of CL) { const dx = x - c[0], dz = z - c[1], q = (dx * dx + dz * dz) / (c[2] * c[2]); if (q < 4) target += c[3] * Math.exp(-q); }
        towerP = clamp((target - 3) / 18, 0, 0.3);
        pal = target > 6 && r4 < 0.6 ? PAL.glass : PAL.outer; roofs = ROOF_OUT; maxH = 30;
        if (dst[i] > perim) { use[i] = U.YARD; continue; }
        if (d === 42 && hash(x >> 1, z >> 1, 17) < 0.18) { use[i] = U.YARD; continue; }   // detached-house gaps
      }
      if (use[i] === U.FREE && zone[i] === 4 && d === 42 && target < 1.5) roofs = ROOF_OUT;
      let h = target * (0.5 + 0.95 * r1 * r1);
      if (r2 < towerP) h = target * (1.5 + 1.3 * r3);
      h = clamp(Math.round(h), 1, maxH);
      if (dst[i] > 8 && h > 2) h = Math.max(1, Math.round(h * 0.4));  // deep block interiors: low wings
      hgt[i] = h;
      mat[i] = K[pick(pal, hash(key, 5, 3))];
      rfm[i] = h >= 12 && pal === PAL.glass ? K.steel : K[pick(roofs, hash(key, 6, 3))];
    }
  }
  // industrial zones: big low sheds with flat pale roofs
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
    const i = z * W + x; if (use[i] !== U.IND) continue;
    if (dst[i] <= 1 && hash(x >> 3, z >> 3, 21) < 0.5) { use[i] = U.PLAZA; continue; }
    const k = hi(x >> 3, z >> 2, 23);
    hgt[i] = 1 + (hash(k, 1, 1) < 0.3 ? 1 : 0); mat[i] = K[pick(PAL.ind, hash(k, 2, 1))]; rfm[i] = K[pick(['light_gray', 'white', 'gray', 'steel'], hash(k, 3, 1))];
    use[i] = U.FREE;
  }

  // =====================================================================
  // 6. EMIT GROUND, WATER AND BUILDINGS
  // =====================================================================
  const BL = (k) => B[k];
  let cntFill = 0;
  const F = (x0, y0, z0, x1, y1, z1, b) => { cntFill++; world.fill(x0, y0, z0, x1, y1, z1, b); };
  const topOf = (i, x, z) => {
    switch (use[i]) {
      case U.ST: case U.AVE: case U.HWY: case U.RUNWAY: return K.asphalt;
      case U.PLAZA: case U.RES: case U.TARMAC: return K.concrete;
      case U.PARK: case U.YARD: return K.grass;
      case U.TREES: return (hash(x, z, 31) < 0.15) ? K.dirt : K.grass;
      case U.FIELD: return ((x >> 2) + (z >> 2)) % 3 === 0 ? K.lime : K.grass;
      case U.LAKE: return K.water;
      case U.RAIL: return (z + x) % 3 === 0 ? K.steel : K.cobblestone;
      case U.SAND: return K.sand;
      case U.CEM: return (x % 2 === 0 && z % 2 === 0) ? K.light_gray : K.grass;
      case U.PIER: return zone[i] === 7 && hash(x >> 2, z >> 2, 33) < 0.5 ? K.planks : K.concrete;
      case U.MARSH: { const r = hash(x, z, 35); return r < 0.45 ? K.grass : r < 0.7 ? K.lime : K.sand; }
      default: return zone[i] === 2 || zone[i] >= 3 ? K.light_gray : K.concrete;
    }
  };
  const top = new Uint8Array(W), sub = new Uint8Array(W);
  for (let z = 0; z < W; z++) {
    for (let x = 0; x < W; x++) {
      const i = z * W + x;
      if (!zone[i]) { top[x] = K.water; sub[x] = K.blue; continue; }
      top[x] = topOf(i, x, z);
      sub[x] = elev[i] >= 2 ? K.stone : K.dirt;
    }
    // subsurface runs
    let x0 = 0;
    for (let x = 1; x <= W; x++) {
      const i0 = z * W + x0;
      if (x < W && sub[x] === sub[x0] && ter[z * W + x] === ter[i0]) continue;
      const t = ter[i0];
      if (t >= 1) F(x0, 0, z, x - 1, t - 1, z, BL(sub[x0]));
      x0 = x;
    }
    x0 = 0;
    for (let x = 1; x <= W; x++) {
      const i0 = z * W + x0;
      if (x < W && top[x] === top[x0] && ter[z * W + x] === ter[i0]) continue;
      F(x0, ter[i0], z, x - 1, ter[i0], z, BL(top[x0]));
      x0 = x;
    }
    // buildings (with window bands on taller facades)
    x0 = -1;
    for (let x = 0; x <= W; x++) {
      const i = z * W + x;
      const same = x < W && x0 >= 0 && hgt[i] === hgt[z * W + x0] && mat[i] === mat[z * W + x0] && rfm[i] === rfm[z * W + x0] && ter[i] === ter[z * W + x0];
      if (same) continue;
      if (x0 >= 0 && hgt[z * W + x0] > 0) {
        const j = z * W + x0, b = ter[j] + 1, h = hgt[j], m = mat[j], wb = WINDOW[m];
        if (h > 1) {
          if (h >= 4 && wb) {
            F(x0, b, z, x - 1, b + h - 2, z, BL(m));
            for (let y = b + 1; y < b + h - 1; y += 2) F(x0, y, z, x - 1, y, z, BL(wb));
          } else F(x0, b, z, x - 1, b + h - 2, z, BL(m));
        }
        F(x0, b + h - 1, z, x - 1, b + h - 1, z, BL(h === 1 ? m : rfm[j]));
      }
      x0 = x < W && hgt[i] > 0 ? x : -1;
    }
    // trees: single-block canopies, some two high
    for (let x = 0; x < W; x++) {
      const i = z * W + x, u = use[i];
      if (u !== U.TREES && u !== U.YARD) continue;
      const r = hash(x, z, 41);
      if (u === U.TREES ? r < 0.55 : r < 0.12) {
        world.set(x, ter[i] + 1, z, 'leaves');
        if (r < (u === U.TREES ? 0.12 : 0.02)) world.set(x, ter[i] + 2, z, 'leaves');
      }
    }
  }

  // =====================================================================
  // 7. LANDMARKS (heights at true scale: 1 block = 12 m)
  // =====================================================================
  const gAt = (x, z) => ter[clamp(Math.round(z), 0, W - 1) * W + clamp(Math.round(x), 0, W - 1)];
  const boxC = (cx, cz, w, d, y0, y1, b) => {
    const x0 = Math.round(cx - w / 2), z0 = Math.round(cz - d / 2);
    if (y1 >= y0) F(x0, y0, z0, x0 + w - 1, y1, z0 + d - 1, b);
  };
  function tiers(cx, cz, ts, g0) {
    const g = g0 ?? gAt(cx, cz); let prev = g;
    for (const [w, d, h, m, wm] of ts) {
      const y1 = g + h; boxC(cx, cz, w, d, prev + 1, y1, m);
      if (wm) for (let y = prev + 2; y < y1; y += 2) boxC(cx, cz, w, d, y, y, wm);
      prev = y1;
    }
    return prev;
  }
  function cyl(cx, cz, r, y0, y1, b, hollow) {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      const dz = z + 0.5 - cz; if (Math.abs(dz) > r) continue;
      const hw = Math.sqrt(r * r - dz * dz), xa = Math.ceil(cx - hw - 0.5), xb = Math.floor(cx + hw - 0.5);
      if (xa > xb) continue;
      if (!hollow) { F(xa, y0, z, xb, y1, z, b); continue; }
      const iw = r - 1.2, ih = iw > 0 && Math.abs(dz) < iw ? Math.sqrt(iw * iw - dz * dz) : -1;
      if (ih < 0) F(xa, y0, z, xb, y1, z, b);
      else {
        const ia = Math.ceil(cx - ih - 0.5), ib = Math.floor(cx + ih - 0.5);
        if (ia > xa) F(xa, y0, z, ia - 1, y1, z, b); else F(xa, y0, z, xa, y1, z, b);
        if (ib < xb) F(ib + 1, y0, z, xb, y1, z, b); else F(xb, y0, z, xb, y1, z, b);
      }
    }
  }
  const custom = {
    wtc1(cx, cz) {                                     // One World Trade Center: chamfered taper, 541 m spire
      const g = gAt(cx, cz), a = 2.5;
      boxC(cx, cz, 7, 7, g + 1, g + 2, 'concrete');
      for (let y = 3; y <= 35; y++) {
        const f = (y - 3) / 32, lim = 2 * a - a * f;
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
          if (Math.abs(dx) + Math.abs(dz) <= lim + 0.01) world.set(Math.round(cx) + dx, g + y, Math.round(cz) + dz, y % 3 === 0 ? 'steel' : 'glass_blue');
      }
      boxC(cx, cz, 1, 1, g + 36, g + 45, 'steel');
    },
    pools(cx, cz) {                                    // 9/11 Memorial reflecting pools
      const g = gAt(cx, cz);
      for (const [ox, oz] of [[-3.5, -2], [2.5, 3]]) { boxC(cx + ox, cz + oz, 6, 6, g, g, 'black'); boxC(cx + ox, cz + oz, 4, 4, g, g, 'water'); }
      boxC(cx + 4, cz - 3, 5, 3, g + 1, g + 2, 'white');   // Oculus
      boxC(cx + 4, cz - 3, 1, 5, g + 3, g + 3, 'white');
    },
    flatiron(cx, cz) {
      const g = gAt(cx, cz);
      for (let k = 0; k < 6; k++) F(Math.round(cx - k / 2), g + 1, Math.round(cz) - 3 + k, Math.round(cx + k / 2), g + 7, Math.round(cz) - 3 + k, k % 2 ? 'sandstone' : 'light_gray');
    },
    citigroup(cx, cz) {
      const g = tiers(cx, cz, [[4, 4, 21, 'light_gray', 'glass_dark']]);
      for (let k = 0; k < 3; k++) F(Math.round(cx) - 2, g + 1 + k, Math.round(cz) - 2, Math.round(cx) + 1 - k - 1, g + 1 + k, Math.round(cz) + 1, 'white');
    },
    msg(cx, cz) { const g = gAt(cx, cz); cyl(cx, cz, 5.2, g + 1, g + 3, 'light_gray'); cyl(cx, cz, 5.2, g + 4, g + 4, 'steel'); },
    guggenheim(cx, cz) { const g = gAt(cx, cz); cyl(cx, cz, 2.2, g + 1, g + 1, 'white'); cyl(cx, cz, 2.7, g + 2, g + 2, 'white'); cyl(cx, cz, 3.2, g + 3, g + 3, 'white'); },
    liberty(cx, cz) {                                  // Fort Wood star, granite pedestal, copper-green statue, gold torch
      const g = gAt(cx, cz), x = Math.round(cx), z = Math.round(cz);
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++)
        if (Math.abs(dx) + Math.abs(dz) <= 5 || (Math.abs(dx) <= 1 || Math.abs(dz) <= 1)) world.set(x + dx, g + 1, z + dz, 'stone');
      F(x - 1, g + 2, z - 1, x + 1, g + 4, z + 1, 'granite');
      F(x, g + 5, z, x + 1, g + 8, z + 1, 'cyan');
      world.set(x, g + 9, z, 'cyan'); world.set(x + 1, g + 9, z, 'cyan'); world.set(x + 1, g + 10, z, 'gold');
    },
    stadium(cx, cz, r, m, field) {                     // bowl with grass field
      const g = gAt(cx, cz);
      cyl(cx, cz, r, g + 1, g + 4, m, true); cyl(cx, cz, r - 1.2, g + 1, g + 2, 'concrete', true);
      cyl(cx, cz, r - 2.5, g, g, field || 'grass');
    },
    yankee(cx, cz) { custom.stadium(cx, cz, 11, 'white'); boxC(cx - 2, cz + 2, 4, 4, gAt(cx, cz), gAt(cx, cz), 'sand'); },
    citi(cx, cz) { custom.stadium(cx, cz, 10, 'dark_gray'); boxC(cx + 2, cz - 2, 4, 4, gAt(cx, cz), gAt(cx, cz), 'sand'); },
    ashe(cx, cz) { custom.stadium(cx, cz, 6, 'blue', 'blue'); },
    unisphere(cx, cz) {
      const g = gAt(cx, cz); cyl(cx, cz, 4, g, g, 'water'); boxC(cx, cz, 1, 1, g + 1, g + 2, 'steel');
      for (let t = 0; t < 64; t++) { const a = t * Math.PI / 32; world.set(Math.round(cx + 3 * Math.cos(a)), g + 5 + Math.round(3 * Math.sin(a)), Math.round(cz), 'steel'); world.set(Math.round(cx), g + 5 + Math.round(3 * Math.sin(a)), Math.round(cz + 3 * Math.cos(a)), 'steel'); }
    },
    barclays(cx, cz) { const g = gAt(cx, cz); cyl(cx, cz, 7, g + 1, g + 3, 'copper'); cyl(cx, cz, 7, g + 3, g + 3, 'dark_gray'); },
    stacks(cx, cz) {                                   // Ravenswood "Big Allis" red-and-white stacks
      const g = gAt(cx, cz); boxC(cx, cz, 10, 5, g + 1, g + 2, 'light_gray');
      for (let k = 0; k < 4; k++) for (let y = 3; y <= 13; y++) world.set(Math.round(cx) - 3 + k * 2, g + y, Math.round(cz), (y >> 1) % 2 ? 'red' : 'white');
    },
    pepsi(cx, cz) { const g = gAt(cx, cz); F(Math.round(cx), g + 2, Math.round(cz) - 4, Math.round(cx), g + 3, Math.round(cz) + 4, 'red'); boxC(cx, cz, 1, 3, g + 1, g + 1, 'steel'); },
    ellis(cx, cz) { const g = tiers(cx, cz, [[10, 5, 3, 'brick', 'white']]); for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) boxC(cx + dx, cz + dz, 1, 1, g + 1, g + 2, 'white'); boxC(cx, cz, 3, 2, g + 1, g + 1, 'roof'); },
    fortjay(cx, cz) { const g = gAt(cx, cz); for (let k = -6; k <= 6; k++) for (const s of [-6, 6]) { world.set(Math.round(cx + k), g + 1, Math.round(cz + s), 'brick'); world.set(Math.round(cx + s), g + 1, Math.round(cz + k), 'brick'); } },
    castle(cx, cz) { const g = gAt(cx, cz); cyl(cx, cz, 2.6, g + 1, g + 3, 'brick', true); },
    vessel(cx, cz) { const g = gAt(cx, cz); cyl(cx, cz, 1.6, g + 1, g + 2, 'copper', true); cyl(cx, cz, 2.2, g + 3, g + 4, 'copper', true); },
    hy30(cx, cz) { const g = tiers(cx, cz, [[5, 4, 28, 'glass', 'steel'], [4, 4, 32, 'glass']]); F(Math.round(cx) - 5, g - 4, Math.round(cz) - 1, Math.round(cx) - 3, g - 4, Math.round(cz), 'steel'); },
    dbcenter(cx, cz) { const g = gAt(cx, cz); boxC(cx, cz, 10, 6, g + 1, g + 5, 'glass_dark'); for (const o of [-3, 3]) tiers(cx + o, cz, [[3, 3, 19, 'glass_dark', 'steel']], g); },
    stpat(cx, cz) { const g = tiers(cx, cz, [[7, 4, 3, 'white']]); for (const o of [-1, 1]) boxC(cx - 3, cz + o, 1, 1, g + 1, g + 6, 'white'); boxC(cx + 1, cz, 5, 2, g + 1, g + 1, 'roof'); },
    columbia(cx, cz) { const g = gAt(cx, cz); tiers(cx, cz, [[5, 5, 2, 'sandstone'], [3, 3, 3, 'light_gray']], g); for (const [dx, dz] of [[-9, -5], [9, -5], [-9, 6], [9, 6], [0, 11]]) tiers(cx + dx, cz + dz, [[6, 4, 3, 'brick', 'light_gray']], g); },
    cathedral(cx, cz) { const g = tiers(cx, cz, [[12, 3, 6, 'granite']]); boxC(cx - 5, cz, 2, 3, g + 1, g + 2, 'granite'); boxC(cx + 1, cz, 3, 3, g + 1, g + 2, 'granite'); },
    stuytown(cx, cz) {
      const g = gAt(cx, cz), x0 = Math.round(cx - 29), z0 = Math.round(cz - 29);
      for (let j = 0; j < 6; j++) for (let k = 0; k < 6; k++) {
        const bx = x0 + 3 + k * 9, bz = z0 + 3 + j * 9;
        if (k >= 2 && k <= 3 && j >= 2 && j <= 3) continue;             // the Oval
        F(bx, g + 1, bz, bx + 4, g + 4, bz + 1, 'brick'); F(bx + 1, g + 1, bz - 1, bx + 2, g + 4, bz + 3, 'brick');
        F(bx, g + 5, bz, bx + 4, g + 5, bz + 1, 'dark_gray');
      }
      for (let z = z0; z < z0 + 58; z++) for (let x = x0; x < x0 + 58; x++) {
        const i = z * W + x; if (x < 0 || z < 0 || x >= W || z >= W || use[i] !== U.RES || zone[i] !== 1) continue;
        world.set(x, ter[i], z, 'grass'); if (hash(x, z, 51) < 0.3) world.set(x, ter[i] + 1, z, 'leaves');
      }
    },
  };
  for (const l of LM) {
    if (l.k) custom[l.k](l.p[0], l.p[1]);
    else tiers(l.p[0], l.p[1], l.t);
  }

  // ---------------------------------------------------------------------
  // landmark catalogue: {p:[x,z], t:[[w,d,topHeight,material,windowBand],...]} or {p, k:custom, fw, fd}
  // ---------------------------------------------------------------------
  function LMK() {
    const T = (p, t) => ({ p, t }), C = (p, k, fw, fd) => ({ p, k, fw, fd });
    return [
      // --- Lower Manhattan ---
      C(P(40.7127, -74.0134), 'wtc1', 7, 7),
      C(P(40.7110, -74.0128), 'pools', 14, 12),
      T(P(40.7102, -74.0119), [[4, 4, 27, 'glass_dark', 'steel']]),                 // 3 WTC
      T(P(40.7100, -74.0103), [[4, 4, 25, 'glass', 'glass_blue']]),                 // 4 WTC
      T(P(40.7133, -74.0120), [[4, 3, 19, 'glass_blue', 'steel']]),                 // 7 WTC
      T(P(40.7148, -74.0147), [[5, 3, 19, 'glass_blue', 'steel']]),                 // 200 West St
      T(P(40.7145, -74.0158), [[4, 4, 15, 'granite', 'glass_dark'], [2, 2, 17, 'copper']]),   // Brookfield Place
      T(P(40.7133, -74.0164), [[4, 4, 17, 'granite', 'glass_dark'], [2, 2, 19, 'copper']]),
      T(P(40.7120, -74.0168), [[4, 4, 16, 'granite', 'glass_dark'], [2, 2, 18, 'copper']]),
      T(P(40.7108, -74.0160), [[4, 4, 13, 'granite', 'glass_dark'], [3, 3, 15, 'copper']]),
      T(P(40.7124, -74.0083), [[5, 4, 5, 'white', 'glass_dark'], [3, 3, 17, 'white', 'glass_dark'], [2, 2, 19, 'green'], [1, 1, 20, 'green']]), // Woolworth
      T(P(40.7110, -74.0055), [[4, 3, 22, 'steel', 'glass']]),                      // 8 Spruce
      T(P(40.7064, -74.0074), [[4, 3, 16, 'sandstone', 'glass_dark'], [3, 2, 21, 'sandstone', 'glass_dark'], [1, 1, 24, 'steel']]), // 70 Pine
      T(P(40.7069, -74.0094), [[4, 4, 19, 'sandstone', 'glass_dark'], [3, 3, 21, 'green'], [2, 2, 23, 'green'], [1, 1, 24, 'gold']]), // 40 Wall
      T(P(40.7076, -74.0085), [[4, 3, 21, 'steel', 'glass_dark']]),                 // 28 Liberty
      T(P(40.7095, -74.0110), [[5, 4, 19, 'black', 'glass_dark']]),                 // 1 Liberty Plaza
      T(P(40.7132, -74.0088), [[3, 3, 20, 'sandstone', 'glass_dark'], [2, 2, 23, 'sandstone']]), // 30 Park Place
      T(P(40.7178, -74.0059), [[3, 3, 17, 'glass', 'white'], [3, 2, 21, 'glass', 'white']]),     // 56 Leonard
      T(P(40.7131, -74.0040), [[6, 4, 12, 'light_gray', 'glass_dark'], [2, 2, 14, 'light_gray'], [1, 1, 15, 'gold']]), // Municipal Bldg
      T(P(40.7128, -74.0062), [[7, 2, 2, 'white'], [1, 1, 3, 'white']]),           // City Hall
      T(P(40.7087, -74.0126), [[2, 2, 23, 'glass', 'steel']]),                      // 125 Greenwich
      T(P(40.7045, -74.0120), [[4, 4, 16, 'glass_dark', 'steel']]),                 // 17 State / Whitehall
      T(P(40.7020, -74.0120), [[5, 3, 2, 'green']]),                                 // Staten Island Ferry terminal
      // --- Midtown ---
      T(M(545, 33.5), [[11, 5, 2, 'sandstone'], [7, 4, 22, 'light_gray', 'glass_dark'], [5, 3, 26, 'light_gray', 'glass_dark'], [3, 3, 27, 'light_gray'], [2, 2, 32, 'light_gray'], [1, 1, 37, 'steel']]), // Empire State
      T(M(1130, 42.4), [[5, 5, 5, 'light_gray', 'glass_dark'], [4, 4, 18, 'white', 'glass_dark'], [3, 3, 22, 'white', 'dark_gray'], [3, 3, 23, 'steel'], [2, 2, 24, 'steel'], [1, 1, 27, 'steel']]), // Chrysler
      T(M(856, 42.6), [[5, 4, 4, 'glass', 'white'], [4, 4, 20, 'glass', 'white'], [3, 3, 30, 'glass', 'white'], [2, 2, 33, 'glass'], [1, 1, 36, 'steel']]), // One Vanderbilt
      T(M(935, 43.2), [[12, 14, 2, 'sandstone'], [10, 12, 3, 'gray']]),            // Grand Central
      T(M(935, 44.9), [[9, 4, 20, 'concrete', 'glass_dark'], [7, 3, 21, 'gray']]), // MetLife
      T(M(990, 56.6), [[3, 3, 35, 'white', 'glass_dark']]),                          // 432 Park
      T(M(-120, 57.35), [[4, 4, 6, 'glass_blue'], [4, 3, 39, 'glass_blue', 'steel']]), // Central Park Tower
      T(M(170, 57.4), [[2, 4, 25, 'copper', 'glass_dark'], [2, 3, 31, 'copper', 'glass_dark'], [2, 2, 34, 'copper'], [1, 1, 36, 'copper']]), // 111 W 57th
      T(M(230, 57.35), [[4, 3, 20, 'glass_blue', 'light_blue'], [3, 3, 24, 'glass_blue'], [2, 2, 26, 'glass_blue']]), // One57
      T(M(-60, 58.7), [[4, 3, 10, 'sandstone', 'glass_dark'], [3, 3, 24, 'sandstone', 'glass_dark']]), // 220 CPS
      T(M(450, 53.5), [[3, 3, 14, 'glass_dark', 'copper'], [2, 2, 24, 'glass_dark', 'copper'], [1, 1, 27, 'glass_dark']]), // 53W53
      T(M(290, 42.6), [[4, 4, 24, 'glass', 'steel'], [3, 3, 26, 'glass'], [1, 1, 30, 'steel']]), // Bank of America
      T(M(250, 43.5), [[4, 3, 20, 'glass', 'steel'], [2, 2, 24, 'steel'], [1, 1, 30, 'steel']]), // 4 Times Square
      T(M(-240, 40.6), [[4, 3, 19, 'glass', 'white'], [1, 1, 27, 'steel']]),       // New York Times
      T(M(-330, 49.5), [[4, 4, 16, 'brick', 'glass_dark'], [3, 3, 17, 'copper'], [2, 2, 18, 'copper'], [1, 1, 19, 'copper']]), // Worldwide Plaza
      T(M(455, 49.5), [[6, 3, 14, 'sandstone', 'glass_dark'], [5, 2, 20, 'sandstone', 'glass_dark'], [4, 2, 22, 'sandstone']]), // 30 Rock
      T(M(380, 48.4), [[8, 3, 5, 'sandstone', 'glass_dark']]), T(M(380, 50.6), [[8, 3, 5, 'sandstone', 'glass_dark']]),
      T(M(560, 49.4), [[3, 6, 5, 'sandstone']]), T(M(330, 50.6), [[4, 4, 3, 'sandstone']]),   // Rockefeller Center, Radio City
      T(M(-300, 56.6), [[4, 4, 3, 'sandstone'], [3, 3, 15, 'glass', 'steel']]),    // Hearst
      C(M(-380, 59.3), 'dbcenter', 10, 6),
      C(M(1140, 53.5), 'citigroup', 4, 4),
      T(M(560, 56.4), [[4, 3, 5, 'glass_dark'], [3, 3, 17, 'glass_dark']]),        // Trump Tower
      T(M(700, 58.8), [[5, 4, 18, 'white', 'glass_dark']]),                          // GM Building
      T(M(880, 52.5), [[3, 2, 13, 'brown', 'glass_dark']]),                          // Seagram
      T(M(1810, 44.5), [[2, 7, 13, 'glass_blue', 'white']]),                         // UN Secretariat
      T(M(1860, 46.6), [[6, 3, 2, 'white'], [4, 2, 3, 'white']]),                    // General Assembly
      T(M(1640, 47.5), [[3, 3, 22, 'glass_dark']]),                                   // Trump World Tower
      T(M(-620, 33.5), [[4, 4, 25, 'glass_blue', 'steel']]), T(M(-620, 31.5), [[4, 3, 24, 'glass', 'steel']]), // Manhattan West
      C(M(-980, 32.9), 'hy30', 5, 4),
      T(M(-1080, 33.8), [[3, 3, 26, 'sandstone', 'glass_dark']]),                    // 35 Hudson Yards
      T(M(-930, 31.3), [[4, 3, 22, 'glass_blue', 'steel']]),                         // 10 Hudson Yards
      T(M(-840, 33.4), [[5, 4, 26, 'glass_dark', 'steel']]),                         // 50 Hudson Yards
      C(M(-1030, 34.4), 'vessel', 5, 5), T(M(-1150, 31.5), [[5, 4, 5, 'steel']]),   // Vessel, Shed
      T(M(-150, 33.4), [[4, 3, 19, 'glass_dark', 'dark_gray']]),                     // One Penn Plaza
      C(M(-140, 32), 'msg', 11, 11),
      T(M(200, 34.5), [[10, 6, 4, 'brick', 'dark_brick']]),                          // Macy's
      T(M(563, 41), [[7, 12, 3, 'white']]),                                          // NY Public Library
      T(M(-1260, 37), [[18, 30, 2, 'glass', 'steel']]),                              // Javits Center
      C(M(600, 22.5), 'flatiron', 6, 6),
      T(M(830, 23.9), [[4, 4, 6, 'white'], [3, 3, 16, 'white', 'glass_dark'], [2, 2, 17, 'gold'], [1, 1, 18, 'gold']]), // Met Life Tower
      T(M(850, 26.5), [[6, 5, 10, 'white', 'glass_dark'], [3, 3, 11, 'gold'], [2, 2, 12, 'gold'], [1, 1, 13, 'gold']]), // NY Life
      C(M(690, 50.5), 'stpat', 7, 4),
      T(M(-690, 64), [[5, 4, 4, 'white']]), T(M(-640, 65.4), [[5, 3, 3, 'white']]), T(M(-640, 62.7), [[5, 3, 3, 'white']]), // Lincoln Center
      // --- Upper Manhattan ---
      T(M(-420, 79), [[20, 26, 3, 'granite', 'sandstone'], [4, 4, 5, 'copper']]),  // Natural History
      T(M(-400, 81.3), [[5, 5, 4, 'glass']]),                                         // Rose Center
      T(M(-330, 72.5), [[5, 5, 3, 'sandstone'], [5, 5, 4, 'roof']]),               // Dakota
      T(M(-330, 74.5), [[5, 5, 8, 'sandstone', 'glass_dark'], [2, 2, 12, 'sandstone']]), // San Remo
      T(M(-330, 90.5), [[5, 5, 8, 'sandstone', 'glass_dark'], [2, 2, 12, 'sandstone']]), // Eldorado
      T(M(518, 82.2), [[14, 22, 3, 'light_gray', 'white']]),                         // Metropolitan Museum
      C(M(700, 88.7), 'guggenheim', 7, 7),
      C(M(-960, 117), 'columbia', 22, 30),
      C(M(-750, 111.5), 'cathedral', 12, 4),
      T(M(-1350, 121.5), [[3, 3, 10, 'granite', 'glass_dark'], [2, 2, 11, 'granite']]),  // Riverside Church
      T(M(-1400, 122.8), [[3, 3, 3, 'white'], [2, 2, 4, 'white']]),                 // Grant's Tomb
      T(M(-1787, 202.3), [[5, 4, 2, 'stone'], [2, 2, 4, 'stone']]),                 // The Cloisters
      C(M(2040, 18.6), 'stuytown', 58, 58),
      // --- Harbor ---
      C(P(40.6892, -74.0445), 'liberty', 9, 9),
      C(P(40.6995, -74.0396), 'ellis', 10, 5),
      C(P(40.6930, -74.0160), 'fortjay', 13, 13),
      C(P(40.6940, -74.0195), 'castle', 6, 6),
      // --- Brooklyn ---
      T(P(40.6904, -73.9832), [[4, 4, 20, 'black', 'glass_dark'], [3, 3, 25, 'black', 'glass_dark'], [2, 2, 27, 'black']]), // The Brooklyn Tower
      T(P(40.6855, -73.9767), [[3, 3, 11, 'sandstone', 'glass_dark'], [2, 2, 13, 'gold']]),   // Williamsburgh Savings Bank
      C(P(40.6826, -73.9754), 'barclays', 15, 15),
      T(P(40.6928, -73.9903), [[6, 3, 2, 'white'], [1, 1, 4, 'white']]),                     // Borough Hall
      T(P(40.6712, -73.9636), [[8, 5, 3, 'sandstone']]),                                     // Brooklyn Museum
      T(P(40.6742, -73.9703), [[2, 1, 2, 'sandstone']]),                                     // Soldiers' and Sailors' Arch
      T(P(40.7145, -73.9680), [[5, 3, 4, 'brick', 'glass_dark']]),                           // Domino refinery
      T(P(40.7160, -73.9660), [[3, 3, 11, 'glass', 'steel']]), T(P(40.7128, -73.9670), [[3, 3, 13, 'brick', 'glass']]),
      T(P(40.6880, -73.9820), [[3, 3, 18, 'glass_blue', 'steel']]), T(P(40.6910, -73.9860), [[3, 3, 16, 'glass', 'steel']]),
      // --- Queens ---
      T(P(40.7473, -73.9437), [[3, 3, 17, 'glass_blue', 'green']]),                          // One Court Square
      T(P(40.7474, -73.9420), [[3, 3, 20, 'glass', 'steel']]),                               // Skyline Tower
      C(P(40.7475, -73.9590), 'pepsi', 2, 9),
      C(P(40.7600, -73.9450), 'stacks', 10, 5),
      C(P(40.7571, -73.8458), 'citi', 21, 21),
      C(P(40.7497, -73.8467), 'ashe', 13, 13),
      C(P(40.7466, -73.8448), 'unisphere', 9, 9),
      T(P(40.7718, -73.8740), [[16, 4, 2, 'glass', 'steel']]), T(P(40.7735, -73.8800), [[10, 4, 2, 'glass', 'steel']]), // LGA terminals
      T(P(40.7725, -73.8770), [[1, 1, 7, 'concrete'], [2, 2, 8, 'glass_dark']]),             // LGA control tower
      // --- Bronx ---
      C(P(40.8296, -73.9262), 'yankee', 23, 23),
      // --- New Jersey ---
      T(P(40.7165, -74.0380), [[3, 3, 23, 'glass', 'steel']]),                                // 99 Hudson
      T(P(40.7148, -74.0334), [[4, 3, 15, 'glass_blue', 'steel'], [3, 3, 20, 'glass_blue']]), // Goldman Sachs Tower
      T(P(40.7148, -74.0360), [[3, 4, 18, 'white', 'glass_dark']]),                           // Urby
      T(P(40.7175, -74.0390), [[3, 3, 16, 'glass_dark']]),                                    // Trump Plaza JC
      T(P(40.7270, -74.0330), [[3, 3, 12, 'glass', 'steel']]), T(P(40.7250, -74.0320), [[3, 3, 11, 'glass_blue', 'steel']]),
      T(P(40.7290, -74.0340), [[3, 3, 10, 'brick', 'glass']]),                                // Newport
      T(P(40.7350, -74.0275), [[8, 4, 2, 'copper'], [2, 2, 5, 'green']]),                    // Hoboken Terminal
      T(P(40.7081, -74.0550), [[6, 5, 3, 'white'], [3, 3, 4, 'steel']]),                     // Liberty Science Center
      T(P(40.7075, -74.0345), [[6, 3, 2, 'brick'], [1, 1, 4, 'brick']]),                     // CRRNJ Terminal
    ];
  }

  // =====================================================================
  // 8. BRIDGES
  // =====================================================================
  function walk(A, Bp, fn) {                          // step along A->B in half-cell steps: fn(t, cx, cz, px, pz, s)
    const dx = Bp[0] - A[0], dz = Bp[1] - A[1], L = Math.hypot(dx, dz), px = -dz / L, pz = dx / L;
    const steps = Math.max(1, Math.ceil(L * 2));
    for (let s = 0; s <= steps; s++) { const t = s / steps; fn(t, A[0] + dx * t, A[1] + dz * t, px, pz, s); }
  }
  const across = (cx, cz, px, pz, k) => [Math.floor(cx + px * k), Math.floor(cz + pz * k)];
  function deck(A, Bp, w, D, mat, ap = 0.12) {
    const gA = gAt(A[0], A[1]) + 1, gB = gAt(Bp[0], Bp[1]) + 1;
    const yF = (t) => Math.round(t < ap ? gA + (Math.max(D, gA) - gA) * t / ap : t > 1 - ap ? gB + (Math.max(D, gB) - gB) * (1 - t) / ap : D);
    walk(A, Bp, (t, cx, cz, px, pz) => {
      const y = yF(t);
      for (let k = -w / 2 + 0.25; k < w / 2; k += 0.5) { const [x, z] = across(cx, cz, px, pz, k); world.set(x, y, z, Math.abs(k) > w / 2 - 0.6 ? 'light_gray' : mat); }
    });
    return yF;
  }
  function leg(x, z, y0, y1, m, s = 1) { F(x, y0, z, x + s - 1, y1, z + s - 1, m); }
  function suspension(A, Bp, t1, t2, D, top, w, tm, cm, dm, masonry) {
    deck(A, Bp, w, D, dm);
    const pt = (t) => [A[0] + (Bp[0] - A[0]) * t, A[1] + (Bp[1] - A[1]) * t];
    const L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), px = -(Bp[1] - A[1]) / L, pz = (Bp[0] - A[0]) / L;
    for (const t of [t1, t2]) {
      const [cx, cz] = pt(t), off = w / 2 + 0.5;
      for (const sgn of [-1, 1]) { const [x, z] = across(cx, cz, px, pz, sgn * off); leg(x, z, WATER_Y, top, tm, masonry ? 2 : 1); }
      for (let k = -off; k <= off; k += 0.5) { const [x, z] = across(cx, cz, px, pz, k); world.set(x, top, z, tm); if (masonry) { world.set(x, top - 1, z, tm); world.set(x, top - 2, z, tm); } else world.set(x, D - 1, z, tm); }
    }
    const ap = 0.12;
    walk(A, Bp, (t, cx, cz, px2, pz2, s) => {
      let y;
      if (t >= t1 && t <= t2) { const u = 2 * (t - t1) / (t2 - t1) - 1; y = D + 1 + (top - D - 1) * u * u; }
      else if (t < t1 && t > ap) y = D + 1 + (top - D - 1) * (t - ap) / (t1 - ap);
      else if (t > t2 && t < 1 - ap) y = D + 1 + (top - D - 1) * (1 - ap - t) / (1 - ap - t2);
      else return;
      y = Math.round(y);
      for (const sgn of [-1, 1]) {
        const [x, z] = across(cx, cz, px2, pz2, sgn * (w / 2 + 0.2));
        world.set(x, y, z, cm);
        if (s % 6 === 0) for (let yy = D + 1; yy < y; yy++) world.set(x, yy, z, cm);
      }
    });
  }
  function truss(A, Bp, piers, D, w, m) {
    deck(A, Bp, w, D, 'asphalt');
    const L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), px = -(Bp[1] - A[1]) / L, pz = (Bp[0] - A[0]) / L;
    walk(A, Bp, (t, cx, cz, px2, pz2, s) => {
      if (t < piers[0] - 0.08 || t > piers[piers.length - 1] + 0.08) return;
      let bump = 0; for (const p of piers) bump = Math.max(bump, Math.exp(-(((t - p) / 0.05) ** 2)));
      const topY = D + 1 + Math.round(4 * bump);
      for (const sgn of [-1, 1]) {
        const [x, z] = across(cx, cz, px2, pz2, sgn * (w / 2 + 0.2));
        for (let y = D + 1; y <= topY; y++) if ((s + y) % 2 === 0 || y === topY) world.set(x, y, z, m);
      }
    });
    for (const p of piers) {
      const cx = A[0] + (Bp[0] - A[0]) * p, cz = A[1] + (Bp[1] - A[1]) * p;
      for (const sgn of [-1, 1]) { const [x, z] = across(cx, cz, px, pz, sgn * (w / 2 + 0.2)); leg(x, z, WATER_Y, D - 1, 'stone'); leg(x, z, D + 5, D + 6, m); }
    }
  }
  function arch(A, Bp, t1, t2, D, top, w, m, towerM) {
    deck(A, Bp, w, D, 'steel');
    const L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), px = -(Bp[1] - A[1]) / L, pz = (Bp[0] - A[0]) / L;
    walk(A, Bp, (t, cx, cz, px2, pz2, s) => {
      if (t < t1 || t > t2) return;
      const u = 2 * (t - t1) / (t2 - t1) - 1, y = Math.round(D - 2 + (top - D + 2) * (1 - u * u));
      for (const sgn of [-1, 1]) {
        const [x, z] = across(cx, cz, px2, pz2, sgn * (w / 2 + 0.2));
        world.set(x, y, z, m); world.set(x, y - 1, z, m);
        if (s % 4 === 0 && y > D + 1) for (let yy = D + 1; yy < y; yy++) world.set(x, yy, z, m);
      }
    });
    if (towerM) for (const t of [t1, t2]) {
      const cx = A[0] + (Bp[0] - A[0]) * t, cz = A[1] + (Bp[1] - A[1]) * t;
      boxC(cx, cz, w + 3, w + 3, WATER_Y, D + 2, towerM);
    }
  }
  function viaduct(pts, D, w, m, pierM) {
    for (let i = 0; i + 1 < pts.length; i++) {
      walk(pts[i], pts[i + 1], (t, cx, cz, px, pz, s) => {
        for (let k = -w / 2 + 0.25; k < w / 2; k += 0.5) { const [x, z] = across(cx, cz, px, pz, k); world.set(x, D, z, m); }
        if (s % 8 === 0 && pierM) { const x = Math.floor(cx), z = Math.floor(cz), g = gAt(x, z); if (g < D - 1) leg(x, z, g + 1, D - 1, pierM); }
      });
    }
  }
  suspension(M(1096, -18.5), M(2817, -26.9), 0.40, 0.715, 4, 8, 3, 'granite', 'light_gray', 'planks', true);   // Brooklyn Bridge
  suspension(M(1433, -9.9), M(3447, -28), 0.33, 0.57, 4, 10, 3, 'steel', 'light_gray', 'asphalt');           // Manhattan Bridge
  suspension(M(2500, -2.5), M(4200, 1.5), 0.32, 0.66, 4, 10, 3, 'steel', 'gray', 'asphalt');                 // Williamsburg Bridge
  truss(M(1456, 59.6), M(3500, 60.5), [0.266, 0.408, 0.516, 0.687], 5, 3, 'gray');                          // Queensboro Bridge
  suspension(M(2900, 104.5), M(3600, 100.5), 0.26, 0.72, 5, 9, 3, 'steel', 'light_gray', 'asphalt');         // RFK (Triborough)
  viaduct([M(1700, 125.2), M(2150, 124.5), M(2750, 117), M(2900, 104.5)], 4, 3, 'asphalt', 'concrete');
  viaduct([M(2500, 124.8), M(2600, 136)], 4, 2, 'asphalt', 'concrete');
  for (const e of [1860, 1940]) for (const n of [124, 125.8]) { const [x, z] = M(e, n); leg(Math.floor(x), Math.floor(z), WATER_Y, 8, 'steel'); }
  arch(M(2950, 111.5), M(3480, 107.5), 0.1, 0.9, 5, 9, 2, 'red', 'granite');                               // Hell Gate Bridge
  viaduct([M(2600, 133.5), M(2950, 111.5)], 5, 2, 'steel', 'granite');
  viaduct([M(3480, 107.5), M(3950, 104)], 5, 2, 'steel', 'granite');
  suspension(M(-1700, 179), M(-3650, 175), 0.18, 0.744, 6, 16, 3, 'gray', 'light_gray', 'asphalt');         // George Washington Bridge
  suspension(P(40.7900, -73.8240), P(40.8090, -73.8325), 0.28, 0.72, 5, 11, 3, 'steel', 'light_gray', 'asphalt'); // Bronx-Whitestone
  suspension(P(40.7900, -73.7955), P(40.8130, -73.7930), 0.30, 0.70, 5, 10, 3, 'steel', 'light_gray', 'asphalt'); // Throgs Neck
  viaduct([M(-760, 174.3), M(-240, 174.3)], 7, 1, 'stone', 'stone');                                         // High Bridge
  arch(M(-820, 181.3), M(-320, 181.3), 0.3, 0.7, 7, 8, 2, 'steel');                                         // Washington Bridge
  arch(M(-1800, 219.2), M(-1800, 226), 0.25, 0.75, 6, 7, 2, 'steel');                                       // Henry Hudson Bridge
  for (const [a, b] of [[[-60, 157.5], [400, 159]], [[311, 145], [650, 148.5]], [[780, 138], [1000, 141]], [[1240, 129], [1450, 134]],
    [[1685, 126], [1850, 131]], [[-700, 219.5], [-780, 224.5]], [[-560, 207.5], [-250, 209]]])
    deck(M(a[0], a[1]), M(b[0], b[1]), 2, 3, 'asphalt', 0.2);                                               // Harlem River bridges

  // =====================================================================
  // 9. HARBOR LIFE AND DETAILS
  // =====================================================================
  function boat(p, len, wid, hull, top, ax) {
    const x0 = Math.round(p[0] - (ax ? len : wid) / 2), z0 = Math.round(p[1] - (ax ? wid : len) / 2);
    const x1 = x0 + (ax ? len : wid) - 1, z1 = z0 + (ax ? wid : len) - 1;
    F(x0, WATER_Y + 1, z0, x1, WATER_Y + 1, z1, hull);
    if (top) { const ix = ax ? 2 : 0, iz = ax ? 0 : 2; F(x0 + ix, WATER_Y + 2, z0 + iz, x1 - ix, WATER_Y + 2, z1 - iz, top); }
  }
  boat(P(40.6960, -74.0190), 8, 2, 'orange', 'white', false);                // Staten Island Ferries
  boat(P(40.6820, -74.0300), 8, 2, 'orange', 'white', false);
  boat(M(-1720, 47.0), 22, 3, 'dark_gray', 'gray', true);                    // USS Intrepid
  boat(M(-1760, 49.4), 26, 3, 'white', 'white', true);                       // cruise ship, Pier 88
  boat(M(-1760, 51.4), 24, 3, 'white', 'blue', true);
  boat(P(40.6800, -74.0200), 20, 3, 'red', 'blue', true);                    // container ship off Red Hook
  boat(P(40.6840, -74.0190), 18, 3, 'dark_gray', 'orange', true);
  boat(P(40.7250, -73.9700), 5, 2, 'black', 'red', true);                    // East River tug + barge
  boat(P(40.7270, -73.9690), 8, 3, 'brown', null, true);
  boat(P(40.7630, -74.0050), 4, 1, 'white', 'blue', true);                   // Circle Line
  boat(P(40.7000, -74.0060), 4, 2, 'white', 'yellow', true);                 // NYC Ferry
  for (let k = 0; k < 14; k++) { const [x, z] = M(-2100 - 300 * hash(k, 1, 61), 40 + 150 * hash(k, 2, 61)); if (zone[Math.round(z) * W + Math.round(x)] === 0) { world.set(Math.round(x), WATER_Y + 1, Math.round(z), 'white'); world.set(Math.round(x), WATER_Y + 2, Math.round(z), 'white'); } }
  // High Line (elevated park on the old freight viaduct)
  viaduct([M(-790, 12.5), M(-860, 14), M(-900, 17), M(-950, 30), M(-1150, 30.6), M(-1300, 31), M(-1340, 34)], LAND_Y + 2, 1, 'grass', 'steel');
}

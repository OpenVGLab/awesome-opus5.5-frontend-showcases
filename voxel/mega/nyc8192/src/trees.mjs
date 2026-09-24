// Tree placement: parks, back yards, street trees, the Mall's elm rows.
import { W, SEA, mg } from './frame.mjs';
import { M } from './palette.mjs';
import { hash2, resample } from './raster.mjs';
import { Z, DISTRICTS } from './geo.mjs';
import { U } from './city.mjs';

export const TS = 8; // floats per tree: x, z, trunkH, crownR, crownH, leafMat, groundY, seed
const LEAF = [M.leaves, M.leaves, M.leaves_dark, M.leaves_light, M.leaves, M.leaves_dark, M.leaves_light, M.leaves_yellow, M.hedge, M.leaves];

export function placeTrees(m, log = () => {}) {
  const { use, zone, elev, bid } = m;
  const out = [];
  const add = (x, z, th, cr, ch, leaf) => {
    const xi = Math.floor(x), zi = Math.floor(z);
    if (xi < 2 || zi < 2 || xi >= W - 2 || zi >= W - 2) return;
    const i = zi * W + xi;
    if (bid[i] > 0 || zone[i] === Z.WATER) return;
    out.push(xi + 0.5, zi + 0.5, th, cr, ch, leaf, SEA + elev[i], out.length / TS);
  };
  // parks and yards: jittered grid
  const DENS = new Float32Array(32);
  DENS[U.WOODS] = 0.9; DENS[U.PARK] = 0.42; DENS[U.LAWN] = 0.02; DENS[U.ROCK] = 0.25; DENS[U.YARD] = 0.22; DENS[U.PLAZA] = 0.035;
  const cell = 7;
  for (let gz = 0; gz < W; gz += cell) for (let gx = 0; gx < W; gx += cell) {
    const r1 = hash2(gx, gz, 101), r2 = hash2(gx, gz, 102), r3 = hash2(gx, gz, 103);
    const x = gx + 1 + r1 * (cell - 2), z = gz + 1 + r2 * (cell - 2);
    const i = Math.floor(z) * W + Math.floor(x);
    const u = use[i];
    const d = DENS[u];
    if (!d || r3 > d) continue;
    // keep clear of paths, drives and buildings
    let ok = true;
    for (let dz = -2; dz <= 2 && ok; dz += 2) for (let dx = -2; dx <= 2 && ok; dx += 2) {
      const j = i + dz * W + dx; const uj = use[j];
      if (uj === U.ROAD || uj === U.DRIVE || uj === U.POND || uj === U.BUILDING || uj === U.HWY || uj === U.RINK || uj === U.FIELD) ok = false;
    }
    if (!ok) continue;
    const big = u === U.WOODS || u === U.PARK;
    const r4 = hash2(gx, gz, 104);
    const cr = big ? 3 + r4 * 3.5 : 2 + r4 * 2;
    add(x, z, big ? 3 + Math.round(r4 * 3) : 2 + Math.round(r4 * 2), cr, Math.round(cr * (1.5 + hash2(gx, gz, 105) * 0.6)), LEAF[Math.floor(hash2(gx, gz, 106) * LEAF.length)]);
  }
  const nPark = out.length / TS;
  // street trees
  const leafyKinds = new Set(['village', 'brownstone', 'hoboken', 'walkup', 'jcrow', 'jcheights', 'tenement', 'gov', 'soho', 'bpc']);
  for (const st of m.streets) {
    if (st.kind === 'hwy') continue;
    let p = 0.35;
    if (st.kind === 'dist') {
      const di = st.name.split('_')[0];
      const d = DISTRICTS.find((q) => q.id === di);
      p = d && leafyKinds.has(d.kind) ? 0.75 : 0.3;
    } else if (st.kind === 'street') p = 0.4;
    else if (st.kind === 'ave') p = 0.25;
    const pts = resample(st.pts, 8, 4);
    for (const q of pts) {
      for (const side of [-1, 1]) {
        const off = st.rw + 1.3;
        const x = q.x - q.tz * off * side, z = q.z + q.tx * off * side;
        const xi = Math.floor(x), zi = Math.floor(z);
        if (xi < 0 || zi < 0 || xi >= W || zi >= W) continue;
        const i = zi * W + xi;
        if (use[i] !== U.WALK) continue;
        if (hash2(xi, zi, 111) > p) continue;
        // not at corners: all neighbours within 4 m must be walk or road
        let near = false;
        for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) { const uj = use[i + dz * W + dx]; if (uj !== U.WALK && uj !== U.ROAD && uj !== U.BUILDING && uj !== U.YARD) near = true; }
        if (near) continue;
        m.surf[i] = M.tree_pit;
        const r = hash2(xi, zi, 112);
        add(x, z, 3 + Math.round(r * 2), 2 + r * 1.8, 4 + Math.round(r * 3), LEAF[Math.floor(hash2(xi, zi, 113) * 7)]);
      }
    }
  }
  const nStreet = out.length / TS - nPark;
  // the Mall: four rows of American elms, 66th to 72nd St
  for (const de of [-19, -11, 11, 19]) {
    for (let n = 66.35; n < 71.8; n += 0.1) {
      const [x, z] = mg(-396 + de, n);
      add(x, z, 6, 5.5, 8, M.leaves_dark);
    }
  }
  log(`trees: ${out.length / TS} (parks/yards ${nPark}, street ${nStreet})`);
  return new Float32Array(out);
}

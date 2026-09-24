// City blocks -> lots -> generic buildings. Produces the building table (Float32 records) and the bid raster.
import { W, SEA, xz2es, nOf, mg, ll, GRID_N, GRID_E, bearingXZ } from './frame.mjs';
import { M } from './palette.mjs';
import { label4, hash2, hashi, mulberry, clamp, smooth, lerp } from './raster.mjs';
import { Z, DISTRICTS } from './geo.mjs';
import { U } from './city.mjs';
import { STYLE, STYLES } from './styles.mjs';
import { broadwayE } from './cp.mjs';

export const BS = 32; // floats per building record
// record fields
export const B = {
  OX: 0, OZ: 1, UX: 2, UZ: 3, U0: 4, U1: 5, W0: 6, W1: 7, GB: 8, STYLE: 9, H: 10, NT: 11,
  I1: 12, H1: 13, I2: 14, H2: 15, I3: 16, H3: 17, ROOF: 18, WTU: 19, WTW: 20, WTR: 21,
  BU0: 22, BU1: 23, BW0: 24, BW1: 25, BH: 26, SEED: 27, FRONT: 28, KIND: 29, SPIRE: 30, FLAGS: 31,
};
export const ROOF_WT = 1, ROOF_BULK = 2, ROOF_HVAC = 4, ROOF_GREEN = 8, ROOF_ANT = 16, ROOF_CROWN = 32;

const KIND = { main: 0, village: 1, soho: 2, tribeca: 3, civic: 4, tenement: 5, projects: 6, fidi: 7, bpc: 8, brownstone: 9,
  loft: 10, dtbk: 11, industrial: 12, walkup: 13, lic: 14, hoboken: 15, jcwater: 16, jcrow: 17, jcheights: 18, gov: 19, generic: 20 };
export { KIND };

const pickW = (r, list) => { let t = 0; for (const [, w] of list) t += w; let a = r * t; for (const [v, w] of list) { a -= w; if (a <= 0) return v; } return list[list.length - 1][0]; };
const st = (n) => STYLE[n];

// fabric parameters per district kind
const FABRIC = {
  village: { lot: [7, 14], depth: 0.7, h: [14, 22], tallP: 0.08, tall: [30, 55], styles: [['tenement_red', 3], ['brownstone', 2], ['brick_row', 3], ['tenement_brown', 2], ['prewar_buff', 1]], ends: false },
  soho: { lot: [8, 24], depth: 0.95, h: [20, 30], tallP: 0.06, tall: [35, 60], styles: [['cast_iron', 5], ['cast_iron_gray', 3], ['loft_brick', 2], ['warehouse', 1]], ends: false },
  tribeca: { lot: [10, 30], depth: 0.95, h: [22, 42], tallP: 0.12, tall: [50, 110], styles: [['warehouse', 3], ['loft_brick', 3], ['cast_iron', 2], ['glass_residential', 1]], ends: false },
  civic: { lot: [25, 60], depth: 1, h: [30, 70], tallP: 0.25, tall: [80, 150], styles: [['civic_granite', 4], ['prewar_limestone', 3], ['concrete_ribbon', 2], ['white_brick', 1]], ends: false },
  tenement: { lot: [7, 12], depth: 0.75, h: [16, 22], tallP: 0.06, tall: [40, 80], styles: [['tenement_red', 4], ['tenement_brown', 3], ['tenement_buff', 3]], ends: false },
  projects: { projects: true, h: [40, 60], styles: [['projects', 1]] },
  fidi: { lot: [18, 50], depth: 1, h: [45, 120], tallP: 0.3, tall: [120, 230], styles: [['prewar_limestone', 4], ['granite_office', 2], ['curtain_dark', 2], ['curtain_silver', 2], ['curtain_blue', 1], ['terracotta', 1], ['prewar_buff', 1]], ends: true },
  bpc: { towers: true, h: [70, 140], styles: [['hotel_tan', 3], ['prewar_red', 2], ['glass_residential', 2], ['white_brick', 1]] },
  brownstone: { lot: [6, 8], depth: 0.62, h: [12, 16], tallP: 0.04, tall: [30, 60], styles: [['brownstone', 5], ['brick_row', 4], ['row_cream', 1]], ends: false },
  loft: { lot: [18, 45], depth: 1, h: [22, 45], tallP: 0.1, tall: [60, 110], styles: [['warehouse', 4], ['loft_brick', 4], ['concrete_ribbon', 1], ['glass_residential', 1]], ends: false },
  dtbk: { lot: [25, 60], depth: 1, h: [30, 70], tallP: 0.25, tall: [90, 180], styles: [['civic_granite', 2], ['curtain_blue', 2], ['glass_residential', 2], ['prewar_buff', 2], ['white_frame', 1]], ends: true },
  industrial: { lot: [30, 90], depth: 1, h: [8, 18], tallP: 0.15, tall: [25, 40], styles: [['shed', 3], ['industrial', 3], ['warehouse', 2]], ends: false },
  walkup: { lot: [6, 9], depth: 0.65, h: [10, 14], tallP: 0.05, tall: [20, 40], styles: [['row_cream', 1], ['brick_row', 3], ['tenement_red', 2], ['row_blue', 1], ['stucco', 1], ['row_red', 1]], ends: false },
  lic: { towers: true, h: [60, 170], styles: [['glass_residential', 3], ['curtain_blue', 2], ['white_frame', 2], ['curtain_silver', 1]] },
  hoboken: { lot: [6, 8], depth: 0.65, h: [13, 17], tallP: 0.04, tall: [25, 45], styles: [['brownstone', 3], ['brick_row', 4], ['row_cream', 1], ['row_red', 1]], ends: false },
  jcwater: { towers: true, h: [90, 220], styles: [['curtain_blue', 3], ['curtain_silver', 2], ['glass_residential', 3], ['curtain_green', 1], ['white_frame', 1]] },
  jcrow: { lot: [6, 9], depth: 0.6, h: [10, 13], tallP: 0.03, tall: [18, 30], styles: [['brick_row', 3], ['row_cream', 2], ['row_blue', 1], ['stucco', 1], ['row_green', 1], ['brownstone', 1]], ends: false },
  jcheights: { lot: [7, 10], depth: 0.5, h: [8, 11], tallP: 0.03, tall: [16, 25], styles: [['stucco', 2], ['row_cream', 2], ['brick_row', 2], ['row_blue', 1], ['row_green', 1]], ends: false },
  gov: { lot: [20, 40], depth: 0.5, h: [9, 13], tallP: 0, tall: [12, 14], styles: [['brick_row', 3], ['prewar_red', 1]], ends: false, sparse: 0.5 },
  generic: { lot: [8, 16], depth: 0.7, h: [12, 20], tallP: 0.05, tall: [25, 45], styles: [['brick_row', 2], ['tenement_red', 2], ['stucco', 1]], ends: false },
};

// Manhattan main grid: typical height (m) and tower odds
const PEAKS = [
  // [e, n, re (m), rn (streets), height, towerP]
  [-100, 49, 650, 7, 125, 0.32], [350, 49, 500, 7, 135, 0.35], [-520, 44, 350, 4, 105, 0.3], [-1300, 33, 450, 3.5, 130, 0.3],
  [700, 50, 450, 7, 95, 0.25], [0, 28, 500, 5, 60, 0.15], [-250, 38, 500, 5, 75, 0.2], [300, 38, 450, 4, 75, 0.2],
  [-700, 55, 350, 4, 80, 0.22], [-400, 57, 700, 2, 95, 0.25], [600, 57, 500, 3, 85, 0.22], [-1450, 56, 400, 4, 60, 0.2],
];
function mainHeight(e, n) {
  let h = 20, tp = 0.02;
  if (n < 14) { h = 18; tp = 0.03; }                       // East Village / Greenwich Village north
  else if (n < 30) { h = 32; tp = 0.06; }                 // Chelsea, Flatiron, Gramercy
  else if (n < 40) { h = 45; tp = 0.1; }
  else if (n < 59.5) { h = 60; tp = 0.15; }
  else { h = 40; tp = 0.08; }                              // Upper West / East Side corner
  if (e < -950 && n > 40 && n < 58) { h = 22; tp = 0.05; } // Hell's Kitchen
  if (e > 1100 && n > 14 && n < 40) { h = 45; tp = 0.1; }  // Kips Bay
  for (const [pe, pn, re, rn, ph, pt] of PEAKS) {
    const q = ((e - pe) / re) ** 2 + ((n - pn) / rn) ** 2;
    if (q < 4) { const k = Math.exp(-q); h = Math.max(h, lerp(h, ph, k)); tp = Math.max(tp, pt * k); }
  }
  return [h, tp];
}
const MAIN_STYLES_LOW = [['tenement_red', 3], ['tenement_brown', 2], ['tenement_buff', 2], ['brownstone', 1], ['brick_row', 1]];
const MAIN_STYLES_MID = [['prewar_buff', 3], ['prewar_red', 2], ['prewar_limestone', 2], ['loft_brick', 2], ['white_brick', 2], ['cast_iron', 1], ['hotel_tan', 1], ['terracotta', 1]];
const MAIN_STYLES_HIGH = [['prewar_limestone', 3], ['curtain_blue', 3], ['curtain_dark', 2], ['curtain_silver', 2], ['granite_office', 2], ['curtain_green', 1], ['fins', 1], ['bronze', 1], ['white_frame', 1], ['glass_residential', 1]];
const MAIN_STYLES_PREWAR_TALL = [['prewar_limestone', 4], ['prewar_buff', 3], ['terracotta', 2], ['granite_office', 2], ['prewar_red', 1], ['hotel_tan', 1], ['white_brick', 2], ['loft_brick', 1]];

// ---------------------------------------------------------------------------------------------------
export function buildFabric(m, log = () => {}) {
  const { zone, use, surf, bid, elev, dmap } = m;
  const N = W * W;
  bid.fill(0);
  // reserved footprints already have use = RESERVED
  const buildable = (i) => use[i] === U.NONE && zone[i] >= Z.MN && zone[i] <= Z.RI;
  const { label, count, areas, bbox } = label4(buildable);
  log(`blocks: ${count}`);
  const recs = [];
  const push = (r) => { recs.push(r); return recs.length; };   // id = index + 1
  const tmpU = [], tmpW = [];
  for (let b = 1; b <= count; b++) {
    const area = areas[b - 1];
    const [bx0, bz0, bx1, bz1] = bbox[b - 1];
    if (area < 40) { markBlock(label, b, bbox[b - 1], (i) => { use[i] = U.PLAZA; }); continue; }
    // district & kind
    const cx = (bx0 + bx1) >> 1, cz = (bz0 + bz1) >> 1;
    let di = dmap[cz * W + cx], zn = zone[cz * W + cx];
    if (!zone[cz * W + cx]) { // centre outside block (concave): take first pixel
      outer: for (let z = bz0; z <= bz1; z++) for (let x = bx0; x <= bx1; x++) if (label[z * W + x] === b) { di = dmap[z * W + x]; zn = zone[z * W + x]; break outer; }
    }
    const dist = di > 0 ? DISTRICTS[di - 1] : null;
    let kindName = dist ? dist.kind : (zn === Z.MN ? 'main' : 'generic');
    if (zn === Z.RI) kindName = 'generic';
    // axes
    let ax, az;
    if (kindName === 'main') { ax = GRID_E[0]; az = GRID_E[1]; }
    else if (dist) { [ax, az] = bearingXZ(dist.bearing); }
    else { ax = GRID_E[0]; az = GRID_E[1]; }
    const ox = cx, oz = cz;
    // local extents along (ax,az) and its normal
    let a0 = 1e9, a1 = -1e9, c0 = 1e9, c1 = -1e9;
    const nx = -az, nz = ax;
    for (let z = bz0; z <= bz1; z++) for (let x = bx0; x <= bx1; x++) {
      if (label[z * W + x] !== b) continue;
      const px = x + 0.5 - ox, pz = z + 0.5 - oz;
      const a = px * ax + pz * az, c = px * nx + pz * nz;
      if (a < a0) a0 = a; if (a > a1) a1 = a; if (c < c0) c0 = c; if (c > c1) c1 = c;
    }
    a0 -= 0.5; a1 += 0.5; c0 -= 0.5; c1 += 0.5;
    // long axis = u
    let ux = ax, uz = az, u0 = a0, u1 = a1, w0 = c0, w1 = c1;
    if (kindName !== 'main' && (c1 - c0) > (a1 - a0)) { ux = nx; uz = nz; u0 = c0; u1 = c1; w0 = -a1; w1 = -a0; }
    const rnd = mulberry(hashi(b, bx0, bz0));
    const parcels = makeParcels(kindName, { ox, oz, ux, uz, u0, u1, w0, w1 }, rnd, m);
    // rasterise parcels -> buildings
    const wx = -uz, wz = ux;
    const ids = parcels.map((p) => (p.build ? push(p) : 0));
    for (let z = bz0; z <= bz1; z++) for (let x = bx0; x <= bx1; x++) {
      const i = z * W + x; if (label[i] !== b) continue;
      const px = x + 0.5 - ox, pz = z + 0.5 - oz;
      const u = px * ux + pz * uz, w = px * wx + pz * wz;
      let hit = -1;
      for (let k = 0; k < parcels.length; k++) { const p = parcels[k]; if (u >= p.pu0 && u < p.pu1 && w >= p.pw0 && w < p.pw1) { hit = k; break; } }
      if (hit < 0) { use[i] = U.YARD; continue; }
      const p = parcels[hit];
      if (p.build && u >= p.u0 && u < p.u1 && w >= p.w0 && w < p.w1) { bid[i] = ids[hit]; use[i] = U.BUILDING; }
      else use[i] = p.open || U.YARD;
    }
  }
  log(`buildings: ${recs.length}`);
  // base heights: mean ground under each footprint
  const sum = new Float64Array(recs.length + 1), cnt = new Uint32Array(recs.length + 1), mx = new Uint8Array(recs.length + 1);
  for (let i = 0; i < N; i++) { const k = bid[i]; if (k > 0) { sum[k] += elev[i]; cnt[k]++; if (elev[i] > mx[k]) mx[k] = elev[i]; } }
  const table = new Float32Array(new SharedArrayBuffer((recs.length + 1) * BS * 4));
  let tall = 0, vol = 0;
  for (let k = 1; k <= recs.length; k++) {
    const p = recs[k - 1], o = k * BS;
    if (!cnt[k]) continue;
    const gb = SEA + Math.round(sum[k] / cnt[k]);
    table[o + B.OX] = p.ox; table[o + B.OZ] = p.oz; table[o + B.UX] = p.ux; table[o + B.UZ] = p.uz;
    table[o + B.U0] = p.u0; table[o + B.U1] = p.u1; table[o + B.W0] = p.w0; table[o + B.W1] = p.w1;
    table[o + B.GB] = gb; table[o + B.STYLE] = p.style; table[o + B.H] = p.h; table[o + B.NT] = p.tiers.length;
    for (let t = 0; t < 3; t++) { table[o + B.I1 + 2 * t] = p.tiers[t] ? p.tiers[t][0] : 0; table[o + B.H1 + 2 * t] = p.tiers[t] ? p.tiers[t][1] : 0; }
    table[o + B.ROOF] = p.roof; table[o + B.WTU] = p.wt ? p.wt[0] : 0; table[o + B.WTW] = p.wt ? p.wt[1] : 0; table[o + B.WTR] = p.wt ? p.wt[2] : 0;
    if (p.bulk) { table[o + B.BU0] = p.bulk[0]; table[o + B.BU1] = p.bulk[1]; table[o + B.BW0] = p.bulk[2]; table[o + B.BW1] = p.bulk[3]; table[o + B.BH] = p.bulk[4]; }
    table[o + B.SEED] = p.seed; table[o + B.FRONT] = p.front; table[o + B.KIND] = KIND[p.kind] ?? 20; table[o + B.SPIRE] = p.spire || 0;
    // Times Square: LED screens on the lower facades around the bowtie
    let flags = p.flags || 0;
    { const cx = p.ox + p.ux * (p.u0 + p.u1) / 2 - p.uz * (p.w0 + p.w1) / 2, cz = p.oz + p.uz * (p.u0 + p.u1) / 2 + p.ux * (p.w0 + p.w1) / 2;
      const [e, s] = xz2es(cx, cz), n = nOf(s);
      if (n > 41.7 && n < 47.8 && (Math.abs(e - broadwayE(n)) < 120 || Math.abs(e + 610) < 95)) flags |= 2; }
    table[o + B.FLAGS] = flags;
    const top = p.tiers.length ? Math.max(p.h, ...p.tiers.map((t) => t[1])) : p.h;
    if (top > 100) tall++;
    vol += cnt[k] * p.h;
  }
  log(`building table: ${recs.length} records, ${tall} over 100 m`);
  return { table, count: recs.length, blocks: count };
}

function markBlock(label, b, bb, fn) {
  const [x0, z0, x1, z1] = bb;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const i = z * W + x; if (label[i] === b) fn(i); }
}

// ---------------------------------------------------------------------------------------------------
function makeParcels(kindName, f, rnd, m) {
  const { ox, oz, ux, uz, u0, u1, w0, w1 } = f;
  const wx = -uz, wz = ux;
  const out = [];
  const L = u1 - u0, D = w1 - w0;
  const center = (u, w) => [ox + ux * u + wx * w, oz + uz * u + wz * w];
  const seedBase = Math.floor(rnd() * 1e9);
  const fab = kindName === 'main' ? null : FABRIC[kindName] || FABRIC.generic;
  const P = (pu0, pu1, pw0, pw1, o) => ({ pu0, pu1, pw0, pw1, u0: pu0, u1: pu1, w0: pw0, w1: pw1, ox, oz, ux, uz, build: true, kind: kindName, tiers: [], roof: 0, seed: Math.floor(rnd() * 1e6), front: 0, ...o });

  if (fab && fab.projects) {
    // towers in the park: one or two slabs on a lawn
    const n = L > 150 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const cu = u0 + L * (k + 0.5) / n + (rnd() - 0.5) * 20, cw = (w0 + w1) / 2 + (rnd() - 0.5) * Math.max(0, D - 40);
      const hl = Math.min(35, L / n / 2 - 8), hw = Math.min(9, D / 2 - 6);
      if (hl < 8 || hw < 5) continue;
      const p = P(cu - hl, cu + hl, cw - hw, cw + hw, {});
      p.h = 3 * Math.round((fab.h[0] + rnd() * (fab.h[1] - fab.h[0])) / 3); p.style = st('projects'); p.roof = ROOF_BULK; p.bulk = [-4, 4, -3, 3, 4];
      addBulk(p, rnd); out.push(p);
    }
    out.push({ pu0: u0 - 1, pu1: u1 + 1, pw0: w0 - 1, pw1: w1 + 1, build: false, open: U.PARK });
    return out;
  }
  if (fab && fab.towers) {
    // plaza-and-tower superblocks
    const n = Math.max(1, Math.round(L / 70));
    for (let k = 0; k < n; k++) {
      const pu0 = u0 + L * k / n, pu1 = u0 + L * (k + 1) / n;
      const inset = 4 + rnd() * 8;
      const p = P(pu0 + inset, pu1 - inset, w0 + inset, w1 - inset, { pu0, pu1, pw0: w0, pw1: w1, open: U.PLAZA });
      if (p.u1 - p.u0 < 12 || p.w1 - p.w0 < 12) continue;
      p.pu0 = pu0; p.pu1 = pu1; p.pw0 = w0; p.pw1 = w1;
      const hh = fab.h[0] + rnd() * (fab.h[1] - fab.h[0]);
      p.style = st(pickW(rnd(), fab.styles));
      towerize(p, hh, rnd, true);
      out.push(p);
    }
    out.push({ pu0: u0 - 1, pu1: u1 + 1, pw0: w0 - 1, pw1: w1 + 1, build: false, open: U.PLAZA });
    return out;
  }
  // regular rows of lots
  const rows = D > 26 ? 2 : 1;
  const wm = (w0 + w1) / 2;
  let ends = kindName === 'main' ? L > 2.2 * D : (fab.ends && L > 2.5 * D);
  let ua = u0, ub = u1;
  const lotRange = kindName === 'main' ? null : fab.lot;
  const baseH = (u, w) => {
    if (kindName === 'main') {
      const [x, z] = center(u, w); const [e, s] = xz2es(x, z); return mainHeight(e, nOf(s));
    }
    return [fab.h[0] + rnd() * (fab.h[1] - fab.h[0]), fab.tallP];
  };
  if (ends) {
    const ew = kindName === 'main' ? 28 + rnd() * 14 : 20 + rnd() * 15;
    for (const side of [0, 1]) {
      const pu0 = side ? u1 - ew : u0, pu1 = side ? u1 : u0 + ew;
      const split = D > 45 && rnd() < 0.6;
      const parts = split ? [[w0, wm], [wm, w1]] : [[w0, w1]];
      for (const [pw0, pw1] of parts) {
        const p = P(pu0, pu1, pw0, pw1, { front: side ? 8 : 4 });
        const [h, tp] = baseH((pu0 + pu1) / 2, (pw0 + pw1) / 2);
        lotBuilding(p, kindName, fab, h * (kindName === 'main' ? 1.35 : 1.1), tp * 1.3, rnd, true);
        out.push(p);
      }
    }
    ua = u0 + (out[0].pu1 - out[0].pu0); ub = u1 - (out[out.length - 1].pu1 - out[out.length - 1].pu0);
  }
  // middle: lots along the rows
  const [hMid, tpMid] = baseH((ua + ub) / 2, wm);
  const bigLots = kindName === 'main' ? hMid > 60 : (fab.lot[1] > 20);
  for (let r = 0; r < rows; r++) {
    const pw0 = rows === 1 ? w0 : r === 0 ? w0 : wm, pw1 = rows === 1 ? w1 : r === 0 ? wm : w1;
    let u = ua;
    while (u < ub - 3) {
      let wlot;
      if (kindName === 'main') {
        const [h] = baseH(u, (pw0 + pw1) / 2);
        wlot = h > 90 ? 25 + rnd() * 40 : h > 45 ? 12 + rnd() * 25 : 7.6 * (1 + Math.floor(rnd() * 2.2));
      } else wlot = lotRange[0] + rnd() * (lotRange[1] - lotRange[0]);
      let pu1 = Math.min(ub, u + wlot);
      if (ub - pu1 < 5) pu1 = ub;
      const p = P(u, pu1, pw0, pw1, { front: rows === 1 ? 3 : r === 0 ? 1 : 2 });
      const [h, tp] = baseH((u + pu1) / 2, (pw0 + pw1) / 2);
      lotBuilding(p, kindName, fab, h, tp, rnd, false);
      // rear yard for low-rise lots
      const depthFrac = kindName === 'main' ? (p.h < 30 ? 0.72 : p.h < 60 ? 0.88 : 1) : fab.depth;
      if (rows === 2 && depthFrac < 1) {
        const dep = Math.max(8, (pw1 - pw0) * depthFrac);
        if (r === 0) p.w1 = pw0 + dep; else p.w0 = pw1 - dep;
      }
      if (fab && fab.sparse && rnd() < fab.sparse) { p.build = false; p.open = U.PARK; }
      out.push(p);
      u = pu1;
    }
  }
  // assemble through-block towers: merge facing lots when both are tall
  if (bigLots && rows === 2) {
    for (const p of out) {
      if (!p.build || p.merged || p.h < 110 || p.front > 2) continue;
      const q = out.find((o) => o !== p && o.build && !o.merged && o.front <= 2 && o.front !== p.front && Math.abs(o.pu0 - p.pu0) < 12 && Math.abs(o.pu1 - p.pu1) < 12);
      if (!q) continue;
      q.merged = true; q.build = false; q.open = U.PLAZA;
      p.pw0 = Math.min(p.pw0, q.pw0); p.pw1 = Math.max(p.pw1, q.pw1); p.w0 = p.pw0; p.w1 = p.pw1; p.u0 = Math.max(p.pu0, q.pu0); p.u1 = Math.min(p.pu1, q.pu1);
      p.front = 3;
      towerize(p, p.h, rnd, false);
    }
    for (let k = out.length - 1; k >= 0; k--) if (out[k].merged) { out[k].pu0 = out[k].pu1 = 0; }
  }
  void seedBase;
  return out;
}

function lotBuilding(p, kindName, fab, h, tp, rnd, end) {
  const tallRoll = rnd();
  let styles;
  if (kindName === 'main') {
    const tall = end ? tp * 1.4 : tp * 0.45;          // towers cluster on avenue frontages
    if (tallRoll < tall) h = Math.max(h * (1.25 + rnd() * 0.75), 70);
    else h *= (end ? 0.7 : 0.4) + rnd() * (end ? 0.6 : 0.45);
    h = Math.min(h, 245);
    const modernP = h >= 150 ? 0.7 : h >= 70 ? 0.3 : 0;
    styles = h < 26 ? MAIN_STYLES_LOW : h < 70 ? MAIN_STYLES_MID : (rnd() < modernP ? MAIN_STYLES_HIGH : MAIN_STYLES_PREWAR_TALL);
  } else {
    if (tallRoll < tp) h = fab.tall[0] + rnd() * (fab.tall[1] - fab.tall[0]);
    else h *= 0.85 + rnd() * 0.3;
    styles = fab.styles;
    if (h > 80 && kindName !== 'fidi') styles = MAIN_STYLES_HIGH;
  }
  p.style = st(pickW(rnd(), styles));
  h = Math.min(h, 245);
  const fl = h >= 60 ? 4 : 3;
  p.h = Math.max(fl * 2, fl * Math.round(h / fl));
  if (p.h >= 55) towerize(p, p.h, rnd, false);
  else roofStuff(p, rnd);
  if (end) p.flags |= 1;
}

// setbacks, crowns, antennas for tall buildings
function towerize(p, H, rnd, plaza) {
  const bw = p.u1 - p.u0, bd = p.w1 - p.w0;
  const minSide = Math.min(bw, bd);
  H = 4 * Math.round(H / 4);
  const modern = STYLES[p.style].modern;
  p.tiers = [];
  if (!modern && minSide > 24) {
    // 1916-zoning wedding cake
    const base = 4 * Math.round((28 + rnd() * 24) / 4);
    p.h = Math.min(H, base);
    let hh = p.h, ins = 0;
    const steps = H > 150 ? 3 : H > 90 ? 2 : 1;
    for (let k = 0; k < steps && hh < H; k++) {
      ins += 3 + Math.round(rnd() * 4);
      if (minSide - 2 * ins < 12) break;
      hh = k === steps - 1 ? H : Math.min(H, hh + 4 * Math.round((H - p.h) / steps / 4));
      p.tiers.push([ins, hh]);
    }
    if (!p.tiers.length) p.h = H;
  } else if (minSide > 30 && rnd() < 0.7) {
    // podium + tower
    p.h = plaza ? 4 * Math.round((8 + rnd() * 10) / 4) : 4 * Math.round((16 + rnd() * 20) / 4);
    const ins = Math.min(minSide / 2 - 8, 4 + Math.round(rnd() * 8));
    if (ins > 2) p.tiers.push([ins, H]); else p.h = H;
  } else p.h = H;
  const top = p.tiers.length ? p.tiers[p.tiers.length - 1][1] : p.h;
  const topIns = p.tiers.length ? p.tiers[p.tiers.length - 1][0] : 0;
  p.roof = ROOF_BULK | ROOF_HVAC;
  // mechanical penthouse on the top tier
  const tu0 = p.u0 + topIns, tu1 = p.u1 - topIns, tw0 = p.w0 + topIns, tw1 = p.w1 - topIns;
  const cu = (tu0 + tu1) / 2, cw = (tw0 + tw1) / 2, hu = Math.max(3, (tu1 - tu0) * (0.2 + rnd() * 0.15)), hw = Math.max(3, (tw1 - tw0) * (0.2 + rnd() * 0.15));
  p.bulk = [cu - hu, cu + hu, cw - hw, cw + hw, 4 + Math.round(rnd() * 6)];
  if (top > 150 && rnd() < 0.35) { p.roof |= ROOF_ANT; p.spire = 12 + Math.round(rnd() * 30); }
  if (top > 120 && rnd() < 0.3) p.roof |= ROOF_CROWN;
  if (top < 90 && rnd() < 0.3 && !modern) { p.roof |= ROOF_WT; placeWT(p, tu0, tu1, tw0, tw1, rnd); }
}

function roofStuff(p, rnd) {
  const h = p.h;
  p.roof = 0;
  const bw = p.u1 - p.u0, bd = p.w1 - p.w0;
  if (h >= 18 && bw > 9 && bd > 9) {
    p.roof |= ROOF_BULK;
    const cu = p.u0 + bw * (0.3 + rnd() * 0.4), cw = p.w0 + bd * (0.3 + rnd() * 0.4);
    p.bulk = [cu - 2 - rnd() * 2, cu + 2 + rnd() * 2, cw - 2 - rnd() * 2, cw + 2, 3 + Math.round(rnd() * 1)];
  }
  // classic NYC wooden water tanks on 6-20 storey buildings
  if (h >= 18 && h <= 75 && bw > 10 && bd > 10 && rnd() < 0.55) { p.roof |= ROOF_WT; placeWT(p, p.u0, p.u1, p.w0, p.w1, rnd); }
  if (h > 12 && rnd() < 0.25) p.roof |= ROOF_HVAC;
  if (rnd() < 0.06) p.roof |= ROOF_GREEN;
}
function placeWT(p, u0, u1, w0, w1, rnd) {
  const r = 2 + Math.round(rnd());
  const m = r + 2;
  if (u1 - u0 < 2 * m + 1 || w1 - w0 < 2 * m + 1) { p.roof &= ~ROOF_WT; return; }
  p.wt = [u0 + m + rnd() * (u1 - u0 - 2 * m), w0 + m + rnd() * (w1 - w0 - 2 * m), r + 0.5];
}
function addBulk(p) { void p; }

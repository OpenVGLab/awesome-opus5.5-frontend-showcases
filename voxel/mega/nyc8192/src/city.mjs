// Global 2D maps (8192 x 8192): land / water, depth, terrain, land use, surface material, streets.
import { W, SEA, ll, mg, xz2es, nOf, sOf, AVE, GRID_N, GRID_E, bearingXZ, WIDE_STREETS } from './frame.mjs';
import { M } from './palette.mjs';
import {
  polySpans, plineSpans, band, capsule, ellipse, orect, chamfer, setSpan, setSpanIf, hash2, vnoise, fbm, clamp, smooth, lerp,
} from './raster.mjs';
import { Z, L, G, MANHATTAN, NEW_JERSEY, BROOKLYN_QUEENS, NEWTOWN_CREEK, GOVERNORS, ROOSEVELT, INLETS, PIERS, DISTRICTS, NAMED_STREETS, PARKS, HILLS, WEST_ST, FDR } from './geo.mjs';

export const U = {
  NONE: 0, ROAD: 1, WALK: 2, PARK: 3, PLAZA: 4, POND: 5, RAIL: 6, RESERVED: 7, HWY: 8, PIER: 9, FIELD: 10, WOODS: 11,
  YARD: 12, LAWN: 13, PATH: 14, DRIVE: 15, ROCK: 16, BEACH: 17, BUILDING: 18, MEDIAN: 19, LOT: 20, RINK: 21,
};
export const PARKISH = new Uint8Array(32);
for (const u of [U.PARK, U.POND, U.FIELD, U.WOODS, U.LAWN, U.PATH, U.DRIVE, U.ROCK, U.BEACH, U.RINK, U.PLAZA]) PARKISH[u] = 1;

export function createMaps() {
  const N = W * W;
  const sab = (bytes) => new SharedArrayBuffer(bytes);
  return {
    zone: new Uint8Array(sab(N)),
    elev: new Uint8Array(sab(N)),     // land: metres above SEA; water: 0
    depth: new Uint8Array(sab(N)),    // water: metres below SEA
    use: new Uint8Array(sab(N)),
    surf: new Uint8Array(sab(N)),
    dmap: new Uint8Array(sab(N)),     // district index + 1 (0 = main Manhattan grid / none)
    bid: new Int32Array(sab(N * 4)),  // building id (>0 generic, <0 reserved for structures)
    pondY: new Uint8Array(sab(N)),    // for ponds: water surface height above SEA
  };
}

const IDX = (x, z) => z * W + x;

// -------------------------------------------------------------------------------------------------
export function buildLand(m, log) {
  const { zone } = m;
  polySpans(NEW_JERSEY, setSpan(zone, Z.NJ));
  polySpans(BROOKLYN_QUEENS, setSpan(zone, Z.BK));
  // Queens: land north / east of Newtown Creek
  {
    const pts = [...NEWTOWN_CREEK, ll(40.7200, -73.9000), ll(40.7800, -73.9000), ll(40.7800, -73.9650)];
    polySpans(pts, setSpanIf(zone, Z.QN, (i) => zone[i] === Z.BK));
  }
  polySpans(MANHATTAN, setSpan(zone, Z.MN));
  polySpans(GOVERNORS, setSpan(zone, Z.GOV));
  polySpans(ROOSEVELT, setSpan(zone, Z.RI));
  for (const [pts, hw] of INLETS) plineSpans(pts, hw, setSpan(zone, Z.WATER));
  log && log('land done');
}

// piers are decks over water (zone PIER): drawn after depth so water keeps its bed underneath
export function buildPiers(m) {
  const { zone, use } = m;
  const piers = [];
  for (const [lat, lon, brg, len, wid, kind] of PIERS) {
    let [bx, bz] = ll(lat, lon);
    const [ux, uz] = bearingXZ(brg);
    // find the bulkhead: walk back until land, or forward until water
    const at = (x, z) => { const xi = Math.round(x), zi = Math.round(z); return xi >= 0 && zi >= 0 && xi < W && zi < W ? zone[zi * W + xi] : 0; };
    if (at(bx, bz) === Z.WATER) { let k = 0; while (k < 400 && at(bx - ux * k, bz - uz * k) === Z.WATER) k++; bx -= ux * k; bz -= uz * k; }
    else { let k = 0; while (k < 300 && at(bx + ux * k, bz + uz * k) !== Z.WATER) k++; bx += ux * k; bz += uz * k; }
    const cx = bx + ux * (len / 2 - 15), cz = bz + uz * (len / 2 - 15);
    const poly = orect(cx, cz, ux, uz, len / 2 + 15, wid / 2);
    const p = { kind, poly, cx, cz, ux, uz, len: len + 30, wid, id: piers.length + 1 };
    const code = { shed: 1, park: 2, ferry: 3, heli: 4, little: 5, ship: 3, marina: 7, deck: 8 }[kind] || 8;
    polySpans(poly, (z, a, b) => {
      for (let i = z * W + a; i <= z * W + b; i++) if (zone[i] === Z.WATER) { zone[i] = Z.PIER; use[i] = (code === 2 || code === 5) ? U.PARK : U.PIER; m.pondY[i] = code; m.elev[i] = code === 5 ? 12 : 2; }
    });
    piers.push(p);
  }
  return piers;
}

export function buildWaterDepth(m, log) {
  const { zone, depth } = m;
  const d = chamfer((i) => zone[i] !== Z.WATER && zone[i] !== Z.PIER, 30000);
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
    const i = z * W + x;
    if (zone[i] !== Z.WATER && zone[i] !== Z.PIER) continue;
    const dm = d[i] / 10;
    // bulkhead drop-off, then a channel profile; small noise ripples on the bed
    let dep = 3 + 9 * smooth(0, 60, dm) + 7 * smooth(80, 420, dm);
    dep += (vnoise(x, z, 90, 5) - 0.5) * 3;
    depth[i] = clamp(Math.round(dep), 2, 21);
  }
  log && log('depth done');
  return d;
}

// -------------------------------------------------------------------------------------------------
// Terrain: metres above SEA for land cells.
export function buildElevation(m, log) {
  const { zone, elev } = m;
  const dW = chamfer((i) => zone[i] === Z.WATER, 30000);
  const hills = HILLS.map(([la, lo, r, h]) => { const [x, z] = ll(la, lo); return [x, z, r, h]; });
  const [bhx, bhz] = ll(40.6975, -73.9960);
  // Palisades cliff line (Jersey City Heights / Weehawken)
  const cliff = L([40.7250, -74.0580, 40.7330, -74.0520, 40.7420, -74.0460, 40.7500, -74.0400, 40.7560, -74.0330,
    40.7610, -74.0265, 40.7680, -74.0200, 40.7750, -74.0150]);
  const cliffD = new Float32Array(1);
  function distToPolyline(pts, x, z) {
    let best = 1e9, side = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
      const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
      let t = ((x - ax) * vx + (z - az) * vz) / L2; t = clamp(t, 0, 1);
      const px = ax + vx * t, pz = az + vz * t, dd = Math.hypot(x - px, z - pz);
      if (dd < best) { best = dd; side = Math.sign(vx * (z - az) - vz * (x - ax)); }
    }
    return [best, side];
  }
  void cliffD;
  for (let z = 0; z < W; z++) {
    for (let x = 0; x < W; x++) {
      const i = z * W + x, zn = zone[i];
      if (zn === Z.WATER || zn === Z.PIER) continue;
      const dm = dW[i] / 10;
      let plateau;
      if (zn === Z.MN) {
        const [e, s] = xz2es(x, z), n = nOf(s);
        plateau = n < -25 ? 7 : n < -10 ? lerp(7, 4, (n + 25) / 15) : n < 5 ? lerp(4, 8, (n + 10) / 15)
          : n < 20 ? lerp(8, 13, (n - 5) / 15) : n < 36 ? lerp(13, 20, (n - 20) / 16) : n < 59 ? lerp(20, 18, (n - 36) / 23) : 24;
        if (n >= 59 && e > -878 && e < 0) plateau = 24 + (fbm(x, z, 140, 11, 3) - 0.5) * 8;
        // west side slopes down toward the Hudson
        if (e < -1100 && n > 14) plateau *= clamp(1 - (-1100 - e) / 1100, 0.25, 1);
      } else if (zn === Z.NJ) {
        const [dc, side] = distToPolyline(cliff, x, z);
        plateau = 3;
        if (side < 0) plateau = 3 + 32 * smooth(0, 40, dc) + 8 * smooth(40, 600, dc);
      } else if (zn === Z.BK) {
        plateau = 6 + (fbm(x, z, 300, 3, 2) - 0.5) * 4;
        const dbh = Math.hypot(x - bhx, z - bhz);
        if (dbh < 900) plateau = Math.max(plateau, lerp(20, 8, smooth(350, 900, dbh)));
      } else if (zn === Z.QN) plateau = 4 + (fbm(x, z, 300, 4, 2) - 0.5) * 2;
      else if (zn === Z.GOV) plateau = 3;
      else plateau = 3;
      for (const [hx, hz, r, h] of hills) {
        const dd = (x - hx) * (x - hx) + (z - hz) * (z - hz);
        if (dd < r * r * 4) plateau += h * Math.exp(-dd / (r * r));
      }
      // shoreline ramp: bulkheads sit ~2 m above water, rising inland
      let rampLen = 140;
      if (zn === Z.BK) {
        const dbh = Math.hypot(x - bhx, z - bhz);
        if (dbh < 1100) rampLen = lerp(70, 140, smooth(400, 1100, dbh));   // Brooklyn Heights bluff
      }
      const e = Math.min(plateau, 2 + (plateau - 2) * smooth(15, rampLen, dm));
      elev[i] = clamp(Math.round(e), 1, 60);
    }
  }
  log && log('elevation done');
  return dW;
}

// -------------------------------------------------------------------------------------------------
// Streets
// A street: { pts:[[x,z]...], rw, sw, two, dir, bus, bike, median, clip(i)->bool, kind }
export function makeStreetSet() { return []; }

function manhattanRegion(e, n) {
  // true where the Commissioners' grid applies
  if (n > 90) return false;
  if (e < -700) return n >= 13.6;
  if (e < -300) return n >= 11.4;
  if (e < 150) return n >= 8.3;
  if (e < 560) return n >= 8.0;
  return n >= 0.25;
}
export function isMainGrid(x, z) { const [e, s] = xz2es(x + 0.5, z + 0.5); return manhattanRegion(e, nOf(s)); }

// segments of the grid without streets: [e0, e1, n0, n1]
const NO_STREET = [
  [-878, 0, 59.5, 200],          // Central Park
  [1060, 2600, 14.4, 19.8],      // Stuyvesant Town
  [1060, 2600, 20.2, 22.8],      // Peter Cooper Village
  [1060, 2600, 42.3, 47.8],      // United Nations
  [-2100, -1146, 30.3, 32.7],    // Hudson Yards / West Side Yard
  [-2100, -1682, 34.3, 39.7],    // Javits Center
  [-878, -610, 31.3, 32.7],      // Penn Station / MSG
  [-1146, -878, 31.3, 32.7],     // Farley / Moynihan
  [-1146, -878, 40.3, 41.7],     // Port Authority
  [-305, 0, 40.3, 41.7],         // Bryant Park / NYPL
  [0, 155, 23.3, 25.7],          // Madison Square Park
  [180, 304, 14.3, 16.7],        // Union Square
  [1252, 1457, 7.3, 9.7],        // Tompkins Square
  [400, 505, 20.2, 20.8],        // Gramercy Park
  [-1146, -878, 62.3, 65.7],     // Lincoln Center
];
const NO_AVE = [
  [304, 41.8, 46.2],             // Park Ave: Grand Central + MetLife
  [1252, 14.2, 20], [1457, 14.2, 20], [1662, 14.2, 23],   // Stuy Town
  [-305, 59.2, 200], [-610, 59.2, 200],                   // 6th / 7th end at Central Park
  [-1682, 34.3, 39.7],                                     // Javits
];

export function gridStreets(m, streets) {
  const clip = (i) => m.dmap[i] === 0 && m.zone[i] === Z.MN && !PARKISH[m.use[i]] && m.use[i] !== U.PIER && isMainGrid(i % W, (i / W) | 0);
  // avenues: [e, n0, n1, rw, sw, dir(+1 northbound), bus, bike side (-1 left)]
  const aves = [
    [AVE.twelfth, 22, 95, 0, 0, 0], // West Side Highway drawn separately
    [AVE.eleventh, 14.5, 95, 9.75, 5.5, -1, 1, 0], [AVE.tenth, 13, 95, 9.75, 5.5, 1, 1, -1], [AVE.ninth, 13, 95, 9.75, 5.5, -1, 1, -1],
    [AVE.eighth, 12, 95, 9.75, 5.5, 1, 1, -1], [AVE.seventh, 11, 59.2, 9.75, 5.5, -1, 1, -1], [AVE.sixth, 14, 59.2, 9.75, 5.5, 1, 1, -1],
    [AVE.fifth, 8.3, 110, 9.75, 5.5, -1, 1, 0], [AVE.madison, 23, 110, 7.5, 4.5, 1, 1, 0], [AVE.park, 17, 110, 16.35, 5, 0, 0, 0],
    [AVE.lexington, 14, 110, 7.5, 4.5, -1, 1, 0], [AVE.third, 6, 110, 9.75, 5.5, 1, 1, 0], [AVE.second, 0.2, 110, 9.75, 5.5, -1, 1, -1],
    [AVE.first, 0.2, 110, 9.75, 5.5, 1, 1, -1], [AVE.york, 59, 110, 9.75, 5, 0, 0, 0], [1210, 53, 59, 5, 4, 0, 0, 0],
    [AVE.aveA, 0.2, 14.2, 8, 4.5, 1, 0, 0], [AVE.aveB, 0.2, 14.2, 8, 4.5, -1, 0, 0], [AVE.aveC, 0.2, 23, 8, 4.5, 1, 0, 0],
    [AVE.aveD, 0.2, 12.5, 8, 4.5, 0, 0, 0], [150, 8.3, 14, 5.5, 4, -1, 0, 0], [450, 14, 20, 5.5, 4, 1, 0, 0],
    [-150, 48.1, 50.9, 4, 3, 0, 0, 0],   // Rockefeller Plaza
  ];
  const out = [];
  for (const [e, n0, n1, rw, sw, dir, bus, bike] of aves) {
    if (!rw) continue;
    const segs = [];
    let a = n0;
    const cuts = NO_AVE.filter((c) => Math.abs(c[0] - e) < 1).sort((p, q) => p[1] - q[1]);
    for (const c of cuts) { if (c[1] > a) segs.push([a, Math.min(c[1], n1)]); a = Math.max(a, c[2]); }
    if (a < n1) segs.push([a, n1]);
    for (const [s0, s1] of segs) {
      const pts = [];
      for (let n = s0; n < s1; n += 4) pts.push(mg(e, n));
      pts.push(mg(e, s1));
      out.push({ pts, rw, sw, two: dir === 0, dir: dir || 1, bus: !!bus, bike: bike || 0, median: e === AVE.park ? 10 : 0, clip, kind: 'ave', name: `ave${e}` });
    }
  }
  // streets
  for (let n = 1; n <= 95; n++) {
    const wide = WIDE_STREETS.has(n);
    const rw = wide ? 10.25 : 5.15, sw = wide ? 5 : 4;
    const e0 = -2150, e1 = 2700;
    const cuts = NO_STREET.filter((c) => n > c[2] && n < c[3]).map((c) => [c[0], c[1]]).sort((p, q) => p[0] - q[0]);
    let a = e0; const segs = [];
    for (const c of cuts) { if (c[0] > a) segs.push([a, c[0]]); a = Math.max(a, c[1]); }
    if (a < e1) segs.push([a, e1]);
    for (const [s0, s1] of segs) {
      if (s1 - s0 < 20) continue;
      const pts = [];
      for (let e = s0; e < s1; e += 150) pts.push(mg(e, n));
      pts.push(mg(s1, n));
      out.push({ pts, rw, sw, two: wide, dir: n % 2 === 0 ? 1 : -1, bus: wide && [14, 23, 34, 42, 57].includes(n), bike: 0, median: 0, clip, kind: 'street', name: `st${n}` });
    }
  }
  streets.push(...out);
}

// local district grids
export function districtStreets(m, streets) {
  DISTRICTS.forEach((d, k) => {
    const did = k + 1;
    const clip = (i) => m.dmap[i] === did && !PARKISH[m.use[i]] && m.use[i] !== U.PIER;
    if (d.nogrid) return;
    if (d.grid) {
      for (const e of d.lines_e) {
        const pts = []; for (let n = -12; n <= 16; n += 2) pts.push(mg(e, n));
        streets.push({ pts, rw: d.wa / 2 - 3.5, sw: 3.5, two: false, dir: 1, clip, kind: 'dist', name: `${d.id}_e${e}` });
      }
      for (const n of d.lines_n) {
        const pts = []; for (let e = -700; e <= 900; e += 100) pts.push(mg(e, n));
        streets.push({ pts, rw: d.wb / 2 - 3.5, sw: 3.5, two: false, dir: n % 2 ? 1 : -1, clip, kind: 'dist', name: `${d.id}_n${n}` });
      }
      return;
    }
    const [ox, oz] = ll(d.origin[0], d.origin[1]);
    const [ax, az] = bearingXZ(d.bearing);      // long-street direction
    const bx = -az, bz = ax;                      // cross direction
    // extent of polygon in local coords
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const [x, z] of d.poly) {
      const a = (x - ox) * ax + (z - oz) * az, b = (x - ox) * bx + (z - oz) * bz;
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
    }
    const irr = d.irregular || 0;
    // lines parallel to the long direction (spaced by d.a across)
    for (let b = Math.floor(b0 / d.a) * d.a; b <= b1; b += d.a) {
      const jit = (hash2(k, Math.round(b), 3) - 0.5) * d.a * 0.25 * (irr ? 2 : 1);
      const bb = b + jit;
      const segL = irr ? 180 : 1e9;
      for (let a = a0 - 20; a < a1 + 20; a += segL) {
        if (irr && hash2(k, Math.round(a), Math.round(bb)) < irr) continue;
        const aa = Math.min(a1 + 20, a + segL);
        const p0 = [ox + ax * a + bx * bb, oz + az * a + bz * bb], p1 = [ox + ax * aa + bx * bb, oz + az * aa + bz * bb];
        streets.push({ pts: [p0, p1], rw: d.wa / 2 - 3.5, sw: 3.5, two: false, dir: 1, clip, kind: 'dist', name: `${d.id}_a` });
      }
    }
    for (let a = Math.floor(a0 / d.b) * d.b; a <= a1; a += d.b) {
      const jit = (hash2(k, Math.round(a), 5) - 0.5) * d.b * 0.25 * (irr ? 2 : 1);
      const aa = a + jit;
      const segL = irr ? 150 : 1e9;
      for (let b = b0 - 20; b < b1 + 20; b += segL) {
        if (irr && hash2(k + 7, Math.round(b), Math.round(aa)) < irr) continue;
        const bb = Math.min(b1 + 20, b + segL);
        const p0 = [ox + ax * aa + bx * b, oz + az * aa + bz * b], p1 = [ox + ax * aa + bx * bb, oz + az * aa + bz * bb];
        streets.push({ pts: [p0, p1], rw: d.wb / 2 - 3.5, sw: 3.5, two: false, dir: Math.round(a / d.b) % 2 ? 1 : -1, clip, kind: 'dist', name: `${d.id}_b` });
      }
    }
  });
}

export function namedStreets(m, streets) {
  const clip = (i) => !PARKISH[m.use[i]] && m.use[i] !== U.PIER && m.zone[i] !== Z.WATER;
  for (const s of NAMED_STREETS) {
    streets.push({ pts: s.pts, rw: s.rw, sw: s.sw, two: !!s.two, dir: 1, bus: false, bike: s.bike ? -1 : 0, median: 0, clip, kind: 'named', name: s.name });
  }
  // West Side Highway (Route 9A) with Hudson River Greenway on the river side
  const clipW = (i) => (m.zone[i] === Z.MN) && m.use[i] !== U.PIER;
  streets.push({ pts: WEST_ST, rw: 14, sw: 3, two: true, dir: 1, median: 4, clip: clipW, kind: 'hwy', name: 'West Side Highway', greenway: 1 });
  streets.push({ pts: FDR, rw: 10, sw: 2, two: true, dir: 1, median: 1, clip: clipW, kind: 'hwy', name: 'FDR Drive' });
}

// Rasterise all streets. Pass 1 marks road / walk, pass 2 paints markings and crosswalks.
export function rasterStreets(m, streets, log) {
  const { use, surf, zone } = m;
  const N = W * W;
  const stamp = m.bid;               // temporary: street id per road pixel (bid is rebuilt later)
  stamp.fill(0);
  const rcount = new Uint8Array(N);
  const walkOwner = new Int32Array(N);
  streets.forEach((st, k) => {
    const sid = k + 1;
    const hw = st.rw + st.sw;
    for (let j = 0; j + 1 < st.pts.length; j++) {
      const [ax, az] = st.pts[j], [bx, bz] = st.pts[j + 1];
      const Ls = Math.hypot(bx - ax, bz - az); if (Ls < 0.5) continue;
      const tx = (bx - ax) / Ls, tz = (bz - az) / Ls, nx = -tz, nz = tx;
      const ext = j === 0 || j === st.pts.length - 2 ? 0 : hw * 0.6;
      polySpans(band(ax, az, bx, bz, hw, ext), (z, xa, xb) => {
        for (let x = xa; x <= xb; x++) {
          const i = z * W + x;
          if (zone[i] === Z.WATER || !st.clip(i)) continue;
          const t = (x + 0.5 - ax) * nx + (z + 0.5 - az) * nz;
          if (Math.abs(t) <= st.rw) {
            if (stamp[i] !== sid) { if (rcount[i] < 255) rcount[i]++; stamp[i] = sid; }
            use[i] = st.kind === 'hwy' ? U.HWY : U.ROAD;
          } else if (use[i] !== U.ROAD && use[i] !== U.HWY) {
            use[i] = U.WALK; walkOwner[i] = sid;
          }
        }
      });
    }
  });
  log && log('streets pass 1');
  // distance to intersections (cells covered by 2+ different roadways)
  const dI = chamfer((i) => rcount[i] >= 2, 200);
  // pass 2: surfaces
  streets.forEach((st, k) => {
    const sid = k + 1;
    const hw = st.rw + st.sw;
    for (let j = 0; j + 1 < st.pts.length; j++) {
      const [ax, az] = st.pts[j], [bx, bz] = st.pts[j + 1];
      const Ls = Math.hypot(bx - ax, bz - az); if (Ls < 0.5) continue;
      const tx = (bx - ax) / Ls, tz = (bz - az) / Ls, nx = -tz, nz = tx;
      const ext = j === 0 || j === st.pts.length - 2 ? 0 : hw * 0.6;
      let sBase = 0; for (let q = 0; q < j; q++) sBase += Math.hypot(st.pts[q + 1][0] - st.pts[q][0], st.pts[q + 1][1] - st.pts[q][1]);
      polySpans(band(ax, az, bx, bz, hw, ext), (z, xa, xb) => {
        for (let x = xa; x <= xb; x++) {
          const i = z * W + x;
          const u = use[i];
          if (u === U.WALK && walkOwner[i] === sid) {
            const t = Math.abs((x + 0.5 - ax) * nx + (z + 0.5 - az) * nz);
            surf[i] = t - st.rw < 1.0 ? M.curb : (st.greenway && t > st.rw + 0.5 ? M.sidewalk : M.sidewalk);
            continue;
          }
          if ((u !== U.ROAD && u !== U.HWY) || stamp[i] !== sid) continue;
          const t = (x + 0.5 - ax) * nx + (z + 0.5 - az) * nz;
          const s = sBase + (x + 0.5 - ax) * tx + (z + 0.5 - az) * tz;
          surf[i] = roadSurface(st, t, s, rcount[i], dI[i] / 10, x, z);
        }
      });
    }
  });
  log && log('streets pass 2');
}

function roadSurface(st, t, s, cover, dInt, x, z) {
  const base = (hash2(x >> 3, z >> 3, 91) < 0.18) ? M.asphalt_old : M.asphalt;
  if (cover >= 2) return base;                                   // inside an intersection box
  const rw = st.rw;
  if (dInt < 5 && dInt >= 1 && st.kind !== 'hwy') {             // crosswalk
    return (Math.floor(t + rw + 0.5) & 1) === 0 ? M.crosswalk : base;
  }
  if (dInt >= 5 && dInt < 6 && st.kind !== 'hwy') return M.lane_white; // stop bar
  const at = Math.abs(t);
  const dash = ((Math.floor(s / 3) & 3) === 0);
  if (st.median) {
    if (at < st.median / 2) return st.kind === 'hwy' ? (at < st.median / 2 - 0.5 ? M.concrete : M.lane_yellow) : (at < st.median / 2 - 1 ? M.grass : M.curb);
    const tt = at - st.median / 2, half = rw - st.median / 2;
    const lanes = Math.max(1, Math.round(half / 3.4)), lw = half / lanes;
    const k = tt / lw, f = k - Math.floor(k);
    if (f < 0.5 / lw && k > 0.5 && k < lanes - 0.5 && dash) return M.lane_white;
    return base;
  }
  if (st.two) {
    if (at < 0.55) return M.lane_yellow;
    const lanes = Math.max(1, Math.round(rw / 3.4)), lw = rw / lanes;
    const k = at / lw, f = k - Math.floor(k);
    if (st.bus && k >= lanes - 1) return (f < 0.3 / lw && k < lanes - 0.5) ? M.lane_white : M.bus_lane;
    if (f < 0.5 / lw && k > 0.6 && k < lanes - 0.4 && dash) return M.lane_white;
    return base;
  }
  // one-way: right side (t > 0 when travelling along +dir) gets the bus lane, bike lane on the left when requested
  const tr = t * st.dir;
  const width = 2 * rw;
  if (st.kind === 'street' || st.kind === 'dist') {
    return base;
  }
  const pos = tr + rw;                                           // 0 at left curb .. width at right curb
  if (st.bike && pos < 2.2) return pos < 0.9 ? M.bike_lane : M.bike_lane;
  if (st.bike && pos < 3.2) return M.lane_white;
  if (st.bus && pos > width - 3.2) return pos < width - 2.9 ? M.lane_white : M.bus_lane;
  const inner0 = st.bike ? 3.2 : 0, inner1 = st.bus ? width - 3.2 : width;
  const lanes = Math.max(1, Math.round((inner1 - inner0) / 3.3)), lw = (inner1 - inner0) / lanes;
  const k = (pos - inner0) / lw, f = k - Math.floor(k);
  if ((f < 0.5 / lw || f > 1 - 0.5 / lw) && k > 0.5 && k < lanes - 0.5 && dash) return M.lane_white;
  return base;
}

// -------------------------------------------------------------------------------------------------
export function rasterDistricts(m) {
  DISTRICTS.forEach((d, k) => polySpans(d.poly, setSpanIf(m.dmap, k + 1, (i) => m.zone[i] !== Z.WATER)));
  // Manhattan cells outside the main grid that no district claims -> nearest reasonable: leave 0
  // non-Manhattan land without a district -> leave 0 (treated as generic)
}

export function rasterParks(m) {
  const { use, surf } = m;
  for (const [name, poly, type] of PARKS) {
    if (!poly) continue;
    const u = type === 'woods' ? U.WOODS : type === 'plaza' ? U.PLAZA : type === 'lawn' ? U.LAWN : U.PARK;
    polySpans(poly, setSpanIf(use, u, (i) => m.zone[i] !== Z.WATER && m.zone[i] !== Z.PIER));
    void name; void surf;
  }
}

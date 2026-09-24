// Bridges and other free-form structures, built as sparse voxel sets and emitted as column runs.
import { W, SEA, ll, mg, bearingXZ } from './frame.mjs';
import { M } from './palette.mjs';
import { MODE_OVER } from './structures.mjs';

// Sparse voxel set keyed by column. Later writes win.
export class VoxelSet {
  constructor(name) { this.name = name; this.cols = new Map(); this.bbox = [1e9, 1e9, -1e9, -1e9]; }
  set(x, y, z, m) {
    x = Math.floor(x); z = Math.floor(z); y = Math.floor(y);
    if (x < 0 || z < 0 || x >= W || z >= W || y < 0 || y > 1000) return;
    const k = z * W + x;
    let c = this.cols.get(k);
    if (!c) { c = new Map(); this.cols.set(k, c); if (x < this.bbox[0]) this.bbox[0] = x; if (z < this.bbox[1]) this.bbox[1] = z; if (x > this.bbox[2]) this.bbox[2] = x; if (z > this.bbox[3]) this.bbox[3] = z; }
    c.set(y, m);
  }
  fillCol(x, z, y0, y1, m) { for (let y = Math.floor(y0); y < Math.ceil(y1); y++) this.set(x, y, z, m); }
  line(p0, p1, r, m, step = 0.45) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2], L = Math.hypot(dx, dy, dz), n = Math.max(1, Math.ceil(L / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = p0[0] + dx * t, y = p0[1] + dy * t, z = p0[2] + dz * t;
      if (r <= 0.5) this.set(x, y, z, m);
      else for (let oy = -r; oy <= r; oy += 0.7) for (let ox = -r; ox <= r; ox += 0.7) for (let oz = -r; oz <= r; oz += 0.7) if (ox * ox + oy * oy + oz * oz <= r * r) this.set(x + ox, y + oy, z + oz, m);
    }
  }
  toStructure() {
    // freeze into sorted runs per column
    const runs = new Map();
    for (const [k, c] of this.cols) {
      const ys = [...c.keys()].sort((a, b) => a - b);
      const out = [];
      let s = ys[0], m = c.get(s), p = s;
      for (let i = 1; i <= ys.length; i++) {
        const y = ys[i], mm = y !== undefined ? c.get(y) : -1;
        if (y === p + 1 && mm === m) { p = y; continue; }
        out.push(s, p + 1, m);
        if (y === undefined) break;
        s = y; p = y; m = mm;
      }
      runs.set(k, out);
    }
    this.cols = null;
    const bbox = this.bbox, name = this.name;
    return {
      name, bbox,
      emit(X0, Z0, R, add) {
        let n = 0;
        const xa = Math.max(bbox[0], X0), xb = Math.min(bbox[2], X0 + R - 1), za = Math.max(bbox[1], Z0), zb = Math.min(bbox[3], Z0 + R - 1);
        for (let z = za; z <= zb; z++) for (let x = xa; x <= xb; x++) {
          const r = runs.get(z * W + x); if (!r) continue;
          for (let i = 0; i < r.length; i += 3) { add(x - X0, z - Z0, r[i], r[i + 1], r[i + 2], MODE_OVER); n++; }
        }
        return n;
      },
    };
  }
}

const groundAt = (maps, x, z) => { const i = Math.round(z) * W + Math.round(x); return maps && maps.zone[i] ? SEA + maps.elev[i] : SEA; };

// ---------------------------------------------------------------------------------------------
// deck profile shared by the voxel builder and the actor paths
export function deckProfile(maps, spec) {
  const [ax, az] = spec.A, [bx, bz] = spec.B;
  const L = Math.hypot(bx - ax, bz - az);
  const { sA1, sT1, sT2, sA2, deckT, deckM } = spec;
  const gA = groundAt(maps, ax, az), gB = groundAt(maps, bx, bz);
  const sm = (sT1 + sT2) / 2, half = (sT2 - sT1) / 2, yAnchor = SEA + spec.anchorH;
  return (s) => {
    if (s < sA1) return gA + (yAnchor - gA) * Math.pow(Math.max(0, s) / sA1, 0.9);
    if (s < sT1) return yAnchor + (deckT - yAnchor) * (s - sA1) / (sT1 - sA1);
    if (s <= sT2) { const k = (s - sm) / half; return deckM + (deckT - deckM) * k * k; }
    if (s < sA2) return deckT + (yAnchor - deckT) * (s - sT2) / (sA2 - sT2);
    return yAnchor + (gB - yAnchor) * Math.pow(Math.min(1, (s - sA2) / (L - sA2)), 0.9);
  };
}

// generic suspension bridge along A -> B
function suspension(maps, spec) {
  const vs = new VoxelSet(spec.name);
  const [ax, az] = spec.A, [bx, bz] = spec.B;
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, vx = -uz, vz = ux;
  const P = (s, v) => [ax + ux * s + vx * v, az + uz * s + vz * v];
  const { sA1, sT1, sT2, sA2, halfW, deckT, deckM, towerTop, cables, style } = spec;
  const gA = groundAt(maps, ax, az), gB = groundAt(maps, bx, bz);
  const sm = (sT1 + sT2) / 2, half = (sT2 - sT1) / 2;
  const yAnchor = SEA + spec.anchorH;
  const deckY = (s) => {
    if (s < sA1) return gA + (yAnchor - gA) * Math.pow(s / sA1, 0.9);
    if (s < sT1) return yAnchor + (deckT - yAnchor) * (s - sA1) / (sT1 - sA1);
    if (s <= sT2) { const k = (s - sm) / half; return deckM + (deckT - deckM) * k * k; }
    if (s < sA2) return deckT + (yAnchor - deckT) * (s - sT2) / (sA2 - sT2);
    return yAnchor + (gB - yAnchor) * Math.pow((s - sA2) / (L - sA2), 0.9);
  };
  const cableY = (s) => {
    const sag = spec.cableLow;
    if (s >= sT1 && s <= sT2) { const k = (s - sm) / half; return sag + (towerTop - 4 - sag) * k * k; }
    if (s < sT1 && s >= sA1) { const k = (sT1 - s) / (sT1 - sA1); return (towerTop - 4) - (towerTop - 4 - (yAnchor + 3)) * Math.pow(k, 0.85); }
    if (s > sT2 && s <= sA2) { const k = (s - sT2) / (sA2 - sT2); return (towerTop - 4) - (towerTop - 4 - (yAnchor + 3)) * Math.pow(k, 0.85); }
    return null;
  };
  // deck, trusses, promenade
  for (let s = 0; s <= L; s += 0.5) {
    const y = Math.round(deckY(s));
    const overWater = !maps || !maps.zone[Math.round(P(s, 0)[1]) * W + Math.round(P(s, 0)[0])];
    for (let v = -halfW; v <= halfW; v += 0.5) {
      const [x, z] = P(s, v);
      const av = Math.abs(v);
      if (spec.lower && av < halfW - 1) vs.set(x, y - 6, z, (av < spec.lower.tracks) ? ((Math.round(v * 2) % 3 === 0) ? M.rail_steel : M.rail_ballast) : M.asphalt);
      vs.set(x, y - 1, z, style.steel);
      vs.set(x, y, z, av < (spec.promenade || 0) ? style.steel : (av > halfW - 1 ? style.steel : M.asphalt));
      if (av > halfW - 1.2) {
        const th = spec.truss || 4;
        for (let k = 1; k <= th; k++) if (k === th || ((Math.floor(s / 3) + k) % 2 === 0)) vs.set(x, y + k, z, style.steel);
        if (spec.lower) for (let k = -5; k < 0; k++) if ((Math.floor(s / 3) + k) % 2 === 0) vs.set(x, y + k, z, style.steel);
      }
      if (spec.promenade && av < spec.promenade) {
        vs.set(x, y + 5, z, M.planks);
        if (av > spec.promenade - 0.7) vs.set(x, y + 6, z, style.steel);
      }
    }
    // supports under approaches on land: masonry or steel piers
    if ((s < sA1 || s > sA2) && !overWater && Math.floor(s) % (spec.pierStep || 40) === 0) {
      for (let v = -halfW; v <= halfW; v += 0.5) {
        const [x, z] = P(s, v);
        const g = groundAt(maps, x, z);
        if (y - 2 > g) for (let yy = g; yy < y - 1; yy++) vs.set(x, yy, z, spec.approachMat || M.granite_gray);
      }
    }
  }
  // masonry approach walls with arches (Brooklyn Bridge style)
  if (spec.masonryApproach) {
    for (const [s0, s1] of [[spec.masonryApproach[0], sA1], [sA2, spec.masonryApproach[1]]]) {
      for (let s = s0; s <= s1; s += 0.5) {
        const y = Math.round(deckY(s));
        const archC = ((s % 32) + 32) % 32, archOpen = archC > 6 && archC < 26;
        for (let v = -halfW + 0.5; v <= halfW - 0.5; v += 0.5) {
          const [x, z] = P(s, v); const g = groundAt(maps, x, z);
          const archTop = g + 9 + Math.sqrt(Math.max(0, 100 - (archC - 16) * (archC - 16)));
          for (let yy = g; yy < y - 1; yy++) if (!(archOpen && yy < archTop)) vs.set(x, yy, z, M.granite_gray);
        }
      }
    }
  }
  // anchorages
  for (const sA of [sA1, sA2]) {
    for (let s = sA - spec.anchorL / 2; s <= sA + spec.anchorL / 2; s += 0.5) for (let v = -spec.anchorW / 2; v <= spec.anchorW / 2; v += 0.5) {
      const [x, z] = P(s, v); const g = groundAt(maps, x, z) - 2;
      const top = yAnchor + 2 + (Math.abs(v) > spec.anchorW / 2 - 3 ? 3 : 0);
      for (let yy = g; yy < top; yy++) vs.set(x, yy, z, (yy > top - 3) ? M.granite_gray : spec.anchorMat || M.granite_gray);
    }
  }
  // towers
  for (const sT of [sT1, sT2]) spec.tower(vs, P, sT, deckY(sT), towerTop, maps);
  // main cables + suspenders
  for (const cv of cables) {
    let prev = null;
    for (let s = sA1; s <= sA2; s += 0.5) {
      const cy = cableY(s); if (cy === null) continue;
      const [x, z] = P(s, cv);
      const pt = [x, cy, z];
      if (prev) vs.line(prev, pt, spec.cableR || 0, M.cable, 0.4); else vs.set(x, cy, z, M.cable);
      prev = pt;
      if (Math.abs(cv) > 8 && Math.abs((s % spec.suspStep) - 0) < 0.26 && (s < sT1 - 3 || s > sT1 + 12) && (s < sT2 - 12 || s > sT2 + 3)) {
        const y0 = deckY(s) + 1;
        for (let yy = Math.ceil(y0); yy < cy; yy++) vs.set(x, yy, z, M.suspender);
      }
    }
  }
  // diagonal stays radiating from the tower tops (Brooklyn Bridge)
  if (spec.stays) {
    for (const sT of [sT1, sT2]) for (const cv of cables) {
      const top = [P(sT, cv)[0], towerTop - 6, P(sT, cv)[1]];
      for (let k = 1; k <= spec.stays.n; k++) for (const dir of [-1, 1]) {
        const s = sT + dir * k * spec.stays.step;
        if (s < sA1 || s > sA2) continue;
        const [x, z] = P(s, cv);
        vs.line(top, [x, deckY(s) + 2, z], 0, M.cable, 0.5);
      }
    }
  }
  return vs;
}

// Brooklyn Bridge granite tower with two pointed Gothic arches
function gothicTower(vs, P, sT, deck, top, maps) {
  const [cx, cz] = P(sT, 0);
  const bed = maps ? SEA - maps.depth[Math.round(cz) * W + Math.round(cx)] : SEA - 10;
  for (let s = -10; s <= 10; s += 0.5) for (let v = -21.5; v <= 21.5; v += 0.5) {
    const [x, z] = P(sT + s, v);
    for (let y = bed; y < top; y++) {
      const hh = y - deck;
      const taper = (y - SEA) / (top - SEA);
      if (Math.abs(v) > 21.5 - taper * 2 || Math.abs(s) > 10 - taper * 1.5) continue;
      // arches: openings at |v| in [3.5, 14.5] from deck up to a pointed top
      const av = Math.abs(v);
      if (av > 3.5 && av < 14.5 && hh >= 0) {
        const c = (av - 9) / 5.5;                                     // -1..1 across the arch
        const archTop = 24 + 12 * Math.sqrt(Math.max(0, 1 - Math.abs(c))) ;
        if (hh < archTop) continue;
      }
      let m = y < SEA + 2 ? M.granite_gray : M.bridge_granite;
      if (y > top - 5) m = M.limestone;
      if (hh > 44 && hh < 47) m = M.limestone;
      vs.set(x, y, z, m);
    }
  }
}

// steel towers (Manhattan / Williamsburg bridges)
function steelTower(color, lattice) {
  return (vs, P, sT, deck, top, maps) => {
    const [cx, cz] = P(sT, 0);
    const bed = maps ? SEA - maps.depth[Math.round(cz) * W + Math.round(cx)] : SEA - 10;
    // masonry pier to above water
    for (let s = -9; s <= 9; s += 0.5) for (let v = -22; v <= 22; v += 0.5) { const [x, z] = P(sT + s, v); for (let y = bed; y < SEA + 6; y++) vs.set(x, y, z, M.granite_gray); }
    for (const side of [-1, 1]) {
      for (let y = SEA + 6; y < top; y++) {
        const t = (y - SEA) / (top - SEA);
        const hs = 4.5 - t * 1.5, hv = 3.2 - t * 0.8, vc = side * (17 - t * 2);
        for (let s = -hs; s <= hs; s += 0.5) for (let v = -hv; v <= hv; v += 0.5) {
          const edge = Math.abs(s) > hs - 1 || Math.abs(v) > hv - 1;
          if (lattice && !edge && ((Math.floor(y / 3) + Math.floor(s)) % 2 === 0)) continue;
          if (!lattice && !edge) continue;
          const [x, z] = P(sT + s, vc + v); vs.set(x, y, z, color);
        }
      }
    }
    // cross bracing + top portal
    for (const yb of [deck + 14, deck + 34, top - 8]) {
      for (let v = -15; v <= 15; v += 0.5) for (let s = -2; s <= 2; s += 0.5) for (let k = 0; k < (yb === top - 8 ? 6 : 3); k++) { const [x, z] = P(sT + s, v); vs.set(x, yb + k, z, color); }
    }
    for (let v = -19; v <= 19; v += 0.5) for (let s = -3; s <= 3; s += 0.5) { const [x, z] = P(sT + s, v); vs.set(x, top, z, color); vs.set(x, top + 1, z, Math.abs(v) > 16 ? M.steel_dark : color); }
    if (lattice) for (let y = deck + 2; y < top - 8; y += 1) { const f = (y - deck) / (top - 8 - deck); const v = -15 + 30 * ((f * 3) % 1); const [x, z] = P(sT, v); vs.set(x, y, z, color); const [x2, z2] = P(sT, -v); vs.set(x2, y, z2, color); }
  };
}

// ---------------------------------------------------------------------------------------------
export function bridgeList(maps) {
  return [...bridgeSpecs(maps).map((sp) => suspension(maps, sp).toStructure()), highLine(maps).toStructure(), intrepid(maps).toStructure(), cruiseShip(maps).toStructure()];
}

// The High Line: elevated park on the old freight viaduct, Gansevoort St -> 30th St -> 12th Ave -> 34th St
export const HIGH_LINE = [[-1575, 12.6], [-1560, 14], [-1548, 16], [-1548, 22], [-1548, 26], [-1548, 29.6], [-1600, 30.15], [-1700, 30.2], [-1830, 30.3], [-1880, 31.2], [-1885, 33], [-1880, 34.2]];
export function highLinePolys() {
  const pts = HIGH_LINE.map(([e, n]) => mg(e, n));
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, r = 6.5;
    out.push([[ax - uz * r - ux * 3, az + ux * r - uz * 3], [bx - uz * r + ux * 3, bz + ux * r + uz * 3], [bx + uz * r + ux * 3, bz - ux * r + uz * 3], [ax + uz * r - ux * 3, az - ux * r - uz * 3]]);
  }
  return out;
}
function highLine(maps) {
  const vs = new VoxelSet('The High Line');
  const pts = HIGH_LINE.map(([e, n]) => mg(e, n));
  let s0 = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, vx = -uz, vz = ux;
    for (let s = 0; s <= L; s += 0.5) {
      const cx = ax + ux * s, cz = az + uz * s;
      const g = groundAt(maps, cx, cz), top = g + 9;
      const ss = s0 + s;
      for (let v = -5.5; v <= 5.5; v += 0.5) {
        const x = cx + vx * v, z = cz + vz * v, av = Math.abs(v);
        vs.set(x, top - 2, z, M.steel_dark); vs.set(x, top - 1, z, M.steel_dark);
        let m = M.gravel_path;
        if (av > 5) m = M.steel_dark;
        else if ((ss % 40) < 18 ? (v > 1.2) : (v < -1.2)) m = ((Math.floor(ss / 3) + Math.floor(v)) % 5 === 0) ? M.flowers_purple : M.meadow;
        else m = (Math.floor(ss) % 2 === 0) ? M.concrete : M.plaza;
        vs.set(x, top, z, m);
        if (av > 5) vs.set(x, top + 1, z, M.metal_dark);
        if (m === M.meadow && ((Math.floor(ss / 7) * 13 + Math.floor(v * 3)) % 23 === 0)) { vs.set(x, top + 1, z, M.hedge); vs.set(x, top + 2, z, M.leaves_light); }
      }
      if (Math.floor(ss) % 14 === 0) for (const v of [-4.5, 4.5]) { const x = cx + vx * v, z = cz + vz * v; for (let y = g; y < top - 2; y++) vs.set(x, y, z, M.steel_dark); }
    }
    s0 += L;
  }
  return vs;
}
// USS Intrepid (CV-11) moored at Pier 86, W 46th St
function intrepid() {
  const vs = new VoxelSet('USS Intrepid');
  const [px, pz] = ll(40.76455, -74.00040);
  const [ux, uz] = bearingXZ(294), vx = -uz, vz = ux;
  const off = 30;                                  // alongside the pier's north side
  const cx = px + vx * off + ux * 120, cz = pz + vz * off + uz * 120;
  const P = (s, v) => [cx + ux * s + vx * v, cz + uz * s + vz * v];
  for (let s = -131; s <= 131; s += 0.5) {
    const t = Math.abs(s) / 131;
    const hullW = 14 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (s - 60) / 72), 2))) * (s < -110 ? 0.85 : 1);
    for (let v = -24; v <= 24; v += 0.5) {
      const [x, z] = P(s, v);
      if (Math.abs(v) <= hullW) for (let y = SEA - 9; y < SEA + 10; y++) vs.set(x, y, z, y < SEA + 1 ? M.hull_dark : M.navy_gray);
      const deckW = s > 110 ? 14 * (1 - (s - 110) / 22) + 6 : (v > 0 ? 22 : 18);
      if (Math.abs(v) <= deckW && Math.abs(s) < 130) { vs.set(x, SEA + 14, z, M.steel_dark); vs.set(x, SEA + 15, z, (Math.abs(v - 0) < 0.5 && s > -100) ? M.lane_white : M.asphalt_old); if (Math.abs(v) > deckW - 1) vs.set(x, SEA + 13, z, M.navy_gray); }
      if (Math.abs(v) <= Math.min(hullW, deckW) - 1) for (let y = SEA + 10; y < SEA + 14; y++) vs.set(x, y, z, M.navy_gray);
    }
    void t;
  }
  // island superstructure (starboard) + mast
  for (let s = 5; s <= 40; s += 0.5) for (let v = 15; v <= 21; v += 0.5) { const [x, z] = P(s, v); const top = s > 12 && s < 32 ? SEA + 38 : SEA + 28; for (let y = SEA + 16; y < top; y++) vs.set(x, y, z, (y - SEA) % 4 === 0 && Math.abs(v - 15) < 0.6 ? M.window : M.navy_gray); }
  { const [x, z] = P(22, 18); for (let y = SEA + 38; y < SEA + 52; y++) vs.set(x, y, z, M.antenna); }
  // aircraft on deck
  for (const [s, v] of [[-90, -6], [-70, 8], [-50, -8], [-30, 5], [60, -8], [80, 4], [100, -4]]) {
    for (let a = -7; a <= 7; a += 0.5) { const [x, z] = P(s + a, v); vs.set(x, SEA + 16, z, M.navy_gray); }
    for (let w = -6; w <= 6; w += 0.5) { const [x, z] = P(s + 1, v + w); vs.set(x, SEA + 16, z, M.metal_panel); }
    const [x, z] = P(s - 6, v); vs.set(x, SEA + 17, z, M.navy_gray); vs.set(x, SEA + 18, z, M.navy_gray);
  }
  // Space Shuttle pavilion (white dome) on the aft deck
  for (let s = -128; s <= -100; s += 0.5) for (let v = -14; v <= 14; v += 0.5) { const r = Math.hypot((s + 114) / 14, v / 14); if (r < 1) { const [x, z] = P(s, v); vs.set(x, SEA + 16 + Math.round(9 * Math.sqrt(1 - r * r)), z, M.canvas); } }
  return vs;
}
// cruise ship at Pier 88
function cruiseShip() {
  const vs = new VoxelSet('Cruise ship (Pier 88)');
  const [px, pz] = ll(40.76625, -73.99855);
  const [ux, uz] = bearingXZ(294), vx = -uz, vz = ux;
  const cx = px + vx * 42 + ux * 150, cz = pz + vz * 42 + uz * 150;
  const P = (s, v) => [cx + ux * s + vx * v, cz + uz * s + vz * v];
  for (let s = -150; s <= 150; s += 0.5) {
    const bow = s > 110 ? 1 - Math.pow((s - 110) / 40, 2) : 1;
    const hw = 18 * Math.sqrt(Math.max(0.02, bow));
    for (let v = -hw; v <= hw; v += 0.5) {
      const [x, z] = P(s, v);
      const edge = Math.abs(v) > hw - 1;
      const top = SEA + (s < 115 && s > -140 ? 52 - Math.max(0, (Math.abs(s) - 90) * 0.25) : 16);
      for (let y = SEA - 8; y < top; y++) {
        let m = y < SEA + 3 ? M.container_blue : M.white;
        if (edge && y > SEA + 16 && y < top - 2 && (y - SEA) % 3 !== 0) m = M.glass_dark;
        if (edge && y > SEA + 5 && y < SEA + 14 && (y - SEA) % 3 === 1) m = M.window;
        vs.set(x, y, z, m);
      }
      if (Math.abs(v) < 5 && s > -80 && s < -55) for (let y = top; y < top + 12; y++) vs.set(x, y, z, y > top + 8 ? M.black : M.red);
    }
  }
  return vs;
}

export function bridgeSpecs(maps) {
  const out = [];
  // Brooklyn Bridge: main span 486 m, side spans 283 m, towers 84 m above high water, deck ~36-41 m
  {
    const A = ll(40.71165, -74.00415), B = ll(40.69935, -73.98985);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const mT = ll(40.70735, -73.99869), bT = ll(40.70405, -73.99491);
    const proj = (p) => (p[0] - A[0]) * (B[0] - A[0]) / L + (p[1] - A[1]) * (B[1] - A[1]) / L;
    const sT1 = proj(mT), sT2 = sT1 + 486;
    out.push({
      name: 'Brooklyn Bridge', A, B, sA1: sT1 - 283, sT1, sT2, sA2: sT2 + 283, halfW: 13, deckT: SEA + 36, deckM: SEA + 41,
      towerTop: SEA + 84, cables: [-12.2, -3.4, 3.4, 12.2], cableLow: SEA + 43, anchorH: 27, anchorL: 40, anchorW: 36,
      suspStep: 8, stays: { n: 6, step: 24 }, promenade: 3, truss: 4, style: { steel: M.bridge_tan }, tower: gothicTower,
      masonryApproach: [Math.max(0, sT1 - 283 - 250), Math.min(L, sT2 + 283 + 260)], approachMat: M.granite_gray, pierStep: 99999,
    });
    void L;
  }
  // Manhattan Bridge: main span 448 m, side spans 222 m, towers ~102 m, double deck
  {
    const A = ll(40.71560, -73.99490), B = ll(40.69830, -73.98530);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const mT = ll(40.70870, -73.99180);
    const sT1 = (mT[0] - A[0]) * (B[0] - A[0]) / L + (mT[1] - A[1]) * (B[1] - A[1]) / L;
    out.push({
      name: 'Manhattan Bridge', A, B, sA1: sT1 - 222, sT1, sT2: sT1 + 448, sA2: sT1 + 448 + 222, halfW: 20, deckT: SEA + 41, deckM: SEA + 44,
      towerTop: SEA + 102, cables: [-15.5, -12.5, 12.5, 15.5], cableLow: SEA + 50, anchorH: 30, anchorL: 60, anchorW: 50,
      suspStep: 6, truss: 7, style: { steel: M.bridge_blue }, tower: steelTower(M.bridge_blue, false), lower: { tracks: 11 }, pierStep: 36, approachMat: M.bridge_blue,
    });
  }
  // Williamsburg Bridge: main span 488 m, lattice towers ~102 m, cables over the main span only
  {
    const A = ll(40.71630, -73.98450), B = ll(40.71010, -73.96150);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const mT = ll(40.71380, -73.97540);
    const sT1 = (mT[0] - A[0]) * (B[0] - A[0]) / L + (mT[1] - A[1]) * (B[1] - A[1]) / L;
    out.push({
      name: 'Williamsburg Bridge', A, B, sA1: sT1 - 180, sT1, sT2: sT1 + 488, sA2: sT1 + 488 + 180, halfW: 18, deckT: SEA + 41, deckM: SEA + 43,
      towerTop: SEA + 102, cables: [-15, -13, 13, 15], cableLow: SEA + 49, anchorH: 32, anchorL: 30, anchorW: 40,
      suspStep: 6, truss: 8, style: { steel: M.bridge_red }, tower: steelTower(M.bridge_red, true), pierStep: 30, approachMat: M.bridge_red,
    });
  }
  return out;
}

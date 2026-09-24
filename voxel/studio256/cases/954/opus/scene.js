const R = Math.round, PI = Math.PI;
const C = {
  rock0: '#252B4A', rock1: '#323A62', rock2: '#434C7C', rock3: '#5A6390',
  pine0: '#22574A', pine1: '#2E6B5A', pine2: '#3F7F69', gold: '#D9C27C', goldL: '#EAD9A0', lichen: '#C8AE5C',
  sea: '#1E2A52', seaL: '#2C3D70', foam: '#E3E9F0',
  white: '#F5F1E6', mantle: '#2A2E4D', tail: '#33385A', leg: '#C9A184', feet: '#D8B090',
  juv: '#AEB3C0', horn: '#6B6470', chick: '#9FA3AE', chickL: '#C4C7CF',
  wood: '#CDBB94', woodD: '#A8977A', rope: '#E2C987', mud: '#5E4D3E', mudD: '#4A3D33'
};
const M = {
  wTop: '#232743', wEdge: '#3B4066', wUnder: '#E9E4D6',
  headW: '#F8F4EA', brow: '#3A3E5E', bill: '#E8C46A', tip: '#E98A55', eye: '#12131F',
  chickH: '#A7ABB6', grassG: '#4C8C70', grassY: '#C9B46E'
};

// island with layered cliffs and surf
const CX = 128, CZ = 128;
function rimR(a) { return 84 + 6 * Math.sin(3 * a + 0.6) + 4 * Math.sin(5 * a + 2.1) + 2 * Math.sin(11 * a + 0.3); }
function topH(x, z) {
  const dx = x - CX, dz = z - CZ, d = Math.hypot(dx, dz), r = rimR(Math.atan2(dz, dx));
  let h = 23 + 5 * (1 - d / r) + 1.5 * Math.sin(x * 0.11) * Math.cos(z * 0.09) + 1.1 * Math.sin((x + z) * 0.07);
  const kn = ((x - 84) * (x - 84) + (z - 164) * (z - 164)) / 500;
  h += 3 * Math.exp(-kn);
  if (d > r - 7) h -= (d - (r - 7)) * 1.2;
  return h;
}
function rockCol(x, y, z) {
  const b = Math.floor((y + 2.2 * Math.sin(x * 0.09 + z * 0.05) + 1.3 * Math.cos(z * 0.13)) / 3);
  return [C.rock0, C.rock1, C.rock2, C.rock1][((b % 4) + 4) % 4];
}
function turfCol(x, z, rimness) {
  const n = Math.sin(x * 0.37 + z * 0.21) + Math.cos(x * 0.19 - z * 0.33) + (rng() - 0.5) * 0.8;
  if (rimness > 0.6) return rng() < 0.2 ? C.lichen : rockCol(x, 30, z);
  if (n > 1.25) return C.gold;
  if (n > 0.9) return C.goldL;
  if (n < -1.1) return C.pine0;
  return n > 0.2 ? C.pine2 : C.pine1;
}
for (let x = 18; x <= 238; x++) for (let z = 18; z <= 238; z++) {
  const dx = x - CX, dz = z - CZ, d = Math.hypot(dx, dz), r = rimR(Math.atan2(dz, dx));
  if (d > r + 10) continue;
  if (d > r) {
    const foam = d < r + 2 || (d < r + 5 && rng() < 0.18);
    box(x, 4, z, x, 5, z, C.sea);
    block(x, 6, z, foam ? C.foam : (rng() < 0.12 ? C.seaL : C.sea));
    continue;
  }
  const h = R(topH(x, z)), edge = d > r - 9;
  const y0 = edge ? 4 : Math.max(4, h - 5);
  for (let y = y0; y < h; y++) block(x, y, z, rockCol(x, y, z));
  block(x, h, z, turfCol(x, z, (d - (r - 7)) / 7));
}

// windward rock table: stacked slabs with an overhanging cap
const TCX = 128, TCZ = 90;
for (let k = 0; k < 6; k++) {
  const y0 = 22 + k * 5, y1 = k === 5 ? 54 : y0 + 4, top = k === 5;
  const rx = 37 - k * 0.6 + (k % 2) * 2 + (top ? 2 : 0), rz = 23 - k * 0.3 + (k % 2) + (top ? 1 : 0);
  const ox = ((k % 3) - 1) * 1.5, oz = (((k + 1) % 3) - 1) * 1.2;
  for (let x = TCX - 44; x <= TCX + 44; x++) for (let z = TCZ - 29; z <= TCZ + 29; z++) {
    const ux = x - TCX - ox, uz = z - TCZ - oz, ang = Math.atan2(uz, ux);
    const wob = 1 + 0.06 * Math.sin(5 * ang + k) + 0.04 * Math.sin(9 * ang + 2 * k);
    const qa = ux / (rx * wob), qb = uz / (rz * wob), q = qa * qa + qb * qb;
    if (q > 1) continue;
    for (let y = y0; y <= y1; y++) {
      let col = q > 0.82 ? (y === y1 ? C.rock3 : (rng() < 0.06 ? C.lichen : C.rock0)) : rockCol(x, y, z);
      if (top && y === y1 && q <= 0.82) {
        const path = Math.abs(x - 140 + 0.5 * Math.sin(z * 0.3)) < 3 && z > 92;
        col = path ? C.goldL : (rng() < 0.07 ? C.lichen : (rng() < 0.5 ? C.pine1 : C.pine2));
      }
      block(x, y, z, col);
    }
  }
}
ellipsoid(160, 56, 78, 5, 2.5, 4, C.pine0);
for (let i = 0; i < 7; i++) {
  const a = i * 0.9;
  beam(160 + 2 * Math.cos(a), 57, 78 + 1.5 * Math.sin(a), 160 + 4 * Math.cos(a), 63, 77 + 2 * Math.sin(a), 0.5, i % 2 ? C.gold : C.pine2);
}

// open pedestal nest
const NX = 84, NZ = 164, NY = 26;
cone(NX, NY, NZ, 12, 8, 12, C.mud);
for (let i = 0; i < 220; i++) {
  const a = rng() * 2 * PI, t = rng(), y = NY + 4 + R(t * 7), rr = 12 - (4 + t * 7) / 12 * 4 + 0.4;
  const c = rng();
  block(R(NX + rr * Math.cos(a)), y, R(NZ + rr * Math.sin(a)), c < 0.45 ? C.pine1 : (c < 0.75 ? C.mudD : C.gold));
}
ring(NX, NY + 12, NZ, 7.5, 1.3, C.gold, 'y');
for (let x = NX - 6; x <= NX + 6; x++) for (let z = NZ - 6; z <= NZ + 6; z++)
  if (Math.hypot(x - NX, z - NZ) <= 5.6) for (let y = NY + 9; y <= NY + 13; y++) block(x, y, z, null);
ellipsoid(NX, 40, NZ, 6, 5.5, 6, C.chick);
ellipsoid(NX, 39, NZ + 2, 4.5, 4, 4.5, C.chickL);
for (const [fx, fz] of [[96, 173], [70, 176], [99, 169]]) {
  const g = R(topH(fx, fz)) + 1;
  box(fx, g, fz, fx + 2, g, fz, C.white); block(fx + 3, g, fz + 1, C.white);
}

// stone for the feeding parent
for (let x = 98; x <= 114; x++) for (let z = 148; z <= 162; z++) {
  const q = ((x - 106) / 8.5) * ((x - 106) / 8.5) + ((z - 155) / 7.5) * ((z - 155) / 7.5);
  if (q <= 1) box(x, 24, z, x, q > 0.7 ? 32 : 33, z, q > 0.7 ? C.rock1 : C.rock2);
}

// driftwood perch stand
const PG = 28;
for (let x = 162; x <= 182; x++) for (let z = 149; z <= 168; z++) {
  const q = ((x - 172) / 10) * ((x - 172) / 10) + ((z - 158) / 9.5) * ((z - 158) / 9.5);
  if (q <= 1) box(x, 20, z, x, q > 0.6 ? PG - 1 : PG, z, q > 0.6 ? C.rock1 : C.rock2);
}
beam(165, PG + 1, 152, 171, PG + 30, 158, 1.8, C.wood);
beam(179, PG + 1, 152, 173, PG + 30, 158, 1.8, C.wood);
beam(172, PG + 1, 165, 172, PG + 30, 159.5, 1.8, C.woodD);
beam(170, PG + 16, 156, 166, PG + 22, 152, 1, C.woodD);
beam(151, PG + 33, 160, 193, PG + 34, 160, 2, C.wood);
beam(151, PG + 33, 160, 147, PG + 40, 158, 1, C.woodD);
beam(149, PG + 36, 159, 145, PG + 38, 163, 0.8, C.woodD);
beam(193, PG + 34, 160, 197, PG + 41, 162, 1, C.woodD);
beam(172, PG + 30, 158.5, 172, PG + 32, 160, 1.6, C.woodD);
ring(172, PG + 30, 158.5, 3.2, 0.9, C.rope, 'y');
ring(172, PG + 33.5, 160, 2.8, 0.8, C.rope, 'x');
ring(158, PG + 33.2, 160, 2.6, 0.7, C.rope, 'x');

// swaying tussocks (blades move)
function clump(x, z) {
  ellipsoid(x, 25, z, 5, 4, 5, C.pine0);
  for (let i = 0; i < 9; i++) {
    const a = i * 2 * PI / 9 + 0.3, len = 8 + (i % 3) * 2;
    beam(x + 2 * Math.cos(a), 28, z + 2 * Math.sin(a), x + 5 * Math.cos(a), 28 + len, z + 5 * Math.sin(a) - 2, 0.6, i % 2 ? M.grassY : M.grassG);
  }
}
clump(156, 192);
clump(64, 116);

// scattered tussocks and pebbles
function nearObj(x, z) {
  const pts = [[128, 90, 44], [84, 164, 16], [106, 155, 12], [172, 158, 16], [156, 192, 8], [64, 116, 8]];
  for (const [px, pz, pr] of pts) if (Math.hypot(x - px, z - pz) < pr) return true;
  return false;
}
for (let i = 0; i < 60; i++) {
  const a = rng() * 2 * PI, rr = rng();
  const x = R(CX + Math.cos(a) * rr * 72), z = R(CZ + Math.sin(a) * rr * 72);
  const d = Math.hypot(x - CX, z - CZ);
  if (d > rimR(Math.atan2(z - CZ, x - CX)) - 10 || nearObj(x, z)) continue;
  const g = R(topH(x, z));
  if (i % 3 === 0) { ellipsoid(x, g + 0.5, z, 1.6, 1.2, 1.4, C.rock3); continue; }
  ellipsoid(x, g + 1, z, 2.6, 2, 2.6, i % 2 ? C.pine0 : C.pine2);
  for (let j = 0; j < 3; j++) {
    const b = j * 2.1 + i;
    beam(x, g + 2, z, x + 2.5 * Math.cos(b), g + 6 + (j % 2), z + 2.5 * Math.sin(b) - 1, 0.5, j === 1 ? C.goldL : C.gold);
  }
}


// albatross builders in local bird coordinates (f forward, l lateral, y up)
function frame(ox, oy, oz, face) {
  const P = (f, l, y) => face === 'z' ? [ox + l, oy + y, oz + f] : (face === 'nx' ? [ox - f, oy + y, oz + l] : [ox + f, oy + y, oz + l]);
  const alongX = face !== 'z';
  return {
    E(f, l, y, rf, rl, ry, col) { const p = P(f, l, y); if (alongX) ellipsoid(p[0], p[1], p[2], rf, ry, rl, col); else ellipsoid(p[0], p[1], p[2], rl, ry, rf, col); },
    B(f0, l0, y0, f1, l1, y1, r, col) { const a = P(f0, l0, y0), b = P(f1, l1, y1); beam(a[0], a[1], a[2], b[0], b[1], b[2], r, col); },
    K(f, l, y, col) { const p = P(f, l, y); block(R(p[0]), R(p[1]), R(p[2]), col); }
  };
}
function birdBody(m, s, folded, webbed) {
  m.E(0, 0, 0, 15 * s, 8 * s, 7.5 * s, C.white);
  m.E(-2 * s, 0, 3.5 * s, 11 * s, 6.5 * s, 4.5 * s, C.mantle);
  m.E(-18 * s, 0, 1.5 * s, 5 * s, 3 * s, 1.6 * s, C.tail);
  if (folded) for (const sd of [-1, 1]) {
    m.E(-3 * s, sd * 5.5 * s, 1.5 * s, 12 * s, 2.6 * s, 4 * s, C.mantle);
    m.B(-12 * s, sd * 4 * s, 2 * s, -21 * s, sd * 1.2 * s, 3 * s, 1.3 * s, C.mantle);
  }
  if (webbed) for (const sd of [-1, 1]) {
    m.B(s, sd * 3.5 * s, -6 * s, s, sd * 3.5 * s, -10 * s, 1, C.leg);
    const fy = -R(11 * s), fl = R(sd * 3.5 * s), f0 = R(2 * s);
    for (let df = 0; df <= 5; df++) for (let dl = -Math.floor(df / 2); dl <= Math.floor(df / 2); dl++) m.K(f0 + df, fl + dl, fy, C.feet);
  }
}
function birdHead(m, s, H) {
  m.B(8 * s, 0, 4 * s, 13 * s, 0, 8 * s, 4.2 * s, H.w);
  m.E(15 * s, 0, 10 * s, 6 * s, 5 * s, 5 * s, H.w);
  for (const sd of [-1, 1]) {
    m.K(16 * s, sd * 5 * s, 10 * s, H.eye);
    m.B(14 * s, sd * 4.8 * s, 11.2 * s, 18 * s, sd * 4.4 * s, 11 * s, 0.6, H.brow);
    m.B(12 * s, sd * 4.6 * s, 10 * s, 15 * s, sd * 5 * s, 10 * s, 0.6, H.brow);
  }
  m.B(20 * s, 0, 9.5 * s, 30 * s, 0, 7 * s, 2.1 * s, H.bill);
  m.B(20 * s, 0, 11.3 * s, 25 * s, 0, 10.3 * s, 0.9, H.bill);
  m.B(30 * s, 0, 7 * s, 32 * s, 0, 6.2 * s, 1.3 * s, H.tip);
  m.K(32 * s, 0, 5 * s, H.tip);
}
function spreadWing(m, side, sf, sl, sy, span, rise, cs) {
  for (let i = 0; i <= span; i++) {
    const s = i / span, l = side * (sl + i);
    const le = s < 0.45 ? sf + (5 + (s / 0.45) * 3) * cs : sf + (8 - ((s - 0.45) / 0.55) * 6) * cs;
    const ch = (s < 0.45 ? 12 - (s / 0.45) * 2 : 10 - ((s - 0.45) / 0.55) * 7) * cs;
    const y = sy + R(rise * s), f1 = R(le), f0 = R(le - ch);
    for (let f = f0; f <= f1; f++) {
      m.K(f, l, y + 1, f === f1 ? M.wEdge : M.wTop);
      m.K(f, l, y, (f === f0 || s > 0.82) ? M.wEdge : M.wUnder);
    }
    if (s > 0.6 && i % 3 === 0) m.K(f0 - 1, l, y, M.wTop);
  }
}
const HEAD = { w: M.headW, eye: M.eye, brow: M.brow, bill: M.bill, tip: M.tip };

// adult spreading its wings into the wind at the table edge
const mb = frame(140, 66, 94, 'z');
birdBody(mb, 1, false, true);
birdHead(mb, 1, HEAD);
spreadWing(mb, -1, 3, 7, 4, 43, 3, 1);
spreadWing(mb, 1, 3, 7, 4, 43, 3, 1);

// mate sky-pointing on the back of the table
const mt = frame(108, 65, 80, 'nx');
birdBody(mt, 0.95, true, true);
birdHead(mt, 0.95, HEAD);

// parent bowing to feed the chick
const fd = frame(108, 45, 155, 'nx');
birdBody(fd, 1, true, true);
birdHead(fd, 1, HEAD);

// chick head (moving)
ellipsoid(84, 48, 165.5, 3.8, 3.5, 3.8, M.chickH);
beam(84, 48, 169, 84, 47.3, 171.5, 0.9, C.tail);
block(81, 49, 167, C.mantle); block(87, 49, 167, C.mantle);

// juvenile stretching on the perch branch
const jv = frame(181, 72, 160, 'z');
birdBody(jv, 0.75, false, false);
birdHead(jv, 0.75, { w: C.juv, eye: M.eye, brow: C.horn, bill: C.horn, tip: M.tip });
jv.E(8, 0, 4.5, 3.5, 4, 3, C.juv);
box(178, 65, 160, 179, 67, 161, C.leg); box(183, 65, 160, 184, 67, 161, C.leg);
box(177, 64, 158, 179, 64, 162, C.feet); box(183, 64, 158, 185, 64, 162, C.feet);
box(178, 62, 163, 179, 63, 163, C.feet); box(183, 62, 163, 184, 63, 163, C.feet);
spreadWing(jv, -1, 2, 6, 3, 28, 2, 0.75);
spreadWing(jv, 1, 2, 6, 3, 28, 2, 0.75);

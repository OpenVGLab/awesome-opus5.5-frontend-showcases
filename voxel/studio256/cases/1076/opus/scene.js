const R = Math.round, PI = Math.PI;
const C = {
  ivory: '#F2EBDC', ivoryD: '#E2D8C3', stone: '#D8CFBD', stoneD: '#BFB49E', cob: '#CBC1AE', cobD: '#B3A994', road: '#A9A193',
  wood: '#9A6B45', woodL: '#B98A5C', woodD: '#6E4B32', teal: '#7FAF9F', tealL: '#A9CDBF', tealD: '#5B8C7E',
  glass: '#4F6F69', glassL: '#9EC3BA', copper: '#C08A4A', copperL: '#DDAE6A',
  grass: '#9CC2A8', grassD: '#7AA68C', rail: '#8D8A84', tire: '#3E3530', bread: '#D29A55', breadD: '#B07A3E', crust: '#E3B874',
  skin: '#E3B99A', hair: '#5A4232', cloth1: '#6F9C8F', cloth2: '#B77A57', flower: '#F4E3B5'
};
function discZ(cx, cy, z0, z1, ro, ri, col) {
  const n = Math.ceil(ro) + 1, bx = R(cx), by = R(cy);
  for (let x = bx - n; x <= bx + n; x++) for (let y = by - n; y <= by + n; y++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= ro && d >= ri) box(x, y, z0, x, y, z1, col);
  }
}
function discX(cy, cz, x0, x1, ro, ri, col) {
  const n = Math.ceil(ro) + 1, by = R(cy), bz = R(cz);
  for (let y = by - n; y <= by + n; y++) for (let z = bz - n; z <= bz + n; z++) {
    const d = Math.hypot(y - cy, z - cz);
    if (d <= ro && d >= ri) box(x0, y, z, x1, y, z, col);
  }
}
function clear(x0, y0, z0, x1, y1, z1) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) block(x, y, z, null);
}
function person(x, y0, z, cloth, hairCol) {
  box(x, y0, z, x, y0 + 3, z, C.woodD); box(x + 1, y0, z, x + 1, y0 + 3, z, C.woodD);
  box(x, y0 + 4, z, x + 1, y0 + 8, z + 1, cloth);
  box(x, y0 + 9, z, x + 1, y0 + 10, z + 1, C.skin);
  box(x, y0 + 11, z, x + 1, y0 + 11, z + 1, hairCol || C.hair);
}
function crate(x0, y0, z0, x1, y1, z1) {
  box(x0, y0, z0, x1, y1, z1, C.woodL);
  box(x0, y1, z0, x1, y1, z0, C.woodD); box(x0, y1, z1, x1, y1, z1, C.woodD);
  box(x0, y1, z0, x0, y1, z1, C.woodD); box(x1, y1, z0, x1, y1, z1, C.woodD);
  box(x0, y0, z0, x0, y1, z0, C.woodD); box(x1, y0, z0, x1, y1, z0, C.woodD);
  box(x0, y0, z1, x0, y1, z1, C.woodD); box(x1, y0, z1, x1, y1, z1, C.woodD);
}

// ground: verge, tram street, platform, bus lane, curb, village square
for (let x = 24; x <= 232; x++) for (let z = 34; z <= 222; z++) {
  const qx = x < 34 ? 34 : (x > 222 ? 222 : x), qz = z < 44 ? 44 : (z > 212 ? 212 : z);
  if ((x - qx) * (x - qx) + (z - qz) * (z - qz) > 100) continue;
  let col, top = 6;
  const h = (x * 7 + z * 13) % 11;
  if (z <= 45) col = h < 2 ? C.grassD : (h === 5 ? C.flower : C.grass);
  else if (z <= 66) {
    col = ((x + (z % 2) * 2) % 4 === 0 || z % 3 === 0) ? C.cobD : C.cob;
    if (z === 54 || z === 63) col = C.rail;
    if (z === 55 || z === 62) col = C.cobD;
  } else if (z <= 81 && x >= 28 && x <= 142) {
    top = 8; col = (z === 67 || z === 81 || x === 28 || x === 142) ? C.stoneD : (((x >> 2) + (z >> 2)) % 2 ? C.stone : C.ivoryD);
  } else if (z <= 99) {
    col = C.road;
    if (x >= 88 && x <= 99 && z >= 82 && z <= 98 && x % 3 !== 0) col = C.ivory;
    if (z === 97 && x % 8 < 5) col = C.ivoryD;
  } else if (z <= 101) { top = 7; col = C.stoneD; }
  else {
    const sx = Math.floor((x - 24) / 8), sz = Math.floor((z - 102) / 8);
    col = ((x - 24) % 8 === 0 || (z - 102) % 8 === 0) ? C.stoneD : ((sx + sz) % 3 === 0 ? C.ivoryD : C.stone);
  }
  box(x, 4, z, x, top, z, col);
}
for (let x = 30; x <= 226; x += 8) box(x, 7, 37, x, 11, 37, C.woodD);
box(30, 10, 37, 226, 10, 37, C.wood);
for (let i = 0; i < 30; i++) {
  const x = 30 + R(rng() * 194), z = 39 + R(rng() * 5);
  block(x, 7, z, C.grassD); block(x, 8, z, rng() < 0.5 ? C.flower : C.copperL);
}

// catenary poles and contact wire
for (const px of [60, 180]) {
  box(px, 7, 42, px + 1, 44, 43, C.woodD);
  box(px, 43, 44, px + 1, 44, 60, C.woodD);
  box(px, 42, 58, px + 1, 42, 59, C.copper);
}
box(30, 42, 58, 226, 42, 58, C.copper);

// vintage tram car on the rails
const TX0 = 34, TX1 = 99, TZ0 = 52, TZ1 = 65;
for (let x = TX0; x <= TX1; x++) {
  const e = Math.min(x - TX0, TX1 - x), ins = e === 0 ? 2 : (e === 1 ? 1 : 0);
  const z0 = TZ0 + ins, z1 = TZ1 - ins;
  box(x, 11, z0, x, 12, z1, C.woodD);
  box(x, 13, z0, x, 15, z1, C.teal);
  box(x, 16, z0, x, 16, z1, C.copper);
  box(x, 17, z0, x, 25, z1, C.ivory);
  box(x, 26, z0, x, 27, z1, C.tealD);
  box(x, 28, z0 + 1, x, 28, z1 - 1, C.woodL);
  if (x >= TX0 + 2 && x <= TX1 - 2) box(x, 29, z0 + 2, x, 29, z1 - 2, C.woodL);
}
for (let x = 44; x <= 79; x += 7) for (const z of [TZ0, TZ1]) box(x, 18, z, x + 4, 24, z, C.glass);
for (const dx of [37, 90]) for (const z of [TZ0, TZ1]) {
  box(dx, 12, z, dx + 4, 25, z, C.wood); box(dx + 1, 18, z, dx + 3, 24, z, C.glass); block(dx + 3, 15, z, C.copperL);
}
for (const x of [TX0, TX1]) { box(x, 18, TZ0 + 3, x, 24, TZ1 - 3, C.glass); box(x, 26, TZ0 + 4, x, 26, TZ1 - 4, C.ivory); }
box(33, 14, 58, 33, 15, 59, C.copperL); box(100, 14, 58, 100, 15, 59, C.copperL);
box(33, 11, 55, 33, 12, 62, C.woodD); box(100, 11, 55, 100, 12, 62, C.woodD);
box(42, 30, 56, 91, 31, 61, C.ivory);
for (let x = 44; x <= 88; x += 4) { box(x, 30, 56, x + 1, 30, 56, C.glassL); box(x, 30, 61, x + 1, 30, 61, C.glassL); }
box(63, 32, 57, 69, 32, 60, C.woodD);
beam(64, 33, 58.5, 68, 37, 58.5, 0.7, C.rail);
beam(68, 37, 58.5, 65, 41, 58.5, 0.7, C.rail);
box(63, 41, 55, 67, 41, 62, C.copper);
for (const bx of [44, 89]) {
  box(bx - 7, 9, 55, bx + 7, 10, 62, C.woodD);
  for (const wx of [bx - 4, bx + 4]) for (const wz of [54, 63]) {
    discZ(wx, 10, wz, wz, 3, 0, C.tire); block(wx, 10, wz > 58 ? 64 : 53, C.copper);
  }
}

// tram and bus shelter on the platform
const SX0 = 56, SX1 = 82, SZ0 = 69, SZ1 = 79;
for (const [px, pz] of [[SX0, SZ0], [SX1, SZ0], [SX0, SZ1], [SX1, SZ1]]) box(px, 9, pz, px, 26, pz, C.woodD);
box(SX0 + 1, 9, SZ0, SX1 - 1, 9, SZ0, C.woodD);
box(SX0 + 1, 10, SZ0, SX1 - 1, 22, SZ0, C.glassL);
for (let x = SX0 + 7; x < SX1; x += 7) box(x, 9, SZ0, x, 23, SZ0, C.woodD);
box(SX0 + 1, 23, SZ0, SX1 - 1, 23, SZ0, C.woodD);
for (const x of [SX0, SX1]) { box(x, 10, SZ0 + 1, x, 22, SZ0 + 6, C.glassL); box(x, 23, SZ0 + 1, x, 23, SZ1 - 1, C.woodD); box(x, 9, SZ0 + 1, x, 9, SZ0 + 6, C.woodD); }
for (let z = SZ0 - 2; z <= SZ1 + 3; z++) {
  const t = (z - (SZ0 - 2)) / 15, y = 25 + R(2 * Math.sin(t * PI));
  box(SX0 - 2, y + 1, z, SX1 + 2, y + 1, z, C.ivory);
  block(SX0 - 2, y, z, C.tealD); block(SX1 + 2, y, z, C.tealD);
}
box(SX0 - 2, 25, SZ1 + 3, SX1 + 2, 25, SZ1 + 3, C.tealD);
box(SX0 + 3, 12, SZ0 + 2, SX1 - 3, 12, SZ0 + 4, C.wood);
box(SX0 + 3, 13, SZ0 + 1, SX1 - 3, 16, SZ0 + 1, C.woodL);
for (const x of [SX0 + 4, SX1 - 4]) box(x, 9, SZ0 + 3, x, 11, SZ0 + 3, C.woodD);
box(69, 24, 76, 69, 25, 76, C.copper); block(69, 23, 76, C.copperL);
box(63, 13, 71, 64, 17, 72, C.cloth2); box(63, 18, 71, 64, 19, 72, C.skin); box(63, 20, 71, 64, 20, 72, C.hair);
box(63, 12, 73, 64, 13, 75, C.woodD); box(63, 9, 75, 64, 11, 75, C.woodD);
person(75, 9, 76, C.cloth1);

// bicycle with a bread basket beside the shelter
function bikeWheel(cx, cy, z) {
  for (let x = cx - 4; x <= cx + 4; x++) for (let y = cy - 4; y <= cy + 4; y++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= 3.6 && d >= 2.7) block(x, y, z, C.tire);
  }
  line(cx - 2, cy, z, cx + 2, cy, z, C.rail); line(cx, cy - 2, z, cx, cy + 2, z, C.rail);
  block(cx, cy, z, C.copper);
}
bikeWheel(89, 12, 77); bikeWheel(97, 12, 77);
line(93, 12, 77, 92, 17, 77, C.tealD); line(92, 17, 77, 96, 17, 77, C.tealD);
line(93, 12, 77, 96, 16, 77, C.tealD); line(93, 12, 77, 89, 12, 77, C.tealD);
line(92, 17, 77, 89, 12, 77, C.tealD); line(96, 17, 77, 97, 12, 77, C.tealD);
line(96, 17, 77, 96, 19, 77, C.tealD);
box(96, 19, 75, 96, 19, 79, C.copper); block(95, 19, 75, C.woodD); block(95, 19, 79, C.woodD);
box(91, 18, 77, 93, 18, 77, C.woodD);
block(93, 12, 76, C.copper); block(93, 12, 78, C.copper);
line(92, 11, 78, 91, 9, 79, C.rail);
box(97, 17, 76, 99, 18, 78, C.wood);
beam(97, 19, 76.5, 100, 22, 76.5, 0.8, C.crust); beam(98, 19, 77.5, 99, 23, 77.5, 0.8, C.bread);

// single-deck commuter minibus at the bus bay (facing -x)
const BX0 = 100, BX1 = 141, BZ0 = 85, BZ1 = 97;
for (let x = BX0; x <= BX1; x++) {
  const e = Math.min(x - BX0, BX1 - x), ins = e === 0 ? 1 : 0;
  box(x, 10, BZ0 + ins, x, 13, BZ1 - ins, C.teal);
  box(x, 14, BZ0 + ins, x, 14, BZ1 - ins, C.copper);
  box(x, 15, BZ0 + ins, x, 23, BZ1 - ins, C.ivory);
  box(x, 24, BZ0 + 1 + ins, x, 24, BZ1 - 1 - ins, C.ivory);
  box(x, 25, BZ0 + 2, x, 25, BZ1 - 2, C.ivoryD);
}
for (let x = 104; x <= 139; x++) if ((x - 104) % 6 !== 5) { box(x, 16, BZ0, x, 21, BZ0, C.glass); box(x, 16, BZ1, x, 21, BZ1, C.glass); }
box(102, 11, BZ0, 106, 22, BZ0, C.glass); box(104, 11, BZ0, 104, 22, BZ0, C.ivoryD);
box(BX0, 15, 87, BX0, 22, 95, C.glass); box(BX1, 16, 87, BX1, 21, 95, C.glass);
box(99, 11, 86, 99, 12, 87, C.copperL); box(99, 11, 95, 99, 12, 96, C.copperL);
box(99, 9, 85, 99, 10, 97, C.woodD); box(142, 9, 85, 142, 10, 97, C.woodD);
box(98, 18, 84, 99, 19, 84, C.woodD); box(98, 18, 98, 99, 19, 98, C.woodD);
box(99, 19, 84, 101, 19, 84, C.woodD); box(99, 19, 98, 101, 19, 98, C.woodD);
box(118, 26, 89, 123, 26, 93, C.tealL);
for (const ax of [106, 134]) {
  for (let x = ax - 5; x <= ax + 5; x++) for (let y = 10; y <= 15; y++)
    if ((x - ax) * (x - ax) + (y - 10.5) * (y - 10.5) <= 23) for (const z of [BZ0, BZ0 + 1, BZ1 - 1, BZ1]) block(x, y, z, null);
  discZ(ax, 10.5, BZ0, BZ0 + 1, 3.5, 0, C.tire); discZ(ax, 10.5, BZ1 - 1, BZ1, 3.5, 0, C.tire);
  discZ(ax, 10.5, BZ0 - 1, BZ0 - 1, 1.8, 0, C.ivoryD); discZ(ax, 10.5, BZ1 + 1, BZ1 + 1, 1.8, 0, C.ivoryD);
}


function weave(x0, y0, z0, x1, y1, z1) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++)
    if (x === x0 || x === x1 || z === z0 || z === z1 || y === y0) block(x, y, z, (x + y + z) % 2 ? C.woodL : C.wood);
}

// box delivery van unloading flour at its open rear (facing -x)
const VZ0 = 138, VZ1 = 150;
box(42, 10, VZ0 + 1, 51, 16, VZ1 - 1, C.teal);
box(40, 10, VZ0 + 2, 41, 15, VZ1 - 2, C.teal);
box(45, 17, VZ0 + 1, 51, 23, VZ1 - 1, C.teal);
box(46, 24, VZ0 + 2, 51, 24, VZ1 - 2, C.tealD);
box(44, 17, VZ0 + 2, 44, 21, VZ1 - 2, C.glass);
box(45, 22, VZ0 + 2, 45, 23, VZ1 - 2, C.glass);
box(46, 18, VZ0 + 1, 50, 22, VZ0 + 1, C.glass); box(46, 18, VZ1 - 1, 50, 22, VZ1 - 1, C.glass);
box(39, 11, VZ0 + 2, 39, 12, VZ1 - 2, C.woodD);
box(39, 13, VZ0 + 2, 39, 14, VZ0 + 3, C.copperL); box(39, 13, VZ1 - 3, 39, 14, VZ1 - 2, C.copperL);
box(52, 11, VZ0, 73, 28, VZ1, C.ivory);
box(52, 14, VZ0, 73, 15, VZ0, C.tealL); box(52, 14, VZ1, 73, 15, VZ1, C.tealL);
box(52, 28, VZ0, 73, 28, VZ1, C.ivoryD);
clear(61, 12, VZ0 + 1, 73, 26, VZ1 - 1);
discZ(73, 27, VZ0, VZ1, 1.4, 0, C.ivoryD);
box(74, 10, VZ0 + 1, 75, 11, VZ1 - 1, C.woodD);
for (const [sx, sy, sz] of [[64, 13.5, 141.5], [64, 13.5, 146.5], [68, 13.5, 141.5], [64, 16.5, 144]]) ellipsoid(sx, sy, sz, 2.6, 1.8, 2.2, C.ivoryD);
crate(67, 12, 145, 71, 16, 149);
for (const ax of [46, 66]) {
  discZ(ax, 11, VZ0 - 1, VZ0, 4, 0, C.tire); discZ(ax, 11, VZ1, VZ1 + 1, 4, 0, C.tire);
  discZ(ax, 11, VZ0 - 2, VZ0 - 2, 2, 0, C.ivoryD); discZ(ax, 11, VZ1 + 2, VZ1 + 2, 2, 0, C.ivoryD);
}

// country bread van (facing +x): rounded bonnet, wood-slat body, barrel roof, serving hatch
const V0 = 156, V1 = 168, VC = 162;
for (const ax of [108, 127]) {
  discZ(ax, 11.5, 154, 155, 4.5, 0, C.tire); discZ(ax, 11.5, 169, 170, 4.5, 0, C.tire);
  discZ(ax, 11.5, 153, 153, 2.6, 0, C.ivory); discZ(ax, 11.5, 171, 171, 2.6, 0, C.ivory);
  box(ax, 11, 152, ax, 12, 152, C.copper); box(ax, 11, 172, ax, 12, 172, C.copper);
  for (let x = ax - 7; x <= ax + 7; x++) for (let y = 12; y <= 19; y++) {
    const d = Math.hypot(x - ax, y - 11.5);
    if (d >= 5.3 && d <= 6.6) { box(x, y, 152, x, y, 156, C.teal); box(x, y, 168, x, y, 172, C.teal); }
  }
}
box(102, 9, 158, 132, 11, 166, C.woodD);
box(115, 11, 152, 120, 11, 155, C.wood); box(115, 11, 169, 120, 11, 172, C.wood);
box(121, 12, V0, 127, 25, V1, C.teal);
box(121, 26, V0 + 1, 127, 26, V1 - 1, C.teal);
box(122, 27, V0 + 2, 126, 27, V1 - 2, C.tealD);
box(122, 19, V0, 126, 24, V0, C.glass); box(122, 19, V1, 126, 24, V1, C.glass);
box(127, 19, V0 + 1, 127, 24, V1 - 1, C.glass); box(127, 19, VC, 127, 24, VC, C.copper);
block(125, 17, V0 - 1, C.copper); block(125, 17, V1 + 1, C.copper);
for (let x = 128; x <= 134; x++) {
  const top = 19 - R((x - 128) / 3);
  box(x, 12, V0 + 2, x, top - 1, V1 - 2, C.teal);
  box(x, top, V0 + 3, x, top, V1 - 3, C.teal);
  block(x, top, VC, C.copper);
}
box(135, 12, 158, 135, 17, 166, C.copper);
for (let z = 159; z <= 165; z += 2) box(135, 13, z, 135, 16, z, C.woodD);
box(128, 13, 152, 134, 15, 155, C.teal); box(128, 13, 169, 134, 15, 172, C.teal);
for (const hz of [154, 170]) { discX(17, hz, 131, 133, 1.8, 0, C.copper); discX(17, hz, 134, 134, 1.2, 0, C.ivory); }
box(136, 10, 153, 136, 11, 171, C.copper);
block(124, 28, VC, C.woodD);
ellipsoid(124, 30, VC, 1.2, 1.2, 1.2, C.copper);

box(100, 12, V0, 120, 29, V1, C.wood);
for (let y = 12; y <= 29; y += 2) { box(100, y, V0, 120, y, V0, C.woodL); box(100, y, V1, 120, y, V1, C.woodL); box(100, y, V0, 100, y, V1, C.woodL); }
for (const [px, pz] of [[100, V0], [100, V1], [120, V0], [120, V1]]) box(px, 12, pz, px, 29, pz, C.ivory);
box(100, 13, V0, 120, 13, V0, C.copper); box(100, 13, V1, 120, 13, V1, C.copper);
clear(101, 13, V0 + 1, 119, 28, V1 - 1);
clear(104, 20, V1, 117, 27, V1);
clear(100, 14, V0 + 1, 100, 28, V1 - 1);
box(101, 13, V0 + 1, 119, 13, V1 - 1, C.woodD);
box(101, 19, V0 + 1, 119, 19, V0 + 4, C.woodL); box(101, 24, V0 + 1, 119, 24, V0 + 4, C.woodL);
for (let x = 102; x <= 118; x += 3) {
  ellipsoid(x, 20.6, V0 + 2.5, 1.3, 1, 1.3, C.bread);
  ellipsoid(x + 1, 25.6, V0 + 2.5, 1.3, 1, 1.3, C.breadD);
}
for (let x = 102; x <= 118; x += 4) beam(x, 14.5, V0 + 6, x + 2, 14.5, V1 - 2, 0.8, C.crust);
for (let z = V0 - 1; z <= V1 + 1; z++) {
  const yt = 30 + R(2.5 * Math.sin(PI * (z - (V0 - 1)) / (V1 - V0 + 2)));
  box(99, 30, z, 121, yt, z, C.ivory);
}
box(99, 30, V0 - 1, 121, 30, V0 - 1, C.tealD); box(99, 30, V1 + 1, 121, 30, V1 + 1, C.tealD);
for (const x of [102, 110, 118]) { box(x, 33, 158, x, 34, 158, C.copper); box(x, 33, 166, x, 34, 166, C.copper); box(x, 34, 158, x, 34, 166, C.copper); }
box(102, 34, 158, 118, 34, 158, C.copper); box(102, 34, 166, 118, 34, 166, C.copper);
weave(104, 35, 159, 108, 37, 165);
ellipsoid(106, 38, 161, 1.5, 1, 1.4, C.bread); ellipsoid(106, 38, 164, 1.5, 1, 1.4, C.breadD);
weave(112, 35, 159, 116, 37, 165);
box(112, 38, 159, 116, 38, 165, C.ivoryD);

// serving counter, striped hatch lifted as an awning, open rear doors
box(103, 19, V1 + 1, 118, 19, V1 + 3, C.woodL);
box(104, 17, V1 + 1, 104, 18, V1 + 1, C.woodD); box(117, 17, V1 + 1, 117, 18, V1 + 1, C.woodD);
for (const [lx, lz, c] of [[106, 170, C.bread], [109, 170.5, C.breadD], [115, 170, C.bread]]) ellipsoid(lx, 20.6, lz, 1.6, 1, 1.4, c);
beam(111, 20.3, 169.5, 113, 20.3, 171.5, 0.8, C.crust);
for (let i = 0; i <= 8; i++) {
  const y = 28 + R(i * 3 / 8), z = V1 + 1 + i;
  for (let x = 103; x <= 118; x++) block(x, y, z, Math.floor((x - 103) / 2) % 2 ? C.ivory : C.teal);
}
beam(103, 20, 171, 103, 30, 176, 0.6, C.copper); beam(118, 20, 171, 118, 30, 176, 0.6, C.copper);
for (const dz of [155, 169]) {
  box(94, 14, dz, 99, 28, dz, C.wood);
  for (let y = 14; y <= 28; y += 2) box(94, y, dz, 99, y, dz, C.woodL);
  box(94, 14, dz, 94, 28, dz, C.ivory); box(94, 28, dz, 99, 28, dz, C.ivory);
  block(99, 16, dz, C.copper); block(99, 26, dz, C.copper);
}

// hand trolley of bread crates and the baker between the two vans
box(83, 7, 156, 88, 7, 161, C.rail);
box(82, 7, 156, 82, 21, 156, C.rail); box(82, 7, 161, 82, 21, 161, C.rail); box(82, 21, 156, 82, 21, 161, C.rail);
discZ(83, 8, 155, 155, 1.5, 0, C.tire); discZ(83, 8, 162, 162, 1.5, 0, C.tire);
crate(83, 8, 156, 88, 12, 161); crate(83, 13, 156, 88, 17, 161);
ellipsoid(85, 18.6, 158, 1.4, 1, 1.3, C.bread); ellipsoid(86.5, 18.6, 159.8, 1.4, 1, 1.3, C.breadD);
person(79, 7, 158, C.ivory, C.ivory);
box(81, 15, 158, 81, 15, 159, C.skin);

// three-wheeled cargo carrier loaded with bread baskets
for (const [z0, z1] of [[177, 178], [186, 187]]) discZ(153, 10.5, z0, z1, 3.5, 0, C.tire);
discZ(153, 10.5, 176, 176, 1.6, 0, C.ivoryD); discZ(153, 10.5, 188, 188, 1.6, 0, C.ivoryD);
box(153, 10, 179, 153, 11, 185, C.woodD);
discZ(167, 10.5, 181, 183, 3.5, 0, C.tire);
discZ(167, 10.5, 180, 180, 1.6, 0, C.ivoryD); discZ(167, 10.5, 184, 184, 1.6, 0, C.ivoryD);
box(163, 13, 180, 168, 18, 184, C.teal);
box(165, 19, 181, 168, 19, 183, C.tealD);
box(163, 19, 182, 163, 20, 182, C.tealD);
box(163, 20, 177, 163, 20, 187, C.copper);
block(169, 16, 182, C.copperL);
box(154, 12, 181, 163, 13, 183, C.tealD);
box(159, 14, 181, 161, 15, 183, C.tealD); box(159, 16, 180, 161, 16, 184, C.woodD);
box(146, 15, 177, 157, 15, 187, C.woodD);
box(146, 16, 177, 157, 18, 177, C.wood); box(146, 16, 187, 157, 18, 187, C.wood);
box(146, 16, 178, 146, 18, 186, C.wood); box(157, 16, 178, 157, 18, 186, C.wood);
weave(147, 16, 178, 151, 20, 182); weave(152, 16, 178, 156, 20, 182); weave(147, 16, 183, 151, 19, 186);
ellipsoid(149, 21.5, 180, 1.5, 1, 1.4, C.bread); ellipsoid(154, 21.5, 180, 1.5, 1, 1.4, C.breadD);
beam(147.5, 20.4, 184, 150.5, 20.4, 185.5, 0.8, C.crust);
box(152, 19, 183, 156, 19, 186, C.ivoryD);
box(159, 17, 181, 160, 21, 182, C.cloth1);
box(159, 22, 181, 160, 23, 182, C.skin); box(159, 24, 181, 160, 24, 182, C.hair);
box(161, 20, 181, 162, 20, 182, C.cloth1);
box(161, 14, 181, 162, 16, 182, C.woodD);

// customers, crates, lamp, bench, planters, trees
person(106, 7, 180, C.cloth2);
person(112, 7, 181, C.cloth1, C.woodD);
crate(139, 7, 158, 144, 11, 163); crate(139, 12, 158, 144, 16, 163);
ellipsoid(141.5, 17.6, 160.5, 1.5, 1, 1.4, C.bread);
box(145, 7, 102, 148, 8, 105, C.copper);
box(146, 9, 103, 147, 30, 104, C.woodD);
box(145, 31, 102, 148, 34, 105, C.glassL);
box(145, 31, 102, 145, 34, 102, C.copper); box(148, 31, 105, 148, 34, 105, C.copper);
box(144, 35, 101, 149, 35, 106, C.copper); box(146, 36, 103, 147, 36, 104, C.copper);
box(160, 10, 110, 176, 10, 113, C.wood); box(160, 11, 113, 176, 14, 113, C.woodL);
box(160, 7, 110, 161, 9, 113, C.woodD); box(175, 7, 110, 176, 9, 113, C.woodD);
box(190, 7, 106, 206, 10, 114, C.wood);
box(191, 11, 107, 205, 11, 113, C.grassD);
for (let i = 0; i < 24; i++) block(191 + R(rng() * 14), 12, 107 + R(rng() * 6), rng() < 0.6 ? C.flower : C.copperL);
function tree(x, z) {
  box(x - 6, 7, z - 6, x + 6, 10, z + 6, C.wood);
  box(x - 5, 11, z - 5, x + 5, 11, z + 5, C.grassD);
  box(x, 12, z, x + 1, 26, z + 1, C.woodD);
  ellipsoid(x, 32, z, 10, 8, 10, C.teal);
  ellipsoid(x + 4, 36, z - 3, 6, 5, 6, C.tealL);
  ellipsoid(x - 4, 30, z + 4, 6, 4.5, 6, C.grassD);
}
tree(212, 196); tree(40, 200);

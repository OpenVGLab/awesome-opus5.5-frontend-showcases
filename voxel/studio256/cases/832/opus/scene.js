const R = Math.round, PI = Math.PI;
const C = {
  ivory: '#F3EDE0', ivoryD: '#E3DAC6', paper2: '#EFE6CF', paperT: '#DDEBE3', paperO: '#EBD9B8',
  stone: '#D6CFC0', stoneD: '#BDB4A2', stoneL: '#E4DED2',
  wood: '#8E6343', woodL: '#AE8058', woodD: '#5E4130', woodR: '#7A5238',
  teal: '#7FB2A3', tealL: '#A9CEC1', tealD: '#4F8577', tealG: '#B9D9D0',
  ink: '#23262A', inkS: '#4A5553', copper: '#C38B4C', copperL: '#E0B06C',
  pulp: '#E6EEE8', skin: '#E2B797', hair: '#3A2E28', cloth1: '#5E8F82', cloth2: '#9C7458', cloth3: '#E8E0CE', leaf: '#6E9C7E'
};
function discX(cy, cz, x0, x1, ro, ri, col) {
  const n = Math.ceil(ro) + 1, by = R(cy), bz = R(cz);
  for (let y = by - n; y <= by + n; y++) for (let z = bz - n; z <= bz + n; z++) {
    const d = Math.hypot(y - cy, z - cz);
    if (d <= ro && d >= ri) box(x0, y, z, x1, y, z, col);
  }
}
function discY(cx, cz, y0, y1, ro, ri, col) {
  const n = Math.ceil(ro) + 1, bx = R(cx), bz = R(cz);
  for (let x = bx - n; x <= bx + n; x++) for (let z = bz - n; z <= bz + n; z++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d <= ro && d >= ri) box(x, y0, z, x, y1, z, col);
  }
}
function clear(x0, y0, z0, x1, y1, z1) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) block(x, y, z, null);
}
function person(x, y0, z, cloth, hairCol) {
  box(x, y0, z, x, y0 + 4, z, C.woodD); box(x + 1, y0, z, x + 1, y0 + 4, z, C.woodD);
  box(x, y0 + 5, z, x + 1, y0 + 10, z + 1, cloth);
  box(x, y0 + 11, z, x + 1, y0 + 12, z + 1, C.skin);
  box(x, y0 + 13, z, x + 1, y0 + 13, z + 1, hairCol || C.hair);
}
function bundle(x0, y0, z0, x1, y1, z1, col) {
  box(x0, y0, z0, x1, y1, z1, col);
  const mx = R((x0 + x1) / 2), mz = R((z0 + z1) / 2);
  box(mx, y0, z0, mx, y1, z0, C.copper); box(mx, y0, z1, mx, y1, z1, C.copper); box(mx, y1, z0, mx, y1, z1, C.copper);
  box(x0, y1, mz, x1, y1, mz, C.copper);
}

// stone-paved lane with a pale path toward the tea kiosk
for (let x = 24; x <= 232; x++) for (let z = 30; z <= 222; z++) {
  const qx = x < 34 ? 34 : (x > 222 ? 222 : x), qz = z < 40 ? 40 : (z > 212 ? 212 : z);
  if ((x - qx) * (x - qx) + (z - qz) * (z - qz) > 100) continue;
  const sx = Math.floor((x - 24) / 9), sz = Math.floor((z - 30 + (sx % 2) * 4) / 9);
  let col = ((x - 24) % 9 === 0 || (z - 30 + (sx % 2) * 4) % 9 === 0) ? C.stoneD : ((sx * 3 + sz * 5) % 4 === 0 ? C.stoneL : C.stone);
  const t = (x - 80) / 100, pz = 102 + t * 50;
  if (t >= 0 && t <= 1 && Math.abs(z - pz) < 7 && col !== C.stoneD) col = C.stoneL;
  if ((x - qx) * (x - qx) + (z - qz) * (z - qz) > 64 || x <= 25 || x >= 231 || z <= 31 || z >= 221) col = C.stoneD;
  box(x, 4, z, x, 6, z, col);
}

// shop: stone plinth, plank floor, timber-framed walls
box(30, 7, 36, 128, 8, 98, C.stoneD);
box(32, 8, 38, 126, 8, 95, C.woodL);
for (let x = 34; x <= 124; x += 6) box(x, 8, 38, x, 8, 95, C.woodR);
box(34, 7, 99, 124, 7, 101, C.stoneD);
function timberWall(alongX, fixed, a0, a1, y0, y1) {
  for (let a = a0; a <= a1; a++) for (let y = y0; y <= y1; y++) {
    const post = (a - a0) % 16 === 0 || a === a1;
    const col = post || y === y0 || y === 26 || y >= y1 - 1 ? C.wood : C.ivory;
    for (let t = 0; t < 2; t++) { if (alongX) block(a, y, fixed + t, col); else block(fixed + t, y, a, col); }
  }
}
timberWall(true, 36, 30, 128, 9, 44);
timberWall(false, 30, 38, 98, 9, 44);
timberWall(false, 127, 38, 98, 9, 44);
clear(127, 9, 60, 128, 30, 73);
box(127, 9, 59, 128, 31, 59, C.woodD); box(127, 9, 74, 128, 31, 74, C.woodD); box(127, 31, 59, 128, 31, 74, C.woodD);
box(129, 31, 59, 129, 31, 74, C.woodD);
box(129, 24, 60, 129, 30, 66, C.ivory); box(129, 24, 67, 129, 30, 73, C.ivory);
box(129, 24, 60, 129, 24, 73, C.tealD);
for (let y = 19; y <= 35; y++) for (let z = 58; z <= 74; z++) {
  const d = Math.hypot(y - 27, z - 66);
  if (d > 6.6) continue;
  for (const x of [30, 31]) {
    if (d > 5.2) block(x, y, z, C.woodD);
    else block(x, y, z, ((y + z) % 3 === 0 || (y - z + 30) % 3 === 0) ? C.wood : null);
  }
}
for (const cx of [30, 63, 93, 126]) { box(cx, 9, 96, cx + 2, 44, 98, C.wood); box(cx - 1, 9, 95, cx + 3, 10, 99, C.stoneD); }
box(30, 42, 96, 128, 44, 98, C.wood);
for (const bx of [46, 78, 110]) box(bx, 43, 38, bx + 1, 44, 95, C.woodD);
for (let z = 38; z <= 98; z++) {
  const yTop = R(z >= 67 ? 45 + (106 - z) * 17 / 39 : 45 + (z - 30) * 17 / 37) - 1;
  if (yTop >= 45) { box(30, 45, z, 31, yTop, z, C.ivory); box(127, 45, z, 128, yTop, z, C.ivory); }
}

// teal tile roof with ridge and copper finials
for (let x = 24; x <= 134; x++) for (let z = 30; z <= 106; z++) {
  const y = R(z >= 67 ? 45 + (106 - z) * 17 / 39 : 45 + (z - 30) * 17 / 37);
  const edge = x === 24 || x === 134;
  box(x, y, z, x, y + 1, z, edge ? C.woodD : (x % 3 === 0 ? C.tealD : C.teal));
}
box(24, 44, 106, 134, 44, 106, C.woodD); box(24, 44, 30, 134, 44, 30, C.woodD);
box(24, 63, 66, 134, 65, 68, C.tealD);
box(21, 65, 66, 24, 67, 68, C.tealD); box(134, 65, 66, 137, 67, 68, C.tealD);
block(22, 68, 67, C.copper); block(136, 68, 67, C.copper);

// plain hanging signboard and paper lanterns
box(70, 41, 99, 70, 42, 99, C.copper); box(88, 41, 99, 88, 42, 99, C.copper);
box(66, 34, 99, 92, 40, 100, C.ivory);
box(66, 34, 99, 92, 34, 100, C.woodD); box(66, 40, 99, 92, 40, 100, C.woodD);
box(66, 34, 99, 66, 40, 100, C.woodD); box(92, 34, 99, 92, 40, 100, C.woodD);
for (const lx of [47, 111]) {
  box(lx, 41, 102, lx, 46, 102, C.woodD);
  box(lx - 1, 40, 101, lx + 1, 40, 103, C.copper);
  ellipsoid(lx, 36.5, 102, 2.6, 3.2, 2.6, C.ivory);
  box(lx - 1, 33, 101, lx + 1, 33, 103, C.copper);
}

// pulp vat with mould and deckle, craftsman
box(38, 9, 58, 58, 17, 74, C.wood);
clear(39, 10, 59, 57, 17, 73);
box(39, 10, 59, 57, 15, 73, C.pulp);
for (let i = 0; i < 40; i++) block(39 + R(rng() * 18), 15, 59 + R(rng() * 14), C.paperT);
box(38, 17, 58, 58, 17, 58, C.woodD); box(38, 17, 74, 58, 17, 74, C.woodD);
box(38, 17, 58, 38, 17, 74, C.woodD); box(58, 17, 58, 58, 17, 74, C.woodD);
box(37, 18, 63, 59, 18, 71, C.woodD);
clear(38, 18, 64, 58, 18, 70);
for (let x = 39; x <= 57; x += 2) box(x, 18, 64, x, 18, 70, C.tealL);
person(46, 9, 77, C.cloth1);
beam(46, 17, 77, 45, 18, 72, 0.7, C.cloth1); beam(47.5, 17, 77, 50, 18, 72, 0.7, C.cloth1);

// screw press over a post of wet sheets
box(37, 9, 42, 49, 9, 51, C.woodD);
box(39, 10, 43, 47, 20, 49, C.paperT);
for (let y = 11; y <= 20; y += 2) box(39, y, 49, 47, y, 49, C.pulp);
box(38, 21, 43, 48, 21, 50, C.wood);
box(36, 9, 44, 37, 34, 45, C.woodD); box(49, 9, 44, 50, 34, 45, C.woodD);
box(36, 32, 44, 50, 34, 45, C.wood);
box(43, 22, 44, 43, 31, 45, C.copper);
box(39, 29, 44, 47, 29, 45, C.woodL);

// drying boards with sheets, hanging sheets on lines
for (const x0 of [100, 108, 116]) {
  box(x0, 9, 49, x0 + 6, 9, 53, C.woodD);
  box(x0, 10, 51, x0 + 6, 34, 51, C.woodL);
  box(x0 + 1, 12, 50, x0 + 5, 32, 50, C.ivory);
  box(x0 + 1, 12, 52, x0 + 5, 32, 52, C.paper2);
}
for (const lz of [62, 74]) {
  box(72, 40, lz, 126, 40, lz, C.copper);
  box(78, 41, lz, 78, 42, lz, C.woodD); box(110, 41, lz, 110, 42, lz, C.woodD);
  for (let x = 74; x <= 120; x += 8) box(x, 31, lz, x + 5, 39, lz, (x / 8) % 2 ? C.paperO : C.ivory);
}

// counter with inkstone, ink sticks, brush rack; shopkeeper
box(96, 9, 84, 124, 18, 91, C.wood);
box(97, 11, 91, 123, 16, 91, C.teal);
box(95, 19, 83, 125, 19, 92, C.woodL);
box(99, 20, 85, 105, 20, 89, C.inkS); box(100, 20, 86, 101, 20, 87, C.ink);
for (const z of [85, 87, 89]) box(107, 20, z, 110, 20, z, C.ink);
box(112, 20, 86, 112, 26, 86, C.woodD); box(122, 20, 86, 122, 26, 86, C.woodD); box(112, 26, 86, 122, 26, 86, C.woodD);
for (let x = 113; x <= 121; x += 2) { box(x, 23, 86, x, 25, 86, x % 4 === 1 ? C.tealD : C.woodL); box(x, 21, 86, x, 22, 86, C.ink); }
box(114, 20, 89, 121, 21, 91, C.ivory); box(117, 22, 90, 118, 22, 90, C.copper);
person(110, 9, 79, C.cloth2);

// upright shelf of paper stacks, rolls and ink boxes against the back wall
box(62, 9, 38, 63, 41, 45, C.wood); box(93, 9, 38, 94, 41, 45, C.wood);
box(64, 9, 38, 92, 41, 38, C.woodD);
box(62, 41, 38, 94, 42, 45, C.wood);
const SY = [9, 16, 23, 30, 36, 41];
for (let s = 0; s < 5; s++) box(64, SY[s], 39, 92, SY[s], 45, C.woodL);
for (let s = 0; s < 5; s++) {
  const y0 = SY[s] + 1, hMax = SY[s + 1] - y0;
  let x = 65;
  while (x < 90) {
    const w = 4 + Math.floor(rng() * 3), t = rng(), x1 = Math.min(91, x + w - 1);
    if (t < 0.45) {
      const h = Math.max(2, Math.min(hMax, 2 + Math.floor(rng() * hMax)));
      const col = [C.ivory, C.paper2, C.paperT, C.paperO][Math.floor(rng() * 4)];
      box(x, y0, 40, x1, y0 + h - 1, 44, col);
      for (let yy = y0 + 1; yy < y0 + h; yy += 2) box(x, yy, 44, x1, yy, 44, C.ivoryD);
      box(R((x + x1) / 2), y0, 44, R((x + x1) / 2), y0 + h - 1, 44, C.copper);
    } else if (t < 0.8) {
      const col = rng() < 0.5 ? C.ivory : C.paperT;
      discX(y0 + 1.5, 41.5, x, x1, 1.6, 0, col);
      if (hMax >= 5) discX(y0 + 1.5, 44, x, x1, 1.4, 0, col);
      discX(y0 + 1.5, 41.5, x1, x1, 0.8, 0, C.ivoryD);
    } else {
      box(x, y0, 41, x1, y0 + 1, 44, C.woodR);
      box(x, y0 + 1, 44, x1, y0 + 1, 44, C.copper);
    }
    x = x1 + 2;
  }
}


function discZ(cx, cy, z0, z1, ro, ri, col) {
  const n = Math.ceil(ro) + 1, bx = R(cx), by = R(cy);
  for (let x = bx - n; x <= bx + n; x++) for (let y = by - n; y <= by + n; y++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= ro && d >= ri) box(x, y, z0, x, y, z1, col);
  }
}

// standalone display cabinet: drawers, glass-rimmed tray of ink sticks, inkstone, brushes, seals
for (const [lx, lz] of [[41, 113], [70, 113], [41, 124], [70, 124]]) box(lx, 7, lz, lx + 1, 9, lz + 1, C.woodD);
box(40, 10, 112, 72, 15, 126, C.wood);
for (const [x0, x1] of [[42, 55], [57, 70]]) { box(x0, 11, 126, x1, 14, 126, C.teal); block(R((x0 + x1) / 2), 13, 127, C.copper); }
box(39, 16, 111, 73, 16, 127, C.woodL);
box(40, 17, 112, 72, 18, 112, C.tealG); box(40, 17, 126, 72, 18, 126, C.tealG);
box(40, 17, 113, 40, 18, 125, C.tealG); box(72, 17, 113, 72, 18, 125, C.tealG);
box(41, 17, 113, 71, 20, 114, C.woodL);
for (let x = 43; x <= 69; x += 4) { box(x, 21, 113, x + 1, 23, 114, C.ink); box(x, 24, 113, x + 1, 24, 114, C.copper); }
box(43, 17, 116, 49, 17, 122, C.inkS);
box(43, 18, 116, 49, 18, 116, C.inkS); box(43, 18, 122, 49, 18, 122, C.inkS);
box(43, 18, 117, 43, 18, 121, C.inkS); box(49, 18, 117, 49, 18, 121, C.inkS);
box(44, 17, 117, 48, 17, 118, C.ink);
box(52, 17, 116, 53, 18, 122, C.ink); box(55, 17, 116, 56, 18, 122, C.ink);
block(52, 18, 119, C.copperL); block(55, 18, 119, C.copperL);
box(59, 17, 115, 70, 17, 119, C.woodR);
for (let z = 116; z <= 118; z++) { box(60, 18, z, 68, 18, z, C.woodL); block(69, 18, z, C.ink); }
box(60, 17, 121, 61, 19, 122, C.tealD); box(60, 20, 121, 61, 20, 122, C.copper);
box(63, 17, 121, 64, 18, 122, C.woodR); box(63, 19, 121, 64, 19, 122, C.copper);
box(66, 17, 120, 70, 18, 124, C.paperO); box(66, 19, 122, 70, 19, 122, C.copper);
person(56, 7, 131, C.cloth3);

// tiered pickup rack with wrapped orders
for (let k = 0; k < 4; k++) {
  const yt = 10 + 5 * k, zf = 120 - 3 * k;
  box(96, 7, 108, 97, yt, zf, C.wood); box(125, 7, 108, 126, yt, zf, C.wood);
  box(98, yt, zf - 2, 124, yt, zf, C.woodL);
  for (let x = 99; x <= 119; x += 7) {
    if ((x + k) % 3 === 0) {
      discX(yt + 2, zf - 1, x, x + 4, 1.4, 0, C.paperT);
      discX(yt + 2, zf - 1, x, x, 1.4, 0, C.tealD); discX(yt + 2, zf - 1, x + 4, x + 4, 1.4, 0, C.tealD);
    } else bundle(x, yt + 1, zf - 2, x + 4, yt + 3, zf, k % 2 ? C.ivory : C.paperO);
    block(x + 2, yt - 1, zf, C.woodL);
  }
}
box(98, 7, 108, 124, 27, 108, C.woodD);
box(96, 26, 108, 126, 27, 110, C.wood);
person(118, 7, 124, C.cloth1);
bundle(117, 14, 126, 120, 16, 127, C.ivory);

// pallet jack delivering fiber bales through the side door
box(131, 7, 62, 135, 12, 72, C.tealD);
box(136, 7, 62, 154, 8, 64, C.tealD); box(136, 7, 70, 154, 8, 72, C.tealD);
block(153, 7, 63, C.ink); block(153, 7, 71, C.ink);
beam(132, 12, 67, 126, 22, 67, 0.8, C.tealD);
box(124, 22, 64, 126, 23, 70, C.copper);
box(138, 7, 60, 154, 8, 61, C.woodD); box(138, 7, 66, 154, 8, 68, C.woodD); box(138, 7, 73, 154, 8, 74, C.woodD);
box(138, 9, 60, 154, 9, 74, C.woodL);
for (let x = 140; x <= 152; x += 3) box(x, 9, 60, x, 9, 74, C.woodD);
for (const [x0, z0] of [[139, 61], [139, 68], [146, 61]]) {
  box(x0, 10, z0, x0 + 6, 15, z0 + 5, C.woodR);
  for (let i = 0; i < 12; i++) block(x0 + R(rng() * 6), 10 + R(rng() * 5), z0 + (rng() < 0.5 ? 0 : 5), C.woodL);
  box(x0 + 2, 15, z0, x0 + 2, 15, z0 + 5, C.copper);
  box(x0 + 2, 10, z0, x0 + 2, 15, z0, C.copper); box(x0 + 2, 10, z0 + 5, x0 + 2, 15, z0 + 5, C.copper);
}
box(146, 10, 68, 153, 15, 73, C.ivoryD);
box(147, 12, 73, 150, 14, 73, C.teal);
box(141, 16, 63, 151, 19, 71, C.woodR);
box(146, 20, 63, 146, 20, 71, C.copper);
person(120, 9, 66, C.cloth2);
beam(121, 18, 67, 124, 22, 67, 0.7, C.cloth2);

// companion tea kiosk
box(162, 7, 94, 206, 8, 132, C.stoneD);
box(166, 9, 98, 202, 34, 99, C.wood);
box(166, 9, 100, 167, 34, 128, C.wood); box(201, 9, 100, 202, 34, 128, C.wood);
box(168, 9, 127, 200, 16, 128, C.wood);
box(170, 10, 128, 198, 15, 128, C.teal);
box(168, 31, 127, 200, 34, 128, C.wood);
box(184, 17, 127, 184, 30, 128, C.woodD);
box(169, 17, 128, 199, 17, 131, C.woodL);
for (let x = 168; x <= 200; x += 4) box(x, 9, 98, x, 34, 98, C.woodR);
for (let z = 101; z <= 127; z += 4) { box(166, 9, z, 166, 34, z, C.woodR); box(202, 9, z, 202, 34, z, C.woodR); }
box(166, 35, 98, 202, 37, 99, C.wood);
box(166, 35, 127, 202, 38, 128, C.wood);
for (let z = 100; z <= 126; z++) {
  const yTop = R(z >= 114 ? 35 + (136 - z) * 0.5 : 35 + (z - 92) * 0.5) - 1;
  if (yTop >= 35) { box(166, 35, z, 167, yTop, z, C.ivory); box(201, 35, z, 202, yTop, z, C.ivory); }
}
for (let x = 160; x <= 208; x++) for (let z = 92; z <= 136; z++) {
  const y = R(z >= 114 ? 35 + (136 - z) * 0.5 : 35 + (z - 92) * 0.5);
  box(x, y, z, x, y + 1, z, (x === 160 || x === 208) ? C.woodD : (x % 3 === 0 ? C.tealD : C.teal));
}
box(160, 34, 136, 208, 34, 136, C.woodD); box(160, 34, 92, 208, 34, 92, C.woodD);
box(160, 47, 113, 208, 49, 115, C.tealD);
block(159, 49, 114, C.copper); block(209, 49, 114, C.copper);
for (let i = 0; i <= 13; i++) {
  const y = 31 - R(i * 4 / 13), z = 129 + i;
  for (let x = 166; x <= 202; x++) block(x, y, z, Math.floor((x - 166) / 3) % 2 ? C.ivory : C.teal);
}
box(166, 7, 142, 166, 26, 142, C.woodD); box(202, 7, 142, 202, 26, 142, C.woodD);
for (const lx of [174, 184, 194]) {
  box(lx, 25, 138, lx, 27, 138, C.woodD);
  box(lx - 1, 21, 137, lx + 1, 24, 139, C.ivory);
  box(lx - 1, 20, 137, lx + 1, 20, 139, C.copper);
}
box(169, 20, 100, 199, 20, 103, C.woodL); box(169, 26, 100, 199, 26, 103, C.woodL);
for (let x = 170; x <= 196; x += 4) {
  box(x, 21, 101, x + 2, 23, 102, x % 8 < 4 ? C.teal : C.tealD); box(x, 24, 101, x + 2, 24, 102, C.copper);
  box(x, 27, 101, x + 2, 28, 102, C.paperO);
}
box(172, 9, 106, 178, 14, 112, C.inkS);
ellipsoid(175, 16.5, 109, 2.5, 2, 2.5, C.copper);
beam(177, 17, 109, 179, 18.5, 109, 0.6, C.copper);
block(175, 19, 109, C.copperL);
person(186, 9, 118, C.cloth1);
box(172, 18, 129, 177, 19, 131, C.paperO);
box(190, 18, 129, 191, 19, 130, C.ivory); box(193, 18, 129, 194, 19, 130, C.ivory);
box(180, 18, 129, 182, 18, 131, C.woodR); box(180, 19, 130, 182, 19, 130, C.ink);

// dining table and chairs under a parasol; customers practising brushwork over tea
discY(184, 172, 17, 18, 9, 0, C.woodL);
discY(184, 172, 17, 17, 9, 8.2, C.wood);
box(183, 8, 171, 185, 16, 173, C.woodD);
discY(184, 172, 7, 7, 4, 0, C.woodD);
for (const [cx, cz, bx, bz] of [[170, 172, -1, 0], [198, 172, 1, 0], [184, 158, 0, -1], [184, 186, 0, 1]]) {
  box(cx - 2, 12, cz - 2, cx + 2, 12, cz + 2, C.wood);
  box(cx - 2, 13, cz - 2, cx + 2, 13, cz + 2, C.teal);
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) box(cx + dx, 7, cz + dz, cx + dx, 11, cz + dz, C.woodD);
  if (bx) box(cx + 2 * bx, 14, cz - 2, cx + 2 * bx, 21, cz + 2, C.wood);
  else box(cx - 2, 14, cz + 2 * bz, cx + 2, 21, cz + 2 * bz, C.wood);
}
ellipsoid(181, 20.5, 169, 2.2, 1.8, 2.2, C.tealL);
beam(183, 20.5, 169, 185, 22, 169, 0.6, C.tealL);
block(181, 23, 169, C.copper);
box(186, 19, 166, 187, 20, 167, C.ivory); box(177, 19, 171, 178, 20, 172, C.ivory);
box(182, 19, 174, 188, 19, 179, C.ivory);
for (const [ix, iz] of [[184, 175], [185, 176], [186, 176], [185, 177], [184, 178], [187, 177]]) block(ix, 19, iz, C.ink);
box(178, 19, 176, 180, 19, 178, C.inkS);
beam(186, 20, 178, 190, 20, 180, 0.5, C.woodL); block(185, 20, 177, C.ink);
box(184, 19, 172, 184, 42, 172, C.woodD);
for (let x = 163; x <= 205; x++) for (let z = 151; z <= 193; z++) {
  const d = Math.hypot(x - 184, z - 172);
  if (d > 20.5) continue;
  const sector = Math.floor((Math.atan2(z - 172, x - 184) + PI) / (PI / 4));
  block(x, 43 - R(d * 0.18), z, d > 19.5 ? C.tealD : (sector % 2 ? C.teal : C.ivory));
}
block(184, 44, 172, C.copper);
box(170, 14, 171, 171, 19, 172, C.cloth2); box(170, 20, 171, 171, 21, 172, C.skin); box(170, 22, 171, 171, 22, 172, C.hair);
box(172, 12, 171, 174, 13, 172, C.woodD); box(174, 7, 171, 174, 11, 172, C.woodD);
beam(171.5, 18, 172, 175, 19.5, 174, 0.6, C.cloth2);
box(183, 14, 185, 184, 19, 186, C.cloth1); box(183, 20, 185, 184, 21, 186, C.skin); box(183, 22, 185, 184, 22, 186, C.hair);
box(183, 12, 182, 184, 13, 184, C.woodD); box(183, 7, 182, 184, 11, 182, C.woodD);

// outdoor drying frame, handcart of paper rolls, potted bamboo
for (const px of [32, 78]) { beam(px, 7, 154, px, 30, 160, 0.9, C.woodD); beam(px, 7, 166, px, 30, 160, 0.9, C.woodD); }
box(32, 29, 160, 78, 30, 160, C.woodL);
for (let x = 35; x <= 72; x += 7) box(x, 20, 160, x + 5, 28, 160, [C.ivory, C.paperT, C.paperO][(x / 7) % 3 | 0]);
box(100, 12, 182, 122, 13, 194, C.wood);
box(100, 14, 182, 122, 15, 182, C.woodR); box(100, 14, 194, 122, 15, 194, C.woodR);
discZ(111, 11.5, 180, 181, 4.5, 2.8, C.woodD); discZ(111, 11.5, 195, 196, 4.5, 2.8, C.woodD);
discZ(111, 11.5, 180, 196, 1, 0, C.woodD);
beam(100, 13, 184, 90, 16, 184, 0.8, C.woodR); beam(100, 13, 192, 90, 16, 192, 0.8, C.woodR);
box(101, 7, 184, 101, 11, 184, C.woodD); box(101, 7, 192, 101, 11, 192, C.woodD);
discX(15.5, 185, 102, 120, 1.8, 0, C.ivory); discX(15.5, 189, 102, 120, 1.8, 0, C.paperT);
discX(18.5, 187, 102, 120, 1.8, 0, C.paperO);
box(106, 14, 184, 106, 20, 190, C.copper); box(116, 14, 184, 116, 20, 190, C.copper);
function bamboo(x, z) {
  discY(x, z, 7, 12, 4, 0, C.ivoryD);
  discY(x, z, 12, 12, 3.3, 0, C.woodD);
  for (const [dx, dz, h] of [[-1, -1, 26], [1, 0, 32], [0, 1, 22], [-1, 1, 29]]) {
    box(x + dx, 13, z + dz, x + dx, 13 + h, z + dz, C.leaf);
    for (let y = 18; y < 13 + h; y += 5) block(x + dx, y, z + dz, C.tealD);
    ellipsoid(x + dx * 3, 13 + h - 1, z + dz * 3, 3.5, 2, 3.5, dx > 0 ? C.tealL : C.leaf);
  }
}
bamboo(145, 112); bamboo(216, 150);

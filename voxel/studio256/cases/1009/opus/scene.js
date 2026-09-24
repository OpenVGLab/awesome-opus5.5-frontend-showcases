const R = Math.round, PI = Math.PI;
const C = {
  sand: '#D9C6A2', sand2: '#CDB78F', sand3: '#BEA37C', sandL: '#E6D6B6',
  terra: '#B5553A', terraD: '#96432E', terraL: '#CB7453',
  green: '#3E5641', greenD: '#2E4232', greenL: '#5A735C',
  steel: '#8F948B', steelD: '#5F645E', brass: '#C49A48',
  wood: '#9A7550', woodD: '#7A5A3C', rope: '#B59E74', belt: '#4B3B2F',
  coal: '#2A2622', ember: '#D8612C', ember2: '#EFA13C', anvil: '#3B403C'
};
const M = {
  fly: '#47624B', hub: '#80847A', crk: '#A94C34', xh: '#949C8E', rod: '#D5D1C3', pst: '#6E8A69',
  cr: '#C26C46', crb: '#CFA656', drum: '#A0704A', wrap: '#C6B086', car: '#4D6751',
  crate: '#BE9260', crate2: '#8C6642', cw1: '#34473A', spk1: '#FFC75C', spk2: '#FF8F3C'
};

function clear(x0, y0, z0, x1, y1, z1) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) block(x, y, z, null);
}
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
function discY(cx, cz, y0, y1, ro, ri, col) {
  const n = Math.ceil(ro) + 1, bx = R(cx), bz = R(cz);
  for (let x = bx - n; x <= bx + n; x++) for (let z = bz - n; z <= bz + n; z++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d <= ro && d >= ri) box(x, y0, z, x, y1, z, col);
  }
}
function spokesZ(cx, cy, z0, z1, r0, r1, n, a0, rad, col) {
  for (let k = 0; k < n; k++) {
    const a = a0 + 2 * PI * k / n, c = Math.cos(a), s = Math.sin(a);
    for (let z = z0; z <= z1; z++) beam(cx + r0 * c, cy + r0 * s, z, cx + r1 * c, cy + r1 * s, z, rad, col);
  }
}
function teethZ(cx, cy, z0, z1, r, h, n, a0, col) {
  for (let k = 0; k < n; k++) {
    const a = a0 + 2 * PI * k / n, c = Math.cos(a), s = Math.sin(a);
    for (let rr = r; rr <= r + h; rr += 0.5) for (let w = -0.7; w <= 0.71; w += 0.7) {
      const x = R(cx + rr * c - w * s), y = R(cy + rr * s + w * c);
      box(x, y, z0, x, y, z1, col);
    }
  }
}
function beltZ(c1x, c1y, r1, c2x, c2y, r2, z0, z1, col) {
  const dx = c2x - c1x, dy = c2y - c1y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const sb = (r1 - r2) / d, cb = Math.sqrt(1 - sb * sb);
  for (const sg of [1, -1]) {
    const nx = sb * ux - sg * cb * uy, ny = sb * uy + sg * cb * ux;
    const ax = c1x + r1 * nx, ay = c1y + r1 * ny, bx = c2x + r2 * nx, by = c2y + r2 * ny;
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, x = R(ax + (bx - ax) * t), y = R(ay + (by - ay) * t);
      box(x, y, z0, x, y, z1, col);
    }
  }
  for (let i = 0; i < 360; i++) {
    const a = i * PI / 180, vx = Math.cos(a), vy = Math.sin(a), dot = vx * ux + vy * uy;
    if (dot <= sb) { const x = R(c1x + r1 * vx), y = R(c1y + r1 * vy); box(x, y, z0, x, y, z1, col); }
    if (dot >= sb) { const x = R(c2x + r2 * vx), y = R(c2y + r2 * vy); box(x, y, z0, x, y, z1, col); }
  }
}
function crate(x0, y0, z0, x1, y1, z1, a, b) {
  box(x0, y0, z0, x1, y1, z1, a);
  for (const [xa, za] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(xa, y0, za, xa, y1, za, b);
  const my = R((y0 + y1) / 2);
  for (const yy of [y0, my, y1]) {
    box(x0, yy, z0, x1, yy, z0, b); box(x0, yy, z1, x1, yy, z1, b);
    box(x0, yy, z0, x0, yy, z1, b); box(x1, yy, z0, x1, yy, z1, b);
  }
}

// courtyard paving
const FX0 = 28, FX1 = 228, FZ0 = 42, FZ1 = 214, FR = 14;
function inFloor(x, z, inset) {
  const x0 = FX0 + inset, x1 = FX1 - inset, z0 = FZ0 + inset, z1 = FZ1 - inset, r = FR - inset;
  if (x < x0 || x > x1 || z < z0 || z > z1) return false;
  const cx = x < x0 + r ? x0 + r : (x > x1 - r ? x1 - r : x);
  const cz = z < z0 + r ? z0 + r : (z > z1 - r ? z1 - r : z);
  return (x - cx) * (x - cx) + (z - cz) * (z - cz) <= r * r;
}
for (let x = FX0; x <= FX1; x++) for (let z = FZ0; z <= FZ1; z++) {
  if (!inFloor(x, z, 0)) continue;
  if (!inFloor(x, z, 3)) { box(x, 4, z, x, 7, z, C.sand3); continue; }
  const tx = Math.floor((x - FX0) / 12), zz = z - FZ0 + (tx % 2) * 6, tz = Math.floor(zz / 12);
  const grout = (x - FX0) % 12 === 0 || zz % 12 === 0;
  const col = grout ? C.sand3 : ((tx * 7 + tz * 3) % 5 === 0 ? C.sand2 : ((tx + tz) % 3 === 0 ? C.sandL : C.sand));
  box(x, 4, z, x, 6, z, col);
}

// double-acting air pump: open iron bed
const PY = 50, PZ = 92, KX = 100;
box(107, 7, 83, 185, 8, 105, C.sand3);
box(108, 9, 84, 184, 12, 104, C.sand2);
box(108, 7, 82, 118, 10, 84, C.sand2);
box(114, 13, 88, 182, 16, 100, C.green);
box(114, 32, 88, 182, 37, 100, C.green);
for (const px of [114, 131, 148, 165, 177]) box(px, 17, 88, px + 5, 31, 100, C.green);
box(120, 17, 93, 176, 31, 95, C.greenD);
for (let x = 116; x <= 180; x += 6) { block(x, 37, 88, C.steelD); block(x, 37, 100, C.steelD); }

// cylinder with front cutaway
discX(PY, PZ, 149, 176, 12, 10, C.terra);
discX(PY, PZ, 151, 152, 12.9, 10, C.terraD);
discX(PY, PZ, 173, 174, 12.9, 10, C.terraD);
discX(PY, PZ, 146, 148, 14, 0, C.green);
discX(PY, PZ, 177, 179, 14, 0, C.green);
discX(PY, PZ, 180, 181, 6, 0, C.greenL);
for (let k = 0; k < 12; k++) {
  const a = 2 * PI * k / 12, y = R(PY + 12.5 * Math.sin(a)), z = R(PZ + 12.5 * Math.cos(a));
  block(145, y, z, C.steel); block(180, y, z, C.steel);
}
clear(154, 41, PZ + 3, 171, 59, PZ + 13);

// valve chests at both ends
for (const vx of [150, 169]) {
  box(vx, 60, PZ - 6, vx + 6, 66, PZ + 6, C.green);
  box(vx - 1, 67, PZ - 7, vx + 7, 67, PZ + 7, C.greenL);
  for (const bz of [PZ - 6, PZ + 6]) { block(vx - 1, 68, bz, C.steel); block(vx + 7, 68, bz, C.steel); }
  discZ(vx + 3, 63, PZ + 7, PZ + 8, 1.6, 0, C.steel);
  discZ(vx + 3, 63, PZ + 9, PZ + 9, 3.2, 0, C.brass);
  ellipsoid(vx + 3, 63, PZ + 10, 3, 3, 1.3, C.brass);
  cylinder(vx + 3, 68, PZ, 2, 11, C.greenD);
  cylinder(vx + 3, 73, PZ, 3, 1, C.brass);
}
beam(153, 79, PZ, 172, 79, PZ, 2.2, C.greenD);

// stuffing box, guide bars
discX(PY, PZ, 140, 145, 4.3, 0, C.greenL);
discX(PY, PZ, 141, 142, 5.3, 0, C.brass);
box(140, PY + 5, PZ - 4, 145, PY + 6, PZ + 4, C.green);
box(140, PY - 7, PZ - 4, 145, PY - 6, PZ + 4, C.green);
clear(138, PY - 1, PZ - 1, 148, PY + 1, PZ + 1);
box(114, PY + 5, PZ - 4, 139, PY + 6, PZ + 4, C.steel);
box(114, PY - 7, PZ - 4, 139, PY - 6, PZ + 4, C.steel);
box(114, PY - 7, PZ - 5, 117, PY + 6, PZ - 5, C.green);
box(114, PY - 7, PZ + 5, 117, PY + 6, PZ + 5, C.green);
box(115, 38, PZ - 4, 118, PY - 8, PZ + 4, C.green);
box(134, 38, PZ - 4, 137, PY - 8, PZ + 4, C.green);

// crank bearing pedestal
box(82, 7, 74, 118, 10, 82, C.sand2);
beam(87, 10, 78, 97, 46, 78, 2.5, C.green);
beam(113, 10, 78, 103, 46, 78, 2.5, C.green);
box(93, 20, 77, 107, 22, 79, C.green);
box(93, 43, 76, 107, 56, 80, C.green);
discZ(KX, PY, 76, 80, 7.5, 0, C.greenD);
cylinder(KX, 57, 78, 1, 4, C.brass);

// air receiver and piping
const TX = 163, TZ = 66;
discY(TX, TZ, 7, 9, 10.5, 0, C.greenD);
discY(TX, TZ, 10, 49, 9, 0, C.green);
ellipsoid(TX, 49, TZ, 9, 7, 9, C.green);
discY(TX, TZ, 20, 21, 9.6, 0, C.greenL);
discY(TX, TZ, 38, 39, 9.6, 0, C.greenL);
cylinder(TX, 55, TZ, 2, 25, C.greenD);
beam(TX, 79, PZ, TX, 79, TZ, 2.2, C.greenD);
cylinder(157, 54, 62, 1, 4, C.brass);
beam(157, 58, 62, 150, 58, 62, 0.8, C.steelD);
ellipsoid(150, 57, 62, 1.6, 1.6, 1.6, C.steelD);
discX(42, TZ, 172, 172, 3.4, 0, C.brass);
discX(42, TZ, 173, 173, 2.6, 0, C.sandL);
block(174, 42, TZ, C.greenD); block(174, 43, TZ, C.greenD);
discX(16, TZ, 153, 154, 3, 0, C.brass);
beam(153, 16, TZ, 146, 16, TZ, 1.8, C.greenD);
beam(146, 16, TZ, 146, 8, TZ, 1.8, C.greenD);
discY(146, TZ, 7, 8, 3.2, 0, C.brass);

// belt transmission stand
const SX = 52, SY = 78;
box(30, 7, 62, 74, 10, 69, C.terraD);
box(30, 7, 82, 74, 10, 89, C.terraD);
box(31, 7, 69, 35, 9, 82, C.terraD);
box(69, 7, 69, 73, 9, 82, C.terraD);
for (const zc of [65.5, 85.5]) {
  beam(35, 11, zc, 50, 75, zc, 2, C.terra);
  beam(69, 11, zc, 54, 75, zc, 2, C.terra);
  beam(40, 34, zc, 64, 34, zc, 1.6, C.terraL);
}
box(46, 72, 63, 58, 83, 68, C.green);
box(46, 72, 83, 58, 83, 88, C.green);
cylinder(52, 84, 65, 1, 3, C.brass);
cylinder(52, 84, 85, 1, 3, C.brass);
box(36, 28, 66, 40, 32, 86, C.terraD);
box(64, 28, 66, 68, 32, 86, C.terraD);
box(29, 7, 90, 75, 13, 96, C.green);
box(29, 14, 89, 75, 14, 97, C.greenL);
for (let x = 32; x <= 72; x += 4) box(x, 9, 97, x + 1, 11, 97, C.greenD);
box(58, 7, 74, 62, 12, 78, C.greenD);
cylinder(60, 13, 76, 1, 3, C.brass);


// pump crank group: axle, belt pulley, flywheel, crank disk, crank pin
discZ(KX, PY, 68, 90, 2, 0, M.hub);
discZ(KX, PY, 70, 74, 10, 7.5, M.crk);
discZ(KX, PY, 69, 74, 3.5, 0, M.hub);
spokesZ(KX, PY, 72, 72, 3, 8, 5, 0.3, 1.2, M.crk);
discZ(KX, PY, 83, 86, 20, 16.5, M.fly);
discZ(KX, PY, 82, 87, 4.5, 0, M.hub);
spokesZ(KX, PY, 84, 85, 4, 17, 6, 0, 1.4, M.fly);
discZ(KX, PY, PZ - 4, PZ - 3, 10, 0, M.crk);
for (let x = KX - 11; x <= KX - 3; x++) for (let y = PY - 11; y <= PY + 11; y++) {
  const d = Math.hypot(x - KX, y - PY);
  if (d <= 10.5 && d >= 3) block(x, y, PZ - 5, M.crk);
}
discZ(KX + 6, PY, PZ - 5, PZ - 2, 1.5, 0, M.hub);

// crosshead, piston rod, piston
box(126, PY - 4, PZ - 4, 135, PY + 4, PZ + 4, M.xh);
clear(126, PY - 4, PZ - 1, 133, PY + 4, PZ + 1);
box(136, PY - 1, PZ - 1, 166, PY + 1, PZ + 1, M.rod);
discX(PY, PZ, 167, 170, 9, 0, M.pst);
discX(PY, PZ, 168, 169, 9, 7.6, M.xh);

// connecting rod
box(109, PY - 1, PZ - 1, 127, PY + 1, PZ + 1, M.cr);
discZ(130, PY, PZ - 1, PZ + 1, 3, 0, M.cr);
discZ(KX + 6, PY, PZ - 1, PZ + 1, 3.6, 0, M.cr);
discZ(KX + 6, PY, PZ - 1, PZ + 1, 1.5, 0, M.crb);
discZ(130, PY, PZ - 1, PZ + 1, 1.2, 0, M.crb);

// stand shaft, small pulley, big drive wheel
discZ(SX, SY, 62, 94, 2, 0, M.hub);
discZ(SX, SY, 70, 74, 5, 0, M.crk);
for (let k = 0; k < 3; k++) {
  const a = 2 * PI * k / 3, x = R(SX + 3 * Math.cos(a)), y = R(SY + 3 * Math.sin(a));
  block(x, y, 70, M.fly); block(x, y, 74, M.fly);
}
discZ(SX, SY, 90, 93, 18, 15, M.fly);
discZ(SX, SY, 89, 94, 3.5, 0, M.hub);
spokesZ(SX, SY, 91, 92, 3, 16, 8, 0.2, 1.3, M.crk);

// belts
beltZ(KX, PY, 11, SX, SY, 6, 70, 74, C.belt);
for (let z = 90; z <= 93; z++) {
  box(SX - 19, 14, z, SX - 19, SY, z, C.belt);
  box(SX + 19, 14, z, SX + 19, SY, z, C.belt);
  for (let i = 0; i <= 180; i++) { const a = i * PI / 180; block(R(SX + 19 * Math.cos(a)), R(SY + 19 * Math.sin(a)), z, C.belt); }
}

// forge hearth fed by the pump line
function brickCol(u, y) {
  if (y % 4 === 3) return C.sand3;
  if ((u + (Math.floor(y / 4) % 2) * 3) % 6 === 0) return C.sand3;
  return (u * 7 + y * 3) % 5 === 0 ? C.terraD : C.terra;
}
for (let y = 7; y <= 28; y++) {
  for (let x = 40; x <= 70; x++) { block(x, y, 148, brickCol(x, y)); block(x, y, 178, brickCol(x, y)); }
  for (let z = 149; z <= 177; z++) { block(40, y, z, brickCol(z, y)); block(70, y, z, brickCol(z, y)); }
}
box(50, 10, 179, 60, 18, 179, C.anvil);
box(54, 14, 180, 56, 14, 180, C.brass);
box(38, 29, 146, 72, 32, 180, C.sand2);
box(38, 32, 146, 72, 32, 146, C.sandL); box(38, 32, 180, 72, 32, 180, C.sandL);
box(38, 32, 146, 38, 32, 180, C.sandL); box(72, 32, 146, 72, 32, 180, C.sandL);
clear(46, 31, 154, 64, 32, 172);
box(46, 29, 154, 64, 31, 172, C.coal);
for (let i = 0; i < 70; i++) {
  const x = 47 + Math.floor(rng() * 17), z = 155 + Math.floor(rng() * 17);
  block(x, Math.hypot(x - 55, z - 163) < 5 ? 32 : 31, z, rng() < 0.55 ? C.ember : C.ember2);
}
ellipsoid(55, 31, 163, 4, 1.5, 4, C.ember);
for (const [px, pz] of [[40, 148], [69, 148], [40, 177], [69, 177]]) box(px, 33, pz, px + 1, 54, pz + 1, C.green);
for (let y = 55; y <= 66; y++) {
  const w = R(17 - (y - 55) * 10 / 11), col = y === 55 ? C.greenL : C.green;
  const x0 = 55 - w, x1 = 55 + w, z0 = 163 - w, z1 = 163 + w;
  box(x0, y, z0, x1, y, z0 + 1, col); box(x0, y, z1 - 1, x1, y, z1, col);
  box(x0, y, z0, x0 + 1, y, z1, col); box(x1 - 1, y, z0, x1, y, z1, col);
}
discY(55, 163, 67, 96, 7, 5, C.greenD);
discY(55, 163, 80, 81, 7.8, 5, C.terra);
discY(55, 163, 97, 98, 8.6, 5, C.green);
discY(80, 170, 7, 8, 3.2, 0, C.brass);
cylinder(80, 7, 170, 2, 13, C.greenD);
beam(80, 19, 170, 71, 19, 170, 2, C.greenD);
discX(19, 170, 71, 72, 3.2, 0, C.brass);
discZ(80, 14, 173, 173, 2.6, 1.5, C.terra);
beam(80, 14, 171, 80, 14, 173, 0.8, C.steelD);

// rising sparks (flow)
const SP = [[0, 0, 1], [2, -1, 4], [-2, 1, 8], [1, 2, 11], [-1, -2, 15], [2, 1, 18], [-2, -1, 20]];
for (const base of [9, 31]) for (const [dx, dz, dy] of SP) {
  const col = dy % 2 ? M.spk1 : M.spk2;
  block(55 + dx, base + dy, 163 + dz, col);
  if (dy % 4 === 0) block(55 + dx, base + dy + 1, 163 + dz, col);
}

// anvil on stump
discY(88, 158, 7, 16, 6, 0, C.woodD);
discY(88, 158, 16, 16, 6, 4.8, C.wood);
box(84, 17, 155, 92, 19, 161, C.anvil);
box(86, 20, 156, 90, 22, 160, C.anvil);
box(82, 23, 155, 95, 27, 161, C.anvil);
beam(95, 25.5, 158, 101, 26.5, 158, 2, C.anvil);
beam(101, 26.5, 158, 104, 27, 158, 0.9, C.anvil);
box(83, 27, 156, 94, 27, 160, C.steel);
box(85, 28, 157, 91, 28, 157, C.woodD);
box(89, 28, 156, 91, 30, 158, C.steelD);

// coal bin
box(34, 7, 112, 56, 15, 130, C.wood);
for (let x = 34; x <= 56; x += 4) { box(x, 7, 112, x, 15, 112, C.woodD); box(x, 7, 130, x, 15, 130, C.woodD); }
box(35, 15, 113, 55, 16, 129, C.coal);
ellipsoid(45, 16, 121, 9, 3.5, 7, C.coal);
beam(50, 17, 124, 54, 27, 119, 0.8, C.woodD);
box(48, 15, 124, 51, 18, 127, C.steelD);

// hand-crank winch stand
const WX = 126, WY = 26;
box(110, 7, 162, 114, 10, 204, C.terraD);
box(138, 7, 162, 142, 10, 204, C.terraD);
box(110, 7, 164, 142, 8, 167, C.terra);
box(110, 7, 198, 142, 8, 201, C.terra);
for (const zc of [167, 197]) {
  beam(113, 11, zc, 123, 28, zc, 1.6, C.green);
  beam(139, 11, zc, 129, 28, zc, 1.6, C.green);
  beam(116, 16, zc, 136, 16, zc, 1.2, C.green);
  discZ(WX, WY, zc - 1, zc + 1, 4.5, 0, C.greenD);
}
beam(126, 30, 197, 126, 40, 197, 1.6, C.green);
beam(120, 29, 197, 124, 40, 197, 1.2, C.green);
beam(132, 29, 197, 128, 40, 197, 1.2, C.green);
discZ(WX, 42, 196, 198, 3.2, 0, C.greenD);
// drum, flanges, gear (moving)
discZ(WX, WY, 163, 202, 1.5, 0, M.hub);
discZ(WX, WY, 172, 192, 6, 0, M.drum);
for (let z = 174; z <= 190; z++) discZ(WX, WY, z, z, 6.8, 5.6, z % 2 ? M.wrap : M.drum);
discZ(WX, WY, 170, 171, 9, 0, M.car);
discZ(WX, WY, 193, 194, 9, 0, M.car);
for (let k = 0; k < 6; k++) {
  const a = 2 * PI * k / 6, x = R(WX + 7.6 * Math.cos(a)), y = R(WY + 7.6 * Math.sin(a));
  block(x, y, 169, M.hub); block(x, y, 195, M.hub);
}
discZ(WX, WY, 200, 201, 12, 0, M.car);
teethZ(WX, WY, 200, 201, 12, 1.6, 18, 0, M.car);
for (let k = 0; k < 5; k++) {
  const a = 2 * PI * k / 5 + 0.3, hx = WX + 7 * Math.cos(a), hy = WY + 7 * Math.sin(a);
  for (let x = R(hx) - 3; x <= R(hx) + 3; x++) for (let y = R(hy) - 3; y <= R(hy) + 3; y++)
    if (Math.hypot(x - hx, y - hy) <= 2.2) { block(x, y, 200, null); block(x, y, 201, null); }
}
discZ(WX, WY, 199, 202, 3, 0, M.hub);
// pinion and crank handle (moving)
discZ(WX, 42, 200, 201, 4, 0, M.fly);
teethZ(WX, 42, 200, 201, 4, 1.6, 6, PI / 6, M.fly);
discZ(WX, 42, 196, 204, 1.2, 0, M.fly);
box(WX, 41, 203, WX + 10, 43, 204, M.fly);
discZ(WX, 42, 203, 204, 2.5, 0, M.fly);
discZ(WX + 10, 42, 203, 204, 2, 0, M.fly);
discZ(WX + 10, 42, 205, 210, 1.4, 0, M.crate2);
// hoisting rope from drum to lift sheave box
beam(121.2, 30.4, 182, 197, 112, 149, 0.9, C.rope);

// cargo lift frame
for (const [px, pz] of [[182, 124], [219, 124], [182, 165], [219, 165]]) {
  box(px - 1, 7, pz - 1, px + 4, 10, pz + 4, C.sand2);
  box(px, 11, pz, px + 3, 104, pz + 3, C.terra);
  for (let y = 20; y <= 96; y += 19) box(px, y, pz, px + 3, y, pz + 3, C.terraD);
}
box(182, 101, 124, 222, 104, 127, C.terra);
box(182, 101, 165, 222, 104, 168, C.terra);
box(182, 101, 128, 185, 104, 164, C.terra);
box(219, 101, 128, 222, 104, 164, C.terra);
box(186, 101, 145, 218, 104, 150, C.terraD);
beam(186, 14, 125.5, 218, 98, 125.5, 1.3, C.terraD);
beam(186, 98, 125.5, 218, 14, 125.5, 1.3, C.terraD);
box(183, 7, 145, 185, 9, 150, C.sand2);
box(219, 7, 145, 221, 9, 150, C.sand2);
box(184, 10, 146, 185, 100, 149, C.steel);
box(219, 10, 146, 220, 100, 149, C.steel);
for (const [bx, bz] of [[190, 132], [211, 132], [190, 157], [211, 157]]) {
  box(bx, 7, bz, bx + 3, 10, bz + 3, C.sand3); box(bx, 11, bz, bx + 3, 11, bz + 3, C.steelD);
}
// sheave box on top of the lift
box(195, 105, 141, 209, 105, 155, C.terra);
box(196, 106, 142, 208, 106, 154, C.greenD);
box(196, 107, 142, 196, 127, 154, C.green);
box(208, 107, 142, 208, 127, 154, C.green);
box(197, 107, 142, 207, 127, 142, C.green);
box(197, 107, 154, 207, 127, 154, C.green);
for (let y = 128; y <= 134; y++) {
  const hw = Math.floor(Math.sqrt(49 - (y - 127) * (y - 127)));
  box(196, y, 148 - hw, 208, y, 148 + hw, C.greenD);
}
discX(118, 148, 194, 195, 3, 0, C.steel);
discX(118, 148, 209, 210, 3, 0, C.steel);
clear(200, 101, 146, 203, 106, 149);


// lift car (moving)
box(187, 12, 129, 217, 14, 163, M.drum);
for (let x = 191; x <= 213; x += 5) box(x, 14, 129, x, 14, 163, M.crate2);
box(187, 15, 146, 189, 51, 149, M.car);
box(215, 15, 146, 217, 51, 149, M.car);
box(187, 48, 146, 217, 51, 149, M.car);
box(199, 52, 146, 204, 54, 149, M.car);
box(201, 55, 147, 202, 106, 148, M.wrap);
for (const sy of [16, 44]) { box(186, sy, 146, 186, sy + 2, 149, M.car); box(218, sy, 146, 218, sy + 2, 149, M.car); }
box(187, 15, 129, 188, 26, 130, M.car); box(216, 15, 129, 217, 26, 130, M.car); box(201, 15, 129, 202, 26, 130, M.car);
box(187, 25, 129, 217, 26, 130, M.car);
crate(191, 15, 132, 203, 26, 143, M.crate, M.crate2);
crate(205, 15, 132, 213, 23, 140, M.crate, M.crate2);
discY(196, 157, 15, 24, 4.5, 0, M.crate2);
discY(196, 157, 17, 17, 4.9, 0, M.hub); discY(196, 157, 22, 22, 4.9, 0, M.hub);
box(205, 15, 153, 214, 16, 154, M.hub); box(205, 15, 156, 214, 16, 157, M.hub); box(205, 15, 159, 214, 16, 160, M.hub);
box(206, 17, 153, 207, 18, 161, M.hub); box(209, 17, 153, 210, 18, 161, M.hub); box(212, 17, 153, 213, 18, 161, M.hub);

// rope from lift sheave box to the counterweight tower
beam(203, 120, 142, 206, 141, 81, 0.9, C.rope);

// independent counterweight tower
box(188, 7, 56, 224, 9, 92, C.sand3);
box(190, 10, 58, 222, 12, 90, C.sand2);
for (const [px, pz] of [[192, 60], [217, 60], [192, 85], [217, 85]]) {
  box(px, 13, pz, px + 3, 128, pz + 3, C.green);
  box(px - 1, 13, pz - 1, px + 4, 15, pz + 4, C.greenD);
}
box(192, 125, 60, 220, 128, 63, C.green);
box(192, 125, 85, 220, 128, 88, C.green);
box(192, 125, 64, 195, 128, 84, C.green);
box(217, 125, 64, 220, 128, 84, C.green);
box(196, 125, 67, 216, 128, 69, C.green);
box(196, 125, 78, 216, 128, 80, C.green);
for (const [ya, yb] of [[16, 70], [70, 124]]) {
  beam(193.5, ya, 64, 193.5, yb, 84, 1.2, C.terraD); beam(193.5, ya, 84, 193.5, yb, 64, 1.2, C.terraD);
  beam(218.5, ya, 64, 218.5, yb, 84, 1.2, C.terraD); beam(218.5, ya, 84, 218.5, yb, 64, 1.2, C.terraD);
  beam(196, ya, 61.5, 216, yb, 61.5, 1.2, C.terraD); beam(196, yb, 61.5, 216, ya, 61.5, 1.2, C.terraD);
}
box(196, 100, 85, 216, 102, 88, C.green);
box(196, 13, 73, 197, 124, 75, C.steel);
box(215, 13, 73, 216, 124, 75, C.steel);
box(196, 122, 70, 197, 124, 78, C.green);
box(215, 122, 70, 216, 124, 78, C.green);
box(199, 129, 66, 213, 129, 82, C.terra);
box(200, 130, 67, 212, 130, 81, C.greenD);
box(200, 131, 67, 200, 150, 81, C.green); box(212, 131, 67, 212, 150, 81, C.green);
box(201, 131, 67, 211, 150, 67, C.green); box(201, 131, 81, 211, 150, 81, C.green);
for (let y = 151; y <= 157; y++) {
  const hw = Math.floor(Math.sqrt(56.25 - (y - 150) * (y - 150)));
  box(200, y, 74 - hw, 212, y, 74 + hw, C.greenD);
}
discX(142, 74, 198, 199, 3, 0, C.steel);
discX(142, 74, 213, 214, 3, 0, C.steel);
clear(204, 125, 72, 207, 130, 75);

// counterweight stack (moving)
for (let i = 0; i < 6; i++) {
  const y0 = 58 + i * 4;
  box(199, y0, 67, 213, y0 + 2, 81, M.cw1);
  if (i < 5) box(200, y0 + 3, 68, 212, y0 + 3, 80, M.car);
}
box(205, 57, 73, 206, 83, 74, M.car);
box(203, 81, 73, 208, 84, 74, M.cw1);
box(205, 85, 73, 206, 146, 74, M.wrap);
for (const gx of [198, 214]) { box(gx, 60, 72, gx, 64, 76, M.cw1); box(gx, 74, 72, gx, 78, 76, M.cw1); }

// workbench with vise and tools
box(112, 22, 122, 150, 24, 138, C.wood);
for (const [lx, lz] of [[113, 123], [147, 123], [113, 135], [147, 135]]) box(lx, 7, lz, lx + 2, 21, lz + 2, C.woodD);
box(114, 11, 124, 148, 12, 136, C.woodD);
box(141, 25, 132, 148, 28, 137, C.green);
box(141, 29, 131, 143, 32, 138, C.green);
box(146, 29, 131, 148, 32, 138, C.green);
beam(149, 27, 134.5, 153, 27, 134.5, 0.8, C.steelD);
beam(117, 25, 126, 131, 25, 131, 0.8, C.steelD);
beam(118, 25, 131, 131, 25, 127, 0.8, C.steelD);
box(122, 25, 133, 130, 25, 134, C.woodD);
box(129, 25, 132, 131, 27, 135, C.steelD);
discY(120, 130, 13, 16, 2, 0, C.brass);
discY(126, 130, 13, 15, 2.5, 0, C.greenD);
discY(140, 128, 13, 17, 2, 0, C.terra);

// crates of stock waiting for the lift, sacks
crate(150, 7, 186, 164, 20, 200, C.wood, C.woodD);
crate(166, 7, 184, 177, 16, 195, C.wood, C.woodD);
crate(152, 21, 188, 162, 29, 198, C.woodD, C.wood);
for (let i = 0; i < 4; i++) box(167, 17, 186 + i * 2, 177, 17, 186 + i * 2, C.steelD);
box(169, 18, 186, 170, 18, 192, C.steelD);
box(174, 18, 186, 175, 18, 192, C.steelD);
ellipsoid(200, 12, 191, 6, 4.6, 5, C.sandL);
ellipsoid(211, 11, 196, 5, 4.5, 5, C.sand2);
block(200, 17, 191, C.woodD); block(211, 16, 196, C.woodD);

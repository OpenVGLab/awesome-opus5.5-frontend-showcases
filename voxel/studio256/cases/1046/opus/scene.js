const R = Math.round, PI = Math.PI;
const C = {
  apron: '#D8CAA9', apron2: '#CFC09D', joint: '#B8A784', line: '#D4AE55',
  body: '#EDE3CD', belly: '#D5C5A4', terra: '#B5553A', terraD: '#96432E', glass: '#3F5B57',
  green: '#3E5641', greenD: '#2E4232', greenL: '#5A735C', boot: '#2F3D35',
  prop: '#2C3530', ptip: '#D9B96A', strut: '#A3A39A', tire: '#2A2A27', hub: '#BFB08F',
  sand: '#D9C6A2', sandD: '#BEA37C', light: '#F2D98A', amber: '#E8903A', red: '#B8412F',
  hose: '#26302A', skin: '#D9A77E', vest: '#D9B24E', coverall: '#34473A', hair: '#3B3029'
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
function discY(cx, cz, y0, y1, ro, ri, col) {
  const n = Math.ceil(ro) + 1, bx = R(cx), bz = R(cz);
  for (let x = bx - n; x <= bx + n; x++) for (let z = bz - n; z <= bz + n; z++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d <= ro && d >= ri) box(x, y0, z, x, y1, z, col);
  }
}

// apron slabs with guidance and restraint markings
for (let x = 30; x <= 230; x++) for (let z = 34; z <= 224; z++) {
  const qx = x < 42 ? 42 : (x > 218 ? 218 : x), qz = z < 46 ? 46 : (z > 212 ? 212 : z);
  if ((x - qx) * (x - qx) + (z - qz) * (z - qz) > 144) continue;
  let col = ((Math.floor((x - 30) / 25) + Math.floor((z - 34) / 25)) % 2) ? C.apron : C.apron2;
  if ((x - 30) % 25 === 0 || (z - 34) % 25 === 0) col = C.joint;
  if (Math.abs(z - 118) <= 1 && x >= 48 && x <= 226) col = C.line;
  if (x >= 205 && x <= 207 && Math.abs(z - 118) <= 9) col = C.line;
  const onRect = ((x === 132 || x === 222) && z >= 175 && z <= 206) || ((z === 175 || z === 206) && x >= 132 && x <= 222);
  if (onRect && (x + z) % 6 < 4) col = C.terra;
  if ((x - qx) * (x - qx) + (z - qz) * (z - qz) > 100 || x <= 31 || x >= 229 || z <= 35 || z >= 223) col = C.joint;
  box(x, 4, z, x, 6, z, col);
}

// fuselage shell (nose toward +x)
const FZ = 118;
function fus(x) {
  if (x < 70) { const t = (70 - x) / 30; return { r: 11 - 8 * t, cy: 24 + 8 * t * t }; }
  if (x > 185) { const t = (x - 185) / 27; return { r: 11 * Math.sqrt(1 - t * t * 0.92), cy: 24 - 3 * t }; }
  return { r: 11, cy: 24 };
}
for (let x = 40; x <= 212; x++) {
  const f = fus(x), r = f.r, cy = f.cy, n = Math.ceil(r) + 2, solid = x >= 206 || x <= 42;
  for (let y = R(cy) - n; y <= R(cy) + n; y++) for (let z = FZ - n; z <= FZ + n; z++) {
    const d = Math.hypot((y - cy) / 1.04, z - FZ);
    if (d > r || (!solid && d < r - 2.2)) continue;
    let col = y < cy - 5 ? C.belly : C.body;
    const yc = R(cy);
    if (y >= yc + 1 && y <= yc + 2 && x > 62 && x < 194) col = C.terra;
    if (y >= yc + 4 && y <= yc + 5 && x >= 80 && x <= 176 && (x - 80) % 6 < 3 && Math.abs(z - FZ) > 7) col = C.glass;
    if (x >= 193 && x <= 203 && y >= yc + 2 && y <= yc + 6 && y < cy + r - 1.5) col = C.glass;
    if (z > FZ + 6 && x >= 74 && x <= 80 && y >= 14 && y <= 30 && (x === 74 || x === 80 || y === 14 || y === 30)) col = C.terraD;
    block(x, y, z, col);
  }
}
ellipsoid(213, 21, FZ, 2.5, 2.5, 2.5, C.belly);
ellipsoid(137, 37, FZ, 16, 3, 8, C.body);
for (let x = 74; x <= 92; x++) box(x, 35, FZ - 1, x, 35 + R((92 - x) / 18 * 7), FZ + 1, C.body);
box(160, 36, FZ, 160, 39, FZ, C.greenD); box(158, 39, FZ, 162, 39, FZ, C.greenD);

// high wing with dark de-icing boots
for (let z = 17; z <= 219; z++) {
  const dz = Math.abs(z - FZ);
  let le = 146 - dz * 0.03, te = 128 + dz * 0.04;
  if (dz > 96) { le -= (dz - 96) * 0.9; te += (dz - 96) * 0.9; }
  const yb = 35 + R(dz * 0.02), th = dz < 60 ? 3 : 2;
  const x0 = R(te), x1 = R(le);
  for (let x = x0; x <= x1; x++) for (let k = 0; k < th; k++) {
    let col = k === th - 1 ? C.body : C.belly;
    if (x >= x1 - 1) col = C.boot;
    else if (x <= x0 + 3 && k === th - 1) col = (dz % 24 === 0 || x === x0 + 3) ? C.sandD : C.body;
    block(x, yb + k, z, col);
  }
  if (dz >= 100) block(R((te + le) / 2), yb, z, z < FZ ? C.terra : C.green);
}
box(140, 35, 189, 142, 35, 191, C.greenD);

// engine nacelles and six-blade propellers
for (const nz of [76, 160]) {
  for (let x = 116; x <= 166; x++) {
    let r = 5.5;
    if (x < 128) r = 2 + (x - 116) * 0.29;
    if (x > 158) r = 5.5 - (x - 158) * 0.18;
    discX(29, nz, x, x, r, 0, x > 161 ? C.belly : C.body);
  }
  box(157, 22, nz - 2, 163, 24, nz + 2, C.boot);
  box(138, 29, nz + 5, 146, 31, nz + 6, C.boot);
  discX(29, nz, 150, 151, 5.8, 0, C.terra);
  ellipsoid(168, 29, nz, 3.2, 3, 3, C.belly);
  for (let k = 0; k < 6; k++) {
    const a = PI / 12 + k * PI / 3, c = Math.cos(a), s = Math.sin(a);
    beam(167, 29 + 3 * s, nz + 3 * c, 167, 29 + 13.5 * s, nz + 13.5 * c, 1.3, C.prop);
    beam(167, 29 + 13.5 * s, nz + 13.5 * c, 167, 29 + 16 * s, nz + 16 * c, 1.2, C.ptip);
  }
}

// main gear in sponsons, nose gear
for (const sz of [107, 129]) ellipsoid(136, 18, sz, 15, 4.5, 5.5, C.belly);
for (const [a0, a1, b0, b1, face] of [[127, 129, 131, 133, 133], [103, 105, 107, 109, 103]]) {
  discZ(136, 11.5, a0, a1, 4.5, 2.4, C.tire); discZ(136, 11.5, b0, b1, 4.5, 2.4, C.tire);
  discZ(136, 11.5, a0, b1, 2.4, 0, C.hub);
  box(135, 12, R((a1 + b0) / 2), 137, 18, R((a1 + b0) / 2), C.strut);
  block(136, 11, face + (face > FZ ? 1 : -1), C.greenD);
}
discZ(196, 10.5, 114, 116, 3.5, 1.6, C.tire); discZ(196, 10.5, 120, 122, 3.5, 1.6, C.tire);
discZ(196, 10.5, 114, 122, 1.6, 0, C.hub);
box(196, 11, 117, 196, 15, 119, C.strut);

// T-tail
for (let y = 32; y <= 70; y++) {
  const t = (y - 32) / 38, xl = R(74 - t * 22), xt = R(44 - t * 8);
  const col = (y >= 60 && y <= 63) ? C.terra : C.green;
  box(xt, y, FZ - 1, xl, y, FZ + 1, col);
  block(xl, y, FZ, C.greenD);
}
for (let z = 86; z <= 150; z++) {
  const dz = Math.abs(z - FZ), le = R(53 - dz * 0.1), te = R(38 + dz * 0.12);
  for (let x = te; x <= le; x++) box(x, 71, z, x, 72, z, x >= le - 1 ? C.boot : C.body);
}

// chocks and cones
for (const [x, z0, z1] of [[129, 126, 134], [142, 126, 134], [129, 102, 110], [142, 102, 110], [191, 113, 123], [201, 113, 123]]) {
  box(x, 7, z0, x + 1, 8, z1, C.terra); box(x, 9, z0, x + 1, 9, z1, C.terraD);
}
function trafficCone(x, z) {
  box(x - 3, 7, z - 3, x + 3, 7, z + 3, C.terraD);
  cone(x, 8, z, 3, 0.6, 10, C.terra);
  for (const y of [11, 14]) discY(x, z, y, y, 3 - (y - 8) * 0.24 + 0.3, 0, C.sand);
}
trafficCone(140, 40); trafficCone(224, 126); trafficCone(138, 214);


// refueler truck (rear platform x137-152, hose cabinet x152-164, tank x166-196, cab x198-216)
function truckWheel(x) {
  for (const [z0, z1, face, cap] of [[180, 183, 180, 179], [196, 199, 199, 200]]) {
    discZ(x, 12, z0, z1, 5, 3, C.tire);
    discZ(x, 12, z0, z1, 3, 0, C.greenD);
    discZ(x, 12, face, face, 3, 0, C.hub);
    block(x, 12, cap, C.greenD);
  }
  box(x, 12, 184, x, 12, 195, C.greenD);
}
truckWheel(158); truckWheel(169); truckWheel(205);
box(138, 14, 184, 212, 17, 195, C.greenD);
box(152, 18, 179, 175, 18, 184, C.greenD); box(152, 18, 195, 175, 18, 200, C.greenD);
box(137, 14, 181, 137, 16, 198, C.greenD);
box(137, 15, 181, 137, 16, 183, C.terra); box(137, 15, 196, 137, 16, 198, C.terra);

// forward-control cab
box(198, 14, 180, 214, 32, 199, C.terra);
for (let x = 198; x <= 212; x++) for (let y = 14; y <= 18; y++)
  if ((x - 205) * (x - 205) + (y - 12) * (y - 12) <= 44) for (const z of [180, 181, 182, 183, 196, 197, 198, 199]) block(x, y, z, null);
box(197, 33, 180, 214, 33, 199, C.sand);
box(198, 21, 180, 213, 22, 180, C.sand); box(198, 21, 199, 213, 22, 199, C.sand);
box(214, 24, 182, 214, 30, 197, C.glass);
box(214, 24, 181, 214, 30, 181, C.terraD); box(214, 24, 198, 214, 30, 198, C.terraD);
box(201, 24, 180, 211, 30, 180, C.glass); box(201, 24, 199, 211, 30, 199, C.glass);
box(207, 19, 180, 207, 23, 180, C.terraD); box(207, 19, 199, 207, 23, 199, C.terraD);
box(215, 16, 184, 215, 21, 195, C.greenD);
for (let y = 16; y <= 21; y += 2) box(215, y, 185, 215, y, 194, C.sandD);
box(215, 17, 181, 215, 19, 183, C.light); box(215, 17, 196, 215, 19, 198, C.light);
box(215, 13, 180, 216, 15, 199, C.greenD);
cylinder(205, 34, 189, 1.6, 2, C.amber);
block(205, 36, 189, C.greenD);
beam(213, 29, 180, 216, 29, 177, 0.8, C.greenD); box(216, 26, 176, 216, 30, 177, C.greenD);
beam(213, 29, 199, 216, 29, 202, 0.8, C.greenD); box(216, 26, 202, 216, 30, 203, C.greenD);
box(197, 18, 181, 197, 24, 182, C.red); box(197, 18, 197, 197, 24, 198, C.red);

// elliptical fuel tank with top walkway
for (let x = 166; x <= 196; x++) {
  const e = x < 170 ? (x - 165) / 5 : (x > 192 ? (197 - x) / 5 : 1);
  const k = Math.sqrt(Math.max(0.05, 1 - (1 - e) * (1 - e)));
  for (let y = 16; y <= 33; y++) for (let z = 179; z <= 200; z++) {
    const u = (z - 189.5) / (9.8 * k), v = (y - 24.5) / (7.8 * k);
    if (u * u + v * v > 1) continue;
    let col = C.green;
    if (x < 169 || x > 193) col = C.terra;
    else if (y === 24 || y === 25) col = C.sand;
    block(x, y, z, col);
  }
}
box(168, 32, 186, 192, 32, 193, C.greenD);
box(168, 33, 186, 193, 33, 193, C.sandD);
for (let x = 168; x <= 192; x += 6) { box(x, 34, 186, x, 37, 186, C.greenL); box(x, 34, 193, x, 37, 193, C.greenL); }
box(168, 37, 186, 192, 37, 186, C.greenL); box(168, 37, 193, 192, 37, 193, C.greenL);
cylinder(174, 33, 189, 2.5, 2, C.terra); cylinder(186, 33, 189, 2.5, 2, C.terra);
box(180, 34, 189, 180, 38, 189, C.greenD);
box(166, 18, 201, 166, 33, 201, C.greenL); box(169, 18, 201, 169, 33, 201, C.greenL);
for (let y = 20; y <= 32; y += 3) box(167, y, 201, 168, y, 201, C.greenL);
box(166, 18, 200, 169, 18, 200, C.greenD); box(166, 30, 200, 169, 30, 200, C.greenD);

// side lockers, grounding reel and cable to the main gear
box(176, 12, 180, 196, 17, 184, C.terraD); box(176, 12, 195, 196, 17, 199, C.terraD);
for (const x of [181, 186, 191]) { box(x, 12, 180, x, 17, 180, C.terra); box(x, 12, 199, x, 17, 199, C.terra); }
discZ(186, 15, 200, 201, 2.5, 0, C.sand);
block(186, 15, 202, C.greenD);
line(186, 13, 202, 186, 7, 204, C.hose);
line(186, 7, 204, 137, 7, 135, C.hose);
line(137, 7, 135, 136, 11, 134, C.hose);

// hose-reel cabinet
box(152, 18, 181, 164, 18, 198, C.greenD);
box(152, 19, 180, 164, 31, 180, C.terraD);
box(164, 19, 181, 164, 31, 198, C.terraD);
box(152, 19, 181, 152, 22, 198, C.terraD);
box(152, 19, 199, 152, 31, 199, C.terra); box(164, 19, 199, 164, 31, 199, C.terra);
box(151, 31, 180, 165, 32, 199, C.terra);
box(151, 31, 199, 165, 31, 199, C.sand);
discZ(158, 24, 182, 197, 4, 0, C.greenD);
for (let z = 183; z <= 196; z++) discZ(158, 24, z, z, 5.4, 4, z % 2 ? C.hose : C.greenD);
discZ(158, 24, 181, 181, 6.2, 0, C.sand); discZ(158, 24, 198, 198, 6.2, 0, C.sand);
discZ(158, 24, 199, 199, 1.5, 0, C.greenD);

// raised scissor platform under the wing
box(138, 17, 181, 151, 17, 198, C.greenD);
for (const zc of [182, 183, 196, 197]) {
  beam(139, 18, zc, 150, 26, zc, 0.8, C.sand);
  beam(150, 18, zc, 139, 26, zc, 0.8, C.sand);
}
box(144, 21, 182, 145, 23, 197, C.greenD);
box(137, 27, 181, 152, 27, 198, C.sandD);
for (const z of [181, 198]) {
  box(145, 28, z, 145, 33, z, C.greenL); box(152, 28, z, 152, 33, z, C.greenL); box(137, 28, z, 137, 30, z, C.greenL);
  box(145, 33, z, 152, 33, z, C.greenL); box(137, 30, z, 152, 30, z, C.greenL);
}
box(152, 30, 181, 152, 30, 198, C.greenL); box(152, 33, 181, 152, 33, 198, C.greenL);
box(137, 30, 181, 137, 30, 198, C.greenL);

// delivery hose up to the underwing adapter
beam(156, 29, 190, 150, 29, 190, 0.9, C.hose);
beam(150, 29, 190, 144, 33, 190, 0.9, C.hose);
beam(144, 33, 190, 141, 34, 190, 0.9, C.hose);
box(140, 34, 189, 142, 34, 191, C.greenD);

// operator on the platform and ground crew
box(146, 28, 188, 146, 32, 188, C.coverall); box(146, 28, 189, 146, 32, 189, C.coverall);
box(146, 33, 188, 147, 37, 189, C.vest);
box(146, 38, 188, 147, 39, 189, C.skin);
box(146, 40, 188, 147, 40, 189, C.terra);
beam(145, 37, 190, 142, 34, 190, 0.7, C.coverall);
box(147, 33, 187, 147, 36, 187, C.coverall);
box(184, 7, 206, 184, 11, 206, C.coverall); box(185, 7, 206, 185, 11, 206, C.coverall);
box(184, 12, 206, 185, 16, 207, C.vest);
box(183, 12, 206, 183, 15, 206, C.coverall); box(186, 12, 206, 186, 15, 206, C.coverall);
box(184, 17, 206, 185, 18, 207, C.skin);
box(184, 19, 206, 185, 19, 207, C.hair);

// wheeled extinguisher cart
box(222, 8, 186, 226, 8, 190, C.greenD);
discZ(224, 9, 185, 185, 2, 0, C.tire); discZ(224, 9, 191, 191, 2, 0, C.tire);
box(224, 9, 185, 224, 9, 191, C.greenD);
cylinder(224, 9, 188, 2.2, 11, C.red);
ellipsoid(224, 20, 188, 2.2, 1.5, 2.2, C.red);
beam(224, 21, 188, 227, 23, 188, 0.7, C.greenD);
box(226, 14, 188, 226, 18, 188, C.hose);

const R = Math.round, PI = Math.PI;
const C = {
  white: '#F3F5F8', ice: '#CFE6EF', iceD: '#A7CEDF', glass: '#9CD0E4',
  lilac: '#9D95B5', lilacD: '#7B7496', lilacL: '#C6C0D9', steel: '#8A90A6',
  amber: '#F2B25C', coral: '#E8826A', red: '#D65A4C', gold: '#DDB150',
  wood: '#C18C5D', dark: '#5B566F', skin: '#EBC7A4', hair: '#463C4C',
  shirt1: '#6C8FB0', shirt2: '#C45F66', shirt3: '#7D9A7E', bloom: '#B8AAD8'
};
const M = {
  collar: '#6D7390', flange: '#DCE1EB',
  shell: '#FAFBFD', under: '#8E86A9', band: '#B3DAEA', roof: '#A59DC1', seat: '#EE8C6E', seatB: '#D8735A', lamp: '#FFC66B',
  body: '#EEF1F6', stripe: '#8CC5DC', frame: '#746E8E', canopy: '#F8F9FC', head: '#FFD27A', tail: '#CF4F48',
  wheel: '#4E4960', spoke: '#A09BB3', beacon: '#FFB04C'
};

function discY(cx, cz, y0, y1, ro, ri, col) {
  const n = Math.ceil(ro) + 1, bx = R(cx), bz = R(cz);
  for (let x = bx - n; x <= bx + n; x++) for (let z = bz - n; z <= bz + n; z++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d <= ro && d >= ri) box(x, y0, z, x, y1, z, col);
  }
}
function discZ(cx, cy, z0, z1, ro, ri, col) {
  const n = Math.ceil(ro) + 1, bx = R(cx), by = R(cy);
  for (let x = bx - n; x <= bx + n; x++) for (let y = by - n; y <= by + n; y++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= ro && d >= ri) box(x, y, z0, x, y, z1, col);
  }
}
function polarCells(cx, cz, a, r0, r1, hw, fn) {
  const ca = Math.cos(a), sa = Math.sin(a), n = Math.ceil(r1 + hw) + 1;
  for (let x = R(cx) - n; x <= R(cx) + n; x++) for (let z = R(cz) - n; z <= R(cz) + n; z++) {
    const dx = x - cx, dz = z - cz, u = dx * ca + dz * sa, v = -dx * sa + dz * ca;
    if (u >= r0 && u <= r1 && Math.abs(v) <= hw) fn(x, z);
  }
}
function polarBox(cx, cz, a, r0, r1, hw, y0, y1, col) {
  polarCells(cx, cz, a, r0, r1, hw, (x, z) => box(x, y0, z, x, y1, z, col));
}
function polarClear(cx, cz, a, r0, r1, hw, y0, y1) {
  polarCells(cx, cz, a, r0, r1, hw, (x, z) => { for (let y = y0; y <= y1; y++) block(x, y, z, null); });
}
function person(x, z, shirt, sit) {
  const y0 = sit ? 0 : 5;
  if (!sit) { box(x, 7, z, x, 11, z, C.dark); box(x + 1, 7, z, x + 1, 11, z, C.dark); }
  const yb = 7 + y0;
  box(x, yb, z, x + 1, yb + 4, z + 1, shirt);
  box(x, yb + 5, z, x + 1, yb + 6, z + 1, C.skin);
  box(x, yb + 7, z, x + 1, yb + 7, z + 1, C.hair);
}

// plaza: round court around the tower joined to a front promenade
function inPlaza(x, z) {
  if (Math.hypot(x - 150, z - 100) <= 62) return true;
  const x0 = 28, x1 = 226, z0 = 140, z1 = 214, r = 16;
  if (x < x0 || x > x1 || z < z0 || z > z1) return false;
  const qx = x < x0 + r ? x0 + r : (x > x1 - r ? x1 - r : x);
  const qz = z < z0 + r ? z0 + r : (z > z1 - r ? z1 - r : z);
  return (x - qx) * (x - qx) + (z - qz) * (z - qz) <= r * r;
}
for (let x = 26; x <= 228; x++) for (let z = 36; z <= 216; z++) {
  if (!inPlaza(x, z)) continue;
  if (!inPlaza(x + 2, z) || !inPlaza(x - 2, z) || !inPlaza(x, z + 2) || !inPlaza(x, z - 2)) { box(x, 4, z, x, 7, z, C.lilac); continue; }
  const dc = Math.hypot(x - 150, z - 100);
  let col;
  if (dc <= 60) {
    const deg = (((Math.atan2(z - 100, x - 150) * 180 / PI) % 15) + 15) % 15;
    const seam = (dc % 8) < 0.9 || Math.min(deg, 15 - deg) * PI / 180 * dc < 0.5;
    col = seam ? C.iceD : (Math.floor(dc / 8) % 2 ? C.ice : C.white);
  } else {
    col = (x % 10 === 0 || z % 10 === 0) ? C.ice : C.white;
  }
  box(x, 4, z, x, 6, z, col);
}

// boarding deck with fence ring
const TX = 150, TZ = 100;
discY(TX, TZ, 7, 9, 38.5, 0, C.lilacD);
discY(TX, TZ, 10, 12, 36, 0, C.white);
discY(TX, TZ, 12, 12, 36, 34.6, C.lilac);
discY(TX, TZ, 12, 12, 20.6, 19.6, C.ice);
discY(TX, TZ, 12, 12, 28.6, 27.6, C.ice);
for (let k = 0; k < 30; k++) {
  const a = k * PI / 15;
  if (Math.abs(a - PI / 2) < 0.26) continue;
  polarBox(TX, TZ, a, 34, 35.2, 0.6, 13, 17, C.lilac);
}
for (let x = TX - 37; x <= TX + 37; x++) for (let z = TZ - 37; z <= TZ + 37; z++) {
  const d = Math.hypot(x - TX, z - TZ), a = Math.atan2(z - TZ, x - TX);
  if (d >= 34 && d <= 35.3 && Math.abs(a - PI / 2) > 0.24) block(x, 18, z, C.white);
}

// central mast with guide rails, bands, crown
discY(TX, TZ, 13, 13, 15, 9.8, C.lilacD);
discY(TX, TZ, 13, 186, 7.5, 0, C.lilacL);
for (let y = 44; y <= 172; y += 24) discY(TX, TZ, y, y + 1, 8.2, 7, C.white);
box(158, 13, 99, 159, 184, 101, C.steel);
box(141, 13, 99, 142, 184, 101, C.steel);
box(149, 13, 108, 151, 184, 109, C.steel);
box(149, 13, 91, 151, 184, 92, C.steel);
for (const y of [100, 150]) for (let k = 0; k < 4; k++) polarBox(TX, TZ, PI / 4 + k * PI / 2, 7, 8.3, 0.7, y, y + 1, C.amber);
discY(TX, TZ, 185, 187, 10, 0, C.lilac);
discY(TX, TZ, 188, 190, 13, 0, C.white);
discY(TX, TZ, 191, 195, 12, 0, C.glass);
for (let k = 0; k < 12; k++) polarBox(TX, TZ, k * PI / 6, 10.4, 12.3, 0.7, 191, 195, C.white);
discY(TX, TZ, 196, 197, 13.5, 0, C.white);
cone(TX, 198, TZ, 11, 3, 7, C.lilac);
discY(TX, TZ, 205, 206, 3, 0, C.lilacD);

// rotating beacon (moving)
discY(TX, TZ, 207, 210, 2.5, 0, M.beacon);
box(TX, 211, TZ - 1, TX + 4, 212, TZ + 1, M.frame);
box(TX + 3, 208, TZ - 1, TX + 4, 209, TZ + 1, M.beacon);
box(TX - 3, 211, TZ, TX, 211, TZ, M.frame);

// lifting collar (moving)
discY(TX, TZ, 14, 15, 16, 10, M.flange);
discY(TX, TZ, 16, 34, 13, 10, M.collar);
discY(TX, TZ, 35, 36, 16, 10, M.flange);
for (let k = 0; k < 4; k++) polarBox(TX, TZ, PI / 4 + k * PI / 2, 10.5, 15, 2.5, 37, 40, M.collar);

// ring cabin (moving, rotates on the collar)
discY(TX, TZ, 16, 16, 29, 14, M.under);
discY(TX, TZ, 17, 17, 31, 14, M.shell);
discY(TX, TZ, 18, 20, 32, 30, M.shell);
discY(TX, TZ, 20, 20, 32.2, 30, M.band);
for (let k = 0; k < 16; k++) if (k !== 4) polarBox(TX, TZ, k * PI / 8, 29.6, 32, 1, 21, 29, M.shell);
discY(TX, TZ, 30, 32, 32, 30, M.shell);
discY(TX, TZ, 30, 30, 32.2, 30, M.band);
discY(TX, TZ, 33, 33, 31, 14, M.roof);
discY(TX, TZ, 34, 34, 28, 14, M.roof);
discY(TX, TZ, 18, 32, 16, 14, M.roof);
polarClear(TX, TZ, PI / 2, 29, 33, 3, 18, 20);
for (let k = 0; k < 16; k++) {
  const a = k * PI / 8 + PI / 16;
  polarBox(TX, TZ, a, 26.5, 28.5, 0.8, 16, 16, M.lamp);
  polarBox(TX, TZ, a, 31.4, 32.4, 0.6, 19, 19, M.lamp);
  polarBox(TX, TZ, a, 24, 28, 2, 18, 19, M.seat);
  polarBox(TX, TZ, a, 23, 24, 2, 18, 24, M.seatB);
  if (k % 2 === 0 || k === 5 || k === 11) {
    const sh = [C.shirt1, C.shirt2, C.shirt3][k % 3];
    polarBox(TX, TZ, a, 24.6, 26.4, 1.2, 20, 23, sh);
    polarBox(TX, TZ, a, 26.4, 28.4, 1, 20, 20, sh);
    polarBox(TX, TZ, a, 24.8, 26.2, 1, 24, 25, C.skin);
    polarBox(TX, TZ, a, 24.4, 25.4, 1, 26, 26, C.hair);
  }
}


function standing(x, y0, z, shirt) {
  box(x, y0, z, x, y0 + 4, z, C.dark); box(x + 1, y0, z, x + 1, y0 + 4, z, C.dark);
  box(x, y0 + 5, z, x + 1, y0 + 9, z + 1, shirt);
  box(x, y0 + 10, z, x + 1, y0 + 11, z + 1, C.skin);
  box(x, y0 + 12, z, x + 1, y0 + 12, z + 1, C.hair);
}

// bridge, gate arch and tower station
box(143, 7, 130, 157, 12, 140, C.white);
box(143, 7, 141, 157, 11, 145, C.white);
box(143, 12, 131, 143, 12, 140, C.lilac); box(157, 12, 131, 157, 12, 140, C.lilac);
box(142, 7, 137, 142, 15, 145, C.lilac); box(158, 7, 137, 158, 15, 145, C.lilac);
box(124, 7, 146, 176, 10, 155, C.white);
box(124, 10, 154, 176, 10, 155, C.amber);
box(140, 11, 146, 141, 30, 147, C.lilac); box(159, 11, 146, 160, 30, 147, C.lilac);
for (let x = 140; x <= 160; x++) {
  const h = R(4 * Math.sqrt(Math.max(0, 1 - ((x - 150) / 10.5) * ((x - 150) / 10.5))));
  box(x, 30, 146, x, 31 + h, 147, C.lilac);
}
box(149, 36, 148, 151, 37, 148, C.amber);

// booth station
box(64, 7, 175, 106, 10, 184, C.white);
box(64, 10, 175, 106, 10, 176, C.amber);

// track with buffer stops
for (let x = 62; x <= 170; x += 5) box(x, 7, 157, x + 1, 7, 173, C.lilacD);
box(60, 8, 160, 172, 9, 160, C.steel);
box(60, 8, 170, 172, 9, 170, C.steel);
box(57, 7, 158, 59, 15, 172, C.lilac); box(60, 11, 162, 61, 13, 168, C.red);
box(173, 7, 158, 175, 15, 172, C.lilac); box(171, 11, 162, 172, 13, 168, C.red);

// rail cart (moving)
box(72, 12, 162, 97, 16, 168, M.frame);
box(70, 17, 156, 99, 17, 174, M.frame);
box(70, 18, 156, 99, 18, 174, M.body);
for (const zz of [156, 174]) {
  box(70, 19, zz, 77, 21, zz, M.body); box(92, 19, zz, 99, 21, zz, M.body);
  box(70, 21, zz, 77, 21, zz, M.stripe); box(92, 21, zz, 99, 21, zz, M.stripe);
}
box(70, 19, 157, 71, 25, 173, M.body); box(98, 19, 157, 99, 25, 173, M.body);
box(70, 23, 157, 71, 23, 173, M.stripe); box(98, 23, 157, 99, 23, 173, M.stripe);
box(100, 18, 159, 100, 22, 171, M.frame); box(69, 18, 159, 69, 22, 171, M.frame);
box(101, 20, 164, 101, 21, 166, M.head); box(68, 20, 164, 68, 21, 166, M.tail);
box(100, 14, 162, 101, 16, 168, M.frame); box(68, 14, 162, 69, 16, 168, M.frame);
for (const bx of [79, 89]) { box(bx, 19, 158, bx + 3, 20, 172, M.seat); box(bx, 21, 158, bx, 25, 172, M.seatB); }
for (const [bx, z, sh] of [[79, 160, C.shirt2], [79, 167, C.shirt1], [89, 163, C.shirt3]]) {
  box(bx + 1, 21, z, bx + 2, 24, z + 1, sh);
  box(bx + 3, 21, z, bx + 5, 21, z + 1, C.dark);
  box(bx + 1, 25, z, bx + 2, 26, z + 1, C.skin);
  box(bx + 1, 27, z, bx + 2, 27, z + 1, C.hair);
}
for (const [px, pz] of [[70, 156], [98, 156], [70, 173], [98, 173]]) box(px, 19, pz, px + 1, 33, pz + 1, M.frame);
box(69, 34, 155, 100, 34, 175, M.canopy);
box(71, 35, 157, 98, 35, 173, M.canopy);
box(69, 33, 155, 100, 33, 155, M.stripe); box(69, 33, 175, 100, 33, 175, M.stripe);

// cart wheel sets (moving)
for (const ax of [77, 92]) {
  discZ(ax, 13, 159, 160, 3, 0, M.wheel);
  discZ(ax, 13, 170, 171, 3, 0, M.wheel);
  box(ax, 13, 159, ax, 13, 171, M.wheel);
  for (const zz of [159, 171]) { box(ax - 2, 13, zz, ax + 2, 13, zz, M.spoke); box(ax, 11, zz, ax, 15, zz, M.spoke); }
}

// ticket booth
const BX = 46, BZ = 172;
discY(BX, BZ, 7, 8, 12.5, 0, C.lilacD);
discY(BX, BZ, 9, 29, 11, 9.2, C.white);
discY(BX, BZ, 9, 10, 11.3, 9.2, C.lilac);
discY(BX, BZ, 9, 9, 9.2, 0, C.wood);
for (let x = BX - 6; x <= BX + 6; x++) for (let z = BZ + 5; z <= BZ + 12; z++) for (let y = 17; y <= 25; y++) {
  const d = Math.hypot(x - BX, z - BZ);
  if (d >= 9 && d <= 11.5) block(x, y, z, null);
}
box(40, 16, 182, 52, 16, 185, C.wood);
box(41, 16, 177, 51, 16, 180, C.wood);
box(43, 17, 178, 45, 18, 179, C.coral); box(48, 17, 178, 49, 17, 179, C.gold);
box(45, 10, 173, 46, 12, 174, C.dark);
box(45, 13, 173, 46, 18, 174, C.shirt1);
box(45, 19, 173, 46, 20, 174, C.skin);
box(45, 21, 173, 46, 21, 174, C.hair);
for (let x = 38; x <= 54; x++) {
  const col = Math.floor((x - 38) / 2) % 2 ? C.white : C.coral;
  box(x, 27, 182, x, 27, 184, col); box(x, 26, 185, x, 26, 186, col); box(x, 25, 187, x, 25, 187, col);
}
discY(BX, BZ, 30, 31, 12.5, 0, C.lilac);
for (let y = 32; y <= 40; y++) {
  const t = (y - 31) / 10, r = 12 * Math.sqrt(1 - t * t);
  discY(BX, BZ, y, y, r, 0, y % 3 === 0 ? C.iceD : C.ice);
}
ellipsoid(BX, 42, BZ, 1.6, 1.6, 1.6, C.gold);
box(BX, 44, BZ, BX, 47, BZ, C.gold);
box(BX + 11, 20, BZ - 1, BX + 11, 23, BZ + 1, C.glass);
box(BX - 11, 20, BZ - 1, BX - 11, 23, BZ + 1, C.glass);
box(BX - 3, 9, BZ - 11, BX + 3, 22, BZ - 10, C.lilacD);
block(BX + 2, 15, BZ - 12, C.gold);
standing(45, 7, 188, C.shirt2);

// turnstile with barrier panels
discY(62, 190, 7, 12, 1.5, 0, C.lilacD);
box(54, 7, 185, 54, 15, 195, C.lilac); box(70, 7, 185, 70, 15, 195, C.lilac);
box(54, 16, 185, 54, 16, 195, C.white); box(70, 16, 185, 70, 16, 195, C.white);
discY(62, 190, 13, 15, 1.8, 0, M.collar);
for (let k = 0; k < 3; k++) polarBox(62, 190, PI / 2 + k * 2 * PI / 3, 1.5, 6, 0.5, 14, 14, M.flange);
block(62, 16, 190, M.collar);

// operator cabin facing the tower
box(184, 7, 132, 196, 22, 144, C.white);
box(184, 14, 134, 184, 20, 142, C.glass);
box(186, 14, 132, 194, 20, 132, C.glass);
box(183, 23, 131, 197, 24, 145, C.lilac);
block(190, 25, 138, C.amber);
box(196, 7, 136, 196, 18, 140, C.lilacD);
box(183, 13, 133, 183, 13, 143, C.lilacD);

// lamps, benches, flowering trees, waiting visitors
function lamp(x, z) {
  discY(x, z, 7, 8, 2.5, 0, C.lilacD);
  box(x, 9, z, x + 1, 38, z + 1, C.dark);
  box(x - 3, 38, z, x + 4, 38, z + 1, C.dark);
  for (const dx of [-3, 4]) { box(x + dx - 1, 35, z - 1, x + dx + 1, 37, z + 2, C.amber); block(x + dx, 34, z, C.gold); }
}
lamp(116, 200); lamp(188, 200); lamp(214, 158);
function bench(x0, z0) {
  box(x0, 7, z0, x0 + 1, 10, z0 + 3, C.lilacD); box(x0 + 14, 7, z0, x0 + 15, 10, z0 + 3, C.lilacD);
  box(x0, 11, z0, x0 + 15, 11, z0 + 3, C.wood);
  box(x0, 12, z0 + 3, x0 + 15, 15, z0 + 3, C.wood);
}
bench(126, 198); bench(160, 198);
function tree(x, z, s) {
  discY(x, z, 7, 11, 5, 0, C.white);
  discY(x, z, 11, 11, 4.2, 0, C.lilacD);
  box(x, 12, z, x + 1, 22, z + 1, C.dark);
  ellipsoid(x, 27, z, 8 * s, 6 * s, 8 * s, C.bloom);
  ellipsoid(x + 3, 31, z - 2, 5 * s, 4 * s, 5 * s, C.lilacL);
  ellipsoid(x - 3, 30, z + 3, 4.5 * s, 3.5 * s, 4.5 * s, C.white);
}
tree(104, 70, 1); tree(196, 72, 0.9);
standing(130, 11, 149, C.shirt1);
standing(166, 11, 150, C.shirt2);
standing(102, 11, 179, C.shirt3);

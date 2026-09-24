import * as THREE from 'three';
import { mat, makeMatrix, gableGeometry, addGableRoof, mulberry32, TAU } from './util.js';

export const PAL = {
  whitewash: '#ece4d2', stone: '#aaa597', stoneDark: '#8b877b', stoneLight: '#c4bfb0', stoneWarm: '#b3a893',
  slate: '#6f7784', slateDark: '#5c636f', thatch: '#c8a66a', thatchDark: '#a98850',
  wood: '#8e6e52', woodDark: '#624b3a', woodGrey: '#948877', barnRed: '#9a6552', barnRedDark: '#7f5243',
  frame: '#f2ede2', glass: '#56666f', chimneyPot: '#b06a4f', brass: '#c9a45a', iron: '#4f5f53',
  hay: '#dcc47e', hayDark: '#bfa35f', earth: '#8a6a4b', dark: '#3a2f27',
  rose: '#d88b9a', leaf: '#6e8a4e', leafDark: '#58703f', red: '#b8483d', cream: '#efe7d6', blue: '#5f84b0',
};

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 7),
  cylOpen: new THREE.CylinderGeometry(1, 1, 1, 18, 1, true),
  sphere: new THREE.SphereGeometry(1, 12, 9),
  sphereLo: new THREE.SphereGeometry(1, 8, 6),
  ico: new THREE.IcosahedronGeometry(1, 1),
  cone: new THREE.ConeGeometry(1, 1, 10),
  halfDisc: new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, Math.PI),
  plane: new THREE.PlaneGeometry(1, 1),
};

const _mm = new THREE.Matrix4();
/* Add a unit geometry to the batch, positioned in the frame M */
export function put(B, geo, color, M, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, opts) {
  const local = makeMatrix(x, y, z, rx, ry, rz, sx, sy, sz);
  B.add(geo, typeof color === 'string' ? mat(color, opts) : color, _mm.multiplyMatrices(M, local).clone());
}
function sub(M, x, y, z, ry = 0) { return new THREE.Matrix4().multiplyMatrices(M, makeMatrix(x, y, z, 0, ry, 0)); }
export function toWorld(M, x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(M); }

/* ---------------------------------------------------------------- windows, doors, flowers */

function windowAt(B, M, x, y, z, w = 1.0, h = 1.05, { box = false, boxColor = PAL.rose, frame = PAL.frame } = {}) {
  put(B, G.box, frame, M, x, y, z + 0.03, 0, 0, 0, w + 0.14, h + 0.14, 0.08);
  put(B, G.box, PAL.glass, M, x, y, z + 0.07, 0, 0, 0, w - 0.1, h - 0.1, 0.04);
  put(B, G.box, frame, M, x, y, z + 0.1, 0, 0, 0, 0.06, h - 0.1, 0.04);
  put(B, G.box, frame, M, x, y + h * 0.08, z + 0.1, 0, 0, 0, w - 0.1, 0.06, 0.04);
  put(B, G.box, PAL.stoneLight, M, x, y - h / 2 - 0.08, z + 0.12, 0, 0, 0, w + 0.3, 0.1, 0.26);
  if (box) {
    put(B, G.box, PAL.woodDark, M, x, y - h / 2 - 0.22, z + 0.22, 0, 0, 0, w, 0.2, 0.24);
    for (let i = 0; i < 5; i++) {
      put(B, G.sphereLo, PAL.leaf, M, x - w * 0.4 + i * w * 0.2, y - h / 2 - 0.07, z + 0.22, 0, 0, 0, 0.13, 0.1, 0.12);
      put(B, G.sphereLo, i % 2 ? boxColor : '#e9c46a', M, x - w * 0.36 + i * w * 0.19, y - h / 2 + 0.02, z + 0.26, 0, 0, 0, 0.065);
    }
  }
}

function doorAt(B, M, x, z, color, { w = 1.05, h = 1.95, arch = false, frame = PAL.stoneLight } = {}) {
  put(B, G.box, frame, M, x, h / 2 + 0.05, z + 0.02, 0, 0, 0, w + 0.3, h + 0.2, 0.06);
  put(B, G.box, color, M, x, h / 2, z + 0.06, 0, 0, 0, w, h, 0.08);
  if (arch) put(B, G.halfDisc, color, M, x, h, z + 0.06, Math.PI / 2, 0, 0, w / 2, 0.08, w / 2);
  put(B, G.box, PAL.woodDark, M, x, h * 0.66, z + 0.11, 0, 0, 0, w * 0.9, 0.05, 0.02);
  put(B, G.sphereLo, PAL.brass, M, x + w * 0.34, h * 0.5, z + 0.13, 0, 0, 0, 0.05);
  put(B, G.box, PAL.stoneDark, M, x, 0.07, z + 0.35, 0, 0, 0, w + 0.6, 0.16, 0.6);
}

function roses(B, M, x, y, z, spread = 1.2, color = PAL.rose, rnd = Math.random) {
  for (let i = 0; i < 9; i++) {
    const px = x + (rnd() - 0.5) * spread, py = y + rnd() * 1.6;
    put(B, G.ico, rnd() < 0.5 ? PAL.leaf : PAL.leafDark, M, px, py, z + 0.12, 0, 0, 0, 0.22 + rnd() * 0.12, 0.2 + rnd() * 0.1, 0.12);
    if (rnd() < 0.8) put(B, G.sphereLo, color, M, px + (rnd() - 0.5) * 0.2, py + 0.08, z + 0.24, 0, 0, 0, 0.07);
  }
}

function chimney(B, M, x, zc, h, roofH, color, smoke) {
  const top = h + roofH + 1.1;
  const bottom = h - 0.3;
  put(B, G.box, color, M, x, (top + bottom) / 2, zc, 0, 0, 0, 0.72, top - bottom, 0.72);
  put(B, G.box, PAL.stoneDark, M, x, top + 0.06, zc, 0, 0, 0, 0.84, 0.12, 0.84);
  put(B, G.cyl, PAL.chimneyPot, M, x - 0.15, top + 0.3, zc, 0, 0, 0, 0.12, 0.38, 0.12);
  put(B, G.cyl, PAL.chimneyPot, M, x + 0.16, top + 0.26, zc, 0, 0, 0, 0.11, 0.3, 0.11);
  smoke.push(toWorld(M, x, top + 0.55, zc));
}

/* ---------------------------------------------------------------- buildings */

export function buildCottage(B, C, def, baseY, out) {
  const rnd = mulberry32(def.x * 31 + def.z * 7);
  const { w, d, rot } = def;
  const h = def.h ?? 3.4;
  const tall = h > 4.5;
  const thatch = def.roof === 'thatch';
  const roofH = thatch ? d * 0.62 : d * 0.5;
  const M = makeMatrix(def.x, baseY, def.z, 0, rot, 0);
  const wallC = def.wall === 'stone' ? PAL.stone : PAL.whitewash;
  const roofC = thatch ? PAL.thatch : PAL.slate;

  put(B, G.box, PAL.stoneDark, M, 0, -0.2, 0, 0, 0, 0, w + 0.3, 0.9, d + 0.3);
  put(B, G.box, wallC, M, 0, h / 2, 0, 0, 0, 0, w, h, d);
  B.add(gableGeometry(w, d, roofH), mat(wallC), sub(M, 0, h, 0));
  addGableRoof(B, mat(roofC), M, w, d, roofH, { overhang: thatch ? 0.5 : 0.38, thick: thatch ? 0.5 : 0.18, y: h });
  if (def.wall === 'stone') {
    for (const sx of [-1, 1]) for (let i = 0; i < Math.floor(h / 0.5); i++) {
      const ww = i % 2 ? 0.5 : 0.34;
      put(B, G.box, PAL.stoneLight, M, sx * (w / 2 - ww / 2 + 0.02), 0.28 + i * 0.5, d / 2 + 0.01, 0, 0, 0, ww, 0.44, 0.06);
    }
  }
  const doorX = def.doorX ?? (tall ? 0 : -w * 0.12);
  doorAt(B, M, doorX, d / 2, def.door, { frame: def.wall === 'stone' ? PAL.stoneLight : PAL.stoneWarm });
  const winY = 1.45;
  const xs = tall ? [-w * 0.3, w * 0.3] : [doorX - 1.9, doorX + 2.2];
  for (const x of xs) windowAt(B, M, x, winY, d / 2, 1.0, 1.05, { box: true, boxColor: rnd() < 0.5 ? PAL.rose : PAL.red });
  if (tall) for (const x of [-w * 0.3, 0, w * 0.3]) windowAt(B, M, x, h - 1.2, d / 2, 0.95, 0.95);
  // back and gable-end windows
  const back = sub(M, 0, 0, 0, Math.PI);
  for (const x of [-w * 0.25, w * 0.25]) windowAt(B, back, x, winY, d / 2, 0.9, 0.95);
  const side = sub(M, 0, 0, 0, Math.PI / 2);
  windowAt(B, side, 0, tall ? h - 1.1 : h + 0.5, w / 2, 0.7, 0.75);
  const smoke = [];
  chimney(B, M, w / 2 - 0.6, 0, h, roofH, def.wall === 'stone' ? PAL.stoneWarm : PAL.stone, smoke);
  if (tall) chimney(B, M, -w / 2 + 0.6, 0, h, roofH, PAL.stoneWarm, smoke);
  roses(B, M, doorX - 0.95, 0.2, d / 2, 0.6, rnd() < 0.5 ? PAL.rose : '#e6a2b0', rnd);
  C.addRect(def.x, def.z, w / 2 + 0.25, d / 2 + 0.25, rot, baseY, h + roofH, { cam: true });
  out.smoke.push(...smoke);
  out.doors.push(toWorld(M, doorX, 0, d / 2 + 0.8));
}

export function buildBarn(B, C, def, baseY, out) {
  const { w, d, rot } = def;
  const M = makeMatrix(def.x, baseY, def.z, 0, rot, 0);
  const baseH = 1.4, h = 5.2, roofH = 3.5;
  put(B, G.box, PAL.stoneDark, M, 0, 0.1, 0, 0, 0, 0, w + 0.35, 1.4, d + 0.35);
  put(B, G.box, PAL.stone, M, 0, baseH / 2 + 0.1, 0, 0, 0, 0, w + 0.1, baseH, d + 0.1);
  put(B, G.box, PAL.barnRed, M, 0, baseH + (h - baseH) / 2, 0, 0, 0, 0, w, h - baseH, d);
  B.add(gableGeometry(w, d, roofH), mat(PAL.barnRed), sub(M, 0, h, 0));
  addGableRoof(B, mat(PAL.slate), M, w, d, roofH, { overhang: 0.5, thick: 0.2, y: h });
  // board battens
  for (let x = -w / 2 + 0.35; x < w / 2; x += 0.7) {
    for (const s of [1, -1]) put(B, G.box, PAL.barnRedDark, M, x, baseH + (h - baseH) / 2, s * (d / 2 + 0.02), 0, 0, 0, 0.07, h - baseH, 0.05);
  }
  for (let z = -d / 2 + 0.35; z < d / 2; z += 0.7) {
    const top = h + roofH * (1 - Math.abs(z) / (d / 2));
    for (const s of [1, -1]) put(B, G.box, PAL.barnRedDark, M, s * (w / 2 + 0.02), (baseH + top) / 2, z, 0, 0, 0, 0.05, top - baseH, 0.07);
  }
  // big doorway with open doors
  const dw = 4.4, dh = 3.9;
  put(B, G.box, PAL.dark, M, 0, dh / 2 + 0.1, d / 2 + 0.02, 0, 0, 0, dw, dh, 0.06);
  put(B, G.box, PAL.woodDark, M, 0, dh + 0.18, d / 2 + 0.06, 0, 0, 0, dw + 0.4, 0.2, 0.14);
  for (const s of [-1, 1]) {
    const hx = s * dw / 2;
    const a = s * 2.85;
    const lm = sub(M, hx, 0, d / 2 + 0.08, a);
    put(B, G.box, '#7c6049', lm, -s * dw / 4, dh / 2 + 0.1, 0, 0, 0, 0, dw / 2, dh, 0.12);
    for (const side of [0.07, -0.07]) {
      put(B, G.box, '#e7dcc6', lm, -s * dw / 4, dh / 2 + 0.1, side, 0, 0, Math.atan2(dh, dw / 2) * s, 0.12, Math.hypot(dw / 2, dh) * 0.95, 0.03);
      put(B, G.box, '#e7dcc6', lm, -s * dw / 4, dh / 2 + 0.1, side, 0, 0, 0, dw / 2, 0.12, 0.03);
    }
  }
  // hay spilling from the doorway and loft
  for (let i = 0; i < 6; i++) put(B, G.ico, i % 2 ? PAL.hay : PAL.hayDark, M, -1.5 + i * 0.6, 0.15, d / 2 + 0.3 + (i % 3) * 0.12, 0, i, 0, 0.5, 0.22, 0.4);
  put(B, G.box, PAL.dark, M, 0, 4.55, d / 2 + 0.02, 0, 0, 0, 1.3, 1.0, 0.06);
  put(B, G.box, PAL.woodDark, M, 0, 4.55, d / 2 + 0.05, 0, 0, 0, 1.5, 1.2, 0.03);
  put(B, G.box, PAL.dark, M, 0, 4.55, d / 2 + 0.07, 0, 0, 0, 1.25, 0.95, 0.03);
  for (let i = 0; i < 4; i++) put(B, G.ico, PAL.hay, M, -0.45 + i * 0.3, 4.2, d / 2 + 0.18, 0.4, i, 0, 0.26, 0.14, 0.22);
  // side windows
  const side = sub(M, 0, 0, 0, Math.PI / 2);
  for (const z of [-3, 3]) windowAt(B, side, z, 3.2, w / 2, 0.8, 0.8, { frame: '#e7dcc6' });
  const side2 = sub(M, 0, 0, 0, -Math.PI / 2);
  windowAt(B, side2, 0, 3.2, w / 2, 0.8, 0.8, { frame: '#e7dcc6' });
  C.addRect(def.x, def.z, w / 2 + 0.3, d / 2 + 0.3, rot, baseY, h + roofH, { cam: true });

  // weather vane (animated)
  const vane = new THREE.Group();
  const vm = mat('#3c3833');
  const pole = new THREE.Mesh(G.cyl, vm); pole.scale.set(0.035, 1.3, 0.035); pole.position.y = 0.65; vane.add(pole);
  const spin = new THREE.Group(); spin.position.y = 1.25; vane.add(spin);
  const arrow = new THREE.Mesh(G.box, vm); arrow.scale.set(0.05, 0.05, 1.2); spin.add(arrow);
  const tip = new THREE.Mesh(G.cone, vm); tip.scale.set(0.09, 0.22, 0.09); tip.rotation.x = Math.PI / 2; tip.position.z = 0.68; spin.add(tip);
  const tail = new THREE.Mesh(G.box, vm); tail.scale.set(0.02, 0.26, 0.3); tail.position.z = -0.55; spin.add(tail);
  const cock = new THREE.Mesh(G.sphereLo, vm); cock.scale.set(0.06, 0.22, 0.28); cock.position.y = 0.3; spin.add(cock);
  const comb = new THREE.Mesh(G.cone, vm); comb.scale.set(0.05, 0.28, 0.12); comb.position.set(0, 0.3, -0.32); comb.rotation.x = -0.7; spin.add(comb);
  for (const [i, dir] of [[0, 'N'], [1, 'E'], [2, 'S'], [3, 'W']]) {
    const bar = new THREE.Mesh(G.box, vm); bar.scale.set(0.02, 0.02, 0.5); bar.position.y = 0.92; bar.rotation.y = i * Math.PI / 2; bar.position.x = Math.sin(i * Math.PI / 2) * 0.25; bar.position.z = Math.cos(i * Math.PI / 2) * 0.25; vane.add(bar);
    void dir;
  }
  vane.position.copy(toWorld(M, 0, h + roofH + 0.15, 0));
  vane.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  out.dynamic.push(vane);
  out.vane = spin;
  out.doors.push(toWorld(M, 0, 0, d / 2 + 1.5));
}

export function buildFarmhouse(B, C, def, baseY, out) {
  const rnd = mulberry32(99);
  const { w, d, rot } = def;
  const M = makeMatrix(def.x, baseY, def.z, 0, rot, 0);
  const h = 5.6, roofH = 3.1;
  put(B, G.box, PAL.stoneDark, M, 0, -0.15, 0, 0, 0, 0, w + 0.3, 1.0, d + 0.3);
  put(B, G.box, PAL.stone, M, 0, h / 2, 0, 0, 0, 0, w, h, d);
  B.add(gableGeometry(w, d, roofH), mat(PAL.stone), sub(M, 0, h, 0));
  addGableRoof(B, mat(PAL.slate), M, w, d, roofH, { overhang: 0.4, thick: 0.2, y: h });
  for (const sx of [-1, 1]) for (let i = 0; i < 11; i++) {
    const ww = i % 2 ? 0.55 : 0.36;
    put(B, G.box, PAL.stoneLight, M, sx * (w / 2 - ww / 2 + 0.02), 0.28 + i * 0.5, d / 2 + 0.01, 0, 0, 0, ww, 0.44, 0.06);
  }
  // porch
  const pw = 2.6, pd = 1.9, ph = 2.7;
  const P = sub(M, 0, 0, d / 2 + pd / 2);
  for (const s of [-1, 1]) put(B, G.box, PAL.stone, P, s * (pw / 2 - 0.2), ph / 2, 0, 0, 0, 0, 0.4, ph, pd);
  B.add(gableGeometry(pd + 0.1, pw, 1.0), mat(PAL.stone), new THREE.Matrix4().multiplyMatrices(P, makeMatrix(0, ph, 0, 0, Math.PI / 2, 0)));
  const PR = new THREE.Matrix4().multiplyMatrices(P, makeMatrix(0, 0, 0.1, 0, Math.PI / 2, 0));
  addGableRoof(B, mat(PAL.slate), PR, pd + 0.2, pw, 1.0, { overhang: 0.22, thick: 0.14, y: ph });
  doorAt(B, M, 0, d / 2, '#6f8f73', { frame: PAL.stoneLight });
  roses(B, P, -pw / 2 - 0.1, 0.3, pd / 2 - 0.1, 0.8, PAL.rose, rnd);
  roses(B, P, pw / 2 + 0.1, 0.3, pd / 2 - 0.1, 0.8, '#e6a2b0', rnd);
  for (let i = 0; i < 7; i++) put(B, G.sphereLo, i % 2 ? PAL.rose : '#e6a2b0', P, -pw / 2 + i * pw / 6, ph + 0.15 + Math.sin(i) * 0.1, pd / 2 + 0.25, 0, 0, 0, 0.09);
  for (const x of [-3.4, 3.4]) windowAt(B, M, x, 1.5, d / 2, 1.1, 1.15, { box: true });
  for (const x of [-3.4, 0, 3.4]) windowAt(B, M, x, 4.2, d / 2, 1.0, 1.0);
  const back = sub(M, 0, 0, 0, Math.PI);
  for (const x of [-2.8, 2.8]) { windowAt(B, back, x, 1.5, d / 2, 1.0, 1.05); windowAt(B, back, x, 4.2, d / 2, 0.9, 0.95); }
  const smoke = [];
  chimney(B, M, w / 2 - 0.55, 0, h, roofH, PAL.stoneWarm, smoke);
  chimney(B, M, -w / 2 + 0.55, 0, h, roofH, PAL.stoneWarm, smoke);
  C.addRect(def.x, def.z, w / 2 + 0.25, d / 2 + 0.25, rot, baseY, h + roofH, { cam: true });
  C.addRect(...toXZ(toWorld(M, 0, 0, d / 2 + pd / 2)), pw / 2 + 0.1, pd / 2 + 0.1, rot, baseY, ph + 1, { cam: true });
  // bench by the wall
  bench(B, C, sub(M, -2.2, 0, d / 2 + 0.55), baseY);
  out.smoke.push(...smoke);
  out.doors.push(toWorld(M, 0, 0, d / 2 + pd + 0.6));
}

function toXZ(v) { return [v.x, v.z]; }

export function buildChapel(B, C, def, baseY, out) {
  const { w, d, rot } = def;
  const M0 = makeMatrix(def.x, baseY, def.z, 0, rot, 0);
  const M = new THREE.Matrix4().multiplyMatrices(M0, makeMatrix(0, 0, 0, 0, Math.PI / 2, 0));
  const L = d, W = w, h = 4.3, roofH = 3.8;
  put(B, G.box, PAL.stoneDark, M, 0, -0.2, 0, 0, 0, 0, L + 0.3, 0.9, W + 0.3);
  put(B, G.box, PAL.stone, M, 0, h / 2, 0, 0, 0, 0, L, h, W);
  B.add(gableGeometry(L, W, roofH), mat(PAL.stone), sub(M, 0, h, 0));
  addGableRoof(B, mat(PAL.slateDark), M, L, W, roofH, { overhang: 0.35, thick: 0.2, y: h });
  // lancet windows along both sides
  for (const s of [1, -1]) {
    const S = s > 0 ? M : sub(M, 0, 0, 0, Math.PI);
    for (const x of [-3.4, 0, 3.4]) {
      put(B, G.box, PAL.stoneLight, S, x, 2.4, W / 2 + 0.03, 0, 0, 0, 0.75, 1.9, 0.06);
      put(B, G.box, '#4d5b68', S, x, 2.35, W / 2 + 0.07, 0, 0, 0, 0.5, 1.5, 0.05);
      put(B, G.box, '#4d5b68', S, x, 3.12, W / 2 + 0.07, 0, 0, Math.PI / 4, 0.36, 0.36, 0.05);
      put(B, G.box, PAL.stoneLight, S, x, 3.22, W / 2 + 0.04, 0, 0, Math.PI / 4, 0.52, 0.52, 0.05);
    }
  }
  // front gable (local +z of the unrotated frame)
  const F = M0;
  doorAt(B, F, 0, L / 2, '#6b4f3a', { w: 1.3, h: 2.1, arch: true, frame: PAL.stoneLight });
  put(B, G.box, '#4d5b68', F, 0, 4.9, L / 2 + 0.05, 0, 0, Math.PI / 4, 0.55, 0.55, 0.05);
  put(B, G.box, PAL.stoneLight, F, 0, 4.9, L / 2 + 0.03, 0, 0, Math.PI / 4, 0.75, 0.75, 0.05);
  // bell-cote on the front gable
  const top = h + roofH;
  put(B, G.box, PAL.stone, F, 0, top + 0.55, L / 2 - 0.35, 0, 0, 0, 1.1, 1.5, 0.6);
  put(B, G.box, PAL.dark, F, 0, top + 0.7, L / 2 - 0.04, 0, 0, 0, 0.56, 0.72, 0.04);
  put(B, G.cone, PAL.brass, F, 0, top + 0.7, L / 2 - 0.1, 0, 0, 0, 0.19, 0.34, 0.19);
  B.add(gableGeometry(0.6, 1.2, 0.45), mat(PAL.slateDark), new THREE.Matrix4().multiplyMatrices(F, makeMatrix(0, top + 1.3, L / 2 - 0.35, 0, Math.PI / 2, 0)));
  put(B, G.box, '#3c3833', F, 0, top + 1.95, L / 2 - 0.35, 0, 0, 0, 0.06, 0.5, 0.06);
  put(B, G.box, '#3c3833', F, 0, top + 2.05, L / 2 - 0.35, 0, 0, 0, 0.3, 0.06, 0.06);
  C.addRect(def.x, def.z, w / 2 + 0.25, d / 2 + 0.25, rot, baseY, h + roofH, { cam: true });
  out.bell = toWorld(F, 0, top + 0.7, L / 2);
  out.doors.push(toWorld(F, 0, 0, L / 2 + 1));
}

export function buildHenhouse(B, C, def, baseY) {
  const { w, d, rot } = def;
  const M = makeMatrix(def.x, baseY, def.z, 0, rot, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(B, G.box, PAL.woodDark, M, sx * (w / 2 - 0.1), 0.2, sz * (d / 2 - 0.1), 0, 0, 0, 0.1, 0.45, 0.1);
  put(B, G.box, '#9a6248', M, 0, 0.4 + 0.6, 0, 0, 0, 0, w, 1.2, d);
  B.add(gableGeometry(w, d, 0.7), mat('#9a6248'), sub(M, 0, 1.6, 0));
  addGableRoof(B, mat('#6e6a64'), M, w, d, 0.7, { overhang: 0.18, thick: 0.08, y: 1.6 });
  put(B, G.box, PAL.dark, M, 0.4, 0.75, d / 2 + 0.02, 0, 0, 0, 0.36, 0.44, 0.04);
  put(B, G.box, '#7c6049', M, 0.4, 0.28, d / 2 + 0.55, -0.62, 0, 0, 0.36, 0.05, 1.05);
  for (let i = 0; i < 4; i++) put(B, G.box, PAL.woodDark, M, 0.4, 0.1 + i * 0.13, d / 2 + 0.85 - i * 0.2, -0.62, 0, 0, 0.36, 0.03, 0.03);
  put(B, G.box, PAL.frame, M, -0.5, 1.1, d / 2 + 0.02, 0, 0, 0, 0.4, 0.3, 0.04);
  C.addRect(def.x, def.z, w / 2 + 0.1, d / 2 + 0.1, rot, baseY, 2.3, { cam: false });
}

export function buildKennel(B, C, def, baseY, out) {
  const { w, d, rot } = def;
  const M = makeMatrix(def.x, baseY, def.z, 0, rot, 0);
  put(B, G.box, '#a07a57', M, 0, 0.5, 0, 0, 0, 0, w, 1.0, d);
  B.add(gableGeometry(w, d, 0.55), mat('#a07a57'), sub(M, 0, 1.0, 0, 0));
  addGableRoof(B, mat(PAL.barnRed), M, w, d, 0.55, { overhang: 0.14, thick: 0.08, y: 1.0 });
  put(B, G.box, PAL.dark, M, 0, 0.32, d / 2 + 0.01, 0, 0, 0, 0.56, 0.5, 0.03);
  put(B, G.halfDisc, PAL.dark, M, 0, 0.57, d / 2 + 0.01, Math.PI / 2, 0, 0, 0.28, 0.03, 0.28);
  // water bowl
  const bowl = toWorld(M, 0.55, 0, d / 2 + 0.55);
  put(B, G.cyl, '#8a9aa6', makeMatrix(bowl.x, baseY, bowl.z), 0, 0.06, 0, 0, 0, 0, 0.22, 0.12, 0.22);
  C.addRect(def.x, def.z, w / 2 + 0.05, d / 2 + 0.05, rot, baseY, 1.6, { cam: false });
  out.bowl = bowl;
}

export function buildShelter(B, C, def, baseY) {
  const { w, d, rot } = def;
  const M = makeMatrix(def.x, baseY, def.z, 0, rot, 0);
  put(B, G.box, PAL.stone, M, 0, 0.8, -d / 2 + 0.15, 0, 0, 0, w, 1.6, 0.3);
  for (const s of [-1, 1]) put(B, G.box, PAL.stone, M, s * (w / 2 - 0.15), 0.8, 0, 0, 0, 0, 0.3, 1.6, d);
  put(B, G.box, PAL.slate, M, 0, 1.75, 0.1, -0.22, 0, 0, w + 0.4, 0.14, d + 0.5);
  put(B, G.box, PAL.dark, M, 0, 0.75, -d / 2 + 0.31, 0, 0, 0, w - 0.6, 1.4, 0.02);
  for (let i = 0; i < 5; i++) put(B, G.ico, PAL.hay, M, -1.6 + i * 0.8, 0.12, -0.2 + (i % 2) * 0.3, 0, i, 0, 0.5, 0.18, 0.4);
  C.addRect(def.x, def.z, w / 2, d / 2, rot, baseY, 2.2, { cam: false });
}

export function buildShed(B, C, def, baseY) {
  const { w, d, rot } = def;
  const M = makeMatrix(def.x, baseY, def.z, 0, rot, 0);
  const board = '#6d7864', trim = '#e4dcc8';
  put(B, G.box, '#7f8a74', M, 0, 1.1, 0, 0, 0, 0, w, 2.2, d);
  put(B, G.box, '#7f8a74', M, 0, 2.14, 0, 0.12, 0, 0, w - 0.04, 0.3, d - 0.1);
  put(B, G.box, '#5d5e5a', M, 0, 2.35, 0, 0.12, 0, 0, w + 0.3, 0.1, d + 0.4);
  put(B, G.box, '#62705c', M, 0.4, 0.95, d / 2 + 0.02, 0, 0, 0, 0.8, 1.8, 0.05);
  for (const s of [-1, 1]) put(B, G.box, trim, M, 0.4 + s * 0.43, 0.93, d / 2 + 0.03, 0, 0, 0, 0.06, 1.86, 0.06);
  put(B, G.box, trim, M, 0.4, 1.88, d / 2 + 0.03, 0, 0, 0, 0.92, 0.06, 0.06);
  windowAt(B, M, -0.8, 1.45, d / 2, 0.6, 0.5);
  put(B, G.sphereLo, PAL.brass, M, 0.7, 0.95, d / 2 + 0.07, 0, 0, 0, 0.04);
  for (let i = 1; i < 7; i++) put(B, G.box, board, M, -w / 2 + (i * w) / 7, 1.08, -d / 2 - 0.015, 0, 0, 0, 0.05, 2.1, 0.03);
  for (const s of [-1, 1]) {
    for (let i = 1; i < 6; i++) {
      const z = -d / 2 + (i * d) / 6;
      if (Math.abs(z) > 0.35) put(B, G.box, board, M, s * (w / 2 + 0.015), 1.08, z, 0, 0, 0, 0.03, 2.1, 0.05);
    }
    for (const t of [-1, 1]) put(B, G.box, trim, M, s * w / 2, 1.1, t * d / 2, 0, 0, 0, 0.1, 2.2, 0.1);
    windowAt(B, sub(M, s * w / 2, 0, 0, s * Math.PI / 2), 0, 1.45, 0, 0.6, 0.5);
  }
  C.addRect(def.x, def.z, w / 2 + 0.05, d / 2 + 0.05, rot, baseY, 2.5, { cam: true });
  const butt = toWorld(M, -w / 2 - 0.5, 0, -d / 2 + 0.45);
  buildButt(B, C, butt.x, butt.z, baseY);
}

/* ---------------------------------------------------------------- props */

export function bench(B, C, M, baseY) {
  put(B, G.box, PAL.wood, M, 0, 0.45, 0, 0, 0, 0, 1.6, 0.07, 0.42);
  put(B, G.box, PAL.wood, M, 0, 0.75, -0.2, 0.15, 0, 0, 1.6, 0.3, 0.05);
  for (const s of [-1, 1]) put(B, G.box, PAL.woodDark, M, s * 0.7, 0.22, 0, 0, 0, 0, 0.07, 0.45, 0.4);
  const p = toWorld(M, 0, 0, 0);
  C.addCircle(p.x, p.z, 0.55, baseY, 0.5, { stand: true, cam: false });
}

export function buildTrough(B, C, t, baseY) {
  const M = makeMatrix(t.x, baseY, t.z, 0, t.rot, 0);
  const { w, d } = t;
  const hh = 0.62;
  put(B, G.box, PAL.stone, M, 0, 0.08, 0, 0, 0, 0, w, 0.16, d);
  for (const s of [-1, 1]) {
    put(B, G.box, PAL.stone, M, 0, hh / 2, s * (d / 2 - 0.06), 0, 0, 0, w, hh, 0.12);
    put(B, G.box, PAL.stone, M, s * (w / 2 - 0.06), hh / 2, 0, 0, 0, 0, 0.12, hh, d - 0.24);
  }
  put(B, G.box, '#4f5a55', M, 0, 0.3, 0, 0, 0, 0, w - 0.24, 0.3, d - 0.24);
  C.addRect(t.x, t.z, w / 2, d / 2, t.rot, baseY, hh, { cam: false });
  return { M, waterY: baseY + 0.5, ww: w - 0.24, wd: d - 0.24 };
}

export function buildPump(B, C, x, z, baseY) {
  const M = makeMatrix(x, baseY, z, 0, 0.4, 0);
  put(B, G.box, PAL.stoneDark, M, 0, 0.1, 0, 0, 0, 0, 0.6, 0.2, 0.6);
  put(B, G.cyl, PAL.iron, M, 0, 0.75, 0, 0, 0, 0, 0.11, 1.2, 0.11);
  put(B, G.sphereLo, PAL.iron, M, 0, 1.38, 0, 0, 0, 0, 0.14);
  put(B, G.cyl, PAL.iron, M, 0, 1.0, 0.18, Math.PI / 2 - 0.3, 0, 0, 0.05, 0.4, 0.05);
  put(B, G.box, PAL.iron, M, 0, 1.4, -0.3, 0.5, 0, 0, 0.04, 0.04, 0.7);
  C.addCircle(x, z, 0.35, baseY, 1.4, { cam: false });
}

export function buildWell(B, C, x, z, baseY) {
  const M = makeMatrix(x, baseY, z, 0, 0.3, 0);
  put(B, G.cylOpen, PAL.stone, M, 0, 0.45, 0, 0, 0, 0, 1.12, 0.9, 1.12);
  put(B, G.cylOpen, '#5a5550', M, 0, 0.45, 0, 0, 0, 0, 0.9, 0.9, 0.9, { side: THREE.BackSide });
  B.add(new THREE.TorusGeometry(1.0, 0.16, 6, 22), mat(PAL.stoneLight), new THREE.Matrix4().multiplyMatrices(M, makeMatrix(0, 0.92, 0, Math.PI / 2, 0, 0)));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    put(B, G.box, i % 2 ? PAL.stoneDark : PAL.stoneLight, M, Math.cos(a) * 1.13, 0.2 + (i % 3) * 0.22, Math.sin(a) * 1.13, 0, -a, 0, 0.06, 0.2, 0.42);
  }
  for (const s of [-1, 1]) put(B, G.box, PAL.woodDark, M, s * 1.02, 1.35, 0, 0, 0, 0, 0.14, 2.3, 0.14);
  B.add(gableGeometry(2.5, 1.5, 0.75), mat(PAL.woodDark), sub(M, 0, 2.45, 0));
  addGableRoof(B, mat(PAL.slate), M, 2.5, 1.5, 0.75, { overhang: 0.2, thick: 0.1, y: 2.45 });
  put(B, G.cyl, PAL.wood, M, 0, 1.75, 0, 0, 0, Math.PI / 2, 0.08, 2.0, 0.08);
  put(B, G.box, PAL.woodDark, M, 1.2, 1.55, 0, 0, 0, 0, 0.06, 0.4, 0.06);
  put(B, G.cyl, '#3c3833', M, 0, 1.3, 0, 0, 0, 0, 0.012, 0.9, 0.012);
  put(B, G.cyl, '#8e6e52', M, 0.55, 1.0, 0.72, 0, 0, 0, 0.2, 0.26, 0.2);
  put(B, G.cyl, '#3c3833', M, 0.55, 1.05, 0.72, 0, 0, 0, 0.205, 0.03, 0.205);
  C.addCircle(x, z, 1.3, baseY, 3.2, { cam: false });
  return { waterY: baseY + 0.55, r: 0.88 };
}

export function buildBales(B, C, def, baseY) {
  const M = makeMatrix(def.x, baseY, def.z, 0, def.rot, 0);
  const bw = 1.15, bh = 0.55, bd = 0.62;
  const spots = def.stack === 3 ? [[-0.6, 0], [0.6, 0], [0, 1]] : def.stack === 2 ? [[0, 0], [0.05, 1]] : [[0, 0]];
  let top = 0;
  for (const [ox, lvl] of spots) {
    const y = bh / 2 + lvl * bh;
    put(B, G.box, PAL.hay, M, ox, y, 0, 0, lvl * 0.2, 0, bw, bh, bd, { amt: 0.2, scale: 2.2 });
    for (const s of [-0.3, 0.3]) put(B, G.box, '#8d7650', M, ox + s, y, 0, 0, lvl * 0.2, 0, 0.03, bh + 0.01, bd + 0.01);
    top = Math.max(top, (lvl + 1) * bh);
  }
  const hw = def.stack === 3 ? 1.2 : 0.6;
  C.addRect(def.x, def.z, hw, 0.35, def.rot, baseY, top, { stand: true, cam: false });
  return { top };
}

export function buildRick(B, C, def, baseY) {
  const M = makeMatrix(def.x, baseY, def.z);
  const r = def.r;
  put(B, G.cyl, PAL.hay, M, 0, 0.9, 0, 0, 0, 0, r, 1.8, r, { amt: 0.2, scale: 1.8 });
  put(B, G.cone, PAL.hayDark, M, 0, 1.8 + 0.95, 0, 0, 0, 0, r + 0.2, 1.9, r + 0.2, { amt: 0.2, scale: 1.8 });
  for (const y of [0.5, 1.2]) B.add(new THREE.TorusGeometry(r + 0.02, 0.04, 5, 24), mat('#8d7650'), new THREE.Matrix4().multiplyMatrices(M, makeMatrix(0, y, 0, Math.PI / 2, 0, 0)));
  put(B, G.cyl, PAL.woodDark, M, 0, 3.9, 0, 0, 0, 0, 0.05, 0.6, 0.05);
  C.addCircle(def.x, def.z, r + 0.1, baseY, 3.8, { cam: false });
}

export function buildHayrack(B, C, def, baseY) {
  const M = makeMatrix(def.x, baseY, def.z, 0, def.rot, 0);
  for (const sx of [-1, 1]) {
    put(B, G.box, PAL.woodDark, M, sx * 1.1, 0.7, 0, 0, 0, 0, 0.1, 1.4, 0.1);
    put(B, G.box, PAL.woodDark, M, sx * 1.1, 0.8, 0, 0, 0, 0, 0.08, 0.08, 1.1);
  }
  for (let i = -4; i <= 4; i++) {
    put(B, G.box, PAL.wood, M, i * 0.24, 1.0, 0.25, 0.35, 0, 0, 0.04, 0.8, 0.04);
    put(B, G.box, PAL.wood, M, i * 0.24, 1.0, -0.25, -0.35, 0, 0, 0.04, 0.8, 0.04);
  }
  put(B, G.box, PAL.wood, M, 0, 1.38, 0.38, 0, 0, 0, 2.3, 0.06, 0.06);
  put(B, G.box, PAL.wood, M, 0, 1.38, -0.38, 0, 0, 0, 2.3, 0.06, 0.06);
  for (let i = 0; i < 5; i++) put(B, G.ico, i % 2 ? PAL.hay : PAL.hayDark, M, -0.8 + i * 0.4, 1.3, 0, 0, i, 0, 0.36, 0.28, 0.3);
  C.addRect(def.x, def.z, 1.2, 0.45, def.rot, baseY, 1.5, { cam: false });
}

export function buildMarket(B, C, def, baseY) {
  const M = makeMatrix(def.x, baseY, def.z, 0, def.rot, 0);
  put(B, G.box, PAL.wood, M, 0, 0.85, 0, 0, 0, 0, 2.8, 0.08, 1.1);
  put(B, G.box, '#7c6049', M, 0, 0.45, 0.5, 0, 0, 0, 2.8, 0.75, 0.05);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(B, G.box, PAL.woodDark, M, sx * 1.35, sz > 0 ? 1.05 : 1.25, sz * 0.5, 0, 0, 0, 0.08, sz > 0 ? 2.1 : 2.5, 0.08);
  for (let i = 0; i < 8; i++) {
    const x = -1.4 + 0.175 + i * 0.35;
    put(B, G.box, i % 2 ? PAL.cream : '#b8514a', M, x, 2.33, 0.05, -0.28, 0, 0, 0.35, 0.04, 1.5);
    put(B, G.box, i % 2 ? PAL.cream : '#b8514a', M, x, 2.02, 0.78, 0, 0, 0, 0.35, 0.22, 0.03);
  }
  const fruitC = ['#c4473b', '#b9be5a', '#7a4a78', '#d08a3a'];
  for (let b = 0; b < 4; b++) {
    const bx = -1.05 + b * 0.7;
    put(B, G.cyl, '#a07c52', M, bx, 1.0, 0.12, 0, 0, 0, 0.28, 0.24, 0.28);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, rr = i === 0 ? 0 : 0.16;
      put(B, G.sphereLo, fruitC[b], M, bx + Math.cos(a) * rr, 1.16 + (i === 0 ? 0.08 : 0), 0.12 + Math.sin(a) * rr, 0, 0, 0, b === 1 ? 0.075 : 0.085, b === 1 ? 0.1 : 0.085, b === 1 ? 0.075 : 0.085);
    }
  }
  for (const [x, z] of [[-0.8, -0.9], [0.6, -1.0]]) {
    put(B, G.box, '#a8845a', M, x, 0.25, z, 0, 0.2, 0, 0.7, 0.5, 0.5);
    for (let i = 0; i < 5; i++) put(B, G.sphereLo, '#c4473b', M, x - 0.2 + i * 0.1, 0.55, z + (i % 2) * 0.1, 0, 0, 0, 0.08);
  }
  C.addRect(def.x, def.z, 1.5, 0.7, def.rot, baseY, 2.6, { cam: false });
  return { front: toWorld(M, 0, 0, 1.0) };
}

export function buildCart(B, C, x, z, rot, baseY) {
  const M = makeMatrix(x, baseY, z, 0, rot, 0);
  put(B, G.box, PAL.wood, M, 0, 0.95, 0, 0, 0, 0, 1.5, 0.12, 3.0);
  for (const s of [-1, 1]) {
    put(B, G.box, PAL.woodDark, M, s * 0.72, 1.2, 0, 0, 0, 0, 0.08, 0.4, 3.0);
    put(B, G.box, PAL.woodDark, M, s * 0.45, 0.55, 2.3, 0.35, 0, 0, 0.07, 0.07, 2.0);
  }
  for (const s of [-1, 1]) for (const zz of [-1.0, 1.0]) {
    const wr = zz < 0 ? 0.62 : 0.5;
    const W = new THREE.Matrix4().multiplyMatrices(M, makeMatrix(s * 0.86, wr, zz, 0, 0, Math.PI / 2));
    B.add(new THREE.TorusGeometry(wr, 0.06, 5, 16), mat(PAL.woodDark), new THREE.Matrix4().multiplyMatrices(W, makeMatrix(0, 0, 0, Math.PI / 2, 0, 0)));
    for (let k = 0; k < 4; k++) put(B, G.box, PAL.wood, W, 0, 0, 0, 0, k * Math.PI / 4, 0, 0.04, 0.05, wr * 2);
  }
  for (let i = 0; i < 7; i++) put(B, G.ico, i % 2 ? PAL.hay : PAL.hayDark, M, (i % 2 - 0.5) * 0.5, 1.3 + (i % 3) * 0.1, -1.2 + i * 0.4, 0, i, 0, 0.55, 0.35, 0.5);
  C.addRect(x, z, 0.85, 1.6, rot, baseY, 1.8, { cam: false });
  return { top: toWorld(M, 0, 1.4, 0) };
}

export function buildScarecrow(B, C, x, z, baseY) {
  const M = makeMatrix(x, baseY, z, 0, 0.5, 0);
  put(B, G.box, PAL.woodDark, M, 0, 1.0, 0, 0, 0, 0, 0.08, 2.0, 0.08);
  put(B, G.box, PAL.woodDark, M, 0, 1.45, 0, 0, 0, 0, 1.6, 0.07, 0.07);
  put(B, G.box, PAL.blue, M, 0, 1.3, 0, 0, 0, 0, 0.55, 0.62, 0.3);
  for (const s of [-1, 1]) put(B, G.box, PAL.blue, M, s * 0.52, 1.43, 0, 0, 0, s * 0.08, 0.55, 0.18, 0.2);
  for (let i = 0; i < 3; i++) put(B, G.sphereLo, PAL.brass, M, 0.08, 1.45 - i * 0.14, 0.16, 0, 0, 0, 0.03);
  put(B, G.sphere, '#d8c49a', M, 0, 1.82, 0, 0, 0, 0, 0.2, 0.22, 0.2);
  put(B, G.cyl, '#b9975e', M, 0, 2.0, 0, 0, 0, 0, 0.34, 0.03, 0.34);
  put(B, G.cyl, '#b9975e', M, 0, 2.1, 0, 0, 0, 0, 0.17, 0.2, 0.17);
  for (const s of [-1, 1]) put(B, G.cone, PAL.hay, M, s * 0.84, 1.43, 0, 0, 0, s * Math.PI / 2, 0.06, 0.14, 0.06);
  put(B, G.sphereLo, PAL.dark, M, -0.07, 1.86, 0.18, 0, 0, 0, 0.025);
  put(B, G.sphereLo, PAL.dark, M, 0.07, 1.86, 0.18, 0, 0, 0, 0.025);
  C.addCircle(x, z, 0.3, baseY, 2.2, { cam: false });
}

export function buildWheelbarrow(B, x, z, rot, baseY) {
  const M = makeMatrix(x, baseY, z, 0, rot, 0);
  put(B, G.box, '#7f8a74', M, 0, 0.5, 0, 0.1, 0, 0, 0.7, 0.3, 0.9);
  put(B, G.cyl, PAL.woodDark, M, 0, 0.22, 0.6, 0, 0, Math.PI / 2, 0.2, 0.08, 0.2);
  for (const s of [-1, 1]) {
    put(B, G.box, PAL.wood, M, s * 0.3, 0.45, -0.5, 0.15, 0, 0, 0.05, 0.05, 1.3);
    put(B, G.box, PAL.woodDark, M, s * 0.28, 0.18, -0.2, 0, 0, 0, 0.05, 0.36, 0.05);
  }
  for (let i = 0; i < 3; i++) put(B, G.ico, PAL.earth, M, (i - 1) * 0.18, 0.66, 0.05 * i, 0, i, 0, 0.2, 0.1, 0.25);
}

export function buildWateringCan(B, x, z, rot, baseY) {
  const M = makeMatrix(x, baseY, z, 0, rot, 0);
  put(B, G.cyl, '#7f9aa2', M, 0, 0.18, 0, 0, 0, 0, 0.14, 0.34, 0.14);
  put(B, G.cyl, '#7f9aa2', M, 0, 0.26, 0.24, 0.9, 0, 0, 0.025, 0.4, 0.025);
  put(B, G.cone, '#7f9aa2', M, 0, 0.4, 0.4, 0.9, 0, 0, 0.05, 0.08, 0.05);
  B.add(new THREE.TorusGeometry(0.12, 0.018, 5, 12, Math.PI), mat('#7f9aa2'), new THREE.Matrix4().multiplyMatrices(M, makeMatrix(0, 0.34, -0.02, 0, Math.PI / 2, 0)));
}

export function buildPots(B, x, z, baseY) {
  const M = makeMatrix(x, baseY, z);
  const pot = (px, py, pz, s, tilt = 0) => {
    put(B, G.cyl, '#b8714f', M, px, py, pz, tilt, 0, 0, 0.16 * s, 0.26 * s, 0.16 * s);
    put(B, G.cyl, '#a86446', M, px, py + 0.13 * s, pz, tilt, 0, 0, 0.18 * s, 0.05 * s, 0.18 * s);
  };
  pot(0, 0.13, 0, 1); pot(0.35, 0.13, 0.05, 1); pot(0.17, 0.39, 0.02, 1);
  pot(-0.35, 0.1, 0.25, 0.8, 1.4);
  put(B, G.ico, PAL.leaf, M, 0.35, 0.33, 0.05, 0, 0, 0, 0.16, 0.14, 0.16);
  put(B, G.sphereLo, '#e36d5e', M, 0.38, 0.45, 0.08, 0, 0, 0, 0.05);
}

export function buildSignpost(scene, x, z, baseY, faces) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#d7c19a';
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(120, 90, 60, ${0.05 + Math.random() * 0.08})`;
    g.beginPath(); const y = Math.random() * 256; g.moveTo(0, y); g.bezierCurveTo(170, y + 4, 340, y - 4, 512, y + 2); g.stroke();
  }
  g.fillStyle = '#4a3b2c';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  faces.forEach((f, i) => {
    g.font = 'italic 54px "IM Fell English", Georgia, serif';
    g.fillText(f.text, 256, 42 + i * 85);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  group.position.set(x, baseY, z);
  const wood = mat(PAL.woodDark);
  const post = new THREE.Mesh(G.box, wood);
  post.scale.set(0.14, 2.3, 0.14); post.position.y = 1.15; post.castShadow = true; group.add(post);
  faces.forEach((f, i) => {
    const arm = new THREE.Group();
    arm.position.y = 2.0 - i * 0.34;
    arm.rotation.y = f.angle;
    const geo = new THREE.BoxGeometry(1.2, 0.26, 0.05);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1) / 3 + uv.getY(k) / 3);
    const board = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
    board.position.x = 0.62;
    board.castShadow = true;
    arm.add(board);
    const tip = new THREE.Mesh(G.cone, mat('#d7c19a'));
    tip.scale.set(0.13, 0.2, 0.025);
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = 1.3;
    arm.add(tip);
    group.add(arm);
  });
  scene.add(group);
  return group;
}

export function buildWashingLine(B, C, x1, z1, x2, z2, baseY1, baseY2) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = Math.atan2(-(z2 - z1), x2 - x1);
  for (const [x, z, y] of [[x1, z1, baseY1], [x2, z2, baseY2]]) {
    const M = makeMatrix(x, y, z, 0, ang, 0);
    put(B, G.box, PAL.woodGrey, M, 0, 1.0, 0, 0, 0, 0, 0.09, 2.0, 0.09);
    put(B, G.box, PAL.woodGrey, M, 0, 1.95, 0, 0, 0, 0, 0.06, 0.06, 0.7);
    C.addCircle(x, z, 0.2, y, 2, { cam: false });
  }
  const yMid = (baseY1 + baseY2) / 2;
  const M = makeMatrix((x1 + x2) / 2, yMid, (z1 + z2) / 2, 0, ang, 0);
  put(B, G.cylLo, '#e8e2d4', M, 0, 1.88, 0, 0, 0, Math.PI / 2, 0.01, len, 0.01);
  const clothes = [['#f2eee6', 0.55, 0.7], ['#8fb0d1', 0.5, 0.55], ['#e9b8c4', 0.6, 0.5], ['#f2eee6', 0.35, 0.35], ['#c9b27c', 0.5, 0.65], ['#f2eee6', 0.45, 0.8]];
  const side = { side: THREE.DoubleSide };
  clothes.forEach(([c, w, h], i) => {
    const t = -len / 2 + 0.6 + (i / (clothes.length - 1)) * (len - 1.2);
    put(B, G.plane, c, M, t, 1.86 - h / 2, 0, 0, 0.1 * (i % 2 ? 1 : -1), 0, w, h, 1, side);
    if (i === 1 || i === 4) put(B, G.plane, c, M, t, 1.86 - h - 0.12, 0, 0, 0, 0, w * 0.7, 0.35, 1, side);
  });
}

export function buildBeehive(B, C, x, z, baseY, rot = 0) {
  const M = makeMatrix(x, baseY, z, 0, rot, 0);
  put(B, G.box, PAL.woodDark, M, 0, 0.15, 0, 0, 0, 0, 0.6, 0.3, 0.6);
  for (let i = 0; i < 3; i++) put(B, G.box, '#efe9dc', M, 0, 0.45 + i * 0.3, 0, 0, 0, 0, 0.72 - i * 0.04, 0.26, 0.72 - i * 0.04);
  B.add(gableGeometry(0.8, 0.8, 0.3), mat('#efe9dc'), sub(M, 0, 1.28, 0));
  put(B, G.box, PAL.dark, M, 0, 0.36, 0.37, 0, 0, 0, 0.3, 0.05, 0.02);
  C.addRect(x, z, 0.4, 0.4, rot, baseY, 1.5, { cam: false });
}

export function buildChurns(B, C, x, z, baseY) {
  const M = makeMatrix(x, baseY, z);
  [[0, 0], [0.5, 0.15], [0.2, 0.5]].forEach(([ox, oz], i) => {
    put(B, G.cyl, '#b9bdb8', M, ox, 0.35, oz, 0, 0, 0, 0.2, 0.7, 0.2);
    put(B, G.cyl, '#b9bdb8', M, ox, 0.78, oz, 0, 0, 0, 0.12, 0.18, 0.12);
    put(B, G.cyl, '#9ea39d', M, ox, 0.9, oz, 0, 0, 0, 0.15, 0.06, 0.15);
    put(B, G.cyl, '#8e928c', M, ox, 0.45, oz, 0, 0, 0, 0.205, 0.04, 0.205);
    void i;
  });
  C.addCircle(x + 0.25, z + 0.2, 0.6, baseY, 0.95, { cam: false });
}

export function buildButt(B, C, x, z, baseY) {
  const M = makeMatrix(x, baseY, z);
  put(B, G.cyl, '#7d5f45', M, 0, 0.5, 0, 0, 0, 0, 0.42, 1.0, 0.42);
  for (const y of [0.15, 0.5, 0.85]) put(B, G.cyl, '#4f4a44', M, 0, y, 0, 0, 0, 0, 0.435, 0.06, 0.435);
  put(B, G.cyl, '#5a7f86', M, 0, 0.96, 0, 0, 0, 0, 0.37, 0.04, 0.37);
  C.addCircle(x, z, 0.45, baseY, 1.0, { cam: false, stand: true });
}

export function buildLogs(B, C, x, z, rot, baseY) {
  const M = makeMatrix(x, baseY, z, 0, rot, 0);
  const rows = [[4, 0.18], [3, 0.5], [2, 0.82]];
  rows.forEach(([n, y], r) => {
    for (let i = 0; i < n; i++) {
      const ox = (i - (n - 1) / 2) * 0.36;
      put(B, G.cyl, '#7a6049', M, ox, y, 0, Math.PI / 2, 0, 0, 0.17, 1.8, 0.17);
      put(B, G.cyl, '#d9c49c', M, ox, y, 0.905, Math.PI / 2, 0, 0, 0.15, 0.02, 0.15);
      put(B, G.cyl, '#d9c49c', M, ox, y, -0.905, Math.PI / 2, 0, 0, 0.15, 0.02, 0.15);
    }
    void r;
  });
  C.addRect(x, z, 0.8, 0.95, rot, baseY, 1.0, { cam: false, stand: true });
}

/* ---------------------------------------------------------------- fences and walls */

/* Post-and-rail fence along a polyline */
export function railFence(B, C, pts, heightAt, color = '#8c7058') {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(len / 2.4));
    const ang = Math.atan2(-(z2 - z1), x2 - x1);
    for (let k = 0; k < n; k++) {
      const ax = x1 + (x2 - x1) * (k / n), az = z1 + (z2 - z1) * (k / n);
      const bx = x1 + (x2 - x1) * ((k + 1) / n), bz = z1 + (z2 - z1) * ((k + 1) / n);
      const ya = heightAt(ax, az), yb = heightAt(bx, bz);
      put(B, G.box, PAL.woodDark, makeMatrix(ax, ya, az, 0, ang, 0), 0, 0.55, 0, 0, 0, 0, 0.14, 1.12, 0.14);
      const seg = Math.hypot(bx - ax, bz - az);
      const tilt = Math.atan2(yb - ya, seg);
      const Mm = makeMatrix((ax + bx) / 2, (ya + yb) / 2, (az + bz) / 2, 0, ang, 0);
      for (const y of [0.45, 0.88]) put(B, G.box, color, Mm, 0, y, 0.04, 0, 0, tilt, seg + 0.1, 0.1, 0.05);
    }
    const [lx, lz] = pts[i + 1];
    put(B, G.box, PAL.woodDark, makeMatrix(lx, heightAt(lx, lz), lz, 0, ang, 0), 0, 0.55, 0, 0, 0, 0, 0.14, 1.12, 0.14);
    C.addSegment(x1, z1, x2, z2, 0.3, Math.min(heightAt(x1, z1), heightAt(x2, z2)), 1.0, { cam: false });
  }
}

/* Picket fence along a polyline */
export function picketFence(B, C, pts, heightAt, color = '#ede6d6') {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(-(z2 - z1), x2 - x1);
    const n = Math.max(1, Math.round(len / 0.24));
    for (let k = 0; k <= n; k++) {
      const x = x1 + (x2 - x1) * (k / n), z = z1 + (z2 - z1) * (k / n);
      const y = heightAt(x, z);
      const M = makeMatrix(x, y, z, 0, ang, 0);
      const post = k % 8 === 0;
      put(B, G.box, color, M, 0, post ? 0.5 : 0.42, 0, 0, 0, 0, post ? 0.1 : 0.075, post ? 1.0 : 0.84, post ? 0.1 : 0.03);
      put(B, G.box, color, M, 0, post ? 1.02 : 0.86, 0, 0, 0, Math.PI / 4, post ? 0.08 : 0.053, post ? 0.08 : 0.053, post ? 0.1 : 0.03);
    }
    const segs = Math.max(1, Math.round(len / 2));
    for (let k = 0; k < segs; k++) {
      const ax = x1 + (x2 - x1) * (k / segs), az = z1 + (z2 - z1) * (k / segs);
      const bx = x1 + (x2 - x1) * ((k + 1) / segs), bz = z1 + (z2 - z1) * ((k + 1) / segs);
      const ya = heightAt(ax, az), yb = heightAt(bx, bz);
      const seg = Math.hypot(bx - ax, bz - az);
      const Mm = makeMatrix((ax + bx) / 2, (ya + yb) / 2, (az + bz) / 2, 0, ang, 0);
      for (const y of [0.25, 0.65]) put(B, G.box, color, Mm, 0, y, -0.04, 0, 0, Math.atan2(yb - ya, seg), seg, 0.06, 0.04);
    }
    C.addSegment(x1, z1, x2, z2, 0.25, Math.min(heightAt(x1, z1), heightAt(x2, z2)), 0.95, { cam: false });
  }
}

/* Dry-stone wall – the grey walls that climb every Lakeland fell */
export function stoneWall(B, C, pts, heightAt, { collide = true, h = 0.85, seed = 1 } = {}) {
  const rnd = mulberry32(seed);
  const cols = [PAL.stone, PAL.stoneDark, PAL.stoneLight, '#9d9a8e'];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(-(z2 - z1), x2 - x1);
    const segs = Math.max(1, Math.round(len / 3));
    for (let k = 0; k < segs; k++) {
      const ax = x1 + (x2 - x1) * (k / segs), az = z1 + (z2 - z1) * (k / segs);
      const bx = x1 + (x2 - x1) * ((k + 1) / segs), bz = z1 + (z2 - z1) * ((k + 1) / segs);
      const ya = heightAt(ax, az), yb = heightAt(bx, bz);
      const seg = Math.hypot(bx - ax, bz - az);
      const tilt = Math.atan2(yb - ya, seg);
      const M = makeMatrix((ax + bx) / 2, (ya + yb) / 2, (az + bz) / 2, 0, ang, 0);
      put(B, G.box, PAL.stone, M, 0, h / 2 - 0.1, 0, 0, 0, tilt, seg + 0.3, h + 0.2, 0.62, { amt: 0.22, scale: 1.6 });
      const nStones = Math.round(seg / 0.34);
      for (let s = 0; s < nStones; s++) {
        const t = -seg / 2 + (s + 0.5) * (seg / nStones);
        const yy = h + 0.08 + t * Math.tan(tilt);
        put(B, G.box, cols[Math.floor(rnd() * cols.length)], M, t, yy, 0, 0, 0, 0.25 * (rnd() - 0.5) + tilt, 0.12 + rnd() * 0.08, 0.26 + rnd() * 0.08, 0.5 + rnd() * 0.12, { amt: 0.2 });
      }
      for (let s = 0; s < seg * 1.2; s++) {
        const t = (rnd() - 0.5) * seg;
        const side = rnd() < 0.5 ? -1 : 1;
        put(B, G.box, cols[Math.floor(rnd() * cols.length)], M, t, 0.15 + rnd() * (h - 0.3) + t * Math.tan(tilt), side * 0.31, rnd() * 0.3, rnd(), 0, 0.3 + rnd() * 0.2, 0.14 + rnd() * 0.08, 0.06, { amt: 0.2 });
      }
    }
    if (collide) C.addSegment(x1, z1, x2, z2, 0.66, Math.min(heightAt(x1, z1), heightAt(x2, z2)), h, { stand: true, cam: false });
  }
}

/* Five-bar gate (open angle in radians about the hinge) */
export function gate(B, x, z, ang, heightAt, open = 0, len = 3.2) {
  const y = heightAt(x, z);
  const H = makeMatrix(x, y, z, 0, ang + open, 0);
  put(B, G.box, PAL.woodDark, makeMatrix(x, y, z, 0, ang, 0), 0, 0.65, 0, 0, 0, 0, 0.2, 1.35, 0.2);
  for (let i = 0; i < 5; i++) put(B, G.box, '#9a8b76', H, len / 2, 0.25 + i * 0.2, 0, 0, 0, 0, len, 0.08, 0.05);
  put(B, G.box, '#9a8b76', H, len / 2, 0.65, 0.04, 0, 0, Math.atan2(0.8, len), Math.hypot(len, 0.8), 0.08, 0.05);
  put(B, G.box, '#9a8b76', H, len - 0.05, 0.65, 0, 0, 0, 0, 0.1, 1.0, 0.07);
}

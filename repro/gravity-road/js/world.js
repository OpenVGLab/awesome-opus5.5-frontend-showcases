// Everything around the road: the yellow wall and its ceiling, two towns (one hanging), furniture,
// landscape, the radio on the roof, road lettering and loose pages of music.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HW, THICK, STEP } from './config.js';
import { basicMaterial, archMaterial, groundMaterial, roadMaterial, decalMaterial, shared, mulberry32 } from './materials.js';
import { makeFrame, buildRoadGeometry, appendRoadStrip, stripGeometry } from './track.js';
import { buildRadio } from './car.js';
import { canvasTexture, clefCanvas, timeSigCanvas, sharpCanvas, roadTextCanvas, musicPageCanvas } from './paint.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

class ArchBuilder {
  constructor() { this.P = []; this.N = []; this.C = []; this.F = []; this.K = []; }
  push(pts, uvs, n, col, kind, seed, cell) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      this.P.push(p.x, p.y, p.z);
      this.N.push(n.x, n.y, n.z);
      this.C.push(col.r, col.g, col.b);
      this.F.push(uvs[i][0], uvs[i][1], kind, seed);
      this.K.push(cell[0], cell[1], cell[2], cell[3]);
    }
  }
  quad(a, b, c, d, uvs, hint, col, kind, seed, cell) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (n.dot(hint) < 0) {
      n.negate();
      this.push([a, c, b, a, d, c], [uvs[0], uvs[2], uvs[1], uvs[0], uvs[3], uvs[2]], n, col, kind, seed, cell);
    } else {
      this.push([a, b, c, a, c, d], [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]], n, col, kind, seed, cell);
    }
  }
  tri(a, b, c, uvs, hint, col, kind, seed, cell) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (n.dot(hint) < 0) { n.negate(); this.push([a, c, b], [uvs[0], uvs[2], uvs[1]], n, col, kind, seed, cell); }
    else this.push([a, b, c], uvs, n, col, kind, seed, cell);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aFac', new THREE.Float32BufferAttribute(this.F, 4));
    g.setAttribute('aCell', new THREE.Float32BufferAttribute(this.K, 4));
    g.computeBoundingSphere();
    return g;
  }
}

// A box in a local frame (a along e1, b along e2, c along e3); no bottom face.
function boxFaces(ab, P, e1, e2, e3, a0, a1, b0, b1, c0, c1, col, kind, seed) {
  const neg = (v) => v.clone().negate();
  const cell = [3.2, 3.6, 1, 1];
  ab.quad(P(a0, b0, c0), P(a1, b0, c0), P(a1, b1, c0), P(a0, b1, c0), [[0, 0], [1, 0], [1, 1], [0, 1]], neg(e3), col, kind, seed, cell);
  ab.quad(P(a1, b0, c1), P(a0, b0, c1), P(a0, b1, c1), P(a1, b1, c1), [[0, 0], [1, 0], [1, 1], [0, 1]], e3, col, kind, seed, cell);
  ab.quad(P(a1, b0, c0), P(a1, b0, c1), P(a1, b1, c1), P(a1, b1, c0), [[0, 0], [1, 0], [1, 1], [0, 1]], e1, col, kind, seed, cell);
  ab.quad(P(a0, b0, c1), P(a0, b0, c0), P(a0, b1, c0), P(a0, b1, c1), [[0, 0], [1, 0], [1, 1], [0, 1]], neg(e1), col, kind, seed, cell);
  ab.quad(P(a0, b1, c0), P(a1, b1, c0), P(a1, b1, c1), P(a0, b1, c1), [[0, 0], [1, 0], [1, 1], [0, 1]], e2, col, kind, seed, cell);
}

// A house standing on O (centre of the front wall's bottom edge), front facing -e3, up e2.
function addHouse(ab, O, e1, e2, e3, o) {
  const P = (a, b, c) => O.clone().addScaledVector(e1, a).addScaledVector(e2, b).addScaledVector(e3, c);
  const neg = (v) => v.clone().negate();
  const { w, d, h, wall, roof, seed } = o;
  const nk = o.night ? 10 : 0;
  const hw = w / 2;
  const cell = (fw, fh) => [3.2, 3.6, fw, fh];
  ab.quad(P(-hw, 0, 0), P(hw, 0, 0), P(hw, h, 0), P(-hw, h, 0), [[0, 0], [w, 0], [w, h], [0, h]], neg(e3), wall, 4 + nk, seed, cell(w, h));
  ab.quad(P(hw, 0, d), P(-hw, 0, d), P(-hw, h, d), P(hw, h, d), [[0, 0], [w, 0], [w, h], [0, h]], e3, wall, 1 + nk, seed, cell(w, h));
  ab.quad(P(hw, 0, 0), P(hw, 0, d), P(hw, h, d), P(hw, h, 0), [[0, 0], [d, 0], [d, h], [0, h]], e1, wall, 1 + nk, seed, cell(d, h));
  ab.quad(P(-hw, 0, d), P(-hw, 0, 0), P(-hw, h, 0), P(-hw, h, d), [[0, 0], [d, 0], [d, h], [0, h]], neg(e1), wall, 1 + nk, seed, cell(d, h));
  const ov = 0.35;
  let rh;
  if (o.ridgeAlong) {
    rh = d * 0.42;
    const sl = Math.hypot(d / 2 + ov, rh);
    ab.quad(P(-hw - ov, h - 0.12, -ov), P(hw + ov, h - 0.12, -ov), P(hw + ov, h + rh, d / 2), P(-hw - ov, h + rh, d / 2),
      [[0, 0], [w, 0], [w, sl], [0, sl]], e2.clone().sub(e3), roof, 2, seed, cell(w, h));
    ab.quad(P(hw + ov, h - 0.12, d + ov), P(-hw - ov, h - 0.12, d + ov), P(-hw - ov, h + rh, d / 2), P(hw + ov, h + rh, d / 2),
      [[0, 0], [w, 0], [w, sl], [0, sl]], e2.clone().add(e3), roof, 2, seed, cell(w, h));
    ab.tri(P(hw, h, 0), P(hw, h, d), P(hw, h + rh, d / 2), [[0, 0], [1, 0], [0.5, 1]], e1, wall, 0, seed, cell(d, h));
    ab.tri(P(-hw, h, d), P(-hw, h, 0), P(-hw, h + rh, d / 2), [[0, 0], [1, 0], [0.5, 1]], neg(e1), wall, 0, seed, cell(d, h));
  } else {
    rh = w * 0.42;
    const sl = Math.hypot(hw + ov, rh);
    ab.quad(P(-hw - ov, h - 0.12, d + ov), P(-hw - ov, h - 0.12, -ov), P(0, h + rh, -ov), P(0, h + rh, d + ov),
      [[0, 0], [d, 0], [d, sl], [0, sl]], e2.clone().sub(e1), roof, 2, seed, cell(d, h));
    ab.quad(P(hw + ov, h - 0.12, -ov), P(hw + ov, h - 0.12, d + ov), P(0, h + rh, d + ov), P(0, h + rh, -ov),
      [[0, 0], [d, 0], [d, sl], [0, sl]], e2.clone().add(e1), roof, 2, seed, cell(d, h));
    ab.tri(P(-hw, h, 0), P(hw, h, 0), P(0, h + rh, 0), [[0, 0], [1, 0], [0.5, 1]], neg(e3), wall, 0, seed, cell(w, h));
    ab.tri(P(hw, h, d), P(-hw, h, d), P(0, h + rh, d), [[0, 0], [1, 0], [0.5, 1]], e3, wall, 0, seed, cell(w, h));
  }
  if (o.chimney) {
    const ca = (o.chimney - 0.5) * w * 0.5;
    const cc = d * 0.28;
    boxFaces(ab, P, e1, e2, e3, ca - 0.5, ca + 0.5, h, h + rh + 1.3, cc - 0.5, cc + 0.5, o.brick, 0, seed);
  }
}

function frameMatrix(track, F, s, x, h, yaw, scale) {
  track.frame(s, F);
  const m = new THREE.Matrix4().makeBasis(F.b, F.n, F.t.clone().negate());
  if (yaw) m.multiply(new THREE.Matrix4().makeRotationY(yaw));
  m.scale(new THREE.Vector3(scale, scale, scale));
  m.setPosition(F.p.clone().addScaledVector(F.b, x).addScaledVector(F.n, h));
  return m;
}

function uprightMatrix(x, y, z, yaw, scale) {
  const m = new THREE.Matrix4().makeRotationY(yaw);
  m.scale(new THREE.Vector3(scale, scale, scale));
  m.setPosition(x, y, z);
  return m;
}

function instanced(geo, mat, items, colorKey = 'color') {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  items.forEach((it, i) => {
    m.setMatrixAt(i, it.m);
    if (it[colorKey]) m.setColorAt(i, it[colorKey]);
  });
  if (!items.length) m.count = 0;
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false;
  return m;
}

function colorize(geo, hex) {
  const c = C(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function treeGeometries() {
  const trunk = new THREE.CylinderGeometry(0.2, 0.32, 3.4, 6).translate(0, 1.7, 0);
  const canopy = mergeGeometries([
    new THREE.SphereGeometry(1.9, 12, 9).translate(0, 4.7, 0),
    new THREE.SphereGeometry(1.25, 10, 8).translate(1.0, 4.1, 0.5),
    new THREE.SphereGeometry(1.35, 10, 8).translate(-0.85, 4.35, -0.45),
    new THREE.SphereGeometry(1.1, 10, 8).translate(0.2, 5.9, 0.2),
  ]);
  return { trunk, canopy };
}

function lampGeometries() {
  const pole = mergeGeometries([
    new THREE.CylinderGeometry(0.09, 0.14, 5.4, 6).translate(0, 2.7, 0),
    new THREE.BoxGeometry(1.5, 0.1, 0.1).translate(-0.65, 5.35, 0),
    new THREE.CylinderGeometry(0.22, 0.26, 0.3, 6).translate(0, 0.15, 0),
  ]);
  const head = mergeGeometries([
    new THREE.SphereGeometry(0.34, 10, 8).translate(-1.3, 5.02, 0),
    new THREE.ConeGeometry(0.46, 0.34, 8).translate(-1.3, 5.3, 0),
  ]);
  return { pole, head };
}

function hillRing(r0, r1, hMin, hMax, seed, cz) {
  const rnd = mulberry32(seed);
  const seg = 180, rows = 8;
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const pos = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * Math.PI * 2;
    const n = 0.5 + 0.22 * Math.sin(a * 3 + ph[0]) + 0.16 * Math.sin(a * 7 + ph[1]) + 0.08 * Math.sin(a * 17 + ph[2]) + 0.04 * Math.sin(a * 31 + ph[3]);
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      const r = r0 + (r1 - r0) * t;
      const prof = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.9);
      const y = (hMin + (hMax - hMin) * n) * prof - 2;
      pos.push(Math.cos(a) * r, y, cz + Math.sin(a) * r);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j, b = a + rows + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export const riverZ = (x) => 760 + 200 * Math.sin(x * 0.0021) + 80 * Math.sin(x * 0.0057 + 1.3);

const WALLS_DAY = [0xe3b46c, 0xd9845c, 0xe8a7a0, 0xaac190, 0xa3c6d8, 0xf0e1c0, 0xbcaad2, 0xe9c77e];
const ROOFS_DAY = [0xb5523b, 0x8c5a44, 0x5d6f8a, 0xc97a4a, 0xa8483a];
const WALLS_NIGHT = [0xb7a9d6, 0x9fb7d8, 0xd9b8c9, 0xa9c9c0, 0xe6d6b8, 0xc5b3e0];
const ROOFS_NIGHT = [0x4f5d85, 0x6a557e, 0x3f6a78, 0x7c4f63];
const TREE_GREENS = [0x7fa35a, 0x5e8c4a, 0xa2b85d, 0x6f9a6a, 0x8db36b, 0x557f55];

export function buildWorld(scene, track, song, { bloomTex, faceTex }) {
  const rnd = mulberry32(20260924);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const F = makeFrame();
  const d = track.dims;
  const L = d.L;
  const S = d.streets;

  // --- the building: yellow wall + ceiling slab -------------------------------------------
  const W = 180;
  const zF = d.zWallRoad - THICK;
  const zB = zF - 40;
  const yS = d.yCeilRoad + THICK;
  const yT = yS + 32;
  const zE = 0;
  shared.uWallMin.value.set(-W, 0, zB);
  shared.uWallMax.value.set(W, yT, zF);
  shared.uSlabMin.value.set(-W, yS, zB);
  shared.uSlabMax.value.set(W, yT, zE);
  shared.uShadowZ.value = zF + 40;

  const bld = new ArchBuilder();
  const giant = (fw, fh) => [14, 16, fw, fh];
  bld.quad(V(-W, 0, zF), V(W, 0, zF), V(W, yS, zF), V(-W, yS, zF), [[0, 0], [2 * W, 0], [2 * W, yS], [0, yS]], V(0, 0, 1), C(0xf3c74a), 6, 0.11, giant(2 * W, yS));
  bld.quad(V(W, 0, zB), V(-W, 0, zB), V(-W, yT, zB), V(W, yT, zB), [[0, 0], [2 * W, 0], [2 * W, yT], [0, yT]], V(0, 0, -1), C(0xe7b64e), 6, 0.21, giant(2 * W, yT));
  for (const sx of [-1, 1]) {
    const x = sx * W;
    bld.quad(V(x, 0, zB), V(x, 0, zF), V(x, yS, zF), V(x, yS, zB), [[0, 0], [40, 0], [40, yS], [0, yS]], V(sx, 0, 0), C(0xeabb4f), 6, 0.31, giant(40, yS));
    bld.quad(V(x, yS, zB), V(x, yS, zE), V(x, yT, zE), V(x, yT, zB), [[0, 0], [zE - zB, 0], [zE - zB, yT - yS], [0, yT - yS]], V(sx, 0, 0), C(0xf1e5c6), 5, 0.52, [1, 1, zE - zB, yT - yS]);
  }
  bld.quad(V(-W, yS, zF), V(W, yS, zF), V(W, yS, zE), V(-W, yS, zE), [[0, 0], [2 * W, 0], [2 * W, zE - zF], [0, zE - zF]], V(0, -1, 0), C(0xc3bdd6), 3, 0.61, [24, 24, 2 * W, zE - zF]);
  bld.quad(V(-W, yS, zE), V(W, yS, zE), V(W, yT, zE), V(-W, yT, zE), [[0, 0], [2 * W, 0], [2 * W, yT - yS], [0, yT - yS]], V(0, 0, 1), C(0xf1e5c6), 5, 0.72, [1, 1, 2 * W, yT - yS]);
  bld.quad(V(-W, yT, zB), V(W, yT, zB), V(W, yT, zE), V(-W, yT, zE), [[0, 0], [2 * W, 0], [2 * W, zE - zB], [0, zE - zB]], V(0, 1, 0), C(0xaea5b3), 3, 0.83, [12, 12, 2 * W, zE - zB]);
  // rooftop: chimneys and a water tank
  const up = V(0, 1, 0), ex = V(1, 0, 0), ez = V(0, 0, 1);
  const PW = (a, b, c) => V(a, b, c);
  for (let i = 0; i < 7; i++) {
    const cx = -150 + rnd() * 300, cz = zB + 8 + rnd() * (zE - zB - 16);
    if (Math.abs(cx - 60) < 40 && Math.abs(cz + 70) < 40) continue;
    const hh = 8 + rnd() * 10;
    boxFaces(bld, PW, ex, up, ez, cx - 2.5, cx + 2.5, yT, yT + hh, cz - 2.5, cz + 2.5, C(0xc46f4e), 0, 0.9);
  }
  scene.add(new THREE.Mesh(bld.geometry(), archMaterial(100)));

  const tankM = basicMaterial({ color: 0x9d8f86, id: 140 });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 14, 16), tankM);
  tank.position.set(-80, yT + 16, -300);
  scene.add(tank);
  const tankRoof = new THREE.Mesh(new THREE.ConeGeometry(10, 6, 16), basicMaterial({ color: 0x6d6070, id: 141 }));
  tankRoof.position.set(-80, yT + 26, -300);
  scene.add(tankRoof);
  for (const [lx, lz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 9, 6), tankM);
    leg.position.set(-80 + lx, yT + 4.5, -300 + lz);
    scene.add(leg);
  }

  // the radio on the roof
  const bigRadio = buildRadio(30, faceTex, 170);
  bigRadio.group.position.set(62, yT, -64);
  bigRadio.group.rotation.y = 0.42;
  scene.add(bigRadio.group);

  // --- ground, hills, the road -------------------------------------------------------------
  const ground = new THREE.Mesh(new THREE.CircleGeometry(6500, 96).rotateX(-Math.PI / 2), groundMaterial([0, -195, 46, 202]));
  scene.add(ground);
  scene.add(new THREE.Mesh(hillRing(1500, 2350, 40, 150, 3, -190), basicMaterial({ color: 0x9db77a, id: 4, receive: 0 })));
  scene.add(new THREE.Mesh(hillRing(2600, 4600, 170, 460, 9, -190), basicMaterial({ color: 0x8ea3a6, id: 5, receive: 0 })));

  const road = new THREE.Mesh(buildRoadGeometry(track, 1), roadMaterial(track, bloomTex));
  road.frustumCulled = false;
  scene.add(road);

  // --- towns: Ochre Street on the ground, Ceiling Row hanging from the slab ----------------
  const towns = new ArchBuilder();
  const streetTrees = [];
  const buildTown = (s0, s1, night) => {
    for (const side of [-1, 1]) {
      let s = s0 + rnd() * 4;
      while (true) {
        const w = 7 + rnd() * 5.5;
        if (s + w > s1) break;
        const sm = s + w / 2;
        track.frame(sm, F);
        const off = HW + 2.8;
        const O = F.p.clone().addScaledVector(F.b, side * off).addScaledVector(F.n, -THICK);
        const floors = 2 + Math.floor(rnd() * 3);
        addHouse(towns, O, F.t.clone(), F.n.clone(), F.b.clone().multiplyScalar(side), {
          w, d: 7 + rnd() * 4, h: floors * 3.6 + 0.5,
          wall: C(pick(night ? WALLS_NIGHT : WALLS_DAY)), roof: C(pick(night ? ROOFS_NIGHT : ROOFS_DAY)),
          seed: rnd(), night, ridgeAlong: rnd() < 0.6, chimney: rnd() < 0.55 ? 0.1 + rnd() * 0.8 : 0, brick: C(0xb8674c),
        });
        const gap = 0.8 + rnd() * 3.4;
        if (gap > 2.6) streetTrees.push({ s: s + w + gap / 2, x: side * (off + 2.2), scale: 0.62 + rnd() * 0.2 });
        s += w + gap;
      }
    }
  };
  buildTown(S[0] + 8, S[1] - 6, false);
  buildTown(S[2] + 6, S[3] - 8, true);
  scene.add(new THREE.Mesh(towns.geometry(), archMaterial(20)));

  // --- street furniture: lamps and trees follow the road's idea of "up" --------------------
  const lamps = [];
  const trees = [];
  for (let st = 0; st < 3; st++) {
    for (let k = 0; ; k++) {
      const s = S[st] + (k + 0.5) * 30;
      if (s > S[st + 1] - 12) break;
      if (st === 0 && s < 20) continue;
      const side = (k % 2) * 2 - 1;
      lamps.push({ m: frameMatrix(track, F, s, side * (HW + 1.3), -THICK, side > 0 ? 0 : Math.PI, 1) });
    }
  }
  for (const t of streetTrees) {
    trees.push({ m: frameMatrix(track, F, t.s, t.x, -THICK, rnd() * 6.28, t.scale), color: C(pick(TREE_GREENS)) });
  }
  for (let s = S[1] + 22; s < S[2] - 20; s += 38 + rnd() * 10) {
    const side = rnd() < 0.5 ? -1 : 1;
    trees.push({ m: frameMatrix(track, F, s, side * (HW + 4 + rnd() * 5), -THICK, rnd() * 6.28, 0.9 + rnd() * 0.4), color: C(pick(TREE_GREENS)) });
  }

  // landscape: clumps of trees and scattered farmhouses (these still believe in gravity)
  const forbidden = (x, z) => (Math.abs(x) < 52 && z > zB - 20 && z < 25)
    || (Math.abs(x) < 45 && z > -10 && z < 235)
    || (Math.abs(x) < W + 12 && z > zB - 14 && z < zF + 4)
    || Math.abs(z - riverZ(x)) < 30;
  for (let c = 0; c < 52; c++) {
    const a = rnd() * Math.PI * 2, r = 140 + Math.pow(rnd(), 0.8) * 1500;
    const cx = Math.cos(a) * r, cz = -190 + Math.sin(a) * r;
    const n = 4 + Math.floor(rnd() * 9);
    for (let i = 0; i < n; i++) {
      const x = cx + (rnd() - 0.5) * 60, z = cz + (rnd() - 0.5) * 60;
      if (forbidden(x, z)) continue;
      trees.push({ m: uprightMatrix(x, 0, z, rnd() * 6.28, 1.1 + rnd() * 1.1), color: C(pick(TREE_GREENS)) });
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = (rnd() - 0.5) * 340, z = zF + 12 + rnd() * (Math.abs(zF) - 30);
    if (Math.abs(x) < 50 || forbidden(x, z)) continue;
    trees.push({ m: uprightMatrix(x, 0, z, rnd() * 6.28, 1.0 + rnd() * 0.7), color: C(pick(TREE_GREENS)) });
  }
  const farms = new ArchBuilder();
  for (let i = 0, placed = 0; i < 80 && placed < 18; i++) {
    const a = rnd() * Math.PI * 2, r = 260 + rnd() * 1250;
    const x = Math.cos(a) * r, z = -190 + Math.sin(a) * r;
    if (forbidden(x, z)) continue;
    const th = rnd() * Math.PI;
    const e1 = V(Math.cos(th), 0, -Math.sin(th)), e3 = V(Math.sin(th), 0, Math.cos(th));
    addHouse(farms, V(x, 0, z), e1, V(0, 1, 0), e3, {
      w: 9 + rnd() * 7, d: 7 + rnd() * 4, h: 4.1 + Math.floor(rnd() * 2) * 3.6,
      wall: C(pick([0xf0e1c0, 0xe3b46c, 0xe8d3b0, 0xd9845c])), roof: C(pick(ROOFS_DAY)), seed: rnd(), night: false,
      ridgeAlong: true, chimney: 0.3 + rnd() * 0.4, brick: C(0xb8674c),
    });
    placed++;
  }
  scene.add(new THREE.Mesh(farms.geometry(), archMaterial(20)));

  const tg = treeGeometries();
  scene.add(instanced(tg.trunk, basicMaterial({ color: 0x7a5a45, id: 10 }), trees.map((t) => ({ m: t.m }))));
  scene.add(instanced(tg.canopy, basicMaterial({ color: 0xffffff, id: 11 }), trees));
  const lg = lampGeometries();
  scene.add(instanced(lg.pole, basicMaterial({ color: 0x3b3544, id: 14 }), lamps));
  scene.add(instanced(lg.head, basicMaterial({ color: 0xffe2a0, id: 15, emissive: 0.85 }), lamps));

  // balconies and flower pots on the yellow facade (these obey the building's gravity)
  const balconyGeo = mergeGeometries([
    colorize(new THREE.BoxGeometry(6.4, 0.45, 2.5).translate(0, -0.22, 1.25), 0xefe6d2),
    colorize(new THREE.BoxGeometry(6.5, 0.14, 0.14).translate(0, 1.25, 2.43), 0x3b3544),
    colorize(new THREE.BoxGeometry(0.14, 0.14, 2.4).translate(3.18, 1.25, 1.2), 0x3b3544),
    colorize(new THREE.BoxGeometry(0.14, 0.14, 2.4).translate(-3.18, 1.25, 1.2), 0x3b3544),
    ...[-3.1, -1.55, 0, 1.55, 3.1].map((x) => colorize(new THREE.BoxGeometry(0.1, 1.25, 0.1).translate(x, 0.62, 2.43), 0x3b3544)),
  ]);
  const balconies = [];
  const pots = [];
  const potColors = [0xd9483b, 0xe57ba0, 0x9b5fc0, 0xf0a04b];
  for (let row = 0; row < 23; row++) {
    for (let cx = 0; cx < 25; cx++) {
      const x = -168 + 14 * cx;
      const yc = (row + 0.55) * 16;
      const yb = yc - 16 * 0.25 - 0.35;
      if (yb < 6 || yb > yS - 8) continue;
      const dist = Math.abs(x - track.wallRoadX(yb));
      if (dist < HW + 6) continue;
      const pr = dist < 55 ? 0.5 : 0.1;
      if (rnd() > pr) continue;
      balconies.push({ m: uprightMatrix(x, yb, zF, 0, 1) });
      for (let k = 0; k < 3; k++) {
        if (rnd() < 0.3) continue;
        pots.push({ m: uprightMatrix(x - 2.2 + k * 2.2, yb + 1.62, zF + 2.25, 0, 1), color: C(pick(potColors)) });
      }
    }
  }
  scene.add(instanced(balconyGeo, basicMaterial({ color: 0xffffff, id: 142, vertexColors: true }), balconies));
  scene.add(instanced(new THREE.SphereGeometry(0.42, 8, 6), basicMaterial({ color: 0xffffff, id: 143 }), pots));

  // --- paint on the road --------------------------------------------------------------------
  const paint = 0xf6f2e8, ink = 0x2a2433;
  const inkOrPaint = (s) => (track.musicness(s) < 0.3 ? paint : ink);
  const addDecal = (canvas, s0, s1, x0, x1, uvFn, color) => {
    const arr = { pos: [], nor: [], uv: [], idx: [] };
    appendRoadStrip(arr, track, s0, s1, x0, x1, 0.035, 6, uvFn);
    const mesh = new THREE.Mesh(stripGeometry(arr), decalMaterial(canvasTexture(canvas), color));
    mesh.renderOrder = 1;
    scene.add(mesh);
  };
  const driverUV = (u, j) => [j, u];
  const staffUV = (u, j) => [u, 1 - j];
  const textZones = road.material.uniforms.uTextZ.value;
  let nText = 0;
  const text = (lines, s0, len, arrow = false) => {
    textZones[nText++].set(s0 - 1, s0 + len + 1);
    addDecal(roadTextCanvas(lines, { arrow }), s0, s0 + len, -6.4, 6.4, driverUV, inkOrPaint(s0));
  };
  const staffTop = -7.43, staffBot = 7.77;
  const clefAt = (s0) => addDecal(clefCanvas(), s0, s0 + 6.5, staffTop, staffBot, staffUV, inkOrPaint(s0));
  text(['OCHRE ST'], S[0] + 6, 12);
  text(['UP THE', 'WALL'], S[1] - 70, 16, true);
  clefAt(S[1] + 3);
  addDecal(sharpCanvas(0.147), S[1] + 10, S[1] + 13.04, staffTop, staffBot, staffUV, inkOrPaint(S[1] + 10));
  addDecal(timeSigCanvas(), S[1] + 13.6, S[1] + 17.65, staffTop, staffBot, staffUV, inkOrPaint(S[1] + 14));
  text(['YELLOW', 'WALL'], S[1] + 22, 14);
  text(['ONTO THE', 'CEILING'], S[2] - 72, 16, true);
  clefAt(S[2] + 3);
  text(['CEILING', 'ROW'], S[2] + 14, 14);
  clefAt(S[3] + 3);
  addDecal(timeSigCanvas(), S[3] + 10, S[3] + 14.05, staffTop, staffBot, staffUV, ink);
  text(['CODA'], S[3] + 20, 12);

  // --- loose pages and big notes drifting around the sheet-music loop ------------------------
  const pageTex = [0, 1, 2].map((i) => canvasTexture(musicPageCanvas(i * 17 + 3)));
  const pageGeo = new THREE.PlaneGeometry(4.4, 6.2);
  const bigPageGeo = new THREE.PlaneGeometry(8.8, 12.4);
  const floaters = [];
  const loopC = V(0, THICK + d.R, 0);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + rnd() * Math.PI;
    const rr = d.R + (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 45);
    const base = V((rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 50), loopC.y + Math.sin(a) * rr, Math.cos(a) * rr);
    if (base.y < 12) base.y = 12 + rnd() * 10;
    const mesh = new THREE.Mesh(bigPageGeo, basicMaterial({ color: 0xffffff, id: 150 + i, map: pageTex[i % 3], doubleSide: true }));
    mesh.position.copy(base);
    scene.add(mesh);
    floaters.push({ mesh, base, ph: rnd() * 6.28, spin: V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.2), kind: 'page' });
  }
  for (let i = 0; i < 4; i++) {
    const s = 20 + rnd() * 330;
    track.frame(s, F);
    const base = F.p.clone().addScaledVector(F.b, (rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 10)).addScaledVector(F.n, 18 + rnd() * 14);
    const mesh = new THREE.Mesh(pageGeo, basicMaterial({ color: 0xffffff, id: 166 + i, map: pageTex[i % 3], doubleSide: true }));
    mesh.position.copy(base);
    scene.add(mesh);
    floaters.push({ mesh, base, ph: rnd() * 6.28, spin: V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5), kind: 'page' });
  }
  const noteHead = new THREE.SphereGeometry(1, 16, 10).scale(0.8, 0.56, 0.32).rotateZ(0.36);
  const noteStem = new THREE.CylinderGeometry(0.075, 0.075, 3.3, 6).translate(0.74, 1.7, 0);
  const inkM = basicMaterial({ color: 0x241f2e, id: 180 });
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + rnd() * Math.PI;
    const rr = d.R * (0.45 + rnd() * 0.4);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(noteHead, inkM));
    g.add(new THREE.Mesh(noteStem, inkM));
    if (rnd() < 0.5) {
      const g2 = new THREE.Mesh(noteHead, inkM); g2.position.set(2.6, 0.7, 0); g.add(g2);
      const s2 = new THREE.Mesh(noteStem, inkM); s2.position.set(2.6, 0.7, 0); g.add(s2);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.34, 0.2), inkM);
      beam.position.set(2.04, 3.35 + 0.35, 0); beam.rotation.z = 0.26; g.add(beam);
    }
    const base = V((rnd() - 0.5) * 50, loopC.y + Math.sin(a) * rr, Math.cos(a) * rr + 10);
    g.position.copy(base);
    g.scale.setScalar(3.2 + rnd() * 2.6);
    scene.add(g);
    floaters.push({ mesh: g, base, ph: rnd() * 6.28, spin: V(0, (rnd() - 0.5) * 0.8, 0), kind: 'note' });
  }

  const radioState = { sway: 0, v: 0 };
  function update(dt, t) {
    for (const f of floaters) {
      const k = f.kind === 'page' ? 1 : 0.4;
      f.mesh.position.set(f.base.x + Math.sin(t * 0.3 + f.ph) * 6 * k, f.base.y + Math.sin(t * 0.5 + f.ph * 2) * 4, f.base.z + Math.cos(t * 0.27 + f.ph) * 6 * k);
      f.mesh.rotation.x += f.spin.x * dt;
      f.mesh.rotation.y += f.spin.y * dt;
      f.mesh.rotation.z += f.spin.z * dt;
    }
    radioState.v += (-radioState.sway * 3 - radioState.v * 0.8 + Math.sin(t * 1.3) * 0.25) * dt;
    radioState.sway += radioState.v * dt;
    bigRadio.pivot.rotation.z = radioState.sway * 0.3;
    bigRadio.pivot.rotation.x = 0.12;
    bigRadio.flag.rotation.x = Math.sin(t * 3) * 0.4;
  }

  return { update, bigRadio, building: { W, zF, zB, yS, yT, zE } };
}

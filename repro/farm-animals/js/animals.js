import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { washMaterial, paintGeometry, noise3, clamp, lerp, damp, TAU } from './util.js';

/*
 * Every animal is built from soft primitives. Parts that move together are merged per bone,
 * so a whole animal costs a dozen draw calls. Animals face +z; the root sits on the ground.
 */

export const SPECIES = {
  horse: {
    label: 'Horse', name: 'Horse', walk: 4.3, run: 9.6, turn: 2.3, jump: 1.7, scale: 0.92,
    cam: { dist: 7.2, height: 3.0, look: 2.0 }, blurb: 'Tall and quick, with a straw hat',
  },
  pig: {
    label: 'Pig', name: 'Pig', walk: 3.5, run: 6.6, turn: 2.8, jump: 1.35, scale: 1,
    cam: { dist: 5.0, height: 2.0, look: 1.0 }, blurb: 'Round and happy, in a blue jacket',
  },
  cow: {
    label: 'Cow', name: 'Cow', walk: 3.4, run: 6.8, turn: 2.2, jump: 1.35, scale: 0.95,
    cam: { dist: 6.6, height: 2.75, look: 1.6 }, blurb: 'Gentle and big, with a bell that rings',
  },
  cat: {
    label: 'Cat', name: 'Cat', walk: 3.3, run: 7.2, turn: 3.2, jump: 2.1, scale: 1.1,
    cam: { dist: 4.2, height: 1.6, look: 0.75 }, blurb: 'Small and bouncy, jumps the highest',
  },
  dog: {
    label: 'Dog', name: 'Dog', walk: 3.9, run: 8.2, turn: 3.0, jump: 1.65, scale: 1.05,
    cam: { dist: 4.8, height: 1.85, look: 0.95 }, blurb: 'Waggy and fast, with a red neckerchief',
  },
  sheep: { label: 'Sheep', walk: 1.6, scale: 1 },
  duck: { label: 'Duck', walk: 1.2, scale: 1.2 },
  hen: { label: 'Hen', walk: 1.3, scale: 1.25 },
  rabbit: { label: 'Rabbit', walk: 2.0, scale: 1.3 },
  hedgehog: { label: 'Hedgehog', walk: 0.8, scale: 1.3 },
};
export const PLAYABLE = ['horse', 'pig', 'cow', 'cat', 'dog'];

const UG = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  sphereHi: new THREE.SphereGeometry(1, 22, 16),
  sphereLo: new THREE.SphereGeometry(1, 9, 7),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 10),
  box: new THREE.BoxGeometry(1, 1, 1),
};
const taperCache = new Map();
function taper(top, bottom, seg = 9) {
  const k = `${top}:${bottom}:${seg}`;
  if (!taperCache.has(k)) taperCache.set(k, new THREE.CylinderGeometry(top, bottom, 1, seg));
  return taperCache.get(k);
}
/* torus with its axis along +y, so `along()` can wrap it around a neck */
const ringCache = new Map();
function ring(tube = 0.2) {
  if (!ringCache.has(tube)) ringCache.set(tube, new THREE.TorusGeometry(1, tube, 6, 18).rotateX(Math.PI / 2));
  return ringCache.get(tube);
}

export const ANIMAL_MAT = washMaterial({ vertexColors: true }, { amt: 0.09, space: 'local' });
const EYE_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const EYE_GEO = (() => {
  const a = new THREE.SphereGeometry(1, 12, 10);
  paintGeometry(a, '#241c17');
  const b = new THREE.SphereGeometry(0.3, 6, 5);
  b.translate(0.3, 0.38, 0.82);
  paintGeometry(b, '#fbf6ea');
  return mergeGeometries([a.toNonIndexed(), b.toNonIndexed()]);
})();

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

class RigBuilder {
  constructor() { this.parts = new Map(); }
  _push(bone, g) {
    let list = this.parts.get(bone);
    if (!list) { list = []; this.parts.set(bone, list); }
    list.push(g);
  }
  /* add(bone, geometry, colour | fn(x,y,z,c), position, euler, scale) */
  add(bone, geo, color, p, r = [0, 0, 0], s = [1, 1, 1]) {
    const g = geo.clone();
    paintGeometry(g, color);
    _e.set(r[0], r[1], r[2]);
    _q.setFromEuler(_e);
    g.applyMatrix4(new THREE.Matrix4().compose(_v.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2])));
    this._push(bone, g);
  }
  /* an ellipsoid-like part whose long (y) axis points along dir */
  along(bone, geo, color, p, dir, rx, half, rz) {
    const g = geo.clone();
    paintGeometry(g, color);
    _q.setFromUnitVectors(_up, _v.set(dir[0], dir[1], dir[2]).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), _q, _s.set(rx, half, rz)));
    this._push(bone, g);
  }
  build() {
    for (const [bone, list] of this.parts) {
      const geos = list.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) n.deleteAttribute(k);
        return n;
      });
      const merged = mergeGeometries(geos, false);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, ANIMAL_MAT);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      bone.add(mesh);
    }
  }
}

function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function makeRig(species) {
  const root = new THREE.Group();
  const pivot = group(root);
  const body = group(pivot);
  return { species, root, pivot, body, neck: null, head: null, ears: [], tail: [], legs: [], eyes: [], wings: [], extras: {}, dims: {} };
}

function eyes(rig, head, x, y, z, r, turn = 0.45) {
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(EYE_GEO, EYE_MAT);
    m.position.set(s * x, y, z);
    m.scale.setScalar(r);
    m.rotation.y = s * turn;
    head.add(m);
    rig.eyes.push(m);
  }
}

/* A leg: hip pivot → upper segment → knee pivot → lower segment → hoof or paw */
function leg(rb, rig, parent, [x, y, z], up, low, rU, rL, cU, cL, foot = { kind: 'hoof', color: '#3d3129', h: 0.08 }) {
  const hip = group(parent, x, y, z);
  rb.add(hip, taper(1, rL * 1.25 / rU), cU, [0, -up / 2, 0], [0, 0, 0], [rU, up, rU]);
  rb.add(hip, UG.sphere, cU, [0, -up * 0.12, 0], [0, 0, 0], [rU * 1.3, up * 0.42, rU * 1.45]);
  const knee = group(hip, 0, -up, 0);
  rb.add(knee, UG.sphereLo, cL, [0, 0, 0], [0, 0, 0], [rL * 1.08, rL * 1.08, rL * 1.08]);
  if (foot.kind === 'hoof') {
    rb.add(knee, taper(rL, rL * 1.05), cL, [0, -(low - foot.h) / 2, 0], [0, 0, 0], [1, low - foot.h, 1]);
    rb.add(knee, taper(rL * 1.15, rL * 1.4), foot.color, [0, -low + foot.h / 2, 0.01], [0, 0, 0], [1, foot.h, 1]);
  } else {
    rb.add(knee, taper(rL, rL * 1.05), cL, [0, -low / 2, 0], [0, 0, 0], [1, low, 1]);
    rb.add(knee, UG.sphere, foot.color, [0, -low + foot.h * 0.5, foot.fwd ?? rL * 0.6], [0, 0, 0], [rL * 1.3, foot.h, foot.len ?? rL * 2]);
  }
  rig.legs.push({ hip, knee, len: up + low });
}

const patchy = (a, b, seed, th = 0.56, sc = 1.7) => (x, y, z, c) => c.set(noise3(x * sc + seed, y * sc - seed, z * sc + 2 * seed) > th ? b : a);

/* ------------------------------------------------------------------ horse */
function buildHorse(variant) {
  const rig = makeRig('horse');
  const rb = new RigBuilder();
  const V = {
    bay: { coat: '#6d4530', dark: '#2d231f', muzzle: '#3e2c24', socks: false, hat: false, blaze: false },
    grey: { coat: '#b3aba0', dark: '#6f675f', muzzle: '#7d746c', socks: false, hat: false, blaze: false, dapple: '#cfc8bd' },
  }[variant] || { coat: '#8c5a3b', dark: '#46322a', muzzle: '#5e4234', socks: true, hat: true, blaze: true };
  const C = { coat: V.coat, dark: V.dark, white: '#efe6d6', hoof: '#3b3029', muzzle: V.muzzle, straw: '#dcc27f', ribbon: '#6f95ba' };
  const coat = V.dapple ? patchy(V.coat, V.dapple, 4.2, 0.62, 5) : C.coat;
  const hipH = 1.08;
  rig.body.position.y = hipH;
  rb.add(rig.body, UG.sphereHi, coat, [0, 0.2, 0], [0, 0, 0], [0.4, 0.42, 0.9]);
  rb.add(rig.body, UG.sphere, coat, [0, 0.24, 0.5], [0, 0, 0], [0.38, 0.46, 0.42]);
  rb.add(rig.body, UG.sphere, coat, [0, 0.28, -0.55], [0, 0, 0], [0.41, 0.44, 0.46]);
  const Lf = hipH + 0.05;
  for (const [sx, z, sock] of [[-1, 0.52, true], [1, 0.52, false], [-1, -0.56, false], [1, -0.56, true]]) {
    leg(rb, rig, rig.body, [sx * 0.2, 0.05, z], 0.5, Lf - 0.5, 0.1, 0.058, C.coat, sock && V.socks ? C.white : C.coat, { kind: 'hoof', color: C.hoof, h: 0.09 });
  }
  const neck = group(rig.body, 0, 0.42, 0.7);
  rig.neck = neck;
  rb.along(neck, UG.sphere, C.coat, [0, 0.32, 0.14], [0, 1, 0.55], 0.19, 0.5, 0.26);
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    rb.add(neck, UG.sphere, C.dark, [0, 0.08 + t * 0.66, -0.1 + t * 0.4], [0.5, 0, 0], [0.065, 0.13, 0.1]);
  }
  const head = group(neck, 0, 0.82, 0.42);
  rig.head = head;
  rb.along(head, UG.sphere, C.coat, [0, -0.06, 0.13], [0, -0.75, 1], 0.165, 0.36, 0.19);
  if (V.blaze) rb.along(head, UG.sphere, C.white, [0, -0.04, 0.15], [0, -0.75, 1], 0.05, 0.3, 0.2);
  else if (variant === 'bay') rb.add(head, UG.sphereLo, C.white, [0, 0.06, 0.17], [0.6, 0, 0], [0.045, 0.06, 0.02]);
  rb.add(head, UG.sphere, C.coat, [0, 0.0, -0.02], [0, 0, 0], [0.185, 0.2, 0.2]);
  rb.add(head, UG.sphere, C.muzzle, [0, -0.28, 0.37], [0, 0, 0], [0.145, 0.13, 0.16]);
  for (const s of [-1, 1]) rb.add(head, UG.sphereLo, '#2a211b', [s * 0.065, -0.26, 0.5], [0, 0, 0], [0.028, 0.035, 0.02]);
  rb.add(head, UG.sphere, C.dark, [0, 0.2, 0.06], [0.7, 0, 0], [0.06, 0.12, 0.08]);
  eyes(rig, head, 0.155, 0.04, 0.1, 0.042, 0.8);
  for (const s of [-1, 1]) {
    const ear = group(head, s * 0.09, 0.19, -0.05);
    rb.add(ear, UG.cone, C.coat, [0, 0.09, 0], [-0.15, 0, -s * 0.2], [0.055, 0.2, 0.045]);
    rig.ears.push(ear);
  }
  if (V.hat) {
    // straw hat with a blue ribbon
    rb.add(head, UG.cyl, C.straw, [0, 0.29, -0.03], [-0.1, 0, 0], [0.25, 0.025, 0.25]);
    rb.add(head, taper(0.115, 0.13), C.straw, [0, 0.37, -0.04], [-0.1, 0, 0], [1, 0.14, 1]);
    rb.add(head, UG.cyl, C.ribbon, [0, 0.33, -0.035], [-0.1, 0, 0], [0.133, 0.035, 0.133]);
    rb.add(head, UG.sphereLo, '#d4574a', [0.12, 0.34, 0.03], [0, 0, 0], [0.035, 0.035, 0.035]);
    rb.add(head, UG.sphereLo, '#f2e7c2', [0.1, 0.36, 0.07], [0, 0, 0], [0.028, 0.028, 0.028]);
  } else {
    // a halter instead
    rb.along(head, ring(0.1), '#7a4b37', [0, -0.12, 0.28], [0, 1, 0.75], 0.17, 0.17, 0.17);
    rb.along(head, ring(0.1), '#7a4b37', [0, 0.02, 0.03], [0, 1, -0.2], 0.2, 0.2, 0.2);
  }
  const tail = group(rig.body, 0, 0.44, -0.98);
  rb.along(tail, UG.sphere, C.dark, [0, -0.28, -0.08], [0, -1, -0.35], 0.07, 0.33, 0.1);
  rb.along(tail, UG.sphere, C.dark, [0, -0.62, -0.2], [0, -1, -0.15], 0.09, 0.22, 0.11);
  rig.tail.push(tail);
  rb.build();
  rig.dims = { hipH, height: 2.5, headY: 2.05, mouth: [0, 1.55, 1.45], radius: 0.62, len: 2.3, stride: 2.3, legAmp: 0.5, kneeAmp: 0.9, bob: 0.05, neckDown: 1.45, neckBase: 0, walk: 4.3 };
  return rig;
}

/* ------------------------------------------------------------------ cow */
function buildCow() {
  const rig = makeRig('cow');
  const rb = new RigBuilder();
  const C = { white: '#f1ece1', brown: '#8f5b3d', pink: '#e0ab9d', hoof: '#3b3029', horn: '#ede3c8', leather: '#6b4a34', brass: '#c9a45a' };
  const hipH = 0.8;
  rig.body.position.y = hipH;
  const pat = (seed) => patchy(C.white, C.brown, seed, 0.54, 1.6);
  rb.add(rig.body, UG.sphereHi, pat(3.1), [0, 0.26, 0], [0, 0, 0], [0.5, 0.48, 0.9]);
  rb.add(rig.body, UG.sphere, pat(7.7), [0, 0.2, 0.55], [0, 0, 0], [0.44, 0.48, 0.4]);
  rb.add(rig.body, UG.sphere, pat(1.3), [0, 0.33, -0.58], [0, 0, 0], [0.46, 0.44, 0.42]);
  rb.add(rig.body, UG.sphere, C.white, [0, 0.04, 0.05], [0, 0, 0], [0.45, 0.38, 0.72]);
  for (const s of [-1, 1]) rb.add(rig.body, UG.sphereLo, C.brown, [s * 0.3, 0.6, -0.62], [0, 0, 0], [0.12, 0.1, 0.12]);
  rb.add(rig.body, UG.sphere, C.pink, [0, -0.2, -0.38], [0, 0, 0], [0.16, 0.12, 0.17]);
  for (const [sx, z, y] of [[-1, 0.55, 0.0], [1, 0.55, 0.0], [-1, -0.6, 0.05], [1, -0.6, 0.05]]) {
    const L = hipH + y;
    leg(rb, rig, rig.body, [sx * 0.27, y, z], L * 0.53, L * 0.47, 0.12, 0.065, (sx + z) > 0 ? C.white : C.brown, C.white, { kind: 'hoof', color: C.hoof, h: 0.08 });
  }
  const neck = group(rig.body, 0, 0.36, 0.8);
  rig.neck = neck;
  rb.along(neck, UG.sphere, pat(4.4), [0, 0.05, 0.16], [0, 0.45, 1], 0.27, 0.3, 0.3);
  rb.add(neck, UG.sphere, C.white, [0, -0.16, 0.1], [0, 0, 0], [0.2, 0.18, 0.28]);
  // collar and bell
  rb.along(neck, ring(0.12), C.leather, [0, 0.02, 0.2], [0, 0.45, 1], 0.28, 0.28, 0.28);
  rb.add(neck, UG.cone, C.brass, [0, -0.3, 0.3], [0, 0, 0], [0.075, 0.14, 0.075]);
  rb.add(neck, UG.sphereLo, C.brass, [0, -0.37, 0.3], [0, 0, 0], [0.078, 0.03, 0.078]);
  const head = group(neck, 0, 0.12, 0.44);
  rig.head = head;
  rb.along(head, UG.sphere, (x, y, z, c) => c.set(Math.abs(x) > 0.45 && y > -0.1 ? C.brown : C.white), [0, 0, 0.1], [0, -0.55, 1], 0.22, 0.3, 0.24);
  rb.add(head, UG.sphere, C.pink, [0, -0.2, 0.33], [0, 0, 0], [0.2, 0.15, 0.15]);
  for (const s of [-1, 1]) rb.add(head, UG.sphereLo, '#8a5550', [s * 0.075, -0.19, 0.46], [0, 0, 0], [0.03, 0.035, 0.02]);
  rb.add(head, UG.sphereLo, C.brown, [0, 0.2, 0.02], [0, 0, 0], [0.1, 0.07, 0.09]);
  for (const s of [-1, 1]) rb.add(head, UG.cone, C.horn, [s * 0.14, 0.24, -0.04], [0, 0, -s * 0.85], [0.035, 0.17, 0.035]);
  eyes(rig, head, 0.19, 0.06, 0.12, 0.045, 0.9);
  for (const s of [-1, 1]) {
    const ear = group(head, s * 0.22, 0.1, 0);
    rb.add(ear, UG.sphere, C.brown, [s * 0.09, 0, 0], [0, 0, s * 0.3], [0.12, 0.045, 0.075]);
    rb.add(ear, UG.sphereLo, C.pink, [s * 0.1, 0.02, 0.012], [0, 0, s * 0.3], [0.08, 0.02, 0.05]);
    rig.ears.push(ear);
  }
  // a daisy tucked behind the ear
  rb.add(head, UG.sphereLo, '#f7f3ea', [-0.2, 0.2, -0.05], [0, 0, 0], [0.07, 0.025, 0.07]);
  rb.add(head, UG.sphereLo, '#e5b93a', [-0.2, 0.215, -0.05], [0, 0, 0], [0.028, 0.02, 0.028]);
  const tail = group(rig.body, 0, 0.58, -0.98);
  rb.along(tail, UG.cyl, C.white, [0, -0.32, -0.04], [0, -1, -0.12], 0.03, 0.66, 0.03);
  rb.add(tail, UG.sphere, C.brown, [0, -0.66, -0.08], [0, 0, 0], [0.06, 0.12, 0.06]);
  rig.tail.push(tail);
  rb.build();
  rig.dims = { hipH, height: 1.85, headY: 1.45, mouth: [0, 1.1, 1.62], radius: 0.66, len: 2.2, stride: 1.8, legAmp: 0.42, kneeAmp: 0.7, bob: 0.04, neckDown: 1.0, neckBase: 0, walk: 3.4, bell: true };
  return rig;
}

/* ------------------------------------------------------------------ pig */
function buildPig() {
  const rig = makeRig('pig');
  const rb = new RigBuilder();
  const C = { pink: '#ecb6a6', dark: '#dc9a8c', snout: '#dc978b', trotter: '#7d5b52', jacket: '#6c8fb7', jacketDark: '#557aa3', brass: '#d0a955' };
  const hipH = 0.3;
  rig.body.position.y = hipH;
  rb.add(rig.body, UG.sphereHi, C.pink, [0, 0.2, 0], [0, 0, 0], [0.36, 0.35, 0.57]);
  rb.add(rig.body, UG.sphere, C.pink, [0, 0.22, -0.3], [0, 0, 0], [0.35, 0.34, 0.34]);
  const jacket = new THREE.SphereGeometry(1, 22, 14, -0.35, Math.PI + 0.7, 0, Math.PI * 0.62);
  rb.add(rig.body, jacket, C.jacket, [0, 0.2, 0.02], [0, 0, 0], [0.372, 0.362, 0.585]);
  rb.add(rig.body, UG.sphereLo, C.jacketDark, [0, 0.49, 0.3], [0.6, 0, 0], [0.23, 0.06, 0.16]);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) rb.add(rig.body, UG.sphereLo, C.brass, [s * (0.29 - i * 0.02), 0.14 - i * 0.1, 0.4 - i * 0.03], [0, 0, 0], [0.028, 0.028, 0.028]);
  for (const [sx, z, y] of [[-1, 0.32, 0.02], [1, 0.32, 0.02], [-1, -0.33, 0.04], [1, -0.33, 0.04]]) {
    const L = hipH + y;
    leg(rb, rig, rig.body, [sx * 0.19, y, z], L * 0.52, L * 0.48, 0.09, 0.066, C.pink, C.pink, { kind: 'hoof', color: C.trotter, h: 0.05 });
  }
  const neck = group(rig.body, 0, 0.28, 0.46);
  rig.neck = neck;
  const head = group(neck, 0, 0, 0);
  rig.head = head;
  rb.add(head, UG.sphere, C.pink, [0, 0, 0.1], [0, 0, 0], [0.24, 0.23, 0.24]);
  for (const s of [-1, 1]) rb.add(head, UG.sphereLo, C.pink, [s * 0.11, -0.08, 0.16], [0, 0, 0], [0.12, 0.1, 0.12]);
  rb.add(head, UG.cyl, C.snout, [0, -0.04, 0.35], [Math.PI / 2, 0, 0], [0.105, 0.14, 0.1]);
  rb.add(head, UG.cyl, C.dark, [0, -0.04, 0.422], [Math.PI / 2, 0, 0], [0.097, 0.02, 0.092]);
  for (const s of [-1, 1]) rb.add(head, UG.sphereLo, '#8a5550', [s * 0.035, -0.04, 0.432], [0, 0, 0], [0.02, 0.026, 0.012]);
  eyes(rig, head, 0.115, 0.07, 0.26, 0.03, 0.4);
  for (const s of [-1, 1]) {
    const ear = group(head, s * 0.13, 0.17, 0.1);
    rb.add(ear, UG.sphere, C.dark, [s * 0.02, 0.02, 0.07], [0.75, 0, -s * 0.3], [0.1, 0.03, 0.14]);
    rig.ears.push(ear);
  }
  const tail = group(rig.body, 0, 0.32, -0.62);
  rb.add(tail, new THREE.TorusGeometry(1, 0.28, 6, 14, Math.PI * 1.6), C.dark, [0, 0.03, -0.03], [0, Math.PI / 2, 0], [0.06, 0.06, 0.06]);
  rig.tail.push(tail);
  rb.build();
  rig.dims = { hipH, height: 0.95, headY: 0.65, mouth: [0, 0.58, 0.95], radius: 0.4, len: 1.25, stride: 1.0, legAmp: 0.55, kneeAmp: 0.6, bob: 0.035, neckDown: 0.62, neckBase: 0, walk: 3.5 };
  return rig;
}

/* ------------------------------------------------------------------ cat */
function buildCat(variant) {
  const rig = makeRig('cat');
  const rb = new RigBuilder();
  const C = variant === 'grey'
    ? { base: '#9b968e', stripe: '#6c6760', white: '#f4ecdf', pink: '#e2a3a0', bow: '#6f95ba', lace: '#f7f1e3' }
    : { base: '#d99a5c', stripe: '#b5703d', white: '#f4ecdf', pink: '#e2a3a0', bow: '#d98c9b', lace: '#f7f1e3' };
  const tabby = (x, y, z, c) => {
    if (y < -0.45) return c.set(C.white);
    return c.set(Math.sin(z * 9 + noise3(x * 3, y * 3, z * 3) * 3) > 0.35 ? C.stripe : C.base);
  };
  const hipH = 0.24;
  rig.body.position.y = hipH;
  rb.add(rig.body, UG.sphere, tabby, [0, 0.13, 0], [0, 0, 0], [0.13, 0.14, 0.3]);
  rb.add(rig.body, UG.sphere, (x, y, z, c) => c.set(z > 0.3 && y < 0.3 ? C.white : C.base), [0, 0.14, 0.2], [0, 0, 0], [0.12, 0.14, 0.13]);
  rb.add(rig.body, UG.sphere, tabby, [0, 0.15, -0.2], [0, 0, 0], [0.13, 0.14, 0.14]);
  for (const [sx, z, y] of [[-1, 0.2, 0.02], [1, 0.2, 0.02], [-1, -0.21, 0.04], [1, -0.21, 0.04]]) {
    const L = hipH + y;
    leg(rb, rig, rig.body, [sx * 0.075, y, z], L * 0.5, L * 0.5, 0.036, 0.026, C.base, C.base, { kind: 'paw', color: C.white, h: 0.03, len: 0.05, fwd: 0.018 });
  }
  const neck = group(rig.body, 0, 0.2, 0.26);
  rig.neck = neck;
  rb.along(neck, UG.sphere, C.base, [0, 0.05, 0.02], [0, 1, 0.5], 0.075, 0.09, 0.08);
  rb.along(neck, ring(0.22), C.lace, [0, 0.0, 0.0], [0, 1, 0.5], 0.08, 0.08, 0.08);
  rb.add(neck, UG.cone, C.bow, [-0.045, -0.02, 0.085], [0, 0, Math.PI / 2], [0.03, 0.06, 0.018]);
  rb.add(neck, UG.cone, C.bow, [0.045, -0.02, 0.085], [0, 0, -Math.PI / 2], [0.03, 0.06, 0.018]);
  rb.add(neck, UG.sphereLo, C.bow, [0, -0.02, 0.09], [0, 0, 0], [0.018, 0.018, 0.018]);
  const head = group(neck, 0, 0.13, 0.07);
  rig.head = head;
  rb.add(head, UG.sphere, (x, y, z, c) => c.set(y > 0.5 && Math.sin(x * 14) > 0.3 ? C.stripe : C.base), [0, 0, 0], [0, 0, 0], [0.12, 0.105, 0.11]);
  for (const s of [-1, 1]) rb.add(head, UG.sphereLo, (x, y, z, c) => c.set(y < -0.1 ? C.white : C.base), [s * 0.055, -0.035, 0.05], [0, 0, 0], [0.066, 0.055, 0.06]);
  rb.add(head, UG.sphereLo, C.white, [0, -0.045, 0.095], [0, 0, 0], [0.05, 0.035, 0.035]);
  rb.add(head, UG.sphereLo, C.pink, [0, -0.018, 0.125], [0, 0, 0], [0.018, 0.013, 0.012]);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    rb.along(head, UG.cyl, '#fbf6ea', [s * 0.1, -0.035 + (i - 1) * 0.012, 0.1], [s, (i - 1) * 0.15, 0.2], 0.0025, 0.12, 0.0025);
  }
  eyes(rig, head, 0.047, 0.02, 0.088, 0.021, 0.35);
  for (const s of [-1, 1]) {
    const ear = group(head, s * 0.062, 0.08, -0.01);
    rb.add(ear, UG.cone, C.base, [0, 0.045, 0], [0, 0, -s * 0.35], [0.045, 0.09, 0.02]);
    rb.add(ear, UG.cone, C.pink, [s * -0.004, 0.04, 0.009], [0, 0, -s * 0.35], [0.028, 0.06, 0.01]);
    rig.ears.push(ear);
  }
  let parent = rig.body;
  let pos = [0, 0.2, -0.3];
  const rots = [-0.9, 0.35, 0.45];
  for (let i = 0; i < 3; i++) {
    const t = group(parent, pos[0], pos[1], pos[2]);
    t.rotation.x = rots[i];
    t.userData.base = rots[i];
    rb.along(t, UG.sphere, i === 2 ? C.stripe : C.base, [0, 0.07, 0], [0, 1, 0], 0.028 - i * 0.003, 0.085, 0.028 - i * 0.003);
    rig.tail.push(t);
    parent = t;
    pos = [0, 0.15, 0];
  }
  rb.build();
  rig.dims = { hipH, height: 0.6, headY: 0.48, mouth: [0, 0.42, 0.48], radius: 0.24, len: 0.7, stride: 0.85, legAmp: 0.62, kneeAmp: 0.8, bob: 0.025, neckDown: 0.9, neckBase: 0, walk: 3.3 };
  return rig;
}

/* ------------------------------------------------------------------ dog */
function buildDog() {
  const rig = makeRig('dog');
  const rb = new RigBuilder();
  const C = { coat: '#a36b40', light: '#c28e5d', white: '#f2eadb', nose: '#231b17', pink: '#e08a8e', scarf: '#bd4a3e' };
  const hipH = 0.4;
  rig.body.position.y = hipH;
  rb.add(rig.body, UG.sphereHi, (x, y, z, c) => c.set(y < -0.45 ? C.white : C.coat), [0, 0.18, 0], [0, 0, 0], [0.17, 0.19, 0.4]);
  rb.add(rig.body, UG.sphere, C.white, [0, 0.2, 0.28], [0, 0, 0], [0.18, 0.22, 0.17]);
  rb.add(rig.body, UG.sphere, C.coat, [0, 0.2, -0.26], [0, 0, 0], [0.17, 0.19, 0.18]);
  for (const [sx, z, y] of [[-1, 0.28, 0.02], [1, 0.28, 0.02], [-1, -0.27, 0.04], [1, -0.27, 0.04]]) {
    const L = hipH + y;
    leg(rb, rig, rig.body, [sx * 0.095, y, z], L * 0.5, L * 0.5, 0.046, 0.033, C.coat, C.white, { kind: 'paw', color: C.white, h: 0.035, len: 0.06, fwd: 0.022 });
  }
  const neck = group(rig.body, 0, 0.32, 0.36);
  rig.neck = neck;
  rb.along(neck, UG.sphere, C.coat, [0, 0.06, 0.0], [0, 1, 0.55], 0.1, 0.13, 0.11);
  rb.add(neck, UG.cone, C.scarf, [0, -0.02, 0.1], [Math.PI, 0, 0], [0.12, 0.18, 0.05]);
  rb.along(neck, ring(0.2), C.scarf, [0, 0.06, 0.02], [0, 1, 0.55], 0.108, 0.108, 0.108);
  for (let i = 0; i < 4; i++) rb.add(neck, UG.sphereLo, C.white, [(i % 2 - 0.5) * 0.08, 0.02 - Math.floor(i / 2) * 0.06, 0.145 + Math.floor(i / 2) * 0.006], [0, 0, 0], [0.012, 0.012, 0.006]);
  const head = group(neck, 0, 0.16, 0.08);
  rig.head = head;
  rb.add(head, UG.sphere, C.coat, [0, 0, 0], [0, 0, 0], [0.13, 0.12, 0.135]);
  rb.along(head, UG.sphere, C.light, [0, -0.04, 0.15], [0, -0.25, 1], 0.065, 0.11, 0.06);
  rb.along(head, UG.sphere, C.white, [0, 0.02, 0.12], [0, -0.1, 1], 0.025, 0.13, 0.08);
  rb.add(head, UG.sphereLo, C.nose, [0, -0.055, 0.255], [0, 0, 0], [0.032, 0.026, 0.024]);
  eyes(rig, head, 0.055, 0.03, 0.105, 0.024, 0.4);
  for (const s of [-1, 1]) {
    const ear = group(head, s * 0.075, 0.095, -0.02);
    rb.add(ear, UG.cone, C.coat, [0, 0.05, 0], [0, 0, -s * 0.25], [0.048, 0.1, 0.025]);
    rb.add(ear, UG.cone, C.coat, [s * -0.012, 0.105, 0.02], [0.9, 0, -s * 0.25], [0.03, 0.05, 0.015]);
    rig.ears.push(ear);
  }
  const tongue = new THREE.Mesh(UG.sphereLo, new THREE.MeshLambertMaterial({ color: C.pink }));
  tongue.scale.set(0.03, 0.012, 0.05);
  tongue.position.set(0, -0.1, 0.2);
  tongue.rotation.x = 0.5;
  tongue.visible = false;
  head.add(tongue);
  rig.extras.tongue = tongue;
  const t0 = group(rig.body, 0, 0.27, -0.42);
  t0.rotation.x = 2.3; t0.userData.base = 2.3;
  rb.along(t0, UG.sphere, C.coat, [0, 0.12, 0], [0, 1, 0], 0.05, 0.14, 0.06);
  const t1 = group(t0, 0, 0.24, 0);
  t1.rotation.x = -0.45; t1.userData.base = -0.45;
  rb.along(t1, UG.sphere, (x, y, z, c) => c.set(y > 0.3 ? C.white : C.coat), [0, 0.09, 0], [0, 1, 0], 0.05, 0.11, 0.055);
  rig.tail.push(t0, t1);
  rb.build();
  rig.dims = { hipH, height: 0.9, headY: 0.8, mouth: [0, 0.72, 0.78], radius: 0.3, len: 1.0, stride: 1.05, legAmp: 0.6, kneeAmp: 0.8, bob: 0.03, neckDown: 0.95, neckBase: 0, walk: 3.9 };
  return rig;
}

/* ------------------------------------------------------------------ sheep (Herdwick) */
function buildSheep(seed = 1) {
  const rig = makeRig('sheep');
  const rb = new RigBuilder();
  const wools = ['#b7b0a4', '#c8c1b4', '#a39d92', '#bdb6a9'];
  const hipH = 0.4;
  rig.body.position.y = hipH;
  rb.add(rig.body, UG.sphere, wools[0], [0, 0.24, 0], [0, 0, 0], [0.3, 0.28, 0.42]);
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39 + seed, b = (i / 14) * Math.PI;
    const x = Math.cos(a) * Math.sin(b) * 0.24, y = 0.26 + Math.cos(b) * 0.18, z = Math.sin(a) * Math.sin(b) * 0.34;
    rb.add(rig.body, UG.sphereLo, wools[i % 4], [x, y, z], [0, 0, 0], [0.17 + (i % 3) * 0.02, 0.15, 0.17]);
  }
  for (const [sx, z] of [[-1, 0.25], [1, 0.25], [-1, -0.25], [1, -0.25]]) {
    leg(rb, rig, rig.body, [sx * 0.13, 0.02, z], 0.21, 0.21, 0.042, 0.03, '#e6e1d6', '#e6e1d6', { kind: 'hoof', color: '#3b3029', h: 0.05 });
  }
  const neck = group(rig.body, 0, 0.34, 0.42);
  rig.neck = neck;
  rb.add(neck, UG.sphereLo, wools[1], [0, 0.02, -0.02], [0, 0, 0], [0.15, 0.15, 0.14]);
  const head = group(neck, 0, 0.04, 0.1);
  rig.head = head;
  rb.along(head, UG.sphere, '#efeae0', [0, -0.02, 0.1], [0, -0.35, 1], 0.1, 0.15, 0.115);
  rb.add(head, UG.sphereLo, '#8e8a84', [0, -0.07, 0.235], [0, 0, 0], [0.04, 0.03, 0.02]);
  for (let i = 0; i < 3; i++) rb.add(head, UG.sphereLo, wools[i], [(i - 1) * 0.05, 0.1, 0.02], [0, 0, 0], [0.07, 0.06, 0.07]);
  eyes(rig, head, 0.085, 0.03, 0.1, 0.022, 0.8);
  for (const s of [-1, 1]) {
    const ear = group(head, s * 0.1, 0.04, 0.02);
    rb.add(ear, UG.sphereLo, '#efeae0', [s * 0.06, 0, 0], [0, 0, s * 0.4], [0.07, 0.025, 0.035]);
    rig.ears.push(ear);
  }
  const tail = group(rig.body, 0, 0.26, -0.43);
  rb.add(tail, UG.sphereLo, wools[2], [0, -0.04, -0.02], [0, 0, 0], [0.07, 0.09, 0.06]);
  rig.tail.push(tail);
  rb.build();
  rig.dims = { hipH, height: 0.95, headY: 0.8, mouth: [0, 0.7, 0.8], radius: 0.36, len: 1.0, stride: 0.9, legAmp: 0.45, kneeAmp: 0.5, bob: 0.02, neckDown: 0.9, neckBase: 0, walk: 1.6 };
  return rig;
}

/* ------------------------------------------------------------------ duck */
function buildDuck(variant = 'white') {
  const rig = makeRig('duck');
  const rb = new RigBuilder();
  const mallard = variant === 'mallard';
  const C = mallard
    ? { body: '#9b8269', breast: '#8a5a3e', head: '#3f6b4f', wing: '#8d8a84', bill: '#d9b24c' }
    : { body: '#f4f0e6', breast: '#f4f0e6', head: '#f4f0e6', wing: '#e6e0d2', bill: '#e2a347' };
  const hipH = 0.13;
  rig.body.position.y = hipH;
  rb.add(rig.body, UG.sphere, C.body, [0, 0.1, 0], [0, 0, 0], [0.13, 0.11, 0.2]);
  rb.add(rig.body, UG.sphere, C.breast, [0, 0.1, 0.1], [0, 0, 0], [0.12, 0.11, 0.12]);
  rb.add(rig.body, UG.cone, C.body, [0, 0.15, -0.2], [-2.0, 0, 0], [0.07, 0.12, 0.04]);
  for (const s of [-1, 1]) {
    const w = group(rig.body, s * 0.11, 0.14, 0.04);
    rb.add(w, UG.sphere, C.wing, [s * 0.015, -0.01, -0.08], [0.15, 0, 0], [0.04, 0.075, 0.15]);
    rig.wings.push(w);
  }
  for (const sx of [-1, 1]) {
    leg(rb, rig, rig.body, [sx * 0.05, 0.02, 0.0], 0.075, 0.075, 0.02, 0.013, '#e39a3e', '#e39a3e', { kind: 'paw', color: '#e39a3e', h: 0.012, len: 0.05, fwd: 0.03 });
  }
  const neck = group(rig.body, 0, 0.16, 0.14);
  rig.neck = neck;
  rb.along(neck, UG.sphere, mallard ? C.head : C.body, [0, 0.06, 0], [0, 1, 0.2], 0.05, 0.08, 0.05);
  if (mallard) rb.along(neck, ring(0.25), '#f4f0e6', [0, 0.0, -0.005], [0, 1, 0.2], 0.052, 0.052, 0.052);
  const head = group(neck, 0, 0.14, 0.02);
  rig.head = head;
  rb.add(head, UG.sphere, C.head, [0, 0, 0], [0, 0, 0], [0.072, 0.068, 0.08]);
  rb.along(head, UG.sphere, C.bill, [0, -0.02, 0.1], [0, -0.15, 1], 0.034, 0.06, 0.016);
  eyes(rig, head, 0.05, 0.02, 0.035, 0.016, 0.9);
  if (variant === 'jemima') {
    const bonnet = new THREE.SphereGeometry(1, 16, 10, 0, TAU, 0, Math.PI * 0.58);
    rb.add(head, bonnet, '#9ab4d3', [0, 0.01, -0.012], [-0.95, 0, 0], [0.092, 0.092, 0.095]);
    rb.add(head, new THREE.TorusGeometry(1, 0.1, 5, 18), '#8aa6c7', [0, 0.05, 0.035], [-0.95 + Math.PI / 2, 0, 0], [0.09, 0.09, 0.09]);
    rb.add(head, UG.sphereLo, '#e9b8c4', [0, -0.07, 0.03], [0, 0, 0], [0.025, 0.02, 0.02]);
    const shawl = new THREE.SphereGeometry(1, 18, 10, -0.2, Math.PI + 0.4, 0, Math.PI * 0.55);
    rb.add(rig.body, shawl, (x, y, z, c) => c.set(Math.sin(x * 30) * Math.sin(z * 30) > 0.6 ? '#f2dbe6' : '#c69bc5'), [0, 0.11, 0.05], [0, 0, 0], [0.138, 0.118, 0.17]);
  }
  rb.build();
  rig.dims = { hipH, height: 0.5, headY: 0.42, mouth: [0, 0.38, 0.33], radius: 0.18, len: 0.45, stride: 0.35, legAmp: 0.7, kneeAmp: 0.4, bob: 0.015, neckDown: 1.0, neckBase: 0, walk: 1.2, waddle: true };
  return rig;
}

/* ------------------------------------------------------------------ hen */
function buildHen(variant = 'brown') {
  const rig = makeRig('hen');
  const rb = new RigBuilder();
  const C = variant === 'brown' ? { body: '#a8683f', dark: '#6e4630', wing: '#8f5635' } : { body: '#f1ece0', dark: '#d8d0c0', wing: '#e3dccd' };
  const hipH = 0.15;
  rig.body.position.y = hipH;
  rb.add(rig.body, UG.sphere, C.body, [0, 0.12, 0], [0, 0, 0], [0.12, 0.12, 0.15]);
  for (let i = 0; i < 3; i++) rb.add(rig.body, UG.sphereLo, C.dark, [(i - 1) * 0.03, 0.22, -0.13], [-0.5 - i * 0.1, 0, (i - 1) * 0.3], [0.02, 0.1, 0.05]);
  for (const s of [-1, 1]) {
    const w = group(rig.body, s * 0.105, 0.14, 0.01);
    rb.add(w, UG.sphere, C.wing, [s * 0.01, -0.01, -0.03], [0.2, 0, 0], [0.035, 0.075, 0.11]);
    rig.wings.push(w);
  }
  for (const sx of [-1, 1]) {
    leg(rb, rig, rig.body, [sx * 0.045, 0.03, 0.0], 0.09, 0.09, 0.022, 0.011, C.body, '#dcb04d', { kind: 'paw', color: '#dcb04d', h: 0.01, len: 0.045, fwd: 0.02 });
  }
  const neck = group(rig.body, 0, 0.2, 0.1);
  rig.neck = neck;
  rb.along(neck, UG.sphereLo, C.body, [0, 0.03, 0], [0, 1, 0.3], 0.055, 0.07, 0.055);
  const head = group(neck, 0, 0.09, 0.02);
  rig.head = head;
  rb.add(head, UG.sphere, C.body, [0, 0, 0], [0, 0, 0], [0.06, 0.06, 0.065]);
  rb.add(head, UG.cone, '#e0b24a', [0, -0.005, 0.075], [Math.PI / 2, 0, 0], [0.018, 0.045, 0.014]);
  for (let i = 0; i < 3; i++) rb.add(head, UG.sphereLo, '#c9413a', [0, 0.065 - Math.abs(i - 1) * 0.012, -0.02 + i * 0.025], [0, 0, 0], [0.012, 0.022, 0.014]);
  rb.add(head, UG.sphereLo, '#c9413a', [0, -0.045, 0.045], [0, 0, 0], [0.012, 0.022, 0.012]);
  eyes(rig, head, 0.043, 0.015, 0.03, 0.013, 0.9);
  rb.build();
  rig.dims = { hipH, height: 0.5, headY: 0.42, mouth: [0, 0.38, 0.22], radius: 0.16, len: 0.35, stride: 0.3, legAmp: 0.7, kneeAmp: 0.6, bob: 0.02, neckDown: 1.1, neckBase: 0, walk: 1.3, peck: true };
  return rig;
}

/* ------------------------------------------------------------------ rabbit in a blue jacket */
function buildRabbit() {
  const rig = makeRig('rabbit');
  const rb = new RigBuilder();
  const C = { fur: '#9b7759', light: '#c9ad8f', white: '#f5efe4', pink: '#e2a3a0', jacket: '#5a82b8', brass: '#d0a955' };
  const hipH = 0.13;
  rig.body.position.y = hipH;
  rb.add(rig.body, UG.sphere, C.fur, [0, 0.12, -0.02], [0, 0, 0], [0.12, 0.13, 0.17]);
  for (const s of [-1, 1]) rb.add(rig.body, UG.sphere, C.fur, [s * 0.07, 0.1, -0.1], [0, 0, 0], [0.07, 0.09, 0.11]);
  rb.add(rig.body, UG.sphereLo, C.white, [0, 0.16, -0.19], [0, 0, 0], [0.045, 0.045, 0.045]);
  const jacket = new THREE.SphereGeometry(1, 20, 12, -0.4, Math.PI + 0.8, 0, Math.PI * 0.64);
  rb.add(rig.body, jacket, C.jacket, [0, 0.13, 0.0], [-0.25, 0, 0], [0.126, 0.14, 0.15]);
  for (let i = 0; i < 3; i++) rb.add(rig.body, UG.sphereLo, C.brass, [0.03, 0.2 - i * 0.045, 0.14 - i * 0.012], [0, 0, 0], [0.012, 0.012, 0.012]);
  leg(rb, rig, rig.body, [-0.05, 0.02, 0.1], 0.07, 0.08, 0.02, 0.016, C.jacket, C.fur, { kind: 'paw', color: C.light, h: 0.015, len: 0.025 });
  leg(rb, rig, rig.body, [0.05, 0.02, 0.1], 0.07, 0.08, 0.02, 0.016, C.jacket, C.fur, { kind: 'paw', color: C.light, h: 0.015, len: 0.025 });
  leg(rb, rig, rig.body, [-0.08, 0.02, -0.08], 0.07, 0.08, 0.03, 0.02, C.fur, C.fur, { kind: 'paw', color: C.light, h: 0.02, len: 0.07, fwd: 0.04 });
  leg(rb, rig, rig.body, [0.08, 0.02, -0.08], 0.07, 0.08, 0.03, 0.02, C.fur, C.fur, { kind: 'paw', color: C.light, h: 0.02, len: 0.07, fwd: 0.04 });
  const neck = group(rig.body, 0, 0.22, 0.12);
  rig.neck = neck;
  rb.add(neck, UG.cyl, C.jacket, [0, 0.0, 0.0], [0.3, 0, 0], [0.07, 0.03, 0.07]);
  const head = group(neck, 0, 0.06, 0.02);
  rig.head = head;
  rb.add(head, UG.sphere, C.fur, [0, 0, 0.02], [0, 0, 0], [0.085, 0.08, 0.095]);
  rb.add(head, UG.sphereLo, C.light, [0, -0.03, 0.09], [0, 0, 0], [0.042, 0.035, 0.03]);
  rb.add(head, UG.sphereLo, C.pink, [0, -0.01, 0.115], [0, 0, 0], [0.012, 0.009, 0.008]);
  eyes(rig, head, 0.052, 0.02, 0.055, 0.018, 0.8);
  for (const s of [-1, 1]) {
    const ear = group(head, s * 0.03, 0.065, -0.02);
    rb.add(ear, UG.sphere, C.fur, [0, 0.1, 0], [-0.2, 0, -s * 0.12], [0.025, 0.11, 0.045]);
    rb.add(ear, UG.sphereLo, C.pink, [0, 0.1, 0.012], [-0.2, 0, -s * 0.12], [0.014, 0.08, 0.03]);
    rig.ears.push(ear);
  }
  rb.build();
  rig.dims = { hipH, height: 0.55, headY: 0.36, mouth: [0, 0.32, 0.26], radius: 0.16, len: 0.4, stride: 0.5, legAmp: 0.4, kneeAmp: 0.4, bob: 0.01, neckDown: 0.6, neckBase: 0, walk: 2.0, hopper: true };
  return rig;
}

/* ------------------------------------------------------------------ hedgehog in an apron */
function buildHedgehog() {
  const rig = makeRig('hedgehog');
  const rb = new RigBuilder();
  const hipH = 0.08;
  rig.body.position.y = hipH;
  const spines = new THREE.IcosahedronGeometry(1, 3);
  const p = spines.attributes.position;
  const tip = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = noise3(x * 9, y * 9, z * 9) > 0.55 && y > -0.3 && z < 0.6 ? 1.28 : 1;
    tip[i] = k > 1 ? 1 : 0;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  spines.computeVertexNormals();
  rb.add(rig.body, spines, (x, y, z, c) => c.set(Math.hypot(x, y, z) > 1.1 ? '#cdbba1' : '#7a6453'), [0, 0.1, -0.03], [0, 0, 0], [0.15, 0.12, 0.19]);
  rb.add(rig.body, UG.sphere, '#c98a8a', [0, 0.05, 0.02], [0, 0, 0], [0.15, 0.07, 0.17]);
  rb.add(rig.body, UG.sphere, '#f4f0e6', [0, 0.07, 0.1], [0, 0, 0], [0.11, 0.08, 0.07]);
  for (const [sx, z] of [[-1, 0.08], [1, 0.08], [-1, -0.08], [1, -0.08]]) {
    leg(rb, rig, rig.body, [sx * 0.07, 0.02, z], 0.05, 0.05, 0.018, 0.014, '#8b6f58', '#8b6f58', { kind: 'paw', color: '#6d5645', h: 0.012, len: 0.025 });
  }
  const neck = group(rig.body, 0, 0.08, 0.14);
  rig.neck = neck;
  const head = group(neck, 0, 0, 0);
  rig.head = head;
  rb.add(head, UG.sphere, '#d9c3a3', [0, 0.02, 0.02], [0, 0, 0], [0.075, 0.07, 0.07]);
  rb.add(head, UG.cone, '#d9c3a3', [0, 0.0, 0.1], [Math.PI / 2, 0, 0], [0.045, 0.1, 0.04]);
  rb.add(head, UG.sphereLo, '#231b17', [0, 0.0, 0.155], [0, 0, 0], [0.018, 0.016, 0.014]);
  rb.add(head, UG.sphere, '#f7f3ea', [0, 0.09, 0.0], [0, 0, 0], [0.08, 0.05, 0.075]);
  rb.add(head, new THREE.TorusGeometry(1, 0.2, 5, 16), '#f7f3ea', [0, 0.07, 0.0], [Math.PI / 2, 0, 0], [0.078, 0.078, 0.078]);
  eyes(rig, head, 0.035, 0.035, 0.05, 0.013, 0.7);
  rb.build();
  rig.dims = { hipH, height: 0.42, headY: 0.2, mouth: [0, 0.16, 0.3], radius: 0.18, len: 0.4, stride: 0.25, legAmp: 0.5, kneeAmp: 0.3, bob: 0.008, neckDown: 0.4, neckBase: 0, walk: 0.8 };
  return rig;
}

const BUILDERS = { horse: buildHorse, cow: buildCow, pig: buildPig, cat: buildCat, dog: buildDog, sheep: buildSheep, duck: buildDuck, hen: buildHen, rabbit: buildRabbit, hedgehog: buildHedgehog };

export function buildAnimal(species, variant) {
  const rig = BUILDERS[species](variant);
  const s = SPECIES[species].scale ?? 1;
  rig.scale = s;
  rig.root.scale.setScalar(s);
  const d = rig.dims;
  rig.world = {
    height: d.height * s, headY: d.headY * s, radius: d.radius * s, len: d.len * s,
    mouth: new THREE.Vector3(d.mouth[0] * s, d.mouth[1] * s, d.mouth[2] * s),
  };
  for (const t of rig.tail) if (t.userData.base === undefined) t.userData.base = t.rotation.x;
  rig.root.traverse((o) => { o.frustumCulled = true; });
  return rig;
}

export function disposeRig(rig) {
  rig.root.traverse((o) => { if (o.isMesh && o.geometry !== EYE_GEO && !Object.values(UG).includes(o.geometry)) o.geometry.dispose(); });
  rig.root.removeFromParent();
}

/* ------------------------------------------------------------------ animation */

export function newPose() {
  return {
    phase: Math.random() * TAU, gait: 0, air: 0, vy: 0, speed: 0,
    headDown: 0, headDownT: 0, nibble: 0, talk: 0, lean: 0, tilt: 0, lookYaw: 0, lookPitch: 0,
    wag: 0.3, happy: 0, tuck: 0, hop: 0, squash: 0, roll: 0, pitch: 0, spin: 0,
    blink: 0, blinkT: 1 + Math.random() * 3, earT: Math.random() * 2, ear: 0, t: Math.random() * 10, flap: 0,
  };
}

/* Drive a rig from a pose. speed is signed metres per second along the facing direction. */
export function animateRig(rig, st, dt) {
  const d = rig.dims;
  st.t += dt;
  const sp = Math.abs(st.speed) / (rig.scale || 1);
  const moving = sp > 0.05 && st.air < 0.5;
  st.gait = damp(st.gait, moving ? 1 : 0, 9, dt);
  if (moving) st.phase += Math.sign(st.speed) * (sp / d.stride) * TAU * dt;
  const fast = sp > d.walk * 1.35;
  const amp = Math.min(1.2, 0.35 + sp / d.walk * 0.65) * d.legAmp * (fast ? 1.2 : 1) * st.gait;
  const air = st.air;

  for (let i = 0; i < rig.legs.length; i++) {
    const L = rig.legs[i];
    const front = rig.legs.length === 2 ? true : i < 2;
    const diag = rig.legs.length === 2 ? i === 0 : (i === 0 || i === 3);
    let ph = st.phase + (diag ? 0 : Math.PI);
    if (fast && rig.legs.length === 4) ph = st.phase + (front ? 0 : Math.PI * 0.6) + (i % 2 ? 0.35 : 0);
    let swing = Math.sin(ph) * amp;
    let bend = Math.max(0, -Math.cos(ph)) * d.kneeAmp * (amp / d.legAmp);
    if (d.hopper) {
      const h = Math.max(0, Math.sin(st.phase * 0.5));
      swing = (front ? -0.4 : 0.6) * h * st.gait;
      bend = 0.3 * h * st.gait;
    }
    const aSwing = front ? -0.55 : 0.6;
    const aBend = front ? 0.9 : 0.5;
    const tuck = Math.max(air, st.tuck);
    L.hip.rotation.x = lerp(swing, aSwing, tuck);
    L.knee.rotation.x = lerp(bend, aBend, tuck);
  }

  const breathe = Math.sin(st.t * 2.2) * 0.006;
  let bob = Math.abs(Math.sin(st.phase)) * d.bob * st.gait * (fast ? 1.6 : 1);
  if (d.hopper) bob = Math.max(0, Math.sin(st.phase * 0.5)) * 0.09 * st.gait;
  rig.body.position.y = d.hipH + bob + breathe;
  rig.body.rotation.x = st.pitch + (fast ? Math.sin(st.phase * 2) * 0.05 * st.gait : 0);
  rig.body.rotation.z = st.roll + (d.waddle ? Math.sin(st.phase) * 0.12 * st.gait : 0);
  rig.body.position.z = st.lean * d.len * 0.06;

  if (rig.neck) {
    const nib = st.nibble ? Math.sin(st.t * 11) * 0.06 : 0;
    const peck = d.peck && st.gait > 0.3 ? Math.sin(st.phase * 2) * 0.25 : 0;
    const talkLift = -st.talk * 0.35 + Math.sin(st.t * 18) * 0.05 * st.talk;
    rig.neck.rotation.x = d.neckBase + st.headDown * d.neckDown + nib + talkLift + st.lean * 0.25 + st.lookPitch + peck;
    rig.neck.rotation.y = st.lookYaw * 0.6;
    if (rig.head && rig.head !== rig.neck) {
      rig.head.rotation.y = st.lookYaw * 0.4;
      rig.head.rotation.x = st.headDown * 0.25 - st.talk * 0.25 + st.lean * 0.2;
      rig.head.rotation.z = st.tilt;
    } else if (rig.head) {
      rig.head.rotation.z = st.tilt;
    }
  }
  st.earT -= dt;
  if (st.earT < 0) { st.earT = 1.5 + Math.random() * 4; st.ear = 1; }
  st.ear = Math.max(0, st.ear - dt * 4);
  rig.ears.forEach((e, i) => {
    const flick = Math.sin(st.ear * Math.PI) * 0.4 * (i === 0 ? 1 : 0.6);
    e.rotation.z = (i === 0 ? 1 : -1) * flick * 0.5;
    e.rotation.x = -flick * 0.6 - st.happy * 0.25 + st.gait * Math.sin(st.phase * 2) * 0.05;
  });
  const wagSpeed = 6 + st.happy * 12;
  const wagAmp = (0.12 + st.wag * 0.25 + st.happy * 0.5) * (rig.species === 'cow' || rig.species === 'horse' ? 0.6 : 1);
  rig.tail.forEach((t, i) => {
    t.rotation.z = Math.sin(st.t * wagSpeed - i * 0.9) * wagAmp * (1 + i * 0.3);
    t.rotation.x = t.userData.base + (rig.species === 'cat' ? Math.sin(st.t * 1.3 + i) * 0.12 : 0) - st.gait * (rig.species === 'horse' ? 0.3 : 0);
  });
  if (rig.wings.length) {
    const f = Math.max(st.flap, air * 0.6);
    rig.wings.forEach((w, i) => { w.rotation.z = (i === 0 ? -1 : 1) * (0.1 + f * (0.9 + Math.sin(st.t * 30) * 0.6)); });
  }
  st.blinkT -= dt;
  if (st.blinkT < 0) { st.blinkT = 2 + Math.random() * 4; st.blink = 0.16; }
  st.blink = Math.max(0, st.blink - dt);
  const eyeY = st.blink > 0 ? 0.15 : 1;
  for (const e of rig.eyes) e.scale.y = e.scale.x * eyeY;
  if (rig.extras.tongue) rig.extras.tongue.visible = st.happy > 0.3 || (st.gait > 0.5 && sp > d.walk * 1.2);

  // hop / squash / spin applied to the pivot
  const sq = st.squash;
  rig.pivot.scale.set(1 + sq * 0.12, 1 - sq * 0.18, 1 + sq * 0.12);
  rig.pivot.position.y = st.hop;
  rig.pivot.rotation.y = st.spin;
  st.squash = damp(st.squash, 0, 7, dt);
}

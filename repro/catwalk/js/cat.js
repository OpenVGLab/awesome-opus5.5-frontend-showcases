// The cat: a tuxedo made of CPU-lofted tubes (body, legs, tail) around a rigid head,
// animated procedurally. A gallop with planted paws and a flexing spine, a stretched
// flying pose, landing squash, sitting with the tail wrapped around the paws.
// All pose numbers are in the cat's own metres before CAT_SCALE is applied.

import * as THREE from 'three';

export const CAT_SCALE = 1.35;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const frac = (x) => x - Math.floor(x);

const PAW_R = 0.012;
const BLACK = [0.028, 0.028, 0.034];
const WHITE = [0.8, 0.77, 0.72];

// ── lofted tube ──────────────────────────────────────────────────────────
class Loft {
  constructor(nRings, nSeg, material, colorFn) {
    this.nR = nRings;
    this.nS = nSeg;
    const nV = nRings * nSeg;
    this.pos = new Float32Array(nV * 3);
    this.nor = new Float32Array(nV * 3);
    const col = new Float32Array(nV * 3);
    for (let i = 0; i < nRings; i++) {
      for (let j = 0; j < nSeg; j++) {
        const c = colorFn(i / (nRings - 1), (j / nSeg) * TAU);
        col.set(c, (i * nSeg + j) * 3);
      }
    }
    const idx = [];
    for (let i = 0; i < nRings - 1; i++) {
      for (let j = 0; j < nSeg; j++) {
        const a = i * nSeg + j, b = i * nSeg + ((j + 1) % nSeg);
        const c = (i + 1) * nSeg + j, d = (i + 1) * nSeg + ((j + 1) % nSeg);
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    this.pAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.nAttr = new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pAttr);
    g.setAttribute('normal', this.nAttr);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.C = Array.from({ length: nRings }, () => new THREE.Vector3());
    this.ru = new Float32Array(nRings);
    this.rd = new Float32Array(nRings);
    this.rs = new Float32Array(nRings);
  }

  // Rings follow this.C with radii ru (above), rd (below), rs (sideways).
  // With transport=true the ring frame is carried along the curve instead of being
  // re-derived from zRef, so tubes that turn toward the camera do not twist.
  build(zRef = Z_AXIS, transport = false) {
    const { C, ru, rd, rs, nR, nS, pos, nor } = this;
    for (let i = 0; i < nR; i++) {
      const a = C[Math.max(0, i - 1)], b = C[Math.min(nR - 1, i + 1)];
      T.subVectors(b, a);
      const ds = Math.max(1e-5, T.length());
      T.multiplyScalar(1 / ds);
      if (transport && i > 0) B.addScaledVector(T, -B.dot(T));
      else B.copy(zRef).addScaledVector(T, -zRef.dot(T));
      if (B.lengthSq() < 1e-8) B.set(0, 1, 0).addScaledVector(T, -T.y);
      B.normalize();
      N.crossVectors(B, T);
      const ia = Math.max(0, i - 1), ib = Math.min(nR - 1, i + 1);
      const dr = ((ru[ib] + rd[ib] + rs[ib]) - (ru[ia] + rd[ia] + rs[ia])) / (3 * ds);
      const c0 = C[i];
      for (let j = 0; j < nS; j++) {
        const th = (j / nS) * TAU;
        const c = Math.cos(th), s = Math.sin(th);
        const w = smooth(-0.35, 0.35, c);
        const rv = rd[i] + (ru[i] - rd[i]) * w;
        const rh = rs[i];
        const k = (i * nS + j) * 3;
        pos[k] = c0.x + N.x * c * rv + B.x * s * rh;
        pos[k + 1] = c0.y + N.y * c * rv + B.y * s * rh;
        pos[k + 2] = c0.z + N.z * c * rv + B.z * s * rh;
        let nx = N.x * (c / rv) + B.x * (s / rh);
        let ny = N.y * (c / rv) + B.y * (s / rh);
        let nz = N.z * (c / rv) + B.z * (s / rh);
        const l = Math.hypot(nx, ny, nz) || 1;
        nx = nx / l - T.x * dr; ny = ny / l - T.y * dr; nz = nz / l - T.z * dr;
        const l2 = Math.hypot(nx, ny, nz) || 1;
        nor[k] = nx / l2; nor[k + 1] = ny / l2; nor[k + 2] = nz / l2;
      }
    }
    this.pAttr.needsUpdate = true;
    this.nAttr.needsUpdate = true;
  }
}
const T = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Samples a Catmull-Rom spline through control points (spaced by chord length) into
// the loft rings, carrying per-point radii along.
function sampleInto(loft, pts, rads) {
  const n = pts.length;
  const cum = SCR.cum;
  cum[0] = 0;
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.max(1e-4, pts[i].distanceTo(pts[i - 1]));
  const total = cum[n - 1];
  let seg = 0;
  for (let k = 0; k < loft.nR; k++) {
    const s = (k / (loft.nR - 1)) * total;
    while (seg < n - 2 && s > cum[seg + 1]) seg++;
    const u = clamp((s - cum[seg]) / (cum[seg + 1] - cum[seg]), 0, 1);
    const p0 = pts[Math.max(0, seg - 1)], p1 = pts[seg], p2 = pts[seg + 1], p3 = pts[Math.min(n - 1, seg + 2)];
    catmull(p0, p1, p2, p3, u, loft.C[k]);
    const r0 = rads[Math.max(0, seg - 1)], r1 = rads[seg], r2 = rads[seg + 1], r3 = rads[Math.min(n - 1, seg + 2)];
    loft.ru[k] = Math.max(0.002, cm(r0[0], r1[0], r2[0], r3[0], u));
    loft.rd[k] = Math.max(0.002, cm(r0[1], r1[1], r2[1], r3[1], u));
    loft.rs[k] = Math.max(0.002, cm(r0[2], r1[2], r2[2], r3[2], u));
  }
}
const SCR = { cum: new Float32Array(32) };

function cm(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function catmull(p0, p1, p2, p3, t, out) {
  out.set(cm(p0.x, p1.x, p2.x, p3.x, t), cm(p0.y, p1.y, p2.y, p3.y, t), cm(p0.z, p1.z, p2.z, p3.z, t));
}

// Two-bone IK in the sagittal plane. bend +1 puts the joint forward (knee), -1 back (elbow).
function ik(ax, ay, tx, ty, l1, l2, bend, out) {
  let dx = tx - ax, dy = ty - ay;
  let d = Math.hypot(dx, dy);
  const maxD = l1 + l2 - 1e-4, minD = Math.abs(l1 - l2) + 1e-3;
  if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
  if (d < minD) { const k = minD / Math.max(d, 1e-5); dx *= k; dy *= k; d = minD; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d;
  out.jx = ax + ux * a - uy * h * bend;
  out.jy = ay + uy * a + ux * h * bend;
  out.ex = ax + dx;
  out.ey = ay + dy;
  return out;
}

// ── materials ─────────────────────────────────────────────────────────────
function furMaterial(rim, opts) {
  const m = new THREE.MeshPhysicalMaterial({
    color: opts.color ?? 0xffffff,
    vertexColors: !!opts.vertexColors,
    roughness: 0.5,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(0x66759a),
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = rim.color;
    sh.uniforms.uRimPow = rim.power;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimPow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float rimF = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        totalEmissiveRadiance += uRimColor * pow(rimF, uRimPow) * (0.55 + 0.45 * diffuseColor.g);
      }`);
  };
  m.customProgramCacheKey = () => 'catfur' + (opts.vertexColors ? 'v' : '');
  return m;
}

const LEGS = [
  { hind: true, near: true, off: 0.0, z: 0.037, pz: 0.03 },
  { hind: true, near: false, off: 0.08, z: -0.037, pz: -0.03 },
  { hind: false, near: true, off: 0.53, z: 0.031, pz: 0.026 },
  { hind: false, near: false, off: 0.45, z: -0.031, pz: -0.026 },
];
const HIND = { l1: 0.108, l2: 0.112, meta: 0.066, toe: 0.026 };
const FORE = { l1: 0.1, l2: 0.098, wrist: 0.028, toe: 0.022 };
// Swing arcs: [x (relative to the paw's neutral spot, D-scaled at ends), y, paw angle, hock angle]
const HIND_SWING = [[-0.5, 0, -0.9, -0.55], [-0.5, 0.05, -1.35, -0.2], [0, 0.115, -1.3, 0.8], [0.5, 0.055, -0.3, 0.45], [0.5, 0, 0, 0.35]];
const FORE_SWING = [[-0.5, 0, -1.0, 0], [-0.5, 0.078, -2.1, 0], [0, 0.105, -1.4, 0], [0.5, 0.06, 0.25, 0], [0.5, 0, 0, 0]];
const HIND_EXTRA = [0, -0.045, 0, 0.035, 0];
const FORE_EXTRA = [0, -0.03, 0.01, 0.06, 0];

export class Cat {
  constructor() {
    this.root = new THREE.Group();
    this.root.scale.setScalar(CAT_SCALE);
    this.rim = { color: { value: new THREE.Color(0.22, 0.28, 0.45) }, power: { value: 2.4 } };
    this.matV = furMaterial(this.rim, { vertexColors: true });
    this.matBlack = furMaterial(this.rim, { color: 0x0b0b0e });
    this.matWhite = furMaterial(this.rim, { color: 0xd9d3c7 });

    this.body = new Loft(32, 18, this.matV, (t, th) => {
      const c = Math.cos(th);
      const chest = smooth(0.52, 0.66, t) * smooth(-0.1, -0.55, c);
      const throat = smooth(0.8, 0.9, t) * smooth(0.15, -0.35, c);
      return mixColor(BLACK, WHITE, Math.max(chest, throat));
    });
    this.root.add(this.body.mesh);
    this.legs = LEGS.map((L) => {
      const loft = new Loft(L.hind ? 26 : 22, 10, this.matV, (t) => {
        const w = smooth(L.hind ? 0.78 : 0.62, L.hind ? 0.84 : 0.7, t);
        const c = mixColor(BLACK, WHITE, w);
        return L.near ? c : c.map((v) => v * 0.72);
      });
      this.root.add(loft.mesh);
      return loft;
    });
    this.tail = new Loft(22, 10, this.matV, (t) => BLACK);
    this.root.add(this.tail.mesh);
    this.buildHead();

    // control point scratch
    this.bodyPts = Array.from({ length: 8 }, () => new THREE.Vector3());
    this.bodyRads = [[0.012, 0.012, 0.012], [0.042, 0.047, 0.046], [0.052, 0.062, 0.058], [0.048, 0.056, 0.051], [0.054, 0.078, 0.058], [0.047, 0.06, 0.05], [0.038, 0.043, 0.04], [0.032, 0.034, 0.034]];
    this.hindPts = Array.from({ length: 9 }, () => new THREE.Vector3());
    this.hindRads = [0.05, 0.046, 0.038, 0.024, 0.017, 0.0125, 0.0125, 0.011, 0.004].map((r) => [r, r, r]);
    this.forePts = Array.from({ length: 8 }, () => new THREE.Vector3());
    this.foreRads = [0.04, 0.034, 0.022, 0.016, 0.0125, 0.0135, 0.011, 0.004].map((r) => [r, r, r]);
    this.tailN = 10;
    this.tailSeg = 0.032;
    this.tailP = Array.from({ length: this.tailN }, () => new THREE.Vector3());
    this.tailV = Array.from({ length: this.tailN }, () => new THREE.Vector3());
    this.tailT = Array.from({ length: this.tailN }, () => new THREE.Vector3());
    this.tailRads = Array.from({ length: this.tailN + 1 }, (_, i) => {
      const r = i === this.tailN ? 0.004 : lerp(0.021, 0.0135, i / (this.tailN - 1));
      return [r, r, r];
    });
    this.tailPts = Array.from({ length: this.tailN + 1 }, () => new THREE.Vector3());
    this.ikOut = { jx: 0, jy: 0, ex: 0, ey: 0 };

    this.phase = 0;
    this.w = { air: 0, sit: 1, bump: 0, fall: 0, puff: 0, stand: 1, look: 0 };
    this.s = { bodyX: -0.015, bodyY: 0.16, pitch: 0.77, flex: 0.5, len: 0.25, neckA: 0.55, headP: 0.05, headYaw: 0.5, headRoll: 0, ear: 0, tailA: -1.3, tailCurl: 0.3, tailYaw: 0.3, tailWave: 0, tailThick: 1 };
    this.paws = LEGS.map(() => ({ x: 0, y: PAW_R, a: 0, b: 0.35 }));
    this.landT = 9;
    this.landImpact = 0;
    this.takeoffT = 9;
    this.time = 0;
    this.blinkT = 2;
    this.earT = 3;
    this.flickT = 4;
    this.flick = 0;
    this.lookT = 3;
    this.lookTarget = 0.55;
    this.prevVy = 0;
    this.spin = 0;
    this.tailInit = false;
    this.mode = 'sit';
  }

  buildHead() {
    const g = new THREE.Group();
    const sph = new THREE.SphereGeometry(1, 22, 16);
    const add = (mat, sx, sy, sz, x, y, z, parent = g) => {
      const m = new THREE.Mesh(sph, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    add(this.matBlack, 0.057, 0.05, 0.056, 0, 0.004, 0);
    add(this.matBlack, 0.046, 0.036, 0.055, 0.014, -0.016, 0);
    add(this.matWhite, 0.027, 0.02, 0.031, 0.047, -0.021, 0);
    add(this.matWhite, 0.02, 0.012, 0.021, 0.037, -0.035, 0);
    const pink = new THREE.MeshStandardMaterial({ color: 0x4a2226, roughness: 0.5 });
    add(pink, 0.008, 0.0055, 0.009, 0.072, -0.007, 0);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 0.45) });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.eyes = [];
    for (const s of [1, -1]) {
      const eg = new THREE.Group();
      eg.position.set(0.041, 0.01, s * 0.027);
      eg.rotation.y = -s * 0.55;
      g.add(eg);
      add(this.eyeMat, 0.0095, 0.0115, 0.0065, 0, 0, 0, eg);
      add(pupilMat, 0.0028, 0.0098, 0.003, 0.0055, 0, 0, eg);
      this.eyes.push(eg);
    }
    const earGeo = new THREE.ConeGeometry(1, 1, 3);
    earGeo.translate(0, 0.5, 0);
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x3a1c20, roughness: 0.8 });
    this.ears = [];
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(-0.006, 0.038, s * 0.028);
      g.add(pivot);
      const ear = new THREE.Mesh(earGeo, this.matBlack);
      ear.scale.set(0.027, 0.05, 0.011);
      ear.castShadow = true;
      pivot.add(ear);
      const inner = new THREE.Mesh(earGeo, innerMat);
      inner.scale.set(0.017, 0.036, 0.006);
      inner.position.set(0.006, 0.004, 0);
      pivot.add(inner);
      this.ears.push({ pivot, side: s });
    }
    // Whiskers catch the lamplight in close-ups.
    const wv = [];
    for (const s of [1, -1]) {
      for (let k = 0; k < 3; k++) {
        wv.push(0.05, -0.02 + k * 0.004, s * 0.022, 0.02 + k * 0.006, -0.03 + k * 0.01 - 0.004, s * (0.09 + k * 0.006));
      }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3));
    const whiskers = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xcfc8bb, transparent: true, opacity: 0.45 }));
    g.add(whiskers);
    this.head = g;
    this.root.add(g);
  }

  setRimColor(c) {
    this.rim.color.value.copy(c);
  }

  // st: { x, y, vx, vy, grounded, blocked, mode, time }
  update(dt, st, events) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    const mode = st.mode;
    this.mode = mode;
    for (const e of events) {
      if (e.type === 'land') { this.landT = 0; this.landImpact = clamp(e.impact / 9, 0.25, 1.2); this.phase = 0.47; }
      else if (e.type === 'jump' || e.type === 'bounce') { this.takeoffT = 0; }
    }
    this.landT += dt;
    this.takeoffT += dt;

    const speed = Math.abs(st.vx) / CAT_SCALE;
    const running = mode === 'run';
    const airborne = running && !st.grounded;
    const w = this.w;
    w.sit = damp(w.sit, mode === 'sit' || mode === 'sad' ? 1 : 0, mode === 'sit' || mode === 'sad' ? 3.2 : 6.5, dt);
    w.air = damp(w.air, airborne ? 1 : 0, airborne ? 16 : 22, dt);
    w.bump = damp(w.bump, running && st.blocked && st.grounded ? 1 : 0, 12, dt);
    w.fall = damp(w.fall, mode === 'fall' ? 1 : 0, 6, dt);
    w.puff = damp(w.puff, mode === 'puff' ? 1 : 0, 14, dt);

    const amp = smooth(0.05, 1.7, speed) * (1 - w.sit);
    const freq = speed > 0.03 ? 2.35 + 0.38 * Math.min(speed, 3.6) : 0;
    if (!airborne) this.phase = frac(this.phase + dt * freq);
    const ph = this.phase;

    // ── body targets ──
    const tg = TG;
    const stillness = 1 - amp;
    tg.flex = amp * 0.95 * Math.cos(TAU * (ph + 0.02)) + stillness * 0.12;
    tg.pitch = amp * 0.085 * Math.sin(TAU * (ph + 0.05)) + stillness * 0.02;
    tg.bodyY = 0.216 - amp * 0.016 + amp * 0.011 * Math.cos(2 * TAU * (ph - 0.44));
    tg.bodyX = amp * 0.008 * Math.sin(TAU * ph);
    tg.len = 0.285;
    tg.neckA = lerp(0.62, 0.3, amp);
    tg.headP = lerp(0.02, -0.12, amp) - tg.pitch * 0.2 + amp * 0.03 * Math.sin(2 * TAU * (ph - 0.1));
    tg.headYaw = 0;
    tg.headRoll = 0;
    tg.ear = 0;
    tg.tailA = lerp(1.15, 0.18, amp);
    tg.tailCurl = lerp(-0.14, 0.07, amp);
    tg.tailYaw = 0;
    tg.tailWave = amp * 0.14;
    tg.tailThick = 1;

    // landing squash
    if (this.landT < 0.26) {
      const k = Math.sin((this.landT / 0.26) * Math.PI) * this.landImpact;
      tg.bodyY -= 0.045 * k;
      tg.flex += 0.45 * k;
      tg.pitch -= 0.07 * k;
      tg.headP += 0.12 * k;
      tg.ear += 0.2 * k;
    }

    // airborne: stretched rise, gathered apex, reaching descent
    if (w.air > 0.001) {
      const a = clamp(st.vy / 6.5, -1, 1);
      const rise = Math.max(0, a), fall = Math.max(0, -a), apex = 1 - Math.abs(a);
      const push = Math.max(0, 1 - this.takeoffT / 0.12);
      const air = {
        len: 0.285 * (1 + 0.05 * rise),
        flex: -1.0 * rise + 0.3 * apex - 0.25 * fall,
        pitch: 0.24 * rise - 0.2 * fall + 0.12 * push,
        bodyY: 0.215,
        neckA: 0.28 * rise + 0.4 * apex + 0.55 * fall,
        headP: -0.02 * rise - 0.06 * apex - 0.3 * fall,
        tailA: -0.15 * rise + 0.35 * apex + 0.85 * fall,
        tailCurl: 0.1 * rise + 0.02 * apex - 0.06 * fall,
      };
      for (const k in air) tg[k] = lerp(tg[k], air[k], w.air);
      tg.tailWave *= 1 - w.air * 0.7;
    }
    if (w.bump > 0.001) {
      tg.pitch = lerp(tg.pitch, 0.34, w.bump);
      tg.flex = lerp(tg.flex, -0.2, w.bump);
      tg.neckA = lerp(tg.neckA, 0.2, w.bump);
      tg.ear = lerp(tg.ear, 1, w.bump);
    }
    if (w.fall > 0.001) {
      const wob = Math.sin(this.time * 9) * 0.2;
      tg.flex = lerp(tg.flex, -0.7 + wob, w.fall);
      tg.pitch = lerp(tg.pitch, 0.1, w.fall);
      tg.neckA = lerp(tg.neckA, 0.7, w.fall);
      tg.headP = lerp(tg.headP, 0.35, w.fall);
      tg.ear = lerp(tg.ear, 1, w.fall);
      tg.tailA = lerp(tg.tailA, 1.3, w.fall);
      tg.tailWave = lerp(tg.tailWave, 0.4, w.fall);
    }
    if (w.puff > 0.001) {
      tg.flex = lerp(tg.flex, 1.55, w.puff);
      tg.bodyY = lerp(tg.bodyY, 0.24, w.puff);
      tg.len = lerp(tg.len, 0.25, w.puff);
      tg.neckA = lerp(tg.neckA, -0.1, w.puff);
      tg.headP = lerp(tg.headP, -0.05, w.puff);
      tg.headYaw = lerp(tg.headYaw, 0.9, w.puff);
      tg.ear = lerp(tg.ear, 1, w.puff);
      tg.tailA = lerp(tg.tailA, 1.5, w.puff);
      tg.tailCurl = lerp(tg.tailCurl, 0.0, w.puff);
      tg.tailWave = lerp(tg.tailWave, 0.05, w.puff);
      tg.tailThick = lerp(1, 1.9, w.puff);
    }

    // sitting (title, results): haunches down, chest up, tail around the paws
    this.idle(dt, mode, st);
    if (w.sit > 0.001) {
      const sad = mode === 'sad';
      const breathe = Math.sin(this.time * 1.9) * 0.004;
      const sit = {
        bodyX: -0.015, bodyY: 0.1625 + breathe, pitch: 0.77, len: 0.251, flex: 0.55,
        neckA: sad ? 0.05 : 0.42, headP: (sad ? -0.45 : 0.04) + this.lookUp, headYaw: sad ? 0 : this.lookYaw, headRoll: this.lookRoll,
        ear: sad ? 0.8 : this.earTwitch, tailA: -1.25, tailCurl: 0.28, tailYaw: 0.34, tailWave: this.flick, tailThick: 1,
      };
      for (const k in sit) tg[k] = lerp(tg[k], sit[k], w.sit);
    }

    // smooth the body parameters (paws are not smoothed so they stay planted)
    const s = this.s;
    const lam = 20;
    for (const k in tg) s[k] = damp(s[k], tg[k], k === 'headYaw' || k === 'headRoll' ? 6 : lam, dt);

    // ── skeleton ──
    const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    const len = s.len * (1 - 0.06 * s.flex);
    const Hx = s.bodyX - cp * len * 0.5, Hy = s.bodyY - sp * len * 0.5;
    const Sx = s.bodyX + cp * len * 0.5, Sy = s.bodyY + sp * len * 0.5;

    // ── paws ──
    const duty = lerp(0.6, 0.31, amp);
    const D = freq > 0 ? (speed * duty) / freq : 0;
    for (let i = 0; i < 4; i++) {
      const L = LEGS[i];
      const pw = this.paws[i];
      const ax = L.hind ? Hx - 0.012 : Sx + 0.028;
      // gait
      let gx, gy, ga, gb;
      const psi = frac(ph - L.off);
      if (psi < duty) {
        const u = psi / duty;
        gx = ax + D * (0.5 - u);
        gy = PAW_R;
        const roll = smooth(0.62, 1, u) * amp;
        ga = L.hind ? 0 : -0.9 * roll;
        gb = lerp(0.35, -0.55, smooth(0.35, 1, u) * amp);
      } else {
        const u = (psi - duty) / (1 - duty);
        const K = L.hind ? HIND_SWING : FORE_SWING;
        const X = L.hind ? HIND_EXTRA : FORE_EXTRA;
        const f = u * 4;
        const k = Math.min(3, Math.floor(f));
        const t = f - k;
        const P = (j) => { const q = K[clamp(j, 0, 4)]; return q; };
        const px = (j) => { const q = P(j); const jj = clamp(j, 0, 4); return q[0] * D + X[jj] * amp; };
        gx = ax + cm(px(k - 1), px(k), px(k + 1), px(k + 2), t);
        gy = PAW_R + cm(P(k - 1)[1], P(k)[1], P(k + 1)[1], P(k + 2)[1], t) * amp;
        ga = cm(P(k - 1)[2], P(k)[2], P(k + 1)[2], P(k + 2)[2], t) * amp;
        gb = lerp(0.35, cm(P(k - 1)[3], P(k)[3], P(k + 1)[3], P(k + 2)[3], t), amp);
      }
      if (this.landT < 0.26 && !airborne) gy += 0;
      // air pose relative to the joints
      if (w.air > 0.001) {
        const a = clamp(st.vy / 6.5, -1, 1);
        const rise = Math.max(0, a), fall = Math.max(0, -a), apex = 1 - Math.abs(a);
        const push = Math.max(0, 1 - this.takeoffT / 0.12);
        let rx, ry, ra, rb = 0.35;
        const lag = L.near ? 0 : 0.012;
        if (L.hind) {
          rx = -0.2 * rise + 0.04 * apex - 0.03 * fall - 0.04 * push - lag;
          ry = -0.075 * rise - 0.15 * apex - 0.18 * fall - 0.08 * push;
          ra = -1.3 * rise - 0.9 * apex - 0.4 * fall;
          rb = -0.5 * rise + 0.7 * apex + 0.4 * fall;
          gx = lerp(gx, Hx + rx, w.air); gy = lerp(gy, Hy + ry, w.air);
        } else {
          rx = 0.17 * rise + 0.09 * apex + 0.12 * fall + lag;
          ry = -0.07 * rise - 0.14 * apex - 0.19 * fall;
          ra = 0.3 * rise - 0.4 * apex + 0.0 * fall;
          gx = lerp(gx, Sx + rx, w.air); gy = lerp(gy, Sy + ry, w.air);
        }
        ga = lerp(ga, ra, w.air);
        gb = lerp(gb, rb, w.air);
      }
      if (w.bump > 0.001 && !L.hind) {
        gx = lerp(gx, Sx + 0.11, w.bump);
        gy = lerp(gy, Sy - 0.09 + Math.sin(this.time * 22 + i) * 0.015, w.bump);
        ga = lerp(ga, 0.3, w.bump);
      }
      if (w.fall > 0.001) {
        const sp2 = Math.sin(this.time * 7 + i * 1.7) * 0.02;
        gx = lerp(gx, L.hind ? Hx - 0.12 : Sx + 0.12, w.fall);
        gy = lerp(gy, (L.hind ? Hy : Sy) - 0.1 + sp2, w.fall);
        ga = lerp(ga, L.hind ? -0.8 : 0.4, w.fall);
      }
      if (w.puff > 0.001) {
        gx = lerp(gx, L.hind ? Hx - 0.02 : Sx + 0.01, w.puff);
        gy = lerp(gy, PAW_R, w.puff);
        ga = lerp(ga, 0, w.puff);
        gb = lerp(gb, -0.2, w.puff);
      }
      if (w.sit > 0.001) {
        const sx = L.hind ? (L.near ? 0.022 : 0.012) : L.near ? 0.1 : 0.086;
        gx = lerp(gx, sx, w.sit);
        gy = lerp(gy, PAW_R, w.sit);
        ga = lerp(ga, 0, w.sit);
        gb = lerp(gb, 1.35, w.sit);
      }
      pw.x = gx; pw.y = gy; pw.a = ga; pw.b = gb;
    }

    // ── build meshes ──
    this.buildBody(Hx, Hy, Sx, Sy, s);
    for (let i = 0; i < 4; i++) this.buildLeg(i, Hx, Hy, Sx, Sy);
    this.buildTail(dt, s, Hx, Hy, cp, sp, st);

    // root transform
    this.root.position.set(st.x, st.y, 0);
    if (mode === 'fall') this.spin += dt * 2.4; else this.spin = damp(this.spin, 0, 10, dt);
    this.root.rotation.z = -this.spin;
    this.prevVy = st.vy;
  }

  // Blinks, glances, ear flicks and tail-tip twitches while sitting or standing.
  idle(dt, mode, st) {
    this.blinkT -= dt;
    let blink = 1;
    if (this.blinkT < 0) {
      blink = Math.abs(this.blinkT) < 0.12 ? Math.abs(Math.abs(this.blinkT) - 0.06) / 0.06 : 1;
      if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3.5;
    }
    for (const e of this.eyes) e.scale.y = Math.max(0.08, blink);
    this.lookT -= dt;
    if (this.lookT < 0) {
      const r = Math.random();
      this.lookTarget = mode === 'sit' && st.lookUp ? 0.15 : r < 0.5 ? 0.6 : r < 0.8 ? 0.05 : -0.2;
      this.lookT = 2.2 + Math.random() * 3;
    }
    this.lookYaw = damp(this.lookYaw ?? 0.5, this.lookTarget, 3, dt);
    this.lookRoll = Math.sin(this.time * 0.7) * 0.06;
    this.lookUp = damp(this.lookUp ?? 0, st.lookUp ? 0.5 : 0, 2, dt);
    this.earT -= dt;
    if (this.earT < 0) { this.earT = 2.5 + Math.random() * 4; this.earFlickT = 0; }
    this.earFlickT = (this.earFlickT ?? 9) + dt;
    this.earTwitch = this.earFlickT < 0.25 ? Math.sin((this.earFlickT / 0.25) * Math.PI) * 0.9 : 0;
    this.flickT -= dt;
    if (this.flickT < 0) { this.flickT = 1.5 + Math.random() * 3; this.flickStart = this.time; }
    const ft = this.time - (this.flickStart ?? -9);
    this.flick = ft < 0.6 ? Math.sin((ft / 0.6) * Math.PI) * 0.5 : 0.05 * Math.sin(this.time * 1.3);
  }

  buildBody(Hx, Hy, Sx, Sy, s) {
    const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    const ux = -sp, uy = cp;
    const P = this.bodyPts;
    const c1x = Hx + ux * 0.03, c1y = Hy + uy * 0.03;
    const c3x = Sx + ux * 0.018 - cp * 0.035, c3y = Sy + uy * 0.018 - sp * 0.035;
    const th = 0.35 + 0.3 * s.flex;
    const rdx = -cp * Math.cos(th) + sp * Math.sin(th), rdy = -sp * Math.cos(th) - cp * Math.sin(th);
    P[0].set(c1x + rdx * 0.088, c1y + rdy * 0.088, 0);
    P[1].set(c1x + rdx * 0.064, c1y + rdy * 0.064, 0);
    P[2].set(c1x, c1y, 0);
    P[3].set((c1x + c3x) / 2 + ux * (0.008 + 0.03 * s.flex), (c1y + c3y) / 2 + uy * (0.008 + 0.03 * s.flex), 0);
    P[4].set(c3x, c3y, 0);
    const c4x = Sx + ux * 0.035 + cp * 0.03, c4y = Sy + uy * 0.035 + sp * 0.03;
    P[5].set(c4x, c4y, 0);
    const na = s.pitch + s.neckA;
    const ndx = Math.cos(na), ndy = Math.sin(na);
    P[6].set(c4x + ndx * 0.04, c4y + ndy * 0.04, 0);
    const hx = c4x + ndx * 0.084, hy = c4y + ndy * 0.084;
    P[7].set(hx - ndx * 0.022, hy - ndy * 0.022, 0);
    sampleInto(this.body, P, this.bodyRads);
    this.body.build();
    this.head.position.set(hx, hy, 0);
    this.head.rotation.set(s.headRoll, s.headYaw, s.headP, 'YZX');
    for (const e of this.ears) {
      e.pivot.rotation.set(e.side * (0.28 + s.ear * 0.55), 0, -0.1 - s.ear * 0.75);
    }
    this.tailBase = { x: c1x + rdx * 0.06 + ux * 0.018, y: c1y + rdy * 0.06 + uy * 0.018, dx: rdx, dy: rdy };
  }

  buildLeg(i, Hx, Hy, Sx, Sy) {
    const L = LEGS[i];
    const pw = this.paws[i];
    const loft = this.legs[i];
    const o = this.ikOut;
    const zj = L.z, zp = L.pz;
    if (L.hind) {
      const P = this.hindPts;
      const kx = pw.x - Math.sin(pw.b) * HIND.meta, ky = pw.y + Math.cos(pw.b) * HIND.meta;
      ik(Hx, Hy, kx, ky, HIND.l1, HIND.l2, 1, o);
      const dx = o.ex - kx, dy = o.ey - ky;
      const px = pw.x + dx, py = pw.y + dy;
      const tx = px + Math.cos(pw.a) * HIND.toe, ty = py + Math.sin(pw.a) * HIND.toe;
      const zm = (zj + zp) / 2;
      P[0].set(Hx + 0.006, Hy + 0.042, zj * 0.7);
      P[1].set(Hx, Hy, zj);
      P[2].set((Hx + o.jx) / 2 - 0.012, (Hy + o.jy) / 2 - 0.004, zj);
      P[3].set(o.jx, o.jy, zm);
      P[4].set((o.jx + o.ex) / 2, (o.jy + o.ey) / 2, zm);
      P[5].set(o.ex, o.ey, zp);
      P[6].set(px, py, zp);
      P[7].set(tx, ty, zp);
      P[8].set(tx + Math.cos(pw.a) * 0.005, ty + Math.sin(pw.a) * 0.005, zp);
      sampleInto(loft, P, this.hindRads);
    } else {
      const P = this.forePts;
      const wx = pw.x + Math.cos(pw.a + 2.2) * FORE.wrist, wy = pw.y + Math.sin(pw.a + 2.2) * FORE.wrist;
      ik(Sx, Sy, wx, wy, FORE.l1, FORE.l2, -1, o);
      const dx = o.ex - wx, dy = o.ey - wy;
      const px = pw.x + dx, py = pw.y + dy;
      const tx = px + Math.cos(pw.a) * FORE.toe, ty = py + Math.sin(pw.a) * FORE.toe;
      P[0].set(Sx - 0.004, Sy + 0.04, zj * 0.7);
      P[1].set(Sx, Sy, zj);
      P[2].set(o.jx, o.jy, zj);
      P[3].set((o.jx + o.ex) / 2, (o.jy + o.ey) / 2, (zj + zp) / 2);
      P[4].set(o.ex, o.ey, zp);
      P[5].set(px, py, zp);
      P[6].set(tx, ty, zp);
      P[7].set(tx + Math.cos(pw.a) * 0.005, ty + Math.sin(pw.a) * 0.005, zp);
      sampleInto(loft, P, this.foreRads);
    }
    loft.build(Z_AXIS, true);
  }

  // The tail chases a posed target shape through springs, in the cat's own frame, and
  // gets kicked by the body's vertical accelerations so jumps and landings ripple down it.
  buildTail(dt, s, Hx, Hy, cp, sp, st) {
    const n = this.tailN, seg = this.tailSeg;
    const base = this.tailBase;
    const Tt = this.tailT;
    Tt[0].set(base.x, base.y, 0);
    let phi = Math.atan2(-sp, -cp) - s.tailA;
    let yaw = 0;
    const tt = this.time;
    for (let i = 1; i < n; i++) {
      const u = i / (n - 1);
      phi -= s.tailCurl + s.tailWave * Math.sin(TAU * this.phase * 1 + tt * 0.6 - i * 0.55) * (0.4 + u);
      if (s.tailYaw !== 0) yaw += s.tailYaw * smooth(0.1, 0.5, u) * (1 + u);
      const hx = Math.cos(phi), hy = Math.sin(phi);
      const dx = hx * Math.cos(yaw), dz = Math.abs(hx) * Math.sin(yaw);
      Tt[i].set(Tt[i - 1].x + dx * seg, Tt[i - 1].y + hy * seg, Tt[i - 1].z + dz * seg);
      if (this.w.sit > 0.5 && Tt[i].y < 0.016) Tt[i].y = 0.016;
    }
    const P = this.tailP, V = this.tailV;
    if (!this.tailInit) {
      for (let i = 0; i < n; i++) { P[i].copy(Tt[i]); V[i].set(0, 0, 0); }
      this.tailInit = true;
    }
    const kick = ((st.vy - this.prevVy) / CAT_SCALE);
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let sI = 0; sI < steps; sI++) {
      P[0].copy(Tt[0]);
      for (let i = 1; i < n; i++) {
        const u = i / (n - 1);
        const k = lerp(320, 70, u), c = 2 * Math.sqrt(k) * 0.55;
        V[i].x += (k * (Tt[i].x - P[i].x) - c * V[i].x) * h;
        V[i].y += (k * (Tt[i].y - P[i].y) - c * V[i].y) * h;
        V[i].z += (k * (Tt[i].z - P[i].z) - c * V[i].z) * h;
        if (sI === 0) V[i].y -= kick * 0.05 * u;
        P[i].addScaledVector(V[i], h);
      }
      for (let i = 1; i < n; i++) {
        T.subVectors(P[i], P[i - 1]);
        const l = T.length() || 1;
        P[i].copy(P[i - 1]).addScaledVector(T, seg / l);
        if (this.w.sit > 0.5 && P[i].y < 0.014) P[i].y = 0.014;
      }
    }
    const pts = this.tailPts;
    for (let i = 0; i < n; i++) pts[i].copy(P[i]);
    T.subVectors(P[n - 1], P[n - 2]).normalize();
    pts[n].copy(P[n - 1]).addScaledVector(T, 0.012);
    const th = s.tailThick;
    for (let i = 0; i <= n; i++) {
      const r = (i === n ? 0.004 : lerp(0.021, 0.0135, i / (n - 1))) * (i < n ? th : 1);
      this.tailRads[i][0] = this.tailRads[i][1] = this.tailRads[i][2] = r;
    }
    sampleInto(this.tail, pts, this.tailRads);
    this.tail.build(Z_AXIS, true);
  }
}
const TG = {};

function mixColor(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

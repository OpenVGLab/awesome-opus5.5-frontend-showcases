// Dynamic actors: small-cube models (0.1-0.5 m cubes) moving along precomputed paths, instanced per model part.
// Model frame: +x forward, +y up, +z right; origin on the ground under the model centre. Units: metres.
import * as THREE from 'three';
import { sharedUniforms } from './voxelmat.js';

const VS = /* glsl */`
in vec4 acol;
out vec3 vN; out vec4 vC; out vec3 vW;
void main() {
  mat4 im = instanceMatrix;
  vec4 w = modelMatrix * im * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
  vC = acol;
#ifdef USE_INSTANCING_COLOR
  if (acol.a < 0.25) vC.rgb *= instanceColor;
#endif
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */`
precision highp float;
uniform vec3 uSunDir; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uCamPos;
in vec3 vN; in vec4 vC; in vec3 vW;
out vec4 outColor;
vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 fromSRGB(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
void main() {
  vec3 n = normalize(vN);
  vec3 alb = fromSRGB(vC.rgb);
  float sun = max(dot(n, uSunDir), 0.0);
  vec3 col = alb * (vec3(1.0, 0.95, 0.86) * sun * 0.8 + vec3(0.62, 0.72, 0.88) * (0.55 + 0.45 * n.y) * 0.5);
  if (vC.a > 0.75) col = alb * 1.3;                       // lamps, signs, screens
  else if (vC.a > 0.4) {                                  // glass
    vec3 v = normalize(uCamPos - vW);
    float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    col = mix(col, vec3(0.55, 0.65, 0.78), 0.25 + fr * 0.4);
  }
  float dist = length(uCamPos - vW);
  float fog = 1.0 - exp(-pow(dist * uFogDensity, 1.35));
  outColor = vec4(toSRGB(mix(col, uFogColor, fog)), 1.0);
}`;

// ---------------------------------------------------------------------------------------------
// geometry helpers
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
function boxesGeometry(boxes) {
  // boxes: [x0,y0,z0,x1,y1,z1,color,kind]; kind: 0 paintable (instance colour), 0.3 fixed, 0.6 glass, 1 emissive
  const pos = [], nor = [], col = [], idx = [];
  const F = [[[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
    [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]]];
  for (const b of boxes) {
    const [x0, y0, z0, x1, y1, z1, c, k = 0] = b;
    const rgb = hex(c);
    for (const [n, cs] of F) {
      const base = pos.length / 3;
      for (const [cx, cy, cz] of cs) { pos.push(cx ? x1 : x0, cy ? y1 : y0, cz ? z1 : z0); nor.push(...n); col.push(rgb[0], rgb[1], rgb[2], Math.round(k * 255)); }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('acol', new THREE.Uint8BufferAttribute(col, 4, true));
  g.setIndex(idx);
  return g;
}
// voxel disc wheel in the x-y plane (axle along z), centred at origin; rows merged into boxes
function wheel(r, w, vs = 0.08, tire = 0x1b1b1d, hub = 0x9aa0a6) {
  const out = [];
  const n = Math.ceil(r / vs);
  for (let j = -n; j < n; j++) {
    const y = (j + 0.5) * vs; if (Math.abs(y) > r) continue;
    const hx = Math.sqrt(r * r - y * y); const xs = Math.round(hx / vs) * vs;
    out.push([-xs, j * vs, -w / 2, xs, (j + 1) * vs, w / 2, tire, 0.3]);
  }
  const h = r * 0.5;
  out.push([-h, -h, -w / 2 - 0.01, h, h, w / 2 + 0.01, hub, 0.3]);
  out.push([-r * 0.9, -vs * 0.6, -w / 2 - 0.02, r * 0.9, vs * 0.6, w / 2 + 0.02, 0x606468, 0.3]);   // visible spoke so rotation reads
  return out;
}

// ---------------------------------------------------------------------------------------------
// model library: parts = [{ boxes, pivot:[x,y,z], anim, paint }]
const Y = 0xf2c230, BLK = 0x1e1f22, GLASS = 0x2a3440, LIGHT = 0xfff4d0, RED = 0xd83a2e, GRAY = 0x5a5e63, WHITE = 0xf0efe9;
function carParts(len, wid, h, opts = {}) {
  const L = len / 2, Wd = wid / 2, r = opts.r || 0.33;
  const body = [
    [-L, 0.3, -Wd, L, 0.95, Wd, 0xffffff, 0],
    [-L * 0.5, 0.95, -Wd + 0.08, L * 0.42, h, Wd - 0.08, 0xffffff, 0],
    [L * 0.42 - 0.02, 1.0, -Wd + 0.14, L * 0.42 + 0.04, h - 0.06, Wd - 0.14, GLASS, 0.6],
    [-L * 0.5 - 0.04, 1.0, -Wd + 0.14, -L * 0.5 + 0.02, h - 0.06, Wd - 0.14, GLASS, 0.6],
    [-L * 0.44, 1.02, -Wd + 0.04, L * 0.36, h - 0.08, -Wd + 0.1, GLASS, 0.6],
    [-L * 0.44, 1.02, Wd - 0.1, L * 0.36, h - 0.08, Wd - 0.04, GLASS, 0.6],
    [L - 0.02, 0.6, -Wd + 0.12, L + 0.04, 0.78, -Wd + 0.42, LIGHT, 1], [L - 0.02, 0.6, Wd - 0.42, L + 0.04, 0.78, Wd - 0.12, LIGHT, 1],
    [-L - 0.04, 0.62, -Wd + 0.1, -L + 0.02, 0.8, -Wd + 0.38, RED, 1], [-L - 0.04, 0.62, Wd - 0.38, -L + 0.02, 0.8, Wd - 0.1, RED, 1],
    [L - 0.05, 0.3, -Wd, L + 0.06, 0.45, Wd, BLK, 0.3], [-L - 0.06, 0.3, -Wd, -L + 0.05, 0.45, Wd, BLK, 0.3],
    [L * 0.3, 0.95, -Wd - 0.14, L * 0.3 + 0.16, 1.1, -Wd, BLK, 0.3], [L * 0.3, 0.95, Wd, L * 0.3 + 0.16, 1.1, Wd + 0.14, BLK, 0.3],   // mirrors
  ];
  if (opts.taxi) body.push([-0.3, h, -0.32, 0.3, h + 0.2, 0.32, 0xfff7c8, 1], [-L * 0.45, 0.62, -Wd - 0.01, L * 0.3, 0.68, -Wd + 0.01, BLK, 0.3], [-L * 0.45, 0.62, Wd - 0.01, L * 0.3, 0.68, Wd + 0.01, BLK, 0.3]);
  const parts = [{ boxes: body, paint: true }];
  const ax = L * 0.62;
  for (const [x, z] of [[ax, -Wd + 0.1], [ax, Wd - 0.1], [-ax, -Wd + 0.1], [-ax, Wd - 0.1]]) parts.push({ boxes: wheel(r, 0.22), pivot: [x, r, z], anim: 'wheel', r });
  return parts;
}
function busParts() {
  const L = 6, Wd = 1.3, r = 0.5;
  const body = [[-L, 0.35, -Wd, L, 3.1, Wd, 0xffffff, 0]];
  for (const s of [-1, 1]) {
    body.push([-L + 1.2, 1.35, s * Wd - 0.03, L - 0.6, 2.55, s * Wd + 0.03, GLASS, 0.6]);
    body.push([-L, 0.9, s * Wd - 0.02, L, 1.15, s * Wd + 0.02, 0x2f5fb8, 0.3]);
  }
  body.push([L - 0.03, 1.3, -Wd + 0.1, L + 0.03, 2.7, Wd - 0.1, GLASS, 0.6], [L - 0.03, 2.75, -Wd + 0.2, L + 0.04, 3.0, Wd - 0.2, 0xffa52e, 1]);
  body.push([L, 0.6, -Wd + 0.1, L + 0.05, 0.85, -Wd + 0.4, LIGHT, 1], [L, 0.6, Wd - 0.4, L + 0.05, 0.85, Wd - 0.1, LIGHT, 1], [-L - 0.05, 0.7, -Wd + 0.1, -L, 1.0, -Wd + 0.35, RED, 1], [-L - 0.05, 0.7, Wd - 0.35, -L, 1.0, Wd - 0.1, RED, 1]);
  body.push([-L + 0.6, 3.1, -0.8, -L + 3, 3.4, 0.8, 0xcfd3d6, 0.3]);
  const parts = [{ boxes: body, paint: true, color: 0xf4f4f0 }];
  for (const [x, z] of [[L - 1.8, -Wd + 0.15], [L - 1.8, Wd - 0.15], [-L + 2.2, -Wd + 0.15], [-L + 2.2, Wd - 0.15]]) parts.push({ boxes: wheel(r, 0.3), pivot: [x, r, z], anim: 'wheel', r });
  return parts;
}
function subwayCar() {
  const L = 9.1, Wd = 1.5;
  const b = [[-L, 0.5, -Wd, L, 3.6, Wd, 0xb9c0c6, 0.3]];
  for (const s of [-1, 1]) {
    for (let k = -3; k <= 3; k++) b.push([k * 2.5 - 0.7, 1.6, s * Wd - 0.02, k * 2.5 + 0.7, 2.6, s * Wd + 0.02, GLASS, 0.6]);
    for (const k of [-2, 0, 2]) b.push([k * 3.2 - 0.6, 0.6, s * Wd - 0.03, k * 3.2 + 0.6, 3.1, s * Wd + 0.03, 0x8d949b, 0.3]);
    b.push([-L, 3.0, s * Wd - 0.02, L, 3.15, s * Wd + 0.02, 0xe07b2e, 0.3]);
  }
  b.push([L, 1.7, -0.9, L + 0.03, 2.8, 0.9, GLASS, 0.6], [L, 1.0, -1.1, L + 0.05, 1.3, -0.7, LIGHT, 1], [L, 1.0, 0.7, L + 0.05, 1.3, 1.1, LIGHT, 1]);
  b.push([-L + 1, 0.2, -1.1, -L + 3.2, 0.55, 1.1, BLK, 0.3], [L - 3.2, 0.2, -1.1, L - 1, 0.55, 1.1, BLK, 0.3]);
  return [{ boxes: b }];
}
function personParts(opts = {}) {
  const run = !!opts.run;
  const torso = [[-0.13, 0.9, -0.22, 0.13, 1.45, 0.22, 0xffffff, 0]];
  if (opts.bag) torso.push([-0.1, 0.72, 0.26, 0.12, 0.98, 0.36, 0xc8a36b, 0.3]);
  if (opts.pack) torso.push([-0.3, 1.0, -0.17, -0.13, 1.38, 0.17, 0x3a5f8f, 0.3]);
  const head = [[-0.11, 1.5, -0.11, 0.11, 1.74, 0.11, 0xffffff, 0], [-0.12, 1.66, -0.12, 0.12, 1.78, 0.12, opts.hat || 0x3a2a20, 0.3], [-0.03, 1.45, -0.06, 0.05, 1.5, 0.06, 0xd9a882, 0.3]];
  const leg = (z) => [[-0.08, 0.02, z - 0.08, 0.08, 0.9, z + 0.08, 0xffffff, 0], [-0.08, 0, z - 0.09, 0.16, 0.08, z + 0.09, 0x2a2a2a, 0.3]];
  const arm = (z) => [[-0.06, 0.78, z - 0.06, 0.06, 1.42, z + 0.06, 0xffffff, 0]];
  return [
    { boxes: torso, paint: true, set: 'shirt' }, { boxes: head, paint: true, set: 'skin' },
    { boxes: leg(-0.1), pivot: [0, 0.9, 0], anim: run ? 'runL' : 'legL', paint: true, set: 'pants' }, { boxes: leg(0.1), pivot: [0, 0.9, 0], anim: run ? 'runR' : 'legR', paint: true, set: 'pants' },
    { boxes: arm(-0.28), pivot: [0, 1.42, 0], anim: run ? 'runR' : 'legR', paint: true, set: 'shirt' }, { boxes: arm(0.28), pivot: [0, 1.42, 0], anim: run ? 'runL' : 'legL', paint: true, set: 'shirt' },
  ];
}
function cyclistParts() {
  const frame = [[-0.55, 0.62, -0.03, 0.5, 0.68, 0.03, 0xffffff, 0], [-0.05, 0.36, -0.03, 0.02, 0.95, 0.03, 0xffffff, 0], [0.45, 0.36, -0.03, 0.52, 1.02, 0.03, 0xffffff, 0],
    [-0.12, 0.95, -0.09, 0.08, 1.0, 0.09, BLK, 0.3], [0.42, 1.02, -0.28, 0.5, 1.06, 0.28, BLK, 0.3]];
  const rider = [[-0.2, 0.98, -0.2, 0.08, 1.5, 0.2, 0xffffff, 0]];
  const riderHead = [[0.05, 1.48, -0.1, 0.27, 1.7, 0.1, 0xd9a882, 0], [0.03, 1.64, -0.12, 0.3, 1.76, 0.12, 0x2d6bd0, 0.3]];
  const armsB = [[0.02, 1.2, -0.25, 0.46, 1.28, -0.17, 0xd9a882, 0.3], [0.02, 1.2, 0.17, 0.46, 1.28, 0.25, 0xd9a882, 0.3]];
  const thigh = (z) => [[-0.06, 0.55, z - 0.07, 0.06, 1.0, z + 0.07, 0x26303c, 0.3]];
  return [
    { boxes: frame, paint: true, set: 'bike' }, { boxes: rider, paint: true, set: 'shirt' }, { boxes: riderHead }, { boxes: armsB },
    { boxes: thigh(-0.12), pivot: [-0.03, 1.0, 0], anim: 'pedalL' }, { boxes: thigh(0.12), pivot: [-0.03, 1.0, 0], anim: 'pedalR' },
    { boxes: [[-0.14, -0.02, -0.16, 0.14, 0.02, 0.16, 0x444a50, 0.3], [-0.02, -0.14, -0.02, 0.02, 0.14, 0.02, 0x444a50, 0.3]], pivot: [-0.03, 0.4, 0], anim: 'crank' },
    { boxes: wheel(0.34, 0.06, 0.05, 0x1b1b1d, 0xc0c4c8), pivot: [0.52, 0.34, 0], anim: 'wheel', r: 0.34 }, { boxes: wheel(0.34, 0.06, 0.05, 0x1b1b1d, 0xc0c4c8), pivot: [-0.55, 0.34, 0], anim: 'wheel', r: 0.34 },
  ];
}
function dogParts() {
  const body = [[-0.35, 0.3, -0.12, 0.3, 0.55, 0.12, 0xffffff, 0], [0.26, 0.45, -0.1, 0.48, 0.66, 0.1, 0xffffff, 0], [0.46, 0.48, -0.05, 0.56, 0.56, 0.05, BLK, 0.3], [0.3, 0.64, -0.1, 0.36, 0.72, -0.04, 0xffffff, 0], [0.3, 0.64, 0.04, 0.36, 0.72, 0.1, 0xffffff, 0]];
  const leg = (x, z) => [[x - 0.04, 0, z - 0.04, x + 0.04, 0.32, z + 0.04, 0xffffff, 0]];
  return [
    { boxes: body, paint: true, set: 'dog' },
    { boxes: leg(0.2, -0.08), pivot: [0.2, 0.32, 0], anim: 'legL', paint: true, set: 'dog' }, { boxes: leg(0.2, 0.08), pivot: [0.2, 0.32, 0], anim: 'legR', paint: true, set: 'dog' },
    { boxes: leg(-0.26, -0.08), pivot: [-0.26, 0.32, 0], anim: 'legR', paint: true, set: 'dog' }, { boxes: leg(-0.26, 0.08), pivot: [-0.26, 0.32, 0], anim: 'legL', paint: true, set: 'dog' },
    { boxes: [[-0.62, 0.5, -0.03, -0.34, 0.56, 0.03, 0xffffff, 0]], pivot: [-0.34, 0.53, 0], anim: 'wag', paint: true, set: 'dog' },
  ];
}
function carriageParts() {
  const horse = [[1.4, 1.05, -0.3, 3.2, 1.75, 0.3, 0xffffff, 0], [3.0, 1.55, -0.18, 3.5, 2.35, 0.18, 0xffffff, 0], [3.4, 2.1, -0.16, 3.85, 2.4, 0.16, 0xffffff, 0], [1.25, 1.2, -0.06, 1.45, 1.7, 0.06, 0x2a1d14, 0.3],
    [3.05, 2.2, -0.04, 3.4, 2.5, 0.04, 0x2a1d14, 0.3], [1.9, 1.2, -0.32, 2.4, 1.6, 0.32, 0x7a1e1e, 0.3]];
  const leg = (x, z) => [[x - 0.08, 0, z - 0.08, x + 0.08, 1.1, z + 0.08, 0xffffff, 0], [x - 0.09, 0, z - 0.09, x + 0.09, 0.12, z + 0.09, 0x222222, 0.3]];
  const cart = [[-1.5, 0.6, -0.75, 0.6, 1.1, 0.75, 0x151618, 0.3], [-1.3, 1.1, -0.72, -0.2, 1.5, 0.72, 0x7a1e1e, 0.3], [-1.5, 1.1, -0.75, -1.3, 2.1, 0.75, 0x151618, 0.3],
    [-1.55, 2.0, -0.8, -0.4, 2.1, 0.8, 0x151618, 0.3], [0.2, 1.1, -0.5, 0.6, 1.5, 0.5, 0x151618, 0.3], [0.6, 1.1, -0.04, 1.5, 1.16, 0.04, 0x6b4a2c, 0.3],
    [0.25, 1.5, -0.2, 0.55, 2.05, 0.2, 0x202226, 0.3], [0.3, 2.05, -0.13, 0.5, 2.25, 0.13, 0xd9a882, 0.3], [0.28, 2.25, -0.15, 0.52, 2.5, 0.15, 0x111111, 0.3]];
  return [
    { boxes: horse, paint: true, set: 'horse' }, { boxes: cart },
    { boxes: leg(3.0, -0.18), pivot: [3.0, 1.1, 0], anim: 'legL', paint: true, set: 'horse' }, { boxes: leg(3.0, 0.18), pivot: [3.0, 1.1, 0], anim: 'legR', paint: true, set: 'horse' },
    { boxes: leg(1.6, -0.18), pivot: [1.6, 1.1, 0], anim: 'legR', paint: true, set: 'horse' }, { boxes: leg(1.6, 0.18), pivot: [1.6, 1.1, 0], anim: 'legL', paint: true, set: 'horse' },
    { boxes: wheel(0.62, 0.08, 0.08, 0x2a1d14, 0x9b1b1b), pivot: [-0.9, 0.62, -0.8], anim: 'wheel', r: 0.62 }, { boxes: wheel(0.62, 0.08, 0.08, 0x2a1d14, 0x9b1b1b), pivot: [-0.9, 0.62, 0.8], anim: 'wheel', r: 0.62 },
    { boxes: wheel(0.45, 0.08, 0.08, 0x2a1d14, 0x9b1b1b), pivot: [0.4, 0.45, -0.72], anim: 'wheel', r: 0.45 }, { boxes: wheel(0.45, 0.08, 0.08, 0x2a1d14, 0x9b1b1b), pivot: [0.4, 0.45, 0.72], anim: 'wheel', r: 0.45 },
  ];
}
function birdParts(gull) {
  const s = gull ? 1.6 : 1;
  const body = [[-0.16 * s, -0.05 * s, -0.05 * s, 0.14 * s, 0.05 * s, 0.05 * s, gull ? WHITE : 0x7d8590, 0.3], [0.1 * s, 0.0, -0.035 * s, 0.2 * s, 0.07 * s, 0.035 * s, gull ? WHITE : 0x55606b, 0.3], [0.2 * s, 0.02 * s, -0.01, 0.25 * s, 0.04 * s, 0.01, 0xe0a030, 0.3]];
  const wing = (sg) => [[-0.08 * s, -0.01, 0, 0.08 * s, 0.01, sg * 0.34 * s, gull ? 0xb8bec4 : 0x6a737c, 0.3]];
  return [{ boxes: body }, { boxes: wing(-1), pivot: [0, 0, -0.04 * s], anim: 'wingL' }, { boxes: wing(1), pivot: [0, 0, 0.04 * s], anim: 'wingR' }];
}
function heliParts(c) {
  const body = [[-2.2, 0.9, -0.95, 2.4, 2.7, 0.95, c, 0.3], [2.2, 1.1, -0.8, 3.2, 2.5, 0.8, GLASS, 0.6], [-7.5, 1.9, -0.25, -2.2, 2.4, 0.25, c, 0.3], [-7.6, 1.9, -0.06, -6.6, 3.6, 0.06, c, 0.3],
    [-1.8, 0, -1.2, 2.2, 0.12, -1.05, 0x2a2a2a, 0.3], [-1.8, 0, 1.05, 2.2, 0.12, 1.2, 0x2a2a2a, 0.3], [-0.2, 0.1, -1.15, 0.0, 0.95, 1.15, 0x2a2a2a, 0.3], [-0.3, 2.7, -0.3, 0.3, 3.1, 0.3, 0x333333, 0.3],
    [-7.55, 2.1, -0.08, -7.5, 2.3, 0.08, RED, 1]];
  const rotor = [[-5.6, -0.04, -0.18, 5.6, 0.04, 0.18, 0x222222, 0.3], [-0.18, -0.04, -5.6, 0.18, 0.04, 5.6, 0x222222, 0.3]];
  const tail = [[-0.04, -0.9, -0.1, 0.04, 0.9, 0.1, 0x333333, 0.3]];
  return [{ boxes: body }, { boxes: rotor, pivot: [0, 3.15, 0], anim: 'rotor' }, { boxes: tail, pivot: [-7.2, 2.9, 0.12], anim: 'tailrotor' }];
}
function boatParts(kind) {
  const b = [];
  const hull = (L, Wd, h, c, stripe) => { b.push([-L / 2, -0.8, -Wd / 2, L / 2, h, Wd / 2, c, 0.3], [L / 2, -0.4, -Wd / 3, L / 2 + Wd * 0.4, h, Wd / 3, c, 0.3]); if (stripe) b.push([-L / 2, h - 0.5, -Wd / 2 - 0.02, L / 2, h - 0.2, Wd / 2 + 0.02, stripe, 0.3]); };
  const cabin = (x0, x1, Wd, y0, y1, c) => { b.push([x0, y0, -Wd / 2, x1, y1, Wd / 2, c, 0.3]); for (const s of [-1, 1]) b.push([x0 + 0.5, y0 + (y1 - y0) * 0.35, s * Wd / 2 - 0.02, x1 - 0.5, y1 - 0.3, s * Wd / 2 + 0.02, GLASS, 0.6]); };
  switch (kind) {
    case 'ferry_si': hull(92, 20, 3, 0xe8702a, 0xf0efe9); cabin(-40, 40, 18, 3, 7.5, 0xe8702a); cabin(-36, 36, 16, 7.5, 11, 0xe8702a); cabin(-8, 8, 10, 11, 14, 0xf0efe9); b.push([-44, 11, -3, -38, 14, 3, 0xf0efe9, 0.3], [38, 11, -3, 44, 14, 3, 0xf0efe9, 0.3], [-0.3, 14, -0.3, 0.3, 22, 0.3, 0x333333, 0.3]); break;
    case 'ferry_nyw': hull(30, 9, 1.8, 0xf2f2ee, 0xe0802e); cabin(-11, 9, 8.2, 1.8, 4.6, 0xf2f2ee); cabin(-4, 5, 6, 4.6, 6.8, 0xf2f2ee); break;
    case 'ferry_nyc': hull(26, 8.5, 1.7, 0xf2f2ee, 0x2a8fb0); cabin(-10, 8, 7.8, 1.7, 4.4, 0xf2f2ee); cabin(-3, 5, 5.6, 4.4, 6.5, 0x2a8fb0); break;
    case 'ferry_gov': hull(30, 10, 2, 0xf2f2ee, 0x3a7a4a); cabin(-12, 10, 9, 2, 5, 0xf2f2ee); cabin(-3, 4, 6, 5, 7.4, 0xf2f2ee); break;
    case 'cruise': hull(50, 11, 2.2, 0xf2f2ee, 0x2f5fb8); cabin(-22, 18, 10, 2.2, 5.2, 0xf2f2ee); cabin(-18, 12, 9, 5.2, 7.8, 0xf2f2ee); cabin(8, 13, 5, 7.8, 10, 0x2f5fb8); break;
    case 'water_taxi': hull(20, 7, 1.6, 0xf2c230, 0x1e1f22); cabin(-7, 6, 6.4, 1.6, 4.0, 0xf2c230); break;
    case 'speedboat': hull(8, 2.8, 1.0, 0xf2f2ee, 0x2f5fb8); b.push([0.5, 1.0, -1.1, 1.3, 1.8, 1.1, GLASS, 0.6]); break;
    case 'tug': hull(24, 9, 2.2, 0xa8302a, 0x1e1f22); cabin(-4, 6, 7, 2.2, 5.6, 0xf2f2ee); cabin(0, 5, 5, 5.6, 8.4, 0xf2f2ee); b.push([-6, 2.2, -1, -4, 10, 1, 0x1e1f22, 0.3], [-6, 9, -1.05, -4, 9.6, 1.05, RED, 0.3]); break;
    case 'sailboat': hull(10, 3.4, 1.2, 0xf4f4f0, 0x2f5fb8); b.push([-1, 1.2, -1.2, 2, 2.0, 1.2, 0xf4f4f0, 0.3], [0.3, 1.2, -0.08, 0.5, 15, 0.08, 0xd0d0d0, 0.3]);
      for (let k = 0; k < 13; k++) { const y = 2.2 + k; const w = 4.2 * (1 - k / 13); b.push([0.5 - w - 0.1, y, -0.04, 0.5 - 0.1, y + 1, 0.04, WHITE, 0.3]); } break;
    case 'cargo': hull(200, 32, 6, 0x23395c, 0xa8302a); b.push([-96, 6, -15, -76, 30, 15, 0xf2f2ee, 0.3]);
      for (let x = -70; x < 92; x += 6.2) for (let yl = 0; yl < 4; yl++) for (let zl = -5; zl <= 4; zl++) b.push([x, 6 + yl * 2.6, zl * 2.5 + 0.05, x + 6, 8.5 + yl * 2.6, zl * 2.5 + 2.45, [0x3d5f8f, 0xc9672e, 0x8a3b30, 0xe0b94a, 0x4d7f5a, 0xb8b8b4][(Math.abs(x * 7 + yl * 3 + zl * 5)) % 6], 0.3]);
      break;
    default: hull(10, 4, 1, WHITE, 0);
  }
  return [{ boxes: b }];
}
function bargeParts() {
  return [{ boxes: [[-30, -1, -7.5, 30, 1.8, 7.5, 0x6a5040, 0.3], [-26, 1.8, -6, 26, 3.2, 6, 0xc8b88a, 0.3]] }];
}

const MODELS = {
  car: { parts: () => carParts(4.6, 1.85, 1.48), palette: [0xf0efe9, 0x1e1f22, 0xb3b8bc, 0x8e2a26, 0x2f4f7f, 0x6c7075, 0x3b5a3a, 0xc7c2b8] },
  suv: { parts: () => carParts(4.9, 1.95, 1.8, { r: 0.37 }), palette: [0x1e1f22, 0xf0efe9, 0x6c7075, 0x2b3a4a, 0x7a1e1e] },
  van: { parts: () => carParts(5.2, 2.0, 2.2, { r: 0.36 }), palette: [0xf0efe9, 0xdedad0, 0x2b3a4a] },
  truck: { parts: () => carParts(7.5, 2.4, 3.2, { r: 0.48 }), palette: [0xf0efe9, 0xc9672e, 0x2f5fb8] },
  taxi: { parts: () => carParts(4.7, 1.85, 1.52, { taxi: true }), palette: [Y] },
  bus: { parts: busParts, palette: [0xf4f4f0] },
  subway: { parts: subwayCar, palette: [0xffffff] },
  walker: { parts: () => personParts(), person: true },
  walker_bag: { parts: () => personParts({ bag: true }), person: true },
  walker_suit: { parts: () => personParts({ hat: 0x222222 }), person: true, suit: true },
  tourist: { parts: () => personParts({ pack: true, hat: 0xe0c040 }), person: true },
  jogger: { parts: () => personParts({ run: true, hat: 0xd83a2e }), person: true, bright: true },
  cyclist: { parts: cyclistParts, person: true },
  dog: { parts: dogParts, palette: [0x8a5a32, 0x1e1f22, 0xe8e2d4, 0xc99a50, 0x7c7c78] },
  carriage: { parts: carriageParts, palette: [0x6b4a2c, 0xf0ece0, 0x2a2420, 0x9c7a55, 0x3a2a20] },
  bird: { parts: () => birdParts(false) }, gull: { parts: () => birdParts(true) },
  heli: { parts: () => heliParts(0x2f5fb8), variants: [0x2f5fb8, 0xe8e6de, 0xb33a2e, 0x1e1f22] },
  ferry_si: { parts: () => boatParts('ferry_si') }, ferry_nyw: { parts: () => boatParts('ferry_nyw') }, ferry_nyc: { parts: () => boatParts('ferry_nyc') },
  ferry_gov: { parts: () => boatParts('ferry_gov') }, cruise: { parts: () => boatParts('cruise') }, water_taxi: { parts: () => boatParts('water_taxi') },
  speedboat: { parts: () => boatParts('speedboat') }, tug: { parts: () => boatParts('tug') }, sailboat: { parts: () => boatParts('sailboat') },
  cargo: { parts: () => boatParts('cargo') }, barge: { parts: bargeParts },
};
const SHIRTS = [0x2f5fb8, 0xd83a2e, 0xf0efe9, 0x1e1f22, 0x3b8a4a, 0xe0b94a, 0x8e6bb0, 0xe07b2e, 0x6c7075, 0x2aa6b8, 0xf09ab8, 0x7a5232];
const PANTS = [0x26303c, 0x1e1f22, 0x3a4a6a, 0x7a6a50, 0x55504a, 0x2f3f5f];
const SKINS = [0xf1c7a4, 0xd9a882, 0xb07a52, 0x7a5236, 0xe8b894, 0x5a3a26];
const SUIT = [0x22252a, 0x2b3345, 0x3a3d42];

// ---------------------------------------------------------------------------------------------
export class Actors {
  constructor(scene) { this.scene = scene; this.count = 0; this.zones = []; this.visibleCount = 0; this.group = new THREE.Group(); scene.add(this.group); }

  async load(url) {
    const d = await (await fetch(url)).json();
    this.data = d;
    this.zones = d.zones || [];
    this.count = (d.actors || []).length;
    // paths: cumulative lengths
    this.paths = d.paths.map((p) => {
      const pts = p.pts, n = pts.length, closed = p.closed;
      const m = closed ? n + 1 : n;
      const X = new Float32Array(m), Yv = new Float32Array(m), Z = new Float32Array(m), S = new Float32Array(m);
      for (let i = 0; i < m; i++) { const q = pts[i % n]; X[i] = q[0]; Yv[i] = q[1]; Z[i] = q[2]; if (i) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Yv[i] - Yv[i - 1] * 0 + 0, Z[i] - Z[i - 1]) + 1e-4; }
      // 3D length for flying paths
      for (let i = 1; i < m; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Yv[i] - Yv[i - 1], Z[i] - Z[i - 1]) + 1e-4;
      const dwell = (p.dwell || []).map(([k, sec]) => [S[k], sec]).sort((a, b) => a[0] - b[0]);
      return { X, Y: Yv, Z, S, L: S[m - 1], closed, ping: !!p.pingpong, dwell, m };
    });
    // expand actors into instances (trains -> cars, tugs -> barges)
    const inst = [];
    for (const a of d.actors) {
      if (a.t === 'subway') { for (let k = 0; k < (a.cars || 8); k++) inst.push({ ...a, o: a.o - k * 18.6, sub: k }); continue; }
      inst.push(a);
      if (a.barge) inst.push({ ...a, t: 'barge', o: a.o + 45 });
    }
    // group by type
    this.byType = new Map();
    for (const a of inst) { if (!MODELS[a.t]) continue; if (!this.byType.has(a.t)) this.byType.set(a.t, []); this.byType.get(a.t).push(a); }
    this.material = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VS, fragmentShader: FS, uniforms: { ...sharedUniforms } });
    this.meshes = [];
    const col = new THREE.Color();
    for (const [type, list] of this.byType) {
      const spec = MODELS[type];
      const parts = spec.parts();
      list.forEach((a, i) => { a.seed = (i * 2654435761) >>> 0; a.heading = 0; });
      for (const part of parts) {
        const geo = boxesGeometry(part.pivot ? part.boxes.map((b) => [b[0] - (part.anim === 'wheel' ? 0 : part.pivot[0]), b[1] - (part.anim === 'wheel' ? 0 : part.pivot[1]), b[2] - (part.anim === 'wheel' ? 0 : part.pivot[2]), b[3] - (part.anim === 'wheel' ? 0 : part.pivot[0]), b[4] - (part.anim === 'wheel' ? 0 : part.pivot[1]), b[5] - (part.anim === 'wheel' ? 0 : part.pivot[2]), b[6], b[7]]) : part.boxes);
        const mesh = new THREE.InstancedMesh(geo, this.material, list.length);
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (part.paint || spec.variants) {
          for (let i = 0; i < list.length; i++) {
            const a = list[i], c = a.c || 0;
            let hc = 0xffffff;
            if (spec.person) {
              const s = part.set;
              hc = s === 'shirt' ? (spec.suit ? SUIT[c % 3] : SHIRTS[(c + (a.seed & 7)) % SHIRTS.length]) : s === 'pants' ? (spec.suit ? SUIT[c % 3] : PANTS[(a.seed >> 3) % PANTS.length]) : s === 'skin' ? SKINS[(a.seed >> 5) % SKINS.length] : s === 'bike' ? SHIRTS[(a.seed >> 7) % SHIRTS.length] : 0xffffff;
            } else if (spec.palette) hc = spec.palette[c % spec.palette.length];
            else if (spec.variants) hc = spec.variants[c % spec.variants.length];
            col.setHex(hc);
            mesh.setColorAt(i, col);
          }
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
        this.group.add(mesh);
        this.meshes.push({ mesh, part, list, type });
      }
    }
    this.m4 = new THREE.Matrix4(); this.m4b = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  // position on path at arc s; returns [x,y,z,hx,hz]
  sample(p, s, out) {
    const { X, Y: Yv, Z, S, m } = p;
    let lo = 0, hi = m - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid] <= s) lo = mid; else hi = mid; }
    const t = (s - S[lo]) / Math.max(1e-6, S[hi] - S[lo]);
    out[0] = X[lo] + (X[hi] - X[lo]) * t; out[1] = Yv[lo] + (Yv[hi] - Yv[lo]) * t; out[2] = Z[lo] + (Z[hi] - Z[lo]) * t;
    out[3] = X[hi] - X[lo]; out[4] = Z[hi] - Z[lo];
    return out;
  }
  // actor arc position at time t (handles loops, ping-pong and dwell)
  arc(a, p, t) {
    const v = a.v;
    let total = p.L;
    let dw = 0; for (const [, sec] of p.dwell) dw += sec * v;
    if (p.ping) total = 2 * p.L;
    let q = (a.o + v * t) % (total + dw); if (q < 0) q += total + dw;
    let dir = 1;
    for (const [sk, sec] of p.dwell) { if (q < sk) break; if (q < sk + sec * v) { q = sk; return [q, dir, true]; } q -= sec * v; }
    if (p.ping && q > p.L) { q = 2 * p.L - q; dir = -1; }
    return [q, dir, false];
  }

  update(t, camera) {
    if (!this.meshes) return;
    const tmp = [0, 0, 0, 0, 0], tmp2 = [0, 0, 0, 0, 0];
    const cam = camera.position;
    const maxD = 3500;
    let vis = 0;
    // compute poses per actor once
    for (const [type, list] of this.byType) {
      for (const a of list) {
        const p = this.paths[a.p];
        const [s, dir, dwelling] = this.arc(a, p, t);
        this.sample(p, s, tmp);
        const la = Math.min(4, p.L * 0.01);
        this.sample(p, Math.max(0, Math.min(p.L, s + la)), tmp2);
        let hx = tmp2[0] - tmp[0], hz = tmp2[2] - tmp[2];
        if (Math.abs(hx) + Math.abs(hz) < 0.05) { this.sample(p, Math.max(0, s - la), tmp2); hx = tmp[0] - tmp2[0]; hz = tmp[2] - tmp2[2]; }
        if (dir < 0) { hx = -hx; hz = -hz; }
        const hl = Math.hypot(hx, hz);
        if (hl > 0.02) a.heading = Math.atan2(-hz, hx);
        const ch = Math.cos(a.heading), sh = Math.sin(a.heading);
        const lane = a.lane || 0;
        // right-of-travel offset (+z in model frame)
        a.px = tmp[0] + sh * lane; a.pz = tmp[2] + ch * lane; a.py = tmp[1];
        a.dist = a.o + a.v * t * (dwelling ? 0 : 1);
        a.dwelling = dwelling;
        const dx = a.px - cam.x, dy = a.py - cam.y, dz = a.pz - cam.z;
        a.vis = dx * dx + dy * dy + dz * dz < (type.startsWith('ferry') || type === 'cargo' || type === 'heli' || type === 'cruise' || type === 'subway' ? maxD * 2.2 : maxD) ** 2;
        if (a.vis) vis++;
      }
    }
    this.visibleCount = vis;
    const m = this.m4, mb = this.m4b, q = this.q, e = this.e, v = this.v;
    for (const { mesh, part, list, type } of this.meshes) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (!a.vis) { mesh.setMatrixAt(i, this.zero); continue; }
        // root
        let bob = 0, roll = 0, pitch = 0;
        if (type.startsWith('ferry') || type === 'cruise' || type === 'tug' || type === 'barge' || type === 'water_taxi' || type === 'speedboat' || type === 'sailboat' || type === 'cargo') {
          const ph = a.seed % 1000 / 159;
          bob = Math.sin(t * 0.9 + ph) * 0.15; roll = Math.sin(t * 0.7 + ph) * (type === 'sailboat' ? 0.12 : 0.025) + (type === 'sailboat' ? 0.12 : 0); pitch = Math.sin(t * 0.55 + ph * 2) * 0.02;
        }
        if (type === 'heli') { pitch = a.dwelling ? 0 : -0.08; }
        if (type === 'bird' || type === 'gull') bob = Math.sin(t * 2 + (a.seed % 100)) * 0.4;
        e.set(roll, a.heading, pitch, 'YXZ');
        q.setFromEuler(e);
        v.set(a.px, a.py + bob, a.pz);
        m.compose(v, q, this.s);
        if (part.pivot) {
          const [px, py, pz] = part.pivot;
          let ang = 0, axis = 'z';
          const d = a.dwelling ? 0 : a.dist;
          switch (part.anim) {
            case 'wheel': ang = -d / (part.r || 0.33); break;
            case 'legL': ang = Math.sin(d * 4.5) * 0.45; break;
            case 'legR': ang = -Math.sin(d * 4.5) * 0.45; break;
            case 'runL': ang = Math.sin(d * 2.6) * 0.8; break;
            case 'runR': ang = -Math.sin(d * 2.6) * 0.8; break;
            case 'crank': ang = -d / 0.34 / 2.4; break;
            case 'pedalL': ang = Math.sin(-d / 0.34 / 2.4) * 0.55 - 0.35; break;
            case 'pedalR': ang = Math.sin(-d / 0.34 / 2.4 + Math.PI) * 0.55 - 0.35; break;
            case 'rotor': ang = t * 22; axis = 'y'; break;
            case 'tailrotor': ang = t * 40; axis = 'z'; break;
            case 'wingL': ang = Math.sin(t * 16 + (a.seed % 50)) * 0.7; axis = 'x'; break;
            case 'wingR': ang = -Math.sin(t * 16 + (a.seed % 50)) * 0.7; axis = 'x'; break;
            case 'wag': ang = Math.sin(t * 9) * 0.5; axis = 'y'; break;
            default: break;
          }
          if (type === 'dog' || type === 'carriage') { if (part.anim === 'legL' || part.anim === 'legR') ang *= 0.8; }
          mb.makeTranslation(px, py, pz);
          m.multiply(mb);
          if (axis === 'z') mb.makeRotationZ(ang); else if (axis === 'y') mb.makeRotationY(ang); else mb.makeRotationX(ang);
          m.multiply(mb);
          if (part.anim !== 'wheel') { mb.makeTranslation(0, 0, 0); }
        }
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

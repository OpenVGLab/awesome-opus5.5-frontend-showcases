import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const angleTo = (from, to) => wrapAngle(to - from);
export const dampAngle = (a, b, k, dt) => a + angleTo(a, b) * (1 - Math.exp(-k * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2i(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hash3i(x, y, z) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440670441)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2i(ix, iy), b = hash2i(ix + 1, iy), c = hash2i(ix, iy + 1), d = hash2i(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function fbm2(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f + i * 17.31, y * f - i * 9.17);
    n += a; a *= 0.5; f *= 2.03;
  }
  return s / n;
}

export function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const x00 = l(hash3i(ix, iy, iz), hash3i(ix + 1, iy, iz), ux);
  const x10 = l(hash3i(ix, iy + 1, iz), hash3i(ix + 1, iy + 1, iz), ux);
  const x01 = l(hash3i(ix, iy, iz + 1), hash3i(ix + 1, iy, iz + 1), ux);
  const x11 = l(hash3i(ix, iy + 1, iz + 1), hash3i(ix + 1, iy + 1, iz + 1), ux);
  return l(l(x00, x10, uy), l(x01, x11, uy), uz);
}

/* periodic value noise for tileable textures */
export function pnoise2(x, y, px, py, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const w = (v, p) => ((v % p) + p) % p;
  const h = (i, j) => hash3i(w(i, px), w(j, py), seed);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/* ------------------------------------------------------------------ GLSL helpers */

export const GLSL_NOISE = /* glsl */`
float fh13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float fvn3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fh13(i), fh13(i + vec3(1,0,0)), f.x), mix(fh13(i + vec3(0,1,0)), fh13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fh13(i + vec3(0,0,1)), fh13(i + vec3(1,0,1)), f.x), mix(fh13(i + vec3(0,1,1)), fh13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fh12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float fvn2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fh12(i), fh12(i + vec2(1,0)), f.x), mix(fh12(i + vec2(0,1)), fh12(i + vec2(1,1)), f.x), f.y);
}
float ffbm2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * fvn2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
`;

/* Shared uniforms (time / wind) used by every animated material */
export const SHARED = {
  time: { value: 0 },
  wind: { value: 1 },
};

/*
 * Watercolour "wash" material: a Lambert material whose albedo is gently mottled by 3D noise,
 * the way a hand-laid wash never dries perfectly evenly.
 *   space 'world'  – noise anchored to the world (static scenery, instanced props)
 *   space 'local'  – noise anchored to the model (moving animals)
 * options.wind: sway vertices above options.windBase (trees, grass, wheat)
 */
export function washMaterial(params = {}, options = {}) {
  const amt = options.amt ?? 0.14;
  const space = options.space ?? 'world';
  const scale = options.scale ?? 0.45;
  const wind = options.wind ?? 0;
  const windBase = options.windBase ?? 0;
  // world-space radius around the camera where fragments are cut away (leaves and trunks brushing the lens)
  const cut = space === 'world' ? options.cut ?? 0 : 0;
  const m = new THREE.MeshLambertMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWashAmt = { value: amt };
    sh.uniforms.uWashScale = { value: scale };
    sh.uniforms.uCut = { value: cut };
    sh.uniforms.uTime = SHARED.time;
    sh.uniforms.uWind = SHARED.wind;
    sh.uniforms.uWindAmt = { value: wind };
    sh.uniforms.uWindBase = { value: windBase };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWashPos;
        uniform float uTime; uniform float uWind; uniform float uWindAmt; uniform float uWindBase;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (uWindAmt > 0.0) {
          #ifdef USE_INSTANCING
            vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 ip = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
          #endif
          float hgt = max(position.y - uWindBase, 0.0);
          float ph = uTime * 1.6 + ip.x * 0.31 + ip.z * 0.23;
          float sw = (sin(ph) * 0.65 + sin(ph * 2.3 + 1.7) * 0.25 + sin(uTime * 0.37 + ip.x * 0.05) * 0.4) * uWind;
          transformed.x += sw * uWindAmt * hgt * hgt;
          transformed.z += sw * uWindAmt * 0.55 * hgt * hgt;
        }`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        ${space === 'world'
          ? `{ vec4 wp = vec4(transformed, 1.0);
               #ifdef USE_INSTANCING
                 wp = instanceMatrix * wp;
               #endif
               vWashPos = (modelMatrix * wp).xyz; }`
          : 'vWashPos = position * 4.0;'}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWashPos; uniform float uWashAmt; uniform float uWashScale; uniform float uCut;
        ${GLSL_NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        ${cut > 0 ? 'if (distance(vWashPos, cameraPosition) < uCut) discard;' : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float wn = fvn3(vWashPos * uWashScale) * 0.62 + fvn3(vWashPos * uWashScale * 3.7 + 11.0) * 0.38;
          diffuseColor.rgb *= mix(1.0 - uWashAmt, 1.0 + uWashAmt * 0.55, wn);
        }`);
  };
  m.customProgramCacheKey = () => `wash:${space}:${amt}:${scale}:${wind}:${windBase}:${cut}`;
  return m;
}

const matCache = new Map();
/* Cached flat-coloured wash material for static scenery */
export function mat(color, opts = {}) {
  const key = `${color}|${opts.amt ?? ''}|${opts.side ?? ''}|${opts.scale ?? ''}`;
  let m = matCache.get(key);
  if (!m) {
    const amt = opts.amt ?? 0.14, scale = opts.scale ?? 0.45;
    m = washMaterial({ color, side: opts.side ?? THREE.FrontSide }, { amt, scale });
    m.userData = { flat: true, amt, scale };
    matCache.set(key, m);
  }
  return m;
}

/* ------------------------------------------------------------------ geometry helpers */

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export function makeMatrix(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/* Paint a flat (or procedural) vertex colour onto a geometry */
export function paintGeometry(geo, color) {
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    if (typeof color === 'function') {
      const r = color(pos.getX(i), pos.getY(i), pos.getZ(i), c);
      if (r && r.isColor) c.copy(r);
    } else c.set(color);
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function normalizeForMerge(g, withColor) {
  let geo = g.index ? g.toNonIndexed() : g;
  if (geo === g) geo = g.clone();
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') geo.deleteAttribute(name);
  }
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (withColor && !geo.attributes.color) paintGeometry(geo, '#ffffff');
  if (!withColor && geo.attributes.color) geo.deleteAttribute('color');
  geo.clearGroups();
  return geo;
}

/*
 * Batcher – collects many small static pieces and merges them. Flat-coloured wash materials are
 * baked into vertex colours so a whole village shares one material, and pieces are grouped into
 * spatial chunks so the camera and the sun's shadow camera can still cull what they cannot see.
 */
const bakedMats = new Map();
function bakedMaterial(side, amt, scale) {
  const k = `${side}|${amt}|${scale}`;
  if (!bakedMats.has(k)) bakedMats.set(k, washMaterial({ vertexColors: true, side }, { amt, scale }));
  return bakedMats.get(k);
}
const _box = new THREE.Box3();
const _ctr = new THREE.Vector3();

export class Batcher {
  constructor(chunk = 0) { this.buckets = new Map(); this.chunk = chunk; }
  add(geometry, material, matrix) {
    const bake = material.userData.flat && !material.vertexColors;
    const g = normalizeForMerge(geometry, !!material.vertexColors || bake);
    if (bake) {
      const c = material.color;
      const col = g.attributes.color;
      for (let i = 0; i < col.count; i++) col.setXYZ(i, c.r, c.g, c.b);
    }
    if (matrix) g.applyMatrix4(matrix);
    const target = bake ? bakedMaterial(material.side, material.userData.amt, material.userData.scale) : material;
    let cell = '';
    if (this.chunk > 0) {
      _box.setFromBufferAttribute(g.attributes.position).getCenter(_ctr);
      cell = `${Math.floor(_ctr.x / this.chunk)},${Math.floor(_ctr.z / this.chunk)}`;
    }
    let b = this.buckets.get(target);
    if (!b) { b = new Map(); this.buckets.set(target, b); }
    let list = b.get(cell);
    if (!list) { list = []; b.set(cell, list); }
    list.push(g);
    return g;
  }
  build(parent, { castShadow = true, receiveShadow = true, name = 'batch' } = {}) {
    const meshes = [];
    for (const [material, cells] of this.buckets) {
      for (const list of cells.values()) {
        if (!list.length) continue;
        const merged = mergeGeometries(list, false);
        merged.computeBoundingSphere();
        merged.computeBoundingBox();
        const mesh = new THREE.Mesh(merged, material);
        mesh.name = name;
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        mesh.matrixAutoUpdate = false;
        parent.add(mesh);
        meshes.push(mesh);
        for (const g of list) g.dispose();
      }
    }
    this.buckets.clear();
    return meshes;
  }
}

/* A triangular prism (gable) with its ridge running along X, base on y = 0 */
export function gableGeometry(w, d, h) {
  const hw = w / 2, hd = d / 2;
  const P = [
    // front gable (x = +hw) and back gable (x = -hw)
    [hw, 0, hd], [hw, 0, -hd], [hw, h, 0],
    [-hw, 0, -hd], [-hw, 0, hd], [-hw, h, 0],
    // slope +z
    [-hw, 0, hd], [hw, 0, hd], [hw, h, 0],
    [-hw, 0, hd], [hw, h, 0], [-hw, h, 0],
    // slope -z
    [hw, 0, -hd], [-hw, 0, -hd], [-hw, h, 0],
    [hw, 0, -hd], [-hw, h, 0], [hw, h, 0],
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.flat()), 3));
  g.computeVertexNormals();
  return g;
}

/* Roof as two thick slabs over a gable of width w (ridge along X), depth d, rise h */
export function addGableRoof(batcher, material, matrix, w, d, h, { overhang = 0.35, thick = 0.2, y = 0 } = {}) {
  const hd = d / 2;
  const ang = Math.atan2(h, hd);
  const slope = Math.hypot(hd, h) + overhang;
  const slab = new THREE.BoxGeometry(w + overhang * 2, thick, slope);
  const cy = y + h - Math.sin(ang) * slope / 2 + Math.cos(ang) * thick / 2;
  const cz = Math.cos(ang) * slope / 2 + Math.sin(ang) * thick / 2;
  for (const s of [1, -1]) {
    const local = makeMatrix(0, cy, s * cz, s * ang, 0, 0);
    batcher.add(slab, material, new THREE.Matrix4().multiplyMatrices(matrix, local));
  }
  const ridge = new THREE.CylinderGeometry(thick * 0.8, thick * 0.8, w + overhang * 2, 8);
  batcher.add(ridge, material, new THREE.Matrix4().multiplyMatrices(matrix, makeMatrix(0, y + h + thick * 0.75, 0, 0, 0, Math.PI / 2)));
}

/* Simple spatial hash for static colliders */
export class Colliders {
  constructor(cell = 8) {
    this.cell = cell;
    this.list = [];
    this.grid = new Map();
    this.stamp = 0;
  }
  _key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  _insert(c, minX, minZ, maxX, maxZ) {
    const s = this.cell;
    for (let ix = Math.floor(minX / s); ix <= Math.floor(maxX / s); ix++) {
      for (let iz = Math.floor(minZ / s); iz <= Math.floor(maxZ / s); iz++) {
        const k = this._key(ix, iz);
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(c);
      }
    }
  }
  /* rot: angle about Y; hw/hd half extents along the rect's local X / Z */
  addRect(cx, cz, hw, hd, rot, base, h, opts = {}) {
    const c = { type: 'rect', cx, cz, hw, hd, cos: Math.cos(rot), sin: Math.sin(rot), base, top: base + h, stand: !!opts.stand, cam: opts.cam ?? h > 2.2, _s: 0 };
    const r = Math.hypot(hw, hd);
    this.list.push(c);
    this._insert(c, cx - r, cz - r, cx + r, cz + r);
    return c;
  }
  /* opts.tree: { y0, y1, r } canopy band, so the camera can keep out of trunks and leaves */
  addCircle(cx, cz, r, base, h, opts = {}) {
    const c = { type: 'circle', cx, cz, r, base, top: base + h, stand: !!opts.stand, cam: opts.cam ?? h > 2.2, tree: opts.tree || null, _s: 0 };
    this.list.push(c);
    this._insert(c, cx - r, cz - r, cx + r, cz + r);
    return c;
  }
  /* segment wall/fence as a thin oriented rect */
  addSegment(x1, z1, x2, z2, thick, base, h, opts = {}) {
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const len = Math.hypot(x2 - x1, z2 - z1);
    const rot = Math.atan2(-(z2 - z1), x2 - x1);
    return this.addRect(cx, cz, len / 2, thick / 2, rot, base, h, opts);
  }
  query(x, z, r, out) {
    out.length = 0;
    const s = this.cell;
    this.stamp++;
    for (let ix = Math.floor((x - r) / s); ix <= Math.floor((x + r) / s); ix++) {
      for (let iz = Math.floor((z - r) / s); iz <= Math.floor((z + r) / s); iz++) {
        const arr = this.grid.get(this._key(ix, iz));
        if (!arr) continue;
        for (const c of arr) {
          if (c._s === this.stamp) continue;
          c._s = this.stamp;
          out.push(c);
        }
      }
    }
    return out;
  }
  /*
   * Push a circle (x, z, r) whose feet are at height y out of every collider it overlaps.
   * Colliders whose top is below the feet are ignored (you can hop over them).
   * Returns true if anything was hit.
   */
  resolve(p, y, r) {
    const cand = this.query(p.x, p.z, r + 1, _cand);
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of cand) {
        if (y >= c.top - 0.06) continue;
        if (c.type === 'circle') {
          const dx = p.x - c.cx, dz = p.z - c.cz;
          const d = Math.hypot(dx, dz);
          const min = r + c.r;
          if (d < min) {
            const nx = d > 1e-5 ? dx / d : 1, nz = d > 1e-5 ? dz / d : 0;
            p.x = c.cx + nx * min; p.z = c.cz + nz * min;
            hit = true;
          }
        } else {
          const dx = p.x - c.cx, dz = p.z - c.cz;
          const lx = dx * c.cos - dz * c.sin;
          const lz = dx * c.sin + dz * c.cos;
          const qx = clamp(lx, -c.hw, c.hw), qz = clamp(lz, -c.hd, c.hd);
          let ox = lx - qx, oz = lz - qz;
          const d = Math.hypot(ox, oz);
          let nlx, nlz;
          if (d > 1e-6) {
            if (d >= r) continue;
            const push = r - d;
            nlx = lx + (ox / d) * push; nlz = lz + (oz / d) * push;
          } else {
            const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
            if (px < pz) { nlx = Math.sign(lx || 1) * (c.hw + r); nlz = lz; }
            else { nlx = lx; nlz = Math.sign(lz || 1) * (c.hd + r); }
          }
          p.x = c.cx + nlx * c.cos + nlz * c.sin;
          p.z = c.cz - nlx * c.sin + nlz * c.cos;
          hit = true;
        }
      }
    }
    return hit;
  }
  /* highest standable top under (x, z) that is not above y + step */
  standTop(x, z, y, step = 0.35) {
    const cand = this.query(x, z, 0.5, _cand2);
    let best = -Infinity;
    for (const c of cand) {
      if (!c.stand || c.top > y + step) continue;
      if (c.type === 'circle') {
        if (Math.hypot(x - c.cx, z - c.cz) <= c.r) best = Math.max(best, c.top);
      } else {
        const dx = x - c.cx, dz = z - c.cz;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) <= c.hw && Math.abs(lz) <= c.hd) best = Math.max(best, c.top);
      }
    }
    return best;
  }
  /* shorten a camera boom from (ax, az) to (bx, bz) at height y so it stays outside tall colliders */
  clipSegment(ax, az, bx, bz, y) {
    let tMin = 1;
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(len / 0.4);
    const cand = this.query((ax + bx) / 2, (az + bz) / 2, len / 2 + 1, _cand3);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (const c of cand) {
        if (!c.cam || y > c.top + 0.3 || y < c.base - 1) continue;
        let inside = false;
        if (c.type === 'circle') inside = Math.hypot(x - c.cx, z - c.cz) < c.r + 0.3;
        else {
          const dx = x - c.cx, dz = z - c.cz;
          const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
          inside = Math.abs(lx) < c.hw + 0.3 && Math.abs(lz) < c.hd + 0.3;
        }
        if (inside) { tMin = Math.min(tMin, (i - 1) / steps); break; }
      }
      if (tMin < 1) break;
    }
    return tMin;
  }
  /* how crowded a camera at (x, y, z) is by tree trunks and leaves: 0 when the view is clear */
  treePenalty(x, y, z) {
    const cand = this.query(x, z, 5.5, _cand4);
    let p = 0;
    for (const c of cand) {
      if (!c.tree) continue;
      const d = Math.hypot(x - c.cx, z - c.cz);
      if (d < c.r + 1.4 && y < c.top) p += c.r + 1.4 - d;
      const t = c.tree;
      if (d < t.r && y > t.y0 - 1.0 && y < t.y1) p += 1 + (t.r - d) / t.r;
    }
    return p;
  }
  /* keep a camera point at least r clear of tree trunks */
  clearTrunks(p, y, r) {
    const cand = this.query(p.x, p.z, r + 1, _cand4);
    for (const c of cand) {
      if (!c.tree || y > c.top) continue;
      const dx = p.x - c.cx, dz = p.z - c.cz;
      const d = Math.hypot(dx, dz), min = c.r + r;
      if (d < min && d > 1e-5) { p.x = c.cx + (dx / d) * min; p.z = c.cz + (dz / d) * min; }
    }
    return p;
  }
}
const _cand = [], _cand2 = [], _cand3 = [], _cand4 = [];

export function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

/* distance from point to segment in 2D */
export function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const l2 = vx * vx + vz * vz;
  let t = l2 > 0 ? ((px - ax) * vx + (pz - az) * vz) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

/* Catmull-Rom resample of a polyline (array of [x, z]) */
export function smoothPath(pts, perSeg = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

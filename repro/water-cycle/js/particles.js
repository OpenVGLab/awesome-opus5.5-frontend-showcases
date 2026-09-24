import * as THREE from 'three';
import { TAU, mulberry32, hash2, wrap01, smoothstep, lerp } from './util.js';
import { evapLevel, transpLevel } from './timeline.js';

// Every particle is a pure function of the loop phase: it repeats a whole number of times per
// loop, and whether a given repetition is visible is decided from a hash of its index, so the
// last frame of the loop flows straight into the first.

const POINT_VS = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
  vAlpha = aAlpha;
}`;

const SOFT_FS = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.0, 1.0, r);
  a *= a;
  if (a * vAlpha < 0.003) discard;
  gl_FragColor = vec4(uColor, a * vAlpha);
  #include <colorspace_fragment>
}`;

const MIST_FS = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float r = length((gl_PointCoord - 0.5) * vec2(2.7, 2.0));
  float a = exp(-r * r * 3.5) * (1.0 - smoothstep(0.8, 1.0, r));
  if (a * vAlpha < 0.002) discard;
  gl_FragColor = vec4(uColor, a * vAlpha);
  #include <colorspace_fragment>
}`;

const RING_FS = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 d = (gl_PointCoord - 0.5) * vec2(1.0, 2.6);
  float r = length(d) * 2.0;
  float a = smoothstep(0.5, 0.78, r) * (1.0 - smoothstep(0.8, 1.0, r));
  if (a * vAlpha < 0.003) discard;
  gl_FragColor = vec4(uColor, a * vAlpha);
  #include <colorspace_fragment>
}`;

const LINE_VS = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const LINE_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor, vAlpha * uOpacity);
  #include <colorspace_fragment>
}`;

function pointCloud(n, fs, color, uScale, blending = THREE.NormalBlending) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale, uColor: { value: new THREE.Color(color) } },
    vertexShader: POINT_VS, fragmentShader: fs, transparent: true, depthWrite: false, blending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const dirty = () => {
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  };
  return { pts, pos, size, alpha, dirty, mat };
}

// frac, cycle index and the phase at which that cycle started
function cycle(p, k, s) {
  const t = p * k + s;
  const fl = Math.floor(t);
  return { f: t - fl, n: ((fl % k) + k) % k, n0: (((fl - 1) % k) + k) % k, start: wrap01((fl - s) / k), prevStart: wrap01((fl - 1 - s) / k) };
}

export function createParticles(terrain, clouds, flora, U) {
  const group = new THREE.Group();
  const rng = mulberry32(101);

  // ---- evaporation over the sea
  const EV = 460;
  const evap = [];
  while (evap.length < EV) {
    const x = lerp(-9.7, -2.2, rng()), z = lerp(-5.7, 5.7, rng());
    if (terrain.heightAt(x, z) > -0.35) continue;
    evap.push({ x, z, s: rng(), k: 3 + Math.floor(rng() * 3), rise: 2.8 + rng() * 1.8, w: rng(), size: 0.45 + rng() * 0.4 });
  }
  const ev = pointCloud(EV, MIST_FS, '#f2faff', U.uScale);
  ev.pts.renderOrder = 5;
  group.add(ev.pts);

  // ---- transpiration from the trees
  const canopies = flora.canopies.filter((_, i) => i % 2 === 0);
  const TR = Math.min(canopies.length * 2, 240);
  const transp = [];
  for (let i = 0; i < TR; i++) {
    const c = canopies[i % canopies.length];
    transp.push({ x: c.x + (rng() - 0.5) * 0.15, y: c.y, z: c.z + (rng() - 0.5) * 0.15, s: rng(), k: 5 + Math.floor(rng() * 3), rise: 0.9 + rng() * 0.8, w: rng() });
  }
  const tr = pointCloud(Math.max(TR, 1), MIST_FS, '#ecfff3', U.uScale);
  tr.pts.renderOrder = 5;
  group.add(tr.pts);

  // ---- rain (and splashes) from the three storm clouds, snow over the peak
  const rainClouds = clouds.defs.map((d, i) => (d.rain ? i : -1)).filter((i) => i >= 0);
  const PER = 540;
  const drops = [];
  for (const ci of rainClouds) {
    for (let j = 0; j < PER; j++) {
      const a = rng() * TAU, r = Math.sqrt(rng());
      drops.push({ ci, ox: Math.cos(a) * r * 1.55, oz: Math.sin(a) * r * 0.75, s: rng(), k: 30 + (j % 3), id: j + ci * 7919 });
    }
  }
  const ND = drops.length;
  const lineGeo = new THREE.BufferGeometry();
  const lpos = new Float32Array(ND * 6), lalpha = new Float32Array(ND * 2);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeo.setAttribute('aAlpha', new THREE.BufferAttribute(lalpha, 1).setUsage(THREE.DynamicDrawUsage));
  const lineMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#d5e6ff') }, uOpacity: { value: 0.75 } },
    vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: false,
  });
  const rainLines = new THREE.LineSegments(lineGeo, lineMat);
  rainLines.frustumCulled = false;
  rainLines.renderOrder = 6;
  group.add(rainLines);
  const sp = pointCloud(ND, RING_FS, '#e4f0ff', U.uScale);
  sp.pts.renderOrder = 6;
  group.add(sp.pts);

  const snowCloud = clouds.defs.findIndex((d) => d.snow);
  const NS = 520;
  const flakes = [];
  for (let j = 0; j < NS; j++) {
    const a = rng() * TAU, r = Math.sqrt(rng());
    flakes.push({ ox: Math.cos(a) * r * 1.7, oz: Math.sin(a) * r * 0.85, s: rng(), k: 9 + (j % 2), w: rng(), id: j });
  }
  const sn = pointCloud(NS, SOFT_FS, '#ffffff', U.uScale);
  sn.pts.renderOrder = 6;
  group.add(sn.pts);

  const st = {};
  function update(p, env) {
    // evaporation: wisps lift off the water, drift inland on the breeze and fade as they cool
    for (let i = 0; i < EV; i++) {
      const d = evap[i];
      const c = cycle(p, d.k, d.s);
      const vis = hash2(i, c.n) < evapLevel(c.start) ? 1 : 0;
      const f = c.f;
      ev.pos[i * 3] = d.x + 1.1 * f * f + 0.16 * Math.sin(TAU * (f * 1.5 + d.w));
      ev.pos[i * 3 + 1] = 0.06 + d.rise * f;
      ev.pos[i * 3 + 2] = d.z + 0.16 * Math.cos(TAU * (f * 1.2 + d.w));
      ev.size[i] = d.size * (1 + 1.8 * f);
      ev.alpha[i] = vis * 0.17 * smoothstep(0.06, 0.32, f) * (1 - smoothstep(0.55, 1, f));
    }
    ev.dirty();

    for (let i = 0; i < TR; i++) {
      const d = transp[i];
      const c = cycle(p, d.k, d.s);
      const vis = hash2(i + 5000, c.n) < transpLevel(c.start) ? 1 : 0;
      const f = c.f;
      tr.pos[i * 3] = d.x + 0.3 * f + 0.06 * Math.sin(TAU * (f * 2 + d.w));
      tr.pos[i * 3 + 1] = d.y + d.rise * f;
      tr.pos[i * 3 + 2] = d.z + 0.06 * Math.cos(TAU * (f * 1.7 + d.w));
      tr.size[i] = 0.24 * (1 + 1.5 * f);
      tr.alpha[i] = vis * 0.2 * smoothstep(0, 0.15, f) * (1 - smoothstep(0.5, 1, f));
    }
    tr.dirty();

    const cs = clouds.defs.map((_, i) => clouds.stateAt(i, p, st[i] || (st[i] = {})));
    for (let i = 0; i < ND; i++) {
      const d = drops[i];
      const c = cs[d.ci];
      const cy = cycle(p, d.k, d.s);
      const vis = hash2(d.id, cy.n) < clouds.rainAt(d.ci, cy.start) ? 1 : 0;
      const x0 = c.x + d.ox * c.size, z = c.z + d.oz * c.size;
      const top = c.base;
      const x = x0 + 0.3 * cy.f;
      const gh = terrain.heightAt(x, z);
      const ground = Math.max(gh, 0);
      const y = top - (top - ground) * cy.f;
      const isSnow = d.ci === snowCloud && gh > 3.6;
      const a = vis && !isSnow ? 1 : 0;
      lpos.set([x, y, z, x - 0.03, y + 0.32, z], i * 6);
      lalpha[i * 2] = a;
      lalpha[i * 2 + 1] = 0;
      // splash from the previous drop in this slot
      const visPrev = hash2(d.id, cy.n0) < clouds.rainAt(d.ci, cy.prevStart);
      const xl = x0 + 0.3;
      const gl = terrain.heightAt(xl, z);
      const sf = cy.f / 0.14;
      sp.pos[i * 3] = xl;
      sp.pos[i * 3 + 1] = Math.max(gl, 0) + 0.02;
      sp.pos[i * 3 + 2] = z;
      sp.size[i] = 0.05 + 0.2 * sf;
      sp.alpha[i] = visPrev && sf < 1 && !(d.ci === snowCloud && gl > 3.6) ? 0.7 * (1 - sf) : 0;
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.aAlpha.needsUpdate = true;
    sp.dirty();

    if (snowCloud >= 0) {
      const c = cs[snowCloud];
      for (let i = 0; i < NS; i++) {
        const d = flakes[i];
        const cy = cycle(p, d.k, d.s);
        const vis = hash2(d.id + 20000, cy.n) < clouds.rainAt(snowCloud, cy.start) ? 1 : 0;
        const x = c.x + d.ox * c.size + 0.22 * Math.sin(TAU * (cy.f * 2 + d.w)) + 0.2 * cy.f;
        const z = c.z + d.oz * c.size + 0.16 * Math.cos(TAU * (cy.f * 1.6 + d.w));
        const gh = terrain.heightAt(x, z);
        const y = c.base - (c.base - gh) * cy.f;
        sn.pos[i * 3] = x; sn.pos[i * 3 + 1] = y; sn.pos[i * 3 + 2] = z;
        sn.size[i] = 0.085;
        sn.alpha[i] = vis * (gh > 3.3 ? 0.95 : 0) * smoothstep(0, 0.05, cy.f) * (1 - smoothstep(0.93, 1, cy.f));
      }
      sn.dirty();
    }
  }

  return { group, update };
}

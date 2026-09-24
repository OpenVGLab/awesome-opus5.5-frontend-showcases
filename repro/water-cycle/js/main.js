import * as THREE from 'three';
import { Terrain, X0, X1, Z0, Z1, BOTTOM, PEAK } from './terrain.js';
import { createFlora } from './flora.js';
import { createWater } from './water.js';
import { createClouds } from './clouds.js';
import { createSky } from './sky.js';
import { createParticles } from './particles.js';
import { createJourney } from './journey.js';
import { createLife } from './life.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { LOOP_SECONDS, STAGES, envelopes } from './timeline.js';
import { loopScroll } from './glsl.js';
import { TAU, clamp, wrap01, win } from './util.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400);

// Shared uniforms: every shader reads the same loop phase uP in [0, 1).
const U = {
  uP: { value: 0 }, uAmp: { value: 1 }, uSun: { value: 1 }, uFlash: { value: 0 }, uScale: { value: 400 },
  uSunDir: { value: new THREE.Vector3(-0.55, 0.72, 0.42).normalize() },
  uSkyH: { value: new THREE.Color() }, uSkyT: { value: new THREE.Color() },
  uSnowLine: { value: 5 }, uWet: { value: 0 },
  uGWOff: { value: 0 }, uGW: { value: 0.3 }, uInfOff: { value: 0 }, uInf: { value: 0 },
};

const HEMI_CLEAR = new THREE.Color('#d8edff'), HEMI_STORM = new THREE.Color('#b9c4cf');
const hemi = new THREE.HemisphereLight(HEMI_CLEAR, '#8b7a63', 1.2);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight('#fff0d6', 2.6);
sunLight.position.copy(U.uSunDir.value).multiplyScalar(30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 5, far: 70 });
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.03;
sunLight.shadow.radius = 4;
sunLight.shadow.intensity = 0.6;
scene.add(sunLight, sunLight.target);

const terrain = new Terrain();
scene.add(terrain.buildMesh(U), terrain.buildWalls(U));
const flora = createFlora(terrain);
scene.add(flora.group);
const water = createWater(terrain, U);
scene.add(water.group);
const clouds = createClouds(terrain.heroStream.pts[0]);
scene.add(clouds.mesh);
const sky = createSky(U);
scene.add(sky.group);
sky.buildBolts(clouds, terrain);
const particles = createParticles(terrain, clouds, flora, U);
scene.add(particles.group);
const journey = createJourney(terrain, clouds, U);
scene.add(journey.object);
const life = createLife(terrain);
scene.add(life.group);

// ---------------------------------------------------------------- camera
const base = { target: new THREE.Vector3(0.6, 1.2, 0), az: -0.36, el: 0.40, dist: 36 };
const user = { az: 0, el: 0, zoom: 1, tAz: 0, tEl: 0, tZoom: 1 };

function placeCamera(az, el, dist) {
  const t = base.target;
  camera.position.set(
    t.x + dist * Math.sin(az) * Math.cos(el),
    t.y + dist * Math.sin(el),
    t.z + dist * Math.cos(az) * Math.cos(el),
  );
  camera.lookAt(t);
  camera.updateMatrixWorld();
}

const framePts = [];
for (const x of [X0, X1]) for (const z of [Z0, Z1]) for (const y of [BOTTOM, 0.8]) framePts.push(new THREE.Vector3(x, y, z));
framePts.push(new THREE.Vector3(PEAK.x, 6.6, PEAK.z), new THREE.Vector3(-5.4, 7.0, 1.0), new THREE.Vector3(6.9, 9.7, -2.3), new THREE.Vector3(-3.6, 7.6, -2.7));

const narrowQuery = window.matchMedia('(max-aspect-ratio: 5/4)');
function safeArea(w, h) {
  const panel = document.getElementById('panel');
  const hidden = document.body.classList.contains('clean');
  if (hidden) return { x0: -0.9, x1: 0.9, y0: -0.86, y1: 0.9 };
  const r = panel.getBoundingClientRect();
  if (narrowQuery.matches) return { x0: -0.96, x1: 0.96, y0: 1 - (2 * (r.top - 10)) / h, y1: 0.7 };
  return { x0: -1 + (2 * (r.right + w * 0.02)) / w, x1: 0.97, y0: -0.93, y1: 0.95 };
}

function projectedBox() {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  const v = new THREE.Vector3();
  for (const p of framePts) {
    v.copy(p).project(camera);
    b.x0 = Math.min(b.x0, v.x); b.x1 = Math.max(b.x1, v.x);
    b.y0 = Math.min(b.y0, v.y); b.y1 = Math.max(b.y1, v.y);
  }
  return b;
}

const lerpSafe = (s, t) => s.x0 + (s.x1 - s.x0) * t;

function fitCamera(w, h) {
  camera.aspect = w / h;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  const safe = safeArea(w, h);
  let lo = 8, hi = 200;
  for (let it = 0; it < 32; it++) {
    const mid = (lo + hi) / 2;
    placeCamera(base.az, base.el, mid);
    const b = projectedBox();
    if (b.x1 - b.x0 <= safe.x1 - safe.x0 && b.y1 - b.y0 <= safe.y1 - safe.y0) hi = mid; else lo = mid;
  }
  base.dist = hi;
  placeCamera(base.az, base.el, hi);
  const b = projectedBox();
  const dx = (safe.x0 + safe.x1) / 2 - (b.x0 + b.x1) / 2;
  const dy = (safe.y0 + safe.y1) / 2 - (b.y0 + b.y1) / 2;
  camera.setViewOffset(w, h, -dx * w / 2, dy * h / 2, w, h);
  camera.updateProjectionMatrix();
  U.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  sky.placeSun(camera, lerpSafe(safe, 0.3), narrowQuery.matches ? 0.55 : 0.76, 95);
  sky.placeRainbow(new THREE.Vector3(3.4, -1.4, -8.6), base.az);
}

function updateCamera(p) {
  const az = base.az + 0.07 * Math.sin(TAU * p) + user.az;
  const el = base.el + 0.025 * Math.sin(TAU * 2 * p + 0.8) + user.el;
  const dist = base.dist * user.zoom * (1 + 0.012 * Math.sin(TAU * p + 1.9));
  placeCamera(az, el, dist);
}

// ---------------------------------------------------------------- labels
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const R = terrain.river;
const rk = Math.floor(R.N * 0.64);
const treeSpot = flora.canopies.reduce((best, c) => (Math.abs(c.x + 0.5) + Math.abs(c.z + 1.5) < Math.abs(best.x + 0.5) + Math.abs(best.z + 1.5) ? c : best), flora.canopies[0] || { x: 0, y: 1, z: -1.5 });
const cloudState = {};
const LABELS = [
  { text: 'Evaporation', color: '#ffc46b', anchor: V(-6.9, 2.5, 1.9), active: (p) => win(p, 0.9, 0.42, 0.04, 0.06) },
  { text: 'Transpiration', color: '#a6e57f', anchor: V(treeSpot.x, treeSpot.y + 0.9, treeSpot.z), active: (p) => win(p, 0.93, 0.38, 0.04, 0.06) },
  {
    text: 'Condensation', color: '#e8f1fa', active: (p) => win(p, 0.2, 0.5, 0.04, 0.05),
    anchor: (p, out) => { const s = clouds.stateAt(0, p, cloudState); return out.set(s.x, s.y + 1.25 * s.size, s.z); },
  },
  {
    text: 'Precipitation', color: '#79b8ff', active: (p) => win(p, 0.49, 0.72, 0.03, 0.05),
    anchor: (p, out) => { const s = clouds.stateAt(2, p, cloudState); return out.set(s.x - 1.75, s.base - 1.6, s.z + 0.4); },
  },
  {
    text: 'Snowfall', color: '#ffffff', active: (p) => win(p, 0.51, 0.70, 0.03, 0.05),
    anchor: (p, out) => { const s = clouds.stateAt(1, p, cloudState); return out.set(s.x + 0.6, s.base - 0.5, s.z + 0.4); },
  },
  { text: 'Surface runoff', color: '#4fd6c4', anchor: V(R.px[rk], R.y[rk] + 0.1, R.pz[rk]), active: (p) => win(p, 0.57, 0.93, 0.03, 0.05) },
  { text: 'Infiltration', color: '#8fd3ff', anchor: V(1.9, -0.3, Z1), active: (p) => win(p, 0.57, 0.90, 0.03, 0.05) },
  { text: 'Groundwater flow', color: '#5fb6ff', anchor: V(-1.3, -1.45, Z1), active: (p) => win(p, 0.63, 0.12, 0.04, 0.06) },
  { text: 'Snowmelt', color: '#dff6ff', anchor: V(PEAK.x - 0.6, 4.4, PEAK.z + 1.0), active: (p) => win(p, 0.80, 0.26, 0.04, 0.06) },
  { text: 'Collection', color: '#4fd6c4', anchor: V(-5.2, 0.2, 4.3), active: (p) => win(p, 0.73, 0.99, 0.03, 0.03) },
];

// ---------------------------------------------------------------- clock
const params = new URLSearchParams(location.search);
const clock = {
  anchorPhase: wrap01(parseFloat(params.get('p')) || 0),
  anchorTime: performance.now(),
  paused: params.has('paused'),
  speed: clamp(parseFloat(params.get('speed')) || 1, 0.1, 8),
};
const phaseNow = (now = performance.now()) => (clock.paused
  ? clock.anchorPhase
  : wrap01(clock.anchorPhase + ((now - clock.anchorTime) / 1000) * clock.speed / LOOP_SECONDS));
function setPhase(p) { clock.anchorPhase = wrap01(p); clock.anchorTime = performance.now(); }
function pause() { if (!clock.paused) { clock.anchorPhase = phaseNow(); clock.paused = true; ui.setPlaying(false); } }
function play() { if (clock.paused) { clock.anchorTime = performance.now(); clock.paused = false; ui.setPlaying(true); } }
const togglePlay = () => (clock.paused ? play() : pause());

const audio = createAudio();
const ui = createUI({
  labels: LABELS,
  onJump: (i) => setPhase(STAGES[i].start + 0.004),
  onPhase: setPhase,
  onPlay: togglePlay,
  onLabels: () => ui.setLabels(!ui.labelsOn),
  onSound: () => { audio.setEnabled(!audio.enabled); ui.setSound(audio.enabled); },
});
ui.setPlaying(!clock.paused);
if (params.get('labels') === '0') ui.setLabels(false);
if (params.get('ui') === '0') document.body.classList.add('clean');
document.getElementById('stageText').textContent = STAGES[0].text;

// ---------------------------------------------------------------- render
let lastEnv = envelopes(0);
function renderAt(p) {
  const env = envelopes(p);
  U.uP.value = p;
  U.uAmp.value = 1 + 1.2 * env.storm;
  U.uSun.value = env.sun;
  U.uFlash.value = env.flash;
  U.uSnowLine.value = 5.05 - 0.95 * env.snow;
  U.uWet.value = env.wet;
  U.uGW.value = env.ground;
  U.uGWOff.value = loopScroll(p, 8, 1.25, 3, 0.75);
  U.uInf.value = env.infil;
  U.uInfOff.value = loopScroll(p, 20, 0.55, 0, 0);
  sunLight.intensity = 2.7 * (0.3 + 0.7 * env.sun);
  hemi.intensity = 1.15 + 0.25 * env.storm + 2.4 * env.flash;
  hemi.color.copy(HEMI_CLEAR).lerp(HEMI_STORM, env.storm);
  clouds.update(p, env);
  flora.update(p, env);
  water.update(p, env);
  particles.update(p, env);
  journey.update(p);
  life.update(p, env);
  updateCamera(p);
  sky.update(p, env, camera);
  renderer.render(scene, camera);
  lastEnv = env;
  return env;
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  fitCamera(w, h);
}
window.addEventListener('resize', resize);
resize();

let lastNow = performance.now();
let first = true;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - lastNow) / 1000);
  lastNow = now;
  const k = 1 - Math.exp(-dt * 7);
  user.az += (user.tAz - user.az) * k;
  user.el += (user.tEl - user.el) * k;
  user.zoom += (user.tZoom - user.zoom) * k;
  const p = phaseNow(now);
  const env = renderAt(p);
  ui.update(p, camera, window.innerWidth, window.innerHeight);
  audio.update(p, env);
  if (first) { first = false; canvas.classList.add('ready'); document.body.classList.add('ready'); }
});

// ---------------------------------------------------------------- input
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, az: user.tAz, el: user.tEl };
  try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer not tracked by the browser */ }
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  user.tAz = clamp(drag.az - (e.clientX - drag.x) * 0.005, -0.9, 0.9);
  user.tEl = clamp(drag.el + (e.clientY - drag.y) * 0.004, -0.3, 0.5);
});
const endDrag = () => { drag = null; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  user.tZoom = clamp(user.tZoom * Math.exp(e.deltaY * 0.001), 0.55, 1.5);
}, { passive: false });
const resetView = () => { user.tAz = 0; user.tEl = 0; user.tZoom = 1; };
canvas.addEventListener('dblclick', resetView);

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
  const step = 1 / 64;
  switch (e.code) {
    case 'Space': e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': setPhase(phaseNow() + step); break;
    case 'ArrowLeft': setPhase(phaseNow() - step); break;
    case 'KeyL': ui.setLabels(!ui.labelsOn); break;
    case 'KeyM': audio.setEnabled(!audio.enabled); ui.setSound(audio.enabled); break;
    case 'KeyH': document.body.classList.toggle('clean'); resize(); break;
    case 'KeyR': resetView(); break;
    default:
      if (/^Digit[1-4]$/.test(e.code)) setPhase(STAGES[Number(e.code.slice(5)) - 1].start + 0.004);
  }
});

// ---------------------------------------------------------------- test hooks
const probe = document.createElement('canvas');
probe.width = 240; probe.height = 135;
const pctx = probe.getContext('2d', { willReadFrequently: true });
function grab(p) {
  renderAt(wrap01(p));
  pctx.drawImage(renderer.domElement, 0, 0, probe.width, probe.height);
  return pctx.getImageData(0, 0, probe.width, probe.height).data;
}
function diff(a, b) {
  const A = grab(a), B = grab(b);
  let s = 0;
  for (let i = 0; i < A.length; i += 4) s += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
  return +(s / ((A.length / 4) * 3)).toFixed(4);
}

window.WaterCycle = {
  get phase() { return phaseNow(); },
  get paused() { return clock.paused; },
  get env() { return lastEnv; },
  get view() { return { az: user.az, el: user.el, zoom: user.zoom }; },
  setPhase, pause, play,
  frame: (p) => { pause(); setPhase(p); renderAt(wrap01(p)); ui.update(wrap01(p), camera, window.innerWidth, window.innerHeight); },
  diff,
  // mean per-channel difference (0-255) across the loop point vs. an ordinary step of the same length
  seamCheck(n = 480) {
    const was = clock.paused; pause();
    const res = { acrossLoopPoint: diff(1 - 1 / n, 0), ordinaryStep: diff(0, 1 / n), midLoopStep: diff(0.5, 0.5 + 1 / n), identity: diff(0.3, 1.3) };
    if (!was) play();
    return res;
  },
  info: () => ({ streams: terrain.streams.length, heroStream: terrain.heroStream.pts.length, trees: flora.trees.length, houses: flora.houses.length, lake: terrain.lake.level }),
};

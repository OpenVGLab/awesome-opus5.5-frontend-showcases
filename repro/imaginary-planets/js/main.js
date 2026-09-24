import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLANETS, EARTH_REF, METRICS } from './data.js';
import { Planet, createStar, createStarfield, bakeSky, createOrbitLine, damp } from './world.js';
import { AudioEngine } from './audio.js';
import * as UI from './ui.js';
import { Forge } from './forge.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const Y = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;
const STORE_KEY = 'atlas-of-imaginary-planets:worlds';
const CUSTOM_SLOTS = [85, 94, 103, 112, 121, 130];
const HOME_ACCENT = '#e9c47e';
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const narrow = () => innerWidth < 820;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// ---------------------------------------------------------------- renderer & scene

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  UI.loader('This atlas needs WebGL, which your browser could not provide.', 0);
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('#stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 9000);
camera.position.set(40, 360, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.9;
controls.enabled = false;

const shared = {
  uTime: { value: 0 }, uScan: { value: 0 }, uScanMix: { value: 0 }, uEnv: { value: null },
  uPixelRatio: { value: renderer.getPixelRatio() },
};
const audio = new AudioEngine();

const state = {
  mode: 'loading', focus: null, hover: null, poi: -1,
  timeScale: 1, orbitRate: 1, simTime: 0, spinRate: 1,
  compareT: 0, compareEase: 0, metric: 'radius', lineupWidth: 60,
  scan: 0, layers: { clouds: true, atmo: true, markers: true, spin: true },
  viewOffX: 0, viewOffY: 0, weight: 70, age: 30,
};
const ctx = { starPos: new THREE.Vector3(), compareLight: new THREE.Vector3(-0.55, 0.3, 0.78).normalize() };
let planets = [];
let earth = null, star = null, starfield = null, forge = null;
let tween = null;

// ---------------------------------------------------------------- planets

function addPlanet(def) {
  const p = new Planet(def, shared);
  scene.add(p.group);
  const tint = new THREE.Color(def.accent).lerp(new THREE.Color('#9fb0d0'), def.custom ? 0.25 : 0.55);
  p.orbitLine = createOrbitLine(def.orbit.r, def.orbit.incl, tint, !!def.custom);
  p.orbitLine.material.opacity = 0;
  scene.add(p.orbitLine);
  planets.push(p);
  applyLayersTo(p);
  return p;
}

function validDef(d) {
  return d && typeof d === 'object' && d.params && d.stats && d.orbit && typeof d.name === 'string' &&
    ['terran', 'gas', 'ice', 'lava', 'crystal', 'glow', 'eyeball'].includes(d.type) && ['sphere', 'torus'].includes(d.shape);
}
function loadCustom() {
  try {
    const a = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(a) ? a.filter(validDef).slice(0, CUSTOM_SLOTS.length) : [];
  } catch (e) { return []; }
}
function storeCustom() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(planets.filter((p) => p.def.custom).map((p) => p.def))); } catch (e) { /* private mode */ }
}

function saveCustom(def) {
  const used = planets.filter((p) => p.def.custom).map((p) => p.def.orbit.r);
  const slot = CUSTOM_SLOTS.find((r) => !used.includes(r));
  if (!slot) { UI.toast('The atlas has room for six forged worlds — remove one first.'); return; }
  def.id = 'custom-' + Date.now().toString(36);
  def.orbit = { r: slot, phase: Math.random() * Math.PI * 2, incl: (Math.random() - 0.5) * 0.06 };
  const p = addPlanet(def);
  refreshLists();
  storeCustom();
  updateWorld(0);
  UI.setThumb(p, makeThumb(p));
  UI.toast(`${def.name} has joined the Vesper system.`, { label: 'Visit', run: () => goPlanet(p) });
}

function removeCustom(p) {
  scene.remove(p.group);
  scene.remove(p.orbitLine);
  p.dispose();
  p.orbitLine.geometry.dispose();
  p.orbitLine.material.dispose();
  planets = planets.filter((q) => q !== p);
  storeCustom();
  refreshLists();
  UI.toast(`${p.def.name} was removed from the atlas.`);
  goSystem();
}

function refreshLists() {
  const hover = { enter: (p) => { if (state.mode === 'system' || state.mode === 'compare') setHover(p); }, leave: () => setHover(null), click: (p) => { if (p !== earth) goPlanet(p); } };
  UI.renderDock(planets, hover);
  UI.renderLabels([...planets, earth], hover);
  if (state.mode === 'compare') layoutLineup();
}

// Thumbnails are real renders of each planet, copied out of the main canvas.
function makeThumb(p, size = 160) {
  const dpr = renderer.getPixelRatio();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 2000);
  const pos = p.group.position;
  const toSun = ctx.starPos.clone().sub(pos).setY(0).normalize();
  const dir = toSun.applyAxisAngle(Y, (p.def.locked ? 70 : 40) * DEG);
  dir.y = p.isTorus ? 0.75 : 0.22;
  dir.normalize();
  const bound = p.scale * (p.def.rings ? p.def.rings.outer * 0.92 : p.isTorus ? 1.36 : 1);
  cam.position.copy(pos).addScaledVector(dir, bound / Math.sin(15 * DEG) * 1.02);
  cam.lookAt(pos);
  cam.layers.set(1);
  const vis = [...planets, earth].map((q) => q.group.visible);
  [...planets, earth].forEach((q) => { q.group.visible = q === p; });
  const bg = scene.background;
  scene.background = null;
  renderer.setClearColor(0x000000, 1);
  renderer.setScissorTest(true);
  renderer.setViewport(0, 0, size, size);
  renderer.setScissor(0, 0, size, size);
  renderer.render(scene, cam);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  c.getContext('2d').drawImage(renderer.domElement, 0, renderer.domElement.height - c.height, c.width, c.height, 0, 0, c.width, c.height);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  scene.background = bg;
  [...planets, earth].forEach((q, i) => { q.group.visible = vis[i]; });
  return c.toDataURL('image/png');
}

// ---------------------------------------------------------------- camera flights

const _s0 = new THREE.Spherical(), _s1 = new THREE.Spherical(), _o = new THREE.Vector3();
function flyTo(getTarget, getPos, { duration = 2.4, zoomOut = 0, onDone } = {}) {
  const t0 = controls.target.clone();
  _s0.setFromVector3(_o.copy(camera.position).sub(t0));
  const s0 = _s0.clone();
  controls.enabled = false;
  const start = performance.now();
  tween = {
    update(now) {
      const u = Math.min(1, (now - start) / (duration * 1000));
      const e = easeInOut(u);
      const t1 = getTarget().clone(), p1 = getPos();
      _s1.setFromVector3(_o.copy(p1).sub(t1));
      let dTheta = _s1.theta - s0.theta;
      dTheta = ((dTheta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      const theta = s0.theta + dTheta * e;
      const phi = s0.phi + (_s1.phi - s0.phi) * e;
      const r = Math.exp(Math.log(s0.radius) + (Math.log(_s1.radius) - Math.log(s0.radius)) * e) * (1 + zoomOut * Math.sin(Math.PI * e));
      const tgt = t0.clone().lerp(t1, e);
      camera.position.setFromSpherical(_s1.set(r, phi, theta)).add(tgt);
      controls.target.copy(tgt);
      camera.lookAt(tgt);
      if (u >= 1) {
        tween = null;
        if (state.mode !== 'forge') controls.enabled = true;
        if (onDone) onDone();
      }
    },
  };
}

function systemView() {
  const aspect = innerWidth / innerHeight;
  const d = 178 * Math.max(1, 1.55 / aspect);
  return { target: new THREE.Vector3(0, -4, 0), pos: new THREE.Vector3(d * 0.06, d * 0.45, d * 0.89) };
}

function cameraPosFor(p) {
  const pos = p.group.position;
  const toSun = ctx.starPos.clone().sub(pos).setY(0);
  if (toSun.lengthSq() < 1e-6) toSun.set(1, 0, 0);
  toSun.normalize();
  const v = p.def.view || { az: 45, el: 14 };
  const dir = toSun.applyAxisAngle(Y, v.az * DEG);
  dir.y = Math.tan(v.el * DEG);
  dir.normalize();
  return pos.clone().addScaledVector(dir, p.viewDistance());
}

// ---------------------------------------------------------------- modes

function setMode(m) {
  state.mode = m;
  document.body.dataset.mode = m;
  $$('.nav [data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === (m === 'planet' ? 'system' : m)));
  if (m !== 'planet') { setScan(0); closePOI(); }
  if (m !== 'system' && m !== 'compare') setHover(null);
  if (m !== 'compare') {
    for (const p of planets) {
      if (p.labelSub) p.labelSub.textContent = p.def.custom ? '✦ your world' : p.def.cls;
      p.labelW = 0;
    }
  }
}

function goSystem(opts = {}) {
  if (state.mode === 'forge') { leaveForge(() => goSystem(opts)); return; }
  const from = state.mode;
  setMode('system');
  state.focus = null;
  UI.setAccent(HOME_ACCENT);
  const v = systemView();
  controls.minDistance = 0.01; controls.maxDistance = Infinity;
  flyTo(() => v.target, () => v.pos, {
    duration: opts.duration ?? (from === 'planet' ? 2.8 : from === 'loading' ? 3.8 : 2.4),
    onDone: () => { controls.minDistance = 30; controls.maxDistance = 380; },
  });
  audio.play('space');
  if (from === 'planet') audio.sfx('whoosh');
  pushRoute('');
}

function goPlanet(p, opts = {}) {
  if (!p) return;
  if (state.mode === 'forge') { leaveForge(() => goPlanet(p, opts)); return; }
  if (state.mode === 'planet' && state.focus === p && !opts.force) return;
  const from = state.mode, prev = state.focus;
  setMode('planet');
  state.focus = p;
  UI.setAccent(p.def.accent);
  renderPanelFor(p);
  UI.renderMarkers(p, { poi: focusPOI });
  controls.minDistance = 0.01; controls.maxDistance = Infinity;
  const hop = from === 'planet' && prev ? prev.group.position.distanceTo(p.group.position) : 0;
  const zoomOut = hop ? Math.min(5, Math.max(0.6, hop / (prev.viewDistance() + p.viewDistance()))) : 0;
  flyTo(() => p.group.position, () => cameraPosFor(p), {
    duration: from === 'planet' ? 2.7 : 3.0, zoomOut,
    onDone: () => { controls.minDistance = p.bodyRadius() * 1.22; controls.maxDistance = p.viewDistance() * 2.8; },
  });
  audio.play(p.def.sound);
  audio.sfx('whoosh');
  pushRoute(p.def.id);
}

function stepPlanet(d) {
  const i = planets.indexOf(state.focus);
  goPlanet(planets[(i + d + planets.length) % planets.length]);
}

function goCompare() {
  if (state.mode === 'forge') { leaveForge(goCompare); return; }
  setMode('compare');
  state.focus = null;
  UI.setAccent(HOME_ACCENT);
  layoutLineup();
  const v = compareView();
  controls.minDistance = 0.01; controls.maxDistance = Infinity;
  flyTo(() => v.target, () => v.pos, { duration: 2.6, onDone: () => { controls.minDistance = 6; controls.maxDistance = v.dist * 2.2; } });
  audio.play('space');
  pushRoute('compare');
}

function layoutLineup() {
  const m = METRICS.find((x) => x.id === state.metric);
  const list = [...planets, earth].sort((a, b) => a.def.stats[m.id] - b.def.stats[m.id]);
  const gap = 1.7;
  const widths = list.map((p) => p.footprint(p.trueScale));
  const total = widths.reduce((s, w) => s + 2 * w, 0) + gap * (list.length - 1);
  let x = -total / 2;
  list.forEach((p, i) => {
    p.lineupTarget.set(x + widths[i], 0, 0);
    x += 2 * widths[i] + gap;
    if (p.labelSub) p.labelSub.textContent = m.fmt(p.def.stats);
    p.labelW = 0;
  });
  state.lineupWidth = total;
}

function compareView() {
  const aspect = innerWidth / innerHeight;
  const half = state.lineupWidth / 2 + 2.5;
  const dist = half / (Math.tan((camera.fov * DEG) / 2) * aspect);
  return { target: new THREE.Vector3(0, 2.6, 0), pos: new THREE.Vector3(0, dist * 0.14 + 2.6, dist), dist };
}

function fadeThrough(mid) {
  const f = $('#fade');
  f.classList.add('on');
  setTimeout(() => { mid(); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }, 480);
}

function goForge() {
  if (state.mode === 'forge') return;
  fadeThrough(() => {
    tween = null;
    controls.enabled = false;
    setMode('forge');
    forge.enter();
    pushRoute('forge');
  });
}

function leaveForge(then) {
  fadeThrough(() => {
    forge.exit();
    state.mode = 'transit';
    then();
  });
}

// ---------------------------------------------------------------- planet view details

function renderPanelFor(p) {
  const i = planets.indexOf(p);
  const prev = planets[(i - 1 + planets.length) % planets.length], next = planets[(i + 1) % planets.length];
  UI.renderPanel(p, {
    index: i, total: PLANETS.length, prevName: prev.def.name, nextName: next.def.name,
    weight: state.weight, age: state.age, listening: audio.on,
  }, {
    poi: focusPOI,
    listen: () => toggleSound(),
    reset: () => { closePOI(); flyTo(() => p.group.position, () => cameraPosFor(p), { duration: 1.6 }); },
    prev: () => stepPlanet(-1),
    next: () => stepPlanet(1),
    calc: (w, a) => { state.weight = w; state.age = a; },
    edit: () => { forge.load(p.def); goForge(); },
    remove: () => removeCustom(p),
  });
}

const _P = new THREE.Vector3(), _N = new THREE.Vector3(), _V = new THREE.Vector3();
function focusPOI(i) {
  const p = state.focus;
  if (!p || !p.def.pois || !p.def.pois[i]) return;
  state.poi = i;
  UI.setPoiActive(i);
  UI.showPoi(p.def.pois[i], i, { close: () => closePOI() });
  const dist = p.viewDistance() * 0.8;
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  flyTo(() => p.group.position, () => { p.poi(i, P, N); return p.group.position.clone().addScaledVector(N, dist); }, { duration: 1.9 });
  audio.sfx('click');
}

function closePOI() {
  state.poi = -1;
  UI.hidePoi();
  UI.setPoiActive(-1);
}

function setScan(n) {
  state.scan = n;
  if (n > 0) shared.uScan.value = n;
  $$('[data-scan]').forEach((b) => b.classList.toggle('on', +b.dataset.scan === n));
  const lg = $('#scanLegend');
  lg.classList.toggle('show', n > 0);
  lg.classList.toggle('elev', n === 2);
  lg.querySelector('.lo').textContent = n === 2 ? 'low' : 'cold';
  lg.querySelector('.hi').textContent = n === 2 ? 'high' : 'hot';
}

function applyLayersTo(p) {
  if (p.clouds) p.clouds.visible = state.layers.clouds;
  if (p.atmo) p.atmo.visible = state.layers.atmo;
  p.u.uAtmoStr.value = state.layers.atmo ? (p.def.params.atmoStr ?? 0) : 0;
}
function applyLayers() {
  planets.forEach(applyLayersTo);
  document.body.classList.toggle('no-markers', !state.layers.markers);
  $$('[data-layer]').forEach((b) => b.classList.toggle('on', !!state.layers[b.dataset.layer]));
}

// ---------------------------------------------------------------- hover & picking

const _sc = { x: 0, y: 0, behind: false }, _pp = new THREE.Vector3();
function toScreen(v, out) {
  _pp.copy(v).project(camera);
  out.x = (_pp.x * 0.5 + 0.5) * innerWidth;
  out.y = (-_pp.y * 0.5 + 0.5) * innerHeight;
  out.behind = _pp.z > 1;
  return out;
}
function projectedRadius(p) {
  const d = Math.max(camera.position.distanceTo(p.group.position), 1e-3);
  return (p.bodyRadius() / d / Math.tan((camera.fov * DEG) / 2)) * innerHeight * 0.5;
}
function pick(x, y) {
  let best = null, bestD = Infinity;
  for (const p of planets) {
    if (!p.group.visible) continue;
    toScreen(p.group.position, _sc);
    if (_sc.behind) continue;
    const r = projectedRadius(p) * (p.def.rings ? 1.35 : 1);
    const d = Math.hypot(_sc.x - x, _sc.y - y);
    if (d < Math.max(r * 1.1, 16) && d - r < bestD) { best = p; bestD = d - r; }
  }
  return best;
}
function setHover(p) {
  if (state.hover === p) return;
  const old = state.hover;
  if (old) {
    old.hiTarget = 0;
    if (old.labelEl) old.labelEl.classList.remove('hover');
    if (old.cardEl) old.cardEl.classList.remove('hover');
  }
  state.hover = p;
  if (p) {
    p.hiTarget = 0.9;
    if (p.labelEl) p.labelEl.classList.add('hover');
    if (p.cardEl) p.cardEl.classList.add('hover');
    audio.sfx('hover');
  }
  renderer.domElement.style.cursor = p ? 'pointer' : '';
}

// ---------------------------------------------------------------- per-frame

function baseRadius(p) {
  const s = THREE.MathUtils.lerp(p.visual, p.trueScale, state.compareEase);
  return s * (p.def.rings ? p.def.rings.outer : p.isTorus ? 1.36 : 1);
}
function screenRadius(worldR, pos) {
  const d = Math.max(camera.position.distanceTo(pos), 1e-3);
  return (worldR / d / Math.tan((camera.fov * DEG) / 2)) * innerHeight * 0.5;
}

// While a world is in focus, any other planet that would sit on top of (or behind) it on screen,
// loom large in the foreground, or glare through the glass panel steps aside.
function updateAppear(dt) {
  const f = state.mode === 'planet' ? state.focus : null;
  let fx = 0, fy = 0, fr = 0, box = null;
  if (f) {
    toScreen(f.group.position, _sc);
    fx = _sc.x; fy = _sc.y;
    fr = screenRadius(baseRadius(f), f.group.position);
    box = $('#panel').getBoundingClientRect();
  }
  for (const p of planets) {
    let target = 1;
    if (f && p !== f) {
      toScreen(p.group.position, _sc);
      const r = screenRadius(baseRadius(p), p.group.position);
      const onPanel = r > 6 && _sc.x + r > box.left && _sc.x - r < box.right && _sc.y + r > box.top && _sc.y - r < box.bottom;
      if (!_sc.behind && (Math.hypot(_sc.x - fx, _sc.y - fy) < fr + r + 24 || r > innerHeight * 0.14 || onPanel)) target = 0;
    }
    p.appear = damp(p.appear, target, 5, dt);
  }
}

// The lineup morph runs on wall-clock time (like camera flights) so the two stay in sync at any frame rate.
function updateWorld(dt, wall = dt) {
  const target = state.mode === 'compare' ? 1 : 0;
  const step = wall / 2.2;
  state.compareT = state.compareT < target ? Math.min(target, state.compareT + step) : Math.max(target, state.compareT - step);
  state.compareEase = easeInOut(state.compareT);
  earth.appear = state.compareEase;
  for (const p of planets) p.update(state, dt, ctx);
  earth.update(state, dt, ctx);
  star.update(dt, 1 - state.compareEase);
  const fade = (1 - state.compareEase) * (state.mode === 'planet' ? 0.3 : 1);
  for (const p of planets) {
    const line = p.orbitLine;
    const base = p === state.hover ? 0.62 : p.def.custom ? 0.3 : 0.17;
    line.material.opacity = damp(line.material.opacity, base * fade, 6, dt);
    line.visible = line.material.opacity > 0.004;
  }
}

function targetViewOffset() {
  const W = innerWidth, H = innerHeight;
  if (state.mode === 'planet') {
    if (narrow()) return { x: 0, y: H * 0.25 };
    return { x: ($('#panel').offsetWidth + 16) / 2, y: 0 };
  }
  if (state.mode === 'system') return narrow() ? { x: 0, y: H * 0.08 } : { x: -W * 0.1, y: 0 };
  return { x: 0, y: 0 };
}

// Labels try a few spots around their planet and skip any spot already taken,
// so names near the star never pile up on each other.
const _placed = [];
const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const hitsCircle = (a, c) => Math.hypot(Math.max(a[0] - c[0], 0, c[0] - a[2]), Math.max(a[1] - c[1], 0, c[1] - a[3])) < c[2];
// The hero copy blocks labels line by line, so a name can still sit beside a short line of text.
const heroText = $$('#hero .eyebrow, #hero h1, #hero .lede'), heroBtns = $$('#hero .btn'), _range = document.createRange();
function blockHero() {
  for (const el of heroText) {
    _range.selectNodeContents(el);
    for (const r of _range.getClientRects()) if (r.width > 0) _placed.push([r.left - 8, r.top - 4, r.right + 8, r.bottom + 4]);
  }
  for (const el of heroBtns) {
    const r = el.getBoundingClientRect();
    _placed.push([r.left - 8, r.top - 6, r.right + 8, r.bottom + 6]);
  }
}
let _starC = null;
const labelFree = (rect) => !_placed.some((q) => overlaps(q, rect)) && !(_starC && hitsCircle(rect, _starC));
function updateOverlays() {
  const showLabels = state.mode === 'system' || state.mode === 'compare';
  const cmp = state.mode === 'compare';
  _placed.length = 0;
  _starC = null;
  if (showLabels && !cmp) {
    if (!narrow()) blockHero();
    toScreen(ctx.starPos, _sc);
    if (star.group.visible && !_sc.behind) _starC = [_sc.x, _sc.y, screenRadius(6.5, ctx.starPos)];
  }
  const order = [...planets, earth].sort((a, b) => (b === state.hover) - (a === state.hover) || b.bodyRadius() - a.bodyRadius());
  for (const p of order) {
    const el = p.labelEl;
    if (!el) continue;
    const hide = !showLabels || !p.group.visible || (p === earth && state.compareEase < 0.6) || (cmp && state.compareEase < 0.6);
    if (hide) { el.classList.add('hidden'); continue; }
    toScreen(p.group.position, _sc);
    if (_sc.behind) { el.classList.add('hidden'); continue; }
    const r = projectedRadius(p);
    if (el.classList.contains('center') !== cmp) { el.classList.toggle('center', cmp); p.labelW = 0; }
    if (!p.labelW) {
      el.classList.remove('compact');
      p.labelW = el.offsetWidth; p.labelH = el.offsetHeight;
      el.classList.add('compact');
      p.labelWc = el.offsetWidth; p.labelHc = el.offsetHeight;
    }
    const x = _sc.x, y = _sc.y;
    const rr = Math.max(r, 4) * (p.def.rings && !cmp ? 1.6 : 1);
    const spots = (w, h) => (cmp
      ? [[x - w / 2, y + (p.def.rings ? r * 1.45 : r) + 12], [x - w / 2, y + r + 12 + h + 4], [x - w / 2, y - r - 12 - h], [x - w / 2, y + r + 12 + 2 * (h + 4)]]
      : [[x + rr + 9, y - 13], [x - rr - 9 - w, y - 13], [x - w / 2, y - rr - 6 - h], [x - w / 2, y + rr + 6],
        [x + rr + 6, y - h - rr * 0.7 - 4], [x + rr + 6, y + rr * 0.7 + 4], [x - rr - 6 - w, y - h - rr * 0.7 - 4], [x - rr - 6 - w, y + rr * 0.7 + 4]]);
    let pos = null, compact = false;
    for (const [w, h, c] of [[p.labelW, p.labelH, false], [p.labelWc, p.labelHc, true]]) {
      for (const s of spots(w, h)) {
        const rect = [s[0], s[1], s[0] + w, s[1] + h];
        if (labelFree(rect)) { pos = s; compact = c; _placed.push(rect); break; }
      }
      if (pos) break;
    }
    if (!pos && p === state.hover) pos = spots(p.labelW, p.labelH)[0];
    if (!pos) { el.classList.add('hidden'); continue; }
    el.classList.remove('hidden');
    el.classList.toggle('compact', compact);
    el.style.transform = `translate(${pos[0].toFixed(1)}px, ${pos[1].toFixed(1)}px)`;
  }
  if (state.mode === 'planet' && state.focus) {
    const p = state.focus;
    const limit = narrow() ? innerWidth : $('#panel').getBoundingClientRect().left;
    (p.markerEls || []).forEach((m, i) => {
      p.poi(i, _P, _N);
      toScreen(_P, _sc);
      _V.copy(camera.position).sub(_P).normalize();
      const facing = p.def.pois[i].center ? 1 : _N.dot(_V);
      const vis = facing > 0.12 && !_sc.behind && _sc.x < limit - 8;
      m.classList.toggle('hidden', !vis);
      m.style.transform = `translate(${_sc.x.toFixed(1)}px, ${_sc.y.toFixed(1)}px)`;
      if (i === state.poi) UI.placePoi(_sc.x, _sc.y, limit);
    });
  }
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const wall = Math.max(0, (now - last) / 1000);
  const dt = Math.min(0.25, wall);
  last = now;
  shared.uTime.value += dt;
  if (state.mode === 'forge') {
    forge.update(dt);
    forge.render(renderer);
    return;
  }
  const rate = state.mode === 'system' ? state.timeScale : state.mode === 'planet' ? 0.03 * Math.min(state.timeScale, 1) : 0;
  state.orbitRate = damp(state.orbitRate, rate, 2.5, dt);
  state.simTime += dt * state.orbitRate;
  state.spinRate = damp(state.spinRate, state.poi >= 0 || !state.layers.spin ? 0 : 1, 3, dt);
  shared.uScanMix.value = damp(shared.uScanMix.value, state.scan > 0 && state.mode === 'planet' ? 1 : 0, 5, dt);
  updateAppear(dt);
  updateWorld(dt, wall);
  if (state.mode === 'planet' && state.focus && !tween) {
    _o.copy(state.focus.group.position).sub(state.focus.prevPos);
    camera.position.add(_o);
    controls.target.add(_o);
  }
  if (tween) tween.update(now);
  else controls.update();
  const off = targetViewOffset();
  state.viewOffX = damp(state.viewOffX, off.x, 3.5, dt);
  state.viewOffY = damp(state.viewOffY, off.y, 3.5, dt);
  if (Math.abs(state.viewOffX) > 0.3 || Math.abs(state.viewOffY) > 0.3) camera.setViewOffset(innerWidth, innerHeight, state.viewOffX, state.viewOffY, innerWidth, innerHeight);
  else camera.clearViewOffset();
  starfield.position.copy(camera.position);
  camera.updateMatrixWorld();
  const cards = state.mode === 'planet' ? [$('#panel').getBoundingClientRect()] : [];
  for (const p of planets) p.fadeMoons(camera, cards, dt);
  updateOverlays();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- routing

function pushRoute(r) {
  const h = r ? '#' + r : '';
  if (location.hash === h) return;
  try { history.pushState(null, '', h || location.pathname + location.search); } catch (e) { /* sandboxed frame */ }
}
function route(r) {
  if (!r) return goSystem();
  if (r === 'compare') return goCompare();
  if (r === 'forge') return goForge();
  const p = planets.find((q) => q.def.id === r);
  if (p) return goPlanet(p);
  return goSystem();
}

// ---------------------------------------------------------------- UI wiring

function toggleSound(force) {
  const on = force ?? !audio.on;
  audio.setEnabled(on);
  const b = $('#soundBtn');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.querySelector('.sound-label').textContent = on ? 'Sound on' : 'Sound off';
  if (state.focus) UI.setListenButton(on, state.focus.def.name);
}

function setSpeed(v) {
  state.timeScale = v;
  $$('[data-speed]').forEach((b) => b.classList.toggle('on', +b.dataset.speed === v));
}

function openAbout() {
  const m = $('#about');
  m.hidden = false;
  m.querySelector('.modal-close').focus();
  audio.sfx('click');
}
function closeAbout() { $('#about').hidden = true; }

function wireUI() {
  $$('[data-nav]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    const n = b.dataset.nav;
    audio.sfx('click');
    if (n === 'system') goSystem();
    else if (n === 'compare') goCompare();
    else if (n === 'forge') goForge();
    else if (n === 'about') openAbout();
  }));
  $('#tourBtn').addEventListener('click', () => goPlanet(planets[0]));
  $('#soundBtn').addEventListener('click', () => toggleSound());
  $('#backBtn').addEventListener('click', () => goSystem());
  $$('[data-speed]').forEach((b) => b.addEventListener('click', () => { setSpeed(+b.dataset.speed); audio.sfx('click'); }));
  $$('[data-scan]').forEach((b) => b.addEventListener('click', () => { setScan(+b.dataset.scan); audio.sfx('click'); }));
  $$('[data-layer]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.layer;
    state.layers[k] = !state.layers[k];
    applyLayers();
    audio.sfx('click');
  }));
  UI.renderMetrics(METRICS, state.metric, (id) => { state.metric = id; layoutLineup(); audio.sfx('click'); });
  const about = $('#about');
  about.addEventListener('click', (e) => { if (e.target === about || e.target.closest('[data-close]')) closeAbout(); });

  const cv = renderer.domElement;
  const ptr = { down: false, sx: 0, sy: 0 };
  cv.addEventListener('pointerdown', (e) => { ptr.down = true; ptr.sx = e.clientX; ptr.sy = e.clientY; });
  cv.addEventListener('pointermove', (e) => {
    if (!ptr.down && (state.mode === 'system' || state.mode === 'compare')) setHover(pick(e.clientX, e.clientY));
  });
  cv.addEventListener('pointerleave', () => { if (!ptr.down) setHover(null); });
  addEventListener('pointerup', (e) => {
    if (!ptr.down) return;
    ptr.down = false;
    if (e.target !== cv || Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 6) return;
    if (state.mode === 'system' || state.mode === 'compare') {
      const p = pick(e.clientX, e.clientY);
      if (p) goPlanet(p);
    } else if (state.mode === 'planet' && state.poi >= 0) closePOI();
  });

  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (!about.hidden) closeAbout();
      else if (state.poi >= 0) closePOI();
      else if (state.mode !== 'system') goSystem();
      return;
    }
    if (!about.hidden || state.mode === 'loading') return;
    if (e.key === 'ArrowRight' && state.mode === 'planet') stepPlanet(1);
    else if (e.key === 'ArrowLeft' && state.mode === 'planet') stepPlanet(-1);
    else if (/^[1-9]$/.test(e.key)) { const p = planets[+e.key - 1]; if (p) goPlanet(p); }
    else if (e.key === 'c' || e.key === 'C') goCompare();
    else if (e.key === 'f' || e.key === 'F') goForge();
    else if (e.key === 'm' || e.key === 'M') toggleSound();
    else if (e.key === ' ' && state.mode === 'system' && !(e.target.closest && e.target.closest('button'))) {
      e.preventDefault();
      setSpeed(state.timeScale === 0 ? 1 : 0);
    }
  });

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    forge.resize();
    if (state.mode === 'compare') controls.maxDistance = compareView().dist * 2.2;
  });
  addEventListener('popstate', () => route(location.hash.slice(1)));
}

// ---------------------------------------------------------------- boot

async function init() {
  UI.setAccent(HOME_ACCENT);
  UI.loader('Painting the sky…', 0.08);
  await nextFrame();
  shared.uEnv.value = bakeSky(renderer, 1024);
  scene.background = shared.uEnv.value;
  starfield = createStarfield(shared);
  scene.add(starfield);
  star = createStar(shared);
  scene.add(star.group);

  UI.loader('Assembling eight worlds…', 0.22);
  await nextFrame();
  PLANETS.forEach((d) => addPlanet(d));
  loadCustom().forEach((d) => addPlanet(d));
  earth = new Planet(EARTH_REF, shared);
  earth.appear = 0;
  scene.add(earth.group);
  forge = new Forge({ renderer, shared, audio, onSave: saveCustom, onChange: (d) => { if (state.mode === 'forge') UI.setAccent(d.accent); } });
  forge.setBackground(shared.uEnv.value);
  refreshLists();
  updateWorld(0);

  UI.loader('Compiling planetary shaders…', 0.36);
  await nextFrame();
  await renderer.compileAsync(scene, camera);
  await renderer.compileAsync(forge.scene, forge.camera);

  UI.loader('Photographing the worlds…', 0.82);
  await nextFrame();
  for (const p of planets) UI.setThumb(p, makeThumb(p));

  wireUI();
  UI.loader('Ready', 1);
  requestAnimationFrame(loop);
  await nextFrame();
  UI.hideLoader();
  const r = location.hash.slice(1);
  if (r) {
    setMode('system');
    route(r);
  } else {
    state.mode = 'loading';
    goSystem();
  }
}

window.__atlas = { state, get planets() { return planets; }, goPlanet: (i) => goPlanet(typeof i === 'number' ? planets[i] : i), goSystem, goCompare, goForge, focusPOI, setScan, audio, get forge() { return forge; }, camera };

init().catch((e) => {
  console.error(e);
  UI.loader('Something went wrong while charting the worlds. Please reload.', 0);
});

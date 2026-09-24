// NYC 8192^3 viewer: quadtree voxel tiles + animated actors.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TileManager } from './tiles.js';
import { makePalette, makeSky, sharedUniforms } from './voxelmat.js';
import { Actors } from './actors.js';
import { downloadModel, downloadSource, downloadActors } from './download.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') === '1';
const T0 = performance.now();
const api = (window.__nyc = { ready: false, error: null, errors: [], timings: {}, stats: {}, frames: 0 });
const fmt = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} 亿`.replace(' 亿', '') : n);
const fmtBig = (n) => (n >= 1e8 ? `${(n / 1e8).toFixed(2)} 亿` : n >= 1e4 ? `${(n / 1e4).toFixed(1)} 万` : String(Math.round(n)));

window.addEventListener('error', (e) => { api.errors.push(String(e.message)); });
window.addEventListener('unhandledrejection', (e) => { api.errors.push(String(e.reason && e.reason.message || e.reason)); });

const QUALITY = { low: { px: 6.5, budget: 4e6 }, std: { px: 4.4, budget: 8e6 }, high: { px: 2.8, budget: 14e6 } };

let renderer, scene, camera, controls, tiles, actors, sky, places, manifest;
let playing = !params.has('paused'), speed = 1, simTime = Number(params.get('t') || 0), lastNow = performance.now();
let fly = null, labelsOn = params.get('labels') !== '0', orbitOn = false, holdUntil = 0;
const clockEl = $('clock');

async function main() {
  const base = './data/';
  manifest = await (await fetch(`${base}manifest.json`)).json();
  places = await (await fetch(`${base}places.json`)).json().catch(() => ({ labels: [], views: [] }));
  api.timings.manifest = performance.now() - T0;
  $('fVox').textContent = `${manifest.stats.static_voxels.toLocaleString('en-US')}（${fmtBig(manifest.stats.static_voxels)}）`;

  renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: !SHOT || params.get('aa') === '1', preserveDrawingBuffer: SHOT, powerPreference: 'high-performance' });
  renderer.setPixelRatio(SHOT ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // shaders write sRGB themselves
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 60000);
  sky = makeSky(); scene.add(sky);
  makePalette(manifest.palette);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.enableDamping = !SHOT;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 4;
  controls.maxDistance = 26000;
  controls.autoRotateSpeed = 0.6;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    controls.mouseButtons.LEFT = e.altKey ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    if (fly) fly = null;
  }, { capture: true });
  renderer.domElement.addEventListener('wheel', () => { fly = null; }, { capture: true, passive: true });
  renderer.domElement.addEventListener('dblclick', onDblClick);
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  const q = QUALITY[params.get('q')] || QUALITY.std;
  const nw = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
  tiles = new TileManager({ scene, manifest, base, nWorkers: nw, quadBudget: q.budget });
  tiles.pxPerCell = q.px;
  setQualityButtons(params.get('q') || 'std');

  actors = new Actors(scene);
  try { await actors.load('./life/actors.json'); } catch (e) { console.warn('actors not loaded', e); }
  $('fActors').textContent = actors.count ? `${actors.count} 个 · ${actors.zones.length} 个活动区域` : '—';

  buildUI();
  const v = params.get('view');
  const cam = (params.get('cam') || '').split(',').map(Number);
  if (cam.length === 6 && cam.every(Number.isFinite)) { camera.position.set(cam[0], cam[1], cam[2]); controls.target.set(cam[3], cam[4], cam[5]); }
  else setView(findView(v || 'overview'), true);
  controls.update();
  window.addEventListener('resize', onResize);
  api.setView = (id) => setView(findView(id), true);
  api.setTime = (t) => { simTime = t; };
  api.pause = () => setPlaying(false);
  api.play = () => setPlaying(true);
  api.getState = () => ({ time: simTime, playing, speed, cam: [camera.position.x, camera.position.y, camera.position.z, controls.target.x, controls.target.y, controls.target.z] });
  requestAnimationFrame(loop);
}

function findView(id) {
  const all = [...(places.views || []), ...(actors.zones || []).map((z) => ({ ...z.view, id: z.id, name: z.name }))];
  return all.find((v) => v.id === id) || all[0] || { target: [4096, 30, 4096], dist: 11000, az: -50, el: 38 };
}
function poseOf(v) {
  const t = new THREE.Vector3(...v.target);
  const az = THREE.MathUtils.degToRad(v.az), el = THREE.MathUtils.degToRad(v.el);
  const p = t.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(v.dist));
  return { p, t };
}
function setView(v, instant) {
  const { p, t } = poseOf(v);
  if (instant || SHOT) { camera.position.copy(p); controls.target.copy(t); controls.update(); fly = null; return; }
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: p, t1: t, s: performance.now(), dur: 1800 };
}

function onDblClick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
  const hit = tiles.pick(ray.ray.origin, ray.ray.direction);
  if (!hit) return;
  const dir = camera.position.clone().sub(controls.target);
  const d = Math.max(60, dir.length() * 0.45);
  dir.setLength(d);
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: hit.clone().add(dir), t1: hit, s: performance.now(), dur: 1100 };
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
}

function setPlaying(p) { playing = p; $('play').textContent = playing ? '暂停' : '播放'; $('play').classList.toggle('on', playing); }
function setQualityButtons(k) { for (const b of document.querySelectorAll('[data-q]')) b.classList.toggle('on', b.dataset.q === k); }

function buildUI() {
  $('collapse').onclick = () => { $('panel').classList.toggle('collapsed'); $('collapse').textContent = $('panel').classList.contains('collapsed') ? '+' : '−'; };
  $('play').onclick = () => setPlaying(!playing);
  for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => { speed = Number(b.dataset.speed); for (const c of document.querySelectorAll('[data-speed]')) c.classList.toggle('on', c === b); };
  $('orbit').onclick = () => { orbitOn = !orbitOn; controls.autoRotate = orbitOn; $('orbit').classList.toggle('on', orbitOn); };
  $('labelsBtn').onclick = () => { labelsOn = !labelsOn; $('labelsBtn').classList.toggle('on', labelsOn); if (!labelsOn) $('labels').innerHTML = ''; };
  for (const b of document.querySelectorAll('[data-q]')) b.onclick = () => { const q = QUALITY[b.dataset.q]; tiles.pxPerCell = q.px; tiles.quadBudget = q.budget; setQualityButtons(b.dataset.q); };
  const vs = $('views');
  for (const v of places.views || []) { const b = document.createElement('button'); b.className = 'b'; b.textContent = v.name; b.onclick = () => setView(v); vs.appendChild(b); }
  const zs = $('zones');
  for (const z of actors.zones || []) {
    const b = document.createElement('button'); b.className = 'b';
    b.innerHTML = `${z.name}<small>${z.count}</small>`;
    b.onclick = () => setView({ ...z.view });
    zs.appendChild(b);
  }
  const status = (t) => { holdUntil = performance.now() + 8000; $('ptext').textContent = t; };
  $('dlModel').onclick = () => downloadModel(manifest, status).catch((e) => status(`下载失败：${e.message}`));
  $('dlActors').onclick = () => { downloadActors(); status('角色路径 JSON 已开始下载'); };
  $('dlSrc').onclick = () => downloadSource(status).catch((e) => status(`下载失败：${e.message}`));
}

// ---------------------------------------------------------------------------------------------
const labelEls = new Map();
function updateLabels() {
  const box = $('labels');
  if (!labelsOn) return;
  const w = window.innerWidth, h = window.innerHeight;
  const v = new THREE.Vector3();
  const placed = [];
  const items = [];
  const camD = camera.position.distanceTo(controls.target);
  for (const L of places.labels || []) {
    v.set(L.x, L.y, L.z);
    const d = camera.position.distanceTo(v);
    const maxD = L.rank === 1 ? 16000 : L.rank === 2 ? 5500 : 2200;
    if (d > maxD || d < 30) continue;
    v.project(camera);
    if (v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.1) continue;
    items.push({ L, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, d });
  }
  items.sort((a, b) => a.L.rank - b.L.rank || a.d - b.d);
  const keep = new Set();
  for (const it of items) {
    const wEst = it.L.name.length * 12 + 16, hEst = 20;
    const r = [it.x - wEst / 2, it.y - hEst, it.x + wEst / 2, it.y];
    if (placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) continue;
    placed.push(r);
    keep.add(it.L.name);
    let el = labelEls.get(it.L.name);
    if (!el) { el = document.createElement('div'); el.className = `lbl${it.L.kind === 'zone' ? ' zone' : ''}`; el.textContent = it.L.name; labelEls.set(it.L.name, el); }
    if (!el.parentNode) box.appendChild(el);
    el.style.left = `${it.x.toFixed(1)}px`; el.style.top = `${(it.y - 4).toFixed(1)}px`;
    if (placed.length >= 28) break;
  }
  for (const [name, el] of labelEls) if (!keep.has(name) && el.parentNode) el.remove();
  void camD;
}

// ---------------------------------------------------------------------------------------------
let fpsAcc = 0, fpsN = 0, fpsLast = performance.now(), fps = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
  if (playing) simTime += dt * speed;
  if (fly) {
    const k = Math.min(1, (now - fly.s) / fly.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e);
    if (k >= 1) fly = null;
  }
  controls.update();
  const dist = camera.position.distanceTo(controls.target);
  camera.near = THREE.MathUtils.clamp(dist * 0.004, 0.25, 40);
  camera.far = 60000;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  sky.position.copy(camera.position); sky.scale.setScalar(30000);
  sharedUniforms.uCamPos.value.copy(camera.position);
  sharedUniforms.uTime.value = simTime;
  sharedUniforms.uFogDensity.value = 1 / THREE.MathUtils.clamp(dist * 5 + 6000, 7000, 42000);
  tiles.update(camera, renderer.domElement.height);
  if (actors) actors.update(simTime, camera);
  renderer.render(scene, camera);
  updateLabels();
  api.frames++;
  fpsN++; if (now - fpsLast > 1000) { fps = fpsN * 1000 / (now - fpsLast); fpsN = 0; fpsLast = now; }
  const info = renderer.info.render;
  const st = tiles.stats;
  api.stats = { triangles: info.triangles, calls: info.calls, fps, tiles: st.shownTiles, quads: st.shownQuads, byLod: st.byLod, loaded: st.loaded, bytes: st.bytes, pending: tiles.pending.size + tiles.queue.length, actorsVisible: actors ? actors.visibleCount : 0 };
  api.errors = [...new Set([...api.errors, ...tiles.errors])];
  $('fRender').textContent = `${fps.toFixed(fps < 10 ? 1 : 0)} fps · ${(info.triangles / 1e6).toFixed(2)}M 三角形 · 块 ${st.byLod.join('/')}`;
  const loading = tiles.pending.size + tiles.queue.length;
  if (now > holdUntil) $('ptext').textContent = loading ? `加载体素块… 剩余 ${loading} · 已解压 ${(st.bytes / 1048576).toFixed(1)} MB` : `已加载 ${st.loaded} 块 · 解压后 ${(st.bytes / 1048576).toFixed(1)} MB`;
  $('pbar').style.width = `${Math.min(100, st.loaded / Math.max(1, st.loaded + loading) * 100).toFixed(0)}%`;
  const mm = Math.floor(simTime / 60), ss = Math.floor(simTime % 60);
  clockEl.textContent = `动画时间 ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')} · ${playing ? `${speed}×` : '已暂停'}`;
  if (!api.ready && tiles.roots.every((r) => r.state === 2) && tiles.idle() && api.frames > 3) { api.ready = true; api.timings.ready = performance.now() - T0; }
  api.idle = tiles.idle();
  requestAnimationFrame(loop);
}

main().catch((e) => { console.error(e); api.error = String(e && e.message || e); $('ptext').textContent = `出错：${api.error}`; });

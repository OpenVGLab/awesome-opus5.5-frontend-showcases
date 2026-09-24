// Voxel viewer: streams a LOD file, greedy-meshes it in Web Workers and renders it with three.js.
// URL: index.html?model=<slug>[&quality=overview|standard|fine][&lod=N][&view=iso|aerial|close][&ui=0][&shot=1]
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PALETTE as CORE_PALETTE, readLodHeader, HEADER_BYTES, RECORD_HEADER_BYTES } from './voxel-core.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') === '1';
const T0 = performance.now();
const state = (window.__voxelViewer = {
  ready: false, error: null, slug: null, lod: null, quality: null, triangles: 0, drawCalls: 0, timings: {},
});

const QUALITIES = {
  overview: { label: '概览', budget: 1.5e6 },
  standard: { label: '标准', budget: 4e6 },
  fine: { label: '精细', budget: 12e6 },
};
const ALPHA = { glass: 0.3, glass_blue: 0.46, glass_dark: 0.64, water: 0.66 };
const BATCH_CHUNKS = 128;
const BATCH_BLOCKS = 400_000;
const COARSE = !SHOT && matchMedia('(pointer: coarse)').matches;

const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
const fmtM = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`
  : n >= 1e4 ? `${Math.round(n / 1e3)}K` : fmtInt(n));
const fmtBytes = (b) => (b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(2)} GB` : b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MB`
  : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------------------------------------------------------------------------------------------
// UI

const ui = {
  progressShown: false,
  setProgress(frac, text) {
    $('progress').classList.remove('hidden');
    $('bar').style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    $('ptext').textContent = text;
  },
  hideProgress() { $('progress').classList.add('hidden'); },
  error(msg) {
    state.error = msg;
    $('progress').classList.remove('hidden');
    $('bar').style.width = '0';
    $('ptext').innerHTML = `<span class="warn">${esc(msg)}</span>`;
  },
};

function setupPanelToggle() {
  $('collapse').addEventListener('click', () => {
    $('panel').classList.toggle('collapsed');
    $('collapse').textContent = $('panel').classList.contains('collapsed') ? '+' : '−';
  });
  $('prompt').addEventListener('click', () => $('prompt').classList.toggle('open'));
  if (params.get('ui') === '0') { $('panel').classList.add('hidden'); $('hint').classList.add('hidden'); }
  $('hint').textContent = COARSE ? '单指旋转 · 双指平移 / 缩放' : '左键拖动旋转 · 右键拖动平移 · 滚轮缩放';
}

function showInfo(stats) {
  document.title = `${stats.title || stats.slug} · 体素查看器`;
  $('title').textContent = stats.title || stats.slug;
  const prompt = (stats.prompt || '').trim();
  $('prompt').textContent = prompt;
  $('prompt').classList.toggle('hidden', !prompt);
  requestAnimationFrame(() => $('prompt').classList.toggle('clamped', $('prompt').scrollHeight > $('prompt').clientHeight + 2));
  const facts = [
    ['网格', `${stats.grid.size}³`],
    ['方块', fmtInt(stats.blocks)],
    ['程序', `${fmtBytes(stats.program.bytes)} · ${fmtInt(stats.program.lines)} 行`],
    ['LOD', '<span id="lodText">—</span>'],
    ['三角形', '<span id="triText">—</span>'],
  ];
  if (stats.status !== 'ok') {
    facts.push(['状态', `<span class="warn">${stats.status === 'timeout' ? '构建超时' : '构建出错'}（已显示部分结果）</span>`]);
  }
  $('facts').innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

function updateLodText(lod, tris, calls) {
  const el = $('lodText');
  if (el && lod) el.textContent = `LOD${lod.level} · ${lod.scale === 1 ? '原始分辨率' : `1/${lod.scale} 分辨率`} · ${fmtM(lod.blocks)} 方块`;
  const t = $('triText');
  if (t) t.textContent = `${fmtM(tris)}${calls ? ` · ${calls} 次绘制` : ''}`;
}

async function showGallery() {
  $('title').textContent = '体素查看器';
  $('prompt').textContent = '用法：index.html?model=<slug>（读取 ../models/<slug>/）';
  $('quality').classList.add('hidden');
  $('views').classList.add('hidden');
  try {
    const idx = await fetchJson(new URL('../models/index.json', location.href));
    const rows = (idx.models || []).map((m) => `<li><a href="?model=${encodeURIComponent(m.slug).replace(/%2F/g, '/')}">${esc(m.title || m.slug)}</a>`
      + `<span>${esc(m.slug)} · ${m.size}³ · ${fmtM(m.blocks)} 方块${m.status !== 'ok' ? ' · ⚠' : ''}</span></li>`).join('');
    $('facts').outerHTML = `<ul class="gallery">${rows || '<li>还没有模型</li>'}</ul>`;
  } catch {
    $('facts').innerHTML = '<dt>提示</dt><dd>未找到 ../models/index.json</dd>';
  }
  ui.hideProgress();
  state.ready = true;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}：${url.pathname}`);
  return res.json();
}

// ---------------------------------------------------------------------------------------------
// Shaders

const COMMON_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uNadir;
uniform float uFogNear;
uniform float uFogFar;
vec3 skyColor(vec3 d) {
  float h = d.y;
  vec3 c = h >= 0.0 ? mix(uHorizon, uZenith, pow(h, 0.55)) : mix(uHorizon, uNadir, pow(min(-h * 3.0, 1.0), 0.8));
  float s = max(dot(d, uSunDir), 0.0);
  c += vec3(1.0, 0.85, 0.62) * (pow(s, 6.0) * 0.12 + pow(s, 48.0) * 0.22);
  return c;
}
float fogFactor(float dist) {
  float t = max(dist - uFogNear, 0.0) / max(uFogFar - uFogNear, 1e-3);
  return 1.0 - exp(-t * t * 2.5);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
`;

const LIGHT_GLSL = /* glsl */ `
uniform vec3 uSunColor;
uniform vec3 uSkyLight;
uniform vec3 uGroundLight;
uniform vec3 uFillDir;
uniform vec3 uFillColor;
vec3 lightAt(vec3 n, float ao) {
  float sun = max(dot(n, uSunDir), 0.0);
  float fill = max(dot(n, uFillDir), 0.0);
  vec3 hemi = mix(uGroundLight, uSkyLight, n.y * 0.5 + 0.5);
  return hemi * ao + uFillColor * fill * ao + uSunColor * sun * mix(0.6, 1.0, ao);
}
`;

const VOXEL_VS = /* glsl */ `
attribute vec4 vdata;
uniform vec4 uPalette[64];
flat varying vec3 vNormal;
flat varying vec4 vColor;
varying float vAO;
varying vec3 vWorld;
void main() {
  int d = int(vdata.x + 0.5);
  vNormal = d == 0 ? vec3(1.0, 0.0, 0.0) : d == 1 ? vec3(-1.0, 0.0, 0.0) : d == 2 ? vec3(0.0, 1.0, 0.0)
          : d == 3 ? vec3(0.0, -1.0, 0.0) : d == 4 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 0.0, -1.0);
  vColor = uPalette[int(vdata.y + 0.5)];
  vAO = vdata.z / 3.0;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const VOXEL_FS = /* glsl */ `
${COMMON_GLSL}
${LIGHT_GLSL}
uniform float uVoxel;
flat varying vec3 vNormal;
flat varying vec4 vColor;
varying float vAO;
varying vec3 vWorld;
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
void main() {
  vec3 n = vNormal;
#ifdef TRANSPARENT
  if (!gl_FrontFacing) n = -n;
#endif
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 v = toCam / dist;

  // Per-voxel detail (subtle tint jitter + edge darkening), faded out once voxels get small on screen.
  vec3 q = vWorld / uVoxel;
  vec3 cell = floor(q - vNormal * 0.5);
  vec2 f = abs(vNormal.x) > 0.5 ? q.yz : abs(vNormal.y) > 0.5 ? q.xz : q.xy;
  vec2 fw = fwidth(f);
  float detail = 1.0 - smoothstep(0.06, 0.22, max(fw.x, fw.y));
  vec2 e = min(fract(f), 1.0 - fract(f));
  vec2 lw = fw * 1.25 + 1e-4;
  float edge = 1.0 - min(smoothstep(0.0, lw.x, e.x), smoothstep(0.0, lw.y, e.y));
  float jitter = hash13(cell) - 0.5;
  vec3 albedo = vColor.rgb * (1.0 + jitter * 0.07 * detail) * (1.0 - edge * 0.16 * detail);

  float ao = vAO;
  ao = mix(0.38, 1.0, ao * (2.0 - ao) * 0.35 + ao * 0.65);
  vec3 col = albedo * lightAt(n, ao);
  float alpha = vColor.a;
#ifdef TRANSPARENT
  float fr = pow(1.0 - abs(dot(n, v)), 4.0);
  col = mix(col, skyColor(reflect(-v, n)), fr * 0.5);
  alpha = mix(alpha, 1.0, fr * 0.55);
#endif
  col = mix(col, skyColor(-v), fogFactor(dist));
  gl_FragColor = vec4(toSRGB(col), alpha);
}
`;

const SKY_VS = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const SKY_FS = /* glsl */ `
${COMMON_GLSL}
${LIGHT_GLSL}
uniform mat4 uInvViewProj;
uniform vec3 uCamPos;
uniform float uGrid;
uniform float uGridStep;
uniform vec3 uGround;
uniform vec3 uGroundPlate;
uniform vec4 uFootprint; // model bbox on the ground: min.xz, max.xz
varying vec2 vNdc;
void main() {
  vec4 p = uInvViewProj * vec4(vNdc, 0.5, 1.0);
  vec3 d = normalize(p.xyz / p.w - uCamPos);
  vec3 col = skyColor(d);
  if (d.y < 0.0 && uCamPos.y > 0.0) {
    float t = -uCamPos.y / d.y;
    vec2 g = uCamPos.xz + d.xz * t;
    bool inside = g.x >= 0.0 && g.y >= 0.0 && g.x <= uGrid && g.y <= uGrid;
    vec3 alb = inside ? uGroundPlate : uGround;
    vec2 cell = g / uGridStep;
    vec2 fw = fwidth(cell);
    vec2 e = min(fract(cell), 1.0 - fract(cell));
    float line = 1.0 - min(smoothstep(0.0, fw.x * 1.2, e.x), smoothstep(0.0, fw.y * 1.2, e.y));
    float fade = 1.0 - smoothstep(0.05, 0.4, max(fw.x, fw.y));
    if (inside) alb *= 1.0 - line * 0.12 * fade;
    vec2 b = min(g, vec2(uGrid) - g);
    float border = inside ? 1.0 - smoothstep(0.0, max(fwidth(g.x), fwidth(g.y)) * 2.0 + uGrid * 0.002, min(b.x, b.y)) : 0.0;
    alb *= 1.0 - border * 0.25;
    vec2 fc = (uFootprint.xy + uFootprint.zw) * 0.5, fh = (uFootprint.zw - uFootprint.xy) * 0.5;
    float fd = length(max(abs(g - fc) - fh, 0.0));
    float soft = max(6.0, max(fh.x, fh.y) * 0.08);
    alb *= 1.0 - 0.38 * exp(-fd / soft);
    vec3 lit = alb * lightAt(vec3(0.0, 1.0, 0.0), 1.0);
    col = mix(lit, col, fogFactor(t));
  }
  gl_FragColor = vec4(toSRGB(col), 1.0);
}
`;

// ---------------------------------------------------------------------------------------------
// Rendering

const linear = (hex) => new THREE.Color(hex);
let renderer, scene, camera, controls, uniforms, matOpaque, matTrans, skyMesh;
let model = null; // { stats, center, radius, min, max }

function initRenderer(stats, palette) {
  const canvas = $('c');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: SHOT, powerPreference: 'high-performance' });
  renderer.setPixelRatio(SHOT ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0xcfdcea, 1);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 10000);

  const pal = [];
  for (let i = 0; i < 64; i++) pal.push(new THREE.Vector4(1, 0, 1, 1));
  for (const p of palette) {
    const c = linear(p.color);
    pal[p.id].set(c.r, c.g, c.b, p.transparent ? (ALPHA[p.name] ?? 0.5) : 1);
  }
  const sunDir = new THREE.Vector3(0.52, 0.78, 0.34).normalize();
  const col3 = (hex, k = 1) => { const c = linear(hex); return new THREE.Vector3(c.r * k, c.g * k, c.b * k); };
  uniforms = {
    uPalette: { value: pal },
    uSunDir: { value: sunDir },
    uSunColor: { value: col3('#fff1dc', 0.78) },
    uSkyLight: { value: col3('#c6dcf5', 0.52) },
    uGroundLight: { value: col3('#b9ab98', 0.3) },
    uFillDir: { value: new THREE.Vector3(-0.45, 0.25, -0.86).normalize() },
    uFillColor: { value: col3('#b8cce8', 0.1) },
    uZenith: { value: col3('#5b8fd6') },
    uHorizon: { value: col3('#dfe9f2') },
    uNadir: { value: col3('#c9cfd2') },
    uFogNear: { value: 1000 },
    uFogFar: { value: 5000 },
    uVoxel: { value: 1 },
    uInvViewProj: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() },
    uGrid: { value: stats.grid.size },
    uGridStep: { value: stats.grid.size <= 128 ? 8 : stats.grid.size <= 512 ? 16 : 64 },
    uGround: { value: col3('#dddbd3') },
    uGroundPlate: { value: col3('#cdd0c6') },
    uFootprint: { value: new THREE.Vector4(0, 0, stats.grid.size, stats.grid.size) },
  };
  if (stats.bbox) uniforms.uFootprint.value.set(stats.bbox.min[0], stats.bbox.min[2], stats.bbox.max[0] + 1, stats.bbox.max[2] + 1);
  const mk = (transparent) => new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VOXEL_VS,
    fragmentShader: VOXEL_FS,
    transparent,
    depthWrite: !transparent,
    side: transparent ? THREE.DoubleSide : THREE.FrontSide,
    defines: transparent ? { TRANSPARENT: 1 } : {},
  });
  matOpaque = mk(false);
  matTrans = mk(true);

  const skyGeo = new THREE.BufferGeometry();
  skyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  skyMesh = new THREE.Mesh(skyGeo, new THREE.ShaderMaterial({
    uniforms, vertexShader: SKY_VS, fragmentShader: SKY_FS, depthTest: false, depthWrite: false,
  }));
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -1000;
  scene.add(skyMesh);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !SHOT;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.addEventListener('change', requestRender);

  const bb = stats.bbox || { min: [0, 0, 0], max: [stats.grid.size - 1, stats.grid.size - 1, stats.grid.size - 1] };
  const min = new THREE.Vector3(...bb.min);
  const max = new THREE.Vector3(...bb.max).addScalar(1);
  const center = min.clone().add(max).multiplyScalar(0.5);
  model = { stats, min, max, center, radius: max.distanceTo(min) / 2 };
  controls.minDistance = 2;
  controls.maxDistance = model.radius * 8 + stats.grid.size;

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    requestRender();
  });
}

// Frame the model's bounding box: find a target/distance so the projected box is centred and
// fills `fill` of the smaller screen extent (a few fixed-point iterations of the perspective fit).
function frameBox(dir, target, fill = 0.88) {
  const fwd = dir.clone().negate();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * fill;
  const tanH = tanV * camera.aspect;
  const q = new THREE.Vector3();
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? model.max.x : model.min.x, i & 2 ? model.max.y : model.min.y, i & 4 ? model.max.z : model.min.z));
  let dist = 1;
  for (const c of corners) {
    q.subVectors(c, target);
    dist = Math.max(dist, q.dot(dir) + Math.abs(q.dot(right)) / tanH, q.dot(dir) + Math.abs(q.dot(up)) / tanV);
  }
  for (let iter = 0; iter < 6; iter++) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of corners) {
      q.subVectors(c, target);
      const depth = dist - q.dot(dir);
      const sx = q.dot(right) / depth, sy = q.dot(up) / depth;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    target.addScaledVector(right, ((x0 + x1) / 2) * dist).addScaledVector(up, ((y0 + y1) / 2) * dist);
    dist *= Math.max((x1 - x0) / 2 / tanH, (y1 - y0) / 2 / tanV);
  }
  return dist;
}

function setView(view) {
  const { min, max, center } = model;
  const size = max.clone().sub(min);
  const target = center.clone();
  let az = 45, el = 30;
  if (view === 'aerial') { az = 28; el = 62; }
  else if (view === 'close') { az = 36; el = 17; }
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  const dir = new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
  let dist;
  if (view === 'close') {
    target.y = min.y + size.y * 0.25;
    dist = frameBox(dir, center.clone()) * 0.4;
  } else {
    dist = frameBox(dir, target);
  }
  camera.position.copy(target).addScaledVector(dir, dist);
  controls.target.copy(target);
  camera.lookAt(target);
  controls.update();
  requestRender();
}

let renderQueued = false;
function requestRender() {
  if (renderQueued || !renderer) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    const moving = controls.update();
    renderNow();
    if (moving) requestRender();
  });
}

function renderNow() {
  const D = camera.position.distanceTo(controls.target);
  const R = model.radius;
  const toCenter = camera.position.distanceTo(model.center);
  camera.near = THREE.MathUtils.clamp(D * 0.004, 0.05, 20);
  camera.far = Math.max(toCenter + R * 1.2, D * 4, 100);
  camera.updateProjectionMatrix();
  const fogScale = Math.max(D, R * 0.6);
  uniforms.uFogNear.value = D * 0.8 + R * 0.15;
  uniforms.uFogFar.value = uniforms.uFogNear.value + fogScale * 3.2;
  camera.updateMatrixWorld();
  uniforms.uInvViewProj.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  uniforms.uCamPos.value.copy(camera.position);
  renderer.render(scene, camera);
  state.triangles = renderer.info.render.triangles;
  state.drawCalls = renderer.info.render.calls;
}

// ---------------------------------------------------------------------------------------------
// Worker pool

class MeshPool {
  constructor(n, transparent) {
    this.free = [];
    this.queue = [];
    this.pending = new Map();
    this.nextId = 1;
    this.workers = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./mesh-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => {
        const r = e.data;
        const t = this.pending.get(r.id);
        this.pending.delete(r.id);
        this.free.push(w);
        this.pump();
        if (t) t.resolve(r);
      };
      w.onerror = (e) => {
        e.preventDefault();
        fail(new Error(`网格 Worker 出错：${e.message || e.type}`));
      };
      w.postMessage({ type: 'init', transparent });
      this.workers.push(w);
      this.free.push(w);
    }
  }
  run(job) {
    return new Promise((resolve) => {
      this.queue.push({ id: this.nextId++, job, resolve });
      this.pump();
    });
  }
  pump() {
    while (this.free.length && this.queue.length) {
      const w = this.free.pop();
      const t = this.queue.shift();
      this.pending.set(t.id, t);
      w.postMessage({ type: 'job', id: t.id, ...t.job }, [t.job.buf]);
    }
  }
  drop(session) {
    this.queue = this.queue.filter((t) => {
      if (t.job.session === session) return true;
      t.resolve(null);
      return false;
    });
  }
}

// ---------------------------------------------------------------------------------------------
// LOD loading

class RecordParser {
  constructor(onBatch) {
    this.acc = new Uint8Array(1 << 20);
    this.len = 0;
    this.header = null;
    this.batch = null;
    this.onBatch = onBatch;
  }
  push(chunk) {
    if (this.len + chunk.length > this.acc.length) {
      const next = new Uint8Array(Math.max(this.acc.length * 2, this.len + chunk.length));
      next.set(this.acc.subarray(0, this.len));
      this.acc = next;
    }
    this.acc.set(chunk, this.len);
    this.len += chunk.length;
    let p = 0;
    if (!this.header) {
      if (this.len < HEADER_BYTES) return;
      this.header = readLodHeader(this.acc.subarray(0, HEADER_BYTES));
      p = HEADER_BYTES;
    }
    const acc = this.acc;
    const dv = new DataView(acc.buffer);
    while (this.len - p >= RECORD_HEADER_BYTES) {
      const size = RECORD_HEADER_BYTES + dv.getUint32(p + 8, true);
      if (this.len - p < size) break;
      this.add(dv.getUint16(p, true), dv.getUint16(p + 2, true), dv.getUint16(p + 4, true), dv.getUint16(p + 6, true), p, size);
      p += size;
    }
    if (p > 0) { acc.copyWithin(0, p, this.len); this.len -= p; }
  }
  add(cx, cy, cz, blocks, p, size) {
    const rc = this.header.regionChunks;
    const rx = Math.floor(cx / rc), ry = Math.floor(cy / rc), rz = Math.floor(cz / rc);
    const key = (ry * 4096 + rz) * 4096 + rx;
    let b = this.batch;
    if (b && (b.key !== key || b.chunks >= BATCH_CHUNKS || b.blocks >= BATCH_BLOCKS)) { this.flush(); b = null; }
    if (!b) {
      b = this.batch = { key, origin: [rx * rc * 32, ry * rc * 32, rz * rc * 32], parts: [], bytes: 0, chunks: 0, blocks: 0 };
    }
    b.parts.push(this.acc.slice(p, p + size));
    b.bytes += size;
    b.chunks++;
    b.blocks += blocks;
  }
  flush() {
    const b = this.batch;
    if (!b) return;
    this.batch = null;
    const buf = new Uint8Array(b.bytes);
    let o = 0;
    for (const part of b.parts) { buf.set(part, o); o += part.length; }
    this.onBatch({ origin: b.origin, buf: buf.buffer, chunks: b.chunks, blocks: b.blocks });
  }
}

let pool = null;
let session = 0;
let current = null; // { lod, group, tris }
let loadingLevel = null;
let sharedIndex = null;
let sharedCap = 0;

function indexFor(quads) {
  if (quads > sharedCap) {
    const cap = Math.max(quads, sharedCap * 2, 1 << 16);
    const arr = new Uint32Array(cap * 6);
    for (let q = 0, i = 0; q < cap; q++) {
      const v = q * 4;
      arr[i++] = v; arr[i++] = v + 1; arr[i++] = v + 2; arr[i++] = v; arr[i++] = v + 2; arr[i++] = v + 3;
    }
    sharedIndex = new THREE.BufferAttribute(arr, 1);
    sharedCap = cap;
  }
  return sharedIndex;
}

function addBatchMeshes(group, r, origin, scale) {
  let tris = 0;
  for (const [part, mat] of [[r.opaque, matOpaque], [r.trans, matTrans]]) {
    if (!part.quads) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(part.pos, 3));
    g.setAttribute('vdata', new THREE.BufferAttribute(part.dat, 4));
    g.setIndex(indexFor(part.quads));
    g.setDrawRange(0, part.quads * 6);
    const [x0, y0, z0, x1, y1, z1] = r.bounds;
    g.boundingBox = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(origin[0] * scale, origin[1] * scale, origin[2] * scale);
    mesh.scale.setScalar(scale);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
    tris += part.quads * 2;
  }
  return tris;
}

function disposeGroup(group) {
  group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
}

async function loadLevel(level) {
  const stats = model.stats;
  const lod = stats.lods.find((l) => l.level === level);
  if (!lod) throw new Error(`没有 LOD${level}`);
  if (current && current.lod.level === level && loadingLevel === null) return;
  const my = ++session;
  if (pool) pool.drop(my);
  loadingLevel = level;
  sharedIndex = null;
  sharedCap = 0;
  const group = new THREE.Group();
  group.visible = !current;
  scene.add(group);
  const abandon = () => { scene.remove(group); disposeGroup(group); };
  const tStart = performance.now();
  const prog = { recv: 0, total: lod.bytes || 1, chunks: 0, totalChunks: lod.chunks || 1, tris: 0 };
  let lastUi = 0, lastDraw = 0;
  const report = (force) => {
    const now = performance.now();
    if (!force && now - lastUi < 100) return;
    lastUi = now;
    const dl = Math.min(1, prog.recv / prog.total), mf = prog.chunks / prog.totalChunks;
    ui.setProgress(0.2 * dl + 0.8 * mf,
      `LOD${level} · 下载 ${fmtBytes(prog.recv)} / ${fmtBytes(prog.total)} · 网格 ${fmtInt(prog.chunks)} / ${fmtInt(prog.totalChunks)} 块 · ${fmtM(prog.tris)} 三角形`);
    if (!SHOT && group.visible && now - lastDraw > 250) { lastDraw = now; requestRender(); }
  };
  ui.setProgress(0.01, `LOD${level} · 连接中…`);
  const res = await fetch(new URL(lod.file, new URL(`../models/${state.slug}/`, location.href)));
  if (!res.ok) { abandon(); throw new Error(`下载 ${lod.file} 失败：${res.status}`); }
  if (my !== session) { abandon(); return; }
  state.timings.firstByte = performance.now() - T0;
  const counter = new TransformStream({
    transform(chunk, ctl) { prog.recv += chunk.byteLength; report(false); ctl.enqueue(chunk); },
  });
  const reader = res.body.pipeThrough(counter).pipeThrough(new DecompressionStream('deflate')).getReader();
  const jobs = [];
  const parser = new RecordParser((batch) => {
    jobs.push(pool.run({ ...batch, session: my }).then((r) => {
      if (!r || my !== session) return;
      prog.chunks += r.chunks;
      prog.tris += addBatchMeshes(group, r, batch.origin, lod.scale);
      report(false);
    }));
  });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (my !== session) { reader.cancel(); await Promise.all(jobs); abandon(); return; }
    parser.push(value);
  }
  parser.flush();
  state.timings.downloaded = performance.now() - T0;
  await Promise.all(jobs);
  if (my !== session) { abandon(); return; }
  if (current) { scene.remove(current.group); disposeGroup(current.group); }
  group.visible = true;
  uniforms.uVoxel.value = lod.scale;
  current = { lod, group, tris: prog.tris };
  loadingLevel = null;
  state.lod = level;
  state.timings.meshed = performance.now() - T0;
  state.timings.lodLoadMs = performance.now() - tStart;
  report(true);
  renderNow();
  updateLodText(lod, state.triangles || prog.tris, state.drawCalls);
  updateQualityButtons();
  ui.setProgress(1, `LOD${level} 已加载 · ${fmtM(prog.tris)} 三角形 · ${(state.timings.lodLoadMs / 1000).toFixed(1)} 秒`);
  setTimeout(() => { if (loadingLevel === null && !state.error) ui.hideProgress(); }, SHOT ? 0 : 1800);
}

// ---------------------------------------------------------------------------------------------
// LOD choice

const estTris = (l) => 2 * (l.quadsEst || l.faces * 0.5);

function pickLevel(quality) {
  const budget = QUALITIES[quality].budget * (COARSE ? 0.5 : 1);
  const lods = [...model.stats.lods].sort((a, b) => a.level - b.level);
  for (const l of lods) if (estTris(l) <= budget) return l.level;
  return lods[lods.length - 1].level;
}

function updateQualityButtons() {
  for (const b of $('quality').querySelectorAll('button')) {
    const q = b.dataset.q;
    const lvl = pickLevel(q);
    b.classList.toggle('on', state.quality === q);
    b.querySelector('small').textContent = `L${lvl}`;
    b.title = `三角形预算 ${fmtM(QUALITIES[q].budget * (COARSE ? 0.5 : 1))} → LOD${lvl}（约 ${fmtM(estTris(model.stats.lods.find((l) => l.level === lvl)))} 三角形）`;
  }
}

function setQuality(q) {
  state.quality = q;
  updateQualityButtons();
  const level = pickLevel(q);
  loadLevel(level).catch(fail);
}

function fail(err) {
  console.error(err);
  ui.error(err && err.message ? err.message : String(err));
}

// ---------------------------------------------------------------------------------------------

async function main() {
  setupPanelToggle();
  const slug = params.get('model');
  if (!slug) return showGallery();
  if (!/^[\w\-./]+$/.test(slug) || slug.split('/').some((s) => s === '..' || s === '.' || s === '')) throw new Error('非法的模型名');
  state.slug = slug;
  if (typeof DecompressionStream === 'undefined') throw new Error('浏览器不支持 DecompressionStream，请使用新版 Chrome / Edge / Firefox / Safari');
  ui.setProgress(0.005, '读取模型信息…');
  const stats = await fetchJson(new URL(`../models/${slug}/stats.json`, location.href));
  state.timings.stats = performance.now() - T0;
  showInfo(stats);
  if (!stats.lods || !stats.lods.length) {
    throw new Error(stats.status === 'ok' ? '模型没有数据' : `构建${stats.status === 'timeout' ? '超时' : '失败'}：${String(stats.error || '').split('\n')[0]}`);
  }
  const palette = stats.palette && stats.palette.length ? stats.palette : CORE_PALETTE;
  initRenderer(stats, palette);
  const nWorkers = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  pool = new MeshPool(nWorkers, palette.filter((p) => p.transparent).map((p) => p.id));

  const view = ['iso', 'aerial', 'close'].includes(params.get('view')) ? params.get('view') : 'iso';
  const cam = (params.get('cam') || '').split(',').map(Number);
  if (cam.length === 6 && cam.every(Number.isFinite)) {
    camera.position.set(cam[0], cam[1], cam[2]);
    controls.target.set(cam[3], cam[4], cam[5]);
    camera.lookAt(controls.target);
    controls.update();
  } else {
    setView(view);
  }
  for (const b of $('views').querySelectorAll('button')) b.addEventListener('click', () => setView(b.dataset.v));
  for (const b of $('quality').querySelectorAll('button')) b.addEventListener('click', () => setQuality(b.dataset.q));

  const lodParam = params.get('lod');
  const forced = lodParam !== null && lodParam !== 'auto' && stats.lods.some((l) => String(l.level) === lodParam) ? Number(lodParam) : null;
  const q = QUALITIES[params.get('quality')] ? params.get('quality') : COARSE ? 'overview' : 'standard';
  if (forced !== null) {
    state.quality = null;
    updateQualityButtons();
    await loadLevel(forced);
  } else {
    state.quality = q;
    updateQualityButtons();
    await loadLevel(pickLevel(q));
  }
  renderNow();
  state.timings.total = performance.now() - T0;
  state.ready = true;
}

main().catch(fail);

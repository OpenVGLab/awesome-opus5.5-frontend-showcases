// Rendering: studio lighting, the live 360° viewer, and an offscreen "baker" that turns the
// procedural shoes into product shots, the homepage hero and on-foot scenes (image URLs).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildShoe, getModelGeometry, buildFootGeometry, shade, mix, lerp, clamp, sstep } from './shoe3d.js';

const V3 = THREE.Vector3;

function setupRenderer(r) {
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
}

function makeEnv(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  pmrem.dispose();
  return env;
}

function studioLights(scene, shadowSize = 1024, span = 0.9) {
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-1.1, 2.7, 1.9);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  const sc = key.shadow.camera;
  sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 0.5; sc.far = 7;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.006; key.shadow.radius = 5;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xfff4ea, 1.0); rim.position.set(1.8, 1.3, -2.3); scene.add(rim);
  const fill = new THREE.HemisphereLight(0xffffff, 0xcfc6ba, 0.45); scene.add(fill);
  return { key, rim, fill };
}

function shadowCatcher(opacity = 0.2, size = 10) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity }));
  m.receiveShadow = true;
  return m;
}

// Soft footprint-shaped contact shadow (cached per silhouette).
const contactCache = new Map();
function contactShadow(G, strength = 1) {
  let tex = contactCache.get(G.id);
  if (!tex) {
    const S = 256, ext = 0.75;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const ring = G.O.P.map((q, i) => q.clone().addScaledVector(G.O.N[i], G.m.sole.flare));
    const px = (x, z, s) => [((x * s + ext) / (2 * ext)) * S, ((z * s + ext) / (2 * ext)) * S];
    const draw = (s, clipFn) => { g.beginPath(); ring.forEach((p, i) => { const [x, y] = px(p.x, p.z, s); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
    if (G.m.sole.heelHeight) {
      g.filter = 'blur(12px)'; g.fillStyle = 'rgba(0,0,0,0.22)'; draw(1.04); g.fill();
      g.save(); g.beginPath(); g.rect(px(-0.02, 0, 1)[0], 0, S, S); g.clip();
      g.filter = 'blur(4px)'; g.fillStyle = 'rgba(0,0,0,0.6)'; draw(0.97); g.fill(); g.restore();
      const [hx, hy] = px(-0.44, 0, 1); g.filter = 'blur(4px)'; g.fillStyle = 'rgba(0,0,0,0.7)'; g.beginPath(); g.ellipse(hx, hy, 9, 11, 0, 0, Math.PI * 2); g.fill();
    } else {
      g.filter = 'blur(13px)'; g.fillStyle = 'rgba(0,0,0,0.42)'; draw(1.07); g.fill();
      g.filter = 'blur(3px)'; g.fillStyle = 'rgba(0,0,0,0.5)'; draw(0.96); g.fill();
    }
    tex = new THREE.CanvasTexture(c);
    contactCache.set(G.id, tex);
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: strength, toneMapped: false, color: 0x000000 }));
  mesh.material.color.set(0xffffff);
  mesh.position.y = 0.0015;
  mesh.renderOrder = -1;
  return mesh;
}

// Sample points of a shoe (in its own frame) for camera framing.
function framePoints(G) {
  const pts = [];
  const add = (geo, step) => { if (!geo) return; const a = geo.getAttribute('position'); for (let i = 0; i < a.count; i += step) pts.push(new V3(a.getX(i), a.getY(i), a.getZ(i))); };
  add(G.upper, 23); add(G.wall, 17); add(G.tongue, 31); add(G.heelBlock, 11);
  return pts;
}

// Place `camera` looking along -dir at the points so they fill `margin` of the frame.
function fitCamera(camera, pts, dir, margin = 0.86, targetHint) {
  const target = targetHint ? targetHint.clone() : new V3();
  if (!targetHint) { pts.forEach((p) => target.add(p)); target.divideScalar(pts.length); }
  let d = 3;
  const q = new V3();
  for (let it = 0; it < 5; it++) {
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of pts) { q.copy(p).project(camera); minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); }
    // re-centre: shift target by the projected centre offset (approximate, in view space)
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d, halfW = halfH * camera.aspect;
    const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0), up = new V3().setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, cx * halfW).addScaledVector(up, cy * halfH);
    const ext = Math.max((maxX - minX) / 2, (maxY - minY) / 2);
    d *= ext / margin;
  }
  camera.position.copy(target).addScaledVector(dir, d);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return { target, dist: d };
}

// ================================================================== live 360° viewer
export class ShoeViewer {
  constructor(host, { onChange } = {}) {
    this.host = host;
    this.onChange = onChange;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    setupRenderer(r);
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setClearColor(0x000000, 0);
    r.domElement.className = 'viewer-canvas';
    host.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.scene.environment = makeEnv(r);
    this.scene.environmentIntensity = 0.9;
    studioLights(this.scene, 2048, 0.95);
    this.scene.add(shadowCatcher(0.18));
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.05, 30);
    this.turntable = new THREE.Group();
    this.scene.add(this.turntable);
    this.yaw = -0.5; this.pitch = 0.2; this.zoom = 1;
    this.goal = null; this.vel = 0; this.auto = false;
    this.dirty = true; this.alive = true;
    this.target = new V3(0, 0.16, 0); this.baseDist = 2.6;
    this._bind();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    const loop = (t) => { if (!this.alive) return; this._tick(t); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  setShoe(spec) {
    if (this.shoe) { this.turntable.remove(this.shoe); this.shoe.userData.dispose(); }
    this.shoe = buildShoe(spec);
    const G = this.shoe.userData.geo;
    this.turntable.clear();
    this.turntable.add(this.shoe, contactShadow(G, 0.85));
    const b = G.bounds;
    this.target.set(0, (b.min.y + b.max.y) * 0.46, 0);
    this.height = b.max.y;
    this.resize();
    this.dirty = true;
  }
  resize() {
    const w = this.host.clientWidth || 600, h = this.host.clientHeight || 450;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // distance that fits a 1.2-wide × (height)-tall subject
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const needW = 1.28 / (2 * t * this.camera.aspect), needH = ((this.height || 0.45) + 0.3) / (2 * t);
    this.baseDist = Math.max(needW, needH);
    this.dirty = true;
  }
  _bind() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, t: performance.now() };
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
      this.goal = null; this.vel = 0; this.setAuto(false, true);
      this.host.classList.add('dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      const now = performance.now(), dt = Math.max(1, now - drag.t);
      this.yaw += dx * 0.011; this.pitch = clamp(this.pitch + dy * 0.006, -1.25, 1.35);
      this.vel = (dx * 0.011) / dt * 16;
      drag = { x: e.clientX, y: e.clientY, t: now };
      this.dirty = true;
    });
    const end = (e) => { if (!drag) return; drag = null; try { el.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ } this.host.classList.remove('dragging'); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0012)); }, { passive: false });
    el.addEventListener('dblclick', () => this.view('side'));
  }
  setZoom(z) { this.zoom = clamp(z, 0.75, 2.4); this.dirty = true; this._emit(); }
  setAuto(on, silent) { this.auto = on; if (!silent || !on) this._emit(); }
  rotateBy(rad) { this.goal = { yaw: this.yaw + rad, pitch: this.pitch }; this.vel = 0; }
  setAngle(deg) { this.yaw = -THREE.MathUtils.degToRad(deg); this.goal = null; this.vel = 0; this.dirty = true; }
  view(name) {
    const V = { side: [-0.0, 0.14], front: [-Math.PI / 2, 0.16], back: [Math.PI / 2, 0.2], medial: [Math.PI, 0.14], top: [-0.2, 1.3], sole: [0.0, -1.2], hero: [-0.5, 0.2] };
    const [y, p] = V[name] || V.hero;
    // shortest way round
    const cur = this.yaw, full = Math.PI * 2;
    const yy = y + Math.round((cur - y) / full) * full;
    this.goal = { yaw: yy, pitch: p }; this.vel = 0; this.setAuto(false);
    if (name === 'side' || name === 'hero') this.zoom = 1;
  }
  get angleDeg() { let a = -THREE.MathUtils.radToDeg(this.yaw) % 360; if (a < 0) a += 360; return a; }
  _emit() { if (this.onChange) this.onChange({ angle: this.angleDeg, auto: this.auto, zoom: this.zoom }); }
  _tick(t) {
    const dt = this.lastT ? Math.min(0.05, (t - this.lastT) / 1000) : 0.016; this.lastT = t;
    let moved = false;
    if (this.goal) {
      const k = 1 - Math.exp(-dt * 7);
      this.yaw += (this.goal.yaw - this.yaw) * k; this.pitch += (this.goal.pitch - this.pitch) * k;
      if (Math.abs(this.goal.yaw - this.yaw) < 0.002 && Math.abs(this.goal.pitch - this.pitch) < 0.002) { this.yaw = this.goal.yaw; this.pitch = this.goal.pitch; this.goal = null; }
      moved = true;
    } else if (this.auto) { this.yaw -= dt * 0.55; moved = true; }
    else if (Math.abs(this.vel) > 0.0004) { this.yaw += this.vel; this.vel *= Math.pow(0.9, dt * 60); moved = true; }
    if (moved) { this.dirty = true; this._emit(); }
    if (!this.dirty || !this.shoe) return;
    this.dirty = false;
    this.turntable.rotation.y = this.yaw;
    const d = this.baseDist / this.zoom;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.camera.position.set(this.target.x, this.target.y + sp * d, this.target.z + cp * d);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.alive = false; cancelAnimationFrame(this.raf); this.ro.disconnect();
    if (this.shoe) this.shoe.userData.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.renderer.domElement.remove();
  }
}

// ================================================================== scene props for on-foot looks
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const floorCache = new Map();
function floorTexture(kind) {
  if (floorCache.has(kind)) return floorCache.get(kind);
  const R = rng(kind.length * 131);
  let t;
  if (kind === 'concrete') {
    t = canvasTex(1024, 1024, (g, w, h) => {
      g.fillStyle = '#b9b5ae'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26000; i++) { const v = 150 + R() * 70; g.fillStyle = `rgba(${v},${v - 3},${v - 8},${0.08 + R() * 0.12})`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); }
      for (let i = 0; i < 60; i++) { const v = 120 + R() * 60; g.fillStyle = `rgba(${v},${v},${v},0.06)`; g.beginPath(); g.arc(R() * w, R() * h, 20 + R() * 90, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(70,66,60,0.55)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    }, [1, 1]);
  } else if (kind === 'wood') {
    t = canvasTex(1024, 1024, (g, w, h) => {
      const planks = 6, ph = h / planks;
      for (let p = 0; p < planks; p++) {
        const base = [164 + R() * 30, 116 + R() * 22, 76 + R() * 16];
        g.fillStyle = `rgb(${base.map(Math.round).join(',')})`; g.fillRect(0, p * ph, w, ph);
        for (let k = 0; k < 70; k++) {
          const y = p * ph + R() * ph, a = 0.05 + R() * 0.12;
          g.strokeStyle = `rgba(70,40,20,${a})`; g.lineWidth = 0.6 + R() * 1.6;
          g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + k) * 3 + (R() - 0.5) * 1.5); g.stroke();
        }
        g.fillStyle = 'rgba(40,24,12,0.55)'; g.fillRect(0, p * ph, w, 3);
        const cut = R() * w; g.fillRect(cut, p * ph, 3, ph);
      }
    }, [1, 1]);
  } else if (kind === 'terrazzo') {
    t = canvasTex(1024, 1024, (g, w, h) => {
      g.fillStyle = '#ece8e1'; g.fillRect(0, 0, w, h);
      const cols = ['#c9765a', '#6f8f86', '#d9b36c', '#8c8c8c', '#3f4a52', '#e7a38f'];
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = cols[Math.floor(R() * cols.length)]; g.globalAlpha = 0.55 + R() * 0.4;
        const x = R() * w, y = R() * h, r = 2 + R() * 9;
        g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + R(); const rr = r * (0.6 + R() * 0.6); k ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill();
      }
      g.globalAlpha = 1;
    }, [1, 1]);
  }
  floorCache.set(kind, t);
  return t;
}

function fabricTexture(kind, color) {
  const R = rng(7);
  if (kind === 'denim') {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = color; g.fillRect(0, 0, w, h);
      for (let i = -h; i < w; i += 4) { g.strokeStyle = `rgba(255,255,255,${0.05 + R() * 0.06})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); }
      for (let i = 0; i < 9000; i++) { const v = R() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${R() * 0.07})`; g.fillRect(R() * w, R() * h, 2, 1); }
    }, [3, 3]);
  }
  // heather knit (joggers / chinos)
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16000; i++) { const v = R() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${R() * 0.08})`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1); }
  }, [3, 3]);
}

function legTexture(sock, skin, sockFrac, cuffFrac) {
  return canvasTex(256, 1024, (g, w, h) => {
    g.fillStyle = skin; g.fillRect(0, 0, w, h);
    if (sock) {
      const top = h * (1 - sockFrac);
      g.fillStyle = sock; g.fillRect(0, top, w, h - top);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let x = 0; x < w; x += 6) g.fillRect(x, top, 2, h - top);
      g.fillStyle = shade(sock, -0.1); g.fillRect(0, top, w, h * cuffFrac);
      g.fillStyle = 'rgba(0,0,0,0.1)'; for (let x = 0; x < w; x += 4) g.fillRect(x, top, 2, h * cuffFrac);
    }
  });
}

// Lofted tube through elliptical sections; `ring0` optionally supplies the first section.
function loftTube(sections, K, ring0, { flipV = false, bulge = 0 } = {}) {
  const cols = [];
  for (let k = 0; k < K; k++) {
    const th = (k / K) * Math.PI * 2;
    const pts = [];
    if (ring0) pts.push(ring0[k].clone());
    for (const [y, cx, ax, az, cz = 0, b = 0] of sections) {
      const back = Math.max(0, -Math.cos(th));
      const s = 1 + (b || bulge) * back * back;
      pts.push(new V3(cx + ax * Math.cos(th) * (Math.cos(th) < 0 ? s : 1), y, cz + az * Math.sin(th)));
    }
    cols.push(new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
  }
  const RS = 40;
  const rows = [];
  for (let r = 0; r <= RS; r++) rows.push(cols.map((c) => c.getPoint(r / RS)));
  const pos = [], nor = [], uv = [], idx = [];
  const a = new V3(), b = new V3(), n = new V3();
  const avgY = (row) => row.reduce((s, p) => s + p.y, 0) / row.length;
  const y0 = avgY(rows[0]), y1 = avgY(rows[RS]);
  for (let r = 0; r <= RS; r++) for (let k = 0; k < K; k++) {
    const p = rows[r][k];
    pos.push(p.x, p.y, p.z);
    a.subVectors(rows[Math.min(RS, r + 1)][k], rows[Math.max(0, r - 1)][k]);
    b.subVectors(rows[r][(k + 1) % K], rows[r][(k - 1 + K) % K]);
    n.crossVectors(a, b).normalize();
    nor.push(n.x, n.y, n.z);
    const v = clamp((p.y - y0) / (y1 - y0), 0, 1);
    uv.push(k / K, flipV ? 1 - v : v);
  }
  for (let r = 0; r < RS; r++) for (let k = 0; k < K; k++) {
    const k2 = (k + 1) % K, i0 = r * K + k, i1 = (r + 1) * K + k, i2 = (r + 1) * K + k2, i3 = r * K + k2;
    idx.push(i0, i1, i3, i1, i2, i3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// A leg (+ optional foot surface for low-cut shoes) and trousers, in the shoe's frame.
function buildLeg(G, look, disposables) {
  const grp = new THREE.Group();
  const low = ['flat', 'pump'].includes(G.m.style);
  const K = 48;
  let ring0 = null, yStart, cx0 = -0.24;
  const skinMat = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.58 });
  disposables.push(skinMat);
  if (low) {
    const foot = buildFootGeometry(G.id);
    const fm = new THREE.Mesh(foot.geo, skinMat); fm.castShadow = true; fm.receiveShadow = true; grp.add(fm);
    disposables.push(foot.geo);
    ring0 = []; for (let k = 0; k < K; k++) ring0.push(foot.loop.at((k / K) * foot.loop.L));
    yStart = ring0.reduce((s, p) => s + p.y, 0) / K;
    cx0 = ring0.reduce((s, p) => s + p.x, 0) / K;
  } else {
    yStart = G.F.foot(-0.24) + 0.06;
  }
  const y0 = low ? yStart : G.F.foot(-0.24) + 0.2;
  const secs = [
    [y0 + 0.1, cx0 - 0.01, 0.125, 0.102],
    [y0 + 0.28, cx0 - 0.018, 0.13, 0.104],
    [y0 + 0.5, cx0 - 0.025, 0.16, 0.13, 0, 0.12],
    [y0 + 0.8, cx0 - 0.03, 0.2, 0.168, 0, 0.2],
    [y0 + 1.1, cx0 - 0.03, 0.205, 0.176, 0, 0.14],
    [y0 + 1.45, cx0 - 0.02, 0.19, 0.175],
    [y0 + 1.9, cx0 - 0.01, 0.2, 0.19],
  ];
  if (!low) secs.unshift([yStart, cx0, 0.118, 0.096]);
  const yTop = secs[secs.length - 1][0];
  const sockTop = look.sock ? (look.sockH ?? 0.36) : 0;
  const legMat = new THREE.MeshStandardMaterial({ map: legTexture(look.sock, look.skin, clamp((y0 + sockTop - yStart) / (yTop - yStart), 0, 1), 0.02), roughness: 0.62 });
  disposables.push(legMat, legMat.map);
  const leg = new THREE.Mesh(loftTube(secs, K, ring0), legMat);
  leg.castShadow = true; leg.receiveShadow = true;
  grp.add(leg);
  disposables.push(leg.geometry);
  if (look.pants) {
    const hem = y0 + (look.hemH ?? 0.42);
    const e = look.fit === 'wide' ? 0.09 : look.fit === 'slim' ? 0.035 : 0.06;
    const c = cx0 - 0.02;
    const ps = [];
    if (look.cuff) {
      ps.push([hem, c, 0.14 + e, 0.125 + e], [hem + 0.004, c, 0.152 + e, 0.137 + e], [hem + 0.06, c, 0.154 + e, 0.139 + e], [hem + 0.064, c, 0.142 + e, 0.127 + e]);
    } else {
      ps.push([hem, c, 0.138 + e, 0.123 + e], [hem + 0.02, c, 0.14 + e, 0.125 + e]);
    }
    ps.push([hem + 0.3, c - 0.01, 0.16 + e, 0.145 + e], [hem + 0.7, c - 0.02, 0.215 + e, 0.19 + e], [hem + 1.2, c - 0.02, 0.24 + e, 0.22 + e], [hem + 1.8, c - 0.01, 0.26 + e, 0.25 + e]);
    const tex = fabricTexture(look.pants.kind, look.pants.color);
    const pm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
    disposables.push(pm, tex);
    const pants = new THREE.Mesh(loftTube(ps, K, null), pm);
    pants.castShadow = true; pants.receiveShadow = true;
    grp.add(pants);
    disposables.push(pants.geometry);
  }
  return grp;
}

const LOOKS = {
  denim: { skin: '#d9a88b', sock: '#f3f1ec', sockH: 0.3, pants: { kind: 'denim', color: '#3d5a86' }, cuff: true, hemH: 0.34, fit: 'reg' },
  jogger: { skin: '#c68e6d', sock: '#2b2b2b', sockH: 0.3, pants: { kind: 'knit', color: '#6d6f73' }, cuff: false, hemH: 0.3, fit: 'slim' },
  chino: { skin: '#e2b598', sock: '#c9b9a0', sockH: 0.28, pants: { kind: 'knit', color: '#bfa57e' }, cuff: true, hemH: 0.36, fit: 'reg' },
  wide: { skin: '#e9bfa2', sock: null, pants: { kind: 'knit', color: '#2f3237' }, cuff: false, hemH: 0.5, fit: 'wide' },
  bare: { skin: '#e3b393', sock: null, pants: null },
  kid: { skin: '#e8bb9c', sock: '#ffd84a', sockH: 0.3, pants: null },
  boot: { skin: '#d9a88b', sock: '#4a423b', sockH: 0.62, pants: { kind: 'denim', color: '#2c3a52' }, cuff: true, hemH: 0.5, fit: 'wide' },
};

export function lookFor(spec) {
  const st = spec.model;
  if (st === 'flat' || st === 'pump') return spec.gender === 'women' && st === 'pump' ? LOOKS.wide : LOOKS.bare;
  if (st === 'kids') return LOOKS.kid;
  if (st === 'hiker' || st === 'chelsea') return LOOKS.boot;
  if (st === 'hightop') return LOOKS.jogger;
  if (st === 'slipon') return LOOKS.chino;
  return spec.gender === 'women' ? LOOKS.jogger : LOOKS.denim;
}

export const ONFOOT_PRESETS = [
  { id: 'stand', label: 'Standing · side' },
  { id: 'walk', label: 'Mid-stride' },
  { id: 'back', label: 'From behind' },
  { id: 'top', label: 'Front, high angle' },
];

// ================================================================== baker
export class Baker {
  constructor() {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }));
    setupRenderer(r);
    r.setPixelRatio(1);
    this.env = makeEnv(r);
    this.queue = [];
    this.cache = new Map();
    this.busy = false;
    this.studio = new THREE.Scene();
    this.studio.environment = this.env;
    this.studio.environmentIntensity = 0.9;
    studioLights(this.studio, 1536, 1.1);
    this.studio.add(shadowCatcher(0.2));
    this.camera = new THREE.PerspectiveCamera(22, 4 / 3, 0.05, 40);
  }
  // Returns a promise of an object URL; identical keys are rendered once.
  request(key, job, priority = 0) {
    if (this.cache.has(key)) { this.bump(key, priority); return this.cache.get(key); }
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    p.key = key;
    this.cache.set(key, p);
    this.queue.push({ key, job, priority, resolve, reject, seq: this.queue.length + Math.random() });
    this._pump();
    return p;
  }
  bump(key, priority) { const q = this.queue.find((j) => j.key === key); if (q) q.priority = Math.max(q.priority, priority); }
  async _pump() {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      this.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
      const j = this.queue.shift();
      await new Promise((r) => setTimeout(r, 0));
      try { j.resolve(await j.job()); } catch (e) { console.warn('bake failed', j.key, e); j.reject(e); }
    }
    this.busy = false;
  }
  // Resizing the canvas reallocates the (multisampled) drawing buffer, so only do it on change.
  _size(w, h) {
    if (this._w === w && this._h === h) return;
    this.renderer.setSize(w, h, false);
    this._w = w; this._h = h;
  }
  _snap(w, h) {
    return new Promise((res) => this.renderer.domElement.toBlob((b) => res(URL.createObjectURL(b)), 'image/png'));
  }
  product(spec, { w = 720, h = 540, yaw = -0.3, pitch = 0.16, margin = 0.84, priority = 0, tag = '' } = {}) {
    const key = `p:${spec.id}:${w}x${h}:${yaw}:${pitch}${tag}`;
    return this.request(key, async () => {
      const shoe = buildShoe(spec, { tex: 1024 });
      const G = shoe.userData.geo;
      const holder = new THREE.Group();
      holder.add(shoe, contactShadow(G, 0.9));
      holder.rotation.y = yaw;
      this.studio.add(holder);
      this._size(w, h);
      this.renderer.setClearColor(0x000000, 0);
      this.camera.aspect = w / h; this.camera.fov = 22; this.camera.updateProjectionMatrix();
      holder.updateMatrixWorld(true);
      const pts = framePoints(G).map((p) => p.applyMatrix4(holder.matrixWorld));
      const dir = new V3(0, Math.sin(pitch), Math.cos(pitch));
      fitCamera(this.camera, pts, dir, margin);
      this.renderer.render(this.studio, this.camera);
      const url = await this._snap(w, h);
      this.studio.remove(holder);
      shoe.userData.dispose({ keepMaterials: true });
      holder.children[1].geometry.dispose();
      return url;
    }, priority);
  }
  hero(specA, specB, { w = 1200, h = 860, priority = 5 } = {}) {
    const key = `hero:${specA.id}:${specB.id}:${w}x${h}`;
    return this.request(key, async () => {
      const a = buildShoe(specA, { tex: 1536 }), b = buildShoe(specB, { tex: 1536 });
      const ga = new THREE.Group(), gb = new THREE.Group();
      ga.add(a, contactShadow(a.userData.geo, 0.9)); gb.add(b, contactShadow(b.userData.geo, 0.9));
      ga.position.set(0.3, 0, 0.34); ga.rotation.y = -0.62;
      gb.position.set(-0.56, 0, -0.42); gb.rotation.y = 2.78;
      this.studio.add(ga, gb);
      this._size(w, h);
      this.renderer.setClearColor(0x000000, 0);
      this.camera.aspect = w / h; this.camera.fov = 24; this.camera.updateProjectionMatrix();
      ga.updateMatrixWorld(true); gb.updateMatrixWorld(true);
      const pts = [...framePoints(a.userData.geo).map((p) => p.applyMatrix4(ga.matrixWorld)), ...framePoints(b.userData.geo).map((p) => p.applyMatrix4(gb.matrixWorld))];
      fitCamera(this.camera, pts, new V3(0.06, Math.sin(0.26), Math.cos(0.26)).normalize(), 0.84);
      this.renderer.render(this.studio, this.camera);
      const url = await this._snap(w, h);
      this.studio.remove(ga, gb);
      a.userData.dispose({ keepMaterials: true }); b.userData.dispose({ keepMaterials: true });
      return url;
    }, priority);
  }
  onFoot(spec, preset, { w = 900, h = 900, priority = 1 } = {}) {
    const key = `f:${spec.id}:${preset}:${w}x${h}`;
    return this.request(key, async () => {
      const disposables = [];
      const scene = new THREE.Scene();
      scene.environment = this.env;
      scene.environmentIntensity = 0.75;
      const G = getModelGeometry(spec.model);
      const look = lookFor(spec);
      const right = buildShoe(spec, { tex: 1024 });
      const mk = (shoe, mirror) => {
        const foot = new THREE.Group();
        foot.add(shoe, buildLeg(G, look, disposables));
        if (mirror) foot.scale.z = -1;
        return foot;
      };
      const R = mk(right, false), L = mk(right.clone(), true);
      const pair = new THREE.Group();
      pair.add(R, L);
      scene.add(pair);
      const tint = spec.colors.bg || mix(spec.colors.upper || '#dddddd', '#f1ede6', 0.78);
      let floorKind = null, bg = tint;
      const cam = this.camera;
      cam.aspect = w / h; cam.fov = 30; cam.updateProjectionMatrix();
      // stance
      if (preset === 'stand') {
        R.position.set(-0.04, 0, 0.2); R.rotation.y = -0.08;
        L.position.set(0.3, 0, -0.26); L.rotation.y = 0.2;
      } else if (preset === 'walk') {
        R.position.set(0.3, 0, 0.18); R.rotation.y = -0.1;
        // trailing foot: heel lifted by rotating about its toe
        const toeX = 0.47;
        const pivot = new THREE.Group(); pivot.position.set(-0.46 + toeX, G.F.ground(toeX) * 0.5, -0.2); pivot.rotation.set(0, 0.05, 0);
        const tilt = new THREE.Group(); tilt.rotation.z = -0.36; pivot.add(tilt);
        pair.remove(L); tilt.add(L); L.position.set(-toeX, 0, 0);
        pair.add(pivot);
        floorKind = 'concrete';
      } else if (preset === 'back') {
        R.position.set(0.0, 0, 0.2); L.position.set(0.06, 0, -0.2); R.rotation.y = -0.1; L.rotation.y = 0.1;
        floorKind = 'wood';
      } else {
        R.position.set(0.0, 0, 0.2); L.position.set(-0.06, 0, -0.2); R.rotation.y = -0.16; L.rotation.y = 0.16;
        floorKind = 'terrazzo';
      }
      // floor / backdrop
      let floorMat;
      if (floorKind) {
        const ft = floorTexture(floorKind);
        floorMat = new THREE.MeshStandardMaterial({ map: ft, roughness: floorKind === 'wood' ? 0.55 : 0.9 });
        bg = floorKind === 'concrete' ? '#d9d5cf' : floorKind === 'wood' ? '#e9dfd2' : '#efece6';
      } else {
        floorMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.95 });
      }
      disposables.push(floorMat);
      const floorGeo = new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2);
      if (floorKind) { const uv = floorGeo.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (floorKind === 'wood' ? 6 : 8), uv.getY(i) * (floorKind === 'wood' ? 6 : 8)); }
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.receiveShadow = true; scene.add(floor);
      disposables.push(floorGeo);
      if (!floorKind) {
        // seamless cove backdrop
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshStandardMaterial({ color: tint, roughness: 1 }));
        wall.position.set(0, 3, -2.2); wall.receiveShadow = true; scene.add(wall);
        disposables.push(wall.geometry, wall.material);
      }
      scene.background = new THREE.Color(bg);
      scene.fog = new THREE.Fog(bg, 4.5, 10);
      const key = new THREE.DirectionalLight(0xfff6ec, 2.2);
      key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
      const sc = key.shadow.camera; sc.left = -1.8; sc.right = 1.8; sc.top = 2.2; sc.bottom = -1.2; sc.near = 0.5; sc.far = 12;
      key.shadow.bias = -0.0005; key.shadow.normalBias = 0.01; key.shadow.radius = 4;
      const hemi = new THREE.HemisphereLight(0xffffff, bg, 0.5);
      scene.add(key, key.target, hemi);
      let camPos, camTarget;
      if (preset === 'stand') { key.position.set(-1.6, 3.4, 2.4); camPos = new V3(0.3, 0.8, 3.3); camTarget = new V3(0.06, 0.4, 0); cam.fov = 25; }
      else if (preset === 'walk') { key.position.set(2.2, 3.6, 1.8); camPos = new V3(2.3, 0.66, 2.5); camTarget = new V3(-0.02, 0.4, 0); cam.fov = 26; }
      else if (preset === 'back') { key.position.set(1.2, 3.2, 2.6); camPos = new V3(-2.5, 0.75, 1.0); camTarget = new V3(-0.1, 0.4, 0); cam.fov = 28; }
      else { key.position.set(-0.8, 4.2, 2.2); camPos = new V3(2.3, 1.75, 0.55); camTarget = new V3(0.05, 0.28, 0.0); cam.fov = 28; }
      cam.updateProjectionMatrix();
      cam.position.copy(camPos); cam.up.set(0, 1, 0); cam.lookAt(camTarget);
      this._size(w, h);
      this.renderer.setClearColor(bg, 1);
      this.renderer.render(scene, cam);
      const url = await this._snap(w, h);
      right.userData.dispose({ keepMaterials: true });
      disposables.forEach((d) => { if (d.dispose && !d.isMaterial) d.dispose(); });
      return url;
    }, priority);
  }
}

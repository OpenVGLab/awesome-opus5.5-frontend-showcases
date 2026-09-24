import * as THREE from 'three';
import { audio } from './audio.js';
import { FX } from './fx.js';
import { Environment } from './env.js';
import { Models } from './models.js';
import { createPost } from './post.js';
import { Game, BOUNDS } from './game.js';
import { HUD } from './hud.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

let gpuName = '';
try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); gpuName = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''; } catch (e) { gpuName = ''; }
const software = /swiftshader|llvmpipe|software/i.test(gpuName);
const maxPR = Math.min(window.devicePixelRatio || 1, 1.5);
let pixelRatio = maxPR;
let W = window.innerWidth, H = window.innerHeight;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(W, H, false);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0d1c, 0.0024);
const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 6000);
camera.position.set(8, 2, 8);

scene.add(new THREE.HemisphereLight(0x8fa6ff, 0x1a0f24, 0.9));
const key = new THREE.DirectionalLight(0xfff0e0, 2.5); key.position.set(40, 60, 60); scene.add(key);
const rim = new THREE.DirectionalLight(0x5fd8ff, 1.7); rim.position.set(-50, 20, -80); scene.add(rim);
const under = new THREE.DirectionalLight(0xff5aa8, 0.5); under.position.set(0, -60, 10); scene.add(under);

const env = new Environment(renderer, scene);
const models = new Models(env.envMap);
const fx = new FX(scene);
const hud = new HUD();
const post = createPost(renderer, scene, camera, W, H, software ? 0 : 4);
const game = new Game({ scene, camera, fx, env, audio, models, hud });
env.onGatePass = () => audio.whoosh(game.phase === 'boost' ? 1.2 : 0.8);
env.setWorld(false);

// ------------------------------------------------------------------ input
const keys = Object.create(null);
let mouseDown = false, lastMouse = -10, paused = false;
const touches = new Map();
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

function unlockAudio() {
  const first = !audio.ctx;
  audio.init();
  if (first && game.state === 'title') audio.playSong('title');
}

function primary() {
  unlockAudio();
  if (game.state === 'title') game.startGame();
  else if (game.state === 'continue') game.continueGame();
  else if (game.state === 'result' && game.stateT > 1.2) { hud.hideResult(); game.toTitle(); }
}

function setPause(v) {
  if (v === paused || !['play', 'intro', 'dead'].includes(game.state)) return;
  paused = v; hud.pause(v); audio.suspend(v);
}

addEventListener('keydown', (e) => {
  if (PREVENT.has(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'KeyM') { unlockAudio(); audio.setMuted(!audio.muted); hud.sound(!audio.muted); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.state === 'continue' && e.code === 'Escape') { game.giveUp(); return; }
    setPause(!paused); return;
  }
  if (paused) return;
  if (['Enter', 'Space', 'KeyZ'].includes(e.code)) primary();
  else unlockAudio();
  if ((e.code === 'KeyX' || e.code === 'KeyK') && game.state === 'play') game.input.laser = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });

const app = document.getElementById('app');
app.addEventListener('contextmenu', (e) => e.preventDefault());
app.addEventListener('pointerdown', (e) => {
  if (e.target.id === 'sndBtn') { unlockAudio(); audio.setMuted(!audio.muted); hud.sound(!audio.muted); return; }
  if (paused) { setPause(false); return; }
  if (e.pointerType === 'mouse') {
    if (e.button === 2) { unlockAudio(); if (game.state === 'play') game.input.laser = true; return; }
    if (game.state === 'play' || game.state === 'intro') { unlockAudio(); mouseDown = true; lastMouse = performance.now(); game.input.mx = e.clientX; game.input.my = e.clientY; }
    else primary();
    return;
  }
  e.preventDefault();
  if (!['play', 'intro'].includes(game.state)) { primary(); return; }
  unlockAudio();
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size >= 2) { game.input.laser = true; return; }
  const p = game.player.p;
  game.input.drag = { sx: e.clientX, sy: e.clientY, px: p.x, py: p.y, tx: p.x, ty: p.y, id: e.pointerId };
});
app.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') { game.input.mx = e.clientX; game.input.my = e.clientY; lastMouse = performance.now(); return; }
  const d = game.input.drag;
  if (d && d.id === e.pointerId) {
    const k = 34 / Math.min(W, H * 1.3);
    d.tx = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, d.px + (e.clientX - d.sx) * k));
    d.ty = Math.max(BOUNDS.yMin, Math.min(BOUNDS.yMax, d.py - (e.clientY - d.sy) * k));
  }
});
const endPointer = (e) => {
  if (e.pointerType === 'mouse') { if (e.button === 0) mouseDown = false; return; }
  touches.delete(e.pointerId);
  if (game.input.drag && game.input.drag.id === e.pointerId) game.input.drag = null;
};
app.addEventListener('pointerup', endPointer);
app.addEventListener('pointercancel', endPointer);
if (matchMedia('(pointer: coarse)').matches) {
  const ctl = document.getElementById('ctrlList');
  ctl.innerHTML = '<dt>移動</dt><dd>画面をドラッグ（自動連射）</dd><dt>ホーミングレーザー</dt><dd>2本指タップ（ゲージ満タン時）</dd><dt>照準</dt><dd>自動ロックオン</dd>';
}

function readInput() {
  const inp = game.input;
  inp.x = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  inp.y = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0);
  inp.slow = !!(keys.ShiftLeft || keys.ShiftRight);
  inp.fire = !!(keys.KeyZ || keys.Space || keys.KeyJ || mouseDown);
  inp.mouseAim = mouseDown || performance.now() - lastMouse < 2500;
}

// ------------------------------------------------------------------ camera
const camPos = new THREE.Vector3(8, 2, 8), camLook = new THREE.Vector3(0, 0, -2);
const tPos = new THREE.Vector3(), tLook = new THREE.Vector3(), oPos = new THREE.Vector3(), oLook = new THREE.Vector3();
const smooth = (t) => t * t * (3 - 2 * t);
function updateCamera(dt) {
  const pl = game.player.p, c = game.cine;
  tPos.set(pl.x * 0.72, pl.y * 0.6 + 3.3, 14 + c.kick * 7);
  tLook.set(pl.x * 0.85, pl.y * 0.7 + 1.0, -40);
  if (game.state === 'title' || (game.state === 'intro' && !game.warped)) {
    const a = game.time * 0.22 + 0.9;
    oPos.set(Math.sin(a) * 9.5, 2.2 + Math.sin(a * 0.7) * 1.4, Math.cos(a) * 9.5 - 1);
    oLook.set(0, 0.2, -1.5);
    const b = game.state === 'intro' ? smooth(Math.min(1, game.stateT / 3.2)) : 0;
    tPos.lerpVectors(oPos, tPos, b); tLook.lerpVectors(oLook, tLook, b);
  }
  if (game.state === 'title') { camPos.copy(tPos); camLook.copy(tLook); }
  else {
    const k = 1 - Math.exp(-dt * (game.state === 'intro' && !game.warped ? 12 : 6));
    camPos.lerp(tPos, k); camLook.lerp(tLook, k);
  }
  const s = c.shake * c.shake * 1.1;
  camera.position.set(camPos.x + (Math.random() - 0.5) * s, camPos.y + (Math.random() - 0.5) * s, camPos.z);
  const roll = -game.player.bank * 0.12;
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(camLook);
  const aspect = W / H;
  let fov = c.fov;
  if (aspect < 1.35) fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 1.35 / aspect));
  const wide = aspect > 1.2 ? 0.27 : 0;
  const shift = game.state === 'title' ? wide : game.state === 'intro' && !game.warped ? wide * (1 - smooth(Math.min(1, game.stateT / 2.2))) : 0;
  let dirty = Math.abs(camera.fov - fov) > 0.01 || camera.aspect !== aspect || Math.abs(shift - viewShift) > 1e-4;
  viewShift = shift;
  if (dirty) {
    camera.fov = fov; camera.aspect = aspect;
    if (viewShift > 1e-4) camera.setViewOffset(W, H, -viewShift * W, 0, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
}
let viewShift = -1;

function updateScales() {
  const px = (H * pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  fx.setScale(px);
  game.ebUni.uScale.value = px;
}

function updatePost() {
  const u = post.u, c = game.cine;
  u.uTime.value = game.time;
  u.uBlur.value = c.blur;
  u.uLines.value = c.lines;
  u.uFlash.value = Math.min(1, c.flash);
  u.uFlashCol.value.set(c.flashCol[0], c.flashCol[1], c.flashCol[2]);
  const low = game.state === 'play' && game.player.alive && game.shield <= 1 ? 0.22 + 0.12 * Math.sin(game.time * 8) : 0;
  u.uDamage.value = Math.min(1, c.damage + low);
  u.uWarp.value = c.warp + (c.speed > 700 ? 0.35 : 0);
  u.uAberr.value = 0.0008 + c.warp * 0.006 + c.shake * 0.0025 + (game.phase === 'boost' ? 0.0025 : 0);
  post.bloom.strength = 0.75 + Math.min(1, c.flash) * 0.45;
}

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(W, H, false);
  post.setSize(W, H, pixelRatio);
  env.resize(W, H, pixelRatio);
  updateCamera(0);
  updateScales();
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ loop
const STEP = 1 / 120;
let last = performance.now(), acc = 0, timeScale = 1, maxSteps = 12;
let perfT = 0, perfN = 0, fpsNow = 60, lowStreak = 0;
function frame() {
  const now = performance.now();
  const raw = (now - last) / 1000, dt = Math.min(0.1, raw);
  last = now;
  if (!paused) {
    readInput();
    acc += dt * timeScale;
    let n = 0;
    while (acc >= STEP && n < maxSteps) { game.update(STEP); acc -= STEP; n++; }
    if (n >= maxSteps) acc = 0;
    const fdt = Math.min(dt * timeScale, maxSteps * STEP);
    updateCamera(fdt);
    env.update(fdt, game.cine.speed, camera, game.cine.tunnel);
    game.updateAim(camera, W, H);
    game.sync(fdt, camera);
    fx.update(fdt, camera, game.cine.speed);
    hud.update(game, camera, W, H, fdt);
  }
  updateScales();
  updatePost();
  post.render();
  perfT += raw; perfN++;
  if (perfT >= 2) {
    fpsNow = perfN / perfT; perfT = 0; perfN = 0;
    if (!software && fpsNow < 42 && pixelRatio > 0.75) { if (++lowStreak >= 2) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); lowStreak = 0; resize(); } }
    else lowStreak = 0;
  }
}

env.resize(W, H, pixelRatio);
updateCamera(0);
game.toTitle();
renderer.setAnimationLoop(frame);

// Debug / test hooks (used by the headless self-check).
window.__ws = {
  game, audio, env, fx, post, camera, renderer, gpu: gpuName,
  start() { unlockAudio(); if (game.state === 'title') game.startGame(); },
  god(v = true) { game.god = v; },
  auto(v = true) { game.auto = v; },
  speed(s = 1, steps = 12) { timeScale = s; maxSteps = steps; },
  jump(phase) {
    unlockAudio();
    if (game.state === 'title') game.startGame();
    hud.showTitle(false); hud.hudOn(true);
    if (!game.warped) game.warpOut();
    game.state = 'play'; game.stateT = 0;
    for (const e of game.enemies) { if (e.kind !== 'part') scene.remove(e.obj); e.alive = false; }
    game.enemies = [];
    if (game.boss) { game.boss.destroy(); game.boss = null; }
    game.cancelBullets(null, Infinity, false);
    game.script = [];
    game.setPhase(phase);
    const c = game.cine;
    c.speed = c.speedTarget; c.tunnel = c.tunnelTarget = 0; c.flash = 0; c.blur = 0; c.lines = 0; c.fov = c.fovTarget; c.kick = 0;
    return phase;
  },
  info() {
    return {
      state: game.state, phase: game.phase, phaseT: +game.phaseT.toFixed(2), clock: +game.clock.toFixed(2), score: game.score, shield: game.shield,
      enemies: game.enemies.length, bullets: game.eb.filter((b) => b.alive).length, boss: game.boss ? { kind: game.boss.kind, state: game.boss.state, phase: game.boss.phase, bar: +game.boss.barFrac().toFixed(3) } : null,
      fps: +fpsNow.toFixed(1), pr: pixelRatio, gpu: gpuName, particles: fx.add.active,
    };
  },
};

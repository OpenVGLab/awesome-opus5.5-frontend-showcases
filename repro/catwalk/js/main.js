import * as THREE from 'three';
import { buildStage } from './level.js';
import { STEP } from './physics.js';
import { Game, LIVES } from './game.js';
import { Autopilot } from './autopilot.js';
import { makeTextures } from './textures.js';
import { Cat } from './cat.js';
import { buildWorld } from './world.js';
import { Props } from './props.js';
import { Sky } from './sky.js';
import { LightPool } from './lights.js';
import { Post } from './post.js';
import { AudioEngine } from './audio.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));

// ── palettes per section, blended along the stage ──────────────────────────
const P = (o) => {
  const out = {};
  for (const k in o) out[k] = typeof o[k] === 'number' && k.endsWith('C') ? new THREE.Color(o[k]) : o[k];
  return out;
};
const PALETTES = [
  P({ skyTopC: 0x03061a, skyHorizonC: 0x121632, skyGlowC: 0x2a1c2c, fogC: 0x0a0d1c, hemiSkyC: 0x2a3658, hemiGroundC: 0x2a1a10, hemiI: 0.55, moonC: 0x9fb2ff, moonI: 0.32, rimC: 0x3a4a78, hazeC: 0x141830, cloudC: 0x262a3c, fillC: 0xffc890, fog: 0.02, exposure: 1.0 }),
  P({ skyTopC: 0x07041a, skyHorizonC: 0x221230, skyGlowC: 0x3e1a2c, fogC: 0x130a1a, hemiSkyC: 0x3a2a4a, hemiGroundC: 0x3a1a0c, hemiI: 0.5, moonC: 0xb0a6ff, moonI: 0.28, rimC: 0x6a3a4a, hazeC: 0x1e1226, cloudC: 0x2c2238, fillC: 0xffa070, fog: 0.022, exposure: 1.0 }),
  P({ skyTopC: 0x020816, skyHorizonC: 0x0c2032, skyGlowC: 0x103a48, fogC: 0x07141e, hemiSkyC: 0x1a3450, hemiGroundC: 0x2a1030, hemiI: 0.5, moonC: 0x9ad0ff, moonI: 0.3, rimC: 0x2a6a8a, hazeC: 0x0c1c2a, cloudC: 0x1c2c3c, fillC: 0xa0e0ff, fog: 0.015, exposure: 1.02 }),
  P({ skyTopC: 0x050c26, skyHorizonC: 0x22305a, skyGlowC: 0x34466e, fogC: 0x10182c, hemiSkyC: 0x4a5c90, hemiGroundC: 0x1a2030, hemiI: 0.85, moonC: 0xc8d8ff, moonI: 1.1, rimC: 0x6a80b8, hazeC: 0x1a2440, cloudC: 0x3a4460, fillC: 0xd8e4ff, fog: 0.014, exposure: 1.05 }),
];
const PAL = {};
for (const k in PALETTES[0]) PAL[k] = PALETTES[0][k] instanceof THREE.Color ? new THREE.Color() : 0;
function blendPalette(b) {
  const i = Math.min(PALETTES.length - 2, Math.floor(b));
  const f = clamp(b - i, 0, 1);
  const A = PALETTES[i], B = PALETTES[i + 1];
  for (const k in A) {
    if (PAL[k] instanceof THREE.Color) PAL[k].copy(A[k]).lerp(B[k], f);
    else PAL[k] = lerp(A[k], B[k], f);
  }
  PAL.skyTop = PAL.skyTopC; PAL.skyHorizon = PAL.skyHorizonC; PAL.skyGlow = PAL.skyGlowC; PAL.haze = PAL.hazeC; PAL.cloud = PAL.cloudC;
  return PAL;
}
const MOON = [[0.36, 0.2, 0.05], [0.33, 0.18, 0.055], [0.33, 0.17, 0.064], [0.4, 0.2, 0.082]];

// ── setup ─────────────────────────────────────────────────────────────────
const loading = $('loading');
const stage = buildStage();
const game = new Game(stage);
const autopilot = new Autopilot(game);
let autoOn = params.has('auto');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
$('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0d1c, 0.02);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 2500);

const tex = makeTextures();
const sky = new Sky(scene, tex);
const world = buildWorld(scene, stage, tex);
const props = new Props(scene, stage, tex, world);
const cat = new Cat();
scene.add(cat.root);
const pool = new LightPool(scene, 8, 2, 512);
const hemi = new THREE.HemisphereLight(0x2a3658, 0x2a1a10, 0.55);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0x9fb2ff, 0.3);
scene.add(moonLight);
scene.add(moonLight.target);
const fill = new THREE.PointLight(0xffc890, 1.1, 3.4, 2);
scene.add(fill);
const post = new Post(renderer, scene, camera);
const audio = new AudioEngine();

let best = null;
try { best = JSON.parse(localStorage.getItem('catwalk.best') || 'null'); } catch (e) { best = null; }

// ── input ─────────────────────────────────────────────────────────────────
const input = { held: false, pressed: false };
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyX', 'KeyK']);
let paused = false;
let muted = false;

function menuState() {
  return game.state === 'title' || game.state === 'gameover' || (game.state === 'clear' && game.results);
}
function press() {
  audio.init();
  if (paused) { setPaused(false); return; }
  if (menuState()) { startRun(); return; }
  input.pressed = true;
  input.held = true;
}
function release() { input.held = false; }

window.addEventListener('keydown', (e) => {
  if (JUMP_KEYS.has(e.code) || e.code === 'Enter') {
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Enter' && !menuState() && !paused) return;
    press();
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    if (['play', 'ready', 'miss', 'intro'].includes(game.state)) setPaused(!paused);
  } else if (e.code === 'KeyM') {
    toggleMute();
  }
});
window.addEventListener('keyup', (e) => { if (JUMP_KEYS.has(e.code)) release(); });
const surface = $('touch');
surface.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
window.addEventListener('blur', () => { release(); if (game.state === 'play') setPaused(true); });
$('muteBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); audio.init(); toggleMute(); });
$('pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (['play', 'ready', 'miss', 'intro'].includes(game.state)) setPaused(!paused); });

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('muteBtn').classList.toggle('off', muted);
}
function setPaused(v) {
  paused = v;
  $('pause').classList.toggle('show', v);
  audio.setPaused(v);
  if (!v) input.held = false;
}

function startRun() {
  if (game.state !== 'title') props.reset();
  game.start();
  autopilot.reset();
  audio.startMusic();
  $('title').classList.remove('show');
  $('results').classList.remove('show');
  $('gameover').classList.remove('show');
  $('hud').classList.add('show');
  hintT = 0;
}

// ── HUD ───────────────────────────────────────────────────────────────────
const livesEl = $('lives');
for (let i = 0; i < LIVES; i++) {
  const d = document.createElement('i');
  d.innerHTML = '<svg viewBox="0 0 24 20"><path d="M3 1 L8 7 Q12 5.6 16 7 L21 1 L21.6 11 Q21 19 12 19.4 Q3 19 2.4 11 Z"/><circle cx="8.4" cy="11.6" r="1.25" class="e"/><circle cx="15.6" cy="11.6" r="1.25" class="e"/></svg>';
  livesEl.appendChild(d);
}
const railEl = $('rail');
for (const cp of stage.checkpoints) {
  const m = document.createElement('b');
  m.style.left = (cp.x / stage.goal.x) * 100 + '%';
  railEl.appendChild(m);
}
for (const s of stage.sections.slice(1)) {
  const m = document.createElement('u');
  m.style.left = (s.x0 / stage.goal.x) * 100 + '%';
  railEl.appendChild(m);
}
let hintT = 0;
let lastHud = '';
function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
function updateHud() {
  const k = `${game.lives}|${game.fishCount}|${Math.floor(game.runTime * 10)}|${game.section}|${Math.round(game.body.x * 4)}`;
  if (k === lastHud) return;
  lastHud = k;
  [...livesEl.children].forEach((el, i) => el.classList.toggle('lost', i >= game.lives));
  $('fishN').textContent = game.fishCount;
  $('fishT').textContent = stage.fish.length;
  $('timer').textContent = fmtTime(game.runTime);
  $('cursor').style.left = clamp(game.body.x / stage.goal.x, 0, 1) * 100 + '%';
  const sec = stage.sections[game.section];
  $('secName').textContent = `${sec.numeral} · ${sec.name}`;
}
let toastTimer = 0;
function toast(text, cls = '') {
  const el = $('toast');
  el.textContent = text;
  el.className = 'show ' + cls;
  toastTimer = 1.6;
}
function sectionCard(i) {
  const s = stage.sections[i];
  $('cardNum').textContent = s.numeral;
  $('cardName').textContent = s.name;
  const el = $('card');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}
function showResults() {
  const r = game.rank();
  $('rTime').textContent = fmtTime(game.finalTime);
  $('rFish').textContent = `${game.fishCount} / ${stage.fish.length}`;
  $('rLives').textContent = `${game.lives} / ${LIVES}`;
  $('rJumps').textContent = game.jumps;
  $('rRank').textContent = r.letter;
  $('rTitle').textContent = r.title;
  const score = { time: game.finalTime, fish: game.fishCount, lives: game.lives, rank: r.letter };
  let isBest = false;
  if (!best || score.lives > best.lives || (score.lives === best.lives && (score.fish > best.fish || (score.fish === best.fish && score.time < best.time)))) {
    best = score;
    isBest = true;
    try { localStorage.setItem('catwalk.best', JSON.stringify(best)); } catch (e) { /* storage may be blocked */ }
  }
  $('rBest').textContent = isBest ? 'New personal best' : `Best · ${best.rank} · ${fmtTime(best.time)} · ${best.fish} fish`;
  $('results').classList.add('show');
  $('hud').classList.remove('show');
}
function showBestOnTitle() {
  $('titleBest').textContent = best ? `Best walk · rank ${best.rank} · ${fmtTime(best.time)} · ${best.fish} fish · ${best.lives} lives` : '';
}
showBestOnTitle();

// ── events from the game ─────────────────────────────────────────────────
let shake = 0;
let fade = 1;
function handleEvents() {
  for (const e of game.events) {
    switch (e.type) {
      case 'jump': audio.jump(); break;
      case 'land': audio.land(e.impact); if (e.impact > 6) shake = Math.max(shake, 0.04); break;
      case 'bounce': audio.bounce(); break;
      case 'bonk': audio.bonk(); shake = 0.08; break;
      case 'bump': audio.bump(); shake = Math.max(shake, 0.05); break;
      case 'fish': props.collect(e.id); audio.fish(e.count); break;
      case 'checkpoint': props.lightCheckpoint(e.id); audio.checkpoint(); toast('Lantern lit — checkpoint', 'soft'); break;
      case 'miss': {
        audio.miss(e.kind);
        const why = { fall: 'Fell into the alley', behind: 'Left behind by the night', glass: 'Broken glass!', vent: 'Scalded by steam' }[e.kind] || 'Miss';
        toast(e.lives > 0 ? `${why} · ${e.lives} ${e.lives === 1 ? 'life' : 'lives'} left` : why, 'bad');
        break;
      }
      case 'respawn': autopilot.reset(); break;
      case 'section': sectionCard(e.index); audio.setSection(e.index); break;
      case 'clear': audio.clear(); $('hud').classList.remove('show'); break;
      case 'results': showResults(); break;
      case 'restart': props.reset(); break;
      case 'state':
        if (e.state === 'gameover') { $('gameover').classList.add('show'); $('goWhere').textContent = stage.sections[game.section].name; audio.gameOver(); $('hud').classList.remove('show'); }
        if (e.state === 'intro') sectionCard(0);
        break;
    }
  }
  game.events.length = 0;
}
props.onBird = () => audio.flutter();

// ── camera ────────────────────────────────────────────────────────────────
const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
const titlePos = new THREE.Vector3(), titleTgt = new THREE.Vector3();
const playPos = new THREE.Vector3(), playTgt = new THREE.Vector3();
let camY = stage.pathY(stage.start.x) + 1.2;
let finaleT = 0;
function fitFov() {
  const aspect = window.innerWidth / window.innerHeight;
  const wantW = 9.6, dist = 7.6;
  const vfov = 2 * Math.atan(Math.tan(Math.atan(wantW / 2 / dist)) / aspect) * 180 / Math.PI;
  camera.fov = clamp(vfov, 30, 72);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
fitFov();

function updateCamera(dt, t) {
  const sx = game.scrollX;
  const targetY = stage.pathY(sx + 2.2) + 1.2;
  camY = damp(camY, targetY, 3, dt);
  const b = game.body;
  const lift = clamp((b.y - stage.pathY(b.x)) * 0.12, -0.2, 0.25);
  playPos.set(sx + 1.55, camY + lift, 7.6);
  playTgt.set(sx + 1.85, camY + lift - 0.44, 0);
  const sy = stage.groundAt(stage.start.x);
  const breathe = Math.sin(t * 0.35) * 0.05;
  titlePos.set(stage.start.x - 1.05 + breathe, sy + 0.78, 3.35);
  titleTgt.set(stage.start.x - 1.05 + breathe * 0.5, sy + 0.55, 0);
  let k = 1;
  if (game.state === 'title') k = 0;
  else if (game.state === 'intro') k = smooth(0.1, 1.5, game.stateT);
  camPos.lerpVectors(titlePos, playPos, k);
  camTgt.lerpVectors(titleTgt, playTgt, k);
  if (game.state === 'clear') {
    finaleT = damp(finaleT, game.stateT > 0.9 ? 1 : 0, 0.9, dt);
    const g = stage.goal;
    FIN_POS.set(g.sitX + 0.2, g.y + 1.25, 9.8);
    FIN_TGT.set(g.sitX + 0.7, g.y + 2.55, -2);
    camPos.lerp(FIN_POS, smooth(0, 1, finaleT));
    camTgt.lerp(FIN_TGT, smooth(0, 1, finaleT));
  } else finaleT = 0;
  if (shake > 0) {
    camPos.x += (Math.random() - 0.5) * shake;
    camPos.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 0.4);
  }
  if (window.__cw && window.__cw.cam) {
    const o = window.__cw.cam;
    camPos.set(o[0], o[1], o[2]);
    camTgt.set(o[3], o[4], o[5]);
  }
  camera.position.copy(camPos);
  camera.lookAt(camTgt);
}
const FIN_POS = new THREE.Vector3(), FIN_TGT = new THREE.Vector3();

// ── frame loop ────────────────────────────────────────────────────────────
let last = performance.now();
let acc = 0;
let time = 0;
const moonDir = new THREE.Vector3();
const rimCol = new THREE.Color();
const catState = { x: 0, y: 0, vx: 0, vy: 0, grounded: true, blocked: false, mode: 'sit', lookUp: false };
const catEvents = [];

function catMode() {
  switch (game.state) {
    case 'title': return 'sit';
    case 'intro': return game.stateT < 0.62 ? 'stand' : 'run';
    case 'ready': return game.stateT < 0.45 ? 'stand' : 'run';
    case 'play': return 'run';
    case 'miss': return game.missKind === 'fall' ? 'fall' : game.missKind === 'behind' ? 'stand' : 'puff';
    case 'clear': return Math.abs(game.body.vx) < 0.15 && game.stateT > 0.8 ? 'sit' : 'run';
    case 'gameover': return 'sad';
    default: return 'stand';
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (paused) dt = 0;
  acc += dt;
  time += dt;
  let n = 0;
  catEvents.length = 0;
  while (acc >= STEP && n < 40) {
    let inp;
    if (autoOn) inp = autopilot.input();
    else { inp = { pressed: input.pressed, held: input.held }; input.pressed = false; }
    game.step(inp);
    for (const e of game.events) if (e.type === 'jump' || e.type === 'land' || e.type === 'bounce') catEvents.push(e);
    handleEvents();
    acc -= STEP;
    n++;
  }
  if (n >= 40) acc = 0;
  render(dt);
}

function render(dt) {
  const t = time;
  const b = game.body;
  const bl = stage.sectionBlend(game.scrollX + 1.5);
  const pal = blendPalette(bl);
  scene.fog.color.copy(pal.fogC);
  scene.fog.density = pal.fog;
  renderer.toneMappingExposure = pal.exposure;
  hemi.color.copy(pal.hemiSkyC);
  hemi.groundColor.copy(pal.hemiGroundC);
  hemi.intensity = pal.hemiI;
  moonLight.color.copy(pal.moonC);
  moonLight.intensity = pal.moonI;
  const mi = Math.min(MOON.length - 2, Math.floor(bl)), mf = clamp(bl - mi, 0, 1);
  const az = lerp(MOON[mi][0], MOON[mi + 1][0], mf), el = lerp(MOON[mi][1], MOON[mi + 1][1], mf), ms = lerp(MOON[mi][2], MOON[mi + 1][2], mf);
  moonDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  moonLight.position.set(b.x, b.y, 0).addScaledVector(moonDir, 30);
  moonLight.target.position.set(b.x, b.y, 0);

  catState.x = b.x; catState.y = b.y; catState.vx = b.vx; catState.vy = b.vy;
  catState.grounded = b.grounded; catState.blocked = b.blocked;
  catState.mode = catMode();
  catState.lookUp = game.state === 'clear';
  rimCol.copy(pal.rimC).multiplyScalar(0.9);
  cat.setRimColor(rimCol);
  const ov = window.__cw && window.__cw.catOverride;
  if (ov) Object.assign(catState, ov);
  cat.update(ov ? 1 / 60 : dt, catState, catEvents);
  cat.root.visible = !(game.state === 'miss' && game.missKind === 'behind' && game.stateT > 0.5);

  updateCamera(dt, t);
  sky.update(camera, pal, t, moonDir, ms);
  world.update(t, camera.position.x);
  fill.position.set(b.x + 0.4, b.y + 0.9, 1.1);
  fill.color.copy(pal.fillC);
  props.update(dt, t, game, camera.position.x, camera.position.y, { x: b.x, y: b.y, visible: cat.root.visible }, bl);
  pool.update(world.sources, camera.position.x, b.x, b.y, t);

  // fades, warnings, letterbox
  let fadeTarget = 0;
  if (game.state === 'miss' && game.stateT > 0.85) fadeTarget = 1;
  if (game.state === 'ready' && game.stateT < 0.25) fadeTarget = 1;
  fade = damp(fade, fadeTarget, fadeTarget ? 9 : 5, dt);
  const g = post.grade.uniforms;
  g.uFade.value = fade;
  const behind = game.state === 'play' ? smooth(-1.4, -2.8, b.x - game.scrollX) : 0;
  g.uWarn.value = damp(g.uWarn.value, behind, 8, dt);
  const lb = game.state === 'title' || (game.state === 'clear' && finaleT > 0.05) ? 1 : 0;
  g.uLetterbox.value = damp(g.uLetterbox.value, lb, 2.5, dt);
  post.bloom.strength = lerp(0.72, 0.85, clamp(bl - 1.5, 0, 1));
  // the lit clock face sits right behind the results title; ease it down so the text reads
  world.mats.clock.color.setScalar(damp(world.mats.clock.color.r, game.state === 'clear' && game.results ? 0.42 : 1, 2.5, dt));

  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').className = ''; }
  if (game.state === 'play' || game.state === 'intro') {
    hintT += dt;
    $('hint').classList.toggle('show', hintT > 1.2 && hintT < 7.5 && game.body.x < 30);
  } else $('hint').classList.remove('show');
  updateHud();
  audio.update(dt, game);
  post.render(t);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
  fitFov();
}
window.addEventListener('resize', onResize);

// ── debug / test hooks ────────────────────────────────────────────────────
function seek(x) {
  const cps = stage.checkpoints;
  const blocked = (px) => stage.groundAt(px) === -Infinity || stage.blocks.some((b) => px > b.x0 - 0.5 && px < b.x1 + 0.5);
  for (let k = 0; k < 60 && blocked(x); k++) x += 0.25;
  game.newRun();
  props.reset();
  game.cp = -1;
  for (let i = 0; i < cps.length; i++) if (cps[i].x <= x) { game.cp = i; props.lightCheckpoint(i); }
  game.place(x);
  game.section = stage.sectionIndex(x + 1.5);
  game.setState('ready');
  game.events.length = 0;
  camY = stage.pathY(x + 2.2) + 1.2;
  $('title').classList.remove('show');
  $('hud').classList.add('show');
}
window.__cw = {
  game, stage, cat, props, world, pool, renderer, camera,
  seek,
  cam: null,
  catOverride: null,
  freeze(v = true) { paused = v; },
  auto(v = true) { autoOn = v; autopilot.reset(); },
  start: () => { press(); },
  info: () => ({ state: game.state, x: +game.body.x.toFixed(2), y: +game.body.y.toFixed(2), scroll: +game.scrollX.toFixed(2), lives: game.lives, fish: game.fishCount, time: +game.runTime.toFixed(2), draws: renderer.info.render.calls, tris: renderer.info.render.triangles }),
};
if (params.has('seek')) seek(parseFloat(params.get('seek')));

loading.classList.add('done');
$('title').classList.toggle('show', game.state === 'title');
requestAnimationFrame((t) => { last = t; frame(t); });

import * as THREE from 'three';
import { BEAT, V0, TOL, X_LIMIT, laneX, laneOfX, buildSong } from './config.js';
import { Track, makeFrame } from './track.js';
import { shared, makeNoiseTexture } from './materials.js';
import { buildWorld } from './world.js';
import { buildCar } from './car.js';
import { NoteField, createBloom } from './notes.js';
import { Post } from './post.js';
import { Music } from './music.js';
import { Hud } from './hud.js';
import { drawRadioFace, canvasTexture } from './paint.js';

THREE.ColorManagement.enabled = false;

const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor(0x000000, 0);
renderer.domElement.id = 'gl';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.3, 9000);
shared.uNoise.value = makeNoiseTexture(256);

const track = new Track();
const song = buildSong();
const L = track.L;
const D = track.dims;
const bloom = createBloom(track);

const STATION_COLORS = ['#d8902f', '#e6bf2e', '#7b68b0', '#c0392b'];
const stations = song.streets.map((s, i) => ({ fm: s.fm, color: STATION_COLORS[i] }));
const faceCanvas = document.createElement('canvas');
faceCanvas.width = faceCanvas.height = 512;
drawRadioFace(faceCanvas, stations, song.streets[3].fm, song.streets[3].name);
const faceTex = canvasTexture(faceCanvas);

const world = buildWorld(scene, track, song, { bloomTex: bloom.tex, faceTex });
const car = buildCar(faceTex);
scene.add(car.group);
const notes = new NoteField(scene, track, song, bloom);
const post = new Post(renderer);
post.setSize(window.innerWidth, window.innerHeight, DPR);
const music = new Music(song);
const hud = new Hud(song);

const G = {
  mode: 'title', odo: 1500, s: 1500, x: 0, xv: 0, xTarget: 0, speedF: 1, speedTarget: 1,
  auto: true, street: -1, lap: 0, lapHits: 0, best: 0, nIdx: 0, nLap: 0,
  pointer: false, pointerX: 0.5, keySteer: false, muted: false, hintTimer: 14,
};
const keys = {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

function syncPointers() {
  G.nLap = Math.floor(G.odo / L);
  const s = G.odo - G.nLap * L;
  G.nIdx = notes.list.findIndex((n) => n.s > s + 0.01);
  if (G.nIdx < 0) { G.nIdx = 0; G.nLap++; }
  music.resync();
}
syncPointers();

function nextNoteAhead() {
  for (const n of notes.list) if (n.s > G.s + 0.3) return n;
  return notes.list[0];
}

// Notes are judged a moment before the car reaches them so the sound can be scheduled on the beat.
function judgeNotes(v) {
  const horizon = G.odo + v * 0.12;
  for (let guard = 0; guard < 300; guard++) {
    const n = notes.list[G.nIdx];
    const gpos = G.nLap * L + n.s;
    if (gpos > horizon) break;
    if (gpos >= G.odo - 2) {
      const dtA = Math.max(0, (gpos - G.odo) / v);
      const xPred = G.x + (G.xTarget - G.x) * (1 - Math.exp(-dtA * 13));
      const hit = Math.abs(xPred - n.x) < TOL;
      notes.judge(n, hit, gpos);
      if (G.mode === 'play') {
        if (music.ctx) {
          const when = music.now() + dtA;
          if (hit) music.melody(n, when, BEAT / v); else music.ghost(n, when, BEAT / v);
        }
        if (hit) G.lapHits++;
        hud.setScore(G.lapHits, G.lap);
        hud.dirty = true;
      }
    }
    G.nIdx++;
    if (G.nIdx >= notes.list.length) { G.nIdx = 0; G.nLap++; }
  }
}

function crossed(a, b, x) {
  if (b >= a) return a < x && x <= b;
  return x > a || x <= b;
}

// --- radio dial ------------------------------------------------------------------------------
let radioFm = song.streets[3].fm;
let radioAnim = null;
function tuneRadio(st) {
  radioAnim = { from: radioFm, to: song.streets[st].fm, t: 0, label: song.streets[st].name };
}
function updateRadio(dt) {
  if (!radioAnim) return;
  radioAnim.t = Math.min(1, radioAnim.t + dt / 0.9);
  const e = smooth(radioAnim.t);
  radioFm = radioAnim.from + (radioAnim.to - radioAnim.from) * e + Math.sin(radioAnim.t * 40) * 0.5 * (1 - e);
  drawRadioFace(faceCanvas, stations, radioFm, radioAnim.t < 0.6 ? '· · ·' : radioAnim.label);
  faceTex.needsUpdate = true;
  if (radioAnim.t >= 1) radioAnim = null;
}

function onStreet(st, prev) {
  G.street = st;
  hud.setStreet(st, G.mode === 'play' && prev !== -1);
  tuneRadio(st);
  const f = (st + 2) % 4;
  notes.fadeBlooms(D.streets[f], D.streets[f + 1]);
  if (G.mode === 'play' && st === 0 && prev === 3) {
    if (G.lap >= 1) {
      G.best = Math.max(G.best, G.lapHits);
      hud.toast(`Lap ${G.lap}: you played ${G.lapHits} of ${notes.list.length} notes · best ${G.best}`, 4.5);
    }
    G.lap++;
    G.lapHits = 0;
    hud.setScore(0, G.lap);
  }
}

// --- cameras ---------------------------------------------------------------------------------
const FA = makeFrame(), FB = makeFrame(), FC = makeFrame(), CF = makeFrame();
const cam = {
  mode: 'overview', blend: 1, blendDur: 1.6, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion(), fromFov: 46,
  camX: 0, up: new THREE.Vector3(0, 1, 0), sidePos: null,
};
const dummy = new THREE.PerspectiveCamera();
const pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 46 };
const carPos = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const tmpT = new THREE.Vector3();
let time = 0;

function computePose(mode, dt) {
  if (mode === 'chase') {
    cam.camX += (G.x * 0.55 - cam.camX) * (1 - Math.exp(-dt * 5));
    track.frame(G.s - 11, FA);
    track.frame(G.s + 14, FB);
    track.frame(G.s - 3, FC);
    pose.pos.copy(FA.p).addScaledVector(FA.b, cam.camX).addScaledVector(FA.n, 4.7);
    tmpT.copy(FB.p).addScaledVector(FB.b, G.x * 0.7).addScaledVector(FB.n, 1.3);
    cam.up.lerp(FC.n, 1 - Math.exp(-dt * 5)).normalize();
    dummy.up.copy(cam.up);
    pose.fov = 64 + (G.speedF - 1) * 12;
  } else if (mode === 'world') {
    // Keeps the world's own "up": the car is seen climbing the wall and hanging from the ceiling.
    track.frame(G.s, FA);
    tmpV.copy(carPos).addScaledVector(FA.b, 9).addScaledVector(FA.n, 22).addScaledVector(FA.t, -24);
    if (!cam.sidePos) cam.sidePos = tmpV.clone();
    cam.sidePos.lerp(tmpV, 1 - Math.exp(-dt * 3));
    pose.pos.copy(cam.sidePos);
    tmpT.copy(carPos).addScaledVector(FA.t, 5).addScaledVector(FA.n, 1);
    dummy.up.set(0, 1, 0);
    if (Math.abs(tmpV.subVectors(tmpT, pose.pos).normalize().y) > 0.97) dummy.up.set(0, 0, -1);
    pose.fov = 52;
  } else {
    const title = G.mode === 'title';
    const a = title ? 0.92 + Math.sin(time * 0.07) * 0.2 : 0.92 + time * 0.03;
    const R = 930;
    const c = new THREE.Vector3(0, 175, -150);
    pose.pos.set(c.x + Math.sin(a) * R, 430, c.z + Math.cos(a) * R);
    const right = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    tmpT.copy(c).addScaledVector(right, title && window.innerWidth > 760 ? -R * 0.25 : 0);
    dummy.up.set(0, 1, 0);
    pose.fov = 46;
  }
  dummy.position.copy(pose.pos);
  dummy.lookAt(tmpT);
  pose.quat.copy(dummy.quaternion);
}

function setCamera(mode, dur = 1.6) {
  if (mode === cam.mode) return;
  cam.fromPos.copy(camera.position);
  cam.fromQuat.copy(camera.quaternion);
  cam.fromFov = camera.fov;
  cam.mode = mode;
  cam.blend = 0;
  cam.blendDur = dur;
  cam.sidePos = null;
  document.querySelector('[data-act="cam"]').textContent = `camera: ${mode === 'world' ? 'world-up' : mode}`;
}

function updateCamera(dt) {
  computePose(cam.mode, dt);
  if (cam.blend < 1) {
    cam.blend = Math.min(1, cam.blend + dt / cam.blendDur);
    const e = smooth(cam.blend);
    camera.position.lerpVectors(cam.fromPos, pose.pos, e);
    camera.quaternion.slerpQuaternions(cam.fromQuat, pose.quat, e);
    camera.fov = cam.fromFov + (pose.fov - cam.fromFov) * e;
  } else {
    camera.position.copy(pose.pos);
    camera.quaternion.copy(pose.quat);
    camera.fov = pose.fov;
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

// --- the car ---------------------------------------------------------------------------------
const radioPos = new THREE.Vector3();
const carInfo = { speed: V0, radioPos, up: new THREE.Vector3(), fwd: new THREE.Vector3() };
function placeCar(dt, v, xv, xa) {
  track.frame(G.s, CF);
  carPos.copy(CF.p).addScaledVector(CF.b, G.x);
  car.group.position.copy(carPos);
  car.group.quaternion.copy(CF.q);
  car.group.rotateY(clamp(-xv * 0.03, -0.35, 0.35));
  const beatSecs = ((G.odo / BEAT) % 1) * BEAT / v;
  car.update(dt, v, xv, xa, beatSecs);
  car.group.updateMatrixWorld(true);
  car.radio.group.getWorldPosition(radioPos).addScaledVector(CF.n, 1.1);
  carInfo.speed = v;
  carInfo.up.copy(CF.n);
  carInfo.fwd.copy(CF.t);
}

// --- main step -------------------------------------------------------------------------------
function step(dt) {
  if (G.mode === 'play') {
    if (keys.ArrowUp || keys.KeyW) G.speedTarget = Math.min(1.6, G.speedTarget + dt * 0.7);
    if (keys.ArrowDown || keys.KeyS) G.speedTarget = Math.max(0.6, G.speedTarget - dt * 0.7);
  }
  G.speedF += (G.speedTarget - G.speedF) * (1 - Math.exp(-dt * 3));
  const v = V0 * G.speedF;

  const steer = ((keys.ArrowRight || keys.KeyD) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyA) ? 1 : 0);
  const next = nextNoteAhead();
  if (G.auto || G.mode !== 'play') {
    G.xTarget = next.x;
  } else if (steer) {
    G.xTarget += steer * 13 * dt;
    G.keySteer = true;
    G.pointer = false;
  } else if (G.pointer) {
    let xt = (G.pointerX - 0.5) * 2 * 7.8;
    const lx = laneX(laneOfX(xt));
    if (Math.abs(lx - xt) < 0.45) xt = lx;
    G.xTarget = xt;
  } else if (G.keySteer) {
    G.keySteer = false;
    G.xTarget = laneX(laneOfX(G.xTarget));
  }
  G.xTarget = clamp(G.xTarget, -X_LIMIT, X_LIMIT);
  const xPrev = G.x;
  G.x += (G.xTarget - G.x) * (1 - Math.exp(-dt * 13));
  const xv = (G.x - xPrev) / dt;
  const xa = (xv - G.xv) / dt;
  G.xv = xv;

  const sPrev = G.s;
  G.odo += v * dt;
  G.s = track.wrap(G.odo);
  judgeNotes(v);
  if (G.mode === 'play') {
    music.update(G.odo, v, dt);
    const now = music.now();
    if (crossed(sPrev, G.s, D.folds[0] - 4) || crossed(sPrev, G.s, D.folds[1] - 4)) music.whoosh(now);
    if (crossed(sPrev, G.s, D.streets[3] - 6)) music.paper(now);
  }
  const st = track.streetAt(G.s);
  if (st !== G.street) onStreet(st, G.street);

  placeCar(dt, v, xv, xa);
  const dAhead = (next.s - G.s + L) % L;
  notes.setNext(next.state === 'fresh' && dAhead < 70 ? next.index : -1);
  notes.update(dt, time, G.odo, carInfo);
  world.update(dt, time);
  updateRadio(dt);
  updateCamera(dt);

  if (G.mode === 'play') {
    const street = song.streets[G.street];
    hud.update(dt, G.s / BEAT - street.startBeat - 3);
    hud.setBpm(120 * G.speedF);
    if (G.hintTimer > 0) { G.hintTimer -= dt; if (G.hintTimer <= 0) document.getElementById('hint').classList.add('off'); }
  }
}

let last = performance.now();
let frames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 1 / 60;
  dt = Math.min(dt, 0.1);
  time += dt;
  shared.uTime.value = time;
  step(dt);
  post.render(scene, camera);
  frames++;
}

// --- controls --------------------------------------------------------------------------------
function start() {
  if (G.mode === 'play') return;
  G.mode = 'play';
  music.start();
  document.getElementById('title').classList.add('gone');
  hud.show(true);
  notes.resetAll();
  G.odo = Math.ceil(G.odo / L) * L + (L - 40);
  G.s = track.wrap(G.odo);
  G.lap = 0;
  G.lapHits = 0;
  G.auto = false;
  G.speedTarget = 1;
  hud.setAuto(false);
  hud.setScore(0, 1);
  syncPointers();
  setCamera('chase', 2.4);
  G.street = -1;
}

function toggleAuto() {
  G.auto = !G.auto;
  hud.setAuto(G.auto);
  document.querySelector('[data-act="auto"]').classList.toggle('on', G.auto);
}
function toggleMute() {
  G.muted = !G.muted;
  music.setMuted(G.muted);
  document.querySelector('[data-act="mute"]').textContent = G.muted ? 'sound off' : 'sound on';
}
function cycleCamera() {
  const order = ['chase', 'world', 'overview'];
  setCamera(order[(order.indexOf(cam.mode) + 1) % order.length]);
}

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (G.mode === 'title') { start(); return; }
  if (e.repeat) return;
  if (e.code === 'KeyC') cycleCamera();
  else if (e.code === 'Space') toggleAuto();
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyH') document.getElementById('hint').classList.toggle('off');
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

let lastPX = -1;
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest && e.target.closest('#buttons')) return;
  if (G.mode === 'title') { start(); return; }
  G.pointer = true;
  G.pointerX = e.clientX / window.innerWidth;
  lastPX = e.clientX;
});
window.addEventListener('pointermove', (e) => {
  if (G.mode !== 'play') return;
  if (e.target.closest && e.target.closest('#buttons')) return;
  if (lastPX < 0 || Math.abs(e.clientX - lastPX) > 3) {
    G.pointer = true;
    G.pointerX = e.clientX / window.innerWidth;
    lastPX = e.clientX;
  }
});
document.getElementById('buttons').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (G.mode === 'title') start();
  const act = b.dataset.act;
  if (act === 'cam') cycleCamera();
  else if (act === 'auto') toggleAuto();
  else if (act === 'mute') toggleMute();
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight, DPR);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  hud.dirty = true;
});

// Hooks for automated checks: jump along the road, force autopilot or a camera.
window.GR = {
  start,
  jump(s) {
    const lapBase = Math.floor(G.odo / L) * L;
    G.odo = lapBase + s + (s < G.s ? L : 0);
    G.s = track.wrap(G.odo);
    notes.resetAll();
    syncPointers();
    track.frame(G.s, FC);
    cam.up.copy(FC.n);
    cam.camX = G.x;
    cam.blend = 1;
    cam.sidePos = null;
    return G.s;
  },
  auto(on = true) { if (G.auto !== on) toggleAuto(); return G.auto; },
  cam(mode) { setCamera(mode, 0.001); return mode; },
  state() {
    return {
      mode: G.mode, s: +G.s.toFixed(2), x: +G.x.toFixed(3), street: G.street, lap: G.lap, lapHits: G.lapHits,
      speed: +G.speedF.toFixed(2), auto: G.auto, cam: cam.mode, frames,
      closure: +track.closureError.toFixed(4), audio: music.ctx ? music.ctx.state : 'none', scheduledHalfBeats: music.nextK,
      hit: notes.list.filter((n) => n.state === 'hit').length, miss: notes.list.filter((n) => n.state === 'miss').length,
    };
  },
};

requestAnimationFrame(loop);

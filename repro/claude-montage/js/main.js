// Player: sizing, clock (locked to the pre-rendered soundtrack), controls and keyboard.
import { W, H, DURATION, clamp } from './util.js';
import { renderFrame, CHAPTERS } from './scenes.js';
import { renderScore } from './score.js';

const POSTER_T = 23.9;
const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d', { alpha: false });

let k = 1, ox = 0, oy = 0;

const state = {
  t: POSTER_T, playing: false, started: false, ended: false, muted: false,
  audioBuf: null, audioReady: false, renderMs: 0, pendingPlay: false,
  actx: null, gain: null, src: null, startPerf: 0, startCtx: 0, lastCtxT: -1, lastCtxChange: 0,
};

function resize() {
  const cw = window.innerWidth, ch = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const maxPixels = 3200 * 1800;
  if (cw * ch * dpr * dpr > maxPixels) dpr = Math.sqrt(maxPixels / (cw * ch));
  canvas.width = Math.max(1, Math.round(cw * dpr));
  canvas.height = Math.max(1, Math.round(ch * dpr));
  k = Math.min(canvas.width / W, canvas.height / H);
  ox = Math.round((canvas.width - W * k) / 2);
  oy = Math.round((canvas.height - H * k) / 2);
  draw();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0c0b0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.setTransform(k, 0, 0, k, ox, oy);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  renderFrame(ctx, state.t);
  ctx.restore();
  updateUI();
}

// ---------------- audio ----------------
function ensureContext() {
  if (state.actx) return state.actx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  state.actx = new AC();
  state.gain = state.actx.createGain();
  state.gain.gain.value = state.muted ? 0 : 1;
  state.gain.connect(state.actx.destination);
  if (state.actx.state === 'suspended') state.actx.resume();
  return state.actx;
}

function stopAudio() {
  if (!state.src) return;
  try { state.src.stop(); } catch (e) { /* already stopped */ }
  state.src.disconnect();
  state.src = null;
}

function startAudio(from) {
  stopAudio();
  const a = state.actx;
  if (!a || !state.audioBuf) return;
  if (a.state === 'suspended') a.resume();
  const src = a.createBufferSource();
  src.buffer = state.audioBuf;
  src.connect(state.gain);
  const when = a.currentTime + 0.04;
  src.start(when, from);
  state.src = src;
  state.startCtx = when - from;
  state.lastCtxT = -1;
}

// ---------------- transport ----------------
function play(from) {
  const first = !state.started;
  if (from === undefined) from = state.started && !state.ended ? state.t : 0;
  if (from >= DURATION - 0.05) from = 0;
  if (!state.audioReady) {
    state.pendingPlay = true;
    state.pendingFrom = from;
    ensureContext();
    updateUI();
    return;
  }
  state.started = true;
  state.ended = false;
  state.playing = true;
  state.t = from;
  state.startPerf = performance.now() / 1000 - from;
  ensureContext();
  startAudio(from);
  pokeControls(!first);
  requestAnimationFrame(tick);
}

function pause() {
  state.playing = false;
  stopAudio();
  draw();
}

function toggle() {
  if (state.playing) pause();
  else play();
}

function seek(t) {
  state.started = true;
  state.ended = false;
  state.t = clamp(t, 0, DURATION);
  if (state.playing) {
    state.startPerf = performance.now() / 1000 - state.t;
    startAudio(state.t);
  }
  draw();
}

function finish() {
  state.playing = false;
  state.ended = true;
  state.t = DURATION;
  stopAudio();
  draw();
}

function tick() {
  if (!state.playing) return;
  const now = performance.now() / 1000;
  let t = now - state.startPerf;
  const a = state.actx;
  if (a && state.src && a.state === 'running') {
    const ct = a.currentTime;
    if (ct !== state.lastCtxT) {
      state.lastCtxT = ct;
      state.lastCtxChange = now;
    }
    if (now - state.lastCtxChange < 0.3 && ct > state.startCtx) {
      const ta = ct - state.startCtx - (a.outputLatency || a.baseLatency || 0);
      const drift = ta - t;
      if (Math.abs(drift) > 0.25) {
        state.startPerf -= drift;
        t = ta;
      } else if (Math.abs(drift) > 0.015) {
        state.startPerf -= drift * 0.1;
        t += drift * 0.1;
      }
    }
  }
  state.t = Math.max(0, t);
  if (state.t >= DURATION) {
    finish();
    return;
  }
  draw();
  requestAnimationFrame(tick);
}

// ---------------- UI ----------------
const startEl = $('start'), endEl = $('end'), controls = $('controls'), bar = $('bar'), fill = $('fill'), knob = $('knob'), timeEl = $('time');
const fmt = (s) => `0:${String(Math.floor(s)).padStart(2, '0')}`;
let hideTimer = 0;

function pokeControls(show = true) {
  if (show) {
    controls.classList.add('show');
    document.body.classList.remove('idle');
  }
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (state.playing) {
      controls.classList.remove('show');
      document.body.classList.add('idle');
    }
  }, 2200);
}

function updateUI() {
  startEl.classList.toggle('hidden', state.started);
  startEl.classList.toggle('loading', !state.audioReady);
  endEl.classList.toggle('hidden', !state.ended);
  document.body.classList.toggle('playing', state.playing);
  if (!state.playing && state.started) controls.classList.add('show');
  const p = state.started ? state.t / DURATION : 0;
  fill.style.width = `${p * 100}%`;
  knob.style.left = `${p * 100}%`;
  timeEl.textContent = `${fmt(state.started ? state.t : 0)} / ${fmt(DURATION)}`;
  $('btnMute').classList.toggle('off', state.muted);
}

function setMuted(m) {
  state.muted = m;
  if (state.gain) state.gain.gain.value = m ? 0 : 1;
  updateUI();
}

const marks = $('marks');
[{ t: 0, title: 'Day one' }, ...CHAPTERS, { t: 25, title: 'Finale' }].forEach((ch) => {
  const m = document.createElement('i');
  m.style.left = `${(ch.t / DURATION) * 100}%`;
  m.title = ch.title;
  marks.appendChild(m);
});

$('playBig').addEventListener('click', () => play(0));
$('replay').addEventListener('click', () => play(0));
$('btnPlay').addEventListener('click', toggle);
$('btnMute').addEventListener('click', () => setMuted(!state.muted));
$('btnFull').addEventListener('click', () => {
  const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  p?.catch?.(() => {});
});
canvas.addEventListener('click', () => {
  if (state.started) toggle();
});

let scrubbing = false;
const scrubTo = (e) => {
  const r = bar.getBoundingClientRect();
  seek(clamp((e.clientX - r.left) / r.width) * DURATION);
};
bar.addEventListener('pointerdown', (e) => {
  scrubbing = true;
  bar.setPointerCapture(e.pointerId);
  scrubTo(e);
});
bar.addEventListener('pointermove', (e) => scrubbing && scrubTo(e));
bar.addEventListener('pointerup', () => (scrubbing = false));

window.addEventListener('mousemove', () => pokeControls());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'KeyK') {
    e.preventDefault();
    if (!state.started) return play(0);
    toggle();
  } else if (e.code === 'KeyR' || e.code === 'Home') play(0);
  else if (e.code === 'KeyM') setMuted(!state.muted);
  else if (e.code === 'KeyF') $('btnFull').click();
  else if (e.code === 'ArrowRight') seek(state.t + 2.5);
  else if (e.code === 'ArrowLeft') seek(state.t - 2.5);
  else return;
  pokeControls();
});
window.addEventListener('resize', resize);

// ---------------- boot ----------------
resize();
const t0 = performance.now();
renderScore()
  .then((b) => {
    state.audioBuf = b;
    state.renderMs = Math.round(performance.now() - t0);
  })
  .catch((err) => console.warn('Soundtrack unavailable, playing silently:', err))
  .finally(() => {
    state.audioReady = true;
    updateUI();
    if (state.pendingPlay) {
      state.pendingPlay = false;
      play(state.pendingFrom);
    }
  });

const q = new URLSearchParams(location.search);
if (q.has('t')) seek(parseFloat(q.get('t')) || 0);

window.montage = {
  play: (t) => play(t),
  pause,
  seek: (t) => { seek(t); return state.t; },
  get time() { return state.t; },
  get playing() { return state.playing; },
  get audioReady() { return state.audioReady; },
  get audioState() { return state.actx ? state.actx.state : 'none'; },
  get muted() { return state.muted; },
  get ended() { return state.ended; },
  audioStats() {
    const b = state.audioBuf;
    if (!b) return null;
    const sr = b.sampleRate, L = b.getChannelData(0), R = b.getChannelData(1);
    let nan = 0;
    const bars = [];
    for (let i = 0; i < 12; i++) {
      const i0 = Math.floor(i * 2.5 * sr), i1 = Math.min(L.length, Math.floor((i + 1) * 2.5 * sr));
      let s = 0, pk = 0;
      for (let j = i0; j < i1; j++) {
        if (!Number.isFinite(L[j]) || !Number.isFinite(R[j])) { nan++; continue; }
        s += (L[j] * L[j] + R[j] * R[j]) / 2;
        pk = Math.max(pk, Math.abs(L[j]), Math.abs(R[j]));
      }
      bars.push(`${i + 1}: rms ${(10 * Math.log10(s / (i1 - i0) + 1e-12)).toFixed(1)} dB, peak ${pk.toFixed(2)}`);
    }
    return { renderMs: state.renderMs, seconds: b.duration, nan, bars };
  },
};

import { S, initSprites, clamp, sstep, hash, canvas } from './core.js';
import { initWorld } from './world.js';
import { DURATION, SHOTS, CAPTIONS, CHAPTERS, blackAt, shotIndex, TITLE, END } from './film.js';
import { AudioEngine } from './audio.js';

const $ = (s) => document.querySelector(s);
const cv = $('#film');
const ctx = cv.getContext('2d', { alpha: false });
S.ctx = ctx;
initSprites();
initWorld();

const POSTER_T = 129.6;
const audio = new AudioEngine();
const st = {
  t: POSTER_T, playing: false, started: false, last: performance.now() / 1000,
  captions: true, muted: false, dirty: true, scrubbing: false, wasPlaying: false,
};
let buf = null, bctx = null, vig = null, grainPat = null;

// ---------------------------------------------------------------- layout
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  let scale = dpr;
  const maxPix = 2560 * 1440;
  if (vw * vh * scale * scale > maxPix) scale = Math.sqrt(maxPix / (vw * vh));
  cv.width = Math.round(vw * scale);
  cv.height = Math.round(vh * scale);
  cv.style.width = vw + 'px';
  cv.style.height = vh + 'px';
  S.dpr = scale;
  const aspect = vw / vh >= 1.6 ? 2.2 : 16 / 9;
  let pw = vw, ph = vw / aspect;
  if (ph > vh) {
    ph = vh;
    pw = vh * aspect;
  }
  const px = (vw - pw) / 2;
  const py = aspect > 2 ? (vh - ph) / 2 : Math.max(0, (vh - ph) * 0.38);
  S.pic = { x: Math.round(px * scale), y: Math.round(py * scale), w: Math.round(pw * scale), h: Math.round(ph * scale) };
  S.picCss = { x: px, y: py, w: pw, h: ph, vw, vh };
  buf = null;
  vig = null;
  layoutUI();
  st.dirty = true;
}

function makeVignette() {
  const P = S.pic;
  vig = canvas(P.w, P.h);
  const g = vig.getContext('2d');
  const r = Math.hypot(P.w, P.h) / 2;
  const grd = g.createRadialGradient(P.w / 2, P.h / 2, r * 0.35, P.w / 2, P.h / 2, r);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.7, 'rgba(0,0,0,0.18)');
  grd.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = grd;
  g.fillRect(0, 0, P.w, P.h);
}

// ---------------------------------------------------------------- render
function resetCtx(c) {
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.setTransform(1, 0, 0, 1, 0, 0);
}

function drawShot(c, i, t) {
  S.ctx = c;
  resetCtx(c);
  const P = S.pic;
  c.save();
  c.beginPath();
  c.rect(P.x, P.y, P.w, P.h);
  c.clip();
  SHOTS[i].draw(t);
  c.restore();
  resetCtx(c);
  S.ctx = ctx;
}

function render(t) {
  resetCtx(ctx);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const i = shotIndex(t);
  drawShot(ctx, i, t);
  const sh = SHOTS[i];
  if (sh.dissolve && i > 0 && t < sh.t0 + sh.dissolve) {
    if (!buf || buf.width !== cv.width || buf.height !== cv.height) {
      buf = canvas(cv.width, cv.height);
      bctx = buf.getContext('2d');
    }
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, buf.width, buf.height);
    drawShot(bctx, i - 1, t);
    const P = S.pic;
    ctx.globalAlpha = 1 - sstep(sh.t0, sh.t0 + sh.dissolve, t);
    ctx.drawImage(buf, P.x, P.y, P.w, P.h, P.x, P.y, P.w, P.h);
    ctx.globalAlpha = 1;
  }
  post(t);
}

function post(t) {
  const P = S.pic;
  resetCtx(ctx);
  if (!vig) makeVignette();
  ctx.drawImage(vig, P.x, P.y);
  if (!grainPat) grainPat = ctx.createPattern(S.grain, 'repeat');
  const gi = Math.floor(performance.now() / 42);
  const ox = Math.floor(hash(gi) * 256), oy = Math.floor(hash(gi + 999) * 256);
  ctx.save();
  ctx.beginPath();
  ctx.rect(P.x, P.y, P.w, P.h);
  ctx.clip();
  ctx.translate(P.x - ox, P.y - oy);
  ctx.fillStyle = grainPat;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(ox, oy, P.w, P.h);
  ctx.restore();
  const b = blackAt(t);
  if (b > 0.002) {
    ctx.globalAlpha = Math.min(1, b);
    ctx.fillStyle = '#000';
    ctx.fillRect(P.x, P.y, P.w, P.h);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- UI
const ui = {
  start: $('#start'), title: $('#title'), end: $('#endcard'), cap: $('#caption'), capZh: $('#caption .zh'), capEn: $('#caption .en'),
  controls: $('#controls'), play: $('#c-play'), time: $('#c-time'), bar: $('#c-bar'), fill: $('#c-fill'), marks: $('#c-marks'),
  tip: $('#c-tip'), cc: $('#c-cc'), mute: $('#c-mute'), fs: $('#c-fs'), replay: $('#replay'), endTitle: $('#endcard .t'),
  endLine: $('#endcard .line'), endFin: $('#endcard .fin'), endCredit: $('#endcard .credit'),
};

CHAPTERS.forEach(([t, zh, en]) => {
  const m = document.createElement('div');
  m.className = 'mark';
  m.style.left = (t / DURATION) * 100 + '%';
  m.dataset.label = `${zh} · ${en}`;
  ui.marks.appendChild(m);
});

function layoutUI() {
  const P = S.picCss;
  const zh = clamp(P.w * 0.0168, 15, 34);
  const bottomBar = P.vh - (P.y + P.h);
  const capH = zh * 2.7;
  const root = document.documentElement.style;
  root.setProperty('--zh', zh + 'px');
  root.setProperty('--pic-x', P.x + 'px');
  root.setProperty('--pic-y', P.y + 'px');
  root.setProperty('--pic-w', P.w + 'px');
  root.setProperty('--pic-h', P.h + 'px');
  let capTop;
  if (bottomBar >= capH + 6) capTop = P.y + P.h + (Math.min(bottomBar, capH * 2.2) - capH) / 2;
  else capTop = P.y + P.h - capH - zh * 0.8;
  root.setProperty('--cap-top', capTop + 'px');
  root.setProperty('--cap-h', capH + 'px');
  root.setProperty('--ctl-shift', Math.max(0, capTop + capH - (P.vh - 58)) + 'px');
  ui.cap.classList.toggle('overlay', bottomBar < capH + 6);
}

let lastCap = -2;
function updateUI(t) {
  // captions
  let ci = -1, ca = 0;
  for (let i = 0; i < CAPTIONS.length; i++) {
    const [a, b] = CAPTIONS[i];
    if (t >= a - 0.4 && t <= b + 0.4) {
      ci = i;
      ca = sstep(a - 0.4, a + 0.2, t) * (1 - sstep(b - 0.2, b + 0.4, t));
      break;
    }
  }
  if (ci !== lastCap) {
    lastCap = ci;
    ui.capZh.textContent = ci >= 0 ? CAPTIONS[ci][2] : '';
    ui.capEn.textContent = ci >= 0 ? CAPTIONS[ci][3] : '';
  }
  ui.cap.style.opacity = st.captions && st.started ? ca.toFixed(3) : '0';
  // title and end cards
  const ta = st.started ? sstep(TITLE.in0, TITLE.in1, t) * (1 - sstep(TITLE.out0, TITLE.out1, t)) : 0;
  ui.title.style.opacity = ta.toFixed(3);
  ui.title.style.setProperty('--spread', (0.28 + 0.1 * sstep(TITLE.in0, TITLE.out1, t)).toFixed(3) + 'em');
  const ea = st.started ? sstep(END.title, END.title + 2.2, t) : 0;
  ui.end.style.opacity = ea > 0 ? '1' : '0';
  ui.endTitle.style.opacity = ea.toFixed(3);
  ui.endLine.style.opacity = (st.started ? sstep(END.line, END.line + 2, t) : 0).toFixed(3);
  const fa = st.started ? sstep(END.fin, END.fin + 1.6, t) : 0;
  ui.endFin.style.opacity = fa.toFixed(3);
  ui.endCredit.style.opacity = fa.toFixed(3);
  ui.replay.style.opacity = fa.toFixed(3);
  ui.replay.style.pointerEvents = fa > 0.5 ? 'auto' : 'none';
  // controls
  ui.fill.style.width = ((t / DURATION) * 100).toFixed(3) + '%';
  ui.time.textContent = `${fmt(t)} / ${fmt(DURATION)}`;
  document.body.classList.toggle('paused', !st.playing);
  document.body.classList.toggle('started', st.started);
}
const fmt = (s) => {
  s = Math.max(0, Math.min(DURATION, s));
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- playback
function play() {
  if (!st.started) {
    st.started = true;
    st.t = 0;
    ui.start.classList.add('gone');
  }
  if (st.t >= DURATION - 0.05) st.t = 0;
  audio.init();
  audio.setMuted(st.muted);
  st.playing = true;
  st.last = performance.now() / 1000;
  audio.start(st.t);
  poke();
}
function pause() {
  st.playing = false;
  audio.pause();
  st.dirty = true;
  poke();
}
function toggle() {
  if (st.playing) pause();
  else play();
}
function seek(t) {
  st.t = clamp(t, 0, DURATION);
  if (!st.started) {
    st.started = true;
    ui.start.classList.add('gone');
  }
  st.dirty = true;
  if (st.playing && !st.scrubbing) audio.start(st.t);
  else if (!st.playing) audio.pause();
}

let hideTimer = 0;
function poke() {
  document.body.classList.add('show-ui');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (st.playing && !st.scrubbing) document.body.classList.remove('show-ui');
  }, 2600);
}

ui.start.addEventListener('click', () => play());
ui.play.addEventListener('click', (e) => {
  e.stopPropagation();
  toggle();
});
ui.replay.addEventListener('click', (e) => {
  e.stopPropagation();
  st.t = 0;
  play();
});
ui.cc.addEventListener('click', (e) => {
  e.stopPropagation();
  st.captions = !st.captions;
  ui.cc.classList.toggle('off', !st.captions);
});
ui.mute.addEventListener('click', (e) => {
  e.stopPropagation();
  st.muted = !st.muted;
  audio.setMuted(st.muted);
  ui.mute.classList.toggle('off', st.muted);
});
ui.fs.addEventListener('click', (e) => {
  e.stopPropagation();
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});

const barT = (e) => {
  const r = ui.bar.getBoundingClientRect();
  return clamp((e.clientX - r.left) / r.width) * DURATION;
};
ui.bar.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  st.scrubbing = true;
  ui.bar.setPointerCapture(e.pointerId);
  if (st.playing) audio.pause();
  seek(barT(e));
});
ui.bar.addEventListener('pointermove', (e) => {
  const t = barT(e);
  let label = '';
  for (const [ct, zh, en] of CHAPTERS) if (t >= ct) label = `${zh} · ${en}`;
  ui.tip.textContent = `${fmt(t)}  ${label}`;
  ui.tip.style.left = (t / DURATION) * 100 + '%';
  if (st.scrubbing) seek(t);
});
const endScrub = () => {
  if (!st.scrubbing) return;
  st.scrubbing = false;
  if (st.playing) audio.start(st.t);
};
ui.bar.addEventListener('pointerup', endScrub);
ui.bar.addEventListener('pointercancel', endScrub);
ui.controls.addEventListener('click', (e) => e.stopPropagation());

$('#stage').addEventListener('click', () => {
  if (st.started) toggle();
});
window.addEventListener('mousemove', poke);
window.addEventListener('touchstart', poke, { passive: true });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'KeyK') {
    e.preventDefault();
    toggle();
  } else if (e.code === 'ArrowRight') seek(st.t + 5);
  else if (e.code === 'ArrowLeft') seek(st.t - 5);
  else if (e.code === 'KeyM') ui.mute.click();
  else if (e.code === 'KeyC') ui.cc.click();
  else if (e.code === 'KeyF') ui.fs.click();
  else if (e.code === 'Home') seek(0);
  else return;
  poke();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && st.playing) pause();
});
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- loop
let lastRendered = -1;
function loop(ms) {
  requestAnimationFrame(loop);
  const now = ms / 1000;
  if (st.playing && !st.scrubbing) {
    const dt = now - st.last;
    st.t += dt > 0.5 ? 0.5 : dt;
    if (dt > 0.5) audio.start(st.t);
    if (st.t >= DURATION) {
      st.t = DURATION;
      st.playing = false;
      audio.pause();
      document.body.classList.add('show-ui');
    }
    st.dirty = true;
  }
  st.last = now;
  if (st.dirty || st.t !== lastRendered) {
    render(st.t);
    lastRendered = st.t;
    st.dirty = false;
  }
  audio.update(st.t);
  updateUI(st.t);
}

resize();
const q = new URLSearchParams(location.search);
if (q.has('t')) seek(parseFloat(q.get('t')) || 0);
if (q.has('nocap')) st.captions = false;
if (q.has('clean')) document.body.classList.add('clean');
requestAnimationFrame(loop);

window.film = {
  seek: (t) => {
    seek(t);
    render(st.t);
    lastRendered = st.t;
    updateUI(st.t);
    return st.t;
  },
  play,
  pause,
  clean: (on = true) => document.body.classList.toggle('clean', on),
  get time() {
    return st.t;
  },
  duration: DURATION,
  shots: SHOTS.map((s) => [s.id, s.t0, s.t1]),
  get audioState() {
    return audio.ac ? audio.ac.state : 'none';
  },
};

'use strict';
// Player: click-to-start (autoplay policy), play/pause, seek bar with chapter marks, mute, 16:9 / 9:16, fullscreen.
// The audio clock drives the picture while sound is running; otherwise performance.now() does.
(function () {
  const MA = window.MA;
  const F = MA.film;
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const canvas = $('film'), frame = $('frame'), bar = $('bar'), track = $('track');
  const POSTER_T = 12.6;

  let aspect = q.get('aspect') === '9:16' || q.get('aspect') === '9x16' ? '9:16' : '16:9';
  F.init(canvas, aspect);
  let t = clamp(Number(q.get('t')) || (q.has('t') ? 0 : POSTER_T));
  let playing = false, started = false, muted = false, ended = false;
  let wallStart = 0, filmStart = 0;
  const audio = MA.audio || null;

  function clamp(v) { return Math.max(0, Math.min(F.DUR, v)); }
  const fmt = (s) => { s = Math.max(0, Math.floor(s + 1e-6)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  function layout() {
    const W = canvas.width, H = canvas.height;
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    frame.style.width = Math.floor(W * s) + 'px';
    frame.style.height = Math.floor(H * s) + 'px';
  }
  window.addEventListener('resize', layout);

  // chapter ticks
  F.CHAPTERS.forEach((c) => {
    if (!c.t) return;
    const d = document.createElement('div');
    d.className = 'tick';
    d.style.left = (c.t / F.DUR) * 100 + '%';
    track.appendChild(d);
  });

  // The bar is updated every frame, so only touch the DOM when something visible changed, and move the progress
  // with transforms (no layout).
  const fillEl = track.querySelector('.fill'), knobEl = track.querySelector('.knob-rail');
  const shown = {};
  const put = (key, val, apply) => { if (shown[key] !== val) { shown[key] = val; apply(val); } };
  function ui() {
    const f = t / F.DUR;
    put('fill', f.toFixed(4), (v) => { fillEl.style.transform = `scaleX(${v})`; });
    put('knob', (f * 100).toFixed(2), (v) => { knobEl.style.transform = `translateX(${v}%)`; });
    put('time', fmt(t) + ' / ' + fmt(F.DUR), (v) => { $('time').textContent = v; });
    put('chapter', F.CHAPTERS[F.chapterAt(t)].zh, (v) => { $('chapter').textContent = v; });
    put('playing', playing, (v) => {
      document.querySelector('.i-play').style.display = v ? 'none' : '';
      document.querySelector('.i-pause').style.display = v ? '' : 'none';
    });
    put('ended', ended, (v) => { $('play').title = v ? '重播' : '播放 / 暂停 (空格)'; });
  }

  function now() {
    if (!playing) return t;
    const at = audio && !muted ? audio.time() : null;
    if (at !== null && at !== undefined) return at;
    return filmStart + (performance.now() - wallStart) / 1000;
  }

  function loop() {
    if (!playing) return;
    t = clamp(now());
    F.renderFrame(t);
    ui();
    if (t >= F.DUR) { pause(); ended = true; ui(); return; }
    requestAnimationFrame(loop);
  }

  function play() {
    if (playing) return;
    if (t >= F.DUR - 0.05) t = 0;
    ended = false;
    playing = true;
    filmStart = t;
    wallStart = performance.now();
    if (audio && !muted) audio.play(t);
    requestAnimationFrame(loop);
    ui();
    poke();
  }
  function pause() {
    if (!playing) return;
    t = clamp(now());
    playing = false;
    if (audio) audio.stop();
    F.renderFrame(t);
    ui();
    bar.classList.remove('idle');
  }
  function seek(v) {
    const was = playing;
    if (was) { playing = false; if (audio) audio.stop(); }
    t = clamp(v);
    ended = false;
    F.renderFrame(t);
    if (was) play(); else ui();
  }
  function begin() {
    if (!started) {
      started = true;
      $('start').classList.add('gone');
      if (audio) audio.ensure();
      t = 0;
    }
    play();
  }

  $('start').addEventListener('click', begin);
  $('start').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); } });
  $('play').addEventListener('click', () => { if (!started) return begin(); playing ? pause() : play(); });
  $('mute').addEventListener('click', toggleMute);
  function toggleMute() {
    muted = !muted;
    if (audio) {
      if (!started) audio.ensure();
      if (muted) audio.stop();
      else if (playing) { const cur = clamp(now()); filmStart = cur; wallStart = performance.now(); audio.play(cur); }
    }
    if (muted && playing) { filmStart = t; wallStart = performance.now(); }
    document.querySelector('.i-vol').style.display = muted ? 'none' : '';
    document.querySelector('.i-mute').style.display = muted ? '' : 'none';
  }
  $('full').addEventListener('click', toggleFull);
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }
  $('aspect').addEventListener('click', () => setAspect(aspect === '16:9' ? '9:16' : '16:9'));
  function setAspect(a) {
    aspect = a;
    F.setAspect(a);
    $('aspect').textContent = a === '16:9' ? '竖版' : '横版';
    const u = new URL(location.href);
    if (a === '9:16') u.searchParams.set('aspect', '9:16'); else u.searchParams.delete('aspect');
    history.replaceState(null, '', u);
    layout();
    F.renderFrame(t);
  }

  // seek bar: click or drag
  let dragging = false;
  const posToT = (e) => { const r = track.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * F.DUR; };
  track.addEventListener('pointerdown', (e) => { dragging = true; track.setPointerCapture(e.pointerId); if (!started) { started = true; $('start').classList.add('gone'); if (audio) audio.ensure(); } seek(posToT(e)); });
  track.addEventListener('pointermove', (e) => {
    const v = clamp(posToT(e));
    const tip = track.querySelector('.tip');
    tip.style.left = (v / F.DUR) * 100 + '%';
    tip.textContent = fmt(v) + ' · ' + F.CHAPTERS[F.chapterAt(v)].zh;
    if (dragging) seek(v);
  });
  track.addEventListener('pointerup', () => { dragging = false; });

  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); if (!started) begin(); else playing ? pause() : play(); }
    else if (e.code === 'ArrowRight') seek(t + 5);
    else if (e.code === 'ArrowLeft') seek(t - 5);
    else if (e.code === 'Home') seek(0);
    else if (e.code === 'KeyF') toggleFull();
    else if (e.code === 'KeyM') toggleMute();
    poke();
  });

  // hide the control bar while the film plays and the mouse is still
  let idleTimer = 0;
  function poke() {
    bar.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (playing) bar.classList.add('idle'); }, 2200);
  }
  window.addEventListener('pointermove', poke);

  // hooks for headless export and screenshots
  window.renderFrame = (tt) => F.renderFrame(tt);
  MA.shot = function (tt, a) {
    document.body.classList.add('clean');
    if (playing) pause();
    if (a && a !== aspect) setAspect(a);
    layout();
    t = clamp(tt);
    F.renderFrame(t);
    return { t, aspect, w: canvas.width, h: canvas.height };
  };
  MA.player = { play, pause, seek, begin, state: () => ({ t, playing, started, muted, aspect }) };
  window.__snap = (tt) => { F.renderFrame(tt); return canvas.toDataURL('image/png'); };

  if (q.has('clean')) document.body.classList.add('clean');
  $('aspect').textContent = aspect === '16:9' ? '竖版' : '横版';
  layout();
  F.renderFrame(t);
  ui();
  $('loading').classList.add('gone');
  window.__ready = true;
  if (q.has('autoplay')) begin();
})();

'use strict';
// App shell: canvas sizing, the film clock, playback controls and the stop-motion frame loop.

(() => {
  const canvas = document.getElementById('film');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    start: $('start'), play: $('playBtn'), controls: $('controls'), pp: $('btnPlay'), restart: $('btnRestart'),
    mute: $('btnMute'), track: $('track'), fill: $('fill'), knob: $('knob'), time: $('time'), replay: $('replay'),
  };
  let cw = 0, ch = 0, dpr = 1, scale = 1, ox = 0, oy = 0;
  let state = 'cover';           // cover | playing | paused | ended
  let lastKey = '', lastDrawMs = 0, vignette = null, grainPats = [];
  let muted = false, idleTimer = 0, dragging = false, resumeAfterDrag = false, watchdog = null;

  // ---------------------------------------------------------------- clock
  const clock = {
    playing: false, base: 0, t0: 0, audio: false,
    start(t) {
      this.base = t;
      this.playing = true;
      this.audio = Sound.ok;
      if (this.audio) Sound.play(t);
      this.t0 = performance.now();
      clearTimeout(watchdog);
      if (this.audio) {
        // if the audio clock never starts (blocked output), fall back to wall-clock time
        const a0 = Sound.now();
        watchdog = setTimeout(() => {
          if (this.playing && this.audio && Sound.now() - a0 < 0.05) {
            this.audio = false;
            this.base = this.base + (performance.now() - this.t0) / 1000;
            this.t0 = performance.now();
          }
        }, 900);
      }
    },
    pause() {
      this.base = this.now();
      this.playing = false;
      if (Sound.ok) Sound.stop();
    },
    seek(t) {
      if (this.playing) this.start(t); else this.base = t;
    },
    now() {
      if (!this.playing) return this.base;
      if (this.audio) return Math.max(this.base - 0.02, Sound.now());
      return this.base + (performance.now() - this.t0) / 1000;
    },
  };

  // ---------------------------------------------------------------- sizing & film look
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = Math.max(1, Math.round(window.innerWidth * dpr));
    ch = Math.max(1, Math.round(window.innerHeight * dpr));
    canvas.width = cw;
    canvas.height = ch;
    scale = Math.min(cw / W, ch / H);
    ox = (cw - W * scale) / 2;
    oy = (ch - H * scale) / 2;
    vignette = mkCanvas(Math.max(2, cw >> 2), Math.max(2, ch >> 2));
    const g = vignette.getContext('2d'), w = vignette.width, h = vignette.height;
    const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.36, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    grd.addColorStop(0, 'rgba(40,22,8,0)');
    grd.addColorStop(1, 'rgba(40,22,8,0.42)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    lastKey = '';
  }

  function draw(t, fi, boil) {
    const t1 = performance.now();
    BOIL = ((boil % 3) + 3) % 3;
    DPX = scale;
    const jx = (hash(fi * 2 + 1) - 0.5) * 2.2, jy = (hash(fi * 2 + 7) - 0.5) * 2.2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(scale, 0, 0, scale, ox + jx * scale, oy + jy * scale);
    const view = { x0: -ox / scale - 12, y0: -oy / scale - 12, x1: (cw - ox) / scale + 12, y1: (ch - oy) / scale + 12 };
    if (t === null) Film.cover(ctx, view);
    else Film.render(ctx, t, view);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    const gp = grainPats[((fi % 3) + 3) % 3];
    gp.setTransform(new DOMMatrix([dpr, 0, 0, dpr, hash(fi + 11) * 256, hash(fi + 17) * 256]));
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = gp;
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(vignette, 0, 0, cw, ch);
    const fl = (hash(fi * 13 + 5) - 0.5) * 0.04;
    ctx.fillStyle = fl > 0 ? `rgba(255,246,228,${fl})` : `rgba(24,12,0,${-fl})`;
    ctx.fillRect(0, 0, cw, ch);
    lastDrawMs = performance.now() - t1;
  }

  // ---------------------------------------------------------------- loop
  function frame(now) {
    requestAnimationFrame(frame);
    if (!Film.ready) return;
    Sound.pump();
    let t = null;
    if (state !== 'cover') {
      t = clamp(clock.now(), 0, END);
      if (state === 'playing' && t >= END) end();
      if (state === 'ended') t = END;
    }
    const live = state === 'cover' || state === 'ended';
    const fi = t === null ? 0 : Math.floor(t * ANIM_FPS);
    const tick = live ? Math.floor(now / (1000 / ANIM_FPS)) : fi;
    const boil = live ? Math.floor((tick * 2) / 3) : Math.floor((fi * 2) / 3);
    const key = `${fi}:${boil}:${tick % 3}:${cw}x${ch}`;
    if (key !== lastKey) {
      lastKey = key;
      draw(t === null ? null : fi / ANIM_FPS, live ? tick : fi, boil);
    }
    updateUI(t);
  }

  // ---------------------------------------------------------------- transport
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function updateUI(t) {
    if (t === null) return;
    const p = clamp(t / END) * 100;
    ui.fill.style.width = p.toFixed(2) + '%';
    ui.knob.style.left = p.toFixed(2) + '%';
    const label = `${fmt(t)} / ${fmt(END)}`;
    if (ui.time.textContent !== label) ui.time.textContent = label;
  }
  function syncButtons() {
    const on = state === 'playing';
    ui.pp.classList.toggle('is-paused', !on);
    ui.pp.setAttribute('aria-label', on ? 'Pause (Space)' : 'Play (Space)');
    ui.pp.title = on ? 'Pause (Space)' : 'Play (Space)';
    ui.mute.classList.toggle('is-muted', muted);
    ui.mute.setAttribute('aria-label', muted ? 'Unmute (M)' : 'Mute (M)');
    ui.mute.title = muted ? 'Unmute (M)' : 'Mute (M)';
    document.body.classList.toggle('paused', state === 'paused');
  }
  function poke() {
    document.body.classList.add('ui');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if ((state === 'playing' || state === 'ended') && !dragging) document.body.classList.remove('ui'); }, 2400);
  }
  function start() {
    if (state !== 'cover' || !Film.ready) return;
    Sound.init();
    ui.start.classList.add('gone');
    state = 'playing';
    clock.start(0);
    syncButtons();
    poke();
  }
  function togglePause() {
    if (state === 'cover') return start();
    Sound.init();
    if (state === 'playing') { clock.pause(); state = 'paused'; }
    else if (state === 'paused') { clock.start(clock.base); state = 'playing'; }
    else if (state === 'ended') return restart();
    syncButtons();
    poke();
  }
  function restart() {
    if (state === 'cover') return start();
    Sound.init();
    ui.replay.classList.remove('on');
    state = 'playing';
    clock.start(0);
    syncButtons();
    poke();
  }
  function end() {
    state = 'ended';
    clock.playing = false;
    clock.base = END;
    Sound.release();
    ui.replay.classList.add('on');
    syncButtons();
    poke();
  }
  function seekTo(t) {
    if (state === 'cover') return;
    t = clamp(t, 0, END - 0.02);
    if (state === 'ended') { state = 'paused'; ui.replay.classList.remove('on'); syncButtons(); }
    clock.seek(t);
    lastKey = '';
  }
  function toggleMute() {
    muted = !muted;
    Sound.setMuted(muted);
    syncButtons();
    poke();
  }

  ui.play.addEventListener('click', (e) => { e.stopPropagation(); start(); });
  ui.start.addEventListener('click', start);
  canvas.addEventListener('click', () => { if (state === 'cover') start(); else togglePause(); });
  ui.pp.addEventListener('click', togglePause);
  ui.restart.addEventListener('click', restart);
  ui.mute.addEventListener('click', toggleMute);
  ui.replay.addEventListener('click', restart);
  const seekFrom = (e) => { const r = ui.track.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * END); };
  ui.track.addEventListener('pointerdown', (e) => {
    if (state === 'cover') return;
    dragging = true;
    resumeAfterDrag = state === 'playing';
    if (resumeAfterDrag) { clock.pause(); state = 'paused'; }
    ui.track.setPointerCapture(e.pointerId);
    seekFrom(e);
    poke();
  });
  ui.track.addEventListener('pointermove', (e) => { if (dragging) seekFrom(e); });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    if (resumeAfterDrag) { state = 'playing'; clock.start(clock.base); }
    syncButtons();
    poke();
  };
  ui.track.addEventListener('pointerup', release);
  ui.track.addEventListener('pointercancel', release);
  window.addEventListener('pointermove', poke);
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('button') && (e.code === 'Space' || e.code === 'Enter')) return;
    if (e.code === 'Space' || e.code === 'KeyK' || (e.code === 'Enter' && state === 'cover')) { e.preventDefault(); togglePause(); }
    else if (e.code === 'KeyR') restart();
    else if (e.code === 'KeyM') toggleMute();
    else if (e.code === 'ArrowRight') { seekTo(clock.now() + 5); poke(); }
    else if (e.code === 'ArrowLeft') { seekTo(clock.now() - 5); poke(); }
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(); });

  // debugging / preview hooks
  window.__film = {
    seek: (t) => { seekTo(t); return +clock.now().toFixed(3); },
    pause: () => { if (state === 'playing') togglePause(); return state; },
    play: () => { if (state !== 'playing') togglePause(); return state; },
    state: () => state,
    time: () => +clock.now().toFixed(3),
    drawMs: () => +lastDrawMs.toFixed(1),
    audio: (only) => Sound.analyze(only),
  };

  resize();
  Film.init(ctx);
  grainPats = GRAIN.map((g) => ctx.createPattern(g, 'repeat'));
  const q = new URLSearchParams(location.search);
  if (q.has('t')) {
    // ?t=12.5 opens paused on that moment (no sound until play is pressed)
    ui.start.classList.add('gone');
    state = 'paused';
    clock.base = clamp(parseFloat(q.get('t')) || 0, 0, END);
    syncButtons();
  }
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
})();

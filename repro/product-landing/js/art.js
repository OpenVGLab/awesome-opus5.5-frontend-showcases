import { qs, qsa, motionOK, observe, tween, emit, on, toast } from './core.js';

const NS = 'http://www.w3.org/2000/svg';
const running = new Set();
let raf = 0;
function frame(now) {
  raf = 0;
  const t = now / 1000;
  running.forEach((fn) => fn(t));
  if (running.size) raf = requestAnimationFrame(frame);
}
function whenVisible(el, fn) {
  if (!motionOK()) {
    fn(1.3);
    return;
  }
  observe([el], (e) => {
    if (e.isIntersecting) {
      running.add(fn);
      if (!raf) raf = requestAnimationFrame(frame);
    } else running.delete(fn);
  }, { threshold: 0.02 });
}

/* 01 — noise + anti-noise = silence (music survives) */
function ancArt(svg) {
  const noise = qs('.noise', svg);
  const anti = qs('.anti', svg);
  const result = qs('.result', svg);
  const dot = qs('.art-notes circle', svg);
  const X0 = 24;
  const X1 = 432;
  const N = 96;
  const n = (x, t) => Math.sin(x * 0.043 + t * 3.2) * 13 + Math.sin(x * 0.117 - t * 5.1) * 8 + Math.sin(x * 0.021 + t * 1.4) * 10;
  const m = (x, t) => Math.sin(x * 0.06 - t * 2.4) * 10 * (0.75 + 0.25 * Math.sin(t * 0.8));
  return (t) => {
    let a = '';
    let b = '';
    let c = '';
    for (let i = 0; i <= N; i++) {
      const x = X0 + ((X1 - X0) * i) / N;
      const v = n(x, t);
      const cmd = i ? 'L' : 'M';
      a += `${cmd}${x.toFixed(1)} ${(100 + v).toFixed(1)}`;
      b += `${cmd}${x.toFixed(1)} ${(200 - v).toFixed(1)}`;
      c += `${cmd}${x.toFixed(1)} ${(300 + m(x, t)).toFixed(1)}`;
    }
    noise.setAttribute('d', a);
    anti.setAttribute('d', b);
    result.setAttribute('d', c);
    const px = X0 + ((t * 70) % (X1 - X0));
    dot.setAttribute('cx', px.toFixed(1));
    dot.setAttribute('cy', (300 + m(px, t)).toFixed(1));
  };
}

/* 03 — beamforming: particles entering the voice beam are filtered out */
function voiceArt(svg) {
  const g = qs('.particles', svg);
  const line = qs('.voice-line', svg);
  const inCone = (x, y) => {
    if (x > 330 || x < 58) return false;
    if (x >= 110) return Math.abs(y - 180) < (70 * (330 - x)) / 220;
    return (x - 134) ** 2 + (y - 180) ** 2 < 74 ** 2;
  };
  const spawn = (p) => {
    do {
      p.x = 16 + Math.random() * 448;
      p.y = 16 + Math.random() * 280;
    } while (inCone(p.x, p.y) || (p.x > 300 && Math.abs(p.y - 180) < 70));
    const a = Math.random() * Math.PI * 2;
    const s = 14 + Math.random() * 26;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.life = 1;
    p.dying = false;
    return p;
  };
  const parts = Array.from({ length: 34 }, () => {
    const el = document.createElementNS(NS, 'circle');
    el.setAttribute('r', (1.6 + Math.random() * 2.6).toFixed(1));
    g.appendChild(el);
    return spawn({ el });
  });
  let last = 0;
  return (t) => {
    const dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;
    parts.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 10 || p.x > 470) p.vx *= -1;
      if (p.y < 10 || p.y > 300) p.vy *= -1;
      if (!p.dying && inCone(p.x, p.y)) p.dying = true;
      if (p.dying) {
        p.life -= dt * 2.4;
        if (p.life <= 0) spawn(p);
      }
      p.el.setAttribute('cx', p.x.toFixed(1));
      p.el.setAttribute('cy', p.y.toFixed(1));
      p.el.setAttribute('opacity', (0.2 + 0.6 * Math.max(0, p.life)).toFixed(2));
    });
    const amp = 13 + 9 * Math.sin(t * 2.7) * Math.sin(t * 1.3 + 1);
    let d = '';
    for (let i = 0; i <= 80; i++) {
      const x = 118 + (200 * i) / 80;
      const env = Math.sin(((x - 118) / 200) * Math.PI);
      const y = 180 + Math.sin(x * 0.16 - t * 9) * amp * env * (0.6 + 0.4 * Math.sin(x * 0.05 + t));
      d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    line.setAttribute('d', d);
  };
}

/* 04 — 5 minutes of charge = 5 hours of playback, then a full charge */
function batteryArt(svg) {
  const fill = qs('.batt-wave', svg);
  const minT = qs('.batt-min', svg);
  const hrT = qs('.batt-hours', svg);
  const prog = qs('.batt-progress', svg);
  const bolt = qs('.batt-bolt', svg);
  const L = 104;
  const W = 242;
  const T = 124;
  const H = 102;
  const keys = [[0, 0.02], [2.4, 0.125], [3.8, 0.125], [6.4, 1], [8, 1], [8.6, 0.02]];
  const level = (time) => {
    const t = time % 8.6;
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i];
      const [t1, v1] = keys[i + 1];
      if (t >= t0 && t <= t1) {
        const k = (t - t0) / (t1 - t0);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        return v0 + (v1 - v0) * e;
      }
    }
    return 0.02;
  };
  return (t) => {
    const f = level(t);
    const x = L + W * f;
    let d = `M${L} ${T}`;
    for (let y = T; y <= T + H; y += 6) {
      const xx = f < 0.995 ? x + Math.sin(y * 0.13 + t * 7) * 4 : x;
      d += `L${xx.toFixed(1)} ${y}`;
    }
    d += `L${x.toFixed(1)} ${T + H}L${L} ${T + H}Z`;
    fill.setAttribute('d', d);
    const minutes = f <= 0.125 ? (f / 0.125) * 5 : 5 + ((f - 0.125) / 0.875) * 85;
    minT.textContent = `${Math.round(minutes)} min charge`;
    hrT.textContent = `${Math.round(f * 40)} h playback`;
    prog.setAttribute('width', (296 * f).toFixed(1));
    bolt.setAttribute('transform', `translate(236 175) scale(${(1 + 0.06 * Math.sin(t * 5)).toFixed(3)}) translate(-236 -175)`);
  };
}

/* Animated ANC infographic */
const ENVS = {
  plane: { bands: [38, 31, 24] },
  subway: { bands: [40, 30, 22] },
  office: { bands: [26, 34, 27] },
  cafe: { bands: [30, 36, 29] },
};
function initInfographic() {
  const root = qs('[data-infographic]');
  const steps = qsa('.step', root);
  const track = qs('.pipeline-track', root);
  const pulse = qs('.pulse', track);
  whenVisible(root, (t) => {
    const p = (t % 6) / 6;
    const idx = Math.min(3, Math.floor(p * 4));
    steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
    pulse.style.left = `${(p * 100).toFixed(2)}%`;
    track.style.setProperty('--fill', p.toFixed(3));
  });

  const ticks = qs('.gauge-ticks', root);
  for (let db = 20; db <= 100; db += 10) {
    const a = Math.PI - ((db - 20) / 80) * Math.PI;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', (160 + 104 * Math.cos(a)).toFixed(1));
    line.setAttribute('y1', (170 - 104 * Math.sin(a)).toFixed(1));
    line.setAttribute('x2', (160 + 112 * Math.cos(a)).toFixed(1));
    line.setAttribute('y2', (170 - 112 * Math.sin(a)).toFixed(1));
    ticks.appendChild(line);
    if (db % 20 === 0) {
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', (160 + 90 * Math.cos(a)).toFixed(1));
      text.setAttribute('y', (174 - 90 * Math.sin(a)).toFixed(1));
      text.textContent = db;
      ticks.appendChild(text);
    }
  }
  const out = qs('.gauge-out', root);
  const inn = qs('.gauge-in', root);
  const needle = qs('.gauge-needle', root);
  const outEl = qs('[data-env-out]', root);
  const inEl = qs('[data-env-in]', root);
  const pctEl = qs('[data-env-pct]', root);
  const tabs = qsa('[data-env]', root);
  const frac = (db) => Math.max(0, Math.min(1, (db - 20) / 80));
  let shown = { out: 0, in: 0, pct: 100 };
  let started = false;

  const select = (btn, focus) => {
    tabs.forEach((b) => {
      const on = b === btn;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    if (focus) btn.focus();
    const o = Number(btn.dataset.out);
    const i = Number(btn.dataset.in);
    const pct = Math.round(2 ** (-(o - i) / 10) * 100);
    out.style.strokeDasharray = `${(frac(o) * 100).toFixed(1)} 100`;
    inn.style.strokeDasharray = `${(frac(i) * 100).toFixed(1)} 100`;
    needle.style.transform = `translate(160px, 170px) rotate(${(-90 + frac(i) * 180).toFixed(1)}deg)`;
    const from = { ...shown };
    shown = { out: o, in: i, pct };
    tween(0, 1, 900, (k) => {
      outEl.textContent = Math.round(from.out + (o - from.out) * k);
      inEl.textContent = Math.round(from.in + (i - from.in) * k);
      pctEl.textContent = Math.round(from.pct + (pct - from.pct) * k);
    });
    const bands = ENVS[btn.dataset.env].bands;
    ['low', 'mid', 'high'].forEach((k, j) => {
      qs(`[data-band-${k}]`, root).style.setProperty('--w', `${((bands[j] / 44) * 100).toFixed(1)}%`);
      qs(`[data-band-${k}-v]`, root).textContent = `−${bands[j]} dB`;
    });
    emit('env', btn.dataset.env);
  };
  needle.style.transform = 'translate(160px, 170px) rotate(-90deg)';
  tabs.forEach((b) => b.addEventListener('click', () => select(b, false)));
  qs('.env-tabs', root).addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j !== null) {
      e.preventDefault();
      select(tabs[j], true);
    }
  });
  observe([qs('.env', root)], (e, io) => {
    if (e.isIntersecting && !started) {
      started = true;
      io.disconnect();
      select(tabs.find((b) => b.getAttribute('aria-selected') === 'true') || tabs[0], false);
    }
  }, { threshold: 0.3 });
}

/* “Hear the difference”: synthesized cabin noise + music, with ANC on/off */
function initListen() {
  const btn = qs('[data-listen]');
  const note = qs('[data-listen-note]');
  const ancBtn = qs('[data-anc-toggle]');
  const label = qs('span', btn);
  let ctx = null;
  let nodes = null;
  let timer = 0;
  let playing = false;
  let autoAnc = 0;
  let env = 'plane';
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
  const FILTERS = { plane: ['lowpass', 480], subway: ['lowpass', 850], office: ['bandpass', 1200], cafe: ['bandpass', 2100] };

  const voice = (type, freq, t, dur, peak, dest, attack = 0.01) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const playBar = (t, chord) => {
    chord.forEach((m) => voice('triangle', mtof(m), t, 2.1, 0.07, nodes.music, 0.5));
    voice('sine', mtof(chord[0] - 12), t, 1.9, 0.22, nodes.music, 0.03);
    [0, 1, 2, 1, 0, 1, 2, 1].forEach((k, i) => voice('sine', mtof(chord[k] + 12), t + i * 0.25, 0.4, 0.07, nodes.music));
  };
  const build = () => {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      lastOut = (lastOut + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = lastOut * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const noise = ctx.createGain();
    noise.gain.value = 0.9;
    src.connect(filter).connect(noise).connect(master);
    src.start();
    const music = ctx.createGain();
    music.gain.value = 0.9;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    music.connect(tone).connect(master);
    nodes = { master, filter, noise, music };
    setEnvSound(env);
    let next = ctx.currentTime + 0.1;
    let bar = 0;
    const schedule = () => {
      while (next < ctx.currentTime + 0.7) {
        playBar(next, CHORDS[bar % 4]);
        next += 2;
        bar++;
      }
    };
    schedule();
    timer = setInterval(schedule, 200);
  };
  const setEnvSound = (name) => {
    env = name;
    if (!nodes) return;
    const [type, f] = FILTERS[name] || FILTERS.plane;
    nodes.filter.type = type;
    nodes.filter.frequency.setTargetAtTime(f, ctx.currentTime, 0.2);
  };
  const setAnc = (onState) => {
    if (!nodes) return;
    nodes.noise.gain.setTargetAtTime(onState ? 0.03 : 0.9, ctx.currentTime, 0.3);
    ancBtn.textContent = onState ? 'ANC: On' : 'ANC: Off';
    ancBtn.setAttribute('aria-pressed', String(onState));
  };
  btn.addEventListener('click', async () => {
    if (!playing) {
      if (!ctx) build();
      await ctx.resume();
      nodes.master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.15);
      playing = true;
      setAnc(false);
      clearTimeout(autoAnc);
      autoAnc = setTimeout(() => {
        setAnc(true);
        toast('Adaptive ANC switched on', 'headset');
      }, 3500);
      btn.setAttribute('aria-pressed', 'true');
      label.textContent = 'Stop listening';
      note.hidden = false;
    } else {
      playing = false;
      clearTimeout(autoAnc);
      nodes.master.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      setTimeout(() => {
        if (!playing) ctx.suspend();
      }, 400);
      btn.setAttribute('aria-pressed', 'false');
      label.textContent = 'Hear the difference';
      note.hidden = true;
    }
  });
  ancBtn.addEventListener('click', () => {
    clearTimeout(autoAnc);
    setAnc(ancBtn.getAttribute('aria-pressed') !== 'true');
  });
  on('env', setEnvSound);
  addEventListener('pagehide', () => {
    clearInterval(timer);
    if (ctx) ctx.close();
  });
}

export function initArt() {
  const arts = { anc: ancArt, voice: voiceArt, battery: batteryArt };
  qsa('[data-art]').forEach((svg) => {
    const make = arts[svg.dataset.art];
    if (make) whenVisible(svg, make(svg));
  });
  initInfographic();
  initListen();
}

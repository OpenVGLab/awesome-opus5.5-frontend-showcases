// Real-time synthesized score and sound design (Web Audio, no samples).
import { clamp, sstep, bump, kf, rng } from './core.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- score
const N = { D1: 26, A1: 33, G1: 31, Bb1: 34, F1: 29, E1: 28, D2: 38, E2: 40, F2: 41, Fs2: 42, G2: 43, A2: 45, Bb2: 46, B2: 47, C3: 48, Cs3: 49, D3: 50, E3: 52, F3: 53, Fs3: 54, G3: 55, A3: 57, Bb3: 58, B3: 59, C4: 60, Cs4: 61, D4: 62, E4: 64, F4: 65, Fs4: 66, G4: 67, A4: 69, Bb4: 70, B4: 71, C5: 72, Cs5: 73, D5: 74, E5: 76, F5: 77, Fs5: 78, G5: 79, A5: 81, B5: 83, D6: 86, E6: 88, Fs6: 90, A6: 93 };
const CH = {
  D: [N.D3, N.A3, N.D4, N.Fs4],
  Dlow: [N.D2, N.A2, N.D3, N.Fs3],
  Bm: [N.B2, N.Fs3, N.B3, N.D4],
  G: [N.G2, N.D3, N.B3, N.D4],
  A: [N.A2, N.E3, N.Cs4, N.E4],
  Dm: [N.D3, N.A3, N.D4, N.F4],
  Bb: [N.Bb2, N.F3, N.Bb3, N.D4],
  Gm: [N.G2, N.D3, N.Bb3, N.D4],
  F: [N.F2, N.C4, N.F3, N.A3],
  Em: [N.E2, N.B3, N.E3, N.G3],
  DFs: [N.Fs2, N.A3, N.D4, N.Fs4],
};
export const THEME = {
  a1: [[0, N.Fs4, 1], [1, N.A4, 1], [2, N.D5, 2], [4, N.Cs5, 1], [5, N.B4, 1], [6, N.A4, 2]],
  a2: [[0, N.B4, 1.5], [1.5, N.A4, 0.5], [2, N.Fs4, 1], [3, N.E4, 1], [4, N.Fs4, 4]],
  b: [[0, N.Fs4, 1], [1, N.A4, 1], [2, N.D5, 1.5], [3.5, N.E5, 0.5], [4, N.Fs5, 1], [5, N.E5, 1], [6, N.D5, 2],
    [8, N.B4, 1], [9, N.A4, 1], [10, N.Fs4, 1], [11, N.E4, 1], [12, N.D4, 4]],
};

function buildScore() {
  const E = [];
  const ev = (t, type, p = {}, dur = 1, sustain = false) => E.push({ t, type, p, dur, sustain });
  const pad = (t, notes, dur, vel, bright = 0.35) => ev(t, 'pad', { notes, vel, bright }, dur, true);
  const piano = (t, m, vel = 0.2, dur = 1.5) => ev(t, 'piano', { m, vel }, dur);
  const melody = (t0, beat, notes, type, vel, oct = 0) => {
    for (const [b, m, d] of notes) ev(t0 + b * beat, type, { m: m + oct, vel }, d * beat);
  };
  const whaleSong = (t0, beat, notes, vel, oct, kind) =>
    ev(t0, 'whale', { notes: notes.map(([b, m, d]) => [b * beat, m + oct, d * beat]), vel, kind }, notes.reduce((s, n) => Math.max(s, (n[0] + n[2]) * beat), 0), false);

  // --- opening
  ev(0.3, 'drone', { notes: [N.D2, N.A2], vel: 0.09 }, 19.8, true);
  pad(0.8, [N.D5, N.A5], 7.5, 0.028, 0.3);
  whaleSong(3.0, 1, [[0, 50, 1.2], [1.2, 57, 0.9], [2.1, 53, 1.5]], 0.1, 0, 'far');
  const b72 = 60 / 72 * 4;
  [['D', 7.0], ['Bm', 7 + b72], ['G', 7 + b72 * 2], ['A', 7 + b72 * 3]].forEach(([c, t]) => pad(t, CH[c], b72 + 0.5, 0.07, 0.35));
  const arps = {
    D: [N.D4, N.A4, N.Fs5, N.E5], Bm: [N.B3, N.Fs4, N.D5, N.Cs5], G: [N.G3, N.D4, N.B4, N.A4], A: [N.A3, N.E4, N.Cs5, N.E5],
  };
  ['D', 'Bm', 'G', 'A'].forEach((c, i) => arps[c].forEach((m, k) => piano(7 + b72 * i + k * (b72 / 4), m, 0.16 + (k === 0 ? 0.04 : 0), 2)));
  ev(14.0, 'chime', { m: N.D6, vel: 0.22 }, 2);
  ev(14.3, 'chime', { m: N.A5, vel: 0.16 }, 2);

  // --- storm (84 bpm)
  const b84 = 60 / 84;
  const s0 = 7 + b72 * 4;
  [['Dm', 0], ['Bb', 1], ['Gm', 2], ['A', 3]].forEach(([c, i]) => pad(s0 + i * b84 * 4, CH[c], b84 * 4 + 0.3, 0.075, 0.22));
  const ostRoots = [N.D2, N.Bb1 + 12, N.G2, N.A2];
  for (let k = 0; s0 + k * b84 / 2 < 31.0; k++) {
    const bar = Math.floor(k / 8) % 4;
    const r = ostRoots[bar];
    ev(s0 + k * b84 / 2, 'cello', { m: k % 2 ? r + 12 : r, vel: 0.05 + 0.1 * clamp(k / 70) }, b84 / 2);
  }
  for (let k = 0; s0 + b84 * 4 + k * b84 * 2 < 31.0; k++) ev(s0 + b84 * 4 + k * b84 * 2, 'thump', { vel: 0.18 + 0.02 * k }, 1);
  ev(22.0, 'whoosh', { vel: 0.12, f0: 300, f1: 1200 }, 2.5);
  ev(25.0, 'whoosh', { vel: 0.16, f0: 400, f1: 1500 }, 2.5);
  ev(26.9, 'thunder', { vel: 0.75 }, 5);
  ev(30.2, 'thunder', { vel: 1.0 }, 5);

  // --- underwater
  ev(31.0, 'drone', { notes: [N.D1 + 12, N.A1 + 12], vel: 0.13, deep: 1 }, 12, true);
  for (let t = 31.5; t < 38.3; t += 60 / 62) ev(t, 'thump', { vel: 0.1, soft: 1 }, 1);
  [32.6, 34.9, 37.1].forEach((t, i) => whaleSong(t, 1, [[0, 79 - i, 0.25], [0.25, 84 - i, 0.3], [0.55, 77 - i, 0.55]], 0.1, 0, 'calf'));
  whaleSong(33.6, 1, [[0, 45, 1], [1, 50, 1.2], [2.2, 43, 1.6]], 0.075, 0, 'far');
  ev(36.4, 'thunder', { vel: 0.5 }, 5);
  pad(38.4, [N.D5, N.E5, N.Fs5, N.A5], 5.2, 0.045, 0.6);
  [38.4, 41.3].forEach((t) => ev(t, 'whoosh', { vel: 0.08, f0: 600, f1: 2400 }, 1.6));
  [[39.4, N.A4], [39.9, N.D5], [40.4, N.Fs5], [40.9, N.A5], [41.7, N.E6]].forEach(([t, m]) => ev(t, 'chime', { m, vel: 0.12 }, 2));

  // --- gallery
  pad(43.0, CH.Dm, b84 * 4 + 0.3, 0.075, 0.22);
  pad(43.0 + b84 * 4, CH.Bb, 1.2, 0.07, 0.22);
  for (let k = 0; 43 + k * b84 / 2 < 46.6; k++) ev(43 + k * b84 / 2, 'cello', { m: k % 2 ? N.D3 : N.D2, vel: 0.13 }, b84 / 2);
  ev(45.0, 'thump', { vel: 0.4 }, 1);
  ev(45.35, 'thunder', { vel: 0.9 }, 5);
  pad(46.6, [N.G2, N.D3, N.Bb3, N.D4, N.G4], 1.2, 0.09, 0.5);
  ev(47.55, 'clunk', { vel: 0.5 }, 1);
  pad(47.6, [N.Bb2, N.F3, N.D4, N.F4], 2.2, 0.09, 0.45);

  // --- rescue (76 bpm)
  const b76 = 60 / 76;
  const r0 = 49.5;
  ev(r0, 'thump', { vel: 0.28 }, 1);
  [['Bb', 0, 4], ['F', 4, 4], ['Gm', 8, 2], ['A', 10, 2]].forEach(([c, b, len]) => {
    pad(r0 + b * b76, CH[c], len * b76 + 0.4, 0.085, 0.45);
  });
  [[N.Bb1 + 12, 0], [N.F2, 4], [N.G2, 8], [N.A2, 10]].forEach(([m, b]) => ev(r0 + b * b76, 'bass', { m, vel: 0.2 }, 3));
  const rescueArp = [[0, N.D5], [1, N.F5], [2, N.Bb4], [3, N.F5], [4, N.C5], [5, N.F5], [6, N.A5], [7, N.F5], [8, N.Bb4], [9, N.D5], [10, N.Cs5], [11, N.E5]];
  rescueArp.forEach(([b, m]) => piano(r0 + b * b76, m, 0.17, 1.6));
  ev(53.0, 'thunder', { vel: 0.55 }, 5);
  ev(57.3, 'spout', { vel: 0.12 }, 1.5);
  const res = r0 + 12 * b76;
  pad(res, [N.D3, N.A3, N.D4, N.Fs4, N.A4], 3.2, 0.1, 0.55);
  ev(res, 'bass', { m: N.D2, vel: 0.22 }, 3);
  ev(res, 'chime', { m: N.D6, vel: 0.18 }, 2);
  piano(res, N.Fs5, 0.2, 2.5);
  piano(res + 0.4, N.A5, 0.16, 2.5);

  // --- dawn
  pad(60.3, [N.D3, N.A3, N.Fs4], 4.6, 0.055, 0.3);
  [60.8, 62.5, 63.4, 69.5].forEach((t, i) => ev(t, 'gull', { vel: 0.05 + (i % 2) * 0.02 }, 1));
  const f0 = 65.0;
  pad(64.6, CH.D, 3.8, 0.05, 0.3);
  pad(f0 + 4 * b76, CH.A, 3.4, 0.05, 0.3);
  melody(f0, b76, THEME.a1, 'flute', 0.3);
  const e0 = 71.6;
  pad(e0, CH.D, 3.4, 0.045, 0.3);
  pad(e0 + 4 * b76, CH.A, 3.4, 0.045, 0.3);
  whaleSong(e0, b76, THEME.a1, 0.2, 0, 'calf');
  pad(78.0, CH.G, 3.4, 0.055, 0.32);
  pad(81.16, CH.Bm, 3.4, 0.055, 0.32);
  whaleSong(78.7, 1, [[0, 43, 1.3], [1.3, 50, 1.0], [2.3, 47, 1.7]], 0.13, 0, 'far');
  whaleSong(79.9, 1, [[0, 74, 0.3], [0.3, 78, 0.5]], 0.12, 0, 'calf');
  ev(80.7, 'spout', { vel: 0.2 }, 1.5);
  whaleSong(82.9, 1, [[0, 45, 1.1], [1.1, 52, 1.2]], 0.11, 0, 'far');
  melody(82.5, b76, THEME.a2, 'piano', 0.18);
  pad(82.5, CH.G, 3.3, 0.05, 0.3);
  pad(82.5 + 4 * b76, CH.D, 3.0, 0.05, 0.3);

  // --- years (96 bpm; one bar per day)
  const b96 = 60 / 96;
  [['D', 87.0], ['Bm', 89.5]].forEach(([c, t]) => pad(t, CH[c], 2.7, 0.05, 0.35));
  const yearArp = { D: [N.D4, N.Fs4, N.A4, N.D5, N.A4, N.Fs4, N.A4, N.D5], Bm: [N.B3, N.D4, N.Fs4, N.B4, N.Fs4, N.D4, N.Fs4, N.B4] };
  ['D', 'Bm'].forEach((c, i) => yearArp[c].forEach((m, k) => piano(87 + i * 2.5 + k * b96 / 2, m, 0.1 + (k % 4 === 0 ? 0.04 : 0), 1)));

  // --- old keeper: the song, slower, broken off when the light goes out
  const b60 = 1.0;
  pad(92.0, CH.G, 4.2, 0.05, 0.28);
  pad(96.0, CH.DFs, 3.5, 0.05, 0.28);
  melody(92.4, b60, THEME.a1, 'flute', 0.24);
  ev(99.3, 'cut', {}, 0.5);
  ev(100.6, 'piano', { m: N.D2, vel: 0.26 }, 5);

  // --- fog
  ev(103.6, 'drone', { notes: [N.D2, N.A2, N.F3], vel: 0.065 }, 11, true);
  [105.2, 108.8, 112.4].forEach((t) => ev(t, 'bell', { vel: 0.32 }, 5));

  // --- the song and the glow (76 bpm)
  const w0 = 115.2;
  whaleSong(w0, b76, THEME.a1, 0.34, -12, 'adult');
  pad(w0, CH.Dlow, 3.4, 0.045, 0.35);
  pad(w0 + 4 * b76, CH.A, 3.4, 0.045, 0.38);
  const R = rng(4);
  const penta = [N.A5, N.B5, N.D6, N.E6, N.Fs6, N.A6];
  for (let t = 116.0; t < 127.5; t += 0.35 + R() * 0.4) ev(t, 'chime', { m: penta[Math.floor(R() * penta.length)], vel: 0.035 + R() * 0.05 }, 2);
  const g0 = w0 + 8 * b76;
  whaleSong(g0, b76, THEME.a2, 0.34, -12, 'adult');
  pad(g0, CH.G, 4 * b76 + 0.3, 0.07, 0.45);
  pad(g0 + 4 * b76, CH.D, 4 * b76 + 0.3, 0.075, 0.5);
  [[N.G2, 0], [N.D2, 4]].forEach(([m, b]) => ev(g0 + b * b76, 'bass', { m, vel: 0.18 }, 3));
  const glowArp = [N.G4, N.B4, N.D5, N.B4, N.D4, N.A4, N.D5, N.Fs5];
  glowArp.forEach((m, k) => piano(g0 + k * b76, m, 0.13, 1.8));
  const c0 = g0 + 8 * b76; // climax: phrase B
  melody(c0, b76, THEME.b, 'flute', 0.3);
  melody(c0, b76, THEME.b, 'piano', 0.17);
  whaleSong(c0, b76, THEME.b.slice(0, 7), 0.28, -12, 'adult');
  [['D', 0, 4], ['Bm', 4, 4], ['G', 8, 2], ['A', 10, 2]].forEach(([c, b, len]) => pad(c0 + b * b76, CH[c], len * b76 + 0.3, 0.085, 0.55));
  [[N.D2, 0], [N.B2 - 12, 4], [N.G2, 8], [N.A2, 10], [N.D2, 12]].forEach(([m, b]) => ev(c0 + b * b76, 'bass', { m, vel: 0.2 }, 3));
  ev(c0, 'chime', { m: N.D6, vel: 0.2 }, 2);
  const fin = c0 + 12 * b76;
  pad(fin, [N.D3, N.A3, N.D4, N.Fs4, N.A4, N.D5], 9, 0.085, 0.45);
  [[0.6, N.Fs5], [1.0, N.A5], [1.4, N.D6]].forEach(([dt, m]) => ev(fin + dt, 'chime', { m, vel: 0.13 }, 2.5));
  whaleSong(143.0, 1, [[0, 50, 1.4], [1.4, 57, 1.2], [2.6, 54, 2]], 0.1, 0, 'far');

  E.sort((a, b) => a.t - b.t);
  return E;
}

// Ambience levels over time.
function ambAt(t) {
  const storm = sstep(20.5, 28, t) * (1 - sstep(56, 61, t));
  const under = (t >= 31 && t < 43) || (t >= 114.5 && t < 121);
  const galleryT = t >= 43 && t < 49.5;
  const windowT = t >= 97.5 && t < 100.5;
  let surf = 0.42 + 0.5 * storm;
  if (galleryT) surf = 0.55;
  if (windowT) surf = 0.12;
  if (t >= 103.5 && t < 121) surf = 0.3;
  surf *= 1 - sstep(145.5, 149.8, t);
  let rain = sstep(23.2, 27.5, t) * (1 - sstep(56, 60.5, t));
  if (galleryT) rain = 1;
  let wind = 0.08 + 0.75 * storm;
  if (galleryT) wind = 1;
  if (windowT || (t >= 100.5 && t < 103.5)) wind = 0.35;
  const low = 0.18 + 0.55 * storm + (under ? 0.5 : 0) + (t >= 103.5 && t < 114.5 ? 0.15 : 0);
  return { surf, rain, wind, low, under, fade: 1 - sstep(147, 149.9, t) };
}

// ---------------------------------------------------------------- engine
export class AudioEngine {
  constructor() {
    this.ac = null;
    this.events = buildScore();
    this.cursor = 0;
    this.voices = new Set();
    this.running = false;
    this.muted = false;
    this.cutAt = -1;
  }

  init() {
    if (this.ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ac = (this.ac = new AC({ latencyHint: 'playback' }));
    this.out = ac.createGain();
    this.out.gain.value = this.muted ? 0 : 1;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.008;
    comp.release.value = 0.3;
    this.out.connect(comp).connect(ac.destination);
    this.master = ac.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.out);
    this.reverb = ac.createConvolver();
    this.reverb.buffer = this.makeIR(3.6);
    const rv = ac.createGain();
    rv.gain.value = 0.6;
    this.reverb.connect(rv).connect(this.master);
    this.music = ac.createGain();
    this.music.gain.value = 0.9;
    this.music.connect(this.master);
    const ms = ac.createGain();
    ms.gain.value = 0.42;
    this.music.connect(ms).connect(this.reverb);
    this.wet = ac.createGain();
    this.wet.gain.value = 1;
    this.wet.connect(this.reverb);
    this.world = ac.createBiquadFilter();
    this.world.type = 'lowpass';
    this.world.frequency.value = 18000;
    this.world.Q.value = 0.4;
    this.world.connect(this.master);
    this.sfx = ac.createGain();
    this.sfx.connect(this.world);
    const ss = ac.createGain();
    ss.gain.value = 0.3;
    this.sfx.connect(ss).connect(this.reverb);
    this.noiseBuf = this.makeNoise(5);
    this.buildAmbience();
    return true;
  }

  makeNoise(sec) {
    const ac = this.ac;
    const b = ac.createBuffer(1, Math.floor(ac.sampleRate * sec), ac.sampleRate);
    const d = b.getChannelData(0);
    const r = rng(12);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    return b;
  }

  makeIR(sec) {
    const ac = this.ac;
    const len = Math.floor(ac.sampleRate * sec);
    const b = ac.createBuffer(2, len, ac.sampleRate);
    const r = rng(77);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / ac.sampleRate;
        const env = Math.exp(-x / 0.9) * (x < 0.012 ? x / 0.012 : 1);
        lp += ((r() * 2 - 1) - lp) * (0.55 - 0.4 * (x / sec));
        d[i] = lp * env * 0.6;
      }
    }
    return b;
  }

  noiseSrc(loop = true) {
    const s = this.ac.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  }

  buildAmbience() {
    const ac = this.ac;
    const mk = (type, f, q, dest) => {
      const src = this.noiseSrc();
      src.playbackRate.value = 0.7 + Math.random() * 0.1;
      const flt = ac.createBiquadFilter();
      flt.type = type;
      flt.frequency.value = f;
      flt.Q.value = q;
      const g = ac.createGain();
      g.gain.value = 0;
      src.connect(flt).connect(g).connect(dest);
      src.start();
      return { src, flt, g };
    };
    this.amb = {
      surf: mk('lowpass', 650, 0.3, this.world),
      surf2: mk('bandpass', 380, 0.6, this.world),
      low: mk('lowpass', 140, 0.5, this.world),
      rain: mk('highpass', 1400, 0.4, this.world),
      wind: mk('bandpass', 500, 1.4, this.world),
    };
    const hiss = ac.createBiquadFilter();
    hiss.type = 'lowpass';
    hiss.frequency.value = 9000;
    this.amb.rain.g.disconnect();
    this.amb.rain.g.connect(hiss).connect(this.world);
  }

  setMuted(m) {
    this.muted = m;
    if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 1, this.ac.currentTime, 0.05);
  }

  async resume() {
    if (this.ac && this.ac.state !== 'running') {
      try {
        await this.ac.resume();
      } catch (e) {
        /* autoplay may still be blocked */
      }
    }
  }

  start(t) {
    if (!this.ac) return;
    this.stopAll();
    this.epoch = (this.epoch || 0) + 1;
    this.running = true;
    this.resume();
    let lo = 0;
    while (lo < this.events.length && this.events[lo].t < t - 0.02) lo++;
    this.cursor = lo;
    this.cutAt = -1;
    // sustained sounds already under way
    const now = this.ac.currentTime + 0.03;
    for (let i = 0; i < lo; i++) {
      const e = this.events[i];
      if (e.sustain && e.t + e.dur > t + 0.4 && !(t > 99.3 && e.t < 99.3)) this.play(e, now, t - e.t);
    }
    this.lastT = t;
  }

  pause() {
    this.running = false;
    this.epoch = (this.epoch || 0) + 1;
    this.stopAll(0.12);
    if (this.amb) for (const k in this.amb) this.amb[k].g.gain.setTargetAtTime(0, this.ac.currentTime, 0.08);
  }

  stopAll(fade = 0.05) {
    if (!this.ac) return;
    const now = this.ac.currentTime;
    for (const v of this.voices) {
      try {
        v.out.gain.cancelScheduledValues(now);
        v.out.gain.setValueAtTime(v.out.gain.value, now);
        v.out.gain.linearRampToValueAtTime(0, now + fade);
        for (const s of v.srcs) s.stop(now + fade + 0.02);
      } catch (e) {
        /* already stopped */
      }
    }
    this.voices.clear();
  }

  update(t) {
    if (!this.ac || !this.running) return;
    const now = this.ac.currentTime;
    const horizon = t + 0.3;
    while (this.cursor < this.events.length && this.events[this.cursor].t < horizon) {
      const e = this.events[this.cursor++];
      if (e.t < t - 0.08) continue;
      this.play(e, now + Math.max(0, e.t - t), 0);
    }
    const a = ambAt(t);
    const A = this.amb;
    const sw = 0.62 + 0.38 * Math.sin(t * 0.55) * Math.sin(t * 0.23 + 1);
    const tc = 0.12;
    A.surf.g.gain.setTargetAtTime(a.surf * a.fade * 0.22 * sw, now, tc);
    A.surf2.g.gain.setTargetAtTime(a.surf * a.fade * 0.08 * (1.2 - sw), now, tc);
    A.low.g.gain.setTargetAtTime(a.low * a.fade * 0.3, now, tc);
    A.rain.g.gain.setTargetAtTime(a.rain * a.fade * 0.07, now, tc);
    A.wind.g.gain.setTargetAtTime(a.wind * a.fade * 0.09 * (0.7 + 0.3 * Math.sin(t * 0.9)), now, tc);
    A.wind.flt.frequency.setTargetAtTime(380 + 420 * (0.5 + 0.5 * Math.sin(t * 0.37)) + 300 * a.wind, now, 0.3);
    this.world.frequency.setTargetAtTime(a.under ? 420 : 18000, now, 0.05);
    this.lastT = t;
  }

  voice(srcs, out, end) {
    const v = { srcs, out };
    this.voices.add(v);
    srcs[0].onended = () => {
      this.voices.delete(v);
      try {
        out.disconnect();
      } catch (e) {
        /* ignore */
      }
    };
    for (const s of srcs) s.stop(end);
    return v;
  }

  play(e, when, offset) {
    const p = e.p;
    switch (e.type) {
      case 'pad': return this.pad(when, p.notes, e.dur - offset, p.vel, p.bright, offset > 0);
      case 'drone': return this.drone(when, p.notes, e.dur - offset, p.vel, offset > 0, p.deep);
      case 'piano': return offset ? null : this.piano(when, p.m, e.dur, p.vel);
      case 'flute': return offset ? null : this.flute(when, p.m, e.dur, p.vel);
      case 'whale': return offset ? null : this.whale(when, p.notes, p.vel, p.kind);
      case 'chime': return this.chime(when, p.m, p.vel);
      case 'cello': return this.cello(when, p.m, e.dur, p.vel);
      case 'bass': return this.bass(when, p.m, e.dur, p.vel);
      case 'thump': return this.thump(when, p.vel, p.soft);
      case 'thunder': return this.thunder(when, p.vel);
      case 'whoosh': return this.whoosh(when, e.dur, p.vel, p.f0, p.f1);
      case 'clunk': return this.clunk(when, p.vel);
      case 'bell': return this.bell(when, p.vel);
      case 'gull': return this.gull(when, p.vel);
      case 'spout': return this.spoutSfx(when, p.vel);
      case 'cut': return this.cut(when);
      default: return null;
    }
  }

  cut(when) {
    const d = when - this.ac.currentTime;
    const epoch = this.epoch;
    setTimeout(() => {
      if (!this.running || epoch !== this.epoch) return;
      const now = this.ac.currentTime;
      for (const v of this.voices) {
        try {
          v.out.gain.cancelScheduledValues(now);
          v.out.gain.setValueAtTime(v.out.gain.value, now);
          v.out.gain.setTargetAtTime(0, now, 0.18);
          for (const s of v.srcs) s.stop(now + 1.2);
        } catch (e) {
          /* ignore */
        }
      }
    }, Math.max(0, d * 1000));
  }

  // --- instruments
  pad(when, notes, dur, vel, bright = 0.35, late = false) {
    if (dur <= 0.2) return;
    const ac = this.ac;
    const out = ac.createGain();
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 600 + 1500 * bright;
    flt.Q.value = 0.6;
    flt.connect(out).connect(this.music);
    const srcs = [];
    const per = vel / Math.sqrt(notes.length) / 2.2;
    notes.forEach((m, i) => {
      for (const det of [-7, 6]) {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det + (i % 2 ? 2 : -2);
        const g = ac.createGain();
        g.gain.value = per;
        o.connect(g).connect(flt);
        o.start(when);
        srcs.push(o);
      }
    });
    const tri = ac.createOscillator();
    tri.type = 'triangle';
    tri.frequency.value = mtof(notes[0]) / 2;
    const tg = ac.createGain();
    tg.gain.value = per * 1.4;
    tri.connect(tg).connect(flt);
    tri.start(when);
    srcs.push(tri);
    const atk = late ? 0.4 : Math.min(1.6, dur * 0.4);
    const rel = Math.min(2.2, dur * 0.5);
    const g = out.gain;
    g.setValueAtTime(0, when);
    g.linearRampToValueAtTime(1, when + atk);
    g.setValueAtTime(1, when + Math.max(atk, dur - rel * 0.4));
    g.setTargetAtTime(0, when + Math.max(atk, dur - rel * 0.4), rel / 3);
    flt.frequency.setValueAtTime(400 + 1000 * bright, when);
    flt.frequency.linearRampToValueAtTime(700 + 1700 * bright, when + atk + 0.5);
    this.voice(srcs, out, when + dur + rel + 0.3);
  }

  drone(when, notes, dur, vel, late, deep) {
    if (dur <= 0.3) return;
    const ac = this.ac;
    const out = ac.createGain();
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = deep ? 260 : 420;
    out.connect(this.music);
    flt.connect(out);
    const srcs = [];
    notes.forEach((m, i) => {
      for (const [type, k, gv] of [['sine', 1, 1], ['triangle', 1.002, 0.5], ['sawtooth', 0.998, 0.18]]) {
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.value = mtof(m) * k;
        const g = ac.createGain();
        g.gain.value = (vel * gv) / notes.length;
        o.connect(g).connect(flt);
        o.start(when);
        srcs.push(o);
      }
      void i;
    });
    const atk = late ? 0.5 : Math.min(3, dur * 0.3);
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(1, when + atk);
    out.gain.setValueAtTime(1, when + dur - 1.5);
    out.gain.linearRampToValueAtTime(0, when + dur + 0.5);
    this.voice(srcs, out, when + dur + 0.6);
  }

  piano(when, m, dur, vel) {
    const ac = this.ac;
    const f = mtof(m);
    if (!this.pianoWave) {
      const real = new Float32Array([0, 1, 0.42, 0.2, 0.11, 0.06, 0.035, 0.02]);
      this.pianoWave = ac.createPeriodicWave(real, new Float32Array(real.length));
    }
    const out = ac.createGain();
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.Q.value = 0.3;
    flt.frequency.setValueAtTime(Math.min(12000, f * 7), when);
    flt.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.6), when + 1.2);
    flt.connect(out).connect(this.music);
    const srcs = [];
    for (const det of [0, 4]) {
      const o = ac.createOscillator();
      o.setPeriodicWave(this.pianoWave);
      o.frequency.value = f;
      o.detune.value = det;
      const g = ac.createGain();
      g.gain.value = det ? 0.35 : 0.65;
      o.connect(g).connect(flt);
      o.start(when);
      srcs.push(o);
    }
    const end = when + dur + 1.6;
    const g = out.gain;
    g.setValueAtTime(0, when);
    g.linearRampToValueAtTime(vel, when + 0.004);
    g.exponentialRampToValueAtTime(vel * 0.3, when + 0.9);
    g.exponentialRampToValueAtTime(0.0008, end);
    this.voice(srcs, out, end + 0.05);
  }

  flute(when, m, dur, vel) {
    const ac = this.ac;
    const f = mtof(m);
    const out = ac.createGain();
    out.connect(this.music);
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.985, when);
    o.frequency.exponentialRampToValueAtTime(f, when + 0.07);
    const o2 = ac.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(f * 0.985, when);
    o2.frequency.exponentialRampToValueAtTime(f, when + 0.07);
    const g2 = ac.createGain();
    g2.gain.value = 0.16;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 5.1;
    const lg = ac.createGain();
    lg.gain.setValueAtTime(0, when);
    lg.gain.linearRampToValueAtTime(f * 0.006, when + Math.min(0.5, dur * 0.6));
    lfo.connect(lg);
    lg.connect(o.frequency);
    lg.connect(o2.frequency);
    const n = this.noiseSrc();
    const nf = ac.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = f * 2.2;
    nf.Q.value = 1.4;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0, when);
    ng.gain.linearRampToValueAtTime(0.1, when + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.025, when + 0.2);
    o.connect(out);
    o2.connect(g2).connect(out);
    n.connect(nf).connect(ng).connect(out);
    const len = Math.max(0.12, dur * 0.97);
    const g = out.gain;
    g.setValueAtTime(0, when);
    g.linearRampToValueAtTime(vel, when + 0.07);
    g.setValueAtTime(vel * 0.9, when + len - 0.06);
    g.linearRampToValueAtTime(0, when + len + 0.14);
    o.start(when);
    o2.start(when);
    lfo.start(when);
    n.start(when, Math.random() * 3);
    this.voice([o, o2, lfo, n], out, when + len + 0.2);
  }

  whale(when, notes, vel, kind) {
    const ac = this.ac;
    const out = ac.createGain();
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = kind === 'calf' ? 3200 : kind === 'far' ? 900 : 1800;
    flt.connect(out);
    out.connect(this.music);
    const send = ac.createGain();
    send.gain.value = kind === 'far' ? 1.4 : 0.7;
    out.connect(send).connect(this.wet);
    const o = ac.createOscillator();
    o.type = 'sine';
    const o2 = ac.createOscillator();
    o2.type = 'sine';
    const o3 = ac.createOscillator();
    o3.type = 'sawtooth';
    const g2 = ac.createGain();
    g2.gain.value = kind === 'calf' ? 0.18 : 0.32;
    const g3 = ac.createGain();
    g3.gain.value = kind === 'adult' ? 0.06 : 0.025;
    const f3 = ac.createBiquadFilter();
    f3.type = 'lowpass';
    f3.frequency.value = 700;
    o.connect(flt);
    o2.connect(g2).connect(flt);
    o3.connect(f3).connect(g3).connect(flt);
    const lfo = ac.createOscillator();
    lfo.frequency.value = kind === 'calf' ? 6 : 4.2;
    const lg = ac.createGain();
    lfo.connect(lg);
    lg.connect(o.detune);
    lg.connect(o2.detune);
    lg.connect(o3.detune);
    lg.gain.value = kind === 'calf' ? 22 : 14;
    const g = out.gain;
    g.setValueAtTime(0, when);
    const f0 = mtof(notes[0][1]);
    for (const osc of [o, o3]) osc.frequency.setValueAtTime(f0 * 0.94, when);
    o2.frequency.setValueAtTime(f0 * 2 * 0.94, when);
    let end = when;
    notes.forEach(([dt, m, d], i) => {
      const t0 = when + dt;
      const f = mtof(m);
      const glide = i === 0 ? 0.08 : 0.07;
      o.frequency.setTargetAtTime(f, t0, glide);
      o3.frequency.setTargetAtTime(f, t0, glide);
      o2.frequency.setTargetAtTime(f * 2, t0, glide);
      g.setTargetAtTime(vel, t0, 0.06);
      g.setTargetAtTime(vel * 0.62, t0 + Math.max(0.1, d * 0.7), 0.12);
      end = Math.max(end, t0 + d);
    });
    g.setTargetAtTime(0, end, 0.18);
    for (const osc of [o, o2, o3, lfo]) osc.start(when);
    this.voice([o, o2, o3, lfo], out, end + 1.2);
  }

  chime(when, m, vel) {
    const ac = this.ac;
    const f = mtof(m);
    const out = ac.createGain();
    out.connect(this.music);
    const srcs = [];
    for (const [k, a] of [[1, 1], [4.01, 0.22], [2.0, 0.12]]) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * k;
      const g = ac.createGain();
      g.gain.value = a;
      o.connect(g).connect(out);
      o.start(when);
      srcs.push(o);
    }
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(vel, when + 0.003);
    out.gain.exponentialRampToValueAtTime(0.0006, when + 2.2);
    this.voice(srcs, out, when + 2.3);
  }

  cello(when, m, dur, vel) {
    const ac = this.ac;
    const out = ac.createGain();
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 520;
    flt.Q.value = 1.2;
    flt.connect(out).connect(this.music);
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(m);
    o.connect(flt);
    o.start(when);
    const g = out.gain;
    g.setValueAtTime(0, when);
    g.linearRampToValueAtTime(vel, when + 0.015);
    g.exponentialRampToValueAtTime(vel * 0.25, when + dur * 0.9);
    g.linearRampToValueAtTime(0, when + dur + 0.05);
    this.voice([o], out, when + dur + 0.1);
  }

  bass(when, m, dur, vel) {
    const ac = this.ac;
    const out = ac.createGain();
    out.connect(this.music);
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(m);
    const o2 = ac.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = mtof(m) / 2;
    const g2 = ac.createGain();
    g2.gain.value = 0.6;
    o.connect(out);
    o2.connect(g2).connect(out);
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(vel, when + 0.05);
    out.gain.setTargetAtTime(0, when + dur * 0.7, dur * 0.3);
    o.start(when);
    o2.start(when);
    this.voice([o, o2], out, when + dur + 1);
  }

  thump(when, vel, soft) {
    const ac = this.ac;
    const out = ac.createGain();
    out.connect(this.music);
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(soft ? 70 : 105, when);
    o.frequency.exponentialRampToValueAtTime(soft ? 42 : 46, when + 0.35);
    o.connect(out);
    const n = this.noiseSrc(false);
    const nf = ac.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = soft ? 180 : 420;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(soft ? 0.2 : 0.5, when);
    ng.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
    n.connect(nf).connect(ng).connect(out);
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(vel, when + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0008, when + 1.2);
    o.start(when);
    n.start(when, Math.random() * 3);
    this.voice([o, n], out, when + 1.3);
  }

  thunder(when, vel) {
    const ac = this.ac;
    const out = ac.createGain();
    out.connect(this.sfx);
    const n = this.noiseSrc();
    n.playbackRate.value = 0.6;
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(2200, when);
    flt.frequency.exponentialRampToValueAtTime(110, when + 3.8);
    const flt2 = ac.createBiquadFilter();
    flt2.type = 'lowshelf';
    flt2.frequency.value = 120;
    flt2.gain.value = 10;
    n.connect(flt).connect(flt2).connect(out);
    const g = out.gain;
    g.setValueAtTime(0, when);
    g.linearRampToValueAtTime(vel * 0.9, when + 0.02);
    g.exponentialRampToValueAtTime(vel * 0.3, when + 0.35);
    const r = rng(Math.floor(when * 100));
    let t = when + 0.4;
    for (let i = 0; i < 6; i++) {
      g.linearRampToValueAtTime(vel * (0.25 + 0.4 * r()) * (1 - i / 7), t + 0.2);
      t += 0.35 + r() * 0.5;
    }
    g.linearRampToValueAtTime(0, when + 5);
    n.start(when, Math.random() * 3);
    this.voice([n], out, when + 5.1);
  }

  whoosh(when, dur, vel, f0 = 300, f1 = 1500) {
    const ac = this.ac;
    const out = ac.createGain();
    out.connect(this.sfx);
    const n = this.noiseSrc();
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.Q.value = 1.1;
    flt.frequency.setValueAtTime(f0, when);
    flt.frequency.exponentialRampToValueAtTime(f1, when + dur * 0.5);
    flt.frequency.exponentialRampToValueAtTime(f0 * 1.2, when + dur);
    n.connect(flt).connect(out);
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(vel, when + dur * 0.5);
    out.gain.linearRampToValueAtTime(0, when + dur);
    n.start(when, Math.random() * 3);
    this.voice([n], out, when + dur + 0.05);
  }

  clunk(when, vel) {
    const ac = this.ac;
    const out = ac.createGain();
    out.connect(this.sfx);
    const n = this.noiseSrc(false);
    const nf = ac.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 900;
    nf.Q.value = 2;
    n.connect(nf).connect(out);
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1250, when);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.25, when);
    og.gain.exponentialRampToValueAtTime(0.001, when + 0.5);
    o.connect(og).connect(out);
    const lo = ac.createOscillator();
    lo.type = 'sine';
    lo.frequency.setValueAtTime(90, when);
    lo.frequency.exponentialRampToValueAtTime(50, when + 0.2);
    const lg = ac.createGain();
    lg.gain.setValueAtTime(0.8, when);
    lg.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
    lo.connect(lg).connect(out);
    out.gain.setValueAtTime(vel, when);
    out.gain.exponentialRampToValueAtTime(0.001, when + 0.6);
    n.start(when, Math.random() * 3);
    o.start(when);
    lo.start(when);
    this.voice([n, o, lo], out, when + 0.65);
  }

  bell(when, vel) {
    const ac = this.ac;
    const out = ac.createGain();
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 2600;
    flt.connect(out).connect(this.sfx);
    const f0 = 540;
    const srcs = [];
    [[1, 1, 4.2], [2.0, 0.5, 2.6], [2.76, 0.4, 2.2], [3.9, 0.22, 1.6], [5.4, 0.14, 1.1], [6.8, 0.08, 0.8]].forEach(([k, a, dec]) => {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * k * (1 + (k > 1 ? 0.002 : 0));
      const g = ac.createGain();
      g.gain.setValueAtTime(a * vel, when);
      g.gain.exponentialRampToValueAtTime(0.0005, when + dec);
      o.connect(g).connect(flt);
      o.start(when);
      srcs.push(o);
    });
    out.gain.value = 0.5;
    this.voice(srcs, out, when + 4.5);
  }

  gull(when, vel) {
    const ac = this.ac;
    const out = ac.createGain();
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 1900;
    flt.Q.value = 2.5;
    flt.connect(out).connect(this.sfx);
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    const g = out.gain;
    g.setValueAtTime(0, when);
    let t = when;
    for (let i = 0; i < 3; i++) {
      o.frequency.setValueAtTime(1300, t);
      o.frequency.linearRampToValueAtTime(1850, t + 0.1);
      o.frequency.linearRampToValueAtTime(1150, t + 0.3);
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(vel * (1 - i * 0.25), t + 0.04);
      g.linearRampToValueAtTime(0, t + 0.3);
      t += 0.38;
    }
    o.connect(flt);
    o.start(when);
    this.voice([o], out, t + 0.1);
  }

  spoutSfx(when, vel) {
    const ac = this.ac;
    const out = ac.createGain();
    out.connect(this.sfx);
    const n = this.noiseSrc();
    const flt = ac.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.setValueAtTime(700, when);
    flt.frequency.linearRampToValueAtTime(2500, when + 1.0);
    n.connect(flt).connect(out);
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(vel, when + 0.08);
    out.gain.exponentialRampToValueAtTime(0.001, when + 1.4);
    n.start(when, Math.random() * 3);
    this.voice([n], out, when + 1.5);
  }
}

export { kf };

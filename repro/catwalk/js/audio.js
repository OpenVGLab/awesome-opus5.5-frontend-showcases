// Everything you hear is synthesised here: a late-night lo-fi jazz loop (electric
// piano, walking bass, brushes, vibraphone, pad), vinyl crackle, a city hum, and the
// cat's sounds, including a formant-filtered meow and a purr.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Dm9 → B♭maj9♯11 → Gm9 → A7♭13, two bars each.
const CHORDS = [
  { ep: [53, 57, 60, 64], bass: [38, 41, 45, 48, 50, 48, 45, 35] },
  { ep: [50, 57, 60, 64], bass: [34, 38, 41, 45, 46, 45, 41, 44] },
  { ep: [58, 62, 65, 69], bass: [43, 46, 50, 53, 55, 53, 50, 46] },
  { ep: [55, 59, 61, 65], bass: [45, 49, 52, 55, 57, 55, 52, 39] },
];
const COMP = [
  [[0, 7, 0.75], [7, 3, 0.5], [12, 4, 0.45]],
  [[2, 5, 0.55], [10, 6, 0.65]],
];
const PENTA = [0, 3, 5, 7, 10];
const SWING = [0, 0.28, 0.6, 0.8];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.section = 0;
    this.playing = false;
    this.level = 0;
    this.combo = 0;
    this.lastFish = -9;
    this.seed = 1;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = 0.0001;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.4;
    this.musicLP = lp;
    this.music.connect(lp).connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.4);
    this.rev = ctx.createGain();
    this.rev.gain.value = 0.32;
    this.rev.connect(this.reverb).connect(this.master);
    lp.connect(this.rev);
    const sfxRev = ctx.createGain();
    sfxRev.gain.value = 0.18;
    this.sfx.connect(sfxRev).connect(this.reverb);
    this.noise = this.noiseBuffer(2, 'white');
    this.brown = this.noiseBuffer(3, 'brown');
    this.ambience();
    this.songStart = ctx.currentTime + 0.1;
    this.stepIdx = 0;
    this.playing = true;
    this.timer = setInterval(() => this.schedule(), 25);
    this.music.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
  }

  impulse(sec, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1);
    }
    return b;
  }

  noiseBuffer(sec, kind) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return b;
  }

  ambience() {
    const ctx = this.ctx;
    const hum = ctx.createBufferSource();
    hum.buffer = this.brown; hum.loop = true;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 220;
    const hg = ctx.createGain(); hg.gain.value = 0.12;
    hum.connect(hf).connect(hg).connect(this.master);
    hum.start();
    // vinyl: sparse clicks and a soft hiss
    const len = ctx.sampleRate * 3;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.012;
    for (let k = 0; k < 70; k++) {
      const p = Math.floor(Math.random() * (len - 60));
      const a = 0.15 + Math.random() * 0.5;
      for (let j = 0; j < 40; j++) d[p + j] += (Math.random() * 2 - 1) * a * Math.exp(-j / 6);
    }
    const v = ctx.createBufferSource();
    v.buffer = b; v.loop = true;
    const vf = ctx.createBiquadFilter(); vf.type = 'highpass'; vf.frequency.value = 900;
    const vg = ctx.createGain(); vg.gain.value = 0.22;
    v.connect(vf).connect(vg).connect(this.music);
    v.start();
    // steam hiss, level driven from update()
    const h = ctx.createBufferSource();
    h.buffer = this.noise; h.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    this.hissGain = ctx.createGain(); this.hissGain.gain.value = 0;
    h.connect(hp).connect(this.hissGain).connect(this.sfx);
    h.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  setPaused(p) {
    this.paused = p;
    if (!this.ctx) return;
    if (p) this.ctx.suspend(); else this.ctx.resume();
  }

  startMusic() {
    if (!this.ctx) return;
    this.resolved = false;
    this.fadingOut = false;
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.6);
    this.level = 1;
    this.section = 0;
  }

  setSection(i) {
    this.section = i;
    this.level = [1, 2, 3, 2.5][i] ?? 1;
    if (this.ctx) this.chime([74, 81, 86], 0.06, 0.12);
  }

  // ── sequencer ──
  schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.playing || ctx.state !== 'running') return;
    const spb = 60 / 84;
    while (true) {
      const k = this.stepIdx;
      const beat = Math.floor(k / 4);
      const t = this.songStart + (beat + SWING[k % 4]) * spb;
      if (t > ctx.currentTime + 0.15) break;
      if (t > ctx.currentTime - 0.05) this.playStep(k, t, spb);
      this.stepIdx++;
    }
  }

  rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  playStep(k, t, spb) {
    if (this.resolved) return;
    const bar = Math.floor(k / 16);
    const s = k % 16;
    const ch = CHORDS[Math.floor((bar % 8) / 2)];
    const L = this.level;
    // walking bass on quarter notes
    if (s % 4 === 0) this.bass(midi(ch.bass[(bar % 2) * 4 + s / 4] ), t, spb * 0.95, s === 0 ? 0.34 : 0.27);
    // electric piano comping
    for (const [st, dur, vel] of COMP[bar % 2]) if (st === s) this.chord(ch.ep, t, dur * spb * 0.25, vel * (L === 0 ? 0.8 : 1));
    // brushes
    if (L >= 1) {
      if (s % 2 === 0) this.hat(t, s % 8 === 4 ? 0.07 : 0.04);
      if (s === 4 || s === 12) this.brush(t, 0.11);
      if (s === 0 || (s === 10 && L >= 2)) this.kick(t, 0.5);
      if (L >= 3 && s === 14) this.rim(t, 0.06);
    }
    // vibraphone melody from section II
    if (L >= 2 && s % 2 === 0) {
      const chance = s === 0 ? 0.55 : 0.2;
      if (this.rand() < chance) {
        const deg = PENTA[Math.floor(this.rand() * 5)];
        const oct = this.rand() < 0.3 ? 12 : 0;
        this.vibe(midi(74 + deg + oct), t, 0.12);
      }
    }
    // pad in the neon heights and beyond
    if (L >= 2.5 && s === 0 && bar % 2 === 0) this.pad(ch.ep, t, spb * 8, 0.035);
  }

  voice(freq, t, dur, vel, { type = 'sine', attack = 0.005, release = 0.3, dest = this.music, detune = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vel * 0.4), t + attack + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + release + 0.05);
    return { o, g };
  }

  // FM electric piano: bright bark that mellows, plus a faint tine.
  ep(freq, t, dur, vel) {
    const ctx = this.ctx;
    const car = ctx.createOscillator();
    car.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.frequency.value = freq;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(freq * 1.6 * vel, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.25, t + 0.6);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    const v = 0.09 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 0.2) + 0.45);
    car.connect(g).connect(this.music);
    car.start(t); mod.start(t);
    car.stop(t + dur + 0.6); mod.stop(t + dur + 0.6);
    const tine = this.voice(freq * 7.01, t, 0.03, 0.006 * vel, { release: 0.08 });
    return tine;
  }

  chord(notes, t, dur, vel) {
    notes.forEach((n, i) => this.ep(midi(n), t + i * 0.012 + Math.random() * 0.006, dur, vel * (0.85 + Math.random() * 0.2)));
  }

  bass(freq, t, dur, vel) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(260, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(f);
    f.connect(g).connect(this.music);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  noiseHit(t, { vel, type = 'bandpass', freq = 3000, q = 1, attack = 0.002, decay = 0.08, dest = this.music, rate = 1 }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
    return f;
  }

  hat(t, v) { this.noiseHit(t, { vel: v, type: 'highpass', freq: 7000, decay: 0.05 }); }
  brush(t, v) { this.noiseHit(t, { vel: v, freq: 2600, q: 0.7, attack: 0.03, decay: 0.16 }); }
  rim(t, v) { this.voice(1800, t, 0.01, v, { type: 'triangle', release: 0.03 }); }
  kick(t, v) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 0.5, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(this.music);
    o.start(t); o.stop(t + 0.3);
  }

  vibe(freq, t, vel, dest = this.music) {
    const ctx = this.ctx;
    const car = ctx.createOscillator(); car.frequency.value = freq;
    const mod = ctx.createOscillator(); mod.frequency.value = freq * 4;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(freq * 0.9, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + 0.4);
    mod.connect(mg).connect(car.frequency);
    const trem = ctx.createOscillator(); trem.frequency.value = 5.2;
    const tg = ctx.createGain(); tg.gain.value = 0.3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    const tremG = ctx.createGain(); tremG.gain.value = 0.7;
    trem.connect(tg).connect(tremG.gain);
    car.connect(g).connect(tremG).connect(dest);
    car.start(t); mod.start(t); trem.start(t);
    car.stop(t + 1.7); mod.stop(t + 1.7); trem.stop(t + 1.7);
  }

  pad(notes, t, dur, vel) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 800; f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 1.6);
    g.gain.setValueAtTime(vel, t + dur - 1.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    f.connect(g).connect(this.music);
    for (const n of notes) {
      for (const dt of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = dt;
        o.connect(f); o.start(t); o.stop(t + dur + 0.7);
      }
    }
  }

  chime(notes, gap, vel) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    notes.forEach((n, i) => this.vibe(midi(n), t + i * gap, vel, this.sfx));
  }

  // ── sound effects ──
  now() { return this.ctx ? this.ctx.currentTime + 0.005 : 0; }

  jump() {
    if (!this.ctx) return;
    const t = this.now();
    const f = this.noiseHit(t, { vel: 0.16, freq: 900, q: 1.4, attack: 0.01, decay: 0.13, dest: this.sfx });
    f.frequency.setValueAtTime(800, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
    this.voice(170, t, 0.03, 0.05, { dest: this.sfx, release: 0.05 });
  }

  land(impact) {
    if (!this.ctx) return;
    const t = this.now();
    const v = Math.min(0.25, 0.05 + impact * 0.018);
    this.noiseHit(t, { vel: v, type: 'lowpass', freq: 520, decay: 0.07, dest: this.sfx });
    this.voice(88, t, 0.03, v * 0.5, { dest: this.sfx, release: 0.05 });
  }

  bounce() {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.voice(140, t, 0.12, 0.14, { dest: this.sfx, release: 0.15 });
    o.o.frequency.setValueAtTime(130, t);
    o.o.frequency.exponentialRampToValueAtTime(380, t + 0.18);
    this.noiseHit(t, { vel: 0.12, type: 'lowpass', freq: 400, decay: 0.1, dest: this.sfx });
  }

  bonk() {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.voice(560, t, 0.02, 0.16, { type: 'triangle', dest: this.sfx, release: 0.07 });
    o.o.frequency.exponentialRampToValueAtTime(360, t + 0.08);
    this.meow(t + 0.05, { dur: 0.18, pitch: 1.35, vol: 0.07 });
  }

  bump() {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.voice(120, t, 0.05, 0.16, { dest: this.sfx, release: 0.08 });
    o.o.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    this.noiseHit(t, { vel: 0.08, type: 'lowpass', freq: 300, decay: 0.08, dest: this.sfx });
  }

  fish(count) {
    if (!this.ctx) return;
    const t = this.now();
    this.combo = t - this.lastFish < 1.3 ? this.combo + 1 : 0;
    this.lastFish = t;
    const k = this.combo;
    const note = 74 + PENTA[k % 5] + 12 * Math.min(1, Math.floor(k / 5));
    this.vibe(midi(note), t, 0.2, this.sfx);
    this.voice(midi(note + 24), t + 0.02, 0.02, 0.02, { dest: this.sfx, release: 0.25 });
  }

  checkpoint() {
    if (!this.ctx) return;
    const t = this.now();
    const f = this.noiseHit(t, { vel: 0.12, type: 'lowpass', freq: 300, attack: 0.25, decay: 0.5, dest: this.sfx });
    f.frequency.setValueAtTime(250, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
    [62, 66, 69, 73, 76].forEach((n, i) => this.ep(midi(n), t + 0.15 + i * 0.07, 0.8, 0.7));
  }

  miss(kind) {
    if (!this.ctx) return;
    const t = this.now();
    if (kind === 'glass') {
      for (let i = 0; i < 7; i++) this.voice(2500 + Math.random() * 3500, t + i * 0.025, 0.01, 0.05, { dest: this.sfx, release: 0.2 });
    }
    if (kind === 'vent') this.noiseHit(t, { vel: 0.3, type: 'highpass', freq: 2500, attack: 0.02, decay: 0.5, dest: this.sfx });
    this.meow(t + 0.05, { dur: 0.62, pitch: kind === 'glass' || kind === 'vent' ? 1.25 : 0.95, sad: true, vol: 0.2 });
    this.voice(midi(38), t, 0.8, 0.12, { dest: this.sfx, release: 0.8, type: 'triangle' });
    this.music.gain.setTargetAtTime(0.25, t, 0.1);
    this.music.gain.setTargetAtTime(0.55, t + 1.5, 0.8);
  }

  clear() {
    if (!this.ctx) return;
    const t = this.now();
    this.resolved = true;
    this.music.gain.setTargetAtTime(0.6, t, 0.2);
    [50, 57, 62, 64, 66, 69, 73, 76, 81].forEach((n, i) => this.ep(midi(n), t + 0.1 + i * 0.09, 2.5, 0.8));
    this.voice(midi(38), t + 0.1, 3, 0.25, { type: 'triangle', dest: this.music, release: 2 });
    [86, 90, 93].forEach((n, i) => this.vibe(midi(n), t + 1.0 + i * 0.18, 0.12, this.sfx));
    this.meow(t + 1.6, { dur: 0.35, pitch: 1.2, vol: 0.12 });
    this.purr(t + 2.4, 6);
  }

  gameOver() {
    if (!this.ctx) return;
    const t = this.now();
    [62, 60, 57, 53, 50].forEach((n, i) => this.ep(midi(n), t + i * 0.28, 0.8, 0.6));
    this.music.gain.setTargetAtTime(0.18, t, 0.8);
  }

  flutter() {
    if (!this.ctx) return;
    const t = this.now();
    for (let i = 0; i < 6; i++) this.noiseHit(t + i * 0.055, { vel: 0.05, freq: 700 + Math.random() * 300, q: 1.2, decay: 0.04, dest: this.sfx });
  }

  // "mee-ow": a sawtooth through two moving formant filters.
  meow(t, { dur = 0.5, pitch = 1, sad = false, vol = 0.2 } = {}) {
    const ctx = this.ctx;
    const f0 = 480 * pitch;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 0.9, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.3, t + dur * 0.32);
    o.frequency.linearRampToValueAtTime(sad ? f0 * 0.68 : f0 * 1.02, t + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6.5;
    const lg = ctx.createGain(); lg.gain.value = f0 * 0.018;
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.045);
    g.gain.setValueAtTime(vol * 0.85, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
    f1.type = f2.type = 'bandpass';
    f1.Q.value = 7; f2.Q.value = 9;
    f1.frequency.setValueAtTime(380, t); f1.frequency.linearRampToValueAtTime(950, t + dur * 0.35); f1.frequency.linearRampToValueAtTime(430, t + dur);
    f2.frequency.setValueAtTime(2300, t); f2.frequency.linearRampToValueAtTime(1450, t + dur * 0.4); f2.frequency.linearRampToValueAtTime(900, t + dur);
    const mix = ctx.createGain(); mix.gain.value = 1.4;
    o.connect(f1); o.connect(f2);
    f1.connect(g); f2.connect(g);
    g.connect(mix).connect(this.sfx);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  purr(t, dur) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.brown; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const am = ctx.createGain(); am.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 26;
    const lg = ctx.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    for (let k = 0; k < dur; k += 1.6) {
      env.gain.linearRampToValueAtTime(0.35, t + k + 0.6);
      env.gain.linearRampToValueAtTime(0.12, t + k + 1.5);
    }
    env.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
    src.connect(f).connect(am).connect(env).connect(this.sfx);
    src.start(t); lfo.start(t);
    src.stop(t + dur + 0.6); lfo.stop(t + dur + 0.6);
  }

  update(dt, game) {
    if (!this.ctx || !this.hissGain) return;
    let hiss = 0;
    const props = game.stage.hazards;
    for (const h of props) {
      if (h.kind !== 'vent') continue;
      const d = Math.abs(h.cx - game.body.x);
      if (d > 7) continue;
      const p = ((game.scrollX - h.cx) / h.period + h.offset) % 1;
      const ph = p < 0 ? p + 1 : p;
      const on = ph < h.duty ? 1 : ph > 0.82 ? 0.25 : 0;
      hiss = Math.max(hiss, on * (1 - d / 7) * 0.09);
    }
    this.hissGain.gain.setTargetAtTime(hiss, this.ctx.currentTime, 0.05);
    const inMenu = game.state === 'title';
    this.musicLP.frequency.setTargetAtTime(inMenu ? 2600 : 5200, this.ctx.currentTime, 0.5);
  }
}

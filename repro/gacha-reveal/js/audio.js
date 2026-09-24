// All sound is synthesized live with Web Audio: no audio files.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = [
  { pad: [50, 57, 61, 64, 66], arp: [74, 78, 81, 85, 88, 81, 78, 76], root: 38 }, // Dmaj9
  { pad: [47, 54, 57, 61, 62], arp: [71, 74, 78, 81, 85, 81, 78, 74], root: 35 }, // Bm9
  { pad: [43, 50, 54, 57, 61], arp: [67, 71, 74, 78, 81, 78, 74, 73], root: 31 }, // Gmaj7#11
  { pad: [45, 52, 57, 59, 62], arp: [69, 74, 76, 81, 83, 76, 74, 71], root: 33 }, // Asus
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = false;
  }

  init(offline = null) {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC && !offline) return;
    const ctx = (this.ctx = offline || new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.4, 2.6);
    const revOut = ctx.createGain();
    revOut.gain.value = 0.42;
    this.reverb.connect(revOut).connect(this.master);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.85;
    this.sfx.connect(this.master);
    this.sfxRev = ctx.createGain();
    this.sfxRev.gain.value = 1;
    this.sfxRev.connect(this.reverb);

    this.music = ctx.createGain();
    this.music.gain.value = 0.5;
    this.music.connect(this.master);
    this.musicRev = ctx.createGain();
    this.musicRev.gain.value = 0.9;
    this.music.connect(this.musicRev).connect(this.reverb);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (!offline) this.startMusic();
  }

  impulse(sec, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  setSuspended(hidden) {
    if (!this.ctx || !this.ctx.suspend) return;
    if (hidden) this.ctx.suspend();
    else this.ctx.resume();
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) return;
    const t = this.now;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.05);
  }

  /* ------------------------------------------------------------ primitives */

  tone({ type = 'sine', f = 440, f2 = null, glide = null, t = this.now, a = 0.005, d = 0.3, g = 0.2, rev = 0.25, detune = 0, dest = null, lp = null, lp2 = null }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (glide ?? a + d));
    o.detune.value = detune;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(g, t + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    let node = o;
    if (lp) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.setValueAtTime(lp, t);
      if (lp2) fl.frequency.exponentialRampToValueAtTime(lp2, t + a + d);
      o.connect(fl);
      node = fl;
    }
    node.connect(gn);
    gn.connect(dest || this.sfx);
    if (rev > 0) {
      const s = ctx.createGain();
      s.gain.value = rev;
      gn.connect(s).connect(dest === this.music ? this.musicRev : this.sfxRev);
    }
    o.start(t);
    o.stop(t + a + d + 0.05);
    return o;
  }

  noise({ t = this.now, a = 0.005, d = 0.3, g = 0.3, type = 'bandpass', f = 1000, f2 = null, q = 1, rev = 0.2, swell = false }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    fl.Q.value = q;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    if (swell) {
      gn.gain.exponentialRampToValueAtTime(g, t + a);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    } else {
      gn.gain.exponentialRampToValueAtTime(g, t + a);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
    src.connect(fl).connect(gn).connect(this.sfx);
    if (rev > 0) {
      const s = ctx.createGain();
      s.gain.value = rev;
      gn.connect(s).connect(this.sfxRev);
    }
    src.start(t, Math.random() * 1.5);
    src.stop(t + a + d + 0.05);
  }

  bell(f, t = this.now, g = 0.12, d = 2.0, rev = 0.6, dest = null) {
    const partials = [[1, 1], [2.01, 0.42], [2.76, 0.3], [5.4, 0.12], [8.93, 0.05]];
    for (const [r, amp] of partials) {
      if (f * r > 16000) continue;
      this.tone({ f: f * r, t, a: 0.002, d: d / (1 + r * 0.35), g: g * amp, rev, dest });
    }
  }

  boom(t = this.now, g = 0.5, f = 110, f2 = 36, d = 1.3) {
    this.tone({ f, f2, glide: d * 0.6, t, a: 0.008, d, g, rev: 0.15 });
    this.noise({ t, a: 0.004, d: 0.35, g: g * 0.5, type: 'lowpass', f: 900, f2: 120, rev: 0.1 });
  }

  /* ------------------------------------------------------------ music */

  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    this.step = 0;
    this.nextT = this.now + 0.15;
    this.timer = setInterval(() => this.schedule(), 90);
  }

  schedule() {
    const eighth = 0.375;
    if (this.nextT < this.now - 0.2) this.nextT = this.now + 0.05;
    while (this.nextT < this.now + 0.45) {
      this.playStep(this.step, this.nextT, eighth);
      this.nextT += eighth;
      this.step++;
    }
  }

  playStep(s, t, eighth) {
    const ch = CHORDS[Math.floor(s / 16) % CHORDS.length];
    const pos = s % 16;
    if (pos === 0) {
      const dur = eighth * 16;
      for (const n of ch.pad) {
        for (const det of [-7, 7]) {
          this.tone({ type: 'sawtooth', f: NOTE(n), t, a: 1.6, d: dur + 1.2, g: 0.012, detune: det, dest: this.music, rev: 0.6, lp: 700, lp2: 1400 });
        }
      }
      this.tone({ f: NOTE(ch.root), t, a: 1.2, d: dur, g: 0.06, dest: this.music, rev: 0 });
    }
    const pattern = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];
    if (pattern[pos] && Math.random() > 0.12) {
      const n = ch.arp[pos % ch.arp.length] + (Math.random() > 0.86 ? 12 : 0);
      this.bell(NOTE(n), t, 0.028 + Math.random() * 0.018, 1.6, 0.7, this.music);
    }
  }

  duckMusic(on) {
    if (!this.ctx) return;
    const t = this.now;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(on ? 0.07 : 0.5, t, on ? 0.25 : 0.8);
  }

  silence(dur) {
    if (!this.ctx) return;
    const t = this.now;
    this.sfx.gain.cancelScheduledValues(t);
    this.sfx.gain.setTargetAtTime(0.0001, t, 0.02);
    this.sfx.gain.setTargetAtTime(0.85, t + dur, 0.01);
    this.sfxRev.gain.cancelScheduledValues(t);
    this.sfxRev.gain.setTargetAtTime(0.0001, t, 0.05);
    this.sfxRev.gain.setTargetAtTime(1, t + dur, 0.01);
  }

  /* ------------------------------------------------------------ sfx */

  ok() {
    return this.ctx && this.enabled;
  }

  click() {
    if (!this.ok()) return;
    const t = this.now;
    this.tone({ f: 1100, f2: 1760, t, a: 0.003, d: 0.07, g: 0.2, rev: 0.2 });
    this.tone({ type: 'triangle', f: 2640, t: t + 0.02, a: 0.002, d: 0.06, g: 0.07, rev: 0.3 });
  }

  tap() {
    if (!this.ok()) return;
    this.tone({ f: 1320, t: this.now, a: 0.002, d: 0.05, g: 0.12, rev: 0.2 });
  }

  summonStart(tier, dur) {
    if (!this.ok()) return;
    const t = this.now;
    this.boom(t, 0.55, 120, 38, 1.6);
    this.noise({ t, a: dur * 0.95, d: 0.25, g: 0.16, f: 250, f2: 5200, q: 1.4, rev: 0.4 });
    this.tone({ type: 'sawtooth', f: 55, t, a: dur * 0.8, d: dur * 0.5, g: 0.07, lp: 160, lp2: 1600, rev: 0.2 });
    this.tone({ type: 'sawtooth', f: 82.4, t, a: dur * 0.8, d: dur * 0.5, g: 0.04, lp: 160, lp2: 1800, rev: 0.2 });
    const scale = [62, 66, 69, 73, 74, 78, 81, 85, 86, 90, 93, 97];
    for (let i = 0; i < 16; i++) {
      const k = i / 16;
      const tt = t + dur * (1 - Math.pow(1 - k, 1.7));
      this.bell(NOTE(scale[i % scale.length] + (tier === 2 ? 2 : 0)), tt, 0.05 + k * 0.05, 1.1, 0.6);
    }
  }

  promote(tier) {
    if (!this.ok()) return;
    const t = this.now;
    this.boom(t, tier === 2 ? 0.7 : 0.45, 160, 45, 0.9);
    this.noise({ t, a: 0.004, d: tier === 2 ? 1.8 : 0.9, g: tier === 2 ? 0.2 : 0.1, type: 'highpass', f: 5000, rev: 0.5 });
    const notes = tier === 2 ? [86, 90, 93, 97, 98, 102] : [88, 91, 95, 100];
    notes.forEach((n, i) => this.bell(NOTE(n), t + i * 0.055, 0.12, 2.2, 0.7));
    if (tier === 2) {
      const choir = [62, 66, 69, 74, 78];
      for (const n of choir) {
        for (const det of [-9, 0, 9]) {
          this.tone({ type: 'sawtooth', f: NOTE(n), t, a: 0.35, d: 1.9, g: 0.016, detune: det, lp: 1400, lp2: 2600, rev: 0.8 });
        }
      }
      for (let i = 0; i < 14; i++) this.bell(NOTE(74 + i * 2), t + 0.2 + i * 0.035, 0.05, 1.2, 0.7);
    }
  }

  climax(dur) {
    if (!this.ok()) return;
    const t = this.now;
    this.tone({ type: 'sawtooth', f: 180, f2: 1800, glide: dur, t, a: dur * 0.9, d: 0.1, g: 0.06, lp: 800, lp2: 5000, rev: 0.3 });
    this.noise({ t, a: dur * 0.95, d: 0.08, g: 0.2, f: 800, f2: 8000, q: 0.8, rev: 0.3 });
  }

  burst() {
    if (!this.ok()) return;
    const t = this.now;
    this.noise({ t, a: 0.005, d: 1.6, g: 0.55, type: 'lowpass', f: 9000, f2: 160, q: 0.7, rev: 0.5 });
    this.tone({ f: 95, f2: 30, glide: 1.2, t, a: 0.01, d: 1.9, g: 0.75, rev: 0.2 });
    this.noise({ t: t + 0.02, a: 0.01, d: 2.4, g: 0.16, type: 'highpass', f: 3500, rev: 0.7 });
    [81, 85, 88, 93].forEach((n, i) => this.bell(NOTE(n), t + 0.05 + i * 0.04, 0.09, 2.6, 0.8));
  }

  shardFly() {
    if (!this.ok()) return;
    const t = this.now;
    this.noise({ t, a: 0.12, d: 0.28, g: 0.24, f: 700, f2: 4200, q: 1.2, rev: 0.3 });
    this.tone({ f: 1200, f2: 2600, t, a: 0.1, d: 0.25, g: 0.07, rev: 0.4 });
  }

  cardAppear(tier) {
    if (!this.ok()) return;
    const t = this.now;
    this.tone({ f: 260, f2: 620, t, a: 0.02, d: 0.35, g: 0.18, rev: 0.3 });
    this.bell(NOTE([81, 84, 86][tier]), t + 0.02, 0.1, 1.4, 0.6);
  }

  flip(tier) {
    if (!this.ok()) return;
    const t = this.now;
    this.noise({ t, a: 0.02, d: 0.14, g: 0.2, f: 2600, f2: 6500, q: 1.5, rev: 0.2 });
    this.bell(NOTE(tier === 0 ? 88 : 93), t + 0.05, 0.1, 1.2, 0.5);
  }

  revealR() {
    if (!this.ok()) return;
    const t = this.now;
    [76, 81, 85].forEach((n, i) => this.bell(NOTE(n), t + i * 0.05, 0.07, 1.4, 0.5));
  }

  goldCharge(dur) {
    if (!this.ok()) return;
    const t = this.now;
    this.noise({ t, a: dur, d: 0.1, g: 0.12, f: 1200, f2: 6000, q: 2, rev: 0.4 });
    for (let i = 0; i < 10; i++) {
      const k = i / 10;
      this.bell(NOTE(i % 2 ? 95 : 88), t + dur * (1 - Math.pow(1 - k, 1.6)), 0.04 + k * 0.03, 0.8, 0.5);
    }
  }

  goldReveal() {
    if (!this.ok()) return;
    const t = this.now;
    this.boom(t, 0.35, 150, 50, 0.7);
    [76, 80, 83, 88, 92].forEach((n, i) => this.bell(NOTE(n), t + i * 0.045, 0.1, 2.2, 0.7));
    this.noise({ t, a: 0.004, d: 1.0, g: 0.08, type: 'highpass', f: 6000, rev: 0.6 });
  }

  stars(n, tier, delay = 0.1, gap = 0.12) {
    if (!this.ok()) return;
    const t = this.now + delay;
    const notes = [88, 90, 92, 95, 97];
    for (let i = 0; i < n; i++) {
      const last = tier === 2 && i === n - 1;
      this.bell(NOTE(notes[i] + (tier === 2 ? 2 : 0)), t + i * gap, last ? 0.13 : 0.08, last ? 2.4 : 1.2, 0.6);
    }
  }

  crack(level) {
    if (!this.ok()) return;
    const t = this.now;
    this.noise({ t, a: 0.001, d: 0.09 + level * 0.05, g: 0.3 + level * 0.15, type: 'highpass', f: 2600, rev: 0.4 });
    this.tone({ f: 70, f2: 40, t, a: 0.004, d: 0.4, g: 0.25 + level * 0.15, rev: 0.1 });
    for (let i = 0; i < 3 + level * 3; i++) {
      this.tone({ f: 2500 + Math.random() * 4500, t: t + Math.random() * 0.12, a: 0.001, d: 0.06, g: 0.04, rev: 0.5 });
    }
  }

  shatter() {
    if (!this.ok()) return;
    const t = this.now;
    this.noise({ t, a: 0.002, d: 1.0, g: 0.4, type: 'highpass', f: 1800, rev: 0.6 });
    this.boom(t, 0.6, 130, 32, 1.4);
    for (let i = 0; i < 26; i++) {
      this.tone({ f: 2200 + Math.random() * 5200, t: t + Math.random() * 0.7, a: 0.001, d: 0.05 + Math.random() * 0.12, g: 0.035, rev: 0.6 });
    }
  }

  thunder() {
    if (!this.ok()) return;
    const t = this.now;
    this.noise({ t, a: 0.002, d: 0.14, g: 0.5, type: 'highpass', f: 1400, rev: 0.4 });
    this.noise({ t: t + 0.03, a: 0.03, d: 2.2, g: 0.45, type: 'lowpass', f: 520, f2: 110, q: 0.8, rev: 0.4 });
    this.tone({ f: 62, f2: 34, t, a: 0.01, d: 1.4, g: 0.4, rev: 0.2 });
  }

  ssrFanfare() {
    if (!this.ok()) return;
    const t = this.now;
    const chord = [62, 66, 69, 74, 78, 81];
    const hits = [[0, 0.1], [0.15, 0.1], [0.3, 2.0]];
    for (const [off, len] of hits) {
      for (const n of chord) {
        for (const det of [-6, 6]) {
          this.tone({ type: 'sawtooth', f: NOTE(n), t: t + off, a: 0.03, d: len, g: 0.022, detune: det, lp: 3800, lp2: 900, rev: 0.5 });
        }
      }
      this.tone({ f: 98, f2: 60, t: t + off, a: 0.004, d: 0.45, g: 0.4, rev: 0.2 });
    }
    this.noise({ t: t + 0.3, a: 0.02, d: 2.6, g: 0.14, type: 'highpass', f: 4200, rev: 0.7 });
    for (let i = 0; i < 18; i++) this.bell(NOTE(74 + i * 2), t + 0.34 + i * 0.03, 0.045, 1.4, 0.7);
  }

  ssrReveal() {
    if (!this.ok()) return;
    const t = this.now;
    this.boom(t, 0.7, 120, 32, 1.8);
    this.noise({ t, a: 0.004, d: 2.4, g: 0.18, type: 'highpass', f: 5200, rev: 0.8 });
    const choir = [62, 69, 74, 78, 81, 85];
    for (const n of choir) {
      for (const det of [-10, 0, 10]) {
        this.tone({ type: 'sawtooth', f: NOTE(n), t, a: 0.5, d: 2.8, g: 0.013, detune: det, lp: 1600, lp2: 3200, rev: 0.9 });
      }
    }
    const casc = [105, 102, 98, 97, 93, 90, 86, 85, 81, 78];
    casc.forEach((n, i) => this.bell(NOTE(n), t + 0.08 + i * 0.07, 0.07, 2.2, 0.8));
  }

  whoosh() {
    if (!this.ok()) return;
    this.noise({ t: this.now, a: 0.05, d: 0.28, g: 0.08, f: 2600, f2: 500, q: 1, rev: 0.2 });
  }

  results() {
    if (!this.ok()) return;
    const t = this.now + 0.1;
    [74, 78, 81, 86, 90].forEach((n, i) => this.bell(NOTE(n), t + i * 0.08, 0.08, 1.8, 0.7));
  }

  cardPop(tier, i) {
    if (!this.ok()) return;
    this.tone({ f: 700 + i * 60, t: this.now, a: 0.002, d: 0.08, g: 0.04, rev: 0.3 });
    if (tier > 0) this.bell(NOTE(tier === 2 ? 98 : 93), this.now, 0.05, 1.2, 0.6);
  }
}

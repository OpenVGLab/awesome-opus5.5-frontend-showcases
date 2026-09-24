// Generative lo-fi engine built on the Web Audio API: every note is synthesised live (no files).
// Structure: lookahead scheduler → pads, bass, pluck melody, soft drums, vinyl crackle → reverb.
const BPM = 76;
const SIXTEENTH = 60 / BPM / 4;
const PROGRESSION = [
  [53, 57, 60, 64], // Fmaj7
  [52, 55, 59, 62], // Em7
  [50, 53, 57, 60], // Dm7
  [48, 52, 55, 59], // Cmaj7
];
const PENTATONIC = [0, 2, 4, 7, 9];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class LofiEngine {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.volume = 0.55;
    this.step = 0;
    this.timer = null;
    this.stopTimer = null;
    this.rand = Math.random;
  }

  get analyser() {
    return this.analyserNode;
  }

  build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 128;
    this.analyserNode.smoothingTimeConstant = 0.82;
    this.master.connect(comp).connect(this.analyserNode).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    this.reverb.connect(wet).connect(this.master);

    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = SIXTEENTH * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 2200;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    dlp.connect(this.master);

    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 820;
    this.padFilter.Q.value = 0.6;
    this.padFilter.connect(this.master);
    this.padFilter.connect(this.reverb);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  impulse(seconds) {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  async start() {
    if (!this.ctx) this.build();
    window.clearTimeout(this.stopTimer);
    await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(this.volume, t + 1.4);
    if (!this.timer) {
      this.nextTime = t + 0.08;
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
    this.playing = true;
  }

  stop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 0.7);
    this.playing = false;
    this.stopTimer = window.setTimeout(() => {
      window.clearInterval(this.timer);
      this.timer = null;
      this.ctx.suspend();
    }, 800);
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx && this.playing) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  dispose() {
    window.clearInterval(this.timer);
    window.clearTimeout(this.stopTimer);
    this.ctx?.close();
    this.ctx = null;
    this.timer = null;
  }

  schedule() {
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += SIXTEENTH;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, time) {
    const inBar = step % 16;
    const chord = PROGRESSION[Math.floor(step / 16) % 4];
    const swing = inBar % 2 === 1 ? SIXTEENTH * 0.18 : 0;
    const t = time + swing;

    if (inBar === 0) {
      this.pad(chord, t, SIXTEENTH * 16);
      this.bass(chord[0] - 12, t, SIXTEENTH * 6);
    }
    if (inBar === 8) this.bass(chord[0] - 5, t, SIXTEENTH * 5);
    if (inBar === 0 || inBar === 10) this.kick(t);
    if (inBar === 4 || inBar === 12) this.snare(t);
    if (inBar % 2 === 0) this.hat(t, inBar % 4 === 2 ? 0.05 : 0.025);
    if (inBar % 2 === 0 && this.rand() < 0.42) {
      const root = chord[0] + 12;
      const note = root + PENTATONIC[Math.floor(this.rand() * PENTATONIC.length)] + (this.rand() < 0.3 ? 12 : 0);
      this.pluck(note, t);
    }
    if (this.rand() < 0.3) this.crackle(time + this.rand() * SIXTEENTH);
  }

  pad(chord, t, dur) {
    const { ctx } = this;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.06, t + 0.9);
    env.gain.setValueAtTime(0.06, t + dur - 0.4);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.8);
    env.connect(this.padFilter);
    chord.forEach((m) => {
      [-7, 7].forEach((detune) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(m);
        o.detune.value = detune;
        o.connect(env);
        o.start(t);
        o.stop(t + dur + 0.9);
      });
    });
  }

  bass(m, t, dur) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  pluck(m, t) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(m);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(f).connect(g);
    g.connect(this.master);
    g.connect(this.delay);
    g.connect(this.reverb);
    o.start(t);
    o.stop(t + 1);
  }

  kick(t) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.4);
  }

  noiseHit(t, { type, freq, q = 1, gain, decay }) {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.02);
    return g;
  }

  snare(t) {
    const g = this.noiseHit(t, { type: 'bandpass', freq: 1800, q: 0.8, gain: 0.14, decay: 0.18 });
    g.connect(this.reverb);
  }

  hat(t, gain) {
    this.noiseHit(t, { type: 'highpass', freq: 7000, gain, decay: 0.05 });
  }

  crackle(t) {
    this.noiseHit(t, { type: 'highpass', freq: 2500, gain: 0.02 + Math.random() * 0.03, decay: 0.012 });
  }
}

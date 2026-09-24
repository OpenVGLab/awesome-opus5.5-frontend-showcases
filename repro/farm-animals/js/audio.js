/*
 * Every sound in the game is synthesised live with the Web Audio API:
 * animal voices are shaped oscillators pushed through moving formant filters,
 * the ambience is filtered noise and FM chirps, and the music is a small generative waltz.
 */

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const CALL_TEXT = {
  horse: ['Neigh!', 'Neeeigh!', 'Hrrr-neigh!'],
  pig: ['Oink oink!', 'Oink!', 'Oink oink oink!'],
  cow: ['Moooo!', 'Mooo!', 'Moo-oo!'],
  cat: ['Meow!', 'Miaow!', 'Mew!'],
  dog: ['Woof woof!', 'Woof!', 'Arf arf!'],
  sheep: ['Baa!', 'Baa-aa!', 'Meh-eh-eh!'],
  duck: ['Quack quack!', 'Quack!'],
  hen: ['Cluck cluck!', 'Bawk!', 'Buk-buk-bawk!'],
  rabbit: ['*thump thump*', 'Squeak!'],
  hedgehog: ['Snuffle snuffle!', 'Hmph-hmph!'],
};
/* The greeting sounds – different from the everyday calls */
export const GREET_TEXT = {
  horse: 'Brrr-hu-hu-hu!',
  pig: 'Wheeee!',
  cow: 'Mm-hmm... moo?',
  cat: 'Mrrrp! Purrrr...',
  dog: 'A-wooo!',
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.L = { x: 0, z: 0, yaw: 0 };
    this.hives = [];
    this.pond = null;
    this.bell = null;
    this._engines = new Set();
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = new AC();
    this.ctx = c;
    this.master = c.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    this.master.connect(comp);
    comp.connect(c.destination);
    const bus = (v) => { const g = c.createGain(); g.gain.value = v; g.connect(this.master); return g; };
    this.sfxBus = bus(0.85);
    this.voiceBus = bus(0.9);
    this.ambBus = bus(0.6);
    this.musicBus = bus(0.3);
    this.verb = c.createConvolver();
    this.verb.buffer = this._impulse(1.8, 3.5);
    this.verbSend = c.createGain();
    this.verbSend.gain.value = 0.22;
    this.verbSend.connect(this.verb);
    this.verb.connect(this.master);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = c.createBuffer(1, len, c.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.shaper = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 255) * 2 - 1; curve[i] = Math.tanh(x * 2.2); }
    this.curve = curve;
    this._startAmbience();
    this._startMusic();
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 1 : 0, t, 0.08);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  get ready() { return !!this.ctx && this.enabled; }

  setListener(x, z, yaw) { this.L.x = x; this.L.z = z; this.L.yaw = yaw; }

  spatial(pos, ref = 16) {
    if (!pos) return { gain: 1, pan: 0 };
    const dx = pos.x - this.L.x, dz = pos.z - this.L.z;
    const d = Math.hypot(dx, dz);
    const gain = 1 / (1 + (d / ref) * (d / ref));
    const rx = -Math.cos(this.L.yaw), rz = Math.sin(this.L.yaw);
    const pan = clamp(((dx * rx + dz * rz) / Math.max(d, 2)) * 0.8, -0.85, 0.85);
    return { gain, pan, d };
  }

  /* output node for one sound: gain → pan → bus (+ a little reverb) */
  _out(bus, gain = 1, pan = 0, life = 3, verb = 1) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = gain;
    const p = c.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(bus);
    let send = null;
    if (verb > 0) { send = c.createGain(); send.gain.value = verb; p.connect(send); send.connect(this.verbSend); }
    setTimeout(() => { try { g.disconnect(); p.disconnect(); if (send) send.disconnect(); } catch (e) { /* already gone */ } }, life * 1000 + 400);
    return g;
  }

  _impulse(sec, decay) {
    const c = this.ctx;
    const n = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 90 ? i / 90 : 1);
    }
    return buf;
  }

  _osc(type, f, t0, t1) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    o.start(t0);
    o.stop(t1);
    return o;
  }
  _noise(t0, t1, brown = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = brown ? this.brown : this.noise;
    s.loop = true;
    s.start(t0, Math.random() * 1.5);
    s.stop(t1);
    return s;
  }
  _filter(type, f, q = 1, gain = 0) {
    const b = this.ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain;
    return b;
  }
  _gain(v = 0) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  /* attack / hold / release envelope on a gain param */
  _env(param, t, a, peak, hold, rel, end = 0.0001) {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.setValueAtTime(peak, t + a + hold);
    param.exponentialRampToValueAtTime(Math.max(end, 0.0001), t + a + hold + rel);
  }
  _lfo(freq, depth, t0, t1, type = 'sine') {
    const o = this._osc(type, freq, t0, t1);
    const g = this._gain(depth);
    o.connect(g);
    return { osc: o, out: g };
  }
  /* amplitude modulation: returns a gain node whose level wobbles between (1-depth) and 1 */
  _am(freq, depth, t0, t1, type = 'sine') {
    const g = this._gain(1 - depth / 2);
    const l = this._lfo(freq, depth / 2, t0, t1, type);
    l.out.connect(g.gain);
    return g;
  }

  /* ================================================================ animal voices */

  _moo(t, out, p = 1, len = 1) {
    const dur = 1.35 * len * rand(0.9, 1.1);
    const f0 = 108 * p;
    const g = this._gain();
    const lp = this._filter('lowpass', 260, 7);
    lp.frequency.setValueAtTime(240, t);
    lp.frequency.linearRampToValueAtTime(1000, t + 0.3);
    lp.frequency.linearRampToValueAtTime(700, t + dur * 0.8);
    lp.frequency.linearRampToValueAtTime(380, t + dur);
    const nasal = this._filter('bandpass', 2300, 6);
    const ng = this._gain(0.06);
    const vib = this._lfo(5.5, f0 * 0.02, t, t + dur + 0.1);
    for (const det of [0, 9]) {
      const o = this._osc('sawtooth', f0 * 0.8, t, t + dur + 0.1);
      o.detune.value = det;
      o.frequency.linearRampToValueAtTime(f0 * 1.12, t + 0.28);
      o.frequency.linearRampToValueAtTime(f0 * 1.02, t + dur * 0.7);
      o.frequency.linearRampToValueAtTime(f0 * 0.74, t + dur);
      vib.out.connect(o.frequency);
      o.connect(lp);
      o.connect(nasal);
    }
    nasal.connect(ng); ng.connect(g);
    lp.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.14);
    g.gain.linearRampToValueAtTime(0.25, t + dur * 0.75);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const br = this._noise(t, t + dur);
    const bf = this._filter('bandpass', 700, 0.8);
    const bg = this._gain();
    this._env(bg.gain, t, 0.1, 0.03, dur * 0.6, dur * 0.3);
    br.connect(bf); bf.connect(bg); bg.connect(out);
    g.connect(out);
    return dur;
  }

  _oink(t, out, p = 1) {
    const n = Math.random() < 0.5 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.21 * rand(0.9, 1.15);
      const f = 210 * p * rand(0.93, 1.07);
      const o = this._osc('sawtooth', f, tt, tt + 0.2);
      o.frequency.exponentialRampToValueAtTime(f * 0.66, tt + 0.15);
      const sub = this._osc('square', f / 2, tt, tt + 0.2);
      sub.frequency.exponentialRampToValueAtTime(f * 0.33, tt + 0.15);
      const sg = this._gain(0.3);
      const am = this._am(42, 0.9, tt, tt + 0.2, 'square');
      const bp = this._filter('bandpass', 1050, 2.8);
      const pk = this._filter('peaking', 2400, 2, 7);
      const g = this._gain();
      this._env(g.gain, tt, 0.012, 1.3, 0.04, 0.11);
      o.connect(am); sub.connect(sg); sg.connect(am);
      am.connect(bp); bp.connect(pk); pk.connect(g); g.connect(out);
      const sn = this._noise(tt, tt + 0.07);
      const sf = this._filter('bandpass', 1600, 2.5);
      const sgn = this._gain();
      this._env(sgn.gain, tt, 0.005, 0.25, 0.02, 0.04);
      sn.connect(sf); sf.connect(sgn); sgn.connect(out);
    }
    return n * 0.21 + 0.15;
  }

  _neigh(t, out, p = 1) {
    const dur = 1.25;
    const o = this._osc('sawtooth', 520 * p, t, t + dur + 0.05);
    o.frequency.linearRampToValueAtTime(980 * p, t + 0.09);
    o.frequency.linearRampToValueAtTime(760 * p, t + 0.45);
    o.frequency.linearRampToValueAtTime(420 * p, t + 1.15);
    const vib = this._lfo(15, 25 * p, t, t + dur + 0.05);
    vib.osc.frequency.linearRampToValueAtTime(8, t + dur);
    vib.out.gain.linearRampToValueAtTime(95 * p, t + dur * 0.8);
    vib.out.connect(o.frequency);
    const trem = this._gain(0.75);
    const tl = this._gain(0.25);
    vib.osc.connect(tl); tl.connect(trem.gain);
    const bp = this._filter('bandpass', 1300, 1.4);
    const bp2 = this._filter('bandpass', 2600, 3);
    const b2g = this._gain(0.4);
    const lp = this._filter('lowpass', 3800, 0.7);
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.05);
    g.gain.linearRampToValueAtTime(0.38, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(trem); trem.connect(bp); trem.connect(bp2); bp2.connect(b2g); b2g.connect(lp); bp.connect(lp); lp.connect(g); g.connect(out);
    this._snort(t + dur - 0.1, out, 0.35);
    return dur + 0.35;
  }

  _snort(t, out, gain = 0.35, dur = 0.35) {
    const n = this._noise(t, t + dur);
    const bp = this._filter('bandpass', 520, 1.5);
    const am = this._am(30, 0.9, t, t + dur, 'square');
    const g = this._gain();
    this._env(g.gain, t, 0.02, gain, dur * 0.4, dur * 0.5);
    n.connect(bp); bp.connect(am); am.connect(g); g.connect(out);
  }

  _meow(t, out, p = 1) {
    const dur = 0.72 * rand(0.9, 1.15);
    const o = this._osc('sawtooth', 520 * p, t, t + dur + 0.05);
    o.frequency.linearRampToValueAtTime(760 * p, t + 0.24);
    o.frequency.linearRampToValueAtTime(560 * p, t + dur * 0.8);
    o.frequency.linearRampToValueAtTime(470 * p, t + dur);
    const vib = this._lfo(6, 10 * p, t, t + dur);
    vib.out.connect(o.frequency);
    const bp = this._filter('bandpass', 850, 4.5);
    bp.frequency.setValueAtTime(850, t);
    bp.frequency.linearRampToValueAtTime(1750, t + 0.24);
    bp.frequency.linearRampToValueAtTime(760, t + dur);
    const bp2 = this._filter('bandpass', 2900, 6);
    const g2 = this._gain(0.3);
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.75, t + 0.05);
    g.gain.linearRampToValueAtTime(0.62, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); o.connect(bp2); bp2.connect(g2); g2.connect(g); bp.connect(g); g.connect(out);
    return dur;
  }

  _woof(t, out, p = 1) {
    const n = Math.random() < 0.6 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.26;
      const f = 330 * p * rand(0.95, 1.05);
      const o = this._osc('sawtooth', f, tt, tt + 0.22);
      o.frequency.exponentialRampToValueAtTime(f * 0.52, tt + 0.13);
      const sq = this._osc('square', f / 2, tt, tt + 0.22);
      sq.frequency.exponentialRampToValueAtTime(f * 0.27, tt + 0.13);
      const sqg = this._gain(0.4);
      const lp = this._filter('lowpass', 1500, 3);
      lp.frequency.setValueAtTime(1500, tt);
      lp.frequency.exponentialRampToValueAtTime(520, tt + 0.16);
      const sh = this.ctx.createWaveShaper();
      sh.curve = this.curve;
      const g = this._gain();
      this._env(g.gain, tt, 0.006, 0.75, 0.03, 0.16);
      o.connect(lp); sq.connect(sqg); sqg.connect(lp); lp.connect(sh); sh.connect(g); g.connect(out);
      const nz = this._noise(tt, tt + 0.08);
      const nf = this._filter('lowpass', 1800, 0.7);
      const ng = this._gain();
      this._env(ng.gain, tt, 0.003, 0.3, 0.01, 0.06);
      nz.connect(nf); nf.connect(ng); ng.connect(out);
    }
    return n * 0.26 + 0.2;
  }

  _baa(t, out, p = 1) {
    const dur = 0.85 * rand(0.9, 1.1);
    const f = 285 * p;
    const o = this._osc('sawtooth', f, t, t + dur + 0.05);
    o.frequency.linearRampToValueAtTime(f * 0.9, t + dur);
    const vib = this._lfo(7.5, 14 * p, t, t + dur);
    vib.out.connect(o.frequency);
    const am = this._am(7.5, 0.6, t, t + dur);
    const lp = this._filter('lowpass', 380, 0.7);
    lp.frequency.setValueAtTime(380, t);
    lp.frequency.linearRampToValueAtTime(3200, t + 0.06);
    const f1 = this._filter('bandpass', 780, 3);
    const f2 = this._filter('bandpass', 1250, 4);
    const f2g = this._gain(0.6);
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.03);
    g.gain.linearRampToValueAtTime(0.55, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(am); am.connect(lp); lp.connect(f1); lp.connect(f2); f2.connect(f2g); f2g.connect(g); f1.connect(g); g.connect(out);
    return dur;
  }

  _quack(t, out, p = 1) {
    const n = Math.random() < 0.5 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.18 * rand(0.9, 1.1);
      const f = 360 * p * rand(0.95, 1.05);
      const o = this._osc('square', f, tt, tt + 0.16);
      o.frequency.exponentialRampToValueAtTime(f * 0.7, tt + 0.14);
      const b1 = this._filter('bandpass', 1400, 5);
      const b2 = this._filter('bandpass', 2700, 4);
      const b2g = this._gain(0.5);
      const g = this._gain();
      this._env(g.gain, tt, 0.008, 0.8, 0.05, 0.09);
      o.connect(b1); o.connect(b2); b2.connect(b2g); b2g.connect(g); b1.connect(g); g.connect(out);
    }
    return n * 0.18 + 0.15;
  }

  _cluck(t, out, p = 1) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.11;
      const o = this._osc('sawtooth', 520 * p, tt, tt + 0.08);
      o.frequency.exponentialRampToValueAtTime(430 * p, tt + 0.06);
      const bp = this._filter('bandpass', 950, 3);
      const g = this._gain();
      this._env(g.gain, tt, 0.004, 0.45, 0.02, 0.04);
      o.connect(bp); bp.connect(g); g.connect(out);
    }
    const t2 = t + 0.42;
    const o = this._osc('sawtooth', 600 * p, t2, t2 + 0.34);
    o.frequency.linearRampToValueAtTime(980 * p, t2 + 0.12);
    o.frequency.linearRampToValueAtTime(700 * p, t2 + 0.3);
    const bp = this._filter('bandpass', 1100, 2);
    const g = this._gain();
    this._env(g.gain, t2, 0.02, 0.5, 0.18, 0.12);
    o.connect(bp); bp.connect(g); g.connect(out);
    return 0.8;
  }

  _rabbit(t, out, p = 1) {
    for (let i = 0; i < 2; i++) {
      const tt = t + i * 0.13;
      const o = this._osc('sine', 1300 * p, tt, tt + 0.09);
      o.frequency.exponentialRampToValueAtTime(1750 * p, tt + 0.07);
      const g = this._gain();
      this._env(g.gain, tt, 0.005, 0.35, 0.03, 0.04);
      o.connect(g); g.connect(out);
    }
    for (let i = 0; i < 2; i++) {
      const tt = t + 0.35 + i * 0.16;
      const o = this._osc('sine', 80, tt, tt + 0.15);
      o.frequency.exponentialRampToValueAtTime(40, tt + 0.12);
      const g = this._gain();
      this._env(g.gain, tt, 0.004, 0.7, 0.02, 0.1);
      o.connect(g); g.connect(out);
    }
    return 0.7;
  }

  _snuffle(t, out, p = 1) {
    for (let i = 0; i < 4; i++) {
      const tt = t + i * 0.15;
      const n = this._noise(tt, tt + 0.1);
      const bp = this._filter('bandpass', 2400 * p, 2);
      const am = this._am(22, 0.9, tt, tt + 0.1);
      const g = this._gain();
      this._env(g.gain, tt, 0.01, 0.65, 0.04, 0.05);
      n.connect(bp); bp.connect(am); am.connect(g); g.connect(out);
    }
    return 0.7;
  }

  /* ---- greetings: the special "hello" sounds */

  _nicker(t, out, p = 1) {
    this._snort(t, out, 0.3, 0.3);
    const t2 = t + 0.28;
    const dur = 0.85;
    const o = this._osc('sawtooth', 150 * p, t2, t2 + dur + 0.05);
    o.frequency.linearRampToValueAtTime(112 * p, t2 + dur);
    const am = this._am(17, 0.95, t2, t2 + dur);
    const lp = this._filter('lowpass', 760, 2);
    const g = this._gain();
    this._env(g.gain, t2, 0.05, 0.75, dur * 0.5, dur * 0.45);
    o.connect(am); am.connect(lp); lp.connect(g); g.connect(out);
    return dur + 0.3;
  }

  _squeal(t, out, p = 1) {
    const dur = 0.55;
    const o = this._osc('sawtooth', 850 * p, t, t + dur + 0.05);
    o.frequency.linearRampToValueAtTime(1350 * p, t + 0.18);
    o.frequency.linearRampToValueAtTime(1050 * p, t + dur);
    const vib = this._lfo(19, 45 * p, t, t + dur);
    vib.out.connect(o.frequency);
    const bp = this._filter('bandpass', 1800, 1.8);
    const lp = this._filter('lowpass', 4200, 0.7);
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.03);
    g.gain.linearRampToValueAtTime(0.32, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out);
    return dur;
  }

  _cowHum(t, out, p = 1) {
    const hum = (tt, dur, f0, f1, c0, c1, peak) => {
      const o = this._osc('sawtooth', f0 * p, tt, tt + dur + 0.05);
      o.frequency.linearRampToValueAtTime(f1 * p, tt + dur);
      const lp = this._filter('lowpass', c0, 5);
      lp.frequency.linearRampToValueAtTime(c1, tt + dur * 0.8);
      const g = this._gain();
      this._env(g.gain, tt, 0.06, peak, dur * 0.55, dur * 0.35);
      o.connect(lp); lp.connect(g); g.connect(out);
    };
    hum(t, 0.3, 92, 96, 300, 320, 0.45);
    hum(t + 0.36, 0.3, 94, 98, 300, 330, 0.45);
    hum(t + 0.8, 0.55, 98, 152, 320, 1150, 0.4);
    return 1.4;
  }

  _trillPurr(t, out, p = 1) {
    const o = this._osc('sawtooth', 430 * p, t, t + 0.3);
    o.frequency.linearRampToValueAtTime(650 * p, t + 0.26);
    const am = this._am(28, 0.85, t, t + 0.3);
    const bp = this._filter('bandpass', 1100, 2);
    const g = this._gain();
    this._env(g.gain, t, 0.02, 0.6, 0.16, 0.1);
    o.connect(am); am.connect(bp); bp.connect(g); g.connect(out);
    const t2 = t + 0.32, dur = 1.1;
    const n = this._noise(t2, t2 + dur, true);
    const lp = this._filter('lowpass', 380, 1);
    const am2 = this._am(24, 0.95, t2, t2 + dur);
    const g2 = this._gain();
    this._env(g2.gain, t2, 0.15, 0.9, dur * 0.5, dur * 0.35);
    n.connect(lp); lp.connect(am2); am2.connect(g2); g2.connect(out);
    const s = this._osc('sine', 48, t2, t2 + dur);
    const am3 = this._am(24, 0.9, t2, t2 + dur);
    const g3 = this._gain();
    this._env(g3.gain, t2, 0.15, 0.3, dur * 0.5, dur * 0.35);
    s.connect(am3); am3.connect(g3); g3.connect(out);
    return 1.45;
  }

  _howl(t, out, p = 1) {
    const yip = this._osc('sawtooth', 620 * p, t, t + 0.12);
    yip.frequency.exponentialRampToValueAtTime(480 * p, t + 0.1);
    const yf = this._filter('bandpass', 1100, 2);
    const yg = this._gain();
    this._env(yg.gain, t, 0.005, 0.4, 0.03, 0.07);
    yip.connect(yf); yf.connect(yg); yg.connect(out);
    const t2 = t + 0.18, dur = 1.15;
    const o = this._osc('sawtooth', 360 * p, t2, t2 + dur + 0.05);
    o.frequency.linearRampToValueAtTime(580 * p, t2 + 0.28);
    o.frequency.linearRampToValueAtTime(540 * p, t2 + 0.75);
    o.frequency.linearRampToValueAtTime(420 * p, t2 + dur);
    const vib = this._lfo(5.5, 12 * p, t2, t2 + dur);
    vib.out.connect(o.frequency);
    const bp = this._filter('bandpass', 950, 3);
    bp.frequency.linearRampToValueAtTime(620, t2 + dur);
    const g = this._gain();
    g.gain.setValueAtTime(0.0001, t2);
    g.gain.linearRampToValueAtTime(0.5, t2 + 0.12);
    g.gain.linearRampToValueAtTime(0.42, t2 + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t2 + dur);
    o.connect(bp); bp.connect(g); g.connect(out);
    return dur + 0.2;
  }

  /* The everyday call of a species. pos (optional) places it in the world. */
  call(species, { pos = null, pitch = 1, gain = 1, len = 1 } = {}) {
    if (!this.ready) return 0;
    const s = this.spatial(pos, species === 'cow' || species === 'horse' ? 26 : 18);
    if (s.gain < 0.03) return 0;
    const out = this._out(this.voiceBus, gain * s.gain, s.pan, 3.5);
    const t = this.now + 0.02;
    const p = pitch;
    switch (species) {
      case 'cow': return this._moo(t, out, p, len);
      case 'pig': return this._oink(t, out, p);
      case 'horse': return this._neigh(t, out, p);
      case 'cat': return this._meow(t, out, p);
      case 'dog': return this._woof(t, out, p);
      case 'sheep': return this._baa(t, out, p);
      case 'duck': return this._quack(t, out, p);
      case 'hen': return this._cluck(t, out, p);
      case 'rabbit': return this._rabbit(t, out, p);
      case 'hedgehog': return this._snuffle(t, out, p);
      default: return 0;
    }
  }

  /* The special greeting sound (unique from the everyday call) */
  greet(species, { pos = null, pitch = 1, gain = 1 } = {}) {
    if (!this.ready) return 0;
    const s = this.spatial(pos, 20);
    const out = this._out(this.voiceBus, gain * s.gain, s.pan, 3);
    const t = this.now + 0.02;
    switch (species) {
      case 'horse': return this._nicker(t, out, pitch);
      case 'pig': return this._squeal(t, out, pitch);
      case 'cow': return this._cowHum(t, out, pitch);
      case 'cat': return this._trillPurr(t, out, pitch);
      case 'dog': return this._howl(t, out, pitch);
      default: return this.call(species, { pos, pitch: pitch * 1.2 });
    }
  }

  /* One sung note in the voice of a species, for duets */
  sing(species, freq, { pos = null, dur = 0.34, gain = 1, when = 0 } = {}) {
    if (!this.ready) return;
    const s = this.spatial(pos, 20);
    const out = this._out(this.voiceBus, gain * s.gain, s.pan, 2);
    const t = this.now + 0.02 + when;
    const V = {
      horse: { w: 'sawtooth', f1: 1300, q: 1.4, vib: 11, vd: 0.03, am: 0 },
      pig: { w: 'sawtooth', f1: 1050, q: 2.6, vib: 0, vd: 0, am: 40 },
      cow: { w: 'sawtooth', f1: 700, q: 6, vib: 5, vd: 0.02, am: 0, oct: 0.5 },
      cat: { w: 'sawtooth', f1: 1500, q: 4, vib: 6, vd: 0.02, am: 0 },
      dog: { w: 'sawtooth', f1: 900, q: 3, vib: 5.5, vd: 0.025, am: 0 },
      sheep: { w: 'sawtooth', f1: 800, q: 3, vib: 7.5, vd: 0.04, am: 7.5 },
      duck: { w: 'square', f1: 1400, q: 5, vib: 0, vd: 0, am: 0 },
      hen: { w: 'sawtooth', f1: 1000, q: 3, vib: 0, vd: 0, am: 0 },
      rabbit: { w: 'sine', f1: 2000, q: 0.7, vib: 8, vd: 0.02, am: 0, oct: 2 },
      hedgehog: { w: 'triangle', f1: 1800, q: 1, vib: 9, vd: 0.02, am: 0, oct: 2 },
    }[species] || { w: 'triangle', f1: 1200, q: 1, vib: 5, vd: 0.02, am: 0 };
    const f = freq * (V.oct || 1);
    const o = this._osc(V.w, f, t, t + dur + 0.05);
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.05);
    if (V.vib) { const l = this._lfo(V.vib, f * V.vd, t, t + dur); l.out.connect(o.frequency); }
    const bp = this._filter('bandpass', V.f1, V.q);
    const lp = this._filter('lowpass', 4000, 0.7);
    const g = this._gain();
    this._env(g.gain, t, 0.04, 0.55, dur * 0.55, dur * 0.4);
    let src = o;
    if (V.am) { const am = this._am(V.am, 0.8, t, t + dur, V.am > 20 ? 'square' : 'sine'); o.connect(am); src = am; }
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out);
  }

  /* ================================================================ effects */

  sfx(name, opts = {}) {
    if (!this.ready) return;
    const t = this.now + 0.01 + (opts.when || 0);
    const s = this.spatial(opts.pos, opts.ref || 14);
    const gain = (opts.gain ?? 1) * s.gain;
    if (gain < 0.02) return;
    const out = this._out(this.sfxBus, gain, s.pan, 3, opts.verb ?? 0.6);
    const p = opts.pitch || 1;
    switch (name) {
      case 'boop': {
        const o = this._osc('sine', 620 * p, t, t + 0.3);
        o.frequency.exponentialRampToValueAtTime(1300 * p, t + 0.08);
        o.frequency.exponentialRampToValueAtTime(980 * p, t + 0.25);
        const wob = this._lfo(22, 60 * p, t, t + 0.3);
        wob.out.gain.exponentialRampToValueAtTime(1, t + 0.28);
        wob.out.connect(o.frequency);
        const o2 = this._osc('triangle', 1240 * p, t, t + 0.2);
        o2.frequency.exponentialRampToValueAtTime(2600 * p, t + 0.08);
        const g = this._gain(), g2 = this._gain();
        this._env(g.gain, t, 0.005, 0.5, 0.06, 0.2);
        this._env(g2.gain, t, 0.005, 0.12, 0.02, 0.12);
        o.connect(g); o2.connect(g2); g.connect(out); g2.connect(out);
        const n = this._noise(t, t + 0.03);
        const hp = this._filter('highpass', 3000, 0.7);
        const ng = this._gain();
        this._env(ng.gain, t, 0.001, 0.25, 0.005, 0.02);
        n.connect(hp); hp.connect(ng); ng.connect(out);
        break;
      }
      case 'jump': {
        const n = this._noise(t, t + 0.25);
        const bp = this._filter('bandpass', 500, 1.5);
        bp.frequency.exponentialRampToValueAtTime(1700, t + 0.18);
        const g = this._gain();
        this._env(g.gain, t, 0.02, 0.2, 0.05, 0.13);
        n.connect(bp); bp.connect(g); g.connect(out);
        const o = this._osc('sine', 250 * p, t, t + 0.16);
        o.frequency.exponentialRampToValueAtTime(470 * p, t + 0.12);
        const og = this._gain();
        this._env(og.gain, t, 0.01, 0.16, 0.04, 0.08);
        o.connect(og); og.connect(out);
        break;
      }
      case 'land': {
        const o = this._osc('sine', 110 * p, t, t + 0.18);
        o.frequency.exponentialRampToValueAtTime(48 * p, t + 0.14);
        const g = this._gain();
        this._env(g.gain, t, 0.004, 0.6 * (opts.hard ?? 1), 0.02, 0.12);
        o.connect(g); g.connect(out);
        const n = this._noise(t, t + 0.12);
        const lp = this._filter('lowpass', 500, 0.7);
        const ng = this._gain();
        this._env(ng.gain, t, 0.003, 0.35, 0.02, 0.08);
        n.connect(lp); lp.connect(ng); ng.connect(out);
        break;
      }
      case 'step': {
        const surface = opts.surface || 'grass';
        if (opts.hoof && surface !== 'grass') {
          for (const [f, a] of [[560, 0.28], [880, 0.16]]) {
            const o = this._osc('sine', f * p * rand(0.95, 1.05), t, t + 0.08);
            o.frequency.exponentialRampToValueAtTime(f * 0.7 * p, t + 0.06);
            const g = this._gain();
            this._env(g.gain, t, 0.002, a, 0.005, 0.05);
            o.connect(g); g.connect(out);
          }
          const n = this._noise(t, t + 0.04);
          const hp = this._filter('bandpass', 2500, 1);
          const ng = this._gain();
          this._env(ng.gain, t, 0.001, 0.14, 0.004, 0.025);
          n.connect(hp); hp.connect(ng); ng.connect(out);
        } else {
          const n = this._noise(t, t + 0.1);
          const bp = this._filter('bandpass', surface === 'grass' ? 3600 : 1800, 0.9);
          const g = this._gain();
          this._env(g.gain, t, 0.01, (surface === 'grass' ? 0.1 : 0.14) * (opts.soft ? 0.5 : 1), 0.02, 0.06);
          n.connect(bp); bp.connect(g); g.connect(out);
        }
        break;
      }
      case 'bell': {
        for (const [f, a, d] of [[1180, 0.2, 0.9], [2860, 0.08, 0.5], [4210, 0.04, 0.3]]) {
          const o = this._osc('sine', f * p, t, t + d + 0.1);
          const g = this._gain();
          this._env(g.gain, t, 0.003, a, 0.01, d);
          o.connect(g); g.connect(out);
        }
        break;
      }
      case 'drink': {
        for (let i = 0; i < 6; i++) {
          const tt = t + i * 0.24 + rand(0, 0.04);
          const o = this._osc('sine', 600 * p * rand(0.9, 1.2), tt, tt + 0.1);
          o.frequency.exponentialRampToValueAtTime(1400 * p, tt + 0.06);
          const g = this._gain();
          this._env(g.gain, tt, 0.004, 0.22, 0.01, 0.06);
          o.connect(g); g.connect(out);
          const n = this._noise(tt, tt + 0.08);
          const bp = this._filter('bandpass', 1400, 2);
          const ng = this._gain();
          this._env(ng.gain, tt, 0.005, 0.16, 0.02, 0.05);
          n.connect(bp); bp.connect(ng); ng.connect(out);
        }
        break;
      }
      case 'munch': {
        const crisp = opts.crisp ? 1.5 : 1;
        for (let i = 0; i < 7; i++) {
          const tt = t + i * rand(0.16, 0.22);
          const n = this._noise(tt, tt + 0.08);
          const bp = this._filter('bandpass', rand(1800, 3400) * crisp, 1.2);
          const g = this._gain();
          this._env(g.gain, tt, 0.003, (i === 0 && opts.crisp ? 0.6 : 0.3), 0.01, 0.06);
          n.connect(bp); bp.connect(g); g.connect(out);
          const o = this._osc('sine', 140, tt, tt + 0.06);
          const og = this._gain();
          this._env(og.gain, tt, 0.003, 0.12, 0.01, 0.04);
          o.connect(og); og.connect(out);
        }
        break;
      }
      case 'sparkle': {
        [1318.5, 1568, 1975.5, 2637].forEach((f, i) => {
          const tt = t + i * 0.075;
          const o = this._osc('triangle', f, tt, tt + 0.7);
          const g = this._gain();
          this._env(g.gain, tt, 0.004, 0.16, 0.02, 0.6);
          o.connect(g); g.connect(out);
        });
        break;
      }
      case 'fanfare': {
        [[784, 0], [988, 0.14], [1175, 0.28], [1568, 0.46], [1175, 0.64], [1568, 0.8]].forEach(([f, dt]) => {
          const tt = t + dt;
          const o = this._osc('triangle', f, tt, tt + 0.6);
          const g = this._gain();
          this._env(g.gain, tt, 0.006, 0.2, 0.06, 0.45);
          o.connect(g); g.connect(out);
        });
        break;
      }
      case 'click': {
        const o = this._osc('sine', 900, t, t + 0.06);
        o.frequency.exponentialRampToValueAtTime(600, t + 0.04);
        const g = this._gain();
        this._env(g.gain, t, 0.002, 0.18, 0.005, 0.04);
        o.connect(g); g.connect(out);
        break;
      }
      case 'page': {
        const n = this._noise(t, t + 0.35);
        const bp = this._filter('bandpass', 800, 0.8);
        bp.frequency.exponentialRampToValueAtTime(3200, t + 0.28);
        const g = this._gain();
        this._env(g.gain, t, 0.05, 0.12, 0.1, 0.18);
        n.connect(bp); bp.connect(g); g.connect(out);
        break;
      }
      case 'whoosh': {
        const n = this._noise(t, t + 0.6);
        const bp = this._filter('bandpass', 300, 1.2);
        bp.frequency.exponentialRampToValueAtTime(1500, t + 0.3);
        bp.frequency.exponentialRampToValueAtTime(400, t + 0.55);
        const g = this._gain();
        this._env(g.gain, t, 0.1, 0.25, 0.15, 0.3);
        n.connect(bp); bp.connect(g); g.connect(out);
        break;
      }
      case 'chime': {
        [[1046.5, 0], [1568, 0.12]].forEach(([f, dt]) => {
          const tt = t + dt;
          for (const [m, a] of [[1, 0.22], [2.76, 0.05]]) {
            const o = this._osc('sine', f * m, tt, tt + 1);
            const g = this._gain();
            this._env(g.gain, tt, 0.003, a, 0.02, 0.8);
            o.connect(g); g.connect(out);
          }
        });
        break;
      }
      case 'pop': {
        const o = this._osc('sine', 500 * p, t, t + 0.12);
        o.frequency.exponentialRampToValueAtTime(900 * p, t + 0.05);
        const g = this._gain();
        this._env(g.gain, t, 0.003, 0.25, 0.01, 0.08);
        o.connect(g); g.connect(out);
        break;
      }
      case 'thud': {
        const o = this._osc('sine', 180 * p, t, t + 0.1);
        o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
        const g = this._gain();
        this._env(g.gain, t, 0.002, 0.3, 0.01, 0.07);
        o.connect(g); g.connect(out);
        break;
      }
      case 'flap': {
        for (let i = 0; i < 5; i++) {
          const tt = t + i * 0.07;
          const n = this._noise(tt, tt + 0.06);
          const bp = this._filter('bandpass', 900, 0.8);
          const g = this._gain();
          this._env(g.gain, tt, 0.01, 0.18, 0.01, 0.04);
          n.connect(bp); bp.connect(g); g.connect(out);
        }
        break;
      }
      case 'splash': {
        const n = this._noise(t, t + 0.5);
        const bp = this._filter('bandpass', 1200, 0.7);
        bp.frequency.exponentialRampToValueAtTime(500, t + 0.4);
        const g = this._gain();
        this._env(g.gain, t, 0.01, 0.35, 0.05, 0.35);
        n.connect(bp); bp.connect(g); g.connect(out);
        break;
      }
      default: break;
    }
  }

  /* A little birdsong phrase */
  chirp(opts = {}) {
    if (!this.ready) return;
    const out = this._out(this.ambBus, (opts.gain ?? 1) * rand(0.35, 0.8), opts.pan ?? rand(-0.8, 0.8), 3, 1.2);
    const kind = opts.kind ?? Math.floor(Math.random() * 4);
    let t = this.now + 0.02;
    if (kind === 0) {
      const n = 3 + Math.floor(Math.random() * 5);
      const base = rand(2600, 4200);
      for (let i = 0; i < n; i++) {
        const o = this._osc('sine', base * rand(1.05, 1.2), t, t + 0.09);
        o.frequency.exponentialRampToValueAtTime(base * rand(0.7, 0.9), t + 0.07);
        const g = this._gain();
        this._env(g.gain, t, 0.005, 0.12, 0.02, 0.05);
        o.connect(g); g.connect(out);
        t += rand(0.08, 0.13);
      }
    } else if (kind === 1) {
      const o = this._osc('sine', rand(3800, 4800), t, t + 0.6);
      const am = this._am(rand(22, 32), 0.9, t, t + 0.6);
      const g = this._gain();
      this._env(g.gain, t, 0.05, 0.08, 0.35, 0.15);
      o.frequency.linearRampToValueAtTime(rand(3000, 3600), t + 0.55);
      o.connect(am); am.connect(g); g.connect(out);
    } else if (kind === 2) {
      for (let i = 0; i < 2; i++) {
        const tt = t + i * 0.22;
        const o = this._osc('sine', 2200, tt, tt + 0.2);
        o.frequency.linearRampToValueAtTime(3600, tt + 0.08);
        o.frequency.linearRampToValueAtTime(2700, tt + 0.17);
        const g = this._gain();
        this._env(g.gain, tt, 0.01, 0.12, 0.08, 0.08);
        o.connect(g); g.connect(out);
      }
    } else {
      const f = [2637, 2349, 1976, 2349];
      f.forEach((ff, i) => {
        const tt = t + i * 0.16;
        const o = this._osc('sine', ff * rand(0.98, 1.02), tt, tt + 0.15);
        const g = this._gain();
        this._env(g.gain, tt, 0.01, 0.1, 0.05, 0.08);
        o.connect(g); g.connect(out);
      });
    }
  }

  cuckoo() {
    if (!this.ready) return;
    const out = this._out(this.ambBus, 0.35, rand(-0.8, 0.8), 4, 1.5);
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const t = this.now + 0.05 + i * 0.72;
      [[740, 0], [590, 0.26]].forEach(([f, dt]) => {
        const o = this._osc('sine', f, t + dt, t + dt + 0.3);
        o.frequency.linearRampToValueAtTime(f * 0.97, t + dt + 0.25);
        const g = this._gain();
        this._env(g.gain, t + dt, 0.03, 0.3, 0.1, 0.12);
        o.connect(g); g.connect(out);
      });
    }
  }

  rooster() {
    if (!this.ready) return;
    const out = this._out(this.ambBus, 0.22, rand(-0.7, 0.7), 4, 1.5);
    const t = this.now + 0.05;
    const seg = [[520, 700, 0.18], [700, 720, 0.16], [720, 900, 0.5], [900, 520, 0.4]];
    let tt = t;
    for (const [a, b, d] of seg) {
      const o = this._osc('sawtooth', a, tt, tt + d + 0.02);
      o.frequency.linearRampToValueAtTime(b, tt + d);
      const bp = this._filter('bandpass', 1400, 2);
      const g = this._gain();
      this._env(g.gain, tt, 0.02, 0.4, d * 0.6, d * 0.35);
      o.connect(bp); bp.connect(g); g.connect(out);
      tt += d * 0.95;
    }
  }

  churchBell() {
    if (!this.ready || !this.bell) return;
    const s = this.spatial(this.bell, 45);
    const out = this._out(this.ambBus, Math.max(0.12, s.gain) * 0.9, s.pan, 8, 2);
    for (let i = 0; i < 3; i++) {
      const t = this.now + 0.05 + i * 1.6;
      for (const [m, a, d] of [[1, 0.3, 4], [2.0, 0.12, 3], [2.4, 0.1, 2.5], [3.0, 0.06, 2], [4.2, 0.04, 1.2], [0.5, 0.12, 4.5]]) {
        const o = this._osc('sine', 392 * m, t, t + d + 0.1);
        const g = this._gain();
        this._env(g.gain, t, 0.004, a, 0.02, d);
        o.connect(g); g.connect(out);
      }
    }
  }

  ribbit(pos) {
    if (!this.ready) return;
    const s = this.spatial(pos, 12);
    if (s.gain < 0.05) return;
    const out = this._out(this.ambBus, s.gain * 0.6, s.pan, 2, 0.8);
    const t = this.now + 0.02;
    for (let i = 0; i < 2; i++) {
      const tt = t + i * 0.2;
      const o = this._osc('square', 180, tt, tt + 0.14);
      o.frequency.linearRampToValueAtTime(140, tt + 0.12);
      const am = this._am(38, 0.95, tt, tt + 0.14);
      const bp = this._filter('bandpass', 700, 2);
      const g = this._gain();
      this._env(g.gain, tt, 0.01, 0.4, 0.06, 0.06);
      o.connect(am); am.connect(bp); bp.connect(g); g.connect(out);
    }
  }

  /* ================================================================ looping sources */

  _startAmbience() {
    const c = this.ctx;
    const t = c.currentTime;
    const wind = this._noise(t, t + 1e6, true);
    const lp = this._filter('lowpass', 500, 0.6);
    const g = this._gain(0.05);
    const l1 = this._lfo(0.07, 260, t, t + 1e6);
    l1.out.connect(lp.frequency);
    const l2 = this._lfo(0.11, 0.025, t, t + 1e6);
    l2.out.connect(g.gain);
    wind.connect(lp); lp.connect(g); g.connect(this.ambBus);
    const lf = this._noise(t, t + 1e6);
    const hp = this._filter('bandpass', 5000, 0.5);
    const lg = this._gain(0.006);
    lf.connect(hp); hp.connect(lg); lg.connect(this.ambBus);
    // bees
    const buzz = this._osc('sawtooth', 218, t, t + 1e6);
    const buzz2 = this._osc('sawtooth', 224, t, t + 1e6);
    const bf = this._filter('bandpass', 450, 1.5);
    const bam = this._am(9, 0.4, t, t + 1e6);
    this.beeGain = this._gain(0);
    this.beePan = c.createStereoPanner();
    buzz.connect(bf); buzz2.connect(bf); bf.connect(bam); bam.connect(this.beeGain); this.beeGain.connect(this.beePan); this.beePan.connect(this.ambBus);
    this._ambT = { chirp: 1, cuckoo: 18, rooster: 25, bell: 70, frog: 5 };
  }

  /* called every frame */
  update(dt) {
    if (!this.ctx) return;
    const A = this._ambT;
    A.chirp -= dt; A.cuckoo -= dt; A.rooster -= dt; A.bell -= dt; A.frog -= dt;
    if (A.chirp < 0) { A.chirp = rand(1.2, 4.5); this.chirp(); if (Math.random() < 0.3) setTimeout(() => this.chirp({ kind: Math.floor(Math.random() * 4) }), 400); }
    if (A.cuckoo < 0) { A.cuckoo = rand(35, 70); this.cuckoo(); }
    if (A.rooster < 0) { A.rooster = rand(80, 150); this.rooster(); }
    if (A.bell < 0) { A.bell = rand(140, 220); this.churchBell(); }
    if (A.frog < 0) {
      A.frog = rand(3, 8);
      if (this.pond) this.ribbit({ x: this.pond.x + rand(-6, 6), z: this.pond.z + rand(-6, 6) });
    }
    if (this.hives.length && this.beeGain) {
      let best = null, bd = 1e9;
      for (const h of this.hives) { const d = Math.hypot(h.x - this.L.x, h.z - this.L.z); if (d < bd) { bd = d; best = h; } }
      const s = this.spatial(best, 5);
      this.beeGain.gain.setTargetAtTime(bd < 25 ? s.gain * 0.12 : 0, this.ctx.currentTime, 0.2);
      this.beePan.pan.setTargetAtTime(s.pan, this.ctx.currentTime, 0.2);
    }
    for (const e of this._engines) e._tick();
  }

  /* Aeroplane engine hum that follows a moving object (with doppler) */
  engine(kind = 'biplane') {
    if (!this.ctx) return null;
    const c = this.ctx;
    const t = c.currentTime;
    const g = this._gain(0);
    const pan = c.createStereoPanner();
    g.connect(pan); pan.connect(this.ambBus);
    const base = kind === 'jet' ? 90 : 62;
    const o1 = this._osc('sawtooth', base, t, t + 1e5);
    const o2 = this._osc(kind === 'jet' ? 'sawtooth' : 'square', base * 2.01, t, t + 1e5);
    const lp = this._filter('lowpass', kind === 'jet' ? 500 : 900, 0.8);
    const am = this._am(kind === 'jet' ? 3 : 21, kind === 'jet' ? 0.2 : 0.5, t, t + 1e5);
    const o2g = this._gain(0.35);
    const n = this._noise(t, t + 1e5, true);
    const ng = this._gain(kind === 'jet' ? 0.9 : 0.25);
    o1.connect(lp); o2.connect(o2g); o2g.connect(lp); n.connect(ng); ng.connect(lp);
    lp.connect(am); am.connect(g);
    const h = {
      pos: null, vel: null, stopped: false,
      _tick: () => {
        if (!h.pos || h.stopped) return;
        const s = this.spatial(h.pos, kind === 'jet' ? 200 : 45);
        const dx = h.pos.x - this.L.x, dz = h.pos.z - this.L.z, dy = h.pos.y;
        const d = Math.hypot(dx, dy, dz) || 1;
        const vr = (h.vel.x * dx + h.vel.y * dy + h.vel.z * dz) / d;
        const dop = 343 / (343 + vr);
        const now = c.currentTime;
        o1.frequency.setTargetAtTime(base * dop, now, 0.1);
        o2.frequency.setTargetAtTime(base * 2.01 * dop, now, 0.1);
        g.gain.setTargetAtTime(s.gain * (kind === 'jet' ? 0.25 : 0.4), now, 0.2);
        pan.pan.setTargetAtTime(s.pan, now, 0.2);
      },
      stop: () => {
        h.stopped = true;
        const now = c.currentTime;
        g.gain.setTargetAtTime(0, now, 0.3);
        setTimeout(() => { try { o1.stop(); o2.stop(); n.stop(); g.disconnect(); } catch (e) { /* ignore */ } }, 1500);
        this._engines.delete(h);
      },
    };
    this._engines.add(h);
    return h;
  }

  /* ================================================================ music: a gentle generative waltz */

  _startMusic() {
    const beat = 60 / 92;
    const bar = beat * 3;
    const G = { G: 392, A: 440, B: 493.88, C: 523.25, D: 587.33, E: 659.25, Fs: 739.99 };
    const chords = {
      I: [196, 246.94, 293.66], IV: [261.63, 329.63, 392], V: [293.66, 369.99, 440], vi: [329.63, 392, 493.88], ii: [220, 261.63, 329.63],
    };
    const prog = ['I', 'IV', 'I', 'V', 'vi', 'IV', 'ii', 'V', 'I', 'IV', 'I', 'V', 'vi', 'ii', 'V', 'I'];
    const scale = [G.G, G.A, G.B, G.D, G.E, G.G * 2, G.A * 2, G.B * 2, G.D * 2];
    const rhythms = [[1, 1, 1], [2, 1], [1, 0.5, 0.5, 1], [3], [1.5, 0.5, 1], [0.5, 0.5, 1, 1]];
    let barIdx = 0;
    let next = this.ctx.currentTime + 0.3;
    let melodyNote = 4;
    let motif = null;
    const pluck = (f, t, dur, gain, type = 'triangle') => {
      const o = this._osc(type, f, t, t + dur + 0.1);
      const o2 = this._osc('sine', f * 2, t, t + dur * 0.5);
      const g = this._gain();
      this._env(g.gain, t, 0.006, gain, 0.02, dur);
      const g2 = this._gain();
      this._env(g2.gain, t, 0.004, gain * 0.25, 0.01, dur * 0.4);
      o.connect(g); o2.connect(g2); g.connect(this.musicBus); g2.connect(this.musicBus);
      const s = this._gain(0.5); g.connect(s); s.connect(this.verbSend);
    };
    const flute = (f, t, dur, gain) => {
      const o = this._osc('sine', f, t, t + dur + 0.2);
      const o2 = this._osc('triangle', f, t, t + dur + 0.2);
      const vib = this._lfo(5, f * 0.006, t + 0.15, t + dur + 0.2);
      vib.out.connect(o.frequency); vib.out.connect(o2.frequency);
      const g = this._gain(), g2 = this._gain(0.25);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.07);
      g.gain.setValueAtTime(gain * 0.85, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.musicBus);
      const s = this._gain(0.8); g.connect(s); s.connect(this.verbSend);
    };
    const schedule = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      while (next < now + 0.6) {
        const name = prog[barIdx % prog.length];
        const ch = chords[name];
        const t = next;
        // bass: root on beat one, fifth on beats two and three
        pluck(ch[0] / 2, t, beat * 1.6, 0.16, 'triangle');
        pluck(ch[2] / 2, t + beat, beat * 0.8, 0.07, 'triangle');
        pluck(ch[2] / 2, t + beat * 2, beat * 0.8, 0.07, 'triangle');
        // harp arpeggio in quavers
        const arp = [ch[0], ch[1], ch[2], ch[0] * 2, ch[2], ch[1]];
        arp.forEach((f, i) => pluck(f, t + i * beat / 2 + (Math.random() - 0.5) * 0.01, beat * 1.2, 0.045 + (i === 0 ? 0.02 : 0), 'sine'));
        // melody: phrases of four bars with a repeated motif, some bars left to breathe
        const phraseBar = barIdx % 4;
        const rest = (Math.floor(barIdx / 8) % 3 === 2) && phraseBar < 2;
        if (!rest) {
          if (phraseBar === 0 || !motif) {
            motif = [];
            const r = rhythms[Math.floor(Math.random() * rhythms.length)];
            for (const len of r) {
              melodyNote = Math.max(0, Math.min(scale.length - 1, melodyNote + Math.floor(Math.random() * 5) - 2));
              motif.push([melodyNote, len]);
            }
          }
          let tt = t;
          const shift = phraseBar === 2 ? 1 : phraseBar === 3 ? -1 : 0;
          motif.forEach(([n, len], i) => {
            let idx = Math.max(0, Math.min(scale.length - 1, n + shift));
            if (phraseBar === 3 && i === motif.length - 1) {
              let best = 0, bd = 1e9;
              scale.forEach((f, k) => { const d = Math.min(...ch.map((cf) => Math.abs(Math.log2(f / (cf * 2))) % 1)); if (d < bd) { bd = d; best = k; } });
              idx = best;
            }
            flute(scale[idx], tt, len * beat * 0.92, 0.1);
            tt += len * beat;
          });
        }
        next += bar;
        barIdx++;
      }
    };
    schedule();
    this._musicTimer = setInterval(schedule, 120);
  }
}

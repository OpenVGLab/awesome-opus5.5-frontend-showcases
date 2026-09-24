// The soundtrack: a 12-bar, 96 BPM pentatonic cue (D major / B minor) synthesised with Web Audio
// and rendered ahead of time in an OfflineAudioContext so it can be seeked and stays frame-locked.
// Guzheng = Karplus-Strong plucks, dizi/erhu/strings/brass/choir = oscillators + filters,
// taiko/gong/cymbal/SFX = shaped noise and sine partials.
import { BEAT, DURATION } from './util.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const N = (s) => {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(s);
  return PC[m[1]] + (Number(m[2]) + 1) * 12;
};
const at = (bar, beat = 0) => ((bar - 1) * 4 + beat) * BEAT;
const PENT = [2, 4, 6, 9, 11];
const pent = (lo, hi) => {
  const r = [];
  for (let m = lo; m <= hi; m++) if (PENT.includes(((m % 12) + 12) % 12)) r.push(m);
  return r;
};

class Synth {
  constructor(ctx, seed = 7) {
    this.ctx = ctx;
    this.ks = new Map();
    this.waves = {};
    let s = seed;
    this.rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    this.noise = this.makeNoise(2.5, false);
    this.brown = this.makeNoise(3, true);

    // Gain staging keeps the dynamic arc; the limiter (high threshold, so almost no makeup gain) only catches peaks.
    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(1, 0);
    this.master.gain.setValueAtTime(1, 28.2);
    this.master.gain.linearRampToValueAtTime(0.0001, DURATION - 0.02);
    const hp = this.filt('highpass', 30, 0.7);
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.002;
    lim.release.value = 0.15;
    this.master.connect(hp);
    hp.connect(lim);
    lim.connect(ctx.destination);

    const pre = ctx.createDelay(0.2);
    pre.delayTime.value = 0.028;
    const conv = ctx.createConvolver();
    conv.buffer = this.makeIR(3.0, 2.4);
    const rlp = this.filt('lowpass', 6000, 0.5);
    this.revIn = ctx.createGain();
    const revOut = this.gain(0.6);
    this.revIn.connect(pre);
    pre.connect(conv);
    conv.connect(rlp);
    rlp.connect(revOut);
    revOut.connect(this.master);
    this.buses = {};
  }

  bus(name, gain = 1, send = 0.3, pan = 0) {
    const c = this.ctx;
    const g = this.gain(gain);
    let out = g;
    if (pan) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      out = p;
    }
    out.connect(this.master);
    if (send > 0) {
      const s = this.gain(send);
      out.connect(s);
      s.connect(this.revIn);
    }
    this.buses[name] = g;
    return g;
  }

  makeNoise(sec, brown) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = this.rand() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return b;
  }

  makeIR(sec, decay) {
    const c = this.ctx, sr = c.sampleRate, len = Math.floor(sr * sec);
    const b = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len;
        lp += (this.rand() * 2 - 1 - lp) * (0.92 - 0.78 * x);
        d[i] = lp * Math.pow(1 - x, decay) * Math.min(1, i / (sr * 0.004));
      }
      for (let e = 0; e < 10; e++) d[Math.floor(sr * (0.007 + this.rand() * 0.075))] += (this.rand() * 2 - 1) * 0.5;
    }
    return b;
  }

  wave(name) {
    if (!this.waves[name]) {
      const harm = { dizi: [0, 1, 0.42, 0.3, 0.12, 0.09, 0.05, 0.035, 0.02] }[name];
      const real = new Float32Array(harm.length), imag = new Float32Array(harm);
      this.waves[name] = this.ctx.createPeriodicWave(real, imag);
    }
    return this.waves[name];
  }

  gain(v = 1) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  // Modulated/automated pitch and cutoff are evaluated per 128-sample block (k-rate): per-sample
  // evaluation is several times slower to render and inaudible for vibrato and sweeps.
  static kRate(...params) {
    for (const p of params) {
      try { p.automationRate = 'k-rate'; } catch (e) { /* fixed-rate param */ }
    }
  }

  filt(type, f, Q = 0.7, gain = 0) {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    Synth.kRate(b.frequency, b.Q, b.gain);
    b.frequency.value = f;
    b.Q.value = Q;
    if (gain) b.gain.value = gain;
    return b;
  }

  osc(type, f, t, stop, detune = 0) {
    const o = this.ctx.createOscillator();
    if (typeof type === 'string') o.type = type;
    else o.setPeriodicWave(type);
    Synth.kRate(o.frequency, o.detune);
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.start(t);
    o.stop(stop);
    return o;
  }

  noiseSrc(t, dur, brown = false) {
    const b = brown ? this.brown : this.noise;
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.loop = true;
    s.start(t, this.rand() * (b.duration - 0.2));
    s.stop(t + dur);
    return s;
  }

  perc(g, t, peak, decay, attack = 0.003) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // ---------- pitched instruments ----------
  ksBuf(midi, t60, bright) {
    const key = `${midi}|${t60}|${bright}`;
    let r = this.ks.get(key);
    if (r) return r;
    const c = this.ctx, sr = c.sampleRate, f = mtof(midi);
    const S = 0.3;
    const Nn = Math.max(4, Math.round(sr / f - S));
    const fr = sr / (Nn + S);
    const len = Math.floor(sr * Math.min(t60 * 0.8 + 0.2, 3.4));
    const b = c.createBuffer(1, len, sr), d = b.getChannelData(0);
    const rho = Math.pow(0.001, 1 / (fr * t60));
    const ex = new Float32Array(Nn);
    let lp = 0, mean = 0;
    for (let i = 0; i < Nn; i++) {
      lp += (this.rand() * 2 - 1 - lp) * bright;
      ex[i] = lp;
      mean += lp;
    }
    mean /= Nn;
    const P = Math.max(1, Math.round(Nn * 0.12));
    for (let i = 0; i < Nn; i++) d[i] = ex[i] - mean - (i >= P ? ex[i - P] - mean : 0) * 0.85;
    for (let i = Nn; i < len; i++) {
      const prev = i - Nn - 1 >= 0 ? d[i - Nn - 1] : 0;
      d[i] = rho * ((1 - S) * d[i - Nn] + S * prev);
    }
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    const g = 0.8 / (peak || 1), fadeN = Math.floor(sr * 0.05);
    for (let i = 0; i < len; i++) {
      d[i] *= g;
      if (i > len - fadeN) d[i] *= (len - i) / fadeN;
    }
    r = { buf: b, rate: f / fr };
    this.ks.set(key, r);
    return r;
  }

  pluck(bus, t, midi, vel = 0.5, o = {}) {
    const t60 = o.t60 ?? (midi < 60 ? 3.4 : midi < 72 ? 2.6 : 1.9);
    const { buf, rate } = this.ksBuf(midi, t60, o.bright ?? 0.72);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = this.gain(vel);
    s.connect(g);
    g.connect(bus);
    if (o.vib) {
      const l = this.osc('sine', 5.2, t, t + buf.duration);
      const lg = this.gain(0);
      lg.gain.setValueAtTime(0, t + 0.15);
      lg.gain.linearRampToValueAtTime(o.vib * rate, t + 0.55);
      l.connect(lg);
      lg.connect(s.playbackRate);
    }
    let end = t + buf.duration / rate;
    if (o.len) {
      g.gain.setValueAtTime(vel, t + o.len);
      g.gain.setTargetAtTime(0, t + o.len, 0.04);
      end = Math.min(end, t + o.len + 0.3);
    }
    s.start(t);
    s.stop(end);
  }

  gliss(bus, t, lo, hi, dur, vel = 0.3, down = false) {
    const notes = pent(lo, hi);
    if (down) notes.reverse();
    const n = notes.length;
    notes.forEach((m, i) => {
      const u = i / Math.max(1, n - 1);
      const tt = t + dur * (down ? u : Math.pow(u, 0.8));
      this.pluck(bus, tt, m, vel * (down ? 1 - u * 0.45 : 0.55 + 0.45 * u), { t60: 1.5, bright: 0.8 });
    });
  }

  dizi(bus, t, dur, midi, vel = 0.2, o = {}) {
    const f = mtof(midi), end = t + dur + 0.3;
    const osc = this.osc(this.wave('dizi'), f, t, end);
    if (o.from != null) {
      osc.frequency.setValueAtTime(mtof(o.from), t);
      osc.frequency.exponentialRampToValueAtTime(f, t + (o.glide ?? 0.08));
    }
    const lfo = this.osc('sine', 5.4, t, end), lg = this.gain(0);
    const vd = o.vibDelay ?? 0.22;
    lg.gain.setValueAtTime(0, t + vd);
    lg.gain.linearRampToValueAtTime(f * (o.vib ?? 0.0065), t + vd + 0.35);
    lfo.connect(lg);
    lg.connect(osc.frequency);
    const lp = this.filt('lowpass', Math.min(10000, f * 8), 0.4);
    const g = this.gain(0);
    const A = o.attack ?? 0.05;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 1.12, t + A);
    g.gain.linearRampToValueAtTime(vel, t + A + 0.08);
    if (dur > 0.7) g.gain.linearRampToValueAtTime(vel * 1.1, t + dur * 0.75);
    g.gain.setTargetAtTime(0, t + dur, o.release ?? 0.05);
    osc.connect(lp);
    lp.connect(g);
    g.connect(bus);
    const ns = this.noiseSrc(t, dur + 0.4);
    const bp = this.filt('bandpass', f * 1.5, 1.1);
    const ng = this.gain(0);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(vel * 0.5, t + 0.025);
    ng.gain.linearRampToValueAtTime(vel * 0.14, t + 0.15);
    ng.gain.setTargetAtTime(0, t + dur, 0.04);
    ns.connect(bp);
    bp.connect(ng);
    ng.connect(bus);
  }

  erhu(bus, t, dur, midi, vel = 0.15, o = {}) {
    vel *= 0.6;
    const f = mtof(midi), end = t + dur + 0.4;
    const pre = this.gain(1);
    const oscs = [-5, 5].map((det) => {
      const osc = this.osc('sawtooth', f, t, end, det);
      if (o.from != null) {
        osc.frequency.setValueAtTime(mtof(o.from), t);
        osc.frequency.exponentialRampToValueAtTime(f, t + (o.glide ?? 0.1));
      }
      osc.connect(pre);
      return osc;
    });
    const lfo = this.osc('sine', 6.1, t, end), lg = this.gain(0);
    lg.gain.setValueAtTime(0, t + 0.14);
    lg.gain.linearRampToValueAtTime(f * (o.vib ?? 0.011), t + 0.5);
    lfo.connect(lg);
    oscs.forEach((osc) => lg.connect(osc.frequency));
    const hp = this.filt('highpass', 260, 0.7);
    const pk1 = this.filt('peaking', 950, 1.4, 7);
    const pk2 = this.filt('peaking', 2600, 2.2, 5);
    const lp = this.filt('lowpass', Math.min(7500, f * 9), 0.6);
    const g = this.gain(0);
    const A = o.attack ?? 0.09;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.85, t + A);
    if (dur > 0.4) g.gain.linearRampToValueAtTime(vel, t + Math.max(A + 0.05, dur * 0.6));
    g.gain.setTargetAtTime(0, t + dur, o.release ?? 0.07);
    pre.connect(hp);
    hp.connect(pk1);
    pk1.connect(pk2);
    pk2.connect(lp);
    lp.connect(g);
    g.connect(bus);
    const ns = this.noiseSrc(t, dur + 0.2);
    const nb = this.filt('bandpass', 3200, 0.8), ng = this.gain(0);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(vel * 0.12, t + 0.05);
    ng.gain.setTargetAtTime(0, t + dur, 0.05);
    ns.connect(nb);
    nb.connect(ng);
    ng.connect(bus);
  }

  // vel ~ output RMS * 3 (three detuned saws per note, normalised by voice count)
  strings(bus, t, dur, notes, vel = 0.1, o = {}) {
    const c = this.ctx, A = o.attack ?? 0.45, R = o.release ?? 0.8, end = t + dur + R * 1.3;
    const g = this.gain(0);
    const peak = vel / Math.sqrt(notes.length * 3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + A);
    if (o.swell) g.gain.linearRampToValueAtTime(peak * o.swell, t + dur);
    g.gain.setTargetAtTime(0, t + dur, R / 3);
    g.connect(bus);
    const sides = [-0.5, 0.5].map((pan) => {
      const lp = this.filt('lowpass', o.cutoff ?? 2200, 0.5);
      if (o.cutoffTo) {
        lp.frequency.setValueAtTime(o.cutoff ?? 2200, t);
        lp.frequency.linearRampToValueAtTime(o.cutoffTo, t + dur);
      }
      const p = c.createStereoPanner();
      p.pan.value = pan;
      lp.connect(p);
      p.connect(g);
      return lp;
    });
    for (const m of notes) {
      [-10, 1, 11].forEach((det, i) => {
        this.osc('sawtooth', mtof(m), t, end, det + (this.rand() - 0.5) * 4).connect(sides[i === 1 ? (m % 2) : i >> 1]);
      });
    }
  }

  lowPad(bus, t, dur, midi, vel = 0.15, o = {}) {
    const f = mtof(midi), end = t + dur + 1;
    const lp = this.filt('lowpass', o.cutoff ?? 420, 0.7);
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + (o.attack ?? 0.25));
    g.gain.setTargetAtTime(0, t + dur, 0.25);
    for (const det of [-6, 6]) this.osc('sawtooth', f, t, end, det).connect(lp);
    lp.connect(g);
    g.connect(bus);
    const sub = this.osc('sine', f / 2, t, end), sg = this.gain(0);
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(vel * (o.sub ?? 0.9), t + (o.attack ?? 0.25));
    sg.gain.setTargetAtTime(0, t + dur, 0.25);
    sub.connect(sg);
    sg.connect(bus);
    if (o.trem) {
      const tl = this.osc('sine', o.trem, t, end), tg = this.gain(vel * 0.4);
      tl.connect(tg);
      tg.connect(g.gain);
    }
  }

  cello(bus, t, dur, midi, vel = 0.2) {
    const f = mtof(midi), end = t + dur + 0.15;
    const lp = this.filt('lowpass', 950, 0.9);
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.setTargetAtTime(vel * 0.45, t + 0.02, 0.06);
    g.gain.setTargetAtTime(0, t + dur, 0.03);
    for (const det of [-4, 4]) this.osc('sawtooth', f, t, end, det).connect(lp);
    lp.connect(g);
    g.connect(bus);
  }

  brass(bus, t, dur, midi, vel = 0.12, o = {}) {
    const f = mtof(midi), end = t + dur + 0.4, br = o.bright ?? 2400;
    const lp = this.filt('lowpass', 350, 1.1);
    lp.frequency.setValueAtTime(350, t);
    lp.frequency.exponentialRampToValueAtTime(br, t + 0.07);
    lp.frequency.exponentialRampToValueAtTime(br * 0.6, t + 0.5);
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.05);
    g.gain.setTargetAtTime(vel * 0.8, t + 0.06, 0.2);
    g.gain.setTargetAtTime(0, t + dur, 0.08);
    for (const det of [-7, 0, 7]) {
      const osc = this.osc('sawtooth', f, t, end, det);
      osc.detune.setValueAtTime(det - 35, t);
      osc.detune.linearRampToValueAtTime(det, t + 0.06);
      osc.connect(lp);
    }
    lp.connect(g);
    g.connect(bus);
  }

  choir(bus, t, dur, notes, vel = 0.1, o = {}) {
    const A = o.attack ?? 0.6, R = o.release ?? 1.0, end = t + dur + R * 1.3;
    const input = this.gain(1), out = this.gain(0);
    for (const [ff, gg, q] of [[730, 1, 8], [1090, 0.55, 10], [2440, 0.3, 13], [3400, 0.12, 15]]) {
      const bp = this.filt('bandpass', ff, q), fg = this.gain(gg * 2.4);
      input.connect(bp);
      bp.connect(fg);
      fg.connect(out);
    }
    const peak = vel / Math.sqrt(notes.length * 2);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + A);
    if (o.swell) out.gain.linearRampToValueAtTime(peak * o.swell, t + dur);
    out.gain.setTargetAtTime(0, t + dur, R / 3);
    out.connect(bus);
    for (const m of notes) {
      for (const det of [-12, 12]) this.osc('sawtooth', mtof(m), t, end, det + (this.rand() - 0.5) * 6).connect(input);
    }
  }

  // Small bell: inharmonic sine partials, the upper ones dying first.
  chime(bus, t, midi, vel = 0.12, dec = 1.8) {
    const f = mtof(midi);
    [[1, 1, 1], [2.76, 0.45, 0.45], [5.4, 0.22, 0.22]].forEach(([ratio, amp, life]) => {
      if (f * ratio > 16000) return;
      const o = this.osc('sine', f * ratio, t, t + dec * life + 0.05), g = this.gain(0);
      this.perc(g, t, vel * amp, dec * life, 0.002);
      o.connect(g);
      g.connect(bus);
    });
  }

  // ---------- percussion ----------
  taiko(bus, t, vel = 0.7, o = {}) {
    vel *= 0.65;
    const p = o.pitch ?? 1, dec = o.decay ?? 0.75;
    const o1 = this.osc('sine', 150 * p, t, t + dec + 0.1);
    o1.frequency.exponentialRampToValueAtTime(52 * p, t + 0.16);
    const g1 = this.gain(0);
    this.perc(g1, t, vel, dec, 0.004);
    o1.connect(g1);
    g1.connect(bus);
    const o2 = this.osc('triangle', 260 * p, t, t + 0.3);
    o2.frequency.exponentialRampToValueAtTime(130 * p, t + 0.1);
    const g2 = this.gain(0);
    this.perc(g2, t, vel * 0.3, 0.14, 0.002);
    o2.connect(g2);
    g2.connect(bus);
    const n = this.noiseSrc(t, 0.2), lp = this.filt('lowpass', 1100 * p, 0.8), g3 = this.gain(0);
    this.perc(g3, t, vel * 0.55, 0.07, 0.001);
    n.connect(lp);
    lp.connect(g3);
    g3.connect(bus);
  }

  clap(bus, t, vel = 0.15, pitch = 1) {
    const o = this.osc('sine', 1850 * pitch, t, t + 0.1), g = this.gain(0);
    this.perc(g, t, vel, 0.05, 0.001);
    o.connect(g);
    g.connect(bus);
    const n = this.noiseSrc(t, 0.08), bp = this.filt('bandpass', 3200 * pitch, 2.5), g2 = this.gain(0);
    this.perc(g2, t, vel * 1.6, 0.035, 0.001);
    n.connect(bp);
    bp.connect(g2);
    g2.connect(bus);
  }

  wood(bus, t, vel = 0.15, pitch = 1) {
    const o = this.osc('sine', 980 * pitch, t, t + 0.12), g = this.gain(0);
    this.perc(g, t, vel, 0.07, 0.001);
    o.connect(g);
    g.connect(bus);
    const o2 = this.osc('sine', 2500 * pitch, t, t + 0.05), g2 = this.gain(0);
    this.perc(g2, t, vel * 0.35, 0.02, 0.001);
    o2.connect(g2);
    g2.connect(bus);
  }

  crash(bus, t, vel = 0.3, dec = 2.2) {
    const n = this.noiseSrc(t, dec + 0.2);
    const hp = this.filt('highpass', 3800, 0.7), pk = this.filt('peaking', 6500, 1, 6), g = this.gain(0);
    this.perc(g, t, vel, dec, 0.002);
    n.connect(hp);
    hp.connect(pk);
    pk.connect(g);
    g.connect(bus);
    for (const fr of [415, 587, 823, 1170]) {
      const o = this.osc('square', fr, t, t + dec), bp = this.filt('bandpass', fr * 4, 3), og = this.gain(0);
      this.perc(og, t, vel * 0.05, dec * 0.6, 0.002);
      o.connect(bp);
      bp.connect(og);
      og.connect(bus);
    }
  }

  gong(bus, t, vel = 0.5, o = {}) {
    const f0 = o.f0 ?? 80, dec = o.decay ?? 6, soft = o.soft ? 0.35 : 0;
    [1, 1.47, 1.97, 2.43, 2.94, 3.52, 4.11, 4.73, 5.36, 6.07].forEach((p, i) => {
      const osc = this.osc('sine', f0 * p * (1 + (this.rand() - 0.5) * 0.004), t, t + dec + 0.5);
      const g = this.gain(0);
      const a = 0.004 + i * 0.035 + soft;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((vel * 0.22) / (1 + i * 0.5), t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec * (1 - i * 0.06));
      osc.connect(g);
      g.connect(bus);
    });
    const n = this.noiseSrc(t, dec), bp = this.filt('bandpass', 1400, 0.8), ng = this.gain(0);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(vel * 0.06, t + 0.6 + soft);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(bus);
    if (!soft) {
      const th = this.osc('sine', f0 * 0.75, t, t + 0.6), tg = this.gain(0);
      this.perc(tg, t, vel * 0.5, 0.45, 0.003);
      th.connect(tg);
      tg.connect(bus);
    }
  }

  // ---------- sound effects ----------
  whoosh(bus, t, dur = 0.35, vel = 0.2, f0 = 400, f1 = 2400) {
    const n = this.noiseSrc(t, dur + 0.05), bp = this.filt('bandpass', f0, 1.4), g = this.gain(0);
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + dur * 0.55);
    g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(bp);
    bp.connect(g);
    g.connect(bus);
  }

  riser(bus, t, dur, vel = 0.15) {
    const n = this.noiseSrc(t, dur), bp = this.filt('bandpass', 300, 1.2), g = this.gain(0);
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(5000, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + dur - 0.02);
    g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(bp);
    bp.connect(g);
    g.connect(bus);
    const o = this.osc('sawtooth', 110, t, t + dur);
    o.frequency.exponentialRampToValueAtTime(880, t + dur);
    const lp = this.filt('lowpass', 1200, 1), og = this.gain(0);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(vel * 0.22, t + dur - 0.02);
    og.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp);
    lp.connect(og);
    og.connect(bus);
  }

  revCymbal(bus, t0, t1, vel = 0.2) {
    const n = this.noiseSrc(t0, t1 - t0 + 0.02), hp = this.filt('highpass', 2500, 0.7), g = this.gain(0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vel, t1 - 0.01);
    g.gain.linearRampToValueAtTime(0, t1);
    n.connect(hp);
    hp.connect(g);
    g.connect(bus);
  }

  boing(bus, t, vel = 0.15, f0 = 380, f1 = 150, dur = 0.45) {
    const o = this.osc('triangle', f0, t, t + dur + 0.1);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const l = this.osc('sine', 13, t, t + dur + 0.1), lg = this.gain(f0 * 0.08);
    l.connect(lg);
    lg.connect(o.frequency);
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
  }

  warble(bus, t, dur, vel = 0.06) {
    const o = this.osc('triangle', 330, t, t + dur + 0.05);
    const l = this.osc('sine', 7, t, t + dur + 0.05), lg = this.gain(45);
    l.connect(lg);
    lg.connect(o.frequency);
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.08);
    g.gain.linearRampToValueAtTime(vel * 1.3, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g);
    g.connect(bus);
  }

  thud(bus, t, vel = 0.3) {
    const o = this.osc('sine', 120, t, t + 0.35);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
    const g = this.gain(0);
    this.perc(g, t, vel, 0.28, 0.002);
    o.connect(g);
    g.connect(bus);
    const n = this.noiseSrc(t, 0.12), lp = this.filt('lowpass', 500, 0.7), ng = this.gain(0);
    this.perc(ng, t, vel * 0.6, 0.08, 0.001);
    n.connect(lp);
    lp.connect(ng);
    ng.connect(bus);
  }

  hit(bus, t, vel = 0.25, pitch = 1) {
    const n = this.noiseSrc(t, 0.15), bp = this.filt('bandpass', 1700 * pitch, 0.9), g = this.gain(0);
    this.perc(g, t, vel, 0.07, 0.001);
    n.connect(bp);
    bp.connect(g);
    g.connect(bus);
    const o = this.osc('sine', 220 * pitch, t, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(80 * pitch, t + 0.09);
    const og = this.gain(0);
    this.perc(og, t, vel * 0.9, 0.11, 0.002);
    o.connect(og);
    og.connect(bus);
  }

  buzz(bus, t, dur = 0.3, vel = 0.08) {
    const lp = this.filt('lowpass', 1400, 1), g = this.gain(0);
    for (const f of [98, 104]) this.osc('square', f, t, t + dur + 0.05).connect(lp);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.01);
    g.gain.setValueAtTime(vel, t + dur - 0.03);
    g.gain.linearRampToValueAtTime(0, t + dur);
    lp.connect(g);
    g.connect(bus);
  }

  thunder(bus, t, vel = 0.4, dur = 3) {
    const n1 = this.noiseSrc(t, 0.4), hp = this.filt('highpass', 1200, 0.7), g1 = this.gain(0);
    this.perc(g1, t, vel * 0.45, 0.3, 0.004);
    n1.connect(hp);
    hp.connect(g1);
    g1.connect(bus);
    const n2 = this.noiseSrc(t, dur + 0.2, true), lp = this.filt('lowpass', 380, 0.8), g2 = this.gain(0);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(vel, t + 0.08);
    g2.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.7);
    g2.gain.linearRampToValueAtTime(vel * 0.7, t + 1.1);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n2.connect(lp);
    lp.connect(g2);
    g2.connect(bus);
  }

  bed(bus, t0, t1, vel, type) {
    const n = this.noiseSrc(t0, t1 - t0 + 0.1);
    const f = type === 'rain' ? this.filt('bandpass', 3500, 0.5) : this.filt('bandpass', 520, 0.8);
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vel, t0 + 0.8);
    if (type !== 'rain') {
      for (let x = t0 + 1.4; x < t1 - 1.2; x += 1.3) g.gain.linearRampToValueAtTime(vel * (0.55 + this.rand() * 0.9), x);
    }
    g.gain.setValueAtTime(vel, t1 - 0.8);
    g.gain.linearRampToValueAtTime(0, t1);
    n.connect(f);
    f.connect(g);
    g.connect(bus);
  }

  tick(bus, t, vel = 0.04) {
    const n = this.noiseSrc(t, 0.03), hp = this.filt('highpass', 3000, 0.7), g = this.gain(0);
    this.perc(g, t, vel, 0.015, 0.0005);
    n.connect(hp);
    hp.connect(g);
    g.connect(bus);
  }

  flap(bus, t, vel = 0.1) {
    const n = this.noiseSrc(t, 0.22), bp = this.filt('bandpass', 1800, 0.6), g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 4; k++) {
      g.gain.linearRampToValueAtTime(vel * (1 - k * 0.2), t + k * 0.035 + 0.01);
      g.gain.linearRampToValueAtTime(vel * 0.1, t + k * 0.035 + 0.03);
    }
    g.gain.linearRampToValueAtTime(0, t + 0.18);
    n.connect(bp);
    bp.connect(g);
    g.connect(bus);
  }

  subDrop(bus, t, vel = 0.5, dur = 1.1) {
    const o = this.osc('sine', 72, t, t + dur + 0.1);
    o.frequency.exponentialRampToValueAtTime(30, t + dur);
    const g = this.gain(0);
    this.perc(g, t, vel, dur, 0.005);
    o.connect(g);
    g.connect(bus);
  }
}

// ---------------------------------------------------------------- the cue
const CHORDS = {
  1: ['F#3', 'B3', 'D4'], 2: ['G3', 'B3', 'D4'], 3: ['A3', 'C#4', 'E4'], 4: ['F#3', 'A3', 'D4'],
  5: ['F#3', 'B3', 'D4', 'F#4'], 6: ['G3', 'B3', 'D4', 'F#4'], 7: ['A3', 'C#4', 'E4', 'A4'], 8: ['G3', 'Bb3', 'D4'],
  10: ['D3', 'F#3', 'A3', 'D4', 'F#4', 'A4'], 11: ['G3', 'B3', 'D4', 'F#4'], 12: ['F#3', 'A3', 'D4', 'E4'],
};
const ROOTS = { 1: 'B2', 2: 'G2', 3: 'A2', 4: 'D3', 5: 'B2', 6: 'G2', 7: 'A2', 8: 'G2', 9: 'A2', 10: 'D3', 11: 'G2', 12: 'D3' };

// [bar, beat, beats, note, instrument, velocity, options]
const MELODY = [
  [1, 0, 1.5, 'B4', 'dizi', 0.111, { from: 'A4' }], [1, 1.5, 0.5, 'D5', 'dizi', 0.105], [1, 2, 2, 'E5', 'dizi', 0.116],
  [2, 0, 1, 'F#5', 'dizi', 0.122], [2, 1, 0.5, 'E5', 'dizi', 0.111], [2, 1.5, 0.5, 'D5', 'dizi', 0.111], [2, 2, 1, 'E5', 'dizi', 0.116], [2, 3, 1, 'B4', 'dizi', 0.111],
  [3, 0, 1.5, 'A4', 'dizi', 0.122, { from: 'F#4' }], [3, 1.5, 0.5, 'B4', 'dizi', 0.122], [3, 2, 1, 'D5', 'dizi', 0.128], [3, 3, 1, 'E5', 'dizi', 0.133],
  [4, 0, 2, 'D5', 'dizi', 0.133],
  [5, 0, 0.75, 'F#5', 'erhu', 0.15, { from: 'E5' }], [5, 0.75, 0.25, 'E5', 'erhu', 0.14], [5, 1, 0.5, 'D5', 'erhu', 0.14], [5, 1.5, 0.5, 'E5', 'erhu', 0.14],
  [5, 2, 1, 'F#5', 'erhu', 0.15], [5, 3, 1, 'A5', 'erhu', 0.16, { from: 'F#5' }],
  [6, 0, 1.5, 'B5', 'erhu', 0.16], [6, 1.5, 0.5, 'A5', 'erhu', 0.15], [6, 2, 1, 'F#5', 'erhu', 0.15], [6, 3, 0.5, 'D5', 'erhu', 0.14], [6, 3.5, 0.5, 'E5', 'erhu', 0.14],
  [7, 0, 1.5, 'F#5', 'erhu', 0.16], [7, 1.5, 0.5, 'E5', 'erhu', 0.15], [7, 2, 1, 'A5', 'erhu', 0.16], [7, 3, 1, 'B5', 'erhu', 0.17],
  [8, 0, 1.5, 'D5', 'erhu', 0.15, { from: 'C5' }], [8, 1.5, 0.5, 'Bb4', 'erhu', 0.14], [8, 2, 1, 'A4', 'erhu', 0.14], [8, 3, 1, 'G4', 'erhu', 0.14],
  [9, 0, 1.5, 'A4', 'erhu', 0.15], [9, 1.5, 0.5, 'B4', 'erhu', 0.15], [9, 2, 0.5, 'D5', 'erhu', 0.16], [9, 2.5, 0.5, 'E5', 'erhu', 0.16],
  [9, 3, 0.5, 'F#5', 'erhu', 0.17], [9, 3.5, 0.5, 'A5', 'erhu', 0.18],
  [10, 0, 2, 'D6', 'erhu', 0.257, { from: 'A5', glide: 0.06 }], [10, 2, 0.5, 'B5', 'erhu', 0.23], [10, 2.5, 0.5, 'A5', 'erhu', 0.23], [10, 3, 0.5, 'F#5', 'erhu', 0.23], [10, 3.5, 0.5, 'A5', 'erhu', 0.23],
  [11, 0, 1, 'F#5', 'dizi', 0.144], [11, 1, 0.5, 'E5', 'dizi', 0.137], [11, 1.5, 0.5, 'D5', 'dizi', 0.137], [11, 2, 1, 'E5', 'dizi', 0.144], [11, 3, 1, 'B4', 'dizi', 0.137],
  [12, 0, 1.5, 'A4', 'dizi', 0.137, { from: 'F#4' }], [12, 1.5, 0.5, 'B4', 'dizi', 0.13], [12, 2, 2, 'D5', 'dizi', 0.144],
];

const ARPS = {
  1: ['B3', 'D4', 'F#4', 'A4', 'B4', 'A4', 'F#4', 'D4'],
  2: ['B3', 'D4', 'E4', 'B4', 'D5', 'B4', 'E4', 'D4'],
  3: ['A3', 'B3', 'E4', 'A4', 'B4', 'A4', 'E4', 'B3'],
  4: ['D4', 'F#4', 'A4', 'D5', 'F#5', 'D5', 'A4', 'F#4'],
  6: ['B3', 'D4', 'E4', 'B4', 'D5', 'E5', 'D5', 'B4'],
  7: ['A3', 'E4', 'A4', 'B4', 'E5', 'A5', 'E5', 'B4'],
  11: ['B3', 'D4', 'E4', 'B4', 'D5', 'B4', 'E4', 'D4'],
  12: ['D4', 'F#4', 'A4', 'D5'],
};

function compose(S) {
  const zheng = S.bus('zheng', 2.0, 0.34, -0.18);
  const lead = S.bus('lead', 1.0, 0.42, 0.05);
  const strB = S.bus('strings', 1.0, 0.45);
  const low = S.bus('low', 0.9, 0.18);
  const brassB = S.bus('brass', 0.8, 0.35, 0.1);
  const choirB = S.bus('choir', 1.0, 0.6, -0.05);
  const drums = S.bus('drums', 0.95, 0.2);
  const metal = S.bus('metal', 0.75, 0.5);
  const sfx = S.bus('sfx', 0.75, 0.16);
  const bell = S.bus('bell', 0.6, 0.6, 0.15);

  // strings pad
  const padVel = { 1: 0.09, 2: 0.12, 3: 0.14, 4: 0.14, 5: 0.17, 6: 0.18, 7: 0.2, 8: 0.2, 10: 0.26, 11: 0.16, 12: 0.14 };
  for (const [bar, notes] of Object.entries(CHORDS)) {
    const b = Number(bar);
    S.strings(strB, at(b), 4 * BEAT + 0.08, notes.map(N), padVel[b], { attack: b === 1 ? 1.0 : b === 10 ? 0.06 : 0.35, cutoff: b === 10 ? 3200 : b >= 11 ? 1600 : 2200 });
  }
  S.strings(strB, at(9), 2 * BEAT, ['A3', 'D4', 'E4'].map(N), 0.2, { attack: 0.2, swell: 1.3, cutoff: 1800, cutoffTo: 2600 });
  S.strings(strB, at(9, 2), 2 * BEAT + 0.05, ['A3', 'C#4', 'E4', 'A4'].map(N), 0.27, { attack: 0.1, swell: 1.4, cutoff: 2600, cutoffTo: 3600 });

  // low end
  for (const b of [1, 2, 3, 4, 11, 12]) S.lowPad(low, at(b), 4 * BEAT + 0.05, N(ROOTS[b]), b === 1 ? 0.035 : 0.055, { attack: b === 1 ? 0.8 : 0.3 });
  S.lowPad(low, at(8), 4 * BEAT, N('G2'), 0.085, { trem: 7, cutoff: 360 });
  S.lowPad(low, at(10), 4 * BEAT, N('D3'), 0.1, { attack: 0.02, cutoff: 700, sub: 1.1 });
  const ost = {
    5: ['B2', 'B2', 'B3', 'B2', 'B2', 'B2', 'A2', 'B2'],
    6: ['G2', 'G2', 'G3', 'G2', 'G2', 'G2', 'A2', 'G2'],
    7: ['A2', 'A2', 'A3', 'A2', 'A2', 'A2', 'B2', 'C#3'],
    9: ['A2', 'A2', 'A3', 'A2', 'A2', 'A2', 'A3', 'A2'],
    10: ['D3', 'D3', 'D4', 'D3', 'D3', 'D3', 'A2', 'D3'],
  };
  for (const [bar, notes] of Object.entries(ost)) {
    notes.forEach((nn, i) => S.cello(low, at(Number(bar), i * 0.5), BEAT * 0.45, N(nn), (bar === '9' ? 0.14 + i * 0.012 : 0.17) * (i % 2 ? 0.8 : 1)));
  }

  // melody
  for (const [bar, beat, len, note, inst, vel, o = {}] of MELODY) {
    const opts = { ...o, from: o.from ? N(o.from) : undefined };
    const t = at(bar, beat), dur = len * BEAT;
    if (inst === 'dizi') S.dizi(lead, t, dur * 0.97, N(note), vel, opts);
    else S.erhu(lead, t, dur * 0.97, N(note), vel, opts);
    if (bar === 6 || bar === 7) S.dizi(lead, t, dur * 0.95, N(note), vel * 0.4, { ...opts, vib: 0.005 });
    if (bar === 10) S.dizi(lead, t, dur * 0.95, N(note) - 12, vel * 0.5, { ...opts, from: opts.from != null ? opts.from - 12 : undefined });
  }

  // brass
  const b9 = [['A3', 0, 1.5], ['B3', 1.5, 0.5], ['D4', 2, 0.5], ['E4', 2.5, 0.5], ['F#4', 3, 0.5], ['A4', 3.5, 0.5]];
  b9.forEach(([nn, beat, len], i) => S.brass(brassB, at(9, beat), len * BEAT * 0.95, N(nn), 0.05 + i * 0.012, { bright: 1600 + i * 250 }));
  const b10 = [['D5', 0, 2], ['B4', 2, 0.5], ['A4', 2.5, 0.5], ['F#4', 3, 0.5], ['A4', 3.5, 0.5]];
  b10.forEach(([nn, beat, len]) => {
    S.brass(brassB, at(10, beat), len * BEAT * 0.95, N(nn), 0.12, { bright: 2800 });
    S.brass(brassB, at(10, beat), len * BEAT * 0.95, N(nn) - 12, 0.1, { bright: 2000 });
  });
  for (const nn of ['F#4', 'A4']) S.brass(brassB, at(10), 2 * BEAT, N(nn), 0.07, { bright: 2200 });
  for (const nn of ['G3', 'D4']) S.brass(brassB, at(11), 4 * BEAT, N(nn), 0.03, { bright: 900 });

  // choir
  S.choir(choirB, at(9), 4 * BEAT, ['A3', 'E4', 'A4'].map(N), 0.18, { attack: 0.5, swell: 2.2 });
  S.choir(choirB, at(10), 4 * BEAT, ['D4', 'F#4', 'A4', 'D5'].map(N), 0.42, { attack: 0.05 });
  S.choir(choirB, at(11), 4 * BEAT, ['G3', 'B3', 'D4', 'F#4'].map(N), 0.16, { attack: 0.5 });
  S.choir(choirB, at(12), 4 * BEAT, ['D4', 'F#4', 'A4'].map(N), 0.13, { attack: 0.4, release: 1.4 });

  // guzheng
  const arpVel = { 1: 0.24, 2: 0.2, 3: 0.2, 4: 0.2, 6: 0.18, 7: 0.18, 11: 0.17, 12: 0.15 };
  for (const [bar, notes] of Object.entries(ARPS)) {
    notes.forEach((nn, i) => S.pluck(zheng, at(Number(bar), i * 0.5), N(nn), arpVel[bar] * (i === 0 ? 1.25 : i % 2 ? 0.8 : 1), { vib: i === 0 ? 0.005 : 0 }));
  }
  ['B3', 'F#4', 'B3', 'F#4', 'B3', 'F#4', 'A3', 'E4'].forEach((nn, i) => S.pluck(zheng, at(5, i * 0.5), N(nn), 0.17, { len: 0.2 }));
  S.pluck(zheng, at(8), N('D3'), 0.3, { t60: 4, vib: 0.006 });
  S.pluck(zheng, at(8), N('D4'), 0.22, { t60: 3.5 });
  S.pluck(zheng, at(8, 2), N('A3'), 0.18, { t60: 3 });
  S.pluck(zheng, at(8, 3), N('D3'), 0.16, { t60: 3 });
  pent(N('A3'), N('D5')).slice(0, 8).forEach((m, i) => S.pluck(zheng, at(9, i * 0.25), m, 0.12 + i * 0.01));
  pent(N('E4'), N('A5')).slice(0, 8).forEach((m, i) => S.pluck(zheng, at(9, 2 + i * 0.25), m, 0.18 + i * 0.012));
  ['D5', 'F#5', 'A5', 'D6', 'A5', 'F#5', 'D5', 'A4', 'D5', 'F#5', 'A5', 'D6'].forEach((nn, i) => S.pluck(zheng, at(10, 1 + i * 0.25), N(nn), 0.14));
  // glissandi on the cuts
  S.gliss(zheng, 2.26, N('D4'), N('A5'), 0.24, 0.2);
  S.gliss(zheng, 4.2, N('A4'), N('D6'), 0.18, 0.2);
  S.gliss(zheng, 7.26, N('D4'), N('B5'), 0.24, 0.2);
  S.gliss(zheng, 9.2, N('A4'), N('D6'), 0.18, 0.2);
  S.gliss(zheng, 12.26, N('D4'), N('A5'), 0.24, 0.2);
  S.gliss(zheng, 13.3, N('D4'), N('D6'), 0.26, 0.15, true);
  S.gliss(zheng, 13.58, N('A4'), N('D6'), 0.17, 0.2);
  S.gliss(zheng, 17.3, N('D3'), N('A4'), 0.2, 0.2, true);
  S.gliss(zheng, 22.5, N('D4'), N('D6'), 0.34, 0.27);
  S.gliss(zheng, 24.9, N('D4'), N('D6'), 0.55, 0.13, true);

  // percussion
  S.gong(metal, 0, 0.3, { f0: 73, decay: 5.5, soft: true });
  S.clap(drums, at(2, 1), 0.06);
  S.clap(drums, at(2, 3), 0.06);
  for (let i = 0; i < 8; i++) S.wood(drums, at(3, i * 0.5), 0.045, i % 2 ? 1.2 : 1);
  S.taiko(drums, at(3), 0.25, { pitch: 1.8, decay: 0.3 });
  S.taiko(drums, at(3, 2), 0.22, { pitch: 1.8, decay: 0.3 });
  S.taiko(drums, at(4), 0.42, { pitch: 1.2 });
  S.taiko(drums, at(4, 2), 0.2, { pitch: 1.6, decay: 0.3 });
  [[0, 0.75], [0.75, 0.35], [1.5, 0.45], [2, 0.65], [2.75, 0.35], [3, 0.5], [3.5, 0.5]].forEach(([b, v]) => S.taiko(drums, at(5, b), v));
  S.clap(drums, at(5, 1), 0.11);
  S.clap(drums, at(5, 3), 0.11);
  [[0, 0.6], [2, 0.45], [2.5, 0.3]].forEach(([b, v]) => S.taiko(drums, at(6, b), v));
  S.clap(drums, at(6, 1), 0.09);
  S.clap(drums, at(6, 3), 0.09);
  S.taiko(drums, at(6, 3.5), 0.25, { pitch: 1.6, decay: 0.3 });
  S.taiko(drums, at(6, 3.75), 0.3, { pitch: 1.5, decay: 0.3 });
  [0.55, 0.25, 0.4, 0.25, 0.5, 0.3, 0.45, 0.3, 0.42, 0.47].forEach((v, i) => S.taiko(drums, at(7, i < 7 ? i * 0.5 : 3 + (i - 6) * 0.25), v, { pitch: i % 2 ? 1.3 : 1 }));
  S.taiko(drums, at(8), 0.55, { pitch: 0.8, decay: 1.3 });
  for (let i = 0; i < 8; i++) S.taiko(drums, at(8, 2 + i * 0.25), 0.08 + i * 0.035, { pitch: 0.85, decay: 0.4 });
  for (let i = 0; i < 4; i++) S.taiko(drums, at(9, i * 0.5), 0.35 + i * 0.04, { pitch: 1 });
  for (let i = 0; i < 6; i++) S.taiko(drums, at(9, 2 + i * 0.25), 0.35 + i * 0.06, { pitch: 1.05 });
  for (let i = 0; i < 6; i++) S.hit(sfx, at(9, 3 + i * 0.0833), 0.05 + i * 0.03, 1.5);
  S.taiko(drums, at(10), 1.0, { pitch: 0.75, decay: 1.6 });
  for (let b = 1; b < 4; b++) S.taiko(drums, at(10, b), 0.55, { pitch: 1 });
  for (let b = 0; b < 4; b++) S.taiko(drums, at(10, b + 0.5), 0.28, { pitch: 1.3, decay: 0.4 });
  S.crash(metal, at(10), 0.32, 2.8);
  S.crash(metal, at(7), 0.08, 1.2);
  S.gong(metal, at(10), 0.9, { f0: 62, decay: 6.5 });
  S.subDrop(low, at(10), 0.55, 1.2);
  S.gong(metal, at(12), 0.2, { f0: 73, decay: 4.5, soft: true });

  // sound effects, synced to the picture
  S.wood(sfx, 1.8, 0.06, 1.5);
  S.wood(sfx, 2.12, 0.06, 1.6);
  S.whoosh(sfx, 2.3, 0.3, 0.14, 500, 3000);
  S.whoosh(sfx, 2.95, 0.25, 0.1, 300, 1500);
  S.boing(sfx, 3.13, 0.12, 520, 200, 0.4);
  S.thud(sfx, 3.46, 0.3);
  S.thud(sfx, 3.64, 0.22);
  S.flap(sfx, 3.76, 0.12);
  S.chime(bell, 4.375, N('A6'), 0.07);
  for (let i = 0; i < 16; i++) S.tick(sfx, 4.46 + i * 0.045 + (i % 3) * 0.006, 0.035);
  [N('E5'), N('F#5'), N('A5'), N('B5'), N('E6')].forEach((m, i) => {
    const t = 5 + i * 0.3125;
    S.whoosh(sfx, t - 0.1, 0.16, 0.06, 800, 3500);
    S.chime(bell, t, m + 12, 0.05, 1.2);
  });
  S.chime(bell, 6.72, N('E6'), 0.08);
  S.whoosh(sfx, 7.3, 0.3, 0.14, 500, 3000);
  S.hit(sfx, 7.87, 0.14, 1.2);
  S.buzz(sfx, 8.4, 0.28, 0.06);
  S.wood(sfx, 8.7, 0.28, 0.55);
  S.boing(sfx, 8.72, 0.12, 300, 120, 0.5);
  S.thud(sfx, 9.05, 0.28);
  S.chime(bell, 9.375, N('A6'), 0.07);
  for (let k = 0; k < 10; k++) S.hit(sfx, 9.375 + k * 0.3125, 0.17 + k * 0.012, 1 + (k % 3) * 0.12);
  S.hit(sfx, 12.1875, 0.4, 0.8);
  S.crash(metal, 12.19, 0.14, 1.6);
  S.chime(bell, 12.3, N('D6'), 0.09);
  S.chime(bell, 12.38, N('A6'), 0.08);
  S.whoosh(sfx, 12.3, 0.3, 0.14, 500, 3000);
  S.warble(sfx, 12.72, 0.6, 0.05);
  for (let i = 0; i < 4; i++) S.wood(sfx, 13.36 + i * 0.07, 0.1 - i * 0.015, 0.7 + ((i * 37) % 5) * 0.12);
  S.chime(bell, 13.75, N('A6'), 0.07);
  const shimmer = pent(N('D6'), N('D7'));
  for (let i = 0; i < 16; i++) S.chime(bell, 13.9 + i * 0.078, shimmer[(i * 3) % shimmer.length], 0.03, 0.9);
  S.chime(bell, 16.25, N('D6'), 0.1);
  S.chime(bell, 16.33, N('F#6'), 0.09);
  S.chime(bell, 16.41, N('A6'), 0.09);
  S.thunder(sfx, 17.5, 0.16, 2.4);
  S.bed(sfx, 17.5, 22.6, 0.05, 'rain');
  S.bed(sfx, 17.6, 25.2, 0.04, 'wind');
  S.thunder(sfx, 18.12, 0.36, 3);
  S.thunder(sfx, 19.42, 0.3, 2.6);
  S.riser(sfx, 20, 2.45, 0.1);
  S.revCymbal(metal, 21.25, 22.5, 0.2);
  S.whoosh(sfx, 22.5, 0.6, 0.12, 3000, 400);
  [N('D6'), N('F#6'), N('A6'), N('D7')].forEach((m, i) => S.chime(bell, 22.5 + i * 0.3125, m, 0.09, 2));
  S.bed(sfx, 25, 30, 0.025, 'wind');
  [N('A6'), N('D7'), N('F#6'), N('B6'), N('E6'), N('A6'), N('D6')].forEach((m, i) => S.chime(bell, 25.4 + i * 0.52 + (i % 2) * 0.13, m, 0.028, 1.6));
}

const VOICES = ['pluck', 'dizi', 'erhu', 'strings', 'lowPad', 'cello', 'brass', 'choir', 'chime', 'taiko', 'clap', 'wood', 'crash', 'gong',
  'whoosh', 'riser', 'revCymbal', 'boing', 'warble', 'thud', 'hit', 'buzz', 'thunder', 'bed', 'tick', 'flap', 'subDrop'];

// Every connected node costs render time on every block, even before it starts, so the graph is
// built just in time: compose() only records (time, voice) events, and the render suspends every
// STEP seconds to create the voices that begin within the next two steps.
// `skip` lists voices to silence (used to profile the render).
export async function renderScore(sampleRate = 44100, skip = []) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil(sampleRate * DURATION), sampleRate);
  const S = new Synth(ctx);
  const events = [];
  for (const name of VOICES) {
    const voice = S[name].bind(S);
    S[name] = skip.includes(name) ? () => {} : (bus, t, ...args) => events.push({ t, run: () => voice(bus, t, ...args) });
  }
  compose(S);
  events.sort((a, b) => a.t - b.t);
  let next = 0;
  const flush = (until) => {
    while (next < events.length && events[next].t < until) events[next++].run();
  };
  const STEP = 0.5;
  if (typeof ctx.suspend === 'function') {
    flush(STEP * 2);
    for (let ts = STEP; ts < DURATION - 0.01; ts += STEP) {
      ctx.suspend(ts).then(() => {
        flush(ts + STEP * 2);
        ctx.resume();
      });
    }
  } else {
    flush(Infinity);
  }
  const buf = await ctx.startRendering();
  // The limiter's attack lets the odd transient overshoot full scale.
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  if (peak > 0.97) {
    const g = 0.97 / peak;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] *= g;
    }
  }
  return buf;
}

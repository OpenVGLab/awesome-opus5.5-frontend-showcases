'use strict';
// Web Audio: little synthesized instruments, paper/pen foley, and a score locked to the picture timeline.

const Sound = (() => {
  let ctx = null, master = null, verbIn = null, dry = null, wet = null, noiseBuf = null;
  let score = [], cursor = 0, t0 = 0, playing = false, ok = false, muted = false;
  const LEVEL = 1.2;
  const ksCache = new Map();

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const nn = (s) => {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  };
  const N = (str) => str.split(' ').map(nn);

  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const noise = (when, dur) => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.start(when, Math.random() * 1.5);
    s.stop(when + dur + 0.05);
    return s;
  };
  const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
  function perc(param, when, peak, a, d) {
    param.setValueAtTime(0.0001, when);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + a);
    param.exponentialRampToValueAtTime(0.0001, when + a + d);
  }
  function out(node, { pan = 0, send = 0.2, level = 1 } = {}) {
    let last = node;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); last.connect(p); last = p; }
    const g = gain(level);
    last.connect(g);
    g.connect(dry);
    if (send > 0) { const s = gain(send); g.connect(s); s.connect(wet); }
  }

  function makeNoise(sec) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function makeIR(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 120 ? i / 120 : 1);
    }
    return b;
  }

  // Karplus–Strong plucked string, rendered once per pitch
  function ks(midi, bright, dur) {
    const sr = ctx.sampleRate, key = `${midi}:${bright}:${dur}:${sr}`;
    let b = ksCache.get(key);
    if (b) return b;
    const f = mtof(midi), n = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * dur);
    b = ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0), ring = new Float32Array(n);
    let lp = 0;
    const a = 0.2 + bright * 0.75;
    for (let i = 0; i < n; i++) { lp += a * (Math.random() * 2 - 1 - lp); ring[i] = lp; }
    const decay = Math.pow(0.001, 1 / (f * dur * 0.95));
    let idx = 0, peak = 1e-6;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx], nxt = ring[(idx + 1) % n];
      ring[idx] = decay * 0.5 * (cur + nxt);
      d[i] = cur;
      if (Math.abs(cur) > peak) peak = Math.abs(cur);
      idx = (idx + 1) % n;
    }
    const fade = Math.min(len, Math.floor(sr * 0.02));
    for (let i = 0; i < len; i++) d[i] /= peak;
    for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
    ksCache.set(key, b);
    return b;
  }

  // ------------------------------------------------------------ instruments
  // Long instruments take (when, dur, off, ...): `off` > 0 means playback started part-way through the note.
  const I = {
    musicBox(when, midi, vel = 0.5, o = {}) {
      const f = mtof(midi), bus = gain(vel * 0.34), dec = o.decay || 1;
      for (const [r, a, d] of [[1, 1, 1.9], [2, 0.2, 0.9], [3.01, 0.08, 0.5], [4.17, 0.13, 0.32], [5.43, 0.05, 0.18]]) {
        if (f * r > ctx.sampleRate * 0.45) continue;
        const o1 = osc('sine', f * r), g = gain(0);
        perc(g.gain, when, a, 0.002, d * dec);
        chain(o1, g, bus);
        o1.start(when);
        o1.stop(when + d * dec + 0.1);
      }
      const hp = filt('highpass', 5000), ng = gain(0);
      perc(ng.gain, when, 0.08, 0.001, 0.015);
      chain(noise(when, 0.03), hp, ng, bus);
      out(bus, { pan: o.pan || 0, send: 0.45 });
    },
    kalimba(when, midi, vel = 0.5, o = {}) {
      const f = mtof(midi), bus = gain(vel * 0.46);
      const o1 = osc('sine', f), g1 = gain(0);
      o1.frequency.setValueAtTime(f * 1.012, when);
      o1.frequency.exponentialRampToValueAtTime(f, when + 0.03);
      perc(g1.gain, when, 1, 0.003, 1.2 * (o.decay || 1));
      const o2 = osc('sine', f * 5.95), g2 = gain(0);
      perc(g2.gain, when, 0.16, 0.001, 0.08);
      const o3 = osc('triangle', f * 2), g3 = gain(0);
      perc(g3.gain, when, 0.07, 0.002, 0.3);
      for (const [a, b] of [[o1, g1], [o2, g2], [o3, g3]]) { chain(a, b, bus); a.start(when); a.stop(when + 1.45); }
      out(bus, { pan: o.pan || 0, send: 0.35 });
    },
    glock(when, midi, vel = 0.5, o = {}) {
      const f = mtof(midi), bus = gain(vel * 0.24);
      for (const [r, a, d] of [[1, 1, 1.5], [2.76, 0.3, 0.4], [5.4, 0.1, 0.15], [8.93, 0.04, 0.07]]) {
        if (f * r > ctx.sampleRate * 0.45) continue;
        const o1 = osc('sine', f * r), g = gain(0);
        perc(g.gain, when, a, 0.001, d);
        chain(o1, g, bus);
        o1.start(when);
        o1.stop(when + d + 0.1);
      }
      out(bus, { pan: o.pan || 0, send: 0.45 });
    },
    pluck(when, midi, vel = 0.5, o = {}) {
      const src = ctx.createBufferSource();
      src.buffer = ks(midi, o.bright === undefined ? 0.5 : o.bright, o.dur || 1.5);
      const lp = filt('lowpass', o.lp || 5000), g = gain(vel * (o.gain || 0.5));
      if (o.len) g.gain.setTargetAtTime(0.0001, when + o.len, 0.04);
      chain(src, lp, g);
      src.start(when);
      src.stop(when + src.buffer.duration);
      out(g, { pan: o.pan || 0, send: o.send === undefined ? 0.2 : o.send });
    },
    bass(when, midi, vel = 0.5, o = {}) {
      const f = mtof(midi), len = o.len || 0.5, bus = gain(0);
      bus.gain.setValueAtTime(0.0001, when);
      bus.gain.exponentialRampToValueAtTime(vel * 0.3, when + 0.008);
      bus.gain.exponentialRampToValueAtTime(vel * 0.13, when + 0.12);
      bus.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.15, len));
      const o1 = osc('triangle', f), o2 = osc('sine', f), lp = filt('lowpass', 900);
      o1.connect(lp); o2.connect(lp); lp.connect(bus);
      o1.start(when); o2.start(when);
      o1.stop(when + len + 0.05); o2.stop(when + len + 0.05);
      out(bus, { send: 0.08 });
    },
    pad(when, dur, off, midis, vel = 0.4, o = {}) {
      const a = off > 0 ? 0.08 : o.attack || 0.5, rel = Math.min(o.release || 0.9, dur * 0.6), peak = vel * 0.065;
      const bus = gain(0), lp = filt('lowpass', o.lp || 1100, 0.3);
      bus.gain.setValueAtTime(0.0001, when);
      bus.gain.linearRampToValueAtTime(peak, when + a);
      bus.gain.setValueAtTime(peak, when + Math.max(a, dur - rel));
      bus.gain.linearRampToValueAtTime(0.0001, when + dur);
      for (const m of midis) {
        for (const det of [-7, 7]) { const o1 = osc('sawtooth', mtof(m)); o1.detune.value = det; o1.connect(lp); o1.start(when); o1.stop(when + dur + 0.05); }
        const s1 = osc('sine', mtof(m)), sg = gain(0.8);
        chain(s1, sg, lp);
        s1.start(when);
        s1.stop(when + dur + 0.05);
      }
      lp.connect(bus);
      out(bus, { send: 0.55 });
    },
    whistle(when, dur, off, midi, vel = 0.4, o = {}) {
      const f = mtof(midi), bus = gain(0);
      bus.gain.setValueAtTime(0.0001, when);
      bus.gain.linearRampToValueAtTime(vel * 0.16, when + 0.06);
      bus.gain.setValueAtTime(vel * 0.16, when + Math.max(0.06, dur - 0.12));
      bus.gain.linearRampToValueAtTime(0.0001, when + dur);
      const o1 = osc('sine', f), lfo = osc('sine', 5.3), lg = gain(0);
      lg.gain.setValueAtTime(0, when);
      lg.gain.linearRampToValueAtTime(f * 0.008, when + Math.min(0.3, dur));
      chain(lfo, lg);
      lg.connect(o1.frequency);
      chain(noise(when, dur), filt('bandpass', f * 2, 4), gain(vel * 0.05), bus);
      chain(o1, bus);
      o1.start(when); lfo.start(when);
      o1.stop(when + dur + 0.05); lfo.stop(when + dur + 0.05);
      out(bus, { send: 0.5, pan: o.pan || 0 });
    },
    clap(when, vel = 0.5, o = {}) {
      const bp = filt('bandpass', 1500, 0.9), g = gain(0);
      g.gain.setValueAtTime(0.0001, when);
      for (const k of [0, 0.011, 0.022]) { g.gain.setValueAtTime(vel * 0.55, when + k); g.gain.exponentialRampToValueAtTime(vel * 0.06, when + k + 0.009); }
      g.gain.setValueAtTime(vel * 0.4, when + 0.031);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
      chain(noise(when, 0.25), bp, g);
      out(g, { pan: o.pan || 0, send: 0.18 });
    },
    tick(when, vel = 0.4, o = {}) {
      const f = o.f || 950, o1 = osc('sine', f), g = gain(0), o2 = osc('triangle', f * 2.37), g2 = gain(0), bus = gain(1);
      o1.frequency.setValueAtTime(f * 1.15, when);
      o1.frequency.exponentialRampToValueAtTime(f, when + 0.012);
      perc(g.gain, when, vel * 0.5, 0.001, 0.07);
      perc(g2.gain, when, vel * 0.15, 0.001, 0.025);
      chain(o1, g, bus); chain(o2, g2, bus);
      o1.start(when); o2.start(when);
      o1.stop(when + 0.1); o2.stop(when + 0.05);
      out(bus, { pan: o.pan || 0, send: 0.1 });
    },
    shaker(when, vel = 0.3, o = {}) {
      const g = gain(0);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vel * 0.25, when + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
      chain(noise(when, 0.08), filt('highpass', 6500), g);
      out(g, { pan: o.pan === undefined ? 0.25 : o.pan, send: 0.05 });
    },
    kick(when, vel = 0.5) {
      const o1 = osc('sine', 150), g = gain(0);
      o1.frequency.setValueAtTime(150, when);
      o1.frequency.exponentialRampToValueAtTime(46, when + 0.12);
      perc(g.gain, when, vel * 0.9, 0.002, 0.26);
      chain(o1, g);
      o1.start(when);
      o1.stop(when + 0.32);
      out(g, { send: 0.02 });
    },
    pop(when, f = 700, vel = 0.5, o = {}) {
      const o1 = osc('sine', f * 2.2), g = gain(0);
      o1.frequency.setValueAtTime(f * 2.2, when);
      o1.frequency.exponentialRampToValueAtTime(f, when + 0.035);
      perc(g.gain, when, vel * 0.45, 0.002, 0.09);
      chain(o1, g);
      o1.start(when);
      o1.stop(when + 0.14);
      out(g, { pan: o.pan || 0, send: 0.15 });
    },
    thud(when, vel = 0.6) {
      const o1 = osc('sine', 120), g = gain(0), ng = gain(0), bus = gain(1);
      o1.frequency.setValueAtTime(120, when);
      o1.frequency.exponentialRampToValueAtTime(42, when + 0.16);
      perc(g.gain, when, vel * 0.8, 0.003, 0.3);
      perc(ng.gain, when, vel * 0.5, 0.002, 0.1);
      chain(o1, g, bus);
      chain(noise(when, 0.15), filt('lowpass', 420), ng, bus);
      o1.start(when);
      o1.stop(when + 0.36);
      out(bus, { send: 0.08 });
    },
    paper(when, dur = 0.3, vel = 0.4, o = {}) {
      const g = gain(0);
      g.gain.setValueAtTime(0.0001, when);
      let t = when;
      while (t < when + dur) {
        const env = Math.sin((Math.PI * (t - when)) / dur);
        const a = Math.max(0.0002, vel * (0.15 + Math.random() * 0.7) * env), dt = 0.004 + Math.random() * 0.008;
        g.gain.setValueAtTime(a, t);
        g.gain.exponentialRampToValueAtTime(a * 0.08 + 0.0001, t + dt);
        t += dt + 0.002 + Math.random() * 0.022;
      }
      g.gain.setValueAtTime(0.0001, t);
      chain(noise(when, dur + 0.05), filt('bandpass', o.f || 2600, 0.6), filt('highpass', 800), g);
      out(g, { pan: o.pan || 0, send: 0.12 });
    },
    tape(when, dur = 0.32, vel = 0.4, o = {}) {
      const bp = filt('bandpass', 700, 1.3), g = gain(0);
      bp.frequency.setValueAtTime(700, when);
      bp.frequency.exponentialRampToValueAtTime(3400, when + dur);
      g.gain.setValueAtTime(0.0001, when);
      for (let t = when, i = 0; t < when + dur; t += 0.011 + Math.random() * 0.006, i++) {
        const env = Math.min(1, (t - when) / 0.04) * (1 - (t - when) / dur);
        g.gain.setValueAtTime(Math.max(0.0002, vel * (i % 2 ? 0.25 : 0.9) * env), t);
      }
      g.gain.setValueAtTime(0.0001, when + dur);
      chain(noise(when, dur + 0.05), bp, g);
      out(g, { pan: o.pan || 0, send: 0.1 });
    },
    tear(when, dur = 0.7, vel = 0.5, o = {}) {
      const bp = filt('bandpass', 1700, 0.8), g = gain(0);
      bp.frequency.setValueAtTime(1900, when);
      bp.frequency.exponentialRampToValueAtTime(800, when + dur);
      g.gain.setValueAtTime(0.0001, when);
      for (let t = when; t < when + dur; t += 0.006 + Math.random() * 0.014) {
        const env = Math.min(1, (t - when) / 0.05) * Math.pow(1 - (t - when) / dur, 0.6);
        g.gain.setValueAtTime(Math.max(0.0002, vel * (0.3 + Math.random() * 0.7) * env), t);
      }
      g.gain.setValueAtTime(0.0001, when + dur);
      chain(noise(when, dur + 0.05), bp, g);
      out(g, { pan: o.pan || 0, send: 0.12 });
    },
    scribble(when, dur, off, vel = 0.4) {
      const bp = filt('bandpass', 3200, 1.3), g = gain(0);
      g.gain.setValueAtTime(0.0001, when);
      for (let t = when; t < when + dur - 0.02;) {
        const len = 0.05 + Math.random() * 0.04, a = vel * (0.5 + Math.random() * 0.5);
        bp.frequency.setValueAtTime(2600 + Math.random() * 1800, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(a, t + 0.012);
        g.gain.linearRampToValueAtTime(a * 0.4, t + len - 0.01);
        g.gain.linearRampToValueAtTime(0.0001, t + len);
        t += len + 0.004;
      }
      chain(noise(when, dur + 0.05), bp, g);
      out(g, { send: 0.08 });
    },
    pen(when, dur, vel = 0.22) {
      const g = gain(0), a = vel * (0.7 + Math.random() * 0.3), d = Math.max(0.025, dur);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(a, when + Math.min(0.012, d / 3));
      g.gain.setValueAtTime(a * 0.8, when + d * 0.7);
      g.gain.linearRampToValueAtTime(0.0001, when + d);
      chain(noise(when, d + 0.05), filt('bandpass', 4800, 0.9), filt('highpass', 2200), g);
      out(g, { send: 0.06, pan: 0.1 });
    },
    whoosh(when, dur = 0.5, vel = 0.4, o = {}) {
      const bp = filt('bandpass', o.f0 || 400, 1.2), g = gain(0);
      bp.frequency.setValueAtTime(o.f0 || 400, when);
      bp.frequency.exponentialRampToValueAtTime(o.f1 || 2400, when + dur);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vel * 0.6, when + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      chain(noise(when, dur + 0.05), bp, g);
      out(g, { pan: o.pan || 0, send: 0.25 });
    },
    slide(when, dur, f0, f1, vel = 0.3) {
      const o1 = osc('sine', f0), g = gain(0), lfo = osc('sine', 7), lg = gain(f0 * 0.012);
      o1.frequency.setValueAtTime(f0, when);
      o1.frequency.exponentialRampToValueAtTime(f1, when + dur);
      chain(lfo, lg);
      lg.connect(o1.frequency);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(vel * 0.3, when + 0.04);
      g.gain.setValueAtTime(vel * 0.3, when + dur - 0.06);
      g.gain.linearRampToValueAtTime(0.0001, when + dur);
      chain(o1, g);
      o1.start(when); lfo.start(when);
      o1.stop(when + dur + 0.05); lfo.stop(when + dur + 0.05);
      out(g, { send: 0.3 });
    },
    boing(when, f0 = 170, dur = 0.7, vel = 0.4) {
      const o1 = osc('triangle', f0), g = gain(0), lfo = osc('sine', 12), lg = gain(0);
      o1.frequency.setValueAtTime(f0, when);
      o1.frequency.exponentialRampToValueAtTime(f0 * 1.7, when + dur);
      lg.gain.setValueAtTime(f0 * 0.35, when);
      lg.gain.exponentialRampToValueAtTime(f0 * 0.02, when + dur);
      chain(lfo, lg);
      lg.connect(o1.frequency);
      perc(g.gain, when, vel * 0.5, 0.005, dur);
      chain(o1, filt('lowpass', 2000), g);
      o1.start(when); lfo.start(when);
      o1.stop(when + dur + 0.05); lfo.stop(when + dur + 0.05);
      out(g, { send: 0.25 });
    },
    chirp(when, vel = 0.2, o = {}) {
      const bus = gain(1);
      for (let k = 0; k < (o.n || 3); k++) {
        const t = when + k * 0.11, base = 2300 + Math.random() * 500, o1 = osc('sine', base), g = gain(0);
        o1.frequency.setValueAtTime(base, t);
        o1.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.04);
        o1.frequency.exponentialRampToValueAtTime(base * 1.2, t + 0.08);
        perc(g.gain, t, vel * 0.35, 0.008, 0.07);
        chain(o1, g, bus);
        o1.start(t);
        o1.stop(t + 0.1);
      }
      out(bus, { pan: o.pan || 0, send: 0.35 });
    },
    plip(when, f = 1500, vel = 0.3, o = {}) {
      const o1 = osc('sine', f), g = gain(0);
      o1.frequency.setValueAtTime(f, when);
      o1.frequency.exponentialRampToValueAtTime(f * 0.55, when + 0.05);
      perc(g.gain, when, vel * 0.4, 0.002, 0.07);
      chain(o1, g);
      o1.start(when);
      o1.stop(when + 0.1);
      out(g, { pan: o.pan || 0, send: 0.3 });
    },
    step(when, vel = 0.25, o = {}) {
      const g = gain(0);
      perc(g.gain, when, vel * 0.5, 0.004, 0.06);
      chain(noise(when, 0.08), filt('lowpass', 600), g);
      out(g, { pan: o.pan || 0, send: 0.05 });
    },
    rain(when, dur, off, vel = 0.3) {
      const fin = off > 0 ? 0.1 : 1.0, bus = gain(0);
      bus.gain.setValueAtTime(0.0001, when);
      bus.gain.linearRampToValueAtTime(vel, when + fin);
      bus.gain.setValueAtTime(vel, when + Math.max(fin, dur - 1.2));
      bus.gain.linearRampToValueAtTime(0.0001, when + dur);
      chain(noise(when, dur), filt('highpass', 700), filt('lowpass', 7000), gain(0.35), bus);
      chain(noise(when, dur), filt('lowpass', 900), gain(0.5), bus);
      for (let t = when + 0.05; t < when + dur - 0.1; t += 0.04 + Math.random() * 0.08) {
        const f = 1600 + Math.random() * 2600, o1 = osc('sine', f), g = gain(0);
        o1.frequency.setValueAtTime(f, t);
        o1.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.03);
        perc(g.gain, t, 0.05 + Math.random() * 0.06, 0.002, 0.03);
        chain(o1, g, bus);
        o1.start(t);
        o1.stop(t + 0.05);
      }
      out(bus, { send: 0.2 });
    },
    riser(when, dur, off, vel = 0.35) {
      const bp = filt('bandpass', 400, 2), g = gain(0);
      bp.frequency.setValueAtTime(400, when);
      bp.frequency.exponentialRampToValueAtTime(5000, when + dur);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vel * 0.5, when + dur * 0.95);
      g.gain.linearRampToValueAtTime(0.0001, when + dur);
      chain(noise(when, dur), bp, g);
      out(g, { send: 0.3 });
    },
    stamp(when, vel = 0.7) {
      I.thud(when, vel);
      const g = gain(0);
      perc(g.gain, when, vel * 0.5, 0.001, 0.06);
      chain(noise(when, 0.1), filt('bandpass', 1100, 1), g);
      out(g, { send: 0.1 });
    },
    flip(when, vel = 0.35) {
      const bp = filt('bandpass', 2600, 1), g = gain(0);
      bp.frequency.setValueAtTime(3200, when);
      bp.frequency.exponentialRampToValueAtTime(1100, when + 0.15);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vel * 0.5, when + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.17);
      chain(noise(when, 0.2), bp, g);
      out(g, { send: 0.12 });
    },
  };

  // ------------------------------------------------------------ the score (C major, 96 bpm, one bar = 2.5 s)
  function buildScore() {
    const S = [], R = rng(4242);
    const ev = (t, fn, ...args) => S.push({ t, fn, args });
    const long = (t, dur, fn, ...args) => S.push({ t, dur, fn, args });
    const strum = (t, notes, vel = 0.4, dir = 1, o = {}) => {
      const ns = dir > 0 ? notes : notes.slice().reverse();
      ns.forEach((m, i) => ev(t + i * 0.017, 'pluck', m, vel * (1 - i * 0.07), Object.assign({ bright: 0.6, dur: 1.2, send: 0.18 }, o)));
    };
    const motif = [['E5', 0], ['G5', 0.5], ['G5', 1], ['A5', 1.5], ['G5', 2], ['E5', 2.5], ['D5', 3]];

    // 1 — the question (C | Am | F G), the music box asks along with the handwriting
    long(0, 2.7, 'pad', N('C3 G3 C4 E4'), 0.45, { attack: 1.2, lp: 1000 });
    long(2.5, 2.7, 'pad', N('A2 E3 A3 C4'), 0.45, { lp: 1000 });
    long(5.0, 1.4, 'pad', N('F2 C3 F3 A3'), 0.45, { lp: 1000 });
    long(6.25, 1.6, 'pad', N('G2 D3 G3 B3'), 0.45, { lp: 1000 });
    [['C2', 0, 1.2], ['A1', 2.5, 1.2], ['F1', 5, 1], ['G1', 6.25, 1]].forEach(([p, t, l]) => ev(t, 'bass', nn(p), 0.5, { len: l }));
    SD.s1.scraps.forEach((sc, i) => ev(sc.t + 0.05, 'paper', 0.22, 0.35, { pan: sc.x < 960 ? -0.5 : 0.5, f: 2000 + i * 300 }));
    ev(TL.s1.card, 'paper', 0.3, 0.4);
    ev(TL.s1.card + 0.3, 'tape', 0.28, 0.35, { pan: -0.3 });
    ev(TL.s1.card + 0.34, 'tape', 0.28, 0.3, { pan: 0.3 });
    motif.forEach(([p, b]) => ev(1.25 + b * BEAT, 'musicBox', nn(p), 0.55));
    ev(TL.s1.qLand - 0.25, 'whoosh', 0.25, 0.3, { f0: 2000, f1: 500 });
    ev(TL.s1.qLand, 'thud', 0.8);
    ev(TL.s1.qLand, 'boing', 110, 0.6, 0.35);
    ev(TL.s1.qTape[0], 'tape', 0.25, 0.35, { pan: 0.4 });
    ev(TL.s1.qTape[1], 'tape', 0.25, 0.3, { pan: 0.5 });
    ev(TL.s1.pipUp, 'pop', 420, 0.6);
    ev(TL.s1.pipUp + 0.05, 'kalimba', nn('G4'), 0.4);
    TL.s1.hmm.forEach((t, i) => { ev(t, 'glock', nn(['G5', 'A5', 'B5'][i]), 0.35); ev(t, 'pop', 900 + i * 120, 0.25); });
    for (let t = TL.s1.scratch[0]; t < TL.s1.scratch[1] - 0.1; t += 0.24) long(t, 0.12, 'scribble', 0.1);
    ev(TL.s1.shrug, 'pluck', nn('D5'), 0.45, { bright: 0.7 });
    ev(TL.s1.shrug + BEAT / 2, 'pluck', nn('G4'), 0.4, { bright: 0.7 });
    for (let k = 0; k < 16; k++) ev(2.5 + (k * BEAT) / 2, 'shaker', k % 2 ? 0.12 : 0.2);

    // 2 — to have more? A bouncy pizzicato walk while the pile grows, then the tumble
    ev(TL.x12[0], 'whoosh', 0.5, 0.45, { f0: 500, f1: 2800, pan: 0.3 });
    ev(TL.x12[0] + 0.25, 'paper', 0.35, 0.3, { pan: 0.4 });
    ev(TL.s2.card, 'paper', 0.25, 0.35);
    ev(TL.s2.card + 0.3, 'tape', 0.25, 0.3);
    const walk = [N('C3 E3 G3 E3'), N('F2 A2 C3 A2')];
    for (let bar = 0; bar < 2; bar++) for (let q = 0; q < 4; q++) {
      const t = 7.5 + bar * BAR + q * BEAT;
      ev(t, 'pluck', walk[bar][q], 0.7, { bright: 0.25, lp: 1500, dur: 1.0, gain: 0.8, len: 0.4 });
      strum(t + BEAT / 2, bar ? N('F3 A3 C4') : N('E3 G3 C4'), 0.28, 1, { len: 0.12, bright: 0.7 });
      if (q % 2) ev(t, 'tick', 0.35, { f: 1150 });
      ev(t + BEAT / 2, 'shaker', 0.15);
    }
    const pops = N('C5 D5 E5 F5 G5 A5 B5 C6 D6');
    TL.s2.land.forEach((t, k) => {
      ev(t - 0.3, 'whoosh', 0.3, 0.15, { f0: 3000, f1: 900 });
      ev(t, 'pop', mtof(pops[k]) * 0.5, 0.5, { pan: ((k % 3) - 1) * 0.2 });
      ev(t, 'glock', pops[k], 0.28);
      ev(t, 'thud', 0.2 + k * 0.03);
    });
    ev(12.2, 'boing', 260, 0.35, 0.3);
    ev(TL.s2.topple, 'slide', 0.6, 1500, 250, 0.4);
    for (let k = 0; k < 9; k++) ev(12.95 + R() * 0.4, 'tick', 0.3 + R() * 0.3, { f: 400 + R() * 1200, pan: R() - 0.5 });
    ev(12.95, 'thud', 0.8);
    ev(12.95, 'paper', 0.5, 0.45);
    ev(TL.s2.flat, 'pop', 180, 0.5);
    ev(TL.s2.pop, 'boing', 170, 0.7, 0.45);
    ev(TL.s2.pop + 0.3, 'chirp', 0.14, { n: 3, pan: -0.3 });
    ev(TL.s2.crown, 'glock', nn('E6'), 0.4);
    ev(TL.s2.crown + 0.12, 'glock', nn('C6'), 0.3);
    long(TL.s2.scribble[0], TL.s2.scribble[1] - TL.s2.scribble[0], 'scribble', 0.45);
    ev(14.6, 'bass', nn('G2'), 0.5, { len: 0.25 });
    ev(14.6 + BEAT / 2, 'bass', nn('C2'), 0.55, { len: 0.4 });

    // 3 — written in the stars? Dreamy pads and celesta; the stars answer with a question
    ev(TL.x23[0], 'whoosh', 0.6, 0.35, { f0: 1800, f1: 350 });
    long(15.0, 2.7, 'pad', N('F2 C3 A3 E4'), 0.5, { attack: 0.9, lp: 900 });
    long(17.5, 2.7, 'pad', N('E2 B2 G3 D4'), 0.5, { lp: 900 });
    long(20.0, 1.35, 'pad', N('D2 A2 F3 C4'), 0.5, { lp: 900 });
    long(21.25, 1.5, 'pad', N('G2 D3 B3 F4'), 0.5, { lp: 1000 });
    [['F1', 15, 2], ['E1', 17.5, 2], ['D2', 20, 1.1], ['G1', 21.25, 1.1]].forEach(([p, t, l]) => ev(t, 'bass', nn(p), 0.4, { len: l }));
    [N('F4 A4 C5 E5 C5 A4 F4 A4'), N('E4 G4 B4 D5 B4 G4 E4 G4'), N('D4 F4 A4 C5 B4 G4 D4 F4')].forEach((a, bar) =>
      a.forEach((m, k) => ev(15 + bar * BAR + (k * BEAT) / 2, 'musicBox', m + 12, k % 2 ? 0.16 : 0.24, { pan: ((k % 4) - 1.5) * 0.3, decay: 0.8 })));
    const twn = N('C6 E6 G6 A6 D6 G6 E6 C7');
    TL.s3.tw.forEach(([t, idx], k) => ev(t, 'glock', twn[k], 0.3, { pan: (SD.s3.stars[idx].x / 960 - 1) * 0.8 }));
    N('C4 D4 E4 G4 A4 C5 D5 E5 G5 A5 C6 D6').forEach((m, k) => ev(TL.s3.form[0] + k * 0.055, 'pluck', m, 0.3, { bright: 0.8, send: 0.4, dur: 1.2 }));
    ev(TL.s3.form[0], 'whoosh', 0.9, 0.2, { f0: 600, f1: 3000 });
    long(TL.s3.lines[0], TL.s3.lines[1] - TL.s3.lines[0], 'scribble', 0.16);
    ev(TL.s3.boing, 'boing', 200, 0.8, 0.4);
    ev(TL.s3.look, 'pop', 1000, 0.45);
    ev(TL.s3.look, 'glock', nn('E6'), 0.3);
    N('C7 A6 G6 E6 D6 C6 A5 G5 E5 D5 C5').forEach((m, k) => ev(TL.s3.fall[0] + k * 0.07, 'glock', m, 0.3 - k * 0.015, { pan: 0.6 - k * 0.12 }));
    ev(TL.s3.fall[0], 'whoosh', 0.8, 0.4, { f0: 3000, f1: 500, pan: -0.2 });
    ev(TL.s3.fall[1], 'musicBox', nn('C5'), 0.5);
    ev(TL.s3.fall[1], 'glock', nn('C6'), 0.35);
    ev(TL.s3.fall[1] + 0.05, 'glock', nn('G6'), 0.25);
    N('C6 E6 G6 C7 E7').forEach((m, k) => ev(TL.s3.glow + 0.1 + k * 0.12, 'glock', m, 0.14 + k * 0.02));

    // 4 — maybe it starts small: kalimba and ukulele, a harp run as the flower grows
    ev(TL.x34[0], 'tear', 0.7, 0.55);
    ev(22.95, 'chirp', 0.18, { n: 3, pan: 0.5 });
    ev(24.35, 'chirp', 0.14, { n: 2, pan: -0.4 });
    ev(28.9, 'chirp', 0.16, { n: 3, pan: 0.3 });
    long(22.5, 2.7, 'pad', N('C3 G3 C4 E4'), 0.38, { lp: 1300 });
    long(25.0, 1.35, 'pad', N('B2 G3 B3 D4'), 0.38, { lp: 1300 });
    long(26.25, 1.35, 'pad', N('A2 E3 A3 C4'), 0.38, { lp: 1300 });
    long(27.5, 1.35, 'pad', N('F2 C3 A3 C4'), 0.45, { lp: 1600 });
    long(28.75, 1.5, 'pad', N('G2 D3 B3 D4'), 0.45, { lp: 1600 });
    [['C2', 22.5], ['B1', 25], ['A1', 26.25], ['F1', 27.5], ['G1', 28.75]].forEach(([p, t]) => ev(t, 'bass', nn(p), 0.42, { len: 1.1 }));
    [N('C4 G4 E4 G4 C4 G4 E4 G4'), N('B3 G4 D4 G4 A3 E4 C4 E4'), N('F3 C4 A3 C4 G3 D4 B3 D4')].forEach((a, bar) =>
      a.forEach((m, k) => ev(22.5 + bar * BAR + (k * BEAT) / 2, 'pluck', m, k % 2 ? 0.22 : 0.3, { bright: 0.45, dur: 1.0, pan: -0.2 })));
    [['G4', 0.5], ['C5', 1], ['E5', 1.5], ['D5', 2], ['C5', 3], ['E5', 8.5], ['F5', 9], ['A5', 9.5], ['G5', 10.5], ['D5', 11], ['B4', 11.5]]
      .forEach(([p, b]) => ev(22.5 + b * BEAT, 'kalimba', nn(p), 0.42, { pan: 0.25 }));
    ev(TL.s4.walk[0], 'step', 0.2);
    ev(TL.s4.walk[0] + 0.2, 'step', 0.2);
    ev(TL.s4.plant, 'pop', 520, 0.35);
    TL.s4.pats.forEach((t) => ev(t, 'step', 0.35));
    ev(TL.s4.can, 'pop', 780, 0.4);
    TL.s4.drops.forEach((t, i) => ev(t + 0.28, 'plip', 1300 + i * 110, 0.4, { pan: -0.2 }));
    N('C4 E4 G4 C5 D5 E5 G5 A5 C6 D6 E6').forEach((m, k) => ev(TL.s4.grow[0] + k * 0.17, 'pluck', m, 0.28, { bright: 0.75, send: 0.35 }));
    TL.s4.leaves.forEach((t, i) => { ev(t, 'pop', 600 + i * 150, 0.35); ev(t, 'kalimba', nn(['E5', 'G5', 'C6'][i]), 0.35); });
    for (const p of ['F5', 'A5', 'C6']) ev(TL.s4.bloom, 'glock', nn(p), 0.36);
    for (let i = 0; i < 10; i++) ev(TL.s4.bloom + i * 0.035, 'pop', 800 + i * 90, 0.16, { pan: i / 9 - 0.5 });
    ev(TL.s4.bloom, 'musicBox', nn('F5'), 0.4);
    TL.s4.hop.forEach((t) => ev(t, 'boing', 300, 0.35, 0.25));

    // 5 — ...and in each other: rain and a lonely whistle, then warmth under the leaf, then a rainbow
    ev(29.9, 'whoosh', 1.0, 0.3, { f0: 250, f1: 700, pan: 0.5 });
    ev(30.15, 'thud', 0.22);
    long(TL.s5.rain[0], TL.s5.rain[1] - TL.s5.rain[0], 'rain', 0.3);
    long(30.0, 1.35, 'pad', N('A2 E3 A3 C4'), 0.42, { lp: 800 });
    long(31.25, 1.35, 'pad', N('E2 B2 G3 B3'), 0.42, { lp: 800 });
    ev(30.0, 'bass', nn('A1'), 0.4, { len: 1.1 });
    ev(31.25, 'bass', nn('E2'), 0.4, { len: 1.1 });
    [['A4', 0, 0.55], ['C5', 1, 0.28], ['B4', 1.5, 0.28], ['G4', 2, 0.9], ['E4', 3.5, 0.55]].forEach(([p, b, d]) => long(30 + b * BEAT, d, 'whistle', nn(p), 0.5));
    const stepDt = (TL.s5.walk[1] - TL.s5.walk[0]) / 6.4;
    for (let t = TL.s5.walk[0]; t < TL.s5.walk[1]; t += stepDt) ev(t, 'step', 0.3, { pan: (t - 31.5) * 0.4 });
    N('G4 C5 E5 G5 C6').forEach((m, k) => ev(TL.s5.leaf[0] + k * 0.08, 'kalimba', m, 0.4));
    ev(TL.s5.leaf[0], 'whoosh', 0.55, 0.3, { f0: 300, f1: 1800 });
    ev(TL.s5.leaf[0] + 0.45, 'paper', 0.3, 0.35);
    long(32.5, 1.35, 'pad', N('F2 C3 A3 C4 F4'), 0.5, { lp: 1400 });
    long(33.75, 1.35, 'pad', N('G2 D3 B3 D4'), 0.5, { lp: 1400 });
    ev(32.5, 'bass', nn('F1'), 0.45, { len: 1.1 });
    ev(33.75, 'bass', nn('G1'), 0.45, { len: 1.1 });
    ev(TL.s5.lookUp, 'pop', 900, 0.3);
    ev(TL.s5.smile, 'glock', nn('E6'), 0.3);
    ev(TL.s5.smile + 0.1, 'glock', nn('G6'), 0.25);
    ev(TL.s5.stand[0] + 0.3, 'step', 0.3);
    [N('F3 C4 A3 C4 G3 D4 B3 D4'), N('C4 G4 E4 G4 F3 C4 G3 D4')].forEach((a, bar) =>
      a.forEach((m, k) => ev(32.5 + bar * BAR + (k * BEAT) / 2, 'pluck', m, k % 2 ? 0.2 : 0.27, { bright: 0.5, dur: 1.0, pan: -0.2 })));
    N('C5 D5 E5 G5 A5 C6 D6 E6 G6 A6 C7').forEach((m, k) => ev(TL.s5.rainbow[0] + k * 0.09, 'glock', m, 0.22, { pan: -0.6 + k * 0.12 }));
    ev(TL.s5.heart, 'pop', 700, 0.5);
    ev(TL.s5.heart, 'glock', nn('C6'), 0.35);
    ev(TL.s5.heart + 0.08, 'glock', nn('G6'), 0.3);
    TL.s5.hops.forEach((t) => ev(t, 'pop', 500, 0.3));
    long(35.0, 1.35, 'pad', N('C3 G3 C4 E4'), 0.5, { lp: 1800 });
    long(36.25, 0.65, 'pad', N('F2 C3 A3 C4'), 0.5, { lp: 1800 });
    long(36.875, 0.7, 'pad', N('G2 D3 B3 F4'), 0.5, { lp: 1800 });
    [['C2', 35, 1.1], ['F1', 36.25, 0.55], ['G1', 36.875, 0.55]].forEach(([p, t, l]) => ev(t, 'bass', nn(p), 0.45, { len: l }));
    long(TL.s5.riser[0], TL.s5.riser[1] - TL.s5.riser[0], 'riser', 0.35);
    for (let k = 0; k < 8; k++) ev(36.875 + (k * BEAT) / 8, 'tick', 0.15 + k * 0.03, { f: 1400 });

    // 6 — the montage: a happy strumming groove, one card every two beats
    ev(TL.x56[0], 'whoosh', 0.35, 0.35, { f0: 600, f1: 2600 });
    ev(37.5, 'kick', 0.6);
    strum(37.5, N('C4 E4 G4 C5 E5'), 0.5);
    ev(37.5, 'glock', nn('C6'), 0.35);
    ev(37.5, 'glock', nn('G6'), 0.25);
    const chords = [N('C4 E4 G4 C5'), N('F3 A3 C4 F4'), N('G3 B3 D4 G4'), N('A3 C4 E4 A4'), N('F3 A3 C4 F4'), N('G3 B3 D4 G4')];
    const roots = N('C2 F2 G2 A2 F2 G2'), fifths = N('G2 C3 D3 E3 C3 D3');
    const mel = [N('E5 G5 C6 G5'), N('A5 C6 A5 F5'), N('G5 B5 D6 B5'), N('C6 B5 A5 E5'), N('F5 A5 C6 D6'), N('D6 C6 B5 G5')];
    for (let k = 0; k < 6; k++) {
      const T = TL.s6.t0 + k * TL.s6.len;
      [[0, 1], [0.5, -1], [1, 1], [1.5, -1]].forEach(([b, dir]) => strum(T + b * BEAT, chords[k], b === 0 ? 0.34 : 0.22, dir, { len: 0.28 }));
      ev(T, 'bass', roots[k], 0.55, { len: 0.5 });
      ev(T + BEAT, 'bass', fifths[k], 0.45, { len: 0.45 });
      if (k > 0) ev(T, 'kick', 0.45);
      ev(T + BEAT, 'clap', 0.45);
      for (let j = 0; j < 4; j++) ev(T + (j * BEAT) / 2 + BEAT / 4, 'shaker', 0.14);
      mel[k].forEach((m, j) => ev(T + (j * BEAT) / 2, 'glock', m, 0.3, { pan: 0.2 }));
      if (k > 0) ev(T - 0.1, 'flip', 0.35);
      SD.s6.words[k].tiles.forEach((_, i) => ev(T + 0.02 + i * 0.06, 'pop', 520 + i * 70, 0.26, { pan: (i - 2) * 0.15 }));
    }

    // 7 — finale: the question once more, answered as the two question marks become a heart
    ev(TL.x67[0], 'tear', 0.5, 0.5);
    for (let i = 0; i < 6; i++) ev(TL.s7.words + i * 0.06 + 0.1, 'paper', 0.18, 0.25, { pan: i % 2 ? 0.6 : -0.6 });
    long(45.0, 2.7, 'pad', N('F2 C3 A3 C4'), 0.45, { lp: 1200, attack: 0.3 });
    long(47.5, 2.7, 'pad', N('G2 D3 B3 D4'), 0.45, { lp: 1300 });
    long(50.0, 1.35, 'pad', N('A2 E3 A3 C4'), 0.45, { lp: 1300 });
    long(51.25, 1.35, 'pad', N('F2 C3 A3 C4'), 0.45, { lp: 1300 });
    long(52.5, 5.0, 'pad', N('C3 G3 C4 E4 G4'), 0.55, { lp: 1700, release: 3 });
    [['F1', 45, 2], ['G1', 47.5, 2], ['A1', 50, 1.1], ['F1', 51.25, 1.1], ['C2', 52.5, 3]].forEach(([p, t, l]) => ev(t, 'bass', nn(p), 0.45, { len: l }));
    for (const [tq, pan, f] of [[TL.s7.q1, 0.4, 120], [TL.s7.q2, -0.4, 140]]) {
      ev(tq - 0.25, 'whoosh', 0.25, 0.25, { f0: 2000, f1: 500, pan });
      ev(tq, 'thud', 0.7);
      ev(tq, 'boing', f, 0.5, 0.3);
    }
    N('E5 G5 G5 A5 G5 E5 D5 C5').forEach((m, k) => ev(45.9375 + (k * BEAT) / 2, 'musicBox', m, k === 7 ? 0.6 : 0.45));
    ev(TL.s7.slide[0], 'whoosh', 0.9, 0.22, { f0: 400, f1: 1500 });
    ev(TL.s7.heart, 'pop', 600, 0.5);
    for (const p of ['C6', 'E6', 'G6']) ev(TL.s7.heart, 'glock', nn(p), 0.32);
    N('C6 E6 G6 C7').forEach((m, k) => ev(TL.s7.heart + 0.12 + k * 0.08, 'glock', m, 0.18));
    [N('G3 D4 B3 D4 G3 D4 B3 D4'), N('A3 E4 C4 E4 F3 C4 A3 C4')].forEach((a, bar) =>
      a.forEach((m, k) => ev(47.5 + bar * BAR + (k * BEAT) / 2, 'pluck', m, k % 2 ? 0.18 : 0.24, { bright: 0.45, dur: 1.1, pan: -0.15 })));
    [['G5', 48.75], ['E5', 49.375], ['A5', 50.0], ['G5', 50.625], ['F5', 51.25], ['E5', 51.875]].forEach(([p, t]) => ev(t, 'musicBox', nn(p), 0.38));
    strum(TL.s7.final, N('C3 G3 C4 E4 G4 C5'), 0.45, 1, { dur: 2.5, bright: 0.5 });
    N('C5 E5 G5 C6').forEach((m, k) => ev(TL.s7.final + k * 0.16, 'musicBox', m, 0.45, { decay: 1.6 }));
    ev(TL.s7.final, 'kick', 0.4);
    ev(TL.s7.final, 'glock', nn('C7'), 0.2);
    for (let i = 0; i < 12; i++) ev(TL.s7.final + 0.05 + R() * 1.4, 'paper', 0.08, 0.12, { pan: R() * 2 - 1, f: 3000 + R() * 2000 });
    ev(TL.s7.stamp, 'stamp', 0.7);
    ev(53.9, 'musicBox', nn('G5'), 0.25, { decay: 1.8 });
    ev(54.2, 'musicBox', nn('C6'), 0.3, { decay: 2.2 });

    // every handwritten stroke gets a little felt-tip squeak
    for (const w of WRITES) {
      const d = w.t1 - w.t0;
      for (const [a, b] of w.hand.times()) ev(w.t0 + a * d, 'pen', Math.max(0.02, (b - a) * d), 0.2);
    }
    return S.sort((a, b) => a.t - b.t);
  }

  // ------------------------------------------------------------ graph, scheduling, transport

  function setup(c) {
    ctx = c;
    noiseBuf = makeNoise(2);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    master = gain(muted ? 0 : LEVEL);
    master.connect(comp);
    comp.connect(ctx.destination);
    const verb = ctx.createConvolver();
    verb.buffer = makeIR(2.8, 2.6);
    verbIn = gain(1);
    chain(verbIn, verb, filt('lowpass', 5200), gain(0.32), master);
    dry = null;
    newBus();
  }

  function newBus() {
    if (dry) {
      const od = dry, ow = wet, now = ctx.currentTime;
      od.gain.setTargetAtTime(0, now, 0.02);
      ow.gain.setTargetAtTime(0, now, 0.02);
      setTimeout(() => { od.disconnect(); ow.disconnect(); }, 500);
    }
    dry = gain(1);
    wet = gain(1);
    dry.connect(master);
    wet.connect(verbIn);
  }

  function fire(e, when, off = 0) {
    try {
      if (e.dur) I[e.fn](when, e.dur - off, off, ...e.args);
      else I[e.fn](when, ...e.args);
    } catch (err) {
      console.error('sound event failed', e.fn, err);
    }
  }

  function pump() {
    if (!ok || !playing) return;
    const film = ctx.currentTime - t0, horizon = film + 0.3;
    while (cursor < score.length && score[cursor].t < horizon) {
      const e = score[cursor++];
      if (e.t < film - 0.08) continue;
      fire(e, Math.max(t0 + e.t, ctx.currentTime + 0.005));
    }
  }

  function latency() {
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  }

  return {
    get ok() { return ok; },
    init() {
      if (ctx) return ok;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        setup(new AC({ latencyHint: 'playback' }));
        score = buildScore();
        // render every plucked-string pitch up front so playback never stalls on it
        for (const e of score) if (e.fn === 'pluck') { const o = e.args[2] || {}; ks(e.args[0], o.bright === undefined ? 0.5 : o.bright, o.dur || 1.5); }
        ok = true;
      } catch (err) {
        console.warn('Web Audio unavailable, playing silently', err);
        ok = false;
      }
      return ok;
    },
    play(film) {
      if (!ok) return;
      if (ctx.state !== 'running') ctx.resume();
      playing = true;
      newBus();
      t0 = ctx.currentTime + 0.06 - film;
      cursor = 0;
      while (cursor < score.length && score[cursor].t < film) cursor++;
      for (const e of score) if (e.dur && e.t < film && e.t + e.dur > film + 0.25) fire(e, ctx.currentTime + 0.06, film - e.t);
      pump();
    },
    stop() {
      if (!ok) return;
      playing = false;
      newBus();
    },
    // stop scheduling but let whatever is sounding ring out (the final chord)
    release() {
      playing = false;
    },
    now() {
      return ctx.currentTime - t0 - latency();
    },
    running() {
      return ok && ctx.state === 'running';
    },
    pump,
    setMuted(m) {
      muted = m;
      if (master) master.gain.setTargetAtTime(m ? 0 : LEVEL, ctx.currentTime, 0.03);
    },
    // offline render of the whole score, for level checks: RMS / peak per second
    async analyze(only = null) {
      if (!score.length) return null;
      const sr = 44100, len = Math.ceil(sr * (END + 3));
      const saved = [ctx, master, verbIn, dry, wet, noiseBuf];
      const off = new OfflineAudioContext(2, len, sr);
      setup(off);
      for (const e of score) if (!only || only.includes(e.fn)) fire(e, e.t + 0.01, 0);
      const buf = await off.startRendering();
      [ctx, master, verbIn, dry, wet, noiseBuf] = saved;
      const L = buf.getChannelData(0), Rr = buf.getChannelData(1), rms = [], peaks = [];
      for (let s = 0; s + sr <= len; s += sr) {
        let acc = 0, pk = 0;
        for (let i = s; i < s + sr; i++) {
          acc += L[i] * L[i] + Rr[i] * Rr[i];
          pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i]));
        }
        rms.push(+Math.sqrt(acc / (2 * sr)).toFixed(3));
        peaks.push(+pk.toFixed(3));
      }
      return { events: score.length, rms, peaks, maxPeak: Math.max(...peaks) };
    },
  };
})();

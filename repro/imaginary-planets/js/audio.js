// Every sound in the atlas is synthesized live with the Web Audio API — there are no audio files.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);

function makeScape(E, build) {
  const ctx = E.ctx;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(E.bus);
  out.gain.setTargetAtTime(1, ctx.currentTime, 1.1);
  const nodes = [];
  const timers = new Set();
  let alive = true;
  const h = {
    ctx, out,
    osc(type, freq, dest, gain = 1, detune = 0) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = freq; o.detune.value = detune;
      const g = ctx.createGain(); g.gain.value = gain;
      o.connect(g); g.connect(dest || out); o.start();
      nodes.push(o);
      return { o, g };
    },
    noise(kind, dest, gain = 1) {
      const s = ctx.createBufferSource();
      s.buffer = E.noise[kind]; s.loop = true;
      const g = ctx.createGain(); g.gain.value = gain;
      s.connect(g); g.connect(dest || out); s.start(0, Math.random() * 3);
      nodes.push(s);
      return { s, g };
    },
    filter(type, freq, q = 0.7, dest) {
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      f.connect(dest || out);
      return f;
    },
    gain(v, dest) { const g = ctx.createGain(); g.gain.value = v; g.connect(dest || out); return g; },
    lfo(freq, depth, param, type = 'sine') {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = depth;
      o.connect(g); g.connect(param); o.start();
      nodes.push(o);
      return o;
    },
    delay(time, feedback, dest) {
      const d = ctx.createDelay(2); d.delayTime.value = time;
      const fb = ctx.createGain(); fb.gain.value = feedback;
      d.connect(fb); fb.connect(d); d.connect(dest || out);
      return d;
    },
    every(minS, maxS, fn, firstDelay) {
      const loop = () => {
        if (!alive) return;
        try { fn(ctx.currentTime + 0.05); } catch (e) { /* a missed note is harmless */ }
        const id = setTimeout(() => { timers.delete(id); loop(); }, rand(minS, maxS) * 1000);
        timers.add(id);
      };
      const id = setTimeout(() => { timers.delete(id); loop(); }, (firstDelay ?? rand(0, maxS * 0.5)) * 1000);
      timers.add(id);
    },
    tone({ type = 'sine', freq, t, attack = 0.01, decay = 1.5, gain = 0.1, dest, glideTo, detune = 0 }) {
      const o = ctx.createOscillator();
      o.type = type; o.detune.value = detune;
      o.frequency.setValueAtTime(freq, t);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + attack + decay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
      o.connect(g); g.connect(dest || out);
      o.start(t); o.stop(t + attack + decay + 0.05);
    },
    burst({ kind = 'white', t, dur = 0.1, gain = 0.1, type = 'highpass', freq = 2000, q = 0.7, dest, attack = 0.004 }) {
      const s = ctx.createBufferSource();
      s.buffer = E.noise[kind];
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
      s.connect(f); f.connect(g); g.connect(dest || out);
      s.start(t, Math.random() * 2); s.stop(t + attack + dur + 0.05);
      return f;
    },
    stop(fade = 1.8) {
      alive = false;
      timers.forEach(clearTimeout); timers.clear();
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => {
        nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } });
        out.disconnect();
      }, fade * 1000 + 250);
    },
  };
  build(h);
  return h;
}

const SCAPES = {
  // The Vesper system: a slow, breathing pad with distant chimes.
  space(h) {
    const lp = h.filter('lowpass', 480, 0.9);
    [55, 82.41, 110, 164.81].forEach((f, i) => {
      h.osc('sawtooth', f, lp, 0.045, (i % 2 ? 1 : -1) * 7);
      h.osc('sine', f * 2, lp, 0.03, 4 * i);
    });
    h.lfo(0.045, 260, lp.frequency);
    const scale = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77];
    h.every(2.5, 6.5, (t) => h.tone({ freq: pick(scale), t, attack: 0.02, decay: 4, gain: 0.03 }));
  },
  // Vitrea: glass rain, a wineglass drone and scattered crystal bells.
  glass(h) {
    const bp = h.filter('bandpass', 1800, 0.6);
    h.noise('pink', bp, 0.09);
    h.lfo(0.07, 800, bp.frequency);
    const drone = h.osc('sine', 1318.5, null, 0.014);
    h.lfo(5, 3, drone.o.frequency);
    h.osc('sine', 1975.5, null, 0.007);
    const notes = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349.3, 2637];
    h.every(0.12, 0.7, (t) => {
      const f = pick(notes), g = rand(0.012, 0.045), d = rand(1.4, 3.6);
      h.tone({ freq: f, t, attack: 0.003, decay: d, gain: g });
      h.tone({ freq: f * 2.76, t, attack: 0.002, decay: d * 0.5, gain: g * 0.35 });
    });
  },
  // Kintsugi: magma rumble, crackle, and the Mender's Vent heartbeat.
  forge(h) {
    const lp = h.filter('lowpass', 110, 0.8);
    const r = h.noise('brown', lp, 0.9);
    h.lfo(0.09, 0.35, r.g.gain);
    h.every(3.2, 3.2, (t) => {
      h.tone({ freq: 62, glideTo: 38, t, attack: 0.01, decay: 0.4, gain: 0.3 });
      h.tone({ freq: 55, glideTo: 36, t: t + 0.3, attack: 0.01, decay: 0.35, gain: 0.18 });
    }, 1.0);
    h.every(0.05, 0.45, (t) => h.burst({ t, dur: rand(0.008, 0.04), gain: rand(0.01, 0.05), freq: rand(2500, 6000) }));
    h.every(4, 9, (t) => {
      const f = pick([196, 220, 261.63]);
      [1, 2.76, 5.4, 8.93].forEach((m, i) => h.tone({ freq: f * m, t, attack: 0.002, decay: 3.2 / (i + 1), gain: 0.03 / (i + 1) }));
    });
  },
  // Hespera: a warm open fifth, wind whistling along the terminator, far-off birds.
  dusk(h) {
    const lp = h.filter('lowpass', 900, 0.7);
    h.osc('triangle', 73.42, lp, 0.07, -5);
    h.osc('triangle', 110, lp, 0.05, 5);
    h.osc('sine', 146.83, lp, 0.03);
    const bp = h.filter('bandpass', 700, 9);
    h.noise('pink', bp, 0.5);
    h.lfo(0.04, 320, bp.frequency);
    h.every(3, 8, (t) => {
      const n = 2 + Math.floor(Math.random() * 3), base = rand(2300, 3000);
      for (let i = 0; i < n; i++) h.tone({ freq: base, glideTo: base * 1.3, t: t + i * 0.13, attack: 0.01, decay: 0.08, gain: 0.018 });
    });
  },
  // Halcyon: swells of surf, a gentle major-seventh pad and whale song.
  ocean(h) {
    const lp = h.filter('lowpass', 500, 0.5);
    const surf = h.noise('pink', lp, 0.0001);
    h.every(6, 10, (t) => {
      const g = surf.g.gain, f = lp.frequency;
      g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0.0001), t);
      g.linearRampToValueAtTime(rand(0.28, 0.45), t + 2.4);
      g.linearRampToValueAtTime(0.03, t + 7);
      f.cancelScheduledValues(t); f.setValueAtTime(f.value, t);
      f.linearRampToValueAtTime(rand(1300, 1900), t + 2.6);
      f.linearRampToValueAtTime(420, t + 7);
    }, 0.1);
    const pad = h.filter('lowpass', 1200, 0.6);
    [130.81, 164.81, 196, 246.94].forEach((f, i) => h.osc('sine', f, pad, 0.024, i * 3));
    h.every(9, 16, (t) => {
      const bp = h.filter('bandpass', 400, 2);
      h.tone({ freq: rand(200, 240), glideTo: rand(130, 160), t, attack: 0.6, decay: 2.4, gain: 0.05, dest: bp, type: 'triangle' });
    });
  },
  // Ouroboros: an endlessly rising Shepard tone — a sound that eats its own tail.
  loop(h) {
    const ctx = h.ctx;
    const g = h.gain(0.9);
    const voices = [];
    for (let k = 0; k < 8; k++) voices.push(h.osc('sine', 40, g, 0));
    const pad = h.filter('lowpass', 700, 0.7);
    [82.41, 123.47, 164.81].forEach((f) => h.osc('sine', f, pad, 0.02));
    let phase = 0;
    h.every(0.08, 0.08, () => {
      phase = (phase + 0.08 * 0.035) % 1;
      const t = ctx.currentTime;
      voices.forEach((v, k) => {
        const pos = (k + phase) % 8;
        const f = 40 * Math.pow(2, pos);
        const bell = Math.exp(-Math.pow((pos - 4) / 1.6, 2));
        v.o.frequency.setTargetAtTime(f, t, 0.03);
        v.g.gain.setTargetAtTime(0.032 * bell, t, 0.05);
      });
    }, 0);
  },
  // Aurelia: a sub-bass drone and storm roar with rolling lightning.
  gas(h) {
    const lp = h.filter('lowpass', 170, 0.9);
    [-7, 0, 7].forEach((d) => h.osc('sawtooth', 36.71, lp, 0.09, d));
    const bp = h.filter('bandpass', 260, 0.8);
    const roar = h.noise('brown', bp, 0.7);
    h.lfo(0.08, 0.35, roar.g.gain);
    h.every(5, 12, (t) => {
      h.burst({ kind: 'brown', t, dur: 1.6, gain: 0.5, type: 'lowpass', freq: 320, attack: 0.02 });
      h.burst({ kind: 'white', t, dur: 0.18, gain: 0.05, type: 'highpass', freq: 1800 });
    });
  },
  // Noctiluca: a soft pentatonic arpeggio in a feedback delay, and chirping night life.
  bio(h) {
    const echo = h.delay(0.42, 0.45);
    const notes = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    let i = 0;
    const pattern = [0, 2, 4, 3, 1, 4, 5, 2];
    h.every(0.3, 0.3, (t) => {
      const f = notes[pattern[i++ % pattern.length] + (Math.random() < 0.15 ? 1 : 0)];
      h.tone({ freq: f, t, attack: 0.005, decay: 0.7, gain: 0.03, dest: echo });
      h.tone({ freq: f, t, attack: 0.005, decay: 0.5, gain: 0.02, type: 'triangle' });
    }, 0.2);
    h.every(1, 4, (t) => {
      for (let k = 0; k < 4; k++) h.tone({ freq: rand(4000, 4800), t: t + k * 0.05, attack: 0.004, decay: 0.03, gain: 0.012 });
    });
    const pad = h.filter('lowpass', 600, 0.6);
    h.osc('sine', 110, pad, 0.03);
    h.osc('sine', 164.81, pad, 0.02);
  },
  // Borealis: polar wind, the 43 Hz hum of the ice, creaks and auroral shimmer.
  ice(h) {
    const bp = h.filter('bandpass', 900, 0.8);
    h.noise('white', bp, 0.12);
    h.lfo(0.03, 700, bp.frequency);
    h.osc('sine', 43, null, 0.14);
    h.osc('sine', 43.4, null, 0.08);
    h.osc('sine', 86, null, 0.03);
    h.every(3, 7, (t) => {
      const lp = h.filter('lowpass', 600, 2);
      h.tone({ type: 'sawtooth', freq: rand(80, 110), glideTo: rand(50, 65), t, attack: 0.02, decay: 0.3, gain: 0.05, dest: lp });
    });
    const sh = h.gain(1);
    [2093, 2637, 3136].forEach((f, i) => { const v = h.osc('sine', f, sh, 0.006); h.lfo(0.2 + i * 0.13, 0.005, v.g.gain); });
  },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.scape = null;
    this.scapeName = null;
    this.wanted = 'space';
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.4, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.reverb.connect(wet);
    wet.connect(this.master);
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.bus.connect(this.reverb);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.6;
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(this.reverb);
    this.noise = { white: this.makeNoise('white'), pink: this.makeNoise('pink'), brown: this.makeNoise('brown') };
    return true;
  }

  impulse(seconds, decay) {
    const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  makeNoise(kind) {
    const ctx = this.ctx, len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  setEnabled(on) {
    if (!this.init()) return;
    this.on = on;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, t, on ? 0.5 : 0.12);
    if (on) {
      const w = this.wanted;
      this.scapeName = null;
      this.play(w);
    } else if (this.scape) {
      const s = this.scape;
      this.scape = null;
      this.scapeName = null;
      s.stop(0.6);
    }
  }

  play(name) {
    this.wanted = name;
    if (!this.ctx || !this.on || this.scapeName === name) return;
    if (this.scape) this.scape.stop(2.2);
    this.scapeName = name;
    this.scape = SCAPES[name] ? makeScape(this, SCAPES[name]) : null;
  }

  sfx(kind) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01;
    const env = (g, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    if (kind === 'hover' || kind === 'click') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = kind === 'hover' ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(kind === 'hover' ? 1320 : 660, t);
      if (kind === 'click') o.frequency.exponentialRampToValueAtTime(440, t + 0.12);
      env(g, kind === 'hover' ? 0.018 : 0.07, 0.005, kind === 'hover' ? 0.06 : 0.14);
      o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 0.3);
    } else if (kind === 'whoosh') {
      const s = ctx.createBufferSource(); s.buffer = this.noise.pink;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(260, t);
      f.frequency.exponentialRampToValueAtTime(2400, t + 0.9);
      f.frequency.exponentialRampToValueAtTime(380, t + 2.0);
      const g = ctx.createGain(); env(g, 0.22, 0.8, 1.3);
      s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + 2.3);
    } else if (kind === 'chime') {
      [660, 990, 1320].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.05, t + i * 0.09 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 1.4);
        o.connect(g); g.connect(this.sfxBus); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1.5);
      });
    }
  }
}

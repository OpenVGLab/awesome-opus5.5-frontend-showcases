import { TAU, wrap01 } from './util.js';
import { stageIndexAt } from './timeline.js';

// A soundscape synthesised live with Web Audio. It reads the same loop phase as the picture,
// so it loops with it: surf follows the swell, rain and wind follow the storm, thunder follows
// each lightning bolt and a soft chord marks every stage.
const CHORDS = [
  [174.61, 220.0, 261.63, 329.63, 392.0],
  [196.0, 246.94, 293.66, 329.63, 440.0],
  [220.0, 261.63, 329.63, 392.0, 493.88],
  [130.81, 196.0, 246.94, 329.63, 392.0],
];
const BIRDS = [0.035, 0.08, 0.14, 0.19, 0.9, 0.955];

function noiseBuffer(ctx, seconds, kind) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
      } else d[i] = w * 0.5;
    }
  }
  return buf;
}

export function createAudio() {
  let ctx = null, n = null, on = false, lastStage = -1, lastBolt = -1, lastP = 0;

  function loop(buf, ...chain) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    let node = src;
    for (const c of chain) node = node.connect(c);
    src.start();
    return src;
  }
  const filter = (type, freq, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = gain(0);
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    const brown = noiseBuffer(ctx, 5, 'brown'), pink = noiseBuffer(ctx, 5, 'pink'), white = noiseBuffer(ctx, 3, 'white');
    const surf = gain(), surfLP = filter('lowpass', 500);
    loop(brown, surfLP, surf, master);
    const wind = gain(), windBP = filter('bandpass', 500, 0.9);
    loop(pink, windBP, wind, master);
    const rain = gain();
    loop(white, filter('highpass', 1300), filter('lowpass', 7500), rain, master);
    const creek = gain();
    loop(pink, filter('bandpass', 2200, 1.4), creek, master);
    const pad = gain(1);
    pad.connect(filter('lowpass', 1600)).connect(master);
    n = { master, surf, surfLP, wind, windBP, rain, creek, pad, brown };
  }

  function chord(i) {
    const t = ctx.currentTime;
    for (const f of CHORDS[i]) {
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        const g = gain(0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.014, t + 2.2);
        g.gain.setTargetAtTime(0, t + 6.5, 1.5);
        o.connect(g).connect(n.pad);
        o.start(t);
        o.stop(t + 14);
      }
    }
  }

  function thunder(delay) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = n.brown;
    const lp = filter('lowpass', 900);
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(80, t + 3.5);
    const g = gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1.1, t + 0.05);
    g.gain.setTargetAtTime(0, t + 0.35, 1.2);
    src.connect(lp).connect(g).connect(n.master);
    src.start(t, Math.random() * 3);
    src.stop(t + 6);
  }

  function bird() {
    const t0 = ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * 0.13;
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f = 2600 + Math.random() * 1400;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.07);
      const g = gain(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g).connect(n.master);
      o.start(t);
      o.stop(t + 0.12);
    }
  }

  function setEnabled(v) {
    if (v && !ctx) init();
    on = v;
    if (!ctx) return;
    if (on) ctx.resume();
    n.master.gain.setTargetAtTime(on ? 0.85 : 0, ctx.currentTime, 0.35);
    lastStage = -1;
  }

  function update(p, env) {
    if (!ctx || !on) { lastP = p; return; }
    const t = ctx.currentTime;
    const swell = 0.5 + 0.5 * Math.sin(TAU * p * 8 - 1.2);
    n.surf.gain.setTargetAtTime(0.16 * (0.4 + 0.6 * swell) * (1 + 0.6 * env.storm), t, 0.25);
    n.surfLP.frequency.setTargetAtTime(360 + 520 * swell, t, 0.25);
    n.wind.gain.setTargetAtTime(0.025 + 0.13 * env.storm, t, 0.5);
    n.windBP.frequency.setTargetAtTime(340 + 360 * env.wind + 140 * Math.sin(TAU * p * 3), t, 0.6);
    n.rain.gain.setTargetAtTime(0.32 * env.rain, t, 0.4);
    n.creek.gain.setTargetAtTime(0.01 + 0.05 * env.flow, t, 0.5);
    const si = stageIndexAt(p);
    if (si !== lastStage) { chord(si); lastStage = si; }
    if (env.boltIndex !== lastBolt) {
      if (env.boltIndex >= 0) thunder(0.25 + env.boltIndex * 0.35);
      lastBolt = env.boltIndex;
    }
    const d = wrap01(p - lastP);
    if (d < 0.05) for (const b of BIRDS) if (wrap01(b - lastP) < d) bird();
    lastP = p;
  }

  return { setEnabled, update, get enabled() { return on; } };
}

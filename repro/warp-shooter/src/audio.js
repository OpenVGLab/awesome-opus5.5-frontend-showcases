// Web Audio synthesizer: step sequencer for the BGM and procedural sound effects. No audio files.
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- songs
// Notes: [bar, step, midi, lengthInSteps]; 16 steps per bar.
const STAGE_LEAD = [
  [0,0,69,3],[0,4,74,3],[0,8,76,2],[0,10,77,6],
  [1,0,76,2],[1,2,74,2],[1,4,77,4],[1,8,81,2],[1,10,82,2],[1,12,81,4],
  [2,0,79,4],[2,4,76,2],[2,6,72,2],[2,8,76,2],[2,10,79,2],[2,12,84,4],
  [3,0,85,6],[3,6,81,2],[3,8,76,4],[3,12,73,4],
  [4,0,74,2],[4,2,77,2],[4,4,81,4],[4,8,86,4],[4,12,84,2],[4,14,81,2],
  [5,0,82,4],[5,4,81,2],[5,6,77,2],[5,8,74,4],[5,12,77,4],
  [6,0,76,2],[6,2,79,2],[6,4,84,4],[6,8,82,2],[6,10,81,2],[6,12,79,4],
  [7,0,81,8],[7,12,76,2],[7,14,79,2],
  [8,0,86,4],[8,4,84,2],[8,6,82,2],[8,8,81,2],[8,10,82,2],[8,12,86,4],
  [9,0,85,4],[9,4,88,4],[9,8,81,8],
  [10,0,89,4],[10,4,88,2],[10,6,86,2],[10,8,81,4],[10,12,77,4],
  [11,0,79,2],[11,2,81,2],[11,4,82,4],[11,8,86,4],[11,12,89,4],
  [12,0,91,6],[12,6,89,2],[12,8,86,4],[12,12,82,4],
  [13,0,84,2],[13,2,86,2],[13,4,88,4],[13,8,91,4],[13,12,88,4],
  [14,0,88,4],[14,4,85,4],[14,8,81,4],[14,12,85,4],
  [15,0,88,12],[15,12,81,2],[15,14,85,2],
];
const CH = {
  Dm: [62, 65, 69, 74], Bb: [58, 62, 65, 70], C: [60, 64, 67, 72], A: [57, 61, 64, 69], Gm: [55, 58, 62, 67],
  Cm: [60, 63, 67, 72], Ab: [56, 60, 63, 68], Bbx: [58, 62, 65, 70], G: [55, 59, 62, 67], Db: [61, 65, 68, 73],
  D: [62, 66, 69, 74], Gx: [55, 59, 62, 67], Bm: [59, 62, 66, 71], Ax: [57, 61, 64, 69], Fm: [53, 56, 60, 65],
};
const STAGE_CH = ['Dm','Bb','C','A','Dm','Bb','C','A','Gm','A','Dm','Bb','Gm','C','A','A'];
const STAGE_ROOT = { Dm: 38, Bb: 34, C: 36, A: 33, Gm: 31 };

const BOSS_LEAD = [
  [0,0,79,3],[0,3,84,3],[0,6,82,2],[0,8,79,4],[0,12,75,4],
  [1,0,77,3],[1,3,79,3],[1,6,80,2],[1,8,84,4],[1,12,87,4],
  [2,0,86,4],[2,4,84,2],[2,6,82,2],[2,8,77,4],[2,12,82,4],
  [3,0,83,6],[3,6,86,2],[3,8,91,8],
  [4,0,87,3],[4,3,86,3],[4,6,84,2],[4,8,79,2],[4,10,84,2],[4,12,87,4],
  [5,0,89,4],[5,4,87,2],[5,6,84,2],[5,8,80,4],[5,12,84,4],
  [6,0,85,4],[6,4,89,4],[6,8,92,4],[6,12,89,4],
  [7,0,91,8],[7,8,89,2],[7,10,87,2],[7,12,86,2],[7,14,83,2],
];
const BOSS_CH = ['Cm','Ab','Bbx','G','Cm','Ab','Db','G'];
const BOSS_ROOT = { Cm: 36, Ab: 32, Bbx: 34, G: 31, Db: 37 };
const BOSS_BASS = [0,0,12,0, 0,12,0,12, 0,0,12,0, 0,12,10,12];

const VICTORY_LEAD = [
  [0,0,69,2],[0,2,74,2],[0,4,78,2],[0,6,81,2],[0,8,86,8],
  [1,0,83,4],[1,4,81,4],[1,8,79,2],[1,10,78,2],[1,12,76,4],
  [2,0,78,2],[2,2,81,2],[2,4,86,4],[2,8,85,4],[2,12,88,4],
  [3,0,86,16],
];
const VICTORY_CH = ['D','Gx','D','D','D','Gx','Bm','Ax'];

function barStep(step) { return [Math.floor(step / 16), step % 16]; }
function leadAt(list, bar, s) { for (const n of list) if (n[0] === bar && n[1] === s) return n; return null; }

const SONGS = {
  title: {
    bpm: 96, bars: 8,
    play(a, step, t, sd) {
      const [bar, s] = barStep(step % 128);
      const chords = ['Dm','Dm','Bb','Bb','Gm','Gm','A','A'];
      const ch = CH[chords[bar]];
      if (s === 0 && bar % 2 === 0) a.pad(t, [ch[0] - 12, ch[1], ch[2], ch[3] + 2], sd * 32, 0.9);
      if (s % 2 === 0) a.bass(t, ch[0] - 24 + (s % 8 === 4 ? 12 : 0), sd * 1.6, 0.35);
      if (s === 0 || s === 8) a.kick(t, 0.35);
      const arpSeq = [0, 2, 1, 3, 2, 1, 3, 0];
      if (s % 2 === 1) a.bell(t, ch[arpSeq[(s >> 1) % 8]] + 12, 0.5);
      if (s === 12 && bar % 2 === 1) a.hat(t, 0.4, true);
    },
  },
  stage: {
    bpm: 150, bars: 16,
    play(a, step, t, sd) {
      const [bar, s] = barStep(step % 256);
      const name = STAGE_CH[bar], ch = CH[name], root = STAGE_ROOT[name];
      const B = bar >= 8;
      if (s % 4 === 0) a.kick(t, 1);
      if (B && s === 14 && bar % 2 === 1) a.kick(t, 0.7);
      if (s === 4 || s === 12) a.snare(t, 0.9);
      if (s % 4 === 2) a.hat(t, 0.9, s === 14 && bar % 2 === 1);
      else if (B) a.hat(t, 0.35);
      if ((bar === 7 || bar === 15) && s >= 12) a.snare(t, 0.35 + (s - 12) * 0.18);
      if (s === 0 && (bar === 0 || bar === 8)) a.crash(t, 0.9);
      if (s % 2 === 0) a.bass(t, root + (s % 4 === 2 ? 12 : 0), sd * 1.7, s % 4 === 0 ? 1 : 0.8);
      if (s === 0) a.pad(t, ch, sd * 16, B ? 0.8 : 0.6);
      const arpSeq = [0, 1, 2, 3, 2, 1, 2, 3];
      a.arp(t, ch[arpSeq[s % 8]] + (B ? 24 : 12), B ? 0.6 : 0.5);
      const n = leadAt(STAGE_LEAD, bar, s);
      if (n) a.lead(t, n[2], n[3] * sd * 0.92, 1);
    },
  },
  boss: {
    bpm: 164, bars: 8,
    play(a, step, t, sd) {
      const [bar, s] = barStep(step % 128);
      const tr = a.bossHot ? 1 : 0;
      const name = BOSS_CH[bar], ch = CH[name].map((m) => m + tr), root = BOSS_ROOT[name] + tr;
      if (s % 4 === 0) a.kick(t, 1);
      if ((s === 7 && bar % 2 === 0) || (s === 10 && bar % 2 === 1)) a.kick(t, 0.75);
      if (s === 4 || s === 12) a.snare(t, 1);
      if (s === 15 && bar % 2 === 1) a.snare(t, 0.45);
      a.hat(t, s % 2 === 0 ? 0.55 : 0.3, s === 6 || s === 14);
      if (bar === 7 && s >= 8 && s % 2 === 0) a.tom(t, 50 - (s - 8), 0.8);
      if (s === 0 && (bar % 4 === 0 || a.bossHot)) a.crash(t, 0.85);
      a.bass(t, root + BOSS_BASS[s], sd * 0.9, s % 4 === 0 ? 1 : 0.75);
      if (s === 0 || s === 3 || s === 6 || s === 10) a.stab(t, ch, sd * (s === 10 ? 3 : 2), 0.8);
      if (s === 0) a.pad(t, [ch[0] - 12, ch[0], ch[2]], sd * 16, 0.5);
      const arpSeq = [0, 2, 1, 3, 0, 2, 3, 1];
      a.arp(t, ch[arpSeq[s % 8]] + 12, 0.45);
      if (a.bossHot) a.arp(t, ch[arpSeq[(s + 3) % 8]] + 24, 0.35);
      const n = leadAt(BOSS_LEAD, bar, s);
      if (n) a.lead(t, n[2] + tr, n[3] * sd * 0.92, 1.05);
    },
  },
  victory: {
    bpm: 132, bars: 12, loopFrom: 4,
    play(a, step, t, sd) {
      let bar = Math.floor(step / 16); const s = step % 16;
      if (bar >= 12) bar = 4 + ((bar - 4) % 8);
      if (bar < 4) {
        const n = leadAt(VICTORY_LEAD, bar, s);
        if (n) a.lead(t, n[2], n[3] * sd * 0.95, 1.1);
        const ch = CH[bar === 1 ? 'Gx' : bar === 2 ? 'Ax' : 'D'];
        if (s === 0) { a.pad(t, ch, sd * 16, 1); a.crash(t, bar === 0 ? 1 : 0.5); }
        if (s % 4 === 0) a.kick(t, bar === 3 && s > 0 ? 0 : 0.9);
        if (s === 4 || s === 12) a.snare(t, bar === 3 ? 0 : 0.7);
        if (s % 2 === 0) a.bass(t, ch[0] - 24 + (s % 4 === 2 ? 12 : 0), sd * 1.6, 0.8);
        if (bar === 2 && s >= 8) a.snare(t, 0.3 + (s - 8) * 0.08);
      } else {
        const ch = CH[VICTORY_CH[bar - 4]];
        if (s === 0) a.pad(t, [ch[0] - 12, ...ch], sd * 16, 0.8);
        if (s % 2 === 0) a.bell(t, ch[[0, 1, 2, 3, 2, 1, 3, 2][(s >> 1) % 8]] + 12, 0.45);
        if (s % 4 === 0) a.bass(t, ch[0] - 24, sd * 3, 0.4);
      }
    },
  },
};

// ---------------------------------------------------------------- engine
export class AudioEngine {
  constructor() {
    this.ctx = null; this.muted = false; this.song = null; this.pending = null; this.jump = -1;
    this.step = 0; this.nextTime = 0; this.bossHot = false; this.last = {};
  }

  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0.42; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.85; this.sfx.connect(this.master);
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(2.8, 3);
    this.verbIn = c.createGain(); this.verbIn.connect(this.verb);
    const verbOut = c.createGain(); verbOut.gain.value = 0.55; this.verb.connect(verbOut); verbOut.connect(this.master);
    this.dly = c.createDelay(1.5); this.dly.delayTime.value = 0.3;
    const fb = c.createGain(); fb.gain.value = 0.34;
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    this.dlyIn = c.createGain(); this.dlyIn.gain.value = 0.5;
    this.dlyIn.connect(this.dly); this.dly.connect(dlp); dlp.connect(fb); fb.connect(this.dly);
    dlp.connect(this.music);
    const len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 6); }
    this.curve = curve;
    this.timer = setInterval(() => this.tick(), 25);
    if (this.wanted) { const w = this.wanted; this.wanted = null; this.playSong(w); }
  }

  impulse(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  suspend(s) { if (this.ctx) (s ? this.ctx.suspend() : this.ctx.resume()).catch(() => {}); }

  // ---- sequencer
  playSong(name, at) {
    if (!this.ctx) { this.wanted = name; return; }
    const song = SONGS[name];
    if (!song) { this.song = null; return; }
    this.song = song; this.step = 0; this.pending = null; this.jump = -1;
    this.dly.delayTime.setValueAtTime((60 / song.bpm) * 0.75, this.ctx.currentTime);
    this.nextTime = Math.max(at || 0, this.ctx.currentTime + 0.04);
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setValueAtTime(0.42, this.ctx.currentTime);
  }

  queueSong(name) { if (!this.ctx) { this.wanted = name; return; } this.pending = SONGS[name]; }
  jumpToBar(bar) { this.jump = bar * 16; }
  stopSong(fade = 0.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(this.music.gain.value, t);
    this.music.gain.linearRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { if (this.music.gain.value < 0.01) this.song = null; }, fade * 1000 + 50);
  }

  tick() {
    const c = this.ctx;
    if (!c || !this.song || c.state !== 'running') return;
    if (this.nextTime < c.currentTime - 0.1) this.nextTime = c.currentTime + 0.02;
    const ahead = c.currentTime + 0.13;
    while (this.nextTime < ahead && this.song) {
      const sd = 60 / this.song.bpm / 4;
      try { this.song.play(this, this.step, this.nextTime, sd); } catch (e) { /* keep the clock running */ }
      this.nextTime += sd; this.step++;
      if (this.step % 16 === 0) {
        if (this.pending) { const p = this.pending; this.pending = null; this.song = p; this.step = 0;
          this.dly.delayTime.setValueAtTime((60 / p.bpm) * 0.75, this.nextTime); }
        else if (this.jump >= 0) { this.step = this.jump; this.jump = -1; }
      }
    }
  }

  // ---- building blocks
  osc(type, f, t, dur, dest, gain, opts = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.glide || dur));
    if (opts.detune) o.detune.value = opts.detune;
    const a = opts.a || 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.03);
    return g;
  }

  noise(t, dur, type, f, gain, dest, q = 1, fTo = 0, a = 0.002) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true;
    fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.03);
    return g;
  }

  panned(pan) {
    if (!pan || !this.ctx.createStereoPanner) return this.sfx;
    const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.sfx);
    return p;
  }

  // ---- instruments
  kick(t, v = 1) {
    if (v <= 0) return;
    this.osc('sine', 165, t, 0.36, this.music, 0.95 * v, { to: 42, glide: 0.13 });
    this.noise(t, 0.015, 'highpass', 2500, 0.22 * v, this.music);
  }
  snare(t, v = 1) {
    if (v <= 0) return;
    this.noise(t, 0.2, 'bandpass', 1900, 0.5 * v, this.music, 0.8);
    this.noise(t, 0.1, 'highpass', 5200, 0.22 * v, this.music);
    this.osc('triangle', 240, t, 0.12, this.music, 0.42 * v, { to: 160, glide: 0.08 });
    this.noise(t, 0.3, 'bandpass', 2300, 0.16 * v, this.verbIn, 0.7);
  }
  hat(t, v = 1, open = false) { this.noise(t, open ? 0.24 : 0.045, 'highpass', 8200, 0.2 * v, this.music); }
  crash(t, v = 1) {
    this.noise(t, 1.7, 'highpass', 5200, 0.26 * v, this.music);
    this.noise(t, 2.0, 'bandpass', 7200, 0.16 * v, this.verbIn, 0.5);
  }
  tom(t, m, v = 1) { this.osc('sine', hz(m), t, 0.28, this.music, 0.6 * v, { to: hz(m) * 0.6, glide: 0.25 }); }

  bass(t, m, dur, v = 1) {
    const c = this.ctx, f = hz(m);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 7;
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(900 + 1100 * v, t + 0.012);
    lp.frequency.exponentialRampToValueAtTime(240, t + Math.max(0.05, dur * 0.9));
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.005);
    g.gain.setValueAtTime(0.3 * v, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    lp.connect(g); g.connect(this.music);
    for (const [type, det, gg] of [['sawtooth', 0, 1], ['square', 9, 0.4]]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = f; o.detune.value = det; og.gain.value = gg;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.03);
    }
  }

  lead(t, m, dur, v = 1) {
    const c = this.ctx, f = hz(m);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 1.2;
    const g = c.createGain(), r = 0.14;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13 * v, t + 0.012);
    g.gain.setValueAtTime(0.11 * v, t + Math.max(0.02, dur));
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur + r);
    lp.connect(g); g.connect(this.music); g.connect(this.dlyIn);
    const vs = c.createGain(); vs.gain.value = 0.4; g.connect(vs); vs.connect(this.verbIn);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.6;
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(18, t + Math.min(dur, 0.45));
    lfo.connect(lg);
    for (const [type, mul, det, gg] of [['sawtooth', 1, -9, 0.5], ['sawtooth', 1, 9, 0.5], ['square', 0.5, 0, 0.32]]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = f * mul; o.detune.value = det; og.gain.value = gg;
      lg.connect(o.detune);
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + r + 0.05);
    }
    lfo.start(t); lfo.stop(t + dur + r + 0.05);
  }

  arp(t, m, v = 1) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.14);
    const g = this.osc('square', hz(m), t, 0.16, lp, 0.055 * v);
    lp.connect(this.music); lp.connect(this.dlyIn);
    return g;
  }

  bell(t, m, v = 1) {
    this.osc('sine', hz(m), t, 0.9, this.music, 0.07 * v);
    this.osc('sine', hz(m) * 2.76, t, 0.3, this.music, 0.02 * v);
    const g = this.osc('triangle', hz(m), t, 0.5, this.dlyIn, 0.05 * v);
    return g;
  }

  pad(t, notes, dur, v = 1) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.6;
    const g = c.createGain(), a = Math.min(0.35, dur * 0.3), r = 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035 * v, t + a);
    g.gain.setValueAtTime(0.035 * v, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + r);
    lp.connect(g); g.connect(this.music);
    const vs = c.createGain(); vs.gain.value = 0.7; g.connect(vs); vs.connect(this.verbIn);
    for (const m of notes) for (const det of [-11, 11]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + r + 0.05);
    }
  }

  stab(t, notes, dur, v = 1) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    lp.connect(g); g.connect(this.music);
    for (const m of notes.slice(0, 3)) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.connect(lp); o.start(t); o.stop(t + dur + 0.03);
    }
  }

  // ---------------------------------------------------------------- SFX
  gate(name, ms) {
    const n = performance.now();
    if (this.last[name] && n - this.last[name] < ms) return false;
    this.last[name] = n; return true;
  }

  shot() {
    if (!this.ctx || !this.gate('shot', 70)) return;
    const t = this.now;
    this.osc('square', 1300 + Math.random() * 120, t, 0.075, this.sfx, 0.045, { to: 380 });
    this.noise(t, 0.03, 'highpass', 6000, 0.04, this.sfx);
  }
  hit(pan) {
    if (!this.ctx || !this.gate('hit', 40)) return;
    const t = this.now, d = this.panned(pan);
    this.noise(t, 0.05, 'bandpass', 2800, 0.13, d, 1.2);
    this.osc('square', 900, t, 0.04, d, 0.035, { to: 420 });
  }
  tink(pan) {
    if (!this.ctx || !this.gate('tink', 70)) return;
    const t = this.now, d = this.panned(pan);
    this.osc('sine', 3100, t, 0.09, d, 0.05); this.osc('sine', 4650, t, 0.06, d, 0.03);
  }
  explode(size = 0, pan = 0) {
    if (!this.ctx) return;
    if (size === 0 && !this.gate('exs', 45)) return;
    const t = this.now, d = this.panned(pan);
    const dur = [0.5, 0.9, 1.5, 2.8][size], g = [0.34, 0.5, 0.7, 0.9][size];
    this.noise(t, dur, 'lowpass', 5200, g, d, 0.8, 140);
    this.osc('sine', [130, 105, 85, 72][size], t, dur * 0.8, d, g * 1.1, { to: [45, 36, 28, 22][size] });
    if (size >= 1) {
      this.noise(t, dur * 1.2, 'bandpass', 900, g * 0.35, this.verbIn, 0.6, 200);
      for (let i = 0; i < size * 3; i++) this.noise(t + 0.05 + Math.random() * dur * 0.5, 0.12, 'bandpass', 1200 + Math.random() * 2000, g * 0.25, d, 2);
    }
    if (size >= 3) this.osc('sawtooth', 60, t, 2.5, d, 0.18, { to: 24 });
  }
  warning() {
    if (!this.ctx) return;
    const t = this.now;
    const c = this.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 2400;
    for (let i = 0; i < 12; i++) o.frequency.setValueAtTime(i % 2 ? 560 : 760, t + i * 0.22);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.setValueAtTime(0.09, t + 2.5); g.gain.exponentialRampToValueAtTime(0.0005, t + 2.7);
    o.connect(lp); lp.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 2.75);
    this.braam(t, 2.4); this.braam(t + 1.3, 1.6);
  }
  braam(t, dur) {
    const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(90, t); lp.frequency.exponentialRampToValueAtTime(1100, t + 0.35); lp.frequency.exponentialRampToValueAtTime(160, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    lp.connect(g); g.connect(this.sfx); g.connect(this.verbIn);
    for (const [f, det] of [[43.65, -12], [43.65, 12], [87.3, 0], [65.4, 5]]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  laserLaunch(n) {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < n; i++) {
      const d = this.panned((i % 2 ? 1 : -1) * (0.3 + Math.random() * 0.5));
      this.osc('sine', 520 + Math.random() * 80, t + i * 0.035, 0.22, d, 0.05, { to: 2600 + Math.random() * 600 });
    }
    this.noise(t, 0.6, 'bandpass', 600, 0.12, this.sfx, 1.5, 4200);
  }
  laserReady() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sine', 1318, t, 0.3, this.sfx, 0.07); this.osc('sine', 1760, t + 0.09, 0.4, this.sfx, 0.07);
  }
  lock() { if (this.ctx && this.gate('lock', 90)) this.osc('square', 1900, this.now, 0.05, this.sfx, 0.025); }
  damage() {
    if (!this.ctx) return;
    const t = this.now, c = this.ctx, ws = c.createWaveShaper(), g = c.createGain();
    ws.curve = this.curve; g.gain.value = 0.5; ws.connect(g); g.connect(this.sfx);
    this.noise(t, 0.4, 'lowpass', 3200, 0.5, ws, 0.7, 300);
    this.osc('square', 95, t, 0.35, ws, 0.3, { to: 50 });
    this.osc('sawtooth', 880, t, 0.25, this.sfx, 0.06, { to: 110 });
  }
  chain(n) {
    if (!this.ctx || !this.gate('chain', 60)) return;
    this.osc('square', 880 * Math.pow(2, Math.min(n, 14) / 12), this.now, 0.07, this.sfx, 0.03);
  }
  missile() { if (this.ctx && this.gate('missile', 90)) this.noise(this.now, 0.45, 'bandpass', 700, 0.09, this.sfx, 2, 3200); }
  whoosh(v = 1) {
    if (!this.ctx || !this.gate('whoosh', 120)) return;
    const t = this.now;
    this.noise(t, 0.2, 'bandpass', 500, 0.1 * v, this.sfx, 1.6, 2600);
    this.noise(t + 0.18, 0.25, 'bandpass', 2600, 0.06 * v, this.sfx, 1.6, 500);
  }
  select() { if (this.ctx) { const t = this.now; this.osc('square', 660, t, 0.08, this.sfx, 0.05); this.osc('square', 1320, t + 0.07, 0.12, this.sfx, 0.05); } }
  beamCharge(dur) {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sawtooth', 110, t, dur, this.sfx, 0.06, { to: 1100, a: dur * 0.8 });
    this.noise(t, dur, 'bandpass', 400, 0.12, this.sfx, 3, 5000, dur * 0.8);
  }
  beamFire(dur) {
    if (!this.ctx) return;
    const t = this.now, c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain(), trem = c.createOscillator(), tg = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 1600;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    g.gain.setValueAtTime(0.16, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    trem.frequency.value = 22; tg.gain.value = 0.06; trem.connect(tg); tg.connect(g.gain);
    lp.connect(g); g.connect(this.sfx); g.connect(this.verbIn);
    for (const [type, f] of [['sawtooth', 70], ['sawtooth', 70.9], ['square', 140]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    trem.start(t); trem.stop(t + dur + 0.05);
    this.noise(t, dur, 'highpass', 3000, 0.08, this.sfx, 0.7);
  }
  shutter() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sawtooth', 55, t, 1.4, this.sfx, 0.22, { to: 32 });
    this.noise(t, 1.2, 'lowpass', 900, 0.3, this.sfx, 2, 120);
    for (let i = 0; i < 4; i++) this.osc('square', 240 - i * 30, t + 0.15 + i * 0.22, 0.09, this.sfx, 0.07);
    this.braam(t + 0.4, 1.8);
  }
  warpCharge(dur) {
    if (!this.ctx) return;
    const t = this.now;
    this.noise(t, dur, 'bandpass', 250, 0.16, this.sfx, 2.5, 6500, dur * 0.9);
    this.osc('sawtooth', 55, t, dur, this.sfx, 0.07, { to: 880, a: dur * 0.9 });
    this.osc('sawtooth', 55.6, t, dur, this.sfx, 0.07, { to: 886, a: dur * 0.9 });
    for (let i = 0, tt = 0.9; tt < dur - 0.05; i++) {
      const gap = tt < dur * 0.45 ? 0.2 : tt < dur * 0.75 ? 0.1 : 0.05;
      this.snare(t + tt, Math.min(1, 0.15 + tt / dur));
      tt += gap;
    }
  }
  warpOut() {
    if (!this.ctx) return;
    const t = this.now;
    this.osc('sine', 75, t, 1.6, this.sfx, 0.9, { to: 24 });
    this.noise(t, 1.8, 'lowpass', 9000, 0.6, this.sfx, 0.7, 250);
    this.noise(t, 2.4, 'bandpass', 1500, 0.3, this.verbIn, 0.5, 300);
    this.crash(t, 1.2);
  }
  bossWarpIn() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise(t, 1.0, 'bandpass', 200, 0.25, this.sfx, 2, 5000, 0.95);
    this.osc('sine', 60, t + 1.0, 1.8, this.sfx, 0.8, { to: 22 });
    this.noise(t + 1.0, 1.6, 'lowpass', 6000, 0.5, this.sfx, 0.7, 200);
    this.braam(t + 1.0, 2.2);
  }
  playerWarp() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise(t, 1.2, 'bandpass', 300, 0.2, this.sfx, 2, 7000, 1.1);
    this.osc('sine', 220, t, 1.2, this.sfx, 0.1, { to: 1760 });
    this.osc('sine', 90, t + 1.1, 1.2, this.sfx, 0.6, { to: 30 });
  }
}

export const audio = new AudioEngine();

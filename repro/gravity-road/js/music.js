// Web Audio: a small waltz band heard through an old radio. The accompaniment is scheduled by
// distance travelled, so the tempo is the car's speed; the melody only sounds when you play it.
import { BEAT, BAR_BEATS, CHORDS, BASS } from './config.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor(song) {
    this.song = song;
    this.ctx = null;
    this.muted = false;
    this.nextK = null;
    this.streetBars = song.streets.map((s) => s.startBeat / BAR_BEATS);
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  start() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    this.master.connect(comp);
    comp.connect(c.destination);
    // radio colour
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 85;
    const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1400; pk.Q.value = 0.8; pk.gain.value = 2.5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7200;
    this.bus = c.createGain();
    this.bus.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(this.master);
    this.rev = c.createConvolver();
    this.rev.buffer = this.impulse(2.5);
    this.revSend = c.createGain();
    this.revSend.gain.value = 0.28;
    this.revSend.connect(this.rev);
    this.rev.connect(hp);
    // missed notes arrive as a far-away, filtered signal
    this.ghostBus = c.createBiquadFilter();
    this.ghostBus.type = 'lowpass'; this.ghostBus.frequency.value = 850;
    this.ghostBus.connect(this.bus);
    this.noise = this.makeNoise(2);
    const bed = c.createBufferSource();
    bed.buffer = this.noise; bed.loop = true;
    const bf = c.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1900; bf.Q.value = 0.5;
    const bg = c.createGain(); bg.gain.value = 0.0045;
    bed.connect(bf); bf.connect(bg); bg.connect(this.master);
    bed.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  makeNoise(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  resync() { this.nextK = null; }

  update(odo, v, dt) {
    if (!this.ctx || v <= 0.1) return;
    if (Math.random() < dt * 1.4) this.pop(this.ctx.currentTime + 0.02, 0.01 + Math.random() * 0.03);
    const half = BEAT / 2;
    const horizon = odo + v * 0.14;
    if (this.nextK === null || this.nextK * half < odo - 20 || this.nextK * half > horizon + 40) this.nextK = Math.ceil(odo / half);
    while (this.nextK * half <= horizon) {
      const k = this.nextK++;
      const when = this.ctx.currentTime + Math.max(0, (k * half - odo) / v);
      this.accomp(k, when, BEAT / v);
    }
  }

  streetOfBar(bar) {
    const b = this.streetBars;
    return bar < b[1] ? 0 : bar < b[2] ? 1 : bar < b[3] ? 2 : 3;
  }

  accomp(k, t, bd) {
    const total = this.song.totalBeats * 2;
    const kl = ((k % total) + total) % total;
    const beat = kl >> 1, half = kl & 1;
    const bar = Math.floor(beat / BAR_BEATS), bb = beat % BAR_BEATS;
    const st = this.streetOfBar(bar);
    const street = this.song.streets[st];
    const name = street.chords[bar - this.streetBars[st]];
    const chord = CHORDS[name], root = BASS[name];
    if (half === 0 && bb === 0 && bar === this.streetBars[st]) this.tune(Math.max(this.ctx.currentTime, t - 0.3));
    switch (street.style) {
      case 'waltz':
        if (half === 0) {
          if (bb === 0) this.bass(bar % 2 ? root + 7 : root, t, bd, 0.3);
          else this.accordion(chord, t, bd * 0.42, 0.04, 1700);
          this.shaker(t, bb === 0 ? 0.035 : 0.022);
        } else this.shaker(t, 0.011);
        break;
      case 'climb':
        if (half === 0) {
          if (bb === 0) this.bass(root, t, bd, 0.3);
          else this.accordion(chord, t, bd * 0.4, 0.038, 2300);
          this.shaker(t, 0.024);
        } else {
          const idx = (bb * 2 + half + bar) % 6;
          const m = chord[idx % chord.length] + 12 * (1 + Math.floor(idx / chord.length));
          this.celesta(mtof(m), t, bd * 0.5, 0.045, this.bus);
        }
        break;
      case 'night':
        if (half === 0 && bb === 0) { this.pad(chord.map((m) => m - 12), t, bd * 3, 0.02); this.bass(root, t, bd * 2, 0.22); }
        if (half === 0 && bb > 0) this.celesta(mtof(chord[(bar + bb) % chord.length] + 12), t, bd, 0.05, this.bus);
        if (half === 1 && bb === 2) this.celesta(mtof(chord[(bar + 2) % chord.length] + 24), t, bd * 0.5, 0.03, this.bus);
        break;
      default:
        if (half === 0) {
          if (bb === 0) { this.bass(root, t, bd, 0.3); this.kick(t, 0.16); this.pad(chord, t, bd * 3, 0.015); }
          else this.accordion(chord, t, bd * 0.42, 0.036, 2000);
          this.shaker(t, 0.03);
        } else this.shaker(t, 0.017);
    }
  }

  env(g, t, peak, attack, decayEnd) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, decayEnd);
  }

  celesta(f, t, len, vel, dest) {
    const c = this.ctx;
    const out = c.createGain();
    out.connect(dest);
    out.connect(this.revSend);
    const parts = [[1, 1, 1.4 + len * 0.6], [2, 0.3, 0.7], [3.01, 0.1, 0.35], [5.97, 0.05, 0.16]];
    for (const [mul, amp, dec] of parts) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mul;
      const g = c.createGain();
      this.env(g, t, vel * amp, 0.004, t + dec);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dec + 0.05);
    }
  }

  melody(note, t, bd) { this.celesta(note.freq, t, note.beats * bd, 0.3, this.bus); }

  ghost(note, t, bd) {
    this.celesta(note.freq, t, note.beats * bd * 0.5, 0.06, this.ghostBus);
    this.staticBurst(t, 0.035);
  }

  accordion(midis, t, len, vel, cutoff) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.025);
    g.gain.setValueAtTime(vel, t + len);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.09);
    lp.connect(g); g.connect(this.bus); g.connect(this.revSend);
    for (const m of midis) {
      for (const det of [-7, 6]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det;
        o.connect(lp);
        o.start(t); o.stop(t + len + 0.12);
      }
    }
  }

  bass(m, t, bd, vel) {
    const c = this.ctx, f = mtof(m);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = c.createGain();
    this.env(g, t, vel, 0.008, t + bd * 1.5);
    lp.connect(g); g.connect(this.bus);
    for (const type of ['triangle', 'sine']) {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = f;
      o.connect(lp); o.start(t); o.stop(t + bd * 1.5 + 0.05);
    }
  }

  pad(midis, t, len, vel) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 950; lp.Q.value = 0.4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + len * 0.35);
    g.gain.setValueAtTime(vel, t + len * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.6);
    lp.connect(g); g.connect(this.bus); g.connect(this.revSend);
    for (const m of midis) {
      for (const det of [-9, 8]) {
        const o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + len + 0.7);
      }
    }
  }

  noiseSrc(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 1.5, dur + 0.05);
    return src;
  }

  shaker(t, vel) {
    const c = this.ctx;
    const src = this.noiseSrc(t, 0.07);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = c.createGain();
    this.env(g, t, vel, 0.003, t + 0.06);
    src.connect(hp); hp.connect(g); g.connect(this.bus);
  }

  kick(t, vel) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = c.createGain();
    this.env(g, t, vel, 0.004, t + 0.25);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.3);
  }

  pop(t, vel) {
    const c = this.ctx;
    const src = this.noiseSrc(t, 0.006);
    const g = c.createGain();
    this.env(g, t, vel, 0.001, t + 0.006);
    src.connect(g); g.connect(this.master);
  }

  staticBurst(t, vel) {
    const c = this.ctx;
    const src = this.noiseSrc(t, 0.1);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2;
    const g = c.createGain();
    this.env(g, t, vel, 0.004, t + 0.09);
    src.connect(bp); bp.connect(g); g.connect(this.bus);
  }

  // the radio retunes to the next street's station
  tune(t) {
    const c = this.ctx;
    const src = this.noiseSrc(t, 0.75);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 5;
    bp.frequency.setValueAtTime(600, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + 0.35);
    bp.frequency.exponentialRampToValueAtTime(1300, t + 0.62);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
    g.gain.setValueAtTime(0.05, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    src.connect(bp); bp.connect(g); g.connect(this.bus);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(2200, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.6);
    const og = c.createGain();
    this.env(og, t, 0.012, 0.05, t + 0.65);
    o.connect(og); og.connect(this.bus);
    o.start(t); o.stop(t + 0.7);
  }

  whoosh(t) {
    if (!this.ctx) return;
    const c = this.ctx;
    const src = this.noiseSrc(t, 0.9);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1600, t + 0.35);
    bp.frequency.exponentialRampToValueAtTime(380, t + 0.85);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.88);
    src.connect(bp); bp.connect(g); g.connect(this.master);
  }

  paper(t) {
    if (!this.ctx) return;
    const c = this.ctx;
    const src = this.noiseSrc(t, 0.7);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3400; bp.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 9; i++) {
      g.gain.linearRampToValueAtTime(0.05 * (1 - i / 9), t + i * 0.07 + 0.02);
      g.gain.linearRampToValueAtTime(0.004, t + i * 0.07 + 0.06);
    }
    src.connect(bp); bp.connect(g); g.connect(this.master);
  }
}

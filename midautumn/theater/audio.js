// 月宫小剧场 · audio: everything synthesised with Web Audio and scheduled on the same timeline as renderFrame(t).
(function () {
  'use strict';
  const TH = window.TH;
  const T = TH.T;

  let ac = null, master = null, session = null, noiseBuf = null;
  let events = null, cursor = 0, base = 0;
  const LOOK = 0.3;

  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ------------------------------------------------------------------ primitives
  function envGain(dest, when, peak, a, d) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + a);
    g.gain.exponentialRampToValueAtTime(0.0001, when + a + d);
    g.connect(dest);
    return g;
  }

  function tone(dest, when, type, f0, f1, dur, peak, a = 0.005) {
    const nyq = ac.sampleRate * 0.45;
    f0 = Math.min(f0, nyq);
    if (f1) f1 = Math.min(f1, nyq);
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + dur);
    const g = envGain(dest, when, peak, a, dur);
    o.connect(g);
    o.start(when); o.stop(when + a + dur + 0.05);
    return o;
  }

  function noise(dest, when, dur, peak, type, f0, f1, q = 1, a = 0.005) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, when);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, when + dur);
    const g = envGain(dest, when, peak, a, dur);
    src.connect(f); f.connect(g);
    src.start(when, Math.random() * 1.5); src.stop(when + a + dur + 0.05);
  }

  function makeNoise() {
    const len = ac.sampleRate * 2;
    const b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x7fffffff) * 2 - 1; }
    return b;
  }

  // ------------------------------------------------------------------ instruments
  // Plucked zither-ish note: bright attack, falling low-pass, slight pitch settle.
  function pluck(dest, when, m, dur = 0.9, vel = 0.22) {
    const f = midi(m);
    const o1 = ac.createOscillator(); o1.type = 'triangle';
    o1.frequency.setValueAtTime(f * 1.012, when); o1.frequency.exponentialRampToValueAtTime(f, when + 0.05);
    const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f * 2;
    const g2 = ac.createGain(); g2.gain.value = 0.16;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(Math.min(10000, f * 10), when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.3), when + dur * 0.85);
    const g = envGain(dest, when, vel, 0.004, dur);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g);
    o1.start(when); o2.start(when); o1.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
  }

  function bass(dest, when, m, dur = 0.5, vel = 0.3) {
    tone(dest, when, 'sine', midi(m), 0, dur, vel, 0.01);
    tone(dest, when, 'triangle', midi(m), 0, dur * 0.6, vel * 0.35, 0.01);
  }

  function wood(dest, when, hi = false, vel = 0.2) {
    tone(dest, when, 'sine', hi ? 1500 : 1050, hi ? 1300 : 900, 0.07, vel, 0.001);
    noise(dest, when, 0.03, vel * 0.4, 'bandpass', 2500, 0, 3, 0.001);
  }

  function bell(dest, when, m, dur = 1.2, vel = 0.12) {
    const f = midi(m);
    tone(dest, when, 'sine', f, 0, dur, vel, 0.003);
    tone(dest, when, 'sine', f * 2.76, 0, dur * 0.5, vel * 0.35, 0.003);
    tone(dest, when, 'sine', f * 5.4, 0, dur * 0.25, vel * 0.15, 0.003);
  }

  // ------------------------------------------------------------------ sound effects
  const SFX = {
    boing(d, w, lo = 160, hi = 520, v = 0.32) {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(lo, w); o.frequency.exponentialRampToValueAtTime(hi, w + 0.12); o.frequency.exponentialRampToValueAtTime(hi * 0.8, w + 0.3);
      const lfo = ac.createOscillator(); lfo.frequency.value = 22;
      const lg = ac.createGain(); lg.gain.value = hi * 0.08;
      lfo.connect(lg); lg.connect(o.frequency);
      const g = envGain(d, w, v, 0.005, 0.32);
      o.connect(g); o.start(w); lfo.start(w); o.stop(w + 0.4); lfo.stop(w + 0.4);
    },
    pop(d, w, f = 700, v = 0.25) { tone(d, w, 'sine', f, f * 2.2, 0.06, v, 0.002); },
    bubble(d, w) { tone(d, w, 'sine', 520, 1040, 0.05, 0.12, 0.002); tone(d, w + 0.03, 'sine', 900, 1400, 0.05, 0.08, 0.002); },
    whoosh(d, w, dur = 0.45, up = true, v = 0.35) { noise(d, w, dur, v, 'bandpass', up ? 350 : 3200, up ? 3200 : 350, 1.4, dur * 0.4); },
    swish(d, w, v = 0.28) { noise(d, w, 0.12, v, 'bandpass', 2000, 5000, 2, 0.02); },
    chomp(d, w) {
      for (let i = 0; i < 3; i++) noise(d, w + i * 0.028, 0.035, 0.5 - i * 0.1, 'highpass', 1500, 0, 1, 0.001);
      tone(d, w, 'sine', 160, 50, 0.18, 0.7, 0.002);
      noise(d, w, 0.2, 0.25, 'lowpass', 900, 200, 1, 0.002);
    },
    munch(d, w, v = 0.14) { noise(d, w, 0.04, v, 'bandpass', 2600, 0, 2, 0.002); noise(d, w + 0.05, 0.03, v * 0.7, 'bandpass', 3200, 0, 2, 0.002); },
    thud(d, w, v = 0.8) { tone(d, w, 'sine', 120, 42, 0.28, v, 0.002); noise(d, w, 0.12, 0.3, 'lowpass', 500, 120, 1, 0.002); },
    drip(d, w) { tone(d, w, 'sine', 800, 1900, 0.07, 0.25, 0.002); },
    slurp(d, w) { tone(d, w, 'sine', 300, 1100, 0.2, 0.18, 0.01); noise(d, w, 0.2, 0.08, 'bandpass', 800, 2400, 3, 0.02); },
    growl(d, w, dur = 0.85) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 72;
      const lfo = ac.createOscillator(); lfo.frequency.value = 6.5;
      const lg = ac.createGain(); lg.gain.value = 22;
      lfo.connect(lg); lg.connect(o.frequency);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 6;
      const trem = ac.createGain(); trem.gain.value = 0.6;
      const tl = ac.createOscillator(); tl.frequency.value = 13;
      const tg = ac.createGain(); tg.gain.value = 0.4;
      tl.connect(tg); tg.connect(trem.gain);
      const g = envGain(d, w, 0.55, 0.08, dur);
      o.connect(lp); lp.connect(trem); trem.connect(g);
      [o, lfo, tl].forEach((n) => { n.start(w); n.stop(w + dur + 0.2); });
    },
    twinkle(d, w, v = 0.1) { [84, 88, 91, 96].forEach((m, i) => bell(d, w + i * 0.07, m, 0.6, v)); },
    shimmer(d, w, v = 0.09) { [72, 74, 76, 79, 81, 84, 86, 88, 91].forEach((m, i) => pluck(d, w + i * 0.035, m, 0.7, v)); },
    slideUp(d, w, dur = 0.55, v = 0.2) {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(380, w); o.frequency.exponentialRampToValueAtTime(1700, w + dur);
      const lfo = ac.createOscillator(); lfo.frequency.value = 7; const lg = ac.createGain(); lg.gain.value = 18;
      lfo.connect(lg); lg.connect(o.frequency);
      const g = envGain(d, w, v, 0.04, dur);
      o.connect(g); o.start(w); lfo.start(w); o.stop(w + dur + 0.1); lfo.stop(w + dur + 0.1);
    },
    slideDown(d, w, dur = 0.45, v = 0.18) { tone(d, w, 'sine', 1500, 260, dur, v, 0.02); },
    sting(d, w) {
      tone(d, w, 'sine', 82, 70, 1.6, 0.6, 0.004);
      tone(d, w, 'sine', 164, 150, 1.1, 0.25, 0.004);
      noise(d, w, 0.9, 0.22, 'highpass', 3000, 0, 0.7, 0.003);
      [55, 61, 67].forEach((m) => tone(d, w + 0.02, 'sawtooth', midi(m), midi(m) * 0.97, 0.9, 0.05, 0.01));
    },
    shout(d, w) { tone(d, w, 'sine', 98, 70, 0.7, 0.5, 0.004); noise(d, w, 0.4, 0.2, 'highpass', 2500, 0, 0.7, 0.003); SFX.boing(d, w + 0.05, 200, 380, 0.18); },
    cricket(d, w, v = 0.07) {
      for (let k = 0; k < 3; k++) {
        const s = w + k * 0.09;
        const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 4300;
        const am = ac.createGain(); am.gain.value = 0.5;
        const l = ac.createOscillator(); l.frequency.value = 45; const lg = ac.createGain(); lg.gain.value = 0.5;
        l.connect(lg); lg.connect(am.gain);
        const g = envGain(d, s, v, 0.01, 0.06);
        o.connect(am); am.connect(g);
        [o, l].forEach((n) => { n.start(s); n.stop(s + 0.1); });
      }
    },
    tick(d, w) { tone(d, w, 'triangle', 2400, 1800, 0.03, 0.2, 0.001); tone(d, w + 0.06, 'triangle', 2000, 1500, 0.025, 0.1, 0.001); },
    gulp(d, w) { tone(d, w, 'sine', 520, 900, 0.05, 0.2, 0.003); tone(d, w + 0.07, 'sine', 320, 110, 0.16, 0.45, 0.004); },
    question(d, w) { tone(d, w, 'sine', 600, 1000, 0.12, 0.1, 0.01); },
    ding(d, w, m = 91, v = 0.16) { bell(d, w, m, 1.0, v); },
    notify(d, w) { bell(d, w, 88, 0.5, 0.12); bell(d, w + 0.12, 84, 0.7, 0.12); },
    shutter(d, w) { noise(d, w, 0.02, 0.12, 'highpass', 3000, 0, 1, 0.001); noise(d, w + 0.05, 0.02, 0.08, 'highpass', 3000, 0, 1, 0.001); },
    gong(d, w, v = 0.35) { tone(d, w, 'sine', 110, 104, 2.2, v, 0.004); tone(d, w, 'sine', 247, 240, 1.5, v * 0.4, 0.004); tone(d, w, 'sine', 392, 0, 0.9, v * 0.2, 0.004); },
    bark(d, w) {
      for (let k = 0; k < 2; k++) {
        const s = w + k * 0.2;
        const o = ac.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(460, s); o.frequency.exponentialRampToValueAtTime(270, s + 0.13);
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.6;
        const g = envGain(d, s, 0.5, 0.008, 0.13);
        o.connect(bp); bp.connect(g); o.start(s); o.stop(s + 0.2);
        noise(d, s, 0.08, 0.12, 'bandpass', 1800, 0, 1.5, 0.004);
      }
    },
    // Stylised audience laughter: a crowd of "ha" trains through vowel formants.
    laugh(d, w, dur = 1.4, vol = 1) {
      const out = ac.createGain(); out.gain.value = 3.2 * vol; out.connect(d);
      const env = ac.createGain();
      env.gain.setValueAtTime(0.0001, w); env.gain.exponentialRampToValueAtTime(1, w + 0.12);
      env.gain.setValueAtTime(1, w + dur * 0.45); env.gain.exponentialRampToValueAtTime(0.0001, w + dur);
      env.connect(out);
      const forms = [[780, 6, 1], [1220, 7, 0.7], [2600, 9, 0.25]].map(([f, q, g]) => {
        const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
        const gg = ac.createGain(); gg.gain.value = g; b.connect(gg); gg.connect(env); return b;
      });
      const rnd = TH.mulberry32(Math.floor(w * 997) + 5);
      for (let v = 0; v < 9; v++) {
        const o = ac.createOscillator(); o.type = 'sawtooth';
        const f0 = 160 + rnd() * 230, st = w + rnd() * 0.22;
        o.frequency.setValueAtTime(f0 * 1.18, st); o.frequency.linearRampToValueAtTime(f0 * 0.82, w + dur);
        const g = ac.createGain(); g.gain.setValueAtTime(0, st);
        const period = 0.12 + rnd() * 0.07, amp = 0.05 + rnd() * 0.05;
        for (let tt = st; tt < w + dur - 0.08; tt += period * (0.85 + rnd() * 0.3)) {
          g.gain.setValueAtTime(0, tt);
          g.gain.linearRampToValueAtTime(amp, tt + 0.018);
          g.gain.linearRampToValueAtTime(amp * 0.3, tt + period * 0.5);
          g.gain.linearRampToValueAtTime(0, tt + period * 0.7);
        }
        o.connect(g); forms.forEach((b) => g.connect(b));
        o.start(st); o.stop(w + dur + 0.05);
      }
      noise(out, w, dur, 0.02, 'bandpass', 1400, 0, 0.8, 0.15);
    },
    // Crowd "哇——": sustained voices sliding from "u" to "a".
    cheer(d, w, dur = 1.5) {
      const out = ac.createGain(); out.gain.value = 2.6; out.connect(d);
      const env = ac.createGain();
      env.gain.setValueAtTime(0.0001, w); env.gain.exponentialRampToValueAtTime(1, w + 0.25);
      env.gain.setValueAtTime(1, w + dur * 0.5); env.gain.exponentialRampToValueAtTime(0.0001, w + dur);
      env.connect(out);
      const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
      f1.frequency.setValueAtTime(350, w); f1.frequency.exponentialRampToValueAtTime(800, w + 0.35);
      const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 6;
      f2.frequency.setValueAtTime(750, w); f2.frequency.exponentialRampToValueAtTime(1250, w + 0.35);
      f1.connect(env); f2.connect(env);
      const rnd = TH.mulberry32(Math.floor(w * 991));
      for (let v = 0; v < 8; v++) {
        const o = ac.createOscillator(); o.type = 'sawtooth';
        const f0 = 180 + rnd() * 220;
        o.frequency.setValueAtTime(f0 * 0.85, w); o.frequency.exponentialRampToValueAtTime(f0 * 1.25, w + 0.4); o.frequency.exponentialRampToValueAtTime(f0 * 0.95, w + dur);
        const g = ac.createGain(); g.gain.value = 0.05;
        o.connect(g); g.connect(f1); g.connect(f2);
        o.start(w + rnd() * 0.1); o.stop(w + dur + 0.05);
      }
      noise(out, w, dur, 0.03, 'bandpass', 1200, 0, 0.7, 0.2);
    },
  };

  // Per-character "voice": short blips while the bubble types.
  function blip(d, w, who, i) {
    const j = ((i * 7919) % 13) / 13;
    if (who === 'change') tone(d, w, 'sine', 700 + j * 160, 0, 0.055, 0.07, 0.004);
    else if (who === 'rabbit') {
      const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 900 + j * 260;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const g = envGain(d, w, 0.035, 0.003, 0.045);
      o.connect(lp); lp.connect(g); o.start(w); o.stop(w + 0.08);
    } else if (who === 'kid') tone(d, w, 'triangle', 820 + j * 200, 0, 0.05, 0.1, 0.004);
    else {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 300 + j * 80;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
      const g = envGain(d, w, 0.08, 0.004, 0.06);
      o.connect(lp); lp.connect(g); o.start(w); o.stop(w + 0.09);
    }
  }

  // ------------------------------------------------------------------ score
  // Theme in C-major pentatonic, [beat, midi, beats].
  const THEME = [
    [0, 76, 0.75], [0.75, 79, 0.25], [1, 81, 0.5], [1.5, 79, 0.5], [2, 76, 0.5], [2.5, 74, 1.5],
    [4, 72, 0.5], [4.5, 74, 0.5], [5, 76, 0.5], [5.5, 79, 0.5], [6, 76, 1], [7, 74, 1],
    [8, 76, 0.75], [8.75, 79, 0.25], [9, 81, 0.5], [9.5, 84, 0.5], [10, 81, 0.5], [10.5, 79, 1.5],
    [12, 81, 0.5], [12.5, 79, 0.5], [13, 76, 0.5], [13.5, 74, 0.5], [14, 72, 2],
  ];
  const BASS = [48, 43, 48, 43, 45, 40, 45, 40, 43, 50, 43, 50, 48, 43, 48, 48];

  function buildEvents() {
    const ev = [];
    const at = (t, fn) => ev.push({ t, fn });
    const P = (t, m, dur, vel) => at(t, (w, d) => pluck(d, w, m, dur, vel));

    // theme helper: plays beats [b0, b1) of the theme starting at t0, cut at tEnd
    function theme(t0, spb, b0, b1, tEnd, opt = {}) {
      const tr = opt.tr || 0, vel = opt.vel || 0.2;
      for (const [b, m, len] of THEME) {
        if (b < b0 || b >= b1) continue;
        const t = t0 + (b - b0) * spb;
        if (t >= tEnd) continue;
        P(t, m + tr, Math.min(len * spb + 0.35, 1.4), vel);
        if (opt.bells) at(t, (w, d) => bell(d, w, m + tr + 12, 0.5, 0.035));
      }
      if (!opt.noBass) {
        for (let b = Math.ceil(b0); b < b1; b++) {
          const t = t0 + (b - b0) * spb;
          if (t >= tEnd) continue;
          at(t, (w, d) => bass(d, w, BASS[b % 16], spb * 0.9, 0.22));
          at(t + spb * 0.5, (w, d) => wood(d, w, b % 2 === 1, 0.08));
          if (b % 4 === 0) at(t, (w, d) => wood(d, w, false, 0.12));
        }
      }
    }

    // --- title
    [84, 88, 91, 93].forEach((m, i) => at(0.2 + i * 0.13, (w, d) => bell(d, w, m, 1.2, 0.09)));
    at(0.15, (w, d) => SFX.pop(d, w, 500, 0.2));
    for (let i = 0; i < 6; i++) at(1.0 + i * 0.09, (w, d) => SFX.pop(d, w, 520 + i * 90, 0.12));
    at(1.25, (w, d) => SFX.gong(d, w, 0.22));
    at(T.enterCE, (w, d) => SFX.shimmer(d, w));
    at(T.enterRB, (w, d) => SFX.boing(d, w, 200, 520, 0.2));
    at(3.05, (w, d) => SFX.boing(d, w, 220, 600, 0.2));
    at(3.4, (w, d) => SFX.boing(d, w, 180, 420, 0.22));

    // --- beat 1: main theme
    theme(3.45, 0.6, 0, 16, 13.2);
    at(4.4, (w, d) => SFX.twinkle(d, w, 0.06));
    at(7.9, (w, d) => SFX.boing(d, w, 260, 480, 0.1));
    at(10.6, (w, d) => SFX.drip(d, w));
    at(T.growl, (w, d) => SFX.growl(d, w));
    at(11.45, (w, d) => SFX.boing(d, w, 300, 200, 0.12));
    at(11.65, (w, d) => SFX.slurp(d, w));
    at(T.ceLeave, (w, d) => SFX.whoosh(d, w, 0.5, true, 0.4));

    // --- beat 2: sneaky plucks, the bite, the fall
    at(T.sparkle, (w, d) => SFX.twinkle(d, w, 0.12));
    [[13.95, 52], [14.25, 55], [14.55, 57], [15.15, 52], [15.45, 55], [15.75, 57], [16.05, 59], [16.2, 60], [16.35, 62], [16.5, 64]].forEach(([t, m]) => P(t, m, 0.25, 0.16));
    at(T.lookL, (w, d) => SFX.swish(d, w)); at(T.lookR, (w, d) => SFX.swish(d, w));
    at(16.6, (w, d) => SFX.slideUp(d, w, 0.7, 0.16));
    at(T.leap, (w, d) => SFX.boing(d, w, 150, 700, 0.25));
    at(T.chomp, (w, d) => SFX.chomp(d, w));
    at(17.53, (w, d) => SFX.tick(d, w));
    at(T.fall, (w, d) => SFX.slideDown(d, w, 0.45));
    at(T.land, (w, d) => SFX.thud(d, w));
    [18.35, 18.65, 18.95].forEach((t) => at(t, (w, d) => SFX.munch(d, w)));
    at(18.4, (w, d) => SFX.twinkle(d, w, 0.07));
    [[18.3, 84], [18.5, 88], [18.7, 91], [18.9, 88]].forEach(([t, m]) => at(t, (w, d) => bell(d, w, m, 0.4, 0.05)));

    // --- earth 1
    for (const c of [T.cut1, T.back1, T.cut2, T.back2]) at(c - 0.16, (w, d) => SFX.whoosh(d, w, 0.32, true, 0.3));
    at(19.75, (w, d) => SFX.ding(d, w, 91, 0.14));
    at(19.75, (w, d) => SFX.boing(d, w, 260, 560, 0.12));
    [20.5, 20.8, 21.1].forEach((t) => at(t, (w, d) => SFX.question(d, w)));
    at(21.0, (w, d) => SFX.notify(d, w));
    theme(19.5, 0.6, 0, 5, 22.4, { tr: 12, vel: 0.12, noBass: true });

    // --- beat 3: return, double take, shock, excuse, awkward silence
    at(T.ceReturn, (w, d) => SFX.shimmer(d, w, 0.1));
    at(23.35, (w, d) => SFX.twinkle(d, w, 0.08));
    [22.9, 23.4, 23.9, 24.35].forEach((t) => at(t, (w, d) => SFX.munch(d, w, 0.1)));
    theme(23.3, 0.6, 0, 3, 24.85, { vel: 0.15 });
    at(T.glance, (w, d) => SFX.pop(d, w, 900, 0.08));
    at(T.snap, (w, d) => SFX.swish(d, w, 0.4));
    at(T.shock, (w, d) => SFX.sting(d, w));
    // guilty heartbeat under 团团's excuse
    [26.75, 26.98, 27.55, 27.78, 28.35].forEach((t, i) => at(t, (w, d) => tone(d, w, 'sine', 62, 48, 0.14, i % 2 ? 0.3 : 0.45, 0.004)));
    at(28.3, (w, d) => SFX.boing(d, w, 300, 180, 0.1));
    at(28.75, (w, d) => SFX.cricket(d, w));
    at(29.1, (w, d) => SFX.cricket(d, w, 0.05));
    at(T.crumb + 0.35, (w, d) => SFX.tick(d, w));
    at(T.gulp, (w, d) => SFX.gulp(d, w));
    at(T.laugh1, (w, d) => SFX.laugh(d, w, 1.5));

    // --- beat 4: panic, the plug
    for (let i = 0; i < 14; i++) {
      const m = [81, 79, 76, 79, 81, 79, 76, 74][i % 8];
      P(T.panic + 0.1 + i * 0.2, m, 0.3, 0.12);
      if (i % 2 === 0) at(T.panic + 0.1 + i * 0.2, (w, d) => wood(d, w, i % 4 === 0, 0.1));
    }
    at(31.35, (w, d) => SFX.question(d, w));
    at(32.05, (w, d) => SFX.ding(d, w, 86, 0.1));
    at(T.squat2, (w, d) => SFX.boing(d, w, 120, 260, 0.14));
    at(T.leap2, (w, d) => SFX.slideUp(d, w, 0.6, 0.2));
    at(T.leap2, (w, d) => SFX.whoosh(d, w, 0.5, true, 0.25));
    at(T.plug, (w, d) => SFX.pop(d, w, 420, 0.4));
    at(T.plug, (w, d) => SFX.boing(d, w, 300, 700, 0.15));
    at(T.plug + 0.35, (w, d) => SFX.ding(d, w, 96, 0.14));
    [72, 76, 79, 84, 88].forEach((m, i) => P(T.plug + 0.1 + i * 0.07, m, 0.8, 0.14));

    // --- earth 2
    theme(34.85, 0.6, 8, 12.5, 37.5, { vel: 0.16, bells: true });
    at(35.55, (w, d) => SFX.cheer(d, w, 1.6));
    [35.7, 36.0, 36.25, 36.6, 36.9, 37.2].forEach((t) => at(t, (w, d) => SFX.shutter(d, w)));
    at(36.1, (w, d) => SFX.notify(d, w));
    [36.3, 36.85].forEach((t) => at(t, (w, d) => SFX.boing(d, w, 240, 560, 0.12)));

    // --- button
    [[37.95, 76, 0.5], [38.55, 74, 0.5], [39.15, 76, 0.4], [39.5, 79, 0.7]].forEach(([t, m, len]) => P(t, m, len, 0.12));
    at(T.shout, (w, d) => SFX.shout(d, w));
    at(T.laugh2, (w, d) => SFX.laugh(d, w, 1.4));

    // --- ending
    at(T.ending, (w, d) => SFX.gong(d, w, 0.3));
    [72, 76, 79, 84].forEach((m, i) => at(T.ending + 0.05 + i * 0.08, (w, d) => bell(d, w, m, 1.2, 0.1)));
    [0, 1, 2, 3].forEach((i) => at(T.ending + 0.3 + i * 0.12, (w, d) => SFX.pop(d, w, 600 + i * 150, 0.15)));
    theme(T.ending + 0.55, 0.5, 0, 4, T.ending + 2.5, { vel: 0.18, bells: true });
    at(T.teaser, (w, d) => SFX.whoosh(d, w, 0.35, true, 0.25));
    at(T.teaser + 0.25, (w, d) => SFX.boing(d, w, 200, 600, 0.2));
    at(T.teaser + 0.3, (w, d) => SFX.bark(d, w));
    [60, 64, 67, 72, 76].forEach((m) => P(43.85, m, 1.4, 0.1));
    at(43.85, (w, d) => bass(d, w, 36, 1.2, 0.25));

    // --- speech bubbles: pop-in + per-character voice blips
    for (const b of TH.BUBBLES) {
      at(b.t0, (w, d) => (b.style === 'shout' ? SFX.pop(d, w, 300, 0.2) : SFX.bubble(d, w)));
      const rt = TH.revealTimes(b);
      let i = 0;
      b.lines.forEach((line, li) => {
        [...line].forEach((ch, ci) => {
          if ('，。！？、…～—'.includes(ch)) return;
          const k = i++;
          at(b.t0 + 0.14 + rt[li][ci], (w, d) => blip(d, w, b.who, k));
        });
      });
    }
    ev.sort((a, b) => a.t - b.t);
    return ev;
  }

  // ------------------------------------------------------------------ transport
  const A = (TH.audio = {
    muted: false,
    available: () => !!(window.AudioContext || window.webkitAudioContext),
    running: () => !!ac && ac.state === 'running',
    time: () => (ac ? ac.currentTime : 0),
    unlock() {
      if (!A.available()) return;
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
        master = ac.createGain(); master.gain.value = A.muted ? 0 : 0.9;
        master.connect(comp); comp.connect(ac.destination);
        noiseBuf = makeNoise();
      }
      if (ac.state === 'suspended') ac.resume();
    },
    playFrom(t, acNow) {
      A.stop();
      if (!ac) return;
      if (!events) events = buildEvents();
      session = ac.createGain(); session.connect(master);
      base = (acNow != null ? acNow : ac.currentTime) - t;
      cursor = 0;
      while (cursor < events.length && events[cursor].t < t - 0.01) cursor++;
      A.pump(t);
    },
    pump(t) {
      if (!session || !events) return;
      const now = ac.currentTime;
      while (cursor < events.length && events[cursor].t <= t + LOOK) {
        const e = events[cursor++];
        const when = base + e.t;
        if (when < now - 0.08) continue;
        try { e.fn(Math.max(now, when), session); } catch (err) { /* a single cue must never stop the show */ }
      }
    },
    stop() {
      if (!session) return;
      const s = session; session = null;
      try { s.gain.setTargetAtTime(0, ac.currentTime, 0.012); } catch (e) { /* ignore */ }
      setTimeout(() => { try { s.disconnect(); } catch (e) { /* ignore */ } }, 150);
    },
    setMuted(m) {
      A.muted = m;
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.02);
    },
    // For offline checks: render the whole soundtrack into a buffer.
    async renderOffline(sr = 22050) {
      const off = new OfflineAudioContext(1, Math.ceil(sr * (TH.DURATION + 1)), sr);
      const saved = ac;
      ac = off;
      noiseBuf = makeNoise();
      const comp = off.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
      const g = off.createGain(); g.gain.value = 0.9; g.connect(comp); comp.connect(off.destination);
      for (const e of buildEvents()) { try { e.fn(e.t, g); } catch (err) { console.warn('cue failed', e.t, err); } }
      const buf = await off.startRendering();
      ac = saved;
      noiseBuf = ac ? makeNoise() : null;
      return buf;
    },
  });
})();

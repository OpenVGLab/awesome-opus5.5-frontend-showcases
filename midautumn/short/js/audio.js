'use strict';
// Soundtrack, synthesised with Web Audio on the film's clock: a guzheng-like plucked string (Karplus-Strong),
// a sheng-like reed pad, a bamboo flute, bells, a wood block for the Jade Rabbit, and paper / train / firework / brush
// effects. The score is a flat event list; live playback schedules it just ahead of the clock, the export renders it
// offline with OfflineAudioContext.
(function () {
  const MA = window.MA;
  const Au = (MA.audio = {});
  const BEAT = 0.75;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // D major pentatonic, the open strings of a guzheng: D3 .. D6
  const STRINGS = [50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86];

  const CHORDS = {
    D: { bass: 38, pad: [50, 57, 62, 66, 69], arp: [50, 57, 62, 66, 69, 66, 62, 57] },
    Bm: { bass: 35, pad: [47, 54, 59, 62, 66], arp: [47, 54, 59, 62, 66, 62, 59, 54] },
    G: { bass: 43, pad: [50, 55, 59, 62, 66], arp: [50, 57, 59, 62, 64, 62, 59, 57] },
    A: { bass: 45, pad: [52, 57, 59, 64, 69], arp: [45, 52, 57, 59, 64, 59, 57, 52] },
    Em: { bass: 40, pad: [52, 59, 62, 66, 71], arp: [52, 59, 64, 66, 71, 66, 64, 59] },
  };
  // [beat offset, midi, length in beats]
  const THEME_A = [[0, 78, 1.5], [1.5, 76, 0.5], [2, 74, 1], [3, 71, 1], [4, 69, 1.5], [5.5, 71, 0.5], [6, 74, 2]];
  const THEME_B = [[0, 76, 1], [1, 78, 0.5], [1.5, 81, 0.5], [2, 78, 1], [3, 76, 1], [4, 74, 1], [5, 71, 1], [6, 69, 2]];

  // ---------------- the score ----------------
  function buildScore() {
    const S = MA.scenes;
    const ev = [];
    const R = MA.rng(2026);
    const add = (e) => { ev.push(e); return e; };
    const pluck = (t, m, v, o = {}) => add(Object.assign({ t, d: 3, kind: 'pluck', m, v, pan: 0 }, o));
    const theme = (t0, notes, v, o = {}) => notes.forEach(([b, m, len], i) => {
      const t = t0 + b * BEAT;
      if (o.inst === 'flute') add({ t, d: len * BEAT * 0.96, kind: 'flute', m: m + (o.oct || 0), v: v * (i === 0 ? 1.05 : 1), pan: o.pan || 0 });
      else pluck(t, m + (o.oct || 0), v * (len >= 1.5 ? 1.08 : 1), { vib: len >= 1.5 ? 16 : len >= 1 ? 8 : 0, slide: o.slides && len >= 1.5 && i > 0 ? -2 : 0, pan: o.pan || 0 });
    });
    const gliss = (t, i0, i1, dur, v, o = {}) => {
      const n = Math.abs(i1 - i0);
      for (let k = 0; k <= n; k++) {
        const idx = i0 + Math.sign(i1 - i0) * k;
        pluck(t + (k / n) * dur, STRINGS[idx], v * (0.55 + 0.45 * (k / n)) * (0.85 + R() * 0.3), { pan: (idx / 15 - 0.5) * 0.6, d: 2 });
      }
    };
    const tremolo = (t, m, dur, v) => { for (let k = 0; t + k * 0.068 < t + dur; k++) pluck(t + k * 0.068, m, v * (1 - (k * 0.068) / dur * 0.8) * (0.75 + R() * 0.25), { d: 1.2 }); };
    const chord = (t, d, name, v, o = {}) => {
      const c = CHORDS[name];
      add({ t, d, kind: 'pad', ms: c.pad, bass: c.bass, v, a: o.a ?? 0.9, r: o.r ?? 0.9, long: true, lp: o.lp || 1500 });
    };
    const arps = (t0, t1, name, v, step = BEAT / 2, o = {}) => {
      const c = CHORDS[name];
      let k = 0;
      for (let t = t0; t < t1 - 0.05; t += step, k++) pluck(t, c.arp[k % c.arp.length] + (o.oct || 0), v * (k % 4 === 0 ? 1.15 : 0.9) * (0.9 + R() * 0.2), { pan: ((k % 8) / 7 - 0.5) * 0.5, d: 2.2 });
    };
    const tap = (t, v = 0.3, o = {}) => add(Object.assign({ t, d: 0.2, kind: 'tap', v, f: 1400, pan: 0 }, o));
    const swish = (t, d, v, f0, f1, o = {}) => add(Object.assign({ t, d, kind: 'swish', v, f0, f1, pan: 0 }, o));
    const bell = (t, m, v, o = {}) => add(Object.assign({ t, d: 2.5, kind: 'bell', m, v, pan: 0 }, o));

    // 1 · 深夜 (0–9): city hum, the title slip, typing, the clock, a message from Mom
    add({ t: 0, d: 9.3, kind: 'hum', v: 0.22, long: true });
    chord(0.4, 8.8, 'Bm', 0.05, { a: 2.5, r: 1.2, lp: 900 });
    swish(0.3, 0.8, 0.22, 600, 2600, { pan: -0.4 });
    tap(1.15, 0.22, { pan: -0.4 });
    pluck(1.3, 71, 0.26, { vib: 18 }); pluck(2.7, 69, 0.2, { vib: 10 }); pluck(3.4, 66, 0.24, { vib: 18, slide: -2 });
    swish(2.3, 2.6, 0.1, 200, 900, { q: 0.5 });
    swish(3.5, 0.7, 0.16, 2600, 700, { pan: -0.4 });
    swish(4.15, 0.75, 0.24, 500, 2200);
    tap(4.95, 0.32, { f: 900 });
    for (let t = 5.0; t < 8.9; t += 1) add({ t, d: 0.05, kind: 'click', v: 0.07, f: 3600, pan: -0.55 });
    for (let t = 5.1; t < 6.4; t += 0.07 + R() * 0.1) add({ t, d: 0.03, kind: 'click', v: 0.05 + R() * 0.05, f: 2200 + R() * 1400, pan: 0.15 });
    add({ t: 6.2, d: 0.7, kind: 'buzz', v: 0.16, pan: 0.3 });
    bell(6.32, 88, 0.12, { glass: true, pan: 0.3 }); bell(6.42, 95, 0.1, { glass: true, pan: 0.3 });
    pluck(7.2, 62, 0.2, { vib: 10 }); pluck(7.55, 64, 0.2); pluck(7.9, 66, 0.22); pluck(8.3, 71, 0.26, { vib: 16 });

    // 2 · 望月 (9–15): paper tears open, the camera cranes up, a glissando lands on the theme as the moon appears
    add({ t: 8.55, d: 0.8, kind: 'tear', v: 0.34 });
    chord(8.9, 6.4, 'G', 0.075, { a: 2.2, r: 0.8 });
    swish(9.2, 2.2, 0.08, 300, 1200, { q: 0.5 });
    gliss(10.62, 3, 12, 0.6, 0.3);
    theme(11.25, THEME_A, 0.34, { slides: true });
    bell(11.25, 74, 0.08, { d: 4 });
    for (let i = 0; i < 8; i++) bell(13.95 + i * 0.12, STRINGS[8 + (i % 8)] + 12, 0.035 + i * 0.006, { d: 1.5, pan: (i % 2 ? 0.4 : -0.4) });
    add({ t: 14.1, d: 1.1, kind: 'whoosh', v: 0.2, f0: 300, f1: 3000 });

    // 3 · 故乡 (15–24): a warmer memory, arpeggios, crickets, wind chimes, the theme's second half
    add({ t: 15.0, d: 9.2, kind: 'crickets', v: 0.05, long: true });
    chord(15.0, 3.1, 'D', 0.07, { a: 0.6 }); chord(18.0, 3.1, 'Bm', 0.07, { a: 0.5 }); chord(21.0, 1.6, 'G', 0.07, { a: 0.4 }); chord(22.5, 1.9, 'A', 0.07, { a: 0.4, r: 0.6 });
    arps(15.0, 18.0, 'D', 0.13); arps(18.0, 21.0, 'Bm', 0.13); arps(21.0, 22.5, 'G', 0.13); arps(22.5, 23.4, 'A', 0.12);
    pluck(15.0, 38 + 12, 0.3, { vib: 6 }); pluck(18.0, 47, 0.28); pluck(21.0, 50, 0.26); pluck(22.5, 45 + 12, 0.26);
    theme(17.25, THEME_B, 0.33, { slides: true });
    for (let i = 0; i < 9; i++) bell(15.6 + i * 0.9 + R() * 0.5, [86, 88, 90, 93, 95, 98][Math.floor(R() * 6)], 0.03 + R() * 0.03, { d: 2.2, pan: R() - 0.5 });
    for (let t = 16.2; t < 23.2; t += 0.25) tap(t, 0.035, { f: 700, pan: -0.6 + ((t - 16) / 7.3) * 1.2 });
    swish(S.home.CAP_T[0], 0.45, 0.14, 700, 2200, { pan: -0.5 });
    [...S.home.CAPTION.join('')].forEach((ch, i) => add({ t: S.home.CAP_T[0] + 0.35 + i * 0.085, d: 0.03, kind: 'click', v: 0.035, f: 2800, pan: -0.5 }));
    swish(23.35, 0.5, 0.26, 700, 3200); tap(23.88, 0.24); swish(23.9, 0.5, 0.22, 3200, 800);

    // 4 · 传说 (24–33): a soft gong, flute over a drone, the rabbit's pestle on every beat, the ticket punched
    add({ t: 24.15, d: 4, kind: 'gong', v: 0.085, f: 196 });
    chord(24.0, 3.1, 'Em', 0.07, { a: 0.8 }); chord(27.0, 3.1, 'A', 0.07, { a: 0.6 }); chord(30.0, 3.1, 'Em', 0.07, { a: 0.6, r: 0.5 });
    for (let t = 24.0; t < 32.8; t += BEAT) { const c = t < 27 ? 'Em' : t < 30 ? 'A' : 'Em'; const k = Math.round((t - 24) / BEAT); pluck(t, CHORDS[c].arp[(k * 3) % 8] + 12, 0.1, { pan: (k % 2 ? 0.3 : -0.3), d: 2 }); }
    bell(24.6, 86, 0.06, { d: 2 }); bell(24.95, 93, 0.05, { d: 2 });
    pluck(24.95, 69, 0.2, { slide: -3 });
    for (let k = 0; S.legend.BEAT0 + k * S.legend.BEAT < 32.6; k++) add({ t: S.legend.BEAT0 + k * S.legend.BEAT, d: 0.2, kind: 'wood', v: 0.24, f: 760, pan: -0.25 });
    theme(S.legend.BEAT0, THEME_A, 0.2, { inst: 'flute', pan: 0.15 });
    [[31.5, 76], [31.875, 78], [32.25, 81], [32.625, 83]].forEach(([t, m], i) => add({ t, d: i === 3 ? 1.1 : 0.36, kind: 'flute', m, v: 0.18, pan: 0.15 }));
    for (let i = 0; i < 6; i++) bell(25.2 + i * 1.2, 90 + (i % 3) * 3, 0.03, { d: 2, pan: 0.5 });
    swish(32.0, 0.55, 0.26, 500, 2800, { pan: 0.4 });
    add({ t: 32.75, d: 0.1, kind: 'click', v: 0.4, f: 1800 }); tap(32.76, 0.25, { f: 600 });
    swish(32.85, 0.6, 0.24, 2600, 600, { pan: 0.5 });
    swish(33.05, 0.55, 0.2, 800, 2600, { pan: -0.4 });

    // 5 · 归途 (33–39): train rhythm, a driving ostinato, her reply to Mom
    add({ t: 33.0, d: 5.7, kind: 'rumble', v: 0.2, long: true });
    for (let t = 33.0; t < 38.4; t += BEAT) { add({ t, d: 0.1, kind: 'clack', v: 0.17 }); add({ t: t + 0.14, d: 0.1, kind: 'clack', v: 0.11 }); }
    chord(33.0, 3.1, 'G', 0.07, { a: 0.5 }); chord(36.0, 3.0, 'A', 0.07, { a: 0.4, r: 0.6 });
    arps(33.0, 36.0, 'G', 0.14, BEAT / 2, { oct: 12 }); arps(36.0, 38.4, 'A', 0.14, BEAT / 2, { oct: 12 });
    pluck(33.0, 55, 0.24); pluck(36.0, 57, 0.24);
    theme(33.75, THEME_B, 0.19, { inst: 'flute', pan: -0.1 });
    swish(34.9, 0.25, 0.14, 1200, 3200, { pan: -0.2 }); bell(35.12, 93, 0.07, { glass: true, pan: -0.2 });
    bell(36.22, 100, 0.05, { glass: true, pan: -0.2 });
    add({ t: 38.3, d: 1.0, kind: 'whoosh', v: 0.2, f0: 400, f1: 2600 });

    // 6 · 团圆 (39–46.75): the table, the family, the theme in full, the mooncake shared, a toast
    gliss(38.85, 2, 13, 0.5, 0.28);
    chord(39.0, 3.1, 'D', 0.1, { a: 0.4 }); chord(42.0, 1.6, 'Bm', 0.1, { a: 0.3 }); chord(43.5, 1.6, 'G', 0.1, { a: 0.3 }); chord(45.0, 2.2, 'A', 0.1, { a: 0.3, r: 0.8 });
    arps(39.4, 42.0, 'D', 0.17); arps(42.0, 43.5, 'Bm', 0.17); arps(43.5, 45.0, 'G', 0.17); arps(45.0, 46.7, 'A', 0.17);
    for (let t = 39.4; t < 46.6; t += BEAT * 2) { const c = t < 42 ? 'D' : t < 43.5 ? 'Bm' : t < 45 ? 'G' : 'A'; pluck(t, CHORDS[c].bass + 12, 0.3, { vib: 6, d: 2 }); }
    [[41.25, 74, 3.0], [44.25, 69, 1.5], [45.75, 71, 1.0]].forEach(([t, m, d]) => add({ t, d, kind: 'flute', m, v: 0.12, pan: -0.2 }));
    for (let i = 0; i < 5; i++) tap(39.0 + i * 0.07 + 0.3, 0.1, { f: 2400, pan: (i - 2) * 0.2 });
    for (const s of [39.42, 39.62, 39.78, 39.95, 40.1]) tap(s, 0.22, { f: 1100, pan: R() - 0.5 });
    swish(40.35, 0.7, 0.2, 400, 1800, { pan: 0 });
    tap(41.05, 0.34, { f: 900 }); bell(41.1, 81, 0.09, { d: 3 });
    theme(41.25, THEME_A, 0.42, { slides: true });
    for (let k = 0; k < 3; k++) { swish(41.35 + k * 0.2, 0.14, 0.12, 2000, 4000); bell(41.46 + k * 0.2, 100, 0.03, { glass: true }); }
    add({ t: 41.97, d: 0.1, kind: 'click', v: 0.12, f: 1200 });
    for (let k = 0; k < 6; k++) { swish(S.reunion.SHARE + k * 0.09, 0.45, 0.07, 700, 2400, { pan: Math.cos(((30 + k * 60) * Math.PI) / 180) * 0.6 }); tap(S.reunion.SHARE + 0.6 + k * 0.09, 0.08, { f: 1600 }); }
    for (let k = 0; k < 6; k++) bell(S.reunion.TOAST[1] + k * 0.012, 96 + (k % 3) * 2, 0.07, { glass: true, pan: (k / 5 - 0.5) * 0.8 });
    bell(S.reunion.TOAST[1] + 0.05, 86, 0.08, { d: 3 });
    add({ t: S.reunion.FLASH - 0.02, d: 0.2, kind: 'shutter', v: 0.3 });

    // 7 · 中秋快乐 (46.75–59.5): layers stack in, a lantern let go, fireworks, the brush, the seal
    for (const [i, t] of [47.05, 47.15, 47.3, 47.42, 47.55].entries()) tap(t, 0.16 + i * 0.03, { f: 1000 + i * 200, pan: (i - 2) * 0.15 });
    add({ t: 47.0, d: 6.4, kind: 'water', v: 0.12, long: true });
    chord(46.8, 3.8, 'G', 0.075, { a: 0.8 }); chord(50.5, 2.9, 'D', 0.075, { a: 0.6 }); chord(53.3, 2.1, 'Bm', 0.08, { a: 0.6 }); chord(55.3, 2.2, 'A', 0.08, { a: 0.6, r: 0.5 });
    arps(47.25, 50.5, 'G', 0.1, BEAT / 2); arps(50.5, 53.2, 'D', 0.1, BEAT / 2);
    theme(48.0, THEME_B, 0.2, { inst: 'flute', pan: 0.1 });
    add({ t: S.wish.RELEASE - 0.05, d: 1.4, kind: 'whoosh', v: 0.12, f0: 200, f1: 900 });
    bell(S.wish.RELEASE, 81, 0.06, { d: 3 });
    for (const [ft, fx] of S.wish.FIREWORKS) {
      const pan = (fx - 0.5) * 1.2;
      add({ t: ft - 0.55, d: 0.55, kind: 'whistle', v: 0.035, pan });
      add({ t: ft, d: 1.2, kind: 'boom', v: 0.3, pan });
      add({ t: ft + 0.12, d: 1.0, kind: 'crackle', v: 0.1, pan });
    }
    for (let i = 0; i < 10; i++) bell(S.wish.TILT[0] + i * 0.18, STRINGS[5 + i] + 12, 0.028 + i * 0.003, { d: 2, pan: (i % 2 ? 0.35 : -0.35) });
    add({ t: S.wish.TILT[0], d: 1.9, kind: 'whoosh', v: 0.09, f0: 250, f1: 1600 });
    swish(S.wish.PAPER[0], 0.6, 0.28, 400, 2400, { pan: -0.4 }); tap(S.wish.PAPER[1] - 0.05, 0.22, { f: 900 });
    for (const s of S.wish.strokes) add({ t: s.t0, d: Math.max(0.08, s.t1 - s.t0), kind: 'brush', v: 0.11, pan: (s.ci - 1.5) * 0.18 });
    [[53.25, 78, 1.1], [54.4, 76, 0.4], [54.8, 74, 0.7], [55.5, 71, 0.75], [56.25, 69, 1.1]].forEach(([t, m, l]) => pluck(t, m, 0.28, { vib: l > 0.8 ? 16 : 6 }));
    [[53.3, 47], [54.8, 54], [55.3, 45], [56.25, 52]].forEach(([t, m]) => pluck(t, m, 0.2, { d: 2 }));
    gliss(S.wish.SEAL - 0.34, 0, 15, 0.32, 0.3);
    add({ t: S.wish.SEAL, d: 0.5, kind: 'thump', v: 0.5 });
    add({ t: S.wish.SEAL, d: 2.1, kind: 'pad', ms: CHORDS.D.pad.concat([74]), bass: 38, v: 0.09, a: 0.08, r: 1.6, long: true, lp: 1800 });
    pluck(S.wish.SEAL, 38 + 12, 0.36, { vib: 6 }); pluck(S.wish.SEAL + 0.02, 62, 0.28);
    tremolo(S.wish.SEAL + 0.05, 74, 1.4, 0.2);
    bell(S.wish.SEAL + 0.02, 74, 0.1, { d: 4 }); bell(S.wish.SEAL + 0.3, 86, 0.05, { d: 3 });
    for (let i = 0; i < 4; i++) add({ t: S.wish.INSCRIBE[0] + i * 0.11, d: 0.08, kind: 'brush', v: 0.05, pan: -0.4 });
    return ev.sort((a, b) => a.t - b.t);
  }

  // ---------------- instruments ----------------
  const cache = new WeakMap();
  function bank(ctx) {
    let b = cache.get(ctx);
    if (b) return b;
    b = { ks: new Map() };
    const sr = ctx.sampleRate;
    const n = Math.floor(sr * 3);
    b.noise = ctx.createBuffer(1, n, sr);
    const d = b.noise.getChannelData(0);
    const R = MA.rng(77);
    for (let i = 0; i < n; i++) d[i] = R() * 2 - 1;
    b.reed = ctx.createPeriodicWave(new Float32Array(12), Float32Array.from([0, 1, 0.55, 0.42, 0.3, 0.22, 0.15, 0.1, 0.07, 0.05, 0.03, 0.02]));
    b.fluteW = ctx.createPeriodicWave(new Float32Array(7), Float32Array.from([0, 1, 0.3, 0.12, 0.06, 0.03, 0.015]));
    b.ir = makeIR(ctx);
    cache.set(ctx, b);
    return b;
  }

  function makeIR(ctx) {
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.8);
    const ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      const R = MA.rng(900 + ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const k = 0.2 + 0.72 * Math.min(1, t / 2.2);
        lp += (R() * 2 - 1 - lp) * (1 - k);
        d[i] = t < 0.015 ? 0 : lp * Math.exp(-t / 0.6) * (1 + k);
      }
    }
    return ir;
  }

  // Karplus-Strong plucked string with a fractional-delay allpass for tuning and a pick-position comb.
  function ksBuffer(ctx, m) {
    const sr = ctx.sampleRate, f = mtof(m);
    const t60 = Math.min(4.8, 1.3 + 320 / f);
    const n = Math.floor(sr * Math.min(4.2, t60 * 0.95));
    const buf = ctx.createBuffer(1, n, sr);
    const out = buf.getChannelData(0);
    const P = sr / f;
    const N = Math.max(2, Math.floor(P - 0.5 - 0.1));
    const dfrac = P - 0.5 - N;
    const C = (1 - dfrac) / (1 + dfrac);
    const R = MA.rng(1000 + m);
    const raw = new Float32Array(N), line = new Float32Array(N);
    for (let i = 0; i < N; i++) raw[i] = R() * 2 - 1;
    const beta = Math.max(1, Math.round(N * 0.12));
    let lp = 0, mean = 0;
    const bright = Math.min(0.85, 0.45 + 180 / f);
    for (let i = 0; i < N; i++) { const v = raw[i] - (i >= beta ? raw[i - beta] : 0); lp += (v - lp) * bright; line[i] = lp; mean += lp; }
    mean /= N;
    for (let i = 0; i < N; i++) line[i] -= mean;
    const rho = Math.min(0.99995, Math.pow(0.001, 1 / (t60 * f)) / Math.cos((Math.PI * f) / sr));
    let idx = 0, prev = 0, apX = 0, apY = 0, peak = 0;
    for (let i = 0; i < n; i++) {
      const cur = line[idx];
      const avg = 0.5 * (cur + prev);
      prev = cur;
      const y = C * avg + apX - C * apY;
      apX = avg; apY = y;
      line[idx] = y * rho;
      idx = idx + 1 === N ? 0 : idx + 1;
      out[i] = cur;
      const a = Math.abs(cur); if (a > peak) peak = a;
    }
    // fingernail pick noise on the attack, then normalise and fade the tail
    const nk = Math.floor(sr * 0.012);
    for (let i = 0; i < nk; i++) out[i] += (R() * 2 - 1) * 0.25 * peak * Math.exp(-i / (sr * 0.0025));
    const g = 0.9 / (peak || 1);
    const fade = Math.floor(sr * 0.25);
    for (let i = 0; i < n; i++) out[i] *= g * (i > n - fade ? (n - i) / fade : 1);
    return buf;
  }

  function envelope(param, when, off, pts) {
    let v0 = pts[pts.length - 1][1];
    for (let i = 0; i < pts.length - 1; i++) {
      if (off <= pts[i + 1][0]) { const a = pts[i], b = pts[i + 1]; v0 = a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, (off - a[0]) / Math.max(1e-6, b[0] - a[0]))); break; }
    }
    param.setValueAtTime(v0, when);
    for (const [tt, v] of pts) if (tt > off) param.linearRampToValueAtTime(v, when + tt - off);
  }

  function noise(S, when, dur, off = 0) {
    const s = S.ctx.createBufferSource();
    s.buffer = S.bank.noise;
    s.loop = true;
    s.start(when, (S.nseed = (S.nseed + 0.7317) % 2.5) + (off % 0.4));
    s.stop(when + dur + 0.05);
    S.track(s);
    return s;
  }
  function panner(S, p, dest) { const n = S.ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p || 0)); n.connect(dest); return n; }
  function filt(ctx, type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; }
  function osc(S, type, f, when, stop) { const o = S.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(when); o.stop(stop); S.track(o); return o; }
  function gain(ctx, v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function burst(S, when, dur, v, type, f, q, dest) {
    const ctx = S.ctx;
    const g = gain(ctx);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(v, when + 0.002); g.gain.setTargetAtTime(0, when + 0.002, dur / 3);
    noise(S, when, dur * 2).connect(filt(ctx, type, f, q)).connect(g).connect(dest);
  }

  const INST = {
    pluck(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx;
      if (!S.bank.ks.has(e.m)) S.bank.ks.set(e.m, ksBuffer(ctx, e.m));
      const src = ctx.createBufferSource();
      src.buffer = S.bank.ks.get(e.m);
      const dur = Math.min(src.buffer.duration, e.d || 9);
      const g = gain(ctx, e.v);
      if (e.d && e.d < src.buffer.duration) { g.gain.setValueAtTime(e.v, when + dur - 0.3); g.gain.linearRampToValueAtTime(0, when + dur); }
      src.connect(g).connect(panner(S, e.pan, S.pluckBus));
      if (e.slide) { src.detune.setValueAtTime(e.slide * 100, when); src.detune.linearRampToValueAtTime(0, when + 0.13); }
      if (e.vib) {
        const lfo = osc(S, 'sine', 5.4, when, when + dur);
        const lg = gain(ctx);
        lg.gain.setValueAtTime(0, when); lg.gain.linearRampToValueAtTime(0, when + 0.28); lg.gain.linearRampToValueAtTime(e.vib, when + 0.7);
        lfo.connect(lg).connect(src.detune);
      }
      src.start(when);
      src.stop(when + dur);
      S.track(src);
    },
    pad(S, when, off, e) {
      const ctx = S.ctx;
      const g = gain(ctx);
      envelope(g.gain, when, off, [[0, 0], [e.a, e.v], [Math.max(e.a, e.d - e.r), e.v], [e.d, 0]]);
      const lp = filt(ctx, 'lowpass', e.lp || 1500, 0.4);
      lp.connect(g).connect(S.music);
      const stop = when + e.d - off + 0.05;
      e.ms.forEach((m, i) => {
        for (const dt of [-6, 5]) {
          const o = osc(S, 'sine', mtof(m), when, stop);
          o.setPeriodicWave(S.bank.reed);
          o.detune.value = dt + i * 0.7;
          const og = gain(ctx, 0.5 / e.ms.length);
          o.connect(og).connect(lp);
        }
      });
      if (e.bass) {
        const o = osc(S, 'triangle', mtof(e.bass), when, stop);
        o.connect(gain(ctx, 0.55)).connect(lp);
      }
    },
    flute(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx, f = mtof(e.m), d = e.d;
      const out = panner(S, e.pan, S.music);
      const o = osc(S, 'sine', f, when, when + d + 0.25);
      o.setPeriodicWave(S.bank.fluteW);
      o.detune.setValueAtTime(-45, when); o.detune.linearRampToValueAtTime(0, when + 0.07);
      const lfo = osc(S, 'sine', 5.3, when, when + d + 0.25);
      const lg = gain(ctx);
      lg.gain.setValueAtTime(0, when); lg.gain.linearRampToValueAtTime(0, when + Math.min(0.25, d * 0.4)); lg.gain.linearRampToValueAtTime(14, when + Math.min(0.6, d * 0.9));
      lfo.connect(lg).connect(o.detune);
      const g = gain(ctx);
      envelope(g.gain, when, 0, [[0, 0], [0.06, e.v], [0.2, e.v * 0.82], [Math.max(0.21, d - 0.08), e.v * 0.76], [d + 0.16, 0]]);
      o.connect(g).connect(out);
      const ng = gain(ctx);
      envelope(ng.gain, when, 0, [[0, 0], [0.03, e.v * 0.45], [0.14, e.v * 0.1], [d, e.v * 0.08], [d + 0.12, 0]]);
      noise(S, when, d + 0.2).connect(filt(ctx, 'bandpass', f * 2, 1.4)).connect(ng).connect(out);
    },
    bell(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx, f = mtof(e.m), D = e.d || 2.4;
      const out = panner(S, e.pan, S.music);
      const parts = e.glass ? [[1, 1, 0.5], [2.32, 0.45, 0.3], [4.25, 0.3, 0.15], [6.8, 0.15, 0.08]] : [[1, 1, D], [2.0, 0.42, D * 0.6], [2.76, 0.32, D * 0.45], [5.4, 0.16, D * 0.25], [8.9, 0.07, D * 0.12]];
      for (const [r, a, dec] of parts) {
        if (f * r > 16000) continue;
        const o = osc(S, 'sine', f * r, when, when + dec + 0.1);
        const g = gain(ctx);
        g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(e.v * a, when + 0.004); g.gain.setTargetAtTime(0, when + 0.004, dec / 4.6);
        o.connect(g).connect(out);
      }
    },
    gong(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx, f = e.f || 196;
      const out = panner(S, 0, S.music);
      for (const [r, a, dec] of [[1, 1, 3.5], [1.47, 0.5, 2.5], [2.09, 0.35, 1.8], [2.76, 0.22, 1.2], [3.9, 0.1, 0.8]]) {
        const o = osc(S, 'sine', f * r, when, when + dec + 0.1);
        o.frequency.setValueAtTime(f * r * 1.02, when); o.frequency.exponentialRampToValueAtTime(f * r * 0.985, when + dec);
        const g = gain(ctx);
        g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(e.v * a, when + 0.02); g.gain.setTargetAtTime(0, when + 0.02, dec / 4);
        o.connect(g).connect(out);
      }
      burst(S, when, 0.4, e.v * 0.25, 'bandpass', 2500, 0.6, out);
    },
    wood(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx, f = e.f || 800;
      const out = panner(S, e.pan, S.sfx);
      for (const [r, a, dec] of [[1, 1, 0.07], [2.62, 0.35, 0.03]]) {
        const o = osc(S, 'sine', f * r, when, when + 0.3);
        o.frequency.setValueAtTime(f * r * 1.3, when); o.frequency.exponentialRampToValueAtTime(f * r, when + 0.015);
        const g = gain(ctx);
        g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(e.v * a, when + 0.002); g.gain.setTargetAtTime(0, when + 0.002, dec / 3);
        o.connect(g).connect(out);
      }
      burst(S, when, 0.012, e.v * 0.5, 'highpass', 2500, 0.7, out);
    },
    tap(S, when, off, e) {
      if (off > 0.05) return;
      const out = panner(S, e.pan, S.sfx);
      burst(S, when, 0.05, e.v, 'lowpass', e.f || 1400, 0.7, out);
      const o = osc(S, 'sine', 110, when, when + 0.15);
      o.frequency.setValueAtTime(150, when); o.frequency.exponentialRampToValueAtTime(70, when + 0.08);
      const g = gain(S.ctx);
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(e.v * 0.6, when + 0.003); g.gain.setTargetAtTime(0, when + 0.003, 0.025);
      o.connect(g).connect(out);
    },
    click(S, when, off, e) {
      if (off > 0.05) return;
      burst(S, when, 0.008, e.v, 'bandpass', e.f || 3000, 1.2, panner(S, e.pan, S.sfx));
    },
    swish(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx;
      const bp = filt(ctx, 'bandpass', e.f0, e.q || 0.9);
      bp.frequency.setValueAtTime(e.f0, when); bp.frequency.exponentialRampToValueAtTime(e.f1, when + e.d);
      const g = gain(ctx);
      envelope(g.gain, when, 0, [[0, 0], [e.d * 0.35, e.v], [e.d, 0]]);
      noise(S, when, e.d).connect(bp).connect(g).connect(panner(S, e.pan, S.sfx));
    },
    whoosh(S, when, off, e) {
      if (off > 0.05) return;
      INST.swish(S, when, 0, { d: e.d, v: e.v, f0: e.f0, f1: e.f1, q: 0.5, pan: 0 });
      const o = osc(S, 'sine', mtof(74), when, when + e.d + 0.1);
      o.frequency.exponentialRampToValueAtTime(mtof(86), when + e.d);
      const g = gain(S.ctx);
      envelope(g.gain, when, 0, [[0, 0], [e.d * 0.7, e.v * 0.12], [e.d, 0]]);
      o.connect(g).connect(S.music);
    },
    tear(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx;
      const R = MA.rng(313);
      for (const [f, q, a] of [[2400, 0.8, 1], [800, 1.2, 0.6]]) {
        const g = gain(ctx);
        g.gain.setValueAtTime(0, when);
        for (let k = 0, t = 0; t < e.d; k++, t += 0.008 + R() * 0.014) {
          const env = Math.sin(Math.PI * Math.min(1, t / e.d)) ** 0.5;
          g.gain.setValueAtTime(e.v * a * env * (R() < 0.25 ? 0.15 : 0.4 + R() * 0.6), when + t);
        }
        g.gain.setValueAtTime(0, when + e.d);
        noise(S, when, e.d).connect(filt(ctx, 'bandpass', f, q)).connect(g).connect(panner(S, 0, S.sfx));
      }
    },
    buzz(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx;
      const o = osc(S, 'square', 150, when, when + e.d);
      const g = gain(ctx);
      g.gain.setValueAtTime(0, when);
      for (let t = 0; t < e.d; t += 0.23) { g.gain.setValueAtTime(e.v, when + t); g.gain.setValueAtTime(0, when + t + 0.15); }
      o.connect(filt(ctx, 'lowpass', 420, 2)).connect(g).connect(panner(S, e.pan, S.sfx));
    },
    shutter(S, when, off, e) {
      if (off > 0.05) return;
      const out = panner(S, 0, S.sfx);
      burst(S, when, 0.01, e.v, 'bandpass', 4200, 1.5, out);
      burst(S, when + 0.07, 0.014, e.v * 0.8, 'bandpass', 2600, 1.2, out);
      burst(S, when + 0.02, 0.06, e.v * 0.25, 'lowpass', 700, 0.7, out);
    },
    thump(S, when, off, e) {
      if (off > 0.05) return;
      const out = panner(S, 0, S.sfx);
      const o = osc(S, 'sine', 90, when, when + 0.5);
      o.frequency.setValueAtTime(120, when); o.frequency.exponentialRampToValueAtTime(52, when + 0.18);
      const g = gain(S.ctx);
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(e.v, when + 0.004); g.gain.setTargetAtTime(0, when + 0.004, 0.07);
      o.connect(g).connect(out);
      burst(S, when, 0.04, e.v * 0.4, 'lowpass', 900, 0.7, out);
    },
    brush(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx;
      const g = gain(ctx);
      const R = MA.rng(Math.floor(when * 1000));
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(e.v, when + Math.min(0.03, e.d * 0.3));
      for (let t = 0.04; t < e.d - 0.03; t += 0.025) g.gain.linearRampToValueAtTime(e.v * (0.6 + R() * 0.5), when + t);
      g.gain.linearRampToValueAtTime(0, when + e.d + 0.05);
      noise(S, when, e.d + 0.1).connect(filt(ctx, 'bandpass', 1900, 0.6)).connect(filt(ctx, 'highpass', 700, 0.7)).connect(g).connect(panner(S, e.pan, S.sfx));
    },
    whistle(S, when, off, e) {
      if (off > 0.05) return;
      const o = osc(S, 'sine', 800, when, when + e.d + 0.05);
      o.frequency.exponentialRampToValueAtTime(1900, when + e.d);
      const g = gain(S.ctx);
      envelope(g.gain, when, 0, [[0, 0], [0.05, e.v], [e.d, e.v * 0.6], [e.d + 0.04, 0]]);
      o.connect(g).connect(panner(S, e.pan, S.sfx));
    },
    boom(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx;
      const out = panner(S, e.pan, S.music);
      const g = gain(ctx);
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(e.v, when + 0.01); g.gain.setTargetAtTime(0, when + 0.01, 0.28);
      noise(S, when, e.d).connect(filt(ctx, 'lowpass', 380, 0.8)).connect(g).connect(out);
      const o = osc(S, 'sine', 62, when, when + 0.6);
      o.frequency.exponentialRampToValueAtTime(38, when + 0.5);
      const og = gain(ctx);
      og.gain.setValueAtTime(0, when); og.gain.linearRampToValueAtTime(e.v * 0.8, when + 0.01); og.gain.setTargetAtTime(0, when + 0.01, 0.12);
      o.connect(og).connect(out);
    },
    crackle(S, when, off, e) {
      if (off > 0.05) return;
      const ctx = S.ctx;
      const R = MA.rng(Math.floor(when * 997));
      const g = gain(ctx);
      g.gain.setValueAtTime(0, when);
      for (let t = 0; t < e.d; t += 0.01 + R() * 0.05) {
        const a = e.v * (1 - t / e.d) * (0.4 + R() * 0.6);
        g.gain.setValueAtTime(a, when + t); g.gain.setValueAtTime(0, when + t + 0.004);
      }
      noise(S, when, e.d).connect(filt(ctx, 'highpass', 2500, 0.7)).connect(g).connect(panner(S, e.pan, S.music));
    },
    clack(S, when, off, e) {
      if (off > 0.05) return;
      const out = panner(S, 0, S.sfx);
      burst(S, when, 0.03, e.v, 'bandpass', 900, 1.4, out);
      const o = osc(S, 'sine', 140, when, when + 0.12);
      const g = gain(S.ctx);
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(e.v * 0.7, when + 0.003); g.gain.setTargetAtTime(0, when + 0.003, 0.02);
      o.connect(g).connect(out);
    },
    hum(S, when, off, e) {
      const ctx = S.ctx;
      const g = gain(ctx);
      envelope(g.gain, when, off, [[0, 0], [1.2, e.v], [e.d - 0.6, e.v], [e.d, 0]]);
      noise(S, when, e.d - off, off).connect(filt(ctx, 'lowpass', 170, 0.6)).connect(g).connect(S.sfx);
      const g2 = gain(ctx);
      envelope(g2.gain, when, off, [[0, 0], [1.2, e.v * 0.12], [e.d - 0.6, e.v * 0.12], [e.d, 0]]);
      noise(S, when, e.d - off, off + 0.3).connect(filt(ctx, 'bandpass', 900, 0.4)).connect(g2).connect(S.sfx);
    },
    rumble(S, when, off, e) {
      const ctx = S.ctx;
      const g = gain(ctx);
      envelope(g.gain, when, off, [[0, 0], [0.4, e.v], [e.d - 0.5, e.v], [e.d, 0]]);
      noise(S, when, e.d - off, off).connect(filt(ctx, 'lowpass', 150, 0.8)).connect(g).connect(S.sfx);
    },
    water(S, when, off, e) {
      const ctx = S.ctx;
      const g = gain(ctx);
      envelope(g.gain, when, off, [[0, 0], [1.0, e.v], [e.d - 1.0, e.v], [e.d, 0]]);
      const am = gain(ctx, 0.6);
      const lfo = osc(S, 'sine', 0.35, when, when + e.d - off);
      lfo.connect(gain(ctx, 0.4)).connect(am.gain);
      noise(S, when, e.d - off, off).connect(filt(ctx, 'lowpass', 520, 0.7)).connect(am).connect(g).connect(S.sfx);
    },
    crickets(S, when, off, e) {
      const ctx = S.ctx;
      [[4550, -0.6, 0.63, 11], [4920, 0.55, 0.81, 12]].forEach(([f, pan, per, seed]) => {
        const R = MA.rng(seed);
        const o = osc(S, 'sine', f, when, when + e.d - off);
        const g = gain(ctx);
        g.gain.setValueAtTime(0, when);
        for (let t = 0.3 + R() * 0.4; t < e.d - 0.3; t += per * (0.85 + R() * 0.3)) {
          if (t < off) continue;
          for (let k = 0; k < 3; k++) { const tt = when + t - off + k * 0.034; g.gain.setValueAtTime(e.v, tt); g.gain.setValueAtTime(0, tt + 0.02); }
        }
        o.connect(g).connect(panner(S, pan, S.sfx));
      });
    },
  };

  // ---------------- sessions: a set of nodes feeding the master bus ----------------
  function master(ctx) {
    const m = gain(ctx, 1.15);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.25;
    m.connect(comp).connect(ctx.destination);
    const verb = ctx.createConvolver();
    verb.buffer = bank(ctx).ir;
    verb.connect(gain(ctx, 0.85)).connect(m);
    return { m, verb };
  }

  function session(ctx, bus) {
    const S = { ctx, bank: bank(ctx), nodes: [], nseed: 0 };
    S.out = gain(ctx, 1);
    S.out.connect(bus.m);
    S.music = gain(ctx, 1); S.music.connect(S.out);
    S.music.connect(gain(ctx, 0.34)).connect(bus.verb);
    S.sfx = gain(ctx, 1); S.sfx.connect(S.out);
    S.sfx.connect(gain(ctx, 0.12)).connect(bus.verb);
    const body = filt(ctx, 'peaking', 230, 1.1); body.gain.value = 3.5;
    const air = filt(ctx, 'peaking', 2800, 0.9); air.gain.value = 2;
    S.pluckBus = body; body.connect(air).connect(S.music);
    S.track = (n) => S.nodes.push(n);
    return S;
  }

  function run(S, e, seekT) {
    const off = seekT == null ? 0 : Math.max(0, seekT - e.t);
    const when = Math.max(S.ctx.currentTime, S.base + e.t + off);
    const f = INST[e.kind];
    if (f) f(S, when, off, e);
  }

  let ctx = null, bus = null, cur = null, score = null;
  Au.ensure = function () {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC({ latencyHint: 'playback' });
      bus = master(ctx);
    }
    if (ctx.state === 'suspended') ctx.resume();
  };
  function pump(S) {
    const until = S.ctx.currentTime - S.base + 0.7;
    while (S.idx < score.length && score[S.idx].t < until) run(S, score[S.idx++], null);
  }
  function prime(c) {
    const b = bank(c);
    for (const e of score) if (e.kind === 'pluck' && !b.ks.has(e.m)) b.ks.set(e.m, ksBuffer(c, e.m));
  }
  Au.play = function (t0) {
    Au.ensure();
    if (!ctx) return;
    Au.stop();
    score = score || buildScore();
    prime(ctx);
    const S = session(ctx, bus);
    S.t0 = t0;
    S.base = ctx.currentTime + 0.06 - t0;
    for (const e of score) if (e.long && e.t < t0 && e.t + e.d > t0 + 0.1) run(S, e, t0);
    S.idx = score.findIndex((e) => e.t >= t0);
    if (S.idx < 0) S.idx = score.length;
    pump(S);
    S.timer = setInterval(() => pump(S), 50);
    cur = S;
  };
  Au.stop = function () {
    if (!cur) return;
    const S = cur;
    cur = null;
    clearInterval(S.timer);
    const now = S.ctx.currentTime;
    S.out.gain.setValueAtTime(S.out.gain.value, now);
    S.out.gain.linearRampToValueAtTime(0, now + 0.06);
    for (const n of S.nodes) { try { n.stop(now + 0.08); } catch (err) { /* already stopped */ } }
    setTimeout(() => S.out.disconnect(), 200);
  };
  // Film time according to the audio clock, or null when silent.
  Au.time = function () {
    if (!cur) return null;
    return Math.max(cur.t0, cur.ctx.currentTime - cur.base);
  };

  // Offline render of the whole score to a 16-bit stereo WAV (base64), used by the export script.
  Au.render = async function (sr = 48000) {
    const dur = MA.film.DUR;
    const oc = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    const S = session(oc, master(oc));
    S.base = 0;
    for (const e of buildScore()) run(S, e, null);
    const buf = await oc.startRendering();
    return wav(buf);
  };
  function wav(buf) {
    const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
    const ab = new ArrayBuffer(44 + len * ch * 2);
    const v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, len * ch * 2, true);
    const data = [];
    for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
    const bytes = new Uint8Array(ab);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  Au.score = () => (score = score || buildScore());
  window.__wav = () => Au.render();
})();

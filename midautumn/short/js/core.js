'use strict';
// Shared maths, seeded randomness, easing and canvas helpers. Everything downstream is a pure
// function of time, so all randomness here is hashed from integers rather than Math.random().
(function () {
  const MA = (window.MA = window.MA || {});

  MA.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function hash(a, b, c) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
    h ^= Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d);
    h ^= Math.imul((c | 0) + 0x165667b1, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  MA.hash = (a, b = 0, c = 0) => hash(a, b, c);

  const fade = (f) => f * f * (3 - 2 * f);
  MA.noise1 = function (x, seed = 0) {
    const i = Math.floor(x);
    const f = x - i;
    return hash(i, seed, 7) + (hash(i + 1, seed, 7) - hash(i, seed, 7)) * fade(f);
  };
  // Signed fractal noise, roughly in [-1, 1].
  MA.fbm1 = function (x, seed = 0, oct = 4) {
    let v = 0, a = 1, n = 0, f = 1;
    for (let o = 0; o < oct; o++) {
      v += (MA.noise1(x * f, seed + o * 31) * 2 - 1) * a;
      n += a; a *= 0.5; f *= 2.13;
    }
    return v / n;
  };
  MA.noise2 = function (x, y, seed = 0) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = fade(x - ix), fy = fade(y - iy);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
    const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };

  MA.clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  MA.lerp = (a, b, t) => a + (b - a) * t;
  MA.seg = (t, a, b) => MA.clamp((t - a) / (b - a));
  MA.smooth = (t) => { t = MA.clamp(t); return t * t * (3 - 2 * t); };
  MA.smoother = (t) => { t = MA.clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  MA.easeIn = (t) => { t = MA.clamp(t); return t * t * t; };
  MA.easeOut = (t) => { t = MA.clamp(t); return 1 - Math.pow(1 - t, 3); };
  MA.easeInOut = (t) => { t = MA.clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  MA.easeOutBack = (t, k = 1.7) => { t = MA.clamp(t); const u = t - 1; return 1 + (k + 1) * u * u * u + k * u * u; };
  MA.easeOutQuad = (t) => { t = MA.clamp(t); return 1 - (1 - t) * (1 - t); };
  // Damped settle used for paper pieces landing on the board.
  MA.settle = (t, freq = 2.2, damp = 5) => {
    t = Math.max(0, t);
    return 1 - Math.exp(-damp * t) * Math.cos(freq * Math.PI * 2 * t);
  };
  // 1 inside [a,b], ramps of length r on both sides.
  MA.window = (t, a, b, r = 0.3) => MA.smooth((t - a) / r) * MA.smooth((b - t) / r);

  // Stop-motion stepping: the "boil" of cut paper, re-rolled 8 times per second.
  MA.step = (t, fps = 8) => Math.floor(t * fps + 1e-6);
  MA.boil = (id, t, amp, fps = 8) => {
    const k = MA.step(t, fps);
    return (hash(id, k, 3) - 0.5) * 2 * amp;
  };

  MA.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };

  MA.hex = function (hex, a = 1) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  MA.mix = function (h1, h2, t) {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const r = Math.round(((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t));
    const g = Math.round(((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t));
    const bl = Math.round((a & 255) + (((b & 255) - (a & 255)) * t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  };

  // Palette: warm gold, vermilion, indigo, rice-paper white.
  MA.C = {
    night0: '#0c1328', night1: '#16224a', night2: '#22346a', night3: '#33508f',
    indigo: '#1d2b55', indigoD: '#121a36', indigoL: '#3d5a9c', indigoP: '#7d93c2',
    ink: '#16141c',
    ver: '#d23f2a', verD: '#9f2a1c', verL: '#e8603c', verP: '#f09a74',
    gold: '#e8ae45', goldD: '#c98a2c', goldL: '#f5cf74', goldP: '#f8e2a6',
    rice: '#f2e7cf', riceD: '#e3d2ae', riceL: '#faf3e3', kraft: '#b98f5e',
    wood: '#5b3a2c', woodD: '#3b2620', teal: '#24495a', tealD: '#173340',
  };

  // Catmull-Rom resampling of [x, y, w] control points to roughly `step` spacing.
  MA.spline = function (pts, step = 1.5) {
    const out = [];
    const n = pts.length;
    if (n === 1) return [pts[0].slice()];
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const m = Math.max(2, Math.ceil(len / step));
      for (let j = 0; j < m; j++) {
        const t = j / m, t2 = t * t, t3 = t2 * t;
        const q = [];
        for (let k = 0; k < 3; k++) {
          q.push(0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
            (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
        }
        out.push(q);
      }
    }
    out.push(pts[n - 1].slice());
    return out;
  };

  // Parallax camera: look at (fx, fy) with zoom z; depth 0 = pinned to the screen, 1 = moves fully.
  MA.cam = function (ctx, L, fx, fy, z, depth) {
    const zz = 1 + (z - 1) * depth;
    ctx.translate(L.W / 2, L.H / 2);
    ctx.scale(zz, zz);
    ctx.translate(-(L.W / 2 + (fx - L.W / 2) * depth), -(L.H / 2 + (fy - L.H / 2) * depth));
  };

  // Font stack for the few printed labels (ticket, phone, calendar); the calligraphy is drawn stroke by stroke.
  MA.SANS = '"PingFang SC","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei","Hiragino Sans GB",sans-serif';
  MA.SERIF = '"Songti SC","Noto Serif CJK SC","Source Han Serif SC","STSong","SimSun",serif';
})();

// 月宫小剧场 · core: math, easing, keyframes, seeded noise, shared drawing helpers.
(function () {
  'use strict';
  const TH = (window.TH = window.TH || {});
  TH.W = 1080;
  TH.H = 1920;

  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;

  const E = {
    lin: (x) => x,
    inQ: (x) => x * x,
    outQ: (x) => 1 - (1 - x) * (1 - x),
    ioQ: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    inC: (x) => x * x * x,
    outC: (x) => 1 - Math.pow(1 - x, 3),
    ioC: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: (x) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
    outBackBig: (x) => {
      const c1 = 3.2, c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
    inBack: (x) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return c3 * x * x * x - c1 * x * x;
    },
    outElastic: (x) =>
      x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1,
    outBounce: (x) => {
      const n1 = 7.5625, d1 = 2.75;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    },
    step: (x) => (x < 1 ? 0 : 1),
  };

  // kf(t, [[t0, v0], [t1, v1, 'ease'], ...]) — the ease on a key shapes the segment that ends at it.
  function kf(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      if (t < k[0]) {
        const p = keys[i - 1];
        const f = E[k[2] || 'ioQ'];
        return lerp(p[1], k[1], f((t - p[0]) / (k[0] - p[0])));
      }
    }
    return keys[keys.length - 1][1];
  }

  // Discrete state track: [[t0, 'a'], [t1, 'b'], ...] → value active at t.
  function pick(t, keys) {
    let v = keys[0][1];
    for (const k of keys) if (t >= k[0]) v = k[1];
    return v;
  }

  // Squash-and-stretch spring after an impact at time t0: returns {sx, sy}.
  function squash(t, t0, amt = 0.3, dur = 0.5, freq = 3.2) {
    const d = t - t0;
    if (d < 0 || d > dur) return { sx: 1, sy: 1 };
    const k = Math.exp((-d / dur) * 5) * Math.cos(d * freq * TAU);
    return { sx: 1 + amt * k, sy: 1 - amt * k };
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  // Smooth 1D value noise in [-1, 1].
  function noise1(x) {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    return lerp(hash(i), hash(i + 1), u) * 2 - 1;
  }

  // Talking mouth flap: 0..1, deterministic from time.
  function talkFlap(t) {
    return clamp(0.5 + 0.5 * Math.sin(t * 26) * (0.6 + 0.4 * Math.sin(t * 7.3)));
  }

  // ---------- path helpers ----------
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function star4(ctx, x, y, r, thin = 0.28) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const rr = i % 2 ? r * thin : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function star5(ctx, x, y, r, inner = 0.45, rot = 0) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2 + rot;
      const rr = i % 2 ? r * inner : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
    ctx.closePath();
  }

  // Closed smooth curve through points (Catmull-Rom → Bezier).
  function smoothClosed(ctx, pts, tension = 1) {
    const n = pts.length;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
      const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
      const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
      const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
    }
    ctx.closePath();
  }

  // Fill + outline in one call.
  function fo(ctx, fill, stroke, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  function ell(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU);
  }

  const FONT_STACK = '"TheaterKai", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';
  const font = (px, weight = '') => `${weight ? weight + ' ' : ''}${Math.round(px)}px ${FONT_STACK}`;

  const OUT = '#3b2a40';

  Object.assign(TH, {
    clamp, lerp, seg, TAU, E, kf, pick, squash, mulberry32, hash, noise1, talkFlap,
    rrect, star4, star5, heart, smoothClosed, fo, ell, font, FONT_STACK, OUT,
  });
})();

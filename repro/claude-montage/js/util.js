// Shared math, easing, noise, colour and timing helpers.

export const W = 1920;
export const H = 1080;
export const TAU = Math.PI * 2;

// The whole film is cut to a 96 BPM grid: one bar = 2.5 s, 12 bars = 30 s.
export const BPM = 96;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const DURATION = 30;

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const hop = (u) => 4 * u * (1 - u);
// 0 -> 1 -> 0 bump over [a, b]
export const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)));

export const E = {
  lin: (t) => t,
  in2: (t) => t * t,
  out2: (t) => 1 - (1 - t) * (1 - t),
  io2: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  in3: (t) => t * t * t,
  out3: (t) => 1 - (1 - t) ** 3,
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  out5: (t) => 1 - (1 - t) ** 5,
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  hold: () => 0,
};

// Keyframes: [[time, value, easing?], ...]; the easing on a key shapes the segment that ends there.
export function kf(t, keys) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  for (let i = 1; i < n; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const u = (t - k0[0]) / (k1[0] - k0[0] || 1);
      const e = k1[2] || E.io2;
      return k0[1] + (k1[1] - k0[1]) * e(u);
    }
  }
  return keys[n - 1][1];
}

export function hash(n) {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i + seed * 101.37), b = hash(i + 1 + seed * 101.37);
  return lerp(a, b, smooth(f)) * 2 - 1;
}

export function fbm(x, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    s += a * vnoise(x * f, seed + o * 7.7);
    norm += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / norm;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexCache = new Map();
export function hex(c) {
  let v = hexCache.get(c);
  if (!v) {
    const n = parseInt(c.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(c, v);
  }
  return v;
}

export function mix(a, b, t, alpha = 1) {
  const A = hex(a), B = hex(b);
  const r = Math.round(lerp(A[0], B[0], t));
  const g = Math.round(lerp(A[1], B[1], t));
  const bl = Math.round(lerp(A[2], B[2], t));
  return alpha >= 1 ? `rgb(${r},${g},${bl})` : `rgba(${r},${g},${bl},${alpha})`;
}

export function mixHex(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + [0, 1, 2].map((i) => Math.round(lerp(A[i], B[i], t)).toString(16).padStart(2, '0')).join('');
}

export function rgba(c, a) {
  const A = hex(c);
  return `rgba(${A[0]},${A[1]},${A[2]},${a})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export const FONT_SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, Caladea, "DejaVu Serif", serif';
export const FONT_SANS = '"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, "Liberation Sans", "DejaVu Sans", sans-serif';
export const FONT_MONO = '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace';
export const FONT_CJK = '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", "Source Han Serif SC", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

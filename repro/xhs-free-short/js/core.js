// Shared math, colour and render-state helpers for the film.

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const sstep = (a, b, x) => smooth(inv(a, b, x));
export const bump = (a, b, c, d, x) => sstep(a, b, x) * (1 - sstep(c, d, x));

export const ease = {
  lin: (t) => t,
  in: (t) => t * t * t,
  in2: (t) => t * t,
  out: (t) => 1 - (1 - t) ** 3,
  out2: (t) => 1 - (1 - t) ** 2,
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  hold: () => 0,
};

function mixAny(a, b, u) {
  if (typeof a === 'number') return a + (b - a) * u;
  if (Array.isArray(a)) return a.map((v, i) => v + (b[i] - v) * u);
  const o = {};
  for (const k in a) o[k] = k in b ? mixAny(a[k], b[k], u) : a[k];
  return o;
}
export const mixv = mixAny;

// Keyframes: [[time, value, easeToNext?], ...]; values may be numbers, arrays or flat objects.
export function kf(t, keys, def = ease.sine) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const k0 = keys[i - 1];
      const e = k0[2] || def;
      return mixAny(k0[1], keys[i][1], e((t - k0[0]) / (keys[i][0] - k0[0])));
    }
  }
  return keys[keys.length - 1][1];
}

// ---------- colour ----------
export function C(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const css = (c, a = 1) =>
  a >= 1
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a < 0 ? 0 : a.toFixed(3)})`;
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul = (a, m) => [(a[0] * m[0]) / 255, (a[1] * m[1]) / 255, (a[2] * m[2]) / 255];
export const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const add = (a, b, k = 1) => [
  Math.min(255, a[0] + b[0] * k),
  Math.min(255, a[1] + b[1] * k),
  Math.min(255, a[2] + b[2] * k),
];

// ---------- deterministic randomness ----------
export function hash(n) {
  n = Math.imul((n | 0) ^ 0x27d4eb2d, 0x9e3779b1);
  n ^= n >>> 15;
  n = Math.imul(n, 0x85ebca77);
  n ^= n >>> 13;
  n = Math.imul(n, 0xc2b2ae3d);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul((b | 0) + 7, 19349663));
export function noise(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash2(i, seed) * (1 - u) + hash2(i + 1, seed) * u) * 2 - 1;
}
export const fbm = (x, seed = 0) =>
  noise(x, seed) * 0.57 + noise(x * 2.03 + 11.3, seed + 1) * 0.29 + noise(x * 4.11 + 3.7, seed + 2) * 0.14;
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const fract = (x) => x - Math.floor(x);
export const wrap = (x, a, b) => a + ((((x - a) % (b - a)) + (b - a)) % (b - a));

// ---------- render state ----------
export const S = {
  ctx: null,
  V: { x0: 0, y0: 0, x1: 1920, y1: 872 }, // visible world rect of the current camera
  k: 1, // world unit -> device pixel
  kc: 1, // world unit -> CSS pixel
  sp: {}, // glow sprites
};

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function radialSprite(rgb, stops, size = 128) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, a] of stops) grd.addColorStop(o, css(rgb, a));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

export function initSprites() {
  const soft = [[0, 1], [0.12, 0.62], [0.3, 0.24], [0.6, 0.06], [1, 0]];
  const core = [[0, 1], [0.08, 0.9], [0.2, 0.35], [0.5, 0.07], [1, 0]];
  S.sp.warm = radialSprite([255, 222, 160], soft, 256);
  S.sp.warmCore = radialSprite([255, 240, 205], core);
  S.sp.moon = radialSprite([205, 220, 255], soft, 256);
  S.sp.white = radialSprite([255, 255, 255], soft);
  S.sp.whiteCore = radialSprite([255, 255, 255], core);
  S.sp.sun = radialSprite([255, 186, 110], soft, 256);
  S.sp.cyan = radialSprite([90, 255, 220], soft, 128);
  S.sp.cyanCore = radialSprite([200, 255, 245], core, 64);
  S.sp.teal = radialSprite([40, 190, 230], soft, 128);
  S.sp.mist = radialSprite([255, 255, 255], [[0, 0.55], [0.4, 0.3], [0.75, 0.08], [1, 0]], 128);
  S.sp.mistCyan = radialSprite([150, 250, 232], [[0, 0.55], [0.4, 0.3], [0.75, 0.08], [1, 0]], 128);
  S.sp.dark = radialSprite([0, 0, 0], [[0, 0.8], [0.5, 0.35], [1, 0]], 128);
  S.sp.fog = radialSprite([255, 255, 255], [[0, 0.5], [0.35, 0.3], [0.7, 0.08], [1, 0]], 128);

  // film grain tile
  const n = 256;
  const gc = canvas(n, n);
  const gx = gc.getContext('2d');
  const img = gx.createImageData(n, n);
  const r = rng(99);
  for (let i = 0; i < n * n; i++) {
    const v = r();
    const on = v > 0.5 ? 255 : 0;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = on;
    img.data[i * 4 + 3] = Math.abs(v - 0.5) * 44;
  }
  gx.putImageData(img, 0, 0);
  S.grain = gc;
}

// Additive glow sprite; caller sets globalCompositeOperation.
export function glow(spr, x, y, r, a) {
  if (a <= 0.004 || r <= 0) return;
  const c = S.ctx;
  c.globalAlpha = a > 1 ? 1 : a;
  c.drawImage(spr, x - r, y - r, r * 2, r * 2);
}
export function glowE(spr, x, y, rx, ry, a) {
  if (a <= 0.004) return;
  const c = S.ctx;
  c.globalAlpha = a > 1 ? 1 : a;
  c.drawImage(spr, x - rx, y - ry, rx * 2, ry * 2);
}

export function poly(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}

// Smooth closed/open curve through points (Catmull-Rom converted to Bezier).
export function curve(ctx, pts, close = false, tension = 0.5, move = true) {
  const n = pts.length / 2;
  const P = (i) => {
    if (close) i = ((i % n) + n) % n;
    else i = Math.max(0, Math.min(n - 1, i));
    return [pts[i * 2], pts[i * 2 + 1]];
  };
  const [sx, sy] = P(0);
  if (move) ctx.moveTo(sx, sy);
  else ctx.lineTo(sx, sy);
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const k = tension / 3;
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
      p2[0], p2[1],
    );
  }
  if (close) ctx.closePath();
}

// Fill a path with a rim-lit crescent: rim colour shows on the side facing (-dx, -dy).
export function rimFill(ctx, path, base, rim, dx, dy) {
  ctx.save();
  ctx.fillStyle = rim;
  ctx.fill(path);
  ctx.clip(path);
  ctx.translate(dx, dy);
  ctx.fillStyle = base;
  ctx.fill(path);
  ctx.restore();
}

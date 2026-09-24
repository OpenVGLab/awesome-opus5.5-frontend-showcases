// util.js - small shared helpers: grid snapping, geometry and number formatting.
// Everything here is "pure" (no DOM access), so any module can use it safely.

// The workspace uses "world units". At 100 % zoom one world unit is one screen pixel.
export const GRID = 20;       // size of one grid cell; every terminal sits on a grid point
export const PART_LEN = 80;   // distance between the two metal ends (terminals) of a component

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const snap = (v, step = GRID) => Math.round(v / step) * step;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// Where does point P fall relative to the segment A-B?
// t = 0 means "at A", t = 1 means "at B"; d is the distance from P to the segment.
export function projectOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  const tc = clamp(t, 0, 1);
  return { t, d: Math.hypot(px - (ax + dx * tc), py - (ay + dy * tc)) };
}

// Makes user-typed text safe to put inside HTML.
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Drops useless trailing zeros: 10.00 -> "10", 4.70 -> "4.7".
export const trimNum = (n, decimals = 2) => String(parseFloat(Number(n).toFixed(decimals)));

// ---------- Number formatting for readings (always shows a unit) ----------
export function fmtI(I) {
  const a = Math.abs(I);
  if (a < 1e-9) return '0 A';
  if (a >= 1) return a.toFixed(2) + ' A';
  if (a >= 0.01) return a.toFixed(3) + ' A';
  if (a >= 1e-5) return (a * 1000).toFixed(2) + ' mA';
  return (a * 1e6).toFixed(2) + ' \u00b5A';
}
export function fmtV(V) {
  const a = Math.abs(V);
  if (a < 1e-9) return '0 V';
  if (a >= 100) return a.toFixed(1) + ' V';
  if (a >= 0.01) return a.toFixed(2) + ' V';
  return (a * 1000).toFixed(2) + ' mV';
}
export function fmtR(R) {
  if (!isFinite(R)) return '\u221e \u03a9';
  if (R >= 1e6) return trimNum(R / 1e6, 2) + ' M\u03a9';
  if (R >= 1000) return trimNum(R / 1000, 2) + ' k\u03a9';
  return trimNum(R, 2) + ' \u03a9';
}
export function fmtP(P) {
  const a = Math.abs(P);
  if (a < 1e-9) return '0 W';
  if (a >= 1) return a.toFixed(2) + ' W';
  if (a >= 0.01) return a.toFixed(3) + ' W';
  return (a * 1000).toFixed(2) + ' mW';
}

// ---------- Resistor colour code ----------
// Real resistors show their value as coloured stripes: digit, digit, multiplier, tolerance.
const BAND_COLORS = ['#1c1c1c', '#7a4a1e', '#d7263d', '#f46d1b', '#f7c325',
  '#2e9e44', '#2563eb', '#8b3fd9', '#8f8f8f', '#f4f4f4'];
const GOLD = '#caa23a';
const SILVER = '#c3c7cf';

export function resistorBands(R) {
  if (!(R > 0)) R = 1;
  let e = Math.floor(Math.log10(R)) - 1;          // power of ten of the multiplier
  let digits = Math.round(R / Math.pow(10, e));   // two significant digits (10..99)
  if (digits >= 100) { digits = Math.round(digits / 10); e += 1; }
  if (digits < 10) { digits *= 10; e -= 1; }
  const mult = e >= 0 ? BAND_COLORS[clamp(e, 0, 9)] : (e === -1 ? GOLD : SILVER);
  return [BAND_COLORS[Math.floor(digits / 10)], BAND_COLORS[digits % 10], mult, GOLD];
}

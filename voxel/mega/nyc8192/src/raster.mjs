// 2D rasterisers and map utilities for full-resolution (8192 x 8192) typed-array maps, index = z * W + x.
import { W } from './frame.mjs';

const xsBuf = [];
// Scanline fill of a polygon [[x,z],...]; pixel (x,z) is inside when its centre is. cb(z, xa, xb) inclusive.
export function polySpans(pts, cb, x0 = 0, z0 = 0, x1 = W - 1, z1 = W - 1) {
  let zmin = Infinity, zmax = -Infinity;
  for (const p of pts) { if (p[1] < zmin) zmin = p[1]; if (p[1] > zmax) zmax = p[1]; }
  const za = Math.max(z0, Math.floor(zmin)), zb = Math.min(z1, Math.ceil(zmax));
  const n = pts.length;
  for (let z = za; z <= zb; z++) {
    const zc = z + 0.5; xsBuf.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
      if ((zi > zc) !== (zj > zc)) xsBuf.push(xi + (zc - zi) / (zj - zi) * (xj - xi));
    }
    if (xsBuf.length < 2) continue;
    xsBuf.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xsBuf.length; k += 2) {
      const xa = Math.max(x0, Math.ceil(xsBuf[k] - 0.5)), xb = Math.min(x1, Math.floor(xsBuf[k + 1] - 0.5));
      if (xa <= xb) cb(z, xa, xb);
    }
  }
}

export function capsule(ax, az, bx, bz, r, seg = 6) {
  const a = Math.atan2(bz - az, bx - ax), pts = [];
  for (let i = 0; i <= seg; i++) { const t = a - Math.PI / 2 + i * Math.PI / seg; pts.push([bx + r * Math.cos(t), bz + r * Math.sin(t)]); }
  for (let i = 0; i <= seg; i++) { const t = a + Math.PI / 2 + i * Math.PI / seg; pts.push([ax + r * Math.cos(t), az + r * Math.sin(t)]); }
  return pts;
}
// flat-ended thick segment
export function band(ax, az, bx, bz, r, ext = 0) {
  const L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L, px = -uz * r, pz = ux * r;
  ax -= ux * ext; az -= uz * ext; bx += ux * ext; bz += uz * ext;
  return [[ax + px, az + pz], [bx + px, bz + pz], [bx - px, bz - pz], [ax - px, az - pz]];
}
export function lineSpans(ax, az, bx, bz, r, cb, round = true) {
  polySpans(round ? capsule(ax, az, bx, bz, r) : band(ax, az, bx, bz, r), cb);
}
export function plineSpans(pts, r, cb, round = true) {
  for (let i = 0; i + 1 < pts.length; i++) lineSpans(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, cb, round);
}
export function ellipse(cx, cz, rx, rz, rot = 0, n = 48) {
  const pts = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const t = i * 2 * Math.PI / n, ex = rx * Math.cos(t), ez = rz * Math.sin(t); pts.push([cx + ex * c - ez * s, cz + ex * s + ez * c]); }
  return pts;
}
// rotated rectangle: centre, unit axis u (ux,uz), half extents hu along u and hv across
export function orect(cx, cz, ux, uz, hu, hv) {
  const vx = -uz, vz = ux;
  return [[cx + ux * hu + vx * hv, cz + uz * hu + vz * hv], [cx - ux * hu + vx * hv, cz - uz * hu + vz * hv],
    [cx - ux * hu - vx * hv, cz - uz * hu - vz * hv], [cx + ux * hu - vx * hv, cz + uz * hu - vz * hv]];
}
// smooth closed curve through control points (Catmull-Rom), for coastlines
export function smoothClosed(pts, sub = 4) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}
export function smoothOpen(pts, sub = 4) {
  const out = [], n = pts.length;
  for (let i = 0; i + 1 < n; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[n - 1]);
  return out;
}
export function pathLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
// resample a polyline at fixed spacing: returns [{x,z,tx,tz,s}]
export function resample(pts, step, offset = 0) {
  const out = []; let s = 0, next = offset;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    const L = Math.hypot(bx - ax, bz - az); if (L < 1e-9) continue;
    const tx = (bx - ax) / L, tz = (bz - az) / L;
    while (next <= s + L) { const d = next - s; out.push({ x: ax + tx * d, z: az + tz * d, tx, tz, s: next }); next += step; }
    s += L;
  }
  return out;
}

// span writers
export const setSpan = (arr, v) => (z, a, b) => arr.fill(v, z * W + a, z * W + b + 1);
export const setSpanIf = (arr, v, pred) => (z, a, b) => { for (let i = z * W + a, e = z * W + b; i <= e; i++) if (pred(i)) arr[i] = v; };
export const eachSpan = (fn) => (z, a, b) => { for (let x = a; x <= b; x++) fn(z * W + x, x, z); };

// Two-pass chamfer distance (units: 1/10 cell), sources where isSrc(i). Returns Uint16Array (capped).
export function chamfer(isSrc, cap = 65000, out = null) {
  const N = W * W, d = out || new Uint16Array(N);
  for (let i = 0; i < N; i++) d[i] = isSrc(i) ? 0 : 65000;
  for (let z = 0; z < W; z++) {
    const r = z * W;
    for (let x = 0; x < W; x++) {
      const i = r + x; let v = d[i]; if (v === 0) continue;
      if (x > 0 && d[i - 1] + 10 < v) v = d[i - 1] + 10;
      if (z > 0) {
        if (d[i - W] + 10 < v) v = d[i - W] + 10;
        if (x > 0 && d[i - W - 1] + 14 < v) v = d[i - W - 1] + 14;
        if (x < W - 1 && d[i - W + 1] + 14 < v) v = d[i - W + 1] + 14;
      }
      d[i] = v;
    }
  }
  for (let z = W - 1; z >= 0; z--) {
    const r = z * W;
    for (let x = W - 1; x >= 0; x--) {
      const i = r + x; let v = d[i]; if (v === 0) continue;
      if (x < W - 1 && d[i + 1] + 10 < v) v = d[i + 1] + 10;
      if (z < W - 1) {
        if (d[i + W] + 10 < v) v = d[i + W] + 10;
        if (x < W - 1 && d[i + W + 1] + 14 < v) v = d[i + W + 1] + 14;
        if (x > 0 && d[i + W - 1] + 14 < v) v = d[i + W - 1] + 14;
      }
      d[i] = v > cap ? cap : v;
    }
  }
  return d;
}

// 4-connected component labelling of cells where pred(i); returns { label: Int32Array, count, areas, bbox }
export function label4(pred, maxLabels = 1 << 20) {
  const N = W * W, lab = new Int32Array(N);
  const stack = new Int32Array(1 << 22);
  let count = 0;
  const areas = [], bbox = [];
  for (let i = 0; i < N; i++) {
    if (lab[i] !== 0 || !pred(i)) continue;
    count++;
    if (count >= maxLabels) throw new Error('too many labels');
    let sp = 0, area = 0, x0 = W, x1 = -1, z0 = W, z1 = -1;
    stack[sp++] = i; lab[i] = count;
    while (sp > 0) {
      const j = stack[--sp]; area++;
      const x = j % W, z = (j - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
      if (x > 0 && lab[j - 1] === 0 && pred(j - 1)) { lab[j - 1] = count; stack[sp++] = j - 1; }
      if (x < W - 1 && lab[j + 1] === 0 && pred(j + 1)) { lab[j + 1] = count; stack[sp++] = j + 1; }
      if (z > 0 && lab[j - W] === 0 && pred(j - W)) { lab[j - W] = count; stack[sp++] = j - W; }
      if (z < W - 1 && lab[j + W] === 0 && pred(j + W)) { lab[j + W] = count; stack[sp++] = j + W; }
      if (sp > stack.length - 8) throw new Error('flood stack overflow');
    }
    areas.push(area); bbox.push([x0, z0, x1, z1]);
  }
  return { label: lab, count, areas, bbox };
}

// deterministic hashing / noise
export function hash2(x, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function hashi(a, b, c) {
  let h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA77) ^ Math.imul((c | 0) + 7, 0xC2B2AE3D);
  h = Math.imul(h ^ (h >>> 15), 0x27D4EB2F); h ^= h >>> 13; h = Math.imul(h, 0x165667B1); h ^= h >>> 16;
  return h >>> 0;
}
export function vnoise(x, z, sc, s) {
  const fx = x / sc, fz = z / sc, ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz, ux = tx * tx * (3 - 2 * tx), uz = tz * tz * (3 - 2 * tz);
  const a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x, z, sc, s, oct = 3) {
  let v = 0, a = 0.5, f = 1, t = 0;
  for (let o = 0; o < oct; o++) { v += a * vnoise(x * f, z * f, sc, s + o * 17); t += a; a *= 0.5; f *= 2; }
  return v / t;
}
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

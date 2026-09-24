// Shared constants and small numeric helpers for the evacuation model.

export const WORLD_W = 60, WORLD_H = 36;
export const CELL = 0.25, GW = 240, GH = 144, GN = GW * GH;      // navigation grid
export const HCELL = 0.5, HW = 120, HH = 72, HN = HW * HH;       // analysis grid
export const DT = 0.005;
export const CAP = 4000;
export const MAX_EXITS = 12;
export const DANGER = 2600;                                       // N of body compression
export const EXIT_LABELS = 'ABCDEFGHIJKL';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Signed distance from a point to a primitive surface. Type 0 is an oriented box
// (centre, unit axis u, half extents hu along u and hw across), type 1 a disc of radius hu.
// The outward unit normal is left in NRM.
export const NRM = { x: 0, y: 0 };
export function primDist(t, cx, cy, ux, uy, hu, hw, px, py) {
  const dx = px - cx, dy = py - cy;
  if (t === 1) {
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-9) { NRM.x = 1; NRM.y = 0; return -hu; }
    NRM.x = dx / d; NRM.y = dy / d;
    return d - hu;
  }
  const lu = dx * ux + dy * uy, lw = dy * ux - dx * uy;
  const su = lu < 0 ? -1 : 1, sw = lw < 0 ? -1 : 1;
  const qu = lu * su - hu, qw = lw * sw - hw;
  let nu, nw, d;
  if (qu > 0 || qw > 0) {
    const mu = qu > 0 ? qu : 0, mw = qw > 0 ? qw : 0;
    d = Math.sqrt(mu * mu + mw * mw);
    nu = (mu / d) * su; nw = (mw / d) * sw;
  } else if (qu > qw) { d = qu; nu = su; nw = 0; }
  else { d = qw; nu = 0; nw = sw; }
  NRM.x = nu * ux - nw * uy; NRM.y = nu * uy + nw * ux;
  return d;
}

// Wall segments are drawn and simulated with square caps, so a cut has to pull the
// remaining pieces back by half the thickness for the gap to match the cut region.
function splitInto(out, s, u0, u1) {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, L = Math.hypot(dx, dy);
  const h = L > 0 ? s.t / 2 / L : 0;
  const a = u0 - h, b = u1 + h;
  if (a * L > 0.05) out.push({ ...s, x1: s.x0 + dx * a, y1: s.y0 + dy * a });
  if ((1 - b) * L > 0.05) out.push({ ...s, x0: s.x0 + dx * b, y0: s.y0 + dy * b });
}

export function cutRect(segs, x0, y0, x1, y1) {
  const out = [];
  for (const s of segs) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
    const p = [-dx, dx, -dy, dy], q = [s.x0 - x0, x1 - s.x0, s.y0 - y0, y1 - s.y0];
    let u0 = 0, u1 = 1, hit = true;
    for (let k = 0; k < 4; k++) {
      if (Math.abs(p[k]) < 1e-12) { if (q[k] < 0) { hit = false; break; } }
      else {
        const t = q[k] / p[k];
        if (p[k] < 0) { if (t > u0) u0 = t; } else if (t < u1) u1 = t;
      }
    }
    if (!hit || u0 >= u1) out.push(s);
    else splitInto(out, s, u0, u1);
  }
  return out;
}

export function cutCircle(segs, cx, cy, R) {
  const out = [];
  let changed = false;
  for (const s of segs) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0, fx = s.x0 - cx, fy = s.y0 - cy;
    const Rr = R + s.t / 2;
    const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - Rr * Rr;
    if (a < 1e-12) { if (c > 0) out.push(s); else changed = true; continue; }
    const disc = b * b - 4 * a * c;
    if (disc <= 0) { out.push(s); continue; }
    const sq = Math.sqrt(disc);
    const t0 = (-b - sq) / (2 * a), t1 = (-b + sq) / (2 * a);
    if (t1 <= 0 || t0 >= 1) { out.push(s); continue; }
    changed = true;
    splitInto(out, s, Math.max(0, t0), Math.min(1, t1));
  }
  return changed ? out : segs;
}

export function rectDist(e, x, y) {
  const dx = Math.max(e.x0 - x, 0, x - e.x1), dy = Math.max(e.y0 - y, 0, y - e.y1);
  return Math.hypot(dx, dy);
}

export function lowerBound(arr, len, v) {
  let lo = 0, hi = len;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; }
  return lo;
}

// In-place separable [1 2 1]/4 blur on the analysis grid.
export function blur3(a, tmp) {
  for (let j = 0; j < HH; j++) {
    const o = j * HW;
    for (let i = 0; i < HW; i++) {
      const l = i > 0 ? a[o + i - 1] : a[o + i], r = i < HW - 1 ? a[o + i + 1] : a[o + i];
      tmp[o + i] = (l + 2 * a[o + i] + r) * 0.25;
    }
  }
  for (let j = 0; j < HH; j++) {
    const o = j * HW, up = j > 0 ? o - HW : o, dn = j < HH - 1 ? o + HW : o;
    for (let i = 0; i < HW; i++) a[o + i] = (tmp[up + i] + 2 * tmp[o + i] + tmp[dn + i]) * 0.25;
  }
}

export class Heap {
  constructor(cap) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.n = 0; }
  push(key, val) {
    if (this.n >= this.k.length) {
      const k = new Float64Array(this.k.length * 2), v = new Int32Array(this.k.length * 2);
      k.set(this.k); v.set(this.v); this.k = k; this.v = v;
    }
    const K = this.k, V = this.v;
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= key) break;
      K[i] = K[p]; V[i] = V[p]; i = p;
    }
    K[i] = key; V[i] = val;
  }
  pop() {
    const K = this.k, V = this.v, top = V[0];
    const n = --this.n;
    if (n > 0) {
      const key = K[n], val = V[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && K[c + 1] < K[c]) c++;
        if (K[c] >= key) break;
        K[i] = K[c]; V[i] = V[c]; i = c;
      }
      K[i] = key; V[i] = val;
    }
    return top;
  }
}

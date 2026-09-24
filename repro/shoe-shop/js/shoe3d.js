// Procedural footwear generator.
// A shoe = a silhouette (MODELS) + a colorway. Everything hangs off one "last" outline:
// the sole is extruded around it, the upper is lofted from the sole edge up to the
// topline / collar opening, and the details (tongue, laces, eyelets, padded collar,
// straps, heel block) are swept along curves derived from the same opening loop.
// Units: shoe length = 1 (heel x=-0.5 → toe x=+0.5), y up, +z = lateral side of a right shoe.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintLogo } from './logos.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

const M_AROUND = 192;
const R_UP = 48;

// ------------------------------------------------------------------ last outline
const LAST = [
  [0.500, -0.016], [0.480, 0.056], [0.424, 0.116], [0.305, 0.160], [0.172, 0.172],
  [0.030, 0.158], [-0.120, 0.139], [-0.280, 0.129], [-0.400, 0.117], [-0.470, 0.085],
  [-0.500, 0.018], [-0.492, -0.048], [-0.446, -0.097], [-0.330, -0.113], [-0.170, -0.110],
  [-0.010, -0.130], [0.140, -0.160], [0.292, -0.165], [0.412, -0.136], [0.477, -0.082],
];

function resamplePolyline(poly, n) {
  const L = [0];
  for (let i = 1; i < poly.length; i++) L.push(L[i - 1] + poly[i].distanceTo(poly[i - 1]));
  const total = L[L.length - 1];
  const out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = (k / n) * total;
    while (j < L.length - 2 && L[j + 1] < s) j++;
    const t = (s - L[j]) / (L[j + 1] - L[j] || 1);
    out.push(poly[j].clone().lerp(poly[j + 1], clamp(t, 0, 1)));
  }
  return out;
}

const outlineCache = new Map();
export function getOutline(width = 1, toe = 'round') {
  const key = `${width}|${toe}`;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const ctrl = LAST.map(([x, z]) => {
    let s = width;
    if (toe === 'almond') s *= 1 - 0.34 * sstep(0.12, 0.5, x);
    else if (toe === 'wide') s *= 1 + 0.08 * sstep(0.0, 0.42, x);
    return new V3(x, 0, z * s);
  });
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const D = 2400;
  const dense = curve.getSpacedPoints(D); dense.pop();
  let toeI = 0, heelI = 0;
  for (let i = 0; i < D; i++) { if (dense[i].x > dense[toeI].x) toeI = i; if (dense[i].x < dense[heelI].x) heelI = i; }
  const walk = (a, b) => { const out = []; for (let i = a; ; i = (i + 1) % D) { out.push(dense[i]); if (i === b) break; } return out; };
  const H = M_AROUND / 2;
  const lat = resamplePolyline(walk(toeI, heelI), H);
  const med = resamplePolyline(walk(heelI, toeI), H);
  const P = lat.slice(0, H).concat(med.slice(0, H));
  const N = P.map((p, i) => {
    const a = P[(i - 1 + M_AROUND) % M_AROUND], b = P[(i + 1) % M_AROUND];
    return new V3(b.z - a.z, 0, -(b.x - a.x)).normalize();
  });
  const arc = [0];
  for (let i = 1; i <= M_AROUND; i++) arc.push(arc[i - 1] + P[i % M_AROUND].distanceTo(P[i - 1]));
  let minX = Infinity, maxX = -Infinity;
  for (const p of P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
  const o = { P, N, arc, minX, maxX };
  outlineCache.set(key, o);
  return o;
}

// ------------------------------------------------------------------ sole height functions
export function soleFns(S) {
  const ground = (x) => {
    let y = 0;
    if (S.heelHeight) y += S.heelHeight * (1 - sstep(S.archStart, S.archEnd, x));
    const t = clamp((x - S.toeStart) / (0.52 - S.toeStart), 0, 1);
    y += S.toeSpring * t * t;
    if (S.heelBevel) { const h = clamp((-0.43 - x) / 0.08, 0, 1); y += S.heelBevel * h * h; }
    return y;
  };
  const stack = (x) => lerp(S.heelStack, S.foreStack, sstep(-0.28, 0.26, x)) * (1 - S.toeTaper * sstep(0.26, 0.54, x));
  const foot = (x) => ground(x) + stack(x);
  const wrap = (x) => S.wrap * (1 + (S.heelWrap || 0) * sstep(-0.2, -0.47, x));
  const top = (x) => foot(x) + wrap(x);
  return { ground, stack, foot, wrap, top };
}

// [outward offset, height (fraction of wall, or absolute above ground when 3rd item is 1)]
const SOLE_PROFILES = {
  foam: [[-0.014, 0], [-0.007, 0.018], [-0.002, 0.06], [0.0015, 0.16], [0.003, 0.34], [0.003, 0.55], [0.0015, 0.74], [-0.001, 0.87], [-0.005, 0.95], [-0.01, 0.99], [-0.014, 1]],
  cup: [[-0.006, 0], [-0.002, 0.025], [0.0005, 0.08], [0.0012, 0.3], [0.0012, 0.7], [0.0005, 0.9], [-0.0015, 0.97], [-0.005, 1]],
  vulc: [[-0.005, 0], [-0.0015, 0.04], [0.0008, 0.16], [0.001, 0.5], [0.0008, 0.84], [-0.001, 0.95], [-0.004, 1]],
  lug: [[-0.01, 0], [-0.002, 0.006, 1], [0.002, 0.016, 1], [0.003, 0.028, 1], [-0.001, 0.036, 1], [0.0015, 0.5], [0.0015, 0.8], [-0.001, 0.94], [-0.005, 1]],
  thin: [[-0.003, 0], [0, 0.2], [0, 0.8], [-0.002, 1]],
};

// ------------------------------------------------------------------ curve helpers
function catmull(p0, p1, p2, p3, t, out = new V3()) {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return out.set(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
}
function bez(a, b, c, d, t, out = new V3()) {
  const u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return out.set(a.x * w0 + b.x * w1 + c.x * w2 + d.x * w3, a.y * w0 + b.y * w1 + c.y * w2 + d.y * w3, a.z * w0 + b.z * w1 + c.z * w2 + d.z * w3);
}

// Opening loop (topline + lace gap + collar). Lateral keypoints [x, h, z, xb, slope]:
// h is measured above the footbed, xb is the base-outline x that maps onto this keypoint
// (in normalized -0.5..0.5 length units), slope 0 = surface arrives horizontally, 1 = vertically.
export function openingLoop(kpLat, F, O) {
  const n = kpLat.length - 1;
  const span = O.maxX - O.minX;
  const kp = kpLat.map(([x, h, z, xb, s]) => ({ p: new V3(x, F.foot(x) + h, z), xb: O.minX + (xb + 0.5) * span, s }));
  const pts = [], sl = [];
  for (let k = 0; k <= n; k++) { pts.push(kp[k].p); sl.push(kp[k].s); }
  for (let k = n - 1; k >= 1; k--) { const q = kp[k].p; pts.push(new V3(q.x, q.y, -q.z)); sl.push(kp[k].s); }
  const L = pts.length;
  const wrapT = (t) => ((t % L) + L) % L;
  const at = (tau, out = new V3()) => {
    const t = wrapT(tau); const i = Math.floor(t), f = t - i;
    return catmull(pts[(i - 1 + L) % L], pts[i], pts[(i + 1) % L], pts[(i + 2) % L], f, out);
  };
  const slope = (tau) => { const t = wrapT(tau); const i = Math.floor(t), f = t - i; return lerp(sl[i], sl[(i + 1) % L], f); };
  const tangent = (tau) => at(tau + 0.01).sub(at(tau - 0.01)).normalize();
  const outward = (tau) => { const T = tangent(tau); return new V3(T.z, 0, -T.x).normalize(); };
  const down = (tau) => { const s = slope(tau); return outward(tau).multiplyScalar(1 - s).add(new V3(0, -s, 0)).normalize(); };
  const tauFor = (x, lateral) => {
    let k = 0;
    while (k < n - 1 && x < kp[k + 1].xb) k++;
    const a = kp[k].xb, b = kp[k + 1].xb;
    const t = k + clamp((a - x) / (a - b), 0, 1);
    return lateral ? t : wrapT(L - t);
  };
  return { at, slope, tangent, outward, down, tauFor, n, L };
}

// ------------------------------------------------------------------ geometry helpers
// rows: array of rows (each an array of Vector3 of equal length); normals from finite differences.
function gridGeometry(rows, { wrap = false, flip = false, uv, uv1, fallback } = {}) {
  const R = rows.length, C = rows[0].length;
  const pos = new Float32Array(R * C * 3), nor = new Float32Array(R * C * 3);
  const uvA = uv ? new Float32Array(R * C * 2) : null, uv1A = uv1 ? new Float32Array(R * C * 2) : null;
  const a = new V3(), b = new V3(), n = new V3();
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const k = r * C + c, p = rows[r][c];
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      const cm = wrap ? (c - 1 + C) % C : Math.max(0, c - 1), cp = wrap ? (c + 1) % C : Math.min(C - 1, c + 1);
      const rm = Math.max(0, r - 1), rp = Math.min(R - 1, r + 1);
      a.subVectors(rows[rp][c], rows[rm][c]);
      b.subVectors(rows[r][cp], rows[r][cm]);
      n.crossVectors(a, b);
      if (n.lengthSq() < 1e-14) {
        // degenerate (collapsed row): borrow from the neighbouring row
        const r2 = r === 0 ? 1 : r - 1;
        a.subVectors(rows[Math.min(R - 1, r2 + 1)][c], rows[Math.max(0, r2 - 1)][c]);
        b.subVectors(rows[r2][cp], rows[r2][cm]);
        n.crossVectors(a, b);
        if (n.lengthSq() < 1e-14 && fallback) n.copy(fallback);
      }
      n.normalize(); if (flip) n.negate();
      nor[k * 3] = n.x; nor[k * 3 + 1] = n.y; nor[k * 3 + 2] = n.z;
      if (uvA) { const t = uv(p, r, c); uvA[k * 2] = t[0]; uvA[k * 2 + 1] = t[1]; }
      if (uv1A) { const t = uv1(p, r, c); uv1A[k * 2] = t[0]; uv1A[k * 2 + 1] = t[1]; }
    }
  }
  const idx = [];
  const cMax = wrap ? C : C - 1;
  for (let r = 0; r < R - 1; r++) {
    for (let c = 0; c < cMax; c++) {
      const c2 = (c + 1) % C;
      const i0 = r * C + c, i1 = (r + 1) * C + c, i2 = (r + 1) * C + c2, i3 = r * C + c2;
      if (flip) idx.push(i0, i3, i1, i1, i3, i2); else idx.push(i0, i1, i3, i1, i2, i3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uvA) g.setAttribute('uv', new THREE.BufferAttribute(uvA, 2));
  if (uv1A) g.setAttribute('uv1', new THREE.BufferAttribute(uv1A, 2));
  g.setIndex(idx);
  return g;
}

// Tube swept along pathFn(t), t∈[t0,t1]. refFn(t) gives a vector used to fix the frame
// (projected perpendicular to the tangent); without it, parallel transport is used.
function sweepTube(pathFn, t0, t1, n, radiusFn, { radial = 10, refFn, squash = 1, uvScale = 1 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(pathFn(lerp(t0, t1, i / n)));
  const tans = pts.map((_, i) => pts[Math.min(n, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize());
  let nrm = refFn ? refFn(t0).clone() : new V3(0, 1, 0);
  if (Math.abs(nrm.dot(tans[0])) > 0.95) nrm = new V3(1, 0, 0);
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const T = tans[i];
    if (refFn) nrm = refFn(lerp(t0, t1, i / n)).clone();
    else if (i > 0) {
      const axis = new V3().crossVectors(tans[i - 1], T), len = axis.length();
      if (len > 1e-7) nrm.applyAxisAngle(axis.divideScalar(len), Math.asin(clamp(len, -1, 1)));
    }
    nrm.sub(T.clone().multiplyScalar(nrm.dot(T))).normalize();
    const bin = new V3().crossVectors(T, nrm);
    const r = radiusFn(i / n), row = [];
    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      row.push(pts[i].clone().addScaledVector(nrm, Math.cos(ang) * r * squash).addScaledVector(bin, Math.sin(ang) * r));
    }
    rows.push(row);
  }
  return gridGeometry(rows, { wrap: true, flip: true, uv: (p, r, c) => [c / radial, (r / n) * uvScale] });
}

// Flat ribbon along a curve; widthFn(t) gives the (unit) across vector at t.
function ribbon(curve, n, width, widthDirFn, { lift = 0, taperEnd = false } = {}) {
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t), T = curve.getTangent(t);
    const W = widthDirFn(t).clone(); W.sub(T.clone().multiplyScalar(W.dot(T))).normalize();
    const N = new V3().crossVectors(T, W).normalize();
    let hw = width / 2;
    if (taperEnd && t > 0.85) hw *= 0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - ((t - 0.85) / 0.15) ** 2));
    const c = p.clone().addScaledVector(N, lift);
    rows.push([c.clone().addScaledVector(W, -hw), c.clone(), c.clone().addScaledVector(W, hw)]);
  }
  return gridGeometry(rows, { uv: (p, r, c) => [c / 2, r / n] });
}

// ------------------------------------------------------------------ silhouettes
const OPEN = {
  runner: [
    [0.160, 0.150, 0.000, 0.500, 0.10], [0.138, 0.156, 0.024, 0.440, 0.25], [0.080, 0.172, 0.032, 0.330, 0.35],
    [0.000, 0.194, 0.034, 0.180, 0.40], [-0.070, 0.216, 0.036, 0.040, 0.45], [-0.130, 0.236, 0.040, -0.080, 0.55],
    [-0.180, 0.214, 0.082, -0.170, 0.85], [-0.250, 0.180, 0.112, -0.260, 0.92], [-0.330, 0.178, 0.118, -0.350, 0.94],
    [-0.410, 0.192, 0.090, -0.440, 0.94], [-0.455, 0.206, 0.046, -0.485, 0.92], [-0.470, 0.212, 0.000, -0.500, 0.90],
  ],
  court: [
    [0.170, 0.140, 0.000, 0.500, 0.10], [0.148, 0.146, 0.023, 0.440, 0.25], [0.090, 0.160, 0.031, 0.330, 0.35],
    [0.010, 0.182, 0.033, 0.180, 0.40], [-0.060, 0.204, 0.035, 0.040, 0.45], [-0.120, 0.224, 0.039, -0.080, 0.55],
    [-0.172, 0.206, 0.082, -0.170, 0.85], [-0.244, 0.176, 0.112, -0.260, 0.92], [-0.330, 0.172, 0.118, -0.350, 0.94],
    [-0.410, 0.184, 0.090, -0.440, 0.94], [-0.455, 0.196, 0.046, -0.485, 0.92], [-0.470, 0.200, 0.000, -0.500, 0.90],
  ],
  hightop: [
    [0.170, 0.142, 0.000, 0.500, 0.10], [0.150, 0.148, 0.024, 0.440, 0.25], [0.090, 0.164, 0.032, 0.330, 0.35],
    [0.010, 0.196, 0.034, 0.190, 0.42], [-0.060, 0.250, 0.036, 0.070, 0.52], [-0.100, 0.330, 0.038, -0.030, 0.66],
    [-0.130, 0.410, 0.042, -0.120, 0.80], [-0.185, 0.408, 0.094, -0.200, 0.95], [-0.270, 0.398, 0.116, -0.290, 0.97],
    [-0.360, 0.402, 0.108, -0.380, 0.97], [-0.420, 0.416, 0.070, -0.450, 0.96], [-0.442, 0.422, 0.000, -0.500, 0.95],
  ],
  hiker: [
    [0.180, 0.150, 0.000, 0.500, 0.10], [0.160, 0.156, 0.026, 0.440, 0.25], [0.100, 0.172, 0.034, 0.330, 0.35],
    [0.020, 0.205, 0.036, 0.190, 0.42], [-0.050, 0.262, 0.038, 0.070, 0.55], [-0.090, 0.345, 0.040, -0.030, 0.70],
    [-0.115, 0.430, 0.044, -0.120, 0.85], [-0.170, 0.438, 0.100, -0.200, 0.97], [-0.260, 0.430, 0.124, -0.290, 0.98],
    [-0.360, 0.432, 0.114, -0.380, 0.98], [-0.425, 0.444, 0.074, -0.450, 0.97], [-0.448, 0.450, 0.000, -0.500, 0.96],
  ],
  chelsea: [
    [-0.010, 0.470, 0.000, 0.500, 1.0], [-0.030, 0.470, 0.074, 0.300, 1.0], [-0.100, 0.466, 0.126, 0.060, 1.0],
    [-0.200, 0.460, 0.146, -0.180, 1.0], [-0.310, 0.462, 0.132, -0.350, 1.0], [-0.400, 0.468, 0.078, -0.460, 1.0],
    [-0.428, 0.470, 0.000, -0.500, 1.0],
  ],
  slipon: [
    [0.070, 0.190, 0.000, 0.500, 0.20], [0.050, 0.193, 0.042, 0.380, 0.35], [-0.010, 0.196, 0.062, 0.240, 0.50],
    [-0.090, 0.190, 0.084, 0.080, 0.70], [-0.170, 0.172, 0.106, -0.110, 0.86], [-0.255, 0.152, 0.116, -0.270, 0.92],
    [-0.345, 0.150, 0.114, -0.370, 0.94], [-0.418, 0.162, 0.086, -0.450, 0.94], [-0.458, 0.174, 0.040, -0.490, 0.92],
    [-0.470, 0.178, 0.000, -0.500, 0.90],
  ],
  flat: [
    [0.250, 0.078, 0.000, 0.500, 0.30], [0.222, 0.075, 0.058, 0.420, 0.50], [0.140, 0.062, 0.102, 0.260, 0.72],
    [0.030, 0.050, 0.120, 0.080, 0.86], [-0.120, 0.050, 0.118, -0.140, 0.90], [-0.280, 0.064, 0.108, -0.310, 0.92],
    [-0.400, 0.080, 0.080, -0.430, 0.92], [-0.455, 0.086, 0.036, -0.490, 0.90], [-0.468, 0.088, 0.000, -0.500, 0.90],
  ],
  pump: [
    [0.225, 0.096, 0.000, 0.500, 0.30], [0.195, 0.091, 0.052, 0.420, 0.50], [0.110, 0.07, 0.098, 0.250, 0.72],
    [0.000, 0.058, 0.114, 0.060, 0.86], [-0.140, 0.064, 0.112, -0.150, 0.90], [-0.290, 0.084, 0.104, -0.320, 0.92],
    [-0.400, 0.098, 0.078, -0.430, 0.92], [-0.455, 0.104, 0.034, -0.490, 0.90], [-0.468, 0.106, 0.000, -0.500, 0.90],
  ],
  foot: [
    [-0.080, 0.300, 0.000, 0.500, 0.95], [-0.118, 0.300, 0.080, 0.170, 1.0], [-0.215, 0.300, 0.112, -0.180, 1.0],
    [-0.312, 0.300, 0.086, -0.400, 1.0], [-0.356, 0.300, 0.000, -0.500, 1.0],
  ],
};

export const MODELS = {
  runner: {
    style: 'runner', width: 1.0, toe: 'round', maxH: 0.44, material: 'knit',
    sole: { profile: 'foam', heelStack: 0.112, foreStack: 0.07, toeSpring: 0.052, toeStart: 0.18, heelBevel: 0.016, toeTaper: 0.3, flare: 0.026, wrap: 0.012, heelWrap: 0.8, outsole: 0.014 },
    upper: { shoulderH: 0.09, shoulderIn: 0.022, toeIn: 0.04, bulge: 0.18, vampLift: 1 },
    open: OPEN.runner, closure: 'laces', eyelets: 6, eyestay: [1.15, 5], collar: 5, collarR: [0.012, 0.018],
    tongue: { rise: 0.066, width: 0.058, droop: 0.022 }, heelTab: 'loop',
  },
  court: {
    style: 'court', width: 1.0, toe: 'round', maxH: 0.42, material: 'leather',
    sole: { profile: 'cup', heelStack: 0.088, foreStack: 0.078, toeSpring: 0.024, toeStart: 0.26, heelBevel: 0.006, toeTaper: 0.22, flare: 0.012, wrap: 0.024, heelWrap: 0.2, outsole: 0.012 },
    upper: { shoulderH: 0.082, shoulderIn: 0.018, toeIn: 0.035, bulge: 0.12, vampLift: 1 },
    open: OPEN.court, closure: 'laces', eyelets: 7, eyestay: [1.1, 5], collar: 5, collarR: [0.011, 0.016],
    tongue: { rise: 0.06, width: 0.056, droop: 0.02 }, heelTab: 'tab',
  },
  hightop: {
    style: 'hightop', width: 1.0, toe: 'round', maxH: 0.62, material: 'leather',
    sole: { profile: 'cup', heelStack: 0.092, foreStack: 0.08, toeSpring: 0.026, toeStart: 0.26, heelBevel: 0.006, toeTaper: 0.22, flare: 0.013, wrap: 0.026, heelWrap: 0.2, outsole: 0.012 },
    upper: { shoulderH: 0.085, shoulderIn: 0.02, toeIn: 0.038, bulge: 0.14, vampLift: 0.8 },
    open: OPEN.hightop, closure: 'laces', eyelets: 8, eyestay: [1.1, 6], collar: 6, collarR: [0.013, 0.02],
    tongue: { rise: 0.07, width: 0.06, droop: 0.022 }, heelTab: 'tab',
  },
  hiker: {
    style: 'hiker', width: 1.04, toe: 'round', maxH: 0.66, material: 'suede',
    sole: { profile: 'lug', heelStack: 0.118, foreStack: 0.088, toeSpring: 0.042, toeStart: 0.22, heelBevel: 0.018, toeTaper: 0.2, flare: 0.022, wrap: 0.016, heelWrap: 0.6, outsole: 0.036, lugs: 0.007 },
    upper: { shoulderH: 0.092, shoulderIn: 0.022, toeIn: 0.045, bulge: 0.14, vampLift: 0.55 },
    open: OPEN.hiker, closure: 'laces', eyelets: 7, eyestay: [1.1, 6], collar: 6, collarR: [0.016, 0.024],
    tongue: { rise: 0.06, width: 0.064, droop: 0.024 }, heelTab: 'loop',
  },
  chelsea: {
    style: 'chelsea', width: 0.98, toe: 'round', maxH: 0.66, material: 'leather',
    sole: { profile: 'cup', heelStack: 0.09, foreStack: 0.052, toeSpring: 0.03, toeStart: 0.25, heelBevel: 0.004, toeTaper: 0.12, flare: 0.012, wrap: 0.006, heelWrap: 0, outsole: 0.02 },
    upper: { shoulderH: 0.085, shoulderIn: 0.02, toeIn: 0.05, bulge: 0.1, vampLift: 0.32 },
    open: OPEN.chelsea, closure: 'none', collar: 0, collarR: [0.006, 0.006], heelTab: 'pull',
  },
  slipon: {
    style: 'slipon', width: 1.0, toe: 'round', maxH: 0.36, material: 'canvas',
    sole: { profile: 'vulc', heelStack: 0.064, foreStack: 0.058, toeSpring: 0.02, toeStart: 0.28, heelBevel: 0.004, toeTaper: 0.1, flare: 0.01, wrap: 0.022, heelWrap: 0, outsole: 0.01 },
    upper: { shoulderH: 0.076, shoulderIn: 0.018, toeIn: 0.035, bulge: 0.1, vampLift: 1 },
    open: OPEN.slipon, closure: 'none', collar: 0, collarR: [0.006, 0.015], heelTab: 'none',
  },
  flat: {
    style: 'flat', width: 0.94, toe: 'round', maxH: 0.26, material: 'leather',
    sole: { profile: 'thin', heelStack: 0.03, foreStack: 0.014, toeSpring: 0.012, toeStart: 0.3, heelBevel: 0, toeTaper: 0, flare: 0.004, wrap: 0.002, heelWrap: 0, outsole: 0.006 },
    upper: { shoulderH: 0.062, shoulderIn: 0.012, toeIn: 0.03, bulge: 0.05, vampLift: 1 },
    open: OPEN.flat, closure: 'none', collar: 0, collarR: [0.0042, 0.0042], heelTab: 'none', bow: true,
  },
  pump: {
    style: 'pump', width: 0.92, toe: 'almond', maxH: 0.44, material: 'patent',
    sole: { profile: 'thin', heelHeight: 0.2, archStart: -0.3, archEnd: 0.14, heelStack: 0.013, foreStack: 0.013, toeSpring: 0.014, toeStart: 0.3, heelBevel: 0, toeTaper: 0, flare: 0.004, wrap: 0.002, heelWrap: 0, outsole: 0.004, breastX: -0.3 },
    upper: { shoulderH: 0.05, shoulderIn: 0.012, toeIn: 0.034, bulge: 0.05, vampLift: 1 },
    open: OPEN.pump, closure: 'none', collar: 0, collarR: [0.0042, 0.0042], heelTab: 'none',
  },
  kids: {
    style: 'kids', width: 1.1, toe: 'wide', maxH: 0.46, material: 'mesh',
    sole: { profile: 'foam', heelStack: 0.1, foreStack: 0.078, toeSpring: 0.05, toeStart: 0.2, heelBevel: 0.012, toeTaper: 0.18, flare: 0.024, wrap: 0.024, heelWrap: 0.3, outsole: 0.016 },
    upper: { shoulderH: 0.1, shoulderIn: 0.026, toeIn: 0.045, bulge: 0.2, vampLift: 1 },
    open: OPEN.runner, closure: 'straps', straps: [1.7, 3.6], eyestay: [1.15, 5], collar: 5, collarR: [0.013, 0.02],
    tongue: { rise: 0.06, width: 0.06, droop: 0.022 }, heelTab: 'loop',
  },
};

// ------------------------------------------------------------------ per-silhouette geometry (cached)
const geoCache = new Map();

function soleWallRows(O, F, S) {
  const prof = SOLE_PROFILES[S.profile];
  const M = O.P.length;
  const lugW = (i) => sstep(-0.35, 0.35, Math.cos((O.arc[i] / 0.042) * Math.PI * 2));
  const rows = [];
  for (const [d, h, abs] of prof) {
    const row = [];
    for (let i = 0; i < M; i++) {
      let dd = S.flare + d;
      if (S.lugs && abs && h > 0.004 && h < 0.033) dd += S.lugs * lugW(i);
      const p = O.P[i].clone().addScaledVector(O.N[i], dd);
      const g = F.ground(p.x), t = F.top(p.x);
      p.y = abs ? Math.min(g + h, lerp(g, t, 0.5)) : lerp(g, t, h);
      row.push(p);
    }
    rows.push(row);
  }
  rows.push(O.P.map((q, i) => { const p = q.clone().addScaledVector(O.N[i], -0.014); p.y = F.top(p.x) - 0.0015; return p; }));
  return rows;
}

// Cap between the lateral and medial halves of a ring (toe → heel), for outsole / insole.
function capRows(ring, yFn, K = 14) {
  const M = ring.length, H = M / 2, rows = [];
  for (let r = 0; r <= H; r++) {
    const a = ring[r % M], b = ring[(M - r) % M], row = [];
    for (let c = 0; c <= K; c++) {
      const t = c / K;
      const p = new V3(lerp(a.x, b.x, t), 0, lerp(a.z, b.z, t));
      p.y = yFn(p.x);
      row.push(p);
    }
    rows.push(row);
  }
  return rows;
}

function upperRows(O, F, U, loop) {
  const M = O.P.length, H = M / 2;
  const rows = Array.from({ length: R_UP + 1 }, () => new Array(M));
  const tauCol = new Float32Array(M);
  for (let i = 0; i < M; i++) {
    const b0 = O.P[i], nb = O.N[i];
    const B = b0.clone().addScaledVector(nb, U.baseOffset || 0);
    B.y = F.foot(B.x) - (U.baseDrop ?? 0.004);
    const tau = loop.tauFor(b0.x, i <= H);
    tauCol[i] = tau;
    const C = loop.at(tau);
    const TC = loop.down(tau).negate();
    const rise = Math.max(0.01, C.y - B.y);
    const front = sstep(-0.12, 0.26, b0.x);
    const toeZone = sstep(0.3, 0.5, b0.x);
    const hs = Math.min(U.shoulderH * lerp(1, 0.92, toeZone), rise * 0.64);
    const ins = U.shoulderIn * lerp(0.45, 1, front) + U.toeIn * toeZone;
    const Sh = B.clone().addScaledVector(UP, hs).addScaledVector(nb, -ins);
    Sh.x += (C.x - B.x) * 0.1; Sh.z += (C.z - B.z) * 0.1;
    // on narrow (almond) toes the inset must not push the shoulder across the centre line
    if (Math.abs(B.z) > 1e-4 && (Math.sign(Sh.z) !== Math.sign(B.z) || Math.abs(Sh.z) < Math.abs(B.z) * 0.45)) Sh.z = B.z * 0.45;
    const TB = new V3(nb.x * U.bulge, 1, nb.z * U.bulge).normalize();
    const d = C.clone().sub(B);
    const lam = lerp(1, U.vampLift ?? 1, front);
    const TS = new V3(d.x, d.y * lam, d.z).normalize();
    const L1 = Sh.distanceTo(B), L2 = C.distanceTo(Sh);
    const k1 = 0.36 + 0.3 * (1 - Math.abs(TB.dot(TS)));
    const k2 = 0.36 + 0.3 * (1 - Math.abs(TS.dot(TC)));
    const A1 = B.clone().addScaledVector(TB, L1 * k1), A2 = Sh.clone().addScaledVector(TS, -L1 * k1);
    const B1 = Sh.clone().addScaledVector(TS, L2 * k2), B2 = C.clone().addScaledVector(TC, -L2 * k2);
    const v1 = L1 / (L1 + L2);
    for (let r = 0; r <= R_UP; r++) {
      const v = r / R_UP;
      rows[r][i] = v <= v1 ? bez(B, A1, A2, Sh, v / v1) : bez(Sh, B1, B2, C, (v - v1) / (1 - v1));
    }
  }
  return { rows, tauCol };
}

function upperGeometry(rows, O, ext) {
  const M = O.P.length;
  const perim = O.arc[M];
  const colLen = [];
  for (let i = 0; i < M; i++) {
    const acc = [0];
    for (let r = 1; r < rows.length; r++) acc.push(acc[r - 1] + rows[r][i].distanceTo(rows[r - 1][i]));
    colLen.push(acc);
  }
  return gridGeometry(rows, {
    wrap: true,
    uv: (p) => [(p.x - ext.X0) / (ext.X1 - ext.X0), (p.y - ext.Y0) / (ext.Y1 - ext.Y0)],
    uv1: (p, r, c) => [(O.arc[c] / perim) * perim, colLen[c][r]],
  });
}

function heelBlockGeometry(O, F, S) {
  const M = O.P.length, xb = S.breastX;
  const poly = [];
  for (let i = 0; i < M; i++) if (O.P[i].x < xb) poly.push(O.P[i].clone().addScaledVector(O.N[i], S.flare * 0.4));
  const a = poly[0], b = poly[poly.length - 1];
  for (let k = 1; k < 6; k++) poly.push(b.clone().lerp(a, k / 6));
  poly.push(a.clone());
  const ring = resamplePolyline(poly, 72); ring.pop();
  const cx = -0.44, top = S.heelHeight + 0.004, liftH = 0.014;
  const shape = (t) => ring.map((p) => new V3(cx + (p.x - cx) * lerp(1, 0.62, t), 0, p.z * lerp(1, 0.7, t)));
  const levels = [0, 0.18, 0.4, 0.62, 0.82, 1];
  const rowsBlock = levels.map((l) => { const t = Math.pow(l, 0.85); return shape(t).map((p) => (p.y = lerp(top, liftH, l), p)); });
  const bot = shape(1);
  const rowsLift = [bot.map((p) => new V3(p.x, liftH, p.z)), bot.map((p) => new V3(cx + (p.x - cx) * 0.995, 0.002, p.z * 0.995)), bot.map((p) => new V3(cx + (p.x - cx) * 0.97, 0, p.z * 0.97))];
  const block = gridGeometry(rowsBlock, { wrap: true, uv: (p, r, c) => [c / 72, r / 5] });
  const lift = gridGeometry(rowsLift, { wrap: true, uv: (p, r, c) => [c / 72, r / 2] });
  // top-lift cap
  const pts2 = rowsLift[2].map((p) => new THREE.Vector2(p.x, p.z));
  const tris = THREE.ShapeUtils.triangulateShape(pts2, []);
  const capPos = [], capNor = [], capUv = [], capIdx = [];
  pts2.forEach((q) => { capPos.push(q.x, 0, q.y); capNor.push(0, -1, 0); capUv.push(0, 0); });
  const probe = new V3().crossVectors(new V3(pts2[tris[0][1]].x - pts2[tris[0][0]].x, 0, pts2[tris[0][1]].y - pts2[tris[0][0]].y), new V3(pts2[tris[0][2]].x - pts2[tris[0][0]].x, 0, pts2[tris[0][2]].y - pts2[tris[0][0]].y));
  for (const [i, j, k] of tris) { if (probe.y > 0) capIdx.push(i, k, j); else capIdx.push(i, j, k); }
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
  cap.setAttribute('normal', new THREE.Float32BufferAttribute(capNor, 3));
  cap.setAttribute('uv', new THREE.Float32BufferAttribute(capUv, 2));
  cap.setIndex(capIdx);
  return { block, lift: mergeGeometries([lift, cap]) || lift };
}

function tongueData(loop, m) {
  const T = m.tongue, [e0, e1] = m.eyestay;
  const tip = loop.at(0);
  const cl = [new V3(tip.x + 0.05, tip.y - 0.036, 0), new V3(tip.x + 0.014, tip.y - 0.017, 0)];
  for (let k = 0; k <= 6; k++) { const q = loop.at(lerp(Math.max(0.35, e0 - 0.5), e1, k / 6)); cl.push(new V3(q.x, q.y - 0.007, 0)); }
  const top = loop.at(e1);
  cl.push(new V3(top.x - 0.018, top.y + T.rise * 0.45, 0));
  cl.push(new V3(top.x - 0.03, top.y + T.rise, 0));
  const curve = new THREE.CatmullRomCurve3(cl, false, 'centripetal');
  const RS = 44, CS = 16, Z = new V3(0, 0, 1);
  const rows = [];
  for (let r = 0; r <= RS; r++) {
    const s = r / RS;
    const c = curve.getPointAt(s), t = curve.getTangentAt(s);
    const nrm = new V3().crossVectors(t, Z).normalize();
    let hw = lerp(T.width * 0.86, T.width, s);
    if (s > 0.84) hw *= Math.sqrt(Math.max(0.0, 1 - ((s - 0.84) / 0.16) ** 2));
    hw = Math.max(hw, 0.0005);
    const row = [];
    for (let k = 0; k <= CS; k++) {
      const w = (k / CS) * 2 - 1;
      row.push(c.clone().addScaledVector(Z, w * hw).addScaledVector(nrm, -T.droop * w * w));
    }
    rows.push(row);
  }
  const geo = gridGeometry(rows, { uv: (p, r, c) => [1 - c / CS, r / RS] });
  // padded rim along the upper part of the tongue edge
  const edge = [];
  for (let r = Math.round(RS * 0.6); r <= RS; r++) edge.push(rows[r][CS]);
  for (let r = RS; r >= Math.round(RS * 0.6); r--) edge.push(rows[r][0]);
  const edgeCurve = new THREE.CatmullRomCurve3(edge, false, 'centripetal');
  const rim = sweepTube((t) => edgeCurve.getPoint(t), 0, 1, 60, (t) => 0.0052 * Math.min(1, Math.min(t, 1 - t) * 10 + 0.3), { radial: 8 });
  return { geo, rim };
}

function eyeletFrames(loop, m, count, range2) {
  const [e0, e1] = range2;
  const out = [];
  const center = new V3(-0.15, 0.04, 0);
  for (let j = 0; j < count; j++) {
    const tl = lerp(e0, e1, count === 1 ? 0 : j / (count - 1));
    for (const side of [1, -1]) {
      const tau = side > 0 ? tl : loop.L - tl;
      const C = loop.at(tau), D = loop.down(tau), T = loop.tangent(tau);
      const nrm = new V3().crossVectors(D, T).normalize();
      const p = C.clone().addScaledVector(D, 0.017);
      if (nrm.dot(p.clone().sub(center)) < 0) nrm.negate();
      p.addScaledVector(nrm, 0.0012);
      out.push({ j, side, tau, p, nrm, D, T });
    }
  }
  return out;
}

function laceGeometry(eyes, count) {
  const get = (j, s) => eyes.find((e) => e.j === j && e.side === s);
  const R = 0.0047, tubes = [];
  const bridge = (a, b, lift) => {
    const up = a.nrm.clone().add(b.nrm).normalize();
    const mid = a.p.clone().add(b.p).multiplyScalar(0.5).addScaledVector(up, lift);
    const p0 = a.p.clone().addScaledVector(a.nrm, 0.0025), p1 = b.p.clone().addScaledVector(b.nrm, 0.0025);
    const q0 = p0.clone().lerp(mid, 0.35).addScaledVector(up, lift * 0.35), q1 = p1.clone().lerp(mid, 0.35).addScaledVector(up, lift * 0.35);
    const curve = new THREE.CatmullRomCurve3([p0, q0, mid, q1, p1], false, 'centripetal');
    tubes.push(sweepTube((t) => curve.getPoint(t), 0, 1, 18, () => R, { radial: 7, squash: 0.62 }));
  };
  bridge(get(0, 1), get(0, -1), 0.007);
  for (let j = 0; j < count - 1; j++) {
    bridge(get(j, 1), get(j + 1, -1), 0.009);
    bridge(get(j, -1), get(j + 1, 1), 0.018);
  }
  // bow at the top pair
  const a = get(count - 1, 1), b = get(count - 1, -1);
  const up = a.nrm.clone().add(b.nrm).normalize();
  const K = a.p.clone().add(b.p).multiplyScalar(0.5).addScaledVector(up, 0.02);
  const fwd = new V3(1, 0, 0).addScaledVector(up, -up.x).normalize();
  const side = new V3(0, 0, 1);
  const loopCurve = (s) => new THREE.CatmullRomCurve3([
    K.clone(), K.clone().addScaledVector(side, 0.03 * s).addScaledVector(up, 0.012).addScaledVector(fwd, -0.012),
    K.clone().addScaledVector(side, 0.068 * s).addScaledVector(up, 0.004).addScaledVector(fwd, -0.004),
    K.clone().addScaledVector(side, 0.06 * s).addScaledVector(up, -0.006).addScaledVector(fwd, 0.026),
    K.clone().addScaledVector(side, 0.02 * s).addScaledVector(up, 0.002).addScaledVector(fwd, 0.012), K.clone(),
  ], false, 'centripetal');
  const tailCurve = (s) => new THREE.CatmullRomCurve3([
    K.clone(), K.clone().addScaledVector(side, 0.018 * s).addScaledVector(fwd, 0.03).addScaledVector(up, -0.004),
    K.clone().addScaledVector(side, 0.04 * s).addScaledVector(fwd, 0.07).addScaledVector(up, -0.018),
    K.clone().addScaledVector(side, 0.05 * s).addScaledVector(fwd, 0.1).addScaledVector(up, -0.034),
  ], false, 'centripetal');
  for (const s of [1, -1]) {
    const lc = loopCurve(s);
    tubes.push(sweepTube((t) => lc.getPoint(t), 0, 1, 26, () => R, { radial: 7, squash: 0.62 }));
  }
  const aglets = [];
  for (const s of [1, -1]) {
    const tc = tailCurve(s * (s > 0 ? 1 : 0.7));
    tubes.push(sweepTube((t) => tc.getPoint(t), 0, 0.86, 18, () => R, { radial: 7, squash: 0.62 }));
    aglets.push(sweepTube((t) => tc.getPoint(t), 0.85, 1, 5, (t) => R * (t > 0.85 ? 0.8 : 1.12), { radial: 8 }));
  }
  tubes.push(new THREE.SphereGeometry(0.0085, 12, 8).translate(K.x, K.y, K.z));
  return { lace: mergeGeometries(tubes.map((g) => (g.index ? g : g))), aglet: mergeGeometries(aglets) };
}

function eyeletGeometry(eyes) {
  const parts = eyes.map((e) => {
    const g = new THREE.TorusGeometry(0.0072, 0.0021, 6, 14);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), e.nrm);
    g.applyQuaternion(q).translate(e.p.x, e.p.y, e.p.z);
    g.deleteAttribute('uv');
    return g;
  });
  return mergeGeometries(parts);
}

// Velcro straps: slice the upper with the plane x = x0 (rays cast from inside the shoe),
// follow that cross-section over the lace gap and down the lateral side.
function strapGeometry(upperGeo, loop, F, taus) {
  const probe = new THREE.Mesh(upperGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const rc = new THREE.Raycaster();
  const straps = [];
  for (const tl of taus) {
    const x0 = loop.at(tl).x;
    const origin = new V3(x0, F.foot(x0) + 0.045, 0);
    const med = [], lat = [];
    let phase = 0;
    for (let k = 0; k <= 75; k++) {
      const th = THREE.MathUtils.degToRad(-70 + (k / 75) * 150);
      rc.set(origin, new V3(0, Math.cos(th), Math.sin(th)));
      const hit = rc.intersectObject(probe, false)[0];
      if (hit && hit.distance < 0.4) {
        const p = hit.point.clone().addScaledVector(hit.face.normal.clone().normalize(), 0.0055);
        (phase === 0 ? med : lat).push(p);
      } else if (med.length) phase = 1;
    }
    if (med.length < 2 || lat.length < 2) continue;
    const a = med[med.length - 1], b = lat[0];
    const mid = a.clone().lerp(b, 0.5); mid.y = Math.max(a.y, b.y) + 0.008;
    const pts = [...med.filter((_, i) => i % 3 === 0 && i < med.length - 2), a, mid, b, ...lat.filter((_, i) => i % 3 === 0 && i > 1)];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    straps.push(ribbon(curve, 70, 0.074, () => new V3(1, 0, 0), { taperEnd: true }));
  }
  probe.material.dispose();
  return mergeGeometries(straps);
}

function pullLoop(base, outward, width, height, across) {
  const pts = [
    base.clone().addScaledVector(outward, 0.004).addScaledVector(UP, -0.03),
    base.clone().addScaledVector(outward, 0.006).addScaledVector(UP, 0.012),
    base.clone().addScaledVector(outward, 0.0).addScaledVector(UP, height),
    base.clone().addScaledVector(outward, -0.012).addScaledVector(UP, 0.01),
    base.clone().addScaledVector(outward, -0.012).addScaledVector(UP, -0.025),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  return ribbon(curve, 24, width, () => across);
}

function bowGeometry(loop) {
  const C = loop.at(0);
  const parts = [];
  for (const s of [1, -1]) {
    const g = new THREE.TorusGeometry(0.022, 0.0065, 8, 20);
    g.scale(1, 0.55, 0.45).rotateY(s > 0 ? -0.35 : 0.35).rotateZ(0.2);
    g.translate(C.x + 0.004, C.y + 0.004, C.z + 0.024 * s);
    g.deleteAttribute('uv');
    parts.push(g);
  }
  const knot = new THREE.SphereGeometry(0.011, 12, 8); knot.scale(1, 0.75, 1.1).translate(C.x + 0.004, C.y + 0.004, C.z);
  knot.deleteAttribute('uv');
  parts.push(knot);
  return mergeGeometries(parts);
}

export function getModelGeometry(id) {
  if (geoCache.has(id)) return geoCache.get(id);
  const m = MODELS[id];
  const O = getOutline(m.width, m.toe);
  const S = m.sole, F = soleFns(S);
  const loop = openingLoop(m.open, F, O);
  const soleTop = Math.max(...range(-0.6, 0.6, 80).map(F.top));
  const ext = {
    upper: { X0: -0.6, X1: 0.6, Y0: -0.02, Y1: m.maxH },
    sole: { X0: -0.6, X1: 0.6, Y0: -0.01, Y1: soleTop + 0.02 },
    tread: { X0: -0.6, X1: 0.6, Z0: -0.3, Z1: 0.3 },
  };
  const sideUV = (e) => (p) => [(p.x - e.X0) / (e.X1 - e.X0), (p.y - e.Y0) / (e.Y1 - e.Y0)];
  const planUV = (e) => (p) => [(p.x - e.X0) / (e.X1 - e.X0), (p.z - e.Z0) / (e.Z1 - e.Z0)];

  const wallRows = soleWallRows(O, F, S);
  const wall = gridGeometry(wallRows, { wrap: true, uv: sideUV(ext.sole) });
  const bottom = gridGeometry(capRows(wallRows[0], (x) => F.ground(x) + 0.0004), { uv: planUV(ext.tread), fallback: new V3(0, -1, 0) });
  const insoleRing = O.P.map((q, i) => q.clone().addScaledVector(O.N[i], -0.012));
  const insole = gridGeometry(capRows(insoleRing, (x) => F.foot(x) + 0.0015), { flip: true, uv: planUV(ext.tread), fallback: new V3(0, 1, 0) });

  const { rows, tauCol } = upperRows(O, F, m.upper, loop);
  const upper = upperGeometry(rows, O, ext.upper);

  const G = { id, m, O, F, loop, ext, wall, bottom, insole, upper, rows, tauCol };

  // topline in side view (lateral half), for painting
  const tl = [];
  for (let k = 0; k <= 240; k++) { const p = loop.at((k / 240) * loop.n); tl.push([p.x, p.y]); }
  G.topline = tl;
  G.topY = (x) => {
    if (x >= tl[0][0]) return tl[0][1];
    for (let k = 1; k < tl.length; k++) if (x >= tl[k][0]) { const [x0, y0] = tl[k - 1], [x1, y1] = tl[k]; return lerp(y0, y1, (x0 - x) / (x0 - x1 || 1)); }
    return tl[tl.length - 1][1];
  };
  G.tipX = tl[0][0];
  G.backX = tl[tl.length - 1][0];

  // collar / topline tube
  const refDown = (t) => loop.down(t);
  if (m.collar > 0) {
    const t0 = m.collar, t1 = loop.L - m.collar;
    const [rEnd, rMid] = m.collarR;
    G.collar = sweepTube((t) => loop.at(t).addScaledVector(loop.down(t), 0.004).addScaledVector(loop.outward(t), -0.003), t0, t1, 90,
      (u) => { const e = Math.min(u, 1 - u); return lerp(rEnd * 0.35, lerp(rEnd, rMid, sstep(0.1, 0.5, e)), sstep(0, 0.05, e)); }, { radial: 12, refFn: refDown });
    G.eyeX = loop.at(m.collar).x;
  } else {
    const [rF, rB] = m.collarR;
    G.collar = sweepTube((t) => loop.at(t).addScaledVector(loop.down(t), rB * 0.3), 0, loop.L, 120,
      (u) => lerp(rF, rB, 0.5 - 0.5 * Math.cos(u * Math.PI * 2)), { radial: 10, refFn: refDown });
    G.eyeX = G.tipX;
  }

  if (m.closure === 'laces' || m.closure === 'straps') {
    const e1 = m.eyestay[1];
    G.rim = sweepTube((t) => loop.at(t).addScaledVector(loop.down(t), 0.003), -e1 - 0.2, e1 + 0.2, 70,
      (u) => { const e = Math.min(u, 1 - u); return 0.0048 * sstep(0, 0.06, e); }, { radial: 8, refFn: refDown });
    const tg = tongueData(loop, m);
    G.tongue = tg.geo; G.tongueRim = tg.rim;
  }
  if (m.closure === 'laces') {
    const eyes = eyeletFrames(loop, m, m.eyelets, m.eyestay);
    G.eyes = eyes;
    const lg = laceGeometry(eyes, m.eyelets);
    G.lace = lg.lace; G.aglet = lg.aglet;
    G.eyelet = eyeletGeometry(eyes);
  }
  if (m.closure === 'straps') {
    G.straps = strapGeometry(upper, loop, F, m.straps);
  }
  if (m.heelTab === 'loop' || m.heelTab === 'tab') {
    const back = loop.at(loop.n);
    const pts = m.heelTab === 'loop'
      ? [back.clone().add(new V3(-0.012, -0.045, 0)), back.clone().add(new V3(-0.018, 0.0, 0)), back.clone().add(new V3(-0.01, 0.034, 0)), back.clone().add(new V3(0.004, 0.036, 0)), back.clone().add(new V3(0.012, 0.012, 0)), back.clone().add(new V3(0.012, -0.02, 0))]
      : [back.clone().add(new V3(-0.009, -0.07, 0)), back.clone().add(new V3(-0.016, -0.02, 0)), back.clone().add(new V3(-0.016, 0.018, 0)), back.clone().add(new V3(-0.008, 0.03, 0))];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    G.heelTab = ribbon(curve, 24, m.heelTab === 'loop' ? 0.024 : 0.052, () => new V3(0, 0, 1));
  }
  if (m.heelTab === 'pull') {
    const f = loop.at(0), b = loop.at(loop.n);
    G.heelTab = mergeGeometries([
      pullLoop(f, new V3(1, 0, 0), 0.036, 0.05, new V3(0, 0, 1)),
      pullLoop(b, new V3(-1, 0, 0), 0.036, 0.05, new V3(0, 0, 1)),
    ]);
  }
  if (m.bow) G.bow = bowGeometry(loop);
  if (S.heelHeight) { const hb = heelBlockGeometry(O, F, S); G.heelBlock = hb.block; G.heelLift = hb.lift; }

  // bounds for framing
  const box = new THREE.Box3().setFromBufferAttribute(upper.getAttribute('position'));
  box.union(new THREE.Box3().setFromBufferAttribute(wall.getAttribute('position')));
  if (G.tongue) box.union(new THREE.Box3().setFromBufferAttribute(G.tongue.getAttribute('position')));
  box.min.y = 0;
  G.bounds = box;
  G.ankle = new V3(-0.24, F.foot(-0.24), 0);
  geoCache.set(id, G);
  return G;
}

// ------------------------------------------------------------------ colours
function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex([r, g, b]) { return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
export function shade(hex, amt) {
  const c = hexToRgb(hex);
  return rgbToHex(c.map((v) => (amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
}
export function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => lerp(v, B[i], t))); }
function luma(hex) { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

function resolveColors(c) {
  const upper = c.upper || '#dddddd';
  const out = {
    upper, overlay: c.overlay || shade(upper, -0.12), accent: c.accent || '#ff5a1f', logo: c.logo || c.accent || '#111111',
    sole: c.sole || '#f4f2ee', outsole: c.outsole || '#2a2a2a', lace: c.lace || upper, lining: c.lining || shade(upper, -0.35),
    eyelet: c.eyelet || '#c9ccd1', heel: c.heel || c.upper, pod: c.pod || c.accent || '#ff5a1f',
  };
  out.collar = c.collar || out.lining;
  out.tongue = c.tongue || upper;
  out.stitch = c.stitch || (luma(out.overlay) > 0.55 ? shade(out.overlay, -0.35) : shade(out.overlay, 0.35));
  out.strap = c.strap || out.overlay;
  return out;
}

// ------------------------------------------------------------------ canvas helpers
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function sideCanvas(e, W) {
  const H = Math.round((W * (e.Y1 - e.Y0)) / (e.X1 - e.X0));
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const sx = W / (e.X1 - e.X0), sy = H / (e.Y1 - e.Y0);
  const world = () => g.setTransform(sx, 0, 0, -sy, -e.X0 * sx, e.Y1 * sy);
  world();
  return { c, g, W, H, sx, sy, world, e };
}
function planCanvas(e, W) {
  const H = Math.round((W * (e.Z1 - e.Z0)) / (e.X1 - e.X0));
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const sx = W / (e.X1 - e.X0), sz = H / (e.Z1 - e.Z0);
  g.setTransform(sx, 0, 0, -sz, -e.X0 * sx, e.Z1 * sz);
  return { c, g, W, H, sx, sz, e };
}
function bandPath(g, a, b, fTop, fBot, n = 90) {
  g.beginPath();
  const xs = range(a, b, n);
  g.moveTo(xs[0], fTop(xs[0]));
  for (const x of xs) g.lineTo(x, fTop(x));
  for (let i = xs.length - 1; i >= 0; i--) g.lineTo(xs[i], fBot(xs[i]));
  g.closePath();
}
function funcPath(g, a, b, f, n = 90, move = true) {
  const xs = range(a, b, n);
  xs.forEach((x, i) => (i === 0 && move ? g.moveTo(x, f(x)) : g.lineTo(x, f(x))));
}
// Fill a panel with edge shading and an inset stitch line.
function panel(g, path, fill, { stitch, stitchInset = 0.0045, edge = 0.28, double = false } = {}) {
  g.fillStyle = fill; g.fill(path);
  g.save(); g.clip(path);
  if (stitch) {
    g.setLineDash([0.0048, 0.0032]);
    g.strokeStyle = stitch; g.lineWidth = stitchInset * 2 + 0.0016; g.stroke(path);
    g.setLineDash([]); g.strokeStyle = fill; g.lineWidth = stitchInset * 2 - 0.0016; g.stroke(path);
    if (double) {
      g.setLineDash([0.0048, 0.0032]); g.strokeStyle = stitch; g.lineWidth = stitchInset * 4 + 0.0016; g.stroke(path);
      g.setLineDash([]); g.strokeStyle = fill; g.lineWidth = stitchInset * 4 - 0.0016; g.stroke(path);
      g.setLineDash([0.0048, 0.0032]); g.strokeStyle = stitch; g.lineWidth = stitchInset * 2 + 0.0016; g.stroke(path);
      g.setLineDash([]); g.strokeStyle = fill; g.lineWidth = stitchInset * 2 - 0.0016; g.stroke(path);
    }
    g.setLineDash([]);
  }
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 0.0024; g.stroke(path);
  g.restore();
  g.strokeStyle = `rgba(0,0,0,${edge})`; g.lineWidth = 0.0016; g.stroke(path);
}
function blurStroke(S, draw, px, color, width) {
  const { g } = S;
  g.save(); g.filter = `blur(${px}px)`; g.strokeStyle = color; g.lineWidth = width; g.beginPath(); draw(g); g.stroke(); g.restore();
}
function logoAt(g, id, cx, cy, w, h, color, knock) {
  g.save(); g.translate(cx, cy); g.scale(w / 100, -h / 100); g.translate(-50, -50); paintLogo(g, id, color, knock); g.restore();
}

// ------------------------------------------------------------------ bump tiles (tileable)
const tileCache = new Map();
function tileTexture(kind) {
  if (tileCache.has(kind)) return tileCache.get(kind);
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  const rnd = mulberry(kind.length * 977 + 13);
  const wrapDraw = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  if (kind === 'knit') {
    g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8) for (const s of [-1, 1]) {
      g.save(); g.translate(x + 4 + s * 1.7, y + 4); g.rotate(s * 0.5);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 4.6); gr.addColorStop(0, '#f0f0f0'); gr.addColorStop(1, '#6a6a6a');
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 1.9, 4.4, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  } else if (kind === 'mesh') {
    g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, S, S);
    for (let row = 0; row < 16; row++) for (let col = 0; col < 16; col++) {
      const x = col * 16 + (row % 2 ? 8 : 0), y = row * 16 + 8;
      wrapDraw(() => { const gr = g.createRadialGradient(x, y, 0, x, y, 5.5); gr.addColorStop(0, '#202020'); gr.addColorStop(0.7, '#555'); gr.addColorStop(1, 'rgba(207,207,207,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 5.5, 0, Math.PI * 2); g.fill(); });
    }
  } else if (kind === 'weave') {
    g.fillStyle = '#707070'; g.fillRect(0, 0, S, S);
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
      const x = i * 8, y = j * 8;
      const h = (i + j) % 2 === 0;
      const gr = h ? g.createLinearGradient(x, y, x, y + 8) : g.createLinearGradient(x, y, x + 8, y);
      gr.addColorStop(0, '#6a6a6a'); gr.addColorStop(0.5, '#e2e2e2'); gr.addColorStop(1, '#6a6a6a');
      g.fillStyle = gr; g.fillRect(x + (h ? 0 : 1), y + (h ? 1 : 0), h ? 8 : 6, h ? 6 : 8);
    }
  } else {
    // grain / suede: soft noise, tiled 3×3 while blurring so the edges wrap
    const n = makeCanvas(S, S), ng = n.getContext('2d');
    const img = ng.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const v = 128 + (rnd() - 0.5) * (kind === 'suede' ? 120 : 60); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    ng.putImageData(img, 0, 0);
    if (kind === 'grain') {
      for (let k = 0; k < 900; k++) {
        const x = rnd() * S, y = rnd() * S, r = 1.5 + rnd() * 4.5, v = Math.round(70 + rnd() * 60);
        for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { ng.fillStyle = `rgba(${v},${v},${v},0.55)`; ng.beginPath(); ng.arc(x + dx, y + dy, r, 0, Math.PI * 2); ng.fill(); }
      }
    }
    const big = makeCanvas(S * 3, S * 3), bg = big.getContext('2d');
    bg.filter = `blur(${kind === 'suede' ? 0.8 : 1.4}px)`;
    for (const dx of [0, S, 2 * S]) for (const dy of [0, S, 2 * S]) bg.drawImage(n, dx, dy);
    g.drawImage(big, S, S, S, S, 0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.channel = 1;
  t.colorSpace = THREE.NoColorSpace;
  tileCache.set(kind, t);
  return t;
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const MATERIALS = {
  knit: { tile: 'knit', rough: 0.86, sheen: 0.7, bump: 0.0026, tileSize: 0.028 },
  mesh: { tile: 'mesh', rough: 0.8, sheen: 0.4, bump: 0.003, tileSize: 0.034 },
  leather: { tile: 'grain', rough: 0.42, sheen: 0, bump: 0.0011, tileSize: 0.09 },
  suede: { tile: 'suede', rough: 0.96, sheen: 1.0, bump: 0.0012, tileSize: 0.07 },
  canvas: { tile: 'weave', rough: 0.9, sheen: 0.3, bump: 0.0016, tileSize: 0.022 },
  patent: { tile: 'grain', rough: 0.1, sheen: 0, bump: 0.0002, tileSize: 0.09, clearcoat: 1 },
};

// ------------------------------------------------------------------ upper painters
function paintUpper(G, col, spec, W = 2048) {
  const S = sideCanvas(G.ext.upper, W);
  const k = W / 2048;
  const { g } = S;
  const { F, topY, tipX, eyeX } = G;
  const foot = F.foot;
  const style = G.m.style;
  const logo = spec.logo || 'orbit';
  g.fillStyle = col.upper; g.fillRect(-1, -1, 2, 2);
  // gentle tonal falloff toward the sole and the collar
  const heelCounter = (x0, lift = 0.1, reach = 0.012) => {
    const p = new Path2D();
    p.moveTo(x0, foot(x0) - 0.03);
    p.bezierCurveTo(x0 - 0.05, foot(x0 - 0.05) + lift * 0.45, x0 - 0.1, foot(x0 - 0.1) + lift, x0 - 0.14, topY(x0 - 0.14) + reach);
    p.lineTo(-0.7, topY(-0.7) + 0.05); p.lineTo(-0.7, -0.1); p.closePath();
    return p;
  };
  const bandP = (a, b, fT, fB) => { const p = new Path2D(); const xs = range(a, b, 80); p.moveTo(xs[0], fT(xs[0])); xs.forEach((x) => p.lineTo(x, fT(x))); for (let i = xs.length - 1; i >= 0; i--) p.lineTo(xs[i], fB(xs[i])); p.closePath(); return p; };
  const shadowAlongSole = () => blurStroke(S, (c) => funcPath(c, -0.62, 0.62, (x) => foot(x) + 0.004), 7 * k, 'rgba(0,0,0,0.33)', 0.016);
  const collarShade = () => blurStroke(S, (c) => funcPath(c, eyeX, -0.62, (x) => topY(x) - 0.02), 8 * k, 'rgba(0,0,0,0.18)', 0.02);

  if (style === 'runner' || style === 'kids') {
    const kids = style === 'kids';
    // mudguard + toe bumper
    const mud = new Path2D();
    const xs = range(-0.62, 0.62, 120);
    mud.moveTo(-0.62, foot(-0.62) - 0.04);
    xs.forEach((x) => mud.lineTo(x, foot(x) + lerp(kids ? 0.03 : 0.018, kids ? 0.07 : 0.052, sstep(0.25, 0.52, x)) + (kids ? 0.004 * Math.sin(x * 40) : 0)));
    mud.lineTo(0.62, foot(0.62) - 0.04); mud.closePath();
    panel(g, mud, col.overlay, { stitch: col.stitch });
    // heel counter
    panel(g, heelCounter(-0.2, kids ? 0.12 : 0.1), col.overlay, { stitch: col.stitch });
    // eyestay band
    const eye = bandP(eyeX - 0.02, tipX + 0.02, (x) => topY(x) + 0.03, (x) => topY(x) - (kids ? 0.03 : 0.034));
    panel(g, eye, col.overlay, { stitch: col.stitch });
    // collar panel
    panel(g, bandP(eyeX + 0.01, -0.64, (x) => topY(x) + 0.04, (x) => topY(x) - 0.024), col.collar, { edge: 0.18 });
    // side logo
    const cx = -0.08, cy = foot(-0.08) + 0.085;
    if (kids) {
      logoAt(g, logo, -0.25, foot(-0.25) + 0.085, 0.12, 0.1, col.logo, col.upper);
    } else {
      g.save(); g.beginPath(); g.rect(-0.7, foot(0) + 0.02, 1.4, 0.5); g.clip();
      logoAt(g, logo, cx, cy, 0.3, 0.105, col.logo, col.upper);
      g.restore();
    }
    // reflective heel stripe
    g.fillStyle = rgba(col.accent, 0.95);
    const hs = bandP(-0.62, -0.46, (x) => foot(x) + 0.075, (x) => foot(x) + 0.062); g.fill(hs);
    shadowAlongSole(); collarShade();
  } else if (style === 'court' || style === 'hightop') {
    const high = style === 'hightop';
    // toe cap
    const toe = new Path2D();
    toe.moveTo(0.33, foot(0.33) - 0.03);
    toe.bezierCurveTo(0.31, foot(0.31) + 0.05, 0.3, foot(0.3) + 0.1, 0.285, 0.6);
    toe.lineTo(0.7, 0.6); toe.lineTo(0.7, -0.1); toe.closePath();
    panel(g, toe, col.upper, { stitch: col.stitch, double: true, edge: 0.2 });
    // perforation rows on the toe box side
    g.fillStyle = 'rgba(0,0,0,0.55)';
    for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) {
      const x = 0.37 + k * 0.016 + (r % 2) * 0.008, y = foot(x) + 0.03 + r * 0.013;
      if (x < 0.47) { g.beginPath(); g.arc(x, y, 0.0022, 0, Math.PI * 2); g.fill(); }
    }
    // eyestay (quarter) overlay
    const eye = bandP(eyeX - 0.03, tipX + 0.02, (x) => topY(x) + 0.03, (x) => topY(x) - 0.036);
    panel(g, eye, col.overlay, { stitch: col.stitch, double: true });
    // side quarter panel with logo
    const quarter = new Path2D();
    quarter.moveTo(0.17, foot(0.17) - 0.03);
    quarter.bezierCurveTo(0.12, foot(0.12) + 0.06, 0.02, topY(0.02) - 0.02, -0.06, topY(-0.06) - 0.03);
    quarter.lineTo(-0.3, topY(-0.3) - (high ? 0.07 : 0.04));
    quarter.bezierCurveTo(-0.34, foot(-0.34) + 0.08, -0.33, foot(-0.33) + 0.02, -0.32, foot(-0.32) - 0.03);
    quarter.closePath();
    panel(g, quarter, col.overlay, { stitch: col.stitch, double: true });
    g.save(); g.clip(quarter);
    if (logo === 'courtline') logoAt(g, logo, -0.1, foot(-0.1) + 0.085, 0.1, 0.1, col.logo);
    else logoAt(g, logo, -0.1, foot(-0.1) + 0.085, 0.2, 0.09, col.logo, col.overlay);
    g.restore();
    // heel tab
    const heel = new Path2D();
    const hx = high ? -0.425 : -0.405, hb = high ? 0.27 : 0.07;
    heel.moveTo(hx, topY(hx) + 0.05);
    heel.lineTo(hx - 0.004, foot(hx) + hb);
    heel.quadraticCurveTo(hx - 0.035, foot(hx - 0.035) + hb - 0.05, -0.7, foot(-0.7) + hb - 0.06);
    heel.lineTo(-0.7, 0.8); heel.closePath();
    panel(g, heel, col.accent, { stitch: col.stitch });
    if (high) {
      // ankle band
      const ank = bandP(-0.12, -0.64, (x) => topY(x) + 0.05, (x) => topY(x) - 0.075);
      panel(g, ank, col.overlay, { stitch: col.stitch, double: true });
      g.save(); g.clip(ank); logoAt(g, 'courtline', -0.27, topY(-0.27) - 0.04, 0.06, 0.06, col.accent); g.restore();
    }
    panel(g, bandP(eyeX + 0.01, -0.64, (x) => topY(x) + 0.04, (x) => topY(x) - 0.016), col.collar, { edge: 0.15 });
    shadowAlongSole(); collarShade();
  } else if (style === 'hiker') {
    // rubber toe rand
    const rand = new Path2D();
    rand.moveTo(-0.7, foot(-0.7) - 0.05);
    range(-0.7, 0.7, 120).forEach((x) => rand.lineTo(x, foot(x) + lerp(0.022, 0.07, sstep(0.28, 0.52, x))));
    rand.lineTo(0.7, -0.1); rand.closePath();
    panel(g, rand, col.overlay, { edge: 0.35 });
    // leather overlays: heel counter and lace-area saddle
    panel(g, heelCounter(-0.18, 0.13, 0.02), col.accent, { stitch: col.stitch, double: true });
    const saddle = new Path2D();
    saddle.moveTo(0.2, foot(0.2) + 0.02);
    saddle.bezierCurveTo(0.12, foot(0.12) + 0.12, 0.05, topY(0.05) - 0.03, -0.02, topY(-0.02) + 0.02);
    saddle.lineTo(-0.2, topY(-0.2) + 0.03); saddle.lineTo(-0.2, topY(-0.2) - 0.07);
    saddle.bezierCurveTo(-0.1, foot(-0.1) + 0.14, -0.02, foot(-0.02) + 0.05, 0.02, foot(0.02) + 0.02);
    saddle.closePath();
    panel(g, saddle, col.accent, { stitch: col.stitch, double: true });
    panel(g, bandP(eyeX + 0.01, -0.64, (x) => topY(x) + 0.05, (x) => topY(x) - 0.03), col.collar, { edge: 0.2 });
    logoAt(g, logo, -0.3, topY(-0.3) - 0.07, 0.07, 0.06, col.logo, col.upper);
    shadowAlongSole(); collarShade();
  } else if (style === 'chelsea') {
    // elastic gore (V panel) on the side
    const gore = new Path2D();
    gore.moveTo(-0.13, topY(-0.13) + 0.03); gore.lineTo(-0.185, foot(-0.185) + 0.2); gore.lineTo(-0.3, topY(-0.3) + 0.03); gore.closePath();
    g.fillStyle = col.overlay; g.fill(gore);
    g.save(); g.clip(gore);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.0024;
    for (let x = -0.32; x < -0.1; x += 0.007) { g.beginPath(); g.moveTo(x, foot(x) + 0.15); g.lineTo(x + 0.004, 0.7); g.stroke(); }
    g.restore();
    g.strokeStyle = col.stitch; g.setLineDash([0.005, 0.003]); g.lineWidth = 0.0016; g.stroke(gore); g.setLineDash([]);
    // welt stitch + heel counter seam
    g.strokeStyle = col.stitch; g.setLineDash([0.005, 0.003]); g.lineWidth = 0.0016;
    g.beginPath(); funcPath(g, -0.62, 0.62, (x) => foot(x) + 0.012); g.stroke();
    g.beginPath(); g.moveTo(-0.34, foot(-0.34)); g.bezierCurveTo(-0.36, foot(-0.36) + 0.08, -0.39, foot(-0.39) + 0.14, -0.43, foot(-0.43) + 0.2); g.stroke();
    g.setLineDash([]);
    // toe seam
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.0018;
    g.beginPath(); g.moveTo(0.1, foot(0.1)); g.bezierCurveTo(0.06, foot(0.06) + 0.1, 0.02, foot(0.02) + 0.2, 0.0, 0.7); g.stroke();
    shadowAlongSole();
    // polish highlight on the toe
    const gr = g.createRadialGradient(0.36, foot(0.36) + 0.07, 0.0, 0.36, foot(0.36) + 0.07, 0.14);
    gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0.1, -0.1, 0.6, 0.6);
  } else if (style === 'slipon') {
    // elastic gores beside the throat
    const gore = new Path2D();
    gore.moveTo(0.02, topY(0.02) + 0.02); gore.lineTo(-0.02, foot(-0.02) + 0.11); gore.lineTo(-0.11, topY(-0.11) + 0.02); gore.closePath();
    g.fillStyle = shade(col.upper, -0.25); g.fill(gore);
    g.save(); g.clip(gore); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.002;
    for (let x = -0.13; x < 0.04; x += 0.006) { g.beginPath(); g.moveTo(x, 0.0); g.lineTo(x, 0.5); g.stroke(); }
    g.restore();
    // wave stripe
    g.save(); g.beginPath(); g.rect(-0.7, foot(0) + 0.018, 1.4, 0.5); g.clip();
    logoAt(g, logo, -0.16, foot(-0.16) + 0.07, 0.34, 0.1, col.logo);
    g.restore();
    // topline binding stitch
    g.strokeStyle = col.stitch; g.setLineDash([0.005, 0.003]); g.lineWidth = 0.0016;
    g.beginPath(); funcPath(g, tipX, -0.62, (x) => topY(x) - 0.012); g.stroke();
    g.beginPath(); funcPath(g, -0.62, 0.62, (x) => foot(x) + 0.028); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.0018;
    g.beginPath(); g.moveTo(0.19, foot(0.19)); g.bezierCurveTo(0.16, foot(0.16) + 0.08, 0.1, topY(0.1) - 0.01, 0.06, 0.6); g.stroke();
    shadowAlongSole();
  } else {
    // flat / pump: sleek single piece with a subtle toe seam and topline binding
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.0016;
    g.beginPath(); g.moveTo(-0.42, foot(-0.42)); g.quadraticCurveTo(-0.44, foot(-0.44) + 0.05, -0.46, topY(-0.46) + 0.02); g.stroke();
    const gr = g.createLinearGradient(0, foot(0), 0, foot(0) + 0.08);
    gr.addColorStop(0, 'rgba(0,0,0,0.2)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)');
    shadowAlongSole();
    if (style === 'flat') {
      g.strokeStyle = col.stitch; g.setLineDash([0.004, 0.003]); g.lineWidth = 0.0013;
      g.beginPath(); funcPath(g, tipX, -0.62, (x) => topY(x) - 0.008); g.stroke(); g.setLineDash([]);
    }
  }
  return S.c;
}

// ------------------------------------------------------------------ sole painters
function paintSole(G, col, W = 2048) {
  const S = sideCanvas(G.ext.sole, W), { g } = S;
  const { F } = G, P = G.m.sole.profile, oh = G.m.sole.outsole;
  g.fillStyle = col.sole; g.fillRect(-1, -1, 2, 2);
  const band = (fT, fB, fill) => { bandPath(g, -0.65, 0.65, fT, fB, 160); g.fillStyle = fill; g.fill(); };
  if (P === 'foam') {
    band((x) => F.ground(x) + oh + 0.002 * Math.sin(x * 30), (x) => F.ground(x) - 0.02, col.outsole);
    // sculpted groove
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 0.0022;
    g.beginPath(); funcPath(g, -0.62, 0.62, (x) => lerp(F.ground(x) + oh, F.foot(x), 0.5) + 0.006 * Math.sin(x * 9 + 1), 160); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.0012;
    g.beginPath(); funcPath(g, -0.62, 0.62, (x) => lerp(F.ground(x) + oh, F.foot(x), 0.5) + 0.006 * Math.sin(x * 9 + 1) + 0.002, 160); g.stroke();
    // heel cushioning window
    const pod = new Path2D();
    const x0 = -0.72, x1 = -0.2;
    pod.moveTo(x0, F.ground(x0) + oh + 0.012);
    funcPath(pod, x0, x1, (x) => F.ground(x) + oh + 0.012 + 0.004 * sstep(x0, x1, x), 40, false);
    pod.quadraticCurveTo(x1 + 0.03, lerp(F.ground(x1) + oh, F.foot(x1), 0.55), x1 - 0.01, F.foot(x1) - 0.02);
    funcPath(pod, x1 - 0.01, x0, (x) => F.foot(x) - 0.024, 40, false);
    pod.closePath();
    const gr = g.createLinearGradient(0, F.ground(-0.4) + oh, 0, F.foot(-0.4));
    gr.addColorStop(0, shade(col.pod, -0.15)); gr.addColorStop(0.55, col.pod); gr.addColorStop(1, shade(col.pod, 0.25));
    g.fillStyle = gr; g.fill(pod);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.0016; g.stroke(pod);
  } else if (P === 'cup') {
    band((x) => F.ground(x) + oh, (x) => F.ground(x) - 0.02, col.outsole);
    g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = 0.0024;
    for (const f of [0.38, 0.56]) { g.beginPath(); funcPath(g, -0.62, 0.62, (x) => lerp(F.ground(x) + oh, F.top(x), f), 120); g.stroke(); }
    g.strokeStyle = shade(col.sole, -0.4); g.setLineDash([0.0045, 0.003]); g.lineWidth = 0.0016;
    g.beginPath(); funcPath(g, -0.62, 0.62, (x) => F.top(x) - 0.009, 160); g.stroke(); g.setLineDash([]);
  } else if (P === 'vulc') {
    band((x) => F.ground(x) + oh, (x) => F.ground(x) - 0.02, col.outsole);
    g.fillStyle = col.accent;
    for (const [f, w] of [[0.5, 0.0036], [0.6, 0.0022]]) { bandPath(g, -0.65, 0.65, (x) => lerp(F.ground(x), F.top(x), f) + w, (x) => lerp(F.ground(x), F.top(x), f), 120); g.fill(); }
    // toe bumper texture
    g.save(); g.beginPath(); g.rect(0.36, -0.1, 0.4, 0.4); g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 0.0012;
    for (let k = -40; k < 40; k++) { g.beginPath(); g.moveTo(0.3 + k * 0.008, 0); g.lineTo(0.4 + k * 0.008, 0.1); g.stroke(); g.beginPath(); g.moveTo(0.4 + k * 0.008, 0); g.lineTo(0.3 + k * 0.008, 0.1); g.stroke(); }
    g.restore();
  } else if (P === 'lug') {
    band((x) => F.ground(x) + oh, (x) => F.ground(x) - 0.02, col.outsole);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.004;
    for (let x = -0.6; x < 0.6; x += 0.042) { g.beginPath(); g.moveTo(x + 0.021, F.ground(x) - 0.01); g.lineTo(x + 0.021, F.ground(x) + 0.03); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.002;
    g.beginPath(); funcPath(g, -0.62, 0.62, (x) => lerp(F.ground(x) + oh, F.top(x), 0.45), 120); g.stroke();
  } else {
    g.strokeStyle = shade(col.sole, -0.3); g.setLineDash([0.004, 0.003]); g.lineWidth = 0.0012;
    g.beginPath(); funcPath(g, -0.62, 0.62, (x) => lerp(F.ground(x), F.top(x), 0.5), 120); g.stroke(); g.setLineDash([]);
  }
  blurStroke(S, (c) => funcPath(c, -0.62, 0.62, (x) => F.top(x) + 0.002, 120), 5 * W / 2048, 'rgba(0,0,0,0.3)', 0.008);
  return S.c;
}

function outlinePath(ring) {
  const p = new Path2D();
  ring.forEach((q, i) => (i ? p.lineTo(q.x, q.z) : p.moveTo(q.x, q.z)));
  p.closePath();
  return p;
}

function paintTread(G, col, gray, W = 1024) {
  const S = planCanvas(G.ext.tread, W), { g } = S;
  const P = G.m.sole.profile;
  const pal = gray ? { base: '#555', pod: '#b8b8b8', groove: '#262626', mark: '#8a8a8a' } : { base: col.sole, pod: col.outsole, groove: shade(col.outsole, luma(col.outsole) > 0.5 ? -0.3 : 0.18), mark: shade(col.outsole, 0.2) };
  g.fillStyle = pal.base; g.fillRect(-1, -1, 2, 2);
  const outline = outlinePath(G.O.P.map((q, i) => q.clone().addScaledVector(G.O.N[i], G.m.sole.flare - 0.01)));
  g.save(); g.clip(outline);
  if (P === 'foam') {
    for (const [a, b] of [[0.0, 0.62], [-0.62, -0.2]]) {
      g.fillStyle = pal.pod; g.fillRect(a, -0.4, b - a, 0.8);
      g.strokeStyle = pal.groove; g.lineWidth = 0.004;
      for (let x = a + 0.02; x < b; x += 0.032) { g.beginPath(); g.moveTo(x, -0.3); g.quadraticCurveTo(x + 0.02, 0, x, 0.3); g.stroke(); }
      g.lineWidth = 0.003;
      g.beginPath(); g.moveTo(a, 0); g.lineTo(b, 0); g.stroke();
    }
    logoAt(g, G.logo || 'orbit', -0.09, 0, 0.1, 0.1, pal.mark);
  } else if (P === 'cup' || P === 'vulc') {
    g.fillStyle = pal.pod; g.fillRect(-1, -1, 2, 2);
    g.strokeStyle = pal.groove; g.lineWidth = P === 'vulc' ? 0.003 : 0.0036;
    if (P === 'vulc') {
      for (let k = -80; k < 80; k++) { g.beginPath(); g.moveTo(k * 0.018 - 0.4, -0.4); g.lineTo(k * 0.018 + 0.4, 0.4); g.stroke(); g.beginPath(); g.moveTo(k * 0.018 - 0.4, 0.4); g.lineTo(k * 0.018 + 0.4, -0.4); g.stroke(); }
    } else {
      for (let k = -60; k < 60; k++) { g.beginPath(); for (let j = -12; j <= 12; j++) { const x = k * 0.016 + (j % 2 ? 0.008 : 0), z = j * 0.024; j === -12 ? g.moveTo(x, z) : g.lineTo(x, z); } g.stroke(); }
      for (const [cx, rr] of [[0.25, 0.1], [-0.36, 0.07]]) {
        g.fillStyle = pal.pod; g.beginPath(); g.arc(cx, 0, rr + 0.01, 0, Math.PI * 2); g.fill();
        for (let r = 0.012; r < rr; r += 0.014) { g.beginPath(); g.arc(cx, 0, r, 0, Math.PI * 2); g.stroke(); }
      }
    }
    g.strokeStyle = pal.groove; g.lineWidth = 0.006; g.stroke(outlinePath(G.O.P.map((q, i) => q.clone().addScaledVector(G.O.N[i], G.m.sole.flare - 0.024))));
  } else if (P === 'lug') {
    g.fillStyle = pal.groove; g.fillRect(-1, -1, 2, 2);
    g.fillStyle = pal.pod;
    for (let x = -0.56; x < 0.56; x += 0.07) for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(x, 0.012 * s); g.lineTo(x + 0.04, 0.05 * s); g.lineTo(x + 0.04, 0.11 * s); g.lineTo(x, 0.075 * s); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x + 0.015, 0.13 * s); g.lineTo(x + 0.05, 0.13 * s); g.lineTo(x + 0.05, 0.3 * s); g.lineTo(x + 0.015, 0.3 * s); g.closePath(); g.fill();
    }
  } else {
    g.fillStyle = gray ? '#666' : shade(col.sole, -0.05); g.fillRect(-1, -1, 2, 2);
    g.fillStyle = gray ? '#999' : shade(col.sole, -0.45); g.fillRect(-0.7, -0.4, 0.35, 0.8);
  }
  g.restore();
  return S.c;
}

function paintInsole(G, col, spec) {
  const S = planCanvas(G.ext.tread, 512), { g } = S;
  g.fillStyle = shade(col.lining, -0.08); g.fillRect(-1, -1, 2, 2);
  logoAt(g, spec.logo || 'orbit', -0.34, 0, 0.08, 0.08, shade(col.lining, 0.35));
  return S.c;
}

function paintTongue(col, spec) {
  const W = 256, H = 512, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = col.tongue; g.fillRect(0, 0, W, H);
  // top binding
  g.fillStyle = shade(col.tongue, -0.12); g.fillRect(0, 0, W, 34);
  // woven label
  const lx = 64, ly = 56, lw = 128, lh = 84;
  g.fillStyle = col.logo; roundRect(g, lx, ly, lw, lh, 10); g.fill();
  g.save(); g.translate(lx + lw / 2 - 22, ly + 10); g.scale(0.44, 0.44); paintLogo(g, spec.logo || 'orbit', luma(col.logo) > 0.5 ? '#111' : '#fff'); g.restore();
  g.fillStyle = luma(col.logo) > 0.5 ? '#111' : '#fff'; g.font = '700 17px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText((spec.brandName || '').toUpperCase(), lx + lw / 2, ly + lh - 12);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.setLineDash([6, 4]); g.lineWidth = 2; roundRect(g, lx - 6, ly - 6, lw + 12, lh + 12, 12); g.stroke();
  return c;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function canvasTexture(c, { srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
}

// ------------------------------------------------------------------ assembly
export function buildShoe(spec, { tex: TW = 2048 } = {}) {
  const G = getModelGeometry(spec.model);
  const m = G.m;
  G.logo = spec.logo;
  const col = resolveColors(spec.colors || {});
  const matDef = MATERIALS[spec.material || m.material] || MATERIALS.knit;
  const textures = [], materials = [];
  const tex = (c, o) => { const t = canvasTexture(c, o); textures.push(t); return t; };
  const std = (o, Cls = THREE.MeshStandardMaterial) => { const mt = new Cls(o); materials.push(mt); return mt; };

  const tile = tileTexture(matDef.tile).clone();
  tile.needsUpdate = true; tile.channel = 1; tile.repeat.set(1 / matDef.tileSize, 1 / matDef.tileSize);
  textures.push(tile);

  const upperMap = tex(paintUpper(G, col, spec, TW));
  const upperOpts = { map: upperMap, bumpMap: tile, bumpScale: matDef.bump, roughness: matDef.rough, metalness: 0 };
  if (matDef.sheen) Object.assign(upperOpts, { sheen: matDef.sheen, sheenRoughness: 0.75, sheenColor: new THREE.Color(shade(col.upper, 0.4)) });
  if (matDef.clearcoat) Object.assign(upperOpts, { clearcoat: 1, clearcoatRoughness: 0.06 });
  const upperMat = std(upperOpts, THREE.MeshPhysicalMaterial);
  const liningMat = std({ color: col.lining, roughness: 0.92, side: THREE.BackSide });

  const soleMat = std({ map: tex(paintSole(G, col, TW)), roughness: m.sole.profile === 'thin' ? 0.45 : 0.62 });
  const treadMat = std({ map: tex(paintTread(G, col, false, TW / 2)), bumpMap: tex(paintTread(G, col, true, TW / 2), { srgb: false }), bumpScale: 0.004, roughness: 0.85 });
  const insoleMat = std({ map: tex(paintInsole(G, col, spec)), roughness: 0.9 });
  const collarMat = std({ color: col.collar, roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color(shade(col.collar, 0.4)), sheenRoughness: 0.8 }, THREE.MeshPhysicalMaterial);
  if (m.collar === 0) { collarMat.color.set(m.style === 'chelsea' || m.style === 'flat' || m.style === 'pump' ? shade(col.upper, -0.15) : col.collar); }

  const group = new THREE.Group();
  const add = (geo, mat, { cast = true, receive = true } = {}) => { if (!geo) return null; const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = cast; mesh.receiveShadow = receive; group.add(mesh); return mesh; };
  add(G.upper, upperMat);
  add(G.upper, liningMat, { cast: false });
  add(G.wall, soleMat);
  add(G.bottom, treadMat);
  add(G.insole, insoleMat, { cast: false });
  add(G.collar, collarMat);
  if (G.rim) add(G.rim, std({ color: col.overlay, roughness: 0.7 }));
  if (G.tongue) {
    const tMat = std({ map: tex(paintTongue(col, spec)), roughness: 0.82, side: THREE.DoubleSide });
    add(G.tongue, tMat);
    add(G.tongueRim, std({ color: shade(col.tongue, -0.1), roughness: 0.85 }));
  }
  if (G.lace) {
    add(G.lace, std({ color: col.lace, roughness: 0.78 }));
    add(G.aglet, std({ color: shade(col.lace, -0.5), roughness: 0.35 }));
    add(G.eyelet, std({ color: col.eyelet, metalness: 0.85, roughness: 0.32 }));
  }
  if (G.straps) add(G.straps, std({ color: col.strap, roughness: 0.75, side: THREE.DoubleSide }));
  if (G.heelTab) add(G.heelTab, std({ color: m.heelTab === 'pull' ? shade(col.upper, -0.25) : col.accent, roughness: 0.7, side: THREE.DoubleSide }));
  if (G.bow) add(G.bow, std({ color: col.accent, roughness: matDef.clearcoat ? 0.2 : 0.5 }));
  if (G.heelBlock) {
    add(G.heelBlock, std({ color: col.heel, roughness: 0.3 }, THREE.MeshStandardMaterial));
    add(G.heelLift, std({ color: '#1b1b1b', roughness: 0.8 }));
  }

  group.userData = {
    model: spec.model, bounds: G.bounds, ankle: G.ankle, geo: G,
    dispose({ keepMaterials = false } = {}) { textures.forEach((t) => t.dispose()); if (!keepMaterials) materials.forEach((mt) => mt.dispose()); },
  };
  return group;
}

// For the on-foot scenes: a foot surface (for low-cut shoes) built with the same loft.
export function buildFootGeometry(modelId) {
  const G = getModelGeometry(modelId);
  const U = { shoulderH: 0.03, shoulderIn: 0.03, toeIn: 0.06, bulge: 0.02, vampLift: 0.2, baseOffset: 0, baseDrop: 0.002 };
  // the foot is a shrunken copy of the last so the toes always stay inside the toe box
  const cx = -0.15;
  const P = G.O.P.map((p) => new V3(cx + (p.x - cx) * 0.925, 0, p.z * 0.88));
  const O = { P, N: G.O.N, arc: G.O.arc, minX: Math.min(...P.map((p) => p.x)), maxX: Math.max(...P.map((p) => p.x)) };
  const loop = openingLoop(OPEN.foot, G.F, O);
  const { rows } = upperRows(O, G.F, U, loop);
  const geo = gridGeometry(rows, { wrap: true, uv: (p) => [0.5, 0.02] });
  const ring = [];
  const M = G.O.P.length;
  for (let i = 0; i < M; i++) ring.push(rows[R_UP][i].clone());
  return { geo, ring, loop };
}

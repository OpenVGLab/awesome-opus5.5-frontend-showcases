import * as THREE from 'three';
import {
  TAU, clamp, lerp, smoothstep, fbm2, noise2, mulberry32, Batcher, Colliders, makeMatrix,
  washMaterial, mat, paintGeometry, segDist, smoothPath, SHARED, GLSL_NOISE,
} from './util.js';
import * as L from './layout.js';
import * as BLD from './buildings.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const { PAL, G, put } = BLD;

/* ================================================================== heights */

function rawHeight(x, z) {
  const r = Math.hypot(x, z);
  const amp = 0.35 + 0.65 * smoothstep(14, 55, r);
  let h = (fbm2(x * 0.011 + 3.1, z * 0.011 - 1.7, 3) - 0.5) * 3.4 * amp;
  h += Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.4) * 0.8 * amp;
  const dh = Math.hypot(x - L.HILL.x, z - L.HILL.z) / L.HILL.r;
  if (dh < 1.8) h += L.HILL.h * Math.exp(-dh * dh * 2.2);
  const t = smoothstep(90, 210, r);
  h += t * t * (24 + 42 * fbm2(x * 0.007 + 11, z * 0.007 - 5, 4));
  const t2 = smoothstep(250, 600, r);
  h += t2 * (70 + 170 * fbm2(x * 0.0033 - 7, z * 0.0033 + 3, 4));
  const dl = Math.hypot(x - L.LAKE.x, (z - L.LAKE.z) * 1.35) / L.LAKE.r;
  if (dl < 1.6) h = lerp(h, -7, smoothstep(1.35, 0.55, dl));
  return h;
}

const FLATS = [];
function flatRect(cx, cz, hw, hd, rot, fall) {
  FLATS.push({ type: 'rect', x: cx, z: cz, hw, hd, cos: Math.cos(rot), sin: Math.sin(rot), fall, h: rawHeight(cx, cz) });
}
function flatCircle(cx, cz, r, fall, h = rawHeight(cx, cz)) {
  FLATS.push({ type: 'circle', x: cx, z: cz, r, fall, h });
}

flatCircle(L.YARD.x, L.YARD.z, 12, 12);
flatCircle(L.GREEN.x, L.GREEN.z, 20, 12);
flatCircle(L.POND.x, L.POND.z, L.POND.r + 4, 8);
for (const b of L.BUILDINGS) flatRect(b.x, b.z, b.w / 2 + 1.5, b.d / 2 + 1.5, b.rot, 5);
flatRect((L.GARDEN.x0 + L.GARDEN.x1) / 2, (L.GARDEN.z0 + L.GARDEN.z1) / 2, 11, 10, 0, 6);
flatRect((L.STY.x0 + L.STY.x1) / 2, (L.STY.z0 + L.STY.z1) / 2, 5, 5, 0, 5);
for (const t of L.TROUGHS) flatCircle(t.x, t.z, 2, 3);
flatCircle(L.MARKET.x, L.MARKET.z, 2.5, 3);

const POND_BASE = FLATS.find((f) => f.type === 'circle' && f.x === L.POND.x).h;
export const POND_LEVEL = POND_BASE - 0.32;

export function heightAt(x, z) {
  let h = rawHeight(x, z);
  for (let i = 0; i < FLATS.length; i++) {
    const f = FLATS[i];
    let d;
    if (f.type === 'circle') {
      d = Math.hypot(x - f.x, z - f.z) - f.r;
      if (d > f.fall) continue;
      d = Math.max(0, d);
    } else {
      const dx = x - f.x, dz = z - f.z;
      const lx = Math.abs(dx * f.cos - dz * f.sin) - f.hw, lz = Math.abs(dx * f.sin + dz * f.cos) - f.hd;
      if (lx > f.fall || lz > f.fall) continue;
      d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
      if (d > f.fall) continue;
    }
    const m = 1 - smoothstep(0, f.fall, d);
    h = h + (f.h - h) * m;
  }
  const dp = Math.hypot(x - L.POND.x, z - L.POND.z);
  if (dp < L.POND.r + 3) h = lerp(h, POND_LEVEL - 1.25, smoothstep(L.POND.r + 2.6, L.POND.r - 2.6, dp));
  return h;
}

/* ================================================================== ground kinds */

const PATH_SEGS = [];
for (const p of L.PATHS) {
  const pts = smoothPath(p.pts, 5);
  p.smooth = pts;
  for (let i = 0; i < pts.length - 1; i++) PATH_SEGS.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], p.w / 2]);
}
function yardRadius(x, z) {
  const a = Math.atan2(z - L.YARD.z, x - L.YARD.x);
  return L.YARD.r * (0.82 + 0.34 * noise2(Math.cos(a) * 1.4 + 5, Math.sin(a) * 1.4 + 5));
}
function inRectDef(x, z, b, m) {
  const dx = x - b.x, dz = z - b.z;
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return Math.abs(dx * c - dz * s) < b.w / 2 + m && Math.abs(dx * s + dz * c) < b.d / 2 + m;
}
const inBox = (x, z, r, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;

export function groundKind(x, z) {
  if (Math.hypot(x - L.POND.x, z - L.POND.z) < L.POND.r + 2.2) return 'pond';
  for (const b of L.BUILDINGS) if (inRectDef(x, z, b, 1.2)) return 'building';
  for (const s of PATH_SEGS) if (segDist(x, z, s[0], s[1], s[2], s[3]) < s[4] + 0.35) return 'path';
  if (Math.abs(Math.hypot(x - L.GREEN.x, z - L.GREEN.z) - L.RING_ROAD.r) < L.RING_ROAD.w / 2 + 0.4) return 'path';
  if (Math.hypot(x - L.GREEN.x, z - L.GREEN.z) < 2.2) return 'path';
  if (Math.hypot(x - L.YARD.x, z - L.YARD.z) < yardRadius(x, z)) return 'yard';
  for (const w of L.WHEAT) if (inBox(x, z, w)) return 'wheat';
  if (inBox(x, z, L.GARDEN, 0.3)) return 'garden';
  if (inBox(x, z, L.STY, 0.3)) return 'sty';
  return 'grass';
}

/* ================================================================== painted ground */

function paintGround(trees) {
  const N = 2048, S = L.PAINT_SIZE, k = N / S;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const X = (x) => (x + S / 2) * k, Y = (z) => (z + S / 2) * k;
  const R = mulberry32(12345);
  const rgbaS = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };
  const blot = (x, y, r, hex, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rgbaS(hex, a));
    grd.addColorStop(0.55, rgbaS(hex, a * 0.75));
    grd.addColorStop(1, rgbaS(hex, 0));
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  };
  const jitterPoly = (poly, amp, step = 2) => {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / step));
      for (let s = 0; s < n; s++) {
        const t = s / n;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        out.push([x + (R() - 0.5) * amp, z + (R() - 0.5) * amp]);
      }
    }
    return out;
  };
  const polyPath = (poly) => {
    g.beginPath();
    poly.forEach(([x, z], i) => (i ? g.lineTo(X(x), Y(z)) : g.moveTo(X(x), Y(z))));
    g.closePath();
  };
  const wash = (poly, hex, { a = 0.5, passes = 3, amp = 1.2, rim = null } = {}) => {
    for (let p = 0; p < passes; p++) {
      polyPath(jitterPoly(poly, amp));
      g.fillStyle = rgbaS(hex, a);
      g.fill();
    }
    if (rim) {
      polyPath(jitterPoly(poly, amp * 0.6));
      g.strokeStyle = rgbaS(rim, 0.35);
      g.lineWidth = 1.6 * k * 0.5;
      g.stroke();
    }
  };
  const rectPoly = (r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];
  const circlePoly = (cx, cz, r, n = 48, wob = 0.1, seed = 1) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rr = r * (1 - wob + 2 * wob * noise2(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3 + seed));
      out.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]);
    }
    return out;
  };
  const strokePath = (pts, width, style, jit = 0) => {
    g.beginPath();
    pts.forEach(([x, z], i) => {
      const jx = jit ? (R() - 0.5) * jit : 0, jz = jit ? (R() - 0.5) * jit : 0;
      if (i) g.lineTo(X(x + jx), Y(z + jz)); else g.moveTo(X(x + jx), Y(z + jz));
    });
    g.strokeStyle = style;
    g.lineWidth = width * k;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  };
  const speckle = (poly, n, colors, size = [0.12, 0.3], alpha = 0.8) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    for (let i = 0; i < n; i++) {
      const x = minX + R() * (maxX - minX), z = minZ + R() * (maxZ - minZ);
      if (!pointIn(x, z, poly)) continue;
      g.fillStyle = rgbaS(colors[Math.floor(R() * colors.length)], alpha * (0.6 + R() * 0.4));
      g.beginPath(); g.arc(X(x), Y(z), (size[0] + R() * (size[1] - size[0])) * k, 0, TAU); g.fill();
    }
  };
  const pointIn = (x, z, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };

  // base grass, mottled
  g.fillStyle = '#9db06a';
  g.fillRect(0, 0, N, N);
  const greens = ['#a8b972', '#92a862', '#b4c17f', '#8aa05b', '#a1b46d', '#bfc68a', '#879d5a', '#99ad6b'];
  for (let i = 0; i < 1900; i++) blot(R() * N, R() * N, 14 + R() * 90, greens[Math.floor(R() * greens.length)], 0.08 + R() * 0.15);

  // far patchwork of fields between stone walls
  for (let band = 0; band < 3; band++) {
    const r0 = 94 + band * 22, r1 = r0 + 22;
    let a = R() * 0.3;
    while (a < TAU) {
      const da = 0.16 + R() * 0.22;
      const poly = [];
      for (let s = 0; s <= 6; s++) poly.push([Math.cos(a + (da * s) / 6) * r0, Math.sin(a + (da * s) / 6) * r0]);
      for (let s = 6; s >= 0; s--) poly.push([Math.cos(a + (da * s) / 6) * r1, Math.sin(a + (da * s) / 6) * r1]);
      const hue = ['#a5b56f', '#92a560', '#b8bf7c', '#8b9e5c', '#c5bb7a', '#9fae6a', '#a9ab6e'][Math.floor(R() * 7)];
      wash(poly, hue, { a: 0.42, passes: 2, amp: 2.5 });
      a += da;
    }
  }
  g.globalAlpha = 1;
  for (let band = 0; band < 4; band++) {
    const r = 94 + band * 22;
    const pts = [];
    for (let s = 0; s <= 160; s++) {
      const a = (s / 160) * TAU;
      const rr = r + (noise2(s * 0.15, band * 3) - 0.5) * 3;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    strokePath(pts, 0.7, rgbaS('#7e7b6c', 0.35), 0.4);
  }

  // lookout hill: fell grass with heather and bracken
  for (let i = 0; i < 120; i++) {
    const a = R() * TAU, rr = Math.sqrt(R()) * L.HILL.r;
    blot(X(L.HILL.x + Math.cos(a) * rr), Y(L.HILL.z + Math.sin(a) * rr), (3 + R() * 7) * k, R() < 0.5 ? '#a0906c' : '#998a8c', 0.14);
  }

  // meadow & paddock
  wash(rectPoly(L.MEADOW), '#a9ba6a', { a: 0.35, passes: 2, amp: 1.5 });
  speckle(rectPoly(L.MEADOW), 2600, ['#e8cf4a', '#f1dc68', '#f6f1e0'], [0.08, 0.16], 0.9);
  wash(rectPoly(L.PADDOCK), '#b1b672', { a: 0.3, passes: 2, amp: 1.5 });
  for (let i = 0; i < 40; i++) blot(X(lerp(L.PADDOCK.x0, L.PADDOCK.x1, R())), Y(lerp(L.PADDOCK.z0, L.PADDOCK.z1, R())), (1.5 + R() * 3) * k, '#b9a77a', 0.25);
  speckle(circlePoly(L.HILL.x, L.HILL.z, 22), 900, ['#f6f1e0', '#e8cf4a', '#c9a0c8'], [0.07, 0.14], 0.85);
  speckle(circlePoly(L.GREEN.x, L.GREEN.z, 12), 500, ['#f6f1e0', '#f1dc68'], [0.07, 0.13], 0.85);

  // wheat
  for (const w of L.WHEAT) {
    wash(rectPoly(w), '#d6bd72', { a: 0.75, passes: 3, amp: 1.2, rim: '#a88f4e' });
    for (let x = w.x0 + 0.6; x < w.x1; x += 1.25) strokePath([[x, w.z0 + 0.4], [x + 0.3, w.z1 - 0.4]], 0.35, rgbaS('#b69a55', 0.35));
  }
  // ploughed field beyond the wall (north-west)
  {
    const poly = [[-118, -40], [-96, -48], [-86, -80], [-104, -96], [-126, -66]];
    wash(poly, '#9c7d5c', { a: 0.8, passes: 3, amp: 2, rim: '#6f563f' });
    g.save();
    polyPath(poly);
    g.clip();
    for (let i = -10; i < 40; i++) strokePath([[-130 + i * 1.3, -30], [-100 + i * 1.3, -100]], 0.3, rgbaS('#7a5f45', 0.3));
    g.restore();
  }

  // yard of packed earth and gravel
  {
    const poly = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      const px = L.YARD.x + Math.cos(a) * 30, pz = L.YARD.z + Math.sin(a) * 30;
      const rr = yardRadius(px, pz);
      poly.push([L.YARD.x + Math.cos(a) * rr, L.YARD.z + Math.sin(a) * rr]);
    }
    wash(poly, '#d2bf98', { a: 0.55, passes: 3, amp: 1.6, rim: '#a8916b' });
    speckle(poly, 2200, ['#bfa983', '#e2d6ba', '#b39d79', '#a9a194'], [0.05, 0.12], 0.45);
    for (let i = 0; i < 18; i++) {
      const a = R() * TAU, rr = R() * 12;
      blot(X(L.YARD.x + Math.cos(a) * rr), Y(L.YARD.z + Math.sin(a) * rr), (1.5 + R() * 3) * k, '#b8a27c', 0.12);
    }
  }

  // village green: brighter grass, ring road of cobbles
  wash(circlePoly(L.GREEN.x, L.GREEN.z, 11.5, 40, 0.05, 3), '#adc076', { a: 0.4, passes: 2 });

  // kitchen garden
  wash(rectPoly(L.GARDEN), '#b7a57c', { a: 0.55, passes: 2, amp: 0.6 });
  for (const bed of [[-37, -25, 16, 18], [-37, -25, 25, 27], [-23, -20, 16, 20], [-26.5, -20.5, 29, 31], [-37, -32, 21, 23]]) {
    wash(rectPoly({ x0: bed[0], x1: bed[1], z0: bed[2], z1: bed[3] }), '#6f543f', { a: 0.8, passes: 2, amp: 0.3, rim: '#4f3b2c' });
  }
  // sty mud
  wash(rectPoly(L.STY), '#8e7052', { a: 0.75, passes: 3, amp: 0.8 });
  wash(circlePoly(-34, 1.6, 2.2, 24, 0.2, 7), '#6b5039', { a: 0.8, passes: 2 });

  // pond margin and bed
  wash(circlePoly(L.POND.x, L.POND.z, L.POND.r + 2.6, 56, 0.08, 9), '#8f9160', { a: 0.5, passes: 2 });
  wash(circlePoly(L.POND.x, L.POND.z, L.POND.r + 1.6, 56, 0.06, 9), '#7e7657', { a: 0.6, passes: 2 });
  wash(circlePoly(L.POND.x, L.POND.z, L.POND.r, 56, 0.06, 9), '#57706b', { a: 0.9, passes: 2 });

  // paths: several loose, overlapping strokes
  const allPaths = L.PATHS.map((p) => ({ pts: p.smooth, w: p.w }));
  const ring = [];
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * TAU; ring.push([L.GREEN.x + Math.cos(a) * L.RING_ROAD.r, L.GREEN.z + Math.sin(a) * L.RING_ROAD.r]); }
  allPaths.push({ pts: ring, w: L.RING_ROAD.w });
  for (const p of allPaths) strokePath(p.pts, p.w + 1.1, rgbaS('#8f8a5c', 0.3), 0.6);
  for (const p of allPaths) {
    strokePath(p.pts, p.w + 0.3, rgbaS('#b59f78', 0.55), 0.5);
    strokePath(p.pts, p.w, rgbaS('#d0ba90', 0.7), 0.4);
    strokePath(p.pts, p.w * 0.55, rgbaS('#ddcba4', 0.5), 0.8);
  }
  for (const p of allPaths) {
    if (p.w < 3) continue;
    for (const off of [-0.24, 0.24]) {
      const pts = p.pts.map(([x, z], i, arr) => {
        const [nx, nz] = arr[Math.min(i + 1, arr.length - 1)], [px2, pz2] = arr[Math.max(i - 1, 0)];
        const dx = nx - px2, dz = nz - pz2, l = Math.hypot(dx, dz) || 1;
        return [x - (dz / l) * off * p.w, z + (dx / l) * off * p.w];
      });
      strokePath(pts, 0.35, rgbaS('#a88f69', 0.4), 0.2);
    }
    for (let i = 0; i < p.pts.length * 3; i++) {
      const [x, z] = p.pts[Math.floor(R() * p.pts.length)];
      g.fillStyle = rgbaS(R() < 0.5 ? '#b3a488' : '#e3d6b8', 0.6);
      g.beginPath(); g.arc(X(x + (R() - 0.5) * p.w * 0.8), Y(z + (R() - 0.5) * p.w * 0.8), (0.08 + R() * 0.1) * k, 0, TAU); g.fill();
    }
  }
  // well paving
  wash(circlePoly(L.GREEN.x, L.GREEN.z, 2.1, 20, 0.05, 4), '#c3b597', { a: 0.8, passes: 2, rim: '#8e8468' });

  // soft shade under trees and around buildings
  for (const t of trees) blot(X(t[0] + 0.8), Y(t[1] + 0.6), t[2] * k, '#5e7442', 0.28);
  for (const b of L.BUILDINGS) {
    const r = Math.max(b.w, b.d) * 0.72;
    blot(X(b.x + 1), Y(b.z + 1), r * k, '#6f6a52', 0.22);
  }
  // fine grain
  for (let i = 0; i < 40000; i++) {
    g.fillStyle = R() < 0.5 ? 'rgba(60, 70, 40, 0.07)' : 'rgba(255, 250, 230, 0.07)';
    g.fillRect(R() * N, R() * N, 1 + R() * 2, 1 + R() * 2);
  }
  return cv;
}

/* ================================================================== terrain mesh */

function buildTerrain(renderer, tex) {
  const rings = [0];
  let r = 1.5;
  while (r < 118) { rings.push(r); r += 1.5; }
  while (r < 1150) { rings.push(r); r *= 1.075; }
  const seg = 256;
  const nv = rings.length * seg;
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), far = new Float32Array(nv * 3), paint = new Float32Array(nv);
  const cFell = new THREE.Color('#94a664'), cBracken = new THREE.Color('#a8955f'), cHeather = new THREE.Color('#978479');
  const cRock = new THREE.Color('#a19e92'), cMtn = new THREE.Color('#98a2a4'), cLake = new THREE.Color('#8f9a70');
  const tmp = new THREE.Color();
  const S = L.PAINT_SIZE;
  let vi = 0;
  for (let i = 0; i < rings.length; i++) {
    const rr = rings[i];
    for (let j = 0; j < seg; j++) {
      const a = ((j + (i % 2) * 0.5) / seg) * TAU;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const y = heightAt(x, z);
      pos[vi * 3] = x; pos[vi * 3 + 1] = y; pos[vi * 3 + 2] = z;
      uv[vi * 2] = (x + S / 2) / S; uv[vi * 2 + 1] = 1 - (z + S / 2) / S;
      paint[vi] = 1 - smoothstep(138, 157, rr);
      tmp.copy(cFell);
      const n1 = fbm2(x * 0.012, z * 0.012, 3), n2 = fbm2(x * 0.004 + 5, z * 0.004, 3);
      tmp.lerp(cBracken, smoothstep(0.45, 0.7, n1) * 0.7);
      tmp.lerp(cHeather, smoothstep(0.5, 0.75, n2) * smoothstep(40, 90, y) * 0.8);
      tmp.lerp(cRock, smoothstep(90, 190, y) * smoothstep(0.35, 0.65, n1 * 0.5 + n2 * 0.5));
      tmp.lerp(cMtn, smoothstep(380, 900, rr) * 0.75);
      if (y < 1 && rr > 120) tmp.lerp(cLake, 0.5);
      far[vi * 3] = tmp.r; far[vi * 3 + 1] = tmp.g; far[vi * 3 + 2] = tmp.b;
      vi++;
    }
  }
  const idx = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = (i + 1) * seg + j, d = (i + 1) * seg + ((j + 1) % seg);
      if (i % 2 === 0) { idx.push(a, b, c, b, d, c); } else { idx.push(a, b, d, a, d, c); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('farColor', new THREE.BufferAttribute(far, 3));
  geo.setAttribute('paint', new THREE.BufferAttribute(paint, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const m = new THREE.MeshLambertMaterial({ map: tex });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 farColor; attribute float paint; varying vec3 vFar; varying float vPaint; varying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFar = farColor; vPaint = paint;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vFar; varying float vPaint; varying vec3 vWp;\n${GLSL_NOISE}`)
      .replace('#include <map_fragment>', `
        vec4 texelColor = texture2D(map, vMapUv);
        vec3 baseCol = mix(vFar, texelColor.rgb, vPaint);
        float wn = fvn3(vWp * 0.035) * 0.55 + fvn3(vWp * 0.21) * 0.45;
        baseCol *= mix(0.88, 1.08, wn) * (1.0 - vPaint) + vPaint * mix(0.95, 1.04, wn);
        diffuseColor.rgb *= baseCol;`);
  };
  const mesh = new THREE.Mesh(geo, m);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/* ================================================================== sky */

function buildSky() {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: SHARED.time,
      uTop: { value: new THREE.Color('#8fb5d6') },
      uMid: { value: new THREE.Color('#c0d6e6') },
      uHorizon: { value: new THREE.Color('#f1ebdb') },
      uCloud: { value: new THREE.Color('#fdfaf3') },
      uShade: { value: new THREE.Color('#c7cdd6') },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uTop, uMid, uHorizon, uCloud, uShade;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
        c = mix(c, uTop, smoothstep(0.18, 0.75, h));
        vec2 sp = d.xz / (h + 0.28);
        float w = fvn2(sp * 1.3 + 3.0) * 0.6 + fvn2(sp * 3.7) * 0.4;
        c = mix(c, uHorizon, (w - 0.45) * 0.45 * smoothstep(0.05, 0.5, h));
        vec2 cp = sp * 0.85 + vec2(uTime * 0.006, uTime * 0.002);
        float n = ffbm2(cp * 1.5);
        float cloud = smoothstep(0.5, 0.68, n) * smoothstep(0.03, 0.2, h);
        float lit = ffbm2(cp * 1.5 + vec2(0.05, 0.08));
        vec3 cc = mix(uShade, uCloud, clamp((n - lit) * 5.0 + 0.65, 0.0, 1.0));
        c = mix(c, cc, cloud * 0.92);
        c = mix(c, uHorizon, smoothstep(0.03, -0.12, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 40, 20), m);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  sky.name = 'sky';
  return sky;
}

/* ================================================================== water */

export function waterMaterial({ cx, cz, r, deep = '#5d7f80', shallow = '#9dbcbe', sky = '#e6eef0', fog = null }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: SHARED.time,
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uSky: { value: new THREE.Color(sky) },
      uCenter: { value: new THREE.Vector2(cx, cz) },
      uRadius: { value: r },
      uFogColor: { value: fog ? fog.color : new THREE.Color('#e9e3d2') },
      uFogNear: { value: fog ? fog.near : 1e5 },
      uFogFar: { value: fog ? fog.far : 2e5 },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uDeep, uShallow, uSky, uFogColor; uniform vec2 uCenter; uniform float uRadius, uFogNear, uFogFar;
      varying vec3 vW;
      ${GLSL_NOISE}
      void main() {
        float rr = length(vW.xz - uCenter) / uRadius;
        vec3 c = mix(uDeep, uShallow, smoothstep(0.15, 1.0, rr));
        vec2 p = vW.xz;
        float big = fvn2(p * 0.12 + vec2(uTime * 0.02, 0.0));
        c = mix(c, uSky, smoothstep(0.55, 0.9, big) * 0.35);
        float n = fvn2(p * vec2(0.35, 1.4) + vec2(uTime * 0.12, uTime * 0.05));
        float streak = smoothstep(0.035, 0.0, abs(n - 0.5)) * smoothstep(0.3, 0.7, fvn2(p * 0.4 - uTime * 0.03));
        c = mix(c, uSky, streak * 0.3);
        float glint = smoothstep(0.95, 0.995, fvn2(p * 2.2 + uTime * 0.25));
        c = mix(c, vec3(1.0), glint * 0.25);
        float f = smoothstep(uFogNear, uFogFar, length(vW - cameraPosition));
        c = mix(c, uFogColor, f);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

/* ================================================================== trees & plants */

function blobGeometry(seed, detail = 1) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 0.82 + 0.36 * fbm2(x * 1.7 + seed * 3.1 + z * 0.7, y * 1.7 - seed + z * 1.3, 2);
    p.setXYZ(i, x * n, y * n, z * n);
  }
  g.computeVertexNormals();
  return g;
}

function canopyColor(dark, light, warm) {
  const d = new THREE.Color(dark), l = new THREE.Color(light), w = new THREE.Color(warm);
  return (x, y, z, c) => {
    const t = clamp(y * 0.5 + 0.55, 0, 1);
    c.copy(d).lerp(l, t);
    if (x > 0.3 && y > 0.1) c.lerp(w, 0.18);
    return c;
  };
}

function mergeParts(parts) {
  const B = new Batcher();
  const vm = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const [geo, m] of parts) B.add(geo, vm, m);
  const holder = new THREE.Group();
  const meshes = B.build(holder);
  return meshes[0].geometry;
}

function oakGeometry(seed, apples = null) {
  const R = mulberry32(seed);
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.26, 0.46, 3.4, 9, 4);
  trunk.translate(0, 1.7, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    tp.setX(i, tp.getX(i) + Math.sin(y * 1.3 + seed) * 0.1);
  }
  trunk.computeVertexNormals();
  paintGeometry(trunk, (x, y, z, c) => c.set(y < 0.4 ? '#5b4a3c' : '#6f5c4a').lerp(new THREE.Color('#8d7a64'), clamp(x * 1.5, 0, 0.4)));
  parts.push([trunk, null]);
  for (let b = 0; b < 3; b++) {
    const br = new THREE.CylinderGeometry(0.08, 0.16, 1.9, 6);
    br.translate(0, 0.95, 0);
    paintGeometry(br, '#6a5746');
    br.rotateX(0.9).rotateY(b * 2.1 + R()).translate(0, 2.5 + b * 0.3, 0);
    parts.push([br, null]);
  }
  const col = canopyColor('#5c7640', '#a6b86c', '#c2c27a');
  const n = apples ? 6 : 8;
  const spread = apples ? 1.3 : 1.8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.6;
    const rr = i === 0 ? 0 : spread * (0.6 + R() * 0.5);
    const s = (apples ? 1.35 : 1.75) + R() * 0.7;
    const blob = blobGeometry(seed + i, 1);
    paintGeometry(blob, col);
    parts.push([blob, makeMatrix(Math.cos(a) * rr, (apples ? 3.3 : 4.8) + (i === 0 ? 1.0 : (R() - 0.3) * 1.2), Math.sin(a) * rr, 0, R() * TAU, 0, s, s * 0.82, s)]);
  }
  if (apples) {
    const ap = new THREE.SphereGeometry(0.1, 6, 5);
    for (let i = 0; i < 26; i++) {
      const a = R() * TAU, el = R() * 1.2 - 0.3;
      const rr = 2.1 + R() * 0.3;
      const g = ap.clone();
      paintGeometry(g, apples);
      parts.push([g, makeMatrix(Math.cos(a) * Math.cos(el) * rr, 3.4 + Math.sin(el) * rr * 0.8, Math.sin(a) * Math.cos(el) * rr, 0, 0, 0, 1, apples === '#c8c064' ? 1.3 : 1, 1)]);
    }
  }
  return mergeParts(parts.map(([g, m]) => [g, m || new THREE.Matrix4()]));
}

function birchGeometry(seed) {
  const R = mulberry32(seed);
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.12, 0.2, 6, 7, 6);
  trunk.translate(0, 3, 0);
  paintGeometry(trunk, (x, y, z, c) => c.set(Math.sin(y * 7.0 + x * 9) > 0.75 ? '#4f4a44' : '#ece8de'));
  parts.push([trunk, new THREE.Matrix4()]);
  const col = canopyColor('#7d9550', '#c3cd82', '#d8d38d');
  for (let i = 0; i < 6; i++) {
    const blob = blobGeometry(seed + i * 5, 1);
    paintGeometry(blob, col);
    const a = R() * TAU, rr = R() * 1.0;
    const s = 0.9 + R() * 0.6;
    parts.push([blob, makeMatrix(Math.cos(a) * rr, 4.6 + R() * 2.4, Math.sin(a) * rr, 0, 0, 0, s, s * 1.2, s)]);
  }
  return mergeParts(parts);
}

function pineGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.14, 0.26, 2.4, 7);
  trunk.translate(0, 1.2, 0);
  paintGeometry(trunk, '#5d4a3a');
  parts.push([trunk, new THREE.Matrix4()]);
  for (let i = 0; i < 4; i++) {
    const cone = new THREE.ConeGeometry(2.1 - i * 0.42, 2.6, 9);
    paintGeometry(cone, (x, y, z, c) => c.set('#4b6344').lerp(new THREE.Color('#71875b'), clamp(y * 0.4 + 0.3, 0, 1)));
    parts.push([cone, makeMatrix(0, 2.6 + i * 1.45, 0)]);
  }
  return mergeParts(parts);
}

function willowGeometry(seed) {
  const R = mulberry32(seed);
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.3, 0.55, 3.0, 8);
  trunk.translate(0, 1.5, 0);
  paintGeometry(trunk, '#6a5a48');
  parts.push([trunk, new THREE.Matrix4()]);
  const col = canopyColor('#7f9754', '#bccb7c', '#d0cf88');
  const top = blobGeometry(seed, 1);
  paintGeometry(top, col);
  parts.push([top, makeMatrix(0, 4.2, 0, 0, 0, 0, 2.6, 1.4, 2.6)]);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + R() * 0.3;
    const strand = blobGeometry(seed + i, 1);
    paintGeometry(strand, col);
    parts.push([strand, makeMatrix(Math.cos(a) * 2.5, 2.8, Math.sin(a) * 2.5, 0, 0, 0, 0.55, 1.6, 0.55)]);
  }
  return mergeParts(parts);
}

function bushGeometry(seed) {
  const parts = [];
  const col = canopyColor('#56703f', '#8ea45e', '#a9b36c');
  const R = mulberry32(seed);
  for (let i = 0; i < 4; i++) {
    const b = blobGeometry(seed + i * 7, 1);
    paintGeometry(b, col);
    parts.push([b, makeMatrix((R() - 0.5) * 1.1, 0.55 + R() * 0.3, (R() - 0.5) * 1.1, 0, 0, 0, 0.6 + R() * 0.3)]);
  }
  return mergeParts(parts);
}

/* A flat, single-sided sliver: bottom width w, height h, colours from base to tip (optional widest point at mid) */
function sliver(w, h, cBase, cTip, { mid = 0, midW = 0, cMid = null, lean = 0 } = {}) {
  const a = new THREE.Color(cBase), b = new THREE.Color(cTip), m = new THREE.Color(cMid || cTip);
  let pos, col;
  if (mid > 0) {
    pos = [0, 0, 0, midW, h * mid, 0, -midW, h * mid, 0, -midW, h * mid, 0, midW, h * mid, 0, lean, h, 0];
    col = [a, m, m, m, m, b];
  } else {
    pos = [-w, 0, 0, w, 0, 0, lean, h, 0];
    col = [a, a, b];
  }
  // both windings, both lit from above, so no double-sided normal flip darkens the back
  const tris = pos.length / 9;
  for (let t = 0; t < tris; t++) {
    const o = t * 9;
    pos.push(pos[o], pos[o + 1], pos[o + 2], pos[o + 6], pos[o + 7], pos[o + 8], pos[o + 3], pos[o + 4], pos[o + 5]);
    col.push(col[t * 3], col[t * 3 + 2], col[t * 3 + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const n = pos.length / 3;
  const nrm = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { nrm[i * 3 + 1] = 1; nrm[i * 3 + 2] = 0.2; }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col.flatMap((c) => [c.r, c.g, c.b])), 3));
  return g;
}

/* A flat flower head lying in the XZ plane: n petals of radius rOut notched in to rIn, tips lifted by cup */
function petalStar(n, rOut, rIn, cIn, cOut, cup = 0.012) {
  const a = new THREE.Color(cIn), b = new THREE.Color(cOut);
  const ring = [];
  for (let k = 0; k < n * 2; k++) {
    const ang = (k / (n * 2)) * TAU, tip = k % 2 === 0;
    ring.push({ x: Math.cos(ang) * (tip ? rOut : rIn), y: tip ? cup : cup * 0.3, z: Math.sin(ang) * (tip ? rOut : rIn), c: tip ? b : a });
  }
  const pos = [], col = [];
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k], q = ring[(k + 1) % ring.length];
    pos.push(0, 0, 0, p.x, p.y, p.z, q.x, q.y, q.z, 0, 0, 0, q.x, q.y, q.z, p.x, p.y, p.z);
    col.push(a, p.c, q.c, a, q.c, p.c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const cnt = pos.length / 3;
  const nrm = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) nrm[i * 3 + 1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col.flatMap((c) => [c.r, c.g, c.b])), 3));
  return g;
}

function tuftGeometry() {
  const parts = [];
  const R = mulberry32(3);
  for (let i = 0; i < 6; i++) {
    const h = 0.18 + R() * 0.2;
    const g = sliver(0.04, h, '#94a966', R() < 0.35 ? '#bfc488' : '#adbd78', { lean: (R() - 0.5) * 0.14 });
    parts.push([g, makeMatrix((R() - 0.5) * 0.2, 0, (R() - 0.5) * 0.2, (R() - 0.5) * 0.5, (i / 6) * TAU + R(), (R() - 0.5) * 0.4)]);
  }
  return mergeParts(parts);
}

function flowerGeometry(kind) {
  const parts = [];
  const stemC = '#6f8a4e';
  const oct = (r) => new THREE.OctahedronGeometry(r, 0);
  if (kind === 'foxglove' || kind === 'hollyhock') {
    const tall = kind === 'hollyhock' ? 1.6 : 1.0;
    const stem = new THREE.CylinderGeometry(0.02, 0.03, tall, 3);
    stem.translate(0, tall / 2, 0);
    paintGeometry(stem, stemC);
    parts.push([stem, new THREE.Matrix4()]);
    for (let i = 0; i < 3; i++) {
      const leaf = oct(0.12);
      paintGeometry(leaf, '#5f7a44');
      parts.push([leaf, makeMatrix(0, 0.12 + i * 0.1, 0, 0, i * 2.1, 0, 1.3, 0.3, 0.6)]);
    }
    const n = kind === 'hollyhock' ? 7 : 8;
    for (let i = 0; i < n; i++) {
      const f = oct(kind === 'hollyhock' ? 0.1 : 0.055);
      paintGeometry(f, '#ffffff');
      const y = tall * 0.45 + (i / n) * tall * 0.55;
      const a = i * 2.3;
      parts.push([f, makeMatrix(Math.cos(a) * 0.05, y, Math.sin(a) * 0.05, 0, a, 0, 1 - i / (n * 1.6), kind === 'hollyhock' ? 0.8 : 1.3, 1 - i / (n * 1.6))]);
    }
  } else {
    const tall = kind === 'bluebell' ? 0.24 : 0.3;
    parts.push([sliver(0.012, tall, stemC, stemC), new THREE.Matrix4()]);
    if (kind === 'daisy') {
      parts.push([petalStar(10, 0.072, 0.03, '#f1ece2', '#ffffff'), makeMatrix(0, tall, 0, 0.12, 0, 0.05)]);
      const eye = oct(0.026);
      paintGeometry(eye, '#e5b93a');
      parts.push([eye, makeMatrix(0, tall + 0.012, 0, 0, 0.4, 0, 1, 0.55, 1)]);
    } else if (kind === 'button') {
      parts.push([petalStar(5, 0.056, 0.036, '#e9e4dc', '#ffffff', 0.024), makeMatrix(0, tall, 0, 0.1, 0, -0.06)]);
    } else {
      const head = oct(0.04);
      paintGeometry(head, '#ffffff');
      parts.push([head, makeMatrix(0, tall, 0, 0, 0.4, 0, 1, 1.2, 1)]);
    }
  }
  return mergeParts(parts);
}

function wheatGeometry() {
  const parts = [];
  const R = mulberry32(8);
  for (let i = 0; i < 9; i++) {
    const h = 0.8 + R() * 0.3;
    const g = sliver(0, h, '#b39a58', R() < 0.5 ? '#c79f52' : '#b9914a', { mid: 0.74, midW: 0.03, cMid: '#dcc070', lean: (R() - 0.5) * 0.1 });
    parts.push([g, makeMatrix((R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5, (R() - 0.5) * 0.3, R() * TAU, (R() - 0.5) * 0.3)]);
  }
  return mergeParts(parts);
}

function reedGeometry() {
  const parts = [];
  const R = mulberry32(21);
  for (let i = 0; i < 7; i++) {
    const h = 0.9 + R() * 0.8;
    parts.push([sliver(0.03, h, '#6f8549', R() < 0.5 ? '#9aa964' : '#b1b673', { lean: (R() - 0.5) * 0.2 }), makeMatrix((R() - 0.5) * 0.4, 0, (R() - 0.5) * 0.4, (R() - 0.5) * 0.3, R() * TAU, (R() - 0.5) * 0.3)]);
    if (i < 2) {
      const cat = new THREE.CylinderGeometry(0.04, 0.04, 0.22, 5);
      paintGeometry(cat, '#6b4f39');
      parts.push([cat, makeMatrix((R() - 0.5) * 0.3, h + 0.05, (R() - 0.5) * 0.3)]);
    }
  }
  return mergeParts(parts);
}

/* Small plants are painted without pen lines: no depth writes (so no silhouette), drawn after the solid scenery */
function soft(m) {
  m.depthWrite = false;
  return m;
}

function instanced(geo, material, list, { cast = false, receive = true, tint = 0.12, name = 'inst', colors = null } = {}) {
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  if (!material.depthWrite) mesh.renderOrder = 2;
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  list.forEach((it, i) => {
    m.copy(makeMatrix(it.x, it.y, it.z, it.rx || 0, it.ry || 0, it.rz || 0, it.s, it.sy ?? it.s, it.s));
    mesh.setMatrixAt(i, m);
    if (colors) mesh.setColorAt(i, c.set(colors[i % colors.length]));
    else { const v = 1 - tint / 2 + Math.random() * tint; mesh.setColorAt(i, c.setRGB(v, v * (0.98 + Math.random() * 0.04), v)); }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.name = name;
  mesh.computeBoundingSphere();
  return mesh;
}

/* ================================================================== the world */

export function buildWorld(scene, renderer) {
  const W = {
    heightAt,
    groundKind,
    colliders: new Colliders(8),
    interactables: [],
    smoke: [],
    doors: [],
    dynamic: [],
    fruit: [],
    hives: [],
    treeTops: [],
    pond: { x: L.POND.x, z: L.POND.z, r: L.POND.r, level: POND_LEVEL },
    bell: null,
    vane: null,
  };
  const C = W.colliders;
  const B = new Batcher(48);
  const out = { smoke: W.smoke, doors: W.doors, dynamic: W.dynamic };
  const R = mulberry32(777);

  const fog = new THREE.Fog('#ebe6d7', 55, 560);
  scene.fog = fog;
  W.fog = fog;

  /* ---- trees list first (the painted ground needs their shade) */
  const treeShade = [];
  const oaks = L.OAKS.map(([x, z, s]) => ({ x, z, s }));
  const birches = L.BIRCHES.map(([x, z]) => ({ x, z, s: 0.9 + R() * 0.3 }));
  const pines = [];
  // woodland around the edge of the world
  for (let i = 0; i < 150; i++) {
    const a = R() * TAU;
    const rr = 95 + Math.pow(R(), 1.6) * 60;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const nearExit = [[-7, -96], [-100, 3], [104, -86]].some(([ex, ez]) => Math.hypot(x - ex * 0.95, z - ez * 0.95) < 9);
    if (nearExit) continue;
    const k = R();
    if (k < 0.5) oaks.push({ x, z, s: 0.85 + R() * 0.5 });
    else if (k < 0.75) pines.push({ x, z, s: 0.8 + R() * 0.5 });
    else birches.push({ x, z, s: 0.8 + R() * 0.4 });
  }
  // copses on the far fells
  for (let c = 0; c < 26; c++) {
    const a = R() * TAU, rr = 170 + R() * 260;
    const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
    if (Math.hypot(cx - L.LAKE.x, (cz - L.LAKE.z) * 1.35) < L.LAKE.r * 1.1) continue;
    const n = 4 + Math.floor(R() * 8);
    for (let i = 0; i < n; i++) {
      const x = cx + (R() - 0.5) * 30, z = cz + (R() - 0.5) * 30;
      (R() < 0.55 ? pines : oaks).push({ x, z, s: 1.1 + R() * 0.8 });
    }
  }
  for (const t of oaks) if (Math.hypot(t.x, t.z) < 160) treeShade.push([t.x, t.z, 3.2 * t.s]);
  for (const [x, z] of L.APPLE_TREES) treeShade.push([x, z, 2.6]);

  /* ---- ground */
  const groundCanvas = paintGround(treeShade);
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  groundTex.wrapS = groundTex.wrapT = THREE.ClampToEdgeWrapping;
  const terrain = buildTerrain(renderer, groundTex);
  scene.add(terrain);
  W.terrain = terrain;

  const sky = buildSky();
  scene.add(sky);
  W.sky = sky;

  /* ---- light */
  const hemi = new THREE.HemisphereLight('#e4ecf2', '#a8a07a', 1.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1da', 2.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  const sc = sun.shadow.camera;
  sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 200;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  sun.shadow.intensity = 0.78;
  scene.add(sun);
  scene.add(sun.target);
  W.sun = sun;
  W.sunDir = new THREE.Vector3(-0.42, 0.78, 0.46).normalize();

  /* ---- buildings */
  for (const b of L.BUILDINGS) {
    const y = heightAt(b.x, b.z);
    if (b.kind === 'cottage') BLD.buildCottage(B, C, b, y, out);
    else if (b.kind === 'barn') { BLD.buildBarn(B, C, b, y, out); W.vane = out.vane; }
    else if (b.kind === 'farmhouse') BLD.buildFarmhouse(B, C, b, y, out);
    else if (b.kind === 'chapel') { BLD.buildChapel(B, C, b, y, out); W.bell = out.bell; }
    else if (b.kind === 'henhouse') BLD.buildHenhouse(B, C, b, y);
    else if (b.kind === 'kennel') { BLD.buildKennel(B, C, b, y, out); }
    else if (b.kind === 'shelter') BLD.buildShelter(B, C, b, y);
    else if (b.kind === 'shed') BLD.buildShed(B, C, b, y);
  }
  for (const o of W.dynamic) scene.add(o);

  /* ---- enclosures */
  const rectPts = (r, gate) => {
    const { x0, x1, z0, z1 } = r;
    const sides = {
      n: [[x0, z0], [x1, z0]], e: [[x1, z0], [x1, z1]], s: [[x1, z1], [x0, z1]], w: [[x0, z1], [x0, z0]],
    };
    const runs = [];
    let cur = [];
    for (const k of ['n', 'e', 's', 'w']) {
      const [a, b] = sides[k];
      if (gate && gate.side === k) {
        const vertical = k === 'e' || k === 'w';
        const ga = vertical ? [a[0], gate.a] : [gate.a, a[1]];
        const gb = vertical ? [a[0], gate.b] : [gate.b, a[1]];
        const toward = (p) => (vertical ? Math.sign(b[1] - a[1]) * p[1] : Math.sign(b[0] - a[0]) * p[0]);
        const [first, second] = toward(ga) < toward(gb) ? [ga, gb] : [gb, ga];
        if (!cur.length) cur.push(a);
        cur.push(first);
        runs.push(cur);
        cur = [second, b];
      } else {
        if (!cur.length) cur.push(a);
        cur.push(b);
      }
    }
    if (cur.length) runs.push(cur);
    return runs;
  };
  for (const run of rectPts(L.PADDOCK, L.PADDOCK.gate)) BLD.railFence(B, C, run, heightAt);
  BLD.gate(B, L.PADDOCK.x1, L.PADDOCK.gate.a, -Math.PI / 2, heightAt, 1.2, 3.8);
  for (const run of rectPts(L.MEADOW, L.MEADOW.gate)) BLD.stoneWall(B, C, run, heightAt, { seed: 5 });
  BLD.gate(B, L.MEADOW.x0, L.MEADOW.gate.b, Math.PI / 2, heightAt, -1.3, 4.6);
  for (const run of rectPts(L.STY, null)) BLD.stoneWall(B, C, run, heightAt, { seed: 9, h: 0.72 });
  for (const run of rectPts(L.GARDEN, L.GARDEN.gate)) BLD.picketFence(B, C, run, heightAt);
  for (const run of L.FARM_GARDEN) BLD.picketFence(B, C, run, heightAt);

  // the boundary wall, with closed gates where the lanes leave the world
  {
    const n = 110, rr = L.WORLD_R + 1.4;
    const exits = [[-7, -96], [-100, 3], [104, -86]].map(([x, z]) => Math.atan2(z, x));
    let run = [];
    const runs = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const nearExit = exits.some((e) => Math.abs(Math.atan2(Math.sin(a - e), Math.cos(a - e))) < 0.028);
      if (nearExit) { if (run.length > 1) runs.push(run); run = []; continue; }
      run.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    if (run.length > 1) runs.push(run);
    for (const r2 of runs) BLD.stoneWall(B, C, r2, heightAt, { collide: false, seed: 17 });
    for (const e of exits) {
      const gx = Math.cos(e - 0.024) * rr, gz = Math.sin(e - 0.024) * rr;
      BLD.gate(B, gx, gz, Math.atan2(-(Math.sin(e + 0.024) * rr - gz), Math.cos(e + 0.024) * rr - gx), heightAt, 0, 4.2);
    }
  }
  // walls climbing the far fells
  for (let i = 0; i < 16; i++) {
    const a0 = R() * TAU;
    const pts = [];
    let a = a0, rr = 100 + R() * 20;
    for (let s = 0; s < 14; s++) {
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      if (i % 2) rr += 7 + R() * 5; else a += 0.05 + R() * 0.03;
    }
    const exitNear = pts.some(([x, z]) => Math.hypot(x - L.LAKE.x, (z - L.LAKE.z) * 1.35) < L.LAKE.r);
    if (!exitNear) BLD.stoneWall(B, C, pts, heightAt, { collide: false, seed: 30 + i, h: 0.9 });
  }

  /* ---- props */
  const trough = (t) => {
    const y = heightAt(t.x, t.z);
    const info = BLD.buildTrough(B, C, t, y);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(info.ww, info.wd), waterMaterial({ cx: t.x, cz: t.z, r: t.w * 0.6, deep: '#6f8f8e', shallow: '#9fbcbc' }));
    water.rotation.x = -Math.PI / 2;
    water.rotation.z = t.rot;
    water.position.set(t.x, info.waterY, t.z);
    scene.add(water);
    W.interactables.push({
      kind: 'water', name: 'the water trough', x: t.x, z: t.z, y: y + 0.9, headY: 0.5,
      shape: { type: 'rect', hw: t.w / 2, hd: t.d / 2, cos: Math.cos(t.rot), sin: Math.sin(t.rot) },
    });
  };
  L.TROUGHS.forEach(trough);
  BLD.buildPump(B, C, -5.3, -7.5, heightAt(-5.3, -7.5));
  {
    const y = heightAt(L.WELL.x, L.WELL.z);
    const info = BLD.buildWell(B, C, L.WELL.x, L.WELL.z, y);
    const water = new THREE.Mesh(new THREE.CircleGeometry(info.r, 20), waterMaterial({ cx: L.WELL.x, cz: L.WELL.z, r: 1, deep: '#3f5a5c', shallow: '#6d8c8c' }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(L.WELL.x, info.waterY, L.WELL.z);
    scene.add(water);
    W.interactables.push({ kind: 'water', name: 'the village well', x: L.WELL.x, z: L.WELL.z, y: y + 1.6, headY: 0.85, shape: { type: 'circle', r: 1.3 } });
  }
  if (out.bowl) W.interactables.push({ kind: 'water', name: 'the dog bowl', x: out.bowl.x, z: out.bowl.z, y: out.bowl.y + 0.6, headY: 0.05, shape: { type: 'circle', r: 0.25 } });
  for (const b of L.BALES) {
    const y = heightAt(b.x, b.z);
    const info = BLD.buildBales(B, C, b, y);
    W.interactables.push({
      kind: 'hay', name: b.stack > 1 ? 'the hay bales' : 'the hay bale', x: b.x, z: b.z, y: y + info.top + 0.5, headY: 0.35,
      shape: { type: 'rect', hw: b.stack === 3 ? 1.2 : 0.6, hd: 0.35, cos: Math.cos(b.rot), sin: Math.sin(b.rot) },
    });
  }
  {
    const y = heightAt(L.RICK.x, L.RICK.z);
    BLD.buildRick(B, C, L.RICK, y);
    W.interactables.push({ kind: 'hay', name: 'the haystack', x: L.RICK.x, z: L.RICK.z, y: y + 4.3, headY: 0.6, shape: { type: 'circle', r: L.RICK.r + 0.1 } });
  }
  {
    const y = heightAt(L.HAYRACK.x, L.HAYRACK.z);
    BLD.buildHayrack(B, C, L.HAYRACK, y);
    W.interactables.push({ kind: 'hay', name: 'the hay rack', x: L.HAYRACK.x, z: L.HAYRACK.z, y: y + 2, headY: 1.0, shape: { type: 'rect', hw: 1.2, hd: 0.45, cos: Math.cos(L.HAYRACK.rot), sin: Math.sin(L.HAYRACK.rot) } });
  }
  {
    const y = heightAt(-22, 6);
    const info = BLD.buildCart(B, C, -22, 6, 0.9, y);
    void info;
    W.interactables.push({ kind: 'hay', name: 'the hay cart', x: -22, z: 6, y: y + 2.2, headY: 1.1, shape: { type: 'rect', hw: 0.85, hd: 1.6, cos: Math.cos(0.9), sin: Math.sin(0.9) } });
  }
  {
    const y = heightAt(L.MARKET.x, L.MARKET.z);
    BLD.buildMarket(B, C, L.MARKET, y);
    W.interactables.push({ kind: 'fruit', name: 'the fruit stall', fruitName: 'an apple from the stall', x: L.MARKET.x, z: L.MARKET.z, y: y + 2.9, headY: 0.95, shape: { type: 'rect', hw: 1.5, hd: 0.7, cos: Math.cos(L.MARKET.rot), sin: Math.sin(L.MARKET.rot) } });
  }
  BLD.buildChurns(B, C, 11.2, -10.6, heightAt(11.2, -10.6));
  BLD.buildButt(B, C, 24.4, -12.2, heightAt(24.4, -12.2));
  BLD.buildButt(B, C, -8.4, -10.7, heightAt(-8.4, -10.7));
  BLD.buildLogs(B, C, -24.6, -16, 0, heightAt(-24.6, -16));
  // puddles in the yard, and straw blown about near the barn
  for (const [px, pz, pr] of [[3, -3.5, 1.1], [-6.5, 3.8, 0.8], [6.2, 1.2, 0.7]]) {
    const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 20), waterMaterial({ cx: px, cz: pz, r: pr * 1.4, deep: '#8fa3a3', shallow: '#b5c3bd' }));
    pud.rotation.x = -Math.PI / 2;
    pud.scale.set(pr * 1.4, pr, 1);
    pud.position.set(px, heightAt(px, pz) + 0.025, pz);
    scene.add(pud);
  }
  const straw = [];
  for (let i = 0; i < 160; i++) {
    const a = R() * TAU, rr = Math.sqrt(R()) * 7;
    const x = -14 + Math.cos(a) * rr * 1.4, z = -6 + Math.sin(a) * rr;
    straw.push({ x, y: heightAt(x, z) + 0.015, z, ry: R() * TAU, s: 0.6 + R() * 0.8 });
  }
  const strawGeo = mergeParts([[sliver(0.012, 0.35, '#d7bf78', '#e6d49a'), new THREE.Matrix4()], [sliver(0.012, 0.28, '#cdb36b', '#e0cc8e'), makeMatrix(0.05, 0, 0.02, 0, 0, 0.7)]]).rotateX(-Math.PI / 2);
  { const nrm = strawGeo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0); }
  scene.add(instanced(strawGeo, soft(washMaterial({ vertexColors: true }, { amt: 0.1 })), straw, { name: 'straw' }));
  BLD.buildScarecrow(B, C, -29, 30, heightAt(-29, 30));
  BLD.buildWheelbarrow(B, -19.6, 26.5, 2.2, heightAt(-19.6, 26.5));
  BLD.buildWateringCan(B, -21, 21.5, 0.5, heightAt(-21, 21.5));
  BLD.buildPots(B, -34.6, 31.2, heightAt(-34.6, 31.2));
  BLD.buildPots(B, 14.6, -11.4, heightAt(14.6, -11.4));
  BLD.buildWashingLine(B, C, 65.5, 7.5, 72.5, 9, heightAt(65.5, 7.5), heightAt(72.5, 9));
  BLD.buildBeehive(B, C, 47, 10, heightAt(47, 10), 0.3);
  BLD.buildBeehive(B, C, 45.4, 10.4, heightAt(45.4, 10.4), -0.2);
  W.hives.push(new THREE.Vector3(46.2, heightAt(46.2, 10.2) + 1.2, 10.2));
  BLD.bench(B, C, makeMatrix(62, heightAt(62, -1.5), -1.5, 0, Math.PI + 0.3, 0), heightAt(62, -1.5));
  BLD.bench(B, C, makeMatrix(14, heightAt(14, 37), 37, 0, -0.6, 0), heightAt(14, 37));
  BLD.bench(B, C, makeMatrix(-47.5, heightAt(-47.5, 56), 56, 0, -2.2, 0), heightAt(-47.5, 56));
  BLD.buildSignpost(scene, 40, -3.6, heightAt(40, -3.6), [
    { text: 'Village', angle: -0.25 },
    { text: 'Farm', angle: Math.PI - 0.1 },
    { text: 'Duck Pond', angle: Math.PI * 0.62 },
  ]);
  BLD.buildSignpost(scene, 3.2, 12.2, heightAt(3.2, 12.2), [
    { text: 'Pond', angle: -Math.PI / 2 - 0.1 },
    { text: 'Hill', angle: -Math.PI + 0.5 },
    { text: 'Village', angle: 0.2 },
  ]);

  // garden beds and vegetables
  const veg = [];
  const bedBox = (x0, x1, z0, z1) => {
    const y = heightAt((x0 + x1) / 2, (z0 + z1) / 2);
    put(B, G.box, '#6a503c', makeMatrix((x0 + x1) / 2, y, (z0 + z1) / 2), 0, 0.06, 0, 0, 0, 0, x1 - x0, 0.24, z1 - z0);
    put(B, G.box, PAL.woodDark, makeMatrix((x0 + x1) / 2, y, z0), 0, 0.1, 0, 0, 0, 0, x1 - x0, 0.22, 0.08);
    put(B, G.box, PAL.woodDark, makeMatrix((x0 + x1) / 2, y, z1), 0, 0.1, 0, 0, 0, 0, x1 - x0, 0.22, 0.08);
    return y + 0.18;
  };
  {
    let y = bedBox(-37, -25, 16, 18);
    for (let x = -36.3; x < -25.4; x += 0.9) for (const z of [16.55, 17.45]) veg.push({ kind: 'cabbage', x: x + (R() - 0.5) * 0.1, y, z });
    y = bedBox(-37, -25, 25, 27);
    for (let x = -36.5; x < -25.3; x += 0.42) for (const z of [25.5, 26.1, 26.6]) veg.push({ kind: 'carrot', x, y, z: z + (R() - 0.5) * 0.1 });
    y = bedBox(-23, -20, 16, 20);
    for (let x = -22.5; x < -20.2; x += 0.75) for (let z = 16.5; z < 19.8; z += 0.75) veg.push({ kind: 'lettuce', x, y, z });
    y = bedBox(-37, -32, 21, 23);
    for (let x = -36.5; x < -32.2; x += 0.5) for (const z of [21.5, 22.4]) veg.push({ kind: 'carrot', x, y, z });
    y = bedBox(L.STRAWBERRIES.x - L.STRAWBERRIES.w / 2, L.STRAWBERRIES.x + L.STRAWBERRIES.w / 2, L.STRAWBERRIES.z - L.STRAWBERRIES.d / 2, L.STRAWBERRIES.z + L.STRAWBERRIES.d / 2);
    for (let x = -26; x < -21; x += 0.55) for (const z of [29.5, 30.5]) veg.push({ kind: 'strawberry', x, y, z: z + (R() - 0.5) * 0.15 });
    W.interactables.push({ kind: 'fruit', name: 'the strawberry patch', fruitName: 'some strawberries', x: L.STRAWBERRIES.x, z: L.STRAWBERRIES.z, y: y + 1.0, headY: 0.2, shape: { type: 'rect', hw: L.STRAWBERRIES.w / 2, hd: L.STRAWBERRIES.d / 2, cos: 1, sin: 0 } });
  }
  const vegGeo = {
    cabbage: (() => { const p = []; for (let i = 0; i < 5; i++) { const b = new THREE.SphereGeometry(0.2, 8, 6); paintGeometry(b, i === 0 ? '#b7cf98' : '#88a877'); p.push([b, makeMatrix(i === 0 ? 0 : Math.cos(i * 1.6) * 0.16, i === 0 ? 0.16 : 0.08, i === 0 ? 0 : Math.sin(i * 1.6) * 0.16, 0, i, 0, i === 0 ? 0.8 : 0.9, i === 0 ? 0.8 : 0.45, i === 0 ? 0.8 : 0.9)]); } return mergeParts(p); })(),
    lettuce: (() => { const p = []; for (let i = 0; i < 6; i++) { const b = new THREE.SphereGeometry(0.16, 7, 5); paintGeometry(b, i % 2 ? '#a9c77c' : '#c3d78f'); p.push([b, makeMatrix(Math.cos(i) * 0.1, 0.1, Math.sin(i) * 0.1, 0.4, i, 0, 1, 0.5, 0.8)]); } return mergeParts(p); })(),
    carrot: (() => { const p = []; for (let i = 0; i < 5; i++) { const b = new THREE.ConeGeometry(0.03, 0.34, 4); paintGeometry(b, '#6f9a48'); p.push([b, makeMatrix(0, 0.17, 0, (i - 2) * 0.25, i * 1.3, 0)]); } const top = new THREE.SphereGeometry(0.04, 5, 4); paintGeometry(top, '#e08a3c'); p.push([top, makeMatrix(0, 0.02, 0)]); return mergeParts(p); })(),
    strawberry: (() => { const p = []; for (let i = 0; i < 4; i++) { const b = new THREE.SphereGeometry(0.14, 7, 5); paintGeometry(b, '#6f9048'); p.push([b, makeMatrix(Math.cos(i * 1.7) * 0.12, 0.08, Math.sin(i * 1.7) * 0.12, 0, 0, 0, 1, 0.45, 1)]); } for (let i = 0; i < 3; i++) { const s = new THREE.SphereGeometry(0.05, 6, 5); paintGeometry(s, '#d2463c'); p.push([s, makeMatrix(Math.cos(i * 2.2) * 0.2, 0.05, Math.sin(i * 2.2) * 0.2, 0, 0, 0, 1, 1.25, 1)]); } return mergeParts(p); })(),
  };
  const vegMat = washMaterial({ vertexColors: true }, { amt: 0.1 });
  for (const kind of Object.keys(vegGeo)) {
    const list = veg.filter((v) => v.kind === kind).map((v) => ({ ...v, ry: R() * TAU, s: 0.9 + R() * 0.25 }));
    scene.add(instanced(vegGeo[kind], vegMat, list, { cast: kind === 'cabbage', name: kind }));
  }
  // blackberry bramble
  {
    const y = heightAt(L.BRAMBLE.x, L.BRAMBLE.z);
    const M = makeMatrix(L.BRAMBLE.x, y, L.BRAMBLE.z);
    for (let i = 0; i < 9; i++) {
      const a = i * 0.8;
      put(B, G.ico, i % 2 ? '#56703f' : '#4d6639', M, Math.cos(a) * 1.1 * (i / 9), 0.5 + (i % 3) * 0.2, Math.sin(a) * 0.9 * (i / 9), 0, i, 0, 0.8, 0.6, 0.8);
    }
    for (let i = 0; i < 26; i++) {
      const a = R() * TAU, rr = 0.6 + R() * 0.9;
      put(B, G.sphereLo, R() < 0.7 ? '#3b2a3f' : '#8c3b4a', M, Math.cos(a) * rr, 0.4 + R() * 0.8, Math.sin(a) * rr * 0.8, 0, 0, 0, 0.06);
    }
    C.addCircle(L.BRAMBLE.x, L.BRAMBLE.z, 1.4, y, 1.3, { cam: false });
    W.interactables.push({ kind: 'fruit', name: 'the bramble bush', fruitName: 'some blackberries', x: L.BRAMBLE.x, z: L.BRAMBLE.z, y: y + 2.1, headY: 0.7, shape: { type: 'circle', r: 1.4 } });
  }

  /* ---- pond */
  {
    const water = new THREE.Mesh(new THREE.CircleGeometry(L.POND.r + 2.1, 48), waterMaterial({ cx: L.POND.x, cz: L.POND.z, r: L.POND.r + 2, deep: '#58797a', shallow: '#a2bfbd' }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(L.POND.x, POND_LEVEL, L.POND.z);
    water.receiveShadow = false;
    scene.add(water);
    C.addCircle(L.POND.x, L.POND.z, L.POND.r - 0.4, POND_LEVEL - 2, 50, { cam: false });
    W.interactables.push({ kind: 'water', name: 'the duck pond', x: L.POND.x, z: L.POND.z, y: POND_LEVEL + 1.2, headY: -0.2, edge: true, shape: { type: 'circle', r: L.POND.r - 0.4 } });
    for (let i = 0; i < 16; i++) {
      const a = R() * TAU, rr = 2 + R() * (L.POND.r - 2.5);
      const x = L.POND.x + Math.cos(a) * rr, z = L.POND.z + Math.sin(a) * rr;
      const s = 0.35 + R() * 0.3;
      put(B, new THREE.CircleGeometry(1, 12, 0.3, TAU - 0.6), '#7f9a58', makeMatrix(x, POND_LEVEL + 0.03, z, -Math.PI / 2, 0, R() * TAU), 0, 0, 0, 0, 0, 0, s, s, s, { side: THREE.DoubleSide });
      if (R() < 0.35) put(B, G.cone, '#f2dde0', makeMatrix(x, POND_LEVEL + 0.08, z), 0, 0, 0, 0, 0, 0, 0.1, 0.1, 0.1);
    }
  }
  /* ---- distant lake */
  {
    const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 64), waterMaterial({ cx: L.LAKE.x, cz: L.LAKE.z, r: L.LAKE.r * 1.3, deep: '#7f9aa6', shallow: '#a9bec4', sky: '#eef2f0', fog }));
    lake.rotation.x = -Math.PI / 2;
    lake.scale.set(L.LAKE.r * 1.25, L.LAKE.r * 1.25 / 1.35, 1);
    lake.position.set(L.LAKE.x, -2.2, L.LAKE.z);
    scene.add(lake);
  }

  /* ---- distant farmsteads dotted on the fells */
  for (let i = 0; i < 12; i++) {
    const a = R() * TAU, rr = 150 + R() * 220;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.hypot(x - L.LAKE.x, (z - L.LAKE.z) * 1.35) < L.LAKE.r * 1.1) continue;
    const y = heightAt(x, z);
    const M = makeMatrix(x, y, z, 0, R() * TAU, 0);
    const s = 1.3;
    put(B, G.box, R() < 0.6 ? PAL.whitewash : PAL.stone, M, 0, 1.6 * s, 0, 0, 0, 0, 7 * s, 3.4 * s, 4.5 * s);
    B.add(gableGeom(7 * s, 4.5 * s, 2.2 * s), mat(PAL.slate), new THREE.Matrix4().multiplyMatrices(M, makeMatrix(0, 3.3 * s, 0)));
  }

  /* ---- trees */
  const treeMatWind = washMaterial({ vertexColors: true }, { amt: 0.1, wind: 0.006, windBase: 2.8, cut: 1.5 });
  const treeMat = washMaterial({ vertexColors: true }, { amt: 0.1, cut: 1.5 });
  const place = (list, extra = {}) => list.map((t) => ({ x: t.x, y: heightAt(t.x, t.z) - 0.15, z: t.z, ry: R() * TAU, s: t.s ?? 1, ...extra }));
  const oakA = oakGeometry(11), oakB = oakGeometry(23), birchG = birchGeometry(5), pineG = pineGeometry();
  const near = (t) => Math.hypot(t.x, t.z) < 104;
  const oakList = place(oaks);
  const both = (geo, m, list, name) => {
    const a = list.filter(near), b = list.filter((t) => !near(t));
    if (a.length) scene.add(instanced(geo, m, a, { cast: true, name }));
    if (b.length) scene.add(instanced(geo, m, b, { cast: false, receive: false, name: name + '-far' }));
  };
  both(oakA, treeMatWind, oakList.filter((_, i) => i % 2 === 0), 'oaks');
  both(oakB, treeMatWind, oakList.filter((_, i) => i % 2 === 1), 'oaks2');
  both(birchG, treeMatWind, place(birches), 'birches');
  both(pineG, treeMat, place(pines), 'pines');
  scene.add(instanced(willowGeometry(9), treeMatWind, place(L.WILLOWS.map(([x, z]) => ({ x, z, s: 1.1 }))), { cast: true, name: 'willows' }));
  scene.add(instanced(oakGeometry(31, '#c9453a'), treeMatWind, place(L.APPLE_TREES.map(([x, z]) => ({ x, z, s: 0.95 + R() * 0.15 }))), { cast: true, name: 'apples' }));
  scene.add(instanced(oakGeometry(37, '#c8c064'), treeMatWind, place(L.PEAR_TREES.map(([x, z]) => ({ x, z, s: 1.0 }))), { cast: true, name: 'pears' }));
  for (const t of oaks) {
    if (Math.hypot(t.x, t.z) >= L.WORLD_R + 2) continue;
    const y = heightAt(t.x, t.z);
    C.addCircle(t.x, t.z, 0.5 * t.s, y, 6, { cam: false, tree: { y0: y + 2.6 * t.s, y1: y + 7.8 * t.s, r: 3.6 * t.s } });
    W.treeTops.push(new THREE.Vector3(t.x, y + 6.5 * t.s, t.z));
  }
  for (const t of birches) {
    if (Math.hypot(t.x, t.z) >= L.WORLD_R + 2) continue;
    const y = heightAt(t.x, t.z);
    C.addCircle(t.x, t.z, 0.25, y, 6, { cam: false, tree: { y0: y + 3.0 * t.s, y1: y + 8.5 * t.s, r: 2.0 * t.s } });
  }
  for (const [x, z] of L.WILLOWS) {
    const y = heightAt(x, z);
    C.addCircle(x, z, 0.6, y, 5, { cam: false, tree: { y0: y + 1.3, y1: y + 6.2, r: 3.3 } });
  }
  for (const [x, z] of [...L.APPLE_TREES, ...L.PEAR_TREES]) {
    const y = heightAt(x, z);
    C.addCircle(x, z, 0.45, y, 4, { cam: false, tree: { y0: y + 1.5, y1: y + 6.0, r: 2.9 } });
    W.treeTops.push(new THREE.Vector3(x, y + 4.6, z));
  }

  // hedges and bushes
  const bushes = [];
  for (let x = L.ORCHARD.x0; x <= L.ORCHARD.x1; x += 1.6) {
    if (x > 27 && x < 33) continue;
    bushes.push({ x, z: L.ORCHARD.z0 + (R() - 0.5) * 0.4, s: 0.9 + R() * 0.3 });
  }
  C.addSegment(L.ORCHARD.x0, L.ORCHARD.z0, 27, L.ORCHARD.z0, 1.4, heightAt(24, L.ORCHARD.z0), 1.05, { cam: false });
  C.addSegment(33, L.ORCHARD.z0, L.ORCHARD.x1, L.ORCHARD.z0, 1.4, heightAt(40, L.ORCHARD.z0), 1.05, { cam: false });
  for (const b of L.BUILDINGS) {
    if (b.kind !== 'cottage') continue;
    for (let i = 0; i < 3; i++) {
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const lx = (R() - 0.5) * b.w, lz = -b.d / 2 - 1.6;
      bushes.push({ x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c, s: 0.9 + R() * 0.4 });
    }
  }
  for (let i = 0; i < 70; i++) {
    const a = R() * TAU, rr = 30 + R() * 55;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (groundKind(x, z) !== 'grass') continue;
    if ([...L.OAKS].some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 3)) continue;
    if (x > L.PADDOCK.x0 - 2 && x < L.PADDOCK.x1 + 2 && z > L.PADDOCK.z0 - 2 && z < L.PADDOCK.z1 + 2) continue;
    if (x > L.MEADOW.x0 - 2 && x < L.MEADOW.x1 + 2 && z > L.MEADOW.z0 - 2 && z < L.MEADOW.z1 + 2) continue;
    if (Math.hypot(x - L.HOMES.hillside.x, z - L.HOMES.hillside.z) < 13) continue;
    bushes.push({ x, z, s: 0.8 + R() * 0.6 });
    C.addCircle(x, z, 0.75 * (0.8 + R() * 0.3), heightAt(x, z), 1.25, { cam: false });
  }
  scene.add(instanced(bushGeometry(3), treeMatWind, place(bushes), { cast: true, name: 'bushes' }));

  /* ---- grass, flowers, wheat, reeds */
  const grassMat = soft(washMaterial({ vertexColors: true }, { amt: 0.12, wind: 0.5, windBase: 0 }));
  const tufts = [];
  for (let i = 0; i < 9000 && tufts.length < 3400; i++) {
    const a = R() * TAU, rr = Math.sqrt(R()) * (L.WORLD_R + 1);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const k = groundKind(x, z);
    if (k !== 'grass') continue;
    if (fbm2(x * 0.06, z * 0.06, 2) < 0.38 && R() < 0.6) continue;
    tufts.push({ x, y: heightAt(x, z) - 0.02, z, ry: R() * TAU, s: 0.8 + R() * 0.8 });
  }
  scene.add(instanced(tuftGeometry(), grassMat, tufts, { tint: 0.25, name: 'grass' }));

  const flowerMat = soft(washMaterial({ vertexColors: true }, { amt: 0.08, wind: 0.4, windBase: 0 }));
  const tallFlowerMat = washMaterial({ vertexColors: true }, { amt: 0.08, wind: 0.05, windBase: 0.2 });
  const scatter = (n, test, s0 = 0.8, s1 = 1.2) => {
    const list = [];
    for (let i = 0; i < n * 6 && list.length < n; i++) {
      const a = R() * TAU, rr = Math.sqrt(R()) * (L.WORLD_R - 1);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (!test(x, z)) continue;
      list.push({ x, y: heightAt(x, z), z, ry: R() * TAU, s: s0 + R() * (s1 - s0) });
    }
    return list;
  };
  const inMeadowish = (x, z) => groundKind(x, z) === 'grass' && (
    (x > L.MEADOW.x0 && x < L.MEADOW.x1 && z > L.MEADOW.z0 && z < L.MEADOW.z1) ||
    Math.hypot(x - L.HILL.x, z - L.HILL.z) < 22 || Math.hypot(x - L.GREEN.x, z - L.GREEN.z) < 11 || fbm2(x * 0.05 + 9, z * 0.05, 2) > 0.58);
  scene.add(instanced(flowerGeometry('daisy'), flowerMat, scatter(700, inMeadowish), { name: 'daisies', colors: ['#f7f3ea'] }));
  scene.add(instanced(flowerGeometry('button'), flowerMat, scatter(650, inMeadowish), { name: 'buttercups', colors: ['#f0cf45', '#e9c23c'] }));
  scene.add(instanced(flowerGeometry('button'), flowerMat, scatter(260, (x, z) => groundKind(x, z) === 'grass' && L.WHEAT.some((w) => x > w.x0 - 3 && x < w.x1 + 3 && z > w.z0 - 3 && z < w.z1 + 3)), { name: 'poppies', colors: ['#d4553f', '#c9483a'] }));
  scene.add(instanced(flowerGeometry('bluebell'), flowerMat, scatter(500, (x, z) => groundKind(x, z) === 'grass' && Math.hypot(x, z) > 72), { name: 'bluebells', colors: ['#8e93d6', '#a2a3e0'] }));
  const tallSpots = [];
  for (const b of L.BUILDINGS) {
    if (!['cottage', 'farmhouse'].includes(b.kind)) continue;
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    for (let i = 0; i < 7; i++) {
      const lx = (R() - 0.5) * (b.w - 1), lz = b.d / 2 + 0.45 + R() * 0.3;
      const doorX = b.kind === 'farmhouse' ? 0 : (b.h > 4.5 ? 0 : -b.w * 0.12);
      if (Math.abs(lx - doorX) < (b.kind === 'farmhouse' ? 1.9 : 1.0)) continue;
      const x = b.x + lx * c + lz * s, z = b.z - lx * s + lz * c;
      tallSpots.push({ x, y: heightAt(x, z), z, ry: R() * TAU, s: 0.8 + R() * 0.4 });
    }
  }
  scene.add(instanced(flowerGeometry('hollyhock'), tallFlowerMat, tallSpots, { name: 'hollyhocks', colors: ['#e3a1b3', '#c9637a', '#f3ece2', '#d98ca0'] }));
  const foxSpots = scatter(90, (x, z) => groundKind(x, z) === 'grass' && (Math.hypot(x, z) > 78 || (x > L.GARDEN.x0 - 1.5 && x < L.GARDEN.x1 + 1.5 && Math.abs(z - L.GARDEN.z1 - 0.8) < 0.8)));
  scene.add(instanced(flowerGeometry('foxglove'), tallFlowerMat, foxSpots, { name: 'foxgloves', colors: ['#c97bb0', '#d690bd', '#b86aa0'] }));

  const wheat = [];
  for (const w of L.WHEAT) {
    for (let x = w.x0 + 0.4; x < w.x1 - 0.2; x += 0.95) {
      for (let z = w.z0 + 0.4; z < w.z1 - 0.2; z += 0.95) {
        const px = x + (R() - 0.5) * 0.5, pz = z + (R() - 0.5) * 0.5;
        wheat.push({ x: px, y: heightAt(px, pz) - 0.05, z: pz, ry: R() * TAU, s: 0.9 + R() * 0.25 });
      }
    }
  }
  const wheatMat = soft(washMaterial({ vertexColors: true }, { amt: 0.12, wind: 0.14, windBase: 0 }));
  scene.add(instanced(wheatGeometry(), wheatMat, wheat, { tint: 0.14, name: 'wheat' }));

  const reeds = [];
  for (let i = 0; i < 90; i++) {
    const a = R() * TAU;
    if (Math.sin(a) < -0.55 && Math.cos(a) < 0.3) continue;
    const rr = L.POND.r + 0.2 + R() * 1.6;
    const x = L.POND.x + Math.cos(a) * rr, z = L.POND.z + Math.sin(a) * rr;
    reeds.push({ x, y: heightAt(x, z) - 0.1, z, ry: R() * TAU, s: 0.8 + R() * 0.5 });
  }
  scene.add(instanced(reedGeometry(), grassMat, reeds, { name: 'reeds' }));

  // rocks on the hill and around
  const rocks = [];
  for (let i = 0; i < 45; i++) {
    const onHill = i < 20;
    const a = R() * TAU, rr = onHill ? 4 + R() * 16 : 60 + R() * 28;
    const x = (onHill ? L.HILL.x : 0) + Math.cos(a) * rr, z = (onHill ? L.HILL.z : 0) + Math.sin(a) * rr;
    if (groundKind(x, z) !== 'grass') continue;
    const s = 0.3 + R() * 0.7;
    rocks.push({ x, y: heightAt(x, z) - s * 0.3, z, ry: R() * TAU, rx: R() * 0.4, s, sy: s * 0.6 });
    if (s > 0.55) C.addCircle(x, z, s * 0.8, heightAt(x, z), s * 0.35, { stand: true, cam: false });
  }
  const rockGeo = blobGeometry(4, 1);
  paintGeometry(rockGeo, (x, y, z, c) => c.set('#a19e93').lerp(new THREE.Color('#7f7c73'), clamp(-y * 0.8 + 0.3, 0, 1)));
  scene.add(instanced(rockGeo, treeMat, rocks, { cast: true, name: 'rocks' }));

  /* ---- fallen fruit */
  const appleGeo = (() => {
    const p = [];
    const s = new THREE.SphereGeometry(0.13, 10, 8); paintGeometry(s, (x, y, z, c) => c.set('#c8453a').lerp(new THREE.Color('#e0a04a'), clamp(x * 4, 0, 0.5)));
    const st = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 4); paintGeometry(st, '#5b4a3c');
    const lf = new THREE.SphereGeometry(0.05, 5, 4); paintGeometry(lf, '#6f8a4e');
    p.push([s, makeMatrix(0, 0.12, 0)], [st, makeMatrix(0, 0.26, 0)], [lf, makeMatrix(0.05, 0.27, 0, 0, 0, 0.5, 1, 0.3, 0.6)]);
    return mergeParts(p);
  })();
  const pearGeo = (() => {
    const p = [];
    const s = new THREE.SphereGeometry(0.12, 10, 8); paintGeometry(s, '#c7c062');
    const t = new THREE.SphereGeometry(0.08, 8, 6); paintGeometry(t, '#c2bb5c');
    const st = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 4); paintGeometry(st, '#5b4a3c');
    p.push([s, makeMatrix(0, 0.12, 0)], [t, makeMatrix(0, 0.24, 0)], [st, makeMatrix(0, 0.34, 0)]);
    return mergeParts(p);
  })();
  const fruitMat = washMaterial({ vertexColors: true }, { amt: 0.06, space: 'local' });
  const addFruit = (tx, tz, kind) => {
    const a = R() * TAU, rr = 1.3 + R() * 1.2;
    const x = tx + Math.cos(a) * rr, z = tz + Math.sin(a) * rr;
    const mesh = new THREE.Mesh(kind === 'apple' ? appleGeo : pearGeo, fruitMat);
    const y = heightAt(x, z);
    mesh.position.set(x, y, z);
    mesh.rotation.set((R() - 0.5) * 0.6, R() * TAU, (R() - 0.5) * 0.6);
    mesh.castShadow = true;
    scene.add(mesh);
    const item = { mesh, x, z, y, tree: [tx, tz], state: 'ground', t: 0, vy: 0 };
    W.fruit.push(item);
    W.interactables.push({
      kind: 'fruit', name: kind === 'apple' ? 'the apple' : 'the pear', fruitName: kind === 'apple' ? 'a juicy apple' : 'a ripe pear',
      x, z, y: y + 0.9, headY: 0.05, shape: { type: 'circle', r: 0.2 },
      available: () => item.state === 'ground',
      use: () => { item.state = 'gone'; item.t = 18 + R() * 14; mesh.visible = false; },
    });
  };
  for (const [x, z] of L.APPLE_TREES) { addFruit(x, z, 'apple'); addFruit(x, z, 'apple'); }
  for (const [x, z] of L.PEAR_TREES) { addFruit(x, z, 'pear'); addFruit(x, z, 'pear'); }

  /* ---- merge all static pieces */
  B.build(scene, { castShadow: true, receiveShadow: true, name: 'static' });

  /* ---- per-frame */
  const snap = new THREE.Vector3();
  const sRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), W.sunDir).normalize();
  const sUp = new THREE.Vector3().crossVectors(W.sunDir, sRight).normalize();
  W.update = (dt, t, camera, focus) => {
    sky.position.copy(camera.position);
    if (W.vane) W.vane.rotation.y = Math.sin(t * 0.07) * 1.2 + Math.sin(t * 0.31) * 0.25 + 0.6;
    for (const f of W.fruit) {
      if (f.state === 'gone') {
        f.t -= dt;
        if (f.t <= 0) {
          f.state = 'falling';
          f.mesh.visible = true;
          f.mesh.position.set(f.x, f.y + 3.6, f.z);
          f.vy = 0;
          f.bounce = 0;
        }
      } else if (f.state === 'falling') {
        f.vy -= 22 * dt;
        f.mesh.position.y += f.vy * dt;
        f.mesh.rotation.x += dt * 4;
        if (f.mesh.position.y <= f.y) {
          f.mesh.position.y = f.y;
          if (f.bounce < 2 && Math.abs(f.vy) > 2) { f.vy = -f.vy * 0.35; f.bounce++; if (W.onFruitLand) W.onFruitLand(f); }
          else { f.state = 'ground'; f.mesh.rotation.x = 0.3; }
        }
      }
    }
    // shadow camera follows the action, snapped to texels to avoid shimmering
    const d = W.sunDir;
    const texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
    const px = Math.round(focus.dot(sRight) / texel) * texel;
    const py = Math.round(focus.dot(sUp) / texel) * texel;
    const pz = focus.dot(d);
    snap.copy(sRight).multiplyScalar(px).addScaledVector(sUp, py).addScaledVector(d, pz);
    sun.target.position.copy(snap);
    sun.position.copy(snap).addScaledVector(d, 90);
  };

  return W;
}

function gableGeom(w, d, h) {
  const hw = w / 2, hd = d / 2;
  const P = [hw, 0, hd, hw, 0, -hd, hw, h, 0, -hw, 0, -hd, -hw, 0, hd, -hw, h, 0,
    -hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, 0, hd, hw, h, 0, -hw, h, 0,
    hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, 0, -hd, -hw, h, 0, hw, h, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
  g.computeVertexNormals();
  return g;
}

/* distance from a point to an interactable's footprint */
export function interDist(it, x, z) {
  const dx = x - it.x, dz = z - it.z;
  if (it.shape.type === 'circle') return Math.hypot(dx, dz) - it.shape.r;
  const s = it.shape;
  const lx = dx * s.cos - dz * s.sin, lz = dx * s.sin + dz * s.cos;
  const ox = Math.max(Math.abs(lx) - s.hw, 0), oz = Math.max(Math.abs(lz) - s.hd, 0);
  return Math.hypot(ox, oz);
}

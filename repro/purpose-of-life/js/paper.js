'use strict';
// Paper textures, cut and torn paper pieces, tape and pencil marks.

const PAL = {
  ink: '#2b2420', paper: '#fbf6ea', kraft: '#c99f6b', cream: '#f3e9d2', coral: '#e35a43', red: '#d33f31',
  mustard: '#f0b43a', teal: '#2f9a92', navy: '#26335a', night: '#172140', sky: '#a9d5e4', peach: '#f7dcb6',
  leaf: '#7db85a', darkleaf: '#3f7d47', pink: '#f2a2b4', lilac: '#b39fd8', orange: '#ee8a3b', gray: '#aab1b9',
  slate: '#77838f', gold: '#e8bb45', brown: '#8b5b3c', blue: '#4f86c6', news: '#ebe5d6', grass: '#9bc86b',
  money: '#8fc27f', white: '#fdf9f0', soil: '#6f4a31', dusk: '#34426e',
};
const TEX = {};
const PAT = {};
const GRAIN = [];
const IDENT = new DOMMatrix();
let BOIL = 0;   // which of the three jittered drawings is on screen this frame
let DPX = 1;    // device pixels per stage unit (keeps shadows pointing the same way on screen)

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function periodicNoise(size, period, seed) {
  const lat = new Float32Array(period * period);
  for (let j = 0; j < period; j++) for (let i = 0; i < period; i++) lat[j * period + i] = hash2(i + seed * 101, j + seed * 57);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * period, j0 = Math.floor(fy), ty = fy - j0, uy = ty * ty * (3 - 2 * ty);
    const r0 = (j0 % period) * period, r1 = ((j0 + 1) % period) * period;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * period, i0 = Math.floor(fx), tx = fx - i0, ux = tx * tx * (3 - 2 * tx);
      const a = i0 % period, b = (i0 + 1) % period;
      out[y * size + x] = lerp(lerp(lat[r0 + a], lat[r0 + b], ux), lerp(lat[r1 + a], lat[r1 + b], ux), uy);
    }
  }
  return out;
}

// draw something near a tile edge on every side so the texture repeats without seams
function wrapDraw(size, x, y, pad, fn) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
    const X = x + ox, Y = y + oy;
    if (X < -pad || X > size + pad || Y < -pad || Y > size + pad) continue;
    fn(X, Y);
  }
}

function paperTex(size, base, o = {}) {
  const { grain = 12, mottle = 16, fibers = 60, fiberA = 0.07, specks = 0, seed = 1 } = o;
  const c = mkCanvas(size, size), g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size), d = img.data;
  const n1 = periodicNoise(size, 4, seed), n2 = periodicNoise(size, 16, seed + 3);
  const r = rng(seed * 7919 + 13);
  for (let p = 0, i = 0; p < size * size; p++, i += 4) {
    const v = (n1[p] - 0.5) * mottle + (n2[p] - 0.5) * mottle * 0.6 + (r() - 0.5) * grain;
    d[i] += v; d[i + 1] += v; d[i + 2] += v * 0.92;
  }
  g.putImageData(img, 0, 0);
  g.lineCap = 'round';
  for (let k = 0; k < fibers; k++) {
    const x = r() * size, y = r() * size, len = 5 + r() * 18, a = r() * TAU, bend = (r() - 0.5) * 7;
    g.strokeStyle = r() < 0.55 ? `rgba(255,253,245,${fiberA * 1.5})` : `rgba(60,38,18,${fiberA})`;
    g.lineWidth = 0.6 + r() * 0.9;
    wrapDraw(size, x, y, len + 4, (X, Y) => {
      const x1 = X + Math.cos(a) * len, y1 = Y + Math.sin(a) * len;
      g.beginPath();
      g.moveTo(X, Y);
      g.quadraticCurveTo((X + x1) / 2 - Math.sin(a) * bend, (Y + y1) / 2 + Math.cos(a) * bend, x1, y1);
      g.stroke();
    });
  }
  for (let k = 0; k < specks; k++) {
    const x = r() * size, y = r() * size, rr = 0.5 + r() * 1.3;
    g.fillStyle = `rgba(70,45,20,${0.15 + r() * 0.25})`;
    wrapDraw(size, x, y, 3, (X, Y) => { g.beginPath(); g.arc(X, Y, rr, 0, TAU); g.fill(); });
  }
  return c;
}

function newsTex(size, seed) {
  const c = paperTex(size, PAL.news, { grain: 10, mottle: 12, fibers: 30, seed });
  const g = c.getContext('2d'), r = rng(seed * 31 + 7);
  const cols = 4, colW = size / cols, gut = 12;
  for (let ci = 0; ci < cols; ci++) {
    const x0 = ci * colW + gut / 2, x1 = (ci + 1) * colW - gut / 2;
    let y = 4;
    while (y < size - 10) {
      if (r() < 0.045 && y < size - 44) {
        const hh = 15 + r() * 8;
        g.fillStyle = 'rgba(30,26,22,0.78)';
        let x = x0;
        while (x < x1 - 8) { const w = 5 + r() * 16; g.fillRect(x, y + 2, Math.min(w, x1 - x), hh - 4); x += w + 5; }
        y += hh + 5;
        continue;
      }
      g.fillStyle = 'rgba(38,34,30,0.5)';
      const end = r() < 0.1 ? x0 + (x1 - x0) * (0.3 + r() * 0.5) : x1;
      let x = x0 + (r() < 0.08 ? 9 : 0);
      while (x < end - 3) { const w = 3 + r() * 13; g.fillRect(x, y, Math.min(w, end - x), 2.5); x += w + 2.6; }
      y += 7;
    }
    g.fillStyle = 'rgba(38,34,30,0.3)';
    g.fillRect(ci * colW, 0, 1, size);
  }
  return c;
}

function dotsTex(base, dot, size, rad, seed) {
  const c = paperTex(size, base, { grain: 10, mottle: 10, fibers: 12, seed });
  const g = c.getContext('2d');
  g.fillStyle = dot;
  for (const [x, y] of [[size * 0.25, size * 0.25], [size * 0.75, size * 0.75]]) {
    g.beginPath();
    g.ellipse(x, y, rad, rad * 0.93, 0.3, 0, TAU);
    g.fill();
  }
  return c;
}

function stripeTex(base, stripe, size, sw, seed) {
  const c = paperTex(size, base, { grain: 10, mottle: 10, fibers: 10, seed });
  const g = c.getContext('2d');
  g.fillStyle = stripe;
  g.fillRect(0, 0, sw, size);
  g.fillRect(size / 2, 0, sw, size);
  return c;
}

function gridTex(size, seed) {
  const c = paperTex(size, '#f4f1e6', { grain: 8, mottle: 8, fibers: 20, seed });
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(90,140,200,0.4)';
  g.lineWidth = 1;
  g.beginPath();
  for (let k = 0; k < size; k += 24) { g.moveTo(k + 0.5, 0); g.lineTo(k + 0.5, size); g.moveTo(0, k + 0.5); g.lineTo(size, k + 0.5); }
  g.stroke();
  return c;
}

function halftoneTex(base, dot, size, step, seed) {
  const c = paperTex(size, base, { grain: 8, mottle: 8, fibers: 10, seed });
  const g = c.getContext('2d'), n = periodicNoise(size, 2, seed);
  g.fillStyle = dot;
  for (let y = 0; y < size; y += step) for (let x = 0; x < size; x += step) {
    const X = x + ((y / step) % 2 ? step / 2 : 0), Y = y;
    const rr = 0.6 + n[(Y | 0) * size + ((X | 0) % size)] * step * 0.4;
    wrapDraw(size, X, Y, step, (a, b) => { g.beginPath(); g.arc(a, b, rr, 0, TAU); g.fill(); });
  }
  return c;
}

function grainTex(size, seed) {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  const img = g.createImageData(size, size), d = img.data, r = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    const v = r() * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 26;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function buildTextures(ctx) {
  const T = (name, c) => { TEX[name] = c; PAT[name] = ctx.createPattern(c, 'repeat'); };
  T('kraft', paperTex(512, PAL.kraft, { grain: 16, mottle: 28, fibers: 240, fiberA: 0.09, specks: 140, seed: 1 }));
  T('cream', paperTex(512, PAL.cream, { grain: 10, mottle: 14, fibers: 110, seed: 2 }));
  T('paper', paperTex(256, PAL.paper, { grain: 8, mottle: 9, fibers: 40, seed: 3 }));
  T('night', paperTex(512, PAL.night, { grain: 9, mottle: 18, fibers: 90, fiberA: 0.05, seed: 4 }));
  T('sky', paperTex(512, PAL.sky, { grain: 9, mottle: 14, fibers: 80, seed: 5 }));
  T('peach', paperTex(512, PAL.peach, { grain: 9, mottle: 14, fibers: 90, seed: 6 }));
  let s = 20;
  for (const k of ['coral', 'red', 'mustard', 'teal', 'navy', 'leaf', 'darkleaf', 'pink', 'lilac', 'orange', 'gray',
    'slate', 'gold', 'brown', 'blue', 'grass', 'money', 'white', 'soil', 'dusk'])
    T(k, paperTex(256, PAL[k], { grain: 12, mottle: 18, fibers: 36, seed: s++ }));
  T('news', newsTex(512, 3));
  T('dotsCoral', dotsTex(PAL.coral, '#fbeee0', 96, 8, 41));
  T('dotsTeal', dotsTex(PAL.teal, '#f6f0df', 80, 6.5, 42));
  T('dotsNavy', dotsTex(PAL.navy, PAL.mustard, 72, 4.5, 43));
  T('dotsMustard', dotsTex(PAL.mustard, PAL.paper, 64, 5, 44));
  T('stripePink', stripeTex(PAL.pink, '#fbf3ea', 64, 14, 45));
  T('stripeMint', stripeTex('#bfe3cf', '#f9f5ea', 48, 10, 46));
  T('stripeMustard', stripeTex(PAL.mustard, PAL.orange, 56, 12, 47));
  T('grid', gridTex(192, 48));
  T('halftone', halftoneTex('#f1e6c8', 'rgba(170,140,90,0.55)', 128, 8, 49));
  T('halftoneCoral', halftoneTex('#f6c9b8', 'rgba(227,90,67,0.6)', 128, 9, 50));
  GRAIN.push(grainTex(256, 71), grainTex(256, 72), grainTex(256, 73));
}

function fillWith(ctx, fill, m) {
  const p = PAT[fill];
  if (p) {
    if (p.setTransform) p.setTransform(m || IDENT);
    ctx.fillStyle = p;
  } else ctx.fillStyle = fill;
}

// ---------------------------------------------------------------- outlines

// Wobble an outline: a gentle waver for scissor cuts plus ragged noise for torn edges.
// `edges` scales the tear per polygon edge (e.g. [1,0,0,0] tears only the top of a rectangle).
function roughen(pts, o = {}) {
  const { amp = 1, torn = 0, step = 7, seed = 1, closed = true, edges = null } = o;
  const out = [], n = pts.length, segs = closed ? n : n - 1;
  let s = 0;
  for (let i = 0; i < segs; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1e-6;
    const nx = -dy / len, ny = dx / len;
    const tr = edges ? torn * edges[i % edges.length] : torn;
    const k = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < k; j++) {
      const u = j / k, ss = s + len * u;
      let off = amp * (vnoise(ss * 0.04, seed) + 0.4 * vnoise(ss * 0.19, seed + 3));
      if (tr) off += tr * (0.75 * vnoise(ss * 0.13, seed + 11) + 1.1 * (hash2(seed, Math.floor(ss * 0.7)) - 0.5));
      out.push([x0 + dx * u + nx * off, y0 + dy * u + ny * off]);
    }
    s += len;
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}

function toPath(pts, closed = true) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  if (closed) p.closePath();
  return p;
}

// SVG-style path data (M L H V Q C Z, absolute or relative) flattened into point lists
function svgPoly(d, seg = 12) {
  const tk = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  const subs = [];
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = 'M', cur = null;
  const num = () => parseFloat(tk[i++]);
  while (i < tk.length) {
    if (/[a-zA-Z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd === cmd.toLowerCase() && cmd !== 'z', C = cmd.toUpperCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (C === 'M') {
      cx = num() + ox; cy = num() + oy;
      cur = { pts: [[cx, cy]], closed: false };
      subs.push(cur);
      sx = cx; sy = cy;
      cmd = rel ? 'l' : 'L';
    } else if (C === 'L') {
      cx = num() + ox; cy = num() + oy;
      cur.pts.push([cx, cy]);
    } else if (C === 'H') {
      cx = num() + ox;
      cur.pts.push([cx, cy]);
    } else if (C === 'V') {
      cy = num() + oy;
      cur.pts.push([cx, cy]);
    } else if (C === 'Q') {
      const qx = num() + ox, qy = num() + oy, x = num() + ox, y = num() + oy;
      for (let k = 1; k <= seg; k++) {
        const t = k / seg, u = 1 - t;
        cur.pts.push([u * u * cx + 2 * u * t * qx + t * t * x, u * u * cy + 2 * u * t * qy + t * t * y]);
      }
      cx = x; cy = y;
    } else if (C === 'C') {
      const ax = num() + ox, ay = num() + oy, bx = num() + ox, by = num() + oy, x = num() + ox, y = num() + oy;
      for (let k = 1; k <= seg; k++) {
        const t = k / seg, u = 1 - t;
        cur.pts.push([u * u * u * cx + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x,
          u * u * u * cy + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y]);
      }
      cx = x; cy = y;
    } else if (C === 'Z') {
      cur.closed = true;
      cx = sx; cy = sy;
    } else i++;
  }
  return subs;
}

// turn a centre line into a ribbon outline with round caps; hw may be a function of 0..1
function strokeToPoly(pts, hw, capSeg = 9) {
  const L = [], R = [], n = pts.length, ws = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const w = typeof hw === 'function' ? hw(i / (n - 1)) : hw;
    ws.push(w);
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  const out = L.slice();
  const e = pts[n - 1], aE = Math.atan2(L[n - 1][1] - e[1], L[n - 1][0] - e[0]);
  for (let k = 1; k < capSeg; k++) { const a = aE - (Math.PI * k) / capSeg; out.push([e[0] + Math.cos(a) * ws[n - 1], e[1] + Math.sin(a) * ws[n - 1]]); }
  for (let i = n - 1; i >= 0; i--) out.push(R[i]);
  const s = pts[0], aS = Math.atan2(R[0][1] - s[1], R[0][0] - s[0]);
  for (let k = 1; k < capSeg; k++) { const a = aS - (Math.PI * k) / capSeg; out.push([s[0] + Math.cos(a) * ws[0], s[1] + Math.sin(a) * ws[0]]); }
  return out;
}

function ellipsePts(cx, cy, rx, ry, n = 0) {
  n = n || Math.max(16, Math.round((rx + ry) * 0.5));
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return pts;
}

function screenOffset(ctx, dx, dy) {
  const m = ctx.getTransform(), det = m.a * m.d - m.b * m.c || 1;
  const sx = dx * DPX, sy = dy * DPX;
  return [(m.d * sx - m.c * sy) / det, (-m.b * sx + m.a * sy) / det];
}

// ---------------------------------------------------------------- paper pieces

let pieceSeed = 1000;
class Piece {
  constructor(pts, o = {}) {
    this.o = Object.assign({ cut: 1.1, torn: 0, rim: 3, step: 7, seed: (pieceSeed += 7919), edges: null }, o);
    const { cut, torn, step, seed, edges } = this.o;
    const r = rng(seed);
    this.tex = new DOMMatrix([1, 0, 0, 1, Math.floor(r() * 400), Math.floor(r() * 400)]);
    this.face = [];
    this.ink = [];
    this.rim = torn ? [] : null;
    for (let v = 0; v < 3; v++) {
      const s = seed + v * 131;
      this.face.push(toPath(roughen(pts, { amp: cut, torn, step, seed: s, edges })));
      if (torn) this.rim.push(toPath(roughen(pts, { amp: cut, torn: torn * 1.15, step, seed: s + 57, edges })));
      this.ink.push(toPath(roughen(pts.map(([x, y]) => [x + 1.6, y - 1.2]), { amp: cut * 0.8 + 0.6, step: step * 1.4, seed: s + 91 })));
    }
  }
  draw(ctx, fill, o = {}) {
    const v = BOIL % 3, face = this.face[v];
    const sh = o.shadow === undefined ? 1 : o.shadow;
    if (sh > 0) {
      const a = o.shadowA === undefined ? 1 : o.shadowA;
      for (const [k, al] of [[1.7, 0.08], [0.9, 0.16]]) {
        const [dx, dy] = screenOffset(ctx, 5 * sh * k, 7 * sh * k);
        ctx.save();
        ctx.translate(dx, dy);
        ctx.fillStyle = `rgba(48,28,10,${al * a})`;
        ctx.fill(face);
        ctx.restore();
      }
    }
    if (this.rim && o.rim !== false) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = this.o.rim * 2;
      ctx.strokeStyle = o.rimCol || '#fbf7ee';
      ctx.stroke(this.rim[v]);
    }
    fillWith(ctx, fill, this.tex);
    ctx.fill(face);
    if (o.ink) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.ink;
      ctx.strokeStyle = o.inkCol || PAL.ink;
      ctx.stroke(this.ink[v]);
    }
  }
  clip(ctx) { ctx.clip(this.face[BOIL % 3]); }
}

const P = {
  rect: (w, h, o) => new Piece([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], o),
  box: (x, y, w, h, o) => new Piece([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o),
  ellipse: (rx, ry, o, n) => new Piece(ellipsePts(0, 0, rx, ry, n), o),
  circleAt: (x, y, r, o) => new Piece(ellipsePts(x, y, r, r), o),
  poly: (pts, o) => new Piece(pts, o),
  svg: (d, o) => new Piece(svgPoly(d)[0].pts, o),
  stroke: (pts, hw, o) => new Piece(strokeToPoly(pts, hw), o),
};

// ---------------------------------------------------------------- pencil, ink, crayon

function inkLine(ctx, pts, w = 3, col = PAL.ink, seed = 1, amp = 0.8) {
  if (!pts || pts.length < 2) return;
  const b = BOIL * 7919 + seed * 13;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0] + vnoise(i * 0.55, b) * amp, y = pts[i][1] + vnoise(i * 0.55 + 17.3, b) * amp;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = w;
  ctx.strokeStyle = col;
  ctx.stroke();
}

function crayon(ctx, pts, w, col, seed = 1, alpha = 1) {
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha *= alpha * 0.6;
  for (let k = 0; k < 3; k++) {
    const ox = (hash2(seed, k) - 0.5) * w * 0.4, oy = (hash2(seed + 9, k) - 0.5) * w * 0.4;
    inkLine(ctx, pts.map(([x, y]) => [x + ox, y + oy]), w * (1 - k * 0.22), col, seed + k * 31, 1.3);
  }
  ctx.restore();
}

function qpts(x0, y0, cx, cy, x1, y1, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
  }
  return out;
}

function cpts(p0, p1, p2, p3, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}

// the first fraction p of a polyline (for things that are drawn on over time)
function upto(pts, p) {
  if (p >= 1) return pts;
  if (p <= 0 || pts.length < 2) return [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const lim = total * p, out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= lim) {
      const t = (lim - acc) / (d || 1);
      out.push([lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]);
      return out;
    }
    acc += d;
    out.push(pts[i]);
  }
  return out;
}

function pointAt(pts, p) {
  const u = upto(pts, clamp(p, 0.0001, 1));
  return u[u.length - 1];
}

function starPts(x, y, r, inner = 0.45, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5, rr = i % 2 ? r * inner : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return pts;
}

function doodleStar(ctx, x, y, r, col, w = 3, seed = 1, p = 1) {
  const pts = starPts(x, y, r);
  pts.push(pts[0]);
  inkLine(ctx, upto(pts, p), w, col, seed, 0.9);
}

function sparkle(ctx, x, y, r, col, w = 3, seed = 1) {
  inkLine(ctx, [[x - r, y], [x + r, y]], w, col, seed, 0.6);
  inkLine(ctx, [[x, y - r], [x, y + r]], w, col, seed + 1, 0.6);
  const q = r * 0.42;
  inkLine(ctx, [[x - q, y - q], [x + q, y + q]], w * 0.75, col, seed + 2, 0.4);
  inkLine(ctx, [[x - q, y + q], [x + q, y - q]], w * 0.75, col, seed + 3, 0.4);
}

function spiralPts(x, y, r, turns = 2.4, n = 60, rot = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = rot + t * turns * TAU, rr = r * t;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return pts;
}

function heartPts(s, n = 64, cx = 0, cy = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([cx + (x * s) / 16, cy + (y * s) / 16]);
  }
  return pts;
}

// ---------------------------------------------------------------- tape

const TAPES = [];
function tapePiece(w, h, seed) {
  const teeth = 4, pts = [[-w / 2, -h / 2], [w / 2, -h / 2]];
  for (let i = 1; i < teeth * 2; i++) pts.push([w / 2 + (i % 2 ? 3.5 : -1.5) + (hash2(seed, i) - 0.5) * 2.5, -h / 2 + (h * i) / (teeth * 2)]);
  pts.push([w / 2, h / 2], [-w / 2, h / 2]);
  for (let i = teeth * 2 - 1; i >= 1; i--) pts.push([-w / 2 + (i % 2 ? -3.5 : 1.5) + (hash2(seed + 5, i) - 0.5) * 2.5, -h / 2 + (h * i) / (teeth * 2)]);
  return new Piece(pts, { cut: 0.5, step: 14, seed });
}
function buildTapes() {
  let seed = 900;
  for (const w of [70, 100, 140]) for (let v = 0; v < 2; v++) TAPES.push(tapePiece(w, 28, (seed += 17)));
}
function tape(ctx, x, y, rot, size = 1, variant = 0) {
  const pc = TAPES[clamp(size | 0, 0, 2) * 2 + (variant & 1)];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  pc.draw(ctx, 'rgba(240,229,190,0.78)', { shadow: 0.3, shadowA: 0.55 });
  ctx.restore();
}

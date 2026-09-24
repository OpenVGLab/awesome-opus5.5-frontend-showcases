// Reusable painting primitives: camera, ink-wash landscape pieces, props, effects, a tiny 3D renderer.
import { W, H, TAU, clamp, lerp, hash, fbm, vnoise, rgba, hex, rng, roundRect, FONT_SERIF } from './util.js';

// ---------- camera ----------
// cam = {x, y, zoom, rot, sx, sy}: world point (x, y) lands at the screen centre.
// depth < 1 gives parallax (0 = pinned to the screen, 1 = moves with the world).
export function camTransform(ctx, cam, depth = 1) {
  const z = 1 + (cam.zoom - 1) * depth;
  const cx = lerp(W / 2, cam.x, depth), cy = lerp(H / 2, cam.y, depth);
  ctx.translate(W / 2 + (cam.sx || 0) * depth, H / 2 + (cam.sy || 0) * depth);
  if (cam.rot) ctx.rotate(cam.rot * depth);
  ctx.scale(z, z);
  ctx.translate(-cx, -cy);
}

export function layer(ctx, cam, depth, fn) {
  ctx.save();
  camTransform(ctx, cam, depth);
  fn();
  ctx.restore();
}

export function sky(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function glow(ctx, x, y, r, color, a) {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function sun(ctx, x, y, r, core, glowColor, glowR, glowA = 0.5) {
  glow(ctx, x, y, glowR, glowColor, glowA);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// ---------- karst mountains ----------
export function makeRange(seed, o) {
  const { x0 = -500, x1 = W + 500, base, hMin, hMax, wMin, wMax, count, rough = 8, step = 5, pMin = 0.22, pMax = 0.5 } = o;
  const R = rng(seed);
  const bumps = [];
  for (let i = 0; i < count; i++) {
    bumps.push({ c: lerp(x0, x1, (i + 0.15 + R() * 0.7) / count), h: lerp(hMin, hMax, R()), w: lerp(wMin, wMax, R()), p: lerp(pMin, pMax, R()) });
  }
  if (o.extra) bumps.push(...o.extra);
  const pts = [];
  let top = Infinity;
  for (let x = x0; x <= x1 + 0.1; x += step) {
    let y = 0;
    for (const b of bumps) {
      const q = (x - b.c) / b.w;
      if (q > -1 && q < 1) {
        const v = b.h * Math.pow(1 - q * q, b.p);
        if (v > y) y = v;
      }
    }
    y += (fbm(x * 0.012, seed) * 0.8 + fbm(x * 0.06, seed + 9) * 0.25) * rough;
    const yy = base - Math.max(0, y);
    pts.push(x, yy);
    if (yy < top) top = yy;
  }
  return { pts, base, top, x0, x1 };
}

export function drawRange(ctx, r, colTop, colBot, bottom) {
  bottom = bottom ?? r.base + 60;
  const p = r.pts;
  ctx.beginPath();
  ctx.moveTo(r.x0, bottom);
  for (let i = 0; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.lineTo(r.x1, bottom);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, r.top, 0, bottom);
  g.addColorStop(0, colTop);
  g.addColorStop(1, colBot);
  ctx.fillStyle = g;
  ctx.fill();
}

export function strokeRidge(ctx, r, color, width) {
  const p = r.pts;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function mist(ctx, y, h, color, alpha, t = 0, speed = 12, seed = 1, n = 8) {
  const g = ctx.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-900, y - h, W + 1800, h * 2);
  for (let i = 0; i < n; i++) {
    const w = 380 + hash(seed * 13.1 + i) * 520;
    const span = W + 1600;
    const x = ((hash(seed * 7.3 + i) * span + t * speed * (0.5 + hash(i * 3.7 + seed))) % span) - 800;
    const yy = y + (hash(seed * 3.9 + i * 1.7) - 0.5) * h * 0.9;
    ctx.save();
    ctx.translate(x, yy);
    ctx.scale(1, (h * 0.9) / w);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    rg.addColorStop(0, rgba(color, alpha * 0.9));
    rg.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, w / 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

export function birds(ctx, t, x0, y0, n, color, seed, speed = 40) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 42 + hash(seed + i) * 34 + t * speed;
    const y = y0 + hash(seed + i * 2.1) * 46 + Math.sin(t * 2 + i) * 4;
    const f = Math.sin(t * 9 + i * 1.3) * 5;
    const s = 7 + hash(i + seed) * 4;
    ctx.beginPath();
    ctx.moveTo(x - s, y - f);
    ctx.quadraticCurveTo(x - s * 0.4, y - f * 0.2 - 2, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - f * 0.2 - 2, x + s, y - f);
    ctx.stroke();
  }
}

// ---------- architecture & plants ----------
// Pagoda silhouette standing on (x, y). ~150 units tall at s = 1.
export function pagoda(ctx, x, y, s, color, { tiers = 5, lit = 0, litColor = '#FFC873' } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.fillRect(-38, -8, 76, 8);
  let yy = -8, w = 46;
  const windows = [];
  for (let i = 0; i < tiers; i++) {
    const bh = i === 0 ? 22 : 14;
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, yy - bh, w, bh);
    windows.push([yy - bh * 0.72, bh * 0.5, w]);
    yy -= bh;
    const rw = w * 0.62 + 16, rh = 9, lift = 7;
    ctx.beginPath();
    ctx.moveTo(-rw, yy - lift);
    ctx.quadraticCurveTo(-rw * 0.72, yy + 2.5, -w * 0.5, yy + 1.5);
    ctx.lineTo(w * 0.5, yy + 1.5);
    ctx.quadraticCurveTo(rw * 0.72, yy + 2.5, rw, yy - lift);
    ctx.quadraticCurveTo(rw * 0.55, yy - rh * 0.6, w * 0.26, yy - rh);
    ctx.lineTo(-w * 0.26, yy - rh);
    ctx.quadraticCurveTo(-rw * 0.55, yy - rh * 0.6, -rw, yy - lift);
    ctx.fill();
    yy -= rh;
    w *= 0.8;
  }
  ctx.fillRect(-1.6, yy - 24, 3.2, 24);
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.ellipse(0, yy - 7 - k * 5.5, 4.4 - k, 1.7, 0, 0, TAU);
    ctx.fill();
  }
  if (lit > 0) {
    ctx.fillStyle = rgba(litColor, lit);
    for (const [wy, wh, ww] of windows) {
      for (let k = -1; k <= 1; k++) ctx.fillRect(k * ww * 0.28 - 2.5, wy, 5, wh);
    }
  }
  ctx.restore();
}

// Ink pine: trunk plus fans of needle strokes.
export function pine(ctx, x, y, s, color, seed = 1, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.bezierCurveTo(-14, -100, 44, -160, 26, -300);
  ctx.lineTo(36, -298);
  ctx.bezierCurveTo(58, -160, 10, -96, 18, 0);
  ctx.closePath();
  ctx.fill();
  const pads = [[30, -300, 120], [-70, -250, 100], [120, -238, 118], [-30, -180, 90], [150, -160, 96], [60, -210, 80]];
  pads.forEach(([px, py, w], idx) => {
    const sway = Math.sin(t * 0.8 + idx) * 2;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(26 + (py + 300) * -0.08, py + 16);
    ctx.quadraticCurveTo((px + 26) / 2, py + 22, px + sway, py + 6);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(px + sway, py, w * 0.5, w * 0.16, 0, Math.PI, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.6;
    const n = 26;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a = Math.PI + (k / (n - 1)) * Math.PI;
      const L = w * (0.36 + hash(seed + k * 1.7 + idx * 9.1) * 0.2);
      const ox = px + sway + Math.cos(a) * w * 0.12;
      ctx.moveTo(ox, py + 4);
      ctx.lineTo(ox + Math.cos(a) * L, py + 4 + Math.sin(a) * L * 0.42);
    }
    ctx.stroke();
  });
  ctx.restore();
}

function leaf(ctx, x, y, ang, len, wid) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.4, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.4, wid * 0.55, 0, 0);
  ctx.fill();
  ctx.restore();
}

export function bamboo(ctx, x, yBase, h, lean, color, leafColor, seed, t) {
  const R = rng(seed);
  const segN = Math.max(3, Math.round(h / 95));
  const sway = Math.sin(t * 0.9 + seed) * 0.035 + lean;
  const w0 = 15 * (h / 900 + 0.6);
  let px = x, py = yBase;
  for (let i = 0; i < segN; i++) {
    const len = h / segN;
    const a = -Math.PI / 2 + sway * (0.3 + i / segN);
    const nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len;
    const w = w0 * (1 - (i / segN) * 0.45);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(nx, ny + 3);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = leafColor;
    ctx.beginPath();
    ctx.moveTo(nx - w * 0.62, ny);
    ctx.lineTo(nx + w * 0.62, ny);
    ctx.stroke();
    if (i > 0 && R() < 0.8) {
      const n = 2 + Math.floor(R() * 3);
      ctx.fillStyle = leafColor;
      for (let k = 0; k < n; k++) {
        const side = R() < 0.5 ? -1 : 1;
        const base = 0.3 + R() * 0.85 + Math.sin(t * 1.4 + k + i + seed) * 0.06;
        leaf(ctx, nx, ny, side > 0 ? base : Math.PI - base, 58 + R() * 52, 9 + R() * 5);
      }
    }
    px = nx;
    py = ny;
  }
}

// ---------- petals ----------
export function petal(ctx, x, y, size, rot, color, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, flip);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.9, -size * 0.6, size * 0.7, size * 0.6, 0, size);
  ctx.bezierCurveTo(-size * 0.7, size * 0.6, -size * 0.9, -size * 0.6, 0, -size);
  ctx.fill();
  ctx.restore();
}

export function petalField(ctx, t, n, seed, box, colors, opts = {}) {
  const { wind = 70, fall = 60, size = 7, alpha = 1 } = opts;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const h1 = hash(seed + i * 1.31), h2 = hash(seed + i * 2.77), h3 = hash(seed + i * 4.19), h4 = hash(seed + i * 6.53);
    const span = box.h + 120;
    const v = fall * (0.6 + h2 * 0.8);
    const y = box.y - 60 + ((h1 * span + t * v) % span);
    const xw = box.w + 240;
    const x = box.x - 120 + ((((h3 * xw + t * wind * (0.6 + h4 * 0.8) + Math.sin(t * 1.7 + i) * 26) % xw) + xw) % xw);
    petal(ctx, x, y, size * (0.6 + h3 * 0.7), t * (1 + h2 * 2) + i, colors[i % colors.length], Math.cos(t * (2 + h4 * 3) + i * 2));
  }
  ctx.globalAlpha = 1;
}

// ---------- brush-stroke wipe ----------
function wipeX(y, u, seed) {
  const X = lerp(-520, W + 520, u);
  return X + (y - H / 2) * -0.42 + fbm(y * 0.0035, seed) * 130 + vnoise(y * 0.018, seed + 3) * 22;
}

export function wipePath(ctx, u, seed) {
  ctx.beginPath();
  ctx.moveTo(-900, -220);
  for (let y = -220; y <= H + 220; y += 12) ctx.lineTo(wipeX(y, u, seed), y);
  ctx.lineTo(-900, H + 220);
  ctx.closePath();
}

// Leading ink band plus trailing dry-brush streaks.
export function wipeInk(ctx, u, seed) {
  ctx.save();
  ctx.beginPath();
  for (let y = -220; y <= H + 220; y += 12) ctx.lineTo(wipeX(y, u, seed) + 3, y);
  for (let y = H + 220; y >= -220; y -= 12) ctx.lineTo(wipeX(y, u, seed) - 34 - Math.abs(vnoise(y * 0.06, seed + 9)) * 34, y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(26,21,18,0.93)';
  ctx.fill();
  ctx.lineCap = 'round';
  for (let k = 0; k < 14; k++) {
    const off = -64 - k * 10 - hash(k + seed) * 18;
    ctx.beginPath();
    let pen = false;
    for (let y = -220; y <= H + 220; y += 12) {
      if (vnoise(y * 0.011 + k * 3.1, seed + k) > 0.3 - k * 0.035) { pen = false; continue; }
      const x = wipeX(y, u, seed) + off;
      if (pen) ctx.lineTo(x, y);
      else { ctx.moveTo(x, y); pen = true; }
    }
    ctx.strokeStyle = `rgba(26,21,18,${0.6 - k * 0.038})`;
    ctx.lineWidth = 2.5 + hash(k * 7 + seed) * 6;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- effects ----------
export function speedLines(ctx, cx, cy, rIn, rOut, n, color, alpha, seed, t) {
  if (alpha <= 0) return;
  ctx.fillStyle = rgba(color, alpha);
  const frame = Math.floor(t * 24);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = hash(seed + i * 1.618 + frame * 0.37) * TAU;
    const w = 0.004 + hash(seed + i * 2.3 + frame) * 0.012;
    const r0 = rIn * (0.85 + hash(seed + i * 5.1 + frame * 1.3) * 0.5);
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a - w) * rOut, cy + Math.sin(a - w) * rOut);
    ctx.lineTo(cx + Math.cos(a + w) * rOut, cy + Math.sin(a + w) * rOut);
    ctx.closePath();
  }
  ctx.fill();
}

export function burst(ctx, x, y, r, n, color, alpha, rot = 0, width = 0.18) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const L = r * (i % 2 ? 0.6 : 1);
    ctx.moveTo(Math.cos(a - width) * r * 0.15, Math.sin(a - width) * r * 0.15);
    ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
    ctx.lineTo(Math.cos(a + width) * r * 0.15, Math.sin(a + width) * r * 0.15);
  }
  ctx.fill();
  ctx.restore();
}

export function ring(ctx, x, y, r, width, color, alpha) {
  if (alpha <= 0) return;
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}

// Four-point twinkle.
export function twinkle(ctx, x, y, r, color, alpha) {
  if (alpha <= 0) return;
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// ---------- Claude spark ----------
const SPARK = (() => {
  const R = rng(20230314);
  const rays = [];
  const n = 12;
  for (let i = 0; i < n; i++) rays.push({ a: (i / n) * TAU + (R() - 0.5) * 0.16, l: 0.8 + R() * 0.2, w: 0.15 + R() * 0.035 });
  return rays;
})();

export function spark(ctx, x, y, r, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  for (const ray of SPARK) {
    const L = r * ray.l, w = r * ray.w;
    const ca = Math.cos(ray.a), sa = Math.sin(ray.a);
    const tip = L - w * 0.4;
    ctx.beginPath();
    ctx.moveTo(-sa * w * 0.55, ca * w * 0.55);
    ctx.lineTo(ca * tip - sa * w * 0.4, sa * tip + ca * w * 0.4);
    ctx.arc(ca * tip, sa * tip, w * 0.4, ray.a + Math.PI / 2, ray.a - Math.PI / 2, true);
    ctx.lineTo(sa * w * 0.55, -ca * w * 0.55);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------- seal stamp ----------
export function seal(ctx, x, y, size, text, opts = {}) {
  const { color = '#B3392B', fg = '#F7EEDF', rot = 0, font, alpha = 1, scale = 1 } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.1);
  ctx.fill();
  ctx.strokeStyle = fg;
  ctx.lineWidth = size * 0.04;
  roundRect(ctx, -size * 0.4, -size * 0.4, size * 0.8, size * 0.8, size * 0.06);
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = font || `700 ${Math.round(size * 0.32)}px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.03);
  ctx.fillStyle = color;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc((hash(i * 3.1 + size) - 0.5) * size * 0.84, (hash(i * 5.7 + size) - 0.5) * size * 0.84, size * (0.012 + hash(i * 1.9) * 0.022), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- lantern ----------
export function lantern(ctx, x, y, s, t, seed = 0, lightA = 1) {
  const sw = Math.sin(t * 1.3 + seed) * 0.05;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sw);
  ctx.strokeStyle = '#140f0c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -600);
  ctx.lineTo(0, 0);
  ctx.stroke();
  glow(ctx, 0, 44 * s, 190 * s, '#FF9A52', 0.42 * lightA);
  ctx.fillStyle = '#24170f';
  ctx.fillRect(-15 * s, 0, 30 * s, 9 * s);
  const bg = ctx.createRadialGradient(-9 * s, 38 * s, 4 * s, 0, 44 * s, 42 * s);
  bg.addColorStop(0, '#FFD29A');
  bg.addColorStop(0.35, '#F0673A');
  bg.addColorStop(1, '#8F2317');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, 44 * s, 36 * s, 34 * s, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,20,10,0.55)';
  ctx.lineWidth = 1.6 * s;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.ellipse(0, 44 * s, Math.abs(k) * 12 * s + 0.1, 34 * s, 0, -Math.PI / 2, Math.PI / 2, k < 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#24170f';
  ctx.fillRect(-13 * s, 76 * s, 26 * s, 8 * s);
  ctx.strokeStyle = '#C8352A';
  ctx.lineWidth = 2.2 * s;
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) {
    ctx.moveTo(k * 3 * s, 84 * s);
    ctx.lineTo(k * 3.4 * s + Math.sin(t * 2 + k) * 2, 118 * s);
  }
  ctx.stroke();
  ctx.restore();
}

// ---------- tiny 3D renderer ----------
export function makePagodaMesh() {
  const V = [], F = [];
  const addV = (x, y, z) => (V.push([x, y, z]), V.length - 1);
  const sq = (y, r) => [0, 1, 2, 3].map((k) => addV(Math.cos(Math.PI / 4 + (k * Math.PI) / 2) * r, y, Math.sin(Math.PI / 4 + (k * Math.PI) / 2) * r));
  const strip = (A, B, mat) => {
    for (let k = 0; k < A.length; k++) {
      const k2 = (k + 1) % A.length;
      F.push({ v: [A[k], A[k2], B[k2], B[k]], mat });
    }
  };
  const cap = (A, mat) => F.push({ v: A.slice(), mat });
  const p0 = sq(0, 2.7), p1 = sq(0.3, 2.7);
  strip(p0, p1, 'stone');
  cap(p1, 'stone');
  const s0 = sq(0.3, 2.15), s1 = sq(0.55, 2.15);
  strip(s0, s1, 'stone');
  cap(s1, 'stone');
  let y = 0.55, r = 1.45;
  for (let tier = 0; tier < 5; tier++) {
    const bh = tier === 0 ? 0.95 : 0.62;
    const w0 = sq(y, r), w1 = sq(y + bh, r);
    strip(w0, w1, 'wall');
    y += bh;
    const R0 = r * 1.75, R1 = r * 0.8, rh = 0.5 + r * 0.12;
    const bot = [], top = [];
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 4;
      const corner = k % 2 === 0;
      const rb = corner ? R0 : R0 * Math.SQRT1_2 * 1.03;
      bot.push(addV(Math.cos(a) * rb, y + (corner ? 0.28 : -0.03), Math.sin(a) * rb));
      const rt = corner ? R1 : R1 * Math.SQRT1_2;
      top.push(addV(Math.cos(a) * rt, y + rh, Math.sin(a) * rt));
    }
    strip(bot, top, 'roof');
    cap(top, 'roof');
    y += rh;
    r *= 0.8;
  }
  const base = [];
  for (let k = 0; k < 6; k++) base.push(addV(Math.cos((k / 6) * TAU) * 0.2, y, Math.sin((k / 6) * TAU) * 0.2));
  const apex = addV(0, y + 1.25, 0);
  for (let k = 0; k < 6; k++) F.push({ v: [base[k], base[(k + 1) % 6], apex], mat: 'gold' });

  let minY = Infinity, maxY = -Infinity;
  for (const v of V) {
    minY = Math.min(minY, v[1]);
    maxY = Math.max(maxY, v[1]);
  }
  for (const f of F) {
    const a = V[f.v[0]], b = V[f.v[1]], c = V[f.v[2]];
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L; ny /= L; nz /= L;
    let mx = 0, my = 0, mz = 0;
    for (const i of f.v) { mx += V[i][0]; my += V[i][1]; mz += V[i][2]; }
    mx /= f.v.length; my /= f.v.length; mz /= f.v.length;
    const isCap = f.v.every((i) => Math.abs(V[i][1] - V[f.v[0]][1]) < 1e-6);
    const ox = isCap ? 0 : mx, oy = isCap ? 1 : 0, oz = isCap ? 0 : mz;
    if (nx * ox + ny * oy + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    f.n = [nx, ny, nz];
    f.c = [mx, my, mz];
  }
  const seen = new Set(), E = [];
  for (const f of F) {
    for (let k = 0; k < f.v.length; k++) {
      const a = f.v[k], b = f.v[(k + 1) % f.v.length];
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (!seen.has(key)) { seen.add(key); E.push([a, b]); }
    }
  }
  E.sort((e1, e2) => V[e1[0]][1] + V[e1[1]][1] - (V[e2[0]][1] + V[e2[1]][1]));
  return { V, F, E, cy: (minY + maxY) / 2, h: maxY - minY };
}

export function project(mesh, o) {
  const cyw = Math.cos(o.yaw), syw = Math.sin(o.yaw), cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
  const rot = (x, y, z) => {
    const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  const P = new Array(mesh.V.length);
  for (let i = 0; i < mesh.V.length; i++) {
    const v = mesh.V[i];
    const r = rot(v[0], v[1] - mesh.cy, v[2]);
    const k = o.dist / (o.dist - r[2]);
    P[i] = { x: o.cx + r[0] * k * o.scale, y: o.cy - r[1] * k * o.scale, z: r[2] };
  }
  return { P, rot, o };
}

function shade(color, k, tint, tintAmt) {
  const c = hex(color), tc = hex(tint);
  const r = clamp(lerp(c[0] * k, tc[0] * k, tintAmt), 0, 255);
  const g = clamp(lerp(c[1] * k, tc[1] * k, tintAmt), 0, 255);
  const b = clamp(lerp(c[2] * k, tc[2] * k, tintAmt), 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function drawMeshSolid(ctx, mesh, proj, mats, alpha = 1, light = [-0.45, 0.75, 0.55]) {
  const Ll = Math.hypot(...light);
  const L = light.map((v) => v / Ll);
  const faces = [];
  const D = proj.o.dist;
  for (const f of mesh.F) {
    const n = proj.rot(f.n[0], f.n[1], f.n[2]);
    const c = proj.rot(f.c[0], f.c[1] - mesh.cy, f.c[2]);
    if (n[0] * -c[0] + n[1] * -c[1] + n[2] * (D - c[2]) <= 0) continue;
    let z = 0;
    for (const i of f.v) z += proj.P[i].z;
    faces.push({ f, z: z / f.v.length, lam: Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) });
  }
  faces.sort((a, b) => a.z - b.z);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round';
  for (const { f, lam } of faces) {
    const m = mats[f.mat];
    const col = shade(m.color, m.amb + (1 - m.amb) * lam, m.tint || m.color, m.tintAmt || 0);
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    f.v.forEach((i, j) => {
      const p = proj.P[i];
      if (j) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMeshWire(ctx, mesh, proj, progress, color, width, alpha) {
  if (alpha <= 0 || progress <= 0) return;
  const total = mesh.E.length * clamp(progress);
  const n = Math.floor(total), frac = total - n;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < Math.min(n + 1, mesh.E.length); i++) {
    const [a, b] = mesh.E[i];
    const pa = proj.P[a], pb = proj.P[b];
    const f = i < n ? 1 : frac;
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pa.x + (pb.x - pa.x) * f, pa.y + (pb.y - pa.y) * f);
  }
  ctx.stroke();
  ctx.restore();
}

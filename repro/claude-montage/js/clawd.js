// Clawd, the blocky orange Claude mascot, drawn in local units:
// torso 6x4 (x -3..3, y -5..-1), side arms 1x1, four 0.5x1 legs, feet on y = 0.
// `fid` (fidelity 0..1) controls how "capable" the rendering looks: at 0 it is rasterised at
// half-unit pixels (the resolution of the terminal block-glyph logo); by 0.56 it is smooth and shaded.
import { TAU, clamp, lerp, roundRect } from './util.js';
import { spark, glow } from './art.js';

export const ORANGE = '#D97757';
const ORANGE_HI = '#EFA285';
const ORANGE_LO = '#B95C3F';
const LEG = '#C4684B';
const EYE = '#1E1916';
const BAND = '#B8302A';
const BAND_D = '#94201C';

let pix = null, pctx = null;
function ensurePix(w, h) {
  if (!pix) {
    pix = document.createElement('canvas');
    pctx = pix.getContext('2d', { willReadFrequently: true });
  }
  if (pix.width < w || pix.height < h) {
    pix.width = Math.max(pix.width, w);
    pix.height = Math.max(pix.height, h);
  }
}

export function pixelFrac(fid) {
  if (fid < 0.2) return 0.5;
  if (fid < 0.4) return 0.25;
  if (fid < 0.56) return 0.125;
  return 0;
}

const BX0 = -12, BY0 = -14, BW = 24, BH = 17;

export function drawClawd(ctx, p) {
  const s = p.s, face = p.facing || 1, lift = p.lift || 0;
  const alpha = p.alpha ?? 1;
  if (p.shadow !== 0 && alpha > 0.5) {
    const k = 1 / (1 + lift / (s * 6));
    ctx.fillStyle = `rgba(25,15,10,${0.24 * (p.shadow ?? 1) * k})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + s * 0.08, s * 3.8 * k, s * 0.6 * k, 0, 0, TAU);
    ctx.fill();
  }
  if (p.glow > 0) aura(ctx, p);
  const pf = pixelFrac(p.fid ?? 1);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(p.x, p.y - lift);
  ctx.scale(s * face, s);
  if (pf > 0) {
    const bw = Math.ceil(BW / pf), bh = Math.ceil(BH / pf);
    ensurePix(bw, bh);
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, bw + 2, bh + 2);
    pctx.setTransform(1 / pf, 0, 0, 1 / pf, -BX0 / pf, -BY0 / pf);
    body(pctx, p, true);
    // Hard alpha threshold so the low-res sprite reads as crisp pixel art.
    const img = pctx.getImageData(0, 0, bw, bh);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
    pctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pix, 0, 0, bw, bh, BX0, BY0, bw * pf, bh * pf);
    ctx.imageSmoothingEnabled = true;
  } else {
    body(ctx, p, false);
  }
  ctx.restore();
}

function aura(ctx, p) {
  const s = p.s, cx = p.x, cy = p.y - (p.lift || 0) - 3 * s;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, cx, cy, s * 9, '#FF9A52', 0.3 * p.glow);
  ctx.globalAlpha *= 0.13 * p.glow;
  spark(ctx, cx, cy, s * 7.5, (p.t || 0) * 0.35, '#FFC48A');
  ctx.restore();
}

function body(c, p, pixel) {
  const fid = p.fid ?? 1;
  const hd = !pixel;
  const sq = p.sq ?? 1;
  const t = p.t || 0;
  const smoothK = clamp((fid - 0.55) / 0.45);
  c.save();
  if (p.rot) {
    c.translate(0, -3);
    c.rotate(p.rot);
    c.translate(0, 3);
  }
  c.scale(1 + (1 - sq) * 0.7, sq);
  if (p.band) ribbons(c, p, t);
  legs(c, p, hd);
  const armL = p.armL || [0, 1], armR = p.armR || [0, 1];
  arm(c, -1, armL[0], armL[1], hd, smoothK, p.propL);
  arm(c, 1, armR[0], armR[1], hd, smoothK, p.propR);

  const r = hd ? lerp(0.12, 0.5, smoothK) : 0;
  if (hd && fid > 0.6) {
    const g = c.createLinearGradient(-3, -5, 2.5, -0.6);
    g.addColorStop(0, ORANGE_HI);
    g.addColorStop(0.45, ORANGE);
    g.addColorStop(1, ORANGE_LO);
    c.fillStyle = g;
  } else {
    c.fillStyle = ORANGE;
  }
  roundRect(c, -3, -5, 6, 4, r);
  c.fill();
  if (hd && fid > 0.6) {
    c.save();
    roundRect(c, -3, -5, 6, 4, r);
    c.clip();
    c.fillStyle = 'rgba(255,238,224,0.2)';
    c.fillRect(-3, -5, 6, 0.45);
    const og = c.createLinearGradient(0, -1.9, 0, -1);
    og.addColorStop(0, 'rgba(90,35,20,0)');
    og.addColorStop(1, 'rgba(90,35,20,0.22)');
    c.fillStyle = og;
    c.fillRect(-3, -1.9, 6, 0.9);
    c.restore();
  }
  if (p.band) headband(c, hd);
  if (p.emblem) {
    c.save();
    c.globalAlpha *= p.emblem;
    spark(c, 0, -2.05, 0.62, t * 0.6, '#FFE7CC');
    c.restore();
  }
  eyes(c, p, hd, fid);
  if (p.blush) {
    c.fillStyle = `rgba(255,150,140,${0.45 * p.blush})`;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(side * 2.15, -2.55, 0.42, 0.22, 0, 0, TAU);
      c.fill();
    }
  }
  if (p.sweat) sweat(c, p.sweat, t);
  if (p.stars) stars(c, p.stars, t);
  c.restore();
}

function legs(c, p, hd) {
  const L = p.legs || {};
  const tuck = L.tuck || 0, spread = L.spread || 0, ph = L.phase, amp = L.amp ?? 0.35;
  c.fillStyle = hd ? LEG : ORANGE;
  const xs = [-2.25, -1.25, 1.25, 2.25];
  for (let i = 0; i < 4; i++) {
    const outer = Math.abs(xs[i]) > 2;
    const x = xs[i] + Math.sign(xs[i]) * spread * (outer ? 0.7 : 0.35);
    const lift = ph != null ? Math.max(0, Math.sin(ph + (i % 2 ? Math.PI : 0))) * amp : 0;
    const len = 1 - tuck * 0.75 - lift;
    c.fillRect(x - 0.25, -1.1, 0.5, len + 0.1);
  }
}

function arm(c, side, ang, len, hd, smoothK, prop) {
  c.save();
  c.translate(side * 3, -2.5);
  c.rotate(-side * ang);
  c.fillStyle = ORANGE;
  const x0 = side > 0 ? -0.35 : -len;
  roundRect(c, x0, -0.5, len + 0.35, 1, hd ? 0.1 + 0.32 * smoothK : 0);
  c.fill();
  if (prop === 'magnifier') magnifier(c, side, len, hd);
  c.restore();
}

function magnifier(c, side, len, hd) {
  c.save();
  c.translate(side * (len - 0.15), 0);
  c.fillStyle = '#6B4A2E';
  roundRect(c, side > 0 ? 0 : -1.5, -0.22, 1.5, 0.44, 0.2);
  c.fill();
  const lx = side * 2.3;
  c.fillStyle = 'rgba(200,232,244,0.6)';
  c.beginPath();
  c.arc(lx, 0, 0.92, 0, TAU);
  c.fill();
  c.strokeStyle = '#8C6A36';
  c.lineWidth = 0.3;
  c.stroke();
  if (hd) {
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 0.14;
    c.beginPath();
    c.arc(lx, 0, 0.6, -2.4, -1.4);
    c.stroke();
  }
  c.restore();
}

function headband(c, hd) {
  c.fillStyle = BAND;
  c.fillRect(-3.03, -4.78, 6.06, 0.64);
  if (hd) {
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.fillRect(-3.03, -4.78, 6.06, 0.15);
  }
  c.fillStyle = BAND_D;
  c.beginPath();
  c.ellipse(-3.05, -4.46, 0.34, 0.44, 0, 0, TAU);
  c.fill();
}

function ribbons(c, p, t) {
  const wind = clamp(p.wind ?? 0.35);
  c.fillStyle = BAND_D;
  for (let k = 0; k < 2; k++) {
    const len = k ? 2.7 : 3.4, n = 10;
    const base = lerp(Math.PI * 0.6 + k * 0.22, Math.PI * 1.03 + k * 0.1, wind);
    const left = [], right = [];
    let x = -3.05, y = -4.46 + k * 0.08;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const a = base + Math.sin(t * (5 + 9 * wind) - i * 0.85 + k * 1.9) * (0.1 + 0.32 * wind) * u;
      const w = lerp(0.46, 0.2, u);
      const nx = -Math.sin(a), ny = Math.cos(a);
      left.push(x + (nx * w) / 2, y + (ny * w) / 2);
      right.push(x - (nx * w) / 2, y - (ny * w) / 2);
      x += (Math.cos(a) * len) / n;
      y += (Math.sin(a) * len) / n;
    }
    c.beginPath();
    c.moveTo(left[0], left[1]);
    for (let i = 2; i < left.length; i += 2) c.lineTo(left[i], left[i + 1]);
    for (let i = right.length - 2; i >= 0; i -= 2) c.lineTo(right[i], right[i + 1]);
    c.closePath();
    c.fill();
  }
}

function eyes(c, p, hd, fid) {
  const lx = clamp(p.lookX || 0, -1, 1) * 0.32, ly = clamp(p.lookY || 0, -1, 1) * 0.28;
  const mood = p.mood || 'normal';
  const blink = clamp(p.blink || 0);
  c.fillStyle = EYE;
  c.strokeStyle = EYE;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const side of [-1, 1]) {
    const cx = side * 1.75 + lx, cy = -3.5 + ly;
    if (mood === 'happy') {
      c.lineWidth = 0.3;
      c.beginPath();
      c.moveTo(cx - 0.36, cy + 0.24);
      c.lineTo(cx, cy - 0.28);
      c.lineTo(cx + 0.36, cy + 0.24);
      c.stroke();
    } else if (mood === 'closed') {
      c.lineWidth = 0.24;
      c.beginPath();
      c.moveTo(cx - 0.38, cy - 0.04);
      c.quadraticCurveTo(cx, cy + 0.42, cx + 0.38, cy - 0.04);
      c.stroke();
    } else if (mood === 'dizzy') {
      c.lineWidth = 0.17;
      c.beginPath();
      for (let k = 0; k <= 26; k++) {
        const a = k * 0.55 + (p.t || 0) * 9 * side;
        const r = 0.03 + k * 0.017;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (k) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    } else {
      let w = 0.5, h = 1;
      if (mood === 'wide') { w = 0.64; h = 1.22; }
      h *= Math.max(0.1, 1 - blink);
      const top = cy - h / 2, bot = cy + h / 2;
      const inner = cx - (side * w) / 2, outer = cx + (side * w) / 2;
      c.beginPath();
      if (mood === 'determined' || mood === 'sad') {
        const dIn = mood === 'determined' ? 0.4 * h : 0, dOut = mood === 'sad' ? 0.4 * h : 0;
        c.moveTo(outer, top + dOut);
        c.lineTo(inner, top + dIn);
        c.lineTo(inner, bot);
        c.lineTo(outer, bot);
        c.closePath();
      } else {
        c.rect(cx - w / 2, top, w, h);
      }
      c.fill();
      if (hd && fid > 0.7 && blink < 0.4) {
        c.fillStyle = 'rgba(255,255,255,0.9)';
        const hx = side < 0 ? cx - w / 2 + 0.06 : cx + w / 2 - 0.22;
        c.fillRect(hx, top + (mood === 'sad' ? 0.45 : 0.1), 0.16, 0.2);
        c.fillStyle = EYE;
      }
    }
  }
}

function sweat(c, a, t) {
  const y = -5.1 + Math.sin(t * 6) * 0.08 + (1 - a) * 0.4;
  c.fillStyle = `rgba(140,200,235,${0.9 * a})`;
  c.beginPath();
  c.moveTo(3.35, y - 0.55);
  c.quadraticCurveTo(3.75, y, 3.35, y + 0.28);
  c.quadraticCurveTo(2.95, y, 3.35, y - 0.55);
  c.fill();
}

function star5(c, x, y, r, rot) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

function stars(c, a, t) {
  c.fillStyle = `rgba(255,214,90,${a})`;
  for (let i = 0; i < 3; i++) {
    const ang = t * 5 + (i * TAU) / 3;
    star5(c, Math.cos(ang) * 2.8, -5.9 + Math.sin(ang) * 0.6, 0.45, t * 4 + i);
  }
}

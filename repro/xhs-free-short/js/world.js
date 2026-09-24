// The island world: sky, sea, rocks, lighthouse, cottage, weather and light effects.
import {
  S, TAU, clamp, lerp, sstep, C, css, mix, mul, scl, add, hash, hash2, noise, rng, fract, wrap,
  glow, glowE, rimFill, canvas,
} from './core.js';

export const HZ = 500; // horizon line in island-scene world units
export const SEA_B = 920;
export const seaY = (d) => HZ + (SEA_B - HZ) * Math.pow(Math.max(0, d), 1.35);
export const dscale = (d) => Math.max(0.04, (seaY(d) - HZ) / 122);
export const LH = { x: 1300, base: 488, gallery: 216, lampY: 185 };

const SEA_D = [];
for (let i = 0; i < 21; i++) SEA_D.push(0.012 + Math.pow(i / 20, 1.08) * 1.02);

const COL = {
  tower: C('#eeece4'),
  red: C('#b4433b'),
  roof: C('#7a2d2b'),
  iron: C('#2b2e36'),
  rock: C('#6d6a74'),
  rockL: C('#a29ea8'),
  wall: C('#e6dfd2'),
  cotRoof: C('#5d5058'),
  door: C('#5a4434'),
  lamp: C('#ffd88a'),
  beam: C('#ffe3a6'),
  snow: C('#f2f5fb'),
  foam: C('#f4f8ff'),
};

// ---------------------------------------------------------------- sky
const STARS = [];
const CLOUD_TPL = [];
let MILKY = null;
const BOLTS = [];

function makeCloudTpl(r, w, h) {
  const circles = [];
  const n = Math.max(4, Math.round(w / (h * 0.5)));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const b = Math.sin(Math.PI * (0.08 + 0.84 * u));
    const rad = h * (0.26 + 0.52 * b * (0.55 + 0.45 * r()));
    circles.push([(-0.5 + u) * w * 0.92 + (r() - 0.5) * h * 0.25, -rad * (0.35 + 0.25 * r()), rad]);
  }
  const m = Math.round(n / 3);
  for (let i = 0; i < m; i++) {
    const u = 0.25 + 0.5 * r();
    const rad = h * (0.3 + 0.3 * r());
    circles.push([(-0.5 + u) * w * 0.8, -h * 0.45 - rad * 0.3, rad]);
  }
  return { w, h, c: circles };
}

function makeMilky() {
  const w = 1024, h = 400;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const r = rng(5);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 220; i++) {
    const x = r() * w;
    const y = h / 2 + (r() + r() + r() - 1.5) * h * 0.2;
    const rad = 18 + r() * 60;
    const pick = r();
    const col = pick < 0.25 ? [255, 196, 222] : pick < 0.6 ? [170, 196, 255] : [226, 230, 255];
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = (0.035 + r() * 0.05) * (0.4 + 0.6 * Math.sin(Math.PI * (x / w)));
    grd.addColorStop(0, css(col, a));
    grd.addColorStop(1, css(col, 0));
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    const y = h / 2 + (r() - 0.5) * h * 0.12 + Math.sin(x * 0.01) * 12;
    const rad = 10 + r() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(0,0,0,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5200; i++) {
    const x = r() * w;
    const y = h / 2 + (r() + r() + r() + r() - 2) * h * 0.16;
    const a = r() * 0.55 * Math.sin(Math.PI * (x / w));
    g.fillStyle = `rgba(235,240,255,${a.toFixed(3)})`;
    const s = r() < 0.94 ? 1 : 2;
    g.fillRect(x, y, s, s);
  }
  // fade every edge so the band never shows the texture's border when the camera sees its end
  g.globalCompositeOperation = 'destination-in';
  for (const [gx, gy, span] of [[w, 0, 0.16], [0, h, 0.2]]) {
    const grd = g.createLinearGradient(0, 0, gx, gy);
    for (let i = 0; i <= 8; i++) {
      const u = (i / 8) * span;
      const a = sstep(0, span, u);
      grd.addColorStop(u, `rgba(0,0,0,${a.toFixed(3)})`);
      grd.addColorStop(1 - u, `rgba(0,0,0,${a.toFixed(3)})`);
    }
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  return c;
}

function makeBolt(r) {
  const main = [[0, 0]];
  let x = 0;
  const n = 18;
  for (let i = 1; i <= n; i++) {
    x += (r() - 0.5) * 0.16;
    main.push([x, i / n]);
  }
  const branches = [];
  for (let b = 0; b < 3; b++) {
    const s = 3 + Math.floor(r() * 9);
    let bx = main[s][0], by = main[s][1];
    const dir = r() < 0.5 ? -1 : 1;
    const br = [[bx, by]];
    const m = 4 + Math.floor(r() * 5);
    for (let i = 0; i < m; i++) {
      bx += dir * (0.02 + r() * 0.06);
      by += 0.03 + r() * 0.03;
      br.push([bx, by]);
    }
    branches.push(br);
  }
  return { main, branches };
}

export function initWorld() {
  const r = rng(11);
  for (let i = 0; i < 1250; i++) {
    const m = Math.pow(r(), 3.2);
    STARS.push({ x: -700 + r() * 3400, y: -1500 + r() * 1990, m, ph: r() * TAU, sp: 0.5 + r() * 2.4, warm: r() < 0.25 });
  }
  // extra stars concentrated along the milky way band
  for (let i = 0; i < 380; i++) {
    const u = r();
    const along = -1100 + u * 2400;
    const across = (r() + r() + r() - 1.5) * 150;
    const ang = -0.38;
    STARS.push({
      x: 1150 + along * Math.cos(ang) - across * Math.sin(ang),
      y: -380 + along * Math.sin(ang) + across * Math.cos(ang),
      m: Math.pow(r(), 2.5) * 0.7, ph: r() * TAU, sp: 0.5 + r() * 2.4, warm: false,
    });
  }
  const cr = rng(21);
  for (let i = 0; i < 10; i++) CLOUD_TPL.push(makeCloudTpl(cr, 220 + cr() * 260, 60 + cr() * 50));
  MILKY = makeMilky();
  const br = rng(33);
  for (let i = 0; i < 5; i++) BOLTS.push(makeBolt(br));
  buildIsland();
}

export function skyShift(cam) {
  return { x: (cam.x - 960) * 0.5, y: (cam.y - 436) * 0.5 };
}

export function drawSky(L, sh) {
  const { ctx, V } = S;
  const g = ctx.createLinearGradient(0, HZ - 1150, 0, HZ + 2);
  g.addColorStop(0, css(L.skyTop));
  g.addColorStop(0.6, css(mix(L.skyTop, L.skyMid, 0.5)));
  g.addColorStop(0.86, css(L.skyMid));
  g.addColorStop(1, css(L.skyHor));
  ctx.fillStyle = g;
  const yb = Math.min(V.y1 + 5, HZ + 80);
  if (yb > V.y0) ctx.fillRect(V.x0 - 5, V.y0 - 5, V.x1 - V.x0 + 10, yb - V.y0 + 5);

  ctx.globalCompositeOperation = 'lighter';
  const sunX = L.sunX + sh.x, sunY = L.sunY + sh.y;
  const high = sstep(HZ - 120, HZ - 320, sunY);
  if (L.sun > 0.01) {
    glowE(S.sp.sun, sunX, HZ - 10, 1300, 420, 0.55 * L.sun * (1 - high * 0.7));
    glow(high > 0.5 ? S.sp.white : S.sp.sun, sunX, sunY, 520, 0.6 * L.sun);
  }
  if (L.milky > 0.01 && MILKY) {
    ctx.save();
    ctx.translate(1150 + sh.x, -380 + sh.y);
    ctx.rotate(-0.38);
    ctx.globalAlpha = L.milky * 0.9;
    ctx.drawImage(MILKY, -1300, -260, 2600, 520);
    ctx.restore();
  }
  drawStars(L.stars, sh, L.t);
  if (L.moon > 0.01) drawMoon(430 + sh.x, 150 + sh.y, 34, L.moon);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (L.sun > 0.01 && sunY < HZ + 40) {
    // sun disc
    ctx.globalAlpha = L.sun;
    const grd = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 46);
    grd.addColorStop(0, 'rgba(255,252,238,1)');
    grd.addColorStop(0.7, high > 0.5 ? 'rgba(255,248,225,1)' : 'rgba(255,226,160,1)');
    grd.addColorStop(1, high > 0.5 ? 'rgba(255,245,220,0)' : 'rgba(255,190,120,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 46, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (L.flash > 0.01) {
    ctx.fillStyle = css([190, 205, 240], 0.45 * L.flash);
    ctx.fillRect(V.x0 - 5, V.y0 - 5, V.x1 - V.x0 + 10, Math.min(V.y1, HZ) - V.y0 + 10);
  }
}

function drawStars(alpha, sh, t) {
  if (alpha <= 0.01) return;
  const { ctx, V } = S;
  const px = 1 / S.kc;
  const white = 'rgb(236,240,255)', warm = 'rgb(255,232,200)';
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass ? warm : white;
    for (const s of STARS) {
      if (s.warm !== !!pass) continue;
      const x = s.x + sh.x, y = s.y + sh.y;
      if (x < V.x0 || x > V.x1 || y < V.y0 || y > V.y1 || y > HZ - 4) continue;
      const hf = clamp((HZ - y) / 220);
      const tw = 0.62 + 0.38 * Math.sin(t * s.sp + s.ph);
      const a = alpha * hf * (0.22 + 0.78 * s.m) * tw;
      if (a < 0.02) continue;
      const sz = (0.9 + s.m * 2.1) * px;
      ctx.globalAlpha = a;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      if (s.m > 0.5) glow(S.sp.moon, x, y, (5 + 16 * s.m) * px, a * 0.45);
    }
  }
  ctx.globalAlpha = 1;
}

function drawMoon(x, y, r, a) {
  const ctx = S.ctx;
  glow(S.sp.moon, x, y, r * 11, 0.2 * a);
  glow(S.sp.moon, x, y, r * 3.6, 0.35 * a);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  g.addColorStop(0, '#fbfbff');
  g.addColorStop(1, '#dfe4f6');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(170,180,210,0.35)';
  for (const [dx, dy, rr] of [[-0.3, -0.2, 0.28], [0.25, 0.15, 0.2], [-0.05, 0.35, 0.16], [0.35, -0.3, 0.12]]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, rr * r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
}

export function drawCloud(tpl, x, y, s, top, bot, rim, rimA, rdx, rdy, alpha = 1) {
  const ctx = S.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s * 0.9);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(-tpl.w, -tpl.h * 2.2, tpl.w * 2, tpl.h * 2.2 + 1);
  ctx.clip();
  const path = new Path2D();
  for (const [cx, cy, cr] of tpl.c) {
    path.moveTo(cx + cr, cy);
    path.arc(cx, cy, cr, 0, TAU);
  }
  if (rimA > 0.01) {
    ctx.save();
    ctx.translate(-rdx, -rdy);
    ctx.fillStyle = css(rim, rimA);
    ctx.fill(path);
    ctx.restore();
  }
  const g = ctx.createLinearGradient(0, -tpl.h * 1.1, 0, 0);
  g.addColorStop(0, css(top));
  g.addColorStop(1, css(bot));
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.restore();
}

// Fair-weather clouds: list of [tpl, x, y, scale, speed, squash]
const FAIR = [
  [0, 150, 455, 1.2, 4, 0.5], [3, 760, 468, 1.5, 3, 0.4], [5, 1600, 448, 1.1, 5, 0.5],
  [2, 1150, 400, 0.8, 6, 0.45], [7, 480, 250, 0.9, 7, 0.35], [8, 1900, 300, 1.2, 5, 0.4],
];
export function drawFairClouds(L, sh, t, speedMul = 1) {
  if (L.clouds <= 0.01) return;
  for (let i = 0; i < FAIR.length; i++) {
    const [ti, x0, y, s, v, sq] = FAIR[i];
    const x = wrap(x0 + t * v * speedMul, -600, 2600) + sh.x * 0.8;
    const ctx = S.ctx;
    ctx.save();
    ctx.translate(0, y + sh.y * 0.8);
    ctx.scale(1, sq * 1.6);
    drawCloud(CLOUD_TPL[ti], x, 0, s, L.cloudTop, L.cloudBot, L.cloudRim, 0.6, L.cloudRdx, L.cloudRdy, L.clouds * (L.cloudA ?? 0.7));
    ctx.restore();
  }
}

// Overcast ceiling behind the storm clouds (kind 0, spans y -800..350) and the rain haze under the
// cloud base (kind 1, spans y 250..500); both fade toward the deck's leading (right) edge.
const DECK_FILL = new Map();
function deckFill(c, kind = 0) {
  const key = c.map((v) => v | 0).join(',') + ':' + kind;
  let spr = DECK_FILL.get(key);
  if (!spr) {
    const n = 64;
    spr = canvas(n, n);
    const g = spr.getContext('2d');
    const img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      const f = (y + 0.5) / n;
      const v = kind ? sstep(0, 0.35, f) * (1 - sstep(0.4, 1, f)) : clamp((330 - (-800 + f * 1150)) / 1030);
      for (let x = 0; x < n; x++) {
        const h = 1 - sstep(0.72, 1, (x + 0.5) / n);
        const i = (y * n + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = Math.round(255 * v * h);
      }
    }
    g.putImageData(img, 0, 0);
    if (DECK_FILL.size > 8) DECK_FILL.clear();
    DECK_FILL.set(key, spr);
  }
  return spr;
}

// Heavy storm deck sliding in from the left.
export function drawStormDeck(L, sh, t) {
  if (L.deck <= 0.01) return;
  const ctx = S.ctx;
  const off = (L.deck - 1) * 2600 + t * 14;
  const fl = L.flash;
  const top = add(L.deckTop, [150, 160, 190], fl * 0.5);
  const bot = add(L.deckBot, [120, 130, 160], fl * 0.4);
  const rim = add(L.deckRim, [200, 210, 255], fl * 0.6);
  const front = 2300 + off;
  const fx0 = -1300 + off;
  ctx.globalAlpha = 1;
  ctx.drawImage(deckFill(L.deckBot), fx0, -800, front + 300 - fx0, 1150);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 16; i++) {
      const hx = hash2(i, row * 7 + 1), hy = hash2(i, row * 7 + 2);
      const x = -900 + i * 210 + hx * 90 + off + row * 60;
      if (x > front + 100) continue;
      const y = [70, 190, 300][row] + hy * 50 + sh.y * 0.6;
      const s = [1.9, 1.6, 1.25][row] * (0.8 + 0.4 * hash2(i, row + 40));
      const shade = [0.9, 1.0, 0.85][row];
      drawCloud(CLOUD_TPL[(i + row * 3) % CLOUD_TPL.length], x + sh.x * 0.6, y, s,
        scl(top, shade), scl(bot, shade), rim, 0.55 + 0.4 * fl, 5, 7, clamp(L.deck * 1.4 - row * 0.15));
    }
  }
  // rain haze softening the flat cloud base
  ctx.globalAlpha = 0.5 * clamp(L.deck * 1.2) * (1 - 0.6 * fl);
  ctx.drawImage(deckFill(C('#191e27'), 1), fx0, 250 + sh.y * 0.6, front + 300 - fx0, 250);
  ctx.globalAlpha = 1;
}

export function drawBolt(i, x, y0, y1, w, a) {
  if (a <= 0.01) return;
  const ctx = S.ctx;
  const b = BOLTS[i % BOLTS.length];
  const h = y1 - y0;
  const trace = (pts) => {
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(x + px * w, y0 + py * h) : ctx.moveTo(x + px * w, y0 + py * h)));
  };
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [lw, al] of [[14, 0.12], [5, 0.35], [2, 1]]) {
    ctx.strokeStyle = css([210, 225, 255], a * al);
    ctx.lineWidth = lw;
    trace(b.main);
    ctx.stroke();
    ctx.lineWidth = lw * 0.6;
    for (const br of b.branches) {
      trace(br);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- sea
export function stormAt(L, x) {
  return L.storm * (1 - (L.shelter || 0) * sstep(1330, 1580, x));
}

// st: local storm (amplitude, choppiness); sp: scene-wide storm (wave speed, must not vary with x).
export function wave(x, d, t, st, sp = st) {
  const sc = Math.max(0.1, dscale(d));
  const A = sc * (3.1 + 17 * st);
  const p = 1 + 1.7 * st;
  const k = 1 / sc;
  const s1 = (Math.sin(x * 0.0105 * k - t * (0.8 + 1.0 * sp) + d * 41.3) + 1) * 0.5;
  const s2 = (Math.sin(x * 0.0219 * k - t * (1.25 + 1.3 * sp) + d * 77.1) + 1) * 0.5;
  const s3 = Math.sin(x * 0.051 * k + t * 1.9 + d * 13.7);
  return A * (Math.pow(s1, p) - 0.42 + 0.5 * (Math.pow(s2, p) - 0.42) + 0.15 * s3);
}

// Surface height at (x, depth) including storm variation.
export function surfY(L, x, d, t) {
  return seaY(d) - wave(x, d, t * (L.seaSpeed || 1), stormAt(L, x), L.storm);
}

function seaColor(L, d) {
  const c = mix(L.seaFar, L.seaNear, Math.pow(Math.min(1, d), 0.6));
  return mix(c, L.fog, L.fogAmt * Math.pow(1 - Math.min(1, d), 3) * 0.8);
}

const PTS = new Float32Array(1200);

// A glint of reflected light on a wave: Gaussian along the crest, rounded top and bottom.
const GLINT = new Map();
function glintSprite(c) {
  const key = c.join(',');
  let spr = GLINT.get(key);
  if (!spr) {
    const w = 64, h = 8;
    spr = canvas(w, h);
    const g = spr.getContext('2d');
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const vy = Math.sin((Math.PI * (y + 0.5)) / h);
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = Math.round(255 * vy * Math.exp(-((((x + 0.5) / w - 0.5) / 0.22) ** 2)));
      }
    }
    g.putImageData(img, 0, 0);
    GLINT.set(key, spr);
  }
  return spr;
}

function strip(L, d, t, x0, x1, bottom, alpha, idx) {
  const ctx = S.ctx;
  const y0 = seaY(d);
  const sc = dscale(d);
  const step = (d < 0.15 ? 30 : d < 0.4 ? 20 : 13) / Math.max(1, (S.cam ? S.cam.z : 1) * 0.8);
  const tt = t * (L.seaSpeed || 1);
  let n = 0;
  for (let x = x0; n < 1190; x += step) {
    const xx = Math.min(x, x1);
    PTS[n++] = xx;
    PTS[n++] = y0 - wave(xx, d, tt, stormAt(L, xx), L.storm);
    if (xx >= x1) break;
  }
  const base = seaColor(L, d);
  const A = sc * (3 + 17 * L.storm);
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let i = 0; i < n; i += 2) ctx.lineTo(PTS[i], PTS[i + 1]);
  ctx.lineTo(x1, bottom);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y0 - A * 1.2, 0, y0 + 16 + 70 * sc);
  g.addColorStop(0, css(mix(base, L.seaHi, 0.13 + 0.12 * L.storm), alpha));
  g.addColorStop(1, css(base, alpha));
  ctx.fillStyle = g;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(PTS[0], PTS[1]);
  for (let i = 2; i < n; i += 2) ctx.lineTo(PTS[i], PTS[i + 1]);
  ctx.strokeStyle = css(mix(base, L.seaHi, 0.55), alpha * (0.1 + 0.32 * (1 - Math.min(1, d))));
  ctx.lineWidth = 0.7 + 1.6 * sc;
  ctx.stroke();

  if (L.storm > 0.05 && idx >= 0) {
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < n; i += 2) {
      const h = y0 - PTS[i + 1];
      const st = stormAt(L, PTS[i]);
      if (st > 0.1 && h > A * 0.5 * (st / L.storm)) {
        if (!open) ctx.moveTo(PTS[i], PTS[i + 1]);
        else ctx.lineTo(PTS[i], PTS[i + 1]);
        open = true;
      } else open = false;
    }
    ctx.strokeStyle = css(mul(COL.foam, add(L.amb, [40, 40, 50])), 0.55 * L.storm * alpha);
    ctx.lineWidth = 1.5 + 3.5 * sc;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  if (idx >= 0 && L.lights && L.lights.length) {
    ctx.globalCompositeOperation = 'lighter';
    const gh = 0.8 + 1.5 * sc;
    for (const Lt of L.lights) {
      if (Lt.a < 0.01) continue;
      // a light on the water (a boat's lantern) glitters only between itself and the viewer
      const near = Lt.d === undefined ? 1 : d < Lt.d - 0.005 ? 0 : Math.exp(-(d - Lt.d) / 0.3);
      if (near < 0.02) continue;
      const spread = Lt.sp * (0.18 + 1.25 * d);
      const spr = glintSprite(Lt.c);
      const cnt = Lt.n || 9;
      for (let j = 0; j < cnt; j++) {
        const h1 = hash2(idx * 131 + j, Lt.seed || 1), h2 = hash2(idx * 57 + j, (Lt.seed || 1) + 9);
        const fl = Math.sin(t * (1.1 + 2.4 * h2) + h1 * 40);
        if (fl < 0.12) continue;
        const off = (h1 - 0.5) * 2;
        const x = Lt.x + off * spread;
        const w = (6 + 34 * h2) * sc * (1 - 0.55 * Math.abs(off)) + 1.5;
        const y = y0 - wave(x, d, tt, stormAt(L, x), L.storm) + (0.5 + h2 * 3) * sc;
        ctx.globalAlpha = clamp(Lt.a * near * fl * (1 - off * off) * (0.3 + 0.7 * Math.min(1, d * 2.6)));
        ctx.drawImage(spr, x - w * 1.1, y - gh * 0.15, w * 2.2, gh * 1.3);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  if (idx >= 0 && L.seaGlow > 0.01) {
    const V = S.V;
    const gg = ctx.createLinearGradient(V.x0, 0, V.x1, 0);
    const NS = 22;
    for (let k = 0; k <= NS; k++) {
      const x = V.x0 + ((V.x1 - V.x0) * k) / NS;
      const f = L.glowField ? L.glowField(x, d) : 1;
      const patch = 0.25 + 0.75 * Math.max(0, noise(x * 0.0045 + d * 23 + t * 0.12, 3) * 0.8 + 0.35);
      gg.addColorStop(k / NS, css([90, 255, 225], clamp(f * patch * L.seaGlow * (0.2 + 0.55 * d))));
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.moveTo(PTS[0], PTS[1]);
    for (let i = 2; i < n; i += 2) ctx.lineTo(PTS[i], PTS[i + 1]);
    ctx.strokeStyle = gg;
    ctx.lineWidth = 0.8 + 1.8 * sc;
    ctx.stroke();
    // sparkles riding the crests
    const cnt = Math.round(14 + 30 * d);
    for (let j = 0; j < cnt; j++) {
      const h1 = hash2(idx * 91 + j, 77), h2 = hash2(idx * 13 + j, 78);
      const x = V.x0 + h1 * (V.x1 - V.x0);
      const f = L.glowField ? L.glowField(x, d) : 1;
      const tw = Math.max(0, Math.sin(t * (1.5 + 3 * h2) + h1 * 50));
      const a = f * L.seaGlow * tw;
      if (a < 0.03) continue;
      const y = y0 - wave(x, d, tt, stormAt(L, x), L.storm);
      glow(S.sp.cyanCore, x, y, (3 + 6 * h2) * (0.4 + sc), a);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// Draws the layered sea from the horizon forward, calling inserts ({d, fn, cover}) at their depth.
export function drawSea(L, t, inserts = []) {
  const V = S.V;
  const list = inserts.slice().sort((a, b) => a.d - b.d);
  let ii = 0;
  const x0 = V.x0 - 30, x1 = V.x1 + 30;
  const bottom = Math.max(V.y1, SEA_B) + 30;
  const run = (ins) => {
    ins.fn();
    if (ins.cover) strip(L, ins.d, t, x0, x1, bottom, ins.cover, -1);
  };
  for (let i = 0; i < SEA_D.length; i++) {
    const d = SEA_D[i];
    while (ii < list.length && list[ii].d <= d) run(list[ii++]);
    if (seaY(d) - 60 > V.y1) continue;
    strip(L, d, t, x0, x1, bottom, 1, i);
  }
  while (ii < list.length) run(list[ii++]);
}

// Soft light path on the water under a low light source (drawn after the sea): a Gaussian
// cross-section that widens toward the viewer, laid down as thin abutting horizontal slices.
const SHEEN = new Map();
function sheenProfile(c) {
  const key = c.join(',');
  let spr = SHEEN.get(key);
  if (!spr) {
    spr = canvas(256, 1);
    const g = spr.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 256, 0);
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      grd.addColorStop(u, css(c, Math.exp(-(((u - 0.5) / 0.19) ** 2))));
    }
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 1);
    SHEEN.set(key, spr);
  }
  return spr;
}
export function drawSheen(x, c, a, w) {
  if (a <= 0.01) return;
  const ctx = S.ctx, V = S.V;
  const yb = Math.max(V.y1, SEA_B);
  const ya = Math.max(HZ + 1, V.y0), yz = Math.min(yb, V.y1 + 2);
  if (yz <= ya) return;
  const spr = sheenProfile(c);
  ctx.globalCompositeOperation = 'lighter';
  const n = 48;
  for (let i = 0; i < n; i++) {
    const y0 = ya + ((yz - ya) * i) / n, y1 = ya + ((yz - ya) * (i + 1)) / n;
    const u = ((y0 + y1) / 2 - HZ) / (yb - HZ);
    const al = a * Math.pow(1 - u, 1.5);
    if (al < 0.002) continue;
    const hw = w * (0.12 + 0.88 * u) * 1.9;
    ctx.globalAlpha = al;
    ctx.drawImage(spr, x - hw, y0, hw * 2, y1 - y0);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- island
const MAIN_TOP = [
  1022, 592, 1033, 574, 1046, 558, 1058, 548, 1070, 537, 1084, 529, 1098, 519, 1112, 513, 1126, 505, 1146, 500,
  1168, 494, 1192, 491, 1222, 487, 1250, 485, 1280, 483, 1312, 482, 1342, 483, 1370, 486, 1396, 490, 1418, 496,
  1438, 502, 1458, 511, 1476, 521, 1494, 533, 1510, 546, 1524, 559, 1537, 572, 1548, 590,
];
const BREAK_TOP = [
  1532, 602, 1541, 588, 1553, 576, 1570, 568, 1590, 570, 1606, 563, 1626, 559, 1648, 562, 1668, 567, 1690, 572,
  1712, 568, 1732, 575, 1749, 585, 1762, 602,
];
const DANGER = [
  [868, 626, 875, 607, 886, 595, 897, 588, 906, 593, 915, 582, 926, 588, 936, 598, 946, 612, 953, 628],
  [950, 624, 958, 606, 969, 591, 982, 580, 993, 586, 1002, 598, 1010, 612, 1016, 626],
  [810, 628, 818, 615, 830, 609, 842, 612, 850, 620, 856, 630],
];
const ISLAND = {};

function jag(top, amt, seed) {
  const out = top.slice();
  for (let i = 2; i < out.length - 2; i += 2) out[i + 1] += (hash2(i, seed) - 0.5) * amt;
  return out;
}
function rockPath(top, bottom) {
  const p = new Path2D();
  p.moveTo(top[0], bottom);
  for (let i = 0; i < top.length; i += 2) p.lineTo(top[i], top[i + 1]);
  p.lineTo(top[top.length - 2], bottom);
  p.closePath();
  return p;
}
function bandPath(top, x0, x1, th, seed) {
  const up = [], lo = [];
  for (let i = 0; i < top.length; i += 2) {
    const x = top[i], y = top[i + 1];
    if (x < x0 || x > x1) continue;
    up.push(x, y - 1);
    const edge = Math.min(x - x0, x1 - x) / 40;
    lo.push(x, y + th * Math.min(1, edge) * (0.7 + 0.6 * hash2(i, seed)));
  }
  const p = new Path2D();
  p.moveTo(up[0], up[1]);
  for (let i = 2; i < up.length; i += 2) p.lineTo(up[i], up[i + 1]);
  for (let i = lo.length - 2; i >= 0; i -= 2) p.lineTo(lo[i], lo[i + 1]);
  p.closePath();
  return { p, up };
}

function buildIsland() {
  const main = jag(MAIN_TOP, 5, 3);
  ISLAND.main = rockPath(main, 620);
  ISLAND.mainTop = main;
  ISLAND.grass = bandPath(main, 1080, 1478, 13, 5);
  ISLAND.brk = rockPath(jag(BREAK_TOP, 4, 7), 625);
  ISLAND.danger = DANGER.map((d, i) => rockPath(jag(d, 3, 11 + i), 640));
  // boulders at the islet front
  ISLAND.boulders = [
    [1098, 566, 30, 20], [1136, 572, 22, 15], [1478, 562, 26, 18], [1512, 574, 18, 13],
  ].map(([x, y, rx, ry]) => {
    const p = new Path2D();
    p.ellipse(x, y, rx, ry, 0, Math.PI, TAU);
    p.lineTo(x + rx, y + ry * 0.6);
    p.lineTo(x - rx, y + ry * 0.6);
    p.closePath();
    return p;
  });
  // grass tufts
  ISLAND.tufts = [];
  const r = rng(17);
  for (let i = 0; i < 70; i++) {
    const x = 1086 + r() * 386;
    ISLAND.tufts.push({ x, h: 5 + r() * 9, ph: r() * TAU, w: 2 + r() * 3 });
  }
}

function topYAt(top, x) {
  for (let i = 2; i < top.length; i += 2) {
    if (top[i] >= x) {
      const f = (x - top[i - 2]) / (top[i] - top[i - 2]);
      return lerp(top[i - 1], top[i + 1], f);
    }
  }
  return top[top.length - 1];
}

// Rim offsets are in world units; dividing by zoom keeps a highlight's on-screen width steady in close-ups.
const rimK = () => 1 / Math.pow(S.cam ? S.cam.z : 1, 0.8);

export function drawRock(path, L, x0, x1, y0, y1, light = 1) {
  const ctx = S.ctx;
  const base = mul(COL.rock, L.amb);
  let lit = add(mul(COL.rockL, L.amb), L.rim, 0.22 * light);
  const sn = L.snow || 0;
  if (sn > 0) lit = mix(lit, add(mul(COL.snow, L.amb), L.rim, 0.15), sn);
  // two-step top light: a thin bright edge falling off through a half-tone band
  const k = rimK();
  ctx.save();
  ctx.fillStyle = css(lit);
  ctx.fill(path);
  ctx.clip(path);
  ctx.translate((0.5 + 7 * sn) * k, (1.4 + 9 * sn) * k);
  ctx.fillStyle = css(mix(base, lit, 0.38));
  ctx.fill(path);
  ctx.translate((1.3 + 1.5 * sn) * k, (2.6 + 3 * sn) * k);
  ctx.fillStyle = css(base);
  ctx.fill(path);
  ctx.restore();
  ctx.save();
  ctx.clip(path);
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 5, y0 - 5, x1 - x0 + 10, y1 - y0 + 10);
  ctx.restore();
}

export function drawIslet(L, t) {
  const ctx = S.ctx;
  drawRock(ISLAND.main, L, 1022, 1548, 470, 620);
  // cracks
  ctx.strokeStyle = css(scl(mul(COL.rock, L.amb), 0.6), 0.8);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [[1070, 545, 12, 30], [1160, 515, 6, 40], [1420, 510, -8, 36], [1500, 545, 10, 28], [1240, 500, 4, 30], [1350, 498, -5, 36]]) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * 0.5, y + dy * 0.5);
    ctx.lineTo(x + dx, y + dy);
  }
  ctx.stroke();
  // grass / snow cap
  const sn = L.snow || 0;
  const grass = mix(mul(L.grass, L.amb), add(mul(COL.snow, L.amb), L.rim, 0.12), sn);
  rimFill(ctx, ISLAND.grass.p, css(grass), css(add(grass, L.rim, 0.18)), 0, 3 * rimK());
  if (sn < 0.9) {
    ctx.strokeStyle = css(add(grass, L.rim, 0.1), 1 - sn);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const wind = L.wind || 0;
    for (const tf of ISLAND.tufts) {
      const y = topYAt(ISLAND.mainTop, tf.x) + 1;
      const sw = Math.sin(t * (2 + 3 * L.storm) + tf.ph) * (1.5 + 5 * L.storm) + wind * (3 + 6 * L.storm);
      ctx.moveTo(tf.x - tf.w, y);
      ctx.quadraticCurveTo(tf.x + sw * 0.3, y - tf.h * 0.6, tf.x + sw, y - tf.h);
      ctx.moveTo(tf.x + tf.w, y);
      ctx.quadraticCurveTo(tf.x + sw * 0.4 + 2, y - tf.h * 0.5, tf.x + sw + 3, y - tf.h * 0.8);
    }
    ctx.stroke();
  }
  drawLighthouse(L, t);
  drawCottage(L, t);
}

export function drawBreakwater(L, t) {
  drawRock(ISLAND.brk, L, 1532, 1762, 555, 625);
}

export function drawDanger(L, t) {
  const ctx = S.ctx;
  const b = [[868, 953], [950, 1016], [810, 856]];
  ISLAND.danger.forEach((p, i) => drawRock(p, L, b[i][0], b[i][1], 575, 640));
  const rg = L.rockGlow || 0;
  if (rg > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = css([100, 255, 225], 0.3 * rg);
    ctx.lineWidth = 1.2;
    ISLAND.danger.forEach((p) => ctx.stroke(p));
    const dw = frontD(0.372);
    for (let x = 815; x < 1012; x += 12) {
      glow(S.sp.cyan, x, surfY(L, x, dw, t), 24, 0.3 * rg * (0.6 + 0.4 * Math.sin(t * 3 + x)));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// A rock standing at depth d disappears behind the next sea strip, so that strip's surface is its waterline.
export const frontD = (d) => SEA_D.find((s) => s > d + 1e-6) ?? d;

// Waterline foam for the islet, the breakwater and the reef, drawn just after the strip that cuts each one.
const SHORES = [[1030, 1545, 0.262, 3], [1535, 1760, 0.3, 5], [815, 1012, 0.372, 9]];
export function shoreInserts(L, t) {
  return SHORES.map(([x0, x1, d, seed]) => {
    const dw = frontD(d);
    return { d: dw + 1e-4, fn: () => drawFoamLine(L, t, x0, x1, dw, seed) };
  });
}

function drawFoamLine(L, t, x0, x1, d, seed) {
  const ctx = S.ctx;
  const foam = mul(COL.foam, add(L.amb, [50, 50, 60]));
  // thin lapping line at the waterline
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 4) {
    const y = surfY(L, x, d, t) - 0.5 + Math.sin(x * 0.3 + t * 2) * 0.4;
    x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = css(foam, 0.22 + 0.3 * L.storm);
  ctx.lineWidth = 1.2 + 1.5 * L.storm;
  ctx.stroke();
  // foam clumps, mostly when the sea is rough
  const a = 0.12 + 0.6 * L.storm;
  ctx.fillStyle = css(foam, a);
  ctx.beginPath();
  for (let x = x0; x < x1; x += 9) {
    const h = hash2(Math.round(x), seed);
    const ph = Math.sin(t * (1.1 + h) + h * 30);
    if (ph < 0.25 - 0.5 * L.storm) continue;
    const y = surfY(L, x, d, t) - 1;
    const w = (2 + 7 * h) * (0.5 + 0.5 * ph) * (1 + 1.4 * L.storm);
    ctx.moveTo(x + w, y);
    ctx.ellipse(x, y, w, 0.9 + 1.8 * L.storm, 0, 0, TAU);
  }
  ctx.fill();
}

function drawLighthouse(L, t) {
  const ctx = S.ctx;
  const X = LH.x, B = LH.base, G = LH.gallery;
  const amb = L.amb;
  const white = mul(COL.tower, amb), red = mul(COL.red, amb);
  const lit = (c) => add(c, L.rim, 0.28);
  const shadow = (c) => scl(c, 0.55);
  const hgrad = (c) => {
    const g = ctx.createLinearGradient(X - 40, 0, X + 40, 0);
    g.addColorStop(0, css(lit(c)));
    g.addColorStop(0.32, css(c));
    g.addColorStop(0.75, css(scl(c, 0.75)));
    g.addColorStop(1, css(shadow(c)));
    return g;
  };
  const tower = new Path2D();
  tower.moveTo(X - 39, B + 4);
  tower.lineTo(X - 24, G + 2);
  tower.lineTo(X + 24, G + 2);
  tower.lineTo(X + 39, B + 4);
  tower.closePath();
  ctx.fillStyle = hgrad(white);
  ctx.fill(tower);
  ctx.save();
  ctx.clip(tower);
  ctx.fillStyle = hgrad(red);
  ctx.fillRect(X - 45, 288, 90, 36);
  ctx.fillRect(X - 45, 392, 90, 36);
  // windows
  const win = L.win || [0, 0, 0];
  [[430, 0], [350, 1], [262, 2]].forEach(([y, i]) => {
    ctx.fillStyle = css(mix(mul(C('#1d2330'), amb), COL.lamp, win[i]));
    ctx.fillRect(X - 3.5, y, 7, 13);
  });
  ctx.restore();
  // door
  ctx.fillStyle = css(mul(COL.door, amb));
  ctx.beginPath();
  ctx.moveTo(X - 8, B + 2);
  ctx.lineTo(X - 8, B - 20);
  ctx.arc(X, B - 20, 8, Math.PI, 0);
  ctx.lineTo(X + 8, B + 2);
  ctx.fill();
  // gallery
  const iron = mul(COL.iron, amb);
  ctx.fillStyle = css(add(iron, L.rim, 0.12));
  ctx.fillRect(X - 36, G - 6, 72, 8);
  ctx.strokeStyle = css(add(iron, L.rim, 0.15));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(X - 35, G - 20);
  ctx.lineTo(X + 35, G - 20);
  for (let i = -35; i <= 35; i += 7) {
    ctx.moveTo(X + i, G - 20);
    ctx.lineTo(X + i, G - 6);
  }
  ctx.stroke();
  // lantern room
  const lampOn = L.lamp || 0;
  const glassOff = mix(mul(C('#223044'), amb), [30, 60, 70], 0);
  const gl = ctx.createLinearGradient(X - 21, 0, X + 21, 0);
  const cGlass = mix(glassOff, COL.lamp, lampOn * 0.85);
  const lg = L.lanternGlow || 0;
  const cGlass2 = mix(cGlass, [150, 255, 235], lg * 0.8);
  gl.addColorStop(0, css(add(cGlass2, L.rim, 0.15)));
  gl.addColorStop(0.5, css(add(cGlass2, [40, 30, 10], lampOn * 0.5)));
  gl.addColorStop(1, css(scl(cGlass2, 0.8)));
  ctx.fillStyle = gl;
  ctx.fillRect(X - 21, 162, 42, G - 6 - 162);
  ctx.strokeStyle = css(iron);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const dx of [-21, -8, 8, 21]) {
    ctx.moveTo(X + dx, 162);
    ctx.lineTo(X + dx, G - 6);
  }
  ctx.moveTo(X - 21, 196);
  ctx.lineTo(X + 21, 196);
  ctx.stroke();
  // roof dome
  const roof = mul(COL.roof, amb);
  ctx.fillStyle = hgrad(roof);
  ctx.beginPath();
  ctx.moveTo(X - 27, 164);
  ctx.quadraticCurveTo(X - 24, 140, X, 136);
  ctx.quadraticCurveTo(X + 24, 140, X + 27, 164);
  ctx.closePath();
  ctx.fill();
  if ((L.snow || 0) > 0) {
    ctx.fillStyle = css(add(mul(COL.snow, amb), L.rim, 0.15), L.snow);
    ctx.beginPath();
    ctx.moveTo(X - 22, 152);
    ctx.quadraticCurveTo(X - 18, 139, X, 136);
    ctx.quadraticCurveTo(X + 16, 139, X + 20, 150);
    ctx.quadraticCurveTo(X, 146, X - 22, 152);
    ctx.fill();
    ctx.fillRect(X - 36, G - 8, 72, 3);
  }
  ctx.fillStyle = css(iron);
  ctx.beginPath();
  ctx.arc(X, 133, 4.5, 0, TAU);
  ctx.fill();
  ctx.fillRect(X - 1, 112, 2, 20);
  ctx.beginPath();
  ctx.moveTo(X + 1, 114);
  ctx.lineTo(X + 14, 117);
  ctx.lineTo(X + 1, 121);
  ctx.fill();
  // cyan under-light from the glowing sea
  const tg = L.towerGlow || 0;
  if (tg > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.clip(tower);
    const ug = ctx.createLinearGradient(0, B, 0, G);
    ug.addColorStop(0, css([60, 200, 190], 0.55 * tg));
    ug.addColorStop(1, css([60, 200, 190], 0.05 * tg));
    ctx.fillStyle = ug;
    ctx.fillRect(X - 40, G, 80, B - G + 5);
    ctx.restore();
  }
}

function drawCottage(L, t) {
  const ctx = S.ctx;
  const amb = L.amb;
  const wall = mul(COL.wall, amb);
  const g = ctx.createLinearGradient(1176, 0, 1272, 0);
  g.addColorStop(0, css(add(wall, L.rim, 0.25)));
  g.addColorStop(0.4, css(wall));
  g.addColorStop(1, css(scl(wall, 0.62)));
  ctx.fillStyle = g;
  ctx.fillRect(1176, 452, 94, 40);
  // roof
  const roof = mul(COL.cotRoof, amb);
  ctx.fillStyle = css(add(roof, L.rim, 0.1));
  ctx.beginPath();
  ctx.moveTo(1168, 455);
  ctx.lineTo(1223, 419);
  ctx.lineTo(1278, 455);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(scl(roof, 0.7));
  ctx.beginPath();
  ctx.moveTo(1223, 419);
  ctx.lineTo(1278, 455);
  ctx.lineTo(1264, 455);
  ctx.lineTo(1223, 427);
  ctx.closePath();
  ctx.fill();
  if ((L.snow || 0) > 0) {
    ctx.fillStyle = css(add(mul(COL.snow, amb), L.rim, 0.15), L.snow);
    ctx.beginPath();
    ctx.moveTo(1166, 456);
    ctx.lineTo(1223, 417);
    ctx.lineTo(1280, 456);
    ctx.lineTo(1272, 452);
    ctx.lineTo(1223, 424);
    ctx.lineTo(1175, 457);
    ctx.closePath();
    ctx.fill();
  }
  // chimney
  ctx.fillStyle = css(scl(mul(COL.rock, amb), 0.9));
  ctx.fillRect(1242, 420, 11, 20);
  // window
  const w = L.window || 0;
  ctx.fillStyle = css(mix(mul(C('#1a212e'), amb), [255, 200, 120], w));
  ctx.fillRect(1188, 462, 20, 16);
  ctx.strokeStyle = css(mul(C('#4a3a30'), amb));
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1188, 462, 20, 16);
  ctx.beginPath();
  ctx.moveTo(1198, 462);
  ctx.lineTo(1198, 478);
  ctx.moveTo(1188, 470);
  ctx.lineTo(1208, 470);
  ctx.stroke();
  ctx.fillStyle = css(mul(COL.door, amb));
  ctx.fillRect(1222, 465, 15, 27);
  // chimney smoke
  const sm = L.smoke || 0;
  if (sm > 0.01) {
    for (let i = 0; i < 8; i++) {
      const age = fract(t * 0.16 + i / 8);
      const x = 1247 + age * (30 + 60 * (L.wind || 0.3)) + Math.sin(age * 6 + i) * 5;
      const y = 418 - age * 80;
      const r = 4 + age * 16;
      ctx.fillStyle = css(mix(mul(C('#c4c6cf'), amb), L.skyMid, age * 0.6), sm * 0.3 * (1 - age));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }
}

// Lamp glow + rotating beams (additive). th: rotation angle; I: intensity multiplier.
export function drawBeam(L, t) {
  const lamp = L.lamp || 0;
  const ctx = S.ctx;
  const X = LH.x, Y = LH.lampY;
  ctx.globalCompositeOperation = 'lighter';
  if (lamp > 0.01) {
    const I = lamp * (L.beamI || 1);
    if (L.steady) {
      const [tx, ty] = L.steady;
      const dx = tx - X, dy = ty - Y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;
      const w1 = 70;
      const g = ctx.createLinearGradient(X, Y, tx, ty);
      g.addColorStop(0, css(COL.beam, 0.55 * I));
      g.addColorStop(0.7, css(COL.beam, 0.22 * I));
      g.addColorStop(1, css(COL.beam, 0.12 * I));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(X + nx * 4, Y + ny * 4);
      ctx.lineTo(tx + nx * w1, ty + ny * w1 * 0.4);
      ctx.lineTo(tx - nx * w1, ty - ny * w1 * 0.4);
      ctx.lineTo(X - nx * 4, Y - ny * 4);
      ctx.closePath();
      ctx.fill();
      glowE(S.sp.warm, tx, ty + 4, 190, 42, 0.75 * I);
      glowE(S.sp.warmCore, tx, ty + 2, 90, 14, 0.6 * I);
    } else {
      const th = L.beamTh || 0;
      for (const off of [0, Math.PI]) {
        const a = th + off;
        const sx = Math.sin(a), cz = Math.cos(a);
        const len = 2000 * Math.pow(Math.abs(sx), 0.7);
        if (len < 40) continue;
        const dir = Math.sign(sx);
        const w1 = 50 + 190 * (1 - Math.abs(sx));
        const al = I * (cz > 0 ? 0.36 : 0.16) * (0.45 + 0.55 * Math.abs(sx)) * (L.beamHaze || 1);
        const g = ctx.createLinearGradient(X, 0, X + dir * len, 0);
        g.addColorStop(0, css(COL.beam, al));
        g.addColorStop(0.3, css(COL.beam, al * 0.45));
        g.addColorStop(1, css(COL.beam, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(X, Y - 5);
        ctx.lineTo(X + dir * len, Y - w1 + 40);
        ctx.lineTo(X + dir * len, Y + w1 + 40);
        ctx.lineTo(X, Y + 5);
        ctx.closePath();
        ctx.fill();
        // brighter core, fading out by its own tip
        const gc = ctx.createLinearGradient(X, 0, X + dir * len * 0.6, 0);
        gc.addColorStop(0, css(COL.beam, al));
        gc.addColorStop(0.5, css(COL.beam, al * 0.45));
        gc.addColorStop(1, css(COL.beam, 0));
        ctx.fillStyle = gc;
        ctx.beginPath();
        ctx.moveTo(X, Y - 2);
        ctx.lineTo(X + dir * len * 0.6, Y - w1 * 0.25 + 22);
        ctx.lineTo(X + dir * len * 0.6, Y + w1 * 0.25 + 22);
        ctx.lineTo(X, Y + 2);
        ctx.closePath();
        ctx.fill();
      }
      const facing = Math.pow(Math.abs(Math.cos(th)), 16);
      glow(S.sp.warm, X, Y, 330, 0.75 * facing * I);
      glowE(S.sp.warmCore, X, Y, 620, 7, 0.7 * facing * I);
    }
    glow(S.sp.warm, X, Y, 80 + 30 * lamp, 0.85 * I);
    glow(S.sp.warmCore, X, Y, 26, 0.95 * I);
  }
  const lg = L.lanternGlow || 0;
  if (lg > 0.01) {
    glow(S.sp.cyan, X, Y, 150, 0.6 * lg);
    glow(S.sp.cyanCore, X, Y, 36, 0.8 * lg);
  }
  const w = L.window || 0;
  if (w > 0.01) glow(S.sp.warm, 1198, 470, 34, 0.5 * w);
  const win = L.win || [0, 0, 0];
  [[436, 0], [356, 1], [268, 2]].forEach(([y, i]) => glow(S.sp.warm, X, y, 22, 0.6 * win[i]));
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- weather
export function drawRain(amount, t, wind, color, alphaMul = 1) {
  if (amount < 0.01) return;
  const ctx = S.ctx, V = S.V;
  const w = V.x1 - V.x0 + 200, h = V.y1 - V.y0;
  const layers = [
    [0.45, 1100, 20, 1.0, 320],
    [0.75, 1500, 32, 1.4, 220],
    [1.0, 2100, 50, 2.0, 110],
  ];
  ctx.lineCap = 'round';
  for (let li = 0; li < 3; li++) {
    const [am, sp, len, lw, cnt] = layers[li];
    const n = Math.floor(cnt * amount * (w / 2100));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const hx = hash2(i, li * 31 + 1), hy = hash2(i, li * 31 + 2);
      const y = V.y0 - len + wrap(hy * (h + len * 2) + t * sp * (0.9 + 0.2 * hx), 0, h + len * 2);
      const x = V.x0 - 100 + wrap(hx * w + t * sp * wind * 0.9, 0, w);
      ctx.moveTo(x, y);
      ctx.lineTo(x - wind * len, y - len);
    }
    ctx.strokeStyle = css(color, 0.2 * am * alphaMul);
    ctx.lineWidth = lw / (S.kc || 1) * 0.8;
    ctx.stroke();
  }
}

export function drawSnow(amount, t, wind = 0.2) {
  if (amount < 0.01) return;
  const ctx = S.ctx, V = S.V;
  const w = V.x1 - V.x0 + 100, h = V.y1 - V.y0 + 40;
  for (let li = 0; li < 3; li++) {
    const n = Math.floor([160, 110, 50][li] * amount * (w / 2000));
    const sp = [40, 70, 110][li];
    const r = [1.6, 2.6, 4.2][li];
    ctx.fillStyle = css([240, 244, 255], [0.45, 0.7, 0.85][li]);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const hx = hash2(i, li * 17 + 5), hy = hash2(i, li * 17 + 6);
      const y = V.y0 - 20 + wrap(hy * h + t * sp, 0, h);
      const x = V.x0 - 50 + wrap(hx * w + t * sp * wind + Math.sin(t * 0.8 + hx * 20) * 18, 0, w);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r * (0.7 + 0.5 * hx), 0, TAU);
    }
    ctx.fill();
  }
}

// Drifting fog banks near the sea surface.
export function drawFogBanks(amount, t, col, yc = HZ + 40, spread = 120) {
  if (amount <= 0.01) return;
  const ctx = S.ctx;
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 14; i++) {
    const h1 = hash2(i, 91), h2 = hash2(i, 92);
    const x = wrap(h1 * 3000 + t * (8 + 14 * h2), -600, 2600);
    const y = yc + (h2 - 0.5) * spread * 2;
    const rx = 420 + 380 * h2, ry = 50 + 50 * h1;
    ctx.globalAlpha = clamp(amount * (0.35 + 0.4 * h2));
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, css(col, 0.55));
    g.addColorStop(0.6, css(col, 0.2));
    g.addColorStop(1, css(col, 0));
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function veil(col, a) {
  if (a <= 0.005) return;
  const ctx = S.ctx, V = S.V;
  ctx.fillStyle = css(col, a);
  ctx.fillRect(V.x0 - 5, V.y0 - 5, V.x1 - V.x0 + 10, V.y1 - V.y0 + 10);
}

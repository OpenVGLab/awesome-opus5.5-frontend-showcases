// The six shots of the montage. Every function is a pure function of time, so any frame can be scrubbed to.
import { W, H, TAU, DURATION, clamp, lerp, seg, hop, bump, E, kf, hash, vnoise, fbm, rng, mix, mixHex, rgba, roundRect, FONT_SERIF, FONT_SANS, FONT_MONO, FONT_CJK } from './util.js';
import {
  layer, sky, glow, sun, makeRange, drawRange, mist, birds, pagoda, pine, bamboo, petalField,
  wipePath, wipeInk, speedLines, burst, ring, twinkle, spark, seal, lantern, makePagodaMesh, project, drawMeshSolid, drawMeshWire,
} from './art.js';
import { drawClawd, ORANGE } from './clawd.js';

const blinkAt = (t, times, d = 0.14) => times.reduce((b, tb) => Math.max(b, bump(t, tb, tb + d)), 0);
const worldToScreen = (cam, x, y) => [W / 2 + (x - cam.x) * cam.zoom + (cam.sx || 0), H / 2 + (y - cam.y) * cam.zoom + (cam.sy || 0)];
// Screen position of a point drawn inside layer(ctx, cam, depth, ...).
function layerToScreen(cam, d, x, y) {
  const z = 1 + (cam.zoom - 1) * d;
  const cx = lerp(W / 2, cam.x, d), cy = lerp(H / 2, cam.y, d);
  return [W / 2 + (cam.sx || 0) * d + (x - cx) * z, H / 2 + (cam.sy || 0) * d + (y - cy) * z];
}

function flash(ctx, lt, t0, dur = 0.24, color = '#FFF8EC', peak = 0.9) {
  const a = lt >= t0 ? peak * (1 - seg(lt, t0, t0 + dur)) : 0;
  if (a > 0) {
    ctx.fillStyle = rgba(color, a);
    ctx.fillRect(0, 0, W, H);
  }
}

function shake(lt, amp, speed = 38, seed = 0) {
  return { sx: vnoise(lt * speed, seed) * amp, sy: vnoise(lt * speed, seed + 11) * amp };
}

// ======================================================= 1. DAY ONE (0 - 2.5 s)
const INTRO = {
  far: makeRange(11, { base: 700, hMin: 150, hMax: 330, wMin: 60, wMax: 150, count: 16, rough: 10 }),
  mid: makeRange(12, { base: 860, hMin: 110, hMax: 250, wMin: 70, wMax: 170, count: 11, rough: 10 }),
  main: makeRange(13, {
    x0: 820, x1: 1680, base: 1060, hMin: 0, hMax: 0, wMin: 1, wMax: 2, count: 0, rough: 12, step: 4,
    extra: [{ c: 1240, h: 800, w: 330, p: 0.3 }, { c: 1480, h: 470, w: 170, p: 0.36 }, { c: 1000, h: 360, w: 150, p: 0.42 }],
  }),
  stairs: [[835, 1000], [905, 985], [975, 968], [1040, 950], [1110, 928], [1000, 880], [1170, 830], [1050, 770], [1220, 712], [1095, 645],
    [1265, 575], [1150, 505], [1285, 432], [1180, 362], [1250, 300], [1240, 266]],
};

function drawStairs(ctx, pts, lt) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = 'rgba(34,30,26,0.6)';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(222,211,190,0.55)';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(34,30,26,0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(L / 8);
    const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
    for (let k = 1; k < n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      ctx.moveTo(x - nx * 4.5, y - ny * 4.5);
      ctx.lineTo(x + nx * 4.5, y + ny * 4.5);
    }
  }
  ctx.stroke();
  for (let i = 5; i < pts.length - 1; i += 2) {
    const [x, y] = pts[i];
    glow(ctx, x, y - 7, 20, '#FFB066', 0.55 + 0.2 * Math.sin(lt * 3 + i));
    ctx.fillStyle = '#E0673C';
    ctx.fillRect(x - 2.5, y - 11, 5, 6);
  }
}

function introGround(ctx) {
  ctx.beginPath();
  ctx.moveTo(-300, 1250);
  for (let x = -300; x <= 2250; x += 16) {
    const flat = clamp(Math.abs(x - 860) / 260);
    ctx.lineTo(x, 1002 + (Math.sin(x * 0.004) * 12 + fbm(x * 0.02, 4) * 16 - 6) * flat);
  }
  ctx.lineTo(2250, 1250);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 985, 0, 1110);
  g.addColorStop(0, '#5C554C');
  g.addColorStop(1, '#2C2824');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,36,30,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 38; i++) {
    const x = hash(i * 3.1) * 2200 - 150;
    if (Math.abs(x - 860) < 90) continue;
    const y = 1004 + hash(i * 1.7) * 20;
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(x + k * 3, y);
      ctx.lineTo(x + k * 5 + 2, y - 10 - hash(i + k) * 10);
    }
  }
  ctx.stroke();
}

function introPose(lt) {
  const h1 = seg(lt, 1.78, 2.06), h2 = seg(lt, 2.1, 2.38);
  let x = 820, y = 1001, lift = 0;
  if (lt >= 1.78) { x = lerp(820, 866, E.io2(h1)); y = lerp(1001, 988, h1); lift = hop(h1) * 22; }
  if (lt >= 2.1) { x = lerp(866, 912, E.io2(h2)); y = lerp(988, 974, h2); lift = hop(h2) * 22; }
  const sq = (1 + Math.sin(lt * 4) * 0.02) * (1 - 0.14 * bump(lt, 1.3, 1.5) - 0.16 * bump(lt, 1.6, 1.8) - 0.12 * bump(lt, 2.02, 2.12) + 0.1 * bump(lt, 1.8, 1.95) + 0.1 * bump(lt, 2.12, 2.26));
  const det = lt > 1.35;
  return {
    x, y, s: 8, lift, sq, fid: 0, t: lt, lookX: 0.55, lookY: -1, mood: det ? 'determined' : 'normal',
    blink: blinkAt(lt, [0.62, 0.98]), armL: [det ? 0.45 : 0, 1], armR: [det ? 0.45 : 0, 1], legs: { tuck: lift > 4 ? 0.5 : 0 },
  };
}

function drawIntro(ctx, lt) {
  const u = E.io3(seg(lt, 0, 2.35));
  const cam = { x: lerp(830, 960, u), y: lerp(855, 540, u), zoom: lerp(2.4, 1, u) };
  sky(ctx, [[0, '#E2D6BF'], [0.5, '#EEE5D2'], [1, '#F3ECDF']]);
  layer(ctx, cam, 0.06, () => {
    sun(ctx, 1450, 330, 62, 'rgba(219,108,80,0.9)', '#F2B894', 280, 0.35);
    birds(ctx, lt, 540, 240, 4, 'rgba(60,52,44,0.55)', 3, 28);
  });
  layer(ctx, cam, 0.2, () => {
    drawRange(ctx, INTRO.far, 'rgba(172,164,148,0.85)', 'rgba(239,231,216,0)');
    mist(ctx, 690, 70, '#F4EEE2', 0.8, lt, 14, 2);
  });
  layer(ctx, cam, 0.45, () => {
    drawRange(ctx, INTRO.mid, 'rgba(124,116,102,0.9)', 'rgba(236,228,212,0)');
    mist(ctx, 850, 80, '#F4EEE2', 0.85, lt, 18, 3);
  });
  layer(ctx, cam, 1, () => {
    drawRange(ctx, INTRO.main, '#4B4640', '#D9D0BF', 1120);
    pagoda(ctx, 1240, 268, 0.55, '#2C2825', { lit: 0.85 });
    glow(ctx, 1240, 225, 70, '#FFC37A', 0.25);
    mist(ctx, 990, 46, '#F1EADC', 0.65, lt, 22, 5);
    introGround(ctx);
    drawStairs(ctx, INTRO.stairs, lt);
    drawClawd(ctx, introPose(lt));
  });
  layer(ctx, cam, 1.3, () => {
    pine(ctx, 70, 1150, 1.3, '#26221F', 5, lt);
  });
}

// ======================================================= 2. SEARCHING THE INTERNET (2.5 - 7.5 s)
const SEARCH = {
  far: makeRange(21, { base: 560, hMin: 110, hMax: 250, wMin: 60, wMax: 140, count: 16, rough: 8 }),
  canopy: (() => {
    const R = rng(77), blobs = [];
    for (let i = 0; i < 80; i++) {
      const x = -80 + R() * 860;
      const spread = 1 - Math.min(1, Math.abs(x - 380) / 520);
      blobs.push({ x, y: 70 + R() * 360 * (0.35 + 0.65 * spread), r: 36 + R() * 62, c: Math.floor(R() * 4), ph: R() * TAU });
    }
    return blobs.sort((a, b) => a.c - b.c);
  })(),
  fall: Array.from({ length: 9 }, (_, i) => ({
    x0: 60 + hash(i * 3.3 + 1) * 820, y0: 150 + hash(i * 5.1 + 2) * 230, t0: hash(i * 7.7 + 3) * 1.1 - 0.35,
    v: 150 + hash(i * 2.2) * 110, sway: 30 + hash(i * 9.9) * 40, ph: hash(i * 4.4) * TAU, land: 880 + hash(i * 6.6) * 150, variant: i,
  })),
};
const PAGE_BAR = ['#6A9BCC', '#788C5D', '#D97757', '#B0AEA5', '#C9A15A'];
const CATCH = [0, 1, 2, 3, 4].map((k) => 2.5 + k * 0.3125);
const ANSWER_IDX = [1, 4, 7, 10, 13];
const CITE_LINE = [0, 2, 3, 5, 7];
const LINE_W = [340, 360, 300, 350, 330, 280, 355, 240];
const CARD = { x: 1390, y: 250, w: 430, h: 440 };

function drawPage(ctx, x, y, rot, s, variant, hl = 0, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.globalAlpha *= alpha;
  const w = 96, h = 70;
  if (hl > 0) glow(ctx, 0, 0, 100, '#FFB36B', 0.55 * hl);
  ctx.fillStyle = 'rgba(40,30,20,0.14)';
  roundRect(ctx, -w / 2 + 4, -h / 2 + 5, w, h, 7);
  ctx.fill();
  ctx.fillStyle = '#FFFDF7';
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  ctx.save();
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.clip();
  ctx.fillStyle = PAGE_BAR[variant % PAGE_BAR.length];
  ctx.fillRect(-w / 2, -h / 2, w, 13);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(-w / 2 + 9 + k * 8, -h / 2 + 6.5, 2.4, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#4A433C';
  ctx.fillRect(-w / 2 + 9, -h / 2 + 21, 46 + (variant % 3) * 10, 6);
  ctx.fillStyle = 'rgba(90,82,74,0.45)';
  for (let k = 0; k < 4; k++) ctx.fillRect(-w / 2 + 9, -h / 2 + 34 + k * 8, (variant % 2 ? 50 : 76) - k * 6, 3.5);
  if (variant % 2) {
    ctx.fillStyle = rgba(PAGE_BAR[(variant + 2) % PAGE_BAR.length], 0.55);
    ctx.fillRect(w / 2 - 34, -h / 2 + 32, 25, 25);
  }
  if (hl > 0) {
    ctx.strokeStyle = rgba('#E8763F', hl);
    ctx.lineWidth = 3.5;
    roundRect(ctx, -w / 2, -h / 2, w, h, 7);
    ctx.stroke();
  }
  ctx.restore();
}

function courtyardWall(ctx, win) {
  const top = 450, bot = 650;
  ctx.beginPath();
  ctx.rect(-500, top, W + 1000, bot - top);
  ctx.moveTo(1230 + 108, 540);
  ctx.arc(1230, 540, 108, 0, TAU);
  ctx.fillStyle = win ? '#EEE3CE' : '#E5DDCB';
  ctx.fill('evenodd');
  ctx.strokeStyle = '#8B8276';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(1230, 540, 112, 0, TAU);
  ctx.stroke();
  const g = ctx.createLinearGradient(0, bot - 60, 0, bot);
  g.addColorStop(0, 'rgba(120,108,92,0)');
  g.addColorStop(1, 'rgba(120,108,92,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(-500, bot - 60, W + 1000, 60);
  ctx.fillStyle = '#4A4742';
  ctx.fillRect(-500, top - 34, W + 1000, 32);
  ctx.beginPath();
  for (let x = -500; x < W + 500; x += 26) {
    ctx.moveTo(x, top - 3);
    ctx.arc(x + 13, top - 3, 13, Math.PI, 0, true);
  }
  ctx.fill();
  ctx.fillStyle = '#34312D';
  ctx.fillRect(-500, top - 44, W + 1000, 12);
}

function courtyardFloor(ctx, win) {
  const y0 = 648, yb = H + 220, vx = 960, vy = 380;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, win ? '#D5CEBF' : '#CEC8BA');
  g.addColorStop(1, win ? '#B8AE9B' : '#B5AE9F');
  ctx.fillStyle = g;
  ctx.fillRect(-500, y0, W + 1000, yb - y0);
  ctx.strokeStyle = 'rgba(115,105,90,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const k0 = (y0 - vy) / (yb - vy);
  for (let i = -16; i <= 16; i++) {
    const xb = 960 + i * 190;
    ctx.moveTo(vx + (xb - vx) * k0, y0);
    ctx.lineTo(xb, yb);
  }
  for (let k = 1; k < 12; k++) {
    const y = y0 + (yb - y0) * Math.pow(k / 12, 1.8);
    ctx.moveTo(-500, y);
    ctx.lineTo(W + 500, y);
  }
  ctx.stroke();
}

function tree(ctx, lt, win) {
  ctx.fillStyle = '#3B322B';
  ctx.beginPath();
  ctx.moveTo(200, 1120);
  ctx.bezierCurveTo(260, 900, 360, 760, 330, 560);
  ctx.bezierCurveTo(322, 470, 360, 420, 400, 380);
  ctx.lineTo(432, 402);
  ctx.bezierCurveTo(392, 462, 382, 522, 402, 600);
  ctx.bezierCurveTo(432, 760, 380, 900, 372, 1120);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3B322B';
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1, w] of [[380, 470, 610, 320, 15], [356, 520, 130, 350, 13], [410, 400, 480, 210, 11], [330, 610, 50, 520, 10], [520, 360, 740, 290, 8]]) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 40, x1, y1);
    ctx.stroke();
  }
  const cols = win ? ['#4B6A45', '#66885A', '#89A870', '#A8C387'] : ['#545E4B', '#6B755F', '#879077', '#A0A58E'];
  for (const b of SEARCH.canopy) {
    ctx.fillStyle = rgba(cols[b.c], 0.92);
    ctx.beginPath();
    ctx.arc(b.x + Math.sin(lt * 1.1 + b.ph) * 3, b.y, b.r, 0, TAU);
    ctx.fill();
  }
}

function stoneLantern(ctx, x, y, win) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#8C857A';
  ctx.fillRect(-42, -22, 84, 22);
  ctx.fillRect(-15, -124, 30, 104);
  ctx.fillRect(-48, -144, 96, 22);
  ctx.fillStyle = '#A29B8E';
  ctx.fillRect(-33, -214, 66, 72);
  ctx.fillStyle = win ? '#FFD08A' : '#E6D6B6';
  ctx.fillRect(-18, -202, 36, 46);
  ctx.fillStyle = '#6C665C';
  ctx.beginPath();
  ctx.moveTo(-72, -210);
  ctx.quadraticCurveTo(-32, -226, -22, -254);
  ctx.lineTo(22, -254);
  ctx.quadraticCurveTo(32, -226, 72, -210);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-6, -272, 12, 20);
  if (win) glow(ctx, 0, -180, 100, '#FFC06A', 0.28);
  ctx.restore();
}

function bubble(ctx, x, y, w, h, lines, a, tail) {
  if (a <= 0) return;
  const sc = E.outBack(clamp(a));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.translate(-x, -y);
  ctx.globalAlpha *= clamp(a * 1.5);
  ctx.fillStyle = '#FFFDF8';
  ctx.strokeStyle = '#2B2622';
  ctx.lineWidth = 3;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 26);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const u = (i + 1) / 3.6;
    ctx.beginPath();
    ctx.arc(lerp(x - w * 0.25, tail[0], u), lerp(y + h / 2 + 6, tail[1], u), 11 - i * 3, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#2B2622';
  ctx.font = `500 30px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + (i - (lines.length - 1) / 2) * 40));
  ctx.restore();
}

function targetPage(lt) {
  const x = kf(lt, [[0, 1010], [0.62, 972, E.lin], [0.82, 790, E.out2], [1.28, 958, E.io2]]);
  const y = kf(lt, [[0, 250], [0.62, 640, E.lin], [0.82, 600, E.out2], [1.28, 868, E.in2]]);
  const rot = lt < 1.28 ? Math.sin(lt * 7) * 0.5 : -0.12 + Math.sin(lt * 5) * 0.03;
  return { x: x + (lt < 1.28 ? Math.sin(lt * 5) * 18 : 0), y, rot };
}

function searchFailPose(lt) {
  const j = seg(lt, 0.45, 0.95);
  const jumping = lt >= 0.45 && lt < 0.95;
  const p = { x: 960, y: 935, s: 22, fid: 0.1, t: lt, lift: jumping ? hop(j) * 170 : 0, sq: 1 - 0.2 * bump(lt, 0.3, 0.47), rot: 0, mood: 'normal', armL: [0.3, 1], armR: [0.3, 1], legs: {} };
  const tp = targetPage(lt);
  p.lookX = clamp((tp.x - p.x) / 160, -1, 1);
  p.lookY = clamp((tp.y - (p.y - p.lift - 80)) / 160, -1, 1);
  if (jumping) {
    p.armL = [1.3, 2.5];
    p.armR = [1.3, 2.5];
    p.legs = { tuck: 0.6 };
    p.sq += 0.12 * bump(lt, 0.45, 0.6);
    p.mood = 'wide';
  }
  if (lt >= 0.95) {
    const k = lt - 0.95;
    const sit = seg(lt, 1.1, 1.25);
    p.rot = Math.sin(k * 26) * 0.35 * Math.exp(-k * 5);
    p.sq = 1 - 0.3 * bump(lt, 0.95, 1.1) - 0.08 * sit;
    p.legs = { tuck: sit };
    p.lift = -0.75 * p.s * sit;
    p.mood = lt < 1.25 ? 'dizzy' : 'normal';
    const down = lerp(0.3, -0.6, seg(lt, 1.0, 1.2));
    p.armL = [down, 1];
    p.armR = [down, 1];
    if (lt > 1.3) {
      const w = Math.sin((lt - 1.3) * 18) * 0.5;
      p.armL = [0.9 + w, 1.2];
      p.armR = [0.9 - w, 1.2];
      p.sweat = seg(lt, 1.35, 1.5);
    }
  }
  return p;
}

function searchWinPose(lt) {
  const l = lt - 1.875;
  const jumps = [[0.55, 1.05, 950, 790, 190, 0], [1.08, 1.6, 790, 1110, 230, -TAU], [1.63, 2.1, 1110, 960, 170, 0]];
  let x = kf(l, [[0, 950], [0.55, 950], [1.05, 790], [1.08, 790], [1.6, 1110], [1.63, 1110], [2.1, 960]]);
  let lift = 0, rot = 0, air = false;
  for (const [a, b, x0, x1, h, spin] of jumps) {
    if (l >= a && l < b) {
      const u = (l - a) / (b - a);
      x = lerp(x0, x1, E.io2(u));
      lift = hop(u) * h;
      rot = spin * E.io2(u);
      air = true;
    }
  }
  let sq = 1 + Math.sin(l * 9) * 0.02 * (air ? 0 : 1);
  for (const [a, b] of jumps) sq -= 0.2 * bump(l, a - 0.1, a) + 0.18 * bump(l, b, b + 0.12);
  const posing = l > 2.2;
  return {
    x, y: 935, s: 25, lift, rot, sq, fid: 0.3, t: lt, band: true, wind: air ? 0.9 : 0.45,
    mood: posing ? 'happy' : 'determined', blink: 0,
    armR: posing ? [1.3, 1.25] : [0.75 + Math.sin(l * 6) * 0.2, 1.3], propR: 'magnifier',
    armL: posing ? [-0.45, 0.9] : [0.25, 1], legs: { tuck: air ? 0.55 : 0 },
    lookX: posing ? 0 : 0.2, lookY: posing ? 0 : -0.6, blush: posing ? seg(l, 2.2, 2.5) : 0,
  };
}

// Pages orbit on a tilted ring above Clawd's head, then scatter once the answer is assembled.
function vortexPage(i, l) {
  const n = 14;
  const th = (i / n) * TAU + l * 2.3;
  const spread = lerp(3.2, 1, E.out3(seg(l, 0.05, 0.5))) * (1 + 0.9 * E.io2(seg(l, 2.25, 3.1)));
  const r = (300 + (i % 3) * 80) * spread;
  const x = 950 + Math.cos(th) * r;
  const y = 555 + Math.sin(th) * r * 0.36 - Math.sin(th * 2 + i) * 26;
  const depth = Math.sin(th);
  return { x, y, s: 0.9 + 0.28 * depth, rot: Math.sin(th * 1.5 + i) * 0.3, depth, a: 1 - seg(l, 2.4, 3.1) };
}

function searchBar(ctx, lt) {
  const a = E.out3(seg(lt, 2.0, 2.3));
  if (a <= 0) return;
  const q = 'latest breakthroughs in fusion energy';
  const n = Math.floor(q.length * seg(lt, 2.1, 2.75));
  const x = 610, y = 40 - (1 - a) * 60, w = 700, h = 70;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(40,30,20,0.16)';
  roundRect(ctx, x + 4, y + 8, w, h, 35);
  ctx.fill();
  ctx.fillStyle = '#FFFDF8';
  roundRect(ctx, x, y, w, h, 35);
  ctx.fill();
  ctx.strokeStyle = 'rgba(217,119,87,0.6)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = '#8A7E72';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + 42, y + 32, 11, 0, TAU);
  ctx.moveTo(x + 50, y + 40);
  ctx.lineTo(x + 58, y + 48);
  ctx.stroke();
  ctx.fillStyle = '#2E2823';
  ctx.font = `500 28px ${FONT_SANS}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(q.slice(0, n), x + 78, y + h / 2 + 1);
  if (Math.floor(lt * 4) % 2 === 0 || n < q.length) {
    const cw = ctx.measureText(q.slice(0, n)).width;
    ctx.fillStyle = ORANGE;
    ctx.fillRect(x + 80 + cw, y + 18, 3, 34);
  }
  ctx.restore();
}

function chipPos(k) {
  const ln = CITE_LINE[k];
  return [CARD.x + 30 + LINE_W[ln] + 22, CARD.y + 106 + ln * 36];
}

function answerCard(ctx, lt) {
  const a = E.out3(seg(lt, 2.3, 2.7));
  if (a <= 0) return;
  const x = CARD.x + (1 - a) * 90, y = CARD.y, w = CARD.w, h = CARD.h;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(40,30,20,0.18)';
  roundRect(ctx, x + 8, y + 12, w, h, 22);
  ctx.fill();
  ctx.fillStyle = '#FFFDF8';
  roundRect(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,100,80,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  spark(ctx, x + 42, y + 46, 17, lt * 0.8, ORANGE);
  ctx.fillStyle = '#2B2520';
  ctx.font = `600 27px ${FONT_SANS}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Answer', x + 70, y + 56);
  ctx.fillStyle = '#9A8C7E';
  ctx.font = `500 19px ${FONT_SANS}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(48 * seg(lt, 2.3, 4.0))} sources`, x + w - 28, y + 55);
  ctx.textAlign = 'left';
  for (let i = 0; i < 8; i++) {
    const la = seg(lt, 2.55 + i * 0.17, 2.8 + i * 0.17);
    if (la <= 0) continue;
    ctx.fillStyle = 'rgba(90,80,70,0.34)';
    roundRect(ctx, x + 30, y + 100 + i * 36, LINE_W[i] * la, 12, 6);
    ctx.fill();
  }
  for (let k = 0; k < 5; k++) {
    const ca = E.outBack(seg(lt, CATCH[k] + 0.3, CATCH[k] + 0.45));
    if (ca <= 0) continue;
    const [cx, cy] = chipPos(k);
    ctx.save();
    ctx.translate(cx + (x - CARD.x), cy);
    ctx.scale(ca, ca);
    ctx.fillStyle = '#FBE7DC';
    roundRect(ctx, -15, -15, 30, 30, 8);
    ctx.fill();
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.fillStyle = '#B4502F';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(k + 1), 0, 1);
    ctx.restore();
  }
  const fa = seg(lt, 4.1, 4.4);
  if (fa > 0) {
    ctx.globalAlpha = a * fa;
    ctx.fillStyle = '#5E7F3A';
    ctx.font = `600 21px ${FONT_SANS}`;
    ctx.fillText('\u2713 5 citations \u00b7 verified', x + 30, y + h - 30);
  }
  ctx.restore();
}

function drawSearch(ctx, lt) {
  const win = lt >= 1.875;
  const l = lt - 1.875;
  const cam = win
    ? { x: 960 + Math.sin(l * 0.8) * 10, y: 560, zoom: kf(l, [[0, 1.14], [0.5, 1.0, E.out3], [2.3, 1.02], [3.2, 1.06]]) }
    : { x: kf(lt, [[0, 990], [1.875, 950]]), y: kf(lt, [[0, 600], [1.875, 660]]), zoom: kf(lt, [[0, 1.04], [1.875, 1.2]]) };
  if (!win) Object.assign(cam, shake(lt, 9 * bump(lt, 0.95, 1.15) + 5 * bump(lt, 1.1, 1.3)));
  sky(ctx, win ? [[0, '#D9E2DF'], [0.55, '#ECEADC'], [1, '#F4EEE0']] : [[0, '#E0DACB'], [0.55, '#EAE4D6'], [1, '#F1EBDF']]);
  layer(ctx, cam, 0.12, () => {
    if (win) sun(ctx, 1570, 180, 54, 'rgba(234,146,106,0.85)', '#F6D2AE', 230, 0.35);
    birds(ctx, lt, 1300, 170, 3, 'rgba(60,52,44,0.5)', 9, 24);
  });
  layer(ctx, cam, 0.3, () => {
    drawRange(ctx, SEARCH.far, win ? 'rgba(112,134,130,0.78)' : 'rgba(146,141,128,0.78)', 'rgba(236,232,220,0)');
    mist(ctx, 560, 60, '#F3EFE4', 0.75, lt, 12, 7);
  });
  layer(ctx, cam, 0.7, () => courtyardWall(ctx, win));
  layer(ctx, cam, 1, () => {
    courtyardFloor(ctx, win);
    stoneLantern(ctx, 1850, 840, win);
    tree(ctx, lt, win);
    if (!win) {
      for (const p of SEARCH.fall) {
        const tt = lt - p.t0;
        if (tt < 0) continue;
        const y = Math.min(p.land, p.y0 + tt * p.v);
        const landed = y >= p.land;
        const x = p.x0 + (landed ? Math.sin(((p.land - p.y0) / p.v) * 2.2 + p.ph) * p.sway + ((p.land - p.y0) / p.v) * 40 : Math.sin(tt * 2.2 + p.ph) * p.sway + tt * 40);
        drawPage(ctx, x, y, landed ? p.ph * 0.2 : Math.sin(tt * 2.6 + p.ph) * 0.55, 0.8, p.variant);
      }
      const pose = searchFailPose(lt);
      drawClawd(ctx, pose);
      const tp = targetPage(lt);
      let px = tp.x, py = tp.y;
      if (lt >= 1.28) {
        px = pose.x + pose.rot * 20;
        py = pose.y - pose.lift - 3.3 * pose.s * pose.sq;
      }
      drawPage(ctx, px, py, tp.rot, 1.05, 2);
    } else {
      const pages = [];
      for (let i = 0; i < 14; i++) {
        const k = ANSWER_IDX.indexOf(i);
        if (k >= 0 && lt >= CATCH[k]) continue;
        pages.push({ i, k, ...vortexPage(i, l) });
      }
      pages.sort((a, b) => a.depth - b.depth);
      const hlOf = (p) => (p.k >= 0 ? seg(lt, CATCH[p.k] - 0.2, CATCH[p.k]) : 0);
      for (const p of pages) if (p.depth < 0) drawPage(ctx, p.x, p.y, p.rot, p.s, p.i, hlOf(p), 0.9 * p.a);
      const pose = searchWinPose(lt);
      for (let g = 2; g >= 1; g--) {
        const ghost = searchWinPose(lt - g * 0.045);
        if (ghost.lift > 20) drawClawd(ctx, { ...ghost, alpha: 0.12 * (3 - g), shadow: 0 });
      }
      drawClawd(ctx, pose);
      for (const p of pages) if (p.depth >= 0) drawPage(ctx, p.x, p.y, p.rot, p.s, p.i, hlOf(p), p.a);
      const lx = pose.x + 5.6 * pose.s, ly = pose.y - pose.lift - 4.8 * pose.s;
      for (let k = 0; k < 5; k++) {
        const d = lt - CATCH[k];
        if (d >= 0 && d < 0.16) {
          const vp = vortexPage(ANSWER_IDX[k], CATCH[k] - 1.875);
          ctx.strokeStyle = rgba('#FFE2B8', 0.9 * (1 - d / 0.16));
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(vp.x, vp.y);
          ctx.stroke();
          burst(ctx, vp.x, vp.y, 70, 12, '#FFF1D6', 1 - d / 0.16, d * 3);
        }
      }
      if (l > 2.2 && l < 2.6) twinkle(ctx, lx + 10, ly - 30, 30 * bump(l, 2.25, 2.6), '#FFFFFF', 0.95);
    }
    ctx.globalAlpha = 1;
  });
  if (!win) {
    const b = seg(lt, 1.33, 1.5);
    bubble(ctx, 1260, 690, 470, 118, ['Sorry, I can\u2019t browse', 'the internet\u2026'], b, [1040, 830]);
  } else {
    searchBar(ctx, lt);
    answerCard(ctx, lt);
    const cam2 = cam;
    for (let k = 0; k < 5; k++) {
      const u = seg(lt, CATCH[k], CATCH[k] + 0.36);
      if (u <= 0 || u >= 1) continue;
      const vp = vortexPage(ANSWER_IDX[k], CATCH[k] - 1.875);
      const [sx, sy] = worldToScreen(cam2, vp.x, vp.y);
      const [tx, ty] = chipPos(k);
      const e = E.io2(u);
      drawPage(ctx, lerp(sx, tx, e), lerp(sy, ty, e) - Math.sin(Math.PI * e) * 80, lerp(vp.rot, 0, e), lerp(vp.s * cam2.zoom, 0.3, e), ANSWER_IDX[k], 1, 1 - seg(u, 0.85, 1));
    }
  }
  flash(ctx, lt, 1.875, 0.24);
}

// ======================================================= 3. WRITING CODE (7.5 - 12.5 s)
const TOK = { k: '#B4472A', f: '#2E6591', p: '#2C2621', n: '#A0521E', s: '#5B7D2C', e: '#2C2621' };
const CODE = [
  [['async ', 'k'], ['function ', 'k'], ['train', 'f'], ['(skill) {', 'p']],
  [['  let ', 'k'], ['level = ', 'p'], ['1', 'n'], [';', 'p']],
  [['  while ', 'k'], ['(!skill.', 'p'], ['mastered', 'f'], [') {', 'p']],
  [['    const ', 'k'], ['r = ', 'p'], ['await ', 'k'], ['practice', 'f'], ['(skill);', 'p']],
  [['    level += ', 'p'], ['r.lessons', 'p'], [';', 'p']],
  [['    if ', 'k'], ['(r.stuck) ', 'p'], ['tryAgain', 'f'], ['();', 'p']],
  [['  }', 'p']],
  [['  return ', 'k'], ['help', 'f'], ['(humanity);', 'p']],
  [['}', 'p']],
  [['train', 'f'], ['(', 'p'], ['"everything"', 's'], [');', 'p']],
];
const BAD = [
  [['functon ', 'k', 1], ['helo', 'f'], ['( {', 'p', 1]],
  [['  retrun ', 'k', 1], ['"hi', 's']],
];
const SCROLL = { x: 140, y: 300, w: 720, h: 560 };
const STRIKES = Array.from({ length: 10 }, (_, k) => 1.875 + k * 0.3125);

function squiggle(ctx, x, y, w) {
  ctx.strokeStyle = '#D6362B';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= w; i += 3) ctx.lineTo(x + i, y + Math.sin(i * 0.8) * 3);
  ctx.stroke();
}

function codeLine(ctx, tokens, x, y, chars) {
  let cx = x, left = chars;
  for (const [txt, kind, bad] of tokens) {
    if (left <= 0) break;
    const s = txt.slice(0, Math.max(0, Math.floor(left)));
    ctx.fillStyle = TOK[kind];
    ctx.fillText(s, cx, y);
    const w = ctx.measureText(s).width;
    if (bad && s.trim().length) squiggle(ctx, cx, y + 10, w - (s.endsWith(' ') ? 12 : 0));
    cx += w;
    left -= txt.length;
  }
  return cx;
}

function codeScroll(ctx, lt) {
  const { x, y, w, h } = SCROLL;
  const win = lt >= 1.875;
  ctx.fillStyle = 'rgba(40,24,12,0.25)';
  ctx.fillRect(x + 12, y + 18, w, h);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#EEDFBF');
  g.addColorStop(0.5, '#F8EDD5');
  g.addColorStop(1, '#ECDBB9');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  for (const ry of [y - 10, y + h - 10]) {
    const rg = ctx.createLinearGradient(0, ry, 0, ry + 22);
    rg.addColorStop(0, '#6B4328');
    rg.addColorStop(0.5, '#A06F46');
    rg.addColorStop(1, '#4E2F1B');
    ctx.fillStyle = rg;
    roundRect(ctx, x - 28, ry, w + 56, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#2E1C10';
    ctx.beginPath();
    ctx.arc(x - 28, ry + 11, 14, 0, TAU);
    ctx.arc(x + w + 28, ry + 11, 14, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(120,90,60,0.1)';
  ctx.fillRect(x, y + 14, w, 48);
  spark(ctx, x + 38, y + 38, 13, 0, ORANGE);
  ctx.fillStyle = '#7A6250';
  ctx.font = `600 22px ${FONT_MONO}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('train.js', x + 62, y + 46);
  ctx.font = `600 27px ${FONT_MONO}`;
  const lh = 40, x0 = x + 78, y0 = y + 102;
  const lines = win ? CODE : BAD;
  let shown, caretLine = -1, caretX = 0;
  if (!win) {
    shown = [seg(lt, 0.42, 0.8) * 17, seg(lt, 0.8, 1.0) * 11];
  } else {
    shown = CODE.map((ln, i) => seg(lt, STRIKES[i], STRIKES[i] + 0.2) * ln.reduce((n, tk) => n + tk[0].length, 0));
  }
  for (let i = 0; i < lines.length; i++) {
    if (shown[i] <= 0) continue;
    ctx.fillStyle = 'rgba(122,98,80,0.45)';
    ctx.textAlign = 'right';
    ctx.fillText(String(i + 1), x0 - 22, y0 + i * lh);
    ctx.textAlign = 'left';
    caretX = codeLine(ctx, lines[i], x0, y0 + i * lh, shown[i]);
    caretLine = i;
  }
  if (caretLine >= 0 && Math.floor(lt * 5) % 2 === 0) {
    ctx.fillStyle = ORANGE;
    ctx.fillRect(caretX + 2, y0 + caretLine * lh - 24, 3, 30);
  }
  if (!win) {
    const ea = seg(lt, 0.95, 1.1);
    if (ea > 0) {
      ctx.globalAlpha = ea;
      ctx.fillStyle = '#FBE3DC';
      roundRect(ctx, x0 - 10, y0 + 2 * lh - 24, 470, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#C2362A';
      ctx.font = `600 23px ${FONT_MONO}`;
      ctx.fillText('\u2717 SyntaxError: Unexpected token', x0 + 4, y0 + 2 * lh + 4);
      ctx.globalAlpha = 1;
    }
  } else {
    const ta = E.outBack(seg(lt, 4.75, 4.95));
    if (ta > 0) {
      ctx.save();
      ctx.translate(x + w / 2, y + h - 38);
      ctx.scale(ta, ta);
      ctx.fillStyle = '#E2EFD4';
      roundRect(ctx, -250, -26, 500, 52, 12);
      ctx.fill();
      ctx.strokeStyle = '#7DA25A';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#3F6B26';
      ctx.font = `700 26px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2713 128 tests passed', 0, 1);
      ctx.restore();
    }
  }
}

function bug(ctx, x, y, rot, s, t, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = '#231A16';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const sg of [-1, 1]) {
    for (let k = -1; k <= 1; k++) {
      const wig = Math.sin(t * 30 + k * 2 + sg) * 3;
      ctx.moveTo(sg * 7, k * 6);
      ctx.lineTo(sg * 16, k * 9 + wig);
    }
    ctx.moveTo(sg * 3, -11);
    ctx.lineTo(sg * 8, -19);
  }
  ctx.stroke();
  ctx.fillStyle = '#2E2320';
  ctx.beginPath();
  ctx.ellipse(0, -9, 6, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#C23B2E';
  ctx.beginPath();
  ctx.ellipse(0, 2, 10, 12, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#231A16';
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(0, 14);
  ctx.stroke();
  ctx.fillStyle = '#231A16';
  for (const [dx, dy] of [[-5, -1], [5, 3], [-4, 7]]) {
    ctx.beginPath();
    ctx.arc(dx, dy, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function hall(ctx, lt, win) {
  ctx.fillStyle = win ? '#E9DABF' : '#E1D5BE';
  ctx.fillRect(-400, -300, W + 800, 960);
  const wx0 = 600, wx1 = 1320, wy0 = 175, wy1 = 545;
  ctx.fillStyle = win ? '#FFF4D8' : '#F5EDDB';
  ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  glow(ctx, 960, 360, 560, '#FFE7B0', win ? 0.5 : 0.32);
  ctx.strokeStyle = '#6B4A33';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let x = wx0; x <= wx1; x += 60) { ctx.moveTo(x, wy0); ctx.lineTo(x, wy1); }
  for (let y = wy0; y <= wy1; y += 62) { ctx.moveTo(wx0, y); ctx.lineTo(wx1, y); }
  ctx.stroke();
  ctx.lineWidth = 18;
  ctx.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  ctx.fillStyle = '#583C29';
  ctx.fillRect(-400, 92, W + 800, 40);
  ctx.fillRect(-400, 612, W + 800, 36);
  for (const px of [96, 540, 1380, 1824]) ctx.fillRect(px - 22, 92, 44, 560);
  ctx.save();
  ctx.translate(1600, 170);
  ctx.fillStyle = '#4E2F1B';
  ctx.fillRect(-72, -12, 144, 14);
  ctx.fillStyle = '#F1E4C6';
  ctx.fillRect(-60, 0, 120, 360);
  ctx.fillStyle = '#4E2F1B';
  ctx.fillRect(-70, 356, 140, 14);
  ctx.fillStyle = '#231B15';
  ctx.font = `900 96px ${FONT_CJK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u5b66', 0, 130);
  seal(ctx, 30, 290, 34, '\u9053', { font: `700 20px ${FONT_CJK}` });
  ctx.restore();
}

function planks(ctx, win) {
  const y0 = 645, yb = H + 220, vx = 960, vy = 300;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, win ? '#9E7252' : '#8E6A4E');
  g.addColorStop(1, win ? '#6A4630' : '#624531');
  ctx.fillStyle = g;
  ctx.fillRect(-400, y0, W + 800, yb - y0);
  ctx.strokeStyle = 'rgba(50,30,18,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const k0 = (y0 - vy) / (yb - vy);
  for (let i = -18; i <= 18; i++) {
    const xb = 960 + i * 150;
    ctx.moveTo(vx + (xb - vx) * k0, y0);
    ctx.lineTo(xb, yb);
  }
  ctx.stroke();
  glow(ctx, 960, 760, 620, '#FFE2B0', win ? 0.16 : 0.1);
}

function lightShafts(ctx, lt, win) {
  ctx.save();
  for (let k = 0; k < 5; k++) {
    const x0 = 640 + k * 150, drift = Math.sin(lt * 0.6 + k) * 10;
    const g = ctx.createLinearGradient(0, 540, 0, 1000);
    g.addColorStop(0, `rgba(255,236,190,${win ? 0.2 : 0.12})`);
    g.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, 540);
    ctx.lineTo(x0 + 90, 540);
    ctx.lineTo(x0 + 330 + drift, 1000);
    ctx.lineTo(x0 + 180 + drift, 1000);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function woodDummy(ctx, x, y, st) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(30,18,10,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 110, 16, 0, 0, TAU);
  ctx.fill();
  ctx.rotate(st.wobble);
  ctx.fillStyle = '#3A281C';
  roundRect(ctx, -74, -28, 148, 32, 6);
  ctx.fill();
  const arms = [[-340, -0.4, 150, 0.35], [-340, 0.4, 150, -0.35], [-248, 0, 172, 0], [-120, -0.65, 134, 0.2]];
  const drawArm = (i, behind) => {
    const [ay, a, L, phase] = arms[i];
    const spinK = Math.cos(st.spin + phase);
    if (behind !== spinK < 0) return;
    const hitK = st.hitArm === i ? st.hitAmt : 0;
    ctx.save();
    ctx.translate(0, ay);
    ctx.rotate(Math.PI + a + hitK * 0.55);
    ctx.fillStyle = behind ? '#5A3C27' : '#80573A';
    roundRect(ctx, 20, -11, L * Math.abs(spinK) * (spinK < 0 ? -1 : 1) || 1, 22, 11);
    ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < 4; i++) drawArm(i, true);
  const g = ctx.createLinearGradient(-46, 0, 46, 0);
  g.addColorStop(0, '#5E4029');
  g.addColorStop(0.45, '#A9794F');
  g.addColorStop(1, '#553925');
  ctx.fillStyle = g;
  roundRect(ctx, -46, -450, 92, 430, 34);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,36,20,0.35)';
  ctx.lineWidth = 3;
  for (const yy of [-400, -290, -190, -80]) {
    ctx.beginPath();
    ctx.moveTo(-44, yy);
    ctx.quadraticCurveTo(0, yy + 10, 44, yy);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) drawArm(i, false);
  ctx.restore();
}

function codeFailPose(lt) {
  const p = { x: 1060, y: 935, s: 24, fid: 0.45, t: lt, facing: 1, mood: 'determined', band: true, wind: 0.3, armL: [0.45, 1], armR: [0.2, 1], legs: {} };
  p.sq = 1 + Math.sin(lt * 10) * 0.025;
  const punch = bump(lt, 0.32, 0.58);
  p.armR = [0.1, 1 + 1.5 * punch];
  p.x += 12 * punch;
  if (lt > 0.62) { p.mood = 'normal'; p.lookX = -1; p.lookY = -0.2; }
  if (lt > 0.92) p.mood = 'wide';
  if (lt >= 1.2) {
    const u = seg(lt, 1.2, 1.55);
    p.x = lerp(1060, 880, E.out2(u));
    p.lift = hop(u) * 90;
    p.rot = -E.out2(u) * TAU * 0.9;
    p.mood = 'dizzy';
    p.armL = [1.2, 1];
    p.armR = [1.2, 1];
    if (lt >= 1.55) {
      const sit = seg(lt, 1.55, 1.68);
      p.rot = lerp(-TAU * 0.9, -TAU, sit) + Math.sin(lt * 14) * 0.08 * (1 - sit);
      p.legs = { tuck: sit };
      p.lift = -0.75 * p.s * sit;
      p.sq = 1 - 0.25 * bump(lt, 1.55, 1.7);
      p.armL = [-0.5, 1];
      p.armR = [-0.5, 1];
      p.stars = seg(lt, 1.58, 1.7);
    }
  }
  return p;
}

function codeWinPose(lt) {
  const p = { x: 1085, y: 935, s: 24, fid: 0.62, t: lt, facing: 1, mood: 'determined', band: true, wind: 0.55, armL: [0.55, 1], armR: [0.2, 1], legs: { spread: 0.3 } };
  let punch = 0, idx = -1;
  STRIKES.forEach((tk, k) => {
    const d = lt - tk;
    if (d >= 0 && d < 0.3) {
      const v = d < 0.05 ? d / 0.05 : Math.max(0, 1 - (d - 0.05) / 0.22);
      if (v > punch) { punch = v; idx = k; }
    }
  });
  const angs = [0, 0.35, -0.3, 0.1, 0.55, -0.2, 0.25, -0.35, 0.4, 0.05];
  const big = idx === 9 ? 1.35 : 1;
  p.armR = [idx >= 0 ? angs[idx] : 0.2, 1 + 1.75 * punch * big];
  p.armL = [0.5 + 0.25 * Math.sin(lt * 12), 1];
  p.x += 14 * punch;
  p.rot = -0.06 * punch;
  p.sq = 1 - 0.06 * punch + Math.sin(lt * 11) * 0.015;
  if (idx === 3 || idx === 7) p.lift = hop(clamp((lt - STRIKES[idx]) / 0.3)) * 60;
  if (lt > 4.82) {
    p.mood = 'happy';
    p.armR = [1.3, 1.25];
    p.armL = [-0.4, 0.9];
    p.blush = seg(lt, 4.82, 5);
  }
  return p;
}

function drawCode(ctx, lt) {
  const win = lt >= 1.875;
  const cam = win
    ? { x: 1000, y: 560, zoom: kf(lt, [[1.875, 1.12], [2.3, 1.02, E.out3], [4.6, 1.06], [4.75, 1.1, E.out3], [5, 1.08]]) }
    : { x: kf(lt, [[0, 900], [1.875, 930]]), y: kf(lt, [[0, 555], [1.875, 585]]), zoom: kf(lt, [[0, 1.02], [1.875, 1.1]]) };
  let shk = 0;
  if (!win) shk = 10 * bump(lt, 1.18, 1.35) + 6 * bump(lt, 1.52, 1.68);
  else STRIKES.forEach((tk, k) => (shk += (k === 9 ? 16 : 4) * bump(lt, tk, tk + (k === 9 ? 0.25 : 0.1))));
  Object.assign(cam, shake(lt, shk, 40, 3));

  let dummy = { wobble: 0, spin: 0, hitArm: -1, hitAmt: 0 };
  if (!win) {
    const w1 = bump(lt, 0.4, 0.9) * Math.sin((lt - 0.4) * 30) * 0.03;
    const swing = bump(lt, 0.98, 1.34);
    dummy = { wobble: w1, spin: 0, hitArm: 2, hitAmt: -swing * 2.2 };
  } else {
    let hit = 0, k0 = 0;
    STRIKES.forEach((tk, k) => {
      const d = lt - tk;
      if (d >= 0.02 && d < 0.35) { const v = Math.exp(-(d - 0.02) * 9) * Math.sin((d - 0.02) * 30); if (Math.abs(v) > Math.abs(hit)) { hit = v; k0 = k; } }
    });
    dummy = { wobble: hit * 0.035, spin: lt > STRIKES[9] ? E.out3(seg(lt, STRIKES[9], STRIKES[9] + 0.3)) * TAU * 2 : 0, hitArm: k0 % 3, hitAmt: hit };
  }

  layer(ctx, cam, 0.6, () => hall(ctx, lt, win));
  layer(ctx, cam, 1, () => {
    planks(ctx, win);
    lightShafts(ctx, lt, win);
    if (win && lt > STRIKES[9] && lt < STRIKES[9] + 0.3) speedLines(ctx, 1245, 850, 260, 1400, 70, '#FFFFFF', 0.8 * (1 - seg(lt, STRIKES[9], STRIKES[9] + 0.3)), 5, lt);
  });
  layer(ctx, cam, 0.95, () => {
    codeScroll(ctx, lt);
    if (!win) {
      const bu = seg(lt, 1.0, 1.875);
      if (bu > 0) bug(ctx, lerp(560, 780, bu), SCROLL.y + 98 + Math.sin(bu * 20) * 3 + bu * 120, 1.2 + Math.sin(lt * 20) * 0.1, 1.3, lt);
    } else {
      [[2.75, 3.1, 3], [3.4, 3.8, 6]].forEach(([t0, t1, line]) => {
        const a = seg(lt, t0, t0 + 0.1) * (1 - seg(lt, t1, t1 + 0.12));
        const bx = SCROLL.x + 470 + Math.sin(lt * 9) * 20, by = SCROLL.y + 102 + line * 40 - 8;
        bug(ctx, bx, by, Math.sin(lt * 14) * 0.4, 1.1, lt, a);
        if (lt > t1 && lt < t1 + 0.3) {
          const z = seg(lt, t1, t1 + 0.3);
          ring(ctx, bx, by, 20 + z * 50, 4, '#7DA25A', 1 - z);
          ctx.fillStyle = rgba('#5E8F3A', 1 - z);
          ctx.font = `700 34px ${FONT_SANS}`;
          ctx.textAlign = 'center';
          ctx.fillText('\u2713', bx, by - z * 30);
          ctx.textAlign = 'left';
        }
      });
    }
  });
  layer(ctx, cam, 1, () => {
    woodDummy(ctx, 1380, 940, dummy);
    const pose = win ? codeWinPose(lt) : codeFailPose(lt);
    drawClawd(ctx, pose);
    if (win) {
      STRIKES.forEach((tk, k) => {
        const d = lt - tk;
        if (d >= 0.03 && d < 0.2) {
          const a = 1 - (d - 0.03) / 0.17;
          const hx = 1245 + (k % 3) * 12, hy = 870 - [0, 0.35, -0.3, 0.1, 0.55, -0.2, 0.25, -0.35, 0.4, 0.05][k] * 70;
          burst(ctx, hx, hy, k === 9 ? 140 : 70, 10, '#FFF4DA', a, k);
          ring(ctx, hx, hy, (k === 9 ? 160 : 70) * (1 - a) + 10, 4, '#FFE1A8', a);
        }
      });
    } else {
      const pb = bump(lt, 0.36, 0.52);
      if (pb > 0) burst(ctx, 1238, 872, 46, 8, '#FFF4DA', pb * 0.8);
      if (lt > 1.18 && lt < 1.34) burst(ctx, 1110, 840, 90, 10, '#FFE9B0', 1 - seg(lt, 1.18, 1.34));
    }
  });
  layer(ctx, cam, 1.15, () => {
    for (const px of [-20, 1864]) {
      const g = ctx.createLinearGradient(px, 0, px + 76, 0);
      g.addColorStop(0, '#6E2418');
      g.addColorStop(0.4, '#B04433');
      g.addColorStop(1, '#6E2418');
      ctx.fillStyle = g;
      ctx.fillRect(px, -300, 76, H + 600);
    }
  });
  flash(ctx, lt, 1.875, 0.24);
}

// ======================================================= 4. CREATING 3D MODELS (12.5 - 17.5 s)
const MODEL = {
  far: makeRange(31, { base: 650, hMin: 120, hMax: 280, wMin: 60, wMax: 140, count: 16, rough: 8 }),
  near: makeRange(32, { base: 720, hMin: 70, hMax: 190, wMin: 70, wMax: 160, count: 12, rough: 8 }),
  stars: Array.from({ length: 150 }, (_, i) => [hash(i * 1.7) * W, hash(i * 2.9) * 600, 0.7 + hash(i * 4.1) * 1.8, hash(i * 6.3) * TAU]),
  mesh: makePagodaMesh(),
  bamboo: [[-30, 1180, 1250, 0.05, 101], [60, 1150, 1080, 0.1, 102], [140, 1200, 1320, 0.02, 103], [1790, 1180, 1200, -0.05, 104], [1880, 1160, 1350, -0.1, 105], [1960, 1200, 1100, -0.03, 106]],
};
const MATS = {
  stone: { color: '#A39B8C', amb: 0.42, tint: '#7480B0', tintAmt: 0.25 },
  wall: { color: '#F2E4C8', amb: 0.5, tint: '#A4B0DA', tintAmt: 0.18 },
  roof: { color: '#C4552F', amb: 0.4, tint: '#6A4A86', tintAmt: 0.12 },
  gold: { color: '#EDB54C', amb: 0.6, tint: '#EDB54C', tintAmt: 0 },
};
const MODEL_C = { x: 1180, y: 470 };

function balustrade(ctx, y, col) {
  ctx.fillStyle = col;
  ctx.fillRect(-400, y, W + 800, 16);
  ctx.fillRect(-400, y + 62, W + 800, 12);
  for (let x = -380; x < W + 400; x += 40) ctx.fillRect(x - 3, y + 16, 6, 46);
  for (let x = -300; x < W + 400; x += 160) {
    ctx.fillRect(x - 10, y - 12, 20, 86);
    ctx.beginPath();
    ctx.arc(x, y - 16, 12, 0, TAU);
    ctx.fill();
  }
}

function pedestal(ctx, x, y, glowA) {
  glow(ctx, x, y - 10, 260, '#FFCB7A', 0.28 * glowA);
  ctx.fillStyle = '#353B55';
  ctx.beginPath();
  ctx.ellipse(x, y + 72, 160, 34, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - 160, y, 320, 72);
  const g = ctx.createLinearGradient(x - 150, 0, x + 150, 0);
  g.addColorStop(0, '#3D4462');
  g.addColorStop(0.5, '#5A6284');
  g.addColorStop(1, '#343A56');
  ctx.fillStyle = g;
  ctx.fillRect(x - 150, y, 300, 66);
  ctx.beginPath();
  ctx.ellipse(x, y + 66, 150, 30, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#6F779A';
  ctx.beginPath();
  ctx.ellipse(x, y, 150, 30, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba('#FFD58A', 0.25 + 0.6 * glowA);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, 118, 22, 0, 0, TAU);
  ctx.stroke();
}

function cubeFail(ctx, lt) {
  const a = seg(lt, 0.2, 0.38);
  if (a <= 0) return;
  const collapse = seg(lt, 0.8, 1.12);
  const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const Ed = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const yaw = lt * 1.4, pitch = 0.42, S = 88 * lerp(0.4, 1, E.outBack(a)), cx = MODEL_C.x, cy = 560;
  const jit = 0.06 + seg(lt, 0.3, 0.8) * 0.38;
  const P = V.map((v, i) => {
    const x = v[0] + vnoise(lt * 8 + i * 3.1, i) * jit, y = v[1] + vnoise(lt * 8 + i * 5.3, i + 20) * jit, z = v[2] + vnoise(lt * 8 + i * 7.7, i + 40) * jit;
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw), z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    let sx = cx + x1 * S, sy = cy - (y * Math.cos(pitch) - z1 * Math.sin(pitch)) * S;
    if (collapse > 0) {
      const floor = 790 - hash(i * 3.3) * 18;
      sy = lerp(sy, floor, E.in2(collapse)) - Math.abs(Math.sin(collapse * Math.PI * 2.2)) * 30 * (1 - collapse) * collapse;
      sx += (hash(i * 1.9) - 0.5) * 170 * E.out2(collapse);
    }
    return [sx, sy];
  });
  const fade = 1 - seg(lt, 1.02, 1.25);
  ctx.save();
  ctx.lineCap = 'round';
  for (const pass of [[9, 0.2], [2.6, 0.95]]) {
    ctx.strokeStyle = rgba('#BFE2FF', pass[1] * a * fade);
    ctx.lineWidth = pass[0];
    ctx.beginPath();
    for (const [i, j] of Ed) {
      const [x0, y0] = P[i], [x1, y1] = P[j];
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + vnoise(lt * 12 + i * j, 3) * jit * 70, (y0 + y1) / 2 + vnoise(lt * 12 + i + j * 7, 5) * jit * 70, x1, y1);
    }
    ctx.stroke();
  }
  ctx.fillStyle = rgba('#E8F6FF', a * fade);
  for (const [x, y] of P) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function modelFailPose(lt) {
  const p = { x: 640, y: 905, s: 25, fid: 0.7, t: lt, facing: 1, band: true, wind: 0.3, mood: 'determined', legs: { spread: 0.25 } };
  const up = E.out2(seg(lt, 0, 0.2));
  const wave = Math.sin(lt * 16) * 0.3 * seg(lt, 0.2, 0.3) * (1 - seg(lt, 0.8, 0.9));
  p.armL = [lerp(0, 1.25, up) + wave, 1.2];
  p.armR = [lerp(0, 1.25, up) - wave, 1.2];
  p.sq = 1 + Math.sin(lt * 30) * 0.015 * seg(lt, 0.3, 0.8);
  p.lookX = 1;
  p.lookY = -0.5;
  if (lt > 0.82) { p.mood = 'wide'; p.lookY = lerp(-0.5, 0.6, seg(lt, 0.82, 1.1)); }
  if (lt > 1.0) {
    const d = E.out2(seg(lt, 1.0, 1.2));
    p.armL = [lerp(1.25, -0.9, d), 1];
    p.armR = [lerp(1.25, -0.9, d), 1];
    p.mood = 'sad';
    p.sweat = seg(lt, 1.02, 1.15);
  }
  return p;
}

function modelWinPose(lt) {
  const l = lt - 1.25, w = 3.1;
  const p = { x: 640 + Math.sin(l * 1.6) * 10, y: 905, s: 25, fid: 0.9, t: lt, facing: 1, band: true, wind: 0.35, mood: 'closed', legs: { spread: 0.35 } };
  p.armL = [0.35 + 0.75 * Math.sin(l * w), 1.35];
  p.armR = [0.35 + 0.75 * Math.sin(l * w + 2.1), 1.35];
  p.rot = Math.sin(l * 1.6) * 0.05;
  p.sq = 1 + Math.sin(l * w * 2) * 0.02;
  if (lt > 4.05) {
    p.mood = 'happy';
    p.armR = [lerp(p.armR[0], 1.3, seg(lt, 4.05, 4.25)), 1.3];
    p.blush = seg(lt, 4.05, 4.3);
  }
  p.glow = 0.25 * seg(l, 0.2, 1);
  return p;
}

function drawModel(ctx, lt) {
  const win = lt >= 1.25;
  const cam = win
    ? { x: kf(lt, [[1.25, 1000], [5, 960]]), y: 560, zoom: kf(lt, [[1.25, 1.1], [1.7, 1.0, E.out3], [5, 1.05]]) }
    : { x: 980, y: 580, zoom: kf(lt, [[0, 1.02], [1.25, 1.08]]) };
  Object.assign(cam, shake(lt, 7 * bump(lt, 0.95, 1.15), 40, 6));
  sky(ctx, [[0, '#10152A'], [0.55, '#212846'], [1, '#384062']]);
  layer(ctx, cam, 0.05, () => {
    for (const [x, y, r, ph] of MODEL.stars) {
      ctx.fillStyle = `rgba(255,248,230,${0.35 + 0.35 * Math.sin(lt * 2.4 + ph)})`;
      ctx.fillRect(x, y, r, r);
    }
    sun(ctx, 1540, 200, 78, '#F3EAD3', '#9FA8C8', 300, 0.3);
    ctx.fillStyle = 'rgba(40,46,78,0.75)';
    for (let i = 0; i < 3; i++) {
      const cx = ((lt * (18 + i * 6) + i * 700) % 2600) - 400;
      ctx.beginPath();
      ctx.ellipse(cx, 170 + i * 70, 260, 16 + i * 4, 0, 0, TAU);
      ctx.fill();
    }
  });
  layer(ctx, cam, 0.25, () => {
    drawRange(ctx, MODEL.far, 'rgba(54,63,100,0.95)', 'rgba(56,64,98,0)');
    mist(ctx, 650, 60, '#8E9ACB', 0.2, lt, 12, 11);
  });
  layer(ctx, cam, 0.45, () => drawRange(ctx, MODEL.near, 'rgba(33,40,66,0.98)', 'rgba(38,44,70,0.2)'));
  layer(ctx, cam, 0.8, () => balustrade(ctx, 684, '#1B2033'));
  layer(ctx, cam, 1, () => {
    const g = ctx.createLinearGradient(0, 760, 0, H);
    g.addColorStop(0, '#2C3249');
    g.addColorStop(1, '#1A1E2D');
    ctx.fillStyle = g;
    ctx.fillRect(-400, 760, W + 800, 500);
    ctx.strokeStyle = 'rgba(80,90,130,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -14; i <= 14; i++) { ctx.moveTo(960 + i * 55, 760); ctx.lineTo(960 + i * 240, H + 200); }
    for (let k = 1; k < 8; k++) { const y = 760 + 520 * Math.pow(k / 8, 1.7); ctx.moveTo(-400, y); ctx.lineTo(W + 400, y); }
    ctx.stroke();
    const built = win ? seg(lt, 3.1, 3.9) : 0;
    pedestal(ctx, MODEL_C.x, 790, win ? 0.3 + 0.7 * built : 0.15);
    if (!win) {
      cubeFail(ctx, lt);
      drawClawd(ctx, modelFailPose(lt));
    } else {
      const mesh = MODEL.mesh;
      const proj = project(mesh, { yaw: lt * 0.9 + 0.6, pitch: 0.26, cx: MODEL_C.x, cy: MODEL_C.y + Math.sin(lt * 1.5) * 6, scale: 52, dist: 14 });
      const faceA = seg(lt, 3.1, 3.9), wire = seg(lt, 2.2, 3.3);
      glow(ctx, MODEL_C.x, MODEL_C.y, 330, '#FFC97A', 0.18 * faceA + 0.1 * wire);
      if (faceA > 0) drawMeshSolid(ctx, mesh, proj, MATS, faceA);
      drawMeshWire(ctx, mesh, proj, wire, '#FFD892', 5, 0.18 * (1 - faceA * 0.6));
      drawMeshWire(ctx, mesh, proj, wire, '#FFE8B8', 1.8, 1 - faceA * 0.7);
      const nV = mesh.V.length;
      for (let i = 0; i < 110; i++) {
        const t0 = 1.35 + hash(i * 1.3) * 0.7, u = E.io3(seg(lt, t0, t0 + 0.85));
        if (u <= 0 || lt > 3.6 + hash(i) * 0.3) continue;
        const tgt = proj.P[(i * 7) % nV];
        const ang = hash(i * 2.7) * TAU, R0 = 520 + hash(i * 5.1) * 420;
        const sx0 = MODEL_C.x + Math.cos(ang) * R0, sy0 = MODEL_C.y + Math.sin(ang) * R0 * 0.6;
        const sw = (1 - u) * 2.6;
        const dx = (sx0 - tgt.x) * (1 - u), dy = (sy0 - tgt.y) * (1 - u);
        const x = tgt.x + dx * Math.cos(sw) - dy * Math.sin(sw), y = tgt.y + dx * Math.sin(sw) + dy * Math.cos(sw);
        glow(ctx, x, y, 14, '#FFD28A', 0.5);
        ctx.fillStyle = '#FFF6E0';
        ctx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
      }
      if (wire > 0 && faceA < 1) {
        ctx.fillStyle = rgba('#FFF4DA', 0.9 * (1 - faceA));
        for (const p of proj.P) ctx.fillRect(p.x - 2.2, p.y - 2.2, 4.4, 4.4);
      }
      const done = seg(lt, 3.75, 4.3);
      if (done > 0) {
        burst(ctx, MODEL_C.x, MODEL_C.y - 40, 380 * E.out3(done), 16, '#FFE6B0', 0.5 * (1 - done), lt * 0.3, 0.05);
        for (let k = 0; k < 6; k++) twinkle(ctx, MODEL_C.x + Math.cos(k * 1.1) * 190 * (0.6 + hash(k)), MODEL_C.y + Math.sin(k * 2.3) * 200, 22 * bump(done, k * 0.1, 0.5 + k * 0.08), '#FFFFFF', 0.9);
        ctx.globalAlpha = seg(lt, 4.0, 4.3);
        ctx.fillStyle = 'rgba(20,24,40,0.65)';
        roundRect(ctx, MODEL_C.x + 170, 730, 250, 44, 22);
        ctx.fill();
        ctx.fillStyle = '#FFE3B0';
        ctx.font = `600 21px ${FONT_MONO}`;
        ctx.fillText(`pagoda.glb \u00b7 ${MODEL.mesh.F.length} faces`, MODEL_C.x + 188, 759);
        ctx.globalAlpha = 1;
      }
      drawClawd(ctx, modelWinPose(lt));
    }
  });
  layer(ctx, cam, 1.1, () => {
    lantern(ctx, 420, 30, 1.0, lt, 1);
    lantern(ctx, 1700, 50, 0.9, lt, 2);
  });
  layer(ctx, cam, 1.25, () => {
    for (const [x, y, h, lean, sd] of MODEL.bamboo) bamboo(ctx, x, y, h, lean, '#15282A', '#1D3A36', sd, lt);
  });
  flash(ctx, lt, 1.25, 0.24);
}

// ======================================================= 5. HUMANITY'S HARDEST PROBLEMS (17.5 - 25 s)
const SOLVE = {
  far: makeRange(41, { base: 840, hMin: 120, hMax: 300, wMin: 60, wMax: 150, count: 16, rough: 10 }),
  clouds: (() => {
    const R = rng(4141), blobs = [];
    for (let i = 0; i < 70; i++) {
      const x = -200 + R() * (W + 400), y = -60 + R() * 420;
      blobs.push({ x, y, r: 110 + R() * 190, side: x < W / 2 ? -1 : 1, d: R() });
    }
    return blobs;
  })(),
  rock: [[-100, 1200], [-100, 860], [80, 842], [240, 826], [420, 818], [560, 815], [700, 820], [772, 836], [812, 872], [850, 960], [880, 1200]],
  hits: [0, 1, 2, 3].map((i) => 5 + i * 0.3125),
};
const EMB = [
  { x: 1040, y: 360, r: 118, label: 'DISEASE' },
  { x: 1390, y: 280, r: 110, label: 'CLIMATE' },
  { x: 1700, y: 470, r: 100, label: 'ENERGY' },
  { x: 1340, y: 660, r: 104, label: 'MATHEMATICS' },
];
const SPARK_PT = { x: 640, y: 540 };
const EARTH_LAND = Array.from({ length: 26 }, (_, i) => [hash(i * 2.3) * TAU, (hash(i * 3.7) - 0.5) * 2.2, 0.18 + hash(i * 5.9) * 0.3]);

function medallion(ctx, e, heal, a) {
  const col = mix('#8A5048', '#9A4F22', heal);
  glow(ctx, e.x, e.y, e.r * 1.7, heal > 0 ? '#FFD28C' : '#B0413A', (0.18 + 0.3 * heal) * a);
  ctx.strokeStyle = rgba(heal > 0.5 ? '#F9D48C' : '#B86A5E', 0.6 * a);
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 9]);
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r + 16, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.font = `700 19px ${FONT_SANS}`;
  ctx.letterSpacing = '5px';
  ctx.textAlign = 'center';
  ctx.fillText(e.label + (heal > 0.9 ? '  \u2713' : ''), e.x + 3, e.y + e.r + 50);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

function dna(ctx, e, t, heal, a) {
  const h = 230, w = 44, n = 20;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.lineCap = 'round';
  for (let i = 0; i <= n; i++) {
    const u = i / n, yy = e.y - h / 2 + u * h, ph = u * TAU * 1.5 + t * 2.4;
    if (hash(i * 3.7) < 0.45 * (1 - heal)) continue;
    ctx.strokeStyle = mix('#6E6874', '#FFE2A0', heal, 0.9);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(e.x + Math.sin(ph) * w, yy);
    ctx.lineTo(e.x - Math.sin(ph) * w, yy);
    ctx.stroke();
  }
  for (const sg of [1, -1]) {
    ctx.strokeStyle = sg > 0 ? mix('#8C5550', '#FFB85C', heal) : mix('#646070', '#F2865A', heal);
    ctx.lineWidth = 7;
    ctx.beginPath();
    let pen = false;
    for (let k = 0; k <= 70; k++) {
      const u = k / 70, yy = e.y - h / 2 + u * h, ph = u * TAU * 1.5 + t * 2.4;
      const gap = hash(Math.floor(u * 11) + sg * 17) < 0.35 * (1 - heal);
      const xx = e.x + sg * Math.sin(ph) * w + (1 - heal) * vnoise(u * 20 + t * 3, sg) * 6;
      if (gap) { pen = false; continue; }
      if (pen) ctx.lineTo(xx, yy);
      else { ctx.moveTo(xx, yy); pen = true; }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function earth(ctx, e, t, heal, a) {
  const r = e.r * 0.8;
  ctx.save();
  ctx.globalAlpha = a;
  glow(ctx, e.x, e.y, r * 1.35, heal > 0 ? '#9FD8FF' : '#C0604A', 0.35);
  const og = ctx.createRadialGradient(e.x - r * 0.35, e.y - r * 0.35, r * 0.1, e.x, e.y, r);
  og.addColorStop(0, mix('#7A7270', '#5FA8E6', heal));
  og.addColorStop(1, mix('#3E3634', '#1F4F8C', heal));
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const rot = t * 0.5;
  ctx.fillStyle = mix('#8E6246', '#6DB35A', heal);
  for (const [lon, lat, s] of EARTH_LAND) {
    const c = Math.cos(lon - rot);
    if (c < -0.1) continue;
    const x = e.x + r * Math.cos(lat * 0.7) * Math.sin(lon - rot), y = e.y - r * Math.sin(lat * 0.7);
    ctx.beginPath();
    ctx.ellipse(x, y, r * s * Math.max(0.15, c), r * s * 0.7, 0, 0, TAU);
    ctx.fill();
  }
  if (heal < 1) {
    ctx.fillStyle = `rgba(150,60,40,${0.45 * (1 - heal)})`;
    ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
  }
  const sh = ctx.createRadialGradient(e.x - r * 0.4, e.y - r * 0.4, r * 0.2, e.x, e.y, r * 1.05);
  sh.addColorStop(0, 'rgba(255,255,255,0.12)');
  sh.addColorStop(1, 'rgba(0,0,20,0.45)');
  ctx.fillStyle = sh;
  ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
  ctx.restore();
  ctx.restore();
}

function energy(ctx, e, t, heal, a) {
  ctx.save();
  ctx.globalAlpha = a;
  const r = e.r * 0.78;
  if (heal > 0) {
    glow(ctx, e.x, e.y, r * 2.2 * heal, '#FFD27A', 0.55 * heal);
    burst(ctx, e.x, e.y, r * 1.35 * heal, 16, '#FFE7A8', 0.6 * heal, t * 0.4, 0.07);
  }
  ctx.lineWidth = 2.5;
  for (let k = 0; k < 3; k++) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate((k * Math.PI) / 3 + t * 0.2);
    ctx.strokeStyle = mix('#6E6A76', '#FFD58C', heal, 0.9);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.34, 0, 0, TAU);
    ctx.stroke();
    const ea = t * (2.2 + k * 0.5) * (0.3 + heal) + k * 2;
    ctx.fillStyle = mix('#8D8994', '#FFFFFF', heal);
    ctx.beginPath();
    ctx.arc(Math.cos(ea) * r, Math.sin(ea) * r * 0.34, 5.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  const cr = lerp(12, 30, heal);
  const cg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, cr);
  cg.addColorStop(0, mix('#8F8A92', '#FFFFFF', heal));
  cg.addColorStop(1, mix('#5C5862', '#FFC25A', heal));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(e.x, e.y, cr, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function mathProof(ctx, e, t, heal, a) {
  ctx.save();
  ctx.globalAlpha = a;
  const r = e.r * 0.86;
  ctx.fillStyle = mix('#28242C', '#FFF4E0', heal, 0.55 + 0.25 * heal);
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mix('#9C94A0', '#5E3418', heal);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic 500 30px ${FONT_SERIF}`;
  ctx.fillText('\u03b6(s) = 0', e.x, e.y - 24);
  ctx.font = `italic 500 28px ${FONT_SERIF}`;
  const q = heal > 0.5 ? '\u00bd' : '?';
  ctx.fillText('\u21d2 Re(s) = ' + q, e.x, e.y + 18);
  if (heal < 0.5) {
    ctx.fillStyle = `rgba(220,90,70,${0.6 + 0.4 * Math.sin(t * 8)})`;
    ctx.font = `700 30px ${FONT_SANS}`;
    ctx.fillText('?', e.x + 70, e.y + 18);
  } else {
    ctx.fillStyle = '#C0602A';
    ctx.font = `700 26px ${FONT_SANS}`;
    ctx.fillText('\u220e', e.x + 76, e.y + 18);
  }
  ctx.restore();
}

function stormClouds(ctx, lt, part, flashA) {
  for (const b of SOLVE.clouds) {
    const off = b.side * 1100 * E.in2(part) * (0.6 + b.d * 0.6);
    const a = 1 - part;
    if (a <= 0) break;
    const x = b.x + off + Math.sin(lt * 0.3 + b.d * 9) * 20, y = b.y - part * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
    g.addColorStop(0, mix('#1C1E27', '#343846', b.d, 0.95 * a));
    g.addColorStop(1, mix('#1C1E27', '#343846', b.d, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, b.r, 0, TAU);
    ctx.fill();
    if (flashA > 0) {
      const hg = ctx.createRadialGradient(x - b.r * 0.2, y + b.r * 0.35, 0, x, y, b.r);
      hg.addColorStop(0, `rgba(200,210,255,${0.3 * flashA * a})`);
      hg.addColorStop(1, 'rgba(200,210,255,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(x, y, b.r, 0, TAU);
      ctx.fill();
    }
  }
}

function lightning(ctx, x0, y1, seed, a) {
  if (a <= 0) return;
  const R = rng(seed);
  const pts = [[x0, -20]];
  let x = x0, y = -20;
  while (y < y1) {
    y += 30 + R() * 40;
    x += (R() - 0.5) * 70;
    pts.push([x, y]);
  }
  for (const [w, al] of [[16, 0.2], [6, 0.5], [2.5, 1]]) {
    ctx.strokeStyle = `rgba(235,240,255,${al * a})`;
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  }
}

function skillIcon(ctx, kind, x, y, s, rot, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= a;
  if (kind === 0) drawPage(ctx, 0, 0, 0, s * 0.55, 2);
  else if (kind === 1) {
    ctx.fillStyle = '#2B2E3C';
    roundRect(ctx, -34 * s, -22 * s, 68 * s, 44 * s, 10 * s);
    ctx.fill();
    ctx.fillStyle = '#FFB27A';
    ctx.font = `700 ${Math.round(26 * s)}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('</>', 0, 1);
  } else {
    ctx.strokeStyle = '#FFE0A8';
    ctx.lineWidth = 2.5;
    const q = 20 * s;
    ctx.strokeRect(-q, -q * 0.6, q * 1.4, q * 1.4);
    ctx.strokeRect(-q * 0.6, -q, q * 1.4, q * 1.4);
    ctx.beginPath();
    ctx.moveTo(-q, -q * 0.6); ctx.lineTo(-q * 0.6, -q);
    ctx.moveTo(q * 0.4, -q * 0.6); ctx.lineTo(q * 0.8, -q);
    ctx.moveTo(-q, q * 0.8); ctx.lineTo(-q * 0.6, q * 0.4);
    ctx.moveTo(q * 0.4, q * 0.8); ctx.lineTo(q * 0.8, q * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

function solvePose(lt) {
  const p = { x: 600, y: 818, s: 30, fid: 1, t: lt, facing: 1, band: true, wind: 0.95, mood: 'normal', armL: [0.1, 1], armR: [0.1, 1], legs: {} };
  p.lookX = lt < 1.1 ? 0.3 : 1;
  p.lookY = lt < 1.1 ? 0 : -0.8;
  p.blink = blinkAt(lt, [0.58, 1.95], 0.2);
  p.sq = 1 + Math.sin(lt * 3) * 0.015;
  if (lt > 1.75) p.mood = 'determined';
  if (lt >= 2.5 && lt < 5) {
    const c = seg(lt, 2.5, 2.8), raise = E.io2(seg(lt, 3.35, 3.8));
    p.legs = { spread: 0.7 * c };
    p.sq = 1 - 0.1 * c + raise * 0.06 + Math.sin(lt * 60) * 0.01 * seg(lt, 3.8, 5);
    p.armL = [lerp(-0.55, 1.2, raise), lerp(1.2, 1.55, raise)];
    p.armR = [lerp(-0.55, 1.2, raise), lerp(1.2, 1.55, raise)];
    p.lookX = 0.3;
    p.lookY = -1;
    p.glow = seg(lt, 2.9, 5);
    p.x += Math.sin(lt * 70) * 1.5 * seg(lt, 4, 5);
  }
  if (lt >= 5) {
    const j = seg(lt, 5.25, 5.75);
    p.lift = hop(j) * 70;
    p.legs = { tuck: j > 0 && j < 1 ? 0.5 : 0 };
    p.armL = [1.25, 1.6];
    p.armR = [1.25, 1.6];
    p.mood = lt > 5.15 ? 'happy' : 'determined';
    p.glow = lerp(1, 0.5, seg(lt, 5, 6));
    p.wind = lerp(0.95, 0.4, seg(lt, 5, 6.5));
    p.emblem = seg(lt, 5.4, 5.9);
    p.blush = seg(lt, 5.6, 6);
    p.sq = 1 - 0.15 * bump(lt, 5.75, 5.9) + 0.06 * bump(lt, 5.25, 5.4);
    p.lookX = 0;
    p.lookY = -0.2;
  }
  return p;
}

// The range fades out at its foot, so the disc is clipped to the sky above the ridge.
function dawnSun(ctx, ridge, x, y, r, a) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, r * 5.5, '#FF9E4A', 0.3 * a);
  glow(ctx, x, y, r * 2.2, '#FFE2A6', 0.35 * a);
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(ridge.x0, -H);
  for (let i = 0; i < ridge.pts.length; i += 2) ctx.lineTo(ridge.pts[i], ridge.pts[i + 1]);
  ctx.lineTo(ridge.x1, -H);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
  g.addColorStop(0, `rgba(255,254,247,${a})`);
  g.addColorStop(0.6, `rgba(255,244,214,${a})`);
  g.addColorStop(1, `rgba(255,212,142,${a})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawSolve(ctx, lt) {
  const dawn = E.io2(seg(lt, 5.1, 6.4));
  const cam = { x: kf(lt, [[0, 960], [2.5, 900], [5, 860], [7.5, 940]]), y: kf(lt, [[0, 540], [5, 560], [7.5, 540]]), zoom: kf(lt, [[0, 1.0], [2.5, 1.04], [5, 1.1], [5.6, 0.98, E.out3], [7.5, 1.0]]) };
  Object.assign(cam, shake(lt, 8 * seg(lt, 3.3, 5) * (lt < 5 ? 1 : 0) + 18 * bump(lt, 5, 5.35), 42, 8));
  const f1 = bump(lt, 0.58, 0.8), f2 = bump(lt, 1.9, 2.12);
  const flashA = Math.max(f1, f2);
  sky(ctx, [
    [0, mix('#15171E', '#E7AE78', dawn)],
    [0.5, mix('#23262F', '#F3C68E', dawn)],
    [1, mix('#363843', '#FAE0B2', dawn)],
  ]);
  if (flashA > 0) {
    ctx.fillStyle = `rgba(190,200,240,${0.35 * flashA})`;
    ctx.fillRect(0, 0, W, H);
  }
  layer(ctx, cam, 0.1, () => {
    lightning(ctx, 1520, 640, 7, f1);
    lightning(ctx, 1020, 600, 13, f2);
  });
  layer(ctx, cam, 0.3, () => {
    const sunY = lerp(930, 650, E.out2(seg(lt, 5.2, 7.5)));
    if (dawn > 0) dawnSun(ctx, SOLVE.far, 905, sunY, 105, dawn);
    drawRange(ctx, SOLVE.far, mix('#2A2D37', '#A4867A', dawn), mix('#2A2D37', '#F3D8B4', dawn, 0));
    if (dawn > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 905, sunY, 200, '#FFE9C0', 0.22 * dawn);
      ctx.restore();
    }
    mist(ctx, 840, 70, mixHex('#4A4D5A', '#FFF1DC', dawn), 0.4 + 0.3 * dawn, lt, 16, 13);
  });
  layer(ctx, cam, 0.55, () => {
    stormClouds(ctx, lt, E.io2(seg(lt, 5.1, 6.6)), flashA);
    const appear = (i) => E.out2(seg(lt, 0.25 + i * 0.28, 0.75 + i * 0.28));
    EMB.forEach((e, i) => {
      const a = appear(i);
      if (a <= 0) return;
      const heal = E.io2(seg(lt, SOLVE.hits[i], SOLVE.hits[i] + 0.55));
      const jit = (1 - heal) * 2;
      const ee = { ...e, x: e.x + vnoise(lt * 6, i) * jit, y: e.y + vnoise(lt * 6, i + 5) * jit };
      medallion(ctx, ee, heal, a);
      if (i === 0) dna(ctx, ee, lt, heal, a);
      else if (i === 1) earth(ctx, ee, lt, heal, a);
      else if (i === 2) energy(ctx, ee, lt, heal, a);
      else mathProof(ctx, ee, lt, heal, a);
    });
  });
  layer(ctx, cam, 0.92, () => pagoda(ctx, 250, 836, 1.3, mix('#121318', '#4A3A33', dawn), { lit: 0.25 + 0.6 * dawn }));
  layer(ctx, cam, 1, () => {
    ctx.beginPath();
    SOLVE.rock.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, 810, 0, 1080);
    rg.addColorStop(0, mix('#23242C', '#6A5246', dawn));
    rg.addColorStop(1, mix('#101116', '#3A2C26', dawn));
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.strokeStyle = mix('#3C3F4C', '#F6C27E', dawn);
    ctx.lineWidth = 4;
    ctx.beginPath();
    SOLVE.rock.slice(1, 9).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    pine(ctx, 790, 846, 0.55, mix('#15161B', '#3E2E27', dawn), 9, lt);

    const pose = solvePose(lt);
    if (lt >= 2.5 && lt < 5.2) {
      const e = E.in3(seg(lt, 2.6, 4.6));
      for (let k = 0; k < 9; k++) {
        const th = (k / 9) * TAU + (lt - 2.5) * (3 + 5 * e);
        const r = lerp(330, 0, e);
        const a = seg(lt, 2.55 + k * 0.05, 2.8 + k * 0.05) * (1 - seg(lt, 4.5, 4.7));
        skillIcon(ctx, k % 3, SPARK_PT.x + Math.cos(th) * r, SPARK_PT.y + 60 + Math.sin(th) * r * 0.55, 1 - e * 0.5, th * 0.2, a);
      }
      const st = seg(lt, 3.0, 5);
      if (st > 0) {
        ctx.fillStyle = rgba('#FFE2B0', 0.8 * st);
        for (let i = 0; i < 70; i++) {
          const ang = hash(i * 1.9) * TAU, ph = (lt * (1.1 + hash(i) * 0.8) + hash(i * 4.4)) % 1;
          const R = (1 - ph) * (500 + hash(i * 2.2) * 400);
          const x = SPARK_PT.x + Math.cos(ang) * R, y = SPARK_PT.y + Math.sin(ang) * R;
          ctx.fillRect(x - 2, y - 2, 4 + (1 - ph) * 12 * Math.abs(Math.cos(ang)), 4);
        }
      }
      const sr = 78 * E.out3(seg(lt, 3.6, 4.9)) + 6 * Math.sin(lt * 20) * seg(lt, 4.2, 5);
      if (sr > 1) {
        glow(ctx, SPARK_PT.x, SPARK_PT.y, sr * 4, '#FFC47A', 0.6);
        spark(ctx, SPARK_PT.x, SPARK_PT.y, sr, lt * 2.2, '#FFF2DE');
        spark(ctx, SPARK_PT.x, SPARK_PT.y, sr * 0.8, lt * 2.2, ORANGE);
      }
    }
    if (lt >= 5) {
      const sw = seg(lt, 5, 5.9);
      ring(ctx, SPARK_PT.x, SPARK_PT.y, 1500 * E.out3(sw), 30 * (1 - sw), '#FFF1D8', 0.8 * (1 - sw));
      const hold = 1 - seg(lt, 5, 5.7);
      if (hold > 0) spark(ctx, SPARK_PT.x, SPARK_PT.y, 78 + 40 * (1 - hold), lt * 2.2, rgba('#FFF2DE', hold));
      petalField(ctx, lt - 5, 40, 17, { x: 0, y: 0, w: W, h: H }, ['#F7B8C4', '#F29CAE', '#FFE0E6'], { wind: 90, fall: 70, size: 8, alpha: seg(lt, 5.4, 6) });
    }
    drawClawd(ctx, pose);
  });
  if (lt >= 5) {
    const [sx, sy] = layerToScreen(cam, 1, SPARK_PT.x, SPARK_PT.y);
    EMB.forEach((e, i) => {
      const d = lt - SOLVE.hits[i];
      if (d < 0 || d > 0.8) return;
      const grow = seg(d, 0, 0.1), fade = 1 - seg(d, 0.3, 0.8);
      const [ex, ey] = layerToScreen(cam, 0.55, e.x, e.y);
      const tx = lerp(sx, ex, grow), ty = lerp(sy, ey, grow);
      ctx.lineCap = 'round';
      for (const [w, al, c] of [[26, 0.25, '#FFC878'], [10, 0.6, '#FFE6B8'], [3.5, 1, '#FFFFFF']]) {
        ctx.strokeStyle = rgba(c, al * fade);
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      if (grow >= 1) burst(ctx, ex, ey, 150 * (0.6 + 0.4 * fade), 14, '#FFF3D6', fade * 0.8, d * 2, 0.08);
    });
  }
  if (lt < 5.3) {
    ctx.save();
    ctx.strokeStyle = `rgba(190,200,220,${0.28 * (1 - seg(lt, 4.8, 5.3))})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 160; i++) {
      const x = ((hash(i * 1.3) * 2400 - lt * 520) % 2400 + 2400) % 2400 - 240;
      const y = ((hash(i * 2.1) * 1300 + lt * 1500) % 1300) - 100;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 13, y + 40);
    }
    ctx.stroke();
    ctx.restore();
  }
  if (lt >= 2.5 && lt < 5) {
    const v = seg(lt, 3, 5) * 0.45;
    const g = ctx.createRadialGradient(SPARK_PT.x, SPARK_PT.y, 200, SPARK_PT.x, SPARK_PT.y, 1400);
    g.addColorStop(0, 'rgba(10,8,14,0)');
    g.addColorStop(1, `rgba(10,8,14,${v})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  flash(ctx, lt, 5, 0.6, '#FFF9EE', 0.95);
}

// ======================================================= 6. FINALE (25 - 30 s)
const FINALE = {
  far: makeRange(51, { base: 780, hMin: 120, hMax: 300, wMin: 60, wMax: 140, count: 14, rough: 8 }),
  mid: makeRange(52, { base: 830, hMin: 60, hMax: 170, wMin: 60, wMax: 130, count: 10, rough: 8 }),
  blossoms: (() => {
    const R = rng(5151), out = [];
    const branch = (t) => [lerp(-60, 720, t), 150 - Math.sin(t * Math.PI * 0.9) * 90 + t * -20];
    for (let i = 0; i < 46; i++) {
      const t = 0.08 + R() * 0.9;
      const [bx, by] = branch(t);
      out.push({ x: bx + (R() - 0.5) * 120 * (0.4 + t), y: by + (R() - 0.3) * 80, r: 9 + R() * 9, rot: R() * TAU, c: Math.floor(R() * 3), open: R() < 0.8 ? 1 : 0.45 });
    }
    return out;
  })(),
};

function cloudBand(ctx, y, amp, c1, c2, t, speed, seed) {
  ctx.beginPath();
  ctx.moveTo(-400, H + 80);
  for (let x = -400; x <= W + 400; x += 14) {
    const xx = x + t * speed;
    ctx.lineTo(x, y - Math.abs(Math.sin(xx * 0.006 + seed)) * amp - Math.abs(Math.sin(xx * 0.014 + seed * 2)) * amp * 0.5 - fbm(xx * 0.004, seed) * amp * 0.4);
  }
  ctx.lineTo(W + 400, H + 80);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y - amp * 1.7, 0, y + 140);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fill();
}

function blossom(ctx, x, y, r, rot, col, open) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = col;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r * 0.55 * open, Math.sin(a) * r * 0.55 * open, r * 0.5 * open + 1, r * 0.42 * open + 1, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#B83A55';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function peachBranch(ctx, t) {
  ctx.strokeStyle = '#3F2A22';
  ctx.lineCap = 'round';
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const u = i / 20;
    pts.push([lerp(-60, 720, u), 150 - Math.sin(u * Math.PI * 0.9) * 90 - u * 20 + Math.sin(t * 0.8) * 3 * u]);
  }
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = lerp(30, 5, i / pts.length);
    ctx.beginPath();
    ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
    ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  for (const [i, dx, dy, w] of [[5, 80, -90, 10], [9, 120, 70, 8], [12, 60, -80, 7], [15, 110, 50, 6], [3, 40, 90, 9]]) {
    const [x, y] = pts[i];
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dx * 0.5, y + dy * 0.2, x + dx, y + dy);
    ctx.stroke();
  }
  const cols = ['#F6B3C2', '#F09AB0', '#FCD9E1'];
  for (const b of FINALE.blossoms) blossom(ctx, b.x, b.y + Math.sin(t * 0.8) * 3 * (b.x / 720), b.r, b.rot + t * 0.1, cols[b.c], b.open);
}

function finalePose(lt) {
  const opened = lt > 1.75;
  return {
    x: 1235, y: 731, s: 24, lift: 12 + Math.sin(lt * 1.7) * 5, shadow: 0, fid: 1, t: lt, facing: 1, band: true, wind: 0.25,
    mood: opened ? 'happy' : 'closed', blush: opened ? 0.7 * seg(lt, 1.75, 2.1) : 0, emblem: 0.9,
    armL: [-0.95, 0.95], armR: [-0.95, 0.95], legs: { tuck: 1 }, glow: 0.55, sq: 1 + Math.sin(lt * 1.7) * 0.012,
  };
}

function finaleTitle(ctx, lt) {
  const a0 = E.out3(seg(lt, 0.6, 1.3)), a1 = E.out3(seg(lt, 0.9, 1.9)), a2 = E.out3(seg(lt, 2.0, 2.8));
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = a0;
  ctx.fillStyle = '#7A5A46';
  ctx.font = `600 22px ${FONT_SANS}`;
  ctx.letterSpacing = '8px';
  ctx.fillText('SINCE MARCH 2023', 236, 392);
  ctx.globalAlpha = a1;
  spark(ctx, 270, 470, 44 * (0.7 + 0.3 * a1), lt * 0.25, ORANGE);
  ctx.fillStyle = '#2A211C';
  ctx.font = `500 124px ${FONT_SERIF}`;
  ctx.letterSpacing = `${lerp(22, 0, a1).toFixed(1)}px`;
  ctx.fillText('Claude', 334, 512);
  ctx.globalAlpha = a2;
  ctx.fillStyle = '#5A4436';
  ctx.font = `italic 400 46px ${FONT_SERIF}`;
  ctx.letterSpacing = '0px';
  ctx.fillText('This is only the beginning.', 240, 592);
  ctx.restore();
}

function drawFinale(ctx, lt) {
  const cam = { x: kf(lt, [[0, 1000], [5, 1040]]), y: 560, zoom: kf(lt, [[0, 1.0], [5, 1.06]]) };
  sky(ctx, [[0, '#EFCB97'], [0.5, '#F7D3A0'], [1, '#FCE8C6']]);
  layer(ctx, cam, 0.08, () => {
    ctx.save();
    ctx.globalAlpha = 0.28;
    spark(ctx, 1235, 610, 360, lt * 0.05, '#FFF3DA');
    ctx.restore();
    sun(ctx, 1235, 610, 170, '#FFF7E8', '#FFD9A3', 720, 0.55);
    birds(ctx, lt, 1500, 300, 3, 'rgba(90,64,48,0.5)', 21, 22);
  });
  layer(ctx, cam, 0.25, () => {
    drawRange(ctx, FINALE.far, 'rgba(176,150,142,0.9)', 'rgba(250,224,196,0)');
    cloudBand(ctx, 800, 40, 'rgba(255,246,232,0.95)', 'rgba(246,222,196,0.9)', lt, 10, 1);
  });
  layer(ctx, cam, 0.45, () => {
    drawRange(ctx, FINALE.mid, 'rgba(150,120,112,0.95)', 'rgba(240,210,186,0)');
    cloudBand(ctx, 880, 48, 'rgba(255,248,236,0.98)', 'rgba(242,214,186,0.95)', lt, 16, 2.4);
  });
  layer(ctx, cam, 1, () => {
    finaleRock(ctx, lt);
    cloudBand(ctx, 1010, 60, 'rgba(255,249,240,0.97)', 'rgba(245,220,196,0.97)', lt, 22, 4.1);
    glow(ctx, 1235, 712, 120, '#FFE7C0', 0.35);
    drawClawd(ctx, finalePose(lt));
  });
  layer(ctx, cam, 1.15, () => peachBranch(ctx, lt));
  petalField(ctx, lt + 3, 26, 29, { x: 0, y: 0, w: W, h: H }, ['#F7B8C4', '#F29CAE', '#FFE0E6'], { wind: 60, fall: 55, size: 8 });
  const fade = 0.62 * E.io2(seg(lt, 3.9, 5));
  if (fade > 0) {
    ctx.fillStyle = `rgba(248,240,226,${fade})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.save();
  ctx.globalAlpha = seg(lt, 0.4, 1.4);
  ctx.translate(560, 495);
  ctx.scale(1, 0.4);
  const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, 640);
  wash.addColorStop(0, 'rgba(252,238,212,0.62)');
  wash.addColorStop(1, 'rgba(252,238,212,0)');
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(0, 0, 640, 0, TAU);
  ctx.fill();
  ctx.restore();
  finaleTitle(ctx, lt);
}

// Karst pinnacle with a flat, sunlit top.
const ROCK = [[990, 1220], [1018, 1010], [1030, 900], [1016, 840], [1040, 772], [1082, 730], [1150, 713], [1320, 711], [1382, 724], [1418, 762], [1436, 832], [1428, 905], [1452, 1010], [1500, 1220]];
function finaleRock(ctx, lt) {
  ctx.beginPath();
  ctx.moveTo(ROCK[0][0], ROCK[0][1]);
  for (let i = 1; i < ROCK.length - 1; i++) {
    const [x, y] = ROCK[i], [nx, ny] = ROCK[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  ctx.lineTo(ROCK[ROCK.length - 1][0], ROCK[ROCK.length - 1][1]);
  ctx.closePath();
  const rg = ctx.createLinearGradient(1000, 700, 1460, 1000);
  rg.addColorStop(0, '#8A7064');
  rg.addColorStop(0.55, '#5E4A41');
  rg.addColorStop(1, '#3E302A');
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,28,22,0.3)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const x = 1040 + hash(i * 2.7) * 380, y = 760 + hash(i * 5.3) * 200;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 14, y + 60, x - 6 + hash(i) * 20, y + 110 + hash(i * 3) * 80);
  }
  ctx.stroke();
  const shade = ctx.createLinearGradient(1250, 0, 1460, 0);
  shade.addColorStop(0, 'rgba(30,20,16,0)');
  shade.addColorStop(1, 'rgba(30,20,16,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(1250, 700, 260, 520);
  ctx.restore();
  ctx.strokeStyle = '#FFD7A0';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(1040, 772);
  ctx.quadraticCurveTo(1082, 730, 1150, 713);
  ctx.lineTo(1320, 711);
  ctx.quadraticCurveTo(1382, 724, 1418, 762);
  ctx.stroke();
  ctx.strokeStyle = '#4E5A38';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const x = 1060 + i * 23 + hash(i) * 8;
    if (Math.abs(x - 1235) < 70) continue;
    const y = x < 1150 ? 713 + (1150 - x) * 0.4 : x > 1320 ? 711 + (x - 1320) * 0.5 : 711;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3 + Math.sin(lt * 1.2 + i) * 2, y - 9 - hash(i * 3) * 8);
  }
  ctx.stroke();
  pine(ctx, 1030, 840, 0.34, '#3A2C25', 31, lt);
}

// ======================================================= HUD, sequencing, finishing
const YEARS = [[0, '2023'], [4.375, '2024'], [9.375, '2025'], [13.75, '2026']];
export const CHAPTERS = [
  { t: 2.5, num: 'I', title: 'Searching the internet', seal: '\u641c' },
  { t: 7.5, num: 'II', title: 'Writing code', seal: '\u7801' },
  { t: 12.5, num: 'III', title: 'Creating 3D models', seal: '\u5851' },
  { t: 17.5, num: 'IV', title: 'Solving humanity\u2019s hardest problems', seal: '\u89e3' },
];

function paperBand(ctx, x0, y0, x1, y1, seed, reveal) {
  const xr = lerp(x0, x1, reveal);
  ctx.beginPath();
  ctx.moveTo(x0 + vnoise(1, seed) * 8, y0 + 6);
  for (let x = x0; x <= xr; x += 18) ctx.lineTo(x, y0 + vnoise(x * 0.03, seed) * 5);
  for (let y = y0; y <= y1; y += 10) ctx.lineTo(xr + vnoise(y * 0.2, seed + 2) * 10 * (1 - reveal * 0.4), y);
  for (let x = xr; x >= x0; x -= 18) ctx.lineTo(x, y1 + vnoise(x * 0.03, seed + 4) * 5);
  ctx.lineTo(x0 + vnoise(2, seed) * 8, y1 - 6);
  ctx.closePath();
  ctx.fillStyle = 'rgba(248,241,227,0.93)';
  ctx.fill();
}

function chapterTitle(ctx, ch, lt, i) {
  const aIn = E.out3(seg(lt, 0.12, 0.5)), aOut = 1 - seg(lt, 1.8, 2.15);
  if (aIn <= 0 || aOut <= 0) return;
  const x = 108, y = 96;
  ctx.save();
  ctx.globalAlpha = aOut;
  ctx.font = `500 ${ch.title.length > 24 ? 44 : 50}px ${FONT_SERIF}`;
  const tw = ctx.measureText(ch.title).width;
  paperBand(ctx, x - 24, y - 16, x + 120 + tw + 36, y + 104, 30 + i, aIn);
  ctx.clip();
  ctx.globalAlpha = aOut * clamp(aIn * 1.4 - 0.2);
  seal(ctx, x + 40, y + 44, 80, ch.seal, { font: `700 46px ${FONT_CJK}`, rot: -0.04, scale: lerp(1.3, 1, aIn) });
  ctx.fillStyle = '#7A6250';
  ctx.font = `600 19px ${FONT_SANS}`;
  ctx.letterSpacing = '6px';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('CHAPTER ' + ch.num, x + 106, y + 26);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#211A15';
  ctx.font = `500 ${ch.title.length > 24 ? 44 : 50}px ${FONT_SERIF}`;
  ctx.fillText(ch.title, x + 104, y + 78);
  ctx.restore();
}

function introTitle(ctx, t) {
  const aIn = E.out3(seg(t, 0.3, 0.75)), aOut = 1 - seg(t, 2.05, 2.45);
  if (aIn <= 0 || aOut <= 0) return;
  const x = 108, y = 96;
  ctx.save();
  ctx.globalAlpha = aOut;
  paperBand(ctx, x - 24, y - 16, x + 360, y + 104, 21, aIn);
  ctx.clip();
  ctx.globalAlpha = aOut * clamp(aIn * 1.4 - 0.2);
  ctx.fillStyle = '#7A6250';
  ctx.font = `600 19px ${FONT_SANS}`;
  ctx.letterSpacing = '6px';
  ctx.fillText('MARCH 2023', x + 4, y + 26);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#211A15';
  ctx.font = `italic 500 56px ${FONT_SERIF}`;
  ctx.fillText('Day one.', x, y + 82);
  ctx.restore();
}

function yearSeal(ctx, t) {
  let idx = 0;
  for (let i = 0; i < YEARS.length; i++) if (t >= YEARS[i][0]) idx = i;
  const since = t - YEARS[idx][0];
  const stamp = idx === 0 ? seg(t, 0.35, 0.6) : seg(since, 0, 0.22);
  const alpha = (idx === 0 ? clamp(stamp * 3) : 1) * (1 - seg(t, 24.5, 25.1));
  if (alpha <= 0) return;
  const sc = lerp(1.5, 1, E.outBack(stamp));
  if (idx > 0 && since < 0.35) {
    ctx.save();
    ctx.globalAlpha = 1 - since / 0.35;
    seal(ctx, 1806, 110, 100, YEARS[idx - 1][1], { rot: -0.05, font: `700 31px ${FONT_SERIF}` });
    ctx.restore();
  }
  seal(ctx, 1806, 110, 100, YEARS[idx][1], { alpha, scale: sc, rot: -0.05, font: `700 31px ${FONT_SERIF}` });
}

let grainPat = null;
function grain(ctx, t) {
  if (!grainPat) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    const R = rng(99);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (R() - 0.5) * 200;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainPat = ctx.createPattern(c, 'repeat');
  }
  const f = Math.floor(t * 24);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.translate(-Math.floor(hash(f) * 256), -Math.floor(hash(f + 7) * 256));
  ctx.fillStyle = grainPat;
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}

function vignette(ctx, a) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(24,14,8,0)');
  g.addColorStop(1, `rgba(24,14,8,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

const SCENES = [
  { start: 0, end: 2.5, draw: drawIntro },
  { start: 2.5, end: 7.5, draw: drawSearch, trans: 'wipe', seed: 1 },
  { start: 7.5, end: 12.5, draw: drawCode, trans: 'wipe', seed: 2 },
  { start: 12.5, end: 17.5, draw: drawModel, trans: 'wipe', seed: 3 },
  { start: 17.5, end: 25, draw: drawSolve, trans: 'wipe', seed: 4 },
  { start: 25, end: 30.01, draw: drawFinale, trans: 'dip' },
];
const TRANS = 0.42;

export function renderFrame(ctx, t) {
  t = clamp(t, 0, DURATION);
  let i = SCENES.length - 1;
  for (let k = 0; k < SCENES.length; k++) {
    if (t < SCENES[k].end) { i = k; break; }
  }
  const sc = SCENES[i], lt = t - sc.start, prev = SCENES[i - 1], next = SCENES[i + 1];
  const dipOut = next && next.trans === 'dip' ? seg(t, next.start - 0.3, next.start) : 0;
  const dipIn = prev && sc.trans === 'dip' ? 1 - seg(lt, 0, 0.45) : 0;
  if (dipOut > 0 || dipIn > 0) {
    // dip to warm white across the cut: out over the last 0.3 s of a shot, back in over 0.45 s
    ctx.save();
    sc.draw(ctx, lt);
    ctx.restore();
    ctx.fillStyle = `rgba(255,247,234,${0.92 * E.io2(Math.max(dipOut, dipIn))})`;
    ctx.fillRect(0, 0, W, H);
  } else if (prev && sc.trans === 'wipe' && lt < TRANS) {
    const e = E.io2(lt / TRANS);
    ctx.save();
    prev.draw(ctx, t - prev.start);
    ctx.restore();
    ctx.save();
    wipePath(ctx, e, sc.seed);
    ctx.clip();
    sc.draw(ctx, lt);
    ctx.restore();
    wipeInk(ctx, e, sc.seed);
  } else {
    ctx.save();
    sc.draw(ctx, lt);
    ctx.restore();
  }
  vignette(ctx, t > 25 ? 0.16 : 0.3);
  yearSeal(ctx, t);
  if (t < 2.5) introTitle(ctx, t);
  CHAPTERS.forEach((ch, k) => {
    const l = t - ch.t;
    if (l > 0 && l < 2.3) chapterTitle(ctx, ch, l, k);
  });
  grain(ctx, t);
  if (t < 0.3) {
    ctx.fillStyle = `rgba(12,10,8,${1 - t / 0.3})`;
    ctx.fillRect(0, 0, W, H);
  }
}

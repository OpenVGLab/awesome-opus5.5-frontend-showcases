'use strict';
// Scenes 1–3 (the question, "to have more?", the stars) and the paper transitions between scenes.

const SD = {};
const GY = { s1: 905, s2: 882, s4: 885, s7: 908 };
const STACK = ['money', 'tv', 'car', 'house', 'trophy', 'bag', 'phone', 'gem', 'crown'];
const ITEM_SCALE = 0.8;
const PIP2_S = 1.15;
// scene 2 camera tilts up to follow the growing pile, then drops back down after the tumble
const camY2 = (t) => 175 * E.inOut(prog(t, 10.3, 12.0)) * (1 - E.inOut(prog(t, 12.7, 13.35)));

function doodle(ctx, d, p, col = 'rgba(255,250,238,0.88)', w = 3.2) {
  if (p <= 0) return;
  const seed = (d.x * 7 + d.y) | 0;
  if (d.k === 'star') doodleStar(ctx, d.x, d.y, d.r, col, w, seed, p);
  else if (d.k === 'sparkle') { if (p > 0.25) sparkle(ctx, d.x, d.y, d.r * E.back(prog(p, 0.25, 1)), col, w, seed); }
  else if (d.k === 'spiral') inkLine(ctx, upto(spiralPts(d.x, d.y, d.r, 2.3, 50), p), w, col, seed, 0.8);
  else if (d.k === 'heart') { const pts = heartPts(d.r, 40, d.x, d.y); pts.push(pts[0]); inkLine(ctx, upto(pts, p), w, col, seed, 0.8); }
  else if (d.k === 'loop') {
    const pts = [];
    for (let i = 0; i <= 70; i++) { const a = i / 70; pts.push([d.x + a * 230 + Math.cos(a * 19) * 24, d.y + Math.sin(a * 19) * 24 + a * 24]); }
    inkLine(ctx, upto(pts, p), w, col, seed, 0.8);
  } else if (d.k === 'dots') {
    for (let i = 0; i < 9; i++) if (i / 9 < p) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(d.x + i * 26, d.y - Math.sin(i * 0.5) * 30, w * 0.9, 0, TAU); ctx.fill(); }
  }
}

function tuft(ctx, x, y, col = '#3e7a3c', k = 1) {
  inkLine(ctx, [[x - 9 * k, y], [x - 13 * k, y - 14 * k]], 2.6, col, x | 0, 0.5);
  inkLine(ctx, [[x, y], [x + 1, y - 19 * k]], 2.6, col, (x | 0) + 1, 0.5);
  inkLine(ctx, [[x + 9 * k, y], [x + 14 * k, y - 13 * k]], 2.6, col, (x | 0) + 2, 0.5);
}

function sunFace(ctx, x, y, k) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 28, -8, 10, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 8, 22, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  ctx.fillStyle = 'rgba(232,96,70,0.45)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 48, 12, 12, 8, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function glow(ctx, x, y, r, col, a) {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${col},${a})`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function toLocal(p, wx, wy) {
  const s = p.s || 1, f = p.face || 1;
  const x = (wx - (p.x || 0)) / (s * f), y = (wy - (p.y || 0) - (p.bob || 0)) / s;
  const c = Math.cos(-(p.lean || 0)), sn = Math.sin(-(p.lean || 0));
  return { x: x * c - y * sn, y: x * sn + y * c - (p.sit || 0) * 40 };
}

function polyY(pts, x) {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] >= x) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0 || 1));
    }
  }
  return pts[pts.length - 1][1];
}

// ============================================================ scene 1 — the question

function build1() {
  const s = (SD.s1 = {});
  s.scraps = [
    { p: P.rect(460, 270, { torn: 6, rim: 3.5, seed: 101 }), f: 'teal', x: 120, y: 105, r: -0.2, t: 0.05, fx: -500, fy: -300 },
    { p: P.rect(330, 220, { cut: 1, seed: 102 }), f: 'news', x: 1790, y: 150, r: 0.13, t: 0.12, fx: 2400, fy: -250, tape: [-10, -104, 0.12] },
    { p: P.ellipse(165, 165, { torn: 6, rim: 3.5, seed: 103 }), f: 'mustard', x: 1830, y: 955, r: 0.2, t: 0.2, fx: 2400, fy: 1500 },
    { p: P.rect(430, 250, { torn: 6, rim: 3.5, seed: 104 }), f: 'pink', x: 110, y: 985, r: 0.12, t: 0.26, fx: -500, fy: 1500 },
    { p: P.rect(230, 150, { cut: 1, seed: 105 }), f: 'dotsCoral', x: 380, y: 60, r: 0.07, t: 0.32, fx: 360, fy: -300, tape: [0, -70, -0.06] },
    { p: P.rect(210, 130, { cut: 1, seed: 106 }), f: 'grid', x: 1560, y: 52, r: -0.09, t: 0.38, fx: 1560, fy: -300 },
    { p: P.rect(250, 170, { torn: 5, rim: 3, seed: 107 }), f: 'lilac', x: 1905, y: 560, r: -0.35, t: 0.44, fx: 2400, fy: 560 },
    { p: P.rect(190, 260, { cut: 1, seed: 108 }), f: 'stripePink', x: 25, y: 560, r: 0.18, t: 0.5, fx: -400, fy: 560 },
  ];
  s.ground = P.rect(3600, 3000, { torn: 7, rim: 4, edges: [1, 0, 0, 0], seed: 109 });
  s.cap = new Caption([{ text: 'What is the purpose of life?', write: TL.s1.write }],
    { x: 960, y: 212, rot: -0.022, tIn: TL.s1.card, cap: 62, seed: 3, center: true });
  s.hmm = [new Hand('?', 42, { seed: 1 }), new Hand('?', 36, { seed: 2 }), new Hand('?', 50, { seed: 3 })];
  s.doodles = [
    { k: 'star', x: 300, y: 335, r: 24, t: 0.8 }, { k: 'star', x: 1650, y: 425, r: 18, t: 1.0 },
    { k: 'spiral', x: 1560, y: 790, r: 34, t: 1.2 }, { k: 'sparkle', x: 520, y: 470, r: 16, t: 1.4 },
    { k: 'heart', x: 1460, y: 360, r: 20, t: 1.6 }, { k: 'sparkle', x: 1720, y: 690, r: 14, t: 1.8 },
    { k: 'star', x: 430, y: 770, r: 16, t: 2.0 }, { k: 'loop', x: 230, y: 640, t: 2.2 },
  ];
}

function pip1(t) {
  const T = TL.s1;
  const up = E.back(prog(t, T.pipUp, T.pipUp + 0.35));
  const p = { x: 760, y: lerp(1215, GY.s1, up), s: 1.25, lx: 1, ly: -0.4, eyes: 'open', mouth: 'smile', sway: Math.sin(t * 3) * 0.12 };
  if (t > T.pipUp + 0.5) p.tilt = Math.sin((t - T.pipUp - 0.5) * 2.4) * 0.16;
  if (between(t, T.scratch[0], T.scratch[1])) {
    p.armR = { x: 46 + Math.sin(t * 26) * 4, y: -206 + Math.cos(t * 26) * 3, b: 12 };
    p.mouth = 'flat';
    p.lx = 0.6;
    p.ly = -0.9;
  }
  if (t >= T.shrug) {
    const k = E.back(prog(t, T.shrug, T.shrug + 0.25));
    p.armL = [lerp(0.28, 1.75, k), -16];
    p.armR = [lerp(0.28, 1.75, k), -16];
    p.mouth = 'flat';
    p.tilt = -0.14 * k;
    p.lx = 0;
    p.ly = 0;
  }
  if (between(t, 5.95, 6.05) || between(t, 7.15, 7.25)) p.eyes = 'blink';
  return p;
}

function draw1(ctx, t, view) {
  const s = SD.s1, T = TL.s1;
  bgFill(ctx, view, 'kraft');
  for (const d of s.doodles) doodle(ctx, d, prog(t, d.t, d.t + 0.5));
  for (const sc of s.scraps) {
    const a = prog(t, sc.t, sc.t + 0.45);
    if (a <= 0) continue;
    const e = E.back(a);
    at(ctx, lerp(sc.fx, sc.x, e), lerp(sc.fy, sc.y, e), sc.r + (1 - e) * 1.1, 1, () => {
      sc.p.draw(ctx, sc.f, { shadow: 1.2 });
      if (sc.tape && a >= 1) tape(ctx, sc.tape[0], sc.tape[1], sc.tape[2], 1, 0);
    });
  }
  if (t >= T.qLand - 0.25) {
    const f = prog(t, T.qLand - 0.25, T.qLand), d = t - T.qLand;
    const sq = d > 0 ? 1 - 0.2 * Math.exp(-d * 8) * Math.cos(d * 28) : 1;
    const tapes = [];
    if (t > T.qTape[0]) tapes.push([-52, -198, -0.5]);
    if (t > T.qTape[1]) tapes.push([12, 72, 0.3]);
    drawQMark(ctx, 1260, lerp(-430, 590, E.in(f)), 1.05, 0.1 + (1 - f) * 0.5, 'red', { sx: 2 - sq, sy: sq, tapes });
  }
  drawChar(ctx, LOOKS.pip, pip1(t));
  at(ctx, 960, GY.s1 + 1500, 0, 1, () => s.ground.draw(ctx, 'cream', { shadow: 1 }));
  for (let i = 0; i < 3; i++) {
    const th = T.hmm[i];
    if (t < th) continue;
    const k = E.back(prog(t, th, th + 0.2)), pos = [[680, 552, -0.3], [770, 508, 0.05], [855, 545, 0.32]][i];
    at(ctx, pos[0], pos[1] + Math.sin(t * 5 + i * 2) * 4, pos[2], k, () => s.hmm[i].draw(ctx, 0, 0, 1, { align: 0.5, w: 1.1 }));
  }
  s.cap.draw(ctx, t);
}

// ============================================================ scene 2 — to have more?

function buildItems() {
  const I = {};
  I.money = { h: 54, w: 156, L: comp([
    { rect: [-75, -18, 150, 18], f: 'money' }, { rect: [-70, -36, 150, 18], f: 'money' }, { rect: [-80, -54, 150, 18], f: 'money' },
    { rect: [-18, -57, 28, 22], f: 'cream', sh: 0.3 },
    { text: '$', tx: 40, ty: -44, font: 'bold 17px Georgia, "DejaVu Serif", serif', c: '#2f5d2a' },
  ]) };
  I.tv = { h: 110, w: 150, L: comp([
    { line: [[-10, -104], [-38, -138]], w: 3.5 }, { line: [[14, -104], [36, -140]], w: 3.5 },
    { rect: [-58, -12, 14, 12], f: 'brown' }, { rect: [44, -12, 14, 12], f: 'brown' },
    { rect: [-75, -108, 150, 98], f: 'mustard', o: { cut: 1.3 } },
    { rect: [-62, -96, 96, 72], f: 'sky', sh: 0.4 },
    { circ: [55, -80, 8], f: 'coral', sh: 0.4 }, { circ: [55, -52, 8], f: 'coral', sh: 0.4 },
    { line: [[-52, -84], [-34, -90]], w: 3, c: 'rgba(255,255,255,0.85)' },
  ]) };
  I.car = { h: 88, w: 190, L: comp([
    { svg: 'M -60 -46 L -38 -86 L 40 -86 L 62 -46 Z', f: 'coral' },
    { svg: 'M -46 -50 L -32 -78 L -4 -78 L -4 -50 Z', f: 'sky', sh: 0.3 },
    { svg: 'M 4 -50 L 4 -78 L 34 -78 L 50 -50 Z', f: 'sky', sh: 0.3 },
    { rect: [-95, -54, 190, 38], f: 'coral', o: { cut: 1.4 } },
    { rect: [80, -48, 12, 10], f: 'mustard', sh: 0.3 },
    { circ: [-52, -17, 17], f: 'navy' }, { circ: [52, -17, 17], f: 'navy' },
    { circ: [-52, -17, 7], f: 'gray', sh: 0.3 }, { circ: [52, -17, 7], f: 'gray', sh: 0.3 },
  ]) };
  I.house = { h: 150, w: 164, L: comp([
    { rect: [30, -146, 20, 40], f: 'brown' },
    { rect: [-64, -92, 128, 92], f: 'news' },
    { svg: 'M -82 -86 L 0 -150 L 82 -86 Z', f: 'red', o: { cut: 1.3 } },
    { rect: [-40, -48, 30, 48], f: 'brown', sh: 0.4 },
    { rect: [14, -72, 32, 28], f: 'sky', sh: 0.4 },
    { line: [[30, -72], [30, -44]], w: 2.2 }, { line: [[14, -58], [46, -58]], w: 2.2 },
  ]) };
  I.trophy = { h: 124, w: 120, L: comp([
    { line: qpts(-42, -114, -80, -106, -34, -78), w: 7, c: '#d4a232' },
    { line: qpts(42, -114, 80, -106, 34, -78), w: 7, c: '#d4a232' },
    { svg: 'M -44 -124 L 44 -124 Q 44 -70 0 -62 Q -44 -70 -44 -124 Z', f: 'gold', o: { cut: 1.2 } },
    { rect: [-8, -64, 16, 30], f: 'gold' },
    { rect: [-34, -38, 68, 18], f: 'brown' }, { rect: [-42, -22, 84, 22], f: 'brown' },
    { text: '1', tx: 0, ty: -97, font: 'bold 34px Georgia, "DejaVu Serif", serif', c: '#8a651d' },
  ]) };
  I.bag = { h: 116, w: 114, L: comp([
    { line: qpts(-26, -86, 0, -142, 26, -86), w: 6, c: PAL.brown },
    { rect: [-56, -90, 112, 90], f: 'stripePink', o: { cut: 1.3 } },
    { rect: [-56, -90, 112, 16], f: 'coral', sh: 0.3 },
    { circ: [0, -44, 15], f: 'paper', sh: 0.3 },
    { text: '%', tx: 0, ty: -44, font: 'bold 18px Georgia, "DejaVu Serif", serif', c: PAL.red },
  ]) };
  I.phone = { h: 112, w: 66, L: comp([
    { rect: [-33, -112, 66, 112], f: 'navy', o: { cut: 1 } },
    { rect: [-26, -103, 52, 80], f: 'sky', sh: 0.3 },
    { circ: [0, -11, 5], f: 'gray', sh: 0.2 },
    { rect: [-20, -95, 14, 14], f: 'coral', sh: 0.2 }, { rect: [2, -95, 14, 14], f: 'mustard', sh: 0.2 },
    { rect: [-20, -75, 14, 14], f: 'leaf', sh: 0.2 }, { rect: [2, -75, 14, 14], f: 'pink', sh: 0.2 },
  ]) };
  I.gem = { h: 76, w: 98, L: comp([
    { svg: 'M -30 -76 L 30 -76 L 49 -52 L 0 0 L -49 -52 Z', f: 'lilac', o: { cut: 1 } },
    { svg: 'M -30 -76 L -14 -52 L 14 -52 L 30 -76 Z', f: 'white', sh: 0.2 },
    { line: [[-48, -52], [48, -52]], w: 2.2 }, { line: [[-14, -52], [0, -2], [14, -52]], w: 2.2 },
  ]) };
  I.crown = { h: 76, w: 120, L: comp([
    { svg: 'M -56 0 L -58 -60 L -30 -30 L 0 -72 L 30 -30 L 58 -60 L 56 0 Z', f: 'gold', o: { cut: 1.2 } },
    { rect: [-56, -16, 112, 16], f: 'mustard', sh: 0.3 },
    { circ: [-58, -62, 7], f: 'coral', sh: 0.3 }, { circ: [0, -75, 8], f: 'teal', sh: 0.3 }, { circ: [58, -62, 7], f: 'coral', sh: 0.3 },
    { circ: [0, -8, 5], f: 'red', sh: 0.2 },
  ]) };
  return I;
}

function build2() {
  const s = (SD.s2 = {});
  s.ground = P.rect(3800, 3000, { torn: 6, rim: 3.5, edges: [1, 0, 0, 0], seed: 201 });
  s.clouds = [
    { p: P.poly(cloudPts(320, 120, 202), { cut: 1.3, seed: 203 }), x: 330, y: 380, v: 6 },
    { p: P.poly(cloudPts(380, 130, 204), { cut: 1.3, seed: 205 }), x: 1420, y: 300, v: -5 },
    { p: P.poly(cloudPts(220, 90, 206), { cut: 1.3, seed: 207 }), x: 1790, y: 540, v: 4 },
  ];
  s.sunDisc = P.ellipse(70, 70, { cut: 1, torn: 2, rim: 2.5, seed: 208 });
  s.sunRay = P.poly([[-12, 0], [12, 0], [0, -44]], { cut: 0.8, seed: 209 });
  s.cap = new Caption([{ text: 'Is it to have more?', write: TL.s2.write }],
    { x: 470, y: 150, rot: -0.035, tIn: TL.s2.card, cap: 52, seed: 21, strike: TL.s2.scribble });
  s.items = buildItems();
  s.bill = P.box(-75, -9, 150, 18, { cut: 1, seed: 210 });
  // where each thing lands after the tumble: [x, final rotation, arc height, flight time]
  s.fly = {
    tv: [860, -0.12, 150, 0.3], car: [1100, 0.08, 120, 0.32], house: [1340, -0.2, 220, 0.4], trophy: [610, -0.35, 260, 0.44],
    bag: [1530, 0.25, 240, 0.46], phone: [745, 1.45, 300, 0.48], gem: [1660, 0.5, 300, 0.52],
  };
  s.tufts = [];
  for (let i = 0; i < 30; i++) s.tufts.push([(i / 30) * 2600 - 340 + hash(i) * 50, GY.s2 + 40 + hash(i + 9) * 150]);
}

function pip2(t) {
  const T = TL.s2;
  const n = T.land.filter((x) => x <= t).length;
  const p = { x: 960, y: GY.s2, s: PIP2_S, lx: 0, ly: -0.6, eyes: 'open', mouth: 'smile', sway: Math.sin(t * 3) * 0.1 };
  if (t > 8.3 && t < T.fly) {
    const r = E.back(prog(t, 8.3, 8.6));
    p.armL = { x: -42, y: lerp(-70, -224, r), b: 14 };
    p.armR = { x: 42, y: lerp(-70, -224, r), b: 14 };
    p.sq = 1 - n * 0.012;
    p.legL = 0.12 + Math.sin(t * 43) * 0.014 * n;
    p.legR = -0.12 - Math.sin(t * 43 + 1) * 0.014 * n;
    p.ly = -1;
    p.sprout = 1 - Math.min(1, n) * 0.6;
    if (n >= 4) p.mouth = 'flat';
    if (n >= 6) { p.eyes = 'squeeze'; p.mouth = 'wobbly'; }
  }
  if (t >= T.topple && t < T.fly) { p.eyes = 'wide'; p.mouth = 'o'; p.lean = 0.12; p.lx = 1; }
  if (t >= T.fly) {
    p.sq = t < T.pop ? lerp(0.892, 0.28, E.in(prog(t, T.fly, T.flat))) : lerp(0.28, 1, E.elastic(prog(t, T.pop, T.pop + 0.55)));
    p.eyes = t < T.pop ? 'squeeze' : 'dizzy';
    p.mouth = 'wobbly';
    p.sprout = clamp((p.sq - 0.3) / 0.6);
    p.ly = 0;
    p.armL = [0.55, 10];
    p.armR = [0.55, 10];
    if (t > T.pop + 1.0) { p.eyes = 'open'; p.mouth = 'flat'; p.tilt = Math.sin((t - T.pop) * 2) * 0.06; p.ly = -0.5; p.lx = -0.8; }
    if (t >= T.crown) {
      const d = t - T.crown;
      p.hat = (c) => {
        c.save();
        c.translate(10, -219 - Math.abs(Math.sin(d * 14)) * 12 * Math.exp(-d * 6));
        c.rotate(0.3);
        c.scale(0.62, 0.62);
        drawComp(c, SD.s2.items.crown.L);
        c.restore();
      };
    }
  }
  return p;
}

function stackAt(t, baseY) {
  const s = SD.s2, T = TL.s2;
  const n = T.land.filter((x) => x <= t).length;
  let th = Math.sin(t * 5.1) * 0.0035 * n;
  T.land.forEach((tl, k) => { const d = t - tl; if (d > 0) th += 0.03 * (0.4 + k / 8) * Math.exp(-d * 2.5) * Math.sin(d * 10); });
  th += E.in(prog(t, T.land[8] + 0.05, T.fly)) * 0.55;
  const out = [];
  let h = 0;
  for (let k = 0; k < 9; k++) {
    const it = s.items[STACK[k]], ih = it.h * ITEM_SCALE, hc = h + ih / 2;
    out.push({ x: 960 + (th * hc * hc) / 640, y: baseY - hc, rot: th * (hc / 320) });
    h += ih;
  }
  return out;
}

function drawItem(ctx, it, x, y, rot, sq = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(ITEM_SCALE * (2 - sq), ITEM_SCALE * sq);
  ctx.translate(0, it.h / 2);
  drawComp(ctx, it.L);
  ctx.restore();
}

function drawItems2(ctx, t, pp) {
  const s = SD.s2, T = TL.s2;
  if (t < T.fly) {
    const st = stackAt(t, GY.s2 - 236 * PIP2_S * (pp.sq || 1));
    for (let k = 0; k < 9; k++) {
      const tl = T.land[k];
      if (t < tl - 0.3) break;
      const p = st[k];
      let y = p.y, rot = p.rot, sq = 1;
      if (t < tl) {
        const u = prog(t, tl - 0.3, tl);
        y = lerp(-190 - camY2(t), p.y, E.in(u));
        rot = (1 - u) * (k % 2 ? 0.6 : -0.6);
      } else {
        const d = t - tl;
        sq = 1 - 0.22 * Math.exp(-d * 12) * Math.cos(d * 30);
      }
      drawItem(ctx, s.items[STACK[k]], p.x, y, rot, sq);
    }
    return;
  }
  const st0 = stackAt(T.fly, GY.s2 - 236 * PIP2_S * 0.892);
  for (let i = 0; i < 3; i++) {
    const u = prog(t, T.fly, T.fly + 1.2 + i * 0.25), dir = [-1, 0.6, 1.3][i];
    const x = st0[0].x + dir * 170 * E.out(u) + Math.sin(u * 9 + i) * 40 * (1 - u * 0.6);
    const y = lerp(st0[0].y - 10 * i, GY.s2 + 26 + i * 12, u);
    const rot = Math.sin(u * 8 + i * 2) * 0.5 * (1 - u) + [0.1, -0.15, 0.05][i] * u;
    at(ctx, x, y, rot, ITEM_SCALE, () => {
      s.bill.draw(ctx, 'money', { shadow: 0.6 });
      ctx.fillStyle = '#2f5d2a';
      ctx.font = 'bold 15px Georgia, "DejaVu Serif", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
    });
  }
  for (let k = 1; k < 8; k++) {
    const name = STACK[k], it = s.items[name], p0 = st0[k];
    const [fx, frot, arc, dur] = s.fly[name];
    const u = prog(t, T.fly, T.fly + dur);
    const hh = (it.h * ITEM_SCALE) / 2, hw = (it.w * ITEM_SCALE) / 2;
    const yLand = GY.s2 + 22 + (k % 3) * 8 - (Math.abs(Math.cos(frot)) * hh + Math.abs(Math.sin(frot)) * hw);
    let y = lerp(p0.y, yLand, E.in(u)) - Math.sin(Math.PI * u) * arc;
    if (u >= 1) { const d = t - T.fly - dur; y -= Math.abs(Math.sin(d * 15)) * 16 * Math.exp(-d * 7); }
    drawItem(ctx, it, lerp(p0.x, fx, u), y, lerp(p0.rot, frot + (k % 2 ? TAU : -TAU), u));
  }
  if (t < T.crown) {
    const c0 = st0[8], u = prog(t, T.fly, T.crown);
    drawItem(ctx, s.items.crown, lerp(c0.x, 972, u), lerp(c0.y, GY.s2 - 222 * PIP2_S - 20, u) - Math.sin(Math.PI * u) * 560, u * TAU * 3);
  }
}

function draw2(ctx, t, view) {
  const s = SD.s2, T = TL.s2, cy = camY2(t);
  bgFill(ctx, view, 'sky');
  at(ctx, 1720, 150 + cy * 0.3, 0, 1, () => {
    for (let i = 0; i < 12; i++) at(ctx, 0, 0, (i * TAU) / 12 + t * 0.3, 1, () => { ctx.translate(0, -84); s.sunRay.draw(ctx, 'orange', { shadow: 0.5 }); });
    s.sunDisc.draw(ctx, 'mustard', { shadow: 0.8 });
    sunFace(ctx, 0, 0, 0.72);
  });
  for (const c of s.clouds) at(ctx, c.x + (t - 7.5) * c.v, c.y + cy * 0.45, 0, 1, () => c.p.draw(ctx, 'white', { shadow: 0.8 }));
  ctx.save();
  ctx.translate(0, cy);
  at(ctx, 960, GY.s2 + 1500, 0, 1, () => s.ground.draw(ctx, 'grass', { shadow: 1 }));
  for (const [x, y] of s.tufts) tuft(ctx, x, y);
  const pp = pip2(t);
  drawChar(ctx, LOOKS.pip, pp);
  drawItems2(ctx, t, pp);
  const n = T.land.filter((x) => x <= t).length, head = GY.s2 - 178 * PIP2_S;
  if (n >= 6 && t < T.fly) {
    for (let i = 0; i < 2; i++) {
      const ph = (t * 1.6 + i * 0.5) % 1, side = i ? 1 : -1;
      ctx.fillStyle = `rgba(90,150,210,${1 - ph})`;
      ctx.beginPath();
      ctx.ellipse(960 + side * (62 + ph * 44), head + 6 - ph * 30 + ph * ph * 60, 5.5, 9, side * 0.4, 0, TAU);
      ctx.fill();
    }
  }
  if (between(t, T.pop + 0.05, T.pop + 1.0)) {
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + i * 2.1, x = 960 + Math.cos(a) * 70, y = GY.s2 - 222 * PIP2_S - 14 + Math.sin(a) * 16;
      at(ctx, x, y, a, 1, () => {
        const pts = starPts(0, 0, 14);
        ctx.fillStyle = PAL.mustard;
        ctx.beginPath();
        pts.forEach(([a1, b1], j) => (j ? ctx.lineTo(a1, b1) : ctx.moveTo(a1, b1)));
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = PAL.ink;
        ctx.stroke();
      });
    }
  }
  ctx.restore();
  s.cap.draw(ctx, t);
}

// ============================================================ scene 3 — written in the stars?

const nearHillY = (x) => 915 - 100 * Math.exp(-Math.pow((x - 470) / 330, 2));

function build3() {
  const s = (SD.s3 = {});
  const r = rng(303);
  s.stars = [];
  while (s.stars.length < 54) {
    const x = 40 + r() * 1840, y = 30 + r() * 650;
    if (x < 1010 && y < 240) continue;
    if (Math.hypot(x - 1600, y - 205) < 175) continue;
    if (x < 760 && y > 500) continue;
    s.stars.push({ x, y, r: 6 + r() * 9, paper: r() < 0.28, ph: r() * TAU, sp: 1.6 + r() * 2.4 });
  }
  for (let i = 0; i < 12; i++) s.stars[i].paper = true;
  for (const st of s.stars) if (st.paper) st.piece = P.poly(starPts(0, 0, st.r * 1.7), { cut: 0.7, step: 5, seed: (pieceSeed += 3) });
  const line = qCenterline();
  s.qT = [];
  for (let k = 0; k < 11; k++) { const [x, y] = pointAt(line, k / 10); s.qT.push([1180 + x * 1.3, 420 + y * 1.3]); }
  s.qT.push([1180 + 4 * 1.3, 420 + 172 * 1.3]);
  s.moon = P.poly(crescentPts(112, 98, 46, -30), { cut: 1, torn: 2, rim: 2.5, seed: 311 });
  s.farPts = hillPts(-900, 2820, 752, 42, 312);
  s.hillFar = P.poly(s.farPts, { cut: 1, torn: 5, rim: 3, seed: 313 });
  const near = [];
  for (let i = 0; i < 50; i++) { const x = -900 + i * 76; near.push([x, nearHillY(x)]); }
  near.push([2824, 1900], [-900, 1900]);
  s.hillNear = P.poly(near, { cut: 1.5, torn: 5, rim: 3, seed: 314 });
  s.houses = [[1150, 0.9], [1290, 0.7], [1780, 1]].map(([x, k], i) => ({
    x, y: polyY(s.farPts, x) + 10, k, L: comp([
      { rect: [-30, -44, 60, 44], f: 'slate', sh: 0.5, o: { seed: 330 + i } },
      { svg: 'M -38 -40 L 0 -74 L 38 -40 Z', f: 'navy', sh: 0.5, o: { seed: 340 + i } },
      { rect: [-10, -32, 18, 16], f: 'mustard', sh: 0.2, o: { seed: 350 + i } },
      { rect: [14, -18, 10, 18], f: 'night', sh: 0.2, o: { seed: 360 + i } },
    ]),
  }));
  s.tube = P.rect(196, 34, { cut: 1, seed: 320 });
  s.lens = P.rect(24, 50, { cut: 0.8, seed: 321 });
  s.band = P.rect(18, 38, { cut: 0.6, seed: 322 });
  s.cap = new Caption([{ text: 'Is it written in the stars?', write: TL.s3.write }],
    { x: 520, y: 128, rot: -0.03, tIn: TL.s3.card, cap: 46, seed: 31 });
  s.bang = new Hand('!', 62, { seed: 9 });
  s.fallPath = [];
  const [x0, y0] = s.qT[11];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40, v = 1 - u;
    s.fallPath.push([v * v * x0 + 2 * v * u * 860 + u * u * 508, v * v * y0 + 2 * v * u * 430 + u * u * 736]);
  }
}

function pip3(t) {
  const T = TL.s3;
  const p = { x: 470, y: 820, s: 0.95, sit: 1, lx: 1, ly: -0.6, eyes: 'blink', mouth: 'smile', tilt: -0.1, sway: Math.sin(t * 2.5) * 0.12 };
  p.armL = { x: 40, y: -166, b: 6 };
  p.armR = { x: 64, y: -202, b: 10 };
  if (t < 15.9) { p.eyes = 'open'; p.tilt = 0; }
  if (t >= T.look) {
    const k = E.back(prog(t, T.look, T.look + 0.25));
    p.tilt = lerp(-0.1, 0.1, k);
    p.lean = -0.08 * k;
    p.eyes = 'wide';
    p.mouth = 'o';
    p.lx = 0.8;
    p.ly = -1;
    p.armL = [lerp(0.5, 1.3, k), 10];
    p.armR = [lerp(0.5, 1.5, k), 10];
  }
  if (t >= T.fall[0] + 0.25) {
    const u = prog(t, T.fall[0], T.fall[1]);
    p.armL = { x: 30, y: -128, b: -6 };
    p.armR = { x: 50, y: -126, b: -6 };
    p.lx = lerp(0.8, 0.3, u);
    p.ly = lerp(-1, 0.7, u);
    p.lean = 0;
    p.tilt = lerp(0.1, 0.05, u);
  }
  if (t >= T.fall[1]) { p.mouth = 'smile'; p.lx = 0.3; p.ly = 0.8; }
  if (t >= T.glow + 0.35) { p.eyes = 'happy'; p.mouth = 'grin'; }
  return p;
}

function drawStar3(ctx, st, x, y, k) {
  if (st.piece) {
    at(ctx, x, y, st.ph, k, () => st.piece.draw(ctx, 'gold', { shadow: 0.5 }));
    return;
  }
  const r = st.r * k;
  for (let j = 0; j < 3; j++) {
    const a = st.ph + (j * Math.PI) / 3;
    inkLine(ctx, [[x - Math.cos(a) * r, y - Math.sin(a) * r], [x + Math.cos(a) * r, y + Math.sin(a) * r]], 2.6, '#fff0bd', j + (x | 0), 0.5);
  }
}

function draw3(ctx, t, view) {
  const s = SD.s3, T = TL.s3;
  bgFill(ctx, view, 'night');
  glow(ctx, 1600, 205, 420, '120,140,200', 0.16);
  glow(ctx, 700, 300, 520, '90,110,190', 0.1);
  for (let i = 0; i < s.stars.length; i++) {
    const st = s.stars[i];
    if (i === 11 && t >= T.fall[0]) continue;
    let x = st.x, y = st.y, k = 1 + 0.28 * Math.sin(t * st.sp + st.ph);
    if (i < 12 && t > T.form[0]) {
      const u = E.inOut(prog(t, T.form[0] + i * 0.04, T.form[0] + 0.62 + i * 0.04));
      x = lerp(st.x, s.qT[i][0], u);
      y = lerp(st.y, s.qT[i][1], u) - Math.sin(Math.PI * u) * 50;
      k *= 1 + 0.25 * u;
    }
    drawStar3(ctx, st, x, y, k);
  }
  for (const [tt, idx] of T.tw) {
    const d = t - tt;
    if (d >= 0 && d < 0.45) { const st = s.stars[idx]; sparkle(ctx, st.x, st.y, 12 + d * 60, `rgba(255,244,200,${1 - d / 0.45})`, 2.6, idx); }
  }
  if (t > T.lines[0]) crayon(ctx, upto(s.qT.slice(0, 11), prog(t, T.lines[0], T.lines[1])), 4.5, 'rgba(255,248,225,0.9)', 5, 0.9);
  at(ctx, 1600, 205, -0.3, 1, () => {
    s.moon.draw(ctx, 'halftone', { shadow: 0.8 });
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-62, 8, 11, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(-50, 48, 12, Math.PI * 0.1, Math.PI * 0.7); ctx.stroke();
    ctx.fillStyle = 'rgba(232,110,110,0.45)';
    ctx.beginPath(); ctx.ellipse(-80, 30, 10, 7, 0, 0, TAU); ctx.fill();
  });
  s.hillFar.draw(ctx, 'dusk', { shadow: 1 });
  for (const h of s.houses) {
    glow(ctx, h.x - h.k, h.y - 24 * h.k, 34 * h.k, '255,214,120', 0.35);
    at(ctx, h.x, h.y, 0, h.k * 1.15, () => drawComp(ctx, h.L));
  }
  s.hillNear.draw(ctx, 'navy', { shadow: 1 });
  // telescope on its tripod
  const tx = 505, ty = 682, ta = -0.6, cx = tx + Math.cos(ta) * 98, cy = ty + Math.sin(ta) * 98;
  for (const [fx, fy] of [[548, nearHillY(548) + 6], [640, nearHillY(640) + 6], [606, nearHillY(606) + 10]])
    inkLine(ctx, [[cx - 10, cy + 10], [fx, fy]], 4, '#e8d8b8', fx | 0, 0.6);
  at(ctx, cx, cy, ta, 1, () => {
    s.tube.draw(ctx, 'kraft', { shadow: 0.8 });
    at(ctx, 40, 0, 0, 1, () => s.band.draw(ctx, 'coral', { shadow: 0.4 }));
    at(ctx, 104, 0, 0, 1, () => s.lens.draw(ctx, 'mustard', { shadow: 0.5 }));
    tape(ctx, -40, 0, 1.4, 0, 1);
  });
  drawChar(ctx, LOOKS.pip, pip3(t));
  if (t >= T.look && t < T.fall[0] + 0.3) {
    const k = E.back(prog(t, T.look, T.look + 0.2));
    at(ctx, 470, 548 + Math.sin(t * 9) * 3, 0.1, k, () => s.bang.draw(ctx, 0, 0, 1, { align: 0.5, col: '#fff3d0', w: 1.2 }));
  }
  if (t >= T.fall[0]) {
    const u = E.in(prog(t, T.fall[0], T.fall[1]));
    const trail = [];
    for (let j = 0; j <= 10; j++) trail.push(pointAt(s.fallPath, Math.max(0.001, u - j * 0.028)));
    if (u < 1) {
      crayon(ctx, trail, 12, 'rgba(255,214,110,0.9)', 7, 0.8);
      for (let j = 2; j < 10; j += 3) { const [sx, sy] = trail[j]; sparkle(ctx, sx + Math.sin(j + t * 20) * 8, sy + 14, 8, '#fff3c8', 2, j); }
    }
    const [x, y] = trail[0];
    const pulse = u >= 1 ? 1 + 0.08 * Math.sin(t * 9) : 1;
    if (u >= 1) glow(ctx, x, y, lerp(60, 200, E.inOut(prog(t, T.glow, 22.5))) * pulse, '255,226,150', 0.7);
    at(ctx, x, y, t * 3, pulse, () => s.stars[11].piece.draw(ctx, 'gold', { shadow: 0.6 }));
  }
  s.cap.draw(ctx, t);
}

// ============================================================ transitions

function buildEdges() {
  SD.edgeV = [];
  for (let y = -2600; y <= 3700; y += 9) SD.edgeV.push([vnoise(y * 0.012, 5) * 14 + (hash(y * 7 + 1) - 0.5) * 8, y]);
  SD.edgeH = [];
  for (let x = -3200; x <= 5200; x += 9) SD.edgeH.push([x, vnoise(x * 0.012, 9) * 14 + (hash(x * 3 + 2) - 0.5) * 8]);
  SD.edgeM = [];
  for (let y = -2600; y <= 3700; y += 8) SD.edgeM.push([960 + vnoise(y * 0.006, 13) * 60 + vnoise(y * 0.03, 14) * 14 + (hash(y * 5 + 3) - 0.5) * 9, y]);
}

function rimStroke(ctx, pts, dx = 0, dy = 0) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
  ctx.strokeStyle = '#fbf6ea';
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// a new sheet slides in from the right, its left edge torn
function xSlideLeft(ctx, view, p, drawOld, drawNew) {
  drawOld(view);
  const X = lerp(view.x1 + 60, view.x0 - 60, E.inOut(p)), off = X - (view.x0 - 60);
  const e = SD.edgeV, path = new Path2D();
  path.moveTo(view.x1 + 4000, e[0][1]);
  for (const [dx, y] of e) path.lineTo(X + dx, y);
  path.lineTo(view.x1 + 4000, e[e.length - 1][1]);
  path.closePath();
  ctx.save(); ctx.translate(-14, 5); ctx.fillStyle = 'rgba(40,24,10,0.28)'; ctx.fill(path); ctx.restore();
  ctx.save();
  ctx.clip(path);
  ctx.translate(off, 0);
  drawNew({ x0: view.x0 - off - 60, x1: view.x1 - off + 60, y0: view.y0, y1: view.y1 });
  ctx.restore();
  rimStroke(ctx, e.map(([dx, y]) => [X + dx, y]), 2, 0);
}

// a new sheet comes down from the top, its bottom edge torn
function xSlideDown(ctx, view, p, drawOld, drawNew) {
  drawOld(view);
  const Y = lerp(view.y0 - 60, view.y1 + 60, E.inOut(p)), off = Y - (view.y1 + 60);
  const e = SD.edgeH, path = new Path2D();
  path.moveTo(e[0][0], view.y0 - 4000);
  for (const [x, dy] of e) path.lineTo(x, Y + dy);
  path.lineTo(e[e.length - 1][0], view.y0 - 4000);
  path.closePath();
  ctx.save(); ctx.translate(4, 14); ctx.fillStyle = 'rgba(30,20,10,0.3)'; ctx.fill(path); ctx.restore();
  ctx.save();
  ctx.clip(path);
  ctx.translate(0, off);
  drawNew({ x0: view.x0, x1: view.x1, y0: view.y0 - off - 60, y1: view.y1 - off + 60 });
  ctx.restore();
  rimStroke(ctx, e.map(([x, dy]) => [x, Y + dy]), 0, -2);
}

// a new sheet slides up from the bottom, its top edge torn
function xSlideUp(ctx, view, p, drawOld, drawNew) {
  drawOld(view);
  const Y = lerp(view.y1 + 60, view.y0 - 60, E.inOut(p)), off = Y - (view.y0 - 60);
  const e = SD.edgeH, path = new Path2D();
  path.moveTo(e[0][0], view.y1 + 4000);
  for (const [x, dy] of e) path.lineTo(x, Y + dy);
  path.lineTo(e[e.length - 1][0], view.y1 + 4000);
  path.closePath();
  ctx.save(); ctx.translate(4, -12); ctx.fillStyle = 'rgba(30,20,10,0.28)'; ctx.fill(path); ctx.restore();
  ctx.save();
  ctx.clip(path);
  ctx.translate(0, off);
  drawNew({ x0: view.x0, x1: view.x1, y0: view.y0 - off - 60, y1: view.y1 - off + 60 });
  ctx.restore();
  rimStroke(ctx, e.map(([x, dy]) => [x, Y + dy]), 0, 2);
}

// the old sheet is torn down the middle and the halves are pulled apart
function xTear(ctx, view, p, drawOld, drawNew) {
  drawNew(view);
  const e = E.in(p), dx = e * (view.x1 - view.x0) * 0.62;
  for (const side of [-1, 1]) {
    const far = side < 0 ? view.x0 - 3000 : view.x1 + 3000, m = SD.edgeM;
    const path = new Path2D();
    path.moveTo(far, m[0][1]);
    for (const [x, y] of m) path.lineTo(x, y);
    path.lineTo(far, m[m.length - 1][1]);
    path.closePath();
    ctx.save();
    ctx.translate(960, 1300);
    ctx.rotate(side * e * 0.1);
    ctx.translate(-960 + side * dx, -1300 + e * 50);
    ctx.save(); ctx.translate(side * 10, 12); ctx.fillStyle = 'rgba(25,15,8,0.32)'; ctx.fill(path); ctx.restore();
    ctx.save();
    ctx.clip(path);
    drawOld(view);
    ctx.restore();
    rimStroke(ctx, m, -side * 2, 0);
    ctx.restore();
  }
}

// the old sheet is ripped off like a calendar page, its bottom edge torn
function xRipUp(ctx, view, p, drawOld, drawNew) {
  drawNew(view);
  const e = E.in(p), path = new Path2D(), eh = SD.edgeH, yb = view.y1 - 20;
  path.moveTo(eh[0][0], view.y0 - 4000);
  for (const [x, dy] of eh) path.lineTo(x, yb + dy);
  path.lineTo(eh[eh.length - 1][0], view.y0 - 4000);
  path.closePath();
  ctx.save();
  ctx.translate(1500, -300);
  ctx.rotate(-e * 0.45);
  ctx.translate(-1500 + e * 260, 300 - e * 1350);
  ctx.save(); ctx.translate(12, 22); ctx.fillStyle = 'rgba(25,15,8,0.32)'; ctx.fill(path); ctx.restore();
  ctx.save();
  ctx.clip(path);
  drawOld(view);
  ctx.restore();
  rimStroke(ctx, eh.map(([x, dy]) => [x, yb + dy]), 0, -2);
  ctx.restore();
}

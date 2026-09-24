'use strict';
// Scenes 4–7: the garden (a seed, then the rain), the montage of answers, the finale — and the master render.

function toWorld(p, x, y) {
  y += (p.sit || 0) * 40;
  const c = Math.cos(p.lean || 0), sn = Math.sin(p.lean || 0);
  const rx = x * c - y * sn, ry = x * sn + y * c;
  return [(p.x || 0) + rx * (p.s || 1) * (p.face || 1), (p.y || 0) + (p.bob || 0) + ry * (p.s || 1)];
}

function hopBob(t, times, h = 55, len = 0.42) {
  let b = 0;
  for (const s of times) { const v = prog(t, s, s + len); if (v > 0 && v < 1) b = -h * Math.sin(Math.PI * v); }
  return b;
}

function blobPts(r, seed, n = 40) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + 0.2 * vnoise(i * 0.7, seed) + (hash2(seed, i) > 0.84 ? 0.35 : 0);
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k]);
  }
  return pts;
}

// ============================================================ scenes 4 & 5 — the garden

function build4() {
  const s = (SD.s4 = {});
  s.sunDisc = P.ellipse(95, 95, { cut: 1, torn: 2.5, rim: 3, seed: 401 });
  s.sunRay = P.poly([[-15, 0], [15, 0], [0, -58]], { cut: 0.8, torn: 1.2, rim: 2, seed: 402 });
  s.cloudsW = [
    { p: P.poly(cloudPts(300, 110, 403), { cut: 1.3, seed: 404 }), x: 760, y: 280, v: 5 },
    { p: P.poly(cloudPts(260, 96, 405), { cut: 1.3, seed: 406 }), x: 1580, y: 390, v: -4 },
  ];
  s.cloudsG = [
    { p: P.poly(cloudPts(720, 230, 407), { cut: 1.5, torn: 3, rim: 3, seed: 408 }), x: 330, y: 200, f: 'slate', d: 0 },
    { p: P.poly(cloudPts(780, 250, 409), { cut: 1.5, torn: 3, rim: 3, seed: 410 }), x: 1000, y: 262, f: 'gray', d: 0.12 },
    { p: P.poly(cloudPts(720, 230, 411), { cut: 1.5, torn: 3, rim: 3, seed: 412 }), x: 1660, y: 190, f: 'slate', d: 0.24 },
    { p: P.poly(cloudPts(660, 210, 413), { cut: 1.5, torn: 3, rim: 3, seed: 414 }), x: 2280, y: 290, f: 'gray', d: 0.36 },
  ];
  s.hillPts = hillPts(-900, 3600, 772, 55, 415, 1900, 30);
  s.hills = P.poly(s.hillPts, { cut: 1, torn: 5, rim: 3, seed: 416 });
  s.trees = [[260, 1], [640, 0.8], [1400, 0.9], [2080, 1.1], [2500, 0.85], [3000, 1]].map(([x, k], i) => ({
    x, y: polyY(s.hillPts, x) + 14, k, top: P.ellipse(46, 42, { cut: 1, torn: 2, rim: 2.5, seed: 420 + i }),
  }));
  s.ground = P.rect(5400, 3000, { torn: 6, rim: 3.5, edges: [1, 0, 0, 0], seed: 430 });
  s.front = P.rect(5400, 3000, { torn: 6, rim: 3.5, edges: [1, 0, 0, 0], seed: 431 });
  s.tufts = [];
  for (let i = 0; i < 44; i++) s.tufts.push([-600 + i * 92 + hash(i + 40) * 50, GY.s4 + 30 + hash(i + 70) * 80]);
  s.seed = P.poly(starPts(0, 0, 15, 0.5), { cut: 0.6, step: 4, seed: 432 });
  s.mound = P.ellipse(38, 12, { cut: 1, torn: 1.5, rim: 2, seed: 433 });
  s.can = comp([
    { svg: 'M 40 -50 L 96 -86 L 101 -78 L 47 -36 Z', f: 'mustard' },
    { line: qpts(-40, -66, -74, -40, -40, -12), w: 7, c: '#c98a22' },
    { rect: [-44, -70, 90, 70], f: 'mustard', o: { cut: 1.3 } },
    { rect: [-44, -70, 90, 13], f: 'orange', sh: 0.3 },
    { svg: 'M 92 -93 L 109 -80 L 100 -71 L 85 -84 Z', f: 'orange' },
    { circ: [0, -34, 12], f: 'dotsCoral', sh: 0.3 },
  ]);
  s.leaf = P.svg('M 0 0 Q 30 -36 88 -20 Q 42 16 0 0 Z', { cut: 0.9, seed: 434 });
  s.bud = P.svg('M 0 6 Q 16 -8 0 -30 Q -16 -8 0 6 Z', { cut: 0.8, seed: 435 });
  const pf = ['dotsCoral', 'stripePink', 'mustard', 'lilac', 'coral', 'pink', 'dotsMustard', 'orange', 'stripePink', 'dotsCoral'];
  s.petals = pf.map((f, i) => ({ f, p: P.svg('M 0 0 Q 29 -30 0 -94 Q -29 -30 0 0 Z', { cut: 1, seed: 470 + i }) }));
  s.center = P.ellipse(40, 40, { cut: 1, torn: 2, rim: 2.5, seed: 436 });
  s.wingA = P.svg('M 0 0 Q -30 -46 -54 -24 Q -48 2 0 0 Z', { cut: 0.8, seed: 437 });
  s.wingB = P.svg('M 0 0 Q -36 10 -36 32 Q -12 32 0 0 Z', { cut: 0.8, seed: 438 });
  const ring = (rx, ry) => { const p = ellipsePts(0, -64, rx, ry, 24); p.push(p[0]); return p; };
  s.stump = comp([
    { rect: [-62, -64, 124, 64], f: 'brown', o: { cut: 1.4 } },
    { poly: ellipsePts(0, -64, 62, 16), f: 'kraft', sh: 0.3 },
    { line: ring(40, 10), w: 2 }, { line: ring(19, 5), w: 2 },
    { line: [[-30, -40], [-26, -8]], w: 2, c: '#5a3a24' }, { line: [[24, -50], [28, -14]], w: 2, c: '#5a3a24' },
  ]);
  s.bigLeaf = P.svg('M 0 0 C 70 -120 330 -150 470 -30 C 320 40 110 50 0 0 Z', { cut: 1.4, torn: 2, rim: 3, seed: 440 });
  s.rainbow = ['coral', 'orange', 'mustard', 'leaf', 'sky', 'lilac'].map((f, i) => {
    const R = 640 - i * 38, pts = [];
    for (let a = 180; a <= 360; a += 3) pts.push([Math.cos((a * Math.PI) / 180) * R, Math.sin((a * Math.PI) / 180) * R]);
    return { f, p: P.stroke(pts, 20, { cut: 1, torn: 2, rim: 2.5, seed: 450 + i }) };
  });
  s.heart = P.poly(heartPts(44), { cut: 1, torn: 2, rim: 2.5, seed: 460 });
  s.cap1 = new Caption([{ text: 'Maybe it starts small...', write: TL.s4.write }],
    { x: 1390, y: 150, rot: 0.03, tIn: TL.s4.card, tOut: 29.75, cap: 50, seed: 41 });
  s.cap2 = new Caption([{ text: '...and in each other.', write: TL.s5.write }],
    { x: 560, y: 150, rot: -0.03, tIn: TL.s5.card, cap: 50, seed: 51 });
  s.stem = cpts([930, 885], [898, 720], [978, 565], [938, 430], 40);
  s.bird = {
    body: P.svg('M -34 0 Q -20 -22 8 -18 Q 30 -14 36 -2 Q 20 14 -10 12 Q -28 10 -34 0 Z', { cut: 0.8, seed: 480 }),
    wing: P.svg('M -8 -6 Q 6 -42 26 -46 Q 20 -16 10 -2 Z', { cut: 0.6, seed: 481 }),
    beak: P.poly([[34, -7], [50, -2], [34, 3]], { cut: 0.4, seed: 482 }),
    tail: P.poly([[-30, -2], [-54, -15], [-50, 7]], { cut: 0.5, seed: 483 }),
  };
  const fr = rng(490);
  s.posies = [];
  for (let i = 0; i < 26; i++) s.posies.push({ x: -500 + i * 150 + fr() * 90, y: 915 + fr() * 85, k: 0.7 + fr() * 0.6, f: ['#fdf9f0', '#f2a2b4', '#f0b43a', '#b39fd8'][i % 4] });
}

function drawBird(ctx, x, y, t) {
  const b = SD.s4.bird;
  at(ctx, x, y, Math.sin(t * 5) * 0.06, 0.9, () => {
    b.tail.draw(ctx, 'navy', { shadow: 0.5 });
    b.body.draw(ctx, 'teal', { shadow: 0.7 });
    b.beak.draw(ctx, 'mustard', { shadow: 0.3 });
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.arc(22, -7, 3.2, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.scale(1, Math.sin(t * 14));
    b.wing.draw(ctx, 'dotsTeal', { shadow: 0.4 });
    ctx.restore();
  });
}

function drawPosies(ctx) {
  for (const f of SD.s4.posies) {
    ctx.fillStyle = f.f;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + f.x;
      ctx.beginPath();
      ctx.ellipse(f.x + Math.cos(a) * 7 * f.k, f.y + Math.sin(a) * 7 * f.k, 5 * f.k, 3.6 * f.k, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = PAL.orange;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 3.4 * f.k, 0, TAU);
    ctx.fill();
  }
}

const PIP_WATER_X = 1080;

function pipG(t) {
  const T4 = TL.s4, T5 = TL.s5;
  const p = { x: 1080, y: GY.s4, s: 1.05, face: -1, lx: 0.3, ly: 0.7, eyes: 'open', mouth: 'smile', sway: Math.sin(t * 3) * 0.1 };
  if (t < 23.3) {
    p.armL = { x: 34, y: -106, b: -6 };
    p.armR = { x: 46, y: -104, b: -6 };
    if (t >= T4.walk[0]) {
      const u = prog(t, T4.walk[0], T4.walk[1]), w = walkPose(u * TAU, 0.7);
      p.x = lerp(1080, 1010, u); p.legL = w.legL; p.legR = w.legR; p.bob = w.bob;
    }
  } else if (t < 24.05) {
    p.x = 1010;
    const k = E.inOut(prog(t, 23.3, 23.5)) * (1 - E.inOut(prog(t, 23.9, 24.05)));
    let hy = lerp(-104, -14, k);
    for (const pt of T4.pats) hy -= 20 * Math.sin(Math.PI * prog(t, pt - 0.14, pt));
    p.lean = 0.42 * k; p.lx = 0.8; p.ly = 1;
    p.armR = { x: lerp(46, 80, k), y: hy, b: -4 };
    p.armL = { x: lerp(34, 44, k), y: lerp(-106, -62, k), b: -6 };
  } else if (t < 25.35) {
    const u = prog(t, 24.05, 24.3), w = walkPose(u * TAU, u < 1 ? 0.6 : 0);
    p.x = lerp(1010, PIP_WATER_X, E.inOut(u)); p.legL = w.legL; p.legR = w.legR; p.bob = w.bob;
    p.lx = 1; p.ly = 0.8;
    p.armR = { x: 64, y: -100, b: -8 };
    p.armL = { x: 50, y: -94, b: -8 };
  } else if (t < 30.0) {
    p.x = PIP_WATER_X;
    p.lx = 0.5; p.ly = lerp(0.6, -1, prog(t, 25.4, 26.9));
    if (t >= T4.bloom) {
      p.eyes = 'happy'; p.mouth = 'grin';
      p.bob = hopBob(t, T4.hop, 60);
      if (p.bob < 0) { p.armL = [2.5, 6]; p.armR = [2.5, 6]; }
      if (t > 28.8) {
        p.eyes = 'open'; p.mouth = 'smile';
        const [bx, by] = butterflyAt(t);
        p.lx = clamp((p.x - bx) / 200, -1, 1); p.ly = clamp((by - 650) / 250, -1, 1);
      }
    }
  } else if (t < 32.45) {
    p.x = PIP_WATER_X; p.face = t < 30.45 ? -1 : 1; p.ly = -1; p.lx = 0.2; p.mouth = 'o';
    if (t >= T5.walk[0]) {
      const u = prog(t, T5.walk[0], T5.walk[1]), w = walkPose(u * TAU * 3.2, u < 1 ? 1 : 0);
      Object.assign(p, w);
      p.x = lerp(PIP_WATER_X, 1880, u); p.ly = 0; p.lx = 1; p.mouth = 'flat';
    }
  } else {
    p.x = 1880; p.face = 1; p.lx = 1; p.ly = 0.2; p.mouth = 'flat';
    if (t >= T5.leaf[0] && t < T5.smile) { p.ly = -1; p.lx = 0.4; p.armL = [1.2, 8]; p.armR = [1.2, 8]; p.mouth = 'o'; }
    if (t >= T5.smile) { p.eyes = 'happy'; p.mouth = 'smile'; p.ly = 0; p.lx = 1; }
    p.bob = hopBob(t, T5.hops, 38);
  }
  return p;
}

function louG(t) {
  const T5 = TL.s5;
  const p = { x: 2080, y: 835, s: 1, face: -1, sit: 1, eyes: 'sad', mouth: 'frown', tilt: 0.14, lx: 0.2, ly: 0.8 };
  p.armL = [0.35, 8];
  p.armR = { x: 34, y: -96, b: -6 };
  if (t >= T5.lookUp) { p.eyes = 'wide'; p.mouth = 'o'; p.tilt = -0.1; p.ly = -1; p.lx = 0.3; }
  if (t >= T5.smile) { p.eyes = 'happy'; p.mouth = 'smile'; p.lx = 1; p.ly = -0.3; p.tilt = 0.05; }
  if (t >= T5.stand[0]) {
    const u = E.inOut(prog(t, T5.stand[0], T5.stand[1]));
    p.sit = 1 - u;
    p.y = lerp(835, GY.s4, u) - Math.sin(Math.PI * u) * 30;
    p.x = lerp(2080, 2042, u);
    p.armL = [0.3, 6];
    p.armR = [0.3, 6];
  }
  p.bob = hopBob(t, TL.s5.hops, 38);
  return p;
}

function butterflyAt(t) {
  const a = (t - 27.9) * 2.4;
  const orbit = [938 + Math.cos(a) * 150, 390 + Math.sin(a * 1.3) * 60];
  const e = E.inOut(prog(t, 27.9, 28.8));
  let x = lerp(1560, orbit[0], e), y = lerp(230, orbit[1], e);
  const away = E.in(prog(t, 30.0, 30.9));
  x -= away * 900; y -= away * 700;
  return [x, y];
}

function drawButterfly(ctx, x, y, t) {
  const s = SD.s4, flap = 0.3 + 0.7 * Math.abs(Math.sin(t * 16));
  at(ctx, x, y, Math.sin(t * 3) * 0.2, 1, () => {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side * flap, 1);
      s.wingA.draw(ctx, 'dotsCoral', { shadow: 0.5 });
      s.wingB.draw(ctx, 'mustard', { shadow: 0.5 });
      ctx.restore();
    }
    inkLine(ctx, [[0, -16], [0, 14]], 5, PAL.ink, 3, 0.4);
    inkLine(ctx, qpts(0, -16, -6, -30, -13, -35, 5), 2, PAL.ink, 4, 0.3);
    inkLine(ctx, qpts(0, -16, 6, -30, 13, -35, 5), 2, PAL.ink, 5, 0.3);
  });
}

function drawFlower(ctx, t) {
  const s = SD.s4, T = TL.s4;
  if (t < T.grow[0]) return;
  const g = E.out(prog(t, T.grow[0], T.grow[1]));
  const pts = upto(s.stem, g);
  inkLine(ctx, pts, 16, '#2f5d33', 41, 0.8);
  inkLine(ctx, pts, 11, '#5da04a', 42, 0.8);
  inkLine(ctx, pts.map(([x, y]) => [x - 2.5, y]), 3, '#a4d67f', 43, 0.6);
  [[0.3, -1, 1.05, -0.2], [0.52, 1, 1.15, 0.15], [0.74, -1, 0.8, -0.35]].forEach(([pp, dir, sc, rot], i) => {
    const k = E.back(prog(t, T.leaves[i], T.leaves[i] + 0.3));
    if (k <= 0 || g < pp) return;
    const [x, y] = pointAt(s.stem, pp);
    at(ctx, x, y, rot * dir + Math.sin(t * 2 + i) * 0.05, k * sc, () => {
      ctx.scale(dir, 1);
      s.leaf.draw(ctx, 'leaf', { shadow: 0.7, ink: 1.6 });
      inkLine(ctx, qpts(4, -2, 40, -17, 80, -19, 8), 1.8, '#3f7d47', 44 + i, 0.4);
    });
  });
  const [hx, hy] = pointAt(s.stem, g);
  if (t < T.bloom - 0.05) {
    at(ctx, hx, hy, 0, clamp(g * 1.4), () => s.bud.draw(ctx, 'darkleaf', { shadow: 0.5 }));
    return;
  }
  at(ctx, hx, hy, Math.sin(t * 1.4) * 0.04, 1, () => {
    s.petals.forEach((pc, i) => {
      const k = E.back(prog(t, T.bloom + i * 0.035, T.bloom + i * 0.035 + 0.3));
      if (k <= 0) return;
      at(ctx, 0, 0, (i * TAU) / s.petals.length, k, () => { ctx.translate(0, -26); pc.p.draw(ctx, pc.f, { shadow: 0.6 }); });
    });
    const kc = E.back(prog(t, T.bloom - 0.05, T.bloom + 0.25));
    at(ctx, 0, 0, 0, kc, () => {
      s.center.draw(ctx, 'orange', { shadow: 0.8, ink: 2 });
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 13, -4, 6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 6, 10, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      ctx.fillStyle = 'rgba(228,80,70,0.45)';
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 24, 8, 6, 4, 0, 0, TAU); ctx.fill(); }
    });
  });
}

function drawCan(ctx, t) {
  const T4 = TL.s4, can = SD.s4.can;
  if (t < T4.can) return;
  if (t < 25.35) {
    const pop = E.back(prog(t, T4.can, T4.can + 0.15));
    const tilt = E.inOut(prog(t, 24.2, 24.4)) * (1 - E.inOut(prog(t, 25.1, 25.3)));
    const px = lerp(1010, PIP_WATER_X, E.inOut(prog(t, 24.05, 24.3)));
    at(ctx, px - 64, 805, -0.55 * tilt, 0.82 * pop, () => { ctx.scale(-1, 1); drawComp(ctx, can); });
    const c = Math.cos(-0.55), sn = Math.sin(-0.55), lx = -104 * 0.82, ly = -84 * 0.82;
    const tip = [PIP_WATER_X - 64 + lx * c - ly * sn, 805 + lx * sn + ly * c];
    T4.drops.forEach((td, i) => {
      const u = prog(t, td, td + 0.3);
      if (u <= 0 || u >= 1) return;
      const x = lerp(tip[0], 930 + (i - 2) * 6, u), y = lerp(tip[1], 880, E.in(u));
      ctx.fillStyle = 'rgba(90,150,215,0.85)';
      ctx.beginPath();
      ctx.moveTo(x, y - 12);
      ctx.quadraticCurveTo(x + 7, y, x, y + 5);
      ctx.quadraticCurveTo(x - 7, y, x, y - 12);
      ctx.fill();
    });
  } else at(ctx, 1165, GY.s4 + 14, 0, 0.8, () => { ctx.scale(-1, 1); drawComp(ctx, can); });
}

function drawSeed(ctx, t, pip) {
  const s = SD.s4, T4 = TL.s4;
  if (t >= T4.grow[0] + 0.2) return;
  let x, y;
  if (t < T4.plant - 0.05) {
    const hand = pip.armR;
    [x, y] = toWorld(pip, hand.x - 4, hand.y - 12);
  } else {
    const u = prog(t, T4.plant - 0.05, T4.plant + 0.08);
    [x, y] = [930, lerp(850, 878, u)];
  }
  if (t >= T4.plant) at(ctx, 930, 887, 0, E.back(prog(t, T4.plant, T4.plant + 0.2)), () => s.mound.draw(ctx, 'soil', { shadow: 0.5 }));
  if (t < T4.plant + 0.1 || t < T4.grow[0]) {
    glow(ctx, x, y, 60 + Math.sin(t * 8) * 6, '255,226,150', t < T4.plant ? 0.55 : 0.3);
    if (t < T4.plant + 0.1) at(ctx, x, y, t * 2, 1, () => s.seed.draw(ctx, 'gold', { shadow: 0.5 }));
  }
}

function drawCanopy(ctx, t, pip) {
  const T5 = TL.s5;
  const grow = E.out(prog(t, T5.leaf[0], T5.leaf[0] + 0.3)), shrink = 1 - E.inOut(prog(t, 35.25, 35.7));
  if (grow <= 0 || shrink <= 0) return null;
  const [hx, hy] = toWorld(pip, 1, -238);
  const top = [hx - 8, hy - 105];
  const stem = qpts(hx, hy, hx + 16, hy - 55, top[0], top[1], 12);
  inkLine(ctx, upto(stem, grow * shrink), 8, '#3f7d3a', 61, 0.6);
  inkLine(ctx, upto(stem, grow * shrink), 4.5, '#6fb24f', 62, 0.5);
  const k = E.back(prog(t, T5.leaf[0] + 0.15, T5.leaf[1])) * shrink;
  if (k <= 0) return null;
  at(ctx, top[0], top[1], -0.12 + Math.sin(t * 2.2) * 0.02, k, () => {
    SD.s4.bigLeaf.draw(ctx, 'leaf', { shadow: 1.2 });
    inkLine(ctx, qpts(6, -2, 230, -84, 462, -30, 16), 3, '#3f7d47', 63, 0.6);
    for (let i = 1; i <= 6; i++) {
      const [x, y] = pointAt(qpts(6, -2, 230, -84, 462, -30, 16), i / 7);
      inkLine(ctx, [[x, y], [x + 34, y - 48 + i * 3]], 2, '#3f7d47', 64 + i, 0.4);
      inkLine(ctx, [[x, y], [x + 30, y + 22 - i * 2]], 2, '#3f7d47', 70 + i, 0.4);
    }
  });
  return { x0: top[0] - 20, x1: top[0] + 470 * k, y: top[1] - 10 };
}

function drawRain(ctx, t, view, amt, shelter) {
  const n = Math.floor(200 * amt), w = view.x1 - view.x0 + 300, hgt = view.y1 - view.y0 + 300;
  ctx.save();
  ctx.lineCap = 'round';
  for (const [col, lw, off] of [['rgba(64,98,150,0.55)', 4.2, 0], ['rgba(200,222,245,0.75)', 1.6, -1]]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = 1250 + hash(i * 3 + 2) * 500;
      const y = view.y0 - 150 + ((hash(i * 3 + 3) * hgt + t * sp) % hgt);
      const x = view.x0 - 150 + hash(i * 3 + 1) * w - (y - view.y0) * 0.16;
      if (shelter && x > shelter.x0 && x < shelter.x1 && y > shelter.y) continue;
      ctx.moveTo(x + off, y);
      ctx.lineTo(x - 7 + off, y + 36);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawGarden(ctx, t, view) {
  const s = SD.s4, T4 = TL.s4, T5 = TL.s5;
  const camX = 760 * E.inOut(prog(t, T5.pan[0], T5.pan[1]));
  const storm = prog(t, T5.clouds[0], T5.clouds[1]) * (1 - prog(t, T5.clear[0], T5.clear[1]));
  bgFill(ctx, view, 'peach');
  const sx = 250 - camX * 0.15;
  glow(ctx, sx, 190, 430, '255,244,210', 0.4 * (1 - storm));
  at(ctx, sx, 190, 0, 1, () => {
    for (let i = 0; i < 14; i++) at(ctx, 0, 0, (i * TAU) / 14 + t * 0.25, 1, () => { ctx.translate(0, -112); s.sunRay.draw(ctx, 'orange', { shadow: 0.6 }); });
    s.sunDisc.draw(ctx, 'mustard', { shadow: 1 });
    sunFace(ctx, 0, 4, 1);
  });
  for (const c of s.cloudsW) at(ctx, c.x + (t - 22.5) * c.v - camX * 0.3, c.y, 0, 1, () => c.p.draw(ctx, 'white', { shadow: 0.8 }));
  if (between(t, 23.2, 28.8)) drawBird(ctx, lerp(-160, 2150, prog(t, 23.2, 28.8)), 330 + Math.sin(t * 1.7) * 36, t);
  ctx.save();
  ctx.translate(-camX * 0.5, 0);
  s.hills.draw(ctx, 'grass', { shadow: 1 });
  for (const tr of s.trees) {
    inkLine(ctx, [[tr.x, tr.y], [tr.x + 2, tr.y - 70 * tr.k]], 7 * tr.k, '#6b4630', tr.x | 0, 0.5);
    at(ctx, tr.x, tr.y - 92 * tr.k, 0, tr.k, () => tr.top.draw(ctx, 'darkleaf', { shadow: 0.7 }));
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-camX, 0);
  const rv = E.inOut(prog(t, T5.rainbow[0], T5.rainbow[1]));
  if (rv > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(1980, 1015);
    ctx.arc(1980, 1015, 1500, Math.PI, Math.PI + Math.PI * rv);
    ctx.closePath();
    ctx.clip();
    for (const b of s.rainbow) at(ctx, 1980, 1015, 0, 1, () => b.p.draw(ctx, b.f, { shadow: 0.8 }));
    ctx.restore();
  }
  at(ctx, 1300, GY.s4 + 1500, 0, 1, () => s.ground.draw(ctx, 'leaf', { shadow: 1 }));
  for (const [x, y] of s.tufts) tuft(ctx, x, y, '#2f6a35');
  drawPosies(ctx);
  ctx.restore();
  if (storm > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(92,104,132,${0.55 * storm})`;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    ctx.restore();
  }
  for (const c of s.cloudsG) {
    const inn = E.out(prog(t, T5.clouds[0] + c.d, T5.clouds[1] + c.d));
    const out = E.in(prog(t, T5.clear[0] + c.d * 0.5, T5.clear[1] + c.d * 0.5));
    if (inn <= 0 || out >= 1) continue;
    at(ctx, c.x + (1 - inn) * 1700 + out * 1900 - camX * 0.3, c.y, 0, 1, () => c.p.draw(ctx, c.f, { shadow: 1.2 }));
  }

  ctx.save();
  ctx.translate(-camX, 0);
  drawFlower(ctx, t);
  const pip = pipG(t), lou = louG(t);
  if (t >= T5.heart - 0.1) {
    const M = [(pip.x + lou.x) / 2 + 4, GY.s4 - 118];
    pip.armR = Object.assign(toLocal(pip, M[0], M[1]), { b: 6 });
    lou.armR = Object.assign(toLocal(lou, M[0], M[1]), { b: 6 });
  }
  drawCan(ctx, t);
  at(ctx, 2085, GY.s4 + 4, 0, 0.95, () => drawComp(ctx, s.stump));
  drawChar(ctx, LOOKS.lou, lou);
  drawChar(ctx, LOOKS.pip, pip);
  drawSeed(ctx, t, pip);
  const shelter = drawCanopy(ctx, t, pip);
  if (t >= T5.heart) {
    const k = E.back(prog(t, T5.heart, T5.heart + 0.3)), y = 600 - (t - T5.heart) * 26;
    at(ctx, 1962, y, Math.sin(t * 3) * 0.1, k * (1 + 0.06 * Math.sin(t * 9)), () => s.heart.draw(ctx, 'red', { shadow: 0.9 }));
  }
  if (between(t, 27.9, 31)) { const [bx, by] = butterflyAt(t); drawButterfly(ctx, bx, by, t); }
  at(ctx, 1300, 1000 + 1500, 0, 1, () => s.front.draw(ctx, 'darkleaf', { shadow: 1 }));
  ctx.restore();

  const rain = prog(t, T5.rain[0], T5.rain[0] + 0.6) * (1 - prog(t, T5.clear[0], T5.clear[1] - 0.25));
  if (rain > 0) drawRain(ctx, t, view, rain, shelter && { x0: shelter.x0 - camX, x1: shelter.x1 - camX, y: shelter.y });
  s.cap1.draw(ctx, t);
  s.cap2.draw(ctx, t);
}

// ============================================================ scene 6 — the montage of answers

function build6() {
  const s = (SD.s6 = {});
  s.names = ['LOVE', 'LEARN', 'PLAY', 'HELP', 'WONDER', 'CREATE'];
  s.words = s.names.map((w, i) => makeWord(w, 120, 600 + i * 37));
  s.to = new Hand('to', 64, { seed: 61 });
  s.bgs = ['pink', 'teal', 'mustard', 'sky', 'night', 'cream'];
  s.light = [false, true, false, false, true, false];
  s.from = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 0], [-1, 0]];
  const kinds = ['star', 'sparkle', 'spiral', 'heart', 'star', 'sparkle', 'loop'];
  s.deco = s.names.map((_, k) => {
    const r = rng(660 + k), out = [];
    for (let i = 0; i < 7; i++) {
      const edge = i % 2 ? [80 + r() * 260, 1580 + r() * 260][i % 4 < 2 ? 0 : 1] : 120 + r() * 1680;
      out.push({ k: kinds[(i + k) % kinds.length], x: edge, y: i % 2 ? 320 + r() * 600 : 900 + r() * 120, r: 14 + r() * 16 });
    }
    return out;
  });
  s.bigHeart = P.poly(heartPts(190), { cut: 1.4, torn: 3, rim: 3.5, seed: 610 });
  s.miniHeart = P.poly(heartPts(24), { cut: 0.8, seed: 611 });
  s.cover = P.svg('M -318 4 Q -160 -18 0 12 Q 160 -18 318 4 L 318 222 Q 160 200 0 226 Q -160 200 -318 222 Z', { cut: 1.2, seed: 614 });
  s.pageL = P.svg('M 0 0 Q -150 -30 -300 -8 L -300 200 Q -150 180 0 206 Z', { cut: 1, seed: 612 });
  s.pageR = P.svg('M 0 0 Q 150 -30 300 -8 L 300 200 Q 150 180 0 206 Z', { cut: 1, seed: 613 });
  s.abc = makeWord('abc?!', 70, 640);
  s.kite = comp([
    { poly: [[0, -92], [64, 0], [0, 0]], f: 'coral' }, { poly: [[64, 0], [0, 104], [0, 0]], f: 'teal' },
    { poly: [[0, 104], [-64, 0], [0, 0]], f: 'news' }, { poly: [[-64, 0], [0, -92], [0, 0]], f: 'paper' },
    { line: [[0, -92], [0, 104]], w: 2.5 }, { line: [[-64, 0], [64, 0]], w: 2.5 },
  ]);
  s.bowL = P.poly([[0, 0], [-15, -10], [-15, 10]], { cut: 0.5, seed: 615 });
  s.bowR = P.poly([[0, 0], [15, -10], [15, 10]], { cut: 0.5, seed: 616 });
  s.ball = P.ellipse(40, 40, { cut: 1, seed: 620 });
  s.ledge = P.box(0, 0, 1500, 800, { torn: 5, rim: 3, edges: [1, 0, 0, 1], seed: 621 });
  s.ledgeTop = P.box(-8, -14, 1520, 34, { torn: 4, rim: 2.5, edges: [1, 0, 1, 1], seed: 622 });
  s.planet = P.ellipse(74, 74, { cut: 1, torn: 2, rim: 2.5, seed: 623 });
  const ringPts = (a0, a1) => { const p = []; for (let a = a0; a <= a1; a += 6) p.push([Math.cos((a * Math.PI) / 180) * 128, Math.sin((a * Math.PI) / 180) * 30]); return p; };
  s.ringBack = P.stroke(ringPts(180, 360), 9, { cut: 0.8, seed: 624 });
  s.ringFront = P.stroke(ringPts(0, 180), 9, { cut: 0.8, seed: 625 });
  const sr = rng(630);
  s.splats = [[330, 420], [620, 330], [1540, 360], [1720, 520], [300, 760], [1240, 330], [860, 880], [1500, 860]].map(([x, y], i) => ({
    x, y, rot: sr() * TAU, s: 0.8 + sr() * 0.6, f: ['coral', 'teal', 'mustard', 'lilac', 'pink', 'blue', 'orange', 'leaf'][i],
    p: P.poly(blobPts(46, 631 + i), { cut: 0.8, seed: 640 + i }),
  }));
  s.band = cpts([330, 700], [720, 470], [1180, 830], [1620, 560], 60);
  s.brush = comp([
    { rect: [-8, -210, 16, 150], f: 'brown' }, { rect: [-11, -66, 22, 34], f: 'gray' },
    { svg: 'M -12 -34 Q -16 -6 0 8 Q 16 -6 12 -34 Z', f: 'ink' },
  ]);
  s.palette = P.svg('M -70 -10 Q -76 -54 -20 -58 Q 50 -64 70 -24 Q 84 8 50 30 Q 20 48 -20 40 Q -2 20 -26 8 Q -54 2 -70 -10 Z', { cut: 1, seed: 650 });
  s.dab = [[-40, -30, 'coral'], [-6, -40, 'mustard'], [30, -34, 'teal'], [48, -4, 'lilac']].map(([x, y, f], i) => ({ x, y, f, p: P.circleAt(x, y, 11, { cut: 0.6, seed: 651 + i }) }));
}

const glasses = (c) => {
  c.save();
  c.strokeStyle = PAL.ink;
  c.lineWidth = 3;
  for (const sx of [-15, 15]) { c.beginPath(); c.arc(sx, -182, 12.5, 0, TAU); c.stroke(); }
  c.beginPath(); c.moveTo(-3, -184); c.lineTo(3, -184); c.stroke();
  c.restore();
};

function card0(ctx, u, t) {
  const s = SD.s6, beat = Math.pow(1 - ((t / BEAT) % 1), 4);
  at(ctx, 960, 590, Math.sin(t * 2) * 0.03, 1 + 0.06 * beat, () => s.bigHeart.draw(ctx, 'red', { shadow: 1.4 }));
  for (let i = 0; i < 8; i++) {
    const x = 330 + i * 180 + Math.sin(u * 3 + i) * 24, y = 1010 - ((u * 260 + i * 97) % 760);
    at(ctx, x, y, Math.sin(u * 4 + i) * 0.35, 0.7 + (i % 3) * 0.25, () => s.miniHeart.draw(ctx, i % 2 ? 'red' : 'paper', { shadow: 0.6 }));
  }
  const hug = { x: 70, y: -128, b: 14 };
  drawChar(ctx, LOOKS.lou, { x: 1026, y: 935, s: 1.18, face: -1, lean: 0.12, eyes: 'happy', mouth: 'smile', armL: [0.5, 8], armR: hug });
  drawChar(ctx, LOOKS.pip, { x: 894, y: 935, s: 1.18, face: 1, lean: 0.12, eyes: 'happy', mouth: 'smile', armL: [0.5, 8], armR: hug, sway: Math.sin(t * 4) * 0.12 });
}

function card1(ctx, u, t) {
  const s = SD.s6, look = u > 0.3;
  const pip = { x: 960, y: 952, s: 1.3, eyes: look ? 'wide' : 'open', mouth: look ? 'o' : 'smile', ly: look ? -0.9 : 0.8, armL: { x: -64, y: -122, b: 6 }, armR: { x: 64, y: -122, b: 6 }, hat: glasses };
  drawChar(ctx, LOOKS.pip, pip);
  at(ctx, 960, 800, 0, 1, () => {
    s.cover.draw(ctx, 'brown', { shadow: 1.2 });
    s.pageL.draw(ctx, 'paper', { shadow: 0.5 });
    s.pageR.draw(ctx, 'paper', { shadow: 0.5 });
    for (let r = 0; r < 7; r++) for (const side of [-1, 1]) {
      const y = 26 + r * 24, x0 = side * 26, x1 = side * (250 - (r === 6 ? 110 : 0));
      inkLine(ctx, [[x0, y + (side > 0 ? -2 : -2)], [x1, y - 8]], 2.2, 'rgba(60,50,40,0.45)', r * 2 + side, 1);
    }
  });
  for (const side of [-1, 1]) {
    const [hx, hy] = toWorld(pip, side * 64, -122);
    at(ctx, hx, hy, 0, 1.3, () => LOOKS.pip.pHand.draw(ctx, 'paper', { shadow: 0.5 }));
  }
  const tg = [[560, 480], [760, 395], [1150, 385], [1370, 465], [1560, 570]];
  s.abc.tiles.forEach((tl, i) => {
    const a = prog(u, 0.08 + i * 0.09, 0.5 + i * 0.09);
    if (a <= 0) return;
    const e = E.out(a);
    at(ctx, lerp(960, tg[i][0], e), lerp(790, tg[i][1], e) - Math.sin(Math.PI * e) * 120, tl.rot + (1 - e) * 2, lerp(0.3, 1, e), () => drawTile(ctx, tl));
  });
  if (u > 0.55) {
    const k = E.back(prog(u, 0.55, 0.75));
    at(ctx, 960, 470, 0, k, () => {
      ctx.fillStyle = 'rgba(255,232,120,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
      inkLine(ctx, ellipsePts(0, 0, 30, 30, 20).concat([[30, 0]]), 3, PAL.ink, 81, 0.6);
      inkLine(ctx, [[-10, 26], [-10, 44], [10, 44], [10, 26]], 3, PAL.ink, 82, 0.5);
      inkLine(ctx, [[-8, 8], [-4, -6], [0, 8], [4, -6], [8, 8]], 2.4, PAL.ink, 83, 0.4);
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.5; inkLine(ctx, [[Math.cos(a) * 42, Math.sin(a) * 42], [Math.cos(a) * 58, Math.sin(a) * 58]], 3, '#fff6d8', 84 + i, 0.4); }
    });
  }
}

function card2(ctx, u, t) {
  const s = SD.s6;
  at(ctx, 960, 945 + 1500, 0, 1, () => SD.s2.ground.draw(ctx, 'grass', { shadow: 1 }));
  const hop = Math.abs(Math.sin((Math.PI * (t - TL.s6.t0)) / BEAT));
  const pip = { x: 720, y: 945, s: 1.15, bob: -56 * hop, eyes: 'happy', mouth: 'grin', armL: [0.9, 8], armR: { x: 52, y: -252, b: -10 }, legL: 0.3 * hop, legR: -0.3 * hop, sway: 0.2 * Math.sin(t * 5), ly: -0.6, lx: 0.8 };
  const [hx, hy] = toWorld(pip, 52, -252);
  const kx = 1330 + Math.sin(t * 2.3) * 70, ky = 370 + Math.sin(t * 3.4) * 34, kr = 0.25 + Math.sin(t * 2.3) * 0.18;
  const bx = kx - Math.sin(kr) * 104, by = ky + Math.cos(kr) * 104;
  inkLine(ctx, qpts(hx, hy, (hx + bx) / 2, Math.max(hy, by) + 40, bx, by, 16), 2, PAL.ink, 71, 0.6);
  const tail = [];
  for (let i = 0; i <= 14; i++) tail.push([bx + Math.sin(i * 0.7 - t * 8) * 16 - i * 3, by + i * 14]);
  inkLine(ctx, tail, 2.2, PAL.ink, 72, 0.5);
  [4, 9, 13].forEach((j, n) => at(ctx, tail[j][0], tail[j][1], Math.sin(t * 6 + j) * 0.3, 1, () => {
    const f = ['coral', 'teal', 'pink'][n];
    s.bowL.draw(ctx, f, { shadow: 0.4 });
    s.bowR.draw(ctx, f, { shadow: 0.4 });
  }));
  at(ctx, kx, ky, kr, 1, () => drawComp(ctx, s.kite));
  drawChar(ctx, LOOKS.pip, pip);
  const bh = Math.abs(Math.cos((Math.PI * (t - TL.s6.t0)) / BEAT));
  at(ctx, 1450, 945 - 40 - 230 * bh, t * 4, 1, () => s.ball.draw(ctx, 'stripeMint', { shadow: 0.8, ink: 2 }));
  drawChar(ctx, LOOKS.lou, { x: 1640, y: 945, s: 1.1, face: -1, eyes: 'happy', mouth: 'grin', armL: [2.6, 6], armR: [2.4, 6], bob: -30 * bh, lx: 1, ly: -0.5 });
}

function card3(ctx, u, t) {
  const s = SD.s6;
  at(ctx, 960, 1040 + 1500, 0, 1, () => SD.s2.ground.draw(ctx, 'grass', { shadow: 1 }));
  at(ctx, 1010, 640, 0, 1, () => { s.ledge.draw(ctx, 'kraft', { shadow: 1.4 }); s.ledgeTop.draw(ctx, 'grass', { shadow: 0.6 }); });
  const k = E.inOut(prog(u, 0.1, 0.85));
  const pip = { x: 1175, y: 648, s: 1.1, face: -1, lean: lerp(0.45, 0.1, k), eyes: k < 1 ? 'squeeze' : 'happy', mouth: k < 1 ? 'flat' : 'grin', lx: 1, ly: lerp(1, 0.2, k), armL: [0.5, 8] };
  const lou = { x: lerp(905, 1080, k), y: lerp(1040, 648, E.out(k)), s: 1.1, face: 1, eyes: 'open', mouth: k < 1 ? 'o' : 'smile', lx: 1, ly: lerp(-1, 0, k), legL: lerp(0.4, 0.06, k), legR: lerp(-0.3, -0.06, k), armL: [lerp(1.2, 0.4, k), 6] };
  const M = [lerp(1050, 1122, k), lerp(760, 560, k)];
  pip.armR = Object.assign(toLocal(pip, M[0], M[1]), { b: 4 });
  lou.armR = Object.assign(toLocal(lou, M[0], M[1]), { b: -4 });
  drawChar(ctx, LOOKS.lou, lou);
  drawChar(ctx, LOOKS.pip, pip);
  if (k >= 1) for (let i = 0; i < 4; i++) { const a = i * 1.7 + u * 3; sparkle(ctx, M[0] + Math.cos(a) * 70, M[1] - 40 + Math.sin(a) * 40, 12, '#fffaf0', 3, i); }
}

function card4(ctx, u, t) {
  const s = SD.s6;
  for (let i = 12; i < SD.s3.stars.length; i++) { const st = SD.s3.stars[i]; drawStar3(ctx, st, st.x, st.y, 1 + 0.3 * Math.sin(t * st.sp + st.ph)); }
  glow(ctx, 1260, 470, 260, '255,230,190', 0.35);
  for (const arm of [0, Math.PI]) crayon(ctx, spiralPts(1260, 470, 230, 1.35, 50, -t * 0.9 + arm), 12, 'rgba(255,238,205,0.95)', arm ? 91 : 92, 0.9);
  at(ctx, 560, 400, -0.3, 1, () => {
    s.ringBack.draw(ctx, 'mustard', { shadow: 0.5 });
    s.planet.draw(ctx, 'halftoneCoral', { shadow: 0.8 });
    s.ringFront.draw(ctx, 'mustard', { shadow: 0.5 });
  });
  const sh = prog(u, 0.15, 0.6);
  if (sh > 0 && sh < 1) crayon(ctx, [[lerp(1500, 1800, sh) - 160, lerp(120, 250, sh) - 70], [lerp(1500, 1800, sh), lerp(120, 250, sh)]], 6, 'rgba(255,230,160,0.9)', 93, 1);
  at(ctx, 960, 975 + 1500, 0, 1, () => SD.s2.ground.draw(ctx, 'navy', { shadow: 1 }));
  drawChar(ctx, LOOKS.pip, { x: 820, y: 975, s: 1.2, face: 1, eyes: 'wide', mouth: 'o', lx: 0.7, ly: -1, tilt: 0.12, armR: [2.7, -6], armL: [0.4, 8] });
}

function card5(ctx, u, t) {
  const s = SD.s6;
  s.splats.forEach((sp, i) => {
    const tt = i * (BEAT / 2) * 0.9;
    const k = E.back(prog(u, tt, tt + 0.15));
    if (k > 0) at(ctx, sp.x, sp.y, sp.rot, k * sp.s, () => sp.p.draw(ctx, sp.f, { shadow: 0.6 }));
  });
  const g = E.inOut(prog(u, 0.02, 1.05));
  const cols = ['#e35a43', '#ee8a3b', '#f0b43a', '#2f9a92', '#8d74c9'];
  cols.forEach((c, j) => {
    const off = (j - 2) * 15;
    const pts = s.band.map(([x, y], i) => {
      const [x0, y0] = s.band[Math.max(0, i - 1)], [x1, y1] = s.band[Math.min(s.band.length - 1, i + 1)];
      const d = Math.hypot(x1 - x0, y1 - y0) || 1;
      return [x - ((y1 - y0) / d) * off, y + ((x1 - x0) / d) * off];
    });
    crayon(ctx, upto(pts, g), 20, c, 95 + j, 1.2);
  });
  const [bx, by] = pointAt(s.band, Math.max(0.01, g));
  at(ctx, bx, by, 0.5 + Math.sin(t * 8) * 0.12, 1.1, () => drawComp(ctx, s.brush));
  at(ctx, 960, 960 + 1500, 0, 1, () => SD.s2.ground.draw(ctx, 'kraft', { shadow: 1 }));
  const pip = { x: 400, y: 960, s: 1.15, face: 1, eyes: 'happy', mouth: 'smile', armR: { x: 64, y: -118, b: -6 }, armL: [0.4, 8], lx: 1, ly: -0.5 };
  drawChar(ctx, LOOKS.pip, pip);
  const [px, py] = toWorld(pip, 70, -122);
  at(ctx, px + 20, py, -0.2, 0.9, () => { s.palette.draw(ctx, 'kraft', { shadow: 0.8, ink: 2 }); for (const d of s.dab) d.p.draw(ctx, d.f, { shadow: 0.3 }); });
  drawChar(ctx, LOOKS.lou, { x: 1560, y: 960, s: 1.15, face: -1, eyes: 'happy', mouth: 'grin', armL: [2.6, 6], armR: [2.5, 6], bob: hopBob(t, [42.5, 43.75, 44.375], 40, 0.36), lx: 1, ly: -0.5 });
}

function drawCard(ctx, k, t, view) {
  const s = SD.s6, T0 = TL.s6.t0 + k * TL.s6.len, u = t - T0;
  bgFill(ctx, view, s.bgs[k]);
  const dc = s.light[k] ? 'rgba(255,248,235,0.5)' : 'rgba(43,36,32,0.3)';
  for (const d of s.deco[k]) doodle(ctx, d, 1, dc, 3);
  [card0, card1, card2, card3, card4, card5][k](ctx, u, t);
  const word = s.words[k], wx = 1010, wy = 196;
  s.to.draw(ctx, wx - word.w / 2 - 30, wy + 30, 1, { align: 1, col: s.light[k] ? '#fdf6e6' : PAL.ink, w: 1.1 });
  drawWord(ctx, word, wx, wy, 1, T0 + 0.02, t, 0.06);
}

function draw6(ctx, t, view) {
  const t0 = TL.s6.t0, L = TL.s6.len;
  const k = clamp(Math.floor((t - t0 + 0.12) / L), 0, 5);
  const Tk = t0 + k * L, p = prog(t, Tk - 0.12, Tk + 0.06);
  if (k === 0 || p >= 1) { drawCard(ctx, k, t, view); return; }
  drawCard(ctx, k - 1, t, view);
  const [fx, fy] = SD.s6.from[k], e = 1 - E.out(p);
  ctx.save();
  ctx.translate(fx * (view.x1 - view.x0) * e, fy * (view.y1 - view.y0) * e);
  ctx.fillStyle = 'rgba(30,18,8,0.3)';
  ctx.fillRect(view.x0 + 16, view.y0 + 18, view.x1 - view.x0, view.y1 - view.y0);
  ctx.beginPath();
  ctx.rect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  ctx.clip();
  drawCard(ctx, k, t, view);
  ctx.restore();
}

// ============================================================ scene 7 — the finale

const HEART = { y: 505, dx: 46, rot: 0.45, fillY: 428 };

function build7() {
  const s = (SD.s7 = {});
  s.heart = P.poly(heartPts(168), { cut: 1.3, torn: 3, rim: 3.5, seed: 701 });
  s.cap = new Caption([
    { text: "Maybe life doesn't come with a purpose...", write: TL.s7.write1 },
    { text: '...we give it one.', write: TL.s7.write2 },
  ], { x: 960, y: 150, rot: -0.015, tIn: TL.s7.card, cap: 44, seed: 71, center: true });
  s.fin = new Hand('fin.', 72, { seed: 72, slant: 0.18 });
  s.stampBox = P.rect(250, 124, { cut: 2.2, seed: 703 });
  s.border = [[235, 360, -0.1], [1685, 360, 0.09], [215, 545, 0.07], [1705, 545, -0.08], [240, 728, -0.05], [1680, 728, 0.1]];
  s.ground = P.rect(3600, 3000, { torn: 7, rim: 4, edges: [1, 0, 0, 0], seed: 702 });
  const r = rng(707);
  s.confetti = [];
  for (let i = 0; i < 80; i++) {
    s.confetti.push({
      x: r() * 2400 - 240, y0: -40 - r() * 520, v: 200 + r() * 170, sw: 20 + r() * 40, ph: r() * TAU, vr: (r() - 0.5) * 8,
      f: ['coral', 'mustard', 'teal', 'pink', 'lilac', 'sky', 'news', 'leaf'][i % 8],
      p: P.rect(12 + r() * 14, 8 + r() * 10, { cut: 0.5, step: 6, seed: 720 + i }),
    });
  }
}

function draw7(ctx, t, view) {
  const s = SD.s7, T = TL.s7;
  bgFill(ctx, view, 'kraft');
  for (const d of SD.s1.doodles) doodle(ctx, d, 1);
  for (const sc of SD.s1.scraps) at(ctx, sc.x, sc.y, sc.r, 1, () => {
    sc.p.draw(ctx, sc.f, { shadow: 1.2 });
    if (sc.tape) tape(ctx, sc.tape[0], sc.tape[1], sc.tape[2], 1, 0);
  });
  s.border.forEach(([x, y, r], i) => {
    const a = E.back(prog(t, T.words + i * 0.06, T.words + i * 0.06 + 0.4));
    if (a <= 0) return;
    at(ctx, lerp(x < 960 ? -320 : 2240, x, a), y, r + (1 - a) * 0.8, 0.42, () => drawWord(ctx, SD.s6.words[i], 0, 0, 1, -1, 1));
  });

  const u = E.inOut(prog(t, T.slide[0], T.slide[1]));
  const fin = prog(t, T.final, T.final + 0.5);
  const beat = t > T.heart ? Math.pow(1 - (((t - T.heart) / BEAT) % 1), 4) * 0.035 : 0;
  const hk = E.back(prog(t, T.heart, T.heart + 0.3));
  if (hk > 0) at(ctx, 960, HEART.fillY, 0, hk * (1 + beat + 0.08 * Math.sin(Math.PI * fin)), () => s.heart.draw(ctx, 'dotsCoral', { shadow: 1.1 }));
  const dotS = 1 - E.in(prog(t, T.heart, T.heart + 0.2));
  for (const side of [1, -1]) {
    const tq = side > 0 ? T.q1 : T.q2;
    if (t < tq - 0.25) continue;
    const f = prog(t, tq - 0.25, tq), d = t - tq, sq = d > 0 ? 1 - 0.2 * Math.exp(-d * 8) * Math.cos(d * 28) : 1;
    const x = 960 + side * lerp(310, HEART.dx, u), rot = side * lerp(0.08, HEART.rot, u);
    drawQMark(ctx, x, lerp(-430, HEART.y, E.in(f)), 1, rot + (1 - f) * 0.4 * side, side > 0 ? 'red' : 'teal',
      { mirror: side < 0, sx: 2 - sq, sy: sq, dotS });
    const pd = prog(t, T.heart, T.heart + 0.45);
    if (pd > 0 && pd < 1) {
      const c = Math.cos(rot), sn = Math.sin(rot), lx = 4 * side, ly = 172;
      sparkle(ctx, x + lx * c - ly * sn, HEART.y + lx * sn + ly * c, 10 + pd * 34, `rgba(255,250,236,${1 - pd})`, 3, side + 5);
    }
  }
  if (t > T.heart) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3, pr = prog(t, T.heart + 0.05, T.heart + 0.7);
    if (pr > 0 && pr < 1) doodleStar(ctx, 960 + Math.cos(a) * (230 + pr * 90), 440 + Math.sin(a) * (200 + pr * 80), 14, `rgba(255,250,236,${1 - pr})`, 3, i + 20);
  }

  const w = prog(t, T.slide[0], T.slide[1]);
  const pip = { x: lerp(610, 845, E.inOut(w)), y: GY.s7, s: 1.2, face: 1, lx: 0.6, ly: -1, eyes: 'open', mouth: 'smile', sway: Math.sin(t * 3) * 0.1 };
  const lou = { x: lerp(1310, 1075, E.inOut(w)), y: GY.s7, s: 1.2, face: -1, lx: 0.6, ly: -1, eyes: 'open', mouth: 'smile' };
  if (w > 0 && w < 1) { Object.assign(pip, walkPose(w * TAU * 2, 0.8)); Object.assign(lou, walkPose(w * TAU * 2 + 1, 0.8)); }
  if (t >= T.heart) {
    for (const c of [pip, lou]) { c.eyes = 'happy'; c.mouth = t < T.heart + 1.2 ? 'grin' : 'smile'; c.ly = -0.8; c.lx = 0.3; }
    const M = [961, GY.s7 - 138];
    pip.armR = Object.assign(toLocal(pip, M[0], M[1]), { b: 6 });
    lou.armR = Object.assign(toLocal(lou, M[0], M[1]), { b: 6 });
  }
  if (t >= T.final) {
    const b = -46 * Math.sin(Math.PI * fin);
    for (const c of [pip, lou]) { c.bob = b; c.armL = [lerp(0.3, 2.4, Math.sin(Math.PI * fin)), 6]; c.ly = 0; c.lx = 0; }
  }
  drawChar(ctx, LOOKS.pip, pip);
  drawChar(ctx, LOOKS.lou, lou);
  at(ctx, 960, GY.s7 + 1500, 0, 1, () => s.ground.draw(ctx, 'cream', { shadow: 1 }));
  s.cap.draw(ctx, t);

  if (t > T.final) {
    const dt = t - T.final;
    for (const c of s.confetti) {
      const y = c.y0 + dt * c.v;
      if (y > view.y1 + 40) continue;
      const x = c.x + Math.sin(dt * 2 + c.ph) * c.sw;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(c.ph + dt * c.vr);
      ctx.scale(Math.cos(dt * 6 + c.ph) || 0.05, 1);
      c.p.draw(ctx, c.f, { shadow: 0.4 });
      ctx.restore();
    }
  }
  if (t >= T.stamp) {
    const k = lerp(1.7, 1, E.out(prog(t, T.stamp, T.stamp + 0.12)));
    at(ctx, 1690, 968, -0.13, k, () => {
      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = '#c8302a';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 7;
      ctx.stroke(s.stampBox.face[BOIL % 3]);
      ctx.lineWidth = 2.5;
      ctx.save(); ctx.scale(0.9, 0.84); ctx.stroke(s.stampBox.ink[BOIL % 3]); ctx.restore();
      s.fin.draw(ctx, 0, 26, 1, { align: 0.5, col: '#c8302a', w: 1.4, alpha: 1 });
      ctx.restore();
    });
  }
}

// ============================================================ master render

const Film = {
  ready: false,
  init(ctx) {
    buildTextures(ctx);
    buildTapes();
    buildLooks();
    buildQMark();
    buildEdges();
    build1();
    build2();
    build3();
    build4();
    build6();
    build7();
    this.ready = true;
  },
  render(ctx, t, view) {
    const d1 = (v) => draw1(ctx, t, v), d2 = (v) => draw2(ctx, t, v), d3 = (v) => draw3(ctx, t, v);
    const d4 = (v) => drawGarden(ctx, t, v), d6 = (v) => draw6(ctx, t, v), d7 = (v) => draw7(ctx, Math.min(t, END), v);
    const x = (a) => prog(t, a[0], a[1]);
    if (t < TL.x12[0]) return d1(view);
    if (t < TL.x12[1]) return xSlideLeft(ctx, view, x(TL.x12), d1, d2);
    if (t < TL.x23[0]) return d2(view);
    if (t < TL.x23[1]) return xSlideDown(ctx, view, x(TL.x23), d2, d3);
    if (t < TL.x34[0]) return d3(view);
    if (t < TL.x34[1]) return xTear(ctx, view, x(TL.x34), d3, d4);
    if (t < TL.x56[0]) return d4(view);
    if (t < TL.x56[1]) return xSlideUp(ctx, view, x(TL.x56), d4, d6);
    if (t < TL.x67[0]) return d6(view);
    if (t < TL.x67[1]) return xRipUp(ctx, view, x(TL.x67), d6, d7);
    return d7(view);
  },
  cover(ctx, view) {
    draw1(ctx, 7.4, view);
  },
};

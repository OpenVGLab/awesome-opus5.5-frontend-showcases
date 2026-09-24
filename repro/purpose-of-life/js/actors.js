'use strict';
// The paper characters: cut-paper bodies, inked rubber-hose limbs, a face that can change expression.
// Local coordinates: feet on y = 0, head centre at (0, -178), shoulders at y = -124.

const LOOKS = {};
const POSE0 = {
  x: 0, y: 0, s: 1, face: 1, tilt: 0, lean: 0, bob: 0, sq: 1, sit: 0,
  armL: [0.28, 6], armR: [0.28, 6], legL: 0.06, legR: -0.06,
  eyes: 'open', mouth: 'smile', lx: 0, ly: 0, sprout: 1, sway: 0,
};

function makeLook(o) {
  const L = Object.assign({ skin: 'paper', feet: 'navy', trim: 'mustard' }, o);
  const s = o.seed;
  L.pBody = P.svg('M -21 -141 Q 0 -147 21 -141 Q 29 -137 31 -121 L 40 -56 Q 42 -46 33 -46 L -33 -46 Q -42 -46 -40 -56 L -31 -121 Q -29 -137 -21 -141 Z', { cut: 1.3, seed: s + 1 });
  L.pHead = P.poly(ellipsePts(0, -178, 45, 43), { cut: 0.9, seed: s + 2 });
  L.pHand = P.ellipse(9, 8.5, { cut: 0.5, seed: s + 3 });
  L.pFoot = P.ellipse(14, 7.5, { cut: 0.6, seed: s + 4 });
  L.pCollar = P.svg('M -25 -141 Q 0 -128 25 -141 L 24 -129 Q 0 -115 -24 -129 Z', { cut: 0.8, seed: s + 5 });
  L.pPocket = P.box(-14, -96, 22, 20, { cut: 0.8, seed: s + 6 });
  if (o.sprout) {
    L.pLeafA = P.svg('M 0 0 Q -8 -15 -27 -13 Q -18 3 0 0 Z', { cut: 0.6, seed: s + 7 });
    L.pLeafB = P.svg('M 0 0 Q 8 -15 27 -13 Q 18 3 0 0 Z', { cut: 0.6, seed: s + 8 });
  }
  if (o.bow) {
    L.pBowL = P.svg('M 0 0 L -24 -13 Q -29 0 -24 13 Z', { cut: 0.7, seed: s + 9 });
    L.pBowR = P.svg('M 0 0 L 24 -13 Q 29 0 24 13 Z', { cut: 0.7, seed: s + 10 });
    L.pKnot = P.ellipse(6.5, 6.5, { cut: 0.4, seed: s + 11 });
  }
  return L;
}

function buildLooks() {
  LOOKS.pip = makeLook({ body: 'coral', trim: 'mustard', pocket: 'news', seed: 300, sprout: true });
  LOOKS.lou = makeLook({ body: 'dotsTeal', trim: 'pink', pocket: 'mustard', seed: 400, bow: true });
}

// rubber-hose limb: a single inked curve between two points
function limb(ctx, x0, y0, x1, y1, bend, w, seed) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  inkLine(ctx, qpts(x0, y0, mx - (dy / L) * bend, my + (dx / L) * bend, x1, y1, 10), w, PAL.ink, seed, 0.6);
}

// arm/leg angles: 0 hangs straight down, PI/2 points sideways (away from the body), PI straight up
function handPos(side, arm) {
  const sx = side * 20, sy = -124;
  if (Array.isArray(arm)) return [sx + side * Math.sin(arm[0]) * 56, sy + Math.cos(arm[0]) * 56, -(arm[1] || 0) * side];
  return [arm.x, arm.y, -(arm.b || 0) * side];
}

function drawChar(ctx, L, q) {
  const p = Object.assign({}, POSE0, q);
  const lift = p.sit * 40;
  ctx.save();
  ctx.translate(p.x, p.y + p.bob);
  ctx.scale(p.s * p.face, p.s);
  if (p.sq !== 1) ctx.scale(1 + (1 - p.sq) * 0.7, p.sq);
  ctx.rotate(p.lean);

  // legs
  for (const side of [-1, 1]) {
    const a = side < 0 ? p.legL : p.legR;
    const hx = side * 12, hy = -50 + lift;
    let fx, fy, fr;
    if (p.sit) { fx = hx + 40 - side * 3; fy = hy + 12; fr = -0.15; }
    else { fx = hx + Math.sin(a) * 44; fy = hy + Math.cos(a) * 44; fr = a * 0.4; }
    limb(ctx, hx, hy, fx, fy, side * 3, 5.4, L.seed + side * 3);
    ctx.save();
    ctx.translate(fx + 5, fy - 3);
    ctx.rotate(fr);
    L.pFoot.draw(ctx, L.feet, { shadow: 0.5 });
    ctx.restore();
  }

  ctx.translate(0, lift);
  L.pBody.draw(ctx, L.body);
  L.pPocket.draw(ctx, L.pocket, { shadow: 0.35 });
  inkLine(ctx, [[-30, -54], [30, -54]], 1.6, 'rgba(255,248,235,0.75)', L.seed + 20, 0.4);
  L.pCollar.draw(ctx, L.trim, { shadow: 0.45 });

  // arms
  for (const side of [-1, 1]) {
    const [hx, hy, bend] = handPos(side, side < 0 ? p.armL : p.armR);
    limb(ctx, side * 20, -124, hx, hy, bend, 5.4, L.seed + 10 + side);
    ctx.save();
    ctx.translate(hx, hy);
    L.pHand.draw(ctx, L.skin, { shadow: 0.5 });
    ctx.restore();
  }

  // head
  ctx.save();
  ctx.translate(0, -136);
  ctx.rotate(p.tilt);
  ctx.translate(0, 136);
  if (L.sprout) drawSprout(ctx, L, p);
  L.pHead.draw(ctx, L.skin, { ink: 2.6 });
  drawFace(ctx, p);
  if (L.bow) {
    ctx.save();
    ctx.translate(27, -212);
    ctx.rotate(0.4);
    L.pBowL.draw(ctx, 'stripePink', { shadow: 0.5 });
    L.pBowR.draw(ctx, 'stripePink', { shadow: 0.5 });
    L.pKnot.draw(ctx, 'coral', { shadow: 0.4 });
    ctx.restore();
  }
  if (p.hat) p.hat(ctx);
  ctx.restore();
  ctx.restore();
}

function drawSprout(ctx, L, p) {
  const k = p.sprout;
  if (k <= 0) return;
  ctx.save();
  ctx.translate(0, -216);
  ctx.scale(k, k);
  ctx.rotate(p.sway);
  inkLine(ctx, qpts(0, 0, 5, -14, 1, -27, 8), 3.4, '#4a8a3c', L.seed + 50, 0.5);
  for (const [pc, r] of [[L.pLeafA, -0.2], [L.pLeafB, 0.25]]) {
    ctx.save();
    ctx.translate(1, -26);
    ctx.rotate(r);
    pc.draw(ctx, 'leaf', { shadow: 0.4, ink: 1.5 });
    ctx.restore();
  }
  ctx.restore();
}

function drawFace(ctx, p) {
  const lx = p.lx * 6, ly = p.ly * 5, ey = -182 + ly;
  ctx.save();
  ctx.fillStyle = 'rgba(240,118,128,0.42)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(lx + s * 26, -165 + ly * 0.6, 8.5, 5.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = PAL.ink;
  ctx.strokeStyle = PAL.ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.2;
  const eyes = p.eyes;
  for (const s of [-1, 1]) {
    const x = lx + s * 15, y = ey;
    if (eyes === 'open' || eyes === 'sad') {
      ctx.beginPath(); ctx.ellipse(x, y, 4.6, 5.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + 1.5, y - 2, 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = PAL.ink;
      if (eyes === 'sad') { ctx.beginPath(); ctx.moveTo(x + s * 8, y - 9); ctx.lineTo(x - s * 5, y - 14); ctx.stroke(); }
    } else if (eyes === 'wide') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAL.ink;
      ctx.beginPath(); ctx.arc(x + p.lx * 2.5, y + p.ly * 2.5, 3.8, 0, TAU); ctx.fill();
    } else if (eyes === 'blink') {
      ctx.beginPath(); ctx.moveTo(x - 5, y + 1); ctx.lineTo(x + 5, y + 1); ctx.stroke();
    } else if (eyes === 'happy') {
      ctx.beginPath(); ctx.arc(x, y + 3, 6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (eyes === 'squeeze') {
      ctx.beginPath(); ctx.moveTo(x - s * 5, y - 5); ctx.lineTo(x + s * 4, y); ctx.lineTo(x - s * 5, y + 5); ctx.stroke();
    } else if (eyes === 'dizzy') {
      const sp = spiralPts(x, y, 7, 1.8, 16, s * 2);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      sp.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.stroke();
      ctx.lineWidth = 3.2;
    }
  }
  const mx = lx * 0.9, my = -160 + ly * 0.5;
  switch (p.mouth) {
    case 'smile':
      ctx.beginPath(); ctx.arc(mx, my - 6, 9, 0.22 * Math.PI, 0.78 * Math.PI); ctx.stroke();
      break;
    case 'grin':
      ctx.beginPath(); ctx.moveTo(mx - 12, my - 4); ctx.quadraticCurveTo(mx, my + 18, mx + 12, my - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e46a6a';
      ctx.beginPath(); ctx.ellipse(mx, my + 5, 5, 3, 0, 0, TAU); ctx.fill();
      break;
    case 'o':
      ctx.beginPath(); ctx.ellipse(mx, my, 4.5, 6, 0, 0, TAU); ctx.fill();
      break;
    case 'flat':
      ctx.beginPath(); ctx.moveTo(mx - 7, my); ctx.lineTo(mx + 7, my); ctx.stroke();
      break;
    case 'frown':
      ctx.beginPath(); ctx.arc(mx, my + 8, 8, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke();
      break;
    case 'wobbly':
      ctx.beginPath(); ctx.moveTo(mx - 10, my);
      for (let i = 1; i <= 5; i++) ctx.lineTo(mx - 10 + i * 4, my + (i % 2 ? -3 : 3));
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function walkPose(phase, amt = 1) {
  const s = Math.sin(phase);
  return {
    legL: s * 0.5 * amt, legR: -s * 0.5 * amt, bob: -Math.abs(Math.cos(phase)) * 7 * amt,
    armL: [0.3 - s * 0.4 * amt, 8], armR: [0.3 + s * 0.4 * amt, 8],
  };
}

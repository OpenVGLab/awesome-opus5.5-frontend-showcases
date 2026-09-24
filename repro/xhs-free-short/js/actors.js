// Characters and small effects: whale, keeper, boat, gulls, spouts, splashes, glow trails.
import { S, TAU, clamp, lerp, sstep, C, css, mix, mul, scl, add, hash2, fract, glow, glowE, rimFill } from './core.js';

// ---------------------------------------------------------------- whale
const rt = (u, calf) => {
  const v = 0.118 * (1 - Math.exp(-u / (calf ? 0.05 : 0.07))) * Math.pow(1 - u, 1.2) * (1 + 1.6 * u) + 0.012 * u;
  const dorsal = u < 0.69 ? 0.026 * sstep(0.625, 0.69, u) : 0.026 * (1 - sstep(0.69, 0.725, u));
  return (v + dorsal * (calf ? 0.55 : 1)) * (calf ? 1.3 : 1);
};
const rb = (u, calf) =>
  (0.135 * (1 - Math.exp(-u / (calf ? 0.045 : 0.06))) * Math.pow(1 - u, 1.5) * (1 + 2.2 * u) + 0.011 * u) * (calf ? 1.24 : 1);

export const WHALE_BACK = C('#34465f');
export const WHALE_BELLY = C('#c3cfd9');

// Returns world-space anchor points (blowhole, head, eye, tail) after drawing.
export function drawWhale(o) {
  const ctx = S.ctx;
  const Lw = o.L;
  const calf = !!o.calf;
  const amp = o.amp ?? 0.05;
  const ph = o.ph ?? 0;
  const dir = o.dir ?? 1;
  const rot = -(o.pitch || 0) * dir;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const toWorld = (lx, ly) => {
    const x = lx * dir;
    return [o.x + x * cr - ly * sr, o.y + x * sr + ly * cr];
  };
  const bend = (u) =>
    Lw * amp * ((Math.max(0, u - 0.28) ** 2) / 0.52) * Math.sin(ph - 3.4 * u) +
    Lw * amp * 0.1 * Math.sin(ph + 1.4) * (1 - u) ** 3;
  const N = 64;
  const top = [], bot = [];
  let tip = null, tan = null;
  const spine = (u) => [Lw * (0.36 - u), bend(u)];
  const frame = (u) => {
    const a = spine(Math.max(0, u - 0.003)), b = spine(Math.min(1, u + 0.003));
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    return [tx, ty, -ty, tx];
  };
  for (let i = 0; i <= N; i++) {
    const u = Math.pow(i / N, 1.22);
    const [x, y] = spine(u);
    const [tx, ty, nx, ny] = frame(u);
    const a = rt(u, calf) * Lw, b = rb(u, calf) * Lw;
    top.push(x + nx * a, y + ny * a);
    bot.push(x - nx * b, y - ny * b);
    if (i === N) {
      tip = [x, y];
      tan = [tx, ty];
    }
  }
  const back = mul(o.back || WHALE_BACK, o.amb);
  const belly = mul(o.belly || WHALE_BELLY, o.amb);
  const detail = Lw * S.kc > 140;

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(o.x, o.y);
  ctx.rotate(rot);
  ctx.scale(dir, 1);

  // flukes frame (extra flex follows the stroke)
  const flex = Math.cos(ph - 3.4) * amp * 6;
  const fc = Math.cos(flex), fs = Math.sin(flex);
  const fx = tan[0] * fc - tan[1] * fs, fy = tan[0] * fs + tan[1] * fc;
  const fnx = -fy, fny = fx;
  const F = (a, b) => [tip[0] + fx * a * Lw + fnx * b * Lw, tip[1] + fy * a * Lw + fny * b * Lw];

  // far pectoral fin (behind body)
  const finU = 0.27;
  const [fsx, fsy] = spine(finU);
  const [, , fnnx, fnny] = frame(finU);
  const finBase = [fsx - fnnx * rb(finU, calf) * Lw * 0.45, fsy - fnny * rb(finU, calf) * Lw * 0.45];
  const finLen = (calf ? 0.24 : 0.3) * Lw;
  const finAng = Math.PI - 0.78 + 0.14 * Math.sin(ph * 0.5 + 0.8) + (o.fin || 0);
  const finPath = (ang, len) => {
    const p = new Path2D();
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (s, w) => [finBase[0] + ca * s * len - sa * w, finBase[1] + sa * s * len + ca * w];
    const lead = [], trail = [];
    for (let k = 0; k <= 12; k++) {
      const s = k / 12;
      const w = (0.055 * (1 - Math.pow(s, 1.6)) + 0.012) * Lw * (calf ? 1.15 : 1);
      const sc = calf ? 0 : 0.006 * Lw * Math.max(0, Math.sin(s * Math.PI * 7));
      lead.push(P(s, -w * 0.45 - sc));
      trail.push(P(s, w * 0.55));
    }
    p.moveTo(lead[0][0], lead[0][1]);
    for (const q of lead) p.lineTo(q[0], q[1]);
    const tipP = P(1.03, 0);
    p.lineTo(tipP[0], tipP[1]);
    for (let k = trail.length - 1; k >= 0; k--) p.lineTo(trail[k][0], trail[k][1]);
    p.closePath();
    return p;
  };
  ctx.fillStyle = css(scl(back, 0.75));
  ctx.fill(finPath(finAng + 0.35, finLen * 0.92));

  // body outline
  const body = new Path2D();
  body.moveTo(top[0], top[1]);
  for (let i = 2; i < top.length; i += 2) body.lineTo(top[i], top[i + 1]);
  let p = F(0, 0.012);
  body.lineTo(p[0], p[1]);
  let c1 = F(0.05, 0.022), e1 = F(0.135, 0.078);
  body.quadraticCurveTo(c1[0], c1[1], e1[0], e1[1]);
  c1 = F(0.122, 0.03);
  e1 = F(0.1, 0.0);
  body.quadraticCurveTo(c1[0], c1[1], e1[0], e1[1]);
  c1 = F(0.122, -0.03);
  e1 = F(0.135, -0.078);
  body.quadraticCurveTo(c1[0], c1[1], e1[0], e1[1]);
  c1 = F(0.05, -0.022);
  e1 = F(0, -0.011);
  body.quadraticCurveTo(c1[0], c1[1], e1[0], e1[1]);
  for (let i = bot.length - 2; i >= 0; i -= 2) body.lineTo(bot[i], bot[i + 1]);
  body.closePath();

  const g = ctx.createLinearGradient(0, -0.13 * Lw, 0, 0.16 * Lw);
  g.addColorStop(0, css(add(back, o.rim || [0, 0, 0], 0.06)));
  g.addColorStop(0.46, css(back));
  g.addColorStop(0.6, css(mix(back, belly, 0.45)));
  g.addColorStop(0.74, css(belly));
  g.addColorStop(1, css(scl(belly, 0.82)));
  // rim width is capped in picture pixels so big close-up whales keep a fine edge
  const zc = S.cam ? S.cam.z : 1;
  const rimW = Math.min(0.011 * Lw, (o.glow ? 2.4 : 4) / zc);
  if (o.rim && (o.rimA ?? 0.5) > 0) rimFill(ctx, body, g, css(add(back, o.rim, 0.9), o.rimA ?? 0.5), 0, rimW);
  else {
    ctx.fillStyle = g;
    ctx.fill(body);
  }

  // light falling on the back from above (e.g. the lighthouse beam)
  if (o.wash && o.wash.a > 0.01) {
    ctx.save();
    ctx.clip(body);
    ctx.globalCompositeOperation = 'lighter';
    const wg = ctx.createLinearGradient(0, -0.14 * Lw, 0, 0.05 * Lw);
    wg.addColorStop(0, css(o.wash.c, o.wash.a));
    wg.addColorStop(0.55, css(o.wash.c, o.wash.a * 0.45));
    wg.addColorStop(1, css(o.wash.c, 0));
    ctx.fillStyle = wg;
    ctx.fillRect(-0.7 * Lw, -0.2 * Lw, 1.4 * Lw, 0.3 * Lw);
    ctx.restore();
  }

  if (detail) {
    ctx.save();
    ctx.clip(body);
    // throat grooves
    ctx.strokeStyle = css(scl(belly, 0.72), 0.55);
    ctx.lineWidth = 0.0035 * Lw;
    for (let k = 1; k <= 6; k++) {
      ctx.beginPath();
      for (let i = 1; i <= 26; i++) {
        const u = 0.02 + (i / 26) * 0.42;
        const [x, y] = spine(u);
        const [, , nx, ny] = frame(u);
        const off = rb(u, calf) * Lw - k * 0.011 * Lw;
        const px = x - nx * off, py = y - ny * off;
        if (i === 1) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // mouth line
    ctx.strokeStyle = css(scl(back, 0.55), 0.8);
    ctx.lineWidth = 0.005 * Lw;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const u = 0.004 + (i / 16) * 0.2;
      const [x, y] = spine(u);
      const [, , nx, ny] = frame(u);
      const off = -rb(u, calf) * Lw * (0.05 + 0.5 * (i / 16) ** 1.4);
      const px = x + nx * off, py = y + ny * off;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // tubercles / barnacle spots on the adult's head and chin
    if (!calf) {
      ctx.fillStyle = css(mix(back, belly, 0.55), 0.8);
      for (let k = 0; k < 9; k++) {
        const u = 0.02 + k * 0.012;
        const [x, y] = spine(u);
        const [, , nx, ny] = frame(u);
        const off = rt(u, calf) * Lw * 0.75;
        ctx.beginPath();
        ctx.arc(x + nx * off, y + ny * off, 0.0045 * Lw, 0, TAU);
        ctx.fill();
      }
      for (const [u, f, r] of [[0.33, 0.1, 0.012], [0.4, -0.2, 0.008], [0.52, 0.3, 0.01], [0.58, -0.05, 0.007]]) {
        const [x, y] = spine(u);
        const [, , nx, ny] = frame(u);
        ctx.fillStyle = css(mix(back, belly, 0.35), 0.5);
        ctx.beginPath();
        ctx.arc(x + nx * f * Lw * 0.1, y + ny * f * Lw * 0.1, r * Lw, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // eye
  const eu = calf ? 0.13 : 0.15;
  const [ex0, ey0] = spine(eu);
  const [, , enx, eny] = frame(eu);
  const eoff = -rb(eu, calf) * Lw * (calf ? 0.22 : 0.3);
  const ex = ex0 + enx * eoff, ey = ey0 + eny * eoff;
  const er = (calf ? 0.018 : 0.0085) * Lw;
  ctx.fillStyle = css(scl(back, 0.35));
  ctx.beginPath();
  ctx.ellipse(ex, ey, er * 1.1, er * (o.blink ? 0.2 : 1), 0, 0, TAU);
  ctx.fill();
  if (calf && !o.blink && detail) {
    ctx.fillStyle = css(add(belly, [60, 60, 60]), 0.9);
    ctx.beginPath();
    ctx.arc(ex + er * 0.35, ey - er * 0.35, er * 0.35, 0, TAU);
    ctx.fill();
  }

  // near pectoral fin
  const fin = finPath(finAng, finLen);
  const fg = ctx.createLinearGradient(finBase[0], finBase[1], finBase[0] - finLen * 0.7, finBase[1] + finLen * 0.7);
  fg.addColorStop(0, css(mix(back, belly, 0.4)));
  fg.addColorStop(1, css(mix(back, belly, calf ? 0.5 : 0.8)));
  ctx.fillStyle = fg;
  ctx.fill(fin);
  ctx.strokeStyle = css(scl(back, 0.7), 0.6);
  ctx.lineWidth = 0.003 * Lw;
  ctx.stroke(fin);

  if ((o.glow || 0) > 0.01) {
    const gA = o.glow;
    const tt = o.t ?? 0;
    ctx.globalCompositeOperation = 'lighter';
    // plankton light washing over the body
    ctx.save();
    ctx.clip(body);
    const wash = ctx.createLinearGradient(0, -0.12 * Lw, 0, 0.15 * Lw);
    wash.addColorStop(0, css([60, 230, 210], 0.16 * gA));
    wash.addColorStop(0.5, css([40, 160, 190], 0.05 * gA));
    wash.addColorStop(1, css([60, 220, 210], 0.12 * gA));
    ctx.fillStyle = wash;
    ctx.fillRect(-0.7 * Lw, -0.2 * Lw, 1.4 * Lw, 0.4 * Lw);
    ctx.restore();
    // soft halo built from wide faint strokes, with only a hairline at the edge itself
    for (const [w, a] of [[0.04, 0.018], [0.022, 0.03], [0.01, 0.045]]) {
      ctx.strokeStyle = css([60, 205, 200], a * gA);
      ctx.lineWidth = w * Lw;
      ctx.stroke(body);
    }
    ctx.strokeStyle = css([150, 240, 228], 0.2 * gA);
    ctx.lineWidth = Math.max(0.8 / S.kc, Math.min(0.0022 * Lw, 1.8 / zc));
    ctx.stroke(body);
    // glowing speckles clinging to the skin
    const seed = calf ? 17 : 5;
    for (let k = 0; k < 46; k++) {
      const h1 = hash2(k, seed), h2 = hash2(k, seed + 1), h3 = hash2(k, seed + 2);
      const u = 0.03 + 0.9 * h1;
      const [sx, sy] = spine(u);
      const [, , nx, ny] = frame(u);
      const v = (h2 * 2 - 1) * 0.85;
      const off = v > 0 ? v * rt(u, calf) * Lw : v * rb(u, calf) * Lw;
      const tw = 0.5 + 0.5 * Math.sin(tt * (2 + 3 * h3) + h1 * 40);
      glow(S.sp.cyanCore, sx + nx * off, sy + ny * off, (0.006 + 0.01 * h3) * Lw, gA * tw * 0.9);
    }
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  const [bx0, by0] = spine(0.1);
  const [, , bnx, bny] = frame(0.1);
  const bo = rt(0.1, calf) * Lw;
  return {
    blow: toWorld(bx0 + bnx * bo, by0 + bny * bo),
    head: toWorld(top[0], top[1]),
    eye: toWorld(ex, ey),
    tail: toWorld(tip[0], tip[1]),
    top: (u) => {
      const [x, y] = spine(u);
      const [, , nx, ny] = frame(u);
      const a = rt(u, calf) * Lw;
      return toWorld(x + nx * a, y + ny * a);
    },
  };
}

// ---------------------------------------------------------------- keeper
const KC = {
  coat: C('#34405a'),
  pants: C('#2a2a33'),
  boot: C('#1b1918'),
  skin: C('#e2a98c'),
  nose: C('#d9826e'),
  beard: C('#ebe8e1'),
  hat: C('#b8463b'),
  hatBand: C('#96372f'),
  brass: C('#c9a14d'),
  flute: C('#b98b4d'),
  cane: C('#6c4a2f'),
  button: C('#c9a14d'),
};

function ik(sx, sy, tx, ty, l1, l2) {
  let dx = tx - sx, dy = ty - sy;
  let d = Math.hypot(dx, dy);
  if (d > l1 + l2 - 1e-4) {
    const k = (l1 + l2 - 1e-4) / d;
    dx *= k;
    dy *= k;
    d = l1 + l2 - 1e-4;
  }
  const a = Math.atan2(dy, dx);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const e1 = [sx + Math.cos(a + A) * l1, sy + Math.sin(a + A) * l1];
  const e2 = [sx + Math.cos(a - A) * l1, sy + Math.sin(a - A) * l1];
  const e = e1[1] > e2[1] ? e1 : e2;
  return [e, [sx + dx, sy + dy]];
}

// o: {x, y, h, dir, pose, amb, rim, rimA, rimSide, alpha, t}
// pose: {sit, lean, hunch, hands: [[x,y] near, [x,y] far], prop, propA, beardWhite, look}
export function drawKeeper(o) {
  const ctx = S.ctx;
  const P = o.pose || {};
  const amb = o.amb;
  const col = (c) => css(mul(c, amb));
  const rim = o.rim || [0, 0, 0];
  const rimA = o.rimA ?? 0;
  const rimCol = (c) => css(add(mul(c, amb), rim, 0.9), rimA);
  const side = o.rimSide ?? -1;
  const rdx = -side * 0.009, rdy = 0.004;
  const fillPart = (path, c) => {
    if (rimA > 0.01) rimFill(ctx, path, col(c), rimCol(c), rdx, rdy);
    else {
      ctx.fillStyle = col(c);
      ctx.fill(path);
    }
  };
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(o.x, o.y);
  ctx.scale(o.h * (o.dir ?? 1), o.h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const sit = !!P.sit;
  const lean = P.lean || 0;
  const hunch = P.hunch || 0;
  let sh, head;
  if (sit) {
    sh = [0.02 + lean + hunch * 0.05, -0.33 + hunch * 0.04];
    head = [sh[0] + 0.03 + hunch * 0.04, sh[1] - 0.1 + hunch * 0.03];
  } else {
    sh = [0.01 + lean, -0.79 + hunch * 0.03];
    head = [sh[0] + 0.02 + hunch * 0.03, sh[1] - 0.105 + hunch * 0.025];
  }
  const [hN0, hF] = P.hands || [[sh[0] + 0.06, sh[1] + 0.28], [sh[0] - 0.02, sh[1] + 0.28]];
  const L1 = 0.155, L2 = 0.15;
  const armW = 0.062;
  // props follow the hand the arm actually reaches, not the requested target
  const hN = ik(sh[0] + 0.015, sh[1] + 0.02, hN0[0], hN0[1], L1, L2)[1];

  const drawArm = (hand, c, near) => {
    const s0 = [sh[0] + (near ? 0.015 : -0.015), sh[1] + 0.02];
    const [el, hd] = ik(s0[0], s0[1], hand[0], hand[1], L1, L2);
    if (rimA > 0.01) {
      ctx.strokeStyle = rimCol(c);
      ctx.lineWidth = armW + 0.012;
      ctx.beginPath();
      ctx.moveTo(s0[0] - rdx, s0[1] - rdy);
      ctx.lineTo(el[0] - rdx, el[1] - rdy);
      ctx.lineTo(hd[0] - rdx, hd[1] - rdy);
      ctx.stroke();
    }
    ctx.strokeStyle = col(c);
    ctx.lineWidth = armW;
    ctx.beginPath();
    ctx.moveTo(s0[0], s0[1]);
    ctx.lineTo(el[0], el[1]);
    ctx.lineTo(hd[0], hd[1]);
    ctx.stroke();
    ctx.fillStyle = col(KC.skin);
    ctx.beginPath();
    ctx.arc(hd[0], hd[1], 0.024, 0, TAU);
    ctx.fill();
  };

  // far arm (darker)
  drawArm(hF, scl(KC.coat, 0.72), false);

  // legs
  ctx.strokeStyle = col(KC.pants);
  ctx.lineWidth = 0.075;
  if (sit) {
    ctx.beginPath();
    ctx.moveTo(-0.02, 0);
    ctx.lineTo(0.2, -0.015);
    ctx.lineTo(0.23, 0.2);
    ctx.stroke();
    ctx.fillStyle = col(KC.boot);
    ctx.beginPath();
    ctx.ellipse(0.25, 0.225, 0.055, 0.03, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-0.035, -0.46);
    ctx.lineTo(-0.045, -0.04);
    ctx.moveTo(0.035, -0.46);
    ctx.lineTo(0.05, -0.04);
    ctx.stroke();
    ctx.fillStyle = col(KC.boot);
    ctx.beginPath();
    ctx.ellipse(-0.03, -0.022, 0.058, 0.03, 0, 0, TAU);
    ctx.ellipse(0.07, -0.022, 0.058, 0.03, 0, 0, TAU);
    ctx.fill();
  }

  // coat
  const coat = new Path2D();
  if (sit) {
    coat.moveTo(sh[0] - 0.09, sh[1] + 0.005);
    coat.quadraticCurveTo(sh[0] - 0.15, sh[1] + 0.14, -0.13, 0.02);
    coat.lineTo(-0.1, 0.05);
    coat.lineTo(0.13, 0.04);
    coat.quadraticCurveTo(0.24, 0.03, 0.235, -0.05);
    coat.quadraticCurveTo(0.2, -0.08, 0.13, -0.08);
    coat.quadraticCurveTo(sh[0] + 0.14, sh[1] + 0.14, sh[0] + 0.085, sh[1] + 0.005);
    coat.quadraticCurveTo(sh[0], sh[1] - 0.04, sh[0] - 0.09, sh[1] + 0.005);
  } else {
    coat.moveTo(sh[0] - 0.095, sh[1] + 0.01);
    coat.quadraticCurveTo(sh[0] - 0.14, sh[1] + 0.2, -0.155, -0.3);
    coat.lineTo(0.15, -0.3);
    coat.quadraticCurveTo(0.16 + lean * 0.5, -0.5, sh[0] + 0.12, sh[1] + 0.13);
    coat.quadraticCurveTo(sh[0] + 0.11, sh[1] + 0.02, sh[0] + 0.07, sh[1]);
    coat.quadraticCurveTo(sh[0], sh[1] - 0.035, sh[0] - 0.095, sh[1] + 0.01);
  }
  fillPart(coat, KC.coat);
  // buttons
  if (o.h * S.kc > 60) {
    ctx.fillStyle = col(KC.button);
    const bx = sit ? sh[0] + 0.1 : sh[0] + 0.1;
    for (let k = 0; k < (sit ? 2 : 3); k++) {
      ctx.beginPath();
      ctx.arc(bx + k * 0.008, sh[1] + 0.1 + k * 0.1, 0.01, 0, TAU);
      ctx.fill();
    }
  }

  // head
  const [hx, hy] = head;
  const face = new Path2D();
  face.arc(hx, hy, 0.066, 0, TAU);
  fillPart(face, KC.skin);
  ctx.fillStyle = col(KC.nose);
  ctx.beginPath();
  ctx.arc(hx + 0.064, hy + 0.01, 0.018, 0, TAU);
  ctx.fill();
  // eye
  ctx.fillStyle = col(scl(KC.pants, 0.5));
  ctx.beginPath();
  if (P.eyesClosed) ctx.rect(hx + 0.028, hy - 0.004, 0.02, 0.005);
  else ctx.arc(hx + 0.038, hy - 0.004, 0.008, 0, TAU);
  ctx.fill();
  // beard
  const beard = new Path2D();
  beard.moveTo(hx + 0.058, hy + 0.028);
  beard.quadraticCurveTo(hx + 0.075, hy + 0.075, hx + 0.03, hy + 0.115);
  beard.quadraticCurveTo(hx - 0.02, hy + 0.1, hx - 0.05, hy + 0.03);
  beard.quadraticCurveTo(hx - 0.02, hy + 0.045, hx + 0.02, hy + 0.035);
  beard.closePath();
  fillPart(beard, KC.beard);
  const must = new Path2D();
  must.ellipse(hx + 0.052, hy + 0.03, 0.03, 0.013, -0.2, 0, TAU);
  fillPart(must, KC.beard);
  // beanie
  const hat = new Path2D();
  hat.moveTo(hx - 0.074, hy + 0.0);
  hat.quadraticCurveTo(hx - 0.08, hy - 0.075, hx - 0.01, hy - 0.098);
  hat.quadraticCurveTo(hx + 0.06, hy - 0.09, hx + 0.068, hy - 0.022);
  hat.lineTo(hx - 0.074, hy + 0.0);
  hat.closePath();
  fillPart(hat, KC.hat);
  const band = new Path2D();
  band.moveTo(hx - 0.078, hy + 0.004);
  band.lineTo(hx + 0.072, hy - 0.02);
  band.lineTo(hx + 0.07, hy - 0.046);
  band.lineTo(hx - 0.08, hy - 0.024);
  band.closePath();
  fillPart(band, KC.hatBand);

  // props (behind the near arm)
  if (P.prop === 'spyglass') {
    const a = P.propA ?? -0.05;
    const x0 = P.scopeHand ? hN[0] - Math.cos(a) * 0.1 : hx + 0.05;
    const y0 = P.scopeHand ? hN[1] - Math.sin(a) * 0.1 : hy - 0.004;
    const len = 0.3;
    const ca = Math.cos(a), sa = Math.sin(a);
    const sp = new Path2D();
    sp.moveTo(x0 - sa * 0.012, y0 + ca * 0.012);
    sp.lineTo(x0 + ca * len - sa * 0.026, y0 + sa * len + ca * 0.026);
    sp.lineTo(x0 + ca * len + sa * 0.026, y0 + sa * len - ca * 0.026);
    sp.lineTo(x0 + sa * 0.012, y0 - ca * 0.012);
    sp.closePath();
    fillPart(sp, KC.brass);
    ctx.strokeStyle = col(scl(KC.brass, 0.6));
    ctx.lineWidth = 0.008;
    ctx.beginPath();
    for (const f of [0.35, 0.7]) {
      const px = x0 + ca * len * f, py = y0 + sa * len * f;
      const w = 0.012 + 0.014 * f;
      ctx.moveTo(px - sa * w, py + ca * w);
      ctx.lineTo(px + sa * w, py - ca * w);
    }
    ctx.stroke();
  } else if (P.prop === 'flute') {
    const a = P.propA ?? 0.95;
    const x0 = hx + 0.06, y0 = hy + 0.045;
    const ca = Math.cos(a), sa = Math.sin(a);
    ctx.strokeStyle = col(KC.flute);
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + ca * 0.32, y0 + sa * 0.32);
    ctx.stroke();
    ctx.strokeStyle = col(scl(KC.flute, 0.6));
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    for (const f of [0.3, 0.62, 0.95]) {
      const px = x0 + ca * 0.32 * f, py = y0 + sa * 0.32 * f;
      ctx.moveTo(px - ca * 0.004, py - sa * 0.004);
      ctx.lineTo(px + ca * 0.004, py + sa * 0.004);
    }
    ctx.stroke();
  } else if (P.prop === 'cane') {
    ctx.strokeStyle = col(KC.cane);
    ctx.lineWidth = 0.018;
    ctx.beginPath();
    ctx.moveTo(hN[0], hN[1] - 0.02);
    ctx.lineTo(hN[0] + 0.05, sit ? 0.23 : 0);
    ctx.stroke();
  }

  drawArm(hN, KC.coat, true);
  ctx.restore();
}

// ---------------------------------------------------------------- boat
export function drawBoat(o) {
  const ctx = S.ctx;
  const amb = o.amb;
  const col = (c) => css(mul(c, amb));
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.ang || 0);
  ctx.scale(o.s * (o.dir ?? 1), o.s);
  const hull = new Path2D('M -58 -13 L 60 -21 C 57 -7 46 5 30 10 L -44 10 C -54 6 -58 -2 -58 -13 Z');
  rimFill(ctx, hull, col(C('#70372a')), css(add(mul(C('#9a553c'), amb), o.rim || [0, 0, 0], 0.4)), 0, 3);
  ctx.strokeStyle = col(C('#d9cba8'));
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-57, -10.5);
  ctx.lineTo(59, -18.5);
  ctx.stroke();
  // cabin
  ctx.fillStyle = col(C('#cfc6b0'));
  ctx.beginPath();
  ctx.moveTo(-46, -13);
  ctx.lineTo(-46, -40);
  ctx.lineTo(-16, -42);
  ctx.lineTo(-15, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = col(C('#3b3b44'));
  ctx.beginPath();
  ctx.moveTo(-50, -40);
  ctx.lineTo(-13, -43);
  ctx.lineTo(-13, -47);
  ctx.lineTo(-50, -44);
  ctx.closePath();
  ctx.fill();
  const lw = o.lantern || 0;
  ctx.fillStyle = css(mix(mul(C('#1b2230'), amb), [255, 196, 110], lw * 0.9));
  ctx.fillRect(-38, -35, 13, 10);
  // mast and yard
  ctx.strokeStyle = col(C('#5a4232'));
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(6, -15);
  ctx.lineTo(6, -84);
  ctx.moveTo(6, -76);
  ctx.lineTo(33, -68);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(30, -69);
  ctx.lineTo(30 + Math.sin(o.sway || 0) * 3, -60);
  ctx.stroke();
  // lantern
  const lx = 30 + Math.sin(o.sway || 0) * 4, ly = -57;
  ctx.fillStyle = col(C('#2b2b30'));
  ctx.fillRect(lx - 3.5, ly - 5, 7, 9);
  ctx.fillStyle = css(mix(mul(C('#443322'), amb), [255, 214, 140], lw));
  ctx.fillRect(lx - 2.5, ly - 3.5, 5, 6);
  // fisherman
  ctx.fillStyle = col(C('#2f3645'));
  ctx.beginPath();
  ctx.moveTo(17, -16);
  ctx.lineTo(19, -38);
  ctx.quadraticCurveTo(23, -43, 27, -38);
  ctx.lineTo(29, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = col(C('#e0a88b'));
  ctx.beginPath();
  ctx.arc(23.5, -45, 4.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = col(C('#c9a23a'));
  ctx.beginPath();
  ctx.moveTo(16.5, -46);
  ctx.quadraticCurveTo(23.5, -54, 31, -46);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const ca = Math.cos(o.ang || 0), sa = Math.sin(o.ang || 0);
  const wx = lx * o.s * (o.dir ?? 1), wy = ly * o.s;
  return [o.x + wx * ca - wy * sa, o.y + wx * sa + wy * ca];
}

// ---------------------------------------------------------------- gulls
export function drawGull(x, y, s, phase, colr) {
  const ctx = S.ctx;
  const f = Math.sin(phase);
  ctx.strokeStyle = colr;
  ctx.lineWidth = 1.8 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 11 * s, y - f * 5 * s);
  ctx.quadraticCurveTo(x - 5 * s, y - (5 + f * 4) * s, x, y);
  ctx.quadraticCurveTo(x + 5 * s, y - (5 + f * 4) * s, x + 11 * s, y - f * 5 * s);
  ctx.stroke();
}

// ---------------------------------------------------------------- spout / splash
export function drawSpout(x, y, t0, t, s, a, glowMode = 0) {
  const age = t - t0;
  if (age < 0 || age > 3.4) return;
  const ctx = S.ctx;
  ctx.globalCompositeOperation = glowMode ? 'lighter' : 'source-over';
  const spr = glowMode ? S.sp.mistCyan : S.sp.mist;
  for (let i = 0; i < 52; i++) {
    const h1 = hash2(i, 5), h2 = hash2(i, 6), h3 = hash2(i, 7);
    const a2 = age - h1 * 0.45;
    if (a2 < 0) continue;
    const life = 1.3 + h2 * 1.4;
    if (a2 > life) continue;
    const vy = (200 + 120 * h3) * s, vx = (h2 - 0.5) * 80 * s;
    const px = x + vx * a2 + 20 * s * a2 * a2;
    const py = y - vy * a2 + 95 * s * a2 * a2;
    const r = (5 + 24 * (a2 / life)) * s;
    glow(spr, px, py, r * 2, a * sstep(0, 0.12, a2) * (1 - a2 / life) ** 1.3 * (glowMode ? 0.3 : 0.6));
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

export function drawSplash(x, y, t, period, seed, s, a) {
  if (a <= 0.01) return;
  const cyc = (t + hash2(seed, 1) * period) / period;
  const k = Math.floor(cyc);
  const age = fract(cyc) * period;
  if (age > 1.7) return;
  const fadeIn = sstep(0, 0.18, age);
  for (let i = 0; i < 30; i++) {
    const h1 = hash2(i + k * 50, seed), h2 = hash2(i + k * 50, seed + 1);
    const vx = (h1 - 0.5) * 150 * s + 40 * s, vy = (120 + 190 * h2) * s;
    const px = x + (h1 - 0.5) * 26 * s + vx * age, py = y - vy * age + 190 * s * age * age;
    if (py > y + 8 * s) continue;
    const r = (3 + 10 * h2) * s * (0.6 + age);
    glow(S.sp.mist, px, py, r * 2, a * fadeIn * (1 - age / 1.7) * 0.8);
  }
  S.ctx.globalAlpha = 1;
}

// Bioluminescent trail following path(τ) -> [x, y, scale]
export function drawGlowTrail(path, t, tStart, life, s, a, seed = 1, spread = 40) {
  if (a <= 0.01) return;
  const ctx = S.ctx;
  ctx.globalCompositeOperation = 'lighter';
  const dt = 0.06;
  const k0 = Math.ceil(Math.max(tStart, t - life) / dt);
  const k1 = Math.floor(t / dt);
  for (let k = k0; k <= k1; k++) {
    const tau = k * dt;
    const age = t - tau;
    const [px, py, ps] = path(tau);
    const fade = (1 - age / life) ** 1.6 * sstep(0, 0.4, age + 0.1);
    for (let j = 0; j < 3; j++) {
      const h1 = hash2(k * 3 + j, seed), h2 = hash2(k * 3 + j, seed + 1), h3 = hash2(k * 3 + j, seed + 2);
      const r = (1 + age * 0.9);
      const x = px + (h1 - 0.5) * spread * ps * r * 2.2;
      const y = py + (h2 - 0.5) * spread * ps * r * 0.35;
      const tw = 0.6 + 0.4 * Math.sin(t * (3 + 4 * h3) + h1 * 20);
      glow(S.sp.cyanCore, x, y, (4 + 7 * h3) * ps * s, a * fade * tw);
      if (j === 0) glowE(S.sp.cyan, x, y, 40 * ps * s, 12 * ps * s, a * fade * 0.25);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// Expanding elliptical ripple rings (glowing).
export function drawRipple(x, y, t0, t, s, a, col = [90, 255, 220]) {
  const age = t - t0;
  if (age < 0 || age > 3) return;
  const ctx = S.ctx;
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const ag = age - k * 0.35;
    if (ag < 0) continue;
    const r = (20 + ag * 90) * s;
    ctx.strokeStyle = css(col, a * (1 - ag / 3) * 0.6);
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.18, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

export { lerp, clamp };

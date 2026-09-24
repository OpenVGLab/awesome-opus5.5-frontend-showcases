// Stand-alone sets: underwater, the lantern gallery in the storm, the cottage window.
import { S, TAU, clamp, lerp, sstep, C, css, mix, mul, scl, add, hash2, wrap, glow, glowE, rimFill } from './core.js';
import { drawRain, drawCloud, drawBolt, drawSnow } from './world.js';
import { drawKeeper } from './actors.js';

// ---------------------------------------------------------------- underwater
export function drawUnderwater(U, t) {
  const { ctx, V } = S;
  const sy = U.surfY;
  const g = ctx.createLinearGradient(0, sy, 0, 880);
  g.addColorStop(0, css(add(U.top, [120, 140, 160], U.flash * 0.5)));
  g.addColorStop(0.45, css(add(U.mid, [60, 80, 100], U.flash * 0.4)));
  g.addColorStop(1, css(U.deep));
  ctx.fillStyle = g;
  ctx.fillRect(V.x0 - 5, V.y0 - 5, V.x1 - V.x0 + 10, V.y1 - V.y0 + 10);

  // underside of the surface
  const wv = (x) =>
    sy + Math.sin(x * 0.011 + t * (1.2 + U.storm)) * (5 + 14 * U.storm) + Math.sin(x * 0.029 - t * 2.1) * (2.5 + 6 * U.storm);
  ctx.beginPath();
  ctx.moveTo(V.x0 - 10, V.y0 - 10);
  for (let x = V.x0 - 10; x <= V.x1 + 20; x += 14) ctx.lineTo(x, wv(x));
  ctx.lineTo(V.x1 + 20, V.y0 - 10);
  ctx.closePath();
  ctx.fillStyle = css(add(U.surf, [150, 160, 180], U.flash * 0.6));
  ctx.fill();
  ctx.beginPath();
  for (let x = V.x0 - 10; x <= V.x1 + 20; x += 14) (x === V.x0 - 10 ? ctx.moveTo(x, wv(x)) : ctx.lineTo(x, wv(x)));
  ctx.strokeStyle = css(add(U.surf, [80, 90, 100]), 0.7);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.globalCompositeOperation = 'lighter';
  // ambient god rays
  if (U.rays > 0.01) {
    for (let i = 0; i < 16; i++) {
      const h1 = hash2(i, 3), h2 = hash2(i, 4);
      const x = V.x0 + ((i + 0.5) / 16) * (V.x1 - V.x0) + Math.sin(t * 0.25 + i * 2.1) * 40;
      const w = 40 + 90 * h1;
      const len = 520 + 300 * h2;
      const a = U.rays * (0.05 + 0.07 * h2) * (0.55 + 0.45 * Math.sin(t * (0.7 + h1) + i * 1.3));
      if (a < 0.005) continue;
      const rg = ctx.createLinearGradient(0, sy, 0, sy + len);
      rg.addColorStop(0, css(U.rayCol, a));
      rg.addColorStop(1, css(U.rayCol, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, sy);
      ctx.lineTo(x + w / 2, sy);
      ctx.lineTo(x + w * 1.4 + len * 0.18, sy + len);
      ctx.lineTo(x - w * 1.2 + len * 0.18, sy + len);
      ctx.closePath();
      ctx.fill();
    }
  }
  // the lighthouse beam passing over the surface
  if (U.beam > 0.01) {
    for (let j = 0; j < 7; j++) {
      const off = (j - 3) * 46 + Math.sin(t * 3 + j) * 8;
      const x = U.beamX + off;
      const a = U.beam * (0.22 - Math.abs(j - 3) * 0.05);
      if (a <= 0) continue;
      const len = 700;
      const rg = ctx.createLinearGradient(0, sy, 0, sy + len);
      rg.addColorStop(0, css([255, 226, 160], a));
      rg.addColorStop(0.5, css([255, 210, 140], a * 0.35));
      rg.addColorStop(1, css([255, 200, 120], 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x - 16, sy);
      ctx.lineTo(x + 16, sy);
      ctx.lineTo(x + 90 + len * 0.1, sy + len);
      ctx.lineTo(x - 50 + len * 0.1, sy + len);
      ctx.closePath();
      ctx.fill();
    }
    glowE(S.sp.warm, U.beamX, sy + 4, 260, 40, U.beam * 0.7);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Marine snow / bubbles, drawn over actors for depth.
export function drawParticles(U, t, layer) {
  const { ctx, V } = S;
  const w = V.x1 - V.x0 + 100, h = V.y1 - V.y0 + 100;
  const n = [140, 70, 16][layer];
  const size = [1.6, 2.8, 9][layer];
  const col = U.snowCol || [190, 220, 230];
  ctx.fillStyle = css(col, [0.35, 0.45, 0.12][layer] * (U.snow ?? 1));
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const hx = hash2(i, 40 + layer), hy = hash2(i, 50 + layer);
    const x = V.x0 - 50 + wrap(hx * w + t * (10 + 18 * layer) * (U.current ?? 1) + Math.sin(t * 0.5 + i) * 6, 0, w);
    const y = V.y0 - 50 + wrap(hy * h + t * (4 + 5 * layer) + Math.sin(t * 0.3 + i * 2) * 10, 0, h);
    const r = size * (0.6 + 0.6 * hx);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fill();
  if (layer === 0 && (U.bubbles || 0) > 0.01) {
    ctx.strokeStyle = css([210, 235, 245], 0.4 * U.bubbles);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const hx = hash2(i, 70), hy = hash2(i, 71);
      const x = V.x0 + hx * (V.x1 - V.x0) + Math.sin(t * 3 + i) * 5;
      const y = V.y1 - wrap(hy * 900 + t * (90 + 60 * hx), 0, 900);
      const r = 2 + 5 * hy;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- gallery
export const GAL = { horizon: 610, floor: 648, rail: 520, lensX: 1455, lensY: 330, keeperX: 1010, leverX: 1150, leverY: 380, leverLen: 60 };
export const leverAngle = (la) => -0.5 - 1.5 * la;
// Lever knob position in world space.
export function leverTip(la) {
  const a = leverAngle(la);
  const r = GAL.leverLen + 2;
  return [GAL.leverX + Math.sin(a) * r, GAL.leverY - Math.cos(a) * r];
}

export function drawGallery(G, t) {
  const { ctx, V } = S;
  const fl = G.flash;
  // stormy sky and sea
  const sky = ctx.createLinearGradient(0, V.y0, 0, GAL.horizon);
  sky.addColorStop(0, css(add(C('#07090f'), [140, 150, 180], fl * 0.5)));
  sky.addColorStop(1, css(add(C('#252d3b'), [170, 180, 210], fl * 0.6)));
  ctx.fillStyle = sky;
  ctx.fillRect(V.x0 - 5, V.y0 - 5, V.x1 - V.x0 + 10, GAL.horizon - V.y0 + 5);
  for (let i = 0; i < 12; i++) {
    const x = -200 + i * 230 + hash2(i, 1) * 80 + t * 30;
    drawCloud({ w: 300, h: 100, c: GAL_CLOUD[i % GAL_CLOUD.length] }, wrap(x, -300, 2200), 150 + hash2(i, 2) * 180, 1.4,
      add(C('#1f2632'), [150, 160, 190], fl * 0.5), add(C('#0e121a'), [90, 100, 130], fl * 0.4),
      add(C('#5a6780'), [170, 180, 220], fl * 0.6), 0.5, 4, 6);
  }
  if (G.bolt > 0.01) drawBolt(2, 380, 60, GAL.horizon, 520, G.bolt);
  const sea = ctx.createLinearGradient(0, GAL.horizon, 0, 880);
  sea.addColorStop(0, css(add(C('#1d2531'), [120, 130, 160], fl * 0.5)));
  sea.addColorStop(1, css(C('#05080d')));
  ctx.fillStyle = sea;
  ctx.fillRect(V.x0 - 5, GAL.horizon, V.x1 - V.x0 + 10, 900 - GAL.horizon);
  // whitecaps
  ctx.strokeStyle = css([200, 210, 225], 0.25 + fl * 0.4);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const h1 = hash2(i, 11), h2 = hash2(i, 12);
    const y = GAL.horizon + 4 + h2 * h2 * 260;
    const x = wrap(h1 * 2400 + t * (40 + 60 * h2), -200, 2200);
    const w = 8 + 40 * h2;
    const on = Math.sin(t * 2 + i) > 0.2;
    if (!on) continue;
    ctx.moveTo(x - w, y);
    ctx.lineTo(x + w, y);
  }
  ctx.stroke();
  // the calf, glimpsed in the lightning
  if (G.calfSeen > 0.01) {
    const a = G.calfSeen;
    const x = 360, y = GAL.horizon + 26;
    ctx.fillStyle = css(add(C('#0b1018'), [60, 70, 90], fl * 0.8), a);
    ctx.beginPath();
    ctx.moveTo(x - 30, y + 4);
    ctx.quadraticCurveTo(x - 5, y - 2, x + 2, y - 16);
    ctx.quadraticCurveTo(x - 6, y - 24, x - 16, y - 26);
    ctx.quadraticCurveTo(x + 2, y - 30, x + 8, y - 22);
    ctx.quadraticCurveTo(x + 14, y - 30, x + 32, y - 28);
    ctx.quadraticCurveTo(x + 20, y - 22, x + 12, y - 14);
    ctx.quadraticCurveTo(x + 14, y - 2, x + 34, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    glow(S.sp.white, x, y, 60, 0.15 * a * (0.3 + fl));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // lantern room
  const LX = GAL.lensX, LY = GAL.lensY;
  const amb = add(C('#4a556c'), [150, 160, 200], fl * 0.5);
  const warm = C('#ffcf82');
  const lampI = G.lamp;
  const iron = mul(C('#2a2d35'), amb);
  // interior glow behind the glass
  const ig = ctx.createRadialGradient(LX, LY, 20, LX, LY, 420);
  ig.addColorStop(0, css(mix(C('#20242e'), warm, 0.95 * lampI)));
  ig.addColorStop(0.5, css(mix(C('#1a1e26'), C('#b8742c'), 0.7 * lampI)));
  ig.addColorStop(1, css(mix(C('#14171e'), C('#5a3a20'), 0.6 * lampI)));
  ctx.fillStyle = ig;
  ctx.fillRect(1150, 70, 610, 500);
  drawLens(LX, LY, G.lensTh, lampI, t);
  // glass reflections and rain on glass
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = css([180, 200, 255], 0.05);
  ctx.beginPath();
  ctx.moveTo(1180, 80);
  ctx.lineTo(1260, 80);
  ctx.lineTo(1190, 560);
  ctx.lineTo(1150, 560);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = css(mix(C('#9fb0c8'), warm, 0.4 * lampI), 0.25);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const x = 1160 + hash2(i, 21) * 590;
    const y0 = 80 + wrap(hash2(i, 22) * 480 + t * (60 + 80 * hash2(i, 23)), 0, 480);
    ctx.moveTo(x, y0);
    ctx.lineTo(x + 2, y0 + 12 + 14 * hash2(i, 24));
  }
  ctx.stroke();
  // mullions (diagonal astragals)
  ctx.save();
  ctx.beginPath();
  ctx.rect(1150, 70, 610, 500);
  ctx.clip();
  ctx.strokeStyle = css(iron);
  ctx.lineWidth = 9;
  ctx.beginPath();
  for (let k = -4; k < 8; k++) {
    const x = 1150 + k * 150;
    ctx.moveTo(x, 70);
    ctx.lineTo(x + 260, 570);
    ctx.moveTo(x + 260, 70);
    ctx.lineTo(x, 570);
  }
  ctx.stroke();
  ctx.restore();
  // frame
  ctx.fillStyle = css(iron);
  ctx.fillRect(1136, 40, 640, 34);
  ctx.fillRect(1136, 560, 640, 22);
  ctx.fillRect(1136, 40, 22, 540);
  ctx.fillStyle = css(scl(mul(C('#7a2d2b'), amb), 0.9));
  ctx.beginPath();
  ctx.moveTo(1110, 44);
  ctx.quadraticCurveTo(1450, -120, 1800, 44);
  ctx.lineTo(1800, -200);
  ctx.lineTo(1110, -200);
  ctx.closePath();
  ctx.fill();
  // brake lever on the frame
  const la = G.lever;
  ctx.save();
  ctx.translate(GAL.leverX, GAL.leverY);
  ctx.fillStyle = css(mul(C('#3a3d45'), amb));
  ctx.fillRect(-6, 0, 24, 14);
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, TAU);
  ctx.fill();
  ctx.rotate(leverAngle(la));
  const lv = new Path2D();
  lv.rect(-4, -GAL.leverLen, 8, GAL.leverLen);
  lv.arc(0, -GAL.leverLen - 2, 9, 0, TAU);
  rimFill(ctx, lv, css(mul(C('#b08a3e'), amb)), css(mix(C('#ffd89a'), C('#b08a3e'), 0.3), 0.9), 3, 0);
  ctx.restore();

  // beams (additive, sweeping across the frame)
  const beamPts = [];
  ctx.globalCompositeOperation = 'lighter';
  for (const off of [0, Math.PI]) {
    const a = G.lensTh + off;
    const sx = Math.sin(a), cz = Math.cos(a);
    if (sx > -0.05) continue;
    const len = 2200 * Math.pow(-sx, 0.6);
    const w1 = 90 + 380 * (1 - -sx);
    const al = lampI * (0.35 + 0.25 * Math.max(0, cz)) * (0.35 + 0.65 * -sx);
    const bg = ctx.createLinearGradient(LX, 0, LX - len, 0);
    bg.addColorStop(0, css([255, 228, 170], al));
    bg.addColorStop(0.4, css([255, 220, 160], al * 0.35));
    bg.addColorStop(1, css([255, 220, 160], 0));
    ctx.fillStyle = bg;
    const poly = [LX, LY - 30, LX - len, LY - w1 - 60, LX - len, LY + w1 - 60, LX, LY + 30];
    ctx.beginPath();
    ctx.moveTo(poly[0], poly[1]);
    for (let i = 2; i < 8; i += 2) ctx.lineTo(poly[i], poly[i + 1]);
    ctx.closePath();
    ctx.fill();
    beamPts.push({ poly, al });
  }
  const facing = Math.pow(Math.abs(Math.cos(G.lensTh)), 10) * lampI;
  glow(S.sp.warm, LX, LY, 700, 0.55 * facing);
  glowE(S.sp.warmCore, LX, LY, 1300, 16, 0.6 * facing);
  glow(S.sp.warm, LX, LY, 260, 0.45 * lampI);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // gallery floor and railing (behind the keeper's legs: floor; railing in front)
  const floor = mul(C('#23262d'), amb);
  ctx.fillStyle = css(floor);
  ctx.fillRect(V.x0 - 5, GAL.floor, V.x1 - V.x0 + 10, 60);
  ctx.fillStyle = css(scl(floor, 0.6));
  ctx.fillRect(V.x0 - 5, GAL.floor + 60, V.x1 - V.x0 + 10, 400);
  ctx.fillStyle = css(add(floor, [120, 100, 70], 0.3 * lampI));
  ctx.fillRect(V.x0 - 5, GAL.floor - 4, V.x1 - V.x0 + 10, 6);

  // keeper
  drawKeeper({
    x: GAL.keeperX, y: GAL.floor, h: 450, dir: -1, pose: G.pose, amb: add(C('#3a4458'), [140, 150, 190], fl * 0.4),
    rim: [255, 200, 130], rimA: 0.55 * lampI + 0.3 * fl, rimSide: -1, t,
  });

  // railing in front
  const rail = add(mul(C('#2b2e35'), amb), [255, 200, 130], 0.08 * lampI);
  ctx.strokeStyle = css(rail);
  ctx.lineCap = 'butt';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(V.x0 - 10, GAL.rail);
  ctx.lineTo(1140, GAL.rail);
  ctx.moveTo(V.x0 - 10, GAL.rail + 64);
  ctx.lineTo(1140, GAL.rail + 64);
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.beginPath();
  for (let x = Math.floor((V.x0 - 100) / 150) * 150 + 40; x < 1140; x += 150) {
    ctx.moveTo(x, GAL.rail);
    ctx.lineTo(x, GAL.floor);
  }
  ctx.stroke();
  ctx.strokeStyle = css(add(rail, [255, 210, 150], 0.25 * lampI + 0.4 * fl), 0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(V.x0 - 10, GAL.rail - 5);
  ctx.lineTo(1140, GAL.rail - 5);
  ctx.stroke();

  // rain, with the part inside the beam lit up
  drawRain(G.rain, t, 0.35, [170, 185, 210], 1.3);
  for (const b of beamPts) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(b.poly[0], b.poly[1]);
    for (let i = 2; i < 8; i += 2) ctx.lineTo(b.poly[i], b.poly[i + 1]);
    ctx.closePath();
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    drawRain(G.rain, t, 0.35, [255, 230, 180], 2.4 * b.al / 0.5);
    ctx.restore();
  }
}

const GAL_CLOUD = [
  [[-120, -30, 50], [-60, -50, 70], [10, -60, 80], [80, -45, 60], [130, -25, 40]],
  [[-100, -25, 40], [-40, -55, 65], [30, -45, 55], [90, -30, 45]],
];

function drawLens(cx, cy, th, I, t) {
  const ctx = S.ctx;
  const Hh = 190, Rw = 150;
  // pedestal
  ctx.fillStyle = css(mix(C('#1b1d22'), C('#6a4a26'), 0.4 * I));
  ctx.fillRect(cx - 70, cy + Hh - 10, 140, 90);
  ctx.fillRect(cx - 110, cy + Hh + 70, 220, 20);
  // prism rings
  const rings = 15;
  for (let k = 0; k < rings; k++) {
    const y0 = cy - Hh + (k / rings) * Hh * 2;
    const y1 = cy - Hh + ((k + 1) / rings) * Hh * 2;
    const ym = (y0 + y1) / 2;
    const f = Math.sqrt(Math.max(0, 1 - ((ym - cy) / (Hh * 1.02)) ** 2));
    const w = Rw * (0.35 + 0.65 * f);
    const central = Math.abs(ym - cy) < Hh * 0.2;
    const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    const base = mix(C('#3b3326'), C('#ffe2a0'), I * (central ? 0.95 : 0.7));
    const edge = mix(C('#1c1a17'), C('#b57a34'), I * 0.8);
    g.addColorStop(0, css(edge));
    g.addColorStop(0.5, css(base));
    g.addColorStop(1, css(edge));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, ym, w, (y1 - y0) * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = css(mix(C('#141414'), C('#7a5020'), I), 0.7);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // rotating bullseye panels
  for (let j = 0; j < 4; j++) {
    const a = th + (j * Math.PI) / 2;
    const cz = Math.cos(a), sx = Math.sin(a);
    if (cz <= 0) continue;
    const x = cx + sx * Rw * 0.82;
    const rw = 58 * cz, rh = 58;
    for (let k = 4; k >= 0; k--) {
      ctx.fillStyle = css(mix(C('#4a3d28'), C('#fff4d6'), I * (0.55 + 0.45 * cz) * (1 - k * 0.12)), 0.9);
      ctx.beginPath();
      ctx.ellipse(x, cy, rw * (k + 1) / 5, rh * (k + 1) / 5, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  glow(S.sp.warmCore, cx, cy, 120, 0.8 * I);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  void t;
}

// ---------------------------------------------------------------- cottage window
export function drawWindowSet(W, t) {
  const { ctx, V } = S;
  const moon = C('#6f82b8');
  const warm = W.light;
  // stone wall
  ctx.fillStyle = css(mul(C('#d9d4ca'), moon));
  ctx.fillRect(V.x0 - 5, V.y0 - 5, V.x1 - V.x0 + 10, V.y1 - V.y0 + 10);
  ctx.strokeStyle = css(mul(C('#a8a39a'), moon), 0.6);
  ctx.lineWidth = 3;
  for (let row = 0; row < 12; row++) {
    const y = -60 + row * 84;
    ctx.beginPath();
    for (let k = 0; k < 14; k++) {
      const x = -200 + k * 190 + (row % 2) * 95 + hash2(k, row) * 30;
      ctx.moveTo(x, y + 6);
      ctx.quadraticCurveTo(x + 90, y - 4, x + 180, y + 4);
      ctx.moveTo(x + 180, y + 4);
      ctx.lineTo(x + 176, y + 80);
    }
    ctx.stroke();
  }
  // light spilling onto the wall
  ctx.globalCompositeOperation = 'lighter';
  glowE(S.sp.warm, 960, 430, 620, 470, 0.35 * warm);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  const X0 = 660, X1 = 1260, Y0 = 130, Y1 = 690;
  // interior
  const ig = ctx.createRadialGradient(780, 560, 30, 880, 420, 700);
  ig.addColorStop(0, css(mix(C('#1a2233'), C('#ffcf86'), warm)));
  ig.addColorStop(0.45, css(mix(C('#141b2a'), C('#b8692e'), warm * 0.9)));
  ig.addColorStop(1, css(mix(C('#0c111c'), C('#4a2a1a'), warm * 0.9)));
  ctx.fillStyle = ig;
  ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  // back wall shelf and a picture frame, faintly
  ctx.fillStyle = css(mix(C('#0f1420'), C('#6a3d22'), warm * 0.8));
  ctx.fillRect(X0, 330, X1 - X0, 10);
  ctx.strokeStyle = css(mix(C('#1a2130'), C('#8a5a30'), warm), 0.9);
  ctx.lineWidth = 6;
  ctx.strokeRect(1050, 190, 110, 130);
  ctx.fillStyle = css(mix(C('#141a26'), C('#c89a60'), warm * 0.7));
  ctx.fillRect(1056, 196, 98, 118);
  // tiny painting of a whale in the frame
  ctx.fillStyle = css(mix(C('#1d2636'), C('#3c5a7a'), warm), 0.9);
  ctx.beginPath();
  ctx.ellipse(1105, 262, 32, 11, -0.1, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1072, 262);
  ctx.lineTo(1062, 250);
  ctx.lineTo(1066, 264);
  ctx.lineTo(1060, 276);
  ctx.closePath();
  ctx.fill();
  // oil lamp
  const lampX = 800, lampY = 600;
  ctx.fillStyle = css(mix(C('#1c2230'), C('#8a6a3a'), warm));
  ctx.beginPath();
  ctx.ellipse(lampX, lampY + 30, 34, 18, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(lampX - 8, lampY - 8, 16, 34);
  ctx.fillStyle = css(mix(C('#2a3346'), C('#ffe6b0'), warm * 0.8), 0.7);
  ctx.beginPath();
  ctx.ellipse(lampX, lampY - 30, 22, 34, 0, 0, TAU);
  ctx.fill();
  if (W.flame > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    const fx = lampX + Math.sin(t * 9) * 1.5, fy = lampY - 30;
    glow(S.sp.warm, fx, fy, 160 * W.flame, 0.8 * W.flame);
    glow(S.sp.warmCore, fx, fy, 22 * W.flame, 1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  if (W.smoke > 0.01) {
    ctx.strokeStyle = css([180, 190, 210], 0.35 * W.smoke);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const x = lampX + Math.sin(u * 7 + t * 2) * 10 * u;
      const y = lampY - 60 - u * 150 * W.smokeRise;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  // inner sill with flute and wooden whale
  const sillY = 650;
  ctx.fillStyle = css(mix(C('#1c2230'), C('#7a4a28'), warm));
  ctx.fillRect(X0, sillY, X1 - X0, Y1 - sillY);
  const lit = (c, k = 1) => css(mix(mul(c, moon), c, warm * k));
  // flute
  ctx.save();
  ctx.translate(930, sillY - 8);
  ctx.rotate(-0.06);
  ctx.fillStyle = lit(C('#c99a57'));
  ctx.fillRect(-150, -7, 300, 14);
  ctx.fillStyle = lit(C('#7a5530'));
  for (const x of [-90, -45, 0, 30, 60, 90]) {
    ctx.beginPath();
    ctx.arc(x, -1, 3.6, 0, TAU);
    ctx.fill();
  }
  ctx.fillRect(-120, -8, 5, 16);
  ctx.fillRect(110, -8, 5, 16);
  ctx.restore();
  // wooden whale carving
  ctx.save();
  ctx.translate(1140, sillY - 26);
  const body = new Path2D('M -58 8 C -58 -22 -10 -30 30 -18 C 44 -14 52 -10 60 -18 L 74 -34 L 70 -12 L 84 -2 L 64 -4 C 50 10 20 22 -20 22 C -44 22 -58 18 -58 8 Z');
  rimFill(ctx, body, lit(C('#9a6a3e')), lit(C('#e0b27a'), 1), -3, 4);
  ctx.fillStyle = lit(C('#4a2e18'));
  ctx.beginPath();
  ctx.arc(-38, 0, 3, 0, TAU);
  ctx.fill();
  ctx.restore();

  // frost in the pane corners
  ctx.save();
  ctx.beginPath();
  ctx.rect(X0, Y0, X1 - X0, Y1 - Y0);
  ctx.clip();
  const fa = 0.14 + 0.24 * warm;
  for (const [cx, cy] of [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]]) {
    const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 170);
    fg.addColorStop(0, `rgba(220,232,255,${fa.toFixed(3)})`);
    fg.addColorStop(1, 'rgba(220,232,255,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(cx - 170, cy - 170, 340, 340);
  }
  ctx.fillStyle = 'rgba(200,215,255,0.06)';
  ctx.beginPath();
  ctx.moveTo(X0 + 60, Y0);
  ctx.lineTo(X0 + 180, Y0);
  ctx.lineTo(X0 + 20, Y1);
  ctx.lineTo(X0 - 100, Y1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // window frame
  const wood = C('#5b3f2c');
  const frameCol = css(mul(wood, add(moon, [255, 180, 110], warm * 0.25)));
  ctx.fillStyle = frameCol;
  ctx.fillRect(X0 - 34, Y0 - 34, X1 - X0 + 68, 34);
  ctx.fillRect(X0 - 34, Y1, X1 - X0 + 68, 30);
  ctx.fillRect(X0 - 34, Y0 - 34, 34, Y1 - Y0 + 64);
  ctx.fillRect(X1, Y0 - 34, 34, Y1 - Y0 + 64);
  ctx.fillRect(954 - 11, Y0, 22, Y1 - Y0);
  ctx.fillRect(X0, 404, X1 - X0, 20);
  // stone sill with snow
  ctx.fillStyle = css(mul(C('#bdb6aa'), moon));
  ctx.fillRect(X0 - 70, Y1 + 30, X1 - X0 + 140, 36);
  const snow = css(add(mul(C('#f4f7ff'), moon), [120, 130, 160], 0.35));
  ctx.fillStyle = snow;
  ctx.beginPath();
  ctx.moveTo(X0 - 72, Y1 + 32);
  for (let x = X0 - 72; x <= X1 + 72; x += 20) ctx.lineTo(x, Y1 + 30 - 16 - Math.sin(x * 0.02) * 6 - hash2(x, 3) * 4);
  ctx.lineTo(X1 + 72, Y1 + 32);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(X0 - 36, Y0 - 34);
  for (let x = X0 - 36; x <= X1 + 36; x += 18) ctx.lineTo(x, Y0 - 34 - 10 - Math.sin(x * 0.03) * 4);
  ctx.lineTo(X1 + 36, Y0 - 34);
  ctx.closePath();
  ctx.fill();
  // icicles
  ctx.fillStyle = css(add(mul(C('#dfe8ff'), moon), [100, 120, 160], 0.4), 0.9);
  for (let i = 0; i < 16; i++) {
    const x = X0 - 20 + i * 42 + hash2(i, 8) * 14;
    const len = 14 + hash2(i, 9) * 40;
    ctx.beginPath();
    ctx.moveTo(x - 5, Y0);
    ctx.lineTo(x + 5, Y0);
    ctx.lineTo(x + 0.5, Y0 + len);
    ctx.closePath();
    ctx.fill();
  }
  // falling snow in front
  drawSnow(1, t, 0.15);
}

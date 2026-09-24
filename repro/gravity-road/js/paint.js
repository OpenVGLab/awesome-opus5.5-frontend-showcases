// Canvas-painted glyphs and textures (clef, road lettering, the radio's dial, music pages).
import * as THREE from 'three';

const INK = '#221d2c';
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif';
const SANS = '"Arial Narrow", "Helvetica Neue", Arial, "Liberation Sans", sans-serif';

export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Treble clef as a hand-inked stroke; points normalised to a unit-height box (y down).
const CLEF = [[0.53, 0.66], [0.47, 0.645], [0.455, 0.585], [0.52, 0.535], [0.615, 0.565], [0.655, 0.655], [0.615, 0.755],
  [0.5, 0.795], [0.375, 0.75], [0.31, 0.645], [0.335, 0.525], [0.44, 0.425], [0.55, 0.325], [0.615, 0.205], [0.6, 0.085],
  [0.535, 0.03], [0.465, 0.1], [0.45, 0.25], [0.48, 0.45], [0.515, 0.65], [0.545, 0.845], [0.535, 0.945], [0.47, 0.99], [0.405, 0.96]];

function smoothPath(g, pts, sx, sy, ox, oy) {
  g.beginPath();
  g.moveTo(pts[0][0] * sx + ox, pts[0][1] * sy + oy);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    g.bezierCurveTo(c1x * sx + ox, c1y * sy + oy, c2x * sx + ox, c2y * sy + oy, p2[0] * sx + ox, p2[1] * sy + oy);
  }
}

export function drawClef(g, cx, top, h, color = INK) {
  const ox = cx - 0.485 * h;
  g.save();
  g.strokeStyle = color; g.fillStyle = color;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = h * 0.042;
  smoothPath(g, CLEF, h, h, ox, top);
  g.stroke();
  g.lineWidth = h * 0.07;
  smoothPath(g, CLEF.slice(3, 11), h, h, ox, top);
  g.stroke();
  g.beginPath();
  g.arc(0.425 * h + ox, 0.93 * h + top, h * 0.045, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// The staff glyph canvases map canvas-up to the driver's left (page up) and canvas-right to forward.
export function clefCanvas() {
  const c = makeCanvas(256, 600);
  drawClef(c.getContext('2d'), 128, 0, 600, '#ffffff');
  return c;
}

export function timeSigCanvas() {
  const c = makeCanvas(160, 600);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 250px ${SERIF}`;
  g.fillText('3', 80, 0.318 * 600);
  g.fillText('4', 80, 0.66 * 600);
  return c;
}

export function sharpCanvas(yNorm) {
  const c = makeCanvas(120, 600);
  const g = c.getContext('2d');
  const y = yNorm * 600;
  g.strokeStyle = '#ffffff'; g.lineCap = 'butt';
  g.lineWidth = 9;
  for (const x of [45, 75]) { g.beginPath(); g.moveTo(x, y - 70); g.lineTo(x, y + 80); g.stroke(); }
  g.lineWidth = 22;
  for (const dy of [-26, 30]) { g.beginPath(); g.moveTo(22, y + dy + 12); g.lineTo(98, y + dy - 12); g.stroke(); }
  return c;
}

// Road lettering for the driver: canvas-up is forward along the road.
export function roadTextCanvas(lines, { color = '#ffffff', arrow = false } = {}) {
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length + (arrow ? 1 : 0);
  let y = 512 - 512 / (n + 0.3) * 0.62;
  for (const line of lines) {
    let size = 150;
    g.font = `bold ${size}px ${SANS}`;
    while (g.measureText(line).width > 470 && size > 40) { size -= 6; g.font = `bold ${size}px ${SANS}`; }
    g.fillText(line, 256, y);
    y -= 512 / (n + 0.3);
  }
  if (arrow) {
    g.beginPath();
    g.moveTo(256, y - 90); g.lineTo(336, y + 20); g.lineTo(290, y + 20); g.lineTo(290, y + 90);
    g.lineTo(222, y + 90); g.lineTo(222, y + 20); g.lineTo(176, y + 20); g.closePath();
    g.fill();
  }
  return c;
}

export function radialCanvas() {
  const c = makeCanvas(64, 64);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}

// Arch outline shared by the radio body and its face (x in -w/2..w/2, y in 0..h).
export function archShape(w, h, THREEShape = THREE.Shape) {
  const s = new THREEShape();
  const hw = w / 2, shoulder = h * 0.5;
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, shoulder);
  s.bezierCurveTo(hw, h * 0.86, hw * 0.55, h, 0, h);
  s.bezierCurveTo(-hw * 0.55, h, -hw, h * 0.86, -hw, shoulder);
  s.closePath();
  return s;
}

export function drawRadioFace(canvas, stations, needleFm, label) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.save();
  // wood
  g.fillStyle = '#9b6537';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.18;
  g.strokeStyle = '#4f2c14';
  g.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * W + Math.sin(i * 7.3) * 6;
    g.beginPath(); g.moveTo(x, 0);
    g.bezierCurveTo(x + 12 * Math.sin(i), H * 0.33, x - 10 * Math.cos(i * 1.7), H * 0.66, x + 5, H);
    g.stroke();
  }
  g.globalAlpha = 1;
  // gothic grille
  const gx = W / 2, gTop = H * 0.08, gBot = H * 0.52, gw = W * 0.34;
  const grille = () => {
    g.beginPath();
    g.moveTo(gx - gw, gBot); g.lineTo(gx - gw, gTop + H * 0.18);
    g.bezierCurveTo(gx - gw, gTop + H * 0.02, gx - gw * 0.3, gTop, gx, gTop - H * 0.01);
    g.bezierCurveTo(gx + gw * 0.3, gTop, gx + gw, gTop + H * 0.02, gx + gw, gTop + H * 0.18);
    g.lineTo(gx + gw, gBot); g.closePath();
  };
  grille();
  g.fillStyle = '#dcc08a';
  g.fill();
  g.save();
  grille(); g.clip();
  g.globalAlpha = 0.25; g.strokeStyle = '#8a6a3a'; g.lineWidth = 2;
  for (let y = 0; y < H; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.globalAlpha = 1;
  g.fillStyle = '#7a4a24';
  for (let i = -2; i <= 2; i++) {
    const x = gx + i * gw * 0.38;
    g.fillRect(x - 7, gTop - 10, 14, gBot - gTop + 20);
  }
  g.beginPath();
  g.lineWidth = 12; g.strokeStyle = '#7a4a24';
  g.arc(gx, gBot - H * 0.02, gw * 0.62, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
  g.restore();
  grille();
  g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  // dial
  const dx = W / 2, dy = H * 0.8, dr = W * 0.3;
  g.beginPath();
  g.moveTo(dx - dr, dy); g.arc(dx, dy, dr, Math.PI, 0); g.closePath();
  g.fillStyle = '#f4e6c2'; g.fill();
  g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  const f2a = (fm) => Math.PI + (fm - 86) / (108 - 86) * Math.PI;
  g.lineWidth = 2.5;
  for (let fm = 86; fm <= 108; fm += 2) {
    const a = f2a(fm);
    const r0 = dr * (fm % 4 === 0 ? 0.78 : 0.86);
    g.beginPath(); g.moveTo(dx + Math.cos(a) * r0, dy + Math.sin(a) * r0);
    g.lineTo(dx + Math.cos(a) * dr * 0.95, dy + Math.sin(a) * dr * 0.95); g.stroke();
  }
  g.fillStyle = INK;
  g.font = `bold 20px ${SANS}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const st of stations) {
    const a = f2a(st.fm);
    g.save();
    g.translate(dx + Math.cos(a) * dr * 0.6, dy + Math.sin(a) * dr * 0.6);
    g.fillStyle = st.color;
    g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  const na = f2a(needleFm);
  g.strokeStyle = '#c0392b'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx + Math.cos(na) * dr * 0.93, dy + Math.sin(na) * dr * 0.93); g.stroke();
  g.fillStyle = INK; g.beginPath(); g.arc(dx, dy, 9, 0, Math.PI * 2); g.fill();
  // knobs
  for (const kx of [W * 0.13, W * 0.87]) {
    g.fillStyle = '#3a2416'; g.beginPath(); g.arc(kx, H * 0.84, W * 0.07, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#c9a777'; g.beginPath(); g.arc(kx - 8, H * 0.84 - 8, W * 0.02, 0, Math.PI * 2); g.fill();
  }
  // station plate
  g.fillStyle = '#f4e6c2';
  g.fillRect(W * 0.3, H * 0.56, W * 0.4, H * 0.08);
  g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(W * 0.3, H * 0.56, W * 0.4, H * 0.08);
  g.fillStyle = INK;
  let size = 30;
  g.font = `bold ${size}px ${SERIF}`;
  while (g.measureText(label).width > W * 0.38 && size > 12) { size -= 2; g.font = `bold ${size}px ${SERIF}`; }
  g.fillText(label, W / 2, H * 0.6 + 1);
  g.restore();
}

export function musicPageCanvas(seed) {
  const c = makeCanvas(256, 360);
  const g = c.getContext('2d');
  let a = seed * 9301 + 49297;
  const rnd = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
  g.fillStyle = '#f7efdc'; g.fillRect(0, 0, 256, 360);
  g.strokeStyle = INK; g.fillStyle = INK;
  for (let st = 0; st < 5; st++) {
    const y0 = 40 + st * 64;
    g.lineWidth = 1.6;
    for (let l = 0; l < 5; l++) { g.beginPath(); g.moveTo(14, y0 + l * 7); g.lineTo(242, y0 + l * 7); g.stroke(); }
    if (st === 0 || rnd() < 0.4) drawClef(g, 24, y0 - 12, 56);
    let x = 46;
    while (x < 232) {
      const p = Math.floor(rnd() * 9);
      const y = y0 + 28 - p * 3.5;
      g.save(); g.translate(x, y); g.rotate(-0.35);
      g.beginPath(); g.ellipse(0, 0, 4.6, 3.2, 0, 0, Math.PI * 2);
      if (rnd() < 0.75) g.fill(); else { g.lineWidth = 1.5; g.stroke(); }
      g.restore();
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x + 4.2, y); g.lineTo(x + 4.2, y - 24); g.stroke();
      x += 14 + rnd() * 16;
      if (rnd() < 0.18) { g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + 28); g.stroke(); x += 8; }
    }
  }
  return c;
}

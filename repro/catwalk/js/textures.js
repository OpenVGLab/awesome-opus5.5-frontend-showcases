// Every texture in the game is painted here on canvases at start-up.

import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, { srgb = true, repeat = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

// Tileable value noise in [0,1).
function makeNoise(size, cells, seed) {
  const r = rng(seed);
  const g = new Float32Array(cells * cells).map(() => r());
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells, fy = (y / size) * cells;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[(y0 % cells) * cells + (x0 % cells)];
      const b = g[(y0 % cells) * cells + ((x0 + 1) % cells)];
      const c = g[((y0 + 1) % cells) * cells + (x0 % cells)];
      const d = g[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
      out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return out;
}

function fbm(size, seed, octaves = 4, base = 4) {
  const out = new Float32Array(size * size);
  let amp = 0.5, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const n = makeNoise(size, base << o, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    tot += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

// Paint a colour canvas and a matching grayscale bump canvas pixel by pixel.
function paint(size, fn) {
  const c = canvas(size, size), b = canvas(size, size);
  const cx = c.getContext('2d'), bx = b.getContext('2d');
  const ci = cx.createImageData(size, size), bi = bx.createImageData(size, size);
  const col = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const h = fn(x, y, col);
      ci.data[i] = col[0]; ci.data[i + 1] = col[1]; ci.data[i + 2] = col[2]; ci.data[i + 3] = 255;
      const hv = Math.max(0, Math.min(255, h * 255));
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = hv; bi.data[i + 3] = 255;
    }
  }
  cx.putImageData(ci, 0, 0);
  bx.putImageData(bi, 0, 0);
  return { map: tex(c), bump: tex(b, { srgb: false }) };
}

function brick() {
  const S = 512, bw = 51.2, bh = 16, mortar = 2.2;
  const r = rng(11);
  const rows = S / bh, cols = Math.round(S / bw);
  const tint = [];
  for (let i = 0; i < rows * cols; i++) {
    const k = r();
    const base = k < 0.08 ? [70, 38, 30] : k < 0.2 ? [140, 82, 58] : [108 + r() * 28, 52 + r() * 18, 38 + r() * 14];
    tint.push(base);
  }
  const n = fbm(S, 5, 4, 8);
  const n2 = makeNoise(S, 64, 9);
  return paint(S, (x, y, col) => {
    const row = Math.floor(y / bh);
    const off = row % 2 ? bw / 2 : 0;
    const xx = (x + off) % S;
    const cIdx = Math.floor(xx / bw) % cols;
    const lx = xx - cIdx * bw, ly = y - row * bh;
    const edge = Math.min(lx, bw - lx, ly, bh - ly);
    const nn = n[y * S + x], fine = n2[y * S + x];
    if (edge < mortar) {
      const m = 52 + nn * 30;
      col[0] = m; col[1] = m * 0.95; col[2] = m * 0.88;
      return 0.15 + nn * 0.1;
    }
    const t = tint[row * cols + cIdx];
    const shade = 0.78 + nn * 0.35 + (fine - 0.5) * 0.18 - (edge < 4 ? (4 - edge) * 0.03 : 0);
    col[0] = t[0] * shade; col[1] = t[1] * shade; col[2] = t[2] * shade;
    return 0.62 + fine * 0.3 + Math.min(edge, 5) * 0.015;
  });
}

function plaster() {
  const S = 512;
  const n = fbm(S, 21, 5, 4), f = makeNoise(S, 128, 23);
  const r = rng(29);
  const streaks = Array.from({ length: 14 }, () => [r() * S, 0.3 + r() * 0.7, 6 + r() * 18]);
  return paint(S, (x, y, col) => {
    const v = n[y * S + x], fine = f[y * S + x];
    let s = 0.7 + v * 0.34 + (fine - 0.5) * 0.08;
    for (const [sx, len, w] of streaks) {
      const d = Math.abs(((x - sx + S * 1.5) % S) - S / 2);
      if (d < w && y / S < len) s -= (1 - d / w) * 0.07 * (1 - y / S / len);
    }
    col[0] = 196 * s; col[1] = 188 * s; col[2] = 172 * s;
    return 0.5 + v * 0.3 + fine * 0.2;
  });
}

function wood() {
  const S = 512, pw = 46;
  const r = rng(33);
  const shades = Array.from({ length: 16 }, () => 0.75 + r() * 0.35);
  const n = makeNoise(S, 16, 35);
  return paint(S, (x, y, col) => {
    const k = Math.floor(x / pw);
    const lx = x - k * pw;
    const edge = Math.min(lx, pw - lx);
    const grain = Math.sin((x * 0.9 + n[y * S + x] * 40 + k * 17) * 0.8) * 0.5 + 0.5;
    let s = shades[k % 16] * (0.82 + grain * 0.2 + n[((y * 3) % S) * S + x] * 0.12);
    if (edge < 2) s *= 0.35;
    col[0] = 92 * s; col[1] = 60 * s; col[2] = 38 * s;
    return edge < 2 ? 0.1 : 0.55 + grain * 0.25;
  });
}

function tiles() {
  const S = 512, tw = 32, th = 40;
  const n = fbm(S, 41, 3, 8);
  const r = rng(43);
  const var_ = Array.from({ length: 256 }, () => 0.85 + r() * 0.3);
  return paint(S, (x, y, col) => {
    const cxi = Math.floor(x / tw), cyi = Math.floor(y / th);
    const lx = (x % tw) / tw, ly = (y % th) / th;
    const barrel = Math.sin(lx * Math.PI);
    const lap = ly < 0.14 ? ly / 0.14 : 1;
    const s = var_[(cxi * 7 + cyi * 13) % 256] * (0.45 + barrel * 0.55) * (0.55 + lap * 0.45) * (0.85 + n[y * S + x] * 0.3);
    col[0] = 70 * s; col[1] = 76 * s; col[2] = 88 * s;
    return barrel * 0.8 * lap + 0.1;
  });
}

function concrete() {
  const S = 512, panel = 256;
  const n = fbm(S, 51, 5, 4), f = makeNoise(S, 128, 53);
  return paint(S, (x, y, col) => {
    const lx = x % panel, ly = y % (panel / 2);
    const seam = Math.min(lx, panel - lx, ly, panel / 2 - ly) < 1.5;
    const tie = [[48, 32], [208, 32], [48, 96], [208, 96]].some(([a, b]) => (lx - a) ** 2 + (ly - b) ** 2 < 16);
    const v = n[y * S + x];
    let s = 0.62 + v * 0.36 + (f[y * S + x] - 0.5) * 0.1 - (y % panel) / panel * 0.05;
    if (seam) s *= 0.55;
    if (tie) s *= 0.4;
    col[0] = 150 * s; col[1] = 150 * s; col[2] = 146 * s;
    return seam || tie ? 0.2 : 0.55 + f[y * S + x] * 0.3;
  });
}

function stone() {
  const S = 256, bw = 128, bh = 64;
  const n = fbm(S, 61, 4, 4), f = makeNoise(S, 64, 63);
  return paint(S, (x, y, col) => {
    const row = Math.floor(y / bh);
    const xx = (x + (row % 2) * 64) % S;
    const lx = xx % bw, ly = y % bh;
    const edge = Math.min(lx, bw - lx, ly, bh - ly);
    let s = 0.72 + n[y * S + x] * 0.32 + (f[y * S + x] - 0.5) * 0.12;
    if (edge < 1.5) s *= 0.5;
    col[0] = 170 * s; col[1] = 162 * s; col[2] = 148 * s;
    // Chamfered joints: a hard step here turns into 1px lines when a backlit moon grazes the wall.
    const bevel = Math.min(1, Math.max(0, (edge - 1) / 5));
    return 0.2 + bevel * bevel * (3 - 2 * bevel) * (0.4 + f[y * S + x] * 0.25);
  });
}

function slate() {
  const S = 256, sw = 32, sh = 24;
  const r = rng(71);
  const v = Array.from({ length: 128 }, () => 0.8 + r() * 0.35);
  return paint(S, (x, y, col) => {
    const row = Math.floor(y / sh);
    const xx = (x + (row % 2) * 16) % S;
    const k = Math.floor(xx / sw);
    const ly = (y % sh) / sh;
    const edge = Math.min(xx % sw, sw - (xx % sw));
    let s = v[(k + row * 9) % 128] * (0.55 + ly * 0.45);
    if (edge < 1.2) s *= 0.5;
    col[0] = 58 * s; col[1] = 64 * s; col[2] = 78 * s;
    return ly * 0.8 + (edge < 1.2 ? 0 : 0.2);
  });
}

// ── window atlas: 4×4 cells of 256² ─────────────────────────────────────
// row 0 warm lit, row 1 dark/dim, row 2 paper screens, row 3 modern.
export const WIN = {
  curtains: 0, plant: 1, blinds: 2, figure: 3,
  dark: 4, dim: 5, catSill: 6, darkBlue: 7,
  shoji: 8, shojiFigure: 9, koshi: 10, round: 11,
  office: 12, tv: 13, modernDark: 14, neonReflect: 15,
};

function windowAtlas() {
  const S = 1024, C = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const r = rng(81);
  const cell = (i, fn) => {
    g.save();
    g.translate((i % 4) * C, Math.floor(i / 4) * C);
    g.beginPath(); g.rect(0, 0, C, C); g.clip();
    fn(g);
    g.restore();
  };
  const warm = (g, a = 1) => {
    const gr = g.createRadialGradient(C * 0.5, C * 0.45, 10, C * 0.5, C * 0.5, C * 0.75);
    gr.addColorStop(0, `rgba(255,214,150,${a})`);
    gr.addColorStop(0.6, `rgba(232,150,80,${a})`);
    gr.addColorStop(1, `rgba(150,70,34,${a})`);
    g.fillStyle = gr; g.fillRect(0, 0, C, C);
  };
  const mullions = (g, v = 1, h = 1, w = 7, col = '#15100c') => {
    g.fillStyle = col;
    g.fillRect(0, 0, C, w); g.fillRect(0, C - w, C, w); g.fillRect(0, 0, w, C); g.fillRect(C - w, 0, w, C);
    for (let i = 1; i <= v; i++) g.fillRect((C * i) / (v + 1) - w / 2, 0, w, C);
    for (let i = 1; i <= h; i++) g.fillRect(0, (C * i) / (h + 1) - w / 2, C, w);
  };
  const curtain = (g, x, w, col) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? col : shadeHex(col, 0.72);
      g.fillRect(x + (i * w) / 8, 0, w / 8 + 1, C);
    }
  };
  const dark = (g, top = '#0b1020', bot = '#05070d', streak = 0.06) => {
    const gr = g.createLinearGradient(0, 0, 0, C);
    gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, C, C);
    g.fillStyle = `rgba(160,180,255,${streak})`;
    g.beginPath(); g.moveTo(C * 0.15, 0); g.lineTo(C * 0.45, 0); g.lineTo(C * 0.05, C); g.lineTo(-C * 0.25, C); g.fill();
  };

  cell(WIN.curtains, (g) => { warm(g); curtain(g, 0, C * 0.3, '#8a2d24'); curtain(g, C * 0.7, C * 0.3, '#8a2d24'); mullions(g, 1, 1); });
  cell(WIN.plant, (g) => {
    warm(g);
    g.fillStyle = '#1d140c';
    for (let i = 0; i < 26; i++) {
      const x = C * 0.2 + r() * C * 0.6, y = C * 0.55 + r() * C * 0.3;
      g.beginPath(); g.ellipse(x, y, 10 + r() * 16, 5 + r() * 7, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.fillRect(C * 0.35, C * 0.82, C * 0.3, C * 0.18);
    mullions(g, 1, 1);
  });
  cell(WIN.blinds, (g) => {
    warm(g);
    for (let y = 0; y < C * 0.62; y += 11) { g.fillStyle = 'rgba(80,40,20,0.55)'; g.fillRect(0, y, C, 5); }
    mullions(g, 0, 0);
  });
  cell(WIN.figure, (g) => {
    warm(g);
    g.fillStyle = '#2a160c';
    g.beginPath(); g.arc(C * 0.6, C * 0.42, 22, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(C * 0.6, C * 0.78, 52, 60, 0, Math.PI, 0); g.fill();
    g.fillRect(C * 0.6 - 52, C * 0.78, 104, C);
    curtain(g, 0, C * 0.22, '#6e5a2a');
    mullions(g, 1, 1);
  });
  cell(WIN.dark, (g) => { dark(g); mullions(g, 1, 1, 7, '#1a1612'); });
  cell(WIN.dim, (g) => {
    dark(g, '#120d10', '#07060a', 0.04);
    const gr = g.createRadialGradient(C * 0.25, C * 0.7, 2, C * 0.25, C * 0.7, C * 0.5);
    gr.addColorStop(0, 'rgba(255,170,90,0.9)'); gr.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, C, C);
    mullions(g, 1, 1, 7, '#1a1612');
  });
  cell(WIN.catSill, (g) => {
    dark(g, '#1a2138', '#0a0d18', 0.05);
    const gr = g.createRadialGradient(C * 0.5, C * 0.5, 4, C * 0.5, C * 0.5, C * 0.6);
    gr.addColorStop(0, 'rgba(120,150,220,0.35)'); gr.addColorStop(1, 'rgba(60,80,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, C, C);
    g.fillStyle = '#05060a';
    g.beginPath(); g.ellipse(C * 0.5, C * 0.83, 34, 30, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(C * 0.5, C * 0.62, 18, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(C * 0.5 - 16, C * 0.58); g.lineTo(C * 0.5 - 14, C * 0.5); g.lineTo(C * 0.5 - 4, C * 0.56); g.fill();
    g.beginPath(); g.moveTo(C * 0.5 + 16, C * 0.58); g.lineTo(C * 0.5 + 14, C * 0.5); g.lineTo(C * 0.5 + 4, C * 0.56); g.fill();
    g.lineWidth = 7; g.strokeStyle = '#05060a';
    g.beginPath(); g.moveTo(C * 0.5 + 28, C * 0.9); g.quadraticCurveTo(C * 0.8, C * 0.95, C * 0.78, C * 0.7); g.stroke();
    mullions(g, 0, 1, 7, '#1a1612');
  });
  cell(WIN.darkBlue, (g) => { dark(g, '#101830', '#070a14', 0.08); mullions(g, 0, 2, 6, '#141210'); });
  const shoji = (g, figure) => {
    const gr = g.createLinearGradient(0, 0, 0, C);
    gr.addColorStop(0, '#ffe2b0'); gr.addColorStop(1, '#f0b870');
    g.fillStyle = gr; g.fillRect(0, 0, C, C);
    if (figure) {
      g.fillStyle = 'rgba(90,50,24,0.55)';
      g.beginPath(); g.arc(C * 0.42, C * 0.36, 20, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(C * 0.42, C * 0.8, 46, 64, 0, Math.PI, 0); g.fill();
      g.fillRect(C * 0.42 - 46, C * 0.8, 92, C);
    }
    g.fillStyle = '#2b1a10';
    for (let i = 0; i <= 4; i++) g.fillRect((C * i) / 4 - 3, 0, 6, C);
    for (let i = 0; i <= 6; i++) g.fillRect(0, (C * i) / 6 - 3, C, 6);
  };
  cell(WIN.shoji, (g) => shoji(g, false));
  cell(WIN.shojiFigure, (g) => shoji(g, true));
  cell(WIN.koshi, (g) => {
    warm(g);
    g.fillStyle = '#1e120a';
    for (let x = 0; x < C; x += 18) g.fillRect(x, 0, 10, C);
    g.fillRect(0, 0, C, 12); g.fillRect(0, C - 12, C, 12);
  });
  cell(WIN.round, (g) => {
    g.fillStyle = '#1b1109'; g.fillRect(0, 0, C, C);
    g.save(); g.beginPath(); g.arc(C / 2, C / 2, C * 0.44, 0, Math.PI * 2); g.clip();
    shoji(g, false);
    g.restore();
  });
  cell(WIN.office, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, C);
    gr.addColorStop(0, '#dff4ff'); gr.addColorStop(1, '#9cc6d8');
    g.fillStyle = gr; g.fillRect(0, 0, C, C);
    for (let y = 0; y < C; y += 10) { g.fillStyle = 'rgba(40,70,90,0.35)'; g.fillRect(0, y, C, 4); }
    mullions(g, 1, 0, 6, '#1b2328');
  });
  cell(WIN.tv, (g) => {
    dark(g, '#0a1024', '#04060e', 0.03);
    const gr = g.createRadialGradient(C * 0.45, C * 0.6, 4, C * 0.45, C * 0.6, C * 0.7);
    gr.addColorStop(0, 'rgba(120,170,255,0.95)'); gr.addColorStop(1, 'rgba(40,70,160,0.1)');
    g.fillStyle = gr; g.fillRect(0, 0, C, C);
    mullions(g, 1, 0, 6, '#12161c');
  });
  cell(WIN.modernDark, (g) => { dark(g, '#0c121c', '#05070b', 0.1); mullions(g, 1, 0, 6, '#12161c'); });
  cell(WIN.neonReflect, (g) => {
    dark(g, '#140a1c', '#07040b', 0.04);
    const gr = g.createLinearGradient(0, 0, C, C);
    gr.addColorStop(0, 'rgba(255,60,180,0.5)'); gr.addColorStop(1, 'rgba(40,200,255,0.25)');
    g.fillStyle = gr; g.globalAlpha = 0.6; g.fillRect(0, 0, C, C); g.globalAlpha = 1;
    mullions(g, 1, 0, 6, '#12161c');
  });
  const t = tex(c, { repeat: false });
  t.generateMipmaps = true;
  return t;
}

export function winUV(i) {
  const u0 = (i % 4) / 4, v1 = 1 - Math.floor(i / 4) / 4;
  return [u0 + 0.004, v1 - 0.25 + 0.004, u0 + 0.25 - 0.004, v1 - 0.004];
}

function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

function glow() {
  const S = 128;
  const c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.14)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c, { repeat: false });
}

function softDot() {
  const S = 64;
  const c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c, { repeat: false });
}

function moon() {
  const S = 512;
  const c = canvas(S, S), g = c.getContext('2d');
  const n = fbm(S, 91, 5, 3);
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - S / 2) / (S * 0.46), dy = (y - S / 2) / (S * 0.46);
      const d = Math.sqrt(dx * dx + dy * dy);
      const i = (y * S + x) * 4;
      if (d > 1.02) { img.data[i + 3] = 0; continue; }
      const limb = Math.pow(Math.max(0, 1 - d * d), 0.25);
      const maria = n[y * S + x];
      const s = (0.78 + limb * 0.24) * (maria > 0.55 ? 0.8 - (maria - 0.55) * 0.9 : 1.0);
      img.data[i] = 255 * s * 0.98; img.data[i + 1] = 250 * s * 0.97; img.data[i + 2] = 238 * s;
      img.data[i + 3] = 255 * Math.min(1, (1.02 - d) / 0.03);
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: false });
}

function cloud(seed) {
  const W = 512, H = 256;
  const c = canvas(W, H), g = c.getContext('2d');
  const n = fbm(W, seed, 5, 3);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2;
      const fall = Math.max(0, 1 - (dx * dx * 0.9 + dy * dy * 1.6));
      const v = n[(y * 2) * W + x];
      const a = Math.max(0, (v - 0.42) * 2.4) * fall;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: false });
}

// Distant city: building silhouettes with lit windows, tiling horizontally.
function skyline(seed, { minH, maxH, winChance, color, spire }) {
  const W = 2048, H = 512;
  const c = canvas(W, H), g = c.getContext('2d');
  const r = rng(seed);
  let x = 0;
  while (x < W) {
    const w = 30 + r() * 90;
    const h = minH + Math.pow(r(), 1.6) * (maxH - minH);
    const top = H - h;
    g.fillStyle = color;
    g.fillRect(x, top, w + 1, h);
    if (r() < 0.3) g.fillRect(x + w * 0.3, top - 10 - r() * 20, w * 0.4, 30);
    if (r() < 0.25) { g.fillRect(x + w * 0.5 - 1, top - 30 - r() * 40, 2, 60); }
    if (spire && r() < 0.06) {
      g.beginPath(); g.moveTo(x + w * 0.2, top); g.lineTo(x + w * 0.5, top - 70 - r() * 60); g.lineTo(x + w * 0.8, top); g.fill();
    }
    const cols = Math.floor(w / 7), rows = Math.floor(h / 9);
    for (let j = 1; j < rows; j++) {
      for (let i = 1; i < cols; i++) {
        if (r() > winChance) continue;
        const k = r();
        g.fillStyle = k < 0.7 ? `rgba(255,${190 + r() * 40},${120 + r() * 40},${0.55 + r() * 0.45})` : k < 0.9 ? 'rgba(200,225,255,0.8)' : 'rgba(255,120,90,0.8)';
        g.fillRect(x + i * 7 - 2, top + j * 9, 3, 4);
      }
    }
    x += w + (r() < 0.2 ? r() * 20 : 0);
  }
  const t = tex(c, { repeat: true });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function lanternTex() {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, '#b8a890'); gr.addColorStop(0.5, '#fff6e6'); gr.addColorStop(1, '#b8a890');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(40,20,10,0.35)';
  for (let y = 6; y < S; y += 16) g.fillRect(0, y, S, 3);
  // A cat-face crest; u = 0.25 faces the camera once the lathe is turned.
  for (const cx of [S * 0.25, S * 0.75]) {
    g.fillStyle = 'rgba(20,6,4,0.88)';
    g.beginPath(); g.arc(cx, S * 0.52, 30, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(cx - 28, S * 0.44); g.lineTo(cx - 22, S * 0.3); g.lineTo(cx - 8, S * 0.41); g.fill();
    g.beginPath(); g.moveTo(cx + 28, S * 0.44); g.lineTo(cx + 22, S * 0.3); g.lineTo(cx + 8, S * 0.41); g.fill();
    g.fillStyle = '#fff2dc';
    g.beginPath(); g.ellipse(cx - 11, S * 0.5, 4, 7, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + 11, S * 0.5, 4, 7, 0, 0, Math.PI * 2); g.fill();
  }
  return tex(c, { repeat: false });
}

// Far office towers: floors of small window cells on a dark facade. Lit windows come in
// runs, and only some floors are busy, so the facade reads as offices rather than a grid.
function towerGrid(seed) {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = '#0b0e15'; g.fillRect(0, 0, S, S);
  const cols = 16, rows = 12, cw = S / cols, ch = S / rows;
  for (let j = 0; j < rows; j++) {
    const busy = r() < 0.4 ? 0.3 : 0.04;
    let run = 0;
    for (let i = 0; i < cols; i++) {
      if (run <= 0 && r() < busy) run = 1 + Math.floor(r() * 4);
      let col = r() < 0.5 ? '#080b12' : '#111826';
      if (run > 0) {
        run--;
        col = r() < 0.72
          ? `rgb(${190 + r() * 45},${140 + r() * 40},${80 + r() * 35})`
          : `rgb(${140 + r() * 40},${170 + r() * 40},${210 + r() * 30})`;
      }
      g.fillStyle = col;
      g.fillRect(i * cw + 2, j * ch + 5, cw - 4, ch - 9);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < cols; i += 2) g.fillRect(i * cw, 0, 2, S);
  return tex(c);
}

function stripes(a, b, n = 8) {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * S) / n, 0, S / n + 1, S); }
  const gr = g.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c);
}

function noren() {
  const W = 256, H = 256;
  const c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#1d2a4a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e8e0cc';
  g.beginPath(); g.arc(W / 2, H * 0.45, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1d2a4a';
  g.beginPath(); g.arc(W / 2, H * 0.45, 28, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8e0cc';
  g.beginPath(); g.ellipse(W / 2, H * 0.45, 20, 10, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(W / 2 + 16, H * 0.45); g.lineTo(W / 2 + 32, H * 0.45 - 12); g.lineTo(W / 2 + 32, H * 0.45 + 12); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(W / 3 - 2, H * 0.12, 4, H); g.fillRect((2 * W) / 3 - 2, H * 0.12, 4, H);
  return tex(c, { repeat: false });
}

function grille() {
  const S = 128;
  const c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#8d9296'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#23272b';
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#6b7075'; g.lineWidth = 2;
  for (let r = 8; r < S * 0.4; r += 7) { g.beginPath(); g.arc(S / 2, S / 2, r, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(S * 0.1, S / 2); g.lineTo(S * 0.9, S / 2); g.moveTo(S / 2, S * 0.1); g.lineTo(S / 2, S * 0.9); g.stroke();
  return tex(c, { repeat: false });
}

// Neon lettering on transparent black: bright tube core plus a soft halo.
export function neonTex(text, color, { w = 512, h = 160, font = '600 96px "Didot","Bodoni 72","Playfair Display",Georgia,serif', vertical = false } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font;
  if (!vertical) {
    // leave room for the glow; fallback serifs run much wider than Didot
    const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)[1]);
    const fit = Math.min(1, (w - 64) / g.measureText(text).width, (h - 36) / (px * 0.8));
    if (fit < 1) g.font = font.replace(/\d+(?:\.\d+)?px/, `${Math.floor(px * fit)}px`);
  }
  const draw = (blur, lw, col) => {
    g.shadowColor = color; g.shadowBlur = blur;
    g.lineWidth = lw; g.strokeStyle = col;
    if (vertical) {
      const chars = [...text];
      const step = h / (chars.length + 0.6);
      chars.forEach((ch, i) => g.strokeText(ch, w / 2, step * (i + 0.8)));
    } else g.strokeText(text, w / 2, h / 2 + 4);
  };
  draw(28, 10, color);
  draw(12, 5, color);
  draw(0, 2.2, '#ffffff');
  return tex(c, { repeat: false });
}

function billboard() {
  const W = 1024, H = 512;
  const c = canvas(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, '#1a0f2e'); gr.addColorStop(1, '#3a1036');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f2e6c8';
  g.beginPath(); g.arc(W * 0.72, H * 0.45, 150, 0, Math.PI * 2); g.fill();
  g.fillStyle = gr;
  g.beginPath(); g.arc(W * 0.78, H * 0.4, 140, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0a0610';
  g.beginPath(); g.ellipse(W * 0.66, H * 0.8, 70, 40, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(W * 0.62, H * 0.62, 30, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(W * 0.62 - 26, H * 0.6); g.lineTo(W * 0.62 - 20, H * 0.5); g.lineTo(W * 0.62 - 6, H * 0.57); g.fill();
  g.beginPath(); g.moveTo(W * 0.62 + 26, H * 0.6); g.lineTo(W * 0.62 + 20, H * 0.5); g.lineTo(W * 0.62 + 6, H * 0.57); g.fill();
  g.lineWidth = 12; g.strokeStyle = '#0a0610';
  g.beginPath(); g.moveTo(W * 0.72, H * 0.86); g.bezierCurveTo(W * 0.85, H * 0.92, W * 0.86, H * 0.7, W * 0.8, H * 0.62); g.stroke();
  g.fillStyle = '#f2e6c8';
  g.font = 'italic 300 92px "Didot","Bodoni 72","Playfair Display",Georgia,serif';
  g.textAlign = 'left';
  g.fillText('Nocturne', W * 0.07, H * 0.44);
  g.font = '300 30px "Helvetica Neue",Arial,sans-serif';
  g.fillText('E A U   D E   N U I T', W * 0.075, H * 0.58);
  g.fillStyle = '#d6a15a';
  g.fillRect(W * 0.075, H * 0.64, 160, 3);
  return tex(c, { repeat: false });
}

function signBoard(label, emblem) {
  const W = 256, H = 128;
  const c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#3a2416'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1a0e08'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
  g.fillStyle = '#e9d6ae';
  g.font = '600 54px "Hiragino Mincho ProN","Yu Mincho","Songti SC",Georgia,serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, W * 0.6, H * 0.54);
  g.fillStyle = '#c0432e';
  if (emblem === 'fish') {
    g.beginPath(); g.ellipse(W * 0.2, H * 0.5, 26, 14, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(W * 0.2 + 20, H * 0.5); g.lineTo(W * 0.2 + 40, H * 0.32); g.lineTo(W * 0.2 + 40, H * 0.68); g.fill();
  } else {
    g.beginPath(); g.arc(W * 0.2, H * 0.52, 22, 0, Math.PI * 2); g.fill();
  }
  return tex(c, { repeat: false });
}

function clockFace() {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  gr.addColorStop(0, '#fff3d6'); gr.addColorStop(1, '#f0c784');
  g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S * 0.48, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a1a0e'; g.lineWidth = 6;
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.lineWidth = i % 3 ? 3 : 7;
    g.beginPath(); g.moveTo(S / 2 + Math.sin(a) * S * 0.36, S / 2 - Math.cos(a) * S * 0.36);
    g.lineTo(S / 2 + Math.sin(a) * S * 0.42, S / 2 - Math.cos(a) * S * 0.42); g.stroke();
  }
  g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 - S * 0.02, S / 2 - S * 0.24); g.stroke();
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + S * 0.33, S / 2 - S * 0.04); g.stroke();
  return tex(c, { repeat: false });
}

export function makeTextures() {
  return {
    brick: brick(),
    plaster: plaster(),
    wood: wood(),
    tiles: tiles(),
    concrete: concrete(),
    stone: stone(),
    slate: slate(),
    windows: windowAtlas(),
    glow: glow(),
    dot: softDot(),
    moon: moon(),
    clouds: [cloud(101), cloud(202), cloud(303)],
    skyline: [
      skyline(301, { minH: 60, maxH: 300, winChance: 0.16, color: '#0d1222', spire: true }),
      skyline(302, { minH: 40, maxH: 240, winChance: 0.22, color: '#0a0e1a', spire: true }),
      skyline(303, { minH: 30, maxH: 200, winChance: 0.28, color: '#070a13', spire: false }),
    ],
    lantern: lanternTex(),
    towers: towerGrid(404),
    awningRed: stripes('#7d1f1a', '#e3d3b4'),
    awningBlue: stripes('#1c2d52', '#d8cdb4'),
    noren: noren(),
    grille: grille(),
    billboard: billboard(),
    signs: [signBoard('SOBA', 'fish'), signBoard('SAKE', 'dot'), signBoard('TEA', 'dot')],
    clock: clockFace(),
  };
}

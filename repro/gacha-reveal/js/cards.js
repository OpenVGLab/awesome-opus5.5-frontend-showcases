import { mulberry32, hashString } from './util.js';

export const CARD_W = 720;
export const CARD_H = 1080;

export const SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif CJK JP","Noto Serif JP","Source Han Serif JP","Noto Sans CJK JP",serif';
export const SANS = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo","Noto Sans CJK JP","Noto Sans JP",sans-serif';
export const LATIN = '"Cinzel","Trajan Pro","Cormorant Garamond","Palatino Linotype","Book Antiqua",Georgia,"Times New Roman","Liberation Serif",serif';

export const RARITY = {
  R: { key: 'R', tier: 0, stars: 3, accent: '#9fd0ff' },
  SR: { key: 'SR', tier: 1, stars: 4, accent: '#ffd36b' },
  SSR: { key: 'SSR', tier: 2, stars: 5, accent: '#ffe9a8' },
};

export const ELEMENTS = {
  fire: {
    kanji: '火', c1: '#ff4f36', c2: '#ffb347',
    bgTop: '#12040b', bgMid: '#2c0816', bgBot: '#4d1210',
    neb: ['#ff4d2e', '#ff9a3c', '#c8266e', '#ff6a00'], line: '#ffe3bf', glow: '#ff7a3a', accent: '#ffbd7a',
  },
  water: {
    kanji: '水', c1: '#2f7dff', c2: '#6fe6ff',
    bgTop: '#01061a', bgMid: '#051b44', bgBot: '#0b3566',
    neb: ['#2e8bff', '#35e0ff', '#5b4dff', '#00b3ff'], line: '#dbf5ff', glow: '#5cc6ff', accent: '#a6e8ff',
  },
  wind: {
    kanji: '風', c1: '#12b98f', c2: '#8cffd8',
    bgTop: '#010c10', bgMid: '#03282c', bgBot: '#07423c',
    neb: ['#27f5b8', '#39a8ff', '#9dff6a', '#00d6a0'], line: '#ddfff3', glow: '#4dffc6', accent: '#a9ffe2',
  },
  light: {
    kanji: '光', c1: '#f0b429', c2: '#fff1a8',
    bgTop: '#0d0819', bgMid: '#2c1f44', bgBot: '#5c3f3c',
    neb: ['#ffd36a', '#fff0b8', '#ff9ecf', '#ffb347'], line: '#fff5d8', glow: '#ffe39a', accent: '#ffe7a6',
  },
  dark: {
    kanji: '闇', c1: '#6f35ff', c2: '#d27bff',
    bgTop: '#07020f', bgMid: '#1e0735', bgBot: '#360b48',
    neb: ['#9b3cff', '#ff2e88', '#4b2cff', '#d13cff'], line: '#f3d9ff', glow: '#c46bff', accent: '#e4adff',
  },
};

function arc(n, cx, cy, r, a0, a1, mags) {
  const stars = [];
  for (let i = 0; i < n; i++) {
    const a = ((a0 + (a1 - a0) * (i / (n - 1))) * Math.PI) / 180;
    stars.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, mags[i]]);
  }
  return stars;
}

// Star coordinates are hand-traced, roughly after the real constellations (x right, y up, third value = magnitude).
export const SPIRITS = [
  {
    id: 'sirius', rarity: 'SSR', title: '天狼', name: 'シリウス', en: 'SIRIUS', bayer: 'α CMa',
    element: 'water', cons: 'おおいぬ座', consEn: 'CANIS MAJOR', kanji: '狼',
    quote: 'やっと見つけた。今度は君の空で、いちばん強く輝いてみせる。',
    stars: [[0.10, 0.42, 0.6], [0.55, 0.52, 2.5], [0.02, 0.80, 3.4], [-0.24, 0.62, 3.8], [-0.18, -0.05, 2.0],
      [-0.05, -0.56, 1.8], [-0.64, -0.26, 2.6], [0.42, -0.74, 3.0], [0.30, 0.06, 3.5]],
    lines: [[1, 0], [0, 2], [2, 3], [3, 0], [0, 8], [8, 4], [4, 5], [4, 6], [5, 7]],
  },
  {
    id: 'regulus', rarity: 'SSR', title: '獅子王', name: 'レグルス', en: 'REGULUS', bayer: 'α Leo',
    element: 'fire', cons: 'しし座', consEn: 'LEO', kanji: '獅',
    quote: '我が咆哮は夜を裂く。ついて来い、主よ。',
    stars: [[0.30, -0.30, 1.0], [0.36, 0.02, 3.2], [0.26, 0.30, 2.0], [0.42, 0.55, 3.2], [0.68, 0.62, 3.6],
      [0.76, 0.38, 2.9], [-0.30, 0.22, 2.4], [-0.28, -0.16, 3.3], [-0.78, -0.02, 2.1]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 8], [8, 7], [7, 0], [6, 7]],
  },
  {
    id: 'deneb', rarity: 'SSR', title: '白鳥の歌姫', name: 'デネブ', en: 'DENEB', bayer: 'α Cyg',
    element: 'light', cons: 'はくちょう座', consEn: 'CYGNUS', kanji: '翔',
    quote: '千年先まで届くように——あなたのためだけに歌うわ。',
    stars: [[-0.05, 0.80, 1.0], [0.00, 0.22, 2.2], [0.05, -0.30, 3.8], [0.10, -0.82, 3.0], [-0.55, 0.05, 2.5],
      [-0.85, -0.22, 3.6], [0.52, 0.38, 2.9], [0.82, 0.58, 3.8]],
    lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [1, 6], [6, 7]],
  },
  {
    id: 'antares', rarity: 'SSR', title: '紅蠍', name: 'アンタレス', en: 'ANTARES', bayer: 'α Sco',
    element: 'dark', cons: 'さそり座', consEn: 'SCORPIUS', kanji: '蠍',
    quote: 'その心臓ごと、わたしの紅い炎で灼いてあげる。',
    stars: [[0.18, 0.22, 1.0], [0.42, 0.55, 2.3], [0.60, 0.74, 2.6], [0.50, 0.30, 2.9], [0.30, 0.40, 2.9],
      [0.10, 0.02, 2.8], [0.02, -0.25, 2.3], [-0.04, -0.50, 3.0], [-0.12, -0.72, 3.6], [-0.34, -0.86, 3.3],
      [-0.58, -0.80, 1.9], [-0.76, -0.60, 3.0], [-0.72, -0.38, 2.4], [-0.52, -0.40, 1.6]],
    lines: [[2, 1], [1, 3], [1, 4], [4, 0], [0, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]],
  },
  {
    id: 'vega', rarity: 'SR', title: '琴姫', name: 'ベガ', en: 'VEGA', bayer: 'α Lyr',
    element: 'light', cons: 'こと座', consEn: 'LYRA', kanji: '琴',
    quote: '今宵の旋律は、あなたに捧げます。',
    stars: [[-0.05, 0.62, 0.6], [0.28, 0.80, 4.0], [0.20, 0.30, 4.1], [0.40, -0.25, 4.0], [0.08, -0.62, 3.2], [-0.24, -0.35, 3.4]],
    lines: [[0, 1], [1, 2], [0, 2], [2, 3], [3, 4], [4, 5], [5, 2]],
  },
  {
    id: 'betelgeuse', rarity: 'SR', title: '狩人', name: 'ベテルギウス', en: 'BETELGEUSE', bayer: 'α Ori',
    element: 'fire', cons: 'オリオン座', consEn: 'ORION', kanji: '狩',
    quote: '獲物は逃さない。星ごと射抜くだけさ。',
    stars: [[-0.45, 0.48, 0.8], [0.42, 0.42, 1.8], [-0.02, 0.78, 3.4], [-0.20, -0.04, 1.9], [0.00, 0.02, 1.7],
      [0.19, 0.08, 2.2], [-0.36, -0.72, 2.1], [0.46, -0.66, 1.0], [-0.62, 0.80, 4.0], [-0.52, 0.98, 4.2],
      [0.72, 0.62, 4.1], [0.80, 0.30, 4.1], [0.74, 0.02, 4.2]],
    lines: [[2, 0], [2, 1], [0, 3], [1, 5], [3, 4], [4, 5], [3, 6], [5, 7], [0, 8], [8, 9], [1, 11], [10, 11], [11, 12]],
  },
  {
    id: 'castor', rarity: 'SR', title: '双星', name: 'カストル', en: 'CASTOR', bayer: 'α Gem',
    element: 'water', cons: 'ふたご座', consEn: 'GEMINI', kanji: '双',
    quote: 'ポルックスと一緒なら、どこへだって行けるよ！',
    stars: [[-0.30, 0.78, 1.6], [0.12, 0.70, 1.2], [-0.38, 0.30, 3.6], [-0.46, -0.18, 3.0], [-0.58, -0.70, 2.9],
      [-0.78, -0.78, 3.3], [0.08, 0.22, 3.5], [0.02, -0.26, 3.5], [-0.06, -0.72, 1.9], [0.20, -0.84, 3.4], [-0.14, 0.26, 4.0]],
    lines: [[0, 2], [2, 3], [3, 4], [4, 5], [1, 6], [6, 7], [7, 8], [8, 9], [2, 10], [10, 6]],
  },
  {
    id: 'aldebaran', rarity: 'SR', title: '牡牛の瞳', name: 'アルデバラン', en: 'ALDEBARAN', bayer: 'α Tau',
    element: 'dark', cons: 'おうし座', consEn: 'TAURUS', kanji: '牛',
    quote: '後をついて行くのは得意なんだ。君の影みたいにね。',
    stars: [[0.10, 0.02, 0.9], [0.32, -0.10, 3.6], [0.26, 0.14, 3.7], [0.16, 0.30, 3.5], [-0.70, 0.78, 1.7],
      [-0.78, 0.20, 3.0], [0.62, -0.36, 3.6], [0.86, -0.62, 4.0],
      [0.70, 0.62, 3.0], [0.76, 0.66, 3.8], [0.66, 0.70, 3.8], [0.73, 0.57, 3.9], [0.80, 0.60, 4.1], [0.68, 0.64, 4.2]],
    lines: [[1, 0], [0, 5], [1, 2], [2, 3], [3, 4], [1, 6], [6, 7]],
  },
  {
    id: 'altair', rarity: 'SR', title: '天鷲', name: 'アルタイル', en: 'ALTAIR', bayer: 'α Aql',
    element: 'wind', cons: 'わし座', consEn: 'AQUILA', kanji: '鷲',
    quote: '風を掴め。空はいつだって僕らの味方だ。',
    stars: [[0.00, 0.10, 0.8], [-0.14, 0.28, 2.7], [0.13, -0.06, 3.7], [0.46, 0.22, 3.4], [0.86, 0.44, 3.0],
      [-0.46, -0.04, 3.4], [-0.82, -0.30, 3.2], [0.06, -0.42, 3.3], [0.14, -0.78, 3.4], [-0.30, 0.62, 4.0]],
    lines: [[1, 0], [0, 2], [0, 3], [3, 4], [0, 5], [5, 6], [2, 7], [7, 8], [1, 9]],
  },
  {
    id: 'polaris', rarity: 'R', title: '北極星', name: 'ポラリス', en: 'POLARIS', bayer: 'α UMi',
    element: 'water', cons: 'こぐま座', consEn: 'URSA MINOR', kanji: '極',
    quote: '迷ったら、わたしを見上げて。',
    stars: [[0.62, 0.72, 1.3], [0.38, 0.52, 4.2], [0.12, 0.36, 4.3], [-0.10, 0.10, 4.2], [-0.20, -0.30, 2.1],
      [-0.62, -0.20, 3.0], [-0.52, 0.20, 4.6]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    id: 'dubhe', rarity: 'R', title: '北斗', name: 'ドゥーベ', en: 'DUBHE', bayer: 'α UMa',
    element: 'wind', cons: 'おおぐま座', consEn: 'URSA MAJOR', kanji: '斗',
    quote: '七つ星の長兄として、しっかり守るよ。',
    stars: [[0.78, 0.36, 1.8], [0.74, -0.12, 2.3], [0.26, -0.24, 2.4], [0.20, 0.14, 3.3], [-0.20, 0.24, 1.8],
      [-0.50, 0.30, 2.1], [-0.86, 0.04, 1.9], [-0.47, 0.40, 4.0]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  {
    id: 'alphecca', rarity: 'R', title: '星冠', name: 'アルフェッカ', en: 'ALPHECCA', bayer: 'α CrB',
    element: 'light', cons: 'かんむり座', consEn: 'CORONA BOREALIS', kanji: '冠',
    quote: 'この冠、似合ってる？ ふふ、ありがと。',
    stars: arc(7, 0, 0.35, 0.72, 200, 340, [3.7, 3.8, 3.6, 2.2, 3.8, 4.1, 4.6]),
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
    alpha: 3,
  },
  {
    id: 'schedar', rarity: 'R', title: '女王', name: 'シェダル', en: 'SCHEDAR', bayer: 'α Cas',
    element: 'dark', cons: 'カシオペヤ座', consEn: 'CASSIOPEIA', kanji: '后',
    quote: '跪きなさい。……なんて、冗談よ。',
    stars: [[-0.36, -0.22, 2.2], [-0.80, 0.22, 2.3], [0.02, 0.16, 2.2], [0.40, -0.26, 2.7], [0.82, 0.24, 3.4]],
    lines: [[1, 0], [0, 2], [2, 3], [3, 4]],
  },
  {
    id: 'sualocin', rarity: 'R', title: '星海豚', name: 'スアロキン', en: 'SUALOCIN', bayer: 'α Del',
    element: 'water', cons: 'いるか座', consEn: 'DELPHINUS', kanji: '海',
    quote: '星の海を泳ぐの、けっこう得意なんだ。',
    stars: [[-0.05, 0.40, 3.0], [-0.30, 0.20, 3.2], [0.28, 0.30, 3.6], [0.05, 0.02, 4.0], [-0.42, -0.52, 3.8]],
    lines: [[0, 2], [2, 3], [3, 1], [1, 0], [1, 4]],
  },
  {
    id: 'hamal', rarity: 'R', title: '金羊', name: 'ハマル', en: 'HAMAL', bayer: 'α Ari',
    element: 'fire', cons: 'おひつじ座', consEn: 'ARIES', kanji: '羊',
    quote: '金色の毛並み、ちょっとした自慢なんです。',
    stars: [[0.28, 0.20, 2.0], [-0.18, -0.04, 2.6], [-0.30, -0.28, 3.9], [0.80, 0.42, 3.6], [-0.62, 0.40, 4.5]],
    lines: [[3, 0], [0, 1], [1, 2]],
  },
];

export const byId = Object.fromEntries(SPIRITS.map((s) => [s.id, s]));
export const PICKUP_ID = 'sirius';

/* ---------------------------------------------------------------- helpers */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function rrPath(g, x, y, w, h, r) {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function glowDot(g, x, y, r, color, alpha) {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, rgba(color, alpha));
  grd.addColorStop(0.22, rgba(color, alpha * 0.42));
  grd.addColorStop(0.55, rgba(color, alpha * 0.1));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function sparkle(g, x, y, r, color, alpha, thin = 0.16, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.globalAlpha = alpha;
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.25, color);
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd;
  const t = r * thin;
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(t, -t, r, 0);
  g.quadraticCurveTo(t, t, 0, r);
  g.quadraticCurveTo(-t, t, -r, 0);
  g.quadraticCurveTo(-t, -t, 0, -r);
  g.fill();
  g.restore();
}

export function starShape(g, cx, cy, rOut, rIn, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rIn : rOut;
    const a = rot + (i * Math.PI) / n;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

function rainbowConic(g, cx, cy, rot = 0) {
  if (!g.createConicGradient) {
    const lg = g.createLinearGradient(0, 0, CARD_W, CARD_H);
    ['#ff6b8b', '#ffc56b', '#fff27a', '#7dffb0', '#6bd8ff', '#b28bff', '#ff6bd5'].forEach((c, i, a) => lg.addColorStop(i / (a.length - 1), c));
    return lg;
  }
  const cg = g.createConicGradient(rot, cx, cy);
  const stops = ['#ff7a9c', '#ffc66e', '#fff38a', '#8cffb8', '#74dcff', '#9f8cff', '#ff8ce0', '#ff7a9c'];
  stops.forEach((c, i) => cg.addColorStop(i / (stops.length - 1), c));
  return cg;
}

function metalGradient(g, tier, x0, y0, x1, y1) {
  const lg = g.createLinearGradient(x0, y0, x1, y1);
  const sets = [
    ['#eef4ff', '#7d8fba', '#f7f9ff', '#55658f', '#dfe7fb', '#8494bd', '#f3f6ff'],
    ['#fff4c2', '#c28a26', '#fff8dc', '#8a5812', '#f7cf68', '#a86f1c', '#fff1b8'],
    ['#fffdf2', '#e0b04c', '#fff7d0', '#b07a22', '#fff1b4', '#c89032', '#fffbe6'],
  ][tier];
  sets.forEach((c, i) => lg.addColorStop(i / (sets.length - 1), c));
  return lg;
}

/* ---------------------------------------------------------------- art */

function fitStars(sp) {
  const xs = sp.stars.map((s) => s[0]);
  const ys = sp.stars.map((s) => s[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const bw = Math.max(0.3, maxX - minX), bh = Math.max(0.3, maxY - minY);
  const s = Math.min((CARD_W * 0.68) / bw, 540 / bh);
  const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
  return sp.stars.map(([x, y, m]) => ({ x: CARD_W / 2 + (x - ox) * s, y: 410 - (y - oy) * s, m }));
}

function drawNebula(g, E, rng, tier) {
  const off = makeCanvas(CARD_W / 2, CARD_H / 2);
  const o = off.getContext('2d');
  o.globalCompositeOperation = 'lighter';
  const ang = -0.6 - rng() * 0.9;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const count = 44 + tier * 10;
  for (let i = 0; i < count; i++) {
    const t = (rng() - 0.5) * 1.8;
    const s = (rng() - 0.5) * 0.55 * (1 - Math.abs(t) * 0.35);
    const cx = CARD_W / 4 + (ca * t - sa * s) * (CARD_W / 2.2);
    const cy = CARD_H / 4.6 + (sa * t + ca * s) * (CARD_W / 2.2);
    const r = 24 + rng() * 110;
    const col = E.neb[Math.floor(rng() * E.neb.length)];
    const a = 0.05 + rng() * 0.11;
    const grd = o.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, rgba(col, a));
    grd.addColorStop(1, rgba(col, 0));
    o.fillStyle = grd;
    o.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.filter = 'blur(5px)';
  g.drawImage(off, 0, 0, CARD_W, CARD_H);
  g.filter = 'none';
  g.restore();
  // dark dust lanes
  g.save();
  for (let i = 0; i < 9; i++) {
    const cx = rng() * CARD_W, cy = 80 + rng() * 700, r = 60 + rng() * 140;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, 'rgba(0,0,6,0.28)');
    grd.addColorStop(1, 'rgba(0,0,6,0)');
    g.fillStyle = grd;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  g.restore();
}

function drawStarfield(g, E, rng) {
  for (let i = 0; i < 520; i++) {
    const x = rng() * CARD_W, y = rng() * 860;
    const big = rng() > 0.93;
    const r = big ? 1.2 + rng() * 1.3 : 0.45 + rng() * 0.9;
    g.fillStyle = rng() > 0.7 ? rgba(E.line, 0.5 + rng() * 0.5) : `rgba(255,255,255,${0.25 + rng() * 0.6})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = rng() * CARD_W, y = rng() * 820;
    glowDot(g, x, y, 10 + rng() * 14, E.glow, 0.35 + rng() * 0.3);
    if (rng() > 0.55) sparkle(g, x, y, 8 + rng() * 10, E.line, 0.7, 0.12);
  }
}

function drawAstrolabe(g, E, tier, rng) {
  const cx = CARD_W / 2, cy = 405, R = 305;
  g.save();
  g.translate(cx, cy);
  g.rotate(rng() * Math.PI * 2);
  g.strokeStyle = rgba(E.line, 0.24);
  g.fillStyle = rgba(E.line, 0.3);
  g.lineWidth = 1.4;
  const circle = (r) => {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  };
  circle(R);
  circle(R - 28);
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const len = i % 10 === 0 ? 22 : i % 5 === 0 ? 14 : 7;
    g.beginPath();
    g.moveTo(Math.cos(a) * (R - len), Math.sin(a) * (R - len));
    g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    g.stroke();
  }
  const greek = 'αβγδεζηθικλμ';
  g.font = `20px ${LATIN}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    g.save();
    g.rotate(a);
    g.translate(0, -(R - 45));
    g.fillText(greek[i], 0, 0);
    g.restore();
  }
  g.setLineDash([3, 9]);
  circle(R * 0.62);
  g.setLineDash([]);
  if (tier >= 1) {
    g.strokeStyle = rgba(E.line, 0.16);
    circle(R + 26);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.save();
      g.rotate(a);
      g.translate(0, -(R + 26));
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(5, 0);
      g.lineTo(0, 6);
      g.lineTo(-5, 0);
      g.closePath();
      g.fillStyle = rgba(E.line, 0.45);
      g.fill();
      g.restore();
    }
    g.beginPath();
    g.ellipse(0, 0, R * 0.95, R * 0.36, 0.5, 0, Math.PI * 2);
    g.stroke();
  }
  if (tier >= 2) {
    g.strokeStyle = 'rgba(255,236,170,0.28)';
    g.beginPath();
    g.ellipse(0, 0, R * 0.8, R * 0.26, -0.8, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      g.fillStyle = 'rgba(255,240,190,0.7)';
      g.beginPath();
      g.arc(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.36, 4 + rng() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

function drawRibbons(g, E, tier, rng) {
  const n = 2 + tier * 2;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const y0 = 180 + rng() * 560, y1 = 80 + rng() * 620;
    const p0 = [-60, y0], p3 = [CARD_W + 60, y1];
    const c1 = [CARD_W * 0.33, y0 + (rng() - 0.5) * 560];
    const c2 = [CARD_W * 0.66, y1 + (rng() - 0.5) * 560];
    let col;
    if (tier === 2) col = ['#ff9ad0', '#ffe58a', '#8ff0ff', '#b8a0ff', '#9dffc4', '#ffffff'][i % 6];
    else if (tier === 1 && i % 2 === 1) col = '#ffd978';
    else col = E.glow;
    const lg = g.createLinearGradient(0, 0, CARD_W, 0);
    lg.addColorStop(0, rgba(col, 0));
    lg.addColorStop(0.2 + rng() * 0.2, rgba(col, 0.9));
    lg.addColorStop(0.8, rgba(col, 0.5));
    lg.addColorStop(1, rgba(col, 0));
    const passes = [[18, 0.07], [6, 0.22], [1.6, 0.85]];
    for (const [w, a] of passes) {
      g.globalAlpha = a;
      g.strokeStyle = lg;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(...p0);
      g.bezierCurveTo(...c1, ...c2, ...p3);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (let j = 0; j < 26; j++) {
      const t = rng();
      const mt = 1 - t;
      const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * p3[0];
      const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * p3[1];
      g.fillStyle = rgba(col, 0.4 + rng() * 0.6);
      g.beginPath();
      g.arc(x + (rng() - 0.5) * 30, y + (rng() - 0.5) * 30, 0.6 + rng() * 1.8, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

function drawConstellation(g, sp, pts, E, tier) {
  const alphaIdx = sp.alpha ?? 0;
  const rad = (m) => 2.4 + Math.max(0, 5.2 - m) * 2.2;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  const passes = [[11, 0.06], [4.5, 0.16], [1.8, 0.85]];
  for (const [w, a] of passes) {
    g.strokeStyle = rgba(E.line, a);
    g.lineWidth = w;
    g.beginPath();
    for (const [i, j] of sp.lines) {
      const A = pts[i], B = pts[j];
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
      const ga = rad(A.m) + 7, gb = rad(B.m) + 7;
      if (d < ga + gb) continue;
      g.moveTo(A.x + (dx / d) * ga, A.y + (dy / d) * ga);
      g.lineTo(B.x - (dx / d) * gb, B.y - (dy / d) * gb);
    }
    g.stroke();
  }
  pts.forEach((p, i) => {
    const r = rad(p.m);
    const isA = i === alphaIdx;
    glowDot(g, p.x, p.y, r * (isA ? 11 : 6), E.glow, isA ? 0.7 : 0.45);
    glowDot(g, p.x, p.y, r * 2.4, '#ffffff', 0.85);
    sparkle(g, p.x, p.y, r * (isA ? 9 : 4.6), E.line, 0.95, 0.1);
    if (isA) sparkle(g, p.x, p.y, r * 5, E.line, 0.7, 0.12, Math.PI / 4);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
    g.fill();
  });
  g.restore();

  const a = pts[alphaIdx];
  const ra = rad(a.m);
  g.save();
  g.strokeStyle = rgba(E.line, 0.55);
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(a.x, a.y, ra * 3.4, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([2, 6]);
  g.beginPath();
  g.arc(a.x, a.y, ra * 4.8, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  if (tier === 2) {
    g.lineWidth = 3;
    g.strokeStyle = rainbowConic(g, a.x, a.y, 0.3);
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(a.x, a.y, ra * 6.2, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }
  // label with leader line
  const right = a.x < CARD_W * 0.62;
  const lx = a.x + (right ? 1 : -1) * (ra * 4.8 + 16);
  const ly = a.y - ra * 3.6 - 10;
  g.beginPath();
  g.moveTo(a.x + (right ? 1 : -1) * ra * 3.4 * 0.7, a.y - ra * 3.4 * 0.7);
  g.lineTo(lx, ly);
  g.lineTo(lx + (right ? 70 : -70), ly);
  g.stroke();
  g.fillStyle = rgba(E.line, 0.9);
  g.textAlign = right ? 'left' : 'right';
  g.textBaseline = 'bottom';
  if ('letterSpacing' in g) g.letterSpacing = '4px';
  g.font = `600 19px ${LATIN}`;
  g.fillText(sp.en, lx + (right ? 2 : -2), ly - 6);
  g.font = `15px ${LATIN}`;
  g.fillStyle = rgba(E.line, 0.6);
  g.textBaseline = 'top';
  g.fillText(sp.bayer, lx + (right ? 2 : -2), ly + 6);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.restore();
}

function drawKanji(g, sp, E) {
  g.save();
  g.font = `300 560px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const kg = g.createLinearGradient(0, 120, 0, 720);
  kg.addColorStop(0, rgba(E.accent, 0.13));
  kg.addColorStop(1, rgba(E.accent, 0.015));
  g.fillStyle = kg;
  g.fillText(sp.kanji, CARD_W / 2, 425);
  g.lineWidth = 1.5;
  const sg = g.createLinearGradient(0, 120, 0, 720);
  sg.addColorStop(0, rgba(E.line, 0.26));
  sg.addColorStop(1, rgba(E.line, 0.04));
  g.strokeStyle = sg;
  g.strokeText(sp.kanji, CARD_W / 2, 425);
  g.restore();
}

function drawFrame(g, tier) {
  const bw = [14, 18, 20][tier];
  const acc = ['#bfe0ff', '#ffe08a', '#fff2c4'][tier];
  g.save();
  g.beginPath();
  rrPath(g, 0, 0, CARD_W, CARD_H, 36);
  rrPath(g, bw, bw, CARD_W - bw * 2, CARD_H - bw * 2, 24);
  g.fillStyle = tier === 2 ? rainbowConic(g, CARD_W / 2, CARD_H / 2, -0.4) : metalGradient(g, tier, 0, 0, CARD_W, CARD_H);
  g.fill('evenodd');
  if (tier === 2) {
    const gl = g.createLinearGradient(0, 0, CARD_W, CARD_H);
    gl.addColorStop(0, 'rgba(255,255,255,0.6)');
    gl.addColorStop(0.28, 'rgba(255,255,255,0.05)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    gl.addColorStop(0.72, 'rgba(255,255,255,0.05)');
    gl.addColorStop(1, 'rgba(255,255,255,0.5)');
    g.fillStyle = gl;
    g.fill('evenodd');
  }
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.beginPath();
  rrPath(g, 1.5, 1.5, CARD_W - 3, CARD_H - 3, 35);
  g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.beginPath();
  rrPath(g, bw, bw, CARD_W - bw * 2, CARD_H - bw * 2, 24);
  g.stroke();
  // inner accent line (gold on SSR)
  g.strokeStyle = tier === 2 ? metalGradient(g, 2, 0, 0, CARD_W, CARD_H) : rgba(acc, 0.8);
  g.lineWidth = tier === 2 ? 3 : 1.5;
  g.beginPath();
  rrPath(g, bw + 8, bw + 8, CARD_W - (bw + 8) * 2, CARD_H - (bw + 8) * 2, 18);
  g.stroke();

  if (tier >= 1) {
    const orn = metalGradient(g, tier, 0, 0, 120, 120);
    for (let k = 0; k < 4; k++) {
      g.save();
      g.translate(k % 2 ? CARD_W : 0, k > 1 ? CARD_H : 0);
      g.scale(k % 2 ? -1 : 1, k > 1 ? -1 : 1);
      const o = bw + 8;
      g.fillStyle = orn;
      g.strokeStyle = orn;
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(o + 4, o + 70);
      g.quadraticCurveTo(o + 4, o + 4, o + 70, o + 4);
      g.stroke();
      g.beginPath();
      g.moveTo(o + 16, o + 4);
      g.lineTo(o + 28, o + 16);
      g.lineTo(o + 16, o + 28);
      g.lineTo(o + 4, o + 16);
      g.closePath();
      g.fill();
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(o + 38, o + 38, 12, Math.PI, Math.PI * 1.5);
      g.stroke();
      g.beginPath();
      g.moveTo(o + 70, o + 4);
      g.lineTo(o + 150, o + 4);
      g.moveTo(o + 4, o + 70);
      g.lineTo(o + 4, o + 150);
      g.stroke();
      if (tier === 2) {
        sparkle(g, o + 16, o + 16, 22, '#fff3c0', 0.95, 0.12);
      }
      g.restore();
    }
  }
  // top gem
  const gx = CARD_W / 2, gy = bw / 2 + 1;
  g.beginPath();
  g.moveTo(gx, gy - 16);
  g.lineTo(gx + 26, gy);
  g.lineTo(gx, gy + 16);
  g.lineTo(gx - 26, gy);
  g.closePath();
  const gemCols = [['#e6f4ff', '#3f8cff'], ['#fff6c8', '#e0901c'], ['#ffffff', '#ff8ad8']][tier];
  const gg = g.createLinearGradient(gx - 26, gy - 16, gx + 26, gy + 16);
  gg.addColorStop(0, gemCols[0]);
  gg.addColorStop(1, gemCols[1]);
  g.fillStyle = tier === 2 ? rainbowConic(g, gx, gy, 0) : gg;
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 1.5;
  g.stroke();
  g.restore();
}

function drawStarsRow(g, n, x, y, size, tier) {
  for (let i = 0; i < n; i++) {
    const cx = x + i * size * 1.08 + size / 2;
    g.save();
    g.shadowColor = tier === 2 ? 'rgba(255,220,150,0.9)' : tier === 1 ? 'rgba(255,200,80,0.8)' : 'rgba(140,200,255,0.8)';
    g.shadowBlur = 10;
    starShape(g, cx, y, size / 2, size / 4.4);
    const sg = g.createLinearGradient(cx, y - size / 2, cx, y + size / 2);
    sg.addColorStop(0, '#fffbe6');
    sg.addColorStop(0.5, tier === 0 ? '#9fd4ff' : '#ffd24a');
    sg.addColorStop(1, tier === 0 ? '#4a8fe0' : '#d88a14');
    g.fillStyle = sg;
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(80,40,0,0.5)';
    g.stroke();
    g.restore();
  }
}

function fitFont(g, text, weight, size, family, maxW) {
  let s = size;
  g.font = `${weight} ${s}px ${family}`;
  while (g.measureText(text).width > maxW && s > 20) {
    s -= 2;
    g.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function drawInfo(g, sp) {
  const R = RARITY[sp.rarity], E = ELEMENTS[sp.element], tier = R.tier;
  const top = 720;
  const pg = g.createLinearGradient(0, top, 0, CARD_H);
  pg.addColorStop(0, 'rgba(3,4,14,0)');
  pg.addColorStop(0.28, 'rgba(3,4,14,0.8)');
  pg.addColorStop(1, 'rgba(2,3,10,0.95)');
  g.fillStyle = pg;
  g.fillRect(0, top, CARD_W, CARD_H - top);

  const sep = g.createLinearGradient(40, 0, CARD_W - 40, 0);
  const accent = tier === 0 ? E.line : RARITY[sp.rarity].accent;
  sep.addColorStop(0, rgba(accent, 0));
  sep.addColorStop(0.5, rgba(accent, 0.9));
  sep.addColorStop(1, rgba(accent, 0));
  g.fillStyle = sep;
  g.fillRect(40, 868, CARD_W - 80, 2);

  // rarity label
  g.save();
  g.font = `900 74px ${LATIN}`;
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = '2px';
  const label = sp.rarity;
  const lw = g.measureText(label).width;
  const lx = 46, ly = 842;
  const lg = tier === 2 ? rainbowConic(g, lx + lw / 2, ly - 30, 0.8) : metalGradient(g, tier, lx, ly - 64, lx + lw, ly);
  g.lineWidth = 7;
  g.strokeStyle = 'rgba(10,8,20,0.9)';
  g.strokeText(label, lx, ly);
  g.fillStyle = lg;
  g.fillText(label, lx, ly);
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.strokeText(label, lx, ly);
  g.restore();

  drawStarsRow(g, R.stars, 46 + lw + 22, 814, 38, tier);

  // element badge
  const bx = CARD_W - 96, by = 818;
  g.save();
  const eg = g.createLinearGradient(bx - 40, by - 40, bx + 40, by + 40);
  eg.addColorStop(0, E.c2);
  eg.addColorStop(1, E.c1);
  g.shadowColor = rgba(E.c1, 0.8);
  g.shadowBlur = 16;
  g.beginPath();
  g.arc(bx, by, 38, 0, Math.PI * 2);
  g.fillStyle = eg;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.stroke();
  g.font = `900 40px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 6;
  g.fillText(E.kanji, bx, by + 2);
  g.restore();

  // title + name
  g.save();
  g.textBaseline = 'alphabetic';
  g.font = `700 30px ${SERIF}`;
  if ('letterSpacing' in g) g.letterSpacing = '6px';
  g.fillStyle = rgba(accent, 0.95);
  g.fillText(`【${sp.title}】`, 34, 916);
  if ('letterSpacing' in g) g.letterSpacing = '4px';
  fitFont(g, sp.name, 900, 72, SERIF, CARD_W - 110);
  g.shadowColor = rgba(tier === 0 ? E.glow : '#ffcf6a', 0.75);
  g.shadowBlur = 18;
  g.fillStyle = '#ffffff';
  g.fillText(sp.name, 48, 990);
  g.shadowBlur = 0;
  g.font = `500 21px ${SANS}`;
  if ('letterSpacing' in g) g.letterSpacing = '3px';
  g.fillStyle = 'rgba(230,236,255,0.72)';
  g.fillText(`${sp.cons}  ·  ${sp.consEn}`, 60, 1026);
  g.restore();
}

const faceCache = new Map();

export function cardFace(sp) {
  if (faceCache.has(sp.id)) return faceCache.get(sp.id);
  const c = makeCanvas(CARD_W, CARD_H);
  const g = c.getContext('2d');
  const rng = mulberry32(hashString(sp.id));
  const E = ELEMENTS[sp.element];
  const tier = RARITY[sp.rarity].tier;
  const pts = fitStars(sp);

  g.save();
  g.beginPath();
  rrPath(g, 0, 0, CARD_W, CARD_H, 36);
  g.clip();
  const bg = g.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, E.bgTop);
  bg.addColorStop(0.55, E.bgMid);
  bg.addColorStop(1, E.bgBot);
  g.fillStyle = bg;
  g.fillRect(0, 0, CARD_W, CARD_H);
  const a = pts[sp.alpha ?? 0];
  g.save();
  g.globalCompositeOperation = 'lighter';
  glowDot(g, a.x, a.y, 560, E.glow, 0.28);
  g.restore();
  drawNebula(g, E, rng, tier);
  drawStarfield(g, E, rng);
  drawAstrolabe(g, E, tier, rng);
  drawKanji(g, sp, E);
  drawRibbons(g, E, tier, rng);
  drawConstellation(g, sp, pts, E, tier);
  if (tier === 2) {
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.22;
    g.fillStyle = rainbowConic(g, CARD_W * 0.8, 120, 0);
    g.fillRect(0, 0, CARD_W, CARD_H);
    g.restore();
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      sparkle(g, rng() * CARD_W, 60 + rng() * 700, 10 + rng() * 22, ['#fff1b0', '#ffc0f0', '#b0f4ff'][i % 3], 0.9, 0.1);
    }
    g.restore();
  } else if (tier === 1) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) sparkle(g, rng() * CARD_W, 60 + rng() * 700, 8 + rng() * 16, '#ffe39a', 0.8, 0.1);
    g.restore();
  }
  const vg = g.createRadialGradient(CARD_W / 2, 420, 260, CARD_W / 2, 480, 760);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,8,0.55)');
  g.fillStyle = vg;
  g.fillRect(0, 0, CARD_W, CARD_H);
  drawInfo(g, sp);
  g.restore();
  drawFrame(g, tier);

  faceCache.set(sp.id, c);
  return c;
}

let backCanvas = null;

export function cardBack() {
  if (backCanvas) return backCanvas;
  const c = makeCanvas(CARD_W, CARD_H);
  const g = c.getContext('2d');
  const rng = mulberry32(99);
  g.save();
  g.beginPath();
  rrPath(g, 0, 0, CARD_W, CARD_H, 36);
  g.clip();
  const bg = g.createRadialGradient(CARD_W / 2, CARD_H / 2, 40, CARD_W / 2, CARD_H / 2, 700);
  bg.addColorStop(0, '#26296a');
  bg.addColorStop(0.5, '#121440');
  bg.addColorStop(1, '#05061a');
  g.fillStyle = bg;
  g.fillRect(0, 0, CARD_W, CARD_H);
  // lattice of tiny stars
  for (let y = 40; y < CARD_H; y += 44) {
    for (let x = 30 + ((y / 44) % 2) * 22; x < CARD_W; x += 44) {
      g.fillStyle = `rgba(255,226,160,${0.08 + rng() * 0.12})`;
      starShape(g, x, y, 3.2, 1.2, 4, 0);
      g.fill();
    }
  }
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.5})`;
    g.beginPath();
    g.arc(rng() * CARD_W, rng() * CARD_H, 0.5 + rng() * 1.2, 0, Math.PI * 2);
    g.fill();
  }
  const cx = CARD_W / 2, cy = CARD_H / 2;
  const gold = metalGradient(g, 1, cx - 240, cy - 240, cx + 240, cy + 240);
  g.save();
  g.globalCompositeOperation = 'lighter';
  glowDot(g, cx, cy, 380, '#6a7bff', 0.45);
  g.restore();
  g.strokeStyle = gold;
  g.fillStyle = gold;
  g.lineWidth = 3;
  for (const r of [236, 222]) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.lineWidth = 1.5;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const l = i % 6 === 0 ? 16 : 7;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (222 - l), cy + Math.sin(a) * (222 - l));
    g.lineTo(cx + Math.cos(a) * 222, cy + Math.sin(a) * 222);
    g.stroke();
  }
  g.beginPath();
  g.arc(cx, cy, 150, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150);
    g.lineTo(cx + Math.cos(a) * (i % 2 ? 190 : 214), cy + Math.sin(a) * (i % 2 ? 190 : 214));
    g.stroke();
  }
  g.lineWidth = 3;
  starShape(g, cx, cy, 200, 70, 8, -Math.PI / 2);
  g.stroke();
  starShape(g, cx, cy, 128, 52, 4, -Math.PI / 2);
  const sg = g.createLinearGradient(cx, cy - 128, cx, cy + 128);
  sg.addColorStop(0, '#fff6cf');
  sg.addColorStop(0.5, '#e7b04a');
  sg.addColorStop(1, '#8c5a14');
  g.fillStyle = sg;
  g.fill();
  g.stroke();
  // crescent
  g.save();
  g.beginPath();
  g.arc(cx, cy, 46, 0, Math.PI * 2);
  g.fillStyle = '#10123a';
  g.fill();
  g.beginPath();
  g.arc(cx, cy, 36, 0, Math.PI * 2);
  g.arc(cx + 14, cy - 8, 32, 0, Math.PI * 2, true);
  g.fillStyle = gold;
  g.fill('evenodd');
  g.restore();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    sparkle(g, cx + Math.cos(a) * 270, cy + Math.sin(a) * 270, 26, '#ffe6a0', 0.9, 0.12);
  }
  g.font = `600 30px ${LATIN}`;
  g.textAlign = 'center';
  if ('letterSpacing' in g) g.letterSpacing = '10px';
  g.fillStyle = gold;
  g.fillText('ASTRAL SUMMON', cx + 5, 150);
  g.font = `700 30px ${SERIF}`;
  g.fillText('星詠みの召喚', cx + 5, CARD_H - 128);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.restore();

  // frame
  g.save();
  g.beginPath();
  rrPath(g, 0, 0, CARD_W, CARD_H, 36);
  rrPath(g, 18, 18, CARD_W - 36, CARD_H - 36, 24);
  g.fillStyle = metalGradient(g, 1, 0, 0, CARD_W, CARD_H);
  g.fill('evenodd');
  g.strokeStyle = gold;
  g.lineWidth = 2;
  g.beginPath();
  rrPath(g, 34, 34, CARD_W - 68, CARD_H - 68, 16);
  g.stroke();
  g.beginPath();
  rrPath(g, 44, 44, CARD_W - 88, CARD_H - 88, 12);
  g.stroke();
  g.restore();
  backCanvas = c;
  return c;
}

export function thumb(src, w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, w, h);
  return c;
}

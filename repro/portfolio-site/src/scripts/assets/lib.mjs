// Shared helpers for build-time artwork: fonts rendered to SVG paths (so output never depends on
// system fonts) and a sharp pipeline that writes every responsive width next/image asks for.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const nm = (p) => path.resolve('node_modules', p);

function loadFont(file) {
  const buf = fs.readFileSync(nm(file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

export const fonts = {
  serif: loadFont('@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff'),
  serifItalic: loadFont('@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff'),
  sans: loadFont('@fontsource/geist/files/geist-latin-400-normal.woff'),
  sansMedium: loadFont('@fontsource/geist/files/geist-latin-500-normal.woff'),
  sansSemi: loadFont('@fontsource/geist/files/geist-latin-600-normal.woff'),
  mono: loadFont('@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff'),
};

export function measure(font, str, size, tracking = 0) {
  return font.getAdvanceWidth(str, size, { kerning: true, letterSpacing: tracking });
}

export function text(font, str, x, y, size, opts = {}) {
  const { anchor = 'start', fill = '#000', tracking = 0, opacity, transform } = opts;
  const w = measure(font, str, size, tracking);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const d = font.getPath(str, x0, y, size, { kerning: true, letterSpacing: tracking }).toPathData(1);
  const extra = (opacity != null ? ` opacity="${opacity}"` : '') + (transform ? ` transform="${transform}"` : '');
  return `<path d="${d}" fill="${fill}"${extra}/>`;
}

export function wrap(font, str, size, maxWidth) {
  const words = str.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measure(font, next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;

export const linear = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</linearGradient>`;

export const radial = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</radialGradient>`;

export const blur = (id, sd) =>
  `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;

export const shadow = (id, dy = 24, sd = 30, opacity = 0.25, color = '#000') =>
  `<filter id="${id}" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${sd}" flood-color="${color}" flood-opacity="${opacity}"/></filter>`;

// Deterministic PRNG so every build produces identical artwork.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function smoothPath(points, closed = false) {
  if (points.length < 2) return '';
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  const pts = closed ? [points[points.length - 1], ...points, points[0], points[1]] : [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return closed ? d + 'Z' : d;
}

export const WIDTHS = [256, 480, 800, 1200, 1600];

export async function writeResponsive(svgString, outBase, { widths = WIDTHS, quality = 80 } = {}) {
  const master = await sharp(Buffer.from(svgString)).png().toBuffer();
  const ext = path.extname(outBase);
  const stem = outBase.slice(0, -ext.length);
  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  let total = 0;
  for (const w of widths) {
    const file = `${stem}-${w}${ext}`;
    await sharp(master).resize({ width: w }).webp({ quality, effort: 5 }).toFile(file);
    total += fs.statSync(file).size;
  }
  return total;
}

export async function writeImage(svgString, file, { width, format = 'jpeg', quality = 84 } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let img = sharp(Buffer.from(svgString));
  if (width) img = img.resize({ width });
  if (format === 'jpeg') img = img.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true });
  else if (format === 'png') img = img.png({ compressionLevel: 9 });
  else if (format === 'webp') img = img.webp({ quality });
  await img.toFile(file);
  return fs.statSync(file).size;
}

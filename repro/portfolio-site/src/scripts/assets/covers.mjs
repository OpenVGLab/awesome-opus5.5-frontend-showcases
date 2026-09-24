// Blog cover art, Open Graph cards and the favicon set.
import { fonts, text, wrap, svg, linear, radial, blur, rng, smoothPath } from './lib.mjs';

const f = fonts;
export const COVER_W = 1600;
export const COVER_H = 840;

function webgl() {
  const W = COVER_W, H = COVER_H;
  const r = rng(4);
  const defs =
    linear('warm', [[0, '#FFB38A'], [1, '#FF4D2E']], 0, 0, 1, 1) +
    linear('cool', [[0, '#5B6CFF'], [1, '#1A1E6B']], 0, 0, 1, 1) +
    blur('b', 40);
  const edge = [];
  for (let y = -20; y <= H + 20; y += 20) edge.push([780 + Math.sin(y * 0.021) * 60 + Math.sin(y * 0.063) * 28 + (r() - 0.5) * 30, y]);
  const right = `${smoothPath(edge)} L${W} ${H + 20} L${W} -20 Z`;
  const streaks = Array.from({ length: 46 }, () => {
    const y = r() * H, w = 60 + r() * 260, x = 620 + r() * 260;
    return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${(2 + r() * 10).toFixed(0)}" fill="${r() > 0.5 ? '#FFB38A' : '#8C97FF'}" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`;
  }).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="url(#warm)"/>
    <circle cx="360" cy="330" r="210" fill="#FFE1CC" opacity="0.5"/>
    <circle cx="520" cy="620" r="120" fill="#FF7A59" opacity="0.8"/>
    <path d="${right}" fill="url(#cool)"/>
    <circle cx="1220" cy="400" r="240" fill="#8C97FF" opacity="0.45" filter="url(#b)"/>
    <rect x="1080" y="250" width="280" height="340" rx="30" fill="#fff" opacity="0.12"/>
    ${streaks}
    <path d="${smoothPath(edge)}" fill="none" stroke="#fff" stroke-width="3" opacity="0.7"/>
  `;
  return svg(W, H, body, defs);
}

function vitals() {
  const W = COVER_W, H = COVER_H;
  const gauge = (cx, label, value, frac, color) => {
    const R = 170, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
    const arc = (t) => {
      const a = a0 + (a1 - a0) * t;
      return [cx + Math.cos(a) * R, 440 + Math.sin(a) * R];
    };
    const [sx, sy] = arc(0), [ex, ey] = arc(1), [vx, vy] = arc(frac);
    const large = (t) => ((a1 - a0) * t > Math.PI ? 1 : 0);
    return `
      <path d="M${sx} ${sy} A${R} ${R} 0 ${large(1)} 1 ${ex} ${ey}" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="26" stroke-linecap="round"/>
      <path d="M${sx} ${sy} A${R} ${R} 0 ${large(frac)} 1 ${vx} ${vy}" fill="none" stroke="${color}" stroke-width="26" stroke-linecap="round"/>
      ${text(f.sansSemi, value, cx, 462, 68, { fill: '#fff', anchor: 'middle' })}
      ${text(f.mono, label, cx, 690, 34, { fill: '#9AA0AE', anchor: 'middle', tracking: 0.25 })}`;
  };
  const body = `
    <rect width="${W}" height="${H}" fill="#0E1015"/>
    <circle cx="800" cy="440" r="520" fill="#22C55E" opacity="0.06"/>
    ${gauge(360, 'LCP', '1.6 s', 0.78, '#22C55E')}
    ${gauge(800, 'INP', '90 ms', 0.86, '#4ADE80')}
    ${gauge(1240, 'CLS', '0.02', 0.93, '#A3E635')}
  `;
  return svg(W, H, body);
}

function motion() {
  const W = COVER_W, H = COVER_H;
  const x0 = 260, y0 = 700, x1 = 1340, y1 = 160;
  const grid = Array.from({ length: 13 }, (_, i) => `<line x1="${x0 + i * 90}" x2="${x0 + i * 90}" y1="${y1 - 40}" y2="${y0 + 40}" stroke="#161616" stroke-opacity="0.07" stroke-width="2"/>`).join('') +
    Array.from({ length: 8 }, (_, i) => `<line x1="${x0 - 40}" x2="${x1 + 40}" y1="${y1 + i * 77}" y2="${y1 + i * 77}" stroke="#161616" stroke-opacity="0.07" stroke-width="2"/>`).join('');
  const curve = (fn, color, n = 60) => {
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [x0 + t * (x1 - x0), y0 - fn(t) * (y0 - y1)];
    });
    return { d: smoothPath(pts), pts };
  };
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const spring = (t) => 1 - Math.exp(-6 * t) * Math.cos(10 * t);
  const lin = curve((t) => t, '#161616');
  const eo = curve(easeOut, '#FF4D2E');
  const sp = curve(spring, '#3D5AFE');
  const dots = (c, color) => [0.2, 0.4, 0.6, 0.8].map((t, i) => {
    const p = c.pts[Math.round(t * 60)];
    return `<circle cx="${p[0]}" cy="${p[1]}" r="${10 + i * 3}" fill="${color}" opacity="${0.3 + i * 0.2}"/>`;
  }).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="#F4EFE6"/>
    ${grid}
    <path d="${lin.d}" fill="none" stroke="#161616" stroke-width="6" stroke-dasharray="2 16" stroke-linecap="round"/>
    <path d="${eo.d}" fill="none" stroke="#FF4D2E" stroke-width="10" stroke-linecap="round"/>
    <path d="${sp.d}" fill="none" stroke="#3D5AFE" stroke-width="10" stroke-linecap="round"/>
    ${dots(eo, '#FF4D2E')}${dots(sp, '#3D5AFE')}
    <circle cx="${x0}" cy="${y0}" r="14" fill="#161616"/>
    <circle cx="${x1}" cy="${y1}" r="14" fill="#161616"/>
  `;
  return svg(W, H, body);
}

function planets() {
  const W = COVER_W, H = COVER_H;
  const r = rng(8);
  const defs =
    radial('sun', [[0, '#FFE8A3'], [0.35, '#FFD166'], [1, '#FFD166', 0]]) +
    radial('orange', [[0, '#FFB38A'], [1, '#E8541F']], 0.35, 0.3, 0.8) +
    radial('indigo', [[0, '#A5B4FC'], [1, '#3730A3']], 0.35, 0.3, 0.8);
  const stars = Array.from({ length: 150 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(0.6 + r() * 1.8).toFixed(1)}" fill="#fff" opacity="${(0.2 + r() * 0.6).toFixed(2)}"/>`).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="#0B0C1A"/>
    ${stars}
    <ellipse cx="800" cy="430" rx="620" ry="210" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="3"/>
    <ellipse cx="800" cy="430" rx="400" ry="130" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="3"/>
    <circle cx="800" cy="430" r="220" fill="url(#sun)"/>
    <circle cx="800" cy="430" r="64" fill="#FFE8A3"/>
    <circle cx="258" cy="520" r="120" fill="url(#orange)"/>
    <ellipse cx="258" cy="520" rx="190" ry="36" fill="none" stroke="#FFD2BD" stroke-width="8" opacity="0.7" transform="rotate(-12 258 520)"/>
    <circle cx="1180" cy="330" r="90" fill="url(#indigo)"/>
    <circle cx="1270" cy="250" r="18" fill="#C7D2FE"/>
  `;
  return svg(W, H, body, defs);
}

function audio() {
  const W = COVER_W, H = COVER_H;
  const defs = linear('bg', [[0, '#1C0F31'], [1, '#3C1D60']], 0, 0, 1, 1);
  const wave = (amp, freq, phase, y, color, op) => {
    const pts = Array.from({ length: 41 }, (_, i) => [i * 40, y + Math.sin(i * freq + phase) * amp]);
    return `<path d="${smoothPath(pts)} L${W} ${H} L0 ${H} Z" fill="${color}" opacity="${op}"/>`;
  };
  const bars = Array.from({ length: 24 }, (_, i) => {
    const h = 30 + Math.abs(Math.sin(i * 0.7) * 120) + (i % 3) * 20;
    return `<rect x="${260 + i * 46}" y="${250 - h / 2}" width="22" height="${h}" rx="11" fill="#fff" opacity="${0.25 + (i % 4) * 0.12}"/>`;
  }).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${bars}
    ${wave(70, 0.32, 0, 470, '#A78BFA', 0.55)}
    ${wave(90, 0.24, 1.4, 540, '#F472B6', 0.5)}
    ${wave(60, 0.4, 2.2, 620, '#FF8A7A', 0.6)}
  `;
  return svg(W, H, body, defs);
}

function jsonld() {
  const W = COVER_W, H = COVER_H;
  const r = rng(12);
  const nodes = [[520, 230], [760, 160], [980, 260], [1120, 460], [900, 560], [640, 520], [800, 380], [1240, 250], [460, 430]];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 2], [6, 4], [2, 7], [5, 8], [6, 3]];
  const labels = ['@type', 'Person', 'FAQPage', 'Event', 'Product', 'Review', '@graph', 'sameAs', '@id'];
  const body = `
    <rect width="${W}" height="${H}" fill="#0A1628"/>
    ${Array.from({ length: 80 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="1.5" fill="#5EEAD4" opacity="${(0.1 + r() * 0.3).toFixed(2)}"/>`).join('')}
    ${text(f.mono, '{', 120, 640, 520, { fill: '#FF6B4A', opacity: 0.9 })}
    ${text(f.mono, '}', 1480, 640, 520, { fill: '#FF6B4A', opacity: 0.9, anchor: 'end' })}
    ${edges.map(([a, b]) => `<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}" stroke="#5EEAD4" stroke-opacity="0.35" stroke-width="3"/>`).join('')}
    ${nodes.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 6 ? 26 : 16}" fill="${i === 6 ? '#FF6B4A' : '#5EEAD4'}"/>${text(f.mono, labels[i], x, y - 32, 26, { fill: '#CFFAFE', anchor: 'middle' })}`).join('')}
  `;
  return svg(W, H, body);
}

function cursors() {
  const W = COVER_W, H = COVER_H;
  const r = rng(15);
  const path = Array.from({ length: 40 }, (_, i) => {
    const t = i / 39;
    return [220 + t * 900, 620 - Math.sin(t * Math.PI * 1.3) * 300 - t * 60];
  });
  const trail = path.map(([x, y], i) => {
    const s = 3 + (i / 40) * 14;
    return `<circle cx="${(x + (r() - 0.5) * 30).toFixed(0)}" cy="${(y + (r() - 0.5) * 30).toFixed(0)}" r="${s.toFixed(1)}" fill="${['#FFFFFF', '#FFD6CC', '#161616'][i % 3]}" opacity="${(0.15 + (i / 40) * 0.7).toFixed(2)}"/>`;
  }).join('');
  const [hx, hy] = path[path.length - 1];
  const body = `
    <rect width="${W}" height="${H}" fill="#FF6B4A"/>
    <circle cx="1300" cy="180" r="240" fill="#FF8E73"/>
    ${trail}
    <circle cx="${hx}" cy="${hy}" r="96" fill="none" stroke="#161616" stroke-width="6"/>
    <circle cx="${hx}" cy="${hy}" r="20" fill="#161616"/>
    <path d="M1320 520 L1320 700 L1362 660 L1392 730 L1420 718 L1390 648 L1446 648 Z" fill="#fff" stroke="#161616" stroke-width="8" stroke-linejoin="round"/>
  `;
  return svg(W, H, body);
}

export const coverArt = {
  'webgl-page-transitions-with-threejs': webgl,
  'core-web-vitals-for-creative-websites': vitals,
  'designing-a-motion-system': motion,
  'astro-or-nextjs-for-content-sites': planets,
  'generative-music-with-the-web-audio-api': audio,
  'json-ld-structured-data-recipes': jsonld,
  'accessible-custom-cursors': cursors,
};

// Transparent overlay composited over a cover to make a 1200×630 social card.
export function ogOverlay(title, tags) {
  const W = 1200, H = 630;
  const defs = linear('shade', [[0, '#0B0B10', 0.92], [0.62, '#0B0B10', 0.72], [1, '#0B0B10', 0.05]], 0, 0, 1, 0);
  const lines = wrap(f.serif, title, 66, 720).slice(0, 4);
  const top = 360 - (lines.length - 1) * 34;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
    <circle cx="86" cy="86" r="26" fill="#FF4D2E"/>
    ${text(f.serifItalic, 'M', 86, 97, 34, { fill: '#fff', anchor: 'middle' })}
    ${text(f.sansMedium, 'Mara Ellison · Blog', 128, 96, 26, { fill: '#fff' })}
    ${lines.map((l, i) => text(f.serif, l, 70, top + i * 70, 66, { fill: '#fff' })).join('')}
    ${text(f.mono, tags.map((t) => `#${t}`).join('  '), 72, 560, 24, { fill: '#FFB199' })}
    ${text(f.mono, 'maraellison.dev', 1130, 560, 24, { fill: '#C9C9D1', anchor: 'end' })}
  `;
  return svg(W, H, body, defs);
}

export function homeOg(portraitSvg) {
  const W = 1200, H = 630;
  const inner = portraitSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const defs = `<clipPath id="og-clip"><rect x="740" y="70" width="380" height="490" rx="40"/></clipPath>`;
  const body = `
    <rect width="${W}" height="${H}" fill="#F4F1EA"/>
    <circle cx="930" cy="315" r="300" fill="#FF4D2E" opacity="0.12"/>
    <g clip-path="url(#og-clip)"><svg x="740" y="70" width="380" height="490" viewBox="160 250 1280 1650" preserveAspectRatio="xMidYMid slice">${inner}</svg></g>
    <rect x="740" y="70" width="380" height="490" rx="40" fill="none" stroke="#141414" stroke-opacity="0.1" stroke-width="2"/>
    <circle cx="96" cy="100" r="28" fill="#FF4D2E"/>
    ${text(f.serifItalic, 'M', 96, 112, 38, { fill: '#fff', anchor: 'middle' })}
    ${text(f.mono, 'PORTFOLIO · LISBON', 140, 110, 22, { fill: '#6B6862', tracking: 0.2 })}
    ${text(f.serif, 'Mara Ellison', 80, 290, 104, { fill: '#141414' })}
    ${text(f.serifItalic, 'Creative frontend', 82, 380, 58, { fill: '#FF4D2E' })}
    ${text(f.serif, 'developer & WebGL engineer', 82, 446, 58, { fill: '#141414' })}
    ${text(f.mono, 'maraellison.dev', 84, 548, 26, { fill: '#6B6862' })}
  `;
  return svg(W, H, body, defs);
}

export function icon(size = 512, { maskable = false } = {}) {
  const pad = maskable ? size * 0.18 : 0;
  const s = size - pad * 2;
  const bg = maskable ? `<rect width="${size}" height="${size}" fill="#141414"/>` : '';
  const g = (v) => (v / 512) * s + pad;
  return svg(
    size,
    size,
    `${bg}<circle cx="${size / 2}" cy="${size / 2}" r="${s / 2}" fill="#FF4D2E"/>
     ${text(fonts.serifItalic, 'M', size / 2 - s * 0.01, g(352), s * 0.62, { fill: '#FFFFFF', anchor: 'middle' })}
     <circle cx="${g(372)}" cy="${g(340)}" r="${s * 0.035}" fill="#141414"/>`,
  );
}

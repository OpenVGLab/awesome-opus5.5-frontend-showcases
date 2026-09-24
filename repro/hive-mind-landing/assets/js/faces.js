// Procedural hexagon faces. Every member is drawn from a seed (usually a hash of their name),
// so the same person looks the same in the hero hive, in toasts, answers and testimonials.

const INK = '#22180C';
const SCLERA = '#FFFBF2';
const CHEEK = '#EF6F55';
const HAIR = ['#2A1C12', '#5B3521', '#8E3B1C', '#262240', '#C9452F', '#6B4BB8', '#2F6B4F'];
const ACCENT = ['#E4572E', '#3552EA', '#D6336C', '#1E8A6E', '#7A4FD0', '#FFF6E2'];

export const YOU_FILL = '#2F4BE8';
export const SQ3 = Math.sqrt(3);

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexCorners(s) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push([s * Math.cos(a), s * Math.sin(a)]);
  }
  return pts;
}

// Pointy-top hexagon with softened corners, centred on 0,0; s is the circumradius.
export function hexPath(s, round = 0.2) {
  const p = hexCorners(s);
  const f = (v) => v.toFixed(2);
  let d = '';
  for (let i = 0; i < 6; i++) {
    const [px, py] = p[(i + 5) % 6];
    const [cx, cy] = p[i];
    const [nx, ny] = p[(i + 1) % 6];
    const ax = cx + (px - cx) * round, ay = cy + (py - cy) * round;
    const bx = cx + (nx - cx) * round, by = cy + (ny - cy) * round;
    d += `${i ? 'L' : 'M'}${f(ax)} ${f(ay)}Q${f(cx)} ${f(cy)} ${f(bx)} ${f(by)}`;
  }
  return d + 'Z';
}

function weighted(r, table) {
  let total = 0;
  for (const k in table) total += table[k];
  let t = r() * total;
  for (const k in table) {
    t -= table[k];
    if (t <= 0) return k;
  }
  return Object.keys(table)[0];
}

export function traits(seed) {
  const r = rng(seed);
  const h = 33 + r() * 14, sat = 78 + r() * 14, l = 58 + r() * 19;
  return {
    fill: `hsl(${h.toFixed(1)} ${sat.toFixed(1)}% ${l.toFixed(1)}%)`,
    shade: `hsl(${(h - 5).toFixed(1)} ${sat.toFixed(1)}% ${(l - 16).toFixed(1)}%)`,
    eyes: weighted(r, { round: 6, dot: 3, happy: 1.1, sleepy: 1.3 }),
    brows: weighted(r, { none: 5, flat: 1.5, arch: 2, worried: 1 }),
    mouth: weighted(r, { smile: 5, grin: 2, o: 0.9, flat: 1.1, smirk: 1.6, tongue: 0.7 }),
    cheeks: r() < 0.38,
    freckles: r() < 0.16,
    glasses: weighted(r, { none: 7, round: 1.5, square: 1.1 }),
    mustache: r() < 0.08,
    top: weighted(r, { none: 5, tuft: 2, beanie: 1, bow: 0.9, bangs: 1.4, sprout: 0.7 }),
    hair: HAIR[(r() * HAIR.length) | 0],
    accent: ACCENT[(r() * ACCENT.length) | 0],
    blink: 3.2 + r() * 5,
    blinkDelay: -r() * 8,
    you: false,
  };
}

const CLASSIC_YOU = {
  fill: YOU_FILL, shade: '#1E33B8', eyes: 'round', brows: 'arch', mouth: 'smile', cheeks: true, freckles: false,
  glasses: 'none', mustache: false, top: 'tuft', hair: '#FFF1D2', accent: '#FFF6E2', blink: 4.6, blinkDelay: -1.2, you: true,
};

// The visitor's own cell: always cobalt. With a seed (their name) they get their own features.
export function youTraits(seed) {
  if (seed == null) return { ...CLASSIC_YOU };
  const t = traits(seed);
  t.fill = YOU_FILL;
  t.shade = '#1E33B8';
  t.you = true;
  if (t.accent === '#3552EA') t.accent = '#FFF6E2';
  if (t.eyes === 'happy') t.eyes = 'round';
  return t;
}

export function faceMarkup(t, s, clipId) {
  const k = (v) => (v * s).toFixed(2);
  const line = t.you ? '#FFF4DA' : INK;
  const sw = k(0.062);
  const ex = 0.27, ey = -0.05;
  const er = 0.155, pr = 0.078;
  let o = '';

  if (t.top === 'beanie') {
    o += `<g clip-path="url(#${clipId})"><rect x="${k(-1)}" y="${k(-1.1)}" width="${k(2)}" height="${k(0.62)}" fill="${t.accent}"/><rect x="${k(-1)}" y="${k(-0.57)}" width="${k(2)}" height="${k(0.11)}" fill="${INK}" opacity=".2"/></g><circle cx="0" cy="${k(-0.86)}" r="${k(0.085)}" fill="${SCLERA}" stroke="${INK}" stroke-width="${k(0.035)}"/>`;
  } else if (t.top === 'bangs') {
    o += `<path clip-path="url(#${clipId})" fill="${t.hair}" d="M${k(-1)} ${k(-1.1)}H${k(1)}V${k(-0.5)}L${k(0.64)} ${k(-0.36)} ${k(0.4)} ${k(-0.49)} ${k(0.15)} ${k(-0.35)} ${k(-0.1)} ${k(-0.5)} ${k(-0.36)} ${k(-0.37)} ${k(-0.62)} ${k(-0.5)} ${k(-1)} ${k(-0.4)}Z"/>`;
  } else if (t.top === 'tuft') {
    o += `<path d="M0 ${k(-0.55)}C${k(-0.05)} ${k(-0.68)} ${k(0.07)} ${k(-0.72)} ${k(0.01)} ${k(-0.85)}M${k(-0.1)} ${k(-0.56)}C${k(-0.15)} ${k(-0.64)} ${k(-0.12)} ${k(-0.7)} ${k(-0.18)} ${k(-0.76)}" fill="none" stroke="${t.hair}" stroke-width="${k(0.07)}" stroke-linecap="round"/>`;
  } else if (t.top === 'sprout') {
    o += `<path d="M0 ${k(-0.56)}V${k(-0.79)}" stroke="#3E7D3A" stroke-width="${k(0.05)}" stroke-linecap="round"/><path d="M0 ${k(-0.75)}Q${k(-0.17)} ${k(-0.89)} ${k(-0.23)} ${k(-0.73)}Q${k(-0.1)} ${k(-0.68)} 0 ${k(-0.75)}ZM0 ${k(-0.79)}Q${k(0.14)} ${k(-0.92)} ${k(0.2)} ${k(-0.79)}Q${k(0.09)} ${k(-0.73)} 0 ${k(-0.79)}Z" fill="#5AA350"/>`;
  } else if (t.top === 'bow') {
    const bx = 0.34, by = -0.6;
    const bowFill = t.accent === '#FFF6E2' ? '#E4572E' : t.accent;
    o += `<path d="M${k(bx)} ${k(by)}L${k(bx - 0.15)} ${k(by - 0.1)}V${k(by + 0.1)}ZM${k(bx)} ${k(by)}L${k(bx + 0.15)} ${k(by - 0.1)}V${k(by + 0.1)}Z" fill="${bowFill}" stroke="${INK}" stroke-width="${k(0.03)}" stroke-linejoin="round"/><circle cx="${k(bx)}" cy="${k(by)}" r="${k(0.045)}" fill="${INK}"/>`;
  }

  if (t.cheeks) {
    const c = t.you ? '#FF9DB5' : CHEEK;
    o += `<circle cx="${k(-0.47)}" cy="${k(0.14)}" r="${k(0.09)}" fill="${c}" opacity=".45"/><circle cx="${k(0.47)}" cy="${k(0.14)}" r="${k(0.09)}" fill="${c}" opacity=".45"/>`;
  }
  if (t.freckles) {
    let f = '';
    for (const sx of [-1, 1]) {
      for (const [fx, fy] of [[0.42, 0.09], [0.5, 0.14], [0.44, 0.19]]) f += `<circle cx="${k(sx * fx)}" cy="${k(fy)}" r="${k(0.02)}"/>`;
    }
    o += `<g fill="${INK}" opacity=".45">${f}</g>`;
  }

  if (t.brows !== 'none') {
    const by = ey - 0.29;
    const brow = (sx) => {
      const x = sx * ex;
      if (t.brows === 'flat') return `M${k(x - 0.11)} ${k(by)}H${k(x + 0.11)}`;
      if (t.brows === 'arch') return `M${k(x - 0.12)} ${k(by + 0.03)}Q${k(x)} ${k(by - 0.07)} ${k(x + 0.12)} ${k(by + 0.03)}`;
      return `M${k(x + sx * 0.11)} ${k(by + 0.03)}L${k(x - sx * 0.11)} ${k(by - 0.05)}`;
    };
    o += `<path d="${brow(-1)}${brow(1)}" fill="none" stroke="${line}" stroke-width="${k(0.055)}" stroke-linecap="round"/>`;
  }

  const blinkStyle = `style="animation-duration:${t.blink.toFixed(2)}s;animation-delay:${t.blinkDelay.toFixed(2)}s"`;
  if (t.eyes === 'round' || t.eyes === 'sleepy') {
    o += `<g class="eyes" ${blinkStyle}>`;
    o += `<circle cx="${k(-ex)}" cy="${k(ey)}" r="${k(er)}" fill="${SCLERA}" stroke="${INK}" stroke-width="${k(0.045)}"/><circle cx="${k(ex)}" cy="${k(ey)}" r="${k(er)}" fill="${SCLERA}" stroke="${INK}" stroke-width="${k(0.045)}"/>`;
    o += `<g class="pp" data-m="${k(0.07)}"><circle cx="${k(-ex)}" cy="${k(ey)}" r="${k(pr)}" fill="${INK}"/><circle cx="${k(ex)}" cy="${k(ey)}" r="${k(pr)}" fill="${INK}"/><circle cx="${k(-ex + 0.03)}" cy="${k(ey - 0.03)}" r="${k(0.022)}" fill="#fff"/><circle cx="${k(ex + 0.03)}" cy="${k(ey - 0.03)}" r="${k(0.022)}" fill="#fff"/></g>`;
    if (t.eyes === 'sleepy') {
      const lid = (x) => `M${k(x - er - 0.012)} ${k(ey)}A${k(er + 0.012)} ${k(er + 0.012)} 0 0 1 ${k(x + er + 0.012)} ${k(ey)}Z`;
      o += `<path d="${lid(-ex)}${lid(ex)}" fill="${t.shade}" stroke="${INK}" stroke-width="${k(0.045)}" stroke-linejoin="round"/>`;
    }
    o += '</g>';
  } else if (t.eyes === 'dot') {
    o += `<g class="eyes" ${blinkStyle}><g class="pp" data-m="${k(0.055)}"><circle cx="${k(-ex)}" cy="${k(ey)}" r="${k(0.088)}" fill="${INK}"/><circle cx="${k(ex)}" cy="${k(ey)}" r="${k(0.088)}" fill="${INK}"/></g></g>`;
  } else {
    o += `<path d="M${k(-ex - 0.12)} ${k(ey + 0.04)}Q${k(-ex)} ${k(ey - 0.13)} ${k(-ex + 0.12)} ${k(ey + 0.04)}M${k(ex - 0.12)} ${k(ey + 0.04)}Q${k(ex)} ${k(ey - 0.13)} ${k(ex + 0.12)} ${k(ey + 0.04)}" fill="none" stroke="${line}" stroke-width="${k(0.065)}" stroke-linecap="round"/>`;
  }

  if (t.glasses === 'round') {
    o += `<g fill="#fff" fill-opacity=".16" stroke="${INK}" stroke-width="${k(0.045)}"><circle cx="${k(-ex)}" cy="${k(ey)}" r="${k(0.215)}"/><circle cx="${k(ex)}" cy="${k(ey)}" r="${k(0.215)}"/></g><path d="M${k(-0.055)} ${k(ey)}Q0 ${k(ey - 0.05)} ${k(0.055)} ${k(ey)}" fill="none" stroke="${INK}" stroke-width="${k(0.045)}"/>`;
  } else if (t.glasses === 'square') {
    o += `<g fill="#fff" fill-opacity=".16" stroke="${INK}" stroke-width="${k(0.045)}"><rect x="${k(-ex - 0.2)}" y="${k(ey - 0.165)}" width="${k(0.4)}" height="${k(0.33)}" rx="${k(0.07)}"/><rect x="${k(ex - 0.2)}" y="${k(ey - 0.165)}" width="${k(0.4)}" height="${k(0.33)}" rx="${k(0.07)}"/></g><path d="M${k(-0.07)} ${k(ey - 0.02)}H${k(0.07)}" stroke="${INK}" stroke-width="${k(0.045)}"/>`;
  }

  if (t.mustache) {
    o += `<path d="M0 ${k(0.13)}C${k(-0.07)} ${k(0.06)} ${k(-0.2)} ${k(0.09)} ${k(-0.23)} ${k(0.18)}C${k(-0.14)} ${k(0.17)} ${k(-0.06)} ${k(0.18)} 0 ${k(0.15)}C${k(0.06)} ${k(0.18)} ${k(0.14)} ${k(0.17)} ${k(0.23)} ${k(0.18)}C${k(0.2)} ${k(0.09)} ${k(0.07)} ${k(0.06)} 0 ${k(0.13)}Z" fill="${t.you ? '#FFF1D2' : t.hair}"/>`;
  }

  const smile = `<path d="M${k(-0.15)} ${k(0.22)}Q0 ${k(0.37)} ${k(0.15)} ${k(0.22)}" fill="none" stroke="${line}" stroke-width="${sw}" stroke-linecap="round"/>`;
  switch (t.mouth) {
    case 'grin':
      o += `<path d="M${k(-0.18)} ${k(0.2)}Q0 ${k(0.47)} ${k(0.18)} ${k(0.2)}Z" fill="${INK}" stroke="${INK}" stroke-width="${k(0.04)}" stroke-linejoin="round"/><path d="M${k(-0.08)} ${k(0.325)}Q0 ${k(0.26)} ${k(0.08)} ${k(0.325)}Q0 ${k(0.35)} ${k(-0.08)} ${k(0.325)}Z" fill="#E8577A"/>`;
      break;
    case 'o':
      o += `<ellipse cx="0" cy="${k(0.27)}" rx="${k(0.06)}" ry="${k(0.075)}" fill="${INK}"/>`;
      break;
    case 'flat':
      o += `<path d="M${k(-0.1)} ${k(0.27)}H${k(0.1)}" stroke="${line}" stroke-width="${sw}" stroke-linecap="round"/>`;
      break;
    case 'smirk':
      o += `<path d="M${k(-0.13)} ${k(0.27)}Q${k(0.03)} ${k(0.33)} ${k(0.16)} ${k(0.2)}" fill="none" stroke="${line}" stroke-width="${sw}" stroke-linecap="round"/>`;
      break;
    case 'tongue':
      o += `<path d="M${k(-0.06)} ${k(0.28)}Q0 ${k(0.42)} ${k(0.07)} ${k(0.28)}Z" fill="#E8577A" stroke="${INK}" stroke-width="${k(0.035)}"/>${smile}`;
      break;
    default:
      o += smile;
  }
  return o;
}

let uid = 0;

// A standalone hexagon avatar. `key` is a name (hashed) or a numeric seed.
export function avatarSVG(key, { you = false } = {}) {
  const seed = typeof key === 'number' ? key : hashString(String(key));
  const t = you ? youTraits(key == null ? null : seed) : traits(seed);
  const id = `qa${++uid}`;
  const s = 47;
  const d = hexPath(s, 0.2);
  return `<svg class="av" viewBox="-50 -50 100 100" aria-hidden="true"><defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${t.fill}"/>${faceMarkup(t, s, id)}</svg>`;
}

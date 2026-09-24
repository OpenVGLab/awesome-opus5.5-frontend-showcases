// parts.js - what each component is (default values, where its terminals are)
// and how it is drawn. Drawings are SVG strings in the component's own "local"
// coordinates: the component lies horizontally, its two terminals at x = -40 and x = +40.
import { PART_LEN, resistorBands, fmtR, trimNum, clamp } from './util.js';

export const WIRE_COLORS = {
  red: { fill: '#ef4444', dark: '#7f1d1d', name: 'Red' },
  blue: { fill: '#3b82f6', dark: '#1e3a8a', name: 'Blue' },
  yellow: { fill: '#facc15', dark: '#854d0e', name: 'Yellow' },
  green: { fill: '#22c55e', dark: '#14532d', name: 'Green' },
  white: { fill: '#e5e7eb', dark: '#6b7280', name: 'White' },
  black: { fill: '#4b5563', dark: '#0b0f17', name: 'Black' },
};
// New wires take the next colour from this list so neighbouring wires are easy to tell apart.
export const WIRE_CYCLE = ['red', 'blue', 'yellow', 'green', 'white'];

// half = half of the component's thickness (used for selection boxes and highlights).
export const PART_DEFS = {
  battery: { name: 'Battery', prefix: 'B', half: 14, defaults: { emf: 3, r: 0 }, blurb: 'Power source' },
  resistor: { name: 'Resistor', prefix: 'R', half: 11, defaults: { R: 10 }, blurb: 'Limits current' },
  wire: { name: 'Wire', prefix: 'W', half: 6, defaults: { color: 'red' }, blurb: 'Connects parts' },
  bulb: { name: 'Light bulb', prefix: 'L', half: 20, defaults: { ratedV: 3, ratedP: 0.9 }, blurb: 'Lights up' },
  switch: { name: 'Switch', prefix: 'S', half: 25, defaults: { closed: false }, blurb: 'Opens / closes' },
  ammeter: { name: 'Ammeter', prefix: 'A', half: 24, defaults: { range: 3 }, blurb: 'Reads current' },
  voltmeter: { name: 'Voltmeter', prefix: 'V', half: 24, defaults: { range: 15 }, blurb: 'Reads voltage' },
};
export const PALETTE_ORDER = ['battery', 'resistor', 'wire', 'bulb', 'switch', 'ammeter', 'voltmeter'];

// rot counts quarter turns clockwise: 0 = pointing right, 1 = down, 2 = left, 3 = up.
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const axisOf = (rot) => DIRS[((rot % 4) + 4) % 4];

// Creates a new component object (the id and label are filled in by state.js).
export function makePart(type, x = 0, y = 0, rot = 0, props = {}) {
  const p = { id: null, type, label: '', props: { ...PART_DEFS[type].defaults, ...props } };
  if (type === 'wire') Object.assign(p, { x1: x - 40, y1: y, x2: x + 40, y2: y });
  else Object.assign(p, { x, y, rot });
  return p;
}
export function makeWire(x1, y1, x2, y2, color = 'red') {
  return { id: null, type: 'wire', label: '', props: { color }, x1, y1, x2, y2 };
}

// The two terminals in world coordinates. Index 0 is the "minus" end of batteries and meters.
export function terminalsOf(p) {
  if (p.type === 'wire') return [{ x: p.x1, y: p.y1 }, { x: p.x2, y: p.y2 }];
  const [dx, dy] = axisOf(p.rot), h = PART_LEN / 2;
  return [{ x: p.x - dx * h, y: p.y - dy * h }, { x: p.x + dx * h, y: p.y + dy * h }];
}
export const centerOf = (p) => (p.type === 'wire'
  ? { x: (p.x1 + p.x2) / 2, y: (p.y1 + p.y2) / 2 } : { x: p.x, y: p.y });

// Axis-aligned box around a component in world coordinates.
export function bboxOf(p, pad = 0) {
  if (p.type === 'wire') {
    return { x: Math.min(p.x1, p.x2) - 6 - pad, y: Math.min(p.y1, p.y2) - 6 - pad,
      w: Math.abs(p.x2 - p.x1) + 12 + 2 * pad, h: Math.abs(p.y2 - p.y1) + 12 + 2 * pad };
  }
  const half = PART_DEFS[p.type].half, L = PART_LEN / 2 + 3;
  const horiz = p.rot % 2 === 0;
  const hw = horiz ? L : half, hh = horiz ? half : L;
  return { x: p.x - hw - pad, y: p.y - hh - pad, w: 2 * hw + 2 * pad, h: 2 * hh + 2 * pad };
}

// A bulb is treated as a resistor: R = U^2 / P from its rating (3 V, 0.9 W -> 10 ohm).
export const bulbResistance = (q) => (q.ratedV * q.ratedV) / q.ratedP;

// Short value text shown next to the component label, e.g. "6 V" or "10 ohm".
export function valueText(p) {
  const q = p.props;
  switch (p.type) {
    case 'battery': return trimNum(q.emf) + ' V';
    case 'resistor': return fmtR(q.R);
    case 'bulb': return trimNum(q.ratedV) + ' V \u00b7 ' + trimNum(q.ratedP) + ' W';
    case 'switch': return q.closed ? 'closed' : 'open';
    case 'ammeter': return '0\u2013' + trimNum(q.range) + ' A';
    case 'voltmeter': return '0\u2013' + trimNum(q.range) + ' V';
    default: return '';
  }
}

// Blend two #rrggbb colours (t = 0 gives a, t = 1 gives b).
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

const lead = (x1, x2) => `<line class="lead" x1="${x1}" y1="0" x2="${x2}" y2="0"/>`;
const leads = (inner) => lead(-40, -inner) + lead(inner, 40);
// + and - signs near the terminals; counter-rotated so the minus never turns into a "|".
const signs = (p, x, y) => {
  const r = -(p.rot & 3) * 90;
  return `<text class="pol pol-pos" transform="translate(${x} ${y}) rotate(${r})">+</text>`
    + `<text class="pol" transform="translate(${-x} ${y}) rotate(${r})">\u2212</text>`;
};

// ---------- Drawings (local coordinates) ----------
function drawBattery(p) {
  const rot = p.rot & 3;
  return `${leads(26)}
  <rect x="-28" y="-12" width="49" height="24" rx="5" fill="url(#gBattBody)" stroke="#04070d" stroke-width="1.2"/>
  <rect x="4" y="-12" width="12" height="24" fill="url(#gBattBand)"/>
  <rect x="-26" y="-10.5" width="45" height="6" rx="3" fill="#ffffff" opacity="0.12"/>
  <rect x="21" y="-5.5" width="5.5" height="11" rx="1.5" fill="url(#gMetal)" stroke="#4b5563" stroke-width="0.6"/>
  <text class="batt-v" transform="translate(-9 0) rotate(${-rot * 90})">${trimNum(p.props.emf, 1)}V</text>
  ${signs(p, 33, -11)}
  <rect class="hit" x="-30" y="-15" width="60" height="30"/>`;
}

function drawResistor(p) {
  const [b1, b2, b3, b4] = resistorBands(p.props.R);
  const band = (x, w, c) => `<rect x="${x}" y="-8" width="${w}" height="16" fill="${c}"/>`;
  return `${leads(21)}
  <rect x="-22" y="-8" width="44" height="16" rx="6.5" fill="url(#gResBody)" stroke="#5c4424" stroke-width="1"/>
  ${band(-15, 4, b1)}${band(-9, 4, b2)}${band(-3, 4, b3)}${band(10.5, 3.5, b4)}
  <rect x="-19" y="-6.5" width="38" height="4" rx="2" fill="#ffffff" opacity="0.3"/>
  <rect class="hit" x="-30" y="-13" width="60" height="26"/>`;
}

function drawBulb(p, vis) {
  const b = vis && vis.brightness ? clamp(vis.brightness, 0, 1.6) : 0;
  const lit = b > 0.02;
  const fil = lit ? mix('#ff7a2e', '#fff8dc', Math.min(1, b)) : '#8b93a1';
  return `${leads(18)}
  <circle r="19" fill="url(#gGlass)" stroke="#d6e4ff" stroke-opacity="0.6" stroke-width="1.4"/>
  ${lit ? `<circle r="17.5" fill="url(#gBulbLit)" opacity="${Math.min(1, 0.3 + b * 0.7).toFixed(2)}"/>` : ''}
  <path d="M-18 0 L-8 3 M18 0 L8 3" stroke="#aab2bf" stroke-width="1.3" fill="none"/>
  <path d="M-8 3 q1.33 -6 2.67 0 t2.67 0 t2.67 0 t2.67 0 t2.67 0 t2.67 0" stroke="${fil}"
    stroke-width="${lit ? 2.1 : 1.4}" fill="none" stroke-linecap="round"/>
  <path d="M-11 -11 a14 14 0 0 1 11 -6" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2" fill="none" stroke-linecap="round"/>
  <rect x="-22" y="-4" width="4" height="8" rx="1" fill="url(#gMetal)"/><rect x="18" y="-4" width="4" height="8" rx="1" fill="url(#gMetal)"/>
  <rect class="hit" x="-26" y="-21" width="52" height="42"/>`;
}

function drawSwitch(p) {
  const closed = !!p.props.closed;
  return `${leads(22)}
  <rect x="-31" y="-9" width="62" height="18" rx="5" fill="url(#gSwitchBase)" stroke="#07090d" stroke-width="1.2"/>
  <path d="M17 -5.5 h8 v11 h-8" fill="none" stroke="#c7ccd6" stroke-width="2"/>
  <circle cx="22" cy="0" r="3" fill="url(#gMetal)"/>
  <g transform="rotate(${closed ? 0 : -30} -22 0)">
    <line x1="-22" y1="0" x2="25" y2="0" stroke="#e5e7eb" stroke-width="3.6" stroke-linecap="round"/>
    <line x1="-20" y1="-1" x2="23" y2="-1" stroke="#ffffff" stroke-width="1" opacity="0.6"/>
    <rect x="5" y="-5.5" width="14" height="11" rx="4" fill="${closed ? '#22c55e' : '#ef4444'}" stroke="#000" stroke-opacity="0.35"/>
  </g>
  <circle cx="-22" cy="0" r="4.4" fill="url(#gMetal)" stroke="#39404d" stroke-width="0.8"/>
  <rect class="hit" x="-32" y="-27" width="64" height="40"/>`;
}

// Analog meter. The dial stays upright whatever way the meter is rotated.
function drawMeter(p, vis, letter) {
  const range = p.props.range;
  const reading = vis && typeof vis.reading === 'number' ? vis.reading : 0;
  const ang = (-58 + 116 * clamp(reading / range, -0.05, 1.06)) * Math.PI / 180;
  let ticks = '';
  for (let i = 0; i <= 10; i++) {
    const a = (-58 + 11.6 * i) * Math.PI / 180, r1 = i % 5 === 0 ? 11 : 13.2;
    ticks += `M${(Math.sin(a) * r1).toFixed(2)} ${(7 - Math.cos(a) * r1).toFixed(2)}L${(Math.sin(a) * 16).toFixed(2)} ${(7 - Math.cos(a) * 16).toFixed(2)}`;
  }
  const ring = letter === 'A' ? '#f59e0b' : '#38bdf8';
  return `${leads(21)}
  <circle r="22.5" fill="#0b1220" stroke="${ring}" stroke-width="3"/>
  <circle r="19" fill="url(#gDial)"/>
  <g transform="rotate(${-(p.rot & 3) * 90})">
    <path d="${ticks}" stroke="#334155" stroke-width="1" fill="none"/>
    <text class="meter-letter" x="0" y="16.5">${letter}</text>
    <line x1="0" y1="7" x2="${(Math.sin(ang) * 17).toFixed(2)}" y2="${(7 - Math.cos(ang) * 17).toFixed(2)}"
      stroke="#dc2626" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="0" cy="7" r="2.1" fill="#1f2937"/>
  </g>
  ${signs(p, 31, -11)}
  <rect class="hit" x="-26" y="-24" width="52" height="48"/>`;
}

// Inner SVG of a component group. vis = live values from the last test (brightness, reading).
export function partMarkup(p, vis) {
  switch (p.type) {
    case 'battery': return drawBattery(p);
    case 'resistor': return drawResistor(p);
    case 'bulb': return drawBulb(p, vis);
    case 'switch': return drawSwitch(p);
    case 'ammeter': return drawMeter(p, vis, 'A');
    case 'voltmeter': return drawMeter(p, vis, 'V');
    default: return '';
  }
}

// Wires are drawn in world coordinates: insulation, a shine line and bare copper tips.
export function wireMarkup(w) {
  const c = WIRE_COLORS[w.props.color] || WIRE_COLORS.red;
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, tip = Math.min(7, len / 4);
  const ax = w.x1 + ux * tip, ay = w.y1 + uy * tip, bx = w.x2 - ux * tip, by = w.y2 - uy * tip;
  const sx = uy * 1.3, sy = -ux * 1.3;   // shine line sits slightly to one side
  const L = (x1, y1, x2, y2, extra) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${extra}/>`;
  return L(w.x1, w.y1, w.x2, w.y2, 'class="wire-hit"')
    + L(w.x1, w.y1, w.x2, w.y2, 'stroke="#d9a15b" stroke-width="2.6" stroke-linecap="round"')
    + L(ax, ay, bx, by, `stroke="${c.dark}" stroke-width="7.2" stroke-linecap="round"`)
    + L(ax, ay, bx, by, `stroke="${c.fill}" stroke-width="4.8" stroke-linecap="round"`)
    + L(ax + sx, ay + sy, bx + sx, by + sy, 'stroke="#ffffff" stroke-opacity="0.45" stroke-width="1.1" stroke-linecap="round"');
}

// Small picture used on the palette cards.
export function iconMarkup(type) {
  if (type === 'wire') {
    return `<path d="M-34 10 C-14 10 -12 -12 8 -10 S 26 4 34 -6" fill="none" stroke="#7f1d1d" stroke-width="7.4" stroke-linecap="round"/>
      <path d="M-34 10 C-14 10 -12 -12 8 -10 S 26 4 34 -6" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
      <circle cx="-36" cy="10" r="3" fill="#d9a15b"/><circle cx="36" cy="-6" r="3" fill="#d9a15b"/>`;
  }
  return partMarkup(makePart(type), type === 'bulb' ? { brightness: 0.85 } : null);
}

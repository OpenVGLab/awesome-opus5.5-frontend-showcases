import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Planet, createStarfield, damp, TORUS_TUBE } from './world.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hsl = (h, s, l) => '#' + new THREE.Color()
  .setHSL(((h % 1) + 1) % 1, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l)), THREE.SRGBColorSpace)
  .getHexString();
const lighten = (hex, dl, ds = 0) => {
  const c = new THREE.Color(hex), o = {};
  c.getHSL(o, THREE.SRGBColorSpace);
  return hsl(o.h, o.s + ds, o.l + dl);
};

const SYL = {
  a: ['Ka', 'Ve', 'Or', 'Thi', 'Ae', 'Zu', 'Mor', 'Ily', 'Quo', 'Sa', 'Ne', 'Xan', 'Bri', 'Lu', 'Cae', 'Ish', 'Tal', 'Pyr', 'Eri', 'Os', 'Vey', 'Nym', 'Ul', 'Syr', 'Ard', 'Fen', 'Ro', 'Esh'],
  b: ['ra', 'li', 'the', 'do', 'ven', 'si', 'mu', 'ga', 'ri', 'lo', 'que', 'ta', 'nor', 'vi', 'sha', 'le', 'ce', 'dra'],
  c: ['on', 'ia', 'us', 'ae', 'is', 'or', 'ex', 'a', 'um', 'ine', 'ara', 'eth', 'os', 'ys', 'al', 'enne', 'ir', 'ova'],
};
function makeName(rng) {
  const p = (arr) => arr[Math.floor(rng() * arr.length)];
  let n = p(SYL.a);
  if (rng() < 0.65) n += p(SYL.b);
  n += p(SYL.c);
  const r = rng();
  if (r < 0.1) n += ' Prime';
  else if (r < 0.18) n += ' ' + p(['II', 'IV', 'VII', 'b', 'c']);
  return n;
}

export const FORGE_TYPES = {
  terran: { label: 'Terran', sound: 'ocean', sliders: ['radius', 'scale', 'sea', 'temp', 'clouds', 'atmo', 'glow'], swatches: [['colA', 'Ocean'], ['colC', 'Land'], ['colE', 'Shore'], ['atmo', 'Air']] },
  gas: { label: 'Gas giant', sound: 'gas', sliders: ['radius', 'bands', 'turb', 'storm', 'atmo'], swatches: [['colA', 'Zones'], ['colB', 'Belts'], ['colE', 'Storm'], ['atmo', 'Air']] },
  ice: { label: 'Ice', sound: 'ice', sliders: ['radius', 'scale', 'sea', 'clouds', 'atmo', 'glow'], swatches: [['colA', 'Ice'], ['colC', 'Seas'], ['colD', 'Rifts'], ['atmo', 'Air']] },
  lava: { label: 'Volcanic', sound: 'forge', sliders: ['radius', 'scale', 'glow', 'atmo'], swatches: [['colA', 'Rock'], ['colC', 'Seams'], ['glowCol', 'Glow'], ['atmo', 'Air']] },
  crystal: { label: 'Crystal', sound: 'glass', sliders: ['radius', 'scale', 'glow', 'atmo'], swatches: [['colA', 'Facets'], ['colB', 'Facets'], ['glowCol', 'Core'], ['atmo', 'Air']] },
  glow: { label: 'Glowing', sound: 'bio', sliders: ['radius', 'scale', 'sea', 'glow', 'clouds', 'atmo'], swatches: [['colA', 'Forest'], ['glowCol', 'Veins'], ['colE', 'Seas'], ['atmo', 'Air']] },
  eyeball: { label: 'Tidally locked', sound: 'dusk', sliders: ['radius', 'scale', 'clouds', 'atmo'], swatches: [['colB', 'Desert'], ['colC', 'Dusk'], ['colD', 'Ice'], ['atmo', 'Air']] },
};

const tempWord = (t) => (t < 0.18 ? 'Frozen' : t < 0.38 ? 'Cold' : t < 0.62 ? 'Temperate' : t < 0.82 ? 'Warm' : 'Scorching');

function setGlow(d, v, u) {
  d.params.glow = v;
  if (u) u.uGlow.value = v;
  if (d.type === 'terran') {
    d.params.reef = d.params.glowMode === 'reef' ? v : 0;
    d.params.lights = d.params.glowMode === 'lights' ? v : 0;
    if (u) { u.uReef.value = d.params.reef; u.uLights.value = d.params.lights; }
  }
}

const SLIDERS = {
  radius: { label: 'Size', min: 0.3, max: 12, step: 0.01, fmt: (v) => `${v.toFixed(2)} × Earth`, get: (d) => d.stats.radius, set: (d, v) => { d.stats.radius = v; } },
  scale: { label: 'Feature scale', min: 0.6, max: 4, step: 0.01, fmt: (v) => v.toFixed(2), get: (d) => d.params.scale, set: (d, v, u) => { d.params.scale = v; u.uScale.value = v; } },
  sea: { label: 'Sea level', min: -0.5, max: 0.5, step: 0.01, fmt: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`, get: (d) => d.params.sea, set: (d, v, u) => { d.params.sea = v; u.uSea.value = v; } },
  temp: { label: 'Climate', min: 0, max: 1, step: 0.01, fmt: tempWord, get: (d) => d.params.temp, set: (d, v, u) => { d.params.temp = v; u.uTemp.value = v; } },
  clouds: { label: 'Cloud cover', min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%`, get: (d) => (d.clouds ? d.clouds.cover : 0), set: (d, v, u) => { if (d.clouds) { d.clouds.cover = v; u.uCloudCover.value = v; } } },
  atmo: { label: 'Atmosphere', min: 0, max: 1.6, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%`, get: (d) => d.atmosphere.strength, set: (d, v, u) => { d.atmosphere.strength = v; d.params.atmoStr = 0.45 * v; u.uAtmoShellStr.value = v; u.uAtmoStr.value = 0.45 * v; } },
  glow: { label: 'Glow', min: 0, max: 2, step: 0.01, fmt: (v) => `${Math.round(v * 50)}%`, get: (d) => d.params.glow, set: (d, v, u) => setGlow(d, v, u) },
  bands: { label: 'Cloud bands', min: 3, max: 24, step: 0.1, fmt: (v) => v.toFixed(0), get: (d) => d.params.bands, set: (d, v, u) => { d.params.bands = v; u.uStormP.value.z = v; } },
  turb: { label: 'Turbulence', min: 0, max: 2, step: 0.01, fmt: (v) => v.toFixed(2), get: (d) => d.params.turbulence, set: (d, v, u) => { d.params.turbulence = v; u.uStormP.value.w = v; } },
  storm: { label: 'Great storm', min: 0, max: 1.5, step: 0.01, fmt: (v) => (v < 0.05 ? 'None' : v.toFixed(2)), get: (d) => d.params.storm.strength, set: (d, v, u) => { d.params.storm.strength = v; u.uStormP.value.x = v; } },
};

function genRings(rng, h) {
  const r = (a, b) => a + rng() * (b - a);
  return { inner: r(1.3, 1.5), outer: r(2.0, 2.45), colA: hsl(h + r(-0.05, 0.05), r(0.15, 0.4), r(0.78, 0.9)), colB: hsl(h + r(-0.08, 0.08), r(0.15, 0.3), r(0.45, 0.6)) };
}

function genMoons(rng, n, def) {
  const r = (a, b) => a + rng() * (b - a);
  const start = def.rings ? def.rings.outer + 0.4 : 2.3;
  const moons = [];
  for (let i = 0; i < n; i++) {
    if (def.shape === 'torus' && i === 0) {
      moons.push({ name: 'Needle', size: 0.08, dist: 0.4, speed: 0.5, incl: 0, phase: r(0, 6.28), colA: '#8a8078', colB: '#d6cbbd', seed: Math.floor(r(1, 90)), through: true });
      continue;
    }
    const h = rng(), grey = r(0.35, 0.6);
    moons.push({
      name: `Moon ${i + 1}`, size: r(0.06, 0.19), dist: start + i * 0.75 + r(0, 0.3), speed: r(0.06, 0.2), incl: r(-0.28, 0.28), phase: r(0, 6.28),
      colA: hsl(h, r(0, 0.15), grey * 0.55), colB: hsl(h, r(0, 0.15), grey + 0.25), seed: Math.floor(r(1, 90)),
    });
  }
  return moons;
}

function genDef(type, seed, shape = 'sphere', opts = {}) {
  const rng = mulberry32(seed * 7919 + 17);
  const r = (a, b) => a + rng() * (b - a);
  const h = rng();
  const P = { seed: [r(0, 40), r(0, 40), r(0, 40)], scale: r(1.3, 2.3), sea: 0, temp: 0.5, bump: 0.2, glow: 1, reef: 0, lights: 0, atmoStr: 0.45 };
  let clouds = null, rings = null, aurora = null, sunIntensity = 1.85, ambient = null;
  let atmosphere = { color: '#8fc1ff', sunset: '#ff9466', thickness: 0.07, strength: 1 };
  let radius = r(0.5, 2.2), accent;
  const swirl = (cover, tint = '#ffffff', opacity = 0.92) => ({ style: 'swirl', cover, scale: r(1.3, 2.0), seed: [r(0, 20), r(0, 20), r(0, 20)], opacity, tint, speed: 0.012, shadow: 0.4 });
  switch (type) {
    case 'terran': {
      const oh = r(0.5, 0.64), lh = rng() < 0.72 ? r(0.2, 0.36) : rng();
      P.sea = r(-0.1, 0.24); P.temp = r(0.28, 0.85); P.bump = 0.18;
      P.colA = hsl(oh, 0.78, 0.13); P.colB = hsl(oh - 0.03, 0.62, 0.37); P.colC = hsl(lh, 0.42, 0.3); P.colD = hsl(lh - 0.12, 0.22, 0.42); P.colE = hsl(r(0.09, 0.13), 0.35, 0.72);
      P.glowMode = rng() < 0.5 ? 'lights' : 'reef';
      P.glowCol = P.glowMode === 'lights' ? hsl(r(0.08, 0.13), 0.95, 0.66) : hsl(r(0.45, 0.52), 0.95, 0.6);
      P.glow = r(0.7, 1.3);
      clouds = swirl(r(0.28, 0.62));
      atmosphere = { color: hsl(oh - 0.02, 0.85, 0.63), sunset: '#ff9466', thickness: 0.07, strength: r(0.9, 1.2) };
      accent = lighten(P.colB, 0.2, 0.1);
      break;
    }
    case 'gas': {
      radius = r(3.5, 11.5);
      const gh = rng() < 0.6 ? r(0.02, 0.12) : r(0.45, 0.75);
      P.scale = r(1.1, 1.7); P.bands = r(7, 16); P.turbulence = r(0.6, 1.2); P.bump = 0; P.glow = 0;
      P.storm = { lat: r(-40, 40), lon: r(-180, 180), strength: rng() < 0.85 ? r(0.7, 1.2) : 0, size: r(0.15, 0.27) };
      P.colA = hsl(gh, 0.42, 0.86); P.colB = hsl(gh + 0.02, 0.55, 0.6); P.colC = hsl(gh - 0.03, 0.55, 0.37); P.colD = hsl(gh + 0.01, 0.35, 0.24); P.colE = hsl(gh - 0.05, 0.75, 0.5);
      atmosphere = { color: hsl(gh, 0.6, 0.8), sunset: hsl(gh - 0.03, 0.8, 0.6), thickness: 0.035, strength: 0.6 };
      if (opts.rings ?? rng() < 0.6) rings = genRings(rng, gh);
      accent = lighten(P.colB, 0.12, 0.1);
      break;
    }
    case 'ice': {
      const ih = rng() < 0.75 ? r(0.52, 0.62) : rng();
      P.sea = r(-0.3, 0.05); P.temp = 0.1; P.bump = 0.3; P.glow = r(0.5, 1.1);
      P.colA = hsl(ih, 0.25, 0.95); P.colB = hsl(ih, 0.35, 0.82); P.colC = hsl(ih, 0.38, 0.55); P.colD = hsl(ih + 0.01, 0.62, 0.35); P.colE = '#ffffff';
      P.glowCol = hsl(ih - 0.04, 0.9, 0.62);
      clouds = swirl(r(0.12, 0.3), hsl(ih, 0.3, 0.95), 0.55);
      atmosphere = { color: hsl(ih, 0.7, 0.78), sunset: hsl(ih + 0.2, 0.6, 0.75), thickness: 0.06, strength: 0.8 };
      if (rng() < 0.65) aurora = { a: hsl(r(0.3, 0.42), 1, 0.6), b: hsl(r(0.85, 0.95), 1, 0.65), strength: 1.3 };
      accent = lighten(P.glowCol, 0.08);
      break;
    }
    case 'lava': {
      const gh = rng() < 0.7 ? r(0.02, 0.13) : rng();
      P.scale = r(1.3, 2.2); P.bump = 0.25; P.glow = r(0.8, 1.3);
      P.colA = hsl(h, 0.12, 0.07); P.colB = hsl(h + 0.05, 0.1, 0.2); P.colC = hsl(gh, 0.7, 0.58); P.glowCol = hsl(gh, 0.95, 0.6);
      atmosphere = { color: hsl(gh, 0.8, 0.7), sunset: hsl(gh - 0.03, 0.9, 0.55), thickness: 0.05, strength: 0.55 };
      accent = P.glowCol;
      break;
    }
    case 'crystal': {
      P.scale = r(1.5, 2.6); P.bump = 0.35; P.glow = r(0.7, 1.2); P.temp = 0.9;
      P.colA = hsl(h, 0.8, 0.62); P.colB = hsl(h + r(0.1, 0.2), 0.7, 0.7); P.colC = hsl(h + 0.5, 0.55, 0.88); P.colD = '#1b2a4a'; P.colE = '#ffffff';
      P.glowCol = hsl(h + 0.5, 0.9, 0.6);
      atmosphere = { color: hsl(h, 0.6, 0.8), sunset: hsl(h + 0.5, 0.7, 0.7), thickness: 0.06, strength: 0.7 };
      accent = lighten(P.colA, 0.08);
      break;
    }
    case 'glow': {
      P.sea = r(-0.2, 0.08); P.bump = 0.25; P.glow = r(0.9, 1.3); P.temp = 0.4;
      P.colA = hsl(h, 0.45, 0.08); P.colB = hsl(h + 0.05, 0.4, 0.15); P.colC = hsl(h + 0.5, 0.6, 0.04); P.colD = hsl(h - 0.12, 0.95, 0.62); P.colE = hsl(h + 0.42, 0.9, 0.5);
      P.glowCol = hsl(h + 0.55, 0.95, 0.62);
      sunIntensity = 0.6; ambient = [0.03, 0.02, 0.05];
      clouds = swirl(r(0.15, 0.3), lighten(P.colD, 0.3, -0.4), 0.55);
      atmosphere = { color: hsl(h + 0.05, 0.8, 0.65), sunset: hsl(h - 0.1, 0.9, 0.65), thickness: 0.07, strength: 1.0 };
      accent = lighten(P.glowCol, 0.05);
      break;
    }
    case 'eyeball': {
      P.scale = r(1.5, 2.3); P.bump = 0.22; P.temp = 0.6;
      P.colA = hsl(0.1, 0.45, 0.9); P.colB = hsl(r(0.02, 0.1), 0.65, 0.5); P.colC = hsl(r(0.2, 0.42), 0.45, 0.33); P.colD = hsl(0.58, 0.3, 0.92); P.colE = hsl(0.58, 0.4, 0.62);
      P.glowCol = '#ff5a1f';
      clouds = { style: 'eye', cover: 0.6, scale: 2.2, seed: [r(0, 20), r(0, 20), r(0, 20)], opacity: 0.9, tint: '#ffffff', speed: 0 };
      atmosphere = { color: '#8fc1ff', sunset: '#ff9c66', thickness: 0.065, strength: 1.0 };
      accent = lighten(P.colB, 0.12);
      break;
    }
    default: break;
  }
  if (!rings && opts.rings === true) rings = genRings(rng, h);
  P.atmoCol = atmosphere.color;
  P.atmoStr = 0.45 * atmosphere.strength;
  const def = {
    id: 'forge', custom: true, type, shape, accent, params: P, clouds, atmosphere, rings, aurora, ambient,
    tilt: r(0.05, 0.45), spin: r(0.05, 0.12), sunIntensity, locked: false,
    name: makeName(rng), seed,
    gen: { dens: rng(), day: rng(), dist: rng(), temp: rng(), mood: rng() },
    stats: { radius: shape === 'torus' ? Math.max(radius, 1.2) : radius },
  };
  const moonCount = opts.moons ?? Math.floor(rng() * (type === 'gas' ? 4 : 3));
  def.moons = genMoons(rng, moonCount, def);
  return def;
}

// ---------------------------------------------------------------- derived copy

const fmtTemp = (c) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(Math.round(c))} °C`;
function fmtDay(h) {
  if (h >= 72) return `${Math.round(h / 24)} days`;
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${hh} h ${String(mm).padStart(2, '0')} m`;
}
const fmtYear = (d) => (d < 400 ? `${Math.round(d)} days` : `${(d / 365.25).toFixed(1)} years`);

function computeStats(def) {
  const g = def.gen, P = def.params, R = def.stats.radius, t = def.type;
  const density = t === 'gas' ? 0.24 : t === 'ice' ? 0.6 + g.dens * 0.25 : t === 'lava' ? 0.95 + g.dens * 0.3 : t === 'crystal' ? 0.85 + g.dens * 0.3 : 0.8 + g.dens * 0.35;
  const gravity = Math.max(0.05, density * R * (def.shape === 'torus' ? 0.45 : 1));
  const distAU = { lava: 0.18 + g.dist * 0.4, crystal: 0.12 + g.dist * 0.3, eyeball: 0.08 + g.dist * 0.4, terran: 0.6 + g.dist * 1.4, gas: 2.5 + g.dist * 14, ice: 6 + g.dist * 30, glow: 4 + g.dist * 16 }[t];
  const yearDays = 365.25 * Math.pow(distAU, 1.5);
  let dayHours = def.shape === 'torus' ? 2.5 + g.day * 2.5 : t === 'gas' ? 8 + g.day * 8 : 10 + g.day * 48;
  let temp, tempC;
  switch (t) {
    case 'terran': tempC = -70 + 130 * P.temp; break;
    case 'gas': tempC = -210 + 110 * g.temp; break;
    case 'ice': tempC = -235 + 70 * g.temp; break;
    case 'lava': tempC = 160 + 600 * g.temp; break;
    case 'crystal': tempC = 320 + 620 * g.temp; break;
    case 'glow': tempC = -30 + 36 * g.temp; break;
    default: tempC = 5 + 20 * g.temp;
  }
  temp = fmtTemp(tempC);
  let day = fmtDay(dayHours);
  if (t === 'eyeball') {
    dayHours = yearDays * 24;
    day = `${Math.round(yearDays)} days (locked)`;
    temp = `${fmtTemp(80 + 60 * g.temp)} / ${fmtTemp(-120 - 60 * g.temp)}`;
  }
  const pressure = t === 'gas' ? '—' : `${(0.2 + def.atmosphere.strength * 1.4 * (0.6 + g.mood)).toFixed(1)} bar`;
  return {
    radius: R, gravity: +gravity.toFixed(2), day, dayHours, year: fmtYear(yearDays), yearDays,
    temp, tempC, pressure, moons: def.moons.length, distance: `${distAU.toFixed(2)} AU`, distanceAU: +distAU.toFixed(2),
  };
}

function className(def) {
  const P = def.params, t = def.type, torus = def.shape === 'torus';
  let s;
  switch (t) {
    case 'terran': s = `${tempWord(P.temp).toLowerCase()} ${P.sea > 0.15 ? 'ocean' : P.sea < -0.05 ? 'continental' : 'terrestrial'} world`; break;
    case 'gas': s = torus ? 'gas giant' : `${def.rings ? 'ringed ' : ''}${P.storm.strength > 0.05 ? 'storm-banded' : 'banded'} gas giant`; break;
    case 'ice': s = def.stats.radius > 1.5 && !torus ? 'frozen super-Earth' : 'ice world'; break;
    case 'lava': s = torus ? 'volcanic world' : 'fractured volcanic world'; break;
    case 'crystal': s = 'crystalline world'; break;
    case 'glow': s = 'bioluminescent world'; break;
    default: s = 'tidally locked world';
  }
  if (torus) s = 'ring-shaped ' + s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const HUE_WORDS = [[15, 'red'], [45, 'amber'], [70, 'golden'], [160, 'green'], [200, 'teal'], [255, 'blue'], [290, 'violet'], [335, 'magenta'], [361, 'red']];
function hueWord(hex) {
  const o = {};
  new THREE.Color(hex).getHSL(o, THREE.SRGBColorSpace);
  if (o.s < 0.15) return o.l > 0.6 ? 'pale' : 'grey';
  return HUE_WORDS.find(([max]) => o.h * 360 < max)[1];
}

function describe(def, stats) {
  const P = def.params, n = def.name, R = def.stats.radius;
  const size = R < 0.8 ? 'a little smaller than Earth' : R < 1.25 ? 'about the size of Earth' : R < 2.2 ? `${R.toFixed(1)} times as wide as Earth` : `${R.toFixed(1)} times the width of Earth`;
  const bits = [];
  switch (def.type) {
    case 'terran':
      bits.push(`${n} is a ${tempWord(P.temp).toLowerCase()} world ${size}, ${P.sea > 0.15 ? 'almost entirely wrapped in ocean' : P.sea < -0.05 ? 'mostly dry land dotted with inland seas' : 'split between oceans and continents'}.`);
      bits.push(def.clouds.cover > 0.55 ? 'Thick weather systems wrap it in white.' : def.clouds.cover > 0.28 ? 'Its skies are streaked with cloud.' : 'Its skies are almost always clear.');
      if (P.glow > 0.2) bits.push(P.glowMode === 'lights' ? 'At night its coasts sparkle with the lights of cities.' : 'At night its shallow reefs glow like lanterns.');
      break;
    case 'gas':
      bits.push(`${n} is a gas giant ${size}, its clouds combed into ${Math.round(P.bands)} bands by winds that never stop.`);
      if (P.storm.strength > 0.05) bits.push('A great storm older than any civilization turns slowly in its southern clouds.');
      break;
    case 'ice':
      bits.push(`${n} is a frozen world ${size}, cracked into ${hueWord(P.colD)} canyons that groan as the ice shifts.`);
      if (def.aurora) bits.push('Auroras burn over both poles, bright enough to cast shadows.');
      break;
    case 'lava':
      bits.push(`${n} is a shattered volcanic world ${size}. Molten metal glows through every seam between its drifting plates.`);
      break;
    case 'crystal':
      bits.push(`${n} is a world of crystal ${size}; each facet flashes in turn as it rotates, like a slow lighthouse.`);
      break;
    case 'glow':
      bits.push(`${n} lies far from its star, ${size}. Its forests and seas make their own light in pulses of colour.`);
      break;
    default:
      bits.push(`${n} keeps one face toward its star: a blazing desert on one side, endless ice on the other, and a ring of dusk in between.`);
  }
  if (def.shape === 'torus') bits.push('It is shaped like a ring: from the inner coast, the far side of the world arches overhead.');
  if (def.rings) bits.push('A bright ring system circles its equator.');
  const m = def.moons.length;
  bits.push(m === 0 ? 'It has no moons.' : m === 1 ? 'A single moon keeps it company.' : `${m} moons trail it through the dark.`);
  return bits.join(' ');
}

const COMP = {
  terran: [['Nitrogen', 68, 80], ['Oxygen', 15, 28], ['Argon', 1, 3]],
  gas: [['Hydrogen', 84, 90], ['Helium', 9, 14], ['Methane', 0.3, 1]],
  ice: [['Nitrogen', 80, 90], ['Methane', 4, 10], ['Carbon monoxide', 1, 4]],
  lava: [['Carbon dioxide', 60, 78], ['Sulfur dioxide', 10, 20], ['Nitrogen', 3, 9]],
  crystal: [['Silicate vapour', 45, 62], ['Carbon monoxide', 15, 28], ['Sodium', 5, 14]],
  glow: [['Nitrogen', 55, 68], ['Hydrogen', 10, 24], ['Methane', 5, 14]],
  eyeball: [['Nitrogen', 70, 80], ['Carbon dioxide', 8, 18], ['Argon', 3, 6]],
};
const COMP_REST = { terran: 'Other', gas: 'Other', ice: 'Neon', lava: 'Other', crystal: 'Other', glow: 'Argon', eyeball: 'Oxygen' };

// Turn a forge definition into a full atlas entry (stats, copy, orbit placeholders).
export function finalizeDef(src) {
  const def = JSON.parse(JSON.stringify(src));
  const stats = computeStats(def);
  def.stats = stats;
  def.cls = className(def);
  def.epithet = 'Forged by you';
  def.tagline = `A ${def.cls.toLowerCase()} that exists because you imagined it.`;
  def.lore = describe(def, stats);
  const rng = mulberry32(def.seed * 31 + 7);
  const parts = COMP[def.type].map(([k, a, b]) => [k, +(a + rng() * (b - a)).toFixed(1)]);
  const rest = Math.max(0.5, 100 - parts.reduce((s, p) => s + p[1], 0));
  def.atmoComp = [...parts, [COMP_REST[def.type], +rest.toFixed(1)]];
  def.pois = [];
  def.note = { text: 'Nobody has ever been here. Then again, nobody had ever imagined it before, either.', by: 'Atlas editors' };
  const comfort = def.type === 'terran' ? (def.params.temp > 0.3 && def.params.temp < 0.75 ? 5 : 3) : def.type === 'eyeball' ? 3 : def.type === 'glow' ? 2 : 1;
  const danger = { lava: 5, crystal: 4, gas: 4, ice: 3, glow: 3, eyeball: 2, terran: 1 }[def.type];
  def.ratings = { wonder: 3 + Math.round(rng() * 2), comfort, danger };
  def.sound = def.shape === 'torus' ? 'loop' : FORGE_TYPES[def.type].sound;
  def.visual = def.shape === 'torus' ? Math.min(2.4, 1.2 + 0.25 * Math.sqrt(stats.radius)) : Math.max(1.0, Math.min(4.6, 1.45 * Math.sqrt(stats.radius)));
  def.view = { dist: def.rings ? 6.8 : def.shape === 'torus' ? 4.2 : 3.4, az: 45, el: def.shape === 'torus' ? 36 : 14 };
  delete def.id;
  return def;
}

// ---------------------------------------------------------------- the forge itself

export class Forge {
  constructor({ renderer, shared, audio, onSave, onChange }) {
    this.renderer = renderer;
    this.shared = shared;
    this.audio = audio;
    this.onSave = onSave;
    this.onChange = onChange || (() => {});
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 9000);
    this.camera.position.set(1.4, 3.0, 7.3);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 22;
    this.controls.addEventListener('start', () => { this.userZoomed = true; });
    this.starfield = createStarfield(shared, 7000);
    this.scene.add(this.starfield);
    this.light = new THREE.Vector3(-0.62, 0.32, 0.72).normalize();
    this.ctx = { starPos: this.light.clone().multiplyScalar(1e5), compareLight: this.light };
    this.state = { simTime: 0, compareEase: 0, spinRate: 1 };
    this.targetDist = 8;
    this.planet = null;
    this.seedN = 1 + Math.floor(Math.random() * 9999);
    this.def = genDef('terran', this.seedN, 'sphere', { moons: 1 });
    this.buildUI();
    this.rebuild();
  }

  setBackground(tex) { this.scene.background = tex; }

  rebuild() {
    if (this.planet) {
      this.scene.remove(this.planet.group);
      this.planet.dispose();
    }
    const d = this.def;
    d.orbit = { r: 0, phase: 0, incl: 0 };
    d.visual = d.shape === 'torus' ? 1.3 : 1.6;
    this.planet = new Planet(d, this.shared);
    this.planet.visual = d.visual;
    this.planet.trueScale = d.visual;
    this.scene.add(this.planet.group);
    const bound = d.visual * (d.rings ? d.rings.outer : d.shape === 'torus' ? 1 + TORUS_TUBE : 1);
    this.targetDist = bound * (d.rings ? 3.3 : 4.4);
    this.userZoomed = false;
    this.syncUI();
  }

  enter() {
    this.controls.enabled = true;
    this.resize();
    this.audio.play(this.def.shape === 'torus' ? 'loop' : FORGE_TYPES[this.def.type].sound);
    this.onChange(this.def);
  }
  exit() { this.controls.enabled = false; }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  viewOffset() {
    const narrow = innerWidth < 820;
    if (narrow) return { x: 0, y: innerHeight * 0.2 };
    const panel = $('#forgePanel').getBoundingClientRect();
    const id = $('#forgeId').getBoundingClientRect();
    const left = panel.right, right = id.width ? id.left : innerWidth;
    return { x: innerWidth / 2 - (left + right) / 2, y: 0 };
  }

  update(dt) {
    this.planet.update(this.state, dt, this.ctx);
    const c = this.camera, off = this.viewOffset();
    const d = c.position.length();
    const nd = damp(d, this.targetDist, 2.5, dt);
    if (!this.userZoomed) c.position.multiplyScalar(nd / d);
    this.controls.update();
    this.starfield.position.copy(c.position);
    if (Math.abs(off.x) > 0.5 || Math.abs(off.y) > 0.5) c.setViewOffset(innerWidth, innerHeight, off.x, off.y, innerWidth, innerHeight);
    else c.clearViewOffset();
    c.updateMatrixWorld();
    this.planet.fadeMoons(c, [$('#forgePanel').getBoundingClientRect(), $('#forgeId').getBoundingClientRect()], dt);
  }

  render(renderer) { renderer.render(this.scene, this.camera); }

  // ------------------------------------------------------------ UI
  buildUI() {
    const panel = $('#forgePanel');
    panel.innerHTML = `
      <div class="forge-scroll">
        <p class="eyebrow">Planet forge</p>
        <h2>Make a world</h2>
        <p class="sub">Every change redraws the planet live. When you like it, add it to the atlas — it will join the Vesper system.</p>
        <div class="f-group"><span class="k">Type</span><div class="chips" data-role="types">
          ${Object.entries(FORGE_TYPES).map(([id, t]) => `<button type="button" class="chip" data-type="${id}">${t.label}</button>`).join('')}
        </div></div>
        <div class="f-group"><span class="k">Shape</span><div class="chips">
          <button type="button" class="chip" data-shape="sphere">Sphere</button>
          <button type="button" class="chip" data-shape="torus">Ring-shaped (torus)</button>
        </div></div>
        <div class="f-group" data-role="sliders"></div>
        <div class="f-group"><span class="k">Palette</span><div class="swatches" data-role="swatches"></div></div>
        <div class="f-group"><span class="k">Features</span>
          <div class="f-row"><span>Rings</span><button type="button" class="chip" data-act="rings">Off</button></div>
          <div class="f-row"><span>Moons</span><span class="stepper"><button type="button" data-act="moon-" aria-label="Fewer moons">−</button><output data-role="moons">0</output><button type="button" data-act="moon+" aria-label="More moons">+</button></span></div>
          <div class="slider"><label for="f-tilt">Axial tilt</label><output data-role="tilt"></output><input id="f-tilt" type="range" min="0" max="1.4" step="0.01" data-role="tiltIn"></div>
        </div>
      </div>
      <div class="forge-actions">
        <button type="button" class="btn" data-act="surprise"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="5.2" cy="5.2" r="1.1" fill="currentColor"/><circle cx="10.8" cy="10.8" r="1.1" fill="currentColor"/><circle cx="8" cy="8" r="1.1" fill="currentColor"/></svg>Surprise me</button>
        <button type="button" class="btn" data-act="postcard">Save postcard</button>
        <button type="button" class="btn accent wide" data-act="save">Add to the atlas</button>
      </div>`;
    panel.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
      this.seedN = 1 + Math.floor(Math.random() * 9999);
      this.def = genDef(b.dataset.type, this.seedN, this.def.shape, { moons: this.def.moons.length });
      this.rebuild();
      this.audio.play(this.def.shape === 'torus' ? 'loop' : FORGE_TYPES[this.def.type].sound);
      this.audio.sfx('click');
    }));
    panel.querySelectorAll('[data-shape]').forEach((b) => b.addEventListener('click', () => {
      if (this.def.shape === b.dataset.shape) return;
      this.def.shape = b.dataset.shape;
      this.def.moons = genMoons(mulberry32(this.def.seed + 5), this.def.moons.length, this.def);
      if (this.def.shape === 'torus') this.def.stats.radius = Math.max(this.def.stats.radius, 1.2);
      this.rebuild();
      this.audio.play(this.def.shape === 'torus' ? 'loop' : FORGE_TYPES[this.def.type].sound);
      this.audio.sfx('click');
    }));
    panel.querySelector('[data-act="rings"]').addEventListener('click', () => {
      this.def.rings = this.def.rings ? null : genRings(mulberry32(this.def.seed + 3), Math.random());
      this.def.moons = genMoons(mulberry32(this.def.seed + 5), this.def.moons.length, this.def);
      this.rebuild();
      this.audio.sfx('click');
    });
    const moonStep = (dn) => {
      const n = Math.max(0, Math.min(4, this.def.moons.length + dn));
      if (n === this.def.moons.length) return;
      this.def.moons = genMoons(mulberry32(this.def.seed + 5), n, this.def);
      this.rebuild();
      this.audio.sfx('click');
    };
    panel.querySelector('[data-act="moon-"]').addEventListener('click', () => moonStep(-1));
    panel.querySelector('[data-act="moon+"]').addEventListener('click', () => moonStep(1));
    const tiltIn = panel.querySelector('[data-role="tiltIn"]');
    tiltIn.addEventListener('input', () => {
      const v = +tiltIn.value;
      this.planet.setTilt(v);
      this.updateRange(tiltIn);
      panel.querySelector('[data-role="tilt"]').textContent = `${Math.round(v * 57.3)}°`;
    });
    panel.querySelector('[data-act="surprise"]').addEventListener('click', () => this.surprise());
    panel.querySelector('[data-act="postcard"]').addEventListener('click', () => this.postcard());
    panel.querySelector('[data-act="save"]').addEventListener('click', () => {
      this.onSave(finalizeDef(this.def));
      this.audio.sfx('chime');
    });
  }

  surprise() {
    const types = Object.keys(FORGE_TYPES);
    this.seedN = 1 + Math.floor(Math.random() * 9999);
    const type = types[Math.floor(Math.random() * types.length)];
    const shape = Math.random() < 0.22 ? 'torus' : 'sphere';
    this.def = genDef(type, this.seedN, shape);
    this.rebuild();
    this.audio.play(shape === 'torus' ? 'loop' : FORGE_TYPES[type].sound);
    this.audio.sfx('click');
  }

  load(def) {
    const d = JSON.parse(JSON.stringify(def));
    d.id = 'forge';
    d.gen = d.gen || { dens: 0.5, day: 0.5, dist: 0.5, temp: 0.5, mood: 0.5 };
    d.stats = { radius: d.stats.radius };
    this.def = d;
    this.seedN = d.seed || 1;
    this.rebuild();
  }

  updateRange(input) {
    const p = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
    input.style.setProperty('--p', `${p}%`);
  }

  syncUI() {
    const panel = $('#forgePanel'), d = this.def, T = FORGE_TYPES[d.type];
    panel.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('on', b.dataset.type === d.type));
    panel.querySelectorAll('[data-shape]').forEach((b) => b.classList.toggle('on', b.dataset.shape === d.shape));
    const rb = panel.querySelector('[data-act="rings"]');
    rb.classList.toggle('on', !!d.rings);
    rb.textContent = d.rings ? 'On' : 'Off';
    panel.querySelector('[data-role="moons"]').textContent = String(d.moons.length);
    const tiltIn = panel.querySelector('[data-role="tiltIn"]');
    tiltIn.value = d.tilt;
    this.updateRange(tiltIn);
    panel.querySelector('[data-role="tilt"]').textContent = `${Math.round(d.tilt * 57.3)}°`;

    const sl = panel.querySelector('[data-role="sliders"]');
    sl.innerHTML = `<span class="k">Shape the world</span>` + T.sliders.map((k) => {
      const s = SLIDERS[k];
      return `<div class="slider"><label for="f-${k}">${s.label}</label><output data-out="${k}"></output><input id="f-${k}" type="range" min="${s.min}" max="${s.max}" step="${s.step}" data-slider="${k}"></div>`;
    }).join('');
    sl.querySelectorAll('[data-slider]').forEach((inp) => {
      const k = inp.dataset.slider, s = SLIDERS[k];
      inp.value = s.get(d);
      const out = sl.querySelector(`[data-out="${k}"]`);
      out.textContent = s.fmt(s.get(d));
      this.updateRange(inp);
      inp.addEventListener('input', () => {
        const v = +inp.value;
        s.set(this.def, v, this.planet.u);
        out.textContent = s.fmt(v);
        this.updateRange(inp);
        this.renderIdentity();
      });
    });

    const sw = panel.querySelector('[data-role="swatches"]');
    sw.innerHTML = T.swatches.map(([key, label]) => {
      const val = key === 'atmo' ? d.atmosphere.color : d.params[key];
      return `<label class="swatch"><input type="color" value="${val}" data-swatch="${key}" aria-label="${label} colour">${label}</label>`;
    }).join('') + `<button type="button" class="chip" data-act="shuffle">Shuffle</button>`;
    sw.querySelectorAll('[data-swatch]').forEach((inp) => inp.addEventListener('input', () => this.setColor(inp.dataset.swatch, inp.value)));
    sw.querySelector('[data-act="shuffle"]').addEventListener('click', () => this.shufflePalette());
    this.renderIdentity();
  }

  setColor(key, value) {
    const d = this.def, u = this.planet.u;
    if (key === 'atmo') {
      d.atmosphere.color = value;
      d.params.atmoCol = value;
      u.uAtmoShellCol.value.set(value);
      u.uAtmoCol.value.set(value);
    } else {
      d.params[key] = value;
      u['u' + key.charAt(0).toUpperCase() + key.slice(1)].value.set(value);
      if (d.type === 'terran' && key === 'colA') { d.params.colB = lighten(value, 0.22, -0.1); u.uColB.value.set(d.params.colB); }
      if (d.type === 'terran' && key === 'colC') { d.params.colD = lighten(value, 0.1, -0.2); u.uColD.value.set(d.params.colD); }
      if (d.type === 'gas' && key === 'colB') { d.params.colC = lighten(value, -0.22); d.params.colD = lighten(value, -0.35, -0.15); u.uColC.value.set(d.params.colC); u.uColD.value.set(d.params.colD); }
      if (d.type === 'ice' && key === 'colA') { d.params.colB = lighten(value, -0.12, 0.1); u.uColB.value.set(d.params.colB); }
      if (d.type === 'lava' && key === 'colA') { d.params.colB = lighten(value, 0.12); u.uColB.value.set(d.params.colB); }
      if (d.type === 'ice' && key === 'colD') this.renderIdentity();
    }
    const accentKey = { terran: 'colB', gas: 'colB', ice: 'glowCol', lava: 'glowCol', crystal: 'colA', glow: 'glowCol', eyeball: 'colB' }[d.type];
    if (key === accentKey || (d.type === 'terran' && key === 'colA')) {
      d.accent = lighten(d.params[accentKey], 0.12);
      u.uHiCol.value.set(d.accent);
      this.onChange(d);
    }
  }

  shufflePalette() {
    const keep = this.def;
    const fresh = genDef(keep.type, 1 + Math.floor(Math.random() * 9999), keep.shape, { moons: keep.moons.length, rings: !!keep.rings });
    for (const k of ['colA', 'colB', 'colC', 'colD', 'colE', 'glowCol', 'atmoCol', 'glowMode']) if (fresh.params[k] !== undefined) keep.params[k] = fresh.params[k];
    keep.atmosphere.color = fresh.atmosphere.color;
    keep.atmosphere.sunset = fresh.atmosphere.sunset;
    if (keep.rings && fresh.rings) { keep.rings.colA = fresh.rings.colA; keep.rings.colB = fresh.rings.colB; }
    if (keep.aurora && fresh.aurora) keep.aurora = fresh.aurora;
    if (keep.clouds && fresh.clouds) keep.clouds.tint = fresh.clouds.tint;
    keep.accent = fresh.accent;
    setGlow(keep, keep.params.glow);
    this.planet.applyParams(keep);
    this.syncUI();
    this.onChange(keep);
    this.audio.sfx('click');
  }

  renderIdentity() {
    const d = this.def;
    const stats = computeStats(d);
    const box = $('#forgeId');
    box.innerHTML = `
      <div class="k">Forged world · seed ${d.seed}</div>
      <div class="name-row"><button type="button" class="reroll" data-act="rename" title="New name" aria-label="New name">↻</button><h2>${esc(d.name)}</h2></div>
      <div class="cls">${esc(className(d))}</div>
      <p>${esc(describe(d, stats))}</p>
      <dl>
        <dt>Radius</dt><dd>${stats.radius.toFixed(2)} × Earth</dd>
        <dt>Gravity</dt><dd>${stats.gravity.toFixed(2)} g</dd>
        <dt>Day</dt><dd>${stats.day}</dd>
        <dt>Year</dt><dd>${stats.year}</dd>
        <dt>Temperature</dt><dd>${stats.temp}</dd>
        <dt>Moons</dt><dd>${stats.moons}</dd>
      </dl>`;
    box.querySelector('[data-act="rename"]').addEventListener('click', () => {
      this.def.name = makeName(mulberry32(Math.floor(Math.random() * 1e9)));
      this.renderIdentity();
      this.audio.sfx('click');
    });
  }

  async postcard() {
    const d = this.def, stats = computeStats(d);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    this.update(0);
    this.render(this.renderer);
    const src = this.renderer.domElement;
    const W = 1600, H = 1000;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#05060a';
    g.fillRect(0, 0, W, H);
    const p = new THREE.Vector3(0, 0, 0).project(this.camera);
    const sx = (p.x * 0.5 + 0.5) * src.width, sy = (-p.y * 0.5 + 0.5) * src.height;
    const s = (H * 1.05) / src.height;
    g.drawImage(src, W * 0.66 - sx * s, H * 0.5 - sy * s, src.width * s, src.height * s);
    const grd = g.createLinearGradient(0, 0, W * 0.62, 0);
    grd.addColorStop(0, 'rgba(5,6,10,0.94)');
    grd.addColorStop(0.7, 'rgba(5,6,10,0.55)');
    grd.addColorStop(1, 'rgba(5,6,10,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.fillStyle = d.accent;
    g.font = '500 22px "JetBrains Mono", monospace';
    g.fillText('GREETINGS FROM', 96, 300);
    g.fillStyle = '#ede9e0';
    let size = 150;
    g.font = `${size}px "Instrument Serif", Georgia, serif`;
    while (g.measureText(d.name).width > W * 0.52 && size > 60) { size -= 6; g.font = `${size}px "Instrument Serif", Georgia, serif`; }
    g.fillText(d.name, 90, 300 + size * 0.95);
    g.fillStyle = '#bcb8ae';
    g.font = 'italic 40px "Instrument Serif", Georgia, serif';
    g.fillText(className(d), 96, 300 + size * 0.95 + 62);
    g.font = '500 20px "JetBrains Mono", monospace';
    g.fillStyle = '#858996';
    const row = [`${stats.radius.toFixed(2)} × EARTH`, `${stats.gravity.toFixed(2)} G`, stats.temp.toUpperCase(), `${stats.moons} MOON${stats.moons === 1 ? '' : 'S'}`];
    g.fillText(row.join('   ·   '), 96, 300 + size * 0.95 + 132);
    g.fillStyle = d.accent;
    g.fillRect(96, H - 120, 48, 2);
    g.fillStyle = '#858996';
    g.font = '500 16px "JetBrains Mono", monospace';
    g.fillText('ATLAS OF IMAGINARY PLANETS · FORGED BY HAND', 96, H - 86);
    const a = document.createElement('a');
    a.download = `${d.name.replace(/[^\w-]+/g, '-').toLowerCase()}-postcard.png`;
    a.href = c.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.lastPostcard = a.href.length;
  }
}

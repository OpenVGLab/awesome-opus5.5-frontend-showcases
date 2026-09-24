// The one stage of CatWalk, laid out as plain data: platforms, obstacles, pickups,
// checkpoints and decoration markers. The world builder turns this into a city;
// the physics only ever sees the boxes.

export const PATH_RES = 0.25;

export function buildStage() {
  const S = {
    plats: [],      // main catwalk surfaces {x0,x1,y,style}
    solids: [],     // physics boxes
    oneways: [],    // land-from-above surfaces (wires, awnings, landings)
    hazards: [],
    blocks: [],     // obstacles standing on the catwalk
    ceilings: [],   // things hanging into the jump space
    fish: [],
    checkpoints: [],
    deco: [],
    sections: [],
    start: null,
    goal: null,
    length: 0,
  };

  let cx = 0;
  let cy = 2.4;

  const section = (key, numeral, name, speed) => S.sections.push({ key, numeral, name, speed, x0: cx });
  const plat = (len, style, extra = {}) => {
    const p = { x0: cx, x1: cx + len, y: cy, style, ...extra };
    S.plats.push(p);
    S.solids.push({ x0: p.x0, x1: p.x1, y0: -40, y1: p.y, kind: 'plat', ref: p });
    cx += len;
    return p;
  };
  const gap = (len, dy = 0) => { cx += len; cy += dy; };
  const rise = (dy) => { cy += dy; };
  const jumpTo = (x, y) => { cx = x; cy = y; };
  const block = (p, off, w, h, style, y0 = p.y) => {
    const b = { x0: p.x0 + off, x1: p.x0 + off + w, y0, y1: y0 + h, style };
    S.blocks.push(b);
    S.solids.push({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, kind: 'block', ref: b });
    return b;
  };
  const ceil = (x0, w, y0, h, style) => {
    const c = { x0, x1: x0 + w, y0, y1: y0 + h, style };
    S.ceilings.push(c);
    S.solids.push({ x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1, kind: 'ceil', ref: c });
    return c;
  };
  const oneway = (x0, x1, y, style, bouncy = false) => {
    const o = { x0, x1, y, style, bouncy };
    S.oneways.push(o);
    return o;
  };
  const glass = (p, off, w) => {
    const h = { x0: p.x0 + off, x1: p.x0 + off + w, y0: p.y, y1: p.y + 0.13, kind: 'glass' };
    S.hazards.push(h);
    return h;
  };
  const vent = (p, off, period = 5.2) => {
    const x = p.x0 + off;
    const h = { x0: x - 0.2, x1: x + 0.2, cx: x, y0: p.y, y1: p.y + 1.15, kind: 'vent', period, duty: 0.42, offset: 0.71 };
    S.hazards.push(h);
    return h;
  };
  const fish = (x, y) => S.fish.push({ x, y, id: S.fish.length });
  const fishRow = (x0, x1, y, n) => {
    for (let i = 0; i < n; i++) fish(x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), y);
  };
  const fishArc = (x0, y0, x1, y1, lift, n) => {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      fish(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + lift * 4 * t * (1 - t));
    }
  };
  const checkpoint = (x) => S.checkpoints.push({ x, id: S.checkpoints.length });
  const deco = (type, x, extra = {}) => S.deco.push({ type, x, ...extra });

  // ── I · Gaslight Lane ────────────────────────────────────────────────
  // Garden walls and fences under gas lamps. Teaches jumping, hopping and holding.
  section('gaslight', 'I', 'Gaslight Lane', 3.4);
  let p = plat(18, 'wall');                        // 0 – 18
  S.start = { x: 3.2 };
  deco('lamp', 4.8); deco('lamp', 15.2);
  fishRow(8.5, 12.5, p.y + 0.3, 3);
  gap(1.0); p = plat(8.4, 'wall');                 // 19 – 27.4
  fishArc(17.6, p.y + 0.3, 20.4, p.y + 0.3, 0.75, 3);
  block(p, 4.2, 0.32, 0.3, 'pot');
  fish(23.36, p.y + 0.95);
  deco('lamp', 25.8);
  gap(1.2, 0.35); p = plat(7.0, 'fence');          // 28.6 – 35.6
  fishRow(30.6, 33.6, p.y + 0.3, 3);
  gap(1.3, -0.35); p = plat(8.8, 'wall');          // 36.9 – 45.7
  deco('lamp', 36.4);
  block(p, 2.3, 0.32, 0.3, 'pot');
  block(p, 4.7, 0.32, 0.3, 'pot');
  fish(39.36, p.y + 0.95); fish(41.76, p.y + 0.95);
  rise(0.7); p = plat(6.0, 'pillar');              // 45.7 – 51.7
  fishArc(44.4, 2.4 + 0.4, 46.8, p.y + 0.35, 0.8, 3);
  deco('lamp', 47.2);
  gap(1.6, -0.5); p = plat(7.6, 'wall');           // 53.3 – 60.9
  fishArc(51.6, 3.1 + 0.35, 54.2, p.y + 0.35, 0.7, 3);
  glass(p, 2.8, 1.2);
  fishArc(55.4, p.y + 0.4, 58.2, p.y + 0.4, 0.95, 3);
  deco('lamp', 58.3);
  gap(1.5); p = plat(4.8, 'fence');                // 62.4 – 67.2
  block(p, 2.1, 0.55, 0.55, 'crate');
  fish(64.78, p.y + 0.55 + 0.4);
  gap(1.8, -0.2); p = plat(15.0, 'wall');          // 69 – 84
  deco('lamp', 69.8);
  checkpoint(75.2);
  deco('lamp', 80.4);

  // ── II · Lantern Alley ───────────────────────────────────────────────
  // Tiled eaves under strings of paper lanterns. Awnings bounce, wires hold,
  // and low lanterns punish a jump that is too eager.
  // An awning sits just past a ledge so that simply running off the edge lands
  // on it and the bounce carries the cat up onto the next roof.
  section('lantern', 'II', 'Lantern Alley', 3.7);
  oneway(84.4, 85.9, 2.15, 'awning', true);
  fishArc(84.9, 2.8, 86.9, 4.45, 1.0, 3);
  jumpTo(86.3, 4.0); p = plat(12, 'eave');         // 86.3 – 98.3
  ceil(89.7, 1.5, p.y + 0.64, 0.5, 'lanterns');
  block(p, 6.8, 0.42, 0.36, 'barrel');
  ceil(92.3, 2.0, p.y + 1.32, 0.5, 'lanterns');
  fish(93.31, p.y + 0.8);
  gap(1.6); p = plat(8.4, 'eave');                 // 99.9 – 108.3
  ceil(98.1, 1.6, p.y + 1.36, 0.62, 'sign');
  fishArc(97.7, p.y + 0.35, 100.5, p.y + 0.35, 0.5, 3);
  block(p, 2.2, 1.6, 0.38, 'kanban', p.y + 0.74);
  fishRow(102.4, 103.4, p.y + 1.12 + 0.34, 3);
  oneway(108.3, 111.9, 3.85, 'wire');
  oneway(113.1, 116.5, 4.1, 'wire');
  fishRow(108.9, 111.1, 4.2, 3);
  fishArc(111.5, 4.25, 113.7, 4.5, 0.6, 3);
  jumpTo(116.5, 4.1); p = plat(6.0, 'eave');       // 116.5 – 122.5
  oneway(122.9, 124.4, 3.4, 'awning', true);
  fishArc(123.5, 4.2, 125.5, 5.6, 1.0, 3);
  jumpTo(125.3, 5.2); p = plat(8.6, 'balcony');    // 125.3 – 133.9
  ceil(127.5, 1.9, p.y + 0.62, 0.35, 'laundry');
  block(p, 6.4, 0.32, 0.3, 'pot');
  ceil(131.1, 1.8, p.y + 1.32, 0.35, 'laundry');
  fish(131.86, p.y + 0.78);
  gap(1.8, -0.6); p = plat(10.5, 'eave');          // 135.7 – 146.2
  fishArc(133.5, 5.2 + 0.35, 136.7, p.y + 0.35, 0.8, 3);
  ceil(139.1, 1.4, p.y + 0.66, 0.5, 'lanterns');
  fishRow(142.1, 144.5, p.y + 0.3, 3);
  gap(1.6); p = plat(14.3, 'eave');                // 147.8 – 162.1
  fishArc(145.7, p.y + 0.35, 148.7, p.y + 0.35, 0.8, 3);
  checkpoint(153.8);

  // ── III · Neon Heights ───────────────────────────────────────────────
  // Up the fire escape onto concrete roofs: air-con units, a water tank, a
  // billboard to leap onto, and steam vents that only scald laggards.
  section('neon', 'III', 'Neon Heights', 4.0);
  oneway(163.2, 164.8, 5.45, 'landing');
  oneway(166.0, 167.6, 6.1, 'landing');
  fishArc(162.2, 5.2, 165.2, 5.85, 0.7, 3);
  jumpTo(168.8, 6.75); p = plat(13.2, 'parapet');  // 168.8 – 182
  block(p, 3.0, 0.9, 0.55, 'ac');
  fish(172.25, p.y + 1.15);
  vent(p, 6.6);
  block(p, 9.6, 0.9, 0.55, 'ac');
  fish(178.85, p.y + 1.15);
  gap(2.0); p = plat(9.6, 'parapet');              // 184 – 193.6
  fishArc(181.4, p.y + 0.4, 184.8, p.y + 0.4, 1.1, 3);
  block(p, 3.2, 1.6, 0.95, 'tank');
  fishRow(187.4, 188.6, p.y + 0.95 + 0.35, 2);
  oneway(195.4, 199.6, 7.65, 'billboard');
  fishRow(196.2, 198.8, 7.65 + 0.35, 3);
  jumpTo(201.4, 7.3); p = plat(9.2, 'parapet');    // 201.4 – 210.6
  vent(p, 3.2);
  vent(p, 5.9);
  gap(1.8, 0.6); p = plat(8.6, 'parapet');         // 212.4 – 221
  fishArc(210.2, 7.3 + 0.4, 213.2, p.y + 0.4, 0.9, 3);
  block(p, 2.4, 1.0, 0.6, 'ac');
  fish(215.3, p.y + 1.2);
  ceil(217.6, 2.2, p.y + 0.66, 0.4, 'pipe');
  gap(1.7, 0.5); p = plat(7.0, 'parapet');         // 222.7 – 229.7
  fishArc(220.4, 7.9 + 0.4, 223.6, p.y + 0.4, 1.0, 3);
  gap(2.1); p = plat(12.0, 'parapet');             // 231.8 – 243.8
  fishArc(229.4, p.y + 0.4, 232.6, p.y + 0.4, 1.2, 3);
  checkpoint(237.0);

  // ── IV · Moonrise ────────────────────────────────────────────────────
  // Old stone roofs climbing toward the moon, a long power line, one last leap.
  section('moon', 'IV', 'Moonrise', 4.2);
  gap(1.6, 0.6); p = plat(5.0, 'stone');           // 245.4 – 250.4
  fishArc(243.4, 8.4 + 0.4, 246.4, p.y + 0.4, 0.9, 3);
  gap(1.6, 0.6); p = plat(5.0, 'stone');           // 252 – 257
  fishArc(250.0, 9.0 + 0.4, 253.0, p.y + 0.4, 0.9, 3);
  oneway(257.0, 265.0, 9.5, 'wire');
  fishRow(258.5, 263.5, 9.85, 4);
  deco('birds', 260.5, { y: 9.5 });
  jumpTo(265.0, 9.9); p = plat(6.0, 'stone');      // 265 – 271
  fishArc(263.6, 9.5 + 0.4, 266.2, p.y + 0.4, 0.8, 3);
  gap(1.8, 0.5); p = plat(3.0, 'stone');           // 272.8 – 275.8
  fishArc(270.6, 9.9 + 0.4, 273.6, p.y + 0.4, 1.0, 3);
  gap(2.2, 0.3); p = plat(16.0, 'tower');          // 278 – 294
  fishArc(275.4, 10.4 + 0.4, 278.8, p.y + 0.4, 1.25, 3);
  S.goal = { x: 281.2, sitX: 285.2 };

  return finalize(S);
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function finalize(S) {
  S.length = Math.max(...S.plats.map((p) => p.x1)) + 6;
  S.goal.y = groundAtRaw(S, S.goal.x);

  // Height of the catwalk everywhere (gaps interpolated), smoothed for the camera.
  const n = Math.ceil(S.length / PATH_RES) + 1;
  const raw = new Float32Array(n).fill(NaN);
  const surfaces = [
    ...S.plats.map((p) => ({ x0: p.x0, x1: p.x1, y: p.y })),
    ...S.oneways.filter((o) => !o.bouncy).map((o) => ({ x0: o.x0, x1: o.x1, y: o.y })),
  ];
  for (let i = 0; i < n; i++) {
    const x = i * PATH_RES;
    let y = NaN;
    for (const s of surfaces) if (x >= s.x0 && x <= s.x1) y = Number.isNaN(y) ? s.y : Math.max(y, s.y);
    raw[i] = y;
  }
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(raw[i])) {
      if (last >= 0 && i - last > 1) {
        for (let k = last + 1; k < i; k++) raw[k] = raw[last] + (raw[i] - raw[last]) * ((k - last) / (i - last));
      } else if (last < 0) {
        for (let k = 0; k < i; k++) raw[k] = raw[i];
      }
      last = i;
    }
  }
  for (let k = last + 1; k < n; k++) raw[k] = raw[last];
  const sigma = 2.6 / PATH_RES;
  const rad = Math.ceil(sigma * 3);
  const kernel = [];
  let ksum = 0;
  for (let k = -rad; k <= rad; k++) { const w = Math.exp(-(k * k) / (2 * sigma * sigma)); kernel.push(w); ksum += w; }
  const smooth = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -rad; k <= rad; k++) acc += raw[Math.min(n - 1, Math.max(0, i + k))] * kernel[k + rad];
    smooth[i] = acc / ksum;
  }
  S.pathRaw = raw;
  S.pathSmooth = smooth;

  S.pathY = (x) => {
    const f = Math.min(n - 1.001, Math.max(0, x / PATH_RES));
    const i = Math.floor(f);
    return smooth[i] + (smooth[i + 1] - smooth[i]) * (f - i);
  };
  S.groundAt = (x) => groundAtRaw(S, x);
  S.sectionIndex = (x) => {
    let k = 0;
    for (let i = 0; i < S.sections.length; i++) if (x >= S.sections[i].x0) k = i;
    return k;
  };
  S.speedAt = (x) => {
    const i = S.sectionIndex(x);
    const sec = S.sections[i];
    if (i === 0) return sec.speed;
    return S.sections[i - 1].speed + (sec.speed - S.sections[i - 1].speed) * smoothstep(sec.x0, sec.x0 + 12, x);
  };
  // 0 at the start, 1 in the finale: blends the palettes of neighbouring sections.
  S.sectionBlend = (x) => {
    let v = 0;
    for (let i = 1; i < S.sections.length; i++) v += smoothstep(S.sections[i].x0 - 8, S.sections[i].x0 + 8, x);
    return v;
  };
  return S;
}

function groundAtRaw(S, x) {
  let y = -Infinity;
  for (const p of S.plats) if (x >= p.x0 && x <= p.x1) y = Math.max(y, p.y);
  if (y === -Infinity) for (const o of S.oneways) if (x >= o.x0 && x <= o.x1) y = Math.max(y, o.y);
  return y;
}

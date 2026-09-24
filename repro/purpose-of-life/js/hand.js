'use strict';
// A small single-stroke handwriting font, so every caption is actually written on screen, stroke by stroke.
// Glyph units: baseline y = 0, x-height 10, ascenders 15, descenders -6 (y points up).
// O cx cy rx ry a0 a1 is an elliptical arc in degrees (counter-clockwise when a1 > a0).

const GLYPH_SRC = {
  a: [9.6, 'O 4.2 5 4.2 5 25 385 | M 8.6 9.6 L 8.6 1 Q 8.7 -0.2 9.8 0.2'],
  b: [9.2, 'M 0.6 15 L 0.6 0.4 | O 4.6 5 4 5 165 -165'],
  c: [8.6, 'O 4.4 5 4.2 5 40 322'],
  d: [9.8, 'O 4.2 5 4.2 5 25 385 | M 8.6 15 L 8.6 1 Q 8.7 -0.2 9.8 0.2'],
  e: [8.8, 'M 0.4 5 L 8.4 5 O 4.4 5 4 5 0 320'],
  f: [6.4, 'M 6.6 13.6 Q 5.6 15.4 4.2 15 Q 2.6 14.6 2.6 12.4 L 2.6 0 | M 0.2 9.6 L 5.8 9.6'],
  g: [9.4, 'O 4.2 5 4.2 5 25 385 | M 8.6 9.6 L 8.6 -2.6 Q 8.4 -6.2 4.6 -6.2 Q 2 -6.2 0.8 -4.6'],
  h: [9.2, 'M 0.6 15 L 0.6 0 | M 0.6 6.2 Q 1.6 10 4.6 10 Q 8.4 10 8.4 6 L 8.4 0'],
  i: [3.4, 'M 1.4 9.6 L 1.4 0 | M 1.4 13.5 L 1.5 13.3'],
  j: [5, 'M 3.4 9.6 L 3.4 -3 Q 3.2 -6.2 0.8 -6 Q -0.6 -5.8 -1.2 -4.8 | M 3.4 13.5 L 3.5 13.3'],
  k: [8.4, 'M 0.6 15 L 0.6 0 | M 7.4 10 L 0.9 4.6 | M 3 6.2 L 7.8 0'],
  l: [3.8, 'M 1.2 15 L 1.2 1.2 Q 1.3 -0.1 2.9 0.3'],
  m: [13.4, 'M 0.6 10 L 0.6 0 | M 0.6 6.6 Q 1.4 10 3.8 10 Q 6.6 10 6.6 6.4 L 6.6 0 | M 6.6 6.6 Q 7.4 10 9.8 10 Q 12.6 10 12.6 6.4 L 12.6 0'],
  n: [9.2, 'M 0.6 10 L 0.6 0 | M 0.6 6.4 Q 1.6 10 4.6 10 Q 8.4 10 8.4 6 L 8.4 0'],
  o: [9.4, 'O 4.6 5 4.4 5 100 460'],
  p: [9.2, 'M 0.6 10 L 0.6 -6 | O 4.6 5 4 5 165 -165'],
  q: [9.8, 'O 4.2 5 4.2 5 25 385 | M 8.6 9.6 L 8.6 -6 Q 8.8 -6.6 10 -5.8'],
  r: [6.6, 'M 0.6 10 L 0.6 0 | M 0.6 6 Q 1.8 9.8 4.2 10 Q 5.6 10.1 6.4 9.2'],
  s: [8, 'M 7.2 8.6 Q 6.2 10.3 3.9 10.2 Q 0.9 10.1 0.9 7.6 Q 0.9 5.6 4 5 Q 7.4 4.3 7.4 2.4 Q 7.3 -0.1 4 -0.1 Q 1.4 -0.1 0.3 1.8'],
  t: [7, 'M 3 14 L 3 1.6 Q 3.1 -0.1 4.6 -0.1 Q 5.6 -0.1 6.4 0.6 | M 0.2 9.8 L 6.4 9.8'],
  u: [9.4, 'M 0.6 10 L 0.6 3.6 Q 0.7 -0.1 4.2 -0.1 Q 8.2 0 8.4 4 | M 8.4 10 L 8.4 0'],
  v: [8.6, 'M 0.2 10 L 4.3 0 L 8.4 10'],
  w: [12, 'M 0.2 10 L 3 0 L 6 8 L 9 0 L 11.8 10'],
  x: [8.2, 'M 0.4 10 L 7.8 0 | M 7.8 10 L 0.4 0'],
  y: [8.8, 'M 0.2 10 L 4.4 0.4 | M 8.6 10 L 3.8 -3 Q 2.8 -6 0.4 -5.8'],
  z: [8.4, 'M 0.6 10 L 7.8 10 L 0.4 0 L 7.9 0'],
  I: [5.6, 'M 0.4 15 L 5.2 15 | M 2.8 15 L 2.8 0 | M 0.4 0 L 5.2 0'],
  M: [13, 'M 0.4 0 L 1 15 L 6.5 5 L 12 15 L 12.6 0'],
  W: [15, 'M 0.2 15 L 3.8 0 L 7.5 11 L 11.2 0 L 14.8 15'],
  T: [11, 'M 0 15 L 11 15 | M 5.5 15 L 5.5 0'],
  '?': [8.6, 'M 0.6 11 Q 0.8 15.4 4.4 15.4 Q 8.2 15.4 8.2 11.6 Q 8.2 9 5.6 7.6 Q 4.2 6.8 4.2 4.8 L 4.2 3.8 | M 4.2 0.5 L 4.3 0.3'],
  '.': [3, 'M 1.2 0.5 L 1.3 0.3'],
  ',': [3, 'M 1.6 0.6 L 0.6 -2.6'],
  "'": [2.8, 'M 1.4 15 L 1 11'],
  '!': [3.4, 'M 1.6 15 L 1.6 4 | M 1.6 0.5 L 1.7 0.3'],
  '-': [6, 'M 0.6 5 L 5.4 5'],
  ' ': [4.6, ''],
};

function parseGlyph(d) {
  return d.split('|').map((s) => s.trim()).filter(Boolean).map((s) => {
    const tk = s.split(/[\s,]+/).filter(Boolean);
    const pts = [];
    let i = 0, cx = 0, cy = 0;
    const num = () => parseFloat(tk[i++]);
    while (i < tk.length) {
      const c = tk[i++];
      if (c === 'M') {
        cx = num(); cy = num();
        pts.push([cx, cy]);
      } else if (c === 'L') {
        const x = num(), y = num(), k = Math.max(1, Math.ceil(Math.hypot(x - cx, y - cy) / 0.7));
        for (let j = 1; j <= k; j++) pts.push([cx + ((x - cx) * j) / k, cy + ((y - cy) * j) / k]);
        cx = x; cy = y;
      } else if (c === 'Q') {
        const qx = num(), qy = num(), x = num(), y = num();
        for (let j = 1; j <= 14; j++) {
          const t = j / 14, u = 1 - t;
          pts.push([u * u * cx + 2 * u * t * qx + t * t * x, u * u * cy + 2 * u * t * qy + t * t * y]);
        }
        cx = x; cy = y;
      } else if (c === 'O') {
        const ox = num(), oy = num(), rx = num(), ry = num(), a0 = num(), a1 = num();
        const k = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 7));
        for (let j = 0; j <= k; j++) {
          const a = ((a0 + ((a1 - a0) * j) / k) * Math.PI) / 180;
          pts.push([ox + rx * Math.cos(a), oy + ry * Math.sin(a)]);
        }
        [cx, cy] = pts[pts.length - 1];
      }
    }
    return pts;
  });
}

const GLYPHS = {};
for (const ch in GLYPH_SRC) GLYPHS[ch] = { w: GLYPH_SRC[ch][0], strokes: parseGlyph(GLYPH_SRC[ch][1]) };

class Hand {
  constructor(text, cap = 48, o = {}) {
    this.text = text;
    this.cap = cap;
    const u = (this.u = cap / 15), r = rng(o.seed || 11);
    const slant = o.slant === undefined ? 0.13 : o.slant, track = o.track === undefined ? 1.9 : o.track;
    this.strokes = [];
    let x = 0;
    for (const ch of text) {
      const g = GLYPHS[ch] || GLYPHS[' '];
      const rot = (r() - 0.5) * 0.09, sc = 0.94 + r() * 0.12, dy = (r() - 0.5) * 0.9, mid = g.w / 2;
      const c = Math.cos(rot), s = Math.sin(rot);
      for (const st of g.strokes) {
        this.strokes.push({
          pts: st.map(([gx, gy]) => {
            const px = (gx - mid) * sc, py = (gy - 5) * sc;
            const qx = px * c - py * s + mid, qy = px * s + py * c + 5 + dy;
            return [(x + qx + qy * slant) * u, -qy * u];
          }),
        });
      }
      x += g.w + track;
    }
    this.width = Math.max(0, x - track) * u;
    // pen timing: stroke length plus a little travel time between strokes
    let acc = 0, prev = null;
    for (const st of this.strokes) {
      const p = st.pts;
      if (prev) acc += Math.hypot(p[0][0] - prev[0], p[0][1] - prev[1]) * 0.3 + 3.5 * u;
      st.cum = [0];
      for (let i = 1; i < p.length; i++) st.cum.push(st.cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
      st.len = st.cum[st.cum.length - 1];
      st.a = acc;
      acc += Math.max(st.len, 1.2 * u);
      st.b = acc;
      prev = p[p.length - 1];
    }
    this.total = acc || 1;
  }
  times() {
    return this.strokes.map((s) => [s.a / this.total, s.b / this.total]);
  }
  draw(ctx, x, y, p = 1, o = {}) {
    if (p <= 0) return;
    const lim = p * this.total, u = this.u;
    const amp = (o.jit === undefined ? 0.16 : o.jit) * u, seed = BOIL * 977 + (o.seed || 0);
    ctx.save();
    ctx.translate(x - this.width * (o.align || 0), y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = o.col || PAL.ink;
    ctx.lineWidth = (o.w || 1) * u * 1.45;
    ctx.globalAlpha *= o.alpha === undefined ? 0.94 : o.alpha;
    for (let k = 0; k < this.strokes.length; k++) {
      const st = this.strokes[k];
      if (st.a >= lim) break;
      const L = Math.min(1, (lim - st.a) / (st.b - st.a)) * st.len;
      ctx.beginPath();
      for (let i = 0; i < st.pts.length; i++) {
        let [px, py] = st.pts[i];
        const cut = i > 0 && st.cum[i] > L;
        if (cut) {
          const [qx, qy] = st.pts[i - 1], t = (L - st.cum[i - 1]) / (st.cum[i] - st.cum[i - 1] || 1);
          px = qx + (px - qx) * t;
          py = qy + (py - qy) * t;
        }
        px += vnoise(i * 0.22 + k * 5.3, seed) * amp;
        py += vnoise(i * 0.22 + k * 3.1 + 40, seed) * amp;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        if (cut) break;
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

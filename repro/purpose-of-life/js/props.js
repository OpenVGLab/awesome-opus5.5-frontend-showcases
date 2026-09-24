'use strict';
// Reusable collage props: note-paper captions, the big question mark, clouds, ransom-note words,
// and small composite cut-outs built from layered paper.

const WRITES = [];   // every handwritten line with its timing (the score turns these into pen sounds)

function bgFill(ctx, view, fill) {
  fillWith(ctx, fill, null);
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
}

// A strip of lined notebook paper, taped on, that the caption gets written onto.
class Caption {
  constructor(lines, o) {
    this.o = o;
    const cap = (this.cap = o.cap || 46);
    this.lines = lines.map((l, i) => Object.assign({}, l, { hand: new Hand(l.text, cap, { seed: (o.seed || 5) + i * 17 }) }));
    const lh = (this.lh = cap * 1.72), padX = cap * 0.95, padY = cap * 0.55;
    const wmax = Math.max(...this.lines.map((l) => l.hand.width));
    this.w = wmax + padX * 2;
    this.h = padY * 2 + cap * 1.45 + (this.lines.length - 1) * lh;
    this.piece = P.rect(this.w, this.h, { cut: 1.2, torn: 3.4, rim: 2.8, edges: [1, 0, 1, 0], seed: (o.seed || 5) * 13 + 7 });
    this.lines.forEach((l, i) => {
      l.x = o.center ? 0 : -this.w / 2 + padX;
      l.align = o.center ? 0.5 : 0;
      l.y = -this.h / 2 + padY + cap * 1.12 + i * lh;
    });
    for (const l of this.lines) WRITES.push({ hand: l.hand, t0: l.write[0], t1: l.write[1] });
  }
  draw(ctx, t) {
    const o = this.o;
    if (t < o.tIn || (o.tOut && t > o.tOut + 0.45)) return;
    const a = E.back(prog(t, o.tIn, o.tIn + 0.4));
    const out = o.tOut ? E.in(prog(t, o.tOut, o.tOut + 0.45)) : 0;
    ctx.save();
    ctx.translate(o.x + out * 80, lerp(o.y - 170, o.y, a) - out * 520);
    ctx.rotate(o.rot + (1 - a) * 0.14 + out * 0.35);
    this.piece.draw(ctx, 'paper', { shadow: 1.3 });
    ctx.save();
    this.piece.clip(ctx);
    ctx.strokeStyle = 'rgba(86,140,200,0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const base = this.lines[0].y + this.cap * 0.16;
    for (let y = base - this.lh; y < this.h / 2 + 4; y += this.lh) { ctx.moveTo(-this.w / 2, y); ctx.lineTo(this.w / 2, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(214,82,82,0.38)';
    ctx.beginPath();
    ctx.moveTo(-this.w / 2 + this.cap * 0.5, -this.h / 2);
    ctx.lineTo(-this.w / 2 + this.cap * 0.5, this.h / 2);
    ctx.stroke();
    ctx.restore();
    for (const l of this.lines) l.hand.draw(ctx, l.x, l.y, prog(t, l.write[0], l.write[1]), { align: l.align });
    if (o.strike && t > o.strike[0]) {
      const l = this.lines[0], x0 = l.x - l.hand.width * l.align - 10, w = l.hand.width + 20;
      const pts = [];
      for (let i = 0; i <= 13; i++) pts.push([x0 + (w * i) / 13, l.y - this.cap * 0.42 + (i % 2 ? -1 : 1) * this.cap * 0.36]);
      crayon(ctx, upto(pts, prog(t, o.strike[0], o.strike[1])), this.cap * 0.16, '#d8342a', 77, 1.4);
    }
    if (t > o.tIn + 0.28) {
      tape(ctx, -this.w / 2 + 24, -this.h / 2 + 5, -0.62, 1, 0);
      tape(ctx, this.w / 2 - 24, -this.h / 2 + 5, 0.58, 1, 1);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- the question mark

function qCenterline() {
  const pts = [], cy = -110, R = 95;
  for (let a = 165; a <= 400; a += 5) {
    const r = (a * Math.PI) / 180;
    pts.push([R * Math.cos(r), cy + R * Math.sin(r)]);
  }
  const [ex, ey] = pts[pts.length - 1];
  for (let i = 1; i <= 10; i++) {
    const t = i / 10, u = 1 - t;
    pts.push([u * u * ex + 2 * u * t * 20 + t * t * 6, u * u * ey + 2 * u * t * -12 + t * t * 38]);
  }
  for (let i = 1; i <= 4; i++) pts.push([6 - i * 0.4, 38 + i * 14]);
  return pts;
}

const QM = {};
function buildQMark() {
  QM.line = qCenterline();
  QM.body = P.stroke(QM.line, 30, { cut: 1.3, torn: 2.4, rim: 3, seed: 7001 });
  QM.dot = P.circleAt(4, 172, 33, { cut: 1.2, torn: 2.2, rim: 3, seed: 7002 });
}

function drawQMark(ctx, x, y, s, rot, fill, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s * (o.mirror ? -1 : 1) * (o.sx || 1), s * (o.sy || 1));
  QM.body.draw(ctx, fill, { shadow: 1.4 });
  const ds = o.dotS === undefined ? 1 : o.dotS;
  if (ds > 0) {
    ctx.save();
    ctx.translate(4, 172);
    ctx.scale(ds, ds);
    ctx.translate(-4, -172);
    QM.dot.draw(ctx, fill, { shadow: 1.4 });
    ctx.restore();
  }
  if (o.tapes) for (const [tx, ty, tr] of o.tapes) tape(ctx, tx, ty, tr, 1, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- clouds, hills, moon

function cloudPts(w, h, seed) {
  const r = rng(seed), n = 4 + ((r() * 2) | 0), bw = w / n, pts = [[-w / 2, 0], [w / 2, 0]];
  for (let i = 0; i < n; i++) {
    const cx = w / 2 - bw * (i + 0.5), edge = i === 0 || i === n - 1;
    const hb = h * (0.6 + r() * 0.4) * (edge ? 0.62 : 1), rw = bw * (0.6 + r() * 0.08);
    for (let k = 0; k <= 9; k++) {
      const a = (k / 9) * Math.PI;
      pts.push([cx + Math.cos(a) * rw, -Math.sin(a) * hb]);
    }
  }
  return pts;
}

function hillPts(x0, x1, y, amp, seed, bottom = 1900, n = 26) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    pts.push([x, y - amp * (0.5 + 0.5 * Math.sin(i * 0.85 + seed)) - amp * 0.35 * vnoise(i * 0.7, seed)]);
  }
  pts.push([x1, bottom], [x0, bottom]);
  return pts;
}

// outer circle (0,0,R) minus an inner circle (dx,dy,r)
function crescentPts(R, r, dx, dy, n = 40) {
  const d = Math.hypot(dx, dy), a = (R * R - r * r + d * d) / (2 * d), h = Math.sqrt(Math.max(0, R * R - a * a));
  const bx = (a * dx) / d, by = (a * dy) / d;
  const i1 = [bx - (h * dy) / d, by + (h * dx) / d], i2 = [bx + (h * dy) / d, by - (h * dx) / d];
  const arc = (c, rad, p0, p1, keep) => {
    let a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]), a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
    let da = a1 - a0;
    while (da < 0) da += TAU;
    const mid = a0 + da / 2;
    if (!keep([c[0] + Math.cos(mid) * rad, c[1] + Math.sin(mid) * rad])) da -= TAU;
    const out = [];
    for (let k = 0; k <= n; k++) { const t = a0 + (da * k) / n; out.push([c[0] + Math.cos(t) * rad, c[1] + Math.sin(t) * rad]); }
    return out;
  };
  const outer = arc([0, 0], R, i1, i2, (p) => Math.hypot(p[0] - dx, p[1] - dy) > r);
  const inner = arc([dx, dy], r, i2, i1, (p) => Math.hypot(p[0], p[1]) < R);
  return outer.concat(inner.slice(1, -1));
}

// ---------------------------------------------------------------- ransom-note words

const RANSOM_FONTS = [
  '900 {s}px "Arial Black", "Helvetica Neue", Arial, "Liberation Sans", sans-serif',
  'bold {s}px Georgia, "DejaVu Serif", serif',
  'italic bold {s}px "Times New Roman", Times, "Liberation Serif", serif',
  'bold {s}px "Courier New", Courier, "Liberation Mono", monospace',
  '900 {s}px Impact, "Arial Narrow", "DejaVu Sans Condensed", sans-serif',
  'bold {s}px Verdana, "DejaVu Sans", sans-serif',
  '{s}px "Trebuchet MS", "Liberation Sans", sans-serif',
  'bold italic {s}px Georgia, "DejaVu Serif", serif',
];
const RANSOM_BG = [['paper', PAL.ink], ['news', PAL.ink], ['mustard', PAL.ink], ['navy', PAL.paper], ['coral', PAL.paper],
  ['teal', PAL.paper], ['pink', PAL.ink], ['red', PAL.paper], ['white', PAL.red], ['lilac', PAL.ink], ['sky', PAL.navy]];

const measureCtx = mkCanvas(8, 8).getContext('2d');
function makeWord(word, size, seed) {
  const r = rng(seed), tiles = [];
  let x = 0, lastBg = -1;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i], fs = size * (0.78 + r() * 0.36);
    const font = RANSOM_FONTS[(r() * RANSOM_FONTS.length) | 0].replace('{s}', fs.toFixed(0));
    measureCtx.font = font;
    const w = measureCtx.measureText(ch).width + fs * 0.34, h = fs * 1.14;
    let bi = (r() * RANSOM_BG.length) | 0;
    if (bi === lastBg) bi = (bi + 3) % RANSOM_BG.length;
    lastBg = bi;
    tiles.push({
      ch, font, w, h, bg: RANSOM_BG[bi][0], fg: RANSOM_BG[bi][1],
      piece: P.rect(w, h, { cut: 1.1, step: 9, seed: seed * 31 + i * 7 }),
      x: x + w / 2, y: (r() - 0.5) * size * 0.18, rot: (r() - 0.5) * 0.24,
    });
    x += w + size * 0.05;
  }
  const total = x - size * 0.05;
  for (const tl of tiles) tl.x -= total / 2;
  return { tiles, w: total, size };
}

function drawTile(ctx, tl) {
  tl.piece.draw(ctx, tl.bg, { shadow: 0.8 });
  ctx.fillStyle = tl.fg;
  ctx.font = tl.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tl.ch, 0, tl.h * 0.05);
}

function drawWord(ctx, word, x, y, s, t0, t, gap = 0.07) {
  for (let i = 0; i < word.tiles.length; i++) {
    const tl = word.tiles[i], ti = t0 + i * gap;
    if (t < ti) continue;
    const a = E.out(prog(t, ti, ti + 0.12)), k = lerp(1.8, 1, a);
    ctx.save();
    ctx.translate(x + tl.x * s, y + tl.y * s);
    ctx.rotate(tl.rot + (1 - a) * 0.5);
    ctx.scale(s * k, s * k);
    drawTile(ctx, tl);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- layered cut-outs

// layers: { rect:[x,y,w,h] | circ:[x,y,r] | poly:[...] | svg:'...' , f: fill, sh: shadow, ink }
//         { line:[[x,y]...], w, c }   { text, tx, ty, font, c }
function comp(layers) {
  return layers.map((L) => {
    const o = Object.assign({ seed: (pieceSeed += 13) }, L.o || {});
    let piece = null;
    if (L.rect) piece = P.box(L.rect[0], L.rect[1], L.rect[2], L.rect[3], o);
    else if (L.circ) piece = P.circleAt(L.circ[0], L.circ[1], L.circ[2], o);
    else if (L.poly) piece = P.poly(L.poly, o);
    else if (L.svg) piece = P.svg(L.svg, o);
    return Object.assign({}, L, { piece, seed: o.seed });
  });
}

function drawComp(ctx, layers) {
  for (const L of layers) {
    if (L.piece) L.piece.draw(ctx, L.f, { shadow: L.sh === undefined ? 0.6 : L.sh, ink: L.ink });
    else if (L.line) inkLine(ctx, L.line, L.w || 3, L.c || PAL.ink, L.seed, 0.7);
    else if (L.text) {
      ctx.fillStyle = L.c || PAL.ink;
      ctx.font = L.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(L.text, L.tx, L.ty);
    }
  }
}

function at(ctx, x, y, rot, s, fn) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (s !== 1) ctx.scale(s, s);
  fn();
  ctx.restore();
}

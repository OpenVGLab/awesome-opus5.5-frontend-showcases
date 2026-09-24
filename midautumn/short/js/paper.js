'use strict';
// Paper: fibre grain, torn and scissor-cut outlines, baked collage sprites, halftone and print offsets.
(function () {
  const MA = window.MA;
  const { rng, hash, fbm1, makeCanvas } = MA;
  const P = (MA.paper = {});

  // Tileable value noise on an n x n lattice.
  function tileNoise(x, y, cells, size, seed) {
    const s = size / cells;
    const gx = x / s, gy = y / s;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = gx - ix, fy = gy - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const w = (v) => ((v % cells) + cells) % cells;
    const a = hash(w(ix), w(iy), seed), b = hash(w(ix + 1), w(iy), seed);
    const c = hash(w(ix), w(iy + 1), seed), d = hash(w(ix + 1), w(iy + 1), seed);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  // Semi-transparent light/dark speckle + fibres, laid over flat colour with source-atop or plain alpha.
  function makeGrain(size, seed, opt) {
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    const d = img.data;
    const R = rng(seed);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const m = tileNoise(x, y, 8, size, seed) * 0.6 + tileNoise(x, y, 32, size, seed + 1) * 0.4;
        let v = (R() - 0.5) * opt.fine + (m - 0.5) * opt.mottle;
        if (R() < opt.speck) v -= 0.9;
        if (v > 0) { d[i] = 255; d[i + 1] = 250; d[i + 2] = 238; d[i + 3] = Math.min(255, v * opt.light); }
        else { d[i] = 38; d[i + 1] = 28; d[i + 2] = 22; d[i + 3] = Math.min(255, -v * opt.dark); }
      }
    }
    g.putImageData(img, 0, 0);
    // Fibres: short curved hairs, drawn wrapped so the tile stays seamless.
    for (let k = 0; k < opt.fibres; k++) {
      const x = R() * size, y = R() * size, a = R() * Math.PI * 2, L = 6 + R() * 26;
      const light = R() < 0.62;
      g.strokeStyle = light ? `rgba(255,251,240,${(0.06 + R() * 0.14) * (opt.fa || 1)})` : `rgba(60,42,30,${(0.05 + R() * 0.1) * (opt.fa || 1)})`;
      g.lineWidth = 0.4 + R() * 0.9;
      const bx = Math.cos(a + (R() - 0.5)) * L * 0.5, by = Math.sin(a + (R() - 0.5)) * L * 0.5;
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          g.beginPath();
          g.moveTo(x + ox, y + oy);
          g.quadraticCurveTo(x + ox + bx, y + oy + by, x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L);
          g.stroke();
        }
      }
    }
    return c;
  }

  const patCache = new WeakMap();
  P.pattern = function (ctx, which = 'grain') {
    let m = patCache.get(ctx);
    if (!m) { m = {}; patCache.set(ctx, m); }
    if (!m[which]) m[which] = ctx.createPattern(P[which], 'repeat');
    return m[which];
  };

  P.init = function () {
    if (P.grain) return;
    P.grain = makeGrain(512, 11, { fine: 0.55, mottle: 0.8, speck: 0.0012, light: 64, dark: 72, fibres: 160, fa: 0.8 });
    P.frameGrain = makeGrain(512, 23, { fine: 0.9, mottle: 0.45, speck: 0.0015, light: 36, dark: 48, fibres: 50, fa: 0.6 });
    // Rice paper: longer, sparser fibres for the calligraphy scroll.
    P.riceGrain = makeGrain(512, 37, { fine: 0.3, mottle: 0.45, speck: 0.0006, light: 50, dark: 34, fibres: 520, fa: 0.9 });
    // Ink speckle mask: where a screen-printed ink layer failed to take.
    const s = 256;
    P.speckle = makeCanvas(s, s);
    const g = P.speckle.getContext('2d');
    const R = rng(91);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(0,0,0,${0.35 + R() * 0.65})`;
      const r = 0.4 + R() * R() * 2.2;
      const x = R() * s, y = R() * s;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        g.beginPath(); g.arc(x + ox, y + oy, r, 0, 6.2832); g.fill();
      }
    }
  };

  // ---------- outlines ----------
  P.circle = function (cx, cy, r, n = 0, rx = r) {
    n = n || Math.max(24, Math.round(r * 0.7));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * r]);
    }
    return pts;
  };
  P.rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

  function signedArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }

  // Resample a closed polygon and push every point along its outward normal by fractal noise.
  // amp: tear depth; inset: pulls the outline inward (used for the coloured layer above the white fibre core).
  P.tear = function (pts, o = {}) {
    const amp = o.amp ?? 4, freq = o.freq ?? 0.05, step = o.step ?? 3, seed = o.seed ?? 1;
    const inset = o.inset ?? 0, insetVar = o.insetVar ?? 0, jag = o.jag ?? 0.35;
    const cw = signedArea(pts) > 0 ? 1 : -1;
    const out = [];
    let s = 0;
    const closed = o.open ? pts.length - 1 : pts.length;
    for (let i = 0; i < closed; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = (dy / len) * cw, ny = (-dx / len) * cw;
      const n = Math.max(1, Math.ceil(len / step));
      const skip = o.straight && o.straight(i);
      for (let j = 0; j < n; j++) {
        const f = j / n;
        let d = 0;
        if (!skip) {
          d = fbm1(s * freq, seed, 4) * amp + (hash(Math.floor(s), seed, 5) - 0.5) * amp * jag;
          d -= inset + insetVar * (fbm1(s * 0.013, seed + 9, 2) * 0.5 + 0.5);
        } else {
          d = -inset * 0.3 + (hash(Math.floor(s), seed, 5) - 0.5) * 0.5;
        }
        out.push([a[0] + dx * f + nx * d, a[1] + dy * f + ny * d]);
        s += len / n;
      }
    }
    if (o.open) out.push(pts[pts.length - 1].slice());
    return out;
  };

  // Scissor cut: tiny facets and wobble instead of fibres.
  P.cut = function (pts, o = {}) {
    return P.tear(pts, { amp: o.amp ?? 0.9, freq: 0.02, step: o.step ?? 7, seed: o.seed ?? 3, jag: 0.15 });
  };

  P.toPath = function (pts) {
    const p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    p.closePath();
    return p;
  };
  P.bounds = function (list) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const pts of list) for (const p of pts) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    return { x0, y0, x1, y1 };
  };

  // ---------- sprites ----------
  // A baked collage piece. Local origin (0,0) maps to (ox, oy) inside the canvas.
  //  pts     polygon (local coords) or path: Path2D with explicit bounds [x0,y0,x1,y1]
  //  torn    {amp, freq, seed, edge: fibre colour, edgeW} -> white fibre core showing at the tear
  //  cut     scissor-cut outline
  //  paint   (g, clipPath, bounds) extra drawing clipped to the piece (halftone, patterns ...)
  //  after   (g) drawing on top without clip (outlines that may overhang)
  //  shadow  {x, y, blur, a}; grain alpha; res supersampling
  P.piece = function (o) {
    const res = o.res || 1;
    let outer, inner, bounds;
    if (o.path) {
      inner = outer = o.path;
      bounds = { x0: o.bounds[0], y0: o.bounds[1], x1: o.bounds[2], y1: o.bounds[3] };
    } else if (o.torn) {
      const t = o.torn;
      const op = P.tear(o.pts, { amp: t.amp ?? 4, freq: t.freq ?? 0.05, seed: t.seed ?? 1, step: t.step ?? 2.5, straight: t.straight });
      const ip = P.tear(o.pts, {
        amp: (t.amp ?? 4) * 0.8, freq: t.freq ?? 0.05, seed: (t.seed ?? 1) + 101, step: t.step ?? 2.5,
        inset: t.edgeW ?? 1.2, insetVar: t.edgeVar ?? 3, straight: t.straight,
      });
      outer = P.toPath(op); inner = P.toPath(ip);
      bounds = P.bounds([op]);
      o._outerPts = op;
    } else {
      const cp = o.cut === false ? o.pts : P.cut(o.pts, { seed: o.seed || 3 });
      inner = outer = P.toPath(cp);
      bounds = P.bounds([cp]);
    }
    const sh = o.shadow === undefined ? { x: 3, y: 5, blur: 10, a: 0.35 } : o.shadow;
    const extra = o.overhang || 0;
    const pad = (sh ? sh.blur * 1.5 + Math.max(Math.abs(sh.x), Math.abs(sh.y)) : 2) + 4 + extra;
    const w = (bounds.x1 - bounds.x0 + pad * 2) * res, h = (bounds.y1 - bounds.y0 + pad * 2) * res;
    const tmp = makeCanvas(w, h);
    const g = tmp.getContext('2d');
    g.setTransform(res, 0, 0, res, (pad - bounds.x0) * res, (pad - bounds.y0) * res);
    if (o.torn && outer !== inner) {
      g.fillStyle = o.torn.edge || MA.C.riceL;
      g.fill(outer);
      // hair-like fibres sticking out of the tear
      if (o._outerPts && o.torn.hairs !== false) {
        const R = rng((o.torn.seed || 1) * 7 + 3);
        g.strokeStyle = o.torn.edge || MA.C.riceL;
        g.lineWidth = 0.6;
        g.globalAlpha = 0.55;
        g.beginPath();
        const op = o._outerPts;
        for (let i = 0; i < op.length; i += 3) {
          if (R() > 0.35) continue;
          const p = op[i], q = op[(i + 1) % op.length];
          const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
          const s = signedArea(op) > 0 ? 1 : -1;
          const nx = (dy / L) * s, ny = (-dx / L) * s;
          const len = 1 + R() * 3.5;
          g.moveTo(p[0], p[1]);
          g.lineTo(p[0] + nx * len + (R() - 0.5) * 2, p[1] + ny * len + (R() - 0.5) * 2);
        }
        g.stroke();
        g.globalAlpha = 1;
      }
    }
    if (o.fill !== false) {
      g.fillStyle = o.color || MA.C.rice;
      g.fill(inner);
    }
    if (o.paint) {
      g.save();
      g.clip(inner);
      o.paint(g, inner, bounds);
      g.restore();
    }
    const ga = o.grain ?? 0.55;
    if (ga > 0) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = ga;
      g.fillStyle = P.pattern(g, o.grainKind || 'grain');
      g.fillRect(0, 0, w, h);
      g.restore();
    }
    if (o.after) o.after(g, inner, bounds);
    if (o.speckle) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = o.speckle;
      g.fillStyle = P.pattern(g, 'speckle');
      g.fillRect(0, 0, w, h);
      g.restore();
    }
    let c = tmp;
    if (sh) {
      c = makeCanvas(w, h);
      const f = c.getContext('2d');
      f.shadowColor = `rgba(8,10,24,${sh.a})`;
      f.shadowBlur = sh.blur * res;
      f.shadowOffsetX = sh.x * res;
      f.shadowOffsetY = sh.y * res;
      f.drawImage(tmp, 0, 0);
    }
    return { c, ox: (pad - bounds.x0) * res, oy: (pad - bounds.y0) * res, res, w: bounds.x1 - bounds.x0, h: bounds.y1 - bounds.y0, path: inner };
  };

  // Keep only local x in [x0, x1] of a sprite: tiles built wider than their period lose the side shadows.
  P.cropX = function (s, x0, x1) {
    const a = Math.round(x0 * s.res + s.ox), b = Math.round(x1 * s.res + s.ox);
    const c = makeCanvas(b - a, s.c.height);
    c.getContext('2d').drawImage(s.c, -a, 0);
    return Object.assign({}, s, { c, ox: s.ox - a });
  };

  // Draw a sprite with its local origin at (x, y).
  MA.draw = function (ctx, s, x, y, rot = 0, sx = 1, sy = sx, alpha = 1) {
    if (!s || alpha <= 0.002) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    const k = 1 / (s.res || 1);
    ctx.scale(sx * k, sy * k);
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.drawImage(s.c, -s.ox, -s.oy);
    ctx.restore();
  };

  // Halftone dots on a rotated grid; f(x, y) in [0,1] is the ink coverage.
  P.halftone = function (g, x0, y0, x1, y1, o) {
    const cell = o.cell || 8, ang = o.angle ?? 0.4, maxR = o.maxR || cell * 0.62;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + cell;
    g.fillStyle = o.color;
    g.beginPath();
    for (let v = -R; v <= R; v += cell) {
      for (let u = -R; u <= R; u += cell) {
        const x = cx + u * ca - v * sa, y = cy + u * sa + v * ca;
        if (x < x0 - cell || x > x1 + cell || y < y0 - cell || y > y1 + cell) continue;
        const f = o.f(x, y);
        if (f <= 0.015) continue;
        const r = maxR * Math.sqrt(Math.min(1.3, f));
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    g.fill();
  };

  // Screen-print style hatching lines (for buildings, kraft papers).
  P.hatch = function (g, x0, y0, x1, y1, o) {
    const gap = o.gap || 6, ang = o.angle ?? -0.8;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
    g.strokeStyle = o.color;
    g.lineWidth = o.width || 1;
    g.beginPath();
    const R2 = rng(o.seed || 5);
    for (let v = -R; v <= R; v += gap) {
      const j = (R2() - 0.5) * gap * 0.3;
      g.moveTo(cx - R * ca - (v + j) * sa, cy - R * sa + (v + j) * ca);
      g.lineTo(cx + R * ca - (v + j) * sa, cy + R * sa + (v + j) * ca);
    }
    g.stroke();
  };

  // Soft light blob, cheap per frame.
  MA.glow = function (ctx, x, y, r, color, a = 1, op = 'lighter') {
    if (a <= 0.002 || r <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = op;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, MA.hex(color, 0.55 * a));
    gr.addColorStop(0.35, MA.hex(color, 0.22 * a));
    gr.addColorStop(1, MA.hex(color, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };

  // Paper-cut "crescent" cuts (月牙纹) punched out of the current canvas.
  P.crescent = function (g, x, y, r, ang, thick = 0.45) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.arc(0, 0, r, -Math.PI * 0.85, Math.PI * 0.85, false);
    g.arc(-r * thick, 0, r * 0.92, Math.PI * 0.8, -Math.PI * 0.8, true);
    g.closePath();
    g.fill();
    g.restore();
  };

  // Sawtooth fringe along a line (锯齿纹), filled with the current fillStyle.
  P.sawtooth = function (g, x0, y0, x1, y1, tooth = 6, depth = 5) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const n = Math.max(1, Math.floor(L / tooth));
    g.beginPath();
    g.moveTo(x0, y0);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * tooth, b = (i + 1) * tooth;
      g.lineTo(x0 + ux * a + nx * depth, y0 + uy * a + ny * depth);
      g.lineTo(x0 + ux * b, y0 + uy * b);
    }
    g.closePath();
    g.fill();
  };
})();

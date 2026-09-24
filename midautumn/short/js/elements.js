'use strict';
// Reusable collage elements: skies, skylines, moon, clouds, lanterns, stars, trees, mooncakes.
(function () {
  const MA = window.MA;
  const { C, rng, hash, makeCanvas, clamp, smooth } = MA;
  const P = MA.paper;
  const E = (MA.el = {});

  // Full-bleed sky: gradient + halftone glow + fibre grain, baked once per layout.
  E.sky = function (W, H, stops, o = {}) {
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H);
    stops.forEach(([p, col]) => gr.addColorStop(p, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    if (o.halftone) {
      for (const h of [].concat(o.halftone)) P.halftone(g, 0, 0, W, H, h);
    }
    if (o.paint) o.paint(g, W, H);
    g.globalAlpha = o.grain ?? 0.38;
    g.fillStyle = P.pattern(g);
    g.fillRect(0, 0, W, H);
    return c;
  };

  // Stars: twinkling rice-paper specks and a few four-point cut stars.
  E.stars = function (ctx, t, o) {
    const n = o.n || 70, seed = o.seed || 1;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const x = o.x0 + hash(i, seed, 1) * (o.x1 - o.x0);
      const y = o.y0 + Math.pow(hash(i, seed, 2), 1.4) * (o.y1 - o.y0);
      const big = hash(i, seed, 3) < 0.12;
      const tw = 0.55 + 0.45 * Math.sin(t * (1.3 + hash(i, seed, 4) * 2.2) + i * 1.7);
      ctx.globalAlpha = (o.alpha ?? 1) * (big ? 0.95 : 0.35 + 0.5 * hash(i, seed, 5)) * tw;
      ctx.fillStyle = hash(i, seed, 6) < 0.25 ? C.goldP : C.riceL;
      if (big) {
        const r = 5 + hash(i, seed, 7) * 5;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + 0.3, rr = k % 2 ? r * 0.28 : r;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 1 + hash(i, seed, 8) * 1.8, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  // City skyline as one scissor-cut sheet. Returns sprite + list of lit windows (local coords).
  E.skyline = function (w, h, o) {
    const R = rng(o.seed || 1);
    const tops = [];
    let x = -20;
    const blds = [];
    while (x < w + 20) {
      const bw = o.minW + R() * (o.maxW - o.minW);
      let bh = o.minH + Math.pow(R(), 1.3) * (o.maxH - o.minH);
      if (o.tall && Math.abs(x + bw / 2 - o.tall.x) < bw / 2 + 1) { bh = o.tall.h; }
      blds.push({ x, w: bw, h: bh, kind: R() });
      x += bw;
    }
    const pts = [[-20, h + 30]];
    for (const b of blds) {
      const top = h - b.h;
      if (b.kind < 0.2) {           // stepped top
        pts.push([b.x, top + 18], [b.x + b.w * 0.2, top + 18], [b.x + b.w * 0.2, top], [b.x + b.w * 0.8, top], [b.x + b.w * 0.8, top + 18], [b.x + b.w, top + 18]);
      } else if (b.kind < 0.32) {   // antenna
        pts.push([b.x, top], [b.x + b.w * 0.48, top], [b.x + b.w * 0.48, top - 40], [b.x + b.w * 0.52, top - 40], [b.x + b.w * 0.52, top], [b.x + b.w, top]);
      } else if (b.kind < 0.42) {   // pitched roof
        pts.push([b.x, top], [b.x + b.w * 0.5, top - b.w * 0.25], [b.x + b.w, top]);
      } else {
        pts.push([b.x, top], [b.x + b.w, top]);
      }
    }
    pts.push([w + 20, h + 30]);
    const lit = [];
    const spr = P.piece({
      pts, color: o.color, seed: o.seed, shadow: o.shadow ?? { x: 0, y: -4, blur: 14, a: 0.35 }, res: o.res || 1,
      grain: 0.5,
      paint(g) {
        for (const [i, b] of blds.entries()) {
          const top = h - b.h;
          // printed textures on some towers
          if (b.kind > 0.8) P.hatch(g, b.x, top, b.x + b.w, h, { gap: 5, angle: -0.9, color: MA.hex('#000000', 0.18), width: 1.2, seed: i });
          else if (b.kind > 0.62) P.halftone(g, b.x, top, b.x + b.w, h, { cell: 7, angle: 0.8, color: MA.hex(C.indigoP, 0.16), f: (xx, yy) => 0.35 + 0.4 * ((yy - top) / b.h) });
          const cols = Math.max(1, Math.floor((b.w - 14) / (o.winW + o.winGap)));
          const rows = Math.floor((b.h - 24) / (o.winH + o.winGapY));
          const x0 = b.x + (b.w - cols * (o.winW + o.winGap) + o.winGap) / 2;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const wx = x0 + c * (o.winW + o.winGap), wy = top + 16 + r * (o.winH + o.winGapY);
              const on = R() < o.lit * (b.kind > 0.5 ? 1.2 : 0.8);
              if (on) {
                g.fillStyle = R() < 0.8 ? C.goldL : C.goldP;
                lit.push([wx + o.winW / 2, wy + o.winH / 2]);
              } else g.fillStyle = MA.hex(o.dark || '#000000', 0.22);
              g.fillRect(wx, wy, o.winW, o.winH);
            }
          }
        }
      },
    });
    spr.blds = blds;
    spr.lit = lit;
    return spr;
  };

  // The moon: layered torn discs, craters, halftone terminator, off-register vermilion ring.
  E.moon = function (R0, o = {}) {
    const res = o.res || 1;
    const seed = o.seed || 5;
    return P.piece({
      pts: P.circle(0, 0, R0, 160), color: o.color || C.gold, res, seed,
      torn: { amp: R0 * 0.012, freq: 0.03, seed, edge: C.goldP, edgeW: 1.5, edgeVar: 3 },
      shadow: o.shadow ?? { x: 0, y: 8, blur: 26, a: 0.35 },
      grain: 0.75, overhang: 20,
      paint(g) {
        // lighter face
        const lp = P.tear(P.circle(-R0 * 0.07, -R0 * 0.08, R0 * 0.86, 140), { amp: R0 * 0.02, freq: 0.02, seed: seed + 3 });
        g.fillStyle = o.light || C.goldL;
        g.fill(P.toPath(lp));
        // maria: torn blobs
        const Rr = rng(seed + 9);
        const blobs = o.blobs || [[-0.35, -0.3, 0.22], [0.12, -0.42, 0.14], [0.3, -0.05, 0.2], [-0.1, 0.18, 0.16], [0.08, 0.45, 0.12], [-0.45, 0.2, 0.1], [0.45, 0.32, 0.09]];
        for (const [bx, by, br] of blobs) {
          const pts = P.circle(bx * R0, by * R0, br * R0, 40, br * R0 * (0.8 + Rr() * 0.5));
          g.fillStyle = MA.hex(o.dark || C.goldD, 0.55 + Rr() * 0.25);
          g.fill(P.toPath(P.tear(pts, { amp: br * R0 * 0.18, freq: 0.06, seed: Math.floor(Rr() * 1000) })));
        }
        // the rabbit and the osmanthus tree people have always seen in the moon
        if (o.legend) {
          g.save();
          g.fillStyle = MA.hex(o.dark || C.goldD, 0.42);
          g.translate(-R0 * 0.3, R0 * 0.12);
          g.scale(R0 / 300, R0 / 300);
          g.beginPath();
          g.ellipse(0, 0, 46, 58, -0.2, 0, 6.3); g.ellipse(22, -70, 30, 26, 0, 0, 6.3);
          g.ellipse(8, -128, 10, 40, -0.3, 0, 6.3); g.ellipse(30, -130, 10, 40, 0.1, 0, 6.3);
          g.ellipse(-40, 34, 14, 12, 0, 0, 6.3);
          g.fill();
          g.fillRect(52, -40, 10, 84);
          g.beginPath(); g.ellipse(70, 50, 30, 16, 0, 0, 6.3); g.fill();
          g.restore();
          g.save();
          g.translate(R0 * 0.36, -R0 * 0.02);
          g.scale(R0 / 300, R0 / 300);
          g.fillStyle = MA.hex(o.dark || C.goldD, 0.36);
          g.fillRect(-7, -30, 14, 130);
          for (const [x, y, r] of [[0, -70, 52], [-40, -40, 36], [40, -44, 38], [-20, -110, 34], [26, -108, 32]]) { g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
          g.restore();
        }
        // halftone on the shaded limb
        P.halftone(g, -R0, -R0, R0, R0, {
          cell: Math.max(6, R0 * 0.028), angle: 0.26, color: MA.hex(o.dot || '#b86a22', 0.75),
          f: (x, y) => smooth((Math.hypot(x + R0 * 0.35, y + R0 * 0.35) - R0 * 0.75) / (R0 * 0.9)) * 0.9,
        });
      },
      after(g) {
        // off-register vermilion print: a thin dry ring slightly shifted
        g.save();
        g.globalCompositeOperation = 'multiply';
        g.strokeStyle = MA.hex(C.ver, 0.55);
        g.lineWidth = Math.max(2, R0 * 0.012);
        g.beginPath();
        const d = P.tear(P.circle(R0 * 0.018, -R0 * 0.014, R0 * 0.985, 150), { amp: 1.5, seed: seed + 21, freq: 0.1 });
        d.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.closePath();
        g.setLineDash([R0 * 0.5, R0 * 0.05, R0 * 0.2, R0 * 0.08]);
        g.stroke();
        g.restore();
      },
    });
  };

  // Concentric translucent halo rings (paper discs behind the moon).
  E.halo = function (R0, o = {}) {
    const n = o.n || 4;
    const size = R0 * (1 + n * 0.16) + 10;
    const c = makeCanvas(size * 2, size * 2);
    const g = c.getContext('2d');
    g.translate(size, size);
    for (let i = n; i >= 1; i--) {
      const r = R0 * (1 + i * 0.15);
      g.fillStyle = MA.hex(o.color || C.goldP, (o.alpha || 0.09) * (1 + (n - i) * 0.3));
      g.fill(P.toPath(P.tear(P.circle(0, 0, r, 120), { amp: 3, freq: 0.04, seed: i * 13 })));
    }
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.4;
    g.fillStyle = P.pattern(g);
    g.fillRect(-size, -size, size * 2, size * 2);
    return { c, ox: size, oy: size, res: 1 };
  };

  // Torn cumulus: the upper envelope of a few puffs of different sizes over a flat torn base.
  E.cloud = function (w, h, o = {}) {
    const R = rng(o.seed || 3);
    const puffs = [];
    const n = Math.max(3, Math.round(w / (h * 1.25)));
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const env = Math.sin(f * Math.PI);
      puffs.push({ x: w * (f + (R() - 0.5) * 0.08), r: h * (0.22 + 0.5 * env * (0.6 + 0.4 * R())) });
    }
    const base = h * 0.78;
    const pts = [];
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * w;
      let y = base - h * 0.06;
      for (const p of puffs) {
        const dx = x - p.x;
        if (Math.abs(dx) < p.r) y = Math.min(y, base - p.r * 0.35 - Math.sqrt(p.r * p.r - dx * dx));
      }
      pts.push([x, y]);
    }
    pts.push([w, base], [w * 0.55, base + h * 0.06], [0, base]);
    return P.piece({
      pts, color: o.color || C.riceL, seed: o.seed,
      torn: { amp: 3.2, freq: 0.05, seed: o.seed || 3, edge: o.edge || '#ffffff' },
      shadow: o.shadow ?? { x: 0, y: 6, blur: 14, a: 0.3 },
      grain: 0.6,
      paint(g) {
        P.halftone(g, 0, 0, w, h, { cell: 7, angle: 0.5, color: MA.hex(o.shade || C.indigoP, 0.8), f: (x, y) => smooth((y - h * 0.3) / (h * 0.6)) * 0.8 });
      },
    });
  };

  // Auspicious cloud (祥云): stacked curls cut from paper.
  E.xiangyun = function (s, o = {}) {
    const col = o.color || C.goldL;
    const c = makeCanvas(s * 3.2, s * 1.6);
    const g = c.getContext('2d');
    g.translate(s * 1.6, s * 0.9);
    const curl = (x, y, r, dir) => {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    };
    g.fillStyle = col;
    curl(-s * 0.6, 0, s * 0.42); curl(0, -s * 0.25, s * 0.5); curl(s * 0.62, 0, s * 0.4);
    g.fillRect(-s * 1.3, 0, s * 2.6, s * 0.32);
    g.beginPath(); g.arc(-s * 1.3, s * 0.16, s * 0.16, 0, 6.3); g.arc(s * 1.3, s * 0.16, s * 0.16, 0, 6.3); g.fill();
    // cut the spirals
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = s * 0.06;
    g.lineCap = 'round';
    for (const [x, y, r] of [[-s * 0.6, 0, s * 0.42], [0, -s * 0.25, s * 0.5], [s * 0.62, 0, s * 0.4]]) {
      g.beginPath();
      for (let a = 0; a < Math.PI * 3.2; a += 0.08) {
        const rr = r * 0.8 * (1 - a / (Math.PI * 3.6));
        const px = x + Math.cos(a + Math.PI) * rr, py = y + Math.sin(a + Math.PI) * rr;
        if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    }
    g.fillRect(-s * 1.2, s * 0.13, s * 2.4, s * 0.05);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.6;
    g.fillStyle = P.pattern(g);
    g.fillRect(-s * 2, -s, s * 4, s * 2);
    const f = makeCanvas(c.width, c.height);
    const fg = f.getContext('2d');
    fg.shadowColor = 'rgba(8,10,24,0.4)'; fg.shadowBlur = 10; fg.shadowOffsetY = 5;
    fg.drawImage(c, 0, 0);
    return { c: f, ox: s * 1.6, oy: s * 0.9, res: 1 };
  };

  // Red paper lantern; origin at the hanging point, body below.
  E.lantern = function (r, o = {}) {
    const col = o.color || C.ver;
    const W = r * 2.4, H = r * 3.6;
    const c = makeCanvas(W + 40, H + 40);
    const g = c.getContext('2d');
    const cx = (W + 40) / 2, top = 20;
    g.translate(cx, top);
    const by = r * 0.55 + r * 0.95; // body centre
    // string
    g.strokeStyle = C.goldD; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, r * 0.4); g.stroke();
    // body
    const body = new Path2D();
    body.ellipse(0, by, r * 1.12, r * 0.95, 0, 0, Math.PI * 2);
    g.save();
    g.shadowColor = 'rgba(10,8,20,0.35)'; g.shadowBlur = 10; g.shadowOffsetY = 5;
    g.fillStyle = col;
    g.fill(body);
    g.restore();
    g.save();
    g.clip(body);
    const gr = g.createRadialGradient(-r * 0.2, by - r * 0.2, r * 0.1, 0, by, r * 1.2);
    gr.addColorStop(0, MA.hex(o.glow || C.verP, 0.95));
    gr.addColorStop(0.45, MA.hex(o.mid || C.verL, 0.6));
    gr.addColorStop(1, MA.hex(C.verD, 0.8));
    g.fillStyle = gr;
    g.fillRect(-r * 1.3, by - r * 1.1, r * 2.6, r * 2.2);
    // ribs
    g.strokeStyle = MA.hex(C.verD, 0.6);
    g.lineWidth = Math.max(1.2, r * 0.025);
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.ellipse(0, by, Math.abs(i) * r * 0.33 + 0.5, r * 0.95, 0, 0, Math.PI * 2);
      g.stroke();
    }
    P.halftone(g, -r * 1.2, by - r, r * 1.2, by + r, { cell: Math.max(4, r * 0.1), angle: 0.4, color: MA.hex(C.verD, 0.5), f: (x, y) => smooth((Math.hypot(x / 1.12, y - by) - r * 0.55) / (r * 0.5)) });
    if (o.mark) o.mark(g, 0, by, r);
    g.globalAlpha = 0.6;
    g.fillStyle = P.pattern(g);
    g.fillRect(-r * 1.3, by - r * 1.1, r * 2.6, r * 2.2);
    g.restore();
    // caps
    g.fillStyle = C.gold;
    g.fillRect(-r * 0.5, by - r * 1.02, r * 1.0, r * 0.18);
    g.fillRect(-r * 0.5, by + r * 0.86, r * 1.0, r * 0.18);
    g.fillStyle = C.goldD;
    g.fillRect(-r * 0.5, by - r * 0.88, r * 1.0, r * 0.04);
    g.fillRect(-r * 0.5, by + r * 0.86, r * 1.0, r * 0.04);
    // tassel
    g.strokeStyle = o.tassel || C.gold;
    g.lineWidth = Math.max(1, r * 0.03);
    const ty = by + r * 1.04;
    g.fillStyle = C.goldD;
    g.fillRect(-r * 0.09, ty, r * 0.18, r * 0.2);
    for (let i = -5; i <= 5; i++) {
      g.beginPath();
      g.moveTo(i * r * 0.02, ty + r * 0.18);
      g.quadraticCurveTo(i * r * 0.05, ty + r * 0.6, i * r * 0.07, ty + r * 1.0 + Math.abs(i) * -r * 0.02);
      g.stroke();
    }
    return { c, ox: cx, oy: top, res: 1, r, by };
  };

  // Sky lantern (孔明灯): origin at centre of the opening, glowing from inside.
  E.skyLantern = function (s, o = {}) {
    const c = makeCanvas(s * 1.6, s * 2.1);
    const g = c.getContext('2d');
    g.translate(s * 0.8, s * 1.9);
    const body = new Path2D();
    body.moveTo(-s * 0.36, 0);
    body.bezierCurveTo(-s * 0.46, -s * 0.6, -s * 0.62, -s * 1.2, -s * 0.5, -s * 1.56);
    body.quadraticCurveTo(0, -s * 1.78, s * 0.5, -s * 1.56);
    body.bezierCurveTo(s * 0.62, -s * 1.2, s * 0.46, -s * 0.6, s * 0.36, 0);
    body.quadraticCurveTo(0, s * 0.08, -s * 0.36, 0);
    const gr = g.createLinearGradient(0, 0, 0, -s * 1.7);
    gr.addColorStop(0, o.low || '#ffe7a1');
    gr.addColorStop(0.35, o.mid || C.goldL);
    gr.addColorStop(1, o.top || C.ver);
    g.fillStyle = gr;
    g.fill(body);
    g.save();
    g.clip(body);
    g.strokeStyle = MA.hex(C.verD, 0.35);
    g.lineWidth = Math.max(1, s * 0.02);
    for (const k of [-0.25, 0, 0.25]) {
      g.beginPath(); g.moveTo(k * s * 1.2, 0); g.quadraticCurveTo(k * s * 1.8, -s * 0.9, k * s * 1.4, -s * 1.7); g.stroke();
    }
    g.globalAlpha = 0.5;
    g.fillStyle = P.pattern(g);
    g.fillRect(-s, -s * 2, s * 2, s * 2.2);
    g.restore();
    // flame
    g.fillStyle = '#fff4c8';
    g.beginPath(); g.ellipse(0, -s * 0.08, s * 0.07, s * 0.1, 0, 0, 6.3); g.fill();
    return { c, ox: s * 0.8, oy: s * 1.9, res: 1 };
  };

  // Mooncake seen from above: scalloped rim, embossed petals and a centre mark.
  E.mooncakeTop = function (g, x, y, r, o = {}) {
    g.save();
    g.translate(x, y);
    g.fillStyle = o.color || '#c98536';
    g.beginPath();
    const n = 16;
    for (let i = 0; i <= n * 8; i++) {
      const a = (i / (n * 8)) * Math.PI * 2;
      const rr = r * (0.93 + 0.07 * Math.abs(Math.cos((a * n) / 2)));
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.fill();
    g.fillStyle = o.face || '#dda14e';
    g.beginPath(); g.arc(0, 0, r * 0.78, 0, 6.3); g.fill();
    g.strokeStyle = MA.hex('#8a4f1c', 0.55);
    g.lineWidth = Math.max(1, r * 0.04);
    g.beginPath(); g.arc(0, 0, r * 0.62, 0, 6.3); g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.ellipse(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.16, r * 0.07, a, 0, 6.3);
      g.stroke();
    }
    g.beginPath(); g.arc(0, 0, r * 0.16, 0, 6.3); g.stroke();
    g.restore();
  };

  // Osmanthus blossom cluster dots.
  E.blossoms = function (g, x, y, r, n, seed, col) {
    const R = rng(seed);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      const s = 1.6 + R() * 2.4;
      g.fillStyle = R() < 0.6 ? col || C.goldL : C.gold;
      g.beginPath();
      for (let k = 0; k < 4; k++) {
        const b = (k / 4) * Math.PI * 2 + a;
        g.moveTo(px, py);
        g.arc(px + Math.cos(b) * s * 0.6, py + Math.sin(b) * s * 0.6, s * 0.55, 0, 6.3);
      }
      g.fill();
    }
  };

  // Falling osmanthus petal (4 lobes), drawn live.
  E.petal = function (ctx, x, y, s, rot, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const b = (k / 4) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.ellipse(Math.cos(b) * s * 0.55, Math.sin(b) * s * 0.55, s * 0.55, s * 0.36, b, 0, 6.3);
    }
    ctx.fill();
    ctx.restore();
  };
})();

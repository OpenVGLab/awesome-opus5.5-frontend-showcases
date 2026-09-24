'use strict';
// Scene 3 · 故乡: the moon becomes a lantern under the eaves of home; osmanthus falls; a child runs with a rabbit lantern.
(function () {
  const MA = window.MA;
  const { C, seg, smooth, easeOut, easeInOut, lerp, hash, rng, makeCanvas } = MA;
  const P = MA.paper, E = MA.el, B = MA.brush;
  const S = (MA.scenes = MA.scenes || {});
  const home = (S.home = {});

  // Osmanthus tree: inked branches under layered torn-paper foliage, gold blossom clusters.
  function buildTree(w, h, seed) {
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const R = rng(seed);
    const tips = [];
    const branch = (x, y, ang, len, wd, depth) => {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      const bend = (R() - 0.5) * len * 0.25;
      const mx = (x + x2) / 2 - Math.sin(ang) * bend, my = (y + y2) / 2 + Math.cos(ang) * bend;
      B.stroke(g, [[x, y, wd], [mx, my, wd * 0.84], [x2, y2, wd * 0.68]], { color: '#3a2626', bristles: 3, streak: 'rgba(255,230,200,0.14)', seed: Math.floor(R() * 999), step: 3 });
      if (depth === 0) { tips.push([x2, y2]); return; }
      const n = 2 + (R() < 0.35 ? 1 : 0);
      for (let i = 0; i < n; i++) branch(x2, y2, ang + (i - (n - 1) / 2) * 0.62 + (R() - 0.5) * 0.4, len * (0.66 + R() * 0.16), wd * 0.66, depth - 1);
    };
    branch(w * 0.5, h + 10, -Math.PI / 2 + 0.05, h * 0.3, w * 0.07, 4);
    const shades = ['#1b3c4a', '#24495a', '#2e5a68', '#3b6b72'];
    const blobs = [];
    for (let i = 0; i < 16; i++) {
      const a = Math.PI + (i / 15) * Math.PI;
      const rr = 0.36 + R() * 0.1;
      blobs.push({ x: w * 0.5 + Math.cos(a) * w * rr * (0.7 + R() * 0.3), y: h * 0.42 + Math.sin(a) * h * 0.3 * (0.6 + R() * 0.4), r: w * (0.11 + R() * 0.07), s: Math.floor(R() * 4) });
    }
    for (let i = 0; i < 6; i++) blobs.push({ x: w * (0.3 + R() * 0.4), y: h * (0.3 + R() * 0.2), r: w * (0.1 + R() * 0.06), s: 1 + Math.floor(R() * 3) });
    blobs.sort((a, b) => a.s - b.s);
    for (const b of blobs) {
      g.save();
      g.shadowColor = 'rgba(6,10,20,0.45)'; g.shadowBlur = 12; g.shadowOffsetY = 6;
      g.fillStyle = shades[b.s];
      g.fill(P.toPath(P.tear(P.circle(b.x, b.y, b.r, 36, b.r * 1.15), { amp: b.r * 0.14, freq: 0.05, seed: Math.floor(R() * 9999) })));
      g.restore();
    }
    g.globalCompositeOperation = 'source-atop';
    P.halftone(g, 0, 0, w, h, { cell: 8, angle: 0.7, color: 'rgba(0,0,0,0.22)', f: (x, y) => smooth((y - h * 0.2) / (h * 0.5)) * 0.8 });
    g.globalAlpha = 0.5; g.fillStyle = P.pattern(g); g.fillRect(0, 0, w, h);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 26; i++) {
      const b = blobs[Math.floor(R() * blobs.length)];
      E.blossoms(g, b.x + (R() - 0.5) * b.r, b.y + (R() - 0.5) * b.r, b.r * 0.35, 14, seed + i * 3);
    }
    return { c, ox: 0, oy: 0, res: 1, w, h };
  }

  home.CAPTION = ['小时候，外婆总说：', '月亮上住着玉兔。'];
  home.CAP_T = [18.5, 23.0];

  home.build = function (L) {
    const { W, H } = L;
    const Pt = L.P;
    const A = (home.A = {});
    // kraft-paper caption strip; the words are typed on live
    const cw = Pt ? 470 : 440, chh = 150;
    A.cap = { w: cw, h: chh, x: Pt ? W * 0.3 : W * 0.13, y: Pt ? H * 0.8 : H * 0.625 };
    A.capSpr = P.piece({
      pts: P.rect(-cw / 2, -chh / 2, cw, chh), color: '#d9c09a', torn: { amp: 3, seed: 29, edge: '#f6ead2', edgeW: 1.2 }, grain: 0.6, res: 1.5,
      shadow: { x: 5, y: 9, blur: 14, a: 0.45 },
      paint(g) {
        g.strokeStyle = MA.hex('#8a6a44', 0.35); g.lineWidth = 1;
        for (const y of [-14, 40]) { g.beginPath(); g.moveTo(-cw / 2 + 26, y + 8); g.lineTo(cw / 2 - 26, y + 8); g.stroke(); }
        g.fillStyle = MA.hex(C.ver, 0.85); g.fillRect(-cw / 2 + 18, -chh / 2 + 16, 6, chh - 32);
      },
    });
    A.capTape = P.piece({ pts: P.rect(-40, -11, 80, 22), color: MA.hex(C.goldP, 0.75), torn: { amp: 1.5, seed: 31, edge: MA.hex(C.goldP, 0.5), edgeW: 0.5, edgeVar: 1, straight: (i) => i % 2 === 0 }, shadow: { x: 1, y: 2, blur: 3, a: 0.2 }, grain: 0.3 });
    A.sky = E.sky(W, H, [[0, '#141c44'], [0.5, '#2c2b5c'], [1, '#6b3a4f']], {
      halftone: { cell: 10, angle: 0.4, color: MA.hex(C.goldL, 0.3), f: (x, y) => smooth(1 - Math.hypot(x - W * 0.34, y - H * 0.3) / (H * 0.55)) * 0.6 },
    });
    A.mx = Pt ? W * 0.3 : W * 0.34; A.my = Pt ? H * 0.27 : H * 0.3;
    A.moon = E.moon(Pt ? 100 : 110, { seed: 9, res: 1.3 });
    A.halo = E.halo(Pt ? 100 : 110, { n: 3, alpha: 0.12 });
    A.tree = buildTree(Pt ? 720 : 820, Pt ? 900 : 760, 12);
    A.treeX = Pt ? W * 0.52 : W * 0.6; A.treeY = Pt ? H * 0.14 : H * 0.08;
    // courtyard wall with a round moon gate
    const wy0 = Pt ? H * 0.43 : H * 0.47, wy1 = Pt ? H * 0.79 : H * 0.87;
    const gx = Pt ? W * 0.5 : W * 0.33, gy = (wy0 + wy1) / 2 + (Pt ? 20 : 12), gr = Pt ? W * 0.24 : H * 0.19;
    A.gate = { x: gx, y: gy, r: gr };
    A.wall = P.piece({
      pts: P.rect(-20, wy0, W + 40, wy1 - wy0), color: C.rice, cut: true, grain: 0.55, shadow: { x: 0, y: -4, blur: 16, a: 0.4 },
      paint(g) {
        P.halftone(g, 0, wy0, W, wy1, { cell: 9, angle: 0.3, color: MA.hex(C.kraft, 0.35), f: (x, y) => 0.15 + 0.35 * MA.noise2(x * 0.004, y * 0.006, 5) });
        g.fillStyle = MA.hex('#3d4466', 0.85);
        g.fillRect(-20, wy1 - 34, W + 40, 34);
        g.fillStyle = MA.hex('#000000', 0.12);
        g.fillRect(-20, wy1 - 38, W + 40, 4);
        // moon gate: stone ring then the opening
        g.fillStyle = '#8f93a6';
        g.beginPath(); g.arc(gx, gy, gr + 16, 0, 6.3); g.fill();
        g.strokeStyle = MA.hex('#5a5f78', 0.8); g.lineWidth = 3;
        g.beginPath(); g.arc(gx, gy, gr + 8, 0, 6.3); g.stroke();
        g.save(); g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.arc(gx, gy, gr, 0, 6.3); g.fill();
        g.fillRect(gx - gr * 0.5, gy + gr * 0.85, gr, wy1);
        g.restore();
        // a lattice window on the far side
        const lx = Pt ? W * 0.14 : W * 0.63, ly = (wy0 + wy1) / 2 - 20, ls = Pt ? 70 : 84;
        g.fillStyle = '#5d6386';
        g.fillRect(lx - ls, ly - ls, ls * 2, ls * 2);
        g.fillStyle = C.rice;
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) g.fillRect(lx + i * ls * 0.38 - ls * 0.14, ly + j * ls * 0.38 - ls * 0.14, ls * 0.28, ls * 0.28);
      },
    });
    A.wy0 = wy0; A.wy1 = wy1;
    A.coping = P.piece({
      pts: [[-30, wy0 + 6], [-30, wy0 - 18], [W + 30, wy0 - 18], [W + 30, wy0 + 6]], color: '#1e2442', cut: true, grain: 0.4, shadow: { x: 0, y: 6, blur: 8, a: 0.45 },
      paint(g) {
        g.fillStyle = MA.hex(C.indigoP, 0.35);
        for (let x = -30; x < W + 30; x += 22) { g.beginPath(); g.arc(x, wy0 + 2, 9, 0, Math.PI); g.fill(); }
      },
    });
    A.floor = E.sky(W, Math.ceil(H - wy1 + 40), [[0, '#3a3450'], [1, '#231f35']], {
      paint(g, w, h) {
        g.strokeStyle = MA.hex('#000000', 0.25); g.lineWidth = 2;
        for (let i = 1; i < 5; i++) { const y = (i / 5) * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        for (let i = 0; i < 30; i++) { const x = (i / 30) * w + (i % 2) * 20; const r = Math.floor((i * 7) % 5); g.beginPath(); g.moveTo(x, (r / 5) * h); g.lineTo(x, ((r + 1) / 5) * h); g.stroke(); }
      },
    });
    // eaves overhead
    const eh = Pt ? H * 0.085 : H * 0.15;
    A.eh = eh;
    A.eaves = P.piece({
      pts: [[-40, -60], [W + 40, -60], [W + 40, eh + 4], [-40, eh + 4]], color: '#161b36', cut: true, grain: 0.45, shadow: { x: 0, y: 10, blur: 16, a: 0.5 }, res: 1,
      paint(g) {
        for (let x = -40; x < W + 40; x += 34) {
          g.fillStyle = MA.hex(C.indigoP, 0.12); g.fillRect(x, -60, 14, eh - 40);
        }
        g.fillStyle = C.ver; g.fillRect(-40, eh - 34, W + 80, 34);
        g.strokeStyle = MA.hex(C.goldL, 0.75); g.lineWidth = 2;
        g.beginPath(); g.moveTo(-40, eh - 28); g.lineTo(W + 40, eh - 28); g.moveTo(-40, eh - 6); g.lineTo(W + 40, eh - 6); g.stroke();
        for (let x = 30; x < W; x += 180) {
          g.fillStyle = C.gold; g.beginPath(); g.ellipse(x, eh - 17, 30, 8, 0, 0, 6.3); g.fill();
          g.fillStyle = C.teal; g.beginPath(); g.ellipse(x, eh - 17, 14, 4, 0, 0, 6.3); g.fill();
        }
        g.fillStyle = '#10142a';
        for (let x = -40; x < W + 40; x += 34) { g.beginPath(); g.arc(x + 7, eh - 36, 12, 0, 6.3); g.fill(); }
        g.fillStyle = MA.hex(C.goldP, 0.3);
        for (let x = -40; x < W + 40; x += 34) { g.beginPath(); g.arc(x + 7, eh - 36, 5, 0, 6.3); g.fill(); }
      },
    });
    const lr = Pt ? 62 : 70;
    A.lanterns = [
      { x: Pt ? W * 0.18 : W * 0.13, len: Pt ? 90 : 60, s: E.lantern(lr * 0.86, {}), ph: 0.4 },
      { x: Pt ? W * 0.5 : W * 0.5, len: Pt ? 150 : 120, s: E.lantern(lr, {}), ph: 1.9, hi: true },
      { x: Pt ? W * 0.82 : W * 0.87, len: Pt ? 70 : 50, s: E.lantern(lr * 0.8, {}), ph: 3.1 },
    ];
    // a big version of the centre lantern for the opening close-up
    A.bigLantern = E.lantern(lr * 5, {});
    A.table = MA.fig.sprite(MA.fig.path('M -120 -70 L 120 -70 L 120 -56 L -120 -56 Z', 'M -108 -56 L -94 -56 L -94 0 L -108 0 Z', 'M 94 -56 L 108 -56 L 108 0 L 94 0 Z', 'M -94 -44 L 94 -44 L 94 -38 L -94 -38 Z'),
      [-122, -74, 122, 2], C.wood, {});
    A.cakes = P.piece({
      pts: P.rect(-110, -64, 220, 64), cut: false, fill: false, shadow: { x: 2, y: 4, blur: 5, a: 0.35 }, grain: 0.4,
      paint(g) {
        g.fillStyle = C.riceL; g.beginPath(); g.ellipse(-30, -6, 74, 12, 0, 0, 6.3); g.fill();
        for (const [x, y] of [[-72, -12], [-30, -14], [12, -12], [-50, -34]]) {
          g.fillStyle = '#a8662a'; g.fillRect(x - 22, y - 14, 44, 16);
          g.fillStyle = '#d99a48'; g.beginPath(); g.ellipse(x, y - 14, 22, 6, 0, 0, 6.3); g.fill();
          g.strokeStyle = MA.hex('#7a4418', 0.6); g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y - 14, 14, 3.6, 0, 0, 6.3); g.stroke();
        }
        g.fillStyle = C.indigoL; g.beginPath(); g.moveTo(52, -4); g.quadraticCurveTo(46, -44, 76, -44); g.quadraticCurveTo(104, -44, 98, -4); g.fill();
        g.fillStyle = C.riceL; g.beginPath(); g.ellipse(75, -26, 16, 10, 0, 0, 6.3); g.fill();
        g.fillStyle = C.indigoL; g.fillRect(70, -52, 10, 8); g.beginPath(); g.moveTo(98, -30); g.lineTo(112, -40); g.lineTo(110, -34); g.lineTo(98, -22); g.fill();
      },
    });
    A.gran = MA.fig.grandma(C.ver);
    A.kid = MA.fig.kid(C.ver);
    A.rabbit = MA.fig.rabbitLantern();
    A.bamboo = P.piece({
      pts: P.rect(-160, -420, 320, 420), cut: false, fill: false, shadow: null, grain: 0.3,
      paint(g) {
        const R = rng(7);
        const leaf = (x, y, a, len, col) => {
          g.fillStyle = col;
          g.save(); g.translate(x, y); g.rotate(a);
          g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.45, -len * 0.16, len, 0); g.quadraticCurveTo(len * 0.45, len * 0.12, 0, 0); g.fill();
          g.restore();
        };
        for (let i = 0; i < 4; i++) {
          const x = -120 + i * 78 + (R() - 0.5) * 24;
          const lean = (R() - 0.5) * 0.08;
          g.save(); g.translate(x, 0); g.rotate(lean);
          g.fillStyle = i % 2 ? '#3d6a60' : '#335d56';
          g.fillRect(-5, -430, 10, 430);
          for (let k = 0; k < 6; k++) {
            const y = -410 + k * 72;
            g.fillStyle = '#244640'; g.fillRect(-7, y, 14, 3);
            if (R() < 0.7) {
              const side = R() < 0.5 ? -1 : 1;
              for (let m = 0; m < 4; m++) leaf(0, y, (side > 0 ? 0.35 : Math.PI - 0.35) + side * (m * 0.28 - 0.2) + (R() - 0.5) * 0.2, 48 + R() * 26, m % 2 ? '#4f8471' : '#2f5f55');
            }
          }
          g.restore();
        }
      },
    });
  };

  // The whole courtyard, under a camera that starts deep inside the centre lantern.
  home.draw = function (ctx, t, L) {
    const { W, H } = L;
    const A = home.A;
    const Pt = L.P;
    const pull = easeOut(seg(t, 14.95, 17.2));
    const cl = A.lanterns[1];
    const lanternY = A.eh + cl.len + cl.s.by;
    const z = lerp(5.2, 1, pull) * (1 + 0.04 * smooth(seg(t, 17, 23.4)));
    const fx = lerp(cl.x, W / 2, pull) + smooth(seg(t, 17, 23.4)) * 30, fy = lerp(lanternY, H / 2, pull);
    const layer = (d, fn) => { ctx.save(); MA.cam(ctx, L, fx, fy, z, d); fn(); ctx.restore(); };
    layer(0.35, () => {
      ctx.drawImage(A.sky, 0, 0);
      E.stars(ctx, t, { n: 40, seed: 21, x0: 0, x1: W, y0: 0, y1: H * 0.45, alpha: 0.8 });
      MA.glow(ctx, A.mx, A.my, 320, C.goldP, 0.5, 'screen');
      MA.draw(ctx, A.halo, A.mx, A.my, 0, 1 + 0.02 * Math.sin(t * 1.2));
      MA.draw(ctx, A.moon, A.mx, A.my);
    });
    layer(0.7, () => {
      // behind the wall: bamboo seen through the gate, the tree rising above
      MA.draw(ctx, A.bamboo, A.gate.x - A.gate.r * 0.2, A.wy1, 0, Pt ? 1 : 1.1);
      const sway = Math.sin(t * 0.9) * 0.008;
      ctx.save();
      ctx.translate(A.treeX + A.tree.w / 2, A.treeY + A.tree.h);
      ctx.rotate(sway);
      ctx.drawImage(A.tree.c, -A.tree.w / 2, -A.tree.h);
      ctx.restore();
    });
    layer(0.9, () => {
      ctx.fillStyle = '#2a2640';
      ctx.fillRect(A.gate.x - A.gate.r, A.wy1 - 40, A.gate.r * 2, 60);
      MA.draw(ctx, A.wall, 0, 0);
      MA.draw(ctx, A.coping, 0, 0);
      ctx.drawImage(A.floor, 0, A.wy1 - 6);
      // table + grandmother fanning
      const tx = Pt ? W * 0.6 : W * 0.6, ty = Pt ? H * 0.86 : H * 0.95;
      MA.draw(ctx, A.table, tx, ty);
      MA.draw(ctx, A.cakes, tx - 10, ty - 70);
      const gxp = Pt ? W * 0.83 : W * 0.75;
      MA.draw(ctx, A.gran.stool, gxp, ty - 64);
      MA.draw(ctx, A.gran.body, gxp, ty - 64 + MA.boil(61, t, 0.8, 4));
      const fanA = 0.35 * Math.sin(MA.step(t, 12) / 12 * 5.2) - 0.3;
      ctx.save(); ctx.translate(gxp + A.gran.hand[0] - 10, ty - 64 + A.gran.hand[1]); ctx.rotate(fanA); MA.draw(ctx, A.gran.fan, 0, 0); ctx.restore();
      MA.glow(ctx, tx, ty - 90, 220, C.goldL, 0.35, 'screen');
    });
    layer(1.0, () => {
      // the child runs across the courtyard, stop-motion on twos
      const run = seg(t, 16.0, 23.3);
      if (run > 0 && run < 1) {
        const kx = lerp(-W * 0.12, W * 1.12, run), ky = Pt ? H * 0.955 : H * 0.96;
        const fr = MA.step(t, 8) % 4;
        const k = A.kid[fr];
        const ks = Pt ? 1.15 : 1.05;
        ctx.save();
        ctx.translate(kx, ky);
        ctx.scale(ks, ks);
        const hx = k.hand[0], hy = k.hand[1];
        const lxp = hx + 78, lyp = -62 + Math.abs(Math.sin(t * 9)) * -6;
        MA.glow(ctx, lxp + 10, lyp + 50, 150, C.goldL, 0.9, 'screen');
        ctx.strokeStyle = C.wood; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lxp, lyp); ctx.stroke();
        MA.draw(ctx, A.rabbit, lxp, lyp, Math.sin(t * 9) * 0.05, 1.5);
        MA.draw(ctx, k, 0, 0);
        ctx.restore();
      }
    });
    // eaves and lanterns in the foreground
    layer(1.15, () => {
      for (const ln of A.lanterns) {
        const sw = Math.sin(t * 1.3 + ln.ph) * 0.055;
        const y0 = A.eh - 20;
        ctx.save();
        ctx.translate(ln.x, y0);
        ctx.rotate(sw);
        ctx.strokeStyle = C.goldD; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, ln.len); ctx.stroke();
        MA.glow(ctx, 0, ln.len + ln.s.by, ln.s.r * 3.2, C.verL, 0.7, 'screen');
        if (ln.hi && pull < 0.9) {
          const a = smooth((0.9 - pull) / 0.25);
          MA.draw(ctx, ln.s, 0, ln.len, 0, 1, 1, 1 - a);
          ctx.globalAlpha = a;
          MA.draw(ctx, A.bigLantern, 0, ln.len, 0, 0.2, 0.2);
          ctx.globalAlpha = 1;
        } else MA.draw(ctx, ln.s, 0, ln.len);
        ctx.restore();
      }
      MA.draw(ctx, A.eaves, 0, 0);
    });
    // osmanthus drifting down across everything
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const sp = 40 + hash(i, 5) * 60;
      const y = ((hash(i, 6) * (H + 200) + (t - 14) * sp) % (H + 200)) - 100;
      const x = hash(i, 7) * W * 1.2 - W * 0.1 + Math.sin(t * 0.8 + i) * 30 - (t - 14) * 18;
      const xx = ((x % (W + 100)) + W + 100) % (W + 100) - 50;
      const near = hash(i, 8);
      ctx.globalAlpha = 0.5 + near * 0.5;
      E.petal(ctx, xx, y, 3 + near * 5, t * (1 + hash(i, 9) * 2) + i, near > 0.6 ? C.goldL : C.gold);
    }
    ctx.restore();
    // memory tint
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = MA.hex('#f6c776', 0.35);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // caption: a scrap of kraft paper taped on, typed one character at a time
    const [c0, c1] = home.CAP_T;
    const ci = easeOut(seg(t, c0, c0 + 0.45)), co = seg(t, c1 - 0.25, c1 + 0.2);
    if (ci > 0 && co < 1) {
      const cp = A.cap;
      ctx.save();
      ctx.translate(cp.x - (1 - ci) * 60, cp.y + (1 - ci) * 30 - co * H * 0.3);
      ctx.rotate(-0.035 + (1 - ci) * 0.1 - co * 0.2);
      ctx.globalAlpha = Math.min(1, ci * 1.5) * (1 - co);
      MA.draw(ctx, A.capSpr, 0, 0);
      MA.draw(ctx, A.capTape, 0, -cp.h / 2 + 2, 0.06);
      ctx.fillStyle = '#2a2026';
      ctx.font = `600 ${L.P ? 36 : 34}px ${MA.SANS}`;
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      let k = Math.floor((t - c0 - 0.35) / 0.085);
      home.CAPTION.forEach((line, li) => {
        const chars = [...line];
        const n = Math.max(0, Math.min(chars.length, k));
        k -= chars.length;
        ctx.fillText(chars.slice(0, n).join(''), -cp.w / 2 + 44, li ? 46 : -8);
      });
      ctx.restore();
    }
  };
})();

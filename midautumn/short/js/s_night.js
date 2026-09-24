'use strict';
// Scene 1 · 深夜: a city of cut paper, one lit window, a message from Mom.
(function () {
  const MA = window.MA;
  const { C, seg, smooth, easeIn, easeOut, easeOutBack, lerp, hash } = MA;
  const P = MA.paper, E = MA.el, B = MA.brush;
  const S = (MA.scenes = MA.scenes || {});

  const night = (S.night = {});

  // Scribbled sticky note.
  function note(col, seed) {
    return P.piece({
      pts: P.rect(-34, -34, 68, 68), color: col, cut: true, seed, grain: 0.5, shadow: { x: 2, y: 4, blur: 5, a: 0.35 },
      paint(g) {
        g.fillStyle = MA.hex('#000000', 0.08); g.fillRect(-34, -34, 68, 12);
        for (let i = 0; i < 3; i++) {
          const y = -12 + i * 14, R = MA.rng(seed * 7 + i);
          const pts = [];
          for (let k = 0; k < 7; k++) pts.push([-24 + k * 8 * (0.6 + 0.4 * R()), y + (R() - 0.5) * 5, 2.2]);
          B.crayon(g, pts, { color: i === 0 ? C.verD : C.ink, alpha: 0.7, seed: seed + i, density: 1.2 });
        }
      },
    });
  }

  night.build = function (L) {
    const { W, H } = L;
    const A = (night.A = {});
    A.sky = E.sky(W, H, [[0, C.night0], [0.6, C.night1], [1, '#2d4280']], {
      halftone: { cell: 11, angle: 0.5, color: MA.hex(C.indigoL, 0.5), f: (x, y) => smooth((y - H * 0.35) / (H * 0.7)) * 0.55 },
    });
    const tallX = L.P ? W * 0.58 : W * 0.66;
    A.far = E.skyline(W * 1.1, H * 0.62, { seed: 11, color: '#33467e', minW: 60, maxW: 130, minH: H * 0.22, maxH: H * (L.P ? 0.4 : 0.48), winW: 5, winH: 7, winGap: 6, winGapY: 8, lit: 0.16, shadow: { x: 0, y: -3, blur: 10, a: 0.3 } });
    A.mid = E.skyline(W * 1.1, H * 0.5, { seed: 23, color: '#1f2d5a', minW: 80, maxW: 170, minH: H * 0.12, maxH: H * (L.P ? 0.26 : 0.32), winW: 7, winH: 10, winGap: 7, winGapY: 10, lit: 0.2 });
    A.near = E.skyline(W * 1.06, H * 0.98, {
      seed: 37, color: '#0f1732', minW: 120, maxW: 230, minH: H * 0.05, maxH: H * (L.P ? 0.14 : 0.19), winW: 10, winH: 15, winGap: 9, winGapY: 12, lit: 0.14,
      tall: { x: tallX + W * 0.03, h: H * 0.8 }, res: 2, shadow: { x: 0, y: -6, blur: 18, a: 0.45 },
    });
    A.win = { x: tallX, y: L.P ? H * 0.40 : H * 0.44 };
    A.target = P.piece({
      pts: P.rect(-17, -22, 34, 44), color: C.goldL, cut: false, shadow: null, res: 4, grain: 0.3,
      paint(g) {
        const gr = g.createLinearGradient(0, -22, 0, 22);
        gr.addColorStop(0, '#ffe9a8'); gr.addColorStop(1, C.gold);
        g.fillStyle = gr; g.fillRect(-17, -22, 34, 44);
        g.fillStyle = '#131a33';
        g.beginPath(); g.arc(-3, 2, 4.2, 0, 6.3); g.fill();
        g.beginPath(); g.arc(-6, -1.5, 2.2, 0, 6.3); g.fill();
        g.beginPath(); g.moveTo(-10, 22); g.quadraticCurveTo(-9, 8, -3, 7); g.quadraticCurveTo(3, 8, 6, 22); g.fill();
        g.fillRect(-17, 12, 34, 3);
        g.fillStyle = '#cfe0ff'; g.fillRect(6, 5, 1.5, 7);
        g.fillStyle = '#131a33'; g.fillRect(-0.8, -22, 1.6, 44); g.fillRect(-17, -1, 34, 1.4);
      },
    });
    // Title slip: vermilion strip with the brush-written title 月圆.
    const sw = 150, sh = 470;
    const title = [];
    ['月', '圆'].forEach((ch, ci) => B.GLYPHS[ch].forEach((st, si) => title.push(B.bake(st, { scale: 1.12, x: -56, y: -185 + ci * 128, seed: 300 + ci * 17 + si, ink: C.riceL, weight: 1.35, dry: 0.35, res: 2 }))));
    A.slip = P.piece({
      pts: P.rect(-sw / 2, -sh / 2, sw, sh), color: C.ver, torn: { amp: 3.5, seed: 44, edge: C.riceL, edgeW: 1.4, edgeVar: 2.5 }, res: 2,
      shadow: { x: 6, y: 10, blur: 16, a: 0.45 }, grain: 0.6,
      paint(g) {
        g.strokeStyle = MA.hex(C.goldL, 0.8); g.lineWidth = 2;
        g.strokeRect(-sw / 2 + 12, -sh / 2 + 12, sw - 24, sh - 24);
        g.lineWidth = 1; g.strokeRect(-sw / 2 + 17, -sh / 2 + 17, sw - 34, sh - 34);
        for (const s of title) B.drawBaked(g, s, 1);
        g.fillStyle = C.riceL;
        g.fillRect(-19, sh / 2 - 94, 38, 38);
        g.fillStyle = C.ver;
        g.font = `700 14px ${MA.SANS}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('中秋', 0, sh / 2 - 75);
        g.fillStyle = MA.hex(C.riceL, 0.85);
        g.font = `500 15px ${MA.SANS}`;
        g.fillText('二〇二六', 0, sh / 2 - 36);
      },
      speckle: 0.25,
    });

    // ---------- interior ----------
    const I = (A.in = {});
    const Pt = L.P;
    I.deskY = Pt ? H * 0.75 : H * 0.72;
    I.s = Pt ? 1.25 : 1.36;
    I.px = Pt ? W * 0.17 : W * 0.2;
    I.win = Pt ? [W * 0.07, H * 0.05, W * 0.86, H * 0.34] : [W * 0.5, H * 0.07, W * 0.45, H * 0.52];
    I.wall = E.sky(W, H, [[0, '#1b274e'], [1, '#283563']], {
      halftone: { cell: 9, angle: 0.785, color: MA.hex('#000000', 0.12), f: (x, y) => 0.25 + 0.35 * (y / H) },
      paint(g) {
        g.strokeStyle = MA.hex('#8fa3d6', 0.05); g.lineWidth = 1;
        for (let x = 0; x < W; x += 46) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      },
    });
    const [wx, wy, ww, wh] = I.win;
    I.winSky = E.sky(Math.ceil(ww), Math.ceil(wh), [[0, C.night0], [1, '#2a3d74']], {
      halftone: { cell: 8, angle: 0.4, color: MA.hex(C.indigoL, 0.5), f: (x, y) => smooth((y - wh * 0.3) / (wh * 0.8)) * 0.5 },
    });
    I.winFar = E.skyline(ww * 1.2, wh * 0.5, { seed: 71, color: '#2b3c72', minW: 26, maxW: 60, minH: wh * 0.12, maxH: wh * 0.34, winW: 3, winH: 4, winGap: 4, winGapY: 5, lit: 0.25, shadow: null });
    I.winNear = E.skyline(ww * 1.2, wh * 0.6, { seed: 83, color: '#17214a', minW: 40, maxW: 90, minH: wh * 0.06, maxH: wh * 0.22, winW: 4, winH: 6, winGap: 5, winGapY: 6, lit: 0.2, shadow: null });
    I.frame = P.piece({
      pts: [[wx - 18, wy - 18], [wx + ww + 18, wy - 18], [wx + ww + 18, wy + wh + 26], [wx - 18, wy + wh + 26]],
      color: '#0d142b', cut: true, grain: 0.4, shadow: { x: 4, y: 8, blur: 14, a: 0.45 },
      paint(g) {
        g.save();
        g.globalCompositeOperation = 'destination-out';
        const cw = (ww - 14) / 2, ch = (wh - 14) / 2;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.fillRect(wx + i * (cw + 14), wy + j * (ch + 14), cw, ch);
        g.restore();
        g.fillStyle = '#26304f';
        g.fillRect(wx - 26, wy + wh + 14, ww + 52, 16);
      },
    });
    I.clock = P.piece({
      pts: P.circle(0, 0, 58, 64), color: C.riceL, grain: 0.5, shadow: { x: 4, y: 6, blur: 10, a: 0.4 },
      paint(g) {
        g.strokeStyle = C.ink; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 54, 0, 6.3); g.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          g.lineWidth = i % 3 ? 2 : 4;
          g.beginPath(); g.moveTo(Math.cos(a) * 42, Math.sin(a) * 42); g.lineTo(Math.cos(a) * 48, Math.sin(a) * 48); g.stroke();
        }
      },
    });
    I.cal = P.piece({
      pts: P.rect(-78, -96, 156, 196), color: C.riceL, grain: 0.5, shadow: { x: 4, y: 7, blur: 10, a: 0.4 },
      paint(g) {
        g.fillStyle = C.ver; g.fillRect(-80, -100, 160, 44);
        g.fillStyle = C.riceL; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `700 20px ${MA.SANS}`; g.fillText('2026 · 九月', 0, -76);
        g.fillStyle = C.ink; g.font = `900 96px ${MA.SANS}`; g.fillText('24', 0, 4);
        g.font = `500 17px ${MA.SANS}`; g.fillStyle = '#4a4552'; g.fillText('星期四 · 八月十四', 0, 62);
        g.fillStyle = C.ver; g.font = `700 16px ${MA.SANS}`; g.fillText('明日中秋', 0, 86);
        g.strokeStyle = MA.hex(C.ink, 0.25); g.setLineDash([3, 4]); g.beginPath(); g.moveTo(-78, -52); g.lineTo(78, -52); g.stroke();
      },
    });
    // Polaroid of the family under a full moon, taped to the wall: the seed of the story.
    I.photo = P.piece({
      pts: P.rect(-74, -86, 148, 172), color: C.riceL, cut: true, grain: 0.5, shadow: { x: 4, y: 8, blur: 10, a: 0.45 },
      paint(g) {
        const gr = g.createLinearGradient(0, -74, 0, 44);
        gr.addColorStop(0, '#2a3569'); gr.addColorStop(1, '#b8573a');
        g.fillStyle = gr; g.fillRect(-62, -74, 124, 118);
        g.fillStyle = C.goldL; g.beginPath(); g.arc(26, -40, 20, 0, 6.3); g.fill();
        g.fillStyle = '#1a1424';
        const fig = (x, h, r) => { g.beginPath(); g.arc(x, 44 - h - r, r, 0, 6.3); g.fill(); g.beginPath(); g.moveTo(x - r * 1.3, 44); g.quadraticCurveTo(x - r * 1.2, 44 - h, x, 44 - h); g.quadraticCurveTo(x + r * 1.2, 44 - h, x + r * 1.3, 44); g.fill(); };
        fig(-36, 44, 9); fig(-10, 50, 10); fig(14, 30, 7); fig(38, 40, 8.5);
        g.fillStyle = MA.hex(C.goldP, 0.25); g.fillRect(-62, 30, 124, 14);
        B.crayon(g, [[-40, 64, 2], [-20, 62, 2], [0, 65, 2], [20, 63, 2]], { color: C.ink, alpha: 0.55, seed: 5, density: 1 });
      },
    });
    I.tape = P.piece({ pts: P.rect(-44, -12, 88, 24), color: MA.hex(C.verP, 0.7), torn: { amp: 1.6, seed: 17, edge: MA.hex(C.verP, 0.5), edgeW: 0.5, edgeVar: 1, straight: (i) => i % 2 === 0 }, shadow: { x: 1, y: 2, blur: 3, a: 0.2 }, grain: 0.3 });
    I.notes = [note(C.goldL, 3), note(C.verP, 5), note('#d9e3a6', 8)];
    I.figure = MA.fig.office('#0b1024');
    I.rim = MA.fig.office(C.goldP);
    I.rimBlue = MA.fig.office('#9fb8f0');
    I.lamp = MA.fig.sprite(MA.fig.path(
      'M -60 0 L 60 0 L 50 -16 L -50 -16 Z', 'M 8 -14 L -6 -14 L -46 -210 L -32 -214 Z', 'M -32 -214 L -44 -204 L -150 -150 L -142 -138 Z',
      'M -120 -170 C -150 -196 -196 -176 -200 -140 L -130 -118 C -116 -130 -112 -154 -120 -170 Z',
    ), [-204, -220, 62, 4], '#1a2447', { shadow: { x: 4, y: 6, blur: 8, a: 0.35 } });
    I.papers = [];
    for (let i = 0; i < 5; i++) I.papers.push(P.piece({ pts: P.rect(-100, -8, 200, 14), color: i % 2 ? C.riceL : C.riceD, cut: true, grain: 0.5, shadow: { x: 2, y: 3, blur: 4, a: 0.3 } }));
    I.laptop = MA.fig.sprite(MA.fig.path('M -120 0 L 110 0 L 104 -12 L -112 -12 Z', 'M 96 -10 L 108 -10 L 58 -196 L 46 -193 Z'), [-122, -200, 112, 2], '#1b233f', { shadow: { x: 3, y: 5, blur: 6, a: 0.35 } });
    I.mug = MA.fig.sprite(MA.fig.path('M -30 0 L 30 0 L 34 -70 L -34 -70 Z', 'M 30 -58 C 58 -58 58 -18 30 -18 L 30 -28 C 46 -28 46 -48 30 -48 Z'), [-36, -74, 52, 2], C.ver, {
      paint(g) { g.fillStyle = MA.hex(C.riceL, 0.9); g.fillRect(-34, -48, 68, 12); },
    });
    I.phone = P.piece({ pts: P.rect(-58, -7, 116, 10), color: '#0e1428', cut: true, grain: 0.3, shadow: { x: 2, y: 3, blur: 4, a: 0.35 } });
    const bw = 640, bh = 150;
    I.bubble = P.piece({
      pts: [[-bw / 2, -bh / 2], [bw / 2, -bh / 2], [bw / 2, bh / 2], [60, bh / 2], [30, bh / 2 + 46], [18, bh / 2], [-bw / 2, bh / 2]],
      color: C.riceL, torn: { amp: 3, seed: 91, edge: '#ffffff' }, res: 1.5, grain: 0.45, shadow: { x: 6, y: 10, blur: 16, a: 0.45 },
      paint(g) {
        g.fillStyle = C.ver;
        g.beginPath(); g.arc(-bw / 2 + 66, 0, 40, 0, 6.3); g.fill();
        g.fillStyle = C.riceL; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `700 36px ${MA.SANS}`; g.fillText('妈', -bw / 2 + 66, 2);
        g.textAlign = 'left';
        g.fillStyle = '#6b6272'; g.font = `500 22px ${MA.SANS}`; g.fillText('妈妈  ·  23:47', -bw / 2 + 130, -36);
        g.fillStyle = C.ink; g.font = `700 36px ${MA.SANS}`; g.fillText('明天中秋了，回家吃饭吗？', -bw / 2 + 130, 14);
        g.fillStyle = MA.hex(C.gold, 0.9); g.fillRect(-bw / 2 + 130, 46, 150, 4);
      },
    });
    I.bubbleTail = [24, bh / 2 + 46];
  };

  function clockHands(ctx, x, y, t) {
    const sec = Math.floor(t) + 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    const hand = (a, len, w, col) => { ctx.strokeStyle = col || C.ink; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a) * len, -Math.cos(a) * len); ctx.stroke(); };
    hand(((11 + 47 / 60) / 12) * Math.PI * 2, 26, 6);
    hand(((47 + sec / 60) / 60) * Math.PI * 2, 40, 4);
    hand((sec / 60) * Math.PI * 2, 44, 2, C.ver);
    ctx.fillStyle = C.ver; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  night.drawCity = function (ctx, t, L) {
    const { W, H } = L;
    const A = night.A;
    const k = easeIn(seg(t, 2.1, 4.95));
    const z = 1 + 0.08 * smooth(seg(t, 0, 2.6)) + 1.9 * k;
    const fx = lerp(W / 2, A.win.x, smooth(seg(t, 0, 4.95)));
    const fy = lerp(H / 2, A.win.y, smooth(seg(t, 0, 4.95)));
    const layer = (d, fn) => { ctx.save(); MA.cam(ctx, L, fx, fy, z, d); fn(); ctx.restore(); };
    layer(0.1, () => ctx.drawImage(A.sky, 0, 0));
    layer(0.12, () => {
      MA.glow(ctx, W * 0.97, -H * 0.08, H * 0.9, C.goldP, 0.75, 'screen');
      E.stars(ctx, t, { n: 70, seed: 3, x0: 0, x1: W, y0: 0, y1: H * 0.5 });
    });
    layer(0.3, () => MA.draw(ctx, A.far, -W * 0.05 + MA.boil(1, t, 0.8), H - A.far.h + H * 0.02));
    layer(0.6, () => MA.draw(ctx, A.mid, -W * 0.04 + MA.boil(2, t, 0.8), H - A.mid.h + H * 0.02));
    layer(1, () => {
      MA.draw(ctx, A.near, -W * 0.03, H - A.near.h + H * 0.02);
      MA.glow(ctx, A.win.x, A.win.y, 40 + 60 * k, C.goldL, 0.8 + k, 'screen');
      MA.draw(ctx, A.target, A.win.x, A.win.y);
    });
    const a = seg(t, 0.35, 1.25), b = seg(t, 3.5, 4.3);
    if (a > 0 && b < 1) {
      const sx = L.P ? W * 0.2 : W * 0.16, sy = L.P ? H * 0.2 : H * 0.36;
      const y = sy - (1 - easeOutBack(a, 1.2)) * H * 0.7 - easeIn(b) * H * 0.9;
      const r = -0.035 + (1 - a) * 0.15 - b * 0.25 + MA.boil(9, t, 0.004);
      MA.draw(ctx, A.slip, sx, y, r);
    }
  };

  night.drawInterior = function (ctx, t, L) {
    const { W, H } = L;
    const I = night.A.in;
    const s = I.s;
    const Pt = L.P;
    ctx.drawImage(I.wall, 0, 0);
    const [wx, wy, ww, wh] = I.win;
    const moonUp = smooth(seg(t, 7.3, 8.7));
    // window view
    ctx.save();
    ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
    ctx.drawImage(I.winSky, wx, wy);
    MA.glow(ctx, wx + ww * 0.9, wy - wh * 0.1, wh * (0.8 + 0.5 * moonUp), C.goldP, 0.5 + 0.7 * moonUp, 'screen');
    E.stars(ctx, t, { n: 24, seed: 8, x0: wx, x1: wx + ww, y0: wy, y1: wy + wh * 0.5, alpha: 0.8 });
    const drift = t * 3;
    MA.draw(ctx, I.winFar, wx - ww * 0.1 - drift * 0.3, wy + wh - I.winFar.h + 6);
    MA.draw(ctx, I.winNear, wx - ww * 0.12 - drift * 0.6, wy + wh - I.winNear.h + 10);
    ctx.restore();
    MA.draw(ctx, I.frame, 0, 0);
    // wall props
    const ck = Pt ? [W * 0.18, H * 0.46] : [W * 0.09, H * 0.19];
    MA.draw(ctx, I.clock, ck[0], ck[1], MA.boil(21, t, 0.01));
    clockHands(ctx, ck[0], ck[1], t);
    const cl = Pt ? [W * 0.76, H * 0.49] : [W * 0.24, H * 0.23];
    MA.draw(ctx, I.cal, cl[0], cl[1], 0.03 + MA.boil(22, t, 0.006));
    const ph = Pt ? [W * 0.46, H * 0.5] : [W * 0.385, H * 0.3];
    MA.draw(ctx, I.photo, ph[0], ph[1], -0.08 + MA.boil(23, t, 0.006));
    MA.draw(ctx, I.tape, ph[0] + 6, ph[1] - 84, 0.05);
    const notes = Pt ? [[W * 0.34, H * 0.45, 0.1], [W * 0.6, H * 0.46, -0.12], [W * 0.62, H * 0.54, 0.06]] : [[W * 0.16, H * 0.34, 0.12], [W * 0.305, H * 0.39, -0.1], [W * 0.46, H * 0.18, 0.08]];
    notes.forEach((n, i) => MA.draw(ctx, I.notes[i], n[0], n[1], n[2] + MA.boil(24 + i, t, 0.01)));
    // desk: a slab seen edge-on with a drawer unit; the chair and legs sit beneath it
    const dy = I.deskY;
    const fx = I.px, fy = dy + 150 * s;
    const dx0 = fx + 70 * s;
    ctx.fillStyle = '#141024';
    ctx.fillRect(0, H * 0.965, W, H * 0.04);
    ctx.fillStyle = '#211a2e';
    ctx.fillRect(W - (Pt ? W * 0.3 : W * 0.26), dy + 20, Pt ? W * 0.3 : W * 0.26, H * 0.965 - dy - 20);
    ctx.fillStyle = MA.hex(C.goldP, 0.12);
    ctx.fillRect(W - (Pt ? W * 0.3 : W * 0.26) + 20, dy + 90, (Pt ? W * 0.3 : W * 0.26) - 40, 3);
    ctx.fillRect(W - (Pt ? W * 0.15 : W * 0.13) - 24, dy + 60, 48, 6);
    ctx.fillStyle = '#211a2e';
    ctx.fillRect(dx0 + 20, dy + 20, 22, H * 0.965 - dy - 20);
    // person (behind the desk slab so the legs tuck underneath)
    const typing = t < 6.45;
    const lookDown = smooth(seg(t, 6.5, 6.95)) * (1 - smooth(seg(t, 7.7, 8.3)));
    const lookUp = smooth(seg(t, 7.8, 8.5));
    const headRot = (typing ? MA.boil(31, t, 0.012, 6) : 0) + lookDown * 0.16 - lookUp * 0.3;
    const armRot = typing ? MA.boil(32, t, 0.03, 12) : 0.04 * lookDown;
    const drawFig = (F, dxo = 0, dyo = 0, alpha = 1, only) => {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(fx + dxo, fy + dyo);
      ctx.scale(s, s);
      if (!only) { MA.draw(ctx, F.chair, 0, 0); MA.draw(ctx, F.body, 0, 0); }
      ctx.save(); ctx.translate(F.neck[0], F.neck[1]); ctx.rotate(headRot); MA.draw(ctx, F.head, -F.neck[0], -F.neck[1]); ctx.restore();
      if (!only) { ctx.save(); ctx.translate(F.shoulder[0], F.shoulder[1]); ctx.rotate(armRot); MA.draw(ctx, F.arm, -F.shoulder[0], -F.shoulder[1]); ctx.restore(); }
      ctx.restore();
    };
    const lapX = fx + 225 * s;
    // laptop's cold light on the face
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const gl = ctx.createRadialGradient(lapX - 20 * s, dy - 120 * s, 10, lapX - 20 * s, dy - 120 * s, 210 * s);
    gl.addColorStop(0, `rgba(170,200,255,${0.32 * (1 - 0.5 * moonUp)})`); gl.addColorStop(1, 'rgba(170,200,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(lapX - 260 * s, dy - 340 * s, 480 * s, 350 * s);
    ctx.restore();
    drawFig(I.rimBlue, 2.5, -1, 1 - moonUp, true);
    drawFig(I.rim, 3, -2, moonUp, true);
    drawFig(I.figure);
    // desk slab over the thighs
    ctx.fillStyle = '#35283a';
    ctx.fillRect(dx0, dy, W - dx0 + 10, 20);
    ctx.fillStyle = MA.hex(C.goldP, 0.16);
    ctx.fillRect(dx0, dy, W - dx0 + 10, 3);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = P.pattern(ctx); ctx.fillRect(dx0, dy, W - dx0, 20); ctx.restore();
    MA.draw(ctx, I.laptop, lapX, dy, 0, s);
    const sp = Pt ? 0.8 : 1;
    const paperX = lapX + 185 * s * sp;
    I.papers.forEach((pp, i) => MA.draw(ctx, pp, paperX + (i % 2) * 8, dy - 6 - i * 9, (hash(i, 4) - 0.5) * 0.06, s * 0.7 * sp));
    const mx = paperX + 125 * s * sp;
    MA.draw(ctx, I.mug, mx, dy, 0, s * 0.8);
    for (let k = 0; k < 2; k++) {
      const pts = [];
      for (let i = 0; i < 12; i++) {
        const f = i / 11;
        pts.push([mx + (k * 14 - 6) * s + Math.sin(f * 5 + t * 2.4 + k * 2) * 10 * s, dy - 66 * s - f * 110 * s, (1 - f) * 7 * s + 1]);
      }
      B.stroke(ctx, pts, { color: MA.hex(C.riceL, 0.2), bristles: 0, seed: 40 + k, step: 4 });
    }
    const phx = mx + 110 * s * sp;
    // lamp at the far end, warm pool of light on the desk
    const lx = Pt ? W * 0.97 : W * 0.78;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const cone = ctx.createRadialGradient(lx - 160 * s, dy, 10, lx - 160 * s, dy, 330 * s);
    cone.addColorStop(0, MA.hex(C.goldL, 0.45)); cone.addColorStop(1, MA.hex(C.goldL, 0));
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(lx - 180 * s, dy - 150 * s); ctx.lineTo(lx - 150 * s, dy - 160 * s); ctx.lineTo(lx - 20 * s, dy + 4); ctx.lineTo(lx - 400 * s, dy + 4); ctx.fill();
    ctx.restore();
    MA.draw(ctx, I.lamp, lx, dy, 0, s * 0.95);
    const buzz = t > 6.2 && t < 6.9 ? Math.sin(t * 90) * 2.5 : 0;
    const lit = seg(t, 6.2, 6.3) * (1 - seg(t, 8.8, 9.2));
    MA.draw(ctx, I.phone, phx + buzz, dy - 4, 0, s * 0.8);
    if (lit > 0) {
      MA.glow(ctx, phx, dy - 8, 90 * s, '#cfe0ff', lit * 0.9, 'screen');
      const pa = seg(t, 6.3, 6.75) * (1 - smooth(seg(t, 7.85, 8.35)));
      const sc = (Pt ? 0.8 : 1) * (0.4 + 0.6 * easeOutBack(pa));
      const tail = I.bubbleTail;
      let bx = phx - tail[0] * sc, by = dy - 26 - tail[1] * sc;
      bx = Math.min(bx, W - 330 * sc - 10);
      MA.draw(ctx, I.bubble, bx + MA.boil(41, t, 1), by - (1 - pa) * 30 + Math.sin(t * 1.6) * 4, -0.02 + (1 - pa) * 0.1, sc, sc, pa);
    }
  };

  night.draw = function (ctx, t, L) {
    if (t < 5.05) night.drawCity(ctx, t, L);
    if (t > 4.15) {
      const p = seg(t, 4.15, 5.05);
      if (p >= 1) night.drawInterior(ctx, t, L);
      else {
        const buf = MA.film.buf(2);
        const bctx = buf.getContext('2d');
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        night.drawInterior(bctx, t, L);
        const e = MA.settle(p * 0.9, 1.1, 5);
        const { W, H } = L;
        ctx.save();
        ctx.translate(W / 2, H / 2 + (1 - easeOut(p)) * H * 1.05);
        ctx.rotate((1 - e) * -0.12);
        const sc = 0.86 + 0.14 * easeOut(p);
        ctx.scale(sc, sc);
        ctx.shadowColor = 'rgba(5,6,16,0.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
        ctx.fillStyle = C.riceL;
        ctx.fillRect(-W / 2 - 10, -H / 2 - 10, W + 20, H + 20);
        ctx.shadowColor = 'transparent';
        ctx.drawImage(buf, -W / 2, -H / 2);
        ctx.restore();
      }
    }
  };
})();

'use strict';
// Scene 6 · 团圆: the moon comes down as a round table seen from above. The family drops into place,
// she takes the last empty seat, the mooncake is cut in six and shared out, and everyone raises a cup.
(function () {
  const MA = window.MA;
  const { C, seg, smooth, easeIn, easeOut, easeInOut, easeOutBack, lerp, hash, rng, makeCanvas } = MA;
  const P = MA.paper, E = MA.el, B = MA.brush, Fg = MA.fig;
  const S = (MA.scenes = MA.scenes || {});
  const re = (S.reunion = {});

  // Seat angles are screen-space degrees around the table; hers is nearest to us.
  const SEATS = [
    { a: 90, who: 'her' },
    { a: 150, who: 'mom', land: 39.62 },
    { a: 210, who: 'grandma', land: 39.42 },
    { a: 270, who: 'grandpa', land: 39.78 },
    { a: 330, who: 'dad', land: 39.95 },
    { a: 30, who: 'niece', land: 40.1 },
  ];
  const LOOK = {
    her: { cloth: '#e6d3ae', hair: '#17131d', bun: true, pin: true, scarf: true },
    mom: { cloth: C.ver, hair: '#1b1520', bun: true },
    grandma: { cloth: '#2c3f73', hair: '#bdb6aa', bun: true, bunCol: '#a39c90', dots: true },
    grandpa: { cloth: '#27505a', hair: '#c4beb4', bald: true },
    dad: { cloth: '#4b5068', hair: '#15121a' },
    niece: { cloth: C.gold, hair: '#1b1520', buns: true },
  };
  re.ARRIVE = [40.35, 41.05];
  re.CUT = [41.35, 41.95];
  re.SPLIT = [41.95, 42.25];
  re.SHARE = 42.35;
  re.TOAST = [43.55, 44.15, 44.8];
  re.FLASH = 46.75;
  const SKIN = '#e9c197';

  // A family member seen from above: shoulders, the crown of the head, a sliver of face towards the table (+y).
  function diner(o) {
    const p = Fg.path(Fg.ell(0, 0, 64, 32), Fg.circ(0, 6, 27));
    return Fg.sprite(p, [-68, -40, 68, 36], o.cloth, {
      shadow: { x: 6, y: 10, blur: 12, a: 0.42 },
      paint(g) {
        g.fillStyle = MA.hex('#000000', 0.16);
        g.beginPath(); g.ellipse(0, 4, 60, 22, 0, 0, Math.PI); g.fill();
        g.strokeStyle = MA.hex('#000000', 0.22); g.lineWidth = 2;
        g.beginPath(); g.moveTo(-40, -22); g.quadraticCurveTo(-46, 0, -40, 24); g.moveTo(40, -22); g.quadraticCurveTo(46, 0, 40, 24); g.stroke();
        if (o.dots) {
          g.fillStyle = MA.hex(C.goldL, 0.55);
          for (let i = 0; i < 26; i++) { const a = hash(i, 3) * 6.28, d = 30 + hash(i, 4) * 30; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d * 0.5, 2.2, 0, 6.3); g.fill(); }
        }
        if (o.scarf) {
          g.fillStyle = C.ver;
          g.beginPath(); g.ellipse(0, 8, 36, 17, 0, 0, 6.3); g.fill();
          g.fillRect(18, 10, 14, 30);
        }
        g.fillStyle = SKIN;
        g.beginPath(); g.arc(0, 6, 27, 0, 6.3); g.fill();
        g.fillStyle = o.hair;
        g.beginPath(); g.arc(0, 2, 27, Math.PI * 0.92, Math.PI * 2.08); g.ellipse(0, 2, 27, 20, 0, 0, Math.PI); g.fill();
        if (o.bald) { g.fillStyle = MA.hex(SKIN, 0.9); g.beginPath(); g.ellipse(0, -2, 11, 9, 0, 0, 6.3); g.fill(); }
        if (o.bun) { g.fillStyle = o.bunCol || o.hair; g.beginPath(); g.arc(0, -22, 12, 0, 6.3); g.fill(); }
        if (o.buns) { g.fillStyle = o.hair; g.beginPath(); g.arc(-17, -14, 10, 0, 6.3); g.arc(17, -14, 10, 0, 6.3); g.fill(); g.fillStyle = C.ver; g.fillRect(-21, -6, 8, 3); g.fillRect(13, -6, 8, 3); }
        if (o.pin) { g.save(); g.translate(0, -22); g.rotate(-0.5); g.fillStyle = C.gold; g.fillRect(-22, -2, 44, 4); g.beginPath(); g.arc(22, 0, 5, 0, 6.3); g.fill(); g.restore(); }
        g.strokeStyle = MA.hex('#ffffff', 0.16); g.lineWidth = 2;
        g.beginPath(); g.arc(0, 4, 20, 3.5, 5.0); g.stroke();
      },
    });
  }

  // Blue-and-white porcelain plate, top view.
  function plateArt(g, r, o = {}) {
    g.fillStyle = C.riceL;
    g.beginPath(); o.oval ? g.ellipse(0, 0, r * o.oval, r, 0, 0, 6.3) : g.arc(0, 0, r, 0, 6.3); g.fill();
    g.strokeStyle = MA.hex(C.indigo, 0.85); g.lineWidth = Math.max(1.5, r * 0.05);
    g.beginPath(); o.oval ? g.ellipse(0, 0, r * o.oval * 0.88, r * 0.88, 0, 0, 6.3) : g.arc(0, 0, r * 0.88, 0, 6.3); g.stroke();
    g.lineWidth = 1;
    g.beginPath(); o.oval ? g.ellipse(0, 0, r * o.oval * 0.8, r * 0.8, 0, 0, 6.3) : g.arc(0, 0, r * 0.8, 0, 6.3); g.stroke();
    g.fillStyle = MA.hex(C.indigoL, 0.7);
    const n = Math.round(r * 0.5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28;
      const x = Math.cos(a) * r * (o.oval || 1) * 0.94, y = Math.sin(a) * r * 0.94;
      g.beginPath(); g.arc(x, y, Math.max(1, r * 0.025), 0, 6.3); g.fill();
    }
  }

  function dish(r, fn, o = {}) {
    const w = r * (o.oval || 1);
    return P.piece({
      pts: o.oval ? P.circle(0, 0, r, 60, w) : P.circle(0, 0, r, 48), color: C.riceL, cut: false, grain: 0.4, res: 1.5,
      shadow: { x: 3, y: 5, blur: 7, a: 0.4 },
      paint(g) { plateArt(g, r, o); fn(g); },
    });
  }

  re.build = function (L) {
    const { W, H } = L;
    const Pt = L.P;
    const A = (re.A = {});
    A.cx = W / 2; A.cy = Pt ? H * 0.5 : H * 0.5 + 6;
    const TR = (A.TR = Pt ? 300 : 334);
    A.ds = Pt ? 1.05 : 1.12;
    A.seatR = TR + 58 * A.ds;
    A.susanR = TR * 0.53;
    // courtyard flagstones, lamplit
    A.floor = E.sky(W, H, [[0, '#3b3552'], [1, '#2e2944']], {
      grain: 0.42,
      paint(g) {
        const R = rng(61);
        const sw = 170, sh = 120;
        g.fillStyle = '#231e36';
        g.fillRect(0, 0, W, H);
        for (let y = -sh; y < H + sh; y += sh) {
          const row = Math.round(y / sh);
          for (let x = -sw + (row % 2) * sw * 0.5; x < W + sw; x += sw) {
            const col = ['#433c5c', '#3d3755', '#4a4264', '#3a3450'][Math.floor(R() * 4)];
            const pts = P.tear(P.rect(x + 5, y + 5, sw - 10, sh - 10), { amp: 2.2, freq: 0.06, seed: Math.floor(R() * 9999), step: 5 });
            g.fillStyle = col;
            g.fill(P.toPath(pts));
          }
        }
        P.halftone(g, 0, 0, W, H, { cell: 9, angle: 0.5, color: MA.hex('#000000', 0.2), f: (x, y) => smooth(Math.hypot(x - W / 2, y - H / 2) / (Math.max(W, H) * 0.6)) * 0.9 });
      },
    });
    // the water jar holds a small moon of its own
    A.jarP = Pt ? [W * 0.2, H * 0.12, 118] : [W * 0.1, H * 0.2, 122];
    A.jar = P.piece({
      pts: P.circle(0, 0, A.jarP[2], 90), color: '#1d3a42', cut: false, grain: 0.5, res: 1.2, shadow: { x: 10, y: 16, blur: 22, a: 0.5 },
      paint(g) {
        const r = A.jarP[2];
        g.strokeStyle = MA.hex('#6f9ea4', 0.5); g.lineWidth = 5;
        g.beginPath(); g.arc(0, 0, r - 6, 0, 6.3); g.stroke();
        g.strokeStyle = MA.hex('#0c1c22', 0.6); g.lineWidth = 3;
        g.beginPath(); g.arc(0, 0, r - 16, 0, 6.3); g.stroke();
        g.save(); g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.arc(0, 0, r - 20, 0, 6.3); g.fill(); g.restore();
      },
    });
    A.potP = Pt ? [W * 0.86, H * 0.88, 150] : [W * 0.92, H * 0.83, 170];
    A.pot = (() => {
      const r = A.potP[2];
      const c = makeCanvas(r * 2.6, r * 2.6);
      const g = c.getContext('2d');
      g.translate(r * 1.3, r * 1.3);
      g.save(); g.shadowColor = 'rgba(6,8,20,0.5)'; g.shadowBlur = 24; g.shadowOffsetX = 10; g.shadowOffsetY = 16;
      g.fillStyle = '#9a5a36'; g.beginPath(); g.arc(0, 0, r * 0.52, 0, 6.3); g.fill(); g.restore();
      g.strokeStyle = '#6e3c22'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, r * 0.47, 0, 6.3); g.stroke();
      const R = rng(71);
      const shades = ['#18323e', '#1f4250', '#2a5462', '#35636c'];
      for (let i = 0; i < 26; i++) {
        const a = R() * 6.28, d = Math.sqrt(R()) * r * 0.7, br = r * (0.2 + R() * 0.16);
        g.save(); g.shadowColor = 'rgba(6,10,20,0.45)'; g.shadowBlur = 10; g.shadowOffsetX = 4; g.shadowOffsetY = 7;
        g.fillStyle = shades[Math.min(3, Math.floor(i / 7))];
        g.fill(P.toPath(P.tear(P.circle(Math.cos(a) * d, Math.sin(a) * d, br, 30, br * 1.1), { amp: br * 0.14, freq: 0.06, seed: i * 7 + 3 })));
        g.restore();
      }
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = 0.5; g.fillStyle = P.pattern(g); g.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 18; i++) { const a = R() * 6.28, d = R() * r * 0.8; E.blossoms(g, Math.cos(a) * d, Math.sin(a) * d, r * 0.1, 10, 80 + i); }
      return { c, ox: r * 1.3, oy: r * 1.3, res: 1 };
    })();
    // tea tray: teapot and two cups
    A.teaP = Pt ? [W * 0.15, H * 0.87] : [W * 0.1, H * 0.8];
    A.tea = P.piece({
      pts: P.rect(-110, -80, 220, 160), color: '#5b3a2c', cut: true, grain: 0.5, shadow: { x: 8, y: 12, blur: 16, a: 0.45 },
      paint(g) {
        g.strokeStyle = MA.hex('#000000', 0.25); g.lineWidth = 2; g.strokeRect(-100, -70, 200, 140);
        for (let y = -60; y < 70; y += 16) { g.strokeStyle = MA.hex('#000000', 0.12); g.beginPath(); g.moveTo(-100, y); g.lineTo(100, y); g.stroke(); }
        g.fillStyle = '#7a4a34'; g.beginPath(); g.arc(-18, -6, 42, 0, 6.3); g.fill();
        g.fillRect(18, -12, 44, 12); g.beginPath(); g.ellipse(-66, -6, 18, 8, 0, 0, 6.3); g.fill();
        g.fillStyle = '#8f5a40'; g.beginPath(); g.arc(-18, -6, 20, 0, 6.3); g.fill();
        g.fillStyle = '#5d3526'; g.beginPath(); g.arc(-18, -6, 7, 0, 6.3); g.fill();
        for (const [x, y] of [[50, 38], [72, -40]]) { g.save(); g.translate(x, y); plateArt(g, 16); g.fillStyle = '#c69a4a'; g.beginPath(); g.arc(0, 0, 10, 0, 6.3); g.fill(); g.restore(); }
      },
    });
    A.lantern = (() => {
      const r = 80;
      const c = makeCanvas(r * 3, r * 3);
      const g = c.getContext('2d');
      g.translate(r * 1.5, r * 1.5);
      g.save(); g.shadowColor = 'rgba(40,6,4,0.5)'; g.shadowBlur = 30; g.shadowOffsetX = 18; g.shadowOffsetY = 26;
      g.fillStyle = C.ver; g.beginPath(); g.arc(0, 0, r, 0, 6.3); g.fill(); g.restore();
      const gr = g.createRadialGradient(-r * 0.2, -r * 0.2, 4, 0, 0, r);
      gr.addColorStop(0, C.verP); gr.addColorStop(0.6, C.verL); gr.addColorStop(1, C.verD);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 6.3); g.fill();
      g.strokeStyle = MA.hex(C.verD, 0.7); g.lineWidth = 2.5;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); }
      g.fillStyle = C.gold; g.beginPath(); g.arc(0, 0, r * 0.36, 0, 6.3); g.fill();
      g.fillStyle = C.goldD; g.beginPath(); g.arc(0, 0, r * 0.14, 0, 6.3); g.fill();
      g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.5; g.fillStyle = P.pattern(g); g.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
      return { c, ox: r * 1.5, oy: r * 1.5, res: 1, r };
    })();
    A.lanternsP = Pt ? [[W * 0.94, H * 0.05, 1.1], [W * 0.1, H * 0.975, 0.9]] : [[W * 0.965, H * 0.1, 1.15], [W * 0.28, -H * 0.01, 0.85]];
    // table: lacquered top with a gold rim
    A.table = P.piece({
      pts: P.circle(0, 0, TR, 200), color: '#8a3624', cut: true, grain: 0.55, res: 1.2, shadow: { x: 16, y: 26, blur: 40, a: 0.55 },
      paint(g) {
        const R = rng(81);
        g.strokeStyle = MA.hex('#5a1c12', 0.35); g.lineWidth = 1.5;
        for (let i = 0; i < 40; i++) {
          const y = -TR + (i / 40) * TR * 2 + (R() - 0.5) * 8;
          g.beginPath(); g.moveTo(-TR, y);
          for (let x = -TR; x <= TR; x += 30) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 4);
          g.stroke();
        }
        const gr = g.createRadialGradient(-TR * 0.3, -TR * 0.3, 10, 0, 0, TR);
        gr.addColorStop(0, 'rgba(255,200,140,0.18)'); gr.addColorStop(1, 'rgba(60,10,5,0.25)');
        g.fillStyle = gr; g.fillRect(-TR, -TR, TR * 2, TR * 2);
        g.strokeStyle = C.gold; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, TR - 8, 0, 6.3); g.stroke();
        g.strokeStyle = MA.hex(C.goldD, 0.8); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, TR - 18, 0, 6.3); g.stroke();
      },
    });
    // lazy susan: a pale-gold paper disc, the moon's stand-in
    const sr = A.susanR;
    A.susan = P.piece({
      pts: P.circle(0, 0, sr, 140), color: '#f1d79a', torn: { amp: 2, seed: 83, edge: '#fff4d6', edgeW: 1.2 }, grain: 0.6, res: 1.2, shadow: { x: 4, y: 8, blur: 12, a: 0.45 },
      paint(g) {
        P.halftone(g, -sr, -sr, sr, sr, { cell: 8, angle: 0.26, color: MA.hex('#c98a2c', 0.45), f: (x, y) => smooth((Math.hypot(x + sr * 0.3, y + sr * 0.3) - sr * 0.7) / (sr * 0.9)) * 0.8 });
        g.strokeStyle = MA.hex(C.goldD, 0.6); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, sr * 0.9, 0, 6.3); g.stroke();
      },
    });
    // dishes on the lazy susan
    A.dishes = [
      { a: 45, s: dish(46, (g) => {  // crabs
        for (const [x, y, r] of [[-14, -10, 0.4], [16, 12, -2.6]]) {
          g.save(); g.translate(x, y); g.rotate(r);
          g.strokeStyle = '#c84a24'; g.lineWidth = 3; g.lineCap = 'round';
          for (let k = -1; k <= 1; k++) for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 8, k * 5); g.lineTo(sd * 20, k * 7 + 4); g.lineTo(sd * 24, k * 8 + 10); g.stroke(); }
          g.lineWidth = 4; g.beginPath(); g.moveTo(-6, -8); g.lineTo(-12, -20); g.moveTo(6, -8); g.lineTo(12, -20); g.stroke();
          g.fillStyle = '#d9542a'; g.beginPath(); g.arc(-13, -22, 5, 0, 6.3); g.arc(13, -22, 5, 0, 6.3); g.fill();
          g.fillStyle = '#e0602e'; g.beginPath(); g.ellipse(0, 0, 14, 11, 0, 0, 6.3); g.fill();
          g.fillStyle = MA.hex('#ffd9a0', 0.5); g.beginPath(); g.ellipse(-3, -3, 6, 4, 0, 0, 6.3); g.fill();
          g.restore();
        }
      }) },
      { a: 135, s: dish(40, (g) => {  // fish, 年年有余
        g.save(); g.rotate(-0.5);
        g.fillStyle = '#c98a4a';
        g.beginPath(); g.moveTo(-34, 0); g.quadraticCurveTo(-4, -18, 22, -4); g.lineTo(34, -12); g.lineTo(30, 0); g.lineTo(34, 12); g.lineTo(22, 4); g.quadraticCurveTo(-4, 18, -34, 0); g.fill();
        g.strokeStyle = MA.hex('#7a4418', 0.6); g.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-14 + i * 7, 0, 5, -1, 1); g.stroke(); }
        g.fillStyle = C.ink; g.beginPath(); g.arc(-25, -3, 2, 0, 6.3); g.fill();
        g.strokeStyle = '#4f9a54'; g.lineWidth = 2;
        for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-22 + i * 9, -8); g.lineTo(-16 + i * 9, 6); g.stroke(); }
        g.strokeStyle = C.goldL; g.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-18 + i * 10, 6); g.lineTo(-12 + i * 10, -6); g.stroke(); }
        g.restore();
      }, { oval: 1.35 }) },
      { a: 225, s: dish(40, (g) => {  // pomelo
        g.fillStyle = '#f0c96a';
        for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -10, 26, -3); g.quadraticCurveTo(14, 6, 0, 0); g.fill(); g.restore(); }
        g.fillStyle = '#a9c25a'; g.beginPath(); g.arc(-18, 18, 9, 0, 6.3); g.fill();
      }) },
      { a: 315, s: dish(40, (g) => {  // osmanthus lotus root
        for (const [x, y] of [[-14, -12], [14, -10], [0, 12], [-18, 14], [18, 14]]) {
          g.fillStyle = '#c98c7a'; g.beginPath(); g.arc(x, y, 12, 0, 6.3); g.fill();
          g.fillStyle = '#e8c2a8'; g.beginPath(); g.arc(x, y, 10, 0, 6.3); g.fill();
          g.fillStyle = '#a4614e';
          for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28; g.beginPath(); g.arc(x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5, 1.8, 0, 6.3); g.fill(); }
          g.beginPath(); g.arc(x, y, 2, 0, 6.3); g.fill();
        }
        E.blossoms(g, 0, 0, 30, 14, 5, C.gold);
      }) },
    ];
    A.cakePlate = dish(64, () => {});
    A.cakeR = 50;
    A.cake = (() => {
      const r = A.cakeR;
      const c = makeCanvas(r * 2 + 8, r * 2 + 8);
      const g = c.getContext('2d');
      E.mooncakeTop(g, r + 4, r + 4, r, { color: '#b8742e', face: '#d9974a' });
      g.fillStyle = MA.hex('#7a4418', 0.8); g.font = `700 ${Math.round(r * 0.34)}px ${MA.SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('团圆', r + 4, r + 5);
      g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.45; g.fillStyle = P.pattern(g); g.fillRect(0, 0, c.width, c.height);
      return { c, ox: r + 4, oy: r + 4, res: 1 };
    })();
    A.bowl = dish(26, (g) => {
      g.fillStyle = '#fbf6ea'; g.beginPath(); g.arc(0, 0, 18, 0, 6.3); g.fill();
      g.fillStyle = MA.hex('#d8cfbd', 0.9);
      for (let i = 0; i < 16; i++) { const a = hash(i, 9) * 6.28, d = hash(i, 10) * 14; g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, 2.4, 1.2, a, 0, 6.3); g.fill(); }
    });
    A.cup = dish(13, (g) => {
      g.fillStyle = '#e1a33c'; g.beginPath(); g.arc(0, 0, 9, 0, 6.3); g.fill();
      g.fillStyle = MA.hex('#fff0c0', 0.6); g.beginPath(); g.arc(-3, -3, 3, 0, 6.3); g.fill();
    });
    A.diners = {};
    for (const k of Object.keys(LOOK)) A.diners[k] = diner(LOOK[k]);
  };

  function seatPos(A, s) {
    const a = (s.a * Math.PI) / 180;
    return { x: A.cx + Math.cos(a) * A.seatR, y: A.cy + Math.sin(a) * A.seatR, a, rot: a + Math.PI / 2 };
  }
  // local seat coords (+y towards the table centre) -> screen
  function toWorld(sp, lx, ly) {
    const c = Math.cos(sp.rot), s = Math.sin(sp.rot);
    return [sp.x + lx * c - ly * s, sp.y + lx * s + ly * c];
  }

  re.susanAt = function (L) { const A = re.A; return { x: A.cx, y: A.cy, r: A.susanR }; };

  re.draw = function (ctx, t, L) {
    const { W, H } = L;
    const A = re.A;
    const Pt = L.P;
    const pull = easeInOut(seg(t, 44.6, 47.2));
    const z = (1.03 - 0.03 * easeOut(seg(t, 39.2, 41))) * (1 - 0.08 * pull);
    const layer = (d, fn) => { ctx.save(); MA.cam(ctx, L, W / 2, H / 2, z, d); fn(); ctx.restore(); };
    const grow = easeOutBack(seg(t, 38.8, 39.35), 1.2);
    // floor and props
    layer(0.9, () => {
      ctx.drawImage(A.floor, 0, 0);
      MA.glow(ctx, A.cx, A.cy, Math.max(W, H) * 0.55, C.goldL, 0.55, 'screen');
      const [jx, jy, jr] = A.jarP;
      // water in the jar: dark, with the moon floating in it
      ctx.save();
      ctx.beginPath(); ctx.arc(jx, jy, jr - 19, 0, 6.3); ctx.clip();
      ctx.fillStyle = '#0e1936'; ctx.fillRect(jx - jr, jy - jr, jr * 2, jr * 2);
      const mx = jx + jr * 0.18 + Math.sin(t * 1.3) * 3, my = jy - jr * 0.12 + Math.cos(t * 1.1) * 2;
      MA.glow(ctx, mx, my, jr * 0.9, C.goldP, 0.6, 'screen');
      const hm = MA.scenes.home.A.moon;
      MA.draw(ctx, hm, mx, my, 0, (jr * 0.3) / (L.P ? 100 : 110), (jr * 0.3) / (L.P ? 100 : 110) * (1 + 0.02 * Math.sin(t * 3)), 0.92);
      ctx.strokeStyle = MA.hex(C.indigoP, 0.35); ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) { const rr = ((t * 22 + k * 30) % 90) + 10; ctx.globalAlpha = 1 - rr / 100; ctx.beginPath(); ctx.arc(jx - jr * 0.3, jy + jr * 0.25, rr, 0, 6.3); ctx.stroke(); }
      ctx.globalAlpha = 1;
      E.petal(ctx, jx - jr * 0.3, jy + jr * 0.25, 7, t * 0.3, C.goldL);
      ctx.restore();
      MA.draw(ctx, A.jar, jx, jy);
      MA.draw(ctx, A.tea, A.teaP[0], A.teaP[1], -0.12);
      MA.draw(ctx, A.pot, A.potP[0], A.potP[1], MA.boil(62, t, 0.006));
    });
    layer(1, () => {
      if (grow <= 0) return;
      ctx.save();
      ctx.translate(A.cx, A.cy);
      ctx.scale(lerp(0.5, 1, grow), lerp(0.5, 1, grow));
      ctx.translate(-A.cx, -A.cy);
      MA.draw(ctx, A.table, A.cx, A.cy);
      ctx.restore();
      const turn = 0.18 * easeInOut(seg(t, 44.9, 47.2));
      const pop = (i) => easeOutBack(seg(t, 39.0 + i * 0.07, 39.35 + i * 0.07), 1.8);
      MA.draw(ctx, A.susan, A.cx, A.cy, turn, grow > 0.98 ? 1 : lerp(0.5, 1, grow));
      A.dishes.forEach((d, i) => {
        const a = (d.a * Math.PI) / 180 + turn;
        const r = A.susanR * 0.62;
        const k = pop(i);
        if (k > 0) MA.draw(ctx, d.s, A.cx + Math.cos(a) * r, A.cy + Math.sin(a) * r, a * 0.5, k);
      });
      // centre: the mooncake, cut into six and shared out
      const kc = pop(4);
      if (kc > 0) MA.draw(ctx, A.cakePlate, A.cx, A.cy, 0, kc);
      const split = easeOut(seg(t, re.SPLIT[0], re.SPLIT[1]));
      if (kc > 0 && t < re.SPLIT[0]) MA.draw(ctx, A.cake, A.cx, A.cy, 0, kc);
      // steam over the fish
      const fa = (135 * Math.PI) / 180 + turn, fr = A.susanR * 0.62;
      for (let k = 0; k < 2; k++) {
        const pts = [];
        for (let i = 0; i < 10; i++) { const f = i / 9; pts.push([A.cx + Math.cos(fa) * fr + (k * 16 - 8) + Math.sin(f * 5 + t * 2.2 + k * 2) * 9, A.cy + Math.sin(fa) * fr - 10 - f * 90, (1 - f) * 6 + 1]); }
        B.stroke(ctx, pts, { color: MA.hex(C.riceL, 0.22), bristles: 0, seed: 70 + k, step: 4 });
      }
      // place settings
      const seats = SEATS.map((s) => ({ s, sp: seatPos(A, s) }));
      for (const { sp } of seats) {
        const bx = A.cx + Math.cos(sp.a) * (A.TR - 52), by = A.cy + Math.sin(sp.a) * (A.TR - 52);
        MA.draw(ctx, A.bowl, bx, by, 0, grow > 0.98 ? 1 : 0);
        const [c0x, c0y] = toWorld(sp, -44, 72), [c1x, c1y] = toWorld(sp, -36, 150);
        ctx.strokeStyle = '#5a1a14'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        if (grow > 0.98) { ctx.beginPath(); ctx.moveTo(c0x, c0y); ctx.lineTo(c1x, c1y); ctx.moveTo(c0x + 6, c0y + 2); ctx.lineTo(c1x + 5, c1y + 1); ctx.stroke(); }
      }
      // cake wedges fly to every bowl
      if (t >= re.SPLIT[0]) {
        for (let k = 0; k < 6; k++) {
          const a = ((30 + k * 60) * Math.PI) / 180;
          const go = easeInOut(seg(t, re.SHARE + k * 0.09, re.SHARE + 0.6 + k * 0.09));
          // the wedge's centroid (0.64 r from its tip) ends up over the bowl
          const d = split * 10 + go * (A.TR - 52 - A.cakeR * 0.5 * 0.64 - 10);
          const lift = Math.sin(go * Math.PI) * 0.18;
          const x = A.cx + Math.cos(a) * d, y = A.cy + Math.sin(a) * d;
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(1 + lift - go * 0.5, 1 + lift - go * 0.5);
          if (lift > 0.01) { ctx.shadowColor = 'rgba(8,6,16,0.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 10 * lift / 0.18; }
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, A.cakeR + 1, a - Math.PI / 6, a + Math.PI / 6); ctx.closePath();
          ctx.clip();
          MA.draw(ctx, A.cake, 0, 0);
          ctx.restore();
        }
      }
      // knife lines, brushed in one after another
      const cut = seg(t, re.CUT[0], re.CUT[1]);
      if (cut > 0 && t < re.SPLIT[1]) {
        for (let k = 0; k < 3; k++) {
          const p = MA.clamp(cut * 3 - k);
          if (p <= 0) continue;
          const a = ((30 + k * 60) * Math.PI) / 180, r = A.cakeR + 6;
          const x0 = A.cx - Math.cos(a) * r, y0 = A.cy - Math.sin(a) * r;
          const x1 = lerp(x0, A.cx + Math.cos(a) * r, p), y1 = lerp(y0, A.cy + Math.sin(a) * r, p);
          ctx.strokeStyle = MA.hex('#4a2410', 0.85 * (1 - split)); ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          if (p < 1) { ctx.fillStyle = MA.hex('#e8eef7', 0.9); ctx.save(); ctx.translate(x1, y1); ctx.rotate(a); ctx.fillRect(-4, -34, 8, 40); ctx.fillStyle = '#3a2a22'; ctx.fillRect(-5, -64, 10, 30); ctx.restore(); }
        }
      }
      // family members and their arms
      const arr = seg(t, re.ARRIVE[0], re.ARRIVE[1]);
      const lean = smooth(seg(t, 40.95, 41.5)) * (1 - smooth(seg(t, 43.2, 43.8)));
      const herSp = seats[0].sp;
      const toastIn = easeInOut(seg(t, re.TOAST[0], re.TOAST[1])), toastOut = easeInOut(seg(t, re.TOAST[1] + 0.35, re.TOAST[2] + 0.35));
      const toast = toastIn * (1 - toastOut);
      // everyone stands and leans in for the toast: seen from above that means closer and bigger
      const stand = smooth(seg(t, re.TOAST[0] - 0.4, re.TOAST[0] + 0.2)) * (1 - smooth(seg(t, re.TOAST[2] + 0.2, re.TOAST[2] + 0.8)));
      const figs = [];
      seats.forEach(({ s, sp }, i) => {
        let x = sp.x - Math.cos(sp.a) * 64 * stand, y = sp.y - Math.sin(sp.a) * 64 * stand, sc = A.ds * (1 + 0.12 * stand), al = 1, rot = sp.rot;
        if (s.who === 'her') {
          if (arr <= 0) return;
          const e = easeOut(arr);
          y = lerp(H + 140, y, e) + (1 - MA.settle(seg(t, re.ARRIVE[1] - 0.1, re.ARRIVE[1] + 0.9), 1.6, 5)) * -6;
          x += (1 - e) * 60;
          rot = sp.rot + (1 - e) * 0.25;
          sc *= 1 + 0.08 * (1 - e);
        } else {
          const p = seg(t, s.land - 0.32, s.land);
          if (p <= 0) return;
          sc *= 1 + 0.35 * (1 - easeIn(p)) - 0.03 * Math.sin(seg(t, s.land, s.land + 0.3) * Math.PI);
          al = smooth(p * 1.6);
          x += (herSp.x - x) * 0.04 * lean; y += (herSp.y - y) * 0.04 * lean;
        }
        figs.push({ s, sp: Object.assign({}, sp, { x, y, rot }), sc, al, i });
      });
      for (const f of figs) {
        const { sp } = f;
        // cup: rests by the bowl, lifted to the middle for the toast
        const rest = [A.cx + Math.cos(sp.a + 0.2) * (A.TR - 44), A.cy + Math.sin(sp.a + 0.2) * (A.TR - 44)];
        const mid = [A.cx + Math.cos(sp.a + 0.1) * A.susanR * 0.62, A.cy + Math.sin(sp.a + 0.1) * A.susanR * 0.62];
        const k = f.s.who === 'her' ? toast * smooth(arr) : toast;
        const cx = lerp(rest[0], mid[0], k), cy = lerp(rest[1], mid[1], k);
        const q = f.sc;
        const [lsx, lsy] = toWorld(sp, -50 * q, 8 * q), [rsx, rsy] = toWorld(sp, 50 * q, 8 * q);
        const [lhx, lhy] = toWorld(sp, -34 * q, 76 * q);
        const [r0x, r0y] = toWorld(sp, 34 * q, 76 * q);
        const reach = smooth(k / 0.3);
        const rhx = lerp(r0x, cx, reach), rhy = lerp(r0y, cy, reach);
        const col = LOOK[f.s.who].cloth;
        ctx.save();
        ctx.globalAlpha = f.al;
        for (const [sx, sy, hx, hy, sd] of [[lsx, lsy, lhx, lhy, -1], [rsx, rsy, rhx, rhy, 1]]) {
          const mx = (sx + hx) / 2 + (hy - sy) * 0.08 * sd, my = (sy + hy) / 2 - (hx - sx) * 0.08 * sd;
          B.stroke(ctx, [[sx, sy, 24 * q], [mx, my, 20 * q], [hx, hy, 15 * q]], { color: col, bristles: 2, rough: 0.5, seed: 90 + f.i * 3 + sd, streak: 'rgba(255,240,220,0.2)', step: 4 });
          ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(hx, hy, 8 * q, 0, 6.3); ctx.fill();
        }
        MA.draw(ctx, A.cup, cx, cy, 0, 1 + 0.25 * Math.sin(k * Math.PI * 0.5));
        MA.draw(ctx, A.diners[f.s.who], sp.x, sp.y, sp.rot, f.sc);
        ctx.restore();
      }
      // the clink: gold paper sparks at the centre
      const since = t - re.TOAST[1];
      if (since > 0 && since < 0.9) {
        for (let i = 0; i < 22; i++) {
          const a = hash(i, 1) * 6.28, v = 120 + hash(i, 2) * 260;
          const d = v * easeOut(since / 0.9) * 0.9;
          ctx.save();
          ctx.globalAlpha = 1 - since / 0.9;
          ctx.translate(A.cx + Math.cos(a) * d, A.cy + Math.sin(a) * d);
          ctx.rotate(a + since * 6);
          ctx.fillStyle = i % 3 === 0 ? C.ver : i % 3 === 1 ? C.goldL : C.riceL;
          if (i % 2) ctx.fillRect(-6, -2, 12, 4);
          else { ctx.beginPath(); for (let q = 0; q < 8; q++) { const b = (q / 8) * 6.28, rr = q % 2 ? 2.5 : 7; ctx.lineTo(Math.cos(b) * rr, Math.sin(b) * rr); } ctx.fill(); }
          ctx.restore();
        }
      }
    });
    // hanging lanterns, closest to the camera
    layer(1.3, () => {
      for (const [x, y, s] of A.lanternsP) {
        const sw = Math.sin(t * 1.2 + x) * 8;
        MA.glow(ctx, x + sw, y, 320 * s, C.verL, 0.6, 'screen');
        MA.draw(ctx, A.lantern, x + sw, y, t * 0.1, s);
      }
    });
    // osmanthus drifting down over everything
    ctx.save();
    for (let i = 0; i < 46; i++) {
      const sp = 50 + hash(i, 25) * 70;
      const y = ((hash(i, 26) * (H + 200) + (t - 38) * sp) % (H + 200)) - 100;
      const x0 = hash(i, 27) * (W + 200) - 100 + Math.sin(t * 0.7 + i) * 40 + (t - 38) * 24;
      const x = ((x0 % (W + 200)) + W + 200) % (W + 200) - 100;
      const near = hash(i, 28);
      ctx.globalAlpha = 0.55 + near * 0.45;
      E.petal(ctx, x, y, 3 + near * 6, t * (1 + hash(i, 29) * 2) + i, near > 0.6 ? C.goldL : C.gold);
    }
    ctx.restore();
    // warm grade
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = MA.hex('#f3b866', 0.3);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // camera flash for the family photo
    const fl = t - re.FLASH;
    if (fl > -0.05 && fl < 0.5) {
      ctx.fillStyle = `rgba(255,250,236,${fl < 0 ? (fl + 0.05) / 0.05 : 1 - fl / 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  };

  // Match cut: the moon over the river glides to the middle of the frame and settles as the lazy susan.
  re.enter = function (ctx, t, L) {
    const { W, H } = L;
    const A = re.A;
    const T = MA.scenes.train;
    re.draw(ctx, t, L);
    const fade = smooth(seg(t, 38.75, 39.3));
    const buf = MA.film.buf(1);
    const b = buf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    T.draw(b, t, L, { noMoon: true });
    const pm = easeInOut(seg(t, 38.3, 39.0));
    if (fade < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - fade;
      const zs = 1 + 0.12 * pm;
      ctx.translate(W / 2, H / 2); ctx.scale(zs, zs); ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(buf, 0, 0);
      ctx.restore();
    }
    const m = T.moonAt(t, L);
    const x = lerp(m.x, A.cx, pm), y = lerp(m.y, A.cy, pm);
    const s = lerp(1, A.susanR / m.r, pm);
    const a = 1 - smooth(seg(t, 39.05, 39.4));
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = a;
      T.moon(ctx, x, y, s);
      ctx.restore();
    }
  };
})();

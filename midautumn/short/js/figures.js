'use strict';
// Paper-cut figures. Each is a baked sprite (or a few jointed parts) with scissor-cut holes.
(function () {
  const MA = window.MA;
  const { C, makeCanvas, hash } = MA;
  const P = MA.paper;
  const F = (MA.fig = {});

  const path = (...parts) => {
    const p = new Path2D();
    for (const s of parts) p.addPath(typeof s === 'string' ? new Path2D(s) : s);
    return p;
  };
  const circ = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; };
  const ell = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); return p; };
  F.path = path; F.circ = circ; F.ell = ell;

  const cut = (g, fn) => { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.strokeStyle = '#000'; fn(g); g.restore(); };
  F.cut = cut;

  function sprite(p, bounds, color, o = {}) {
    return P.piece({ path: p, bounds, color, shadow: o.shadow === undefined ? { x: 3, y: 5, blur: 8, a: 0.35 } : o.shadow, grain: o.grain ?? 0.5, paint: o.paint, after: o.after, res: o.res || 1 });
  }
  F.sprite = sprite;

  // ---------- the protagonist at her desk, side view facing right; origin = seat ----------
  F.office = function (col) {
    const body = sprite(path(
      'M -42 -8 C -62 -84 -54 -172 -26 -222 C -12 -244 18 -250 32 -236 L 40 -200 C 46 -150 42 -84 36 -24 L 122 -22 C 140 -20 144 -4 134 8 L 132 150 L 158 158 L 160 172 L 104 172 L 104 26 L -40 20 Z',
    ), [-70, -255, 165, 176], col, { shadow: { x: 4, y: 5, blur: 8, a: 0.3 } });
    const head = sprite(path(
      'M -8 -238 C -32 -262 -32 -312 -4 -330 C 22 -348 62 -334 65 -302 L 67 -292 L 77 -280 L 68 -273 L 70 -265 L 65 -259 C 63 -250 53 -243 42 -243 L 34 -232 L 4 -230 Z',
      circ(-15, -332, 22),
    ), [-40, -356, 80, -228], col, { shadow: { x: 4, y: 5, blur: 8, a: 0.3 } });
    const arm = sprite(path(
      'M -8 -228 C 18 -206 44 -168 58 -134 L 150 -158 C 160 -160 167 -152 161 -144 L 62 -108 C 44 -110 32 -124 26 -140 C 16 -170 0 -190 -20 -202 Z',
    ), [-22, -232, 168, -104], col, { shadow: { x: 3, y: 4, blur: 6, a: 0.3 } });
    const chair = sprite(path(
      'M -96 -214 C -104 -150 -100 -60 -86 -10 L 44 -10 L 44 16 L -82 16 L -90 -8 C -110 -60 -112 -150 -106 -214 Z',
      'M -30 16 L -16 16 L -16 128 L -30 128 Z', 'M -96 126 L 58 126 L 58 138 L -96 138 Z',
      circ(-88, 146, 9), circ(50, 146, 9),
    ), [-112, -216, 60, 156], '#0c1226', { shadow: { x: 3, y: 5, blur: 6, a: 0.25 } });
    return { body, head, arm, chair, neck: [14, -236], shoulder: [4, -212] };
  };

  // ---------- back view at the window, origin = bottom centre ----------
  F.back = function (col) {
    const body = sprite(path(
      'M -272 0 C -264 -88 -214 -144 -128 -168 C -94 -178 -66 -188 -56 -206 C -50 -228 -46 -248 -42 -262 L 46 -262 C 50 -248 54 -228 60 -206 C 70 -188 98 -178 134 -168 C 218 -144 266 -88 274 0 Z',
    ), [-276, -266, 278, 4], col, { shadow: false });
    const head = sprite(path(ell(0, -338, 84, 98), circ(8, -446, 42), ell(-82, -324, 13, 22), ell(84, -324, 13, 22)), [-100, -492, 104, -236], col, {
      shadow: false,
      paint(g) {
        // hair combed up into the bun, a few strands catching the moonlight
        g.strokeStyle = MA.hex(C.indigoP, 0.22);
        g.lineWidth = 1.6;
        for (const [a, b] of [[-54, -398], [-22, -416], [30, -412]]) {
          g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo(a * 1.15, -350, a * 0.95, -300); g.stroke();
        }
        g.strokeStyle = MA.hex(C.indigoP, 0.3);
        g.lineWidth = 2.5;
        g.beginPath(); g.arc(8, -446, 30, -2.6, -0.6); g.stroke();
      },
    });
    const pin = sprite(path('M 22 -500 L 30 -498 L -6 -404 L -12 -406 Z', circ(26, -502, 7)), [-16, -512, 36, -400], C.gold, { shadow: false });
    return { body, head, pin, neck: [2, -250] };
  };

  // ---------- little girl running with a rabbit lantern (4 cycle frames), origin = feet ----------
  F.kid = function (col) {
    const frames = [];
    for (let k = 0; k < 4; k++) {
      const ph = (k / 4) * Math.PI * 2;
      const legA = Math.sin(ph) * 0.55, legB = -legA;
      const armS = Math.sin(ph) * 0.35;
      const bob = Math.abs(Math.cos(ph)) * 6;
      const p = new Path2D();
      const leg = (a, x) => {
        const q = new Path2D();
        const m = new DOMMatrix().translate(x, -64 - bob).rotate((a * 180) / Math.PI);
        q.addPath(new Path2D('M -7 0 L 7 0 L 8 58 L 20 62 L 20 70 L -8 70 Z'), m);
        return q;
      };
      p.addPath(leg(legA, -8));
      p.addPath(leg(legB, 8));
      p.addPath(new Path2D(`M -22 ${-146 - bob} C -10 ${-152 - bob} 12 ${-152 - bob} 22 ${-146 - bob} L 42 ${-58 - bob} C 16 ${-50 - bob} -16 ${-50 - bob} -42 ${-58 - bob} Z`));
      p.addPath(circ(2, -176 - bob, 30));
      p.addPath(circ(-24, -202 - bob, 13));
      p.addPath(circ(28, -202 - bob, 13));
      // back arm swinging
      const arm = new Path2D();
      arm.addPath(new Path2D('M -6 0 L 6 0 L 5 50 L -5 50 Z'), new DOMMatrix().translate(-14, -138 - bob).rotate(((0.5 - armS) * 180) / Math.PI));
      p.addPath(arm);
      // front arm holding the lantern stick forward
      p.addPath(new Path2D(`M 12 ${-138 - bob} L 58 ${-112 - bob} L 54 ${-102 - bob} L 8 ${-124 - bob} Z`));
      const s = sprite(p, [-70, -224, 80, 12], col, {
        paint(g) {
          cut(g, (c) => {
            c.beginPath(); c.ellipse(16, -178 - bob, 4, 2.4, 0.2, 0, 6.3); c.fill();          // eye
            P.crescent(c, 0, -110 - bob, 7, 0.4); P.crescent(c, -18, -86 - bob, 6, 0.9); P.crescent(c, 16, -84 - bob, 6, 0.1);
            c.beginPath(); c.arc(-24, -202 - bob, 5, 0, 6.3); c.arc(28, -202 - bob, 5, 0, 6.3); c.fill();
          });
        },
      });
      s.hand = [56, -106 - bob];
      frames.push(s);
    }
    return frames;
  };

  // Rabbit lantern on a stick: small white rabbit with glowing body; origin at the stick end (top).
  F.rabbitLantern = function () {
    const p = path(ell(0, 40, 34, 24), circ(28, 22, 16), ell(22, -2, 5, 16, -0.3), ell(34, -1, 5, 16, 0.25), circ(-32, 36, 8));
    const s = sprite(p, [-44, -20, 50, 68], C.riceL, {
      paint(g) {
        const gr = g.createRadialGradient(0, 40, 2, 0, 40, 40);
        gr.addColorStop(0, '#fff3c4'); gr.addColorStop(1, '#f2c77a');
        g.fillStyle = gr; g.fillRect(-50, -20, 100, 90);
        g.fillStyle = C.ver; g.beginPath(); g.arc(34, 19, 3, 0, 6.3); g.fill();
        g.strokeStyle = MA.hex(C.ver, 0.6); g.lineWidth = 2;
        g.beginPath(); g.moveTo(-26, 40); g.quadraticCurveTo(0, 30, 20, 44); g.stroke();
      },
    });
    return s;
  };

  // Grandmother on a stool; fan arm is a separate part. origin = floor.
  F.grandma = function (col) {
    const body = sprite(path(
      'M -40 -150 C -26 -170 26 -170 40 -150 L 58 -70 L 92 -66 L 96 -40 L 60 -34 L 64 0 L -60 0 L -56 -70 Z',
      circ(0, -186, 30), circ(-24, -208, 17),
      'M -50 0 L 50 0 L 44 -8 L -44 -8 Z',
    ), [-64, -228, 100, 4], col, {
      paint(g) {
        cut(g, (c) => {
          c.beginPath(); c.ellipse(16, -188, 4, 2.2, 0.1, 0, 6.3); c.fill();
          for (let i = 0; i < 4; i++) P.crescent(c, -24 + i * 16, -110 + (i % 2) * 14, 6, 0.3 + i);
          c.lineWidth = 2; c.beginPath(); c.moveTo(-40, -58); c.lineTo(52, -60); c.stroke();
        });
      },
    });
    const stool = sprite(path('M -50 0 L 50 0 L 50 10 L -50 10 Z', 'M -44 10 L -34 10 L -40 64 L -50 64 Z', 'M 34 10 L 44 10 L 50 64 L 40 64 Z'), [-54, -2, 54, 66], C.wood);
    const fan = sprite(path('M -4 0 L 4 0 L 4 -40 L -4 -40 Z', circ(0, -70, 34)), [-36, -106, 36, 4], C.goldL, {
      paint(g) {
        g.strokeStyle = MA.hex(C.goldD, 0.7); g.lineWidth = 2;
        g.beginPath(); g.arc(0, -70, 28, 0, 6.3); g.stroke();
        g.fillStyle = MA.hex(C.ver, 0.8);
        g.beginPath(); g.arc(8, -76, 9, 0, 6.3); g.fill();
        g.fillStyle = MA.hex(C.ink, 0.6);
        g.beginPath(); g.moveTo(-20, -56); g.quadraticCurveTo(0, -70, 16, -92); g.lineTo(18, -90); g.quadraticCurveTo(2, -66, -18, -52); g.fill();
      },
    });
    return { body, stool, fan, hand: [70, -60] };
  };

  // ---------- Chang'e, flying up and to the right; origin = waist ----------
  F.change = function (col) {
    const p = path(
      // robe sweeping back and down in an S
      'M 6 -66 C 34 -56 40 -26 32 4 C 24 44 2 84 -38 124 C -78 162 -138 184 -214 196 C -160 176 -118 146 -96 114 C -66 72 -44 40 -34 8 C -26 -24 -22 -52 -6 -70 Z',
      // upper body and raised front arm / sleeve
      'M -8 -70 C 4 -92 26 -98 40 -86 C 60 -100 86 -126 104 -150 C 110 -142 112 -134 108 -126 C 94 -104 70 -80 44 -60 C 40 -40 30 -30 20 -28 Z',
      // trailing sleeve
      'M -10 -60 C -40 -40 -80 -30 -120 -40 C -96 -24 -70 -14 -40 -12 C -26 -14 -16 -30 -10 -44 Z',
      circ(30, -114, 22),
      // hair: one bun at the back of the head
      ell(10, -138, 15, 12, -0.7), circ(24, -126, 18),
    );
    return sprite(p, [-220, -172, 116, 200], col, {
      shadow: { x: 5, y: 8, blur: 12, a: 0.35 },
      paint(g) {
        cut(g, (c) => {
          c.beginPath(); c.ellipse(44, -114, 4, 2.2, -0.4, 0, 6.3); c.fill();
          // robe folds and moon cuts
          c.lineWidth = 3; c.lineCap = 'round';
          for (const k of [0, 1, 2]) {
            c.beginPath(); c.moveTo(20 - k * 16, -20 + k * 8); c.quadraticCurveTo(-10 - k * 22, 60 + k * 10, -80 - k * 30, 150 + k * 8); c.stroke();
          }
          for (let i = 0; i < 6; i++) P.crescent(c, -14 - i * 22, 40 + i * 22, 6, 0.6 + i * 0.3);
          P.crescent(c, 12, -50, 7, 1.2);
          c.beginPath(); c.arc(-60, -30, 5, 0, 6.3); c.arc(-86, -32, 4, 0, 6.3); c.fill();
        });
      },
    });
  };

  // Ribbon drawn live behind Chang'e: a waving silk band.
  F.ribbon = function (ctx, x, y, t, o) {
    const pts = [];
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const along = f * o.len;
      const wave = Math.sin(f * 5.5 - t * 3.2 + o.phase) * (8 + f * 26) + Math.sin(f * 2.3 - t * 1.4) * f * 30;
      const px = x + Math.cos(o.ang) * along - Math.sin(o.ang) * wave;
      const py = y + Math.sin(o.ang) * along + Math.cos(o.ang) * wave;
      const w = o.w * (0.55 + 0.45 * Math.sin(f * Math.PI)) * (1 - f * 0.55);
      pts.push([px, py, w]);
    }
    MA.brush.stroke(ctx, pts, { color: o.color, seed: o.seed, bristles: 4, rough: 0.8, streak: o.streak || 'rgba(255,240,210,0.4)', step: 4 });
  };

  // ---------- Jade rabbit pounding medicine; origin = base. arm part pivots at shoulder ----------
  F.rabbit = function () {
    const body = sprite(path(
      ell(0, -62, 50, 64), circ(30, -142, 36), ell(8, -212, 12, 46, -0.28), ell(34, -216, 12, 46, 0.02), circ(-48, -24, 15), ell(10, -6, 44, 11),
    ), [-66, -264, 70, 8], C.riceL, {
      shadow: { x: 3, y: 6, blur: 8, a: 0.3 },
      paint(g) {
        g.fillStyle = MA.hex(C.verP, 0.7);
        g.beginPath(); g.ellipse(9, -212, 5, 32, -0.28, 0, 6.3); g.ellipse(34, -216, 5, 32, 0.02, 0, 6.3); g.fill();
        g.fillStyle = C.ver;
        g.beginPath(); g.arc(46, -148, 5, 0, 6.3); g.fill();
        g.fillStyle = MA.hex(C.verL, 0.5);
        g.beginPath(); g.arc(52, -128, 6, 0, 6.3); g.fill();
        cut(g, (c) => {
          for (let i = 0; i < 5; i++) P.crescent(c, -26 + (i % 3) * 22, -96 + Math.floor(i / 3) * 40 + (i % 2) * 8, 7, 0.4 + i * 0.7);
          c.lineWidth = 2.2; c.lineCap = 'round';
          c.beginPath(); c.moveTo(-30, -20); c.quadraticCurveTo(0, -8, 30, -18); c.stroke();
        });
      },
    });
    const arm = sprite(path('M -8 -8 C 10 -18 34 -10 44 4 L 36 14 C 26 4 10 0 -4 6 Z', 'M 36 -30 L 46 -30 L 50 70 L 38 70 Z', ell(44, 76, 12, 9)), [-10, -34, 58, 88], C.goldP, {
      shadow: { x: 3, y: 5, blur: 6, a: 0.3 },
      paint(g) {
        g.fillStyle = C.riceL;
        g.beginPath(); g.moveTo(-8, -8); g.bezierCurveTo(10, -18, 34, -10, 44, 4); g.lineTo(36, 14); g.bezierCurveTo(26, 4, 10, 0, -4, 6); g.fill();
        g.fillStyle = MA.hex(C.goldD, 0.6);
        g.fillRect(36, 20, 14, 4); g.fillRect(36, 40, 14, 4);
      },
    });
    const mortar = sprite(path('M -44 -40 L 44 -40 L 36 -4 C 30 6 -30 6 -36 -4 Z', 'M -50 -48 L 50 -48 L 50 -38 L -50 -38 Z', 'M -20 0 L 20 0 L 28 12 L -28 12 Z'), [-52, -50, 52, 14], C.indigo, {
      paint(g) {
        g.strokeStyle = MA.hex(C.goldL, 0.6); g.lineWidth = 2;
        g.beginPath(); g.moveTo(-30, -26); g.lineTo(30, -26); g.stroke();
        P.crescent(g, 0, -20, 7, -1.57);
      },
    });
    return { body, arm, mortar, shoulder: [40, -100] };
  };

  // ---------- family seen from behind, each with arms up (lantern) or down; origin = feet ----------
  F.person = function (h, o = {}) {
    const s = h / 300;
    const col = o.color || C.ink;
    const p = new Path2D();
    const m = new DOMMatrix().scale(s, s);
    // bent: a rounded back and the head carried lower and forward
    const hb = o.bent ? 22 : 0;
    p.addPath(new Path2D(o.bent
      ? 'M -14 -214 C -34 -222 -54 -214 -60 -196 C -64 -176 -60 -150 -56 -130 C -54 -108 -52 -90 -50 -70 L -46 -40 L -40 0 L -6 0 L -3 -56 L 3 -56 L 6 0 L 40 0 L 46 -40 L 50 -70 C 52 -90 54 -108 56 -130 C 60 -150 64 -176 60 -196 C 54 -214 34 -222 14 -214 Z'
      : 'M -14 -232 C -30 -227 -48 -222 -56 -210 C -62 -200 -60 -170 -56 -140 C -54 -110 -52 -90 -50 -70 L -46 -40 L -40 0 L -6 0 L -3 -56 L 3 -56 L 6 0 L 40 0 L 46 -40 L 50 -70 C 52 -90 54 -110 56 -140 C 60 -170 62 -200 56 -210 C 48 -222 30 -227 14 -232 Z'), m);
    if (o.skirt) p.addPath(new Path2D('M -54 -120 C -60 -80 -66 -40 -70 -12 L 70 -12 C 66 -40 60 -80 54 -120 Z'), m);
    p.addPath(ell(0, (-262 + hb) * s, 30 * s, 34 * s));
    if (o.bun) p.addPath(circ(0, (-298 + hb) * s, 16 * s));
    if (o.buns) { p.addPath(circ(-26 * s, (-288 + hb) * s, 13 * s)); p.addPath(circ(26 * s, (-288 + hb) * s, 13 * s)); }
    const sy = o.bent ? 18 : 0;
    const armUp = new Path2D('M -58 -204 C -52 -216 -42 -218 -38 -212 L -12 -318 C -14 -328 -28 -330 -32 -322 Z M 58 -204 C 52 -216 42 -218 38 -212 L 12 -318 C 14 -328 28 -330 32 -322 Z');
    const armDown = new Path2D(`M -54 ${-210 + sy} C -70 ${-200 + sy} -74 -170 -72 -140 C -70 -112 -68 -96 -64 -80 L -52 -80 C -54 -100 -56 -130 -54 -160 Z M 54 ${-210 + sy} C 70 ${-200 + sy} 74 -170 72 -140 C 70 -112 68 -96 64 -80 L 52 -80 C 54 -100 56 -130 54 -160 Z`);
    const up = new Path2D(); up.addPath(p); up.addPath(armUp, m);
    const down = new Path2D(); down.addPath(p); down.addPath(armDown, m);
    const b = [-80 * s, -336 * s, 80 * s, 4];
    return {
      up: sprite(up, b, col, { shadow: false, grain: 0.35 }),
      down: sprite(down, b, col, { shadow: false, grain: 0.35 }),
      handY: -320 * s,
    };
  };

  // ---------- diner seen from above; origin = seat centre, facing +y (towards table centre) ----------
  F.diner = function (o) {
    const p = path(ell(0, 0, 70, 38), circ(0, -6, 30));
    return sprite(p, [-74, -44, 74, 42], o.cloth, {
      shadow: { x: 4, y: 6, blur: 8, a: 0.35 },
      paint(g) {
        g.fillStyle = o.hair || C.ink;
        g.beginPath(); g.arc(0, -6, 30, 0, 6.3); g.fill();
        if (o.bun) { g.beginPath(); g.arc(0, -30, 13, 0, 6.3); g.fill(); }
        if (o.buns) { g.beginPath(); g.arc(-22, -18, 10, 0, 6.3); g.arc(22, -18, 10, 0, 6.3); g.fill(); }
        if (o.grey) { g.fillStyle = MA.hex('#c9c3b8', 0.9); g.beginPath(); g.arc(0, -6, 30, 0, 6.3); g.fill(); g.fillStyle = '#a9a39a'; g.beginPath(); g.arc(0, -28, 12, 0, 6.3); g.fill(); }
        g.strokeStyle = MA.hex('#ffffff', 0.18); g.lineWidth = 2;
        g.beginPath(); g.arc(0, -6, 22, 3.6, 5.2); g.stroke();
      },
    });
  };
})();

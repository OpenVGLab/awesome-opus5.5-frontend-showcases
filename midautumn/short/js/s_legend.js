'use strict';
// Scene 4 · 传说: the moon as a stage for paper-cut legends — Chang'e rising on her ribbons,
// the Jade Rabbit pounding medicine on the beat under the osmanthus tree.
(function () {
  const MA = window.MA;
  const { C, seg, smooth, easeOut, easeIn, easeOutBack, lerp, hash, rng, makeCanvas } = MA;
  const P = MA.paper, E = MA.el, B = MA.brush;
  const S = (MA.scenes = MA.scenes || {});
  const legend = (S.legend = {});
  legend.BEAT0 = 25.5;
  legend.BEAT = 0.75;

  // Gold paper-cut corner ornament (角花).
  function corner(r) {
    const c = makeCanvas(r + 20, r + 20);
    const g = c.getContext('2d');
    g.translate(4, 4);
    g.fillStyle = C.gold;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(r, 0); g.arc(0, 0, r, 0, Math.PI / 2); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = 5;
    for (const k of [0.82, 0.62]) { g.beginPath(); g.arc(0, 0, r * k, 0.05, Math.PI / 2 - 0.05); g.stroke(); }
    for (let i = 0; i < 5; i++) {
      const a = ((i + 0.5) / 5) * (Math.PI / 2);
      g.save(); g.translate(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); g.rotate(a);
      g.beginPath(); g.ellipse(0, 0, r * 0.07, r * 0.035, 0, 0, 6.3); g.fill(); g.restore();
      P.crescent(g, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.04, a);
    }
    for (let i = 0; i < 3; i++) {
      const a = ((i + 0.5) / 3) * (Math.PI / 2);
      g.save(); g.translate(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36); g.rotate(a);
      g.beginPath(); g.moveTo(-r * 0.12, 0); g.quadraticCurveTo(0, -r * 0.08, r * 0.12, 0); g.quadraticCurveTo(0, r * 0.08, -r * 0.12, 0); g.fill(); g.restore();
    }
    g.beginPath(); g.arc(0, 0, r * 0.14, 0, Math.PI / 2); g.lineTo(0, 0); g.fill();
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.5; g.fillStyle = P.pattern(g); g.fillRect(0, 0, r, r);
    const f = makeCanvas(c.width, c.height);
    const fg = f.getContext('2d');
    fg.shadowColor = 'rgba(0,0,0,0.45)'; fg.shadowBlur = 8; fg.shadowOffsetX = 3; fg.shadowOffsetY = 4;
    fg.drawImage(c, 0, 0);
    return { c: f, ox: 4, oy: 4, res: 1 };
  }

  // Osmanthus tree cut from dark gold paper, for the moon's surface.
  function moonTree(s) {
    const p = new Path2D();
    p.addPath(new Path2D('M -10 0 L 10 0 L 8 -60 C 20 -80 40 -90 60 -110 L 54 -118 C 36 -100 18 -90 6 -76 L 4 -130 L -4 -130 L -6 -80 C -20 -96 -40 -104 -58 -120 L -64 -112 C -44 -96 -22 -80 -8 -60 Z'));
    for (const [x, y, r] of [[0, -160, 60], [-60, -128, 44], [60, -132, 46], [-30, -196, 40], [34, -198, 40], [-86, -160, 30], [88, -164, 30]]) p.addPath(MA.fig.circ(x, y, r));
    return MA.fig.sprite(p, [-120, -240, 120, 4], '#b9782c', {
      shadow: { x: 3, y: 5, blur: 6, a: 0.3 },
      paint(g) {
        MA.fig.cut(g, (c) => {
          const R = rng(5);
          for (let i = 0; i < 22; i++) {
            const a = R() * 6.28, d = R() * 70;
            P.crescent(c, Math.cos(a) * d * 1.3, -160 + Math.sin(a) * d * 0.8, 5 + R() * 4, R() * 6.28);
          }
          c.lineWidth = 3;
          c.beginPath(); c.moveTo(0, -20); c.lineTo(0, -120); c.stroke();
        });
        E.blossoms(g, 0, -165, 90, 40, 17, C.goldP);
      },
    });
  }

  legend.build = function (L) {
    const { W, H } = L;
    const Pt = L.P;
    const A = (legend.A = {});
    A.sky = E.sky(W, H, [[0, '#0a1030'], [0.6, '#17245a'], [1, '#253a78']], {
      halftone: [
        { cell: 12, angle: 0.5, color: MA.hex(C.indigoL, 0.45), f: (x, y) => smooth((y - H * 0.5) / (H * 0.6)) * 0.5 },
        { cell: 10, angle: 1.1, color: MA.hex(C.goldP, 0.12), f: (x, y) => smooth(1 - Math.hypot(x - W / 2, y - H * 0.45) / (H * 0.7)) * 0.7 },
      ],
    });
    A.R = Pt ? 330 : 350;
    A.mx = W * 0.5; A.my = Pt ? H * 0.37 : H * 0.47;
    A.moon = E.moon(A.R, { seed: 14, res: 1.2, light: '#fbe3a0', color: '#f0c565', blobs: [[-0.42, -0.42, 0.12], [0.3, -0.48, 0.1], [0.5, 0.1, 0.1], [-0.6, 0.05, 0.08]] });
    A.halo = E.halo(A.R, { n: 4, alpha: 0.09 });
    A.corner = corner(Pt ? 190 : 220);
    A.clouds = [0, 1, 2, 3, 4].map((i) => E.xiangyun(Pt ? 70 + i * 8 : 80 + i * 10, { color: i % 2 ? C.goldL : C.riceL }));
    A.change = MA.fig.change(C.ver);
    A.rabbit = MA.fig.rabbit();
    A.tree = moonTree();
  };

  // Chang'e's flight path: quadratic curve from below the frame up beside the moon.
  legend.changePos = function (t, L) {
    const { W, H } = L;
    const u = easeOut(seg(t, 24.7, 32.6));
    const p0 = L.P ? [-0.15 * W, 1.05 * H] : [-0.1 * W, 1.12 * H];
    const p1 = L.P ? [0.25 * W, 0.86 * H] : [0.12 * W, 0.62 * H];
    const p2 = L.P ? [0.2 * W, 0.66 * H] : [0.27 * W, 0.3 * H];
    const x = (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0];
    const y = (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1];
    const dx = 2 * (1 - u) * (p1[0] - p0[0]) + 2 * u * (p2[0] - p1[0]);
    const dy = 2 * (1 - u) * (p1[1] - p0[1]) + 2 * u * (p2[1] - p1[1]);
    return { x, y, ang: Math.atan2(dy, dx), u };
  };

  // Pestle angle on the beat: slow lift, fast drop, impact on the beat.
  legend.pestle = function (t) {
    if (t < legend.BEAT0 - 0.6) return -0.2;
    const ph = (((t - legend.BEAT0) / legend.BEAT) % 1 + 1) % 1;
    return ph < 0.72 ? -0.62 * easeOut(ph / 0.72) : -0.62 * (1 - easeIn((ph - 0.72) / 0.28));
  };

  legend.draw = function (ctx, t, L) {
    const { W, H } = L;
    const A = legend.A;
    const Pt = L.P;
    const z = 1.04 - 0.04 * smooth(seg(t, 24, 32));
    const layer = (d, fn) => { ctx.save(); MA.cam(ctx, L, W / 2, H / 2, z, d); fn(); ctx.restore(); };
    layer(0.2, () => {
      ctx.drawImage(A.sky, 0, 0);
      E.stars(ctx, t, { n: 110, seed: 31, x0: 0, x1: W, y0: 0, y1: H });
    });
    // clouds behind the moon
    layer(0.5, () => {
      const cl = (i, x, y, sp, s) => {
        const w = W + 600;
        const xx = (((x + (t - 24) * sp) % w) + w) % w - 300;
        MA.draw(ctx, A.clouds[i], xx, y, 0, s, s, 0.9);
      };
      cl(0, W * 0.1, H * 0.2, 14, 1);
      cl(3, W * 0.75, H * 0.14, -10, 0.9);
    });
    layer(0.8, () => {
      MA.glow(ctx, A.mx, A.my, A.R * 2.4, C.goldP, 0.45, 'screen');
      MA.draw(ctx, A.halo, A.mx, A.my, 0, 1 + 0.015 * Math.sin(t * 1.1));
      MA.draw(ctx, A.moon, A.mx, A.my);
      // tree grows up out of the moon's surface
      const tg = easeOutBack(seg(t, 24.6, 25.4), 1.4);
      if (tg > 0) {
        ctx.save();
        ctx.translate(A.mx + A.R * 0.36, A.my + A.R * 0.52);
        ctx.scale(Pt ? 1.2 : 1.3, (Pt ? 1.2 : 1.3) * tg);
        MA.draw(ctx, A.tree, 0, 0, MA.boil(71, t, 0.01));
        ctx.restore();
      }
      // rabbit pops up, then pounds on every beat
      const rp = easeOutBack(seg(t, 24.9, 25.45), 2);
      if (rp > 0) {
        const tt = MA.step(t, 12) / 12;
        const ang = legend.pestle(tt);
        const rx = A.mx - A.R * 0.32, ry = A.my + A.R * 0.62;
        const sc = (Pt ? 1.05 : 1.15) * rp;
        const R = A.rabbit;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.scale(sc, sc);
        MA.draw(ctx, R.mortar, 96, 0);
        MA.draw(ctx, R.body, 0, ang * 6);
        ctx.save(); ctx.translate(R.shoulder[0], R.shoulder[1] + ang * 6); ctx.rotate(ang * 0.35); ctx.translate(0, ang * 60); MA.draw(ctx, R.arm, 0, 0); ctx.restore();
        // medicine dust on impact
        if (t > legend.BEAT0 - 0.05) {
          const k = Math.floor((t - legend.BEAT0 + 0.02) / legend.BEAT);
          const since = t - (legend.BEAT0 + k * legend.BEAT);
          if (since >= 0 && since < 0.45) {
            for (let i = 0; i < 9; i++) {
              const a = -Math.PI / 2 + (hash(i, k, 1) - 0.5) * 2.2;
              const d = 20 + since * (120 + hash(i, k, 2) * 90);
              ctx.globalAlpha = 1 - since / 0.45;
              ctx.fillStyle = i % 2 ? C.riceL : C.goldP;
              ctx.beginPath(); ctx.arc(96 + Math.cos(a) * d * 0.7, -46 + Math.sin(a) * d * 0.6 + since * since * 200, 3 + hash(i, k, 3) * 3, 0, 6.3); ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        }
        ctx.restore();
      }
    });
    // Chang'e and her ribbons
    const cp = legend.changePos(t, L);
    if (t > 24.7) {
      layer(1, () => {
        const sc = Pt ? 1.15 : 1.3;
        const bob = Math.sin(t * 1.7) * 6;
        ctx.save();
        ctx.translate(cp.x, cp.y + bob);
        ctx.rotate(cp.ang + Math.PI / 4 + Math.sin(t * 1.3) * 0.05);
        ctx.scale(sc, sc);
        MA.fig.ribbon(ctx, -20, -40, t, { len: 420, ang: Math.PI * 0.72, w: 26, phase: 0, color: C.goldL, seed: 3 });
        MA.fig.ribbon(ctx, 10, -60, t + 0.4, { len: 340, ang: Math.PI * 0.8, w: 20, phase: 2, color: C.verL, seed: 4, streak: 'rgba(255,230,200,0.35)' });
        MA.draw(ctx, A.change, 0, 0);
        MA.fig.ribbon(ctx, 30, -80, t + 0.9, { len: 260, ang: Math.PI * 0.62, w: 14, phase: 4, color: C.riceL, seed: 5, streak: 'rgba(200,170,120,0.35)' });
        ctx.restore();
      });
    }
    // clouds in front + corner ornaments
    layer(1.1, () => {
      const cl = (i, x, y, sp, s) => {
        const w = W + 600;
        const xx = (((x + (t - 24) * sp) % w) + w) % w - 300;
        MA.draw(ctx, A.clouds[i], xx, y, 0, s, s, 1);
      };
      cl(1, W * 0.2, Pt ? H * 0.62 : H * 0.84, 22, 1.1);
      cl(2, W * 0.8, Pt ? H * 0.7 : H * 0.9, -18, 1.3);
      cl(4, W * 0.55, Pt ? H * 0.9 : H * 0.97, 30, 1.2);
    });
    const ca = easeOut(seg(t, 24.2, 24.9));
    const r = A.corner;
    const off = (1 - ca) * 120;
    MA.draw(ctx, r, -off, -off, 0);
    MA.draw(ctx, r, W + off, -off, Math.PI / 2);
    MA.draw(ctx, r, W + off, H + off, Math.PI);
    MA.draw(ctx, r, -off, H + off, -Math.PI / 2);
  };
})();

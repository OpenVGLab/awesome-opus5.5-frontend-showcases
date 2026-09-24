'use strict';
// Scene 7 · 中秋快乐: by the river at home the family lets a sky lantern go; lanterns rise from the whole valley,
// the camera follows them up, and a brush writes 中秋快乐 on gold-flecked rice paper. Seal, hold, fade.
(function () {
  const MA = window.MA;
  const { C, seg, smooth, easeIn, easeOut, easeInOut, easeOutBack, lerp, hash, rng, makeCanvas } = MA;
  const P = MA.paper, E = MA.el, B = MA.brush, Fg = MA.fig;
  const S = (MA.scenes = MA.scenes || {});
  const wish = (S.wish = {});
  wish.START = 46.75;
  wish.RELEASE = 49.2;
  wish.TILT = [51.3, 53.2];
  wish.PAPER = [52.75, 53.3];
  wish.WRITE = [53.35, 57.25];
  wish.SEAL = 57.4;
  wish.INSCRIBE = [57.6, 58.05];
  // [time, x, y, radius, palette]
  wish.FIREWORKS = [[49.75, 0.52, 0.36, 110, 0], [50.4, 0.63, 0.27, 140, 1], [51.0, 0.44, 0.44, 95, 2], [51.6, 0.6, 0.46, 100, 0]];
  wish.TITLE = '中秋快乐';

  // Paper lotus lamp floating on the river; origin at the waterline.
  function lotusLamp(s) {
    const c = makeCanvas(s * 3, s * 2.2);
    const g = c.getContext('2d');
    g.translate(s * 1.5, s * 1.5);
    g.fillStyle = '#3f7a5c';
    g.beginPath(); g.ellipse(0, 0, s * 1.35, s * 0.36, 0, 0, 6.3); g.fill();
    const petal = (a, len, wid, col) => {
      g.save(); g.rotate(a); g.fillStyle = col;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(wid, -len * 0.5, 0, -len); g.quadraticCurveTo(-wid, -len * 0.5, 0, 0); g.fill(); g.restore();
    };
    for (const [a, col] of [[-1.15, C.verP], [1.15, C.verP], [-0.75, '#f3b39a'], [0.75, '#f3b39a']]) petal(a, s * 1.05, s * 0.36, col);
    g.fillStyle = C.goldL; g.beginPath(); g.ellipse(0, -s * 0.28, s * 0.3, s * 0.12, 0, 0, 6.3); g.fill();
    for (const [a, col] of [[-0.35, '#fbd3bf'], [0.35, '#fbd3bf'], [0, '#fde6d6']]) petal(a, s * 1.1, s * 0.34, col);
    g.fillStyle = '#fff6d0'; g.beginPath(); g.ellipse(0, -s * 0.72, s * 0.08, s * 0.14, 0, 0, 6.3); g.fill();
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.5; g.fillStyle = P.pattern(g); g.fillRect(-s * 1.5, -s * 1.5, s * 3, s * 2.2);
    return { c, ox: s * 1.5, oy: s * 1.5, res: 1 };
  }

  // Paper-cut chrysanthemum firework, drawn live.
  const FW = [[C.goldL, C.gold, C.riceL], [C.verL, C.goldL, C.verP], [C.riceL, C.goldP, '#9fb8f0']];
  function firework(ctx, x, y, r, pal, age) {
    if (age < -0.55 || age > 1.8) return;
    const cols = FW[pal];
    if (age < 0) {
      // launch trail
      const f = 1 + age / 0.55;
      ctx.strokeStyle = MA.hex(C.goldP, 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + r * 2.2); ctx.lineTo(x, lerp(y + r * 2.2, y, easeOut(f))); ctx.stroke();
      return;
    }
    const e = easeOut(Math.min(1, age / 0.9));
    const fade = 1 - smooth((age - 0.7) / 1.1);
    MA.glow(ctx, x, y, r * 2, cols[0], 0.9 * (1 - smooth(age / 0.6)), 'screen');
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round';
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 + hash(i, pal, 5) * 0.12;
      const rr = r * (0.85 + hash(i, pal, 6) * 0.3) * e;
      const droop = age * age * 16;
      ctx.strokeStyle = cols[i % 3];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * rr * 0.55, y + Math.sin(a) * rr * 0.55 + droop * 0.5);
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr + droop);
      ctx.stroke();
      ctx.fillStyle = cols[(i + 1) % 3];
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr * 1.08, y + Math.sin(a) * rr * 1.08 + droop * 1.2, 3, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  }

  // A calligraphy brush whose hair tip sits at the origin.
  function brush(ctx, x, y, lift, ang) {
    ctx.save();
    ctx.translate(x, y - lift * 16);
    ctx.rotate(ang);
    ctx.shadowColor = 'rgba(10,8,20,0.35)'; ctx.shadowBlur = 8 + lift * 10; ctx.shadowOffsetX = 6 + lift * 16; ctx.shadowOffsetY = 8 + lift * 20;
    ctx.fillStyle = '#c9a26a';
    ctx.fillRect(-7, -330, 14, 282);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = MA.hex('#7a5a30', 0.6);
    for (const y0 of [-300, -230, -150]) ctx.fillRect(-7, y0, 14, 3);
    ctx.fillStyle = C.ink; ctx.fillRect(-8, -340, 16, 12);
    ctx.strokeStyle = C.ver; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -340); ctx.quadraticCurveTo(10, -366, -4, -380); ctx.stroke();
    ctx.fillStyle = C.gold; ctx.fillRect(-9, -58, 18, 12);
    ctx.fillStyle = '#1a1614';
    ctx.beginPath(); ctx.moveTo(-9, -48); ctx.bezierCurveTo(-11, -20, -4, -6, 0, 0); ctx.bezierCurveTo(4, -6, 11, -20, 9, -48); ctx.fill();
    ctx.restore();
  }

  wish.build = function (L) {
    const { W, H } = L;
    const Pt = L.P;
    const A = (wish.A = {});
    A.tiltH = H * (Pt ? 0.34 : 0.4);
    const top = Math.ceil(A.tiltH * 0.3);
    A.skyTop = top;
    A.sky = E.sky(W, H + top, [[0, '#060a22'], [0.45, '#111a47'], [0.78, '#2a2b62'], [1, '#4d3b6d']], {
      halftone: [
        { cell: 11, angle: 0.5, color: MA.hex(C.indigoL, 0.4), f: (x, y) => smooth((y - (H + top) * 0.45) / ((H + top) * 0.5)) * 0.5 },
        { cell: 10, angle: 1.1, color: MA.hex(C.goldP, 0.1), f: (x, y) => smooth(1 - Math.hypot(x - W * 0.8, y - H * 0.3) / (H * 0.6)) * 0.7 },
      ],
    });
    A.mx = Pt ? W * 0.7 : W * 0.81; A.my = Pt ? H * 0.14 : H * 0.22; A.mr = Pt ? 150 : 165;
    A.moon = E.moon(A.mr, { seed: 27, res: 1.3, legend: true });
    A.halo = E.halo(A.mr, { n: 4, alpha: 0.1 });
    A.horizon = Pt ? H * 0.64 : H * 0.62;
    A.hillW = Math.ceil(W * 1.2);
    const T = MA.scenes.train;
    A.far = T.ridge(A.hillW, H * 0.32, { seed: 41, base: 0.9, amp: 0.55, k0: 2, k1: 10, color: '#2b3570', mist: '#8f98cc', lit: '#c9d0f0', litW: 30 });
    A.near = T.ridge(A.hillW, H * 0.26, { seed: 44, base: 0.92, amp: 0.45, k0: 2, k1: 12, color: '#1b2150', mist: '#6a74a8', houses: 6, lit: '#9fa9d8', litW: 20 });
    A.waterY = A.horizon + H * 0.05;
    A.bankY = Pt ? H * 0.9 : H * 0.87;
    const bp = [[-40, 400]];
    const nb = T.profile(52, 2, 12);
    for (let x = -40; x <= W + 40; x += 20) bp.push([x, 10 + nb(x / W) * 26 - Math.max(0, 1 - Math.abs(x - W * (Pt ? 0.5 : 0.28)) / (W * 0.3)) * 20]);
    bp.push([W + 40, 400]);
    A.bank = P.piece({
      pts: bp, color: '#0a0d20', torn: { amp: 3, seed: 53, edge: MA.hex(C.indigoP, 0.4), edgeW: 1 }, grain: 0.4, shadow: { x: 0, y: -4, blur: 14, a: 0.4 },
      paint(g) {
        const R = rng(54);
        g.strokeStyle = '#141a38'; g.lineWidth = 3; g.lineCap = 'round';
        for (let i = 0; i < 90; i++) { const x = R() * W, h = 12 + R() * 34; g.beginPath(); g.moveTo(x, 36); g.quadraticCurveTo(x + (R() - 0.5) * 10, 36 - h * 0.6, x + (R() - 0.5) * 18, 36 - h); g.stroke(); }
      },
    });
    // the family from behind; she and her niece hold the lantern up between them
    const fs = Pt ? 0.92 : 1;
    const col = '#0b0e22';
    A.fam = [
      { k: 'grandma', x: Pt ? 0.12 : 0.13, h: 250, o: { bent: true, bun: true, skirt: true } },
      { k: 'grandpa', x: Pt ? 0.26 : 0.185, h: 285, o: {} },
      { k: 'dad', x: Pt ? 0.41 : 0.24, h: 330, o: {} },
      { k: 'her', x: Pt ? 0.56 : 0.3, h: 300, o: { bun: true }, up: true },
      { k: 'niece', x: Pt ? 0.69 : 0.345, h: 190, o: { buns: true, skirt: true }, up: true },
      { k: 'mom', x: Pt ? 0.84 : 0.4, h: 298, o: { bun: true } },
    ].map((m) => Object.assign(m, { f: Fg.person(m.h * fs, Object.assign({ color: col }, m.o)), rim: Fg.person(m.h * fs, Object.assign({ color: C.goldP }, m.o)) }));
    A.feetY = A.bankY + (Pt ? 64 : 58);
    // grass in front of their feet
    A.grass = P.piece({
      pts: P.rect(-20, -80, W + 40, 90), cut: false, fill: false, shadow: null, grain: 0.3,
      paint(g) {
        const R = rng(57);
        g.lineCap = 'round';
        for (let i = 0; i < 260; i++) {
          const x = R() * W, h = 26 + R() * 50, lean = (R() - 0.5) * 22;
          g.strokeStyle = R() < 0.5 ? '#0a0d20' : '#11163a'; g.lineWidth = 2 + R() * 3;
          g.beginPath(); g.moveTo(x, 10); g.quadraticCurveTo(x + lean * 0.4, 10 - h * 0.6, x + lean, 10 - h); g.stroke();
        }
      },
    });
    A.lanternS = Pt ? 100 : 110;
    A.skyLantern = E.skyLantern(A.lanternS);
    A.smallLantern = E.skyLantern(40);
    // distant lantern with its glow baked around it (one drawImage each instead of a gradient + a sprite)
    A.glowLantern = (() => {
      const c = makeCanvas(152, 152);
      const g = c.getContext('2d');
      const ox = 76, oy = 95, gy = oy - 18.75;
      const gr = g.createRadialGradient(ox, gy, 0, ox, gy, 75);
      gr.addColorStop(0, MA.hex(C.goldL, 0.44)); gr.addColorStop(0.35, MA.hex(C.goldL, 0.17)); gr.addColorStop(1, MA.hex(C.goldL, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 152, 152);
      const s = A.smallLantern;
      g.drawImage(s.c, ox - s.ox, oy - s.oy);
      return { c, ox, oy, res: 1 };
    })();
    A.lamp = lotusLamp(34);
    // rice paper strip mounted on an indigo backing, gold flecks
    const pw = Pt ? 420 : 1130, ph = Pt ? 1270 : 400;
    A.pw = pw; A.ph = ph;
    A.px = Pt ? W * 0.36 : W * 0.37; A.py = Pt ? H * 0.5 : H * 0.44;
    // distant lanterns rising from the whole valley; each is aimed at a spot of open sky in the final frame
    A.far_l = [];
    const tEnd = 58.6, mfx = A.mx, mfy = A.my + A.tiltH * 0.35;
    const R = rng(66);
    for (let i = 0; A.far_l.length < 48 && i < 400; i++) {
      const d = 0.35 + R() * 0.6, x = R() * W, yf = (R() * 0.86 - 0.04) * H, t0 = 47.0 + R() * 5.2;
      if (Math.hypot(x - mfx, yf - mfy) < A.mr * 1.25) continue;
      if (Math.abs(x - A.px) < pw / 2 + 60 && Math.abs(yf - A.py) < ph / 2 + 60) continue;
      const v = (A.horizon - 10 + A.tiltH * d - yf) / (tEnd - t0);
      if (v < 12) continue;
      A.far_l.push({ x, t0, d, v, s: 0.18 + d * 0.5, ph: R() * 6.28 });
    }
    A.backing = P.piece({
      pts: P.rect(-pw / 2 - 26, -ph / 2 - 26, pw + 52, ph + 52), color: '#1e2a5c', torn: { amp: 3, seed: 71, edge: MA.hex(C.riceL, 0.7), edgeW: 1.2 }, grain: 0.55,
      shadow: { x: 12, y: 20, blur: 30, a: 0.55 },
      paint(g) {
        g.strokeStyle = MA.hex(C.gold, 0.75); g.lineWidth = 2;
        g.strokeRect(-pw / 2 - 14, -ph / 2 - 14, pw + 28, ph + 28);
        P.halftone(g, -pw / 2 - 30, -ph / 2 - 30, pw / 2 + 30, ph / 2 + 30, { cell: 7, angle: 0.8, color: MA.hex(C.goldL, 0.14), f: () => 0.5 });
      },
    });
    A.paper = P.piece({
      pts: P.rect(-pw / 2, -ph / 2, pw, ph), color: '#f6eedb', torn: { amp: 2.4, seed: 72, edge: '#fffdf6', edgeW: 1.2, edgeVar: 2 }, grain: 0.75, grainKind: 'riceGrain', res: 1,
      shadow: { x: 3, y: 5, blur: 8, a: 0.35 },
      paint(g) {
        const R = rng(73);
        for (let i = 0; i < (Pt ? 90 : 110); i++) {
          const x = (R() - 0.5) * pw, y = (R() - 0.5) * ph, r = 2 + R() * R() * 9;
          g.fillStyle = MA.hex(R() < 0.7 ? C.gold : C.goldL, 0.55 + R() * 0.4);
          g.beginPath();
          for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28 + R(), rr = r * (0.5 + R() * 0.7); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          g.fill();
        }
        const gr = g.createRadialGradient(0, 0, 10, 0, 0, Math.max(pw, ph) * 0.7);
        gr.addColorStop(0, 'rgba(255,250,235,0)'); gr.addColorStop(1, 'rgba(160,120,70,0.16)');
        g.fillStyle = gr; g.fillRect(-pw / 2, -ph / 2, pw, ph);
      },
    });
    // the title, stroke by stroke, on the paper's local coordinates
    const gs = Pt ? 2.3 : 2.12, step = Pt ? 262 : 252;
    const chars = [...wish.TITLE];
    const sched = B.schedule(wish.TITLE, { perUnit: 0.0028, gap: 0.05, charGap: 0.14 });
    const total = sched[sched.length - 1].t1;
    const k = (wish.WRITE[1] - wish.WRITE[0]) / total;
    A.strokes = sched.map((s) => {
      const ox = Pt ? -gs * 50 : -((chars.length - 1) * step) / 2 - gs * 50 + s.ci * step + 10;
      const oy = Pt ? -((chars.length - 1) * step) / 2 - gs * 50 + s.ci * step - 40 : -gs * 50 - 26;
      const st = B.bake(B.GLYPHS[s.ch][s.si], { scale: gs, x: ox, y: oy, seed: 500 + s.ci * 31 + s.si * 7, ink: '#15121a', weight: 1.42, dry: 0.55, res: 1.5 });
      return { st, t0: wish.WRITE[0] + s.t0 * k, t1: wish.WRITE[0] + s.t1 * k, ci: s.ci };
    });
    wish.strokes = A.strokes.map((s) => ({ t0: s.t0, t1: s.t1, ci: s.ci }));
    // seal 月圆 and the small inscription 丙午中秋
    const ss = Pt ? 90 : 88;
    const sealGlyphs = [];
    ['月', '圆'].forEach((ch, ci) => B.GLYPHS[ch].forEach((st, si) => sealGlyphs.push(B.bake(st, { scale: ss * 0.0039, x: -ss * 0.195, y: -ss * 0.41 + ci * ss * 0.41, seed: 700 + ci * 13 + si, ink: '#fdf1dc', weight: 1.5, dry: 0.15, res: 3 }))));
    A.seal = P.piece({
      pts: P.rect(-ss / 2, -ss / 2, ss, ss), color: '#c8321f', torn: { amp: 1.4, seed: 75, edge: '#e2604a', edgeW: 0.8, edgeVar: 1 }, grain: 0.5, res: 2, shadow: null,
      paint(g) {
        g.strokeStyle = '#fdf1dc'; g.lineWidth = 3; g.strokeRect(-ss / 2 + 5, -ss / 2 + 5, ss - 10, ss - 10);
        for (const s of sealGlyphs) B.drawBaked(g, s, 1);
      },
      speckle: 0.35,
    });
    A.sealP = Pt ? [pw / 2 - 64, 500] : [pw / 2 - 52, 78];
    const ins = [];
    const isz = Pt ? 0.34 : 0.33;
    [...'丙午中秋'].forEach((ch, ci) => B.GLYPHS[ch].forEach((st, si) => ins.push(B.bake(st, {
      scale: isz, x: Pt ? -pw / 2 + 28 : -pw / 2 + 34, y: (Pt ? -ph / 2 + 70 : -ph / 2 + 60) + ci * isz * 112, seed: 800 + ci * 11 + si, ink: '#2a2230', weight: 1.3, dry: 0.3, res: 2,
    }))));
    A.ins = ins;
    wish.snap = null;
    wish.pc = null;
  };

  // The reunion's last frame, frozen by the flash, becomes a polaroid.
  function snapshot(L) {
    if (wish.snap && wish.snap.width === L.W && wish.snap.height === L.H) return wish.snap;
    const c = makeCanvas(L.W, L.H);
    const g = c.getContext('2d');
    MA.scenes.reunion.draw(g, wish.START - 0.06, L);
    MA.film.finish(g, wish.START - 0.06, true);
    wish.snap = c;
    return c;
  }

  function polaroid(ctx, t, L) {
    const { W, H } = L;
    const p = easeInOut(seg(t, 47.0, 47.85));
    const drop = easeIn(seg(t, 48.45, 49.1));
    if (drop >= 1) return;
    const snap = snapshot(L);
    const sc = lerp(1, L.P ? 0.42 : 0.34, p);
    const tx = L.P ? W * 0.3 : W * 0.79, ty = L.P ? H * 0.27 : H * 0.7;
    const x = lerp(W / 2, tx, p), y = lerp(H / 2, ty, p) + drop * H * 0.8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lerp(0, -0.07, p) - drop * 0.3);
    ctx.scale(sc, sc);
    const bw = W * 0.035, bb = W * 0.13;
    ctx.shadowColor = `rgba(4,6,16,${0.55 * p})`; ctx.shadowBlur = 40; ctx.shadowOffsetX = 14; ctx.shadowOffsetY = 22;
    ctx.fillStyle = '#fbf7ee';
    ctx.fillRect(-W / 2 - bw, -H / 2 - bw, W + bw * 2, H + bw + bb);
    ctx.shadowColor = 'transparent';
    ctx.drawImage(snap, -W / 2, -H / 2);
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = P.pattern(ctx); ctx.fillRect(-W / 2 - bw, H / 2, W + bw * 2, bb); ctx.restore();
    ctx.fillStyle = '#2a2430';
    ctx.font = `600 ${Math.round(W * 0.045)}px ${MA.SANS}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('2026 · 中秋 · 全家福', 0, H / 2 + bb * 0.5);
    ctx.restore();
  }

  // ---- the rice paper strip, in its own coordinates ----
  function paperXform(ctx, A, L, pin) {
    const from = L.P ? [0, -L.H * 0.9] : [-L.W * 0.9, 0];
    ctx.translate(A.px + from[0] * (1 - pin), A.py + from[1] * (1 - pin));
    ctx.rotate(-0.012 - (1 - pin) * 0.08);
  }
  function drawInscription(ctx, A, p) {
    A.ins.forEach((st, i) => B.drawBaked(ctx, st, MA.clamp(p * A.ins.length - i)));
  }
  function drawSeal(ctx, A, t) {
    const sp = seg(t, wish.SEAL - 0.18, wish.SEAL);
    const bounce = seg(t, wish.SEAL, wish.SEAL + 0.3);
    const s = lerp(1.6, 1, easeIn(sp)) + 0.04 * Math.sin(bounce * Math.PI * 2) * (1 - bounce);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    MA.draw(ctx, A.seal, A.sealP[0], A.sealP[1], 0.03, s, s, Math.min(1, sp * 1.5));
    ctx.restore();
  }
  function drawEnglish(ctx, A, Pt, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#6b5a44';
    ctx.font = `600 ${Pt ? 19 : 20}px Georgia, "Times New Roman", serif`;
    ctx.letterSpacing = '6px';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (Pt) { ctx.fillText('HAPPY', 0, A.ph / 2 - 74); ctx.fillText('MID-AUTUMN', 0, A.ph / 2 - 46); }
    else ctx.fillText('HAPPY MID-AUTUMN FESTIVAL · 2026', -40, A.ph / 2 - 40);
    ctx.restore();
  }
  // Once the paper has settled, its backing, the paper and everything already finished live in one screen-space
  // layer. Strokes finish in order, so newly finished ones are appended; the inscription, seal and English line only
  // finish after the last stroke and trigger a rebuild, as does going back in time. The layer is always the same
  // pixels a from-scratch draw at t would give.
  function paperLayer(L, t) {
    const A = wish.A;
    let n = 0;
    while (n < A.strokes.length && t >= A.strokes[n].t1) n++;
    const ins = t >= wish.INSCRIBE[1], seal = t >= wish.SEAL + 0.3, eng = t >= 58.3;
    let pc = wish.pc;
    const fits = pc && pc.c.width === L.W && pc.c.height === L.H;
    const fresh = !fits || pc.n > n || pc.ins !== ins || pc.seal !== seal || pc.eng !== eng;
    if (fresh) pc = wish.pc = { c: fits ? pc.c : makeCanvas(L.W, L.H), n: 0, ins, seal, eng };
    const g = pc.c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (fresh) g.clearRect(0, 0, L.W, L.H);
    paperXform(g, A, L, 1);
    if (fresh) { MA.draw(g, A.backing, 0, 0); MA.draw(g, A.paper, 0, 0); }
    for (let i = pc.n; i < n; i++) B.drawBaked(g, A.strokes[i].st, 1);
    pc.n = n;
    if (fresh) {
      if (ins) drawInscription(g, A, 1);
      if (seal) drawSeal(g, A, wish.SEAL + 0.3);
      if (eng) drawEnglish(g, A, L.P, 1);
    }
    return pc.c;
  }

  wish.lanternAt = function (t, L) {
    const A = wish.A;
    const her = A.fam[3], niece = A.fam[4];
    const hx = ((her.x + niece.x) / 2) * L.W;
    const hy = A.feetY + her.f.handY - 12;
    const r = t - wish.RELEASE;
    if (r <= 0) return { x: hx, y: hy + Math.sin(t * 2) * 2, held: true };
    const rise = r < 1.5 ? r * r * 26 : 58.5 + (r - 1.5) * 78;
    return { x: hx - rise * 0.22 + Math.sin(r * 1.1) * 14, y: hy - rise, held: false };
  };

  wish.draw = function (ctx, t, L) {
    const { W, H } = L;
    const A = wish.A;
    const Pt = L.P;
    const tilt = A.tiltH * easeInOut(seg(t, wish.TILT[0], wish.TILT[1]));
    // layers stack in one after another, like cut paper laid on the board
    const inn = (t0) => { const p = seg(t, t0, t0 + 0.5); return p <= 0 ? -1 : (1 - easeOutBack(p, 1.3)) * H * 0.35; };
    const layer = (d, dy, fn) => { if (dy < 0) return; ctx.save(); ctx.translate(0, tilt * d + dy); fn(); ctx.restore(); };
    layer(0.3, 0, () => {
      ctx.drawImage(A.sky, 0, -A.skyTop);
      E.stars(ctx, t, { n: 110, seed: 71, x0: 0, x1: W, y0: -A.skyTop, y1: A.horizon });
    });
    const mIn = seg(t, 47.0, 47.5);
    if (mIn > 0) layer(0.35, 0, () => {
      const s = 0.7 + 0.3 * easeOutBack(mIn, 2);
      MA.glow(ctx, A.mx, A.my, A.mr * 3.2, C.goldP, 0.55 * mIn, 'screen');
      MA.draw(ctx, A.halo, A.mx, A.my, 0, s * (1 + 0.015 * Math.sin(t * 1.2)));
      MA.draw(ctx, A.moon, A.mx, A.my, 0, s);
    });
    // fireworks over the far hills
    layer(0.7, inn(47.15), () => {
      for (const [ft, fx, fy, fr, pal] of wish.FIREWORKS) firework(ctx, fx * W, fy * H + (Pt ? H * 0.08 : 0), fr * (Pt ? 0.9 : 1), pal, t - ft);
    });
    // distant sky lanterns
    const skyL = (near) => {
      for (const l of A.far_l) {
        if ((l.d > 0.7) !== near || t < l.t0) continue;
        const r = t - l.t0;
        const x = l.x + Math.sin(r * 0.7 + l.ph) * 10 * l.d;
        const y = A.horizon - 10 - r * l.v + tilt * l.d;
        const a = smooth(r / 0.8);
        if (y < -80 || y > H + 60) continue;
        MA.draw(ctx, A.glowLantern, x, y, Math.sin(r + l.ph) * 0.05, l.s * 1.6, l.s * 1.6, a);
      }
    };
    ctx.save(); skyL(false); ctx.restore();
    layer(0.85, inn(47.15), () => {
      const off = (t * 4) % A.hillW;
      MA.draw(ctx, A.far, -off, A.horizon - A.far.h * 0.9);
      MA.draw(ctx, A.far, -off + A.hillW, A.horizon - A.far.h * 0.9);
    });
    layer(0.92, inn(47.3), () => {
      const off = (t * 7) % A.hillW;
      MA.draw(ctx, A.near, -off - W * 0.1, A.horizon - A.near.h * 0.72);
      MA.draw(ctx, A.near, -off - W * 0.1 + A.hillW, A.horizon - A.near.h * 0.72);
    });
    // river with the moon's reflection and floating lotus lamps
    layer(1, inn(47.42), () => {
      const wy = A.waterY, wb = A.bankY + 40;
      const g = ctx.createLinearGradient(0, wy, 0, wb);
      g.addColorStop(0, '#2c3470'); g.addColorStop(1, '#0e1333');
      ctx.fillStyle = g; ctx.fillRect(0, wy, W, H * 1.5 - wy);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 12; i++) {
        const f = i / 11, y = lerp(wy + 8, A.bankY - 10, f);
        const w = (50 + f * 170) * (0.55 + 0.45 * Math.sin(t * 2.4 + i * 1.9));
        ctx.fillStyle = MA.hex(i % 3 ? C.goldL : C.goldP, 0.5 - f * 0.25);
        ctx.beginPath(); ctx.roundRect(A.mx - w / 2 + Math.sin(t * 1.7 + i) * (6 + f * 16), y, w, 3 + f * 5, 3); ctx.fill();
      }
      ctx.restore();
      for (let i = 0; i < 11; i++) {
        const row = hash(i, 81), s = 0.45 + row * 0.75;
        const y = lerp(wy + 22, A.bankY - 30, row);
        const x = ((((i + hash(i, 82) * 0.8) / 11) * W * 1.25 + (t - 46) * (10 + row * 18)) % (W * 1.25)) - W * 0.12;
        MA.glow(ctx, x, y - 20 * s, 110 * s, C.goldL, 0.7, 'screen');
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = MA.hex(C.goldL, 0.35);
        ctx.fillRect(x - 6 * s, y + 4, 12 * s, 40 * s); ctx.restore();
        MA.draw(ctx, A.lamp, x, y + Math.sin(t * 1.5 + i) * 2, Math.sin(t + i) * 0.04, s);
      }
    });
    // the family on the bank, the lantern glowing in their hands
    const lp = wish.lanternAt(t, L);
    const glowUp = smooth(seg(t, 47.8, 49.0));
    layer(1.1, inn(47.55), () => {
      MA.draw(ctx, A.bank, 0, A.bankY);
      if (lp.held) MA.glow(ctx, lp.x, lp.y - A.lanternS * 0.6, A.lanternS * 3.5, C.goldL, 0.4 + 0.6 * glowUp, 'screen');
      const rimA = 0.35 + 0.4 * glowUp * (lp.held ? 1 : 0.6);
      for (const m of A.fam) {
        const x = m.x * W, y = A.feetY + MA.boil(90 + m.h, t, 0.6, 4);
        const arms = m.up && t < wish.RELEASE + 0.6 ? 'up' : 'down';
        ctx.save(); ctx.globalAlpha = rimA; MA.draw(ctx, m.rim[arms], x + 2, y - 2); ctx.restore();
        MA.draw(ctx, m.f[arms], x, y);
      }
      MA.draw(ctx, A.grass, 0, A.feetY - 24);
    });
    // their lantern: held, then let go, carried up with the camera
    {
      const d = lp.held ? 1.1 : lerp(1.1, 0.55, smooth((t - wish.RELEASE) / 3));
      ctx.save();
      ctx.translate(0, tilt * d + Math.max(0, inn(47.55)));
      if (inn(47.55) >= 0) {
        MA.glow(ctx, lp.x, lp.y - A.lanternS, A.lanternS * 4, C.goldL, 0.6 + 0.4 * glowUp, 'screen');
        const s = (lp.held ? 0.94 + 0.06 * glowUp : 1) * (1 - 0.35 * smooth((t - wish.RELEASE - 2) / 6));
        MA.draw(ctx, A.skyLantern, lp.x, lp.y, Math.sin(t * 1.3) * 0.04, s);
      }
      ctx.restore();
    }
    ctx.save(); skyL(true); ctx.restore();
    // the rice paper arrives and the brush writes
    const pin = easeOut(seg(t, wish.PAPER[0], wish.PAPER[1]));
    if (pin > 0) {
      const settled = pin >= 1;
      if (settled) ctx.drawImage(paperLayer(L, t), 0, 0);
      ctx.save();
      paperXform(ctx, A, L, pin);
      if (!settled) { MA.draw(ctx, A.backing, 0, 0); MA.draw(ctx, A.paper, 0, 0); }
      let tip = null, tipNext = null;
      for (let i = 0; i < A.strokes.length; i++) {
        const s = A.strokes[i];
        const p = seg(t, s.t0, s.t1);
        if (!settled || (p > 0 && p < 1)) B.drawBaked(ctx, s.st, p);
        if (t >= s.t0 && t < s.t1) tip = { p: B.tipAt(s.st, p), down: 1 };
        else if (!tip && t >= s.t1 && (i === A.strokes.length - 1 || t < A.strokes[i + 1].t0)) {
          const nx = A.strokes[i + 1];
          const a = B.tipAt(s.st, 1);
          if (nx) {
            const f = seg(t, s.t1, nx.t0), b = B.tipAt(nx.st, 0);
            tipNext = { p: [lerp(a[0], b[0], smooth(f)), lerp(a[1], b[1], smooth(f))], down: 0 };
          } else tipNext = { p: a, down: 0, end: true };
        }
      }
      // inscription, seal and English line, live until they settle into the cached layer
      if (t >= wish.INSCRIBE[0] && t < wish.INSCRIBE[1]) drawInscription(ctx, A, seg(t, wish.INSCRIBE[0], wish.INSCRIBE[1]));
      if (t >= wish.SEAL - 0.18 && t < wish.SEAL + 0.3) drawSeal(ctx, A, t);
      if (t >= 57.75 && t < 58.3) drawEnglish(ctx, A, Pt, smooth(seg(t, 57.75, 58.3)));
      // the brush itself, hovering between strokes and gone once the writing is done
      const b = tip || tipNext;
      const bAlpha = seg(t, wish.WRITE[0] - 0.35, wish.WRITE[0]) * (1 - seg(t, wish.WRITE[1] + 0.1, wish.WRITE[1] + 0.45));
      if (b && bAlpha > 0) {
        const out = seg(t, wish.WRITE[1] + 0.1, wish.WRITE[1] + 0.45);
        ctx.save();
        ctx.globalAlpha = bAlpha;
        brush(ctx, b.p[0] + out * 200, b.p[1] - out * 120, b.down ? 0 : 1, 0.42);
        ctx.restore();
      } else if (!b && bAlpha > 0 && t < A.strokes[0].t0) {
        const a = B.tipAt(A.strokes[0].st, 0);
        const f = seg(t, wish.WRITE[0] - 0.35, A.strokes[0].t0);
        ctx.save(); ctx.globalAlpha = bAlpha; brush(ctx, a[0] + (1 - f) * 160, a[1] - (1 - f) * 100, 1 - f, 0.42); ctx.restore();
      }
      ctx.restore();
    }
    // the family photo shrinks away as the new scene stacks in
    if (t < 49.2) polaroid(ctx, t, L);
    const fl = t - MA.scenes.reunion.FLASH;
    if (fl < 0.5) {
      ctx.fillStyle = `rgba(255,250,236,${Math.max(0, 1 - fl / 0.5)})`;
      ctx.fillRect(0, 0, W, H);
    }
  };
})();

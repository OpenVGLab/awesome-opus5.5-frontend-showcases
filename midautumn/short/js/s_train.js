'use strict';
// Scene 5 · 归途: a ticket home gets punched; the night train crosses a river while the moon keeps pace.
(function () {
  const MA = window.MA;
  const { C, seg, smooth, easeOut, easeIn, easeInOut, easeOutBack, lerp, hash, rng, makeCanvas } = MA;
  const P = MA.paper, E = MA.el;
  const S = (MA.scenes = MA.scenes || {});
  const train = (S.train = {});
  train.SPEED = 460;

  // Periodic ridge profile (a short Fourier series) so a scrolling sprite tiles without a seam.
  function profile(seed, k0, k1) {
    const R = rng(seed);
    const terms = [];
    for (let k = k0; k <= k1; k++) terms.push([k, R() * 6.2832, Math.pow(k, -1.15) * (0.4 + R())]);
    const n = terms.reduce((s, a) => s + a[2], 0);
    return (f) => { let v = 0; for (const [k, ph, a] of terms) v += a * Math.sin(k * f * 6.2832 + ph); return v / n; };
  }

  function ridge(w, h, o) {
    const fn = profile(o.seed, o.k0 || 2, o.k1 || 12);
    const yAt = (f) => h * (o.base - o.amp * MA.clamp(0.5 + 1.25 * fn(f), -0.1, 1.1));
    const n = 120, m = 6;
    const pts = [[-(m / n) * w, h + 20]];
    for (let i = -m; i <= n + m; i++) pts.push([(i / n) * w, yAt(i / n)]);
    pts.push([(1 + m / n) * w, h + 20]);
    const R = rng(o.seed + 5);
    return P.cropX(P.piece({
      pts, color: o.color, torn: { amp: 3.5, seed: o.seed, edge: o.edge || MA.hex(C.riceL, 0.75), edgeW: 1, edgeVar: 2.5 },
      grain: 0.5, shadow: { x: 0, y: -4, blur: 14, a: 0.3 },
      paint(g) {
        P.halftone(g, 0, 0, w, h, { cell: 8, angle: 0.6, color: MA.hex(o.mist || C.indigoP, 0.35), f: (x, y) => smooth((y - h * 0.4) / (h * 0.55)) * 0.8 });
        // a lighter band along the crest where the slope faces the moon (to the right)
        if (o.lit) {
          const th = [];
          for (let i = 0; i <= n; i++) th.push(yAt((i + 1) / n) > yAt(i / n) ? o.litW || 30 : 3);
          for (let k = 0; k < 3; k++) for (let i = 1; i < n; i++) th[i] = (th[i - 1] + th[i] * 2 + th[i + 1]) / 4;
          g.fillStyle = MA.hex(o.lit, 0.2);
          g.beginPath();
          for (let i = 0; i <= n; i++) g.lineTo((i / n) * w, yAt(i / n) - 4);
          for (let i = n; i >= 0; i--) g.lineTo((i / n) * w, yAt(i / n) + th[i]);
          g.fill();
        }
        // small villages tucked into the lower slopes, roofs well below the crest
        for (let v = 0; v < (o.houses || 0); v++) {
          let x = ((v + 0.2 + R() * 0.6) / o.houses) * w;
          const nh = 2 + Math.floor(R() * 3);
          for (let k = 0; k < nh; k++) {
            const hh = 14 + R() * 12, ww = 22 + R() * 16;
            let crest = 1e9;
            for (let xx = x - 6; xx <= x + ww + 6; xx += 4) crest = Math.min(crest, yAt(xx / w));
            const top = Math.max(crest + 22, yAt((x + ww / 2) / w) + 14) + R() * 20;
            g.fillStyle = MA.hex('#0c1330', 0.92);
            g.fillRect(x, top + 10, ww, hh + 40);
            g.beginPath(); g.moveTo(x - 5, top + 10); g.lineTo(x + ww / 2, top); g.lineTo(x + ww + 5, top + 10); g.fill();
            g.fillStyle = R() < 0.7 ? C.goldL : C.gold;
            g.fillRect(x + ww * 0.3, top + 16, 6, 7);
            x += ww + 4 + R() * 16;
          }
        }
      },
    }), 0, w);
  }

  train.ridge = ridge;
  train.profile = profile;

  // Far river bank: a low torn strip with tree bumps and a few village lights; tiles horizontally.
  function bank(w, h, o) {
    const R = rng(o.seed);
    const ground = h * 0.55;
    // clumps of round tree canopies; the outline is the upper envelope of the circles
    const circles = [];
    let x = 60;
    while (x < w - 120) {
      if (R() < 0.6) {
        const n = 1 + Math.floor(R() * 4);
        for (let k = 0; k < n; k++) {
          const r = 8 + R() * 13;
          circles.push([x, ground - r * (0.6 + R() * 1.1), r]);
          x += r * (0.9 + R() * 0.6);
        }
        x += 30 + R() * 90;
      } else x += 50 + R() * 110;
    }
    const pts = [[-40, h + 10]];
    for (let xx = -40; xx <= w + 40; xx += 3) {
      let y = ground + MA.fbm1(xx * 0.01, o.seed, 2) * 2;
      for (const [cx, cy, r] of circles) {
        const d = xx - cx;
        if (Math.abs(d) < r) y = Math.min(y, cy - Math.sqrt(r * r - d * d));
      }
      pts.push([xx, y]);
    }
    pts.push([w + 40, h + 10]);
    return P.cropX(P.piece({
      pts, color: o.color, cut: false, grain: 0.45, shadow: { x: 0, y: -3, blur: 10, a: 0.35 },
      paint(g) {
        for (let i = 0; i < 9; i++) {
          g.fillStyle = R() < 0.6 ? C.goldL : C.gold;
          g.fillRect(40 + R() * (w - 80), h * (0.62 + R() * 0.15), 5, 4);
        }
      },
    }), 0, w);
  }

  train.build = function (L) {
    const { W, H } = L;
    const Pt = L.P;
    const A = (train.A = {});
    A.sky = E.sky(W, H, [[0, '#0b1232'], [0.55, '#1b2a5e'], [1, '#34487e']], {
      halftone: { cell: 11, angle: 0.5, color: MA.hex(C.indigoL, 0.45), f: (x, y) => smooth((y - H * 0.35) / (H * 0.5)) * 0.5 },
    });
    A.mx = Pt ? W * 0.72 : W * 0.8; A.my = Pt ? H * 0.2 : H * 0.22; A.mr = Pt ? 100 : 115;
    A.moon = E.moon(A.mr, { seed: 21, res: 2 });
    A.halo = E.halo(A.mr, { n: 3, alpha: 0.12 });
    A.rw = Math.ceil(W * 1.6);
    A.far = ridge(A.rw, H * 0.5, { seed: 3, base: 0.8, amp: 0.62, k0: 2, k1: 12, color: '#2e4278', mist: '#9aaad6', lit: '#c9d4f2', litW: 40 });
    A.mid = ridge(A.rw, H * 0.4, { seed: 8, base: 0.86, amp: 0.5, k0: 3, k1: 14, color: '#1d2b58', mist: '#6f82b8', houses: 14, lit: '#9fb0dc', litW: 24 });
    // vertical layout: train on a slim viaduct, open water with the moon's reflection, near bank with reeds
    const trs = (A.trs = Pt ? 0.62 : 1);
    const bs = (A.bs = Pt ? 0.72 : 1);
    A.deckY = Pt ? H * 0.6 : H * 0.62;
    A.trainY = A.deckY - 60 * trs;
    A.rail = A.trainY + 108 * trs;
    A.deckBot = A.rail + 26 * bs;
    A.pierBase = A.deckBot + (Pt ? 150 : 96);
    A.bankY = Pt ? H * 0.87 : H * 0.885;
    A.waterTop = A.deckY + 10;
    A.farBank = bank(A.rw, 70, { seed: 12, color: '#141d40' });
    // one viaduct span: deck slab with a pier at its centre, tiled while scrolling
    const span = (A.span = Pt ? 250 : 330);
    const dh = 26 * bs, ph = A.pierBase - A.rail, pw = 30 * bs;
    A.spanSpr = P.piece({
      pts: [[0, 0], [span, 0], [span, dh], [span / 2 + pw / 2, dh], [span / 2 + pw * 0.62, ph], [span / 2 - pw * 0.62, ph], [span / 2 - pw / 2, dh], [0, dh]],
      color: '#29315c', cut: false, grain: 0.5, shadow: null,
      paint(g) {
        g.fillStyle = MA.hex(C.indigoP, 0.55); g.fillRect(0, 0, span, 3 * bs);
        g.fillStyle = MA.hex('#000000', 0.25); g.fillRect(0, dh - 5 * bs, span, 5 * bs);
        g.fillStyle = MA.hex('#9fb0dc', 0.3);
        g.beginPath(); g.moveTo(span / 2 + pw * 0.15, dh); g.lineTo(span / 2 + pw / 2, dh); g.lineTo(span / 2 + pw * 0.62, ph); g.lineTo(span / 2 + pw * 0.2, ph); g.fill();
        g.fillStyle = MA.hex('#000000', 0.22); g.fillRect(span / 2 - pw, dh, pw * 2, 8 * bs);
        g.strokeStyle = MA.hex('#000000', 0.18); g.lineWidth = 1;
        for (let x = 12; x < span; x += 24 * bs) { g.beginPath(); g.moveTo(x, 6 * bs); g.lineTo(x, dh - 6 * bs); g.stroke(); }
      },
    });
    const nb = profile(18, 3, 16);
    const nearPts = [[-40, 400]];
    for (let x = -40; x <= W + 40; x += 24) nearPts.push([x, 16 + nb(x / W) * 30]);
    nearPts.push([W + 40, 400]);
    A.nearBank = P.cropX(P.piece({
      pts: nearPts, color: '#080c1c', torn: { amp: 3, seed: 18, edge: MA.hex(C.indigoP, 0.45), edgeW: 1 }, grain: 0.4, shadow: { x: 0, y: -4, blur: 12, a: 0.4 },
    }), 0, W);
    // train: four cars, streamlined nose on the right
    const carW = Pt ? 300 : 330, carH = 96, gap = 10, n = 4;
    const tw = n * carW + (n - 1) * gap + 60;
    A.trainW = tw;
    A.her = { car: 1, win: 3 };
    A.train = P.piece({
      pts: [[0, 0], [tw - 110, 0], [tw - 40, 18], [tw, 62], [tw, carH], [0, carH]], color: C.riceL, cut: true, grain: 0.5, res: 1.2,
      shadow: { x: 3, y: 6, blur: 8, a: 0.4 },
      paint(g) {
        g.fillStyle = C.ver; g.fillRect(0, 62, tw, 12);
        g.fillStyle = '#26315c'; g.fillRect(0, 74, tw, 30);
        g.fillStyle = '#1c2446'; g.beginPath(); g.moveTo(tw - 108, 6); g.lineTo(tw - 48, 20); g.lineTo(tw - 20, 46); g.lineTo(tw - 108, 46); g.fill();
        for (let c = 0; c < n; c++) {
          const x0 = c * (carW + gap);
          if (c > 0) { g.fillStyle = '#1b2242'; g.fillRect(x0 - gap, 8, gap, carH - 8); }
          for (let k = 0; k < 7; k++) {
            if (c === n - 1 && k > 4) continue;
            const wx = x0 + 18 + k * ((carW - 36) / 7), wwid = (carW - 36) / 7 - 10;
            g.fillStyle = C.goldL;
            g.beginPath(); g.roundRect(wx, 18, wwid, 34, 6); g.fill();
            if (!(c === A.her.car && k === A.her.win) && hash(c, k, 9) < 0.55) {
              g.fillStyle = MA.hex('#1a1530', 0.85);
              g.beginPath(); g.arc(wx + wwid * 0.5, 38, 8, 0, 6.3); g.fill();
              g.fillRect(wx + wwid * 0.5 - 12, 44, 24, 10);
            }
          }
        }
        g.fillStyle = MA.hex('#ffffff', 0.35); g.fillRect(0, 8, tw - 120, 3);
      },
    });
    A.winGeom = { carW, gap, n };
    // her reply to Mom's message from the first scene; the tail points down at her window
    const rbw = 640, rbh = 140;
    A.reply = P.piece({
      pts: [[-rbw / 2, -rbh / 2], [rbw / 2, -rbh / 2], [rbw / 2, rbh / 2], [-rbw / 2 + 120, rbh / 2], [-rbw / 2 + 84, rbh / 2 + 46], [-rbw / 2 + 80, rbh / 2], [-rbw / 2, rbh / 2]],
      color: C.goldP, torn: { amp: 3, seed: 93, edge: '#fffaf0' }, res: 1.5, grain: 0.45, shadow: { x: 6, y: 10, blur: 16, a: 0.45 },
      paint(g) {
        g.textBaseline = 'middle'; g.textAlign = 'left';
        g.fillStyle = '#7a6440'; g.font = `500 22px ${MA.SANS}`;
        g.fillText('发给 妈妈  ·  18:40', -rbw / 2 + 40, -34);
        g.fillStyle = C.ink; g.font = `700 36px ${MA.SANS}`;
        g.fillText('妈，我上车了！今晚回家吃饭。', -rbw / 2 + 40, 16);
        g.fillStyle = MA.hex(C.ver, 0.85); g.fillRect(-rbw / 2 + 40, 48, 120, 4);
      },
    });
    A.replyTip = [-rbw / 2 + 84, rbh / 2 + 46];
    A.reeds = P.piece({
      pts: P.rect(0, 0, 900, 140), cut: false, fill: false, shadow: null, grain: 0.3,
      paint(g) {
        const R = rng(19);
        for (let i = 0; i < 70; i++) {
          const x = R() * 900, h = 50 + R() * 90, lean = (R() - 0.5) * 30;
          g.strokeStyle = i % 3 ? '#0a0f22' : '#141c38'; g.lineWidth = 3 + R() * 3;
          g.beginPath(); g.moveTo(x, 140); g.quadraticCurveTo(x + lean * 0.3, 140 - h * 0.6, x + lean, 140 - h); g.stroke();
          if (R() < 0.4) { g.fillStyle = '#26304f'; g.beginPath(); g.ellipse(x + lean, 140 - h, 5, 16, lean * 0.02, 0, 6.3); g.fill(); }
        }
      },
    });
    // ticket
    const tkw = Pt ? 820 : 900, tkh = Pt ? 420 : 430;
    A.tk = { w: tkw, h: tkh };
    A.ticket = P.piece({
      pts: P.rect(-tkw / 2, -tkh / 2, tkw, tkh), color: '#bcd3e6', cut: true, grain: 0.45, res: 1.4, shadow: { x: 10, y: 16, blur: 26, a: 0.5 },
      paint(g) {
        g.strokeStyle = MA.hex('#7f9cc0', 0.35); g.lineWidth = 1;
        for (let i = 0; i < 38; i++) {
          g.beginPath();
          for (let x = -tkw / 2; x <= tkw / 2; x += 8) { const y = -tkh / 2 + i * 12 + Math.sin(x * 0.03 + i * 0.7) * 4; if (x === -tkw / 2) g.moveTo(x, y); else g.lineTo(x, y); }
          g.stroke();
        }
        g.fillStyle = MA.hex('#ffffff', 0.35); g.fillRect(-tkw / 2, tkh / 2 - 70, tkw, 70);
        const L0 = -tkw / 2 + 60;
        g.textBaseline = 'alphabetic';
        g.fillStyle = C.verD; g.font = `700 30px ${MA.SANS}`; g.textAlign = 'left';
        g.fillText('A 080915', L0, -tkh / 2 + 60);
        g.fillStyle = '#6a7a92'; g.font = `500 22px ${MA.SANS}`; g.textAlign = 'right';
        g.fillText('中秋 · 回家专列', tkw / 2 - 50, -tkh / 2 + 58);
        g.fillStyle = C.ink; g.textAlign = 'center';
        g.font = `800 64px ${MA.SANS}`;
        g.fillText('异乡 站', -tkw * 0.27, -22);
        g.fillText('故乡 站', tkw * 0.27, -22);
        g.font = `500 22px ${MA.SANS}`; g.fillStyle = '#4b5870';
        g.fillText('Yixiang', -tkw * 0.27, 12); g.fillText('Guxiang', tkw * 0.27, 12);
        g.fillStyle = C.ink; g.font = `800 34px ${MA.SANS}`;
        g.fillText('G815', 0, -58);
        g.strokeStyle = C.ink; g.lineWidth = 4;
        g.beginPath(); g.moveTo(-70, -40); g.lineTo(70, -40); g.lineTo(56, -50); g.stroke();
        g.font = `600 30px ${MA.SANS}`; g.textAlign = 'left';
        g.fillText('2026年09月25日 17:30开', L0, 72);
        g.textAlign = 'right'; g.fillText('08车15号', tkw / 2 - 60, 72);
        g.textAlign = 'left'; g.font = `600 28px ${MA.SANS}`;
        g.fillText('¥ 团圆价', L0, 118); g.textAlign = 'right'; g.fillText('二等座', tkw / 2 - 60, 118);
        g.fillStyle = '#5a6882'; g.font = `500 20px ${MA.SANS}`; g.textAlign = 'left';
        g.fillText('限乘当日当次车 · 月圆人团圆', L0, tkh / 2 - 28);
        g.strokeStyle = MA.hex(C.ver, 0.75); g.lineWidth = 4;
        g.beginPath(); g.arc(tkw / 2 - 130, tkh / 2 - 90, 58, 0, 6.3); g.stroke();
        g.lineWidth = 2; g.beginPath(); g.arc(tkw / 2 - 130, tkh / 2 - 90, 48, 0, 6.3); g.stroke();
        g.fillStyle = MA.hex(C.ver, 0.8); g.font = `800 30px ${MA.SANS}`; g.textAlign = 'center';
        g.fillText('团圆', tkw / 2 - 130, tkh / 2 - 80);
      },
      speckle: 0.1,
    });
  };

  // The punched ticket rides over the cut from the legend to the train.
  train.ticket = function (ctx, t, L) {
    const { W, H } = L;
    const A = train.A;
    const inP = easeOutBack(seg(t, 32.0, 32.5), 1.1);
    const out = easeIn(seg(t, 33.05, 33.7));
    if (inP <= 0 || out >= 1) return;
    const x = lerp(W * 1.3, W * 0.5, inP) - out * W * 1.1;
    const y = lerp(H * 0.9, H * 0.5, inP) - out * H * 0.35;
    const r = lerp(0.35, -0.04, inP) - out * 0.3;
    const sc = lerp(0.6, 1, inP) * (1 + 0.03 * Math.sin(seg(t, 32.7, 32.85) * Math.PI));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r);
    ctx.scale(sc, sc);
    const hx = A.tk.w * 0.18, hy = A.tk.h * 0.14, hr = 26;
    const punched = t >= 32.75;
    if (punched) {
      // draw the ticket with a hole: clip out a circle
      ctx.save();
      ctx.beginPath();
      ctx.rect(-A.tk.w, -A.tk.h, A.tk.w * 2, A.tk.h * 2);
      ctx.arc(hx, hy, hr, 0, 6.3, true);
      ctx.clip('evenodd');
      MA.draw(ctx, A.ticket, 0, 0);
      ctx.restore();
      // the punched disc tumbles away
      const f = t - 32.75;
      ctx.save();
      ctx.translate(hx + f * 60, hy + f * f * 900);
      ctx.rotate(f * 8);
      ctx.fillStyle = '#bcd3e6';
      ctx.beginPath(); ctx.ellipse(0, 0, hr, hr * Math.abs(Math.cos(f * 10)), 0, 0, 6.3); ctx.fill();
      ctx.restore();
    } else MA.draw(ctx, A.ticket, 0, 0);
    ctx.restore();
  };

  // New sheet sliding in from the right over the legend.
  train.enter = function (ctx, t, L, drawLegend) {
    const { W, H } = L;
    const p = easeInOut(seg(t, 32.85, 33.4));
    drawLegend(ctx);
    if (p <= 0) return;
    const buf = MA.film.buf(1);
    const b = buf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    train.draw(b, t, L);
    const x = (1 - p) * W * 1.02;
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate((1 - p) * 0.03);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetX = -14;
    ctx.fillStyle = C.riceL; ctx.fillRect(-8, -20, W + 40, H + 40);
    ctx.shadowColor = 'transparent';
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
  };

  train.moonAt = function (t, L) {
    const A = train.A;
    return { x: A.mx, y: A.my, r: A.mr };
  };

  train.moon = function (ctx, x, y, s) {
    const A = train.A;
    MA.draw(ctx, A.halo, x, y, 0, s);
    MA.draw(ctx, A.moon, x, y, 0, s);
  };

  // o.noMoon: leave the moon out (the reunion transition carries it over on its own).
  train.draw = function (ctx, t, L, o = {}) {
    const { W, H } = L;
    const A = train.A;
    const Pt = L.P;
    const tt = t - 32.8;
    const tile = (spr, speed, y, w) => {
      const off = ((tt * speed) % w + w) % w;
      for (let x = -off; x < W; x += w) MA.draw(ctx, spr, x, y);
    };
    ctx.drawImage(A.sky, 0, 0);
    E.stars(ctx, t, { n: 70, seed: 41, x0: 0, x1: W, y0: 0, y1: H * 0.5 });
    MA.glow(ctx, A.mx, A.my, A.mr * 3.4, C.goldP, 0.5, 'screen');
    if (!o.noMoon) train.moon(ctx, A.mx, A.my, 1);
    {
      tile(A.far, 22, A.deckY - H * (Pt ? 0.43 : 0.47), A.rw);
      tile(A.mid, 60, A.deckY - H * (Pt ? 0.3 : 0.36), A.rw);
      // river: sky-lit near the far bank, darker towards us
      const wg = ctx.createLinearGradient(0, A.waterTop, 0, A.bankY);
      wg.addColorStop(0, '#26386e'); wg.addColorStop(0.45, '#17234f'); wg.addColorStop(1, '#0c1330');
      ctx.fillStyle = wg;
      ctx.fillRect(0, A.waterTop, W, H - A.waterTop);
      tile(A.farBank, 150, A.deckY - 40, A.rw);
      const wy0 = A.deckY + 38, wy1 = A.bankY + 30;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, wy0, W, wy1 - wy0); ctx.clip();
      // the moon's reflection: a column of torn gold slivers, wider and looser towards us
      ctx.globalCompositeOperation = 'screen';
      const nS = 16;
      for (let i = 0; i < nS; i++) {
        const f = i / (nS - 1);
        const y = lerp(wy0 + 6, A.bankY - 6, Math.pow(f, 0.9));
        const k = MA.step(t, 8);
        const w = (40 + f * 150) * (0.55 + 0.45 * Math.sin(t * 2.6 + i * 1.7)) * (0.8 + 0.4 * hash(i, k, 3));
        const x = A.mx + Math.sin(t * 1.9 + i * 0.9) * (6 + f * 18) - w / 2;
        ctx.fillStyle = MA.hex(i % 3 ? C.goldL : C.goldP, 0.55 - f * 0.25);
        ctx.beginPath(); ctx.roundRect(x, y, w, 3 + f * 5, 3); ctx.fill();
      }
      MA.glow(ctx, A.mx, (wy0 + A.bankY) / 2, (A.bankY - wy0) * 0.9, C.goldP, 0.3, 'screen');
      ctx.globalCompositeOperation = 'source-over';
      // ripples drifting with the current
      ctx.strokeStyle = MA.hex(C.indigoP, 0.22); ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const f = hash(i, 5);
        const y = lerp(wy0, A.bankY, f);
        const x = ((hash(i, 6) * W * 1.3 - tt * (40 + f * 80)) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (40 + hash(i, 7) * 70) * (0.6 + f), y); ctx.stroke();
      }
      // pier reflections, broken up by the ripples
      const span = A.span, offS = ((tt * train.SPEED) % span + span) % span;
      ctx.fillStyle = MA.hex('#060a1c', 0.45);
      for (let x = -offS + span / 2; x < W + span; x += span) {
        for (let j = 0; j < 7; j++) {
          const y = A.pierBase + j * 13 * A.bs;
          const wob = Math.sin(t * 3 + j * 1.3 + x * 0.01) * 4;
          ctx.fillRect(x - 17 * A.bs + wob, y, 34 * A.bs * (1 - j * 0.08), 9 * A.bs);
        }
      }
      ctx.restore();
      // viaduct
      tile(A.spanSpr, train.SPEED, A.rail, A.span);
      // catenary masts behind the train, wires running along above it
      const trs = A.trs;
      const mastGap = A.span * 2, offM = ((tt * train.SPEED) % mastGap + mastGap) % mastGap;
      const wireY = A.trainY - 34 * trs;
      ctx.fillStyle = '#1a2148';
      for (let x = -offM + A.span * 0.5 + 20; x < W + mastGap; x += mastGap) {
        ctx.fillRect(x - 5 * trs, wireY - 26 * trs, 10 * trs, A.rail - wireY + 26 * trs);
        ctx.fillRect(x - 5 * trs, wireY - 22 * trs, 46 * trs, 5 * trs);
        ctx.fillRect(x + 30 * trs, wireY - 22 * trs, 4 * trs, 24 * trs);
      }
      ctx.strokeStyle = MA.hex('#060a1c', 0.8); ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = -offM + A.span * 0.5 + 20 - mastGap; x < W + mastGap; x += mastGap) {
        ctx.moveTo(x + 32 * trs, wireY);
        ctx.quadraticCurveTo(x + 32 * trs + mastGap / 2, wireY + 10 * trs, x + 32 * trs + mastGap, wireY);
        ctx.moveTo(x + 32 * trs, wireY - 16 * trs);
        ctx.quadraticCurveTo(x + 32 * trs + mastGap / 2, wireY - 4 * trs, x + 32 * trs + mastGap, wireY - 16 * trs);
      }
      ctx.stroke();
      // the train, tracked by the camera
      const tx = Pt ? W * 0.5 - (A.trainW * trs) / 2 : W * 0.5 - A.trainW / 2 - W * 0.02;
      const ty = A.trainY + MA.boil(81, t, 0.8, 12);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(trs, trs);
      MA.draw(ctx, A.train, 0, 0);
      // her window: profile looking out at the moon
      const g = A.winGeom;
      const wx = A.her.car * (g.carW + g.gap) + 18 + A.her.win * ((g.carW - 36) / 7), ww = (g.carW - 36) / 7 - 10;
      MA.glow(ctx, wx + ww / 2, 36, 70, C.goldL, 0.8, 'screen');
      ctx.fillStyle = '#1a1530';
      ctx.beginPath(); ctx.arc(wx + ww * 0.42, 36, 9, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(wx + ww * 0.3, 27, 5, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(wx + ww * 0.5, 34); ctx.lineTo(wx + ww * 0.62, 36); ctx.lineTo(wx + ww * 0.5, 40); ctx.fill();
      ctx.fillRect(wx + ww * 0.24, 44, 20, 10);
      // wheels
      ctx.fillStyle = '#0c1024';
      for (let c = 0; c < g.n; c++) for (const k of [0.18, 0.3, 0.7, 0.82]) {
        ctx.beginPath(); ctx.arc(c * (g.carW + g.gap) + g.carW * k, 102, 9, 0, 6.3); ctx.fill();
      }
      ctx.restore();
      // speed streaks
      ctx.save();
      ctx.strokeStyle = MA.hex(C.riceL, 0.12); ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const y = A.trainY - 40 * trs + hash(i, 11) * 170 * trs;
        const x = ((hash(i, 12) * W * 1.5 - tt * 900) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.25;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 120 + hash(i, 13) * 160, y); ctx.stroke();
      }
      ctx.restore();
      // near bank and reeds rushing past in the foreground
      tile(A.nearBank, 700, A.bankY, W);
      tile(A.reeds, 700, A.bankY - 96, 900);
      if (Pt) tile(A.reeds, 820, H - 150, 900);
      // her reply pops up over her window, then Mom reads it
      const ra = seg(t, 34.9, 35.35) * (1 - seg(t, 37.75, 38.15));
      if (ra > 0) {
        const g = A.winGeom;
        const winX = tx + (A.her.car * (g.carW + g.gap) + 18 + A.her.win * ((g.carW - 36) / 7) + ((g.carW - 36) / 7 - 10) / 2) * trs;
        const sc = (Pt ? 0.82 : 1) * (0.5 + 0.5 * easeOutBack(seg(t, 34.9, 35.35)));
        const bx = winX - A.replyTip[0] * sc, by = A.trainY - 8 - A.replyTip[1] * sc;
        MA.draw(ctx, A.reply, bx + MA.boil(95, t, 1), by + Math.sin(t * 1.6) * 3 - (1 - ra) * 20, -0.015, sc, sc, ra);
        const rd = seg(t, 36.2, 36.4) * ra;
        if (rd > 0) {
          ctx.save();
          ctx.globalAlpha = rd;
          ctx.fillStyle = '#7a6440'; ctx.font = `500 ${Math.round(20 * sc)}px ${MA.SANS}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText('已读', bx + 290 * sc, by + 46 * sc);
          ctx.restore();
        }
      }
    }
  };
})();

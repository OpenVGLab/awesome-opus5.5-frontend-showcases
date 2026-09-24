'use strict';
// The film timeline: which scene is on screen at time t, the collage transitions between them,
// and the paper-grain finish. renderFrame(t) is a pure function of t.
(function () {
  const MA = window.MA;
  const { C, seg, smooth, easeIn, easeOut, easeInOut, clamp, lerp, hash } = MA;
  const P = MA.paper;
  const F = (MA.film = {});

  F.DUR = 59.5;
  F.CHAPTERS = [
    { t: 0, zh: '深夜', en: 'Late night' },
    { t: 9, zh: '望月', en: 'The moon' },
    { t: 15, zh: '故乡', en: 'Home, remembered' },
    { t: 24, zh: '传说', en: 'Legends' },
    { t: 33, zh: '归途', en: 'The way home' },
    { t: 39, zh: '团圆', en: 'Reunion' },
    { t: 47, zh: '中秋快乐', en: 'Happy Mid-Autumn' },
  ];

  const bufs = [];
  F.buf = function (i) {
    const L = F.L;
    if (!bufs[i] || bufs[i].width !== L.W || bufs[i].height !== L.H) bufs[i] = MA.makeCanvas(L.W, L.H);
    return bufs[i];
  };

  F.init = function (canvas, aspect) {
    F.canvas = canvas;
    F.ctx = canvas.getContext('2d');
    P.init();
    F.setAspect(aspect || '16:9');
  };

  F.setAspect = function (aspect) {
    const portrait = aspect === '9:16';
    const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;
    F.aspect = portrait ? '9:16' : '16:9';
    F.canvas.width = W;
    F.canvas.height = H;
    F.L = { W, H, P: portrait };
    for (const k of Object.keys(MA.scenes)) MA.scenes[k].build(F.L);
    buildFinish(F.L);
    buildTears(F.L);
  };

  let vignette = null;
  function buildFinish(L) {
    const { W, H } = L;
    vignette = MA.makeCanvas(W, H);
    const g = vignette.getContext('2d');
    const r = Math.hypot(W, H) / 2;
    const gr = g.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
    gr.addColorStop(0, 'rgba(10,8,20,0)');
    gr.addColorStop(1, 'rgba(10,8,20,0.42)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  // A jagged tear line down the frame, reused for the tear transition.
  let tear = null;
  function buildTears(L) {
    const { W, H } = L;
    const pts = [];
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const y = -40 + f * (H + 80);
      const x = W * (0.5 + (L.P ? 0.04 : 0.06) * Math.sin(f * 3.1 + 0.6)) + MA.fbm1(f * 9, 77, 4) * 38 + (hash(i, 78) - 0.5) * 10;
      pts.push([x, y]);
    }
    const left = [[-60, -40], ...pts, [-60, H + 40]];
    const right = [...pts, [W + 60, H + 40], [W + 60, -40]];
    tear = {
      left: P.toPath(left),
      right: P.toPath(right),
      leftEdge: P.toPath(P.tear(left, { amp: 4, freq: 0.08, seed: 81, step: 3 }).map((p, i) => p)),
      rightEdge: P.toPath(P.tear(right, { amp: 4, freq: 0.08, seed: 82, step: 3 })),
    };
  }

  // Tear the outgoing frame (bufA) down the middle; halves slide apart over the incoming frame.
  function tearTransition(ctx, t, a, b, drawOut) {
    const L = F.L;
    const p = seg(t, a, b);
    const buf = F.buf(0);
    const bctx = buf.getContext('2d');
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    drawOut(bctx);
    const e = easeInOut(p);
    const halves = [
      { path: tear.left, edge: tear.leftEdge, dx: -1, rot: -0.07 },
      { path: tear.right, edge: tear.rightEdge, dx: 1, rot: 0.06 },
    ];
    // a small crack opens first, then the halves pull away
    const open = 0.012 * smooth(p / 0.25) + e * (L.P ? 0.62 : 0.58);
    for (const h of halves) {
      ctx.save();
      const px = h.dx < 0 ? 0 : L.W, py = h.dx < 0 ? L.H : 0;
      ctx.translate(px, py);
      ctx.rotate(h.rot * e);
      ctx.translate(-px + h.dx * open * L.W, -py + (h.dx < 0 ? 1 : -1) * e * L.H * 0.04);
      ctx.shadowColor = 'rgba(4,6,14,0.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetX = h.dx * 8;
      ctx.fillStyle = C.riceL;
      ctx.fill(h.edge);
      ctx.shadowColor = 'transparent';
      ctx.save();
      ctx.clip(h.path);
      ctx.drawImage(buf, 0, 0);
      ctx.restore();
      ctx.restore();
    }
  }

  // Card flip: outgoing frame turns edge-on, incoming frame turns face-up.
  function flipTransition(ctx, t, a, b, drawOut, drawIn) {
    const L = F.L;
    const p = seg(t, a, b);
    ctx.fillStyle = '#131a33';
    ctx.fillRect(0, 0, L.W, L.H);
    ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = P.pattern(ctx); ctx.fillRect(0, 0, L.W, L.H); ctx.restore();
    const first = p < 0.5;
    const buf = F.buf(0);
    const bctx = buf.getContext('2d');
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    (first ? drawOut : drawIn)(bctx);
    const q = first ? p / 0.5 : (1 - p) / 0.5;
    const sx = Math.max(0.002, Math.cos(q * Math.PI / 2));
    const lift = Math.sin(p * Math.PI);
    const sc = 1 - 0.14 * lift;
    ctx.save();
    ctx.translate(L.W / 2, L.H / 2 - lift * 20);
    ctx.rotate((first ? -1 : 1) * 0.03 * lift);
    ctx.scale(sc * sx, sc * (1 + 0.05 * (1 - sx) * lift));
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26;
    ctx.fillStyle = C.riceL;
    ctx.fillRect(-L.W / 2 - 14, -L.H / 2 - 14, L.W + 28, L.H + 28);
    ctx.shadowColor = 'transparent';
    ctx.drawImage(buf, -L.W / 2, -L.H / 2);
    // the turning face darkens as it goes edge-on
    ctx.fillStyle = `rgba(10,10,30,${(1 - sx) * 0.5})`;
    ctx.fillRect(-L.W / 2, -L.H / 2, L.W, L.H);
    ctx.restore();
  }

  function scene(id) { return MA.scenes[id]; }
  function draw(id, ctx, t) { const s = scene(id); if (s && s.draw) s.draw(ctx, t, F.L); }

  // Table of shots: [start, end, fn]
  F.compose = function (ctx, t) {
    const L = F.L;
    if (t < 8.55) return draw('night', ctx, t);
    if (t < 9.45) {
      draw('moon', ctx, t);
      return tearTransition(ctx, t, 8.55, 9.45, (c) => draw('night', c, t));
    }
    if (t < 14.95) return draw('moon', ctx, t);
    if (t < 15.2) {
      draw('home', ctx, t);
      const buf = F.buf(0), bctx = buf.getContext('2d');
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      draw('moon', bctx, t);
      ctx.save(); ctx.globalAlpha = 1 - smooth(seg(t, 14.95, 15.2)); ctx.drawImage(buf, 0, 0); ctx.restore();
      return;
    }
    if (t < 23.35) return draw('home', ctx, t);
    if (t < 24.45) return flipTransition(ctx, t, 23.35, 24.45, (c) => draw('home', c, t), (c) => draw('legend', c, t));
    if (t < 33.4) {
      if (t < 32.85) draw('legend', ctx, t);
      else scene('train').enter(ctx, t, L, (c) => draw('legend', c, t));
      if (t >= 32.0) scene('train').ticket(ctx, t, L);
      return;
    }
    if (t < 38.3) {
      draw('train', ctx, t);
      if (t < 33.7) scene('train').ticket(ctx, t, L);
      return;
    }
    if (t < 39.4) return scene('reunion').enter(ctx, t, L);
    return draw(t < scene('wish').START ? 'reunion' : 'wish', ctx, t);
  };

  // Paper grain boils at 8 fps. Grain and vignette are both plain source-over layers, so each grain offset is
  // pre-composited with the vignette into one full-frame sheet; a cycle of four sheets is drawn with one drawImage.
  const finishSheets = [];
  function finishSheet(k) {
    const L = F.L;
    let s = finishSheets[k];
    if (s && s.width === L.W && s.height === L.H) return s;
    s = finishSheets[k] = MA.makeCanvas(L.W, L.H);
    const g = s.getContext('2d');
    g.save();
    g.translate(-hash(k, 1) * 256, -hash(k, 2) * 256);
    g.globalAlpha = 0.3;
    g.fillStyle = P.pattern(g, 'frameGrain');
    g.fillRect(0, 0, L.W + 256, L.H + 256);
    g.restore();
    g.drawImage(vignette, 0, 0);
    return s;
  }

  F.finish = function (ctx, t) {
    const L = F.L;
    ctx.drawImage(finishSheet(MA.step(t, 8) % 4), 0, 0);
    const fin = seg(t, 0, 0.7);
    if (fin < 1) { ctx.fillStyle = `rgba(6,8,18,${1 - fin})`; ctx.fillRect(0, 0, L.W, L.H); }
    const fout = seg(t, F.DUR - 0.6, F.DUR);
    if (fout > 0) { ctx.fillStyle = `rgba(6,8,18,${smooth(fout)})`; ctx.fillRect(0, 0, L.W, L.H); }
  };

  F.renderFrame = function (t) {
    t = clamp(Number(t) || 0, 0, F.DUR);
    const ctx = F.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.night0;
    ctx.fillRect(0, 0, F.L.W, F.L.H);
    F.compose(ctx, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    F.finish(ctx, t);
    F.lastT = t;
    return t;
  };

  F.chapterAt = function (t) {
    let c = 0;
    F.CHAPTERS.forEach((ch, i) => { if (t >= ch.t) c = i; });
    return c;
  };
})();

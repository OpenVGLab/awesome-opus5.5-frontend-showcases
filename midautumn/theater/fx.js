// 月宫小剧场 · fx: speech bubbles, sound-effect lettering, manga effects, transitions.
(function () {
  'use strict';
  const TH = window.TH;
  const { clamp, lerp, seg, TAU, E, fo, ell, OUT, font, mulberry32, star4, rrect, heart } = TH;

  const WHO = {
    change: { name: '嫦娥', color: '#f48fb1', voice: 'change' },
    rabbit: { name: '团团', color: '#b3a1f2', voice: 'rabbit' },
    kid: { name: '豆豆', color: '#ffb35c', voice: 'kid' },
    dog: { name: '天狗', color: '#8a9ad0', voice: 'dog' },
  };
  TH.WHO = WHO;

  const PUNCT = '，。！？、…～—；：';
  // Per-character reveal times for a bubble (seconds after the bubble starts typing).
  function revealTimes(b) {
    if (b._rt) return b._rt;
    const cps = b.cps || 15;
    const out = [];
    let tt = 0;
    for (const line of b.lines) {
      const row = [];
      for (const ch of line) {
        row.push(tt);
        tt += 1 / cps;
        if (ch === '，' || ch === '、') tt += 0.12;
        if (ch === '！' || ch === '？' || ch === '。') tt += 0.08;
        if (ch === '…') tt += 0.16;
      }
      out.push(row);
      tt += 0.06;
    }
    b._rt = out;
    b._typeDur = tt;
    return out;
  }
  TH.revealTimes = revealTimes;

  const widthCache = new Map();
  function charW(ctx, ch, size) {
    const k = ch + '|' + size;
    let w = widthCache.get(k);
    if (w === undefined) { ctx.font = font(size); w = ctx.measureText(ch).width; widthCache.set(k, w); }
    return w;
  }
  TH.clearWidthCache = () => widthCache.clear();

  function bubbleGeom(ctx, b) {
    const size = b.size || (b.style === 'shout' ? 78 : b.style === 'whisper' ? 56 : 62);
    const lh = size * 1.3;
    let maxW = 0;
    const widths = b.lines.map((l) => {
      let w = 0;
      for (const ch of l) w += charW(ctx, ch, size);
      maxW = Math.max(maxW, w);
      return w;
    });
    const padX = size * 0.62, padY = size * 0.46;
    const w = maxW + padX * 2, h = b.lines.length * lh - (lh - size) + padY * 2;
    return { size, lh, widths, w, h, padX, padY };
  }

  function spikyPath(ctx, w, h, seed, jit) {
    const rnd = mulberry32(seed);
    const n = 22, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const r = i % 2 ? 0.98 : 1.14 + rnd() * 0.08;
      const jx = jit ? (rnd() - 0.5) * jit : 0;
      pts.push([Math.cos(a) * (w * 0.56) * r + jx, Math.sin(a) * (h * 0.74) * r + jx]);
    }
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  }

  // b: {t0, t1, x, y, lines, who, style, tail:[x,y], size, cps}
  function bubble(ctx, b, t) {
    if (t < b.t0 || t > b.t1) return;
    const who = WHO[b.who] || WHO.change;
    const a = seg(t, b.t0, b.t0 + 0.24);
    const d = seg(t, b.t1 - 0.16, b.t1);
    let s = lerp(0.35, 1, E.outBack(a)) * (1 - 0.35 * d);
    const alpha = clamp(a * 3) * (1 - d);
    if (alpha <= 0) return;
    const g = bubbleGeom(ctx, b);
    const rt = revealTimes(b);
    const shake = b.style === 'shout' ? 1 : 0;
    const jx = shake ? Math.sin(t * 61) * 4 * (1 - a * 0.5) : 0;
    const jy = shake ? Math.cos(t * 53) * 4 * (1 - a * 0.5) : 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x + jx, b.y + jy);
    ctx.scale(s, s);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const w = g.w, h = g.h;
    // tail (in bubble-local coordinates)
    const drawTail = (fill, stroke, lw, off) => {
      if (!b.tail) return;
      const tx = (b.tail[0] - b.x) / s + off, ty = (b.tail[1] - b.y) / s + off;
      const ang = Math.atan2(ty, tx);
      const bx = clamp(tx * 0.35, -w / 2 + 50, w / 2 - 50) + off;
      const by = (ty > 0 ? h / 2 - 8 : -h / 2 + 8) + off;
      const side = Math.abs(ty) > Math.abs(tx) * 0.4 ? 0 : 1;
      ctx.beginPath();
      if (side === 0) {
        ctx.moveTo(bx - 28, by);
        ctx.quadraticCurveTo(bx - 6 + (tx - bx) * 0.3, by + (ty - by) * 0.55, tx, ty);
        ctx.quadraticCurveTo(bx + 12 + (tx - bx) * 0.3, by + (ty - by) * 0.4, bx + 30, by);
      } else {
        const sx = (tx > 0 ? w / 2 - 8 : -w / 2 + 8) + off, sy = clamp(ty * 0.3, -h / 2 + 30, h / 2 - 30) + off;
        ctx.moveTo(sx, sy - 24);
        ctx.quadraticCurveTo(sx + (tx - sx) * 0.5, sy + (ty - sy) * 0.3, tx, ty);
        ctx.quadraticCurveTo(sx + (tx - sx) * 0.4, sy + (ty - sy) * 0.6, sx, sy + 24);
      }
      ctx.closePath();
      fo(ctx, fill, stroke, lw);
      void ang;
    };
    const body = (off) => {
      if (b.style === 'shout') {
        ctx.save(); ctx.translate(off, off); spikyPath(ctx, w, h, 7 + (b.seed || 0), 0); ctx.restore();
      } else rrect(ctx, -w / 2 + off, -h / 2 + off, w, h, Math.min(56, h / 2));
    };
    // shadow plate in the speaker colour
    ctx.fillStyle = who.color;
    body(12); ctx.fill();
    drawTail(who.color, null, 0, 12);
    // outline pass then fill pass so the tail merges with the body
    ctx.strokeStyle = OUT; ctx.lineWidth = 13;
    if (b.style === 'whisper') { ctx.setLineDash([22, 14]); }
    body(0); ctx.stroke();
    drawTail(null, OUT, 13, 0);
    ctx.setLineDash([]);
    ctx.fillStyle = '#fffdf8';
    body(0); ctx.fill();
    drawTail('#fffdf8', null, 0, 0);
    // name tag
    if (b.name !== false) {
      ctx.font = font(32);
      const nw = ctx.measureText(who.name).width + 34;
      const nx = -w / 2 + 14, ny = -h / 2 - 26;
      rrect(ctx, nx, ny, nw, 48, 24); fo(ctx, who.color, OUT, 5);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.strokeText(who.name, nx + 17, ny + 25);
      ctx.fillText(who.name, nx + 17, ny + 25);
    }
    // text, revealed per character with a little pop
    const tt = t - b.t0 - 0.14;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const col = b.style === 'whisper' ? '#6b5a80' : b.style === 'shout' ? '#c4213f' : '#2e2236';
    for (let li = 0; li < b.lines.length; li++) {
      const line = b.lines[li];
      let x = -g.widths[li] / 2;
      const y = -h / 2 + g.padY + g.size / 2 + li * g.lh + 2;
      let ci = 0;
      for (const ch of line) {
        const cw = charW(ctx, ch, g.size);
        const r0 = rt[li][ci];
        const k = seg(tt, r0, r0 + 0.13);
        if (k > 0) {
          const cs = E.outBack(k);
          ctx.save();
          ctx.translate(x + cw / 2, y);
          ctx.scale(cs, cs);
          ctx.font = font(g.size);
          ctx.fillStyle = col;
          ctx.strokeStyle = col; ctx.lineWidth = b.style === 'shout' ? 3 : 1.6;
          ctx.strokeText(ch, -cw / 2, 0);
          ctx.fillText(ch, -cw / 2, 0);
          ctx.restore();
        }
        x += cw; ci++;
      }
    }
    ctx.restore();
  }

  // Variety-show style sound lettering (花字).
  function sfxText(ctx, text, x, y, size, t, t0, dur, opt = {}) {
    const d = t - t0;
    if (d < 0 || d > dur) return;
    const a = seg(d, 0, 0.2), f = seg(d, dur - 0.2, dur);
    const s = (opt.noPop ? 1 : E.outBackBig(a)) * (1 - 0.3 * f);
    const alpha = clamp(a * 4) * (1 - f);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + (opt.rise ? -opt.rise * d : 0));
    ctx.rotate(opt.rot || 0);
    ctx.scale(s, s);
    ctx.font = font(size);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    const chars = [...text];
    const ws = chars.map((c) => charW(ctx, c, size) * (opt.spacing || 1));
    const total = ws.reduce((p, c) => p + c, 0);
    let cx = -total / 2;
    const gr = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    gr.addColorStop(0, opt.fill || '#fff27a'); gr.addColorStop(1, opt.fill2 || '#ffb02e');
    chars.forEach((c, i) => {
      const wob = opt.wobble ? Math.sin(t * 12 + i * 1.3) * opt.wobble : 0;
      const cy = (opt.stairs ? i * opt.stairs : 0) + wob;
      ctx.save(); ctx.translate(cx, cy);
      ctx.strokeStyle = opt.outer || '#fff'; ctx.lineWidth = size * 0.3; ctx.strokeText(c, 0, 0);
      ctx.strokeStyle = opt.stroke || OUT; ctx.lineWidth = size * 0.15; ctx.strokeText(c, 0, 0);
      ctx.fillStyle = gr; ctx.fillText(c, 0, 0);
      ctx.restore();
      cx += ws[i];
    });
    ctx.restore();
  }

  function speedLines(ctx, cx, cy, t, k, color = 'rgba(255,255,255,0.85)', inner = 320) {
    if (k <= 0) return;
    const rnd = mulberry32(Math.floor(t * 20) * 7919 + 13);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = color;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU + rnd() * 0.06;
      const w = 0.008 + rnd() * 0.016;
      const r0 = inner + rnd() * 260;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a - w) * 2400, cy + Math.sin(a - w) * 2400);
      ctx.lineTo(cx + Math.cos(a + w) * 2400, cy + Math.sin(a + w) * 2400);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Manga reaction backdrop: radial burst + focus lines.
  function burstBackdrop(ctx, cx, cy, t, k, c0 = '#ffe1ec', c1 = '#e45b8c') {
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha = k;
    const g = ctx.createRadialGradient(cx, cy, 60, cx, cy, 1300);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(-200, -200, TH.W + 400, TH.H + 400);
    ctx.restore();
    speedLines(ctx, cx, cy, t, k, 'rgba(255,255,255,0.9)', 360);
  }

  function impactStar(ctx, x, y, r, t, t0, dur = 0.35, col = '#fff6b0') {
    const d = t - t0;
    if (d < 0 || d > dur) return;
    const k = d / dur;
    ctx.save();
    ctx.globalAlpha = 1 - k * k;
    ctx.translate(x, y);
    ctx.scale(0.6 + k * 0.8, 0.6 + k * 0.8);
    TH.star5(ctx, 0, 0, r, 0.45, 0.2);
    ctx.beginPath();
    const n = 14, rnd = mulberry32(99);
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU;
      const rr = i % 2 ? r * 0.45 : r * (0.9 + rnd() * 0.3);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    fo(ctx, col, OUT, 6);
    ctx.restore();
  }

  function sparkle(ctx, x, y, r, t, phase = 0, col = '#fffbe0') {
    const k = 0.55 + 0.45 * Math.sin(t * 7 + phase);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + phase) * 0.3);
    ctx.fillStyle = 'rgba(255,230,140,0.35)';
    star4(ctx, 0, 0, r * 1.6 * k, 0.3); ctx.fill();
    ctx.fillStyle = col;
    star4(ctx, 0, 0, r * k, 0.24); ctx.fill();
    ctx.restore();
  }

  // Crumbs burst from (x0, y0) at t0, deterministic.
  function crumbs(ctx, x0, y0, t, t0, n = 16, seed = 1, power = 1, dur = 1.3) {
    const dt = t - t0;
    if (dt < 0 || dt > dur) return;
    const rnd = mulberry32(seed);
    ctx.save();
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
      const sp = (380 + rnd() * 520) * power;
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      const x = x0 + vx * dt, y = y0 + vy * dt + 0.5 * 1800 * dt * dt;
      const sz = 7 + rnd() * 10;
      const col = rnd() < 0.6 ? '#f0bb5e' : '#8c4a2c';
      ctx.globalAlpha = clamp(1 - (dt / dur) * (dt / dur));
      ctx.save(); ctx.translate(x, y); ctx.rotate(dt * 8 * (rnd() - 0.5) * 3);
      ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.4); ctx.lineTo(sz * 0.3, -sz * 0.8); ctx.lineTo(sz, sz * 0.5); ctx.lineTo(-sz * 0.4, sz * 0.7); ctx.closePath();
      fo(ctx, col, OUT, 3);
      ctx.restore();
    }
    ctx.restore();
  }

  // Little bliss flowers orbiting a head.
  function blissFlowers(ctx, x, y, t, k = 1) {
    if (k <= 0) return;
    for (let i = 0; i < 4; i++) {
      const a = t * 1.5 + (i / 4) * TAU;
      const fx = x + Math.cos(a) * 150, fy = y + Math.sin(a) * 50 - 20;
      ctx.save(); ctx.globalAlpha = k;
      ctx.translate(fx, fy); ctx.scale(k, k);
      for (let j = 0; j < 5; j++) {
        const b = (j / 5) * TAU + t;
        ell(ctx, Math.cos(b) * 11, Math.sin(b) * 11, 10, 7, b);
        fo(ctx, i % 2 ? '#ffc1d6' : '#fff0a6', OUT, 3);
      }
      ell(ctx, 0, 0, 6, 6); fo(ctx, '#ff9f43', null);
      ctx.restore();
    }
  }

  function shockLines(ctx, x, y, t, k = 1, spread = 1) {
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = k;
    ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const j = Math.sin(t * 50) * 3;
    for (let i = -1; i <= 1; i++) {
      const a = -Math.PI / 2 + i * 0.45 * spread;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 30 + j, y + Math.sin(a) * 30);
      ctx.lineTo(x + Math.cos(a) * 70 + j, y + Math.sin(a) * 70);
      ctx.stroke();
    }
    ctx.restore();
  }

  function tag(ctx, text, x, y, t, t0, t1, col = '#e2433a') {
    if (t < t0 || t > t1) return;
    const a = E.outBack(seg(t, t0, t0 + 0.3)), d = seg(t, t1 - 0.2, t1);
    ctx.save();
    ctx.globalAlpha = 1 - d;
    ctx.font = font(44);
    const w = ctx.measureText(text).width + 64;
    ctx.translate(lerp(-w - 40, x, a), y);
    ctx.rotate(-0.03);
    rrect(ctx, 8, 8, w, 76, 16); ctx.fillStyle = 'rgba(40,20,50,0.35)'; ctx.fill();
    rrect(ctx, 0, 0, w, 76, 16); fo(ctx, col, OUT, 6);
    ctx.fillStyle = '#fff8e6'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(text, 32, 40);
    ctx.restore();
  }

  // Canned-laughter 花字: "哈" characters popping along a band.
  function laughs(ctx, t, t0, dur, y = 1790, seed = 3) {
    const d = t - t0;
    if (d < 0 || d > dur) return;
    const rnd = mulberry32(seed);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const st = i * 0.09 + rnd() * 0.05;
      const x = 150 + (i / (n - 1)) * 780 + (rnd() - 0.5) * 40;
      const yy = y + (rnd() - 0.5) * 60 + Math.sin(t * 16 + i) * 8;
      const size = 70 + rnd() * 30;
      sfxText(ctx, '哈', x, yy, size, t, t0 + st, dur - st, { rot: (rnd() - 0.5) * 0.5, fill: '#fff7a8', fill2: '#ffc233' });
    }
  }

  // Diagonal swipe transition; fully covers the frame at p = 0.5.
  function swipe(ctx, p, c1 = '#ffd54a', c2 = '#fff6d6') {
    if (p <= 0 || p >= 1) return;
    const W = TH.W, H = TH.H, S = 700, BW = W * 2.3;
    const x = lerp(-BW - 60, W + S + 60, p);
    const band = (x0, x1, col) => {
      ctx.beginPath();
      ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.lineTo(x1 - S, H); ctx.lineTo(x0 - S, H); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
    };
    ctx.save();
    band(x, x + BW, c1);
    band(x + BW - 170, x + BW - 70, c2);
    band(x + 70, x + 160, '#e2433a');
    ctx.restore();
  }

  function sweatDrop(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(15, -2, 12, 6); ctx.arc(0, 6, 12, 0, Math.PI); ctx.quadraticCurveTo(-15, -2, 0, -26);
    fo(ctx, '#a9dcff', '#3f7fb5', 4);
    ctx.restore();
  }

  Object.assign(TH, { bubble, bubbleGeom, sfxText, speedLines, burstBackdrop, impactStar, sparkle, crumbs, blissFlowers, shockLines, tag, laughs, swipe, sweatDrop });
})();

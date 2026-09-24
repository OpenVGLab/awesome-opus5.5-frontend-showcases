'use strict';
// A small hand-made brush: bristle ribbons for painted details and baked ink strokes for the calligraphy.
(function () {
  const MA = window.MA;
  const { fbm1, hash, rng, makeCanvas, spline } = MA;
  const B = (MA.brush = {});

  // Left/right edges of a variable-width ribbon; rough adds a wobble to each side independently.
  function edges(d, seed, rough, grow = 0) {
    const L = [], R = [];
    const n = d.length;
    for (let i = 0; i < n; i++) {
      const a = d[Math.max(0, i - 1)], b = d[Math.min(n - 1, i + 1)], p = d[i];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const w = p[2] * 0.5 + grow;
      const eL = Math.max(0, w + rough * fbm1(i * 0.17, seed, 3));
      const eR = Math.max(0, w + rough * fbm1(i * 0.17, seed + 5, 3));
      L.push([p[0] - ty * eL, p[1] + tx * eL]);
      R.push([p[0] + ty * eR, p[1] - tx * eR]);
    }
    return { L, R };
  }
  B.edges = edges;

  function ribbonPath(ctx, L, R, upto, capR) {
    const k = Math.min(upto, L.length - 1);
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= k; i++) ctx.lineTo(L[i][0], L[i][1]);
    if (capR > 0) {
      const mx = (L[k][0] + R[k][0]) / 2, my = (L[k][1] + R[k][1]) / 2;
      const a = Math.atan2(L[k][1] - my, L[k][0] - mx);
      ctx.arc(mx, my, capR, a, a + Math.PI, true);
    }
    for (let i = k; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
  }

  // Painted stroke drawn live: flat body + bristle streaks. ctrl = [[x, y, width], ...].
  B.stroke = function (ctx, ctrl, o = {}) {
    const d = o.dense ? ctrl : spline(ctrl, o.step || 3);
    if (d.length < 2) return;
    const seed = o.seed || 1;
    const { L, R } = edges(d, seed, o.rough ?? 0.8);
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.fillStyle = o.color || MA.C.ink;
    ctx.beginPath();
    ribbonPath(ctx, L, R, d.length - 1, 0);
    ctx.fill();
    const nb = o.bristles ?? 5;
    if (nb > 0) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = o.streak || 'rgba(255,248,230,0.35)';
      for (let k = 0; k < nb; k++) {
        const off = (hash(k, seed, 1) - 0.5) * 0.8;
        const f = 0.02 + hash(k, seed, 2) * 0.05;
        ctx.lineWidth = o.streakW || 0.9 + hash(k, seed, 3) * 1.1;
        ctx.beginPath();
        let on = false;
        for (let i = 0; i < d.length; i++) {
          const show = MA.noise1(i * f * 3 + k * 17, seed) > (o.streakGate ?? 0.55);
          const a = d[Math.max(0, i - 1)], b = d[Math.min(d.length - 1, i + 1)];
          let tx = b[0] - a[0], ty = b[1] - a[1];
          const tl = Math.hypot(tx, ty) || 1;
          const x = d[i][0] - (ty / tl) * d[i][2] * off, y = d[i][1] + (tx / tl) * d[i][2] * off;
          if (show) { if (on) ctx.lineTo(x, y); else ctx.moveTo(x, y); on = true; } else on = false;
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  // Dry crayon line: grainy dots scattered along a path (for sketchy outlines and hatching).
  B.crayon = function (ctx, ctrl, o = {}) {
    const d = spline(ctrl, o.step || 2);
    const R = rng(o.seed || 9);
    ctx.save();
    ctx.fillStyle = o.color || MA.C.ink;
    ctx.globalAlpha *= o.alpha ?? 0.8;
    ctx.beginPath();
    for (let i = 0; i < d.length; i++) {
      const w = d[i][2];
      const n = Math.max(1, Math.round(w * (o.density ?? 0.9)));
      for (let k = 0; k < n; k++) {
        const r = 0.35 + R() * 0.9;
        const x = d[i][0] + (R() - 0.5) * w, y = d[i][1] + (R() - 0.5) * w;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, 6.2832);
      }
    }
    ctx.fill();
    ctx.restore();
  };

  // ---------------- calligraphy ----------------
  // Baked ink stroke: soft bleed, dry-brush streaks (飞白), bristle striations. Revealed live with a clip mask.
  B.bake = function (ctrl, o) {
    const s = o.scale, ox = o.x, oy = o.y;
    const pts = ctrl.map((p) => [ox + p[0] * s, oy + p[1] * s, p[2] * s * (o.weight || 1)]);
    const d = spline(pts, 1.1);
    const seed = o.seed || 1;
    const { L, R } = edges(d, seed, 0.55 * s / 3.2);
    const mask = edges(d, seed, 0, 3.5);
    const bb = MA.paper.bounds([L, R]);
    const pad = 16;
    const res = o.res || 1;
    const c = makeCanvas((bb.x1 - bb.x0 + pad * 2) * res, (bb.y1 - bb.y0 + pad * 2) * res);
    const g = c.getContext('2d');
    g.setTransform(res, 0, 0, res, (pad - bb.x0) * res, (pad - bb.y0) * res);
    const ink = o.ink || MA.C.ink;
    // body with a slight bleed into the fibres
    g.save();
    g.shadowColor = MA.hex(ink, 0.55);
    g.shadowBlur = 2.6 * res;
    g.fillStyle = ink;
    g.beginPath();
    ribbonPath(g, L, R, d.length - 1, 0);
    g.fill();
    // heavier ink where the brush first lands
    g.globalAlpha = 0.35;
    const w0 = Math.max(d[2][2], d[0][2]);
    g.beginPath();
    g.ellipse(d[Math.min(4, d.length - 1)][0], d[Math.min(4, d.length - 1)][1], w0 * 0.55, w0 * 0.45, 0, 0, 6.2832);
    g.fill();
    g.restore();
    // dry-brush streaks towards the end of the stroke
    const len = d.length;
    const dry = o.dry ?? 0.5;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    const nStreak = 9;
    for (let k = 0; k < nStreak; k++) {
      const off = (hash(k, seed, 11) - 0.5) * 0.78;
      const start = Math.floor(len * (0.35 + hash(k, seed, 12) * 0.45));
      const wk = 0.5 + hash(k, seed, 13) * 1.3;
      g.lineWidth = wk;
      for (let i = start; i < len - 1; i += 2) {
        const f = (i - start) / Math.max(1, len - start);
        const gate = MA.noise1(i * 0.08 + k * 9.1, seed);
        if (gate < 0.35) continue;
        const a = d[Math.max(0, i - 1)], b = d[Math.min(len - 1, i + 3)];
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        const x0 = d[i][0] - ty * d[i][2] * off, y0 = d[i][1] + tx * d[i][2] * off;
        const j = Math.min(len - 1, i + 2);
        const x1 = d[j][0] - ty * d[j][2] * off, y1 = d[j][1] + tx * d[j][2] * off;
        g.globalAlpha = Math.min(1, dry * f * 1.6 * (0.4 + gate));
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
    }
    g.restore();
    // striations: a few darker hairs, a few semi-transparent ones
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.lineCap = 'round';
    for (let k = 0; k < 14; k++) {
      const off = (hash(k, seed, 21) - 0.5) * 0.9;
      g.strokeStyle = k % 3 === 0 ? 'rgba(90,80,100,0.22)' : 'rgba(0,0,0,0.28)';
      g.lineWidth = 0.6 + hash(k, seed, 22) * 0.8;
      g.beginPath();
      for (let i = 0; i < len; i += 2) {
        const a = d[Math.max(0, i - 1)], b = d[Math.min(len - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1;
        const x = d[i][0] - (ty / tl) * d[i][2] * off, y = d[i][1] + (tx / tl) * d[i][2] * off;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();
    // arc length for timing and for the moving brush tip
    const acc = [0];
    for (let i = 1; i < len; i++) acc.push(acc[i - 1] + Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]));
    return { c, bx: bb.x0 - pad, by: bb.y0 - pad, res, d, acc, mask, len: acc[len - 1] };
  };

  // Draw a baked stroke revealed up to arc fraction p (0..1).
  B.drawBaked = function (ctx, st, p, dx = 0, dy = 0) {
    if (p <= 0) return;
    const k = 1 / st.res;
    if (p >= 1) {
      ctx.drawImage(st.c, st.bx + dx, st.by + dy, st.c.width * k, st.c.height * k);
      return;
    }
    const target = st.len * p;
    let i = 0;
    while (i < st.acc.length - 1 && st.acc[i] < target) i++;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.beginPath();
    ribbonPath(ctx, st.mask.L, st.mask.R, i, st.d[i][2] * 0.5 + 3.5);
    ctx.clip();
    ctx.drawImage(st.c, st.bx, st.by, st.c.width * k, st.c.height * k);
    ctx.restore();
  };
  B.tipAt = function (st, p) {
    const target = st.len * MA.clamp(p);
    let i = 0;
    while (i < st.acc.length - 1 && st.acc[i] < target) i++;
    return st.d[i];
  };

  // Stroke skeletons on a 100 x 100 box: [x, y, width]. Stroke order follows standard writing order.
  B.GLYPHS = {
    '中': [
      [[21, 30, 2.5], [25, 33.5, 9], [26, 45, 7.6], [27, 57, 7.2], [28, 64, 5.5], [28.3, 66, 3]],
      [[26, 34.5, 4], [34, 34, 6.6], [50, 32.5, 6.2], [64, 31, 6.4], [72, 30, 8], [76, 32, 9.5], [75, 38, 8.4], [73.5, 50, 7.6], [72, 61, 6.8], [71.5, 65, 4]],
      [[29, 62.5, 4.5], [40, 62, 5.6], [55, 61, 5.4], [70, 60.5, 5]],
      [[47.5, 9, 4], [49.5, 13, 10.5], [50, 30, 9.4], [50.3, 50, 8.8], [50.5, 70, 8], [50.6, 84, 6], [50.7, 96, 1.5]],
    ],
    '秋': [
      [[40, 10, 3], [37.5, 12, 7.6], [30, 16, 6.4], [21, 20, 4.4], [14, 23, 2], [11, 24, 1]],
      [[8, 36, 3], [12, 35.2, 7.2], [24, 34, 6.2], [36, 32.4, 6.2], [42, 31.6, 6.8], [44.5, 32.2, 4]],
      [[25, 17, 4], [26.8, 20.5, 9.6], [27.2, 36, 8.6], [27.4, 56, 8.2], [27.6, 76, 8.2], [27.7, 88, 8.6], [27.5, 93, 6], [27, 95, 3]],
      [[25.5, 39, 5.5], [22, 46, 6.4], [16, 56, 5.2], [10, 65, 3], [6, 70, 1]],
      [[30.5, 45, 3], [34, 47.5, 7], [38, 51, 7.2], [40.5, 54, 4]],
      [[56, 33, 3], [57.5, 36, 7], [60, 42, 7.2], [61.5, 45.5, 4]],
      [[90, 28, 3], [88, 31, 7.6], [84, 38, 5.8], [80, 44, 3], [78, 46, 1]],
      [[71, 10, 4], [73, 14, 9.8], [73.2, 30, 9], [71.5, 48, 8.4], [67, 62, 7.2], [60, 76, 4.8], [53, 86, 2], [49, 90, 0.8]],
      [[72, 50, 2.5], [75, 56, 4], [80, 66, 6.5], [86, 76, 9.5], [91, 83, 11.5], [96, 87, 8], [100, 88.5, 2]],
    ],
    '快': [
      [[8, 35, 3], [10, 38, 6.6], [11.5, 44, 6.6], [12, 48, 3.5]],
      [[28, 28, 3], [30, 30.5, 6.2], [32, 34, 5.4], [33, 37, 2.5]],
      [[20, 9, 4], [21.2, 12.5, 9.8], [21.5, 30, 8.8], [21.7, 55, 8.2], [21.8, 78, 7.6], [21.9, 92, 4], [22, 96, 1.2]],
      [[41, 25, 3.5], [45, 24.4, 6.8], [58, 23.2, 6.2], [72, 22, 6.6], [80, 21, 8], [83.5, 23, 9.4], [82.5, 29, 8.2], [81.5, 40, 7.2], [81, 47, 4.5]],
      [[34, 50, 3.5], [39, 49.4, 7.4], [55, 48.2, 6.6], [75, 47, 6.6], [91, 46, 7.6], [95.5, 46.6, 5]],
      [[60, 5, 4], [62, 9, 9.6], [62.2, 25, 8.8], [60.5, 44, 8.2], [56, 60, 7.2], [49, 75, 5], [42, 87, 2], [37, 92, 0.8]],
      [[62, 52, 2.5], [66, 58, 4.2], [73, 68, 7], [81, 78, 10], [88, 85, 11.5], [94, 88.5, 8], [99, 89.5, 2]],
    ],
    '乐': [
      [[67, 8, 3], [64, 10, 7.6], [54, 13.6, 6.6], [43, 17.4, 5.6], [33, 21, 4.5]],
      [[33.5, 19.5, 4.5], [33, 26, 7.8], [32, 38, 7.2], [31.2, 48, 7.6], [31.8, 51, 6.8], [38, 50.4, 6], [56, 49, 6], [76, 47.6, 6.6], [86, 47, 7.6], [89.5, 47.6, 4.5]],
      [[57, 21, 4], [58.6, 25, 9.6], [59, 42, 8.8], [59.2, 62, 8.6], [59.3, 80, 9.2], [58.8, 88, 10.5], [54.5, 88.2, 7], [49.5, 85.5, 2.5], [47, 84, 0.8]],
      [[43, 58, 3.5], [41, 61.5, 7.2], [36, 68, 6], [30, 74, 3], [26, 77, 1]],
      [[71, 59, 3], [74, 63, 7.2], [78, 69, 7.6], [80, 73.5, 4]],
    ],
  };

  // Writing schedule in seconds relative to the start of a text; shared with the soundtrack.
  B.schedule = function (text, o = {}) {
    const out = [];
    let t = 0;
    const chars = [...text];
    chars.forEach((ch, ci) => {
      const strokes = B.GLYPHS[ch];
      strokes.forEach((st, si) => {
        let L = 0;
        for (let i = 1; i < st.length; i++) L += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]);
        const dur = MA.clamp(0.1 + L * (o.perUnit ?? 0.0036), 0.14, 0.5);
        out.push({ ch, ci, si, t0: t, t1: t + dur, len: L });
        t += dur + (o.gap ?? 0.07);
      });
      t += o.charGap ?? 0.22;
    });
    return out;
  };
})();

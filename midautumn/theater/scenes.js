// 月宫小剧场 · scenes: moon palace terrace, the mooncake moon (with bite / rabbit plug), Earth courtyard.
(function () {
  'use strict';
  const TH = window.TH;
  const { clamp, lerp, TAU, fo, ell, OUT, font, mulberry32, star4, rrect } = TH;
  const W = TH.W, H = TH.H;

  // ---------------------------------------------------------------- bitmap cache for static artwork
  let cache = {};
  function sprite(key, x0, y0, w, h, sc, draw) {
    let s = cache[key];
    if (!s) {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w * sc); cv.height = Math.ceil(h * sc);
      const c = cv.getContext('2d');
      c.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
      draw(c);
      s = cache[key] = { cv, x0, y0, w, h };
    }
    return s;
  }
  function blit(ctx, s, dx = 0, dy = 0) {
    ctx.drawImage(s.cv, s.x0 + dx, s.y0 + dy, s.w, s.h);
  }
  TH.clearCaches = () => { cache = {}; };

  // ---------------------------------------------------------------- shared bits
  const STARS = (() => {
    const r = mulberry32(2026), a = [];
    for (let i = 0; i < 160; i++) a.push({ x: r() * W, y: r() * 1350, s: 0.8 + r() * 2.2, p: r() * TAU, sp: 0.8 + r() * 2.6, big: r() < 0.07 });
    return a;
  })();

  function stars(ctx, t, alpha = 1, parX = 0, parY = 0) {
    for (const s of STARS) {
      const k = 0.45 + 0.55 * Math.sin(t * s.sp + s.p);
      const x = ((s.x + parX) % W + W) % W, y = s.y + parY;
      if (s.big) {
        ctx.fillStyle = `rgba(255,246,214,${(0.45 + 0.55 * k) * alpha})`;
        star4(ctx, x, y, 7 + 7 * k, 0.2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,255,255,${(0.3 + 0.55 * k) * alpha})`;
        ctx.beginPath(); ctx.arc(x, y, s.s, 0, TAU); ctx.fill();
      }
    }
  }

  function palaceSky(ctx, t, cam) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#141949'); g.addColorStop(0.42, '#2b2b70'); g.addColorStop(0.7, '#56408f'); g.addColorStop(1, '#8a63ad');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const px = cam ? -(cam.x - 540) * 0.08 : 0, py = cam ? -(cam.y - 960) * 0.08 : 0;
    stars(ctx, t, 1, px, py);
  }

  // Puffy cloud bank: circles along a baseline, merged outline.
  function cloudBank(ctx, x, y, w, seed, opt = {}) {
    const r = mulberry32(seed);
    const n = Math.max(3, Math.round(w / 90));
    const parts = [];
    for (let i = 0; i < n; i++) {
      const cx = x + (i + 0.5) * (w / n) + (r() - 0.5) * 30;
      const rr = (opt.size || 70) * (0.7 + r() * 0.6);
      parts.push([cx, y - rr * 0.35 - r() * 20, rr]);
    }
    const shape = (p) => ell(ctx, p[0], p[1], p[2], p[2] * 0.82);
    if (opt.outline) {
      ctx.strokeStyle = opt.outline; ctx.lineWidth = opt.lw || 10;
      for (const p of parts) { shape(p); ctx.stroke(); }
      ctx.beginPath(); ctx.rect(x, y - 10, w, opt.base || 400); ctx.stroke();
    }
    ctx.fillStyle = opt.fill || '#efe8fb';
    for (const p of parts) { shape(p); ctx.fill(); }
    ctx.beginPath(); ctx.rect(x, y - 10, w, opt.base || 400); ctx.fill();
    if (opt.shade) {
      ctx.fillStyle = opt.shade;
      for (const p of parts) { ell(ctx, p[0] + p[2] * 0.15, p[1] + p[2] * 0.35, p[2] * 0.75, p[2] * 0.4); ctx.fill(); }
    }
  }

  // ---------------------------------------------------------------- moon palace set
  function lantern(ctx, x, y, len, t, phase, s = 1) {
    const a = Math.sin(t * 1.8 + phase) * 0.07;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len); ctx.stroke();
    ctx.translate(0, len); ctx.scale(s, s);
    const g = ctx.createRadialGradient(0, 30, 5, 0, 30, 120);
    g.addColorStop(0, 'rgba(255,170,90,0.45)'); g.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = g; ctx.fillRect(-120, -90, 240, 240);
    rrect(ctx, -18, 0, 36, 12, 4); fo(ctx, '#f2b53c', OUT, 4);
    ell(ctx, 0, 40, 38, 32); fo(ctx, '#e8384f', OUT, 5);
    ctx.strokeStyle = 'rgba(120,10,30,0.45)'; ctx.lineWidth = 3;
    for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(0, 40, 38 * Math.abs(k) + 2, 31, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,220,150,0.55)'; ell(ctx, -10, 32, 12, 16); ctx.fill();
    rrect(ctx, -16, 70, 32, 10, 4); fo(ctx, '#f2b53c', OUT, 4);
    ctx.strokeStyle = '#f2b53c'; ctx.lineWidth = 4;
    for (const k of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(k, 80); ctx.lineTo(k * 1.4, 112); ctx.stroke(); }
    ctx.restore();
  }

  function palace(ctx, t) {
    blit(ctx, sprite('palace', -160, 860, 720, 480, 2, palaceStatic));
    lantern(ctx, 40, 1036, 40, t, 0, 0.9);
    lantern(ctx, 420, 1036, 56, t, 1.7, 0.9);
  }

  function palaceStatic(ctx) {
    ctx.save();
    ctx.lineJoin = 'round';
    const ol = 'rgba(40,24,60,0.9)';
    // walls / lattice
    ctx.fillStyle = '#e9dccb'; ctx.fillRect(-40, 1090, 470, 240);
    const lg = ctx.createRadialGradient(200, 1210, 20, 200, 1210, 260);
    lg.addColorStop(0, 'rgba(255,214,130,0.9)'); lg.addColorStop(1, 'rgba(255,190,110,0.15)');
    ctx.fillStyle = lg; ctx.fillRect(-40, 1090, 470, 240);
    ctx.strokeStyle = 'rgba(150,70,60,0.55)'; ctx.lineWidth = 3;
    for (let x = -40; x < 430; x += 26) { ctx.beginPath(); ctx.moveTo(x, 1100); ctx.lineTo(x, 1330); ctx.stroke(); }
    for (let y = 1110; y < 1330; y += 26) { ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(430, y); ctx.stroke(); }
    // round window
    ell(ctx, 200, 1200, 70, 70); fo(ctx, 'rgba(255,236,180,0.95)', '#8a3a3a', 8);
    // pillars
    for (const x of [10, 130, 270, 390]) { ctx.beginPath(); ctx.rect(x - 14, 1080, 28, 250); fo(ctx, '#b8374a', ol, 4); }
    // beams
    ctx.beginPath(); ctx.rect(-60, 1052, 520, 34); fo(ctx, '#2f4a7a', ol, 4);
    ctx.fillStyle = '#e8b64a';
    for (let x = -40; x < 460; x += 44) { ell(ctx, x, 1069, 9, 6); ctx.fill(); }
    ctx.beginPath(); ctx.rect(-60, 1032, 520, 20); fo(ctx, '#3f7a6a', ol, 3);
    // roof
    ctx.beginPath();
    ctx.moveTo(-140, 990);
    ctx.quadraticCurveTo(-40, 1036, 60, 1034);
    ctx.lineTo(360, 1034);
    ctx.quadraticCurveTo(470, 1036, 540, 968);
    ctx.quadraticCurveTo(470, 1000, 430, 990);
    ctx.lineTo(360, 912);
    ctx.lineTo(40, 912);
    ctx.lineTo(-40, 986);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, 900, 0, 1040);
    rg.addColorStop(0, '#3b3478'); rg.addColorStop(1, '#262257');
    fo(ctx, rg, ol, 5);
    ctx.strokeStyle = 'rgba(140,130,210,0.45)'; ctx.lineWidth = 4;
    for (let x = -20; x < 470; x += 28) {
      ctx.beginPath(); ctx.moveTo(lerp(40, 360, (x + 20) / 490), 918); ctx.lineTo(x, 1026); ctx.stroke();
    }
    ctx.strokeStyle = '#e8b64a'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-140, 990); ctx.quadraticCurveTo(-40, 1036, 60, 1034); ctx.lineTo(360, 1034); ctx.quadraticCurveTo(470, 1036, 540, 968); ctx.stroke();
    // ridge + ornaments
    ctx.beginPath(); ctx.rect(30, 896, 340, 20); fo(ctx, '#e8b64a', ol, 4);
    for (const s of [0, 1]) {
      const x = s ? 372 : 28;
      ctx.save(); ctx.translate(x, 900); if (!s) ctx.scale(-1, 1);
      ctx.beginPath(); ctx.moveTo(-6, 16); ctx.quadraticCurveTo(20, 10, 22, -20); ctx.quadraticCurveTo(10, -30, 4, -14); ctx.quadraticCurveTo(0, 0, -6, 4); ctx.closePath();
      fo(ctx, '#e8b64a', ol, 4); ctx.restore();
    }
    ell(ctx, 200, 886, 18, 18); fo(ctx, '#ffd54a', ol, 4);
    // plaque 广寒宫
    rrect(ctx, 120, 956, 160, 62, 8); fo(ctx, '#1f2f63', '#e8b64a', 6);
    ctx.fillStyle = '#ffd98a'; ctx.font = font(40); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('广寒宫', 200, 989);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  const PETALS = (() => { const r = mulberry32(88), a = []; for (let i = 0; i < 26; i++) a.push({ x: r(), y: r(), s: 4 + r() * 5, sp: 40 + r() * 60, sw: r() * TAU, dr: r() }); return a; })();

  function tree(ctx) {
    blit(ctx, sprite('tree', 760, 700, 360, 740, 2, treeStatic));
  }

  function treeStatic(ctx) {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const ol = 'rgba(30,24,40,0.9)';
    // trunk
    ctx.beginPath();
    ctx.moveTo(1000, 1420); ctx.bezierCurveTo(990, 1300, 1010, 1180, 972, 1060);
    ctx.bezierCurveTo(950, 990, 930, 960, 900, 930);
    ctx.lineTo(920, 918); ctx.bezierCurveTo(960, 950, 990, 990, 1004, 1040);
    ctx.bezierCurveTo(1030, 990, 1060, 960, 1100, 950); ctx.lineTo(1100, 980);
    ctx.bezierCurveTo(1060, 1000, 1030, 1060, 1034, 1140);
    ctx.bezierCurveTo(1040, 1250, 1050, 1340, 1060, 1420);
    ctx.closePath();
    fo(ctx, '#6b4636', ol, 5);
    ctx.strokeStyle = 'rgba(40,20,20,0.35)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(1020, 1400); ctx.quadraticCurveTo(1012, 1260, 1000, 1120); ctx.stroke();
    // canopy
    const cl = [[900, 880, 88], [990, 830, 104], [1080, 880, 90], [860, 980, 74], [960, 950, 96], [1060, 1000, 88], [920, 1060, 64], [1010, 1080, 70]];
    ctx.strokeStyle = ol; ctx.lineWidth = 12;
    for (const [x, y, r] of cl) { ell(ctx, x, y, r, r * 0.86); ctx.stroke(); }
    cl.forEach(([x, y, r], i) => { ell(ctx, x, y, r, r * 0.86); ctx.fillStyle = i % 2 ? '#2e5c4b' : '#3a725c'; ctx.fill(); });
    ctx.fillStyle = 'rgba(120,190,140,0.35)';
    for (const [x, y, r] of cl) { ell(ctx, x - r * 0.25, y - r * 0.3, r * 0.45, r * 0.25); ctx.fill(); }
    // osmanthus blossoms
    const rr = mulberry32(7);
    for (let i = 0; i < 70; i++) {
      const c = cl[Math.floor(rr() * cl.length)];
      const a = rr() * TAU, d = rr() * c[2] * 0.85;
      const x = c[0] + Math.cos(a) * d, y = c[1] + Math.sin(a) * d * 0.86;
      const tw = 0.7 + 0.3 * Math.sin(i * 2.3);
      ctx.fillStyle = i % 3 ? '#ffc93c' : '#ffe07a';
      for (let k = 0; k < 4; k++) { ell(ctx, x + Math.cos(k * 1.57) * 4, y + Math.sin(k * 1.57) * 4, 3.6 * tw, 3.6 * tw); ctx.fill(); }
    }
    ctx.restore();
  }

  function fallingPetals(ctx, t, x0, x1, y0, y1, alpha = 1) {
    ctx.save();
    for (const p of PETALS) {
      const span = y1 - y0;
      const y = y0 + ((p.y * span + t * p.sp) % span);
      const x = x0 + p.x * (x1 - x0) + Math.sin(t * 1.3 + p.sw) * 30;
      ctx.globalAlpha = alpha * clamp((y - y0) / 80) * clamp((y1 - y) / 80);
      ctx.fillStyle = p.dr > 0.5 ? '#ffd23f' : '#ffb938';
      ell(ctx, x, y, p.s, p.s * 0.6, t * 2 + p.sw); ctx.fill();
    }
    ctx.restore();
  }

  function terrace(ctx, t) {
    ctx.save();
    const ol = 'rgba(70,52,110,0.85)';
    // floor
    const fg = ctx.createLinearGradient(0, 1414, 0, 1790);
    fg.addColorStop(0, '#e7ddf4'); fg.addColorStop(1, '#c6b5e2');
    ctx.fillStyle = fg; ctx.fillRect(-400, 1410, W + 800, 380);
    ctx.strokeStyle = 'rgba(150,130,200,0.45)'; ctx.lineWidth = 3;
    for (let k = 0; k < 7; k++) { const y = 1414 + Math.pow(k / 6, 1.5) * 370; ctx.beginPath(); ctx.moveTo(-400, y); ctx.lineTo(W + 400, y); ctx.stroke(); }
    for (let x = -900; x <= 2000; x += 170) { ctx.beginPath(); ctx.moveTo(540 + (x - 540) * 0.45, 1414); ctx.lineTo(x, 1790); ctx.stroke(); }
    // back balustrade
    rrect(ctx, -400, 1394, W + 800, 22, 6); fo(ctx, '#efe8f7', ol, 4);
    for (let x = -60; x < W + 100; x += 170) {
      rrect(ctx, x + 22, 1340, 126, 52, 10); fo(ctx, '#e3d9f1', ol, 3);
      ctx.strokeStyle = 'rgba(150,130,200,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x + 70, 1368, 12, Math.PI * 0.2, Math.PI * 1.8); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 100, 1368, 12, Math.PI * 1.2, Math.PI * 2.8); ctx.stroke();
    }
    rrect(ctx, -400, 1318, W + 800, 22, 6); fo(ctx, '#f6f1fb', ol, 4);
    for (let x = -60; x < W + 100; x += 170) {
      rrect(ctx, x - 13, 1300, 26, 114, 6); fo(ctx, '#f6f1fb', ol, 4);
      ell(ctx, x, 1294, 17, 14); fo(ctx, '#f6f1fb', ol, 4);
    }
    // front edge + trim
    ctx.beginPath(); ctx.rect(-400, 1788, W + 800, 36); fo(ctx, '#9d8cc6', ol, 4);
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-400, 1796); ctx.lineTo(W + 400, 1796); ctx.stroke();
    ctx.restore();
    // clouds below the terrace
    cloudBank(ctx, -300, 1880, W + 600, 41, { size: 90, fill: '#f3edfc', outline: OUT, lw: 10, shade: 'rgba(200,185,235,0.6)' });
  }

  function palaceBackdrop(ctx, t) {
    // far clouds behind the palace
    ctx.save();
    ctx.globalAlpha = 0.55;
    cloudBank(ctx, -300 + ((t * 12) % 100), 1330, 900, 12, { size: 80, fill: '#b9a4df' });
    cloudBank(ctx, 500 - ((t * 9) % 100), 1320, 900, 19, { size: 70, fill: '#c5b3e6' });
    ctx.restore();
    palace(ctx, t);
    tree(ctx);
  }

  // ---------------------------------------------------------------- the moon (a giant mooncake)
  const BITE = [[0.45, 1.04, 0.2], [0.66, 1.0, 0.225], [0.88, 1.04, 0.2]]; // angle, dist/R, radius/R
  TH.BITE_ANGLE = 0.66;

  function scallop(ctx, x, y, R, depth = 0.035, lobes = 16) {
    ctx.beginPath();
    const n = 320;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const r = R * (1 - depth + depth * Math.pow(Math.abs(Math.cos(a * lobes / 2)), 0.7));
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function embossRing(ctx, x, y, r, lw, dark, light) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = light; ctx.beginPath(); ctx.arc(x - 2, y - 3, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = dark; ctx.beginPath(); ctx.arc(x + 2, y + 2, r, 0, TAU); ctx.stroke();
  }

  function mooncakeFace(c, x, y, R, t) {
    scallop(c, x, y, R);
    const g = c.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R * 1.05);
    g.addColorStop(0, '#fff4c4'); g.addColorStop(0.55, '#ffd672'); g.addColorStop(1, '#eea54a');
    fo(c, g, '#b8742e', Math.max(3, R * 0.024));
    const dark = 'rgba(190,120,50,0.75)', light = 'rgba(255,248,210,0.9)';
    embossRing(c, x, y, R * 0.8, R * 0.022, dark, light);
    // petals ring
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + Math.PI / 12;
      const px = x + Math.cos(a) * R * 0.64, py = y + Math.sin(a) * R * 0.64;
      c.save(); c.translate(px, py); c.rotate(a);
      c.lineWidth = R * 0.018;
      c.strokeStyle = light; ell(c, -1.5, -2, R * 0.075, R * 0.13); c.stroke();
      c.strokeStyle = dark; ell(c, 1.5, 1.5, R * 0.075, R * 0.13); c.stroke();
      c.restore();
    }
    embossRing(c, x, y, R * 0.46, R * 0.02, dark, light);
    embossRing(c, x, y, R * 0.41, R * 0.012, dark, light);
    c.font = font(R * 0.46);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(176,108,40,0.8)'; c.fillText('月', x + R * 0.012, y + R * 0.035);
    c.fillStyle = 'rgba(255,246,205,0.95)'; c.fillText('月', x - R * 0.01, y + R * 0.005);
    c.fillStyle = '#f0b456'; c.fillText('月', x, y + R * 0.02);
    c.textAlign = 'left';
    // sheen
    c.save(); scallop(c, x, y, R); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.28)';
    ell(c, x - R * 0.42, y - R * 0.5, R * 0.34, R * 0.16, -0.6); c.fill();
    c.restore();
  }

  function moonFarFace(c, x, y, R) {
    scallop(c, x, y, R, 0.012);
    const g = c.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
    g.addColorStop(0, '#fffdf0'); g.addColorStop(0.6, '#ffefb8'); g.addColorStop(1, '#f6d488');
    c.fillStyle = g; c.fill();
    c.fillStyle = 'rgba(232,196,120,0.35)';
    ell(c, x - R * 0.3, y + R * 0.1, R * 0.22, R * 0.16); c.fill();
    ell(c, x + R * 0.05, y - R * 0.35, R * 0.16, R * 0.1); c.fill();
    ell(c, x - R * 0.05, y + R * 0.45, R * 0.14, R * 0.09); c.fill();
  }

  function moonGlow(far, R) {
    const gr = far ? 2.7 : 2.0;
    return sprite('glow' + (far ? 'f' : 'n') + R, -R * gr, -R * gr, R * gr * 2, R * gr * 2, 0.5, (c) => {
      const g = c.createRadialGradient(0, 0, R * 0.85, 0, 0, R * gr);
      g.addColorStop(0, far ? 'rgba(255,240,180,0.55)' : 'rgba(255,214,120,0.55)');
      g.addColorStop(1, 'rgba(255,214,120,0)');
      c.fillStyle = g; c.fillRect(-R * gr, -R * gr, R * gr * 2, R * gr * 2);
    });
  }

  // Moon face bitmap; the bite is cut with compositing so the three overlapping bite circles merge cleanly.
  function moonFace(far, bite, R) {
    const pad = R * 0.1;
    return sprite('moon' + (far ? 'f' : 'n') + (bite ? 'b' : '') + R, -R - pad, -R - pad, 2 * (R + pad), 2 * (R + pad), far ? 1.6 : 2.2, (c) => {
      if (far) moonFarFace(c, 0, 0, R); else mooncakeFace(c, 0, 0, R);
      if (!bite) return;
      const circ = (k, grow) => { const [a, d, r] = BITE[k]; c.beginPath(); c.arc(Math.cos(a) * d * R, Math.sin(a) * d * R, r * R + grow, 0, TAU); };
      c.globalCompositeOperation = 'source-atop';
      const rim = far ? R * 0.05 : R * 0.075;
      for (let k = 0; k < 3; k++) { circ(k, rim); c.fillStyle = far ? '#e7c07a' : '#94502d'; c.fill(); }
      if (!far) {
        c.fillStyle = '#ffb631';
        for (let k = 0; k < 3; k++) { const [a, d, r] = BITE[k]; c.beginPath(); c.arc(Math.cos(a) * (d * R - r * R - rim * 0.5), Math.sin(a) * (d * R - r * R - rim * 0.5), rim * 0.32, 0, TAU); c.fill(); }
      }
      c.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 3; k++) { circ(k, 0); c.fill(); }
      c.globalCompositeOperation = 'source-atop';
      c.strokeStyle = far ? '#d9a95a' : '#5b2a18';
      c.lineWidth = far ? R * 0.03 : R * 0.035;
      for (let k = 0; k < 3; k++) { circ(k, 0); c.stroke(); }
      c.globalCompositeOperation = 'source-over';
    });
  }

  // Draw a moon (near = mooncake, far = seen from Earth), optionally bitten and/or plugged by 团团.
  function moon(ctx, x, y, R, st = {}) {
    const far = !!st.far;
    blit(ctx, moonGlow(far, R), x, y);
    blit(ctx, moonFace(far, !!st.bite, R), x, y);
    if (st.plug > 0) {
      ctx.save();
      scallop(ctx, x, y, R, far ? 0.012 : 0.035);
      ctx.clip();
      const a = TH.BITE_ANGLE;
      const bx = x + Math.cos(a) * R * 0.84, by = y + Math.sin(a) * R * 0.84;
      ctx.translate(bx, by);
      const pk = st.plug;
      ctx.scale(pk, pk);
      if (far) farRabbit(ctx, R);
      else TH.drawRabbitBall(ctx, Object.assign({ r: R * 0.4 }, st.ball || {}));
      ctx.restore();
      if (!far) { scallop(ctx, x, y, R); ctx.strokeStyle = '#b8742e'; ctx.lineWidth = Math.max(3, R * 0.024); ctx.stroke(); }
    }
    if (st.sparkle > 0) {
      const k = st.sparkle, tt = st.t || 0;
      TH.sparkle(ctx, x - R * 0.45, y - R * 0.52, 34 * k, tt, 0);
      TH.sparkle(ctx, x + R * 0.55, y - R * 0.2, 26 * k, tt, 1.7);
      TH.sparkle(ctx, x + R * 0.1, y + R * 0.62, 20 * k, tt, 3.1);
    }
  }

  // The rabbit as seen from Earth: a soft white bunny tucked into the moon.
  function farRabbit(ctx, R) {
    const r = R * 0.4;
    ctx.save();
    ctx.lineJoin = 'round';
    const ol = 'rgba(190,150,90,0.9)';
    ell(ctx, -r * 0.5, -r * 0.85, r * 0.55, r * 0.2, -0.4); fo(ctx, '#ffffff', ol, 3);
    ell(ctx, r * 0.45, -r * 0.85, r * 0.55, r * 0.2, 0.45); fo(ctx, '#ffffff', ol, 3);
    ell(ctx, 0, 0, r, r * 0.93); fo(ctx, '#fffdf6', ol, 3);
    ctx.fillStyle = '#4a3550';
    ell(ctx, -r * 0.33, -r * 0.08, r * 0.09, r * 0.12); ctx.fill();
    ell(ctx, r * 0.33, -r * 0.08, r * 0.09, r * 0.12); ctx.fill();
    ctx.fillStyle = 'rgba(255,130,160,0.6)';
    ell(ctx, -r * 0.55, r * 0.15, r * 0.14, r * 0.08); ctx.fill();
    ell(ctx, r * 0.55, r * 0.15, r * 0.14, r * 0.08); ctx.fill();
    ctx.strokeStyle = '#4a3550'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-r * 0.12, r * 0.12); ctx.quadraticCurveTo(-r * 0.06, r * 0.22, 0, r * 0.14); ctx.quadraticCurveTo(r * 0.06, r * 0.22, r * 0.12, r * 0.12); ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- Earth courtyard
  const CITY = (() => {
    const r = mulberry32(515), b = [];
    let x = -30;
    while (x < W + 30) {
      const w = 80 + r() * 90, h = 200 + r() * 260;
      const wins = [];
      for (let wy = 1480 - h + 30; wy < 1440; wy += 44) for (let wx = x + 16; wx < x + w - 20; wx += 34) wins.push([wx, wy, r() < 0.55, r()]);
      b.push({ x, w, h, c: r() < 0.5 ? '#1b2452' : '#222c5e', wins });
      x += w + 6;
    }
    return b;
  })();

  function earthSky(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d1640'); g.addColorStop(0.55, '#1f2f6b'); g.addColorStop(1, '#3a4d8f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    stars(ctx, t, 0.6);
  }

  function cityBase(ctx) {
    for (const b of CITY) {
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, 1480 - b.h, b.w, b.h + 40);
      ctx.fillStyle = 'rgba(255,210,122,0.85)';
      for (const [wx, wy, lit] of b.wins) if (lit) ctx.fillRect(wx, wy, 16, 22);
    }
  }

  // Neighbours at their windows, phones flashing at the moon.
  function cityPeople(ctx, t) {
    for (const b of CITY) {
      for (const [wx, wy, lit, rv] of b.wins) {
        if (!lit || rv >= 0.35 || wy > 1370) continue;
        ctx.fillStyle = '#1b2452';
        ell(ctx, wx + 8, wy + 12, 4, 4); ctx.fill();
        ctx.fillRect(wx + 3, wy + 16, 10, 6);
        if (Math.sin(t * 9 + rv * 50) > 0.85) {
          ctx.fillStyle = '#fff';
          star4(ctx, wx + 13, wy + 4, 16, 0.2); ctx.fill();
        }
      }
    }
  }

  function roofRow(ctx, y, t) {
    ctx.save();
    const ol = 'rgba(14,18,40,0.9)';
    for (let i = -1; i < 5; i++) {
      const x = i * 280 + 40;
      ctx.beginPath();
      ctx.moveTo(x - 30, y + 40);
      ctx.quadraticCurveTo(x + 20, y + 60, x + 70, y + 58);
      ctx.lineTo(x + 230, y + 58);
      ctx.quadraticCurveTo(x + 280, y + 60, x + 320, y + 34);
      ctx.lineTo(x + 250, y);
      ctx.lineTo(x + 60, y);
      ctx.closePath();
      fo(ctx, '#2b3668', ol, 4);
      ctx.fillStyle = '#3a4680'; ctx.fillRect(x + 60, y - 10, 190, 12);
      ctx.fillStyle = '#26305e'; ctx.fillRect(x + 20, y + 58, 260, 120);
      ctx.fillStyle = 'rgba(255,200,110,0.8)'; ctx.fillRect(x + 110, y + 90, 26, 34); ctx.fillRect(x + 170, y + 90, 26, 34);
    }
    ctx.restore();
  }

  function lanternString(ctx, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(30,20,40,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-20, 150); ctx.quadraticCurveTo(540, 330, 1100, 170); ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const u = (i + 0.5) / 6;
      const x = lerp(-20, 1100, u);
      const y = (1 - u) * (1 - u) * 150 + 2 * (1 - u) * u * 330 + u * u * 170;
      lantern(ctx, x, y, 16, t, i * 1.3, 0.8);
    }
  }

  function balcony(ctx, t) {
    ctx.save();
    const ol = OUT;
    // floor
    const fg = ctx.createLinearGradient(0, 1690, 0, H);
    fg.addColorStop(0, '#6b3d33'); fg.addColorStop(1, '#4a2824');
    ctx.fillStyle = fg; ctx.fillRect(0, 1690, W, H - 1690);
    ctx.strokeStyle = 'rgba(30,10,10,0.35)'; ctx.lineWidth = 3;
    for (let y = 1720; y < H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // railing
    for (let x = 20; x < W; x += 92) { rrect(ctx, x, 1570, 22, 124, 6); fo(ctx, '#b8322f', ol, 4); }
    rrect(ctx, -20, 1556, W + 40, 26, 8); fo(ctx, '#c93a33', ol, 5);
    rrect(ctx, -20, 1668, W + 40, 22, 8); fo(ctx, '#9e2a28', ol, 5);
    ctx.fillStyle = '#f2c14e';
    for (let x = 31; x < W; x += 92) { ell(ctx, x, 1556, 12, 9); ctx.fill(); }
    ctx.restore();
  }

  function table(ctx, t) {
    ctx.save();
    ctx.translate(800, 1740);
    ctx.lineJoin = 'round';
    rrect(ctx, -20, 20, 40, 160, 10); fo(ctx, '#7a3b2e', OUT, 5);
    ell(ctx, 0, 0, 230, 58); fo(ctx, '#9a4a36', OUT, 6);
    ell(ctx, 0, -8, 214, 46); fo(ctx, '#b35a40', null);
    // plate of mooncakes
    ell(ctx, -70, -18, 110, 30); fo(ctx, '#f4f0ff', OUT, 5);
    for (const [x, y] of [[-120, -30], [-64, -38], [-20, -26], [-92, -12], [-40, -6]]) {
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.5);
      scallop(ctx, 0, 0, 30, 0.08, 12); fo(ctx, '#f0b85a', OUT, 5);
      ctx.restore();
    }
    // pomelo
    ell(ctx, 120, -58, 58, 52); fo(ctx, '#d9e36a', OUT, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, 100, -80, 18, 10, -0.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(126, -108); ctx.quadraticCurveTo(160, -140, 180, -112); ctx.quadraticCurveTo(150, -104, 126, -108); fo(ctx, '#4caf6a', OUT, 4);
    // teacup
    rrect(ctx, 30, -40, 44, 36, 10); fo(ctx, '#ffffff', OUT, 4);
    ctx.strokeStyle = '#4a6fb5'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(34, -26); ctx.lineTo(70, -26); ctx.stroke();
    ctx.restore();
  }

  function earth(ctx, t, st = {}) {
    earthSky(ctx, t);
    moon(ctx, 770, 520, 170, { far: true, bite: st.bite, plug: st.plug, t });
    // wispy clouds
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#c9d4ff';
    for (let i = 0; i < 3; i++) { const x = ((t * 18 + i * 420) % 1500) - 300; ell(ctx, x, 760 + i * 90, 220, 22); ctx.fill(); }
    ctx.restore();
    blit(ctx, sprite('earth', 0, 900, W, H - 900, 1, (c) => { cityBase(c); roofRow(c, 1400); balcony(c); table(c); }));
    if (st.people) cityPeople(ctx, t);
    lanternString(ctx, t);
  }

  Object.assign(TH, { palaceSky, palaceBackdrop, terrace, moon, scallop, earth, table, cloudBank, fallingPetals, lantern, stars });
})();

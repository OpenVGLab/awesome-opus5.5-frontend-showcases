// 嫦娥: chibi moon goddess on a little cloud. drawChangE(ctx, pose) draws with the cloud centre at (0, 0).
(function () {
  'use strict';
  const TH = window.TH;
  const { clamp, TAU, fo, ell, OUT, star4 } = TH;

  const C = {
    skin: '#ffe8d8', hair: '#2c2447', hairShine: '#6a5aa6', top: '#fff6f3', collar: '#d8344e',
    skirtA: '#ffd3de', skirtB: '#f28bad', sash: '#f4c250', ribbon: '#8fd6e2', ribbonHi: '#d9f6fa',
    sleeve: '#fff0f3', cuff: '#d8344e', blush: 'rgba(255,120,150,0.45)', mouth: '#9a2440',
    lip: '#e24a6a', iris1: '#2a1840', iris2: '#9a5a86', gold: '#f2b53c', cloudA: '#ffffff', cloudB: '#e6dcfa',
  };

  const DEF = {
    sx: 1, sy: 1, lean: 0, flip: 1, time: 0,
    eyes: 'open', look: [0, 0], blink: 0, brows: null,
    mouth: 'smile', talk: 0, armL: 'rest', armR: 'rest',
    hairUp: 0, blush: 0.5, anger: 0, sweat: 0, makeup: 0, cloud: true, pop: 0, mirror: false,
  };

  const ARM = {
    rest: [22, -262, 1],
    hip: [104, -272, 0.8],
    point: [212, -392, 0.7],
    pointUp: [150, -548, 0.4],
    up: [168, -540, 0.35],
    cover: [88, -416, 0.6],
    mirror: [150, -424, 0.7],
    wave: [170, -486, 0.5],
    fist: [70, -352, 0.8],
    shrug: [150, -350, 0.6],
  };

  function sleeve(ctx, side, pose, t) {
    const a = ARM[pose] || ARM.rest;
    const sx = side * 64, sy = -332;
    const hx = side * a[0], hy = a[1], drape = a[2];
    const dx = hx - sx, dy = hy - sy, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    let nx = -uy, ny = ux;
    if (ny > 0.05 || (Math.abs(ny) <= 0.05 && nx * side < 0)) { nx = -nx; ny = -ny; }
    const w0 = 28, w1 = 46;
    const cx = hx - ux * 10, cy = hy - uy * 10;
    const topS = [sx + nx * w0, sy + ny * w0], botS = [sx - nx * w0 * 0.7, sy - ny * w0 * 0.7 + 8];
    const topC = [cx + nx * w1, cy + ny * w1], botC = [cx - nx * w1, cy - ny * w1];
    const sway = Math.sin(t * 2.2 + side) * 6;
    const low = Math.max(botS[1], botC[1]) + 78 * drape;
    ctx.beginPath();
    ctx.moveTo(topS[0], topS[1]);
    ctx.quadraticCurveTo((topS[0] + topC[0]) / 2 + nx * 8, (topS[1] + topC[1]) / 2 + ny * 8, topC[0], topC[1]);
    ctx.lineTo(botC[0], botC[1]);
    ctx.bezierCurveTo(botC[0] + sway, botC[1] + 70 * drape, (botS[0] + botC[0]) / 2 + sway, low, botS[0], botS[1]);
    ctx.closePath();
    fo(ctx, C.sleeve, OUT, 6);
    // cuff trim
    ctx.beginPath(); ctx.moveTo(topC[0], topC[1]); ctx.lineTo(botC[0], botC[1]);
    ctx.bezierCurveTo(botC[0] + sway, botC[1] + 70 * drape, (botS[0] + botC[0]) / 2 + sway, low, botS[0] + (botC[0] - botS[0]) * 0.25, low - 8);
    ctx.strokeStyle = C.cuff; ctx.lineWidth = 7; ctx.stroke();
    // hand
    const px = hx + ux * 6, py = hy + uy * 6;
    ell(ctx, px, py, 16, 15); fo(ctx, C.skin, OUT, 5);
    if (pose === 'point' || pose === 'pointUp') {
      ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(uy, ux));
      TH.rrect(ctx, 6, -6, 30, 12, 6); fo(ctx, C.skin, OUT, 4.5);
      ctx.restore();
    }
    return [px, py];
  }

  function eyes(ctx, p) {
    const ey = -452, ex = 46;
    const [lx, ly] = p.look;
    const pop = 1 + 0.5 * clamp(p.pop);
    for (const side of [-1, 1]) {
      const x = side * ex, y = ey;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      switch (p.eyes) {
        case 'closed':
          ctx.beginPath(); ctx.arc(x, y + 10, 20, Math.PI * 1.15, Math.PI * 1.85);
          ctx.strokeStyle = OUT; ctx.lineWidth = 6.5; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + side * 18, y - 1); ctx.lineTo(x + side * 27, y - 7); ctx.lineWidth = 4; ctx.stroke();
          break;
        case 'shock': {
          ctx.translate(x, y); ctx.scale(pop, pop);
          ell(ctx, 0, 0, 27, 31); fo(ctx, '#fff', OUT, 5.5);
          ell(ctx, lx * 0.4, ly * 0.4, 5, 5); fo(ctx, OUT, null);
          break;
        }
        case 'squint': {
          ctx.save();
          ctx.beginPath(); ctx.rect(x - 30, y - 2, 60, 40); ctx.clip();
          ell(ctx, x + lx, y + 2, 20, 26); fo(ctx, C.iris1, null);
          ctx.restore();
          ctx.beginPath(); ctx.moveTo(x - 27, y - 2); ctx.lineTo(x + 27, y - 4);
          ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.stroke();
          break;
        }
        default: { // open / stern / angry / sad
          const bl = clamp(p.blink);
          const g = ctx.createLinearGradient(0, y - 28, 0, y + 28);
          g.addColorStop(0, C.iris1); g.addColorStop(1, C.iris2);
          ctx.save();
          ctx.translate(x + lx, y + ly);
          ctx.scale(1, 1 - bl * 0.92);
          ell(ctx, 0, 2, 20, 28); fo(ctx, g, null);
          ell(ctx, 0, 6, 10, 14); fo(ctx, 'rgba(20,8,30,0.55)', null);
          if (bl < 0.5) {
            ctx.fillStyle = '#fff';
            ell(ctx, -7, -9, 8, 9); ctx.fill();
            ell(ctx, 7, 12, 3.5, 3.5); ctx.fill();
            ctx.fillStyle = 'rgba(255,190,230,0.6)'; ell(ctx, 0, 20, 10, 5); ctx.fill();
          }
          ctx.restore();
          // lids
          ctx.strokeStyle = OUT; ctx.fillStyle = OUT;
          if (p.eyes === 'stern' || p.eyes === 'angry') {
            ctx.save();
            ctx.beginPath(); ctx.moveTo(x - 30, y - 34); ctx.lineTo(x + 30, y - 34);
            ctx.lineTo(x + 30, y + (p.eyes === 'angry' ? (side < 0 ? -2 : -12) : -8));
            ctx.lineTo(x - 30, y + (p.eyes === 'angry' ? (side < 0 ? -12 : -2) : -8));
            ctx.closePath(); ctx.fillStyle = C.skin; ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x - 28, y + (p.eyes === 'angry' ? (side < 0 ? -12 : -2) : -8));
            ctx.lineTo(x + 28, y + (p.eyes === 'angry' ? (side < 0 ? -2 : -12) : -8));
            ctx.lineWidth = 7; ctx.stroke();
            ctx.restore();
          } else {
            const top = y - 26 + bl * 26;
            ctx.beginPath();
            ctx.moveTo(x - side * 24, top + 8);
            ctx.quadraticCurveTo(x, top - 8, x + side * 26, top + 2);
            ctx.lineTo(x + side * 33, top - 6);
            ctx.lineWidth = 6.5; ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  }

  function mouth(ctx, p) {
    ctx.save(); ctx.translate(0, -392);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 4.5;
    const talk = clamp(p.talk);
    const lip = p.makeup > 0.5 ? C.lip : C.mouth;
    switch (p.mouth) {
      case 'open':
        ell(ctx, 0, 2 + 3 * talk, 8 + 4 * talk, 3 + 10 * talk); fo(ctx, lip, OUT, 4);
        break;
      case 'scream': {
        ctx.beginPath();
        ctx.moveTo(-24, -6); ctx.quadraticCurveTo(0, -12, 24, -6);
        ctx.quadraticCurveTo(30, 44, 0, 50); ctx.quadraticCurveTo(-30, 44, -24, -6);
        fo(ctx, C.mouth, OUT, 5);
        ell(ctx, 0, 36, 13, 8); fo(ctx, '#ff8a9e', null);
        ctx.beginPath(); ctx.moveTo(-18, -4); ctx.quadraticCurveTo(0, -8, 18, -4); ctx.lineTo(16, 4); ctx.quadraticCurveTo(0, 0, -16, 4); ctx.closePath();
        fo(ctx, '#fff', null);
        break;
      }
      case 'flat':
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
        break;
      case 'pout':
        ctx.beginPath(); ctx.moveTo(-6, -6); ctx.quadraticCurveTo(4, -3, -2, 0); ctx.quadraticCurveTo(4, 3, -6, 6); ctx.stroke();
        break;
      case 'grin':
        ctx.beginPath(); ctx.moveTo(-18, -3); ctx.quadraticCurveTo(0, 1, 18, -3); ctx.quadraticCurveTo(14, 20, 0, 21); ctx.quadraticCurveTo(-14, 20, -18, -3);
        fo(ctx, lip, OUT, 4);
        break;
      case 'wavy':
        ctx.beginPath(); ctx.moveTo(-15, 2);
        for (let i = 1; i <= 5; i++) ctx.lineTo(-15 + i * 6, i % 2 ? -3 : 2);
        ctx.stroke();
        break;
      case 'o':
        ell(ctx, 0, 2, 7, 9); fo(ctx, C.mouth, OUT, 4);
        break;
      default: // smile
        ctx.beginPath(); ctx.moveTo(-12, -3); ctx.quadraticCurveTo(0, 9, 12, -3); ctx.stroke();
        if (p.makeup > 0.5) { ctx.fillStyle = C.lip; ell(ctx, 0, 1, 7, 3); ctx.fill(); }
        if (talk > 0.15) { ell(ctx, 0, 3, 7, 6 * talk); fo(ctx, lip, OUT, 3.5); }
    }
    ctx.restore();
  }

  function bez(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, v = 1 - u;
      out.push([
        v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
        v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
      ]);
    }
    return out;
  }

  // A silk strip along a centreline; width pulses to suggest the ribbon twisting.
  function ribbonStrip(ctx, pts, w0, phase, taper) {
    const L = [], R = [];
    const n = pts.length - 1;
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, s = i / n;
      const w = w0 * (0.3 + 0.7 * Math.abs(Math.cos(s * 4.2 + phase))) * (1 - taper * s);
      L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
      R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    ctx.beginPath();
    L.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    for (let i = n; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
    fo(ctx, 'rgba(160,226,236,0.88)', OUT, 4);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = 'rgba(235,252,255,0.8)'; ctx.lineWidth = 3; ctx.stroke();
  }

  function cloud(ctx, t) {
    const parts = [[-86, -6, 36], [-40, -24, 46], [16, -30, 50], [70, -16, 40], [110, -2, 28], [0, 6, 70]];
    const shape = (i) => { const [x, y, r] = parts[i]; if (i === 5) ell(ctx, x, y, 120, 26); else ell(ctx, x, y, r, r * 0.86); };
    ctx.strokeStyle = OUT; ctx.lineWidth = 12;
    for (let i = 0; i < parts.length; i++) { shape(i); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -70, 0, 30);
    g.addColorStop(0, C.cloudA); g.addColorStop(1, C.cloudB);
    ctx.fillStyle = g;
    for (let i = 0; i < parts.length; i++) { shape(i); ctx.fill(); }
    ctx.strokeStyle = 'rgba(150,130,200,0.8)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(-84, -4, 16, Math.PI * 0.2, Math.PI * 1.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(-84, -4, 7, Math.PI * 1.7, Math.PI * 3.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(66, -14, 14, Math.PI * 1.1, Math.PI * 2.4); ctx.stroke();
  }

  function flower(ctx, x, y, r) {
    ctx.save(); ctx.translate(x, y);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      ell(ctx, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.5, r * 0.36, a);
      fo(ctx, '#ff8fb3', OUT, 4);
    }
    ell(ctx, 0, 0, r * 0.28, r * 0.28); fo(ctx, '#ffd54a', OUT, 4);
    ctx.restore();
  }

  function drawChangE(ctx, pose) {
    const p = Object.assign({}, DEF, pose);
    const t = p.time;
    ctx.save();
    ctx.scale(p.sx, p.sy);
    ctx.rotate(p.lean);
    if (p.flip < 0) ctx.scale(-1, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const hu = clamp(p.hairUp);

    // --- ribbon (披帛): twisting silk strips — wings behind the shoulders + two fluttering tails
    const w1 = Math.sin(t * 2.1) * 12, w2 = Math.sin(t * 2.3 + 1.3) * 20, w3 = Math.sin(t * 1.7 + 2.2) * 18;
    for (const s of [-1, 1]) {
      ribbonStrip(ctx, bez([s * 90, -300], [s * (190 + w1), -330], [s * 200, -470 - hu * 40], [s * 96, -500 - hu * 20], 18), 15, t * 1.4 + s, 0.25);
      ribbonStrip(ctx, bez([s * 104, -290], [s * (150 - w2 * s * 0.2), -220], [s * (230 + w3), -210 - hu * 50], [s * (196 + w2), -120 - hu * 90], 18), 14, t * 1.8 + s * 2, 0.55);
    }

    // --- long back hair
    ctx.beginPath();
    ctx.moveTo(-112, -470);
    ctx.bezierCurveTo(-146 - hu * 20, -380, -126, -300, -98, -240);
    ctx.quadraticCurveTo(-64, -222, -34, -240); ctx.quadraticCurveTo(0, -226, 34, -240); ctx.quadraticCurveTo(64, -222, 98, -240);
    ctx.bezierCurveTo(126, -300, 146 + hu * 20, -380, 112, -470);
    ctx.closePath(); fo(ctx, C.hair, OUT, 6);

    // --- skirt
    ctx.beginPath();
    ctx.moveTo(-58, -306);
    ctx.bezierCurveTo(-80, -220, -118, -120, -140, -38);
    ctx.quadraticCurveTo(0, -14, 140, -38);
    ctx.bezierCurveTo(118, -120, 80, -220, 58, -306);
    ctx.closePath();
    const sg = ctx.createLinearGradient(0, -300, 0, -30);
    sg.addColorStop(0, C.skirtA); sg.addColorStop(1, C.skirtB);
    fo(ctx, sg, OUT, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4;
    for (const k of [-0.55, -0.18, 0.2, 0.56]) {
      ctx.beginPath(); ctx.moveTo(k * 90, -290); ctx.quadraticCurveTo(k * 150, -160, k * 210, -44); ctx.stroke();
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-128, -62); ctx.quadraticCurveTo(0, -40, 128, -62); ctx.stroke();

    // --- top & collar
    ctx.beginPath();
    ctx.moveTo(-34, -354); ctx.lineTo(-72, -334); ctx.quadraticCurveTo(-78, -312, -60, -300);
    ctx.lineTo(60, -300); ctx.quadraticCurveTo(78, -312, 72, -334); ctx.lineTo(34, -354); ctx.closePath();
    fo(ctx, C.top, OUT, 6);
    ctx.strokeStyle = C.collar; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-28, -352); ctx.lineTo(16, -304); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28, -352); ctx.lineTo(2, -322); ctx.stroke();

    // --- sash with bow
    TH.rrect(ctx, -63, -316, 126, 24, 8); fo(ctx, C.sash, OUT, 5);
    const bt = Math.sin(t * 2.5) * 6;
    ctx.strokeStyle = OUT; ctx.lineWidth = 16;
    const tails = () => {
      ctx.beginPath(); ctx.moveTo(-4, -300); ctx.quadraticCurveTo(-18 + bt, -250, -10 + bt, -196); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, -300); ctx.quadraticCurveTo(22 - bt, -254, 18 - bt, -206); ctx.stroke();
    };
    tails(); ctx.strokeStyle = C.collar; ctx.lineWidth = 9; tails();
    ell(ctx, -18, -304, 18, 11, 0.3); fo(ctx, C.collar, OUT, 4.5);
    ell(ctx, 18, -304, 18, 11, -0.3); fo(ctx, C.collar, OUT, 4.5);
    ell(ctx, 0, -304, 8, 8); fo(ctx, '#ff6b84', OUT, 4.5);

    // --- sleeves & hands (raised arms are drawn again in front of the head below)
    const FRONT = { cover: 1, mirror: 1, fist: 1, up: 1, pointUp: 1, wave: 1 };
    const arm = (side, pose) => {
      const h = sleeve(ctx, side, pose, t);
      if (pose === 'mirror' && p.mirror) {
        ctx.save(); ctx.translate(h[0] + side * 4, h[1] - 30);
        ell(ctx, 0, 0, 27, 27); fo(ctx, C.gold, OUT, 5);
        ell(ctx, 0, 0, 19, 19); fo(ctx, '#cfeefc', null);
        ctx.fillStyle = '#fff'; ell(ctx, -6, -6, 5, 8, 0.5); ctx.fill();
        ctx.restore();
      }
    };
    if (!FRONT[p.armL]) arm(-1, p.armL);
    if (!FRONT[p.armR]) arm(1, p.armR);

    // --- head
    ctx.save();
    ctx.translate(0, -hu * 10);
    // buns
    for (const s of [-1, 1]) {
      const bx = s * 72, by = -600 - hu * 26;
      ell(ctx, bx, by, 46, 44); fo(ctx, C.hair, OUT, 6);
      ctx.strokeStyle = C.hairShine; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(bx, by, 30, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
      ctx.strokeStyle = C.collar; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(bx, by + 8, 44, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
      // ribbon tails
      const rt = Math.sin(t * 3 + s) * 8 - hu * 20;
      ctx.strokeStyle = OUT; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(bx + s * 36, by + 30); ctx.quadraticCurveTo(bx + s * 60, by + 50 + rt, bx + s * 58, by + 84 + rt); ctx.stroke();
      ctx.strokeStyle = C.collar; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(bx + s * 36, by + 30); ctx.quadraticCurveTo(bx + s * 60, by + 50 + rt, bx + s * 58, by + 84 + rt); ctx.stroke();
    }
    // hairpin with dangling beads (步摇)
    const sw = Math.sin(t * 2.6) * 0.22 - hu * 1.6;
    ctx.save(); ctx.translate(108, -636 - hu * 26);
    ctx.strokeStyle = OUT; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-50, 30); ctx.lineTo(14, -12); ctx.stroke();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-50, 30); ctx.lineTo(14, -12); ctx.stroke();
    ctx.beginPath(); ctx.arc(20, -16, 18, Math.PI * 0.35, Math.PI * 1.65); ctx.arc(28, -16, 14, Math.PI * 1.6, Math.PI * 0.4, true); ctx.closePath();
    fo(ctx, C.gold, OUT, 4.5);
    for (let i = 0; i < 3; i++) {
      const len = 36 + i * 14, a = sw + i * 0.08;
      const bx = 14 + i * 8 + Math.sin(a) * len, by = -4 + Math.cos(a) * len;
      ctx.strokeStyle = C.gold; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(14 + i * 8, -4); ctx.lineTo(bx, by); ctx.stroke();
      ell(ctx, bx, by, 6, 6); fo(ctx, i === 1 ? '#e8384f' : C.gold, OUT, 3);
    }
    ctx.restore();
    if (p.makeup > 0.5) flower(ctx, -104, -628 - hu * 26, 28);

    // back hair mass
    ell(ctx, 0, -478, 136, 128); fo(ctx, C.hair, OUT, 6);
    // face
    ctx.beginPath();
    ctx.moveTo(-116, -468);
    ctx.bezierCurveTo(-118, -540, -64, -578, 0, -578);
    ctx.bezierCurveTo(64, -578, 118, -540, 116, -468);
    ctx.bezierCurveTo(114, -402, 62, -356, 0, -354);
    ctx.bezierCurveTo(-62, -356, -114, -402, -116, -468);
    ctx.closePath();
    fo(ctx, C.skin, OUT, 6);
    if (p.anger > 0) {
      ctx.save(); ctx.clip();
      const ag = ctx.createLinearGradient(0, -580, 0, -420);
      ag.addColorStop(0, `rgba(230,40,60,${0.55 * p.anger})`); ag.addColorStop(1, 'rgba(230,40,60,0)');
      ctx.fillStyle = ag; ctx.fillRect(-130, -600, 260, 200);
      ctx.restore();
    }
    // blush
    ctx.fillStyle = C.blush;
    ctx.globalAlpha = 0.6 + 0.4 * clamp(p.blush + p.makeup * 0.4);
    ell(ctx, -80, -414, 22 + p.makeup * 4, 12 + p.makeup * 2); ctx.fill();
    ell(ctx, 80, -414, 22 + p.makeup * 4, 12 + p.makeup * 2); ctx.fill();
    ctx.globalAlpha = 1;
    eyes(ctx, p);
    mouth(ctx, p);
    // fringe
    ctx.beginPath();
    ctx.moveTo(-124, -432);
    ctx.bezierCurveTo(-136, -540, -72, -604, 0, -604);
    ctx.bezierCurveTo(72, -604, 136, -540, 124, -432);
    const fr = [[108, -514], [86, -508], [62, -536], [36, -514], [10, -542], [-16, -515], [-42, -540], [-68, -512], [-92, -526], [-110, -496], [-124, -446]];
    let prev = [124, -432];
    for (const q of fr) {
      ctx.quadraticCurveTo((prev[0] + q[0]) / 2 + 4, Math.max(prev[1], q[1]) + 6, q[0], q[1]);
      prev = q;
    }
    ctx.closePath();
    fo(ctx, C.hair, OUT, 6);
    ctx.strokeStyle = C.hairShine; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, -470, 108, Math.PI * 1.22, Math.PI * 1.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -470, 108, Math.PI * 1.5, Math.PI * 1.72); ctx.stroke();
    // side locks
    for (const s of [-1, 1]) {
      const fl = hu * 30;
      ctx.beginPath();
      ctx.moveTo(s * 124, -486);
      ctx.bezierCurveTo(s * (138 + fl), -420, s * (132 + fl), -380, s * (116 + fl), -336);
      ctx.quadraticCurveTo(s * (104 + fl), -326, s * (98 + fl), -344);
      ctx.bezierCurveTo(s * 104, -380, s * 102, -430, s * 96, -476);
      ctx.closePath(); fo(ctx, C.hair, OUT, 5);
    }
    if (p.brows !== 'none') drawBrowsOnly(ctx, p);
    ctx.restore();
    if (FRONT[p.armL]) arm(-1, p.armL);
    if (FRONT[p.armR]) arm(1, p.armR);
    ctx.save();
    ctx.translate(0, -hu * 10);
    if (p.sweat > 0) {
      ctx.save(); ctx.translate(132, -520); ctx.scale(p.sweat, p.sweat);
      ctx.beginPath(); ctx.moveTo(0, -28); ctx.quadraticCurveTo(16, -2, 13, 6); ctx.arc(0, 6, 13, 0, Math.PI); ctx.quadraticCurveTo(-16, -2, 0, -28);
      fo(ctx, '#a9dcff', '#3f7fb5', 4);
      ctx.restore();
    }
    if (p.anger > 0.5) { // anger mark
      ctx.save(); ctx.translate(-120, -560); ctx.strokeStyle = '#e8384f'; ctx.lineWidth = 7;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(6, 6); ctx.quadraticCurveTo(8, 18, 20, 20); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    if (p.cloud) cloud(ctx, t);
    ctx.restore();
  }

  // Brows only (anime brows sit on top of the fringe).
  function drawBrowsOnly(ctx, p) {
    const ex = 46;
    const brows = p.brows || { stern: 'mad', angry: 'mad', shock: 'up', squint: 'flat' }[p.eyes] || 'soft';
    ctx.lineCap = 'round';
    const path = (side) => {
      const x = side * ex, y = brows === 'up' ? -512 : -496;
      ctx.beginPath();
      if (brows === 'mad') { ctx.moveTo(x + side * 22, y - 10); ctx.lineTo(x - side * 18, y + 6); }
      else if (brows === 'up') { ctx.moveTo(x - side * 16, y - 8); ctx.quadraticCurveTo(x, y - 22, x + side * 22, y - 10); }
      else if (brows === 'worry') { ctx.moveTo(x + side * 22, y + 4); ctx.lineTo(x - side * 16, y - 10); }
      else if (brows === 'flat') { ctx.moveTo(x - 16, y); ctx.lineTo(x + 18, y); }
      else { ctx.moveTo(x - side * 14, y + 2); ctx.quadraticCurveTo(x, y - 10, x + side * 20, y); }
    };
    for (const side of [-1, 1]) {
      path(side); ctx.strokeStyle = C.skin; ctx.lineWidth = 8; ctx.stroke();
      path(side); ctx.strokeStyle = OUT; ctx.lineWidth = 5.5; ctx.stroke();
    }
  }

  TH.drawChangE = drawChangE;
  TH.drawCloudSeat = cloud;
  TH.drawFlower = flower;
})();

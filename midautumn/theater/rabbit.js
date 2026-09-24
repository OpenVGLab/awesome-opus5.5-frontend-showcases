// 团团 (玉兔): a white mochi bunny. drawRabbit(ctx, pose) draws with the feet at (0, 0).
(function () {
  'use strict';
  const TH = window.TH;
  const { clamp, TAU, fo, ell, OUT, smoothClosed, star4 } = TH;

  const C = {
    fur: '#fffaf3', shade: '#e6ddf3', earIn: '#ffb6c6', blush: 'rgba(255,120,150,0.5)',
    nose: '#ff8aa5', eye: '#2a1c33', bow: '#e8384f', mouth: '#8a2438', tongue: '#ff8a9e',
    drool: '#cdeeff', crust: '#f0bb5e', crustDark: '#c98534', paste: '#8c4a2c', yolk: '#ffb631',
  };
  TH.RABBIT_COLORS = C;

  const DEF = {
    sx: 1, sy: 1, lean: 0, flip: 1,
    earL: 0, earR: 0, flopL: 0.1, flopR: 0.95, earSplay: 0,
    eyes: 'dot', look: [0, 0], blink: 0,
    mouth: 'w', talk: 0, cheeks: 0, blush: 0.6, drool: 0, sweat: 0,
    arms: 'down', chunk: null, brows: null, tear: 0,
  };

  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

  // Ear outline built by offsetting a centreline whose upper part bends by `flop`.
  function earPoints(bx, by, ang, len, wid, flop) {
    const N = 12, pts = [];
    let x = bx, y = by;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const a = ang + flop * smooth(0.35, 1, s);
      pts.push([x, y, a, s]);
      x += Math.sin(a) * (len / N);
      y -= Math.cos(a) * (len / N);
    }
    const L = [], Rr = [];
    for (const [px, py, a, s] of pts) {
      const w = wid * 0.5 * Math.pow(Math.max(0, Math.sin(Math.PI * (0.1 + 0.9 * s))), 0.5);
      const nx = Math.cos(a), ny = Math.sin(a);
      L.push([px - nx * w, py - ny * w]);
      Rr.push([px + nx * w, py + ny * w]);
    }
    return L.concat(Rr.reverse());
  }

  function drawEar(ctx, bx, by, ang, len, wid, flop) {
    smoothClosed(ctx, earPoints(bx, by, ang, len, wid, flop), 0.9);
    fo(ctx, C.fur, OUT, 7);
    smoothClosed(ctx, earPoints(bx, by - 18, ang, len * 0.8, wid * 0.46, flop * 1.05), 0.9);
    fo(ctx, C.earIn, null);
  }

  function bodyPath(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(w * 0.78, 0, w * 1.03, -h * 0.1, w * 1.0, -h * 0.42);
    ctx.bezierCurveTo(w * 0.97, -h * 0.8, w * 0.6, -h * 1.0, 0, -h);
    ctx.bezierCurveTo(-w * 0.6, -h * 1.0, -w * 0.97, -h * 0.8, -w * 1.0, -h * 0.42);
    ctx.bezierCurveTo(-w * 1.03, -h * 0.1, -w * 0.78, 0, 0, 0);
    ctx.closePath();
  }

  function paw(ctx, x, y, r = 19, rot = 0) {
    ell(ctx, x, y, r * 1.1, r * 0.9, rot);
    fo(ctx, C.fur, OUT, 6);
    ctx.fillStyle = 'rgba(255,170,190,0.55)';
    ell(ctx, x, y + r * 0.2, r * 0.42, r * 0.3, rot);
    ctx.fill();
  }

  // Mooncake chunk (a bitten wedge) — used in the paws or mouth.
  function chunk(ctx, x, y, s = 1, rot = 0) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(-34, 16);
    ctx.quadraticCurveTo(-40, -22, -6, -34);
    ctx.quadraticCurveTo(30, -30, 38, 8);
    ctx.quadraticCurveTo(26, 4, 22, 16);
    ctx.quadraticCurveTo(10, 8, 2, 20);
    ctx.quadraticCurveTo(-14, 12, -34, 16);
    ctx.closePath();
    fo(ctx, C.crust, OUT, 5);
    ctx.beginPath();
    ctx.moveTo(-26, 12); ctx.quadraticCurveTo(-28, -12, -4, -20);
    ctx.quadraticCurveTo(22, -18, 28, 6);
    ctx.quadraticCurveTo(18, 2, 16, 10); ctx.quadraticCurveTo(6, 4, 0, 14);
    ctx.quadraticCurveTo(-12, 8, -26, 12); ctx.closePath();
    fo(ctx, C.paste, null);
    ell(ctx, 2, -4, 11, 9); fo(ctx, C.yolk, null);
    ctx.restore();
  }
  TH.drawChunk = chunk;

  function eyes(ctx, p, w, h) {
    const ey = -h * 0.555, ex = w * 0.37;
    const [lx, ly] = p.look;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const x = side * ex, y = ey;
      ctx.save();
      switch (p.eyes) {
        case 'sparkle': {
          const g = ctx.createLinearGradient(0, y - 22, 0, y + 22);
          g.addColorStop(0, '#1d1230'); g.addColorStop(1, '#6b3f8e');
          ell(ctx, x + lx, y + ly, 19, 22); fo(ctx, g, null);
          ctx.fillStyle = '#fff';
          ell(ctx, x + lx - 6, y + ly - 8, 7, 7); ctx.fill();
          ell(ctx, x + lx + 6, y + ly + 8, 3.5, 3.5); ctx.fill();
          star4(ctx, x + lx + 7, y + ly - 9, 7, 0.3); ctx.fill();
          break;
        }
        case 'happy':
          ctx.beginPath(); ctx.arc(x, y + 8, 13, Math.PI * 1.12, Math.PI * 1.88);
          ctx.strokeStyle = C.eye; ctx.lineWidth = 6.5; ctx.stroke();
          break;
        case 'closed':
          ctx.beginPath(); ctx.arc(x, y - 6, 12, Math.PI * 0.15, Math.PI * 0.85);
          ctx.strokeStyle = C.eye; ctx.lineWidth = 6; ctx.stroke();
          break;
        case 'squeeze':
          ctx.beginPath();
          ctx.moveTo(x - side * 11, y - 11); ctx.lineTo(x + side * 8, y); ctx.lineTo(x - side * 11, y + 11);
          ctx.strokeStyle = C.eye; ctx.lineWidth = 6.5; ctx.lineJoin = 'round'; ctx.stroke();
          break;
        case 'shock':
          ell(ctx, x, y, 21, 24); fo(ctx, '#fff', OUT, 5);
          ell(ctx, x + lx * 0.5, y + ly * 0.5, 4.5, 4.5); fo(ctx, C.eye, null);
          break;
        case 'side': {
          ctx.beginPath();
          ctx.ellipse(x + lx, y + 3 + ly, 11, 13, 0, 0, Math.PI);
          ctx.closePath(); fo(ctx, C.eye, null);
          ctx.beginPath(); ctx.moveTo(x - 15, y + 2); ctx.lineTo(x + 15, y + 2);
          ctx.strokeStyle = C.eye; ctx.lineWidth = 5.5; ctx.stroke();
          ctx.fillStyle = '#fff'; ell(ctx, x + lx - 4, y + 6 + ly, 3, 3); ctx.fill();
          break;
        }
        default: { // dot
          const bh = 16 * (1 - clamp(p.blink) * 0.9);
          ell(ctx, x + lx, y + ly, 12, bh); fo(ctx, C.eye, null);
          if (p.blink < 0.5) {
            ctx.fillStyle = '#fff';
            ell(ctx, x + lx - 4, y + ly - 6, 4.8, 4.8); ctx.fill();
            ell(ctx, x + lx + 4, y + ly + 6, 2, 2); ctx.fill();
          }
        }
      }
      if (p.tear > 0 && (p.eyes === 'sparkle' || p.eyes === 'dot')) {
        ctx.fillStyle = 'rgba(150,215,255,0.85)';
        ell(ctx, x + lx, y + ly + 14, 17, 7 * p.tear); ctx.fill();
      }
      ctx.restore();
    }
    const brows = p.brows || (p.eyes === 'determined' ? 'mad' : null);
    if (brows) {
      ctx.strokeStyle = C.eye; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const x = side * ex, y = ey - 30;
        ctx.beginPath();
        if (brows === 'mad') { ctx.moveTo(x + side * 16, y - 7); ctx.lineTo(x - side * 12, y + 5); }
        else { ctx.moveTo(x + side * 16, y + 5); ctx.lineTo(x - side * 12, y - 6); }
        ctx.stroke();
      }
    }
  }

  function mouth(ctx, p, w, h) {
    const y = -h * 0.41;
    ctx.save();
    ctx.translate(0, y);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = 5;
    // tiny nose
    ctx.beginPath(); ctx.moveTo(-6, -13); ctx.quadraticCurveTo(0, -17, 6, -13); ctx.quadraticCurveTo(0, -5, -6, -13);
    ctx.fillStyle = C.nose; ctx.fill();
    const talk = clamp(p.talk);
    const omega = () => {
      ctx.beginPath(); ctx.moveTo(-14, -4); ctx.quadraticCurveTo(-7, 7, 0, -2); ctx.quadraticCurveTo(7, 7, 14, -4); ctx.stroke();
    };
    switch (p.mouth) {
      case 'open': {
        ell(ctx, 0, 6 + 4 * talk, 9 + 4 * talk, 5 + 11 * talk); fo(ctx, C.mouth, OUT, 4.5);
        ell(ctx, 0, 10 + 8 * talk, 6 + 2 * talk, 2 + 4 * talk); fo(ctx, C.tongue, null);
        break;
      }
      case 'chomp': {
        ctx.beginPath(); ctx.moveTo(-34, -2); ctx.quadraticCurveTo(0, -12, 34, -2);
        ctx.quadraticCurveTo(38, 52, 0, 58); ctx.quadraticCurveTo(-38, 52, -34, -2); ctx.closePath();
        fo(ctx, C.mouth, OUT, 5);
        ell(ctx, 0, 44, 18, 9); fo(ctx, C.tongue, null);
        ctx.beginPath(); ctx.rect(-13, -6, 12, 17); fo(ctx, '#fff', OUT, 3.5);
        ctx.beginPath(); ctx.rect(1, -6, 12, 17); fo(ctx, '#fff', OUT, 3.5);
        break;
      }
      case 'o':
        ell(ctx, 0, 7, 8, 10); fo(ctx, C.mouth, OUT, 4.5);
        break;
      case 'munch': {
        const k = Math.sin(p.chew || 0);
        ctx.beginPath(); ctx.moveTo(-10, 3 + k * 2); ctx.quadraticCurveTo(-4, -2, 0, 3); ctx.quadraticCurveTo(5, 8 - k * 2, 10, 2); ctx.stroke();
        break;
      }
      case 'wavy':
        ctx.beginPath(); ctx.moveTo(-16, 4);
        for (let i = 1; i <= 4; i++) ctx.lineTo(-16 + i * 8, i % 2 ? -2 : 4);
        ctx.stroke();
        break;
      case 'grin': {
        ctx.beginPath(); ctx.moveTo(-20, -2); ctx.quadraticCurveTo(0, 2, 20, -2); ctx.quadraticCurveTo(16, 26, 0, 27); ctx.quadraticCurveTo(-16, 26, -20, -2);
        ctx.closePath(); fo(ctx, C.mouth, OUT, 4.5);
        ell(ctx, 0, 19, 9, 5); fo(ctx, C.tongue, null);
        break;
      }
      case 'flat':
        ctx.beginPath(); ctx.moveTo(-10, 2); ctx.lineTo(10, 2); ctx.stroke();
        break;
      default:
        omega();
        if (talk > 0.15) { ell(ctx, 0, 8, 6, 7 * talk); fo(ctx, C.mouth, OUT, 3.5); }
    }
    if (p.drool > 0) {
      const L = 16 + 58 * p.drool, x = 12;
      ctx.beginPath();
      ctx.moveTo(x - 4, 1);
      ctx.quadraticCurveTo(x - 6, L * 0.55, x - 9, L - 9);
      ctx.arc(x, L - 9, 9, Math.PI, 0, true);
      ctx.quadraticCurveTo(x + 5, L * 0.55, x + 4, 1);
      ctx.closePath();
      fo(ctx, C.drool, '#5d95c4', 3);
      ctx.fillStyle = '#fff'; ell(ctx, x - 3, L - 12, 2.5, 3.5); ctx.fill();
    }
    ctx.restore();
  }

  function arms(ctx, p, w, h) {
    const a = p.arms;
    if (a === 'behind' || a === 'none') return;
    const L = (x, y, r, rot) => paw(ctx, x, y, r, rot);
    switch (a) {
      case 'belly': L(-w * 0.28, -h * 0.2, 20, 0.3); L(w * 0.24, -h * 0.26, 20, -0.3); break;
      case 'salute':
        L(-w * 0.62, -h * 0.2, 19, 0.2);
        ctx.strokeStyle = OUT; ctx.lineWidth = 6;
        L(w * 0.78, -h * 0.72, 20, -0.9);
        break;
      case 'up': L(-w * 1.02, -h * 0.72, 20, 0.6); L(w * 1.02, -h * 0.72, 20, -0.6); break;
      case 'chest': L(-w * 0.62, -h * 0.2, 19, 0.2); L(w * 0.05, -h * 0.28, 21, -0.2); break;
      case 'mouth': L(-w * 0.3, -h * 0.3, 20, 0.5); L(w * 0.3, -h * 0.3, 20, -0.5); break;
      case 'hold':
        chunk(ctx, 0, -h * 0.27, 1.55, -0.1);
        L(-w * 0.34, -h * 0.22, 20, 0.5); L(w * 0.34, -h * 0.22, 20, -0.5);
        break;
      case 'tiptoe': L(-w * 0.5, -h * 0.34, 19, 0.6); L(w * 0.46, -h * 0.4, 19, -0.6); break;
      default: L(-w * 0.62, -h * 0.2, 19, 0.2); L(w * 0.62, -h * 0.2, 19, -0.2);
    }
  }

  function drawRabbit(ctx, pose) {
    const p = Object.assign({}, DEF, pose);
    const w = 125 * p.sx, h = 232 * p.sy;
    ctx.save();
    ctx.rotate(p.lean);
    if (p.flip < 0) ctx.scale(-1, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // soft ground shadow is drawn by the scene; tail peeks out on the right
    ell(ctx, w * 0.93, -h * 0.2, 30, 27); fo(ctx, C.fur, OUT, 6);

    // ears (behind head)
    const splay = p.earSplay + (1 - p.sy) * 0.9;
    const elen = 172 * Math.sqrt(p.sy);
    drawEar(ctx, -w * 0.36, -h * 0.88, -0.2 - splay + p.earL, elen, 66, -p.flopL);
    drawEar(ctx, w * 0.36, -h * 0.88, 0.2 + splay + p.earR, elen, 66, p.flopR);
    // bow on the left ear
    ctx.save();
    ctx.translate(-w * 0.36 + Math.sin(-0.2 - splay + p.earL) * 26, -h * 0.88 - 22);
    ctx.rotate(-0.25);
    ell(ctx, -20, 0, 20, 12, 0.35); fo(ctx, C.bow, OUT, 5);
    ell(ctx, 20, 0, 20, 12, -0.35); fo(ctx, C.bow, OUT, 5);
    ell(ctx, 0, 0, 9, 9); fo(ctx, '#ff6b7f', OUT, 5);
    ctx.restore();

    // body silhouette: stroke all parts wide, then fill — gives a single merged outline
    const ck = clamp(p.cheeks);
    const shapes = [];
    shapes.push(() => bodyPath(ctx, w, h));
    shapes.push(() => ell(ctx, -w * 0.46, -6, 40, 22));
    shapes.push(() => ell(ctx, w * 0.46, -6, 40, 22));
    if (ck > 0) {
      shapes.push(() => ell(ctx, -w * (0.72 + 0.12 * ck), -h * 0.37, 30 + 34 * ck, 28 + 28 * ck));
      shapes.push(() => ell(ctx, w * (0.72 + 0.12 * ck), -h * 0.37, 30 + 34 * ck, 28 + 28 * ck));
    }
    ctx.strokeStyle = OUT; ctx.lineWidth = 14;
    for (const s of shapes) { s(); ctx.stroke(); }
    ctx.fillStyle = C.fur;
    for (const s of shapes) { s(); ctx.fill(); }

    // shading
    ctx.save();
    bodyPath(ctx, w, h); ctx.clip();
    const g = ctx.createRadialGradient(-w * 0.3, -h * 0.75, h * 0.15, 0, -h * 0.35, h * 0.95);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(230,221,243,0)');
    g.addColorStop(1, 'rgba(214,200,236,0.9)');
    ctx.fillStyle = g; ctx.fillRect(-w * 1.3, -h * 1.1, w * 2.6, h * 1.2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ell(ctx, -w * 0.45, -h * 0.8, 20, 11, -0.6); ctx.fill();
    ctx.restore();
    // feet toes
    ctx.strokeStyle = OUT; ctx.lineWidth = 4;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * w * 0.46 - 8, -4); ctx.lineTo(s * w * 0.46 - 8, -14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * w * 0.46 + 8, -4); ctx.lineTo(s * w * 0.46 + 8, -14); ctx.stroke();
    }
    // head tuft
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-6, -h + 2); ctx.quadraticCurveTo(-4, -h - 22, 10, -h - 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -h + 2); ctx.quadraticCurveTo(12, -h - 12, 22, -h - 12); ctx.stroke();

    // blush (moves onto puffed cheeks)
    const bx = w * (0.62 + 0.2 * ck), by = -h * (0.42 - 0.04 * ck);
    ctx.fillStyle = C.blush;
    ctx.globalAlpha = 0.55 + 0.45 * clamp(p.blush);
    ell(ctx, -bx, by, 25 + 10 * ck, 14 + 6 * ck); ctx.fill();
    ell(ctx, bx, by, 25 + 10 * ck, 14 + 6 * ck); ctx.fill();
    ctx.globalAlpha = 1;
    if (p.blush > 0.8) {
      ctx.strokeStyle = 'rgba(230,80,110,0.7)'; ctx.lineWidth = 3;
      for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(s * bx + i * 10 - 4, by + 6); ctx.lineTo(s * bx + i * 10 + 4, by - 6); ctx.stroke();
      }
    }

    eyes(ctx, p, w, h);
    mouth(ctx, p, w, h);
    if (p.chunk === 'mouth') chunk(ctx, 0, -h * 0.34, 0.9, 0.15);
    arms(ctx, p, w, h);

    if (p.sweat > 0) {
      const s = p.sweat;
      ctx.save(); ctx.translate(w * 0.86, -h * 0.84); ctx.scale(s, s);
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(15, -2, 12, 6); ctx.arc(0, 6, 12, 0, Math.PI); ctx.quadraticCurveTo(-15, -2, 0, -26);
      fo(ctx, '#a9dcff', '#3f7fb5', 4);
      ctx.fillStyle = '#fff'; ell(ctx, -4, 4, 3, 5); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Curled-up 团团 plugging the hole in the moon. r ≈ body radius; face looks at the viewer.
  function drawRabbitBall(ctx, pose) {
    const p = Object.assign({ r: 80, eyes: 'happy', mouth: 'w', talk: 0, cheeks: 0.3, look: [0, 0], wiggle: 0, blink: 0, tear: 0 }, pose);
    const r = p.r;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // folded ears lying along the top
    ctx.save(); ctx.rotate(p.wiggle * 0.2);
    ell(ctx, -r * 0.55, -r * 0.78, r * 0.62, r * 0.24, -0.35); fo(ctx, C.fur, OUT, 6);
    ell(ctx, -r * 0.55, -r * 0.8, r * 0.44, r * 0.1, -0.35); fo(ctx, C.earIn, null);
    ell(ctx, r * 0.5, -r * 0.8, r * 0.6, r * 0.23, 0.45 + p.wiggle * 0.3); fo(ctx, C.fur, OUT, 6);
    ell(ctx, r * 0.5, -r * 0.82, r * 0.42, r * 0.09, 0.45 + p.wiggle * 0.3); fo(ctx, C.earIn, null);
    ctx.restore();
    ell(ctx, 0, 0, r * 1.02, r * 0.95); fo(ctx, C.fur, OUT, 7);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r * 1.05);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(214,200,236,0.8)');
    ell(ctx, 0, 0, r * 1.0, r * 0.93); fo(ctx, g, null);
    // face (scaled rabbit features)
    const k = r / 118;
    ctx.save(); ctx.scale(k, k); ctx.translate(0, 120);
    const fake = Object.assign({}, DEF, { eyes: p.eyes, mouth: p.mouth, talk: p.talk, look: p.look, blink: p.blink, tear: p.tear, blush: 0.9 });
    const w = 125, h = 232;
    ctx.fillStyle = C.blush;
    ell(ctx, -w * 0.62, -h * 0.42, 26, 15); ctx.fill();
    ell(ctx, w * 0.62, -h * 0.42, 26, 15); ctx.fill();
    eyes(ctx, fake, w, h);
    mouth(ctx, fake, w, h);
    ctx.restore();
    // paws tucked at the bottom
    paw(ctx, -r * 0.42, r * 0.72, 17, 0.3);
    paw(ctx, r * 0.42, r * 0.72, 17, -0.3);
    ctx.restore();
  }

  TH.drawRabbit = drawRabbit;
  TH.drawRabbitBall = drawRabbitBall;
  TH.RABBIT_H = 232;
})();

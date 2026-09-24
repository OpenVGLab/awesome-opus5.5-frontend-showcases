// 豆豆 (the kid on Earth) and 天狗 (teaser cameo). Both draw with the feet at (0, 0).
(function () {
  'use strict';
  const TH = window.TH;
  const { clamp, TAU, fo, ell, OUT, star4 } = TH;

  // ---------------------------------------------------------------- 豆豆
  const K = {
    skin: '#ffe2c8', hair: '#2a2130', jacket: '#e2433a', jacketDark: '#b82e2a', trim: '#f6c453',
    pants: '#34407c', shoe: '#2a2130', blush: 'rgba(255,110,120,0.45)', mouth: '#8e2233',
  };

  function limb(ctx, x0, y0, x1, y1, w, col) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 12;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  function rabbitLantern(ctx, x, y, swing, t) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(swing);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 34); ctx.stroke();
    ctx.translate(0, 70);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 150);
    g.addColorStop(0, 'rgba(255,200,120,0.55)'); g.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = g; ctx.fillRect(-150, -150, 300, 300);
    // ears
    ell(ctx, 26, -46, 10, 26, 0.35); fo(ctx, '#fff4ea', OUT, 4);
    ell(ctx, 42, -40, 10, 24, 0.7); fo(ctx, '#fff4ea', OUT, 4);
    ell(ctx, 26, -46, 4, 16, 0.35); fo(ctx, '#ff6b7f', null);
    // body
    ell(ctx, 0, 0, 56, 36); fo(ctx, '#fff4ea', OUT, 5);
    const ig = ctx.createRadialGradient(-6, 4, 4, 0, 0, 52);
    ig.addColorStop(0, 'rgba(255,214,120,0.95)'); ig.addColorStop(1, 'rgba(255,214,120,0)');
    ell(ctx, 0, 0, 52, 32); fo(ctx, ig, null);
    ctx.strokeStyle = '#e2433a'; ctx.lineWidth = 5;
    for (const k of [-24, 0, 24]) { ctx.beginPath(); ctx.moveTo(k - 6, -32); ctx.quadraticCurveTo(k + 4, 0, k - 6, 32); ctx.stroke(); }
    ell(ctx, 40, -8, 5, 5); fo(ctx, '#e2433a', null);
    ell(ctx, -58, -4, 10, 10); fo(ctx, '#fff4ea', OUT, 4);
    ctx.restore();
  }

  function drawKid(ctx, pose) {
    const p = Object.assign({ eyes: 'open', mouth: 'o', talk: 0, arm: 'point', look: [6, -6], swing: 0, time: 0, sx: 1, sy: 1, blush: 0.6 }, pose);
    ctx.save();
    ctx.scale(p.sx, p.sy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // lantern arm (behind body)
    limb(ctx, -54, -196, -104, -126, 40, K.jacket);
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-100, -118); ctx.lineTo(-196, -292); ctx.stroke();
    ell(ctx, -104, -124, 18, 17); fo(ctx, K.skin, OUT, 5);
    rabbitLantern(ctx, -196, -292, p.swing, p.time);
    // legs & shoes
    TH.rrect(ctx, -50, -84, 100, 64, 18); fo(ctx, K.pants, OUT, 6);
    ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, -22); ctx.stroke();
    ell(ctx, -28, -14, 30, 15); fo(ctx, K.shoe, OUT, 5);
    ell(ctx, 28, -14, 30, 15); fo(ctx, K.shoe, OUT, 5);
    // jacket
    ctx.beginPath();
    ctx.moveTo(-40, -224); ctx.quadraticCurveTo(-72, -218, -74, -180);
    ctx.lineTo(-84, -76); ctx.quadraticCurveTo(0, -60, 84, -76); ctx.lineTo(74, -180);
    ctx.quadraticCurveTo(72, -218, 40, -224); ctx.closePath();
    const jg = ctx.createLinearGradient(0, -224, 0, -70);
    jg.addColorStop(0, K.jacket); jg.addColorStop(1, K.jacketDark);
    fo(ctx, jg, OUT, 6);
    ctx.strokeStyle = K.trim; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, -222); ctx.lineTo(0, -70); ctx.stroke();
    for (const y of [-196, -160, -124]) {
      ctx.strokeStyle = K.trim; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-16, y); ctx.lineTo(16, y); ctx.stroke();
      ell(ctx, -18, y, 5, 5); fo(ctx, K.trim, null); ell(ctx, 18, y, 5, 5); fo(ctx, K.trim, null);
    }
    TH.rrect(ctx, -34, -236, 68, 20, 8); fo(ctx, K.trim, OUT, 5);
    // pointing / cheering arm
    let hand;
    if (p.arm === 'cheer') {
      limb(ctx, 54, -196, 118, -310, 40, K.jacket);
      hand = [124, -322];
      ell(ctx, hand[0], hand[1], 18, 17); fo(ctx, K.skin, OUT, 5);
    } else if (p.arm === 'down') {
      limb(ctx, 54, -196, 90, -120, 40, K.jacket);
      ell(ctx, 94, -114, 18, 17); fo(ctx, K.skin, OUT, 5);
    } else {
      limb(ctx, 54, -196, 140, -318, 40, K.jacket);
      hand = [148, -330];
      ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(Math.atan2(-122, 86));
      TH.rrect(ctx, 8, -7, 34, 14, 7); fo(ctx, K.skin, OUT, 4.5);
      ell(ctx, 0, 0, 18, 17); fo(ctx, K.skin, OUT, 5);
      ctx.restore();
    }
    // head
    const hy = -330;
    ell(ctx, -104, hy + 10, 18, 20); fo(ctx, K.skin, OUT, 5);
    ell(ctx, 104, hy + 10, 18, 20); fo(ctx, K.skin, OUT, 5);
    ell(ctx, 0, hy, 108, 100); fo(ctx, K.skin, OUT, 6);
    // hair: bowl cut + cowlick
    ctx.beginPath();
    ctx.moveTo(-110, hy + 4);
    ctx.bezierCurveTo(-118, hy - 96, 118, hy - 96, 110, hy + 4);
    ctx.lineTo(96, hy - 20); ctx.lineTo(74, hy - 34); ctx.lineTo(50, hy - 22); ctx.lineTo(24, hy - 38);
    ctx.lineTo(-4, hy - 24); ctx.lineTo(-30, hy - 40); ctx.lineTo(-56, hy - 24); ctx.lineTo(-80, hy - 36); ctx.lineTo(-98, hy - 16);
    ctx.closePath(); fo(ctx, K.hair, OUT, 6);
    ctx.strokeStyle = '#5b4a70'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, hy - 10, 80, Math.PI * 1.25, Math.PI * 1.45); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(4, hy - 96); ctx.quadraticCurveTo(10, hy - 132, 36, hy - 126); ctx.quadraticCurveTo(48, hy - 110, 30, hy - 108); ctx.stroke();
    // face
    const ey = hy + 18;
    for (const s of [-1, 1]) {
      const x = s * 40 + p.look[0] * 0.5, y = ey + p.look[1] * 0.5;
      if (p.eyes === 'sparkle') {
        ell(ctx, x, y, 19, 22); fo(ctx, '#2a1c33', null);
        ctx.fillStyle = '#fff'; star4(ctx, x - 5, y - 7, 10, 0.3); ctx.fill();
        ell(ctx, x + 6, y + 8, 3.5, 3.5); ctx.fill();
      } else if (p.eyes === 'shock') {
        ell(ctx, x, y, 19, 22); fo(ctx, '#fff', OUT, 5);
        ell(ctx, x + p.look[0] * 0.4, y + p.look[1] * 0.4, 4.5, 4.5); fo(ctx, OUT, null);
      } else if (p.eyes === 'happy') {
        ctx.strokeStyle = OUT; ctx.lineWidth = 6.5;
        ctx.beginPath(); ctx.arc(x, y + 8, 13, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      } else {
        ell(ctx, x + p.look[0] * 0.4, y + p.look[1] * 0.4, 14, 18); fo(ctx, '#2a1c33', null);
        ctx.fillStyle = '#fff'; ell(ctx, x + p.look[0] * 0.4 - 4, y + p.look[1] * 0.4 - 6, 5, 5); ctx.fill();
      }
    }
    for (const s of [-1, 1]) {
      const up = p.eyes === 'shock' || p.eyes === 'sparkle' ? 12 : 0;
      const brow = () => { ctx.beginPath(); ctx.moveTo(s * 24, ey - 36 - up * 0.6); ctx.quadraticCurveTo(s * 40, ey - 46 - up, s * 56, ey - 38 - up * 0.4); };
      brow(); ctx.strokeStyle = K.skin; ctx.lineWidth = 13; ctx.stroke();
      brow(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
    }
    ctx.fillStyle = K.blush;
    ell(ctx, -70, ey + 32, 18, 11); ctx.fill(); ell(ctx, 70, ey + 32, 18, 11); ctx.fill();
    const my = ey + 50, talk = clamp(p.talk);
    if (p.mouth === 'grin') {
      ctx.beginPath(); ctx.moveTo(-22, my - 6); ctx.quadraticCurveTo(0, my, 22, my - 6); ctx.quadraticCurveTo(18, my + 22, 0, my + 24); ctx.quadraticCurveTo(-18, my + 22, -22, my - 6);
      fo(ctx, K.mouth, OUT, 4.5);
      ell(ctx, 0, my + 15, 9, 5); fo(ctx, '#ff8a9e', null);
    } else {
      const oy = p.mouth === 'o' ? 1 : 0.35 + 0.65 * talk;
      ell(ctx, 0, my + 4, 12, 4 + 13 * oy); fo(ctx, K.mouth, OUT, 4.5);
      ell(ctx, 0, my + 4 + 8 * oy, 7, 3 + 3 * oy); fo(ctx, '#ff8a9e', null);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- 天狗
  function drawDog(ctx, pose) {
    const p = Object.assign({ talk: 0, shake: 0, time: 0, sx: 1, sy: 1 }, pose);
    const navy = '#3a4274', cream = '#f5e8d2';
    ctx.save();
    ctx.scale(p.sx, p.sy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // wok on the back
    ctx.save(); ctx.translate(-6, -170); ctx.rotate(-0.28);
    ctx.beginPath(); ctx.ellipse(0, 0, 128, 104, 0, Math.PI * 0.98, Math.PI * 2.02); ctx.closePath();
    const wg = ctx.createLinearGradient(-120, -100, 120, 40);
    wg.addColorStop(0, '#6b6f7e'); wg.addColorStop(1, '#2b2d36');
    fo(ctx, wg, OUT, 6);
    ell(ctx, 0, 0, 128, 18); fo(ctx, '#8a8f9e', OUT, 5);
    TH.rrect(ctx, -212, -14, 90, 26, 12); fo(ctx, '#a0663a', OUT, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -50, -66, 30, 12, -0.4); ctx.fill();
    ctx.restore();
    // tail
    ctx.strokeStyle = OUT; ctx.lineWidth = 24;
    ctx.beginPath(); ctx.moveTo(70, -50); ctx.quadraticCurveTo(128, -70, 112, -120); ctx.stroke();
    ctx.strokeStyle = navy; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(70, -50); ctx.quadraticCurveTo(128, -70, 112, -120); ctx.stroke();
    // body
    ctx.beginPath();
    ctx.moveTo(-86, -6); ctx.bezierCurveTo(-96, -90, -60, -140, 0, -140); ctx.bezierCurveTo(60, -140, 96, -90, 86, -6);
    ctx.quadraticCurveTo(0, 6, -86, -6); ctx.closePath();
    fo(ctx, navy, OUT, 6);
    ell(ctx, 0, -52, 48, 40); fo(ctx, cream, null);
    // straps
    ctx.strokeStyle = OUT; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(-70, -118); ctx.lineTo(56, -40); ctx.stroke();
    ctx.strokeStyle = '#a0663a'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-70, -118); ctx.lineTo(56, -40); ctx.stroke();
    // feet & paws
    ell(ctx, -40, -8, 30, 16); fo(ctx, cream, OUT, 5);
    ell(ctx, 40, -8, 30, 16); fo(ctx, cream, OUT, 5);
    const wave = Math.sin(p.time * 14) * 0.35;
    ctx.save(); ctx.translate(92, -128); ctx.rotate(-0.4 + wave);
    ell(ctx, 0, -20, 20, 32); fo(ctx, navy, OUT, 5);
    ell(ctx, 0, -44, 20, 18); fo(ctx, cream, OUT, 5);
    ctx.restore();
    ell(ctx, -84, -70, 20, 26, 0.5); fo(ctx, navy, OUT, 5);
    // head
    ctx.save(); ctx.translate(0, -210); ctx.rotate(p.shake);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 64, -58); ctx.quadraticCurveTo(s * 124, -40, s * 108, 30); ctx.quadraticCurveTo(s * 80, 22, s * 70, -10); ctx.closePath();
      fo(ctx, '#252a4c', OUT, 5);
    }
    ell(ctx, 0, 0, 92, 84); fo(ctx, navy, OUT, 6);
    ell(ctx, 0, 34, 54, 38); fo(ctx, cream, OUT, 5);
    ell(ctx, 0, 12, 16, 11); fo(ctx, '#1b1d2e', null);
    ctx.fillStyle = '#fff'; ell(ctx, -5, 8, 5, 3); ctx.fill();
    for (const s of [-1, 1]) {
      ell(ctx, s * 38, -20, 18, 21); fo(ctx, '#fff', OUT, 4.5);
      ell(ctx, s * 34, -16, 8, 9); fo(ctx, '#1b1d2e', null);
      ctx.strokeStyle = OUT; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(s * 60, -52); ctx.lineTo(s * 18, -38); ctx.stroke();
    }
    const talk = clamp(p.talk);
    ctx.beginPath(); ctx.moveTo(-22, 36); ctx.quadraticCurveTo(0, 30, 22, 36); ctx.quadraticCurveTo(18, 50 + 22 * talk, 0, 54 + 24 * talk); ctx.quadraticCurveTo(-18, 50 + 22 * talk, -22, 36);
    fo(ctx, '#8e2233', OUT, 4.5);
    ctx.beginPath(); ctx.moveTo(10, 36); ctx.lineTo(16, 48); ctx.lineTo(20, 36); ctx.closePath(); fo(ctx, '#fff', null);
    ctx.fillStyle = 'rgba(255,110,120,0.45)'; ell(ctx, -58, 26, 14, 8); ctx.fill(); ell(ctx, 58, 26, 14, 8); ctx.fill();
    ctx.restore();
    // collar + bell
    TH.rrect(ctx, -60, -136, 120, 18, 9); fo(ctx, '#e2433a', OUT, 5);
    ell(ctx, 0, -114, 13, 13); fo(ctx, '#f6c453', OUT, 4.5);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -112); ctx.lineTo(0, -104); ctx.stroke();
    ctx.restore();
  }

  TH.drawKid = drawKid;
  TH.drawDog = drawDog;
  TH.drawRabbitLantern = rabbitLantern;
})();

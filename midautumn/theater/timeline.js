// 月宫小剧场 第1集《谁咬了月亮》 — the whole episode as a pure function of time: renderFrame(t).
(function () {
  'use strict';
  const TH = window.TH;
  const { clamp, lerp, seg, TAU, E, kf, pick, squash, talkFlap, fo, ell, OUT, font, mulberry32, noise1, rrect } = TH;
  const W = TH.W, H = TH.H;

  const DUR = 44.5;
  TH.DURATION = DUR;

  // Key story times (seconds). audio.js schedules its cues from these too.
  const T = (TH.T = {
    enterCE: 2.6, enterRB: 2.7,
    growl: 10.9, ceLeave: 13.3, sparkle: 14.0, lookL: 14.5, lookR: 14.8,
    squat: 16.5, leap: 16.85, chomp: 17.35, fall: 17.65, land: 18.1,
    cut1: 19.3, back1: 22.6, ceReturn: 22.7, glance: 24.4, snap: 24.9, shock: 25.0, rbClose: 26.5,
    pause: 28.6, crumb: 29.2, gulp: 29.75, laugh1: 29.95, panic: 30.2,
    squat2: 33.2, leap2: 33.5, curl: 33.8, plug: 34.1, cut2: 34.7, back2: 37.7, plea: 37.85, shout: 39.95, laugh2: 40.3,
    ending: 41.0, teaser: 42.6,
  });

  const MOON = (TH.MOON = { x: 590, y: 480, R: 240 });
  const CE0 = { x: 300, y: 1650 };
  const RB0 = { x: 770, y: 1645 };
  const BITE_PT = {
    x: MOON.x + Math.cos(TH.BITE_ANGLE) * MOON.R * 0.84,
    y: MOON.y + Math.sin(TH.BITE_ANGLE) * MOON.R * 0.84,
  };
  const RIM = { x: MOON.x + Math.cos(TH.BITE_ANGLE) * MOON.R, y: MOON.y + Math.sin(TH.BITE_ANGLE) * MOON.R };
  const HANG = { x: RIM.x + 26, y: RIM.y + 118 };

  // ------------------------------------------------------------------ dialogue
  // x, y: bubble centre in screen space. tail: world-space anchor (resolved through the camera).
  const B = (TH.BUBBLES = [
    { id: 'L1', who: 'change', t0: 3.5, t1: 6.25, lines: ['今晚中秋，', '全人类都在看月亮。'], x: 380, y: 826, anchor: 'ceHead' },
    { id: 'L2', who: 'change', t0: 6.35, t1: 8.75, lines: ['团团，看好它，', '一口都不许吃！'], x: 360, y: 826, anchor: 'ceHead' },
    { id: 'L3', who: 'rabbit', t0: 8.85, t1: 11.4, lines: ['放心！', '我对月饼毫无兴趣！'], x: 712, y: 1070, anchor: 'rbHead' },
    { id: 'L4', who: 'change', t0: 11.5, t1: 13.55, lines: ['注意形象！', '我去补个妆～'], x: 340, y: 826, anchor: 'ceHead' },
    { id: 'L5', who: 'rabbit', t0: 15.1, t1: 16.75, lines: ['就……一口！'], x: 560, y: 1040, style: 'whisper', cps: 9, anchor: 'rbHead' },
    { id: 'E1', who: 'kid', t0: 20.0, t1: 22.45, lines: ['妈妈快看！', '月亮缺了一口！'], x: 372, y: 1150, anchor: 'kidHead' },
    { id: 'L6', who: 'change', t0: 23.2, t1: 24.4, lines: ['我回来啦～'], x: 340, y: 870, anchor: 'ceHead' },
    { id: 'L7', who: 'change', t0: 25.05, t1: 26.5, lines: ['我的月亮！！！'], x: 540, y: 400, style: 'shout', size: 92, cps: 18, anchor: 'ceHead' },
    { id: 'L8', who: 'rabbit', t0: 26.62, t1: 28.6, lines: ['不是我！', '是……天狗！'], x: 440, y: 500, anchor: 'rbHead', cps: 12 },
    { id: 'L9', who: 'change', t0: 30.2, t1: 32.05, lines: ['全人类都在看！', '快补上！'], x: 360, y: 640, anchor: 'ceHead', cps: 17 },
    { id: 'L10', who: 'rabbit', t0: 32.1, t1: 33.3, lines: ['包在我身上！'], x: 740, y: 900, anchor: 'rbHead', cps: 16 },
    { id: 'E2', who: 'kid', t0: 34.9, t1: 37.55, lines: ['妈妈快看！', '月亮上有只兔子！'], x: 396, y: 1150, anchor: 'kidHead' },
    { id: 'L11', who: 'rabbit', t0: 37.85, t1: 39.9, lines: ['姐姐……', '明年就一口？'], x: 560, y: 1270, anchor: 'ball', cps: 12 },
    { id: 'L12', who: 'change', t0: 39.95, t1: 41.0, lines: ['想都别想！'], x: 540, y: 1500, style: 'shout', size: 96, cps: 16, anchor: 'offBL' },
    { id: 'D1', who: 'dog', t0: 43.0, t1: 44.7, lines: ['这锅我不背！'], x: 400, y: 1590, anchor: 'dogHead', cps: 14 },
  ]);
  B.forEach((b) => TH.revealTimes(b));

  function talking(who, t) {
    for (const b of B) {
      if (b.who !== who) continue;
      const s = b.t0 + 0.14;
      if (t >= s && t <= s + b._typeDur) return talkFlap(t);
    }
    return 0;
  }

  // ------------------------------------------------------------------ camera
  function camAt(t) {
    if (t < 13.9) return { x: 540, y: kf(t, [[3, 960], [13.9, 985]]), z: kf(t, [[3, 1], [13.9, 1.04]]) };
    if (t < 19.3) {
      return {
        x: kf(t, [[13.9, 540], [14.6, 640, 'ioC'], [16.8, 640], [17.2, 610, 'outQ'], [17.9, 610], [18.35, 680, 'ioQ']]),
        y: kf(t, [[13.9, 985], [14.6, 1000, 'ioC'], [16.8, 1000], [17.2, 930, 'outQ'], [17.9, 930], [18.35, 1110, 'ioQ']]),
        z: kf(t, [[13.9, 1.04], [14.6, 1.22, 'ioC'], [16.8, 1.22], [17.2, 1.08, 'outQ'], [17.9, 1.08], [18.35, 1.16, 'ioQ']]),
      };
    }
    if (t < 25.0) return { x: 540, y: 985, z: kf(t, [[22.6, 1.0], [24.9, 1.05]]) };
    if (t < 26.5) return { x: 300, y: 1185, z: kf(t, [[25.0, 1.35], [25.12, 1.95, 'outQ'], [26.5, 2.05]]) };
    if (t < 28.6) return { x: 770, y: 1420, z: kf(t, [[26.5, 1.6], [28.6, 1.75]]) };
    if (t < T.panic) return { x: 540, y: 1290, z: kf(t, [[28.6, 1.12], [T.panic, 1.2, 'lin']]) };
    if (t < 33.3) return { x: 540, y: kf(t, [[T.panic, 1150], [32.0, 1150], [33.3, 1100]]), z: 1.0 };
    if (t < 37.7) return { x: 570, y: kf(t, [[33.3, 1100], [34.0, 900, 'ioQ']]), z: kf(t, [[33.3, 1.0], [34.0, 0.98]]) };
    return { x: kf(t, [[37.7, 690], [T.ending, 700]]), y: 720, z: kf(t, [[37.7, 1.72], [T.ending, 1.82]]) };
  }

  function shakeAt(t) {
    let a = 0;
    const hit = (t0, dur, amp) => { const d = t - t0; if (d >= 0 && d < dur) a += amp * (1 - d / dur); };
    hit(T.chomp, 0.4, 22); hit(T.land, 0.25, 12); hit(T.shock, 0.5, 16); hit(T.shout, 0.55, 20); hit(T.plug, 0.25, 10);
    if (t > 25.05 && t < 26.4) a += 3;
    return { x: noise1(t * 40) * a, y: noise1(t * 40 + 77) * a };
  }

  function applyCam(ctx, c, sh) {
    ctx.translate(W / 2 + (sh ? sh.x : 0), H / 2 + (sh ? sh.y : 0));
    ctx.scale(c.z, c.z);
    ctx.translate(-c.x, -c.y);
  }
  const toScreen = (c, x, y) => [W / 2 + (x - c.x) * c.z, H / 2 + (y - c.y) * c.z];

  // ------------------------------------------------------------------ 嫦娥 track
  function changeState(t) {
    let x = CE0.x, vis = true, lean = 0;
    if (t < T.enterCE) vis = false;
    else if (t < 3.3) { x = kf(t, [[T.enterCE, -320], [3.3, CE0.x, 'outBack']]); lean = kf(t, [[T.enterCE, 0.25], [3.3, 0, 'outQ']]); }
    else if (t >= T.ceLeave && t < T.ceReturn) {
      x = kf(t, [[T.ceLeave, CE0.x], [13.8, -460, 'inBack']]); lean = -0.22 * seg(t, T.ceLeave, 13.6);
      if (t >= 13.8) vis = false;
    } else if (t >= T.ceReturn && t < 23.3) { x = kf(t, [[T.ceReturn, -460], [23.3, CE0.x, 'outBack']]); lean = kf(t, [[T.ceReturn, 0.25], [23.3, 0, 'outQ']]); }
    if (t >= T.back2 || (t >= T.rbClose && t < T.pause)) vis = false;
    const bob = Math.sin(t * 2.2) * 10;
    const p = { time: t, talk: talking('change', t), makeup: t >= T.ceReturn ? 1 : 0 };
    // expression / arm script
    if (t < 3.5) Object.assign(p, { eyes: 'closed', mouth: 'smile' });
    else if (t < 6.3) Object.assign(p, t < 4.3 ? { eyes: 'closed', mouth: 'smile' } : { eyes: 'open', look: [6, -10], armR: 'pointUp', mouth: 'smile' });
    else if (t < 8.8) Object.assign(p, { eyes: 'stern', look: [8, 0], armR: 'point', armL: 'hip', mouth: 'flat' });
    else if (t < 10.35) Object.assign(p, { eyes: 'open', look: [9, 2], armL: 'hip', armR: 'hip', mouth: 'smile' });
    else if (t < 11.5) Object.assign(p, { eyes: 'squint', look: [10, 0], armL: 'hip', armR: 'hip', mouth: 'flat' });
    else if (t < 12.35) Object.assign(p, { eyes: 'stern', look: [8, 0], armR: 'point', armL: 'hip', mouth: 'flat' });
    else if (t < T.ceReturn) Object.assign(p, { eyes: 'closed', armL: 'mirror', mirror: true, mouth: 'smile', blush: 1 });
    else if (t < T.glance) Object.assign(p, { eyes: 'closed', armR: 'wave', mouth: 'smile', blush: 1 });
    else if (t < 24.62) Object.assign(p, { eyes: 'open', look: [10, -12], mouth: 'smile' });
    else if (t < T.snap) Object.assign(p, { eyes: 'closed', mouth: 'smile' });
    else if (t < T.shock) Object.assign(p, { eyes: 'open', look: [12, -14], mouth: 'o', hairUp: 0.3 });
    else if (t < T.rbClose) Object.assign(p, { eyes: 'shock', pop: 0.6 + 0.4 * Math.abs(Math.sin(t * 9)), mouth: 'scream', armL: 'cover', armR: 'cover', hairUp: 1 });
    else if (t < T.pause) Object.assign(p, { eyes: 'shock', mouth: 'o', armL: 'cover', armR: 'cover', hairUp: 0.5 });
    else if (t < T.panic) Object.assign(p, { eyes: 'squint', look: [10, 0], mouth: 'flat', armL: 'hip', armR: 'hip', anger: seg(t, 28.8, 29.6) * 0.8 });
    else if (t < 32.0) Object.assign(p, { eyes: 'open', brows: 'worry', look: [6, -8], armL: 'up', armR: t < 31.3 ? 'up' : 'pointUp', sweat: 1 });
    else if (t < 33.3) Object.assign(p, { eyes: 'open', look: [10, -2], mouth: 'o', armL: 'fist', armR: 'fist', sweat: 0.7 });
    else if (t < T.plug) Object.assign(p, { eyes: 'open', look: [8, -14], mouth: 'o', armL: 'fist', armR: 'fist' });
    else Object.assign(p, { eyes: 'closed', mouth: 'smile', sweat: 0.7 });
    let sx = 1, sy = 1;
    if (t >= T.shock && t < T.shock + 0.6) { const s = squash(t, T.shock, -0.14, 0.6, 2.4); sx = s.sx; sy = s.sy; }
    if (t >= T.panic && t < 32.0) { lean = Math.sin(t * 22) * 0.04; }
    const q = squash(t, 3.3, 0.08, 0.5); sx *= q.sx; sy *= q.sy;
    const q2 = squash(t, 23.3, 0.08, 0.5); sx *= q2.sx; sy *= q2.sy;
    p.sx = sx; p.sy = sy; p.lean = lean;
    return { vis, x, y: CE0.y + bob, s: 1, pose: p };
  }

  // ------------------------------------------------------------------ 团团 track
  function rabbitState(t) {
    let x = RB0.x, y = RB0.y, vis = true, mode = 'stand';
    const p = { talk: talking('rabbit', t), arms: 'down', eyes: 'dot', mouth: 'w' };
    let sx = 1 + 0.015 * Math.sin(t * 3.1), sy = 1 - 0.015 * Math.sin(t * 3.1);
    const blinkAt = (t % 3.3);
    p.blink = blinkAt < 0.12 ? 1 - Math.abs(blinkAt - 0.06) / 0.06 : 0;
    if (t < T.enterRB) vis = false;
    else if (t < 3.4) {
      const hop = (a, b, x0, x1) => { const u = seg(t, a, b); x = lerp(x0, x1, u); y = RB0.y - Math.sin(Math.PI * u) * 130; };
      if (t < 3.05) hop(T.enterRB, 3.05, 1320, 1040); else hop(3.05, 3.4, 1040, RB0.x);
      sy = 1.12; sx = 0.9; p.eyes = 'happy';
    }
    const land = (t0, amt = 0.3) => { const s = squash(t, t0, amt, 0.5); sx *= s.sx; sy *= s.sy; };
    land(3.05, 0.25); land(3.4, 0.3);

    if (t >= 3.4 && t < 8.85) {
      if (t > 4.4 && t < 5.4) p.look = [0, -7];
      else p.look = [-6, 0];
      if (t > 7.9 && t < 8.3) land(7.9, 0.08);
    } else if (t >= 8.85 && t < 11.4) {
      if (t < 9.9) Object.assign(p, { eyes: 'determined', arms: 'salute', mouth: 'open' });
      else if (t < 10.3) Object.assign(p, { eyes: 'dot', look: [4, -8], arms: 'salute', mouth: 'open' });
      else Object.assign(p, { eyes: 'sparkle', look: [3, -6], arms: t < T.growl ? 'salute' : 'belly', mouth: 'w', drool: seg(t, 10.3, 11.0), blush: 1 });
      if (t < 9.9) { sy *= 1.05; sx *= 0.96; }
      if (t >= T.growl) { sx *= 1 + 0.04 * Math.sin((t - T.growl) * 40) * (1 - seg(t, T.growl, 11.5)); }
    } else if (t >= 11.4 && t < 13.9) {
      if (t < 11.75) Object.assign(p, { eyes: 'squeeze', mouth: 'wavy', drool: 1 - seg(t, 11.5, 11.75), arms: 'belly' });
      else Object.assign(p, { eyes: 'happy', arms: 'salute', mouth: 'w' });
      land(11.45, 0.18);
    } else if (t >= 13.9 && t < T.squat) {
      if (t < T.sparkle) Object.assign(p, { eyes: 'dot', look: [0, -6] });
      else if (t < T.lookL) Object.assign(p, { eyes: 'sparkle', look: [2, -7], earL: 0.12, earR: -0.12, blush: 1 });
      else if (t < T.lookR) Object.assign(p, { eyes: 'side', look: [-9, 0], lean: -0.07 });
      else if (t < 15.1) Object.assign(p, { eyes: 'side', look: [9, 0], lean: 0.07 });
      else Object.assign(p, { eyes: 'sparkle', look: [3, -6], arms: 'tiptoe', drool: 0.35, blush: 1, lean: Math.sin(t * 30) * 0.015 });
      if (t >= T.sparkle && t < T.sparkle + 0.4) land(T.sparkle, 0.12);
    } else if (t >= T.squat && t < T.leap) {
      const k = E.outQ(seg(t, T.squat, T.leap));
      sy *= 1 - 0.3 * k; sx *= 1 + 0.3 * k;
      Object.assign(p, { eyes: 'determined', earSplay: 0.4 * k, arms: 'tiptoe' });
    } else if (t >= T.leap && t < T.chomp) {
      const u = seg(t, T.leap, T.chomp);
      y = lerp(RB0.y, HANG.y, E.outQ(u)); x = lerp(RB0.x, HANG.x, u);
      sy *= lerp(1.35, 1.12, u); sx *= lerp(0.78, 0.9, u);
      Object.assign(p, { eyes: 'squeeze', mouth: 'chomp', arms: 'up', earL: 0.25, earR: -0.25 });
    } else if (t >= T.chomp && t < T.fall) {
      x = HANG.x; y = HANG.y;
      const s = squash(t, T.chomp, 0.22, 0.3, 3); sx *= s.sy; sy *= s.sx;
      Object.assign(p, { eyes: 'dot', blink: t > 17.52 && t < 17.58 ? 1 : 0, cheeks: 1, mouth: 'munch', chunk: 'mouth', arms: 'up' });
    } else if (t >= T.fall && t < T.land) {
      const u = seg(t, T.fall, T.land);
      x = lerp(HANG.x, RB0.x, u); y = lerp(HANG.y, RB0.y, E.inQ(u));
      sy *= 1.12; sx *= 0.92;
      Object.assign(p, { eyes: 'shock', cheeks: 1, mouth: 'munch', chunk: 'mouth', arms: 'up', earL: -0.4, earR: 0.4 });
    } else if ((t >= T.land && t < T.cut1) || (t >= T.back1 && t < T.snap)) {
      land(T.land, 0.36);
      Object.assign(p, { eyes: 'happy', cheeks: 1, mouth: 'munch', chew: t * 14, arms: 'hold', blush: 1 });
      sy *= 1 + 0.03 * Math.sin(t * 14); sx *= 1 - 0.03 * Math.sin(t * 14);
    } else if (t >= T.snap && t < T.rbClose) {
      Object.assign(p, { eyes: 'shock', cheeks: 1, mouth: 'munch', arms: t < 25.4 ? 'hold' : 'behind', sweat: seg(t, 25.3, 25.6) });
      land(T.shock, 0.15);
    } else if (t >= T.rbClose && t < T.pause) {
      Object.assign(p, { eyes: 'side', look: [9, 0], cheeks: 0.9, mouth: 'munch', chew: t * 10, arms: 'behind', sweat: 1 });
      if (t > 27.6) p.look = [-9, 0];
    } else if (t >= T.pause && t < T.panic) {
      if (t < T.gulp) Object.assign(p, { eyes: 'side', look: [-9, 0], cheeks: 0.9, mouth: 'munch', arms: 'behind', sweat: 1 });
      else if (t < T.gulp + 0.28) Object.assign(p, { eyes: 'shock', cheeks: 0, mouth: 'o', arms: 'behind', sweat: 1 });
      else Object.assign(p, { eyes: 'happy', mouth: 'w', arms: 'behind', blush: 1, sweat: 0.8 });
      land(T.gulp, 0.25);
    } else if (t >= T.panic && t < 32.05) {
      Object.assign(p, t < 31.4 ? { eyes: 'shock', mouth: 'o', sweat: 1, arms: 'down' } : { eyes: 'determined', mouth: 'w', arms: 'down' });
    } else if (t >= 32.05 && t < T.squat2) {
      Object.assign(p, { eyes: 'determined', mouth: 'grin', arms: 'chest' });
      sy *= 1.07; sx *= 0.95;
      land(32.05, 0.12);
    } else if (t >= T.squat2 && t < T.leap2) {
      const k = E.outQ(seg(t, T.squat2, T.leap2));
      sy *= 1 - 0.3 * k; sx *= 1 + 0.3 * k;
      Object.assign(p, { eyes: 'determined', mouth: 'grin', earSplay: 0.4 * k });
    } else if (t >= T.leap2 && t < T.plug) {
      const u = seg(t, T.leap2, T.plug);
      x = lerp(RB0.x, BITE_PT.x, u) + Math.sin(u * Math.PI) * 90;
      y = lerp(RB0.y, BITE_PT.y + 60, E.outQ(u)) - Math.sin(u * Math.PI) * 120;
      if (t >= T.curl) mode = 'ballFly';
      Object.assign(p, { eyes: 'squeeze', mouth: 'grin', arms: 'up' });
      sy *= 1.3; sx *= 0.8;
    } else if (t >= T.plug) {
      mode = 'plugged';
    }
    if (t >= T.cut1 && t < T.back1) vis = true;
    p.sx = sx; p.sy = sy;
    return { vis, x, y, mode, pose: p };
  }

  function ballPose(t) {
    if (t < T.back2) return { eyes: t < 34.6 ? 'squeeze' : 'happy', mouth: 'w', cheeks: 0.2 };
    if (t < T.plea) return { eyes: 'dot', look: [-7, 7], mouth: 'w' };
    if (t < T.shout) return { eyes: 'sparkle', look: [-5, 6], mouth: 'open', talk: talking('rabbit', t), tear: 0.6, wiggle: Math.sin(t * 8) };
    if (t < T.ending) return { eyes: 'squeeze', mouth: 'wavy' };
    return { eyes: 'happy', mouth: 'w', wiggle: Math.sin(t * 5) * 0.5 };
  }

  function plugK(t) {
    if (t < T.plug) return 0;
    const d = t - T.plug;
    return 1 + Math.exp(-d * 7) * Math.sin(d * 22) * 0.18;
  }

  // Tail anchors in world space.
  function anchor(name, t, cam) {
    const ce = changeState(t), rb = rabbitState(t);
    switch (name) {
      case 'ceHead': return toScreen(cam, ce.x + 40, ce.y - 664);
      case 'rbHead': return toScreen(cam, rb.x, rb.y - 400 * (rb.pose.sy || 1));
      case 'ball': return toScreen(cam, BITE_PT.x - 30, BITE_PT.y + 90);
      case 'kidHead': return [352, 1330];
      case 'offBL': return [60, 1900];
      case 'dogHead': return [760, 1640];
    }
    return null;
  }

  // ------------------------------------------------------------------ palace shots
  function shadow(ctx, x, y, w, k = 1) {
    ctx.fillStyle = `rgba(60,40,110,${0.28 * k})`;
    ell(ctx, x, y, w, w * 0.18); ctx.fill();
  }

  function drawChangEAt(ctx, t, st) {
    if (!st.vis) return;
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.scale(st.s, st.s);
    TH.drawChangE(ctx, st.pose);
    ctx.restore();
  }

  function drawRabbitAt(ctx, t, st) {
    if (!st.vis || st.mode === 'plugged') return;
    ctx.save();
    ctx.translate(st.x, st.y);
    if (st.mode === 'ballFly') {
      ctx.translate(0, -80);
      ctx.rotate((t - T.curl) * 18);
      TH.drawRabbitBall(ctx, { r: 76, eyes: 'squeeze', mouth: 'w' });
    } else TH.drawRabbit(ctx, st.pose);
    ctx.restore();
  }

  function drawPalace(ctx, t) {
    const cam = camAt(t);
    const sh = shakeAt(t);
    const shockShot = t >= T.shock && t < T.rbClose;
    const ce = changeState(t), rb = rabbitState(t);
    if (shockShot) {
      TH.burstBackdrop(ctx, W / 2, 900, t, 1, '#ffe3ee', '#e0457e');
    } else {
      TH.palaceSky(ctx, t, cam);
    }
    ctx.save();
    applyCam(ctx, cam, sh);
    if (!shockShot) {
      const spark = t >= T.sparkle && t < 15.4 ? E.outBack(seg(t, T.sparkle, T.sparkle + 0.3)) * (1 - seg(t, 15.0, 15.4))
        : t >= T.plug + 0.1 && t < 35.2 ? 1 - seg(t, 34.6, 35.2) : 0;
      TH.moon(ctx, MOON.x, MOON.y, MOON.R, { bite: t >= T.chomp, plug: plugK(t), sparkle: spark, t, ball: ballPose(t) });
      TH.palaceBackdrop(ctx, t);
      TH.terrace(ctx, t);
      TH.fallingPetals(ctx, t, 700, 1100, 800, 1700, 0.9);
      if (ce.vis) shadow(ctx, ce.x, CE0.y + 40, 110, 0.8);
      if (rb.vis && rb.mode !== 'plugged') {
        const hgt = clamp((RB0.y - rb.y) / 800);
        shadow(ctx, rb.x, RB0.y + 4, 120 * (1 - 0.6 * hgt), 1 - 0.7 * hgt);
      }
      // speed trail when 嫦娥 zips out / in
      if ((t > T.ceLeave && t < 13.85) || (t > T.ceReturn && t < 23.3)) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const yy = ce.y - 120 - i * 90;
          ctx.beginPath(); ctx.moveTo(ce.x + 160, yy); ctx.lineTo(ce.x + 420 + i * 30, yy); ctx.stroke();
        }
        ctx.restore();
      }
      TH.impactStar(ctx, RIM.x, RIM.y, 100, t, T.chomp, 0.35);
      TH.crumbs(ctx, RIM.x, RIM.y, t, T.chomp, 24, 5, 1.1, 1.3);
      drawChangEAt(ctx, t, ce);
      drawRabbitAt(ctx, t, rb);
      // dust puffs on landings
      for (const t0 of [T.land, 3.4]) {
        const d = t - t0;
        if (d > 0 && d < 0.5) {
          ctx.save(); ctx.globalAlpha = 1 - d / 0.5; ctx.fillStyle = '#fff';
          for (const s of [-1, 1]) { ell(ctx, rb.x + s * (100 + d * 220), RB0.y - 10 - d * 30, 34 * (1 - d), 22 * (1 - d)); ctx.fill(); }
          ctx.restore();
        }
      }
      // a single crumb falling from 团团's mouth during the awkward pause
      if (t > T.crumb && t < T.crumb + 0.5) {
        const d = t - T.crumb;
        ctx.save(); ctx.translate(rb.x + 40, rb.y - 90 + 0.5 * 2600 * d * d); ctx.rotate(d * 10);
        ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(3, -9); ctx.lineTo(9, 5); ctx.lineTo(-4, 8); ctx.closePath();
        fo(ctx, '#f0bb5e', OUT, 3); ctx.restore();
      }
      if (t >= 22.6 && t < T.snap) TH.blissFlowers(ctx, rb.x, rb.y - 330, t, 1);
      if (t >= T.land + 0.1 && t < T.cut1) TH.blissFlowers(ctx, rb.x, rb.y - 330, t, E.outBack(seg(t, T.land + 0.1, T.land + 0.4)));
      if (t >= 23.3 && t < T.glance) {
        for (let i = 0; i < 4; i++) TH.sparkle(ctx, ce.x + [-150, 150, -120, 170][i], ce.y - [620, 560, 420, 380][i], 26, t, i * 1.6);
      }
      if (t >= T.snap && t < T.snap + 0.25) TH.shockLines(ctx, ce.x, ce.y - 660, t, 1, 1.2);
      if (t >= T.shock && t < 26.3) TH.shockLines(ctx, rb.x, rb.y - 420, t, 1);
    } else {
      drawChangEAt(ctx, t, ce);
      TH.shockLines(ctx, ce.x, ce.y - 700, t, 1, 1.4);
    }
    ctx.restore();

    // --------------- screen-space lettering
    if (t >= T.chomp && t < T.chomp + 0.06) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 0, W, H); }
    const S = (x, y) => toScreen(cam, x, y);
    TH.sfxText(ctx, '咕噜噜～', ...S(905, 1500), 60, t, T.growl, 1.1, { wobble: 6, fill: '#ffe9f0', fill2: '#ff9fbd', rot: -0.08 });
    TH.sfxText(ctx, '嗖～', 190, 1180, 90, t, T.ceLeave + 0.1, 0.8, { rot: -0.15, fill: '#e8fbff', fill2: '#8fd6e2' });
    TH.sfxText(ctx, '布灵布灵', ...S(850, 220), 56, t, T.sparkle, 1.2, { rot: 0.1 });
    TH.sfxText(ctx, '嗷呜～', ...S(560, 1180), 76, t, T.leap, 0.6, { rot: -0.2, fill: '#ffffff', fill2: '#ffd1e0' });
    TH.sfxText(ctx, '咔嚓！', ...S(905, 380), 140, t, T.chomp, 1.25, { rot: 0.14, fill: '#fff27a', fill2: '#ff8a2e' });
    TH.sfxText(ctx, '咚！', ...S(930, 1560), 78, t, T.land, 0.6, { rot: 0.12, fill: '#ffffff', fill2: '#c9b8f0' });
    TH.sfxText(ctx, '？', ...S(CE0.x + 150, CE0.y - 700), 80, t, 24.62, 0.3, { rot: 0.15, fill: '#fff', fill2: '#f48fb1' });
    TH.sfxText(ctx, '唰', ...S(470, 1000), 84, t, T.snap, 0.35, { rot: -0.2, fill: '#ffffff', fill2: '#ffd1e0' });
    TH.sfxText(ctx, '唧——', 860, 420, 46, t, 28.75, 0.9, { fill: '#e6ffd9', fill2: '#8fd67a', noPop: true });
    TH.sfxText(ctx, '唧——', 200, 520, 40, t, 29.1, 0.8, { fill: '#e6ffd9', fill2: '#8fd67a', noPop: true });
    TH.sfxText(ctx, '啪嗒', ...S(rb.x + 120, rb.y + 10), 52, t, T.crumb + 0.35, 0.6, { rot: 0.1, fill: '#fff', fill2: '#f0bb5e' });
    TH.sfxText(ctx, '咕咚', ...S(rb.x + 150, rb.y - 330), 70, t, T.gulp, 0.75, { rot: -0.1, fill: '#fff', fill2: '#b3a1f2' });
    TH.sfxText(ctx, '嗖～', ...S(900, 1150), 90, t, T.leap2, 0.6, { rot: -0.3, fill: '#fff', fill2: '#b3a1f2' });
    TH.sfxText(ctx, '啵！', ...S(BITE_PT.x + 150, BITE_PT.y - 120), 118, t, T.plug, 0.9, { rot: 0.12 });
    TH.sfxText(ctx, '叮～', ...S(MOON.x - 250, MOON.y - 220), 64, t, T.plug + 0.35, 0.8, { rot: -0.1, fill: '#fff', fill2: '#ffe27a' });
    if (t >= 25.0 && t < 26.45) TH.sfxText(ctx, '！！', 900, 760, 120, t, 25.0, 1.45, { rot: 0.15, fill: '#fff', fill2: '#ff5a7a' });
    TH.sfxText(ctx, '？', ...S(rb.x + 130, rb.y - 420), 90, t, 31.35, 0.5, { rot: 0.2, fill: '#fff', fill2: '#b3a1f2' });
    // bubbles
    for (const b of B) {
      if (t < b.t0 || t > b.t1) continue;
      if (b.id === 'E1' || b.id === 'E2' || b.id === 'D1') continue;
      const tail = anchor(b.anchor, t, cam);
      TH.bubble(ctx, Object.assign(b, { tail }), t);
    }
  }

  // ------------------------------------------------------------------ Earth shots
  function kidState(t) {
    const p = { time: t, swing: Math.sin(t * 2.4) * 0.12, talk: talking('kid', t), look: [8, -9], arm: 'down', eyes: 'open', mouth: 'o' };
    let y = 1790, sx = 1, sy = 1;
    if (t < 22.6) {
      if (t < 19.75) Object.assign(p, { eyes: 'open', mouth: 'o', arm: 'down' });
      else Object.assign(p, { eyes: 'shock', mouth: p.talk > 0 ? 'open' : 'o', arm: 'point' });
      const d = t - 19.75; if (d > 0 && d < 0.4) y -= Math.sin((d / 0.4) * Math.PI) * 50;
      const s = squash(t, 20.15, 0.12, 0.4); sx = s.sx; sy = s.sy;
    } else {
      if (t < 34.9) Object.assign(p, { eyes: 'open', arm: 'down' });
      else if (t < 36.3) Object.assign(p, { eyes: 'sparkle', mouth: p.talk > 0 ? 'open' : 'grin', arm: 'point' });
      else Object.assign(p, { eyes: 'happy', mouth: 'grin', arm: 'cheer' });
      for (const j of [36.3, 36.85]) { const d = t - j; if (d > 0 && d < 0.4) y -= Math.sin((d / 0.4) * Math.PI) * 60; }
    }
    p.sx = sx; p.sy = sy;
    return { x: 300, y, pose: p };
  }

  function hotSearch(ctx, text, t, t0, t1) {
    if (t < t0 || t > t1) return;
    const a = E.outBack(seg(t, t0, t0 + 0.3)), d = seg(t, t1 - 0.2, t1);
    ctx.save();
    ctx.globalAlpha = 1 - d;
    ctx.translate(W / 2, lerp(60, 190, a));
    ctx.font = font(40);
    const tw = ctx.measureText(text).width;
    const w = tw + 230;
    rrect(ctx, -w / 2 + 6, -40 + 8, w, 84, 42); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    rrect(ctx, -w / 2, -40, w, 84, 42); fo(ctx, '#fffaf2', OUT, 5);
    rrect(ctx, -w / 2 + 14, -26, 96, 56, 28); fo(ctx, '#ff4d4f', null);
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = font(34); ctx.fillText('热搜', -w / 2 + 62, 2);
    ctx.textAlign = 'left'; ctx.fillStyle = '#2e2236'; ctx.font = font(40);
    ctx.fillText(text, -w / 2 + 124, 2);
    rrect(ctx, w / 2 - 76, -22, 56, 48, 12); fo(ctx, '#ff8a00', null);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = font(34); ctx.fillText('爆', w / 2 - 48, 2);
    ctx.restore();
  }

  function drawEarth(ctx, t) {
    const second = t >= T.cut2;
    TH.earth(ctx, t, { bite: true, plug: second ? 1 : 0, people: second });
    const k = kidState(t);
    ctx.save();
    ctx.fillStyle = 'rgba(20,10,20,0.3)'; ell(ctx, k.x, 1795, 120, 22); ctx.fill();
    ctx.translate(k.x, k.y); ctx.scale(1.05, 1.05);
    TH.drawKid(ctx, k.pose);
    ctx.restore();
    const t0 = second ? T.cut2 : T.cut1;
    TH.tag(ctx, '与此同时 · 人间', 44, 360, t, t0 + 0.1, t0 + 2.9);
    if (!second) {
      TH.sfxText(ctx, '？！', 470, 1330, 96, t, 19.75, 0.9, { rot: 0.15, fill: '#fff', fill2: '#ffb35c' });
      [[610, 1180, 20.5], [860, 1120, 20.8], [1000, 1230, 21.1]].forEach(([x, y, s], i) => TH.sfxText(ctx, '？', x, y, 56, t, s, 22.45 - s, { rot: (i - 1) * 0.2, fill: '#fff', fill2: '#cfd8ff' }));
      hotSearch(ctx, '#月亮缺了一口#', t, 21.0, 22.5);
    } else {
      TH.sfxText(ctx, '哇——', 800, 900, 96, t, 35.6, 2.0, { rot: -0.08, fill: '#fff7a8', fill2: '#ffc233', wobble: 5 });
      hotSearch(ctx, '#月亮上有只兔子#', t, 36.1, 37.6);
    }
    for (const b of B) {
      if (b.id !== 'E1' && b.id !== 'E2') continue;
      TH.bubble(ctx, Object.assign(b, { tail: anchor(b.anchor, t) }), t);
    }
  }

  // ------------------------------------------------------------------ title & ending
  function drawTitle(ctx, t) {
    if (t > 3.1) return;
    const out = seg(t, 2.55, 3.05);
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.fillStyle = 'rgba(18,10,40,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.translate(0, -out * 120);
    // series seal
    const a = E.outBack(seg(t, 0.15, 0.5));
    ctx.save(); ctx.translate(W / 2, 1010); ctx.scale(a, a); ctx.rotate(-0.04);
    rrect(ctx, -250, -62, 500, 124, 22); fo(ctx, '#e2433a', OUT, 7);
    rrect(ctx, -236, -48, 472, 96, 16); ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#fff6df'; ctx.font = font(70); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('月宫小剧场', 0, 4);
    ctx.restore();
    // episode title, letters drop in
    const title = '谁咬了月亮？';
    const size = 128;
    ctx.font = font(size);
    const chars = [...title];
    const ws = chars.map((c) => ctx.measureText(c).width);
    let x = W / 2 - ws.reduce((p, c) => p + c, 0) / 2;
    chars.forEach((c, i) => {
      const k = seg(t, 0.55 + i * 0.09, 1.0 + i * 0.09);
      if (k <= 0) { x += ws[i]; return; }
      const yy = 1210 - (1 - E.outBounce(k)) * 260;
      ctx.save(); ctx.translate(x + ws[i] / 2, yy); ctx.rotate((i % 2 ? 1 : -1) * 0.05);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 34; ctx.strokeText(c, 0, 0);
      ctx.strokeStyle = OUT; ctx.lineWidth = 16; ctx.strokeText(c, 0, 0);
      const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#ffab2e');
      ctx.fillStyle = g; ctx.fillText(c, 0, 0);
      ctx.restore();
      x += ws[i];
    });
    const b = seg(t, 1.2, 1.5);
    ctx.globalAlpha = (1 - out) * b;
    ctx.font = font(46); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(30,18,60,0.85)'; ctx.lineWidth = 10; ctx.strokeText('第 1 集', W / 2, 1340);
    ctx.fillStyle = '#ffe9b0'; ctx.fillText('第 1 集', W / 2, 1340);
    ctx.textAlign = 'left';
    for (let i = 0; i < 6; i++) TH.sparkle(ctx, [180, 900, 120, 960, 300, 800][i], [960, 1000, 1260, 1250, 1420, 1430][i], 22 * b, t, i);
    ctx.restore();
  }

  const LANTERNS = (() => { const r = mulberry32(31), a = []; for (let i = 0; i < 9; i++) a.push({ x: 80 + r() * 920, d: r() * 1.5, sp: 90 + r() * 70, s: 0.55 + r() * 0.5 }); return a; })();

  function skyLantern(ctx, x, y, s, t, i) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 1.5 + i) * 0.06);
    const g = ctx.createRadialGradient(0, 10, 5, 0, 10, 110);
    g.addColorStop(0, 'rgba(255,190,90,0.6)'); g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g; ctx.fillRect(-110, -100, 220, 220);
    ctx.beginPath(); ctx.moveTo(-34, -46); ctx.quadraticCurveTo(0, -60, 34, -46); ctx.lineTo(26, 44); ctx.quadraticCurveTo(0, 52, -26, 44); ctx.closePath();
    const lg = ctx.createLinearGradient(0, -50, 0, 50); lg.addColorStop(0, '#ffe08a'); lg.addColorStop(1, '#ff8c3a');
    fo(ctx, lg, OUT, 4);
    ctx.fillStyle = 'rgba(255,255,220,0.8)'; ell(ctx, 0, 30, 10, 8); ctx.fill();
    ctx.restore();
  }

  function drawEnding(ctx, t) {
    const u = t - T.ending;
    TH.palaceSky(ctx, t, null);
    // rising sky lanterns
    for (let i = 0; i < LANTERNS.length; i++) {
      const L = LANTERNS[i];
      const y = 1900 - (u + L.d) * L.sp;
      skyLantern(ctx, L.x + Math.sin(t + i) * 20, y, L.s, t, i);
    }
    TH.cloudBank(ctx, -300, 1690, W + 600, 77, { size: 110, fill: '#efe7fb', outline: OUT, lw: 10, shade: 'rgba(200,185,235,0.6)' });
    // moon with 团团 inside, and 嫦娥 waving beside it
    const mz = E.outBack(seg(u, 0, 0.5));
    ctx.save();
    ctx.translate(640, 560); ctx.scale(lerp(0.8, 1, mz), lerp(0.8, 1, mz));
    TH.moon(ctx, 0, 0, 250, { bite: true, plug: 1, t, ball: ballPose(t), sparkle: 0.8 });
    ctx.restore();
    ctx.save();
    const cx = lerp(-200, 190, E.outBack(seg(u, 0.1, 0.6)));
    ctx.translate(cx, 880 + Math.sin(t * 2.2) * 10); ctx.scale(0.62, 0.62);
    TH.drawChangE(ctx, { time: t, eyes: 'closed', mouth: 'grin', armR: 'wave', armL: 'rest', makeup: 1, blush: 1 });
    ctx.restore();
    TH.fallingPetals(ctx, t, 0, W, 0, 1500, 1);
    // 中秋快乐
    const chars = ['中', '秋', '快', '乐'];
    const size = 200;
    chars.forEach((c, i) => {
      const k = seg(u, 0.25 + i * 0.12, 0.65 + i * 0.12);
      if (k <= 0) return;
      const s = E.outBackBig(k);
      const x = W / 2 + (i - 1.5) * 222, y = 1150 + Math.sin(t * 3 + i) * 8;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate((i % 2 ? 1 : -1) * 0.06);
      ctx.font = font(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 46; ctx.strokeText(c, 0, 0);
      ctx.strokeStyle = '#c8243c'; ctx.lineWidth = 22; ctx.strokeText(c, 0, 0);
      const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      g.addColorStop(0, '#fff6b8'); g.addColorStop(0.5, '#ffd24a'); g.addColorStop(1, '#ff9f1c');
      ctx.fillStyle = g; ctx.fillText(c, 0, 0);
      ctx.restore();
    });
    const sub = seg(u, 0.9, 1.3);
    if (sub > 0) {
      ctx.save(); ctx.globalAlpha = sub;
      ctx.font = font(48); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(30,18,60,0.85)'; ctx.lineWidth = 10; ctx.strokeText('月宫小剧场 · 第1集 完', W / 2, 1330);
      ctx.fillStyle = '#fff1c9'; ctx.fillText('月宫小剧场 · 第1集 完', W / 2, 1330);
      ctx.restore();
    }
    // teaser panel
    const tu = t - T.teaser;
    if (tu > 0) {
      const py = lerp(H + 40, 1440, E.outBack(seg(tu, 0, 0.45)));
      ctx.save();
      ctx.translate(0, py);
      rrect(ctx, 50, 14, W - 100, 460, 36); ctx.fillStyle = 'rgba(10,6,30,0.35)'; ctx.fill();
      rrect(ctx, 40, 0, W - 80, 460, 36); fo(ctx, '#232057', '#f2c14e', 8);
      rrect(ctx, 70, -34, 250, 76, 20); fo(ctx, '#e2433a', OUT, 6);
      ctx.fillStyle = '#fff6df'; ctx.font = font(50); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('下集预告', 195, 4);
      ctx.font = font(40); ctx.fillStyle = '#cfc6ff'; ctx.textAlign = 'left';
      ctx.fillText('第2集 · 敬请期待', 90, 400);
      // 天狗 pops up
      const dk = E.outBack(seg(tu, 0.2, 0.55));
      ctx.save(); ctx.beginPath(); ctx.rect(40, -300, W - 80, 760); ctx.clip();
      ctx.translate(820, 440 + (1 - dk) * 380);
      ctx.scale(0.9, 0.9);
      TH.drawDog(ctx, { talk: talking('dog', t), shake: Math.sin(t * 16) * 0.12 * (tu > 0.45 ? 1 : 0), time: t });
      ctx.restore();
      ctx.restore();
    }
    const d1 = B.find((b) => b.id === 'D1');
    TH.bubble(ctx, Object.assign(d1, { tail: [690, 1650] }), t);
  }

  // ------------------------------------------------------------------ overlays
  function seriesTag(ctx, t) {
    if (t < 3.0 || t > T.ending) return;
    const a = seg(t, 3.0, 3.4) * (1 - seg(t, T.ending - 0.3, T.ending));
    ctx.save(); ctx.globalAlpha = 0.9 * a;
    rrect(ctx, 36, 60, 418, 64, 32); ctx.fillStyle = 'rgba(20,12,45,0.55)'; ctx.fill();
    ell(ctx, 76, 92, 18, 18); fo(ctx, '#ffd35a', null);
    ctx.fillStyle = 'rgba(20,12,45,0.9)'; ell(ctx, 84, 86, 15, 15); ctx.fill();
    ctx.fillStyle = '#fff3d6'; ctx.font = font(36); ctx.textBaseline = 'middle';
    ctx.fillText('月宫小剧场 · 谁咬了月亮', 108, 93);
    ctx.restore();
  }

  let vig = null;
  function vignette(ctx) {
    if (!vig) {
      vig = document.createElement('canvas');
      vig.width = W / 4; vig.height = H / 4;
      const c = vig.getContext('2d');
      c.scale(0.25, 0.25);
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(10,5,30,0)'); g.addColorStop(1, 'rgba(10,5,30,0.35)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    ctx.drawImage(vig, 0, 0, W, H);
  }

  function renderFrame(t, ctx) {
    ctx = ctx || TH.ctx;
    t = clamp(+t || 0, 0, DUR);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const earthA = t >= T.cut1 && t < T.back1, earthB = t >= T.cut2 && t < T.back2;
    if (t >= T.ending) drawEnding(ctx, t);
    else if (earthA || earthB) drawEarth(ctx, t);
    else drawPalace(ctx, t);
    vignette(ctx);
    if (t < T.ending) {
      TH.laughs(ctx, t, T.laugh1, 1.5, 1790, 3);
      TH.laughs(ctx, t, T.laugh2, 1.4, 1790, 9);
    }
    drawTitle(ctx, t);
    seriesTag(ctx, t);
    for (const c of [T.cut1, T.back1, T.cut2, T.back2]) TH.swipe(ctx, (t - c + 0.16) / 0.32);
    if (t >= T.ending && t < T.ending + 0.35) { ctx.fillStyle = `rgba(255,248,230,${1 - (t - T.ending) / 0.35})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  TH.renderFrame = renderFrame;
  TH.camAt = camAt;
})();

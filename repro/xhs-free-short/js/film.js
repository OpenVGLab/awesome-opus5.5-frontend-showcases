// The film's timeline: looks, camera, shots, captions.
import { S, TAU, clamp, lerp, sstep, bump, ease, kf, mixv, C, css, mix, add, noise, fract, wrap, hash2, glow } from './core.js';
import {
  HZ, LH, seaY, dscale, surfY, skyShift, drawSky, drawFairClouds, drawStormDeck, drawBolt, drawSea, drawSheen,
  drawIslet, drawBreakwater, drawDanger, drawBeam, drawRain, drawSnow, drawFogBanks, veil, frontD, shoreInserts,
} from './world.js';
import { drawWhale, drawKeeper, drawBoat, drawGull, drawSpout, drawSplash, drawGlowTrail, drawRipple } from './actors.js';
import { drawUnderwater, drawParticles, drawGallery, drawWindowSet, GAL, leverTip } from './sets.js';

export const DURATION = 150;

// ---------------------------------------------------------------- looks
const base = {
  stars: 0, milky: 0, moon: 0, sun: 0, sunX: 620, sunY: 560,
  clouds: 0, cloudTop: C('#3a4a78'), cloudBot: C('#1c2750'), cloudRim: C('#9fb2e6'), cloudRdx: 3, cloudRdy: 5,
  deck: 0, deckTop: C('#2a3140'), deckBot: C('#10141b'), deckRim: C('#5d6a82'),
  grass: C('#6f8a4c'), storm: 0, wind: 0.2, flash: 0, snow: 0, shelter: 0, rain: 0, snowfall: 0,
  fogAmt: 0.3, fogVeil: 0, fogBank: 0, seaGlow: 0, towerGlow: 0, lanternGlow: 0,
  lamp: 0, beamTh: 0, beamI: 1, beamHaze: 1, window: 0, smoke: 0, win: [0, 0, 0],
  moonGlit: 0, sunGlit: 0,
};
const LOOK = {
  night: {
    ...base,
    skyTop: C('#040816'), skyMid: C('#152250'), skyHor: C('#3a5086'),
    seaFar: C('#263a68'), seaNear: C('#050a1a'), seaHi: C('#b4c6f5'),
    amb: C('#5e71aa'), rim: C('#a9bbff'), fog: C('#2e4172'), fogAmt: 0.3,
    stars: 1, milky: 0.6, moon: 1, clouds: 0.85, moonGlit: 0.95, window: 1, smoke: 1,
    cloudTop: C('#34457a'), cloudBot: C('#1a2752'), cloudRim: C('#8fa3dc'), cloudA: 0.6,
  },
  storm: {
    ...base,
    skyTop: C('#06080d'), skyMid: C('#131922'), skyHor: C('#29313d'),
    seaFar: C('#222b36'), seaNear: C('#04070b'), seaHi: C('#8d9cb0'),
    amb: C('#434d62'), rim: C('#8697b3'), fog: C('#252d38'), fogAmt: 0.5,
    deck: 1, storm: 1, wind: 1, rain: 1, window: 1, smoke: 0.4, beamHaze: 1.6,
  },
  dawn: {
    ...base,
    skyTop: C('#233766'), skyMid: C('#d68b8c'), skyHor: C('#ffd29a'),
    seaFar: C('#f2b99c'), seaNear: C('#2c2f58'), seaHi: C('#ffe4b8'),
    amb: C('#cfaeb4'), rim: C('#ffd6a0'), fog: C('#f3bba0'), fogAmt: 0.35,
    sun: 1, sunX: 620, sunY: 474, clouds: 0.9, cloudTop: C('#e7a7a2'), cloudBot: C('#8b6f98'), cloudRim: C('#ffe3b0'),
    cloudRdx: 0, cloudRdy: -5, sunGlit: 1, smoke: 0.8, window: 0.2,
  },
  day: {
    ...base,
    skyTop: C('#2f6fbe'), skyMid: C('#88bde6'), skyHor: C('#dcefff'),
    seaFar: C('#88bfd8'), seaNear: C('#12476a'), seaHi: C('#f0fbff'),
    amb: C('#f4f2ee'), rim: C('#fff2d8'), fog: C('#cfe6f2'), fogAmt: 0.3,
    sun: 0.55, sunX: 900, sunY: 120, clouds: 1, cloudTop: C('#ffffff'), cloudBot: C('#b9c9dc'), cloudRim: C('#ffffff'),
    cloudRdx: 2, cloudRdy: 4, sunGlit: 0.5, smoke: 0.6,
  },
  dusk: {
    ...base,
    skyTop: C('#1f2356'), skyMid: C('#b25b7c'), skyHor: C('#ff9f5c'),
    seaFar: C('#d98e6c'), seaNear: C('#1d1a38'), seaHi: C('#ffca94'),
    amb: C('#b78fa2'), rim: C('#ffb073'), fog: C('#d78c78'), fogAmt: 0.35,
    sun: 1, sunX: 1640, sunY: 488, clouds: 0.9, cloudTop: C('#d88a8a'), cloudBot: C('#5d4c7c'), cloudRim: C('#ffc98a'),
    cloudRdx: 0, cloudRdy: -5, sunGlit: 0.9, window: 1, smoke: 0.8, stars: 0.15,
  },
  winter: {
    ...base,
    skyTop: C('#040814'), skyMid: C('#122036'), skyHor: C('#2f4566'),
    seaFar: C('#263b5e'), seaNear: C('#040915'), seaHi: C('#bcd0f4'),
    amb: C('#6a7fb2'), rim: C('#bcd0ff'), fog: C('#34496f'), fogAmt: 0.4,
    stars: 0.7, milky: 0.25, moon: 0.9, moonGlit: 0.8, snow: 1, snowfall: 0.8, clouds: 0.5,
  },
  fog: {
    ...base,
    skyTop: C('#070a12'), skyMid: C('#161d2a'), skyHor: C('#384354'),
    seaFar: C('#2f394a'), seaNear: C('#05080f'), seaHi: C('#8d9ab0'),
    amb: C('#4b556c'), rim: C('#8290a8'), fog: C('#48536a'), fogAmt: 0.75,
    stars: 0.08, fogVeil: 0.34, fogBank: 0.7, storm: 0.12, wind: 0.1,
  },
  glow: {
    ...base,
    skyTop: C('#030715'), skyMid: C('#0e1b3e'), skyHor: C('#1f3c62'),
    seaFar: C('#15324f'), seaNear: C('#020816'), seaHi: C('#9fe8f0'),
    amb: C('#43598c'), rim: C('#8fe3ff'), fog: C('#1d3552'), fogAmt: 0.3,
    stars: 1, milky: 1, moon: 0, storm: 0.08, wind: 0.1,
  },
};

// ---------------------------------------------------------------- camera
export function setCam(cam) {
  const ctx = S.ctx;
  const P = S.pic;
  const k = (P.w / 1920) * cam.z;
  S.k = k;
  S.kc = k / S.dpr;
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  ctx.setTransform(k, 0, 0, k, cx - cam.x * k, cy - cam.y * k);
  let pad = 0;
  if (cam.r) {
    ctx.translate(cam.x, cam.y);
    ctx.rotate(cam.r);
    ctx.translate(-cam.x, -cam.y);
    pad = Math.abs(cam.r) * 1100;
  }
  const hw = P.w / 2 / k, hh = P.h / 2 / k;
  S.V = { x0: cam.x - hw - pad, x1: cam.x + hw + pad, y0: cam.y - hh - pad, y1: cam.y + hh + pad };
  S.cam = cam;
}

const shake = (t, amt, seed = 0) => ({
  x: noise(t * 7.3, seed) * amt,
  y: noise(t * 6.1, seed + 5) * amt * 0.7,
  r: noise(t * 3.1, seed + 9) * amt * 0.0006,
});

// ---------------------------------------------------------------- helpers
function lights(L, extra = []) {
  const out = [];
  const sh = skyShift(S.cam);
  if (L.moon > 0.01) out.push({ x: 430 + sh.x, c: [215, 226, 255], a: L.moon * L.moonGlit, sp: 90, seed: 3 });
  if (L.sun > 0.01) out.push({ x: L.sunX + sh.x, c: [255, 214, 150], a: L.sunGlit * L.sun, sp: 150, seed: 5, n: 12 });
  if (L.lamp > 0.01 && !L.steady) {
    const f = Math.pow(Math.abs(Math.cos(L.beamTh)), 6);
    if (f > 0.02) out.push({ x: LH.x, c: [255, 220, 160], a: f * L.lamp * 0.9, sp: 60, seed: 7 });
  }
  return out.concat(extra);
}

// Lightning schedule: [time, boltIndex, x]
const BOLTS = [[26.3, 0, 520], [29.6, 1, 1560], [36.0, 3, 0], [45.0, 2, 380], [52.5, 4, 480]];
function flashAt(t) {
  let f = 0, bolt = null;
  for (const [bt, bi, bx] of BOLTS) {
    const a = t - bt;
    if (a < -0.01 || a > 1.2) continue;
    const v = a < 0.06 ? 1 : a < 0.1 ? 0.25 : a < 0.2 ? 0.9 : Math.exp(-(a - 0.2) * 5) * 0.8;
    if (v > f) {
      f = v;
      bolt = { i: bi, x: bx, a: a < 0.35 ? (a < 0.06 || (a > 0.1 && a < 0.35) ? 1 : 0.2) : 0 };
    }
  }
  return { f, bolt };
}

// Island scene renderer shared by most shots.
function island(L, t, cam, o = {}) {
  setCam(cam);
  const sh = skyShift(cam);
  L.t = t;
  L.lights = lights(L, o.lights || []);
  drawSky(L, sh);
  drawFairClouds(L, sh, o.cloudT ?? t, o.cloudSpeed || 1);
  drawStormDeck(L, sh, t);
  if (o.bolt && o.bolt.a > 0) drawBolt(o.bolt.i, o.bolt.x, -200, HZ, 380, o.bolt.a);
  if (o.sky) o.sky(sh);
  const ins = [
    { d: 0.262, fn: () => drawIslet(L, t) },
    { d: 0.3, fn: () => drawBreakwater(L, t) },
    { d: 0.372, fn: () => drawDanger(L, t) },
    ...shoreInserts(L, t),
  ];
  if (L.fogVeil > 0.005) {
    ins.push({ d: 0.28, fn: () => veil(L.fog, L.fogVeil) });
    ins.push({ d: 0.34, fn: () => drawFogBanks(L.fogBank, t, L.fog, HZ + 60, 60) });
  }
  drawSea(L, t, ins.concat(o.inserts || []));
  if (L.moon > 0.01) drawSheen(430 + sh.x, [200, 215, 255], 0.09 * L.moon * L.moonGlit, 160);
  if (L.sun > 0.01) drawSheen(L.sunX + sh.x, [255, 200, 130], 0.22 * L.sun * L.sunGlit, 260);
  if (o.afterSea) o.afterSea();
  drawBeam(L, t);
  if (L.fogBank > 0.01) drawFogBanks(L.fogBank * 0.7, t * 1.3 + 40, L.fog, HZ + 150, 110);
  drawRain(L.rain, t, 0.45 * L.wind + 0.1, add(L.amb, [60, 60, 70]), 1);
  drawSnow(L.snowfall, t, 0.25);
  if (o.fx) o.fx();
}

function whaleAtSurface(x, d, t, Lw, o, L) {
  const y = surfY(L, x, d, t) + (o.sink ?? 0.028) * Lw;
  return drawWhale({ x, y, L: Lw, amb: L.amb, rim: L.rim, rimA: 0.45, t, ...o });
}

// ---------------------------------------------------------------- shots
// Opening: title over the stars, tilt down, the keeper lights the lamp, the storm rolls in.
function beamAngle(t, start, spin = 0.9) {
  if (t < start) return 0;
  const a = t - start;
  const ramp = 2.2;
  return a < ramp ? (spin * a * a) / (2 * ramp) : spin * (ramp / 2 + (a - ramp));
}

function shotOpen(t) {
  const L = mixv(LOOK.night, LOOK.storm, sstep(19.5, 28.5, t));
  L.win = [bump(11.2, 11.5, 12.2, 12.7, t), bump(12.0, 12.3, 13.0, 13.5, t), bump(12.8, 13.1, 13.9, 14.3, t)];
  const ign = sstep(13.9, 14.6, t);
  L.lamp = ign * (t < 14.6 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 41)) : 1);
  L.beamTh = beamAngle(t, 14.9) + 0.0;
  L.moon = LOOK.night.moon * (1 - sstep(21.5, 25.5, t));
  L.stars = 1 - sstep(20, 24.5, t);
  L.milky = LOOK.night.milky * (1 - sstep(19, 23, t));
  L.deck = sstep(19.5, 28.5, t);
  L.clouds = 0.85 * (1 - sstep(21, 26, t));
  L.storm = sstep(20.5, 29.5, t);
  L.rain = sstep(23.2, 27.5, t);
  L.wind = 0.2 + 0.8 * sstep(20, 27, t);
  const fl = flashAt(t);
  L.flash = fl.f;
  L.amb = add(L.amb, [150, 160, 200], fl.f * 0.5);
  const camY = kf(t, [[0, -430], [3.2, -430, ease.io], [11.8, 436]]);
  const z = kf(t, [[0, 1], [11.8, 1, ease.lin], [20, 1.06, ease.sine], [31, 1.13]]);
  const x = kf(t, [[0, 960], [11.8, 960], [31, 1030]]);
  const sk = shake(t, 5 * sstep(24, 29, t));
  island(L, t, { x: x + sk.x, y: camY + sk.y, z, r: sk.r }, { bolt: fl.bolt });
}

// Underwater: the calf, lost, sees the light.
function shotDeep(t) {
  const lt = t - 31;
  const sk = shake(t, 4, 3);
  setCam({ x: 960 + lt * 5 + sk.x, y: 436 + Math.sin(t * 0.7) * 6, z: 1.02 + lt * 0.004, r: Math.sin(t * 0.5) * 0.012 });
  const fl = flashAt(t);
  const beamOn = sstep(38.2, 38.9, t);
  const U = {
    top: C('#1c3a50'), mid: C('#0c2031'), deep: C('#02070e'), surf: C('#2b4a60'),
    surfY: 64, storm: 1, rays: 0.4 * (1 - beamOn * 0.4), rayCol: [120, 170, 195], flash: fl.f,
    beam: beamOn * (0.7 + 0.3 * Math.sin(t * 5)), beamX: wrap((t - 38.2) * 950 - 500, -500, 2400),
    snow: 1, bubbles: 1 - sstep(38, 42, t), snowCol: [170, 200, 215], current: 2.2,
  };
  drawUnderwater(U, t);
  drawParticles(U, t, 0);
  // the mother, drifting away into the murk
  const ma = 0.55 * (1 - sstep(1.5, 6, lt));
  if (ma > 0.01) {
    drawWhale({
      x: 1480 + lt * 95, y: 600 + lt * 12, L: 980, dir: 1, pitch: -0.06, ph: t * 1.5, amp: 0.045,
      amb: C('#2b4a60'), back: C('#9ab0c0'), belly: C('#b8c8d4'), alpha: ma,
    });
  }
  // the calf: tossed about, then turns toward the passing light and follows it up
  const seek = sstep(38.9, 40.4, t);
  const turn = clamp((t - 38.7) / 0.55);
  let dir = -Math.cos(Math.PI * turn);
  dir = Math.sign(dir || 1) * Math.max(0.14, Math.abs(dir));
  const go = Math.max(0, t - 39.2);
  const tx = 980 + Math.sin(lt * 0.9) * 60 * (1 - seek) + go * go * 22 * seek / (1 + go * 0.2);
  const ty = 470 + Math.sin(lt * 1.3) * 42 * (1 - seek) - go * 58 * seek;
  const pitch = Math.sin(lt * 1.7) * 0.32 * (1 - seek) + seek * 0.38;
  drawWhale({
    x: tx, y: ty, L: 420, calf: true, dir, pitch, ph: t * lerp(4.2, 2.9, seek), amp: lerp(0.1, 0.07, seek),
    amb: add(C('#7e97ad'), [140, 150, 170], fl.f * 0.4 + beamOn * 0.12), rim: [170, 215, 235], rimA: 0.35 + beamOn * 0.25,
    blink: Math.abs(fract(t * 0.23) - 0.5) < 0.012,
  });
  drawParticles(U, t, 1);
  drawParticles(U, t, 2);
  if (fl.f > 0.01) veil([200, 220, 255], fl.f * 0.12);
}

// The gallery: the keeper spots the calf and brakes the lens.
const GAL_TH0 = 2.464;
function lensAngle(t) {
  const w = 1.1;
  if (t < 47.6) return GAL_TH0 + w * (t - 43);
  const a = Math.min(t - 47.6, 0.6);
  return GAL_TH0 + w * 4.6 + w * (a - (a * a) / 1.2);
}
function shotGallery(t) {
  const lt = t - 43;
  const sk = shake(t, 6, 7);
  setCam({ x: 930 + lt * 9 + sk.x, y: 430 - lt * 2 + sk.y, z: 1.0 + lt * 0.014, r: sk.r });
  const fl = flashAt(t);
  const la = sstep(46.7, 47.6, t);
  const [lwx, lwy] = leverTip(la);
  const leverLocal = [(GAL.keeperX - lwx) / 450, (lwy - GAL.floor) / 450];
  const head = [0.03, -0.895];
  const lower = sstep(45.25, 45.85, t);
  const reach = sstep(45.9, 46.6, t);
  const rail = sstep(47.8, 48.6, t);
  const scan = Math.sin(lt * 1.2) * 0.04 * (1 - sstep(44.9, 45.1, t));
  const nearUp = [head[0] + 0.1, head[1] + 0.012];
  const nearDown = [0.16, -0.56];
  // the railing is below his reach, so the spyglass just hangs at his side
  const nearRail = [0.21, -0.5];
  let near = mixv(mixv(nearUp, nearDown, lower), nearRail, rail);
  const farUp = [head[0] + 0.22, head[1] + 0.004 + scan * 0.5];
  const farDown = [0.06, -0.5];
  let far = mixv(mixv(farUp, farDown, lower), leverLocal, reach);
  const pose = {
    lean: 0.02 - lower * 0.01, hands: [near, far],
    prop: 'spyglass', propA: lerp(-0.04 + scan, 1.1, lower), scopeHand: lower > 0.5,
  };
  drawGallery({
    flash: fl.f, bolt: fl.bolt && fl.bolt.i === 2 ? fl.bolt.a : 0, lamp: 1, lensTh: lensAngle(t), lever: la,
    pose, rain: 1, calfSeen: fl.f > 0.05 ? 1 : Math.max(0, 1 - (t - 45.1) * 1.2) * (t > 45 ? 1 : 0),
  }, t);
  if (fl.f > 0.01) veil([200, 215, 255], fl.f * 0.15);
}

// The rescue: a steady beam lights a path for the calf.
function calfRescue(t) {
  const p = ease.io(clamp((t - 51.2) / 7.4));
  const x = lerp(770, 1455, p);
  const d = lerp(0.46, 0.42, p);
  return { x, d, p };
}
function shotRescue(t) {
  const L = mixv(LOOK.storm, {}, 0);
  L.storm = 1 - 0.35 * sstep(55, 60, t);
  L.rain = 1 - 0.45 * sstep(56, 60, t);
  L.shelter = 0.85;
  L.lamp = 1;
  const c = calfRescue(t);
  const light = sstep(50.6, 51.3, t);
  L.beamI = light;
  const tx = c.x + 40 + Math.sin(t * 1.3) * 10;
  L.steady = [tx, surfY(L, tx, c.d, t)];
  const fl = flashAt(t);
  L.flash = fl.f;
  L.amb = add(L.amb, [150, 160, 200], fl.f * 0.5 + light * 0.05);
  const sk = shake(t, 4, 11);
  const cx = kf(t, [[49.5, 900], [51, 900], [59, 1170]]);
  const z = kf(t, [[49.5, 1.24], [60, 1.14]]);
  island(L, t, { x: cx + sk.x, y: 478 + sk.y, z, r: sk.r * 0.6 }, {
    bolt: fl.bolt,
    inserts: [{
      // the calf rides high and the water over it is thin, so it stays readable in the storm swell
      d: c.d, cover: 0.55, fn: () => {
        const Lw = 215 * dscale(c.d);
        const struggle = 1 - sstep(50.8, 52, t);
        const bob = Math.sin(t * 2.3) * 0.02 * Lw + struggle * Math.sin(t * 5) * 0.04 * Lw;
        const slope = (surfY(L, c.x + 0.3 * Lw, c.d, t) - surfY(L, c.x - 0.3 * Lw, c.d, t)) / (0.6 * Lw);
        const w = whaleAtSurface(c.x, c.d, t, Lw, {
          calf: true, dir: 1, pitch: 0.05 - Math.atan(slope) * 0.6 + struggle * Math.sin(t * 4) * 0.2 + Math.sin(t * 2.3) * 0.03,
          ph: t * lerp(4, 2.4, c.p), amp: 0.08, sink: -0.03 + bob / Lw,
          amb: add(L.amb, [255, 210, 150], 0.3 * light), rim: [255, 230, 180], rimA: 0.4 + 0.5 * light,
          wash: { c: [255, 208, 150], a: 0.08 + 0.24 * light }, blink: Math.abs(fract(t * 0.3) - 0.5) < 0.02,
        }, L);
        drawSplash(c.x - 20, surfY(L, c.x, c.d, t), t, 0.9, 41, 0.8, struggle * 0.8);
        // safe in the lee, it breathes
        drawSpout(w.blow[0], w.blow[1], 57.3, t, dscale(c.d) * 0.42, 0.8);
      },
    }],
    fx: () => {
      const reef = frontD(0.372), shore = frontD(0.262);
      drawSplash(900, surfY(L, 900, reef, t), t, 2.3, 7, 1.2, L.storm * 0.9);
      drawSplash(985, surfY(L, 985, reef, t), t, 2.9, 9, 1.1, L.storm * 0.9);
      drawSplash(1040, surfY(L, 1040, shore, t), t, 3.1, 13, 0.9, L.storm * 0.7);
    },
  });
}

// Dawn, wide.
const KEEPER_SEAT = [1602, 561];
function gulls(t, L, n = 4) {
  const col = css(add(L.amb, [60, 50, 50]).map((v) => v * 0.55), 0.9);
  for (let i = 0; i < n; i++) {
    const h1 = hash2(i, 81), h2 = hash2(i, 82);
    const x = wrap(1900 - (t * (38 + 20 * h1) + h2 * 2000), -200, 2200);
    const y = 250 + h2 * 150 + Math.sin(t * 0.6 + i) * 12;
    drawGull(x, y, 0.9 + h1 * 0.7, t * (6 + 3 * h2) + i, col);
  }
}
function calfResting(t, L, x = 1455, d = 0.42, extra = {}) {
  const Lw = 150 * dscale(d);
  return whaleAtSurface(x, d, t, Lw, {
    calf: true, dir: 1, pitch: 0.03 + Math.sin(t * 0.8) * 0.03, ph: t * 1.2, amp: 0.03,
    sink: 0.02 + Math.sin(t * 0.9) * 0.012, ...extra,
  }, L);
}
function shotDawnWide(t) {
  const L = mixv(LOOK.dawn, {}, 0);
  L.sunY = kf(t, [[60, 510], [64.5, 482]]);
  L.sun = sstep(59.6, 61.5, t);
  L.lamp = 1 - sstep(60.2, 61.6, t);
  L.beamTh = 0.35;
  const z = kf(t, [[60, 1.0], [64.5, 1.05]]);
  island(L, t, { x: 980, y: 440, z }, {
    inserts: [
      { d: 0.42, cover: 0.8, fn: () => calfResting(t, L) },
      { d: 0.301, fn: () => drawKeeper({ x: KEEPER_SEAT[0], y: KEEPER_SEAT[1], h: 48, dir: -1, pose: { sit: 1, hands: [[0.16, -0.12], [0.1, -0.1]] }, amb: L.amb, rim: L.rim, rimA: 0.5, rimSide: -1 }) },
    ],
    afterSea: () => gulls(t, L),
  });
}

// Dawn, close: the flute and the whale's reply.
export const FLUTE_T = 65.0;
export const ECHO_T = 71.6;
export const BEAT = 60 / 76;
function shotDawnClose(t) {
  const L = mixv(LOOK.dawn, {}, 0);
  L.sunY = kf(t, [[64.5, 482], [78, 440]]);
  const z = kf(t, [[64.5, 3.9], [78, 4.25]]);
  const cx = kf(t, [[64.5, 1536], [78, 1546]]);
  const playing = sstep(64.7, 65.0, t) * (1 - sstep(71.3, 71.8, t));
  const listen = sstep(71.3, 71.8, t);
  const sway = Math.sin((t - FLUTE_T) * Math.PI / BEAT / 2) * 0.012 * playing;
  const laugh = bump(76.3, 76.6, 77.4, 77.9, t) * Math.abs(Math.sin(t * 14)) * 0.008;
  const head0 = [0.05 + sway, -0.43];
  const fluteHands = [[head0[0] + 0.19, head0[1] + 0.2], [head0[0] + 0.12, head0[1] + 0.12]];
  const lapHands = [[0.19, -0.1], [0.13, -0.12]];
  const pose = {
    sit: 1, lean: sway, hunch: laugh * 20,
    hands: mixv(fluteHands, lapHands, listen),
    prop: listen < 0.5 ? 'flute' : null, propA: 0.95,
    eyesClosed: playing > 0.5 && Math.sin(t * 0.7) > -0.3,
  };
  const singing = sstep(ECHO_T - 0.4, ECHO_T, t) * (1 - sstep(77.8, 78.4, t));
  island(L, t, { x: cx, y: 578, z }, {
    inserts: [
      {
        d: 0.405, cover: 0.78, fn: () => {
          const w = calfResting(t, L, 1452, 0.405, {
            pitch: 0.04 + singing * (0.12 + Math.sin(t * 2.2) * 0.04) + (1 - singing) * listen * 0.02,
            sink: 0.02 - singing * 0.012 + Math.sin(t * 0.9) * 0.01,
            blink: Math.abs(fract(t * 0.21) - 0.5) < 0.015,
          });
          if (singing > 0.01) {
            for (let k = 0; k < 8; k++) {
              const nt = ECHO_T + k * BEAT;
              drawRipple(w.head[0] + 6, surfY(L, w.head[0], 0.405, t), nt, t, 0.55, 0.5 * singing, [255, 236, 190]);
            }
          }
        },
      },
      { d: 0.301, fn: () => drawKeeper({ x: KEEPER_SEAT[0], y: KEEPER_SEAT[1], h: 48, dir: -1, pose, amb: L.amb, rim: L.rim, rimA: 0.6, rimSide: -1 }) },
    ],
    afterSea: () => gulls(t, L, 3),
  });
}

// Dawn: the mother calls, the calf says goodbye and leaves. The camera cranes out.
function calfLeaving(t) {
  const p = ease.io(clamp((t - 81.2) / 5.2));
  const x = lerp(1452, 640, p);
  const d = lerp(0.405, 0.075, Math.pow(p, 0.8));
  return { x, d, p };
}
function shotDawnFarewell(t) {
  const L = mixv(LOOK.dawn, {}, 0);
  L.sunY = kf(t, [[78, 452], [87, 420]]);
  const cam = kf(t, [
    [78, { x: 1540, y: 580, z: 4.1 }],
    [80.4, { x: 1520, y: 578, z: 3.7 }, ease.io],
    [84.2, { x: 1080, y: 488, z: 1.24 }, ease.sine],
    [87, { x: 930, y: 470, z: 1.12 }],
  ]);
  const c = calfLeaving(t);
  const turn = clamp((t - 79.5) / 0.5);
  let dir = Math.cos(Math.PI * turn);
  dir = Math.sign(dir || -1) * Math.max(0.14, Math.abs(dir));
  const wave = sstep(81.3, 81.8, t) * (1 - sstep(85.2, 86, t));
  const wv = Math.sin(t * 7) * 0.07;
  const keeperPose = {
    sit: 1, hands: [mixv([0.19, -0.1], [0.1 + wv, -0.6 + Math.abs(wv) * 0.3], wave), [0.13, -0.12]],
  };
  island(L, t, cam, {
    inserts: [
      {
        d: c.d, cover: 0.8, fn: () => {
          const Lw = 150 * dscale(c.d);
          const dive = sstep(85.4, 86.4, t);
          const lift = bump(78.9, 79.3, 80.2, 80.7, t);
          whaleAtSurface(c.x, c.d, t, Lw, {
            calf: true, dir, pitch: 0.05 + lift * 0.14 - dive * 0.6, ph: t * (c.p > 0 ? 2.6 : 1.2), amp: c.p > 0 ? 0.07 : 0.03,
            sink: 0.02 - lift * 0.01 + dive * 0.25,
          }, L);
        },
      },
      {
        // the farewell blow hangs where it was made while the calf swims off
        d: 0.405, fn: () => {
          const Lw0 = 150 * dscale(0.405), bx = 1452 - 0.26 * Lw0;
          drawSpout(bx, surfY(L, bx, 0.405, t) - 0.12 * Lw0, 80.7, t, 0.44, 0.9);
        },
      },
      {
        d: 0.06, fn: () => {
          // the mother at the horizon: spouts, then a fluke as she dives
          const mx = 560, my = surfY(L, mx, 0.06, t);
          drawSpout(mx, my, 80.9, t, 0.32, 0.9);
          drawSpout(mx + 6, my, 83.3, t, 0.3, 0.85);
          const fa = bump(85.7, 86.3, 86.8, 87.3, t);
          if (fa > 0.01) drawFluke(mx + 22, my + 2 - fa * 16, 0.55, L, fa);
        },
      },
      { d: 0.301, fn: () => drawKeeper({ x: KEEPER_SEAT[0], y: KEEPER_SEAT[1], h: 48, dir: -1, pose: keeperPose, amb: L.amb, rim: L.rim, rimA: 0.5, rimSide: -1 }) },
    ],
    afterSea: () => gulls(t, L, 3),
  });
}

function drawFluke(x, y, s, L, a) {
  const ctx = S.ctx;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = css(mix(L.amb, [30, 30, 50], 0.7));
  ctx.beginPath();
  ctx.moveTo(-3, 30);
  ctx.quadraticCurveTo(-4, 10, -4, 0);
  ctx.quadraticCurveTo(-18, -4, -34, -14);
  ctx.quadraticCurveTo(-16, -16, 0, -6);
  ctx.quadraticCurveTo(16, -16, 34, -14);
  ctx.quadraticCurveTo(18, -4, 4, 0);
  ctx.quadraticCurveTo(4, 10, 3, 30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Years: time-lapse days and nights.
function cycleLook(ph) {
  // ph: 0 noon, .25 dusk, .5 night, .75 dawn
  const keys = [[0, LOOK.day], [0.2, LOOK.day], [0.3, LOOK.dusk], [0.4, LOOK.night], [0.62, LOOK.night], [0.72, LOOK.dawn], [0.82, LOOK.day], [1, LOOK.day]];
  return kf(ph, keys, ease.sine);
}
function shotYears(t) {
  const lt = t - 87;
  const ph = fract(0.15 + lt / 2.5);
  const L = cycleLook(ph);
  const nightF = bump(0.3, 0.38, 0.66, 0.74, ph);
  L.lamp = nightF;
  L.beamTh = t * 2.2;
  L.window = nightF;
  const sa = ph * TAU;
  L.sunX = 960 + Math.sin(sa) * 700;
  L.sunY = 470 - Math.cos(sa) * 360;
  L.sun = clamp(Math.cos(sa) * 2 + 0.6) * (L.sun > 0 ? 1 : 0.8);
  L.seaSpeed = 2.2;
  island(L, t, { x: 960, y: 436, z: 1.0 }, { cloudT: t * 30, cloudSpeed: 1 });
}

// Autumn dusk: the old keeper still plays.
function shotOld(t) {
  const L = mixv(LOOK.dusk, {}, 0);
  L.grass = C('#a2793c');
  L.lamp = 1;
  L.beamTh = beamAngle(t, 80);
  const cam = { x: kf(t, [[92, 1560], [97.5, 1575]]), y: 540, z: kf(t, [[92, 3.1], [97.5, 3.35]]) };
  L.sunX = 1705 - (cam.x - 960) * 0.5;
  L.sunY = kf(t, [[92, 470], [97.5, 488]]) - (cam.y - 436) * 0.5;
  const sway = Math.sin(t * 1.6) * 0.01;
  const head0 = [0.1, -0.39];
  const pose = {
    sit: 1, hunch: 1, lean: sway,
    hands: [[head0[0] + 0.19, head0[1] + 0.21], [head0[0] + 0.12, head0[1] + 0.13]],
    prop: 'flute', propA: 1.0, eyesClosed: true,
  };
  island(L, t, cam, {
    inserts: [
      {
        d: 0.301, fn: () => {
          const ctx = S.ctx;
          // cane leaning on the rock
          ctx.strokeStyle = css(mix(L.amb, [60, 40, 30], 0.6));
          ctx.lineWidth = 1.3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(KEEPER_SEAT[0] - 13, KEEPER_SEAT[1] + 8);
          ctx.lineTo(KEEPER_SEAT[0] - 19, KEEPER_SEAT[1] - 19);
          ctx.stroke();
          drawKeeper({ x: KEEPER_SEAT[0], y: KEEPER_SEAT[1], h: 46, dir: 1, pose, amb: L.amb, rim: L.rim, rimA: 0.75, rimSide: 1 });
        },
      },
    ],
    afterSea: () => gulls(t + 10, L, 2),
  });
}

// Winter: the window light goes out.
export const LIGHT_OUT_T = 99.3;
function shotWindow(t) {
  const z = kf(t, [[97.5, 1.1], [100.5, 1.2]]);
  setCam({ x: 960, y: 448, z });
  const off = sstep(LIGHT_OUT_T, LIGHT_OUT_T + 1.2, t);
  const flick = t > LIGHT_OUT_T - 0.6 && t < LIGHT_OUT_T ? 0.75 + 0.25 * Math.sin(t * 60) : 1;
  drawWindowSet({ light: (1 - off) * flick, flame: (1 - sstep(LIGHT_OUT_T, LIGHT_OUT_T + 0.5, t)) * flick, smoke: sstep(LIGHT_OUT_T + 0.3, LIGHT_OUT_T + 0.6, t), smokeRise: clamp((t - LIGHT_OUT_T - 0.3) / 1.2) }, t);
}

function shotDark(t) {
  const L = mixv(LOOK.winter, {}, 0);
  const z = kf(t, [[100.5, 1.0], [103.5, 0.97]]);
  island(L, t, { x: 960, y: 436, z });
}

// Fog: a small boat loses its way.
function boatPath(t) {
  if (t < 121) {
    const p = clamp((t - 103.5) / 20.5);
    return { x: lerp(230, 745, 1 - (1 - p) ** 1.4), d: 0.47, dir: 1 };
  }
  const p = ease.io(clamp((t - 124.5) / 8.5));
  const x0 = lerp(230, 745, 1 - (1 - clamp((Math.min(t, 124.5) - 103.5) / 20.5)) ** 1.4);
  return { x: lerp(x0, 1405, p), d: lerp(0.47, 0.455, p), dir: 1 };
}
function drawBoatAt(L, t, lantern = 1) {
  const b = boatPath(t);
  const s = dscale(b.d) * 0.85;
  const y = surfY(L, b.x, b.d, t);
  const slope = (surfY(L, b.x + 30, b.d, t) - surfY(L, b.x - 30, b.d, t)) / 60;
  const lp = drawBoat({ x: b.x, y: y + 4 * s, s, ang: Math.atan(slope) * 0.8, amb: L.amb, rim: L.rim, lantern, sway: Math.sin(t * 1.7) * 0.6, dir: b.dir });
  const ctx = S.ctx;
  ctx.globalCompositeOperation = 'lighter';
  glow(S.sp.warm, lp[0], lp[1], 70 * s * lantern, 0.8 * lantern);
  glow(S.sp.warmCore, lp[0], lp[1], 10 * s, lantern);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  return { b, lp };
}
function shotFog(t) {
  const L = mixv(LOOK.fog, {}, 0);
  const cx = kf(t, [[103.5, 700], [114.5, 800]]);
  const z = kf(t, [[103.5, 1.12], [114.5, 1.26]]);
  const b = boatPath(t);
  island(L, t, { x: cx, y: 522, z }, {
    lights: [{ x: b.x + 25, d: b.d, c: [255, 200, 130], a: 0.8, sp: 22, seed: 9, n: 7 }],
    inserts: [{ d: b.d, fn: () => drawBoatAt(L, t) }],
  });
}

// The song: underwater, the grown whale sings and the sea lights up.
export const SONG_T = 115.2;
// note onsets (in beats) of the first two bars of the theme
export const THEME_A = [[0, 66, 1], [1, 69, 1], [2, 74, 2], [4, 73, 1], [5, 71, 1], [6, 69, 2]];
const PLANKTON = [];
function initPlankton() {
  for (let i = 0; i < 900; i++) {
    PLANKTON.push({ x: -300 + hash2(i, 1) * 2600, y: 60 + hash2(i, 2) * 820, s: 0.5 + hash2(i, 3), ph: hash2(i, 4) * TAU });
  }
}
// The grown whale glides in from the right and settles; the whole body is in frame from about 116 s.
const SONG_L = 1080, SONG_X0 = 1300, SONG_X1 = 840, SONG_DUR = 6.5;
function songWhale(t) {
  const p = clamp((t - 114.5) / SONG_DUR);
  return { x: SONG_X0 - (SONG_X0 - SONG_X1) * ease.out(p), y: 440 + Math.sin(t * 0.5) * 12 };
}
// When the head passed plankton at x (inverse of the eased path; extrapolated before the shot).
function headPassT(x) {
  const u = (SONG_X0 - 0.36 * SONG_L - x) / (SONG_X0 - SONG_X1);
  if (u > 1) return Infinity;
  if (u < 0) return 114.5 + (u * SONG_DUR) / 3;
  return 114.5 + SONG_DUR * (1 - Math.cbrt(1 - u));
}
function shotSong(t) {
  if (!PLANKTON.length) initPlankton();
  const lt = t - 114.5;
  setCam({ x: 960 - lt * 6, y: 440, z: 1.0 + lt * 0.006 });
  const U = {
    top: C('#0f2638'), mid: C('#06121f'), deep: C('#01040a'), surf: C('#163048'),
    surfY: 52, storm: 0.1, rays: 0.12, rayCol: [120, 160, 200], flash: 0, beam: 0, beamX: 0,
    snow: 0.5, snowCol: [140, 190, 210], current: 0.6,
  };
  drawUnderwater(U, t);
  drawParticles(U, t, 0);
  const w = songWhale(t);
  const headX = w.x - 0.36 * SONG_L;
  const headY = w.y - 20;
  const ctx = S.ctx;
  // song rings and plankton lighting
  const notes = THEME_A.map(([b]) => SONG_T + b * BEAT);
  ctx.globalCompositeOperation = 'lighter';
  for (const q of PLANKTON) {
    let e = 0;
    const passT = headPassT(q.x);
    if (t > passT) e += Math.exp(-(t - passT) / 3) * 0.7 * sstep(0, 0.4, t - passT);
    const dy = Math.abs(q.y - headY);
    e *= Math.exp(-dy / 260);
    const dist = Math.hypot(q.x - headX, q.y - headY);
    for (const nt of notes) {
      const r = (t - nt) * 520;
      if (r < 0) continue;
      e += Math.exp(-Math.abs(dist - r) / 40) * Math.exp(-(t - nt) / 2.2) * 0.9 + (dist < r ? 0.25 * Math.exp(-(t - nt) / 4) : 0);
    }
    const a = clamp(e) * (0.6 + 0.4 * Math.sin(t * 3 + q.ph));
    if (a < 0.02) continue;
    const x = q.x + Math.sin(t * 0.4 + q.ph) * 8, y = q.y + Math.cos(t * 0.3 + q.ph) * 6;
    glow(S.sp.cyanCore, x, y, 5 * q.s, a);
    if (a > 0.35) glow(S.sp.cyan, x, y, 22 * q.s, a * 0.25);
  }
  for (const nt of notes) {
    const age = t - nt;
    if (age < 0 || age > 2.6) continue;
    ctx.strokeStyle = css([110, 255, 225], 0.35 * (1 - age / 2.6));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(headX, headY, age * 520, 0, TAU);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const g = sstep(115, 118, t);
  // calf behind
  drawWhale({
    x: w.x + 360, y: w.y + 250, L: 420, calf: true, dir: -1, pitch: 0.04, ph: t * 2.4, amp: 0.06, t,
    amb: C('#34506e'), rim: [120, 255, 230], rimA: 0.3 * g, glow: g * 0.75, alpha: 0.92,
  });
  drawWhale({
    x: w.x, y: w.y, L: SONG_L, dir: -1, pitch: 0.02 + Math.sin(t * 0.5) * 0.02, ph: t * 1.3, amp: 0.035, t,
    amb: C('#43618a'), rim: [120, 255, 230], rimA: 0.25 + 0.25 * g, glow: g,
  });
  drawParticles(U, t, 1);
  drawParticles(U, t, 2);
}

// The glow: the whales light a path; the boat follows; the lighthouse shines again.
const GLOW_D = 0.415;
function adultPath(tau) {
  if (tau < 130.5) {
    const p = clamp((tau - 120.6) / 9.9);
    const x = lerp(90, 1480, p * 0.55 + ease.sine(p) * 0.45);
    const d = GLOW_D + 0.035 * sstep(0.62, 1, p);
    return { x, d };
  }
  const a = (tau - 130.5) * 0.5;
  return { x: 1480 + Math.sin(a) * 80, d: GLOW_D + 0.035 + (1 - Math.cos(a)) * 0.015 };
}
function calfPath(tau) {
  const p = adultPath(tau - 0.8);
  return { x: p.x - 16, d: p.d + 0.03 };
}
function shotGlow(t) {
  const clear = sstep(124, 133, t);
  const L = mixv(LOOK.fog, LOOK.glow, clear);
  L.fogVeil = LOOK.fog.fogVeil * (1 - clear) * 0.8;
  L.fogBank = LOOK.fog.fogBank * (1 - clear);
  L.seaGlow = sstep(121.5, 126, t);
  L.towerGlow = sstep(125, 130.5, t);
  L.lanternGlow = sstep(127.4, 129.2, t);
  L.stars = sstep(126, 136, t);
  L.milky = sstep(128, 138, t);
  const tNow = Math.min(t, 142);
  const aNow = adultPath(tNow);
  L.rockGlow = bump(122.8, 123.8, 127.5, 130, t);
  const tail0 = adultPath(Math.max(121, tNow - 16)).x;
  L.glowField = (x, d) => {
    let f = 0.06 + 0.2 * sstep(128, 134, t);
    const along = sstep(tail0 - 120, tail0 + 60, x) * (1 - sstep(aNow.x + 40, aNow.x + 220, x));
    f += along * Math.exp(-(((d - GLOW_D) / 0.08) ** 2)) * 0.85;
    f += Math.exp(-(((x - aNow.x) / 200) ** 2) - (((d - aNow.d) / 0.1) ** 2)) * 1.1;
    f += L.rockGlow * Math.exp(-(((x - 915) / 120) ** 2) - (((d - 0.37) / 0.05) ** 2)) * 0.8;
    return f;
  };
  const cam = kf(t, [
    [121, { x: 900, y: 505, z: 1.22 }],
    [126, { x: 960, y: 500, z: 1.18 }, ease.sine],
    [133, { x: 980, y: 452, z: 1.02 }, ease.sine],
    [139, { x: 970, y: 380, z: 0.96 }, ease.sine],
    [146, { x: 960, y: 70, z: 0.83 }, ease.sine],
    [150, { x: 960, y: 40, z: 0.82 }],
  ]);
  const trail = (fn, lift) => (tau) => {
    const p = fn(Math.max(121, tau));
    return [p.x, surfY(L, p.x, p.d, tau) + lift, dscale(p.d)];
  };
  const whaleIns = (fn, calf, Lw0, seed) => {
    const p = fn(t);
    return {
      d: p.d, cover: 0.68, fn: () => {
        const Lw = Lw0 * dscale(p.d);
        const porp = Math.sin(t * 1.25 + seed);
        const nx = fn(t + 0.1).x;
        const dir = nx >= p.x - 0.5 ? 1 : -1;
        const w = whaleAtSurface(p.x, p.d, t, Lw, {
          calf, dir, pitch: porp * 0.07, ph: t * 1.8 + seed, amp: 0.05, sink: -0.005 - porp * 0.022,
          glow: 1, rim: [120, 255, 230], rimA: 0.5, amb: add(L.amb, [60, 200, 190], 0.25),
        }, L);
        // blows and rings stay where they were made while the whale swims on; the blows happen in
        // open water left of the reef so they never rise in front of the cottage or the tower
        const at = (t0) => {
          const q = fn(t0);
          const x = w.blow[0] + q.x - p.x;
          return [x, surfY(L, x, q.d, t)];
        };
        const sT = calf ? 125.3 : 124.4;
        const [sx, sy] = at(sT);
        drawSpout(sx, sy - 2, sT, t, dscale(p.d) * (calf ? 0.27 : 0.34), 0.9, 1);
        for (const rT of calf ? [124.2, 129.9] : [123.4, 129.1]) {
          const [rx, ry] = at(rT);
          drawRipple(rx, ry, rT, t, dscale(p.d), rT > 128 ? 0.6 : 0.7);
        }
      },
    };
  };
  island(L, t, cam, {
    lights: [{ x: boatPath(t).x + 25, d: boatPath(t).d, c: [255, 200, 130], a: 0.6, sp: 22, seed: 9, n: 7 }],
    inserts: [
      whaleIns(adultPath, false, 250, 0),
      whaleIns(calfPath, true, 175, 1.7),
      { d: boatPath(t).d, fn: () => drawBoatAt(L, t) },
    ],
    afterSea: () => {
      drawGlowTrail(trail(adultPath, 2), t, 121, 16, 1, 0.9, 3, 46);
      drawGlowTrail(trail(calfPath, 2), t, 121.9, 14, 0.8, 0.8, 5, 36);
    },
  });
}

// ---------------------------------------------------------------- table
export const SHOTS = [
  { id: 'open', t0: 0, t1: 31, draw: shotOpen },
  { id: 'deep', t0: 31, t1: 43, draw: shotDeep },
  { id: 'gallery', t0: 43, t1: 49.5, draw: shotGallery },
  { id: 'rescue', t0: 49.5, t1: 60, draw: shotRescue },
  { id: 'dawn', t0: 60, t1: 64.5, draw: shotDawnWide },
  { id: 'flute', t0: 64.5, t1: 78, draw: shotDawnClose },
  { id: 'farewell', t0: 78, t1: 87, draw: shotDawnFarewell },
  { id: 'years', t0: 87, t1: 92, draw: shotYears, dissolve: 1.2 },
  { id: 'old', t0: 92, t1: 97.5, draw: shotOld, dissolve: 1.0 },
  { id: 'window', t0: 97.5, t1: 100.5, draw: shotWindow, dissolve: 1.0 },
  { id: 'dark', t0: 100.5, t1: 103.5, draw: shotDark },
  { id: 'fog', t0: 103.5, t1: 114.5, draw: shotFog },
  { id: 'song', t0: 114.5, t1: 121, draw: shotSong },
  { id: 'glow', t0: 121, t1: 150, draw: shotGlow },
];

export const CHAPTERS = [
  [0, '夜', 'Night'], [20, '风暴', 'Storm'], [43, '光', 'Light'], [60, '黎明', 'Dawn'],
  [87, '岁月', 'Years'], [103.5, '雾', 'Fog'], [114.5, '歌', 'Song'], [139, '尾声', 'Coda'],
];

export const CAPTIONS = [
  [8.6, 13.4, '在海的尽头，有一座灯塔。', 'At the edge of the sea, there stood a lighthouse.'],
  [14.2, 19.2, '每个夜晚，守灯人都会把它点亮。', 'Every night, its keeper lit the lamp.'],
  [21.0, 26.0, '直到那一夜，风暴来了。', 'Until one night, a storm came.'],
  [32.4, 37.0, '一头小鲸，在风暴里和妈妈走散了。', 'A little whale lost its mother in the storm.'],
  [38.6, 42.6, '黑暗中，它看见了一束光。', 'In the darkness, it saw a light.'],
  [43.8, 48.6, '守灯人，也看见了它。', 'And the keeper saw it, too.'],
  [50.4, 57.2, '他停下旋转的灯，为它照亮一条路。', 'He stopped the turning lamp, and lit a path for it.'],
  [61.0, 64.3, '天亮了，风暴过去了。', 'Dawn came. The storm had passed.'],
  [65.4, 70.4, '守灯人吹起一支老歌。', 'The keeper played an old song.'],
  [72.0, 77.0, '小鲸学着，唱了回去。', 'And the little whale sang it back.'],
  [79.0, 83.4, '远处，妈妈在呼唤它。', 'Far away, its mother was calling.'],
  [88.0, 91.6, '很多年过去了。', 'Many years went by.'],
  [92.8, 97.2, '守灯人老了，却每晚还吹着那支歌。', 'The keeper grew old, but still played the song each night.'],
  [100.8, 103.3, '后来，灯塔熄灭了。', 'Then one winter, the lighthouse went dark.'],
  [105.0, 109.2, '一个起雾的夜晚，一艘小船迷了路。', 'One foggy night, a small boat lost its way.'],
  [110.0, 113.8, '没有灯塔，也没有光。', 'No lighthouse. No light.'],
  [115.6, 120.2, '这时，海里传来一支熟悉的歌。', 'Then a familiar song rose from the sea.'],
  [122.0, 126.2, '它一直记得那束光。', 'It had always remembered the light.'],
  [127.6, 132.4, '于是这一次，它成了光。', 'So this time, it became the light.'],
];

// Black overlay keyframes (fade in/out, fades through black).
export function blackAt(t) {
  return Math.max(
    1 - sstep(0.2, 2.8, t),
    bump(59.2, 59.95, 60.05, 61.0, t),
    bump(103.0, 103.45, 103.55, 104.4, t),
    bump(114.2, 114.45, 114.55, 115.0, t) * 0.8,
    sstep(146.4, 149.8, t) * 0.5,
  );
}

export function shotIndex(t) {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].t0) return i;
  return 0;
}

export const TITLE = { in0: 1.4, in1: 3.6, out0: 6.6, out1: 8.2 };
export const END = { title: 139.6, line: 142.2, fin: 145.4 };
export { flashAt };

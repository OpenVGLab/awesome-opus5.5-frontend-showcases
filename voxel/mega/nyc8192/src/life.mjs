// Dynamic actors: paths (world metres), speeds (m/s), dwell times, activity zones -> life/actors.json
//   node --max-old-space-size=4000 src/life.mjs     (rebuilds the terrain maps, ~20 s)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { W, SEA, ll, mg, AVE, GRID_N, GRID_E, bearingXZ } from './frame.mjs';
import { mulberry } from './raster.mjs';
import { bridgeSpecs, deckProfile } from './bridges.mjs';
import { CP } from './cp.mjs';
import { WEST_ST, FDR } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../life/actors.json');

export function buildLife(maps) {
  const rnd = mulberry(20260924);
  const paths = [], actors = [], zones = [];
  const gy = (x, z) => { const xi = Math.round(x), zi = Math.round(z); if (xi < 0 || zi < 0 || xi >= W || zi >= W) return SEA; const i = zi * W + xi; return maps.zone[i] && maps.zone[i] !== 7 ? SEA + maps.elev[i] : maps.zone[i] === 7 ? SEA + 2 : SEA; };
  // densify a 2D polyline, attach smoothed ground heights (+dy)
  function ground(pts2, { closed = false, step = 6, dy = 0, smoothM = 24 } = {}) {
    const P = closed ? [...pts2, pts2[0]] : pts2;
    const dense = [];
    for (let i = 0; i + 1 < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) { const t = k / n; dense.push([ax + (bx - ax) * t, az + (bz - az) * t]); }
    }
    if (!closed) dense.push(P[P.length - 1]);
    const hs = dense.map(([x, z]) => gy(x, z));
    const r = Math.max(1, Math.round(smoothM / step / 2));
    const out = dense.map(([x, z], i) => {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) { let j = i + k; if (closed) j = (j + dense.length) % dense.length; else j = Math.max(0, Math.min(dense.length - 1, j)); s += hs[j]; c++; }
      return [+x.toFixed(2), +(s / c + dy).toFixed(2), +z.toFixed(2)];
    });
    return out;
  }
  const addPath = (pts, closed, extra = {}) => { paths.push({ id: paths.length, closed, pts, ...extra }); return paths.length - 1; };
  const zone = (id, name, view) => { zones.push({ id, name, view, count: 0 }); return id; };
  const actor = (type, p, o, v, z, extra = {}) => { actors.push({ t: type, p, o: +o.toFixed(1), v: +v.toFixed(2), z, ...extra }); zones.find((q) => q.id === z).count++; };
  const pathLen = (pts, closed) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]); if (closed) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][2] - pts[pts.length - 1][2]); return L; };
  const G = (e, n) => mg(e, n);
  const view = (x, y, z, dist, az, el) => ({ target: [+x.toFixed(1), y, +z.toFixed(1)], dist, az, el });
  const gn = Math.atan2(GRID_N[0], -GRID_N[1]) * 180 / Math.PI;
  const CARS = ['car', 'car', 'taxi', 'taxi', 'taxi', 'car', 'suv', 'taxi', 'car', 'van'];
  const fleet = (p, n, zid, speed, lanes, kinds = CARS, busEvery = 0) => {
    const L = pathLen(paths[p].pts, paths[p].closed);
    for (let k = 0; k < n; k++) {
      const kind = busEvery && k % busEvery === 0 ? 'bus' : kinds[Math.floor(rnd() * kinds.length)];
      actor(kind, p, (k + rnd() * 0.4) * L / n, speed * (0.95 + rnd() * 0.1), zid, { lane: lanes[k % lanes.length], c: Math.floor(rnd() * 8) });
    }
  };
  const walkers = (p, n, zid, speed = 1.35, lanes = [0], kinds = ['walker']) => {
    const L = pathLen(paths[p].pts, paths[p].closed);
    for (let k = 0; k < n; k++) actor(kinds[k % kinds.length], p, rnd() * L, speed * (0.85 + rnd() * 0.3), zid, { lane: lanes[Math.floor(rnd() * lanes.length)] + (rnd() - 0.5) * 0.8, c: Math.floor(rnd() * 12) });
  };

  // ------------------------------------------------------------------ Times Square
  {
    const c = G(-615, 45.4); zone('times', '时代广场', view(c[0], SEA + 18, c[1], 330, -gn + 4, 64));
    // 7th Ave (southbound) + 8th Ave (northbound) loop, 40th..50th
    const loop = [G(AVE.seventh - 3, 50), G(AVE.seventh - 3, 40), G(AVE.eighth + 3, 40), G(AVE.eighth + 3, 50)];
    const p = addPath(ground(loop, { closed: true }), true);
    fleet(p, 28, 'times', 9, [0, -3.3, 3.3], ['taxi', 'taxi', 'taxi', 'car', 'taxi', 'suv', 'taxi'], 9);
    // pedestrians wandering the Broadway plazas (42nd..47th)
    const bway = (n) => { const t = (n - 34.6) / (45.2 - 34.6); return -305 + (-610 + 305) * Math.min(1, Math.max(0, t)) + (n > 45.2 ? (-878 + 610) * (n - 45.2) / 13.8 : 0); };
    for (let k = 0; k < 44; k++) {
      const wp = [];
      for (let j = 0; j < 5; j++) { const n = 42.4 + rnd() * 4.5; wp.push(G(bway(n) + (rnd() - 0.5) * 16, n)); }
      const pp = addPath(ground(wp, { closed: true, step: 3, dy: 0 }), true);
      actor(k % 9 === 0 ? 'walker_bag' : 'walker', pp, rnd() * 100, 1.2 + rnd() * 0.4, 'times', { c: Math.floor(rnd() * 12) });
    }
  }
  // ------------------------------------------------------------------ Fifth Avenue / Rockefeller Center
  {
    const c = G(-10, 50); zone('fifth', '第五大道 · 洛克菲勒中心', view(c[0], SEA + 25, c[1], 230, -gn - 60, 30));
    const loop = [G(-2, 57.2), G(-2, 45.6), G(AVE.madison + 2, 45.6), G(AVE.madison + 2, 57.2)];
    const p = addPath(ground(loop, { closed: true }), true);
    fleet(p, 34, 'fifth', 8.5, [0, -3.2, 3.2, -6], CARS, 7);
    // sidewalk pedestrians on both sides of 5th Ave
    for (const side of [-1, 1]) {
      const pts = [G(side * 13, 48), G(side * 13, 52.5)];
      const pp = addPath(ground(pts, { step: 5 }), false, { pingpong: true });
      walkers(pp, 14, 'fifth', 1.35, [0, 1.2, -1.2]);
    }
  }
  // ------------------------------------------------------------------ Park Avenue
  {
    const c = G(AVE.park, 52); zone('park', '公园大道', view(c[0], SEA + 25, c[1], 260, -gn + 70, 30));
    const loop = [G(AVE.park + 11, 46.9), G(AVE.park + 11, 57.6), G(AVE.park - 11, 57.6), G(AVE.park - 11, 46.9)];
    const p = addPath(ground(loop, { closed: true }), true);
    fleet(p, 22, 'park', 10, [-2, 2], CARS);
  }
  // ------------------------------------------------------------------ Bridges
  const specs = bridgeSpecs(maps);
  for (const sp of specs) {
    const f = deckProfile(maps, sp);
    const [ax, az] = sp.A, [bx, bz] = sp.B, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, vx = -uz, vz = ux;
    const P = (s, v, dy) => [+(ax + ux * s + vx * v).toFixed(2), +(f(s) + dy).toFixed(2), +(az + uz * s + vz * v).toFixed(2)];
    const lineAt = (v, dy, s0 = 0, s1 = L, step = 8) => { const o = []; for (let s = s0; s <= s1; s += step) o.push(P(s, v, dy)); return o; };
    const mid = P((sp.sT1 + sp.sT2) / 2, 0, 0);
    const baz = Math.atan2(-uz, ux) * 180 / Math.PI;
    if (sp.name === 'Brooklyn Bridge') {
      const tw = P(sp.sT2 - 130, 0, 6);
      zone('bkbridge', '布鲁克林大桥（步道 · 车道）', view(tw[0], tw[1], tw[2], 95, Math.atan2(-vx, -vz) * 180 / Math.PI + 35, 34));
      // roadway loop (both carriageways), promenade both directions
      const road = [...lineAt(-7.5, 1), ...lineAt(7.5, 1).reverse()];
      const p = addPath(road, true); fleet(p, 30, 'bkbridge', 11, [0, 3.2], ['car', 'taxi', 'suv', 'car', 'van']);
      const prom = [...lineAt(-1.2, 6, sp.sA1 - 150, sp.sA2 + 150, 6), ...lineAt(1.2, 6, sp.sA1 - 150, sp.sA2 + 150, 6).reverse()];
      const pp = addPath(prom, true);
      walkers(pp, 34, 'bkbridge', 1.35, [0, 0.6, -0.6], ['walker', 'walker', 'walker_bag', 'walker', 'tourist']);
      const Lp = pathLen(prom, true);
      for (let k = 0; k < 10; k++) actor('cyclist', pp, rnd() * Lp, 5 + rnd() * 1.5, 'bkbridge', { lane: 0.4, c: Math.floor(rnd() * 8) });
    } else if (sp.name === 'Manhattan Bridge') {
      zone('mbridge', '曼哈顿大桥 · 地铁', view(mid[0], mid[1], mid[2], 260, baz - 30, 20));
      const road = [...lineAt(-15, 7), ...lineAt(15, 7).reverse()];
      const p = addPath(road, true); fleet(p, 18, 'mbridge', 12, [0, 3], ['car', 'truck', 'car', 'taxi', 'suv']);
      const track = [...lineAt(-3, -5), ...lineAt(3, -5).reverse()];
      const pt = addPath(track, true);
      const Lt = pathLen(track, true);
      for (let k = 0; k < 2; k++) actor('subway', pt, k * Lt / 2, 13, 'mbridge', { cars: 8, c: k });
    } else {
      zone('wbridge', '威廉斯堡大桥', view(mid[0], mid[1], mid[2], 280, baz + 35, 22));
      const road = [...lineAt(-13, 1), ...lineAt(13, 1).reverse()];
      const p = addPath(road, true); fleet(p, 16, 'wbridge', 12, [0, 3], ['car', 'car', 'truck', 'taxi', 'suv']);
      const track = [...lineAt(-2.5, 1), ...lineAt(2.5, 1).reverse()];
      const pt = addPath(track, true);
      actor('subway', pt, 0, 12, 'wbridge', { cars: 8, c: 2 });
    }
  }
  // ------------------------------------------------------------------ Central Park
  {
    const c = G(-470, 64.5); zone('cp', '中央公园（马车 · 骑行 · 遛狗）', view(c[0], SEA + 30, c[1], 240, gn + 180 - 20, 34));
    // the loop drive through the south of the park: West Drive -> south connector -> Center Drive -> East Drive
    const loop = [G(-790, 68.5), G(-805, 64), G(-765, 62.6), G(-700, 61.5), G(-610, 61.55), G(-520, 61.8), G(-452, 62.6), G(-470, 63.5),
      G(-448, 64.6), G(-405, 65.0), G(-330, 64.7), G(-255, 64.5), G(-250, 65.5), G(-242, 67.0), G(-238, 69.0), G(-235, 71.2), G(-330, 71.8), G(-450, 71.97),
      G(-560, 72.05), G(-650, 72.3), G(-790, 72.1)];
    const p = addPath(ground(loop, { closed: true, step: 4 }), true);
    const L = pathLen(paths[p].pts, true);
    for (let k = 0; k < 7; k++) actor('carriage', p, k * L / 7, 3.2, 'cp', { lane: 2.5, c: k });
    for (let k = 0; k < 14; k++) actor('cyclist', p, rnd() * L, 6 + rnd() * 2, 'cp', { lane: -2.5 + rnd(), c: Math.floor(rnd() * 8) });
    for (let k = 0; k < 16; k++) actor('jogger', p, rnd() * L, 2.8 + rnd() * 0.6, 'cp', { lane: -4 + rnd(), c: Math.floor(rnd() * 12) });
    // paths: dog walkers and strollers
    for (const pth of CP.paths.slice(0, 6)) {
      const pp = addPath(ground(pth, { step: 3 }), false, { pingpong: true });
      const Lp = pathLen(paths[pp].pts, false);
      for (let k = 0; k < 3; k++) {
        const o = rnd() * Lp, col = Math.floor(rnd() * 12);
        actor('walker', pp, o, 1.2, 'cp', { lane: 0.5, c: col });
        actor('dog', pp, o + 1.6, 1.2, 'cp', { lane: -0.6, c: Math.floor(rnd() * 5) });
      }
      walkers(pp, 3, 'cp', 1.25, [0, 1]);
    }
    // pigeons over the Sheep Meadow
    const sm = G(-600, 67.6);
    for (let k = 0; k < 2; k++) {
      const ring = []; for (let j = 0; j < 24; j++) { const a = j / 24 * Math.PI * 2; ring.push([sm[0] + Math.cos(a) * (90 + k * 40), SEA + 45 + k * 15 + Math.sin(a * 3) * 6, sm[1] + Math.sin(a) * (70 + k * 30)]); }
      const pb = addPath(ring, true);
      for (let j = 0; j < 9; j++) actor('bird', pb, j * 6 + rnd() * 3, 9, 'cp', { lane: (rnd() - 0.5) * 8, c: k });
    }
  }
  // ------------------------------------------------------------------ Hudson River
  const water = (lls, y = SEA) => lls.map(([la, lo]) => { const [x, z] = ll(la, lo); return [+x.toFixed(1), y, +z.toFixed(1)]; });
  {
    const c = ll(40.7300, -74.0200); zone('hudson', '哈德逊河（渡轮 · 帆船）', view(c[0], SEA, c[1], 700, -gn - 90, 26));
    // NY Waterway: Hoboken Terminal <-> Brookfield Place, with dwell at both docks
    const f1 = addPath(water([[40.7345, -74.0262], [40.7300, -74.0230], [40.7200, -74.0200], [40.7150, -74.0192], [40.7200, -74.0205], [40.7300, -74.0240]]), true, { dwell: [[0, 40], [3, 40]] });
    actor('ferry_nyw', f1, 0, 7, 'hudson'); actor('ferry_nyw', f1, 900, 7, 'hudson');
    const f2 = addPath(water([[40.7165, -74.0300], [40.7170, -74.0250], [40.7160, -74.0195], [40.7168, -74.0250]]), true, { dwell: [[0, 45], [2, 45]] });
    actor('ferry_nyw', f2, 0, 6, 'hudson');
    const f3 = addPath(water([[40.7560, -74.0215], [40.7590, -74.0120], [40.7598, -74.0065], [40.7585, -74.0130]]), true, { dwell: [[0, 40], [2, 40]] });
    actor('ferry_nyw', f3, 0, 7, 'hudson');
    // Circle Line cruise loop up and down the river
    const cl = addPath(water([[40.7630, -74.0060], [40.7400, -74.0170], [40.7150, -74.0225], [40.7050, -74.0260], [40.7100, -74.0270], [40.7350, -74.0215], [40.7600, -74.0100]]), true);
    actor('cruise', cl, 0, 6, 'hudson'); actor('cruise', cl, 2500, 6, 'hudson');
    // sailboats tacking mid-river
    for (let k = 0; k < 6; k++) {
      const la = 40.712 + k * 0.007, lo = -74.022 + (k % 2) * 0.002;
      const sb = addPath(water([[la, lo], [la + 0.003, lo + 0.004], [la + 0.006, lo], [la + 0.003, lo - 0.004]]), true);
      actor('sailboat', sb, rnd() * 800, 3 + rnd(), 'hudson', { c: k });
    }
    const tg = addPath(water([[40.7700, -74.0080], [40.7050, -74.0240], [40.7700, -74.0100]]), true);
    actor('tug', tg, 0, 3.5, 'hudson', { barge: 1 });
  }
  // ------------------------------------------------------------------ East River
  {
    const c = ll(40.7120, -73.9790); zone('east', '东河（渡轮 · 水上出租车）', view(c[0], SEA, c[1], 650, -gn + 120, 26));
    const nyc = addPath(water([[40.7033, -74.0060], [40.7040, -74.0010], [40.7045, -73.9960], [40.7080, -73.9830], [40.7140, -73.9720], [40.7210, -73.9670], [40.7300, -73.9650], [40.7420, -73.9660], [40.7480, -73.9630],
      [40.7420, -73.9670], [40.7300, -73.9670], [40.7200, -73.9690], [40.7130, -73.9740], [40.7070, -73.9870], [40.7040, -73.9985]]), true, { dwell: [[0, 30], [3, 25], [6, 20], [8, 25]] });
    for (let k = 0; k < 4; k++) actor('ferry_nyc', nyc, k * 2100, 9, 'east');
    const wt = addPath(water([[40.7030, -74.0080], [40.7000, -74.0020], [40.7015, -73.9985], [40.7050, -73.9960], [40.7030, -74.0030]]), true, { dwell: [[0, 30], [3, 30]] });
    actor('water_taxi', wt, 0, 6, 'east'); actor('water_taxi', wt, 700, 6, 'east');
    const tb = addPath(water([[40.7000, -74.0050], [40.7080, -73.9850], [40.7200, -73.9680], [40.7400, -73.9660], [40.7200, -73.9700], [40.7080, -73.9880]]), true);
    actor('tug', tb, 0, 3, 'east', { barge: 1 });
    const sp = addPath(water([[40.7150, -73.9700], [40.7260, -73.9660], [40.7350, -73.9650], [40.7260, -73.9670]]), true);
    actor('speedboat', sp, 0, 12, 'east'); actor('speedboat', sp, 500, 12, 'east');
  }
  // ------------------------------------------------------------------ Harbor: Staten Island Ferry, Governors Island
  {
    const c = ll(40.6960, -74.0150); zone('harbor', '纽约港 · 总督岛', view(c[0], SEA, c[1], 1100, -gn - 40, 28));
    const si = addPath(water([[40.7000, -74.0135], [40.6960, -74.0160], [40.6880, -74.0290], [40.6820, -74.0350], [40.6700, -74.0450], [40.6820, -74.0380], [40.6900, -74.0280], [40.6970, -74.0170]]), true, { dwell: [[0, 60]] });
    actor('ferry_si', si, 0, 8, 'harbor'); actor('ferry_si', si, 2400, 8, 'harbor');
    const gi = addPath(water([[40.7010, -74.0118], [40.6975, -74.0130], [40.6937, -74.0150], [40.6975, -74.0142]]), true, { dwell: [[0, 40], [2, 40]] });
    actor('ferry_gov', gi, 0, 5, 'harbor');
    const cargo = addPath(water([[40.6750, -74.0420], [40.6860, -74.0300], [40.6990, -74.0230], [40.6860, -74.0320]]), true);
    actor('cargo', cargo, 0, 3, 'harbor');
    // cyclists on the Governors Island promenade
    const giLoop = [[40.6928, -74.0147], [40.6912, -74.0112], [40.6874, -74.0120], [40.6852, -74.0150], [40.6838, -74.0228], [40.6866, -74.0233], [40.6906, -74.0195], [40.6928, -74.0180]];
    const pg = addPath(ground(giLoop.map(([a, b]) => ll(a, b)), { closed: true, step: 4 }), true);
    const Lg = pathLen(paths[pg].pts, true);
    for (let k = 0; k < 10; k++) actor('cyclist', pg, rnd() * Lg, 4.5 + rnd() * 1.5, 'harbor', { lane: -6 + rnd() * 2, c: Math.floor(rnd() * 8) });
    for (let k = 0; k < 6; k++) actor('walker', pg, rnd() * Lg, 1.3, 'harbor', { lane: -9 + rnd(), c: Math.floor(rnd() * 12) });
    const gull = ll(40.6950, -74.0200);
    const ring = []; for (let j = 0; j < 24; j++) { const a = j / 24 * Math.PI * 2; ring.push([gull[0] + Math.cos(a) * 160, SEA + 30 + Math.sin(a * 2) * 8, gull[1] + Math.sin(a) * 110]); }
    const pb = addPath(ring, true);
    for (let j = 0; j < 8; j++) actor('gull', pb, j * 9, 10, 'harbor', { lane: (rnd() - 0.5) * 10 });
  }
  // ------------------------------------------------------------------ Downtown Manhattan Heliport
  {
    const pad = ll(40.70085, -74.00905); zone('heli', '下城直升机场', view(pad[0], SEA + 10, pad[1], 380, -gn + 150, 24));
    const [px, pz] = pad, y0 = SEA + 3;
    const P = (la, lo, y) => { const [x, z] = ll(la, lo); return [+x.toFixed(1), y, +z.toFixed(1)]; };
    const tour = [[px, y0, pz], [px, y0 + 30, pz], P(40.6990, -74.0140, SEA + 120), P(40.6930, -74.0400, SEA + 260), P(40.7200, -74.0240, SEA + 300),
      P(40.7600, -74.0120, SEA + 320), P(40.7700, -74.0080, SEA + 300), P(40.7500, -74.0180, SEA + 280), P(40.7150, -74.0260, SEA + 220), P(40.7000, -74.0170, SEA + 90), [px, y0 + 25, pz], [px, y0, pz]];
    const ht = addPath(tour, true, { dwell: [[0, 45]] });
    for (let k = 0; k < 3; k++) actor('heli', ht, k * 3200, 38, 'heli', { c: k });
    const hop = [[px + 20, y0, pz + 15], [px + 20, y0 + 40, pz + 15], P(40.7050, -73.9950, SEA + 150), P(40.7250, -73.9700, SEA + 180), P(40.7150, -73.9800, SEA + 150), [px + 20, y0 + 30, pz + 15], [px + 20, y0, pz + 15]];
    const hh = addPath(hop, true, { dwell: [[0, 60]] });
    actor('heli', hh, 0, 30, 'heli', { c: 3 });
  }
  // ------------------------------------------------------------------ Hudson River Greenway + West Side Highway + FDR
  {
    const c = ll(40.7420, -74.0082); zone('greenway', '哈德逊河绿道 · 西侧高速', view(c[0], SEA + 5, c[1], 220, -gn - 120, 28));
    const west = WEST_ST.slice(1, 15);
    const gw = addPath(ground(west.map(([x, z]) => [x - 18 * 0.92, z - 18 * 0.38]), { step: 6 }), false, { pingpong: true });
    const Lw = pathLen(paths[gw].pts, false);
    for (let k = 0; k < 16; k++) actor('cyclist', gw, rnd() * Lw, 5 + rnd() * 2, 'greenway', { lane: (rnd() - 0.5) * 2, c: Math.floor(rnd() * 8) });
    for (let k = 0; k < 10; k++) actor('jogger', gw, rnd() * Lw, 2.8 + rnd() * 0.5, 'greenway', { lane: 2 + rnd(), c: Math.floor(rnd() * 12) });
    const hw = addPath(ground(west, { step: 8 }), false, { pingpong: true, road: 1 });
    const Lh = pathLen(paths[hw].pts, false);
    for (let k = 0; k < 44; k++) actor(CARS[k % CARS.length], hw, rnd() * Lh, 14 + rnd() * 3, 'greenway', { lane: 3 + (k % 3) * 3.3, c: Math.floor(rnd() * 8) });
    const fdr = addPath(ground(FDR, { step: 8 }), false, { pingpong: true, road: 1 });
    const Lf = pathLen(paths[fdr].pts, false);
    for (let k = 0; k < 34; k++) actor(CARS[k % CARS.length], fdr, rnd() * Lf, 15 + rnd() * 3, 'greenway', { lane: 2 + (k % 2) * 3.3, c: Math.floor(rnd() * 8) });
  }
  // ------------------------------------------------------------------ Brooklyn Bridge Park / DUMBO
  {
    const c = ll(40.7010, -73.9975); zone('dumbo', '布鲁克林大桥公园 · DUMBO', view(c[0], SEA + 5, c[1], 260, -gn + 170, 30));
    const prom = [[40.6925, -74.0000], [40.6960, -73.9990], [40.6995, -73.9982], [40.7020, -73.9962], [40.7035, -73.9935], [40.7040, -73.9895]];
    const pp = addPath(ground(prom.map(([a, b]) => ll(a, b)), { step: 4 }), false, { pingpong: true });
    walkers(pp, 20, 'dumbo', 1.3, [-2, 0, 2], ['walker', 'walker_bag', 'tourist', 'walker']);
    const Lp = pathLen(paths[pp].pts, false);
    for (let k = 0; k < 5; k++) { const o = rnd() * Lp; actor('walker', pp, o, 1.1, 'dumbo', { lane: 3, c: Math.floor(rnd() * 12) }); actor('dog', pp, o + 1.5, 1.1, 'dumbo', { lane: 2, c: Math.floor(rnd() * 5) }); }
  }
  // ------------------------------------------------------------------ Wall Street
  {
    const c = ll(40.7068, -74.0098); zone('wall', '华尔街', view(c[0], SEA + 15, c[1], 170, -gn + 60, 38));
    const wall = [[40.7074, -74.0115], [40.7065, -74.0090], [40.7057, -74.0068], [40.7045, -74.0045]];
    const broad = [[40.7045, -74.0105], [40.7068, -74.0106]];
    for (const [pts, n] of [[wall, 18], [broad, 10]]) {
      const pp = addPath(ground(pts.map(([a, b]) => ll(a, b)), { step: 3 }), false, { pingpong: true });
      walkers(pp, n, 'wall', 1.4, [-2.5, 0, 2.5], ['walker', 'walker_suit', 'walker_bag', 'tourist']);
    }
  }
  // ------------------------------------------------------------------ Hoboken / Jersey City waterfront walkway
  {
    const c = ll(40.7370, -74.0275); zone('nj', '霍博肯 · 泽西城滨水步道', view(c[0], SEA + 5, c[1], 260, -gn + 110, 28));
    const walk = [[40.7150, -74.0322], [40.7200, -74.0325], [40.7265, -74.0318], [40.7322, -74.0300], [40.7372, -74.0272], [40.7425, -74.0262], [40.7490, -74.0250]];
    const pp = addPath(ground(walk.map(([a, b]) => ll(a, b)), { step: 5 }), false, { pingpong: true });
    walkers(pp, 14, 'nj', 1.3, [-1, 1]);
    const Lp = pathLen(paths[pp].pts, false);
    for (let k = 0; k < 6; k++) actor('cyclist', pp, rnd() * Lp, 4.5, 'nj', { lane: 3, c: Math.floor(rnd() * 8) });
  }
  const bad = actors.filter((a) => !paths[a.p]);
  if (bad.length) throw new Error('actor with bad path');
  return {
    version: 1,
    note: 'Paths in canvas metres (x east-ish, y up, z south-ish; 1 unit = 1 m = 1 voxel). Actors move along path p starting at arc offset o (m) with speed v (m/s), lateral lane offset (m, + = right of travel). closed paths loop; pingpong paths reverse; dwell = [[vertexIndex, seconds]].',
    counts: { actors: actors.length, zones: zones.length, byType: actors.reduce((m, a) => { m[a.t] = (m[a.t] || 0) + 1; return m; }, {}) },
    zones, paths, actors,
  };
}

if (process.argv[1] && process.argv[1].endsWith('life.mjs')) {
  const { buildMaps } = await import('./maps.mjs');
  const m = buildMaps(() => {});
  const life = buildLife(m);
  fs.writeFileSync(OUT, JSON.stringify(life));
  console.log(`actors ${life.actors.length}, zones ${life.zones.length}, paths ${life.paths.length}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
  console.log(JSON.stringify(life.counts.byType));
}
void bearingXZ; void GRID_E;

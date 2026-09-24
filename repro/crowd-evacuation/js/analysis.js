// Jam detection: splats the crowd onto a 0.5 m grid every frame, derives density,
// slowdown and congestion, and accumulates "person-seconds stuck" per cell.
import { CELL, HCELL, HW, HH, HN, DANGER, clamp01, blur3, rectDist } from './core.js';

export function resetAnalysis(sim) {
  if (!sim.hDens) {
    const h = () => new Float32Array(HN);
    sim.hDens = h(); sim.hCong = h(); sim.hSpd = h(); sim.hPress = h(); sim.hDelay = h(); sim.hDelayView = h(); sim.hCongView = h();
    sim._hW = h(); sim._hS = h(); sim._hV = h(); sim._hP = h(); sim._tmp = h();
    sim._lab = new Uint8Array(HN); sim._stack = new Int32Array(HN);
    sim._spotId = 0;
  }
  for (const a of [sim.hDens, sim.hCong, sim.hSpd, sim.hPress, sim.hDelay, sim.hDelayView, sim.hCongView]) a.fill(0);
  sim.delayViewMax = 0;
  sim.samples = [{ t: 0, evac: 0, total: sim.n, flow: 0 }];
  sim.stuckTotal = 0; sim.peakDensity = 0; sim.peakPressure = 0; sim.curMaxDensity = 0;
  sim.stuckCount = 0; sim.dangerCount = 0; sim.trappedCount = 0; sim.flow = 0;
  sim.hotspots = []; sim.ghosts = []; sim.jamPins = [];
  sim._hotT = 0; sim._sampleT = 0; sim._viewT = 0; sim._stallT = 0; sim._flowPtr = 0;
}

export function analyze(sim, dt) {
  const n = sim.n, a1 = 1 - Math.exp(-dt / 0.8), a2 = 1 - Math.exp(-dt / 0.4);
  const { x, y, vx, vy, ex, ey, vf, spd, prog, press, pressS, delay, tgt } = sim;
  const hw = sim._hW, hs = sim._hS, hv = sim._hV, hp = sim._hP, hd = sim.hDelay;
  hw.fill(0); hs.fill(0); hv.fill(0); hp.fill(0);
  let stuck = 0, danger = 0, trapped = 0, maxP = 0;
  const v0 = sim.v0;
  for (let i = 0; i < n; i++) {
    const ux = vx[i], uy = vy[i];
    const sp = Math.sqrt(ux * ux + uy * uy);
    spd[i] += (sp - spd[i]) * a2;
    let pr = (ux * ex[i] + uy * ey[i]) / (v0 * vf[i]);
    pr = pr > 1.2 ? 1.2 : pr < -0.5 ? -0.5 : pr;
    prog[i] += (pr - prog[i]) * a1;
    pressS[i] += (press[i] - pressS[i]) * a2;
    if (pressS[i] > maxP) maxP = pressS[i];
    if (pressS[i] > DANGER) danger++;
    let jam = 0;
    if (tgt[i] < 0) trapped++;
    else {
      jam = clamp01((0.7 - prog[i]) * 2);
      if (spd[i] < 0.15) stuck++;
    }
    const jd = jam * dt;
    delay[i] += jd; sim.stuckTotal += jd;

    const gx = x[i] / HCELL - 0.5, gy = y[i] / HCELL - 0.5;
    let i0 = Math.floor(gx), j0 = Math.floor(gy);
    if (i0 < 0) i0 = 0; else if (i0 > HW - 2) i0 = HW - 2;
    if (j0 < 0) j0 = 0; else if (j0 > HH - 2) j0 = HH - 2;
    const fx = clamp01(gx - i0), fy = clamp01(gy - j0);
    const c = j0 * HW + i0, c2 = c + HW;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const sl = 1 - clamp01(prog[i]), s = spd[i], p = pressS[i];
    hw[c] += w00; hw[c + 1] += w10; hw[c2] += w01; hw[c2 + 1] += w11;
    hs[c] += w00 * sl; hs[c + 1] += w10 * sl; hs[c2] += w01 * sl; hs[c2 + 1] += w11 * sl;
    hv[c] += w00 * s; hv[c + 1] += w10 * s; hv[c2] += w01 * s; hv[c2 + 1] += w11 * s;
    hp[c] += w00 * p; hp[c + 1] += w10 * p; hp[c2] += w01 * p; hp[c2 + 1] += w11 * p;
    if (jd > 0) { hd[c] += w00 * jd; hd[c + 1] += w10 * jd; hd[c2] += w01 * jd; hd[c2 + 1] += w11 * jd; }
  }
  const tmp = sim._tmp;
  blur3(hw, tmp); blur3(hs, tmp); blur3(hv, tmp); blur3(hp, tmp);
  let maxD = 0;
  const inv = 1 / (HCELL * HCELL);
  const { hDens, hCong, hSpd, hPress } = sim;
  for (let c = 0; c < HN; c++) {
    const w = hw[c], dens = w * inv, has = w > 0.04;
    const slow = has ? hs[c] / w : 0;
    const cong = clamp01((dens - 1.2) / 2.8) * clamp01((slow - 0.15) / 0.6);
    hDens[c] += (dens - hDens[c]) * a2;
    hCong[c] += (cong - hCong[c]) * a2;
    hSpd[c] = has ? hv[c] / w : 0;
    hPress[c] += ((has ? hp[c] / w : 0) - hPress[c]) * a2;
    if (hDens[c] > maxD) maxD = hDens[c];
  }
  const cv = sim.hCongView;
  cv.set(hCong);
  blur3(cv, tmp); blur3(cv, tmp);
  sim.curMaxDensity = maxD;
  if (maxD > sim.peakDensity) sim.peakDensity = maxD;
  if (maxP > sim.peakPressure) sim.peakPressure = maxP;
  sim.stuckCount = stuck; sim.dangerCount = danger; sim.trappedCount = trapped;

  const et = sim.evacTimes;
  let q = sim._flowPtr;
  while (q < et.length && et[q] < sim.time - 3) q++;
  sim._flowPtr = q;
  sim.flow = (et.length - q) / Math.min(3, Math.max(0.5, sim.time));

  for (const g of sim.ghosts) { g.x += g.vx * dt * 1.3; g.y += g.vy * dt * 1.3; g.life -= dt * 1.5; }
  if (sim.ghosts.length) sim.ghosts = sim.ghosts.filter((g) => g.life > 0);

  sim._hotT += dt;
  if (sim._hotT >= 0.4) { sim._hotT = 0; findHotspots(sim); }
  sim._viewT += dt;
  if (sim._viewT >= 0.5) { sim._viewT = 0; updateDelayView(sim); }
  sim._sampleT += dt;
  if (sim._sampleT >= 0.5) {
    sim._sampleT -= 0.5;
    sim.samples.push({ t: sim.time, evac: sim.evacuated, total: sim.total, flow: sim.flow });
  }
  if (!sim.complete && n > 0 && trapped === n) {
    sim._stallT += dt;
    if (sim._stallT > 2) sim._finish(true);
  } else sim._stallT = 0;
}

function flood(sim, field, T, T2, visit) {
  const lab = sim._lab, st = sim._stack;
  lab.fill(0);
  for (let c = 0; c < HN; c++) {
    if (field[c] < T || lab[c]) continue;
    const acc = visit.begin();
    let sp = 0;
    st[sp++] = c; lab[c] = 1;
    while (sp) {
      const q = st[--sp], qi = q % HW, qj = (q / HW) | 0;
      visit.cell(acc, q, qi, qj);
      for (let dj = -1; dj <= 1; dj++) {
        const nj = qj + dj;
        if (nj < 0 || nj >= HH) continue;
        for (let di = -1; di <= 1; di++) {
          const ni = qi + di;
          if (ni < 0 || ni >= HW || (!di && !dj)) continue;
          const nq = nj * HW + ni;
          if (!lab[nq] && field[nq] >= T2) { lab[nq] = 1; st[sp++] = nq; }
        }
      }
    }
    visit.end(acc);
  }
}

// The head of a queue (its cell closest to an exit) is where the jam is caused, so it names the jam.
function findHotspots(sim) {
  const C = sim.hCong, D = sim.hDens, spots = [];
  const nd = sim.nearD, gs = Math.round(HCELL / CELL), gw = Math.round(HW * gs);
  flood(sim, C, 0.3, 0.2, {
    begin: () => ({ ppl: 0, ws: 0, sx: 0, sy: 0, pk: 0, x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, fd: Infinity, fx: 0, fy: 0 }),
    cell(a, q, qi, qj) {
      const w = C[q], px = (qi + 0.5) * HCELL, py = (qj + 0.5) * HCELL;
      a.ppl += D[q] * HCELL * HCELL; a.ws += w; a.sx += w * px; a.sy += w * py;
      if (D[q] > a.pk) a.pk = D[q];
      if (px < a.x0) a.x0 = px; if (px > a.x1) a.x1 = px;
      if (py < a.y0) a.y0 = py; if (py > a.y1) a.y1 = py;
      if (w > 0.3) {
        const d = nd[qj * gs * gw + qi * gs];
        if (d < a.fd) { a.fd = d; a.fx = px; a.fy = py; }
      }
    },
    end(a) {
      if (a.ppl < 5) return;
      const hasFront = a.fd < Infinity;
      spots.push({
        x: a.sx / a.ws, y: a.sy / a.ws, ppl: a.ppl, peak: a.pk,
        fx: hasFront ? a.fx : a.sx / a.ws, fy: hasFront ? a.fy : a.sy / a.ws,
        rad: Math.max(1.1, 0.5 * Math.hypot(a.x1 - a.x0, a.y1 - a.y0) + 0.5),
      });
    },
  });
  spots.sort((a, b) => b.ppl - a.ppl);
  spots.length = Math.min(spots.length, 5);
  const prev = sim.hotspots, used = new Set();
  for (const s of spots) {
    let best = null, bd = 3.5;
    for (const p of prev) {
      if (used.has(p.id)) continue;
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) { used.add(best.id); s.id = best.id; s.born = best.born; s.dx = best.dx; s.dy = best.dy; s.drad = best.drad; }
    else { s.id = ++sim._spotId; s.born = sim.time; s.dx = s.x; s.dy = s.y; s.drad = s.rad; }
    s.name = nameAt(sim, s.fx, s.fy);
  }
  sim.hotspots = spots;
}

function updateDelayView(sim) {
  const v = sim.hDelayView;
  v.set(sim.hDelay);
  blur3(v, sim._tmp); blur3(v, sim._tmp);
  let m = 0;
  for (let c = 0; c < HN; c++) if (v[c] > m) m = v[c];
  sim.delayViewMax = m;
  sim.jamPins = delayClusters(sim, 4);
}

// Regions where the most person-seconds were lost, ranked.
export function delayClusters(sim, top) {
  const v = sim.hDelayView, mx = sim.delayViewMax, raw = sim.hDelay, out = [];
  if (mx < 0.2) return out;
  flood(sim, v, mx * 0.2, mx * 0.2, {
    begin: () => ({ sec: 0, pk: 0, pc: 0 }),
    cell(a, q) { a.sec += raw[q]; if (v[q] > a.pk) { a.pk = v[q]; a.pc = q; } },
    end(a) {
      out.push({ x: ((a.pc % HW) + 0.5) * HCELL, y: (((a.pc / HW) | 0) + 0.5) * HCELL, sec: a.sec, peak: a.pk });
    },
  });
  out.sort((a, b) => b.sec - a.sec);
  out.length = Math.min(out.length, top);
  for (const o of out) o.name = nameAt(sim, o.x, o.y);
  return out;
}

export function nameAt(sim, x, y) {
  const inside = (z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
  for (const z of sim.zones) if (z.pri && inside(z)) return z.name;
  let best = null, bd = 2.6;
  for (const e of sim.exits) {
    const d = rectDist(e, x, y);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) return `Exit ${best.label} doorway`;
  for (const z of sim.zones) if (!z.pri && inside(z)) return z.name;
  return `Choke point at ${x.toFixed(0)} m, ${y.toFixed(0)} m`;
}

export function sampleAt(sim, x, y) {
  const i = Math.floor(x / HCELL), j = Math.floor(y / HCELL);
  if (i < 0 || j < 0 || i >= HW || j >= HH) return null;
  const c = j * HW + i;
  let lost = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const ni = i + di, nj = j + dj;
    if (ni >= 0 && nj >= 0 && ni < HW && nj < HH) lost += sim.hDelay[nj * HW + ni];
  }
  return { dens: sim.hDens[c], cong: sim.hCong[c], spd: sim.hSpd[c], press: sim.hPress[c], lost };
}

export function buildReport(sim) {
  updateDelayView(sim);
  const N = sim.total, et = sim.evacTimes;
  const at = (f) => {
    const k = Math.max(0, Math.ceil(f * N) - 1);
    return k < et.length ? et[k] : null;
  };
  return {
    time: sim.time, stalled: sim.stalled, total: N, evacuated: sim.evacuated, trapped: sim.n,
    t50: at(0.5), t90: at(0.9), t100: sim.n === 0 && et.length ? et[et.length - 1] : null,
    peakDensity: sim.peakDensity, peakPressure: sim.peakPressure,
    avgStuck: N ? sim.stuckTotal / N : 0, totalStuck: sim.stuckTotal,
    exits: sim.exits.map((e) => ({ label: e.label, name: e.name, count: e.count, open: e.open })),
    spots: delayClusters(sim, 4),
  };
}

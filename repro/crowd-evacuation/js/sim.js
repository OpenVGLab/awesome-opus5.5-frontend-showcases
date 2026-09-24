// Crowd evacuation model: Helbing-style social forces for bodies, a fast-marching
// distance field per exit for route guidance, queue-aware exit choice.
import {
  WORLD_W, WORLD_H, CELL, GW, GH, GN, HN, DT, CAP, MAX_EXITS, EXIT_LABELS,
  mulberry32, primDist, NRM, cutRect, cutCircle, rectDist, lowerBound, Heap,
} from './core.js';
import { analyze, resetAnalysis, buildReport, nameAt } from './analysis.js';

const NBC = 1.2, NBW = 50, NBH = 30, NBN = NBW * NBH;   // neighbour hash
const BINW = 60, BINH = 36, BINN = BINW * BINH;          // 1 m wall bins
const MASS = 80, TAU = 0.5;
const K_BODY = 1.2e5, KAPPA = 2.4e5, GCLAMP = 0.25;
export const PARAMS = {
  A_SOC: 2000, B_SOC: 0.08, A_MIN: 0.25, A_WALL: 400, B_WALL: 0.04, CMAX: 6000,
  R_MIN: 0.24, R_MAX: 0.31, V_MIN: 1.2, V_MAX: 4,
};
const CUT2 = 1.15 * 1.15;
const REACH = 0.6;
const NAV_RANGE = 1.2, BLOCK_D = 0.15;
const UNFAMILIAR = 25;
const INF = Infinity;

let SX = 0, SY = 0;

export class Sim {
  constructor() {
    const f64 = () => new Float64Array(CAP);
    this.x = f64(); this.y = f64(); this.vx = f64(); this.vy = f64();
    this.fx = f64(); this.fy = f64(); this.ex = f64(); this.ey = f64();
    this.r = f64(); this.vf = f64(); this.press = f64(); this.pressS = f64();
    this.spd = f64(); this.prog = f64(); this.delay = f64(); this.phase = f64();
    this.id = new Int32Array(CAP); this.tgt = new Int16Array(CAP);
    this.n = 0; this.nextId = 1;

    this.nbCell = new Int32Array(CAP); this.nbStart = new Int32Array(NBN + 1);
    this.nbFill = new Int32Array(NBN); this.nbItems = new Int32Array(CAP);

    this.np = 0; this._pcap = 0; this._allocPrims(512);
    this.binStart = new Int32Array(BINN + 1); this._binFill = new Int32Array(BINN);
    this.binItems = new Int32Array(4096);

    this.wallD = new Float32Array(GN); this.blocked = new Uint8Array(GN);
    this.slow = new Float32Array(GN); this.exitCell = new Uint8Array(GN);
    this.fields = []; this._pool = [];
    this.nearD = new Float32Array(GN); this.nearX = new Float32Array(GN); this.nearY = new Float32Array(GN);
    this._st = new Uint8Array(GN); this._heap = new Heap(GN * 2);
    this._dbuf = new Float32Array(CAP * MAX_EXITS);
    this._sorted = Array.from({ length: MAX_EXITS }, () => new Float32Array(CAP));
    this._sortedN = new Int32Array(MAX_EXITS);

    this.awareness = 0.2;
    this.setUrgency(0.25);
    this.segs = []; this.pillars = []; this.exits = []; this.zones = []; this.floors = []; this.deco = [];
    this.layoutVersion = 0; this.navVersion = 0; this.dirty = true;
    this.rng = mulberry32(7);
    resetAnalysis(this);
    this.resetStats();
  }

  get total() { return this.n + this.evacuated; }

  // 0 = calm walk (keeps a soft, forward-looking personal space) .. 1 = panic (runs, shoves in every direction).
  setUrgency(u) {
    this.urgency = u;
    this.v0 = PARAMS.V_MIN + (PARAMS.V_MAX - PARAMS.V_MIN) * u;
    this.aScale = PARAMS.A_MIN + (1 - PARAMS.A_MIN) * u;
    this.lambda = 0.3 + 0.6 * u;
  }

  _allocPrims(cap) {
    this._pcap = cap;
    this.pt = new Uint8Array(cap);
    this.pcx = new Float64Array(cap); this.pcy = new Float64Array(cap);
    this.pux = new Float64Array(cap); this.puy = new Float64Array(cap);
    this.phu = new Float64Array(cap); this.phw = new Float64Array(cap);
  }

  resetStats() {
    this.time = 0; this.steps = 0; this.evacuated = 0; this.evacTimes = [];
    this.complete = false; this.stalled = false; this.report = null; this.justCompleted = false;
    for (const e of this.exits) { e.count = 0; e.times = []; }
    resetAnalysis(this);
  }

  // ---------------------------------------------------------------- layout
  setLayout(L) {
    this.segs = L.segs.map((s) => ({ ...s }));
    this.pillars = L.pillars.map((p) => ({ ...p }));
    this.exits = L.exits.map((e) => ({ ...e, count: 0, times: [] }));
    const area = (z) => (z.x1 - z.x0) * (z.y1 - z.y0);
    this.zones = L.zones.slice().sort((a, b) => (b.pri | 0) - (a.pri | 0) || area(a) - area(b));
    this.floors = L.floors || []; this.deco = L.deco || [];
    this.n = 0;
    this._edited();
  }

  _edited() {
    this.dirty = true; this.layoutVersion++;
    if (this.complete && this.n > 0) { this.complete = false; this.stalled = false; this.report = null; }
  }

  rebuild() {
    this.dirty = false;
    const segs = this.segs, pil = this.pillars, exits = this.exits;
    let cnt = segs.length + pil.length;
    for (const e of exits) if (!e.open) cnt++;
    if (cnt > this._pcap) this._allocPrims(cnt * 2);
    const { pt, pcx, pcy, pux, puy, phu, phw } = this;
    let k = 0;
    for (const s of segs) {
      const dx = s.x1 - s.x0, dy = s.y1 - s.y0, L = Math.hypot(dx, dy);
      pt[k] = 0; pcx[k] = (s.x0 + s.x1) / 2; pcy[k] = (s.y0 + s.y1) / 2;
      pux[k] = L > 1e-9 ? dx / L : 1; puy[k] = L > 1e-9 ? dy / L : 0;
      phu[k] = L / 2 + s.t / 2; phw[k] = s.t / 2; k++;
    }
    for (const p of pil) { pt[k] = 1; pcx[k] = p.x; pcy[k] = p.y; pux[k] = 1; puy[k] = 0; phu[k] = p.r; phw[k] = p.r; k++; }
    for (const e of exits) {
      if (e.open) continue;
      pt[k] = 0; pcx[k] = (e.x0 + e.x1) / 2; pcy[k] = (e.y0 + e.y1) / 2; pux[k] = 1; puy[k] = 0;
      phu[k] = (e.x1 - e.x0) / 2; phw[k] = (e.y1 - e.y0) / 2; k++;
    }
    this.np = k;
    this._buildBins();
    this._buildNav();
    this.navVersion++;
    if (this.n) { this._updateChoices(true, 2); this._updateDirs(); }
  }

  _primBox(p, pad) {
    let ex, ey;
    if (this.pt[p] === 1) { ex = ey = this.phu[p]; }
    else {
      const ux = Math.abs(this.pux[p]), uy = Math.abs(this.puy[p]);
      ex = ux * this.phu[p] + uy * this.phw[p]; ey = uy * this.phu[p] + ux * this.phw[p];
    }
    return [this.pcx[p] - ex - pad, this.pcy[p] - ey - pad, this.pcx[p] + ex + pad, this.pcy[p] + ey + pad];
  }

  _buildBins() {
    const cnt = this._binFill; cnt.fill(0);
    const boxes = [];
    for (let p = 0; p < this.np; p++) {
      const b = this._primBox(p, REACH);
      const bx0 = Math.max(0, Math.floor(b[0])), by0 = Math.max(0, Math.floor(b[1]));
      const bx1 = Math.min(BINW - 1, Math.floor(b[2])), by1 = Math.min(BINH - 1, Math.floor(b[3]));
      boxes.push(bx0, by0, bx1, by1);
      for (let j = by0; j <= by1; j++) for (let i = bx0; i <= bx1; i++) cnt[j * BINW + i]++;
    }
    let s = 0;
    for (let b = 0; b < BINN; b++) { this.binStart[b] = s; s += cnt[b]; }
    this.binStart[BINN] = s;
    if (this.binItems.length < s) this.binItems = new Int32Array(s * 2);
    cnt.set(this.binStart.subarray(0, BINN));
    for (let p = 0; p < this.np; p++) {
      const o = p * 4;
      for (let j = boxes[o + 1]; j <= boxes[o + 3]; j++) {
        for (let i = boxes[o]; i <= boxes[o + 2]; i++) this.binItems[cnt[j * BINW + i]++] = p;
      }
    }
  }

  // Distance from a point to the nearest wall surface (capped at REACH).
  clearance(px, py) {
    let m = Math.min(px, WORLD_W - px, py, WORLD_H - py, REACH);
    let bx = px | 0, by = py | 0;
    if (bx < 0 || by < 0 || bx >= BINW || by >= BINH) return -1;
    const b = by * BINW + bx;
    for (let a = this.binStart[b], e = this.binStart[b + 1]; a < e; a++) {
      const p = this.binItems[a];
      const d = primDist(this.pt[p], this.pcx[p], this.pcy[p], this.pux[p], this.puy[p], this.phu[p], this.phw[p], px, py);
      if (d < m) m = d;
    }
    return m;
  }

  // ---------------------------------------------------------------- navigation
  _buildNav() {
    const wd = this.wallD;
    for (let j = 0; j < GH; j++) {
      const yc = (j + 0.5) * CELL;
      for (let i = 0; i < GW; i++) {
        const xc = (i + 0.5) * CELL;
        const d = Math.min(xc, WORLD_W - xc, yc, WORLD_H - yc);
        wd[j * GW + i] = d < NAV_RANGE ? d : NAV_RANGE;
      }
    }
    for (let p = 0; p < this.np; p++) {
      const b = this._primBox(p, NAV_RANGE);
      const i0 = Math.max(0, Math.floor(b[0] / CELL)), j0 = Math.max(0, Math.floor(b[1] / CELL));
      const i1 = Math.min(GW - 1, Math.floor(b[2] / CELL)), j1 = Math.min(GH - 1, Math.floor(b[3] / CELL));
      const t = this.pt[p], cx = this.pcx[p], cy = this.pcy[p], ux = this.pux[p], uy = this.puy[p], hu = this.phu[p], hw = this.phw[p];
      for (let j = j0; j <= j1; j++) {
        const yc = (j + 0.5) * CELL, o = j * GW;
        for (let i = i0; i <= i1; i++) {
          const d = primDist(t, cx, cy, ux, uy, hu, hw, (i + 0.5) * CELL, yc);
          if (d < wd[o + i]) wd[o + i] = d;
        }
      }
    }
    for (let c = 0; c < GN; c++) {
      const d = wd[c];
      this.blocked[c] = d < BLOCK_D ? 1 : 0;
      const q = Math.min(1, Math.max(0, (0.75 - d) / 0.55));
      this.slow[c] = 1 + 2.5 * q * q;
    }
    this.exitCell.fill(0);
    const K = this.exits.length;
    for (let k = 0; k < K; k++) {
      const e = this.exits[k];
      const w = e.x1 - e.x0, h = e.y1 - e.y0;
      e.cx = (e.x0 + e.x1) / 2; e.cy = (e.y0 + e.y1) / 2;
      e.width = Math.max(w, h);
      e.cap = Math.max(0.8, 1.3 * e.width);
      e.out = this._outward(e, w >= h);
      // People count as out once they are halfway through the doorway, so the jambs still hold them up.
      let tx0 = e.x0, tx1 = e.x1, ty0 = e.y0, ty1 = e.y1;
      if (e.out.x > 0) { tx0 = e.cx; tx1 = e.x1 + 0.5; } else if (e.out.x < 0) { tx1 = e.cx; tx0 = e.x0 - 0.5; }
      if (e.out.y > 0) { ty0 = e.cy; ty1 = e.y1 + 0.5; } else if (e.out.y < 0) { ty1 = e.cy; ty0 = e.y0 - 0.5; }
      const src = [];
      const i0 = Math.max(0, Math.ceil(tx0 / CELL - 0.5)), i1 = Math.min(GW - 1, Math.floor(tx1 / CELL - 0.5));
      const j0 = Math.max(0, Math.ceil(ty0 / CELL - 0.5)), j1 = Math.min(GH - 1, Math.floor(ty1 / CELL - 0.5));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const c = j * GW + i;
        this.exitCell[c] = k + 1;
        if (!this.blocked[c]) src.push(c);
      }
      e.reachable = src.length > 0;
      if (e.open && src.length) {
        const F = this._pool[k] || (this._pool[k] = { D: new Float32Array(GN), dx: new Float32Array(GN), dy: new Float32Array(GN) });
        this._fmm(src, F.D);
        this._dirField(F);
        this.fields[k] = F;
      } else this.fields[k] = null;
    }
    this.fields.length = K;
    const nd = this.nearD; nd.fill(INF);
    for (let k = 0; k < K; k++) {
      const F = this.fields[k];
      if (!F) continue;
      for (let c = 0; c < GN; c++) if (F.D[c] < nd[c]) { nd[c] = F.D[c]; this.nearX[c] = F.dx[c]; this.nearY[c] = F.dy[c]; }
    }
  }

  _outward(e, horiz) {
    const inFloor = (x, y) => this.floors.some((f) => f.kind === 'floor' && x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1);
    const d = 1.2;
    if (horiz) {
      const a = inFloor(e.cx, e.cy - d), b = inFloor(e.cx, e.cy + d);
      if (a !== b) return { x: 0, y: a ? 1 : -1 };
      return { x: 0, y: e.cy > WORLD_H / 2 ? 1 : -1 };
    }
    const a = inFloor(e.cx - d, e.cy), b = inFloor(e.cx + d, e.cy);
    if (a !== b) return { x: a ? 1 : -1, y: 0 };
    return { x: e.cx > WORLD_W / 2 ? 1 : -1, y: 0 };
  }

  _fmm(src, D) {
    const st = this._st, blocked = this.blocked, slow = this.slow, H = this._heap;
    D.fill(INF); st.fill(0); H.n = 0;
    for (const c of src) { D[c] = 0; H.push(0, c); }
    const upd = (c, i, j) => {
      if (st[c] === 2 || blocked[c]) return;
      let a = INF, b = INF;
      if (i > 0 && st[c - 1] === 2) a = D[c - 1];
      if (i < GW - 1 && st[c + 1] === 2 && D[c + 1] < a) a = D[c + 1];
      if (j > 0 && st[c - GW] === 2) b = D[c - GW];
      if (j < GH - 1 && st[c + GW] === 2 && D[c + GW] < b) b = D[c + GW];
      const f = slow[c] * CELL;
      let t;
      if (a === INF) t = b + f;
      else if (b === INF) t = a + f;
      else {
        const d = a - b;
        t = d >= f || d <= -f ? Math.min(a, b) + f : 0.5 * (a + b + Math.sqrt(2 * f * f - d * d));
      }
      if (t < D[c]) { D[c] = t; st[c] = 1; H.push(t, c); }
    };
    while (H.n > 0) {
      const c = H.pop();
      if (st[c] === 2) continue;
      st[c] = 2;
      const i = c % GW, j = (c / GW) | 0;
      if (i > 0) upd(c - 1, i - 1, j);
      if (i < GW - 1) upd(c + 1, i + 1, j);
      if (j > 0) upd(c - GW, i, j - 1);
      if (j < GH - 1) upd(c + GW, i, j + 1);
    }
  }

  _dirField(F) {
    const D = F.D, X = F.dx, Y = F.dy;
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const c = j * GW + i, d0 = D[c];
        if (d0 === INF) { X[c] = 0; Y[c] = 0; continue; }
        const l = i > 0 ? D[c - 1] : INF, r = i < GW - 1 ? D[c + 1] : INF;
        const u = j > 0 ? D[c - GW] : INF, b = j < GH - 1 ? D[c + GW] : INF;
        let gx = 0, gy = 0;
        if (l !== INF && r !== INF) gx = (r - l) * 0.5; else if (r !== INF) gx = r - d0; else if (l !== INF) gx = d0 - l;
        if (u !== INF && b !== INF) gy = (b - u) * 0.5; else if (b !== INF) gy = b - d0; else if (u !== INF) gy = d0 - u;
        const m = Math.hypot(gx, gy);
        if (m < 1e-9) { X[c] = 0; Y[c] = 0; } else { X[c] = -gx / m; Y[c] = -gy / m; }
      }
    }
  }

  // Bilinear sample of a direction field over cells with a finite distance; result in SX, SY.
  _sampleDir(F, px, py) {
    const gx = px / CELL - 0.5, gy = py / CELL - 0.5;
    let i0 = Math.floor(gx), j0 = Math.floor(gy);
    if (i0 < 0) i0 = 0; else if (i0 > GW - 2) i0 = GW - 2;
    if (j0 < 0) j0 = 0; else if (j0 > GH - 2) j0 = GH - 2;
    let fx = gx - i0, fy = gy - j0;
    fx = fx < 0 ? 0 : fx > 1 ? 1 : fx; fy = fy < 0 ? 0 : fy > 1 ? 1 : fy;
    const c = j0 * GW + i0, D = F.D, X = F.dx, Y = F.dy;
    let sx = 0, sy = 0, ws = 0, w;
    w = (1 - fx) * (1 - fy); if (D[c] !== INF) { sx += w * X[c]; sy += w * Y[c]; ws += w; }
    w = fx * (1 - fy); if (D[c + 1] !== INF) { sx += w * X[c + 1]; sy += w * Y[c + 1]; ws += w; }
    w = (1 - fx) * fy; if (D[c + GW] !== INF) { sx += w * X[c + GW]; sy += w * Y[c + GW]; ws += w; }
    w = fx * fy; if (D[c + GW + 1] !== INF) { sx += w * X[c + GW + 1]; sy += w * Y[c + GW + 1]; ws += w; }
    SX = sx; SY = sy;
    return ws;
  }

  // Lowest finite cell in a 5x5 window: direction towards it in SX, SY and its value returned.
  _nearestFinite(D, px, py) {
    const ci = Math.min(GW - 1, Math.max(0, (px / CELL) | 0)), cj = Math.min(GH - 1, Math.max(0, (py / CELL) | 0));
    let best = INF, bi = -1, bj = -1;
    for (let j = Math.max(0, cj - 2); j <= Math.min(GH - 1, cj + 2); j++) {
      for (let i = Math.max(0, ci - 2); i <= Math.min(GW - 1, ci + 2); i++) {
        const v = D[j * GW + i];
        if (v < best) { best = v; bi = i; bj = j; }
      }
    }
    if (bi < 0) return INF;
    const dx = (bi + 0.5) * CELL - px, dy = (bj + 0.5) * CELL - py;
    SX = dx; SY = dy;
    return best + Math.hypot(dx, dy);
  }

  sampleD(D, px, py) {
    const gx = px / CELL - 0.5, gy = py / CELL - 0.5;
    let i0 = Math.floor(gx), j0 = Math.floor(gy);
    if (i0 < 0) i0 = 0; else if (i0 > GW - 2) i0 = GW - 2;
    if (j0 < 0) j0 = 0; else if (j0 > GH - 2) j0 = GH - 2;
    let fx = gx - i0, fy = gy - j0;
    fx = fx < 0 ? 0 : fx > 1 ? 1 : fx; fy = fy < 0 ? 0 : fy > 1 ? 1 : fy;
    const c = j0 * GW + i0;
    let s = 0, ws = 0, w, v;
    w = (1 - fx) * (1 - fy); v = D[c]; if (v !== INF) { s += w * v; ws += w; }
    w = fx * (1 - fy); v = D[c + 1]; if (v !== INF) { s += w * v; ws += w; }
    w = (1 - fx) * fy; v = D[c + GW]; if (v !== INF) { s += w * v; ws += w; }
    w = fx * fy; v = D[c + GW + 1]; if (v !== INF) { s += w * v; ws += w; }
    if (ws > 0.02) return s / ws;
    return this._nearestFinite(D, px, py);
  }

  _updateDirs() {
    const n = this.n, x = this.x, y = this.y, ex = this.ex, ey = this.ey, tgt = this.tgt, ph = this.phase, T = this.time;
    for (let i = 0; i < n; i++) {
      const k = tgt[i];
      const F = k >= 0 ? this.fields[k] : null;
      if (!F) { ex[i] = 0; ey[i] = 0; continue; }
      let dx, dy;
      if (this._sampleDir(F, x[i], y[i]) > 0.02) { dx = SX; dy = SY; }
      else if (this._nearestFinite(F.D, x[i], y[i]) < INF) { dx = SX; dy = SY; }
      else { ex[i] = 0; ey[i] = 0; continue; }
      let m = Math.hypot(dx, dy);
      if (m < 1e-6) continue;
      dx /= m; dy /= m;
      const p = ph[i], a = 0.1 * Math.sin(T * (0.6 + 0.12 * (p % 5)) + p);
      const ca = Math.cos(a), sa = Math.sin(a);
      ex[i] = dx * ca - dy * sa; ey[i] = dx * sa + dy * ca;
    }
  }

  // Each person weighs walking time against the queue they expect at every open exit.
  // "awareness" blends from pure habit (nearest familiar exit) to fully queue-aware choice.
  _updateChoices(all, iters = 1) {
    const n = this.n, K = this.exits.length, tgt = this.tgt;
    if (!n) return;
    const open = [];
    for (let k = 0; k < K; k++) if (this.fields[k]) open.push(k);
    if (!open.length) { for (let i = 0; i < n; i++) tgt[i] = -1; return; }
    const db = this._dbuf, x = this.x, y = this.y;
    for (let i = 0; i < n; i++) {
      const o = i * MAX_EXITS;
      for (const k of open) db[o + k] = this.sampleD(this.fields[k].D, x[i], y[i]);
    }
    const a = this.awareness, v0 = this.v0, vf = this.vf, rng = this.rng, sn = this._sortedN;
    for (let it = 0; it < iters; it++) {
      sn.fill(0);
      for (let i = 0; i < n; i++) {
        const k = tgt[i];
        if (k >= 0 && this.fields[k]) this._sorted[k][sn[k]++] = db[i * MAX_EXITS + k];
      }
      for (const k of open) this._sorted[k].subarray(0, sn[k]).sort();
      const pSel = all ? (it === 0 ? 1 : 0.5) : 0.35;
      for (let i = 0; i < n; i++) {
        const cur = tgt[i];
        if (cur >= 0 && !this.fields[cur]) tgt[i] = -1;
        if (tgt[i] >= 0 && pSel < 1 && rng() > pSel) continue;
        const o = i * MAX_EXITS, sp = v0 * vf[i];
        let best = -1, bestC = INF, curC = INF;
        for (const k of open) {
          const d = db[o + k];
          if (d === INF) continue;
          const e = this.exits[k];
          const travel = d / sp;
          const queue = lowerBound(this._sorted[k], sn[k], d) / e.cap;
          let c = travel + a * Math.max(0, queue - travel);
          if (!e.familiar) c += (1 - a) * UNFAMILIAR;
          if (k === tgt[i]) curC = c;
          if (c < bestC) { bestC = c; best = k; }
        }
        if (best < 0) tgt[i] = -1;
        else if (tgt[i] < 0 || curC === INF || bestC < curC - Math.max(1.5, 0.1 * curC)) tgt[i] = best;
      }
    }
  }

  // ---------------------------------------------------------------- physics
  _buildNeighbors() {
    const n = this.n, x = this.x, y = this.y, cnt = this.nbFill, start = this.nbStart;
    cnt.fill(0);
    for (let i = 0; i < n; i++) {
      let cx = (x[i] / NBC) | 0, cy = (y[i] / NBC) | 0;
      if (cx < 0) cx = 0; else if (cx >= NBW) cx = NBW - 1;
      if (cy < 0) cy = 0; else if (cy >= NBH) cy = NBH - 1;
      const c = cy * NBW + cx;
      this.nbCell[i] = c; cnt[c]++;
    }
    let s = 0;
    for (let c = 0; c < NBN; c++) { start[c] = s; s += cnt[c]; }
    start[NBN] = s;
    cnt.set(start.subarray(0, NBN));
    for (let i = 0; i < n; i++) this.nbItems[cnt[this.nbCell[i]]++] = i;
  }

  _forces() {
    this._buildNeighbors();
    const n = this.n, x = this.x, y = this.y, vx = this.vx, vy = this.vy, fx = this.fx, fy = this.fy;
    const ex = this.ex, ey = this.ey, r = this.r, vf = this.vf, press = this.press;
    const kd = MASS / TAU, v0 = this.v0, lam = this.lambda, lk = (1 - lam) * 0.5;
    const { B_SOC, A_WALL, B_WALL, CMAX } = PARAMS, A_SOC = PARAMS.A_SOC * this.aScale;
    for (let i = 0; i < n; i++) {
      const des = v0 * vf[i];
      fx[i] = kd * (des * ex[i] - vx[i]); fy[i] = kd * (des * ey[i] - vy[i]); press[i] = 0;
    }
    const start = this.nbStart, items = this.nbItems, cell = this.nbCell;
    for (let i = 0; i < n; i++) {
      const xi = x[i], yi = y[i], ri = r[i], vxi = vx[i], vyi = vy[i], exi = ex[i], eyi = ey[i];
      const c = cell[i], cx = c % NBW, cy = (c / NBW) | 0;
      const ya = cy > 0 ? cy - 1 : 0, yb = cy < NBH - 1 ? cy + 1 : cy;
      const xa = cx > 0 ? cx - 1 : 0, xb = cx < NBW - 1 ? cx + 1 : cx;
      let fxi = 0, fyi = 0, pi = 0;
      for (let yy = ya; yy <= yb; yy++) {
        for (let xx = xa; xx <= xb; xx++) {
          const cc = yy * NBW + xx;
          for (let q = start[cc], qe = start[cc + 1]; q < qe; q++) {
            const j = items[q];
            if (j <= i) continue;
            const dx = xi - x[j], dy = yi - y[j];
            const d2 = dx * dx + dy * dy;
            if (d2 > CUT2) continue;
            const d = Math.sqrt(d2) + 1e-6;
            const nx = dx / d, ny = dy / d;
            const g = ri + r[j] - d;
            if (g < -0.45) continue;
            const fs = A_SOC * Math.exp((g < GCLAMP ? g : GCLAMP) / B_SOC);
            const ci = -(nx * exi + ny * eyi), cj = nx * ex[j] + ny * ey[j];
            let fni = fs * (lam + lk * (1 + ci));
            let fnj = fs * (lam + lk * (1 + cj));
            let tfx = 0, tfy = 0;
            if (g > 0) {
              const kb = K_BODY * g;
              fni += kb; fnj += kb;
              let cf = KAPPA * g; if (cf > CMAX) cf = CMAX;
              const ft = cf * ((vx[j] - vxi) * -ny + (vy[j] - vyi) * nx);
              tfx = -ny * ft; tfy = nx * ft;
              pi += kb; press[j] += kb;
            }
            fxi += fni * nx + tfx; fyi += fni * ny + tfy;
            fx[j] -= fnj * nx + tfx; fy[j] -= fnj * ny + tfy;
          }
        }
      }
      fx[i] += fxi; fy[i] += fyi; press[i] += pi;
    }
    const bs = this.binStart, bi = this.binItems, { pt, pcx, pcy, pux, puy, phu, phw } = this;
    for (let i = 0; i < n; i++) {
      const xi = x[i], yi = y[i], ri = r[i];
      let bx = xi | 0, by = yi | 0;
      if (bx < 0) bx = 0; else if (bx >= BINW) bx = BINW - 1;
      if (by < 0) by = 0; else if (by >= BINH) by = BINH - 1;
      const b = by * BINW + bx;
      for (let q = bs[b], qe = bs[b + 1]; q < qe; q++) {
        const p = bi[q];
        const dist = primDist(pt[p], pcx[p], pcy[p], pux[p], puy[p], phu[p], phw[p], xi, yi);
        const g = ri - dist;
        if (g < -0.45) continue;
        const nx = NRM.x, ny = NRM.y;
        let f = A_WALL * Math.exp((g < GCLAMP ? g : GCLAMP) / B_WALL);
        if (g > 0) {
          const kb = K_BODY * g;
          f += kb; press[i] += kb;
          let cf = KAPPA * g; if (cf > CMAX) cf = CMAX;
          const vt = -vx[i] * ny + vy[i] * nx;
          fx[i] += cf * vt * ny; fy[i] -= cf * vt * nx;
        }
        fx[i] += f * nx; fy[i] += f * ny;
      }
    }
  }

  _integrate() {
    const n = this.n, x = this.x, y = this.y, vx = this.vx, vy = this.vy, fx = this.fx, fy = this.fy, r = this.r;
    const inv = DT / MASS, v0 = this.v0;
    for (let i = 0; i < n; i++) {
      let ux = vx[i] + fx[i] * inv, uy = vy[i] + fy[i] * inv;
      const vmax = v0 * this.vf[i] * 1.3 + 0.4;
      const s2 = ux * ux + uy * uy;
      if (s2 > vmax * vmax) { const k = vmax / Math.sqrt(s2); ux *= k; uy *= k; }
      vx[i] = ux; vy[i] = uy;
      let px = x[i] + ux * DT, py = y[i] + uy * DT;
      const ri = r[i];
      if (px < ri) px = ri; else if (px > WORLD_W - ri) px = WORLD_W - ri;
      if (py < ri) py = ri; else if (py > WORLD_H - ri) py = WORLD_H - ri;
      x[i] = px; y[i] = py;
    }
  }

  _checkExits() {
    const ec = this.exitCell, exits = this.exits;
    for (let i = this.n - 1; i >= 0; i--) {
      let gi = (this.x[i] / CELL) | 0, gj = (this.y[i] / CELL) | 0;
      if (gi >= GW) gi = GW - 1; if (gj >= GH) gj = GH - 1;
      const e = ec[gj * GW + gi];
      if (e !== 0 && exits[e - 1].open) this._evacuate(i, e - 1);
    }
  }

  _evacuate(i, k) {
    const e = this.exits[k];
    e.count++; e.times.push(this.time);
    this.evacTimes.push(this.time); this.evacuated++;
    this.ghosts.push({ x: this.x[i], y: this.y[i], vx: e.out.x, vy: e.out.y, r: this.r[i], life: 1, k });
    this._removeAt(i);
  }

  _removeAt(i) {
    const last = --this.n;
    if (i === last) return;
    for (const a of [this.x, this.y, this.vx, this.vy, this.ex, this.ey, this.r, this.vf, this.press,
      this.pressS, this.spd, this.prog, this.delay, this.phase, this.id, this.tgt]) a[i] = a[last];
  }

  step() {
    if (this.dirty && !this.holdRebuild) this.rebuild();
    if (this.steps % 100 === 0) this._updateChoices(false);
    if (this.steps % 4 === 0) this._updateDirs();
    this._forces();
    this._integrate();
    this._checkExits();
    this.time += DT; this.steps++;
    if (!this.complete && this.n === 0 && this.evacuated > 0) this._finish(false);
  }

  _finish(stalled) {
    this.complete = true; this.stalled = stalled; this.justCompleted = true;
    this.report = buildReport(this);
  }

  analyze(dtSim) { analyze(this, dtSim); }
  nameAt(x, y) { return nameAt(this, x, y); }

  // ---------------------------------------------------------------- crowd
  _radius() { return PARAMS.R_MIN + this.rng() * (PARAMS.R_MAX - PARAMS.R_MIN); }

  _addAgent(px, py, r) {
    const i = this.n++;
    const g = (this.rng() + this.rng() + this.rng() - 1.5) * 1.41;
    this.x[i] = px; this.y[i] = py; this.vx[i] = 0; this.vy[i] = 0; this.ex[i] = 0; this.ey[i] = 0;
    this.r[i] = r; this.vf[i] = Math.min(1.35, Math.max(0.7, 1 + 0.13 * g));
    this.press[i] = 0; this.pressS[i] = 0; this.spd[i] = this.v0 * this.vf[i]; this.prog[i] = 1; this.delay[i] = 0;
    this.phase[i] = this.rng() * 100; this.id[i] = this.nextId++; this.tgt[i] = -1;
    return i;
  }

  _canPlace(px, py, r, hash) {
    if (this.clearance(px, py) < r + 0.03) return false;
    const gi = Math.min(GW - 1, Math.max(0, (px / CELL) | 0)), gj = Math.min(GH - 1, Math.max(0, (py / CELL) | 0));
    if (this.exitCell[gj * GW + gi]) return false;
    const cx = (px / NBC) | 0, cy = (py / NBC) | 0;
    for (let yy = cy - 1; yy <= cy + 1; yy++) {
      for (let xx = cx - 1; xx <= cx + 1; xx++) {
        const list = hash.get(yy * NBW + xx);
        if (!list) continue;
        for (const j of list) {
          const dx = px - this.x[j], dy = py - this.y[j], m = r + this.r[j] + 0.02;
          if (dx * dx + dy * dy < m * m) return false;
        }
      }
    }
    return true;
  }

  _hashAgents() {
    const hash = new Map();
    for (let i = 0; i < this.n; i++) this._hashAdd(hash, i);
    return hash;
  }

  _hashAdd(hash, i) {
    const key = ((this.y[i] / NBC) | 0) * NBW + ((this.x[i] / NBC) | 0);
    const l = hash.get(key);
    if (l) l.push(i); else hash.set(key, [i]);
  }

  populate(spawns, N, seed, fallback = [], seats = []) {
    if (this.dirty) this.rebuild();
    this.n = 0; this.nextId = 1; this.rng = mulberry32(seed);
    this.resetStats();
    const hash = new Map();
    const order = seats.map((_, k) => k);
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(this.rng() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    for (const k of order) {
      if (this.n >= N || this.n >= CAP) break;
      const r = this._radius(), s = seats[k];
      const px = s.x + (this.rng() - 0.5) * 0.08, py = s.y + (this.rng() - 0.5) * 0.06;
      if (this._canPlace(px, py, r, hash)) this._hashAdd(hash, this._addAgent(px, py, r));
    }
    N -= this.n;
    const pick = (list) => {
      let tot = 0;
      for (const s of list) tot += s.w;
      let u = this.rng() * tot;
      for (const s of list) { u -= s.w; if (u <= 0) return s; }
      return list[list.length - 1];
    };
    let fails = 0;
    for (let a = 0; a < N && this.n < CAP; a++) {
      const r = this._radius();
      let placed = false;
      for (let pass = 0; pass < 2 && !placed; pass++) {
        const list = pass === 0 ? spawns : fallback;
        if (!list.length) continue;
        for (let t = 0; t < 40 && !placed; t++) {
          const s = pick(list);
          const px = s.x0 + this.rng() * (s.x1 - s.x0), py = s.y0 + this.rng() * (s.y1 - s.y0);
          if (!this._canPlace(px, py, r, hash)) continue;
          this._hashAdd(hash, this._addAgent(px, py, r));
          placed = true;
        }
      }
      if (!placed && ++fails > 150) break;
    }
    this.resetStats();
    this._updateChoices(true, 3);
    this._updateDirs();
  }

  addAgentsInCircle(cx, cy, R, count) {
    if (this.dirty) this.rebuild();
    const hash = this._hashAgents();
    let added = 0;
    for (let a = 0; a < count && this.n < CAP; a++) {
      const r = this._radius();
      for (let t = 0; t < 12; t++) {
        const ang = this.rng() * Math.PI * 2, rad = Math.sqrt(this.rng()) * R;
        const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
        if (px < 0.3 || py < 0.3 || px > WORLD_W - 0.3 || py > WORLD_H - 0.3) continue;
        if (!this._canPlace(px, py, r, hash)) continue;
        this._hashAdd(hash, this._addAgent(px, py, r));
        added++;
        break;
      }
    }
    if (added) {
      if (this.complete) { this.complete = false; this.stalled = false; this.report = null; }
      this._updateChoices(true, 1);
      this._updateDirs();
    }
    return added;
  }

  removeAgentsInCircle(cx, cy, R) {
    let removed = 0;
    for (let i = this.n - 1; i >= 0; i--) {
      const dx = this.x[i] - cx, dy = this.y[i] - cy;
      if (dx * dx + dy * dy < R * R) { this._removeAt(i); removed++; }
    }
    return removed;
  }

  // ---------------------------------------------------------------- editing
  addWall(x0, y0, x1, y1, t = 0.3) { this.segs.push({ x0, y0, x1, y1, t, kind: 'wall' }); this._edited(); }
  addPillar(x, y, r = 0.4) { this.pillars.push({ x, y, r }); this._edited(); }

  addExit(x0, y0, x1, y1) {
    if (this.exits.length >= MAX_EXITS) return null;
    const used = new Set(this.exits.map((e) => e.label));
    const label = [...EXIT_LABELS].find((l) => !used.has(l));
    this.segs = cutRect(this.segs, x0, y0, x1, y1);
    this.pillars = this.pillars.filter((p) => rectDist({ x0, y0, x1, y1 }, p.x, p.y) > p.r);
    const e = { x0, y0, x1, y1, label, name: 'New exit', familiar: true, open: true, count: 0, times: [] };
    this.exits.push(e);
    this._edited();
    return e;
  }

  toggleExit(e) { e.open = !e.open; this._edited(); }

  exitAt(x, y, pad = 0.35) {
    for (const e of this.exits) if (x > e.x0 - pad && x < e.x1 + pad && y > e.y0 - pad && y < e.y1 + pad) return e;
    return null;
  }

  eraseAt(x, y, R) {
    const segs = cutCircle(this.segs, x, y, R);
    const pil = this.pillars.filter((p) => Math.hypot(p.x - x, p.y - y) > R + p.r);
    const ex = this.exits.filter((e) => rectDist(e, x, y) > R);
    const changed = segs !== this.segs || pil.length !== this.pillars.length || ex.length !== this.exits.length;
    if (changed) { this.segs = segs; this.pillars = pil; this.exits = ex; this._edited(); }
    return changed;
  }

  snapshot() {
    return JSON.stringify({
      segs: this.segs, pillars: this.pillars,
      exits: this.exits.map(({ x0, y0, x1, y1, label, name, familiar, open }) => ({ x0, y0, x1, y1, label, name, familiar, open })),
    });
  }

  restore(json) {
    const o = JSON.parse(json);
    const old = new Map(this.exits.map((e) => [e.label, e]));
    this.segs = o.segs; this.pillars = o.pillars;
    this.exits = o.exits.map((e) => {
      const p = old.get(e.label);
      return { ...e, count: p ? p.count : 0, times: p ? p.times : [] };
    });
    this._edited();
  }
}

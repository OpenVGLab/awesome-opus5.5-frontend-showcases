// Canvas 2D renderer: floor plan, heat layers, crowd, jam markers and tool previews.
import { WORLD_W, WORLD_H, HW, HH, HN, CAP, DANGER, CELL, GW, GH } from './core.js';

const PI2 = Math.PI * 2;
const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const EXIT_GREEN = '#34e3a4';
export const EXIT_COLORS = ['#34e3a4', '#ffbf47', '#6aa9ff', '#ff7ab8', '#b995ff', '#4fe0ff',
  '#ff8e5e', '#c7f05c', '#ffd9a0', '#9ef0e1', '#f6a0ff', '#a0b4ff'];

function lerpStops(stops, t) {
  let k = 0;
  while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
  const a = stops[k], b = stops[k + 1], u = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0] || 1)));
  return a.slice(1).map((v, i) => v + (b[i + 1] - v) * u);
}

function makeLut(stops) {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const c = lerpStops(stops, i / 255);
    lut[i * 4] = c[0]; lut[i * 4 + 1] = c[1]; lut[i * 4 + 2] = c[2]; lut[i * 4 + 3] = c[3] * 255;
  }
  return lut;
}

export const HEAT = {
  cong: {
    name: 'Congestion', unit: 'dense and barely moving', ticks: ['flowing', 'slowing', 'jammed'],
    stops: [[0, 70, 20, 120, 0], [0.1, 90, 30, 150, 0.3], [0.35, 180, 40, 120, 0.55], [0.6, 245, 90, 55, 0.72], [0.85, 255, 185, 60, 0.85], [1, 255, 245, 175, 0.92]],
  },
  dens: {
    name: 'Density', unit: 'people per m²', ticks: ['0', '2', '4', '6+'],
    stops: [[0, 30, 70, 170, 0], [0.12, 35, 90, 200, 0.28], [0.33, 30, 175, 215, 0.48], [0.55, 240, 215, 75, 0.62], [0.78, 255, 125, 45, 0.78], [1, 255, 55, 75, 0.9]],
  },
  jam: {
    name: 'Jam map', unit: 'person-seconds lost, whole run', ticks: ['none', 'some', 'most'],
    stops: [[0, 70, 10, 90, 0], [0.06, 95, 20, 140, 0.3], [0.3, 195, 40, 115, 0.58], [0.6, 250, 105, 50, 0.78], [0.85, 255, 205, 75, 0.9], [1, 255, 255, 210, 0.96]],
  },
  press: {
    name: 'Pressure', unit: 'body compression (kN)', ticks: ['0', '1.3', '2.6+'],
    stops: [[0, 90, 20, 130, 0], [0.12, 120, 30, 170, 0.3], [0.45, 225, 55, 185, 0.58], [0.75, 255, 95, 125, 0.78], [1, 255, 235, 240, 0.94]],
  },
};
for (const h of Object.values(HEAT)) {
  h.lut = makeLut(h.stops);
  h.css = `linear-gradient(90deg, ${h.stops.map(([t, r, g, b, a]) => `rgba(${r},${g},${b},${Math.max(0.12, Math.min(1, a * 1.15))}) ${(t * 100).toFixed(0)}%`).join(', ')})`;
}

const SPEED_STOPS = [[0, 112, 200, 255], [0.5, 255, 214, 102], [0.78, 255, 140, 66], [1, 255, 74, 74]];
export const SPEED_COLORS = Array.from({ length: 12 }, (_, k) => {
  const c = lerpStops(SPEED_STOPS, k / 11).map(Math.round);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
});
const TRAPPED = '#7d879c', DANGER_C = '#ff3d9a';

const KIND_STYLE = {
  wall: { fill: '#cdd7ea', halo: 'rgba(120,160,255,0.16)' },
  seat: { fill: '#55648a' },
  block: { fill: '#1b2540', edge: '#43537d' },
  stage: { fill: '#231b3b', edge: '#62509a' },
  bar: { fill: '#2b2032', edge: '#86607f' },
  track: { fill: '#080b12', edge: '#2a3246' },
  gate: { fill: '#a9bbdc' },
};

function segPoly(p, s, pad) {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, L = Math.hypot(dx, dy);
  const ux = L > 1e-9 ? dx / L : 1, uy = L > 1e-9 ? dy / L : 0;
  const h = s.t / 2 + pad, nx = -uy * h, ny = ux * h;
  const ax = s.x0 - ux * h, ay = s.y0 - uy * h, bx = s.x1 + ux * h, by = s.y1 + uy * h;
  p.moveTo(ax + nx, ay + ny); p.lineTo(bx + nx, by + ny); p.lineTo(bx - nx, by - ny); p.lineTo(ax - nx, ay - ny); p.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export class Renderer {
  constructor(canvas, sim) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.sim = sim;
    this.s = 16; this.ox = 0; this.oy = 0; this.dpr = 1; this.W = 1; this.H = 1;
    this.region = { x: 0, y: 0, w: 1, h: 1 };
    this.heatCv = document.createElement('canvas'); this.heatCv.width = HW; this.heatCv.height = HH;
    this.heatCtx = this.heatCv.getContext('2d');
    this.heatImg = this.heatCtx.createImageData(HW, HH);
    this.trailCv = document.createElement('canvas'); this.trailCtx = this.trailCv.getContext('2d');
    this.trailDirty = true;
    this._bk = new Uint8Array(CAP); this._order = new Int32Array(CAP); this._cnt = new Int32Array(16);
    this._paths = null; this._pathsVer = -1;
  }

  resize(w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.trailCv.width = this.cv.width; this.trailCv.height = this.cv.height;
    this.trailDirty = true;
  }

  fit(v) {
    const r = this.region, w = v.x1 - v.x0, h = v.y1 - v.y0;
    this.s = Math.min(r.w / w, r.h / h);
    this.ox = r.x + (r.w - w * this.s) / 2 - v.x0 * this.s;
    this.oy = r.y + (r.h - h * this.s) / 2 - v.y0 * this.s;
    this.trailDirty = true;
  }

  zoomAt(sx, sy, f) {
    const ns = Math.min(80, Math.max(4, this.s * f));
    const wx = (sx - this.ox) / this.s, wy = (sy - this.oy) / this.s;
    this.s = ns; this.ox = sx - wx * ns; this.oy = sy - wy * ns;
    this.trailDirty = true;
  }

  panBy(dx, dy) { this.ox += dx; this.oy += dy; this.trailDirty = true; }
  toWorld(sx, sy) { return { x: (sx - this.ox) / this.s, y: (sy - this.oy) / this.s }; }
  toScreen(x, y) { return { x: this.ox + x * this.s, y: this.oy + y * this.s }; }

  _world() { const d = this.dpr; this.ctx.setTransform(d * this.s, 0, 0, d * this.s, d * this.ox, d * this.oy); }
  _screen() { this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }

  _buildPaths() {
    const sim = this.sim, groups = {};
    for (const s of sim.segs) {
      const k = KIND_STYLE[s.kind] ? s.kind : 'wall';
      const g = groups[k] || (groups[k] = { fill: new Path2D(), halo: new Path2D() });
      segPoly(g.fill, s, 0);
      if (k === 'wall') segPoly(g.halo, s, 0.07);
    }
    const pil = new Path2D(), pilHalo = new Path2D();
    for (const p of sim.pillars) {
      pil.moveTo(p.x + p.r, p.y); pil.arc(p.x, p.y, p.r, 0, PI2);
      pilHalo.moveTo(p.x + p.r + 0.07, p.y); pilHalo.arc(p.x, p.y, p.r + 0.07, 0, PI2);
    }
    this._paths = { groups, pil, pilHalo };
    this._pathsVer = sim.layoutVersion;
  }

  draw(ui) {
    const ctx = this.ctx, sim = this.sim;
    if (this._pathsVer !== sim.layoutVersion) this._buildPaths();
    this._screen();
    ctx.fillStyle = '#060a13';
    ctx.fillRect(0, 0, this.W, this.H);
    this._world();
    ctx.fillStyle = '#09101d';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    this._drawFloors();
    this._drawGrid();
    this._drawDeco();
    if (ui.heat !== 'off') this._drawHeat(ui.heat);
    if (ui.trails) this._drawTrails(ui.advanced);
    if (ui.routes) this._drawRoutes();
    this._drawExits(ui);
    this._drawWalls();
    this._drawAgents(ui);
    this._drawGhosts(ui);
    this._screen();
    this._drawLabels();
    this.placed = [];
    this._drawExitTags(ui);
    if (ui.heat === 'jam') this._drawPins(sim.jamPins, ui);
    else this._drawHotspots(ui);
    this._drawPreview(ui);
    this._drawScaleBar();
  }

  _visible() {
    return {
      x0: Math.max(0, -this.ox / this.s), y0: Math.max(0, -this.oy / this.s),
      x1: Math.min(WORLD_W, (this.W - this.ox) / this.s), y1: Math.min(WORLD_H, (this.H - this.oy) / this.s),
    };
  }

  _drawFloors() {
    const ctx = this.ctx;
    for (const f of this.sim.floors) {
      ctx.fillStyle = f.kind === 'dance' ? '#140f2c' : '#0e1628';
      ctx.fillRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
      if (f.kind === 'dance') {
        ctx.fillStyle = 'rgba(160,110,255,0.06)';
        for (let y = f.y0, r = 0; y < f.y1; y += 2, r++) {
          for (let x = f.x0 + (r % 2) * 2; x < f.x1; x += 4) ctx.fillRect(x, y, Math.min(2, f.x1 - x), Math.min(2, f.y1 - y));
        }
      }
    }
  }

  _drawGrid() {
    const ctx = this.ctx, v = this._visible(), s = this.s;
    ctx.lineWidth = 1 / s;
    if (s >= 9) {
      ctx.beginPath();
      for (let x = Math.ceil(v.x0); x <= v.x1; x++) if (x % 5) { ctx.moveTo(x, v.y0); ctx.lineTo(x, v.y1); }
      for (let y = Math.ceil(v.y0); y <= v.y1; y++) if (y % 5) { ctx.moveTo(v.x0, y); ctx.lineTo(v.x1, y); }
      ctx.strokeStyle = 'rgba(120,150,210,0.055)';
      ctx.stroke();
    }
    ctx.beginPath();
    for (let x = Math.ceil(v.x0 / 5) * 5; x <= v.x1; x += 5) { ctx.moveTo(x, v.y0); ctx.lineTo(x, v.y1); }
    for (let y = Math.ceil(v.y0 / 5) * 5; y <= v.y1; y += 5) { ctx.moveTo(v.x0, y); ctx.lineTo(v.x1, y); }
    ctx.strokeStyle = 'rgba(120,150,210,0.11)';
    ctx.stroke();
  }

  _drawDeco() {
    const ctx = this.ctx;
    for (const d of this.sim.deco) {
      if (d.type === 'stairs') {
        ctx.beginPath();
        for (let y = d.y0 + 0.2; y < d.y1; y += 0.32) { ctx.moveTo(d.x0, y); ctx.lineTo(d.x1, y); }
        ctx.strokeStyle = 'rgba(160,185,230,0.2)'; ctx.lineWidth = 0.05; ctx.stroke();
        const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
        ctx.beginPath(); ctx.moveTo(cx - 0.5, cy - 0.3); ctx.lineTo(cx, cy + 0.3); ctx.lineTo(cx + 0.5, cy - 0.3);
        ctx.strokeStyle = 'rgba(170,200,255,0.45)'; ctx.lineWidth = 0.12; ctx.stroke();
      } else if (d.type === 'strip') {
        ctx.setLineDash([0.3, 0.2]);
        ctx.beginPath(); ctx.moveTo(d.x0, d.y); ctx.lineTo(d.x1, d.y);
        ctx.strokeStyle = 'rgba(255,205,80,0.55)'; ctx.lineWidth = 0.14; ctx.stroke();
        ctx.setLineDash([]);
      } else if (d.type === 'rails') {
        ctx.beginPath();
        for (let x = d.x0; x < d.x1; x += 0.65) { ctx.moveTo(x, d.y - 1.0); ctx.lineTo(x, d.y + 1.0); }
        ctx.strokeStyle = 'rgba(90,100,125,0.35)'; ctx.lineWidth = 0.12; ctx.stroke();
        ctx.beginPath();
        for (const o of [-0.72, 0.72]) { ctx.moveTo(d.x0, d.y + o); ctx.lineTo(d.x1, d.y + o); }
        ctx.strokeStyle = 'rgba(160,172,196,0.55)'; ctx.lineWidth = 0.08; ctx.stroke();
      }
    }
  }

  _drawLabels() {
    const ctx = this.ctx, px = Math.max(9, Math.min(15, this.s * 0.7));
    ctx.font = `600 ${px}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(175,195,235,0.3)';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(px * 0.25).toFixed(1)}px`;
    for (const d of this.sim.deco) {
      if (d.type !== 'label') continue;
      const p = this.toScreen(d.x, d.y);
      ctx.fillText(d.text, p.x, p.y);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  _drawHeat(mode) {
    const sim = this.sim, H = HEAT[mode], lut = H.lut, img = this.heatImg.data;
    let src, k, gamma = 1;
    if (mode === 'cong') { src = sim.hCongView; k = 1.7; gamma = 0.75; }
    else if (mode === 'dens') { src = sim.hDens; k = 1 / 6; }
    else if (mode === 'press') { src = sim.hPress; k = 1 / DANGER; }
    else { src = sim.hDelayView; k = sim.delayViewMax > 0.2 ? 1 / sim.delayViewMax : 0; gamma = 0.55; }
    for (let c = 0; c < HN; c++) {
      let v = src[c] * k;
      v = v <= 0 ? 0 : v >= 1 ? 1 : gamma === 1 ? v : Math.pow(v, gamma);
      const o = ((v * 255) | 0) * 4, q = c * 4;
      img[q] = lut[o]; img[q + 1] = lut[o + 1]; img[q + 2] = lut[o + 2]; img[q + 3] = lut[o + 3];
    }
    this.heatCtx.putImageData(this.heatImg, 0, 0);
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.heatCv, 0, 0, WORLD_W, WORLD_H);
  }

  _drawTrails(advanced) {
    const sim = this.sim, t = this.trailCtx, w = this.trailCv.width, h = this.trailCv.height;
    if (this.trailDirty) { t.clearRect(0, 0, w, h); this.trailDirty = false; }
    if (advanced) {
      t.globalCompositeOperation = 'destination-out';
      t.fillStyle = 'rgba(0,0,0,0.045)';
      t.fillRect(0, 0, w, h);
      t.globalCompositeOperation = 'source-over';
      t.fillStyle = 'rgba(125,195,255,0.2)';
      const d = this.dpr, s = this.s * d, ox = this.ox * d, oy = this.oy * d, sz = Math.max(1.5, 0.12 * s);
      for (let i = 0; i < sim.n; i++) t.fillRect(ox + sim.x[i] * s - sz / 2, oy + sim.y[i] * s - sz / 2, sz, sz);
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.trailCv, 0, 0);
    this._world();
  }

  _drawRoutes() {
    const sim = this.sim, ctx = this.ctx, v = this._visible();
    const step = this.s < 11 ? 2 : this.s < 22 ? 1.5 : 1, L = step * 0.34, hd = step * 0.16;
    const floors = sim.floors.filter((f) => f.kind === 'floor');
    const indoor = (x, y) => !floors.length || floors.some((f) => x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1);
    ctx.beginPath();
    for (let y = Math.floor(v.y0 / step) * step + step / 2; y < v.y1; y += step) {
      for (let x = Math.floor(v.x0 / step) * step + step / 2; x < v.x1; x += step) {
        if (!indoor(x, y)) continue;
        const c = ((y / CELL) | 0) * GW + ((x / CELL) | 0);
        if (sim.nearD[c] === Infinity || sim.blocked[c]) continue;
        const dx = sim.nearX[c], dy = sim.nearY[c];
        if (!dx && !dy) continue;
        const tx = x + dx * L, ty = y + dy * L;
        ctx.moveTo(x - dx * L, y - dy * L); ctx.lineTo(tx, ty);
        ctx.moveTo(tx - dx * hd - dy * hd * 0.8, ty - dy * hd + dx * hd * 0.8); ctx.lineTo(tx, ty);
        ctx.lineTo(tx - dx * hd + dy * hd * 0.8, ty - dy * hd - dx * hd * 0.8);
      }
    }
    ctx.strokeStyle = 'rgba(150,195,255,0.3)'; ctx.lineWidth = 1.2 / this.s; ctx.stroke();
  }

  _exitColor(e, ui) {
    const k = this.sim.exits.indexOf(e);
    return ui.color === 'exit' ? EXIT_COLORS[k % EXIT_COLORS.length] : EXIT_GREEN;
  }

  _drawExits(ui) {
    const ctx = this.ctx, s = this.s, now = ui.now;
    for (const e of this.sim.exits) {
      const w = e.x1 - e.x0, h = e.y1 - e.y0;
      if (e.open) {
        const col = this._exitColor(e, ui);
        const recent = e.times.length && this.sim.time - e.times[e.times.length - 1] < 1.5;
        const pulse = recent ? 0.5 + 0.5 * Math.sin(now * 6) : 0;
        ctx.globalAlpha = 0.14 + 0.12 * pulse;
        ctx.fillStyle = col;
        ctx.fillRect(e.x0 - 0.45, e.y0 - 0.45, w + 0.9, h + 0.9);
        ctx.globalAlpha = 0.4;
        ctx.fillRect(e.x0, e.y0, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col; ctx.lineWidth = 1.6 / s;
        ctx.strokeRect(e.x0, e.y0, w, h);
        if (e.out) {
          const cx = e.cx, cy = e.cy, ox = e.out.x, oy = e.out.y, span = Math.max(w, h);
          const n = Math.max(1, Math.min(4, Math.floor(span / 0.9))), a = 0.18, px = -oy, py = ox;
          ctx.beginPath();
          for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n - 0.5, bx = cx + px * t * span * 0.8, by = cy + py * t * span * 0.8;
            ctx.moveTo(bx - ox * a + px * a, by - oy * a + py * a); ctx.lineTo(bx + ox * a, by + oy * a);
            ctx.lineTo(bx - ox * a - px * a, by - oy * a - py * a);
          }
          ctx.strokeStyle = 'rgba(6,20,16,0.85)'; ctx.lineWidth = 0.09; ctx.stroke();
        }
      } else {
        ctx.fillStyle = 'rgba(255,70,95,0.3)';
        ctx.fillRect(e.x0, e.y0, w, h);
        ctx.strokeStyle = '#ff5a6e'; ctx.lineWidth = 1.6 / s;
        ctx.strokeRect(e.x0, e.y0, w, h);
        ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.lineTo(e.x1, e.y1); ctx.moveTo(e.x1, e.y0); ctx.lineTo(e.x0, e.y1);
        ctx.stroke();
      }
    }
  }

  _drawWalls() {
    const ctx = this.ctx, { groups, pil, pilHalo } = this._paths;
    for (const k of ['track', 'stage', 'bar', 'block', 'seat', 'gate', 'wall']) {
      const g = groups[k];
      if (!g) continue;
      const st = KIND_STYLE[k];
      if (st.halo) { ctx.fillStyle = st.halo; ctx.fill(g.halo); }
      ctx.fillStyle = st.fill; ctx.fill(g.fill);
      if (st.edge) { ctx.strokeStyle = st.edge; ctx.lineWidth = 1.3 / this.s; ctx.stroke(g.fill); }
    }
    ctx.fillStyle = KIND_STYLE.wall.halo; ctx.fill(pilHalo);
    ctx.fillStyle = KIND_STYLE.wall.fill; ctx.fill(pil);
  }

  _drawAgents(ui) {
    const sim = this.sim, ctx = this.ctx, n = sim.n, v = this._visible();
    const bk = this._bk, cnt = this._cnt, order = this._order;
    const byExit = ui.color === 'exit';
    cnt.fill(0);
    for (let i = 0; i < n; i++) {
      let b;
      if (sim.tgt[i] < 0) b = 12;
      else if (sim.pressS[i] > DANGER) b = 13;
      else if (byExit) b = sim.tgt[i] % 12;
      else {
        const t = 1 - sim.spd[i] / (0.8 * sim.v0 * sim.vf[i]);
        b = t <= 0 ? 0 : t >= 1 ? 11 : Math.round(t * 11);
      }
      bk[i] = b; cnt[b + 1]++;
    }
    for (let b = 1; b < 15; b++) cnt[b] += cnt[b - 1];
    const fillp = cnt.slice(0, 15);
    for (let i = 0; i < n; i++) order[fillp[bk[i]]++] = i;
    const colors = byExit ? EXIT_COLORS : SPEED_COLORS;
    const pad = 0.5, x0 = v.x0 - pad, x1 = v.x1 + pad, y0 = v.y0 - pad, y1 = v.y1 + pad;
    for (let b = 0; b < 14; b++) {
      const a = cnt[b], e = cnt[b + 1];
      if (a === e) continue;
      ctx.fillStyle = b === 12 ? TRAPPED : b === 13 ? DANGER_C : colors[b];
      ctx.beginPath();
      for (let k = a; k < e; k++) {
        const i = order[k], x = sim.x[i], y = sim.y[i];
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        const r = sim.r[i];
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, PI2);
      }
      ctx.fill();
    }
    if (this.s >= 9) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = sim.x[i], y = sim.y[i];
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        let dx = sim.vx[i], dy = sim.vy[i], m = Math.hypot(dx, dy);
        if (m < 0.12) { dx = sim.ex[i]; dy = sim.ey[i]; m = Math.hypot(dx, dy); }
        if (m < 1e-6) continue;
        const r = sim.r[i], hx = x + (dx / m) * r * 0.45, hy = y + (dy / m) * r * 0.45, hr = r * 0.4;
        ctx.moveTo(hx + hr, hy); ctx.arc(hx, hy, hr, 0, PI2);
      }
      ctx.fillStyle = 'rgba(5,9,20,0.42)';
      ctx.fill();
    }
    if (sim.dangerCount) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (sim.pressS[i] <= DANGER) continue;
        const r = sim.r[i] + 0.14;
        ctx.moveTo(sim.x[i] + r, sim.y[i]); ctx.arc(sim.x[i], sim.y[i], r, 0, PI2);
      }
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(ui.now * 8);
      ctx.strokeStyle = DANGER_C; ctx.lineWidth = 1.6 / this.s; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  _drawGhosts(ui) {
    const ctx = this.ctx;
    for (const g of this.sim.ghosts) {
      const e = this.sim.exits[g.k];
      ctx.globalAlpha = Math.max(0, g.life) * 0.8;
      ctx.fillStyle = e ? this._exitColor(e, ui) : EXIT_GREEN;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r * (0.5 + 0.5 * g.life), 0, PI2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _free(x, y, w, h) {
    if (x < 4 || y < 4 || x + w > this.W - 4 || y + h > this.H - 4) return false;
    const hit = (b) => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y;
    return !this.placed.some(hit) && !(this.blockers || []).some(hit);
  }

  _pill(x, y, lines, accent, alpha = 1) {
    const ctx = this.ctx;
    ctx.font = `700 12px ${FONT}`;
    const w0 = ctx.measureText(lines[0]).width;
    ctx.font = `500 11px ${FONT}`;
    const w1 = lines[1] ? ctx.measureText(lines[1]).width : 0;
    const w = Math.max(w0, w1) + 18, h = lines[1] ? 34 : 20;
    return { w, h, draw: (bx, by) => {
      ctx.globalAlpha = alpha;
      roundRect(ctx, bx, by, w, h, 6);
      ctx.fillStyle = 'rgba(10,14,26,0.88)'; ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = accent; ctx.fillRect(bx, by + 5, 2.5, h - 10);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `700 12px ${FONT}`; ctx.fillStyle = '#f1f5ff';
      ctx.fillText(lines[0], bx + 10, by + (lines[1] ? 11 : h / 2));
      if (lines[1]) { ctx.font = `500 11px ${FONT}`; ctx.fillStyle = 'rgba(200,212,240,0.8)'; ctx.fillText(lines[1], bx + 10, by + 24); }
      ctx.globalAlpha = 1;
    } };
  }

  _drawHotspots(ui) {
    const ctx = this.ctx, sim = this.sim, s = this.s;
    const spots = sim.hotspots.slice(0, 4);
    for (const h of spots) {
      h.dx += (h.x - h.dx) * 0.12; h.dy += (h.y - h.dy) * 0.12; h.drad += (Math.min(7, h.rad) - h.drad) * 0.12;
      const p = this.toScreen(h.dx, h.dy), R = h.drad * s;
      const hot = ui.highlight === h.id;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
      g.addColorStop(0, 'rgba(255,70,80,0.0)'); g.addColorStop(0.75, 'rgba(255,70,80,0.06)'); g.addColorStop(1, 'rgba(255,70,80,0.16)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, PI2); ctx.fill();
      ctx.setLineDash([7, 5]); ctx.lineDashOffset = -ui.now * 18;
      ctx.strokeStyle = hot ? '#ffffff' : 'rgba(255,92,92,0.95)'; ctx.lineWidth = hot ? 2.5 : 1.8;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const h of spots) {
      const p = this.toScreen(h.dx, h.dy), R = h.drad * this.s;
      const pill = this._pill(0, 0, [`JAM · ${Math.round(h.ppl)} people`, `${h.name} · ${h.peak.toFixed(1)}/m²`], '#ff5c5c');
      const cands = [[p.x - pill.w / 2, p.y - R - pill.h - 6], [p.x - pill.w / 2, p.y + R + 6], [p.x + R + 8, p.y - pill.h / 2], [p.x - R - 8 - pill.w, p.y - pill.h / 2]];
      for (const [bx, by] of cands) {
        if (!this._free(bx, by, pill.w, pill.h)) continue;
        this.placed.push({ x: bx, y: by, w: pill.w, h: pill.h });
        pill.draw(bx, by);
        break;
      }
    }
  }

  _drawPins(pins, ui) {
    const ctx = this.ctx;
    pins.forEach((pn, k) => {
      const p = this.toScreen(pn.x, pn.y);
      ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, PI2);
      ctx.fillStyle = k === 0 ? '#ff5c5c' : '#ff9f43'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#0a0e1a'; ctx.stroke();
      ctx.fillStyle = '#0a0e1a'; ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(k + 1), p.x, p.y + 0.5);
      this.placed.push({ x: p.x - 12, y: p.y - 12, w: 24, h: 24 });
    });
    pins.forEach((pn, k) => {
      const p = this.toScreen(pn.x, pn.y);
      const mins = pn.sec / 60;
      const pill = this._pill(0, 0, [`#${k + 1} ${pn.name}`, `${mins >= 10 ? mins.toFixed(0) : mins.toFixed(1)} person-min lost`], k === 0 ? '#ff5c5c' : '#ff9f43');
      for (const [bx, by] of [[p.x + 16, p.y - pill.h / 2], [p.x - 16 - pill.w, p.y - pill.h / 2], [p.x - pill.w / 2, p.y - 16 - pill.h], [p.x - pill.w / 2, p.y + 16]]) {
        if (!this._free(bx, by, pill.w, pill.h)) continue;
        this.placed.push({ x: bx, y: by, w: pill.w, h: pill.h });
        pill.draw(bx, by);
        break;
      }
    });
  }

  _drawExitTags(ui) {
    const ctx = this.ctx;
    for (const e of this.sim.exits) {
      if (!e.out) continue;
      const depth = e.out.x ? (e.x1 - e.x0) / 2 : (e.y1 - e.y0) / 2;
      const a = this.toScreen(e.cx + e.out.x * depth, e.cy + e.out.y * depth);
      const col = e.open ? this._exitColor(e, ui) : '#ff5a6e';
      const txt = e.open ? String(e.count) : 'CLOSED';
      ctx.font = `700 11px ${FONT}`;
      const tw = ctx.measureText(txt).width, w = 26 + tw, h = 20;
      let bx = a.x + e.out.x * 10 - (e.out.x ? (e.out.x < 0 ? w : 0) : w / 2);
      let by = a.y + e.out.y * 10 - (e.out.y ? (e.out.y < 0 ? h : 0) : h / 2);
      const rg = this.region;
      bx = Math.max(rg.x - 4, Math.min(rg.x + rg.w - w + 4, bx)); by = Math.max(rg.y - 30, Math.min(rg.y + rg.h - h + 4, by));
      roundRect(ctx, bx, by, w, h, 10);
      ctx.fillStyle = 'rgba(8,12,22,0.9)'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(bx + 10, by + h / 2, 7, 0, PI2); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#07110d'; ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(e.label, bx + 10, by + h / 2 + 0.5);
      ctx.fillStyle = e.open ? '#eafff6' : '#ffd0d6'; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText(txt, bx + 21, by + h / 2 + 0.5);
      this.placed.push({ x: bx, y: by, w, h });
    }
  }

  _drawPreview(ui) {
    const p = ui.preview, ctx = this.ctx;
    if (!p || (p.type === 'exitHover' && !this.sim.exits.includes(p.exit))) return;
    this._world();
    const s = this.s;
    if (p.type === 'wall') {
      const path = new Path2D();
      segPoly(path, { x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1, t: 0.3 }, 0);
      ctx.fillStyle = 'rgba(205,215,234,0.6)'; ctx.fill(path);
      ctx.strokeStyle = '#9fc1ff'; ctx.lineWidth = 1.2 / s; ctx.stroke(path);
    } else if (p.type === 'exit') {
      ctx.fillStyle = 'rgba(52,227,164,0.22)'; ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
      ctx.setLineDash([4 / s, 3 / s]); ctx.strokeStyle = EXIT_GREEN; ctx.lineWidth = 1.5 / s;
      ctx.strokeRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0); ctx.setLineDash([]);
    } else if (p.type === 'brush') {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, PI2);
      ctx.fillStyle = p.fill; ctx.fill();
      ctx.setLineDash([4 / s, 3 / s]); ctx.strokeStyle = p.color; ctx.lineWidth = 1.4 / s; ctx.stroke(); ctx.setLineDash([]);
    } else if (p.type === 'pillar') {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, PI2);
      ctx.fillStyle = 'rgba(205,215,234,0.55)'; ctx.fill();
      ctx.strokeStyle = '#9fc1ff'; ctx.lineWidth = 1.2 / s; ctx.stroke();
    } else if (p.type === 'exitHover') {
      const e = p.exit;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 / s;
      ctx.strokeRect(e.x0 - 0.2, e.y0 - 0.2, e.x1 - e.x0 + 0.4, e.y1 - e.y0 + 0.4);
    }
    this._screen();
    if (p.label) {
      const q = this.toScreen(p.lx, p.ly), rg = this.region;
      ctx.font = `600 11px ${FONT}`;
      const w = ctx.measureText(p.label).width + 12;
      const bx = Math.min(q.x + 12, rg.x + rg.w - w), by = Math.max(rg.y - 40, q.y - 24);
      roundRect(ctx, bx, by, w, 18, 5);
      ctx.fillStyle = 'rgba(8,12,22,0.9)'; ctx.fill();
      ctx.fillStyle = '#dbe6ff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(p.label, bx + 6, by + 9);
    }
  }

  _drawScaleBar() {
    const ctx = this.ctx, r = this.region;
    const target = 90 / this.s;
    const m = [1, 2, 5, 10, 20].find((v) => v >= target * 0.6) || 20;
    const w = m * this.s, x = r.x + 6, y = r.y + r.h - 8;
    ctx.strokeStyle = 'rgba(190,205,235,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y - 5); ctx.stroke();
    ctx.fillStyle = 'rgba(190,205,235,0.7)'; ctx.font = `600 10px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${m} m`, x + w + 6, y + 1);
  }
}

export function drawChart(cv, sim, ghost) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const S = sim.samples, last = S[S.length - 1];
  const gl = ghost && ghost.length ? ghost[ghost.length - 1].t : 0;
  const tMax = Math.max(60, Math.ceil((Math.max(last.t, gl) * 1.08) / 30) * 30);
  const padL = 28, padB = 14, top = 7, pw = W - padL - 4, ph = H - padB - top;
  const X = (t) => padL + (t / tMax) * pw, Y = (f) => top + ph - f * ph;
  ctx.font = `500 9px ${FONT}`; ctx.fillStyle = 'rgba(150,165,195,0.7)'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(140,160,200,0.12)'; ctx.lineWidth = 1;
  for (const f of [0, 0.5, 1]) {
    ctx.beginPath(); ctx.moveTo(padL, Y(f) + 0.5); ctx.lineTo(padL + pw, Y(f) + 0.5); ctx.stroke();
    ctx.fillText(`${f * 100}%`, padL - 4, Y(f));
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let t = 0; t <= tMax; t += tMax <= 120 ? 30 : tMax <= 300 ? 60 : 120) ctx.fillText(`${t}s`, Math.min(W - 10, Math.max(padL + 6, X(t))), top + ph + 3);
  let maxF = 4;
  for (const p of S) if (p.flow > maxF) maxF = p.flow;
  ctx.fillStyle = 'rgba(108,190,255,0.28)';
  const bw = Math.max(1, (0.5 / tMax) * pw);
  for (const p of S) { const h = (p.flow / maxF) * ph * 0.45; ctx.fillRect(X(p.t) - bw, top + ph - h, bw, h); }
  if (ghost && ghost.length > 1) {
    ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(190,200,225,0.45)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ghost.forEach((p, k) => { const f = p.total ? p.evac / p.total : 0; if (k) ctx.lineTo(X(p.t), Y(f)); else ctx.moveTo(X(p.t), Y(f)); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  if (S.length > 1) {
    ctx.beginPath();
    S.forEach((p, k) => { const f = p.total ? p.evac / p.total : 0; if (k) ctx.lineTo(X(p.t), Y(f)); else ctx.moveTo(X(p.t), Y(f)); });
    const lx = X(last.t);
    ctx.strokeStyle = EXIT_GREEN; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.lineTo(lx, Y(0)); ctx.lineTo(X(0), Y(0)); ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, top + ph);
    g.addColorStop(0, 'rgba(52,227,164,0.22)'); g.addColorStop(1, 'rgba(52,227,164,0)');
    ctx.fillStyle = g; ctx.fill();
    const f = last.total ? last.evac / last.total : 0;
    ctx.beginPath(); ctx.arc(lx, Y(f), 2.8, 0, PI2); ctx.fillStyle = '#eafff6'; ctx.fill();
  }
}

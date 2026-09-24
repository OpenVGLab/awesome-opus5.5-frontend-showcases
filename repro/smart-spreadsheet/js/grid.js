// Canvas grid: virtualised rendering with frozen panes, merges, overflow text,
// borders, filter buttons, selection and mouse interaction.
import { colName, clamp, FONT_STACK } from './util.js';
import { cellDisplay, cellValue, isBlank } from './model.js';

const C = {
  grid: '#E4E7ED', headerBg: '#F7F8FA', headerText: '#6B7280', headerLine: '#E2E5EB',
  accent: '#4F46E5', fill: 'rgba(79,70,229,0.09)', headerSel: '#ECEEFD', headerSelText: '#4338CA', headerFull: '#DDE1FB',
  text: '#1F2937', err: '#DC2626', freeze: '#C5CBD6', filtered: '#2563EB',
};
const PAD = 6;
const BTN = 17;

function upperBound(arr, v, n) {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export class Grid {
  constructor(app, wrap) {
    this.app = app;
    this.wrap = wrap;
    this.canvas = wrap.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scroller = wrap.querySelector('.grid-scroll');
    this.spacer = wrap.querySelector('.grid-spacer');
    this.hw = 46;
    this.hh = 26;
    this.sx = 0;
    this.sy = 0;
    this.W = 0;
    this.H = 0;
    this.dpr = 1;
    this.colX = new Float64Array(1);
    this.rowY = new Float64Array(1);
    this.drag = null;
    this.pending = false;
    this.guide = null;
    new ResizeObserver(() => this.resize()).observe(wrap);
    this.scroller.addEventListener('scroll', () => this.onScroll());
    this.scroller.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.scroller.addEventListener('mousemove', (e) => this.onHover(e));
    this.scroller.addEventListener('dblclick', (e) => this.onDblClick(e));
    this.scroller.addEventListener('contextmenu', (e) => this.onContextMenu(e));
  }

  get sheet() { return this.app.wb.sheet; }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.W = this.scroller.clientWidth;
    this.H = this.scroller.clientHeight;
    this.canvas.width = Math.max(1, Math.round(this.W * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.H * this.dpr));
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.draw();
    this.app.onGridScroll();
  }

  layout() {
    const sh = this.sheet;
    const nC = sh.cols;
    const nR = sh.rows;
    if (this.colX.length !== nC + 1) this.colX = new Float64Array(nC + 1);
    for (let c = 0; c < nC; c++) this.colX[c + 1] = this.colX[c] + sh.colWidth(c);
    if (this.rowY.length !== nR + 1) this.rowY = new Float64Array(nR + 1);
    const hid = sh.hidden;
    for (let r = 0; r < nR; r++) this.rowY[r + 1] = this.rowY[r] + (hid.size && hid.has(r) ? 0 : sh.rowHeight(r));
    this.hw = Math.max(46, 20 + String(nR).length * 8);
    const w = Math.ceil(this.hw + this.colX[nC] + 60);
    const h = Math.ceil(this.hh + this.rowY[nR] + 60);
    if (w !== this._sw) { this.spacer.style.width = w + 'px'; this._sw = w; }
    if (h !== this._sh) { this.spacer.style.height = h + 'px'; this._sh = h; }
  }

  requestDraw() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.draw();
    });
  }

  onScroll() {
    this.sx = this.scroller.scrollLeft;
    this.sy = this.scroller.scrollTop;
    const sh = this.sheet;
    if (this._sh && this.sy + this.H > this._sh - 240 && sh.rows < 100000) sh.rows += 100;
    if (this._sw && this.sx + this.W > this._sw - 240 && sh.cols < 702) sh.cols += 8;
    this.draw();
    this.app.onGridScroll();
  }

  colW(c) { return this.colX[c + 1] - this.colX[c]; }
  rowH(r) { return this.rowY[r + 1] - this.rowY[r]; }
  colLeft(c) { return this.hw + this.colX[c] - (c >= this.sheet.freeze.c ? this.sx : 0); }
  rowTop(r) { return this.hh + this.rowY[r] - (r >= this.sheet.freeze.r ? this.sy : 0); }

  // Screen rect of a cell (merge-aware) in its natural pane.
  cellRect(r, c) {
    const sh = this.sheet;
    const m = sh.mergeAt(r, c) || { r1: r, c1: c, r2: r, c2: c };
    const x = this.colLeft(m.c1);
    const y = this.rowTop(m.r1);
    return { x, y, w: this.colX[m.c2 + 1] - this.colX[m.c1], h: this.rowY[m.r2 + 1] - this.rowY[m.r1] };
  }

  // Content-space scroll needed to reveal a cell.
  scrollIntoView(r, c) {
    const sh = this.sheet;
    const fw = this.colX[sh.freeze.c];
    const fh = this.rowY[sh.freeze.r];
    if (c >= sh.freeze.c) {
      const left = this.colX[c] - fw;
      const right = this.colX[Math.min(c + 1, sh.cols)] - fw;
      const view = this.W - this.hw - fw;
      if (left < this.sx) this.scroller.scrollLeft = left;
      else if (right > this.sx + view) this.scroller.scrollLeft = Math.max(0, right - view);
    }
    if (r >= sh.freeze.r) {
      const top = this.rowY[r] - fh;
      const bottom = this.rowY[Math.min(r + 1, sh.rows)] - fh;
      const view = this.H - this.hh - fh;
      if (top < this.sy) this.scroller.scrollTop = top;
      else if (bottom > this.sy + view) this.scroller.scrollTop = Math.max(0, bottom - view);
    }
  }

  visCols() {
    const sh = this.sheet;
    const fc = sh.freeze.c;
    const n = sh.cols + 1;
    const c0 = Math.max(fc, upperBound(this.colX, this.colX[fc] + this.sx, n) - 1);
    const c1 = Math.min(sh.cols - 1, upperBound(this.colX, this.W - this.hw + this.sx, n) - 1);
    return [c0, c1];
  }
  visRows() {
    const sh = this.sheet;
    const fr = sh.freeze.r;
    const n = sh.rows + 1;
    const r0 = Math.max(fr, upperBound(this.rowY, this.rowY[fr] + this.sy, n) - 1);
    const r1 = Math.min(sh.rows - 1, upperBound(this.rowY, this.H - this.hh + this.sy, n) - 1);
    return [r0, r1];
  }
  pageRows() {
    return Math.max(1, Math.floor((this.H - this.hh) / 24) - 1);
  }

  /* ---------- drawing ---------- */

  draw() {
    if (!this.W || !this.H || !this.app.wb) return;
    const sh = this.sheet;
    const ctx = this.ctx;
    this.layout();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.W, this.H);
    const fr = sh.freeze.r;
    const fc = sh.freeze.c;
    const fw = this.colX[fc];
    const fh = this.rowY[fr];
    const [c0, c1] = this.visCols();
    const [r0, r1] = this.visRows();
    const { hw, hh, W, H } = this;
    const regions = [{ rows: [r0, r1], cols: [c0, c1], sR: true, sC: true, clip: [hw + fw, hh + fh, W - hw - fw, H - hh - fh] }];
    if (fr > 0) regions.push({ rows: [0, fr - 1], cols: [c0, c1], sR: false, sC: true, clip: [hw + fw, hh, W - hw - fw, fh] });
    if (fc > 0) regions.push({ rows: [r0, r1], cols: [0, fc - 1], sR: true, sC: false, clip: [hw, hh + fh, fw, H - hh - fh] });
    if (fr > 0 && fc > 0) regions.push({ rows: [0, fr - 1], cols: [0, fc - 1], sR: false, sC: false, clip: [hw, hh, fw, fh] });
    for (const reg of regions) this.drawRegion(reg);
    this.drawHeaders(r0, r1, c0, c1);
    ctx.fillStyle = C.freeze;
    if (fr > 0) ctx.fillRect(0, hh + fh - 1, W, 2);
    if (fc > 0) ctx.fillRect(hw + fw - 1, 0, 2, H);
    if (this.guide) {
      ctx.fillStyle = C.accent;
      if (this.guide.axis === 'col') ctx.fillRect(this.guide.pos - 1, 0, 2, H);
      else ctx.fillRect(0, this.guide.pos - 1, W, 2);
      ctx.font = `600 11px ${FONT_STACK}`;
      const label = `${Math.round(this.guide.size)} px`;
      const tw = ctx.measureText(label).width + 12;
      const bx = this.guide.axis === 'col' ? this.guide.pos + 6 : 6;
      const by = this.guide.axis === 'col' ? 4 : this.guide.pos + 6;
      ctx.fillStyle = '#111827';
      this.roundRect(bx, by, tw, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + 6, by + 9.5);
    }
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  display(cell) {
    if (this.app.showFormulas && cell.f !== undefined) return { text: '=' + cell.f, align: 'left' };
    return cellDisplay(cell);
  }

  emptyForOverflow(r, c) {
    const sh = this.sheet;
    const cell = sh.get(r, c);
    if (cell && (!isBlank(cell) || (cell.s && cell.s.bg))) return false;
    return !sh.mergeAt(r, c);
  }

  drawRegion(reg) {
    const ctx = this.ctx;
    const sh = this.sheet;
    const app = this.app;
    const [ra, rb] = reg.rows;
    const [ca, cb] = reg.cols;
    if (rb < ra || cb < ca || reg.clip[2] <= 0 || reg.clip[3] <= 0) return;
    const X = (c) => this.hw + this.colX[c] - (reg.sC ? this.sx : 0);
    const Y = (r) => this.hh + this.rowY[r] - (reg.sR ? this.sy : 0);
    const hidden = (r) => this.rowY[r + 1] === this.rowY[r];
    ctx.save();
    ctx.beginPath();
    ctx.rect(...reg.clip);
    ctx.clip();

    if (sh.showGrid) {
      ctx.fillStyle = C.grid;
      const yT = Y(ra);
      const yB = Y(rb + 1);
      const xL = X(ca);
      const xR = X(cb + 1);
      for (let c = ca; c <= cb; c++) ctx.fillRect(Math.round(X(c + 1)) - 1, yT, 1, yB - yT);
      for (let r = ra; r <= rb; r++) if (!hidden(r)) ctx.fillRect(xL, Math.round(Y(r + 1)) - 1, xR - xL, 1);
    }
    for (let r = ra; r <= rb; r++) {
      if (hidden(r)) continue;
      for (let c = ca; c <= cb; c++) {
        const cell = sh.get(r, c);
        if (cell && cell.s && cell.s.bg && !sh.mergeAt(r, c)) {
          ctx.fillStyle = cell.s.bg;
          ctx.fillRect(X(c), Y(r), this.colW(c), this.rowH(r));
        }
      }
    }
    const merges = sh.merges.filter((m) => m.r2 >= ra && m.r1 <= rb && m.c2 >= ca && m.c1 <= cb);
    for (const m of merges) {
      const x = X(m.c1);
      const y = Y(m.r1);
      const w = X(m.c2 + 1) - x;
      const h = Y(m.r2 + 1) - y;
      if (h <= 0) continue;
      const cell = sh.get(m.r1, m.c1);
      const bg = cell && cell.s && cell.s.bg;
      ctx.fillStyle = bg || '#fff';
      if (bg || !sh.showGrid) ctx.fillRect(x, y, w, h);
      else ctx.fillRect(x, y, w - 1, h - 1);
    }

    ctx.textBaseline = 'middle';
    for (let r = ra; r <= rb; r++) {
      if (hidden(r)) continue;
      for (let c = ca; c <= cb; c++) {
        const cell = sh.get(r, c);
        if (!cell || sh.mergeAt(r, c)) continue;
        const disp = this.display(cell);
        if (!disp) continue;
        this.drawText(cell, disp, X(c), Y(r), this.colW(c), this.rowH(r), r, c, false);
      }
    }
    for (const m of merges) {
      const cell = sh.get(m.r1, m.c1);
      if (!cell) continue;
      const disp = this.display(cell);
      if (!disp) continue;
      const x = X(m.c1);
      const y = Y(m.r1);
      this.drawText(cell, disp, x, y, X(m.c2 + 1) - x, Y(m.r2 + 1) - y, m.r1, m.c1, true);
    }

    for (let r = ra; r <= rb; r++) {
      if (hidden(r)) continue;
      for (let c = ca; c <= cb; c++) {
        const cell = sh.get(r, c);
        if (!cell || !cell.s || !cell.s.bd) continue;
        const m = sh.mergeAt(r, c);
        if (m && (m.r1 !== r || m.c1 !== c)) continue;
        const g = m || { r1: r, c1: c, r2: r, c2: c };
        const x = X(g.c1);
        const y = Y(g.r1);
        this.drawBorders(cell.s.bd, x, y, X(g.c2 + 1) - x, Y(g.r2 + 1) - y);
      }
    }

    const f = sh.filter;
    if (f && f.r1 >= ra && f.r1 <= rb && !hidden(f.r1)) {
      for (let c = Math.max(ca, f.c1); c <= Math.min(cb, f.c2); c++) {
        const active = f.crit && f.crit[c] && (f.crit[c].values || f.crit[c].cond);
        this.drawFilterButton(X(c) + this.colW(c) - BTN - 4, Y(f.r1) + (this.rowH(f.r1) - BTN) / 2, active);
      }
    }

    const rect = (g) => {
      const x = X(g.c1);
      const y = Y(g.r1);
      return { x, y, w: X(g.c2 + 1) - x, h: Y(g.r2 + 1) - y };
    };
    for (const hl of app.refHighlights || []) {
      if (hl.sheetId !== sh.id) continue;
      const q = rect(hl.g);
      ctx.fillStyle = hl.color + '1A';
      ctx.fillRect(q.x, q.y, q.w, q.h);
      ctx.strokeStyle = hl.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(hl.active ? [5, 3] : []);
      ctx.strokeRect(q.x + 0.5, q.y + 0.5, q.w - 2, q.h - 2);
      ctx.setLineDash([]);
      ctx.fillStyle = hl.color;
      for (const [px, py] of [[q.x, q.y], [q.x + q.w - 2, q.y], [q.x, q.y + q.h - 2], [q.x + q.w - 2, q.y + q.h - 2]]) ctx.fillRect(px - 2, py - 2, 5, 5);
    }
    if (app.clip && app.clip.blk.sheetId === sh.id) {
      const q = rect(app.clip.blk.g);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -app.marchOffset;
      ctx.strokeRect(q.x + 1, q.y + 1, q.w - 3, q.h - 3);
      ctx.setLineDash([]);
    }
    if (app.fillPreview) {
      const q = rect(app.fillPreview);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(q.x + 0.5, q.y + 0.5, q.w - 2, q.h - 2);
      ctx.setLineDash([]);
    }
    if (!app.hideSelection) {
      const g = app.selRange();
      const q = rect(g);
      const am = sh.mergeAt(app.sel.ar, app.sel.ac) || { r1: app.sel.ar, c1: app.sel.ac, r2: app.sel.ar, c2: app.sel.ac };
      const a = rect(am);
      const multi = g.r1 !== g.r2 || g.c1 !== g.c2;
      if (multi && !(am.r1 === g.r1 && am.c1 === g.c1 && am.r2 === g.r2 && am.c2 === g.c2)) {
        ctx.fillStyle = C.fill;
        ctx.beginPath();
        ctx.rect(q.x, q.y, q.w, q.h);
        ctx.rect(a.x, a.y, a.w, a.h);
        ctx.fill('evenodd');
      }
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(q.x, q.y, q.w - 1, q.h - 1);
      if (!app.edit) {
        const hx = q.x + q.w - 4;
        const hy = q.y + q.h - 4;
        ctx.fillStyle = '#fff';
        ctx.fillRect(hx - 1.5, hy - 1.5, 9, 9);
        ctx.fillStyle = C.accent;
        ctx.fillRect(hx, hy, 6, 6);
      }
    }
    ctx.restore();
  }

  drawBorders(bd, x, y, w, h) {
    const ctx = this.ctx;
    const side = (v, fn) => {
      if (!v) return;
      const [color, wd] = String(v).split('|');
      ctx.fillStyle = color;
      fn(wd === '2' ? 2 : 1);
    };
    side(bd.t, (lw) => ctx.fillRect(x - 1, y - 1, w + 1, lw));
    side(bd.b, (lw) => ctx.fillRect(x - 1, y + h - lw, w + 1, lw));
    side(bd.l, (lw) => ctx.fillRect(x - 1, y - 1, lw, h + 1));
    side(bd.r, (lw) => ctx.fillRect(x + w - lw, y - 1, lw, h + 1));
  }

  drawFilterButton(x, y, active) {
    const ctx = this.ctx;
    this.roundRect(x, y, BTN, BTN, 4);
    ctx.fillStyle = active ? C.accent : '#fff';
    ctx.fill();
    ctx.strokeStyle = active ? C.accent : '#C9CFDA';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = active ? '#fff' : '#5B6474';
    ctx.fillStyle = active ? '#fff' : '#5B6474';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (active) {
      ctx.moveTo(x + 4.5, y + 5);
      ctx.lineTo(x + BTN - 4.5, y + 5);
      ctx.lineTo(x + BTN / 2 + 1.5, y + 9.5);
      ctx.lineTo(x + BTN / 2 + 1.5, y + 13);
      ctx.lineTo(x + BTN / 2 - 1.5, y + 12);
      ctx.lineTo(x + BTN / 2 - 1.5, y + 9.5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(x + 5, y + 7);
      ctx.lineTo(x + BTN / 2, y + 11);
      ctx.lineTo(x + BTN - 5, y + 7);
      ctx.stroke();
    }
  }

  fitGeneral(v, avail) {
    for (let p = 9; p >= 1; p--) {
      let s = String(parseFloat(v.toPrecision(p)));
      if (s.includes('e')) s = v.toExponential(Math.max(0, p - 1)).replace('e', 'E').replace(/E([+-])(\d)$/, 'E$10$2');
      if (this.ctx.measureText(s).width <= avail) return s;
    }
    return '#';
  }

  drawText(cell, disp, x, y, w, h, r, c, merged) {
    const ctx = this.ctx;
    const s = cell.s || {};
    const fs = s.fs ? Math.round(((s.fs * 4) / 3) * 10) / 10 : 13;
    ctx.font = `${s.i ? 'italic ' : ''}${s.b ? 600 : 400} ${fs}px ${FONT_STACK}`;
    let text = disp.text;
    let align = s.ha || disp.align;
    const f = this.sheet.filter;
    const btn = f && r === f.r1 && c >= f.c1 && c <= f.c2 ? BTN + 4 : 0;
    const avail = w - PAD * 2 - btn;
    let tw = ctx.measureText(text).width;
    if (!disp.num && !s.wrap && align !== 'left' && tw > avail) align = 'left';
    if (disp.num && tw > avail) {
      if (disp.general) text = this.fitGeneral(cellValue(cell), avail);
      tw = ctx.measureText(text).width;
      if (tw > avail) {
        const hw = ctx.measureText('#').width;
        text = '#'.repeat(Math.max(1, Math.floor(avail / hw)));
        tw = ctx.measureText(text).width;
      }
    }
    let clipW = w;
    if (!disp.num && !merged && !s.wrap && !btn && align === 'left' && tw > avail) {
      let x2 = x + w;
      let k = c + 1;
      const sh = this.sheet;
      while (x + PAD + tw > x2 - 2 && k < sh.cols && this.emptyForOverflow(r, k)) {
        x2 += this.colW(k);
        k++;
      }
      if (x2 > x + w) {
        clipW = x2 - x;
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + w - 1, y, x2 - x - w, h - 1);
      }
    }
    ctx.fillStyle = disp.err ? C.err : disp.color || s.fc || C.text;
    const va = s.va || 'middle';
    const lh = Math.round(fs * 1.3);
    let lines = [text];
    if (s.wrap && !disp.num && tw > avail) {
      lines = [];
      for (const para of String(text).split('\n')) {
        let line = '';
        for (const word of para.split(/(\s+)/)) {
          const test = line + word;
          if (line && ctx.measureText(test).width > avail) {
            lines.push(line.trimEnd());
            line = word.trimStart();
          } else line = test;
        }
        lines.push(line);
      }
    }
    const blockH = lines.length * lh;
    let ty = va === 'top' ? y + 4 + lh / 2 : va === 'bottom' ? y + h - 4 - blockH + lh / 2 : y + (h - blockH) / 2 + lh / 2 + 0.5;
    const tx = align === 'right' ? x + w - PAD - btn : align === 'center' ? x + (w - btn) / 2 : x + PAD;
    ctx.textAlign = align === 'right' ? 'right' : align === 'center' ? 'center' : 'left';
    const needClip = tw > avail + 0.5 || clipW !== w || lines.length > 1 || h < fs + 4;
    if (needClip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 1, y + 1, clipW - 2, h - 2);
      ctx.clip();
    }
    for (const line of lines) {
      ctx.fillText(line, tx, ty);
      if (s.u || s.st) {
        const lw = ctx.measureText(line).width;
        const lx = align === 'right' ? tx - lw : align === 'center' ? tx - lw / 2 : tx;
        if (s.u) ctx.fillRect(lx, Math.round(ty + fs * 0.45), lw, 1);
        if (s.st) ctx.fillRect(lx, Math.round(ty), lw, 1);
      }
      ty += lh;
    }
    if (needClip) ctx.restore();
  }

  drawHeaders(r0, r1, c0, c1) {
    const ctx = this.ctx;
    const sh = this.sheet;
    const { hw, hh, W, H } = this;
    const g = this.app.selRange();
    const fullCols = g.r1 === 0 && g.r2 >= sh.rows - 1;
    const fullRows = g.c1 === 0 && g.c2 >= sh.cols - 1;
    const fc = sh.freeze.c;
    const fr = sh.freeze.r;
    const fw = this.colX[fc];
    const fh = this.rowY[fr];
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.headerBg;
    ctx.fillRect(hw, 0, W - hw, hh);
    ctx.fillRect(0, hh, hw, H - hh);
    ctx.fillStyle = C.headerLine;
    ctx.fillRect(0, hh - 1, W, 1);
    ctx.fillRect(hw - 1, 0, 1, H);
    const cols = (a, b, scrolled, cx, cw) => {
      if (b < a || cw <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, 0, cw, hh);
      ctx.clip();
      for (let c = a; c <= b; c++) {
        const x = hw + this.colX[c] - (scrolled ? this.sx : 0);
        const w = this.colW(c);
        const sel = c >= g.c1 && c <= g.c2;
        if (sel) {
          ctx.fillStyle = fullCols ? C.headerFull : C.headerSel;
          ctx.fillRect(x, 0, w, hh - 1);
        }
        ctx.fillStyle = C.headerLine;
        ctx.fillRect(x + w - 1, 0, 1, hh);
        ctx.fillStyle = sel ? C.headerSelText : C.headerText;
        ctx.font = `${sel ? 600 : 500} 11.5px ${FONT_STACK}`;
        ctx.fillText(colName(c), x + w / 2, hh / 2 + 0.5);
        if (sel) {
          ctx.fillStyle = C.accent;
          ctx.fillRect(x, hh - 2, w, 2);
        }
      }
      ctx.restore();
    };
    cols(0, fc - 1, false, hw, fw);
    cols(c0, c1, true, hw + fw, W - hw - fw);
    const f = sh.filter;
    const filtering = f && sh.hidden.size > 0;
    const rows = (a, b, scrolled, ry, rh) => {
      if (b < a || rh <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, ry, hw, rh);
      ctx.clip();
      for (let r = a; r <= b; r++) {
        const h = this.rowH(r);
        if (!h) continue;
        const y = hh + this.rowY[r] - (scrolled ? this.sy : 0);
        const sel = r >= g.r1 && r <= g.r2;
        if (sel) {
          ctx.fillStyle = fullRows ? C.headerFull : C.headerSel;
          ctx.fillRect(0, y, hw - 1, h);
        }
        ctx.fillStyle = C.headerLine;
        ctx.fillRect(0, y + h - 1, hw, 1);
        if (h >= 9) {
          const blue = filtering && r > f.r1 && r <= f.r2;
          ctx.fillStyle = blue ? C.filtered : sel ? C.headerSelText : C.headerText;
          ctx.font = `${sel || blue ? 600 : 500} 11.5px ${FONT_STACK}`;
          ctx.fillText(String(r + 1), hw / 2, y + h / 2 + 0.5);
        }
        if (filtering && this.rowY[r] > 0 && this.rowY[r] === this.rowY[r - 1]) {
          ctx.fillStyle = C.filtered;
          ctx.fillRect(0, y - 1, hw, 2);
        }
        if (sel) {
          ctx.fillStyle = C.accent;
          ctx.fillRect(hw - 2, y, 2, h);
        }
      }
      ctx.restore();
    };
    rows(0, fr - 1, false, hh, fh);
    rows(r0, r1, true, hh + fh, H - hh - fh);
    ctx.fillStyle = '#F1F3F7';
    ctx.fillRect(0, 0, hw - 1, hh - 1);
    ctx.fillStyle = '#C3C9D4';
    ctx.beginPath();
    ctx.moveTo(hw - 5, hh - 13);
    ctx.lineTo(hw - 5, hh - 5);
    ctx.lineTo(hw - 13, hh - 5);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- hit testing ---------- */

  local(e) {
    const r = this.scroller.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  colAtX(x) {
    const sh = this.sheet;
    const fw = this.colX[sh.freeze.c];
    const cx = x - this.hw < fw ? x - this.hw : x - this.hw + this.sx;
    return clamp(upperBound(this.colX, cx, sh.cols + 1) - 1, 0, sh.cols - 1);
  }
  rowAtY(y) {
    const sh = this.sheet;
    const fh = this.rowY[sh.freeze.r];
    const cy = y - this.hh < fh ? y - this.hh : y - this.hh + this.sy;
    return clamp(upperBound(this.rowY, cy, sh.rows + 1) - 1, 0, sh.rows - 1);
  }
  cellAtClamped(x, y) {
    return { r: this.rowAtY(clamp(y, this.hh + 1, this.H - 1)), c: this.colAtX(clamp(x, this.hw + 1, this.W - 1)) };
  }

  hitTest(x, y) {
    const sh = this.sheet;
    const { hw, hh } = this;
    if (x < hw && y < hh) return { type: 'corner' };
    if (y < hh) {
      const c = this.colAtX(x);
      const right = this.colLeft(c) + this.colW(c);
      if (Math.abs(x - right) <= 4) return { type: 'colResize', c };
      if (c > 0 && Math.abs(x - this.colLeft(c)) <= 3) return { type: 'colResize', c: c - 1 };
      return { type: 'colHeader', c };
    }
    if (x < hw) {
      const r = this.rowAtY(y);
      const bottom = this.rowTop(r) + this.rowH(r);
      if (Math.abs(y - bottom) <= 3) return { type: 'rowResize', r };
      if (r > 0 && Math.abs(y - this.rowTop(r)) <= 2) {
        let p = r - 1;
        while (p > 0 && !this.rowH(p)) p--;
        return { type: 'rowResize', r: p };
      }
      return { type: 'rowHeader', r };
    }
    const r = this.rowAtY(y);
    const c = this.colAtX(x);
    const app = this.app;
    if (!app.edit) {
      const g = app.selRange();
      const hx = this.colLeft(g.c2) + this.colW(g.c2) - 4;
      const hy = this.rowTop(g.r2) + this.rowH(g.r2) - 4;
      if (x >= hx - 3 && x <= hx + 8 && y >= hy - 3 && y <= hy + 8) return { type: 'fill' };
    }
    const f = sh.filter;
    if (f && r === f.r1 && c >= f.c1 && c <= f.c2) {
      const bx = this.colLeft(c) + this.colW(c) - BTN - 4;
      const by = this.rowTop(r) + (this.rowH(r) - BTN) / 2;
      if (x >= bx - 2 && x <= bx + BTN + 2 && y >= by - 2 && y <= by + BTN + 2) return { type: 'filterBtn', c, rect: { x: bx, y: by, w: BTN, h: BTN } };
    }
    return { type: 'cell', r, c };
  }

  /* ---------- mouse ---------- */

  onMouseDown(e) {
    if (e.button !== 0) return;
    const p = this.local(e);
    if (p.x >= this.W || p.y >= this.H) return;
    const app = this.app;
    const hit = this.hitTest(p.x, p.y);
    e.preventDefault();
    app.closePopups();
    app.selectChart(null);
    switch (hit.type) {
      case 'colResize':
      case 'rowResize':
        app.commitEdit();
        this.startResize(hit);
        break;
      case 'filterBtn':
        app.commitEdit();
        app.openFilterMenu(hit.c);
        break;
      case 'fill':
        this.startFill();
        break;
      case 'corner':
        app.commitEdit();
        app.selectAll();
        break;
      case 'colHeader':
        app.commitEdit();
        app.selectCols(hit.c, e.shiftKey);
        this.startDrag('col');
        break;
      case 'rowHeader':
        app.commitEdit();
        app.selectRows(hit.r, e.shiftKey);
        this.startDrag('row');
        break;
      default:
        if (app.pointRefStart(hit.r, hit.c, e.shiftKey)) {
          this.startDrag('point');
          break;
        }
        app.commitEdit();
        app.selectCell(hit.r, hit.c, e.shiftKey);
        this.startDrag('cell');
    }
    app.focusGrid();
  }

  autoScrollLoop() {
    if (!this.drag) return;
    const p = this.drag.p;
    if (p) {
      let dx = 0;
      let dy = 0;
      if (p.x > this.W - 8) dx = Math.min(40, (p.x - this.W + 8) / 2 + 4);
      else if (p.x < this.hw + 2 && this.drag.kind !== 'row') dx = -Math.min(40, (this.hw + 2 - p.x) / 2 + 4);
      if (p.y > this.H - 8) dy = Math.min(40, (p.y - this.H + 8) / 2 + 4);
      else if (p.y < this.hh + 2 && this.drag.kind !== 'col') dy = -Math.min(40, (this.hh + 2 - p.y) / 2 + 4);
      if (dx || dy) {
        this.scroller.scrollLeft += dx;
        this.scroller.scrollTop += dy;
        this.drag.move(p);
      }
    }
    this.drag.raf = requestAnimationFrame(() => this.autoScrollLoop());
  }

  startDrag(kind, onMove, onUp) {
    const app = this.app;
    const move = onMove || ((p) => {
      const h = this.cellAtClamped(p.x, p.y);
      if (kind === 'cell') app.extendSelection(h.r, h.c);
      else if (kind === 'col') app.extendSelection(null, h.c);
      else if (kind === 'row') app.extendSelection(h.r, null);
      else if (kind === 'point') app.pointRefDrag(h.r, h.c);
    });
    this.drag = { kind, move, p: null };
    const mm = (ev) => {
      this.drag.p = this.local(ev);
      move(this.drag.p);
    };
    const mu = () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      cancelAnimationFrame(this.drag.raf);
      this.drag = null;
      if (onUp) onUp();
      app.onDragEnd();
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    this.autoScrollLoop();
  }

  startResize(hit) {
    const axis = hit.type === 'colResize' ? 'col' : 'row';
    const idx = axis === 'col' ? hit.c : hit.r;
    const start = axis === 'col' ? this.colLeft(idx) : this.rowTop(idx);
    const min = axis === 'col' ? 24 : 12;
    this.guide = { axis, pos: start + (axis === 'col' ? this.colW(idx) : this.rowH(idx)), size: axis === 'col' ? this.colW(idx) : this.rowH(idx) };
    this.drag = { kind: 'resize' };
    const mm = (ev) => {
      const q = this.local(ev);
      const size = Math.max(min, (axis === 'col' ? q.x : q.y) - start);
      this.guide = { axis, pos: start + size, size };
      this.requestDraw();
    };
    const mu = () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      const size = Math.round(this.guide.size);
      this.guide = null;
      this.drag = null;
      this.app.resizeTo(axis, idx, size);
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    this.requestDraw();
  }

  startFill() {
    const app = this.app;
    const src = app.selRange();
    let dst = null;
    this.startDrag('fill', (p) => {
      const h = this.cellAtClamped(p.x, p.y);
      const dy = h.r > src.r2 ? h.r - src.r2 : h.r < src.r1 ? h.r - src.r1 : 0;
      const dx = h.c > src.c2 ? h.c - src.c2 : h.c < src.c1 ? h.c - src.c1 : 0;
      if (!dx && !dy) dst = null;
      else if (Math.abs(dy) >= Math.abs(dx)) dst = dy > 0 ? { ...src, r2: h.r } : { ...src, r1: h.r };
      else dst = dx > 0 ? { ...src, c2: h.c } : { ...src, c1: h.c };
      app.fillPreview = dst;
      this.requestDraw();
    }, () => {
      app.fillPreview = null;
      if (dst) app.doFill(src, dst);
      else this.requestDraw();
    });
  }

  onHover(e) {
    if (this.drag) return;
    const p = this.local(e);
    if (p.x >= this.W || p.y >= this.H) { this.scroller.style.cursor = ''; return; }
    const hit = this.hitTest(p.x, p.y);
    const cur = { colResize: 'col-resize', rowResize: 'row-resize', fill: 'crosshair', filterBtn: 'pointer', corner: 'pointer', colHeader: 'default', rowHeader: 'default' }[hit.type];
    this.scroller.style.cursor = cur || 'cell';
  }

  onDblClick(e) {
    const p = this.local(e);
    if (p.x >= this.W || p.y >= this.H) return;
    const hit = this.hitTest(p.x, p.y);
    if (hit.type === 'colResize') this.app.autofitCol(hit.c);
    else if (hit.type === 'rowResize') this.app.resizeTo('row', hit.r, null);
    else if (hit.type === 'cell' && !this.app.edit) this.app.startEdit('edit');
  }

  onContextMenu(e) {
    e.preventDefault();
    const p = this.local(e);
    if (p.x >= this.W || p.y >= this.H) return;
    this.app.openContextMenu(e.clientX, e.clientY, this.hitTest(p.x, p.y));
  }
}

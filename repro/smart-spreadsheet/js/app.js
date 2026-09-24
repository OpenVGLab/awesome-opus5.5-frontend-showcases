// Application controller: state, undo/redo, selection, editing, keyboard, clipboard, commands.
import {
  h, iconEl, cellName, rangeName, parseRange, parseA1, norm, inRange, intersects, clamp, debounce, downloadBlob,
  escHtml, sameRange, FONT_STACK,
} from './util.js';
import {
  writeInput, styleRange, bordersRange, clearRange, cellValue, displayText, structural,
  mergeRange, unmergeRange, mergeLosesData, expandForMerges, currentRegion, detectHeader, sortRange, applyFilter,
  fillRange, copyBlock, pasteBlock, pasteText, snapshot, restore, serialize, deserialize, isBlank, cellCount,
} from './model.js';
import { FUNCS, functionList, callContext, scanRefs, tokenize, formatRef, parse, shiftFormula } from './formula.js';
import { inputText, adjustDecimals, formatLabel, formatNumber } from './format.js';
import { exportXlsx, importXlsx, importCsv, exportCsv, parseDelimited } from './xlsx.js';
import { Grid } from './grid.js';
import { buildSample } from './sample.js';
import { UI } from './ui.js';
import { Panels } from './panels.js';

const STORE_KEY = 'cellwise.workbook.v1';
export const REF_COLORS = ['#2563EB', '#DC2626', '#7C3AED', '#059669', '#D97706', '#DB2777', '#0891B2'];

class App {
  constructor() {
    this.wb = null;
    this.sel = { r1: 0, c1: 0, r2: 0, c2: 0, ar: 0, ac: 0, anchorR: 0, anchorC: 0 };
    this.edit = null;
    this.clip = null;
    this.marchOffset = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.showFormulas = false;
    this.refHighlights = [];
    this.fillPreview = null;
    this.selectedChart = null;
    this.panel = null;
    this.ac = null;
    this.colors = { fc: '#DC2626', bg: '#FEF08A' };
    this.sheetState = new Map();
    this.$ = (s) => document.querySelector(s);
    this.initDom();
    this.grid = new Grid(this, this.$('#gridWrap'));
    this.commands = this.buildCommands();
    this.bindEvents();
    this.loadInitial();
    window.app = this;
  }

  get sheet() { return this.wb.sheet; }

  initDom() {
    document.querySelectorAll('i[data-icon]').forEach((el) => el.replaceWith(iconEl(el.dataset.icon, +(el.dataset.size || 16), el.className)));
    this.ed = this.$('#cellEditor');
    this.edWrap = this.$('#editorWrap');
    this.edMirror = this.$('#editorMirror');
    this.fb = this.$('#fbInput');
    this.fbWrap = this.$('#fbWrap');
    this.fbMirror = this.$('#fbMirror');
    this.nameBox = this.$('#nameBox');
    this.chartsViewport = this.$('#chartsViewport');
    this.chartsLayer = this.$('#chartsLayer');
    this.popups = this.$('#popups');
    this.side = this.$('#sidePanel');
    this.titleInput = this.$('#docTitle');
    this.acEl = h('div', { class: 'ac-popup', hidden: true });
    this.hintEl = h('div', { class: 'arg-hint', hidden: true });
    document.body.append(this.acEl, this.hintEl);
  }

  bindEvents() {
    const toolbar = this.$('#toolbar');
    for (const bar of [toolbar, this.$('.top-actions'), this.$('.formula-bar'), this.$('.bottombar')]) {
      bar.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) e.preventDefault();
      });
    }
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (!b || b.disabled || b.closest('#popups')) return;
      this.run(b.dataset.cmd, b.dataset.arg, b);
    });
    this.$('#menubar').addEventListener('mousedown', (e) => {
      const b = e.target.closest('[data-menu]');
      if (!b) return;
      e.preventDefault();
      this.toggleMenubar(b);
    });
    this.$('#menubar').addEventListener('mouseover', (e) => {
      const b = e.target.closest('[data-menu]');
      if (b && this.menubarOpen && this.menubarOpen !== b) this.toggleMenubar(b);
    });

    this.ed.addEventListener('keydown', (e) => this.onKeyDown(e, 'cell'));
    this.ed.addEventListener('input', () => {
      if (!this.edit) {
        this.startEdit('enter', this.ed.value, { keep: true });
        return;
      }
      this.fb.value = this.ed.value;
      this.onEditInput('cell');
    });
    this.ed.addEventListener('compositionstart', () => {
      if (!this.edit) this.startEdit('enter', '', { keep: true });
    });
    for (const ev of ['keyup', 'click']) {
      this.ed.addEventListener(ev, (e) => { if (this.edit && !['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown'].includes(e.key)) this.onCaretMove('cell'); });
      this.fb.addEventListener(ev, (e) => { if (this.edit && !['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown'].includes(e.key)) this.onCaretMove('bar'); });
    }
    this.fb.addEventListener('focus', () => {
      if (!this.edit) this.startEdit('edit', undefined, { source: 'bar' });
      else this.edit.source = 'bar';
    });
    this.fb.addEventListener('keydown', (e) => this.onKeyDown(e, 'bar'));
    this.fb.addEventListener('input', () => {
      if (!this.edit) this.startEdit('edit', undefined, { source: 'bar' });
      this.edit.source = 'bar';
      this.ed.value = this.fb.value;
      this.onEditInput('bar');
    });
    this.fb.addEventListener('scroll', () => { this.fbMirror.scrollLeft = this.fb.scrollLeft; });
    this.nameBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.gotoRef(this.nameBox.value); }
      else if (e.key === 'Escape') { this.updateFormulaBar(); this.focusGrid(); }
    });
    this.nameBox.addEventListener('focus', () => { this.commitEdit(); this.nameBox.select(); });
    this.titleInput.addEventListener('change', () => {
      this.wb.title = this.titleInput.value.trim() || 'Untitled workbook';
      this.titleInput.value = this.wb.title;
      document.title = `${this.wb.title} · Cellwise`;
      this.scheduleSave();
    });
    this.titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.focusGrid(); } });

    document.addEventListener('copy', (e) => this.onCopy(e, false));
    document.addEventListener('cut', (e) => this.onCopy(e, true));
    document.addEventListener('paste', (e) => this.onPaste(e));
    document.addEventListener('keydown', (e) => this.onGlobalKey(e));
    document.addEventListener('mousedown', (e) => {
      if (e.target.closest('#popups') || e.target.closest('[data-menu]') || e.target.closest('[data-cmd$="Menu"]') || e.target.closest('.ac-popup')) return;
      this.closePopups();
    }, true);

    this.$('#fileInput').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) this.importFile(f);
      e.target.value = '';
    });
    const overlay = this.$('#dropOverlay');
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    window.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      overlay.classList.add('show');
    });
    window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) overlay.classList.remove('show'); });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      overlay.classList.remove('show');
      const f = e.dataTransfer.files[0];
      if (f) this.importFile(f);
    });
    window.addEventListener('resize', () => this.closePopups());
    window.addEventListener('beforeunload', () => this.saveNow());
    this.$('#tabs').addEventListener('wheel', (e) => {
      e.currentTarget.scrollLeft += e.deltaY + e.deltaX;
    }, { passive: true });
    this.initTooltips();
  }

  loadInitial() {
    let wb = null;
    if (!new URLSearchParams(location.search).has('reset')) {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) wb = deserialize(JSON.parse(raw));
      } catch (e) {
        wb = null;
      }
    }
    this.setWorkbook(wb || this.sampleWorkbook());
  }

  sampleWorkbook() {
    const sc = this.grid.scroller;
    const wb = buildSample({ width: sc.clientWidth + (this.panel ? 324 : 0), height: sc.clientHeight });
    wb.initialCell = { r: 4, c: 6 };
    return wb;
  }

  setWorkbook(wb) {
    this.cancelEdit();
    this.wb = wb;
    this.sheetState.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.clip = null;
    this.selectedChart = null;
    const init = wb.initialCell || { r: 0, c: 0 };
    this.sel = { r1: init.r, c1: init.c, r2: init.r, c2: init.c, ar: init.r, ac: init.c, anchorR: init.r, anchorC: init.c };
    this.titleInput.value = wb.title;
    document.title = `${wb.title} · Cellwise`;
    this.grid.scroller.scrollLeft = 0;
    this.grid.scroller.scrollTop = 0;
    this.closePanel();
    this.after({ noSave: true });
    this.focusGrid();
  }

  /* ---------- commits & undo ---------- */

  undoLimit() {
    return cellCount(this.wb) > 30000 ? 12 : 100;
  }

  commit(label, fn, opts = {}) {
    const snap = snapshot(this.wb);
    const selBefore = { ...this.sel };
    let res;
    try {
      res = fn();
    } catch (err) {
      console.warn(err);
      restore(this.wb, snap);
      this.toast(`Could not complete "${label}": ${err.message}`, 'error');
      this.after();
      return false;
    }
    if (res === false) {
      restore(this.wb, snap);
      this.after();
      return false;
    }
    this.undoStack.push({ label, snap, sel: selBefore });
    if (this.undoStack.length > this.undoLimit()) this.undoStack.shift();
    this.redoStack = [];
    this.after(opts);
    return true;
  }

  after(opts = {}) {
    this.wb.recalc();
    const sh = this.sheet;
    const s = this.sel;
    const maxR = sh.rows - 1;
    const maxC = sh.cols - 1;
    if (s.r1 > maxR || s.c1 > maxC || s.ar > maxR || s.ac > maxC) this.sel = { r1: 0, c1: 0, r2: 0, c2: 0, ar: 0, ac: 0, anchorR: 0, anchorC: 0 };
    else this.sel = { ...s, r2: Math.min(s.r2, maxR), c2: Math.min(s.c2, maxC) };
    if (this.selectedChart && !sh.charts.some((c) => c.id === this.selectedChart)) this.selectedChart = null;
    this.grid.draw();
    this.syncOverlay();
    this.renderCharts();
    this.renderTabs();
    this.updateToolbar();
    this.updateFormulaBar();
    this.updateStatus();
    this.refreshPanel();
    if (!opts.noSave) this.scheduleSave();
  }

  undo() {
    if (this.edit) { this.cancelEdit(); return; }
    const e = this.undoStack.pop();
    if (!e) { this.toast('Nothing to undo'); return; }
    this.redoStack.push({ label: e.label, snap: snapshot(this.wb), sel: { ...this.sel } });
    restore(this.wb, e.snap);
    this.sel = e.sel;
    this.after();
    this.toast(`Undo: ${e.label}`, 'quiet');
  }

  redo() {
    if (this.edit) return;
    const e = this.redoStack.pop();
    if (!e) { this.toast('Nothing to redo'); return; }
    this.undoStack.push({ label: e.label, snap: snapshot(this.wb), sel: { ...this.sel } });
    restore(this.wb, e.snap);
    this.sel = e.sel;
    this.after();
    this.toast(`Redo: ${e.label}`, 'quiet');
  }

  scheduleSave() {
    this.setSaveState('saving');
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this.saveNow(), 600);
  }

  saveNow() {
    clearTimeout(this._saveT);
    if (!this.wb) return;
    try {
      const json = JSON.stringify(serialize(this.wb));
      if (json.length < 4.5e6) {
        localStorage.setItem(STORE_KEY, json);
        this.setSaveState('saved');
      } else this.setSaveState('large');
    } catch (e) {
      this.setSaveState('large');
    }
  }

  setSaveState(state) {
    const el = this.$('#saveState span');
    if (!el) return;
    el.textContent = state === 'saving' ? 'Saving…' : state === 'large' ? 'Not autosaved (large)' : 'Saved in this browser';
    this.$('#saveState').classList.toggle('busy', state === 'saving');
  }

  /* ---------- selection ---------- */

  selRange() {
    const s = this.sel;
    return expandForMerges(this.sheet, norm(s));
  }

  activeCell() {
    return this.sheet.get(this.sel.ar, this.sel.ac);
  }

  selectCell(r, c, extend = false) {
    const sh = this.sheet;
    r = clamp(r, 0, sh.rows - 1);
    c = clamp(c, 0, sh.cols - 1);
    if (extend) {
      const s = this.sel;
      this.sel = { ...s, ...norm({ r1: s.anchorR, c1: s.anchorC, r2: r, c2: c }) };
    } else {
      const m = sh.mergeAt(r, c);
      const ar = m ? m.r1 : r;
      const ac = m ? m.c1 : c;
      this.sel = { r1: ar, c1: ac, r2: m ? m.r2 : r, c2: m ? m.c2 : c, ar, ac, anchorR: ar, anchorC: ac };
    }
    this.onSelectionChange();
  }

  setSelection(g, ar = g.r1, ac = g.c1) {
    this.sel = { ...norm(g), ar, ac, anchorR: g.r1, anchorC: g.c1 };
    this.onSelectionChange();
  }

  extendSelection(r, c) {
    const s = this.sel;
    const sh = this.sheet;
    if (r === null) this.sel = { ...s, r1: 0, r2: sh.rows - 1, c1: Math.min(s.anchorC, c), c2: Math.max(s.anchorC, c) };
    else if (c === null) this.sel = { ...s, c1: 0, c2: sh.cols - 1, r1: Math.min(s.anchorR, r), r2: Math.max(s.anchorR, r) };
    else this.sel = { ...s, ...norm({ r1: s.anchorR, c1: s.anchorC, r2: r, c2: c }) };
    this.onSelectionChange(true);
  }

  firstVisibleRow() {
    return this.grid.visRows()[0];
  }

  selectCols(c, extend) {
    if (extend) { this.extendSelection(null, c); return; }
    const sh = this.sheet;
    this.sel = { r1: 0, r2: sh.rows - 1, c1: c, c2: c, ar: this.firstVisibleRow(), ac: c, anchorR: 0, anchorC: c };
    this.onSelectionChange();
  }

  selectRows(r, extend) {
    if (extend) { this.extendSelection(r, null); return; }
    const sh = this.sheet;
    this.sel = { r1: r, r2: r, c1: 0, c2: sh.cols - 1, ar: r, ac: this.grid.visCols()[0], anchorR: r, anchorC: 0 };
    this.onSelectionChange();
  }

  selectAll() {
    const sh = this.sheet;
    const s = this.sel;
    const reg = currentRegion(sh, s.ar, s.ac);
    const cur = this.selRange();
    if (!sameRange(reg, cur) && !(reg.r1 === reg.r2 && reg.c1 === reg.c2)) this.sel = { ...reg, ar: s.ar, ac: s.ac, anchorR: reg.r1, anchorC: reg.c1 };
    else this.sel = { r1: 0, c1: 0, r2: sh.rows - 1, c2: sh.cols - 1, ar: s.ar, ac: s.ac, anchorR: 0, anchorC: 0 };
    this.onSelectionChange();
  }

  onSelectionChange(dragging = false) {
    this.positionEditor();
    this.grid.requestDraw();
    this.updateFormulaBar();
    this.updateToolbar();
    this.updateStatus();
    if (!dragging && this.panel && this.panel.kind === 'form') this.refreshPanel();
  }

  onDragEnd() {
    this.updateStatus();
    this.updateToolbar();
  }

  nextRow(r, dr) {
    const sh = this.sheet;
    let n = r + dr;
    while (n > 0 && n < sh.rows - 1 && sh.hidden.has(n)) n += dr;
    return clamp(n, 0, sh.rows - 1);
  }

  jumpTarget(r, c, dr, dc) {
    const sh = this.sheet;
    const filled = (rr, cc) => !isBlank(sh.get(rr, cc));
    const inb = (rr, cc) => rr >= 0 && cc >= 0 && rr < sh.rows && cc < sh.cols;
    let tr = r + dr;
    let tc = c + dc;
    if (!inb(tr, tc)) return [r, c];
    let nr = r;
    let nc = c;
    if (filled(r, c) && filled(tr, tc)) {
      while (inb(tr, tc) && filled(tr, tc)) { nr = tr; nc = tc; tr += dr; tc += dc; }
    } else {
      while (inb(tr, tc) && !filled(tr, tc)) { tr += dr; tc += dc; }
      if (inb(tr, tc)) { nr = tr; nc = tc; } else { nr = clamp(tr - dr, 0, sh.rows - 1); nc = clamp(tc - dc, 0, sh.cols - 1); }
    }
    return [nr, nc];
  }

  moveActive(dr, dc, extend = false, jump = false, within = false) {
    const sh = this.sheet;
    const s = this.sel;
    const g = this.selRange();
    const multi = g.r1 !== g.r2 || g.c1 !== g.c2;
    const am = sh.mergeAt(s.ar, s.ac);
    const isMergeOnly = am && am.r1 === g.r1 && am.c1 === g.c1 && am.r2 === g.r2 && am.c2 === g.c2;
    if (within && multi && !isMergeOnly && !extend) {
      let r = s.ar;
      let c = s.ac;
      if (dr) {
        r += dr;
        if (r > g.r2) { r = g.r1; c = c + 1 > g.c2 ? g.c1 : c + 1; }
        if (r < g.r1) { r = g.r2; c = c - 1 < g.c1 ? g.c2 : c - 1; }
      } else {
        c += dc;
        if (c > g.c2) { c = g.c1; r = r + 1 > g.r2 ? g.r1 : r + 1; }
        if (c < g.c1) { c = g.c2; r = r - 1 < g.r1 ? g.r2 : r - 1; }
      }
      this.sel = { ...s, ar: r, ac: c };
      this.grid.scrollIntoView(r, c);
      this.onSelectionChange();
      return;
    }
    if (extend) {
      let fr = s.r1 === s.anchorR ? s.r2 : s.r1;
      let fc = s.c1 === s.anchorC ? s.c2 : s.c1;
      if (jump) [fr, fc] = this.jumpTarget(fr, fc, dr, dc);
      else { fr = dr ? this.nextRow(fr, dr) : fr; fc = clamp(fc + dc, 0, sh.cols - 1); }
      sh.ensureSize(fr, fc);
      this.sel = { ...s, ...norm({ r1: s.anchorR, c1: s.anchorC, r2: fr, c2: fc }) };
      this.grid.layout();
      this.grid.scrollIntoView(fr, fc);
      this.onSelectionChange();
      return;
    }
    let r = s.ar;
    let c = s.ac;
    if (am) {
      if (dr > 0) r = am.r2;
      if (dc > 0) c = am.c2;
    }
    if (jump) [r, c] = this.jumpTarget(r, c, dr, dc);
    else { r = dr ? this.nextRow(r, dr) : r; c = clamp(c + dc, 0, sh.cols - 1); }
    sh.ensureSize(r, c);
    this.grid.layout();
    this.selectCell(r, c);
    this.grid.scrollIntoView(this.sel.ar, this.sel.ac);
  }

  gotoRef(text) {
    let t = String(text || '').trim();
    let sh = this.sheet;
    const m = /^(?:'([^']+)'|([^!]+))!(.+)$/.exec(t);
    if (m) {
      const idx = this.wb.sheets.findIndex((s) => s.name.toLowerCase() === (m[1] || m[2]).toLowerCase());
      if (idx < 0) { this.toast(`No sheet named "${m[1] || m[2]}"`, 'error'); return; }
      this.setActiveSheet(idx);
      sh = this.sheet;
      t = m[3];
    }
    const g = parseRange(t);
    if (!g) { this.toast(`"${text}" is not a valid cell reference`, 'error'); this.updateFormulaBar(); return; }
    sh.ensureSize(g.r2, g.c2);
    this.grid.layout();
    this.setSelection(g);
    this.grid.scrollIntoView(g.r1, g.c1);
    this.focusGrid();
  }

  focusGrid() {
    if (document.activeElement !== this.ed) this.ed.focus({ preventScroll: true });
  }

  gridFocused() {
    const a = document.activeElement;
    return a === this.ed || a === document.body || a === null;
  }

  onGridScroll() {
    this.syncOverlay();
    if (this.filterPopup) this.closePopups();
  }

  syncOverlay() {
    this.positionEditor();
    const g = this.grid;
    const vp = this.chartsViewport;
    const fr = this.sheet.freeze;
    const fw = g.colX[Math.min(fr.c, g.colX.length - 1)] || 0;
    const fh = g.rowY[Math.min(fr.r, g.rowY.length - 1)] || 0;
    vp.style.left = g.hw + fw + 'px';
    vp.style.top = g.hh + fh + 'px';
    vp.style.width = Math.max(0, g.W - g.hw - fw) + 'px';
    vp.style.height = Math.max(0, g.H - g.hh - fh) + 'px';
    this.chartsLayer.style.transform = `translate(${-g.sx - fw}px, ${-g.sy - fh}px)`;
    if (this.edit) this.positionEditPopups();
  }

  /* ---------- editing ---------- */

  startEdit(mode = 'edit', text, opts = {}) {
    if (this.edit) return;
    this.closePopups();
    const sh = this.sheet;
    const m = sh.mergeAt(this.sel.ar, this.sel.ac);
    const r = m ? m.r1 : this.sel.ar;
    const c = m ? m.c1 : this.sel.ac;
    const orig = inputText(sh.get(r, c));
    this.edit = { r, c, sheetId: sh.id, mode, orig, point: null, source: opts.source || 'cell' };
    const value = text !== undefined ? text : orig;
    this.grid.scrollIntoView(r, c);
    if (!opts.keep) this.ed.value = value;
    this.fb.value = value;
    this.edWrap.classList.remove('idle');
    this.edWrap.classList.add('editing');
    if (this.edit.source === 'cell') {
      this.focusGrid();
      const end = this.ed.value.length;
      if (!opts.keep) this.ed.setSelectionRange(end, end);
    }
    this.onEditInput(this.edit.source);
    this.grid.requestDraw();
    this.updateStatus();
  }

  editorEl(source) {
    return (source || (this.edit && this.edit.source)) === 'bar' ? this.fb : this.ed;
  }

  onEditInput(source) {
    const e = this.edit;
    if (!e) return;
    if (!this._pointing) e.point = null;
    const text = this.editorEl(source).value;
    const isF = text.startsWith('=');
    this.edWrap.classList.toggle('formula', isF);
    this.fbWrap.classList.toggle('formula', isF);
    const html = this.highlightHtml(text);
    this.edMirror.innerHTML = html;
    this.fbMirror.innerHTML = html;
    this.fbMirror.scrollLeft = this.fb.scrollLeft;
    this.positionEditor();
    this.updateRefHighlights(text);
    this.onCaretMove(source);
  }

  onCaretMove(source) {
    if (!this.edit) return;
    const el = this.editorEl(source);
    const text = el.value;
    const caret = el.selectionStart;
    this.updateAutocomplete(text, caret, source);
    this.updateArgHint(text, caret, source);
    this.updateStatus();
  }

  highlightHtml(text) {
    if (!text.startsWith('=')) return escHtml(text) + '\u200b';
    const src = text.slice(1);
    let toks;
    try {
      toks = tokenize(src);
    } catch (e) {
      return '<span class="t-eq">=</span>' + escHtml(src) + '\u200b';
    }
    const refs = scanRefs(src) || [];
    const spans = refs.map((r, i) => ({ s: r.s, e: r.e, style: `color:${REF_COLORS[i % REF_COLORS.length]}` }));
    const inRef = (t) => refs.some((r) => t.s >= r.s && t.e <= r.e);
    for (const t of toks) {
      if (inRef(t)) continue;
      const cls = { str: 't-str', num: 't-num', bool: 't-num', err: 't-err', func: 't-fn', name: 't-name' }[t.t];
      if (cls) spans.push({ s: t.s, e: t.e, cls });
    }
    spans.sort((a, b) => a.s - b.s);
    let html = '<span class="t-eq">=</span>';
    let last = 0;
    for (const sp of spans) {
      if (sp.s < last) continue;
      html += escHtml(src.slice(last, sp.s));
      html += `<span${sp.cls ? ` class="${sp.cls}"` : ''}${sp.style ? ` style="${sp.style}"` : ''}>${escHtml(src.slice(sp.s, sp.e))}</span>`;
      last = sp.e;
    }
    return html + escHtml(src.slice(last)) + '\u200b';
  }

  updateRefHighlights(text) {
    const e = this.edit;
    this.refHighlights = [];
    if (e && text.startsWith('=')) {
      const refs = scanRefs(text.slice(1)) || [];
      refs.forEach((ref, i) => {
        const sh = ref.sheet ? this.wb.sheetByName(ref.sheet) : this.wb.sheets.find((s) => s.id === e.sheetId);
        if (!sh) return;
        let g;
        if (ref.kind === 'cell') g = { r1: ref.r1, c1: ref.c1, r2: ref.r1, c2: ref.c1 };
        else if (ref.kind === 'range') g = norm(ref);
        else if (ref.kind === 'cols') g = { r1: 0, r2: sh.rows - 1, c1: Math.min(ref.c1, ref.c2), c2: Math.max(ref.c1, ref.c2) };
        else g = { c1: 0, c2: sh.cols - 1, r1: Math.min(ref.r1, ref.r2), r2: Math.max(ref.r1, ref.r2) };
        const active = !!e.point && ref.s + 1 === e.point.start;
        this.refHighlights.push({ sheetId: sh.id, g, color: REF_COLORS[i % REF_COLORS.length], active });
      });
    }
    this.grid.requestDraw();
  }

  measure(text, font) {
    if (!this._mctx) this._mctx = document.createElement('canvas').getContext('2d');
    this._mctx.font = font;
    return this._mctx.measureText(text).width;
  }

  positionEditor() {
    const wrap = this.edWrap;
    const g = this.grid;
    if (!this.wb || !g.W) return;
    const e = this.edit;
    const sh = this.sheet;
    if (!e || e.sheetId !== sh.id) {
      const rc = g.cellRect(this.sel.ar, this.sel.ac);
      wrap.style.left = clamp(rc.x, g.hw, Math.max(g.hw, g.W - 30)) + 'px';
      wrap.style.top = clamp(rc.y, g.hh, Math.max(g.hh, g.H - 24)) + 'px';
      wrap.style.width = Math.max(24, Math.min(rc.w, 300)) + 'px';
      wrap.style.minHeight = '';
      this.edMirror.style.paddingTop = '';
      return;
    }
    const rc = g.cellRect(e.r, e.c);
    const cell = sh.get(e.r, e.c);
    const s = (cell && cell.s) || {};
    const fs = s.fs ? Math.round(((s.fs * 4) / 3) * 10) / 10 : 13;
    const font = `${s.i ? 'italic ' : ''}${s.b ? 600 : 400} ${fs}px ${FONT_STACK}`;
    if (wrap.dataset.font !== font) {
      this.ed.style.font = font;
      this.edMirror.style.font = font;
      wrap.dataset.font = font;
    }
    const lh = Math.round(fs * 1.38);
    this.ed.style.lineHeight = this.edMirror.style.lineHeight = lh + 'px';
    const x = clamp(rc.x, g.hw, Math.max(g.hw, g.W - 60));
    const y = clamp(rc.y, g.hh, Math.max(g.hh, g.H - 30));
    const maxW = Math.max(rc.w, g.W - x - 8);
    const lines = this.ed.value.split('\n');
    const tw = Math.max(...lines.map((l) => this.measure(l, font))) + 22;
    const w = Math.min(maxW, Math.max(rc.w + 1, tw));
    const padTop = Math.max(2, Math.floor((rc.h - lh) / 2) - 1);
    this.edMirror.style.paddingTop = padTop + 'px';
    this.ed.style.paddingTop = padTop + 'px';
    wrap.style.left = x - 1 + 'px';
    wrap.style.top = y - 1 + 'px';
    wrap.style.width = w + 2 + 'px';
    wrap.style.minHeight = rc.h + 2 + 'px';
    wrap.style.textAlign = 'left';
  }

  resetEditorUI() {
    this.ed.value = '';
    this.edWrap.classList.remove('editing', 'formula');
    this.edWrap.classList.add('idle');
    this.fbWrap.classList.remove('formula');
    this.edMirror.textContent = '';
    this.fbMirror.textContent = '';
    this.closeAutocomplete();
    this.hideArgHint();
    this.refHighlights = [];
    this.updateFormulaBar();
    this.positionEditor();
  }

  autoClose(text) {
    let depth = 0;
    let inStr = false;
    for (const ch of text.slice(1)) {
      if (ch === '"') inStr = !inStr;
      else if (!inStr && ch === '(') depth++;
      else if (!inStr && ch === ')') depth--;
    }
    let out = text;
    if (inStr) out += '"';
    if (depth > 0) out += ')'.repeat(depth);
    try {
      parse(out.slice(1));
      return out;
    } catch (e) {
      return text;
    }
  }

  commitEdit(dr = 0, dc = 0, opts = {}) {
    const e = this.edit;
    if (!e) return true;
    let text = this.editorEl().value;
    const sh = this.wb.sheets.find((s) => s.id === e.sheetId) || this.sheet;
    this.edit = null;
    this.resetEditorUI();
    if (text.startsWith('=') && text.length > 1) text = this.autoClose(text);
    if (opts.fillSelection) {
      const g = this.selRange();
      this.commit('Fill selection', () => {
        for (let r = g.r1; r <= g.r2; r++) {
          for (let c = g.c1; c <= g.c2; c++) {
            const t = text.startsWith('=') ? '=' + shiftFormula(text.slice(1), r - e.r, c - e.c) : text;
            writeInput(sh, r, c, t);
          }
        }
      });
    } else if (text !== e.orig) {
      this.commit(`Edit ${cellName(e.r, e.c)}`, () => {
        writeInput(sh, e.r, e.c, text);
        sh.ensureSize(e.r, e.c);
      });
      if (text.startsWith('=')) {
        const cell = sh.get(e.r, e.c);
        if (cell && cell.ast === null) this.toast('There is a problem with this formula — check the parentheses and separators.', 'error');
      }
    } else this.grid.requestDraw();
    if (dr || dc) this.moveActive(dr, dc, false, false, true);
    this.updateStatus();
    this.focusGrid();
    return true;
  }

  cancelEdit() {
    if (!this.edit) return;
    this.edit = null;
    this.resetEditorUI();
    this.grid.requestDraw();
    this.updateStatus();
    this.focusGrid();
  }

  refInsertable(text, caret) {
    if (!text.startsWith('=')) return false;
    let i = caret - 1;
    while (i >= 0 && text[i] === ' ') i--;
    if (i < 0) return false;
    return '=(,;+-*/^&<>:'.includes(text[i]);
  }

  pointRefStart(r, c, shift) {
    const e = this.edit;
    if (!e || e.sheetId !== this.sheet.id) return false;
    const el = this.editorEl();
    const text = el.value;
    const caret = el.selectionStart;
    const pointActive = e.point && e.point.end === caret && text.slice(e.point.start, e.point.end) === e.point.text;
    if (!text.startsWith('=') || !(pointActive || this.refInsertable(text, caret))) return false;
    const anchor = shift && pointActive ? e.point.anchor : { r, c };
    this.insertPointRef(anchor, { r, c });
    return true;
  }

  pointRefDrag(r, c) {
    const e = this.edit;
    if (!e || !e.point) return;
    this.insertPointRef(e.point.anchor, { r, c });
  }

  insertPointRef(a, b) {
    const e = this.edit;
    const sh = this.sheet;
    const g = expandForMerges(sh, norm({ r1: a.r, c1: a.c, r2: b.r, c2: b.c }));
    const ref = rangeName(g);
    const el = this.editorEl();
    let text = el.value;
    let start = el.selectionStart;
    let end = el.selectionEnd;
    if (e.point && e.point.end === start && text.slice(e.point.start, e.point.end) === e.point.text) {
      start = e.point.start;
      end = e.point.end;
    }
    text = text.slice(0, start) + ref + text.slice(end);
    e.point = { start, end: start + ref.length, text: ref, anchor: a, cur: b };
    this._pointing = true;
    this.ed.value = text;
    this.fb.value = text;
    el.setSelectionRange(e.point.end, e.point.end);
    this.onEditInput(e.source);
    this._pointing = false;
    this.updateStatus();
  }

  movePointRef(dr, dc, extend) {
    const e = this.edit;
    const sh = this.sheet;
    const base = e.point ? e.point.cur : { r: e.r, c: e.c };
    const cur = { r: clamp(base.r + dr, 0, sh.rows - 1), c: clamp(base.c + dc, 0, sh.cols - 1) };
    const anchor = extend && e.point ? e.point.anchor : cur;
    this.insertPointRef(anchor, cur);
    this.grid.scrollIntoView(cur.r, cur.c);
  }

  cycleAbsolute() {
    const el = this.editorEl();
    const text = el.value;
    if (!text.startsWith('=')) return;
    const caret = el.selectionStart;
    const refs = scanRefs(text.slice(1)) || [];
    const ref = refs.find((r) => caret - 1 >= r.s && caret - 1 <= r.e) || refs.find((r) => caret - 1 === r.e);
    if (!ref || (ref.kind !== 'cell' && ref.kind !== 'range')) return;
    const next = (ar, ac) => (!ar && !ac ? [true, true] : ar && ac ? [true, false] : ar ? [false, true] : [false, false]);
    const [nr, nc] = next(ref.ar1, ref.ac1);
    const mod = { ...ref, ar1: nr, ac1: nc, ar2: nr, ac2: nc };
    const txt = formatRef(mod);
    const out = text.slice(0, ref.s + 1) + txt + text.slice(ref.e + 1);
    this.ed.value = out;
    this.fb.value = out;
    const pos = ref.s + 1 + txt.length;
    el.setSelectionRange(pos, pos);
    this.onEditInput(this.edit.source);
  }

  updateAutocomplete(text, caret, source) {
    if (!text.startsWith('=')) { this.closeAutocomplete(); return; }
    const before = text.slice(0, caret);
    const m = /(^=|[=(,;+\-*/^&<> ])([A-Za-z][A-Za-z0-9.]*)$/.exec(before);
    if (!m || /^[A-Za-z]{1,3}\d+$/.test(m[2])) { this.closeAutocomplete(); return; }
    const prefix = m[2].toUpperCase();
    const list = functionList().filter((f) => f.name.startsWith(prefix)).slice(0, 8);
    if (!list.length || (list.length === 1 && list[0].name === prefix && text[caret] === '(')) { this.closeAutocomplete(); return; }
    const prevName = this.ac && this.ac.list[this.ac.index] && this.ac.list[this.ac.index].name;
    const idx = Math.max(0, list.findIndex((f) => f.name === prevName));
    this.ac = { list, index: idx, start: caret - m[2].length, end: caret, source };
    this.renderAutocomplete();
  }

  renderAutocomplete() {
    const ac = this.ac;
    if (!ac) return;
    const pre = ac.end - ac.start;
    this.acEl.innerHTML = '';
    ac.list.forEach((f, i) => {
      const item = h('div', { class: 'ac-item' + (i === ac.index ? ' active' : '') },
        h('span', { class: 'ac-name' }, h('b', {}, f.name.slice(0, pre)), f.name.slice(pre)),
        h('span', { class: 'ac-cat' }, f.cat));
      item.addEventListener('mousedown', (e) => { e.preventDefault(); ac.index = i; this.acceptAutocomplete(); });
      this.acEl.append(item);
    });
    const cur = ac.list[ac.index];
    this.acEl.append(h('div', { class: 'ac-desc' }, h('code', {}, `${cur.name}(${cur.sig})`), h('div', {}, cur.desc)));
    this.acEl.hidden = false;
    this.positionEditPopups();
  }

  closeAutocomplete() {
    this.ac = null;
    this.acEl.hidden = true;
  }

  acceptAutocomplete() {
    const ac = this.ac;
    if (!ac || !this.edit) return;
    const f = ac.list[ac.index];
    const el = this.editorEl(ac.source);
    const text = el.value;
    const hasParen = text[ac.end] === '(';
    const out = text.slice(0, ac.start) + f.name + (hasParen ? '' : '(') + text.slice(ac.end);
    const pos = ac.start + f.name.length + 1;
    this.ed.value = out;
    this.fb.value = out;
    el.setSelectionRange(pos, pos);
    this.closeAutocomplete();
    this.onEditInput(ac.source);
  }

  updateArgHint(text, caret, source) {
    const ctx = text.startsWith('=') ? callContext(text.slice(1), caret - 1) : null;
    const fn = ctx && FUNCS[ctx.name];
    if (!fn || this.ac) { this.hideArgHint(); return; }
    const args = fn.sig ? fn.sig.split(',').map((a) => a.trim()) : [];
    let cur = ctx.arg;
    if (cur >= args.length && args.length) {
      const rep = args.findIndex((a) => a === '…');
      cur = rep > 0 ? rep - 1 : args.length - 1;
    }
    this.hintEl.innerHTML = '';
    const sig = h('div', { class: 'hint-sig' }, h('b', {}, fn.name), '(');
    args.forEach((a, i) => {
      if (i) sig.append(', ');
      sig.append(h('span', { class: i === cur ? 'cur' : '' }, a));
    });
    sig.append(')');
    this.hintEl.append(sig, h('div', { class: 'hint-desc' }, fn.desc));
    this.hintEl.hidden = false;
    this.hintSource = source;
    this.positionEditPopups();
  }

  hideArgHint() {
    this.hintEl.hidden = true;
  }

  positionEditPopups() {
    const source = (this.ac && this.ac.source) || this.hintSource || 'cell';
    const anchor = source === 'bar' ? this.fbWrap.getBoundingClientRect() : this.edWrap.getBoundingClientRect();
    let y = anchor.bottom + 4;
    if (!this.hintEl.hidden) {
      const hh = this.hintEl.offsetHeight;
      if (source === 'cell' && anchor.top - hh - 6 > 90) {
        this.hintEl.style.top = anchor.top - hh - 6 + 'px';
      } else {
        this.hintEl.style.top = y + 'px';
        y += hh + 4;
      }
      this.hintEl.style.left = Math.min(anchor.left, window.innerWidth - this.hintEl.offsetWidth - 8) + 'px';
    }
    if (!this.acEl.hidden) {
      const ah = this.acEl.offsetHeight;
      if (y + ah > window.innerHeight - 8) y = Math.max(8, anchor.top - ah - 4);
      this.acEl.style.top = y + 'px';
      this.acEl.style.left = Math.min(anchor.left, window.innerWidth - this.acEl.offsetWidth - 8) + 'px';
    }
  }

  /* ---------- keyboard ---------- */

  onKeyDown(e, source) {
    if (this.edit) this.onEditingKey(e, source);
    else if (source === 'cell') this.onGridKey(e);
  }

  onGlobalKey(e) {
    const t = e.target;
    const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (e.key === 'Escape' && (this.popups.children.length || this.$('.modal-backdrop'))) {
      if (this.$('.modal-backdrop')) this.closeModal();
      else this.closePopups();
      e.preventDefault();
      if (!inField) this.focusGrid();
      return;
    }
    if (inField) return;
    if (t && t.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
    if (this.$('.modal-backdrop')) return;
    this.focusGrid();
    this.onGridKey(e);
  }

  onGridKey(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;
    const lk = k.length === 1 ? k.toLowerCase() : k;
    const stop = () => e.preventDefault();
    if (this.selectedChart && (k === 'Delete' || k === 'Backspace')) { stop(); this.deleteChart(this.selectedChart); return; }
    if (e.altKey && (k === '=' || k === '+')) { stop(); this.autoSum('SUM'); return; }
    if (ctrl) {
      const map = {
        z: () => (e.shiftKey ? this.redo() : this.undo()), y: () => this.redo(), b: () => this.run('bold'), i: () => this.run('italic'),
        u: () => this.run('underline'), 5: () => this.run('strike'), a: () => this.selectAll(), f: () => this.openPanel('find'),
        h: () => this.openPanel('find', { replace: true }), d: () => this.fillDirection('down'), r: () => this.fillDirection('right'),
        s: () => this.exportXlsx(), o: () => this.$('#fileInput').click(), '`': () => this.toggleFormulas(), ';': () => this.insertNow(false),
        ' ': () => this.selectCols(this.sel.ac, false), Home: () => { this.selectCell(0, 0); this.grid.scrollIntoView(0, 0); },
        End: () => { const b = this.sheet.bounds(); this.selectCell(Math.max(0, b.r), Math.max(0, b.c)); this.grid.scrollIntoView(this.sel.ar, this.sel.ac); },
      };
      if (lk === 'l' && e.shiftKey) { stop(); this.toggleFilter(); return; }
      if (e.shiftKey && k === ':') { stop(); this.insertNow(true); return; }
      const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (arrows[k]) { stop(); this.moveActive(...arrows[k], e.shiftKey, true); return; }
      if (map[lk]) { stop(); map[lk](); }
      return;
    }
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) { stop(); this.moveActive(...arrows[k], e.shiftKey); return; }
    switch (k) {
      case 'Tab': stop(); this.moveActive(0, e.shiftKey ? -1 : 1, false, false, true); return;
      case 'Enter': stop(); this.moveActive(e.shiftKey ? -1 : 1, 0, false, false, true); return;
      case 'F2': stop(); this.startEdit('edit'); return;
      case 'Delete': stop(); this.clearSelection('contents'); return;
      case 'Backspace': stop(); this.startEdit('enter', ''); return;
      case 'Escape': stop(); this.clip = null; this.closePopups(); this.selectChart(null); this.grid.requestDraw(); return;
      case 'Home': stop(); this.selectCell(this.sel.ar, 0); this.grid.scrollIntoView(this.sel.ar, 0); return;
      case 'PageDown': stop(); this.moveActive(this.grid.pageRows(), 0, e.shiftKey); return;
      case 'PageUp': stop(); this.moveActive(-this.grid.pageRows(), 0, e.shiftKey); return;
      case 'F11': if (e.shiftKey) { stop(); this.addSheet(); } return;
      case 'F3': if (e.shiftKey) { stop(); this.openFunctionBrowser(); } return;
      case ' ': if (e.shiftKey) { stop(); this.selectRows(this.sel.ar, false); } return;
      default:
    }
  }

  onEditingKey(e, source) {
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const el = this.editorEl(source);
    if (this.ac) {
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        this.ac.index = (this.ac.index + (k === 'ArrowDown' ? 1 : -1) + this.ac.list.length) % this.ac.list.length;
        this.renderAutocomplete();
        return;
      }
      if (k === 'Tab' || k === 'Enter') { e.preventDefault(); this.acceptAutocomplete(); return; }
      if (k === 'Escape') { e.preventDefault(); this.closeAutocomplete(); return; }
    }
    if (k === 'Enter' && (e.altKey || (source === 'bar' && e.shiftKey && ctrl))) {
      e.preventDefault();
      const s = el.selectionStart;
      el.setRangeText('\n', s, el.selectionEnd, 'end');
      el.dispatchEvent(new Event('input'));
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (ctrl) this.commitEdit(0, 0, { fillSelection: true });
      else this.commitEdit(e.shiftKey ? -1 : 1, 0);
      return;
    }
    if (k === 'Tab') { e.preventDefault(); this.commitEdit(0, e.shiftKey ? -1 : 1); return; }
    if (k === 'Escape') { e.preventDefault(); this.cancelEdit(); return; }
    if (k === 'F4') { e.preventDefault(); this.cycleAbsolute(); return; }
    if (k === 'F2') {
      e.preventDefault();
      this.edit.mode = this.edit.mode === 'enter' ? 'edit' : 'enter';
      this.updateStatus();
      return;
    }
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k] && this.edit.mode === 'enter' && source === 'cell' && !ctrl) {
      const text = el.value;
      const caret = el.selectionStart;
      const e2 = this.edit;
      const pointActive = e2.point && e2.point.end === caret && text.slice(e2.point.start, e2.point.end) === e2.point.text;
      e.preventDefault();
      if (text.startsWith('=') && (pointActive || this.refInsertable(text, caret))) this.movePointRef(...arrows[k], e.shiftKey);
      else this.commitEdit(...arrows[k]);
    }
  }

  /* ---------- clipboard ---------- */

  selectionText(g) {
    const sh = this.sheet;
    const rows = [];
    for (let r = g.r1; r <= g.r2; r++) {
      if (sh.hidden.has(r)) continue;
      const row = [];
      for (let c = g.c1; c <= g.c2; c++) {
        const t = displayText(sh, r, c);
        row.push(/[\t\n"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
      }
      rows.push(row.join('\t'));
    }
    return rows.join('\n');
  }

  onCopy(e, cut) {
    if (this.edit || !this.gridFocused()) return;
    e.preventDefault();
    const sh = this.sheet;
    let g = this.selRange();
    const b = sh.bounds();
    g = { ...g, r2: Math.min(g.r2, Math.max(g.r1, b.r)), c2: Math.min(g.c2, Math.max(g.c1, b.c)) };
    const text = this.selectionText(g);
    let html = '<table>';
    for (let r = g.r1; r <= g.r2; r++) {
      if (sh.hidden.has(r)) continue;
      html += '<tr>';
      for (let c = g.c1; c <= g.c2; c++) html += `<td>${escHtml(displayText(sh, r, c))}</td>`;
      html += '</tr>';
    }
    html += '</table>';
    e.clipboardData.setData('text/plain', text);
    e.clipboardData.setData('text/html', html);
    this.clip = { blk: copyBlock(sh, g), cut, text };
    this.startMarch();
    this.toast(`${cut ? 'Cut' : 'Copied'} ${rangeName(g)} — press Ctrl+V to paste`, 'quiet');
  }

  startMarch() {
    clearInterval(this._march);
    this._march = setInterval(() => {
      if (!this.clip) { clearInterval(this._march); return; }
      this.marchOffset = (this.marchOffset + 1) % 20;
      this.grid.requestDraw();
    }, 60);
  }

  onPaste(e) {
    if (this.edit || !this.gridFocused()) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const norm2 = (s) => String(s || '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
    if (this.clip && (!text || norm2(text) === norm2(this.clip.text))) this.pasteInternal(false);
    else if (text) this.pasteExternal(text);
  }

  pasteInternal(valuesOnly) {
    if (!this.clip) { this.toast('The clipboard is empty — copy some cells first'); return; }
    const { blk, cut } = this.clip;
    const sh = this.sheet;
    const g = this.selRange();
    this.commit(cut ? 'Move cells' : valuesOnly ? 'Paste values' : 'Paste', () => {
      const dst = pasteBlock(this.wb, sh, g.r1, g.c1, blk, { cut: cut && !valuesOnly, valuesOnly });
      this.sel = { ...dst, ar: dst.r1, ac: dst.c1, anchorR: dst.r1, anchorC: dst.c1 };
    });
    if (cut) this.clip = null;
  }

  pasteExternal(text) {
    const rows = /[\t\n]/.test(text.replace(/\n+$/, '')) ? parseDelimited(text.replace(/\r?\n$/, ''), '\t') : [[text]];
    const g = this.selRange();
    this.commit('Paste', () => {
      const dst = pasteText(this.sheet, g.r1, g.c1, rows);
      this.sel = { ...dst, ar: dst.r1, ac: dst.c1, anchorR: dst.r1, anchorC: dst.c1 };
    });
  }

  async menuPaste(valuesOnly) {
    if (this.clip) { this.pasteInternal(valuesOnly); return; }
    try {
      const text = await navigator.clipboard.readText();
      if (text) this.pasteExternal(text);
    } catch (e) {
      this.toast('Use Ctrl+V to paste from other applications', 'quiet');
    }
  }

  menuCopy(cut) {
    this.focusGrid();
    let ok = false;
    try { ok = document.execCommand(cut ? 'cut' : 'copy'); } catch (e) { ok = false; }
    if (!ok) {
      const g = this.selRange();
      this.clip = { blk: copyBlock(this.sheet, g), cut, text: this.selectionText(g) };
      this.startMarch();
      this.grid.requestDraw();
    }
  }

  /* ---------- commands ---------- */

  run(cmd, arg, el) {
    const f = this.commands[cmd];
    if (f) f(arg, el);
  }

  buildCommands() {
    return {
      undo: () => this.undo(),
      redo: () => this.redo(),
      import: () => this.$('#fileInput').click(),
      exportMenu: (a, el) => this.openExportMenu(el),
      numFmtMenu: (a, el) => this.openNumFmtMenu(el),
      fmtCurrency: () => this.toggleNumFmt('$#,##0.00', 'Currency format'),
      fmtPercent: () => this.toggleNumFmt('0%', 'Percent format'),
      decDec: () => this.decimals(-1),
      decInc: () => this.decimals(1),
      fontSizeMenu: (a, el) => this.openFontSizeMenu(el),
      bold: () => this.toggleStyle('b', 'Bold'),
      italic: () => this.toggleStyle('i', 'Italic'),
      underline: () => this.toggleStyle('u', 'Underline'),
      strike: () => this.toggleStyle('st', 'Strikethrough'),
      textColor: () => this.setStyle({ fc: this.colors.fc }, 'Text color'),
      textColorMenu: (a, el) => this.openColorMenu(el, 'fc'),
      fillColor: () => this.setStyle({ bg: this.colors.bg }, 'Fill color'),
      fillColorMenu: (a, el) => this.openColorMenu(el, 'bg'),
      bordersMenu: (a, el) => this.openBordersMenu(el),
      merge: () => this.mergeToggle(),
      mergeMenu: (a, el) => this.openMergeMenu(el),
      alignLeft: () => this.setAlign('left'),
      alignCenter: () => this.setAlign('center'),
      alignRight: () => this.setAlign('right'),
      wrap: () => this.toggleStyle('wrap', 'Wrap text'),
      insertMenu: (a, el) => this.openInsertMenu(el),
      deleteMenu: (a, el) => this.openDeleteMenu(el),
      sortAsc: () => this.quickSort(false),
      sortDesc: () => this.quickSort(true),
      filterToggle: () => this.toggleFilter(),
      chartMenu: (a, el) => this.openChartMenu(el),
      autosumMenu: (a, el) => this.openAutosumMenu(el),
      recordForm: () => this.openPanel('form'),
      find: () => this.openPanel('find'),
      functions: () => this.openFunctionBrowser(),
      addSheet: () => this.addSheet(),
    };
  }

  targetRange() {
    this.commitEdit();
    return this.selRange();
  }

  toggleStyle(key, label) {
    const g = this.targetRange();
    const cell = this.activeCell();
    const on = !(cell && cell.s && cell.s[key]);
    this.commit(label, () => styleRange(this.sheet, g, { [key]: on || undefined }));
  }

  setStyle(patch, label) {
    const g = this.targetRange();
    this.commit(label, () => styleRange(this.sheet, g, patch));
  }

  setAlign(ha) {
    const cell = this.activeCell();
    const cur = cell && cell.s && cell.s.ha;
    this.setStyle({ ha: cur === ha ? undefined : ha }, `Align ${ha}`);
  }

  setNumFmt(code, label = 'Number format') {
    this.setStyle({ nf: code === 'General' ? undefined : code }, label);
  }

  toggleNumFmt(code, label) {
    const cell = this.activeCell();
    const cur = cell && cell.s && cell.s.nf;
    this.setNumFmt(cur === code ? 'General' : code, label);
  }

  decimals(delta) {
    const cell = this.activeCell();
    const code = adjustDecimals(cell && cell.s && cell.s.nf, delta, cellValue(cell));
    this.setNumFmt(code, delta > 0 ? 'Increase decimals' : 'Decrease decimals');
  }

  applyBorders(mode) {
    const g = this.targetRange();
    this.commit('Borders', () => bordersRange(this.sheet, g, mode));
  }

  clearSelection(what) {
    const g = this.targetRange();
    this.commit(what === 'formats' ? 'Clear formatting' : what === 'all' ? 'Clear all' : 'Clear contents', () => clearRange(this.sheet, g, what));
  }

  async mergeCmd(mode) {
    const g = this.targetRange();
    const sh = this.sheet;
    if (mode === 'unmerge') {
      if (!sh.merges.some((m) => intersects(m, g))) { this.toast('The selection has no merged cells'); return; }
      this.commit('Unmerge cells', () => unmergeRange(sh, g));
      return;
    }
    if (g.r1 === g.r2 && g.c1 === g.c2) { this.toast('Select two or more cells to merge'); return; }
    if (mode === 'rows' && g.c1 === g.c2) { this.toast('Select several columns to merge across'); return; }
    const lose = mode === 'rows'
      ? Array.from({ length: g.r2 - g.r1 + 1 }, (_, i) => mergeLosesData(sh, { ...g, r1: g.r1 + i, r2: g.r1 + i })).some(Boolean)
      : mergeLosesData(sh, g);
    if (lose && !(await this.confirm('Merge cells?', 'Merging keeps only the value in the upper-left cell and discards the others.', 'Merge anyway'))) return;
    this.commit('Merge cells', () => {
      mergeRange(sh, g, mode === 'rows' ? 'rows' : 'all');
      if (mode === 'center') styleRange(sh, { r1: g.r1, c1: g.c1, r2: g.r2, c2: g.c1 }, { ha: 'center', va: 'middle' });
    });
    this.setSelection(g, g.r1, g.c1);
  }

  mergeToggle() {
    const g = this.selRange();
    const sh = this.sheet;
    if (sh.merges.some((m) => intersects(m, g))) this.mergeCmd('unmerge');
    else this.mergeCmd('center');
  }

  insertRows(where) {
    const g = this.targetRange();
    const sh = this.sheet;
    const full = g.c1 === 0 && g.c2 >= sh.cols - 1;
    const n = g.r2 - g.r1 + 1;
    const at = where === 'above' ? g.r1 : g.r2 + 1;
    this.commit(`Insert ${n} row${n > 1 ? 's' : ''}`, () => structural(this.wb, sh, 'row', at, n));
    if (full) this.setSelection({ r1: at, r2: at + n - 1, c1: 0, c2: sh.cols - 1 }, at, this.sel.ac);
    else if (where === 'above') this.setSelection({ ...g, r1: g.r1 + n, r2: g.r2 + n }, this.sel.ar + n, this.sel.ac);
  }

  insertCols(where) {
    const g = this.targetRange();
    const sh = this.sheet;
    const full = g.r1 === 0 && g.r2 >= sh.rows - 1;
    const n = g.c2 - g.c1 + 1;
    const at = where === 'left' ? g.c1 : g.c2 + 1;
    this.commit(`Insert ${n} column${n > 1 ? 's' : ''}`, () => structural(this.wb, sh, 'col', at, n));
    if (full) this.setSelection({ c1: at, c2: at + n - 1, r1: 0, r2: sh.rows - 1 }, this.sel.ar, at);
    else if (where === 'left') this.setSelection({ ...g, c1: g.c1 + n, c2: g.c2 + n }, this.sel.ar, this.sel.ac + n);
  }

  deleteRows() {
    const g = this.targetRange();
    const n = g.r2 - g.r1 + 1;
    this.commit(`Delete ${n} row${n > 1 ? 's' : ''}`, () => structural(this.wb, this.sheet, 'row', g.r1, -n));
    this.selectCell(Math.min(g.r1, this.sheet.rows - 1), this.sel.ac);
  }

  deleteCols() {
    const g = this.targetRange();
    const n = g.c2 - g.c1 + 1;
    this.commit(`Delete ${n} column${n > 1 ? 's' : ''}`, () => structural(this.wb, this.sheet, 'col', g.c1, -n));
    this.selectCell(this.sel.ar, Math.min(g.c1, this.sheet.cols - 1));
  }

  resizeTo(axis, idx, size) {
    const sh = this.sheet;
    const g = this.selRange();
    let targets = [idx];
    if (axis === 'col' && g.r1 === 0 && g.r2 >= sh.rows - 1 && idx >= g.c1 && idx <= g.c2) targets = Array.from({ length: g.c2 - g.c1 + 1 }, (_, i) => g.c1 + i);
    if (axis === 'row' && g.c1 === 0 && g.c2 >= sh.cols - 1 && idx >= g.r1 && idx <= g.r2) targets = Array.from({ length: g.r2 - g.r1 + 1 }, (_, i) => g.r1 + i);
    this.commit(axis === 'col' ? 'Resize column' : 'Resize row', () => {
      for (const t of targets) {
        const store = axis === 'col' ? sh.colW : sh.rowH;
        if (size === null) delete store[t];
        else store[t] = size;
      }
    });
  }

  autofitCol(c) {
    const sh = this.sheet;
    const b = sh.bounds();
    let w = 0;
    for (let r = 0; r <= b.r; r++) {
      const cell = sh.get(r, c);
      if (!cell) continue;
      const m = sh.mergeAt(r, c);
      if (m && m.c1 !== m.c2) continue;
      const t = this.showFormulas && cell.f !== undefined ? '=' + cell.f : displayText(sh, r, c);
      if (!t) continue;
      const s = cell.s || {};
      const fs = s.fs ? (s.fs * 4) / 3 : 13;
      let tw = Math.max(...String(t).split('\n').map((line) => this.measure(line, `${s.i ? 'italic ' : ''}${s.b ? 600 : 400} ${fs}px ${FONT_STACK}`)));
      if (sh.filter && r === sh.filter.r1 && c >= sh.filter.c1 && c <= sh.filter.c2) tw += 22;
      w = Math.max(w, tw);
    }
    this.resizeTo('col', c, clamp(Math.ceil(w + 16), 36, 520));
  }

  setFreeze(r, c) {
    this.commit(r || c ? 'Freeze panes' : 'Unfreeze panes', () => { this.sheet.freeze = { r, c }; });
    this.grid.scroller.scrollTop = 0;
    this.grid.scroller.scrollLeft = 0;
  }

  toggleFormulas() {
    this.showFormulas = !this.showFormulas;
    this.grid.draw();
    this.toast(this.showFormulas ? 'Showing formulas (Ctrl+` to switch back)' : 'Showing values', 'quiet');
    this.updateToolbar();
  }

  toggleGridlines() {
    this.commit('Toggle gridlines', () => { this.sheet.showGrid = !this.sheet.showGrid; });
  }

  insertNow(time) {
    const d = new Date();
    const text = time
      ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.startEdit('enter', text);
  }

  fillDirection(dir) {
    const g = this.targetRange();
    const sh = this.sheet;
    if (dir === 'down') {
      if (g.r1 === g.r2) { if (g.r1 === 0) return; this.commit('Fill down', () => fillRange(sh, { ...g, r1: g.r1 - 1, r2: g.r1 - 1 }, { ...g, r1: g.r1 - 1 })); return; }
      this.commit('Fill down', () => fillRange(sh, { ...g, r2: g.r1 }, g));
    } else {
      if (g.c1 === g.c2) { if (g.c1 === 0) return; this.commit('Fill right', () => fillRange(sh, { ...g, c1: g.c1 - 1, c2: g.c1 - 1 }, { ...g, c1: g.c1 - 1 })); return; }
      this.commit('Fill right', () => fillRange(sh, { ...g, c2: g.c1 }, g));
    }
  }

  doFill(src, dst) {
    const sh = this.sheet;
    const n = (dst.r2 - dst.r1 + 1) * (dst.c2 - dst.c1 + 1) - (src.r2 - src.r1 + 1) * (src.c2 - src.c1 + 1);
    this.commit('Fill series', () => fillRange(sh, src, dst));
    this.setSelection(dst, this.sel.ar, this.sel.ac);
    this.toast(`Filled ${n} cell${n === 1 ? '' : 's'} — numbers, dates, weekdays and "Item 1" style text continue as a series`, 'quiet');
  }

  autoSum(fn = 'SUM') {
    const sh = this.sheet;
    const g = this.targetRange();
    const multi = g.r1 !== g.r2 || g.c1 !== g.c2;
    if (multi) {
      this.commit(`AutoSum (${fn})`, () => {
        for (let c = g.c1; c <= g.c2; c++) {
          let hasNum = false;
          for (let r = g.r1; r <= g.r2; r++) if (typeof cellValue(sh.get(r, c)) === 'number') hasNum = true;
          if (hasNum) writeInput(sh, g.r2 + 1, c, `=${fn}(${rangeName({ r1: g.r1, c1: c, r2: g.r2, c2: c })})`);
        }
        sh.ensureSize(g.r2 + 1, g.c2);
      });
      this.setSelection({ r1: g.r2 + 1, r2: g.r2 + 1, c1: g.c1, c2: g.c2 });
      return;
    }
    const { ar, ac } = this.sel;
    const isNum = (r, c) => typeof cellValue(sh.get(r, c)) === 'number';
    let ref = '';
    let r = ar - 1;
    while (r >= 0 && isNum(r, ac)) r--;
    if (r < ar - 1) ref = rangeName({ r1: r + 1, c1: ac, r2: ar - 1, c2: ac });
    else {
      let c = ac - 1;
      while (c >= 0 && isNum(ar, c)) c--;
      if (c < ac - 1) ref = rangeName({ r1: ar, c1: c + 1, r2: ar, c2: ac - 1 });
    }
    this.startEdit('enter', `=${fn}(${ref})`);
    const pos = fn.length + 2;
    if (ref) {
      const g2 = parseRange(ref);
      this.edit.point = { start: pos, end: pos + ref.length, text: ref, anchor: { r: g2.r1, c: g2.c1 }, cur: { r: g2.r2, c: g2.c2 } };
      this.ed.setSelectionRange(pos + ref.length, pos + ref.length);
      this.updateRefHighlights(this.ed.value);
    } else this.ed.setSelectionRange(pos, pos);
    this.onCaretMove('cell');
  }

  /* ---------- sort & filter ---------- */

  sortTarget() {
    const sh = this.sheet;
    const { ar, ac } = this.sel;
    const g = this.selRange();
    if (sh.filter && inRange(sh.filter, ar, ac) && !(g.r1 !== g.r2 && !inRange(sh.filter, g.r2, g.c2))) {
      return { g: { ...sh.filter, r1: sh.filter.r1 + 1 }, header: true, headerRow: sh.filter.r1 };
    }
    let region = g.r1 !== g.r2 || g.c1 !== g.c2 ? g : currentRegion(sh, ar, ac);
    const b = sh.bounds();
    region = { ...region, r2: Math.min(region.r2, b.r), c2: Math.min(region.c2, b.c) };
    const header = detectHeader(sh, region);
    return { g: header ? { ...region, r1: region.r1 + 1 } : region, header, headerRow: header ? region.r1 : -1 };
  }

  columnLabel(c, headerRow) {
    const t = headerRow >= 0 ? displayText(this.sheet, headerRow, c) : '';
    return t || `column ${String.fromCharCode(65 + (c % 26))}`;
  }

  quickSort(desc) {
    this.commitEdit();
    const t = this.sortTarget();
    const sh = this.sheet;
    if (t.g.r2 <= t.g.r1) { this.toast('Select a cell inside a table with at least two rows to sort'); return; }
    const c = clamp(this.sel.ac, t.g.c1, t.g.c2);
    let err = null;
    this.commit(`Sort ${desc ? 'Z → A' : 'A → Z'}`, () => {
      err = sortRange(this.wb, sh, t.g, [{ c, desc }]);
      return err ? false : undefined;
    });
    if (err) this.toast(err, 'error');
    else this.toast(`Sorted ${rangeName(t.g)} by ${this.columnLabel(c, t.headerRow)} (${desc ? 'Z → A' : 'A → Z'})`, 'success');
  }

  toggleFilter() {
    this.commitEdit();
    const sh = this.sheet;
    if (sh.filter) {
      this.commit('Remove filter', () => { sh.filter = null; sh.hidden.clear(); });
      this.toast('Filter removed', 'quiet');
      return;
    }
    const g0 = this.selRange();
    let g = g0.r1 !== g0.r2 || g0.c1 !== g0.c2 ? g0 : currentRegion(sh, this.sel.ar, this.sel.ac);
    const b = sh.bounds();
    g = { ...g, r2: Math.min(g.r2, Math.max(g.r1 + 1, b.r)), c2: Math.min(g.c2, Math.max(g.c1, b.c)) };
    if (g.r1 === g.r2 || isBlank(sh.get(g.r1, g.c1)) && isBlank(sh.get(g.r1 + 1, g.c1)) && g.c1 === g.c2) {
      this.toast('Select a cell inside a table first — the first row becomes the filter header');
      return;
    }
    this.commit('Create filter', () => { sh.filter = { ...g, crit: {} }; });
    this.toast(`Filter added to ${rangeName(g)} — use the ▾ buttons in the header row`, 'success');
  }

  setFilterCriteria(c, crit, label = 'Filter') {
    const sh = this.sheet;
    this.commit(label, () => {
      if (!sh.filter) return false;
      sh.filter.crit = { ...sh.filter.crit };
      if (crit && (crit.values || crit.cond)) sh.filter.crit[c] = crit;
      else delete sh.filter.crit[c];
      applyFilter(sh);
    });
  }

  clearFilters() {
    const sh = this.sheet;
    if (!sh.filter) return;
    this.commit('Clear filters', () => { sh.filter.crit = {}; applyFilter(sh); });
  }

  filterByValue() {
    const sh = this.sheet;
    const { ar, ac } = this.sel;
    const text = displayText(sh, ar, ac);
    if (!sh.filter || !inRange(sh.filter, ar, ac) || ar === sh.filter.r1) {
      const g = currentRegion(sh, ar, ac);
      if (g.r1 === ar) { this.toast('Pick a value below the header row'); return; }
      this.commit('Create filter', () => { sh.filter = { ...g, crit: {} }; });
    }
    this.setFilterCriteria(ac, { values: [text], cond: null }, 'Filter by value');
    this.toast(`Showing rows where ${this.columnLabel(ac, sh.filter.r1)} is "${text || '(blank)'}"`, 'success');
  }

  sortFromFilter(c, desc) {
    const sh = this.sheet;
    const f = sh.filter;
    if (!f) return;
    const g = { ...f, r1: f.r1 + 1 };
    let err = null;
    this.commit(`Sort ${desc ? 'Z → A' : 'A → Z'}`, () => {
      err = sortRange(this.wb, sh, g, [{ c, desc }]);
      return err ? false : undefined;
    });
    if (err) this.toast(err, 'error');
  }

  /* ---------- sheets ---------- */

  saveSheetState() {
    if (!this.wb) return;
    this.sheetState.set(this.sheet.id, { sel: { ...this.sel }, sx: this.grid.sx, sy: this.grid.sy });
  }

  setActiveSheet(i) {
    if (i === this.wb.active || i < 0 || i >= this.wb.sheets.length) return;
    this.commitEdit();
    this.saveSheetState();
    this.wb.active = i;
    this.selectedChart = null;
    this.clip = this.clip && this.clip.blk ? this.clip : null;
    const st = this.sheetState.get(this.sheet.id);
    this.sel = st ? st.sel : { r1: 0, c1: 0, r2: 0, c2: 0, ar: 0, ac: 0, anchorR: 0, anchorC: 0 };
    this.grid.layout();
    this.grid.scroller.scrollLeft = st ? st.sx : 0;
    this.grid.scroller.scrollTop = st ? st.sy : 0;
    this.grid.sx = this.grid.scroller.scrollLeft;
    this.grid.sy = this.grid.scroller.scrollTop;
    this.after({ noSave: true });
    this.onGridScroll();
    this.focusGrid();
  }

  addSheet() {
    this.commitEdit();
    let idx = 0;
    this.commit('Add sheet', () => {
      this.wb.addSheet(null, this.wb.active + 1);
      idx = this.wb.active + 1;
    });
    this.setActiveSheet(idx);
  }

  /* ---------- import / export ---------- */

  async importFile(file) {
    const name = file.name;
    const ext = (name.split('.').pop() || '').toLowerCase();
    try {
      let wb2;
      if (['csv', 'tsv', 'txt'].includes(ext)) wb2 = importCsv(await file.text(), name);
      else if (ext === 'xls') throw new Error('Legacy .xls (Excel 97-2003) files are not supported — save the file as .xlsx and try again.');
      else wb2 = await importXlsx(await file.arrayBuffer(), name);
      this.replaceWorkbook(wb2, `Import ${name}`);
    } catch (err) {
      this.toast(`Could not open ${name}: ${err.message}`, 'error');
    }
  }

  async loadSampleFile() {
    try {
      const res = await fetch('samples/inventory.xlsx');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const wb2 = await importXlsx(await res.arrayBuffer(), 'inventory.xlsx');
      this.replaceWorkbook(wb2, 'Import inventory.xlsx');
    } catch (err) {
      this.toast(`Could not load the sample file: ${err.message}`, 'error');
    }
  }

  replaceWorkbook(wb2, label) {
    this.cancelEdit();
    this.closePanel();
    this.saveSheetState();
    this.commit(label, () => {
      this.wb.title = wb2.title;
      this.wb.sheets = wb2.sheets;
      this.wb.active = wb2.active || 0;
      this.sel = { r1: 0, c1: 0, r2: 0, c2: 0, ar: 0, ac: 0, anchorR: 0, anchorC: 0 };
    });
    this.sheetState.clear();
    this.clip = null;
    this.titleInput.value = this.wb.title;
    document.title = `${this.wb.title} · Cellwise`;
    this.grid.scroller.scrollLeft = 0;
    this.grid.scroller.scrollTop = 0;
    const st = wb2.importStats;
    if (st) {
      const parts = [`${wb2.sheets.length} sheet${wb2.sheets.length > 1 ? 's' : ''}`, `${st.cells} cells`];
      if (st.formulas) parts.push(`${st.formulas} formulas`);
      this.toast(`${label.replace(/^Import/, 'Imported')} — ${parts.join(', ')}${st.dropped ? ` (${st.dropped} unsupported formulas kept as values)` : ''}`, 'success', { label: 'Undo', fn: () => this.undo() });
    } else this.toast(`${label} — ${wb2.sheets.length} sheet${wb2.sheets.length > 1 ? 's' : ''}`, 'success', { label: 'Undo', fn: () => this.undo() });
  }

  fileBase() {
    return (this.wb.title || 'workbook').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'workbook';
  }

  async exportXlsx() {
    this.commitEdit();
    try {
      const bytes = await exportXlsx(this.wb);
      const name = `${this.fileBase()}.xlsx`;
      downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
      this.toast(`Downloaded ${name} — values, formulas, formatting, merges and filters included`, 'success');
    } catch (err) {
      this.toast(`Export failed: ${err.message}`, 'error');
    }
  }

  exportCsv() {
    this.commitEdit();
    const name = `${this.fileBase()} - ${this.sheet.name}.csv`;
    downloadBlob(new Blob([exportCsv(this.sheet)], { type: 'text/csv;charset=utf-8' }), name);
    this.toast(`Downloaded ${name}`, 'success');
  }

  async exportBase64() {
    const bytes = await exportXlsx(this.wb);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  async importBase64(b64, name = 'test.xlsx') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const wb2 = await importXlsx(bytes.buffer, name);
    this.replaceWorkbook(wb2, `Import ${name}`);
    return wb2.sheets.length;
  }

  /* ---------- toolbar / formula bar / status ---------- */

  updateFormulaBar() {
    if (!this.wb) return;
    const g = this.selRange();
    const s = this.sel;
    const am = this.sheet.mergeAt(s.ar, s.ac);
    const single = sameRange(g, am || { r1: s.ar, c1: s.ac, r2: s.ar, c2: s.ac });
    if (document.activeElement !== this.nameBox) this.nameBox.value = single ? cellName(s.ar, s.ac) : rangeName(g);
    if (!this.edit) {
      const text = inputText(this.activeCell());
      this.fb.value = text;
      this.fbMirror.innerHTML = this.highlightHtml(text);
      this.fbWrap.classList.toggle('formula', text.startsWith('='));
    }
  }

  updateToolbar() {
    if (!this.wb) return;
    const sh = this.sheet;
    const cell = this.activeCell();
    const s = (cell && cell.s) || {};
    for (const b of document.querySelectorAll('#toolbar [data-state]')) {
      const st = b.dataset.state;
      let on;
      if (st.includes(':')) {
        const [k, v] = st.split(':');
        on = s[k] === v;
      } else if (st === 'merged') on = sh.merges.some((m) => intersects(m, this.selRange()));
      else if (st === 'filter') on = !!sh.filter;
      else on = !!s[st];
      b.classList.toggle('active', on);
    }
    this.$('#nfLabel').textContent = formatLabel(s.nf);
    this.$('#fsLabel').textContent = s.fs || 10;
    this.$('#fcSwatch').style.background = this.colors.fc;
    this.$('#bgSwatch').style.background = this.colors.bg;
    this.$('[data-cmd="undo"]').disabled = !this.undoStack.length;
    this.$('[data-cmd="redo"]').disabled = !this.redoStack.length;
  }

  updateStatus() {
    if (!this.wb) return;
    const el = this.$('#status');
    const sh = this.sheet;
    const e = this.edit;
    const mode = e ? (e.point ? 'Point' : e.mode === 'enter' ? 'Enter' : 'Edit') : 'Ready';
    const parts = [`<span class="mode mode-${mode.toLowerCase()}">${mode}</span>`];
    if (sh.filter) {
      const total = sh.filter.r2 - sh.filter.r1;
      const shown = total - [...sh.hidden].filter((r) => r > sh.filter.r1 && r <= sh.filter.r2).length;
      parts.push(`<span class="filter-info">${shown < total ? `Filter: <b>${shown}</b> of ${total} rows` : `Filter on ${rangeName(sh.filter)}`}</span>`);
    }
    const g = this.selRange();
    const b = sh.bounds();
    const r2 = Math.min(g.r2, b.r);
    const c2 = Math.min(g.c2, b.c);
    let count = 0;
    let n = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let nf = null;
    if ((r2 - g.r1 + 1) * (c2 - g.c1 + 1) <= 200000) {
      for (let r = g.r1; r <= r2; r++) {
        if (sh.hidden.has(r)) continue;
        for (let c = g.c1; c <= c2; c++) {
          const cell = sh.get(r, c);
          const v = cellValue(cell);
          if (v === null || v === '') continue;
          count++;
          if (typeof v === 'number') {
            n++;
            sum += v;
            if (v < min) min = v;
            if (v > max) max = v;
            if (!nf && cell.s && cell.s.nf) nf = cell.s.nf;
          }
        }
      }
    }
    if (count > 1) {
      const f = (v) => formatNumber(v, nf && !/%/.test(nf) ? nf : nf || '#,##0.##').text;
      const stat = (k, v) => `<span class="stat">${k} <b>${escHtml(v)}</b></span>`;
      const st = [];
      if (n) st.push(stat('Sum', f(sum)), stat('Average', f(sum / n)), stat('Min', f(min)), stat('Max', f(max)));
      st.push(stat('Count', String(count)));
      parts.push(`<span class="stats">${st.join('')}</span>`);
    }
    el.innerHTML = parts.join('');
  }
}

Object.assign(App.prototype, UI, Panels);

window.addEventListener('DOMContentLoaded', () => new App());

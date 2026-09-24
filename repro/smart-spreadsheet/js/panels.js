// Panels mixin: chart layer & editor, record form, find/replace, sort dialog, function browser, help.
import { h, icon, iconEl, uid, rangeName, parseAreas, areasName, inRange, clamp, colName, escHtml, downloadBlob, cellName } from './util.js';
import {
  writeInput, structural, currentRegion, detectHeader, sortRange, appendRecord, displayText, cellValue, isBlank,
} from './model.js';
import { chartData, renderChart, svgToPng, PALETTES, formatValue } from './charts.js';
import { FUNCS, CATEGORIES, functionList } from './formula.js';
import { inputText } from './format.js';

const TYPE_LABEL = { bar: 'Bar', line: 'Line', pie: 'Pie' };

export const Panels = {
  /* ---------- charts ---------- */

  chartById(id) {
    for (const sh of this.wb.sheets) {
      const ch = sh.charts.find((c) => c.id === id);
      if (ch) return ch;
    }
    return null;
  },

  chartSourceRange() {
    const sh = this.sheet;
    const g = this.selRange();
    const b = sh.bounds();
    if (g.r1 !== g.r2 || g.c1 !== g.c2) return { ...g, r2: Math.min(g.r2, Math.max(g.r1, b.r)), c2: Math.min(g.c2, Math.max(g.c1, b.c)) };
    if (sh.filter && inRange(sh.filter, this.sel.ar, this.sel.ac)) return { r1: sh.filter.r1, c1: sh.filter.c1, r2: sh.filter.r2, c2: sh.filter.c2 };
    return currentRegion(sh, this.sel.ar, this.sel.ac);
  },

  insertChart(type) {
    this.commitEdit();
    const sh = this.sheet;
    const g = this.chartSourceRange();
    const probe = { type, areas: [g], seriesIn: 'auto', header: 'auto', labels: 'auto' };
    const data = chartData(sh, probe);
    if (!data || !data.series.some((s) => s.values.some((v) => v !== null))) {
      this.toast('Select a range that contains numbers (with optional headers and labels) to create a chart', 'error');
      return;
    }
    const grid = this.grid;
    const w = 480;
    const ht = 300;
    let x = grid.colX[Math.min(g.c2 + 1, sh.cols)] + 24;
    let y = grid.rowY[g.r1];
    const viewL = grid.sx;
    const viewR = grid.sx + grid.W - grid.hw;
    const viewT = grid.sy;
    const viewB = grid.sy + grid.H - grid.hh;
    if (x + w > viewR) x = Math.max(viewL + 24, viewR - w - 24);
    if (y + ht > viewB || y < viewT) y = Math.max(viewT + 12, Math.min(y, viewB - ht - 12));
    while (sh.charts.some((c) => Math.abs(c.x - x) < 12 && Math.abs(c.y - y) < 12)) { x += 28; y += 28; }
    let title = `${TYPE_LABEL[type]} chart`;
    if (data.series.length === 1 && data.header) title = `${data.series[0].name}${data.labels ? ' by ' + (displayText(sh, g.r1, g.c1) || 'category') : ''}`;
    else if (data.series.length > 1 && data.header) title = data.series.slice(0, 3).map((s) => s.name).join(', ') + (data.series.length > 3 ? '…' : '');
    const id = uid('c');
    this.commit(`Insert ${type} chart`, () => {
      sh.charts.push({
        id, type, title, areas: [g], x: Math.round(x), y: Math.round(y), w, h: ht,
        seriesIn: 'auto', header: 'auto', labels: 'auto', legend: type === 'pie' ? 'right' : 'top',
        palette: 0, dataLabels: false, smooth: type === 'line', donut: false,
      });
    });
    this.selectChart(id);
    this.openPanel('chart', { id });
    this.toast(`${TYPE_LABEL[type]} chart created from ${rangeName(g)} — it updates live when the data changes`, 'success');
  },

  renderCharts() {
    const sh = this.sheet;
    const layer = this.chartsLayer;
    const existing = new Map([...layer.children].map((el) => [el.dataset.id, el]));
    for (const ch of sh.charts) {
      let el = existing.get(ch.id);
      existing.delete(ch.id);
      const isNew = !el;
      if (!el) {
        el = this.createChartCard(ch.id);
        layer.append(el);
      }
      if (el.classList.contains('dragging')) continue;
      Object.assign(el.style, { left: ch.x + 'px', top: ch.y + 'px', width: ch.w + 'px', height: ch.h + 'px' });
      el.classList.toggle('selected', this.selectedChart === ch.id);
      const data = chartData(sh, ch);
      const sig = JSON.stringify([ch.type, ch.title, ch.legend, ch.palette, ch.dataLabels, ch.smooth, ch.donut, ch.w, ch.h, data]);
      if (el._sig !== sig) {
        const animate = isNew ? !this._noChartAnim : el._type !== ch.type;
        el.querySelector('.chart-body').innerHTML = renderChart(ch, data, ch.w, ch.h, { animate });
        el._sig = sig;
        el._type = ch.type;
      }
      el._data = data;
      el.querySelectorAll('[data-act="type"]').forEach((b) => b.classList.toggle('active', b.dataset.type === ch.type));
    }
    for (const el of existing.values()) el.remove();
  },

  createChartCard(id) {
    const el = h('div', { class: 'chart-card', 'data-id': id });
    el.innerHTML = `<div class="chart-body"></div>
      <div class="chart-tools">
        <button type="button" data-act="type" data-type="bar" data-tip="Bar chart">${icon('chartBar', 15)}</button>
        <button type="button" data-act="type" data-type="line" data-tip="Line chart">${icon('chartLine', 15)}</button>
        <button type="button" data-act="type" data-type="pie" data-tip="Pie chart">${icon('chartPie', 15)}</button>
        <span class="sep"></span>
        <button type="button" data-act="edit" data-tip="Edit chart">${icon('pencil', 15)}</button>
        <button type="button" data-act="png" data-tip="Download PNG">${icon('image', 15)}</button>
        <button type="button" data-act="delete" data-tip="Delete chart">${icon('trash', 15)}</button>
      </div>
      <div class="chart-resize" data-tip="Drag to resize"></div>
      <div class="chart-tip"></div>`;
    el.addEventListener('mousedown', (e) => this.onChartMouseDown(e, id, el));
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      e.stopPropagation();
      const ch = this.chartById(id);
      if (!ch) return;
      if (act.dataset.act === 'type') { if (ch.type !== act.dataset.type) this.commit('Change chart type', () => { this.chartById(id).type = act.dataset.type; }); }
      else if (act.dataset.act === 'edit') this.openPanel('chart', { id });
      else if (act.dataset.act === 'png') this.downloadChartPng(id);
      else if (act.dataset.act === 'delete') this.deleteChart(id);
    });
    el.addEventListener('dblclick', (e) => { if (!e.target.closest('[data-act]')) this.openPanel('chart', { id }); });
    el.addEventListener('mousemove', (e) => this.onChartHover(e, el));
    el.addEventListener('mouseleave', () => el.querySelector('.chart-tip').classList.remove('show'));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.grid.scroller.scrollLeft += e.deltaX;
      this.grid.scroller.scrollTop += e.deltaY;
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.selectChart(id);
      this.openMenu({ x: e.clientX, y: e.clientY }, [
        { label: 'Edit chart…', icon: 'pencil', action: () => this.openPanel('chart', { id }), keepFocus: true },
        { label: 'Bar chart', icon: 'chartBar', action: () => this.commit('Change chart type', () => { this.chartById(id).type = 'bar'; }) },
        { label: 'Line chart', icon: 'chartLine', action: () => this.commit('Change chart type', () => { this.chartById(id).type = 'line'; }) },
        { label: 'Pie chart', icon: 'chartPie', action: () => this.commit('Change chart type', () => { this.chartById(id).type = 'pie'; }) },
        '-',
        { label: 'Select source data', icon: 'table', action: () => { const ch = this.chartById(id); if (ch && ch.areas[0]) { this.setSelection(ch.areas[0]); this.grid.scrollIntoView(ch.areas[0].r1, ch.areas[0].c1); } } },
        { label: 'Download PNG', icon: 'image', action: () => this.downloadChartPng(id) },
        { label: 'Delete chart', icon: 'trash', danger: true, action: () => this.deleteChart(id) },
      ], { cls: 'context-menu' });
    });
    return el;
  },

  onChartMouseDown(e, id, el) {
    if (e.button !== 0 || e.target.closest('[data-act]')) return;
    e.preventDefault();
    e.stopPropagation();
    this.commitEdit();
    this.closePopups();
    this.selectChart(id);
    const ch = this.chartById(id);
    if (!ch) return;
    const resize = !!e.target.closest('.chart-resize');
    const start = { x: e.clientX, y: e.clientY };
    const orig = { x: ch.x, y: ch.y, w: ch.w, h: ch.h };
    let moved = false;
    let next = { ...orig };
    let raf = 0;
    const mm = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      el.classList.add('dragging');
      if (resize) {
        next = { ...orig, w: Math.max(260, Math.round(orig.w + dx)), h: Math.max(180, Math.round(orig.h + dy)) };
        el.style.width = next.w + 'px';
        el.style.height = next.h + 'px';
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.querySelector('.chart-body').innerHTML = renderChart(ch, el._data, next.w, next.h);
          el._sig = null;
        });
      } else {
        next = { ...orig, x: Math.max(0, Math.round(orig.x + dx)), y: Math.max(0, Math.round(orig.y + dy)) };
        el.style.left = next.x + 'px';
        el.style.top = next.y + 'px';
      }
    };
    const mu = () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      el.classList.remove('dragging');
      if (moved) this.commit(resize ? 'Resize chart' : 'Move chart', () => Object.assign(this.chartById(id), next));
      this.focusGrid();
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    this.focusGrid();
  },

  onChartHover(e, el) {
    const tip = el.querySelector('.chart-tip');
    const data = el._data;
    const ch = this.chartById(el.dataset.id);
    if (!data || !ch || el.classList.contains('dragging')) { tip.classList.remove('show'); return; }
    const pal = (PALETTES[ch.palette || 0] || PALETTES[0]).colors;
    const dot = (i) => `<span class="dot" style="background:${pal[i % pal.length]}"></span>`;
    const mark = e.target.closest('.mark');
    let html = null;
    if (mark && mark.dataset.i !== undefined && mark.dataset.i !== '') {
      const i = +mark.dataset.i;
      const s = +mark.dataset.s || 0;
      if (ch.type === 'pie') {
        const ser = data.series[0];
        const total = ser.values.reduce((t, v) => t + (v > 0 ? v : 0), 0);
        const v = ser.values[i];
        html = `<b>${escHtml(data.categories[i])}</b><div>${dot(i)}${escHtml(formatValue(v, data.nf))} · ${((v / total) * 100).toFixed(1)}%</div>`;
      } else {
        const ser = data.series[s];
        html = `<b>${escHtml(data.categories[i])}</b><div>${dot(s)}${escHtml(ser.name)}: <b>${escHtml(formatValue(ser.values[i], data.nf))}</b></div>`;
      }
    } else if (e.target.classList && e.target.classList.contains('hover-band')) {
      const svg = e.target.ownerSVGElement.getBoundingClientRect();
      const band = +e.target.dataset.band;
      const x0 = +e.target.dataset.x0;
      const i = clamp(Math.floor((e.clientX - svg.left - x0) / band), 0, data.categories.length - 1);
      html = `<b>${escHtml(data.categories[i])}</b>` + data.series.map((s, k) => `<div>${dot(k)}${escHtml(s.name)}: <b>${escHtml(formatValue(s.values[i], data.nf))}</b></div>`).join('');
    }
    if (!html) { tip.classList.remove('show'); return; }
    tip.innerHTML = html;
    const r = el.getBoundingClientRect();
    let x = e.clientX - r.left + 14;
    let y = e.clientY - r.top + 14;
    if (x + tip.offsetWidth > r.width - 4) x = e.clientX - r.left - tip.offsetWidth - 12;
    if (y + tip.offsetHeight > r.height - 4) y = e.clientY - r.top - tip.offsetHeight - 12;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top = Math.max(4, y) + 'px';
    tip.classList.add('show');
  },

  selectChart(id) {
    if (this.selectedChart === id) return;
    this.selectedChart = id;
    for (const el of this.chartsLayer.children) el.classList.toggle('selected', el.dataset.id === id);
    if (id && this.panel && this.panel.kind === 'chart' && this.panel.id !== id) {
      this.panel.id = id;
      this.refreshPanel();
    }
  },

  deleteChart(id) {
    const sh = this.wb.sheets.find((s) => s.charts.some((c) => c.id === id));
    if (!sh) return;
    this.commit('Delete chart', () => { sh.charts = sh.charts.filter((c) => c.id !== id); });
    if (this.panel && this.panel.kind === 'chart' && this.panel.id === id) this.closePanel();
    this.toast('Chart deleted', 'quiet', { label: 'Undo', fn: () => this.undo() });
  },

  async downloadChartPng(id) {
    const el = [...this.chartsLayer.children].find((c) => c.dataset.id === id);
    const svg = el && el.querySelector('svg');
    const ch = this.chartById(id);
    if (!svg || !ch) { this.toast('Select a chart on this sheet first'); return; }
    try {
      const blob = await svgToPng(svg, 2);
      const name = `${(ch.title || 'chart').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'chart'}.png`;
      downloadBlob(blob, name);
      this.toast(`Downloaded ${name}`, 'success');
    } catch (err) {
      this.toast(`Could not export the chart: ${err.message}`, 'error');
    }
  },

  /* ---------- side panel ---------- */

  openPanel(kind, opts = {}) {
    this.commitEdit();
    this.panel = { kind, ...opts };
    this.side.hidden = false;
    this.side.className = `side-panel panel-${kind}`;
    this.refreshPanel(true);
  },

  closePanel() {
    if (!this.panel) return;
    this.panel = null;
    this.side.hidden = true;
    this.side.innerHTML = '';
    this.focusGrid();
  },

  panelShell(title, iconName, ...body) {
    this.side.innerHTML = '';
    this.side.append(
      h('div', { class: 'panel-head' }, iconEl(iconName, 18), h('h2', {}, title),
        h('button', { type: 'button', class: 'icon-btn', title: 'Close panel', onclick: () => this.closePanel() }, iconEl('x', 18))),
      h('div', { class: 'panel-body' }, ...body),
    );
  },

  refreshPanel(initial = false) {
    const p = this.panel;
    if (!p) return;
    if (!initial && this.side.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON' && p.kind !== 'form') return;
    if (p.kind === 'chart') this.renderChartEditor();
    else if (p.kind === 'form') this.renderRecordForm(initial);
    else if (p.kind === 'find') this.renderFind(initial);
  },

  /* ---------- chart editor ---------- */

  renderChartEditor() {
    const ch = this.chartById(this.panel.id);
    if (!ch) {
      this.panelShell('Chart editor', 'chartBar', h('p', { class: 'muted' }, 'Select a chart to edit it, or create one from the Chart menu.'));
      return;
    }
    const sh = this.wb.sheets.find((s) => s.charts.includes(ch));
    const update = (label, fn) => this.commit(label, () => fn(this.chartById(ch.id)));
    const seg = (options, value, onPick) => h('div', { class: 'seg' }, options.map(([v, label, ic]) => h('button', {
      type: 'button', class: 'seg-btn' + (value === v ? ' active' : ''), onclick: () => onPick(v),
    }, ic ? iconEl(ic, 15) : null, label)));
    const title = h('input', { class: 'field', value: ch.title || '', placeholder: 'Chart title' });
    title.addEventListener('change', () => update('Chart title', (c) => { c.title = title.value; }));
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') title.blur(); });
    const range = h('input', { class: 'field mono', value: areasName(ch.areas), spellcheck: 'false' });
    const applyRange = () => {
      const areas = parseAreas(range.value);
      if (!areas) { this.toast('Enter ranges like A1:C10 — separate several areas with commas', 'error'); range.value = areasName(ch.areas); return; }
      update('Chart data range', (c) => { c.areas = areas; });
    };
    range.addEventListener('change', applyRange);
    range.addEventListener('keydown', (e) => { if (e.key === 'Enter') range.blur(); });
    const useSel = h('button', { type: 'button', class: 'btn small', onclick: () => { const g = this.selRange(); update('Chart data range', (c) => { c.areas = [g]; }); } }, iconEl('table', 14), 'Use selection');
    const tri = (value) => (value === true ? 'yes' : value === false ? 'no' : 'auto');
    const fromTri = (v) => (v === 'yes' ? true : v === 'no' ? false : 'auto');
    const selectRow = (label, value, options, onPick) => {
      const s = h('select', { class: 'field' }, options.map(([v, l]) => h('option', { value: v, selected: value === v }, l)));
      s.addEventListener('change', () => onPick(s.value));
      return h('label', { class: 'row-field' }, h('span', {}, label), s);
    };
    const check = (label, value, onToggle, disabled) => {
      const cb = h('input', { type: 'checkbox', checked: !!value, disabled: !!disabled });
      cb.addEventListener('change', () => onToggle(cb.checked));
      return h('label', { class: 'check' + (disabled ? ' disabled' : '') }, cb, label);
    };
    const data = chartData(sh, ch);
    const info = data
      ? `${data.series.length} series × ${data.categories.length} categories · series in ${data.byRows ? 'rows' : 'columns'}${data.header ? ' · header row' : ''}${data.labels ? ' · label column' : ''}`
      : 'No numeric data found in this range';
    const palettes = h('div', { class: 'palettes' }, PALETTES.map((p, i) => h('button', {
      type: 'button', class: 'palette' + ((ch.palette || 0) === i ? ' active' : ''), title: p.name,
      onclick: () => update('Chart colors', (c) => { c.palette = i; }),
    }, p.colors.slice(0, 5).map((col) => h('span', { style: { background: col } })), h('small', {}, p.name))));
    this.panelShell('Chart editor', 'chartBar',
      h('div', { class: 'field-group' }, h('div', { class: 'lbl' }, 'Chart type'),
        seg([['bar', 'Bar', 'chartBar'], ['line', 'Line', 'chartLine'], ['pie', 'Pie', 'chartPie']], ch.type, (v) => update('Change chart type', (c) => { c.type = v; })),
      ),
      h('div', { class: 'field-group' }, h('div', { class: 'lbl' }, 'Title'), title),
      h('div', { class: 'field-group' }, h('div', { class: 'lbl' }, 'Data range', h('span', { class: 'lbl-note' }, sh.name)), range,
        h('div', { class: 'inline' }, useSel, h('span', { class: 'hint' }, 'Comma-separate several ranges'))),
      h('div', { class: 'detected' }, iconEl('sparkle', 14), h('span', {}, info)),
      h('div', { class: 'field-group' }, h('div', { class: 'lbl' }, 'Series in'),
        seg([['auto', 'Auto'], ['cols', 'Columns'], ['rows', 'Rows']], ch.seriesIn || 'auto', (v) => update('Chart series', (c) => { c.seriesIn = v; }))),
      h('div', { class: 'field-group grid2' },
        selectRow('Header row', tri(ch.header), [['auto', 'Auto-detect'], ['yes', 'Yes'], ['no', 'No']], (v) => update('Chart header', (c) => { c.header = fromTri(v); })),
        selectRow('Label column', tri(ch.labels), [['auto', 'Auto-detect'], ['yes', 'Yes'], ['no', 'No']], (v) => update('Chart labels', (c) => { c.labels = fromTri(v); })),
        selectRow('Legend', ch.legend || 'top', [['top', 'Top'], ['bottom', 'Bottom'], ['right', 'Right'], ['none', 'Hidden']], (v) => update('Chart legend', (c) => { c.legend = v; })),
      ),
      h('div', { class: 'field-group' }, h('div', { class: 'lbl' }, 'Options'),
        h('div', { class: 'checks' },
          check('Data labels', ch.dataLabels, (on) => update('Chart data labels', (c) => { c.dataLabels = on; }), ch.type === 'pie'),
          check('Smooth lines', ch.smooth, (on) => update('Chart smoothing', (c) => { c.smooth = on; }), ch.type !== 'line'),
          check('Donut', ch.donut, (on) => update('Chart donut', (c) => { c.donut = on; }), ch.type !== 'pie'))),
      h('div', { class: 'field-group' }, h('div', { class: 'lbl' }, 'Colors'), palettes),
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => this.downloadChartPng(ch.id) }, iconEl('image', 15), 'Download PNG'),
        h('button', { type: 'button', class: 'btn danger-ghost', onclick: () => this.deleteChart(ch.id) }, iconEl('trash', 15), 'Delete')),
    );
  },

  /* ---------- record form (CRUD) ---------- */

  formRegion() {
    const sh = this.sheet;
    const { ar, ac } = this.sel;
    const p = this.panel;
    if (sh.filter && inRange(sh.filter, ar, ac)) return { r1: sh.filter.r1, c1: sh.filter.c1, r2: sh.filter.r2, c2: sh.filter.c2 };
    if (p.region && p.sheetId === sh.id && inRange({ ...p.region, r2: p.region.r2 + 1 }, ar, ac)) return p.region;
    if (sh.filter) return { r1: sh.filter.r1, c1: sh.filter.c1, r2: sh.filter.r2, c2: sh.filter.c2 };
    return currentRegion(sh, ar, ac);
  },

  renderRecordForm(initial) {
    const sh = this.sheet;
    const p = this.panel;
    const reg = this.formRegion();
    p.region = reg;
    p.sheetId = sh.id;
    if (reg.r2 <= reg.r1 || reg.c2 < reg.c1) {
      this.panelShell('Record form', 'form', h('p', { class: 'muted' }, 'Select a cell inside a table (a header row with records below it) to view, add, edit or delete records.'));
      return;
    }
    const rows = [];
    for (let r = reg.r1 + 1; r <= reg.r2; r++) if (!sh.hidden.has(r)) rows.push(r);
    if (initial && p.add) p.mode = 'new';
    if (p.mode !== 'new') {
      const ar = this.sel.ar;
      p.row = rows.includes(ar) ? ar : rows.includes(p.row) ? p.row : rows[0];
    }
    const isNew = p.mode === 'new';
    const idx = rows.indexOf(p.row);
    const inputs = [];
    const fields = h('div', { class: 'form-fields' });
    for (let c = reg.c1; c <= reg.c2; c++) {
      const label = displayText(sh, reg.r1, c) || `Column ${colName(c)}`;
      const cell = isNew ? null : sh.get(p.row, c);
      const tmpl = sh.get(reg.r2, c);
      const isFormula = isNew ? tmpl && tmpl.f !== undefined : cell && cell.f !== undefined;
      if (isFormula) {
        fields.append(h('div', { class: 'form-row' }, h('label', {}, label),
          h('div', { class: 'form-calc', title: isNew ? `Will copy =${tmpl.f} from the row above` : `=${cell.f}` },
            h('span', { class: 'fx-badge' }, 'ƒx'), isNew ? h('span', { class: 'muted' }, 'calculated automatically') : displayText(sh, p.row, c))));
      } else {
        const input = h('input', { class: 'field', value: isNew ? '' : inputText(cell), placeholder: isNew ? label : '' });
        input.dataset.c = c;
        input.dataset.orig = input.value;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
        inputs.push(input);
        fields.append(h('div', { class: 'form-row' }, h('label', {}, label), input));
      }
    }
    const save = () => {
      if (isNew) {
        const values = [];
        for (const inp of inputs) values[+inp.dataset.c - reg.c1] = inp.value;
        if (!inputs.some((i) => i.value.trim())) { this.toast('Fill in at least one field'); return; }
        let at = 0;
        this.commit('Add record', () => { at = appendRecord(this.wb, sh, reg, values); });
        p.mode = null;
        p.region = { ...reg, r2: reg.r2 + 1 };
        p.row = at;
        this.selectCell(at, reg.c1);
        this.grid.scrollIntoView(at, reg.c1);
        this.toast(`Record added as row ${at + 1} — formulas, totals and charts extended automatically`, 'success');
      } else {
        const changed = inputs.filter((i) => i.value !== i.dataset.orig);
        if (!changed.length) { this.toast('No changes to save', 'quiet'); return; }
        this.commit('Update record', () => { for (const i of changed) writeInput(sh, p.row, +i.dataset.c, i.value); });
        this.toast(`Saved ${changed.length} field${changed.length > 1 ? 's' : ''} in row ${p.row + 1}`, 'success');
      }
      this.refreshPanel(true);
    };
    const del = async () => {
      if (!(await this.confirm('Delete this record?', `Row ${p.row + 1} will be removed and the rows below move up. Totals and charts update automatically.`, 'Delete record', true))) return;
      const r = p.row;
      this.commit('Delete record', () => structural(this.wb, sh, 'row', r, -1));
      p.region = { ...reg, r2: reg.r2 - 1 };
      this.selectCell(Math.min(r, p.region.r2), reg.c1);
      this.toast(`Deleted row ${r + 1}`, 'quiet', { label: 'Undo', fn: () => this.undo() });
      this.refreshPanel(true);
    };
    const go = (d) => {
      const ni = clamp(idx + d, 0, rows.length - 1);
      p.row = rows[ni];
      p.mode = null;
      this.selectCell(p.row, clamp(this.sel.ac, reg.c1, reg.c2));
      this.grid.scrollIntoView(p.row, reg.c1);
      this.refreshPanel(true);
    };
    const nav = h('div', { class: 'form-nav' },
      h('button', { type: 'button', class: 'icon-btn', disabled: isNew || idx <= 0, title: 'Previous record', onclick: () => go(-1) }, iconEl('chevLeft', 18)),
      h('span', { class: 'form-pos' }, isNew ? 'New record' : `Record ${idx + 1} of ${rows.length}`),
      h('button', { type: 'button', class: 'icon-btn', disabled: isNew || idx >= rows.length - 1, title: 'Next record', onclick: () => go(1) }, iconEl('chevRight', 18)),
      h('span', { class: 'grow' }),
      isNew
        ? h('button', { type: 'button', class: 'btn small', onclick: () => { p.mode = null; this.refreshPanel(true); } }, 'Cancel')
        : h('button', { type: 'button', class: 'btn small', onclick: () => { p.mode = 'new'; this.refreshPanel(true); } }, iconEl('plus', 14), 'New'));
    this.panelShell('Record form', 'form',
      h('div', { class: 'form-meta' }, iconEl('table', 14), h('span', {}, `${sh.name}!${rangeName(reg)}`), h('span', { class: 'pill' }, `${reg.r2 - reg.r1} records`)),
      nav,
      fields,
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: save }, iconEl(isNew ? 'plus' : 'save', 15), isNew ? 'Add record' : 'Save changes'),
        isNew ? null : h('button', { type: 'button', class: 'btn danger-ghost', onclick: del }, iconEl('trash', 15), 'Delete')),
      h('p', { class: 'hint block' }, isNew
        ? 'The new record is inserted at the end of the table. Calculated columns copy their formula, and ranges such as totals and chart data grow to include it.'
        : 'Create, read, update and delete rows as records. Edits here are regular spreadsheet edits — undo with Ctrl+Z.'),
    );
    if (isNew && inputs[0]) setTimeout(() => inputs[0].focus(), 30);
  },

  /* ---------- find & replace ---------- */

  renderFind(initial) {
    const p = this.panel;
    if (!initial && this.side.querySelector('.find-q')) { this.updateFindResults(); return; }
    p.opts = p.opts || { q: '', rep: '', matchCase: false, whole: false, formulas: false, all: false };
    const o = p.opts;
    const q = h('input', { class: 'field find-q', value: o.q, placeholder: 'Find…' });
    const rep = h('input', { class: 'field', value: o.rep, placeholder: 'Replace with…' });
    q.addEventListener('input', () => { o.q = q.value; this.updateFindResults(); });
    rep.addEventListener('input', () => { o.rep = rep.value; });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.findNext(); } });
    const check = (key, label) => {
      const cb = h('input', { type: 'checkbox', checked: o[key] });
      cb.addEventListener('change', () => { o[key] = cb.checked; this.updateFindResults(); });
      return h('label', { class: 'check' }, cb, label);
    };
    this.panelShell('Find and replace', 'search',
      h('div', { class: 'field-group' }, h('div', { class: 'lbl' }, 'Find'), q),
      h('div', { class: 'field-group' }, h('div', { class: 'lbl' }, 'Replace with'), rep),
      h('div', { class: 'checks two' }, check('matchCase', 'Match case'), check('whole', 'Entire cell'), check('formulas', 'Search formulas'), check('all', 'All sheets')),
      h('div', { class: 'panel-actions wrap' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => this.findNext() }, iconEl('search', 15), 'Find next'),
        h('button', { type: 'button', class: 'btn', onclick: () => this.replaceOne() }, 'Replace'),
        h('button', { type: 'button', class: 'btn', onclick: () => this.replaceAll() }, iconEl('replace', 15), 'Replace all')),
      h('div', { class: 'find-results' }),
    );
    this.updateFindResults();
    if (initial) setTimeout(() => { (p.replace ? rep : q).focus(); q.select(); }, 30);
  },

  findMatches() {
    const o = this.panel.opts;
    if (!o.q) return [];
    const needle = o.matchCase ? o.q : o.q.toLowerCase();
    const out = [];
    const sheets = o.all ? this.wb.sheets : [this.sheet];
    for (const sh of sheets) {
      const keys = [...sh.cells.keys()].sort((a, b) => a - b);
      for (const k of keys) {
        const cell = sh.cells.get(k);
        const r = Math.floor(k / 16384);
        const c = k % 16384;
        const text = o.formulas ? inputText(cell) : displayText(sh, r, c);
        if (!text) continue;
        const hay = o.matchCase ? text : text.toLowerCase();
        if (o.whole ? hay === needle : hay.includes(needle)) out.push({ sh, r, c, text });
      }
    }
    return out;
  },

  updateFindResults() {
    const box = this.side.querySelector('.find-results');
    if (!box) return;
    const list = this.findMatches();
    box.innerHTML = '';
    if (!this.panel.opts.q) { box.append(h('p', { class: 'muted' }, 'Type to search values' + (this.panel.opts.formulas ? ' and formulas' : '') + '.')); return; }
    box.append(h('div', { class: 'lbl' }, `${list.length} match${list.length === 1 ? '' : 'es'}`));
    for (const m of list.slice(0, 200)) {
      const item = h('button', { type: 'button', class: 'find-item' }, h('span', { class: 'mono ref' }, `${m.sh.name}!${cellName(m.r, m.c)}`), h('span', { class: 'txt' }, m.text));
      item.addEventListener('click', () => this.gotoMatch(m));
      box.append(item);
    }
  },

  gotoMatch(m) {
    const i = this.wb.sheets.indexOf(m.sh);
    if (i !== this.wb.active) this.setActiveSheet(i);
    this.selectCell(m.r, m.c);
    this.grid.scrollIntoView(m.r, m.c);
  },

  findNext() {
    const list = this.findMatches();
    if (!list.length) { this.toast('No matches found'); return; }
    const cur = this.wb.active * 1e12 + this.sel.ar * 16384 + this.sel.ac;
    const pos = (m) => this.wb.sheets.indexOf(m.sh) * 1e12 + m.r * 16384 + m.c;
    const next = list.find((m) => pos(m) > cur) || list[0];
    this.gotoMatch(next);
  },

  replaceText(text) {
    const o = this.panel.opts;
    if (o.whole) return o.rep;
    const re = new RegExp(o.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.matchCase ? 'g' : 'gi');
    return text.replace(re, () => o.rep);
  },

  replaceOne() {
    const o = this.panel.opts;
    if (!o.q) return;
    const list = this.findMatches();
    const hit = list.find((m) => m.sh === this.sheet && m.r === this.sel.ar && m.c === this.sel.ac);
    if (!hit) { this.findNext(); return; }
    const cell = hit.sh.get(hit.r, hit.c);
    if (cell.f !== undefined && !o.formulas) { this.toast('This cell holds a formula — tick "Search formulas" to replace inside formulas'); this.findNext(); return; }
    this.commit('Replace', () => writeInput(hit.sh, hit.r, hit.c, this.replaceText(inputText(cell))));
    this.findNext();
  },

  replaceAll() {
    const o = this.panel.opts;
    if (!o.q) return;
    const list = this.findMatches().filter((m) => o.formulas || m.sh.get(m.r, m.c).f === undefined);
    if (!list.length) { this.toast('Nothing to replace'); return; }
    this.commit('Replace all', () => { for (const m of list) writeInput(m.sh, m.r, m.c, this.replaceText(inputText(m.sh.get(m.r, m.c)))); });
    this.toast(`Replaced ${list.length} cell${list.length === 1 ? '' : 's'}`, 'success');
  },

  /* ---------- sort dialog ---------- */

  openSortDialog() {
    this.commitEdit();
    const t = this.sortTarget();
    const sh = this.sheet;
    if (t.g.r2 <= t.g.r1 && !t.header) { this.toast('Select a table to sort'); return; }
    let header = t.header;
    const region = header ? { ...t.g, r1: t.g.r1 - 1 } : t.g;
    const levels = [{ c: clamp(this.sel.ac, region.c1, region.c2), desc: false }];
    const body = h('div', { class: 'stack' });
    const colOptions = () => {
      const out = [];
      for (let c = region.c1; c <= region.c2; c++) {
        const label = header ? displayText(sh, region.r1, c) || `Column ${colName(c)}` : `Column ${colName(c)}`;
        out.push([c, label]);
      }
      return out;
    };
    const render = () => {
      body.innerHTML = '';
      body.append(h('div', { class: 'sort-meta' }, iconEl('table', 14), `Range ${rangeName(header ? { ...region, r1: region.r1 + 1 } : region)}`));
      const hdr = h('input', { type: 'checkbox', checked: header });
      hdr.addEventListener('change', () => { header = hdr.checked; render(); });
      body.append(h('label', { class: 'check' }, hdr, 'My data has a header row'));
      levels.forEach((lv, i) => {
        const sel = h('select', { class: 'field' }, colOptions().map(([c, l]) => h('option', { value: c, selected: c === lv.c }, l)));
        sel.addEventListener('change', () => { lv.c = +sel.value; });
        const ord = h('select', { class: 'field narrow' }, h('option', { value: 'asc', selected: !lv.desc }, 'A → Z (smallest first)'), h('option', { value: 'desc', selected: lv.desc }, 'Z → A (largest first)'));
        ord.addEventListener('change', () => { lv.desc = ord.value === 'desc'; });
        body.append(h('div', { class: 'sort-level' }, h('span', { class: 'sort-by' }, i ? 'then by' : 'Sort by'), sel, ord,
          levels.length > 1 ? h('button', { type: 'button', class: 'icon-btn', title: 'Remove level', onclick: () => { levels.splice(i, 1); render(); } }, iconEl('x', 16)) : h('span', { class: 'icon-spacer' })));
      });
      body.append(h('button', { type: 'button', class: 'btn small ghost add-level', disabled: levels.length >= 4, onclick: () => { levels.push({ c: region.c1, desc: false }); render(); } }, iconEl('plus', 14), 'Add level'));
    };
    render();
    this.openModal({
      title: 'Custom sort',
      body,
      width: 520,
      actions: [
        { label: 'Cancel', onClick: () => this.closeModal() },
        {
          label: 'Sort', primary: true, onClick: () => {
            const g = header ? { ...region, r1: region.r1 + 1 } : region;
            this.closeModal();
            let err = null;
            this.commit('Custom sort', () => {
              err = sortRange(this.wb, sh, g, levels.map((l) => ({ c: l.c, desc: l.desc })));
              return err ? false : undefined;
            });
            if (err) this.toast(err, 'error');
            else this.toast(`Sorted ${rangeName(g)} by ${levels.length} level${levels.length > 1 ? 's' : ''}`, 'success');
          },
        },
      ],
    });
  },

  /* ---------- function browser ---------- */

  openFunctionBrowser() {
    const editing = this.edit;
    const all = functionList();
    let cat = 'All';
    let chosen = all[0];
    const search = h('input', { class: 'field', placeholder: `Search ${all.length} functions…` });
    const cats = h('div', { class: 'chips' });
    const list = h('div', { class: 'fn-list' });
    const detail = h('div', { class: 'fn-detail' });
    const insert = (f) => {
      this.closeModal(true);
      if (this.edit) {
        const el = this.editorEl();
        const s = el.selectionStart;
        el.setRangeText(`${f.name}(`, s, el.selectionEnd, 'end');
        if (el === this.ed) this.fb.value = el.value; else this.ed.value = el.value;
        el.focus();
        this.onEditInput(this.edit.source);
      } else {
        this.startEdit('enter', `=${f.name}(`);
      }
    };
    const renderDetail = () => {
      detail.innerHTML = '';
      if (!chosen) return;
      detail.append(h('code', {}, `${chosen.name}(${chosen.sig})`), h('p', {}, chosen.desc),
        h('button', { type: 'button', class: 'btn primary small', onclick: () => insert(chosen) }, iconEl('fx', 14), editing ? 'Insert into formula' : `Insert into ${cellName(this.sel.ar, this.sel.ac)}`));
    };
    const renderList = () => {
      const q = search.value.trim().toUpperCase();
      list.innerHTML = '';
      const items = all.filter((f) => (cat === 'All' || f.cat === cat) && (!q || f.name.includes(q) || f.desc.toUpperCase().includes(q)));
      if (!items.includes(chosen)) chosen = items[0];
      for (const f of items) {
        const it = h('button', { type: 'button', class: 'fn-item' + (f === chosen ? ' active' : '') },
          h('span', { class: 'fn-name' }, f.name), h('span', { class: 'fn-cat' }, f.cat), h('span', { class: 'fn-desc' }, f.desc));
        it.addEventListener('click', () => { chosen = f; renderList(); });
        it.addEventListener('dblclick', () => insert(f));
        list.append(it);
      }
      if (!items.length) list.append(h('p', { class: 'muted pad' }, 'No functions match your search'));
      renderDetail();
    };
    const renderCats = () => {
      cats.innerHTML = '';
      for (const c of ['All', ...CATEGORIES]) {
        const n = c === 'All' ? all.length : all.filter((f) => f.cat === c).length;
        cats.append(h('button', { type: 'button', class: 'chip' + (c === cat ? ' active' : ''), onclick: () => { cat = c; renderCats(); renderList(); } }, c, h('small', {}, n)));
      }
    };
    search.addEventListener('input', renderList);
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter' && chosen) insert(chosen); });
    renderCats();
    renderList();
    this.openModal({ title: 'Insert function', body: h('div', { class: 'fn-browser' }, search, cats, list, detail), width: 640, cls: 'modal-fn' });
  },

  showShortcuts() {
    const groups = [
      ['Navigation', [['Arrow keys', 'Move'], ['Shift + Arrows', 'Extend selection'], ['Ctrl + Arrows', 'Jump to data edge'], ['Ctrl + Home / End', 'First / last cell'], ['Ctrl + A', 'Select table, then sheet'], ['Page Up / Down', 'Scroll a page']]],
      ['Editing', [['Type / F2 / Double-click', 'Edit cell'], ['Enter / Tab', 'Commit and move'], ['Ctrl + Enter', 'Fill selection with entry'], ['Alt + Enter', 'New line in cell'], ['Esc', 'Cancel edit'], ['F4', 'Toggle $ absolute reference'], ['Delete', 'Clear contents']]],
      ['Formulas', [['=', 'Start a formula (autocomplete)'], ['Click / drag cells', 'Insert references'], ['Alt + =', 'AutoSum'], ['Shift + F3', 'Insert function'], ['Ctrl + `', 'Show formulas']]],
      ['Data & format', [['Ctrl + C / X / V', 'Copy / cut / paste'], ['Ctrl + D / R', 'Fill down / right'], ['Drag fill handle', 'Smart series fill'], ['Ctrl + B / I / U', 'Bold / italic / underline'], ['Ctrl + Shift + L', 'Toggle filter'], ['Ctrl + Z / Y', 'Undo / redo'], ['Ctrl + S', 'Download .xlsx'], ['Ctrl + F', 'Find and replace']]],
    ];
    const body = h('div', { class: 'shortcuts' }, groups.map(([title, items]) => h('div', { class: 'sc-group' }, h('h4', {}, title),
      items.map(([k, d]) => h('div', { class: 'sc-row' }, h('span', { class: 'sc-keys' }, k.split(' / ').map((part, i) => [i ? ' / ' : '', ...part.split(' + ').map((x, j) => [j ? '+' : '', h('kbd', {}, x)])])), h('span', {}, d))))));
    this.openModal({ title: 'Keyboard shortcuts', body, width: 760 });
  },

  showAbout() {
    const feats = [
      ['CRUD', 'Edit cells, insert / delete rows & columns, and a record form for tables'],
      ['Merge', 'Merge & center, merge across, unmerge'],
      ['Formulas', `${Object.keys(FUNCS).length} functions — math, statistics, logic, text, lookup, dates`],
      ['Sort & filter', 'Multi-level sort, AutoFilter by values or conditions'],
      ['Charts', 'Live bar, line and pie charts with PNG export'],
      ['Excel', 'Native .xlsx import & export (plus CSV) — no server, no libraries'],
    ];
    this.openModal({
      title: 'About Cellwise',
      width: 520,
      body: h('div', { class: 'about' },
        h('p', {}, 'Cellwise is a smart spreadsheet that runs entirely in your browser. Everything — the formula engine, the canvas grid, the charts and the Excel file reader/writer — is implemented from scratch in plain JavaScript.'),
        h('div', { class: 'about-grid' }, feats.map(([k, v]) => h('div', { class: 'about-item' }, h('b', {}, k), h('span', {}, v)))),
        h('p', { class: 'muted' }, 'Your workbook is saved automatically in this browser (localStorage).')),
      actions: [{ label: 'Close', primary: true, onClick: () => this.closeModal() }],
    });
  },
};

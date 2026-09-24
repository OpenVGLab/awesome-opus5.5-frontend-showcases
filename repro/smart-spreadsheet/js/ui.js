// UI mixin: menus, popups, color picker, filter popup, context menus, modals, toasts, tabs.
import { h, iconEl, clamp, rangeName, colName, escHtml } from './util.js';
import { renameSheet, deleteSheet, duplicateSheet, filterColumnValues, displayText } from './model.js';
import { NUMBER_FORMATS, formatNumber } from './format.js';

const SWATCHES = [
  ['#000000', '#1F2937', '#374151', '#4B5563', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6', '#FFFFFF'],
  ['#FEE2E2', '#FFEDD5', '#FEF3C7', '#ECFCCB', '#DCFCE7', '#CCFBF1', '#E0F2FE', '#E0E7FF', '#EDE9FE', '#FCE7F3'],
  ['#FECACA', '#FED7AA', '#FDE68A', '#D9F99D', '#BBF7D0', '#99F6E4', '#BAE6FD', '#C7D2FE', '#DDD6FE', '#FBCFE8'],
  ['#F87171', '#FB923C', '#FBBF24', '#A3E635', '#4ADE80', '#2DD4BF', '#38BDF8', '#818CF8', '#A78BFA', '#F472B6'],
  ['#DC2626', '#EA580C', '#D97706', '#65A30D', '#16A34A', '#0D9488', '#0284C7', '#4F46E5', '#7C3AED', '#DB2777'],
  ['#991B1B', '#9A3412', '#92400E', '#3F6212', '#166534', '#115E59', '#075985', '#3730A3', '#5B21B6', '#9D174D'],
];

const COND_OPS = [
  ['none', 'None'], ['contains', 'Text contains'], ['notContains', 'Text does not contain'], ['begins', 'Text begins with'],
  ['ends', 'Text ends with'], ['eq', 'Is equal to'], ['neq', 'Is not equal to'], ['gt', 'Greater than'], ['gte', 'Greater than or equal to'],
  ['lt', 'Less than'], ['lte', 'Less than or equal to'], ['between', 'Is between'], ['top', 'Top N values'], ['bottom', 'Bottom N values'],
  ['aboveAvg', 'Above average'], ['belowAvg', 'Below average'], ['empty', 'Is empty'], ['notEmpty', 'Is not empty'],
];

export const UI = {
  /* ---------- generic popups ---------- */

  closePopups() {
    if (this.popups) this.popups.innerHTML = '';
    this.filterPopup = null;
    if (this.menubarOpen) this.menubarOpen.classList.remove('open');
    this.menubarOpen = null;
    document.querySelectorAll('.tb.open, .btn.open').forEach((b) => b.classList.remove('open'));
    if (this.tipEl) this.tipEl.hidden = true;
  },

  placePopup(pop, anchor, opts = {}) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x;
    let y;
    if (anchor instanceof Element) {
      const r = anchor.getBoundingClientRect();
      x = opts.alignRight ? r.right - pop.offsetWidth : r.left;
      y = r.bottom + 4;
      if (y + pop.offsetHeight > vh - 8 && r.top - pop.offsetHeight - 4 > 8) y = r.top - pop.offsetHeight - 4;
    } else {
      x = anchor.x;
      y = anchor.y;
      if (y + pop.offsetHeight > vh - 8) y = Math.max(8, y - pop.offsetHeight);
    }
    pop.style.left = clamp(x, 8, Math.max(8, vw - pop.offsetWidth - 8)) + 'px';
    pop.style.top = clamp(y, 8, Math.max(8, vh - pop.offsetHeight - 8)) + 'px';
  },

  openMenu(anchor, items, opts = {}) {
    if (!opts.keep) this.closePopups();
    const menu = h('div', { class: 'menu' + (opts.cls ? ' ' + opts.cls : ''), role: 'menu' });
    for (const it of items) {
      if (!it) continue;
      if (it === '-') { menu.append(h('div', { class: 'menu-sep' })); continue; }
      if (it.header) { menu.append(h('div', { class: 'menu-header' }, it.header)); continue; }
      const lead = it.icon ? iconEl(it.icon, 16) : it.checked ? iconEl('check', 15) : h('span', {});
      const row = h('button', { type: 'button', class: 'menu-item' + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : '') + (it.danger ? ' danger' : '') },
        h('span', { class: 'mi-lead' }, lead),
        h('span', { class: 'mi-label' }, it.label, it.hint ? h('small', {}, it.hint) : null),
        it.preview ? h('span', { class: 'mi-preview' }, it.preview) : null,
        it.kbd ? h('span', { class: 'mi-kbd' }, it.kbd) : null);
      row.addEventListener('mousedown', (e) => e.preventDefault());
      row.addEventListener('click', () => {
        if (it.disabled) return;
        this.closePopups();
        it.action();
        if (!it.keepFocus) setTimeout(() => { if (!document.querySelector('.modal-backdrop') && !(document.activeElement && document.activeElement.closest('#sidePanel, .formula-bar'))) this.focusGrid(); }, 0);
      });
      menu.append(row);
    }
    this.popups.append(menu);
    this.placePopup(menu, anchor, opts);
    if (anchor instanceof Element && anchor.classList) anchor.classList.add('open');
    return menu;
  },

  toggleMenubar(btn) {
    if (this.menubarOpen === btn) { this.closePopups(); return; }
    this.commitEdit();
    this.openMenu(btn, this.menuItems(btn.dataset.menu), { cls: 'menubar-menu' });
    this.menubarOpen = btn;
    btn.classList.add('open');
  },

  toggleToolbarMenu(el, build) {
    if (el && el.classList.contains('open')) { this.closePopups(); return null; }
    return build();
  },

  menuItems(name) {
    const sh = this.sheet;
    const hasFilter = !!sh.filter;
    const chartOpen = this.selectedChart;
    switch (name) {
      case 'file':
        return [
          { label: 'New blank workbook', icon: 'fileNew', action: () => this.newWorkbook() },
          { label: 'Open .xlsx / .csv file…', icon: 'upload', kbd: 'Ctrl+O', action: () => this.$('#fileInput').click() },
          '-',
          { header: 'Demo data' },
          { label: 'Open sample file: inventory.xlsx', icon: 'fileSheet', hint: 'A real Excel file, parsed by the importer', action: () => this.loadSampleFile() },
          { label: 'Reset to the sales demo workbook', icon: 'refresh', action: () => this.resetDemo() },
          '-',
          { label: 'Download as Excel (.xlsx)', icon: 'download', kbd: 'Ctrl+S', action: () => this.exportXlsx() },
          { label: 'Download current sheet as CSV', icon: 'fileText', action: () => this.exportCsv() },
          { label: 'Download selected chart as PNG', icon: 'image', disabled: !chartOpen, action: () => this.downloadChartPng(this.selectedChart) },
        ];
      case 'edit':
        return [
          { label: 'Undo', icon: 'undo', kbd: 'Ctrl+Z', disabled: !this.undoStack.length, action: () => this.undo() },
          { label: 'Redo', icon: 'redo', kbd: 'Ctrl+Y', disabled: !this.redoStack.length, action: () => this.redo() },
          '-',
          { label: 'Cut', icon: 'cut', kbd: 'Ctrl+X', action: () => this.menuCopy(true) },
          { label: 'Copy', icon: 'copy', kbd: 'Ctrl+C', action: () => this.menuCopy(false) },
          { label: 'Paste', icon: 'paste', kbd: 'Ctrl+V', action: () => this.menuPaste(false) },
          { label: 'Paste values only', action: () => this.menuPaste(true) },
          '-',
          { label: 'Fill down', kbd: 'Ctrl+D', action: () => this.fillDirection('down') },
          { label: 'Fill right', kbd: 'Ctrl+R', action: () => this.fillDirection('right') },
          '-',
          { label: 'Clear contents', icon: 'eraser', kbd: 'Del', action: () => this.clearSelection('contents') },
          { label: 'Clear formatting', action: () => this.clearSelection('formats') },
          { label: 'Clear all', action: () => this.clearSelection('all') },
          '-',
          { label: 'Find and replace…', icon: 'search', kbd: 'Ctrl+F', action: () => this.openPanel('find'), keepFocus: true },
        ];
      case 'insert':
        return [
          { label: 'Row above', icon: 'rowInsert', action: () => this.insertRows('above') },
          { label: 'Row below', action: () => this.insertRows('below') },
          { label: 'Column left', icon: 'colInsert', action: () => this.insertCols('left') },
          { label: 'Column right', action: () => this.insertCols('right') },
          '-',
          { label: 'Bar chart', icon: 'chartBar', action: () => this.insertChart('bar') },
          { label: 'Line chart', icon: 'chartLine', action: () => this.insertChart('line') },
          { label: 'Pie chart', icon: 'chartPie', action: () => this.insertChart('pie') },
          '-',
          { label: 'Function…', icon: 'fx', kbd: 'Shift+F3', action: () => this.openFunctionBrowser() },
          { label: 'AutoSum', icon: 'sigma', kbd: 'Alt+=', action: () => this.autoSum('SUM') },
          { label: "Today's date", icon: 'calendar', kbd: 'Ctrl+;', action: () => this.insertNow(false) },
          '-',
          { label: 'New sheet', icon: 'plus', kbd: 'Shift+F11', action: () => this.addSheet() },
        ];
      case 'format': {
        const cell = this.activeCell();
        const s = (cell && cell.s) || {};
        return [
          { label: 'Bold', icon: 'bold', kbd: 'Ctrl+B', checked: s.b, action: () => this.run('bold') },
          { label: 'Italic', icon: 'italic', kbd: 'Ctrl+I', action: () => this.run('italic') },
          { label: 'Underline', icon: 'underline', kbd: 'Ctrl+U', action: () => this.run('underline') },
          { label: 'Strikethrough', icon: 'strike', kbd: 'Ctrl+5', action: () => this.run('strike') },
          '-',
          { label: 'Number format…', icon: 'hash', action: () => this.openNumFmtMenu(this.$('#nfBtn')), keepFocus: true },
          { label: 'Wrap text', icon: 'wrap', checked: s.wrap, action: () => this.run('wrap') },
          { label: 'Align top', checked: s.va === 'top', action: () => this.setStyle({ va: s.va === 'top' ? undefined : 'top' }, 'Vertical align') },
          { label: 'Align middle', checked: !s.va || s.va === 'middle', action: () => this.setStyle({ va: undefined }, 'Vertical align') },
          { label: 'Align bottom', checked: s.va === 'bottom', action: () => this.setStyle({ va: s.va === 'bottom' ? undefined : 'bottom' }, 'Vertical align') },
          '-',
          { label: 'Merge & center', icon: 'merge', action: () => this.mergeCmd('center') },
          { label: 'Merge all', action: () => this.mergeCmd('all') },
          { label: 'Merge across rows', action: () => this.mergeCmd('rows') },
          { label: 'Unmerge', icon: 'unmerge', action: () => this.mergeCmd('unmerge') },
          '-',
          { label: 'Autofit column width', action: () => { const g = this.selRange(); for (let c = g.c1; c <= Math.min(g.c2, g.c1 + 30); c++) this.autofitCol(c); } },
          { label: 'Clear formatting', icon: 'eraser', action: () => this.clearSelection('formats') },
        ];
      }
      case 'data':
        return [
          { label: 'Sort A → Z', icon: 'sortAsc', action: () => this.quickSort(false) },
          { label: 'Sort Z → A', icon: 'sortDesc', action: () => this.quickSort(true) },
          { label: 'Custom sort…', icon: 'sortCustom', action: () => this.openSortDialog() },
          '-',
          { label: hasFilter ? 'Remove filter' : 'Create filter', icon: 'filter', kbd: 'Ctrl+Shift+L', action: () => this.toggleFilter() },
          { label: 'Clear all filter criteria', icon: 'filterX', disabled: !hasFilter, action: () => this.clearFilters() },
          { label: 'Filter by selected value', action: () => this.filterByValue() },
          '-',
          { label: 'Record form (add / edit / delete)…', icon: 'form', action: () => this.openPanel('form'), keepFocus: true },
          '-',
          { label: 'Delete selected rows', icon: 'rowDelete', action: () => this.deleteRows() },
          { label: 'Delete selected columns', icon: 'colDelete', action: () => this.deleteCols() },
        ];
      case 'view': {
        const fr = sh.freeze;
        return [
          { header: 'Freeze panes' },
          { label: 'No frozen panes', checked: !fr.r && !fr.c, action: () => this.setFreeze(0, 0) },
          { label: 'Freeze top row', checked: fr.r === 1 && !fr.c, action: () => this.setFreeze(1, 0) },
          { label: 'Freeze first column', checked: fr.c === 1 && !fr.r, action: () => this.setFreeze(0, 1) },
          { label: `Freeze up to row ${this.sel.ar} / column ${colName(Math.max(0, this.sel.ac - 1))}`, icon: 'freeze', disabled: !this.sel.ar && !this.sel.ac, action: () => this.setFreeze(this.sel.ar, this.sel.ac) },
          '-',
          { label: 'Gridlines', icon: 'grid', checked: sh.showGrid, action: () => this.toggleGridlines() },
          { label: 'Show formulas', icon: 'eye', kbd: 'Ctrl+`', checked: this.showFormulas, action: () => this.toggleFormulas() },
        ];
      }
      case 'help':
        return [
          { label: 'Keyboard shortcuts', icon: 'keyboard', action: () => this.showShortcuts() },
          { label: 'Function reference', icon: 'fx', action: () => this.openFunctionBrowser() },
          '-',
          { label: 'About Cellwise', icon: 'info', action: () => this.showAbout() },
        ];
      default:
        return [];
    }
  },

  async newWorkbook() {
    if (!(await this.confirm('Start a new workbook?', 'The current workbook will be replaced. You can still undo this with Ctrl+Z.', 'New workbook'))) return;
    const { Workbook } = await import('./model.js');
    const wb2 = new Workbook('Untitled workbook');
    wb2.addSheet('Sheet1');
    this.replaceWorkbook(wb2, 'New workbook');
  },

  resetDemo() {
    const wb2 = this.sampleWorkbook();
    this.replaceWorkbook(wb2, 'Load demo workbook');
    this.setSelection({ r1: 4, c1: 6, r2: 4, c2: 6 });
  },

  openExportMenu(el) {
    this.toggleToolbarMenu(el, () => this.openMenu(el, [
      { label: 'Excel workbook (.xlsx)', icon: 'fileSheet', hint: 'All sheets with formulas, styles, merges & filters', kbd: 'Ctrl+S', action: () => this.exportXlsx() },
      { label: 'CSV (current sheet)', icon: 'fileText', hint: 'Plain comma-separated values', action: () => this.exportCsv() },
      { label: 'Selected chart as PNG', icon: 'image', disabled: !this.selectedChart, hint: this.selectedChart ? null : 'Click a chart first', action: () => this.downloadChartPng(this.selectedChart) },
    ], { alignRight: true }));
  },

  openNumFmtMenu(el) {
    const cell = this.activeCell();
    const cur = (cell && cell.s && cell.s.nf) || 'General';
    const v = cell && typeof cell.cv === 'number' ? cell.cv : cell && typeof cell.v === 'number' ? cell.v : null;
    this.toggleToolbarMenu(el, () => this.openMenu(el, [
      { header: 'Number format' },
      ...NUMBER_FORMATS.map((f) => ({
        label: f.label, checked: cur === f.code, preview: formatNumber(v !== null && f.id !== 'text' ? v : f.sample, f.code).text,
        action: () => this.setNumFmt(f.code, `${f.label} format`),
      })),
      '-',
      { label: 'Custom format code…', icon: 'hash', action: () => this.customFormatDialog(cur) },
    ], { cls: 'menu-wide' }));
  },

  customFormatDialog(cur) {
    const input = h('input', { class: 'field mono', value: cur === 'General' ? '#,##0.00' : cur, spellcheck: 'false' });
    const preview = h('div', { class: 'fmt-preview' });
    const cell = this.activeCell();
    const sample = cell && typeof cell.cv === 'number' ? cell.cv : cell && typeof cell.v === 'number' ? cell.v : 1234.567;
    const upd = () => {
      const r = formatNumber(sample, input.value || 'General');
      preview.innerHTML = `Preview: <b style="color:${r.color || 'inherit'}">${escHtml(r.text)}</b>`;
    };
    input.addEventListener('input', upd);
    upd();
    const apply = () => { this.closeModal(); this.setNumFmt(input.value.trim() || 'General', 'Custom number format'); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    const examples = ['#,##0.00', '$#,##0;[Red]-$#,##0', '0.0%', '[Green]"▲ "0.0%;[Red]"▼ "0.0%', '#,##0,"K"', 'yyyy-mm-dd', 'mmm d, yyyy', 'h:mm AM/PM', '0.00E+00', '"Qty: "0'];
    const chips = h('div', { class: 'chips' }, examples.map((ex) => h('button', { type: 'button', class: 'chip mono', onclick: () => { input.value = ex; upd(); input.focus(); } }, ex)));
    this.openModal({
      title: 'Custom number format',
      body: h('div', { class: 'stack' }, h('label', { class: 'lbl' }, 'Excel-style format code'), input, preview, h('label', { class: 'lbl' }, 'Examples'), chips),
      actions: [{ label: 'Cancel', onClick: () => this.closeModal() }, { label: 'Apply', primary: true, onClick: apply }],
      width: 480,
    });
  },

  openFontSizeMenu(el) {
    const cell = this.activeCell();
    const cur = (cell && cell.s && cell.s.fs) || 10;
    this.toggleToolbarMenu(el, () => this.openMenu(el, [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28].map((pt) => ({
      label: String(pt), checked: pt === cur, action: () => this.setStyle({ fs: pt === 10 ? undefined : pt }, 'Font size'),
    })), { cls: 'menu-narrow' }));
  },

  openBordersMenu(el) {
    this.toggleToolbarMenu(el, () => this.openMenu(el, [
      { label: 'All borders', icon: 'borders', action: () => this.applyBorders('all') },
      { label: 'Outside border', action: () => this.applyBorders('outer') },
      { label: 'Top border', action: () => this.applyBorders('top') },
      { label: 'Bottom border', action: () => this.applyBorders('bottom') },
      { label: 'Thick bottom border', action: () => this.applyBorders('thickBottom') },
      '-',
      { label: 'No borders', icon: 'x', action: () => this.applyBorders('none') },
    ]));
  },

  openMergeMenu(el) {
    this.toggleToolbarMenu(el, () => this.openMenu(el, [
      { label: 'Merge & center', icon: 'merge', action: () => this.mergeCmd('center') },
      { label: 'Merge all', action: () => this.mergeCmd('all') },
      { label: 'Merge across rows', hint: 'One merged cell per row', action: () => this.mergeCmd('rows') },
      '-',
      { label: 'Unmerge cells', icon: 'unmerge', action: () => this.mergeCmd('unmerge') },
    ]));
  },

  openInsertMenu(el) {
    this.toggleToolbarMenu(el, () => this.openMenu(el, [
      { label: 'Insert row above', icon: 'rowInsert', action: () => this.insertRows('above') },
      { label: 'Insert row below', action: () => this.insertRows('below') },
      '-',
      { label: 'Insert column left', icon: 'colInsert', action: () => this.insertCols('left') },
      { label: 'Insert column right', action: () => this.insertCols('right') },
      '-',
      { label: 'Add record via form…', icon: 'form', action: () => this.openPanel('form', { add: true }), keepFocus: true },
    ]));
  },

  openDeleteMenu(el) {
    const g = this.selRange();
    const nr = g.r2 - g.r1 + 1;
    const nc = g.c2 - g.c1 + 1;
    this.toggleToolbarMenu(el, () => this.openMenu(el, [
      { label: nr > 1 ? `Delete rows ${g.r1 + 1}–${g.r2 + 1}` : `Delete row ${g.r1 + 1}`, icon: 'rowDelete', danger: true, action: () => this.deleteRows() },
      { label: nc > 1 ? `Delete columns ${colName(g.c1)}–${colName(g.c2)}` : `Delete column ${colName(g.c1)}`, icon: 'colDelete', danger: true, action: () => this.deleteCols() },
      '-',
      { label: 'Clear contents', icon: 'eraser', kbd: 'Del', action: () => this.clearSelection('contents') },
    ]));
  },

  openChartMenu(el) {
    this.toggleToolbarMenu(el, () => this.openMenu(el, [
      { header: `Chart from ${rangeName(this.chartSourceRange())}` },
      { label: 'Bar chart', icon: 'chartBar', hint: 'Compare values across categories', action: () => this.insertChart('bar') },
      { label: 'Line chart', icon: 'chartLine', hint: 'Show a trend over time', action: () => this.insertChart('line') },
      { label: 'Pie chart', icon: 'chartPie', hint: 'Show parts of a whole', action: () => this.insertChart('pie') },
    ], { cls: 'menu-wide' }));
  },

  openAutosumMenu(el) {
    this.toggleToolbarMenu(el, () => this.openMenu(el, [
      { label: 'Sum', icon: 'sigma', kbd: 'Alt+=', action: () => this.autoSum('SUM') },
      { label: 'Average', action: () => this.autoSum('AVERAGE') },
      { label: 'Count numbers', action: () => this.autoSum('COUNT') },
      { label: 'Max', action: () => this.autoSum('MAX') },
      { label: 'Min', action: () => this.autoSum('MIN') },
      { label: 'Median', action: () => this.autoSum('MEDIAN') },
      { label: 'Standard deviation', action: () => this.autoSum('STDEV') },
      '-',
      { label: 'All functions…', icon: 'fx', action: () => this.openFunctionBrowser() },
    ]));
  },

  openColorMenu(el, key) {
    if (el && el.classList.contains('open')) { this.closePopups(); return; }
    this.closePopups();
    const pop = h('div', { class: 'color-pop' });
    const apply = (color) => {
      this.closePopups();
      if (color) this.colors[key] = color;
      this.setStyle({ [key]: color || undefined }, key === 'fc' ? 'Text color' : 'Fill color');
    };
    pop.append(h('div', { class: 'cp-head' }, h('span', {}, key === 'fc' ? 'Text color' : 'Fill color'),
      h('button', { type: 'button', class: 'cp-reset', onclick: () => apply(null) }, key === 'fc' ? 'Automatic' : 'No fill')));
    const grid = h('div', { class: 'cp-grid' });
    SWATCHES.forEach((row) => row.forEach((c) => {
      const b = h('button', { type: 'button', class: 'cp-swatch' + (c === this.colors[key] ? ' current' : ''), title: c, style: { background: c } });
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => apply(c));
      grid.append(b);
    }));
    const custom = h('input', { type: 'color', value: this.colors[key] });
    custom.addEventListener('change', () => apply(custom.value.toUpperCase()));
    pop.append(grid, h('label', { class: 'cp-custom' }, custom, 'Custom color…'));
    this.popups.append(pop);
    this.placePopup(pop, el);
    el.classList.add('open');
  },

  /* ---------- context menu ---------- */

  openContextMenu(x, y, hit) {
    this.commitEdit();
    const sh = this.sheet;
    if (hit.type === 'cell' && !this.isInSelection(hit.r, hit.c)) this.selectCell(hit.r, hit.c);
    if (hit.type === 'colHeader' && !(this.sel.c1 <= hit.c && hit.c <= this.sel.c2 && this.sel.r1 === 0 && this.sel.r2 >= sh.rows - 1)) this.selectCols(hit.c);
    if (hit.type === 'rowHeader' && !(this.sel.r1 <= hit.r && hit.r <= this.sel.r2 && this.sel.c1 === 0 && this.sel.c2 >= sh.cols - 1)) this.selectRows(hit.r);
    const g = this.selRange();
    const merged = sh.merges.some((m) => m.r1 <= g.r2 && g.r1 <= m.r2 && m.c1 <= g.c2 && g.c1 <= m.c2);
    let items;
    if (hit.type === 'colHeader') {
      items = [
        { label: 'Insert column left', icon: 'colInsert', action: () => this.insertCols('left') },
        { label: 'Insert column right', action: () => this.insertCols('right') },
        { label: g.c1 === g.c2 ? 'Delete column' : 'Delete columns', icon: 'colDelete', danger: true, action: () => this.deleteCols() },
        '-',
        { label: 'Autofit width', action: () => { for (let c = g.c1; c <= g.c2; c++) this.autofitCol(c); } },
        { label: 'Reset width', action: () => this.resizeTo('col', g.c1, null) },
        '-',
        { label: 'Sort A → Z by this column', icon: 'sortAsc', action: () => this.quickSort(false) },
        { label: 'Sort Z → A by this column', icon: 'sortDesc', action: () => this.quickSort(true) },
        { label: `Freeze up to column ${colName(g.c2)}`, icon: 'freeze', action: () => this.setFreeze(sh.freeze.r, g.c2 + 1) },
      ];
    } else if (hit.type === 'rowHeader') {
      items = [
        { label: 'Insert row above', icon: 'rowInsert', action: () => this.insertRows('above') },
        { label: 'Insert row below', action: () => this.insertRows('below') },
        { label: g.r1 === g.r2 ? 'Delete row' : 'Delete rows', icon: 'rowDelete', danger: true, action: () => this.deleteRows() },
        '-',
        { label: 'Reset height', action: () => this.resizeTo('row', g.r1, null) },
        { label: `Freeze up to row ${g.r2 + 1}`, icon: 'freeze', action: () => this.setFreeze(g.r2 + 1, sh.freeze.c) },
      ];
    } else {
      items = [
        { label: 'Cut', icon: 'cut', kbd: 'Ctrl+X', action: () => this.menuCopy(true) },
        { label: 'Copy', icon: 'copy', kbd: 'Ctrl+C', action: () => this.menuCopy(false) },
        { label: 'Paste', icon: 'paste', kbd: 'Ctrl+V', disabled: !this.clip, action: () => this.menuPaste(false) },
        { label: 'Paste values only', disabled: !this.clip, action: () => this.menuPaste(true) },
        '-',
        { label: 'Insert row above', icon: 'rowInsert', action: () => this.insertRows('above') },
        { label: 'Insert column left', icon: 'colInsert', action: () => this.insertCols('left') },
        { label: 'Delete row', icon: 'rowDelete', action: () => this.deleteRows() },
        { label: 'Delete column', icon: 'colDelete', action: () => this.deleteCols() },
        '-',
        { label: 'Clear contents', icon: 'eraser', kbd: 'Del', action: () => this.clearSelection('contents') },
        { label: merged ? 'Unmerge cells' : 'Merge cells', icon: merged ? 'unmerge' : 'merge', action: () => (merged ? this.mergeCmd('unmerge') : this.mergeCmd('center')) },
        '-',
        { label: 'Sort A → Z', icon: 'sortAsc', action: () => this.quickSort(false) },
        { label: 'Sort Z → A', icon: 'sortDesc', action: () => this.quickSort(true) },
        { label: 'Filter by this value', icon: 'filter', action: () => this.filterByValue() },
        '-',
        { label: 'Insert chart from selection', icon: 'chartBar', action: () => this.insertChart('bar') },
        { label: 'Edit as record (form)…', icon: 'form', action: () => this.openPanel('form'), keepFocus: true },
      ];
    }
    this.openMenu({ x, y }, items, { cls: 'context-menu' });
  },

  isInSelection(r, c) {
    const g = this.selRange();
    return r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
  },

  /* ---------- filter popup ---------- */

  openFilterMenu(c) {
    const sh = this.sheet;
    const f = sh.filter;
    if (!f) return;
    this.closePopups();
    const cr = (f.crit && f.crit[c]) || {};
    const values = filterColumnValues(sh, c);
    const checked = new Set(cr.values || values.map((v) => v.text));
    const title = displayText(sh, f.r1, c) || `Column ${colName(c)}`;
    const pop = h('div', { class: 'filter-pop' });
    pop.addEventListener('mousedown', (e) => e.stopPropagation());
    const sortBtn = (desc) => h('button', { type: 'button', class: 'fp-sort', onclick: () => { this.closePopups(); this.sortFromFilter(c, desc); this.focusGrid(); } },
      iconEl(desc ? 'sortDesc' : 'sortAsc', 16), desc ? 'Sort Z → A' : 'Sort A → Z');
    const opSel = h('select', { class: 'field' }, COND_OPS.map(([v, l]) => h('option', { value: v, selected: (cr.cond ? cr.cond.op : 'none') === v }, l)));
    const a = h('input', { class: 'field', placeholder: 'Value', value: cr.cond ? cr.cond.a ?? '' : '' });
    const b = h('input', { class: 'field', placeholder: 'and', value: cr.cond ? cr.cond.b ?? '' : '' });
    const condInputs = h('div', { class: 'fp-cond-inputs' }, a, b);
    const syncCond = () => {
      const op = opSel.value;
      const needsA = !['none', 'aboveAvg', 'belowAvg', 'empty', 'notEmpty'].includes(op);
      condInputs.style.display = needsA ? '' : 'none';
      b.style.display = op === 'between' ? '' : 'none';
      a.placeholder = op === 'top' || op === 'bottom' ? 'N (e.g. 3)' : 'Value';
    };
    opSel.addEventListener('change', syncCond);
    syncCond();
    const search = h('input', { class: 'field fp-search', placeholder: 'Search values…' });
    const list = h('div', { class: 'fp-list' });
    const renderList = () => {
      list.innerHTML = '';
      const q = search.value.trim().toLowerCase();
      for (const v of values) {
        if (q && !v.text.toLowerCase().includes(q)) continue;
        const cb = h('input', { type: 'checkbox', checked: checked.has(v.text) });
        cb.addEventListener('change', () => { if (cb.checked) checked.add(v.text); else checked.delete(v.text); });
        list.append(h('label', { class: 'fp-item' }, cb, h('span', { class: 'fp-text' + (v.text ? '' : ' blank') }, v.text || '(Blanks)'), h('span', { class: 'fp-count' }, v.n)));
      }
      if (!list.children.length) list.append(h('div', { class: 'fp-empty' }, 'No matching values'));
    };
    search.addEventListener('input', renderList);
    renderList();
    const setAll = (on) => {
      const q = search.value.trim().toLowerCase();
      for (const v of values) if (!q || v.text.toLowerCase().includes(q)) { if (on) checked.add(v.text); else checked.delete(v.text); }
      renderList();
    };
    const apply = () => {
      const op = opSel.value;
      const cond = op === 'none' ? null : { op, a: a.value.trim(), b: b.value.trim() };
      const all = values.every((v) => checked.has(v.text));
      this.closePopups();
      this.setFilterCriteria(c, { values: all ? null : [...checked], cond }, `Filter ${title}`);
      this.focusGrid();
    };
    pop.append(
      h('div', { class: 'fp-title' }, iconEl('filter', 14), h('span', {}, title)),
      h('div', { class: 'fp-sorts' }, sortBtn(false), sortBtn(true)),
      h('div', { class: 'fp-section' }, h('div', { class: 'fp-label' }, 'Filter by condition'), opSel, condInputs),
      h('div', { class: 'fp-section' }, h('div', { class: 'fp-label' }, 'Filter by values',
        h('span', { class: 'fp-links' }, h('button', { type: 'button', onclick: () => setAll(true) }, 'Select all'), '·', h('button', { type: 'button', onclick: () => setAll(false) }, 'Clear'))),
      search, list),
      h('div', { class: 'fp-foot' },
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { this.closePopups(); this.setFilterCriteria(c, null, 'Clear column filter'); this.focusGrid(); } }, 'Clear filter'),
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn small', onclick: () => { this.closePopups(); this.focusGrid(); } }, 'Cancel'),
        h('button', { type: 'button', class: 'btn primary small', onclick: apply }, 'OK')),
    );
    for (const inp of [a, b, search]) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    this.popups.append(pop);
    const rect = this.$('#gridWrap').getBoundingClientRect();
    const g = this.grid;
    const bx = rect.left + g.colLeft(c) + g.colW(c) - 21;
    const by = rect.top + g.rowTop(f.r1) + g.rowH(f.r1);
    this.placePopup(pop, { x: bx - 8, y: by + 2 });
    this.filterPopup = pop;
  },

  /* ---------- modals ---------- */

  openModal({ title, body, actions, width = 480, onClose, cls }) {
    this.closeModal(true);
    this.closePopups();
    const back = h('div', { class: 'modal-backdrop' });
    const foot = actions ? h('div', { class: 'modal-foot' }, actions.map((a) => h('button', {
      type: 'button', class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : '') + (a.left ? ' left' : ''), onclick: a.onClick,
    }, a.label))) : null;
    const box = h('div', { class: 'modal' + (cls ? ' ' + cls : ''), style: { width: `min(${width}px, calc(100vw - 32px))` }, role: 'dialog' },
      h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { type: 'button', class: 'icon-btn', title: 'Close', onclick: () => this.closeModal() }, iconEl('x', 18))),
      h('div', { class: 'modal-body' }, body), foot);
    back.append(box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) this.closeModal(); });
    document.body.append(back);
    this._modal = { back, onClose };
    const first = box.querySelector('input:not([type=checkbox]), select, textarea');
    setTimeout(() => (first ? first.focus() : box.querySelector('.btn.primary')?.focus()), 20);
    return box;
  },

  closeModal(silent) {
    if (!this._modal) return;
    const m = this._modal;
    this._modal = null;
    m.back.remove();
    if (m.onClose) m.onClose();
    if (!silent) this.focusGrid();
  },

  confirm(title, message, okLabel = 'OK', danger = false) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      this.openModal({
        title,
        body: h('p', { class: 'confirm-text' }, message),
        actions: [
          { label: 'Cancel', onClick: () => { finish(false); this.closeModal(); } },
          { label: okLabel, primary: !danger, danger, onClick: () => { finish(true); this.closeModal(); } },
        ],
        width: 420,
        onClose: () => finish(false),
      });
    });
  },

  /* ---------- toasts & tooltips ---------- */

  toast(msg, type = 'info', action) {
    const root = this.$('#toasts');
    const ico = type === 'error' ? 'info' : type === 'success' ? 'check' : 'sparkle';
    const t = h('div', { class: `toast toast-${type}`, role: 'status' }, iconEl(ico, 16), h('span', { class: 'toast-msg' }, msg));
    if (action) {
      t.append(h('button', { type: 'button', class: 'toast-act', onclick: () => { action.fn(); t.remove(); } }, action.label));
    }
    root.append(t);
    while (root.children.length > 3) root.firstChild.remove();
    const ms = type === 'error' ? 6000 : type === 'quiet' ? 2200 : action ? 6000 : 3600;
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    }, ms);
  },

  initTooltips() {
    const tip = h('div', { class: 'tooltip', hidden: true });
    document.body.append(tip);
    this.tipEl = tip;
    let timer = 0;
    let cur = null;
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-tip]');
      if (el === cur) return;
      cur = el;
      clearTimeout(timer);
      tip.hidden = true;
      if (!el) return;
      timer = setTimeout(() => {
        if (el.classList.contains('open')) return;
        tip.textContent = el.dataset.tip;
        tip.hidden = false;
        const r = el.getBoundingClientRect();
        tip.style.left = clamp(r.left + r.width / 2 - tip.offsetWidth / 2, 6, window.innerWidth - tip.offsetWidth - 6) + 'px';
        tip.style.top = r.bottom + 7 + 'px';
      }, 420);
    });
    document.addEventListener('mousedown', () => { clearTimeout(timer); tip.hidden = true; }, true);
  },

  /* ---------- sheet tabs ---------- */

  bindTabs(root) {
    const idx = (e) => {
      const tab = e.target.closest('.tab');
      return tab ? +tab.dataset.i : -1;
    };
    root.addEventListener('mousedown', (e) => { if (e.button === 0 && e.target.closest('.tab')) e.preventDefault(); });
    root.addEventListener('click', (e) => { const i = idx(e); if (i >= 0) this.setActiveSheet(i); });
    root.addEventListener('dblclick', (e) => { const i = idx(e); if (i >= 0) this.renameSheetInline(i); });
    root.addEventListener('contextmenu', (e) => {
      const i = idx(e);
      if (i < 0) return;
      e.preventDefault();
      this.setActiveSheet(i);
      this.openMenu({ x: e.clientX, y: e.clientY - 8 }, [
        { label: 'Rename', icon: 'rename', action: () => this.renameSheetInline(i), keepFocus: true },
        { label: 'Duplicate', icon: 'duplicate', action: () => { this.commit('Duplicate sheet', () => duplicateSheet(this.wb, i)); this.setActiveSheet(i + 1); } },
        { label: 'Move left', icon: 'arrowLeft', disabled: i === 0, action: () => this.moveSheet(i, -1) },
        { label: 'Move right', icon: 'arrowRight', disabled: i === this.wb.sheets.length - 1, action: () => this.moveSheet(i, 1) },
        '-',
        { label: 'Delete sheet', icon: 'trash', danger: true, disabled: this.wb.sheets.length === 1, action: () => this.deleteSheetAt(i) },
      ], { cls: 'context-menu' });
    });
  },

  renderTabs() {
    const root = this.$('#tabs');
    if (!root.dataset.bound) {
      this.bindTabs(root);
      root.dataset.bound = '1';
    }
    [...root.children].forEach((el) => { if (!el.classList.contains('tab')) el.remove(); });
    this.wb.sheets.forEach((sh, i) => {
      let b = root.children[i];
      if (!b) {
        b = h('button', { type: 'button', class: 'tab' }, h('span', { class: 'tab-name' }), h('span', { class: 'tab-badge' }, iconEl('chartBar', 12)));
        root.append(b);
      }
      b.dataset.i = i;
      b.className = 'tab' + (i === this.wb.active ? ' active' : '');
      b.title = `${sh.name} — double-click to rename, right-click for options`;
      b.querySelector('.tab-name').textContent = sh.name;
      const badge = b.querySelector('.tab-badge');
      badge.hidden = !sh.charts.length;
      badge.title = `${sh.charts.length} chart${sh.charts.length > 1 ? 's' : ''}`;
    });
    while (root.children.length > this.wb.sheets.length) root.lastChild.remove();
    const active = root.children[this.wb.active];
    if (active) {
      const l = active.offsetLeft;
      const r = l + active.offsetWidth;
      if (l < root.scrollLeft) root.scrollLeft = l - 8;
      else if (r > root.scrollLeft + root.clientWidth) root.scrollLeft = r - root.clientWidth + 8;
    }
  },

  moveSheet(i, d) {
    const j = i + d;
    this.commit('Move sheet', () => {
      const [sh] = this.wb.sheets.splice(i, 1);
      this.wb.sheets.splice(j, 0, sh);
      this.wb.active = j;
    });
  },

  async deleteSheetAt(i) {
    const sh = this.wb.sheets[i];
    if (!(await this.confirm(`Delete "${sh.name}"?`, 'The sheet and its charts will be removed. Formulas on other sheets that refer to it will show #REF!. You can undo this.', 'Delete sheet', true))) return;
    this.saveSheetState();
    this.commit('Delete sheet', () => deleteSheet(this.wb, i));
    const st = this.sheetState.get(this.sheet.id);
    this.sel = st ? st.sel : { r1: 0, c1: 0, r2: 0, c2: 0, ar: 0, ac: 0, anchorR: 0, anchorC: 0 };
    this.after({ noSave: true });
  },

  renameSheetInline(i) {
    const root = this.$('#tabs');
    const tab = root.children[i];
    if (!tab) return;
    const sh = this.wb.sheets[i];
    const input = h('input', { class: 'tab-input', value: sh.name, maxlength: 31, spellcheck: 'false' });
    tab.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (save && name && name !== sh.name) {
        if (/[[\]:*?/\\]/.test(name)) this.toast('Sheet names cannot contain [ ] : * ? / \\', 'error');
        else if (this.wb.sheets.some((s) => s !== sh && s.name.toLowerCase() === name.toLowerCase())) this.toast(`A sheet named "${name}" already exists`, 'error');
        else {
          this.commit('Rename sheet', () => renameSheet(this.wb, sh, name));
          this.focusGrid();
          return;
        }
      }
      this.renderTabs();
      this.focusGrid();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
      e.stopPropagation();
    });
    input.addEventListener('blur', () => finish(true));
  },
};

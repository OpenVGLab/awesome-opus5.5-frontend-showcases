// Workbook model: sheets, cells, structural edits, sort / filter / fill, snapshots.
// Cell objects are treated as immutable ({ v, f, s } never change in place), so undo
// snapshots can share them; derived caches (ast, cv, calc) may be mutated freely.
import { KEY_STRIDE, cellKey, keyRow, keyCol, uid, intersects, inRange, MAX_ROWS } from './util.js';
import {
  Engine, FErr, shiftFormula, adjustFormula, moveFormulaRefs, renameSheetRefs, deleteSheetRefs, rewriteRefs,
  formatHint, compareValues, parse,
} from './formula.js';
import { parseInput, formatNumber, isDateFormat, fixFloat, MONTHS, DAYS } from './format.js';

export const DEF_COL_W = 100;
export const DEF_ROW_H = 24;

export class Sheet {
  constructor(name, rows = 200, cols = 26) {
    this.id = uid('s');
    this.name = name;
    this.rows = rows;
    this.cols = cols;
    this.cells = new Map();
    this.colW = {};
    this.rowH = {};
    this.merges = [];
    this.filter = null; // { r1, c1, r2, c2, crit: { [col]: { values: string[]|null, cond: {op,a,b}|null } } }
    this.hidden = new Set();
    this.charts = [];
    this.freeze = { r: 0, c: 0 };
    this.showGrid = true;
    this._fk = null;
    this._b = null;
    this._mi = null;
  }
  get(r, c) { return this.cells.get(r * KEY_STRIDE + c); }
  colWidth(c) { const w = this.colW[c]; return w === undefined ? DEF_COL_W : w; }
  rowHeight(r) { const h = this.rowH[r]; return h === undefined ? DEF_ROW_H : h; }
  dirty() { this._fk = null; this._b = null; }
  mergesDirty() { this._mi = null; }
  formulaKeys() {
    if (!this._fk) {
      const ks = [];
      for (const [k, c] of this.cells) if (c.f !== undefined) ks.push(k);
      this._fk = ks.sort((a, b) => a - b);
    }
    return this._fk;
  }
  bounds() {
    if (!this._b) {
      let r = -1;
      let c = -1;
      for (const [k, cell] of this.cells) {
        if (isBlank(cell)) continue;
        const kr = keyRow(k);
        const kc = keyCol(k);
        if (kr > r) r = kr;
        if (kc > c) c = kc;
      }
      for (const m of this.merges) { if (m.r2 > r) r = m.r2; if (m.c2 > c) c = m.c2; }
      this._b = { r, c };
    }
    return this._b;
  }
  mergeAt(r, c) {
    if (!this.merges.length) return null;
    if (!this._mi) {
      const mi = new Map();
      for (const m of this.merges) for (let rr = m.r1; rr <= m.r2; rr++) for (let cc = m.c1; cc <= m.c2; cc++) mi.set(rr * KEY_STRIDE + cc, m);
      this._mi = mi;
    }
    return this._mi.get(r * KEY_STRIDE + c) || null;
  }
  ensureSize(r, c) {
    if (r >= this.rows - 5) this.rows = Math.min(MAX_ROWS, r + 60);
    if (c >= this.cols - 1) this.cols = Math.min(KEY_STRIDE, c + 6);
  }
}

export class Workbook {
  constructor(title = 'Untitled workbook') {
    this.title = title;
    this.sheets = [];
    this.active = 0;
    this.engine = new Engine(this);
  }
  get sheet() { return this.sheets[this.active]; }
  sheetByName(name) {
    const lo = String(name).toLowerCase();
    return this.sheets.find((s) => s.name.toLowerCase() === lo) || null;
  }
  uniqueName(base) {
    let n = 1;
    let name = base;
    while (this.sheetByName(name)) name = `${base} ${++n}`;
    return name;
  }
  addSheet(name, at = this.sheets.length) {
    const sh = new Sheet(this.uniqueName(name || `Sheet${this.sheets.length + 1}`));
    this.sheets.splice(at, 0, sh);
    return sh;
  }
  recalc() { this.engine.recalc(); }
}

/* ---------- cells ---------- */

export const isBlank = (cell) => !cell || (cell.f === undefined && (cell.v === null || cell.v === undefined || cell.v === ''));

export function makeCell(v, f, s) {
  const cell = { v: v === undefined ? null : v };
  if (f !== undefined && f !== null) {
    cell.f = f;
    try {
      cell.ast = parse(f);
    } catch (e) {
      cell.ast = null;
    }
  }
  if (s) cell.s = s;
  return cell;
}

export function putCell(sh, r, c, cell) {
  const k = r * KEY_STRIDE + c;
  if (!cell || (isBlank(cell) && !cell.s)) sh.cells.delete(k);
  else sh.cells.set(k, cell);
  sh.dirty();
}

export function writeInput(sh, r, c, text) {
  const old = sh.get(r, c);
  let s = old && old.s;
  const p = parseInput(text);
  if (p.f !== undefined) {
    const cell = makeCell(null, p.f, s);
    const hint = formatHint(cell.ast);
    if (hint && (!s || !s.nf || s.nf === 'General')) cell.s = { ...(s || {}), nf: hint };
    putCell(sh, r, c, cell);
    return cell;
  }
  let v = p.v;
  if (s && s.nf === '@' && text !== '' && text != null) v = String(text);
  else if (p.nf && (!s || !s.nf || s.nf === 'General')) s = { ...(s || {}), nf: p.nf };
  const cell = makeCell(v, undefined, s);
  putCell(sh, r, c, cell);
  return cell;
}

export function cleanStyle(s) {
  if (!s) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined || v === null || v === false || v === '') continue;
    if (k === 'nf' && v === 'General') continue;
    if (k === 'bd' && !Object.values(v).some(Boolean)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function withStyle(cell, s) {
  const ns = cleanStyle(s);
  const out = { ...(cell || { v: null }) };
  delete out.cv; delete out.calc; delete out.busy;
  if (ns) out.s = ns; else delete out.s;
  return out;
}

const clampToData = (sh, g) => {
  const b = sh.bounds();
  return { ...g, r2: Math.min(g.r2, Math.max(b.r, 199)), c2: Math.min(g.c2, Math.max(b.c, 25)) };
};

export function styleRange(sh, g, patch) {
  const t = clampToData(sh, g);
  for (let r = t.r1; r <= t.r2; r++) {
    for (let c = t.c1; c <= t.c2; c++) {
      const m = sh.mergeAt(r, c);
      if (m && (m.r1 !== r || m.c1 !== c)) continue;
      const cell = sh.get(r, c);
      putCell(sh, r, c, withStyle(cell, { ...(cell && cell.s), ...patch }));
    }
  }
}

export function bordersRange(sh, g, mode, color = '#475569') {
  const t = clampToData(sh, g);
  for (let r = t.r1; r <= t.r2; r++) {
    for (let c = t.c1; c <= t.c2; c++) {
      const cell = sh.get(r, c);
      const bd = { ...((cell && cell.s && cell.s.bd) || {}) };
      if (mode === 'none') { delete bd.t; delete bd.b; delete bd.l; delete bd.r; }
      if (mode === 'all') Object.assign(bd, { t: color, b: color, l: color, r: color });
      if (mode === 'outer') {
        if (r === t.r1) bd.t = color;
        if (r === t.r2) bd.b = color;
        if (c === t.c1) bd.l = color;
        if (c === t.c2) bd.r = color;
      }
      if (mode === 'bottom' && r === t.r2) bd.b = color;
      if (mode === 'top' && r === t.r1) bd.t = color;
      if (mode === 'thickBottom' && r === t.r2) bd.b = color + '|2';
      putCell(sh, r, c, withStyle(cell, { ...(cell && cell.s), bd }));
    }
  }
}

export function clearRange(sh, g, what = 'contents') {
  const t = clampToData(sh, g);
  for (let r = t.r1; r <= t.r2; r++) {
    for (let c = t.c1; c <= t.c2; c++) {
      const cell = sh.get(r, c);
      if (!cell) continue;
      if (what === 'all') putCell(sh, r, c, null);
      else if (what === 'formats') putCell(sh, r, c, withStyle(cell, null));
      else putCell(sh, r, c, cell.s ? makeCell(null, undefined, cell.s) : null);
    }
  }
}

/* ---------- display ---------- */

export function cellValue(cell) {
  if (!cell) return null;
  if (cell.f !== undefined) return cell.cv === undefined ? null : cell.cv;
  return cell.v === undefined ? null : cell.v;
}

export function cellDisplay(cell) {
  const v = cellValue(cell);
  if (v === null || v === '') return null;
  if (v instanceof FErr) return { text: v.code, align: 'center', err: true };
  const nf = cell.s && cell.s.nf;
  if (typeof v === 'number') {
    const r = formatNumber(v, nf);
    return { text: r.text, align: 'right', color: r.color, num: true, general: !nf || nf === 'General' };
  }
  if (typeof v === 'boolean') return { text: v ? 'TRUE' : 'FALSE', align: 'center' };
  if (nf && nf !== 'General' && nf.includes('@') && nf !== '@') {
    const r = formatNumber(v, nf);
    return { text: r.text, align: 'left', color: r.color };
  }
  return { text: String(v), align: 'left' };
}

export function displayText(sh, r, c) {
  const d = cellDisplay(sh.get(r, c));
  return d ? d.text : '';
}

/* ---------- structural edits ---------- */

function adjustSpan(g, axis, at, count) {
  const k1 = axis === 'row' ? 'r1' : 'c1';
  const k2 = axis === 'row' ? 'r2' : 'c2';
  let a = g[k1];
  let b = g[k2];
  if (count > 0) {
    if (a >= at) a += count;
    if (b >= at) b += count;
  } else {
    const n = -count;
    const end = at + n;
    const na = a < at ? a : a >= end ? a - n : at;
    const nb = b < at ? b : b >= end ? b - n : at - 1;
    if (nb < na) return null;
    a = na;
    b = nb;
  }
  return { ...g, [k1]: a, [k2]: b };
}

function shiftIndex(i, at, count) {
  if (count > 0) return i >= at ? i + count : i;
  const n = -count;
  if (i >= at && i < at + n) return null;
  return i >= at + n ? i - n : i;
}

function shiftSparse(obj, at, count) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const ni = shiftIndex(+k, at, count);
    if (ni !== null) out[ni] = v;
  }
  return out;
}

export function forEachFormula(wb, fn) {
  for (const s of wb.sheets) {
    for (const [k, cell] of s.cells) {
      if (cell.f === undefined) continue;
      const nf = fn(cell.f, s, k);
      if (nf !== undefined && nf !== cell.f) {
        const nc = makeCell(cell.v, nf, cell.s);
        if (cell.cached !== undefined) nc.cached = cell.cached;
        s.cells.set(k, nc);
      }
    }
    s.dirty();
  }
}

const targetFn = (sh, s) => {
  const lo = sh.name.toLowerCase();
  return (name) => (name ? name.toLowerCase() === lo : s === sh);
};

// axis: 'row' | 'col'; count > 0 inserts before `at`, count < 0 deletes -count items starting at `at`.
export function structural(wb, sh, axis, at, count) {
  const R = axis === 'row';
  const cells = new Map();
  for (const [k, cell] of sh.cells) {
    const r = keyRow(k);
    const c = keyCol(k);
    const ni = shiftIndex(R ? r : c, at, count);
    if (ni === null) continue;
    cells.set(R ? ni * KEY_STRIDE + c : r * KEY_STRIDE + ni, cell);
  }
  sh.cells = cells;
  if (R) sh.rowH = shiftSparse(sh.rowH, at, count);
  else sh.colW = shiftSparse(sh.colW, at, count);
  sh.merges = sh.merges.map((m) => adjustSpan(m, axis, at, count)).filter((m) => m && (m.r1 !== m.r2 || m.c1 !== m.c2));
  sh.mergesDirty();
  if (R) {
    const hid = new Set();
    for (const r of sh.hidden) {
      const ni = shiftIndex(r, at, count);
      if (ni !== null) hid.add(ni);
    }
    sh.hidden = hid;
  }
  if (sh.filter) {
    const f = adjustSpan(sh.filter, axis, at, count);
    const headerDeleted = R && count < 0 && sh.filter.r1 >= at && sh.filter.r1 < at - count;
    if (!f || headerDeleted) {
      sh.filter = null;
      sh.hidden.clear();
    } else {
      if (!R) {
        const crit = {};
        for (const [c, v] of Object.entries(f.crit || {})) {
          const ni = shiftIndex(+c, at, count);
          if (ni !== null) crit[ni] = v;
        }
        f.crit = crit;
      }
      sh.filter = f;
    }
  }
  for (const ch of sh.charts) {
    ch.areas = ch.areas.map((g) => adjustSpan(g, axis, at, count)).filter(Boolean);
  }
  if (R) {
    if (count > 0 && at < sh.freeze.r) sh.freeze.r += count;
    if (count < 0) sh.freeze.r -= Math.max(0, Math.min(at - count, sh.freeze.r) - at);
    sh.rows = Math.max(1, sh.rows + count);
  } else {
    if (count > 0 && at < sh.freeze.c) sh.freeze.c += count;
    if (count < 0) sh.freeze.c -= Math.max(0, Math.min(at - count, sh.freeze.c) - at);
    sh.cols = Math.max(1, Math.min(KEY_STRIDE, sh.cols + count));
  }
  sh.dirty();
  forEachFormula(wb, (f, s) => adjustFormula(f, targetFn(sh, s), axis, at, count));
}

/* ---------- sheets ---------- */

export function renameSheet(wb, sh, name) {
  const old = sh.name;
  sh.name = name;
  forEachFormula(wb, (f) => renameSheetRefs(f, old, name));
}

export function deleteSheet(wb, index) {
  const [sh] = wb.sheets.splice(index, 1);
  forEachFormula(wb, (f) => deleteSheetRefs(f, sh.name));
  wb.active = Math.max(0, Math.min(wb.active, wb.sheets.length - 1));
}

export function duplicateSheet(wb, index) {
  const src = wb.sheets[index];
  const snap = snapSheet(src);
  const sh = new Sheet(wb.uniqueName(src.name + ' copy'));
  Object.assign(sh, cloneSnapSheet(snap), { id: uid('s'), name: sh.name });
  sh.charts = sh.charts.map((c) => ({ ...c, id: uid('c') }));
  wb.sheets.splice(index + 1, 0, sh);
  return sh;
}

/* ---------- merges ---------- */

export function mergeRange(sh, g, mode = 'all') {
  const areas = mode === 'rows'
    ? Array.from({ length: g.r2 - g.r1 + 1 }, (_, i) => ({ r1: g.r1 + i, c1: g.c1, r2: g.r1 + i, c2: g.c2 }))
    : [g];
  sh.merges = sh.merges.filter((m) => !intersects(m, g));
  for (const a of areas) {
    if (a.r1 === a.r2 && a.c1 === a.c2) continue;
    for (let r = a.r1; r <= a.r2; r++) {
      for (let c = a.c1; c <= a.c2; c++) {
        if (r === a.r1 && c === a.c1) continue;
        const cell = sh.get(r, c);
        if (cell && !isBlank(cell)) putCell(sh, r, c, cell.s ? makeCell(null, undefined, cell.s) : null);
      }
    }
    sh.merges.push({ ...a });
  }
  sh.mergesDirty();
  sh.dirty();
}

export function unmergeRange(sh, g) {
  sh.merges = sh.merges.filter((m) => !intersects(m, g));
  sh.mergesDirty();
  sh.dirty();
}

export function mergeLosesData(sh, g) {
  for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if ((r !== g.r1 || c !== g.c1) && !isBlank(sh.get(r, c))) return true;
  return false;
}

export function expandForMerges(sh, g) {
  let out = { ...g };
  let changed = true;
  while (changed && sh.merges.length) {
    changed = false;
    for (const m of sh.merges) {
      if (intersects(m, out) && (m.r1 < out.r1 || m.c1 < out.c1 || m.r2 > out.r2 || m.c2 > out.c2)) {
        out = { r1: Math.min(out.r1, m.r1), c1: Math.min(out.c1, m.c1), r2: Math.max(out.r2, m.r2), c2: Math.max(out.c2, m.c2) };
        changed = true;
      }
    }
  }
  return out;
}

/* ---------- regions ---------- */

export function currentRegion(sh, r, c) {
  const filled = (rr, cc) => rr >= 0 && cc >= 0 && (!isBlank(sh.get(rr, cc)) || !!sh.mergeAt(rr, cc));
  const g = { r1: r, c1: c, r2: r, c2: c };
  const b = sh.bounds();
  let changed = true;
  while (changed) {
    changed = false;
    const cl = Math.max(0, g.c1 - 1);
    const cr = g.c2 + 1;
    if (g.r1 > 0) for (let cc = cl; cc <= cr; cc++) if (filled(g.r1 - 1, cc)) { g.r1--; changed = true; break; }
    if (g.r2 < b.r) for (let cc = cl; cc <= cr; cc++) if (filled(g.r2 + 1, cc)) { g.r2++; changed = true; break; }
    const rt = Math.max(0, g.r1 - 1);
    const rb = g.r2 + 1;
    if (g.c1 > 0) for (let rr = rt; rr <= rb; rr++) if (filled(rr, g.c1 - 1)) { g.c1--; changed = true; break; }
    if (g.c2 < b.c) for (let rr = rt; rr <= rb; rr++) if (filled(rr, g.c2 + 1)) { g.c2++; changed = true; break; }
  }
  return g;
}

// A first row counts as headers when it is all text above at least one numeric/date column, or is bold.
export function detectHeader(sh, g) {
  if (g.r2 <= g.r1) return false;
  let allText = true;
  let numericBelow = false;
  let bold = false;
  for (let c = g.c1; c <= g.c2; c++) {
    const top = sh.get(g.r1, c);
    const v = cellValue(top);
    if (v !== null && typeof v !== 'string') allText = false;
    if (top && top.s && top.s.b) bold = true;
    const below = cellValue(sh.get(g.r1 + 1, c));
    if (typeof below === 'number') numericBelow = true;
  }
  return allText && (numericBelow || bold);
}

/* ---------- sort ---------- */

function sortCompare(a, b) {
  const ea = a === null || a === '';
  const eb = b === null || b === '';
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, undefined, { sensitivity: 'base' });
  const ae = a instanceof FErr;
  const be = b instanceof FErr;
  if (ae || be) return ae === be ? 0 : ae ? 1 : -1;
  return compareValues(a, b);
}

export function sortRange(wb, sh, g, keys) {
  if (sh.merges.some((m) => intersects(m, g))) return 'The range contains merged cells, which cannot be sorted.';
  const rows = [];
  for (let r = g.r1; r <= g.r2; r++) if (!sh.hidden.has(r)) rows.push(r);
  const data = rows.map((r) => {
    const cells = [];
    for (let c = g.c1; c <= g.c2; c++) cells.push(sh.get(r, c));
    return { r, cells, keys: keys.map((k) => wb.engine.value(sh, r, k.c)) };
  });
  data.sort((p, q) => {
    for (let i = 0; i < keys.length; i++) {
      const blankP = p.keys[i] === null || p.keys[i] === '';
      const blankQ = q.keys[i] === null || q.keys[i] === '';
      if (blankP || blankQ) {
        if (blankP !== blankQ) return blankP ? 1 : -1;
        continue;
      }
      const c = sortCompare(p.keys[i], q.keys[i]);
      if (c) return keys[i].desc ? -c : c;
    }
    return 0;
  });
  data.forEach((row, i) => {
    const dest = rows[i];
    const dr = dest - row.r;
    row.cells.forEach((cell, j) => {
      const c = g.c1 + j;
      if (!cell) { sh.cells.delete(dest * KEY_STRIDE + c); return; }
      if (cell.f !== undefined && dr) {
        const nc = makeCell(cell.v, shiftFormula(cell.f, dr, 0), cell.s);
        sh.cells.set(dest * KEY_STRIDE + c, nc);
      } else sh.cells.set(dest * KEY_STRIDE + c, cell);
    });
  });
  sh.dirty();
  return null;
}

/* ---------- filter ---------- */

export function filterColumnValues(sh, c) {
  const f = sh.filter;
  const map = new Map();
  for (let r = f.r1 + 1; r <= f.r2; r++) {
    const t = displayText(sh, r, c);
    const e = map.get(t);
    if (e) e.n++;
    else map.set(t, { text: t, n: 1, v: cellValue(sh.get(r, c)) });
  }
  return [...map.values()].sort((a, b) => {
    if (a.text === '') return 1;
    if (b.text === '') return -1;
    return sortCompare(a.v instanceof FErr ? a.text : a.v, b.v instanceof FErr ? b.text : b.v);
  });
}

function condTest(cond, v, text, stats) {
  const num = typeof v === 'number' ? v : null;
  const a = cond.a;
  const an = a === '' || a === undefined ? null : Number(a);
  const lo = String(text).toLowerCase();
  const al = String(a ?? '').toLowerCase();
  switch (cond.op) {
    case 'contains': return lo.includes(al);
    case 'notContains': return !lo.includes(al);
    case 'begins': return lo.startsWith(al);
    case 'ends': return lo.endsWith(al);
    case 'eq': return num !== null && an !== null && !Number.isNaN(an) ? num === an : lo === al;
    case 'neq': return num !== null && an !== null && !Number.isNaN(an) ? num !== an : lo !== al;
    case 'gt': return num !== null && num > an;
    case 'gte': return num !== null && num >= an;
    case 'lt': return num !== null && num < an;
    case 'lte': return num !== null && num <= an;
    case 'between': {
      const b = Number(cond.b);
      return num !== null && num >= Math.min(an, b) && num <= Math.max(an, b);
    }
    case 'top': return num !== null && num >= stats.topCut;
    case 'bottom': return num !== null && num <= stats.bottomCut;
    case 'aboveAvg': return num !== null && num > stats.avg;
    case 'belowAvg': return num !== null && num < stats.avg;
    case 'empty': return text === '';
    case 'notEmpty': return text !== '';
    default: return true;
  }
}

export function applyFilter(sh) {
  sh.hidden.clear();
  const f = sh.filter;
  if (!f) return;
  const active = Object.entries(f.crit || {}).filter(([, cr]) => cr && (cr.values || cr.cond));
  if (!active.length) return;
  const prepared = active.map(([c, cr]) => {
    const col = +c;
    const stats = {};
    if (cr.cond && ['top', 'bottom', 'aboveAvg', 'belowAvg'].includes(cr.cond.op)) {
      const nums = [];
      for (let r = f.r1 + 1; r <= f.r2; r++) {
        const v = cellValue(sh.get(r, col));
        if (typeof v === 'number') nums.push(v);
      }
      const n = Math.max(1, Math.floor(Number(cr.cond.a) || 10));
      const desc = [...nums].sort((p, q) => q - p);
      stats.topCut = desc.length ? desc[Math.min(n, desc.length) - 1] : Infinity;
      const asc = [...nums].sort((p, q) => p - q);
      stats.bottomCut = asc.length ? asc[Math.min(n, asc.length) - 1] : -Infinity;
      stats.avg = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
    }
    return { col, values: cr.values ? new Set(cr.values) : null, cond: cr.cond, stats };
  });
  for (let r = f.r1 + 1; r <= f.r2; r++) {
    for (const p of prepared) {
      const text = displayText(sh, r, p.col);
      if (p.values && !p.values.has(text)) { sh.hidden.add(r); break; }
      if (p.cond && !condTest(p.cond, cellValue(sh.get(r, p.col)), text, p.stats)) { sh.hidden.add(r); break; }
    }
  }
}

/* ---------- fill handle ---------- */

const NAME_LISTS = [MONTHS, MONTHS.map((m) => m.slice(0, 3)), DAYS, DAYS.map((d) => d.slice(0, 3))];

function matchCase(sample, word) {
  if (sample === sample.toUpperCase()) return word.toUpperCase();
  if (sample === sample.toLowerCase()) return word.toLowerCase();
  return word;
}

function makeFiller(cells) {
  const n = cells.length;
  const vals = cells.map((c) => (c ? c.v : null));
  const hasF = cells.some((c) => c && c.f !== undefined);
  const base = (k) => cells[((k % n) + n) % n];
  if (!hasF && vals.every((v) => typeof v === 'number')) {
    if (n === 1) {
      const isDate = cells[0].s && isDateFormat(cells[0].s.nf);
      return (k) => makeCell(fixFloat(vals[0] + (isDate ? k : 0)), undefined, cells[0].s);
    }
    const xs = vals.map((_, i) => i);
    const mx = (n - 1) / 2;
    const my = vals.reduce((s, v) => s + v, 0) / n;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (vals[i] - my); sxx += (xs[i] - mx) ** 2; }
    const slope = sxy / sxx;
    const icpt = my - slope * mx;
    return (k) => makeCell(fixFloat(icpt + slope * k), undefined, base(k).s);
  }
  if (!hasF && vals.every((v) => typeof v === 'string' && v)) {
    const ms = vals.map((v) => /^(.*?)(\d+)(\D*)$/.exec(v));
    if (ms.every(Boolean) && ms.every((m) => m[1] === ms[0][1] && m[3] === ms[0][3])) {
      const ns = ms.map((m) => +m[2]);
      const step = n > 1 ? (ns[n - 1] - ns[0]) / (n - 1) : 1;
      if (Number.isInteger(step)) {
        const width = ms[0][2].length;
        return (k) => {
          const num = ns[0] + step * k;
          const digits = String(Math.abs(num)).padStart(ms[0][2].startsWith('0') ? width : 1, '0');
          return makeCell(ms[0][1] + (num < 0 ? '-' : '') + digits + ms[0][3], undefined, base(k).s);
        };
      }
    }
    for (const list of NAME_LISTS) {
      const lower = list.map((w) => w.toLowerCase());
      const idx = vals.map((v) => lower.indexOf(v.trim().toLowerCase()));
      if (idx.every((i) => i >= 0)) {
        const step = n > 1 ? idx[1] - idx[0] : 1;
        const L = list.length;
        return (k) => makeCell(matchCase(vals[0], list[(((idx[0] + step * k) % L) + L) % L]), undefined, base(k).s);
      }
    }
  }
  return (k, dr, dc) => {
    const c = base(k);
    if (!c) return null;
    if (c.f !== undefined) return makeCell(null, shiftFormula(c.f, dr, dc), c.s);
    return c;
  };
}

// Extend `src` to `dst` (dst contains src and extends it along one axis).
export function fillRange(sh, src, dst) {
  const down = dst.r2 > src.r2;
  const up = dst.r1 < src.r1;
  const right = dst.c2 > src.c2;
  const left = dst.c1 < src.c1;
  if (down || up) {
    const n = src.r2 - src.r1 + 1;
    for (let c = src.c1; c <= src.c2; c++) {
      const cells = [];
      for (let r = src.r1; r <= src.r2; r++) cells.push(sh.get(r, c));
      const fill = makeFiller(cells);
      const rows = down ? range(src.r2 + 1, dst.r2) : range(dst.r1, src.r1 - 1);
      for (const r of rows) {
        const k = r - src.r1;
        const srcRow = src.r1 + (((k % n) + n) % n);
        putCell(sh, r, c, fill(k, r - srcRow, 0));
      }
    }
  } else if (right || left) {
    const n = src.c2 - src.c1 + 1;
    for (let r = src.r1; r <= src.r2; r++) {
      const cells = [];
      for (let c = src.c1; c <= src.c2; c++) cells.push(sh.get(r, c));
      const fill = makeFiller(cells);
      const cols = right ? range(src.c2 + 1, dst.c2) : range(dst.c1, src.c1 - 1);
      for (const c of cols) {
        const k = c - src.c1;
        const srcCol = src.c1 + (((k % n) + n) % n);
        putCell(sh, r, c, fill(k, 0, c - srcCol));
      }
    }
  }
  sh.ensureSize(dst.r2, dst.c2);
}
const range = (a, b) => (b < a ? [] : Array.from({ length: b - a + 1 }, (_, i) => a + i));

/* ---------- clipboard blocks ---------- */

export function copyBlock(sh, g) {
  const cells = [];
  for (let r = g.r1; r <= g.r2; r++) {
    const row = [];
    for (let c = g.c1; c <= g.c2; c++) row.push(sh.get(r, c) || null);
    cells.push(row);
  }
  const merges = sh.merges.filter((m) => m.r1 >= g.r1 && m.r2 <= g.r2 && m.c1 >= g.c1 && m.c2 <= g.c2)
    .map((m) => ({ r1: m.r1 - g.r1, c1: m.c1 - g.c1, r2: m.r2 - g.r1, c2: m.c2 - g.c1 }));
  return { g: { ...g }, cells, merges, sheetId: sh.id };
}

export function pasteBlock(wb, sh, r0, c0, blk, opts = {}) {
  const rows = blk.cells.length;
  const cols = blk.cells[0].length;
  const dst = { r1: r0, c1: c0, r2: r0 + rows - 1, c2: c0 + cols - 1 };
  const srcSheet = wb.sheets.find((s) => s.id === blk.sheetId);
  if (opts.cut && srcSheet) {
    for (let r = blk.g.r1; r <= blk.g.r2; r++) for (let c = blk.g.c1; c <= blk.g.c2; c++) putCell(srcSheet, r, c, null);
    srcSheet.merges = srcSheet.merges.filter((m) => !intersects(m, blk.g));
    srcSheet.mergesDirty();
  }
  sh.merges = sh.merges.filter((m) => !intersects(m, dst));
  const dr = r0 - blk.g.r1;
  const dc = c0 - blk.g.c1;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const cell = blk.cells[i][j];
      const r = r0 + i;
      const c = c0 + j;
      if (opts.valuesOnly) {
        const old = sh.get(r, c);
        const v = cell ? cellValue(cell) : null;
        const keepNf = cell && cell.s && cell.s.nf ? { ...(old && old.s), nf: cell.s.nf } : old && old.s;
        putCell(sh, r, c, v === null || v instanceof FErr ? (old && old.s ? makeCell(null, undefined, old.s) : null) : makeCell(v, undefined, keepNf));
        continue;
      }
      if (!cell) { putCell(sh, r, c, null); continue; }
      if (cell.f !== undefined && !opts.cut) putCell(sh, r, c, makeCell(null, shiftFormula(cell.f, dr, dc), cell.s));
      else putCell(sh, r, c, makeCell(cell.v, cell.f, cell.s));
    }
  }
  if (!opts.valuesOnly) for (const m of blk.merges) sh.merges.push({ r1: m.r1 + r0, c1: m.c1 + c0, r2: m.r2 + r0, c2: m.c2 + c0 });
  sh.mergesDirty();
  sh.ensureSize(dst.r2, dst.c2);
  if (opts.cut && srcSheet) {
    const lo = srcSheet.name.toLowerCase();
    forEachFormula(wb, (f, s) => moveFormulaRefs(f, (name) => (name ? name.toLowerCase() === lo : s === srcSheet), blk.g, dr, dc, srcSheet === sh ? undefined : (s === sh ? null : sh.name)));
  }
  return dst;
}

// External text (TSV / CSV rows) -> cells
export function pasteText(sh, r0, c0, rows) {
  rows.forEach((row, i) => row.forEach((text, j) => writeInput(sh, r0 + i, c0 + j, text)));
  const w = Math.max(...rows.map((r) => r.length));
  sh.ensureSize(r0 + rows.length - 1, c0 + w - 1);
  return { r1: r0, c1: c0, r2: r0 + rows.length - 1, c2: c0 + w - 1 };
}

/* ---------- records (data form) ---------- */

// Append a record below a table: shifts rows under it, extends ranges that ended on the
// last record, copies formulas and formats from the row above.
export function appendRecord(wb, sh, g, values) {
  const at = g.r2 + 1;
  structural(wb, sh, 'row', at, 1);
  const lo = sh.name.toLowerCase();
  forEachFormula(wb, (f, s) => rewriteRefs(f, (ref) => {
    const mine = ref.sheet ? ref.sheet.toLowerCase() === lo : s === sh;
    if (!mine || ref.kind !== 'range') return undefined;
    if (ref.r2 === g.r2 && ref.r1 >= g.r1 && ref.r1 < g.r2 && ref.c1 <= g.c2 && ref.c2 >= g.c1) {
      ref.r2 = at;
      return ref;
    }
    return undefined;
  }));
  if (sh.filter && sh.filter.r2 === g.r2) sh.filter.r2 = at;
  for (const ch of sh.charts) ch.areas = ch.areas.map((a) => (a.r2 === g.r2 && a.r1 >= g.r1 ? { ...a, r2: at } : a));
  for (let c = g.c1; c <= g.c2; c++) {
    const above = sh.get(g.r2, c);
    const val = values ? values[c - g.c1] : '';
    if (above && above.f !== undefined && (val === undefined || val === null || val === '')) {
      putCell(sh, at, c, makeCell(null, shiftFormula(above.f, 1, 0), above.s));
    } else {
      putCell(sh, at, c, above && above.s ? makeCell(null, undefined, above.s) : null);
      if (val !== undefined && val !== null && val !== '') writeInput(sh, at, c, val);
    }
  }
  if (sh.rowH[g.r2] !== undefined) sh.rowH[at] = sh.rowH[g.r2];
  return at;
}

/* ---------- snapshots & persistence ---------- */

function snapSheet(sh) {
  return {
    id: sh.id, name: sh.name, rows: sh.rows, cols: sh.cols,
    cells: new Map(sh.cells), colW: { ...sh.colW }, rowH: { ...sh.rowH },
    merges: sh.merges.map((m) => ({ ...m })),
    filter: sh.filter ? { ...sh.filter, crit: JSON.parse(JSON.stringify(sh.filter.crit || {})) } : null,
    hidden: new Set(sh.hidden),
    charts: sh.charts.map((c) => ({ ...c, areas: c.areas.map((a) => ({ ...a })) })),
    freeze: { ...sh.freeze }, showGrid: sh.showGrid,
  };
}
function cloneSnapSheet(s) {
  const c = snapSheet(s);
  return c;
}

export function snapshot(wb) {
  return { title: wb.title, active: wb.active, sheets: wb.sheets.map(snapSheet) };
}

export function restore(wb, snap) {
  wb.title = snap.title;
  wb.active = snap.active;
  wb.sheets = snap.sheets.map((s) => {
    const sh = new Sheet(s.name);
    Object.assign(sh, cloneSnapSheet(s));
    sh.dirty();
    sh.mergesDirty();
    return sh;
  });
}

export function cellCount(wb) {
  return wb.sheets.reduce((n, s) => n + s.cells.size, 0);
}

export function serialize(wb) {
  const styles = [];
  const idx = new Map();
  const sIdx = (s) => {
    if (!s) return -1;
    const key = JSON.stringify(s);
    let i = idx.get(key);
    if (i === undefined) { i = styles.length; styles.push(s); idx.set(key, i); }
    return i;
  };
  return {
    v: 1, title: wb.title, active: wb.active, styles,
    sheets: wb.sheets.map((sh) => ({
      name: sh.name, rows: sh.rows, cols: sh.cols, colW: sh.colW, rowH: sh.rowH, merges: sh.merges,
      filter: sh.filter, hidden: [...sh.hidden], charts: sh.charts, freeze: sh.freeze, showGrid: sh.showGrid,
      cells: [...sh.cells].map(([k, c]) => [k, c.v === undefined ? null : c.v, c.f === undefined ? null : c.f, sIdx(c.s)]),
    })),
  };
}

export function deserialize(o) {
  if (!o || o.v !== 1 || !Array.isArray(o.sheets) || !o.sheets.length) throw new Error('bad workbook data');
  const wb = new Workbook(o.title || 'Untitled workbook');
  for (const s of o.sheets) {
    const sh = new Sheet(s.name, s.rows || 200, s.cols || 26);
    sh.colW = s.colW || {};
    sh.rowH = s.rowH || {};
    sh.merges = s.merges || [];
    sh.filter = s.filter || null;
    sh.hidden = new Set(s.hidden || []);
    sh.charts = (s.charts || []).map((c) => ({ ...c }));
    sh.freeze = s.freeze || { r: 0, c: 0 };
    sh.showGrid = s.showGrid !== false;
    for (const [k, v, f, si] of s.cells) sh.cells.set(k, makeCell(v, f === null ? undefined : f, si >= 0 ? o.styles[si] : undefined));
    wb.sheets.push(sh);
  }
  wb.active = Math.min(o.active || 0, wb.sheets.length - 1);
  return wb;
}

// Build a sheet quickly from rows of input strings / values.
export function fillSheet(sh, r0, c0, rows) {
  rows.forEach((row, i) => row.forEach((val, j) => {
    if (val === null || val === undefined || val === '') return;
    if (typeof val === 'number' || typeof val === 'boolean') putCell(sh, r0 + i, c0 + j, makeCell(val, undefined, sh.get(r0 + i, c0 + j)?.s));
    else writeInput(sh, r0 + i, c0 + j, String(val));
  }));
}

export { cellKey, inRange };

// Formula engine: tokenizer, parser, evaluator, reference rewriting and the function library.
import { colIndex, colName, KEY_STRIDE, MAX_ROWS } from './util.js';
import {
  formatNumber, formatGeneral, numToText, coerceNumber, dateToSerial, serialToParts, nowSerial,
  roundHalfAway, fixFloat, parseDateLike,
} from './format.js';

export class FErr {
  constructor(code) { this.code = code; }
  toString() { return this.code; }
}
export const ERR = {
  DIV0: new FErr('#DIV/0!'), VALUE: new FErr('#VALUE!'), REF: new FErr('#REF!'), NAME: new FErr('#NAME?'),
  NA: new FErr('#N/A'), NUM: new FErr('#NUM!'), NULL: new FErr('#NULL!'), CYCLE: new FErr('#CYCLE!'), ERROR: new FErr('#ERROR!'),
};
const ERR_BY_CODE = Object.fromEntries(Object.values(ERR).map((e) => [e.code, e]));
export const errFromCode = (code) => ERR_BY_CODE[String(code).toUpperCase()] || ERR.VALUE;
export const isErr = (v) => v instanceof FErr;

export class FormulaSyntaxError extends Error {}

/* ---------- tokenizer ---------- */

const ID_START = /[A-Za-z_\u00C0-\uFFFF]/;
const RE_SHEET = /^([A-Za-z_\u00C0-\uFFFF][\w.\u00C0-\uFFFF]*)!/;
const RE_QSHEET = /^'((?:[^']|'')+)'!/;
const RE_CELL = /^(\$?)([A-Za-z]{1,3})(\$?)([1-9]\d{0,6})(?![\w.(\u00C0-\uFFFF])/;
const RE_COLS = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![\w.(\u00C0-\uFFFF])/;
const RE_ROWS = /^(\$?)([1-9]\d{0,6}):(\$?)([1-9]\d{0,6})(?![\w.(])/;
const RE_IDENT = /^[A-Za-z_\u00C0-\uFFFF][\w.\u00C0-\uFFFF]*/;
const RE_NUM = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/;
const RE_ERR = /^#(DIV\/0!|N\/A|NAME\?|REF!|VALUE!|NUM!|NULL!|CYCLE!|ERROR!)/i;

export function tokenize(src) {
  const toks = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const ch = src[i];
    const rest = src.slice(i);
    let m;
    if (/\s/.test(ch)) {
      let j = i;
      while (j < n && /\s/.test(src[j])) j++;
      toks.push({ t: 'ws', s: i, e: j });
      i = j;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let v = '';
      for (;;) {
        if (j >= n) throw new FormulaSyntaxError('Unterminated string');
        if (src[j] === '"') {
          if (src[j + 1] === '"') { v += '"'; j += 2; continue; }
          break;
        }
        v += src[j++];
      }
      toks.push({ t: 'str', v, s: i, e: j + 1 });
      i = j + 1;
      continue;
    }
    if ((m = RE_ROWS.exec(rest)) && !(toks.length && lastSig(toks).t === 'num')) {
      toks.push({ t: 'rows', sheet: null, ra1: !!m[1], r1: +m[2] - 1, ra2: !!m[3], r2: +m[4] - 1, s: i, e: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if (/[0-9.]/.test(ch) && (m = RE_NUM.exec(rest))) {
      toks.push({ t: 'num', v: parseFloat(m[0]), s: i, e: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if (ch === '#') {
      if (!(m = RE_ERR.exec(rest))) throw new FormulaSyntaxError('Unknown error literal');
      toks.push({ t: 'err', v: m[0].toUpperCase(), s: i, e: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if (ch === "'" || ch === '$' || ID_START.test(ch) || /\d/.test(ch)) {
      let sheet = null;
      let j = i;
      if (ch === "'") {
        if (!(m = RE_QSHEET.exec(rest))) throw new FormulaSyntaxError('Bad sheet reference');
        sheet = m[1].replace(/''/g, "'");
        j += m[0].length;
      } else if ((m = RE_SHEET.exec(rest))) {
        sheet = m[1];
        j += m[0].length;
      }
      const r2 = src.slice(j);
      if ((m = RE_CELL.exec(r2))) {
        toks.push({ t: 'ref', sheet, ca: !!m[1], c: colIndex(m[2]), ra: !!m[3], r: +m[4] - 1, s: i, e: j + m[0].length });
        i = j + m[0].length;
        continue;
      }
      if ((m = RE_COLS.exec(r2))) {
        toks.push({ t: 'cols', sheet, ca1: !!m[1], c1: colIndex(m[2]), ca2: !!m[3], c2: colIndex(m[4]), s: i, e: j + m[0].length });
        i = j + m[0].length;
        continue;
      }
      if (sheet !== null && (m = RE_ROWS.exec(r2))) {
        toks.push({ t: 'rows', sheet, ra1: !!m[1], r1: +m[2] - 1, ra2: !!m[3], r2: +m[4] - 1, s: i, e: j + m[0].length });
        i = j + m[0].length;
        continue;
      }
      if (sheet !== null) throw new FormulaSyntaxError('Bad reference after sheet name');
      if ((m = RE_IDENT.exec(rest))) {
        const name = m[0];
        const k = i + name.length;
        if (src[k] === '(') toks.push({ t: 'func', name: name.toUpperCase(), s: i, e: k });
        else if (/^(TRUE|FALSE)$/i.test(name)) toks.push({ t: 'bool', v: name.toUpperCase() === 'TRUE', s: i, e: k });
        else toks.push({ t: 'name', name, s: i, e: k });
        i = k;
        continue;
      }
    }
    const two = src.substr(i, 2);
    if (two === '<=' || two === '>=' || two === '<>') {
      toks.push({ t: 'op', v: two, s: i, e: i + 2 });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>%'.includes(ch)) { toks.push({ t: 'op', v: ch, s: i, e: i + 1 }); i++; continue; }
    const single = { ':': 'colon', '(': 'lp', ')': 'rp', ',': 'comma', ';': 'semi', '{': 'lb', '}': 'rb' }[ch];
    if (single) { toks.push({ t: single, s: i, e: i + 1 }); i++; continue; }
    throw new FormulaSyntaxError(`Unexpected character "${ch}"`);
  }
  return toks;
}

function lastSig(toks) {
  for (let k = toks.length - 1; k >= 0; k--) if (toks[k].t !== 'ws') return toks[k];
  return {};
}

/* ---------- parser (Excel precedence) ---------- */

export function parse(src) {
  const toks = tokenize(src).filter((t) => t.t !== 'ws');
  let p = 0;
  const peek = () => toks[p];
  const isOp = (...ops) => toks[p] && toks[p].t === 'op' && ops.includes(toks[p].v);
  const expect = (t) => {
    if (!toks[p] || toks[p].t !== t) throw new FormulaSyntaxError(`Expected ${t === 'rp' ? ')' : t}`);
    return toks[p++];
  };
  const comparison = () => {
    let a = concat();
    while (isOp('=', '<>', '<', '>', '<=', '>=')) {
      const op = toks[p++].v;
      a = { k: 'bin', op, a, b: concat() };
    }
    return a;
  };
  const concat = () => {
    let a = additive();
    while (isOp('&')) { p++; a = { k: 'bin', op: '&', a, b: additive() }; }
    return a;
  };
  const additive = () => {
    let a = mult();
    while (isOp('+', '-')) { const op = toks[p++].v; a = { k: 'bin', op, a, b: mult() }; }
    return a;
  };
  const mult = () => {
    let a = power();
    while (isOp('*', '/')) { const op = toks[p++].v; a = { k: 'bin', op, a, b: power() }; }
    return a;
  };
  const power = () => {
    let a = percent();
    while (isOp('^')) { p++; a = { k: 'bin', op: '^', a, b: percent() }; }
    return a;
  };
  const percent = () => {
    let a = unary();
    while (isOp('%')) { p++; a = { k: 'pct', e: a }; }
    return a;
  };
  const unary = () => {
    if (isOp('-')) { p++; return { k: 'neg', e: unary() }; }
    if (isOp('+')) { p++; return unary(); }
    return range();
  };
  const range = () => {
    let a = primary();
    while (peek() && peek().t === 'colon') {
      p++;
      const b = primary();
      if (a.k !== 'ref' && a.k !== 'range') throw new FormulaSyntaxError('Invalid range');
      if (b.k !== 'ref' && b.k !== 'range') throw new FormulaSyntaxError('Invalid range');
      if (b.sheet && a.sheet && b.sheet.toLowerCase() !== a.sheet.toLowerCase()) throw new FormulaSyntaxError('Range spans sheets');
      const ar1 = a.k === 'ref' ? a.r : a.r1, ac1 = a.k === 'ref' ? a.c : a.c1;
      const ar2 = a.k === 'ref' ? a.r : a.r2, ac2 = a.k === 'ref' ? a.c : a.c2;
      const br1 = b.k === 'ref' ? b.r : b.r1, bc1 = b.k === 'ref' ? b.c : b.c1;
      const br2 = b.k === 'ref' ? b.r : b.r2, bc2 = b.k === 'ref' ? b.c : b.c2;
      a = { k: 'range', sheet: a.sheet, r1: Math.min(ar1, br1), c1: Math.min(ac1, bc1), r2: Math.max(ar2, br2), c2: Math.max(ac2, bc2) };
    }
    return a;
  };
  const constant = () => {
    const t = toks[p++];
    if (!t) throw new FormulaSyntaxError('Unexpected end');
    if (t.t === 'op' && t.v === '-') {
      const n = toks[p++];
      if (!n || n.t !== 'num') throw new FormulaSyntaxError('Bad array constant');
      return -n.v;
    }
    if (t.t === 'num' || t.t === 'str' || t.t === 'bool') return t.v;
    if (t.t === 'err') return errFromCode(t.v);
    throw new FormulaSyntaxError('Bad array constant');
  };
  const primary = () => {
    const t = toks[p++];
    if (!t) throw new FormulaSyntaxError('Unexpected end of formula');
    switch (t.t) {
      case 'num': return { k: 'num', v: t.v };
      case 'str': return { k: 'str', v: t.v };
      case 'bool': return { k: 'bool', v: t.v };
      case 'err': return { k: 'err', v: errFromCode(t.v) };
      case 'ref': return { k: 'ref', sheet: t.sheet, r: t.r, c: t.c };
      case 'cols': return { k: 'range', sheet: t.sheet, r1: 0, c1: Math.min(t.c1, t.c2), r2: Infinity, c2: Math.max(t.c1, t.c2), whole: 'col' };
      case 'rows': return { k: 'range', sheet: t.sheet, r1: Math.min(t.r1, t.r2), c1: 0, r2: Math.max(t.r1, t.r2), c2: Infinity, whole: 'row' };
      case 'name': return { k: 'name', name: t.name };
      case 'lp': {
        const e = comparison();
        expect('rp');
        return e;
      }
      case 'lb': {
        const rows = [[]];
        for (;;) {
          rows[rows.length - 1].push(constant());
          const s = toks[p++];
          if (!s) throw new FormulaSyntaxError('Unterminated array');
          if (s.t === 'rb') break;
          if (s.t === 'semi') rows.push([]);
          else if (s.t !== 'comma') throw new FormulaSyntaxError('Bad array constant');
        }
        if (rows.some((r) => r.length !== rows[0].length)) throw new FormulaSyntaxError('Ragged array');
        return { k: 'array', rows };
      }
      case 'func': {
        expect('lp');
        const args = [];
        if (peek() && peek().t === 'rp') { p++; return { k: 'fn', name: t.name, args }; }
        for (;;) {
          const nx = peek();
          if (nx && (nx.t === 'comma' || nx.t === 'semi' || nx.t === 'rp')) args.push({ k: 'missing' });
          else args.push(comparison());
          const s = toks[p++];
          if (!s) throw new FormulaSyntaxError('Missing )');
          if (s.t === 'rp') break;
          if (s.t !== 'comma' && s.t !== 'semi') throw new FormulaSyntaxError('Expected , or )');
        }
        return { k: 'fn', name: t.name, args };
      }
      default:
        throw new FormulaSyntaxError('Unexpected token');
    }
  };
  if (!toks.length) throw new FormulaSyntaxError('Empty formula');
  const ast = comparison();
  if (p < toks.length) throw new FormulaSyntaxError('Unexpected token after end of formula');
  return ast;
}

/* ---------- values ---------- */

export class RangeRef {
  constructor(sheet, r1, c1, r2, c2) {
    this.sheet = sheet; this.r1 = r1; this.c1 = c1; this.r2 = r2; this.c2 = c2;
  }
  get rows() { return this.r2 - this.r1 + 1; }
  get cols() { return this.c2 - this.c1 + 1; }
}
export class Matrix {
  constructor(data) { this.data = data; }
  get rows() { return this.data.length; }
  get cols() { return this.data[0] ? this.data[0].length : 0; }
}
const isArr = (v) => v instanceof RangeRef || v instanceof Matrix;
const isMulti = (v) => (v instanceof RangeRef && (v.r1 !== v.r2 || v.c1 !== v.c2)) || (v instanceof Matrix && (v.rows > 1 || v.cols > 1));

function at(v, i, j, x) {
  if (v instanceof RangeRef) return x.engine.value(v.sheet, v.r1 + i, v.c1 + j);
  if (v instanceof Matrix) return v.data[i] ? (v.data[i][j] === undefined ? null : v.data[i][j]) : null;
  return v;
}
function dims(v) {
  if (isArr(v)) return { rows: v.rows, cols: v.cols };
  return { rows: 1, cols: 1 };
}
function toMatrix(v, x) {
  if (v instanceof Matrix) return v;
  if (v instanceof RangeRef) {
    const out = [];
    for (let i = 0; i < v.rows; i++) {
      const row = [];
      for (let j = 0; j < v.cols; j++) row.push(x.engine.value(v.sheet, v.r1 + i, v.c1 + j));
      out.push(row);
    }
    return new Matrix(out);
  }
  return new Matrix([[v]]);
}

// Iterate every value (bounded to the used area for big ranges).
function eachValue(v, x, cb) {
  if (v instanceof RangeRef) {
    const b = v.sheet.bounds();
    const r2 = Math.min(v.r2, b.r);
    const c2 = Math.min(v.c2, b.c);
    for (let r = v.r1; r <= r2; r++) for (let c = v.c1; c <= c2; c++) cb(x.engine.value(v.sheet, r, c));
  } else if (v instanceof Matrix) {
    for (const row of v.data) for (const y of row) cb(y);
  } else cb(v);
}

function deref(v, x) {
  if (v instanceof RangeRef) {
    if (v.r1 === v.r2 && v.c1 === v.c2) return x.engine.value(v.sheet, v.r1, v.c1);
    if (v.c1 === v.c2 && x.r >= v.r1 && x.r <= v.r2) return x.engine.value(v.sheet, x.r, v.c1);
    if (v.r1 === v.r2 && x.c >= v.c1 && x.c <= v.c2) return x.engine.value(v.sheet, v.r1, x.c);
    return ERR.VALUE;
  }
  if (v instanceof Matrix) return v.rows ? v.data[0][0] : null;
  return v;
}
function scalar(v, x) {
  const s = deref(v, x);
  if (s instanceof FErr) throw s;
  return s;
}

export function toNum(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof FErr) throw v;
  if (typeof v === 'string') {
    const n = coerceNumber(v);
    if (n === null) throw ERR.VALUE;
    return n;
  }
  throw ERR.VALUE;
}
export function toStr(v) {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return numToText(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof FErr) throw v;
  return String(v);
}
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v === null || v === undefined) return false;
  if (v instanceof FErr) throw v;
  if (typeof v === 'string') {
    const u = v.toUpperCase();
    if (u === 'TRUE') return true;
    if (u === 'FALSE') return false;
  }
  throw ERR.VALUE;
}
const N = (v, x) => toNum(scalar(v, x));
const S = (v, x) => toStr(scalar(v, x));
const B = (v, x) => toBool(scalar(v, x));
const opt = (v) => v === undefined || v === null;

const typeRank = (v) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : 3);
function numEq(a, b) {
  if (a === b) return true;
  return Math.abs(a - b) <= 1e-15 * Math.max(Math.abs(a), Math.abs(b));
}
export function compareValues(a, b) {
  if (a === null || a === undefined) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if (b === null || b === undefined) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  const ta = typeRank(a);
  const tb = typeRank(b);
  if (ta !== tb) return ta < tb ? -1 : 1;
  if (typeof a === 'string') {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === 'boolean') return a === b ? 0 : a ? 1 : -1;
  if (numEq(a, b)) return 0;
  return a < b ? -1 : 1;
}

function scalarOp(op, a, b) {
  if (a instanceof FErr) throw a;
  if (b instanceof FErr) throw b;
  switch (op) {
    case '+': return toNum(a) + toNum(b);
    case '-': return toNum(a) - toNum(b);
    case '*': return toNum(a) * toNum(b);
    case '/': {
      const n = toNum(a);
      const d = toNum(b);
      if (d === 0) throw ERR.DIV0;
      return n / d;
    }
    case '^': {
      const r = Math.pow(toNum(a), toNum(b));
      if (!Number.isFinite(r)) throw ERR.NUM;
      return r;
    }
    case '&': return toStr(a) + toStr(b);
    case '=': return compareValues(a, b) === 0;
    case '<>': return compareValues(a, b) !== 0;
    case '<': return compareValues(a, b) < 0;
    case '>': return compareValues(a, b) > 0;
    case '<=': return compareValues(a, b) <= 0;
    case '>=': return compareValues(a, b) >= 0;
    default: throw ERR.VALUE;
  }
}

function elementwise(a, b, x, f) {
  const A = toMatrix(a, x);
  const Bm = toMatrix(b, x);
  const rows = Math.max(A.rows, Bm.rows);
  const cols = Math.max(A.cols, Bm.cols);
  const pick = (M, i, j) => {
    const ii = M.rows === 1 ? 0 : i;
    const jj = M.cols === 1 ? 0 : j;
    if (ii >= M.rows || jj >= M.cols) return ERR.NA;
    return M.data[ii][jj];
  };
  const out = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      try {
        row.push(f(pick(A, i, j), pick(Bm, i, j)));
      } catch (e) {
        if (e instanceof FErr) row.push(e);
        else throw e;
      }
    }
    out.push(row);
  }
  return new Matrix(out);
}

function resolveSheet(name, x) {
  if (!name) return x.sheet;
  const sh = x.engine.sheetByName(name);
  if (!sh) throw ERR.REF;
  return sh;
}

function ev(node, x) {
  switch (node.k) {
    case 'num': case 'str': case 'bool': return node.v;
    case 'err': return node.v;
    case 'missing': return null;
    case 'name': throw ERR.NAME;
    case 'ref': {
      const sh = resolveSheet(node.sheet, x);
      return new RangeRef(sh, node.r, node.c, node.r, node.c);
    }
    case 'range': {
      const sh = resolveSheet(node.sheet, x);
      const b = sh.bounds();
      const r2 = node.r2 === Infinity ? Math.max(node.r1, b.r) : node.r2;
      const c2 = node.c2 === Infinity ? Math.max(node.c1, b.c) : node.c2;
      return new RangeRef(sh, node.r1, node.c1, r2, c2);
    }
    case 'array': return new Matrix(node.rows.map((r) => r.slice()));
    case 'neg': {
      const v = ev(node.e, x);
      if (isMulti(v)) return elementwise(v, 0, x, (a) => -toNum(a));
      return -toNum(scalar(v, x));
    }
    case 'pct': {
      const v = ev(node.e, x);
      if (isMulti(v)) return elementwise(v, 0, x, (a) => toNum(a) / 100);
      return toNum(scalar(v, x)) / 100;
    }
    case 'bin': {
      const a = ev(node.a, x);
      const b = ev(node.b, x);
      if (isMulti(a) || isMulti(b)) return elementwise(a, b, x, (p, q) => scalarOp(node.op, p, q));
      return scalarOp(node.op, deref(a, x), deref(b, x));
    }
    case 'fn': {
      const fn = FUNCS[node.name];
      if (!fn) throw ERR.NAME;
      if (node.args.length < fn.min || (fn.max !== undefined && node.args.length > fn.max)) throw ERR.NA;
      if (fn.lazy) return fn.fn(node.args, x);
      const args = node.args.map((a) => evalSafe(a, x));
      return fn.fn(args, x);
    }
    default: throw ERR.VALUE;
  }
}
function evalSafe(node, x) {
  try {
    return ev(node, x);
  } catch (e) {
    if (e instanceof FErr) return e;
    throw e;
  }
}

/* ---------- engine ---------- */

export class Engine {
  constructor(wb) {
    this.wb = wb;
    this.calcId = 0;
  }
  sheetByName(name) {
    return this.wb.sheetByName(name);
  }
  compile(cell) {
    try {
      cell.ast = parse(cell.f);
    } catch (e) {
      cell.ast = null;
    }
  }
  recalc() {
    this.calcId++;
    this.now = nowSerial();
    for (const sh of this.wb.sheets) {
      for (const k of sh.formulaKeys()) {
        const cell = sh.cells.get(k);
        if (cell && cell.f !== undefined) this.evalCell(sh, cell, Math.floor(k / KEY_STRIDE), k % KEY_STRIDE);
      }
    }
  }
  value(sh, r, c) {
    const cell = sh.cells.get(r * KEY_STRIDE + c);
    if (!cell) return null;
    if (cell.f !== undefined) return this.evalCell(sh, cell, r, c);
    return cell.v === undefined ? null : cell.v;
  }
  evalCell(sh, cell, r, c) {
    if (cell.calc === this.calcId) return cell.cv;
    if (cell.busy) return ERR.CYCLE;
    cell.busy = true;
    let v;
    try {
      if (cell.ast === undefined) this.compile(cell);
      if (cell.ast === null) v = ERR.ERROR;
      else {
        const x = { engine: this, sheet: sh, r, c };
        v = deref(ev(cell.ast, x), x);
        if (v === null || v === undefined) v = 0;
        if (typeof v === 'number' && !Number.isFinite(v)) v = ERR.NUM;
      }
    } catch (e) {
      if (e instanceof FErr) v = e;
      else if (e instanceof RangeError) v = ERR.CYCLE;
      else v = ERR.VALUE;
    } finally {
      cell.busy = false;
    }
    if (v === ERR.NAME && cell.cached !== undefined) v = cell.cached;
    cell.cv = v;
    cell.calc = this.calcId;
    return v;
  }
  // Evaluate an ad-hoc formula (without '=') in the context of a cell.
  evaluate(src, sh, r = 0, c = 0) {
    try {
      const x = { engine: this, sheet: sh, r, c };
      const v = deref(ev(parse(src), x), x);
      return v === null ? 0 : v;
    } catch (e) {
      return e instanceof FErr ? e : ERR.ERROR;
    }
  }
}

// Default number format suggested by a formula's outermost function (TODAY() -> date etc.)
export function formatHint(ast) {
  if (!ast) return null;
  if (ast.k === 'fn') {
    if (['TODAY', 'DATE', 'EDATE', 'EOMONTH', 'DATEVALUE', 'WORKDAY'].includes(ast.name)) return 'yyyy-mm-dd';
    if (ast.name === 'NOW') return 'yyyy-mm-dd hh:mm';
    if (ast.name === 'TIME') return 'h:mm AM/PM';
  }
  if (ast.k === 'bin' && (ast.op === '+' || ast.op === '-')) {
    const a = formatHint(ast.a);
    const b = formatHint(ast.b);
    if (a && !b && ast.b.k !== 'fn') return a;
  }
  return null;
}

/* ---------- reference rewriting ---------- */

function sheetPrefix(name) {
  if (!name) return '';
  const plain = /^[A-Za-z_\u00C0-\uFFFF][\w.\u00C0-\uFFFF]*$/.test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name) && !/^(TRUE|FALSE)$/i.test(name);
  return (plain ? name : "'" + name.replace(/'/g, "''") + "'") + '!';
}
export const quoteSheet = sheetPrefix;

function refText(ref) {
  const cell = (r, c, ar, ac) => (ac ? '$' : '') + colName(c) + (ar ? '$' : '') + (r + 1);
  const pre = sheetPrefix(ref.sheet);
  switch (ref.kind) {
    case 'cell': return pre + cell(ref.r1, ref.c1, ref.ar1, ref.ac1);
    case 'range': return pre + cell(ref.r1, ref.c1, ref.ar1, ref.ac1) + ':' + cell(ref.r2, ref.c2, ref.ar2, ref.ac2);
    case 'cols': return pre + (ref.ac1 ? '$' : '') + colName(ref.c1) + ':' + (ref.ac2 ? '$' : '') + colName(ref.c2);
    case 'rows': return pre + (ref.ar1 ? '$' : '') + (ref.r1 + 1) + ':' + (ref.ar2 ? '$' : '') + (ref.r2 + 1);
    default: return '#REF!';
  }
}

// Enumerate references with their text spans (ranges joined).
export function scanRefs(src) {
  let toks;
  try {
    toks = tokenize(src);
  } catch (e) {
    return null;
  }
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === 'ref') {
      let k = i + 1;
      while (toks[k] && toks[k].t === 'ws') k++;
      if (toks[k] && toks[k].t === 'colon') {
        let k2 = k + 1;
        while (toks[k2] && toks[k2].t === 'ws') k2++;
        const u = toks[k2];
        if (u && u.t === 'ref' && (!u.sheet || (t.sheet && u.sheet.toLowerCase() === t.sheet.toLowerCase()))) {
          out.push({ kind: 'range', sheet: t.sheet, r1: t.r, c1: t.c, ar1: t.ra, ac1: t.ca, r2: u.r, c2: u.c, ar2: u.ra, ac2: u.ca, s: t.s, e: u.e });
          i = k2;
          continue;
        }
      }
      out.push({ kind: 'cell', sheet: t.sheet, r1: t.r, c1: t.c, ar1: t.ra, ac1: t.ca, s: t.s, e: t.e });
    } else if (t.t === 'cols') {
      out.push({ kind: 'cols', sheet: t.sheet, c1: t.c1, c2: t.c2, ac1: t.ca1, ac2: t.ca2, s: t.s, e: t.e });
    } else if (t.t === 'rows') {
      out.push({ kind: 'rows', sheet: t.sheet, r1: t.r1, r2: t.r2, ar1: t.ra1, ar2: t.ra2, s: t.s, e: t.e });
    }
  }
  return out;
}

// fn(ref) -> undefined (keep), null (#REF!) or a modified ref.
export function rewriteRefs(src, fn) {
  const refs = scanRefs(src);
  if (!refs || !refs.length) return src;
  let out = '';
  let last = 0;
  let changed = false;
  for (const ref of refs) {
    const res = fn({ ...ref });
    if (res === undefined) continue;
    changed = true;
    out += src.slice(last, ref.s) + (res === null ? '#REF!' : refText(normRef(res)));
    last = ref.e;
  }
  if (!changed) return src;
  return out + src.slice(last);
}

function normRef(ref) {
  if ((ref.kind === 'range' || ref.kind === 'rows') && ref.r1 > ref.r2) {
    [ref.r1, ref.r2] = [ref.r2, ref.r1];
    [ref.ar1, ref.ar2] = [ref.ar2, ref.ar1];
  }
  if ((ref.kind === 'range' || ref.kind === 'cols') && ref.c1 > ref.c2) {
    [ref.c1, ref.c2] = [ref.c2, ref.c1];
    [ref.ac1, ref.ac2] = [ref.ac2, ref.ac1];
  }
  return ref;
}

const outOfBounds = (ref) => ref.r1 < 0 || ref.c1 < 0 || ref.r1 >= MAX_ROWS || ref.c1 >= KEY_STRIDE ||
  ((ref.kind === 'range') && (ref.r2 < 0 || ref.c2 < 0 || ref.r2 >= MAX_ROWS || ref.c2 >= KEY_STRIDE));

// Copy semantics: relative parts move with the cell.
export function shiftFormula(src, dr, dc) {
  if (!dr && !dc) return src;
  return rewriteRefs(src, (ref) => {
    if (ref.kind === 'cell' || ref.kind === 'range') {
      let moved = false;
      if (!ref.ar1 && dr) { ref.r1 += dr; moved = true; }
      if (!ref.ac1 && dc) { ref.c1 += dc; moved = true; }
      if (ref.kind === 'range') {
        if (!ref.ar2 && dr) { ref.r2 += dr; moved = true; }
        if (!ref.ac2 && dc) { ref.c2 += dc; moved = true; }
      }
      if (!moved) return undefined;
      return outOfBounds(ref) ? null : ref;
    }
    if (ref.kind === 'cols' && dc) {
      if (!ref.ac1) ref.c1 += dc;
      if (!ref.ac2) ref.c2 += dc;
      return ref.c1 < 0 || ref.c2 < 0 ? null : ref;
    }
    if (ref.kind === 'rows' && dr) {
      if (!ref.ar1) ref.r1 += dr;
      if (!ref.ar2) ref.r2 += dr;
      return ref.r1 < 0 || ref.r2 < 0 ? null : ref;
    }
    return undefined;
  });
}

// Structural change on a sheet: axis 'row'|'col', insert count>0 at index, or delete -count items at index.
export function adjustFormula(src, isTarget, axis, index, count) {
  const R = axis === 'row';
  return rewriteRefs(src, (ref) => {
    if (!isTarget(ref.sheet)) return undefined;
    const k1 = R ? 'r1' : 'c1';
    const k2 = R ? 'r2' : 'c2';
    const whole = R ? ref.kind === 'cols' : ref.kind === 'rows';
    if (whole) return undefined;
    const single = ref.kind === 'cell';
    const a = ref[k1];
    const b = single ? a : ref[k2];
    let na;
    let nb;
    if (count > 0) {
      na = a >= index ? a + count : a;
      nb = b >= index ? b + count : b;
    } else {
      const n = -count;
      const end = index + n;
      if (single) {
        if (a >= index && a < end) return null;
        na = nb = a >= end ? a - n : a;
      } else {
        na = a < index ? a : a >= end ? a - n : index;
        nb = b < index ? b : b >= end ? b - n : index - 1;
        if (nb < na) return null;
      }
    }
    if (na === a && nb === b) return undefined;
    ref[k1] = na;
    if (!single) ref[k2] = nb;
    return ref;
  });
}

// Cut/paste: references pointing into the moved block follow it.
export function moveFormulaRefs(src, isTarget, g, dr, dc, targetName) {
  return rewriteRefs(src, (ref) => {
    if (!isTarget(ref.sheet)) return undefined;
    if (ref.kind === 'cell') {
      if (ref.r1 < g.r1 || ref.r1 > g.r2 || ref.c1 < g.c1 || ref.c1 > g.c2) return undefined;
      ref.r1 += dr; ref.c1 += dc;
    } else if (ref.kind === 'range') {
      if (ref.r1 < g.r1 || ref.r2 > g.r2 || ref.c1 < g.c1 || ref.c2 > g.c2) return undefined;
      ref.r1 += dr; ref.r2 += dr; ref.c1 += dc; ref.c2 += dc;
    } else return undefined;
    if (targetName !== undefined) ref.sheet = targetName;
    return outOfBounds(ref) ? null : ref;
  });
}

export function renameSheetRefs(src, oldName, newName) {
  const lo = oldName.toLowerCase();
  return rewriteRefs(src, (ref) => {
    if (!ref.sheet || ref.sheet.toLowerCase() !== lo) return undefined;
    ref.sheet = newName;
    return ref;
  });
}

export function deleteSheetRefs(src, name) {
  const lo = name.toLowerCase();
  return rewriteRefs(src, (ref) => (ref.sheet && ref.sheet.toLowerCase() === lo ? null : undefined));
}

// Newer functions carry the _xlfn. prefix inside .xlsx files.
const FUTURE_FNS = new Set(['CONCAT', 'TEXTJOIN', 'IFS', 'SWITCH', 'XOR', 'MAXIFS', 'MINIFS', 'XLOOKUP', 'STDEV.S', 'STDEV.P',
  'VAR.S', 'VAR.P', 'MODE.SNGL', 'RANK.EQ', 'PERCENTILE.INC', 'QUARTILE.INC', 'FORECAST.LINEAR', 'DAYS', 'IFNA',
  'FORMULATEXT', 'ISFORMULA', 'CEILING.MATH', 'FLOOR.MATH']);
export function toFileFormula(src) {
  let toks;
  try {
    toks = tokenize(src);
  } catch (e) {
    return src;
  }
  let out = '';
  let last = 0;
  for (const t of toks) {
    if (t.t === 'func' && FUTURE_FNS.has(t.name)) {
      out += src.slice(last, t.s) + '_xlfn.' + src.slice(t.s, t.e);
      last = t.e;
    }
  }
  return out + src.slice(last);
}
export const fromFileFormula = (src) => src.replace(/_xlfn\.|_xlws\./gi, '');

/* ---------- criteria & lookup helpers ---------- */

function wildcardRegex(pat) {
  let re = '';
  for (let i = 0; i < pat.length; i++) {
    const ch = pat[i];
    if (ch === '~' && i + 1 < pat.length) re += pat[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (ch === '*') re += '[\\s\\S]*';
    else if (ch === '?') re += '[\\s\\S]';
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$', 'i');
}

export function makeCriteria(crit) {
  if (crit instanceof FErr) return (v) => v === crit || (v instanceof FErr && v.code === crit.code);
  if (typeof crit === 'number') return (v) => (typeof v === 'number' && numEq(v, crit)) || (typeof v === 'string' && coerceNumber(v) === crit);
  if (typeof crit === 'boolean') return (v) => v === crit;
  let s = crit == null ? '' : String(crit);
  let op = '=';
  const m = /^(<=|>=|<>|=|<|>)([\s\S]*)$/.exec(s);
  if (m) { op = m[1]; s = m[2]; }
  const num = s.trim() === '' ? null : coerceNumber(s);
  if (op === '=' || op === '<>') {
    let pred;
    if (s === '') pred = (v) => v === null || v === '';
    else if (num !== null) pred = (v) => (typeof v === 'number' && numEq(v, num)) || (typeof v === 'string' && coerceNumber(v) === num);
    else if (/^(true|false)$/i.test(s)) { const bv = s.toLowerCase() === 'true'; pred = (v) => v === bv; }
    else if (/[*?]/.test(s)) { const re = wildcardRegex(s); pred = (v) => typeof v === 'string' && re.test(v); }
    else { const lo = s.toLowerCase(); pred = (v) => typeof v === 'string' && v.toLowerCase() === lo; }
    if (!m && s === '') return pred;
    return op === '=' ? pred : (v) => !pred(v);
  }
  const cmp = (c) => (op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0);
  if (num !== null) return (v) => typeof v === 'number' && cmp(compareValues(v, num));
  const lo = s.toLowerCase();
  return (v) => typeof v === 'string' && cmp(compareValues(v.toLowerCase(), lo));
}

function lookupEq(v, key, wildcard) {
  if (typeof key === 'string' && typeof v === 'string') {
    if (wildcard && /[*?]/.test(key)) return wildcardRegex(key).test(v);
    return v.toLowerCase() === key.toLowerCase();
  }
  if (typeof key === 'number' && typeof v === 'number') return numEq(v, key);
  return v === key;
}

function vector(v) {
  if (!isArr(v)) return { n: 1, get: () => v };
  const d = dims(v);
  if (d.rows !== 1 && d.cols !== 1) throw ERR.NA;
  return d.cols === 1 ? { n: d.rows, get: (i, x) => at(v, i, 0, x) } : { n: d.cols, get: (i, x) => at(v, 0, i, x) };
}

// Approximate match: last position whose value <= key (ascending data).
function approxIndex(vec, key, x, desc = false) {
  let found = -1;
  for (let i = 0; i < vec.n; i++) {
    const v = vec.get(i, x);
    if (v === null || typeRank(v) !== typeRank(key)) continue;
    const c = compareValues(v, key);
    if (c === 0) return i;
    if (!desc && c < 0) found = i;
    else if (desc && c > 0) found = i;
    else break;
  }
  return found;
}

/* ---------- function library ---------- */

export const FUNCS = {};
function def(names, cat, sig, desc, fn, o = {}) {
  const list = names.split('|');
  list.forEach((name, i) => {
    FUNCS[name] = { name, cat, sig, desc, fn, min: o.min ?? 0, max: o.max, lazy: !!o.lazy, alias: i > 0 };
  });
}

function nums(args, x) {
  const out = [];
  for (const a of args) {
    if (isArr(a)) {
      eachValue(a, x, (v) => {
        if (typeof v === 'number') out.push(v);
        else if (v instanceof FErr) throw v;
      });
    } else {
      if (a instanceof FErr) throw a;
      if (a === null) continue;
      out.push(toNum(a));
    }
  }
  return out;
}
function allValues(args, x) {
  const out = [];
  for (const a of args) {
    if (isArr(a)) eachValue(a, x, (v) => out.push(v));
    else out.push(a);
  }
  return out;
}
const sum = (xs) => xs.reduce((s, v) => s + v, 0);
const mean = (xs) => {
  if (!xs.length) throw ERR.DIV0;
  return sum(xs) / xs.length;
};
function variance(xs, sample) {
  const n = xs.length;
  if (n < (sample ? 2 : 1)) throw ERR.DIV0;
  const m = sum(xs) / n;
  let ss = 0;
  for (const v of xs) ss += (v - m) * (v - m);
  return ss / (n - (sample ? 1 : 0));
}
function median(xs) {
  if (!xs.length) throw ERR.NUM;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function percentileInc(xs, k) {
  if (!xs.length || k < 0 || k > 1) throw ERR.NUM;
  const s = [...xs].sort((a, b) => a - b);
  const pos = k * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, s.length - 1);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
function pairs(ys, xs, x) {
  const Y = toMatrix(ys, x);
  const X = toMatrix(xs, x);
  if (Y.rows * Y.cols !== X.rows * X.cols) throw ERR.NA;
  const a = [];
  const b = [];
  const fy = Y.data.flat();
  const fx = X.data.flat();
  for (let i = 0; i < fy.length; i++) {
    if (fy[i] instanceof FErr) throw fy[i];
    if (fx[i] instanceof FErr) throw fx[i];
    if (typeof fy[i] === 'number' && typeof fx[i] === 'number') { a.push(fy[i]); b.push(fx[i]); }
  }
  return [a, b];
}
function linreg(ys, xs) {
  if (ys.length < 2) throw ERR.DIV0;
  const my = mean(ys);
  const mx = mean(xs);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < ys.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) * (xs[i] - mx);
  }
  if (sxx === 0) throw ERR.DIV0;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

// Iterate criteria pairs (range, criteria) that must all have the shape of `shape`.
function critMatcher(args, from, x, shape) {
  const list = [];
  for (let i = from; i + 1 < args.length + 1 && i < args.length; i += 2) {
    const rg = args[i];
    if (!isArr(rg)) throw ERR.VALUE;
    const d = dims(rg);
    if (shape && (d.rows !== shape.rows || d.cols !== shape.cols)) throw ERR.VALUE;
    shape = shape || d;
    list.push({ rg, pred: makeCriteria(scalar(args[i + 1] === undefined ? null : args[i + 1], x)) });
  }
  return { shape, test: (i, j) => list.every((c) => c.pred(at(c.rg, i, j, x))) };
}
function ifsCollect(args, x, valueArg) {
  const target = args[valueArg];
  if (!isArr(target)) throw ERR.VALUE;
  const shape = dims(target);
  const m = critMatcher(args, valueArg === 0 ? 1 : 0, x, shape);
  const out = [];
  for (let i = 0; i < shape.rows; i++) {
    for (let j = 0; j < shape.cols; j++) {
      if (!m.test(i, j)) continue;
      const v = at(target, i, j, x);
      if (v instanceof FErr) throw v;
      if (typeof v === 'number') out.push(v);
    }
  }
  return out;
}
function ifCollect(args, x) {
  const rg = args[0];
  if (!isArr(rg)) throw ERR.VALUE;
  const pred = makeCriteria(scalar(args[1], x));
  const target = opt(args[2]) ? rg : args[2];
  const d = dims(rg);
  const out = [];
  for (let i = 0; i < d.rows; i++) {
    for (let j = 0; j < d.cols; j++) {
      if (!pred(at(rg, i, j, x))) continue;
      const v = target instanceof RangeRef ? x.engine.value(target.sheet, target.r1 + i, target.c1 + j) : at(target, i, j, x);
      if (v instanceof FErr) throw v;
      if (typeof v === 'number') out.push(v);
    }
  }
  return out;
}

const trunc = (v, d = 0) => {
  const p = Math.pow(10, d);
  return Math.trunc(fixFloat(v * p)) / p;
};

// Math
def('SUM', 'Math', 'number1, [number2], …', 'Adds all numbers in the arguments and ranges.', (a, x) => sum(nums(a, x)), { min: 1 });
def('PRODUCT', 'Math', 'number1, [number2], …', 'Multiplies all numbers together.', (a, x) => nums(a, x).reduce((p, v) => p * v, 1), { min: 1 });
def('SUMSQ', 'Math', 'number1, [number2], …', 'Sum of the squares of the arguments.', (a, x) => sum(nums(a, x).map((v) => v * v)), { min: 1 });
def('SUMIF', 'Math', 'range, criteria, [sum_range]', 'Adds the cells that meet a condition.', (a, x) => sum(ifCollect(a, x)), { min: 2, max: 3 });
def('SUMIFS', 'Math', 'sum_range, criteria_range1, criteria1, …', 'Adds the cells that meet several conditions.', (a, x) => sum(ifsCollect(a, x, 0)), { min: 3 });
def('SUMPRODUCT', 'Math', 'array1, [array2], …', 'Multiplies corresponding entries and returns the sum.', (a, x) => {
  const ms = a.map((v) => {
    if (v instanceof FErr) throw v;
    return toMatrix(v, x);
  });
  const { rows, cols } = ms[0];
  if (ms.some((m) => m.rows !== rows || m.cols !== cols)) throw ERR.VALUE;
  let s = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let p = 1;
      for (const m of ms) {
        const v = m.data[i][j];
        if (v instanceof FErr) throw v;
        p *= typeof v === 'number' ? v : typeof v === 'boolean' && ms.length === 1 ? 0 : 0;
      }
      s += p;
    }
  }
  return s;
}, { min: 1 });
def('ABS', 'Math', 'number', 'Absolute value of a number.', (a, x) => Math.abs(N(a[0], x)), { min: 1, max: 1 });
def('ROUND', 'Math', 'number, num_digits', 'Rounds a number to a given number of digits.', (a, x) => roundHalfAway(N(a[0], x), opt(a[1]) ? 0 : Math.trunc(N(a[1], x))), { min: 1, max: 2 });
def('ROUNDUP', 'Math', 'number, num_digits', 'Rounds a number away from zero.', (a, x) => {
  const v = N(a[0], x);
  const p = Math.pow(10, opt(a[1]) ? 0 : Math.trunc(N(a[1], x)));
  return Math.sign(v) * Math.ceil(fixFloat(Math.abs(v) * p)) / p;
}, { min: 1, max: 2 });
def('ROUNDDOWN', 'Math', 'number, num_digits', 'Rounds a number toward zero.', (a, x) => trunc(N(a[0], x), opt(a[1]) ? 0 : Math.trunc(N(a[1], x))), { min: 1, max: 2 });
def('TRUNC', 'Math', 'number, [num_digits]', 'Truncates a number to an integer or given digits.', (a, x) => trunc(N(a[0], x), opt(a[1]) ? 0 : Math.trunc(N(a[1], x))), { min: 1, max: 2 });
def('INT', 'Math', 'number', 'Rounds a number down to the nearest integer.', (a, x) => Math.floor(N(a[0], x)), { min: 1, max: 1 });
def('MOD', 'Math', 'number, divisor', 'Remainder after division (sign of the divisor).', (a, x) => {
  const n = N(a[0], x);
  const d = N(a[1], x);
  if (d === 0) throw ERR.DIV0;
  return fixFloat(n - d * Math.floor(n / d));
}, { min: 2, max: 2 });
def('QUOTIENT', 'Math', 'numerator, denominator', 'Integer portion of a division.', (a, x) => {
  const d = N(a[1], x);
  if (d === 0) throw ERR.DIV0;
  return Math.trunc(N(a[0], x) / d);
}, { min: 2, max: 2 });
def('POWER', 'Math', 'number, power', 'Raises a number to a power.', (a, x) => scalarOp('^', N(a[0], x), N(a[1], x)), { min: 2, max: 2 });
def('SQRT', 'Math', 'number', 'Positive square root.', (a, x) => {
  const v = N(a[0], x);
  if (v < 0) throw ERR.NUM;
  return Math.sqrt(v);
}, { min: 1, max: 1 });
def('EXP', 'Math', 'number', 'e raised to the power of a number.', (a, x) => Math.exp(N(a[0], x)), { min: 1, max: 1 });
def('LN', 'Math', 'number', 'Natural logarithm.', (a, x) => {
  const v = N(a[0], x);
  if (v <= 0) throw ERR.NUM;
  return Math.log(v);
}, { min: 1, max: 1 });
def('LOG', 'Math', 'number, [base]', 'Logarithm to a base (default 10).', (a, x) => {
  const v = N(a[0], x);
  const b = opt(a[1]) ? 10 : N(a[1], x);
  if (v <= 0 || b <= 0 || b === 1) throw ERR.NUM;
  return fixFloat(Math.log(v) / Math.log(b));
}, { min: 1, max: 2 });
def('LOG10', 'Math', 'number', 'Base-10 logarithm.', (a, x) => {
  const v = N(a[0], x);
  if (v <= 0) throw ERR.NUM;
  return Math.log10(v);
}, { min: 1, max: 1 });
def('PI', 'Math', '', 'The number π.', () => Math.PI, { max: 0 });
def('SIGN', 'Math', 'number', 'Sign of a number: 1, 0 or -1.', (a, x) => Math.sign(N(a[0], x)), { min: 1, max: 1 });
def('CEILING|CEILING.MATH', 'Math', 'number, [significance]', 'Rounds up to the nearest multiple of significance.', (a, x) => {
  const v = N(a[0], x);
  const s = opt(a[1]) ? 1 : N(a[1], x);
  if (s === 0) return 0;
  if (v > 0 && s < 0) throw ERR.NUM;
  return fixFloat(Math.ceil(fixFloat(v / s)) * s);
}, { min: 1, max: 3 });
def('FLOOR|FLOOR.MATH', 'Math', 'number, [significance]', 'Rounds down to the nearest multiple of significance.', (a, x) => {
  const v = N(a[0], x);
  const s = opt(a[1]) ? 1 : N(a[1], x);
  if (s === 0) throw ERR.DIV0;
  if (v > 0 && s < 0) throw ERR.NUM;
  return fixFloat(Math.floor(fixFloat(v / s)) * s);
}, { min: 1, max: 3 });
def('MROUND', 'Math', 'number, multiple', 'Rounds to the nearest multiple.', (a, x) => {
  const v = N(a[0], x);
  const m = N(a[1], x);
  if (m === 0) return 0;
  if (Math.sign(v) * Math.sign(m) < 0) throw ERR.NUM;
  return fixFloat(roundHalfAway(v / m) * m);
}, { min: 2, max: 2 });
def('EVEN', 'Math', 'number', 'Rounds away from zero to the nearest even integer.', (a, x) => {
  const v = N(a[0], x);
  const r = Math.ceil(Math.abs(v) / 2) * 2;
  return v < 0 ? -r : r;
}, { min: 1, max: 1 });
def('ODD', 'Math', 'number', 'Rounds away from zero to the nearest odd integer.', (a, x) => {
  const v = N(a[0], x);
  let r = Math.ceil(Math.abs(v));
  if (r % 2 === 0) r += 1;
  return v < 0 ? -r : r;
}, { min: 1, max: 1 });
def('FACT', 'Math', 'number', 'Factorial of a number.', (a, x) => {
  const v = Math.floor(N(a[0], x));
  if (v < 0) throw ERR.NUM;
  let p = 1;
  for (let i = 2; i <= v; i++) p *= i;
  return p;
}, { min: 1, max: 1 });
const gcd2 = (p, q) => (q ? gcd2(q, p % q) : p);
def('GCD', 'Math', 'number1, [number2], …', 'Greatest common divisor.', (a, x) => nums(a, x).map((v) => Math.floor(Math.abs(v))).reduce(gcd2), { min: 1 });
def('LCM', 'Math', 'number1, [number2], …', 'Least common multiple.', (a, x) => nums(a, x).map((v) => Math.floor(Math.abs(v))).reduce((p, q) => (p && q ? (p / gcd2(p, q)) * q : 0)), { min: 1 });
def('RAND', 'Math', '', 'Random number between 0 and 1 (recalculates).', () => Math.random(), { max: 0 });
def('RANDBETWEEN', 'Math', 'bottom, top', 'Random integer between two numbers.', (a, x) => {
  const lo = Math.ceil(N(a[0], x));
  const hi = Math.floor(N(a[1], x));
  if (hi < lo) throw ERR.NUM;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}, { min: 2, max: 2 });
def('DEGREES', 'Math', 'angle', 'Converts radians to degrees.', (a, x) => (N(a[0], x) * 180) / Math.PI, { min: 1, max: 1 });
def('RADIANS', 'Math', 'angle', 'Converts degrees to radians.', (a, x) => (N(a[0], x) * Math.PI) / 180, { min: 1, max: 1 });
for (const [nm, f, d] of [['SIN', Math.sin, 'Sine'], ['COS', Math.cos, 'Cosine'], ['TAN', Math.tan, 'Tangent'], ['ATAN', Math.atan, 'Arctangent']]) {
  def(nm, 'Math', 'number', `${d} of an angle in radians.`, (a, x) => fixFloat(f(N(a[0], x))), { min: 1, max: 1 });
}
def('ASIN', 'Math', 'number', 'Arcsine in radians.', (a, x) => {
  const v = N(a[0], x);
  if (v < -1 || v > 1) throw ERR.NUM;
  return Math.asin(v);
}, { min: 1, max: 1 });
def('ACOS', 'Math', 'number', 'Arccosine in radians.', (a, x) => {
  const v = N(a[0], x);
  if (v < -1 || v > 1) throw ERR.NUM;
  return Math.acos(v);
}, { min: 1, max: 1 });
def('ATAN2', 'Math', 'x_num, y_num', 'Arctangent from x and y coordinates.', (a, x) => {
  const xx = N(a[0], x);
  const yy = N(a[1], x);
  if (xx === 0 && yy === 0) throw ERR.DIV0;
  return Math.atan2(yy, xx);
}, { min: 2, max: 2 });

const SUBTOTAL_FNS = {
  1: (v) => mean(v), 2: (v) => v.length, 4: (v) => (v.length ? Math.max(...v) : 0), 5: (v) => (v.length ? Math.min(...v) : 0),
  6: (v) => v.reduce((p, q) => p * q, 1), 7: (v) => Math.sqrt(variance(v, true)), 8: (v) => Math.sqrt(variance(v, false)),
  9: (v) => sum(v), 10: (v) => variance(v, true), 11: (v) => variance(v, false),
};
def('SUBTOTAL', 'Math', 'function_num, ref1, [ref2], …', 'Aggregate that skips rows hidden by a filter (9 = SUM, 1 = AVERAGE, 4 = MAX …).', (a, x) => {
  const code = Math.trunc(N(a[0], x));
  const base = code > 100 ? code - 100 : code;
  if (!(base >= 1 && base <= 11)) throw ERR.VALUE;
  const vals = [];
  let counta = 0;
  for (const ref of a.slice(1)) {
    if (ref instanceof FErr) throw ref;
    if (!(ref instanceof RangeRef)) throw ERR.VALUE;
    const sh = ref.sheet;
    const b = sh.bounds();
    for (let r = ref.r1; r <= Math.min(ref.r2, b.r); r++) {
      if (sh.hidden.has(r)) continue;
      for (let c = ref.c1; c <= Math.min(ref.c2, b.c); c++) {
        const cell = sh.cells.get(r * KEY_STRIDE + c);
        if (!cell) continue;
        if (cell.ast && cell.ast.k === 'fn' && cell.ast.name === 'SUBTOTAL') continue;
        const v = x.engine.value(sh, r, c);
        if (v === null || v === undefined) continue;
        counta++;
        if (v instanceof FErr) throw v;
        if (typeof v === 'number') vals.push(v);
      }
    }
  }
  if (base === 3) return counta;
  return SUBTOTAL_FNS[base](vals);
}, { min: 2 });

// Statistical
def('AVERAGE', 'Statistical', 'number1, [number2], …', 'Arithmetic mean of the arguments.', (a, x) => mean(nums(a, x)), { min: 1 });
def('AVERAGEA', 'Statistical', 'value1, [value2], …', 'Mean counting text as 0 and TRUE as 1.', (a, x) => {
  const vs = allValues(a, x).filter((v) => v !== null).map((v) => {
    if (v instanceof FErr) throw v;
    return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : 0;
  });
  return mean(vs);
}, { min: 1 });
def('AVERAGEIF', 'Statistical', 'range, criteria, [average_range]', 'Average of the cells that meet a condition.', (a, x) => mean(ifCollect(a, x)), { min: 2, max: 3 });
def('AVERAGEIFS', 'Statistical', 'average_range, criteria_range1, criteria1, …', 'Average of cells that meet several conditions.', (a, x) => mean(ifsCollect(a, x, 0)), { min: 3 });
def('COUNT', 'Statistical', 'value1, [value2], …', 'Counts cells that contain numbers.', (a, x) => {
  let n = 0;
  for (const v of a) {
    if (isArr(v)) eachValue(v, x, (y) => { if (typeof y === 'number') n++; });
    else if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && coerceNumber(v) !== null)) n++;
  }
  return n;
}, { min: 1 });
def('COUNTA', 'Statistical', 'value1, [value2], …', 'Counts cells that are not empty.', (a, x) => allValues(a, x).filter((v) => v !== null && v !== undefined).length, { min: 1 });
def('COUNTBLANK', 'Statistical', 'range', 'Counts empty cells in a range.', (a, x) => {
  const rg = a[0];
  if (!isArr(rg)) throw ERR.VALUE;
  const d = dims(rg);
  let n = 0;
  for (let i = 0; i < d.rows; i++) for (let j = 0; j < d.cols; j++) { const v = at(rg, i, j, x); if (v === null || v === '') n++; }
  return n;
}, { min: 1, max: 1 });
def('COUNTIF', 'Statistical', 'range, criteria', 'Counts cells that meet a condition.', (a, x) => {
  const rg = a[0];
  if (!isArr(rg)) throw ERR.VALUE;
  const pred = makeCriteria(scalar(a[1], x));
  const d = dims(rg);
  let n = 0;
  for (let i = 0; i < d.rows; i++) for (let j = 0; j < d.cols; j++) if (pred(at(rg, i, j, x))) n++;
  return n;
}, { min: 2, max: 2 });
def('COUNTIFS', 'Statistical', 'criteria_range1, criteria1, …', 'Counts cells that meet several conditions.', (a, x) => {
  const m = critMatcher(a, 0, x, null);
  let n = 0;
  for (let i = 0; i < m.shape.rows; i++) for (let j = 0; j < m.shape.cols; j++) if (m.test(i, j)) n++;
  return n;
}, { min: 2 });
def('MAX', 'Statistical', 'number1, [number2], …', 'Largest value.', (a, x) => {
  const v = nums(a, x);
  return v.length ? Math.max(...v) : 0;
}, { min: 1 });
def('MIN', 'Statistical', 'number1, [number2], …', 'Smallest value.', (a, x) => {
  const v = nums(a, x);
  return v.length ? Math.min(...v) : 0;
}, { min: 1 });
def('MAXIFS', 'Statistical', 'max_range, criteria_range1, criteria1, …', 'Largest value among cells that meet conditions.', (a, x) => {
  const v = ifsCollect(a, x, 0);
  return v.length ? Math.max(...v) : 0;
}, { min: 3 });
def('MINIFS', 'Statistical', 'min_range, criteria_range1, criteria1, …', 'Smallest value among cells that meet conditions.', (a, x) => {
  const v = ifsCollect(a, x, 0);
  return v.length ? Math.min(...v) : 0;
}, { min: 3 });
def('MEDIAN', 'Statistical', 'number1, [number2], …', 'Middle value of the numbers.', (a, x) => median(nums(a, x)), { min: 1 });
def('MODE|MODE.SNGL', 'Statistical', 'number1, [number2], …', 'Most frequently occurring value.', (a, x) => {
  const counts = new Map();
  let best = null;
  let bestN = 1;
  for (const v of nums(a, x)) {
    const n = (counts.get(v) || 0) + 1;
    counts.set(v, n);
    if (n > bestN) { bestN = n; best = v; }
  }
  if (best === null) throw ERR.NA;
  return best;
}, { min: 1 });
def('STDEV|STDEV.S', 'Statistical', 'number1, [number2], …', 'Standard deviation of a sample.', (a, x) => Math.sqrt(variance(nums(a, x), true)), { min: 1 });
def('STDEVP|STDEV.P', 'Statistical', 'number1, [number2], …', 'Standard deviation of an entire population.', (a, x) => Math.sqrt(variance(nums(a, x), false)), { min: 1 });
def('VAR|VAR.S', 'Statistical', 'number1, [number2], …', 'Variance of a sample.', (a, x) => variance(nums(a, x), true), { min: 1 });
def('VARP|VAR.P', 'Statistical', 'number1, [number2], …', 'Variance of an entire population.', (a, x) => variance(nums(a, x), false), { min: 1 });
def('LARGE', 'Statistical', 'array, k', 'k-th largest value.', (a, x) => {
  const v = nums([a[0]], x).sort((p, q) => q - p);
  const k = Math.ceil(N(a[1], x));
  if (k < 1 || k > v.length) throw ERR.NUM;
  return v[k - 1];
}, { min: 2, max: 2 });
def('SMALL', 'Statistical', 'array, k', 'k-th smallest value.', (a, x) => {
  const v = nums([a[0]], x).sort((p, q) => p - q);
  const k = Math.ceil(N(a[1], x));
  if (k < 1 || k > v.length) throw ERR.NUM;
  return v[k - 1];
}, { min: 2, max: 2 });
def('RANK|RANK.EQ', 'Statistical', 'number, ref, [order]', 'Rank of a number in a list (0 = descending).', (a, x) => {
  const n = N(a[0], x);
  const v = nums([a[1]], x);
  const asc = !opt(a[2]) && N(a[2], x) !== 0;
  if (!v.some((y) => numEq(y, n))) throw ERR.NA;
  return 1 + v.filter((y) => (asc ? y < n : y > n) && !numEq(y, n)).length;
}, { min: 2, max: 3 });
def('PERCENTILE|PERCENTILE.INC', 'Statistical', 'array, k', 'k-th percentile (0..1), inclusive.', (a, x) => percentileInc(nums([a[0]], x), N(a[1], x)), { min: 2, max: 2 });
def('QUARTILE|QUARTILE.INC', 'Statistical', 'array, quart', 'Quartile 0..4 of a data set.', (a, x) => {
  const q = Math.trunc(N(a[1], x));
  if (q < 0 || q > 4) throw ERR.NUM;
  return percentileInc(nums([a[0]], x), q / 4);
}, { min: 2, max: 2 });
def('CORREL', 'Statistical', 'array1, array2', 'Correlation coefficient of two data sets.', (a, x) => {
  const [ys, xs] = pairs(a[0], a[1], x);
  if (ys.length < 2) throw ERR.DIV0;
  const my = mean(ys);
  const mx = mean(xs);
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < ys.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (!sxx || !syy) throw ERR.DIV0;
  return sxy / Math.sqrt(sxx * syy);
}, { min: 2, max: 2 });
def('SLOPE', 'Statistical', 'known_ys, known_xs', 'Slope of the linear regression line.', (a, x) => linreg(...pairs(a[0], a[1], x)).slope, { min: 2, max: 2 });
def('INTERCEPT', 'Statistical', 'known_ys, known_xs', 'Intercept of the linear regression line.', (a, x) => linreg(...pairs(a[0], a[1], x)).intercept, { min: 2, max: 2 });
def('FORECAST|FORECAST.LINEAR', 'Statistical', 'x, known_ys, known_xs', 'Predicts a value along a linear trend.', (a, x) => {
  const t = N(a[0], x);
  const { slope, intercept } = linreg(...pairs(a[1], a[2], x));
  return intercept + slope * t;
}, { min: 3, max: 3 });
def('GEOMEAN', 'Statistical', 'number1, [number2], …', 'Geometric mean.', (a, x) => {
  const v = nums(a, x);
  if (!v.length || v.some((y) => y <= 0)) throw ERR.NUM;
  return Math.exp(sum(v.map(Math.log)) / v.length);
}, { min: 1 });

// Logical
def('IF', 'Logical', 'logical_test, value_if_true, [value_if_false]', 'Returns one value if a condition is TRUE and another if FALSE.', (a, x) => {
  const c = toBool(scalar(ev(a[0], x), x));
  if (c) return a.length > 1 ? ev(a[1], x) : true;
  return a.length > 2 ? ev(a[2], x) : false;
}, { min: 1, max: 3, lazy: true });
def('IFS', 'Logical', 'test1, value1, [test2, value2], …', 'Returns the value for the first TRUE condition.', (a, x) => {
  for (let i = 0; i + 1 < a.length; i += 2) if (toBool(scalar(ev(a[i], x), x))) return ev(a[i + 1], x);
  throw ERR.NA;
}, { min: 2, lazy: true });
def('IFERROR', 'Logical', 'value, value_if_error', 'Returns a fallback when the value is an error.', (a, x) => {
  try {
    const v = ev(a[0], x);
    const s = isMulti(v) ? v : deref(v, x);
    if (s instanceof FErr) return ev(a[1], x);
    return s;
  } catch (e) {
    if (e instanceof FErr) return ev(a[1], x);
    throw e;
  }
}, { min: 2, max: 2, lazy: true });
def('IFNA', 'Logical', 'value, value_if_na', 'Returns a fallback when the value is #N/A.', (a, x) => {
  try {
    const v = deref(ev(a[0], x), x);
    if (v === ERR.NA) return ev(a[1], x);
    return v;
  } catch (e) {
    if (e === ERR.NA) return ev(a[1], x);
    throw e;
  }
}, { min: 2, max: 2, lazy: true });
function logicalValues(a, x) {
  const out = [];
  for (const v of a) {
    if (isArr(v)) eachValue(v, x, (y) => {
      if (y instanceof FErr) throw y;
      if (typeof y === 'boolean' || typeof y === 'number') out.push(toBool(y));
    });
    else if (v !== null) out.push(toBool(v));
  }
  if (!out.length) throw ERR.VALUE;
  return out;
}
def('AND', 'Logical', 'logical1, [logical2], …', 'TRUE when all arguments are TRUE.', (a, x) => logicalValues(a, x).every(Boolean), { min: 1 });
def('OR', 'Logical', 'logical1, [logical2], …', 'TRUE when any argument is TRUE.', (a, x) => logicalValues(a, x).some(Boolean), { min: 1 });
def('XOR', 'Logical', 'logical1, [logical2], …', 'TRUE when an odd number of arguments are TRUE.', (a, x) => logicalValues(a, x).filter(Boolean).length % 2 === 1, { min: 1 });
def('NOT', 'Logical', 'logical', 'Reverses a logical value.', (a, x) => !B(a[0], x), { min: 1, max: 1 });
def('TRUE', 'Logical', '', 'The logical value TRUE.', () => true, { max: 0 });
def('FALSE', 'Logical', '', 'The logical value FALSE.', () => false, { max: 0 });
def('SWITCH', 'Logical', 'expression, value1, result1, …, [default]', 'Matches an expression against a list of values.', (a, x) => {
  const v = scalar(ev(a[0], x), x);
  let i = 1;
  for (; i + 1 < a.length; i += 2) if (compareValues(v, scalar(ev(a[i], x), x)) === 0) return ev(a[i + 1], x);
  if (i < a.length) return ev(a[i], x);
  throw ERR.NA;
}, { min: 3, lazy: true });

// Text
def('CONCATENATE', 'Text', 'text1, [text2], …', 'Joins several text items into one.', (a, x) => a.map((v) => S(v, x)).join(''), { min: 1 });
def('CONCAT', 'Text', 'text1, [text2], …', 'Joins text items and ranges.', (a, x) => allValues(a, x).map(toStr).join(''), { min: 1 });
def('TEXTJOIN', 'Text', 'delimiter, ignore_empty, text1, …', 'Joins text with a delimiter.', (a, x) => {
  const d = S(a[0], x);
  const skip = B(a[1], x);
  return allValues(a.slice(2), x).map(toStr).filter((s) => !skip || s !== '').join(d);
}, { min: 3 });
def('LEFT', 'Text', 'text, [num_chars]', 'Leftmost characters of a text.', (a, x) => {
  const n = opt(a[1]) ? 1 : N(a[1], x);
  if (n < 0) throw ERR.VALUE;
  return S(a[0], x).slice(0, n);
}, { min: 1, max: 2 });
def('RIGHT', 'Text', 'text, [num_chars]', 'Rightmost characters of a text.', (a, x) => {
  const n = opt(a[1]) ? 1 : N(a[1], x);
  if (n < 0) throw ERR.VALUE;
  const s = S(a[0], x);
  return n ? s.slice(-n) : '';
}, { min: 1, max: 2 });
def('MID', 'Text', 'text, start_num, num_chars', 'Characters from the middle of a text.', (a, x) => {
  const st = N(a[1], x);
  const n = N(a[2], x);
  if (st < 1 || n < 0) throw ERR.VALUE;
  return S(a[0], x).substr(st - 1, n);
}, { min: 3, max: 3 });
def('LEN', 'Text', 'text', 'Number of characters in a text.', (a, x) => S(a[0], x).length, { min: 1, max: 1 });
def('UPPER', 'Text', 'text', 'Converts text to uppercase.', (a, x) => S(a[0], x).toUpperCase(), { min: 1, max: 1 });
def('LOWER', 'Text', 'text', 'Converts text to lowercase.', (a, x) => S(a[0], x).toLowerCase(), { min: 1, max: 1 });
def('PROPER', 'Text', 'text', 'Capitalizes the first letter of each word.', (a, x) => S(a[0], x).toLowerCase().replace(/(^|[^a-z\u00e0-\u024f])([a-z\u00e0-\u024f])/g, (m, p, c) => p + c.toUpperCase()), { min: 1, max: 1 });
def('TRIM', 'Text', 'text', 'Removes extra spaces.', (a, x) => S(a[0], x).replace(/^ +| +$/g, '').replace(/ {2,}/g, ' '), { min: 1, max: 1 });
def('SUBSTITUTE', 'Text', 'text, old_text, new_text, [instance_num]', 'Replaces existing text with new text.', (a, x) => {
  const s = S(a[0], x);
  const o = S(a[1], x);
  const n = S(a[2], x);
  if (!o) return s;
  if (opt(a[3])) return s.split(o).join(n);
  const k = N(a[3], x);
  if (k < 1) throw ERR.VALUE;
  let idx = -1;
  for (let i = 0; i < k; i++) {
    idx = s.indexOf(o, idx + 1);
    if (idx < 0) return s;
  }
  return s.slice(0, idx) + n + s.slice(idx + o.length);
}, { min: 3, max: 4 });
def('REPLACE', 'Text', 'old_text, start_num, num_chars, new_text', 'Replaces part of a text by position.', (a, x) => {
  const s = S(a[0], x);
  const st = N(a[1], x);
  const n = N(a[2], x);
  if (st < 1 || n < 0) throw ERR.VALUE;
  return s.slice(0, st - 1) + S(a[3], x) + s.slice(st - 1 + n);
}, { min: 4, max: 4 });
def('FIND', 'Text', 'find_text, within_text, [start_num]', 'Position of text within text (case-sensitive).', (a, x) => {
  const st = opt(a[2]) ? 1 : N(a[2], x);
  const i = S(a[1], x).indexOf(S(a[0], x), st - 1);
  if (st < 1 || i < 0) throw ERR.VALUE;
  return i + 1;
}, { min: 2, max: 3 });
def('SEARCH', 'Text', 'find_text, within_text, [start_num]', 'Position of text within text (wildcards, any case).', (a, x) => {
  const st = opt(a[2]) ? 1 : N(a[2], x);
  const within = S(a[1], x);
  const re = new RegExp(wildcardRegex(S(a[0], x)).source.slice(1, -1), 'i');
  const m = re.exec(within.slice(st - 1));
  if (st < 1 || !m) throw ERR.VALUE;
  return m.index + st;
}, { min: 2, max: 3 });
def('REPT', 'Text', 'text, number_times', 'Repeats text a number of times.', (a, x) => {
  const n = Math.floor(N(a[1], x));
  if (n < 0) throw ERR.VALUE;
  return S(a[0], x).repeat(Math.min(n, 32767));
}, { min: 2, max: 2 });
def('TEXT', 'Text', 'value, format_text', 'Formats a number as text with a format code.', (a, x) => {
  const v = scalar(a[0], x);
  const code = S(a[1], x);
  let n = v;
  if (typeof v === 'string') { const c = coerceNumber(v); if (c === null) return formatNumber(v, code).text; n = c; }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return formatNumber(toNum(n), code).text;
}, { min: 2, max: 2 });
def('VALUE', 'Text', 'text', 'Converts text that looks like a number into a number.', (a, x) => {
  const v = scalar(a[0], x);
  if (typeof v === 'number') return v;
  const n = coerceNumber(toStr(v));
  if (n === null) throw ERR.VALUE;
  return n;
}, { min: 1, max: 1 });
def('EXACT', 'Text', 'text1, text2', 'Checks whether two texts are identical (case-sensitive).', (a, x) => S(a[0], x) === S(a[1], x), { min: 2, max: 2 });
def('CHAR', 'Text', 'number', 'Character for a code number.', (a, x) => String.fromCharCode(N(a[0], x)), { min: 1, max: 1 });
def('CODE', 'Text', 'text', 'Code number of the first character.', (a, x) => {
  const s = S(a[0], x);
  if (!s) throw ERR.VALUE;
  return s.charCodeAt(0);
}, { min: 1, max: 1 });
def('T', 'Text', 'value', 'Returns the text if the value is text, otherwise "".', (a, x) => {
  const v = scalar(a[0], x);
  return typeof v === 'string' ? v : '';
}, { min: 1, max: 1 });
def('N', 'Info', 'value', 'Converts a value to a number (text becomes 0).', (a, x) => {
  const v = scalar(a[0], x);
  return typeof v === 'number' ? v : v === true ? 1 : 0;
}, { min: 1, max: 1 });

// Lookup & reference
def('VLOOKUP', 'Lookup', 'lookup_value, table_array, col_index_num, [range_lookup]', 'Looks up a value in the first column and returns a value in the same row.', (a, x) => {
  const key = scalar(a[0], x);
  const t = a[1];
  if (!isArr(t)) throw ERR.VALUE;
  const col = Math.trunc(N(a[2], x));
  const d = dims(t);
  if (col < 1) throw ERR.VALUE;
  if (col > d.cols) throw ERR.REF;
  const approx = opt(a[3]) ? true : B(a[3], x);
  const vec = { n: d.rows, get: (i) => at(t, i, 0, x) };
  let idx = -1;
  if (approx) idx = approxIndex(vec, key, x);
  else for (let i = 0; i < d.rows; i++) if (lookupEq(vec.get(i), key, true)) { idx = i; break; }
  if (idx < 0) throw ERR.NA;
  return at(t, idx, col - 1, x);
}, { min: 3, max: 4 });
def('HLOOKUP', 'Lookup', 'lookup_value, table_array, row_index_num, [range_lookup]', 'Looks up a value in the first row and returns a value in the same column.', (a, x) => {
  const key = scalar(a[0], x);
  const t = a[1];
  if (!isArr(t)) throw ERR.VALUE;
  const row = Math.trunc(N(a[2], x));
  const d = dims(t);
  if (row < 1) throw ERR.VALUE;
  if (row > d.rows) throw ERR.REF;
  const approx = opt(a[3]) ? true : B(a[3], x);
  const vec = { n: d.cols, get: (j) => at(t, 0, j, x) };
  let idx = -1;
  if (approx) idx = approxIndex(vec, key, x);
  else for (let j = 0; j < d.cols; j++) if (lookupEq(vec.get(j), key, true)) { idx = j; break; }
  if (idx < 0) throw ERR.NA;
  return at(t, row - 1, idx, x);
}, { min: 3, max: 4 });
def('XLOOKUP', 'Lookup', 'lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode]', 'Modern lookup: finds a value and returns the matching item.', (a, x) => {
  const key = scalar(a[0], x);
  const L = vector(a[1]);
  const R = a[2];
  const mode = opt(a[4]) ? 0 : Math.trunc(N(a[4], x));
  const rev = !opt(a[5]) && N(a[5], x) < 0;
  let idx = -1;
  const order = [...Array(L.n).keys()];
  if (rev) order.reverse();
  for (const i of order) if (lookupEq(L.get(i, x), key, mode === 2)) { idx = i; break; }
  if (idx < 0 && (mode === 1 || mode === -1)) {
    let best = null;
    for (let i = 0; i < L.n; i++) {
      const v = L.get(i, x);
      if (v === null || typeRank(v) !== typeRank(key)) continue;
      const c = compareValues(v, key);
      if ((mode === -1 && c < 0) || (mode === 1 && c > 0)) {
        if (best === null || (mode === -1 ? compareValues(v, best.v) > 0 : compareValues(v, best.v) < 0)) best = { i, v };
      }
    }
    if (best) idx = best.i;
  }
  if (idx < 0) {
    if (a.length > 3 && a[3] !== null) return scalar(a[3], x);
    throw ERR.NA;
  }
  const d = dims(R);
  const vertical = dims(a[1]).cols === 1 && dims(a[1]).rows > 1;
  return vertical ? at(R, Math.min(idx, d.rows - 1), 0, x) : at(R, 0, Math.min(idx, d.cols - 1), x);
}, { min: 3, max: 6 });
def('MATCH', 'Lookup', 'lookup_value, lookup_array, [match_type]', 'Relative position of an item in a range.', (a, x) => {
  const key = scalar(a[0], x);
  const vec = vector(a[1]);
  const type = opt(a[2]) ? 1 : Math.sign(N(a[2], x));
  let idx = -1;
  if (type === 0) {
    for (let i = 0; i < vec.n; i++) if (lookupEq(vec.get(i, x), key, true)) { idx = i; break; }
  } else idx = approxIndex(vec, key, x, type < 0);
  if (idx < 0) throw ERR.NA;
  return idx + 1;
}, { min: 2, max: 3 });
def('INDEX', 'Lookup', 'array, row_num, [column_num]', 'Value at a given row and column of a range.', (a, x) => {
  const A = a[0];
  if (A instanceof FErr) throw A;
  if (!isArr(A)) {
    if ((opt(a[1]) || N(a[1], x) <= 1) && (opt(a[2]) || N(a[2], x) <= 1)) return A;
    throw ERR.REF;
  }
  const d = dims(A);
  let r = opt(a[1]) ? 0 : Math.trunc(N(a[1], x));
  let c = opt(a[2]) ? 0 : Math.trunc(N(a[2], x));
  if (a.length === 2 && d.rows === 1) { c = r; r = 1; }
  if (c === 0 && d.cols === 1) c = 1;
  if (r === 0 && d.rows === 1) r = 1;
  if (r < 0 || c < 0 || r > d.rows || c > d.cols) throw ERR.REF;
  if (A instanceof RangeRef) {
    const r1 = r ? A.r1 + r - 1 : A.r1;
    const r2 = r ? r1 : A.r2;
    const c1 = c ? A.c1 + c - 1 : A.c1;
    const c2 = c ? c1 : A.c2;
    return new RangeRef(A.sheet, r1, c1, r2, c2);
  }
  if (!r || !c) throw ERR.VALUE;
  return A.data[r - 1][c - 1];
}, { min: 2, max: 3 });
def('CHOOSE', 'Lookup', 'index_num, value1, [value2], …', 'Chooses a value from a list by position.', (a, x) => {
  const i = Math.trunc(N(a[0], x));
  if (i < 1 || i >= a.length) throw ERR.VALUE;
  return a[i];
}, { min: 2 });
def('ROW', 'Lookup', '[reference]', 'Row number of a reference.', (a, x) => {
  if (opt(a[0])) return x.r + 1;
  if (!(a[0] instanceof RangeRef)) throw ERR.VALUE;
  return a[0].r1 + 1;
}, { max: 1 });
def('COLUMN', 'Lookup', '[reference]', 'Column number of a reference.', (a, x) => {
  if (opt(a[0])) return x.c + 1;
  if (!(a[0] instanceof RangeRef)) throw ERR.VALUE;
  return a[0].c1 + 1;
}, { max: 1 });
def('ROWS', 'Lookup', 'array', 'Number of rows in a reference.', (a) => {
  if (a[0] instanceof FErr) throw a[0];
  return dims(a[0]).rows;
}, { min: 1, max: 1 });
def('COLUMNS', 'Lookup', 'array', 'Number of columns in a reference.', (a) => {
  if (a[0] instanceof FErr) throw a[0];
  return dims(a[0]).cols;
}, { min: 1, max: 1 });
def('OFFSET', 'Lookup', 'reference, rows, cols, [height], [width]', 'Reference shifted from a starting cell.', (a, x) => {
  const ref = a[0];
  if (!(ref instanceof RangeRef)) throw ERR.VALUE;
  const r1 = ref.r1 + Math.trunc(N(a[1], x));
  const c1 = ref.c1 + Math.trunc(N(a[2], x));
  const hgt = opt(a[3]) ? ref.rows : Math.trunc(N(a[3], x));
  const wid = opt(a[4]) ? ref.cols : Math.trunc(N(a[4], x));
  if (r1 < 0 || c1 < 0 || hgt < 1 || wid < 1) throw ERR.REF;
  return new RangeRef(ref.sheet, r1, c1, r1 + hgt - 1, c1 + wid - 1);
}, { min: 3, max: 5 });
def('INDIRECT', 'Lookup', 'ref_text', 'Reference specified by a text string.', (a, x) => {
  const text = S(a[0], x);
  let ast;
  try {
    ast = parse(text);
  } catch (e) {
    throw ERR.REF;
  }
  if (ast.k !== 'ref' && ast.k !== 'range') throw ERR.REF;
  return ev(ast, x);
}, { min: 1, max: 2 });
def('FORMULATEXT', 'Lookup', 'reference', 'Formula in a cell as text.', (a) => {
  const ref = a[0];
  if (!(ref instanceof RangeRef)) throw ERR.NA;
  const cell = ref.sheet.cells.get(ref.r1 * KEY_STRIDE + ref.c1);
  if (!cell || cell.f === undefined) throw ERR.NA;
  return '=' + cell.f;
}, { min: 1, max: 1 });

// Date & time
const D = (v, x) => {
  const s = scalar(v, x);
  if (typeof s === 'string') {
    const p = parseDateLike(s.trim());
    if (p) return p.v;
  }
  return toNum(s);
};
def('TODAY', 'Date', '', "Today's date (recalculates).", (a, x) => Math.floor(x.engine.now ?? nowSerial()), { max: 0 });
def('NOW', 'Date', '', 'Current date and time (recalculates).', (a, x) => x.engine.now ?? nowSerial(), { max: 0 });
def('DATE', 'Date', 'year, month, day', 'Serial date from year, month and day.', (a, x) => {
  const v = dateToSerial(Math.trunc(N(a[0], x)), Math.trunc(N(a[1], x)), Math.trunc(N(a[2], x)));
  if (v < 0) throw ERR.NUM;
  return v;
}, { min: 3, max: 3 });
def('TIME', 'Date', 'hour, minute, second', 'Time as a fraction of a day.', (a, x) => {
  const t = (N(a[0], x) * 3600 + N(a[1], x) * 60 + N(a[2], x)) / 86400;
  return t - Math.floor(t);
}, { min: 3, max: 3 });
def('DATEVALUE', 'Date', 'date_text', 'Converts a date in text form to a serial date.', (a, x) => {
  const p = parseDateLike(S(a[0], x).trim());
  if (!p) throw ERR.VALUE;
  return Math.floor(p.v);
}, { min: 1, max: 1 });
def('YEAR', 'Date', 'serial_number', 'Year of a date.', (a, x) => serialToParts(D(a[0], x)).y, { min: 1, max: 1 });
def('MONTH', 'Date', 'serial_number', 'Month of a date (1-12).', (a, x) => serialToParts(D(a[0], x)).m, { min: 1, max: 1 });
def('DAY', 'Date', 'serial_number', 'Day of the month (1-31).', (a, x) => serialToParts(D(a[0], x)).d, { min: 1, max: 1 });
def('HOUR', 'Date', 'serial_number', 'Hour (0-23).', (a, x) => serialToParts(D(a[0], x)).H, { min: 1, max: 1 });
def('MINUTE', 'Date', 'serial_number', 'Minute (0-59).', (a, x) => serialToParts(D(a[0], x)).M, { min: 1, max: 1 });
def('SECOND', 'Date', 'serial_number', 'Second (0-59).', (a, x) => serialToParts(D(a[0], x)).S, { min: 1, max: 1 });
def('WEEKDAY', 'Date', 'serial_number, [return_type]', 'Day of the week (1 = Sunday by default).', (a, x) => {
  const wd = serialToParts(D(a[0], x)).wd;
  const type = opt(a[1]) ? 1 : Math.trunc(N(a[1], x));
  if (type === 1) return wd + 1;
  if (type === 2) return ((wd + 6) % 7) + 1;
  if (type === 3) return (wd + 6) % 7;
  throw ERR.NUM;
}, { min: 1, max: 2 });
function addMonths(serial, months) {
  const p = serialToParts(serial);
  const target = new Date(Date.UTC(p.y, p.m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return dateToSerial(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(p.d, last));
}
def('EDATE', 'Date', 'start_date, months', 'Date a number of months before or after a date.', (a, x) => addMonths(Math.floor(D(a[0], x)), Math.trunc(N(a[1], x))), { min: 2, max: 2 });
def('EOMONTH', 'Date', 'start_date, months', 'Last day of the month, months away.', (a, x) => {
  const p = serialToParts(Math.floor(D(a[0], x)));
  const dt = new Date(Date.UTC(p.y, p.m + Math.trunc(N(a[1], x)), 0));
  return dateToSerial(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}, { min: 2, max: 2 });
def('DAYS', 'Date', 'end_date, start_date', 'Number of days between two dates.', (a, x) => Math.floor(D(a[0], x)) - Math.floor(D(a[1], x)), { min: 2, max: 2 });
def('DATEDIF', 'Date', 'start_date, end_date, unit', 'Difference between dates in "Y", "M", "D", "MD", "YM" or "YD".', (a, x) => {
  const s = Math.floor(D(a[0], x));
  const e = Math.floor(D(a[1], x));
  if (e < s) throw ERR.NUM;
  const p = serialToParts(s);
  const q = serialToParts(e);
  const unit = S(a[2], x).toUpperCase();
  let months = (q.y - p.y) * 12 + (q.m - p.m);
  if (q.d < p.d) months--;
  switch (unit) {
    case 'D': return e - s;
    case 'M': return months;
    case 'Y': return Math.floor(months / 12);
    case 'YM': return months % 12;
    case 'MD': return e - addMonths(s, months);
    case 'YD': return e - addMonths(s, Math.floor(months / 12) * 12);
    default: throw ERR.NUM;
  }
}, { min: 3, max: 3 });
def('NETWORKDAYS', 'Date', 'start_date, end_date', 'Working days (Mon-Fri) between two dates.', (a, x) => {
  let s = Math.floor(D(a[0], x));
  let e = Math.floor(D(a[1], x));
  const sign = e < s ? -1 : 1;
  if (sign < 0) [s, e] = [e, s];
  let n = 0;
  for (let d = s; d <= e; d++) {
    const wd = serialToParts(d).wd;
    if (wd !== 0 && wd !== 6) n++;
  }
  return n * sign;
}, { min: 2, max: 3 });

// Information
def('ISBLANK', 'Info', 'value', 'TRUE if the cell is empty.', (a, x) => deref(a[0], x) === null, { min: 1, max: 1 });
def('ISNUMBER', 'Info', 'value', 'TRUE if the value is a number.', (a, x) => typeof deref(a[0], x) === 'number', { min: 1, max: 1 });
def('ISTEXT', 'Info', 'value', 'TRUE if the value is text.', (a, x) => typeof deref(a[0], x) === 'string', { min: 1, max: 1 });
def('ISLOGICAL', 'Info', 'value', 'TRUE if the value is TRUE or FALSE.', (a, x) => typeof deref(a[0], x) === 'boolean', { min: 1, max: 1 });
def('ISERROR', 'Info', 'value', 'TRUE if the value is any error.', (a, x) => deref(a[0], x) instanceof FErr, { min: 1, max: 1 });
def('ISERR', 'Info', 'value', 'TRUE for any error except #N/A.', (a, x) => {
  const v = deref(a[0], x);
  return v instanceof FErr && v !== ERR.NA;
}, { min: 1, max: 1 });
def('ISNA', 'Info', 'value', 'TRUE if the value is #N/A.', (a, x) => deref(a[0], x) === ERR.NA, { min: 1, max: 1 });
def('ISEVEN', 'Info', 'number', 'TRUE if the number is even.', (a, x) => Math.trunc(N(a[0], x)) % 2 === 0, { min: 1, max: 1 });
def('ISODD', 'Info', 'number', 'TRUE if the number is odd.', (a, x) => Math.abs(Math.trunc(N(a[0], x)) % 2) === 1, { min: 1, max: 1 });
def('ISFORMULA', 'Info', 'reference', 'TRUE if the cell contains a formula.', (a) => {
  const ref = a[0];
  if (!(ref instanceof RangeRef)) throw ERR.VALUE;
  const cell = ref.sheet.cells.get(ref.r1 * KEY_STRIDE + ref.c1);
  return !!cell && cell.f !== undefined;
}, { min: 1, max: 1 });
def('NA', 'Info', '', 'Returns the #N/A error.', () => { throw ERR.NA; }, { max: 0 });

export const CATEGORIES = ['Math', 'Statistical', 'Logical', 'Text', 'Lookup', 'Date', 'Info'];
const POPULAR = ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'IF', 'SUMIF', 'COUNTIF', 'VLOOKUP', 'ROUND', 'CONCAT', 'MEDIAN', 'STDEV', 'INDEX', 'MATCH', 'TODAY', 'IFERROR', 'AND', 'OR', 'TEXT', 'LEFT', 'LEN', 'XLOOKUP', 'SUBTOTAL', 'SUMPRODUCT'];
export function functionList() {
  return Object.values(FUNCS).sort((p, q) => {
    const a = POPULAR.indexOf(p.name);
    const b = POPULAR.indexOf(q.name);
    if (a >= 0 || b >= 0) return (a < 0 ? 999 : a) - (b < 0 ? 999 : b);
    return p.name < q.name ? -1 : 1;
  });
}

// Innermost unclosed function call before `pos` and the active argument index.
export function callContext(src, pos) {
  let toks;
  try {
    toks = tokenize(src.slice(0, pos));
  } catch (e) {
    return null;
  }
  const stack = [];
  for (const t of toks) {
    if (t.t === 'func') stack.push({ name: t.name, arg: 0, pending: true });
    else if (t.t === 'lp') {
      const top = stack[stack.length - 1];
      if (top && top.pending) top.pending = false;
      else stack.push({ name: null, arg: 0, pending: false });
    } else if (t.t === 'rp') stack.pop();
    else if ((t.t === 'comma' || t.t === 'semi') && stack.length) stack[stack.length - 1].arg++;
  }
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].name && !stack[i].pending) return stack[i];
  return null;
}

export { formatGeneral, refText as formatRef };

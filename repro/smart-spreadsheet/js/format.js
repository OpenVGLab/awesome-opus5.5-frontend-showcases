// Excel-style number format codes, date serials and typed-input detection.

export const MS_DAY = 86400000;
const EPOCH = Date.UTC(1899, 11, 30);
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Serial numbers follow Excel's 1900 system, including its phantom 1900-02-29 (serial 60).
export function dateToSerial(y, m, d) {
  if (y >= 0 && y < 1900) y += 1900;
  let days = (Date.UTC(y, m - 1, d) - EPOCH) / MS_DAY;
  if (days < 61) days -= 1;
  return days;
}

export function serialToParts(serial) {
  let days = Math.floor(serial);
  let t = Math.round((serial - days) * MS_DAY);
  if (t >= MS_DAY) {
    days += 1;
    t -= MS_DAY;
  }
  let y, m, d, wd;
  if (days === 60) {
    y = 1900; m = 2; d = 29; wd = 3;
  } else {
    const dt = new Date(EPOCH + (days < 60 ? days + 1 : days) * MS_DAY);
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate(); wd = dt.getUTCDay();
  }
  return { y, m, d, wd, H: Math.floor(t / 3600000), M: Math.floor(t / 60000) % 60, S: Math.floor(t / 1000) % 60, ms: t % 1000 };
}

export function nowSerial(date = new Date()) {
  const base = dateToSerial(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return base + (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86400;
}

export const fixFloat = (v) => (Number.isFinite(v) ? parseFloat(v.toPrecision(15)) : v);

// Round half away from zero on the decimal representation (so 1.005 -> 1.01).
export function roundHalfAway(n, d = 0) {
  if (!Number.isFinite(n)) return n;
  const a = Math.abs(n);
  if (a >= 1e15 || a === 0) return n;
  const r = Number(Math.round(Number(fixFloat(a) + 'e' + d)) + 'e' + -d);
  return n < 0 ? -r : r;
}

export function formatGeneral(n) {
  if (!Number.isFinite(n)) return '#NUM!';
  if (n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1e11 || a < 1e-9) {
    return n.toExponential(5).replace(/\.?0+e/, 'e').replace('e', 'E').replace(/E([+-])(\d)$/, 'E$10$2');
  }
  let s = String(parseFloat(n.toPrecision(10)));
  if (s.includes('e')) s = n.toFixed(Math.min(20, 9 - Math.floor(Math.log10(a)))).replace(/\.?0+$/, '');
  return s;
}

// Text form used by & and text functions (15 significant digits like Excel).
export function numToText(n) {
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return String(n);
  const s = String(parseFloat(n.toPrecision(15)));
  return s.includes('e') ? s.toUpperCase().replace(/E\+?/, (m) => (m === 'E+' ? 'E+' : 'E')) : s;
}

/* ---------- number format codes ---------- */

const NAMED_COLORS = {
  red: '#d92d20', green: '#15803d', blue: '#1d4ed8', black: '#111827', white: '#ffffff',
  yellow: '#ca8a04', magenta: '#c026d3', cyan: '#0891b2',
};

function splitSections(code) {
  const out = [];
  let cur = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '"') {
      const j = code.indexOf('"', i + 1);
      const end = j < 0 ? code.length : j + 1;
      cur += code.slice(i, end);
      i = end;
    } else if (ch === '\\' || ch === '_' || ch === '*') {
      cur += code.slice(i, i + 2);
      i += 2;
    } else if (ch === '[') {
      const j = code.indexOf(']', i);
      const end = j < 0 ? code.length : j + 1;
      cur += code.slice(i, end);
      i = end;
    } else if (ch === ';') {
      out.push(cur);
      cur = '';
      i++;
    } else {
      cur += ch;
      i++;
    }
  }
  out.push(cur);
  return out;
}

function parseSection(src) {
  const sec = { color: null, cond: null, toks: [], type: 'lit' };
  const toks = sec.toks;
  const lit = (s) => {
    const last = toks[toks.length - 1];
    if (last && last.t === 'lit') last.v += s;
    else toks.push({ t: 'lit', v: s });
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const rest = src.slice(i);
    let m;
    if (ch === '[') {
      const j = src.indexOf(']', i);
      const inner = src.slice(i + 1, j < 0 ? src.length : j);
      i = j < 0 ? src.length : j + 1;
      if (NAMED_COLORS[inner.toLowerCase()]) sec.color = NAMED_COLORS[inner.toLowerCase()];
      else if ((m = /^(<=|>=|<>|<|>|=)\s*(-?[\d.]+)$/.exec(inner))) sec.cond = { op: m[1], v: parseFloat(m[2]) };
      else if ((m = /^\$([^-]*)/.exec(inner))) { if (m[1]) lit(m[1]); }
      else if (/^(h+|m+|s+)$/i.test(inner)) toks.push({ t: 'elapsed', v: inner[0].toLowerCase(), n: inner.length });
      continue;
    }
    if (ch === '"') {
      const j = src.indexOf('"', i + 1);
      const end = j < 0 ? src.length : j;
      lit(src.slice(i + 1, end));
      i = end + 1;
      continue;
    }
    if (ch === '\\') { lit(src[i + 1] || ''); i += 2; continue; }
    if (ch === '_') { lit(' '); i += 2; continue; }
    if (ch === '*') { i += 2; continue; }
    if (ch === '@') { toks.push({ t: 'text' }); i++; continue; }
    if (/^general/i.test(rest)) { toks.push({ t: 'gen' }); i += 7; continue; }
    if ((m = /^(AM\/PM|am\/pm|A\/P|a\/p)/.exec(rest))) { toks.push({ t: 'ampm', v: m[0] }); i += m[0].length; continue; }
    if ((ch === 'E' || ch === 'e') && (src[i + 1] === '+' || src[i + 1] === '-')) { toks.push({ t: 'exp', sign: src[i + 1] }); i += 2; continue; }
    if ((m = /^(y+|m+|d+|h+|s+)/i.exec(rest))) { toks.push({ t: 'date', v: m[0].toLowerCase() }); i += m[0].length; continue; }
    if (ch === '0' || ch === '#' || ch === '?') { toks.push({ t: 'dig', v: ch }); i++; continue; }
    if (ch === '.') { toks.push({ t: 'dot' }); i++; continue; }
    if (ch === ',') { toks.push({ t: 'comma' }); i++; continue; }
    if (ch === '%') { toks.push({ t: 'pct' }); i++; continue; }
    lit(ch);
    i++;
  }
  if (toks.some((t) => t.t === 'date' || t.t === 'ampm' || t.t === 'elapsed')) sec.type = 'date';
  else if (toks.some((t) => t.t === 'dig')) sec.type = 'num';
  else if (toks.some((t) => t.t === 'gen')) sec.type = 'gen';
  else if (toks.some((t) => t.t === 'text')) sec.type = 'text';
  if (sec.type === 'num') compileNumber(sec);
  return sec;
}

function compileNumber(sec) {
  const toks = sec.toks;
  let first = -1;
  let last = -1;
  toks.forEach((t, i) => {
    if (t.t === 'dig') {
      if (first < 0) first = i;
      last = i;
    }
  });
  const blk = { minInt: 0, decMin: 0, decMax: 0, thousands: false, scale: 0, hasDot: false, exp: null, expDigits: 0, pct: 0 };
  let inDec = false;
  let inExp = false;
  let sawIntDigit = false;
  for (let i = first; i <= last; i++) {
    const t = toks[i];
    if (t.t === 'dig') {
      if (inExp) blk.expDigits++;
      else if (inDec) {
        blk.decMax++;
        if (t.v === '0') blk.decMin = blk.decMax;
      } else {
        sawIntDigit = true;
        if (t.v === '0') blk.minInt++;
      }
    } else if (t.t === 'dot' && !inExp) {
      inDec = true;
      blk.hasDot = true;
    } else if (t.t === 'comma' && !inDec && !inExp && sawIntDigit) {
      blk.thousands = true;
    } else if (t.t === 'exp') {
      inExp = true;
      blk.exp = t.sign;
    }
  }
  // commas right after the last digit scale by 1000 each
  let j = last + 1;
  while (toks[j] && toks[j].t === 'comma') {
    blk.scale++;
    j++;
  }
  if (toks[j] && toks[j].t === 'dot' && !blk.hasDot) blk.hasDot = true;
  blk.pct = toks.filter((t) => t.t === 'pct').length;
  sec.blk = blk;
  sec.first = first;
  sec.last = last;
  sec.afterScale = j;
}

function fmtNumberBlock(n, blk) {
  if (blk.exp) {
    let e = n === 0 ? 0 : Math.floor(Math.log10(n));
    let mant = n / Math.pow(10, e);
    let ms = roundHalfAway(mant, blk.decMax);
    if (ms >= 10) {
      e += 1;
      ms = roundHalfAway(n / Math.pow(10, e), blk.decMax);
    }
    let s = ms.toFixed(blk.decMax);
    const es = String(Math.abs(e)).padStart(Math.max(1, blk.expDigits), '0');
    return s + 'E' + (e < 0 ? '-' : blk.exp === '+' ? '+' : '') + es;
  }
  const r = roundHalfAway(n, blk.decMax);
  let s = Math.abs(r) >= 1e21 ? r.toLocaleString('en-US', { useGrouping: false }) : r.toFixed(blk.decMax);
  let [ip, dp = ''] = s.split('.');
  while (dp.length > blk.decMin && dp.endsWith('0')) dp = dp.slice(0, -1);
  if (ip === '0' && blk.minInt === 0) ip = '';
  ip = ip.padStart(blk.minInt, '0');
  if (blk.thousands) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return ip + (blk.hasDot && (dp.length || blk.decMax === 0) ? '.' + dp : blk.hasDot && blk.decMax > 0 ? '.' : '');
}

function fmtNumSection(v, sec, neg) {
  const blk = sec.blk;
  let n = v * Math.pow(100, blk.pct) / Math.pow(1000, blk.scale);
  const body = fmtNumberBlock(n, blk);
  let out = '';
  sec.toks.forEach((t, i) => {
    if (i === sec.first) out += body;
    if (i >= sec.first && i < sec.afterScale) return;
    if (t.t === 'lit') out += t.v;
    else if (t.t === 'pct') out += '%';
    else if (t.t === 'gen') out += formatGeneral(n);
  });
  if (neg && /[1-9]/.test(body)) out = '-' + out;
  return out;
}

function fmtDateSection(serial, sec) {
  if (serial < 0) return '#'.repeat(8);
  const p = serialToParts(serial);
  const toks = sec.toks;
  const hasAmPm = toks.some((t) => t.t === 'ampm');
  const dateIdx = toks.map((t, i) => (t.t === 'date' ? i : -1)).filter((i) => i >= 0);
  const isMinute = (i) => {
    const k = dateIdx.indexOf(i);
    const prev = k > 0 ? toks[dateIdx[k - 1]].v : '';
    const next = k < dateIdx.length - 1 ? toks[dateIdx[k + 1]].v : '';
    return prev[0] === 'h' || next[0] === 's';
  };
  const pad = (x, n = 2) => String(x).padStart(n, '0');
  let out = '';
  toks.forEach((t, i) => {
    switch (t.t) {
      case 'lit': out += t.v; break;
      case 'dot': out += '.'; break;
      case 'comma': out += ','; break;
      case 'dig': out += t.v === '0' ? '0' : ''; break;
      case 'pct': out += '%'; break;
      case 'elapsed': {
        const total = serial * (t.v === 'h' ? 24 : t.v === 'm' ? 1440 : 86400);
        out += pad(Math.floor(total), t.n);
        break;
      }
      case 'ampm': {
        const pm = p.H >= 12;
        out += t.v.length > 3 ? (pm ? 'PM' : 'AM') : (pm ? 'P' : 'A');
        break;
      }
      case 'date': {
        const v = t.v;
        const c = v[0];
        if (c === 'y') out += v.length <= 2 ? pad(p.y % 100) : String(p.y);
        else if (c === 'm' && v.length <= 2 && isMinute(i)) out += v.length === 2 ? pad(p.M) : p.M;
        else if (c === 'm') out += v.length === 1 ? p.m : v.length === 2 ? pad(p.m) : v.length === 3 ? MONTHS[p.m - 1].slice(0, 3) : v.length === 5 ? MONTHS[p.m - 1][0] : MONTHS[p.m - 1];
        else if (c === 'd') out += v.length === 1 ? p.d : v.length === 2 ? pad(p.d) : v.length === 3 ? DAYS[p.wd].slice(0, 3) : DAYS[p.wd];
        else if (c === 'h') {
          let hh = p.H;
          if (hasAmPm) hh = hh % 12 || 12;
          out += v.length >= 2 ? pad(hh) : hh;
        } else if (c === 's') out += v.length >= 2 ? pad(p.S) : p.S;
        break;
      }
      default: break;
    }
  });
  return out;
}

function condMatch(cond, v) {
  switch (cond.op) {
    case '<': return v < cond.v;
    case '<=': return v <= cond.v;
    case '>': return v > cond.v;
    case '>=': return v >= cond.v;
    case '=': return v === cond.v;
    case '<>': return v !== cond.v;
    default: return false;
  }
}

function compileFormat(code) {
  if (!code || /^general$/i.test(code)) return (v) => (typeof v === 'number' ? { text: formatGeneral(v) } : { text: String(v) });
  const secs = splitSections(code).map(parseSection);
  const textSec = secs[3] || secs.find((s) => s.type === 'text');
  const fn = (v) => {
    if (typeof v !== 'number') {
      if (!textSec) return { text: String(v) };
      let out = '';
      for (const t of textSec.toks) out += t.t === 'text' ? String(v) : t.t === 'lit' ? t.v : '';
      return { text: out, color: textSec.color };
    }
    let sec;
    let x = v;
    let neg = false;
    if (secs.some((s) => s.cond)) {
      sec = secs.find((s) => s.cond && condMatch(s.cond, v)) || secs.find((s) => !s.cond && s.type !== 'text') || secs[0];
      if (v < 0) { x = -v; neg = !sec.cond || sec.cond.op === '>' || sec.cond.op === '>='; }
    } else if (v > 0 || (v === 0 && (secs.length < 3 || secs[2].type === 'text'))) sec = secs[0];
    else if (v < 0) {
      if (secs.length >= 2 && secs[1].type !== 'text' && secs[1].toks.length) {
        sec = secs[1];
        x = -v;
      } else {
        sec = secs[0];
        x = -v;
        neg = true;
      }
    } else sec = secs[2];
    let text;
    if (sec.type === 'date') text = fmtDateSection(v, sec);
    else if (sec.type === 'num') text = fmtNumSection(x, sec, neg);
    else if (sec.type === 'gen') {
      text = '';
      for (const t of sec.toks) text += t.t === 'gen' ? formatGeneral(x) : t.t === 'lit' ? t.v : '';
      if (neg) text = '-' + text;
    } else {
      text = sec.toks.map((t) => (t.t === 'lit' ? t.v : '')).join('');
    }
    return { text, color: sec.color };
  };
  fn.isDate = secs[0].type === 'date';
  fn.isPercent = secs[0].type === 'num' && secs[0].blk.pct > 0;
  fn.decimals = secs[0].type === 'num' ? secs[0].blk.decMax : 0;
  fn.isText = secs[0].type === 'text';
  return fn;
}

const fmtCache = new Map();
function compiled(code) {
  const key = code || 'General';
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = compileFormat(key);
    } catch (e) {
      f = compileFormat('General');
    }
    fmtCache.set(key, f);
  }
  return f;
}

export function formatNumber(v, code) {
  return compiled(code)(v);
}
export const isDateFormat = (code) => !!code && compiled(code).isDate;
export const isPercentFormat = (code) => !!code && compiled(code).isPercent;
export const isTextFormat = (code) => !!code && compiled(code).isText;
export const formatDecimals = (code) => (code ? compiled(code).decimals : 0);

// Adjust the number of decimals in a format code (toolbar .0 / .00 buttons).
export function adjustDecimals(code, delta, sample) {
  if (!code || /^general$/i.test(code)) {
    let d = 0;
    if (typeof sample === 'number' && !Number.isInteger(sample)) {
      const s = formatGeneral(sample);
      d = s.includes('.') && !s.includes('E') ? s.split('.')[1].length : 0;
    }
    d = Math.max(0, d + delta);
    return d ? '0.' + '0'.repeat(d) : '0';
  }
  if (isDateFormat(code)) return code;
  return splitSections(code).map((sec) => {
    const m = /(0|#)(\.([0#]*))?(?=[^0#.]*$)/.exec(sec.replace(/"[^"]*"/g, (q) => q.replace(/[0#.]/g, ' ')));
    if (!m) return sec;
    const decs = m[3] || '';
    const n = Math.max(0, decs.length + delta);
    const start = m.index;
    const end = m.index + m[0].length;
    return sec.slice(0, start) + m[1] + (n ? '.' + '0'.repeat(n) : '') + sec.slice(end);
  }).join(';');
}

/* ---------- typed input detection ---------- */

const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3).toLowerCase());

function validDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function parseNumberLike(t) {
  let m;
  if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(t)) return { v: parseFloat(t) };
  if ((m = /^([+-])?(\d{1,3}(?:,\d{3})+)(\.\d+)?$/.exec(t))) {
    const v = parseFloat(t.replace(/,/g, ''));
    const dec = m[3] ? m[3].length - 1 : 0;
    return { v, nf: dec ? '#,##0.' + '0'.repeat(dec) : '#,##0' };
  }
  if ((m = /^(-)?([$€£¥])\s?(-)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/.exec(t))) {
    const v = parseFloat((m[4] + (m[5] || '')).replace(/,/g, '')) * (m[1] || m[3] ? -1 : 1);
    const dec = m[5] ? m[5].length - 1 : 0;
    const sym = m[2] === '$' ? '$' : `"${m[2]}"`;
    return { v, nf: sym + (dec ? '#,##0.' + '0'.repeat(dec) : '#,##0') };
  }
  if ((m = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s?%$/.exec(t))) {
    const dec = (m[1].split('.')[1] || '').length;
    return { v: fixFloat(parseFloat(m[1]) / 100), nf: dec ? '0.' + '0'.repeat(dec) + '%' : '0%' };
  }
  return null;
}

export function parseDateLike(t) {
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t))) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (!validDate(y, mo, d)) return null;
    let v = dateToSerial(y, mo, d);
    if (m[4] !== undefined) {
      v += (+m[4] * 3600 + +m[5] * 60 + +(m[6] || 0)) / 86400;
      return { v, nf: 'yyyy-mm-dd hh:mm' };
    }
    return { v, nf: 'yyyy-mm-dd' };
  }
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) {
    const [mo, d, y] = [+m[1], +m[2], +m[3]];
    if (!validDate(y, mo, d)) return null;
    return { v: dateToSerial(y, mo, d), nf: 'm/d/yyyy' };
  }
  if ((m = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/.exec(t))) {
    const mo = MONTH_ABBR.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    if (mo < 1 || !validDate(+m[3], mo, +m[2])) return null;
    return { v: dateToSerial(+m[3], mo, +m[2]), nf: 'mmm d, yyyy' };
  }
  if ((m = /^(\d{1,2}) ([A-Za-z]{3,9})\.? (\d{4})$/.exec(t))) {
    const mo = MONTH_ABBR.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    if (mo < 1 || !validDate(+m[3], mo, +m[1])) return null;
    return { v: dateToSerial(+m[3], mo, +m[1]), nf: 'd mmm yyyy' };
  }
  if ((m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?$/i.exec(t))) {
    let hh = +m[1];
    const mm = +m[2];
    const ss = +(m[3] || 0);
    if (mm > 59 || ss > 59) return null;
    if (m[4]) {
      if (hh < 1 || hh > 12) return null;
      hh = (hh % 12) + (m[4].toLowerCase() === 'pm' ? 12 : 0);
    } else if (hh > 23) return null;
    return { v: (hh * 3600 + mm * 60 + ss) / 86400, nf: m[4] ? 'h:mm AM/PM' : m[3] ? 'h:mm:ss' : 'h:mm' };
  }
  return null;
}

// Typed text -> { f } (formula) | { v, nf? }
export function parseInput(text) {
  if (text == null) return { v: null };
  const s = String(text);
  if (s === '') return { v: null };
  if (s[0] === '=' && s.length > 1) return { f: s.slice(1) };
  if (s[0] === "'") return { v: s.slice(1) };
  const t = s.trim();
  if (!t) return { v: s };
  if (/^(true|false)$/i.test(t)) return { v: t.toLowerCase() === 'true' };
  return parseNumberLike(t) || parseDateLike(t) || { v: s };
}

// String -> number for arithmetic coercion ("1,200", "15%", "$3", "2026-01-31")
export function coerceNumber(s) {
  const t = String(s).trim();
  if (!t) return null;
  const r = parseNumberLike(t) || parseDateLike(t);
  return r ? r.v : null;
}

// Editable text for a stored cell (what the formula bar shows).
export function inputText(cell) {
  if (!cell) return '';
  if (cell.f !== undefined) return '=' + cell.f;
  const v = cell.v;
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    const nf = cell.s && cell.s.nf;
    if (nf && isDateFormat(nf)) {
      const hasDate = /[yd]/i.test(nf.replace(/"[^"]*"/g, '')) || /m{3,}/i.test(nf);
      const frac = v % 1 !== 0;
      if (!hasDate && v < 1) return formatNumber(v, 'h:mm:ss').text;
      return formatNumber(v, frac ? 'yyyy-mm-dd hh:mm:ss' : 'yyyy-mm-dd').text;
    }
    if (nf && isPercentFormat(nf)) return numToText(fixFloat(v * 100)) + '%';
    return numToText(v);
  }
  return String(v);
}

// Named presets for the number-format menu.
export const NUMBER_FORMATS = [
  { id: 'General', label: 'General', code: 'General', sample: 1234.5 },
  { id: 'number', label: 'Number', code: '#,##0.00', sample: 1234.5 },
  { id: 'integer', label: 'Integer', code: '#,##0', sample: 1234.5 },
  { id: 'currency', label: 'Currency', code: '$#,##0.00', sample: 1234.5 },
  { id: 'currency0', label: 'Currency (rounded)', code: '$#,##0', sample: 1234.5 },
  { id: 'percent', label: 'Percent', code: '0.0%', sample: 0.1234 },
  { id: 'scientific', label: 'Scientific', code: '0.00E+00', sample: 1234.5 },
  { id: 'date', label: 'Date', code: 'yyyy-mm-dd', sample: 46289 },
  { id: 'datelong', label: 'Long date', code: 'mmmm d, yyyy', sample: 46289 },
  { id: 'time', label: 'Time', code: 'h:mm AM/PM', sample: 0.6042 },
  { id: 'datetime', label: 'Date time', code: 'yyyy-mm-dd hh:mm', sample: 46289.6042 },
  { id: 'text', label: 'Plain text', code: '@', sample: 'Text' },
];

export function formatLabel(code) {
  if (!code || /^general$/i.test(code)) return 'General';
  if (code === '@') return 'Text';
  if (isDateFormat(code)) return /[hs]/i.test(code.replace(/"[^"]*"/g, '')) ? (/[yd]/i.test(code) ? 'Date time' : 'Time') : 'Date';
  if (isPercentFormat(code)) return 'Percent';
  if (/[$€£¥]/.test(code)) return 'Currency';
  if (/E[+-]/i.test(code)) return 'Scientific';
  return 'Number';
}

// Office Open XML (.xlsx) reader/writer plus CSV helpers.
// Round-trips values, formulas (incl. shared formulas), styles, number formats, merges,
// column widths, row heights, frozen panes and AutoFilter ranges.
import { zip, unzip } from './zip.js';
import { colName, colIndex, keyRow, keyCol, parseRange } from './util.js';
import { Workbook, Sheet, makeCell, putCell, writeInput, displayText, detectHeader, DEF_COL_W } from './model.js';
import { FErr, errFromCode, toFileFormula, fromFileFormula, shiftFormula, quoteSheet } from './formula.js';
import { isDateFormat, dateToSerial } from './format.js';

const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

const esc = (s) => String(s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex6 = (c) => (c || '#000000').replace('#', '').toUpperCase().padStart(6, '0').slice(0, 6);
const pxToWidth = (px) => Math.max(0.5, Math.round(((px - 5) / 7) * 100) / 100);
const widthToPx = (w) => Math.round(w * 7 + 5);
const numText = (v) => (Number.isFinite(v) ? String(v) : '0');

/* ---------- export ---------- */

const BUILTIN_FMTS = { General: 0, '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10, '0.00E+00': 11, '@': 49 };

class StyleTable {
  constructor() {
    this.fonts = [this.fontXml({})];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.numFmts = new Map();
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.cache = new Map();
  }
  fontXml(s) {
    return '<font>' + (s.b ? '<b/>' : '') + (s.i ? '<i/>' : '') + (s.st ? '<strike/>' : '') + (s.u ? '<u/>' : '') +
      `<sz val="${s.fs || 10}"/><color rgb="FF${hex6(s.fc || '#1F2937')}"/><name val="Calibri"/><family val="2"/></font>`;
  }
  index(list, xml) {
    let i = list.indexOf(xml);
    if (i < 0) { i = list.length; list.push(xml); }
    return i;
  }
  id(s) {
    if (!s) return 0;
    const key = JSON.stringify(s);
    if (this.cache.has(key)) return this.cache.get(key);
    const fontId = s.b || s.i || s.u || s.st || s.fs || s.fc ? this.index(this.fonts, this.fontXml(s)) : 0;
    const fillId = s.bg ? this.index(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${hex6(s.bg)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    let borderId = 0;
    if (s.bd && (s.bd.l || s.bd.r || s.bd.t || s.bd.b)) {
      const side = (tag, v) => {
        if (!v) return `<${tag}/>`;
        const [color, w] = String(v).split('|');
        return `<${tag} style="${w === '2' ? 'medium' : 'thin'}"><color rgb="FF${hex6(color)}"/></${tag}>`;
      };
      borderId = this.index(this.borders, '<border>' + side('left', s.bd.l) + side('right', s.bd.r) + side('top', s.bd.t) + side('bottom', s.bd.b) + '<diagonal/></border>');
    }
    let numFmtId = 0;
    if (s.nf && s.nf !== 'General') {
      if (BUILTIN_FMTS[s.nf] !== undefined) numFmtId = BUILTIN_FMTS[s.nf];
      else {
        if (!this.numFmts.has(s.nf)) this.numFmts.set(s.nf, 164 + this.numFmts.size);
        numFmtId = this.numFmts.get(s.nf);
      }
    }
    const H = { left: 'left', center: 'center', right: 'right' }[s.ha];
    const V = { top: 'top', middle: 'center', bottom: 'bottom' }[s.va];
    const align = H || V || s.wrap ? `<alignment${H ? ` horizontal="${H}"` : ''}${V ? ` vertical="${V}"` : ''}${s.wrap ? ' wrapText="1"' : ''}/>` : '';
    const xf = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
      (numFmtId ? ' applyNumberFormat="1"' : '') + (fontId ? ' applyFont="1"' : '') + (fillId ? ' applyFill="1"' : '') +
      (borderId ? ' applyBorder="1"' : '') + (align ? ' applyAlignment="1">' + align + '</xf>' : '/>');
    const id = this.index(this.xfs, xf);
    this.cache.set(key, id);
    return id;
  }
  xml() {
    const nf = this.numFmts.size
      ? `<numFmts count="${this.numFmts.size}">${[...this.numFmts].map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`).join('')}</numFmts>`
      : '';
    return XML_HEAD + `<styleSheet xmlns="${MAIN}">${nf}` +
      `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join('')}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>';
  }
}

class StringTable {
  constructor() { this.list = []; this.map = new Map(); this.count = 0; }
  id(s) {
    this.count++;
    let i = this.map.get(s);
    if (i === undefined) { i = this.list.length; this.list.push(s); this.map.set(s, i); }
    return i;
  }
  xml() {
    const si = this.list.map((s) => {
      const keep = /^\s|\s$|\n/.test(s) ? ' xml:space="preserve"' : '';
      return `<si><t${keep}>${esc(s)}</t></si>`;
    }).join('');
    return XML_HEAD + `<sst xmlns="${MAIN}" count="${this.count}" uniqueCount="${this.list.length}">${si}</sst>`;
  }
}

const FILE_ERRORS = new Set(['#DIV/0!', '#N/A', '#NAME?', '#NULL!', '#NUM!', '#REF!', '#VALUE!']);

function cellXml(cell, r, c, styles, sst) {
  const ref = colName(c) + (r + 1);
  const sid = styles.id(cell.s);
  const sa = sid ? ` s="${sid}"` : '';
  if (cell.f !== undefined && cell.ast !== null) {
    const v = cell.cv;
    let t = '';
    let vx = '';
    if (typeof v === 'number') vx = `<v>${numText(v)}</v>`;
    else if (typeof v === 'string') { t = ' t="str"'; vx = `<v>${esc(v)}</v>`; }
    else if (typeof v === 'boolean') { t = ' t="b"'; vx = `<v>${v ? 1 : 0}</v>`; }
    else if (v instanceof FErr) { t = ' t="e"'; vx = `<v>${FILE_ERRORS.has(v.code) ? v.code : '#VALUE!'}</v>`; }
    return `<c r="${ref}"${sa}${t}><f>${esc(toFileFormula(cell.f))}</f>${vx}</c>`;
  }
  const v = cell.f !== undefined ? '=' + cell.f : cell.v;
  if (v === null || v === undefined || v === '') return sid ? `<c r="${ref}"${sa}/>` : '';
  if (typeof v === 'number') return `<c r="${ref}"${sa}><v>${numText(v)}</v></c>`;
  if (typeof v === 'boolean') return `<c r="${ref}"${sa} t="b"><v>${v ? 1 : 0}</v></c>`;
  return `<c r="${ref}"${sa} t="s"><v>${sst.id(String(v))}</v></c>`;
}

const CUSTOM_OPS = { gt: 'greaterThan', gte: 'greaterThanOrEqual', lt: 'lessThan', lte: 'lessThanOrEqual', eq: 'equal', neq: 'notEqual' };
function filterColumnXml(colId, cr) {
  if (cr.values) {
    const blank = cr.values.includes('');
    return `<filterColumn colId="${colId}"><filters${blank ? ' blank="1"' : ''}>${cr.values.filter((v) => v !== '').map((v) => `<filter val="${esc(v)}"/>`).join('')}</filters></filterColumn>`;
  }
  const c = cr.cond;
  if (!c) return '';
  const cf = (op, val) => `<customFilter${op ? ` operator="${op}"` : ''} val="${esc(val)}"/>`;
  if (CUSTOM_OPS[c.op]) return `<filterColumn colId="${colId}"><customFilters>${cf(CUSTOM_OPS[c.op], c.a)}</customFilters></filterColumn>`;
  if (c.op === 'between') return `<filterColumn colId="${colId}"><customFilters and="1">${cf('greaterThanOrEqual', Math.min(c.a, c.b))}${cf('lessThanOrEqual', Math.max(c.a, c.b))}</customFilters></filterColumn>`;
  if (c.op === 'contains') return `<filterColumn colId="${colId}"><customFilters>${cf(null, `*${c.a}*`)}</customFilters></filterColumn>`;
  if (c.op === 'notContains') return `<filterColumn colId="${colId}"><customFilters>${cf('notEqual', `*${c.a}*`)}</customFilters></filterColumn>`;
  if (c.op === 'begins') return `<filterColumn colId="${colId}"><customFilters>${cf(null, `${c.a}*`)}</customFilters></filterColumn>`;
  if (c.op === 'ends') return `<filterColumn colId="${colId}"><customFilters>${cf(null, `*${c.a}`)}</customFilters></filterColumn>`;
  if (c.op === 'top' || c.op === 'bottom') return `<filterColumn colId="${colId}"><top10${c.op === 'top' ? '' : ' top="0"'} val="${Math.max(1, Number(c.a) || 10)}"/></filterColumn>`;
  if (c.op === 'aboveAvg' || c.op === 'belowAvg') return `<filterColumn colId="${colId}"><dynamicFilter type="${c.op === 'aboveAvg' ? 'aboveAverage' : 'belowAverage'}"/></filterColumn>`;
  return '';
}

function sheetXml(wb, sh, index, styles, sst) {
  const b = sh.bounds();
  const byRow = new Map();
  const keys = [...sh.cells.keys()].sort((p, q) => p - q);
  for (const k of keys) {
    const r = keyRow(k);
    const xml = cellXml(sh.cells.get(k), r, keyCol(k), styles, sst);
    if (!xml) continue;
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r).push(xml);
  }
  const rowSet = new Set([...byRow.keys(), ...Object.keys(sh.rowH).map(Number), ...sh.hidden]);
  const rows = [...rowSet].sort((p, q) => p - q).map((r) => {
    const h = sh.rowH[r];
    const attrs = (h !== undefined ? ` ht="${Math.round(h * 0.75 * 100) / 100}" customHeight="1"` : '') + (sh.hidden.has(r) ? ' hidden="1"' : '');
    const cells = byRow.get(r);
    return cells ? `<row r="${r + 1}"${attrs}>${cells.join('')}</row>` : `<row r="${r + 1}"${attrs}/>`;
  }).join('');
  const lastR = Math.max(0, b.r);
  const lastC = Math.max(0, b.c);
  const dim = b.r < 0 ? 'A1' : `A1:${colName(lastC)}${lastR + 1}`;
  const fr = sh.freeze.r;
  const fc = sh.freeze.c;
  const pane = fr || fc
    ? `<pane${fc ? ` xSplit="${fc}"` : ''}${fr ? ` ySplit="${fr}"` : ''} topLeftCell="${colName(fc)}${fr + 1}" activePane="${fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight'}" state="frozen"/>`
    : '';
  const view = `<sheetViews><sheetView workbookViewId="0"${index === wb.active ? ' tabSelected="1"' : ''}${sh.showGrid ? '' : ' showGridLines="0"'}>${pane}</sheetView></sheetViews>`;
  const colKeys = Object.keys(sh.colW).map(Number).sort((p, q) => p - q);
  const cols = colKeys.length ? `<cols>${colKeys.map((c) => `<col min="${c + 1}" max="${c + 1}" width="${pxToWidth(sh.colW[c])}" customWidth="1"/>`).join('')}</cols>` : '';
  let filter = '';
  if (sh.filter) {
    const f = sh.filter;
    const colsXml = Object.entries(f.crit || {}).filter(([, cr]) => cr && (cr.values || cr.cond)).map(([c, cr]) => filterColumnXml(+c - f.c1, cr)).join('');
    filter = `<autoFilter ref="${colName(f.c1)}${f.r1 + 1}:${colName(f.c2)}${f.r2 + 1}">${colsXml}</autoFilter>`;
  }
  const merges = sh.merges.length
    ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${colName(m.c1)}${m.r1 + 1}:${colName(m.c2)}${m.r2 + 1}"/>`).join('')}</mergeCells>`
    : '';
  return XML_HEAD + `<worksheet xmlns="${MAIN}" xmlns:r="${NS_R}"><dimension ref="${dim}"/>${view}` +
    `<sheetFormatPr defaultColWidth="${pxToWidth(DEF_COL_W)}" defaultRowHeight="18" customHeight="1"/>${cols}` +
    `<sheetData>${rows}</sheetData>${filter}${merges}` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';
}

export async function exportXlsx(wb) {
  const styles = new StyleTable();
  const sst = new StringTable();
  const sheets = wb.sheets.map((sh, i) => sheetXml(wb, sh, i, styles, sst));
  const n = wb.sheets.length;
  const iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const names = wb.sheets.map((sh, i) => (sh.filter
    ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${esc(quoteSheet(sh.name).replace(/^([^']*)!$/, "'$1'!"))}$${colName(sh.filter.c1)}$${sh.filter.r1 + 1}:$${colName(sh.filter.c2)}$${sh.filter.r2 + 1}</definedName>`
    : '')).join('');
  const files = [
    {
      name: '[Content_Types].xml',
      data: XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        wb.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      data: XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'docProps/core.xml',
      data: XML_HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        `<dc:title>${esc(wb.title)}</dc:title><dc:creator>Cellwise</dc:creator>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`,
    },
    {
      name: 'docProps/app.xml',
      data: XML_HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Cellwise Smart Spreadsheet</Application></Properties>',
    },
    {
      name: 'xl/workbook.xml',
      data: XML_HEAD + `<workbook xmlns="${MAIN}" xmlns:r="${NS_R}"><workbookPr/>` +
        `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000" activeTab="${wb.active}"/></bookViews>` +
        `<sheets>${wb.sheets.map((sh, i) => `<sheet name="${esc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
        (names ? `<definedNames>${names}</definedNames>` : '') +
        '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        wb.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${n + 1}" Type="${NS_R}/styles" Target="styles.xml"/>` +
        `<Relationship Id="rId${n + 2}" Type="${NS_R}/sharedStrings" Target="sharedStrings.xml"/>` +
        '</Relationships>',
    },
    ...sheets.map((data, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data })),
    { name: 'xl/styles.xml', data: styles.xml() },
    { name: 'xl/sharedStrings.xml', data: sst.xml() },
  ];
  return zip(files);
}

/* ---------- import ---------- */

const INDEXED = ('000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF ' +
  '800000 008000 000080 808000 800080 008080 C0C0C0 808080 9999FF 993366 FFFFCC CCFFFF 660066 FF8080 0066CC CCCCFF ' +
  '000080 FF00FF FFFF00 00FFFF 800080 800000 008080 0000FF 00CCFF CCFFFF CCFFCC FFFF99 99CCFF FF99CC CC99FF FFCC99 ' +
  '3366FF 33CCCC 99CC00 FFCC00 FF9900 FF6600 666699 969696 003366 339966 003300 333300 993300 993366 333399 333333').split(' ');
const DEFAULT_THEME = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '0563C1', '954F72'];

const kids = (el, name) => (el ? [...el.children].filter((c) => c.localName === name) : []);
const kid = (el, name) => (el ? [...el.children].find((c) => c.localName === name) || null : null);
const all = (doc, name) => (doc ? [...doc.getElementsByTagNameNS('*', name)] : []);

function rgbToHsl(h) {
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh / 6, s, l];
}
function hslToHex(h, s, l) {
  const f = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r;
  let g;
  let b;
  if (s === 0) r = g = b = l;
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
  }
  return [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function colorOf(el, theme) {
  if (!el) return null;
  if (el.getAttribute('auto') === '1') return null;
  let hex = null;
  const rgb = el.getAttribute('rgb');
  if (rgb) hex = rgb.length === 8 ? rgb.slice(2) : rgb.slice(-6);
  else if (el.getAttribute('theme') !== null) hex = theme[+el.getAttribute('theme')] || null;
  else if (el.getAttribute('indexed') !== null) hex = INDEXED[+el.getAttribute('indexed')] || null;
  if (!hex) return null;
  const tint = parseFloat(el.getAttribute('tint') || '0');
  if (tint) {
    const [h, s, l] = rgbToHsl(hex);
    hex = hslToHex(h, s, tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint);
  }
  return '#' + hex.toUpperCase();
}

function parseTheme(doc) {
  const scheme = all(doc, 'clrScheme')[0];
  if (!scheme) return DEFAULT_THEME;
  const get = (name) => {
    const el = kid(scheme, name);
    if (!el) return null;
    const c = el.firstElementChild;
    if (!c) return null;
    return (c.getAttribute('val') && c.localName === 'srgbClr' ? c.getAttribute('val') : c.getAttribute('lastClr')) || null;
  };
  const order = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  return order.map((n, i) => get(n) || DEFAULT_THEME[i]);
}

const BUILTIN_CODES = {
  0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 5: '$#,##0;($#,##0)', 6: '$#,##0;[Red]($#,##0)',
  7: '$#,##0.00;($#,##0.00)', 8: '$#,##0.00;[Red]($#,##0.00)', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??',
  14: 'yyyy-mm-dd', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss',
  22: 'yyyy-mm-dd h:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)',
  45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 48: '##0.0E+0', 49: '@',
};

function parseStyles(doc, theme) {
  const numFmts = {};
  for (const el of all(doc, 'numFmt')) numFmts[el.getAttribute('numFmtId')] = el.getAttribute('formatCode');
  const fontsEl = all(doc, 'fonts')[0];
  const fonts = kids(fontsEl, 'font').map((f) => {
    const flag = (n) => {
      const e = kid(f, n);
      return !!e && e.getAttribute('val') !== '0' && e.getAttribute('val') !== 'false' && e.getAttribute('val') !== 'none';
    };
    const sz = kid(f, 'sz');
    return { b: flag('b'), i: flag('i'), u: flag('u'), st: flag('strike'), sz: sz ? parseFloat(sz.getAttribute('val')) : null, color: colorOf(kid(f, 'color'), theme) };
  });
  const fills = kids(all(doc, 'fills')[0], 'fill').map((f) => {
    const p = kid(f, 'patternFill');
    if (!p) return null;
    const type = p.getAttribute('patternType');
    if (!type || type === 'none' || type === 'gray125') return null;
    return colorOf(kid(p, 'fgColor'), theme) || colorOf(kid(p, 'bgColor'), theme);
  });
  const borders = kids(all(doc, 'borders')[0], 'border').map((b) => {
    const side = (n) => {
      const e = kid(b, n);
      if (!e || !e.getAttribute('style') || e.getAttribute('style') === 'none') return undefined;
      const col = colorOf(kid(e, 'color'), theme) || '#475569';
      return /medium|thick|double/.test(e.getAttribute('style')) ? col + '|2' : col;
    };
    const bd = { l: side('left'), r: side('right'), t: side('top'), b: side('bottom') };
    return bd.l || bd.r || bd.t || bd.b ? bd : null;
  });
  const xfs = kids(all(doc, 'cellXfs')[0], 'xf');
  const defSize = fonts[0] && fonts[0].sz ? fonts[0].sz : 11;
  const defColor = fonts[0] ? fonts[0].color : null;
  const cache = new Map();
  return {
    xf(i) {
      if (cache.has(i)) return cache.get(i);
      const xf = xfs[i];
      let s;
      if (xf) {
        s = {};
        const font = fonts[+(xf.getAttribute('fontId') || 0)];
        if (font) {
          if (font.b) s.b = true;
          if (font.i) s.i = true;
          if (font.u) s.u = true;
          if (font.st) s.st = true;
          if (font.sz && font.sz !== defSize) s.fs = font.sz;
          if (font.color && font.color !== defColor && font.color !== '#000000') s.fc = font.color;
        }
        const fill = fills[+(xf.getAttribute('fillId') || 0)];
        if (fill) s.bg = fill;
        const bd = borders[+(xf.getAttribute('borderId') || 0)];
        if (bd) s.bd = { ...bd };
        const id = xf.getAttribute('numFmtId') || '0';
        const code = numFmts[id] || BUILTIN_CODES[id] || ((+id >= 27 && +id <= 36) || (+id >= 50 && +id <= 58) ? 'yyyy-mm-dd' : 'General');
        if (code && code !== 'General') s.nf = code;
        const al = kid(xf, 'alignment');
        if (al) {
          const hz = al.getAttribute('horizontal');
          if (hz === 'left' || hz === 'right') s.ha = hz;
          else if (hz === 'center' || hz === 'centerContinuous') s.ha = 'center';
          const vt = al.getAttribute('vertical');
          if (vt === 'top' || vt === 'bottom') s.va = vt;
          else if (vt === 'center') s.va = 'middle';
          if (al.getAttribute('wrapText') === '1' || al.getAttribute('wrapText') === 'true') s.wrap = true;
        }
        if (!Object.keys(s).length) s = undefined;
      }
      cache.set(i, s);
      return s;
    },
  };
}

const unescapeOoxml = (s) => s.replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
function richText(si) {
  let s = '';
  for (const ch of si.children) {
    if (ch.localName === 't') s += ch.textContent;
    else if (ch.localName === 'r') for (const t of ch.children) if (t.localName === 't') s += t.textContent;
  }
  return unescapeOoxml(s);
}

function resolvePath(base, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = (base + target).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

function parseSheet(doc, name, strings, styles, date1904, stats) {
  const sh = new Sheet(name);
  const sv = all(doc, 'sheetView')[0];
  if (sv && /^(0|false)$/.test(sv.getAttribute('showGridLines') || '')) sh.showGrid = false;
  const pane = all(doc, 'pane')[0];
  if (pane && /frozen/i.test(pane.getAttribute('state') || '')) {
    sh.freeze = { r: Math.round(+(pane.getAttribute('ySplit') || 0)), c: Math.round(+(pane.getAttribute('xSplit') || 0)) };
  }
  for (const col of all(doc, 'col')) {
    const min = +col.getAttribute('min');
    const max = Math.min(+col.getAttribute('max'), 300);
    const w = parseFloat(col.getAttribute('width'));
    if (Number.isNaN(w) || col.getAttribute('customWidth') === '0') continue;
    for (let c = min - 1; c < max; c++) sh.colW[c] = Math.max(24, widthToPx(w));
  }
  const fileHidden = new Set();
  const shared = {};
  const sheetData = all(doc, 'sheetData')[0];
  let r = -1;
  for (const row of kids(sheetData, 'row')) {
    const ra = row.getAttribute('r');
    r = ra ? +ra - 1 : r + 1;
    const ht = row.getAttribute('ht');
    if (ht && (row.getAttribute('customHeight') === '1' || row.getAttribute('customHeight') === 'true')) sh.rowH[r] = Math.max(10, Math.round((parseFloat(ht) * 4) / 3));
    if (row.getAttribute('hidden') === '1' || row.getAttribute('hidden') === 'true') fileHidden.add(r);
    let c = -1;
    for (const el of row.children) {
      if (el.localName !== 'c') continue;
      const ref = el.getAttribute('r');
      if (ref) {
        const m = /^([A-Za-z]+)(\d+)$/.exec(ref);
        c = m ? colIndex(m[1]) : c + 1;
      } else c++;
      const t = el.getAttribute('t') || 'n';
      const style = styles.xf(+(el.getAttribute('s') || 0));
      const vEl = kid(el, 'v');
      const fEl = kid(el, 'f');
      const raw = vEl ? vEl.textContent : null;
      let v = null;
      if (t === 's') v = raw !== null ? strings[+raw] ?? '' : null;
      else if (t === 'str') v = raw ?? '';
      else if (t === 'inlineStr') v = richText(kid(el, 'is') || el);
      else if (t === 'b') v = raw === '1' || raw === 'true';
      else if (t === 'e') v = raw ? errFromCode(raw) : null;
      else if (t === 'd') {
        const d = raw ? new Date(raw) : null;
        v = d && !Number.isNaN(+d) ? dateToSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) + (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) / 86400 : null;
      } else v = raw !== null && raw !== '' ? parseFloat(raw) : null;
      if (typeof v === 'number' && Number.isNaN(v)) v = null;
      if (typeof v === 'number' && date1904 && style && isDateFormat(style.nf)) v += 1462;
      let f;
      if (fEl) {
        const text = fEl.textContent;
        if (fEl.getAttribute('t') === 'shared') {
          const si = fEl.getAttribute('si');
          if (text) {
            shared[si] = { r, c, f: fromFileFormula(text) };
            f = shared[si].f;
          } else if (shared[si]) f = shiftFormula(shared[si].f, r - shared[si].r, c - shared[si].c);
        } else if (text) f = fromFileFormula(text);
      }
      if (f !== undefined) {
        const cell = makeCell(null, f, style);
        if (cell.ast === null) {
          stats.dropped++;
          sh.cells.set(r * 16384 + c, makeCell(v instanceof FErr ? v.code : v, undefined, style));
        } else {
          if (v !== null) cell.cached = v;
          sh.cells.set(r * 16384 + c, cell);
          stats.formulas++;
        }
      } else if (v !== null || style) {
        sh.cells.set(r * 16384 + c, v instanceof FErr ? makeCell(null, v.code, style) : makeCell(v, undefined, style));
      }
      if (v !== null) stats.cells++;
    }
  }
  for (const mc of all(doc, 'mergeCell')) {
    const g = parseRange(mc.getAttribute('ref'));
    if (g && (g.r1 !== g.r2 || g.c1 !== g.c2)) sh.merges.push(g);
  }
  const af = kids(doc.documentElement, 'autoFilter')[0];
  if (af) {
    const g = parseRange(af.getAttribute('ref') || '');
    if (g) {
      const crit = {};
      for (const fc of kids(af, 'filterColumn')) {
        const col = g.c1 + +(fc.getAttribute('colId') || 0);
        const filters = kid(fc, 'filters');
        if (filters) {
          const values = kids(filters, 'filter').map((e) => e.getAttribute('val'));
          if (filters.getAttribute('blank') === '1') values.push('');
          crit[col] = { values, cond: null };
        }
      }
      sh.filter = { ...g, crit };
      for (const hr of fileHidden) if (hr > g.r1 && hr <= g.r2) sh.hidden.add(hr);
    }
  }
  sh.dirty();
  sh.mergesDirty();
  const b = sh.bounds();
  sh.rows = Math.max(200, b.r + 60);
  sh.cols = Math.max(26, b.c + 6);
  return sh;
}

export async function importXlsx(buffer, fileName = 'workbook.xlsx') {
  const z = await unzip(buffer);
  const parseXml = async (path) => {
    if (!path) return null;
    const text = await z.readText(path);
    if (text == null) return null;
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error(`Invalid XML in ${path}`);
    return doc;
  };
  let wbPath = 'xl/workbook.xml';
  const rootRels = await parseXml('_rels/.rels');
  for (const rel of all(rootRels, 'Relationship')) {
    if (/\/officeDocument$/.test(rel.getAttribute('Type') || '')) wbPath = resolvePath('', rel.getAttribute('Target'));
  }
  const wbDoc = await parseXml(wbPath);
  if (!wbDoc) throw new Error('This file does not contain an Excel workbook.');
  const base = wbPath.replace(/[^/]*$/, '');
  const relsDoc = await parseXml(`${base}_rels/${wbPath.split('/').pop()}.rels`);
  const rels = {};
  let sstPath = null;
  let stylesPath = null;
  let themePath = null;
  for (const rel of all(relsDoc, 'Relationship')) {
    const target = resolvePath(base, rel.getAttribute('Target') || '');
    rels[rel.getAttribute('Id')] = target;
    const type = rel.getAttribute('Type') || '';
    if (type.endsWith('/sharedStrings')) sstPath = target;
    else if (type.endsWith('/styles')) stylesPath = target;
    else if (type.endsWith('/theme')) themePath = target;
  }
  const pr = all(wbDoc, 'workbookPr')[0];
  const date1904 = !!pr && /^(1|true)$/.test(pr.getAttribute('date1904') || '');
  const sstDoc = await parseXml(sstPath);
  const strings = sstDoc ? kids(sstDoc.documentElement, 'si').map(richText) : [];
  const theme = themePath ? parseTheme(await parseXml(themePath)) : DEFAULT_THEME;
  const stylesDoc = await parseXml(stylesPath);
  const styles = stylesDoc ? parseStyles(stylesDoc, theme) : { xf: () => undefined };
  const core = await parseXml('docProps/core.xml');
  const title = (core && all(core, 'title')[0]?.textContent?.trim()) || fileName.replace(/\.[^.]+$/, '');
  const wb = new Workbook(title);
  const stats = { cells: 0, formulas: 0, dropped: 0 };
  for (const el of all(wbDoc, 'sheet')) {
    const rid = el.getAttributeNS(NS_R, 'id') || el.getAttribute('r:id');
    const doc = await parseXml(rels[rid]);
    if (!doc) continue;
    wb.sheets.push(parseSheet(doc, el.getAttribute('name') || `Sheet${wb.sheets.length + 1}`, strings, styles, date1904, stats));
  }
  if (!wb.sheets.length) throw new Error('No worksheets found in this file.');
  const view = all(wbDoc, 'workbookView')[0];
  wb.active = Math.min(+(view && view.getAttribute('activeTab')) || 0, wb.sheets.length - 1);
  wb.importStats = stats;
  return wb;
}

/* ---------- CSV ---------- */

export function parseDelimited(text, delim) {
  const src = text.replace(/^\uFEFF/, '');
  if (!delim) {
    const first = src.split(/\r?\n/, 1)[0] || '';
    const counts = [['\t', (first.match(/\t/g) || []).length], [';', (first.match(/;/g) || []).length], [',', (first.match(/,/g) || []).length]];
    counts.sort((a, b) => b[1] - a[1]);
    delim = counts[0][1] ? counts[0][0] : ',';
  }
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let quoted = false;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '') { quoted = true; i++; continue; }
    if (ch === delim) { row.push(field); field = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
      if (ch === '\r' && src[i + 1] === '\n') i++;
      i++;
      continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function importCsv(text, fileName = 'data.csv') {
  const rows = parseDelimited(text);
  const wb = new Workbook(fileName.replace(/\.[^.]+$/, ''));
  const sh = wb.addSheet(fileName.replace(/\.[^.]+$/, '').slice(0, 31) || 'Sheet1');
  const widths = [];
  rows.forEach((row, r) => row.forEach((text, c) => {
    if (text === '') return;
    writeInput(sh, r, c, text);
    widths[c] = Math.max(widths[c] || 0, text.length);
  }));
  widths.forEach((w, c) => { if (w) sh.colW[c] = Math.max(64, Math.min(320, Math.round(w * 7.2 + 18))); });
  const b = sh.bounds();
  if (b.r >= 1 && detectHeader(sh, { r1: 0, c1: 0, r2: b.r, c2: b.c })) {
    for (let c = 0; c <= b.c; c++) {
      const cell = sh.get(0, c);
      if (cell) putCell(sh, 0, c, { ...cell, s: { ...(cell.s || {}), b: true, bg: '#EEF2FF' } });
    }
    sh.freeze = { r: 1, c: 0 };
  }
  sh.rows = Math.max(200, b.r + 60);
  sh.cols = Math.max(26, b.c + 6);
  wb.importStats = { cells: sh.cells.size, formulas: 0, dropped: 0 };
  return wb;
}

export function exportCsv(sh) {
  const b = sh.bounds();
  const lines = [];
  for (let r = 0; r <= b.r; r++) {
    const row = [];
    for (let c = 0; c <= b.c; c++) {
      const t = displayText(sh, r, c);
      row.push(/[",\r\n]|^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
    }
    lines.push(row.join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

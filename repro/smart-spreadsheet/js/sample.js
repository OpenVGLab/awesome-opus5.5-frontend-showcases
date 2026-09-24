// Built-in demo workbook.
import { Workbook, makeCell, putCell, writeInput, styleRange, bordersRange, mergeRange } from './model.js';
import { parseRange, parseAreas, parseA1, uid } from './util.js';

const INDIGO = '#4338CA';
const HEAD = { b: true, bg: '#EEF1F6', fc: '#334155' };
const GROWTH = '[Green]"▲ "0.0%;[Red]"▼ "0.0%;0.0%';

function put(sh, ref, value) {
  const { r, c } = parseA1(ref);
  if (typeof value === 'number' || typeof value === 'boolean') putCell(sh, r, c, makeCell(value, undefined, sh.get(r, c) && sh.get(r, c).s));
  else writeInput(sh, r, c, value);
}
const style = (sh, ref, patch) => styleRange(sh, parseRange(ref), patch);
const row = (sh, ref, values) => {
  const { r, c } = parseA1(ref);
  values.forEach((v, i) => { if (v !== null && v !== undefined) put(sh, colRef(c + i) + (r + 1), v); });
};
const colRef = (c) => String.fromCharCode(65 + c);

function chart(spec) {
  return { id: uid('c'), seriesIn: 'auto', header: 'auto', labels: 'auto', legend: 'top', palette: 0, dataLabels: false, smooth: false, donut: false, ...spec, areas: parseAreas(spec.areas) };
}

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

function salesSheet(wb, view) {
  const sh = wb.addSheet('Sales');
  Object.assign(sh.colW, { 0: 148, 1: 90, 2: 71, 3: 71, 4: 71, 5: 71, 6: 86, 7: 76, 8: 64 });
  Object.assign(sh.rowH, { 0: 44, 1: 28, 2: 8, 3: 30, 17: 14, 18: 30 });

  style(sh, 'A1:I1', { b: true, fs: 15, fc: '#FFFFFF', bg: INDIGO, va: 'middle' });
  put(sh, 'A1', 'Cellwise Outfitters  ·  2026 Sales Dashboard');
  style(sh, 'A2:I2', { fc: '#3730A3', bg: '#EEF2FF', i: true });
  put(sh, 'A2', '="Top seller: "&INDEX(A5:A12,MATCH(MAX(G5:G12),G5:G12,0))&"   ·   Revenue: "&TEXT(G13,"$#,##0")&"   ·   Average growth: "&TEXT(AVERAGE(H5:H12),"0.0%")');
  mergeRange(sh, parseRange('A1:I1'));
  mergeRange(sh, parseRange('A2:I2'));

  style(sh, 'A4:I4', HEAD);
  style(sh, 'C4:I4', { ha: 'right' });
  bordersRange(sh, parseRange('A4:I4'), 'bottom', '#94A3B8');
  row(sh, 'A4', ['Product', 'Category', 'Q1', 'Q2', 'Q3', 'Q4', 'Total', 'Growth', 'Share']);

  const data = [
    ['Trail Runner Shoes', 'Footwear', 48200, 52900, 57300, 61800],
    ['Summit Backpack 40L', 'Gear', 31500, 29800, 35600, 42100],
    ['Alpine Down Jacket', 'Apparel', 64000, 38500, 27900, 71400],
    ['Ridge Hiking Boots', 'Footwear', 39700, 41200, 44800, 37900],
    ['Storm Shell Parka', 'Apparel', 45300, 33100, 30600, 52800],
    ['Carbon Trek Poles', 'Gear', 12400, 15900, 18300, 16700],
    ['Merino Base Layer', 'Apparel', 22800, 19600, 17200, 21400],
    ['Ultralight Tent 2P', 'Gear', 27600, 36400, 41900, 33200],
  ];
  style(sh, 'C5:G17', { nf: '$#,##0' });
  style(sh, 'G5:G12', { b: true });
  style(sh, 'H5:H13', { nf: GROWTH });
  style(sh, 'I5:I13', { nf: '0.0%', fc: '#475569' });
  style(sh, 'B5:B12', { fc: '#475569' });
  data.forEach((d, i) => {
    const r = 5 + i;
    row(sh, `A${r}`, d);
    put(sh, `G${r}`, `=SUM(C${r}:F${r})`);
    put(sh, `H${r}`, `=(F${r}-C${r})/C${r}`);
    put(sh, `I${r}`, `=G${r}/$G$13`);
  });

  style(sh, 'A13:I13', { b: true, bg: '#EEF2FF', fc: '#1E1B4B' });
  bordersRange(sh, parseRange('A13:I13'), 'top', '#6366F1');
  put(sh, 'A13', 'Total');
  put(sh, 'B13', '=SUBTOTAL(103,A5:A12)&" items"');
  for (const col of 'CDEFG') put(sh, `${col}13`, `=SUBTOTAL(109,${col}5:${col}12)`);
  put(sh, 'H13', '=(F13-C13)/C13');
  put(sh, 'I13', '=SUBTOTAL(109,I5:I12)');

  const stats = [['Average', 'AVERAGE'], ['Median', 'MEDIAN'], ['Highest', 'MAX'], ['Std. deviation', 'STDEV']];
  style(sh, 'A14:A17', { i: true, fc: '#64748B' });
  style(sh, 'C14:H17', { fc: '#475569' });
  style(sh, 'H14:H17', { nf: '0.0%' });
  stats.forEach(([label, fn], i) => {
    const r = 14 + i;
    put(sh, `A${r}`, label);
    for (const col of 'CDEFGH') put(sh, `${col}${r}`, `=${fn}(${col}5:${col}12)`);
  });

  style(sh, 'A19:I19', HEAD);
  style(sh, 'B19:I19', { ha: 'right' });
  bordersRange(sh, parseRange('A19:I19'), 'bottom', '#94A3B8');
  row(sh, 'A19', ['By category', 'Products', 'Q1', 'Q2', 'Q3', 'Q4', 'Total', 'Growth', 'Share']);
  style(sh, 'C20:G22', { nf: '$#,##0' });
  style(sh, 'G20:G22', { b: true });
  style(sh, 'H20:H22', { nf: GROWTH });
  style(sh, 'I20:I22', { nf: '0.0%', fc: '#475569' });
  style(sh, 'B20:B22', { ha: 'right', fc: '#475569' });
  ['Apparel', 'Footwear', 'Gear'].forEach((cat, i) => {
    const r = 20 + i;
    put(sh, `A${r}`, cat);
    put(sh, `B${r}`, `=COUNTIF($B$5:$B$12,A${r})`);
    for (const col of 'CDEF') put(sh, `${col}${r}`, `=SUMIF($B$5:$B$12,$A${r},${col}$5:${col}$12)`);
    put(sh, `G${r}`, `=SUM(C${r}:F${r})`);
    put(sh, `H${r}`, `=(F${r}-C${r})/C${r}`);
    put(sh, `I${r}`, `=G${r}/SUM($G$20:$G$22)`);
  });
  bordersRange(sh, parseRange('A22:I22'), 'bottom', '#CBD5E1');

  sh.filter = { r1: 3, c1: 0, r2: 11, c2: 8, crit: {} };
  const gap = 14;
  const x1 = 760;
  const avail = view.width - 46 - x1 - 12;
  const two = avail >= 2 * 430 + gap;
  const cw = two ? Math.min(600, Math.floor((avail - gap) / 2)) : clampN(avail, 420, 560);
  const ch = clampN(Math.floor((view.height - 52) / 2), 230, 380);
  const x2 = x1 + cw + gap;
  const y2 = 6 + ch + gap;
  sh.charts = [
    chart({ type: 'bar', title: 'Q1 vs Q4 revenue by product', areas: 'A4:A12,C4:C12,F4:F12', x: x1, y: 6, w: cw, h: ch }),
    chart({ type: 'pie', donut: true, title: 'Revenue share by category', areas: 'A19:A22,G19:G22', x: x1, y: y2, w: cw, h: ch, legend: 'right' }),
    chart({ type: 'line', smooth: true, title: 'Quarterly trend by category', areas: 'A19:A22,C19:F22', x: x2, y: 6, w: cw, h: ch, palette: 1 }),
    chart({ type: 'bar', title: 'Total revenue by product', areas: 'A4:A12,G4:G12', x: x2, y: y2, w: cw, h: ch, legend: 'none', dataLabels: true, palette: 3 }),
  ];
  return sh;
}

function monthlySheet(wb, view) {
  const sh = wb.addSheet('Monthly');
  Object.assign(sh.colW, { 0: 84, 1: 92, 2: 92, 3: 96, 4: 96, 5: 104 });
  Object.assign(sh.rowH, { 0: 40, 1: 26, 2: 30 });
  style(sh, 'A1:F1', { b: true, fs: 14, fc: '#FFFFFF', bg: '#0F766E', va: 'middle' });
  put(sh, 'A1', 'Monthly revenue by channel · 2026');
  mergeRange(sh, parseRange('A1:F1'));
  style(sh, 'A2:F2', { i: true, fc: '#115E59', bg: '#F0FDFA' });
  put(sh, 'A2', '="Best month: "&INDEX(A4:A15,MATCH(MAX(E4:E15),E4:E15,0))&" ("&TEXT(MAX(E4:E15),"$#,##0")&")   ·   Online share: "&TEXT(SUM(B4:B15)/SUM(E4:E15),"0%")');
  mergeRange(sh, parseRange('A2:F2'));
  style(sh, 'A3:F3', HEAD);
  style(sh, 'B3:F3', { ha: 'right' });
  bordersRange(sh, parseRange('A3:F3'), 'bottom', '#94A3B8');
  row(sh, 'A3', ['Month', 'Online', 'Retail', 'Wholesale', 'Total', 'MoM change']);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const online = [18400, 19200, 21500, 22800, 24100, 25900, 27400, 28800, 31200, 33900, 38600, 44200];
  const retail = [26800, 24100, 27300, 28900, 30200, 29400, 27800, 28600, 31900, 34700, 41200, 52300];
  const whole = [15200, 16800, 15900, 17400, 18100, 17600, 16900, 18800, 19400, 20100, 21300, 19800];
  style(sh, 'B4:E18', { nf: '$#,##0' });
  style(sh, 'E4:E15', { b: true });
  style(sh, 'F4:F15', { nf: GROWTH, ha: 'right' });
  months.forEach((m, i) => {
    const r = 4 + i;
    row(sh, `A${r}`, [m, online[i], retail[i], whole[i]]);
    put(sh, `E${r}`, `=SUM(B${r}:D${r})`);
    put(sh, `F${r}`, i === 0 ? '—' : `=E${r}/E${r - 1}-1`);
  });
  style(sh, 'A16:F16', { b: true, bg: '#F0FDFA', fc: '#134E4A' });
  bordersRange(sh, parseRange('A16:F16'), 'top', '#14B8A6');
  put(sh, 'A16', 'Total');
  put(sh, 'A17', 'Average');
  put(sh, 'A18', 'Peak month');
  style(sh, 'A17:A18', { i: true, fc: '#64748B' });
  for (const col of 'BCDE') {
    put(sh, `${col}16`, `=SUM(${col}4:${col}15)`);
    put(sh, `${col}17`, `=AVERAGE(${col}4:${col}15)`);
    put(sh, `${col}18`, `=INDEX($A$4:$A$15,MATCH(MAX(${col}4:${col}15),${col}4:${col}15,0))`);
  }
  style(sh, 'B18:E18', { ha: 'right', fc: '#0F766E', b: true });
  put(sh, 'F16', '=E15/E4-1');
  style(sh, 'F16', { nf: GROWTH });
  const w = clampN(view.width - 46 - 574 - 14, 560, 920);
  const lineH = clampN(Math.round((view.height - 60) * 0.56), 260, 460);
  const barH = clampN(view.height - 26 - 6 - lineH - 12 - 8, 200, 420);
  sh.charts = [
    chart({ type: 'line', title: 'Revenue by channel', areas: 'A3:D15', x: 574, y: 6, w, h: lineH, smooth: true, palette: 1 }),
    chart({ type: 'bar', title: 'Total revenue per month', areas: 'A3:A15,E3:E15', x: 574, y: 6 + lineH + 12, w, h: barH, legend: 'none', palette: 3 }),
  ];
  return sh;
}

function formulasSheet(wb) {
  const sh = wb.addSheet('Formulas');
  Object.assign(sh.colW, { 0: 96, 1: 128, 2: 424, 3: 178, 4: 206, 5: 24, 6: 72, 7: 72 });
  Object.assign(sh.rowH, { 0: 40, 1: 26, 2: 30 });
  style(sh, 'A1:E1', { b: true, fs: 14, fc: '#FFFFFF', bg: '#6D28D9', va: 'middle' });
  put(sh, 'A1', 'Formula gallery · every result is calculated live');
  mergeRange(sh, parseRange('A1:E1'));
  style(sh, 'A2:E2', { i: true, fc: '#5B21B6', bg: '#F5F3FF' });
  put(sh, 'A2', 'Column C shows each formula with FORMULATEXT(). Edit the sample data in G4:H11 and watch the results change.');
  mergeRange(sh, parseRange('A2:E2'));
  style(sh, 'A3:E3', HEAD);
  style(sh, 'D3', { ha: 'right' });
  bordersRange(sh, parseRange('A3:E3'), 'bottom', '#94A3B8');
  row(sh, 'A3', ['Category', 'Function', 'Formula', 'Result', 'What it does']);
  style(sh, 'G3:H3', HEAD);
  style(sh, 'G3:H3', { ha: 'right' });
  bordersRange(sh, parseRange('G3:H3'), 'bottom', '#94A3B8');
  row(sh, 'G3', ['Score', 'Hours']);
  const scores = [72, 85, 91, 64, 85, 78, 96, 58];
  const hours = [5, 7, 8, 4, 6, 6, 9, 3];
  scores.forEach((v, i) => row(sh, `G${4 + i}`, [v, hours[i]]));
  style(sh, 'G4:H11', { bg: '#FFFBEB' });
  const rows = [
    ['Math', 'SUM', '=SUM(G4:G11)', 'Total of the scores'],
    ['Math', 'ROUND · PI', '=ROUND(PI(),4)', 'π rounded to 4 decimals'],
    ['Math', 'SQRT', '=SQRT(144)', 'Square root'],
    ['Math', 'POWER', '=POWER(2,10)', '2 raised to the 10th power'],
    ['Math', 'MOD', '=MOD(17,5)', 'Remainder of 17 ÷ 5'],
    ['Math', 'SUMPRODUCT', '=SUMPRODUCT(G4:G11,H4:H11)', 'Score × hours, summed'],
    ['Math', 'ROUNDUP', '=ROUNDUP(AVERAGE(H4:H11),1)', 'Average hours, rounded up'],
    ['Statistical', 'AVERAGE', '=AVERAGE(G4:G11)', 'Mean score', '0.00'],
    ['Statistical', 'MEDIAN', '=MEDIAN(G4:G11)', 'Middle score'],
    ['Statistical', 'MODE', '=MODE(G4:G11)', 'Most frequent score'],
    ['Statistical', 'STDEV', '=STDEV(G4:G11)', 'Sample standard deviation', '0.00'],
    ['Statistical', 'VAR', '=VAR(G4:G11)', 'Sample variance', '0.00'],
    ['Statistical', 'MAX − MIN', '=MAX(G4:G11)-MIN(G4:G11)', 'Range of the scores'],
    ['Statistical', 'COUNTIF', '=COUNTIF(G4:G11,">=80")', 'Scores of 80 or more'],
    ['Statistical', 'LARGE', '=LARGE(G4:G11,2)', 'Second-highest score'],
    ['Statistical', 'PERCENTILE', '=PERCENTILE(G4:G11,0.9)', '90th percentile', '0.0'],
    ['Statistical', 'CORREL', '=CORREL(G4:G11,H4:H11)', 'Hours ↔ score correlation', '0.000'],
    ['Statistical', 'FORECAST', '=FORECAST(10,G4:G11,H4:H11)', 'Predicted score after 10 hours', '0.0'],
    ['Logical', 'IF', '=IF(AVERAGE(G4:G11)>=75,"On track","Needs work")', 'Conditional result'],
    ['Logical', 'AND', '=AND(MIN(G4:G11)>50,MAX(G4:G11)<100)', 'All scores between 50 and 100?'],
    ['Logical', 'IFERROR', '=IFERROR(1/0,"Division guarded")', 'Catches the #DIV/0! error'],
    ['Text', 'CONCAT', '=CONCAT("Q",4," · ",2026)', 'Joins text and numbers'],
    ['Text', 'UPPER', '=UPPER("smart sheet")', 'Converts to upper case'],
    ['Text', 'PROPER', '=PROPER("alpine down jacket")', 'Capitalises each word'],
    ['Text', 'TEXT', '=TEXT(0.2567,"0.0%")', 'Formats a number as text'],
    ['Text', 'LEN · SUBSTITUTE', '=LEN(SUBSTITUTE("a-b-c","-",""))', 'Length without the dashes'],
    ['Lookup', 'VLOOKUP', '=VLOOKUP("Ridge Hiking Boots",Sales!A5:G12,7,FALSE)', 'Total from the Sales sheet', '$#,##0'],
    ['Lookup', 'INDEX · MATCH', '=INDEX(Sales!A5:A12,MATCH(MAX(Sales!H5:H12),Sales!H5:H12,0))', 'Fastest-growing product'],
    ['Lookup', 'XLOOKUP', '=XLOOKUP("Gear",Sales!A20:A22,Sales!G20:G22)', 'Category total', '$#,##0'],
    ['Date', 'TODAY', '=TODAY()', "Today's date"],
    ['Date', 'TEXT · TODAY', '=TEXT(TODAY(),"dddd, mmmm d")', 'Weekday and date as text'],
    ['Date', 'DATE − TODAY', '=DATE(YEAR(TODAY()),12,31)-TODAY()', 'Days left this year'],
    ['Date', 'NETWORKDAYS', '=NETWORKDAYS(DATE(2026,1,1),DATE(2026,12,31))', 'Working days in 2026'],
  ];
  const catColor = { Math: '#4F46E5', Statistical: '#0891B2', Logical: '#D97706', Text: '#059669', Lookup: '#DB2777', Date: '#7C3AED' };
  rows.forEach(([cat, fn, formula, note, nf], i) => {
    const r = 4 + i;
    style(sh, `A${r}`, { fc: catColor[cat], b: true });
    style(sh, `C${r}`, { fc: '#475569' });
    style(sh, `D${r}`, { b: true, ha: 'right', ...(nf ? { nf } : {}) });
    style(sh, `E${r}`, { fc: '#64748B' });
    row(sh, `A${r}`, [cat, fn]);
    put(sh, `D${r}`, formula);
    put(sh, `C${r}`, `=FORMULATEXT(D${r})`);
    put(sh, `E${r}`, note);
  });
  return sh;
}

// `view` is the grid's visible size, so the demo charts fill the screen they are first shown on.
export function buildSample(view = {}) {
  const v = { width: view.width > 200 ? view.width : 1268, height: view.height > 200 ? view.height : 540 };
  const wb = new Workbook('2026 Sales Workbook');
  salesSheet(wb, v);
  monthlySheet(wb, v);
  formulasSheet(wb);
  wb.active = 0;
  wb.recalc();
  return wb;
}

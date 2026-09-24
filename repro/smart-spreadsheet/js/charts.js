// SVG charts (bar / line / pie) driven by live sheet ranges.
import { formatNumber, formatGeneral } from './format.js';
import { cellValue } from './model.js';
import { FErr } from './formula.js';
import { FONT_STACK } from './util.js';

export const PALETTES = [
  { name: 'Vivid', colors: ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#84CC16', '#F97316'] },
  { name: 'Ocean', colors: ['#1E40AF', '#0891B2', '#38BDF8', '#0F766E', '#6366F1', '#22D3EE', '#1E3A8A', '#5EEAD4'] },
  { name: 'Sunset', colors: ['#E11D48', '#F97316', '#F59E0B', '#A855F7', '#DB2777', '#FACC15', '#9F1239', '#FB923C'] },
  { name: 'Forest', colors: ['#166534', '#65A30D', '#0D9488', '#CA8A04', '#15803D', '#84CC16', '#115E59', '#A16207'] },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FONT_ATTR = FONT_STACK.replace(/"/g, "'");
let mctx = null;
function tw(text, size = 11, weight = 400) {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  mctx.font = `${weight} ${size}px ${FONT_STACK}`;
  return mctx.measureText(String(text)).width;
}
function fit(text, maxW, size = 11, weight = 400) {
  let s = String(text);
  if (tw(s, size, weight) <= maxW) return s;
  while (s.length > 1 && tw(s + '…', size, weight) > maxW) s = s.slice(0, -1);
  return s + '…';
}
const r1 = (v) => Math.round(v * 10) / 10;

/* ---------- data ---------- */

const isText = (v) => typeof v === 'string' && v !== '';
const isNum = (v) => typeof v === 'number';
const label = (v) => (v === null || v === undefined ? '' : typeof v === 'number' ? formatGeneral(v) : v instanceof FErr ? v.code : String(v));

export function chartData(sh, chart) {
  const areas = chart.areas || [];
  if (!areas.length) return null;
  const base = areas[0];
  const rowOffsets = [];
  for (let i = 0; i <= base.r2 - base.r1; i++) if (!sh.hidden.has(base.r1 + i) || i === 0) rowOffsets.push(i);
  const cols = [];
  for (const g of areas) for (let c = g.c1; c <= g.c2; c++) cols.push({ c, r1: g.r1 });
  if (!cols.length || !rowOffsets.length) return null;
  const M = rowOffsets.map((i) => cols.map((col) => cellValue(sh.get(col.r1 + i, col.c))));
  const F = rowOffsets.map((i) => cols.map((col) => {
    const cell = sh.get(col.r1 + i, col.c);
    return cell && cell.s && cell.s.nf;
  }));
  const R = M.length;
  const C = cols.length;
  const firstColData = M.slice(1).map((r) => r[0]);
  let labels = chart.labels === true || chart.labels === false ? chart.labels
    : C > 1 && ((firstColData.some(isText) && !firstColData.some(isNum)) || ((M[0][0] === null || M[0][0] === '') && R > 1 && M[0].slice(1).some(isText)));
  const firstRow = M[0].slice(labels ? 1 : 0);
  let header = chart.header === true || chart.header === false ? chart.header
    : R > 1 && firstRow.some(isText) && !firstRow.some(isNum);
  if (C === 1) labels = false;
  if (R === 1) header = false;
  const dr0 = header ? 1 : 0;
  const dc0 = labels ? 1 : 0;
  const dataRows = R - dr0;
  const dataCols = C - dc0;
  if (dataRows <= 0 || dataCols <= 0) return null;
  const byRows = chart.seriesIn === 'rows' || (chart.seriesIn !== 'cols' && dataRows < dataCols);
  let nf = null;
  for (let i = dr0; i < R && !nf; i++) for (let j = dc0; j < C && !nf; j++) if (isNum(M[i][j]) && F[i][j]) nf = F[i][j];
  const num = (v) => (isNum(v) ? v : null);
  let categories;
  let series;
  if (!byRows) {
    categories = Array.from({ length: dataRows }, (_, i) => (labels ? label(M[dr0 + i][0]) : String(i + 1)));
    series = Array.from({ length: dataCols }, (_, j) => ({
      name: header ? label(M[0][dc0 + j]) || `Series ${j + 1}` : `Series ${j + 1}`,
      values: Array.from({ length: dataRows }, (_, i) => num(M[dr0 + i][dc0 + j])),
    }));
  } else {
    categories = Array.from({ length: dataCols }, (_, j) => (header ? label(M[0][dc0 + j]) : String(j + 1)));
    series = Array.from({ length: dataRows }, (_, i) => ({
      name: labels ? label(M[dr0 + i][0]) || `Series ${i + 1}` : `Series ${i + 1}`,
      values: Array.from({ length: dataCols }, (_, j) => num(M[dr0 + i][dc0 + j])),
    }));
  }
  const numeric = series.filter((s) => s.values.some((v) => v !== null));
  if (numeric.length) series = numeric;
  return { categories, series, nf, byRows, header, labels };
}

/* ---------- formatting ---------- */

export function formatValue(v, nf) {
  if (v === null || v === undefined) return '—';
  return formatNumber(v, nf && nf !== 'General' ? nf : '#,##0.##').text.replace(/\.$/, '');
}

function compact(v, nf, step) {
  const pct = nf && /%/.test(nf.replace(/"[^"]*"/g, ''));
  if (pct) {
    const d = step && step * 100 < 1 ? 1 : 0;
    return (v * 100).toFixed(d) + '%';
  }
  const cur = nf ? (nf.match(/[$€£¥]/) || [''])[0] : '';
  const a = Math.abs(v);
  const trim = (s) => s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  let s;
  if (a >= 1e9) s = trim((a / 1e9).toFixed(1)) + 'B';
  else if (a >= 1e6) s = trim((a / 1e6).toFixed(a >= 1e7 ? 0 : 1)) + 'M';
  else if (a >= 1e4) s = trim((a / 1e3).toFixed(a >= 1e5 ? 0 : 1)) + 'K';
  else s = formatNumber(a, a < 10 && a % 1 ? '0.##' : '#,##0.#').text.replace(/\.$/, '');
  return (v < 0 ? '-' : '') + cur + s;
}

function niceScale(min, max, count = 5) {
  if (min === max) {
    if (min === 0) max = 1;
    else if (min > 0) min = 0;
    else max = 0;
  }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(parseFloat(v.toPrecision(12)));
  return { lo, hi: hi === lo ? lo + step : hi, step, ticks };
}

function legendLayout(items, x, y, maxW, align = 'left') {
  const rows = [[]];
  let w = 0;
  for (const it of items) {
    const iw = 16 + tw(it.label, 11.5) + 18;
    if (w + iw > maxW && rows[rows.length - 1].length) { rows.push([]); w = 0; }
    rows[rows.length - 1].push({ ...it, w: iw });
    w += iw;
  }
  let svg = '';
  rows.forEach((row, ri) => {
    const rowW = row.reduce((s, it) => s + it.w, 0) - 18;
    let cx = align === 'center' ? x + (maxW - rowW) / 2 : x;
    const cy = y + ri * 20;
    for (const it of row) {
      svg += `<g class="legend-item" data-s="${it.s ?? ''}"><rect x="${r1(cx)}" y="${cy + 3}" width="10" height="10" rx="3" fill="${it.color}"/>` +
        `<text x="${r1(cx + 15)}" y="${cy + 12}" font-size="11.5" fill="#475569">${esc(it.label)}</text></g>`;
      cx += it.w;
    }
  });
  return { svg, height: rows.length * 20 };
}

function smoothPath(pts) {
  if (pts.length < 3) return 'M' + pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join('L');
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])},${r1(c1[1])} ${r1(c2[0])},${r1(c2[1])} ${r1(p2[0])},${r1(p2[1])}`;
  }
  return d;
}

/* ---------- rendering ---------- */

export function renderChart(spec, data, W, H, { animate = false } = {}) {
  const pal = (PALETTES[spec.palette || 0] || PALETTES[0]).colors;
  const color = (i) => pal[i % pal.length];
  const pad = 16;
  let top = 14;
  const parts = [];
  const head = `<svg xmlns="http://www.w3.org/2000/svg" class="chart-svg${animate ? ' anim' : ''}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT_ATTR}">`;
  if (spec.title) {
    parts.push(`<text x="${pad}" y="${top + 13}" font-size="14" font-weight="600" fill="#0F172A">${esc(fit(spec.title, W - pad * 2 - 90, 14, 600))}</text>`);
    top += 28;
  }
  const empty = (msg) => head + parts.join('') + `<text x="${W / 2}" y="${(top + H) / 2}" text-anchor="middle" font-size="12.5" fill="#94A3B8">${esc(msg)}</text></svg>`;
  if (!data || !data.series.length || !data.categories.length) return empty('Select a range with numbers to chart');
  const nf = data.nf;
  const legendPos = spec.legend || (spec.type === 'pie' ? 'right' : 'top');

  if (spec.type === 'pie') {
    const s = data.series[0];
    const items = data.categories.map((c, i) => ({ c, v: s.values[i], i })).filter((d) => d.v !== null && d.v > 0);
    const total = items.reduce((t, d) => t + d.v, 0);
    if (!items.length || total <= 0) return empty('Pie charts need positive numbers');
    const legendItems = items.map((d) => ({ label: `${d.c}  ${((d.v / total) * 100).toFixed(1)}%`, color: color(d.i), s: d.i }));
    let plot = { x: pad, y: top, w: W - pad * 2, h: H - top - pad };
    let legend = '';
    if (legendPos === 'right' && W > 300) {
      const lw = Math.min(Math.max(...legendItems.map((it) => tw(it.label, 11.5) + 22)), W * 0.46);
      plot.w -= lw + 12;
      const lh = legendItems.length * 21;
      let ly = top + Math.max(0, (plot.h - lh) / 2);
      legend = legendItems.map((it, k) => `<g class="legend-item mark" data-s="0" data-i="${it.s}"><rect x="${r1(plot.x + plot.w + 16)}" y="${r1(ly + k * 21 + 4)}" width="10" height="10" rx="3" fill="${it.color}"/>` +
        `<text x="${r1(plot.x + plot.w + 32)}" y="${r1(ly + k * 21 + 13)}" font-size="11.5" fill="#475569">${esc(fit(it.label, lw - 20, 11.5))}</text></g>`).join('');
    } else if (legendPos !== 'none') {
      const lg = legendLayout(legendItems, pad, 0, W - pad * 2, 'center');
      const ly = legendPos === 'top' ? top : H - pad - lg.height + 4;
      legend = `<g transform="translate(0 ${ly})">${lg.svg}</g>`;
      if (legendPos === 'top') plot.y += lg.height + 6;
      plot.h -= lg.height + 6;
    }
    const cx = plot.x + plot.w / 2;
    const cy = plot.y + plot.h / 2;
    const R = Math.max(10, Math.min(plot.w, plot.h) / 2 - 4);
    const inner = spec.donut ? R * 0.58 : 0;
    let a0 = -Math.PI / 2;
    const slices = items.map((d, k) => {
      const ang = (d.v / total) * Math.PI * 2;
      const a1 = a0 + ang;
      const large = ang > Math.PI ? 1 : 0;
      const P = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
      let path;
      if (items.length === 1) {
        path = `M${cx - R},${cy}a${R},${R} 0 1,0 ${R * 2},0a${R},${R} 0 1,0 ${-R * 2},0` + (inner ? `M${cx - inner},${cy}a${inner},${inner} 0 1,1 ${inner * 2},0a${inner},${inner} 0 1,1 ${-inner * 2},0` : '');
      } else {
        const [x0, y0] = P(a0, R);
        const [x1, y1] = P(a1, R);
        if (inner) {
          const [x2, y2] = P(a1, inner);
          const [x3, y3] = P(a0, inner);
          path = `M${r1(x0)},${r1(y0)}A${r1(R)},${r1(R)} 0 ${large},1 ${r1(x1)},${r1(y1)}L${r1(x2)},${r1(y2)}A${r1(inner)},${r1(inner)} 0 ${large},0 ${r1(x3)},${r1(y3)}Z`;
        } else path = `M${r1(cx)},${r1(cy)}L${r1(x0)},${r1(y0)}A${r1(R)},${r1(R)} 0 ${large},1 ${r1(x1)},${r1(y1)}Z`;
      }
      const mid = a0 + ang / 2;
      const lr = inner ? (R + inner) / 2 : R * 0.64;
      const [lx, ly] = P(mid, lr);
      const pct = (d.v / total) * 100;
      const showLabel = ang > 0.32 && R > 44;
      const dx = r1(Math.cos(mid) * 6);
      const dy = r1(Math.sin(mid) * 6);
      a0 = a1;
      return `<g class="slice mark" data-s="0" data-i="${d.i}" style="--i:${k};--dx:${dx}px;--dy:${dy}px;transform-origin:${r1(cx)}px ${r1(cy)}px">` +
        `<path d="${path}" fill="${color(d.i)}" stroke="#fff" stroke-width="2" fill-rule="evenodd"/>` +
        (showLabel ? `<text x="${r1(lx)}" y="${r1(ly + 4)}" text-anchor="middle" font-size="11.5" font-weight="600" fill="#fff" pointer-events="none">${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%</text>` : '') + '</g>';
    }).join('');
    const center = inner ? `<text x="${r1(cx)}" y="${r1(cy - 2)}" text-anchor="middle" font-size="11" fill="#64748B">Total</text><text x="${r1(cx)}" y="${r1(cy + 15)}" text-anchor="middle" font-size="14" font-weight="700" fill="#0F172A">${esc(compact(total, nf))}</text>` : '';
    return head + parts.join('') + slices + center + legend + '</svg>';
  }

  // Cartesian charts
  const series = data.series;
  const cats = data.categories;
  let legendH = 0;
  let legendSvg = '';
  if (legendPos !== 'none' && (series.length > 1 || legendPos === 'bottom' || legendPos === 'right')) {
    const lg = legendLayout(series.map((s, i) => ({ label: s.name, color: color(i), s: i })), pad, 0, W - pad * 2, legendPos === 'top' ? 'left' : 'center');
    legendH = lg.height + 6;
    const ly = legendPos === 'top' ? top : H - pad - lg.height + 6;
    legendSvg = `<g transform="translate(0 ${ly})">${lg.svg}</g>`;
    if (legendPos === 'top') top += legendH;
  }
  const bottomLegend = legendPos === 'bottom' || legendPos === 'right' ? legendH : 0;
  const vals = series.flatMap((s) => s.values).filter((v) => v !== null);
  if (!vals.length) return empty('No numeric values in the selected range');
  let dmin = Math.min(...vals);
  let dmax = Math.max(...vals);
  if (spec.type === 'bar' || !(dmin > 0 && dmax - dmin < dmax * 0.35)) { dmin = Math.min(0, dmin); dmax = Math.max(0, dmax); }
  const plotH0 = H - top - pad - bottomLegend - 22;
  const scale = niceScale(dmin, dmax, Math.max(2, Math.min(6, Math.round(plotH0 / 48))));
  const tickLabels = scale.ticks.map((t) => compact(t, nf, scale.step));
  const yLabelW = Math.max(...tickLabels.map((t) => tw(t, 11))) + 10;
  const px = pad + yLabelW;
  const plotW = Math.max(20, W - px - pad);
  const band = plotW / cats.length;
  const catLabels = cats.map((c) => String(c));
  const maxCatW = Math.max(...catLabels.map((c) => tw(c, 11)));
  const rotate = maxCatW > band - 6;
  const every = rotate ? Math.max(1, Math.ceil(16 / band)) : 1;
  const catH = rotate ? Math.min(78, Math.min(maxCatW, 110) * 0.62 + 16) : 22;
  const py = top + 6;
  const plotH = Math.max(20, H - py - pad - bottomLegend - catH);
  const Y = (v) => py + plotH - ((v - scale.lo) / (scale.hi - scale.lo)) * plotH;
  let svg = '';
  scale.ticks.forEach((t, i) => {
    const y = r1(Y(t));
    svg += `<line x1="${px}" x2="${r1(px + plotW)}" y1="${y}" y2="${y}" stroke="${t === 0 ? '#CBD5E1' : '#EEF1F6'}" stroke-width="1"${t === 0 ? '' : ' stroke-dasharray="3 3"'}/>`;
    svg += `<text x="${px - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#64748B">${esc(tickLabels[i])}</text>`;
  });
  catLabels.forEach((c, i) => {
    if (i % every) return;
    const x = px + band * (i + 0.5);
    const y = py + plotH + 15;
    if (rotate) svg += `<text transform="translate(${r1(x + 3)} ${r1(y - 4)}) rotate(-38)" text-anchor="end" font-size="11" fill="#64748B">${esc(fit(c, 110, 11))}</text>`;
    else svg += `<text x="${r1(x)}" y="${r1(y)}" text-anchor="middle" font-size="11" fill="#64748B">${esc(c)}</text>`;
  });
  const y0 = Y(Math.max(scale.lo, Math.min(0, scale.hi)));
  if (spec.type === 'bar') {
    const n = series.length;
    const groupW = band * (n > 1 ? 0.8 : 0.62);
    const barW = groupW / n;
    const gap = n > 1 ? Math.min(3, barW * 0.12) : 0;
    let k = 0;
    const showLabels = spec.dataLabels && barW >= 14;
    series.forEach((s, si) => {
      s.values.forEach((v, i) => {
        if (v === null) return;
        const x = px + band * i + (band - groupW) / 2 + si * barW + gap / 2;
        const w = Math.max(1, barW - gap);
        const yv = Y(v);
        const hgt = Math.abs(yv - y0);
        const up = yv <= y0;
        const rad = Math.min(4, w / 2, hgt);
        const yt = up ? yv : y0;
        const yb = up ? y0 : yv;
        const d = up
          ? `M${r1(x)},${r1(yb)}V${r1(yt + rad)}Q${r1(x)},${r1(yt)} ${r1(x + rad)},${r1(yt)}H${r1(x + w - rad)}Q${r1(x + w)},${r1(yt)} ${r1(x + w)},${r1(yt + rad)}V${r1(yb)}Z`
          : `M${r1(x)},${r1(yt)}V${r1(yb - rad)}Q${r1(x)},${r1(yb)} ${r1(x + rad)},${r1(yb)}H${r1(x + w - rad)}Q${r1(x + w)},${r1(yb)} ${r1(x + w)},${r1(yb - rad)}V${r1(yt)}Z`;
        svg += `<path class="bar mark" data-s="${si}" data-i="${i}" d="${d}" fill="${color(si)}" style="--i:${k++};transform-origin:center ${up ? 'bottom' : 'top'}"/>`;
        if (showLabels) svg += `<text class="dlabel" x="${r1(x + w / 2)}" y="${r1(up ? yv - 5 : yv + 13)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#334155">${esc(compact(v, nf))}</text>`;
      });
    });
  } else {
    const showMarkers = cats.length <= 40;
    series.forEach((s, si) => {
      const col = color(si);
      const segs = [];
      let cur = [];
      s.values.forEach((v, i) => {
        if (v === null) { if (cur.length) segs.push(cur); cur = []; return; }
        cur.push([px + band * (i + 0.5), Y(v), i, v]);
      });
      if (cur.length) segs.push(cur);
      for (const seg of segs) {
        const d = spec.smooth ? smoothPath(seg) : 'M' + seg.map((p) => `${r1(p[0])},${r1(p[1])}`).join('L');
        if (series.length <= 3 && seg.length > 1) {
          const gid = `g${Math.random().toString(36).slice(2, 8)}`;
          svg += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="${series.length === 1 ? 0.22 : 0.12}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>`;
          svg += `<path class="area" d="${d}L${r1(seg[seg.length - 1][0])},${r1(y0)}L${r1(seg[0][0])},${r1(y0)}Z" fill="url(#${gid})"/>`;
        }
        svg += `<path class="line-path" pathLength="1" d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
        if (showMarkers) {
          seg.forEach((p, k) => {
            svg += `<circle class="marker mark" data-s="${si}" data-i="${p[2]}" cx="${r1(p[0])}" cy="${r1(p[1])}" r="3.6" fill="#fff" stroke="${col}" stroke-width="2" style="--i:${k}"/>`;
            if (spec.dataLabels && cats.length <= 14) svg += `<text class="dlabel" x="${r1(p[0])}" y="${r1(p[1] - 9)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#334155">${esc(compact(p[3], nf))}</text>`;
          });
        }
      }
    });
    svg += `<rect class="hover-band" x="${px}" y="${py}" width="${r1(plotW)}" height="${r1(plotH)}" fill="transparent" data-band="${r1(band)}" data-x0="${px}"/>`;
  }
  return head + parts.join('') + legendSvg + svg + '</svg>';
}

export async function svgToPng(svgEl, scale = 2) {
  const w = +svgEl.getAttribute('width');
  const h = +svgEl.getAttribute('height');
  const clone = svgEl.cloneNode(true);
  clone.classList.remove('anim');
  clone.querySelectorAll('.hover-band').forEach((n) => n.remove());
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', w);
  bg.setAttribute('height', h);
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

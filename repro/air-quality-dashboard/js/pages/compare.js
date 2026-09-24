import { CITIES, PROVINCES, REGIONS } from '../data/geo-data.js';
import * as M from '../core/model.js';
import { levelIndex, LEVELS, levelColor, pollutantIAQI, levelBreaks, ANNUAL_STD } from '../core/aqi.js';
import { t, cityName, provName, levelName, POL_LABEL, fmtVal, getLang } from '../core/i18n.js';
import { makeChart, tooltipRow, SERIES_COLORS } from '../ui/charts.js';
import { segmented, Picker } from '../ui/widgets.js';
import { esc, icon, on, afterPaint } from '../ui/dom.js';
import { fmtDay, fmtShort, fmtMonth, yearOf, monthOf, firstDayOfMonth, daysInMonth, firstDayOfYear, pad, DATA_START_YEAR } from '../core/time.js';
import { cityE, snapshot, cityItems, provinceCities } from '../core/query.js';

const MAX_TREND = 12;
const RANGES = { hour: [24, 48, 72, 168], day: [30, 90, 180, 365], month: [12, 24, 36], year: [0] };
const C = { region: 'fenwei', selected: [], gran: 'day', range: { hour: 72, day: 30, month: 12, year: 0 }, ind: 'aqi', sortKey: 'mean', sortDir: 1 };
let root, charts = {}, granSeg, addPicker, data = null, deferred = false;

// ---------------------------------------------------------------- regions
function regionCities(id) {
  if (id.startsWith('prov:')) return provinceCities(+id.slice(5));
  const r = REGIONS.find((x) => x.id === id);
  return r ? r.cities.slice() : [];
}
function regionLabel(id) {
  if (id === 'custom') return t('customSel');
  if (id.startsWith('prov:')) return provName(+id.slice(5));
  const r = REGIONS.find((x) => x.id === id);
  return r ? r[getLang() === 'zh' ? 'zh' : 'en'] : id;
}
const colorOf = (ci) => SERIES_COLORS[C.selected.indexOf(ci) % SERIES_COLORS.length];

// ---------------------------------------------------------------- time steps
// returns [{ label, full, kind, d0, d1, d, h }]
function steps() {
  const out = [];
  const n = C.range[C.gran];
  if (C.gran === 'hour') {
    for (let k = n - 1; k >= 0; k--) {
      let d = M.NOW.day, h = M.NOW.hour - k;
      while (h < 0) { h += 24; d--; }
      out.push({ d, h, label: h === 0 || k === n - 1 ? `${fmtShort(d)} ${pad(h)}:00` : `${pad(h)}:00`, full: `${fmtDay(d)} ${pad(h)}:00` });
    }
  } else if (C.gran === 'day') {
    for (let k = n - 1; k >= 0; k--) { const d = M.NOW.day - k; out.push({ d, label: fmtShort(d), full: fmtDay(d) + (d === M.NOW.day ? ` (${t('cumulative')})` : '') }); }
  } else if (C.gran === 'month') {
    let y = yearOf(M.NOW.day), m = monthOf(M.NOW.day);
    const list = [];
    for (let k = 0; k < n; k++) {
      const d0 = firstDayOfMonth(y, m);
      list.unshift({ d0, d1: Math.min(d0 + daysInMonth(y, m) - 1, M.NOW.day), label: fmtMonth(y, m), full: fmtMonth(y, m) });
      m--; if (m < 1) { m = 12; y--; }
    }
    out.push(...list.filter((s) => s.d1 >= M.FIRST_DAY));
  } else {
    for (let y = DATA_START_YEAR; y <= yearOf(M.NOW.day); y++) {
      const d0 = firstDayOfYear(y);
      out.push({ d0, d1: Math.min(firstDayOfYear(y + 1) - 1, M.NOW.day), label: String(y), full: y === yearOf(M.NOW.day) ? `${y} (${t('cumulative')})` : String(y) });
    }
  }
  return out;
}
const aggregated = () => C.gran === 'month' || C.gran === 'year';
function indicatorOptions() {
  const base = [['aqi', 'AQI'], ...POL_LABEL.map((l, p) => [p, p === 2 ? (C.gran === 'hour' ? 'O₃' : aggregated() ? 'O₃-8h⁹⁰' : 'O₃-8h') : p === 5 && aggregated() ? 'CO⁹⁵' : l])];
  if (aggregated()) base.push(['ci', t('ciShort')], ['good', t('goodRate')]);
  return base;
}
const indLabel = () => (indicatorOptions().find(([v]) => v === C.ind) || ['', ''])[1];
const indUnit = () => (C.ind === 'aqi' || C.ind === 'ci' ? '' : C.ind === 'good' ? '%' : C.ind === 5 ? 'mg/m³' : 'μg/m³');

// value of the indicator for city ci at step s; also returns an "exceeds" flag and colour
function valueAt(ci, s) {
  const e = cityE(ci);
  if (!aggregated()) {
    const snap = snapshot(e, C.gran === 'hour' ? 'hour' : 'day', s.d, C.gran === 'hour' ? s.h : M.NOW.hour);
    if (!snap) return null;
    const mode = C.gran === 'hour' ? 'hour' : 'day';
    if (C.ind === 'aqi') return { v: snap.aqi, iaqi: snap.aqi };
    const v = snap.vals[C.ind];
    return { v: C.ind === 5 ? Math.round(v * 10) / 10 : Math.round(v), iaqi: pollutantIAQI(C.ind, v, mode) };
  }
  const st = M.periodStats(e, s.d0, s.d1);
  if (!st) return null;
  if (C.ind === 'aqi') return { v: Math.round(st.aqiMean), iaqi: Math.round(st.aqiMean), good: st.goodRate };
  if (C.ind === 'ci') return { v: Math.round(st.ci * 100) / 100 };
  if (C.ind === 'good') return { v: Math.round(st.goodRate * 1000) / 10 };
  const v = C.ind === 2 ? st.o3p90 : C.ind === 5 ? st.cop95 : st.mean[C.ind];
  return { v: C.ind === 5 ? Math.round(v * 100) / 100 : Math.round(v), ratio: v / ANNUAL_STD[C.ind] };
}
const exceeds = (x) => (x.iaqi != null ? x.iaqi > 100 : x.ratio != null ? x.ratio > 1 : false);

function compute() {
  const st = steps();
  const cities = C.selected.slice();
  const heatCities = C.region === 'custom' ? cities : [...new Set([...regionCities(C.region), ...cities])];
  const all = [...new Set([...cities, ...heatCities])];
  const vals = new Map();
  for (const ci of all) vals.set(ci, st.map((s) => valueAt(ci, s)));
  // pollutant profile over the whole range
  const d0 = aggregated() ? st[0].d0 : st[0].d, d1 = aggregated() ? st[st.length - 1].d1 : st[st.length - 1].d;
  const prof = new Map(cities.map((ci) => [ci, M.periodStats(cityE(ci), d0, d1)]));
  return { st, cities, heatCities, vals, prof, d0, d1 };
}

// ---------------------------------------------------------------- layout
function layout() {
  root.innerHTML = `
  <div class="compare">
    <div class="panel c-side">
      <div class="panel-head"><div class="panel-title">${t('region')}</div></div>
      <div class="side-sec"><select class="select" id="cRegion" style="width:100%"></select></div>
      <div class="side-sec" style="display:flex;gap:6px;padding-bottom:6px;align-items:center">
        <span class="lbl" style="flex:1">${t('regionCities')}</span>
        <button class="btn sm" type="button" data-act="all">${t('all')}</button>
        <button class="btn sm" type="button" data-act="clear">${t('clear')}</button>
      </div>
      <div class="c-cities" id="cCities"></div>
      <div class="side-sec" style="border-top:1px solid var(--line);padding-top:10px">
        <button class="pick-btn" id="cAdd" type="button" style="width:100%;max-width:none">${icon('search')}<span class="pb-label" style="font-weight:500;color:var(--text-2)">${t('addCity')}</span>${icon('chevron')}</button>
      </div>
      <div class="sel-chips"><div class="lbl" id="cSelCount" style="margin-bottom:6px"></div><div class="chips" id="cChips"></div></div>
    </div>
    <div class="c-main">
      <div class="toolbar c-toolbar">
        <div class="field"><label class="lbl-wide">${t('gran')}</label><div id="cGran"></div></div>
        <div class="field"><label class="lbl-wide">${t('range')}</label><div id="cRange" class="seg"></div></div>
        <div class="field" style="min-width:0"><label class="lbl-wide">${t('indicator')}</label><div id="cInd" class="seg"></div></div>
      </div>
      <div class="panel c-trend"><div class="panel-head"><div class="panel-title" id="cTrendTitle"></div><span class="spacer"></span><span class="head-note" id="cTrendNote"></span></div><div class="chart-box"><div class="chart" id="cTrend"></div></div></div>
      <div class="panel c-heat"><div class="panel-head"><div class="panel-title" id="cHeatTitle"></div></div><div class="chart-box"><div class="chart" id="cHeat"></div></div></div>
      <div class="panel c-radar"><div class="panel-head"><div class="panel-title" id="cRadarTitle"></div></div><div class="chart-box"><div class="chart" id="cRadar"></div></div></div>
      <div class="panel c-stats"><div class="panel-head"><div class="panel-title" id="cStatsTitle"></div><span class="spacer"></span><span class="head-note" id="cStatsNote"></span></div><div class="table-wrap" id="cStats"></div></div>
      <div class="foot-note" style="grid-column:1/-1;margin-top:0">${esc(t('footNote'))}</div>
    </div>
  </div>`;
}

function renderRegionSelect() {
  const zh = getLang() === 'zh';
  const opt = (v, l) => `<option value="${v}"${v === C.region ? ' selected' : ''}>${esc(l)}</option>`;
  root.querySelector('#cRegion').innerHTML =
    `<optgroup label="${esc(t('region'))}">${REGIONS.map((r) => opt(r.id, zh ? r.zh : r.en)).join('')}</optgroup>` +
    `<optgroup label="${esc(t('provinceList'))}">${PROVINCES.map((p, i) => opt('prov:' + i, zh ? p[0] : p[1])).join('')}</optgroup>` +
    (C.region === 'custom' ? opt('custom', t('customSel')) : '');
}

function renderCityList() {
  const list = C.region === 'custom' ? C.selected : regionCities(C.region);
  const d = M.NOW.day;
  root.querySelector('#cCities').innerHTML = list.map((ci) => {
    const on = C.selected.includes(ci);
    const s = snapshot(cityE(ci), 'day', d, M.NOW.hour);
    const col = on ? colorOf(ci) : 'transparent';
    return `<div class="c-city${on ? ' on' : ''}" data-city="${ci}"><span class="cb" style="background:${col};border-color:${on ? col : ''}">${on ? icon('check') : ''}</span>
      <span class="nm">${esc(cityName(ci))}</span><span class="val" style="color:${s ? levelColor(s.aqi) : ''}" title="${t('today')} AQI">${s ? s.aqi : '—'}</span></div>`;
  }).join('') || `<div class="empty">${t('noData')}</div>`;
  root.querySelector('#cSelCount').textContent = t('selected', { n: C.selected.length });
  root.querySelector('#cChips').innerHTML = C.selected.map((ci) => `<span class="chip"><span class="sw" style="background:${colorOf(ci)}"></span>${esc(cityName(ci))}<button type="button" data-remove="${ci}" aria-label="remove">${icon('close')}</button></span>`).join('');
}

function renderControls() {
  granSeg.render();
  const rangeLabel = (n) => (C.gran === 'hour' ? t('lastH', { n }) : C.gran === 'day' ? t('lastD', { n }) : C.gran === 'month' ? t('lastM', { n }) : t('allYears', { a: DATA_START_YEAR, b: yearOf(M.NOW.day) }));
  root.querySelector('#cRange').innerHTML = RANGES[C.gran].map((n) => `<button type="button" data-range="${n}" class="${C.range[C.gran] === n ? 'on' : ''}">${rangeLabel(n)}</button>`).join('');
  const opts = indicatorOptions();
  if (!opts.some(([v]) => v === C.ind)) C.ind = 'aqi';
  root.querySelector('#cInd').innerHTML = opts.map(([v, l]) => `<button type="button" data-ind="${v}" class="${v === C.ind ? 'on' : ''}">${l}</button>`).join('');
}

// ---------------------------------------------------------------- charts
function renderTrend() {
  const { st, cities, vals } = data;
  const shown = cities.slice(0, MAX_TREND);
  const unit = indUnit();
  const series = shown.map((ci) => ({
    name: cityName(ci), type: 'line', data: vals.get(ci).map((x) => (x ? x.v : null)), color: colorOf(ci),
    symbol: st.length > 60 ? 'none' : 'circle', symbolSize: 4, smooth: 0.2, lineStyle: { width: 1.8 }, emphasis: { focus: 'series', lineStyle: { width: 3 } },
  }));
  // Grade II reference line
  let ref = null;
  if (C.ind === 'aqi') ref = 100;
  else if (typeof C.ind === 'number') ref = aggregated() ? ANNUAL_STD[C.ind] : levelBreaks(C.ind, C.gran === 'hour' ? 'hour' : 'day')[1];
  if (series.length && ref != null) {
    series[0].markLine = { symbol: 'none', silent: true, data: [{ yAxis: ref }], lineStyle: { color: '#f5383f', type: 'dashed', opacity: 0.7 }, label: { formatter: aggregated() && C.ind !== 'aqi' ? `${t('annual')} ${ref}` : `${ref}`, color: '#f87171', fontSize: 10, position: 'insideEndTop' } };
  }
  charts.trend.setOption({
    grid: { left: 46, right: 20, top: 40, bottom: st.length > 40 ? 58 : 30 },
    legend: { type: 'scroll', top: 4, left: 70, right: 10, pageIconColor: '#7d8fab', pageTextStyle: { color: '#7d8fab' } },
    tooltip: {
      trigger: 'axis', confine: true,
      formatter: (ps) => {
        const s = st[ps[0].dataIndex];
        let html = `<div style="margin-bottom:4px;color:#9fb0c8">${esc(s.full)} · ${esc(indLabel())}</div>`;
        ps.slice().sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).forEach((p) => { if (p.value != null) html += tooltipRow(p.color, esc(p.seriesName), p.value + (unit ? ` <span style="color:#7d8fab;font-weight:400">${unit}</span>` : '')); });
        return html;
      },
    },
    xAxis: { type: 'category', data: st.map((s) => s.label), boundaryGap: aggregated(), axisLabel: { fontSize: 10.5 } },
    yAxis: { type: 'value', name: unit || indLabel(), nameGap: 10, splitNumber: 5, scale: C.ind === 'good', max: C.ind === 'good' ? 100 : null },
    dataZoom: st.length > 40 ? [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 8 }] : [],
    series,
  }, { notMerge: true });
  root.querySelector('#cTrendTitle').innerHTML = `${t('trend')}<span class="sub">· ${esc(indLabel())} · ${esc(t({ hour: 'hourly', day: 'daily', month: 'monthly', year: 'annual' }[C.gran]))}</span>`;
  root.querySelector('#cTrendNote').textContent = cities.length > MAX_TREND ? t('maxHint', { n: MAX_TREND }) : '';
}

function heatPieces() {
  if (C.ind === 'aqi' && !aggregated()) return LEVELS.map((L, i) => ({ gte: [0, 51, 101, 151, 201, 301][i], lte: [50, 100, 150, 200, 300, 9999][i], color: L.color, label: levelName(i, true) }));
  if (typeof C.ind === 'number' && !aggregated()) {
    const b = levelBreaks(C.ind, C.gran === 'hour' ? 'hour' : 'day');
    const edges = [0, ...b, 1e9];
    return LEVELS.map((L, i) => Object.assign(i ? { gt: edges[i] } : { gte: 0 }, { lte: edges[i + 1], color: L.color, label: levelName(i, true) }));
  }
  return null;
}

function renderHeat() {
  const { st, heatCities, vals } = data;
  const avg = (ci) => { const a = vals.get(ci).filter(Boolean); return a.reduce((s, x) => s + x.v, 0) / Math.max(1, a.length); };
  const better = C.ind === 'good' ? -1 : 1;
  const rows = heatCities.slice().sort((a, b) => better * (avg(b) - avg(a)));
  const pts = [];
  rows.forEach((ci, y) => vals.get(ci).forEach((x, i) => { if (x) pts.push([i, y, x.v]); }));
  const pieces = heatPieces();
  let visualMap;
  if (pieces) visualMap = { type: 'piecewise', show: false, pieces, dimension: 2 };
  else {
    const vs = pts.map((p) => p[2]);
    const lo = Math.min(...vs), hi = Math.max(...vs);
    visualMap = { type: 'continuous', show: false, min: lo, max: hi === lo ? lo + 1 : hi, dimension: 2, inRange: { color: C.ind === 'good' ? ['#f5383f', '#ff8c1a', '#f2d53c', '#9ad94a', '#2bd66c'] : ['#2bd66c', '#9ad94a', '#f2d53c', '#ff8c1a', '#f5383f'] } };
  }
  const unit = indUnit();
  const selSet = new Set(C.selected);
  const panel = root.querySelector('.c-heat');
  const need = rows.length * 17 + 84;
  panel.style.height = need > 300 ? need + 'px' : '';
  charts.heat.resize();
  charts.heat.setOption({
    grid: { left: 8, right: 12, top: 8, bottom: 26, containLabel: true },
    tooltip: { position: 'top', formatter: (p) => `${esc(cityName(rows[p.data[1]]))} · ${esc(st[p.data[0]].full)}<br>${esc(indLabel())}: <b>${p.data[2]}</b> ${unit}` },
    xAxis: { type: 'category', data: st.map((s) => s.label), splitArea: { show: false }, axisLabel: { fontSize: 10 }, axisLine: { show: false } },
    yAxis: { type: 'category', data: rows.map((ci) => cityName(ci)), axisLabel: { fontSize: 10.5, interval: 0, color: (v, i) => (selSet.has(rows[i]) ? '#e6edf7' : '#5d6e8a') }, axisLine: { show: false }, inverse: true },
    visualMap,
    series: [{ type: 'heatmap', data: pts, itemStyle: { borderColor: '#0e172a', borderWidth: st.length > 100 ? 0 : 1.5, borderRadius: 2 }, emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } }, progressive: 0 }],
  }, { notMerge: true });
  root.querySelector('#cHeatTitle').innerHTML = `${t('heat')}<span class="sub">· ${esc(regionLabel(C.region))} · ${rows.length}</span>`;
}

function renderRadar() {
  const { cities, prof } = data;
  const shown = cities.slice(0, MAX_TREND);
  const ratio = (s) => (s ? [s.mean[0] / 35, s.mean[1] / 70, s.o3p90 / 160, s.mean[3] / 40, s.mean[4] / 60, s.cop95 / 4] : [0, 0, 0, 0, 0, 0]);
  const all = shown.map((ci) => ratio(prof.get(ci)));
  const maxV = Math.max(1.2, ...all.flat()) * 1.05;
  charts.radar.setOption({
    tooltip: { trigger: 'item', confine: true, formatter: (p) => `<b>${esc(p.name)}</b><br>` + p.value.map((v, i) => tooltipRow('#7d8fab', ['PM2.5', 'PM10', 'O₃-8h⁹⁰', 'NO₂', 'SO₂', 'CO⁹⁵'][i], v.toFixed(2))).join('') },
    legend: { show: false },
    radar: {
      center: ['50%', '54%'], radius: '66%', splitNumber: 4,
      indicator: ['PM2.5', 'PM10', 'O₃', 'NO₂', 'SO₂', 'CO'].map((n) => ({ name: n, max: +maxV.toFixed(2) })),
      axisName: { color: '#a4b4cc', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(148,178,226,0.14)' } },
      splitArea: { areaStyle: { color: ['rgba(56,189,248,0.02)', 'rgba(56,189,248,0.05)'] } },
      axisLine: { lineStyle: { color: 'rgba(148,178,226,0.16)' } },
    },
    series: [
      { type: 'radar', symbol: 'none', data: shown.map((ci, j) => ({ name: cityName(ci), value: all[j].map((v) => +v.toFixed(3)), lineStyle: { color: colorOf(ci), width: 1.6 }, itemStyle: { color: colorOf(ci) }, areaStyle: { color: colorOf(ci), opacity: 0.08 } })), emphasis: { lineStyle: { width: 3 }, areaStyle: { opacity: 0.25 } } },
      { type: 'radar', silent: true, symbol: 'none', data: [{ name: 'std', value: [1, 1, 1, 1, 1, 1], lineStyle: { color: '#f5383f', type: 'dashed', width: 1, opacity: 0.7 }, areaStyle: { opacity: 0 } }] },
    ],
  }, { notMerge: true });
  root.querySelector('#cRadarTitle').innerHTML = `${t('profile')}<span class="sub">· ${esc(t('profileNote'))}</span>`;
}

const shortAt = (s) => (aggregated() ? s.replace(/ \(.*\)$/, '') : s.replace(/^\d{4}-/, '').replace(/ \(.*\)$/, ''));

function renderStats() {
  const { st, cities, vals } = data;
  const unit = indUnit();
  const rows = cities.map((ci) => {
    const xs = vals.get(ci);
    const ok = xs.map((x, i) => [x, i]).filter(([x]) => x);
    if (!ok.length) return { ci, mean: null };
    const mean = ok.reduce((s, [x]) => s + x.v, 0) / ok.length;
    let mx = ok[0], mn = ok[0];
    for (const o of ok) { if (o[0].v > mx[0].v) mx = o; if (o[0].v < mn[0].v) mn = o; }
    const exc = ok.filter(([x]) => exceeds(x)).length;
    const good = C.ind === 'aqi' && !aggregated() ? ok.filter(([x]) => x.v <= 100).length / ok.length : null;
    return { ci, mean, max: mx[0].v, maxAt: st[mx[1]].full, min: mn[0].v, minAt: st[mn[1]].full, exc, n: ok.length, good };
  }).filter((r) => r.mean != null);
  const better = C.ind === 'good' ? -1 : 1;
  const ranked = rows.slice().sort((a, b) => better * (a.mean - b.mean));
  ranked.forEach((r, i) => { r.rank = i + 1; });
  const key = C.sortKey;
  rows.sort((a, b) => (key === 'name' ? cityName(a.ci).localeCompare(cityName(b.ci)) : (a[key] ?? 0) - (b[key] ?? 0)) * C.sortDir);
  const dig = C.ind === 5 || C.ind === 'ci' ? 2 : C.ind === 'good' ? 1 : 0;
  const f = (v) => (v == null ? '—' : v.toFixed(dig));
  const mMin = Math.min(...rows.map((r) => r.mean)), mMax = Math.max(...rows.map((r) => r.mean));
  const colFor = (v) => {
    if (C.ind === 'aqi' && !aggregated()) return levelColor(Math.round(v));
    if (typeof C.ind === 'number' && !aggregated()) return levelColor(pollutantIAQI(C.ind, v, C.gran === 'hour' ? 'hour' : 'day'));
    const fr = mMax > mMin ? (v - mMin) / (mMax - mMin) : 0;
    const ramp = ['#2bd66c', '#9ad94a', '#f2d53c', '#ff8c1a', '#f5383f'];
    return ramp[Math.round((C.ind === 'good' ? 1 - fr : fr) * 4)];
  };
  const th = (k, label, cls = '') => `<th class="sortable ${cls}${C.sortKey === k ? ' sorted' + (C.sortDir < 0 ? ' desc' : '') : ''}" data-sort="${k}">${label}</th>`;
  const regionMean = rows.reduce((s, r) => s + r.mean, 0) / Math.max(1, rows.length);
  const body = rows.map((r) => `<tr>
      <td class="c"><span class="rank${r.rank <= 3 ? ' top' : ''}">${r.rank}</span></td>
      <td class="l"><span class="swatch" style="background:${colorOf(r.ci)};margin-right:8px;vertical-align:-1px"></span><span class="name">${esc(cityName(r.ci))}</span><span class="sub">${esc(provName(CITIES[r.ci][2]))}</span></td>
      <td><span class="bar-cell" style="color:${colFor(r.mean)}"><i style="width:${Math.round(6 + (60 * (r.mean - mMin)) / Math.max(1e-6, mMax - mMin))}px"></i><b style="color:var(--text)">${f(r.mean)}</b></span></td>
      <td title="${esc(r.maxAt)}">${f(r.max)} <span class="muted" style="font-size:11px">${esc(shortAt(r.maxAt))}</span></td>
      <td title="${esc(r.minAt)}">${f(r.min)} <span class="muted" style="font-size:11px">${esc(shortAt(r.minAt))}</span></td>
      <td>${C.ind === 'ci' || C.ind === 'good' ? '—' : `${r.exc} <span class="muted">/ ${r.n}</span>`}</td>
      <td>${r.good == null ? '—' : (r.good * 100).toFixed(1) + '%'}</td></tr>`).join('');
  const wrap = root.querySelector('#cStats');
  wrap.innerHTML = rows.length ? `<table class="tbl"><thead><tr>${th('rank', t('rankSel'), 'c')}${th('name', t('city'), 'l')}${th('mean', `${t('mean')}${unit ? ' (' + unit + ')' : ''}`)}${th('max', t('max'))}${th('min', t('min'))}${th('exc', t('exceed'))}${th('good', t('kGood'))}</tr></thead>
    <tbody>${body}<tr class="avg"><td></td><td class="l">${t('avgComp')}</td><td>${f(regionMean)}</td><td colspan="4"></td></tr></tbody></table>` : `<div class="empty">${t('pickHint')}</div>`;
  root.querySelector('#cStatsTitle').innerHTML = `${t('stats')}<span class="sub">· ${esc(indLabel())} · ${esc(data.st[0].full)} – ${esc(data.st[data.st.length - 1].full)}</span>`;
}

function renderCharts() {
  if (!C.selected.length) {
    for (const k of ['trend', 'radar']) charts[k].clear();
    root.querySelector('#cStats').innerHTML = `<div class="empty">${t('pickHint')}</div>`;
  }
  const busy = document.createElement('div');
  busy.className = 'busy';
  busy.textContent = t('loading');
  root.querySelector('.c-trend').appendChild(busy);
  afterPaint(() => {
    busy.remove();
    if (!root.classList.contains('on')) { deferred = true; return; }
    data = compute();
    if (C.selected.length) { renderTrend(); renderRadar(); renderStats(); }
    renderHeat();
  });
}

function renderAll() {
  renderRegionSelect();
  renderCityList();
  renderControls();
  renderCharts();
}

// ---------------------------------------------------------------- events
function setSelected(list) {
  C.selected = list;
  renderCityList();
  renderCharts();
}

function bindElements() {
  granSeg = segmented(root.querySelector('#cGran'), [
    { v: 'hour', label: () => t('hourly') }, { v: 'day', label: () => t('daily') }, { v: 'month', label: () => t('monthly') }, { v: 'year', label: () => t('annual') },
  ], C.gran, (v) => { C.gran = v; renderControls(); renderCharts(); });
  addPicker = new Picker({
    anchor: root.querySelector('#cAdd'), multi: true, width: 300, placeholder: t('search'),
    getItems: () => cityItems(), getValue: () => new Set(C.selected),
    onChange: (set) => {
      const next = C.selected.filter((ci) => set.has(ci));
      for (const ci of set) if (!next.includes(ci)) next.push(ci);
      const inRegion = C.region !== 'custom' && next.every((ci) => regionCities(C.region).includes(ci));
      if (!inRegion && C.region !== 'custom') { C.region = 'custom'; renderRegionSelect(); }
      setSelected(next);
    },
  });
}

function bindOnce() {
  root.addEventListener('change', (ev) => {
    if (ev.target.id !== 'cRegion') return;
    C.region = ev.target.value;
    renderRegionSelect();
    setSelected(regionCities(C.region));
  });
  on(root, 'click', '.c-city[data-city]', (ev, el) => {
    const ci = +el.dataset.city;
    setSelected(C.selected.includes(ci) ? C.selected.filter((x) => x !== ci) : [...C.selected, ci]);
  });
  on(root, 'click', '[data-remove]', (ev, el) => {
    const ci = +el.dataset.remove;
    setSelected(C.selected.filter((x) => x !== ci));
  });
  on(root, 'click', '[data-act]', (ev, el) => {
    if (el.dataset.act === 'all') setSelected([...new Set([...C.selected, ...(C.region === 'custom' ? [] : regionCities(C.region))])]);
    else if (el.dataset.act === 'clear') setSelected([]);
  });
  on(root, 'click', '[data-range]', (ev, el) => { C.range[C.gran] = +el.dataset.range; renderControls(); renderCharts(); });
  on(root, 'click', '[data-ind]', (ev, el) => { const v = el.dataset.ind; C.ind = /^\d$/.test(v) ? +v : v; renderControls(); renderCharts(); });
  on(root, 'click', 'th[data-sort]', (ev, el) => {
    const k = el.dataset.sort;
    if (C.sortKey === k) C.sortDir = -C.sortDir; else { C.sortKey = k; C.sortDir = 1; }
    renderStats();
  });
}

function build() {
  layout();
  for (const k of Object.keys(charts)) charts[k].dispose();
  charts = {
    trend: makeChart(root.querySelector('#cTrend')),
    heat: makeChart(root.querySelector('#cHeat')),
    radar: makeChart(root.querySelector('#cRadar')),
  };
  bindElements();
}

export default {
  mount(el) {
    root = el;
    C.selected = regionCities(C.region);
    build();
    bindOnce();
    renderAll();
  },
  show() {
    Object.values(charts).forEach((c) => c.resize());
    if (deferred) { deferred = false; renderCharts(); }
  },
  relang() { build(); renderAll(); },
  newHour() { renderAll(); },
};

import { CITIES, COUNTIES, STATIONS, PROVINCES } from '../data/geo-data.js';
import * as M from '../core/model.js';
import { hourlyAQI, dailyAQI, levelIndex, LEVELS, levelColor, pollutantIAQI } from '../core/aqi.js';
import { t, cityName, provName, countyName, stationName, entityName, levelName, POL_LABEL, POL_PLAIN, fmtVal, primaryLabel, getLang } from '../core/i18n.js';
import { makeChart, tooltipRow, SERIES_COLORS } from '../ui/charts.js';
import { segmented, Picker } from '../ui/widgets.js';
import { esc, icon, on, download, toast, afterPaint } from '../ui/dom.js';
import { fmtDay, fmtShort, fmtMonth, parseDay, yearOf, monthOf, firstDayOfMonth, daysInMonth, firstDayOfYear, pad } from '../core/time.js';
import { XIAN, cityItems, countyItems, stationItems, cityCounties, cityStations } from '../core/query.js';

const FIELDS = ['aqi', 'level', 'primary', 'pm25', 'pm10', 'o3', 'no2', 'so2', 'co'];
const H = {
  level: 'city', prov: CITIES[XIAN][2], cities: [XIAN], city: XIAN, counties: new Set(), stations: new Set(),
  gran: 'day', from: 0, to: 0, fields: new Set(FIELDS), page: 1, size: 20, sortKey: 'time', sortDir: -1, res: null,
};
let root, charts = {}, levelSeg, granSeg, pickers = {}, deferred = false;

// ---------------------------------------------------------------- selection helpers
const provCityItems = () => cityItems((i) => H.prov < 0 || CITIES[i][2] === H.prov);
function locations() {
  if (H.level === 'city') return H.cities.map((i) => ({ t: 'city', i }));
  if (H.level === 'county') return [...H.counties].sort((a, b) => a - b).map((i) => ({ t: 'county', i }));
  return [...H.stations].sort((a, b) => a - b).map((i) => ({ t: 'station', i }));
}
function resetSubSelection() {
  H.counties = new Set(cityCounties(H.city));
  H.stations = new Set(cityStations(H.city));
}

// ---------------------------------------------------------------- query
function steps(from, to) {
  const out = [];
  if (H.gran === 'hour') {
    for (let d = from; d <= to; d++) for (let h = 0; h < 24; h++) if (M.hasHour(d, h)) out.push({ d, h, key: d * 24 + h, label: `${fmtDay(d)} ${pad(h)}:00` });
  } else if (H.gran === 'day') {
    for (let d = from; d <= to; d++) if (M.hasDay(d)) out.push({ d, key: d, label: fmtDay(d) + (d === M.NOW.day ? ` (${t('cumulative')})` : '') });
  } else {
    let y = yearOf(from), m = monthOf(from);
    while (firstDayOfMonth(y, m) <= to) {
      const d0 = Math.max(from, firstDayOfMonth(y, m));
      const d1 = Math.min(to, firstDayOfMonth(y, m) + daysInMonth(y, m) - 1, M.NOW.day);
      if (d1 >= d0 && d1 >= M.FIRST_DAY) out.push({ d0, d1, key: d0, label: fmtMonth(y, m) + (d1 - d0 + 1 < daysInMonth(y, m) ? ` (${fmtShort(d0)}–${fmtShort(d1)})` : '') });
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  return out;
}

function runQuery() {
  let from = Math.max(M.FIRST_DAY, Math.min(H.from, H.to));
  let to = Math.min(M.NOW.day, Math.max(H.from, H.to));
  if (H.gran === 'hour' && to - from > 30) { from = to - 30; H.from = from; H.to = to; syncDates(); toast(t('hourLimit')); }
  const locs = locations();
  if (!locs.length) { toast(t('pickSome')); return; }
  const st = steps(from, to);
  const rows = [];
  for (const e of locs) {
    const name = entityName(e, H.level !== 'city');
    for (const s of st) {
      let vals, a;
      if (H.gran === 'hour') {
        vals = M.hourValues(e, s.d, s.h);
        if (!vals) continue;
        a = hourlyAQI(vals);
      } else if (H.gran === 'day') {
        const rec = M.dayRecord(e, s.d);
        if (!rec) continue;
        vals = Array.from(rec.subarray(0, 6));
        a = dailyAQI(rec);
      } else {
        const ps = M.periodStats(e, s.d0, s.d1);
        if (!ps) continue;
        vals = [ps.mean[0], ps.mean[1], ps.o3p90, ps.mean[3], ps.mean[4], ps.cop95];
        const aqi = Math.round(ps.aqiMean);
        a = { aqi, primary: aqi > 50 ? [ps.ciPrimary] : [] };
      }
      rows.push({ e, name, key: s.key, time: s.label, aqi: a.aqi, primary: a.primary, vals });
    }
  }
  H.res = { rows, from, to, locs, gran: H.gran };
  H.page = 1;
  renderResults();
}

// ---------------------------------------------------------------- layout
function layout() {
  root.innerHTML = `
  <div class="history">
    <div class="panel h-form">
      <div class="fg span3"><span class="lbl">${t('qLevel')}</span><div id="hLevel"></div></div>
      <div class="fg span2"><span class="lbl">${t('qProvince')}</span><select class="select" id="hProv"></select></div>
      <div class="fg span3" id="hCityWrap"></div>
      <div class="fg span4" id="hSubWrap"></div>
      <div class="fg span3"><span class="lbl">${t('gran')}</span><div id="hGran"></div></div>
      <div class="fg span2"><span class="lbl">${t('from')}</span><input class="input" type="date" id="hFrom"></div>
      <div class="fg span2"><span class="lbl">${t('to')}</span><input class="input" type="date" id="hTo"></div>
      <div class="fg span5"><span class="lbl">${t('quick')}</span><div class="seg" id="hQuick">
        ${[['7', 'q7'], ['30', 'q30'], ['month', 'qMonth'], ['year', 'qYear'], ['prev', 'qPrevYear']].map(([v, k]) => `<button type="button" data-quick="${v}">${t(k)}</button>`).join('')}
      </div></div>
      <div class="fg span8"><span class="lbl">${t('fields')}</span><div class="checks" id="hFields"></div></div>
      <div class="fg span4"><div class="actions">
        <button class="btn" type="button" data-act="reset">${t('reset')}</button>
        <div class="export-menu" id="hExport"><button class="btn" type="button" data-act="exportmenu">${icon('download')}${t('exportCsv').replace('CSV', '').trim() || 'Export'}</button>
          <div class="menu"><button type="button" data-act="csv">${icon('download')}${t('exportCsv')}</button><button type="button" data-act="xls">${icon('download')}${t('exportXls')}</button></div></div>
        <button class="btn primary" type="button" data-act="query">${icon('search')}${t('doQuery')}</button>
      </div></div>
    </div>
    <div class="h-kpis" id="hKpis"></div>
    <div class="panel h-trend"><div class="panel-head"><div class="panel-title" id="hTrendTitle"></div></div><div class="chart-box"><div class="chart" id="hTrend"></div></div></div>
    <div class="panel h-dist"><div class="panel-head"><div class="panel-title">${t('levelDist')}</div></div><div class="chart-box"><div class="chart" id="hDist"></div></div></div>
    <div class="panel h-table">
      <div class="panel-head"><div class="panel-title" id="hTableTitle"></div><span class="spacer"></span><span class="head-note" id="hTableNote"></span></div>
      <div class="table-wrap" id="hTable"></div>
      <div class="pager" id="hPager"></div>
    </div>
  </div>
  <div class="foot-note">${esc(t('footNote'))}</div>`;
}

function renderForm() {
  levelSeg.render();
  granSeg.render();
  const zh = getLang() === 'zh';
  root.querySelector('#hProv').innerHTML = (H.level === 'city' ? `<option value="-1"${H.prov < 0 ? ' selected' : ''}>${zh ? '全国' : 'All provinces'}</option>` : '') +
    PROVINCES.map((p, i) => `<option value="${i}"${i === H.prov ? ' selected' : ''}>${esc(zh ? p[0] : p[1])}</option>`).join('');
  const cityWrap = root.querySelector('#hCityWrap');
  const subWrap = root.querySelector('#hSubWrap');
  if (H.level === 'city') {
    cityWrap.innerHTML = `<span class="lbl">${t('qCities')}</span><button class="pick-btn" id="hCities" type="button">${icon('pin')}<span class="pb-label"></span>${icon('chevron')}</button>`;
    subWrap.innerHTML = `<span class="lbl">&nbsp;</span><div class="chips" id="hCityChips" style="min-height:32px;align-items:center"></div>`;
    pickers.cities = new Picker({
      anchor: root.querySelector('#hCities'), multi: true, width: 300, getItems: provCityItems, getValue: () => new Set(H.cities),
      onChange: (set) => { H.cities = [...set]; renderSelLabels(); },
    });
  } else {
    cityWrap.innerHTML = `<span class="lbl">${t('qCity')}</span><button class="pick-btn" id="hCity" type="button">${icon('pin')}<span class="pb-label"></span>${icon('chevron')}</button>`;
    subWrap.innerHTML = `<span class="lbl">${t(H.level === 'county' ? 'qCounties' : 'qStations')}</span><button class="pick-btn" id="hSub" type="button">${icon(H.level === 'county' ? 'pin' : 'station')}<span class="pb-label"></span>${icon('chevron')}</button>`;
    pickers.city = new Picker({
      anchor: root.querySelector('#hCity'), width: 280, getItems: provCityItems, getValue: () => H.city,
      onChange: (id) => { H.city = id; resetSubSelection(); renderSelLabels(); },
    });
    pickers.sub = new Picker({
      anchor: root.querySelector('#hSub'), multi: true, width: 320, placeholder: t('searchAny'),
      getItems: () => (H.level === 'county' ? countyItems(H.city) : stationItems(H.city)),
      getValue: () => (H.level === 'county' ? H.counties : H.stations),
      onChange: (set) => { if (H.level === 'county') H.counties = set; else H.stations = set; renderSelLabels(); },
    });
  }
  renderSelLabels();
  syncDates();
  root.querySelector('#hFields').innerHTML = FIELDS.map((f) => {
    const label = f === 'aqi' ? 'AQI' : f === 'level' ? t('level') : f === 'primary' ? t('primaryShort') : POL_LABEL[['pm25', 'pm10', 'o3', 'no2', 'so2', 'co'].indexOf(f)];
    const onF = H.fields.has(f);
    return `<span class="check${onF ? ' on' : ''}" data-field="${f}"><span class="cb">${onF ? icon('check') : ''}</span>${label}</span>`;
  }).join('');
}

function renderSelLabels() {
  if (H.level === 'city') {
    const b = root.querySelector('#hCities .pb-label');
    if (b) b.textContent = H.cities.length === 1 ? cityName(H.cities[0]) : t('selected', { n: H.cities.length });
    const chips = root.querySelector('#hCityChips');
    if (chips) chips.innerHTML = H.cities.slice(0, 8).map((ci) => `<span class="chip">${esc(cityName(ci))}<button type="button" data-rmcity="${ci}">${icon('close')}</button></span>`).join('') + (H.cities.length > 8 ? `<span class="muted">+${H.cities.length - 8}</span>` : '');
  } else {
    const c = root.querySelector('#hCity .pb-label');
    if (c) c.textContent = cityName(H.city);
    const s = root.querySelector('#hSub .pb-label');
    const set = H.level === 'county' ? H.counties : H.stations;
    const total = H.level === 'county' ? CITIES[H.city][9] : CITIES[H.city][11];
    if (s) s.textContent = set.size === 1 ? entityName({ t: H.level, i: [...set][0] }) : t('selCount', { n: set.size, m: total }) + ' · ' + t(H.level === 'county' ? 'qCounties' : 'qStations');
  }
}

function syncDates() {
  const f = root.querySelector('#hFrom'), to = root.querySelector('#hTo');
  for (const el of [f, to]) { el.min = fmtDay(M.FIRST_DAY); el.max = fmtDay(M.NOW.day); }
  f.value = fmtDay(H.from);
  to.value = fmtDay(H.to);
}

// ---------------------------------------------------------------- results
const polIdx = { pm25: 0, pm10: 1, o3: 2, no2: 3, so2: 4, co: 5 };
function o3Head(gran) { return gran === 'hour' ? 'O₃' : gran === 'day' ? 'O₃-8h' : 'O₃-8h⁹⁰'; }
function coHead(gran) { return gran === 'month' ? 'CO⁹⁵' : 'CO'; }
function colLabel(f, gran) {
  if (f === 'aqi') return gran === 'month' ? `AQI (${t('mean')})` : 'AQI';
  if (f === 'level') return t('level');
  if (f === 'primary') return t('primaryShort');
  if (f === 'o3') return o3Head(gran);
  if (f === 'co') return coHead(gran);
  return POL_LABEL[polIdx[f]];
}

function sortedRows() {
  const rows = H.res.rows.slice();
  const k = H.sortKey, dir = H.sortDir;
  rows.sort((a, b) => {
    let c;
    if (k === 'time') c = a.key - b.key || a.name.localeCompare(b.name);
    else if (k === 'name') c = a.name.localeCompare(b.name) || a.key - b.key;
    else if (k === 'aqi' || k === 'level') c = a.aqi - b.aqi;
    else c = a.vals[polIdx[k]] - b.vals[polIdx[k]];
    return c * dir;
  });
  return rows;
}

function renderResults() {
  const res = H.res;
  if (!res) {
    root.querySelector('#hKpis').innerHTML = '';
    root.querySelector('#hTable').innerHTML = `<div class="empty">${t('qEmpty')}</div>`;
    return;
  }
  renderKpis(res);
  renderTrend(res);
  renderDist(res);
  renderTable();
}

function renderKpis(res) {
  const rows = res.rows;
  const n = rows.length;
  const mean = n ? rows.reduce((s, r) => s + r.aqi, 0) / n : 0;
  let mx = rows[0];
  for (const r of rows) if (r.aqi > mx.aqi) mx = r;
  const good = rows.filter((r) => r.aqi <= 100).length;
  const over = n - good;
  const prim = [0, 0, 0, 0, 0, 0];
  rows.forEach((r) => r.primary.forEach((p) => prim[p]++));
  const top = prim.indexOf(Math.max(...prim));
  const card = (k, v, d, col) => `<div class="panel stat-card"><div class="k">${k}</div><div class="v"${col ? ` style="color:${col}"` : ''}>${v}</div><div class="d">${d || '&nbsp;'}</div></div>`;
  const unitWord = { hour: t('hoursUnit'), day: t('days'), month: t('monthly') }[res.gran];
  root.querySelector('#hKpis').innerHTML =
    card(t('records'), n.toLocaleString(), `${res.locs.length} × ${fmtDay(res.from)} – ${fmtDay(res.to)}`) +
    card(t('meanAqi'), n ? Math.round(mean) : '—', n ? levelName(levelIndex(Math.round(mean))) : '', n ? levelColor(Math.round(mean)) : null) +
    card(t('maxAqi'), mx ? mx.aqi : '—', mx ? `${esc(mx.name)} · ${esc(mx.time)}` : '', mx ? levelColor(mx.aqi) : null) +
    card(t('kGood'), n ? `${((100 * good) / n).toFixed(1)}%` : '—', `${good} / ${n}`, '#5ee08f') +
    card(t('overDays'), over.toLocaleString(), `AQI > 100 · ${unitWord}`, over ? '#ff8c1a' : null) +
    card(t('topPrimary'), prim[top] ? POL_LABEL[top] : '—', prim[top] ? `${prim[top]} / ${n}` : '');
}

function renderTrend(res) {
  const locs = res.locs.slice(0, 10);
  const keys = [...new Set(res.rows.map((r) => r.key))].sort((a, b) => a - b);
  const labelOf = new Map(res.rows.map((r) => [r.key, r.time]));
  const idx = new Map(keys.map((k, i) => [k, i]));
  const byLoc = new Map(locs.map((e) => [e.t + e.i, new Array(keys.length).fill(null)]));
  for (const r of res.rows) { const a = byLoc.get(r.e.t + r.e.i); if (a) a[idx.get(r.key)] = r.aqi; }
  const series = locs.map((e, j) => ({
    name: entityName(e, false), type: 'line', data: byLoc.get(e.t + e.i), color: SERIES_COLORS[j % SERIES_COLORS.length],
    symbol: keys.length > 60 ? 'none' : 'circle', symbolSize: 4, smooth: 0.2, lineStyle: { width: 1.6 }, emphasis: { focus: 'series' },
  }));
  if (series.length) series[0].markLine = { symbol: 'none', silent: true, data: [{ yAxis: 100 }], lineStyle: { color: '#f5383f', type: 'dashed', opacity: 0.7 }, label: { formatter: '100', color: '#f87171', fontSize: 10, position: 'insideEndTop' } };
  charts.trend.setOption({
    grid: { left: 42, right: 18, top: 38, bottom: keys.length > 60 ? 54 : 28 },
    legend: { type: 'scroll', top: 4, left: 70, right: 10, pageIconColor: '#7d8fab', pageTextStyle: { color: '#7d8fab' } },
    tooltip: {
      trigger: 'axis', confine: true,
      formatter: (ps) => `<div style="color:#9fb0c8;margin-bottom:4px">${esc(labelOf.get(keys[ps[0].dataIndex]))}</div>` + ps.filter((p) => p.value != null).map((p) => tooltipRow(p.color, esc(p.seriesName), `<span style="color:${levelColor(p.value)}">${p.value}</span>`)).join(''),
    },
    xAxis: { type: 'category', data: keys.map((k) => labelOf.get(k).replace(/^\d{4}-/, '').replace(/ \(.*\)$/, '')), axisLabel: { fontSize: 10.5 } },
    yAxis: { type: 'value', name: 'AQI', nameGap: 10, splitNumber: 5 },
    dataZoom: keys.length > 60 ? [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 8 }] : [],
    series,
  }, { notMerge: true });
  root.querySelector('#hTrendTitle').innerHTML = `${t('queryTrend')}<span class="sub">· ${esc(t({ hour: 'hourly', day: 'daily', month: 'monthly' }[res.gran]))}${res.locs.length > 10 ? ' · ' + t('maxHint', { n: 10 }) : ''}</span>`;
}

function renderDist(res) {
  const counts = [0, 0, 0, 0, 0, 0];
  res.rows.forEach((r) => counts[levelIndex(r.aqi)]++);
  const n = res.rows.length;
  charts.dist.setOption({
    tooltip: { trigger: 'item', formatter: (p) => `${esc(p.name)}: <b>${p.value}</b> (${p.percent}%)` },
    legend: { orient: 'vertical', right: 10, top: 'middle', itemGap: 8, formatter: (name) => { const i = LEVELS.findIndex((_, j) => levelName(j, true) === name); return `${name}  ${counts[i]}`; } },
    title: { text: n ? `${((100 * (counts[0] + counts[1])) / n).toFixed(1)}%` : '—', subtext: t('kGood'), left: '34%', top: '40%', textAlign: 'center', textStyle: { color: '#e6edf7', fontSize: 20, fontWeight: 700 }, subtextStyle: { color: '#7d8fab', fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['52%', '74%'], center: ['35%', '52%'], avoidLabelOverlap: true, label: { show: false },
      itemStyle: { borderColor: '#0e172a', borderWidth: 2, borderRadius: 4 },
      data: LEVELS.map((L, i) => ({ name: levelName(i, true), value: counts[i], itemStyle: { color: L.color } })),
    }],
  }, { notMerge: true });
}

function renderTable() {
  const res = H.res;
  const rows = sortedRows();
  const n = rows.length;
  const pages = Math.max(1, Math.ceil(n / H.size));
  H.page = Math.min(H.page, pages);
  const slice = rows.slice((H.page - 1) * H.size, H.page * H.size);
  const fields = FIELDS.filter((f) => H.fields.has(f));
  const mode = res.gran === 'hour' ? 'hour' : 'day';
  const th = (k, label, cls = '') => `<th class="sortable ${cls}${H.sortKey === k ? ' sorted' + (H.sortDir < 0 ? ' desc' : '') : ''}" data-sort="${k}">${label}</th>`;
  const head = `<tr>${th('time', t('time'), 'l')}${th('name', t('location'), 'l')}${fields.map((f) => (f === 'primary' ? `<th class="c">${colLabel(f, res.gran)}</th>` : th(f, colLabel(f, res.gran), f === 'level' ? 'c' : ''))).join('')}</tr>`;
  const body = slice.map((r) => {
    const li = levelIndex(r.aqi);
    const cells = fields.map((f) => {
      if (f === 'aqi') return `<td><span class="aqi-pill" style="background:${LEVELS[li].color}26;color:${LEVELS[li].color};box-shadow:inset 0 0 0 1px ${LEVELS[li].color}55">${r.aqi}</span></td>`;
      if (f === 'level') return `<td class="c"><span class="lv" style="background:${LEVELS[li].color};color:${LEVELS[li].ink}">${levelName(li, true)}</span></td>`;
      if (f === 'primary') return `<td class="c">${primaryLabel(r.primary)}</td>`;
      const p = polIdx[f];
      const col = res.gran === 'month' ? 'inherit' : levelColor(pollutantIAQI(p, r.vals[p], mode));
      return `<td style="color:${col}">${fmtVal(p, r.vals[p])}</td>`;
    }).join('');
    return `<tr><td class="l num">${esc(r.time)}</td><td class="l"><span class="name">${esc(r.name)}</span></td>${cells}</tr>`;
  }).join('');
  root.querySelector('#hTable').innerHTML = n ? `<table class="tbl"><thead>${head}</thead><tbody>${body}</tbody></table>` : `<div class="empty">${t('noData')}</div>`;
  root.querySelector('#hTableTitle').innerHTML = `${t('results')}<span class="sub">· ${t('recordsN', { n: n.toLocaleString() })}</span>`;
  root.querySelector('#hTableNote').textContent = res.gran === 'month' ? `${t('monthAvg')} · O₃-8h⁹⁰ = ${t('o3per90')} · CO⁹⁵ = ${t('coper95')}` : '';
  // pager
  const a = n ? (H.page - 1) * H.size + 1 : 0, b = Math.min(n, H.page * H.size);
  const nums = [];
  const win = 2;
  for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - H.page) <= win) nums.push(p); else if (nums[nums.length - 1] !== '…') nums.push('…');
  root.querySelector('#hPager').innerHTML = `
    <span>${t('pageInfo', { a, b, n: n.toLocaleString() })}</span>
    <select class="select" id="hSize">${[20, 50, 100].map((s) => `<option value="${s}"${s === H.size ? ' selected' : ''}>${s} ${t('perPage')}</option>`).join('')}</select>
    <div class="pages"><button type="button" data-page="${H.page - 1}"${H.page <= 1 ? ' disabled' : ''}>‹</button>${nums.map((p) => (p === '…' ? '<span class="muted" style="padding:0 4px">…</span>' : `<button type="button" data-page="${p}" class="${p === H.page ? 'on' : ''}">${p}</button>`)).join('')}<button type="button" data-page="${H.page + 1}"${H.page >= pages ? ' disabled' : ''}>›</button></div>`;
}

// ---------------------------------------------------------------- export
function exportRows() {
  const res = H.res;
  const fields = FIELDS.filter((f) => H.fields.has(f));
  const head = [t('time'), t('location'), ...fields.map((f) => colLabel(f, res.gran).replace('₃', '3').replace('₂', '2').replace('⁹⁰', '-90per').replace('⁹⁵', '-95per'))];
  const lines = sortedRows().map((r) => [r.time, r.name, ...fields.map((f) => {
    if (f === 'aqi') return r.aqi;
    if (f === 'level') return levelName(levelIndex(r.aqi));
    if (f === 'primary') return r.primary.map((p) => POL_PLAIN[p]).join('/') || '-';
    return fmtVal(polIdx[f], r.vals[polIdx[f]]);
  })]);
  return { head, lines };
}
function fileBase() {
  const locs = H.res.locs;
  const first = entityName(locs[0], H.level !== 'city').replace(/[\\/:*?"<>|\s·]+/g, '_');
  return `AQ_history_${first}${locs.length > 1 ? `_etc${locs.length}` : ''}_${H.res.gran}_${fmtDay(H.res.from)}_${fmtDay(H.res.to)}`;
}
function exportCsv() {
  if (!H.res || !H.res.rows.length) { toast(t('noData')); return; }
  const { head, lines } = exportRows();
  const csv = '\ufeff' + [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download(fileBase() + '.csv', csv, 'text/csv;charset=utf-8');
  toast(t('exported', { n: lines.length }));
}
function exportXls() {
  if (!H.res || !H.res.rows.length) { toast(t('noData')); return; }
  const { head, lines } = exportRows();
  const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = (v) => (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)) ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${x(v)}</Data></Cell>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#DCE9F7" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="AQ"><Table>
<Row>${head.map((h) => `<Cell ss:StyleID="h"><Data ss:Type="String">${x(h)}</Data></Cell>`).join('')}</Row>
${lines.map((l) => `<Row>${l.map(cell).join('')}</Row>`).join('\n')}
</Table></Worksheet></Workbook>`;
  download(fileBase() + '.xls', xml, 'application/vnd.ms-excel');
  toast(t('exported', { n: lines.length }));
}

// ---------------------------------------------------------------- events
function quick(v) {
  const today = M.NOW.day;
  const y = yearOf(today);
  if (v === '7') { H.from = today - 6; H.to = today; }
  else if (v === '30') { H.from = today - 29; H.to = today; }
  else if (v === 'month') { H.from = firstDayOfMonth(y, monthOf(today)); H.to = today; }
  else if (v === 'year') { H.from = firstDayOfYear(y); H.to = today; if (H.gran === 'hour') H.gran = 'day'; }
  else if (v === 'prev') { H.from = firstDayOfYear(y - 1); H.to = firstDayOfYear(y) - 1; if (H.gran === 'hour') H.gran = 'day'; }
  granSeg.set(H.gran);
  syncDates();
}

function defaults() {
  H.level = 'city'; H.prov = CITIES[XIAN][2]; H.cities = [XIAN]; H.city = XIAN;
  resetSubSelection();
  H.gran = 'day'; H.from = M.NOW.day - 29; H.to = M.NOW.day; H.fields = new Set(FIELDS);
  H.sortKey = 'time'; H.sortDir = -1; H.size = 20;
}

function bindElements() {
  levelSeg = segmented(root.querySelector('#hLevel'), [{ v: 'city', label: () => t('qCity') }, { v: 'county', label: () => t('qCounty') }, { v: 'station', label: () => t('qStation') }], H.level, (v) => {
    H.level = v;
    if (v !== 'city' && H.prov < 0) H.prov = CITIES[H.city][2];
    if (v !== 'city' && CITIES[H.city][2] !== H.prov) { H.city = CITIES.findIndex((c) => c[2] === H.prov); resetSubSelection(); }
    renderForm();
  });
  granSeg = segmented(root.querySelector('#hGran'), [{ v: 'hour', label: () => t('hourly') }, { v: 'day', label: () => t('daily') }, { v: 'month', label: () => t('monthly') }], H.gran, (v) => {
    H.gran = v;
    if (v === 'hour' && H.to - H.from > 30) { H.from = H.to - 6; syncDates(); }
  });
}

function bindOnce() {
  root.addEventListener('change', (ev) => {
    const id = ev.target.id;
    if (id === 'hProv') {
      H.prov = +ev.target.value;
      if (H.level === 'city') { if (H.prov >= 0) H.cities = H.cities.filter((ci) => CITIES[ci][2] === H.prov); if (!H.cities.length && H.prov >= 0) H.cities = [CITIES.findIndex((c) => c[2] === H.prov)]; }
      else { H.city = CITIES.findIndex((c) => c[2] === H.prov); resetSubSelection(); }
      renderSelLabels();
    } else if (id === 'hFrom' || id === 'hTo') {
      const d = parseDay(ev.target.value);
      if (d == null) return;
      if (id === 'hFrom') H.from = d; else H.to = d;
    } else if (id === 'hSize') { H.size = +ev.target.value; H.page = 1; renderTable(); }
  });
  on(root, 'click', '[data-quick]', (ev, el) => quick(el.dataset.quick));
  on(root, 'click', '[data-field]', (ev, el) => {
    const f = el.dataset.field;
    if (H.fields.has(f)) { if (H.fields.size > 1) H.fields.delete(f); } else H.fields.add(f);
    renderForm();
    if (H.res) renderTable();
  });
  on(root, 'click', '[data-rmcity]', (ev, el) => { H.cities = H.cities.filter((c) => c !== +el.dataset.rmcity); renderSelLabels(); });
  on(root, 'click', '[data-act]', (ev, el) => {
    const a = el.dataset.act;
    const menu = root.querySelector('#hExport');
    if (a === 'query') {
      const tb = root.querySelector('.h-table');
      const busy = document.createElement('div');
      busy.className = 'busy';
      busy.textContent = t('loading');
      tb.appendChild(busy);
      afterPaint(() => { busy.remove(); if (root.classList.contains('on')) runQuery(); else deferred = true; });
    } else if (a === 'reset') { defaults(); levelSeg.set(H.level); granSeg.set(H.gran); renderForm(); }
    else if (a === 'exportmenu') { menu.classList.toggle('open'); return; }
    else if (a === 'csv') exportCsv();
    else if (a === 'xls') exportXls();
    menu.classList.remove('open');
  });
  document.addEventListener('mousedown', (ev) => { const m = root.querySelector('#hExport'); if (m && !m.contains(ev.target)) m.classList.remove('open'); });
  on(root, 'click', 'th[data-sort]', (ev, el) => {
    const k = el.dataset.sort;
    if (H.sortKey === k) H.sortDir = -H.sortDir; else { H.sortKey = k; H.sortDir = k === 'time' ? -1 : 1; }
    renderTable();
  });
  on(root, 'click', '[data-page]', (ev, el) => { if (el.disabled) return; H.page = +el.dataset.page; renderTable(); root.querySelector('#hTable').scrollTop = 0; });
}

function build() {
  layout();
  for (const k of Object.keys(charts)) charts[k].dispose();
  charts = { trend: makeChart(root.querySelector('#hTrend')), dist: makeChart(root.querySelector('#hDist')) };
  bindElements();
  renderForm();
}

export default {
  mount(el) {
    root = el;
    defaults();
    build();
    bindOnce();
    runQuery();
  },
  show() {
    Object.values(charts).forEach((c) => c.resize());
    if (deferred) { deferred = false; runQuery(); }
  },
  relang() {
    build();
    if (H.res) runQuery();
  },
  newHour() { if (H.to >= M.NOW.day - 1) H.to = M.NOW.day; syncDates(); },
};

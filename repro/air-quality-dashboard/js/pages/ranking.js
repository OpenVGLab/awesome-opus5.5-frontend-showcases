import { CITIES, COUNTIES } from '../data/geo-data.js';
import * as M from '../core/model.js';
import { dailyAQI, levelIndex, LEVELS, levelColor, pollutantIAQI } from '../core/aqi.js';
import { t, cityName, provName, countyName, levelName, POL_LABEL, POL_PLAIN, fmtVal, primaryLabel, getLang } from '../core/i18n.js';
import { makeChart } from '../ui/charts.js';
import { segmented, Picker } from '../ui/widgets.js';
import { esc, icon, on, download, toast, afterPaint } from '../ui/dom.js';
import { fmtDay, yearOf, monthOf, dateNum, firstDayOfMonth, daysInMonth, firstDayOfYear, parseDay, dayFromYMD, DATA_START_YEAR, pad } from '../core/time.js';
import { XIAN } from '../core/query.js';

const R = { group: '168', period: 'day', day: 0, ym: [0, 0], year: 0, by: 'aqi', dir: 1, q: '', focus: null };
let root, charts = {}, groupSeg, periodSeg, focusPicker, cache = new Map(), current = null, deferred = false;
const RAMP = ['#2bd66c', '#9ad94a', '#f2d53c', '#ff8c1a', '#f5383f', '#b8327f'];

// ---------------------------------------------------------------- data
function range(a, n) { const r = []; for (let k = a; k < a + n; k++) r.push(k); return r; }
function groupEntities(g) {
  if (g === 'fwc') return CITIES.flatMap((c) => (c[6] & 4 ? range(c[8], c[9]).map((k) => ({ t: 'county', i: k })) : []));
  const mask = { 74: 1, 168: 2, fw: 4 }[g];
  const out = [];
  CITIES.forEach((c, i) => { if (!mask || c[6] & mask) out.push({ t: 'city', i }); });
  return out;
}
const eKey = (e) => e.t[0] + e.i;
const eName = (e) => (e.t === 'city' ? cityName(e.i) : countyName(e.i));
const eParent = (e) => (e.t === 'city' ? provName(CITIES[e.i][2]) : cityName(COUNTIES[e.i][2]));
const cityOfE = (e) => (e.t === 'city' ? e.i : COUNTIES[e.i][2]);

function periodRange() {
  const last = M.NOW.day - 1;
  if (R.period === 'day') return [R.day, R.day];
  let d0, d1;
  if (R.period === 'month') { d0 = firstDayOfMonth(R.ym[0], R.ym[1]); d1 = d0 + daysInMonth(R.ym[0], R.ym[1]) - 1; }
  else { d0 = firstDayOfYear(R.year); d1 = firstDayOfYear(R.year + 1) - 1; }
  d1 = Math.min(d1, last);
  if (d1 < d0) d1 = M.NOW.day;
  return [d0, d1];
}
function shiftYear(d, dy) { return dayFromYMD(yearOf(d) + dy, monthOf(d), Math.min(dateNum(d), 28 + (monthOf(d) === 2 ? 0 : 3))); }

function compute() {
  const [d0, d1] = periodRange();
  const key = `${R.group}|${R.period}|${d0}|${d1}|${M.NOW.day}|${R.period === 'day' && d0 === M.NOW.day ? M.NOW.hour : ''}`;
  if (cache.has(key)) return cache.get(key);
  const rows = [];
  const p0 = shiftYear(d0, -1), p1 = shiftYear(d1, -1);
  for (const e of groupEntities(R.group)) {
    if (R.period === 'day') {
      const rec = M.dayRecord(e, d0);
      if (!rec) continue;
      const a = dailyAQI(rec);
      const ci = rec[0] / 35 + rec[1] / 70 + rec[2] / 160 + rec[3] / 40 + rec[4] / 60 + rec[5] / 4;
      rows.push({ e, aqi: a.aqi, primary: a.primary, vals: Array.from(rec.subarray(0, 6)), ci, pm25: rec[0] });
    } else {
      const s = M.periodStats(e, d0, d1);
      if (!s) continue;
      const prev = p0 >= M.FIRST_DAY ? M.periodStats(e, p0, p1) : null;
      rows.push({ e, ci: s.ci, primary: [s.ciPrimary], goodRate: s.goodRate, good: s.good, n: s.n, vals: [s.mean[0], s.mean[1], s.o3p90, s.mean[3], s.mean[4], s.cop95], pm25: s.mean[0], yoy: prev ? (s.ci - prev.ci) / prev.ci : null, aqiMean: s.aqiMean, levels: s.levels });
    }
  }
  const res = { d0, d1, rows };
  if (cache.size > 40) cache.clear();
  cache.set(key, res);
  return res;
}

const critVal = (r) => (R.by === 'aqi' ? r.aqi : R.by === 'ci' ? Math.round(r.ci * 100) / 100 : R.by === 'pm25' ? Math.round(r.pm25) : -Math.round(r.goodRate * 1000) / 10);
function rankRows(res) {
  const sorted = [...res.rows].sort((a, b) => critVal(a) - critVal(b) || a.ci - b.ci);
  let rank = 0, prev = null;
  sorted.forEach((r, j) => { const v = critVal(r); if (v !== prev) { rank = j + 1; prev = v; } r.rank = rank; });
  return sorted;
}
const critText = (r) => (R.by === 'aqi' ? String(r.aqi) : R.by === 'ci' ? r.ci.toFixed(2) : R.by === 'pm25' ? String(Math.round(r.pm25)) : (r.goodRate * 100).toFixed(1) + '%');
function critColor(r, lo, hi) {
  if (R.by === 'aqi') return levelColor(r.aqi);
  if (R.by === 'pm25' && R.period === 'day') return levelColor(pollutantIAQI(0, r.pm25, 'day'));
  const v = critVal(r);
  const f = hi > lo ? (v - lo) / (hi - lo) : 0;
  return RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(f * (RAMP.length - 2))))];
}

// ---------------------------------------------------------------- layout
function layout() {
  root.innerHTML = `
  <div class="ranking">
    <div class="toolbar r-toolbar">
      <div id="rGroup"></div>
      <div id="rPeriod"></div>
      <div class="field" id="rDate"></div>
      <span style="flex:1"></span>
      <button class="btn" type="button" data-act="export">${icon('download')}${t('exportCsv')}</button>
    </div>
    <div class="r-summary" id="rSummary"></div>
    <div class="panel r-table">
      <div class="panel-head">
        <div class="panel-title" id="rTitle"></div><span class="spacer"></span>
        <div class="field"><label>${t('rankBy')}</label><select class="select" id="rBy" style="height:28px"></select></div>
        <div id="rDir" class="seg sm"></div>
        <input class="input" id="rSearch" type="search" placeholder="${esc(t('search'))}" style="width:130px;height:28px">
      </div>
      <div class="table-wrap" id="rTable"></div>
    </div>
    <div class="r-side">
      <div class="panel"><div class="panel-head"><div class="panel-title" id="rMapTitle"></div><span class="spacer"></span><span class="head-note" id="rMapLegend"></span></div><div class="chart-box"><div class="chart" id="rMap"></div></div></div>
      <div class="panel"><div class="panel-head"><div class="panel-title" id="rBarTitle"></div></div><div class="chart-box"><div class="chart" id="rBars"></div></div></div>
    </div>
  </div>`;
}

function renderDateControl() {
  const el = root.querySelector('#rDate');
  const nowY = yearOf(M.NOW.day);
  const years = []; for (let y = nowY; y >= DATA_START_YEAR; y--) years.push(y);
  const prevNext = `<button class="btn icon-only sm" type="button" data-step="-1" title="◀">${icon('back')}</button><button class="btn icon-only sm" type="button" data-step="1" title="▶" style="transform:scaleX(-1)">${icon('back')}</button>`;
  if (R.period === 'day') {
    el.innerHTML = `<label>${t('date')}</label><input class="input" type="date" id="rDay" min="${fmtDay(M.FIRST_DAY)}" max="${fmtDay(M.NOW.day)}" value="${fmtDay(R.day)}">${prevNext}`;
  } else if (R.period === 'month') {
    const maxM = R.ym[0] === nowY ? monthOf(M.NOW.day) : 12;
    el.innerHTML = `<label>${t('month')}</label><select class="select" id="rY">${years.map((y) => `<option value="${y}"${y === R.ym[0] ? ' selected' : ''}>${y}</option>`).join('')}</select>
      <select class="select" id="rM">${range(1, maxM).map((m) => `<option value="${m}"${m === R.ym[1] ? ' selected' : ''}>${pad(m)}</option>`).join('')}</select>${prevNext}`;
  } else {
    el.innerHTML = `<label>${t('year')}</label><select class="select" id="rYear">${years.map((y) => `<option value="${y}"${y === R.year ? ' selected' : ''}>${y}</option>`).join('')}</select>${prevNext}`;
  }
}

function renderByOptions() {
  const opts = R.period === 'day' ? [['aqi', 'byAqi'], ['ci', 'byCi'], ['pm25', 'byPm25']] : [['ci', 'byCi'], ['pm25', 'byPm25'], ['good', 'byGood']];
  if (!opts.some(([v]) => v === R.by)) R.by = opts[0][0];
  root.querySelector('#rBy').innerHTML = opts.map(([v, k]) => `<option value="${v}"${v === R.by ? ' selected' : ''}>${t(k)}</option>`).join('');
}

function renderDir() {
  const el = root.querySelector('#rDir');
  el.innerHTML = [[1, 'orderBest'], [-1, 'orderWorst']].map(([v, k]) => `<button type="button" data-dir="${v}" class="${R.dir === v ? 'on' : ''}">${t(k)}</button>`).join('');
}

// ---------------------------------------------------------------- render
function renderAll() {
  renderByOptions();
  renderDateControl();
  renderDir();
  const box = root.querySelector('.r-table');
  const busy = document.createElement('div');
  busy.className = 'busy';
  busy.textContent = t('loading');
  box.appendChild(busy);
  afterPaint(() => {
    busy.remove();
    if (!root.classList.contains('on')) { deferred = true; return; }
    current = compute();
    renderResults();
  });
}

function renderResults() {
  const res = current;
  const ranked = rankRows(res);
  renderSummary(res, ranked);
  renderTable(res, ranked);
  renderMap(ranked);
  renderBars(ranked);
}

function periodText(res) {
  if (R.period === 'day' && res.d0 === M.NOW.day) return t('periodToday', { d: fmtDay(res.d0), h: pad(M.NOW.hour) });
  if (R.period === 'day') return fmtDay(res.d0);
  return t('periodInfo', { from: fmtDay(res.d0), to: fmtDay(res.d1), n: res.d1 - res.d0 + 1 });
}
const groupLabel = () => t({ 74: 'g74', 168: 'g168', 337: 'g337', fw: 'gFw', fwc: 'gFwc' }[R.group]);
const periodLabel = () => t({ day: 'pDaily', month: 'pMonthly', year: 'pAnnual' }[R.period]);
const byLabel = () => t({ aqi: 'byAqi', ci: 'byCi', pm25: 'byPm25', good: 'byGood' }[R.by]);

function renderSummary(res, ranked) {
  const n = ranked.length;
  if (!R.focus || !res.rows.some((r) => eKey(r.e) === eKey(R.focus))) R.focus = defaultFocus();
  const f = ranked.find((r) => eKey(r.e) === eKey(R.focus));
  const vals = ranked.map(critVal);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  let focusHtml = '—';
  if (f) {
    const col = critColor(f, lo, hi);
    const extra = R.period === 'day'
      ? `<span class="lv" style="background:${LEVELS[levelIndex(f.aqi)].color};color:${LEVELS[levelIndex(f.aqi)].ink}">${levelName(levelIndex(f.aqi), true)}</span>`
      : f.yoy != null ? `<span class="${f.yoy > 0 ? 'up' : 'down'}" style="color:${f.yoy > 0 ? '#f87171' : '#4ade80'}">${t('yoy')} ${f.yoy > 0 ? '↑' : '↓'}${Math.abs(f.yoy * 100).toFixed(1)}%</span>` : '';
    focusHtml = `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:none"><div class="k">${t('rank')}</div><div class="big" style="color:${col}">${f.rank}<small>/${n}</small></div></div>
      <div style="min-width:0;flex:1;display:flex;flex-direction:column;gap:5px">
        <button class="pick-btn" id="rFocus" type="button" style="max-width:none">${icon('pin')}<span class="pb-label">${esc(eName(f.e))}</span><span class="pb-sub">${esc(eParent(f.e))}</span>${icon('chevron')}</button>
        <div class="d" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${byLabel()} <b style="color:${col}">${critText(f)}</b> ${extra}</div>
      </div>`;
  }
  const mean = (fn) => ranked.reduce((s, r) => s + fn(r), 0) / Math.max(1, n);
  let meanCard;
  if (R.period === 'day') {
    const counts = [0, 0, 0, 0, 0, 0];
    ranked.forEach((r) => counts[levelIndex(r.aqi)]++);
    const good = counts[0] + counts[1];
    meanCard = `<div class="k">${t('groupMean')} · AQI</div><div class="v" style="color:${levelColor(Math.round(mean((r) => r.aqi)))}">${Math.round(mean((r) => r.aqi))}<small>${t('kGood')} ${((100 * good) / Math.max(1, n)).toFixed(1)}%</small></div>
      <div class="lvbar">${counts.map((c, i) => (c ? `<i style="width:${(100 * c) / n}%;background:${LEVELS[i].color}" title="${levelName(i)} ${c}"></i>` : '')).join('')}</div>`;
  } else {
    meanCard = `<div class="k">${t('groupMean')} · ${t('ciShort')}</div><div class="v">${mean((r) => r.ci).toFixed(2)}<small>${t('groupGood')} ${(100 * mean((r) => r.goodRate)).toFixed(1)}%</small></div>
      <div class="d">PM2.5 ${Math.round(mean((r) => r.vals[0]))} μg/m³ · ${t('o3per90')} ${Math.round(mean((r) => r.vals[2]))}</div>`;
  }
  const best = ranked[0], worst = ranked[n - 1];
  const cardFor = (r, k) => (r ? `<div class="k">${t(k)} · ${byLabel()}</div><div class="v" style="color:${critColor(r, lo, hi)}">${critText(r)}<small>${esc(eName(r.e))}</small></div><div class="d">${esc(eParent(r.e))}</div>` : '');
  root.querySelector('#rSummary').innerHTML = `
    <div class="panel stat-card focus-card">${focusHtml}</div>
    <div class="panel stat-card" title="${esc(t('critNote'))}"><div class="k">${esc(groupLabel())} · ${esc(periodLabel())}</div><div class="v" style="font-size:15px">${esc(R.period === 'day' ? periodText(res) : `${fmtDay(res.d0)} – ${fmtDay(res.d1)}`)}</div><div class="d">${R.period === 'day' ? `${t('byAqi')} · HJ 633-2012` : `${res.d1 - res.d0 + 1} ${t('days')} · ${t('ci')} · HJ 663-2013`}</div></div>
    <div class="panel stat-card">${meanCard}</div>
    <div class="panel stat-card">${cardFor(best, 'kBest')}</div>
    <div class="panel stat-card">${cardFor(worst, 'kWorst')}</div>`;
  const fb = root.querySelector('#rFocus');
  if (fb) {
    focusPicker = new Picker({
      anchor: fb, width: 280, placeholder: t('search'),
      getItems: () => current.rows.map((r) => ({ id: eKey(r.e), label: eName(r.e), sub: eParent(r.e), group: r.e.t === 'county' ? cityName(COUNTIES[r.e.i][2]) : provName(CITIES[r.e.i][2]), keys: r.e.t === 'city' ? CITIES[r.e.i][0] + ' ' + CITIES[r.e.i][1] : COUNTIES[r.e.i][0] + ' ' + COUNTIES[r.e.i][1] })),
      getValue: () => eKey(R.focus),
      onChange: (id) => { R.focus = current.rows.find((r) => eKey(r.e) === id).e; renderResults(); scrollToFocus(); },
    });
  }
}

function defaultFocus() {
  if (R.group === 'fwc') return { t: 'county', i: CITIES[XIAN][8] + 1 };
  return { t: 'city', i: XIAN };
}

function renderTable(res, ranked) {
  const day = R.period === 'day';
  const isCounty = R.group === 'fwc';
  const q = R.q.toLowerCase();
  let rows = R.dir > 0 ? ranked : [...ranked].reverse();
  if (q) rows = rows.filter((r) => { const src = r.e.t === 'city' ? CITIES[r.e.i] : COUNTIES[r.e.i]; return (src[0] + ' ' + src[1]).toLowerCase().includes(q); });
  const vals = ranked.map(critVal);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const mode = day ? 'day' : 'year';
  const polHead = day ? ['PM2.5', 'PM10', 'O₃-8h', 'NO₂', 'SO₂', 'CO'] : ['PM2.5', 'PM10', 'O₃-8h⁹⁰', 'NO₂', 'SO₂', 'CO⁹⁵'];
  const polTitle = day ? [] : [, , t('o3per90'), , , t('coper95')];
  const n = ranked.length;
  const ciMin = Math.min(...ranked.map((x) => x.ci)), ciMax = Math.max(...ranked.map((x) => x.ci));
  const head = `<tr><th class="c">${t('rank')}</th><th class="l">${t(isCounty ? 'county' : 'city')}</th>` +
    (day ? `<th class="${R.by === 'aqi' ? 'sorted' : ''}">AQI</th><th class="c">${t('level')}</th><th class="c">${t('primaryShort')}</th><th class="${R.by === 'ci' ? 'sorted' : ''}" title="${esc(t('ci'))}">${t('ciShort')}</th>`
      : `<th class="${R.by === 'ci' ? 'sorted' : ''}">${t('ci')}</th><th>${t('yoy')}</th><th class="${R.by === 'good' ? 'sorted' : ''}">${t('goodRate')}</th><th class="c">${t('primaryShort')}</th>`) +
    polHead.map((h, p) => `<th class="${p === 0 && R.by === 'pm25' ? 'sorted' : ''}"${polTitle[p] ? ` title="${esc(polTitle[p])}"` : ''}>${h}</th>`).join('') + '</tr>';
  const body = rows.map((r) => {
    const sel = R.focus && eKey(r.e) === eKey(R.focus);
    const cc = critColor(r, lo, hi);
    let mid;
    if (day) {
      const li = levelIndex(r.aqi);
      mid = `<td><span class="aqi-pill" style="background:${LEVELS[li].color}26;color:${LEVELS[li].color};box-shadow:inset 0 0 0 1px ${LEVELS[li].color}55">${r.aqi}</span></td>
        <td class="c"><span class="lv" style="background:${LEVELS[li].color};color:${LEVELS[li].ink}">${levelName(li, true)}</span></td>
        <td class="c">${primaryLabel(r.primary)}</td><td>${r.ci.toFixed(2)}</td>`;
    } else {
      const yoy = r.yoy == null ? '—' : `<span class="${r.yoy > 0 ? 'up' : 'down'}">${r.yoy > 0 ? '↑' : '↓'}${Math.abs(r.yoy * 100).toFixed(1)}%</span>`;
      mid = `<td><span class="bar-cell" style="color:${cc}"><i style="width:${Math.round(8 + (46 * (r.ci - ciMin)) / Math.max(0.01, ciMax - ciMin))}px"></i><b style="color:var(--text)">${r.ci.toFixed(2)}</b></span></td>
        <td>${yoy}</td><td title="${r.good}/${r.n}">${(r.goodRate * 100).toFixed(1)}%</td><td class="c">${primaryLabel(r.primary)}</td>`;
    }
    const pols = r.vals.map((v, p) => `<td style="color:${levelColor(pollutantIAQI(p, v, mode))}">${fmtVal(p, v)}</td>`).join('');
    return `<tr class="click${sel ? ' sel' : ''}" data-key="${eKey(r.e)}"><td class="c"><span class="rank${r.rank <= 10 ? ' top' : ''}">${r.rank}</span></td><td class="l"><span class="name">${esc(eName(r.e))}</span><span class="sub">${esc(eParent(r.e))}</span></td>${mid}${pols}</tr>`;
  }).join('');
  const wrap = root.querySelector('#rTable');
  wrap.innerHTML = `<table class="tbl"><thead>${head}</thead><tbody>${body || `<tr><td colspan="13" class="c muted">${t('noData')}</td></tr>`}</tbody></table>`;
  root.querySelector('#rTitle').innerHTML = `${esc(groupLabel())}<span class="sub">· ${esc(periodLabel())} · ${n}</span>`;
}

function scrollToFocus() {
  const el = root.querySelector('#rTable tr.sel');
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function renderMap(ranked) {
  const fenwei = R.group === 'fw' || R.group === 'fwc';
  const vals = ranked.map(critVal);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  let pts;
  if (R.group === 'fwc') {
    const byCity = new Map();
    for (const r of ranked) {
      const ci = cityOfE(r.e);
      if (!byCity.has(ci)) byCity.set(ci, []);
      byCity.get(ci).push(r);
    }
    pts = [...byCity.entries()].map(([ci, rs]) => {
      const avg = rs.reduce((s, r) => s + r.rank, 0) / rs.length;
      const mid = rs.slice().sort((a, b) => a.rank - b.rank)[Math.floor(rs.length / 2)];
      return { name: cityName(ci), value: [CITIES[ci][3], CITIES[ci][4], avg], itemStyle: { color: critColor(mid, lo, hi) }, symbolSize: 12 + rs.length / 2, tip: `${esc(cityName(ci))} · ${rs.length} ${t('county')}<br>${t('rank')} ${Math.round(avg)} (avg)` };
    });
  } else {
    pts = ranked.map((r) => ({
      name: cityName(r.e.i), value: [CITIES[r.e.i][3], CITIES[r.e.i][4], r.rank], key: eKey(r.e),
      itemStyle: { color: critColor(r, lo, hi) }, symbolSize: fenwei ? 16 : ranked.length > 200 ? 6 : 8,
      tip: `<b>${esc(cityName(r.e.i))}</b> · ${esc(provName(CITIES[r.e.i][2]))}<br>${t('rank')} <b>${r.rank}</b> / ${ranked.length} · ${byLabel()} <b>${critText(r)}</b>`,
    }));
  }
  const labelled = fenwei ? pts : [];
  const geo = { map: 'china', roam: true, itemStyle: { areaColor: '#0f213f', borderColor: 'rgba(110,170,255,0.35)', borderWidth: 0.7 }, emphasis: { itemStyle: { areaColor: '#17335e' }, label: { show: false } }, select: { disabled: true }, label: { show: false } };
  if (fenwei) Object.assign(geo, { center: [110.2, 35.7], zoom: 6.5, layoutCenter: ['50%', '50%'], layoutSize: '100%' });
  else Object.assign(geo, { top: 6, bottom: 6, left: 6, right: 6 });
  charts.map.setOption({
    tooltip: { trigger: 'item', formatter: (p) => (p.data && p.data.tip) || '' },
    geo,
    series: [{
      type: 'scatter', coordinateSystem: 'geo', data: pts,
      label: { show: labelled.length > 0, position: 'right', formatter: (p) => (R.group === 'fwc' ? p.name : `${p.name} ${Math.round(p.value[2])}`), color: '#e6edf7', fontSize: 11, textShadowColor: '#000', textShadowBlur: 3 },
      labelLayout: { hideOverlap: true },
      itemStyle: { borderColor: 'rgba(4,10,20,0.6)', borderWidth: 0.6 }, emphasis: { scale: 1.6 },
    }],
  }, { notMerge: true });
  root.querySelector('#rMapTitle').innerHTML = `${t('rankMap')}<span class="sub">· ${esc(fenwei ? t('gFwShort') : groupLabel())}</span>`;
  root.querySelector('#rMapLegend').innerHTML = (R.by === 'aqi' || (R.by === 'pm25' && R.period === 'day'))
    ? LEVELS.slice(0, 5).map((L) => `<span class="swatch" style="background:${L.color};margin-left:3px"></span>`).join('') + ` ${levelName(0, true)} → ${levelName(4, true)}`
    : `<span style="display:inline-block;width:70px;height:8px;border-radius:4px;vertical-align:middle;background:linear-gradient(90deg,${RAMP.join(',')})"></span> ${t('kBest')} → ${t('kWorst')}`;
}

function renderBars(ranked) {
  const n = ranked.length;
  const k = Math.min(10, Math.floor(n / 2));
  const best = ranked.slice(0, k).reverse();
  const worst = ranked.slice(n - k);
  const vals = ranked.map(critVal);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const num = (r) => (R.by === 'good' ? +(r.goodRate * 100).toFixed(1) : R.by === 'ci' ? +r.ci.toFixed(2) : R.by === 'aqi' ? r.aqi : Math.round(r.pm25));
  const mk = (list) => list.map((r) => ({ value: num(r), itemStyle: { color: critColor(r, lo, hi) }, rank: r.rank }));
  const names = (list) => list.map((r) => `${r.rank} ${eName(r.e)}`);
  const labelFmt = (p) => (R.by === 'ci' ? p.value.toFixed(2) : `${p.value}${R.by === 'good' ? '%' : ''}`);
  const allNums = best.concat(worst).map(num);
  const axisMax = Math.max(...allNums) * 1.28;
  const yLabel = { fontSize: 10.5, color: '#c8d4e6', width: 84, overflow: 'truncate', interval: 0 };
  charts.bars.setOption({
    tooltip: { trigger: 'item', formatter: (p) => `${esc(p.name)}<br>${byLabel()}: <b>${p.value}${R.by === 'good' ? '%' : ''}</b>` },
    title: [
      { text: t('best10'), left: '2%', top: 0, textStyle: { color: '#5ee08f', fontSize: 12, fontWeight: 600 } },
      { text: t('worst10'), left: '52%', top: 0, textStyle: { color: '#ff7b7b', fontSize: 12, fontWeight: 600 } },
    ],
    grid: [{ left: '2%', width: '46%', top: 22, bottom: 4, containLabel: true }, { left: '52%', width: '46%', top: 22, bottom: 4, containLabel: true }],
    xAxis: [{ gridIndex: 0, type: 'value', show: false, max: axisMax, min: 0 }, { gridIndex: 1, type: 'value', show: false, max: axisMax, min: 0 }],
    yAxis: [
      { gridIndex: 0, type: 'category', data: names(best), axisLabel: yLabel, axisLine: { show: false } },
      { gridIndex: 1, type: 'category', data: names(worst), axisLabel: yLabel, axisLine: { show: false } },
    ],
    series: [
      { type: 'bar', xAxisIndex: 0, yAxisIndex: 0, data: mk(best), barWidth: '62%', barMaxWidth: 14, itemStyle: { borderRadius: [0, 3, 3, 0] }, label: { show: true, position: 'right', formatter: labelFmt, color: '#cbd5e1', fontSize: 10 } },
      { type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: mk(worst), barWidth: '62%', barMaxWidth: 14, itemStyle: { borderRadius: [0, 3, 3, 0] }, label: { show: true, position: 'right', formatter: labelFmt, color: '#cbd5e1', fontSize: 10 } },
    ],
  }, { notMerge: true });
  root.querySelector('#rBarTitle').innerHTML = `${t('best10')} / ${t('worst10')}<span class="sub">· ${esc(byLabel())}</span>`;
}

// ---------------------------------------------------------------- export
function exportCsv() {
  if (!current) return;
  const ranked = rankRows(current);
  const day = R.period === 'day';
  const head = [t('rank'), t(R.group === 'fwc' ? 'county' : 'city'), t(R.group === 'fwc' ? 'city' : 'province')]
    .concat(day ? ['AQI', t('level'), t('primaryShort'), t('ci')] : [t('ci'), t('yoy') + ' (%)', t('goodRate') + ' (%)', t('goodDays'), t('primaryShort')])
    .concat(day ? ['PM2.5', 'PM10', 'O3-8h', 'NO2', 'SO2', 'CO'] : ['PM2.5', 'PM10', 'O3-8h-90per', 'NO2', 'SO2', 'CO-95per']);
  const lines = [head];
  for (const r of ranked) {
    const base = [r.rank, eName(r.e), eParent(r.e)];
    const mid = day ? [r.aqi, levelName(levelIndex(r.aqi)), r.primary.map((p) => POL_PLAIN[p]).join('/'), r.ci.toFixed(2)]
      : [r.ci.toFixed(2), r.yoy == null ? '' : (r.yoy * 100).toFixed(1), (r.goodRate * 100).toFixed(1), `${r.good}/${r.n}`, r.primary.map((p) => POL_PLAIN[p]).join('/')];
    lines.push(base.concat(mid, r.vals.map((v, p) => fmtVal(p, v))));
  }
  const csv = '\ufeff' + lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const tag = R.period === 'day' ? fmtDay(current.d0) : R.period === 'month' ? `${R.ym[0]}-${pad(R.ym[1])}` : String(R.year);
  download(`AQ_ranking_${R.group}_${R.period}_${tag}.csv`, csv, 'text/csv;charset=utf-8');
  toast(t('exported', { n: ranked.length }));
}

// ---------------------------------------------------------------- events
function step(dir) {
  if (R.period === 'day') R.day = Math.max(M.FIRST_DAY, Math.min(M.NOW.day, R.day + dir));
  else if (R.period === 'month') {
    let [y, m] = R.ym;
    m += dir;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    if (y < DATA_START_YEAR || firstDayOfMonth(y, m) > M.NOW.day) return;
    R.ym = [y, m];
  } else {
    const y = R.year + dir;
    if (y < DATA_START_YEAR || y > yearOf(M.NOW.day)) return;
    R.year = y;
  }
  renderAll();
}

function bindElements() {
  groupSeg = segmented(root.querySelector('#rGroup'), [
    { v: '74', label: () => t('g74') }, { v: '168', label: () => t('g168') }, { v: '337', label: () => t('g337') },
    { v: 'fw', label: () => t('gFwShort'), title: () => t('gFw') }, { v: 'fwc', label: () => t('gFwcShort'), title: () => t('gFwc') },
  ], R.group, (v) => { R.group = v; R.focus = null; renderAll(); });
  periodSeg = segmented(root.querySelector('#rPeriod'), [
    { v: 'day', label: () => t('pDaily') }, { v: 'month', label: () => t('pMonthly') }, { v: 'year', label: () => t('pAnnual') },
  ], R.period, (v) => { R.period = v; R.by = v === 'day' ? 'aqi' : 'ci'; renderAll(); });
  root.querySelector('#rSearch').addEventListener('input', (ev) => { R.q = ev.target.value.trim(); renderTable(current, rankRows(current)); });
  charts.map.on('click', (p) => {
    if (!p.data || !p.data.key) return;
    const r = current.rows.find((x) => eKey(x.e) === p.data.key);
    if (r) { R.focus = r.e; renderResults(); scrollToFocus(); }
  });
}

function bindOnce() {
  root.addEventListener('change', (ev) => {
    const id = ev.target.id;
    if (id === 'rDay') { const d = parseDay(ev.target.value); if (d != null) { R.day = Math.max(M.FIRST_DAY, Math.min(M.NOW.day, d)); renderAll(); } }
    else if (id === 'rY') { R.ym = [+ev.target.value, R.ym[1]]; if (firstDayOfMonth(R.ym[0], R.ym[1]) > M.NOW.day) R.ym[1] = monthOf(M.NOW.day); renderAll(); }
    else if (id === 'rM') { R.ym = [R.ym[0], +ev.target.value]; renderAll(); }
    else if (id === 'rYear') { R.year = +ev.target.value; renderAll(); }
    else if (id === 'rBy') { R.by = ev.target.value; renderResults(); }
  });
  on(root, 'click', '[data-step]', (ev, el) => step(+el.dataset.step));
  on(root, 'click', '[data-dir]', (ev, el) => { R.dir = +el.dataset.dir; renderDir(); renderTable(current, rankRows(current)); });
  on(root, 'click', '[data-act="export"]', () => exportCsv());
  on(root, 'click', 'tr[data-key]', (ev, el) => {
    const r = current.rows.find((x) => eKey(x.e) === el.dataset.key);
    if (r) { R.focus = r.e; renderResults(); }
  });
}

function build() {
  layout();
  if (charts.map) { charts.map.dispose(); charts.bars.dispose(); }
  charts.map = makeChart(root.querySelector('#rMap'));
  charts.bars = makeChart(root.querySelector('#rBars'));
  bindElements();
}

export default {
  mount(el) {
    root = el;
    R.day = M.NOW.day - 1;
    R.ym = [yearOf(M.NOW.day), monthOf(M.NOW.day)];
    R.year = yearOf(M.NOW.day);
    build();
    bindOnce();
    renderAll();
  },
  show() {
    Object.values(charts).forEach((c) => c.resize());
    if (deferred) { deferred = false; renderAll(); }
  },
  relang() {
    build();
    root.querySelector('#rSearch').value = R.q;
    renderAll();
  },
  newHour() { cache.clear(); if (R.day > M.NOW.day) R.day = M.NOW.day; renderAll(); },
};

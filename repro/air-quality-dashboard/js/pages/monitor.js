import { CITIES, STATIONS } from '../data/geo-data.js';
import * as M from '../core/model.js';
import { LEVELS, LEVEL_EDGES, levelIndex, levelColor, pollutantIAQI, dailyAQI } from '../core/aqi.js';
import { t, cityName, provName, stationName, countyName, levelName, POL_LABEL, unitOf, fmtVal, primaryLabel, fmtNum } from '../core/i18n.js';
import { makeChart, tooltipRow, POL_COLORS } from '../ui/charts.js';
import { segmented, Picker } from '../ui/widgets.js';
import { esc, icon, on } from '../ui/dom.js';
import { fmtDay, fmtShort, pad } from '../core/time.js';
import { XIAN, cityE, snapshot, cityItems, cityStations } from '../core/query.js';

const S = { city: XIAN, station: null, mode: 'hour', metric: -1, k: 23, playing: false, tab: 'stations', rankDir: 1, off: new Set() };
const STEPS = { hour: 24, day: 30 };
let root, charts = {}, snap = null, playTimer = 0, modeSeg, picker, visible = false;

const timeAt = (k, mode = S.mode) => {
  if (mode === 'hour') {
    let d = M.NOW.day, h = M.NOW.hour - (23 - k);
    while (h < 0) { h += 24; d -= 1; }
    return { d, h };
  }
  return { d: M.NOW.day - (29 - k), h: M.NOW.hour };
};
const entity = () => (S.station != null ? { t: 'station', i: S.station } : cityE(S.city));
const metricVal = (s) => (S.metric < 0 ? s.aqi : s.vals[S.metric]);
const metricIAQI = (s) => (S.metric < 0 ? s.aqi : pollutantIAQI(S.metric, s.vals[S.metric], S.mode));
const o3Label = () => (S.mode === 'hour' ? 'O₃' : 'O₃-8h');
const polLabel = (p) => (p === 2 ? o3Label() : POL_LABEL[p]);
const lvBadge = (aqi, short = true) => {
  const li = levelIndex(aqi);
  return li < 0 ? '—' : `<span class="lv" style="background:${LEVELS[li].color};color:${LEVELS[li].ink}">${levelName(li, short)}</span>`;
};
const aqiPill = (aqi) => {
  const li = levelIndex(aqi);
  return li < 0 ? '—' : `<span class="aqi-pill" style="background:${LEVELS[li].color}26;color:${LEVELS[li].color};box-shadow:inset 0 0 0 1px ${LEVELS[li].color}55">${aqi}</span>`;
};
function timeLabel(d, h, mode = S.mode) {
  if (mode === 'hour') return `${fmtDay(d)} ${pad(h)}:00`;
  return d === M.NOW.day ? `${fmtDay(d)} · ${t('cumTo', { h: pad(M.NOW.hour) })}` : fmtDay(d);
}

// ---------------------------------------------------------------- layout
function layout() {
  root.innerHTML = `
  <div class="monitor">
    <div class="m-toolbar">
      <button class="pick-btn" id="mCity" type="button">${icon('pin')}<span class="pb-label"></span><span class="pb-sub"></span>${icon('chevron')}</button>
      <div id="mMode"></div>
      <div class="kpis" id="mKpis"></div>
    </div>
    <div class="panel m-card" id="mCard"></div>
    <div class="panel m-map">
      <div class="panel-head">
        <div class="panel-title" id="mMapTitle"></div>
        <div class="metric-chips seg sm" id="mMetric"></div>
      </div>
      <div class="map-wrap">
        <div class="chart" id="mMap"></div>
        <div class="map-legend" id="mLegend"></div>
        <div class="map-stamp" id="mStamp"></div>
      </div>
      <div class="timeline" id="mTimeline"></div>
    </div>
    <div class="panel m-hourly"><div class="panel-head"><div class="panel-title" id="mHourlyTitle"></div></div><div class="chart-box"><div class="chart" id="mHourly"></div></div></div>
    <div class="panel m-daily"><div class="panel-head"><div class="panel-title" id="mDailyTitle"></div></div><div class="chart-box"><div class="chart" id="mDaily"></div></div></div>
    <div class="panel m-table">
      <div class="panel-head tabs" id="mTabs"></div>
      <div class="table-wrap" id="mTable"></div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- snapshot of all cities
function computeSnap() {
  const { d, h } = timeAt(S.k);
  const rows = [];
  for (let i = 0; i < CITIES.length; i++) {
    const s = snapshot(cityE(i), S.mode, d, h);
    if (s) rows.push({ i, ...s });
  }
  snap = { d, h, rows };
}

// ---------------------------------------------------------------- toolbar & KPIs
function renderToolbar() {
  const b = root.querySelector('#mCity');
  b.querySelector('.pb-label').textContent = cityName(S.city);
  b.querySelector('.pb-sub').textContent = provName(CITIES[S.city][2]);
  modeSeg.render();
}

function renderKpis() {
  const rows = snap.rows;
  const good = rows.filter((r) => r.aqi <= 100).length;
  const mean = rows.reduce((s, r) => s + r.aqi, 0) / rows.length;
  let worst = rows[0], best = rows[0];
  for (const r of rows) { if (r.aqi > worst.aqi) worst = r; if (r.aqi < best.aqi) best = r; }
  root.querySelector('#mKpis').innerHTML = `
    <div class="kpi"><span class="k">${t('kCities')}</span><span class="v">${rows.length}</span></div>
    <div class="kpi"><span class="k">${t('kStations')}</span><span class="v">${fmtNum(STATIONS.length)}</span></div>
    <div class="kpi"><span class="k">${t('kGood')}</span><span class="v" style="color:#5ee08f">${((100 * good) / rows.length).toFixed(1)}%</span></div>
    <div class="kpi"><span class="k">${t('kMean')}</span><span class="v" style="color:${levelColor(Math.round(mean))}">${Math.round(mean)}</span></div>
    <div class="kpi"><span class="k">${t('kWorst')}</span><span class="v" style="color:${levelColor(worst.aqi)}">${worst.aqi}<small>${esc(cityName(worst.i))}</small></span></div>
    <div class="kpi"><span class="k">${t('kBest')}</span><span class="v" style="color:${levelColor(best.aqi)}">${best.aqi}<small>${esc(cityName(best.i))}</small></span></div>`;
}

// ---------------------------------------------------------------- map
function cityTooltip(ci) {
  const r = snap.rows.find((x) => x.i === ci);
  if (!r) return '';
  const li = levelIndex(r.aqi);
  let html = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b style="font-size:13px">${esc(cityName(ci))}</b><span style="color:#7d8fab">${esc(provName(CITIES[ci][2]))}</span></div>`;
  html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:22px;font-weight:800;color:${LEVELS[li].color}">${r.aqi}</span>${lvBadge(r.aqi, false)}</div>`;
  html += `<div style="color:#9fb0c8;margin-bottom:4px">${t('primary')}: <b style="color:#e6edf7">${primaryLabel(r.primary)}</b></div>`;
  html += `<div style="display:grid;grid-template-columns:repeat(3,auto);gap:2px 14px;font-variant-numeric:tabular-nums">`;
  for (let p = 0; p < 6; p++) html += `<span><span style="color:#7d8fab">${polLabel(p)}</span> <b>${fmtVal(p, r.vals[p])}</b></span>`;
  return html + '</div>';
}

function initMap() {
  charts.map = makeChart(root.querySelector('#mMap'));
  charts.map.setOption({
    tooltip: { trigger: 'item', confine: true, formatter: (p) => (p.data && p.data.ci != null ? cityTooltip(p.data.ci) : '') },
    geo: {
      map: 'china', roam: true, scaleLimit: { min: 0.9, max: 8 }, top: 8, bottom: 6, left: 8, right: 8,
      itemStyle: { areaColor: '#0f213f', borderColor: 'rgba(110,170,255,0.38)', borderWidth: 0.7, shadowColor: 'rgba(56,189,248,0.22)', shadowBlur: 14 },
      emphasis: { itemStyle: { areaColor: '#17335e' }, label: { show: true, color: '#cfe3ff', fontSize: 11 } },
      select: { disabled: true },
      label: { show: false },
      regions: [{ name: '南海诸岛', itemStyle: { areaColor: 'rgba(15,33,63,0.6)', borderColor: 'rgba(110,170,255,0.3)' }, emphasis: { disabled: true } }],
    },
    series: [],
  });
  charts.map.on('click', (p) => { if (p.data && p.data.ci != null) selectCity(p.data.ci); });
}

function renderMap() {
  const rows = snap.rows;
  const pts = [];
  for (const r of rows) {
    const li = levelIndex(metricIAQI(r));
    if (S.off.has(li)) continue;
    const c = CITIES[r.i];
    pts.push({
      name: cityName(r.i), ci: r.i, value: [c[3], c[4], metricVal(r)],
      symbolSize: 5 + li * 2 + (c[5] <= 1 ? 2 : 0),
      itemStyle: { color: LEVELS[li].color, shadowColor: LEVELS[li].color, shadowBlur: li >= 2 ? 10 : 4 },
    });
  }
  const hot = [...rows].sort((a, b) => metricIAQI(b) - metricIAQI(a)).slice(0, 6).filter((r) => !S.off.has(levelIndex(metricIAQI(r))));
  const selC = CITIES[S.city];
  const hotPts = hot.map((r) => {
    const li = levelIndex(metricIAQI(r));
    const c = CITIES[r.i];
    const nearSel = r.i === S.city || (Math.abs(c[3] - selC[3]) < 3.2 && Math.abs(c[4] - selC[4]) < 1.6);
    return { name: cityName(r.i), ci: r.i, value: [c[3], c[4], metricVal(r)], symbolSize: 9 + li * 2, itemStyle: { color: LEVELS[li].color }, label: nearSel ? { show: false } : undefined };
  });
  const sel = rows.find((r) => r.i === S.city);
  const selPt = sel ? [{ name: cityName(S.city), ci: S.city, value: [CITIES[S.city][3], CITIES[S.city][4], metricVal(sel)] }] : [];
  const fmt = (v) => (S.metric === 5 ? v.toFixed(1) : Math.round(v));
  charts.map.setOption({
    series: [
      { id: 'pts', type: 'scatter', coordinateSystem: 'geo', data: pts, zlevel: 1, itemStyle: { borderColor: 'rgba(4,10,20,0.55)', borderWidth: 0.6 }, emphasis: { scale: 1.8 }, animationDurationUpdate: 300 },
      {
        id: 'hot', type: 'effectScatter', coordinateSystem: 'geo', data: hotPts, zlevel: 2, rippleEffect: { brushType: 'stroke', scale: 3.2, period: 3.5 },
        label: { show: true, position: 'right', formatter: (p) => `${p.name} ${fmt(p.value[2])}`, color: '#f1f5f9', fontSize: 11, textShadowColor: '#000', textShadowBlur: 4 },
        labelLayout: { hideOverlap: true },
      },
      {
        id: 'sel', type: 'scatter', coordinateSystem: 'geo', data: selPt, zlevel: 3, symbolSize: 20, silent: true,
        itemStyle: { color: 'rgba(255,255,255,0.08)', borderColor: '#ffffff', borderWidth: 2, shadowColor: '#38bdf8', shadowBlur: 12 },
        label: { show: true, position: 'top', distance: 6, formatter: (p) => `${p.name} · ${fmt(p.value[2])}`, color: '#0b1220', backgroundColor: '#e6f6ff', padding: [3, 6], borderRadius: 4, fontWeight: 600, fontSize: 11 },
      },
    ],
  });
  const title = S.metric < 0 ? 'AQI' : polLabel(S.metric);
  root.querySelector('#mMapTitle').innerHTML = `${t('mapTitle')}<span class="sub">· ${title} · ${t(S.mode === 'hour' ? 'modeHourly' : 'modeDaily')}</span>`;
  root.querySelector('#mStamp').innerHTML = `<div class="ts">${S.mode === 'hour' ? `${fmtShort(snap.d)} ${pad(snap.h)}:00` : fmtShort(snap.d)}</div><div class="md">${esc(t('mapHint'))}</div>`;
  renderLegend();
}

function renderLegend() {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const r of snap.rows) counts[levelIndex(metricIAQI(r))]++;
  const title = S.metric < 0 ? 'AQI' : `${polLabel(S.metric)} · ${unitOf(S.metric)}`;
  const edges = S.metric < 0 ? LEVEL_EDGES : null;
  root.querySelector('#mLegend').innerHTML = `<div class="lg-title">${title}</div>` + LEVELS.map((L, i) => `
    <div class="lg${S.off.has(i) ? ' off' : ''}" data-lv="${i}"><span class="swatch" style="background:${L.color}"></span>${levelName(i, true)}${edges ? `<span class="rg">${i === 5 ? '>300' : `${edges[i] + (i ? 1 : 0)}–${edges[i + 1]}`}</span>` : ''}<span class="cnt">${counts[i]}</span></div>`).join('');
}

// ---------------------------------------------------------------- timeline
function renderTimeline() {
  const n = STEPS[S.mode];
  const e = entity();
  let cells = '';
  for (let k = 0; k < n; k++) {
    const { d, h } = timeAt(k);
    const s = snapshot(e, S.mode, d, h);
    cells += `<i style="background:${s ? levelColor(s.aqi) : '#223'}"></i>`;
  }
  const ticks = [];
  const every = S.mode === 'hour' ? 6 : 7;
  for (let k = (n - 1) % every; k < n; k += every) {
    const { d, h } = timeAt(k);
    ticks.push(S.mode === 'hour' ? `${pad(h)}:00` : fmtShort(d));
  }
  const { d, h } = timeAt(S.k);
  root.querySelector('#mTimeline').innerHTML = `
    <button class="btn icon-only" type="button" data-act="play" title="${t(S.playing ? 'pause' : 'play')}">${icon(S.playing ? 'pause' : 'play')}</button>
    <div class="tl-track">
      <div class="tl-cells">${cells}</div>
      <input class="tl-range" type="range" min="0" max="${n - 1}" step="1" value="${S.k}" aria-label="timeline">
      <div class="tl-ticks">${ticks.map((x) => `<span>${x}</span>`).join('')}</div>
    </div>
    <div class="tl-label">${timeLabel(d, h)}</div>
    <button class="btn sm" type="button" data-act="latest">${icon('skip')}${t('latest')}</button>`;
}
function syncTimelineThumb() {
  const r = root.querySelector('.tl-range');
  if (r) r.value = S.k;
  const { d, h } = timeAt(S.k);
  const l = root.querySelector('.tl-label');
  if (l) l.textContent = timeLabel(d, h);
}

// ---------------------------------------------------------------- city / station card
function gauge(aqi) {
  const cx = 110, cy = 100, r = 80;
  const a0 = 150, span = 240;
  const rad = (a) => (a * Math.PI) / 180;
  const pt = (a, rr = r) => [cx + rr * Math.cos(rad(a)), cy + rr * Math.sin(rad(a))];
  const arc = (s, e, rr = r) => { const [x1, y1] = pt(s, rr), [x2, y2] = pt(e, rr); return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${rr} ${rr} 0 ${e - s > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`; };
  const li = Math.max(0, levelIndex(aqi));
  const f = aqi == null ? 0 : (li + Math.min(1, (aqi - LEVEL_EDGES[li]) / (LEVEL_EDGES[li + 1] - LEVEL_EDGES[li]))) / 6;
  const va = a0 + span * f;
  let segs = '';
  for (let i = 0; i < 6; i++) {
    const s = a0 + (span * i) / 6 + 1.4, e = a0 + (span * (i + 1)) / 6 - 1.4;
    segs += `<path d="${arc(s, e)}" stroke="${LEVELS[i].color}" stroke-width="11" fill="none" stroke-linecap="butt" opacity="${i <= li ? 0.95 : 0.16}"/>`;
  }
  let labels = '';
  [0, 50, 100, 150, 200, 300, 500].forEach((v, i) => {
    const [x, y] = pt(a0 + (span * i) / 6, r - 20);
    labels += `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#6b7c98">${v}</text>`;
  });
  const [mx, my] = pt(va);
  const col = LEVELS[li].color;
  return `<svg class="gauge" viewBox="0 0 220 158" role="img" aria-label="AQI ${aqi}">
    <defs><filter id="gGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <radialGradient id="gCore" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="${col}" stop-opacity="0.22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${r - 26}" fill="url(#gCore)"/>
    <path d="${arc(a0, a0 + span, r + 10)}" stroke="rgba(148,178,226,0.12)" stroke-width="1" fill="none" stroke-dasharray="1 4"/>
    ${segs}${labels}
    <circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="9" fill="${col}" opacity="0.55" filter="url(#gGlow)"/>
    <circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="6.5" fill="#fff" stroke="${col}" stroke-width="3"/>
    <text x="${cx}" y="${cy - 26}" text-anchor="middle" font-size="11" fill="#8b9bb4" letter-spacing="1.5">AQI</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="46" font-weight="800" fill="${col}" style="font-variant-numeric:tabular-nums">${aqi == null ? '—' : aqi}</text>
  </svg>`;
}

function renderCard() {
  const e = entity();
  const { d, h } = timeAt(S.k);
  const s = snapshot(e, S.mode, d, h);
  const isSt = e.t === 'station';
  const st = isSt ? STATIONS[e.i] : null;
  const title = isSt ? stationName(e.i) : cityName(S.city);
  const meta = isSt
    ? `${esc(cityName(S.city))}${st[3] >= 0 ? ' · ' + esc(countyName(st[3])) : ''} · <span class="tag${st[4] ? ' bg' : ''}">${t(st[4] ? 'bgSite' : 'evalSite')}</span>`
    : `${esc(provName(CITIES[S.city][2]))} · ${CITIES[S.city][11]} ${t('kStations')}`;
  const li = s ? levelIndex(s.aqi) : -1;
  let pols = '';
  for (let p = 0; p < 6; p++) {
    const v = s ? s.vals[p] : null;
    const iq = s ? pollutantIAQI(p, v, S.mode) : null;
    const pl = levelIndex(iq);
    const isPrim = s && s.primary.includes(p);
    pols += `<div class="pol${isPrim ? ' primary' : ''}"><div class="pn">${polLabel(p)}<span>${unitOf(p)}</span></div>
      <div class="pv" style="color:${pl >= 0 ? LEVELS[pl].color : '#fff'}">${fmtVal(p, v)}</div>
      <div class="pb"><i style="width:${Math.min(100, (iq || 0) / 2)}%;background:${pl >= 0 ? LEVELS[pl].color : '#555'}"></i></div></div>`;
  }
  const stamp = S.mode === 'hour' ? `${fmtShort(d)} ${pad(h)}:00` : `${fmtShort(d)}${d === M.NOW.day ? ' · ' + t('cumulative') : ''}`;
  root.querySelector('#mCard').innerHTML = `
    <div class="card-head">
      <div style="min-width:0"><div class="card-city" title="${esc(title)}">${esc(title)}</div><div class="card-meta">${meta}</div></div>
      ${isSt ? `<button class="btn sm card-back" type="button" data-act="back" title="${esc(t('backToCity', { c: cityName(S.city) }))}">${icon('back')}${esc(cityName(S.city))}</button>`
    : `<span class="card-time" title="${esc(timeLabel(d, h))}">${icon('history')}${esc(stamp)}</span>`}
    </div>
    <div class="gauge-wrap">${gauge(s ? s.aqi : null)}</div>
    <div class="card-level">${s ? lvBadge(s.aqi, false) : ''}<span class="card-primary">${t('primary')}: <b>${s ? primaryLabel(s.primary) : '—'}</b></span></div>
    ${li >= 0 ? `<div class="health"><b>${t('healthEffect')}:</b> ${esc(t('h' + li))}<br><b>${t('advice')}:</b> ${esc(t('a' + li))}</div>` : ''}
    <div class="pol-grid">${pols}</div>`;
}

// ---------------------------------------------------------------- charts
function renderHourly() {
  const e = entity();
  const xs = [], aqi = [], cum = [], pol = [[], [], [], [], [], []];
  for (let k = 0; k < 24; k++) {
    const { d, h } = timeAt(k, 'hour');
    xs.push(h === 0 ? `${fmtShort(d)}\n00:00` : `${pad(h)}:00`);
    const s = snapshot(e, 'hour', d, h);
    aqi.push(s ? { value: s.aqi, itemStyle: { color: levelColor(s.aqi) } } : null);
    for (let p = 0; p < 6; p++) pol[p].push(s ? +fmtVal(p, s.vals[p]) : null);
    if (d === M.NOW.day) {
      const rec = M.cumulativeRecord(e, d, h);
      cum.push(rec ? dailyAQI(rec).aqi : null);
    } else cum.push(null);
  }
  const selIdx = S.mode === 'hour' ? S.k : -1;
  const names = { aqi: 'AQI', cum: t('cumAqi') };
  root.querySelector('#mHourlyTitle').innerHTML = `${t('hourlyTrend')}<span class="sub">· ${esc(e.t === 'station' ? stationName(e.i) : cityName(S.city))}</span>`;
  charts.hourly.setOption({
    grid: { left: 36, right: 38, top: 36, bottom: 30 },
    legend: { top: 4, left: 8, right: 8, itemGap: 10, type: 'scroll', pageIconColor: '#7d8fab', pageTextStyle: { color: '#7d8fab' }, data: [names.aqi, names.cum, 'PM2.5', 'O₃', 'NO₂'], selected: { 'NO₂': false } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(56,189,248,0.06)' } },
      formatter: (ps) => {
        const k = ps[0].dataIndex;
        const { d, h } = timeAt(k, 'hour');
        let html = `<div style="margin-bottom:4px;color:#9fb0c8">${fmtDay(d)} ${pad(h)}:00</div>`;
        for (const p of ps) if (p.value != null) html += tooltipRow(p.seriesName === 'AQI' ? levelColor(p.value) : p.color, p.seriesName, p.value + (p.seriesName === 'AQI' || p.seriesName === names.cum ? '' : ' <span style="color:#7d8fab;font-weight:400">μg/m³</span>'));
        return html;
      },
    },
    xAxis: { type: 'category', data: xs, axisLabel: { interval: 3, fontSize: 10, lineHeight: 12 } },
    yAxis: [{ type: 'value', splitNumber: 4 }, { type: 'value', name: 'μg/m³', splitNumber: 4, splitLine: { show: false }, nameGap: 8 }],
    series: [
      { name: names.aqi, type: 'bar', data: aqi, barWidth: '58%', itemStyle: { borderRadius: [3, 3, 0, 0] }, color: '#f2d53c',
        markLine: selIdx >= 0 ? { symbol: 'none', silent: true, label: { show: false }, lineStyle: { color: '#e6f6ff', type: 'solid', width: 1, opacity: 0.6 }, data: [{ xAxis: selIdx }] } : { data: [] } },
      { name: names.cum, type: 'line', data: cum, symbol: 'none', smooth: true, color: '#e2e8f0', lineStyle: { type: 'dashed', width: 1.6 }, connectNulls: false },
      ...[[0, 'PM2.5'], [2, 'O₃'], [3, 'NO₂']].map(([p, n]) => ({ name: n, type: 'line', yAxisIndex: 1, data: pol[p], symbol: 'none', smooth: true, color: POL_COLORS[p], lineStyle: { width: 1.8 } })),
    ],
  }, { notMerge: true });
}

function renderDaily() {
  const e = entity();
  const xs = [], aqi = [], pm = [], o3 = [];
  for (let k = 0; k < 30; k++) {
    const d = M.NOW.day - (29 - k);
    xs.push(fmtShort(d));
    const rec = M.dayRecord(e, d);
    if (!rec) { aqi.push(null); pm.push(null); o3.push(null); continue; }
    const a = dailyAQI(rec).aqi;
    const today = d === M.NOW.day;
    aqi.push({ value: a, itemStyle: { color: levelColor(a), opacity: today ? 0.5 : 1, borderColor: today ? '#e6f6ff' : undefined, borderWidth: today ? 1 : 0, borderType: 'dashed' } });
    pm.push(Math.round(rec[0]));
    o3.push(Math.round(rec[2]));
  }
  const selIdx = S.mode === 'day' ? S.k : -1;
  root.querySelector('#mDailyTitle').innerHTML = `${t('dailyTrend')}<span class="sub">· ${t('today')} 00:00–${pad(M.NOW.hour)}:00</span>`;
  charts.daily.setOption({
    grid: { left: 36, right: 38, top: 36, bottom: 26 },
    legend: { top: 4, left: 8, data: ['AQI', 'PM2.5', 'O₃-8h'] },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(56,189,248,0.06)' } },
      formatter: (ps) => {
        const d = M.NOW.day - (29 - ps[0].dataIndex);
        let html = `<div style="margin-bottom:4px;color:#9fb0c8">${fmtDay(d)}${d === M.NOW.day ? ' · ' + t('cumTo', { h: pad(M.NOW.hour) }) : ''}</div>`;
        for (const p of ps) if (p.value != null) html += tooltipRow(p.seriesName === 'AQI' ? levelColor(p.value) : p.color, p.seriesName, p.value + (p.seriesName === 'AQI' ? '' : ' <span style="color:#7d8fab;font-weight:400">μg/m³</span>'));
        return html;
      },
    },
    xAxis: { type: 'category', data: xs, axisLabel: { interval: 6, fontSize: 10 } },
    yAxis: [{ type: 'value', splitNumber: 4 }, { type: 'value', name: 'μg/m³', splitNumber: 4, splitLine: { show: false }, nameGap: 8 }],
    series: [
      { name: 'AQI', type: 'bar', data: aqi, barWidth: '62%', itemStyle: { borderRadius: [3, 3, 0, 0] }, color: '#f2d53c',
        markLine: selIdx >= 0 ? { symbol: 'none', silent: true, label: { show: false }, lineStyle: { color: '#e6f6ff', width: 1, opacity: 0.6, type: 'solid' }, data: [{ xAxis: selIdx }] } : { data: [] } },
      { name: 'PM2.5', type: 'line', yAxisIndex: 1, data: pm, symbol: 'none', smooth: true, color: POL_COLORS[0], lineStyle: { width: 1.8 } },
      { name: 'O₃-8h', type: 'line', yAxisIndex: 1, data: o3, symbol: 'none', smooth: true, color: POL_COLORS[2], lineStyle: { width: 1.8 } },
    ],
  }, { notMerge: true });
}

// ---------------------------------------------------------------- tables
function valueCells(s) {
  if (!s) return '<td colspan="9" class="c muted">—</td>';
  return `<td>${aqiPill(s.aqi)}</td><td class="c">${lvBadge(s.aqi)}</td><td class="c">${primaryLabel(s.primary)}</td>` +
    s.vals.map((v, p) => `<td style="color:${levelColor(pollutantIAQI(p, v, S.mode))}">${fmtVal(p, v)}</td>`).join('');
}
const valueHeads = () => `<th>AQI</th><th class="c">${t('level')}</th><th class="c">${t('primaryShort')}</th>${[0, 1, 2, 3, 4, 5].map((p) => `<th>${polLabel(p)}</th>`).join('')}`;

function renderTabs() {
  const n = CITIES[S.city][11];
  root.querySelector('#mTabs').innerHTML = `
    <button class="tab${S.tab === 'stations' ? ' on' : ''}" type="button" data-tab="stations">${esc(t('stationsOf', { c: cityName(S.city) }))} · ${n}</button>
    <button class="tab${S.tab === 'ranking' ? ' on' : ''}" type="button" data-tab="ranking">${t('rtRanking')}</button>
    <span class="spacer"></span>
    <span class="head-note">${S.tab === 'stations' ? t('bgNote') : ''}</span>
    ${S.tab === 'ranking' ? `<button class="btn sm" type="button" data-act="rankdir">${icon('swap')}${t(S.rankDir > 0 ? 'orderBest' : 'orderWorst')}</button>` : ''}`;
}

function renderTable() {
  renderTabs();
  const { d, h } = timeAt(S.k);
  const wrap = root.querySelector('#mTable');
  if (S.tab === 'stations') {
    const cs = snap.rows.find((r) => r.i === S.city);
    let body = `<tr class="avg click${S.station == null ? ' sel' : ''}" data-station="-1"><td class="l"><span class="name">${esc(cityName(S.city))}</span><span class="sub">${t('mean')}</span></td><td class="l muted">—</td>${valueCells(cs)}</tr>`;
    for (const si of cityStations(S.city)) {
      const st = STATIONS[si];
      const s = snapshot({ t: 'station', i: si }, S.mode, d, h);
      body += `<tr class="click${S.station === si ? ' sel' : ''}" data-station="${si}"><td class="l"><span class="name">${esc(stationName(si))}</span>${st[4] ? ` <span class="tag bg">${t('bgSite')}</span>` : ''}</td><td class="l muted">${st[3] >= 0 ? esc(countyName(st[3])) : '—'}</td>${valueCells(s)}</tr>`;
    }
    wrap.innerHTML = `<table class="tbl"><thead><tr><th class="l">${t('station')}</th><th class="l">${t('county')}</th>${valueHeads()}</tr></thead><tbody>${body}</tbody></table>`;
  } else {
    const rows = [...snap.rows].sort((a, b) => S.rankDir * (metricVal(a) - metricVal(b)) || S.rankDir * (a.aqi - b.aqi));
    let rank = 0, prev = null;
    const body = rows.map((r, j) => {
      const v = metricVal(r);
      if (v !== prev) { rank = j + 1; prev = v; }
      return `<tr class="click${r.i === S.city ? ' sel' : ''}" data-city="${r.i}"><td class="c"><span class="rank${rank <= 10 ? ' top' : ''}">${rank}</span></td><td class="l"><span class="name">${esc(cityName(r.i))}</span></td><td class="l muted">${esc(provName(CITIES[r.i][2]))}</td>${valueCells(r)}</tr>`;
    }).join('');
    wrap.innerHTML = `<table class="tbl"><thead><tr><th class="c">${t('rank')}</th><th class="l">${t('city')}</th><th class="l">${t('province')}</th>${valueHeads()}</tr></thead><tbody>${body}</tbody></table>`;
    const sel = wrap.querySelector('tr.sel');
    if (sel && S.scrollToSel) { sel.scrollIntoView({ block: 'center' }); S.scrollToSel = false; }
  }
}

// ---------------------------------------------------------------- actions
function renderMetric() {
  const opts = [['AQI', -1], ...POL_LABEL.map((l, p) => [p === 2 ? o3Label() : l, p])];
  root.querySelector('#mMetric').innerHTML = opts.map(([l, v]) => `<button type="button" data-metric="${v}" class="${v === S.metric ? 'on' : ''}">${l}</button>`).join('');
}

function updateTime() {
  computeSnap();
  renderMap();
  renderKpis();
  renderCard();
  renderTable();
  renderHourly();
  renderDaily();
  syncTimelineThumb();
}

function renderAll() {
  computeSnap();
  renderToolbar();
  renderMetric();
  renderKpis();
  renderMap();
  renderTimeline();
  renderCard();
  renderHourly();
  renderDaily();
  renderTable();
}

function selectCity(ci) {
  if (ci === S.city && S.station == null) return;
  S.city = ci;
  S.station = null;
  renderToolbar();
  renderMap();
  renderTimeline();
  renderCard();
  renderHourly();
  renderDaily();
  S.scrollToSel = true;
  renderTable();
}

function selectStation(si) {
  S.station = si < 0 ? null : si;
  renderTimeline();
  renderCard();
  renderHourly();
  renderDaily();
  renderTable();
}

function setPlaying(p) {
  S.playing = p;
  clearInterval(playTimer);
  if (p) {
    if (S.k >= STEPS[S.mode] - 1) { S.k = 0; updateTime(); }
    playTimer = setInterval(() => {
      if (S.k >= STEPS[S.mode] - 1) { setPlaying(false); return; }
      S.k += 1;
      updateTime();
    }, 850);
  }
  const b = root.querySelector('[data-act="play"]');
  if (b) { b.innerHTML = icon(p ? 'pause' : 'play'); b.title = t(p ? 'pause' : 'play'); }
}

function bind() {
  modeSeg = segmented(root.querySelector('#mMode'), [{ v: 'hour', label: () => t('modeHourly') }, { v: 'day', label: () => t('modeDaily') }], S.mode, (v) => {
    setPlaying(false);
    S.mode = v;
    S.k = STEPS[v] - 1;
    S.off.clear();
    renderAll();
  });
  picker = new Picker({ anchor: root.querySelector('#mCity'), getItems: () => cityItems(), getValue: () => S.city, onChange: (id) => selectCity(id), width: 300 });
  on(root, 'click', '[data-metric]', (ev, el) => {
    S.metric = +el.dataset.metric;
    S.off.clear();
    renderMetric();
    renderMap();
    if (S.tab === 'ranking') renderTable();
  });
  on(root, 'click', '.lg[data-lv]', (ev, el) => {
    const lv = +el.dataset.lv;
    if (S.off.has(lv)) S.off.delete(lv); else S.off.add(lv);
    renderMap();
  });
  on(root, 'input', '.tl-range', (ev, el) => {
    setPlaying(false);
    S.k = +el.value;
    updateTime();
  });
  on(root, 'click', '[data-act]', (ev, el) => {
    const a = el.dataset.act;
    if (a === 'play') setPlaying(!S.playing);
    else if (a === 'latest') { setPlaying(false); S.k = STEPS[S.mode] - 1; updateTime(); }
    else if (a === 'back') selectStation(-1);
    else if (a === 'rankdir') { S.rankDir = -S.rankDir; renderTable(); }
  });
  document.addEventListener('keydown', (ev) => {
    if (!visible || ev.ctrlKey || ev.metaKey || ev.altKey || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(ev.target.tagName)) return;
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      setPlaying(false);
      S.k = Math.max(0, Math.min(STEPS[S.mode] - 1, S.k + (ev.key === 'ArrowLeft' ? -1 : 1)));
      updateTime();
      ev.preventDefault();
    } else if (ev.key === ' ') {
      setPlaying(!S.playing);
      ev.preventDefault();
    }
  });
  on(root, 'click', '[data-tab]', (ev, el) => { S.tab = el.dataset.tab; S.scrollToSel = true; renderTable(); });
  on(root, 'click', 'tr[data-station]', (ev, el) => selectStation(+el.dataset.station));
  on(root, 'click', 'tr[data-city]', (ev, el) => selectCity(+el.dataset.city));
}

export default {
  mount(el) {
    root = el;
    layout();
    initMap();
    charts.hourly = makeChart(root.querySelector('#mHourly'));
    charts.daily = makeChart(root.querySelector('#mDaily'));
    bind();
    renderAll();
  },
  show() { visible = true; Object.values(charts).forEach((c) => c.resize()); },
  hide() { visible = false; setPlaying(false); },
  relang() { renderAll(); },
  newHour() {
    if (S.k === STEPS[S.mode] - 1 || !visible) S.k = STEPS[S.mode] - 1;
    else if (S.mode === 'hour') S.k = Math.max(0, S.k - 1);
    renderAll();
  },
};

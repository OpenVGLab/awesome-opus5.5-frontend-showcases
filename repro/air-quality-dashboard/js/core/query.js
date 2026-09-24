import { CITIES, COUNTIES, STATIONS, PROVINCES } from '../data/geo-data.js';
import * as M from './model.js';
import { hourlyAQI, dailyAQI } from './aqi.js';
import { cityName, provName, countyName, stationName, getLang, t } from './i18n.js';

export const XIAN = CITIES.findIndex((c) => c[0] === '西安');
export const cityE = (i) => ({ t: 'city', i });

// Snapshot of an entity. mode 'hour': hourly values at (d,h). mode 'day': daily record (today = cumulative to h).
// vals: [pm25, pm10, o3 (1h or 8h), no2, so2, co]
export function snapshot(e, mode, d, h) {
  if (mode === 'hour') {
    const vals = M.hourValues(e, d, h);
    if (!vals) return null;
    return { vals, ...hourlyAQI(vals) };
  }
  const rec = d === M.NOW.day ? M.cumulativeRecord(e, d, Math.min(h, M.NOW.hour)) : M.dayRecord(e, d);
  if (!rec) return null;
  return { vals: [rec[0], rec[1], rec[2], rec[3], rec[4], rec[5]], o3h: rec[6], ...dailyAQI(rec) };
}

export function cityItems(filter) {
  const zh = getLang() === 'zh';
  const out = [];
  CITIES.forEach((c, i) => {
    if (filter && !filter(i)) return;
    out.push({ id: i, label: cityName(i), sub: zh ? c[1] : c[0], group: provName(c[2]), keys: `${c[0]} ${c[1]} ${PROVINCES[c[2]][0]} ${PROVINCES[c[2]][1]}` });
  });
  return out;
}

export function countyItems(ci) {
  const c = CITIES[ci];
  const out = [];
  for (let k = c[8]; k < c[8] + c[9]; k++) {
    const kind = COUNTIES[k][3];
    out.push({ id: k, label: countyName(k), sub: t(['districtK', 'countyK', 'cityK'][kind]), keys: COUNTIES[k][0] + ' ' + COUNTIES[k][1] });
  }
  return out;
}

export function stationItems(ci) {
  const c = CITIES[ci];
  const out = [];
  for (let s = c[10]; s < c[10] + c[11]; s++) {
    const st = STATIONS[s];
    out.push({ id: s, label: stationName(s), sub: (st[3] >= 0 ? countyName(st[3]) + ' · ' : '') + t(st[4] ? 'bgSite' : 'evalSite'), keys: st[0] + ' ' + st[1] });
  }
  return out;
}

export const cityStations = (ci) => { const c = CITIES[ci]; const a = []; for (let s = c[10]; s < c[10] + c[11]; s++) a.push(s); return a; };
export const cityCounties = (ci) => { const c = CITIES[ci]; const a = []; for (let k = c[8]; k < c[8] + c[9]; k++) a.push(k); return a; };
export const provinceCities = (pi) => CITIES.map((c, i) => (c[2] === pi ? i : -1)).filter((i) => i >= 0);

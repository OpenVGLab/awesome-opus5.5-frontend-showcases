// Deterministic air-quality simulator. Every value is a pure function of (entity, day, hour), so the
// "live" feed, history, rankings and comparisons are mutually consistent without any stored dataset.
//
// City daily means  D(c,p,d) = base × season × trend × regional weather × dust × local noise
// City hourly       H(c,p,d,h) = D × w_h / mean(w), w = diurnal cycle × day-to-day ramp × hourly noise
//                   (so the mean of the 24 hourly values equals the daily mean exactly)
// Stations          city hourly × per-station factors, normalised so the evaluation stations average
//                   to the city value (background stations are excluded, as in the national network)
// Districts/counties city values × a slowly varying local factor.
import { CITIES, COUNTIES, STATIONS } from '../data/geo-data.js';
import { dailyAQIInto, hourlyAQI, percentile, compositeIndex } from './aqi.js';
import { nowParts, firstDayOfYear, DATA_START_YEAR } from './time.js';

// ---------- hashing & value noise ----------
function h32(x) {
  x |= 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
const INV = 1 / 4294967296;
const r2 = (a, b) => h32(Math.imul(a, 0x9e3779b1) ^ h32(b)) * INV;
const r4 = (a, b, c, d) => h32(Math.imul(a, 0x9e3779b1) ^ h32(Math.imul(b, 0x85ebca77) ^ h32(Math.imul(c, 0xc2b2ae3d) ^ h32(d)))) * INV;
const smooth = (t) => t * t * (3 - 2 * t);

// centred, roughly unit-variance value noise
function z1(seed, x) {
  const i = Math.floor(x);
  const f = smooth(x - i);
  const a = r2(seed, i);
  return (a + (r2(seed, i + 1) - a) * f - 0.5) / 0.249;
}
function z3(seed, x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const a0 = r4(seed, ix, iy, iz), a1 = r4(seed, ix + 1, iy, iz);
  const b0 = r4(seed, ix, iy + 1, iz), b1 = r4(seed, ix + 1, iy + 1, iz);
  const e0 = r4(seed, ix, iy, iz + 1), e1 = r4(seed, ix + 1, iy, iz + 1);
  const g0 = r4(seed, ix, iy + 1, iz + 1), g1 = r4(seed, ix + 1, iy + 1, iz + 1);
  const c00 = a0 + (a1 - a0) * fx;
  const c10 = b0 + (b1 - b0) * fx;
  const c01 = e0 + (e1 - e0) * fx;
  const c11 = g0 + (g1 - g0) * fx;
  const c0 = c00 + (c10 - c00) * fy;
  const c1 = c01 + (c11 - c01) * fy;
  return (c0 + (c1 - c0) * fz - 0.5) / 0.185;
}
function n3(seed, x, y, z) { return z3(seed, x, y, z) * 0.185 + 0.5; }

// ---------- diurnal cycles (index: pm25, pm10, o3, no2, so2, co) ----------
const DIURNAL = [
  [1.10, 1.12, 1.12, 1.10, 1.07, 1.04, 1.02, 1.03, 1.05, 1.03, 0.98, 0.93, 0.88, 0.85, 0.83, 0.83, 0.86, 0.91, 0.97, 1.03, 1.08, 1.11, 1.12, 1.11],
  [1.05, 1.02, 0.98, 0.95, 0.93, 0.93, 0.97, 1.05, 1.12, 1.10, 1.03, 0.97, 0.93, 0.91, 0.90, 0.90, 0.94, 1.00, 1.07, 1.10, 1.10, 1.08, 1.07, 1.06],
  [0.45, 0.40, 0.36, 0.33, 0.30, 0.28, 0.29, 0.35, 0.50, 0.75, 1.05, 1.40, 1.72, 1.95, 2.08, 2.05, 1.88, 1.60, 1.25, 0.95, 0.75, 0.62, 0.54, 0.49],
  [1.08, 1.02, 0.97, 0.93, 0.92, 0.95, 1.02, 1.12, 1.18, 1.12, 1.00, 0.88, 0.80, 0.75, 0.73, 0.74, 0.80, 0.92, 1.05, 1.15, 1.20, 1.20, 1.16, 1.12],
  [0.92, 0.90, 0.88, 0.87, 0.87, 0.88, 0.92, 0.98, 1.06, 1.14, 1.18, 1.18, 1.14, 1.08, 1.03, 1.00, 0.98, 0.98, 0.99, 1.00, 0.99, 0.97, 0.95, 0.93],
  [1.06, 1.05, 1.03, 1.01, 0.99, 0.98, 1.00, 1.05, 1.08, 1.06, 1.00, 0.95, 0.91, 0.89, 0.88, 0.88, 0.91, 0.96, 1.02, 1.07, 1.09, 1.09, 1.08, 1.07],
].map((a) => { const m = a.reduce((s, v) => s + v, 0) / 24; return a.map((v) => v / m); });
// ratio of the daily-max 8 h O3 mean to the daily mean, used to convert the MDA8 profile to a daily mean
const K_O3 = (() => {
  let best = 0;
  for (let h = 0; h <= 16; h++) { let s = 0; for (let k = 0; k < 8; k++) s += DIURNAL[2][h + k]; best = Math.max(best, s / 8); }
  return best;
})();

// ---------- time range ----------
export const NOW = { day: 0, hour: 0 };
export const DAY0 = firstDayOfYear(DATA_START_YEAR) - 1;
let DAYN = 0;
let dayYear, dayDoy;
function buildCalendar() {
  const n = DAYN - DAY0 + 1;
  dayYear = new Int16Array(n);
  dayDoy = new Int16Array(n);
  let y = DATA_START_YEAR - 1;
  let start = firstDayOfYear(y);
  let next = firstDayOfYear(y + 1);
  for (let d = DAY0; d <= DAYN; d++) {
    while (d >= next) { y++; start = next; next = firstDayOfYear(y + 1); }
    dayYear[d - DAY0] = y;
    dayDoy[d - DAY0] = d - start;
  }
}
export function setNow(parts = nowParts()) {
  const changed = parts.day !== NOW.day || parts.hour !== NOW.hour;
  NOW.day = parts.day;
  NOW.hour = parts.hour;
  if (parts.day + 3 > DAYN) {
    DAYN = parts.day + 40;
    buildCalendar();
    rawStore.clear();
    recStore.clear();
    hourCache.clear();
  }
  if (changed) partialCache.clear();
  return changed;
}
export const FIRST_DAY = DAY0 + 1;

// ---------- city parameters ----------
const TAU = Math.PI * 2;
const CP = CITIES.map((c, i) => {
  const pr = c[7];
  return {
    lon: c[3], lat: c[4], pm25: pr[0], pm10r: pr[1], o3: pr[2] / K_O3, no2: pr[3], so2: pr[4], co: pr[5],
    dust: pr[6], heat: pr[7], o3peak: pr[8], o3amp: pr[9], seed: 1000 + i * 7919,
  };
});
const S_STAG1 = 11, S_STAG2 = 12, S_DUST = 13, S_O3 = 14;
// seasonal lookup tables by day of year
const COS_WINTER = new Float64Array(367), COS_SPRING = new Float64Array(367), DUST_SEASON = new Float64Array(367);
for (let i = 0; i < 367; i++) {
  COS_WINTER[i] = Math.cos((TAU * (i - 15)) / 365.25);
  COS_SPRING[i] = Math.cos((TAU * (i - 105)) / 365.25);
  const g = (i - 105) / 42;
  DUST_SEASON[i] = Math.exp(-g * g);
}
const TR_PM = Math.log(0.965), TR_NO2 = Math.log(0.975), TR_SO2 = Math.log(0.95), TR_CO = Math.log(0.97), TR_O3 = Math.log(1.008);

// ---------- daily means ----------
const rawStore = new Map(); // city -> Float32Array((DAYN-DAY0+1)*6), NaN = not computed
function rawArr(ci) {
  let a = rawStore.get(ci);
  if (!a) { a = new Float32Array((DAYN - DAY0 + 1) * 6).fill(NaN); rawStore.set(ci, a); }
  return a;
}
function computeRaw(ci, d, a, o) {
  const c = CP[ci];
  const k = d - DAY0;
  const doy = dayDoy[k];
  const yf = dayYear[k] + doy / 365.25 - 2023.5;
  const w = COS_WINTER[doy];
  const winter = 0.5 + 0.5 * w;
  // regional weather (stagnation) shared by neighbouring cities, in log space
  const zs = (z3(S_STAG1, c.lon / 7, c.lat / 7, d / 3.5) + 0.55 * z3(S_STAG2, c.lon / 2.6, c.lat / 2.6, d / 1.4)) / 1.141;
  const sig = 0.33 + 0.38 * winter * (0.45 + 0.6 * c.heat);
  const ls = sig * zs - (sig * sig) / 2;
  const lc = 0.13 * z1(c.seed + 1, d / 1.6) - 0.0085;
  let E = 0;
  if (c.dust > 0.05) {
    const nd = n3(S_DUST, c.lon / 9, c.lat / 9, d / 2.2);
    if (nd > 0.66) E = c.dust * (DUST_SEASON[doy] + (c.dust > 0.8 ? 0.3 : 0.06)) * ((nd - 0.66) / 0.34) * 3.2;
  }
  const pmBase = c.pm25 * (1 + (0.22 + 0.33 * c.heat) * w) * Math.exp(TR_PM * yf + ls + lc + 0.08 * z1(c.seed + 2, d / 1.1));
  const pm25 = Math.max(2, pmBase * (1 + 0.25 * E));
  const ratio = c.pm10r * (1 + 0.12 * COS_SPRING[doy]) * Math.exp(0.07 * z1(c.seed + 3, d / 1.3) - 0.2 * ls);
  const pm10 = Math.max(pm25 * 1.12 + 2, pmBase * ratio * (1 + E));
  const wd = (d + 4) % 7;
  const weekday = wd === 0 || wd === 6 ? 0.92 : 1.02;
  const no2 = Math.max(2, c.no2 * (1 + (0.18 + 0.12 * c.heat) * w) * weekday * Math.exp(TR_NO2 * yf + 0.5 * ls + 0.7 * lc + 0.09 * z1(c.seed + 4, d / 1.2)));
  const so2 = Math.max(1.5, c.so2 * (1 + (0.25 + 0.4 * c.heat) * w) * Math.exp(TR_SO2 * yf + 0.45 * ls + 0.14 * z1(c.seed + 5, d / 1.5)));
  const co = Math.max(0.12, c.co * (1 + (0.2 + 0.3 * c.heat) * w) * Math.exp(TR_CO * yf + 0.6 * ls + 0.5 * lc + 0.07 * z1(c.seed + 6, d / 1.2)));
  const sO3 = Math.max(0.35, 1 + c.o3amp * Math.cos((TAU * (doy - c.o3peak)) / 365.25));
  const zo = (z3(S_O3, c.lon / 6, c.lat / 6, d / 2.5) + 0.5 * z1(c.seed + 7, d)) / 1.118;
  const o3 = Math.max(4, c.o3 * sO3 * Math.exp(TR_O3 * yf + 0.24 * zo - 0.03 + (0.15 * (1 - winter) - 0.25 * winter) * ls));
  a[o] = pm25; a[o + 1] = pm10; a[o + 2] = o3; a[o + 3] = no2; a[o + 4] = so2; a[o + 5] = co;
}
// returns the backing array; values at offset (d-DAY0)*6
function raw(ci, d) {
  const a = rawArr(ci);
  const o = (d - DAY0) * 6;
  if (Number.isNaN(a[o])) computeRaw(ci, d, a, o);
  return a;
}

// ---------- city hourly ----------
const wbuf = new Float64Array(24);
const latt = new Float64Array(12);
function hourWeights(ci, d, p, dPrev, dCur, dNext) {
  const L0 = Math.sqrt(dPrev / dCur);
  const L1 = Math.sqrt(dNext / dCur);
  const seed = CP[ci].seed + 100 + p * 131;
  const dia = DIURNAL[p];
  // hourly value noise with a 3.2 h lattice; lattice points are hashed once per day
  const i0 = Math.floor((d * 24) / 3.2);
  const i1 = Math.floor((d * 24 + 23) / 3.2) + 1;
  for (let i = i0; i <= i1; i++) latt[i - i0] = r2(seed, i);
  let sum = 0;
  for (let h = 0; h < 24; h++) {
    const t = (h + 0.5) / 24;
    const ramp = t < 0.5 ? L0 + (1 - L0) * (t / 0.5) : 1 + (L1 - 1) * ((t - 0.5) / 0.5);
    const hi = d * 24 + h;
    const x = hi / 3.2;
    const i = Math.floor(x);
    const la = latt[i - i0];
    const nz = (la + (latt[i - i0 + 1] - la) * smooth(x - i) - 0.5) / 0.249;
    const v = dia[h] * ramp * Math.exp(0.12 * nz + 0.08 * (r2(seed + 1, hi) - 0.5));
    wbuf[h] = v;
    sum += v;
  }
  return sum / 24;
}
const hourCache = new Map();
export function cityHourly(ci, d) {
  const key = ci * 100000 + (d - DAY0);
  let out = hourCache.get(key);
  if (out) return out;
  out = new Float32Array(144);
  const a = raw(ci, d - 1); raw(ci, d); raw(ci, d + 1);
  const o = (d - DAY0) * 6;
  for (let p = 0; p < 6; p++) {
    const cur = a[o + p];
    const mean = hourWeights(ci, d, p, a[o - 6 + p], cur, a[o + 6 + p]);
    for (let h = 0; h < 24; h++) out[h * 6 + p] = (cur * wbuf[h]) / mean;
  }
  if (hourCache.size > 6000) hourCache.clear();
  hourCache.set(key, out);
  return out;
}

// O3 daily metrics from an hourly O3 series (length n <= 24)
function o3Metrics(get, n) {
  let max1 = 0;
  for (let h = 0; h < n; h++) max1 = Math.max(max1, get(h));
  let max8 = 0;
  if (n >= 8) {
    let s = 0;
    for (let h = 0; h < 8; h++) s += get(h);
    max8 = s / 8;
    for (let h = 8; h < n; h++) { s += get(h) - get(h - 8); max8 = Math.max(max8, s / 8); }
  } else if (n > 0) {
    let s = 0; for (let h = 0; h < n; h++) s += get(h); max8 = s / n;
  }
  return [max8, max1];
}

// ---------- city daily records: [pm25, pm10, o3_8h, no2, so2, co, o3_1hMax] ----------
const recStore = new Map();
function cityRecFull(ci, d) {
  let a = recStore.get(ci);
  if (!a) { a = new Float32Array((DAYN - DAY0 + 1) * 7).fill(NaN); recStore.set(ci, a); }
  const o = (d - DAY0) * 7;
  if (Number.isNaN(a[o])) fillRec(ci, d, a, o);
  return a.subarray(o, o + 7);
}
function fillRec(ci, d, a, o) {
  const r = raw(ci, d - 1); raw(ci, d); raw(ci, d + 1);
  const q = (d - DAY0) * 6;
  const cur = r[q + 2];
  const k = cur / hourWeights(ci, d, 2, r[q - 4], cur, r[q + 8]);
  let m1 = 0, s = 0, m8 = 0;
  for (let h = 0; h < 24; h++) {
    const v = wbuf[h] * k;
    if (v > m1) m1 = v;
    s += v;
    if (h >= 8) s -= wbuf[h - 8] * k;
    if (h >= 7 && s / 8 > m8) m8 = s / 8;
  }
  a[o] = r[q]; a[o + 1] = r[q + 1]; a[o + 2] = m8; a[o + 3] = r[q + 3]; a[o + 4] = r[q + 4]; a[o + 5] = r[q + 5]; a[o + 6] = m1;
}
// bulk access for a city over a day range (fills the cache); returns the backing array, stride 7
export function cityRecords(ci, d0, d1) {
  let a = recStore.get(ci);
  if (!a) { a = new Float32Array((DAYN - DAY0 + 1) * 7).fill(NaN); recStore.set(ci, a); }
  for (let d = d0; d <= d1; d++) {
    const o = (d - DAY0) * 7;
    if (Number.isNaN(a[o])) fillRec(ci, d, a, o);
  }
  return a;
}
function recFromHours(hours, n) {
  const rec = new Float32Array(7);
  for (let p = 0; p < 6; p++) {
    if (p === 2) continue;
    let s = 0; for (let h = 0; h < n; h++) s += hours[h * 6 + p];
    rec[p] = s / n;
  }
  const [m8, m1] = o3Metrics((h) => hours[h * 6 + 2], n);
  rec[2] = m8; rec[6] = m1;
  return rec;
}

// ---------- entities ----------
// entity: { t: 'city' | 'county' | 'station', i: index }
export const cityOf = (e) => (e.t === 'city' ? e.i : e.t === 'county' ? COUNTIES[e.i][2] : STATIONS[e.i][2]);

const countyBase = new Map();
function countyFactors(k) {
  let f = countyBase.get(k);
  if (f) return f;
  const kind = COUNTIES[k][3];
  const s = 50000 + k * 613;
  const u = (j) => r2(s, j);
  const R = [
    [[0.92, 1.1], [0.92, 1.12], [0.95, 1.03], [0.95, 1.2], [0.8, 1.3], [0.9, 1.1]],
    [[0.8, 1.15], [0.8, 1.2], [1.0, 1.1], [0.6, 0.9], [0.7, 1.4], [0.85, 1.1]],
    [[0.85, 1.12], [0.85, 1.15], [0.98, 1.08], [0.75, 1.0], [0.7, 1.4], [0.85, 1.1]],
  ][kind];
  f = R.map(([lo, hi], p) => lo + (hi - lo) * u(p));
  countyBase.set(k, f);
  return f;
}
function countyDayFactor(k, d, out) {
  const f = countyFactors(k);
  const s = 60000 + k * 389;
  for (let p = 0; p < 6; p++) out[p] = f[p] * Math.exp(0.1 * z1(s + p, d / 1.3) - 0.005);
  return out;
}

const stationBase = new Map();
function stationFactors(si) {
  let f = stationBase.get(si);
  if (f) return f;
  const bg = STATIONS[si][4] === 1;
  const s = 70000 + si * 977;
  const g = (j) => (r2(s, j) + r2(s, j + 10) + r2(s, j + 20) - 1.5) / 0.5; // ~N(0,1)
  const spread = [0.08, 0.12, 0.07, 0.2, 0.25, 0.12];
  const bgMul = [0.6, 0.55, 1.15, 0.35, 0.6, 0.7];
  f = spread.map((sd, p) => Math.exp(sd * g(p)) * (bg ? bgMul[p] : 1));
  stationBase.set(si, f);
  return f;
}
const cityStationCache = new Map();
// all stations of a city for one day: Map stationIdx -> Float32Array(144)
function cityStationsHourly(ci, d) {
  const key = ci * 100000 + (d - DAY0);
  let res = cityStationCache.get(key);
  if (res) return res;
  const city = cityHourly(ci, d);
  const first = CITIES[ci][10], count = CITIES[ci][11];
  const ids = [];
  for (let s = first; s < first + count; s++) ids.push(s);
  const evalIds = ids.filter((s) => STATIONS[s][4] === 0);
  res = new Map(ids.map((s) => [s, new Float32Array(144)]));
  const g = new Float64Array(ids.length);
  for (let h = 0; h < 24; h++) {
    const hi = d * 24 + h;
    for (let p = 0; p < 6; p++) {
      let sum = 0;
      ids.forEach((s, j) => {
        const v = stationFactors(s)[p] * Math.exp(0.09 * z1(80000 + s * 131 + p, hi / 4));
        g[j] = v;
        if (STATIONS[s][4] === 0) sum += v;
      });
      const norm = evalIds.length ? sum / evalIds.length : 1;
      const base = city[h * 6 + p];
      ids.forEach((s, j) => {
        const bg = STATIONS[s][4] === 1;
        res.get(s)[h * 6 + p] = base * (bg ? g[j] : g[j] / norm);
      });
    }
  }
  if (cityStationCache.size > 800) cityStationCache.clear();
  cityStationCache.set(key, res);
  return res;
}

const fbuf = new Float64Array(6);
// hourly values for a day, Float32Array(144) hour-major; hours after NOW are NaN for today
export function hourSeries(e, d) {
  let src;
  if (e.t === 'city') src = cityHourly(e.i, d);
  else if (e.t === 'station') src = cityStationsHourly(STATIONS[e.i][2], d).get(e.i);
  else {
    const city = cityHourly(COUNTIES[e.i][2], d);
    countyDayFactor(e.i, d, fbuf);
    src = new Float32Array(144);
    for (let h = 0; h < 24; h++) for (let p = 0; p < 6; p++) src[h * 6 + p] = city[h * 6 + p] * fbuf[p];
  }
  if (d === NOW.day) {
    const out = Float32Array.from(src);
    out.fill(NaN, (NOW.hour + 1) * 6);
    return out;
  }
  return src;
}

export const hasDay = (d) => d >= FIRST_DAY && d <= NOW.day;
export const hasHour = (d, h) => hasDay(d) && (d < NOW.day || h <= NOW.hour);

export function hourValues(e, d, h) {
  if (!hasHour(d, h)) return null;
  const s = hourSeries(e, d);
  return Array.from(s.subarray(h * 6, h * 6 + 6));
}

const partialCache = new Map();
// daily record (7 values). For today: cumulative from 00:00 to the latest hour.
export function dayRecord(e, d) {
  if (!hasDay(d)) return null;
  if (d === NOW.day) {
    const key = e.t + e.i;
    let r = partialCache.get(key);
    if (!r) { r = recFromHours(hourSeries(e, d), NOW.hour + 1); partialCache.set(key, r); }
    return r;
  }
  if (e.t === 'city') return cityRecFull(e.i, d);
  if (e.t === 'county') {
    const base = cityRecFull(COUNTIES[e.i][2], d);
    countyDayFactor(e.i, d, fbuf);
    const r = new Float32Array(7);
    for (let p = 0; p < 6; p++) r[p] = base[p] * fbuf[p];
    r[6] = base[6] * fbuf[2];
    return r;
  }
  return recFromHours(cityStationsHourly(STATIONS[e.i][2], d).get(e.i), 24);
}

// cumulative daily record for today up to (and including) hour h — used by the "daily cumulative" timeline
export function cumulativeRecord(e, d, h) {
  if (!hasHour(d, h)) return null;
  return recFromHours(hourSeries(e, d), h + 1);
}

// ---------- period statistics ----------
// d0..d1 inclusive (clipped to available data). Returns null when no day is available.
const subBuf = new Float64Array(6);
export function periodStats(e, d0, d1) {
  d0 = Math.max(d0, FIRST_DAY);
  d1 = Math.min(d1, NOW.day);
  if (d1 < d0) return null;
  const n = d1 - d0 + 1;
  const sums = [0, 0, 0, 0, 0, 0];
  const o3 = new Float64Array(n);
  const co = new Float64Array(n);
  const levels = [0, 0, 0, 0, 0, 0];
  let good = 0, aqiSum = 0, maxAqi = 0;
  const primCount = [0, 0, 0, 0, 0, 0];
  const bulk = e.t === 'city' ? cityRecords(e.i, d0, Math.min(d1, NOW.day - 1)) : null;
  for (let d = d0, j = 0; d <= d1; d++, j++) {
    const r = bulk && d < NOW.day ? bulk.subarray((d - DAY0) * 7, (d - DAY0) * 7 + 7) : dayRecord(e, d);
    for (let p = 0; p < 6; p++) sums[p] += r[p];
    o3[j] = r[2]; co[j] = r[5];
    const aqi = dailyAQIInto(r, subBuf);
    aqiSum += aqi;
    if (aqi > maxAqi) maxAqi = aqi;
    if (aqi <= 100) good++;
    levels[aqi <= 50 ? 0 : aqi <= 100 ? 1 : aqi <= 150 ? 2 : aqi <= 200 ? 3 : aqi <= 300 ? 4 : 5]++;
    if (aqi > 50) for (let p = 0; p < 6; p++) if (subBuf[p] === aqi) primCount[p]++;
  }
  const mean = sums.map((s) => s / n);
  const o3p90 = percentile(o3, 90);
  const cop95 = percentile(co, 95);
  const ci = compositeIndex([mean[0], mean[1], o3p90, mean[3], mean[4], cop95]);
  return { n, d0, d1, mean, o3p90, cop95, ci: ci.total, ciSub: ci.sub, ciPrimary: ci.primary, good, goodRate: good / n, aqiMean: aqiSum / n, maxAqi, levels, primCount };
}

// Hourly AQI helper for a day series
export function hourAQI(series, h) {
  const v = [series[h * 6], series[h * 6 + 1], series[h * 6 + 2], series[h * 6 + 3], series[h * 6 + 4], series[h * 6 + 5]];
  if (Number.isNaN(v[0])) return null;
  return { vals: v, ...hourlyAQI(v) };
}

setNow();

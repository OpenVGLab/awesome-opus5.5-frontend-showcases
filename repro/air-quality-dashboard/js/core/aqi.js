// Ambient Air Quality Index per HJ 633-2012, composite index per HJ 663-2013.
// Concentrations: µg/m³, except CO in mg/m³.

export const POLS = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co'];
export const P = { pm25: 0, pm10: 1, o3: 2, no2: 3, so2: 4, co: 5 };

const IAQI = [0, 50, 100, 150, 200, 300, 400, 500];
export const BP = {
  so2_24h: [0, 50, 150, 475, 800, 1600, 2100, 2620],
  so2_1h: [0, 150, 500, 650, 800],
  no2_24h: [0, 40, 80, 180, 280, 565, 750, 940],
  no2_1h: [0, 100, 200, 700, 1200, 2340, 3090, 3840],
  pm10_24h: [0, 50, 150, 250, 350, 420, 500, 600],
  co_24h: [0, 2, 4, 14, 24, 36, 48, 60],
  co_1h: [0, 5, 10, 35, 60, 90, 120, 150],
  o3_1h: [0, 160, 200, 300, 400, 800, 1000, 1200],
  o3_8h: [0, 100, 160, 215, 265, 800],
  pm25_24h: [0, 35, 75, 115, 150, 250, 350, 500],
};

export function iaqi(c, bp) {
  if (c == null || Number.isNaN(c)) return null;
  if (c <= 0) return 0;
  for (let i = 1; i < bp.length; i++) {
    if (c <= bp[i]) return Math.ceil(((IAQI[i] - IAQI[i - 1]) / (bp[i] - bp[i - 1])) * (c - bp[i - 1]) + IAQI[i - 1]);
  }
  return 500;
}

export const round = (p, v) => (p === 5 ? Math.round(v * 10) / 10 : Math.round(v));

// Real-time (hourly) AQI. vals: [pm25, pm10, o3(1h), no2, so2, co] raw hourly concentrations.
export function hourlyAQI(vals) {
  const c = vals.map((v, i) => round(i, v));
  const sub = [
    iaqi(c[0], BP.pm25_24h),
    iaqi(c[1], BP.pm10_24h),
    iaqi(c[2], BP.o3_1h),
    iaqi(c[3], BP.no2_1h),
    c[4] <= 800 ? iaqi(c[4], BP.so2_1h) : iaqi(c[4], BP.so2_24h),
    iaqi(c[5], BP.co_1h),
  ];
  return finish(sub);
}

// Daily AQI. rec: [pm25, pm10, o3_8h, no2, so2, co, o3_1hMax] daily values.
export function dailyAQI(rec) {
  const c = [round(0, rec[0]), round(1, rec[1]), Math.round(rec[2]), round(3, rec[3]), round(4, rec[4]), round(5, rec[5])];
  const o3h = Math.round(rec[6]);
  const o3a = c[2] <= 800 ? iaqi(c[2], BP.o3_8h) : iaqi(o3h, BP.o3_1h);
  const sub = [
    iaqi(c[0], BP.pm25_24h),
    iaqi(c[1], BP.pm10_24h),
    Math.max(o3a, iaqi(o3h, BP.o3_1h)),
    iaqi(c[3], BP.no2_24h),
    iaqi(c[4], BP.so2_24h),
    iaqi(c[5], BP.co_24h),
  ];
  return finish(sub);
}

// Allocation-free variant for bulk statistics: writes the six sub-indices into `sub`, returns the AQI.
export function dailyAQIInto(rec, sub) {
  const o3 = Math.round(rec[2]);
  const o3h = Math.round(rec[6]);
  sub[0] = iaqi(Math.round(rec[0]), BP.pm25_24h);
  sub[1] = iaqi(Math.round(rec[1]), BP.pm10_24h);
  sub[2] = Math.max(o3 <= 800 ? iaqi(o3, BP.o3_8h) : iaqi(o3h, BP.o3_1h), iaqi(o3h, BP.o3_1h));
  sub[3] = iaqi(Math.round(rec[3]), BP.no2_24h);
  sub[4] = iaqi(Math.round(rec[4]), BP.so2_24h);
  sub[5] = iaqi(Math.round(rec[5] * 10) / 10, BP.co_24h);
  let aqi = 0;
  for (let i = 0; i < 6; i++) if (sub[i] > aqi) aqi = sub[i];
  return aqi;
}

function finish(sub) {
  let aqi = 0;
  for (const s of sub) if (s > aqi) aqi = s;
  const primary = [];
  if (aqi > 50) sub.forEach((s, i) => { if (s === aqi) primary.push(i); });
  return { aqi, sub, primary };
}

// Pollutant IAQI (for colouring a single pollutant). mode: 'hour' | 'day'
export function pollutantIAQI(p, v, mode = 'hour') {
  if (v == null) return null;
  const c = round(p, v);
  switch (p) {
    case 0: return iaqi(c, BP.pm25_24h);
    case 1: return iaqi(c, BP.pm10_24h);
    case 2: return mode === 'hour' ? iaqi(c, BP.o3_1h) : (c <= 800 ? iaqi(c, BP.o3_8h) : iaqi(c, BP.o3_1h));
    case 3: return iaqi(c, mode === 'hour' ? BP.no2_1h : BP.no2_24h);
    case 4: return mode === 'hour' && c <= 800 ? iaqi(c, BP.so2_1h) : iaqi(c, BP.so2_24h);
    case 5: return iaqi(c, mode === 'hour' ? BP.co_1h : BP.co_24h);
    default: return null;
  }
}

// Concentration breakpoints that correspond to the AQI level boundaries (used for chart colour bands).
export function levelBreaks(p, mode = 'hour') {
  const t = {
    0: BP.pm25_24h, 1: BP.pm10_24h,
    2: mode === 'hour' ? BP.o3_1h : BP.o3_8h,
    3: mode === 'hour' ? BP.no2_1h : BP.no2_24h,
    4: mode === 'hour' ? BP.so2_1h : BP.so2_24h,
    5: mode === 'hour' ? BP.co_1h : BP.co_24h,
  }[p];
  return t.slice(1, 6);
}

export const LEVELS = [
  { max: 50, color: '#2bd66c', ink: '#05230f' },
  { max: 100, color: '#f2d53c', ink: '#2e2500' },
  { max: 150, color: '#ff8c1a', ink: '#2e1500' },
  { max: 200, color: '#f5383f', ink: '#ffffff' },
  { max: 300, color: '#b8327f', ink: '#ffffff' },
  { max: Infinity, color: '#8f1d3a', ink: '#ffffff' },
];
export const LEVEL_EDGES = [0, 50, 100, 150, 200, 300, 500];

export function levelIndex(aqi) {
  if (aqi == null) return -1;
  for (let i = 0; i < LEVELS.length; i++) if (aqi <= LEVELS[i].max) return i;
  return 5;
}
export const levelColor = (aqi) => (aqi == null ? '#5b6b85' : LEVELS[levelIndex(aqi)].color);

// ---------- composite index (monthly / annual) ----------
export const ANNUAL_STD = [35, 70, 160, 40, 60, 4]; // pm25, pm10, o3 (90th pct MDA8), no2, so2, co (95th pct)

// HJ 663 percentile: k = 1 + (n - 1) * p / 100
export function percentile(values, p) {
  const a = Float64Array.from(values).sort();
  const n = a.length;
  if (!n) return null;
  const k = 1 + ((n - 1) * p) / 100;
  const s = Math.floor(k);
  if (s >= n) return a[n - 1];
  return a[s - 1] + (a[s] - a[s - 1]) * (k - s);
}

// stats: [pm25Mean, pm10Mean, o3Per90, no2Mean, so2Mean, coPer95]
export function compositeIndex(stats) {
  const sub = stats.map((v, i) => v / ANNUAL_STD[i]);
  const total = sub.reduce((a, b) => a + b, 0);
  let maxI = 0;
  sub.forEach((v, i) => { if (v > sub[maxI]) maxI = i; });
  return { total, sub, primary: maxI };
}

// Canvas frame: 8192 x 8192 m at 1 m per voxel, rotated 22.5 deg counter-clockwise from true north.
//
// Why rotated: Governors Island and the south end of Central Park are ~9.3 km apart along the
// Manhattan street grid (29 deg east of north), which does not fit in 8.19 km. Turning the frame
// 22.5 deg west of north puts that line on the canvas diagonal, so the Battery, Governors Island,
// Brooklyn Heights / DUMBO, the Jersey City + Hoboken waterfront and Central Park up to Sheep
// Meadow and Bethesda Terrace all fit. Manhattan's grid then runs at 51.5 deg to the voxel axes.
//
// Axes: x grows toward "frame east" (true bearing 67.5 deg), z grows toward "frame south"
// (bearing 202.5 deg), y is up. y = SEA is mean high water.
export const W = 8192;
export const SEA = 24;
export const THETA_DEG = -22.5;
const TH = THETA_DEG * Math.PI / 180;
const CT = Math.cos(TH), ST = Math.sin(TH);
// Local tangent plane around 5th Ave & 59th St (the SE corner of Central Park).
export const LAT0 = 40.7644, LON0 = -73.9727;
export const MLAT = 111049, MLON = 84472; // metres per degree at 40.73 N
export const U0 = -7471, V1 = 1200;       // frame offsets (metres) of the canvas edges x = 0 and z = 0

export function en2xz(dE, dN) {
  const u = dE * CT - dN * ST, v = dE * ST + dN * CT;
  return [u - U0, V1 - v];
}
export function xz2en(x, z) {
  const u = x + U0, v = V1 - z;
  return [u * CT + v * ST, -u * ST + v * CT];
}
export const ll = (lat, lon) => en2xz((lon - LON0) * MLON, (lat - LAT0) * MLAT);
export function xz2ll(x, z) { const [e, n] = xz2en(x, z); return [LAT0 + n / MLAT, LON0 + e / MLON]; }

// Manhattan street grid. e = metres grid-east of the 5th Avenue centreline, n = street number.
// Streets: 60 ft wide, 200 ft blocks; 100 ft "wide" streets add 40 ft. Calibrated so that
// 14th -> 59th St measures 3670 m along 5th Avenue.
export const GRID_DEG = 29;
const GA = GRID_DEG * Math.PI / 180, GC = Math.cos(GA), GS = Math.sin(GA);
export const WIDE_STREETS = new Set([14, 23, 34, 42, 57, 59, 72, 79, 86, 96]);
const SPOS = new Float64Array(140);
{
  const wide = (n) => (WIDE_STREETS.has(n) ? 6.1 : 0);
  for (let n = 1; n < 140; n++) SPOS[n] = SPOS[n - 1] + 79.25 + wide(n - 1) + wide(n);
  const k = 3670 / (SPOS[59] - SPOS[14]);
  const base = SPOS[59];
  for (let n = 0; n < 140; n++) SPOS[n] = (SPOS[n] - base) * k;
}
export const STREET_SPACING = 3670 / 45;
// s = metres grid-north of the 59th Street centreline
export function sOf(n) {
  if (n <= 0) return SPOS[0] + n * STREET_SPACING;
  if (n >= 139) return SPOS[139] + (n - 139) * STREET_SPACING;
  const i = Math.floor(n), f = n - i;
  return SPOS[i] + (SPOS[i + 1] - SPOS[i]) * f;
}
export function nOf(s) {
  if (s <= SPOS[0]) return (s - SPOS[0]) / STREET_SPACING;
  if (s >= SPOS[139]) return 139 + (s - SPOS[139]) / STREET_SPACING;
  let lo = 0, hi = 139;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SPOS[m] <= s) lo = m; else hi = m; }
  return lo + (s - SPOS[lo]) / (SPOS[lo + 1] - SPOS[lo]);
}
export function es2en(e, s) { return [e * GC + s * GS, -e * GS + s * GC]; }
export function en2es(dE, dN) { return [dE * GC - dN * GS, dE * GS + dN * GC]; }
export const mg = (e, n) => { const [dE, dN] = es2en(e, sOf(n)); return en2xz(dE, dN); };
export function xz2es(x, z) { const [dE, dN] = xz2en(x, z); return en2es(dE, dN); }
export function xz2mg(x, z) { const [e, s] = xz2es(x, z); return [e, nOf(s)]; }
// grid-north and grid-east unit vectors in (x, z)
export const GRID_N = (() => { const a = mg(0, 60), b = mg(0, 59); const L = Math.hypot(a[0] - b[0], a[1] - b[1]); return [(a[0] - b[0]) / L, (a[1] - b[1]) / L]; })();
export const GRID_E = [-GRID_N[1], GRID_N[0]];
// true bearing (deg) -> unit vector in (x, z)
export function bearingXZ(deg) {
  const r = deg * Math.PI / 180;
  const [x0, z0] = en2xz(0, 0), [x1, z1] = en2xz(Math.sin(r), Math.cos(r));
  return [x1 - x0, z1 - z0];
}

// Avenue centrelines (metres grid-east of 5th Ave) and property-line widths.
export const AVE = {
  twelfth: -1927, eleventh: -1682, tenth: -1414, ninth: -1146, eighth: -878, seventh: -610, sixth: -305, fifth: 0,
  madison: 155, park: 304, lexington: 451, third: 606, second: 817, first: 1042, york: 1233,
  aveA: 1252, aveB: 1457, aveC: 1662, aveD: 1862,
};

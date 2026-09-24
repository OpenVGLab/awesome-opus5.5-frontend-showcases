// All times are China Standard Time (UTC+8), represented as day indices (days since 1970-01-01 CST)
// and hours 0-23. Dates are handled with UTC getters on a shifted timestamp.

const DAY_MS = 86400000;
const OFFSET = 8 * 3600000;

export const DATA_START_YEAR = 2020;

export function nowParts() {
  const ms = Date.now() + OFFSET;
  const day = Math.floor(ms / DAY_MS);
  const d = new Date(ms);
  return { day, hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds() };
}

export const dateOf = (day) => new Date(day * DAY_MS);
export const pad = (n) => String(n).padStart(2, '0');

export function fmtDay(day) {
  const d = dateOf(day);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function fmtShort(day) {
  const d = dateOf(day);
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function fmtHour(day, hour) {
  return `${fmtDay(day)} ${pad(hour)}:00`;
}
export function parseDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS);
}
export const yearOf = (day) => dateOf(day).getUTCFullYear();
export const monthOf = (day) => dateOf(day).getUTCMonth() + 1;
export const dateNum = (day) => dateOf(day).getUTCDate();
export const weekdayOf = (day) => dateOf(day).getUTCDay();
export const dayFromYMD = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
export const firstDayOfYear = (y) => dayFromYMD(y, 1, 1);
export const firstDayOfMonth = (y, m) => dayFromYMD(y, m, 1);
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const dayOfYear = (day) => day - firstDayOfYear(yearOf(day));
export const fmtMonth = (y, m) => `${y}-${pad(m)}`;

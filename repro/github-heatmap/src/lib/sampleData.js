import * as d3 from 'd3';
import { formatKey, parseKey } from './dates.js';

// Deterministic, realistic-looking contribution history: busy and quiet project
// phases, lighter weekends, holidays, occasional release-day spikes and a slow
// upward trend. The same seed always produces the same data.

export const SAMPLE_START = new Date(2021, 0, 1);
const EPOCH = new Date(2020, 0, 1);

function hash(seed, n) {
  let h = Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(n | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rngFor = (seed, n) => mulberry32(Math.floor(hash(seed, n) * 4294967296));

// Smooth 1-D value noise in [0, 1).
function noise(seed, x) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(seed, i);
  const b = hash(seed, i + 1);
  return a + (b - a) * f * f * (3 - 2 * f);
}

// Sun … Sat
const WEEKDAY_WEIGHT = [0.2, 1, 1.12, 1.08, 1.02, 0.8, 0.28];

function holidays(seed, fromYear, toYear) {
  const spans = [];
  for (let y = fromYear; y <= toYear; y++) {
    spans.push([new Date(y, 11, 21 + Math.floor(hash(seed, y * 13) * 4)), new Date(y + 1, 0, 1 + Math.floor(hash(seed, y * 17) * 3))]);
    const summer = new Date(y, 5, 18 + Math.floor(hash(seed, y * 31) * 58));
    spans.push([summer, d3.timeDay.offset(summer, 7 + Math.floor(hash(seed, y * 37) * 8))]);
    const spring = new Date(y, 2, 8 + Math.floor(hash(seed, y * 41) * 55));
    spans.push([spring, d3.timeDay.offset(spring, 2 + Math.floor(hash(seed, y * 43) * 4))]);
  }
  return spans;
}

// Relative mix of commits / pull requests / reviews / issues drifts over time.
function mix(seed, n) {
  const a = noise(seed + 505, n / 23);
  const b = noise(seed + 606, n / 13);
  return [0.48 + 0.3 * a, 0.08 + 0.1 * b, 0.1 + 0.16 * (1 - a), 0.05 + 0.07 * noise(seed + 707, n / 17)];
}

function split(count, rnd, weights) {
  const out = [0, 0, 0, 0];
  const sum = weights[0] + weights[1] + weights[2] + weights[3];
  for (let k = 0; k < count; k++) {
    let r = rnd() * sum;
    let j = 0;
    while (j < 3 && r >= weights[j]) r -= weights[j++];
    out[j]++;
  }
  return out;
}

export function generateSample({ seed = 7, start = SAMPLE_START, end = d3.timeDay.floor(new Date()) } = {}) {
  const breaks = holidays(seed, start.getFullYear() - 1, end.getFullYear());
  const onBreak = (date) => breaks.some(([a, b]) => date >= a && date <= b);

  return d3.timeDay.range(start, d3.timeDay.offset(end, 1)).map((date) => {
    const n = d3.timeDay.count(EPOCH, date);
    const rnd = rngFor(seed, n);
    const trend = 0.66 + 0.08 * (n / 365.25);
    const focus = 0.16 + 0.84 * (0.62 * noise(seed + 101, n / 31) + 0.38 * noise(seed + 202, n / 7.5));
    let lambda = 15 * trend * focus ** 1.45 * WEEKDAY_WEIGHT[date.getDay()];
    if (onBreak(date)) lambda *= 0.03;

    let count = 0;
    if (rnd() < 1 - Math.exp(-lambda / 2.4)) {
      count = 1 + Math.floor(lambda * 0.85 * (-Math.log(1 - rnd())) ** 1.1);
      if (rnd() < 0.014 * focus) count += 12 + Math.floor(rnd() * 22);
    }
    const [commits, pullRequests, reviews, issues] = split(count, rnd, mix(seed, n));
    return { date: formatKey(date), count, commits, pullRequests, reviews, issues };
  });
}

// ---------------------------------------------------------------------------
// Activity feed for a sample day (repositories and titles are fictional).

const REPOS = [
  { name: 'lin-mei/heatmap-kit', color: '#41b883', base: 40, rate: 0.09, weight: 3 },
  { name: 'aurora-ui/aurora', color: '#3178c6', base: 900, rate: 0.6, weight: 3 },
  { name: 'tidal-labs/tide-api', color: '#00add8', base: 120, rate: 0.2, weight: 2 },
  { name: 'nimbus-charts/nimbus', color: '#f1e05a', base: 300, rate: 0.35, weight: 2 },
  { name: 'openfoundry/handbook', color: '#fcb32c', base: 60, rate: 0.08, weight: 1 },
  { name: 'lin-mei/dotfiles', color: '#89e051', base: 5, rate: 0.02, weight: 1 },
];
const WEIGHTED = REPOS.flatMap((repo) => Array(repo.weight).fill(repo));

const PR_TITLES = [
  'Add keyboard navigation to the calendar grid',
  'Fix tooltip clipping near the viewport edge',
  'Replace moment with d3-time for date math',
  'Animate level changes with d3-transition',
  'Support Monday as the first day of the week',
  'Memoize quantile thresholds per range',
  'Add dark palette tokens',
  'Extract streak calculation into a pure helper',
  'Lazy-load the source viewer',
  'Improve screen-reader labels for day cells',
  'Bump vite to the latest minor',
  'Add CSV import with header detection',
  'Paginate the activity feed',
  'Use ResizeObserver for responsive cell size',
  'Cache GraphQL responses for ten minutes',
  'Retry failed requests with exponential backoff',
  'Document the public component API',
  'Drop legacy browser polyfills',
  'Render month labels from the week start day',
  'Add a Halloween colour scheme',
];
const ISSUE_TITLES = [
  'Calendar shows 54 columns for leap years starting on Saturday',
  'Tooltip flickers when moving quickly between cells',
  'Legend colours do not match cells in dark mode',
  'Support importing GitHub GraphQL exports',
  'Month labels overlap on narrow screens',
  'Streak resets at midnight UTC instead of local time',
  'Option to hide weekday labels',
  'Export the calendar as PNG',
  'Totals are wrong when the data has duplicate dates',
  'Keyboard focus ring is hard to see',
  'Add a compact mode for dashboards',
];
const REVIEW_STATES = ['approved', 'approved', 'approved', 'commented', 'changes'];

export function describeDay(record, seed) {
  if (!record || !record.count) return [];
  const date = parseKey(record.date);
  const n = d3.timeDay.count(EPOCH, date);
  const rnd = rngFor(seed + 999, n);
  const main = WEIGHTED[Math.floor(noise(seed + 303, n / 40) * WEIGHTED.length)];
  const pick = () => (rnd() < 0.6 ? main : WEIGHTED[Math.floor(rnd() * WEIGHTED.length)]);
  const number = (repo) => repo.base + Math.floor(n * repo.rate) + Math.floor(rnd() * 6);
  const title = (list) => list[Math.floor(rnd() * list.length)];
  const items = [];

  const commitsByRepo = new Map();
  for (let left = record.commits || 0; left > 0; ) {
    const k = Math.min(left, 1 + Math.floor(rnd() * left));
    const repo = pick();
    commitsByRepo.set(repo, (commitsByRepo.get(repo) || 0) + k);
    left -= k;
  }
  for (const [repo, count] of commitsByRepo) items.push({ type: 'commit', repo, count });

  for (let i = 0; i < (record.pullRequests || 0); i++) {
    const repo = pick();
    items.push({ type: 'pr', repo, number: number(repo), title: title(PR_TITLES), state: rnd() < 0.7 ? 'merged' : 'open' });
  }
  for (let i = 0; i < (record.reviews || 0); i++) {
    const repo = WEIGHTED[Math.floor(rnd() * WEIGHTED.length)];
    items.push({ type: 'review', repo, number: number(repo), title: title(PR_TITLES), state: REVIEW_STATES[Math.floor(rnd() * REVIEW_STATES.length)] });
  }
  for (let i = 0; i < (record.issues || 0); i++) {
    const repo = pick();
    items.push({ type: 'issue', repo, number: number(repo), title: title(ISSUE_TITLES), state: rnd() < 0.3 ? 'closed' : 'open' });
  }
  return items;
}

import * as d3 from 'd3';
import { formatKey } from './dates.js';

// Accepts the shapes people usually have lying around:
//   [{ date, count }]                  plain arrays (count / contributionCount / value …)
//   { "2025-03-05": 14, … }            date → count maps
//   GitHub GraphQL contributionCalendar responses (found anywhere in the JSON)
//   CSV / TSV with a header row, or headerless "date,count" lines

const DATE_FIELDS = ['date', 'day', 'datetime', 'timestamp', 'time'];
const COUNT_FIELDS = ['count', 'contributioncount', 'contributions', 'value', 'total', 'commits'];
const EXTRA_FIELDS = {
  commits: 'commits',
  pullrequests: 'pullRequests',
  prs: 'pullRequests',
  reviews: 'reviews',
  codereviews: 'reviews',
  issues: 'issues',
};
const EXTRAS = ['commits', 'pullRequests', 'reviews', 'issues'];

const normalize = (name) => String(name).toLowerCase().replace(/[\s_-]/g, '');

function findField(keys, names) {
  const normalized = keys.map(normalize);
  for (const name of names) {
    const i = normalized.indexOf(name);
    if (i >= 0) return keys[i];
  }
  return null;
}

function toKey(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(+value) ? null : formatKey(value);
  if (typeof value === 'number') {
    if (value > 1e11) return formatKey(new Date(value));
    if (value > 1e8) return formatKey(new Date(value * 1000));
    return null;
  }
  const text = String(value).trim();
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (m) {
    const date = new Date(+m[1], +m[2] - 1, +m[3]);
    return date.getMonth() === +m[2] - 1 ? formatKey(date) : null;
  }
  if (/^\d{9,13}$/.test(text)) return toKey(+text);
  const date = new Date(text);
  return Number.isNaN(+date) ? null : formatKey(date);
}

function rowFromObject(obj, dateField, countField) {
  const row = { date: obj[dateField], count: obj[countField] };
  for (const key of Object.keys(obj)) {
    const extra = EXTRA_FIELDS[normalize(key)];
    if (extra && key !== countField) row[extra] = obj[key];
  }
  return row;
}

function collectJSON(node, out, depth = 0) {
  if (node == null || depth > 16) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      if (Array.isArray(item) && item.length >= 2 && toKey(item[0]) && typeof item[1] !== 'object') {
        out.push({ date: item[0], count: item[1] });
      } else {
        collectJSON(item, out, depth + 1);
      }
    }
    return;
  }
  if (typeof node !== 'object') return;
  const keys = Object.keys(node);
  const dateField = findField(keys, DATE_FIELDS);
  const countField = findField(keys, COUNT_FIELDS);
  if (dateField && countField && typeof node[countField] !== 'object') {
    out.push(rowFromObject(node, dateField, countField));
    return;
  }
  const dated = keys.filter((k) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(k) && typeof node[k] !== 'object');
  if (dated.length && dated.length >= keys.length * 0.8) {
    for (const k of dated) out.push({ date: k, count: node[k] });
    return;
  }
  for (const k of keys) collectJSON(node[k], out, depth + 1);
}

function collectDelimited(text, out) {
  const firstLine = text.split('\n', 1)[0];
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows = d3.dsvFormat(delimiter).parseRows(text);
  if (!rows.length) return;
  const header = rows[0].map((h) => h.trim());
  const dateField = findField(header, DATE_FIELDS);
  const countField = findField(header, COUNT_FIELDS);
  if (dateField && countField) {
    const di = header.indexOf(dateField);
    const ci = header.indexOf(countField);
    const extras = header
      .map((h, i) => [EXTRA_FIELDS[normalize(h)], i])
      .filter(([name, i]) => name && i !== ci);
    for (const r of rows.slice(1)) {
      const row = { date: r[di], count: r[ci] };
      for (const [name, i] of extras) row[name] = r[i];
      out.push(row);
    }
  } else {
    for (const r of rows) if (r.length >= 2) out.push({ date: r[0], count: r[1] });
  }
}

/** Parse JSON / CSV / TSV text into sorted daily records: [{ date: 'YYYY-MM-DD', count, …breakdown }]. */
export function parseContributions(text, name = '') {
  const source = String(text).replace(/^\uFEFF/, '').trim();
  if (!source) throw new Error('The file is empty.');

  const raw = [];
  if (/\.json$/i.test(name) || /^[[{]/.test(source)) {
    let json;
    try {
      json = JSON.parse(source);
    } catch {
      throw new Error('That JSON could not be parsed.');
    }
    collectJSON(json, raw);
  } else {
    collectDelimited(source, raw);
  }

  const byDate = new Map();
  let skipped = 0;
  for (const r of raw) {
    const key = toKey(r.date);
    const count = Math.round(Number(r.count));
    if (!key || !Number.isFinite(count) || count < 0) {
      skipped++;
      continue;
    }
    const rec = byDate.get(key) ?? { date: key, count: 0 };
    rec.count += count;
    for (const extra of EXTRAS) {
      const v = Number(r[extra]);
      if (r[extra] != null && r[extra] !== '' && Number.isFinite(v)) rec[extra] = (rec[extra] ?? 0) + v;
    }
    byDate.set(key, rec);
  }
  if (!byDate.size) throw new Error('No rows with both a date and a count were found.');

  const records = [...byDate.values()].sort((a, b) => d3.ascending(a.date, b.date));
  return { records, skipped };
}

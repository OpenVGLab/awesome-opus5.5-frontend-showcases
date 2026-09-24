// Shopping bag state (persisted in localStorage) and installment maths.
import { productById, salePrice } from './data.js';

const KEY = 'pairs.bag.v1';
const FIT_KEY = 'pairs.fit.v1';
const listeners = new Set();

const DEMO = {
  lines: [
    { pid: 'velox-aerolite-3-midnight', size: 'US 9', qty: 1 },
    { pid: 'courtline-rally-forest', size: 'US 8.5', qty: 1 },
    { pid: 'velox-aerolite-3-midnight', size: 'US 10', qty: 1 },
    { pid: 'pebble-bounce-ocean', size: '13C', qty: 1 },
    { pid: 'courtline-rally-forest', size: 'US 9', qty: 2 },
  ],
  merged: [],
  autoMerge: false,
  demo: true,
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); if (s && Array.isArray(s.lines)) return sanitize(s); }
  } catch (_) { /* storage unavailable */ }
  return sanitize(JSON.parse(JSON.stringify(DEMO)));
}
function sanitize(s) {
  s.lines = s.lines.filter((l) => productById[l.pid] && l.qty > 0).map((l, i) => ({ ...l, t: l.t ?? i }));
  s.merged = (s.merged || []).filter((pid) => productById[pid]);
  s.autoMerge = !!s.autoMerge;
  return s;
}

let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
  listeners.forEach((fn) => fn(state));
}

export const bag = {
  get state() { return state; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  count() { return state.lines.reduce((s, l) => s + l.qty, 0); },
  add(pid, size, qty = 1) {
    const hit = state.lines.find((l) => l.pid === pid && l.size === size);
    let combined = false;
    if (hit) { hit.qty = Math.min(10, hit.qty + qty); combined = true; }
    else state.lines.push({ pid, size, qty, t: Date.now() });
    if (state.autoMerge && this.sizesOf(pid).length > 1 && !state.merged.includes(pid)) state.merged.push(pid);
    state.demo = false;
    save();
    return { combined, sameStyleSizes: this.sizesOf(pid).length };
  },
  setQty(pid, size, qty) {
    const l = state.lines.find((x) => x.pid === pid && x.size === size);
    if (!l) return;
    if (qty <= 0) return this.remove(pid, size);
    l.qty = Math.min(10, qty); save();
  },
  remove(pid, size) {
    state.lines = state.lines.filter((l) => !(l.pid === pid && l.size === size));
    if (this.sizesOf(pid).length < 2) state.merged = state.merged.filter((p) => p !== pid);
    save();
  },
  removeStyle(pid) { state.lines = state.lines.filter((l) => l.pid !== pid); state.merged = state.merged.filter((p) => p !== pid); save(); },
  changeSize(pid, from, to) {
    const l = state.lines.find((x) => x.pid === pid && x.size === from);
    if (!l || from === to) return;
    const other = state.lines.find((x) => x.pid === pid && x.size === to);
    if (other) { other.qty = Math.min(10, other.qty + l.qty); state.lines = state.lines.filter((x) => x !== l); }
    else l.size = to;
    if (this.sizesOf(pid).length < 2) state.merged = state.merged.filter((p) => p !== pid);
    save();
  },
  sizesOf(pid) { return state.lines.filter((l) => l.pid === pid); },
  // styles that have ≥2 different sizes in the bag but are shown as separate lines
  mergeCandidates() {
    const seen = [];
    for (const l of state.lines) if (!seen.includes(l.pid) && this.sizesOf(l.pid).length > 1 && !state.merged.includes(l.pid)) seen.push(l.pid);
    return seen;
  },
  isMerged(pid) { return state.merged.includes(pid) && this.sizesOf(pid).length > 1; },
  merge(pid) { if (!state.merged.includes(pid)) state.merged.push(pid); save(); },
  split(pid) { state.merged = state.merged.filter((p) => p !== pid); save(); },
  mergeAll() { for (const pid of this.mergeCandidates()) state.merged.push(pid); save(); },
  splitAll() { state.merged = []; save(); },
  setAutoMerge(on) { state.autoMerge = on; if (on) { for (const pid of this.mergeCandidates()) state.merged.push(pid); } save(); },
  clear() { state.lines = []; state.merged = []; state.demo = false; save(); },
  loadDemo() { state = sanitize(JSON.parse(JSON.stringify(DEMO))); save(); },
  // Display entries: merged styles collapse into one entry, others stay one line per size.
  entries() {
    const out = [], done = new Set();
    for (const l of state.lines) {
      if (this.isMerged(l.pid)) {
        if (done.has(l.pid)) continue;
        done.add(l.pid);
        out.push({ type: 'merged', pid: l.pid, lines: this.sizesOf(l.pid) });
      } else out.push({ type: 'single', pid: l.pid, lines: [l] });
    }
    return out;
  },
  totals() {
    let sub = 0, orig = 0, pairs = 0;
    for (const l of state.lines) { const p = productById[l.pid]; sub += salePrice(p) * l.qty; orig += p.price * l.qty; pairs += l.qty; }
    sub = Math.round(sub * 100) / 100;
    return { sub, orig, savings: Math.round((orig - sub) * 100) / 100, pairs };
  },
};

export const fitPrefs = {
  get() { try { return JSON.parse(localStorage.getItem(FIT_KEY)) || {}; } catch (_) { return {}; } },
  set(v) { try { localStorage.setItem(FIT_KEY, JSON.stringify({ ...this.get(), ...v })); } catch (_) { /* ignore */ } },
};

export function shippingFor(sub, method) {
  if (method === 'express') return 14;
  return sub >= 75 || sub === 0 ? 0 : 6.95;
}
export const TAX_RATE = 0.0725;

// ------------------------------------------------------------------ installments
export const PLANS = [
  { id: 'full', label: 'Pay in full', kind: 'full', n: 1, apr: 0, min: 0, blurb: 'Card, Apple Pay or PayPal' },
  { id: 'pi4', label: 'Pay in 4', kind: 'biweekly', n: 4, apr: 0, min: 35, max: 1500, blurb: 'Every 2 weeks · 0% interest' },
  { id: 'm3', label: '3 months', kind: 'monthly', n: 3, apr: 0, min: 50, blurb: 'Brand Week offer · 0% APR' },
  { id: 'm6', label: '6 months', kind: 'monthly', n: 6, apr: 0, min: 150, blurb: 'Brand Week offer · 0% APR' },
  { id: 'm12', label: '12 months', kind: 'monthly', n: 12, apr: 7.99, min: 100, blurb: '7.99% APR' },
  { id: 'm24', label: '24 months', kind: 'monthly', n: 24, apr: 12.99, min: 300, blurb: '12.99% APR' },
];

const round2 = (x) => Math.round(x * 100) / 100;
export function planQuote(plan, total, start = new Date()) {
  const eligible = total >= plan.min && (!plan.max || total <= plan.max);
  let per, schedule = [];
  if (plan.kind === 'full') per = total;
  else if (plan.apr === 0) per = total / plan.n;
  else { const i = plan.apr / 100 / 12; per = (total * i) / (1 - Math.pow(1 + i, -plan.n)); }
  per = round2(per);
  // build schedule; the first payment absorbs rounding for 0% plans, the last for amortised ones
  let balance = total;
  const i = plan.apr / 100 / 12;
  for (let k = 0; k < plan.n; k++) {
    const due = new Date(start);
    if (plan.kind === 'biweekly') due.setDate(due.getDate() + 14 * k); else due.setMonth(due.getMonth() + k);
    const interest = round2(balance * i);
    let amount = per;
    if (plan.apr === 0 && k === 0) amount = round2(total - per * (plan.n - 1));
    if (plan.apr > 0 && k === plan.n - 1) amount = round2(balance + interest);
    const principal = round2(amount - interest);
    balance = Math.max(0, round2(balance - principal));
    schedule.push({ k: k + 1, due, amount, interest, principal, balance });
  }
  const totalPaid = round2(schedule.reduce((s, x) => s + x.amount, 0));
  return { plan, eligible, per, n: plan.n, schedule, totalPaid, interest: round2(totalPaid - total), first: schedule[0].amount };
}

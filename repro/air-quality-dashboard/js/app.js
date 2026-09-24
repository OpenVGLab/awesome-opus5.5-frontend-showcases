import { CITIES } from './data/geo-data.js';
import { setLang, getLang, t } from './core/i18n.js';
import * as M from './core/model.js';
import { nowParts, fmtHour, pad, firstDayOfYear, yearOf } from './core/time.js';
import { icon, toast } from './ui/dom.js';
import monitor from './pages/monitor.js';
import ranking from './pages/ranking.js';
import compare from './pages/compare.js';
import history from './pages/history.js';

const PAGES = { monitor, ranking, compare, history };
const ICONS = { monitor: 'monitor', ranking: 'ranking', compare: 'compare', history: 'history' };
const mounted = new Set();
// hidden pages are refreshed when next shown (charts cannot lay out inside display:none containers)
const staleLang = new Set(), staleHour = new Set();
let current = null;

function renderNav() {
  document.getElementById('nav').innerHTML = Object.keys(PAGES)
    .map((k) => `<a href="#/${k}" data-page="${k}" class="${k === current ? 'on' : ''}">${icon(ICONS[k])}<span>${t('nav.' + k)}</span></a>`).join('');
}

function applyStatic() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.title = t('appTitle');
  document.querySelectorAll('#langToggle button').forEach((b) => b.classList.toggle('on', b.dataset.lang === getLang()));
  renderNav();
  tick();
}

function route() {
  const m = /^#\/(\w+)/.exec(location.hash);
  const name = m && PAGES[m[1]] ? m[1] : 'monitor';
  if (name === current) return;
  if (current) { PAGES[current].hide && PAGES[current].hide(); document.getElementById('page-' + current).classList.remove('on'); }
  current = name;
  const el = document.getElementById('page-' + name);
  el.classList.add('on');
  if (!mounted.has(name)) { PAGES[name].mount(el); mounted.add(name); }
  PAGES[name].show && PAGES[name].show();
  if (staleLang.has(name)) PAGES[name].relang();
  else if (staleHour.has(name)) PAGES[name].newHour();
  staleLang.delete(name);
  staleHour.delete(name);
  renderNav();
}

function tick() {
  const n = nowParts();
  const d = new Date((n.day * 86400 + n.hour * 3600 + n.minute * 60 + n.second) * 1000);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  document.getElementById('clock').innerHTML = `<span>${date}</span><b>${pad(n.hour)}:${pad(n.minute)}:${pad(n.second)}</b>`;
  const left = 3600 - n.minute * 60 - n.second;
  const cd = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
  const chip = document.getElementById('liveChip');
  chip.title = `${t('dataTime')} ${fmtHour(M.NOW.day, M.NOW.hour)} · ${t('nextUpdate')} ${cd}\n${t('simNote')}`;
  document.getElementById('dataTime').innerHTML = `<span class="lbl-long">${t('dataTime')} </span>${fmtHour(M.NOW.day, M.NOW.hour)} <small>· ${cd}</small>`;
  if (M.setNow(n)) {
    for (const k of mounted) { if (k === current) PAGES[k].newHour(); else staleHour.add(k); }
    toast(t('newHour', { t: fmtHour(M.NOW.day, M.NOW.hour) }));
  }
}

// Warm the daily-record cache for the current year in idle time so cumulative rankings open instantly.
function warmCache() {
  const y = yearOf(M.NOW.day);
  const d0 = firstDayOfYear(y);
  let ci = 0;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 50));
  const step = (dl) => {
    while (ci < CITIES.length && dl.timeRemaining() > 4) { M.cityRecords(ci, d0 - 366, M.NOW.day - 1); ci++; }
    if (ci < CITIES.length) idle(step);
  };
  idle(step);
}

document.getElementById('langToggle').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-lang]');
  if (!b || b.dataset.lang === getLang()) return;
  setLang(b.dataset.lang);
  applyStatic();
  for (const k of mounted) { if (k === current) PAGES[k].relang(); else staleLang.add(k); }
});

setLang(getLang());
applyStatic();
window.addEventListener('hashchange', route);
route();
setInterval(tick, 1000);
setTimeout(warmCache, 1500);

import { initHive } from './hive.js';
import { initAsk } from './ask.js';
import { HexField } from './hexfield.js';
import { initIllos, initIdentity, initWeek, initPricing, initNetwork, initVoices, initApply } from './sections.js';

document.documentElement.classList.add('js');
const $ = (sel) => document.querySelector(sel);

// ---------- nav ----------
const nav = $('#nav');
const links = $('#navLinks');
const menu = $('#navMenu');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 12);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });
menu.addEventListener('click', () => {
  const open = links.classList.toggle('is-open');
  menu.setAttribute('aria-expanded', open);
});
links.addEventListener('click', (e) => {
  if (e.target.closest('a')) { links.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); }
});
const navMap = new Map([...links.querySelectorAll('a')].map((a) => [a.getAttribute('href').slice(1), a]));
const spy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    navMap.forEach((a, id) => a.classList.toggle('is-active', id === e.target.id));
  }
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main > section[id]').forEach((s) => spy.observe(s));

// ---------- live counters ----------
let minds = 2481337;
let cellsLeft = 1204;
function paintCounts() {
  const m = minds.toLocaleString('en-US'), c = cellsLeft.toLocaleString('en-US');
  document.querySelectorAll('[data-minds]').forEach((el) => { el.textContent = m; });
  document.querySelectorAll('[data-cells]').forEach((el) => { el.textContent = c; });
}
setInterval(() => {
  minds += 1 + Math.floor(Math.random() * 3);
  if (Math.random() < 0.3 && cellsLeft > 12) cellsLeft--;
  paintCounts();
}, 2400);

// ---------- reveal on scroll ----------
const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('in');
    revealIO.unobserve(e.target);
  }
}, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
const groups = new Map();
document.querySelectorAll('.reveal').forEach((el) => {
  const n = groups.get(el.parentNode) || 0;
  groups.set(el.parentNode, n + 1);
  el.style.setProperty('--rd', `${Math.min(n, 5) * 90}ms`);
  revealIO.observe(el);
});

// ---------- sections ----------
initIllos();
initIdentity($('#identity'));
initWeek($('#week'));
initPricing($('#pricing'));
initNetwork($('#network'));
initVoices();

const askField = new HexField($('#ask .hexfield'), { size: 34 });
const applyField = new HexField($('#apply .hexfield'), { size: 30 });

initAsk({
  section: $('#ask'),
  form: $('#askForm'),
  input: $('#askInput'),
  chipsBox: $('#askChips'),
  results: $('#askResults'),
  field: askField,
});

const hive = initHive({
  root: $('#hive'),
  svg: $('#hiveSvg'),
  card: $('#hiveCard'),
  tag: $('#youTag'),
  toasts: $('#toasts'),
  lookTarget: $('#heroTitle'),
  onOpenCell: () => $('#apply').scrollIntoView({ behavior: 'smooth' }),
});

initApply({
  root: $('#apply'),
  field: applyField,
  getMinds: () => minds,
  onJoin(name) {
    hive.setYou(name);
    minds += 1;
    cellsLeft = Math.max(1, cellsLeft - 1);
    paintCounts();
  },
});

// ---------- eyes outside the hero follow the pointer too ----------
const eyeHosts = new Set();
const hostIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) eyeHosts.add(e.target); else eyeHosts.delete(e.target);
  }
});
document.querySelectorAll('[data-illo], .identity__visual, .cellwait').forEach((el) => hostIO.observe(el));
let ptr = null, eyeRaf = 0;
function trackEyes() {
  eyeRaf = 0;
  if (!ptr) return;
  for (const host of eyeHosts) {
    for (const pp of host.querySelectorAll('.pp')) {
      const r = pp.parentNode.getBoundingClientRect();
      const dx = ptr.x - (r.left + r.width / 2), dy = ptr.y - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const m = parseFloat(pp.dataset.m) * Math.min(1, d / 120);
      pp.setAttribute('transform', `translate(${((dx / d) * m).toFixed(2)} ${((dy / d) * m).toFixed(2)})`);
    }
  }
}
const queueEyes = () => { if (!eyeRaf) eyeRaf = requestAnimationFrame(trackEyes); };
window.addEventListener('pointermove', (e) => { ptr = { x: e.clientX, y: e.clientY }; queueEyes(); }, { passive: true });
window.addEventListener('scroll', queueEyes, { passive: true });

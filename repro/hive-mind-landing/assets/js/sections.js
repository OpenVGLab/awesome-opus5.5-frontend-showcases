import { traits, youTraits, faceMarkup, hexPath, hashString, avatarSVG, YOU_FILL, SQ3 } from './faces.js';
import { DAYS, OBJECTIVES, TILES, FIELDS, OPPORTUNITIES } from './data.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let uidCount = 0;
const uid = (p) => `${p}${++uidCount}`;

function cell(x, y, S, t, clipId) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="${hexPath(S * 0.935, 0.2)}" fill="${t.fill}"/>${faceMarkup(t, S, clipId)}</g>`;
}
const clipDef = (id, S) => `<clipPath id="${id}"><path d="${hexPath(S * 0.935, 0.2)}"/></clipPath>`;

export function onVisible(el, fn, threshold = 0.25) {
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { io.disconnect(); fn(); }
  }, { threshold });
  io.observe(el);
}

function countUp(el, to, fmt, dur = 1300) {
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- how it works ----------
export function initIllos() {
  document.querySelectorAll('[data-illo]').forEach((el) => {
    const kind = el.dataset.illo;
    el.innerHTML = kind === 'sync' ? illoSync() : kind === 'wonder' ? illoWonder() : illoDay();
  });
}

function illoSync() {
  const S = 27, D = SQ3 * S * 1.06, id = uid('is');
  const names = ['Ines Duarte', 'Kofi Mensah', 'Mei Chen', 'Theo Marchetti', 'Hanna Virtanen', 'Adaeze Nwosu'];
  let ring = '';
  names.forEach((n, i) => {
    const a = (Math.PI / 3) * i;
    ring += cell(D * Math.cos(a), D * Math.sin(a), S, traits(hashString(n)), id);
  });
  return `<svg viewBox="-150 -100 300 200" aria-hidden="true"><defs>${clipDef(id, S)}</defs>${ring}<path class="illo-slot" d="${hexPath(S * 0.9, 0.2)}"/><g class="illo-dock">${cell(0, 0, S, youTraits(null), id)}</g></svg>`;
}

function illoWonder() {
  const S = 34, s2 = 19, idA = uid('iw'), idB = uid('iw');
  const names = ['Rachel Stein', 'Jonas Berg', 'Aiko Nishimura', 'Priya Raman', 'Mateo Silva', 'Marisol Reyes'];
  let lines = '', faces = '', dots = '';
  names.forEach((n, i) => {
    const a = (Math.PI / 3) * i;
    const x = 112 * Math.cos(a), y = 66 * Math.sin(a);
    const begin = (i * 0.45).toFixed(2);
    lines += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}L0 0" fill="none" stroke="#C98A12" stroke-opacity=".38" stroke-width="1.5" stroke-dasharray="2 5" stroke-linecap="round"/>`;
    faces += cell(x, y, s2, traits(hashString(n)), idB);
    dots += `<circle r="4.2" fill="#FFF8E6" stroke="#1B150D" stroke-width="1.6" opacity="0"><animateMotion dur="2.7s" begin="${begin}s" repeatCount="indefinite" path="M${x.toFixed(1)} ${y.toFixed(1)}L0 0" calcMode="spline" keyTimes="0;1" keySplines=".45 0 .55 1"/><animate attributeName="opacity" dur="2.7s" begin="${begin}s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;.12;.8;1"/></circle>`;
  });
  return `<svg viewBox="-150 -100 300 200" aria-hidden="true"><defs>${clipDef(idA, S)}${clipDef(idB, s2)}</defs>${lines}${faces}${dots}<path class="you-halo" d="${hexPath(S * 0.935, 0.2)}"/>${cell(0, 0, S, youTraits(null), idA)}</svg>`;
}

function illoDay() {
  const id = uid('id');
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  let cols = '';
  letters.forEach((l, i) => {
    const x = -108 + i * 36;
    const hive = i === 3, weekend = i > 4;
    cols += `<text x="${x}" y="-62" text-anchor="middle" class="illo-day-l${hive ? ' is-hive' : ''}">${l}</text>`;
    const fill = hive ? '#F4AF2D' : weekend ? '#FFFDF7' : '#DDE3FF';
    cols += `<rect x="${x - 14}" y="-50" width="28" height="104" rx="9" fill="${fill}"${weekend ? ' stroke="rgba(27,21,13,.2)" stroke-dasharray="3 4"' : ''}/>`;
    if (!hive && !weekend) cols += `<rect x="${x - 9}" y="-22" width="18" height="46" rx="5" fill="#2F4BE8" opacity=".18"/>`;
  });
  const hx = -108 + 3 * 36;
  cols += cell(hx, -24, 13, traits(hashString('Ravi Menon')), id);
  cols += `<text x="${hx}" y="14" text-anchor="middle" class="illo-day-t">9</text><text x="${hx}" y="27" text-anchor="middle" class="illo-day-t">–</text><text x="${hx}" y="40" text-anchor="middle" class="illo-day-t">5</text>`;
  cols += '<text x="0" y="80" text-anchor="middle" class="illo-cap">1 day for the hive · 6 for you</text>';
  return `<svg viewBox="-150 -100 300 200" aria-hidden="true"><defs>${clipDef(id, 13)}</defs>${cols}</svg>`;
}

// ---------- identity ----------
export function initIdentity(root) {
  const svg = root.querySelector('#idSvg');
  const inputs = [...root.querySelectorAll('.facet input')];
  const shareOut = root.querySelector('#shareOut');
  const shareBar = root.querySelector('#shareBar');
  const note = root.querySelector('#integrityNote');
  const noteText = note.textContent;
  const S = 60, D = SQ3 * S * 1.07, clip = 'idClip';
  const FACETS = [['Skills', 'i-case'], ['Languages', 'i-chat'], ['How-tos', 'i-wrench'], ['Hot takes', 'i-flame'], ['Memories', 'i-photo'], ['Monologue', 'i-cloud']];
  const pos = [300, 0, 60, 120, 180, 240].map((a) => [D * Math.cos((a * Math.PI) / 180), D * Math.sin((a * Math.PI) / 180)]);
  const hexD = hexPath(S * 0.935, 0.2);

  const outer = [];
  for (let i = 0; i < 6; i++) {
    const [x1, y1] = pos[i], [x2, y2] = pos[(i + 1) % 6];
    outer.push({ x: 2 * x1, y: 2 * y1, links: [i] });
    outer.push({ x: x1 + x2, y: y1 + y2, links: [i, (i + 1) % 6] });
  }
  let outerM = '', bridges = '', slots = '';
  const names = ['Ana Costa', 'Kenji Sato', 'Nia Mwangi', 'Hugo Girard', 'Zara Khan', 'Emeka Eze', 'Leilani Kahale', 'Tariq Aziz', 'Sofia Rossi', 'Bao Nguyen', 'Freya Larsen', 'Omar Farouk'];
  outer.forEach((o, j) => {
    const t = traits(hashString(names[j]));
    outerM += `<g class="outer" data-links="${o.links.join(',')}" transform="translate(${o.x.toFixed(1)} ${o.y.toFixed(1)})"><g class="hx" style="opacity:.3"><path d="${hexD}" fill="${t.fill}"/>${faceMarkup(t, S, clip)}</g></g>`;
    for (const l of o.links) {
      const [sx, sy] = pos[l];
      const ax = sx + (o.x - sx) * 0.34, ay = sy + (o.y - sy) * 0.34;
      const bx = sx + (o.x - sx) * 0.68, by = sy + (o.y - sy) * 0.68;
      bridges += `<path class="bridge" data-slot="${l}" d="M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}"/>`;
    }
  });
  FACETS.forEach(([label, icon], i) => {
    const [x, y] = pos[i];
    const locked = i === 5;
    slots += `<g class="slot${locked ? ' slot--locked' : ''}" data-slot="${i}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="ci"><path class="slot__hx" d="${hexD}"/><use class="slot__icon" href="#${icon}" x="-13" y="-33" width="26" height="26"/><text class="slot__label" y="11">${label}</text><text class="slot__state" y="26">${locked ? 'locked' : 'private'}</text></g><g class="slot__lock" transform="translate(${(S * 0.5).toFixed(1)} ${(-S * 0.52).toFixed(1)})"><circle r="12"/><use href="#i-lock" x="-7.5" y="-8.5" width="15" height="15"/></g></g>`;
  });
  const core = `<g class="core"><path class="you-halo" d="${hexD}"/><g class="ci"><path d="${hexD}" fill="${YOU_FILL}"/>${faceMarkup(youTraits(null), S, clip)}</g></g>`;
  svg.innerHTML = `<defs><clipPath id="${clip}"><path d="${hexD}"/></clipPath></defs>${outerM}${slots}${core}${bridges}`;

  let noteTimer = 0;
  function wink(text) {
    note.textContent = text;
    note.classList.add('is-wink');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note.textContent = noteText; note.classList.remove('is-wink'); }, 1800);
  }

  function update() {
    const states = inputs.map((inp) => inp.checked);
    let on = 0;
    states.forEach((v, i) => {
      if (v) on++;
      const g = svg.querySelector(`.slot[data-slot="${i}"]`);
      g.classList.toggle('is-on', v);
      g.querySelector('.slot__state').textContent = v ? 'shared' : 'private';
    });
    svg.querySelectorAll('.bridge').forEach((b) => b.classList.toggle('is-on', !!states[+b.dataset.slot]));
    svg.querySelectorAll('.outer').forEach((o) => {
      const lit = o.dataset.links.split(',').some((l) => states[+l]);
      o.querySelector('.hx').style.opacity = lit ? '1' : '.3';
    });
    shareOut.textContent = `${on} of 6 facets`;
    shareBar.style.setProperty('--p', `${((on / 6) * 100).toFixed(1)}%`);
  }

  inputs.forEach((inp) => inp.addEventListener('change', () => {
    update();
    wink(inp.checked ? 'Still 100%. Sharing doesn’t make you less you.' : 'Still 100%. Keeping things private doesn’t either.');
  }));
  svg.addEventListener('click', (e) => {
    const g = e.target.closest('.slot');
    if (!g) return;
    const i = +g.dataset.slot;
    if (i === 5) {
      const row = root.querySelector('.facet--locked');
      row.classList.add('is-flash');
      setTimeout(() => row.classList.remove('is-flash'), 900);
      wink('Nice try. Your inner monologue stays yours.');
      return;
    }
    inputs[i].click();
  });
  svg.querySelectorAll('.slot').forEach((g) => { g.style.cursor = 'pointer'; });
  update();
}

// ---------- your week ----------
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PERSONAL = [
  [[18.5, 20, 'Climbing']],
  [[7, 8, 'Swim'], [19, 20.5, 'Pottery (mediocre)']],
  [[19, 21, 'Band practice']],
  [[19, 22, 'Dinner with Sam']],
  [[19.5, 22.5, 'Karaoke']],
  [[10, 13, 'Farmers’ market'], [15, 17, 'Nap (ambitious)']],
  [[9, 22, 'Absolutely nothing', true]],
];
const H0 = 7;
const hm = (h) => `${Math.floor(h)}:${h % 1 ? '30' : '00'}`;

export function nextHiveDay(dayIdx, now = new Date()) {
  const jsDay = (dayIdx + 1) % 7;
  let add = (jsDay - now.getDay() + 7) % 7;
  if (add === 0 && now.getHours() >= 17) add = 7;
  const d = new Date(now);
  d.setDate(now.getDate() + add);
  return { date: d, today: add === 0, label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) };
}

export function initWeek(root) {
  const pick = root.querySelector('#daypick');
  const cal = root.querySelector('#cal');
  const next = root.querySelector('#weekNext');
  const list = root.querySelector('#objectives');
  let hive = 3;

  list.innerHTML = OBJECTIVES.map((o) => `<li><div class="obj__top"><b>${o.t}</b><span>${o.p}%</span></div><div class="bar"><i style="--p:${o.p}%"></i></div><small>${o.meta}</small></li>`).join('');
  pick.innerHTML = `<span class="daypick__label">Your Hive Day</span>${SHORT.map((d, i) => `<button type="button" role="radio" data-d="${i}" aria-checked="${i === hive}" tabindex="${i === hive ? 0 : -1}">${d}</button>`).join('')}`;

  const now = new Date();

  function events(d) {
    const out = [];
    if (d < 5 && d !== hive) out.push({ s: 9, e: d === 4 ? 15.5 : 17, t: 'Your own work', cls: 'job', sub: d === 4 ? 'short Friday' : '' });
    for (const [s, e, t, lazy] of PERSONAL[d]) {
      let S = s;
      if (d === hive && s < 17 && e > 9) {
        if (e > 18) S = 17.5; else continue;
      }
      out.push({ s: S, e, t, cls: lazy ? 'me ev--lazy' : 'me' });
    }
    if (d === hive) out.push({ s: 9, e: 17, cls: 'hive' });
    return out;
  }

  function render() {
    const n = nextHiveDay(hive, now);
    const monday = new Date(n.date);
    monday.setDate(n.date.getDate() - ((n.date.getDay() + 6) % 7));
    const head = SHORT.map((d, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return `<span class="${i === hive ? 'is-hive' : ''}">${d}<small>${i === hive ? 'HIVE DAY' : date.getDate()}</small></span>`;
    }).join('');
    const times = [8, 10, 12, 14, 16, 18, 20, 22].map((h) => `<span style="top:calc(var(--row) * ${h - H0})">${h}:00</span>`).join('');
    const days = SHORT.map((_, d) => {
      const evs = events(d).map((ev) => {
        const style = `top:calc(var(--row) * ${ev.s - H0} + 1px);height:calc(var(--row) * ${ev.e - ev.s} - 3px)`;
        if (ev.cls === 'hive') {
          return `<div class="ev ev--hive" style="${style}"><b>Hive Day</b><small>9:00–17:00</small><small>objectives</small><span class="ev--lunch" style="top:calc(var(--row) * 3.5);height:var(--row)">lunch, on us</span></div>`;
        }
        const time = ev.e - ev.s >= 1.5 ? `<small>${ev.sub || `${hm(ev.s)}–${hm(ev.e)}`}</small>` : '';
        return `<div class="ev ev--${ev.cls}" style="${style}">${ev.t}${time}</div>`;
      }).join('');
      return `<div class="cal__day${d === hive ? ' is-hive' : ''}">${evs}</div>`;
    }).join('');
    cal.innerHTML = `<div class="cal__head"><span></span>${head}</div><div class="cal__body"><div class="cal__times">${times}</div>${days}</div>`;

    if (n.today) next.textContent = now.getHours() >= 9 ? 'It’s Hive Day right now · you’re free at 17:00' : 'Your next Hive Day: today · 9:00–17:00';
    else next.textContent = `Your next Hive Day: ${n.label} · 9:00–17:00`;
    pick.querySelectorAll('button').forEach((b) => {
      const on = +b.dataset.d === hive;
      b.setAttribute('aria-checked', on);
      b.tabIndex = on ? 0 : -1;
    });
  }

  pick.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    hive = +b.dataset.d;
    render();
  });
  pick.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    hive = (hive + dir + 7) % 7;
    render();
    pick.querySelector(`button[data-d="${hive}"]`).focus();
  });
  render();
}

// ---------- the 5% ----------
export function initPricing(root) {
  const range = root.querySelector('#income');
  const out = root.querySelector('#incomeOut');
  const perYear = root.querySelector('#perYear');
  const perMonth = root.querySelector('#perMonth');
  const perWeek = root.querySelector('#perWeek');
  const keep = root.querySelector('#keepOut');
  const verdict = root.querySelector('#verdict');
  const presets = root.querySelector('#presets');
  const f0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const f2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const OLD = 7390;

  function update() {
    const v = +range.value;
    const c = v * 0.05;
    range.style.setProperty('--p', `${(v / +range.max) * 100}%`);
    out.textContent = f0.format(v);
    perYear.textContent = f0.format(c);
    perMonth.textContent = f2.format(c / 12);
    perWeek.textContent = f2.format(c / 52);
    keep.textContent = `${f0.format(v - c)} stays yours`;
    if (v === 0) verdict.innerHTML = '5% of nothing is nothing. <b>You still get everyone.</b> Nobody is ever priced out of knowing things.';
    else if (c < OLD) verdict.innerHTML = `Quorum costs you <b>${f0.format(OLD - c)} less</b> than knowing things the old way — and saves three friendships.`;
    else verdict.innerHTML = `At this income you pay <b>${f0.format(c - OLD)} more</b> than the old way — and fund a great many Hive Days for everyone else. The hive thanks you, warmly, from inside your head.`;
    presets.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', +b.dataset.v === v));
  }
  range.addEventListener('input', update);
  presets.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const from = +range.value, to = +b.dataset.v, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 500);
      const e2 = 1 - Math.pow(1 - p, 3);
      range.value = Math.round((from + (to - from) * e2) / 1000) * 1000;
      update();
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  update();
}

// ---------- network ----------
export function initNetwork(root) {
  const chips = root.querySelector('#netChips');
  const tiles = root.querySelector('#tiles');
  const feed = root.querySelector('#feed');
  const max = Math.log10(250000);

  chips.innerHTML = FIELDS.map(([k, l], i) => `<button type="button" class="chip${i ? '' : ' is-on'}" data-f="${k}" aria-pressed="${i === 0}">${l}</button>`).join('');
  tiles.innerHTML = TILES.map(([name, n, f, note]) => `<div class="tile" data-f="${f}"><b data-n="${n}">${n.toLocaleString('en-US')}</b><span>${name}</span>${note ? `<em>${note}</em>` : ''}<div class="bar"><i style="--p:${Math.max(3, (Math.log10(n + 1) / max) * 100).toFixed(1)}%"></i></div></div>`).join('');

  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const f = b.dataset.f;
    chips.querySelectorAll('.chip').forEach((c) => {
      const on = c === b;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', on);
    });
    tiles.querySelectorAll('.tile').forEach((t) => t.classList.toggle('is-dim', f !== 'all' && t.dataset.f !== f));
  });

  const items = OPPORTUNITIES.map((o) => `<li class="opp">${avatarSVG(o.by)}<div><b>${o.t}</b><span>${o.where} · ${o.n} minds matched · via ${o.by.split(' ')[0]}</span>${o.you ? '<i>Matched you</i>' : ''}</div></li>`).join('');
  feed.innerHTML = items + items.replace(/<li class="opp">/g, '<li class="opp" aria-hidden="true">');

  const stats = root.querySelector('.netstats');
  onVisible(stats, () => {
    stats.querySelectorAll('b[data-count]').forEach((b) => {
      const to = +b.dataset.count, kind = b.dataset.format, suffix = b.dataset.suffix || '';
      countUp(b, to, (v) => {
        if (kind === 'short') return `${(v / 1e6).toFixed(1)}M`;
        if (kind === 'k') return `${Math.round(v / 1000)}k`;
        return `${Math.round(v)}${suffix}`;
      });
    });
  });
  onVisible(tiles, () => {
    tiles.querySelectorAll('b[data-n]').forEach((b) => countUp(b, +b.dataset.n, (v) => Math.round(v).toLocaleString('en-US'), 1500));
  }, 0.2);
}

// ---------- testimonials ----------
export function initVoices() {
  document.querySelectorAll('[data-avatar]').forEach((el) => { el.innerHTML = avatarSVG(el.dataset.avatar); });
  document.querySelectorAll('[data-avs]').forEach((el) => { el.innerHTML = el.dataset.avs.split('|').map((n) => avatarSVG(n)).join(''); });
}

// ---------- apply ----------
export function initApply({ root, field, getMinds, onJoin }) {
  const form = root.querySelector('#applyForm');
  const sync = root.querySelector('#sync');
  const steps = root.querySelector('#syncSteps');
  const welcome = root.querySelector('#welcome');
  const title = root.querySelector('#welcomeTitle');
  const text = root.querySelector('#welcomeText');
  const again = root.querySelector('#applyAgain');
  const cellSvg = root.querySelector('#cellSvg');
  const label = root.querySelector('#cellLabel');

  function drawEmpty() {
    cellSvg.innerHTML = `<path class="cw-empty" d="${hexPath(118, 0.18)}"/><path class="cw-plus" d="M-18 0H18M0 -18V18"/>`;
    label.textContent = 'Sized for exactly one individual.';
  }
  function drawYou(name) {
    const S = 110 / 0.935, t = youTraits(hashString(name));
    cellSvg.innerHTML = `<defs><clipPath id="cwClip"><path d="${hexPath(110, 0.2)}"/></clipPath></defs><path class="cw-empty" d="${hexPath(124, 0.18)}"/><g class="cw-face"><path d="${hexPath(110, 0.2)}" fill="${YOU_FILL}"/>${faceMarkup(t, S, 'cwClip')}</g>`;
    label.textContent = `This is your cell, ${name.split(/\s+/)[0]}. Nobody else fits.`;
  }
  drawEmpty();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim().replace(/\s+/g, ' ');
    const first = name.split(' ')[0];
    const day = +data.get('day');
    const teach = String(data.get('teach') || '').trim();
    const list = [
      'Checking you’re you…',
      `Reserving ${DAYS[day]}s, 9:00–17:00…`,
      'Setting your contribution to 5%…',
      `Introducing you to ${(getMinds() + 1).toLocaleString('en-US')} minds…`,
    ];
    steps.innerHTML = list.map((t) => `<li>${esc(t)}</li>`).join('');
    form.hidden = true;
    sync.hidden = false;
    const lis = [...steps.children];
    lis.forEach((li, i) => {
      setTimeout(() => li.classList.add('is-active'), i * 720);
      setTimeout(() => { li.classList.remove('is-active'); li.classList.add('is-done'); }, i * 720 + 640);
    });
    setTimeout(() => {
      sync.hidden = true;
      welcome.hidden = false;
      const n = nextHiveDay(day);
      title.textContent = `Welcome to Quorum, ${first}.`;
      text.innerHTML = `Your sync can be at any Quorum node within 30 days. Your first Hive Day: <b>${n.today ? 'today' : esc(n.label)}, 9:00</b>.${teach ? ` The hive can’t wait to learn “${esc(teach)}” from you.` : ''}`;
      drawYou(name);
      if (field) {
        const sr = root.getBoundingClientRect(), cr = cellSvg.getBoundingClientRect();
        field.ripple(cr.left + cr.width / 2 - sr.left, cr.top + cr.height / 2 - sr.top);
      }
      onJoin && onJoin(name, day);
    }, lis.length * 720 + 300);
  });

  again.addEventListener('click', () => {
    form.reset();
    welcome.hidden = true;
    form.hidden = false;
    drawEmpty();
    form.querySelector('input[name="name"]').focus();
  });
}

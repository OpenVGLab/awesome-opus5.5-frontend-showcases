// DOM side of the atlas: dock cards, floating labels, the planet dossier, markers and small overlays.

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function setAccent(hex) {
  document.documentElement.style.setProperty('--accent', hex);
}

export function loader(text, frac) {
  $('#loaderText').textContent = text;
  $('#loaderFill').style.width = `${Math.round(frac * 100)}%`;
}
export function hideLoader() { $('#loader').classList.add('done'); }

let toastTimer = 0;
export function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small accent';
    b.textContent = action.label;
    b.addEventListener('click', () => { t.classList.remove('show'); action.run(); });
    t.appendChild(b);
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 6500 : 3200);
}

// ------------------------------------------------------------------ dock

export function renderDock(list, h) {
  const box = $('#dockCards');
  box.innerHTML = '';
  list.forEach((p, i) => {
    const d = p.def;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    b.style.setProperty('--c', d.accent);
    b.innerHTML = `<span class="thumb empty"></span><span class="i">${d.custom ? '✦ Yours' : String(i + 1).padStart(2, '0')}</span><span class="n">${esc(d.name)}</span><span class="s">${esc(d.cls)}</span>`;
    b.setAttribute('aria-label', `${d.name}, ${d.cls}`);
    b.addEventListener('mouseenter', () => h.enter(p));
    b.addEventListener('mouseleave', () => h.leave(p));
    b.addEventListener('focus', () => h.enter(p));
    b.addEventListener('blur', () => h.leave(p));
    b.addEventListener('click', () => h.click(p));
    p.cardEl = b;
    if (p.thumb) setThumb(p, p.thumb);
    box.appendChild(b);
  });
}

export function setThumb(p, url) {
  p.thumb = url;
  const t = p.cardEl && p.cardEl.querySelector('.thumb');
  if (!t) return;
  t.classList.remove('empty');
  t.style.background = `center / contain no-repeat url(${url})`;
}

// ------------------------------------------------------------------ labels

export function renderLabels(list, h) {
  const box = $('#labels');
  box.innerHTML = '';
  list.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'plabel' + (p.def.reference ? ' ref' : '');
    el.style.setProperty('--c', p.def.accent);
    el.innerHTML = `<span class="n">${esc(p.def.name)}</span><span class="s">${esc(p.def.custom ? '✦ your world' : p.def.cls)}</span>`;
    el.addEventListener('mouseenter', () => h.enter(p));
    el.addEventListener('mouseleave', () => h.leave(p));
    el.addEventListener('click', () => h.click(p));
    p.labelEl = el;
    p.labelSub = el.querySelector('.s');
    box.appendChild(el);
  });
}

// ------------------------------------------------------------------ planet dossier

const COMP_COLORS = ['var(--accent)', '#7ea6ff', '#c79bf2', '#6f7686'];

function statBar(frac) {
  return `<div class="bar"><i style="width:${(clamp01(frac) * 100).toFixed(1)}%"></i></div>`;
}

function pips(n) {
  let s = '';
  for (let i = 0; i < 5; i++) s += `<i class="${i < n ? 'on' : ''}"></i>`;
  return `<div class="pips">${s}</div>`;
}

export function renderPanel(p, ctx, h) {
  const d = p.def, s = d.stats;
  const panel = $('#panel');
  const logBar = (v, lo, hi) => (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  const stats = [
    ['Radius', `${s.radius.toFixed(2)} × Earth`, logBar(s.radius, 0.3, 12)],
    ['Gravity', s.gravityText || `${s.gravity.toFixed(2)} g`, s.gravity / 2.6],
    ['Day', s.day, logBar(Math.max(s.dayHours, 1), 2, 600)],
    ['Year', s.year, logBar(Math.max(s.yearDays, 1), 10, 15000)],
    ['Temperature', s.temp, (s.tempC + 220) / 900],
    ['Pressure', s.pressure || '—', null],
    ['Moons', String(s.moons ?? 0), null],
    ['From Vesper', s.distance, logBar(s.distanceAU, 0.15, 30)],
  ];
  const comp = d.atmoComp || [];
  const compTotal = comp.reduce((a, c) => a + c[1], 0) || 1;
  const pois = d.pois || [];
  const idxLabel = d.custom ? '✦ Your world' : `${String(ctx.index + 1).padStart(2, '0')} / ${String(ctx.total).padStart(2, '0')}`;
  const gRange = s.gravityRange;
  panel.innerHTML = `
    <div class="pp-head">
      <div class="pp-index"><span>${idxLabel}</span><span>${esc(d.cls)}</span></div>
      <h1 class="pp-name">${esc(d.name)}</h1>
      <div class="pp-epithet">${esc(d.epithet)}</div>
    </div>
    <p class="pp-tagline">${esc(d.tagline)}</p>
    <p class="pp-lore">${esc(d.lore)}</p>
    <div class="pp-actions">
      <button type="button" class="btn small" data-act="listen" aria-pressed="${ctx.listening ? 'true' : 'false'}">${ctx.listening ? '❚❚ Listening' : '▶ Listen to ' + esc(d.name)}</button>
      <button type="button" class="btn small" data-act="reset">Reset view</button>
    </div>
    ${d.custom ? `<div class="pp-custom"><button type="button" class="btn small" data-act="edit">Edit in the forge</button><button type="button" class="btn small" data-act="remove">Remove from atlas</button></div>` : ''}
    <div class="stats">${stats.map(([k, v, f]) => `<div class="stat"><div class="k">${k}</div><div class="v">${esc(v)}</div>${f == null ? '' : statBar(f)}</div>`).join('')}</div>
    ${comp.length ? `<section class="pp-sec"><h3>Atmosphere</h3>
      <div class="comp-bar">${comp.map((c, i) => `<i style="flex:${Math.max(c[1], 1.2)};background:${COMP_COLORS[i % 4]}"></i>`).join('')}</div>
      <div class="comp-legend">${comp.map((c, i) => `<span><i class="dot" style="background:${COMP_COLORS[i % 4]}"></i>${esc(c[0])}<b>${+(c[1] / compTotal * 100).toFixed(c[1] < 1 ? 1 : 0)}%</b></span>`).join('')}</div>
    </section>` : ''}
    ${pois.length ? `<section class="pp-sec"><h3>Points of interest</h3><ol class="pois">
      ${pois.map((q, i) => `<li><button type="button" data-poi="${i}"><span class="num">${i + 1}</span><span><b>${esc(q.name)}</b><span class="t">${esc(q.text)}</span></span></button></li>`).join('')}
    </ol></section>` : ''}
    <section class="pp-sec"><h3>Traveller’s calculator</h3>
      <div class="calc">
        <label>If you weigh <input type="number" min="1" max="500" value="${ctx.weight}" data-calc="weight" aria-label="Your weight in kilograms"> kg on Earth, you’d feel like <output data-out="weight"></output> here.</label>
        <label>At <input type="number" min="0" max="150" value="${ctx.age}" data-calc="age" aria-label="Your age in Earth years"> Earth years old, you’d be <output data-out="age"></output> in ${esc(d.name)} years.</label>
      </div>
    </section>
    ${d.note ? `<blockquote class="note">${esc(d.note.text)}</blockquote><div class="note-by">— ${esc(d.note.by)}</div>` : ''}
    ${d.ratings ? `<section class="pp-sec"><h3>Traveller ratings</h3><div class="ratings">
      ${[['Wonder', d.ratings.wonder], ['Comfort', d.ratings.comfort], ['Danger', d.ratings.danger]].map(([k, v]) => `<div class="rating"><div class="k">${k}</div>${pips(v)}</div>`).join('')}
    </div></section>` : ''}
    <nav class="pp-nav" aria-label="Other worlds">
      <button type="button" data-act="prev"><small>← Previous</small><span>${esc(ctx.prevName)}</span></button>
      <button type="button" data-act="next"><small>Next →</small><span>${esc(ctx.nextName)}</span></button>
    </nav>`;

  const upd = () => {
    const w = parseFloat(panel.querySelector('[data-calc="weight"]').value) || 0;
    const a = parseFloat(panel.querySelector('[data-calc="age"]').value) || 0;
    const wOut = gRange ? `${Math.round(w * gRange[0])}–${Math.round(w * gRange[1])} kg` : `${(w * s.gravity).toFixed(1)} kg`;
    panel.querySelector('[data-out="weight"]').textContent = wOut;
    const yrs = (a * 365.25) / s.yearDays;
    panel.querySelector('[data-out="age"]').textContent = `${yrs >= 100 ? Math.round(yrs).toLocaleString('en-US') : yrs.toFixed(yrs < 10 ? 2 : 1)} years old`;
    h.calc(w, a);
  };
  panel.querySelectorAll('[data-calc]').forEach((i) => i.addEventListener('input', upd));
  upd();
  panel.querySelectorAll('[data-poi]').forEach((b) => b.addEventListener('click', () => h.poi(+b.dataset.poi)));
  panel.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => h[b.dataset.act] && h[b.dataset.act](b)));

  panel.classList.remove('swap');
  void panel.offsetWidth;
  panel.classList.add('swap');
  panel.scrollTop = 0;
}

export function setListenButton(on, name) {
  const b = $('#panel [data-act="listen"]');
  if (!b) return;
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.textContent = on ? '❚❚ Listening' : `▶ Listen to ${name}`;
}

export function setPoiActive(i) {
  document.querySelectorAll('#panel [data-poi]').forEach((b) => b.classList.toggle('on', +b.dataset.poi === i));
  document.querySelectorAll('#markers .marker').forEach((m, k) => m.classList.toggle('on', k === i));
}

// ------------------------------------------------------------------ markers & poi card

export function renderMarkers(p, h) {
  const box = $('#markers');
  box.innerHTML = '';
  p.markerEls = (p.def.pois || []).map((poi, i) => {
    const m = document.createElement('button');
    m.type = 'button';
    m.className = 'marker hidden';
    m.textContent = String(i + 1);
    m.title = poi.name;
    m.setAttribute('aria-label', poi.name);
    m.addEventListener('click', (e) => { e.stopPropagation(); h.poi(i); });
    box.appendChild(m);
    return m;
  });
}

export function showPoi(poi, i, h) {
  const c = $('#poiCard');
  c.innerHTML = `<button type="button" class="x" aria-label="Close">×</button><div class="k">Point of interest · ${i + 1}</div><h4>${esc(poi.name)}</h4><p>${esc(poi.text)}</p>`;
  c.querySelector('.x').addEventListener('click', h.close);
  c.classList.add('show');
}
export function hidePoi() { $('#poiCard').classList.remove('show'); }
export function placePoi(x, y, limitRight) {
  const c = $('#poiCard');
  const w = c.offsetWidth || 290, hgt = c.offsetHeight || 140;
  let left = x + 26, top = y - hgt * 0.35;
  if (left + w > limitRight - 12) left = x - 26 - w;
  left = Math.max(12, left);
  top = Math.max(80, Math.min(innerHeight - hgt - 12, top));
  c.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
}

// ------------------------------------------------------------------ compare

export function renderMetrics(metrics, current, onPick) {
  const box = $('#metricBtns');
  box.innerHTML = metrics.map((m) => `<button type="button" data-metric="${m.id}" class="${m.id === current ? 'on' : ''}">${m.label}</button>`).join('');
  box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    onPick(b.dataset.metric);
  }));
}

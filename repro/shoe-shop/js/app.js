// PAIRS — single-page shoe store (hash routing, no build step).
import {
  BRANDS, brandById, SALE_BRANDS, LEVELS, PRODUCTS, productById, CHARTS, chartFor, chartGenders, recommend,
  sizesFor, soldOut, salePrice, fmt, forGender, variantsOf, specFor, reviewsFor, SALE_ENDS,
} from './data.js';
import { bag, fitPrefs, PLANS, planQuote, shippingFor, TAX_RATE } from './store.js';
import { logoSVG } from './logos.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');
const GENDER_LABEL = { men: 'Men', women: 'Women', kids: 'Kids', unisex: 'Unisex' };

// ------------------------------------------------------------------ 3D (lazy)
let r3dP = null, bakerP = null;
const r3d = () => (r3dP ||= import('./render3d.js'));
const getBaker = () => (bakerP ||= r3d().then((m) => new m.Baker()));
const urlCache = new Map();

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting && e.target._bakeKey) getBaker().then((b) => b.bump(e.target._bakeKey, 9));
}, { rootMargin: '250px 0px' });
const inView = (el, m = 0) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > -m && r.top < innerHeight + m; };

function setImg(img, url) {
  if (!img.isConnected) return;
  if (img.src === url) { img.classList.add('ready'); return; }
  img.addEventListener('load', () => img.classList.add('ready'), { once: true });
  img.src = url;
}
function hydrate(root = view) {
  $$('img[data-pid]:not([data-h])', root).forEach((img) => {
    img.dataset.h = '1';
    const p = productById[img.dataset.pid];
    if (!p) return;
    const kind = img.dataset.kind || 'card', preset = img.dataset.preset || '';
    const ck = `${p.id}|${kind}|${preset}`;
    if (urlCache.has(ck)) { img.src = urlCache.get(ck); img.classList.add('ready', 'instant'); return; }
    const pri = (inView(img) ? 10 : inView(img, innerHeight) ? 4 : 1) + (+img.dataset.boost || 0);
    getBaker().then((b) => {
      const job = kind === 'foot' ? b.onFoot(specFor(p), preset, { w: 900, h: 900, priority: pri }) : b.product(specFor(p), { w: 720, h: 540, priority: pri });
      img._bakeKey = job.key; io.observe(img);
      job.then((url) => { urlCache.set(ck, url); setImg(img, url); }).catch(() => img.parentElement?.classList.add('failed'));
    });
  });
  $$('img[data-hero]:not([data-h])', root).forEach((img) => {
    img.dataset.h = '1';
    const [a, b2] = img.dataset.hero.split(',').map((id) => specFor(productById[id]));
    getBaker().then((b) => b.hero(a, b2, { w: 1200, h: 860, priority: 20 }).then((url) => setImg(img, url)));
  });
}
const shoeImg = (p, { kind = 'card', preset = '', boost = 0, alt } = {}) =>
  `<img data-pid="${p.id}" data-kind="${kind}"${preset ? ` data-preset="${preset}"` : ''}${boost ? ` data-boost="${boost}"` : ''} alt="${esc(alt || `${brandById[p.brand].name} ${p.name} — ${p.colorName}`)}" draggable="false">`;

// ------------------------------------------------------------------ small UI helpers
function stars(r) { return `<span class="stars" style="--r:${(r / 5) * 100}%" aria-label="${r} out of 5">★★★★★</span>`; }
function priceHTML(p, qty = 1) {
  const s = salePrice(p) * qty;
  return p.off ? `<span class="price"><b>${fmt(s)}</b><s>${fmt(p.price * qty)}</s></span>` : `<span class="price"><b>${fmt(s)}</b></span>`;
}
function toast(html, { tone = '', ms = 3800 } = {}) {
  const t = document.createElement('div');
  t.className = `toast ${tone}`; t.innerHTML = html;
  $('#toast-root').appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  const kill = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); };
  t.addEventListener('click', (e) => { if (e.target.closest('a,button')) kill(); });
  setTimeout(kill, ms);
}
function countdownParts() {
  const s = Math.max(0, Math.floor((SALE_ENDS - Date.now()) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n) => String(n).padStart(2, '0');
function tickCountdowns() {
  const c = countdownParts();
  $$('[data-countdown]').forEach((el) => {
    if (el.dataset.countdown === 'short') el.textContent = `${c.d}d ${pad(c.h)}:${pad(c.m)}:${pad(c.s)}`;
    else el.innerHTML = [['d', 'days'], ['h', 'hrs'], ['m', 'min'], ['s', 'sec']].map(([k, l]) => `<span><b>${pad(c[k])}</b><small>${l}</small></span>`).join('');
  });
}
setInterval(tickCountdowns, 1000);

function updateBagCount(pulse) {
  const n = bag.count();
  $$('[data-bag-count]').forEach((el) => { el.textContent = n; el.classList.toggle('zero', n === 0); if (pulse) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); } });
}
bag.subscribe(() => updateBagCount(true));

// ------------------------------------------------------------------ router
let cleanup = null, lastPath = '';
function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  if (!h.startsWith('/')) return null;
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: Object.fromEntries(new URLSearchParams(qs || '')), path };
}
function route() {
  const r = parseHash();
  if (!r) return;
  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
  const [a, b] = r.parts;
  let page;
  if (!a) page = homePage();
  else if (a === 'shop') page = shopPage(r.q);
  else if (a === 'product' && productById[b]) page = productPage(productById[b]);
  else if (a === 'cart') page = cartPage();
  else if (a === 'checkout') page = checkoutPage();
  else if (a === 'order') page = orderPage(b);
  else page = { title: 'Not found', html: `<div class="wrap empty"><h1>Page not found</h1><a class="btn btn-primary" href="#/">Back home</a></div>` };
  const samePath = r.path === lastPath;
  const keepY = samePath ? scrollY : 0;
  lastPath = r.path;
  view.innerHTML = page.html;
  document.title = `${page.title ? page.title + ' — ' : ''}PAIRS`;
  $$('.nav a[data-nav]').forEach((el) => el.classList.toggle('active', !!page.nav && el.dataset.nav === page.nav));
  if (page.mount) cleanup = page.mount(view) || null;
  hydrate(view);
  tickCountdowns();
  window.scrollTo(0, keepY);
}
window.addEventListener('hashchange', route);

document.addEventListener('click', (e) => {
  const sa = e.target.closest('[data-action="size-assistant"]');
  if (sa) { e.preventDefault(); openSizeAssistant({ brand: sa.dataset.brand, gender: sa.dataset.gender, tab: sa.dataset.tab }); }
});
$('[data-search]').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = e.target.q.value.trim();
  location.hash = `#/shop${q ? `?q=${encodeURIComponent(q)}` : ''}`;
});

// ------------------------------------------------------------------ product card
function card(p, { boost = 0 } = {}) {
  const b = brandById[p.brand];
  const nVar = variantsOf(p).length;
  return `<a class="card" href="#/product/${p.id}">
    <div class="card-media" style="--bg:${p.colors.bg}">${shoeImg(p, { boost })}
      ${p.off ? `<span class="badge badge-off">−${p.off}%</span>` : p.isNew ? '<span class="badge badge-new">New</span>' : ''}
      ${p.off && p.isNew ? '<span class="badge badge-new badge-2">New</span>' : ''}
      <span class="card-360" title="360° view & on-foot looks">360°</span>
    </div>
    <div class="card-body">
      <div class="card-brand">${esc(b.name)} <span>· ${esc(p.category)}</span></div>
      <div class="card-name">${esc(p.name)}</div>
      <div class="card-color">${esc(p.colorName)}${nVar > 1 ? ` · ${nVar} colours` : ''}</div>
      <div class="card-foot">${priceHTML(p)}<span class="card-g">${GENDER_LABEL[p.gender]}</span></div>
      <div class="card-rate">${stars(p.rating)} <span>${p.rating.toFixed(1)} (${p.reviews.toLocaleString()})</span></div>
    </div>
  </a>`;
}

// ================================================================== HOME
function homePage() {
  const best = (bid) => PRODUCTS.filter((p) => p.brand === bid).sort((x, y) => y.off - x.off || y.reviews - x.reviews)[0];
  const trending = ['velox-aerolite-3-midnight', 'courtline-baseline-varsity', 'nordvik-oslo-chestnut', 'luma-luna-scarlet', 'kaze-hikari-sakura', 'drift-tidewater-black', 'nordvik-fjell-tobacco', 'pebble-bounce-ocean'].map((id) => productById[id]);
  const onSale = (bid) => PRODUCTS.filter((p) => p.brand === bid && p.off > 0).length;
  const genderTiles = [
    { g: 'men', title: 'Men', pid: 'nordvik-fjell-tobacco', line: 'Trail boots, court classics, daily trainers' },
    { g: 'women', title: 'Women', pid: 'luma-mira-onyx', line: 'Block heels, ballet flats, runners' },
    { g: 'kids', title: 'Kids', pid: 'pebble-bounce-berry', line: 'Easy straps, roomy toes, bright colours' },
  ];
  const html = `
  <section class="hero">
    <div class="wrap hero-in">
      <div class="hero-copy">
        <div class="eyebrow"><span class="live-dot"></span>Brand Week · ${SALE_BRANDS.length} brands on sale</div>
        <h1>Up to <em>50% off</em> the brands you walk in.</h1>
        <p class="lede">${SALE_BRANDS.map((b) => b.name).join(', ').replace(/, ([^,]*)$/, ' and $1')} are all taking part. Spin every pair in 360°, see it on foot, and split the cost into interest-free installments.</p>
        <div class="cta-row">
          <a class="btn btn-primary btn-lg" href="#/shop?sale=1">Shop the sale</a>
          <button class="btn btn-ghost btn-lg" data-action="size-assistant" data-tab="measure">Find my size</button>
        </div>
        <div class="hero-count"><span class="hero-count-label">Sale ends in</span><div class="count-blocks" data-countdown></div></div>
      </div>
      <div class="hero-art">
        <div class="hero-disc"></div>
        <div class="hero-ring"></div>
        <img class="hero-img" data-hero="velox-aerolite-3-midnight,courtline-rally-forest" alt="Velox Aerolite 3 and Courtline Rally Lo">
        <a class="hero-tag t1" href="#/product/velox-aerolite-3-midnight"><span>Velox Aerolite 3</span><b>−40%</b></a>
        <a class="hero-tag t2" href="#/product/courtline-rally-forest"><span>Courtline Rally Lo</span><b>−50%</b></a>
      </div>
    </div>
  </section>

  <section class="wrap block" id="brand-sale">
    <div class="block-head">
      <div><div class="eyebrow">Brand special sale</div><h2>Participating brands &amp; discount levels</h2>
      <p class="sub">Every participating brand is assigned a discount level for Brand Week. Prices below are already reduced — no codes needed.</p></div>
      <a class="link-arrow" href="#/shop?sale=1">All ${PRODUCTS.filter((p) => p.off).length} sale styles</a>
    </div>
    <div class="ladder">
      ${LEVELS.map((L) => {
        const bs = SALE_BRANDS.filter((b) => b.level === L.id);
        return `<div class="rung rung-${L.id.toLowerCase()}">
          <div class="rung-off"><b>${L.off}</b><span>%</span></div>
          <div class="rung-txt"><div class="rung-name">${L.id} level</div><div class="rung-note">${L.note}</div></div>
          <div class="rung-brands">${bs.map((b) => `<a href="#/shop?brand=${b.id}&sale=1" class="rung-chip" style="--bc:${b.color}">${logoSVG(b.id, b.color, 16)}${esc(b.name)}</a>`).join('')}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="brand-grid">
      ${SALE_BRANDS.map((b) => {
        const p = best(b.id);
        return `<a class="brand-card" href="#/shop?brand=${b.id}&sale=1" style="--tint:${b.tint};--bc:${b.color}">
          <div class="bc-top"><span class="bc-logo">${logoSVG(b.id, b.color, 26)}</span><span class="bc-level">${b.level}</span></div>
          <div class="bc-name">${esc(b.name)}</div>
          <div class="bc-tag">${esc(b.tagline)}</div>
          <div class="bc-off"><small>up to</small><b>${b.sale}</b><span>%<br>off</span></div>
          <div class="bc-meter" title="Discount level"><i style="width:${(b.sale / 50) * 100}%"></i></div>
          <div class="bc-img">${shoeImg(p, { boost: 2 })}</div>
          <div class="bc-foot"><span>${onSale(b.id)} styles on sale</span><span class="bc-go">Shop ${esc(b.name)} →</span></div>
        </a>`;
      }).join('')}
      <a class="brand-card brand-card-note" href="#/shop?brand=orbit">
        <div class="bc-top"><span class="bc-logo">${logoSVG('orbit', brandById.orbit.color, 26)}</span><span class="bc-level muted">Everyday price</span></div>
        <div class="bc-name">Not in the sale</div>
        <p>${BRANDS.filter((b) => !b.sale).map((b) => `<b>${esc(b.name)}</b>`).join(', ')} keeps its fair everyday prices — no mark-ups before, no mark-downs now.</p>
        <div class="bc-img">${shoeImg(productById['orbit-daily-stone'])}</div>
        <div class="bc-count"><span>Brand Week ends in</span><b data-countdown="short">—</b></div>
      </a>
    </div>
  </section>

  <section class="wrap block">
    <div class="block-head"><div><div class="eyebrow">Shop by</div><h2>Who are we fitting today?</h2></div></div>
    <div class="gender-tiles">
      ${genderTiles.map((t) => {
        const n = PRODUCTS.filter((p) => forGender(p, t.g)).length;
        return `<a class="gtile" href="#/shop?gender=${t.g}" style="--bg:${productById[t.pid].colors.bg}">
          <div class="gtile-txt"><h3>${t.title}</h3><p>${t.line}</p><span class="gtile-n">${n} styles →</span></div>
          <div class="gtile-img">${shoeImg(productById[t.pid])}</div></a>`;
      }).join('')}
    </div>
  </section>

  <section class="wrap block">
    <div class="block-head"><div><div class="eyebrow">Trending this week</div><h2>Most-spun pairs</h2></div><a class="link-arrow" href="#/shop">Shop all</a></div>
    <div class="grid grid-4">${trending.map((p) => card(p)).join('')}</div>
  </section>

  <section class="wrap block perks">
    ${[
      ['360', 'Every pair in 360°', 'Drag to spin, zoom in on the stitching and flip to the outsole before you buy.'],
      ['ruler', 'Size Assistant', 'Brand-by-brand conversion tables and a cross-brand converter so the first pair fits.', 'size-assistant'],
      ['merge', 'Smart bag', 'Ordering two sizes to compare? Merge them into one tidy entry, then return the spare free.'],
      ['card', 'Pay over time', 'Pay in 4 interest-free, or 3 to 24 monthly installments at checkout.'],
    ].map(([i, t, d, act]) => `<div class="perk">${ICONS[i]}<div><h4>${t}</h4><p>${d}</p>${act ? `<button class="link" data-action="${act}">Open the Size Assistant →</button>` : ''}</div></div>`).join('')}
  </section>`;
  return { title: 'Brand Week', html, nav: '' };
}

const ICONS = {
  '360': '<svg viewBox="0 0 48 48" class="ico"><ellipse cx="24" cy="26" rx="18" ry="7" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M36 20l4 5-6 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 23c3-9 15-9 18 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  ruler: '<svg viewBox="0 0 48 48" class="ico"><path d="M6 30 30 6l12 12-24 24z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="m14 22 4 4m2-10 4 4m2-10 4 4M10 28l2 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  merge: '<svg viewBox="0 0 48 48" class="ico"><path d="M10 10v6c0 6 14 8 14 16v6M38 10v6c0 6-14 8-14 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="m18 34 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  card: '<svg viewBox="0 0 48 48" class="ico"><rect x="6" y="12" width="36" height="24" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M6 19h36M12 29h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="34" cy="29" r="2" fill="currentColor"/></svg>',
};

// ================================================================== SHOP (listing)
const CATS = ['Running', 'Lifestyle', 'Basketball', 'Boots', 'Flats', 'Heels', 'Skate', 'Kids'];
function shopPage(q) {
  const gender = ['men', 'women', 'kids'].includes(q.gender) ? q.gender : 'all';
  const brands = q.brand ? q.brand.split(',').filter((b) => brandById[b]) : [];
  const cats = q.cat ? q.cat.split(',').filter((c) => CATS.includes(c)) : [];
  const sale = q.sale === '1';
  const max = q.max ? +q.max : 250;
  const text = (q.q || '').toLowerCase();
  const sort = q.sort || 'featured';
  const base = (p) => (!brands.length || brands.includes(p.brand)) && (!cats.length || cats.includes(p.category)) && (!sale || p.off > 0) && salePrice(p) <= max
    && (!text || `${brandById[p.brand].name} ${p.name} ${p.colorName} ${p.category} ${p.gender}`.toLowerCase().includes(text));
  const counts = Object.fromEntries(['all', 'men', 'women', 'kids'].map((g) => [g, PRODUCTS.filter((p) => base(p) && forGender(p, g)).length]));
  let list = PRODUCTS.filter((p) => base(p) && forGender(p, gender));
  const sorters = {
    featured: (a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.reviews - a.reviews,
    'price-asc': (a, b) => salePrice(a) - salePrice(b), 'price-desc': (a, b) => salePrice(b) - salePrice(a),
    discount: (a, b) => b.off - a.off, rating: (a, b) => b.rating - a.rating,
  };
  list = list.slice().sort(sorters[sort] || sorters.featured);
  const link = (patch) => {
    const n = { gender: gender === 'all' ? '' : gender, brand: brands.join(','), cat: cats.join(','), sale: sale ? '1' : '', max: max < 250 ? String(max) : '', q: q.q || '', sort: sort === 'featured' ? '' : sort, ...patch };
    const s = Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `#/shop${s ? '?' + s : ''}`;
  };
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]).join(',');
  const title = sale ? 'Brand Week sale' : text ? `Results for “${esc(q.q)}”` : gender === 'all' ? 'All shoes' : { men: 'Men’s shoes', women: 'Women’s shoes', kids: 'Kids’ shoes' }[gender];
  const chips = [
    ...brands.map((b) => [brandById[b].name, link({ brand: toggle(brands, b) })]),
    ...cats.map((c) => [c, link({ cat: toggle(cats, c) })]),
    ...(sale ? [['On sale', link({ sale: '' })]] : []),
    ...(max < 250 ? [[`Under ${fmt(max).replace('.00', '')}`, link({ max: '' })]] : []),
    ...(text ? [[`“${q.q}”`, link({ q: '' })]] : []),
  ];
  const html = `
  <div class="wrap shop">
    <div class="shop-head">
      <nav class="crumbs"><a href="#/">Home</a><span>/</span><a href="#/shop">Shop</a>${gender !== 'all' ? `<span>/</span>${GENDER_LABEL[gender]}` : ''}</nav>
      <div class="shop-title"><h1>${title}</h1><span class="muted">${list.length} style${list.length === 1 ? '' : 's'}</span></div>
      <div class="gender-seg" role="tablist" aria-label="Filter by gender">
        ${['all', 'men', 'women', 'kids'].map((g) => `<a role="tab" aria-selected="${g === gender}" class="${g === gender ? 'on' : ''}" href="${link({ gender: g === 'all' ? '' : g })}">${g === 'all' ? 'All' : GENDER_LABEL[g]}<span>${counts[g]}</span></a>`).join('')}
      </div>
      ${gender === 'men' || gender === 'women' ? `<p class="seg-note">Unisex styles appear under both Men and Women — look for the <b>Unisex</b> tag.</p>` : ''}
    </div>
    <div class="shop-body">
      <aside class="filters" aria-label="Filters">
        <div class="f-group">
          <label class="switch"><input type="checkbox" data-go="${link({ sale: sale ? '' : '1' })}" ${sale ? 'checked' : ''}><span></span>Brand Week deals only</label>
        </div>
        <div class="f-group"><h4>Brand</h4>
          ${BRANDS.map((b) => `<label class="check"><input type="checkbox" data-go="${link({ brand: toggle(brands, b.id) })}" ${brands.includes(b.id) ? 'checked' : ''}><span class="check-logo">${logoSVG(b.id, b.color, 16)}</span>${esc(b.name)}${b.sale ? `<em class="f-off">−${b.sale}%</em>` : ''}</label>`).join('')}
        </div>
        <div class="f-group"><h4>Category</h4>
          ${CATS.map((c) => `<label class="check"><input type="checkbox" data-go="${link({ cat: toggle(cats, c) })}" ${cats.includes(c) ? 'checked' : ''}>${c}<span class="f-n">${PRODUCTS.filter((p) => p.category === c && forGender(p, gender)).length}</span></label>`).join('')}
        </div>
        <div class="f-group"><h4>Max price <b class="f-price" data-price-out>${max >= 250 ? 'Any' : fmt(max).replace('.00', '')}</b></h4>
          <input type="range" min="40" max="250" step="10" value="${max}" data-price aria-label="Maximum price">
          <div class="range-ends"><span>$40</span><span>$250+</span></div>
        </div>
        <div class="f-group f-help">
          <p>Unsure about sizing across brands?</p>
          <button class="btn btn-ghost btn-sm" data-action="size-assistant">Open Size Assistant</button>
        </div>
      </aside>
      <section class="results">
        <div class="results-bar">
          <div class="chips">${chips.map(([t, h]) => `<a class="chip" href="${h}">${esc(t)} <span aria-hidden="true">×</span></a>`).join('')}${chips.length ? `<a class="chip chip-clear" href="${gender === 'all' ? '#/shop' : `#/shop?gender=${gender}`}">Clear filters</a>` : '<span class="muted small">Showing every style — use the filters to narrow down.</span>'}</div>
          <label class="sort">Sort by <select data-sort>
            ${[['featured', 'Featured'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['discount', 'Biggest discount'], ['rating', 'Top rated']].map(([v, l]) => `<option value="${v}" ${v === sort ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
        </div>
        ${list.length ? `<div class="grid grid-3">${list.map((p) => card(p)).join('')}</div>` : `<div class="empty-box"><h3>No shoes match those filters</h3><p>Try removing a filter or widening the price range.</p><a class="btn btn-primary" href="#/shop">Reset filters</a></div>`}
      </section>
    </div>
  </div>`;
  return {
    title, html, nav: sale ? 'sale' : gender !== 'all' ? gender : '',
    mount(root) {
      root.addEventListener('change', (e) => {
        const t = e.target;
        if (t.dataset.go) location.hash = t.dataset.go;
        else if (t.matches('[data-sort]')) location.hash = link({ sort: t.value === 'featured' ? '' : t.value });
        else if (t.matches('[data-price]')) location.hash = link({ max: +t.value >= 250 ? '' : t.value });
      });
      root.addEventListener('input', (e) => {
        if (e.target.matches('[data-price]')) { const v = +e.target.value; $('[data-price-out]', root).textContent = v >= 250 ? 'Any' : `$${v}`; }
      });
    },
  };
}

// ================================================================== PRODUCT
function productPage(p) {
  const b = brandById[p.brand];
  const variants = variantsOf(p);
  const rows = sizesFor(p);
  const oos = soldOut(p);
  const fit = fitPrefs.get();
  const rec = fit.foot ? recommend(rows, fit.foot, fit.pref || 0, b.offset || 0) : null;
  const sp = salePrice(p);
  const pi4 = planQuote(PLANS[1], sp), m12 = planQuote(PLANS[4], sp);
  const reviews = reviewsFor(p);
  const related = PRODUCTS.filter((q) => q.id !== p.id && q.style !== p.style && (q.brand === p.brand || q.category === p.category)).slice(0, 4);
  const { ONFOOT } = productPage;
  const sys = ['label', 'us', 'uk', 'eu', 'cm'];
  const html = `
  <div class="wrap pdp">
    <nav class="crumbs"><a href="#/">Home</a><span>/</span><a href="#/shop?gender=${p.gender === 'unisex' ? '' : p.gender}">${GENDER_LABEL[p.gender]}</a><span>/</span><a href="#/shop?brand=${b.id}">${esc(b.name)}</a><span>/</span>${esc(p.name)}</nav>
    <div class="pdp-grid">
      <section class="gallery">
        <div class="stage" data-stage style="--bg:${p.colors.bg}">
          <div class="viewer-host" data-viewer></div>
          <div class="viewer-loading" data-vload><span class="spinner"></span>Preparing 360° view…</div>
          <div class="v-badge"><svg viewBox="0 0 24 24" width="16" height="16"><ellipse cx="12" cy="13" rx="9" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m18 10 2.4 2.6-3.2 1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>360° view</div>
          <div class="v-hint" data-hint><span class="v-hand">⇆</span>Drag to spin · scroll to zoom</div>
          <div class="v-tools">
            <button class="vt" data-v="auto" title="Auto-rotate" aria-label="Auto-rotate"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="vt" data-v="zin" title="Zoom in" aria-label="Zoom in">+</button>
            <button class="vt" data-v="zout" title="Zoom out" aria-label="Zoom out">−</button>
            <button class="vt" data-v="reset" title="Reset view" aria-label="Reset view"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>
          <div class="v-bottom">
            <div class="v-views">${[['side', 'Side'], ['front', 'Front'], ['back', 'Heel'], ['medial', 'Inside'], ['top', 'Top'], ['sole', 'Sole']].map(([k, l]) => `<button data-view="${k}">${l}</button>`).join('')}</div>
          </div>
            <div class="v-dial">
              <svg viewBox="0 0 64 64" class="dial" data-dial aria-label="Rotation angle">
                <circle cx="32" cy="32" r="28" class="dial-ring"/>
                ${Array.from({ length: 24 }, (_, i) => `<line x1="32" y1="5" x2="32" y2="${i % 6 ? 8 : 10}" transform="rotate(${i * 15} 32 32)" class="dial-tick"/>`).join('')}
                <g data-dial-needle><path d="M32 12 36 20h-8z" class="dial-needle"/><path d="M24 36c2-5 7-8 12-8 3 0 5 2 5 4 0 3-4 4-8 5-4 1-7 2-9-1z" class="dial-shoe"/></g>
              </svg>
              <div class="v-angle"><b data-angle>0°</b><input type="range" min="0" max="359" value="0" data-angle-range aria-label="Rotate"></div>
            </div>
          <figure class="foot-view" data-footview hidden>
            <img alt="" data-footimg>
            <figcaption data-footcap></figcaption>
            <button class="fv-nav prev" data-fv="-1" aria-label="Previous look">‹</button>
            <button class="fv-nav next" data-fv="1" aria-label="Next look">›</button>
          </figure>
        </div>
        <div class="thumbs" role="tablist">
          <button class="thumb on" data-show="360" role="tab"><span class="thumb-360"><b>360°</b><small>Spin</small></span></button>
          ${ONFOOT.map((f, i) => `<button class="thumb" data-show="foot" data-i="${i}" role="tab" aria-label="On-foot: ${f.label}">${shoeImg(p, { kind: 'foot', preset: f.id, boost: 6 - i })}<span class="thumb-cap">On foot</span></button>`).join('')}
        </div>
      </section>

      <section class="buybox">
        <div class="bb-brand"><a href="#/shop?brand=${b.id}">${logoSVG(b.id, b.color, 22)}${esc(b.name)}</a>${b.sale ? `<span class="lvl lvl-${b.level.toLowerCase()}">Brand Week · ${b.level}</span>` : ''}${p.isNew ? '<span class="lvl lvl-new">New</span>' : ''}</div>
        <h1>${esc(p.name)}</h1>
        <div class="bb-sub">${esc(p.colorName)} · ${GENDER_LABEL[p.gender]}${p.gender === 'unisex' ? ' (men’s sizing)' : ''} · ${esc(p.category)}</div>
        <a class="bb-rate" href="#reviews" data-jump="reviews">${stars(p.rating)} <b>${p.rating.toFixed(1)}</b> <span>${p.reviews.toLocaleString()} reviews</span></a>
        <div class="bb-price">
          <span class="bb-now">${fmt(sp)}</span>
          ${p.off ? `<span class="bb-was">${fmt(p.price)}</span><span class="bb-save">Save ${fmt(p.price - sp)} (${p.off}%)</span>` : '<span class="bb-reg">Everyday price</span>'}
        </div>
        <details class="bb-inst">
          <summary><span>or <b>4 × ${fmt(pi4.per)}</b> interest-free, or from <b>${fmt(m12.per)}/mo</b></span><span class="link">See plans</span></summary>
          <table class="mini-plans">
            <tr><th>Plan</th><th>Per installment</th><th>Total</th></tr>
            ${PLANS.slice(1).map((pl) => { const qt = planQuote(pl, sp); return `<tr class="${qt.eligible ? '' : 'dim'}"><td>${pl.label}<small>${pl.blurb}</small></td><td><b>${fmt(qt.per)}</b>${pl.kind === 'biweekly' ? ' / 2 wks' : ' / mo'}</td><td>${qt.eligible ? fmt(qt.totalPaid) : `Min. ${fmt(pl.min).replace('.00', '')}`}</td></tr>`; }).join('')}
          </table>
          <p class="small muted">Plans are calculated on your bag total at checkout.</p>
        </details>
        ${variants.length > 1 ? `<div class="bb-block"><div class="bb-label">Colour: <b>${esc(p.colorName)}</b></div><div class="swatches">
          ${variants.map((v) => `<a class="sw ${v.id === p.id ? 'on' : ''}" href="#/product/${v.id}" title="${esc(v.colorName)} (${GENDER_LABEL[v.gender]})" style="--c:${v.colors.swatch};--c2:${v.colors.accent}"><i></i></a>`).join('')}
        </div></div>` : ''}
        <div class="bb-block">
          <div class="bb-label bb-sizehead">
            <span>Size <small class="muted">(${esc(b.name)} ${CHARTS[b.chart].system} sizing)</small></span>
            <span class="sys-seg" role="group" aria-label="Size system">${sys.map((s) => `<button data-sys="${s}" class="${s === 'label' ? 'on' : ''}">${s === 'label' ? 'Brand' : s.toUpperCase()}</button>`).join('')}</span>
          </div>
          <div class="sizes" data-sizes>
            ${rows.map((r) => `<button class="size ${oos.has(r.label) ? 'oos' : ''} ${rec && rec.label === r.label ? 'rec' : ''}" data-size="${esc(r.label)}" ${oos.has(r.label) ? 'disabled aria-disabled="true"' : ''} data-us="${esc(r.us)}" data-uk="${esc(r.uk)}" data-eu="${esc(r.eu)}" data-cm="${esc(r.cm)}"><span>${esc(r.label.replace(/^(US|EU) /, ''))}</span></button>`).join('')}
          </div>
          <div class="size-help">
            ${rec ? `<span class="rec-note"><i></i>Your fit: <b>${esc(rec.label)}</b> for ${fit.foot} cm feet</span>` : '<span class="muted">Sizes are shown in this brand’s own labels.</span>'}
            <button class="link" data-action="size-assistant" data-brand="${b.id}" data-gender="${p.gender === 'unisex' ? 'men' : p.gender}">${ICONS.ruler}Size Assistant</button>
          </div>
          <p class="fit-note"><b>Fit:</b> ${esc(b.fit)}</p>
        </div>
        <div class="bb-buy">
          <div class="qty" data-qty><button data-q="-1" aria-label="Decrease">−</button><span data-qn>1</span><button data-q="1" aria-label="Increase">+</button></div>
          <button class="btn btn-primary btn-lg bb-add" data-add>Add to bag</button>
        </div>
        <p class="bb-err" data-err hidden>Please choose a size first.</p>
        <ul class="bb-perks"><li>Free shipping over $75 · arrives in 3–5 days</li><li>Free 30-day returns — order two sizes, keep one</li><li>Pay in 4 or monthly at checkout</li></ul>
      </section>
    </div>

    <section class="block onfoot">
      <div class="block-head"><div><div class="eyebrow">On-foot looks</div><h2>How the ${esc(p.name)} wears</h2><p class="sub">Rendered in this exact colourway, styled the way our customers wear it.</p></div></div>
      <div class="onfoot-grid">
        ${ONFOOT.map((f, i) => `<figure class="of-card" data-of="${i}"><div class="of-media" style="--bg:${p.colors.bg}">${shoeImg(p, { kind: 'foot', preset: f.id })}</div><figcaption><b>${f.label}</b><span>${f.note}</span></figcaption></figure>`).join('')}
      </div>
    </section>

    <section class="block details" id="details">
      <div class="tabs" role="tablist">
        <button class="on" data-tab="desc">Details</button><button data-tab="specs">Specs</button><button data-tab="reviews" id="reviews">Reviews (${p.reviews.toLocaleString()})</button>
      </div>
      <div class="tab-body" data-body="desc"><p class="big">${esc(p.blurb)}</p>
        <ul class="ticks"><li>${p.off ? `Brand Week price: ${p.off}% off until Sunday` : 'Everyday fair price'}</li><li>${esc(b.fit)}</li><li>Colourway: ${esc(p.colorName)}</li><li>Style code ${p.id.toUpperCase().replace(/-/g, '').slice(0, 10)}</li></ul></div>
      <div class="tab-body" data-body="specs" hidden><table class="specs">${Object.entries(p.specs).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}<tr><th>Size system</th><td>${esc(CHARTS[b.chart].note)}</td></tr></table></div>
      <div class="tab-body" data-body="reviews" hidden>
        <div class="rev-sum"><div class="rev-big">${p.rating.toFixed(1)}</div><div>${stars(p.rating)}<p>${p.reviews.toLocaleString()} verified reviews</p></div>
          <div class="fitbar"><span>Runs small</span><div><i style="left:${b.chart === 'jp' ? 38 : b.chart === 'eu' ? 62 : 50}%"></i></div><span>Runs large</span></div></div>
        ${reviews.map((r) => `<article class="rev"><div class="rev-h">${stars(r.stars)}<b>${esc(r.title)}</b></div><p>${esc(r.body)}</p><div class="rev-m">${esc(r.name)} · ${esc(r.date)} · Fit: ${esc(r.fit)}</div></article>`).join('')}
      </div>
    </section>

    ${related.length ? `<section class="block"><div class="block-head"><div><div class="eyebrow">You may also like</div><h2>More from ${esc(b.name)} &amp; friends</h2></div></div><div class="grid grid-4">${related.map((q) => card(q)).join('')}</div></section>` : ''}
  </div>`;

  return {
    title: `${b.name} ${p.name} — ${p.colorName}`, html, nav: '',
    mount(root) {
      let viewer = null, dead = false, sel = null, qty = 1, sysMode = 'label', footIdx = -1;
      const stage = $('[data-stage]', root);
      const angleOut = $('[data-angle]', root), angleRange = $('[data-angle-range]', root), needle = $('[data-dial-needle]', root);
      const autoBtn = $('[data-v="auto"]', root);
      const onChange = ({ angle, auto }) => {
        const a = Math.round(angle) % 360;
        angleOut.textContent = `${a}°`;
        if (document.activeElement !== angleRange) angleRange.value = a;
        needle.setAttribute('transform', `rotate(${a} 32 32)`);
        autoBtn.classList.toggle('on', auto);
      };
      r3d().then((m) => {
        if (dead) return;
        viewer = new m.ShoeViewer($('[data-viewer]', root), { onChange });
        viewer.setShoe(specFor(p));
        viewer.view('hero');
        $('[data-vload]', root).remove();
        stage.classList.add('ready');
        window.__viewer = viewer;
      }).catch((e) => { console.error(e); $('[data-vload]', root).textContent = '3D view unavailable on this device.'; });
      const hideHint = () => $('[data-hint]', root)?.classList.add('gone');
      $('[data-viewer]', root).addEventListener('pointerdown', hideHint);
      root.addEventListener('click', (e) => {
        const t = e.target.closest('button, [data-jump]');
        if (!t) return;
        if (t.dataset.v && viewer) {
          hideHint();
          if (t.dataset.v === 'auto') viewer.setAuto(!viewer.auto);
          if (t.dataset.v === 'zin') viewer.setZoom(viewer.zoom * 1.25);
          if (t.dataset.v === 'zout') viewer.setZoom(viewer.zoom / 1.25);
          if (t.dataset.v === 'reset') viewer.view('hero');
        }
        if (t.dataset.view && viewer) { hideHint(); viewer.view(t.dataset.view); $$('[data-view]', root).forEach((x) => x.classList.toggle('on', x === t)); }
        if (t.dataset.show) showMedia(t.dataset.show, +t.dataset.i);
        if (t.dataset.fv) showMedia('foot', (footIdx + +t.dataset.fv + ONFOOT.length) % ONFOOT.length);
        if (t.dataset.sys) {
          sysMode = t.dataset.sys;
          $$('[data-sys]', root).forEach((x) => x.classList.toggle('on', x === t));
          $$('[data-size]', root).forEach((btn) => { const v = sysMode === 'label' ? btn.dataset.size.replace(/^(US|EU) /, '') : btn.dataset[sysMode]; btn.firstElementChild.textContent = sysMode === 'cm' ? `${v} cm` : v; });
        }
        if (t.dataset.size !== undefined && !t.disabled) {
          sel = t.dataset.size;
          $$('[data-size]', root).forEach((x) => x.classList.toggle('on', x === t));
          $('[data-err]', root).hidden = true;
        }
        if (t.dataset.q) { qty = Math.max(1, Math.min(10, qty + +t.dataset.q)); $('[data-qn]', root).textContent = qty; }
        if (t.matches('[data-add]')) {
          if (!sel) { $('[data-err]', root).hidden = false; $('[data-sizes]', root).classList.remove('shake'); void root.offsetWidth; $('[data-sizes]', root).classList.add('shake'); return; }
          const res = bag.add(p.id, sel, qty);
          t.classList.add('done'); t.textContent = 'Added ✓'; setTimeout(() => { t.classList.remove('done'); t.textContent = 'Add to bag'; }, 1600);
          const others = bag.sizesOf(p.id).filter((l) => l.size !== sel).map((l) => l.size);
          toast(`<div class="t-row"><div class="t-img" style="--bg:${p.colors.bg}">${shoeImg(p)}</div><div><b>${res.combined ? 'Quantity updated' : 'Added to bag'}</b><div>${esc(p.name)} · ${esc(sel)} × ${qty}</div>
            ${res.combined ? '<div class="t-note">Identical item combined with the one already in your bag.</div>' : others.length ? `<div class="t-note">You also have ${others.join(', ')} of this style — merge them into one entry in your bag.</div>` : ''}
            <a class="t-link" href="#/cart">View bag →</a></div></div>`);
          hydrate($('#toast-root'));
        }
        if (t.dataset.tab) {
          $$('[data-tab]', root).forEach((x) => x.classList.toggle('on', x === t));
          $$('[data-body]', root).forEach((x) => { x.hidden = x.dataset.body !== t.dataset.tab; });
        }
        if (t.dataset.jump) { e.preventDefault(); $('[data-tab="reviews"]', root).click(); $('#details').scrollIntoView({ behavior: 'smooth' }); }
      });
      root.addEventListener('click', (e) => { const of = e.target.closest('[data-of]'); if (of) { showMedia('foot', +of.dataset.of); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
      angleRange.addEventListener('input', () => { if (viewer) { hideHint(); viewer.setAuto(false); viewer.setAngle(+angleRange.value); } });
      $('[data-dial]', root).addEventListener('click', (e) => {
        if (!viewer) return;
        const r = e.currentTarget.getBoundingClientRect();
        const a = (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI;
        viewer.setAuto(false); viewer.setAngle((a + 360) % 360);
      });
      function showMedia(kind, i) {
        const fv = $('[data-footview]', root);
        $$('.thumb', root).forEach((x) => x.classList.toggle('on', kind === '360' ? x.dataset.show === '360' : x.dataset.show === 'foot' && +x.dataset.i === i));
        if (kind === '360') { fv.hidden = true; stage.classList.remove('show-foot'); footIdx = -1; return; }
        footIdx = i;
        const f = ONFOOT[i];
        const src = $(`.thumb[data-i="${i}"] img`, root);
        const img = $('[data-footimg]', root);
        img.classList.remove('ready');
        const apply = () => { img.src = src.src; img.alt = `${p.name} on foot — ${f.label}`; img.classList.add('ready'); };
        if (src.classList.contains('ready')) apply(); else { img.removeAttribute('src'); src.addEventListener('load', apply, { once: true }); }
        $('[data-footcap]', root).innerHTML = `<b>${f.label}</b> · ${f.note}`;
        fv.hidden = false; stage.classList.add('show-foot');
        if (viewer) viewer.setAuto(false);
      }
      return () => { dead = true; if (viewer) viewer.dispose(); window.__viewer = null; };
    },
  };
}
productPage.ONFOOT = [
  { id: 'stand', label: 'Standing, side profile', note: 'Studio · true-to-size fit' },
  { id: 'walk', label: 'Mid-stride', note: 'City concrete · heel-to-toe flex' },
  { id: 'back', label: 'From behind', note: 'Oak floor · heel counter & pull tab' },
  { id: 'top', label: 'Front, high angle', note: 'Terrazzo · toe box & lacing' },
];

// ================================================================== CART
function cartPage() {
  const html = `<div class="wrap cart" data-cart></div>`;
  const render = (root) => {
    const box = $('[data-cart]', root);
    const st = bag.state;
    const entries = bag.entries();
    const cands = bag.mergeCandidates();
    const T = bag.totals();
    const ship = shippingFor(T.sub, 'standard');
    const tax = Math.round(T.sub * TAX_RATE * 100) / 100;
    const total = Math.round((T.sub + ship + tax) * 100) / 100;
    const pi4 = planQuote(PLANS[1], total);
    if (!st.lines.length) {
      box.innerHTML = `<div class="empty-box big"><h1>Your bag is empty</h1><p>Browse the Brand Week sale — or load a demo bag with the same style in two sizes to try merging.</p>
        <div class="cta-row center"><a class="btn btn-primary" href="#/shop?sale=1">Shop the sale</a><button class="btn btn-ghost" data-act="demo">Load demo bag</button></div></div>`;
      return;
    }
    const sizeOpts = (pid, cur) => sizesFor(productById[pid]).map((r) => `<option ${r.label === cur ? 'selected' : ''} ${soldOut(productById[pid]).has(r.label) && r.label !== cur ? 'disabled' : ''}>${esc(r.label)}</option>`).join('');
    const lineHTML = (en) => {
      const p = productById[en.pid], b = brandById[p.brand];
      const pairs = en.lines.reduce((s, l) => s + l.qty, 0);
      const grouped = !bag.isMerged(p.id) && bag.sizesOf(p.id).length > 1;
      const head = `<a class="line-img" href="#/product/${p.id}" style="--bg:${p.colors.bg}">${shoeImg(p)}</a>`;
      const meta = `<div class="line-brand">${logoSVG(b.id, b.color, 14)}${esc(b.name)}${p.off ? `<span class="line-off">−${p.off}%</span>` : ''}</div>
        <a class="line-name" href="#/product/${p.id}">${esc(p.name)}</a>
        <div class="line-meta">${esc(p.colorName)} · ${GENDER_LABEL[p.gender]}</div>`;
      if (en.type === 'merged') {
        return `<li class="line merged" data-pid="${p.id}">
          ${head}
          <div class="line-info">
            <div class="merged-tag"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 4v3c0 3 6 4 6 8v5M18 4v3c0 3-6 4-6 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Merged entry · ${en.lines.length} sizes · ${pairs} pairs</div>
            ${meta}
            <table class="size-break"><thead><tr><th>Size</th><th>Qty</th><th>Price</th><th></th></tr></thead><tbody>
              ${en.lines.map((l) => `<tr data-size="${esc(l.size)}"><td><span class="size-pill">${esc(l.size)}</span></td>
                <td><div class="qty sm"><button data-act="dec" aria-label="Decrease">−</button><span>${l.qty}</span><button data-act="inc" aria-label="Increase">+</button></div></td>
                <td>${priceHTML(p, l.qty)}</td><td><button class="icon-x" data-act="remove" aria-label="Remove ${esc(l.size)}">×</button></td></tr>`).join('')}
            </tbody></table>
            <div class="merged-actions">
              <label class="add-size">+ Add a size <select data-act="addsize"><option value="">Choose…</option>${sizesFor(p).filter((r) => !en.lines.some((l) => l.size === r.label) && !soldOut(p).has(r.label)).map((r) => `<option>${esc(r.label)}</option>`).join('')}</select></label>
              <button class="link" data-act="split">Split into separate lines</button>
              <button class="link danger" data-act="removestyle">Remove style</button>
            </div>
          </div>
          <div class="line-price">${priceHTML(p, pairs)}<small>${pairs} × ${fmt(salePrice(p))}</small></div>
        </li>`;
      }
      const l = en.lines[0];
      const others = bag.sizesOf(p.id).filter((x) => x.size !== l.size).map((x) => x.size);
      return `<li class="line ${grouped ? 'grouped' : ''}" data-pid="${p.id}" data-size="${esc(l.size)}" style="--gc:${p.colors.swatch}">
        ${head}
        <div class="line-info">
          ${meta}
          <div class="line-controls">
            <label class="sel">Size <select data-act="size">${sizeOpts(p.id, l.size)}</select></label>
            <div class="qty sm"><button data-act="dec" aria-label="Decrease">−</button><span>${l.qty}</span><button data-act="inc" aria-label="Increase">+</button></div>
            <button class="link" data-act="remove">Remove</button>
          </div>
          ${grouped ? `<div class="line-hint">Same style also in your bag in <b>${others.map(esc).join(', ')}</b>. <button class="link strong" data-act="merge">Merge into one entry</button></div>` : ''}
        </div>
        <div class="line-price">${priceHTML(p, l.qty)}${l.qty > 1 ? `<small>${l.qty} × ${fmt(salePrice(p))}</small>` : ''}</div>
      </li>`;
    };
    const mergedCount = entries.filter((e) => e.type === 'merged').length;
    box.innerHTML = `
      <div class="cart-head"><h1>Your bag <span class="muted">(${T.pairs} pair${T.pairs === 1 ? '' : 's'} · ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'})</span></h1>
        <div class="cart-head-tools"><label class="switch"><input type="checkbox" data-act="auto" ${st.autoMerge ? 'checked' : ''}><span></span>Auto-merge same style</label><button class="link" data-act="clear">Clear bag</button></div></div>
      ${st.demo ? `<p class="demo-note">We pre-filled a demo bag — it contains two styles in more than one size so you can try merging. <button class="link" data-act="clear">Start empty</button></p>` : ''}
      <div class="cart-grid">
        <section>
          ${cands.length ? `<div class="merge-banner">
            <div class="mb-ico">${ICONS.merge}</div>
            <div class="mb-txt"><b>${cands.length} style${cands.length > 1 ? 's are' : ' is'} in your bag in more than one size.</b>
              <span>${cands.map((pid) => `${esc(productById[pid].name)} (${bag.sizesOf(pid).map((l) => esc(l.size)).join(' + ')})`).join(' · ')}. Merge them so each style is a single entry with a size breakdown.</span></div>
            <button class="btn btn-dark" data-act="mergeall">Merge all</button>
          </div>` : mergedCount ? `<div class="merge-banner ok"><div class="mb-ico">${ICONS.merge}</div><div class="mb-txt"><b>${mergedCount} merged entr${mergedCount > 1 ? 'ies' : 'y'}.</b><span>Sizes of the same style are grouped together. Identical items (same style and size) always combine into one quantity.</span></div><button class="btn btn-ghost" data-act="splitall">Split all</button></div>` : ''}
          <ul class="lines">${entries.map(lineHTML).join('')}</ul>
          <a class="link-arrow back" href="#/shop">Continue shopping</a>
        </section>
        <aside class="summary">
          <h3>Order summary</h3>
          <div class="sum-row"><span>Subtotal (${T.pairs} pairs)</span><span>${fmt(T.orig)}</span></div>
          ${T.savings ? `<div class="sum-row save"><span>Brand Week savings</span><span>−${fmt(T.savings)}</span></div>` : ''}
          <div class="sum-row"><span>Shipping</span><span>${ship ? fmt(ship) : 'Free'}</span></div>
          <div class="sum-row"><span>Estimated tax</span><span>${fmt(tax)}</span></div>
          <div class="sum-row total"><span>Total</span><span>${fmt(total)}</span></div>
          <a class="btn btn-primary btn-block btn-lg" href="#/checkout">Checkout</a>
          <div class="sum-inst">${ICONS.card}<span>or <b>4 × ${fmt(pi4.per)}</b> interest-free · monthly plans from 3 to 24 months at checkout</span></div>
          <p class="small muted">Free returns within 30 days. Order two sizes, send back the one that doesn’t fit.</p>
        </aside>
      </div>`;
    hydrate(box);
  };
  return {
    title: 'Your bag', html,
    mount(root) {
      render(root);
      const unsub = bag.subscribe(() => render(root));
      const act = (e) => {
        const t = e.target.closest('[data-act]');
        if (!t) return;
        const li = t.closest('[data-pid]');
        const pid = li?.dataset.pid;
        const size = t.closest('[data-size]')?.dataset.size;
        const a = t.dataset.act;
        const line = pid && size ? bag.sizesOf(pid).find((l) => l.size === size) : null;
        if (e.type === 'click') {
          if (a === 'inc' && line) bag.setQty(pid, size, line.qty + 1);
          if (a === 'dec' && line) bag.setQty(pid, size, line.qty - 1);
          if (a === 'remove' && line) bag.remove(pid, size);
          if (a === 'merge') { bag.merge(pid); toast(`<b>Merged</b> — ${esc(productById[pid].name)} is now one entry with ${bag.sizesOf(pid).length} sizes.`); }
          if (a === 'split') bag.split(pid);
          if (a === 'removestyle') bag.removeStyle(pid);
          if (a === 'mergeall') { const n = bag.mergeCandidates().length; bag.mergeAll(); toast(`<b>Merged ${n} style${n > 1 ? 's' : ''}</b> — each style now has a single entry.`); }
          if (a === 'splitall') bag.splitAll();
          if (a === 'clear') bag.clear();
          if (a === 'demo') bag.loadDemo();
        } else if (e.type === 'change') {
          if (a === 'size') bag.changeSize(pid, size, t.value);
          if (a === 'addsize' && t.value) bag.add(pid, t.value, 1);
          if (a === 'auto') bag.setAutoMerge(t.checked);
        }
      };
      root.addEventListener('click', act);
      root.addEventListener('change', act);
      return unsub;
    },
  };
}

// ================================================================== CHECKOUT
function checkoutPage() {
  const st = { plan: 'pi4', ship: 'standard', placing: false };
  const html = `<div class="wrap checkout" data-co></div>`;
  const render = (root) => {
    const box = $('[data-co]', root);
    const T = bag.totals();
    if (!T.pairs) { box.innerHTML = `<div class="empty-box big"><h1>Nothing to check out yet</h1><p>Your bag is empty.</p><div class="cta-row center"><a class="btn btn-primary" href="#/shop">Shop shoes</a><button class="btn btn-ghost" data-demo>Load demo bag</button></div></div>`; return; }
    const ship = shippingFor(T.sub, st.ship);
    const tax = Math.round(T.sub * TAX_RATE * 100) / 100;
    const total = Math.round((T.sub + ship + tax) * 100) / 100;
    const quotes = PLANS.map((pl) => planQuote(pl, total));
    let q = quotes.find((x) => x.plan.id === st.plan);
    if (!q.eligible) { st.plan = 'full'; q = quotes[0]; }
    const entries = bag.entries();
    const scheduleHTML = q.plan.kind === 'full' ? '' : `
      <div class="sched">
        <div class="sched-line">${q.schedule.map((s, i) => `<div class="sched-dot ${i === 0 ? 'today' : ''}" style="left:${q.n === 1 ? 0 : (i / (q.n - 1)) * 100}%"><i></i>${q.n <= 6 || i === 0 || i === q.n - 1 || (i % Math.ceil(q.n / 6) === 0 && q.n - 1 - i >= Math.ceil(q.n / 6)) ? `<span><b>${fmt(s.amount)}</b><small>${i === 0 ? 'Today' : s.due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(q.n > 12 ? { year: '2-digit' } : {}) })}</small></span>` : ''}</div>`).join('')}</div>
        <details class="sched-table" ${q.n <= 6 ? 'open' : ''}><summary>Full payment schedule (${q.n} installments)</summary>
          <table><thead><tr><th>#</th><th>Due</th><th>Payment</th><th>Interest</th><th>Remaining</th></tr></thead><tbody>
          ${q.schedule.map((s) => `<tr><td>${s.k}</td><td>${s.k === 1 ? 'Today' : s.due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><b>${fmt(s.amount)}</b></td><td>${fmt(s.interest)}</td><td>${fmt(s.balance)}</td></tr>`).join('')}
          </tbody></table></details>
        <div class="sched-sum"><span>APR <b>${q.plan.apr ? q.plan.apr.toFixed(2) + '%' : '0%'}</b></span><span>Interest <b>${fmt(q.interest)}</b></span><span>Total cost <b>${fmt(q.totalPaid)}</b></span><span>Due today <b>${fmt(q.first)}</b></span></div>
      </div>`;
    box.innerHTML = `
      <div class="co-head"><nav class="crumbs"><a href="#/cart">Bag</a><span>/</span><b>Checkout</b></nav><h1>Checkout</h1></div>
      <div class="co-grid">
        <form class="co-main" data-form novalidate>
          <section class="co-sec"><h3><span class="step">1</span>Shipping</h3>
            <div class="fields">
              <label class="fld w2"><span>Full name</span><input name="name" value="Alex Morgan" required autocomplete="name"></label>
              <label class="fld w2"><span>Email</span><input name="email" type="email" value="alex.morgan@example.com" required autocomplete="email"></label>
              <label class="fld w4"><span>Address</span><input name="addr" value="120 Market Street, Apt 5B" required autocomplete="street-address"></label>
              <label class="fld w2"><span>City</span><input name="city" value="San Francisco" required></label>
              <label class="fld"><span>State</span><input name="state" value="CA" required></label>
              <label class="fld"><span>ZIP</span><input name="zip" value="94105" required inputmode="numeric"></label>
            </div>
            <div class="ship-opts">
              ${[['standard', 'Standard', '3–5 business days', T.sub >= 75 ? 'Free' : fmt(6.95)], ['express', 'Express', 'Next business day', fmt(14)]].map(([id, l, d, pr]) => `<label class="opt ${st.ship === id ? 'on' : ''}"><input type="radio" name="ship" value="${id}" ${st.ship === id ? 'checked' : ''}><span class="opt-t"><b>${l}</b><small>${d}</small></span><span class="opt-p">${pr}</span></label>`).join('')}
            </div>
          </section>
          <section class="co-sec"><h3><span class="step">2</span>Payment plan</h3>
            <p class="muted small">Split your ${fmt(total)} order into installments. Amounts update live with your bag and shipping choice.</p>
            <div class="plans">
              ${quotes.map((x) => { const pl = x.plan; return `<label class="plan ${st.plan === pl.id ? 'on' : ''} ${x.eligible ? '' : 'off'}">
                <input type="radio" name="plan" value="${pl.id}" ${st.plan === pl.id ? 'checked' : ''} ${x.eligible ? '' : 'disabled'}>
                <span class="plan-t">${pl.label}${pl.apr === 0 && pl.kind !== 'full' ? '<em>0%</em>' : ''}</span>
                <span class="plan-amt">${pl.kind === 'full' ? `<b>${fmt(total)}</b><small>once</small>` : `<b>${fmt(x.per)}</b><small>× ${pl.n} ${pl.kind === 'biweekly' ? 'every 2 wks' : 'monthly'}</small>`}</span>
                <span class="plan-b">${x.eligible ? (pl.kind === 'full' ? pl.blurb : `${pl.blurb} · total ${fmt(x.totalPaid)}`) : `Available on orders over ${fmt(pl.min).replace('.00', '')}`}</span>
              </label>`; }).join('')}
            </div>
            ${scheduleHTML}
          </section>
          <section class="co-sec"><h3><span class="step">3</span>Card details</h3>
            <p class="muted small">Demo only — no real payment is taken. ${q.plan.kind === 'full' ? 'Your card is charged in full today.' : `Your card is charged ${fmt(q.first)} today, then automatically for each installment.`}</p>
            <div class="fields">
              <label class="fld w2"><span>Card number</span><input name="card" value="4242 4242 4242 4242" inputmode="numeric" required></label>
              <label class="fld"><span>Expiry</span><input name="exp" value="12 / 29" required></label>
              <label class="fld"><span>CVC</span><input name="cvc" value="123" inputmode="numeric" required></label>
            </div>
            <label class="check terms"><input type="checkbox" name="terms" checked> I agree to the ${q.plan.kind === 'full' ? 'terms of sale' : 'installment agreement and a soft credit check (no impact on your score)'}.</label>
          </section>
          <button class="btn btn-primary btn-lg btn-block place" data-place type="submit">${q.plan.kind === 'full' ? `Place order · ${fmt(total)}` : `Place order · pay ${fmt(q.first)} today`}</button>
          <p class="form-err" data-ferr hidden></p>
        </form>
        <aside class="summary co-sum">
          <h3>Your order</h3>
          <ul class="co-items">${entries.map((en) => { const p = productById[en.pid]; const pairs = en.lines.reduce((s, l) => s + l.qty, 0); return `<li><div class="co-img" style="--bg:${p.colors.bg}">${shoeImg(p)}<span>${pairs}</span></div><div class="co-it"><b>${esc(p.name)}</b><small>${esc(p.colorName)}</small><small>${en.lines.map((l) => `${esc(l.size)}${l.qty > 1 ? ` ×${l.qty}` : ''}`).join(' · ')}${en.type === 'merged' ? ' <em class="mini-tag">merged</em>' : ''}</small></div><div class="co-pr">${fmt(salePrice(p) * pairs)}</div></li>`; }).join('')}</ul>
          <div class="sum-row"><span>Subtotal</span><span>${fmt(T.orig)}</span></div>
          ${T.savings ? `<div class="sum-row save"><span>Brand Week savings</span><span>−${fmt(T.savings)}</span></div>` : ''}
          <div class="sum-row"><span>Shipping</span><span>${ship ? fmt(ship) : 'Free'}</span></div>
          <div class="sum-row"><span>Tax (${(TAX_RATE * 100).toFixed(2)}%)</span><span>${fmt(tax)}</span></div>
          <div class="sum-row total"><span>Total</span><span>${fmt(total)}</span></div>
          ${q.plan.kind !== 'full' ? `<div class="sum-plan"><span>${q.plan.label}</span><b>${fmt(q.per)} × ${q.n}</b><small>${q.interest ? `incl. ${fmt(q.interest)} interest` : 'no interest, no fees'}</small></div>` : ''}
        </aside>
      </div>`;
    hydrate(box);
    box._q = q; box._total = total; box._ship = ship; box._tax = tax;
  };
  return {
    title: 'Checkout', html,
    mount(root) {
      render(root);
      const unsub = bag.subscribe(() => render(root));
      root.addEventListener('change', (e) => {
        if (e.target.name === 'plan') { st.plan = e.target.value; const y = scrollY; render(root); window.scrollTo(0, y); }
        if (e.target.name === 'ship') { st.ship = e.target.value; const y = scrollY; render(root); window.scrollTo(0, y); }
      });
      root.addEventListener('click', (e) => { if (e.target.closest('[data-demo]')) bag.loadDemo(); });
      root.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target, box = $('[data-co]', root), err = $('[data-ferr]', root);
        const bad = [...f.querySelectorAll('input[required]')].filter((i) => !i.value.trim());
        f.querySelectorAll('.fld').forEach((l) => l.classList.remove('bad'));
        if (bad.length || !f.terms.checked) {
          bad.forEach((i) => i.closest('.fld').classList.add('bad'));
          err.textContent = bad.length ? 'Please fill in the highlighted fields.' : 'Please accept the terms to continue.'; err.hidden = false; return;
        }
        const btn = $('[data-place]', root); btn.disabled = true; btn.innerHTML = '<span class="spinner light"></span> Processing…';
        const q = box._q;
        const order = {
          id: 'PR-' + Math.floor(100000 + Math.random() * 899999), date: Date.now(), name: f.name.value, email: f.email.value,
          addr: `${f.addr.value}, ${f.city.value}, ${f.state.value} ${f.zip.value}`, ship: st.ship, total: box._total,
          plan: { id: q.plan.id, label: q.plan.label, kind: q.plan.kind, n: q.n, per: q.per, apr: q.plan.apr, interest: q.interest, totalPaid: q.totalPaid, schedule: q.schedule.map((s) => ({ ...s, due: s.due.getTime() })) },
          entries: bag.entries().map((en) => ({ pid: en.pid, type: en.type, lines: en.lines.map((l) => ({ size: l.size, qty: l.qty })) })),
          card: f.card.value.replace(/\s/g, '').slice(-4),
        };
        try { sessionStorage.setItem('pairs.order.' + order.id, JSON.stringify(order)); } catch (_) { /* ignore */ }
        setTimeout(() => { bag.clear(); location.hash = `#/order/${order.id}`; }, 900);
      });
      return unsub;
    },
  };
}

// ================================================================== ORDER CONFIRMATION
function orderPage(id) {
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem('pairs.order.' + id)); } catch (_) { /* ignore */ }
  if (!o) return { title: 'Order', html: `<div class="wrap empty-box big"><h1>Order not found</h1><p>Orders are kept for this browser session only.</p><a class="btn btn-primary" href="#/">Back home</a></div>` };
  const pl = o.plan;
  const html = `<div class="wrap order">
    <div class="order-hero"><div class="ok-mark">✓</div><div><div class="eyebrow">Order ${esc(o.id)} confirmed</div><h1>Thanks, ${esc(o.name.split(' ')[0])}! Your pairs are on the way.</h1>
      <p class="muted">Confirmation sent to ${esc(o.email)} · shipping ${o.ship === 'express' ? 'Express (next business day)' : 'Standard (3–5 business days)'} to ${esc(o.addr)}</p></div></div>
    <div class="order-grid">
      <section class="co-sec">
        <h3>${pl.kind === 'full' ? 'Paid in full' : `${esc(pl.label)} plan`}</h3>
        ${pl.kind === 'full' ? `<p class="big">${fmt(o.total)} charged to card ending ${esc(o.card)}.</p>` : `
          <p class="big"><b>${fmt(pl.per)}</b> × ${pl.n} ${pl.kind === 'biweekly' ? 'every two weeks' : 'monthly'} · card ending ${esc(o.card)}</p>
          <table class="sched-mini"><thead><tr><th>#</th><th>Due</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            ${pl.schedule.map((s, i) => `<tr><td>${s.k}</td><td>${new Date(s.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>${fmt(s.amount)}</td><td>${i === 0 ? '<span class="paid">Paid today</span>' : '<span class="muted">Scheduled</span>'}</td></tr>`).join('')}
          </tbody></table>
          <p class="small muted">APR ${pl.apr ? pl.apr.toFixed(2) + '%' : '0%'} · interest ${fmt(pl.interest)} · total ${fmt(pl.totalPaid)}</p>`}
      </section>
      <aside class="summary"><h3>Items</h3><ul class="co-items">${o.entries.map((en) => { const p = productById[en.pid]; const pairs = en.lines.reduce((s, l) => s + l.qty, 0); return `<li><div class="co-img" style="--bg:${p.colors.bg}">${shoeImg(p)}<span>${pairs}</span></div><div class="co-it"><b>${esc(p.name)}</b><small>${esc(p.colorName)}</small><small>${en.lines.map((l) => `${esc(l.size)}${l.qty > 1 ? ` ×${l.qty}` : ''}`).join(' · ')}</small></div><div class="co-pr">${fmt(salePrice(p) * pairs)}</div></li>`; }).join('')}</ul>
        <div class="sum-row total"><span>Order total</span><span>${fmt(o.total)}</span></div>
        <a class="btn btn-primary btn-block" href="#/shop">Continue shopping</a></aside>
    </div></div>`;
  return { title: 'Order confirmed', html };
}

// ================================================================== SIZE ASSISTANT (modal)
function openSizeAssistant({ brand, gender, tab } = {}) {
  const fit = fitPrefs.get();
  const st = {
    tab: tab || 'charts',
    brand: brandById[brand] ? brand : 'velox',
    gender: gender || 'men',
    fromBrand: 'velox', fromGender: 'men', fromSize: 'US 9',
    foot: fit.foot || 26.5, pref: fit.pref || 0, footGender: fit.gender || 'men',
  };
  const fixGender = () => { const gs = chartGenders(st.brand); if (!gs.includes(st.gender)) st.gender = gs[0]; };
  fixGender();
  const root = $('#modal-root');
  const lastFocus = document.activeElement;
  root.innerHTML = `<div class="modal-back" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sa-title">
      <header class="modal-h"><div><div class="eyebrow">Fit tools</div><h2 id="sa-title">Size Assistant</h2></div><button class="icon-btn" data-close aria-label="Close">×</button></header>
      <div class="sa-tabs" role="tablist">
        ${[['charts', 'Brand size charts'], ['convert', 'Convert between brands'], ['measure', 'Measure your foot']].map(([k, l]) => `<button role="tab" data-satab="${k}">${l}</button>`).join('')}
      </div>
      <div class="sa-body" data-sabody></div>
    </div>`;
  document.body.classList.add('modal-open');
  const body = $('[data-sabody]', root);
  const colLabel = { us: 'US', uk: 'UK', eu: 'EU', cm: 'CM' };
  const render = () => {
    $$('[data-satab]', root).forEach((b) => b.setAttribute('aria-selected', b.dataset.satab === st.tab));
    if (st.tab === 'charts') {
      const B = brandById[st.brand], C = CHARTS[B.chart];
      const rows = C[st.gender];
      const you = fit.foot ? recommend(rows, fit.foot, fit.pref || 0, B.offset || 0) : null;
      const showJP = B.chart === 'jp';
      body.innerHTML = `<div class="sa-charts">
        <div class="sa-brands">${BRANDS.map((b) => `<button class="sa-brand ${b.id === st.brand ? 'on' : ''}" data-brand="${b.id}" style="--bc:${b.color}">${logoSVG(b.id, b.color, 20)}<span><b>${esc(b.name)}</b><small>${CHARTS[b.chart].system} sizing${b.sale ? ` · −${b.sale}%` : ''}</small></span></button>`).join('')}</div>
        <div class="sa-table-wrap">
          <div class="sa-table-head">
            <div><h3>${esc(B.name)} size conversion</h3><p class="muted small">${esc(C.note)}</p></div>
            <div class="seg">${chartGenders(B.id).map((g) => `<button data-g="${g}" class="${g === st.gender ? 'on' : ''}">${GENDER_LABEL[g]}${B.chart === 'unisex' ? ' (unisex)' : ''}</button>`).join('')}</div>
          </div>
          <div class="sa-scroll"><table class="sa-table">
            <thead><tr><th>${esc(B.name)} label</th><th>US</th><th>UK</th><th>EU</th><th>Foot (cm)</th>${showJP ? '<th>JP (mm)</th>' : ''}</tr></thead>
            <tbody>${rows.map((r) => `<tr class="${you && you.label === r.label ? 'you' : ''}"><td><b>${esc(r.label)}</b>${you && you.label === r.label ? '<em>your fit</em>' : ''}</td><td>${esc(r.us)}</td><td>${esc(r.uk)}</td><td>${esc(r.eu)}</td><td>${r.cm}</td>${showJP ? `<td>${Math.round(r.cm * 10)}</td>` : ''}</tr>`).join('')}</tbody>
          </table></div>
          <p class="fit-note"><b>Fit advice:</b> ${esc(B.fit)}</p>
          ${fit.foot ? `<p class="small muted">Highlighted row uses your saved foot length of ${fit.foot} cm. <button class="link" data-satab="measure">Change</button></p>` : `<p class="small muted">Know your foot length? <button class="link" data-satab="measure">Measure it</button> and we’ll highlight your size in every chart.</p>`}
        </div></div>`;
    } else if (st.tab === 'convert') {
      const fromRows = CHARTS[brandById[st.fromBrand].chart][st.fromGender] || chartFor(st.fromBrand, st.fromGender);
      if (!fromRows.some((r) => r.label === st.fromSize)) st.fromSize = fromRows[Math.min(fromRows.length - 1, Math.floor(fromRows.length / 2))].label;
      const row = fromRows.find((r) => r.label === st.fromSize);
      const cm = row.cm;
      const targets = BRANDS.filter((b) => chartGenders(b.id).includes(st.fromGender) || (b.chart === 'unisex' && st.fromGender !== 'kids'));
      body.innerHTML = `<div class="sa-convert">
        <div class="conv-form">
          <span>I wear</span>
          <select data-f="fromBrand">${BRANDS.map((b) => `<option value="${b.id}" ${b.id === st.fromBrand ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
          <select data-f="fromGender">${chartGenders(st.fromBrand).map((g) => `<option value="${g}" ${g === st.fromGender ? 'selected' : ''}>${GENDER_LABEL[g]}</option>`).join('')}</select>
          <span>size</span>
          <select data-f="fromSize">${fromRows.map((r) => `<option ${r.label === st.fromSize ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select>
        </div>
        <p class="conv-lede">That size fits a foot about <b>${cm} cm</b> long. Here is the matching size in every brand:</p>
        <div class="sa-scroll"><table class="sa-table conv">
          <thead><tr><th>Brand</th><th>Buy this size</th><th>US</th><th>UK</th><th>EU</th><th>cm</th><th>Fit note</th></tr></thead>
          <tbody>${targets.map((b) => { const rows = chartFor(b.id, st.fromGender === 'kids' ? 'kids' : st.fromGender); const same = b.id === st.fromBrand; const m = same ? row : recommend(rows, cm - 0.2, 0, (b.offset || 0) - (brandById[st.fromBrand].offset || 0)); return `<tr class="${same ? 'you' : ''}"><td><span class="tb">${logoSVG(b.id, b.color, 16)}${esc(b.name)}</span></td><td><b>${esc(m.label)}</b>${same ? '<em>your size</em>' : ''}</td><td>${esc(m.us)}</td><td>${esc(m.uk)}</td><td>${esc(m.eu)}</td><td>${m.cm}</td><td class="small">${esc(b.fit)}</td></tr>`; }).join('')}</tbody>
        </table></div>
        <div class="conv-actions"><button class="btn btn-dark btn-sm" data-savefoot="${cm}">Save ${cm} cm as my foot length</button><span class="muted small">Saved sizes are highlighted on product pages.</span></div>
      </div>`;
    } else {
      const res = BRANDS.map((b) => { const g = chartGenders(b.id).includes(st.footGender) ? st.footGender : b.chart === 'unisex' && st.footGender !== 'kids' ? 'men' : null; if (!g) return null; const rows = chartFor(b.id, g); return { b, r: recommend(rows, st.foot, st.pref, b.offset || 0), rows }; }).filter(Boolean);
      body.innerHTML = `<div class="sa-measure">
        <div class="measure-how">
          <svg viewBox="0 0 220 170" class="foot-svg" aria-hidden="true">
            <rect x="8" y="10" width="120" height="150" rx="4" fill="#fff" stroke="#d8d2c8"/>
            <rect x="0" y="4" width="136" height="6" fill="#bfb6a8"/>
            <path d="M68 150c-18 0-26-14-26-34 0-18 4-30 6-44 3-22 2-40 18-48 12-6 26 2 28 18 2 12-2 24 0 38 2 16 10 26 8 44-2 18-14 26-34 26z" fill="#f1c9a8" stroke="#c99a7a" stroke-width="1.5"/>
            <g fill="#f1c9a8" stroke="#c99a7a" stroke-width="1.2"><circle cx="64" cy="20" r="7"/><circle cx="78" cy="22" r="5.5"/><circle cx="88" cy="27" r="4.6"/><circle cx="95" cy="34" r="4"/><circle cx="100" cy="42" r="3.4"/></g>
            <path d="M146 10v150" stroke="#ff4f1f" stroke-width="2"/><path d="m140 18 6-8 6 8M140 152l6 8 6-8" fill="none" stroke="#ff4f1f" stroke-width="2"/>
            <text x="154" y="86" fill="#16161a" font-size="15" font-weight="800" font-family="system-ui,sans-serif">${st.foot} cm</text>
            <text x="154" y="102" fill="#7a7a82" font-size="9.5" font-family="system-ui,sans-serif">heel to</text>
            <text x="154" y="114" fill="#7a7a82" font-size="9.5" font-family="system-ui,sans-serif">longest toe</text>
          </svg>
          <ol class="steps-list"><li>Put a sheet of paper on the floor against a wall.</li><li>Stand on it with your heel touching the wall.</li><li>Mark the tip of your longest toe and measure in cm.</li><li>Measure both feet in the evening; use the longer one.</li></ol>
        </div>
        <div class="measure-in">
          <label class="fld"><span>Foot length</span><div class="len"><input type="range" min="15" max="31.5" step="0.1" value="${st.foot}" data-foot><output data-footout>${st.foot.toFixed(1)} cm</output></div></label>
          <div class="seg-row"><span>Sizing for</span><div class="seg">${['men', 'women', 'kids'].map((g) => `<button data-fg="${g}" class="${g === st.footGender ? 'on' : ''}">${GENDER_LABEL[g]}</button>`).join('')}</div></div>
          <div class="seg-row"><span>I like my shoes</span><div class="seg">${[[-1, 'Snug'], [0, 'Regular'], [1, 'Roomy']].map(([v, l]) => `<button data-pref="${v}" class="${v === st.pref ? 'on' : ''}">${l}</button>`).join('')}</div></div>
          <div class="rec-grid">${res.map(({ b, r }) => `<div class="rec-card" style="--bc:${b.color}"><div class="rc-h">${logoSVG(b.id, b.color, 16)}${esc(b.name)}</div><div class="rc-size">${r ? esc(r.label) : '—'}</div><div class="rc-sub">${r ? `US ${esc(r.us)} · UK ${esc(r.uk)} · EU ${esc(r.eu)}` : 'No size in range'}</div></div>`).join('') || '<p class="muted">No brand carries this size range.</p>'}</div>
          <div class="conv-actions"><button class="btn btn-primary btn-sm" data-savefoot="${st.foot}">Save my fit</button><span class="muted small" data-saved>${fit.foot ? `Saved: ${fit.foot} cm (${GENDER_LABEL[fit.gender || 'men']})` : 'Not saved yet'}</span></div>
        </div></div>`;
    }
  };
  const close = () => {
    root.innerHTML = ''; document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.onclick = (e) => {
    const t = e.target.closest('[data-close],[data-satab],[data-brand],[data-g],[data-fg],[data-pref],[data-savefoot]');
    if (!t) return;
    if (t.dataset.close !== undefined) return close();
    if (t.dataset.satab) st.tab = t.dataset.satab;
    if (t.dataset.brand) { st.brand = t.dataset.brand; fixGender(); }
    if (t.dataset.g) st.gender = t.dataset.g;
    if (t.dataset.fg) st.footGender = t.dataset.fg;
    if (t.dataset.pref) st.pref = +t.dataset.pref;
    if (t.dataset.savefoot) {
      const v = +t.dataset.savefoot;
      fitPrefs.set({ foot: v, pref: st.pref, gender: st.tab === 'convert' ? st.fromGender : st.footGender });
      Object.assign(fit, fitPrefs.get());
      st.foot = v;
      toast(`<b>Fit saved</b> — ${v} cm. We’ll highlight your size on every product page.`, { tone: 'ok' });
      if (location.hash.startsWith('#/product/')) route();
    }
    render();
  };
  root.oninput = (e) => {
    if (e.target.matches('[data-foot]')) {
      st.foot = Math.round(+e.target.value * 10) / 10;
      $('[data-footout]', root).textContent = `${st.foot.toFixed(1)} cm`;
      clearTimeout(root._t); root._t = setTimeout(() => { const y = body.scrollTop; render(); body.scrollTop = y; const r = $('[data-foot]', root); if (r) r.focus(); }, 120);
    }
  };
  root.onchange = (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    st[f] = e.target.value;
    if (f === 'fromBrand') { const gs = chartGenders(st.fromBrand); if (!gs.includes(st.fromGender)) st.fromGender = gs[0]; }
    render();
  };
  render();
  $('.modal', root).focus?.();
  setTimeout(() => $('[data-close].icon-btn', root)?.focus(), 30);
}
window.__openSizeAssistant = openSizeAssistant;

// ------------------------------------------------------------------ boot
updateBagCount(false);
if (!location.hash) history.replaceState(null, '', '#/');
route();
// warm the 3D module in the background so the first product page opens fast
setTimeout(() => { r3d(); }, 400);

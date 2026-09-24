import { qs, qsa, clamp, money, emit, on, storage, toast, tweenMoney, openDialog, closeDialog, observe, addBusinessDays, formatDay } from './core.js';

export const CATALOG = {
  hush: { name: 'Hush One', price: 299, launch: 239 },
  case: { name: 'Hard Travel Case', price: 39, img: 'img/acc-case.webp', desc: 'Crush-proof shell' },
  dock: { name: 'Charging Dock', price: 49, img: 'img/acc-dock.webp', desc: 'Weighted aluminium stand' },
  care: { name: 'Hush Care+ (3 years)', price: 29, img: 'img/care.svg', desc: 'Accidental damage cover' },
  buds: { name: 'Hush Buds', price: 149, img: 'img/acc-buds.webp', desc: 'Wireless ANC earbuds' },
  cushions: { name: 'Spare Cushions', price: 29, img: 'img/acc-cushions.webp', desc: 'Magnetic memory foam' },
  cable: { name: 'Braided USB-C Cable', price: 19, img: 'img/acc-cable.webp', desc: '1.5 m, lossless audio' },
};
export const FINISH_LABEL = { carbon: 'Carbon', graphite: 'Graphite', chalk: 'Chalk' };
export const CUSHION_LABEL = { leather: 'Protein leather', knit: 'Breathable knit' };
const OPTION_PRICE = { knit: 15, engraving: 15 };
const BUNDLE_PRICE = { case: 29, cable: 14 };
const CODES = {
  STAY10: { rate: 0.1, label: 'STAY10' },
  FOCUS10: { rate: 0.1, label: 'FOCUS10', accessoriesOnly: true },
};
const TAX_RATE = 0.08;
const FREE_EXPRESS = 300;
const round = (n) => Math.round(n * 100) / 100;
const multiRate = (q) => (q >= 3 ? 0.1 : q === 2 ? 0.05 : 0);

let config = { finish: 'carbon', cushion: 'leather', engraving: '', addons: [], qty: 1, tradein: 0, plan: 'full' };
export const getConfig = () => ({ ...config, addons: [...config.addons] });

let cart = storage.get('cart', { items: [], credit: 0 });
if (!cart || !Array.isArray(cart.items)) cart = { items: [], credit: 0 };

/* ---------- pricing ---------- */
export function unitPrice(cfg = config) {
  return CATALOG.hush.launch + (cfg.cushion === 'knit' ? OPTION_PRICE.knit : 0) + (cfg.engraving ? OPTION_PRICE.engraving : 0);
}

export function quote(cfg = config) {
  const q = cfg.qty;
  const lines = [{ label: `Hush One${q > 1 ? ` × ${q}` : ''}`, amount: CATALOG.hush.price * q }];
  lines.push({ label: 'Launch offer −20%', amount: -(CATALOG.hush.price - CATALOG.hush.launch) * q, credit: true });
  if (cfg.cushion === 'knit') lines.push({ label: 'Breathable knit cushions', amount: OPTION_PRICE.knit * q });
  if (cfg.engraving) lines.push({ label: 'Personal engraving', amount: OPTION_PRICE.engraving * q });
  const rate = multiRate(q);
  if (rate) lines.push({ label: `Multi-buy −${Math.round(rate * 100)}%`, amount: -round(unitPrice(cfg) * q * rate), credit: true });
  cfg.addons.forEach((a) => lines.push({ label: CATALOG[a].name, amount: CATALOG[a].price }));
  if (cfg.tradein) lines.push({ label: 'Trade-in credit', amount: -cfg.tradein, credit: true });
  const total = Math.max(0, round(lines.reduce((s, l) => s + l.amount, 0)));
  const saved = round(-lines.filter((l) => l.credit).reduce((s, l) => s + l.amount, 0));
  return { lines, total, saved, monthly: round(total / 12) };
}

export function cartTotals({ code = null, shipping = 'standard' } = {}) {
  const items = cart.items;
  const subtotal = round(items.reduce((s, i) => s + i.unit * i.qty, 0));
  const hush = items.filter((i) => i.id === 'hush');
  const hushQty = hush.reduce((s, i) => s + i.qty, 0);
  const multi = round(hush.reduce((s, i) => s + i.unit * i.qty, 0) * multiRate(hushQty));
  const credit = hushQty ? Math.min(cart.credit || 0, subtotal - multi) : 0;
  const itemsTotal = round(subtotal - multi - credit);
  let discount = 0;
  if (code && CODES[code]) {
    const def = CODES[code];
    const base = def.accessoriesOnly ? items.filter((i) => i.id !== 'hush').reduce((s, i) => s + i.unit * i.qty, 0) : itemsTotal;
    discount = round(base * def.rate);
  }
  const ship = shipping === 'express' ? (itemsTotal >= FREE_EXPRESS ? 0 : 12) : 0;
  const taxable = Math.max(0, itemsTotal - discount);
  const tax = round(taxable * TAX_RATE);
  return {
    subtotal, multi, credit, discount, ship, tax, itemsTotal,
    total: round(taxable + ship + tax),
    count: items.reduce((s, i) => s + i.qty, 0),
  };
}

/* ---------- cart ---------- */
function variantOf(cfg) {
  return [FINISH_LABEL[cfg.finish], CUSHION_LABEL[cfg.cushion], cfg.engraving ? `Engraved “${cfg.engraving}”` : ''].filter(Boolean).join(' · ');
}
function hushItem(cfg, qty = 1) {
  return {
    key: `hush|${cfg.finish}|${cfg.cushion}|${cfg.engraving}`,
    id: 'hush', name: 'Hush One', variant: variantOf(cfg), unit: unitPrice(cfg), qty, img: `img/finish-${cfg.finish}.webp`,
  };
}
function productItem(id, unit = CATALOG[id].price, variant = CATALOG[id].desc) {
  return { key: `${id}|${unit}`, id, name: CATALOG[id].name, variant, unit, qty: 1, img: CATALOG[id].img };
}
function saveCart() {
  if (!cart.items.some((i) => i.id === 'hush')) cart.credit = 0;
  storage.set('cart', cart);
  renderCart();
  emit('cart', { count: cartTotals().count });
}
function addItem(item) {
  const existing = cart.items.find((i) => i.key === item.key);
  if (existing) existing.qty = Math.min(10, existing.qty + item.qty);
  else cart.items.push(item);
}
function bumpBadge() {
  qsa('[data-cart-count]').forEach((b) => {
    b.classList.remove('bump');
    void b.offsetWidth;
    b.classList.add('bump');
  });
}
export function addHush(cfg = config, qty = 1) {
  addItem(hushItem(cfg, qty));
  saveCart();
  bumpBadge();
}
export function addProduct(id) {
  addItem(productItem(id));
  saveCart();
  bumpBadge();
}
export function openCart(opener) {
  renderCart();
  openDialog(qs('#cart-drawer'), opener);
}

function renderCart() {
  const drawer = qs('#cart-drawer');
  const list = qs('[data-cart-items]');
  const t = cartTotals();
  drawer.classList.toggle('is-empty', cart.items.length === 0);
  list.textContent = '';
  cart.items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.dataset.key = item.key;
    li.innerHTML = `
      <img src="${item.img}" width="72" height="72" alt="" decoding="async">
      <div>
        <p class="ci-name"></p><p class="ci-variant"></p>
        <div class="ci-controls">
          <div class="mini-stepper" role="group">
            <button type="button" data-dec><svg class="i"><use href="#i-minus"/></svg></button>
            <span>${item.qty}</span>
            <button type="button" data-inc><svg class="i"><use href="#i-plus"/></svg></button>
          </div>
          <button type="button" class="ci-remove" data-remove><svg class="i"><use href="#i-trash"/></svg></button>
        </div>
      </div>
      <p class="ci-price">${money(item.unit * item.qty)}</p>`;
    qs('.ci-name', li).textContent = item.name;
    qs('.ci-variant', li).textContent = item.variant;
    qs('.mini-stepper', li).setAttribute('aria-label', `Quantity of ${item.name}`);
    qs('[data-dec]', li).setAttribute('aria-label', `Decrease quantity of ${item.name}`);
    qs('[data-inc]', li).setAttribute('aria-label', `Increase quantity of ${item.name}`);
    qs('[data-remove]', li).setAttribute('aria-label', `Remove ${item.name} from bag`);
    list.appendChild(li);
  });
  const adjust = qs('[data-cart-adjust]');
  adjust.textContent = '';
  const addRow = (label, value) => {
    const row = document.createElement('div');
    row.className = 'row adj';
    row.innerHTML = '<span></span><span></span>';
    row.firstChild.textContent = label;
    row.lastChild.textContent = money(-value);
    adjust.appendChild(row);
  };
  if (t.multi) addRow('Multi-buy savings', t.multi);
  if (t.credit) addRow('Trade-in credit', t.credit);
  qs('[data-cart-subtotal]').textContent = money(t.itemsTotal);
  const meter = qs('[data-ship-meter]');
  const left = FREE_EXPRESS - t.itemsTotal;
  qs('[data-ship-text]', meter).textContent = left > 0
    ? `Free 2-day shipping included. Add ${money(left)} more for free next-day express.`
    : 'You’ve unlocked free next-day express shipping.';
  qs('.ship-bar', meter).style.setProperty('--p', `${clamp(t.itemsTotal / FREE_EXPRESS, 0, 1) * 100}%`);
  qsa('[data-cart-count]').forEach((b) => {
    b.textContent = t.count;
    b.hidden = t.count === 0;
  });
  qs('#cart-btn').setAttribute('aria-label', `Open bag (${t.count} item${t.count === 1 ? '' : 's'})`);
  journey(t.count ? 'bag' : 'build');
}

function initCartDrawer() {
  const drawer = qs('#cart-drawer');
  const foot = qs('.drawer-foot', drawer);
  const adjust = document.createElement('div');
  adjust.dataset.cartAdjust = '';
  adjust.className = 'cart-adjust';
  foot.prepend(adjust);
  qs('[data-cart-items]').addEventListener('click', (e) => {
    const li = e.target.closest('.cart-item');
    if (!li) return;
    const item = cart.items.find((i) => i.key === li.dataset.key);
    if (!item) return;
    if (e.target.closest('[data-inc]')) item.qty = Math.min(10, item.qty + 1);
    else if (e.target.closest('[data-dec]')) item.qty -= 1;
    else if (e.target.closest('[data-remove]')) item.qty = 0;
    else return;
    const removed = item.qty <= 0;
    if (removed) cart.items = cart.items.filter((i) => i !== item);
    saveCart();
    if (removed) {
      toast(`${item.name} removed`, 'trash');
      const btn = qs('[data-cart-items] button') || qs('[data-close]', drawer);
      btn.focus();
    } else {
      const again = qs(`.cart-item[data-key="${CSS.escape(item.key)}"] ${e.target.closest('[data-inc]') ? '[data-inc]' : '[data-dec]'}`);
      if (again) again.focus();
    }
  });
  qsa('[data-open-cart]').forEach((b) => b.addEventListener('click', () => openCart(b)));
  on('cart:open', () => openCart());
  renderCart();
}

/* ---------- purchase journey indicator ---------- */
function journey(stage) {
  const idx = { build: 0, bag: 1, checkout: 2, delivered: 3 }[stage] ?? 0;
  qsa('.journey li').forEach((li, i) => {
    li.classList.toggle('is-done', i < idx);
    li.classList.toggle('is-current', i === idx);
    if (i === idx) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  });
}

/* ---------- configurator + dynamic pricing ---------- */
function sanitizeEngraving(v) {
  return (v || '').replace(/[^\p{L}\p{N} .'&-]/gu, '').slice(0, 14);
}

function syncForm() {
  const form = qs('#configurator');
  form.elements.finish.value = config.finish;
  form.elements.cushion.value = config.cushion;
  form.elements.engraving.value = config.engraving;
  qsa('input[name="addon"]', form).forEach((c) => {
    c.checked = config.addons.includes(c.value);
  });
  form.elements.qty.value = config.qty;
  form.elements.tradein.value = String(config.tradein);
  form.elements.plan.value = config.plan;
}

function readForm() {
  const form = qs('#configurator');
  const fd = new FormData(form);
  config.finish = fd.get('finish') || 'carbon';
  config.cushion = fd.get('cushion') || 'leather';
  config.engraving = sanitizeEngraving(fd.get('engraving')).trim();
  config.addons = fd.getAll('addon');
  config.qty = clamp(parseInt(fd.get('qty'), 10) || 1, 1, 10);
  config.tradein = Number(fd.get('tradein')) || 0;
  config.plan = fd.get('plan') || 'full';
}

function renderQuote() {
  const q = quote();
  const list = qs('[data-price-lines]');
  list.textContent = '';
  q.lines.forEach((l) => {
    const li = document.createElement('li');
    if (l.credit) li.className = 'credit';
    li.innerHTML = '<span></span><span></span>';
    li.firstChild.textContent = l.label;
    li.lastChild.textContent = money(l.amount);
    list.appendChild(li);
  });
  const totalEl = qs('[data-total]');
  const sub = qs('[data-price-sub]');
  if (config.plan === 'monthly') {
    tweenMoney(totalEl, q.monthly, (v) => `${money(v, { cents: true })}/mo`);
    sub.textContent = `12 payments at 0% APR · ${money(q.total)} total`;
  } else {
    tweenMoney(totalEl, q.total, (v) => money(v));
    sub.textContent = q.saved > 0 ? `You save ${money(q.saved)} today` : 'Free 2-day shipping included';
  }
  qs('[data-total-inline]').textContent = money(q.total);
  qs('[data-finish-label]').textContent = FINISH_LABEL[config.finish];
  qs('[data-engrave-count]').textContent = `${config.engraving.length}/14`;

  const unit = unitPrice();
  const bar = qs('[data-sticky-cart]');
  qs('[data-sc-variant]', bar).textContent = variantOf(config);
  qs('[data-price-now]', bar).textContent = money(unit);
  qs('[data-price-was]', bar).textContent = money(unit + (CATALOG.hush.price - CATALOG.hush.launch));
  const img = `img/finish-${config.finish}.webp`;
  qsa('[data-sc-thumb], [data-viewer-poster]').forEach((el) => {
    if (!el.getAttribute('src').endsWith(img)) el.setAttribute('src', img);
  });
}

function update() {
  storage.set('config', config);
  renderQuote();
  emit('config', getConfig());
}

export function applyConfig(partial) {
  config = { ...config, ...partial, addons: partial.addons ? [...partial.addons] : config.addons };
  syncForm();
  readForm();
  update();
}

function flashAdded(btn) {
  btn.classList.add('is-added');
  clearTimeout(btn._t);
  btn._t = setTimeout(() => btn.classList.remove('is-added'), 1800);
}

function initConfigurator() {
  const form = qs('#configurator');
  const saved = storage.get('config', null);
  if (saved && typeof saved === 'object') {
    config = { ...config, ...saved, addons: Array.isArray(saved.addons) ? saved.addons.filter((a) => CATALOG[a]) : [] };
    if (!FINISH_LABEL[config.finish]) config.finish = 'carbon';
    syncForm();
  }
  readForm();
  const onChange = (e) => {
    if (e.target.name === 'engraving') {
      const clean = sanitizeEngraving(e.target.value);
      if (clean !== e.target.value) e.target.value = clean;
    }
    readForm();
    update();
  };
  form.addEventListener('input', onChange);
  form.addEventListener('change', onChange);
  qsa('[data-stepper] .step-btn', form).forEach((b) => b.addEventListener('click', () => {
    const input = form.elements.qty;
    input.value = clamp((parseInt(input.value, 10) || 1) + Number(b.dataset.step), 1, 10);
    readForm();
    update();
  }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = qs('#add-main');
    addItem(hushItem(config, config.qty));
    config.addons.forEach((a) => addItem(productItem(a)));
    if (config.tradein) cart.credit = config.tradein;
    saveCart();
    bumpBadge();
    flashAdded(btn);
    toast(`Hush One in ${FINISH_LABEL[config.finish]} added to your bag`, 'bag');
    setTimeout(() => openCart(btn), 700);
  });
  update();
}

/* ---------- sticky add-to-cart bar + floating CTA ---------- */
function initStickyBars() {
  const bar = qs('[data-sticky-cart]');
  const float = qs('[data-float-cta]');
  const state = { hero: true, buy: false, footer: false, offer: false, dialog: false, scrolled: false };
  const sync = () => {
    const showBar = !state.hero && !state.buy && !state.footer && !state.dialog;
    bar.classList.toggle('is-visible', showBar);
    bar.inert = !showBar;
    document.body.classList.toggle('has-sticky', showBar);
    const showFloat = state.scrolled && !state.offer && !state.buy && !state.footer && !state.dialog;
    float.classList.toggle('is-visible', showFloat);
    float.inert = !showFloat;
  };
  bar.inert = true;
  float.inert = true;
  observe([qs('#hero-cta')], (e) => {
    state.hero = e.isIntersecting || e.boundingClientRect.top > 0;
    sync();
  }, { threshold: 0 });
  observe([qs('.showcase-layout')], (e) => {
    state.buy = e.isIntersecting;
    sync();
  }, { threshold: 0, rootMargin: '-35% 0px -35% 0px' });
  observe([qs('.site-footer')], (e) => {
    state.footer = e.isIntersecting;
    sync();
  }, { threshold: 0 });
  observe([qs('#offer')], (e) => {
    state.offer = e.isIntersecting;
    sync();
  }, { threshold: 0.1 });
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const s = scrollY > innerHeight * 1.3;
      if (s !== state.scrolled) {
        state.scrolled = s;
        sync();
      }
    });
  }, { passive: true });
  on('dialog', () => {
    state.dialog = !!document.querySelector('dialog[open]');
    sync();
  });
  qs('[data-quick-add]', bar).addEventListener('click', (e) => {
    addHush(config, 1);
    flashAdded(e.currentTarget);
    toast(`Hush One in ${FINISH_LABEL[config.finish]} added to your bag`, 'bag');
  });
}

/* ---------- related products + bundle ---------- */
function initAccessories() {
  qsa('[data-add]').forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.add;
    addProduct(id);
    btn.classList.add('is-added');
    const label = btn.getAttribute('aria-label');
    btn.setAttribute('aria-label', `${CATALOG[id].name} added to bag`);
    toast(`${CATALOG[id].name} added to your bag`, 'bag');
    setTimeout(() => {
      btn.classList.remove('is-added');
      btn.setAttribute('aria-label', label);
    }, 2000);
  }));
  const list = qs('[data-acc-list]');
  const scrollByCard = (dir) => {
    const card = qs('.acc-card', list);
    list.scrollBy({ left: dir * (card.getBoundingClientRect().width + 20), behavior: 'smooth' });
  };
  qs('[data-acc-prev]').addEventListener('click', () => scrollByCard(-1));
  qs('[data-acc-next]').addEventListener('click', () => scrollByCard(1));

  const bundle = qs('[data-bundle]');
  const boxes = qsa('[data-bundle-item]', bundle);
  const addBtn = qs('[data-bundle-add]', bundle);
  const render = () => {
    let total = CATALOG.hush.launch;
    let saved = 0;
    boxes.forEach((b) => {
      const id = b.dataset.bundleItem;
      if (id === 'hush' || !b.checked) return;
      total += BUNDLE_PRICE[id];
      saved += CATALOG[id].price - BUNDLE_PRICE[id];
    });
    qs('[data-bundle-total]', bundle).textContent = money(total);
    qs('[data-bundle-save]', bundle).textContent = saved ? `You save ${money(saved)}` : 'Tick an accessory to save';
    addBtn.textContent = saved ? 'Add bundle to bag' : 'Add Hush One to bag';
  };
  boxes.forEach((b) => b.addEventListener('change', render));
  addBtn.addEventListener('click', () => {
    addItem(hushItem(config, 1));
    boxes.forEach((b) => {
      const id = b.dataset.bundleItem;
      if (id !== 'hush' && b.checked) addItem(productItem(id, BUNDLE_PRICE[id], 'Bundle price'));
    });
    saveCart();
    bumpBadge();
    toast('Travel kit added to your bag', 'bag');
    setTimeout(() => openCart(addBtn), 500);
  });
  render();
}

/* ---------- multi-step checkout with sticky order summary ---------- */
function luhn(num) {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}
function validExpiry(v) {
  const m = v.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return false;
  const end = new Date(2000 + Number(m[2]), month, 1);
  return end > new Date();
}
function setError(input, msg) {
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  let el = input.parentElement.querySelector('.field-error');
  if (msg) {
    if (!el) {
      el = document.createElement('p');
      el.className = 'field-error';
      el.id = `${input.id}-err`;
      input.parentElement.appendChild(el);
    }
    el.textContent = msg;
    input.setAttribute('aria-describedby', el.id);
  } else if (el) {
    el.remove();
    input.removeAttribute('aria-describedby');
  }
}
function validateForm(form) {
  let first = null;
  qsa('input[required]', form).forEach((input) => {
    const v = input.value.trim();
    let msg = '';
    if (!v) msg = 'Please fill this in';
    else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Enter a valid email address';
    else if (input.name === 'card' && !luhn(v)) msg = 'That card number doesn’t look right — try 4242 4242 4242 4242';
    else if (input.name === 'exp' && !validExpiry(v)) msg = 'Use a future date as MM/YY';
    else if (input.name === 'cvc' && !/^\d{3,4}$/.test(v)) msg = 'Enter the 3 or 4 digit code';
    setError(input, msg);
    if (msg && !first) first = input;
  });
  if (first) first.focus();
  return !first;
}

function initCheckout() {
  const dlg = qs('#checkout');
  const scroller = qs('.checkout-scroll', dlg);
  const steps = qsa('[data-co-step]', dlg);
  const data = { shipping: 'standard', code: null };
  let step = 1;

  const etaFor = (days) => formatDay(addBusinessDays(new Date(), days));
  qsa('[data-eta]', dlg).forEach((el) => {
    el.textContent = `Arrives ${etaFor(Number(el.dataset.eta))}`;
  });

  function renderSummary() {
    if (data.receipt) return null;
    const t = cartTotals({ code: data.code, shipping: data.shipping });
    const list = qs('[data-summary-items]', dlg);
    list.textContent = '';
    cart.items.forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="thumb"><img src="${item.img}" width="56" height="56" alt="" decoding="async"><span class="qty">${item.qty}</span></span><span><b></b><small></small></span><span class="p">${money(item.unit * item.qty)}</span>`;
      qs('b', li).textContent = item.name;
      qs('small', li).textContent = item.variant;
      list.appendChild(li);
    });
    const extra = [];
    if (t.multi) extra.push(['Multi-buy savings', -t.multi]);
    if (t.credit) extra.push(['Trade-in credit', -t.credit]);
    qs('[data-sum-subtotal]', dlg).textContent = money(t.subtotal - t.multi - t.credit);
    const sub = qs('[data-sum-subtotal]', dlg).previousElementSibling;
    sub.textContent = extra.length ? `Subtotal (after ${extra.map((x) => x[0].toLowerCase()).join(' & ')})` : 'Subtotal';
    const discRow = qs('[data-sum-discount-row]', dlg);
    discRow.hidden = !t.discount;
    qs('[data-sum-code]', dlg).textContent = data.code ? `(${data.code})` : '';
    qs('[data-sum-discount]', dlg).textContent = money(-t.discount);
    qs('[data-sum-ship]', dlg).textContent = t.ship ? money(t.ship) : 'Free';
    qs('[data-sum-tax]', dlg).textContent = money(t.tax, { cents: true });
    tweenMoney(qs('[data-sum-total]', dlg), t.total, (v) => money(v, { cents: true }));
    qs('[data-co-total]', dlg).textContent = money(t.total, { cents: true });
    return t;
  }

  function goStep(n, focus = true) {
    step = n;
    steps.forEach((s) => {
      s.hidden = Number(s.dataset.coStep) !== n;
    });
    qsa('[data-pstep]', dlg).forEach((li) => {
      const i = Number(li.dataset.pstep);
      const done = i < n || n === 5;
      li.classList.toggle('done', done);
      li.classList.toggle('current', i === n);
      if (i === n) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
      qs('.dot', li).innerHTML = done ? '<svg class="i"><use href="#i-check"/></svg>' : String(i + 1);
    });
    qs('[data-progress-fill]', dlg).style.width = n === 5 ? '100%' : `${((n + 0.5) / 5) * 100}%`;
    if (n === 4) renderReview();
    scroller.scrollTo({ top: 0, behavior: 'smooth' });
    if (focus) {
      const target = qs(`[data-co-step="${n}"]`, dlg);
      const field = qs('input:not([type="radio"]), input[type="radio"]:checked, button[type="submit"]', target);
      (n === 5 ? target : field || target).focus({ preventScroll: true });
    }
  }

  function renderReview() {
    const f1 = qs('[data-co-step="1"]', dlg).elements;
    const ship = qs('[data-co-step="2"] input[name="ship"]:checked', dlg);
    const card = qs('#co-card').value.replace(/\D/g, '');
    const rows = [
      ['Contact', f1.email.value, 1],
      ['Ship to', `${f1.first.value} ${f1.last.value}, ${f1.address.value}, ${f1.city.value} ${f1.zip.value}`, 1],
      ['Delivery', qs('b', ship.parentElement).textContent, 2],
      ['Payment', `Card ending ${card.slice(-4)}`, 3],
    ];
    const dl = qs('[data-review]', dlg);
    dl.textContent = '';
    rows.forEach(([k, v, s]) => {
      const div = document.createElement('div');
      div.innerHTML = '<dt></dt><dd></dd><dd><button class="link-btn" type="button">Edit</button></dd>';
      div.children[0].textContent = k;
      div.children[1].textContent = v;
      const b = qs('button', div);
      b.setAttribute('aria-label', `Edit ${k.toLowerCase()}`);
      b.addEventListener('click', () => goStep(s));
      dl.appendChild(div);
    });
  }

  qs('[data-checkout]').addEventListener('click', (e) => {
    if (!cart.items.length) return;
    closeDialog(qs('#cart-drawer'));
    data.shipping = qs('input[name="ship"]:checked', dlg).value;
    goStep(1, false);
    renderSummary();
    openDialog(dlg, qs('#cart-btn'));
    journey('checkout');
    setTimeout(() => qs('#co-email').focus(), 60);
    e.preventDefault();
  });

  qs('[data-demo-fill]', dlg).addEventListener('click', () => {
    const vals = { 'co-email': 'alex.morgan@example.com', 'co-first': 'Alex', 'co-last': 'Morgan', 'co-address': '221 Quiet Lane', 'co-city': 'Portland', 'co-zip': '97205', 'co-card': '4242 4242 4242 4242', 'co-exp': '12/29', 'co-cvc': '123' };
    Object.entries(vals).forEach(([id, v]) => {
      const el = qs(`#${id}`);
      el.value = v;
      setError(el, '');
    });
    toast('Demo details filled in', 'sparkle');
  });

  const card = qs('#co-card');
  card.addEventListener('input', () => {
    card.value = card.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  });
  const exp = qs('#co-exp');
  exp.addEventListener('input', (e) => {
    let v = exp.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3 || (v.length === 2 && e.inputType !== 'deleteContentBackward')) v = `${v.slice(0, 2)}/${v.slice(2)}`;
    exp.value = v;
  });
  const cvc = qs('#co-cvc');
  cvc.addEventListener('input', () => {
    cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4);
  });

  steps.forEach((form) => {
    if (form.tagName !== 'FORM') return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Number(form.dataset.coStep);
      if (!validateForm(form)) return;
      if (n < 4) {
        goStep(n + 1);
        return;
      }
      const btn = qs('[data-place]', form);
      btn.disabled = true;
      const label = btn.innerHTML;
      btn.textContent = 'Processing securely…';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = label;
        const id = `HX-${Math.floor(1000 + Math.random() * 9000)}`;
        qs('[data-order-id]', dlg).textContent = id;
        const days = { standard: 2, express: 1, eco: 5 }[data.shipping];
        qs('[data-order-eta]', dlg).textContent = `Estimated delivery ${etaFor(days)}. We’ve emailed your receipt to ${qs('#co-email').value}.`;
        data.receipt = true;
        qs('[data-promo]', dlg).hidden = true;
        qs('[data-promo-msg]', dlg).textContent = '';
        qs('.summary h3', dlg).textContent = `Receipt · ${id}`;
        cart = { items: [], credit: 0 };
        data.code = null;
        saveCart();
        goStep(5);
        journey('delivered');
        toast(`Order ${id} confirmed`, 'check');
      }, 1300);
    });
    qsa('[data-co-back]', form).forEach((b) => b.addEventListener('click', () => goStep(Number(form.dataset.coStep) - 1)));
  });
  qsa('input[name="ship"]', dlg).forEach((r) => r.addEventListener('change', () => {
    data.shipping = r.value;
    renderSummary();
  }));
  qs('[data-promo]', dlg).addEventListener('submit', (e) => {
    e.preventDefault();
    const input = qs('#promo-code');
    const code = input.value.trim().toUpperCase();
    const msg = qs('[data-promo-msg]', dlg);
    if (CODES[code]) {
      data.code = code;
      msg.textContent = CODES[code].accessoriesOnly ? `${code} applied: 10% off accessories.` : `${code} applied: 10% off your order.`;
    } else {
      data.code = null;
      msg.textContent = code ? `“${code}” isn’t a valid code. Try STAY10.` : 'Enter a code first.';
    }
    renderSummary();
  });
  dlg.addEventListener('close', () => {
    if (step === 5) {
      data.receipt = false;
      qs('[data-promo]', dlg).hidden = false;
      qs('#promo-code').value = '';
      qs('.summary h3', dlg).textContent = 'Order summary';
      goStep(1, false);
      journey(cart.items.length ? 'bag' : 'build');
    }
  });
  on('cart', () => {
    if (dlg.open) renderSummary();
  });
}

export function initCommerce() {
  initCartDrawer();
  initConfigurator();
  initStickyBars();
  initAccessories();
  initCheckout();
}

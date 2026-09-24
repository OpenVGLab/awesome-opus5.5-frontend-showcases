// Shared helpers used by every module.
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const motionOK = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function money(n, { cents = 'auto' } = {}) {
  const neg = n < -0.004;
  const v = Math.abs(Math.round(n * 100) / 100);
  const showCents = cents === true || (cents === 'auto' && Math.abs(v % 1) > 0.004);
  const [int, dec] = v.toFixed(showCents ? 2 : 0).split('.');
  return `${neg ? '−' : ''}$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${dec ? `.${dec}` : ''}`;
}

const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export function on(type, fn) {
  const handler = (e) => fn(e.detail);
  bus.addEventListener(type, handler);
  return () => bus.removeEventListener(type, handler);
}

export const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`hush:${key}`);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`hush:${key}`, JSON.stringify(value));
    } catch {
      /* private mode */
    }
  },
};
export const session = {
  get(key) {
    try {
      return sessionStorage.getItem(`hush:${key}`);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(`hush:${key}`, value);
    } catch {
      /* private mode */
    }
  },
};

export function tween(from, to, duration, onUpdate, ease = easeOutCubic) {
  if (!motionOK() || duration <= 0) {
    onUpdate(to);
    return () => {};
  }
  const t0 = performance.now();
  let raf = 0;
  const step = (now) => {
    const t = clamp((now - t0) / duration, 0, 1);
    onUpdate(from + (to - from) * ease(t));
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

// Animates a money value inside an element, remembering the last shown value.
export function tweenMoney(el, value, format = money) {
  const from = Number(el.dataset.val ?? value);
  el.dataset.val = value;
  if (el._cancel) el._cancel();
  if (from === value) {
    el.textContent = format(value);
    return;
  }
  el._cancel = tween(from, value, 500, (v) => {
    el.textContent = format(Math.round(v * 100) / 100);
  });
}

export function observe(els, cb, options = { threshold: 0.2 }) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => cb(e, io)), options);
  els.forEach((el) => el && io.observe(el));
  return io;
}

export function toast(message, icon = 'check') {
  const host = document.querySelector('dialog[open]') || document.body;
  let region = host === document.body ? qs('[data-toasts]') : host.querySelector(':scope > .toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    host.appendChild(region);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<svg class="i"><use href="#i-${icon}"/></svg><span></span>`;
  t.querySelector('span').textContent = message;
  region.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 320);
  }, 2600);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

// Native <dialog> with scroll lock, backdrop click to close and focus restore.
const returnFocus = new WeakMap();
export function openDialog(dlg, opener = document.activeElement) {
  if (!dlg || dlg.open) return;
  returnFocus.set(dlg, opener);
  dlg.showModal();
  document.documentElement.classList.add('dialog-open');
  emit('dialog', { open: true, id: dlg.id });
  if (!dlg._wired) {
    dlg._wired = true;
    dlg.addEventListener('click', (e) => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside || dlg.classList.contains('drawer')) dlg.close();
    });
    dlg.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('dialog-open');
      emit('dialog', { open: false, id: dlg.id });
      const el = returnFocus.get(dlg);
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus({ preventScroll: true });
    });
  }
}
export function closeDialog(dlg) {
  if (dlg && dlg.open) dlg.close();
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function addBusinessDays(date, days) {
  const d = new Date(date);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export function formatDay(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

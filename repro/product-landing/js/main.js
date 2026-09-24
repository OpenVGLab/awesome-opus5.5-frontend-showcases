import { qs, qsa, clamp, motionOK, finePointer, emit, on, toast, storage, observe, tween, copyText, openDialog, pad2 } from './core.js';
import { initCommerce } from './commerce.js';
import { initArt } from './art.js';
import { initEngage } from './engage.js';

const root = document.documentElement;

function onScrollFrame(fn) {
  let ticking = false;
  const run = () => {
    ticking = false;
    fn();
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(run);
    }
  }, { passive: true });
  addEventListener('resize', run, { passive: true });
  run();
}

/* Theme with a circular reveal from the toggle */
function applyTheme(theme, save) {
  const btn = qs('#theme-toggle');
  root.setAttribute('data-theme', theme);
  btn.setAttribute('aria-pressed', String(theme === 'dark'));
  btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  qs('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#0d0d0e' : '#f4f4f2');
  if (save) {
    try {
      localStorage.setItem('hush-theme', theme);
    } catch {
      /* ignore */
    }
  }
  emit('theme', theme);
}
function toggleTheme(origin) {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  if (!document.startViewTransition || !motionOK()) {
    applyTheme(next, true);
    return;
  }
  const r = (origin || qs('#theme-toggle')).getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = document.startViewTransition(() => applyTheme(next, true));
  vt.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
}
function initTheme() {
  applyTheme(root.getAttribute('data-theme') || 'light', false);
  const btn = qs('#theme-toggle');
  btn.addEventListener('click', () => toggleTheme(btn));
}

/* Sticky header, scroll progress, mobile menu, active section */
function initHeader() {
  const header = qs('#site-header');
  const bar = qs('.scroll-progress span');
  onScrollFrame(() => {
    const y = scrollY;
    header.classList.toggle('is-scrolled', y > 8);
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : '0');
  });

  const nav = qs('#main-nav');
  const menuBtn = qs('#menu-btn');
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    qs('use', menuBtn).setAttribute('href', open ? '#i-close' : '#i-menu');
  };
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false);
      menuBtn.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !e.target.closest('#main-nav, #menu-btn')) setMenu(false);
  });

  const links = qsa('a', nav);
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  observe([...byId.keys()].map((id) => document.getElementById(id)), (e) => {
    if (!e.isIntersecting) return;
    links.forEach((l) => {
      l.classList.remove('is-active');
      l.removeAttribute('aria-current');
    });
    const a = byId.get(e.target.id);
    a.classList.add('is-active');
    a.setAttribute('aria-current', 'location');
  }, { rootMargin: '-40% 0px -55% 0px' });
}

/* Scroll-triggered reveals */
function initReveal() {
  const els = qsa('.reveal');
  if (!('IntersectionObserver' in window) || !motionOK()) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  observe(els, (e, io) => {
    if (e.isIntersecting) {
      e.target.classList.add('is-visible');
      io.unobserve(e.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
}

/* Parallax background elements */
function initParallax() {
  if (!motionOK()) return;
  const items = qsa('[data-parallax]').map((el) => ({ el, speed: parseFloat(el.dataset.parallax) || 0, host: el.parentElement }));
  onScrollFrame(() => {
    const vh = innerHeight;
    for (const it of items) {
      const r = it.host.getBoundingClientRect();
      if (r.bottom < -300 || r.top > vh + 300) continue;
      const offset = r.top + r.height / 2 - vh / 2;
      it.el.style.translate = `0 ${(-offset * it.speed).toFixed(1)}px`;
    }
  });
}

/* Hero product animates with scroll, plus a subtle pointer tilt */
function initHeroScroll() {
  const hero = qs('.hero');
  const product = qs('[data-hero-product]');
  const copy = qs('[data-hero-copy]');
  if (!motionOK()) return;
  let tiltX = 0;
  let tiltY = 0;
  let p = 0;
  const render = () => {
    product.style.transform = `translate3d(0, ${(p * 140).toFixed(1)}px, 0) rotate(${(p * 16 + tiltX * 3).toFixed(2)}deg) rotateX(${(tiltY * 6).toFixed(2)}deg) rotateY(${(tiltX * 8).toFixed(2)}deg) scale(${(1 - p * 0.2).toFixed(3)})`;
    copy.style.transform = `translate3d(0, ${(p * -70).toFixed(1)}px, 0)`;
    copy.style.opacity = String(clamp(1 - p * 1.4, 0, 1));
  };
  onScrollFrame(() => {
    const r = hero.getBoundingClientRect();
    p = clamp(-r.top / Math.max(1, r.height), 0, 1);
    render();
  });
  if (finePointer()) {
    const vis = qs('[data-hero-visual]');
    vis.addEventListener('pointermove', (e) => {
      const r = vis.getBoundingClientRect();
      tiltX = (e.clientX - r.left) / r.width - 0.5;
      tiltY = (e.clientY - r.top) / r.height - 0.5;
      requestAnimationFrame(render);
    });
    vis.addEventListener('pointerleave', () => {
      tween(1, 0, 500, (k) => {
        tiltX *= k;
        tiltY *= k;
        render();
      });
    });
  }
}

/* Animated counters */
function initCounters() {
  const fmt = (el, v) => {
    const dec = Number(el.dataset.decimals || 0);
    const s = el.dataset.format === 'comma' ? Math.round(v).toLocaleString('en-US') : v.toFixed(dec);
    return (el.dataset.prefix || '') + s;
  };
  observe(qsa('[data-count]'), (e, io) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target;
    tween(0, parseFloat(el.dataset.count), 1700, (v) => {
      el.textContent = fmt(el, v);
    });
  }, { threshold: 0.6 });
}

/* Evergreen countdown for the launch offer */
function initCountdown() {
  const now = Date.now();
  let deadline = storage.get('deadline', 0);
  if (!deadline || deadline < now) {
    deadline = now + ((2 * 24 + 13) * 3600 + 27 * 60 + 41) * 1000;
    storage.set('deadline', deadline);
  }
  const units = { d: qsa('[data-cd="d"]'), h: qsa('[data-cd="h"]'), m: qsa('[data-cd="m"]'), s: qsa('[data-cd="s"]') };
  const compact = qsa('[data-countdown-compact]');
  const last = {};
  const tick = () => {
    let left = deadline - Date.now();
    if (left <= 0) {
      deadline = Date.now() + 48 * 3600 * 1000;
      storage.set('deadline', deadline);
      left = deadline - Date.now();
    }
    const s = Math.floor(left / 1000);
    const vals = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
    Object.entries(vals).forEach(([k, v]) => {
      const txt = pad2(v);
      if (last[k] === txt) return;
      units[k].forEach((el) => {
        el.textContent = txt;
        if (last[k] !== undefined && motionOK()) {
          el.classList.remove('tick');
          void el.offsetWidth;
          el.classList.add('tick');
        }
      });
      last[k] = txt;
    });
    const hms = `${pad2(vals.h)}:${pad2(vals.m)}:${pad2(vals.s)}`;
    compact.forEach((el) => {
      el.textContent = vals.d > 0 ? `${vals.d}d ${hms}` : hms;
    });
    emit('countdown', vals);
  };
  tick();
  setInterval(tick, 1000);
}

/* FAQ accordion with arrow-key navigation and search */
function initFAQ() {
  const list = qs('[data-faq]');
  const buttons = qsa('.faq-q', list);
  const setOpen = (btn, open) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      panel.hidden = false;
      void panel.offsetHeight;
      panel.classList.add('is-open');
    } else {
      panel.classList.remove('is-open');
      const done = () => {
        if (btn.getAttribute('aria-expanded') === 'false') panel.hidden = true;
      };
      setTimeout(done, motionOK() ? 420 : 0);
    }
  };
  buttons.forEach((btn) => btn.addEventListener('click', () => setOpen(btn, btn.getAttribute('aria-expanded') !== 'true')));
  list.addEventListener('keydown', (e) => {
    const btn = e.target.closest('.faq-q');
    if (!btn) return;
    const visible = buttons.filter((b) => !b.closest('.faq-item').hidden);
    const i = visible.indexOf(btn);
    let next = null;
    if (e.key === 'ArrowDown') next = visible[(i + 1) % visible.length];
    else if (e.key === 'ArrowUp') next = visible[(i - 1 + visible.length) % visible.length];
    else if (e.key === 'Home') next = visible[0];
    else if (e.key === 'End') next = visible[visible.length - 1];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  });
  setOpen(buttons[0], true);

  const input = qs('[data-faq-search]');
  const empty = qs('[data-faq-empty]');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    qsa('.faq-item', list).forEach((item) => {
      const match = !q || item.textContent.toLowerCase().includes(q);
      item.hidden = !match;
      if (match) shown++;
      const btn = qs('.faq-q', item);
      if (q && match && btn.getAttribute('aria-expanded') !== 'true') setOpen(btn, true);
    });
    empty.hidden = shown > 0;
  });
}

function initCompare() {
  const table = qs('[data-compare]');
  qs('[data-compare-wins]').addEventListener('change', (e) => table.classList.toggle('wins-on', e.target.checked));
}

/* Sticky social share bar */
function initShare() {
  const bar = qs('[data-share-bar]');
  const url = location.href.split('#')[0];
  const text = 'Hush One — adaptive noise-cancelling headphones with a 40-hour battery';
  const enc = encodeURIComponent;
  const links = {
    x: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    whatsapp: `https://wa.me/?text=${enc(`${text} ${url}`)}`,
    email: `mailto:?subject=${enc('Take a look at Hush One')}&body=${enc(`${text}\n${url}`)}`,
  };
  qsa('a[data-share]', bar).forEach((a) => {
    a.href = links[a.dataset.share];
  });
  qs('[data-share="copy"]', bar).addEventListener('click', async () => {
    await copyText(url);
    toast('Link copied to clipboard', 'link');
  });
  const toggle = qs('[data-share-toggle]', bar);
  toggle.addEventListener('click', () => {
    const open = !bar.classList.contains('is-open');
    bar.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  let pastHero = false;
  let footerVisible = false;
  const sync = () => bar.classList.toggle('is-hidden', !pastHero || footerVisible);
  onScrollFrame(() => {
    pastHero = scrollY > innerHeight * 0.6;
    sync();
  });
  observe([qs('.site-footer')], (e) => {
    footerVisible = e.isIntersecting;
    sync();
  }, { threshold: 0 });
}

/* Copy-code buttons anywhere on the page */
function initCopyButtons() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    await copyText(btn.dataset.copy);
    toast(`Code ${btn.dataset.copy} copied`, 'copy');
  });
}

/* Global keyboard shortcuts */
function initShortcuts() {
  const dlg = qs('#shortcuts-modal');
  qsa('[data-shortcuts]').forEach((b) => b.addEventListener('click', () => openDialog(dlg, b)));
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (e.key === '?') {
      e.preventDefault();
      openDialog(dlg);
    } else if (k === 'd') toggleTheme();
    else if (k === 'b') emit('cart:open');
    else if (k === 'c') emit('chat:open', 'support');
  });
}

/* Magnetic buttons and ripples */
function initMicro() {
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn || !motionOK()) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const ink = document.createElement('span');
    ink.className = 'ripple';
    ink.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.appendChild(ink);
    setTimeout(() => ink.remove(), 700);
  });
  if (!finePointer() || !motionOK()) return;
  qsa('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.translate = `${(x * 10).toFixed(1)}px ${(y * 8).toFixed(1)}px`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.translate = '';
    });
  });
}

/* Custom cursor: dot + trailing ring that reacts to what is underneath */
function initCursor() {
  if (!motionOK()) return;
  const el = qs('.cursor');
  const dot = qs('.cursor-dot', el);
  const ring = qs('.cursor-ring', el);
  const label = qs('.cursor-label', el);
  const labels = { drag: 'Drag', view: 'View', pick: 'Pick' };
  // Enabled by the first real mouse movement (not by media queries), and dropped again on touch input.
  let enabled = false;
  const enable = (on) => {
    enabled = on;
    root.classList.toggle('has-cursor', on && !document.querySelector('dialog[open]'));
    if (!on) {
      el.classList.remove('is-active');
      running = false;
    }
  };
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' && enabled) enable(false);
  }, { passive: true });
  let x = -100;
  let y = -100;
  let rx = x;
  let ry = y;
  let running = false;
  const loop = () => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
    if (running) requestAnimationFrame(loop);
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!enabled) enable(true);
    x = e.clientX;
    y = e.clientY;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (!running) {
      running = true;
      rx = x;
      ry = y;
      el.classList.add('is-active');
      requestAnimationFrame(loop);
    }
    const t = e.target;
    if (!(t instanceof Element)) return;
    const hotspot = t.closest('.hotspot, .tool-btn');
    const tagged = t.closest('[data-cursor]');
    const interactive = t.closest('a, button, label, select, summary, [role="tab"], input[type="range"]');
    el.classList.toggle('is-text', !!t.closest('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea'));
    const kind = !hotspot && tagged ? labels[tagged.dataset.cursor] : '';
    label.textContent = kind || '';
    el.classList.toggle('has-label', !!kind);
    el.classList.toggle('is-link', !kind && !!interactive);
  }, { passive: true });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.documentElement.addEventListener('mouseleave', () => {
    el.classList.remove('is-active');
    running = false;
  });
  on('dialog', () => root.classList.toggle('has-cursor', enabled && !document.querySelector('dialog[open]')));
}

/* Real load-time readout (Navigation Timing + LCP) */
function initPerf() {
  const el = qs('[data-perf]');
  let lcp = 0;
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      lcp = entries[entries.length - 1].startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    /* unsupported */
  }
  const report = () => {
    const nav = performance.getEntriesByType('navigation')[0];
    if (!nav || !nav.loadEventEnd) {
      setTimeout(report, 250);
      return;
    }
    const load = (nav.loadEventEnd - nav.startTime) / 1000;
    const parts = [`Page loaded in ${load.toFixed(2)} s`];
    if (lcp) parts.push(`largest paint ${(lcp / 1000).toFixed(2)} s`);
    el.textContent = `${parts.join(' · ')} (target under 3 s)`;
  };
  if (document.readyState === 'complete') setTimeout(report, 300);
  else addEventListener('load', () => setTimeout(report, 300));
}

/* The 3D viewer (and Three.js) only loads when the showcase approaches, or when the browser is idle */
function initViewerLoader() {
  const viewer = qs('#viewer');
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    import('./viewer.js')
      .then((m) => m.initViewer(viewer))
      .catch((err) => {
        console.warn('3D viewer unavailable:', err && err.message);
        viewer.classList.add('is-failed');
      });
  };
  observe([viewer], (e, io) => {
    if (e.isIntersecting) {
      io.disconnect();
      start();
    }
  }, { rootMargin: '700px 0px' });
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(start, { timeout: 5000 }) : setTimeout(start, 2500));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle);
}

initTheme();
initHeader();
initReveal();
initParallax();
initHeroScroll();
initCounters();
initCountdown();
initFAQ();
initCompare();
initShare();
initCopyButtons();
initShortcuts();
initMicro();
initCursor();
initPerf();
initCommerce();
initArt();
initEngage();
initViewerLoader();

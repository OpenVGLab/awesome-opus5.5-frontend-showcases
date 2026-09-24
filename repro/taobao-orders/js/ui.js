/* Shared UI primitives: toast, notifications, modal, popover, password field, stars, fly-to-cart. */
window.UI = (function () {
  'use strict';
  const layer = document.getElementById('layer');
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (name, cls = '') => `<svg class="ic ${cls}"><use href="#i-${name}"/></svg>`;
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2);

  /* ---------- toast ---------- */
  let toastEl, toastTimer;
  function toast(msg, type = 'ok', ms = 2200) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    const icon = { ok: 'check', info: 'info', warn: 'warn' }[type] || 'info';
    toastEl.innerHTML = `<span class="toast-ic t-${type}">${ic(icon)}</span><span class="toast-t">${msg}</span>`;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  /* ---------- notification cards (top right) ---------- */
  let notiWrap;
  function notify({ title, text, img, icon = 'truck', tone = 'orange', ms = 5200, onClick }) {
    if (!notiWrap) {
      notiWrap = document.createElement('div');
      notiWrap.className = 'noti-wrap';
      document.body.appendChild(notiWrap);
    }
    const n = document.createElement('div');
    n.className = `noti tone-${tone}`;
    n.innerHTML = `<span class="noti-ic">${ic(icon)}</span>${img ? `<img src="${img}" alt="">` : ''}
      <div class="noti-b"><b>${title}</b><p>${text}</p></div><a class="noti-x" aria-label="关闭">${ic('close')}</a>`;
    notiWrap.appendChild(n);
    requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('show')));
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      n.classList.remove('show');
      setTimeout(() => n.remove(), 320);
    };
    n.querySelector('.noti-x').addEventListener('click', (e) => { e.stopPropagation(); close(); });
    if (onClick) n.addEventListener('click', () => { onClick(); close(); });
    setTimeout(close, ms);
  }

  /* ---------- modal ---------- */
  const stack = [];
  function modal({ title = '', body = '', foot = '', width = 520, cls = '', onClose, closable = true }) {
    const wrap = document.createElement('div');
    wrap.className = 'mask';
    wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/<[^>]+>/g, ''))}" style="--mw:${width}px">
        <div class="m-head"><h3>${title}</h3>${closable ? `<a class="m-x" aria-label="关闭">${ic('close')}</a>` : ''}</div>
        <div class="m-body">${body}</div>${foot ? `<div class="m-foot">${foot}</div>` : ''}</div>`;
    layer.appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('show')));
    const h = {
      el: wrap.querySelector('.modal'), mask: wrap, closed: false, closable,
      $: (s) => wrap.querySelector(s),
      $$: (s) => [...wrap.querySelectorAll(s)],
      close() {
        if (h.closed) return;
        h.closed = true;
        wrap.classList.remove('show');
        setTimeout(() => wrap.remove(), 220);
        const i = stack.indexOf(h);
        if (i >= 0) stack.splice(i, 1);
        if (onClose) onClose();
      },
      setClosable(v) {
        h.closable = v;
        const x = wrap.querySelector('.m-x');
        if (x) x.style.visibility = v ? '' : 'hidden';
      },
    };
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap && h.closable) h.close(); });
    const x = wrap.querySelector('.m-x');
    if (x) x.addEventListener('click', () => h.closable && h.close());
    wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => h.close()));
    stack.push(h);
    return h;
  }
  const topModal = () => stack[stack.length - 1];

  /* ---------- popover ---------- */
  let pop = null, popAnchor = null, popTimer = 0;
  function placePop(el, anchor, place) {
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    if (place === 'bottom' && r.bottom + h + 14 > innerHeight && r.top - h - 14 > 0) place = 'top';
    if (place === 'top' && r.top - h - 14 < 0) place = 'bottom';
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(8, Math.min(x, vw - w - 8));
    const y = place === 'top' ? r.top - h - 10 : r.bottom + 10;
    el.style.left = x + scrollX + 'px';
    el.style.top = y + scrollY + 'px';
    el.dataset.place = place;
    el.querySelector('.pop-arrow').style.left = Math.max(12, Math.min(w - 12, r.left + r.width / 2 - x)) + 'px';
  }
  function showPop(anchor, html, { place = 'bottom', cls = '', hover = false } = {}) {
    hidePop(true);
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.innerHTML = html + '<i class="pop-arrow"></i>';
    document.body.appendChild(el);
    pop = el;
    popAnchor = anchor;
    placePop(el, anchor, place);
    requestAnimationFrame(() => el.classList.add('show'));
    if (hover) {
      el.addEventListener('mouseenter', () => clearTimeout(popTimer));
      el.addEventListener('mouseleave', () => schedHidePop());
    }
    return el;
  }
  function hidePop(now) {
    clearTimeout(popTimer);
    if (!pop) return;
    const p = pop;
    pop = null;
    popAnchor = null;
    if (now) p.remove();
    else { p.classList.remove('show'); setTimeout(() => p.remove(), 160); }
  }
  function schedHidePop(ms = 200) {
    clearTimeout(popTimer);
    popTimer = setTimeout(() => hidePop(), ms);
  }
  const keepPop = () => clearTimeout(popTimer);
  const popFor = (anchor) => (pop && popAnchor === anchor ? pop : null);
  document.addEventListener('mousedown', (e) => {
    if (pop && !pop.contains(e.target) && !(popAnchor && popAnchor.contains(e.target))) hidePop();
  });
  addEventListener('resize', () => hidePop(true));

  function confirmPop(anchor, text, onOk, { okText = '确定', place = 'top', sub = '' } = {}) {
    const p = showPop(anchor, `<div class="cpop"><div class="cpop-t">${ic('warn')}<div><b>${text}</b>${sub ? `<p>${sub}</p>` : ''}</div></div>
      <div class="cpop-b"><button class="btn btn-line btn-sm" data-no>取消</button><button class="btn btn-primary btn-sm" data-ok>${okText}</button></div></div>`, { place, cls: 'pop-confirm' });
    p.querySelector('[data-no]').addEventListener('click', () => hidePop());
    p.querySelector('[data-ok]').addEventListener('click', () => { hidePop(); onOk(); });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (pop) { hidePop(); return; }
    const t = topModal();
    if (t && t.closable) t.close();
  });

  /* ---------- password field ---------- */
  const pwdField = (len = 6) => `<div class="pwd"><input class="pwd-in" type="tel" inputmode="numeric" maxlength="${len}" autocomplete="off" aria-label="支付密码">${'<i></i>'.repeat(len)}</div>`;
  function bindPwd(root, onChange) {
    const box = root.querySelector('.pwd');
    const input = box.querySelector('.pwd-in');
    const cells = [...box.querySelectorAll('i')];
    const sync = () => {
      const v = input.value.replace(/\D/g, '').slice(0, cells.length);
      if (v !== input.value) input.value = v;
      const focused = document.activeElement === input;
      cells.forEach((c, i) => {
        c.classList.toggle('on', i < v.length);
        c.classList.toggle('cur', focused && i === Math.min(v.length, cells.length - 1));
      });
      box.classList.toggle('focus', focused);
      onChange && onChange(v);
    };
    input.addEventListener('input', sync);
    input.addEventListener('focus', sync);
    input.addEventListener('blur', sync);
    box.addEventListener('click', () => input.focus());
    setTimeout(() => input.focus(), 260);
    return {
      input,
      get value() { return input.value; },
      clear() { input.value = ''; sync(); },
      shake() { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); },
    };
  }

  /* ---------- star rating ---------- */
  const STAR_LABELS = ['非常差', '差', '一般', '好', '非常好'];
  const stars = (name, val = 5, labels = STAR_LABELS) =>
    `<span class="stars" data-name="${name}" data-val="${val}">${[1, 2, 3, 4, 5].map((i) => `<a data-v="${i}" class="${i <= val ? 'on' : ''}" aria-label="${i}星">${ic('star')}</a>`).join('')}<em>${labels[val - 1]}</em></span>`;
  function bindStars(root, labels = STAR_LABELS) {
    root.querySelectorAll('.stars').forEach((s) => {
      const set = (v, commit) => {
        s.querySelectorAll('a').forEach((a) => a.classList.toggle('on', +a.dataset.v <= v));
        s.querySelector('em').textContent = labels[v - 1];
        if (commit) {
          s.dataset.val = v;
          const a = s.querySelector(`a[data-v="${v}"]`);
          a.classList.remove('pulse'); void a.offsetWidth; a.classList.add('pulse');
        }
      };
      s.addEventListener('mouseover', (e) => { const a = e.target.closest('a'); if (a) set(+a.dataset.v); });
      s.addEventListener('mouseleave', () => set(+s.dataset.val));
      s.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) set(+a.dataset.v, true); });
    });
  }

  /* ---------- fly to cart ---------- */
  function visibleCartTarget() {
    const cands = [...document.querySelectorAll('[data-cart-num]')].filter((el) => {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    });
    return cands.find((el) => el.closest('.site-nav')) || cands[0] || null;
  }
  function flyToCart(fromEl, src, done) {
    const target = visibleCartTarget();
    if (!fromEl || !target) { done && done(); return; }
    const r0 = fromEl.getBoundingClientRect(), r1 = target.getBoundingClientRect();
    const size = 64;
    const sx = r0.left + r0.width / 2 - size / 2, sy = r0.top + r0.height / 2 - size / 2;
    const dx = r1.left + r1.width / 2 - (sx + size / 2), dy = r1.top + r1.height / 2 - (sy + size / 2);
    const outer = document.createElement('div');
    outer.className = 'fly';
    outer.style.left = sx + 'px';
    outer.style.top = sy + 'px';
    outer.innerHTML = `<img src="${src}" alt="" width="${size}" height="${size}">`;
    document.body.appendChild(outer);
    const img = outer.firstChild;
    const dur = 820;
    outer.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration: dur, easing: 'linear', fill: 'forwards' });
    img.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: `translateY(${dy}px) scale(.22)`, opacity: 0.75 },
    ], { duration: dur, easing: dy < 0 ? 'cubic-bezier(.2,.6,.35,1)' : 'cubic-bezier(.55,-0.45,.8,.55)', fill: 'forwards' })
      .onfinish = () => {
        outer.remove();
        target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump');
        done && done();
      };
  }

  /* ---------- misc ---------- */
  function countdown(ms) {
    if (ms <= 0) return '00:00:00';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return d > 0 ? `${d}天${pad(h)}时${pad(m)}分` : `${pad(h)}:${pad(m)}:${pad(ss)}`;
  }
  function dayHour(ms) {
    const h = Math.max(0, Math.floor(ms / 3600e3));
    return `${Math.floor(h / 24)}天${h % 24}时`;
  }
  async function copy(text, tip = '已复制到剪贴板') {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* fall through */ }
    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
    }
    toast(tip);
  }

  return { esc, ic, money, pad, toast, notify, modal, topModal, showPop, hidePop, schedHidePop, keepPop, popFor, confirmPop, pwdField, bindPwd, stars, bindStars, STAR_LABELS, flyToCart, countdown, dayHour, copy };
})();

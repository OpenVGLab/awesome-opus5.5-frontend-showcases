import { traits, youTraits, faceMarkup, hexPath, rng, hashString, avatarSVG, YOU_FILL, SQ3 } from './faces.js';
import { BORROWS, randomPersona } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initHive({ root, svg, card, tag, toasts, lookTarget, onOpenCell }) {
  const st = {
    W: 0, H: 0, s: 0, cells: [], interactive: [], faces: [], byName: new Map(),
    you: null, hot: null, pulses: [], pointer: null, eyesDirty: true, visible: true,
    youSeed: null, youName: '', link: null,
  };
  let layerCells, layerFx, raf = 0, borrowIdx = 1;

  function build(force) {
    const rect = root.getBoundingClientRect();
    const W = Math.max(300, Math.round(rect.width));
    const H = Math.max(300, Math.round(rect.height));
    if (!force && W === st.W && H === st.H) return;
    st.W = W; st.H = H;
    for (const p of st.pulses) p.g.remove();
    st.pulses = [];
    st.hot = null;

    const narrow = W < 760;
    const s = clamp(narrow ? H / 15.5 : H / 22, 24, 46);
    st.s = s;
    const R = rng(90210);
    const w = SQ3 * s, h = 1.5 * s;
    const cx = narrow ? W * 0.5 : W * 0.6;
    const cy = narrow ? H * 0.52 : H * 0.5 + 26;
    const rx = narrow ? W * 0.66 : W * 0.47;
    const ry = narrow ? H * 0.6 : H * 0.56;

    const cells = [];
    for (let row = -1; (row - 1) * h < H; row++) {
      for (let col = -1; (col - 1) * w < W; col++) {
        const x = col * w + (row & 1 ? w / 2 : 0);
        const y = row * h;
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry) + (R() - 0.5) * 0.22;
        if (d > 1.02) continue;
        cells.push({ x, y, d, kind: d < 0.7 ? 'face' : 'plain' });
      }
    }

    let you = null, best = Infinity;
    const tx = cx - s * 0.8, ty = cy + s * 0.3;
    for (const c of cells) {
      if (c.kind !== 'face') continue;
      const dd = Math.hypot(c.x - tx, c.y - ty);
      if (dd < best) { best = dd; you = c; }
    }
    if (you) you.kind = 'you';

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) / w;
    const candidates = cells.filter((c) => c.kind === 'face' && you && dist(c, you) > 2.6 && dist(c, you) < 6);
    const open = [];
    for (const c of shuffle(candidates, R)) {
      if (open.length >= 3) break;
      if (open.every((o) => dist(o, c) > 2.5)) { c.kind = 'open'; open.push(c); }
    }

    const faceCells = cells.filter((c) => c.kind === 'face');
    const near = shuffle(faceCells.filter((c) => you && dist(c, you) > 1.4 && dist(c, you) < 5.5), R);
    BORROWS.forEach((b, i) => { if (near[i]) near[i].p = b; });
    for (const c of faceCells) if (!c.p) c.p = randomPersona(R);

    for (const c of cells) {
      if (c.kind === 'plain') {
        if (R() < 0.07) { c.kind = 'hole'; continue; }
        c.fill = `hsl(${(38 + R() * 8).toFixed(1)} 88% ${(80 + R() * 9).toFixed(1)}%)`;
        c.op = clamp((1.08 - c.d) * 1.55, 0.08, 0.62).toFixed(2);
        c.cap = R() < 0.3;
      }
    }

    const hexD = hexPath(s * 0.935, 0.2);
    let plain = '', live = '';
    const interactive = [];
    cells.forEach((c, i) => {
      const tr = `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`;
      if (c.kind === 'hole') return;
      if (c.kind === 'plain') {
        plain += `<g transform="${tr}" opacity="${c.op}"><use href="#hxShape" fill="${c.fill}"/>${c.cap ? `<path d="${hexPath(s * 0.6, 0.25)}" fill="none" stroke="#C98A12" stroke-opacity=".28" stroke-width="1.2"/>` : ''}</g>`;
        return;
      }
      c.i = i;
      interactive.push(c);
      if (c.kind === 'open') {
        live += `<g class="cell cell--open" data-i="${i}" transform="${tr}"><g class="ci"><path class="hx-open" d="${hexPath(s * 0.86, 0.22)}"/><path class="plus" d="M${(-s * 0.17).toFixed(1)} 0H${(s * 0.17).toFixed(1)}M0 ${(-s * 0.17).toFixed(1)}V${(s * 0.17).toFixed(1)}"/></g></g>`;
      } else if (c.kind === 'you') {
        live += `<g class="cell cell--you" data-i="${i}" transform="${tr}"><path class="you-halo" d="${hexD}"/><path class="you-ring" d="${hexPath(s * 1.2, 0.22)}"/><g class="ci">${youFace()}</g></g>`;
      } else {
        const t = traits(hashString(c.p.name));
        live += `<g class="cell" data-i="${i}" transform="${tr}"><g class="ci"><use href="#hxShape" fill="${t.fill}"/>${faceMarkup(t, s, 'hcClip')}</g></g>`;
      }
    });

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `<defs><path id="hxShape" d="${hexD}"/><clipPath id="hcClip"><path d="${hexD}"/></clipPath></defs><g class="lay-plain">${plain}</g><g class="lay-cells">${live}</g><g class="lay-fx"></g>`;
    layerCells = svg.querySelector('.lay-cells');
    layerFx = svg.querySelector('.lay-fx');

    st.byName.clear();
    for (const c of interactive) {
      c.el = layerCells.querySelector(`[data-i="${c.i}"]`);
      bindEyes(c);
      if (c.p) st.byName.set(c.p.name, c);
    }
    st.cells = cells;
    st.interactive = interactive;
    st.faces = interactive.filter((c) => c.kind === 'face');
    st.you = you;
    placeTag();
    card.classList.remove('is-on');
    st.eyesDirty = true;
    kick();
  }

  function youFace() {
    const t = youTraits(st.youSeed);
    return `<use href="#hxShape" fill="${YOU_FILL}"/>${faceMarkup(t, st.s, 'hcClip')}`;
  }

  function bindEyes(c) {
    c.pp = c.el.querySelector('.pp');
    c.m = c.pp ? parseFloat(c.pp.dataset.m) : 0;
    c.ey = -0.05 * st.s;
  }

  function placeTag() {
    if (!st.you) return;
    const s = st.s;
    tag.style.left = `${Math.round(st.you.x + s * 0.8)}px`;
    tag.style.top = `${Math.round(st.you.y - s * 0.95 - (tag.offsetHeight || 46))}px`;
    tag.classList.add('is-ready');
  }

  function shuffle(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- eyes ----------
  function updateEyes() {
    const r = svg.getBoundingClientRect();
    let tx, ty;
    if (st.pointer) {
      tx = st.pointer.x - r.left; ty = st.pointer.y - r.top;
    } else {
      const b = lookTarget.getBoundingClientRect();
      tx = b.left + b.width * 0.55 - r.left; ty = b.top + b.height * 0.5 - r.top;
    }
    for (const c of st.interactive) {
      if (!c.pp) continue;
      const dx = tx - c.x, dy = ty - (c.y + c.ey);
      const d = Math.hypot(dx, dy) || 1;
      const m = c.m * Math.min(1, d / (st.s * 2.5));
      c.pp.setAttribute('transform', `translate(${((dx / d) * m).toFixed(2)} ${((dy / d) * m).toFixed(2)})`);
    }
  }

  // ---------- hover / click ----------
  function cellAt(x, y) {
    const top = document.elementFromPoint(x, y);
    if (!top || !root.contains(top)) return null;
    const r = svg.getBoundingClientRect();
    const lx = x - r.left, ly = y - r.top;
    let found = null, bd = st.s * 0.86;
    for (const c of st.interactive) {
      const d = Math.hypot(c.x - lx, c.y - ly);
      if (d < bd) { bd = d; found = c; }
    }
    return found;
  }

  function setHot(c) {
    if (c === st.hot) return;
    if (st.hot) st.hot.el.classList.remove('is-hot');
    st.hot = c;
    root.classList.toggle('is-pointer', !!c);
    if (st.link) { st.link.remove(); st.link = null; }
    if (!c) { card.classList.remove('is-on'); return; }
    layerCells.appendChild(c.el);
    requestAnimationFrame(() => { if (st.hot === c) c.el.classList.add('is-hot'); });
    showCard(c);
    if (c !== st.you && st.you) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('class', 'link');
      p.setAttribute('d', curve(st.you, c, 0.18).d);
      layerFx.appendChild(p);
      st.link = p;
    }
  }

  function showCard(c) {
    let html;
    if (c.kind === 'open') {
      html = `<div class="hc__head">${avatarSVG(null, { you: true })}<div><b>An open cell</b><span>Sized for exactly one individual</span></div></div><p class="hc__foot">Could be yours. <b>Click to apply →</b></p>`;
    } else if (c === st.you) {
      const first = st.youName ? `, ${escapeHTML(st.youName.split(/\s+/)[0])}` : '';
      html = `<div class="hc__head">${avatarSVG(st.youName || null, { you: true })}<div><b>That’s you${first}</b><span>Still 100% you · checked just now</span></div></div><p class="hc__lbl">The hive can borrow</p><div class="hc__chips"><span>Work skills</span><span>Languages</span><span>How-tos</span></div><p class="hc__foot">Everything else stays behind the wax.</p>`;
    } else {
      const p = c.p;
      html = `<div class="hc__head">${avatarSVG(p.name)}<div><b>${p.name}</b><span>${p.role} · ${p.city}</span></div></div><p class="hc__lbl">Can lend you</p><div class="hc__chips">${p.lend.map((x) => `<span>${x}</span>`).join('')}</div><p class="hc__foot">Hive Day: <b>${p.day}</b> · click to borrow a skill</p>`;
    }
    card.innerHTML = html;
    card.classList.toggle('hive__card--you', c === st.you || c.kind === 'open');
    const cw = card.offsetWidth || 262, ch = card.offsetHeight || 150;
    let x = c.x + st.s * 1.2;
    if (x + cw > st.W - 14) x = c.x - st.s * 1.2 - cw;
    const y = clamp(c.y - ch * 0.5, 84, st.H - ch - 14);
    card.style.left = `${Math.round(x)}px`;
    card.style.top = `${Math.round(y)}px`;
    card.classList.add('is-on');
  }

  window.addEventListener('pointermove', (e) => {
    st.pointer = { x: e.clientX, y: e.clientY };
    st.eyesDirty = true;
    if (e.pointerType !== 'touch') setHot(st.visible ? cellAt(e.clientX, e.clientY) : null);
    kick();
  }, { passive: true });
  window.addEventListener('scroll', () => { st.eyesDirty = true; kick(); }, { passive: true });
  root.addEventListener('pointerleave', () => setHot(null));
  root.addEventListener('click', (e) => {
    const c = cellAt(e.clientX, e.clientY);
    if (!c) return;
    setHot(c);
    if (c.kind === 'open') onOpenCell && onOpenCell();
    else if (c === st.you) identityCheck();
    else borrowFrom(c);
  });

  // ---------- pulses ----------
  function curve(a, b, k) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    const bend = (k < 0 ? -1 : 1) * L * Math.abs(k);
    const qx = (a.x + b.x) / 2 - (dy / L) * bend, qy = (a.y + b.y) / 2 + (dx / L) * bend;
    return { qx, qy, L, d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${qx.toFixed(1)} ${qy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}` };
  }

  function pulse(from, to, kind, onArrive) {
    if (!from || !to || !layerFx) { onArrive && onArrive(); return; }
    const cv = curve(from, to, (Math.random() < 0.5 ? -1 : 1) * 0.22);
    const g = document.createElementNS(NS, 'g');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', `trail trail--${kind}`);
    path.setAttribute('d', cv.d);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('class', `pdot pdot--${kind}`);
    dot.setAttribute('r', (st.s * (kind === 'you' ? 0.15 : 0.11)).toFixed(1));
    dot.setAttribute('cx', from.x.toFixed(1));
    dot.setAttribute('cy', from.y.toFixed(1));
    g.append(path, dot);
    g.style.opacity = '0';
    layerFx.appendChild(g);
    const len = path.getTotalLength();
    const seg = Math.min(len * 0.55, st.s * 3.4);
    path.style.strokeDasharray = `${seg.toFixed(1)} ${(len + seg).toFixed(1)}`;
    path.style.strokeDashoffset = seg.toFixed(1);
    st.pulses.push({ g, path, dot, x0: from.x, y0: from.y, qx: cv.qx, qy: cv.qy, x1: to.x, y1: to.y, len, seg, t0: performance.now(), dur: 620 + cv.L * 1.15, to, onArrive });
    kick();
  }

  function stepPulses(now) {
    for (let i = st.pulses.length - 1; i >= 0; i--) {
      const p = st.pulses[i];
      const t = Math.min(1, (now - p.t0) / p.dur);
      const e = easeInOut(t), u = 1 - e;
      const x = u * u * p.x0 + 2 * u * e * p.qx + e * e * p.x1;
      const y = u * u * p.y0 + 2 * u * e * p.qy + e * e * p.y1;
      p.dot.setAttribute('cx', x.toFixed(1));
      p.dot.setAttribute('cy', y.toFixed(1));
      p.path.style.strokeDashoffset = (p.seg - e * p.len).toFixed(1);
      p.g.style.opacity = String(t < 0.12 ? t / 0.12 : t > 0.88 ? (1 - t) / 0.12 : 1);
      if (t >= 1) {
        p.g.remove();
        st.pulses.splice(i, 1);
        popCell(p.to);
        p.onArrive && p.onArrive();
      }
    }
  }

  function popCell(c) {
    if (!c || !c.el || c === st.hot) return;
    const ci = c.el.querySelector('.ci');
    if (ci && ci.animate) ci.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  function randomFace() { return st.faces[(Math.random() * st.faces.length) | 0]; }
  function nearbyFace(a) {
    const w = SQ3 * st.s;
    const pool = st.faces.filter((c) => c !== a && Math.hypot(c.x - a.x, c.y - a.y) < w * 4.2);
    return pool[(Math.random() * pool.length) | 0];
  }

  // ---------- toasts ----------
  function toast(avatar, kicker, text, small) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${avatar}<div><span class="toast__k">${kicker}</span><p>${text}</p><small>${small}</small></div>`;
    toasts.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    const liveToasts = [...toasts.children].filter((n) => !n.classList.contains('is-out'));
    while (liveToasts.length > 2) {
      const old = liveToasts.shift();
      old.classList.add('is-out');
      setTimeout(() => old.remove(), 520);
    }
  }
  const borrowToast = (b) => toast(avatarSVG(b.name), 'Borrowed memory', `You now know <b>${b.skill}</b>`, `from ${b.name} · ${b.role}, ${b.city}`);

  function borrowFrom(c) {
    const skill = c.p.lend[(Math.random() * c.p.lend.length) | 0];
    pulse(c, st.you, 'you', () => toast(avatarSVG(c.p.name), 'You asked, they lent', `Borrowed: <b>${skill}</b>`, `from ${c.p.name} · ${c.p.role}, ${c.p.city}`));
  }

  function identityCheck() {
    popCell(st.you);
    toast(avatarSVG(st.youName || null, { you: true }), 'Identity check', '<b>Still 100% you.</b> Checked just now.', 'Individuality Guarantee · nothing to do');
  }

  function borrowTick() {
    if (!st.visible || document.hidden) return;
    const b = BORROWS[borrowIdx++ % BORROWS.length];
    const c = st.byName.get(b.name);
    if (c && st.you && !reduced) pulse(c, st.you, 'you', () => borrowToast(b));
    else borrowToast(b);
  }

  // ---------- loop ----------
  function kick() { if (!raf && st.visible) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (st.eyesDirty) { st.eyesDirty = false; updateEyes(); }
    if (st.pulses.length) stepPulses(now);
    if (st.pulses.length || st.eyesDirty) kick();
  }

  new IntersectionObserver(([e]) => {
    st.visible = e.isIntersecting;
    if (st.visible) { st.eyesDirty = true; kick(); } else setHot(null);
  }).observe(root);

  let resizeTimer = 0;
  new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => build(false), 120); }).observe(root);

  build(true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { st.eyesDirty = true; placeTag(); kick(); });

  setTimeout(() => borrowToast(BORROWS[0]), 250);
  setInterval(borrowTick, 3800);
  if (!reduced) {
    setInterval(() => {
      if (!st.visible || document.hidden || !st.faces.length) return;
      const a = randomFace();
      pulse(a, nearbyFace(a), 'ink');
    }, 720);
  }

  return {
    setYou(name) {
      st.youName = name;
      st.youSeed = hashString(name);
      if (st.you && st.you.el) {
        st.you.el.querySelector('.ci').innerHTML = youFace();
        bindEyes(st.you);
      }
      tag.innerHTML = `<b>You, ${escapeHTML(name.split(/\s+/)[0])}</b><span>still 100% you</span>`;
      placeTag();
      st.eyesDirty = true;
      kick();
    },
  };
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

import { PRESETS, CATEGORIES, GENERIC } from './data.js';
import { avatarSVG, hashString } from './faces.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initAsk({ section, form, input, chipsBox, results, field }) {
  chipsBox.innerHTML = PRESETS.map((p, i) => `<button type="button" class="chip" data-i="${i}">${p.q}</button>`).join('');
  let runId = 0, touched = false, typing = 0;

  chipsBox.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    touched = true;
    stopTyping();
    const p = PRESETS[+b.dataset.i];
    input.value = p.q;
    run(p.q, p.answers, null, b);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    touched = true;
    stopTyping();
    const q = input.value.trim();
    if (!q) {
      input.placeholder = 'Wonder anything — try “how do I fix a leaky tap?”';
      input.focus();
      return;
    }
    const m = match(q);
    run(q, m.answers, m.note, m.chip);
  });

  input.addEventListener('focus', () => { touched = true; stopTyping(); });

  function match(q) {
    const s = q.toLowerCase();
    const idx = PRESETS.findIndex((p) => p.q.toLowerCase() === s);
    if (idx >= 0) return { answers: PRESETS[idx].answers, chip: chipsBox.children[idx] };
    let best = null, bestScore = 0;
    for (const c of CATEGORIES) {
      let score = 0;
      for (const k of c.keys) if (s.includes(k)) score++;
      if (score > bestScore) { best = c; bestScore = score; }
    }
    if (best) return { answers: best.answers, note: best.note };
    const pool = GENERIC.slice(), out = [];
    let r = hashString(s);
    while (out.length < 3) {
      r = (Math.imul(r, 1103515245) + 12345) >>> 0;
      out.push(pool.splice(r % pool.length, 1)[0]);
    }
    return { answers: out };
  }

  function run(q, answers, note, chip) {
    const id = ++runId;
    [...chipsBox.children].forEach((c) => c.classList.toggle('is-on', c === chip));
    const consulted = 180000 + Math.floor(Math.random() * 620000);
    results.innerHTML = '<div class="ask__loading"><span class="hexspin"></span>Consulting the hive… <b>0</b> minds</div>';
    const counter = results.querySelector('b');
    if (field) {
      const sr = section.getBoundingClientRect(), fr = form.getBoundingClientRect();
      field.ripple(fr.left + fr.width / 2 - sr.left, fr.top + fr.height / 2 - sr.top);
    }
    const t0 = performance.now(), dur = 1100;
    const tick = (now) => {
      if (id !== runId) return;
      const p = Math.min(1, (now - t0) / dur);
      counter.textContent = Math.round(consulted * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(tick);
      else render();
    };
    requestAnimationFrame(tick);

    function render() {
      const secs = (0.28 + Math.random() * 0.3).toFixed(2);
      results.innerHTML = `<div class="ask__meta"><q>${esc(q)}</q><span><b>${consulted.toLocaleString('en-US')}</b> minds consulted</span><span><b>3</b> answered</span><span><b>${secs} s</b> start to finish</span></div><div class="answers">${answers.map(card).join('')}</div>${note ? `<p class="ask__warn">${note}</p>` : ''}`;
    }
  }

  function card(a, i) {
    const first = a.name.split(' ')[0];
    return `<article class="answer" style="--d:${i * 140}ms"><header>${avatarSVG(a.name)}<div><b>${a.name}</b><span>${a.role} · ${a.city}</span></div><span class="answer__conf">${a.conf}% sure</span></header><p>${a.text}</p><footer><button type="button" class="answer__thanks" data-first="${first}"><svg class="i"><use href="#i-heart"/></svg>Thank ${first}</button><span class="answer__tag">fades in ~30 days<br>unless you practise</span></footer></article>`;
  }

  results.addEventListener('click', (e) => {
    const b = e.target.closest('.answer__thanks');
    if (!b || b.classList.contains('is-done')) return;
    b.classList.add('is-done');
    b.innerHTML = `<svg class="i"><use href="#i-heart"/></svg>${b.dataset.first} felt that`;
  });

  // First visit: type the first example by itself so the section never sits empty.
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    if (!touched) setTimeout(autoType, 450);
  }, { threshold: 0.3 });
  io.observe(section);

  function autoType() {
    if (touched) return;
    const p = PRESETS[0];
    let i = 0;
    input.value = '';
    typing = setInterval(() => {
      if (touched) { stopTyping(); return; }
      input.value = p.q.slice(0, ++i);
      if (i >= p.q.length) {
        stopTyping();
        run(p.q, p.answers, null, chipsBox.children[0]);
      }
    }, 42);
  }

  function stopTyping() {
    clearInterval(typing);
    typing = 0;
  }
}

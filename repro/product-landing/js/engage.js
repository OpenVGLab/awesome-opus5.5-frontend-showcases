import { qs, qsa, clamp, motionOK, observe, on, emit, toast, openDialog, session, storage, pad2, money } from './core.js';
import { applyConfig, addHush, addProduct, quote, getConfig, FINISH_LABEL, CUSHION_LABEL, CATALOG } from './commerce.js';

/* ---------- testimonial slider ---------- */
function initSlider() {
  const root = qs('[data-slider]');
  const viewport = qs('[data-slider-viewport]', root);
  const track = qs('[data-slider-track]', root);
  const slides = qsa('.slide', track);
  const dots = qs('[data-slider-dots]', root);
  const progress = qs('[data-slider-progress]', root);
  const pauseBtn = qs('[data-slider-pause]', root);
  const DURATION = 6500;
  let visible = slides;
  let index = 0;
  let elapsed = 0;
  let paused = !motionOK();
  let hovering = false;
  let inView = false;
  let last = performance.now();

  const go = (i) => {
    index = (i + visible.length) % visible.length;
    track.style.transform = `translateX(${-index * 100}%)`;
    qsa('.dot-btn', dots).forEach((d, j) => d.setAttribute('aria-current', String(j === index)));
    visible.forEach((s, j) => {
      s.setAttribute('aria-hidden', String(j !== index));
      s.inert = j !== index;
    });
    elapsed = 0;
  };
  const build = () => {
    visible = slides.filter((s) => !s.hidden);
    dots.textContent = '';
    visible.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot-btn';
      b.setAttribute('aria-label', `Testimonial ${i + 1} of ${visible.length}: ${qs('.quote-head b', s).textContent}`);
      b.addEventListener('click', () => go(i));
      dots.appendChild(b);
    });
    go(0);
  };
  qsa('[data-filter]', root).forEach((chip) => chip.addEventListener('click', () => {
    qsa('[data-filter]', root).forEach((c) => {
      c.classList.toggle('is-active', c === chip);
      c.setAttribute('aria-pressed', String(c === chip));
    });
    const f = chip.dataset.filter;
    slides.forEach((s) => {
      s.hidden = f !== 'all' && !s.dataset.tags.split(' ').includes(f);
    });
    build();
  }));
  qs('[data-slider-prev]', root).addEventListener('click', () => go(index - 1));
  qs('[data-slider-next]', root).addEventListener('click', () => go(index + 1));
  const setPaused = (p) => {
    paused = p;
    track.setAttribute('aria-live', p ? 'polite' : 'off');
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.setAttribute('aria-label', p ? 'Resume autoplay' : 'Pause autoplay');
  };
  setPaused(paused);
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  root.addEventListener('pointerenter', () => { hovering = true; });
  root.addEventListener('pointerleave', () => { hovering = false; });
  root.addEventListener('focusin', () => { hovering = true; });
  root.addEventListener('focusout', () => { hovering = false; });
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
  });
  let startX = null;
  let dx = 0;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    startX = e.clientX;
    dx = 0;
    track.style.transition = 'none';
  });
  addEventListener('pointermove', (e) => {
    if (startX === null) return;
    dx = e.clientX - startX;
    track.style.transform = `translateX(calc(${-index * 100}% + ${dx}px))`;
  });
  const end = () => {
    if (startX === null) return;
    track.style.transition = '';
    startX = null;
    if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1));
    else go(index);
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  observe([root], (e) => { inView = e.isIntersecting; }, { threshold: 0.3 });
  const loop = (now) => {
    const dt = now - last;
    last = now;
    if (!paused && !hovering && inView && !document.hidden && startX === null) {
      elapsed += dt;
      if (elapsed >= DURATION) go(index + 1);
    }
    progress.style.transform = `scaleX(${clamp(elapsed / DURATION, 0, 1).toFixed(4)})`;
    requestAnimationFrame(loop);
  };
  build();
  requestAnimationFrame(loop);
}

/* ---------- live chat + recommendation bot ---------- */
function initChat() {
  const root = qs('[data-chat]');
  const launcher = qs('[data-chat-launcher]', root);
  const panel = qs('[data-chat-panel]', root);
  const log = qs('[data-chat-log]', root);
  const quick = qs('[data-chat-quick]', root);
  const form = qs('[data-chat-form]', root);
  const input = qs('[data-chat-input]', root);
  const badge = qs('[data-chat-badge]', root);
  const greet = qs('[data-chat-greet]', root);
  const status = qs('[data-chat-status]', root);
  const tabs = qsa('[data-chat-mode]', root);
  const logs = { support: [], bot: [] };
  const quicks = { support: [], bot: [] };
  let mode = 'support';
  let open = false;
  let cd = { d: 2, h: 0, m: 0 };
  on('countdown', (v) => { cd = v; });
  const cdText = () => (cd.d ? `${cd.d} day${cd.d > 1 ? 's' : ''} ${cd.h} h` : `${cd.h} h ${cd.m} min`);
  const time = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const push = (m, node) => {
    logs[m].push(node);
    if (m === mode) {
      log.appendChild(node);
      log.scrollTop = log.scrollHeight;
    }
  };
  const say = (m, who, content, { html = false } = {}) => {
    const el = document.createElement('div');
    el.className = `msg ${who}`;
    const body = document.createElement('div');
    if (html) body.innerHTML = content;
    else body.textContent = content;
    const t = document.createElement('time');
    t.textContent = who === 'agent' ? `${m === 'bot' ? 'Hush Assistant' : 'Maya'} · ${time()}` : time();
    el.append(body, t);
    push(m, el);
    if (!open && who === 'agent') {
      badge.hidden = false;
      badge.textContent = String(Number(badge.textContent || 0) + 1);
    }
    return el;
  };
  const system = (m, text) => {
    const el = document.createElement('p');
    el.className = 'msg-sys';
    el.textContent = text;
    push(m, el);
  };
  const setQuick = (m, options) => {
    quicks[m] = options;
    if (m !== mode) return;
    quick.textContent = '';
    options.forEach(([label, fn]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => fn(label));
      quick.appendChild(b);
    });
    log.scrollTop = log.scrollHeight;
  };
  const typing = (m, ms, fn) => {
    const el = document.createElement('div');
    el.className = 'msg agent typing';
    el.setAttribute('aria-label', 'Typing');
    el.innerHTML = '<span></span><span></span><span></span>';
    push(m, el);
    if (m === 'support') status.textContent = 'Maya is typing…';
    setTimeout(() => {
      el.remove();
      logs[m] = logs[m].filter((n) => n !== el);
      if (m === 'support') status.textContent = 'Maya is online · replies in ~1 min';
      fn();
    }, motionOK() ? ms : 50);
  };

  const REPLIES = [
    [/ship|deliver|arriv|when will/i, () => 'Orders placed before 3 pm ship the same day. Standard 2-day delivery is free, and next-day express is $12 — free on orders over $300.'],
    [/return|refund|money back|not right/i, () => 'You get 30 days to try Hush One at home. If they’re not for you, we collect them for free and refund you within 3 business days.'],
    [/glass|comfort|fit|heavy|weigh|head|ear/i, () => 'They weigh 248 g, and the cushions have a relief channel for glasses arms. Most people wear them for 6+ hours without hot spots. The knit cushions run cooler if you get warm.'],
    [/battery|charg|hours|last/i, () => 'Up to 40 hours with ANC on, and 5 minutes of USB-C charging gives you 5 hours. The battery is user-replaceable in about two minutes.'],
    [/discount|code|coupon|deal|price|cheap|expens|sale|offer/i, () => `The launch price is $239 (20% off) for the next ${cdText()}. You can also use code <b>STAY10</b> at checkout for an extra 10% off.`],
    [/android|iphone|ios|windows|mac|pc|compat|bluetooth|pair|ldac|aac|laptop/i, () => 'Yes — Bluetooth 5.4 with AAC, LDAC and LC3. They pair with iPhone, Android, Windows and Mac, and stay connected to two devices at once.'],
    [/warrant|repair|broke|damage|care/i, () => 'Every pair has a 2-year warranty. Hush Care+ ($29) extends it to 3 years and adds accidental damage cover.'],
    [/anc|noise|cancel|quiet|plane|flight|train|subway/i, () => 'Adaptive ANC cuts up to 42 dB and retunes 200 times a second. Try the “Hear the difference” demo in <a href="#how">How it works</a>.'],
    [/colou?r|finish|black|white|grey|gray|graphite|chalk|carbon/i, () => 'There are three finishes: Carbon (black), Graphite (grey) and Chalk (warm white). You can preview each in the <a href="#showcase">360° viewer</a>.'],
    [/human|person|real|agent|bot/i, () => 'This page is a demo, so my replies are simulated — on a live store you’d be chatting with the support team right here.'],
    [/^(hi|hello|hey|hiya|yo)\b/i, () => 'Hi there! What can I help with — shipping, fit, battery life or picking a finish?'],
    [/thank|thx|cheers/i, () => 'Anytime! Anything else I can help with?'],
  ];
  const answer = (text) => {
    const hit = REPLIES.find(([re]) => re.test(text));
    return hit ? hit[1]() : 'Good question! I’ve flagged it for a product specialist. Meanwhile, the <a href="#faq">FAQ</a> covers most details — or ask me about shipping, returns, battery or compatibility.';
  };
  const supportQuick = () => setQuick('support', [
    ['When will it arrive?', ask],
    ['Comfortable with glasses?', ask],
    ['Return policy', ask],
    ['Any discount codes?', ask],
  ]);
  function ask(text) {
    const clean = text.trim();
    if (!clean) return;
    say('support', 'user', clean);
    setQuick('support', []);
    typing('support', 900 + Math.random() * 700, () => {
      say('support', 'agent', answer(clean), { html: true });
      supportQuick();
    });
  }

  /* recommendation bot */
  const answers = {};
  const QUESTIONS = [
    ['use', 'Where will you use them most?', [['Commuting & travel', 'travel'], ['Office & focus', 'work'], ['Workouts', 'fitness'], ['Music & creating', 'music']]],
    ['finish', 'Which finish speaks to you?', [['Carbon (black)', 'carbon'], ['Graphite (grey)', 'graphite'], ['Chalk (white)', 'chalk'], ['Surprise me', 'any']]],
    ['need', 'Do you wear glasses, or run warm?', [['I wear glasses', 'glasses'], ['I run warm', 'warm'], ['Neither', 'none']]],
    ['extra', 'Anything else you’d like?', [['Protect them on the go', 'case'], ['Charge on my desk', 'dock'], ['Keep it simple', 'none']]],
  ];
  const REASONS = {
    travel: '−42 dB ANC is tuned for engine rumble, and 40 hours covers the longest trips.',
    work: 'Multipoint keeps laptop and phone connected, and beamforming mics keep calls clear.',
    fitness: 'Secure clamping and sweat-resistant materials that stay put on the move.',
    music: '40 mm drivers with LDAC bring out detail without harshness.',
    glasses: 'Protein-leather cushions with a relief channel keep the seal around glasses arms.',
    warm: 'Breathable knit cushions keep your ears cool on long sessions.',
    none: 'Protein-leather cushions give the deepest seal for noise cancelling.',
  };
  const askBot = (i) => {
    const [key, q, opts] = QUESTIONS[i];
    typing('bot', 650, () => {
      say('bot', 'agent', q);
      setQuick('bot', opts.map(([label, value]) => [label, () => {
        answers[key] = value;
        say('bot', 'user', label);
        setQuick('bot', []);
        if (i + 1 < QUESTIONS.length) askBot(i + 1);
        else recommend();
      }]));
    });
  };
  const recommend = () => {
    const byUse = { travel: 'carbon', work: 'graphite', fitness: 'chalk', music: 'carbon' };
    const finish = answers.finish === 'any' ? byUse[answers.use] : answers.finish;
    const cushion = answers.need === 'warm' || answers.use === 'fitness' ? 'knit' : 'leather';
    const addons = answers.extra === 'none' ? [] : [answers.extra];
    const rec = { finish, cushion, addons, qty: 1, tradein: 0 };
    const q = quote({ ...getConfig(), ...rec });
    typing('bot', 1100, () => {
      say('bot', 'agent', 'Here’s what I’d pick for you:');
      const card = document.createElement('div');
      card.className = 'rec-card';
      card.innerHTML = `
        <img src="img/finish-${finish}.webp" width="76" height="76" alt="">
        <div><b></b><p class="rec-sub"></p><p class="rec-why"></p><p class="rec-price"></p></div>
        <div class="rec-actions">
          <button class="btn btn-outline" type="button" data-rec-apply>Apply to builder</button>
          <button class="btn btn-primary" type="button" data-rec-add>Add to bag</button>
        </div>`;
      qs('b', card).textContent = `Hush One · ${FINISH_LABEL[finish]}`;
      qs('.rec-sub', card).textContent = [CUSHION_LABEL[cushion], ...addons.map((a) => CATALOG[a].name)].join(' · ');
      qs('.rec-why', card).textContent = `${REASONS[answers.use]} ${REASONS[answers.need]}`;
      qs('.rec-price', card).textContent = money(q.total);
      qs('[data-rec-apply]', card).addEventListener('click', () => {
        applyConfig(rec);
        setOpen(false);
        toast('Recommendation applied to the builder', 'sparkle');
        qs('#buy').scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'start' });
      });
      qs('[data-rec-add]', card).addEventListener('click', () => {
        applyConfig(rec);
        addHush(getConfig(), 1);
        addons.forEach((a) => addProduct(a));
        toast(`Hush One in ${FINISH_LABEL[finish]} added to your bag`, 'bag');
      });
      push('bot', card);
      setQuick('bot', [['Start over', () => {
        say('bot', 'user', 'Start over');
        setQuick('bot', []);
        askBot(0);
      }], ['Talk to a person', () => setMode('support')]]);
    });
  };

  const render = () => {
    log.textContent = '';
    logs[mode].forEach((n) => log.appendChild(n));
    log.scrollTop = log.scrollHeight;
    setQuick(mode, quicks[mode]);
    input.placeholder = mode === 'bot' ? 'Pick an option above, or type a question…' : 'Type your message…';
  };
  function setMode(m) {
    mode = m;
    tabs.forEach((t) => {
      const on = t.dataset.chatMode === m;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    if (m === 'bot' && !logs.bot.length) {
      say('bot', 'agent', 'Hi! I’m the Hush Assistant. Answer four quick questions and I’ll recommend the right setup for you.');
      askBot(0);
    }
    render();
  }
  function setOpen(state, m) {
    open = state;
    panel.hidden = !state;
    launcher.setAttribute('aria-expanded', String(state));
    launcher.setAttribute('aria-label', state ? 'Close chat' : 'Open chat');
    greet.hidden = true;
    if (state) {
      badge.hidden = true;
      badge.textContent = '0';
      if (!logs.support.length) {
        system('support', 'Demo chat — replies are simulated');
        say('support', 'agent', 'Hi, I’m Maya from Hush. Ask me anything about fit, shipping, returns or tech specs.');
        supportQuick();
      }
      setMode(m || mode);
      setTimeout(() => input.focus({ preventScroll: true }), 50);
    }
  }
  launcher.addEventListener('click', () => setOpen(!open));
  qs('[data-chat-close]', root).addEventListener('click', () => {
    setOpen(false);
    launcher.focus();
  });
  tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.chatMode)));
  qs('.chat-tabs', root).addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = mode === 'support' ? 'bot' : 'support';
      setMode(next);
      qs(`[data-chat-mode="${next}"]`, root).focus();
    }
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      launcher.focus();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    if (mode === 'bot') setMode('support');
    ask(text);
  });
  qsa('[data-open-chat]').forEach((b) => b.addEventListener('click', () => setOpen(true, b.dataset.openChat)));
  on('chat:open', (m) => setOpen(true, m));
  qs('[data-chat-greet-close]', root).addEventListener('click', () => { greet.hidden = true; });
  setTimeout(() => {
    if (!open && !document.querySelector('dialog[open]') && !session.get('greeted')) {
      session.set('greeted', '1');
      greet.hidden = false;
      badge.hidden = false;
      badge.textContent = '1';
      setTimeout(() => { greet.hidden = true; }, 9000);
    }
  }, 14000);
}

/* ---------- exit-intent offer ---------- */
function initExitIntent() {
  const dlg = qs('#exit-modal');
  const armedAt = Date.now() + 6000;
  const trigger = () => {
    if (Date.now() < armedAt || session.get('exit') || document.querySelector('dialog[open]')) return;
    session.set('exit', '1');
    openDialog(dlg);
  };
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget && e.clientY <= 0) trigger();
  });
  // Touch devices have no mouse exit, so a sustained upward fling deep in the page stands in for it.
  // Jumps from links/buttons (anchor scrolls, "back to top") are ignored.
  let lastY = scrollY;
  let lastT = performance.now();
  let flingFrames = 0;
  let lastTap = 0;
  addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a, button')) lastTap = performance.now(); });
  addEventListener('scroll', () => {
    const now = performance.now();
    const dy = scrollY - lastY;
    const v = dy / Math.max(1, now - lastT);
    const programmatic = Math.abs(dy) > innerHeight * 1.2 || now - lastTap < 1500;
    flingFrames = !programmatic && v < -2.2 ? flingFrames + 1 : 0;
    if (flingFrames >= 3 && scrollY > innerHeight * 2 && window.matchMedia('(pointer: coarse)').matches) trigger();
    lastY = scrollY;
    lastT = now;
  }, { passive: true });
  const form = qs('[data-exit-form]', dlg);
  const msg = qs('[data-exit-msg]', dlg);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = qs('#exit-email', dlg);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
      msg.textContent = 'Please enter a valid email address.';
      msg.classList.add('is-error');
      email.setAttribute('aria-invalid', 'true');
      email.focus();
      return;
    }
    email.removeAttribute('aria-invalid');
    msg.classList.remove('is-error');
    msg.textContent = 'Unlocked! Use this code at checkout within 24 hours.';
    form.hidden = true;
    qs('[data-exit-code]', dlg).hidden = false;
    qs('[data-exit-code] button', dlg).focus();
  });
}

/* ---------- lead magnet ---------- */
function initLeads() {
  const form = qs('[data-lead-form]');
  const input = qs('#lead-email');
  const msg = qs('[data-lead-msg]');
  const success = qs('[data-lead-success]');
  const stored = storage.get('lead', null);
  const showSuccess = (email) => {
    form.hidden = true;
    success.hidden = false;
    qs('[data-lead-email]').textContent = email;
  };
  if (stored) showSuccess(stored);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      msg.textContent = email ? 'That email doesn’t look quite right.' : 'Please enter your email address.';
      msg.classList.add('is-error');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    msg.classList.remove('is-error');
    const btn = qs('button[type="submit"]', form);
    btn.disabled = true;
    qs('span', btn).textContent = 'Sending…';
    setTimeout(() => {
      storage.set('lead', email);
      showSuccess(email);
      qs('.success-title', success).setAttribute('tabindex', '-1');
      qs('.success-title', success).focus();
      toast('Playbook sent — check your inbox', 'mail');
    }, 900);
  });
}

/* ---------- product film with a sticky mini player ---------- */
function initFilm() {
  const frame = qs('[data-film-frame]');
  const film = qs('[data-film]');
  const video = qs('[data-film-video]');
  const seek = qs('[data-film-seek]');
  const time = qs('[data-film-time]');
  const chapterBtns = qsa('[data-seek]');
  const marks = chapterBtns.map((b) => Number(b.dataset.seek));
  let sourced = false;
  let dismissed = false;
  let frameVisible = true;
  const fmt = (s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;
  const ensure = () => {
    if (sourced) return;
    sourced = true;
    if (!video.poster) video.poster = video.dataset.poster;
    qsa('source', video).forEach((s) => { s.src = s.dataset.src; });
    video.load();
  };
  observe([frame], (e, io) => {
    if (e.isIntersecting) {
      if (!video.poster) video.poster = video.dataset.poster;
      io.disconnect();
    }
  }, { rootMargin: '500px 0px' });
  const play = () => {
    ensure();
    dismissed = false;
    const p = video.play();
    if (p) p.catch(() => {});
  };
  const toggle = () => (video.paused ? play() : video.pause());
  const labels = () => {
    qsa('[data-film-toggle]', film).forEach((b) => b.setAttribute('aria-label', video.paused ? 'Play product film' : 'Pause product film'));
  };
  qsa('[data-film-toggle]', film).forEach((b) => b.addEventListener('click', toggle));
  video.addEventListener('click', toggle);
  video.addEventListener('play', () => {
    film.classList.add('is-playing', 'is-started');
    labels();
    dock();
  });
  video.addEventListener('pause', () => {
    film.classList.remove('is-playing');
    labels();
  });
  const render = () => {
    const d = video.duration || 15;
    const c = video.currentTime || 0;
    seek.value = String(Math.round((c / d) * 1000));
    seek.style.setProperty('--p', `${((c / d) * 100).toFixed(2)}%`);
    time.textContent = `${fmt(c)} / ${fmt(d)}`;
    chapterBtns.forEach((b, i) => {
      const s = marks[i];
      const e = marks[i + 1] ?? d;
      const cur = c >= s && c < e;
      b.classList.toggle('is-current', cur && film.classList.contains('is-started'));
      b.style.setProperty('--cp', `${(clamp((c - s) / (e - s), 0, 1) * 100).toFixed(1)}%`);
    });
  };
  video.addEventListener('timeupdate', render);
  video.addEventListener('loadedmetadata', render);
  seek.addEventListener('input', () => {
    ensure();
    const apply = () => { video.currentTime = (Number(seek.value) / 1000) * (video.duration || 15); };
    if (video.readyState >= 1) apply();
    else video.addEventListener('loadedmetadata', apply, { once: true });
  });
  chapterBtns.forEach((b) => b.addEventListener('click', () => {
    ensure();
    const go = () => {
      video.currentTime = Number(b.dataset.seek);
      play();
    };
    if (video.readyState >= 1) go();
    else video.addEventListener('loadedmetadata', go, { once: true });
  }));
  const pip = qs('[data-film-pip]', film);
  if (!document.pictureInPictureEnabled) pip.hidden = true;
  pip.addEventListener('click', () => {
    ensure();
    video.requestPictureInPicture().catch(() => {});
  });
  qs('[data-film-full]', film).addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (film.requestFullscreen) film.requestFullscreen().catch(() => {});
  });
  qsa('[data-play-film]').forEach((b) => b.addEventListener('click', () => {
    frame.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'center' });
    play();
  }));
  function dock() {
    const docked = film.classList.contains('is-docked');
    const should = !frameVisible && !dismissed && film.classList.contains('is-started') && (!video.paused || docked);
    if (should === docked) return;
    film.classList.toggle('is-docked', should);
    frame.classList.toggle('is-holding', should);
    document.body.classList.toggle('has-mini', should);
    emit('mini', should);
  }
  observe([frame], (e) => {
    frameVisible = e.intersectionRatio > 0.2;
    dock();
  }, { threshold: [0, 0.2, 0.5] });
  qs('[data-film-close]', film).addEventListener('click', () => {
    video.pause();
    dismissed = true;
    dock();
  });
  qs('[data-film-return]', film).addEventListener('click', () => {
    frame.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'center' });
  });
  render();
}

export function initEngage() {
  initSlider();
  initChat();
  initExitIntent();
  initLeads();
  initFilm();
}

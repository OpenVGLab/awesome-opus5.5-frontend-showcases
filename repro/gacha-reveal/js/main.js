import { World } from './world.js';
import { SPIRITS, RARITY, ELEMENTS, byId, PICKUP_ID, cardFace, thumb } from './cards.js';
import { Sound } from './audio.js';
import { FX2D } from './fx2d.js';
import { Clock, Ease, SKIP } from './util.js';

const $ = (s) => document.querySelector(s);
const clock = new Clock();
const sound = new Sound();
let world, fx;

const RATES = { SSR: 0.06, SR: 0.24 };
const PITY_MAX = 90;
const COST = { 1: 300, 10: 3000 };
const AUTO_DELAY = [0.8, 1.4, 2.6];
const POOL = {
  SSR: SPIRITS.filter((s) => s.rarity === 'SSR'),
  SR: SPIRITS.filter((s) => s.rarity === 'SR'),
  R: SPIRITS.filter((s) => s.rarity === 'R'),
};

const state = {
  phase: 'loading',
  gems: 30000,
  tickets: 2,
  pity: 0,
  firstTen: true,
  owned: new Set(),
  auto: true,
  muted: false,
  last: { n: 10, mode: 'normal' },
};
let rng = Math.random;
// Stage marker for automated screenshots (window.GACHA.stage / .stages).
const dbg = {
  cur: '',
  log: [],
  set stage(v) {
    this.cur = v;
    this.log.push(v);
  },
  get stage() {
    return this.cur;
  },
};
let session = null;
let tapAccept = false;
let tapped = false;

const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.6l3.2 6.6 7.2 1-5.2 5.1 1.3 7.2L12 18l-6.5 3.5 1.3-7.2L1.6 9.2l7.2-1z"/></svg>';
const fmt = (n) => n.toLocaleString('en-US');

/* ================================================================== gacha */

function rollRarity() {
  const r = rng();
  return r < RATES.SSR ? 'SSR' : r < RATES.SSR + RATES.SR ? 'SR' : 'R';
}

function pickSpirit(rarity) {
  if (rarity === 'SSR' && rng() < 0.5) return byId[PICKUP_ID];
  const pool = POOL[rarity];
  return pool[Math.floor(rng() * pool.length)];
}

function roll(n, mode, force) {
  const guaranteeSlot = (mode === 'normal' && n === 10 && state.firstTen) || mode === 'ticket' ? Math.floor(rng() * n) : -1;
  const out = [];
  for (let i = 0; i < n; i++) {
    let rar = force ? force[i] || 'R' : rollRarity();
    let sp = null;
    if (!force) {
      if (n === 10 && i === n - 1 && rar === 'R') rar = 'SR';
      if (i === guaranteeSlot) rar = 'SSR';
      if (state.pity + 1 >= PITY_MAX) {
        rar = 'SSR';
        sp = byId[PICKUP_ID];
      }
      if (i === guaranteeSlot && mode === 'normal') sp = byId[PICKUP_ID];
    }
    sp = sp || pickSpirit(rar);
    state.pity = rar === 'SSR' ? 0 : state.pity + 1;
    const isNew = !state.owned.has(sp.id);
    state.owned.add(sp.id);
    const tier = RARITY[rar].tier;
    // Some SSRs start out looking gold and get promoted mid-reveal.
    const disp = tier === 2 && mode !== 'ticket' && rng() < 0.4 ? 1 : tier;
    out.push({ sp, rarity: rar, tier, disp, isNew });
  }
  if (mode === 'normal' && n === 10) state.firstTen = false;
  return out;
}

// Altar colour sequence: it can only ever promote, never show more than the real best card.
function altarPlan(results, mode) {
  const max = Math.max(...results.map((r) => r.tier));
  if (mode === 'ticket') return { seq: [2], sign: 'SSR確定召喚' };
  const r = rng();
  if (max === 0) return { seq: [0] };
  if (max === 1) return { seq: r < 0.5 ? [0, 1] : [1] };
  if (r < 0.35) return { seq: [0, 1, 2] };
  if (r < 0.7) return { seq: [1, 2] };
  if (r < 0.85) return { seq: [0, 2] };
  return { seq: [2], sign: '── 虹の兆し ──' };
}

/* ================================================================== sequence helpers */

function step(p) {
  const s = session;
  return Promise.resolve(p).then(() => {
    if (!s || s.skipped) throw SKIP;
  });
}

const w = (sec) => step(clock.wait(sec));

async function waitTap(autoDelay) {
  tapped = false;
  tapAccept = true;
  ui.tapHint(true);
  const start = clock.t;
  while (!tapped && !(state.auto && clock.t - start >= autoDelay)) await w(0.05);
  tapAccept = false;
  ui.tapHint(false);
}

function onTap() {
  if (state.phase !== 'seq') return;
  if (tapAccept && !tapped) {
    tapped = true;
    sound.tap();
  }
}

function doSkip() {
  if (state.phase !== 'seq' || !session || session.skipped) return;
  sound.click();
  session.skipped = true;
  session.onSkip();
  clock.flush();
}

const center = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

/* ================================================================== summon flow */

async function startPull(n, mode = 'normal', opts = {}) {
  if (state.phase !== 'home' && state.phase !== 'results') return;
  sound.init();
  if (mode === 'ticket') {
    if (state.tickets <= 0) {
      toast('SSR確定チケットがありません');
      return;
    }
    state.tickets--;
  } else {
    const cost = COST[n];
    if (state.gems < cost) {
      state.gems += 30000;
      toast('星晶石を 30,000 補充しました（デモ）');
    }
    state.gems -= cost;
  }
  sound.click();
  state.last = { n, mode };
  const results = roll(n, mode, opts.force);
  if (opts.disp) results.forEach((r, i) => (r.disp = opts.disp[i] ?? r.disp));
  const plan = altarPlan(results, mode);
  if (opts.altar) plan.seq = opts.altar;
  results.forEach((r) => (r.face = cardFace(r.sp)));
  updateHud();

  state.phase = 'seq';
  session = { skipped: false };
  const skipP = new Promise((res) => (session.onSkip = res));
  showScreen('seq');
  ui.info.hide();
  ui.strip.setup(results);
  await Promise.race([
    runSequence(results, plan).catch((e) => {
      if (e !== SKIP) console.error(e);
    }),
    skipP,
  ]);
  session = null;
  finishSequence(results);
}

async function runSequence(results, plan) {
  const n = results.length;
  sound.duckMusic(true);
  world.prepareShards(results.map((r) => r.disp));
  const first = plan.seq[0];
  world.setTier(first);
  const chargeDur = 2.3;
  if (plan.sign) {
    ui.promo(plan.sign);
    fx.flash('#ffffff', 0.6, 0.5);
  }
  dbg.stage = 'charge';
  sound.summonStart(first, chargeDur);
  world.altarWave(first);
  world.pulse(0.7);
  world.tweenCamera('charge', chargeDur + 0.3, Ease.inOutCubic);
  clock.tween(chargeDur, (k) => (world.charge = k * 0.8), Ease.inQuad);
  await w(chargeDur);
  for (let k = 1; k < plan.seq.length; k++) await promote(plan.seq[k]);

  dbg.stage = 'climax';
  sound.climax(0.6);
  world.shake(0.25);
  clock.tween(0.6, (k) => {
    world.crystalScale = 1 - 0.45 * Ease.inCubic(k);
    world.charge = 0.8 + 0.2 * k;
  });
  await w(0.6);
  const top = plan.seq[plan.seq.length - 1];
  dbg.stage = 'burst';
  fx.flash('#ffffff', 0.85, 1);
  sound.burst();
  world.explode(top);
  world.launchShards(1.35);
  step(clock.wait(1.3)).then(() => world.setTier(-1), () => {});
  world.tweenCamera('reveal', 1.9, Ease.inOutCubic);
  clock.tween(1.4, (k) => (world.charge = 1 - 0.8 * k), Ease.outQuad);
  await w(n > 1 ? 1.6 : 2.0);
  ui.strip.show();
  if (n > 1) await w(0.7);
  for (let i = 0; i < n; i++) await revealCard(results[i], i, n);
}

async function promote(tier) {
  dbg.stage = `promote${tier}`;
  world.setTier(tier);
  world.pulse(tier === 2 ? 1.6 : 1.0);
  world.shake(tier === 2 ? 0.45 : 0.25);
  world.promoBurst(tier);
  fx.flash(tier === 2 ? '#ffffff' : '#ffe6a8', 0.35, tier === 2 ? 0.9 : 0.6);
  sound.promote(tier);
  if (tier === 2) fx.speedLines(1.2, { color: 'rgba(255,255,255,0.7)', inner: 0.34 });
  await w(tier === 2 ? 1.3 : 1.0);
}

async function revealCard(r, i, n) {
  dbg.stage = `card${i}:fly`;
  ui.strip.current(i);
  sound.shardFly();
  await step(world.shardToCard(i, 0.42));
  dbg.stage = `card${i}:show`;
  world.cardShow(r.face, r.disp);
  sound.cardAppear(r.disp);
  await w(0.45);
  if (r.tier === 0) {
    world.cardFlip(0.45, 1);
    sound.flip(0);
    await w(0.25);
    world.cardBurst(0);
    sound.revealR();
    world.glint(0.8);
    await w(0.2);
  } else if (r.disp === 1) {
    dbg.stage = `card${i}:gold`;
    world.setRays(0.9, 0.5);
    sound.goldCharge(0.9);
    await step(world.cardShake(0.9, 0.05));
    if (r.tier === 2) {
      dbg.stage = `card${i}:crack`;
      await crackToRainbow(i);
      await ssrReveal(i);
    } else {
      fx.flash('#fff4cc', 0.35, 0.75);
      world.cardFlip(0.75, 3, Ease.outCubic);
      sound.flip(1);
      await w(0.35);
      world.cardBurst(1);
      sound.goldReveal();
      world.shake(0.2);
      world.glint(1.0);
      await w(0.3);
    }
  } else {
    await ssrReveal(i);
  }
  await afterReveal(r, i, n);
}

async function crackToRainbow(i) {
  world.setRays(0, 0.12);
  sound.silence(0.55);
  await w(0.55);
  const c = center();
  dbg.stage = `card${i}:crack1`;
  fx.cracks(c.x, c.y, 1);
  sound.crack(1);
  world.shake(0.2);
  await w(0.55);
  dbg.stage = `card${i}:crack2`;
  fx.cracks(c.x, c.y, 2);
  sound.crack(2);
  world.shake(0.35);
  await w(0.5);
  dbg.stage = `card${i}:shatter`;
  fx.shatter();
  fx.flash('#ffffff', 0.55, 1);
  sound.shatter();
  world.setCardTier(2);
  await w(0.15);
}

async function ssrReveal(i) {
  dbg.stage = `card${i}:lightning`;
  world.setCardTier(2);
  world.setDim(0.9, 0.25);
  fx.impact();
  const c = center();
  const cols = ['#c9b6ff', '#9fe6ff', '#ffc6f0'];
  for (let k = 0; k < 3; k++) {
    const x0 = window.innerWidth * (0.12 + Math.random() * 0.76);
    fx.lightning(x0, -20, c.x + (Math.random() - 0.5) * 80, c.y - 60 + Math.random() * 120, { color: cols[k] });
    sound.thunder();
    world.shake(0.35);
    await w(0.3);
  }
  dbg.stage = `card${i}:cutin`;
  world.cardSpin(true);
  world.setRays(1.3, 0.4);
  fx.speedLines(2.3, { color: 'rgba(255,255,255,0.85)', inner: 0.3 });
  ui.cutin(true);
  sound.ssrFanfare();
  await w(2.1);
  dbg.stage = `card${i}:flip`;
  ui.cutin(false);
  fx.flash('#ffffff', 0.9, 1);
  world.cardSpinToFace(0.75);
  world.setHolo(1, 0.8);
  world.cardBurst(2);
  sound.ssrReveal();
  world.shake(0.45);
  world.setDim(0.55, 1.2);
  await w(0.3);
  world.cardBurst(2);
  await w(0.7);
  world.glint(1.2);
}

async function afterReveal(r, i, n) {
  world.cardSlideToRest(0.55);
  if (r.tier > 0) world.setRays(r.tier === 2 ? 0.55 : 0.5, 0.9);
  dbg.stage = `card${i}:info`;
  ui.info.show(r);
  sound.stars(RARITY[r.rarity].stars, r.tier, 0.45, 0.12);
  await w(0.55);
  world.card.interactive = true;
  await waitTap(AUTO_DELAY[r.tier]);
  dbg.stage = `card${i}:exit`;
  ui.info.hide();
  sound.whoosh();
  world.setRays(0, 0.3);
  world.setDim(0, 0.4);
  if (n > 1) {
    const b = ui.strip.slotRect(i);
    await step(world.cardExitToScreen(b.left + b.width / 2, b.top + b.height / 2, 0.38));
    ui.strip.fill(i, r);
  } else {
    await step(world.cardFadeOut(0.35));
  }
}

function finishSequence(results) {
  clock.flush();
  fx.clear();
  ui.cutin(false);
  ui.info.hide();
  ui.tapHint(false);
  world.resetSequence();
  world.tweenCamera('results', 1.6);
  sound.duckMusic(false);
  sound.results();
  showResults(results);
}

/* ================================================================== screens */

function showScreen(name) {
  for (const id of ['home', 'seq', 'results']) $('#' + id).classList.toggle('active', id === name);
  document.body.dataset.phase = name;
}

function goHome() {
  if (state.phase !== 'results') return;
  sound.click();
  state.phase = 'home';
  showScreen('home');
  world.tweenCamera('home', 1.4);
  updateHud();
}

function again() {
  if (state.phase !== 'results') return;
  const { n, mode } = state.last;
  startPull(n, mode === 'ticket' ? 'normal' : mode);
}

function showResults(results) {
  state.phase = 'results';
  dbg.stage = 'results';
  const grid = $('#resGrid');
  grid.innerHTML = '';
  grid.className = `res-grid n${results.length}`;
  const counts = { SSR: 0, SR: 0, R: 0 };
  results.forEach((r, i) => {
    counts[r.rarity]++;
    const el = document.createElement('div');
    el.className = `rcard ${r.rarity.toLowerCase()}`;
    el.style.setProperty('--d', `${0.2 + i * 0.07}s`);
    const inner = document.createElement('div');
    inner.className = 'rc-inner';
    inner.appendChild(thumb(r.face, results.length === 1 ? 480 : 300, results.length === 1 ? 720 : 450));
    const shine = document.createElement('div');
    shine.className = 'rc-shine';
    inner.appendChild(shine);
    el.appendChild(inner);
    if (r.isNew) {
      const b = document.createElement('div');
      b.className = 'rc-new';
      b.textContent = 'NEW';
      el.appendChild(b);
    }
    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      el.style.setProperty('--rx', `${-y * 16}deg`);
      el.style.setProperty('--ry', `${x * 20}deg`);
      el.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
      el.style.setProperty('--my', `${(y + 0.5) * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
    grid.appendChild(el);
    setTimeout(() => {
      if (state.phase === 'results') sound.cardPop(r.tier, i);
    }, (0.2 + i * 0.07) * 1000 + 120);
  });
  if (results.length === 1) grid.appendChild(infoBlock(results[0], 'res-info'));
  $('#resSum').innerHTML = ['SSR', 'SR', 'R']
    .map((k) => `<span class="chip ${k.toLowerCase()}"><b>${k}</b>×${counts[k]}</span>`)
    .join('');
  const { n } = state.last;
  $('#againLabel').textContent = n === 10 ? 'もう一度 10回召喚' : 'もう一度 1回召喚';
  $('#againCost').textContent = fmt(COST[n]);
  showScreen('results');
  updateHud();
}

function infoBlock(r, cls) {
  const E = ELEMENTS[r.sp.element];
  const el = document.createElement('div');
  el.className = `${cls} ${r.rarity.toLowerCase()}`;
  const stars = Array.from({ length: RARITY[r.rarity].stars }, (_, i) => `<i style="--i:${i}">${STAR_SVG}</i>`).join('');
  el.innerHTML = `
    <div class="i-rar">${r.rarity}</div>
    <div class="i-stars">${stars}</div>
    <div class="i-title">【${r.sp.title}】</div>
    <div class="i-name">${r.sp.name}</div>
    <div class="i-meta"><span class="i-elem" style="--c1:${E.c1};--c2:${E.c2}">${E.kanji}</span><span>${r.sp.cons}<em>${r.sp.consEn}</em></span></div>
    <p class="i-quote"></p>
    ${r.isNew ? '<div class="i-new">NEW!</div>' : ''}`;
  el.querySelector('.i-quote').textContent = `「${r.sp.quote}」`;
  return el;
}

/* ================================================================== ui */

let typeTimer = 0;
const ui = {
  info: {
    show(r) {
      const host = $('#info');
      host.innerHTML = '';
      const block = infoBlock(r, 'info-block');
      host.appendChild(block);
      host.className = `show ${r.rarity.toLowerCase()}`;
      const q = block.querySelector('.i-quote');
      const text = q.textContent;
      q.textContent = '';
      let i = 0;
      clearInterval(typeTimer);
      setTimeout(() => {
        typeTimer = setInterval(() => {
          i++;
          q.textContent = text.slice(0, i);
          if (i >= text.length) clearInterval(typeTimer);
        }, 38);
      }, 700);
    },
    hide() {
      clearInterval(typeTimer);
      $('#info').className = '';
    },
  },
  strip: {
    setup(results) {
      const el = $('#strip');
      el.innerHTML = '';
      el.classList.toggle('hidden', results.length === 1);
      el.classList.add('pending');
      results.forEach(() => {
        const s = document.createElement('div');
        s.className = 'slot';
        el.appendChild(s);
      });
    },
    show() {
      $('#strip').classList.remove('pending');
    },
    current(i) {
      [...$('#strip').children].forEach((s, j) => s.classList.toggle('cur', j === i));
    },
    fill(i, r) {
      const s = $('#strip').children[i];
      if (!s) return;
      s.classList.remove('cur');
      s.classList.add('filled', r.rarity.toLowerCase());
      s.appendChild(thumb(r.face, 96, 144));
    },
    slotRect(i) {
      const s = $('#strip').children[i];
      return s ? s.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight, width: 0, height: 0 };
    },
  },
  tapHint(on) {
    $('#tapHint').classList.toggle('show', on);
  },
  cutin(on) {
    const el = $('#cutin');
    if (on) {
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
    } else el.classList.remove('show');
  },
  promo(text) {
    const el = $('#promo');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  },
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
}

function updateHud() {
  $('#gems').textContent = fmt(state.gems);
  $('#tickets').textContent = `×${state.tickets}`;
  $('#btnTicket').disabled = state.tickets <= 0;
  $('#pity').textContent = PITY_MAX - state.pity;
  $('#badge10').textContent = state.firstTen ? '初回限定 SSR1体確定' : 'SR以上1枠確定';
  $('#badge10').classList.toggle('first', state.firstTen);
}

function setAuto(on) {
  state.auto = on;
  $('#btnAuto').classList.toggle('on', on);
  $('#btnAuto').setAttribute('aria-pressed', String(on));
}

function toggleSound() {
  sound.init();
  state.muted = !state.muted;
  sound.setEnabled(!state.muted);
  $('#btnSound').classList.toggle('muted', state.muted);
}

function buildRates() {
  const list = (rar) => POOL[rar].map((s) => `<li>${s.id === PICKUP_ID ? '<b class="up">UP</b>' : ''}【${s.title}】${s.name}</li>`).join('');
  $('#ratesBody').innerHTML = `
    <table class="rates">
      <tr class="ssr"><th>SSR <small>★5</small></th><td>6.00%</td><td class="note">うちピックアップ 3.00%</td></tr>
      <tr class="sr"><th>SR <small>★4</small></th><td>24.00%</td><td class="note"></td></tr>
      <tr class="r"><th>R <small>★3</small></th><td>70.00%</td><td class="note"></td></tr>
    </table>
    <div class="pools">
      <div><h4 class="ssr">SSR</h4><ul>${list('SSR')}</ul></div>
      <div><h4 class="sr">SR</h4><ul>${list('SR')}</ul></div>
      <div><h4 class="r">R</h4><ul>${list('R')}</ul></div>
    </div>
    <ul class="notes">
      <li>10回召喚では、10枠目にSR以上が1体確定します。</li>
      <li>初回の10回召喚は、ピックアップSSR「シリウス」が1体確定します。</li>
      <li>SSRが出ないまま${PITY_MAX}回召喚すると、ピックアップSSRが確定します（天井）。</li>
      <li>このページはデモです。星晶石は無料で補充されます。</li>
    </ul>`;
}

function openModal(on) {
  $('#modal').classList.toggle('show', on);
  if (on) sound.click();
}

/* ================================================================== boot */

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  world.resize(w, h);
  fx.resize(w, h);
}

let last = performance.now();
let timeScale = 1;
function frame(now) {
  const dt = Math.min(0.25, Math.max(0, (now - last) / 1000)) * timeScale;
  last = now;
  clock.update(dt);
  world.update(dt);
  fx.update(dt);
  requestAnimationFrame(frame);
}

function pregenerate() {
  const queue = SPIRITS.slice();
  const next = () => {
    const sp = queue.shift();
    if (!sp) return;
    const c = cardFace(sp);
    world.renderer.initTexture(world.faceTexture(c));
    setTimeout(next, 30);
  };
  setTimeout(next, 200);
}

function bind() {
  const press = (sel, fn) => $(sel).addEventListener('click', (e) => {
    e.stopPropagation();
    fn();
  });
  press('#btn1', () => startPull(1));
  press('#btn10', () => startPull(10));
  press('#btnTicket', () => startPull(1, 'ticket'));
  press('#btnSkip', doSkip);
  press('#btnAuto', () => {
    sound.click();
    setAuto(!state.auto);
  });
  press('#btnAgain', again);
  press('#btnBack', goHome);
  press('#btnSound', toggleSound);
  press('#btnRates', () => openModal(true));
  press('#btnClose', () => openModal(false));
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') openModal(false);
  });
  $('#seq').addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    onTap();
  });
  window.addEventListener('pointerdown', () => sound.init(), { capture: true });
  window.addEventListener('pointermove', (e) => {
    world.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key;
    if (k === 'm' || k === 'M') toggleSound();
    if ($('#modal').classList.contains('show')) {
      if (k === 'Escape') openModal(false);
      return;
    }
    if (state.phase === 'home') {
      if (k === '1') startPull(1);
      else if (k === '0' || k === 't' || k === 'T') startPull(10);
    } else if (state.phase === 'seq') {
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        sound.init();
        onTap();
      } else if (k === 's' || k === 'S' || k === 'Escape') doSkip();
      else if (k === 'a' || k === 'A') setAuto(!state.auto);
    } else if (state.phase === 'results') {
      if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        again();
      } else if (k === 'Escape' || k === 'Backspace') goHome();
    }
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => sound.setSuspended(document.hidden));
}

function init() {
  fx = new FX2D($('#fx'));
  world = new World($('#gl'), clock);
  resize();
  bind();
  buildRates();
  const banner = thumb(cardFace(byId[PICKUP_ID]), 360, 540);
  $('#bannerCard').appendChild(banner);
  updateHud();
  setAuto(true);
  state.phase = 'home';
  showScreen('home');
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(frame);
    setTimeout(() => world.precompile(), 100);
  });
  $('#loading').classList.add('done');
  pregenerate();
}

window.GACHA = {
  pull: (n = 10, opts = {}) => startPull(n, opts.mode || 'normal', opts),
  skip: doSkip,
  tap: onTap,
  setAuto,
  get state() {
    return state;
  },
  get stage() {
    return dbg.stage;
  },
  get stages() {
    return dbg.log;
  },
  setSeed(fn) {
    rng = fn;
  },
  set timeScale(v) {
    timeScale = v;
  },
};

requestAnimationFrame(() => setTimeout(init, 20));

import { SPECIES, PLAYABLE } from './animals.js';

const $ = (id) => document.getElementById(id);

const RING = '<svg class="ring" viewBox="0 0 120 120" aria-hidden="true"><path d="M60 6 C 92 5, 116 28, 114 60 C 112 94, 88 116, 58 114 C 26 112, 5 90, 7 58 C 9 30, 30 8, 64 8"/></svg>';

export class UI {
  constructor(game) {
    this.g = game;
    this.e = {
      menu: $('menu'), pause: $('pause'), hud: $('hud'), picker: $('picker'), pickName: $('pickName'),
      btnPlay: $('btnPlay'), btnResume: $('btnResume'), btnRespawn: $('btnRespawn'), btnMenu: $('btnMenu'),
      hudPause: $('hudPause'), jobs: $('jobs'), jobsHead: $('jobsHead'), jobsList: $('jobsList'), jobsCount: $('jobsCount'),
      hearts: $('hearts'), heartsN: $('heartsN'), placeTitle: $('placeTitle'), toast: $('toast'), hint: $('hint'),
      loading: $('loading'), pauseLede: $('pauseLede'),
    };
    this.soundBtns = [$('menuSound'), $('pauseSound'), $('hudSound')];
    this.cards = new Map();
    for (const s of PLAYABLE) {
      const b = document.createElement('button');
      b.className = 'animal-card';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.dataset.species = s;
      b.innerHTML = `<span class="portrait"><img alt="${SPECIES[s].label}">${RING}</span><span class="nm">${SPECIES[s].label}</span>`;
      b.addEventListener('click', () => { this.g.audio.init(); this.g.selectSpecies(s); });
      b.addEventListener('dblclick', () => this.g.start());
      this.e.picker.appendChild(b);
      this.cards.set(s, b);
    }
    this.e.btnPlay.addEventListener('click', () => this.g.start());
    for (const b of this.soundBtns) b.addEventListener('click', (ev) => { ev.stopPropagation(); this.g.toggleSound(); });
    this.e.btnResume.addEventListener('click', () => this.g.resume());
    this.e.btnRespawn.addEventListener('click', () => this.g.respawn());
    this.e.btnMenu.addEventListener('click', () => this.g.toMenu());
    this.e.hudPause.addEventListener('click', () => this.g.pause());
    this.e.jobsHead.addEventListener('click', () => this.toggleJobs());
    this.toastT = null;
    this.placeT = null;
  }

  setPortrait(species, url) {
    const img = this.cards.get(species).querySelector('img');
    img.onload = () => img.classList.add('ready');
    img.src = url;
  }

  setSelected(species) {
    for (const [s, b] of this.cards) b.setAttribute('aria-checked', s === species ? 'true' : 'false');
    const sp = SPECIES[species];
    this.e.pickName.textContent = `The ${sp.label.toLowerCase()} \u2014 ${sp.blurb.charAt(0).toLowerCase()}${sp.blurb.slice(1)}.`;
  }

  setSound(on) {
    for (const b of this.soundBtns) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      const l = b.querySelector('.lbl');
      if (l) l.textContent = on ? 'Sounds on' : 'Sounds off';
      b.title = on ? 'Sounds on (click to turn off)' : 'Sounds off (click to turn on)';
    }
  }

  /* the forced reflow starts the fade-in immediately, so the page takes clicks even when frames are slow */
  enter(el) {
    el.classList.remove('hidden');
    el.classList.add('leaving');
    void el.offsetWidth;
    el.classList.remove('leaving');
  }
  leave(el) {
    el.classList.add('leaving');
    setTimeout(() => { if (el.classList.contains('leaving')) el.classList.add('hidden'); }, 700);
  }

  showMenu() { this.enter(this.e.menu); }
  hideMenu() { this.leave(this.e.menu); }
  showPause(species) {
    const lines = {
      horse: 'Our hero stands quietly by the fence, swishing a long tail.',
      pig: 'Our hero sits down in the soft grass with a contented grunt.',
      cow: 'Our hero lies down in the meadow and chews thoughtfully.',
      cat: 'Our hero curls up in a patch of sunshine for a little nap.',
      dog: 'Our hero flops down, tongue out, tail still wagging.',
    };
    this.e.pauseLede.textContent = lines[species] || lines.pig;
    this.enter(this.e.pause);
    setTimeout(() => this.e.btnResume.focus({ preventScroll: true }), 50);
  }
  hidePause() { this.leave(this.e.pause); }
  showHUD(on) {
    this.e.hud.classList.toggle('hidden', !on);
    this.e.hud.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  renderJobs(tasks, popId = null) {
    const done = tasks.filter((t) => t.done).length;
    this.e.jobsCount.textContent = `${done}/${tasks.length}`;
    this.e.jobsList.innerHTML = tasks.map((t) => {
      const n = t.goal && !t.done ? ` <span class="n">(${t.n}/${t.goal})</span>` : '';
      return `<li class="${t.done ? 'done' : ''}${t.id === popId ? ' pop' : ''}"><span class="t">${t.text}</span>${n}</li>`;
    }).join('');
  }
  toggleJobs() { this.e.jobs.classList.toggle('collapsed'); }

  setHearts(n, bump = true) {
    this.e.heartsN.textContent = n;
    if (bump) {
      this.e.hearts.classList.remove('bump');
      void this.e.hearts.offsetWidth;
      this.e.hearts.classList.add('bump');
    }
  }

  toast(html, dur = 3.2) {
    const t = this.e.toast;
    t.innerHTML = html;
    t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), dur * 1000);
  }

  place(name, sub) {
    const el = this.e.placeTitle;
    el.innerHTML = `${sub ? `<small>${sub}</small>` : ''}${name}`;
    el.classList.add('show');
    clearTimeout(this.placeT);
    this.placeT = setTimeout(() => el.classList.remove('show'), 3200);
  }

  hint(on) { this.e.hint.classList.toggle('fade', !on); }

  loaded() {
    this.e.loading.classList.add('gone');
    setTimeout(() => this.e.loading.remove(), 1000);
  }

  error(msg) {
    this.e.loading.classList.add('error');
    this.e.loading.querySelector('.ld-sub').textContent = msg;
  }
}

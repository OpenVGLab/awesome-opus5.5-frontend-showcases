import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, '0');
const fmtTime = (t) => `${pad(t / 60, 2)}:${pad(t % 60, 2)}.${pad((t * 100) % 100, 2)}`;
const fmtNum = (n) => Math.floor(n).toLocaleString('en-US');
const T = new THREE.Vector3();

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'score', 'hiscore', 'time', 'chain', 'chainNum', 'chainFill', 'sndBtn', 'progress', 'progFill', 'bossbar', 'bossTag', 'bossName',
      'bossLag', 'bossFill', 'speed', 'shield', 'gauge', 'gaugeFill', 'ready', 'reticle', 'markers', 'popups', 'banner', 'bannerMain', 'bannerSub',
      'countdown', 'warning', 'warnSub', 'title', 'titleHi', 'pause', 'gameover', 'goCount', 'result', 'rTitle', 'rTime', 'rKills', 'rChain', 'rDmg',
      'rTimeBonus', 'rShieldBonus', 'rScore', 'rRankWrap', 'rRank', 'rFoot', 'hitflash']) this.el[id] = $(id);
    this.cells = [];
    for (let i = 0; i < 6; i++) { const c = document.createElement('i'); this.el.shield.appendChild(c); this.cells.push(c); }
    this.pops = [];
    for (let i = 0; i < 24; i++) {
      const d = document.createElement('div'); d.className = 'pop'; d.style.opacity = '0';
      this.el.popups.appendChild(d); this.pops.push({ d, t: 1, pos: new THREE.Vector3(), life: 1, lane: 0, fs: 14, wd: 0, sx: -1e4, sy: -1e4 });
    }
    this.view = { cam: null, w: 1, h: 1, fs: 14 };
    this.marks = [];
    for (let i = 0; i < 6; i++) { const d = document.createElement('div'); d.className = 'mk'; d.style.display = 'none'; this.el.markers.appendChild(d); this.marks.push(d); }
    this.nodes = [0, 1, 2, 3, 4].map((i) => $('pn' + i));
    this.cache = {};
    this.bossLag = 1;
    this.resultTimers = [];
    // Overlay keyframes run paused and are scrubbed by game time, so they freeze on pause and match slow frames.
    this.timed = new Map();
  }

  set(key, el, val, prop = 'textContent') {
    if (this.cache[key] === val) return;
    this.cache[key] = val; el[prop] = val;
  }

  showTitle(v) { this.el.title.classList.toggle('out', !v); this.el.title.classList.remove('hidden'); if (v) this.hudOn(false); }
  hudOn(v) { this.el.hud.classList.toggle('on', v); }
  sound(on) { this.el.sndBtn.textContent = on ? '♪ BGM/SE ON [M]' : '♪ BGM/SE OFF [M]'; }
  pause(v) { this.el.pause.classList.toggle('hidden', !v); }

  restart(el, cls, dur) {
    el.classList.remove('show', 'gold', 'hot'); el.style.setProperty('--at', '0s'); void el.offsetWidth;
    el.classList.add('show'); if (cls) el.classList.add(cls);
    this.timed.set(el, { t0: null, dur });
  }
  banner(main, sub, cls) { this.el.bannerMain.textContent = main; this.el.bannerSub.textContent = sub || ''; this.restart(this.el.banner, cls, 2.4); }
  clearBanner() { this.el.banner.classList.remove('show', 'gold', 'hot'); this.timed.delete(this.el.banner); }
  warning(sub) { this.el.warnSub.textContent = sub; this.restart(this.el.warning, null, 3); }
  countdown(label, num) {
    const c = this.el.countdown;
    if (!label) { c.style.opacity = '0'; return; }
    c.innerHTML = `${label}<b>${num}</b>`; c.style.opacity = '1';
  }

  popup(text, pos, big = false) {
    const p = this.pops.find((x) => x.t >= x.life) || this.pops[(this.pc = ((this.pc || 0) + 1) % this.pops.length)];
    p.t = 0; p.life = big ? 1.4 : 0.9; p.pos.copy(pos);
    p.d.textContent = text; p.d.className = big ? 'pop big' : 'pop';
    // Kills that land together would print on top of each other, so each popup takes the lowest free lane above its spot.
    const v = this.view;
    p.lane = 0; p.fs = big ? Math.max(18, v.fs * 1.9) : v.fs; p.wd = text.length * p.fs * 0.62;
    if (!v.cam) return;
    T.copy(pos).project(v.cam);
    const x = (T.x * 0.5 + 0.5) * v.w, y = (-T.y * 0.5 + 0.5) * v.h;
    const busy = (ly) => this.pops.some((q) => q !== p && q.t < q.life && Math.abs(q.sx - x) < (q.wd + p.wd) / 2 && Math.abs(q.sy - ly) < (q.fs + p.fs) * 0.55);
    while (p.lane < 5 && busy(y - p.lane * p.fs * 1.15)) p.lane++;
    p.sx = x; p.sy = y - p.lane * p.fs * 1.15;
  }

  showContinue(v, n) {
    this.el.gameover.classList.toggle('hidden', !v);
    if (v) this.el.goCount.textContent = String(n);
  }

  showResult(r) {
    const e = this.el;
    e.result.classList.remove('hidden');
    e.rTitle.textContent = r.success ? 'MISSION COMPLETE' : 'GAME OVER';
    e.rTitle.classList.toggle('fail', !r.success);
    e.rTime.textContent = r.success ? fmtTime(r.clearTime) : '--:--.--';
    e.rKills.textContent = String(r.kills);
    e.rChain.textContent = String(r.maxChain);
    e.rDmg.textContent = `${r.damage} / ${r.continues}`;
    e.rTimeBonus.textContent = fmtNum(r.timeBonus);
    e.rShieldBonus.textContent = fmtNum(r.shieldBonus);
    e.rScore.textContent = fmtNum(r.score);
    e.rRank.textContent = r.rank;
    e.rFoot.textContent = r.success ? 'PRESS ENTER / CLICK TO RETRY' : 'PRESS ENTER / CLICK — タイトルへ';
    const rows = [...e.result.querySelectorAll('.row')];
    rows.forEach((row) => row.classList.remove('in'));
    e.rRankWrap.classList.remove('in');
    for (const t of this.resultTimers) clearTimeout(t);
    this.resultTimers = rows.map((row, i) => setTimeout(() => row.classList.add('in'), 250 + i * 160));
    this.resultTimers.push(setTimeout(() => { e.rRankWrap.classList.add('in'); e.rRank.style.animation = 'none'; void e.rRank.offsetWidth; e.rRank.style.animation = ''; }, 300 + rows.length * 160));
    this.hudOn(false);
  }
  hideResult() { this.el.result.classList.add('hidden'); for (const t of this.resultTimers) clearTimeout(t); }

  update(game, camera, w, h, dt) {
    const e = this.el, c = game.cine;
    this.view.cam = camera; this.view.w = w; this.view.h = h; this.view.fs = Math.max(12, Math.min(w / 100, h * 0.0178) * 1.15);
    for (const [el, a] of this.timed) {
      if (a.t0 === null) a.t0 = game.time;
      const t = game.time - a.t0;
      el.style.setProperty('--at', `${(-t).toFixed(3)}s`);
      if (t >= a.dur) this.timed.delete(el);
    }
    this.set('score', e.score, pad(game.dispScore, 9));
    this.set('hi', e.hiscore, pad(Math.max(game.hiscore, game.score), 9));
    this.set('thi', e.titleHi, fmtNum(game.hiscore));
    this.set('time', e.time, fmtTime(game.timerOn || game.clearTime ? (game.timerOn ? game.clock : game.clearTime) : 0));
    const mult = Math.min(8, 1 + Math.floor((Math.max(1, game.chain) - 1) / 3));
    this.set('chainNum', e.chainNum, game.chain > 1 ? `CHAIN ${game.chain}  ×${mult}` : '');
    e.chainFill.style.width = `${Math.max(0, game.chainTimer / 1.6) * 100}%`;
    this.set('chainOp', e.chain.style, game.chain > 1 ? '1' : '0', 'opacity');
    this.set('speed', e.speed, fmtNum(c.speed * 91.3));
    for (let i = 0; i < 6; i++) this.set('cell' + i, this.cells[i], i < game.shield ? 'on' : '', 'className');
    this.set('low', e.shield, game.shield <= 2 ? 'cells low' : 'cells', 'className');
    e.gaugeFill.style.width = `${game.laserGauge * 100}%`;
    const full = game.laserGauge >= 1;
    this.set('gfull', e.gauge, full ? 'gauge full' : 'gauge', 'className');
    this.set('ready', e.ready, full ? 'ready on' : 'ready', 'className');

    const boss = game.boss;
    const showBoss = !!boss && boss.state !== 'enter' && boss.state !== 'warpin';
    this.set('bossVis', e.bossbar, showBoss ? 'bossbar' + (boss.style === 'shield' ? ' shield' : '') : 'bossbar hidden', 'className');
    this.set('progVis', e.progress.style, showBoss ? '0' : '1', 'opacity');
    if (showBoss) {
      const f = Math.max(0, boss.barFrac());
      this.set('bossTag', e.bossTag, boss.tag);
      this.set('bossName', e.bossName, boss.name + (boss.kind === 'final' ? (boss.phase < 1.5 ? '  // ARMOR' : '  // CORE') : ''));
      e.bossFill.style.width = `${f * 100}%`;
      this.bossLag = Math.max(f, this.bossLag - dt * 0.35);
      if (this.bossLag < f) this.bossLag = f;
      e.bossLag.style.width = `${this.bossLag * 100}%`;
    } else this.bossLag = 1;
    e.progFill.style.width = `${game.progress * 100}%`;
    const pn = game.progressNode ?? 0;
    for (let i = 0; i < 5; i++) this.set('node' + i, this.nodes[i], i < pn || game.progress >= 1 ? 'node done' : i === pn ? 'node now' : 'node', 'className');

    const r = game.reticle;
    this.set('retVis', e.reticle.style, r.visible ? '1' : '0', 'opacity');
    e.reticle.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px)`;
    this.set('retLock', e.reticle, r.lock ? 'layer lock' : 'layer', 'className');

    let mi = 0;
    if (full && game.state === 'play' && game.player.alive) {
      const pp = game.player.p;
      const tg = game.targets().sort((a, b) => (b.prio || 0) - (a.prio || 0) || a.p.distanceToSquared(pp) - b.p.distanceToSquared(pp)).slice(0, 6);
      for (const t of tg) {
        T.copy(t.p).project(camera);
        if (T.z > 1 || Math.abs(T.x) > 1.05 || Math.abs(T.y) > 1.05) continue;
        const m = this.marks[mi++];
        m.style.display = 'block';
        m.style.left = `${((T.x * 0.5 + 0.5) * w).toFixed(1)}px`; m.style.top = `${((-T.y * 0.5 + 0.5) * h).toFixed(1)}px`;
      }
    }
    for (; mi < 6; mi++) if (this.marks[mi].style.display !== 'none') this.marks[mi].style.display = 'none';

    for (const p of this.pops) {
      if (p.t >= p.life) { if (p.d.style.opacity !== '0') p.d.style.opacity = '0'; continue; }
      p.t += dt;
      T.copy(p.pos).project(camera);
      const k = p.t / p.life;
      const x = (T.x * 0.5 + 0.5) * w, y = (-T.y * 0.5 + 0.5) * h - k * 46 - p.lane * p.fs * 1.15;
      p.sx = x; p.sy = y;
      p.d.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 + (1 - Math.min(1, k * 5)) * 0.6).toFixed(2)})`;
      p.d.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
    }
    e.hitflash.style.opacity = String(Math.min(1, c.damage * 0.9));
  }
}

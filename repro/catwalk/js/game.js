// Game rules: auto-scroll, nine lives, checkpoints, fish, the finish. Pure logic that
// advances in fixed steps and reports what happened through `events`.

import { STEP, Collision, makeBody, stepBody, hazardHit } from './physics.js';

export const LIVES = 9;
const NOINPUT = { pressed: false, held: false };

export class Game {
  constructor(stage) {
    this.stage = stage;
    this.col = new Collision(stage);
    this.events = [];
    this.time = 0;
    this.sim = { body: null, scrollX: 0, scrollV: 0, ramp: 0 };
    this.newRun();
  }

  newRun() {
    this.lives = LIVES;
    this.misses = 0;
    this.fishGot = new Uint8Array(this.stage.fish.length);
    this.fishCount = 0;
    this.cp = -1;
    this.runTime = 0;
    this.jumps = 0;
    this.section = 0;
    this.results = false;
    this.missKind = null;
    this.place(this.stage.start.x);
    this.state = 'title';
    this.stateT = 0;
  }

  place(x) {
    this.body = makeBody(x, this.stage.groundAt(x));
    this.scrollX = x;
    this.scrollV = 0;
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    this.events.push({ type: 'state', state: s });
  }

  // Title → run, or restart after the results / game-over screens.
  start() {
    if (this.state === 'title') {
      this.setState('intro');
      return true;
    }
    if (this.state === 'gameover' || (this.state === 'clear' && this.results)) {
      this.newRun();
      this.setState('intro');
      this.events.push({ type: 'restart' });
      return true;
    }
    return false;
  }

  killY(x) {
    return this.stage.pathY(x) - 3.1;
  }

  // Shared by the live game and the autopilot's look-ahead.
  simStep(sim, input, events) {
    const target = this.stage.speedAt(sim.scrollX) * sim.ramp;
    sim.scrollV += (target - sim.scrollV) * Math.min(1, STEP * 5);
    sim.scrollX += sim.scrollV * STEP;
    stepBody(sim.body, input, { col: this.col, scrollX: sim.scrollX, vScroll: sim.scrollV, dt: STEP }, events);
  }

  deathCheck(body, scrollX) {
    if (body.y < this.killY(body.x)) return 'fall';
    if (body.x < scrollX - 3.3) return 'behind';
    const h = hazardHit(this.col, body, scrollX);
    return h ? h.kind : null;
  }

  step(input) {
    this.time += STEP;
    this.stateT += STEP;
    const st = this.state;
    if (st === 'intro' || st === 'ready' || st === 'play') this.stepRunning(st, input);
    else if (st === 'miss') this.stepMiss();
    else if (st === 'clear') this.stepClear();
  }

  stepRunning(st, input) {
    const delay = st === 'intro' ? 0.62 : 0.45;
    const sim = this.sim;
    sim.body = this.body;
    sim.scrollX = this.scrollX;
    sim.scrollV = this.scrollV;
    sim.ramp = st === 'play' || this.stateT > delay ? 1 : 0;
    const inp = st === 'play' || this.stateT > delay ? input : NOINPUT;
    const n0 = this.events.length;
    this.simStep(sim, inp, this.events);
    for (let i = n0; i < this.events.length; i++) if (this.events[i].type === 'jump') this.jumps++;
    this.scrollX = sim.scrollX;
    this.scrollV = sim.scrollV;
    if (st !== 'intro') this.runTime += STEP;
    if (st !== 'play' && this.stateT > delay + 0.35) this.setState('play');

    this.collectFish();
    this.checkCheckpoints();
    const si = this.stage.sectionIndex(this.scrollX + 1.5);
    if (si > this.section) {
      this.section = si;
      this.events.push({ type: 'section', index: si });
    }
    const d = this.deathCheck(this.body, this.scrollX);
    if (d) this.miss(d);
    else if (this.body.x >= this.stage.goal.x) this.clear();
  }

  collectFish() {
    const b = this.body;
    const cy = b.y + 0.2;
    const list = this.stage.fish;
    for (let i = 0; i < list.length; i++) {
      if (this.fishGot[i]) continue;
      const f = list[i];
      const dx = f.x - b.x;
      if (dx < -0.6 || dx > 0.6) continue;
      const dy = f.y - cy;
      if (dx * dx + dy * dy < 0.42 * 0.42) {
        this.fishGot[i] = 1;
        this.fishCount++;
        this.events.push({ type: 'fish', id: i, x: f.x, y: f.y, count: this.fishCount });
      }
    }
  }

  checkCheckpoints() {
    const cps = this.stage.checkpoints;
    for (let i = this.cp + 1; i < cps.length; i++) {
      if (this.body.x >= cps[i].x) {
        this.cp = i;
        this.events.push({ type: 'checkpoint', id: i, x: cps[i].x });
      }
    }
  }

  miss(kind) {
    this.missKind = kind;
    this.lives--;
    this.misses++;
    this.events.push({ type: 'miss', kind, lives: this.lives, x: this.body.x, y: this.body.y });
    this.setState('miss');
    if (kind === 'glass' || kind === 'vent') {
      this.body.vy = 5.2;
      this.body.grounded = false;
      this.body.vx *= 0.4;
    }
  }

  stepMiss() {
    this.runTime += STEP;
    this.scrollV *= Math.max(0, 1 - STEP * 6);
    if (this.missKind !== 'behind') {
      stepBody(this.body, NOINPUT, { col: this.col, scrollX: this.body.x, vScroll: 0, dt: STEP }, null);
    }
    if (this.stateT > 1.35) {
      if (this.lives <= 0) {
        this.setState('gameover');
        return;
      }
      const x = this.cp >= 0 ? this.stage.checkpoints[this.cp].x : this.stage.start.x;
      this.place(x);
      this.missKind = null;
      this.setState('ready');
      this.events.push({ type: 'respawn', x });
    }
  }

  clear() {
    this.finalTime = this.runTime;
    this.results = false;
    this.setState('clear');
    this.events.push({ type: 'clear' });
  }

  stepClear() {
    const goal = this.stage.goal;
    const rem = Math.max(0, goal.sitX - this.scrollX);
    this.scrollV = Math.min(this.scrollV, Math.sqrt(2 * 2.4 * rem));
    this.scrollX += this.scrollV * STEP;
    stepBody(this.body, NOINPUT, { col: this.col, scrollX: this.scrollX, vScroll: this.scrollV, dt: STEP }, this.events);
    this.collectFish();
    if (!this.results && this.stateT > 3.6) {
      this.results = true;
      this.events.push({ type: 'results' });
    }
  }

  rank() {
    const total = this.stage.fish.length;
    const f = this.fishCount / total;
    if (this.misses === 0 && f >= 0.9) return { letter: 'S', title: 'Moonwalker' };
    if (this.misses <= 2 && f >= 0.7) return { letter: 'A', title: 'Night Prowler' };
    if (this.misses <= 5 && f >= 0.4) return { letter: 'B', title: 'Alley Cat' };
    return { letter: 'C', title: 'Stray' };
  }
}

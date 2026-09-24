// A look-ahead player. It simulates the real physics forward, finds the window of
// take-off moments and hold lengths that land cleanly, and jumps in the middle of
// the widest one. Used for the attract demo (?auto) and for validating the stage.

import { cloneBody } from './physics.js';

const HOLDS = [1, 7, 13, 19, 26, 36];

export class Autopilot {
  constructor(game) {
    this.game = game;
    this.reset();
    this.log = null;
  }

  reset() {
    this.plan = null;
    this.holdLeft = 0;
    this.cool = 0;
  }

  simulate(delay, hold, maxSteps) {
    const g = this.game;
    const sim = { body: cloneBody(g.body), scrollX: g.scrollX, scrollV: g.scrollV, ramp: 1 };
    const ev = [];
    let bumps = 0, jumpStep = -1, landed = false, landStep = -1, lastGround = 0;
    for (let i = 0; i < maxSteps; i++) {
      const pressed = i === delay;
      const held = delay >= 0 && i >= delay && i < delay + hold;
      ev.length = 0;
      g.simStep(sim, { pressed, held }, ev);
      for (let k = 0; k < ev.length; k++) {
        const e = ev[k];
        if (e.type === 'bump' || e.type === 'bonk') bumps++;
        else if (e.type === 'jump') jumpStep = i;
        else if (e.type === 'land' && jumpStep >= 0 && !landed) { landed = true; landStep = i; }
      }
      if (sim.body.grounded) lastGround = i;
      if (g.deathCheck(sim.body, sim.scrollX)) {
        return { dead: true, step: i, problem: Math.min(i, lastGround), bumps, landed, jumped: jumpStep >= 0 };
      }
      if (bumps > 0 && delay < 0) return { dead: false, step: i, problem: i, bumps, landed, jumped: false };
      // A jump is judged up to a settled landing; whatever comes next gets its own plan.
      if (landed && i > landStep + 10) return { dead: false, step: i, problem: -1, bumps, landed, jumped: true };
    }
    return { dead: false, step: maxSteps, problem: -1, bumps, landed, jumped: jumpStep >= 0 };
  }

  input() {
    const g = this.game;
    if (g.state !== 'play' && g.state !== 'ready' && g.state !== 'intro') {
      this.reset();
      return { pressed: false, held: false };
    }
    if (this.holdLeft > 0) {
      this.holdLeft--;
      return { pressed: false, held: this.holdLeft > 0 };
    }
    const b = g.body;
    if (!b.grounded && b.coyote <= 0) { this.plan = null; return { pressed: false, held: false }; }
    if (g.state !== 'play' && g.stateT < 0.7) return { pressed: false, held: false };

    if (this.plan) {
      this.plan.at--;
      if (this.plan.at > 0) return { pressed: false, held: false };
      const check = this.simulate(0, this.plan.hold, 200);
      const hold = this.plan.hold;
      this.plan = null;
      if (!check.dead && check.bumps === 0) return this.fire(hold);
    }
    if (this.cool > 0) { this.cool--; return { pressed: false, held: false }; }
    this.cool = 2;

    const none = this.simulate(-1, 0, 100);
    if (none.problem < 0) return { pressed: false, held: false };

    const maxDelay = Math.max(0, Math.min(none.problem, 70));
    let best = null;
    let fallback = null;
    for (const hold of HOLDS) {
      let first = -1, last = -1;
      for (let d = 0; d <= maxDelay; d += 2) {
        const r = this.simulate(d, hold, 210);
        const ok = !r.dead && r.bumps === 0 && r.landed;
        if (ok) {
          if (first < 0) first = d;
          last = d;
        } else {
          if (!fallback || score(r) > fallback.s) fallback = { s: score(r), d, hold };
          if (first >= 0) break;
        }
      }
      if (first >= 0) {
        const w = last - first;
        if (!best || w > best.w) best = { hold, first, last, w, center: Math.round((first + last) / 2) };
      }
    }
    if (best) {
      if (this.log) this.log.push({ x: +b.x.toFixed(2), hold: best.hold, window: best.w + 2 });
      if (best.center <= 1) return this.fire(best.hold);
      this.plan = { at: best.center, hold: best.hold };
      return { pressed: false, held: false };
    }
    if (this.log) this.log.push({ x: +b.x.toFixed(2), hold: -1, window: 0 });
    if (fallback && fallback.d <= 1) return this.fire(fallback.hold);
    return { pressed: false, held: false };
  }

  fire(hold) {
    this.holdLeft = hold;
    return { pressed: true, held: true };
  }
}

function score(r) {
  return (r.dead ? 0 : 1000) + r.step - r.bumps * 40;
}

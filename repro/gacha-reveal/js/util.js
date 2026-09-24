export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const SKIP = Symbol('skip');

// Animation clock driven by requestAnimationFrame, so waits and tweens pause with the page.
export class Clock {
  constructor() {
    this.t = 0;
    this.timers = [];
    this.tweens = [];
  }

  update(dt) {
    this.t += dt;
    const tweens = this.tweens.slice();
    for (const tw of tweens) {
      tw.el += dt;
      const k = Math.min(1, tw.el / tw.dur);
      tw.fn(tw.ease(k), k);
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.resolve();
      }
    }
    const due = this.timers.filter((tm) => this.t >= tm.at);
    if (due.length) {
      this.timers = this.timers.filter((tm) => this.t < tm.at);
      due.forEach((tm) => tm.resolve());
    }
  }

  wait(sec) {
    return new Promise((resolve) => this.timers.push({ at: this.t + sec, resolve }));
  }

  tween(dur, fn, ease = Ease.linear) {
    return new Promise((resolve) => {
      if (dur <= 0) {
        fn(1, 1);
        resolve();
        return;
      }
      this.tweens.push({ el: 0, dur, fn, ease, resolve });
    });
  }

  // Finish everything immediately (used by SKIP).
  flush() {
    const tweens = this.tweens;
    const timers = this.timers;
    this.tweens = [];
    this.timers = [];
    for (const tw of tweens) {
      tw.fn(tw.ease(1), 1);
      tw.resolve();
    }
    for (const tm of timers) tm.resolve();
  }
}

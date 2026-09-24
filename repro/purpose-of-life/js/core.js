'use strict';
// Shared constants, the master timeline and small math helpers.

const W = 1920, H = 1080;          // stage size in design units
const ANIM_FPS = 12;               // everything moves "on twos", like stop-motion
const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
const END = 55;                    // film length (seconds)

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const between = (t, a, b) => t >= a && t < b;

const E = {
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - ((2 - 2 * t) * (2 - 2 * t)) / 2),
  out3: (t) => 1 - Math.pow(1 - t, 3),
  in3: (t) => t * t * t,
  back: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  elastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin(((t * 10 - 0.75) * TAU) / 3) + 1),
  bounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

function hash(n) {
  n = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  n = Math.imul(n, 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function hash2(a, b) {
  return hash(Math.imul(a | 0, 0x1f123bb5) ^ Math.imul((b | 0) + 0x632be5ab, 0x2c1b3c6d));
}
// smooth 1-D value noise in [-1, 1]
function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash2(i, seed), hash2(i + 1, seed), u) * 2 - 1;
}
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Key moments, shared by the picture and the score (seconds).
const TL = {
  s1: { card: 0.55, tape: 0.9, write: [1.2, 3.45], qLand: 3.75, qTape: [4.0, 4.15], pipUp: 4.375,
        hmm: [5.3125, 5.625, 5.9375], scratch: [5.4, 6.7], shrug: 6.875 },
  x12: [7.25, 7.8],
  s2: { card: 7.95, write: [8.2, 9.5],
        land: [8.75, 9.375, 10.0, 10.625, 10.9375, 11.25, 11.5625, 11.875, 12.1875],
        topple: 12.5, fly: 12.66, flat: 12.9, pop: 13.6, crown: 13.72, scribble: [14.0, 14.55] },
  x23: [14.85, 15.45],
  s3: { card: 15.5, write: [15.75, 17.4], form: [18.75, 19.75], lines: [19.8, 20.3], boing: 20.1,
        look: 20.35, fall: [20.75, 21.55], glow: 21.6,
        // [time, star index]: stars that flare in time with the celesta
        tw: [[15.9375, 20], [16.25, 33], [16.875, 15], [17.1875, 41], [17.5, 26], [17.8125, 48], [18.125, 18], [18.4375, 37]] },
  x34: [22.3, 23.0],
  s4: { walk: [22.9, 23.3], plant: 23.55, pats: [23.8, 24.05], card: 23.3, write: [23.55, 25.0],
        can: 24.1, water: [24.2, 25.25], drops: [24.35, 24.55, 24.75, 24.95, 25.15], grow: [25.2, 27.0],
        leaves: [25.7, 26.15, 26.6], bloom: 27.5, hop: [27.7, 28.25], fly: 27.9 },
  s5: { clouds: [29.9, 30.9], rain: [30.3, 35.2], pan: [30.4, 31.8], walk: [30.6, 32.4], leaf: [32.5, 33.1],
        lookUp: 33.2, smile: 33.6, stand: [33.95, 34.3], card: 33.6, write: [33.85, 35.1], clear: [34.5, 35.4],
        rainbow: [34.8, 35.8], heart: 35.8, hops: [36.25, 36.875], riser: [36.9, 37.5] },
  x56: [37.3, 37.62],
  s6: { t0: 37.5, len: 1.25 },
  x67: [44.8, 45.3],
  s7: { words: 45.1, q1: 45.625, q2: 46.25, slide: [47.2, 48.1], heart: 48.15, card: 48.45,
        write1: [48.65, 50.9], write2: [51.0, 52.3], final: 52.5, stamp: 53.25 },
};

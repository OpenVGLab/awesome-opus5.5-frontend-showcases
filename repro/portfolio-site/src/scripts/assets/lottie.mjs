// Hand-built Lottie (Bodymovin 5.x) animation for the 404 page: an astronaut drifting past a
// ringed planet with twinkling stars and a shooting star. 800×600, 30 fps, 5 s loop.

const FR = 30;
const OP = 150;

const rgba = (hex, a = 1) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
};
const st = (k) => ({ a: 0, k });
const ease = { i: { x: [0.45], y: [1] }, o: { x: [0.55], y: [0] } };
const kf = (frames) => ({
  a: 1,
  k: frames.map(([t, s], idx) => (idx < frames.length - 1 ? { t, s: [].concat(s), ...ease } : { t, s: [].concat(s) })),
});

const tr = (o = {}) => ({
  ty: 'tr',
  p: o.p || st([0, 0]),
  a: o.a || st([0, 0]),
  s: o.s || st([100, 100]),
  r: o.r || st(0),
  o: o.o || st(100),
  sk: st(0),
  sa: st(0),
  nm: 'Transform',
});
const el = (x, y, w, h) => ({ ty: 'el', d: 1, p: st([x, y]), s: st([w, h]), nm: 'Ellipse' });
const rc = (x, y, w, h, r) => ({ ty: 'rc', d: 1, p: st([x, y]), s: st([w, h]), r: st(r), nm: 'Rect' });
const sh = (v, i, o, c = false) => ({ ty: 'sh', d: 1, ks: st({ v, i: i || v.map(() => [0, 0]), o: o || v.map(() => [0, 0]), c }), nm: 'Path' });
const fl = (hex, opacity = 100) => ({ ty: 'fl', c: st(rgba(hex)), o: st(opacity), r: 1, bm: 0, nm: 'Fill' });
const stroke = (hex, w, opacity = 100) => ({ ty: 'st', c: st(rgba(hex)), o: st(opacity), w: st(w), lc: 2, lj: 2, ml: 4, bm: 0, nm: 'Stroke' });
const gr = (nm, items, t) => ({ ty: 'gr', nm, it: [...items, tr(t)], np: items.length, bm: 0 });

let index = 0;
const layer = (nm, shapes, ks = {}, extra = {}) => ({
  ddd: 0,
  ind: ++index,
  ty: 4,
  nm,
  sr: 1,
  ks: {
    o: ks.o || st(100),
    r: ks.r || st(0),
    p: ks.p || st([0, 0, 0]),
    a: ks.a || st([0, 0, 0]),
    s: ks.s || st([100, 100, 100]),
  },
  ao: 0,
  shapes,
  ip: 0,
  op: OP,
  st: 0,
  bm: 0,
  ...extra,
});
const nullLayer = (nm, ks) => ({
  ddd: 0, ind: ++index, ty: 3, nm, sr: 1,
  ks: { o: st(0), r: ks.r || st(0), p: ks.p || st([0, 0, 0]), a: st([0, 0, 0]), s: st([100, 100, 100]) },
  ao: 0, ip: 0, op: OP, st: 0, bm: 0,
});

export function lostInSpace() {
  index = 0;
  const INK = '#141414', SUIT = '#F4F1EA', SUIT_SHADE = '#D8D2C4', CORAL = '#FF6B4A', GOLD = '#FFD166', VISOR = '#2F3FB5', TEAL = '#2EC4B6';
  const layers = [];

  // Stars twinkle out of phase with each other.
  const stars = [
    [250, 150, 6], [330, 110, 4], [470, 120, 5], [560, 420, 4], [620, 330, 6], [230, 380, 5], [300, 470, 4],
    [510, 480, 5], [420, 90, 3], [640, 250, 4], [190, 280, 4], [380, 520, 3], [600, 160, 3], [270, 230, 3],
  ].map(([x, y, s], i) => {
    const phase = (i * 23) % OP;
    const op = kf([[0, 100], [(phase + 20) % OP || 20, 25], [OP, 100]].sort((a, b) => a[0] - b[0]));
    return gr(`star-${i}`, [el(x, y, s * 2, s * 2), fl(i % 3 === 0 ? GOLD : '#FFFFFF')], { o: op, p: st([0, 0]) });
  });

  // Top of the stack is drawn first in Lottie, so build front-to-back and reverse at the end.
  const astro = nullLayer('astronaut-float', {
    p: kf([[0, [360, 330, 0]], [75, [372, 312, 0]], [OP, [360, 330, 0]]]),
    r: kf([[0, -6], [75, 5], [OP, -6]]),
  });

  const helmet = layer('helmet', [
    gr('visor-shine', [el(-16, -62, 18, 10), fl('#FFFFFF', 75)]),
    gr('visor', [rc(0, -48, 78, 58, 28), fl(VISOR), stroke(INK, 5)]),
    gr('helmet', [el(0, -50, 116, 112), fl(SUIT), stroke(INK, 6)]),
  ], {}, { parent: astro.ind });

  const chest = layer('chest', [
    gr('led-1', [el(-14, 34, 10, 10), fl(CORAL)]),
    gr('led-2', [el(2, 34, 10, 10), fl(TEAL)]),
    gr('panel', [rc(-4, 36, 44, 26, 8), fl(SUIT_SHADE), stroke(INK, 4)]),
  ], {}, { parent: astro.ind });

  const body = layer('body', [
    gr('leg-l', [rc(-22, 108, 30, 46, 14), fl(SUIT), stroke(INK, 5)]),
    gr('leg-r', [rc(22, 108, 30, 46, 14), fl(SUIT), stroke(INK, 5)]),
    gr('torso', [rc(0, 44, 98, 108, 32), fl(SUIT), stroke(INK, 6)]),
    gr('arm-r', [rc(58, 40, 30, 72, 15), fl(SUIT), stroke(INK, 5)], { r: st(-18), p: st([0, 0]), a: st([0, 0]) }),
  ], {}, { parent: astro.ind });

  const wave = layer('arm-wave', [gr('arm-l', [rc(0, 30, 30, 74, 15), fl(SUIT), stroke(INK, 5)]), gr('glove', [el(0, 70, 34, 30), fl(CORAL), stroke(INK, 4)])], {
    p: st([-54, 14, 0]),
    a: st([0, 0, 0]),
    r: kf([[0, 150], [20, 125], [40, 155], [60, 125], [80, 150], [OP, 150]]),
  }, { parent: astro.ind });

  const pack = layer('backpack', [
    gr('tether', [
      sh([[40, 70], [120, 150], [60, 230], [150, 260]], [[0, 0], [-10, -40], [40, -30], [-30, -10]], [[30, 40], [10, 40], [-30, 20], [0, 0]]),
      stroke(INK, 5),
    ]),
    gr('plug', [rc(160, 262, 30, 20, 5), fl(GOLD), stroke(INK, 4)]),
    gr('prong-1', [rc(180, 256, 10, 4, 2), fl(INK)]),
    gr('prong-2', [rc(180, 268, 10, 4, 2), fl(INK)]),
    gr('pack', [rc(0, 34, 122, 124, 24), fl(SUIT_SHADE), stroke(INK, 6)]),
  ], {}, { parent: astro.ind });

  const shooting = layer('shooting-star', [
    gr('trail', [
      sh([[150, 120], [330, 205]]),
      { ty: 'tm', s: kf([[70, 0], [96, 0], [110, 100]]), e: kf([[60, 0], [88, 100]]), o: st(0), m: 1, nm: 'Trim' },
      stroke('#FFFFFF', 4),
    ]),
  ]);

  const planet = layer('planet', [
    gr('ring-front', [sh([[-100, 6], [100, -6]], [[0, 0], [60, 20]], [[60, 26], [0, 0]]), stroke(GOLD, 8)]),
    gr('crater-1', [el(-18, -14, 26, 20), fl('#E0512F')]),
    gr('crater-2', [el(20, 18, 18, 14), fl('#E0512F')]),
    gr('crater-3', [el(-4, 28, 12, 10), fl('#E0512F')]),
    gr('planet', [el(0, 0, 124, 124), fl(CORAL), stroke(INK, 5)]),
    gr('ring-back', [el(0, 0, 210, 52), stroke(GOLD, 8)]),
  ], {
    p: kf([[0, [585, 185, 0]], [75, [585, 196, 0]], [OP, [585, 185, 0]]]),
    r: st(-18),
  });

  const rock = layer('asteroid', [gr('rock', [sh([[-14, -6], [-4, -16], [12, -10], [16, 6], [2, 16], [-12, 10]], null, null, true), fl('#8D8A99'), stroke(INK, 4)])], {
    p: kf([[0, [700, 520, 0]], [OP, [120, 450, 0]]]),
    r: kf([[0, 0], [OP, 360]]),
    o: kf([[0, 0], [20, 100], [130, 100], [OP, 0]]),
  });

  const starLayer = layer('stars', stars);
  const backdrop = layer('backdrop', [
    gr('glow', [el(400, 300, 560, 560), fl('#3D5AFE', 10)]),
    gr('space', [el(400, 300, 520, 520), fl('#171A33')]),
  ]);

  layers.push(helmet, chest, wave, body, pack, astro, shooting, planet, rock, starLayer, backdrop);

  return { v: '5.7.4', fr: FR, ip: 0, op: OP, w: 800, h: 600, nm: 'Lost in space', ddd: 0, assets: [], markers: [], layers };
}

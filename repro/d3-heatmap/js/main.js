import { DATASETS, generateDataset } from './datasets.js';
import {
  squareLattice,
  binSquare,
  hexLattice,
  binHex,
  hexIndex,
  cellValues,
  smoothValues,
  dilate,
  profiles,
} from './binning.js';
import { parseText, toDataset, sampleCSV, toCSV, exportPNG, download } from './io.js';

const d3 = window.d3;
const SQRT3 = Math.sqrt(3);
const BG = '#0b0f15';
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// ------------------------------------------------------------------------------------------------
// Configuration
// ------------------------------------------------------------------------------------------------

// Diverging schemes are flipped where needed so that low values are always the cool end.
const SCHEMES = {
  viridis: { name: 'Viridis', f: d3.interpolateViridis },
  inferno: { name: 'Inferno', f: d3.interpolateInferno },
  magma: { name: 'Magma', f: d3.interpolateMagma },
  plasma: { name: 'Plasma', f: d3.interpolatePlasma },
  cividis: { name: 'Cividis', f: d3.interpolateCividis },
  turbo: { name: 'Turbo', f: d3.interpolateTurbo },
  terrain: {
    name: 'Terrain',
    f: d3.interpolateRgbBasis(['#1b4965', '#2a7f7a', '#5aa469', '#a7c957', '#e9d8a6', '#d4a373', '#a0694b', '#7f6a5d', '#cfc8c0', '#f7f5f2']),
  },
  ylgnbu: { name: 'YlGnBu', f: (t) => d3.interpolateYlGnBu(1 - t) },
  ylorrd: { name: 'YlOrRd', f: (t) => d3.interpolateYlOrRd(1 - t) },
  cubehelix: { name: 'Cubehelix', f: d3.interpolateCubehelixDefault },
  rdbu: { name: 'RdBu (diverging)', f: (t) => d3.interpolateRdBu(1 - t), diverging: true },
  rdylbu: { name: 'RdYlBu (diverging)', f: (t) => d3.interpolateRdYlBu(1 - t), diverging: true },
  spectral: { name: 'Spectral (diverging)', f: (t) => d3.interpolateSpectral(1 - t), diverging: true },
  brbg: { name: 'BrBG (diverging)', f: d3.interpolateBrBG, diverging: true },
};

const AGGS = { mean: 'Mean', median: 'Median', sum: 'Sum', count: 'Count', min: 'Min', max: 'Max', std: 'Std dev' };
const FILE_VIEW = { agg: 'mean', scheme: 'viridis', scale: 'linear', contours: false, levels: 12 };

// Pipeline stages; each one invalidates everything after it.
const LAYOUT = 1;
const BIN = 2;
const VAL = 4;
const COLOR = 8;
const DRAW = 16;
const EFFECT = {
  grid: BIN,
  cell: BIN,
  contours: BIN,
  agg: VAL,
  minCount: VAL,
  sigma: VAL,
  scheme: COLOR,
  scale: COLOR,
  reverse: COLOR,
  clip: COLOR,
  levels: COLOR,
  points: DRAW,
  bilinear: DRAW,
  marginals: LAYOUT,
};

const MARG = 56;
const MGAP = 10;
const LEG_HIST = 24;
const LEG_GAP = 3;
const LEG_BAR = 14;
const LEG_W = 100;
const HIST_BINS = 48;
const MAX_ZOOM = 400;
const SAMPLE_POINTS = 6000;

const state = {
  dataset: 'terrain',
  n: 1000000,
  seed: 1,
  grid: 'rect',
  cell: 7,
  agg: 'mean',
  minCount: 1,
  sigma: 0,
  scheme: 'terrain',
  scale: 'linear',
  reverse: false,
  clip: true,
  contours: true,
  levels: 16,
  points: false,
  marginals: true,
  bilinear: false,
  filter: null,
};
Object.assign(state, DATASETS[state.dataset].view);

// ------------------------------------------------------------------------------------------------
// DOM
// ------------------------------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const ui = {
  chart: $('chart'),
  canvas: $('heat'),
  svg: $('svg'),
  tip: $('tip'),
  loading: $('loading'),
  loadingText: $('loading-text'),
  loadingBar: $('loading-bar'),
  drop: $('dropzone'),
  dataset: $('dataset'),
  desc: $('dataset-desc'),
  npoints: $('npoints'),
  regen: $('regen'),
  seed: $('seed'),
  importBtn: $('import'),
  sampleBtn: $('sample'),
  file: $('file'),
  cell: $('cell'),
  cellOut: $('cell-out'),
  agg: $('agg'),
  minc: $('minc'),
  mincOut: $('minc-out'),
  sigma: $('sigma'),
  sigmaOut: $('sigma-out'),
  scheme: $('scheme'),
  reverse: $('reverse'),
  clip: $('clip'),
  contours: $('contours'),
  levels: $('levels'),
  levelsOut: $('levels-out'),
  points: $('points'),
  marginals: $('marginals'),
  bilinear: $('bilinear'),
  title: $('chart-title'),
  sub: $('chart-sub'),
  subtitle: $('subtitle'),
  stPoints: $('st-points'),
  stView: $('st-view'),
  stCells: $('st-cells'),
  stTime: $('st-time'),
  zoomLevel: $('zoom-level'),
  reset: $('reset'),
  png: $('png'),
  csv: $('csv'),
  filterChip: $('filter-chip'),
  filterRange: $('filter-range'),
  filterClear: $('filter-clear'),
  toast: $('toast'),
};

const ctx = ui.canvas.getContext('2d');
const off = document.createElement('canvas');
const offCtx = off.getContext('2d');
let imgData = null;
let hatch = null;
// Data-coverage mask (opaque where a cell holds a value) and the layer the isolines are drawn on.
const maskCanvas = document.createElement('canvas');
const maskCtx = maskCanvas.getContext('2d');
let maskData = null;
let coverage = null;
const lineLayer = document.createElement('canvas');
const lineCtx = lineLayer.getContext('2d');
// Per-pixel hexagon raster, used once there are too many hexagons to fill as paths.
const hexOff = document.createElement('canvas');
const hexOffCtx = hexOff.getContext('2d');
const hexMaskOff = document.createElement('canvas');
const hexMaskCtx = hexMaskOff.getContext('2d');
let hexImg = null;
let hexMaskImg = null;
const HEX_RASTER_ABOVE = 25000;

// ------------------------------------------------------------------------------------------------
// Formatting
// ------------------------------------------------------------------------------------------------

const fmtInt = d3.format(',');

function valueFormatter(lo, hi) {
  const span = Math.max(Math.abs(lo), Math.abs(hi));
  if (span >= 1e6) return d3.format('.4~s');
  if (span >= 1000) return d3.format(',.0f');
  if (span >= 100) return d3.format(',.1f');
  if (span >= 10) return d3.format('.2f');
  if (span >= 0.01) return d3.format('.3f');
  return d3.format('.3~g');
}

function coordFormat(step) {
  const digits = Math.max(0, Math.min(6, 1 - Math.floor(Math.log10(Math.abs(step) || 1))));
  return d3.format(`,.${digits}f`);
}

function valueTitle() {
  const l = data ? data.labels : { v: 'value', unit: '' };
  const unit = l.unit ? ` (${l.unit})` : '';
  switch (state.agg) {
    case 'count':
      return 'Points per cell';
    case 'sum':
      return `Sum of ${l.v}${unit}`;
    case 'std':
      return `Std dev of ${l.v}${unit}`;
    default:
      return `${AGGS[state.agg]} ${l.v}${unit}`;
  }
}

function profileCaption() {
  switch (state.agg) {
    case 'count':
      return 'points per column / row';
    case 'sum':
      return 'column / row sums';
    case 'min':
      return 'column / row minimum';
    case 'max':
      return 'column / row maximum';
    case 'std':
      return 'column / row std dev';
    default:
      return 'column / row mean ± 1σ';
  }
}

function unitOf(label) {
  const m = /\(([^)]+)\)\s*$/.exec(label || '');
  return m ? m[1] : '';
}

// ------------------------------------------------------------------------------------------------
// SVG scaffold (axes, legend, marginal profiles, interaction layer)
// ------------------------------------------------------------------------------------------------

const SVG_STYLE = `
#svg text { font-family: ${FONT}; }
#svg .axis text { fill: #8793a5; font-size: 11px; }
#svg .axis line, #svg .axis .domain { stroke: #3a4555; }
#svg .axis.main .domain { display: none; }
#svg .axis-label { fill: #aab5c4; font-size: 11.5px; font-weight: 600; letter-spacing: .02em; }
#svg .frame { fill: none; stroke: #2b3544; }
#svg .hit { fill: none; pointer-events: all; cursor: crosshair; }
#svg .hover-under { fill: none; stroke: #05070a; stroke-opacity: .75; stroke-width: 3.6; pointer-events: none; }
#svg .hover-cell { fill: none; stroke: #ffffff; stroke-width: 1.5; pointer-events: none; }
#svg .box { fill: rgba(125, 211, 252, .16); stroke: #bae6fd; stroke-width: 1.5; stroke-dasharray: 5 3; pointer-events: none; }
#svg .marginal .band { fill: rgba(125, 211, 252, .16); }
#svg .marginal .area { fill: rgba(125, 211, 252, .22); }
#svg .marginal .line { fill: none; stroke: #7dd3fc; stroke-width: 1.4; }
#svg .marginal .base { stroke: #2b3544; }
#svg .marginal .cross { stroke: #ffffff; stroke-opacity: .55; stroke-dasharray: 2 2; pointer-events: none; }
#svg .marginal .cap { fill: #6c788b; font-size: 10px; }
#svg .legend .bar { stroke: #2b3544; }
#svg .legend-title { fill: #cbd4e0; font-size: 11.5px; font-weight: 600; }
#svg .legend .note { fill: #6c788b; font-size: 10px; }
#svg .legend .marker { stroke: #ffffff; stroke-width: 2; pointer-events: none; }
#svg .legend .marker-under { stroke: #05070a; stroke-width: 4.5; stroke-opacity: .8; pointer-events: none; }
#svg .brush .selection { fill: #ffffff; fill-opacity: .08; stroke: #ffffff; stroke-opacity: .9; }
`;

const svg = d3.select(ui.svg).attr('font-family', FONT);
const defs = svg.append('defs');
defs.append('style').text(SVG_STYLE);
const plotClip = defs.append('clipPath').attr('id', 'plot-clip').append('rect');
const topClip = defs.append('clipPath').attr('id', 'top-clip').append('rect');
const rightClip = defs.append('clipPath').attr('id', 'right-clip').append('rect');
const grad = defs.append('linearGradient').attr('id', 'legend-grad').attr('x1', 0).attr('y1', 1).attr('x2', 0).attr('y2', 0);

const gXAxis = svg.append('g').attr('class', 'axis main x');
const gYAxis = svg.append('g').attr('class', 'axis main y');
const xLabel = svg.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle');
const yLabel = svg.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle');

function marginal(cls, clipId) {
  const g = svg.append('g').attr('class', `marginal ${cls}`);
  const body = g.append('g').attr('clip-path', `url(#${clipId})`);
  body.append('path').attr('class', 'band');
  body.append('path').attr('class', 'area');
  body.append('path').attr('class', 'line');
  body.append('line').attr('class', 'cross').attr('display', 'none');
  g.append('line').attr('class', 'base');
  g.append('g').attr('class', 'axis');
  g.append('text').attr('class', 'cap');
  return g;
}
const gTop = marginal('top', 'top-clip');
const gRight = marginal('right', 'right-clip');

const gLegend = svg.append('g').attr('class', 'legend');
const gHist = gLegend.append('g').attr('class', 'hist');
const legendBar = gLegend.append('rect').attr('class', 'bar').attr('fill', 'url(#legend-grad)');
const gLegendAxis = gLegend.append('g').attr('class', 'axis');
const legendTitle = gLegend.append('text').attr('class', 'legend-title').attr('text-anchor', 'end');
const legendNote = gLegend.append('text').attr('class', 'note').attr('text-anchor', 'end');
const gBrush = gLegend.append('g').attr('class', 'brush');
const markerUnder = gLegend.append('line').attr('class', 'marker-under').attr('display', 'none');
const marker = gLegend.append('line').attr('class', 'marker').attr('display', 'none');

const gPlot = svg.append('g').attr('class', 'plot');
const frame = gPlot.append('rect').attr('class', 'frame');
const gPlotInner = gPlot.append('g').attr('clip-path', 'url(#plot-clip)');
const hoverUnder = gPlotInner.append('path').attr('class', 'hover-under').attr('display', 'none');
const hoverCell = gPlotInner.append('path').attr('class', 'hover-cell').attr('display', 'none');
const boxRect = gPlotInner.append('rect').attr('class', 'box').attr('display', 'none');
const hit = gPlot.append('rect').attr('class', 'hit').attr('data-export', 'skip');

// ------------------------------------------------------------------------------------------------
// Runtime state
// ------------------------------------------------------------------------------------------------

let data = null;
let grid = null;
let contourGrid = null;
let rawVals = null;
let vals = null;
let prof = null;
let contourField = null;
let color = null;
let contourSet = null;
let L = null;
let xBase;
let yBase;
let xz;
let yz;
let transform = d3.zoomIdentity;
let prevPlot = null;
let yTickW = 0;
let hover = null;
let zooming = false;
let contoursDeferred = false;
let silent = false;
let order = null;
const timings = { bin: 0, render: 0 };

let dirty = 0;
let raf = 0;
let running = false;

function invalidate(flags) {
  dirty |= flags;
  if (!raf && !running) raf = requestAnimationFrame(run);
}

// ------------------------------------------------------------------------------------------------
// Zoom (semantic: every zoom level is re-binned from the raw points) and legend brush
// ------------------------------------------------------------------------------------------------

const zoom = d3
  .zoom()
  .scaleExtent([1, MAX_ZOOM])
  .filter((e) => (!e.ctrlKey || e.type === 'wheel') && !e.button && !(e.shiftKey && e.type === 'mousedown'))
  .on('start', () => {
    if (silent) return;
    zooming = true;
    ui.chart.classList.add('panning');
    hideHover();
  })
  .on('zoom', (e) => {
    transform = e.transform;
    if (silent || running) return;
    invalidate(BIN);
  })
  .on('end', () => {
    if (silent) return;
    zooming = false;
    ui.chart.classList.remove('panning');
    invalidate(contoursDeferred ? BIN : DRAW);
  });
hit.call(zoom);

const brush = d3.brushY().on('brush end', (e) => {
  if (silent) return;
  if (!e.selection || !L) {
    state.filter = null;
  } else {
    const [s0, s1] = e.selection;
    state.filter = [Math.max(0, 1 - s1 / L.ph), Math.min(1, 1 - s0 / L.ph)];
  }
  invalidate(DRAW);
});

function setBrushSilently(sel) {
  silent = true;
  gBrush.call(brush.move, sel);
  silent = false;
}

// ------------------------------------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------------------------------------

function computeLayout() {
  const W = Math.max(320, ui.chart.clientWidth);
  const H = Math.max(240, ui.chart.clientHeight);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const left = Math.max(58, Math.ceil(yTickW) + 40);
  const bottom = 46;
  const top = state.marginals ? MARG + MGAP + 10 : 34;
  const right = LEG_W + 12 + (state.marginals ? MARG + MGAP + 14 : 18);
  let pw = W - left - right;
  let ph = H - top - bottom;
  if (data.equalAspect) {
    const aspect = (data.X1 - data.X0) / (data.Y1 - data.Y0);
    if (pw / ph > aspect) pw = ph * aspect;
    else ph = pw / aspect;
  }
  pw = Math.max(80, Math.floor(pw));
  ph = Math.max(80, Math.floor(ph));
  const px = left + Math.max(0, Math.floor((W - left - right - pw) / 2));
  const py = top + Math.max(0, Math.floor((H - top - bottom - ph) / 2));
  const lx = px + pw + (state.marginals ? MGAP + MARG + 14 : 18);
  L = { W, H, dpr, left, px, py, pw, ph, lx };

  const cw = Math.round(W * dpr);
  const chh = Math.round(H * dpr);
  if (ui.canvas.width !== cw || ui.canvas.height !== chh) {
    ui.canvas.width = cw;
    ui.canvas.height = chh;
    hatch = null;
  }
  ui.canvas.style.width = `${W}px`;
  ui.canvas.style.height = `${H}px`;
  svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);

  xBase = d3.scaleLinear().domain([data.X0, data.X1]).range([0, pw]);
  yBase = d3.scaleLinear().domain([data.Y0, data.Y1]).range([ph, 0]);

  zoom.extent([[0, 0], [pw, ph]]).translateExtent([[0, 0], [pw, ph]]);
  // Keep the same data window in view when the plot is resized while zoomed.
  if (prevPlot && (prevPlot[0] !== pw || prevPlot[1] !== ph) && transform.k !== 1) {
    const t = d3.zoomIdentity.translate((transform.x * pw) / prevPlot[0], (transform.y * ph) / prevPlot[1]).scale(transform.k);
    silent = true;
    hit.call(zoom.transform, t);
    silent = false;
  }
  prevPlot = [pw, ph];

  gPlot.attr('transform', `translate(${px},${py})`);
  plotClip.attr('width', pw).attr('height', ph);
  frame.attr('width', pw).attr('height', ph);
  hit.attr('width', pw).attr('height', ph);

  brush.extent([[0, 0], [LEG_HIST + LEG_GAP + LEG_BAR, ph]]);
  gBrush.call(brush);
  setBrushSilently(state.filter ? [(1 - state.filter[1]) * ph, (1 - state.filter[0]) * ph] : null);
}

// ------------------------------------------------------------------------------------------------
// Pipeline
// ------------------------------------------------------------------------------------------------

function run() {
  raf = 0;
  if (!data) {
    dirty = 0;
    return;
  }
  running = true;
  let f = dirty;
  dirty = 0;
  try {
    if (f & LAYOUT) {
      computeLayout();
      f |= BIN;
    }
    xz = transform.rescaleX(xBase);
    yz = transform.rescaleY(yBase);
    const t0 = performance.now();
    if (f & BIN) {
      doBin();
      f |= VAL;
    }
    const tb = performance.now();
    if (f & VAL) {
      doValues();
      f |= COLOR;
    }
    const t1 = performance.now();
    if (f & (BIN | VAL)) timings.bin = t1 - t0;
    if (f & COLOR) doColor();
    const tc = performance.now();
    draw();
    const t2 = performance.now();
    timings.render = t2 - t1;
    timings.stages = { bin: tb - t0, values: t1 - tb, color: tc - t1, draw: t2 - tc };
    updateHeader();
  } finally {
    running = false;
  }
  if (dirty) raf = requestAnimationFrame(run);
}

function currentView() {
  return {
    X0: data.X0,
    X1: data.X1,
    Y0: data.Y0,
    Y1: data.Y1,
    pw: L.pw,
    ph: L.ph,
    k: transform.k,
    tx: transform.x,
    ty: transform.y,
    xz,
    yz,
  };
}

function doBin() {
  const view = currentView();
  const wantMedian = state.agg === 'median';
  if (state.grid === 'hex') {
    const bins = [Math.max(1, Math.round(L.pw / state.cell)), Math.max(1, Math.round(L.ph / state.cell))];
    grid = binHex(data, hexLattice(view, state.cell), view, wantMedian, bins);
    // The extra square pass behind hexagon contours waits until a zoom / pan gesture ends.
    contourGrid = state.contours && !zooming ? binSquare(data, squareLattice(view, state.cell), view, false, 'contour') : null;
  } else {
    grid = binSquare(data, squareLattice(view, state.cell), view, wantMedian);
    contourGrid = null;
  }
}

function doValues() {
  rawVals = cellValues(grid, state.agg, state.minCount);
  const smooth = grid.kind === 'rect' && state.sigma > 0;
  vals = smooth ? smoothValues(grid, rawVals, state.agg, state.sigma) : rawVals;
  prof = profiles(grid, state.agg);
  contourField = null;
  contoursDeferred = false;
  if (!state.contours) return;
  // Contours are traced on a field smoothed by at least one cell, with small holes filled,
  // so they follow the surface instead of ringing around bin noise and empty cells.
  const sigma = Math.max(1, grid.kind === 'rect' ? state.sigma : 1);
  const g = grid.kind === 'rect' ? grid : contourGrid;
  if (!g || (zooming && g.N > 60000)) {
    contoursDeferred = true;
    return;
  }
  const agg = grid.kind === 'rect' || state.agg !== 'median' ? state.agg : 'mean';
  const raw = grid.kind === 'rect' ? rawVals : cellValues(g, agg, state.minCount);
  contourField = { g, f: dilate(smoothValues(g, raw, agg, sigma, 0.15), g.nx, g.ny, 3) };
}

const lutCache = new Map();
function palette(key, reverse) {
  const id = `${key}:${reverse}`;
  if (lutCache.has(id)) return lutCache.get(id);
  const f = SCHEMES[key].f;
  const lut = new Uint32Array(256);
  const dim = new Uint32Array(256);
  const css = new Array(256);
  for (let i = 0; i < 256; i++) {
    const c = d3.rgb(f(reverse ? 1 - i / 255 : i / 255));
    const r = Math.round(c.r);
    const g = Math.round(c.g);
    const b = Math.round(c.b);
    lut[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    dim[i] = ((34 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    css[i] = `rgb(${r},${g},${b})`;
  }
  const p = { lut, dim, css };
  lutCache.set(id, p);
  return p;
}

// Maps every cell value to t in [0, 1] (the colour-bar position) through the chosen d3 scale.
function buildColor(v) {
  const N = v.length;
  const fin = new Float64Array(N);
  let m = 0;
  for (let c = 0; c < N; c++) {
    const x = v[c];
    if (x === x) fin[m++] = x;
  }
  const t = new Float32Array(N).fill(NaN);
  const pal = palette(state.scheme, state.reverse);
  const hist = new Uint32Array(HIST_BINS);
  if (!m) {
    return { empty: true, t, ...pal, hist, lo: 0, hi: 1, kind: 'linear', axis: d3.scaleLinear(), sorted: fin.subarray(0, 0), filled: 0, fmt: valueFormatter(0, 1) };
  }
  const sorted = fin.subarray(0, m).sort();
  let kind = state.scale;
  const robust = state.clip && kind !== 'quantile' && m >= 50;
  let lo = robust ? d3.quantileSorted(sorted, 0.01) : sorted[0];
  let hi = robust ? d3.quantileSorted(sorted, 0.99) : sorted[m - 1];
  if (!(hi > lo)) {
    const d = Math.abs(lo) * 0.05 || 0.5;
    lo -= d;
    hi += d;
  }
  if (kind === 'log' && lo <= 0) kind = 'symlog';
  const diverging = SCHEMES[state.scheme].diverging && lo < 0 && hi > 0 && kind !== 'quantile';
  if (diverging) {
    const a = Math.max(-lo, hi);
    lo = -a;
    hi = a;
  }
  let axis;
  if (kind === 'quantile') {
    const denom = Math.max(1, m - 1);
    for (let c = 0; c < N; c++) {
      const x = v[c];
      if (x === x) t[c] = (d3.bisectLeft(sorted, x) + d3.bisectRight(sorted, x) - 1) / 2 / denom;
    }
    axis = d3.scaleLinear().domain([0, 1]);
  } else {
    if (kind === 'sqrt') axis = d3.scaleSqrt();
    else if (kind === 'log') axis = d3.scaleLog();
    else if (kind === 'symlog') axis = d3.scaleSymlog().constant(Math.max(Math.abs(lo), Math.abs(hi)) / 1000);
    else axis = d3.scaleLinear();
    axis.domain([lo, hi]);
    const norm = axis.copy().range([0, 1]).clamp(true);
    for (let c = 0; c < N; c++) {
      const x = v[c];
      if (x === x) t[c] = norm(x);
    }
  }
  for (let c = 0; c < N; c++) {
    const x = t[c];
    if (x === x) hist[Math.min(HIST_BINS - 1, (x * HIST_BINS) | 0)]++;
  }
  return { empty: false, t, ...pal, hist, lo, hi, kind, axis, sorted, filled: m, fmt: valueFormatter(lo, hi), diverging };
}

function valueAtT(t) {
  if (!color || color.empty) return NaN;
  if (color.kind === 'quantile') return d3.quantileSorted(color.sorted, t);
  return color.axis.copy().range([0, 1]).invert(t);
}

function buildContours(cf, col) {
  const { levels } = state;
  let thr;
  if (col.kind === 'quantile') {
    thr = d3.range(1, levels).map((i) => d3.quantileSorted(col.sorted, i / levels));
  } else if (col.kind === 'log') {
    const a = Math.log10(col.lo);
    const b = Math.log10(col.hi);
    thr = d3.range(1, levels).map((i) => 10 ** (a + ((b - a) * i) / levels));
  } else {
    thr = col.axis.ticks(levels);
  }
  thr = Array.from(new Set(thr.filter((x) => x > col.lo && x < col.hi)));
  if (!thr.length) return null;
  const polys = d3.contours().size([cf.g.nx, cf.g.ny]).thresholds(thr)(cf.f);
  const major = col.kind === 'linear' && thr.length > 4 ? 5 * d3.tickStep(col.lo, col.hi, levels) : 0;
  return { g: cf.g, polys, major };
}

function doColor() {
  color = buildColor(vals);
  contourSet = state.contours && contourField && !color.empty ? buildContours(contourField, color) : null;
  updateSchemeSwatch();
}

// ------------------------------------------------------------------------------------------------
// Drawing: canvas for cells / contours / points, SVG for everything with text
// ------------------------------------------------------------------------------------------------

function makeHatch() {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = '#0f141c';
  g.fillRect(0, 0, 8, 8);
  g.strokeStyle = '#1c2431';
  g.lineWidth = 1;
  g.beginPath();
  for (const o of [-8, 0, 8]) {
    g.moveTo(o, 8);
    g.lineTo(o + 8, 0);
  }
  g.stroke();
  return ctx.createPattern(c, 'repeat');
}

function draw() {
  drawCanvas();
  drawAxes();
  drawMarginals();
  drawLegend();
  updateFilterChip();
  updateHover();
}

function drawCanvas() {
  const { W, H, px, py, pw, ph, dpr } = L;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!hatch) hatch = makeHatch();
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  ctx.fillStyle = hatch;
  ctx.fillRect(px, py, pw, ph);
  coverage = null;
  if (grid && color && !color.empty) {
    if (grid.kind === 'rect') paintSquares();
    else if (grid.N > HEX_RASTER_ABOVE) paintHexRaster();
    else paintHexes();
  }
  if (contourSet) paintContours();
  if (state.points) paintPoints();
  ctx.restore();
}

function paintSquares() {
  const g = grid;
  const { nx, ny } = g;
  if (off.width !== nx || off.height !== ny || !imgData) {
    off.width = nx;
    off.height = ny;
    imgData = offCtx.createImageData(nx, ny);
  }
  if (maskCanvas.width !== nx || maskCanvas.height !== ny || !maskData) {
    maskCanvas.width = nx;
    maskCanvas.height = ny;
    maskData = maskCtx.createImageData(nx, ny);
  }
  const px32 = new Uint32Array(imgData.data.buffer);
  const m32 = new Uint32Array(maskData.data.buffer);
  const t = color.t;
  const { lut, dim } = color;
  const f = state.filter;
  const f0 = f ? f[0] : 0;
  const f1 = f ? f[1] : 1;
  for (let c = 0; c < g.N; c++) {
    const v = t[c];
    if (v !== v) {
      px32[c] = 0;
      m32[c] = 0;
      continue;
    }
    const li = (v * 255 + 0.5) | 0;
    px32[c] = f && (v < f0 || v > f1) ? dim[li] : lut[li];
    m32[c] = 0xff000000;
  }
  offCtx.putImageData(imgData, 0, 0);
  maskCtx.putImageData(maskData, 0, 0);
  const x0 = L.px + xz(g.gx0);
  const x1 = L.px + xz(g.gx0 + nx * g.bw);
  const y0 = L.py + yz(g.gy0 + ny * g.bh);
  const y1 = L.py + yz(g.gy0);
  const rect = [x0, y0, x1 - x0, y1 - y0];
  ctx.imageSmoothingEnabled = state.bilinear;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, ...rect);
  coverage = { canvas: maskCanvas, rect };
}

// Hexagons are batched into one Path2D per colour so a frame costs ~256 fills, not one per cell.
function paintHexes() {
  const g = grid;
  const k = transform.k;
  const R = g.r * k + 0.5;
  const hw = (R * SQRT3) / 2;
  const hh = R / 2;
  const ox = L.px + transform.x;
  const oy = L.py + transform.y;
  const t = color.t;
  const f = state.filter;
  const paths = new Map();
  for (let c = 0; c < g.N; c++) {
    const v = t[c];
    if (v !== v) continue;
    const ci = c % g.cols;
    const cj = (c - ci) / g.cols;
    const pi = ci + g.pi0;
    const pj = cj + g.pj0;
    const cx = ox + (pi + (pj & 1) / 2) * g.dx * k;
    const cy = oy + pj * g.dy * k;
    let key = (v * 255 + 0.5) | 0;
    if (f && (v < f[0] || v > f[1])) key += 256;
    let p = paths.get(key);
    if (!p) paths.set(key, (p = new Path2D()));
    p.moveTo(cx, cy - R);
    p.lineTo(cx + hw, cy - hh);
    p.lineTo(cx + hw, cy + hh);
    p.lineTo(cx, cy + R);
    p.lineTo(cx - hw, cy + hh);
    p.lineTo(cx - hw, cy - hh);
    p.closePath();
  }
  const mask = new Path2D();
  for (const [key, p] of paths) {
    ctx.globalAlpha = key >= 256 ? 0.14 : 1;
    ctx.fillStyle = color.css[key & 255];
    ctx.fill(p);
    mask.addPath(p);
  }
  ctx.globalAlpha = 1;
  coverage = { path: mask };
}

// Same lattice, rasterised: each device pixel of the plot looks up the hexagon it falls in, so
// the cost depends on the plot size rather than on the number of hexagons.
function paintHexRaster() {
  const g = grid;
  const { px, py, pw, ph, dpr } = L;
  const w = Math.max(1, Math.round(pw * dpr));
  const h = Math.max(1, Math.round(ph * dpr));
  if (hexOff.width !== w || hexOff.height !== h || !hexImg) {
    hexOff.width = hexMaskOff.width = w;
    hexOff.height = hexMaskOff.height = h;
    hexImg = hexOffCtx.createImageData(w, h);
    hexMaskImg = hexMaskCtx.createImageData(w, h);
  }
  const out = new Uint32Array(hexImg.data.buffer);
  const msk = new Uint32Array(hexMaskImg.data.buffer);
  const { lut, dim } = color;
  const t = color.t;
  const f = state.filter;
  const { dx, dy, pi0, pj0, cols, rows } = g;
  const k = transform.k;
  const tx = transform.x;
  const ty = transform.y;
  for (let j = 0, q = 0; j < h; j++) {
    const pyr = ((j + 0.5) / dpr - ty) / k / dy;
    const pjr = Math.round(pyr);
    const py1 = pyr - pjr;
    const ambiguous = Math.abs(py1) * 3 > 1;
    for (let i = 0; i < w; i++, q++) {
      let pj = pjr;
      const pxr = ((i + 0.5) / dpr - tx) / k / dx - (pj & 1) / 2;
      let pi = Math.round(pxr);
      if (ambiguous) {
        const px1 = pxr - pi;
        const pi2 = pi + (pxr < pi ? -1 : 1) / 2;
        const pj2 = pj + (pyr < pj ? -1 : 1);
        const px2 = pxr - pi2;
        const py2 = pyr - pj2;
        if (px1 * px1 + py1 * py1 > px2 * px2 + py2 * py2) {
          pi = pi2 + (pj & 1 ? 1 : -1) / 2;
          pj = pj2;
        }
      }
      const ci = pi - pi0;
      const cj = pj - pj0;
      const v = ci >= 0 && ci < cols && cj >= 0 && cj < rows ? t[cj * cols + ci] : NaN;
      if (v !== v) {
        out[q] = 0;
        msk[q] = 0;
        continue;
      }
      const li = (v * 255 + 0.5) | 0;
      out[q] = f && (v < f[0] || v > f[1]) ? dim[li] : lut[li];
      msk[q] = 0xff000000;
    }
  }
  hexOffCtx.putImageData(hexImg, 0, 0);
  hexMaskCtx.putImageData(hexMaskImg, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(hexOff, px, py, pw, ph);
  coverage = { canvas: hexMaskOff, rect: [px, py, pw, ph] };
}

function paintContours() {
  const { g, polys, major } = contourSet;
  const ox = L.px + xz(g.gx0);
  const oy = L.py + yz(g.gy0 + g.ny * g.bh);
  const cw = xz(g.gx0 + g.bw) - xz(g.gx0);
  const ch = yz(g.gy0) - yz(g.gy0 + g.bh);
  const projection = d3.geoTransform({
    point(x, y) {
      this.stream.point(ox + x * cw, oy + y * ch);
    },
  });
  const path = d3.geoPath(projection, ctx);
  const isMajor = (v) => major > 0 && Math.abs(v / major - Math.round(v / major)) < 1e-6;
  const minor = new Path2D();
  const majors = new Path2D();
  const minorPath = d3.geoPath(projection, minor);
  const majorPath = d3.geoPath(projection, majors);
  for (const mp of polys) {
    if (mp.coordinates.length) (isMajor(mp.value) ? majorPath : minorPath)(mp);
  }
  if (lineLayer.width !== ui.canvas.width || lineLayer.height !== ui.canvas.height) {
    lineLayer.width = ui.canvas.width;
    lineLayer.height = ui.canvas.height;
  }
  const c = lineCtx;
  c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, L.W, L.H);
  // A dark halo under a light line keeps the isolines legible on both ends of any colour scheme.
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(4, 6, 10, 0.5)';
  c.lineWidth = 1.9;
  c.stroke(minor);
  c.lineWidth = 2.8;
  c.stroke(majors);
  c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  c.lineWidth = 0.75;
  c.stroke(minor);
  c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  c.lineWidth = 1.3;
  c.stroke(majors);
  // Keep the isolines only where cells hold data.
  c.globalCompositeOperation = 'destination-in';
  if (coverage && coverage.canvas) {
    c.imageSmoothingEnabled = false;
    c.drawImage(coverage.canvas, ...coverage.rect);
  } else if (coverage && coverage.path) {
    c.fillStyle = '#000';
    c.fill(coverage.path);
  }
  c.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lineLayer, 0, 0);
  ctx.restore();
}

function getOrder() {
  if (data.shuffled) return null;
  if (!order || order.length !== data.n) {
    order = new Uint32Array(data.n);
    for (let i = 0; i < data.n; i++) order[i] = i;
    for (let i = data.n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
  }
  return order;
}

function visibleWindow() {
  const [ax, bx] = xz.domain();
  const [ay, by] = yz.domain();
  return [Math.min(ax, bx), Math.max(ax, bx), Math.min(ay, by), Math.max(ay, by)];
}

// A random subset of the raw points on top of the cells, to show what was aggregated.
function paintPoints() {
  const [vx0, vx1, vy0, vy1] = visibleWindow();
  const X = data.x;
  const Y = data.y;
  const ord = getOrder();
  const sx = [];
  const sy = [];
  for (let q = 0; q < data.n && sx.length < SAMPLE_POINTS; q++) {
    const p = ord ? ord[q] : q;
    const x = X[p];
    const y = Y[p];
    if (x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1) {
      sx.push(L.px + xz(x));
      sy.push(L.py + yz(y));
    }
  }
  ctx.fillStyle = 'rgba(3, 5, 8, 0.6)';
  for (let i = 0; i < sx.length; i++) ctx.fillRect(sx[i] - 1.5, sy[i] - 1.5, 3, 3);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  for (let i = 0; i < sx.length; i++) ctx.fillRect(sx[i] - 0.6, sy[i] - 0.6, 1.2, 1.2);
}

function drawAxes() {
  const { px, py, pw, ph } = L;
  gXAxis
    .attr('transform', `translate(${px},${py + ph})`)
    .call(d3.axisBottom(xz).ticks(Math.max(2, Math.floor(pw / 90))).tickSize(5).tickSizeOuter(0).tickPadding(5));
  gYAxis
    .attr('transform', `translate(${px},${py})`)
    .call(d3.axisLeft(yz).ticks(Math.max(2, Math.floor(ph / 64))).tickSize(5).tickSizeOuter(0).tickPadding(5));
  let w = 0;
  gYAxis.selectAll('.tick text').each(function measure() {
    w = Math.max(w, this.getComputedTextLength());
  });
  // The left margin only ever grows, so labels changing while zooming cannot make the plot jump.
  if (w > yTickW + 0.5) {
    yTickW = w;
    if (Math.max(58, Math.ceil(yTickW) + 40) !== L.left) invalidate(LAYOUT);
  }
  xLabel.attr('x', px + pw / 2).attr('y', py + ph + 38).text(data.labels.x);
  yLabel.attr('transform', `translate(${px - Math.ceil(yTickW) - 22},${py + ph / 2}) rotate(-90)`).text(data.labels.y);
}

function profileDomain(s) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < s.v.length; i++) {
    const a = s.lo[i];
    const b = s.hi[i];
    if (a === a && a < lo) lo = a;
    if (b === b && b > hi) hi = b;
  }
  if (!(hi >= lo)) return [0, 1];
  if (s.additive) lo = Math.min(0, lo);
  if (hi === lo) hi = lo + 1;
  return [lo, hi];
}

function drawMarginals() {
  const show = state.marginals && prof;
  gTop.attr('display', show ? null : 'none');
  gRight.attr('display', show ? null : 'none');
  if (!show) return;
  const { px, py, pw, ph } = L;
  const finite = (arr) => (i) => Number.isFinite(arr[i]);

  const T = prof.x;
  const ti = d3.range(T.c.length);
  const yM = d3.scaleLinear().domain(profileDomain(T)).nice(3).range([MARG, 4]);
  const tx = (i) => xz(T.c[i]);
  gTop.attr('transform', `translate(${px},${py - MGAP - MARG})`);
  topClip.attr('x', 0).attr('y', 0).attr('width', pw).attr('height', MARG + 1);
  gTop.select('.band').attr('d', T.band ? d3.area().defined(finite(T.lo)).x(tx).y0((i) => yM(T.lo[i])).y1((i) => yM(T.hi[i])).curve(d3.curveMonotoneX)(ti) : null);
  gTop.select('.area').attr('d', T.additive ? d3.area().defined(finite(T.v)).x(tx).y0(yM(Math.max(yM.domain()[0], 0))).y1((i) => yM(T.v[i])).curve(d3.curveMonotoneX)(ti) : null);
  gTop.select('.line').attr('d', d3.line().defined(finite(T.v)).x(tx).y((i) => yM(T.v[i])).curve(d3.curveMonotoneX)(ti));
  gTop.select('.base').attr('x1', 0).attr('x2', pw).attr('y1', MARG + 0.5).attr('y2', MARG + 0.5);
  gTop.select('.axis').call(d3.axisLeft(yM).tickValues(yM.domain()).tickFormat(d3.format('~s')).tickSize(3).tickSizeOuter(0));
  gTop.select('.cap').attr('x', pw).attr('y', 9).attr('text-anchor', 'end').text(profileCaption());

  const R = prof.y;
  const ri = d3.range(R.c.length);
  const xM = d3.scaleLinear().domain(profileDomain(R)).nice(3).range([0, MARG - 4]);
  const ry = (i) => yz(R.c[i]);
  gRight.attr('transform', `translate(${px + pw + MGAP},${py})`);
  rightClip.attr('x', -1).attr('y', 0).attr('width', MARG + 1).attr('height', ph);
  gRight.select('.band').attr('d', R.band ? d3.area().defined(finite(R.lo)).y(ry).x0((i) => xM(R.lo[i])).x1((i) => xM(R.hi[i])).curve(d3.curveMonotoneY)(ri) : null);
  gRight.select('.area').attr('d', R.additive ? d3.area().defined(finite(R.v)).y(ry).x0(xM(Math.max(xM.domain()[0], 0))).x1((i) => xM(R.v[i])).curve(d3.curveMonotoneY)(ri) : null);
  gRight.select('.line').attr('d', d3.line().defined(finite(R.v)).y(ry).x((i) => xM(R.v[i])).curve(d3.curveMonotoneY)(ri));
  gRight.select('.base').attr('x1', -0.5).attr('x2', -0.5).attr('y1', 0).attr('y2', ph);
  gRight
    .select('.axis')
    .attr('transform', `translate(0,${ph})`)
    .call(d3.axisBottom(xM).tickValues(xM.domain()).tickFormat(d3.format('~s')).tickSize(3).tickSizeOuter(0))
    .selectAll('.tick text')
    .attr('text-anchor', (d, i) => (i ? 'end' : 'start'));
}

function drawLegend() {
  const { ph, py, lx } = L;
  gLegend.attr('transform', `translate(${lx},${py})`);
  const bx = LEG_HIST + LEG_GAP;
  legendBar.attr('x', bx).attr('y', 0).attr('width', LEG_BAR).attr('height', ph);
  grad
    .selectAll('stop')
    .data(d3.range(33).map((i) => i / 32))
    .join('stop')
    .attr('offset', (d) => d)
    .attr('stop-color', (d) => color.css[Math.round(d * 255)]);

  const maxH = d3.max(color.hist) || 1;
  const bh = ph / HIST_BINS;
  const f = state.filter;
  gHist
    .selectAll('rect')
    .data(Array.from(color.hist))
    .join('rect')
    .attr('x', (d) => LEG_HIST - LEG_HIST * Math.sqrt(d / maxH))
    .attr('width', (d) => LEG_HIST * Math.sqrt(d / maxH))
    .attr('y', (d, i) => ph - (i + 1) * bh + 0.5)
    .attr('height', Math.max(0.5, bh - 1))
    .attr('fill', (d, i) => color.css[Math.round(((i + 0.5) / HIST_BINS) * 255)])
    .attr('opacity', (d, i) => {
      const mid = (i + 0.5) / HIST_BINS;
      return !f || (mid >= f[0] && mid <= f[1]) ? 0.95 : 0.25;
    });

  gLegendAxis.attr('transform', `translate(${bx + LEG_BAR},0)`).attr('display', color.empty ? 'none' : null);
  if (!color.empty) {
    const nTicks = Math.max(3, Math.floor(ph / 52));
    if (color.kind === 'quantile') {
      gLegendAxis.call(
        d3
          .axisRight(d3.scaleLinear().range([ph, 0]))
          .tickValues([0, 0.1, 0.25, 0.5, 0.75, 0.9, 1])
          .tickFormat((q) => color.fmt(d3.quantileSorted(color.sorted, q)))
          .tickSize(4),
      );
    } else if (color.kind === 'log') {
      gLegendAxis.call(d3.axisRight(color.axis.copy().range([ph, 0])).ticks(nTicks, '~s').tickSize(4));
    } else {
      const big = Math.max(Math.abs(color.lo), Math.abs(color.hi)) >= 1e5;
      const a = d3.axisRight(color.axis.copy().range([ph, 0])).tickSize(4);
      if (big) a.ticks(nTicks, '~s');
      else a.ticks(nTicks);
      gLegendAxis.call(a);
    }
  }
  legendTitle.attr('x', LEG_W).attr('y', -22).text(valueTitle());
  const scaleName = { linear: 'linear', sqrt: 'sqrt', log: 'log', symlog: 'symlog', quantile: 'quantile' }[color.kind];
  const clipped = state.clip && color.kind !== 'quantile' ? ' · clipped 1–99%' : '';
  legendNote.attr('x', LEG_W).attr('y', -9).text(`${scaleName} scale${clipped}`);
}

function updateFilterChip() {
  const f = state.filter;
  if (!f || !color || color.empty) {
    ui.filterChip.hidden = true;
    return;
  }
  let inside = 0;
  for (let c = 0; c < color.t.length; c++) {
    const t = color.t[c];
    if (t >= f[0] && t <= f[1]) inside++;
  }
  ui.filterChip.hidden = false;
  const fmt = displayFormat();
  ui.filterRange.textContent = `${fmt(valueAtT(f[0]))} – ${fmt(valueAtT(f[1]))} · ${d3.format('.0%')(inside / Math.max(1, color.filled))} of cells`;
}

// ------------------------------------------------------------------------------------------------
// Hover: cell outline, tooltip, marginal crosshairs, colour-bar marker
// ------------------------------------------------------------------------------------------------

function cellAt(mx, my) {
  if (!grid || mx < 0 || my < 0 || mx >= L.pw || my >= L.ph) return -1;
  if (grid.kind === 'rect') {
    const col = Math.floor((xz.invert(mx) - grid.gx0) / grid.bw);
    const up = Math.floor((yz.invert(my) - grid.gy0) / grid.bh);
    if (col < 0 || col >= grid.nx || up < 0 || up >= grid.ny) return -1;
    return (grid.ny - 1 - up) * grid.nx + col;
  }
  const [pi, pj] = hexIndex((mx - transform.x) / transform.k, (my - transform.y) / transform.k, grid.dx, grid.dy);
  const ci = pi - grid.pi0;
  const cj = pj - grid.pj0;
  if (ci < 0 || ci >= grid.cols || cj < 0 || cj >= grid.rows) return -1;
  return cj * grid.cols + ci;
}

function hexCenter(c) {
  const ci = c % grid.cols;
  const cj = (c - ci) / grid.cols;
  const pi = ci + grid.pi0;
  const pj = cj + grid.pj0;
  return [(pi + (pj & 1) / 2) * grid.dx * transform.k + transform.x, pj * grid.dy * transform.k + transform.y];
}

function cellBounds(c) {
  const col = c % grid.nx;
  const row = (c - col) / grid.nx;
  const x0 = grid.gx0 + col * grid.bw;
  const y0 = grid.gy0 + (grid.ny - 1 - row) * grid.bh;
  return [x0, x0 + grid.bw, y0, y0 + grid.bh];
}

function cellPath(c) {
  if (grid.kind === 'rect') {
    const [x0, x1, y0, y1] = cellBounds(c);
    const a = xz(x0);
    const b = xz(x1);
    const top = yz(y1);
    const bot = yz(y0);
    return `M${a},${top}H${b}V${bot}H${a}Z`;
  }
  const [cx, cy] = hexCenter(c);
  const R = grid.r * transform.k;
  const hw = (R * SQRT3) / 2;
  const hh = R / 2;
  return `M${cx},${cy - R}L${cx + hw},${cy - hh}L${cx + hw},${cy + hh}L${cx},${cy + R}L${cx - hw},${cy + hh}L${cx - hw},${cy - hh}Z`;
}

function hideHover() {
  hoverCell.attr('display', 'none');
  hoverUnder.attr('display', 'none');
  marker.attr('display', 'none');
  markerUnder.attr('display', 'none');
  gTop.select('.cross').attr('display', 'none');
  gRight.select('.cross').attr('display', 'none');
  ui.tip.hidden = true;
}

function displayFormat() {
  if (state.agg === 'count') return d3.format(',.4~r');
  if (state.agg === 'sum') return d3.format(',.4~s');
  return color.fmt;
}

function tipHTML(c) {
  const g = grid;
  const n = g.count[c];
  const fmt = data.vfmt;
  const v = vals[c];
  const t = color.t[c];
  const swatch = Number.isFinite(t) ? color.css[Math.round(t * 255)] : 'transparent';
  let where;
  if (g.kind === 'rect') {
    const [x0, x1, y0, y1] = cellBounds(c);
    const fx = coordFormat(g.bw);
    const fy = coordFormat(g.bh);
    where = `x ${fx(x0)} – ${fx(x1)} · y ${fy(y0)} – ${fy(y1)}`;
  } else {
    const [sx, sy] = hexCenter(c);
    const f = coordFormat(Math.abs(xz.invert(g.dx * transform.k) - xz.invert(0)));
    where = `hexagon at x ${f(xz.invert(sx))} · y ${f(yz.invert(sy))}`;
  }
  const rows = [['points', fmtInt(n)]];
  if (n) {
    const mean = g.sum[c] / n;
    const sd = n > 1 ? Math.sqrt(Math.max(0, (g.sumSq[c] - g.sum[c] * mean) / (n - 1))) : NaN;
    rows.push(['mean', fmt(mean)]);
    if (g.median) rows.push(['median', fmt(g.median[c])]);
    rows.push(['std dev', Number.isFinite(sd) ? fmt(sd) : '—']);
    rows.push(['min … max', `${fmt(g.min[c])} … ${fmt(g.max[c])}`]);
    rows.push(['sum', d3.format(',.4~s')(g.sum[c])]);
  }
  let note = '';
  if (n < state.minCount) note = Number.isFinite(v) ? 'no qualifying points · filled by smoothing' : `fewer than ${state.minCount} points · left empty`;
  else if (vals !== rawVals) note = `display value smoothed (σ = ${state.sigma} cells)`;
  const unit = data.labels.unit ? ` ${data.labels.unit}` : '';
  const shown = Number.isFinite(v) ? `${displayFormat()(v)}${state.agg === 'count' ? '' : unit}` : '—';
  return (
    `<div class="tt-head"><i style="background:${swatch}"></i><b>${shown}</b><span>${valueTitle()}</span></div>` +
    `<div class="tt-where">${where}</div>` +
    `<table>${rows.map(([k, val]) => `<tr><th>${k}</th><td>${val}</td></tr>`).join('')}</table>` +
    (note ? `<div class="tt-note">${note}</div>` : '')
  );
}

function updateHover() {
  if (!hover || !grid || !color || zooming) {
    hideHover();
    return;
  }
  const { mx, my } = hover;
  if (state.marginals) {
    gTop.select('.cross').attr('display', null).attr('x1', mx).attr('x2', mx).attr('y1', 0).attr('y2', MARG);
    gRight.select('.cross').attr('display', null).attr('x1', 0).attr('x2', MARG).attr('y1', my).attr('y2', my);
  }
  const c = cellAt(mx, my);
  if (c < 0 || (grid.count[c] === 0 && !Number.isFinite(vals[c]))) {
    hoverCell.attr('display', 'none');
    hoverUnder.attr('display', 'none');
    marker.attr('display', 'none');
    markerUnder.attr('display', 'none');
    ui.tip.hidden = true;
    return;
  }
  const d = cellPath(c);
  hoverUnder.attr('d', d).attr('display', null);
  hoverCell.attr('d', d).attr('display', null);
  const t = color.t[c];
  if (Number.isFinite(t)) {
    const y = L.ph * (1 - t);
    const x2 = LEG_HIST + LEG_GAP + LEG_BAR + 4;
    markerUnder.attr('x1', LEG_HIST - 2).attr('x2', x2).attr('y1', y).attr('y2', y).attr('display', null);
    marker.attr('x1', LEG_HIST - 2).attr('x2', x2).attr('y1', y).attr('y2', y).attr('display', null);
  } else {
    marker.attr('display', 'none');
    markerUnder.attr('display', 'none');
  }
  ui.tip.innerHTML = tipHTML(c);
  ui.tip.hidden = false;
  const tw = ui.tip.offsetWidth;
  const th = ui.tip.offsetHeight;
  let x = L.px + mx + 18;
  let y = L.py + my + 18;
  if (x + tw > L.W - 6) x = L.px + mx - 18 - tw;
  if (y + th > L.H - 6) y = L.py + my - 18 - th;
  ui.tip.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
}

hit
  .on('pointermove.hover', (e) => {
    const [mx, my] = d3.pointer(e, hit.node());
    hover = { mx, my };
    if (!zooming) updateHover();
  })
  .on('pointerleave.hover', () => {
    hover = null;
    hideHover();
  });

// Shift + drag: rubber-band zoom to a box.
hit.on('mousedown.box', (e) => {
  if (!e.shiftKey || e.button !== 0 || !L) return;
  e.preventDefault();
  const clamp = ([x, y]) => [Math.max(0, Math.min(L.pw, x)), Math.max(0, Math.min(L.ph, y))];
  const [x0, y0] = clamp(d3.pointer(e, hit.node()));
  let x1 = x0;
  let y1 = y0;
  hideHover();
  boxRect.attr('display', null).attr('x', x0).attr('y', y0).attr('width', 0).attr('height', 0);
  const move = (ev) => {
    [x1, y1] = clamp(d3.pointer(ev, hit.node()));
    boxRect
      .attr('x', Math.min(x0, x1))
      .attr('y', Math.min(y0, y1))
      .attr('width', Math.abs(x1 - x0))
      .attr('height', Math.abs(y1 - y0));
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    boxRect.attr('display', 'none');
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    if (w < 6 || h < 6) return;
    const k = Math.min(MAX_ZOOM, transform.k * Math.min(L.pw / w, L.ph / h));
    const cx = transform.invertX((x0 + x1) / 2);
    const cy = transform.invertY((y0 + y1) / 2);
    const target = d3.zoomIdentity.translate(L.pw / 2 - k * cx, L.ph / 2 - k * cy).scale(k);
    hit.transition().duration(650).call(zoom.transform, target);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

// ------------------------------------------------------------------------------------------------
// Header / controls
// ------------------------------------------------------------------------------------------------

function cellSizeText() {
  const ux = unitOf(data.labels.x);
  const unit = ux && ux === unitOf(data.labels.y) ? ` ${ux}` : '';
  if (grid.kind === 'rect') {
    const f = coordFormat(Math.min(grid.bw, grid.bh));
    return `${f(grid.bw)} × ${f(grid.bh)}${unit} cells`;
  }
  const across = grid.dx / (L.pw / (data.X1 - data.X0));
  return `hexagons ${coordFormat(across)(across)}${unit} across`;
}

function updateHeader() {
  if (!grid || !color) return;
  ui.stPoints.textContent = fmtInt(data.n);
  ui.stView.textContent = fmtInt(grid.inView);
  ui.stCells.textContent = `${fmtInt(color.filled)} / ${fmtInt(grid.N)}`;
  ui.stTime.textContent = `${timings.bin.toFixed(1)} · ${timings.render.toFixed(1)} ms`;
  const k = transform.k;
  ui.zoomLevel.textContent = `${k < 10 ? k.toFixed(2) : k.toFixed(1)}×`;
  ui.reset.disabled = k === 1 && transform.x === 0 && transform.y === 0;
  ui.title.textContent = data.name;
  ui.sub.textContent = `${valueTitle()} · ${cellSizeText()} · ${fmtInt(grid.N)} ${grid.kind === 'hex' ? 'hexagons' : 'cells'} in view`;
  ui.subtitle.innerHTML = `Binning <b>${fmtInt(data.n)}</b> scattered <code>[x, y, value]</code> points into ${grid.kind === 'hex' ? 'hexagonal' : 'square'} cells with d3.js`;
}

function updateSchemeSwatch() {
  const f = SCHEMES[state.scheme].f;
  const stops = d3.range(11).map((i) => {
    const t = i / 10;
    return `${d3.rgb(f(state.reverse ? 1 - t : t)).formatHex()} ${t * 100}%`;
  });
  ui.scheme.style.setProperty('--grad', `linear-gradient(90deg, ${stops.join(', ')})`);
}

function syncUI() {
  ui.dataset.value = state.dataset;
  ui.npoints.value = String(state.n);
  ui.seed.textContent = `#${state.seed}`;
  const isFile = state.dataset === 'file';
  ui.npoints.disabled = isFile;
  ui.regen.disabled = isFile;
  document.querySelectorAll('.seg').forEach((seg) => {
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(state[seg.dataset.key] === b.dataset.v)));
  });
  ui.cell.value = state.cell;
  ui.cellOut.textContent = `${state.cell} px`;
  ui.agg.value = state.agg;
  ui.minc.value = state.minCount;
  ui.mincOut.textContent = state.minCount;
  ui.sigma.value = state.sigma;
  ui.sigmaOut.textContent = state.grid === 'hex' ? 'n/a' : state.sigma ? `σ ${state.sigma}` : 'off';
  ui.sigma.disabled = state.grid === 'hex';
  ui.bilinear.disabled = state.grid === 'hex';
  ui.bilinear.closest('label').classList.toggle('disabled', state.grid === 'hex');
  ui.scheme.value = state.scheme;
  ui.reverse.checked = state.reverse;
  ui.clip.checked = state.clip;
  ui.clip.disabled = state.scale === 'quantile';
  ui.clip.closest('label').classList.toggle('disabled', state.scale === 'quantile');
  ui.contours.checked = state.contours;
  ui.levels.value = state.levels;
  ui.levelsOut.textContent = state.levels;
  ui.levels.disabled = !state.contours;
  ui.points.checked = state.points;
  ui.marginals.checked = state.marginals;
  ui.bilinear.checked = state.bilinear;
  ui.desc.textContent = data ? data.desc : DATASETS[state.dataset] ? DATASETS[state.dataset].desc : '';
  for (const r of [ui.cell, ui.minc, ui.sigma, ui.levels]) {
    r.style.setProperty('--fill', `${((+r.value - +r.min) / (+r.max - +r.min)) * 100}%`);
  }
  updateSchemeSwatch();
}

function setState(key, value) {
  if (state[key] === value) return;
  state[key] = value;
  let flags = EFFECT[key] || DRAW;
  if (key === 'agg' && value === 'median' && grid && !grid.median) flags = BIN;
  syncUI();
  invalidate(flags);
}

function showLoading(text, p) {
  ui.loading.hidden = false;
  ui.loadingText.textContent = text;
  ui.loadingBar.style.width = p == null ? '100%' : `${Math.round(p * 100)}%`;
  ui.loading.classList.toggle('indeterminate', p == null);
}

function hideLoading() {
  ui.loading.hidden = true;
}

let toastTimer = 0;
function toast(message, isError = false) {
  ui.toast.textContent = message;
  ui.toast.className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast.className = 'toast';
  }, 4200);
}

function setData(ds) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < ds.n; i++) {
    const v = ds.v[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  ds.vfmt = valueFormatter(lo, hi);
  data = ds;
  order = null;
  yTickW = 0;
  prevPlot = null;
  hover = null;
  silent = true;
  hit.interrupt().call(zoom.transform, d3.zoomIdentity);
  silent = false;
  transform = d3.zoomIdentity;
  state.filter = null;
  if (L) setBrushSilently(null);
  syncUI();
  invalidate(LAYOUT);
}

function loadDataset(key) {
  state.dataset = key;
  Object.assign(state, DATASETS[key].view);
  syncUI();
  return loadGenerated();
}

let loadToken = 0;
async function loadGenerated() {
  const token = ++loadToken;
  const n = state.n;
  showLoading(`Generating ${fmtInt(n)} points…`, 0);
  const ds = await generateDataset(
    state.dataset,
    n,
    state.seed,
    (p) => {
      if (token === loadToken) showLoading(`Generating ${fmtInt(n)} points…`, p);
    },
    () => token !== loadToken,
  );
  if (!ds || token !== loadToken) return;
  setData(ds);
  hideLoading();
}

async function importFile(file) {
  if (!file) return;
  const token = ++loadToken;
  showLoading(`Reading ${file.name}…`, null);
  try {
    const text = await file.text();
    await new Promise((r) => setTimeout(r, 30));
    const parsed = parseText(text);
    if (token !== loadToken) return;
    const ds = toDataset(parsed, file.name);
    const opt = ui.dataset.querySelector('option[value="file"]');
    opt.textContent = `Imported · ${file.name}`;
    opt.hidden = false;
    state.dataset = 'file';
    Object.assign(state, FILE_VIEW);
    setData(ds);
    const skipped = parsed.skipped ? ` · ${fmtInt(parsed.skipped)} unreadable row${parsed.skipped === 1 ? '' : 's'} skipped` : '';
    toast(`Loaded ${fmtInt(ds.n)} points from ${file.name}${skipped}`);
  } catch (err) {
    toast(`Could not import ${file.name}: ${err.message}`, true);
  } finally {
    if (token === loadToken) hideLoading();
  }
}

function gridCSVText() {
  const g = grid;
  const header = g.kind === 'rect' ? ['x0', 'x1', 'y0', 'y1'] : ['x_center', 'y_center'];
  header.push('count', 'mean', 'median', 'std', 'min', 'max', 'sum', `display_${state.agg}`);
  const rows = [];
  for (let c = 0; c < g.N; c++) {
    const n = g.count[c];
    if (!n && !Number.isFinite(vals[c])) continue;
    let pos;
    if (g.kind === 'rect') pos = cellBounds(c);
    else {
      const [sx, sy] = hexCenter(c);
      pos = [xz.invert(sx), yz.invert(sy)];
    }
    const mean = n ? g.sum[c] / n : NaN;
    const sd = n > 1 ? Math.sqrt(Math.max(0, (g.sumSq[c] - g.sum[c] * mean) / (n - 1))) : NaN;
    rows.push([...pos, n, mean, g.median ? g.median[c] : NaN, sd, n ? g.min[c] : NaN, n ? g.max[c] : NaN, g.sum[c], vals[c]]);
  }
  return { text: toCSV(header, rows), count: rows.length };
}

function zoomBy(factor) {
  if (!L) return;
  hit.transition().duration(350).call(zoom.scaleBy, factor, [L.pw / 2, L.ph / 2]);
}

function panBy(dx, dy) {
  if (!L) return;
  hit.transition().duration(250).call(zoom.translateBy, dx / transform.k, dy / transform.k);
}

function resetView() {
  hit.transition().duration(650).call(zoom.transform, d3.zoomIdentity);
}

function bindUI() {
  ui.dataset.innerHTML =
    Object.entries(DATASETS)
      .map(([k, d]) => `<option value="${k}">${d.name}</option>`)
      .join('') + '<option value="file" hidden>Imported file</option>';
  ui.agg.innerHTML = Object.entries(AGGS)
    .map(([k, name]) => `<option value="${k}">${name}</option>`)
    .join('');
  ui.scheme.innerHTML = Object.entries(SCHEMES)
    .map(([k, s]) => `<option value="${k}">${s.name}</option>`)
    .join('');

  ui.dataset.addEventListener('change', () => {
    if (ui.dataset.value !== 'file') loadDataset(ui.dataset.value);
  });
  ui.npoints.addEventListener('change', () => {
    state.n = +ui.npoints.value;
    loadGenerated();
  });
  ui.regen.addEventListener('click', () => {
    state.seed += 1;
    syncUI();
    loadGenerated();
  });
  ui.importBtn.addEventListener('click', () => ui.file.click());
  ui.file.addEventListener('change', () => {
    importFile(ui.file.files[0]);
    ui.file.value = '';
  });
  ui.sampleBtn.addEventListener('click', () => {
    if (!data) return;
    const n = Math.min(50000, data.n);
    download(new Blob([sampleCSV(data, n)], { type: 'text/csv' }), `scatter-sample-${data.key}.csv`);
    toast(`Saved ${fmtInt(n)} sample rows as x,y,value CSV. Drop it back on the chart to re-import.`);
  });

  document.querySelectorAll('.seg').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) setState(seg.dataset.key, b.dataset.v);
    });
  });
  ui.cell.addEventListener('input', () => setState('cell', +ui.cell.value));
  ui.minc.addEventListener('input', () => setState('minCount', +ui.minc.value));
  ui.sigma.addEventListener('input', () => setState('sigma', +ui.sigma.value));
  ui.levels.addEventListener('input', () => setState('levels', +ui.levels.value));
  ui.agg.addEventListener('change', () => setState('agg', ui.agg.value));
  ui.scheme.addEventListener('change', () => setState('scheme', ui.scheme.value));
  for (const key of ['reverse', 'clip', 'contours', 'points', 'marginals', 'bilinear']) {
    ui[key].addEventListener('change', () => setState(key, ui[key].checked));
  }

  ui.reset.addEventListener('click', resetView);
  ui.filterClear.addEventListener('click', () => gBrush.call(brush.move, null));
  ui.png.addEventListener('click', async () => {
    if (!data || !L) return;
    hideHover();
    try {
      const blob = await exportPNG(ui.canvas, ui.svg, L.W, L.H, BG);
      download(blob, `heatmap-${data.key}.png`);
      toast('Saved the current view as PNG');
    } catch (err) {
      toast(`PNG export failed: ${err.message}`, true);
    }
  });
  ui.csv.addEventListener('click', () => {
    if (!grid) return;
    const { text, count } = gridCSVText();
    download(new Blob([text], { type: 'text/csv' }), `heatmap-grid-${data.key}.csv`);
    toast(`Saved ${fmtInt(count)} non-empty cells as CSV`);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const step = 80;
    switch (e.key) {
      case '+':
      case '=':
        zoomBy(1.6);
        break;
      case '-':
      case '_':
        zoomBy(1 / 1.6);
        break;
      case '0':
        resetView();
        break;
      case 'ArrowLeft':
        panBy(step, 0);
        break;
      case 'ArrowRight':
        panBy(-step, 0);
        break;
      case 'ArrowUp':
        panBy(0, step);
        break;
      case 'ArrowDown':
        panBy(0, -step);
        break;
      case 'h':
      case 'H':
        setState('grid', state.grid === 'hex' ? 'rect' : 'hex');
        break;
      case 'c':
      case 'C':
        setState('contours', !state.contours);
        break;
      case 'p':
      case 'P':
        setState('points', !state.points);
        break;
      case 'Escape':
        if (state.filter) gBrush.call(brush.move, null);
        break;
      default:
        return;
    }
    e.preventDefault();
  });

  // Drag & drop import anywhere on the page.
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    dragDepth++;
    ui.drop.hidden = false;
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) ui.drop.hidden = true;
  });
  window.addEventListener('dragover', (e) => {
    if (hasFiles(e)) e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    ui.drop.hidden = true;
    importFile(e.dataTransfer.files[0]);
  });

  new ResizeObserver(() => invalidate(LAYOUT)).observe(ui.chart);
}

bindUI();
syncUI();
loadGenerated();

// Small hook for automated checks and for poking at the state from the console.
window.heatmap = {
  state,
  get grid() {
    return grid;
  },
  get data() {
    return data;
  },
  get transform() {
    return transform;
  },
  timings,
  setState,
  loadDataset,
  importText(text, name = 'pasted.csv') {
    return importFile(new File([text], name, { type: 'text/plain' }));
  },
};

// Aggregation of scattered [x, y, value] points into square or hexagonal cells.
// A single pass over the points accumulates count, sum, sum of squares, min and max per cell,
// so switching between mean / sum / count / min / max / std never touches the raw data again.
// Medians need the values themselves and are computed on demand with a counting-sort + select.

const SQRT3 = Math.sqrt(3);

// Zooming re-bins on every animation frame; pooled buffers keep that from churning the GC.
const pool = new Map();
function buffer(name, Type, n) {
  let b = pool.get(name);
  if (!b || b.length < n) {
    b = new Type(Math.max(n, 1024));
    pool.set(name, b);
  }
  return b.subarray(0, n);
}

function accumulators(ns, N) {
  return {
    count: buffer(ns + ':count', Uint32Array, N).fill(0),
    sum: buffer(ns + ':sum', Float64Array, N).fill(0),
    sumSq: buffer(ns + ':sumSq', Float64Array, N).fill(0),
    min: buffer(ns + ':min', Float64Array, N).fill(Infinity),
    max: buffer(ns + ':max', Float64Array, N).fill(-Infinity),
  };
}

function profileAcc(n) {
  return {
    count: new Float64Array(n),
    sum: new Float64Array(n),
    sumSq: new Float64Array(n),
    min: new Float64Array(n).fill(Infinity),
    max: new Float64Array(n).fill(-Infinity),
  };
}

function visibleWindow(view) {
  const [ax, bx] = view.xz.domain();
  const [ay, by] = view.yz.domain();
  return [Math.min(ax, bx), Math.max(ax, bx), Math.min(ay, by), Math.max(ay, by)];
}

// Square lattice anchored at the data origin: panning shifts cells without re-assigning points,
// zooming shrinks the cells so the on-screen cell size stays at `cellPx`.
export function squareLattice(view, cellPx) {
  const { X0, X1, Y0, Y1, pw, ph, k } = view;
  const nx0 = Math.max(1, Math.round(pw / cellPx));
  const ny0 = Math.max(1, Math.round(ph / cellPx));
  const bw = (X1 - X0) / nx0 / k;
  const bh = (Y1 - Y0) / ny0 / k;
  const [vx0, vx1, vy0, vy1] = visibleWindow(view);
  const e = 1e-7;
  const i0 = Math.floor((vx0 - X0) / bw + e);
  const i1 = Math.max(i0 + 1, Math.ceil((vx1 - X0) / bw - e));
  const j0 = Math.floor((vy0 - Y0) / bh + e);
  const j1 = Math.max(j0 + 1, Math.ceil((vy1 - Y0) / bh - e));
  return { kind: 'rect', nx: i1 - i0, ny: j1 - j0, bw, bh, gx0: X0 + i0 * bw, gy0: Y0 + j0 * bh };
}

// Row 0 of the grid is the top row, so the cell array doubles as an image (and a d3.contours grid).
export function binSquare(ds, lat, view, wantMedian, ns = 'sq') {
  const { nx, ny, bw, bh, gx0, gy0 } = lat;
  const N = nx * ny;
  const acc = accumulators(ns, N);
  const { count, sum, sumSq, min, max } = acc;
  const X = ds.x;
  const Y = ds.y;
  const V = ds.v;
  const n = ds.n;
  const ix = 1 / bw;
  const iy = 1 / bh;
  const [vx0, vx1, vy0, vy1] = visibleWindow(view);
  // Points sitting exactly on the far edge of the data extent can land a rounding error outside it.
  const ex = nx + 1e-9 * nx;
  const ey = ny + 1e-9 * ny;
  const cellOf = wantMedian ? buffer(ns + ':cellOf', Int32Array, n) : null;
  let inView = 0;
  for (let p = 0; p < n; p++) {
    const x = X[p];
    const y = Y[p];
    const fx = (x - gx0) * ix;
    const fy = (y - gy0) * iy;
    if (!(fx >= -1e-9 && fx <= ex && fy >= -1e-9 && fy <= ey)) {
      if (cellOf) cellOf[p] = -1;
      continue;
    }
    const col = fx < nx ? (fx > 0 ? fx | 0 : 0) : nx - 1;
    const up = fy < ny ? (fy > 0 ? fy | 0 : 0) : ny - 1;
    const c = (ny - 1 - up) * nx + col;
    const v = V[p];
    count[c]++;
    sum[c] += v;
    sumSq[c] += v * v;
    if (v < min[c]) min[c] = v;
    if (v > max[c]) max[c] = v;
    if (cellOf) cellOf[p] = c;
    if (x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1) inView++;
  }
  const grid = { ...lat, N, ...acc, inView, median: null };
  if (cellOf) grid.median = medians(cellOf, V, count, N, ns);
  return grid;
}

export function hexLattice(view, cellPx) {
  const { pw, ph, k } = view;
  const tx = view.tx;
  const ty = view.ty;
  const r = (0.6204 * cellPx) / k;
  const dx = r * SQRT3;
  const dy = r * 1.5;
  const bx0 = -tx / k;
  const bx1 = (pw - tx) / k;
  const by0 = -ty / k;
  const by1 = (ph - ty) / k;
  const pi0 = Math.floor(bx0 / dx) - 1;
  const pi1 = Math.ceil(bx1 / dx) + 1;
  const pj0 = Math.floor(by0 / dy) - 1;
  const pj1 = Math.ceil(by1 / dy) + 1;
  return { kind: 'hex', r, dx, dy, pi0, pj0, cols: pi1 - pi0 + 1, rows: pj1 - pj0 + 1, bx0, bx1, by0, by1 };
}

// Nearest hexagon centre (pointy-top layout, same lattice as d3-hexbin) in unzoomed plot pixels.
export function hexIndex(px, py, dx, dy) {
  const pyr = py / dy;
  let pj = Math.round(pyr);
  const pxr = px / dx - (pj & 1) / 2;
  let pi = Math.round(pxr);
  const py1 = pyr - pj;
  if (Math.abs(py1) * 3 > 1) {
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
  return [pi, pj];
}

export function binHex(ds, lat, view, wantMedian, profileBins, ns = 'hex') {
  const { dx, dy, pi0, pj0, cols, rows, bx0, bx1, by0, by1 } = lat;
  const N = cols * rows;
  const acc = accumulators(ns, N);
  const { count, sum, sumSq, min, max } = acc;
  const X = ds.x;
  const Y = ds.y;
  const V = ds.v;
  const n = ds.n;
  const sx = view.pw / (view.X1 - view.X0);
  const sy = view.ph / (view.Y1 - view.Y0);
  const X0 = view.X0;
  const Y1 = view.Y1;
  const lx0 = bx0 - dx;
  const lx1 = bx1 + dx;
  const ly0 = by0 - dy;
  const ly1 = by1 + dy;
  const [nbx, nby] = profileBins;
  const PX = profileAcc(nbx);
  const PY = profileAcc(nby);
  const fx = nbx / (bx1 - bx0);
  const fy = nby / (by1 - by0);
  const cellOf = wantMedian ? buffer(ns + ':cellOf', Int32Array, n) : null;
  let inView = 0;
  for (let p = 0; p < n; p++) {
    const px = (X[p] - X0) * sx;
    const py = (Y1 - Y[p]) * sy;
    if (!(px >= lx0 && px <= lx1 && py >= ly0 && py <= ly1)) {
      if (cellOf) cellOf[p] = -1;
      continue;
    }
    const v = V[p];
    if (px >= bx0 && px < bx1 && py >= by0 && py < by1) {
      inView++;
      const b = ((px - bx0) * fx) | 0;
      const r = ((py - by0) * fy) | 0;
      PX.count[b]++;
      PX.sum[b] += v;
      PX.sumSq[b] += v * v;
      if (v < PX.min[b]) PX.min[b] = v;
      if (v > PX.max[b]) PX.max[b] = v;
      PY.count[r]++;
      PY.sum[r] += v;
      PY.sumSq[r] += v * v;
      if (v < PY.min[r]) PY.min[r] = v;
      if (v > PY.max[r]) PY.max[r] = v;
    }
    const pyr = py / dy;
    let pj = Math.round(pyr);
    const pxr = px / dx - (pj & 1) / 2;
    let pi = Math.round(pxr);
    const py1 = pyr - pj;
    if (Math.abs(py1) * 3 > 1) {
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
    if (ci < 0 || ci >= cols || cj < 0 || cj >= rows) {
      if (cellOf) cellOf[p] = -1;
      continue;
    }
    const c = cj * cols + ci;
    count[c]++;
    sum[c] += v;
    sumSq[c] += v * v;
    if (v < min[c]) min[c] = v;
    if (v > max[c]) max[c] = v;
    if (cellOf) cellOf[p] = c;
  }
  const cx = new Float64Array(nbx);
  const cy = new Float64Array(nby);
  for (let b = 0; b < nbx; b++) cx[b] = X0 + (bx0 + (b + 0.5) / fx) / sx;
  for (let r = 0; r < nby; r++) cy[r] = Y1 - (by0 + (r + 0.5) / fy) / sy;
  const grid = { ...lat, N, ...acc, inView, median: null, profAcc: { PX, PY, cx, cy } };
  if (cellOf) grid.median = medians(cellOf, V, count, N, ns);
  return grid;
}

// Exact per-cell medians: bucket values by cell (counting sort), then quickselect inside each bucket.
function medians(cellOf, V, count, N, ns) {
  const start = buffer(ns + ':start', Uint32Array, N + 1);
  start[0] = 0;
  for (let c = 0; c < N; c++) start[c + 1] = start[c] + count[c];
  const cursor = buffer(ns + ':cursor', Uint32Array, N);
  cursor.set(start.subarray(0, N));
  const vals = buffer(ns + ':vals', Float64Array, start[N]);
  for (let p = 0, n = cellOf.length; p < n; p++) {
    const c = cellOf[p];
    if (c >= 0) vals[cursor[c]++] = V[p];
  }
  const med = new Float64Array(N).fill(NaN);
  for (let c = 0; c < N; c++) {
    const a = start[c];
    const m = start[c + 1] - a;
    if (m === 0) continue;
    if (m === 1) {
      med[c] = vals[a];
      continue;
    }
    const h = m >> 1;
    const upper = select(vals, a, a + m - 1, a + h);
    if (m & 1) med[c] = upper;
    else {
      let lower = -Infinity;
      for (let i = a; i < a + h; i++) if (vals[i] > lower) lower = vals[i];
      med[c] = 0.5 * (lower + upper);
    }
  }
  return med;
}

// Hoare-partition quickselect; afterwards a[lo..k-1] <= a[k] <= a[k+1..hi].
function select(a, lo, hi, k) {
  while (hi > lo) {
    const m = (lo + hi) >> 1;
    let x = a[lo];
    let y = a[m];
    let z = a[hi];
    const pivot = x < y ? (y < z ? y : x < z ? z : x) : x < z ? x : y < z ? z : y;
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) {
        x = a[i];
        a[i] = a[j];
        a[j] = x;
        i++;
        j--;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else break;
  }
  return a[k];
}

export function cellValues(g, agg, minCount) {
  const { N, count, sum, sumSq, min, max, median } = g;
  const out = new Float64Array(N);
  const need = Math.max(1, minCount);
  for (let c = 0; c < N; c++) {
    const n = count[c];
    if (n < need) {
      out[c] = NaN;
      continue;
    }
    switch (agg) {
      case 'median':
        out[c] = median ? median[c] : sum[c] / n;
        break;
      case 'sum':
        out[c] = sum[c];
        break;
      case 'count':
        out[c] = n;
        break;
      case 'min':
        out[c] = min[c];
        break;
      case 'max':
        out[c] = max[c];
        break;
      case 'std':
        out[c] = n > 1 ? Math.sqrt(Math.max(0, (sumSq[c] - (sum[c] * sum[c]) / n) / (n - 1))) : NaN;
        break;
      default:
        out[c] = sum[c] / n;
    }
  }
  return out;
}

function kernel1d(sigma) {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float64Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) {
    k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
    s += k[i + r];
  }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return k;
}

// Separable Gaussian convolution with zero padding outside the grid.
function blur(src, nx, ny, k) {
  const r = (k.length - 1) >> 1;
  const tmp = new Float64Array(nx * ny);
  const out = new Float64Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    const o = y * nx;
    for (let x = 0; x < nx; x++) {
      const a = Math.max(0, x - r);
      const b = Math.min(nx - 1, x + r);
      let s = 0;
      for (let i = a; i <= b; i++) s += src[o + i] * k[i - x + r];
      tmp[o + x] = s;
    }
  }
  const col = new Float64Array(ny);
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) col[y] = tmp[y * nx + x];
    for (let y = 0; y < ny; y++) {
      const a = Math.max(0, y - r);
      const b = Math.min(ny - 1, y + r);
      let s = 0;
      for (let j = a; j <= b; j++) s += col[j] * k[j - y + r];
      out[y * nx + x] = s;
    }
  }
  return out;
}

// Kernel mass that falls inside the grid, used to undo the darkening of zero padding at the edges.
function edgeNorm(nx, ny, k) {
  const r = (k.length - 1) >> 1;
  const side = (n) => {
    const w = new Float64Array(n);
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let i = Math.max(0, x - r); i <= Math.min(n - 1, x + r); i++) s += k[i - x + r];
      w[x] = s;
    }
    return w;
  };
  const wx = side(nx);
  const wy = side(ny);
  const out = new Float64Array(nx * ny);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) out[y * nx + x] = wx[x] * wy[y];
  return out;
}

// Gaussian smoothing on the square grid (sigma in cells).
//  - count / sum are densities: empty cells are true zeros and the kernel spreads mass.
//  - mean is a Nadaraya–Watson kernel regression over the points themselves (sum / count).
//  - min / max / median / std use normalised convolution over the non-empty cells.
// Non-additive fields only fill a cell when `minSupport` of the kernel weight lands on data
// (half by default), so small holes close up while genuine gaps (a wall with no samples) stay empty.
export function smoothValues(g, raw, agg, sigma, minSupport = 0.5) {
  const { nx, ny, N } = g;
  const k = kernel1d(sigma);
  const norm = edgeNorm(nx, ny, k);
  const out = new Float64Array(N);
  const src = new Float64Array(N);
  const mask = new Float64Array(N);
  if (agg === 'count' || agg === 'sum') {
    let ref = 0;
    let nv = 0;
    for (let c = 0; c < N; c++) {
      const v = raw[c];
      if (v === v) {
        src[c] = v;
        ref += Math.abs(v);
        nv++;
      }
    }
    ref = nv ? (ref / nv) * 1e-3 : 0;
    const s = blur(src, nx, ny, k);
    for (let c = 0; c < N; c++) {
      const v = s[c] / norm[c];
      out[c] = Math.abs(v) > ref ? v : NaN;
    }
    return out;
  }
  if (agg === 'mean') {
    const w = new Float64Array(N);
    for (let c = 0; c < N; c++) {
      if (raw[c] === raw[c]) {
        src[c] = g.sum[c];
        w[c] = g.count[c];
        mask[c] = 1;
      }
    }
    const s = blur(src, nx, ny, k);
    const ws = blur(w, nx, ny, k);
    const ms = blur(mask, nx, ny, k);
    for (let c = 0; c < N; c++) out[c] = ms[c] >= minSupport * norm[c] && ws[c] > 0 ? s[c] / ws[c] : NaN;
    return out;
  }
  for (let c = 0; c < N; c++) {
    if (raw[c] === raw[c]) {
      src[c] = raw[c];
      mask[c] = 1;
    }
  }
  const s = blur(src, nx, ny, k);
  const ms = blur(mask, nx, ny, k);
  for (let c = 0; c < N; c++) out[c] = ms[c] >= minSupport * norm[c] && ms[c] > 0 ? s[c] / ms[c] : NaN;
  return out;
}

// Grows a field into empty cells by 4-neighbour averaging, `passes` cells deep. d3.contours treats
// empty (NaN) cells as lower than every threshold, so without this each isoline would also run
// along the edge of the data; the grown rim is later masked away when the lines are drawn.
export function dilate(field, nx, ny, passes) {
  let src = field;
  for (let p = 0; p < passes; p++) {
    const out = Float64Array.from(src);
    let changed = false;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const c = y * nx + x;
        if (src[c] === src[c]) continue;
        let s = 0;
        let n = 0;
        let v;
        if (x > 0 && (v = src[c - 1]) === v) (s += v), n++;
        if (x < nx - 1 && (v = src[c + 1]) === v) (s += v), n++;
        if (y > 0 && (v = src[c - nx]) === v) (s += v), n++;
        if (y < ny - 1 && (v = src[c + nx]) === v) (s += v), n++;
        if (n) {
          out[c] = s / n;
          changed = true;
        }
      }
    }
    src = out;
    if (!changed) break;
  }
  return src;
}

function series(A, centers, agg) {
  const n = centers.length;
  const v = new Float64Array(n);
  const lo = new Float64Array(n);
  const hi = new Float64Array(n);
  const additive = agg === 'count' || agg === 'sum';
  const band = agg === 'mean' || agg === 'median';
  for (let i = 0; i < n; i++) {
    const m = A.count[i];
    if (!m) {
      v[i] = lo[i] = hi[i] = additive ? 0 : NaN;
      continue;
    }
    const mean = A.sum[i] / m;
    const sd = m > 1 ? Math.sqrt(Math.max(0, (A.sumSq[i] - A.sum[i] * mean) / (m - 1))) : 0;
    let val;
    switch (agg) {
      case 'count':
        val = m;
        break;
      case 'sum':
        val = A.sum[i];
        break;
      case 'min':
        val = A.min[i];
        break;
      case 'max':
        val = A.max[i];
        break;
      case 'std':
        val = sd;
        break;
      default:
        val = mean;
    }
    v[i] = val;
    lo[i] = band ? mean - sd : val;
    hi[i] = band ? mean + sd : val;
  }
  return { c: centers, v, lo, hi, additive, band };
}

// Column / row profiles for the marginal charts, aggregated over the points (not over cell values).
export function profiles(g, agg) {
  if (g.kind === 'hex') {
    const { PX, PY, cx, cy } = g.profAcc;
    return { x: series(PX, cx, agg), y: series(PY, cy, agg) };
  }
  const { nx, ny, count, sum, sumSq, min, max } = g;
  const PX = profileAcc(nx);
  const PY = profileAcc(ny);
  for (let r = 0; r < ny; r++) {
    for (let col = 0; col < nx; col++) {
      const c = r * nx + col;
      const n = count[c];
      if (!n) continue;
      PX.count[col] += n;
      PX.sum[col] += sum[c];
      PX.sumSq[col] += sumSq[c];
      if (min[c] < PX.min[col]) PX.min[col] = min[c];
      if (max[c] > PX.max[col]) PX.max[col] = max[c];
      PY.count[r] += n;
      PY.sum[r] += sum[c];
      PY.sumSq[r] += sumSq[c];
      if (min[c] < PY.min[r]) PY.min[r] = min[c];
      if (max[c] > PY.max[r]) PY.max[r] = max[c];
    }
  }
  const cx = new Float64Array(nx);
  const cy = new Float64Array(ny);
  for (let i = 0; i < nx; i++) cx[i] = g.gx0 + (i + 0.5) * g.bw;
  for (let r = 0; r < ny; r++) cy[r] = g.gy0 + (ny - 0.5 - r) * g.bh;
  return { x: series(PX, cx, agg), y: series(PY, cy, agg) };
}

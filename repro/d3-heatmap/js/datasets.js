// Reproducible synthetic scatter datasets.
// Every generator fills flat Float64Array columns (x, y, value): a million points cost 24 MB
// and can be binned in a single tight loop without allocating per-point objects.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGauss(rand) {
  let spare = NaN;
  return function gauss() {
    if (spare === spare) {
      const s = spare;
      spare = NaN;
      return s;
    }
    let u, v, s;
    do {
      u = rand() * 2 - 1;
      v = rand() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const m = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * m;
    return u * m;
  };
}

// Seeded 2-D gradient noise (Perlin's improved noise, 8 gradient directions), roughly in [-1, 1].
function makeNoise(rand) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const GX = [1, -1, 1, -1, 1, -1, 0, 0];
  const GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const aa = perm[perm[X] + Y] & 7;
    const ab = perm[perm[X] + Y + 1] & 7;
    const ba = perm[perm[X + 1] + Y] & 7;
    const bb = perm[perm[X + 1] + Y + 1] & 7;
    const g00 = GX[aa] * xf + GY[aa] * yf;
    const g10 = GX[ba] * (xf - 1) + GY[ba] * yf;
    const g01 = GX[ab] * xf + GY[ab] * (yf - 1);
    const g11 = GX[bb] * (xf - 1) + GY[bb] * (yf - 1);
    const u = fade(xf);
    const v = fade(yf);
    const x1 = g00 + u * (g10 - g00);
    const x2 = g01 + u * (g11 - g01);
    return x1 + v * (x2 - x1);
  };
}

function fbm(noise, x, y, octaves) {
  let s = 0;
  let a = 1;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    s += a * noise(x * f, y * f);
    norm += a;
    a *= 0.5;
    f *= 2.02;
  }
  return s / norm;
}

// Ridged multifractal: sharp crests where the underlying noise crosses zero, in [0, 1].
function ridged(noise, x, y, octaves) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let prev = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(noise(x * f, y * f));
    n *= n;
    s += n * a * prev;
    norm += a;
    prev = n;
    a *= 0.5;
    f *= 2.03;
  }
  return s / norm;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// --- 1. Airborne elevation survey --------------------------------------------------------------
function terrain(rand, gauss) {
  const W = 120;
  const H = 80;
  const nWarp = makeNoise(rand);
  const nHill = makeNoise(rand);
  const nRidge = makeNoise(rand);
  const nFine = makeNoise(rand);

  // The large-scale relief is evaluated once on a 1/3 km raster; points sample it bilinearly
  // and add their own fine-scale noise, which keeps a million samples cheap to generate.
  const RW = 361;
  const RH = 241;
  const raster = new Float32Array(RW * RH);
  for (let j = 0; j < RH; j++) {
    const y = (j / (RH - 1)) * H;
    for (let i = 0; i < RW; i++) {
      const x = (i / (RW - 1)) * W;
      const warp = fbm(nWarp, x * 0.018 + 7.3, y * 0.018 - 3.1, 3);
      const hills = fbm(nHill, x * 0.04, y * 0.04, 5);
      const mask = smoothstep(20, 66, y + 26 * warp + 0.22 * x);
      const r = ridged(nRidge, x * 0.03 + 5.1, y * 0.03 + warp * 1.4, 6);
      let e = 560 + 430 * hills + mask * (220 + 2600 * r * r);
      const river = 15 + 6 * Math.sin(x / 14 + 0.8) + 2.5 * Math.sin(x / 4.7);
      const d = (y - river) / (2 + 2.5 * (1 - mask));
      e -= 240 * Math.exp(-d * d);
      raster[j * RW + i] = e;
    }
  }

  const lines = Array.from({ length: 15 }, () => ({
    y0: 4 + rand() * 72,
    slope: (rand() - 0.5) * 0.35,
    w: 0.1 + rand() * 0.12,
  }));
  const sites = Array.from({ length: 11 }, () => ({
    x: 8 + rand() * 104,
    y: 6 + rand() * 68,
    s: 0.8 + rand() * 3.2,
  }));

  return (i, X, Y, V) => {
    let x;
    let y;
    const u = rand();
    for (;;) {
      if (u < 0.5) {
        x = rand() * W;
        y = rand() * H;
      } else if (u < 0.77) {
        const L = lines[(rand() * lines.length) | 0];
        x = rand() * W;
        y = L.y0 + (x - 60) * L.slope + gauss() * L.w;
      } else {
        const S = sites[(rand() * sites.length) | 0];
        x = S.x + gauss() * S.s;
        y = S.y + gauss() * S.s;
      }
      if (x >= 0 && x < W && y >= 0 && y < H) break;
    }
    const fx = (x / W) * (RW - 1);
    const fy = (y / H) * (RH - 1);
    const i0 = Math.min(RW - 2, fx | 0);
    const j0 = Math.min(RH - 2, fy | 0);
    const tx = fx - i0;
    const ty = fy - j0;
    const q = j0 * RW + i0;
    const e =
      (raster[q] * (1 - tx) + raster[q + 1] * tx) * (1 - ty) +
      (raster[q + RW] * (1 - tx) + raster[q + RW + 1] * tx) * ty;
    X[i] = x;
    Y[i] = y;
    V[i] = e + 22 * nFine(x * 1.7, y * 1.7) + gauss() * 6;
  };
}

// --- 2. Ripple tank: a point source behind a wall with two slits ------------------------------
function ripple(rand, gauss) {
  const k = (2 * Math.PI) / 1.7;
  const src = { x: -11, y: 0 };
  const wall = -4;
  const half = 0.3;
  const slits = [2, -2];
  const open = 0.4;
  const dS = slits.map((s) => Math.hypot(wall - src.x, s - src.y));
  const aS = dS.map((d) => 1.3 / Math.sqrt(1 + 0.45 * d));
  return (i, X, Y, V) => {
    let x;
    let y;
    for (;;) {
      x = -12 + rand() * 24;
      y = -8 + rand() * 16;
      if (Math.abs(x - wall) >= half) break;
      if (Math.abs(y - slits[0]) < open || Math.abs(y - slits[1]) < open) break;
    }
    let v = 0;
    if (x < wall) {
      const r = Math.hypot(x - src.x, y - src.y);
      v = (1.3 * Math.cos(k * r)) / Math.sqrt(1 + 0.45 * r);
    } else {
      for (let s = 0; s < 2; s++) {
        const r = Math.hypot(x - wall, y - slits[s]);
        v += (1.9 * aS[s] * Math.cos(k * (dS[s] + r))) / Math.sqrt(1 + 0.9 * r);
      }
    }
    X[i] = x;
    Y[i] = y;
    V[i] = 2 * v + gauss() * 0.25;
  };
}

// --- 3. Inclined spiral galaxy: star positions + line-of-sight velocity ------------------------
function galaxy(rand, gauss) {
  const inc = (54 * Math.PI) / 180;
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  const pa = (-24 * Math.PI) / 180;
  const cp = Math.cos(pa);
  const sp = Math.sin(pa);
  const wind = 1 / Math.tan((15 * Math.PI) / 180);
  // Radial density proportional to r * exp(-r / h): an exponential disc seen face-on.
  const gamma2 = (h) => -h * Math.log(rand() * rand() + 1e-12);
  return (i, X, Y, V) => {
    let x;
    let y;
    let v;
    for (;;) {
      let r;
      let th;
      const u = rand();
      if (u < 0.15) {
        const bx = gauss() * 0.85;
        const by = gauss() * 0.85;
        r = Math.hypot(bx, by);
        th = Math.atan2(by, bx);
      } else if (u < 0.47) {
        r = gamma2(2.5);
        th = rand() * 2 * Math.PI;
      } else {
        r = 0.9 + gamma2(2.3);
        const arm = rand() < 0.5 ? 0 : Math.PI;
        th = arm + wind * Math.log(r / 0.9) + (gauss() * (0.25 + 0.05 * r)) / r;
      }
      if (r > 17) continue;
      const gx = r * Math.cos(th);
      const gy = r * Math.sin(th) * ci;
      x = gx * cp - gy * sp;
      y = gx * sp + gy * cp;
      if (x < -20 || x >= 20 || y < -13 || y >= 13) continue;
      const vrot = 232 * (1 - Math.exp(-r / 1.1));
      v = vrot * Math.cos(th) * si + gauss() * (u < 0.15 ? 55 : 16);
      break;
    }
    X[i] = x;
    Y[i] = y;
    V[i] = v;
  };
}

// --- 4. City ride pickups snapped to a rotated street grid ------------------------------------
function city(rand, gauss) {
  const W = 30;
  const H = 20;
  const ang = (29 * Math.PI) / 180;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const hubs = [
    { x: 12.4, y: 9.4, s: 2.0, w: 0.34 },
    { x: 17.6, y: 12.6, s: 1.3, w: 0.17 },
    { x: 7.2, y: 13.9, s: 0.8, w: 0.07 },
    { x: 25.8, y: 4.0, s: 0.45, w: 0.07 },
    { x: 21.2, y: 7.2, s: 2.4, w: 0.12 },
    { x: 15, y: 10, s: 6.5, w: 0.23 },
  ];
  const cum = [];
  hubs.reduce((acc, h) => {
    cum.push(acc + h.w);
    return acc + h.w;
  }, 0);
  const total = cum[cum.length - 1];
  const river = (x) => 5.2 + 0.3 * x + 1.3 * Math.sin(x / 2.6);
  const parkU = 15.2 * ca + 12.2 * sa;
  const parkW = -15.2 * sa + 12.2 * ca;
  return (i, X, Y, V) => {
    let x;
    let y;
    for (;;) {
      const u = rand() * total;
      let h = 0;
      while (cum[h] < u) h++;
      const hub = hubs[h];
      x = hub.x + gauss() * hub.s;
      y = hub.y + gauss() * hub.s;
      let gu = x * ca + y * sa;
      let gw = -x * sa + y * ca;
      const r = rand();
      const onStreet = r < 0.86;
      // Avenues every 1.2 km / streets every 0.9 km read at full view; side streets appear on zoom.
      if (r < 0.43) {
        const step = rand() < 0.55 ? 1.2 : 0.3;
        gu = Math.round(gu / step) * step + gauss() * 0.012;
      } else if (onStreet) {
        const step = rand() < 0.55 ? 0.9 : 0.15;
        gw = Math.round(gw / step) * step + gauss() * 0.012;
      }
      if (onStreet && Math.abs(gu - parkU) < 2.1 && Math.abs(gw - parkW) < 0.42) continue;
      x = gu * ca - gw * sa;
      y = gu * sa + gw * ca;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      if (Math.abs(y - river(x)) < 0.3) continue;
      break;
    }
    const dAir = Math.hypot(x - 25.8, y - 4.0);
    const dCore = Math.hypot(x - 12.4, y - 9.4);
    const trip = dAir < 1.1 ? 17 + gauss() * 4 : Math.exp(Math.log(2 + 0.3 * dCore) + gauss() * 0.55);
    X[i] = x;
    Y[i] = y;
    V[i] = 3 + 2.1 * Math.max(0.4, trip) + Math.abs(gauss()) * 1.5;
  };
}

export const DATASETS = {
  terrain: {
    name: 'Alpine terrain survey',
    desc: 'Airborne elevation soundings along flight lines and station clusters, 120 × 80 km.',
    domain: [[0, 120], [0, 80]],
    labels: { x: 'Easting (km)', y: 'Northing (km)', v: 'elevation', unit: 'm' },
    view: { agg: 'mean', scheme: 'terrain', scale: 'linear', contours: true, levels: 16 },
    make: terrain,
  },
  ripple: {
    name: 'Double-slit ripple tank',
    desc: 'Random wave-height probes: a point source diffracts through two slits in a wall.',
    domain: [[-12, 12], [-8, 8]],
    labels: { x: 'x (cm)', y: 'y (cm)', v: 'wave height', unit: 'mm' },
    view: { agg: 'mean', scheme: 'rdbu', scale: 'linear', contours: false, levels: 10 },
    make: ripple,
  },
  galaxy: {
    name: 'Rotating spiral galaxy',
    desc: 'Stars of an inclined spiral with Doppler velocities. Try Count + Log for the arms.',
    domain: [[-20, 20], [-13, 13]],
    labels: { x: 'Δ RA (kpc)', y: 'Δ Dec (kpc)', v: 'line-of-sight velocity', unit: 'km/s' },
    view: { agg: 'mean', scheme: 'rdbu', scale: 'linear', contours: true, levels: 16 },
    make: galaxy,
  },
  city: {
    name: 'City ride pickups',
    desc: 'Taxi pickups on a rotated street grid; value is the fare. Try Mean to map fares.',
    domain: [[0, 30], [0, 20]],
    labels: { x: 'x (km)', y: 'y (km)', v: 'fare', unit: 'USD' },
    view: { agg: 'count', scheme: 'inferno', scale: 'log', contours: false, levels: 10 },
    make: city,
  },
};

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Generates in chunks and yields to the event loop between them so the progress bar can paint.
export async function generateDataset(key, n, seed, onProgress, isCancelled) {
  const def = DATASETS[key];
  const rand = mulberry32(hashString(key) ^ Math.imul(seed, 2654435761));
  const gauss = makeGauss(rand);
  const sample = def.make(rand, gauss);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const v = new Float64Array(n);
  const CHUNK = 1 << 17;
  for (let i0 = 0; i0 < n; i0 += CHUNK) {
    const i1 = Math.min(n, i0 + CHUNK);
    for (let i = i0; i < i1; i++) sample(i, x, y, v);
    if (onProgress) onProgress(i1 / n);
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (isCancelled && isCancelled()) return null;
  }
  const [[X0, X1], [Y0, Y1]] = def.domain;
  return {
    key,
    name: def.name,
    desc: def.desc,
    n,
    x,
    y,
    v,
    X0,
    X1,
    Y0,
    Y1,
    labels: def.labels,
    equalAspect: true,
    shuffled: true,
    seed,
  };
}

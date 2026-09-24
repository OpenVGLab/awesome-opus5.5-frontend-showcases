// Build driver: global maps -> buildings -> trees -> parallel chunk workers -> LOD tiles + stats.
//   node --max-old-space-size=6000 src/gen.mjs [--workers 7] [--only cx,cz,...] [--preview]
import { Worker } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { W, SEA, THETA_DEG, U0, V1, LAT0, LON0 } from './frame.mjs';
import { MATERIALS, M, paletteJson } from './palette.mjs';
import { polySpans } from './raster.mjs';
import { buildMaps, finaliseSurfaces, previewRGB } from './maps.mjs';
import { U } from './city.mjs';
import { buildFabric } from './fabric.mjs';
import { placeTrees } from './trees.mjs';
import { landmarkFootprints } from './landmarks.mjs';
import { highLinePolys } from './bridges.mjs';
import { writePNG } from './png.mjs';
import { buildPlaces } from './places.mjs';
import { encodeTile, decodeTile } from '../js/tilecodec.js';
import { Runs, downsample, window } from './lodcore.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DATA = path.join(ROOT, 'data');
const TMP = '/tmp/nyc8192_build';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const NWORK = Math.min(7, Number(opt('workers', 7)));
const ONLY = opt('only', null);
const T0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s] ${s}`);
let peakRss = 0;
const rssTimer = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 500);

function prepDirs() {
  fs.mkdirSync(TMP, { recursive: true });
  for (const d of ['l0', 'l1', 'l2', 'l3', 'l4']) {
    fs.mkdirSync(path.join(DATA, d), { recursive: true });   // files are overwritten in place (FUSE deletes are slow)
  }
}

async function main() {
  prepDirs();
  const m = buildMaps(log);
  // landmark footprints are kept free of generic buildings
  let reserved = 0;
  for (const fp of [...landmarkFootprints(m), ...highLinePolys().map((poly) => ({ poly, surf: M.gravel_path }))]) {
    polySpans(fp.poly, (z, a, b) => { for (let i = z * W + a; i <= z * W + b; i++) if (m.zone[i] && m.zone[i] !== 7) { m.use[i] = U.RESERVED; m.surf[i] = fp.surf || M.plaza; reserved++; } });
  }
  log(`reserved ${reserved} cells for landmarks`);
  const fab = buildFabric(m, log);
  refinish(m);
  const trees = placeTrees(m, log);
  const treeBuf = new SharedArrayBuffer(trees.byteLength); new Float32Array(treeBuf).set(trees);
  if (args.includes('--preview')) {
    const { w, rgb } = previewRGB(m, 4, (i) => (m.bid[i] > 0 ? [[150, 140, 130], 1] : null));
    writePNG(path.join(TMP, 'preview_s4.png'), w, w, rgb);
    log('preview written');
  }
  const structData = {};
  // ---- workers
  const chunks = [];
  for (let cz = 0; cz < W / 512; cz++) for (let cx = 0; cx < W / 512; cx++) chunks.push([cx, cz]);
  const todo = ONLY ? ONLY.split(';').map((s) => s.split(',').map(Number)) : chunks;
  const mapBufs = {}; for (const k of ['zone', 'elev', 'depth', 'use', 'surf', 'dmap', 'bid', 'pondY']) mapBufs[k] = m[k].buffer;
  const results = [];
  await new Promise((resolve, reject) => {
    let next = 0, active = 0;
    const workers = [];
    for (let k = 0; k < NWORK; k++) {
      const wk = new Worker(path.join(HERE, 'worker.mjs'), {
        workerData: { maps: mapBufs, table: fab.table.buffer, trees: treeBuf, outDir: DATA, tmpDir: TMP, structData },
        resourceLimits: { maxOldGenerationSizeMb: 1400 },
      });
      workers.push(wk);
      const feed = () => {
        if (next >= todo.length) { if (active === 0) { workers.forEach((w) => w.terminate()); resolve(); } return; }
        const [cx, cz] = todo[next++]; active++;
        wk.postMessage({ type: 'chunk', cx, cz });
      };
      wk.on('message', (r) => {
        active--; results.push(r);
        if (results.length % 16 === 0 || results.length === todo.length) log(`chunks ${results.length}/${todo.length} (last ${r.ms} ms)`);
        feed();
      });
      wk.on('error', reject);
      feed();
    }
  });
  // ---- assemble LOD2 / LOD3 from partials
  const tiles = results.flatMap((r) => r.tiles);
  if (!ONLY) {
    tiles.push(...assemble(2, 128, 'p2'));
    tiles.push(...assembleTop());
  }
  // ---- stats
  const matCount = new Float64Array(256);
  let nRuns = 0, nBoxes = 0, ymax = 0, voxAbove = 0, overlays = 0;
  for (const r of results) { r.stats.matCount.forEach((v, i) => { matCount[i] += v; }); nRuns += r.stats.nRuns; nBoxes += r.stats.nBoxes; ymax = Math.max(ymax, r.stats.ymax); voxAbove += r.stats.voxAbove; overlays += r.stats.overlays; }
  const total = matCount.reduce((a, b) => a + b, 0);
  const cats = categorize(matCount);
  const byLod = {};
  for (const t of tiles) { const k = t.lod; byLod[k] = byLod[k] || { count: 0, bytes: 0, raw: 0, runs: 0 }; byLod[k].count++; byLod[k].bytes += t.bytes; byLod[k].raw += t.raw || 0; byLod[k].runs += t.runs; }
  const stats = {
    grid: W, voxel_m: 1, sea_level_y: SEA, frame: { rotation_deg: THETA_DEG, ref_latlon: [LAT0, LON0], u0: U0, v1: V1 },
    static_voxels: total, voxels_above_sea: voxAbove, column_runs: nRuns, box_records: nBoxes, max_y: ymax,
    categories: cats, buildings: fab.count, blocks: fab.blocks, trees: trees.length / 8, overlay_runs: overlays,
    materials: Object.fromEntries(MATERIALS.map(([n], i) => [n, matCount[i + 1]]).filter(([, v]) => v > 0)),
    lods: byLod, build_seconds: (Date.now() - T0) / 1000, peak_rss_main_mb: Math.round(peakRss / 1e6),
  };
  if (!ONLY) {
    const manifest = {
      version: 1, grid: W, voxel_m: 1, sea: SEA, tile: 256,
      lods: [0, 1, 2, 3, 4].map((l) => ({ lod: l, cell: 1 << l, dir: `l${l}`, n: W / (256 << l),
        tiles: Object.fromEntries(tiles.filter((t) => t.lod === l).sort((a, b) => a.tz - b.tz || a.tx - b.tx).map((t) => [`${t.tx}_${t.tz}`, [t.bytes, t.ymin, t.ymax, t.runs]])) })),
      palette: paletteJson(),
      stats,
    };
    fs.writeFileSync(path.join(DATA, 'manifest.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(DATA, 'places.json'), JSON.stringify(buildPlaces()));
  }
  fs.writeFileSync(path.join(TMP, 'stats.json'), JSON.stringify(stats, null, 1));
  clearInterval(rssTimer);
  log(`static voxels ${total.toLocaleString('en-US')}  runs ${nRuns.toLocaleString('en-US')}  boxes ${nBoxes.toLocaleString('en-US')}  ymax ${ymax}`);
  log(`lods ${JSON.stringify(byLod)}`);
  log(`done in ${((Date.now() - T0) / 1000).toFixed(1)} s, main peak RSS ${Math.round(peakRss / 1e6)} MB, system free ${Math.round(os.freemem() / 1e9)} GB`);
}

function refinish(m) {
  const { use, surf, zone } = m;
  for (let i = 0; i < W * W; i++) {
    const u = use[i];
    if (u === U.YARD) { const x = i % W, z = (i / W) | 0; const h = ((x * 7349 + z * 1931) >>> 0) % 100; surf[i] = h < 60 ? M.grass : h < 85 ? M.sidewalk_dark : M.soil; }
    else if (u === U.PLAZA && surf[i] === M.concrete) { const x = i % W, z = (i / W) | 0; surf[i] = ((x % 7) === 0 || (z % 7) === 0) ? M.plaza_dark : M.plaza; }
    else if (u === U.PARK && surf[i] === M.concrete) surf[i] = M.grass;
    else if (u === U.BUILDING) surf[i] = M.concrete;
    void zone;
  }
}

function assemble(lod, inner, prefix) {
  const perTile = 256 / inner;               // chunks per tile edge
  const nT = W / (256 << lod);
  const cache = new Map();
  const load = (cx, cz) => {
    const k = `${cx}_${cz}`;
    if (!cache.has(k)) {
      const f = path.join(TMP, `${prefix}_${cx}_${cz}.bin`);
      cache.set(k, fs.existsSync(f) ? decodeTile(new Uint8Array(fs.readFileSync(f))) : null);
    }
    return cache.get(k);
  };
  const out = [];
  const nChunks = W / 512;
  for (let TZ = 0; TZ < nT; TZ++) for (let TX = 0; TX < nT; TX++) {
    const S = 258, start = new Uint32Array(S * S + 1);
    const y0 = [], y1 = [], mat = [];
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      start[j * S + i] = y0.length;
      const gx = TX * 256 + i - 1, gz = TZ * 256 + j - 1;
      if (gx < 0 || gz < 0 || gx >= nChunks * inner || gz >= nChunks * inner) continue;
      const cx = Math.floor(gx / inner), cz = Math.floor(gz / inner);
      const p = load(cx, cz); if (!p) continue;
      const lx = gx - cx * inner + 1, lz = gz - cz * inner + 1, c = lz * (inner + 2) + lx;
      for (let r = p.start[c]; r < p.start[c + 1]; r++) { y0.push(p.y0[r]); y1.push(p.y1[r]); mat.push(p.mat[r]); }
    }
    start[S * S] = y0.length;
    const enc = encodeTile({ start, y0: Uint16Array.from(y0), y1: Uint16Array.from(y1), mat: Uint8Array.from(mat) }, { lod, tx: TX, tz: TZ, n: 256, cell: 1 << lod });
    const g = zlib.gzipSync(enc.bytes, { level: 9 });
    fs.writeFileSync(path.join(DATA, `l${lod}`, `${TX}_${TZ}.bin`), g);
    out.push({ lod, tx: TX, tz: TZ, bytes: g.length, raw: enc.bytes.length, runs: enc.nruns, ymin: enc.ymin, ymax: enc.ymax });
    if (cache.size > 64) cache.clear();
    void perTile;
  }
  return out;
}

// LOD3 (8 m) as one global 1024^2 column set from the worker partials, then LOD4 (16 m) by 2x2.
function assembleTop() {
  const N3 = W / 8, inner = 64, nChunks = W / 512;
  const g3 = new Runs(N3 * N3, 1 << 22);
  const parts = new Map();
  for (let cz = 0; cz < nChunks; cz++) for (let cx = 0; cx < nChunks; cx++) {
    const f = path.join(TMP, `p3_${cx}_${cz}.bin`);
    parts.set(`${cx}_${cz}`, fs.existsSync(f) ? decodeTile(new Uint8Array(fs.readFileSync(f))) : null);
  }
  for (let gz = 0; gz < N3; gz++) for (let gx = 0; gx < N3; gx++) {
    const c = gz * N3 + gx;
    g3.start[c] = g3.n;
    const cx = Math.floor(gx / inner), cz = Math.floor(gz / inner), p = parts.get(`${cx}_${cz}`);
    if (!p) continue;
    const lc = (gz - cz * inner + 1) * (inner + 2) + (gx - cx * inner + 1);
    for (let r = p.start[lc]; r < p.start[lc + 1]; r++) g3.push(p.y0[r], p.y1[r], p.mat[r]);
  }
  g3.start[N3 * N3] = g3.n;
  const out = [];
  const writeLevel = (runs, S, lod) => {
    const nT = S / 256;
    for (let TZ = 0; TZ < nT; TZ++) for (let TX = 0; TX < nT; TX++) {
      const w = window(runs, S, TX * 256 - 1, TZ * 256 - 1, 258);
      const enc = encodeTile(w, { lod, tx: TX, tz: TZ, n: 256, cell: 1 << lod });
      const g = zlib.gzipSync(enc.bytes, { level: 9 });
      fs.writeFileSync(path.join(DATA, `l${lod}`, `${TX}_${TZ}.bin`), g);
      out.push({ lod, tx: TX, tz: TZ, bytes: g.length, raw: enc.bytes.length, runs: enc.nruns, ymin: enc.ymin, ymax: enc.ymax });
    }
  };
  writeLevel(g3, N3, 3);
  const g4 = downsample(g3, N3, 8);
  writeLevel(g4, N3 / 2, 4);
  return out;
}

function categorize(mc) {
  const cat = { ground: 0, water: 0, streets: 0, buildings: 0, vegetation: 0, structures: 0 };
  MATERIALS.forEach(([name], k) => {
    const v = mc[k + 1]; if (!v) return;
    let c = 'buildings';
    if (['bedrock', 'schist', 'soil', 'silt', 'sand', 'gravel', 'rock', 'rock_dark', 'grass', 'grass_lawn', 'grass_dry', 'meadow', 'dirt_path', 'gravel_path', 'mulch', 'infield', 'turf', 'tree_pit'].includes(name)) c = 'ground';
    else if (['water', 'pond', 'fountain', 'ice'].includes(name)) c = 'water';
    else if (['asphalt', 'asphalt_old', 'lane_white', 'lane_yellow', 'crosswalk', 'bus_lane', 'bike_lane', 'cobble', 'rail_ballast', 'rail_steel', 'road_concrete', 'sidewalk', 'sidewalk_dark', 'curb', 'bluestone', 'plaza', 'plaza_dark', 'brick_pave', 'planks', 'planks_dark'].includes(name)) c = 'streets';
    else if (name.startsWith('leaves') || name.startsWith('flowers') || ['hedge', 'trunk'].includes(name)) c = 'vegetation';
    else if (name.startsWith('bridge') || ['cable', 'suspender', 'steel', 'steel_dark', 'rust', 'hull_red', 'hull_dark', 'deck_gray'].includes(name)) c = 'structures';
    cat[c] += v;
  });
  return cat;
}

main().catch((e) => { console.error(e); process.exit(1); });

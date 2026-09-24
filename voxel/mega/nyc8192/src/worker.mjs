// Chunk worker: builds the column runs of one 512 x 512 chunk (+8 margin), counts voxels exactly,
// and writes LOD0 / LOD1 tiles (gzip) plus LOD2 / LOD3 partials for the main thread to assemble.
import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { W, SEA } from './frame.mjs';
import { Runs, downsample, window } from './lodcore.mjs';
import { makeColumnGen } from './columns.mjs';
import { TS } from './trees.mjs';
import { encodeTile } from '../js/tilecodec.js';
import { makeStructures } from './structures.mjs';

const { maps: mapBufs, table: tableBuf, trees: treeBuf, outDir, tmpDir, structData } = workerData;
const maps = {
  zone: new Uint8Array(mapBufs.zone), elev: new Uint8Array(mapBufs.elev), depth: new Uint8Array(mapBufs.depth),
  use: new Uint8Array(mapBufs.use), surf: new Uint8Array(mapBufs.surf), dmap: new Uint8Array(mapBufs.dmap),
  bid: new Int32Array(mapBufs.bid), pondY: new Uint8Array(mapBufs.pondY),
};
const table = new Float32Array(tableBuf);
const trees = new Float32Array(treeBuf);
const gen = makeColumnGen(maps, table);
const structures = makeStructures(maps, structData);

const CH = 512, MG = 8, R = CH + 2 * MG, YMAX = 1024;
void YMAX;
const MODE_FILL = 0, MODE_OVER = 1, MODE_CLEAR = 2;

// overlay runs for the region, bucketed by column
class Overlays {
  constructor() { this.col = []; this.y0 = []; this.y1 = []; this.mat = []; this.mode = []; }
  add(xr, zr, y0, y1, mat, mode) {
    if (xr < 0 || zr < 0 || xr >= R || zr >= R || y1 <= y0) return;
    this.col.push(zr * R + xr); this.y0.push(Math.max(0, y0)); this.y1.push(Math.min(YMAX - 1, y1)); this.mat.push(mat); this.mode.push(mode);
  }
  finish() {
    const n = this.col.length, cnt = new Uint32Array(R * R + 1);
    for (let k = 0; k < n; k++) cnt[this.col[k] + 1]++;
    for (let c = 0; c < R * R; c++) cnt[c + 1] += cnt[c];
    const order = new Uint32Array(n), pos = cnt.slice(0, R * R);
    for (let k = 0; k < n; k++) order[pos[this.col[k]]++] = k;
    this.head = cnt; this.order = order;
  }
}

function emitTrees(ov, X0, Z0) {
  const nt = trees.length / TS;
  for (let t = 0; t < nt; t++) {
    const o = t * TS, tx = trees[o], tz = trees[o + 1];
    const cr = trees[o + 3];
    if (tx + cr < X0 - 1 || tx - cr > X0 + R + 1 || tz + cr < Z0 - 1 || tz - cr > Z0 + R + 1) continue;
    const th = trees[o + 2], ch = trees[o + 4], leaf = trees[o + 5], gy = trees[o + 6], seed = trees[o + 7];
    const txi = Math.floor(tx), tzi = Math.floor(tz);
    const cy = gy + th + ch / 2, hy = ch / 2;
    ov.add(txi - X0, tzi - Z0, gy, Math.round(gy + th + ch * 0.4), 99 /* trunk */, MODE_FILL);
    const ri = Math.ceil(cr);
    for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
      const x = txi + dx, z = tzi + dz;
      const ddx = x + 0.5 - tx, ddz = z + 0.5 - tz;
      let q = (ddx * ddx + ddz * ddz) / (cr * cr);
      const h = hashf(x, z, seed);
      q += (h - 0.5) * 0.35;
      if (q > 1) continue;
      const k = Math.sqrt(1 - q);
      const a = Math.round(cy - hy * k * (0.8 + 0.2 * h)), b = Math.round(cy + hy * k * (0.85 + 0.3 * hashf(z, x, seed)));
      if (b > a) ov.add(x - X0, z - Z0, a, b, leaf, MODE_FILL);
    }
  }
}
function hashf(x, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const gz = (b) => zlib.gzipSync(b, { level: 9 });

const col = new Uint8Array(YMAX);
parentPort.on('message', (msg) => {
  if (msg.type !== 'chunk') return;
  const t0 = Date.now();
  const { cx, cz } = msg;
  const X0 = cx * CH - MG, Z0 = cz * CH - MG;
  // overlays: trees + structures
  const ov = new Overlays();
  emitTrees(ov, X0, Z0);
  const sstats = structures.emit(X0, Z0, R, (xr, zr, y0, y1, mat, mode) => ov.add(xr, zr, y0, y1, mat, mode));
  ov.finish();
  const runs = new Runs(R * R, 1 << 21);
  const matCount = new Float64Array(256);
  let prevTop = YMAX;
  let voxAbove = 0;
  for (let zr = 0; zr < R; zr++) {
    for (let xr = 0; xr < R; xr++) {
      const x = X0 + xr, z = Z0 + zr, c = zr * R + xr;
      runs.start[c] = runs.n;
      if (x < 0 || z < 0 || x >= W || z >= W) continue;
      col.fill(0, 0, prevTop);
      let top = gen(x, z, col);
      // overlays
      for (let k = ov.head[c]; k < ov.head[c + 1]; k++) {
        const j = ov.order[k], a = ov.y0[j], b = ov.y1[j], mode = ov.mode[j];
        let mt = ov.mat[j];
        if (mt === 99) mt = TRUNK;
        if (mode === MODE_FILL) { for (let y = a; y < b; y++) if (!col[y]) col[y] = mt; }
        else if (mode === MODE_OVER) col.fill(mt, a, b);
        else col.fill(0, a, b);
        if (b > top) top = b;
      }
      while (top > 0 && !col[top - 1]) top--;
      prevTop = Math.max(top, 1);
      // RLE
      const interior = xr >= MG && xr < MG + CH && zr >= MG && zr < MG + CH;
      let y = 0;
      while (y < top) {
        const v = col[y]; if (!v) { y++; continue; }
        let e = y + 1; while (e < top && col[e] === v) e++;
        runs.push(y, e, v);
        if (interior) { matCount[v] += e - y; if (e > SEA) voxAbove += e - Math.max(y, SEA); }
        y = e;
      }
    }
  }
  runs.start[R * R] = runs.n;
  // exact stats over interior columns: runs and x-merged boxes
  let nRuns = 0, nBoxes = 0, ymax = 0;
  for (let zr = MG; zr < MG + CH; zr++) {
    for (let xr = MG; xr < MG + CH; xr++) {
      const c = zr * R + xr, a = runs.start[c], b = runs.start[c + 1];
      nRuns += b - a;
      for (let r = a; r < b; r++) if (runs.y1[r] > ymax) ymax = runs.y1[r];
      if (xr === MG) { nBoxes += b - a; continue; }
      const pa = runs.start[c - 1], pb = runs.start[c];
      let i = pa, merged = 0;
      for (let r = a; r < b; r++) {
        while (i < pb && runs.y0[i] < runs.y0[r]) i++;
        if (i < pb && runs.y0[i] === runs.y0[r] && runs.y1[i] === runs.y1[r] && runs.mat[i] === runs.mat[r]) merged++;
      }
      nBoxes += b - a - merged;
    }
  }
  const files = [];
  const write = (rel, bytes) => { fs.writeFileSync(`${outDir}/${rel}`, bytes); files.push([rel, bytes.length]); };
  const tiles = [];
  // LOD0: four 256 tiles with 1-column borders
  for (let tj = 0; tj < 2; tj++) for (let ti = 0; ti < 2; ti++) {
    const w = window(runs, R, MG + ti * 256 - 1, MG + tj * 256 - 1, 258);
    const tx = cx * 2 + ti, tz = cz * 2 + tj;
    const enc = encodeTile(w, { lod: 0, tx, tz, n: 256, cell: 1 });
    const g = gz(enc.bytes);
    write(`l0/${tx}_${tz}.bin`, g);
    tiles.push({ lod: 0, tx, tz, bytes: g.length, raw: enc.bytes.length, runs: enc.nruns, ymin: enc.ymin, ymax: enc.ymax });
  }
  // LOD1
  const l1 = downsample(runs, R);                 // 264 x 264
  {
    const w = window(l1, R / 2, 3, 3, 258);
    const enc = encodeTile(w, { lod: 1, tx: cx, tz: cz, n: 256, cell: 2 });
    const g = gz(enc.bytes);
    write(`l1/${cx}_${cz}.bin`, g);
    tiles.push({ lod: 1, tx: cx, tz: cz, bytes: g.length, raw: enc.bytes.length, runs: enc.nruns, ymin: enc.ymin, ymax: enc.ymax });
  }
  const l2 = downsample(l1, R / 2, 2);            // 132 x 132, 2 m vertical quantum
  const p2 = window(l2, R / 4, 1, 1, 130);
  const l3 = downsample(l2, R / 4, 4);            // 66 x 66, 4 m vertical quantum
  const p3 = window(l3, R / 8, 0, 0, 66);
  const savePartial = (name, w, size) => {
    const enc = encodeTile(w, { lod: 9, tx: cx, tz: cz, n: size - 2, cell: 0 });
    fs.writeFileSync(`${tmpDir}/${name}_${cx}_${cz}.bin`, enc.bytes);
  };
  savePartial('p2', p2, 130); savePartial('p3', p3, 66);
  parentPort.postMessage({
    type: 'done', cx, cz, ms: Date.now() - t0, tiles, files,
    stats: { matCount: Array.from(matCount), nRuns, nBoxes, ymax, voxAbove, overlays: ov.col.length, structures: sstats },
  });
});
import { M } from './palette.mjs';
const TRUNK = M.trunk;

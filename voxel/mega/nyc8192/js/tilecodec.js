// Column-interval tile codec shared by the generator (Node) and the viewer (browser).
//
// A tile is an (n+2) x (n+2) block of columns (n interior + 1-column border ring from the
// neighbours), rows in z order, x fastest. Each column is a list of solid runs [y0, y1) with a
// material id (palette index, 0 = air never stored). Layout (little endian), before gzip:
//   0  u32 magic "NYT1"      4 u8 lod   5 u8 version=1   6 u16 cellSize (metres per column)
//   8  u16 tx   10 u16 tz    12 u16 n   14 u16 pad(=1)
//   16 u32 nruns             20 u16 ymin   22 u16 ymax  (interior columns)
//   24 u32 bytes(counts)     28 u32 bytes(gaps)   32 u32 bytes(lens)   36 u32 reserved
//   40 counts: varint runs per column
//      gaps:   varint per run, y0 - previous run's y1 (first run: y0)
//      lens:   varint per run, y1 - y0
//      mats:   u8 per run
export const TILE_MAGIC = 0x3154594e;
export const HEADER = 40;

class ByteSink {
  constructor(cap = 1 << 16) { this.buf = new Uint8Array(cap); this.len = 0; }
  ensure(n) { if (this.len + n > this.buf.length) { let c = this.buf.length * 2; while (c < this.len + n) c *= 2; const b = new Uint8Array(c); b.set(this.buf.subarray(0, this.len)); this.buf = b; } }
  varint(v) { this.ensure(5); while (v >= 128) { this.buf[this.len++] = (v & 127) | 128; v >>>= 7; } this.buf[this.len++] = v; }
  byte(v) { this.ensure(1); this.buf[this.len++] = v; }
  bytes() { return this.buf.subarray(0, this.len); }
}

// cols: { start: Uint32Array(ncols+1), y0, y1, mat } indexed by column in tile order
export function encodeTile({ start, y0, y1, mat }, meta) {
  const { lod, tx, tz, n, cell } = meta;
  const S = n + 2, ncols = S * S;
  const counts = new ByteSink(ncols + 16), gaps = new ByteSink(), lens = new ByteSink(), mats = new ByteSink();
  let ymin = 65535, ymax = 0, nruns = 0;
  for (let c = 0; c < ncols; c++) {
    const a = start[c], b = start[c + 1];
    counts.varint(b - a);
    let prev = 0;
    const cz = (c / S) | 0, cx = c - cz * S;
    const interior = cx >= 1 && cx <= n && cz >= 1 && cz <= n;
    for (let r = a; r < b; r++) {
      gaps.varint(y0[r] - prev); lens.varint(y1[r] - y0[r]); mats.byte(mat[r]); prev = y1[r];
      if (interior) { if (y0[r] < ymin) ymin = y0[r]; if (y1[r] > ymax) ymax = y1[r]; }
    }
    nruns += b - a;
  }
  if (ymin > ymax) { ymin = 0; ymax = 0; }
  const c1 = counts.bytes(), g1 = gaps.bytes(), l1 = lens.bytes(), m1 = mats.bytes();
  const out = new Uint8Array(HEADER + c1.length + g1.length + l1.length + m1.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, TILE_MAGIC, true); out[4] = lod; out[5] = 1; dv.setUint16(6, cell, true);
  dv.setUint16(8, tx, true); dv.setUint16(10, tz, true); dv.setUint16(12, n, true); dv.setUint16(14, 1, true);
  dv.setUint32(16, nruns, true); dv.setUint16(20, ymin, true); dv.setUint16(22, ymax, true);
  dv.setUint32(24, c1.length, true); dv.setUint32(28, g1.length, true); dv.setUint32(32, l1.length, true);
  let o = HEADER;
  out.set(c1, o); o += c1.length; out.set(g1, o); o += g1.length; out.set(l1, o); o += l1.length; out.set(m1, o);
  return { bytes: out, nruns, ymin, ymax };
}

export function decodeTile(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== TILE_MAGIC) throw new Error('bad tile magic');
  const lod = bytes[4], cell = dv.getUint16(6, true), tx = dv.getUint16(8, true), tz = dv.getUint16(10, true), n = dv.getUint16(12, true);
  const nruns = dv.getUint32(16, true), ymin = dv.getUint16(20, true), ymax = dv.getUint16(22, true);
  const bc = dv.getUint32(24, true), bg = dv.getUint32(28, true), bl = dv.getUint32(32, true);
  const S = n + 2, ncols = S * S;
  const start = new Uint32Array(ncols + 1), y0 = new Uint16Array(nruns), y1 = new Uint16Array(nruns), mat = new Uint8Array(nruns);
  let pc = HEADER, pg = HEADER + bc, pl = pg + bg, pm = pl + bl;
  const rd = (p) => { let v = 0, s = 0, b; do { b = bytes[p++]; v |= (b & 127) << s; s += 7; } while (b & 128); return [v, p]; };
  let r = 0;
  for (let c = 0; c < ncols; c++) {
    let k; [k, pc] = rd(pc);
    start[c] = r;
    let prev = 0;
    for (let j = 0; j < k; j++, r++) {
      let g, l; [g, pg] = rd(pg); [l, pl] = rd(pl);
      y0[r] = prev + g; y1[r] = y0[r] + l; mat[r] = bytes[pm++]; prev = y1[r];
    }
  }
  start[ncols] = r;
  return { lod, cell, tx, tz, n, ncols, nruns, ymin, ymax, start, y0, y1, mat };
}

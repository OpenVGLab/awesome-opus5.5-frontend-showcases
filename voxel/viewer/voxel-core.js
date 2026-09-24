// Shared voxel core: palette, chunk record codec and greedy mesher.
// Pure JS with no DOM / Node APIs: imported by the viewer's mesh worker and by the Node harness.

// Material ids are 1-based indices into this table; 0 is air.
export const PALETTE = [
  ['white', '#f4f4f0'], ['light_gray', '#b8b8b4'], ['gray', '#7c7c78'], ['dark_gray', '#4a4a48'], ['black', '#1e1e20'],
  ['red', '#c8342c'], ['orange', '#e8792b'], ['yellow', '#f2c230'], ['lime', '#8cc63f'], ['green', '#3f8a3a'],
  ['cyan', '#2aa6b8'], ['light_blue', '#7ec3ec'], ['blue', '#2f5fb8'], ['purple', '#7a4bb0'], ['magenta', '#c24fa6'],
  ['pink', '#f09ab8'], ['brown', '#7a5232'],
  ['stone', '#8a8a86'], ['cobblestone', '#6f6d69'], ['granite', '#9c7e6e'], ['sandstone', '#d8c38a'], ['brick', '#a4513a'],
  ['dark_brick', '#6e3a2c'],
  ['concrete', '#c9c7c0'], ['glass', '#cfe8f0', true], ['glass_blue', '#6aa6d4', true], ['glass_dark', '#34495e', true],
  ['steel', '#9aa4ad'], ['gold', '#e0b94a'], ['copper', '#b8733a'], ['wood', '#9b6b3d'], ['planks', '#c89a5c'], ['roof', '#8c3b30'],
  ['grass', '#5f9e3a'], ['dirt', '#7a5a3a'], ['sand', '#e2d29c'], ['water', '#3b7bbf', true], ['snow', '#f2f6f8'],
  ['leaves', '#3e7a34'], ['asphalt', '#3a3a3c'],
].map(([name, color, transparent], i) => ({ id: i + 1, name, color, transparent: !!transparent }));

export const MATERIAL_COUNT = PALETTE.length; // 40

// Chunk geometry. Records carry a chunk padded by one voxel on every side (34^3) so that each
// record can be meshed on its own (face culling + ambient occlusion need the neighbours).
export const CS = 32;
export const CS3 = CS * CS * CS;
export const PS = CS + 2;
export const PS2 = PS * PS;
export const PS3 = PS2 * PS;
// Padded index: ((y + 1) * PS + (z + 1)) * PS + (x + 1), x fastest.
const SX = 1, SY = PS2, SZ = PS;
const PAD = SX + SY + SZ;

// ---------------------------------------------------------------------------------------------
// Run-length codec: a sequence of runs, each run = [material u8][length LEB128 varint].
// Worst case 4 bytes per voxel, so an encode buffer needs 4 * PS3 bytes of headroom.

export function rleEncode(src, n, out, pos) {
  let i = 0;
  while (i < n) {
    const v = src[i];
    let j = i + 1;
    while (j < n && src[j] === v) j++;
    let len = j - i;
    out[pos++] = v;
    while (len >= 128) { out[pos++] = (len & 127) | 128; len >>>= 7; }
    out[pos++] = len;
    i = j;
  }
  return pos;
}

export function rleDecode(src, start, end, out) {
  let p = start, o = 0;
  while (p < end) {
    const v = src[p++];
    let b = src[p++];
    let len = b & 127;
    if (b & 128) {
      let shift = 7;
      do { b = src[p++]; len |= (b & 127) << shift; shift += 7; } while (b & 128);
    }
    const e = o + len;
    if (len < 24) { while (o < e) out[o++] = v; } else { out.fill(v, o, e); o = e; }
  }
  return o;
}

// ---------------------------------------------------------------------------------------------
// Face visibility / occlusion tables. Ids are < 64.

export function makeTables(transparentIds) {
  const trans = new Uint8Array(64);
  for (const id of transparentIds) trans[id] = 1;
  const opaque = new Uint8Array(256);
  for (let i = 1; i < 64; i++) opaque[i] = trans[i] ? 0 : 1;
  // vis[(self << 6) | neighbour]: does voxel `self` draw its face toward `neighbour`?
  // Opaque faces show against air and transparent blocks. Transparent faces show against air;
  // between two different transparent materials only the higher id draws (avoids coplanar pairs).
  const vis = new Uint8Array(64 * 64);
  for (let m = 1; m < 64; m++) {
    for (let n = 0; n < 64; n++) {
      let v;
      if (n === 0) v = 1;
      else if (!trans[m]) v = trans[n];
      else v = trans[n] && n < m ? 1 : 0;
      vis[(m << 6) | n] = v;
    }
  }
  return { trans, opaque, vis };
}

export function defaultTables() {
  return makeTables(PALETTE.filter((p) => p.transparent).map((p) => p.id));
}

// ---------------------------------------------------------------------------------------------
// Greedy mesher with per-vertex ambient occlusion.
//
// Face directions d: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z.
// Output per vertex: position Uint16 x3 (output frame units) and data Uint8 x4 =
// [direction, material, ao 0..3 (3 = unoccluded), 0]. Quads are 4 vertices; triangles use the
// shared index pattern (0,1,2)(0,2,3) and the vertex order is rotated to pick the AO-friendly
// diagonal. Faces merge only when material and all four AO values match, which keeps the AO exact.

// Per axis a: stride along the axis, and the in-plane axes u, v with u x v = +a.
const A_STRIDE = [SX, SY, SZ];
const U_STRIDE = [SY, SZ, SX];
const V_STRIDE = [SZ, SX, SY];

class QuadBuffer {
  constructor(cap) {
    this.cap = cap;
    this.pos = new Uint16Array(cap * 12);
    this.dat = new Uint8Array(cap * 16);
    this.quads = 0;
  }
  grow() {
    const cap = this.cap * 2;
    const pos = new Uint16Array(cap * 12); pos.set(this.pos);
    const dat = new Uint8Array(cap * 16); dat.set(this.dat);
    this.pos = pos; this.dat = dat; this.cap = cap;
  }
  take() {
    const n = this.quads;
    return { quads: n, pos: this.pos.slice(0, n * 12), dat: this.dat.slice(0, n * 16) };
  }
}

export class Mesher {
  constructor(tables = defaultTables(), { countOnly = false, initialQuads = 8192 } = {}) {
    this.t = tables;
    this.countOnly = countOnly;
    this.mask = new Uint16Array(CS * CS);
    this.layerSolid = new Int32Array(3 * CS);
    this.layerOpaque = new Int32Array(3 * CS);
    this.opaqueOut = countOnly ? null : new QuadBuffer(initialQuads);
    this.transOut = countOnly ? null : new QuadBuffer(Math.max(256, initialQuads >> 3));
    this.faces = 0;
    this.quads = 0;
    this.transQuads = 0;
  }

  reset() {
    this.faces = 0; this.quads = 0; this.transQuads = 0;
    if (this.opaqueOut) { this.opaqueOut.quads = 0; this.transOut.quads = 0; }
  }

  // Mesh one padded chunk volume P (Uint8Array(PS3)). (ox, oy, oz) = chunk origin in the output frame.
  mesh(P, ox, oy, oz) {
    const { vis, opaque: opq } = this.t;
    const mask = this.mask;
    const lsol = this.layerSolid, lopq = this.layerOpaque;
    lsol.fill(0); lopq.fill(0);

    for (let y = 0; y < CS; y++) {
      for (let z = 0; z < CS; z++) {
        let p = PAD + y * SY + z * SZ;
        for (let x = 0; x < CS; x++, p++) {
          const m = P[p];
          if (m !== 0) {
            lsol[x]++; lsol[CS + y]++; lsol[2 * CS + z]++;
            if (opq[m]) { lopq[x]++; lopq[CS + y]++; lopq[2 * CS + z]++; }
          }
        }
      }
    }

    let faces = 0;
    for (let a = 0; a < 3; a++) {
      const sa = A_STRIDE[a], su = U_STRIDE[a], sv = V_STRIDE[a];
      const lo = a * CS;
      for (let sg = 0; sg < 2; sg++) {
        const d = a * 2 + sg;
        const off = sg === 0 ? sa : -sa;
        for (let s = 0; s < CS; s++) {
          if (lsol[lo + s] === 0) continue;
          const ns = sg === 0 ? s + 1 : s - 1;
          if (ns >= 0 && ns < CS && lopq[lo + s] === CS * CS && lopq[lo + ns] === CS * CS) continue;
          let any = 0;
          const base = PAD + s * sa;
          for (let v = 0; v < CS; v++) {
            let p = base + v * sv;
            const row = v << 5;
            for (let u = 0; u < CS; u++, p += su) {
              const m = P[p];
              if (m === 0) { mask[row + u] = 0; continue; }
              const q = p + off;
              if (vis[(m << 6) | P[q]] === 0) { mask[row + u] = 0; continue; }
              const um = opq[P[q - su]], up = opq[P[q + su]], vm = opq[P[q - sv]], vp = opq[P[q + sv]];
              const a00 = (um & vm) ? 0 : 3 - um - vm - opq[P[q - su - sv]];
              const a10 = (up & vm) ? 0 : 3 - up - vm - opq[P[q + su - sv]];
              const a11 = (up & vp) ? 0 : 3 - up - vp - opq[P[q + su + sv]];
              const a01 = (um & vp) ? 0 : 3 - um - vp - opq[P[q - su + sv]];
              mask[row + u] = m | (a00 << 8) | (a10 << 10) | (a11 << 12) | (a01 << 14);
              any++;
            }
          }
          if (any === 0) continue;
          faces += any;
          this._greedy(d, a, sg, s, ox, oy, oz);
        }
      }
    }
    this.faces += faces;
    return faces;
  }

  _greedy(d, a, sg, s, ox, oy, oz) {
    const mask = this.mask;
    const trans = this.t.trans;
    const countOnly = this.countOnly;
    const pa = sg === 0 ? s + 1 : s;
    for (let v = 0; v < CS; v++) {
      const row = v << 5;
      for (let u = 0; u < CS;) {
        const k = mask[row + u];
        if (k === 0) { u++; continue; }
        let w = 1;
        while (u + w < CS && mask[row + u + w] === k) w++;
        let h = 1;
        outer: for (; v + h < CS; h++) {
          const r2 = ((v + h) << 5) + u;
          for (let i = 0; i < w; i++) if (mask[r2 + i] !== k) break outer;
        }
        for (let j = 0; j < h; j++) mask.fill(0, ((v + j) << 5) + u, ((v + j) << 5) + u + w);
        const m = k & 255;
        if (trans[m]) this.transQuads++; else this.quads++;
        if (!countOnly) this._emit(trans[m] ? this.transOut : this.opaqueOut, d, a, sg, pa, u, v, w, h, k, ox, oy, oz);
        u += w;
      }
    }
  }

  _emit(buf, d, a, sg, pa, u, v, w, h, k, ox, oy, oz) {
    if (buf.quads >= buf.cap) buf.grow();
    const m = k & 255;
    const a00 = (k >> 8) & 3, a10 = (k >> 10) & 3, a11 = (k >> 12) & 3, a01 = (k >> 14) & 3;
    // Corners in (u, v): c0 = (u, v), c1 = (u+w, v), c2 = (u+w, v+h), c3 = (u, v+h).
    // Counter-clockwise seen from the face normal: +sign uses c0 c1 c2 c3, -sign uses c0 c3 c2 c1.
    // Index pattern splits along slot0-slot2; rotate by one slot to split along the other diagonal.
    const flip = a10 + a01 > a00 + a11;
    let o0, o1, o2, o3;
    if (sg === 0) { if (flip) { o0 = 1; o1 = 2; o2 = 3; o3 = 0; } else { o0 = 0; o1 = 1; o2 = 2; o3 = 3; } }
    else { if (flip) { o0 = 3; o1 = 2; o2 = 1; o3 = 0; } else { o0 = 0; o1 = 3; o2 = 2; o3 = 1; } }
    const pos = buf.pos, dat = buf.dat;
    let pi = buf.quads * 12, di = buf.quads * 16;
    for (let n = 0; n < 4; n++) {
      const c = n === 0 ? o0 : n === 1 ? o1 : n === 2 ? o2 : o3;
      const cu = (c === 1 || c === 2) ? u + w : u;
      const cv = (c === 2 || c === 3) ? v + h : v;
      const ao = c === 0 ? a00 : c === 1 ? a10 : c === 2 ? a11 : a01;
      let x, y, z;
      if (a === 0) { x = pa; y = cu; z = cv; }
      else if (a === 1) { y = pa; z = cu; x = cv; }
      else { z = pa; x = cu; y = cv; }
      pos[pi++] = x + ox; pos[pi++] = y + oy; pos[pi++] = z + oz;
      dat[di++] = d; dat[di++] = m; dat[di++] = ao; dat[di++] = 0;
    }
    buf.quads++;
  }

  take() {
    return { opaque: this.opaqueOut.take(), trans: this.transOut.take(), faces: this.faces };
  }
}

// ---------------------------------------------------------------------------------------------
// LOD file layout (after zlib inflate), little endian:
//   header (32 bytes): magic "VXL1", u16 version, u8 level, u8 chunkBits, u32 gridSize, u32 scale,
//                      u32 chunkCount, u32 regionChunks, f64 blockCount
//   records:           u16 cx, u16 cy, u16 cz, u16 blocks (0 means 32768), u32 rleBytes, rle bytes
// Records are sorted by region (regionChunks^3 chunks) and then Morton order inside the region.

export const LOD_MAGIC = 0x314c5856; // "VXL1" read as little-endian u32
export const LOD_VERSION = 1;
export const HEADER_BYTES = 32;
export const RECORD_HEADER_BYTES = 12;

export function readLodHeader(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, HEADER_BYTES);
  const magic = dv.getUint32(0, true);
  if (magic !== LOD_MAGIC) throw new Error('bad LOD file magic');
  return {
    version: dv.getUint16(4, true),
    level: dv.getUint8(6),
    chunkBits: dv.getUint8(7),
    gridSize: dv.getUint32(8, true),
    scale: dv.getUint32(12, true),
    chunkCount: dv.getUint32(16, true),
    regionChunks: dv.getUint32(20, true),
    blockCount: dv.getFloat64(24, true),
  };
}

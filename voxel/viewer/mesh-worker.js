// Mesh worker: decodes a batch of padded chunk records and greedy-meshes them into one vertex set
// (positions relative to the batch's region origin, in LOD voxel units).
import { Mesher, makeTables, rleDecode, PS3, RECORD_HEADER_BYTES } from './voxel-core.js';

let mesher = null;
const P = new Uint8Array(PS3);

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    mesher = new Mesher(makeTables(msg.transparent), { initialQuads: 1 << 15 });
    return;
  }
  if (msg.type !== 'job') return;
  const t0 = performance.now();
  const bytes = new Uint8Array(msg.buf);
  const dv = new DataView(msg.buf);
  const [rx, ry, rz] = msg.origin;
  mesher.reset();
  let p = 0, chunks = 0, blocks = 0;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  while (p < bytes.length) {
    const cx = dv.getUint16(p, true), cy = dv.getUint16(p + 2, true), cz = dv.getUint16(p + 4, true);
    const nb = dv.getUint16(p + 6, true), len = dv.getUint32(p + 8, true);
    p += RECORD_HEADER_BYTES;
    rleDecode(bytes, p, p + len, P);
    p += len;
    const ox = cx * 32 - rx, oy = cy * 32 - ry, oz = cz * 32 - rz;
    mesher.mesh(P, ox, oy, oz);
    chunks++;
    blocks += nb;
    if (ox < x0) x0 = ox; if (oy < y0) y0 = oy; if (oz < z0) z0 = oz;
    if (ox + 32 > x1) x1 = ox + 32; if (oy + 32 > y1) y1 = oy + 32; if (oz + 32 > z1) z1 = oz + 32;
  }
  const out = mesher.take();
  self.postMessage({
    type: 'result', id: msg.id, session: msg.session,
    opaque: out.opaque, trans: out.trans, faces: out.faces, chunks, blocks,
    bounds: [x0, y0, z0, x1, y1, z1], ms: performance.now() - t0,
  }, [out.opaque.pos.buffer, out.opaque.dat.buffer, out.trans.pos.buffer, out.trans.dat.buffer]);
};

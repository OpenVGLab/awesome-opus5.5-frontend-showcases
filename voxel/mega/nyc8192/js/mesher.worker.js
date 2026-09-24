// Tile mesher (Web Worker): fetch -> gunzip -> decode column runs -> instanced quads (see meshcore.js).
import { decodeTile } from './tilecodec.js';
import { mesh, topHeights, setTransparent } from './meshcore.js';

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'init') { setTransparent(new Uint8Array(msg.trans)); return; }
  if (msg.type !== 'tile') return;
  const t0 = performance.now();
  try {
    const res = await fetch(msg.url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${msg.url}`);
    const ds = res.body.pipeThrough(new DecompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(ds).arrayBuffer());
    const tile = decodeTile(buf);
    const t1 = performance.now();
    const out = mesh(tile);
    const heights = msg.wantHeights ? topHeights(tile) : null;
    const transfer = [out.opaque.buffer, out.trans.buffer, out.pattern.buffer];
    if (heights) transfer.push(heights.buffer);
    self.postMessage({ type: 'mesh', id: msg.id, key: msg.key, lod: tile.lod, n: tile.n, ymin: tile.ymin, ymax: tile.ymax,
      opaque: out.opaque, nOpaque: out.nOpaque, trans: out.trans, nTrans: out.nTrans, pattern: out.pattern, patLen: out.patLen,
      heights, bytes: buf.length, msDecode: t1 - t0, msMesh: performance.now() - t1 }, transfer);
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, key: msg.key, error: String(err && err.message || err) });
  }
};

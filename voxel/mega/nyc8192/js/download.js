// Downloads: static model (browser-side bundle of all LOD0 tiles), actor paths, generator source (tar).

function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

// Container "NYC8192M": 8-byte magic, u32 version, u32 index bytes, JSON index, then the tile files
// (each is the gzip'ed column-interval tile documented in README.md) concatenated in index order.
export async function downloadModel(manifest, progress) {
  const L = manifest.lods.find((l) => l.lod === 0);
  const keys = Object.keys(L.tiles);
  const blobs = new Array(keys.length);
  let done = 0, bytes = 0, next = 0;
  const worker = async () => {
    while (next < keys.length) {
      const k = next++;
      const r = await fetch(`./data/${L.dir}/${keys[k]}.bin`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      blobs[k] = new Uint8Array(await r.arrayBuffer());
      done++; bytes += blobs[k].length;
      if (done % 16 === 0) progress(`打包静态模型… ${done}/${keys.length} 块 · ${(bytes / 1048576).toFixed(1)} MB`);
    }
  };
  progress('打包静态模型…');
  await Promise.all(Array.from({ length: 6 }, worker));
  let off = 0;
  const index = { format: 'NYC8192M', version: 1, grid: manifest.grid, voxel_m: 1, sea: manifest.sea, tile: 256, lod: 0,
    note: 'Each entry is a gzip-compressed NYT1 column-interval tile (see README.md): 258x258 columns incl. 1-column border.',
    palette: manifest.palette, stats: manifest.stats, tiles: {} };
  keys.forEach((k, i) => { index.tiles[k] = [off, blobs[i].length]; off += blobs[i].length; });
  const js = new TextEncoder().encode(JSON.stringify(index));
  const head = new Uint8Array(16);
  head.set(new TextEncoder().encode('NYC8192M'));
  const dv = new DataView(head.buffer); dv.setUint32(8, 1, true); dv.setUint32(12, js.length, true);
  save(new Blob([head, js, ...blobs], { type: 'application/octet-stream' }), 'nyc8192-static-model.bin');
  progress(`静态模型已打包：${keys.length} 块 · ${(bytes / 1048576).toFixed(1)} MB`);
}

export function downloadActors() {
  const a = document.createElement('a'); a.href = './life/actors.json'; a.download = 'nyc8192-actor-paths.json';
  document.body.appendChild(a); a.click(); a.remove();
}

// minimal ustar writer
function tar(files) {
  const enc = new TextEncoder(), parts = [];
  const oct = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0';
  for (const [name, data] of files) {
    const h = new Uint8Array(512);
    const put = (s, o) => h.set(enc.encode(s), o);
    put(name, 0); put(oct(0o644, 8), 100); put(oct(0, 8), 108); put(oct(0, 8), 116); put(oct(data.length, 12), 124);
    put(oct(Math.floor(Date.now() / 1000), 12), 136); put('        ', 148); h[156] = 48; put('ustar\0', 257); put('00', 263);
    let sum = 0; for (let i = 0; i < 512; i++) sum += h[i];
    put(oct(sum, 7) + ' ', 148);
    parts.push(h, data);
    const pad = (512 - (data.length % 512)) % 512; if (pad) parts.push(new Uint8Array(pad));
  }
  parts.push(new Uint8Array(1024));
  return new Blob(parts, { type: 'application/x-tar' });
}

export async function downloadSource(progress) {
  const list = await (await fetch('./src/FILES.json')).json();
  progress('打包生成器源码…');
  const files = [];
  for (const f of list) { const r = await fetch(`./${f}`); files.push([`nyc8192/${f}`, new Uint8Array(await r.arrayBuffer())]); }
  save(tar(files), 'nyc8192-generator-src.tar');
  progress(`生成器源码已打包：${files.length} 个文件`);
}

// Quadtree LOD tile manager: LOD3 (2048 m, 8 m columns) ... LOD0 (256 m, 1 m columns).
// Tiles refine when their columns would cover more than `pxPerCell` pixels on screen, with hysteresis.
import * as THREE from 'three';
import { makeTileMaterial, quadGeometry, patternTexture } from './voxelmat.js';

const TILE = 256;

export class TileManager {
  constructor({ scene, manifest, base, nWorkers = 4, quadBudget = 9e6 }) {
    this.scene = scene; this.manifest = manifest; this.base = base;
    this.group = new THREE.Group(); scene.add(this.group);
    this.nodes = new Map();
    this.pxPerCell = 3.2;
    this.quadBudget = quadBudget;
    this.loadedQuads = 0;
    this.pending = new Map();
    this.queue = [];
    this.stats = { requested: 0, loaded: 0, failed: 0, bytes: 0, shownQuads: 0, shownTiles: 0, byLod: [0, 0, 0, 0, 0] };
    this.frame = 0;
    this.jobId = 1;
    this.errors = [];
    const trans = new Uint8Array(256);
    for (const p of manifest.palette) if (p.flags.includes('T')) trans[p.id] = 1;
    this.workers = [];
    this.free = [];
    for (let i = 0; i < nWorkers; i++) {
      const w = new Worker(new URL('./mesher.worker.js', import.meta.url), { type: 'module' });
      w.postMessage({ type: 'init', trans });
      w.onmessage = (e) => this.onResult(w, e.data);
      w.onerror = (e) => { e.preventDefault(); this.errors.push(`worker: ${e.message}`); };
      this.workers.push(w); this.free.push(w);
    }
    // nodes
    for (const L of manifest.lods) {
      for (const [key, v] of Object.entries(L.tiles)) {
        const [tx, tz] = key.split('_').map(Number);
        const size = TILE * L.cell;
        this.nodes.set(`${L.lod}/${key}`, { lod: L.lod, tx, tz, cell: L.cell, x0: tx * size, z0: tz * size, size, bytes: v[0], ymin: v[1], ymax: v[2],
          state: 0, mesh: null, meshT: null, quads: 0, lastShown: -1, heights: null, key: `${L.lod}/${key}`, url: `${base}${L.dir}/${key}.bin` });
      }
    }
    this.maxLod = Math.max(...manifest.lods.map((l) => l.lod));
    this.roots = [...this.nodes.values()].filter((n) => n.lod === this.maxLod);
    this.box = new THREE.Box3();
    this.frustum = new THREE.Frustum();
    this.mat4 = new THREE.Matrix4();
    this.v = new THREE.Vector3();
  }
  child(n, i, j) { return this.nodes.get(`${n.lod - 1}/${n.tx * 2 + i}_${n.tz * 2 + j}`); }
  kids(n) { if (n.lod === 0) return []; if (!n._kids) n._kids = [this.child(n, 0, 0), this.child(n, 1, 0), this.child(n, 0, 1), this.child(n, 1, 1)].filter(Boolean); return n._kids; }

  request(n, prio) {
    if (n.state !== 0) return;
    n.state = 1; n.prio = prio;
    this.queue.push(n);
  }
  pump() {
    if (!this.free.length || !this.queue.length) return;
    this.queue.sort((a, b) => a.prio - b.prio);
    while (this.free.length && this.queue.length) {
      const n = this.queue.shift();
      if (n.state !== 1) continue;
      const w = this.free.pop();
      const id = this.jobId++;
      this.pending.set(id, n);
      this.stats.requested++;
      w.postMessage({ type: 'tile', id, key: n.key, url: new URL(n.url, location.href).href, wantHeights: true });
    }
  }
  onResult(w, r) {
    this.free.push(w);
    const n = this.pending.get(r.id); this.pending.delete(r.id);
    if (!n) return;
    if (r.type === 'error') { n.state = 3; this.stats.failed++; this.errors.push(`${n.key}: ${r.error}`); this.pump(); return; }
    this.stats.loaded++; this.stats.bytes += r.bytes;
    const tex = patternTexture(r.pattern, r.patLen);
    const mk = (buf, cnt, transparent) => {
      const g = quadGeometry(buf, cnt);
      g.boundingBox = new THREE.Box3(new THREE.Vector3(0, r.ymin, 0), new THREE.Vector3(TILE + 2, r.ymax + 1, TILE + 2));
      g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
      const m = new THREE.Mesh(g, makeTileMaterial(tex, n.cell, transparent));
      m.position.set(n.x0, 0, n.z0); m.scale.set(n.cell, 1, n.cell);
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.visible = false;
      if (transparent) m.renderOrder = 10;
      this.group.add(m);
      return m;
    };
    n.mesh = r.nOpaque ? mk(r.opaque, r.nOpaque, false) : null;
    n.meshT = r.nTrans ? mk(r.trans, r.nTrans, true) : null;
    n.tex = tex;
    n.quads = r.nOpaque + r.nTrans;
    n.heights = r.heights;
    n.state = 2;
    this.loadedQuads += n.quads;
    this.dirty = true;
    this.pump();
  }
  dispose(n) {
    for (const m of [n.mesh, n.meshT]) if (m) { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); }
    if (n.tex) n.tex.dispose();
    n.mesh = n.meshT = n.tex = null; n.heights = null;
    this.loadedQuads -= n.quads; n.quads = 0; n.state = 0;
  }

  // distance from camera to node AABB
  dist(n, cam) {
    const p = cam.position;
    const dx = Math.max(n.x0 - p.x, 0, p.x - (n.x0 + n.size));
    const dz = Math.max(n.z0 - p.z, 0, p.z - (n.z0 + n.size));
    const dy = Math.max(n.ymin - p.y, 0, p.y - n.ymax);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  inFrustum(n) {
    this.box.min.set(n.x0, n.ymin, n.z0); this.box.max.set(n.x0 + n.size, n.ymax + 1, n.z0 + n.size);
    return this.frustum.intersectsBox(this.box);
  }

  update(camera, viewportH) {
    this.frame++;
    this.mat4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.mat4);
    const k = viewportH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const show = [];
    const wantRefine = (n) => {
      if (n.lod === 0) return false;
      if (!this.inFrustum(n)) return false;
      const d = Math.max(1, this.dist(n, camera));
      const px = n.cell * k / d;
      const thr = n.refined ? this.pxPerCell * 0.78 : this.pxPerCell;
      return px > thr;
    };
    const visit = (n) => {
      const want = wantRefine(n);
      n.refined = false;
      if (want) {
        const ks = this.kids(n);
        let ready = ks.length > 0;
        for (const c of ks) { if (c.state !== 2) { ready = false; this.request(c, (this.maxLod - c.lod) * 1e7 + this.dist(c, camera)); } }
        if (ready) { n.refined = true; for (const c of ks) visit(c); return; }
      }
      if (n.state === 2) { show.push(n); return; }
      this.request(n, (this.maxLod - n.lod) * 1e7 + this.dist(n, camera) - 5e7);
      // fall back to loaded children
      const ks = this.kids(n);
      if (ks.length && ks.every((c) => c.state === 2)) for (const c of ks) show.push(c);
    };
    for (const r of this.roots) visit(r);
    // apply visibility
    let quads = 0; const byLod = [0, 0, 0, 0, 0];
    for (const n of this.nodes.values()) {
      if (n.state !== 2) continue;
      const vis = n._shownFrame === this.frame;
      void vis;
    }
    for (const n of show) { n._shownFrame = this.frame; n.lastShown = this.frame; }
    for (const n of this.nodes.values()) {
      if (n.state !== 2) continue;
      const vis = n._shownFrame === this.frame;
      if (n.mesh) n.mesh.visible = vis;
      if (n.meshT) n.meshT.visible = vis;
      if (vis) { quads += n.quads; byLod[n.lod]++; }
    }
    this.stats.shownQuads = quads; this.stats.shownTiles = show.length; this.stats.byLod = byLod;
    // evict fine tiles beyond budget
    if (this.loadedQuads > this.quadBudget) {
      const cand = [...this.nodes.values()].filter((n) => n.state === 2 && n.lod <= 1 && n._shownFrame !== this.frame).sort((a, b) => a.lastShown - b.lastShown);
      for (const n of cand) { if (this.loadedQuads <= this.quadBudget * 0.85) break; this.dispose(n); }
    }
    // cancel queued requests that are no longer needed (keep coarse)
    this.queue = this.queue.filter((n) => { if (n.lod >= 2 || this.frame - (n.reqFrame || this.frame) < 2) return true; return true; });
    this.pump();
    return show;
  }
  idle() { return this.pending.size === 0 && this.queue.length === 0; }

  // height of the tallest column at world (x, z) from the finest loaded tile
  heightAt(x, z) {
    for (let lod = 0; lod <= 4; lod++) {
      const size = TILE << lod;
      const n = this.nodes.get(`${lod}/${Math.floor(x / size)}_${Math.floor(z / size)}`);
      if (!n || !n.heights) continue;
      const cx = Math.floor((x - n.x0) / n.cell), cz = Math.floor((z - n.z0) / n.cell);
      if (cx < 0 || cz < 0 || cx >= TILE || cz >= TILE) continue;
      return n.heights[cz * TILE + cx];
    }
    return 24;
  }
  // ray march against loaded heights; returns world point or null
  pick(origin, dir, maxDist = 30000) {
    let t = 0, step = 1;
    const p = new THREE.Vector3();
    let prevAbove = true;
    while (t < maxDist) {
      p.copy(origin).addScaledVector(dir, t);
      if (p.x < 0 || p.z < 0 || p.x >= 8192 || p.z >= 8192) {
        if ((dir.x > 0 && p.x > 8192) || (dir.x < 0 && p.x < 0) || (dir.z > 0 && p.z > 8192) || (dir.z < 0 && p.z < 0)) { if (t > 50) break; }
        t += step; step = Math.min(64, step * 1.08); continue;
      }
      const h = this.heightAt(p.x, p.z);
      const above = p.y > h;
      if (!above && prevAbove) {
        // refine
        let a = Math.max(0, t - step), b = t;
        for (let i = 0; i < 12; i++) { const mid = (a + b) / 2; p.copy(origin).addScaledVector(dir, mid); if (p.y > this.heightAt(p.x, p.z)) a = mid; else b = mid; }
        return p.copy(origin).addScaledVector(dir, b).clone();
      }
      prevAbove = above;
      t += step; step = Math.min(24, step * 1.05);
    }
    return null;
  }
}

// A fixed pool of point lights handed to whichever lamps, lanterns and neon signs are
// near the camera. The light count never changes (no shader recompiles); sources fade
// in and out at the edge of the view. Two pool lights cast shadows and follow the
// overhead lamps closest to the cat, so its shadow swings as it passes under them.

import * as THREE from 'three';

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class LightPool {
  constructor(scene, count = 8, shadowCount = 2, shadowSize = 512) {
    this.lights = [];
    this.slots = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      if (i < shadowCount) {
        l.castShadow = true;
        l.shadow.mapSize.set(shadowSize, shadowSize);
        l.shadow.camera.near = 0.08;
        l.shadow.camera.far = 14;
        l.shadow.bias = -0.004;
        l.shadow.radius = 4;
      }
      scene.add(l);
      this.lights.push(l);
      this.slots.push(null);
    }
    this.shadowCount = shadowCount;
  }

  flicker(s, t) {
    if (!s.flicker) return 1;
    if (s.kind === 'neon') {
      const k = Math.sin(t * 1.3 + s.phase * 7);
      return k > 0.985 ? 0.25 : 1 - 0.04 * Math.sin(t * 37 + s.phase);
    }
    return 1 + s.flicker * (0.55 * Math.sin(t * 11.3 + s.phase) + 0.35 * Math.sin(t * 23.7 + s.phase * 2.1) + 0.25 * Math.sin(t * 5.1 + s.phase * 3.3));
  }

  update(sources, camX, catX, catY, t) {
    const regular = this.lights.length - this.shadowCount;
    // Shadow slots: nearest shadow-casting lamps to the cat, by parity so neighbours never fight.
    const shadowPick = new Array(this.shadowCount).fill(null);
    for (const s of sources) {
      if (!s.shadow || !s.on) continue;
      const d = Math.abs(s.x - catX);
      if (d > 8.5) continue;
      const slot = s.shadowSlot % this.shadowCount;
      if (!shadowPick[slot] || d < Math.abs(shadowPick[slot].x - catX)) shadowPick[slot] = s;
    }
    const used = new Set(shadowPick.filter(Boolean));
    for (let i = 0; i < this.shadowCount; i++) {
      const l = this.lights[i];
      const s = shadowPick[i];
      if (!s) { l.intensity = 0; l.shadow.intensity = 0; continue; }
      l.position.set(s.x, s.y, s.z);
      l.color.copy(s.color);
      l.distance = s.distance;
      const view = smoothstep(13.5, 9.5, Math.abs(s.x - camX));
      l.intensity = s.intensity * s.level * this.flicker(s, t) * view;
      l.shadow.intensity = 0.85 * smoothstep(8.5, 5.5, Math.abs(s.x - catX));
    }
    // Regular slots: strongest remaining sources by view weight, sticky assignment.
    const cand = [];
    for (const s of sources) {
      if (!s.on || used.has(s)) continue;
      const d = Math.abs(s.x - camX);
      if (d > 13.5) continue;
      s._w = smoothstep(13.5, 9.5, d);
      s._score = s._w * s.intensity * s.level * (s.priority || 1);
      if (s._score > 0.001) cand.push(s);
    }
    cand.sort((a, b) => b._score - a._score);
    const chosen = new Set(cand.slice(0, regular));
    for (let i = this.shadowCount; i < this.lights.length; i++) {
      if (this.slots[i] && !chosen.has(this.slots[i])) this.slots[i] = null;
    }
    for (const s of chosen) {
      if (this.slots.includes(s)) continue;
      for (let i = this.shadowCount; i < this.lights.length; i++) {
        if (!this.slots[i]) { this.slots[i] = s; break; }
      }
    }
    for (let i = this.shadowCount; i < this.lights.length; i++) {
      const l = this.lights[i];
      const s = this.slots[i];
      if (!s) { l.intensity = 0; continue; }
      l.position.set(s.x, s.y, s.z);
      l.color.copy(s.color);
      l.distance = s.distance;
      l.intensity = s.intensity * s.level * s._w * this.flicker(s, t);
    }
  }
}

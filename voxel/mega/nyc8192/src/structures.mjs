// Structures emitted as column runs by the chunk workers: landmarks, bridges, piers' sheds, props.
// Each structure has a bounding box in voxel (x, z) and emits runs for the columns of a region.
import { W, SEA } from './frame.mjs';
import { landmarkList } from './landmarks.mjs';
import { bridgeList } from './bridges.mjs';

export const MODE_FILL = 0, MODE_OVER = 1, MODE_CLEAR = 2;

// Implicit solid: f(u, h, w) -> material (0 empty) in a local frame (u along `dir`, w across, h up from base).
// Evaluated at voxel centres; runs are emitted per column in OVERRIDE mode.
export function solid({ x, z, dir = [1, 0], base, height, hu, hw, f, mode = MODE_OVER, name, groundY = null }) {
  const ux = dir[0], uz = dir[1], wx = -uz, wz = ux;
  const r = Math.hypot(hu, hw) + 1;
  const bbox = [Math.floor(x - r), Math.floor(z - r), Math.ceil(x + r), Math.ceil(z + r)];
  return {
    name, bbox,
    emit(X0, Z0, R, add) {
      const xa = Math.max(bbox[0], X0), xb = Math.min(bbox[2], X0 + R - 1), za = Math.max(bbox[1], Z0), zb = Math.min(bbox[3], Z0 + R - 1);
      let n = 0;
      for (let zz = za; zz <= zb; zz++) for (let xx = xa; xx <= xb; xx++) {
        const px = xx + 0.5 - x, pz = zz + 0.5 - z;
        const u = px * ux + pz * uz, w = px * wx + pz * wz;
        if (Math.abs(u) > hu + 0.5 || Math.abs(w) > hw + 0.5) continue;
        let y = 0, cur = 0, start = 0;
        for (y = 0; y <= height; y++) {
          const m = y < height ? f(u, y + 0.5, w) : 0;
          if (m !== cur) {
            if (cur) {
              let y0 = base + start;
              if (start === 0 && groundY) { const g = groundY(xx, zz); if (g < y0) y0 = g; }
              add(xx - X0, zz - Z0, y0, base + y, cur, mode); n++;
            }
            cur = m; start = y;
          }
        }
      }
      return n;
    },
  };
}

export function makeStructures(maps, data) {
  const list = [...landmarkList(maps, data), ...bridgeList(maps, data)];
  return {
    list,
    emit(X0, Z0, R, add) {
      let n = 0;
      for (const s of list) {
        const b = s.bbox;
        if (b[2] < X0 || b[0] > X0 + R - 1 || b[3] < Z0 || b[1] > Z0 + R - 1) continue;
        n += s.emit(X0, Z0, R, add) || 0;
      }
      return n;
    },
  };
}
export { W, SEA };

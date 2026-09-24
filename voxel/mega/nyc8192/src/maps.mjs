// Builds all global maps in order and finalises surface materials.
import { W } from './frame.mjs';
import { M, MATERIALS } from './palette.mjs';
import { hash2 } from './raster.mjs';
import { polySpans, setSpanIf } from './raster.mjs';
import { Z } from './geo.mjs';
import {
  U, createMaps, buildLand, buildPiers, buildWaterDepth, buildElevation, rasterDistricts, rasterParks,
  gridStreets, districtStreets, namedStreets, rasterStreets,
} from './city.mjs';
import { buildCentralPark, pedestrianPlazas } from './cp.mjs';

export function buildMaps(log = () => {}) {
  const t0 = Date.now();
  const m = createMaps();
  buildLand(m, log);
  buildWaterDepth(m, log);
  m.piers = buildPiers(m);
  buildElevation(m, log);
  rasterDistricts(m);
  rasterParks(m);
  m.cp = buildCentralPark(m);
  const streets = [];
  gridStreets(m, streets);
  districtStreets(m, streets);
  namedStreets(m, streets);
  rasterStreets(m, streets, log);
  m.streets = streets;
  for (const [, poly] of pedestrianPlazas()) {
    if (!poly) continue;
    polySpans(poly, setSpanIf(m.use, U.PLAZA, (i) => m.zone[i] === Z.MN));
  }
  finaliseSurfaces(m);
  log(`maps built in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${streets.length} street polylines`);
  return m;
}

export function finaliseSurfaces(m) {
  const { use, surf, zone } = m;
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
    const i = z * W + x, zn = zone[i];
    if (zn === Z.WATER) { surf[i] = M.water; continue; }
    const u = use[i];
    switch (u) {
      case U.ROAD: case U.HWY: case U.WALK: if (!surf[i]) surf[i] = M.asphalt; break;
      case U.PARK: surf[i] = hash2(x >> 2, z >> 2, 7) < 0.12 ? M.grass_dry : M.grass; break;
      case U.WOODS: surf[i] = hash2(x, z, 8) < 0.3 ? M.mulch : M.grass; break;
      case U.LAWN: surf[i] = M.grass_lawn; break;
      case U.FIELD: if (surf[i] !== M.infield && surf[i] !== M.white) surf[i] = M.turf; break;
      case U.ROCK: surf[i] = hash2(x, z, 9) < 0.35 ? M.rock_dark : M.rock; break;
      case U.PATH: surf[i] = M.asphalt_old; break;
      case U.DRIVE: surf[i] = M.asphalt; break;
      case U.PLAZA: surf[i] = ((x % 7) === 0 || (z % 7) === 0) ? M.plaza_dark : (hash2(x >> 2, z >> 2, 11) < 0.12 ? M.sidewalk : M.plaza); break;
      case U.RINK: surf[i] = M.ice; break;
      case U.POND: surf[i] = M.pond; break;
      case U.PIER: surf[i] = M.planks; break;
      default: surf[i] = zn === Z.PIER ? M.planks : M.concrete;
    }
  }
}

// top-down preview (scale s) coloured by surface material
export function previewRGB(m, s = 4, extra = null) {
  const w = W / s, rgb = new Uint8Array(w * w * 3);
  const pal = MATERIALS.map(([, c]) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
  for (let pz = 0; pz < w; pz++) for (let px = 0; px < w; px++) {
    let r = 0, g = 0, b = 0;
    for (let dz = 0; dz < s; dz++) for (let dx = 0; dx < s; dx++) {
      const x = px * s + dx, z = pz * s + dz, i = z * W + x;
      let c = pal[(m.surf[i] || M.concrete) - 1];
      let k = 1;
      if (m.zone[i] === Z.WATER) k = 1.25 - m.depth[i] / 30;
      else k = 0.75 + Math.min(m.elev[i], 60) / 120;
      if (extra) { const e = extra(i, x, z); if (e) { c = e[0]; k = e[1]; } }
      r += c[0] * k; g += c[1] * k; b += c[2] * k;
    }
    const n = s * s, o = (pz * w + px) * 3;
    rgb[o] = Math.min(255, r / n); rgb[o + 1] = Math.min(255, g / n); rgb[o + 2] = Math.min(255, b / n);
  }
  return { w, rgb };
}

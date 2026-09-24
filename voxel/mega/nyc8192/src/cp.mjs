// Central Park (59th St to the frame corner near 74th St) and Manhattan's small squares.
import { W, mg, xz2mg, sOf } from './frame.mjs';
import { M } from './palette.mjs';
import { polySpans, plineSpans, ellipse, smoothClosed, smoothOpen, setSpanIf, hash2, fbm, vnoise, clamp, smooth, lerp } from './raster.mjs';
import { U } from './city.mjs';
import { Z } from './geo.mjs';

const G = (arr) => { const o = []; for (let i = 0; i < arr.length; i += 2) o.push(mg(arr[i], arr[i + 1])); return o; };
export const CP_E0 = -862.75, CP_E1 = -15.25, CP_N0 = 59 + 15.25 / 81.6;

export const CP = {
  bounds: G([CP_E0, CP_N0, CP_E1, CP_N0, CP_E1, 110, CP_E0, 110]),
  pond: smoothClosed(G([-62, 59.62, -120, 59.58, -190, 59.65, -245, 59.85, -262, 60.3, -235, 60.72, -200, 60.9, -165, 61.25,
    -128, 61.35, -95, 61.05, -70, 60.55, -50, 60.1]), 5),
  hallett: G([-300, 60.6, -240, 60.8, -200, 61.0, -170, 61.35, -175, 61.9, -240, 62.0, -300, 61.6]),
  wollman: G([-405, 61.95, -330, 61.95, -330, 62.62, -405, 62.62]),
  zoo: G([-190, 63.25, -28, 63.25, -28, 65.15, -190, 65.15]),
  heckscher: G([-735, 62.45, -525, 62.45, -525, 64.95, -735, 64.95]),
  sheep: smoothClosed(G([-735, 66.05, -600, 65.95, -485, 66.2, -470, 67.6, -490, 69.2, -600, 69.35, -720, 69.2, -745, 67.6]), 4),
  lake: smoothClosed(G([-330, 73.25, -385, 72.98, -445, 72.98, -520, 73.12, -600, 73.55, -680, 74.25, -760, 75.25, -800, 76.3,
    -740, 76.65, -650, 75.85, -560, 75.35, -505, 74.7, -470, 75.25, -420, 75.65, -350, 75.05, -305, 74.25]), 4),
  conservatory: G([-175, 74.2, -95, 74.2, -95, 75.2, -175, 75.2]),
  mall: G([-402, 66.25, -390, 66.25, -392, 71.85, -404, 71.85]),
  terrace: G([-445, 72.02, -355, 72.02, -355, 72.62, -445, 72.62]),
  fountain: mg(-400, 72.78),
  cherryHill: mg(-522, 72.55),
  rumsey: G([-360, 70.1, -290, 70.1, -290, 70.9, -360, 70.9]),
  drives: [
    smoothOpen(G([-610, 59.2, -640, 60.3, -700, 61.5, -765, 62.6, -805, 63.9, -812, 65.4, -800, 67.0, -792, 69.0, -790, 72.0, -782, 74.5, -775, 78])),
    smoothOpen(G([-305, 59.2, -318, 60.3, -345, 61.3, -392, 61.75, -452, 62.6, -470, 63.5, -448, 64.6, -405, 65.0, -330, 64.7, -255, 64.5])),
    smoothOpen(G([-700, 61.5, -610, 61.55, -520, 61.8, -452, 62.6])),
    smoothOpen(G([-18, 60.05, -95, 61.6, -168, 62.35, -228, 63.3, -250, 64.5, -250, 65.5, -242, 67.0, -238, 69.0, -230, 71.5, -228, 72.3, -222, 74.5, -215, 78])),
    smoothOpen(G([-862, 72.0, -790, 72.1, -650, 72.3, -540, 72.05, -445, 71.97, -330, 72.0, -230, 72.3, -15, 72.0])),
  ],
  transverse65: G([-870, 65.45, -8, 65.45]),
  paths: [
    smoothOpen(G([-860, 59.4, -760, 60.6, -640, 61.9, -560, 63.1, -490, 64.2, -430, 65.1, -400, 66.2])),     // Columbus Circle -> Mall
    smoothOpen(G([-30, 59.45, -60, 61.4, -140, 62.9, -260, 63.2, -380, 63.6, -420, 64.4])),                   // Grand Army Plaza -> Dairy
    smoothOpen(G([-420, 64.4, -470, 64.75, -520, 65.2])),
    smoothOpen(G([-745, 67.6, -760, 65.9, -600, 65.75, -470, 66.0, -455, 67.6, -470, 69.4, -600, 69.6, -730, 69.4, -760, 68.4])), // around Sheep Meadow
    smoothOpen(G([-392, 71.9, -440, 72.3, -520, 72.55, -600, 72.9, -700, 73.6, -790, 74.7])),                 // Bethesda -> west along the lake
    smoothOpen(G([-400, 72.62, -330, 72.9, -280, 73.6, -260, 74.6])),
    smoothOpen(G([-840, 60.0, -840, 64.0, -840, 68.5, -842, 73.5])),                                          // west perimeter
    smoothOpen(G([-38, 62.0, -38, 66.0, -36, 70.0, -36, 74.0])),                                              // east perimeter
    smoothOpen(G([-80, 59.5, -300, 59.45, -560, 59.45, -820, 59.45])),                                        // south perimeter
    smoothOpen(G([-600, 61.55, -620, 63.8, -700, 65.1])),
    smoothOpen(G([-250, 66.0, -330, 67.5, -390, 68.5])),
    smoothOpen(G([-230, 69.2, -300, 69.8, -360, 70.0])),
    smoothOpen(G([-540, 69.6, -560, 71.2, -522, 72.4])),
  ],
  rocks: [[-545, 62.25, 30, 20, 7], [-150, 66.8, 26, 18, 5], [-640, 70.5, 30, 20, 6], [-275, 68.6, 22, 16, 5], [-705, 64.9, 16, 12, 4],
    [-280, 61.1, 24, 16, 5], [-455, 69.9, 18, 14, 4], [-820, 70.8, 16, 12, 4], [-120, 70.5, 22, 18, 5], [-350, 67.3, 18, 12, 4]],
  woodsAreas: [
    G([-300, 60.6, -240, 60.8, -200, 61.0, -170, 61.35, -175, 61.9, -240, 62.0, -300, 61.6]),              // Hallett
    G([-780, 69.6, -700, 69.8, -640, 71.0, -700, 71.9, -790, 71.8]),                                        // near West Drive
    G([-120, 67.0, -60, 67.0, -45, 71.5, -150, 71.5, -210, 69.5]),                                          // east side woodland
    G([-640, 59.5, -520, 59.5, -520, 61.3, -640, 61.2]),
  ],
  pondY: 20, lakeY: 22, consY: 25,
};

// Mark Central Park in the maps. Must run after buildElevation.
export function buildCentralPark(m) {
  const { use, surf, elev, zone, pondY } = m;
  const inCP = (i) => zone[i] === Z.MN;
  polySpans(CP.bounds, setSpanIf(use, U.PARK, inCP));
  // base terrain: rolling schist landscape around 24-30 m
  polySpans(CP.bounds, (z, a, b) => {
    for (let x = a; x <= b; x++) {
      const i = z * W + x; if (!inCP(i)) continue;
      const [e, n] = xz2mg(x + 0.5, z + 0.5);
      let h = 25 + (fbm(x, z, 160, 21, 3) - 0.5) * 9 + (fbm(x, z, 45, 23, 2) - 0.5) * 2;
      // edges meet the surrounding streets smoothly
      const de = Math.min(e - CP_E0, CP_E1 - e), dn = (n - CP_N0) * 81.6;
      const edge = smooth(0, 40, Math.min(de, dn));
      h = lerp(elev[i], h, edge);
      elev[i] = clamp(Math.round(h), 2, 60);
    }
  });
  const flatten = (poly, target, fall = 0) => polySpans(poly, (z, a, b) => { for (let x = a; x <= b; x++) { const i = z * W + x; if (inCP(i)) elev[i] = target + (fall ? Math.round((hash2(x, z, 5) - 0.5) * fall) : 0); } });
  // lawns and fields are graded flat
  flatten(CP.sheep, 26); polySpans(CP.sheep, setSpanIf(use, U.LAWN, inCP));
  flatten(CP.heckscher, 23); polySpans(CP.heckscher, setSpanIf(use, U.FIELD, inCP));
  { // five softball diamonds oriented toward the field centre
    const cen = mg(-630, 63.7);
    const plates = [mg(-728, 62.55), mg(-532, 62.55), mg(-728, 64.85), mg(-532, 64.85), mg(-630, 62.5)];
    polySpans(CP.heckscher, (z, a, b) => {
      for (let x = a; x <= b; x++) {
        const i = z * W + x; if (!inCP(i)) continue;
        for (const [hx, hz] of plates) {
          const ax = cen[0] - hx, az = cen[1] - hz, al = Math.hypot(ax, az);
          const dx = x + 0.5 - hx, dz = z + 0.5 - hz, r = Math.hypot(dx, dz);
          if (r > 34) continue;
          const c = (dx * ax + dz * az) / (al * r + 1e-6);
          if (c < 0.70) continue;
          const onLine = Math.abs(c - 0.7071) < 0.012 * 30 / Math.max(r, 3);
          if (onLine) { surf[i] = M.white; break; }
          if (r < 30 && (r > 20 || c < 0.76)) { surf[i] = M.infield; break; }
          if (r < 3) { surf[i] = M.infield; break; }
        }
      }
    });
  }
  flatten(CP.wollman, 22); polySpans(CP.wollman, setSpanIf(use, U.RINK, inCP));
  flatten(CP.zoo, 23); polySpans(CP.zoo, setSpanIf(use, U.PLAZA, inCP));
  flatten(CP.rumsey, 25); polySpans(CP.rumsey, setSpanIf(use, U.PLAZA, inCP));
  for (const w of CP.woodsAreas) polySpans(w, setSpanIf(use, U.WOODS, (i) => inCP(i) && use[i] === U.PARK));
  // rock outcrops
  for (const [e, n, rx, rz, h] of CP.rocks) {
    const [cx, cz] = mg(e, n);
    polySpans(ellipse(cx, cz, rx * 1.3, rz * 1.3, hash2(e, n, 1) * 3), (z, a, b) => {
      for (let x = a; x <= b; x++) {
        const i = z * W + x; if (!inCP(i) || use[i] !== U.PARK && use[i] !== U.WOODS) continue;
        const dx = (x + 0.5 - cx) / rx, dz = (z + 0.5 - cz) / rz, r = Math.sqrt(dx * dx + dz * dz);
        const bump = h * (1 - smooth(0.35, 1.3, r + (vnoise(x, z, 6, 9) - 0.5) * 0.5));
        if (bump > 0.6) { elev[i] += Math.round(bump); use[i] = U.ROCK; }
      }
    });
  }
  // water bodies: carve below the water line, shores slope in
  const pond = (poly, y) => {
    polySpans(poly, (z, a, b) => { for (let x = a; x <= b; x++) { const i = z * W + x; if (!inCP(i)) continue; use[i] = U.POND; pondY[i] = y; elev[i] = y - 2 - (hash2(x, z, 3) < 0.4 ? 1 : 0); } });
  };
  pond(CP.pond, CP.pondY); pond(CP.lake, CP.lakeY); pond(CP.conservatory, CP.consY);
  // shore band: bring nearby land down toward the water level
  shoreGrade(m, CP.pond, CP.pondY); shoreGrade(m, CP.lake, CP.lakeY);
  // the Mall, Bethesda Terrace, Cherry Hill
  flatten(CP.mall, 25); polySpans(CP.mall, setSpanIf(use, U.PLAZA, inCP));
  flatten(CP.terrace, 23); polySpans(CP.terrace, setSpanIf(use, U.PLAZA, inCP));
  polySpans(ellipse(CP.fountain[0], CP.fountain[1], 22, 22), (z, a, b) => { for (let x = a; x <= b; x++) { const i = z * W + x; if (inCP(i) && use[i] !== U.POND) { use[i] = U.PLAZA; elev[i] = 23; } } });
  polySpans(ellipse(CP.cherryHill[0], CP.cherryHill[1], 16, 16), setSpanIf(use, U.PLAZA, (i) => inCP(i) && use[i] !== U.POND));
  // 65th Street transverse: sunken road with stone walls
  plineSpans(CP.transverse65, 7, (z, a, b) => { for (let x = a; x <= b; x++) { const i = z * W + x; if (!inCP(i)) continue; use[i] = U.DRIVE; elev[i] = Math.max(2, 19); surf[i] = M.asphalt; } }, false);
  plineSpans(CP.transverse65, 8.2, (z, a, b) => { for (let x = a; x <= b; x++) { const i = z * W + x; if (!inCP(i) || use[i] === U.DRIVE) continue; use[i] = U.ROCK; elev[i] = Math.max(elev[i], 26); surf[i] = M.granite_gray; } }, false);
  // drives and paths
  for (const d of CP.drives) plineSpans(d, 5.5, (z, a, b) => { for (let x = a; x <= b; x++) { const i = z * W + x; if (!inCP(i) || use[i] === U.POND || (use[i] === U.DRIVE && elev[i] < 20)) continue; use[i] = U.DRIVE; } });
  for (const p of CP.paths) plineSpans(p, 2.2, (z, a, b) => { for (let x = a; x <= b; x++) { const i = z * W + x; if (!inCP(i) || use[i] === U.POND || use[i] === U.DRIVE) continue; if (use[i] !== U.PLAZA && use[i] !== U.FIELD && use[i] !== U.RINK) use[i] = U.PATH; } });
  // smooth the terrain under drives so they do not stair-step every metre
  return { drives: CP.drives, paths: CP.paths };
}

function shoreGrade(m, poly, y) {
  const { elev, use, zone } = m;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const R = 14;
  x0 = Math.max(0, Math.floor(x0 - R)); x1 = Math.min(W - 1, Math.ceil(x1 + R)); z0 = Math.max(0, Math.floor(z0 - R)); z1 = Math.min(W - 1, Math.ceil(z1 + R));
  const w = x1 - x0 + 1, h = z1 - z0 + 1, d = new Float32Array(w * h).fill(1e9);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (use[z * W + x] === U.POND) d[(z - z0) * w + (x - x0)] = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      const i = z * w + x; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1); if (z > 0) v = Math.min(v, d[i - w] + 1);
      if (x > 0 && z > 0) v = Math.min(v, d[i - w - 1] + 1.414); if (x < w - 1 && z > 0) v = Math.min(v, d[i - w + 1] + 1.414);
      d[i] = v;
    }
    for (let z = h - 1; z >= 0; z--) for (let x = w - 1; x >= 0; x--) {
      const i = z * w + x; let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1); if (z < h - 1) v = Math.min(v, d[i + w] + 1);
      if (x < w - 1 && z < h - 1) v = Math.min(v, d[i + w + 1] + 1.414); if (x > 0 && z < h - 1) v = Math.min(v, d[i + w - 1] + 1.414);
      d[i] = v;
    }
  }
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const i = z * W + x, dd = d[(z - z0) * w + (x - x0)];
    if (dd <= 0 || dd > R || zone[i] !== Z.MN) continue;
    const target = y + 1 + dd * 0.45;
    if (elev[i] > target) elev[i] = Math.round(target);
    if (elev[i] < y + 1) elev[i] = y + 1;
  }
}

// Manhattan squares with plazas: return polygons for plaza surfaces (Times Square etc.)
// Broadway centreline in grid coordinates (e as a function of street number) for 10th..79th St
const BWAY = [[10, 345], [14, 230], [17, 165], [22.1, 55], [23.1, 18], [25, -38], [34.6, -305], [45.2, -610], [59, -878], [65.5, -1146], [72, -1414], [79, -1470]];
export function broadwayE(n) {
  if (n <= BWAY[0][0]) return BWAY[0][1];
  for (let i = 1; i < BWAY.length; i++) if (n <= BWAY[i][0]) { const [n0, e0] = BWAY[i - 1], [n1, e1] = BWAY[i]; return e0 + (e1 - e0) * (n - n0) / (n1 - n0); }
  return BWAY[BWAY.length - 1][1];
}
function bwayBand(n0, n1, hw) {
  const L = [], R = [];
  for (let n = n0; n <= n1 + 1e-6; n += 0.25) { const e = broadwayE(n); L.push(mg(e - hw, n)); R.push(mg(e + hw, n)); }
  return [...L, ...R.reverse()];
}
export function pedestrianPlazas() {
  return [
    ['Times Square', bwayBand(42.15, 47.1, 11)],
    ['Duffy Square', G([-640, 46.15, -610, 46.15, -648, 47.05, -672, 47.05])],
    ['Herald Square', bwayBand(33.2, 35.4, 10)],
    ['Greeley Square', G([-330, 32.2, -290, 32.2, -300, 33.0, -340, 33.0])],
    ['Flatiron Plaza', bwayBand(22.3, 24.6, 10)],
  ];
}

// Per-column voxel generator: terrain, water, piers and generic buildings.
// Writes materials into a dense column buffer col[y] (Uint8, 0 = air) and returns the column height.
import { W, SEA } from './frame.mjs';
import { M } from './palette.mjs';
import { Z } from './geo.mjs';
import { U } from './city.mjs';
import { BS, B, ROOF_WT, ROOF_BULK, ROOF_HVAC, ROOF_GREEN, ROOF_ANT, ROOF_CROWN } from './fabric.mjs';
import { STYLES } from './styles.mjs';

const hash = (x, z, s) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const SIGN = [M.sign_red, M.sign_blue, M.sign_yellow, M.sign_green, M.sign_white, M.awning_red, M.awning_green, M.awning_blue];
const TSQ = [M.sign_red, M.sign_blue, M.sign_magenta, M.sign_yellow, M.sign_cyan, M.sign_white, M.sign_green, M.sign_orange, M.sign_blue, M.sign_red];

export function makeColumnGen(maps, table) {
  const { zone, elev, depth, use, surf, bid, pondY } = maps;
  const T = table;

  // building height (m above GB) at column (x, z), and tier index
  function bHeight(b, x, z) {
    const o = b * BS;
    const px = x + 0.5 - T[o + B.OX], pz = z + 0.5 - T[o + B.OZ];
    const ux = T[o + B.UX], uz = T[o + B.UZ];
    const u = px * ux + pz * uz, w = -px * uz + pz * ux;
    let h = T[o + B.H];
    const nt = T[o + B.NT];
    for (let k = 0; k < nt; k++) {
      const ins = T[o + B.I1 + 2 * k];
      if (u >= T[o + B.U0] + ins && u < T[o + B.U1] - ins && w >= T[o + B.W0] + ins && w < T[o + B.W1] - ins) h = T[o + B.H1 + 2 * k];
    }
    return h;
  }
  function groundTop(i) {
    const zn = zone[i];
    if (zn === Z.WATER) return SEA;
    if (zn === Z.PIER) return SEA + 2;
    return SEA + elev[i];
  }
  function topAt(x, z) {
    if (x < 0 || z < 0 || x >= W || z >= W) return 0;
    const i = z * W + x, b = bid[i];
    if (b > 0) return T[b * BS + B.GB] + bHeight(b, x, z);
    return groundTop(i);
  }
  const STREETISH = new Uint8Array(32);
  for (const u of [U.ROAD, U.WALK, U.PLAZA, U.HWY]) STREETISH[u] = 1;

  return function gen(x, z, col) {
    const i = z * W + x, zn = zone[i];
    // ---------------- water and piers
    if (zn === Z.WATER || zn === Z.PIER) {
      const bed = SEA - depth[i];
      col.fill(M.bedrock, 0, bed - 2); col[bed - 2] = M.silt; col[bed - 1] = depth[i] < 6 ? M.sand : M.silt;
      col.fill(M.water, bed, SEA);
      if (zn === Z.PIER) {
        const kind = pondY[i];
        col[SEA] = 0;
        if (kind === 5) {                       // Little Island: undulating park deck on concrete tulips
          const dh = SEA + elev[i];
          if ((x % 9 === 0) && (z % 9 === 0)) { col.fill(M.concrete, bed, dh - 3); for (let y = dh - 3; y < dh; y++) col[y] = M.concrete; }
          col[dh - 2] = M.concrete; col[dh - 1] = surf[i] || M.grass;
          return dh;
        }
        col[SEA + 1] = surf[i] || M.planks;
        if ((x % 5 === 0) && (z % 5 === 0)) col.fill(M.wood_dark, bed, SEA + 1);
        if (kind === 1) {                       // covered pier shed
          const edge = zone[i - 1] !== Z.PIER || zone[i + 1] !== Z.PIER || zone[i - W] !== Z.PIER || zone[i + W] !== Z.PIER;
          const H = 16;
          for (let y = SEA + 2; y < SEA + H; y++) col[y] = edge ? ((y - SEA) % 5 === 3 || (y - SEA) % 5 === 4 ? M.glass_sky : M.metal_panel) : M.metal_panel;
          col[SEA + H] = edge ? M.metal_dark : M.roof_white;
          return SEA + H + 1;
        }
        if (kind === 3 && (x % 23 < 12) && (z % 17 < 9)) { for (let y = SEA + 2; y < SEA + 7; y++) col[y] = M.glass_sky; col[SEA + 7] = M.roof_white; return SEA + 8; }
        return SEA + 2;
      }
      return SEA;
    }
    // ---------------- land
    const G = SEA + elev[i];
    const rockTop = use[i] === U.ROCK ? G - 1 : Math.min(G - 1, SEA - 6);
    col.fill(M.bedrock, 0, Math.min(rockTop, SEA - 6));
    if (use[i] === U.ROCK) col.fill(M.schist, SEA - 6, G - 1); else col.fill(M.soil, SEA - 6, G - 1);
    col[G - 1] = surf[i] || M.concrete;
    let top = G;
    if (use[i] === U.POND) {
      const wy = SEA + pondY[i];
      col[G - 1] = M.silt;
      col.fill(M.pond, G, wy);
      return Math.max(G, wy);
    }
    const b = bid[i];
    if (b <= 0) return top;

    // ---------------- generic building
    const o = b * BS;
    const s = STYLES[T[o + B.STYLE]];
    const gb = T[o + B.GB];
    const hc = bHeight(b, x, z);
    const yTop = gb + hc;
    if (yTop <= G) return top;
    // local coords
    const px = x + 0.5 - T[o + B.OX], pz = z + 0.5 - T[o + B.OZ];
    const ux = T[o + B.UX], uz = T[o + B.UZ];
    const u = px * ux + pz * uz, w = -px * uz + pz * ux;
    // which tier rect contains this column (for facade side)
    let ins = 0;
    const nt = T[o + B.NT];
    for (let k = 0; k < nt; k++) {
      const ik = T[o + B.I1 + 2 * k];
      if (u >= T[o + B.U0] + ik && u < T[o + B.U1] - ik && w >= T[o + B.W0] + ik && w < T[o + B.W1] - ik) ins = ik;
    }
    const du0 = u - (T[o + B.U0] + ins), du1 = (T[o + B.U1] - ins) - u, dw0 = w - (T[o + B.W0] + ins), dw1 = (T[o + B.W1] - ins) - w;
    const dU = Math.min(du0, du1), dWd = Math.min(dw0, dw1);
    const along = dU < dWd ? w : u;
    const corner = dU < 1.2 && dWd < 1.2;
    // neighbour tops -> exposure
    const tN = topAt(x, z - 1), tS = topAt(x, z + 1), tE = topAt(x + 1, z), tWt = topAt(x - 1, z);
    let expo = Math.min(tN, tS, tE, tWt);
    const edgeTop = expo < yTop;                  // some side exposed at the roof line
    if (expo < G) expo = G;
    // faces a street for storefronts?
    const street = STREETISH[use[i - W]] || STREETISH[use[i + W]] || STREETISH[use[i + 1]] || STREETISH[use[i - 1]];
    const wall = s.wall, glass = s.glass, trim = s.trim;
    // interior fill (hidden)
    col.fill(wall, G, Math.min(expo, yTop));
    if (expo < yTop) {
      const bay = s.bay, pier = s.pier;
      let isPier = corner;
      if (!isPier && bay > 0) { const a = ((along % bay) + bay) % bay; isPier = a < pier; }
      const rows = s.rows, fh = s.floorH;
      const lobby = street ? (s.store ? 4 : (s.lobby || 4)) : 0;
      const crown = (T[o + B.ROOF] & ROOF_CROWN) ? 8 : 0;
      const hs = hash(Math.floor(along / 6), b, 3);
      const tsq = (T[o + B.FLAGS] & 2) !== 0, tsqTop = Math.min(hc - 4, 16 + Math.floor(hash(b, 1, 9) * 50));
      for (let y = expo; y < yTop; y++) {
        const ry = y - gb;
        let mat;
        if (ry < 0) mat = trim;
        else if (ry < lobby) {
          if (ry === 0) mat = s.modern ? M.granite_gray : trim;
          else if (s.store && ry === lobby - 1) mat = hs < 0.55 ? SIGN[(hs * 97 | 0) % SIGN.length] : trim;
          else mat = (isPier && !s.modern) ? wall : M.storefront;
        } else if (tsq && street && ry < tsqTop) {
          const pu = Math.floor(along / 13), pv = Math.floor((ry - 5) / 11);
          const fa = ((along % 13) + 13) % 13, fv = (ry - 5) % 11;
          mat = (fa < 0.8 || fv === 0) ? M.metal_dark : TSQ[Math.floor(hash(pu, pv, b) * TSQ.length)];
        } else if (crown && y >= yTop - crown) {
          mat = (ry % 2 === 0) ? trim : (isPier ? trim : glass);
        } else {
          const r = rows[ry % fh];
          mat = r === 1 ? (isPier ? wall : glass) : r === 2 ? trim : wall;
        }
        col[y] = mat;
      }
      if (s.cornice && hc < 80) col[yTop - 1] = s.cornice;
    }
    // roof
    const roofMat = (T[o + B.ROOF] & ROOF_GREEN) ? M.roof_green : s.roof;
    if (expo >= yTop) col[yTop - 1] = roofMat;   // interior roof cell
    top = yTop;
    if (edgeTop && hc >= 6) { col[yTop] = s.cornice || trim; top = yTop + 1; }  // parapet
    // ---------------- roof objects (only on the top tier)
    const roof = T[o + B.ROOF];
    const topTierIns = nt > 0 ? T[o + B.I1 + 2 * (nt - 1)] : 0;
    const onTop = nt === 0 || ins === topTierIns;
    if (!onTop || edgeTop) return top;
    if (roof & ROOF_BULK) {
      if (u >= T[o + B.BU0] && u < T[o + B.BU1] && w >= T[o + B.BW0] && w < T[o + B.BW1]) {
        const bh = T[o + B.BH];
        col.fill(s.modern ? M.metal_panel : (s.wall === M.limestone ? M.limestone : M.brick_dark), yTop, yTop + bh);
        col[yTop + bh - 1] = M.roof_tar;
        top = Math.max(top, yTop + bh);
        if ((roof & ROOF_ANT) && Math.abs(u - (T[o + B.BU0] + T[o + B.BU1]) / 2) < 0.8 && Math.abs(w - (T[o + B.BW0] + T[o + B.BW1]) / 2) < 0.8) {
          const sp = T[o + B.SPIRE];
          col.fill(M.antenna, yTop + bh, yTop + bh + sp);
          top = yTop + bh + sp;
        }
        return top;
      }
    }
    if (roof & ROOF_WT) {
      const du = u - T[o + B.WTU], dw = w - T[o + B.WTW], r = T[o + B.WTR];
      const d = Math.sqrt(du * du + dw * dw);
      if (d <= r) {
        const legH = 4, tankH = 6;
        const lx = Math.abs(Math.abs(du) - r * 0.55) < 0.55 && Math.abs(Math.abs(dw) - r * 0.55) < 0.55;
        if (lx) col.fill(M.steel_dark, yTop, yTop + legH);
        else if (d < 1.2) col.fill(M.steel_dark, yTop, yTop + 1);
        const t0 = yTop + legH;
        for (let y = t0; y < t0 + tankH; y++) col[y] = ((y - t0) % 3 === 2) ? M.steel_dark : M.wood_tank;
        let tt = t0 + tankH;
        if (d < r * 0.6) col[tt++] = M.roof_tar;
        if (d < 1.0) col[tt++] = M.roof_tar;
        return Math.max(top, tt);
      }
    }
    if (roof & ROOF_HVAC) {
      const cu = Math.floor(u / 5), cw = Math.floor(w / 5);
      const hv = hash(cu, cw, b);
      if (hv < 0.22) {
        const fu = u - cu * 5, fw = w - cw * 5;
        if (fu > 1 && fu < 3.5 && fw > 1 && fw < 4) {
          const hh = hv < 0.08 ? 2 : 1;
          col.fill(hv < 0.12 ? M.aluminum : M.metal_panel, yTop, yTop + hh);
          top = Math.max(top, yTop + hh);
        }
      }
    }
    return top;
  };
}

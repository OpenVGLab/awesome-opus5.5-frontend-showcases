// Hand-modelled landmarks as implicit solids. Local frame per landmark: a = metres along `dir`,
// b = metres to the left of `dir` (for grid buildings: a = grid-east, b = grid-north), h = metres above base.
// Heights follow published figures (roof / spire) at 1 m per voxel.
import { W, SEA, ll, mg, GRID_E, bearingXZ } from './frame.mjs';
import { M } from './palette.mjs';
import { solid, MODE_OVER } from './structures.mjs';
import { orect, ellipse } from './raster.mjs';

const GE = GRID_E;
const clampi = (v, a, b) => (v < a ? a : v > b ? b : v);
const hsh = (a, b, c) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul((c | 0) + 3, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------------------------------------------------------------------------------------------
// facade painter: surface voxels get storeys / piers; interior voxels get the wall material
export function facade(o) {
  const { wall, glass, trim = wall, fh = 4, rows = [0, 1, 1, 1], bay = 3, pier = 1, base = 0, lobby = 0, lobbyMat = M.storefront } = o;
  return (along, h) => {
    if (h < lobby) return h < 1 ? trim : lobbyMat;
    const r = rows[Math.floor(h - base) % fh];
    if (r === 0) return wall;
    if (r === 2) return trim;
    if (bay > 0) { const x = ((along % bay) + bay) % bay; if (x < pier) return wall; }
    return glass;
  };
}

// wrap a shape into a structure: shape(a, h, b) -> tier index (>0) or 0; paint(tier, a, h, b, surf, along) -> material
function landmark(name, { at, dir = GE, hu, hw, height, shape, paint, foot, surf = M.plaza, maps }) {
  const [cx, cz] = at;
  const i = Math.round(cz) * W + Math.round(cx);
  const base = maps ? SEA + maps.elev[clampi(i, 0, W * W - 1)] : SEA + 10;
  const f = (u, h, w) => {
    const a = u, b = -w;
    const t = shape(a, h, b);
    if (!t) return 0;
    const e = 0.9;
    const sa = !shape(a + e, h, b) || !shape(a - e, h, b);
    const sb = !shape(a, h, b + e) || !shape(a, h, b - e);
    const top = !shape(a, h + 1, b);
    return paint(t, a, h, b, sa || sb, sa ? b : a, top);
  };
  const groundY = maps ? (x, z) => SEA + maps.elev[z * W + x] : null;
  const s = solid({ x: cx, z: cz, dir, base, height, hu, hw, f, mode: MODE_OVER, name, groundY });
  s.foot = foot || orect(cx, cz, dir[0], dir[1], hu, hw);
  s.surf = surf;
  s.label = name;
  return s;
}

const box = (a, b, ha, hb) => Math.abs(a) <= ha && Math.abs(b) <= hb;
const cham = (a, b, ha, hb, c) => Math.abs(a) <= ha && Math.abs(b) <= hb && Math.abs(a) + Math.abs(b) <= ha + hb - c;

// ---------------------------------------------------------------------------------------------
export function landmarkList(maps) {
  const L = [];
  const add = (s) => { L.push(s); return s; };
  const G = (e, n) => mg(e, n);

  // ===== Empire State Building (381 m roof, 443 m tip) =====================================
  {
    const lim = facade({ wall: M.limestone, glass: M.window_blue, trim: M.aluminum, fh: 4, rows: [0, 1, 1, 1], bay: 3, pier: 1 });
    add(landmark('Empire State Building', {
      maps, at: G(-80, 33.5), hu: 66, hw: 31, height: 444,
      shape(a, h, b) {
        if (h < 25) return box(a, b, 64, 30) ? 1 : 0;
        if (h < 85) return box(a + 4, b, 44, 24) ? 2 : 0;
        if (h < 265) return box(a + 4, b, 36, 20) ? 3 : 0;
        if (h < 300) return box(a + 4, b, 27, 16) ? 4 : 0;
        if (h < 322) return box(a + 4, b, 18, 12) ? 5 : 0;
        if (h < 373) { const s = 11 - (h - 322) * 0.09; return cham(a + 4, b, s, s, s * 0.5) ? 6 : 0; }
        if (h < 380) return box(a + 4, b, 3, 3) ? 7 : 0;
        if (h < 444) { const r = h < 400 ? 1.6 : 0.8; return box(a + 4, b, r, r) ? 8 : 0; }
        return 0;
      },
      paint(t, a, h, b, surf, along, top) {
        if (t >= 8) return M.antenna;
        if (t === 7) return M.spire;
        if (t === 6) return surf ? ((Math.floor(h) % 6 < 2) ? M.limestone_light : M.glass_silver) : M.limestone;
        if (!surf) return top ? M.roof_gray : M.limestone;
        if (top) return M.limestone_light;
        return lim(along, h);
      },
    }));
  }
  // ===== Chrysler Building (282 m roof, 319 m spire) ========================================
  {
    const brick = facade({ wall: M.brick_white, glass: M.window, trim: M.metal_dark, fh: 4, rows: [0, 1, 1, 1], bay: 2, pier: 1 });
    add(landmark('Chrysler Building', {
      maps, at: G(492, 42.5), hu: 30, hw: 31, height: 320,
      shape(a, h, b) {
        if (h < 60) return box(a, b, 29, 30) ? 1 : 0;
        if (h < 100) return box(a, b, 24, 25) ? 2 : 0;
        if (h < 238) return cham(a, b, 16, 16, 4) ? 3 : 0;
        if (h < 282) {
          const t = (h - 238) / 44, k = Math.floor(t * 7), f = t * 7 - k;
          const s = 15 - 1.6 * k - 1.4 * f * f;
          return cham(a, b, s, s, s * 0.35) ? 4 : 0;
        }
        if (h < 320) { const r = h < 300 ? 1.5 : 0.7; return box(a, b, r, r) ? 5 : 0; }
        return 0;
      },
      paint(t, a, h, b, surf, along, top) {
        if (t >= 4) return (t === 4 && surf && (Math.floor(h * 1.5) + Math.floor(Math.abs(along) / 2)) % 3 === 0) ? M.glass_dark : M.stainless;
        if (!surf) return M.brick_white;
        if (top) return M.metal_dark;
        if (t === 3 && (h > 205 && h < 212) && Math.abs(Math.abs(a) - 12) < 3 && Math.abs(Math.abs(b) - 12) < 3) return M.stainless; // eagles
        if (t === 1 && h > 56) return M.metal_dark;
        return brick(along, h);
      },
    }));
  }
  // ===== One Vanderbilt (427 m) =============================================================
  {
    const cw = facade({ wall: M.terracotta, glass: M.glass_sky, trim: M.terracotta, fh: 4, rows: [2, 1, 1, 1], bay: 3, pier: 1 });
    add(landmark('One Vanderbilt', {
      maps, at: G(200, 42.5), hu: 34, hw: 30, height: 428,
      shape(a, h, b) {
        if (h > 427) return 0;
        const t = h / 427;
        const s1 = 32 - 16 * t, s2 = 28 - 14 * t;
        if (h > 400) return box(a - 2, b, 5 - (h - 400) * 0.15, 5 - (h - 400) * 0.15) ? 3 : 0;
        const in1 = cham(a, b, s1, s2, 8 + 6 * t);
        const in2 = cham(a - 4 - 6 * t, b + 3, s1 * 0.8, s2 * 0.8, 6);
        return in1 || in2 ? (h > 370 ? 2 : 1) : 0;
      },
      paint(t, a, h, b, surf, along, top) {
        if (t === 3) return M.spire;
        if (!surf) return M.terracotta;
        if (t === 2) return M.glass_silver;
        return top ? M.roof_white : cw(along, h);
      },
    }));
  }
  // ===== Grand Central Terminal + MetLife + Helmsley ========================================
  {
    add(landmark('Grand Central Terminal', {
      maps, at: G(304, 42.95), hu: 70, hw: 48, height: 46,
      shape(a, h, b) {
        if (!box(a, b, 68, 46)) return 0;
        if (h < 30) return 1;
        const roof = 30 + 8 * (1 - Math.abs(b) / 46);
        if (h < roof && box(a, b, 60, 44)) return 2;
        if (b < -38 && Math.abs(a) < 10 && h < 44) return 3;         // 42nd St clock / Mercury group
        return 0;
      },
      paint(t, a, h, b, surf, along, top) {
        if (t === 2) return M.copper_green;
        if (t === 3) return h > 40 ? M.gold : M.limestone_light;
        if (!surf) return M.limestone;
        if (b < -40 && Math.abs(a) < 40 && h > 8 && h < 28) { const x = ((a % 26) + 26) % 26; if (x > 5 && x < 21 && h < 26) return M.window_blue; }
        return h > 27 ? M.limestone_light : M.limestone;
      },
    }));
    add(landmark('MetLife Building', {
      maps, at: G(304, 45.05), hu: 60, hw: 32, height: 247,
      shape(a, h, b) {
        if (h < 36) return box(a, b, 58, 30) ? 1 : 0;
        if (h < 246) return cham(a, b, 44, 21, 12) ? 2 : 0;
        return 0;
      },
      paint(t, a, h, b, surf, along, top) {
        if (!surf) return M.concrete_dark;
        if (top) return M.roof_gray;
        if (h > 236) return M.metal_dark;
        return (Math.floor(h) % 4 === 0) ? M.concrete_dark : ((((along % 3) + 3) % 3) < 1 ? M.concrete_dark : M.window);
      },
    }));
    add(landmark('Helmsley Building', {
      maps, at: G(304, 46.35), hu: 60, hw: 16, height: 172,
      shape(a, h, b) {
        if (h < 20) return box(a, b, 58, 14) && (Math.abs(a) > 20 || h > 10) ? 1 : 0;   // Park Ave portals
        if (h < 60) return box(a, b, 58, 14) ? 1 : 0;
        if (h < 140) return box(a, b, 22, 12) ? 2 : 0;
        if (h < 172) { const s = 10 - (h - 140) * 0.28; return box(a, b, s, s) ? 3 : 0; }
        return 0;
      },
      paint(t, a, h, b, surf, along, top) {
        if (t === 3) return M.gold;
        if (!surf) return M.limestone;
        return (Math.floor(h) % 4 === 0 || (((along % 3) + 3) % 3) < 1) ? M.limestone : M.window;
      },
    }));
  }
  // ===== Rockefeller Center ==================================================================
  {
    const rcf = facade({ wall: M.limestone, glass: M.window, trim: M.metal_dark, fh: 4, rows: [2, 1, 1, 1], bay: 2, pier: 1 });
    add(landmark('30 Rockefeller Plaza', {
      maps, at: G(-222, 49.5), hu: 68, hw: 30, height: 260,
      shape(a, h, b) {
        if (h < 26) return box(a, b, 67, 29) ? 1 : 0;
        if (h < 110) return box(a + 4, b, 58, 16) ? 2 : 0;
        if (h < 180) return box(a + 10, b, 46, 16) ? 3 : 0;
        if (h < 238) return box(a + 16, b, 34, 14) ? 4 : 0;
        if (h < 259) return box(a + 20, b, 24, 12) ? 5 : 0;
        return 0;
      },
      paint(t, a, h, b, surf, along, top) {
        if (!surf) return top ? (t >= 2 ? M.roof_green : M.roof_gray) : M.limestone;
        if (top) return M.limestone_light;
        return rcf(along, h);
      },
    }));
    add(landmark('International Building', {
      maps, at: G(-78, 50.5), hu: 62, hw: 30, height: 158,
      shape(a, h, b) {
        if (h < 28) return box(a, b, 60, 29) && !(a > 30 && Math.abs(b) < 10) ? 1 : 0;
        if (h < 157) return box(a + 14, b, 30, 14) ? 2 : 0;
        return 0;
      },
      paint(t, a, h, b, surf, along, top) { return !surf ? M.limestone : top ? M.roof_gray : rcf(along, h); },
    }));
    for (const [n, name] of [[49.22, 'La Maison Francaise'], [49.78, 'British Empire Building']]) {
      add(landmark(name, { maps, at: G(-70, n), hu: 52, hw: 12, height: 29,
        shape: (a, h, b) => (box(a, b, 50, 11) ? (h < 26 ? 1 : box(a, b, 44, 8) ? 2 : 0) : 0),
        paint: (t, a, h, b, surf, along, top) => (t === 2 ? M.roof_green : !surf ? M.limestone : top ? M.roof_green : rcf(along, h)) }));
    }
    add(landmark('Radio City Music Hall', { maps, at: G(-250, 50.5), hu: 50, hw: 30, height: 36,
      shape: (a, h, b) => (box(a, b, 48, 29) ? (h < 34 ? 1 : 0) : (a < -48 && a > -52 && b > 18 && b < 26 && h > 6 && h < 34 ? 2 : 0)),
      paint: (t, a, h, b, surf, along, top) => (t === 2 ? (Math.floor(h / 3) % 2 ? M.sign_red : M.sign_white) : !surf ? M.limestone : top ? M.roof_gray : (h > 4 && h < 8 ? M.sign_red : M.limestone)) }));
  }
  // ===== Flatiron Building (87 m) ============================================================
  {
    add(landmark('Flatiron Building', {
      maps, at: G(28, 22.45), hu: 36, hw: 34, height: 88,
      foot: [G(15, 22.12), G(42, 22.12), G(15.5, 22.8)],
      shape(a, h, b) {
        // triangle between 5th Ave (a = -13), 22nd St (b = -27) and Broadway (slanted)
        const bw = -27 + 55 * (1 - (a + 13) / 26.5);
        if (a < -13 || b < -27 || b > bw || h >= 87) return 0;
        if (b > 26 && Math.abs(a + 12) < 1.5 && h < 87) return 1;
        return 1;
      },
      paint(t, a, h, b, surf, along, top) {
        if (!surf) return M.limestone;
        if (top || h > 83) return M.terracotta;
        if (h < 8) return (Math.floor(h) % 3 === 0) ? M.limestone : M.storefront;
        const r = Math.floor(h) % 4;
        return r === 0 ? M.terracotta : ((((Math.floor(along) % 2) + 2) % 2) ? M.window : M.limestone_light);
      },
    }));
  }
  // ===== Billionaires' Row ===================================================================
  {
    const pts = [
      ['Central Park Tower', G(-672, 57.42), 472, (a, h, b) => (h < 36 ? box(a, b, 38, 24) : h < 470 ? box(a - 6, b, 20 - (h > 300 ? 2 : 0), 15 - (h > 300 ? 1 : 0)) : false), M.glass_silver, M.white],
      ['111 West 57th Street', G(-240, 57.45), 435, (a, h, b) => (h < 60 ? box(a, b + 8, 14, 24) : h < 435 ? (Math.abs(a) <= 9 && b <= 22 && b >= -22 + Math.max(0, (h - 230) * 0.16)) : false), M.glass_bronze, M.terracotta],
      ['One57', G(-455, 57.38), 306, (a, h, b) => (h < 306 ? box(a, b, 22 - Math.max(0, h - 240) * 0.2, 16 - Math.max(0, h - 270) * 0.3) : false), M.glass_blue, M.glass_sky],
      ['220 Central Park South', G(-735, 58.72), 290, (a, h, b) => (h < 70 ? box(a, b, 24, 22) : h < 250 ? box(a, b, 17, 17) : h < 290 ? box(a, b, 13 - (h - 250) * 0.15, 13 - (h - 250) * 0.15) : false), M.limestone_light, M.window],
      ['53 West 53rd', G(-150, 53.55), 320, (a, h, b) => { if (h >= 320) return false; const t = h / 320; return box(a, b + 4 * t, 20 * (1 - t) + 2, 14 * (1 - t * 0.7) + 1); }, M.glass_dark, M.steel_dark],
      ['432 Park Avenue', G(250, 56.55), 426, (a, h, b) => (h < 426 ? box(a, b, 14.2, 14.2) : false), M.concrete, M.glass_dark],
    ];
    for (const [name, at, H, shp, m1, m2] of pts) {
      add(landmark(name, { maps, at, hu: 42, hw: 42, height: H + 2,
        shape: (a, h, b) => (shp(a, h, b) ? 1 : 0),
        paint(t, a, h, b, surf, along, top) {
          if (!surf) return m1;
          if (top) return M.roof_white;
          if (name === '432 Park Avenue') {           // 432 Park: square window grid, open mechanical floors every 12 storeys
            const fy = h % 56;
            if (fy > 50) return M.glass_black;
            const ax = ((along % 4.7) + 4.7) % 4.7, ay = h % 4.7;
            return ax < 1.3 || ay < 1.3 ? M.concrete : M.glass_dark;
          }
          if (name === '111 West 57th Street') return (a > 8 || a < -8) ? ((Math.floor(h) % 3 === 0) ? M.bronze : M.terracotta) : ((Math.floor(h) % 4 === 0) ? M.bronze : M.glass_bronze);
          if (name === '53 West 53rd') { const d = ((along + h) % 12 + 12) % 12, e = ((along - h) % 12 + 12) % 12; return d < 1.2 || e < 1.2 ? M.steel_dark : M.glass_dark; }
          if (name === 'One57') return (((Math.floor(along / 3) + Math.floor(h / 18)) % 3) === 0) ? M.glass_sky : M.glass_blue;
          if (name === '220 Central Park South') return (Math.floor(h) % 4 === 0 || (((along % 3) + 3) % 3) < 1) ? M.limestone_light : M.window;
          if (name === 'Central Park Tower') return (((along % 3) + 3) % 3) < 1 ? M.white : ((Math.floor(h) % 4 === 0) ? M.metal_panel : M.glass_silver);
          return m2;
        },
      }));
    }
  }
  // ===== Midtown others ======================================================================
  const simpleTower = (name, at, tiers, style, dir = GE, crown = null) => {
    const H = tiers[tiers.length - 1][0];
    const hu = Math.max(...tiers.map((t) => t[1])) + 1, hw = Math.max(...tiers.map((t) => t[2])) + 1;
    add(landmark(name, { maps, at, dir, hu, hw, height: H + (crown ? crown.h : 0) + 1,
      shape(a, h, b) {
        for (let k = 0; k < tiers.length; k++) { const [top, ha, hb, ch] = tiers[k]; if (h < top) return (ch ? cham(a, b, ha, hb, ch) : box(a, b, ha, hb)) ? k + 1 : 0; }
        if (crown && h < H + crown.h) { const t = (h - H) / crown.h; const s = crown.r * (1 - t * (crown.taper ?? 1)); return box(a, b, Math.max(0.6, s), Math.max(0.6, s)) ? 99 : 0; }
        return 0;
      },
      paint(t, a, h, b, surf, along, top) {
        if (t === 99) return crown.mat;
        if (!surf) return style.wall;
        if (top) return style.roof || M.roof_gray;
        return style.f(along, h);
      },
    }));
  };
  const glassF = (g, s = M.spandrel) => ({ wall: g, f: facade({ wall: s, glass: g, trim: s, fh: 4, rows: [1, 1, 1, 2], bay: 0 }) });
  const stoneF = (w, g = M.window) => ({ wall: w, f: facade({ wall: w, glass: g, fh: 4, rows: [0, 1, 1, 1], bay: 3, pier: 1 }) });
  simpleTower('Bank of America Tower', G(-345, 42.55), [[30, 30, 28], [288, 24, 22, 8]], glassF(M.glass_silver), GE, { h: 78, r: 2, mat: M.spire, taper: 0.6 });
  simpleTower('The New York Times Building', G(-836, 40.5), [[228, 22, 22]], { wall: M.glass_sky, f: (along, h) => ((((along % 2) + 2) % 2) < 1 ? M.cream_rod || M.limestone_light : M.glass_sky) }, GE, { h: 91, r: 1.2, mat: M.antenna, taper: 0.4 });
  simpleTower('4 Times Square', G(-560, 42.6), [[247, 20, 22, 4]], glassF(M.glass_blue), GE, { h: 118, r: 1.5, mat: M.antenna, taper: 0.5 });
  simpleTower('One Penn Plaza', G(-760, 33.6), [[229, 30, 18]], { wall: M.glass_black, f: facade({ wall: M.metal_dark, glass: M.glass_black, fh: 4, rows: [2, 1, 1, 1], bay: 2, pier: 1 }) });
  simpleTower('Trump Tower', G(45, 56.4), [[20, 28, 26], [40, 24, 24, 10], [202, 18, 20, 7]], glassF(M.glass_black, M.bronze));
  simpleTower('General Motors Building', G(95, 58.45), [[16, 42, 28], [215, 34, 18]], stoneF(M.marble, M.window));
  simpleTower('Citigroup Center', G(540, 53.5), [[12, 5, 5], [240, 24, 24]], stoneF(M.aluminum, M.window_blue));
  simpleTower('Seagram Building', G(360, 52.55), [[157, 24, 14]], { wall: M.bronze, f: facade({ wall: M.bronze, glass: M.glass_bronze, fh: 4, rows: [2, 1, 1, 1], bay: 2, pier: 1 }) });
  simpleTower('Lever House', G(250, 53.55), [[12, 28, 28], [94, 26, 8]], glassF(M.glass_green, M.steel));
  simpleTower('Waldorf Astoria', G(360, 49.5), [[60, 30, 28], [150, 22, 22], [175, 12, 12], [191, 7, 7]], stoneF(M.limestone), GE, { h: 12, r: 5, mat: M.copper_green, taper: 0.9 });
  simpleTower('383 Madison Avenue', G(195, 46.55), [[220, 22, 26, 8], [230, 14, 14, 6]], stoneF(M.granite_pink, M.glass_dark), GE, { h: 12, r: 10, mat: M.glass_sky, taper: 0.9 });
  simpleTower('Hearst Tower', G(-898, 56.55), [[30, 30, 28], [182, 24, 22]], { wall: M.glass_blue, f: (along, h) => { const d = ((along + h * 0.7) % 16 + 16) % 16, e = ((along - h * 0.7) % 16 + 16) % 16; return d < 1.3 || e < 1.3 ? M.steel : M.glass_blue; } });
  simpleTower('Deutsche Bank Center (north)', G(-960, 59.75), [[46, 40, 26], [229, 20, 14, 4]], glassF(M.glass_sky));
  simpleTower('Deutsche Bank Center (south)', G(-960, 59.1), [[46, 40, 20], [229, 20, 12, 4]], glassF(M.glass_sky));
  simpleTower('Trump International Hotel', G(-900, 60.35), [[180, 22, 18]], glassF(M.glass_bronze, M.bronze));
  simpleTower('Carnegie Hall', G(-640, 56.65), [[46, 28, 28]], stoneF(M.brick_brown, M.window));
  simpleTower('Madison Square Garden', G(-744, 32.0), [[4, 1, 1]], stoneF(M.concrete));
  L.pop();
  add(landmark('Madison Square Garden', { maps, at: G(-744, 32.0), hu: 66, hw: 66, height: 46,
    shape: (a, h, b) => { const r = Math.hypot(a, b); if (r > 65) return 0; if (h < 40) return 1; if (h < 46 && r < 60 - (h - 40) * 3) return 2; return 0; },
    paint: (t, a, h, b, surf, along, top) => (t === 2 ? M.roof_white : !surf ? M.concrete : (Math.floor(h) % 10 < 7 ? M.concrete : M.window_blue)) }));
  add(landmark('Macy\u2019s Herald Square', { maps, at: G(-470, 34.53), hu: 124, hw: 28, height: 46,
    shape: (a, h, b) => (box(a, b, 122, 27) && h < 44 ? 1 : 0),
    paint: (t, a, h, b, surf, along, top) => (!surf ? M.brick : top ? M.roof_gray : h < 6 ? M.storefront : (h > 36 && h < 42 && Math.abs(a - 90) < 20 ? M.sign_red : (Math.floor(h) % 4 ? (((along % 3) + 3) % 3 < 1 ? M.brick : M.window) : M.brick))) }));
  add(landmark('New York Public Library', { maps, at: G(-88, 41.0), hu: 64, hw: 60, height: 32,
    shape(a, h, b) {
      if (!box(a, b, 60, 56)) return 0;
      if (a > 35 && Math.abs(b) < 45 && h < 2) return 3;                   // terrace
      if (a > 35) return 0;
      if (h < 26) return 1;
      if (h < 30 && box(a, b, 55, 50)) return 2;
      return 0;
    },
    paint: (t, a, h, b, surf, along, top) => (t === 3 ? M.marble : t === 2 ? M.roof_gray : !surf ? M.marble : (a > 30 && h > 4 && h < 22 && (((b % 6) + 6) % 6) > 3 ? M.window : M.marble)) }));
  add(landmark('St. Patrick\u2019s Cathedral', { maps, at: G(72, 50.5), hu: 60, hw: 30, height: 101,
    shape(a, h, b) {
      if (!box(a, b, 56, 28)) return 0;
      if (a < -44 && Math.abs(Math.abs(b) - 10) < 5) { if (h < 60) return 1; const s = 5 * (1 - (h - 60) / 41); return Math.abs(a + 49) < s && Math.abs(Math.abs(b) - 10) < s ? 2 : 0; }
      const nave = Math.abs(b) < 13 || (Math.abs(a - 18) < 8);
      if (!nave) return h < 14 && Math.abs(b) < 22 ? 1 : 0;
      const roof = 30 + 12 * (1 - Math.abs(b) / 13);
      return h < 30 ? 1 : h < roof ? 3 : 0;
    },
    paint: (t, a, h, b, surf, along, top) => (t === 2 ? M.marble : t === 3 ? M.slate : !surf ? M.marble : ((Math.floor(along) % 5 === 2 && h > 6 && h < 26) ? M.glass_dark : M.marble)) }));
  add(landmark('The Plaza Hotel', { maps, at: G(-58, 58.5), hu: 44, hw: 28, height: 78,
    shape: (a, h, b) => (box(a, b, 42, 26) ? (h < 62 ? 1 : h < 76 && box(a, b, 40 - (h - 62) * 0.6, 24 - (h - 62) * 0.6) ? 2 : 0) : 0),
    paint: (t, a, h, b, surf, along, top) => (t === 2 ? M.copper_green : !surf ? M.marble : (Math.floor(h) % 4 && (((along % 3) + 3) % 3 > 1) ? M.window : M.marble)) }));
  add(landmark('Apple Fifth Avenue', { maps, at: G(95, 58.9), hu: 6, hw: 6, height: 11,
    shape: (a, h, b) => (box(a, b, 5, 5) && h < 10 ? 1 : 0), paint: () => M.glass_sky }));
  add(landmark('UN Secretariat', { maps, at: G(1150, 44.6), hu: 12, hw: 45, height: 156,
    shape: (a, h, b) => (box(a, b, 11, 44) && h < 155 ? 1 : 0),
    paint: (t, a, h, b, surf, along, top) => (!surf ? M.marble : top ? M.roof_gray : (Math.abs(b) > 43 ? M.marble : (Math.floor(h) % 12 < 2 && h > 30 ? M.glass_black : M.glass_green))) }));
  add(landmark('UN General Assembly', { maps, at: G(1170, 46.6), hu: 30, hw: 50, height: 40,
    shape: (a, h, b) => { if (!box(a, b, 26, 48)) return 0; const roof = 18 + 14 * (1 - Math.abs(b) / 48) ** 0.5; if (h < roof) return 1; if (Math.hypot(a, b) < 9 && h < roof + 6) return 2; return 0; },
    paint: (t) => (t === 2 ? M.copper_green : M.marble) }));

  // ===== Times Square: One Times Square (screens top to bottom), TKTS red steps ============
  add(landmark('One Times Square', { maps, at: G(-572, 42.55), hu: 16, hw: 26, height: 112,
    shape: (a, h, b) => (box(a, b, 14, 24 - Math.max(0, a) * 0.25) && h < 110 ? 1 : 0),
    paint(t, a, h, b, surf, along, top) {
      if (!surf) return M.limestone; if (top) return M.roof_gray;
      const pu = Math.floor(along / 9), pv = Math.floor(h / 10);
      if ((((along % 9) + 9) % 9) < 0.8 || Math.floor(h) % 10 === 0) return M.metal_dark;
      return [M.sign_red, M.sign_blue, M.sign_magenta, M.sign_yellow, M.sign_cyan, M.sign_white, M.sign_green][Math.floor(hsh(pu, pv, 11) * 7)];
    } }));
  add(landmark('TKTS Red Steps', { maps, at: G(-655, 46.75), hu: 10, hw: 18, height: 7,
    shape: (a, h, b) => (box(a, b, 8, 16) && h < 1 + (b + 16) * 0.19 ? 1 : 0),
    paint: (t, a, h, b, surf, along, top) => (top ? M.sign_red : M.glass_dark) }));
  // ===== Hudson Yards =======================================================================
  {
    const g = glassF(M.glass_sky, M.metal_panel);
    add(landmark('30 Hudson Yards', { maps, at: G(-1560, 30.75), hu: 40, hw: 40, height: 388,
      shape(a, h, b) {
        if (h < 30) return box(a, b, 36, 30) ? 1 : 0;
        const t = h / 387, s = 32 - 8 * t;
        if (h > 332 && h < 338 && a > -60 && a < 42 && Math.abs(b) < 14) return 3;   // The Edge deck
        if (h < 360) return (box(a, b, s, s - 4) && a + b < s * 1.6) ? 2 : 0;
        if (h < 388) return box(a, b, 6, 6) ? 4 : 0;
        return 0;
      },
      paint: (t, a, h, b, surf, along, top) => (t === 3 ? (a > 36 ? M.glass_sky : M.metal_panel) : t === 4 ? M.metal_panel : !surf ? M.glass_sky : top ? M.roof_white : g.f(along, h)) }));
    add(landmark('10 Hudson Yards', { maps, at: G(-1455, 30.65), hu: 34, hw: 30, height: 270,
      shape: (a, h, b) => { if (h > 268) return 0; const cut = 268 - (a + 30) * 0.9; return box(a, b, 30, 26) && h < cut ? 1 : 0; },
      paint: (t, a, h, b, surf, along, top) => (!surf ? M.glass_sky : top ? M.roof_white : g.f(along, h)) }));
    add(landmark('35 Hudson Yards', { maps, at: G(-1640, 32.9), hu: 26, hw: 26, height: 309,
      shape: (a, h, b) => (h < 120 ? box(a, b, 24, 22) : h < 250 ? box(a + 3, b, 18, 18) : h < 308 ? box(a + 5, b, 13, 13) : false) ? 1 : 0,
      paint: (t, a, h, b, surf, along, top) => (!surf ? M.limestone : top ? M.roof_gray : ((((along % 3) + 3) % 3) < 1 || Math.floor(h) % 4 === 0 ? M.limestone : M.glass_silver)) }));
    add(landmark('50 Hudson Yards', { maps, at: G(-1450, 33.4), hu: 40, hw: 30, height: 301,
      shape: (a, h, b) => (h < 300 ? box(a, b, 38 - (h > 200 ? 6 : 0), 28 - (h > 250 ? 4 : 0)) : false) ? 1 : 0,
      paint: (t, a, h, b, surf, along, top) => (!surf ? M.glass_blue : top ? M.roof_white : glassF(M.glass_blue).f(along, h)) }));
    add(landmark('15 Hudson Yards', { maps, at: G(-1690, 31.5), hu: 22, hw: 20, height: 280,
      shape: (a, h, b) => { if (h >= 279) return 0; const s = h > 220 ? 18 - (h - 220) * 0.12 : 18; return cham(a, b, s, s - 2, 6) ? 1 : 0; },
      paint: (t, a, h, b, surf, along, top) => (!surf ? M.glass_sky : top ? M.roof_white : ((Math.floor(h / 4) + Math.floor(along / 3)) % 5 === 0 ? M.glass_green : M.glass_sky)) }));
    add(landmark('The Shed', { maps, at: G(-1760, 31.1), hu: 36, hw: 28, height: 38,
      shape: (a, h, b) => (box(a, b, 34, 26) && h < 36 ? 1 : 0),
      paint: (t, a, h, b, surf, along, top) => (!surf ? M.metal_panel : ((((along % 4) + 4) % 4) < 1 ? M.steel : M.canvas)) }));
    add(landmark('The Vessel', { maps, at: G(-1560, 32.05), hu: 26, hw: 26, height: 47,
      shape: (a, h, b) => { const r = Math.hypot(a, b), rr = 8 + h * 0.36; return (r < rr && r > rr - 2.2 && h < 46) ? 1 : 0; },
      paint: (t, a, h, b) => ((((Math.atan2(b, a) * 8 + h * 0.45) % 1) + 1) % 1 < 0.45 ? M.copper : M.bronze) }));
    add(landmark('One Manhattan West', { maps, at: G(-1310, 32.6), hu: 30, hw: 30, height: 304,
      shape: (a, h, b) => (h < 303 ? cham(a, b, 28, 26, 10) : false) ? 1 : 0,
      paint: (t, a, h, b, surf, along, top) => (!surf ? M.glass_silver : top ? M.roof_white : glassF(M.glass_silver).f(along, h)) }));
    add(landmark('Two Manhattan West', { maps, at: G(-1240, 31.35), hu: 30, hw: 24, height: 286,
      shape: (a, h, b) => (h < 285 ? box(a, b, 28, 22 - (h > 200 ? (h - 200) * 0.08 : 0)) : false) ? 1 : 0,
      paint: (t, a, h, b, surf, along, top) => (!surf ? M.glass_sky : top ? M.roof_white : glassF(M.glass_sky).f(along, h)) }));
    add(landmark('The Spiral', { maps, at: G(-1360, 34.55), hu: 34, hw: 30, height: 315,
      shape: (a, h, b) => { if (h >= 314) return 0; const k = Math.floor(h / 40); const ins = Math.min(12, k * 1.6); return box(a + (k % 2 ? ins : -ins) * 0.3, b, 32 - ins, 28 - ins * 0.6) ? 1 : 0; },
      paint: (t, a, h, b, surf, along, top) => (top ? M.roof_green : !surf ? M.glass_blue : glassF(M.glass_blue).f(along, h)) }));
  }
  // ===== Lower Manhattan =====================================================================
  const WTC_DIR = bearingXZ(90 + 25);   // site grid ~25 deg east of north -> "a" axis toward ESE
  {
    add(landmark('One World Trade Center', { maps, at: ll(40.7127, -74.0134), dir: WTC_DIR, hu: 32, hw: 32, height: 542,
      shape(a, h, b) {
        if (h < 57) return box(a, b, 30.5, 30.5) ? 1 : 0;
        if (h < 417) { const t = (h - 57) / 360, D = 61 - 30.5 * t; return (box(a, b, 30.5, 30.5) && Math.abs(a) + Math.abs(b) <= D) ? 2 : 0; }
        if (h < 422) return (Math.abs(a) + Math.abs(b) <= 30.5 && Math.abs(a) + Math.abs(b) >= 26) ? 3 : (Math.abs(a) + Math.abs(b) < 10 ? 4 : 0);
        if (h < 432) return Math.hypot(a, b) < (h < 428 ? 9 : 4) ? 4 : 0;
        if (h < 542) { const r = 2.4 - (h - 432) * 0.016; return Math.hypot(a, b) < r ? 5 : 0; }
        return 0;
      },
      paint(t, a, h, b, surf, along, top) {
        if (t === 5) return M.spire;
        if (t === 4) return M.steel;
        if (t === 3) return M.glass_silver;
        if (!surf) return M.glass_silver;
        if (t === 1) return h < 18 ? ((((along % 2) + 2) % 2) < 1 ? M.metal_panel : M.glass_silver) : ((((along % 1.5) + 1.5) % 1.5) < 0.6 ? M.metal_panel : M.glass_silver);
        return (Math.floor(h) % 4 === 0) ? M.glass_sky : M.glass_silver;
      },
    }));
    for (const [la, lo, name] of [[40.71155, -74.01285, 'North Pool'], [40.71010, -74.01335, 'South Pool']]) {
      add(memorialPool(maps, ll(la, lo), WTC_DIR, `9/11 Memorial ${name}`));
    }
    add(landmark('The Oculus', { maps, at: ll(40.71135, -74.01105), dir: WTC_DIR, hu: 58, hw: 36, height: 51,
      shape(a, h, b) {
        if (Math.abs(a) > 55) return 0;
        const spine = 1 - (a / 55) ** 2;
        const ribH = 14 + Math.abs(b) * 0.95;
        if (Math.abs(b) < 17 * Math.sqrt(Math.max(spine, 0)) && h < 12 + 4 * spine) return 1;
        if (Math.abs(b) < 34 && h < ribH && h > ribH - 3 && Math.abs(b) > 10 && (((a % 3) + 3) % 3) < 1.2) return 2;
        return 0;
      },
      paint: (t) => (t === 2 ? M.white : M.marble) }));
    simpleTower('3 World Trade Center', ll(40.7098, -74.0115), [[329, 24, 24]], { wall: M.glass_dark, f: (along, h) => { const d = ((along + h * 0.5) % 28 + 28) % 28, e = ((along - h * 0.5) % 28 + 28) % 28; return d < 1.5 || e < 1.5 ? M.steel : ((Math.floor(h) % 4 === 0) ? M.spandrel : M.glass_dark); } }, WTC_DIR);
    simpleTower('4 World Trade Center', ll(40.7101, -74.0120 + 0.0006), [[298, 22, 20]], glassF(M.glass_silver), WTC_DIR);
    simpleTower('7 World Trade Center', ll(40.7134, -74.0121), [[228, 22, 18]], glassF(M.glass_sky), WTC_DIR);
    simpleTower('Perelman Performing Arts Center', ll(40.7122, -74.0122), [[42, 20, 20]], { wall: M.marble, f: () => M.marble }, WTC_DIR);
    simpleTower('200 West Street (Goldman Sachs)', ll(40.7148, -74.0145), [[228, 20, 44, 6]], glassF(M.glass_silver), bearingXZ(90 + 18));
    // Brookfield Place towers with distinctive tops + Winter Garden
    const bf = (name, la, lo, H, top) => simpleTower(name, ll(la, lo), [[H - 30, 24, 24, 5], [H - 12, 20, 20, 5]], stoneF(M.granite_pink, M.glass_silver), bearingXZ(90 + 18), top);
    bf('200 Liberty Street', 40.7100, -74.0157, 176, { h: 14, r: 12, mat: M.copper, taper: 0.5 });
    bf('225 Liberty Street', 40.7110, -74.0163, 197, { h: 18, r: 14, mat: M.copper, taper: 0.9 });
    bf('200 Vesey Street', 40.7139, -74.0158, 225, { h: 24, r: 16, mat: M.copper, taper: 1.0 });
    bf('250 Vesey Street', 40.7130, -74.0168, 150, { h: 16, r: 14, mat: M.copper, taper: 0.8 });
    add(landmark('Winter Garden', { maps, at: ll(40.7123, -74.0163), dir: bearingXZ(90 + 18), hu: 36, hw: 18, height: 37,
      shape: (a, h, b) => (box(a, b, 34, 16) && h < 20 + 16 * Math.sqrt(Math.max(0, 1 - (b / 16) ** 2)) ? 1 : 0),
      paint: (t, a, h, b, surf) => (surf ? ((((a % 3) + 3) % 3) < 0.7 ? M.white : M.glass_sky) : M.glass_sky) }));
    // Woolworth Building (241 m)
    add(landmark('Woolworth Building', { maps, at: ll(40.71235, -74.00835), dir: bearingXZ(90 + 32), hu: 32, hw: 32, height: 242,
      shape(a, h, b) {
        if (h < 110) return box(a, b, 30, 30) && !(a < -8 && Math.abs(b) < 8 && h > 20) ? 1 : 0;
        if (h < 180) return box(a - 8, b, 14, 14) ? 2 : 0;
        if (h < 200) return box(a - 8, b, 11, 11) ? 3 : 0;
        if (h < 232) { const s = 10 * (1 - (h - 200) / 36); return (box(a - 8, b, s, s) || (h < 214 && box(Math.abs(a - 8) - 9, Math.abs(b) - 9, 1.5, 1.5))) ? 4 : 0; }
        if (h < 242) return box(a - 8, b, 1.3, 1.3) ? 5 : 0;
        return 0;
      },
      paint: (t, a, h, b, surf, along) => (t >= 4 ? (t === 5 ? M.gold : M.copper_green) : !surf ? M.limestone_light : ((((along % 2) + 2) % 2) < 0.8 ? M.limestone_light : (Math.floor(h) % 4 === 0 ? M.terracotta : M.window))) }));
    simpleTower('8 Spruce Street', ll(40.7110, -74.0055), [[40, 30, 30], [265, 18, 22]], { wall: M.stainless, f: (along, h) => ((Math.floor(along * 0.7 + Math.sin(h * 0.08) * 2) % 3) === 0 ? M.stainless : M.glass_silver) }, bearingXZ(90 + 32));
    simpleTower('70 Pine Street', ll(40.7065, -74.0075), [[120, 22, 20], [200, 16, 15], [250, 11, 10], [275, 6, 6]], stoneF(M.limestone_light, M.window), bearingXZ(90 + 30), { h: 15, r: 3, mat: M.spire, taper: 0.8 });
    simpleTower('40 Wall Street', ll(40.7069, -74.0092), [[150, 22, 20], [230, 15, 15], [250, 12, 12]], stoneF(M.limestone, M.window), bearingXZ(90 + 30), { h: 33, r: 11, mat: M.copper_green, taper: 0.95 });
    simpleTower('1 Wall Street', ll(40.7071, -74.0119), [[120, 24, 22], [180, 18, 18], [199, 12, 12]], stoneF(M.limestone_light, M.window), bearingXZ(90 + 30));
    simpleTower('28 Liberty Street', ll(40.7079, -74.0088), [[248, 30, 16]], { wall: M.aluminum, f: facade({ wall: M.aluminum, glass: M.glass_dark, fh: 4, rows: [2, 1, 1, 1], bay: 3, pier: 1 }) }, bearingXZ(90 + 30));
    simpleTower('One Liberty Plaza', ll(40.7098, -74.0110), [[226, 30, 20]], { wall: M.black, f: facade({ wall: M.black, glass: M.glass_black, fh: 4, rows: [2, 2, 1, 1], bay: 2, pier: 1 }) }, bearingXZ(90 + 30));
    simpleTower('30 Park Place', ll(40.7134, -74.0089), [[200, 20, 16], [285, 14, 14]], stoneF(M.limestone, M.window_blue), bearingXZ(90 + 32));
    add(landmark('56 Leonard Street', { maps, at: ll(40.71785, -74.00590), dir: bearingXZ(90 + 23), hu: 26, hw: 26, height: 251,
      shape: (a, h, b) => { if (h >= 250) return 0; const k = Math.floor(h / 12), s = 14 + (h > 60 ? hsh(k, 1, 5) * 7 : 0), o = (hsh(k, 2, 5) - 0.5) * 8; return box(a + o, b - o * 0.5, s, s) ? 1 : 0; },
      paint: (t, a, h, b, surf, along, top) => (top ? M.roof_white : !surf ? M.glass_sky : (Math.floor(h) % 12 < 1 ? M.white : M.glass_sky)) }));
    add(landmark('Municipal Building', { maps, at: ll(40.71305, -74.00395), dir: bearingXZ(90 + 38), hu: 50, hw: 30, height: 178,
      shape(a, h, b) {
        if (h < 105) return box(a, b, 48, 28) && !(Math.abs(a) < 18 && b > 4) && !(Math.abs(a) < 6 && h < 14) ? 1 : 0;
        if (h < 125) return box(a, b + 8, 16, 14) ? 2 : 0;
        if (h < 150) return box(a, b + 8, 11, 11) ? 3 : 0;
        if (h < 165) return Math.hypot(a, b + 8) < 7 ? 4 : 0;
        if (h < 178) return Math.hypot(a, b + 8) < (h < 170 ? 2.2 : 1.2) ? 5 : 0;
        return 0;
      },
      paint: (t, a, h, b, surf, along) => (t === 5 ? M.gold : t === 4 ? M.limestone_light : !surf ? M.limestone : (Math.floor(h) % 4 && (((along % 3) + 3) % 3 > 1) ? M.window : M.limestone)) }));
    add(landmark('City Hall', { maps, at: ll(40.71275, -74.00595), dir: bearingXZ(90 + 35), hu: 48, hw: 18, height: 40,
      shape: (a, h, b) => { if (!box(a, b, 46, 16)) return 0; if (h < 16) return (Math.abs(a) < 26 || Math.abs(b) < 12) ? 1 : 0; if (h < 18) return Math.abs(a) < 26 ? 2 : 0; if (Math.hypot(a, b) < 5 && h < 38) return h < 32 ? 3 : 4; return 0; },
      paint: (t, a, h, b, surf, along) => (t === 4 ? M.gold : t === 2 ? M.slate : (surf && Math.floor(h) % 8 > 3 && (((along % 4) + 4) % 4) > 2 ? M.window : M.marble)) }));
    add(landmark('Trinity Church', { maps, at: ll(40.70815, -74.01205), dir: bearingXZ(90 + 30), hu: 30, hw: 14, height: 86,
      shape: (a, h, b) => { if (a < -20 && Math.abs(b) < 5 && a > -30) { if (h < 45) return 1; const s = 5 * (1 - (h - 45) / 41); return Math.abs(a + 25) < s && Math.abs(b) < s ? 2 : 0; } if (!box(a, b, 22, 11)) return 0; const roof = 16 + 8 * (1 - Math.abs(b) / 11); return h < 16 ? 1 : h < roof ? 3 : 0; },
      paint: (t) => (t === 3 ? M.slate : M.brownstone) }));
    add(landmark('New York Stock Exchange', { maps, at: ll(40.70690, -74.01115), dir: bearingXZ(90 + 30), hu: 28, hw: 24, height: 38,
      shape: (a, h, b) => (box(a, b, 26, 22) ? (h < 34 ? 1 : h < 38 && box(a, b, 24, 20) ? 2 : 0) : 0),
      paint: (t, a, h, b, surf, along) => (t === 2 ? M.roof_gray : surf && b > 20 && h > 5 && h < 26 && (((a % 4) + 4) % 4) < 2 ? M.glass_dark : (surf && b > 20 && h >= 26 && h < 30 ? M.marble : M.marble)) }));
    add(landmark('Castle Clinton', { maps, at: ll(40.70340, -74.01690), hu: 34, hw: 34, height: 9,
      shape: (a, h, b) => { const r = Math.hypot(a, b); return r < 32 && r > 27 && h < 8 ? 1 : 0; }, paint: () => M.brownstone }));
    add(landmark('Staten Island Ferry Terminal', { maps, at: ll(40.70115, -74.01305), dir: bearingXZ(70), hu: 60, hw: 40, height: 28,
      shape: (a, h, b) => (box(a, b, 58, 38) && h < 24 - Math.abs(b) * 0.15 ? 1 : 0),
      paint: (t, a, h, b, surf, along) => (surf && b < -30 && h > 3 ? M.glass_sky : surf ? M.metal_panel : M.roof_white) }));
    add(landmark('Battery Maritime Building', { maps, at: ll(40.70145, -74.01170), dir: bearingXZ(80), hu: 50, hw: 16, height: 22,
      shape: (a, h, b) => (box(a, b, 48, 14) && h < 20 ? 1 : 0),
      paint: (t, a, h, b, surf, along) => (!surf ? M.painted_green : (Math.floor(h) % 6 > 2 && (((along % 5) + 5) % 5) > 2 ? M.glass_dark : M.painted_green)) }));
    add(landmark('Manhattan Bridge Arch', { maps, at: ll(40.71645, -73.99555), dir: bearingXZ(90 + 150 - 90), hu: 40, hw: 12, height: 32,
      shape: (a, h, b) => { if (!box(a, b, 38, 10)) return 0; if (Math.abs(a) < 12) { const arch = 14 + Math.sqrt(Math.max(0, 64 - a * a * 0.45)); return (h > arch || Math.abs(a) > 8) && h < 30 ? 1 : 0; } return Math.abs(b) > 6 && h < 14 ? 2 : 0; },
      paint: () => M.granite_gray }));
  }
  // ===== Brooklyn / Queens / New Jersey / Governors Island ==================================
  simpleTower('One Manhattan Square', ll(40.71080, -73.98960), [[250, 26, 20]], glassF(M.glass_blue), bearingXZ(90 + 62));
  simpleTower('Clock Tower Building (DUMBO)', ll(40.70345, -73.98925), [[60, 24, 22], [72, 8, 8]], stoneF(M.concrete, M.window), bearingXZ(345 + 90));
  add(landmark('Watchtower Sign', { maps, at: ll(40.69955, -73.99405), dir: bearingXZ(20 + 90), hu: 26, hw: 20, height: 62,
    shape: (a, h, b) => (box(a, b, 24, 18) ? (h < 50 ? 1 : (b > 14 && h < 58 && (((a % 5) + 5) % 5) < 3.5) ? 2 : 0) : 0),
    paint: (t, a, h, b, surf, along) => (t === 2 ? M.sign_red : !surf ? M.brick : (Math.floor(h) % 3 && (((along % 3) + 3) % 3) > 1 ? M.window : M.brick)) }));
  add(landmark('Brooklyn Borough Hall', { maps, at: ll(40.69275, -73.99035), dir: bearingXZ(110), hu: 24, hw: 14, height: 40,
    shape: (a, h, b) => (box(a, b, 22, 12) ? (h < 20 ? 1 : (Math.hypot(a, b) < 5 && h < 38) ? 2 : 0) : 0),
    paint: (t) => (t === 2 ? M.white : M.marble) }));
  add(landmark("Jane's Carousel", { maps, at: ll(40.70430, -73.99180), dir: bearingXZ(90 + 30), hu: 14, hw: 14, height: 10,
    shape: (a, h, b) => (box(a, b, 12, 12) && h < 9 ? 1 : 0),
    paint: (t, a, h, b, surf) => (surf ? (h < 1 ? M.concrete : M.glass_sky) : (Math.hypot(a, b) < 8 && h < 5 ? (h < 1 ? M.red : M.yellow) : 0)) }));
  add(landmark('Domino Sugar Refinery', { maps, at: ll(40.71455, -73.96795), dir: bearingXZ(27 + 90), hu: 46, hw: 24, height: 60,
    shape: (a, h, b) => (box(a, b, 44, 22) ? (h < 40 ? 1 : (Math.abs(a - 20) < 8 && Math.abs(b) < 8 && h < 58) ? 2 : (b < -18 && h < 48 && Math.abs(a) < 30 && (((a % 4) + 4) % 4) < 3) ? 3 : 0) : 0),
    paint: (t, a, h, b, surf, along) => (t === 3 ? M.sign_yellow : !surf ? M.brick : (Math.floor(h) % 5 > 1 && (((along % 4) + 4) % 4) > 2 ? M.window : M.brick)) }));
  for (const [la, lo, H, nm] of [[40.7212, -73.9622, 130, 'The Edge'], [40.7195, -73.9630, 110, 'Northside Piers'], [40.7148, -73.9670, 160, 'The Refinery Tower'],
    [40.7355, -73.9598, 150, 'Greenpoint Landing'], [40.7340, -73.9592, 120, 'Greenpoint Landing 2'], [40.7422, -73.9595, 140, 'Hunters Point South'],
    [40.7440, -73.9590, 120, 'Hunters Point South 2'], [40.7468, -73.9570, 130, 'Gantry Tower'], [40.7490, -73.9540, 150, 'Anable Basin Tower']]) {
    simpleTower(nm, ll(la, lo), [[H, 18 + (H % 7), 16 + (H % 5)]], glassF(H % 2 ? M.glass_sky : M.glass_blue), bearingXZ(30 + 90));
  }
  add(landmark('Pepsi-Cola Sign', { maps, at: ll(40.74755, -73.95880), dir: bearingXZ(120), hu: 26, hw: 4, height: 22,
    shape: (a, h, b) => (Math.abs(b) < 1.2 && Math.abs(a) < 24 && h > 6 && h < 21 ? (h < 8 ? 2 : 1) : (Math.abs(b) < 2 && (Math.abs(a) % 8) < 1 && h < 8 && Math.abs(a) < 24 ? 2 : 0)),
    paint: (t, a, h) => (t === 2 ? M.steel : (h > 16 && Math.abs(a) < 10 ? M.sign_red : h > 9 ? M.sign_red : M.sign_white)) }));
  // Jersey City waterfront towers
  for (const [la, lo, H, nm, gm] of [[40.71480, -74.03305, 238, 'Goldman Sachs Tower (JC)', M.glass_blue], [40.71680, -74.03770, 270, '99 Hudson Street', M.glass_sky],
    [40.71450, -74.03560, 213, 'Urby Jersey City', M.white], [40.71750, -74.03930, 163, 'Trump Plaza JC', M.glass_dark], [40.72050, -74.03550, 150, 'Harborside Tower', M.glass_silver],
    [40.72640, -74.03420, 146, 'Newport Tower', M.glass_blue], [40.72800, -74.03380, 170, 'Newport Riverside', M.glass_sky], [40.72450, -74.03450, 125, 'Newport Plaza', M.glass_green],
    [40.71880, -74.03450, 190, 'Exchange Place Tower', M.glass_silver], [40.71600, -74.04010, 180, 'Journal Squared (downtown)', M.glass_sky]]) {
    simpleTower(nm, ll(la, lo), [[H * 0.25, 30, 26], [H, 22, 20, 4]], glassF(gm), bearingXZ(100));
  }
  add(landmark('Colgate Clock', { maps, at: ll(40.71540, -74.03215), dir: bearingXZ(100), hu: 9, hw: 3, height: 18,
    shape: (a, h, b) => { const r = Math.hypot(a, h - 9); return Math.abs(b) < 0.8 && r < 7.6 && (Math.abs(a) + Math.abs(h - 9) < 10.4) ? (r < 6.5 ? 2 : 1) : (Math.abs(b) < 0.8 && Math.abs(a) < 0.7 && h < 3 ? 3 : 0); },
    paint: (t, a, h) => (t === 3 ? M.steel_dark : t === 1 ? M.painted_red : ((Math.abs(a) < 0.6 && h > 9 && h < 14) || (h > 8.6 && h < 9.6 && a > 0 && a < 4) ? M.black : M.white)) }));
  add(landmark('Hoboken Terminal', { maps, at: ll(40.73555, -74.02790), dir: bearingXZ(100), hu: 70, hw: 30, height: 60,
    shape: (a, h, b) => { if (!box(a, b, 68, 28)) return 0; if (h < 16) return 1; if (h < 20 && Math.abs(a) < 30) return 2; if (Math.abs(a - 20) < 5 && Math.abs(b) < 5 && h < 58) return h < 46 ? 3 : 4; return 0; },
    paint: (t, a, h, b, surf) => (t === 4 ? M.copper_green : t === 3 ? (surf && h > 40 && h < 45 ? M.white : M.copper_green) : t === 2 ? M.copper_green : (surf && h > 5 && h < 13 ? M.glass_dark : M.copper_green)) }));
  add(landmark('CRRNJ Terminal', { maps, at: ll(40.70755, -74.03470), dir: bearingXZ(100), hu: 40, hw: 20, height: 40,
    shape: (a, h, b) => (box(a, b, 38, 18) ? (h < 18 ? 1 : (Math.abs(a) < 5 && Math.abs(b) < 5 && h < 38) ? 2 : (h < 24 && Math.abs(b) < 14) ? 3 : 0) : 0),
    paint: (t) => (t === 3 ? M.slate : t === 2 ? M.brick_dark : M.brick) }));
  // Governors Island forts
  add(landmark('Castle Williams', { maps, at: ll(40.69330, -74.01880), hu: 34, hw: 34, height: 16,
    shape: (a, h, b) => { const r = Math.hypot(a, b); return (r < 32 && r > 20 && h < 14 && !(b < -22 && Math.abs(a) < 12)) ? 1 : 0; },
    paint: (t, a, h, b, surf) => (surf && h > 4 && h < 11 && (Math.floor(Math.atan2(b, a) * 12) % 2) ? M.glass_dark : M.brownstone) }));
  add(landmark('Fort Jay', { maps, at: ll(40.69030, -74.01630), hu: 130, hw: 130, height: 12,
    shape: (a, h, b) => { const ax = Math.abs(a), bx = Math.abs(b); const star = Math.max(ax, bx) + Math.min(ax, bx) * 0.45; return (star < 110 && star > 92 && h < 10) ? 1 : (star < 92 && h < 1 ? 2 : 0); },
    paint: (t) => (t === 2 ? M.grass_lawn : M.brick) }));
  return L;
}

// 9/11 Memorial pool: 64 m square recessed 9 m, water curtains on the walls, central void
function memorialPool(maps, at, dir, name) {
  const [cx, cz] = at, ux = dir[0], uz = dir[1];
  const i = Math.round(cz) * W + Math.round(cx);
  const base = maps ? SEA + maps.elev[i] : SEA + 6;
  const r = 34, bbox = [Math.floor(cx - r * 1.5), Math.floor(cz - r * 1.5), Math.ceil(cx + r * 1.5), Math.ceil(cz + r * 1.5)];
  return {
    name, bbox, foot: orect(cx, cz, ux, uz, 33, 33), surf: M.granite_gray,
    emit(X0, Z0, R, add) {
      let n = 0;
      for (let z = Math.max(bbox[1], Z0); z <= Math.min(bbox[3], Z0 + R - 1); z++) for (let x = Math.max(bbox[0], X0); x <= Math.min(bbox[2], X0 + R - 1); x++) {
        const px = x + 0.5 - cx, pz = z + 0.5 - cz, a = px * ux + pz * uz, b = -px * uz + pz * ux;
        const aa = Math.abs(a), bb = Math.abs(b), m = Math.max(aa, bb);
        if (m > 32.5) continue;
        const xr = x - X0, zr = z - Z0;
        if (m > 30) { add(xr, zr, base - 1, base + 1, M.bronze, 2); add(xr, zr, base - 11, base, M.granite_gray, 1); n++; continue; }
        add(xr, zr, base - 10, base + 2, 0, 2);
        if (m > 29) { add(xr, zr, base - 11, base - 1, M.fountain, 1); n++; continue; }
        if (m < 9) { add(xr, zr, base - 18, base - 10, 0, 2); add(xr, zr, base - 19, base - 18, M.black, 1); if (m > 8) add(xr, zr, base - 18, base - 10, M.fountain, 1); n++; continue; }
        add(xr, zr, base - 11, base - 10, M.granite_gray, 1); add(xr, zr, base - 10, base - 9, M.fountain, 1); n++;
      }
      return n;
    },
  };
}

// Footprints kept free of generic buildings (used by the fabric generator in the main thread)
export function landmarkFootprints(maps) {
  return landmarkList(maps).filter((s) => s.foot).map((s) => ({ poly: s.foot, surf: s.surf, name: s.name }));
}
export { ellipse };

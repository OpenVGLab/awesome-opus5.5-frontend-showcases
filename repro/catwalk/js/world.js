// Builds the city around the stage data: the catwalk itself, the streets behind it,
// lamps, lanterns, neon. Static geometry is merged per material into 24 m chunks.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, WIN, winUV, neonTex } from './textures.js';

const CHUNK = 24;
const UVS = { brick: 2.4, plaster: 3, wood: 2, tiles: 1.2, concrete: 3.2, stone: 1.6, slate: 1.2, towers: 8, ground: 4 };
const C = (h) => new THREE.Color(h);
const HDR = (r, g, b) => new THREE.Color(r, g, b);
const WHITE = C(0xffffff);
const STONE = C(0xb3ab9c), STONE_DK = C(0x857f75), FRAME = C(0x26221e), IRON = C(0x18191c), WOOD_DK = C(0x2e2119);
const BRICK_T = [C(0xffffff), C(0xe6d2c8), C(0xc4ab9e), C(0xa6958c)];
const PLASTER_T = [C(0xefe0bd), C(0xc6d0b4), C(0xe3c5b7), C(0xb8c3cf), C(0xe5cb93), C(0xd6cec2)];
const LANTERN_RED = HDR(2.0, 0.42, 0.18), LANTERN_WHITE = HDR(1.25, 0.95, 0.62), LANTERN_AMBER = HDR(1.9, 0.85, 0.28);
const WARM = C(0xffb066);

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Three's bump mapping differentiates heights one screen pixel apart, so once a pixel spans
// several texels (far or grazing walls) every mortar joint becomes a 1px highlight. Sample
// the mip picked by the major axis and keep the tilt from growing past ~2.5 texels/pixel.
THREE.ShaderChunk.bumpmap_pars_fragment = THREE.ShaderChunk.bumpmap_pars_fragment
  .replace('float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;',
    `vec2 bumpTs = vec2( textureSize( bumpMap, 0 ) );
		float bumpTpp = max( max( length( dSTdx * bumpTs ), length( dSTdy * bumpTs ) ), 1.0 );
		float bumpLod = log2( bumpTpp );
		float Hll = bumpScale * textureLod( bumpMap, vBumpMapUv, bumpLod ).x;`)
  .replace('texture2D( bumpMap, vBumpMapUv + dSTdx )', 'textureLod( bumpMap, vBumpMapUv + dSTdx, bumpLod )')
  .replace('texture2D( bumpMap, vBumpMapUv + dSTdy )', 'textureLod( bumpMap, vBumpMapUv + dSTdy, bumpLod )')
  .replace('return vec2( dBx, dBy );', 'return vec2( dBx, dBy ) * min( 1.0, 2.5 / bumpTpp );');

// ── geometry helpers ───────────────────────────────────────────────────────
function box(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(Math.max(1e-3, x1 - x0), Math.max(1e-3, y1 - y0), Math.max(1e-3, z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cylX = (r, len, seg = 10) => cyl(r, r, len, seg).rotateZ(Math.PI / 2);
const cylZ = (r, len, seg = 10) => cyl(r, r, len, seg).rotateX(Math.PI / 2);
function quad(x0, y0, x1, y1, z, uv) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  if (uv) {
    const a = g.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
  }
  return g;
}
function lanternGeo(s = 1) {
  const pts = [[0.03, -0.215], [0.1, -0.2], [0.155, -0.14], [0.175, -0.05], [0.175, 0.05], [0.155, 0.14], [0.1, 0.2], [0.03, 0.215]]
    .map(([r, y]) => new THREE.Vector2(r * s, y * s));
  const g = new THREE.LatheGeometry(pts, 14);
  g.rotateY(-Math.PI / 2);
  return g;
}
function catenary(x0, y0, z0, x1, y1, z1, sag, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag * 4 * t * (1 - t), z0 + (z1 - z0) * t));
  }
  return new THREE.CatmullRomCurve3(pts);
}

function worldUV(geo, s) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u / s, v / s);
  }
}

class Batcher {
  constructor() { this.groups = new Map(); }

  add(key, geo, color = WHITE, opts = {}) {
    if (!geo.index) {
      const n = geo.attributes.position.count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (UVS[key] && !opts.keepUV) worldUV(geo, UVS[key]);
    const pos = geo.attributes.position;
    const n = pos.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let f = 1;
      if (opts.ao) f = opts.ao[2] + (1 - opts.ao[2]) * smoothstep(opts.ao[0], opts.ao[1], pos.getY(i));
      col[i * 3] = color.r * f; col[i * 3 + 1] = color.g * f; col[i * 3 + 2] = color.b * f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingBox();
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    const chunk = Math.floor(cx / CHUNK);
    const k = key + '|' + chunk;
    if (!this.groups.has(k)) this.groups.set(k, { key, list: [] });
    this.groups.get(k).list.push(geo);
  }

  build(mats, parent) {
    let draws = 0;
    for (const g of this.groups.values()) {
      const merged = mergeGeometries(g.list, false);
      const mat = mats[g.key];
      const mesh = new THREE.Mesh(merged, mat);
      mesh.receiveShadow = !!mat.userData.receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      if (mat.userData.order !== undefined) mesh.renderOrder = mat.userData.order;
      parent.add(mesh);
      for (const geo of g.list) geo.dispose();
      draws++;
    }
    return draws;
  }
}

function makeMaterials(tex) {
  const std = (o, receive = true) => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...o });
    m.userData.receive = receive;
    return m;
  };
  const add = (o) => {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...o });
    m.userData.order = 5;
    return m;
  };
  return {
    brick: std({ map: tex.brick.map, bumpMap: tex.brick.bump, bumpScale: 2.2, roughness: 0.9 }),
    plaster: std({ map: tex.plaster.map, bumpMap: tex.plaster.bump, bumpScale: 1.2, roughness: 0.95 }),
    wood: std({ map: tex.wood.map, bumpMap: tex.wood.bump, bumpScale: 1.4, roughness: 0.82 }),
    tiles: std({ map: tex.tiles.map, bumpMap: tex.tiles.bump, bumpScale: 2.4, roughness: 0.5, metalness: 0.15 }),
    concrete: std({ map: tex.concrete.map, bumpMap: tex.concrete.bump, bumpScale: 1.2, roughness: 0.9 }),
    stone: std({ map: tex.stone.map, bumpMap: tex.stone.bump, bumpScale: 1.4, roughness: 0.85 }),
    slate: std({ map: tex.slate.map, bumpMap: tex.slate.bump, bumpScale: 1.6, roughness: 0.55, metalness: 0.1 }),
    ground: std({ map: tex.concrete.map, roughness: 0.75, metalness: 0.1 }),
    paint: std({ roughness: 0.7 }),
    metal: std({ roughness: 0.58, metalness: 0.6 }),
    foliage: std({ roughness: 0.95 }),
    fabric: std({ roughness: 0.95, side: THREE.DoubleSide }),
    grille: std({ map: tex.grille, roughness: 0.5, metalness: 0.4 }),
    awningR: std({ map: tex.awningRed, roughness: 0.9, side: THREE.DoubleSide }),
    awningB: std({ map: tex.awningBlue, roughness: 0.9, side: THREE.DoubleSide }),
    noren: std({ map: tex.noren, roughness: 0.95, side: THREE.DoubleSide }),
    sign0: std({ map: tex.signs[0], roughness: 0.7 }),
    sign1: std({ map: tex.signs[1], roughness: 0.7 }),
    sign2: std({ map: tex.signs[2], roughness: 0.7 }),
    billboard: std({ map: tex.billboard, emissiveMap: tex.billboard, emissive: C(0x555555), roughness: 0.6 }),
    winLit: new THREE.MeshBasicMaterial({ map: tex.windows, vertexColors: true }),
    winDark: std({ map: tex.windows, roughness: 0.14, metalness: 0.35 }),
    towers: new THREE.MeshBasicMaterial({ map: tex.towers, vertexColors: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    lantern: new THREE.MeshBasicMaterial({ map: tex.lantern, vertexColors: true }),
    clock: new THREE.MeshBasicMaterial({ map: tex.clock, vertexColors: true }),
    spill: add({ map: tex.glow, fog: true }),
    halo: add({ map: tex.glow, fog: false }),
  };
}

// ── the builder ────────────────────────────────────────────────────────────
export function buildWorld(scene, stage, tex) {
  const root = new THREE.Group();
  scene.add(root);
  const mats = makeMaterials(tex);
  const ctx = {
    batch: new Batcher(),
    r: rng(2026),
    stage,
    sources: [],
    shadowCounter: 0,
    cones: [],
    neon: [],
    root,
    mats,
    tex,
    garlands: [],
    trains: [],
    beacons: [],
  };
  const secX = stage.sections.map((s) => s.x0);
  const end = stage.length;

  ground(ctx, -40, end + 60);
  gaslight(ctx, -16, secX[1]);
  lanternAlley(ctx, secX[1], secX[2]);
  neonHeights(ctx, secX[2], secX[3]);
  moonrise(ctx, secX[3], end + 40);
  for (const p of stage.plats) platform(ctx, p);
  for (const o of stage.oneways) oneway(ctx, o);
  for (const b of stage.blocks) blockProp(ctx, b);
  for (const c of stage.ceilings) ceilingProp(ctx, c);
  for (const h of stage.hazards) if (h.kind === 'vent') ventProp(ctx, h);

  const draws = ctx.batch.build(mats, root);
  const cones = buildCones(ctx);
  if (cones) root.add(cones);

  return {
    root,
    sources: ctx.sources,
    neon: ctx.neon,
    cones,
    trains: ctx.trains,
    beacons: ctx.beacons,
    mats,
    draws,
    update(t, camX) {
      for (const n of ctx.neon) {
        const k = n.flicker ? neonFlicker(t, n.phase) : 1;
        n.mesh.material.color.copy(n.color).multiplyScalar(k * (0.92 + 0.08 * Math.sin(t * 2 + n.phase)));
        if (n.source) n.source.level = k;
      }
      if (cones) cones.material.uniforms.uTime.value = t;
      for (const tr of ctx.trains) {
        const x = tr.x0 + ((t + tr.offset) % tr.period) * tr.speed;
        tr.group.position.x = x;
        tr.group.visible = x < tr.x1 && camX < tr.end && Math.abs(x + 12 - camX) < 70;
      }
      for (const b of ctx.beacons) b.material.opacity = Math.sin(t * 2.2 + b.userData.p) > 0.6 ? 1 : 0.15;
    },
  };
}

function neonFlicker(t, p) {
  const k = Math.sin(t * 0.9 + p * 13.1) + Math.sin(t * 2.3 + p * 7.7);
  if (k > 1.85) return Math.sin(t * 60) > 0 ? 0.15 : 1;
  return 1;
}

function source(ctx, x, y, z, color, intensity, distance, o = {}) {
  const s = {
    x, y, z, color: new THREE.Color(color), intensity, distance,
    shadow: !!o.shadow, flicker: o.flicker ?? 0, phase: ctx.r() * 100, kind: o.kind || 'lamp',
    on: o.on ?? true, level: 1, priority: o.priority || 1, shadowSlot: 0,
  };
  if (s.shadow) s.shadowSlot = ctx.shadowCounter++;
  ctx.sources.push(s);
  return s;
}

function halo(ctx, x, y, z, size, color) {
  ctx.batch.add('halo', quad(x - size / 2, y - size / 2, x + size / 2, y + size / 2, z, [0, 0, 1, 1]), color, { keepUV: true });
}

function spill(ctx, x0, y0, x1, y1, z, color) {
  ctx.batch.add('spill', quad(x0, y0, x1, y1, z, [0, 0, 1, 1]), color, { keepUV: true });
}

const LIT = new Set([WIN.curtains, WIN.plant, WIN.blinds, WIN.figure, WIN.dim, WIN.shoji, WIN.shojiFigure, WIN.koshi, WIN.round, WIN.office, WIN.tv]);
function pickWin(r, style) {
  const k = r();
  if (style === 'west') {
    if (k < 0.48) return [WIN.curtains, WIN.plant, WIN.blinds, WIN.figure, WIN.curtains][Math.floor(r() * 5)];
    if (k < 0.58) return WIN.dim;
    if (k < 0.61) return WIN.catSill;
    return r() < 0.6 ? WIN.dark : WIN.darkBlue;
  }
  if (style === 'shoji') return k < 0.55 ? WIN.shoji : k < 0.72 ? WIN.shojiFigure : k < 0.88 ? WIN.koshi : WIN.round;
  if (k < 0.3) return WIN.office;
  if (k < 0.42) return WIN.tv;
  if (k < 0.55) return WIN.neonReflect;
  return WIN.modernDark;
}
function litColor(r, v) {
  const k = 0.5 + r() * 0.45;
  if (v === WIN.tv) return HDR(0.7 * k, 0.85 * k, 1.2 * k);
  if (v === WIN.office) return HDR(0.75 * k, 0.85 * k, 0.9 * k);
  if (v === WIN.dim) return HDR(0.8, 0.7, 0.6);
  if (v >= WIN.shoji && v <= WIN.round) return HDR(0.9 * k, 0.66 * k, 0.44 * k);
  return HDR(1.1 * k, 0.82 * k, 0.58 * k);
}

function addWindow(ctx, cx, y0, w, h, z, v, o = {}) {
  const { batch, r } = ctx;
  const t = o.frameW ?? 0.07;
  const fc = o.frame ?? FRAME;
  batch.add('paint', box(cx - w / 2 - t, cx - w / 2, y0 - t, y0 + h + t, z - 0.02, z + 0.06), fc);
  batch.add('paint', box(cx + w / 2, cx + w / 2 + t, y0 - t, y0 + h + t, z - 0.02, z + 0.06), fc);
  batch.add('paint', box(cx - w / 2, cx + w / 2, y0 + h, y0 + h + t, z - 0.02, z + 0.06), fc);
  if (o.sill !== false) batch.add('stone', box(cx - w / 2 - 0.12, cx + w / 2 + 0.12, y0 - 0.11, y0, z - 0.02, z + 0.13), o.sillColor ?? STONE);
  if (o.lintel) batch.add('stone', box(cx - w / 2 - 0.1, cx + w / 2 + 0.1, y0 + h + t, y0 + h + t + 0.17, z - 0.02, z + 0.07), STONE);
  const lit = LIT.has(v);
  batch.add(lit ? 'winLit' : 'winDark', quad(cx - w / 2, y0, cx + w / 2, y0 + h, z + 0.012, winUV(v)), lit ? litColor(r, v) : C(0x9aa0aa), { keepUV: true });
  if (lit && o.spill !== false && r() < 0.8) {
    const warm = v === WIN.tv || v === WIN.office ? HDR(0.05, 0.08, 0.12) : HDR(0.16, 0.09, 0.04);
    spill(ctx, cx - w * 1.3, y0 - h * 0.6, cx + w * 1.3, y0 + h * 1.4, z + 0.02, warm);
  }
  if (o.shutters) {
    const sc = o.shutters;
    batch.add('paint', box(cx - w / 2 - t - 0.45, cx - w / 2 - t - 0.02, y0, y0 + h, z + 0.02, z + 0.06), sc);
    batch.add('paint', box(cx + w / 2 + t + 0.02, cx + w / 2 + t + 0.45, y0, y0 + h, z + 0.02, z + 0.06), sc);
  }
  if (o.flowers) {
    batch.add('wood', box(cx - w / 2, cx + w / 2, y0 - 0.3, y0 - 0.11, z + 0.02, z + 0.26), WOOD_DK);
    for (let i = 0; i < 7; i++) {
      const fx = cx - w / 2 + 0.08 + (i / 6) * (w - 0.16);
      const g = new THREE.IcosahedronGeometry(0.09 + r() * 0.04, 0);
      g.translate(fx, y0 - 0.06 + r() * 0.05, z + 0.15);
      batch.add('foliage', g, r() < 0.5 ? C(0x2c4a26) : C(0x7a2a36));
    }
  }
}

function ground(ctx, x0, x1) {
  ctx.batch.add('ground', box(x0, x1, -0.3, 0, -60, 12), C(0x38383d));
}

// ── I · Gaslight Lane ──────────────────────────────────────────────────────
function gaslight(ctx, x0, x1) {
  const { batch, r } = ctx;
  const zf = -2.6;
  let x = x0;
  while (x < x1 + 8) {
    const w = 5.2 + r() * 3.6;
    const low = r() < 0.3;
    const H = low ? 5.0 + r() * 1.0 : 7.2 + r() * 4.2;
    townhouse(ctx, x, x + w, H, zf);
    x += w + (r() < 0.26 ? 1.0 + r() * 1.5 : 0.02);
  }
  // gardens behind the walls: shrubs that show through the gaps
  for (let sx = x0; sx < x1; sx += 1.6 + r() * 2.2) {
    const g = new THREE.IcosahedronGeometry(0.5 + r() * 0.5, 1);
    g.scale(1.3, 0.8 + r() * 0.6, 0.9);
    g.translate(sx, 0.5 + r() * 0.5, -1.3 - r() * 0.8);
    batch.add('foliage', g, r() < 0.5 ? C(0x1f2e1c) : C(0x26361f));
  }
  // back row of taller houses peeking over the front row
  for (let bx = x0; bx < x1 + 10; bx += 7 + r() * 5) {
    const w = 6 + r() * 5, H = 10 + r() * 6;
    batch.add(r() < 0.5 ? 'brick' : 'plaster', box(bx, bx + w, 0, H, -16, -10), BRICK_T[3], { ao: [0, 8, 0.6] });
    for (let fy = 6.5; fy < H - 1; fy += 2.8) {
      for (let wx = bx + 0.8; wx < bx + w - 0.8; wx += 1.7) {
        const v = pickWin(r, 'west');
        if (r() < 0.6) addWindow(ctx, wx, fy, 0.9, 1.4, -10, v, { spill: false });
      }
    }
    if (r() < 0.6) batch.add('brick', box(bx + w * 0.3, bx + w * 0.3 + 0.6, H, H + 1.2, -13.5, -12.8), BRICK_T[2]);
  }
  for (const d of ctx.stage.deco) {
    if (d.type !== 'lamp') continue;
    const gy = ctx.stage.groundAt(d.x);
    gasLamp(ctx, d.x, gy > -Infinity ? gy : ctx.stage.pathY(d.x));
  }
}

function townhouse(ctx, x0, x1, H, zf) {
  const { batch, r } = ctx;
  const brick = r() < 0.5;
  const key = brick ? 'brick' : 'plaster';
  const tint = brick ? BRICK_T[Math.floor(r() * BRICK_T.length)] : PLASTER_T[Math.floor(r() * PLASTER_T.length)];
  batch.add(key, box(x0, x1, 0, H, zf - 7, zf), tint, { ao: [0, 3, 0.42] });
  batch.add('stone', box(x0 - 0.08, x1 + 0.08, H - 0.34, H - 0.12, zf - 0.1, zf + 0.18), STONE);
  batch.add('stone', box(x0 - 0.13, x1 + 0.13, H - 0.12, H, zf - 0.1, zf + 0.25), STONE_DK);
  for (const y of [3.15, 5.95, 8.75]) if (y < H - 1) batch.add('stone', box(x0, x1, y, y + 0.13, zf, zf + 0.07), STONE_DK);
  const shutters = r() < 0.35 ? [C(0x2f4a3a), C(0x3a4a66), C(0x6a2f2a)][Math.floor(r() * 3)] : null;
  const n = Math.max(1, Math.floor((x1 - x0 - 0.5) / 1.85));
  const ww = 0.92 + r() * 0.18;
  for (const fy of [3.5, 6.3, 9.1]) {
    if (fy + 1.6 > H - 0.45) continue;
    for (let i = 0; i < n; i++) {
      const cx = x0 + ((x1 - x0) * (i + 0.5)) / n;
      addWindow(ctx, cx, fy, ww, 1.55, zf, pickWin(r, 'west'), { shutters: shutters && ww < 1.0 ? shutters : null, flowers: r() < 0.22, lintel: brick });
    }
  }
  // ground floor, seen through gaps in the garden walls
  const door = x0 + 0.8 + r() * (x1 - x0 - 2.2);
  batch.add('paint', box(door - 0.5, door + 0.5, 0, 2.2, zf - 0.02, zf + 0.04), FRAME);
  batch.add('wood', box(door - 0.42, door + 0.42, 0, 2.1, zf + 0.02, zf + 0.06), C(0x5a2a22));
  spill(ctx, door - 1.1, 0.2, door + 1.1, 2.0, zf + 0.07, HDR(0.05, 0.03, 0.012));
  for (let i = 0; i < n; i++) {
    const cx = x0 + ((x1 - x0) * (i + 0.5)) / n;
    if (Math.abs(cx - door) < 1.2) continue;
    const gv = pickWin(r, 'west');
    addWindow(ctx, cx, 0.7, ww, 1.6, zf, gv === WIN.curtains ? WIN.blinds : gv, { spill: false });
  }
  // drainpipe
  batch.add('metal', cyl(0.04, 0.04, H, 6).translate(x1 - 0.18, H / 2, zf + 0.1), IRON);
  if (H < 7) pitchedRoof(ctx, x0, x1, H, zf, key, tint);
  else if (r() < 0.5) batch.add('brick', box(x0 + 0.6, x0 + 1.2, H, H + 1.0, zf - 1.5, zf - 0.9), BRICK_T[1]);
  // iron balcony on the first floor
  if (r() < 0.3 && H > 6.5) {
    const bx0 = x0 + 0.5, bx1 = x1 - 0.5;
    batch.add('stone', box(bx0, bx1, 3.3, 3.42, zf, zf + 0.55), STONE_DK);
    batch.add('metal', box(bx0, bx1, 4.2, 4.24, zf + 0.5, zf + 0.54), IRON);
    for (let bx = bx0; bx <= bx1; bx += 0.14) batch.add('metal', box(bx, bx + 0.018, 3.42, 4.2, zf + 0.51, zf + 0.53), IRON);
  }
  // a projecting bracket sign
  if (r() < 0.28) {
    const sx = x0 + 0.4;
    batch.add('metal', box(sx - 0.02, sx + 0.02, 5.0, 5.04, zf, zf + 1.0), IRON);
    batch.add('sign' + Math.floor(r() * 3), box(sx - 0.03, sx + 0.03, 4.35, 4.95, zf + 0.2, zf + 0.95), C(0xcfc2b0));
  }
}

function prismX(x0, x1, zA, zB, y0, h) {
  const sh = new THREE.Shape();
  sh.moveTo(zB, y0); sh.lineTo(zA, y0); sh.lineTo((zA + zB) / 2, y0 + h); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(x1, 0, 0);
  return g;
}
// [gable ends, roof slopes] — the extrusion keeps lids and sides as separate groups
function prismParts(g) {
  return g.groups.map(({ start, count }) => {
    const part = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) {
      const a = g.attributes[k];
      part.setAttribute(k, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
    }
    return part;
  });
}

// gables take the wall material: slate on a side-facing triangle glints with the moon
function pitchedRoof(ctx, x0, x1, H, zf, wall, tint) {
  const [gables, slopes] = prismParts(prismX(x0 - 0.12, x1 + 0.12, zf + 0.25, zf - 7.2, H, 2.3));
  ctx.batch.add('slate', slopes, C(0xbfc3cc));
  ctx.batch.add(wall, gables, tint);
  if (ctx.r() < 0.8) {
    const cx = x0 + 1 + ctx.r() * (x1 - x0 - 2);
    ctx.batch.add('brick', box(cx - 0.3, cx + 0.3, H + 0.5, H + 2.6, zf - 2.6, zf - 2.0), BRICK_T[1]);
    ctx.batch.add('stone', box(cx - 0.36, cx + 0.36, H + 2.6, H + 2.7, zf - 2.66, zf - 1.94), STONE_DK);
    ctx.batch.add('paint', cyl(0.08, 0.1, 0.35, 8).translate(cx - 0.12, H + 2.85, zf - 2.3), C(0x6a3a2a));
    ctx.batch.add('paint', cyl(0.08, 0.1, 0.3, 8).translate(cx + 0.14, H + 2.82, zf - 2.3), C(0x6a3a2a));
  }
  if (ctx.r() < 0.6) {
    const dx = (x0 + x1) / 2;
    ctx.batch.add('plaster', box(dx - 0.55, dx + 0.55, H, H + 1.2, zf - 1.5, zf - 0.55), PLASTER_T[5]);
    const [dGables, dSlopes] = prismParts(prismX(dx - 0.65, dx + 0.65, zf - 0.45, zf - 1.6, H + 1.2, 0.5));
    ctx.batch.add('slate', dSlopes, C(0xbfc3cc));
    ctx.batch.add('plaster', dGables, PLASTER_T[5]);
    addWindow(ctx, dx, H + 0.25, 0.6, 0.7, zf - 0.55, pickWin(ctx.r, 'west'), { sill: false, frameW: 0.05 });
  }
}

function gasLamp(ctx, x, py) {
  const { batch } = ctx;
  const z = -0.95, top = py + 2.35;
  const hy = py + 1.93, hz = -0.1;
  batch.add('metal', cyl(0.12, 0.16, 0.55, 8).translate(x, 0.27, z), IRON);
  batch.add('metal', cyl(0.042, 0.058, top, 8).translate(x, top / 2, z), IRON);
  batch.add('metal', cyl(0.075, 0.075, 0.14, 8).translate(x, py - 0.25, z), IRON);
  const arm = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, top - 0.05, z), new THREE.Vector3(x, top + 0.2, hz - 0.05), new THREE.Vector3(x, hy + 0.3, hz));
  batch.add('metal', new THREE.TubeGeometry(arm, 12, 0.024, 6), IRON);
  batch.add('metal', cyl(0.02, 0.17, 0.13, 6).translate(x, hy + 0.22, hz), IRON);
  batch.add('glow', cyl(0.12, 0.085, 0.3, 6).translate(x, hy, hz), HDR(3.4, 2.2, 1.0));
  batch.add('glow', new THREE.SphereGeometry(0.05, 8, 6).translate(x, hy, hz), HDR(9, 6, 3));
  batch.add('metal', cyl(0.05, 0.075, 0.06, 6).translate(x, hy - 0.18, hz), IRON);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    batch.add('metal', box(-0.008, 0.008, -0.15, 0.15, -0.008, 0.008).translate(x + Math.cos(a) * 0.105, hy, hz + Math.sin(a) * 0.105), IRON);
  }
  source(ctx, x, hy - 0.04, hz, 0xffae62, 10, 12, { shadow: true, flicker: 0.035 });
  source(ctx, x + 0.6, py - 0.7, 2.4, 0xff9a52, 5.5, 7, { kind: 'street', priority: 0.9 });
  ctx.cones.push({ x, y: hy - 0.14, z: hz, h: 2.4, r: 1.15, color: HDR(0.22, 0.13, 0.055) });
  halo(ctx, x, hy, hz + 0.05, 1.3, HDR(0.9, 0.55, 0.25));
}

// ── II · Lantern Alley ─────────────────────────────────────────────────────
function lanternAlley(ctx, x0, x1) {
  const { batch, r, stage } = ctx;
  // back row of old houses with glowing paper screens
  for (let bx = x0 - 4; bx < x1 + 4; bx += 5 + r() * 3) {
    const w = 4.5 + r() * 3, H = 7.5 + r() * 3.5;
    batch.add('wood', box(bx, bx + w, 0, H, -14, -7.5), C(0x9a8a80), { ao: [0, 6, 0.5] });
    for (let fy = 4.6; fy < H - 1.4; fy += 2.6) {
      for (let wx = bx + 0.9; wx < bx + w - 0.8; wx += 1.6) if (r() < 0.75) addWindow(ctx, wx, fy, 1.1, 1.2, -7.5, pickWin(r, 'shoji'), { sill: false, frame: WOOD_DK, spill: false });
    }
    const g = box(bx - 0.4, bx + w + 0.4, -0.05, 0.05, -1.8, 1.8);
    g.rotateX(0.5);
    g.translate(0, H + 0.85, -9.4);
    batch.add('tiles', g, C(0x8a90a0));
  }
  // festival garlands strung in front of the catwalk
  for (let gx = x0 + 3; gx < x1 - 4; gx += 9.5) {
    const y = stage.pathY(gx + 3) + 2.05;
    garland(ctx, gx, gx + 6.5, y, 1.15);
  }
  // a pagoda far away, against the sky
  const px = x0 + 40, pz = -58;
  for (let i = 0; i < 5; i++) {
    const w = 7 - i * 1.05, y = 4 + i * 3.4;
    batch.add('paint', box(px - w / 2 + 0.8, px + w / 2 - 0.8, y - 3.4, y, pz - 2, pz + 2), C(0x1a1420));
    const roof = box(px - w / 2 - 0.9, px + w / 2 + 0.9, y - 0.25, y + 0.2, pz - 2.9, pz + 2.9);
    batch.add('paint', roof, C(0x120e18));
    if (i < 4) batch.add('glow', box(px - 0.5, px + 0.5, y - 2.4, y - 1.2, pz + 2.01, pz + 2.05), HDR(1.8, 0.9, 0.4));
  }
  batch.add('metal', cyl(0.1, 0.25, 5, 6).translate(px, 4 + 5 * 3.4 + 2.2, pz), C(0x1a1420));
}

function garland(ctx, x0, x1, y, z) {
  const { batch, r } = ctx;
  const sag = 0.35;
  const curve = catenary(x0, y + 0.25, z, x1, y + 0.25, z, sag, 20);
  batch.add('paint', new THREE.TubeGeometry(curve, 24, 0.012, 4), C(0x1a1410));
  const n = Math.round((x1 - x0) / 0.55);
  const lg = lanternGeo(0.85);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = curve.getPoint(t);
    const col = i % 3 === 0 ? LANTERN_WHITE : LANTERN_RED;
    batch.add('lantern', lg.clone().translate(p.x, p.y - 0.24, p.z), col, { keepUV: true });
    batch.add('paint', cyl(0.05, 0.05, 0.035, 8).translate(p.x, p.y - 0.06, p.z), C(0x140c08));
    batch.add('paint', cyl(0.05, 0.05, 0.035, 8).translate(p.x, p.y - 0.42, p.z), C(0x140c08));
  }
  source(ctx, (x0 + x1) / 2, y - 0.1, z, 0xff7a3c, 5.5, 8, { kind: 'lantern', flicker: 0.02 });
}

function hangLanterns(ctx, x0, x1, yTop, z, color, withSource = true) {
  const n = Math.max(1, Math.round((x1 - x0) / 0.5));
  const lg = lanternGeo(1);
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    ctx.batch.add('paint', cyl(0.006, 0.006, 0.14, 4).translate(x, yTop - 0.07, z), C(0x140c08));
    ctx.batch.add('paint', cyl(0.055, 0.055, 0.04, 8).translate(x, yTop - 0.16, z), C(0x140c08));
    ctx.batch.add('lantern', lg.clone().translate(x, yTop - 0.39, z), typeof color === 'function' ? color(i) : color, { keepUV: true });
    ctx.batch.add('paint', cyl(0.055, 0.055, 0.04, 8).translate(x, yTop - 0.62, z), C(0x140c08));
  }
  if (withSource) source(ctx, (x0 + x1) / 2, yTop - 0.45, z + 0.3, 0xff6a36, 5, 7.5, { kind: 'lantern', flicker: 0.03 });
}

function machiya(ctx, x0, x1, y) {
  const { batch, r } = ctx;
  const zG = -0.5, zU = -1.9;
  batch.add('wood', box(x0, x1, 0, y - 0.3, zG - 6, zG), C(0xc9b8a8), { ao: [0, 2.5, 0.5] });
  const n = Math.max(1, Math.round((x1 - x0) / 2.2));
  for (let i = 0; i < n; i++) {
    const cx = x0 + ((x1 - x0) * (i + 0.5)) / n;
    if (i % 2 === 0) {
      addWindow(ctx, cx, y - 1.95, 1.5, 1.3, zG, WIN.koshi, { sill: false, frame: WOOD_DK, frameW: 0.08 });
    } else {
      batch.add('paint', box(cx - 0.62, cx + 0.62, 0, y - 0.55, zG - 0.03, zG + 0.02), C(0x100c0a));
      const nr = quad(cx - 0.6, y - 1.55, cx + 0.6, y - 0.55, zG + 0.08, [0, 0, 1, 1]);
      batch.add('noren', nr, WHITE, { keepUV: true });
      batch.add('glow', box(cx - 0.55, cx + 0.55, 0, y - 1.6, zG - 0.02, zG + 0.0), HDR(0.9, 0.5, 0.22));
    }
  }
  // eave: fascia, walking edge, round tile ends, sloped roof
  batch.add('wood', box(x0, x1, y - 0.34, y - 0.12, zG, 0.3), WOOD_DK);
  batch.add('tiles', box(x0, x1, y - 0.12, y, -0.25, 0.34), C(0xa8aebb));
  for (let x = x0 + 0.13; x < x1 - 0.06; x += 0.26) batch.add('tiles', cylZ(0.07, 0.07, 10).translate(x, y - 0.06, 0.37), C(0x7d8494), { keepUV: false });
  const sl = box(x0, x1, -0.04, 0.04, -0.95, 0.95);
  sl.rotateX(0.36);
  sl.translate(0, y + 0.3, -1.1);
  batch.add('tiles', sl, C(0xc0c6d2));
  // lanterns hanging under the eave
  for (let lx = x0 + 0.9; lx < x1 - 0.5; lx += 2.4) {
    hangLanterns(ctx, lx - 0.25, lx + 0.25, y - 0.34, 0.12, r() < 0.7 ? LANTERN_RED : LANTERN_WHITE, false);
  }
  source(ctx, (x0 + x1) / 2, y - 0.8, 0.5, 0xff7440, 4.5 + (x1 - x0) * 0.25, 8, { kind: 'lantern', flicker: 0.03 });
  // upper floor with paper screens
  const uH = 2.55 + r() * 0.5;
  batch.add('plaster', box(x0 + 0.05, x1 - 0.05, y + 0.3, y + uH, zU - 6, zU), C(0xe2d8c4), { ao: [y + 0.3, y + 1.2, 0.55] });
  for (let px = x0 + 0.05; px <= x1 - 0.05; px += (x1 - x0 - 0.1) / Math.max(1, Math.round((x1 - x0) / 1.8))) {
    batch.add('wood', box(px - 0.07, px + 0.07, y + 0.3, y + uH, zU, zU + 0.07), WOOD_DK);
  }
  batch.add('wood', box(x0, x1, y + uH - 0.2, y + uH, zU, zU + 0.08), WOOD_DK);
  const m = Math.max(1, Math.round((x1 - x0) / 1.8));
  for (let i = 0; i < m; i++) {
    const cx = x0 + ((x1 - x0) * (i + 0.5)) / m;
    if (r() < 0.85) addWindow(ctx, cx, y + 0.78, 1.15, 1.2, zU, pickWin(r, 'shoji'), { sill: false, frame: WOOD_DK, frameW: 0.05 });
  }
  const up = box(x0 - 0.2, x1 + 0.2, -0.05, 0.05, -1.5, 1.5);
  up.rotateX(0.42);
  up.translate(0, y + uH + 0.55, zU - 1.25);
  batch.add('tiles', up, C(0xb4bac8));
  // a vertical shop sign between houses
  if (r() < 0.6) {
    const sx = x0 + 0.25;
    batch.add('wood', box(sx - 0.05, sx + 0.05, y + 0.5, y + 2.2, zU + 0.1, zU + 0.9), WOOD_DK);
    batch.add('glow', box(sx - 0.055, sx + 0.055, y + 0.62, y + 2.08, zU + 0.18, zU + 0.82), r() < 0.5 ? HDR(2.4, 0.5, 0.25) : HDR(2.2, 1.7, 1.0));
  }
}

function balconyHouse(ctx, x0, x1, y) {
  const { batch, r } = ctx;
  const zb = -1.1;
  batch.add('wood', box(x0, x1, 0, y + 2.5, zb - 6, zb), C(0xb8a898), { ao: [0, 3, 0.5] });
  const n = Math.max(1, Math.round((x1 - x0) / 1.7));
  for (let i = 0; i < n; i++) {
    const cx = x0 + ((x1 - x0) * (i + 0.5)) / n;
    addWindow(ctx, cx, y - 0.8, 1.3, 1.9, zb, r() < 0.7 ? WIN.shoji : WIN.shojiFigure, { sill: false, frame: WOOD_DK, frameW: 0.06 });
    addWindow(ctx, cx, y - 3.6, 1.2, 1.4, -0.6, WIN.koshi, { sill: false, frame: WOOD_DK });
  }
  batch.add('wood', box(x0, x1, 0, y - 0.95, -6, -0.6), C(0xc0b0a0), { ao: [0, 2.5, 0.5] });
  batch.add('wood', box(x0, x1, y - 0.97, y - 0.87, zb, 0.3), WOOD_DK);
  batch.add('wood', box(x0, x1, y - 0.08, y, -0.1, 0.13), C(0x6a4a34));
  for (let bx = x0 + 0.06; bx < x1 - 0.03; bx += 0.15) batch.add('wood', box(bx, bx + 0.04, y - 0.87, y - 0.08, -0.02, 0.05), C(0x5a3e2c));
  for (let bx = x0; bx <= x1; bx += 1.4) batch.add('wood', box(bx, bx + 0.09, y - 0.87, y - 0.02, -0.06, 0.1), WOOD_DK);
  const up = box(x0 - 0.3, x1 + 0.3, -0.05, 0.05, -1.4, 1.4);
  up.rotateX(0.42);
  up.translate(0, y + 3.0, zb - 0.9);
  batch.add('tiles', up, C(0xb4bac8));
  source(ctx, (x0 + x1) / 2, y + 0.7, -0.4, 0xffb070, 4, 7, { kind: 'lantern' });
  hangLanterns(ctx, x0 + 1.0, x0 + 1.5, y - 0.9, 0.2, LANTERN_WHITE, false);
  hangLanterns(ctx, x1 - 1.5, x1 - 1.0, y - 0.9, 0.2, LANTERN_RED, false);
}

// ── III · Neon Heights ─────────────────────────────────────────────────────
const NEON_WORDS = [['HOTEL LUNA', 0xff4fa0], ['NOODLES', 0x3fe0ff], ['JAZZ', 0xffb040], ['CAT CAFÉ', 0x7dffb0], ['BAR', 0xff5050], ['24H', 0x7da0ff]];

function neonHeights(ctx, x0, x1) {
  const { batch, r } = ctx;
  // background towers
  for (let bx = x0 - 30; bx < x1 - 6; bx += 7 + r() * 9) {
    const w = 7 + r() * 10, d = 8 + r() * 6, H = 22 + r() * 34, z = -24 - r() * 26;
    const k = (0.3 + r() * 0.16) * (1 - (-24 - z) / 26 * 0.35);
    batch.add('towers', box(bx, bx + w, 0, H, z - d, z), HDR(k, k * (0.95 + r() * 0.1), k * (1.05 + r() * 0.15)));
    batch.add('metal', box(bx + w * 0.2, bx + w * 0.8, H, H + 0.8, z - d * 0.7, z - d * 0.3), C(0x1a1d24));
    if (r() < 0.5) {
      const bgeo = new THREE.SphereGeometry(0.18, 8, 6);
      const b = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ color: HDR(4, 0.4, 0.3), transparent: true }));
      b.position.set(bx + w / 2, H + 1.2, z - d / 2);
      b.userData.p = r() * 10;
      ctx.root.add(b);
      ctx.beacons.push(b);
    }
    if (r() < 0.55) {
      const [word, col] = NEON_WORDS[Math.floor(r() * NEON_WORDS.length)];
      neonSign(ctx, bx + w / 2, H * (0.55 + r() * 0.3), z + 0.05, Math.min(w * 0.8, 5), word, col, false, 0.9);
    }
  }
  // elevated railway with a passing train
  const ty = 11.5, tz = -19, vx0 = x0 - 60, vx1 = x1 + 60;
  batch.add('concrete', box(vx0, vx1, ty - 0.9, ty - 0.2, tz - 1.6, tz + 1.6), C(0x6a6e78));
  for (let px = x0 - 50; px < x1 + 50; px += 14) batch.add('concrete', box(px - 0.5, px + 0.5, 0, ty - 0.9, tz - 0.6, tz + 0.6), C(0x5a5e68));
  // The deck faces away from the moon and reads as a black band; railing, masts
  // and a string of deck lamps give it a railway silhouette against the towers.
  batch.add('metal', box(vx0, vx1, ty + 0.4, ty + 0.46, tz + 1.5, tz + 1.56), IRON);
  for (let px = vx0; px < vx1; px += 1.1) batch.add('metal', box(px - 0.025, px + 0.025, ty - 0.2, ty + 0.4, tz + 1.5, tz + 1.56), IRON);
  for (let px = vx0 + 3; px < vx1; px += 7) {
    batch.add('metal', box(px - 0.05, px + 0.05, ty - 0.2, ty + 3.1, tz + 1.3, tz + 1.4), IRON);
    batch.add('metal', box(px - 0.03, px + 0.03, ty + 2.9, ty + 2.96, tz - 1.2, tz + 1.4), IRON);
  }
  for (let px = vx0 + 1.5; px < vx1; px += 3.5) batch.add('glow', new THREE.SphereGeometry(0.06, 6, 4).translate(px, ty - 0.45, tz + 1.64), HDR(2.4, 1.8, 1.1));
  const train = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x3a404c, roughness: 0.5, metalness: 0.5 });
  const winM = new THREE.MeshBasicMaterial({ color: HDR(0.5, 0.42, 0.28) });
  const winGeo = new THREE.BoxGeometry(0.78, 0.46, 2.84);
  for (let c = 0; c < 3; c++) {
    const cx = c * 12.4;
    const car = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.8), body);
    car.position.set(cx, ty + 1.1, tz);
    train.add(car);
    for (let w = 0; w < 8; w++) {
      const win = new THREE.Mesh(winGeo, winM);
      win.position.set(cx - 5 + w * 1.42, ty + 1.45, tz);
      train.add(win);
    }
  }
  ctx.root.add(train);
  ctx.trains.push({ group: train, x0: x0 - 60, x1: x1 + 60, end: x1 + 4, speed: 22, period: 34, offset: 6 });
  // fire-escape building
  const fx0 = x0 - 0.6, fx1 = x0 + 6.8;
  batch.add('brick', box(fx0, fx1, 0, 7.4, -8, -1.2), BRICK_T[2], { ao: [0, 4, 0.45] });
  for (let fy = 1.2; fy < 7; fy += 2.8) for (let wx = fx0 + 1; wx < fx1 - 0.6; wx += 1.8) addWindow(ctx, wx, fy, 1.0, 1.5, -1.2, pickWin(r, 'modern'), { lintel: true });
  batch.add('stone', box(fx0 - 0.1, fx1 + 0.1, 7.4, 7.6, -1.35, -1.0), STONE_DK);
  neonSign(ctx, fx0 + 3.6, 6.9, -1.12, 3.2, 'NOODLES', 0x3fe0ff, true, 0.55);
}

// Equal-brightness tubes: green and cyan would otherwise bloom far more than red or pink.
function neonColor(color) {
  const c = new THREE.Color(color);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return c.multiplyScalar(2.2 * Math.min(1, 0.4 / lum));
}

function neonSign(ctx, x, y, z, width, text, color, withSource = true, h = null) {
  const height = h ?? width * 0.3;
  const t = neonTex(text, '#' + new THREE.Color(color).getHexString(), { w: 512, h: Math.round(512 * (height / width)) || 160 });
  const col = neonColor(color);
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: col.clone() });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  m.position.set(x, y, z + 0.03);
  m.renderOrder = 6;
  ctx.root.add(m);
  ctx.batch.add('paint', box(x - width / 2 - 0.05, x + width / 2 + 0.05, y - height / 2 - 0.05, y + height / 2 + 0.05, z - 0.06, z), C(0x0c0c10));
  const s = withSource ? source(ctx, x, y, z + 0.9, color, 7, 9, { kind: 'neon', flicker: 1, priority: 1.2 }) : null;
  ctx.neon.push({ mesh: m, color: col, phase: ctx.r() * 10, flicker: ctx.r() < 0.45, source: s });
  return m;
}

function verticalNeon(ctx, x, yTop, z, text, color) {
  const h = 0.42 * text.length + 0.3, w = 0.5;
  const t = neonTex(text, '#' + new THREE.Color(color).getHexString(), { w: 128, h: Math.round(128 * (h / w)), vertical: true, font: '700 86px "Helvetica Neue",Arial,sans-serif' });
  const col = neonColor(color);
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: col.clone() });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, yTop - h / 2, z + 0.08);
  m.renderOrder = 6;
  ctx.root.add(m);
  ctx.batch.add('paint', box(x - w / 2 - 0.06, x + w / 2 + 0.06, yTop - h - 0.06, yTop + 0.06, z - 0.12, z + 0.05), C(0x0c0c10));
  ctx.batch.add('metal', box(x - 0.03, x + 0.03, yTop - 0.3, yTop - 0.24, 0.2, z), IRON);
  ctx.batch.add('metal', box(x - 0.03, x + 0.03, yTop - h + 0.24, yTop - h + 0.3, 0.2, z), IRON);
  const s = source(ctx, x, yTop - h / 2, z + 0.7, color, 5, 7, { kind: 'neon', flicker: 1 });
  ctx.neon.push({ mesh: m, color: col, phase: ctx.r() * 10, flicker: ctx.r() < 0.35, source: s });
}

function concreteBuilding(ctx, x0, x1, y) {
  const { batch, r } = ctx;
  const zf = 0.3;
  const tint = [C(0xd8d4cc), C(0xb8bcc4), C(0xc8b8a8)][Math.floor(r() * 3)];
  batch.add('concrete', box(x0, x1, 0, y - 0.13, -8, zf), tint, { ao: [0, 5, 0.45] });
  batch.add('concrete', box(x0 - 0.03, x1 + 0.03, y - 0.14, y, -0.36, zf + 0.06), C(0xe0ddd6));
  batch.add('concrete', box(x0, x1, y - 0.5, y - 0.4, -8, -0.36), C(0x4a4a50));
  batch.add('concrete', box(x0, x1, y - 0.4, y - 0.05, -8.2, -7.9), C(0xc8c6c0));
  for (let fy = y - 2.25; fy > 0.6; fy -= 3.0) {
    for (let wx = x0 + 0.9; wx < x1 - 0.7; wx += 1.7) addWindow(ctx, wx, fy, 1.15, 1.35, zf, pickWin(r, 'modern'), { sill: false, frame: C(0x2a2e34), frameW: 0.05 });
    batch.add('concrete', box(x0, x1, fy - 0.35, fy - 0.2, zf, zf + 0.1), C(0xc8c6c0));
  }
  // vertical neon blade sign on the facade
  if (x1 - x0 > 5) {
    const [word, col] = [['BAR', 0xff4f7a], ['JAZZ', 0xffb040], ['HOTEL', 0xff4fa0], ['CAFE', 0x7dffb0], ['SUSHI', 0x3fe0ff]][Math.floor(r() * 5)];
    verticalNeon(ctx, x0 + 1.4 + r() * (x1 - x0 - 2.8), y - 0.45, 0.85, word, col);
  }
  // rooftop clutter behind the parapet
  for (let rx = x0 + 0.6; rx < x1 - 1; rx += 2.2 + r() * 2.5) {
    const k = r();
    const rz = -1.6 - r() * 4;
    if (k < 0.35) {
      batch.add('metal', box(rx, rx + 0.9, y - 0.4, y + 0.15, rz - 0.6, rz), C(0x767c84));
      batch.add('grille', quad(rx + 0.1, y - 0.33, rx + 0.8, y + 0.05, rz + 0.005, [0, 0, 1, 1]), WHITE, { keepUV: true });
    } else if (k < 0.55) {
      batch.add('concrete', box(rx, rx + 2.2, y - 0.4, y + 1.9, rz - 2.2, rz), C(0xb0b0b0));
      batch.add('paint', box(rx + 0.6, rx + 1.4, y - 0.4, y + 1.5, rz + 0.001, rz + 0.04), C(0x3a3430));
      batch.add('glow', new THREE.SphereGeometry(0.06, 8, 6).translate(rx + 1.0, y + 1.7, rz + 0.1), HDR(2.6, 2.1, 1.5));
      source(ctx, rx + 1.0, y + 1.6, rz + 0.4, 0xffe0b0, 2.5, 5, { kind: 'bulb' });
    } else if (k < 0.72) {
      const cxz = rz - 1;
      for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) batch.add('metal', box(rx + 0.8 + dx - 0.04, rx + 0.8 + dx + 0.04, y - 0.4, y + 1.3, cxz + dz - 0.04, cxz + dz + 0.04), IRON);
      batch.add('metal', cyl(0.85, 0.85, 1.5, 16).translate(rx + 0.8, y + 2.05, cxz), C(0x6a7078));
      batch.add('metal', new THREE.ConeGeometry(0.9, 0.35, 16).translate(rx + 0.8, y + 2.97, cxz), C(0x50565e));
    } else {
      batch.add('metal', cyl(0.025, 0.025, 2.6, 5).translate(rx, y + 0.9, rz), IRON);
      batch.add('metal', box(rx - 0.5, rx + 0.5, y + 1.9, y + 1.93, rz - 0.01, rz + 0.01), IRON);
      batch.add('metal', box(rx - 0.35, rx + 0.35, y + 1.6, y + 1.63, rz - 0.01, rz + 0.01), IRON);
    }
  }
  if (r() < 0.75) {
    const [word, col] = NEON_WORDS[Math.floor(r() * NEON_WORDS.length)];
    const sx = x0 + (x1 - x0) * (0.3 + r() * 0.4), sz = -3.2 - r() * 2;
    const w = Math.min(4.2, (x1 - x0) * 0.6);
    for (const dx of [-w * 0.35, w * 0.35]) batch.add('metal', box(sx + dx - 0.05, sx + dx + 0.05, y - 0.4, y + 0.9, sz - 0.25, sz - 0.15), IRON);
    neonSign(ctx, sx, y + 1.45, sz, w, word, col, true);
  }
}

// ── IV · Moonrise ──────────────────────────────────────────────────────────
function moonrise(ctx, x0, x1) {
  const { batch, r } = ctx;
  for (let bx = x0 - 10; bx < x1 + 30; bx += 7 + r() * 6) {
    const w = 6 + r() * 6, H = 6 + r() * 5.5, z = -14 - r() * 14;
    batch.add('stone', box(bx, bx + w, 0, H, z - 6, z), C(0x8a8680), { ao: [0, 8, 0.5] });
    for (let fy = 1.2; fy < H - 1.2; fy += 3) for (let wx = bx + 1; wx < bx + w - 0.8; wx += 1.8) if (r() < 0.6) addWindow(ctx, wx, fy, 0.9, 1.7, z, pickWin(r, 'west'), { spill: false });
    const g = box(bx - 0.2, bx + w + 0.2, -0.05, 0.05, -1.6, 1.6);
    g.rotateX(0.9);
    g.translate(0, H + 1.0, z - 1.2);
    batch.add('slate', g, C(0xa8aebb));
  }
}

function stoneBuilding(ctx, x0, x1, y) {
  const { batch, r } = ctx;
  const zf = 0.35;
  batch.add('stone', box(x0, x1, 0, y - 0.24, -8, zf), C(0xd6cfc2), { ao: [0, 5, 0.45] });
  batch.add('stone', box(x0 - 0.06, x1 + 0.06, y - 0.24, y - 0.08, -0.32, zf + 0.12), C(0xe8e2d6));
  batch.add('stone', box(x0 - 0.1, x1 + 0.1, y - 0.08, y, -0.32, zf + 0.17), C(0xf0eadf));
  for (let dx = x0 + 0.05; dx < x1 - 0.05; dx += 0.22) batch.add('stone', box(dx, dx + 0.1, y - 0.36, y - 0.24, zf, zf + 0.08), C(0xcfc8bb));
  for (let fy = y - 2.6; fy > 0.8; fy -= 3.1) {
    for (let wx = x0 + 0.9; wx < x1 - 0.7; wx += 1.6) addWindow(ctx, wx, fy, 0.85, 1.75, zf, pickWin(r, 'west'), { lintel: true });
  }
  // mansard roof with dormers rising behind the gutter
  const mr = box(x0, x1, -0.05, 0.05, -1.3, 1.3);
  mr.rotateX(1.0);
  mr.translate(0, y + 1.05, -0.3 - 0.75);
  batch.add('slate', mr, C(0xb0b6c4));
  batch.add('slate', box(x0, x1, y + 2.1, y + 2.2, -4.5, -1.6), C(0x8e94a2));
  for (let dx = x0 + 1; dx < x1 - 0.8; dx += 2.4) {
    batch.add('stone', box(dx - 0.45, dx + 0.45, y + 0.8, y + 1.9, -1.4, -0.7), C(0xd6cfc2));
    addWindow(ctx, dx, y + 0.95, 0.5, 0.75, -0.7, pickWin(r, 'west'), { sill: false, frameW: 0.05 });
  }
  if (r() < 0.8) {
    const cx = x0 + 0.8 + r() * (x1 - x0 - 1.6);
    batch.add('brick', box(cx - 0.35, cx + 0.35, y + 1.5, y + 3.4, -3.2, -2.5), BRICK_T[1]);
    batch.add('paint', cyl(0.09, 0.11, 0.4, 8).translate(cx, y + 3.6, -2.85), C(0x6a3a2a));
  }
  if (r() < 0.6) {
    const ax = x0 + r() * (x1 - x0);
    batch.add('metal', cyl(0.02, 0.02, 2.4, 5).translate(ax, y + 3.3, -3.6), IRON);
    batch.add('metal', box(ax - 0.6, ax + 0.6, y + 4.2, y + 4.23, -3.61, -3.59), IRON);
    batch.add('metal', box(ax - 0.4, ax + 0.4, y + 3.8, y + 3.83, -3.61, -3.59), IRON);
  }
}

function clockTower(ctx, x0, x1, y) {
  const { batch } = ctx;
  stoneBuilding(ctx, x0, x0 + 4.8, y);
  const tx0 = x0 + 5.3, tx1 = x0 + 10.7;
  batch.add('stone', box(x0 + 4.8, x1, 0, y - 0.24, -8, 0.35), C(0xd6cfc2), { ao: [0, 5, 0.45] });
  batch.add('stone', box(x0 + 4.74, x1, y - 0.24, y, -0.32, 0.5), C(0xf0eadf));
  // balustrade posts behind the walking edge
  for (let bx = x0 + 5; bx < x1; bx += 0.36) batch.add('stone', cyl(0.05, 0.06, 0.5, 8).translate(bx, y + 0.25, -0.22), C(0xe2dccf));
  batch.add('stone', box(x0 + 4.8, x1, y + 0.5, y + 0.6, -0.32, -0.12), C(0xf0eadf));
  // the tower
  const top = y + 6.8;
  batch.add('stone', box(tx0, tx1, y, top, -4.8, -0.8), C(0xd9d2c6), { ao: [y, y + 2, 0.6] });
  batch.add('stone', box(tx0 - 0.15, tx1 + 0.15, top - 0.2, top + 0.15, -4.95, -0.65), C(0xefe9de));
  batch.add('stone', box(tx0 - 0.1, tx1 + 0.1, y + 1.8, y + 1.95, -4.9, -0.7), C(0xefe9de));
  const cxm = (tx0 + tx1) / 2, cy = y + 4.1;
  batch.add('stone', cylZ(1.55, 0.2, 32).translate(cxm, cy, -0.72), C(0xefe9de));
  batch.add('clock', new THREE.CircleGeometry(1.35, 40).translate(cxm, cy, -0.6), HDR(0.95, 0.85, 0.66), { keepUV: true });
  source(ctx, cxm, cy - 0.6, 0.6, 0xffe2b0, 4, 7, { kind: 'clock' });
  halo(ctx, cxm, cy, -0.55, 3.6, HDR(0.12, 0.1, 0.07));
  for (const dx of [-1.6, 0, 1.6]) {
    batch.add('paint', box(cxm + dx - 0.45, cxm + dx + 0.45, top + 0.15, top + 1.9, -0.8, -0.75), C(0x0c0a0e));
  }
  batch.add('stone', box(tx0, tx1, top + 0.15, top + 2.2, -4.8, -0.85), C(0xcfc8bb));
  const roof = new THREE.ConeGeometry(4.1, 4.2, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.translate(cxm, top + 2.2 + 2.1, -2.8);
  batch.add('slate', roof, C(0x9aa2b2));
  batch.add('metal', cyl(0.03, 0.06, 1.6, 6).translate(cxm, top + 6.9, -2.8), C(0x6a6040));
  // a few lit windows in the tower shaft
  addWindow(ctx, cxm, y + 0.4, 0.8, 1.2, -0.8, WIN.dim, { lintel: true });
}

// ── the catwalk itself ─────────────────────────────────────────────────────
function platform(ctx, p) {
  const { batch, r } = ctx;
  const { x0, x1, y } = p;
  switch (p.style) {
    case 'wall': {
      batch.add('brick', box(x0, x1, 0, y - 0.1, -0.2, 0.2), C(0xe0cfc6), { ao: [0, 1.6, 0.45] });
      batch.add('stone', box(x0 - 0.02, x1 + 0.02, y - 0.1, y, -0.27, 0.27), C(0xc9c2b4));
      for (let px = x0 + 0.2; px < x1 - 0.1; px += 3.2) batch.add('brick', box(px - 0.2, px + 0.2, 0, y - 0.1, -0.25, 0.25), C(0xcdb8ac), { ao: [0, 1.6, 0.45] });
      break;
    }
    case 'pillar': {
      batch.add('brick', box(x0, x1, 0, y - 0.14, -0.24, 0.24), C(0xd4c0b4), { ao: [0, 1.6, 0.45] });
      batch.add('stone', box(x0 - 0.04, x1 + 0.04, y - 0.14, y, -0.3, 0.3), C(0xd2cbbd));
      batch.add('stone', box(x0, x1, y - 0.75, y - 0.62, -0.26, 0.26), C(0xb9b2a4));
      batch.add('paint', box((x0 + x1) / 2 - 0.35, (x0 + x1) / 2 + 0.35, y - 1.5, y - 1.0, 0.24, 0.27), C(0x2c3a2e));
      break;
    }
    case 'fence': {
      batch.add('brick', box(x0, x1, 0, 0.9, -0.16, 0.16), C(0xc4ada0), { ao: [0, 0.9, 0.5] });
      for (let fx = x0 + 0.01; fx < x1 - 0.12; fx += 0.16) {
        const top = y - 0.07 - r() * 0.03;
        batch.add('wood', box(fx, fx + 0.14, 0.9, top, -0.04, 0.04), C(0xa08a78).multiplyScalar(0.8 + r() * 0.35));
      }
      for (let fx = x0; fx <= x1 + 0.01; fx += 2) batch.add('wood', box(fx - 0.05, fx + 0.05, 0.9, y - 0.02, -0.08, 0.08), C(0x6a5446));
      batch.add('wood', box(x0, x1, y - 0.07, y, -0.09, 0.09), C(0x8a705c));
      batch.add('wood', box(x0, x1, 1.4, 1.48, 0.04, 0.08), C(0x6a5446));
      break;
    }
    case 'eave':
      for (let hx = x0; hx < x1 - 0.5;) {
        const w = Math.min(x1 - hx, 3.8 + r() * 2.6);
        machiya(ctx, hx, x1 - (hx + w) < 2 ? x1 : hx + w, y);
        hx = x1 - (hx + w) < 2 ? x1 : hx + w;
      }
      break;
    case 'balcony':
      balconyHouse(ctx, x0, x1, y);
      break;
    case 'parapet':
      concreteBuilding(ctx, x0, x1, y);
      break;
    case 'stone':
      stoneBuilding(ctx, x0, x1, y);
      break;
    case 'tower':
      clockTower(ctx, x0, x1, y);
      break;
  }
}

function oneway(ctx, o) {
  const { batch, r } = ctx;
  const { x0, x1, y } = o;
  if (o.style === 'awning') {
    const key = o.x0 < 100 ? 'awningR' : 'awningB';
    const d = 1.5;
    const g = new THREE.PlaneGeometry(x1 - x0 + 0.1, d);
    g.rotateX(-Math.PI / 2 + 0.32);
    g.translate((x0 + x1) / 2, y + 0.02, -0.2);
    batch.add(key, g, WHITE, { keepUV: true });
    const v = new THREE.PlaneGeometry(x1 - x0 + 0.1, 0.24);
    v.translate((x0 + x1) / 2, y - 0.2 - 0.02, 0.52);
    batch.add(key, v, WHITE, { keepUV: true });
    for (const ax of [x0 + 0.05, x1 - 0.05]) batch.add('metal', box(ax - 0.015, ax + 0.015, y - 0.25, y + 0.05, -0.9, 0.5), IRON);
    // a little shop below
    batch.add('paint', box(x0 - 0.2, x1 + 0.2, 0, y - 0.2, -1.2, -0.95), C(0x3a2a24));
    addWindow(ctx, (x0 + x1) / 2, y - 1.9, x1 - x0 - 0.4, 1.3, -0.95, WIN.curtains, { sill: false, frame: WOOD_DK });
    source(ctx, (x0 + x1) / 2, y - 0.9, 0.5, 0xffb070, 4, 6, { kind: 'shop' });
  } else if (o.style === 'wire') {
    const curve = catenary(x0 - 0.15, y - 0.012, 0, x1 + 0.15, y - 0.012, 0, 0.035, 20);
    batch.add('paint', new THREE.TubeGeometry(curve, 30, 0.016, 5), C(0x2a2420));
    for (const px of [x0 - 0.2, x1 + 0.2]) {
      batch.add('wood', cyl(0.07, 0.09, y + 0.35, 8).translate(px, (y + 0.35) / 2, -0.35), C(0x5a4636));
      batch.add('wood', box(px - 0.03, px + 0.03, y - 0.03, y + 0.02, -0.35, 0.02), C(0x5a4636));
    }
    if (o.x0 < 200) {
      const n = Math.floor((x1 - x0) / 0.8);
      const lg = lanternGeo(0.7);
      for (let i = 1; i < n; i++) {
        const lx = x0 + ((x1 - x0) * i) / n;
        batch.add('paint', cyl(0.004, 0.004, 0.12, 4).translate(lx, y - 0.07, 0), C(0x140c08));
        batch.add('lantern', lg.clone().translate(lx, y - 0.3, 0), i % 2 ? LANTERN_RED : LANTERN_AMBER, { keepUV: true });
      }
      source(ctx, (x0 + x1) / 2, y - 0.4, 0.4, 0xff7a40, 4.5, 7, { kind: 'lantern', flicker: 0.03 });
    } else {
      for (const px of [x0 - 0.2, x1 + 0.2]) {
        batch.add('wood', cyl(0.1, 0.12, y + 1.4, 8).translate(px, (y + 1.4) / 2, -0.5), C(0x4a3a2e));
        batch.add('wood', box(px - 0.6, px + 0.6, y + 1.1, y + 1.18, -0.54, -0.46), C(0x4a3a2e));
      }
      batch.add('paint', new THREE.TubeGeometry(catenary(x0 - 0.8, y + 1.15, -0.5, x1 + 0.8, y + 1.15, -0.5, 0.5, 20), 30, 0.012, 4), C(0x1a1816));
    }
  } else if (o.style === 'landing') {
    batch.add('metal', box(x0, x1, y - 0.06, y, -1.2, 0.35), C(0x3a3e44));
    batch.add('metal', box(x0, x1, y + 0.9, y + 0.94, 0.32, 0.36), C(0x2a2e34));
    for (let bx = x0; bx <= x1 + 0.01; bx += 0.4) batch.add('metal', box(bx - 0.015, bx + 0.015, y, y + 0.92, 0.33, 0.35), C(0x2a2e34));
    batch.add('metal', box(x0 - 0.02, x0 + 0.02, 0, y, -1.18, -1.14), C(0x2a2e34));
    const st = new THREE.BoxGeometry(Math.hypot(1.6, 0.65) + 0.2, 0.05, 0.7);
    st.rotateZ(-Math.atan2(0.65, 1.6));
    st.translate(x0 - 0.2, y - 0.4, -0.75);
    batch.add('metal', st, C(0x30343a));
    batch.add('glow', new THREE.SphereGeometry(0.06, 8, 6).translate(x1 - 0.2, y + 1.6, -1.1), HDR(5, 4.2, 3));
    source(ctx, x1 - 0.2, y + 1.5, -0.6, 0xffd9a0, 3, 6, { kind: 'bulb' });
  } else if (o.style === 'billboard') {
    const H = 2.3;
    batch.add('metal', box(x0 - 0.08, x1 + 0.08, y - H - 0.08, y, -0.34, -0.14), C(0x24262c));
    const face = quad(x0, y - H, x1, y - 0.06, -0.13, [0, 0, 1, 1]);
    batch.add('billboard', face, WHITE, { keepUV: true });
    batch.add('metal', box(x0 - 0.1, x1 + 0.1, y - 0.06, y, -0.25, 0.2), C(0x3a3e44));
    const base = y - H - 2.6;
    for (const lx of [x0 + 0.8, x1 - 0.8]) batch.add('metal', box(lx - 0.07, lx + 0.07, base - 4, y - H, -0.5, -0.36), IRON);
    batch.add('concrete', box(x0 - 3, x1 + 3, 0, base, -8, 0.2), C(0xb8b4ac), { ao: [0, 3, 0.5] });
    for (let fy = base - 2.2; fy > 0.6; fy -= 3) for (let wx = x0 - 2; wx < x1 + 2.5; wx += 1.7) addWindow(ctx, wx, fy, 1.1, 1.3, 0.2, pickWin(r, 'modern'), { sill: false, frameW: 0.05 });
    for (const lx of [x0 + 1, x1 - 1]) {
      batch.add('metal', box(lx - 0.02, lx + 0.02, y - H - 0.2, y - H, -0.2, 0.7), IRON);
      batch.add('glow', box(lx - 0.18, lx + 0.18, y - H - 0.28, y - H - 0.14, 0.6, 0.8), HDR(2.4, 2.4, 2.2));
      source(ctx, lx, y - H - 0.1, 0.9, 0xdde8ff, 6, 5, { kind: 'flood' });
    }
  }
}

function blockProp(ctx, b) {
  const { batch, r } = ctx;
  const { x0, x1, y0, y1 } = b;
  const cx = (x0 + x1) / 2, w = x1 - x0, h = y1 - y0;
  switch (b.style) {
    case 'pot': {
      const g = new THREE.CylinderGeometry(w / 2, w * 0.36, h * 0.8, 12);
      g.translate(cx, y0 + h * 0.4, 0);
      batch.add('paint', g, C(0x9a4a30));
      batch.add('paint', cyl(w / 2 + 0.02, w / 2 + 0.02, h * 0.14, 12).translate(cx, y0 + h * 0.83, 0), C(0xa85436));
      for (let i = 0; i < 5; i++) {
        const lg = new THREE.IcosahedronGeometry(0.07 + r() * 0.03, 0);
        lg.translate(cx + (r() - 0.5) * w * 0.6, y0 + h * 0.92 + r() * 0.04, (r() - 0.5) * w * 0.5);
        batch.add('foliage', lg, C(0x3a5a2a));
      }
      break;
    }
    case 'crate': {
      batch.add('wood', box(x0, x1, y0, y1, -w / 2, w / 2), C(0xb89a78));
      batch.add('wood', box(x0 - 0.01, x1 + 0.01, y0 + 0.02, y0 + 0.08, -w / 2 - 0.01, w / 2 + 0.01), C(0x8a6c50));
      batch.add('wood', box(x0 - 0.01, x1 + 0.01, y1 - 0.08, y1 - 0.02, -w / 2 - 0.01, w / 2 + 0.01), C(0x8a6c50));
      break;
    }
    case 'barrel': {
      batch.add('wood', cyl(w / 2, w / 2, h, 14).translate(cx, y0 + h / 2, 0), C(0xc8a878));
      for (const t of [0.2, 0.8]) batch.add('paint', cyl(w / 2 + 0.01, w / 2 + 0.01, 0.04, 14).translate(cx, y0 + h * t, 0), C(0x2a2018));
      batch.add('paint', box(cx - w * 0.3, cx + w * 0.3, y0 + h * 0.35, y0 + h * 0.65, w / 2 - 0.02, w / 2 + 0.01), C(0x8a1a14));
      break;
    }
    case 'kanban': {
      batch.add('wood', box(x0, x1, y0, y1, -0.1, 0.1), C(0x5a3e2a));
      batch.add('sign0', quad(x0 + 0.05, y0 + 0.04, x1 - 0.05, y1 - 0.04, 0.105, [0, 0, 1, 1]), WHITE, { keepUV: true });
      for (const rx of [x0 + 0.15, x1 - 0.15]) batch.add('paint', cyl(0.008, 0.008, 1.6, 4).translate(rx, y1 + 0.8, 0), C(0x2a2018));
      batch.add('wood', box(x0 - 0.2, x1 + 0.2, y1 + 1.6, y1 + 1.7, -0.06, 0.06), WOOD_DK);
      batch.add('wood', box(x1 + 0.1, x1 + 0.2, y1 + 1.6, y1 + 1.7, -2.0, 0.06), WOOD_DK);
      break;
    }
    case 'ac': {
      batch.add('metal', box(x0, x1, y0 + 0.06, y1, -0.3, 0.3), C(0xc8ccd0));
      batch.add('grille', quad(x0 + 0.08, y0 + 0.12, x0 + 0.08 + (h - 0.12), y1 - 0.06, 0.305, [0, 0, 1, 1]), WHITE, { keepUV: true });
      batch.add('metal', box(x0 + 0.05, x0 + 0.12, y0, y0 + 0.06, -0.25, 0.25), IRON);
      batch.add('metal', box(x1 - 0.12, x1 - 0.05, y0, y0 + 0.06, -0.25, 0.25), IRON);
      batch.add('metal', cyl(0.03, 0.03, 1.2, 6).rotateX(Math.PI / 2).translate(x1 - 0.15, y0 + 0.2, -0.9), C(0x8a8e92));
      break;
    }
    case 'tank': {
      batch.add('metal', cyl(w / 2, w / 2, h - 0.08, 20).translate(cx, y0 + 0.04 + (h - 0.08) / 2, -0.35), C(0x8a9aa6));
      batch.add('metal', cyl(w / 2 + 0.03, w / 2 + 0.03, 0.08, 20).translate(cx, y1 - 0.04, -0.35), C(0x6a7a86));
      for (const t of [0.35, 0.7]) batch.add('metal', cyl(w / 2 + 0.015, w / 2 + 0.015, 0.05, 20).translate(cx, y0 + h * t, -0.35), C(0x5a6a76));
      batch.add('metal', box(x0 + 0.1, x1 - 0.1, y0, y0 + 0.08, -0.9, 0.3), IRON);
      break;
    }
  }
}

function ceilingProp(ctx, c) {
  const { batch, r } = ctx;
  const { x0, x1, y0, y1 } = c;
  if (c.style === 'lanterns') {
    const yTop = y0 + 0.62;
    batch.add('wood', cylX(0.025, x1 - x0 + 0.6, 6).translate((x0 + x1) / 2, yTop, 0), C(0x6a5a3a));
    for (const bx of [x0 - 0.25, x1 + 0.25]) batch.add('wood', box(bx - 0.02, bx + 0.02, yTop - 0.02, yTop + 0.02, -1.9, 0), WOOD_DK);
    hangLanterns(ctx, x0, x1, yTop, 0, (i) => (i % 2 ? LANTERN_WHITE : LANTERN_RED));
  } else if (c.style === 'sign') {
    batch.add('wood', box(x0, x1, y0, y1, -0.08, 0.08), C(0x4a3222));
    batch.add('sign1', quad(x0 + 0.06, y0 + 0.06, x1 - 0.06, y1 - 0.06, 0.085, [0, 0, 1, 1]), WHITE, { keepUV: true });
    batch.add('metal', box(x0 + 0.1, x0 + 0.13, y1, y1 + 0.5, -0.01, 0.01), IRON);
    batch.add('metal', box(x1 - 0.13, x1 - 0.1, y1, y1 + 0.5, -0.01, 0.01), IRON);
    batch.add('metal', box(x0 - 0.1, x1 + 0.2, y1 + 0.5, y1 + 0.56, -0.03, 0.03), IRON);
    batch.add('metal', box(x1 + 0.14, x1 + 0.2, y1 + 0.5, y1 + 0.56, -1.9, 0.03), IRON);
    halo(ctx, (x0 + x1) / 2, y0 - 0.1, 0.12, 0.6, HDR(0.3, 0.15, 0.06));
  } else if (c.style === 'laundry') {
    const yTop = y1 - 0.05;
    batch.add('wood', cylX(0.03, x1 - x0 + 0.8, 8).translate((x0 + x1) / 2, yTop, 0), C(0xa89060));
    for (const bx of [x0 - 0.35, x1 + 0.35]) batch.add('wood', box(bx - 0.03, bx + 0.03, yTop - 0.03, yTop + 0.03, -1.1, 0.02), WOOD_DK);
    const cols = [C(0xd8d0c0), C(0x8a3a3a), C(0x3a5a8a), C(0xc8b070), C(0xe8e0d8), C(0x5a7a5a)];
    for (let x = x0 + 0.05; x < x1 - 0.1;) {
      const w = 0.3 + r() * 0.35;
      const hgt = Math.min(y1 - y0 - 0.05, 0.3 + r() * 0.4);
      const g = new THREE.PlaneGeometry(Math.min(w, x1 - x), hgt, 1, 1);
      g.translate(x + Math.min(w, x1 - x) / 2, yTop - hgt / 2 - 0.02, 0.02);
      batch.add('fabric', g, cols[Math.floor(r() * cols.length)]);
      x += w + 0.06;
    }
  } else if (c.style === 'pipe') {
    const cy = (y0 + y1) / 2, rad = (y1 - y0) / 2;
    batch.add('metal', cylX(rad, x1 - x0 + 1.2, 14).translate((x0 + x1) / 2, cy, 0), C(0x7a6a5e));
    for (const px of [x0 - 0.3, x1 + 0.3]) {
      batch.add('metal', box(px - 0.05, px + 0.05, ctx.stage.groundAt(px) - 0.4, cy, -0.5, -0.4), IRON);
      batch.add('metal', box(px - 0.05, px + 0.05, cy - 0.03, cy + 0.03, -0.5, 0), IRON);
    }
    for (const fx of [x0 + 0.4, x1 - 0.4]) batch.add('metal', cylX(rad + 0.04, 0.1, 14).translate(fx, cy, 0), C(0x5a4a40));
  }
}

function ventProp(ctx, h) {
  const { batch } = ctx;
  const x = h.cx, y = h.y0;
  batch.add('metal', box(x - 0.18, x + 0.18, y, y + 0.1, -0.2, 0.2), C(0x6a6e74));
  batch.add('metal', box(x - 0.12, x + 0.12, y + 0.1, y + 0.16, -0.14, 0.14), C(0x2a2c30));
  batch.add('metal', cyl(0.05, 0.05, 1.0, 8).translate(x + 0.14, y + 0.1, -0.7).rotateX(0), C(0x7a7e84));
}

// ── volumetric light cones: one merged additive mesh ───────────────────────
function buildCones(ctx) {
  if (!ctx.cones.length) return null;
  const geos = [];
  for (const c of ctx.cones) {
    const g = new THREE.CylinderGeometry(0.06, c.r, c.h, 28, 1, true);
    g.translate(c.x, c.y - c.h / 2, c.z);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.color.r; col[i * 3 + 1] = c.color.g; col[i * 3 + 2] = c.color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(g);
  }
  const geo = mergeGeometries(geos, false);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vCol; varying float vH; varying float vEdge; varying vec3 vW;
      void main() {
        vCol = color; vH = uv.y;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vec3 n = normalize(mat3(viewMatrix) * normal);
        vEdge = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vCol; varying float vH; varying float vEdge; varying vec3 vW;
      void main() {
        float a = pow(vEdge, 1.8) * pow(vH, 1.25) * smoothstep(1.0, 0.9, vH);
        float drift = 0.85 + 0.15 * sin(vW.y * 3.1 + uTime * 0.7 + vW.x * 1.3);
        gl_FragColor = vec4(vCol * a * drift, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 7;
  return m;
}

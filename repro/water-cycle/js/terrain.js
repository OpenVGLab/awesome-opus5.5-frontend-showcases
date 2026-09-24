import * as THREE from 'three';
import { fbm, ridged, smoothstep, clamp, lerp, cumulative } from './util.js';
import { GLSL_NOISE } from './glsl.js';

export const X0 = -10, X1 = 10, Z0 = -6, Z1 = 6, BOTTOM = -4.2;
export const NX = 240, NZ = 144;
export const DX = (X1 - X0) / NX, DZ = (Z1 - Z0) / NZ;
export const PEAK = { x: 6.6, z: -1.4 };
const STRIDE = NX + 1;

const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

export function coastX(z) {
  return -2.6 + 0.7 * Math.sin(z * 0.45 + 0.8) + 0.35 * Math.sin(z * 1.1 + 2.0);
}

function bump(x, z, cx, cz, h, sx, sz) {
  const dx = (x - cx) / sx, dz = (z - cz) / sz;
  return h * Math.exp(-(dx * dx + dz * dz));
}

function peakShape(x, z, cx, cz, h, sx, sz) {
  const dx = (x - cx) / sx, dz = (z - cz) / sz;
  const d2 = dx * dx + dz * dz;
  return h * (0.62 * Math.exp(-d2) + 0.38 * Math.exp(-1.7 * Math.sqrt(d2)));
}

export function baseHeight(x, z) {
  const s = x - coastX(z) + 0.3 * fbm(x * 0.3 + 3.1, z * 0.3 - 1.7, 3);
  let h = -1.4 + 1.8 * Math.tanh((s + 1.66) / 1.6);
  const land = smoothstep(-0.4, 2.2, s);
  h += land * (0.1 + 0.26 * fbm(x * 0.45 + 10, z * 0.45 + 4, 4));
  h += (1 - land) * 0.18 * fbm(x * 0.55 - 4, z * 0.55 + 9, 3);
  let m = peakShape(x, z, PEAK.x, PEAK.z, 5.6, 2.3, 2.1)
    + bump(x, z, 8.9, 2.3, 3.4, 1.7, 1.8)
    + bump(x, z, 4.4, -4.3, 2.7, 1.6, 1.4)
    + bump(x, z, 9.3, -4.5, 3.3, 1.5, 1.5)
    + bump(x, z, 8.3, 4.6, 2.2, 1.5, 1.3);
  m *= 0.72 + 0.5 * ridged(x * 0.5 + 7.3, z * 0.5 - 2.1, 5);
  h += m * smoothstep(-1, 1.5, s);
  h += land * (bump(x, z, -0.4, -3.3, 0.9, 1.6, 1.3) + bump(x, z, 1.5, -1.0, 0.55, 1.3, 1.2));
  return h;
}

const PAL = {
  seaShallow: new THREE.Color('#dccb98'),
  seaDeep: new THREE.Color('#6d8a86'),
  sand: new THREE.Color('#f2e0ad'),
  grassA: new THREE.Color('#93cc5f'),
  grassB: new THREE.Color('#5c9d43'),
  meadow: new THREE.Color('#a8b96b'),
  rockA: new THREE.Color('#a39a90'),
  rockB: new THREE.Color('#6a625b'),
  bed: new THREE.Color('#a99878'),
};

export class Terrain {
  constructor() {
    this.h = new Float32Array(STRIDE * (NZ + 1));
    for (let j = 0; j <= NZ; j++) {
      const z = Z0 + j * DZ;
      for (let i = 0; i <= NX; i++) this.h[j * STRIDE + i] = baseHeight(X0 + i * DX, z);
    }
    this.lake = { x: 3.95, z: 1.45, rx: 0.95, rz: 0.62, rot: 0.35, level: 0 };
    this.buildRiver();
    this.carve();
    this.computeSlopes();
    this.buildStreams();
  }

  // Matches the PlaneGeometry triangulation exactly, so things placed "on the ground" sit on it.
  heightAt(x, z) {
    const fx = clamp((x - X0) / DX, 0, NX - 1e-6), fz = clamp((z - Z0) / DZ, 0, NZ - 1e-6);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const k = j * STRIDE + i, h = this.h;
    const h00 = h[k], h10 = h[k + 1], h01 = h[k + STRIDE], h11 = h[k + STRIDE + 1];
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }

  vertexIndex(x, z) {
    const i = Math.round(clamp((x - X0) / DX, 0, NX)), j = Math.round(clamp((z - Z0) / DZ, 0, NZ));
    return j * STRIDE + i;
  }

  slopeAt(x, z) { return this.slope[this.vertexIndex(x, z)]; }
  riverDistAt(x, z) { return this.riverDist[this.vertexIndex(x, z)]; }
  riverIdxAt(x, z) { return this.riverIdx[this.vertexIndex(x, z)]; }

  lakeDist(x, z) {
    const L = this.lake, c = Math.cos(L.rot), s = Math.sin(L.rot);
    const dx = x - L.x, dz = z - L.z;
    const u = (dx * c + dz * s) / L.rx, v = (-dx * s + dz * c) / L.rz;
    return Math.hypot(u, v);
  }

  buildRiver() {
    const ctrl = [[6.1, -0.1], [5.6, 0.55], [4.85, 1.1], [3.95, 1.45], [3.05, 1.8], [2.1, 1.7],
      [1.1, 2.1], [0.1, 2.7], [-0.9, 3.15], [-1.9, 3.45], [-3.1, 3.65]];
    const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const N = 360;
    const pts = curve.getSpacedPoints(N - 1);
    const len = curve.getLength();
    const px = new Float32Array(N), pz = new Float32Array(N), y = new Float32Array(N);
    const r = new Float32Array(N), dep = new Float32Array(N), s = new Float32Array(N);
    const inLake = new Uint8Array(N);
    let m = Infinity, lakeLevel = null;
    for (let k = 0; k < N; k++) {
      px[k] = pts[k].x; pz[k] = pts[k].z; s[k] = (k / (N - 1)) * len;
      inLake[k] = this.lakeDist(px[k], pz[k]) < 1 ? 1 : 0;
      m = Math.min(m, this.heightAt(px[k], pz[k]) - 0.05);
      if (inLake[k]) {
        if (lakeLevel === null) lakeLevel = m;
        m = Math.min(m, lakeLevel);
        y[k] = lakeLevel;
      } else y[k] = m;
    }
    for (let pass = 0; pass < 3; pass++) {
      const tmp = Float32Array.from(y);
      for (let k = 1; k < N - 1; k++) {
        if (inLake[k]) continue;
        let acc = 0;
        for (let q = -4; q <= 4; q++) acc += tmp[clamp(k + q, 0, N - 1)];
        y[k] = acc / 9;
      }
    }
    for (let k = 1; k < N; k++) y[k] = Math.min(y[k], y[k - 1]);
    for (let k = 0; k < N; k++) y[k] = Math.max(y[k], 0.012);
    this.lake.level = lakeLevel ?? y[Math.floor(N * 0.3)];
    let mouth = N - 1;
    for (let k = 0; k < N; k++) {
      const t = k / (N - 1);
      r[k] = 0.05 + 0.33 * Math.pow(t, 0.85);
      dep[k] = 0.05 + 0.12 * t;
      if (mouth === N - 1 && px[k] < coastX(pz[k]) - 0.1) mouth = k;
    }
    this.river = { N, px, pz, y, r, dep, s, len, inLake, mouth };
  }

  carve() {
    const R = this.river, L = this.lake, h = this.h;
    this.riverDist = new Float32Array(h.length).fill(99);
    this.riverIdx = new Uint16Array(h.length);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let k = 0; k < R.N; k++) {
      minX = Math.min(minX, R.px[k]); maxX = Math.max(maxX, R.px[k]);
      minZ = Math.min(minZ, R.pz[k]); maxZ = Math.max(maxZ, R.pz[k]);
    }
    const pad = 3;
    for (let j = 0; j <= NZ; j++) {
      const z = Z0 + j * DZ;
      for (let i = 0; i <= NX; i++) {
        const x = X0 + i * DX, id = j * STRIDE + i;
        let v = h[id];
        if (x > minX - pad && x < maxX + pad && z > minZ - pad && z < maxZ + pad) {
          let best = Infinity, bk = 0;
          for (let k = 0; k < R.N; k++) {
            const dx = x - R.px[k], dz = z - R.pz[k];
            const d2 = dx * dx + dz * dz;
            if (d2 < best) { best = d2; bk = k; }
          }
          const d = Math.sqrt(best);
          this.riverDist[id] = d;
          this.riverIdx[id] = bk;
          if (d < pad) {
            const rr = R.r[bk], yr = R.y[bk];
            const out = Math.max(0, d - rr - 0.45);
            const target = d < rr ? yr - R.dep[bk] * (1 - (d / rr) ** 2) : yr + 0.5 * (d - rr) + 3 * out * out;
            v = smin(v, target, 0.1);
          }
        }
        const dl = this.lakeDist(x, z);
        if (dl < 3) {
          const out = Math.max(0, dl - 1.6);
          const target = dl < 1 ? L.level - 0.3 * (1 - dl * dl) : L.level + 0.55 * (dl - 1) * L.rz + 2 * out * out;
          v = smin(v, target, 0.1);
        }
        h[id] = v;
      }
    }
  }

  computeSlopes() {
    const h = this.h;
    this.slope = new Float32Array(h.length);
    for (let j = 0; j <= NZ; j++) {
      for (let i = 0; i <= NX; i++) {
        const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, NX), j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, NZ);
        const gx = (h[j * STRIDE + i1] - h[j * STRIDE + i0]) / ((i1 - i0) * DX);
        const gz = (h[j1 * STRIDE + i] - h[j0 * STRIDE + i]) / ((j1 - j0) * DZ);
        this.slope[j * STRIDE + i] = 1 - 1 / Math.sqrt(1 + gx * gx + gz * gz);
      }
    }
  }

  // Water finds its own way down: trace steepest descent (with a little momentum) until it
  // reaches the river or the lake.
  trace(x, z) {
    const R = this.river;
    const pts = [[x, this.heightAt(x, z), z]];
    let vx = 0, vz = 0, uphill = 0;
    const step = 0.035, e = 0.07;
    for (let it = 0; it < 800; it++) {
      const gx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
      const gz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
      const gl = Math.hypot(gx, gz) + 1e-6;
      let nx = vx * 0.55 - (gx / gl) * 0.45, nz = vz * 0.55 - (gz / gl) * 0.45;
      const nl = Math.hypot(nx, nz) || 1;
      vx = nx / nl; vz = nz / nl;
      const hPrev = pts[pts.length - 1][1];
      x += vx * step; z += vz * step;
      if (x < X0 + 0.2 || x > X1 - 0.2 || z < Z0 + 0.2 || z > Z1 - 0.2) return null;
      const hh = this.heightAt(x, z);
      if (hh > hPrev + 0.004) { if (++uphill > 12) return null; } else uphill = 0;
      pts.push([x, hh, z]);
      const k = this.riverIdxAt(x, z), d = this.riverDistAt(x, z);
      if (d < R.r[k] * 0.8) return { pts, joinK: k };
      if (this.lakeDist(x, z) < 0.85) {
        let jk = 0, best = Infinity;
        for (let q = 0; q < R.N; q++) {
          if (!R.inLake[q]) continue;
          const dd = Math.hypot(R.px[q] - x, R.pz[q] - z);
          if (dd < best) { best = dd; jk = q; }
        }
        return { pts, joinK: jk };
      }
    }
    return null;
  }

  buildStreams() {
    const view = { x: -0.35, z: 0.94 };
    const cands = [];
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      for (const rad of [0.8, 1.15, 1.5]) {
        const x0 = PEAK.x + Math.cos(ang) * rad, z0 = PEAK.z + Math.sin(ang) * rad;
        const tr = this.trace(x0, z0);
        if (!tr) continue;
        const facing = Math.cos(ang) * view.x + Math.sin(ang) * view.z;
        tr.len = tr.pts.length * 0.035;
        tr.facing = facing;
        tr.score = Math.min(tr.len, 4.5) * (facing > 0.2 ? 1.6 : facing > -0.2 ? 0.8 : 0.25) + tr.pts[0][1] * 0.15;
        cands.push(tr);
      }
    }
    cands.sort((A, B) => B.score - A.score);
    const chosen = [];
    for (const c of cands) {
      if (chosen.length >= 6) break;
      // cut the new stream where it meets one already chosen (it becomes a tributary)
      let cut = c.pts.length;
      for (let i = 0; i < c.pts.length && cut === c.pts.length; i++) {
        const [x, , z] = c.pts[i];
        for (const o of chosen) {
          for (let q = 0; q < o.pts.length; q += 2) {
            if (Math.abs(o.pts[q][0] - x) < 0.12 && Math.abs(o.pts[q][2] - z) < 0.12) { cut = i; break; }
          }
          if (cut !== c.pts.length) break;
        }
      }
      if (cut < 30) continue;
      const pts = c.pts.slice(0, cut + 1);
      chosen.push({ pts, joinK: c.joinK, facing: c.facing, score: c.score, full: cut >= c.pts.length - 1 });
    }
    this.streams = chosen.map((c) => this.finishStream(c));
    let hero = this.streams.find((s) => s.full && s.facing > 0.2);
    if (!hero) {
      const start = [PEAK.x - 0.5, 0, PEAK.z + 1.3];
      const R = this.river, k = 12;
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = lerp(start[0], R.px[k], t), z = lerp(start[2], R.pz[k], t);
        pts.push([x, this.heightAt(x, z), z]);
      }
      hero = this.finishStream({ pts, joinK: k, facing: 1, full: true });
      this.streams.push(hero);
    }
    this.heroStream = hero;
  }

  finishStream(c) {
    let pts = c.pts.map((p) => [p[0], 0, p[2]]);
    for (let it = 0; it < 2; it++) {
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        out.push([a[0] * 0.75 + b[0] * 0.25, 0, a[2] * 0.75 + b[2] * 0.25], [a[0] * 0.25 + b[0] * 0.75, 0, a[2] * 0.25 + b[2] * 0.75]);
      }
      out.push(pts[pts.length - 1]);
      pts = out;
    }
    const thin = [];
    for (let i = 0; i < pts.length; i += 2) thin.push(pts[i]);
    if (thin[thin.length - 1] !== pts[pts.length - 1]) thin.push(pts[pts.length - 1]);
    for (const p of thin) p[1] = this.heightAt(p[0], p[2]);
    return { pts: thin, cum: cumulative(thin), joinK: c.joinK, facing: c.facing, full: c.full };
  }

  colorAt(k, x, z, h, slope, c, tmp) {
    const n1 = fbm(x * 1.9 + 5, z * 1.9 - 3, 3), n2 = fbm(x * 0.55 - 8, z * 0.55 + 2, 3);
    if (h < 0) {
      c.copy(PAL.seaShallow).lerp(PAL.seaDeep, smoothstep(-0.1, -2.6, h + n1 * 0.25));
    } else {
      c.copy(PAL.grassA).lerp(PAL.grassB, clamp(0.5 + 0.9 * n2));
      c.lerp(PAL.meadow, smoothstep(1.5, 2.8, h + n1 * 0.4) * 0.8);
      c.lerp(PAL.sand, 1 - smoothstep(0.16, 0.34, h + n1 * 0.06));
    }
    const rock = Math.max(smoothstep(0.26, 0.46, slope + n1 * 0.08), smoothstep(2.7, 3.7, h + n1 * 0.5));
    tmp.copy(PAL.rockA).lerp(PAL.rockB, clamp(0.5 + n1));
    c.lerp(tmp, rock * smoothstep(0.25, 0.6, h));
    const rk = this.riverIdx[k], rr = this.river.r[rk];
    c.lerp(PAL.bed, (1 - smoothstep(rr * 0.9, rr * 1.6, this.riverDist[k])) * 0.85);
    c.lerp(PAL.bed, (1 - smoothstep(0.95, 1.15, this.lakeDist(x, z))) * 0.85);
    c.multiplyScalar(0.92 + 0.12 * n1);
  }

  buildMesh(uniforms) {
    const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setY(k, this.h[k]);
    geo.computeVertexNormals();
    const colors = new Float32Array(pos.count * 3), snowN = new Float32Array(pos.count), slope = new Float32Array(pos.count);
    const c = new THREE.Color(), tmp = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k), h = this.h[k];
      this.colorAt(k, x, z, h, this.slope[k], c, tmp);
      colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
      snowN[k] = fbm(x * 0.9 + 2, z * 0.9 + 7, 4);
      slope[k] = this.slope[k];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSnowN', new THREE.BufferAttribute(snowN, 1));
    geo.setAttribute('aSlope', new THREE.BufferAttribute(slope, 1));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSnowLine = uniforms.uSnowLine;
      sh.uniforms.uWet = uniforms.uWet;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
attribute float aSnowN;
attribute float aSlope;
varying float vSnowN;
varying float vSlope;
varying vec3 vGround;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vSnowN = aSnowN;
vSlope = aSlope;
vGround = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uSnowLine;
uniform float uWet;
varying float vSnowN;
varying float vSlope;
varying vec3 vGround;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
float landM = smoothstep(0.03, 0.25, vGround.y);
float snowM = smoothstep(uSnowLine - 0.16, uSnowLine + 0.16, vGround.y + vSnowN * 0.6) * (1.0 - smoothstep(0.5, 0.8, vSlope));
float wetM = uWet * landM * (1.0 - snowM);
diffuseColor.rgb *= mix(1.0, 0.68, wetM);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), snowM);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.45, wetM);`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }

  // The cut faces of the diorama: soil, gravel aquifer (with groundwater flowing to the sea),
  // clay and bedrock. Everything is painted procedurally in the shader.
  buildWalls(uniforms) {
    const P = [], Nn = [], S = [], Cc = [], I = [];
    const wall = (list, normal, flip) => {
      const base = P.length / 3;
      for (const [x, z, hh, c] of list) {
        P.push(x, hh, z, x, BOTTOM, z);
        Nn.push(...normal, ...normal);
        S.push(hh, hh);
        Cc.push(c, c);
      }
      for (let k = 0; k < list.length - 1; k++) {
        const a = base + 2 * k, b = a + 1, c = a + 2, d = a + 3;
        if (!flip) I.push(a, b, c, b, d, c); else I.push(a, c, b, b, c, d);
      }
    };
    const H = (i, j) => this.h[j * STRIDE + i];
    const front = [], back = [], left = [], right = [];
    const D = Z1 - Z0;
    for (let i = 0; i <= NX; i++) {
      const x = X0 + i * DX;
      front.push([x, Z1, H(i, NZ), x]);
      back.push([x, Z0, H(i, 0), X0 - D - (x - X0)]);
    }
    for (let j = 0; j <= NZ; j++) {
      const z = Z0 + j * DZ;
      left.push([X0, z, H(0, j), X0 - (Z1 - z)]);
      right.push([X1, z, H(NX, j), X1 + (Z1 - z)]);
    }
    wall(front, [0, 0, 1], false);
    wall(back, [0, 0, -1], true);
    wall(left, [-1, 0, 0], false);
    wall(right, [1, 0, 0], true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    geo.setAttribute('aSurf', new THREE.Float32BufferAttribute(S, 1));
    geo.setAttribute('aCoord', new THREE.Float32BufferAttribute(Cc, 1));
    geo.setIndex(I);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, {
        uGWOff: uniforms.uGWOff, uGW: uniforms.uGW, uInfOff: uniforms.uInfOff, uInf: uniforms.uInf, uWet: uniforms.uWet,
      });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
attribute float aSurf;
attribute float aCoord;
varying float vSurf;
varying float vCoord;
varying vec3 vWall;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vSurf = aSurf;
vCoord = aCoord;
vWall = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${WALL_GLSL}`)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'gEmit = vec3(0.0);\nvec4 diffuseColor = vec4( wallColor(), opacity );')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEmit;');
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }
}

const WALL_GLSL = /* glsl */ `
uniform float uGWOff;
uniform float uGW;
uniform float uInfOff;
uniform float uInf;
uniform float uWet;
varying float vSurf;
varying float vCoord;
varying vec3 vWall;
vec3 gEmit;
${GLSL_NOISE}
float pebble(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float md = 8.0;
  for (int yy = -1; yy <= 1; yy++) {
    for (int xx = -1; xx <= 1; xx++) {
      vec2 g = vec2(float(xx), float(yy));
      vec2 o = vec2(hash12(i + g), hash12(i + g + 19.19));
      vec2 r = g + o - f;
      md = min(md, dot(r, r));
    }
  }
  return sqrt(md);
}
vec3 wallColor() {
  float c = vCoord, y = vWall.y, s = vSurf;
  float d = s - y;
  float n1 = vnoise(vec2(c * 2.1, y * 2.9));
  float n2 = vnoise(vec2(c * 0.45 + 11.0, y * 0.7 + 3.0));
  float sea = step(s, 0.0);
  float wt = -0.5 + 0.22 * sin(c * 0.42 + 0.6) + 0.16 * (n2 - 0.5) + 0.35 * smoothstep(0.6, 3.5, s);
  wt = min(wt, s - 0.3);
  float aqB = -2.0 + 0.22 * sin(c * 0.31 + 2.0) + 0.14 * (n2 - 0.5);
  float clayB = aqB - 0.34 - 0.08 * sin(c * 0.8 + 1.0);
  float band = sin(y * 10.0 + n2 * 5.0 + c * 0.12);
  vec3 col = mix(vec3(0.47, 0.41, 0.47), vec3(0.57, 0.50, 0.55), smoothstep(-0.4, 0.4, band)) * (0.85 + 0.25 * n1);
  vec3 emit = vec3(0.0);
  if (y > clayB) col = mix(vec3(0.60, 0.43, 0.34), vec3(0.68, 0.50, 0.39), n1);
  if (y > aqB) {
    float pb = pebble(vec2(c * 7.0, y * 9.0));
    vec3 grav = mix(vec3(0.55, 0.45, 0.34), vec3(0.80, 0.70, 0.55), smoothstep(0.15, 0.55, pb)) * (0.85 + 0.25 * n1);
    float sat = max(sea, step(y, wt));
    col = mix(grav, mix(grav, vec3(0.30, 0.58, 0.85), 0.55), sat);
    float row = (y - aqB) / 0.3;
    float rid = floor(row), ry = fract(row);
    float fx = fract((c + uGWOff) / 1.25 + hash12(vec2(rid, 7.0)));
    float dash = smoothstep(0.0, 0.025, fx) * (1.0 - smoothstep(0.025, 0.4, fx));
    dash *= smoothstep(0.28, 0.4, ry) * (1.0 - smoothstep(0.6, 0.72, ry));
    dash *= step(y, wt - 0.03) * step(aqB + 0.08, y) * uGW;
    col = mix(col, vec3(0.8, 0.97, 1.0), dash * 0.9);
    emit += vec3(0.35, 0.75, 1.0) * dash * 0.7;
    float wl = (1.0 - smoothstep(0.0, 0.03, abs(y - wt))) * (1.0 - sea);
    col = mix(col, vec3(0.62, 0.88, 1.0), wl * 0.85);
  }
  if (y > wt && sea < 0.5) {
    vec3 soil = mix(vec3(0.62, 0.45, 0.31), vec3(0.71, 0.53, 0.37), n1);
    float stones = 1.0 - smoothstep(0.05, 0.12, pebble(vec2(c * 5.0 + 3.0, y * 5.0)));
    soil = mix(soil, vec3(0.55, 0.49, 0.43), stones * 0.5);
    col = soil;
    float rockM = smoothstep(1.4, 3.0, s) * smoothstep(0.25, 0.6, d);
    float strata = sin((y + c * 0.35) * 7.0 + n2 * 3.0);
    vec3 rock = mix(vec3(0.56, 0.52, 0.49), vec3(0.66, 0.62, 0.58), smoothstep(-0.3, 0.3, strata)) * (0.9 + 0.2 * n1);
    col = mix(col, rock, rockM);
    float colW = 0.42;
    float cid = floor(c / colW);
    float cx = (fract(c / colW) - 0.5 - 0.3 * (hash12(vec2(cid, 3.0)) - 0.5)) * colW;
    float fy = fract((y + uInfOff) / 0.55 + hash12(vec2(cid, 1.0)));
    float drop = smoothstep(0.0, 0.05, fy) * (1.0 - smoothstep(0.05, 0.42, fy)) * (1.0 - smoothstep(0.018, 0.04, abs(cx)));
    drop *= step(0.06, d) * uInf * (1.0 - rockM);
    col = mix(col, vec3(0.75, 0.94, 1.0), drop * 0.85);
    emit += vec3(0.35, 0.7, 1.0) * drop * 0.5;
  }
  if (sea > 0.5) {
    col = mix(col, vec3(0.86, 0.78, 0.60) * (0.9 + 0.15 * n1), step(d, 0.32 + 0.05 * n2));
  } else {
    float beach = 1.0 - smoothstep(0.15, 0.35, s);
    vec3 top = mix(vec3(0.43, 0.31, 0.22), vec3(0.92, 0.84, 0.64), beach);
    col = mix(col, top * (0.9 + 0.2 * n1), step(d, 0.2 + 0.05 * n2 + beach * 0.15));
    float lip = step(d, 0.045) * (1.0 - beach) * (1.0 - smoothstep(2.6, 3.4, s));
    col = mix(col, vec3(0.45, 0.68, 0.32), lip);
    col *= mix(1.0, 0.82, uWet * step(d, 0.8));
  }
  col *= mix(0.72, 1.0, smoothstep(${BOTTOM.toFixed(2)}, ${(BOTTOM + 1.4).toFixed(2)}, y));
  gEmit = pow(emit, vec3(2.2));
  return pow(col, vec3(2.2));
}
`;

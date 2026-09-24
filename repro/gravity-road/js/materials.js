// Watercolour materials. Every scene material writes two targets:
//   0: pigment colour, alpha = 1 - shade/2 (sky stays 0)
//   1: view-space normal + object id, read by the ink pass.
import * as THREE from 'three';

export const shared = {
  uSunDir: { value: new THREE.Vector3(0.55, 0.45, 0.7).normalize() },
  uNoise: { value: null },
  uWallMin: { value: new THREE.Vector3(1e5, 1e5, 1e5) },
  uWallMax: { value: new THREE.Vector3(1e5 + 1, 1e5 + 1, 1e5 + 1) },
  uSlabMin: { value: new THREE.Vector3(1e5, 1e5, 1e5) },
  uSlabMax: { value: new THREE.Vector3(1e5 + 1, 1e5 + 1, 1e5 + 1) },
  uShadowZ: { value: -1e5 },
  uTime: { value: 0 },
};

const sharedUniforms = () => ({
  uSunDir: shared.uSunDir, uNoise: shared.uNoise, uWallMin: shared.uWallMin, uWallMax: shared.uWallMax,
  uSlabMin: shared.uSlabMin, uSlabMax: shared.uSlabMax, uShadowZ: shared.uShadowZ, uTime: shared.uTime,
});

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function tileNoise(size, period, seed) {
  const rnd = mulberry32(seed);
  const lat = new Float32Array(period * period);
  for (let i = 0; i < lat.length; i++) lat[i] = rnd();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = y / size * period, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), y1 = (y0 + 1) % period;
    for (let x = 0; x < size; x++) {
      const fx = x / size * period, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % period;
      const a = lat[y0 * period + x0], b = lat[y0 * period + x1], c = lat[y1 * period + x0], d = lat[y1 * period + x1];
      const top = a + (b - a) * sx, bot = c + (d - c) * sx;
      out[y * size + x] = top + (bot - top) * sy;
    }
  }
  return out;
}

function fbm(size, basePeriod, octaves, seed) {
  const out = new Float32Array(size * size);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const p = basePeriod << o;
    if (p > size) break;
    const n = tileNoise(size, p, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    amp *= 0.5;
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo);
  return out;
}

// RGBA tileable noise: r = broad fbm, g = fine grain, b = medium fbm, a = another broad fbm.
export function makeNoiseTexture(size = 256) {
  const r = fbm(size, 4, 6, 1), g = fbm(size, 64, 3, 7), b = fbm(size, 8, 5, 13), a = fbm(size, 16, 4, 29);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = r[i] * 255; data[i * 4 + 1] = g[i] * 255; data[i * 4 + 2] = b[i] * 255; data[i * 4 + 3] = a[i] * 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export const COMMON = /* glsl */`
uniform vec3 uSunDir;
uniform sampler2D uNoise;
uniform vec3 uWallMin;
uniform vec3 uWallMax;
uniform vec3 uSlabMin;
uniform vec3 uSlabMax;
uniform float uShadowZ;
uniform float uTime;
uniform float uId;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float boxHit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 ts = min(t0, t1);
  vec3 tb = max(t0, t1);
  float tn = max(max(ts.x, ts.y), ts.z);
  float tf = min(min(tb.x, tb.y), tb.z);
  return (tf > max(tn, 0.0)) ? 1.0 : 0.0;
}
float sunShadow(vec3 p, vec3 n) {
  if (p.z < uShadowZ) return 1.0;
  vec3 ro = p + n * 0.5;
  float h = max(boxHit(ro, uSunDir, uWallMin, uWallMax), boxHit(ro, uSunDir, uSlabMin, uSlabMax));
  return 1.0 - h;
}
float washNoise(vec3 p, vec3 n) {
  vec3 an = abs(n);
  vec2 q = (an.y > an.x && an.y > an.z) ? p.xz : ((an.x > an.z) ? p.zy : p.xy);
  float a = texture(uNoise, q * 0.011).r;
  float b = texture(uNoise, q * 0.043 + 0.31).a;
  return a * 0.6 + b * 0.4;
}
vec3 wcLight(vec3 base, vec3 n, vec3 p, float receive, out float shade) {
  float ndl = dot(n, uSunDir);
  float sh = mix(1.0, sunShadow(p, n), receive);
  float lit = smoothstep(-0.05, 0.14, ndl) * sh;
  float hi = smoothstep(0.5, 0.9, ndl) * sh;
  vec3 cool = base * vec3(0.70, 0.71, 0.87) + vec3(0.015, 0.015, 0.05);
  vec3 c = mix(cool, base, lit);
  c = mix(c, mix(base, vec3(1.0, 0.985, 0.95), 0.3), hi * 0.5);
  c *= 0.92 + 0.14 * washNoise(p, n);
  shade = 1.0 - lit;
  return c;
}
void writeOutId(vec3 c, float shade, vec3 n, float id) {
  gColor = vec4(clamp(c, 0.0, 1.0), 1.0 - 0.5 * clamp(shade, 0.0, 1.0));
  vec3 vn = normalize((viewMatrix * vec4(n, 0.0)).xyz);
  gNormal = vec4(vn * 0.5 + 0.5, id / 255.0);
}
void writeOut(vec3 c, float shade, vec3 n) { writeOutId(c, shade, n, uId); }
`;

const BASIC_VS = /* glsl */`
uniform vec3 uColor;
out vec3 vWPos;
out vec3 vWNormal;
out vec3 vCol;
out vec2 vUv;
void main() {
  mat4 m = modelMatrix;
#ifdef USE_INSTANCING
  m = m * instanceMatrix;
#endif
  vec4 wp = m * vec4(position, 1.0);
  vWPos = wp.xyz;
  vWNormal = normalize(mat3(m) * normal);
  vCol = uColor;
#ifdef USE_INSTANCING_COLOR
  vCol *= instanceColor;
#endif
#ifdef USE_COLOR
  vCol *= color;
#endif
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const BASIC_FS = /* glsl */`
${COMMON}
in vec3 vWPos;
in vec3 vWNormal;
in vec3 vCol;
in vec2 vUv;
uniform float uFlat;
uniform float uEmissive;
uniform float uDouble;
uniform float uReceive;
uniform vec3 uTint;
uniform float uTintAmt;
#ifdef USE_MAP_TEX
uniform sampler2D uMap;
#endif
void main() {
  vec3 n = normalize(vWNormal);
  if (uFlat > 0.5) n = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
  if (uFlat > 0.5 || uDouble > 0.5) { if (dot(n, cameraPosition - vWPos) < 0.0) n = -n; }
  vec3 base = mix(vCol, uTint, uTintAmt);
#ifdef USE_MAP_TEX
  vec4 tx = texture(uMap, vUv);
  base = mix(base, tx.rgb, tx.a);
#endif
  float shade;
  vec3 c = wcLight(base, n, vWPos, uReceive, shade);
  c = mix(c, base, uEmissive);
  shade *= 1.0 - uEmissive;
  writeOut(c, shade, n);
}
`;

export function basicMaterial({ color = 0xffffff, id = 10, flat = false, emissive = 0, map = null, doubleSide = false, receive = 1, vertexColors = false } = {}) {
  const defines = {};
  if (map) defines.USE_MAP_TEX = '';
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    defines,
    uniforms: {
      ...sharedUniforms(),
      uColor: { value: new THREE.Color(color) },
      uId: { value: id },
      uFlat: { value: flat ? 1 : 0 },
      uEmissive: { value: emissive },
      uDouble: { value: doubleSide ? 1 : 0 },
      uReceive: { value: receive },
      uTint: { value: new THREE.Color(0xffffff) },
      uTintAmt: { value: 0 },
      uMap: { value: map },
    },
    vertexShader: BASIC_VS,
    fragmentShader: BASIC_FS,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors,
  });
}

// Houses and the giant building: windows, shutters, doors, tiles and coffers drawn in the shader.
const ARCH_VS = /* glsl */`
attribute vec4 aFac;
attribute vec4 aCell;
out vec3 vWPos;
out vec3 vWNormal;
out vec3 vCol;
out vec4 vFac;
out vec4 vCell;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vWNormal = normalize(mat3(modelMatrix) * normal);
  vCol = color;
  vFac = aFac;
  vCell = aCell;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const ARCH_FS = /* glsl */`
${COMMON}
in vec3 vWPos;
in vec3 vWNormal;
in vec3 vCol;
in vec4 vFac;
in vec4 vCell;
float boxMask(vec2 f, vec2 hw, float aa) {
  vec2 d = abs(f) - hw;
  return (1.0 - smoothstep(-aa, aa, d.x)) * (1.0 - smoothstep(-aa, aa, d.y));
}
void main() {
  vec3 n = normalize(vWNormal);
  if (dot(n, cameraPosition - vWPos) < 0.0) n = -n;
  float kindRaw = floor(vFac.z + 0.5);
  float night = step(9.5, kindRaw);
  float kind = kindRaw - 10.0 * night;
  vec2 uv = vFac.xy;
  float seed = vFac.w;
  vec3 base = vCol;
  float inkAmt = 0.0;
  float emis = 0.0;
  float aa = max(fwidth(uv.x), fwidth(uv.y)) * 0.8 + 0.001;
  vec3 inkC = vec3(0.16, 0.13, 0.19);
  if (kind == 2.0) {
    float rowH = 0.8;
    float r = uv.y / rowH;
    float row = floor(r);
    float fr = fract(r);
    float gx = uv.x / 1.1 + 0.5 * mod(row, 2.0);
    float tx = fract(gx);
    float seam = (1.0 - smoothstep(0.0, 0.14 + aa / rowH, fr)) + (1.0 - smoothstep(0.0, 0.05 + aa, min(tx, 1.0 - tx))) * 0.5;
    base *= 0.92 + 0.12 * hash21(vec2(floor(gx), row) + seed);
    inkAmt = clamp(seam, 0.0, 1.0) * 0.32;
  } else if (kind == 3.0) {
    vec2 g = abs(fract(uv / vCell.xy) - 0.5) * vCell.xy;
    vec2 hwc = vCell.xy * 0.5;
    float e = max(g.x - hwc.x + 1.4, g.y - hwc.y + 1.4);
    float frame = smoothstep(-aa, aa, e);
    base = mix(base, base * 0.86, frame);
    float line = 1.0 - smoothstep(0.0, 0.14 + aa, abs(e));
    inkAmt = line * 0.45;
  } else if (kind == 5.0) {
    float b = uv.y;
    float l1 = 1.0 - smoothstep(0.06, 0.06 + aa * 2.0, abs(b - 2.0));
    float l2 = 1.0 - smoothstep(0.06, 0.06 + aa * 2.0, abs(b - (vCell.w - 3.2)));
    float l3 = 1.0 - smoothstep(0.06, 0.06 + aa * 2.0, abs(b - (vCell.w - 1.2)));
    base *= (b < 2.0 || b > vCell.w - 3.2) ? 0.9 : 1.0;
    float dent = step(vCell.w - 3.2, b) * step(b, vCell.w - 1.2) * step(0.5, fract(uv.x / 1.8));
    base *= 1.0 - dent * 0.14;
    inkAmt = max(max(l1, l2), l3) * 0.6;
  } else if (kind == 1.0 || kind == 4.0 || kind == 6.0) {
    vec2 cs = vCell.xy;
    vec2 face = vCell.zw;
    float cols = max(1.0, floor(face.x / cs.x));
    float offx = (face.x - cols * cs.x) * 0.5;
    float gx = (uv.x - offx) / cs.x;
    float cx = floor(gx);
    float row = floor(uv.y / cs.y);
    float rows = floor((face.y - cs.y * 0.25) / cs.y);
    if (cx >= 0.0 && cx < cols && row >= 0.0 && row < rows) {
      vec2 f = vec2((fract(gx) - 0.5) * cs.x, uv.y - (row + 0.55) * cs.y);
      float h = hash21(vec2(cx, row) + seed * 37.0);
      float h2 = hash21(vec2(seed * 11.0, 3.7));
      vec2 hw = cs * vec2(0.19, 0.25);
      float fw = 0.13 * cs.x / 3.2;
      bool isDoor = (kind == 4.0 && row == 0.0 && abs(cx - floor(cols * 0.5)) < 0.5);
      if (isDoor) {
        vec2 dh = vec2(cs.x * 0.2, cs.y * 0.36);
        vec2 df = vec2(f.x, uv.y - row * cs.y - dh.y);
        float dm = boxMask(df, dh, aa);
        float dfr = dm - boxMask(df, dh - vec2(fw), aa);
        vec3 doorC = h2 < 0.33 ? vec3(0.30, 0.45, 0.40) : (h2 < 0.66 ? vec3(0.62, 0.28, 0.24) : vec3(0.28, 0.36, 0.56));
        if (night > 0.5) doorC = mix(doorC, vec3(1.0, 0.82, 0.45), step(dh.y * 0.55, df.y) * 0.9);
        base = mix(base, doorC, dm);
        inkAmt = max(inkAmt, dfr * 0.9);
        emis = max(emis, night * dm * step(dh.y * 0.55, df.y));
      } else {
        float wm = boxMask(f, hw, aa);
        float frm = wm - boxMask(f, hw - vec2(fw), aa);
        float mull = wm * max(1.0 - smoothstep(fw * 0.35, fw * 0.35 + aa, abs(f.x)), 1.0 - smoothstep(fw * 0.35, fw * 0.35 + aa, abs(f.y - hw.y * 0.25)));
        vec3 glass = vec3(0.40, 0.48, 0.60);
        float streak = 1.0 - smoothstep(0.0, 0.35, abs(f.x + f.y * 0.6 + hw.x * 0.3) / hw.x);
        glass = mix(glass, vec3(0.74, 0.81, 0.86), streak * 0.5);
        if (night > 0.5 && h > 0.3) {
          glass = mix(vec3(1.0, 0.78, 0.40), vec3(1.0, 0.93, 0.68), streak);
          emis = max(emis, wm);
        }
        base = mix(base, glass, wm);
        vec3 shutC = h2 < 0.25 ? vec3(0.28, 0.52, 0.50) : (h2 < 0.5 ? vec3(0.42, 0.58, 0.34) : (h2 < 0.75 ? vec3(0.33, 0.47, 0.68) : vec3(0.70, 0.34, 0.28)));
        float sw = hw.x * 0.95;
        vec2 sf = vec2(abs(f.x) - hw.x - fw * 0.6 - sw * 0.5, f.y);
        float hasShut = step(0.35, h);
        float sm = hasShut * boxMask(sf, vec2(sw * 0.5, hw.y), aa);
        float slats = step(0.5, fract(f.y / (0.09 * cs.y)));
        base = mix(base, shutC * (0.9 + 0.1 * slats), sm);
        float sfr = sm - hasShut * boxMask(sf, vec2(sw * 0.5, hw.y) - vec2(fw * 0.6), aa);
        vec2 sl = vec2(f.x, f.y + hw.y + fw * 1.1);
        float sill = boxMask(sl, vec2(hw.x * 1.2, fw * 0.9), aa);
        base = mix(base, vec3(0.93, 0.9, 0.82), sill);
        inkAmt = max(inkAmt, max(frm, mull) * 0.85);
        inkAmt = max(inkAmt, sfr * 0.6);
        inkAmt = max(inkAmt, sill * 0.3);
      }
    }
  }
  base = mix(base, inkC, inkAmt);
  float shade;
  vec3 c = wcLight(base, n, vWPos, 1.0, shade);
  c = mix(c, base, emis);
  shade *= 1.0 - emis;
  writeOutId(c, shade, n, uId + floor(seed * 40.0));
}
`;

export function archMaterial(id = 20) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...sharedUniforms(), uId: { value: id } },
    vertexShader: ARCH_VS,
    fragmentShader: ARCH_FS,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
}

// The road: asphalt with painted lane lines that slowly turns into a page of sheet music.
const ROAD_VS = /* glsl */`
attribute vec4 aRoad;
out vec3 vWPos;
out vec3 vWNormal;
out vec4 vRoad;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vWNormal = normalize(mat3(modelMatrix) * normal);
  vRoad = aRoad;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export function roadMaterial(track, bloomTex) {
  const d = track.dims;
  const fs = /* glsl */`
${COMMON}
in vec3 vWPos;
in vec3 vWNormal;
in vec4 vRoad;
uniform float uL;
uniform float uHW;
uniform float uStep;
uniform float uBar;
uniform vec4 uStreetS;
uniform vec2 uTextZ[8];
uniform sampler2D uBloom;
${musicnessFn(d.musicPts)}
float streetEnd(float s) {
  float d1 = min(min(abs(s - uStreetS.x), abs(s - uStreetS.y)), min(abs(s - uStreetS.z), min(abs(s - uL), s)));
  return d1;
}
void main() {
  float x = vRoad.x;
  float s = vRoad.y;
  float face = vRoad.z;
  vec3 n = normalize(vWNormal);
  float m = musicness(s);
  float pm = smoothstep(0.08, 0.85, m);
  vec3 asphalt = vec3(0.56, 0.56, 0.61);
  vec3 paperC = vec3(0.965, 0.935, 0.86);
  vec3 base = mix(asphalt, paperC, pm);
  vec3 inkC = vec3(0.14, 0.12, 0.18);
  float glow = 0.0;
  if (face < 0.5) {
    float w1 = texture(uNoise, vec2(s * 0.0043, x * 0.021)).r;
    float w2 = texture(uNoise, vec2(s * 0.017, x * 0.06) + 0.4).a;
    base *= 0.92 + 0.1 * w1 + 0.05 * w2;
    float ax = abs(x);
    float aa = max(fwidth(x), 0.004) * 1.2;
    float aas = max(fwidth(s), 0.004) * 1.2;
    float kerb = smoothstep(uHW - 0.95 - aa, uHW - 0.95 + aa, ax);
    base = mix(base, mix(vec3(0.80, 0.77, 0.70), vec3(0.93, 0.89, 0.80), pm), kerb * 0.9);
    vec3 paint = mix(vec3(0.97, 0.96, 0.92), inkC, smoothstep(0.3, 0.65, m));
    float dashFill = mix(step(0.45, fract(s / 6.0)), 1.0, smoothstep(0.15, 0.45, m));
    float lines = 0.0;
    float lw = mix(0.1, 0.075, pm);
    for (int i = 0; i < 5; i++) {
      float lx = (4.0 - float(i) * 2.0) * uStep;
      lines = max(lines, 1.0 - smoothstep(lw - aa, lw + aa, abs(x - lx)));
    }
    float inText = 0.0;
    for (int i = 0; i < 8; i++) inText = max(inText, step(uTextZ[i].x, s) * step(s, uTextZ[i].y));
    lines *= dashFill * (1.0 - inText * (1.0 - smoothstep(0.15, 0.45, m)));
    float bs = mod(s, uBar);
    float bd = min(bs, uBar - bs);
    float onStaff = step(ax, 4.0 * uStep + 0.04);
    float bar = (1.0 - smoothstep(0.07 - aas, 0.07 + aas, bd)) * onStaff * smoothstep(0.15, 0.45, m);
    float se = streetEnd(s + 0.9);
    float dbl = (1.0 - smoothstep(0.22 - aas, 0.22 + aas, abs(se))) * onStaff * smoothstep(0.1, 0.3, m);
    float edgeL = 1.0 - smoothstep(0.08 - aa, 0.08 + aa, abs(ax - (uHW - 0.95)));
    base = mix(base, paint, max(max(lines, bar), dbl) * 0.92);
    base = mix(base, inkC, edgeL * 0.85);
    vec4 bl = texture(uBloom, vec2(s / uL, (x + uHW) / (2.0 * uHW)));
    base = mix(base, bl.rgb * mix(vec3(1.0), base, 0.25 + 0.5 * pm), bl.a * 0.9);
    if (s > uStreetS.y && s < uStreetS.z) {
      float ls = s - uStreetS.y;
      float k = floor(ls / 30.0);
      float side = mod(k, 2.0) * 2.0 - 1.0;
      vec2 dd = vec2(ls - (k + 0.5) * 30.0, x - side * (uHW + 1.3));
      glow = exp(-dot(dd, dd) / 34.0);
    }
  } else if (face < 1.5) {
    base = mix(vec3(0.46, 0.45, 0.5), vec3(0.90, 0.86, 0.76), pm);
    base *= 0.94 + 0.06 * step(0.5, fract(s / 3.0));
  } else {
    base = mix(vec3(0.42, 0.41, 0.46), vec3(0.93, 0.90, 0.82), pm);
    float aa = max(fwidth(x), 0.004) * 1.2;
    float ghost = 0.0;
    for (int i = 0; i < 5; i++) {
      float lx = (4.0 - float(i) * 2.0) * uStep;
      ghost = max(ghost, 1.0 - smoothstep(0.09 - aa, 0.09 + aa, abs(x - lx)));
    }
    base = mix(base, base * 0.82, ghost * smoothstep(0.6, 1.0, m));
  }
  float shade;
  vec3 c = wcLight(base, n, vWPos, 1.0, shade);
  if (face > 0.5) { c = mix(c, base, 0.35 * pm); shade *= 1.0 - 0.35 * pm; }
  c = mix(c, base * vec3(1.0, 0.88, 0.62) * 1.08, glow * 0.85);
  shade *= 1.0 - glow;
  writeOut(c, shade, n);
}
`;
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      ...sharedUniforms(),
      uId: { value: 1 },
      uL: { value: d.L },
      uHW: { value: 8.2 },
      uStep: { value: 1.3 },
      uBar: { value: 45 },
      uStreetS: { value: new THREE.Vector4(d.streets[1], d.streets[2], d.streets[3], d.L) },
      uTextZ: { value: Array.from({ length: 8 }, () => new THREE.Vector2(-1, -1)) },
      uBloom: { value: bloomTex },
    },
    vertexShader: ROAD_VS,
    fragmentShader: fs,
  });
}

function musicnessFn(pts) {
  let code = 'float musicness(float s) {\n';
  for (let i = 1; i < pts.length; i++) {
    const [s0, m0] = pts[i - 1], [s1, m1] = pts[i];
    code += `  if (s < ${s1.toFixed(3)}) return mix(${m0.toFixed(3)}, ${m1.toFixed(3)}, (s - ${s0.toFixed(3)}) / ${(s1 - s0).toFixed(3)});\n`;
  }
  return code + '  return 0.0;\n}\n';
}

// Patchwork fields, hedges, a river and the town square.
const GROUND_VS = /* glsl */`
out vec3 vWPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export function groundMaterial(town) {
  const fs = /* glsl */`
${COMMON}
in vec3 vWPos;
uniform vec4 uTown;
void main() {
  vec2 p = vWPos.xz;
  vec2 q = mat2(0.8, 0.6, -0.6, 0.8) * p;
  vec2 cs = vec2(150.0, 105.0);
  vec2 id = floor(q / cs);
  vec2 f = fract(q / cs);
  float h = hash21(id);
  vec3 col = h < 0.2 ? vec3(0.72, 0.79, 0.52) : (h < 0.4 ? vec3(0.85, 0.79, 0.52) : (h < 0.6 ? vec3(0.62, 0.74, 0.47) : (h < 0.8 ? vec3(0.88, 0.83, 0.62) : vec3(0.66, 0.73, 0.56))));
  float ang = h * 6.2831;
  float fur = sin(dot(q, vec2(cos(ang), sin(ang))) * 0.45);
  col *= 0.965 + 0.035 * fur;
  vec2 bd = min(f, 1.0 - f) * cs;
  float b = min(bd.x, bd.y);
  float hedge = 1.0 - smoothstep(1.5, 4.5, b + texture(uNoise, p * 0.02).r * 3.0);
  col = mix(col, vec3(0.43, 0.56, 0.37), hedge * 0.8);
  float rz = p.y - 760.0 - 200.0 * sin(p.x * 0.0021) - 80.0 * sin(p.x * 0.0057 + 1.3);
  float river = 1.0 - smoothstep(16.0, 19.0, abs(rz));
  float bank = 1.0 - smoothstep(19.0, 32.0, abs(rz));
  col = mix(col, vec3(0.52, 0.63, 0.44), bank * 0.6);
  vec3 water = mix(vec3(0.50, 0.68, 0.76), vec3(0.72, 0.84, 0.86), smoothstep(0.55, 0.8, texture(uNoise, vec2(p.x * 0.004, rz * 0.03)).b));
  col = mix(col, water, river);
  vec2 tq = abs(p - uTown.xy) - uTown.zw;
  float town = 1.0 - smoothstep(0.0, 18.0, max(tq.x, tq.y) + texture(uNoise, p * 0.01).a * 14.0);
  vec2 cob = abs(fract(p / 2.2) - 0.5);
  vec3 paving = vec3(0.86, 0.79, 0.64) * (0.95 + 0.05 * step(0.44, max(cob.x, cob.y)));
  col = mix(col, paving, town);
  col *= 0.9 + 0.2 * texture(uNoise, p * 0.0009).r;
  float shade;
  vec3 c = wcLight(col, vec3(0.0, 1.0, 0.0), vWPos, 1.0, shade);
  writeOut(c, shade, vec3(0.0, 1.0, 0.0));
}
`;
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...sharedUniforms(), uId: { value: 2 }, uTown: { value: new THREE.Vector4(...town) } },
    vertexShader: GROUND_VS,
    fragmentShader: fs,
  });
}

// Paint on the road: blended into colour, while the ink pass keeps seeing the road underneath.
const DECAL_VS = /* glsl */`
out vec3 vWPos;
out vec3 vWNormal;
out vec2 vUv;
#ifdef NOTE_DECAL
attribute vec4 aNote;
attribute vec2 aLocal;
out vec4 vNote;
out vec2 vLocal;
#endif
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vWNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
#ifdef NOTE_DECAL
  vNote = aNote;
  vLocal = aLocal;
#endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const DECAL_FS = /* glsl */`
${COMMON}
in vec3 vWPos;
in vec3 vWNormal;
in vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
#ifdef NOTE_DECAL
in vec4 vNote;
in vec2 vLocal;
uniform sampler2D uStates;
uniform float uCount;
uniform float uNext;
#else
uniform sampler2D uMap;
#endif
void main() {
  vec3 col = uColor;
  float a;
#ifdef NOTE_DECAL
  vec2 pg = vec2(vLocal.x, -vLocal.y);
  float ca = cos(0.38), sa = sin(0.38);
  vec2 r = vec2(ca * pg.x + sa * pg.y, -sa * pg.x + ca * pg.y);
  float e = length(r / vec2(0.8, 0.56));
  float aa = fwidth(e) + 0.01;
  float head = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, e);
  if (vNote.y > 0.5) head *= smoothstep(1.0 - aa, 1.0 + aa, length(r / vec2(0.58, 0.24)));
  float sx = vNote.z > 0.0 ? 0.74 : -0.74;
  float aw = fwidth(vLocal.x) * 1.5 + 0.01;
  float stem = (1.0 - smoothstep(0.07, 0.07 + aw, abs(vLocal.x - sx))) * step(0.0, pg.y * vNote.z) * step(abs(pg.y), 4.2);
  stem *= smoothstep(0.3, 0.55, vNote.w);
  float dotm = vNote.y > 1.5 ? 1.0 - smoothstep(0.2 - aa, 0.2 + aa, length(pg - vec2(1.2, 0.36))) : 0.0;
  vec4 st = texture(uStates, vec2((vNote.x + 0.5) / uCount, 0.5));
  vec3 inkC = vec3(0.13, 0.11, 0.17);
  col = inkC;
  a = max(max(head, stem), dotm) * 0.9;
  if (abs(vNote.x - uNext) < 0.5) col = mix(inkC, st.rgb, 0.45 + 0.35 * sin(uTime * 9.0));
  if (st.a > 0.25 && st.a < 0.75) col = st.rgb * 0.85;
  if (st.a > 0.75) { col = vec3(0.56, 0.54, 0.6); a *= 0.55; }
#else
  vec4 t = texture(uMap, vUv);
  a = t.a;
  col *= t.rgb;
#endif
  a *= uOpacity;
  if (a < 0.01) discard;
  vec3 n = normalize(vWNormal);
  float shade;
  vec3 c = wcLight(col, n, vWPos, 1.0, shade);
  gColor = vec4(clamp(c, 0.0, 1.0), a);
  vec3 vn = normalize((viewMatrix * vec4(n, 0.0)).xyz);
  gNormal = vec4(vn * 0.5 + 0.5, a);
}
`;

function decalBase(defines, uniforms) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    defines,
    uniforms: { ...sharedUniforms(), uId: { value: 1 }, uColor: { value: new THREE.Color(0xffffff) }, uOpacity: { value: 1 }, ...uniforms },
    vertexShader: DECAL_VS,
    fragmentShader: DECAL_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
}

export function decalMaterial(map, color = 0xffffff, opacity = 1) {
  const m = decalBase({}, { uMap: { value: map } });
  m.uniforms.uColor.value.set(color);
  m.uniforms.uOpacity.value = opacity;
  return m;
}

export function noteDecalMaterial(statesTex, count) {
  return decalBase({ NOTE_DECAL: '' }, {
    uStates: { value: statesTex }, uCount: { value: count }, uNext: { value: -10 },
  });
}

// GLSL for every procedural surface in the atlas. Nothing here samples an image:
// all planets, clouds, rings, the star and the sky are computed from noise.

export const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// Simplex noise (Ashima Arts / Gustavson), value only.
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Simplex noise with its analytic gradient (used for bump-mapped relief).
float snoiseG(vec3 v, out vec3 grad) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  vec4 m2 = m * m;
  vec4 m4 = m2 * m2;
  vec4 pdotx = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3));
  vec4 temp = m2 * m * pdotx;
  grad = -8.0 * (temp.x * x0 + temp.y * x1 + temp.z * x2 + temp.w * x3);
  grad += m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3;
  grad *= 42.0;
  return 42.0 * dot(m4, pdotx);
}

float fbm(vec3 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * snoise(p);
    p = p * 2.02 + vec3(19.1, 7.3, 3.7);
    a *= 0.5;
  }
  return s;
}

float fbmG(vec3 p, int oct, out vec3 grad) {
  float s = 0.0, a = 0.5, f = 1.0;
  grad = vec3(0.0);
  vec3 gi;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float n = snoiseG(p, gi);
    s += a * n;
    grad += a * f * gi;
    p = p * 2.02 + vec3(19.1, 7.3, 3.7);
    f *= 2.02;
    a *= 0.5;
  }
  return s;
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// Voronoi with true distance to the cell border: x = border distance, y = F1, z = cell id.
vec3 voronoiB(vec3 x) {
  vec3 n = floor(x);
  vec3 f = fract(x);
  vec3 mg = vec3(0.0), mr = vec3(0.0);
  float md = 8.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 r = g + 0.1 + 0.8 * hash33(n + g) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  float bd = 8.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 g = mg + vec3(float(i), float(j), float(k));
    vec3 r = g + 0.1 + 0.8 * hash33(n + g) - f;
    vec3 dr = r - mr;
    if (dot(dr, dr) > 1e-5) bd = min(bd, dot(0.5 * (mr + r), normalize(dr)));
  }
  return vec3(bd, sqrt(md), hash13(n + mg + 0.5));
}

vec3 rotY(vec3 v, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}
vec3 rotAxis(vec3 v, vec3 k, float a) {
  float c = cos(a), s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}
`;

export const PLANET_VERT = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vObjNormal;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vObjPos = position;
  vObjNormal = normal;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const CLOUD_FIELD = /* glsl */ `
uniform float uCloudCover;
uniform float uCloudScale;
uniform vec3 uCloudSeed;
float cloudField(vec3 p) {
  vec3 q = p * uCloudScale + uCloudSeed;
  float t = uTime * 0.012;
  vec3 w = vec3(snoise(q * 0.5 + vec3(t, 0.0, 0.0)), snoise(q * 0.5 + vec3(0.0, 13.1, t)), snoise(q * 0.5 + vec3(7.3, t, 3.3)));
  float c = fbm(q * 1.35 + w * 0.5, 7);
  c += 0.12 * snoise(q * 6.5 + w * 2.0) - 0.04;
  c += 0.12 * cos(p.y * 10.0 + 0.6);
  float v = c * 0.5 + 0.5;
  float thr = 1.0 - uCloudCover;
  return smoothstep(thr - 0.08, thr + 0.14, v);
}
`;

const RING_DENSITY = /* glsl */ `
float ringDensity(float r, float rin, float rout) {
  float x = (r - rin) / (rout - rin);
  if (x < 0.0 || x > 1.0) return 0.0;
  float d = 0.62 + 0.2 * sin(x * 38.0 + sin(x * 9.0) * 2.0) + 0.1 * sin(x * 97.0 + 1.3) + 0.04 * sin(x * 263.0);
  d *= smoothstep(0.0, 0.035, x) * smoothstep(1.0, 0.95, x);
  d *= 1.0 - 0.95 * smoothstep(0.035, 0.0, abs(x - 0.63));
  d *= 1.0 - 0.7 * smoothstep(0.012, 0.0, abs(x - 0.87));
  d *= mix(0.28, 1.0, smoothstep(0.1, 0.32, x));
  d *= mix(1.0, 0.55, smoothstep(0.66, 0.72, x));
  return clamp(d, 0.0, 1.0);
}
`;

const COLORMAPS = /* glsl */ `
vec3 inferno(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.02, 0.01, 0.08), c1 = vec3(0.34, 0.06, 0.43), c2 = vec3(0.76, 0.21, 0.33), c3 = vec3(0.98, 0.56, 0.05), c4 = vec3(1.0, 0.98, 0.68);
  vec3 c = t < 0.25 ? mix(c0, c1, t * 4.0) : t < 0.5 ? mix(c1, c2, t * 4.0 - 1.0) : t < 0.75 ? mix(c2, c3, t * 4.0 - 2.0) : mix(c3, c4, t * 4.0 - 3.0);
  return pow(c, vec3(2.2));
}
vec3 topo(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.06, 0.1, 0.36), c1 = vec3(0.1, 0.55, 0.68), c2 = vec3(0.4, 0.74, 0.34), c3 = vec3(0.88, 0.72, 0.42), c4 = vec3(1.0);
  vec3 c = t < 0.25 ? mix(c0, c1, t * 4.0) : t < 0.5 ? mix(c1, c2, t * 4.0 - 1.0) : t < 0.75 ? mix(c2, c3, t * 4.0 - 2.0) : mix(c3, c4, t * 4.0 - 3.0);
  return pow(c, vec3(2.2));
}
`;

// ---------------------------------------------------------------------------
// Surface generators. Exactly one TYPE_* define is set per material, so each
// planet compiles only its own generator.
// ---------------------------------------------------------------------------
const SURFACES = /* glsl */ `
struct Surf {
  vec3 albedo; vec3 grad; vec3 emit;
  float spec; float gloss; float nightOnly; float metal;
  float height; float heat; float film; float edge;
};

#ifdef TYPE_TERRAN
void surfaceType(vec3 p, vec3 pn, vec3 Nw, vec3 L, inout Surf s) {
  vec3 q = p * uScale + uSeed;
  vec3 w = vec3(snoise(q * 0.5), snoise(q * 0.5 + vec3(17.3, 5.1, 9.7)), snoise(q * 0.5 + vec3(3.9, 31.7, 12.2)));
  vec3 g, g2;
  float h = fbmG(q + w * 0.55, 7, g);
  float r = snoiseG(q * 3.3 + 11.0, g2);
  h += 0.1 * r;
  g += 0.33 * g2;
  float lat = abs(pn.y);
  float coast = h - uSea;
  vec3 col;
  if (coast < 0.0) {
    float depth = clamp(-coast / 0.55, 0.0, 1.0);
    col = mix(uColB, uColA, smoothstep(0.0, 0.3, depth));
    col = mix(col, uColB * 1.4 + 0.015, (1.0 - smoothstep(0.0, 0.05, depth)) * 0.6);
    s.spec = 1.0; s.gloss = 90.0;
    s.grad = g * 0.015;
    float reef = (1.0 - smoothstep(0.0, 0.08, depth)) * smoothstep(0.3, 0.75, snoise(q * 16.0) * 0.5 + 0.5);
    s.emit = uGlowCol * reef * uReef;
    s.height = 0.5 - depth * 0.5;
  } else {
    float e = clamp(coast / max(1.0 - uSea, 0.2), 0.0, 1.0) * 1.6;
    float moist = snoise(q * 1.3 + 71.0) * 0.5 + 0.5 + (0.5 - uTemp) * 0.35 - lat * 0.1;
    vec3 dry = mix(uColE, uColD, 0.45);
    vec3 land = mix(dry, uColC, smoothstep(0.38, 0.62, moist));
    land = mix(uColE, land, smoothstep(0.0, 0.035, e));
    land = mix(land, uColD, smoothstep(0.22, 0.55, e));
    land = mix(land, uColD * 0.62 + vec3(0.03), smoothstep(0.5, 0.9, e));
    col = land;
    s.spec = 0.06; s.gloss = 10.0;
    s.grad = g * (0.55 + e * 0.8);
    float lights = smoothstep(0.6, 0.86, snoise(q * 22.0) * 0.5 + 0.5) * smoothstep(0.0, 0.35, snoise(q * 4.0 + 7.0)) * (1.0 - smoothstep(0.04, 0.3, e));
    s.emit = uGlowCol * lights * uLights;
    s.height = 0.5 + clamp(e, 0.0, 1.0) * 0.5;
  }
  float iceLine = mix(0.6, 1.08, uTemp);
  float iceV = lat + snoise(q * 1.1 + 40.0) * 0.07 + max(coast, 0.0) * 0.5 * (1.1 - uTemp);
  float ice = smoothstep(iceLine - 0.03, iceLine + 0.03, iceV);
  col = mix(col, vec3(0.88, 0.93, 1.0), ice);
  s.spec = mix(s.spec, 0.3, ice);
  s.gloss = mix(s.gloss, 24.0, ice);
  s.emit *= 1.0 - ice;
  s.albedo = col;
  s.nightOnly = 1.0;
  s.heat = clamp(0.28 + uTemp * 0.5 - lat * 0.42 - max(coast, 0.0) * 0.3 - ice * 0.18, 0.0, 1.0);
}
#endif

#ifdef TYPE_GAS
void surfaceType(vec3 p, vec3 pn, vec3 Nw, vec3 L, inout Surf s) {
  vec3 sc = normalize(uStorm);
  float sd = length(pn - sc);
  float ss = uStormP.y;
  float sw = uStormP.x * exp(-sd * sd / (ss * ss));
  vec3 q = rotAxis(pn, sc, sw * 4.5);
  float spd = sin(q.y * 9.0) * 0.035 + sin(q.y * 23.0 + 1.0) * 0.012;
  q = rotY(q, uTime * spd);
  vec3 tq = vec3(q.x * 1.2, q.y * 5.5, q.z * 1.2) * uScale + uSeed;
  float t1 = fbm(tq + vec3(uTime * 0.008, 0.0, 0.0), 6);
  float t2 = fbm(vec3(q.x * 3.0, q.y * 14.0, q.z * 3.0) * uScale + uSeed + 9.0, 4);
  float band = q.y * uStormP.z + t1 * uStormP.w + t2 * 0.18;
  float b1 = 0.5 + 0.5 * sin(band * 3.14159);
  float b2 = 0.5 + 0.5 * sin(band * 1.37 + 2.0);
  float b3 = 0.5 + 0.5 * sin(band * 4.3 + t1 * 3.0);
  vec3 col = mix(uColA, uColB, smoothstep(0.15, 0.85, b1));
  col = mix(col, uColC, smoothstep(0.55, 0.95, b2) * 0.75);
  col = mix(col, uColD, smoothstep(0.72, 1.0, b3) * 0.35);
  col = mix(col, uColD * 0.7, smoothstep(0.78, 0.98, abs(pn.y)) * 0.8);
  float core = exp(-sd * sd / (ss * ss * 0.3));
  float halo = exp(-pow((sd - ss * 0.6) / (ss * 0.2), 2.0));
  col = mix(col, uColE, clamp(core * 0.95 * (0.75 + 0.35 * t2), 0.0, 1.0) * step(0.01, uStormP.x));
  col = mix(col, uColA * 1.1, halo * 0.3 * step(0.01, uStormP.x));
  s.albedo = col;
  s.spec = 0.02; s.gloss = 8.0;
  s.nightOnly = 1.0;
  s.height = clamp(0.5 + t1 * 0.8, 0.0, 1.0);
  s.heat = clamp(0.3 + 0.3 * b2 - 0.2 * abs(pn.y) + core * 0.45, 0.0, 1.0);
}
#endif

#ifdef TYPE_EYEBALL
void surfaceType(vec3 p, vec3 pn, vec3 Nw, vec3 L, inout Surf s) {
  vec3 q = p * uScale + uSeed;
  vec3 g;
  float n = fbmG(q, 6, g);
  float big = fbm(q * 0.8 + 3.0, 4);
  float nd = fbm(q * 3.5 + 3.0, 4);
  float sd = dot(Nw, L);
  float z = sd + n * 0.13;
  vec3 hot = mix(uColA, uColB, smoothstep(-0.28, 0.3, big + nd * 0.22 + n * 0.25));
  hot = mix(hot, uColB * 0.55, smoothstep(0.25, 0.6, n) * 0.5);
  float eye = smoothstep(0.8, 0.96, z);
  hot = mix(hot, uColA * 1.12, eye * (0.6 + 0.4 * sin(z * 55.0 + big * 4.0)));
  vec3 dusk = mix(uColC, uColC * 0.5 + vec3(0.004, 0.01, 0.0), smoothstep(-0.3, 0.4, nd));
  vec3 iceC = mix(uColD, uColE, smoothstep(-0.35, 0.45, nd));
  float cr = pow(1.0 - abs(snoise(q * 4.5)), 12.0);
  iceC = mix(iceC, uColE * 0.55, cr * 0.7);
  float wHot = smoothstep(0.24, 0.4, z);
  float wIce = smoothstep(0.02, -0.14, z);
  vec3 col = mix(dusk, hot, wHot);
  col = mix(col, iceC, wIce);
  float inDusk = (1.0 - wHot) * (1.0 - wIce);
  float lake = smoothstep(-0.02, -0.12, n) * inDusk;
  col = mix(col, vec3(0.012, 0.04, 0.07), lake);
  s.albedo = col;
  s.spec = lake * 0.9 + wIce * 0.25 + 0.03;
  s.gloss = mix(14.0, 70.0, lake);
  s.grad = g * (1.0 - lake) * (0.45 + 0.2 * wHot);
  s.emit = uGlowCol * smoothstep(0.9, 1.0, sd) * 0.25 * uGlow;
  s.nightOnly = 0.0;
  s.height = clamp(0.5 + n * 0.7, 0.0, 1.0);
  s.heat = clamp(0.08 + (sd * 0.5 + 0.5) * 0.92, 0.0, 1.0);
}
#endif

#ifdef TYPE_LAVA
void surfaceType(vec3 p, vec3 pn, vec3 Nw, vec3 L, inout Surf s) {
  vec3 q = p * uScale + uSeed;
  vec3 w = vec3(snoise(q * 0.8), snoise(q * 0.8 + 7.7), snoise(q * 0.8 + 15.1)) * 0.22;
  vec3 v = voronoiB(q * 1.15 + w);
  vec3 v2 = voronoiB(q * 3.4 + w * 2.0 + 21.0);
  vec3 g;
  float rock = fbmG(q * 3.2, 5, g);
  float tone = fract(v.z * 7.13);
  vec3 base = mix(uColA, uColB, clamp(rock * 0.7 + 0.45, 0.0, 1.0));
  base *= 0.7 + 0.6 * tone;
  float wS = 0.03 + 0.018 * snoise(q * 4.0);
  float seam = 1.0 - smoothstep(wS * 0.45, wS, v.x);
  float fineMask = smoothstep(-0.05, 0.35, snoise(q * 1.6 + 4.0));
  float fine = (1.0 - smoothstep(0.01, 0.022, v2.x)) * fineMask;
  float gold = max(seam, fine * 0.85);
  float halo = 1.0 - smoothstep(0.0, 0.16, v.x);
  s.albedo = mix(base, uColC, gold);
  s.metal = gold;
  s.spec = mix(0.35, 1.0, gold);
  s.gloss = mix(70.0, 60.0, gold);
  s.grad = g * 0.5 * (1.0 - gold);
  float flow = 0.62 + 0.38 * sin(uTime * 0.9 + snoise(q * 2.2 + vec3(0.0, uTime * 0.04, 0.0)) * 5.0);
  s.emit = uGlowCol * (gold * flow * 1.7 + halo * halo * 0.16) * uGlow;
  s.nightOnly = 0.45;
  s.height = clamp(0.55 + rock * 0.4 - gold * 0.45, 0.0, 1.0);
  s.heat = clamp(0.2 + gold * 0.75 + halo * 0.25, 0.0, 1.0);
}
#endif

#ifdef TYPE_GLOW
void surfaceType(vec3 p, vec3 pn, vec3 Nw, vec3 L, inout Surf s) {
  vec3 q = p * uScale + uSeed;
  vec3 w = vec3(snoise(q * 0.7), snoise(q * 0.7 + 9.1), snoise(q * 0.7 + 4.3));
  vec3 g;
  float h = fbmG(q + w * 0.5, 6, g);
  float isSea = smoothstep(uSea + 0.025, uSea - 0.025, h);
  vec3 land = mix(uColA, uColB, smoothstep(-0.25, 0.55, fbm(q * 3.0 + 2.0, 4)));
  s.albedo = mix(land, uColC, isSea);
  float r1 = pow(1.0 - abs(snoise(q * 2.4 + w * 0.9 + 5.0)), 26.0);
  float r1b = pow(1.0 - abs(snoise(q * 4.8 + w * 1.2 + 9.0)), 30.0);
  float r2 = pow(1.0 - abs(snoise(q * 7.0 + w * 1.5 + 13.0)), 30.0);
  float ph = snoise(q * 0.9 + 2.0) * 6.2831;
  float pulse = 0.5 + 0.5 * sin(uTime * 1.1 + ph);
  float pulse2 = 0.5 + 0.5 * sin(uTime * 2.1 + ph * 1.7 + 1.0);
  float forest = smoothstep(-0.2, 0.45, snoise(q * 1.2 + 30.0));
  float inland = smoothstep(uSea + 0.02, uSea + 0.12, h);
  vec3 veins = uGlowCol * (r1 + r1b * 0.6 * forest) * (0.3 + 0.7 * pulse) + uColD * r2 * (0.2 + 0.8 * pulse2) * 0.6 * forest;
  veins *= inland;
  float canopy = smoothstep(0.1, 0.6, fbm(q * 5.0 + 7.0, 4) * 0.5 + 0.5) * forest * inland;
  s.albedo = mix(s.albedo, s.albedo * 1.8 + uColD * 0.015, canopy * 0.5);
  float pl = smoothstep(0.6, 0.92, fbm(q * 3.6 + w + vec3(0.0, uTime * 0.02, 0.0), 4) * 0.5 + 0.5);
  float coastGlow = 1.0 - smoothstep(0.0, 0.035, abs(h - uSea));
  vec3 seaGlow = uColE * (pl * 0.55 + coastGlow * 0.8) * isSea * (0.6 + 0.4 * pulse);
  s.emit = (veins * 1.5 + seaGlow + uColD * canopy * 0.04 * (0.5 + 0.5 * pulse2)) * uGlow;
  s.nightOnly = 0.35;
  s.spec = mix(0.04, 0.5, isSea);
  s.gloss = mix(10.0, 40.0, isSea);
  s.grad = g * (1.0 - isSea) * 0.8;
  s.height = clamp(0.5 + h * 0.8, 0.0, 1.0);
  s.heat = clamp(0.22 + r1 * 0.6 + r2 * 0.3 + isSea * 0.1 + pl * isSea * 0.25, 0.0, 1.0);
}
#endif

#ifdef TYPE_CRYSTAL
void surfaceType(vec3 p, vec3 pn, vec3 Nw, vec3 L, inout Surf s) {
  vec3 q = p * uScale + uSeed;
  vec3 v = voronoiB(q * 1.5);
  vec3 v2 = voronoiB(q * 4.0 + 7.0);
  vec3 r1 = hash33(vec3(v.z * 91.7, v.z * 13.1, v.z * 47.3));
  vec3 r2 = hash33(vec3(v2.z * 61.3, v2.z * 27.9, 5.0));
  s.grad = (r1 - 0.5) * 2.4 + (r2 - 0.5) * 0.9;
  float edge = 1.0 - smoothstep(0.0, 0.03, v.x);
  float edge2 = 1.0 - smoothstep(0.0, 0.016, v2.x);
  vec3 tint = mix(uColA, uColB, r1.x);
  tint = mix(tint, uColC, smoothstep(0.75, 1.0, r1.y) * 0.8);
  float frost = smoothstep(0.45, 0.75, snoise(q * 0.9 + 3.0) * 0.5 + 0.5);
  s.albedo = tint * mix(0.1, 0.36, frost);
  s.spec = 1.0;
  s.gloss = mix(300.0, 60.0, frost);
  s.film = r1.z + r2.y * 0.3;
  s.edge = max(edge, edge2 * 0.55);
  s.emit = uGlowCol * (edge * 0.5 + edge2 * 0.15) * uGlow * (0.6 + 0.4 * sin(uTime * 0.7 + r1.x * 6.28));
  s.nightOnly = 0.6;
  s.height = clamp(0.3 + r1.y * 0.5 + (1.0 - edge) * 0.2, 0.0, 1.0);
  s.heat = clamp(0.5 + 0.35 * (dot(Nw, L) * 0.5 + 0.5) + edge * 0.2 - frost * 0.1, 0.0, 1.0);
}
#endif

#ifdef TYPE_ICE
void surfaceType(vec3 p, vec3 pn, vec3 Nw, vec3 L, inout Surf s) {
  vec3 q = p * uScale + uSeed;
  vec3 w = vec3(snoise(q * 0.9), snoise(q * 0.9 + 5.5), snoise(q * 0.9 + 11.1));
  vec3 g;
  float h = fbmG(q + w * 0.3, 6, g);
  float cr = pow(1.0 - abs(snoise(q * 2.6 + w * 0.6)), 16.0);
  float cr2 = pow(1.0 - abs(snoise(q * 6.2 + w + 3.0)), 20.0);
  float sea = smoothstep(uSea + 0.03, uSea - 0.03, h);
  vec3 col = mix(uColB, uColA, smoothstep(-0.3, 0.5, h));
  col = mix(col, uColC, sea * 0.75);
  float crev = max(cr, cr2 * 0.7) * (1.0 - sea * 0.6);
  col = mix(col, uColD, crev * 0.85);
  col = mix(col, vec3(0.93, 0.96, 1.0), smoothstep(0.72, 0.95, abs(pn.y)) * 0.55);
  s.albedo = col;
  s.spec = mix(0.25, 0.8, sea);
  s.gloss = mix(20.0, 110.0, sea);
  s.grad = g * (1.0 - sea) * 0.5;
  s.emit = uGlowCol * cr * (1.0 - sea * 0.6) * 0.06 * uGlow;
  s.nightOnly = 1.0;
  s.height = clamp(0.5 + h * 0.7 - crev * 0.25, 0.0, 1.0);
  s.heat = clamp(0.06 + crev * 0.25 + (1.0 - abs(pn.y)) * 0.12, 0.0, 1.0);
}
#endif

#ifdef TYPE_MOON
void surfaceType(vec3 p, vec3 pn, vec3 Nw, vec3 L, inout Surf s) {
  vec3 q = p * uScale + uSeed;
  vec3 g;
  float h = fbmG(q, 5, g);
  float m = smoothstep(-0.1, 0.3, snoise(q * 0.6 + 4.0));
  s.albedo = mix(uColA, uColB, clamp(h * 0.6 + 0.5, 0.0, 1.0)) * mix(0.75, 1.0, m);
  s.grad = g;
  s.spec = 0.02; s.gloss = 8.0;
  s.height = clamp(h * 0.6 + 0.5, 0.0, 1.0);
  s.heat = 0.25;
}
#endif
`;

export const PLANET_FRAG = /* glsl */ `
uniform mat4 modelMatrix;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uTermCol;
uniform vec3 uSeed;
uniform float uScale;
uniform float uSea;
uniform float uTemp;
uniform float uBump;
uniform float uGlow;
uniform float uReef;
uniform float uLights;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
uniform vec3 uColD;
uniform vec3 uColE;
uniform vec3 uGlowCol;
uniform vec3 uAtmoCol;
uniform float uAtmoStr;
uniform vec3 uStorm;
uniform vec4 uStormP;
uniform float uCloudOffset;
uniform float uCloudShadow;
uniform vec3 uCenter;
uniform float uRadius;
uniform vec3 uRingNormal;
uniform float uRingIn;
uniform float uRingOut;
uniform vec2 uTorus;
uniform samplerCube uEnv;
uniform float uScan;
uniform float uScanMix;
uniform vec3 uHiCol;
uniform float uHighlight;

varying vec3 vObjPos;
varying vec3 vObjNormal;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

${NOISE}
${CLOUD_FIELD}
${RING_DENSITY}
${COLORMAPS}
${SURFACES}

#ifdef HAS_RINGS
float ringShadow(vec3 wp, vec3 L) {
  float denom = dot(L, uRingNormal);
  if (abs(denom) < 1e-4) return 0.0;
  float t = dot(uCenter - wp, uRingNormal) / denom;
  if (t <= 0.0) return 0.0;
  vec3 hit = wp + L * t;
  return ringDensity(length(hit - uCenter) / uRadius, uRingIn, uRingOut);
}
#endif

#ifdef SHAPE_TORUS
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}
float torusShadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.02;
  for (int i = 0; i < 48; i++) {
    float h = sdTorus(ro + rd * t, uTorus);
    res = min(res, 9.0 * h / t);
    t += clamp(h, 0.012, 0.25);
    if (res < 0.002 || t > 4.0) break;
  }
  return clamp(res, 0.0, 1.0);
}
#endif

void main() {
  vec3 Ng = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uSunDir);
  vec3 pn = normalize(vObjNormal);
#ifdef SHAPE_TORUS
  vec3 p = vObjPos;
#else
  vec3 p = normalize(vObjPos);
#endif

  Surf s;
  s.albedo = vec3(0.5); s.grad = vec3(0.0); s.emit = vec3(0.0);
  s.spec = 0.0; s.gloss = 16.0; s.nightOnly = 1.0; s.metal = 0.0;
  s.height = 0.5; s.heat = 0.5; s.film = 0.0; s.edge = 0.0;
  surfaceType(p, pn, Ng, L, s);

  mat3 m3 = mat3(modelMatrix);
  float sc = length(m3[0]);
  vec3 gW = (m3 * s.grad) / sc;
  vec3 N = normalize(Ng - (gW - dot(gW, Ng) * Ng) * uBump);

  float NgL = dot(Ng, L);
  float NdL = dot(N, L);
  float day = smoothstep(-0.18, 0.22, NgL);
  float lit = clamp(NdL, 0.0, 1.0) * smoothstep(-0.1, 0.15, NgL);

  float shadow = 1.0;
#ifdef HAS_RINGS
  shadow *= 1.0 - ringShadow(vWorldPos, L) * 0.85;
#endif
#if defined(HAS_CLOUD_SHADOW) || defined(SHAPE_TORUS)
  vec3 Lobj = normalize(transpose(m3) * L);
#endif
#ifdef HAS_CLOUD_SHADOW
  {
  #ifdef SHAPE_TORUS
    vec3 pc = rotY(p + Lobj * 0.01, -uCloudOffset);
  #else
    vec3 pc = normalize(rotY(p + Lobj * 0.018, -uCloudOffset));
  #endif
    shadow *= 1.0 - cloudField(pc) * uCloudShadow;
  }
#endif
#ifdef SHAPE_TORUS
  if (NgL > -0.2) shadow *= torusShadow(vObjPos + pn * 0.006, Lobj);
  else shadow = 0.0;
#endif

  vec3 warm = mix(uTermCol, vec3(1.0), smoothstep(0.0, 0.4, NgL));
  vec3 sunC = uSunColor * warm;
  vec3 col = s.albedo * (sunC * lit * shadow + uAmbient);

  vec3 H = normalize(L + V);
  float NdH = max(dot(N, H), 0.0);
  float NdV = max(dot(N, V), 0.0);
  float fr = 0.04 + 0.96 * pow(1.0 - clamp(dot(H, V), 0.0, 1.0), 5.0);
  float specP = pow(NdH, s.gloss) * (s.gloss + 8.0) / 25.1327;
  vec3 specCol = mix(vec3(1.0), s.albedo / max(max(s.albedo.r, max(s.albedo.g, s.albedo.b)), 0.001), s.metal);
  col += sunC * specCol * specP * s.spec * (0.18 + fr) * lit * shadow;

#ifdef TYPE_CRYSTAL
  {
    vec3 R = reflect(-V, N);
    vec3 env = textureCube(uEnv, R).rgb;
    float frc = 0.05 + 0.95 * pow(1.0 - NdV, 4.0);
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (s.film + NdV * 1.4 + vec3(0.0, 0.33, 0.67)));
    col += env * film * (0.6 + 3.0 * frc) * 1.5;
    col += sunC * film * specP * lit * shadow * 0.6;
    col += mix(uColC, film, 0.5) * s.edge * (0.03 + 0.3 * lit * shadow);
    col += s.albedo * film * 0.12 * (0.3 + day);
  }
#endif

  col += s.emit * mix(1.0, 1.0 - day, s.nightOnly);

  float rimG = 1.0 - max(dot(Ng, V), 0.0);
  float atmoLit = smoothstep(-0.3, 0.5, NgL);
  col += uAtmoCol * pow(rimG, 2.5) * atmoLit * uAtmoStr;

  if (uScanMix > 0.001) {
    float shade = 0.42 + 0.58 * clamp(NgL * 0.5 + 0.6, 0.0, 1.0);
    vec3 sc3 = uScan < 1.5 ? inferno(s.heat) : topo(s.height);
    vec2 gg = vec2(atan(pn.z, pn.x), asin(clamp(pn.y, -1.0, 1.0))) * (12.0 / 3.14159265);
    vec2 gf = abs(fract(gg + 0.5) - 0.5) / max(fwidth(gg), vec2(1e-4));
    float grid = 1.0 - clamp(min(gf.x, gf.y), 0.0, 1.0);
    vec3 scanC = sc3 * shade;
    if (uScan > 1.5) {
      float hc = s.height * 14.0;
      float ct = abs(fract(hc + 0.5) - 0.5) / max(fwidth(hc), 1e-4);
      scanC *= mix(0.5, 1.0, clamp(ct, 0.0, 1.0));
    }
    scanC += vec3(0.05, 0.07, 0.09) * grid;
    col = mix(col, scanC, uScanMix);
  }

  col += uHiCol * pow(rimG, 3.0) * uHighlight;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const CLOUD_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uCloudTint;
uniform float uCloudOpacity;
uniform float uScanMix;
varying vec3 vObjPos;
varying vec3 vObjNormal;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
${NOISE}
${CLOUD_FIELD}
void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(cameraPosition - vWorldPos);
#ifdef CLOUD_EYE
  float sd = dot(N, L);
  float r = acos(clamp(sd, -1.0, 1.0));
  vec3 U = normalize(cross(L, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
  vec3 W = cross(L, U);
  float phi = atan(dot(N, W), dot(N, U));
  vec3 q = normalize(vObjPos) * uCloudScale + uCloudSeed;
  float n = fbm(q * 1.6 + vec3(0.0, uTime * 0.01, 0.0), 5);
  float arms = sin(phi * 3.0 + r * 9.0 - uTime * 0.12 + n * 2.0);
  float core = smoothstep(1.05, 0.15, r);
  float d = core * clamp(0.5 + 0.35 * arms + 0.6 * n, 0.0, 1.0);
  d *= smoothstep(0.03, 0.11, r);
  d = max(d, smoothstep(0.62, 0.85, n * 0.5 + 0.5) * 0.55 * smoothstep(1.9, 1.35, r));
  float dens = clamp(d * 1.25, 0.0, 1.0);
#else
  #ifdef SHAPE_TORUS
  float dens = cloudField(vObjPos);
  #else
  float dens = cloudField(normalize(vObjPos));
  #endif
#endif
  float NgL = dot(N, L);
  float lit = smoothstep(-0.18, 0.35, NgL);
  vec3 tint = mix(vec3(1.0, 0.55, 0.34), vec3(1.0), smoothstep(0.0, 0.4, NgL));
  vec3 c = uCloudTint * (uSunColor * tint * lit * 0.95 + uAmbient * 2.0);
  float edge = smoothstep(0.0, 0.28, dot(N, V));
  float a = dens * uCloudOpacity * edge * (1.0 - uScanMix * 0.85);
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const ATMO_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uCenter;
uniform float uRadius;
uniform float uRa;
uniform vec3 uAtmoShellCol;
uniform vec3 uSunsetCol;
uniform float uAtmoShellStr;
uniform vec3 uHiCol;
uniform float uHighlight;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vec3 L = normalize(uSunDir);
#ifdef SHAPE_TORUS
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float k = clamp(-dot(N, V) / 0.45, 0.0, 1.0);
  float dens = k * k;
  float sl = dot(N, L);
  vec3 rd = -V;
#else
  vec3 rd = normalize(vWorldPos - cameraPosition);
  vec3 oc = cameraPosition - uCenter;
  float t = max(-dot(oc, rd), 0.0);
  vec3 cp = oc + rd * t;
  float d = length(cp);
  float h = clamp((d - uRadius) / (uRa - uRadius), 0.0, 1.0);
  float dens = exp(-h * 3.4) * (1.0 - h);
  float sl = dot(cp / max(d, 1e-4), L);
#endif
  float dayF = smoothstep(-0.36, 0.22, sl);
  vec3 col = mix(uSunsetCol * 0.75, uAtmoShellCol, smoothstep(-0.2, 0.18, sl)) * dayF;
  float mie = pow(max(dot(rd, L), 0.0), 8.0);
  col += uAtmoShellCol * mie * 1.6;
  col *= dens * uAtmoShellStr;
  col += uHiCol * dens * uHighlight * 0.5;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const RING_VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorldPos;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const RING_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uCenter;
uniform float uRadius;
uniform vec3 uRingNormal;
uniform float uRingIn;
uniform float uRingOut;
uniform vec3 uRingColA;
uniform vec3 uRingColB;
uniform float uScanMix;
varying vec3 vLocal;
varying vec3 vWorldPos;
${RING_DENSITY}
float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float n11(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
void main() {
  float r = length(vLocal.xz);
  float dens = ringDensity(r, uRingIn, uRingOut);
  float x = (r - uRingIn) / (uRingOut - uRingIn);
  dens *= 0.86 + 0.28 * n11(x * 60.0);
  if (dens < 0.004) discard;
  vec3 col = mix(uRingColA, uRingColB, smoothstep(0.25, 0.8, n11(x * 14.0 + 3.0)));
  col = mix(col, uRingColA * 1.12, smoothstep(0.6, 0.95, n11(x * 31.0 + 9.0)) * 0.5);
  col = mix(col, uRingColB * 0.7, smoothstep(0.7, 1.0, x) * 0.45);
  col *= 0.85 + 0.35 * dens;
  vec3 L = normalize(uSunDir);
  vec3 toC = uCenter - vWorldPos;
  float tca = dot(toC, L);
  float d2 = dot(toC, toC) - tca * tca;
  float R2 = uRadius * uRadius;
  // Planetshine keeps the shadowed arc faintly visible, so it reads as shadow rather than a gap.
  float sh = tca > 0.0 ? mix(0.1, 1.0, smoothstep(R2 * 0.9, R2 * 1.05, d2)) : 1.0;
  vec3 V = normalize(cameraPosition - vWorldPos);
  float sunSide = dot(uRingNormal, L);
  float camSide = dot(uRingNormal, V);
  float same = step(0.0, sunSide * camSide);
  float bright = mix(0.4, 1.0, same) * (0.35 + 0.65 * pow(abs(sunSide), 0.35));
  float fwd = pow(max(dot(-V, L), 0.0), 6.0) * (1.0 - same) * 1.4;
  vec3 c = col * uSunColor * (bright + fwd) * sh + col * 0.015;
  gl_FragColor = vec4(c, clamp(dens * 0.92, 0.0, 1.0) * (1.0 - uScanMix * 0.6));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const AURORA_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uAurA;
uniform vec3 uAurB;
uniform float uAurStr;
varying vec3 vObjPos;
varying vec3 vObjNormal;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
${NOISE}
void main() {
  vec3 p = normalize(vObjPos);
  float al = asin(clamp(abs(p.y), 0.0, 1.0));
  float hemi = sign(p.y);
  vec2 ring = normalize(p.xz + vec2(1e-5));
  float wob = snoise(vec3(ring * 1.6, uTime * 0.1 + hemi * 3.0)) * 0.07;
  float x = al - 1.12 + wob;
  float band = exp(-pow(x / 0.055, 2.0));
  float rays = 0.55 + 0.45 * sin(atan(ring.y, ring.x) * 40.0 + snoise(vec3(ring * 5.0, uTime * 0.25)) * 3.5 + uTime * 0.35);
  float curtain = smoothstep(-0.25, 0.6, snoise(vec3(ring * 2.2, uTime * 0.06 + hemi * 5.0)));
  float I = band * rays * (0.3 + 0.7 * curtain);
  vec3 col = mix(uAurA, uAurB, smoothstep(-0.02, 0.07, x));
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float night = 1.0 - smoothstep(-0.25, 0.45, dot(N, normalize(uSunDir)));
  float limb = 0.45 + 1.6 * pow(1.0 - abs(dot(N, V)), 2.0);
  gl_FragColor = vec4(col * I * (0.3 + 0.7 * night) * limb * uAurStr, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const STAR_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vObjPos;
varying vec3 vObjNormal;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
${NOISE}
void main() {
  vec3 p = normalize(vObjPos);
  float n = fbm(p * 5.0 + vec3(0.0, uTime * 0.04, 0.0), 5);
  float n2 = fbm(p * 18.0 - vec3(uTime * 0.06), 3);
  float g = clamp(0.55 + 0.45 * n + 0.2 * n2, 0.0, 1.0);
  vec3 col = mix(vec3(1.0, 0.34, 0.07), vec3(1.0, 0.86, 0.58), g);
  float mu = max(dot(normalize(vWorldNormal), normalize(cameraPosition - vWorldPos)), 0.0);
  col *= 0.5 + 0.5 * pow(mu, 0.5);
  col += vec3(1.0, 0.5, 0.2) * pow(1.0 - mu, 3.0) * 0.6;
  gl_FragColor = vec4(col * 1.7, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
${NOISE}
void main() {
  vec3 d = normalize(vDir);
  vec3 axis = normalize(vec3(0.32, 1.0, -0.45));
  float bc = dot(d, axis);
  float band = exp(-bc * bc / 0.07);
  float n1 = fbm(d * 1.7 + vec3(3.0), 6);
  float n2 = fbm(d * 3.4 + vec3(n1 * 1.8), 6);
  float n3 = fbm(d * 7.0 + 11.0, 5);
  vec3 c = vec3(0.0);
  c += vec3(0.17, 0.05, 0.3) * smoothstep(-0.25, 0.7, n2) * (0.22 + 1.2 * band);
  c += vec3(0.03, 0.13, 0.25) * smoothstep(-0.1, 0.8, n1) * (0.3 + 0.9 * band);
  c += vec3(0.5, 0.14, 0.1) * pow(smoothstep(0.1, 0.9, n2 * 0.5 + 0.5), 4.0) * band;
  c *= 1.0 - 0.78 * smoothstep(0.0, 0.45, n3) * band;
  c += vec3(0.85, 0.8, 1.0) * band * 0.018 * (0.6 + 0.4 * n1);
  gl_FragColor = vec4(c * 0.19, 1.0);
}
`;

export const STARS_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.78 + 0.22 * sin(uTime * (0.6 + aPhase * 2.2) + aPhase * 60.0);
  gl_PointSize = aSize * uPixelRatio;
  vColor = aColor * tw;
}
`;

export const STARS_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  float core = smoothstep(0.2, 0.0, d);
  gl_FragColor = vec4(vColor * (a * a * 0.55 + core * 0.9), 1.0);
  #include <colorspace_fragment>
}
`;

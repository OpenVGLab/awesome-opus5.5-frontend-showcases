import { TAU } from './util.js';

// Ocean swell: [kx, kz, cycles per loop, amplitude, phase]. Whole cycles per loop keep it seamless.
export const WAVES = [
  [0.85, 0.30, 8, 0.050, 0.0],
  [-0.35, 1.20, 11, 0.032, 1.3],
  [1.55, -0.80, 15, 0.020, 2.1],
  [2.40, 1.70, 21, 0.011, 0.7],
];

export function waveHeight(x, z, p) {
  let h = 0;
  for (const [kx, kz, n, a, ph] of WAVES) h += a * Math.sin(kx * x + kz * z - TAU * n * p + ph);
  return h;
}

const f = (v) => v.toFixed(5);

export const GLSL_WAVES = /* glsl */ `
float waveH(vec2 q, float p) {
  float h = 0.0;
${WAVES.map(([kx, kz, n, a, ph]) => `  h += ${f(a)} * sin(${f(kx)} * q.x + ${f(kz)} * q.y - ${f(TAU * n)} * p + ${f(ph)});`).join('\n')}
  return h;
}
vec2 waveG(vec2 q, float p) {
  vec2 g = vec2(0.0);
${WAVES.map(([kx, kz, n, a, ph]) => `  g += ${f(a)} * cos(${f(kx)} * q.x + ${f(kz)} * q.y - ${f(TAU * n)} * p + ${f(ph)}) * vec2(${f(kx)}, ${f(kz)});`).join('\n')}
  return g;
}
`;

export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Value noise that repeats along x every 'period' lattice cells, so scrolling it by whole
// periods over one loop returns exactly to the starting pattern.
float tnoise(vec2 p, float period) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float i0 = mod(i.x, period), i1 = mod(i.x + 1.0, period);
  float a = hash12(vec2(i0, i.y)), b = hash12(vec2(i1, i.y));
  float c = hash12(vec2(i0, i.y + 1.0)), d = hash12(vec2(i1, i.y + 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
`;

// Scroll offset that advances by exactly `periods * length` per loop while its speed swells
// around phase p0 (so rivers can run faster after the rain without breaking the loop).
export function loopScroll(p, periods, length, swell, p0) {
  return length * (periods * p + (swell / TAU) * Math.sin(TAU * (p - p0)));
}

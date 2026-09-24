import * as THREE from 'three';
import { X0, Z0, Z1, NX, NZ, DX, DZ } from './terrain.js';
import { GLSL_NOISE, GLSL_WAVES, loopScroll } from './glsl.js';
import { smoothstep, win } from './util.js';

const OCEAN_X1 = -0.4;
const STRIDE = NX + 1;

const SURFACE_VS = /* glsl */ `
uniform float uP;
uniform float uAmp;
attribute float aDepth;
varying float vDepth;
varying vec3 vWPos;
varying vec3 vN;
${GLSL_WAVES}
void main() {
  vec3 pos = position;
  float a = uAmp * smoothstep(0.0, 0.9, aDepth);
  pos.y += waveH(pos.xz, uP) * a;
  vec2 g = waveG(pos.xz, uP) * a;
  vN = normalize(vec3(-g.x, 1.0, -g.y));
  vDepth = aDepth;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SURFACE_FS = /* glsl */ `
uniform float uP;
uniform vec3 uSunDir;
uniform float uSun;
uniform vec3 uSkyH;
uniform vec3 uSkyT;
uniform float uFlash;
uniform float uStorm;
varying float vDepth;
varying vec3 vWPos;
varying vec3 vN;
${GLSL_NOISE}
${GLSL_WAVES}
void main() {
  if (vDepth < -0.05) discard;
  vec3 V = normalize(cameraPosition - vWPos);
  vec2 cyc = vec2(cos(6.2831853 * uP * 3.0), sin(6.2831853 * uP * 3.0)) * 0.9;
  vec2 q = vWPos.xz * 2.2 + cyc;
  float e = 0.08;
  float r0 = vnoise(q), rx = vnoise(q + vec2(e, 0.0)), rz = vnoise(q + vec2(0.0, e));
  vec2 q2 = vWPos.xz * 5.5 - cyc * 1.7;
  float s0 = vnoise(q2), sx = vnoise(q2 + vec2(e, 0.0)), sz = vnoise(q2 + vec2(0.0, e));
  float rough = 1.2 + 1.6 * uStorm;
  vec3 N = normalize(vN + vec3((r0 - rx) + 0.5 * (s0 - sx), 0.0, (r0 - rz) + 0.5 * (s0 - sz)) * rough);
  float ndv = max(dot(N, V), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
  float dep = vDepth;
  vec3 shallow = pow(vec3(0.36, 0.86, 0.84), vec3(2.2));
  vec3 mid = pow(vec3(0.10, 0.62, 0.78), vec3(2.2));
  vec3 deep = pow(vec3(0.03, 0.32, 0.58), vec3(2.2));
  vec3 col = mix(shallow, mid, smoothstep(0.0, 0.8, dep));
  col = mix(col, deep, smoothstep(0.6, 2.8, dep));
  float ndl = max(dot(N, uSunDir), 0.0);
  col *= (0.62 + 0.55 * ndl) * (0.5 + 0.5 * uSun);
  vec3 refl = mix(uSkyH, uSkyT, 0.35);
  col = mix(col, refl, fres * 0.75);
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 260.0) * 2.2 * uSun;
  col += vec3(1.0, 0.95, 0.85) * spec;
  float fn = vnoise(vWPos.xz * 5.0 + cyc * 1.5);
  float band = sin(dep * 26.0 + 6.2831853 * uP * 10.0 + fn * 3.0) * 0.5 + 0.5;
  float foam = (1.0 - smoothstep(0.02, 0.24, dep + (fn - 0.5) * 0.1)) * (0.5 + 0.5 * band);
  float crest = smoothstep(0.06, 0.1, waveH(vWPos.xz, uP));
  float caps = smoothstep(0.7, 0.86, vnoise(vWPos.xz * 9.0 - cyc * 2.0)) * crest * uStorm * 0.35;
  foam = max(foam, caps);
  col = mix(col, col * vec3(0.8, 0.86, 0.9), uStorm * 0.5);
  col = mix(col, vec3(0.95, 0.98, 1.0), foam * 0.85);
  col += uFlash * 0.2;
  float alpha = mix(0.66, 0.94, smoothstep(0.0, 1.5, dep));
  alpha = max(alpha, foam * 0.9) * smoothstep(-0.05, 0.02, dep);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SIDE_VS = /* glsl */ `
uniform float uP;
uniform float uAmp;
attribute float aTop;
attribute float aDepth;
varying vec3 vWPos;
varying float vSurf;
${GLSL_WAVES}
void main() {
  vec3 pos = position;
  float wh = waveH(pos.xz, uP) * uAmp * smoothstep(0.0, 0.9, aDepth);
  pos.y += wh * aTop;
  vSurf = wh;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SIDE_FS = /* glsl */ `
uniform float uP;
uniform float uSun;
uniform float uFlash;
varying vec3 vWPos;
varying float vSurf;
${GLSL_NOISE}
void main() {
  float d = max(vSurf - vWPos.y, 0.0);
  float t = clamp(d / 3.2, 0.0, 1.0);
  vec3 top = pow(vec3(0.30, 0.78, 0.88), vec3(2.2));
  vec3 bot = pow(vec3(0.04, 0.22, 0.46), vec3(2.2));
  vec3 col = mix(top, bot, pow(t, 0.7));
  float coord = vWPos.x - vWPos.z;
  vec2 cyc = vec2(cos(6.2831853 * uP * 2.0), sin(6.2831853 * uP * 2.0));
  float sh = vnoise(vec2(coord * 1.3 + d * 0.5 + cyc.x * 0.7, cyc.y * 0.7));
  sh = pow(smoothstep(0.4, 1.0, sh), 2.0) * (1.0 - smoothstep(0.0, 2.4, d));
  col += pow(vec3(0.6, 0.9, 0.95), vec3(2.2)) * sh * 0.45 * uSun;
  float lip = 1.0 - smoothstep(0.0, 0.05, d);
  col = mix(col, vec3(0.75, 0.93, 1.0), lip * 0.7);
  col *= 0.62 + 0.38 * uSun;
  col += uFlash * 0.12;
  gl_FragColor = vec4(col, mix(0.7, 0.93, t));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const RIBBON_VS = /* glsl */ `
attribute vec3 aCenter;
attribute vec3 aSide;
attribute float aHalfW;
attribute vec2 aUV;
uniform float uWiden;
uniform float uRise;
varying vec2 vUV;
void main() {
  vec3 p = aCenter + aSide * aHalfW * (1.0 + uWiden) * aUV.y;
  p.y += uRise;
  vUV = aUV;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}`;

const RIBBON_FS = /* glsl */ `
uniform float uOff;
uniform float uEnd;
uniform float uSun;
uniform float uFlow;
uniform float uFill;
uniform float uDry;
uniform float uOpacity;
uniform float uFlash;
varying vec2 vUV;
${GLSL_NOISE}
void main() {
  float across = abs(vUV.y);
  float s = vUV.x - uOff;
  float n1 = tnoise(vec2(s * 3.0, vUV.y * 1.2 + 5.0), 12.0);
  float n2 = tnoise(vec2(s * 7.0 + 3.0, vUV.y * 2.6), 28.0);
  vec3 deep = pow(vec3(0.12, 0.55, 0.75), vec3(2.2));
  vec3 light = pow(vec3(0.46, 0.85, 0.94), vec3(2.2));
  vec3 col = mix(deep, light, clamp(0.3 + 0.45 * n1 - 0.3 * across, 0.0, 1.0));
  float streak = smoothstep(0.64, 0.9, n2) * (0.4 + 0.45 * uFlow);
  col = mix(col, vec3(0.92, 0.97, 1.0), streak * 0.55);
  col *= 0.6 + 0.4 * uSun;
  col += vec3(1.0, 0.95, 0.85) * pow(n2, 10.0) * 2.5 * uSun;
  col += uFlash * 0.15;
  float a = (1.0 - smoothstep(0.7, 1.0, across)) * uOpacity;
  a *= smoothstep(0.0, 0.3, vUV.x) * (1.0 - smoothstep(uEnd - 0.9, uEnd, vUV.x));
  a *= smoothstep(uDry, uDry + 0.3, vUV.x) * (1.0 - smoothstep(uFill - 0.3, uFill, vUV.x));
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a * 0.94);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const LAKE_VS = /* glsl */ `
varying vec2 vL;
void main() {
  vL = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const LAKE_FS = /* glsl */ `
uniform float uP;
uniform float uSun;
uniform float uRain;
uniform float uFlash;
varying vec2 vL;
${GLSL_NOISE}
void main() {
  float r = length(vL);
  vec2 cyc = vec2(cos(6.2831853 * uP * 2.0), sin(6.2831853 * uP * 2.0));
  float n = vnoise(vL * 6.0 + cyc * 0.8);
  vec3 deep = pow(vec3(0.08, 0.40, 0.60), vec3(2.2));
  vec3 shallow = pow(vec3(0.34, 0.74, 0.80), vec3(2.2));
  vec3 col = mix(deep, shallow, smoothstep(0.3, 1.0, r) * 0.8 + n * 0.2);
  vec2 cell = floor(vL * 5.0);
  vec2 f = fract(vL * 5.0) - 0.5;
  float ph = fract(uP * 40.0 + hash12(cell));
  float ring = (1.0 - smoothstep(0.0, 0.06, abs(length(f) - ph * 0.45))) * (1.0 - ph) * uRain;
  col *= 0.6 + 0.4 * uSun;
  col += pow(n, 9.0) * 2.0 * uSun + ring * 0.25 + uFlash * 0.15;
  float a = (1.0 - smoothstep(0.93, 1.0, r)) * 0.9;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function ribbonGeometry(pts) {
  const n = pts.length;
  const center = new Float32Array(n * 6), side = new Float32Array(n * 6), hw = new Float32Array(n * 2);
  const uv = new Float32Array(n * 4), pos = new Float32Array(n * 6);
  let s = 0;
  for (let k = 0; k < n; k++) {
    const a = pts[Math.max(k - 1, 0)], b = pts[Math.min(k + 1, n - 1)];
    let tx = b.x - a.x, tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const sx = -tz, sz = tx;
    if (k > 0) s += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
    for (let e = 0; e < 2; e++) {
      const vi = k * 2 + e, sign = e === 0 ? -1 : 1;
      center.set([pts[k].x, pts[k].y, pts[k].z], vi * 3);
      side.set([sx, 0, sz], vi * 3);
      hw[vi] = pts[k].hw;
      uv[vi * 2] = s;
      uv[vi * 2 + 1] = sign;
      pos.set([pts[k].x + sx * pts[k].hw * sign, pts[k].y, pts[k].z + sz * pts[k].hw * sign], vi * 3);
    }
  }
  const idx = [];
  for (let k = 0; k < n - 1; k++) {
    const a = k * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 3));
  geo.setAttribute('aHalfW', new THREE.BufferAttribute(hw, 1));
  geo.setAttribute('aUV', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return { geo, length: s };
}

export function createWater(terrain, U) {
  const group = new THREE.Group();

  // ---- ocean surface
  const w = OCEAN_X1 - X0;
  const geo = new THREE.PlaneGeometry(w, Z1 - Z0 - 0.004, 110, 144);
  geo.rotateX(-Math.PI / 2);
  geo.translate(X0 + w / 2, 0, 0);
  const pos = geo.attributes.position;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) depth[i] = -terrain.heightAt(pos.getX(i), pos.getZ(i));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  const storm = { value: 0 };
  const surface = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: {
      uP: U.uP, uAmp: U.uAmp, uSunDir: U.uSunDir, uSun: U.uSun, uSkyH: U.uSkyH, uSkyT: U.uSkyT, uFlash: U.uFlash, uStorm: storm,
    },
    vertexShader: SURFACE_VS,
    fragmentShader: SURFACE_FS,
    transparent: true,
  }));
  surface.renderOrder = 1;
  group.add(surface);

  // ---- the water column where the diorama is cut open
  const P = [], TOP = [], DEP = [], I = [];
  const H = (i, j) => terrain.h[j * STRIDE + i];
  const side = (list, flip) => {
    const base = P.length / 3;
    for (const [x, z, hh] of list) {
      const b = Math.min(hh, 0);
      P.push(x, 0, z, x, b, z);
      TOP.push(1, 0);
      DEP.push(Math.max(-hh, 0), Math.max(-hh, 0));
    }
    for (let k = 0; k < list.length - 1; k++) {
      const a = base + 2 * k, b = a + 1, c = a + 2, d = a + 3;
      if (!flip) I.push(a, b, c, b, d, c); else I.push(a, c, b, b, c, d);
    }
  };
  const iMax = Math.ceil((OCEAN_X1 - X0) / DX);
  const front = [], back = [], left = [];
  for (let i = 0; i <= iMax; i++) {
    const x = X0 + i * DX;
    front.push([x, Z1, H(i, NZ)]);
    back.push([x, Z0, H(i, 0)]);
  }
  for (let j = 0; j <= NZ; j++) left.push([X0, Z0 + j * DZ, H(0, j)]);
  side(front, false);
  side(back, true);
  side(left, false);
  const sideGeo = new THREE.BufferGeometry();
  sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  sideGeo.setAttribute('aTop', new THREE.Float32BufferAttribute(TOP, 1));
  sideGeo.setAttribute('aDepth', new THREE.Float32BufferAttribute(DEP, 1));
  sideGeo.setIndex(I);
  const sides = new THREE.Mesh(sideGeo, new THREE.ShaderMaterial({
    uniforms: { uP: U.uP, uAmp: U.uAmp, uSun: U.uSun, uFlash: U.uFlash },
    vertexShader: SIDE_VS,
    fragmentShader: SIDE_FS,
    transparent: true,
    depthWrite: false,
  }));
  sides.renderOrder = 2;
  group.add(sides);

  // ---- river
  const R = terrain.river;
  const rpts = [];
  for (let k = 0; k < R.N; k++) rpts.push({ x: R.px[k], y: R.y[k] + 0.012, z: R.pz[k], hw: R.r[k] });
  const river = ribbonGeometry(rpts);
  const riverU = {
    uOff: { value: 0 }, uEnd: { value: river.length }, uSun: U.uSun, uFlow: { value: 0 }, uFill: { value: 1e4 }, uDry: { value: -10 },
    uOpacity: { value: 1 }, uWiden: { value: 0 }, uRise: { value: 0 }, uFlash: U.uFlash,
  };
  const riverMesh = new THREE.Mesh(river.geo, new THREE.ShaderMaterial({
    uniforms: riverU, vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS, transparent: true, depthWrite: false,
  }));
  riverMesh.renderOrder = 3;
  group.add(riverMesh);

  // ---- runoff streams: they only run while (and just after) it rains
  const streamU = {
    uOff: { value: 0 }, uEnd: { value: 1e4 }, uSun: U.uSun, uFlow: { value: 1 }, uFill: { value: 0 }, uDry: { value: 0 },
    uOpacity: { value: 0.95 }, uWiden: { value: 0 }, uRise: { value: 0 }, uFlash: U.uFlash,
  };
  const streamMat = new THREE.ShaderMaterial({
    uniforms: streamU, vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  let maxStream = 0;
  for (const st of terrain.streams) {
    const n = st.pts.length;
    const pts = st.pts.map((p, i) => ({ x: p[0], y: p[1] + 0.03, z: p[2], hw: 0.03 + 0.035 * (i / (n - 1)) }));
    const g = ribbonGeometry(pts);
    maxStream = Math.max(maxStream, g.length);
    const m = new THREE.Mesh(g.geo, streamMat);
    m.renderOrder = 3;
    group.add(m);
  }

  // ---- lake
  const L = terrain.lake;
  const lakeGeo = new THREE.CircleGeometry(1, 64);
  const lakeU = { uP: U.uP, uSun: U.uSun, uRain: { value: 0 }, uFlash: U.uFlash };
  const lake = new THREE.Mesh(lakeGeo, new THREE.ShaderMaterial({
    uniforms: lakeU, vertexShader: LAKE_VS, fragmentShader: LAKE_FS, transparent: true, depthWrite: false,
  }));
  lake.scale.set(L.rx * 1.06, L.rz * 1.06, 1);
  lake.rotation.set(-Math.PI / 2, 0, -L.rot, 'YXZ');
  lake.position.set(L.x, L.level + 0.01, L.z);
  lake.renderOrder = 3;
  group.add(lake);

  function update(p, env) {
    storm.value = env.storm;
    riverU.uFlow.value = env.flow;
    riverU.uWiden.value = 0.4 * env.flow;
    riverU.uRise.value = 0.02 * env.flow;
    riverU.uOff.value = loopScroll(p, 6, 4, 3.5, 0.72);
    streamU.uOff.value = loopScroll(p, 16, 4, 0, 0);
    // the wet front runs downhill as the rain starts, and dries from the top afterwards
    streamU.uFill.value = 0.3 + (maxStream + 0.6) * smoothstep(0.495, 0.60, p < 0.2 ? p + 1 : p);
    streamU.uDry.value = -0.4 + (maxStream + 0.8) * smoothstep(0.80, 0.97, p < 0.2 ? p + 1 : p);
    streamU.uOpacity.value = 0.95 * win(p, 0.49, 0.99, 0.01, 0.02);
    lakeU.uRain.value = env.rain;
  }

  return { group, update };
}

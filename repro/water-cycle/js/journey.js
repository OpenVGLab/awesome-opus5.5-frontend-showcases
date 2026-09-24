import * as THREE from 'three';
import { lerp, smoothstep, cumulative, samplePolyline, TAU } from './util.js';
import { waveHeight } from './glsl.js';

// One glowing drop makes the whole trip every loop: sea -> vapour -> cloud -> rain -> stream ->
// lake and river -> sea. Its path is closed, so its end is exactly its beginning.
export const LEGS = { evap: 0.235, cloud: 0.47, fall: 0.525, stream: 0.63, river: 0.93 };

const VS = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
  vAlpha = aAlpha;
  vColor = aColor;
}`;

const FS = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.12, 0.26, r);
  float halo = exp(-r * r * 7.0) * 0.55 + exp(-r * 3.5) * 0.15;
  float a = (core + halo) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.7) * a, a);
  #include <colorspace_fragment>
}`;

const COLORS = [
  new THREE.Color(0.85, 0.95, 1.0),
  new THREE.Color(1.0, 1.0, 1.0),
  new THREE.Color(0.45, 0.78, 1.0),
  new THREE.Color(0.3, 0.95, 1.0),
];

export function createJourney(terrain, clouds, U) {
  const O = new THREE.Vector3(-6.3, 0.02, 1.6);
  const stream = terrain.heroStream;
  const spts = stream.pts.map((p) => [p[0], p[1] + 0.06, p[2]]);
  const scum = cumulative(spts);
  const R = terrain.river;
  const rpts = [];
  const end = Math.min(R.mouth + 12, R.N - 1);
  for (let k = stream.joinK; k <= end; k++) rpts.push([R.px[k], R.y[k] + 0.05, R.pz[k]]);
  if (rpts.length < 2) rpts.push([R.px[R.N - 1], 0.05, R.pz[R.N - 1]]);
  const rcum = cumulative(rpts);
  const mouth = new THREE.Vector3(...rpts[rpts.length - 1]);
  const ctrl = new THREE.Vector3((mouth.x + O.x) / 2 + 0.3, 0, Math.max(mouth.z, O.z) + 1.2);
  const L = new THREE.Vector3(...spts[0]);

  const cloudAt = (p, out) => {
    const st = clouds.stateAt(0, p);
    return out.set(st.x, st.y, st.z);
  };
  const evapEnd = cloudAt(LEGS.evap, new THREE.Vector3()).add(new THREE.Vector3(0.1, -0.1, 0));
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const b1 = new THREE.Vector3(), b2 = new THREE.Vector3();

  function at(p, out) {
    let mode = 0;
    if (p < LEGS.evap) {
      const f = p / LEGS.evap;
      const e = f * f * (3 - 2 * f);
      b1.copy(O).add(tmp.set(0.4, 1.6, -0.1));
      b2.copy(evapEnd).add(tmp.set(-0.8, -1.8, 0.2));
      const u = 1 - e;
      out.copy(O).multiplyScalar(u * u * u)
        .addScaledVector(b1, 3 * u * u * e)
        .addScaledVector(b2, 3 * u * e * e)
        .addScaledVector(evapEnd, e * e * e);
      const w = Math.sin(Math.PI * f);
      out.x += 0.3 * w * Math.sin(TAU * f * 2);
      out.z += 0.25 * w * Math.cos(TAU * f * 1.5);
      mode = 0;
    } else if (p < LEGS.cloud) {
      const f = (p - LEGS.evap) / (LEGS.cloud - LEGS.evap);
      cloudAt(p, out);
      const w = Math.sin(Math.PI * f);
      out.x += 0.1 + 0.35 * w * Math.cos(TAU * f * 1.5) + 0.1 * f;
      out.y += -0.1 - 0.3 * f + 0.12 * w * Math.sin(TAU * f * 2);
      out.z += 0.25 * w * Math.sin(TAU * f * 1.5) - 0.15 * f;
      mode = 1;
    } else if (p < LEGS.fall) {
      const f = (p - LEGS.cloud) / (LEGS.fall - LEGS.cloud);
      at(LEGS.cloud - 1e-6, tmp2);
      out.set(lerp(tmp2.x, L.x, f), lerp(tmp2.y, L.y, f * f), lerp(tmp2.z, L.z, f));
      mode = 2;
    } else if (p < LEGS.stream) {
      const f = (p - LEGS.fall) / (LEGS.stream - LEGS.fall);
      samplePolyline(spts, scum, Math.pow(f, 1.15), out);
      mode = 3;
    } else if (p < LEGS.river) {
      const f = (p - LEGS.stream) / (LEGS.river - LEGS.stream);
      samplePolyline(rpts, rcum, f, out);
      mode = 3;
    } else {
      const f = (p - LEGS.river) / (1 - LEGS.river);
      const u = 1 - f;
      out.set(u * u * mouth.x + 2 * u * f * ctrl.x + f * f * O.x, 0, u * u * mouth.z + 2 * u * f * ctrl.z + f * f * O.z);
      out.y = Math.max(0.02, waveHeight(out.x, out.z, p) * smoothstep(0.1, 0.6, -terrain.heightAt(out.x, out.z)) + 0.03);
      if (f > 0.9) out.y = lerp(out.y, O.y, (f - 0.9) / 0.1);
      mode = 3;
    }
    return mode;
  }

  const TRAIL = 30, STEP = 0.0024;
  const n = TRAIL + 1;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), color = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: U.uScale },
    vertexShader: VS, fragmentShader: FS,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 20;

  const v = new THREE.Vector3(), c = new THREE.Color();
  const head = new THREE.Vector3();
  let mode = 0;
  function update(p) {
    for (let j = TRAIL; j >= 0; j--) {
      const q = p - j * STEP;
      const pp = q - Math.floor(q);
      const m = at(pp, v);
      pos[j * 3] = v.x; pos[j * 3 + 1] = v.y; pos[j * 3 + 2] = v.z;
      const k = j / TRAIL;
      c.copy(COLORS[m]);
      color[j * 3] = c.r; color[j * 3 + 1] = c.g; color[j * 3 + 2] = c.b;
      if (j === 0) {
        size[0] = m === 1 ? 0.8 : 0.66;
        alpha[0] = m === 1 ? 0.8 : 1;
        head.copy(v);
        mode = m;
      } else {
        size[j] = lerp(0.2, 0.05, k);
        alpha[j] = 0.32 * Math.pow(1 - k, 1.6) * (m === 1 ? 0.35 : 1);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
  }

  return { object: points, update, at, head: () => head, mode: () => mode, landing: L };
}

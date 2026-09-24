import * as THREE from 'three';
import { TAU, lerp, smoothstep, wrap01, win, mulberry32 } from './util.js';

// Each cloud lives inside the loop: it condenses (puffs appear one by one), drifts on the wind,
// may rain, then shrinks away. Clouds with born > die live across the loop point.
const DEFS = [
  { born: 0.10, die: 0.86, grow: 0.15, fade: 0.14, from: [-5.4, 5.3, 1.0], to: [4.9, 7.1, 0.3], move: [0.24, 0.50], size: 1.12, puffs: 15, rain: [0.47, 0.72], seed: 11 },
  { born: 0.14, die: 0.88, grow: 0.16, fade: 0.14, from: [-3.6, 5.8, -2.7], to: [6.9, 7.8, -2.3], move: [0.26, 0.52], size: 1.32, puffs: 17, rain: [0.49, 0.72], snow: true, seed: 23 },
  { born: 0.18, die: 0.84, grow: 0.15, fade: 0.14, from: [-7.4, 5.0, 3.5], to: [2.4, 6.4, 3.3], move: [0.28, 0.53], size: 1.0, puffs: 13, rain: [0.50, 0.70], seed: 37 },
  { born: 0.70, die: 0.30, grow: 0.12, fade: 0.12, from: [-8.6, 6.3, -4.4], to: [-2.6, 6.9, -4.9], move: [0.70, 0.30], size: 0.62, puffs: 8, seed: 41 },
  { born: 0.80, die: 0.42, grow: 0.12, fade: 0.14, from: [0.6, 7.2, -5.1], to: [6.8, 7.7, -5.4], move: [0.80, 0.42], size: 0.56, puffs: 7, seed: 53 },
  { born: 0.86, die: 0.22, grow: 0.10, fade: 0.10, from: [-9.4, 5.5, 5.0], to: [-6.6, 5.7, 5.3], move: [0.86, 0.22], size: 0.45, puffs: 6, seed: 67 },
];

function makePuffs(count, seed) {
  const rng = mulberry32(seed);
  const puffs = [];
  const nb = Math.round(count * 0.5);
  for (let i = 0; i < nb; i++) {
    const t = nb === 1 ? 0.5 : i / (nb - 1);
    const edge = Math.abs(t - 0.5) * 2;
    puffs.push({
      x: (t - 0.5) * 3.0 + (rng() - 0.5) * 0.35, y: 0, z: (rng() - 0.5) * 1.2,
      r: (0.58 + rng() * 0.25) * (1 - 0.35 * edge), sx: 1.15, sy: 0.72, sz: 1.0,
      delay: edge * 0.45 + rng() * 0.15,
    });
  }
  for (let i = nb; i < count; i++) {
    const x = (rng() - 0.5) * 2.0;
    puffs.push({
      x, y: 0.32 + rng() * 0.42, z: (rng() - 0.5) * 0.8,
      r: (0.55 + rng() * 0.35) * (1 - 0.3 * Math.abs(x)), sx: 1.0, sy: 0.92, sz: 1.0,
      delay: 0.25 + rng() * 0.45,
    });
  }
  puffs.push({ x: (rng() - 0.5) * 0.5, y: 0.85, z: 0, r: 0.62, sx: 1, sy: 0.95, sz: 1, delay: 0.55 });
  for (const p of puffs) {
    p.n = 2 + Math.floor(rng() * 2);
    p.ph = rng();
    p.yn = p.y / 0.85;
  }
  return puffs;
}

export function createClouds(heroLanding) {
  const defs = DEFS.map((d, i) => {
    const life = wrap01(d.die - d.born) || 1;
    const to = i === 0 ? [heroLanding[0] - 0.25, 7.1, heroLanding[2] + 0.15] : d.to;
    return {
      ...d, to, life,
      gU: d.grow / life, fU: d.fade / life,
      mu0: wrap01(d.move[0] - d.born) / life, mu1: (wrap01(d.move[1] - d.born) || 1) / life,
      puffList: makePuffs(d.puffs, d.seed),
    };
  });
  const total = defs.reduce((s, d) => s + d.puffList.length, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const lift = { value: 1 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLift = lift;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLift;')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
float rimC = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.0);
reflectedLight.indirectDiffuse += diffuseColor.rgb * (0.2 + 0.45 * rimC) * uLift;`);
  };
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), mat, total);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const white = new THREE.Color(1, 1, 1), grey = new THREE.Color('#7d8795'), col = new THREE.Color();
  for (let i = 0; i < total; i++) mesh.setColorAt(i, white);

  function stateAt(i, p, out = {}) {
    const d = defs[i];
    const u = wrap01(p - d.born) / d.life;
    out.alive = u < 1;
    out.u = u;
    const mv = smoothstep(d.mu0, d.mu1, u);
    out.x = lerp(d.from[0], d.to[0], mv);
    out.y = lerp(d.from[1], d.to[1], mv) + 0.07 * Math.sin(TAU * (p * 2 + d.seed * 0.1));
    out.z = lerp(d.from[2], d.to[2], mv) + 0.1 * Math.sin(TAU * (p + d.seed * 0.37));
    out.scale = out.alive ? smoothstep(0, d.gU, u) * (1 - smoothstep(1 - d.fU, 1, u)) : 0;
    out.size = d.size;
    out.base = out.y - 0.35 * d.size;
    return out;
  }
  const rainAt = (i, p) => (defs[i].rain ? win(p, defs[i].rain[0], defs[i].rain[1], 0.03, 0.06) : 0);

  const states = defs.map(() => ({}));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();

  function update(p, env) {
    let idx = 0;
    defs.forEach((d, ci) => {
      const st = stateAt(ci, p, states[ci]);
      const dark = d.rain ? win(p, d.rain[0] - 0.08, d.rain[1] + 0.02, 0.08, 0.08) : 0.3 * env.storm;
      for (const pf of d.puffList) {
        let sc = 0;
        if (st.alive) {
          const g = smoothstep(pf.delay * d.gU, pf.delay * d.gU + 0.55 * d.gU, st.u);
          const k = 1 - d.fU + (1 - pf.delay) * 0.45 * d.fU;
          const dd = 1 - smoothstep(k, k + 0.55 * d.fU, st.u);
          sc = g * dd * (1 + 0.05 * Math.sin(TAU * (p * pf.n + pf.ph)));
        }
        const r = pf.r * d.size * sc;
        v.set(st.x + pf.x * d.size, st.y + pf.y * d.size, st.z + pf.z * d.size);
        s.set(r * pf.sx, r * pf.sy, r * pf.sz);
        m4.compose(v, q, s);
        mesh.setMatrixAt(idx, m4);
        col.copy(white).lerp(grey, dark * (0.5 + 0.5 * (1 - pf.yn)));
        mesh.setColorAt(idx, col);
        idx++;
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    lift.value = 0.7 + 0.3 * env.sun;
    mat.emissive.setRGB(0.55, 0.6, 0.8).multiplyScalar(0.7 * env.flash);
  }

  return { mesh, defs, states, stateAt, rainAt, update };
}

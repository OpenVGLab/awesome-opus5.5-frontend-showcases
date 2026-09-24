import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { X0, X1, Z0, Z1 } from './terrain.js';
import { TAU, mulberry32, fbm, lerp } from './util.js';

function prism(w, h, d) {
  const hw = w / 2, hd = d / 2;
  const v = [
    [-hw, 0, -hd], [-hw, 0, hd], [-hw, h, 0],
    [hw, 0, -hd], [hw, 0, hd], [hw, h, 0],
  ];
  const tris = [[0, 1, 2], [3, 5, 4], [0, 2, 5], [0, 5, 3], [1, 4, 5], [1, 5, 2], [0, 3, 4], [0, 4, 1]];
  const pos = [];
  for (const t of tris) for (const i of t) pos.push(...v[i]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createFlora(terrain) {
  const rng = mulberry32(7);
  const group = new THREE.Group();
  const nearStream = (x, z, r) => terrain.streams.some((s) => s.pts.some((p) => Math.abs(p[0] - x) < r && Math.abs(p[2] - z) < r));

  // A small village on the lower river.
  const houses = [];
  const R = terrain.river;
  for (let k = Math.floor(R.N * 0.55); k < R.mouth - 10 && houses.length < 7; k += 9) {
    const side = houses.length % 2 === 0 ? 1 : -1;
    const tx = R.px[Math.min(k + 1, R.N - 1)] - R.px[k - 1], tz = R.pz[Math.min(k + 1, R.N - 1)] - R.pz[k - 1];
    const tl = Math.hypot(tx, tz) || 1;
    const off = R.r[k] + 0.4 + rng() * 0.35;
    const x = R.px[k] - (tz / tl) * off * side, z = R.pz[k] + (tx / tl) * off * side;
    const h = terrain.heightAt(x, z);
    if (h < 0.28 || h > 1.2 || terrain.slopeAt(x, z) > 0.1) continue;
    if (houses.some((o) => Math.hypot(o.x - x, o.z - z) < 0.55)) continue;
    houses.push({ x, z, h, rot: Math.atan2(tx, tz) + (rng() - 0.5) * 0.5, s: 0.85 + rng() * 0.35 });
  }

  const trees = [];
  for (let t = 0; t < 9000 && trees.length < 300; t++) {
    const x = lerp(X0 + 0.25, X1 - 0.25, rng()), z = lerp(Z0 + 0.25, Z1 - 0.25, rng());
    const h = terrain.heightAt(x, z);
    if (h < 0.34 || h > 3.1) continue;
    if (terrain.slopeAt(x, z) > 0.3) continue;
    if (terrain.riverDistAt(x, z) < 0.5 || terrain.lakeDist(x, z) < 1.3) continue;
    const dens = fbm(x * 0.42 + 20, z * 0.42 - 5, 3);
    if (dens < (h > 1.3 ? -0.25 : 0.02)) continue;
    if (trees.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 0.075)) continue;
    if (houses.some((o) => Math.hypot(o.x - x, o.z - z) < 0.4)) continue;
    if (nearStream(x, z, 0.16)) continue;
    const pine = h > 1.15 + rng() * 0.5;
    trees.push({ x, z, h, pine, s: 0.75 + rng() * 0.55, ph: rng(), n: 5 + Math.floor(rng() * 3), hue: rng() });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.022, 0.034, 0.24, 6);
  trunkGeo.translate(0, 0.12, 0);
  const roundGeo = new THREE.IcosahedronGeometry(0.2, 1);
  roundGeo.scale(1, 1.08, 1);
  roundGeo.translate(0, 0.36, 0);
  const pineA = new THREE.ConeGeometry(0.17, 0.42, 7);
  pineA.translate(0, 0.36, 0);
  const pineB = new THREE.ConeGeometry(0.12, 0.3, 7);
  pineB.translate(0, 0.58, 0);
  const pineGeo = mergeGeometries([pineA, pineB]);

  const leafMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85, metalness: 0 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a3f', roughness: 0.9, metalness: 0 });
  const rounds = trees.filter((t) => !t.pine), pines = trees.filter((t) => t.pine);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const roundMesh = new THREE.InstancedMesh(roundGeo, leafMat, Math.max(rounds.length, 1));
  const pineMesh = new THREE.InstancedMesh(pineGeo, leafMat, Math.max(pines.length, 1));
  roundMesh.count = rounds.length;
  pineMesh.count = pines.length;
  const cA = new THREE.Color('#5aa845'), cB = new THREE.Color('#3f8c3a'), cC = new THREE.Color('#86b94e');
  const pA = new THREE.Color('#2f6e3d'), pB = new THREE.Color('#3f8048');
  const col = new THREE.Color();
  rounds.forEach((t, i) => {
    col.copy(cA).lerp(t.hue < 0.5 ? cB : cC, Math.abs(t.hue - 0.5) * 2);
    roundMesh.setColorAt(i, col);
  });
  pines.forEach((t, i) => { pineMesh.setColorAt(i, col.copy(pA).lerp(pB, t.hue)); });
  for (const m of [trunkMesh, roundMesh, pineMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    group.add(m);
  }

  // houses
  const bodyGeo = new THREE.BoxGeometry(0.24, 0.15, 0.18);
  bodyGeo.translate(0, 0.075, 0);
  const roofGeo = prism(0.28, 0.11, 0.22);
  roofGeo.translate(0, 0.15, 0);
  const bodyMesh = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.8 }), Math.max(houses.length, 1));
  const roofMesh = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: '#c9573f', roughness: 0.7, flatShading: true }), Math.max(houses.length, 1));
  bodyMesh.count = roofMesh.count = houses.length;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  houses.forEach((hs, i) => {
    q.setFromEuler(e.set(0, hs.rot, 0));
    m4.compose(v.set(hs.x, hs.h - 0.02, hs.z), q, sc.setScalar(hs.s));
    bodyMesh.setMatrixAt(i, m4);
    roofMesh.setMatrixAt(i, m4);
  });
  for (const m of [bodyMesh, roofMesh]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }

  function update(p, env) {
    const sway = 0.025 + 0.07 * env.wind;
    let ri = 0, pi = 0;
    trees.forEach((t, i) => {
      const a = sway * Math.sin(TAU * (p * t.n + t.ph));
      q.setFromEuler(e.set(a * 0.5, 0, -Math.abs(a) - 0.4 * a));
      m4.compose(v.set(t.x, t.h - 0.02, t.z), q, sc.setScalar(t.s));
      trunkMesh.setMatrixAt(i, m4);
      if (t.pine) pineMesh.setMatrixAt(pi++, m4); else roundMesh.setMatrixAt(ri++, m4);
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    roundMesh.instanceMatrix.needsUpdate = true;
    pineMesh.instanceMatrix.needsUpdate = true;
  }

  const canopies = trees.map((t) => ({ x: t.x, y: t.h + (t.pine ? 0.7 : 0.55) * t.s, z: t.z }));
  return { group, update, trees, canopies, houses };
}

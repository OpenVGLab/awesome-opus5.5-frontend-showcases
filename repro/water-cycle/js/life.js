import * as THREE from 'three';
import { TAU, lerp, smoothstep, wrap01 } from './util.js';
import { waveHeight } from './glsl.js';

// A sailboat riding the same swell as the water shader, and a small flock of birds that crosses
// the sky in fair weather. Both are pure functions of the loop phase.
export function createLife(terrain) {
  const group = new THREE.Group();

  const boat = new THREE.Group();
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-0.3, 0.06);
  hullShape.lineTo(0.36, 0.06);
  hullShape.quadraticCurveTo(0.3, -0.02, 0.2, -0.06);
  hullShape.lineTo(-0.24, -0.06);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 });
  hullGeo.translate(0, 0, -0.08);
  const wood = new THREE.MeshStandardMaterial({ color: '#b5543a', roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: '#fbf7ee', roughness: 0.6, side: THREE.DoubleSide });
  boat.add(new THREE.Mesh(hullGeo, wood));
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.56, 6), white);
  mast.position.set(0.02, 0.33, 0);
  boat.add(mast);
  const sail = new THREE.Shape();
  sail.moveTo(0.04, 0.1);
  sail.lineTo(0.04, 0.6);
  sail.quadraticCurveTo(0.2, 0.3, 0.3, 0.11);
  sail.closePath();
  boat.add(new THREE.Mesh(new THREE.ShapeGeometry(sail), white));
  const jib = new THREE.Shape();
  jib.moveTo(0.0, 0.12);
  jib.lineTo(0.0, 0.5);
  jib.lineTo(-0.2, 0.12);
  jib.closePath();
  boat.add(new THREE.Mesh(new THREE.ShapeGeometry(jib), white));
  boat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  boat.scale.setScalar(1.15);
  group.add(boat);

  const center = { x: -7.2, z: -1.9 }, radius = { x: 1.1, z: 0.7 };
  const e = new THREE.Euler(0, 0, 0, 'YXZ');

  const BIRDS = 5;
  const birdPos = new Float32Array(BIRDS * 6 * 3);
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.BufferAttribute(birdPos, 3).setUsage(THREE.DynamicDrawUsage));
  const birds = new THREE.Mesh(birdGeo, new THREE.MeshBasicMaterial({ color: '#27333f', side: THREE.DoubleSide }));
  birds.frustumCulled = false;
  group.add(birds);
  const formation = [[0, 0, 0], [-0.45, 0.05, -0.35], [-0.45, -0.04, 0.35], [-0.9, 0.08, -0.7], [-0.9, 0.02, 0.7]];
  const A = new THREE.Vector3(-12.5, 5.2, 3.5), B = new THREE.Vector3(6.5, 6.6, -3.8);
  const dir = B.clone().sub(A).normalize();
  const yaw = Math.atan2(-dir.z, dir.x);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);

  function update(p, env) {
    const a = TAU * p;
    const x = center.x + radius.x * Math.cos(a), z = center.z + radius.z * Math.sin(a);
    const amp = (1 + 1.2 * env.storm) * smoothstep(0, 0.9, -terrain.heightAt(x, z));
    const h = waveHeight(x, z, p) * amp;
    const d = 0.15;
    const hx = (waveHeight(x + d, z, p) - waveHeight(x - d, z, p)) / (2 * d) * amp;
    const hz = (waveHeight(x, z + d, p) - waveHeight(x, z - d, p)) / (2 * d) * amp;
    const heading = Math.atan2(-(radius.z * Math.cos(a)), -radius.x * Math.sin(a));
    boat.position.set(x, h - 0.01, z);
    const fx = Math.cos(heading), fz = -Math.sin(heading);
    e.set(-(hz * fx - hx * fz) * 0.8, heading, (hx * fx + hz * fz) * 0.8);
    boat.rotation.copy(e);

    const u = wrap01(p - 0.84) / 0.4;
    const vis = u < 1 ? smoothstep(0, 0.06, u) * (1 - smoothstep(0.94, 1, u)) : 0;
    const bx = lerp(A.x, B.x, u), by = lerp(A.y, B.y, u) + 0.15 * Math.sin(TAU * u * 2), bz = lerp(A.z, B.z, u);
    for (let i = 0; i < BIRDS; i++) {
      const [ox, oy, oz] = formation[i];
      const px = bx + ox * cy + oz * sy, pz = bz - ox * sy + oz * cy, py = by + oy;
      const flap = Math.sin(TAU * (p * 64 + i * 0.13));
      const span = 0.22 * vis, lift = 0.1 * flap * vis;
      const local = [
        [0.07, 0, 0], [-0.06, 0, 0], [-0.03, lift, -span],
        [0.07, 0, 0], [-0.03, lift, span], [-0.06, 0, 0],
      ];
      local.forEach(([lx, ly, lz], k) => {
        const o = (i * 6 + k) * 3;
        birdPos[o] = px + lx * cy + lz * sy;
        birdPos[o + 1] = py + ly;
        birdPos[o + 2] = pz - lx * sy + lz * cy;
      });
    }
    birdGeo.attributes.position.needsUpdate = true;
    birds.visible = vis > 0;
  }

  return { group, update };
}

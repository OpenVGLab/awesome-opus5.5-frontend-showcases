// A little vermilion car with a cathedral radio strapped to its roof.
// Model axes: +X right, +Y up, -Z forward (the radio's dial faces +Z, back towards the chase camera).
import * as THREE from 'three';
import { basicMaterial, decalMaterial } from './materials.js';
import { archShape, radialCanvas, canvasTexture } from './paint.js';

export function buildRadio(scale, faceTex, idBase = 64) {
  const group = new THREE.Group();
  const w = 1.3, h = 1.15, depth = 0.62;
  const body = new THREE.ExtrudeGeometry(archShape(w, h), {
    depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 14,
  });
  body.translate(0, 0, -depth / 2);
  const wood = basicMaterial({ color: 0x8e5a30, id: idBase });
  group.add(new THREE.Mesh(body, wood));
  // textured face, inset from the arch
  const face = new THREE.ShapeGeometry(archShape(w * 0.9, h * 0.9), 14);
  const pos = face.attributes.position;
  const uv = face.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / (w * 0.9) + 0.5, pos.getY(i) / (h * 0.9));
  }
  face.translate(0, h * 0.05, depth / 2 + 0.056);
  const faceMesh = new THREE.Mesh(face, basicMaterial({ color: 0xffffff, id: idBase + 1, map: faceTex }));
  group.add(faceMesh);
  // knobs
  const knobG = new THREE.CylinderGeometry(0.075, 0.085, 0.09, 14).rotateX(Math.PI / 2);
  const knobM = basicMaterial({ color: 0x3a2416, id: idBase + 2 });
  for (const kx of [-0.44, 0.44]) {
    const k = new THREE.Mesh(knobG, knobM);
    k.position.set(kx * 0.9 * 0.86, h * 0.05 + h * 0.9 * 0.16, depth / 2 + 0.1);
    group.add(k);
  }
  // feet
  const footG = new THREE.BoxGeometry(0.18, 0.06, depth * 0.8);
  for (const fx of [-0.45, 0.45]) {
    const f = new THREE.Mesh(footG, knobM);
    f.position.set(fx, -0.03, 0);
    group.add(f);
  }
  // antenna on a pivot so it can sway
  const pivot = new THREE.Group();
  pivot.position.set(-w * 0.32, h * 0.86, -depth * 0.2);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 2.1, 6).translate(0, 1.05, 0), basicMaterial({ color: 0xb9b3a8, id: idBase + 3 }));
  pivot.add(rod);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), basicMaterial({ color: 0xb9b3a8, id: idBase + 3 }));
  ball.position.y = 2.1;
  pivot.add(ball);
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0); flagShape.lineTo(0.42, -0.1); flagShape.lineTo(0, -0.22); flagShape.closePath();
  const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), basicMaterial({ color: 0xd94a2f, id: idBase + 4, doubleSide: true }));
  flag.position.set(0.01, 2.02, 0);
  flag.rotation.y = Math.PI / 2;
  pivot.add(flag);
  group.add(pivot);
  group.scale.setScalar(scale);
  return { group, pivot, flag, height: h, width: w, depth };
}

function bodyShape() {
  const s = new THREE.Shape();
  s.moveTo(-2.05, 0.34);
  s.lineTo(2.02, 0.34);
  s.quadraticCurveTo(2.2, 0.36, 2.17, 0.62);
  s.lineTo(2.08, 0.86);
  s.quadraticCurveTo(1.85, 1.0, 1.1, 1.02);
  s.lineTo(-1.55, 1.04);
  s.quadraticCurveTo(-2.0, 1.02, -2.1, 0.8);
  s.lineTo(-2.14, 0.6);
  s.quadraticCurveTo(-2.15, 0.36, -2.05, 0.34);
  return s;
}

function cabinShape() {
  const s = new THREE.Shape();
  s.moveTo(1.02, 0.98);
  s.quadraticCurveTo(0.7, 1.5, 0.25, 1.56);
  s.lineTo(-1.2, 1.56);
  s.quadraticCurveTo(-1.62, 1.5, -1.78, 0.98);
  s.closePath();
  return s;
}

export function buildCar(faceTex) {
  const group = new THREE.Group();
  const tilt = new THREE.Group();   // lean/pitch/bounce lives here
  group.add(tilt);
  const red = basicMaterial({ color: 0xd8452f, id: 61 });
  const glassM = basicMaterial({ color: 0x9fc3d4, id: 62 });
  const darkM = basicMaterial({ color: 0x2a2530, id: 63 });
  const chromeM = basicMaterial({ color: 0xe6e1d6, id: 66 });

  const bodyG = new THREE.ExtrudeGeometry(bodyShape(), { depth: 1.7, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 10 });
  bodyG.translate(0, 0, -0.85);
  bodyG.rotateY(Math.PI / 2);
  tilt.add(new THREE.Mesh(bodyG, red));

  const cabG = new THREE.ExtrudeGeometry(cabinShape(), { depth: 1.62, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 10 });
  cabG.translate(0, 0, -0.81);
  cabG.rotateY(Math.PI / 2);
  tilt.add(new THREE.Mesh(cabG, glassM));

  // roof and pillars over the glass
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.09, 1.55), red);
  roof.position.set(0, 1.6, 0.47);
  tilt.add(roof);
  const pillarG = new THREE.BoxGeometry(0.1, 0.62, 0.14);
  for (const sx of [-0.86, 0.86]) {
    for (const [pz, rx] of [[-0.64, 0.62], [0.35, 0], [1.48, -0.55]]) {
      const p = new THREE.Mesh(pillarG, red);
      p.position.set(sx, 1.28, pz);
      p.rotation.x = rx;
      tilt.add(p);
    }
  }
  // bumpers, lights
  for (const bz of [-2.24, 2.22]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 0.12), chromeM);
    b.position.set(0, 0.42, bz);
    tilt.add(b);
  }
  const headM = basicMaterial({ color: 0xfff1c4, id: 67, emissive: 0.8 });
  for (const hx of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), headM);
    hl.position.set(hx, 0.78, -2.16);
    tilt.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.06), basicMaterial({ color: 0xc8302a, id: 68, emissive: 0.4 }));
    tl.position.set(hx * 1.15, 0.78, 2.2);
    tilt.add(tl);
  }
  // wheels
  const wheels = [];
  const wheelG = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 18).rotateZ(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(0.19, 0.19, 0.34, 12).rotateZ(Math.PI / 2);
  for (const wx of [-0.98, 0.98]) {
    for (const wz of [-1.35, 1.32]) {
      const w = new THREE.Group();
      w.position.set(wx, 0.42, wz);
      w.add(new THREE.Mesh(wheelG, darkM));
      const hub = new THREE.Mesh(hubG, chromeM);
      w.add(hub);
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.3), darkM);
      w.add(spoke);
      group.add(w);
      wheels.push(w);
    }
  }
  // roof rack + radio
  const rackG = new THREE.BoxGeometry(1.75, 0.05, 0.05);
  for (const rz of [0.05, 0.95]) {
    const r = new THREE.Mesh(rackG, darkM);
    r.position.set(0, 1.68, rz);
    tilt.add(r);
  }
  const radio = buildRadio(1, faceTex);
  radio.group.position.set(0, 1.72, 0.52);
  tilt.add(radio.group);

  // soft shadow on the road
  const shadowTex = canvasTexture(radialCanvas());
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.0).rotateX(-Math.PI / 2), decalMaterial(shadowTex, 0x3a3150, 0.45));
  shadow.position.y = 0.04;
  shadow.renderOrder = 2;
  group.add(shadow);

  const state = { sway: 0, swayV: 0, beatPulse: 0, bounce: 0, t: 0 };

  function update(dt, speed, latVel, latAcc, beatPhase) {
    state.t += dt;
    for (const w of wheels) w.rotation.x -= speed * dt / 0.42;
    // lean into lateral motion, slight nose-up with speed
    tilt.rotation.z = THREE.MathUtils.lerp(tilt.rotation.z, -latVel * 0.012, 1 - Math.exp(-dt * 8));
    tilt.position.y = Math.abs(Math.sin(state.t * 13)) * 0.025 + Math.sin(state.t * 2.3) * 0.01;
    // antenna spring
    const force = -latAcc * 0.004 - state.sway * 40 - state.swayV * 3.2 + Math.sin(state.t * 17) * speed * 0.004;
    state.swayV += force * dt;
    state.sway += state.swayV * dt;
    radio.pivot.rotation.z = THREE.MathUtils.clamp(state.sway, -0.6, 0.6);
    radio.pivot.rotation.x = 0.28 + Math.sin(state.t * 9) * 0.03 + speed * 0.004;
    radio.flag.rotation.x = Math.sin(state.t * 20) * 0.35;
    // the radio bops to the waltz
    const pulse = Math.exp(-beatPhase * 7);
    radio.group.scale.set(1 + pulse * 0.05, 1 - pulse * 0.07 + 0.02, 1 + pulse * 0.05);
  }

  return { group, tilt, radio, wheels, update };
}

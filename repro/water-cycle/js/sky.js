import * as THREE from 'three';
import { mulberry32 } from './util.js';
import { BOLTS } from './timeline.js';

const CLEAR_TOP = new THREE.Color('#3d8fd0'), CLEAR_BOT = new THREE.Color('#c4e6f6');
const STORM_TOP = new THREE.Color('#44515f'), STORM_BOT = new THREE.Color('#95a2ad');

export function createSky(U) {
  const group = new THREE.Group();

  const bgU = {
    uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSunUV: { value: new THREE.Vector2(0.3, 0.85) },
    uAspect: { value: 1 }, uGlow: { value: 1 }, uFlash: U.uFlash,
  };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: bgU,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uBot; uniform vec2 uSunUV; uniform float uAspect; uniform float uGlow; uniform float uFlash;
      varying vec2 vUv;
      void main() {
        vec3 col = mix(uBot, uTop, smoothstep(0.0, 1.0, vUv.y));
        vec2 d = (vUv - uSunUV) * vec2(uAspect, 1.0);
        float r = length(d);
        col += vec3(1.0, 0.80, 0.52) * (0.16 * exp(-r * 2.6) + 0.1 * exp(-r * 9.0)) * uGlow;
        col += vec3(0.7, 0.76, 1.0) * uFlash * 0.45;
        float v = length((vUv - 0.5) * vec2(1.0, 1.25));
        col *= 1.0 - 0.2 * v * v;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  }));
  bg.frustumCulled = false;
  bg.renderOrder = -100;
  group.add(bg);

  const sunU = { uP: U.uP, uI: { value: 1 } };
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: sunU,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uP; uniform float uI; varying vec2 vUv;
      void main() {
        vec2 d = vUv - 0.5;
        float r = length(d) * 2.0;
        float a = atan(d.y, d.x);
        float disc = 1.0 - smoothstep(0.125, 0.14, r);
        float glow = exp(-r * 9.0) * 0.55 + exp(-r * 3.2) * 0.12;
        float rays = pow(0.5 + 0.5 * cos(a * 12.0 + uP * 6.2831853), 6.0) * smoothstep(0.14, 0.2, r) * (1.0 - smoothstep(0.2, 0.85, r)) * 0.09;
        float rays2 = pow(0.5 + 0.5 * cos(a * 7.0 - uP * 12.5663706 + 1.0), 8.0) * smoothstep(0.14, 0.2, r) * (1.0 - smoothstep(0.2, 0.65, r)) * 0.06;
        vec3 col = vec3(1.0, 0.96, 0.84) * disc * 1.25 + vec3(1.0, 0.8, 0.5) * (glow + rays + rays2);
        col *= 1.0 - smoothstep(0.85, 1.0, r);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        gl_FragColor.rgb *= uI;
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  sun.renderOrder = 0;
  group.add(sun);

  const rbU = { uI: { value: 0 } };
  const rainbow = new THREE.Mesh(new THREE.RingGeometry(6.2, 7.0, 128, 1, 0, Math.PI), new THREE.ShaderMaterial({
    uniforms: rbU,
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uI; varying vec2 vP;
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main() {
        float t = (length(vP) - 6.2) / 0.8;
        vec3 col = hue((1.0 - t) * 0.78);
        float a = smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.82, 1.0, t));
        a *= smoothstep(0.0, 3.0, vP.y);
        gl_FragColor = vec4(col, a * uI * 0.5);
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
  rainbow.renderOrder = 4;
  group.add(rainbow);

  const bolts = [];
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.6, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

  function jagged(a, b, rng, disp) {
    let pts = [a, b];
    for (let it = 0; it < 6; it++) {
      const np = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const m = pts[i].clone().lerp(pts[i + 1], 0.5);
        m.x += (rng() - 0.5) * disp;
        m.z += (rng() - 0.5) * disp * 0.6;
        m.y += (rng() - 0.5) * disp * 0.25;
        np.push(pts[i], m);
      }
      np.push(pts[pts.length - 1]);
      pts = np;
      disp *= 0.55;
    }
    return pts;
  }
  function tube(pts, radius) {
    const path = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    return new THREE.TubeGeometry(path, pts.length * 2, radius, 5, false);
  }

  function buildBolts(clouds, terrain) {
    BOLTS.forEach((b, i) => {
      const st = clouds.stateAt(b.cloud, b.at);
      const rng = mulberry32(900 + i * 17);
      const start = new THREE.Vector3(st.x + (rng() - 0.5) * 0.6, st.base, st.z + (rng() - 0.5) * 0.3);
      const ex = start.x + b.dx + (rng() - 0.5) * 0.3, ez = start.z + b.dz;
      const end = new THREE.Vector3(ex, terrain.heightAt(ex, ez), ez);
      const main = jagged(start, end, rng, start.distanceTo(end) * 0.2);
      const branchFrom = main[Math.floor(main.length * 0.35)];
      const bEnd = branchFrom.clone().add(new THREE.Vector3(-0.9 - rng() * 0.5, -1.2, 0.2));
      const branch = jagged(branchFrom, bEnd, rng, 0.5);
      const g = new THREE.Group();
      g.add(new THREE.Mesh(tube(main, 0.042), boltMat), new THREE.Mesh(tube(branch, 0.024), boltMat));
      g.add(new THREE.Mesh(tube(main, 0.2), glowMat), new THREE.Mesh(tube(branch, 0.1), glowMat));
      g.visible = false;
      g.renderOrder = 6;
      group.add(g);
      bolts.push(g);
    });
  }

  function placeSun(camera, ndcX, ndcY, dist) {
    const v = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    sun.position.copy(camera.position).addScaledVector(v, dist);
    sun.scale.setScalar(dist * 0.085);
  }

  function placeRainbow(pos, yaw) {
    rainbow.position.copy(pos);
    rainbow.rotation.set(0, yaw, 0);
  }

  const tmp = new THREE.Vector3();
  function update(p, env, camera) {
    bgU.uTop.value.copy(CLEAR_TOP).lerp(STORM_TOP, env.storm);
    bgU.uBot.value.copy(CLEAR_BOT).lerp(STORM_BOT, env.storm);
    U.uSkyT.value.copy(bgU.uTop.value);
    U.uSkyH.value.copy(bgU.uBot.value);
    bgU.uAspect.value = camera.aspect;
    tmp.copy(sun.position).project(camera);
    bgU.uSunUV.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
    bgU.uGlow.value = env.sun;
    sunU.uI.value = 0.18 + 0.82 * (1 - env.storm);
    sun.quaternion.copy(camera.quaternion);
    rbU.uI.value = env.rainbow;
    rainbow.visible = env.rainbow > 0.001;
    const fl = env.flash;
    bolts.forEach((g, i) => {
      g.visible = env.boltIndex === i && fl > 0.12;
      if (g.visible) { boltMat.opacity = Math.min(1, 0.35 + fl * 1.4); glowMat.opacity = 0.2 + 0.5 * fl; }
    });
  }

  return { group, update, buildBolts, placeSun, placeRainbow, sun };
}

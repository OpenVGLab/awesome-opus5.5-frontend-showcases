// Night sky: gradient dome with city glow, twinkling stars, the moon and its halo,
// drifting clouds, and three hazy layers of distant skyline.

import * as THREE from 'three';

export class Sky {
  constructor(scene, tex) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.u = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uMoonDir: { value: new THREE.Vector3(0.3, 0.2, -1).normalize() },
      uMoonColor: { value: new THREE.Color(0.6, 0.66, 0.8) },
      uTime: { value: 0 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(950, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: this.u,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop, uHorizon, uGlow, uMoonDir, uMoonColor;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.42));
            col += uGlow * pow(1.0 - clamp(abs(h), 0.0, 1.0), 7.0);
            if (h < 0.0) col = mix(col, uHorizon * 0.35, clamp(-h * 4.0, 0.0, 1.0));
            float md = max(dot(d, uMoonDir), 0.0);
            col += uMoonColor * (pow(md, 900.0) * 0.5 + pow(md, 60.0) * 0.16 + pow(md, 7.0) * 0.07);
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    dome.renderOrder = -20;
    dome.frustumCulled = false;
    this.group.add(dome);

    // stars
    const N = 1600;
    const pos = new Float32Array(N * 3), size = new Float32Array(N), ph = new Float32Array(N);
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      const y = 0.03 + Math.pow(rnd(), 0.8) * 0.97;
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(a) * rr * 900; pos[i * 3 + 1] = y * 900; pos[i * 3 + 2] = Math.sin(a) * rr * 900;
      size[i] = 0.6 + Math.pow(rnd(), 6) * 3.2;
      ph[i] = rnd() * 100;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('size', new THREE.BufferAttribute(size, 1));
    sg.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: { uTime: this.u.uTime, uPix: { value: 1 }, uFade: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      vertexShader: /* glsl */ `
        attribute float size; attribute float phase;
        uniform float uTime; uniform float uPix;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_Position.z = gl_Position.w * 0.9999;
          float tw = 0.65 + 0.35 * sin(uTime * (1.3 + fract(phase) * 2.0) + phase);
          vA = tw * smoothstep(0.02, 0.25, normalize(position).y);
          gl_PointSize = size * uPix * (0.8 + 0.4 * tw);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade;
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(c));
          gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * vA * uFade, 1.0);
        }`,
    }));
    this.stars.renderOrder = -19;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    // moon & halo
    this.moon = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex.moon, transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.14, 1.1, 1.02) }),
    );
    this.moon.renderOrder = -18;
    scene.add(this.moon);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: new THREE.Color(0.26, 0.3, 0.42), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.halo.renderOrder = -17;
    scene.add(this.halo);

    // clouds, placed by direction so they sit in the sky like the moon
    this.clouds = [];
    const cdefs = [[0.22, 0.13, 1.0, 0], [0.05, 0.19, 0.8, 1], [-0.22, 0.1, 1.2, 2], [0.4, 0.2, 0.9, 1], [-0.45, 0.17, 1.0, 0], [0.12, 0.07, 1.4, 2]];
    for (const [az, el, sc, ti] of cdefs) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.5),
        new THREE.MeshBasicMaterial({ map: tex.clouds[ti], transparent: true, depthWrite: false, fog: false, color: new THREE.Color(0.2, 0.22, 0.3), opacity: 0.55 }),
      );
      m.renderOrder = -16;
      m.userData = { az, el, sc };
      scene.add(m);
      this.clouds.push(m);
    }

    // distant skyline layers (real depth, so parallax comes for free)
    this.layers = [];
    const defs = [
      { z: -230, scale: 0.233, t: tex.skyline[0], haze: 0.72 },
      { z: -135, scale: 0.175, t: tex.skyline[1], haze: 0.5 },
      { z: -72, scale: 0.13, t: tex.skyline[2], haze: 0.28 },
    ];
    for (const d of defs) {
      const w = 900, h = 512 * d.scale;
      const t = d.t.clone();
      t.needsUpdate = true;
      t.repeat.set(w / (2048 * d.scale), 1);
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: t }, uHaze: { value: new THREE.Color() }, uAmt: { value: d.haze }, uWin: { value: 1.6 } },
        transparent: true,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
          uniform sampler2D map;
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D map; uniform vec3 uHaze; uniform float uAmt; uniform float uWin;
          varying vec2 vUv;
          void main() {
            vec4 c = texture2D(map, vUv * vec2(1.0, 1.0));
            if (c.a < 0.03) discard;
            float lum = max(c.r, max(c.g, c.b));
            vec3 col = mix(c.rgb, uHaze, uAmt);
            if (lum > 0.25) col = c.rgb * uWin * (1.0 - uAmt * 0.6) + uHaze * uAmt * 0.3;
            gl_FragColor = vec4(col, c.a);
          }`,
      });
      mat.uniforms.map.value.repeat.copy(t.repeat);
      const geo = new THREE.PlaneGeometry(w, h);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * t.repeat.x);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(150, h / 2 - 3, d.z);
      m.renderOrder = -15 + this.layers.length;
      scene.add(m);
      this.layers.push(m);
    }
  }

  update(camera, pal, t, moonDir, moonSize) {
    this.group.position.copy(camera.position);
    this.u.uTime.value = t;
    this.u.uTop.value.copy(pal.skyTop);
    this.u.uHorizon.value.copy(pal.skyHorizon);
    this.u.uGlow.value.copy(pal.skyGlow);
    this.u.uMoonDir.value.copy(moonDir);
    const R = 800;
    this.moon.position.copy(camera.position).addScaledVector(moonDir, R);
    this.moon.quaternion.copy(camera.quaternion);
    const size = R * moonSize;
    this.moon.scale.set(size, size, 1);
    this.halo.position.copy(camera.position).addScaledVector(moonDir, R * 0.99);
    this.halo.scale.setScalar(size * 7);
    for (const c of this.clouds) {
      const { az, el, sc } = c.userData;
      const a = az + t * 0.0009;
      const dir = TMP.set(Math.sin(a) * Math.cos(el), Math.sin(el), -Math.cos(a) * Math.cos(el));
      c.position.copy(camera.position).addScaledVector(dir, 700);
      c.quaternion.copy(camera.quaternion);
      c.scale.setScalar(260 * sc);
      c.material.color.copy(pal.cloud);
    }
    for (const l of this.layers) l.material.uniforms.uHaze.value.copy(pal.haze);
  }
}
const TMP = new THREE.Vector3();

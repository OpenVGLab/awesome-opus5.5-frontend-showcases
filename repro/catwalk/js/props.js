// Living details: fish treats, checkpoint lanterns, broken glass, steam vents,
// pigeons, dust in the lamplight, drifting petals, sparkles, the cat's contact shadow.

import * as THREE from 'three';
import { ventPower } from './physics.js';
import { rng } from './textures.js';

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Props {
  constructor(scene, stage, tex, world) {
    this.scene = scene;
    this.stage = stage;
    this.tex = tex;
    this.world = world;
    this.r = rng(77);
    this.buildFish();
    this.buildCheckpoints();
    this.buildGlass();
    this.buildSteam();
    this.buildBirds();
    this.buildDust();
    this.buildPetals();
    this.buildSparks();
    this.buildShadow();
  }

  // ── fish ──
  buildFish() {
    const s = new THREE.Shape();
    s.moveTo(0.34, 0);
    s.bezierCurveTo(0.3, 0.17, -0.12, 0.21, -0.36, 0.04);
    s.lineTo(-0.58, 0.18);
    s.quadraticCurveTo(-0.5, 0, -0.58, -0.18);
    s.lineTo(-0.36, -0.04);
    s.bezierCurveTo(-0.12, -0.21, 0.3, -0.17, 0.34, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 });
    geo.center();
    geo.scale(0.4, 0.4, 0.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffa640, emissiveIntensity: 1.35, metalness: 0.55, roughness: 0.28 });
    const list = this.stage.fish;
    this.fish = new THREE.InstancedMesh(geo, mat, list.length);
    this.fish.frustumCulled = false;
    this.scene.add(this.fish);
    this.fishState = list.map(() => ({ got: false, t: 0 }));
    const pos = new Float32Array(list.length * 3);
    list.forEach((f, i) => pos.set([f.x, f.y, 0.05], i * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(list.length).fill(1), 1));
    this.fishGlow = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { map: { value: this.tex.glow }, uScale: { value: 400 }, uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float alpha; uniform float uScale; uniform float uTime; varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position + vec3(0.0, 0.05 * sin(uTime * 2.2 + position.x), 0.0), 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uScale * 0.75 / -mv.z;
          vA = alpha;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; varying float vA;
        void main() { vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, 0.62, 0.22) * c.a * 0.55 * vA, 1.0); }`,
    }));
    this.fishGlow.frustumCulled = false;
    this.fishGlow.renderOrder = 8;
    this.scene.add(this.fishGlow);
  }

  // ── checkpoints: paper lanterns on posts that light up as the cat passes ──
  buildCheckpoints() {
    this.cps = [];
    const lg = new THREE.LatheGeometry(
      [[0.04, -0.3], [0.15, -0.28], [0.23, -0.18], [0.25, -0.05], [0.25, 0.05], [0.23, 0.18], [0.15, 0.28], [0.04, 0.3]].map(([r, y]) => new THREE.Vector2(r, y)),
      16,
    );
    lg.rotateY(-Math.PI / 2);
    const woodM = new THREE.MeshStandardMaterial({ color: 0x3a281c, roughness: 0.8 });
    for (const cp of this.stage.checkpoints) {
      const y = this.stage.groundAt(cp.x);
      const g = new THREE.Group();
      const base = cp.x < this.stage.sections[1].x0 ? 0 : y - 0.45;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, y + 1.25 - base, 0.1), woodM);
      post.position.set(cp.x + 0.35, (y + 1.25 + base) / 2, -0.62);
      g.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.45), woodM);
      arm.position.set(cp.x + 0.35, y + 1.2, -0.42);
      g.add(arm);
      const mat = new THREE.MeshBasicMaterial({ map: this.tex.lantern, color: new THREE.Color(0.2, 0.09, 0.06) });
      const lan = new THREE.Mesh(lg, mat);
      lan.position.set(cp.x + 0.35, y + 0.82, -0.22);
      g.add(lan);
      const capM = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.6 });
      for (const dy of [0.31, -0.31]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), capM);
        cap.position.set(cp.x + 0.35, y + 0.82 + dy, -0.22);
        g.add(cap);
      }
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xff8a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      halo.position.copy(lan.position);
      halo.scale.setScalar(2.2);
      g.add(halo);
      this.scene.add(g);
      const src = { x: cp.x + 0.35, y: y + 0.82, z: 0.2, color: new THREE.Color(0xff8a48), intensity: 6, distance: 8, shadow: false, flicker: 0.03, phase: cp.x, kind: 'lantern', on: false, level: 0, priority: 2, shadowSlot: 0 };
      this.world.sources.push(src);
      this.cps.push({ mat, halo, src, lit: false, t: 0 });
    }
  }

  // ── broken glass on wall tops ──
  buildGlass() {
    const hz = this.stage.hazards.filter((h) => h.kind === 'glass');
    const count = hz.reduce((n, h) => n + Math.ceil((h.x1 - h.x0) / 0.06), 0);
    const geo = new THREE.ConeGeometry(0.035, 1, 3);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9fd0b0, emissive: 0x1a3a2a, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85 });
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    let k = 0;
    const glints = [];
    const colA = new THREE.Color(0x9fd0b0), colB = new THREE.Color(0xd9a860);
    for (const h of hz) {
      for (let x = h.x0 + 0.03; x < h.x1 - 0.02; x += 0.06) {
        for (const z of [-0.12, 0, 0.12]) {
          if (k >= count) break;
          e.set((this.r() - 0.5) * 0.7, this.r() * 3, (this.r() - 0.5) * 0.7);
          q.setFromEuler(e);
          sc.set(1 + this.r(), 0.06 + this.r() * 0.08, 0.6 + this.r());
          p.set(x + (this.r() - 0.5) * 0.04, h.y0, z + (this.r() - 0.5) * 0.08);
          m.compose(p, q, sc);
          im.setMatrixAt(k, m);
          im.setColorAt(k, this.r() < 0.6 ? colA : colB);
          k++;
        }
        if (this.r() < 0.5) glints.push(x, h.y0 + 0.09, 0.2);
      }
    }
    im.count = k;
    this.scene.add(im);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(glints, 3));
    this.glints = new THREE.Points(gg, new THREE.ShaderMaterial({
      uniforms: { map: { value: this.tex.dot }, uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = pow(max(0.0, sin(uTime * 3.0 + position.x * 17.0)), 12.0);
          vA = 0.25 + tw;
          gl_PointSize = (40.0 + 90.0 * tw) / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; varying float vA;
        void main() { vec2 c = gl_PointCoord - 0.5; float star = max(0.0, 1.0 - abs(c.x) * 14.0) + max(0.0, 1.0 - abs(c.y) * 14.0); float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vec3(0.9, 1.0, 0.95) * (a * 0.6 + star * a) * vA, 1.0); }`,
    }));
    this.glints.frustumCulled = false;
    this.scene.add(this.glints);
  }

  // ── steam vents ──
  buildSteam() {
    this.vents = [];
    for (const h of this.stage.hazards.filter((v) => v.kind === 'vent')) {
      const N = 46;
      const seed = new Float32Array(N);
      for (let i = 0; i < N; i++) seed[i] = this.r();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: this.tex.dot }, uTime: { value: 0 }, uPower: { value: 0 }, uWisp: { value: 0 }, uOrigin: { value: new THREE.Vector3(h.cx, h.y0 + 0.14, 0) }, uH: { value: h.y1 - h.y0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float seed; uniform float uTime, uPower, uWisp, uH; uniform vec3 uOrigin; varying float vA;
          void main() {
            float age = fract(uTime * (1.4 + seed * 0.6) + seed * 7.0);
            float strength = max(uPower, uWisp * 0.35);
            vec3 p = uOrigin + vec3((seed - 0.5) * 0.25 + sin(age * 5.0 + seed * 20.0) * 0.08 * age, age * uH * (0.35 + 0.65 * strength) * 1.1, (fract(seed * 13.0) - 0.5) * 0.25);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (90.0 + 260.0 * age) * (0.5 + 0.5 * strength) / -mv.z;
            vA = strength * (1.0 - age) * smoothstep(0.0, 0.2, age);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D map; varying float vA;
          void main() { float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vec3(0.75, 0.85, 0.95) * a * vA * 0.34, 1.0); }`,
      });
      const pts = new THREE.Points(g, mat);
      pts.frustumCulled = false;
      pts.renderOrder = 9;
      this.scene.add(pts);
      this.vents.push({ h, mat, pts, last: 0 });
    }
  }

  // ── pigeons that scatter as the cat comes ──
  buildBirds() {
    this.birds = [];
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x7b8290, roughness: 0.7 });
    const wingM = new THREE.MeshStandardMaterial({ color: 0x5c6270, roughness: 0.8, side: THREE.DoubleSide });
    const sph = new THREE.SphereGeometry(1, 10, 8);
    const spots = [];
    for (const d of this.stage.deco) if (d.type === 'birds') for (let i = 0; i < 5; i++) spots.push([d.x - 2 + i * 1.05 + this.r() * 0.3, d.y, 0]);
    for (const [x, extra] of [[32, 0], [58.5, 0], [104, 0], [140, 0], [205, 0]]) {
      const y = this.stage.groundAt(x);
      if (y > -Infinity) for (let i = 0; i < 3; i++) spots.push([x + i * 0.45, y, -0.05]);
    }
    for (const [x, y, z] of spots) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(sph, bodyM); b.scale.set(0.11, 0.075, 0.07); b.position.y = 0.09; g.add(b);
      const h = new THREE.Mesh(sph, bodyM); h.scale.setScalar(0.042); h.position.set(0.1, 0.16, 0); g.add(h);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 5), new THREE.MeshStandardMaterial({ color: 0x2a2420 }));
      beak.rotation.z = -Math.PI / 2; beak.position.set(0.15, 0.155, 0); g.add(beak);
      const wings = [];
      for (const s of [1, -1]) {
        const piv = new THREE.Group(); piv.position.set(0.0, 0.13, s * 0.05);
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), wingM);
        w.rotation.x = Math.PI / 2; w.position.z = s * 0.1;
        piv.add(w); g.add(piv); wings.push({ piv, s });
      }
      g.position.set(x, y, z);
      g.rotation.y = this.r() < 0.5 ? 0 : Math.PI;
      this.scene.add(g);
      this.birds.push({ g, wings, x, y, z, home: new THREE.Vector3(x, y, z), state: 0, t: this.r() * 5, vx: 0, vy: 0, vz: 0, head: h });
    }
  }

  // ── dust motes floating in lamplight ──
  buildDust() {
    const srcs = this.world.sources.filter((s) => s.kind === 'lamp' || s.kind === 'lantern' || s.kind === 'neon' || s.kind === 'clock');
    const per = 16;
    const N = srcs.length * per;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N);
    let k = 0;
    for (const s of srcs) {
      for (let i = 0; i < per; i++) {
        pos[k * 3] = s.x + (this.r() - 0.5) * 2.2;
        pos[k * 3 + 1] = s.y - this.r() * 2.2;
        pos[k * 3 + 2] = s.z + (this.r() - 0.5) * 1.6;
        const c = s.color;
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        seed[k] = this.r();
        k++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.dust = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { map: { value: this.tex.dot }, uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 color; attribute float seed; uniform float uTime; varying vec3 vC; varying float vA;
        void main() {
          float t = uTime * (0.15 + seed * 0.2);
          vec3 p = position + vec3(sin(t * 2.0 + seed * 30.0) * 0.25, sin(t * 1.3 + seed * 11.0) * 0.3, cos(t * 1.7 + seed * 7.0) * 0.2);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (10.0 + seed * 16.0) / -mv.z * 3.0;
          vC = color; vA = 0.5 + 0.5 * sin(uTime * (1.0 + seed * 2.0) + seed * 40.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; varying vec3 vC; varying float vA;
        void main() { float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vC * a * vA * 0.9, 1.0); }`,
    }));
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 9;
    this.scene.add(this.dust);
  }

  // ── petals in the lantern alley ──
  buildPetals() {
    const N = 110;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = this.r() * 20; pos[i * 3 + 1] = this.r() * 9; pos[i * 3 + 2] = -2.5 + this.r() * 6;
      seed[i] = this.r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.petals = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAlpha: { value: 0 } },
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float seed; uniform float uTime; uniform vec3 uCam; varying float vA; varying float vS;
        void main() {
          vec3 p = position;
          p.y -= uTime * (0.35 + seed * 0.3);
          p.x -= uTime * (0.5 + seed * 0.4);
          p.x += sin(uTime * 1.3 + seed * 20.0) * 0.4;
          vec3 base = vec3(uCam.x - 10.0, uCam.y - 4.5, 0.0);
          p.x = base.x + mod(p.x - base.x, 20.0);
          p.y = base.y + mod(p.y - base.y, 9.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vS = sin(uTime * (2.0 + seed * 3.0) + seed * 50.0);
          gl_PointSize = (12.0 + seed * 10.0) / -mv.z * 3.0;
          vA = 1.0;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha; varying float vA; varying float vS;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          c.x /= max(0.25, abs(vS));
          float d = length(c * vec2(1.0, 1.8));
          float a = smoothstep(0.5, 0.35, d) * uAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(1.0, 0.62, 0.7) * 0.55, a * 0.5);
        }`,
    }));
    this.petals.frustumCulled = false;
    this.petals.renderOrder = 10;
    this.scene.add(this.petals);
  }

  // ── sparkle bursts ──
  buildSparks() {
    const N = 240;
    this.sparkN = N;
    this.sparkPos = new Float32Array(N * 3);
    this.sparkVel = new Float32Array(N * 3);
    this.sparkLife = new Float32Array(N);
    this.sparkCol = new Float32Array(N * 3);
    this.sparkNext = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('life', new THREE.BufferAttribute(this.sparkLife, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparks = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { map: { value: this.tex.dot } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float life; attribute vec3 color; varying float vL; varying vec3 vC;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (18.0 + 40.0 * life) / -mv.z * 3.0; vL = life; vC = color; }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; varying float vL; varying vec3 vC;
        void main() { if (vL <= 0.0) discard; float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vC * a * vL * 1.6, 1.0); }`,
    }));
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 11;
    this.scene.add(this.sparks);
  }

  burst(x, y, z, n, color, speed = 2.2) {
    for (let i = 0; i < n; i++) {
      const k = this.sparkNext;
      this.sparkNext = (this.sparkNext + 1) % this.sparkN;
      const a = this.r() * Math.PI * 2, b = (this.r() - 0.5) * Math.PI;
      const v = speed * (0.4 + this.r() * 0.8);
      this.sparkPos.set([x, y, z], k * 3);
      this.sparkVel.set([Math.cos(a) * Math.cos(b) * v, Math.sin(b) * v + 1.2, Math.sin(a) * Math.cos(b) * v * 0.5], k * 3);
      this.sparkLife[k] = 0.7 + this.r() * 0.5;
      this.sparkCol.set([color.r, color.g, color.b], k * 3);
    }
  }

  buildShadow() {
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.tex.glow, color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 4;
    this.scene.add(this.shadow);
  }

  surfaceBelow(x, y) {
    let best = -Infinity;
    const s = this.stage;
    for (const p of s.plats) if (x >= p.x0 - 0.1 && x <= p.x1 + 0.1 && p.y <= y + 0.05 && p.y > best) best = p.y;
    for (const o of s.oneways) if (x >= o.x0 && x <= o.x1 && o.y <= y + 0.05 && o.y > best) best = o.y;
    for (const b of s.blocks) if (x >= b.x0 && x <= b.x1 && b.y1 <= y + 0.05 && b.y1 > best) best = b.y1;
    return best;
  }

  reset() {
    this.fishState.forEach((f) => { f.got = false; f.t = 0; });
    const a = this.fishGlow.geometry.attributes.alpha;
    for (let i = 0; i < a.count; i++) a.setX(i, 1);
    a.needsUpdate = true;
    for (const c of this.cps) { c.lit = false; c.t = 0; c.src.on = false; c.src.level = 0; c.mat.color.setRGB(0.2, 0.09, 0.06); c.halo.material.opacity = 0; }
    for (const b of this.birds) { b.state = 0; b.g.position.copy(b.home); b.g.visible = true; b.g.rotation.set(0, b.g.rotation.y, 0); }
  }

  collect(id) {
    const st = this.fishState[id];
    if (!st || st.got) return;
    st.got = true;
    st.t = 0;
    const f = this.stage.fish[id];
    this.burst(f.x, f.y, 0.1, 14, new THREE.Color(1.0, 0.75, 0.35));
  }

  lightCheckpoint(id) {
    const c = this.cps[id];
    if (!c || c.lit) return;
    c.lit = true;
    c.t = 0;
    c.src.on = true;
    const p = c.halo.position;
    this.burst(p.x, p.y, p.z + 0.2, 30, new THREE.Color(1.0, 0.55, 0.25), 2.8);
  }

  // Relight checkpoints already reached (after a respawn nothing needs undoing).
  update(dt, t, g, camX, camY, catView, sectionBlend) {
    const scrollX = g.scrollX;
    // fish
    const m = TMPM, q = TMPQ, p = TMPV, s = TMPS;
    const alpha = this.fishGlow.geometry.attributes.alpha;
    let alphaDirty = false;
    this.stage.fish.forEach((f, i) => {
      const st = this.fishState[i];
      let scale = 1, lift = 0;
      if (st.got) {
        st.t += dt;
        scale = Math.max(0, 1 - st.t / 0.25);
        lift = st.t * 1.5;
        if (alpha.getX(i) !== 0) { alpha.setX(i, 0); alphaDirty = true; }
      }
      const vis = Math.abs(f.x - camX) < 14 ? 1 : 0;
      q.setFromAxisAngle(AXIS_Y, t * 1.8 + i * 0.7);
      p.set(f.x, f.y + 0.05 * Math.sin(t * 2.2 + f.x) + lift, 0.05);
      s.setScalar(scale * vis + 1e-4);
      m.compose(p, q, s);
      this.fish.setMatrixAt(i, m);
    });
    this.fish.instanceMatrix.needsUpdate = true;
    if (alphaDirty) alpha.needsUpdate = true;
    this.fishGlow.material.uniforms.uTime.value = t;
    // checkpoints
    for (const c of this.cps) {
      if (!c.lit) continue;
      c.t += dt;
      const k = Math.min(1, c.t / 0.5);
      const flare = Math.max(0, 1 - c.t / 0.8) * 1.5;
      c.src.level = k;
      c.mat.color.setRGB(0.2 + 2.3 * k + flare, 0.09 + 0.85 * k + flare * 0.4, 0.06 + 0.3 * k);
      c.halo.material.opacity = 0.55 * k + flare * 0.4;
    }
    this.glints.material.uniforms.uTime.value = t;
    // steam
    for (const v of this.vents) {
      const pw = ventPower(v.h, scrollX);
      const ph = ((scrollX - v.h.cx) / v.h.period + v.h.offset) % 1;
      const phase = ph < 0 ? ph + 1 : ph;
      v.mat.uniforms.uTime.value = t;
      v.mat.uniforms.uPower.value = pw;
      v.mat.uniforms.uWisp.value = phase > 0.82 ? (phase - 0.82) / 0.18 : 0.25;
      v.power = pw;
    }
    // birds
    for (const b of this.birds) {
      b.t += dt;
      if (b.state === 0) {
        b.head.position.y = 0.16 + (Math.sin(b.t * 3) > 0.7 ? -0.03 : 0);
        if (catView.x > b.home.x - 2.3 && catView.x < b.home.x + 1 && Math.abs(catView.y - b.home.y) < 1.5) {
          b.state = 1;
          b.t = 0;
          b.vx = (this.r() - 0.2) * 2.5;
          b.vy = 2.2 + this.r() * 1.2;
          b.vz = -1.5 - this.r() * 2;
          b.g.rotation.y = b.vx > 0 ? -0.6 : Math.PI + 0.6;
          this.onBird && this.onBird(b);
        }
      } else if (b.state === 1) {
        b.vy -= 0.8 * dt;
        b.g.position.x += b.vx * dt;
        b.g.position.y += b.vy * dt;
        b.g.position.z += b.vz * dt;
        const flap = Math.sin(b.t * 32) * 1.1;
        for (const w of b.wings) w.piv.rotation.x = w.s * flap;
        if (b.t > 4) { b.state = 2; b.g.visible = false; }
      }
    }
    // dust, petals
    this.dust.material.uniforms.uTime.value = t;
    this.petals.material.uniforms.uTime.value = t;
    this.petals.material.uniforms.uCam.value.set(camX, camY, 0);
    this.petals.material.uniforms.uAlpha.value = smoothstep(0.6, 1.0, sectionBlend) * (1 - smoothstep(1.4, 1.9, sectionBlend));
    // sparks
    for (let i = 0; i < this.sparkN; i++) {
      if (this.sparkLife[i] <= 0) continue;
      this.sparkLife[i] -= dt * 1.4;
      this.sparkVel[i * 3 + 1] -= 3.5 * dt;
      for (let k = 0; k < 3; k++) this.sparkPos[i * 3 + k] += this.sparkVel[i * 3 + k] * dt;
    }
    const sg = this.sparks.geometry.attributes;
    sg.position.needsUpdate = true;
    sg.life.needsUpdate = true;
    sg.color.needsUpdate = true;
    // contact shadow
    const gy = this.surfaceBelow(catView.x, catView.y);
    if (gy > -Infinity && catView.visible) {
      const hgt = Math.max(0, catView.y - gy);
      this.shadow.visible = true;
      this.shadow.position.set(catView.x - 0.02, gy + 0.006, 0);
      const sc = 0.95 * (1 + hgt * 0.25);
      this.shadow.scale.set(sc, sc * 0.36, 1);
      this.shadow.material.opacity = 0.62 * Math.max(0, 1 - hgt / 1.6);
    } else this.shadow.visible = false;
  }
}
const TMPM = new THREE.Matrix4(), TMPQ = new THREE.Quaternion(), TMPV = new THREE.Vector3(), TMPS = new THREE.Vector3();
const AXIS_Y = new THREE.Vector3(0, 1, 0);

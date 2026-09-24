import * as THREE from 'three';

export function glowTexture(size = 128, stops = [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [0.6, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PVERT = /* glsl */`
  attribute vec4 aColor;
  attribute float aSize;
  uniform float uScale;
  varying vec4 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float ps = aSize * uScale / max(0.6, -mv.z);
    gl_PointSize = clamp(ps, 0.0, 320.0);
    // Sprites that grow past ~a tenth of the focal length (i.e. right in front of the lens) fade so they cannot blanket the screen.
    float big = min(1.0, pow(uScale * 0.1 / max(ps, 1.0), 1.5));
    vColor = vec4(aColor.rgb, aColor.a * smoothstep(1.0, 5.0, -mv.z) * big);
    if (aSize <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const PFRAG_ADD = /* glsl */`
  varying vec4 vColor;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = dot(c, c);
    if (d > 1.0) discard;
    float a = 1.0 - d; a *= a;
    vec3 col = vColor.rgb * (a + pow(a, 8.0) * 1.2);
    gl_FragColor = vec4(col * vColor.a, 1.0);
  }`;
const PFRAG_NORM = /* glsl */`
  varying vec4 vColor;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = dot(c, c);
    if (d > 1.0) discard;
    float a = smoothstep(1.0, 0.1, d);
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  }`;

class Particles {
  constructor(max, additive) {
    this.max = max; this.cursor = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.drag = new Float32Array(max);
    this.a0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aColor', this.aCol); g.setAttribute('aSize', this.aSize);
    this.uniforms = { uScale: { value: 600 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: PVERT, fragmentShader: additive ? PFRAG_ADD : PFRAG_NORM,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 10;
    this.active = 0;
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r0, g0, b0, r1, g1, b1, drag = 0, a0 = 1) {
    const i = this.cursor; this.cursor = (i + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.c0[i3] = r0; this.c0[i3 + 1] = g0; this.c0[i3 + 2] = b0;
    this.c1[i3] = r1; this.c1[i3 + 1] = g1; this.c1[i3 + 2] = b1;
    this.s0[i] = s0; this.s1[i] = s1; this.size[i] = s0;
    this.life[i] = life; this.maxLife[i] = life; this.drag[i] = drag; this.a0[i] = a0;
    const i4 = i * 4; this.col[i4] = r0; this.col[i4 + 1] = g0; this.col[i4 + 2] = b0; this.col[i4 + 3] = a0;
  }
  update(dt, scrollDz) {
    const { pos, vel, col, c0, c1, size, s0, s1, life, maxLife, drag, a0 } = this;
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { if (size[i] !== 0) size[i] = 0; continue; }
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; continue; }
      n++;
      const t = 1 - life[i] / maxLife[i], i3 = i * 3, i4 = i * 4;
      const k = Math.max(0, 1 - drag[i] * dt);
      vel[i3] *= k; vel[i3 + 1] *= k; vel[i3 + 2] *= k;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += (vel[i3 + 2] + scrollDz) * dt;
      size[i] = s0[i] + (s1[i] - s0[i]) * t;
      col[i4] = c0[i3] + (c1[i3] - c0[i3]) * t;
      col[i4 + 1] = c0[i3 + 1] + (c1[i3 + 1] - c0[i3 + 1]) * t;
      col[i4 + 2] = c0[i3 + 2] + (c1[i3 + 2] - c0[i3 + 2]) * t;
      col[i4 + 3] = a0[i] * (t < 0.1 ? 1 : 1 - (t - 0.1) / 0.9);
    }
    this.active = n;
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.size.fill(0); }
}

const PAL = {
  fire: [[4.2, 1.9, 0.55], [1.1, 0.12, 0.02]],
  blue: [[1.1, 2.4, 5], [0.12, 0.22, 1.1]],
  pink: [[4.6, 1.0, 2.8], [1.0, 0.08, 0.5]],
  gold: [[4.4, 3.0, 0.9], [1.3, 0.4, 0.04]],
  white: [[3.6, 3.4, 3.2], [0.7, 0.6, 1.2]],
};

// Blast "heat" (sum of scale² of recent explosions) above which new blasts are dimmed.
const HEAT0 = 4;

const rnd = (a, b) => a + Math.random() * (b - a);
function randDir(out) {
  const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  out.set(s * Math.cos(th), u, s * Math.sin(th));
  return out;
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.add = new Particles(7000, true);
    this.smoke = new Particles(900, false);
    scene.add(this.smoke.points, this.add.points);
    this.drift = 0.22;
    this.heat = 0;
    this.tmp = new THREE.Vector3();

    this.glowTex = glowTexture(128);
    this.flashes = [];
    for (let i = 0; i < 28; i++) {
      const m = new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffffff });
      const s = new THREE.Sprite(m); s.visible = false; s.renderOrder = 25;
      scene.add(s); this.flashes.push({ s, t: 0, dur: 1, size: 1, col: new THREE.Color() });
    }

    const ringMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 1 }, uWidth: { value: 0.06 } },
      // Big flat rings sweep past the camera; the part of the band near the lens fades so it cannot flood the screen.
      vertexShader: 'varying vec2 vP; varying float vD; void main(){ vP = position.xy; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; uniform float uWidth; varying vec2 vP; varying float vD;
        void main(){ float r = length(vP); float band = exp(-pow((r - 0.92) / uWidth, 2.0)); float fill = smoothstep(0.4, 0.95, r) * 0.05;
          gl_FragColor = vec4(uColor * (band + fill) * uAlpha * smoothstep(4.0, 30.0, vD), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const ringGeo = new THREE.CircleGeometry(1, 72);
    this.rings = [];
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(ringGeo, ringMat.clone()); m.visible = false; m.renderOrder = 22;
      scene.add(m); this.rings.push({ m, t: 0, dur: 1, r: 1, flat: false, face: false });
    }

    const dg = new THREE.TetrahedronGeometry(1, 0);
    dg.scale(1, 0.45, 0.8);
    this.debrisMesh = new THREE.InstancedMesh(dg, new THREE.MeshStandardMaterial({ color: 0x8894a8, metalness: 0.7, roughness: 0.45, flatShading: true }), 220);
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.frustumCulled = false;
    scene.add(this.debrisMesh);
    this.debris = [];
    for (let i = 0; i < 220; i++) this.debris.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1, life: 0, max: 1, hot: 0 });
    this.dCursor = 0;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.sv = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 220; i++) this.debrisMesh.setMatrixAt(i, zero);
  }

  setScale(px) { this.add.uniforms.uScale.value = px; this.smoke.uniforms.uScale.value = px; }

  particle(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag = 0, a = 1) {
    this.add.spawn(x, y, z, vx, vy, vz, life, s0, s1, c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], drag, a);
  }

  sparks(p, n, speed, pal = 'fire', life = 0.5, size = 0.35) {
    const [c0, c1] = PAL[pal] || pal, d = this.tmp;
    for (let i = 0; i < n; i++) {
      randDir(d); const s = speed * rnd(0.35, 1);
      this.add.spawn(p.x, p.y, p.z, d.x * s, d.y * s, d.z * s, life * rnd(0.5, 1), size * rnd(0.6, 1.3), 0, c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], 2.2);
    }
  }

  trail(x, y, z, c0, c1, size, life, a = 1) {
    this.add.spawn(x, y, z, 0, 0, 0, life, size, size * 0.15, c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], 0, a);
  }

  heatDim() { return Math.sqrt(HEAT0 / Math.max(HEAT0, this.heat)); }

  explosion(p, scale = 1, pal = 'fire', opts = {}) {
    const [c0, c1] = PAL[pal], d = this.tmp;
    // Additive blasts saturate to white when stacked: big ones grow sub-linearly and recent blast heat dims new ones.
    const sz = scale <= 1.5 ? scale : 1.5 + (scale - 1.5) * 0.55;
    const I = (opts.dim ?? 1) * (opts.noHeat ? 1 : this.heatDim()), Is = 0.4 + 0.6 * I, nk = opts.n ?? 1;
    if (!opts.noHeat) this.heat += scale * scale;
    const nFire = Math.round((24 * Math.min(scale, 3) + 6) * nk), nSpark = Math.round((32 * Math.min(scale, 3.5) + 8) * nk);
    for (let i = 0; i < nFire; i++) {
      randDir(d); const s = rnd(2, 11) * scale;
      this.add.spawn(p.x + d.x * sz * 0.6, p.y + d.y * sz * 0.6, p.z + d.z * sz * 0.6, d.x * s, d.y * s, d.z * s,
        rnd(0.35, 0.85) * Math.sqrt(scale), rnd(2.2, 3.4) * sz, rnd(0.4, 1.2) * sz, c0[0] * I, c0[1] * I, c0[2] * I, c1[0], c1[1], c1[2], 2.8, 0.78);
    }
    for (let i = 0; i < nSpark; i++) {
      randDir(d); const s = rnd(18, 55) * Math.sqrt(scale);
      this.add.spawn(p.x, p.y, p.z, d.x * s, d.y * s, d.z * s, rnd(0.25, 0.75), rnd(0.25, 0.55) * Math.sqrt(sz), 0,
        c0[0] * 1.2 * Is, c0[1] * 1.2 * Is, c0[2] * Is, c1[0], c1[1], c1[2], 2.4);
    }
    const nSmoke = Math.round(6 * Math.min(scale, 3));
    for (let i = 0; i < nSmoke; i++) {
      randDir(d); const s = rnd(1, 5) * scale;
      const g = rnd(0.05, 0.1);
      this.smoke.spawn(p.x + d.x * scale, p.y + d.y * scale, p.z + d.z * scale, d.x * s, d.y * s, d.z * s, rnd(0.9, 1.8), 2 * scale, 7 * scale,
        g * 1.4, g * 1.1, g * 1.3, 0.02, 0.02, 0.03, 1.2, 0.55);
    }
    const fk = 0.55 * I;
    this.flash(p, 6.5 * sz, 0.24 + 0.05 * scale, [c0[0] * fk, c0[1] * fk, c0[2] * fk]);
    if (!opts.noRing) this.shock(p, 7 * sz, 0.45 + 0.08 * scale, pal === 'fire' ? [2.2 * I, 1.2 * I, 0.5 * I] : [c0[0] * I, c0[1] * I, c0[2] * I], false);
    if (opts.debris !== 0) this.spawnDebris(p, opts.debris ?? Math.round(3 + scale * 3), scale);
  }

  bigExplosion(p, scale = 3, dim = 1) {
    const k = dim * this.heatDim(), sz = scale <= 1.5 ? scale : 1.5 + (scale - 1.5) * 0.55;
    // Particles grow with the blast, so the overlap depth at its centre tracks the particle count: huge blasts get fewer.
    const n = Math.min(1, 1.8 / scale);
    this.heat += scale * scale * 1.5;
    this.explosion(p, scale, 'fire', { debris: 18, dim: k, noHeat: true, n });
    this.explosion(p, scale * 0.6, 'white', { noRing: true, debris: 0, dim: 0.6 * k, noHeat: true, n: n * 0.6 });
    this.shock(p, 16 * scale, 1.1, [3 * k, 1.5 * k, 0.6 * k], true);
    this.shock(p, 12 * scale, 0.8, [1.2 * k, 2.2 * k, 4.5 * k], false);
    this.flash(p, 15 * sz, 0.45, [2.8 * k, 2.1 * k, 1.5 * k]);
  }

  flash(p, size, dur, col = [6, 5, 3]) {
    const f = this.flashes.find((x) => !x.s.visible) || this.flashes[(this.fc = ((this.fc || 0) + 1) % this.flashes.length)];
    f.s.visible = true; f.s.position.copy(p); f.t = 0; f.dur = dur; f.size = size;
    f.col.setRGB(col[0], col[1], col[2]);
  }

  shock(p, radius, dur, col = [1.5, 2.8, 6], flat = false) {
    const r = this.rings.find((x) => !x.m.visible) || this.rings[(this.rc = ((this.rc || 0) + 1) % this.rings.length)];
    r.m.visible = true; r.m.position.copy(p); r.t = 0; r.dur = dur; r.r = radius; r.flat = flat;
    r.m.material.uniforms.uColor.value.setRGB(col[0], col[1], col[2]);
    if (flat) r.m.rotation.set(-Math.PI / 2, 0, 0);
  }

  spawnDebris(p, n, scale) {
    for (let i = 0; i < n; i++) {
      const d = this.debris[this.dCursor]; this.dCursor = (this.dCursor + 1) % this.debris.length;
      randDir(d.v); d.v.multiplyScalar(rnd(8, 26) * Math.sqrt(scale));
      d.p.copy(p); d.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      d.w.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)); d.s = rnd(0.25, 0.7) * Math.sqrt(scale);
      d.max = d.life = rnd(0.8, 1.6); d.hot = 1;
    }
  }

  update(dt, camera, scrollSpeed) {
    const scrollDz = scrollSpeed * this.drift;
    this.heat *= Math.exp(-dt / 0.45);
    this.add.update(dt, scrollDz);
    this.smoke.update(dt, scrollDz);
    for (const f of this.flashes) {
      if (!f.s.visible) continue;
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1) { f.s.visible = false; continue; }
      const e = 1 - k;
      f.s.scale.setScalar(f.size * (0.6 + 0.6 * Math.sqrt(k)));
      f.s.material.color.copy(f.col).multiplyScalar(e * e);
      f.s.position.z += scrollDz * dt;
    }
    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.m.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3);
      r.m.scale.setScalar(Math.max(0.01, r.r * e));
      if (!r.flat) r.m.quaternion.copy(camera.quaternion);
      r.m.material.uniforms.uAlpha.value = (1 - k) * (1 - k) * 1.6;
      r.m.material.uniforms.uWidth.value = 0.03 + 0.07 * (1 - k);
      r.m.position.z += scrollDz * dt;
    }
    const { m4, q, sv } = this;
    let dirty = false;
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      if (d.life <= 0) continue;
      d.life -= dt; dirty = true;
      if (d.life <= 0) { m4.makeScale(0, 0, 0); this.debrisMesh.setMatrixAt(i, m4); continue; }
      d.v.multiplyScalar(Math.max(0, 1 - 0.8 * dt));
      d.p.addScaledVector(d.v, dt); d.p.z += scrollDz * dt;
      d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; d.r.z += d.w.z * dt;
      q.setFromEuler(d.r);
      const k = d.life / d.max;
      sv.setScalar(d.s * Math.min(1, k * 2.5));
      m4.compose(d.p, q, sv);
      this.debrisMesh.setMatrixAt(i, m4);
      if (d.hot > 0 && Math.random() < dt * 30) {
        const c = PAL.fire;
        this.add.spawn(d.p.x, d.p.y, d.p.z, 0, 0, 0, 0.3, 0.9 * d.s + 0.3, 0.1, c[0][0], c[0][1], c[0][2], c[1][0], c[1][1], c[1][2], 0, 0.8 * k);
      }
    }
    if (dirty) this.debrisMesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.add.clear(); this.smoke.clear(); this.heat = 0;
    for (const f of this.flashes) f.s.visible = false;
    for (const r of this.rings) r.m.visible = false;
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.debris.length; i++) { this.debris[i].life = 0; this.debrisMesh.setMatrixAt(i, m); }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
  }
}

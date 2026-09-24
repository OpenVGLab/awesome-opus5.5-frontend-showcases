import * as THREE from 'three';
import { glowTexture } from './fx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const hdr = (r, g, b) => new THREE.Color(r, g, b);
const WHITE = new THREE.Color(1, 1, 1);

function mesh(geo, mat, p, r, s) {
  const m = new THREE.Mesh(geo, mat);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  if (s) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]); }
  return m;
}
const alongZ = (g) => { g.rotateX(Math.PI / 2); return g; };

// Flat shape in (x, forward) extruded upward; forward maps to -z.
function plate(points, depth, bevel = 0.04) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -depth / 2, 0);
  return g;
}

export class Models {
  constructor(envMap) {
    const std = (o) => new THREE.MeshStandardMaterial({ envMap, envMapIntensity: 1.2, flatShading: true, ...o });
    this.M = {
      hullW: std({ color: 0xc4cedc, map: this.panelTexture(), metalness: 0.45, roughness: 0.36 }),
      hullD: std({ color: 0x1b2331, metalness: 0.75, roughness: 0.36 }),
      accent: std({ color: 0x1d68ff, metalness: 0.5, roughness: 0.3, emissive: 0x0b2c9a, emissiveIntensity: 0.6 }),
      canopy: std({ color: 0x06101c, metalness: 0.95, roughness: 0.05, emissive: 0x1a5cff, emissiveIntensity: 0.45, flatShading: false }),
      glowC: new THREE.MeshBasicMaterial({ color: hdr(0.7, 2.4, 4.4) }),
      nozzle: new THREE.MeshBasicMaterial({ color: hdr(0.35, 1.1, 2.2) }),
      glowR: new THREE.MeshBasicMaterial({ color: hdr(4, 0.3, 0.3) }),
      glowG: new THREE.MeshBasicMaterial({ color: hdr(0.3, 4, 1.2) }),
      eHull: std({ color: 0x4d4068, metalness: 0.5, roughness: 0.4 }),
      eArmor: std({ color: 0xb4aecb, metalness: 0.45, roughness: 0.38 }),
      eGlow: new THREE.MeshBasicMaterial({ color: hdr(4.2, 0.55, 2.0) }),
      eEye: new THREE.MeshBasicMaterial({ color: hdr(5.5, 1.0, 0.35) }),
      eCore: std({ color: 0x2a1208, metalness: 0.2, roughness: 0.5, emissive: 0xff6a1a, emissiveIntensity: 2.4 }),
      bArmor: std({ color: 0x9ba2b8, metalness: 0.5, roughness: 0.42 }),
      bHull: std({ color: 0x353b4e, metalness: 0.55, roughness: 0.45 }),
      bTrim: std({ color: 0x5e1a2a, metalness: 0.6, roughness: 0.38, emissive: 0x3a0612, emissiveIntensity: 0.6 }),
      bGlow: new THREE.MeshBasicMaterial({ color: hdr(4.5, 0.45, 0.8) }),
      bGlowO: new THREE.MeshBasicMaterial({ color: hdr(5, 2.1, 0.4) }),
      bGlowB: new THREE.MeshBasicMaterial({ color: hdr(0.6, 1.6, 4.5) }),
    };
    this.M.bCore = std({ color: 0x1a0306, metalness: 0.3, roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 2.6, emissiveMap: this.eyeTexture(), flatShading: false });
    this.M.mCore = std({ color: 0x220405, metalness: 0.3, roughness: 0.4, emissive: 0xff3322, emissiveIntensity: 2.4, flatShading: false });
    this.glowTex = glowTexture(128);
    this.protos = {
      dart: this.buildDart(), orb: this.buildOrb(), heavy: this.buildHeavy(), missile: this.buildMissile(),
    };
    this.protos.dart.scale.setScalar(1.4);
    this.protos.orb.scale.setScalar(1.35);
    this.protos.heavy.scale.setScalar(1.5);
    this.protos.missile.scale.setScalar(1.2);
  }

  eyeTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#2a0205'; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${140 + Math.random() * 80},20,30,${0.15 + Math.random() * 0.3})`;
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath(); const y = Math.random() * 512; g.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + (Math.random() - 0.5) * 30);
      g.stroke();
    }
    const cx = 256, cy = 256;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 120);
    gr.addColorStop(0, '#fff6d0'); gr.addColorStop(0.18, '#ffcf40'); gr.addColorStop(0.42, '#ff5a14'); gr.addColorStop(0.75, '#c8102c'); gr.addColorStop(1, 'rgba(90,0,10,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 120, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,220,120,.8)'; g.lineWidth = 3;
    for (const r of [34, 58, 84, 104]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); g.lineTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100); g.stroke(); }
    g.fillStyle = '#050000'; g.beginPath(); g.ellipse(cx, cy, 11, 52, 0, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }

  // Tileable hull plating; UVs are in model units, so repeat sets the panel scale.
  panelTexture() {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    let seed = 90210;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rects = [];
    const split = (x, y, w, h, d) => {
      if (d >= 4 || w < 80 || h < 80 || (d > 1 && r() < 0.25)) { rects.push([x, y, w, h]); return; }
      const vert = w > h * 1.3 ? true : h > w * 1.3 ? false : r() < 0.5;
      const k = Math.round((vert ? w : h) * (0.32 + r() * 0.36));
      if (vert) { split(x, y, k, h, d + 1); split(x + k, y, w - k, h, d + 1); }
      else { split(x, y, w, k, d + 1); split(x, y + k, w, h - k, d + 1); }
    };
    split(0, 0, S, S, 0);
    for (const [x, y, w, h] of rects) {
      const v = (222 + r() * 33) | 0;
      g.fillStyle = `rgb(${v - 9},${v - 4},${v})`; g.fillRect(x, y, w, h);
      const sh = g.createLinearGradient(x, y, x + w * 0.4, y + h);
      sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(1, 'rgba(20,30,50,0.08)');
      g.fillStyle = sh; g.fillRect(x, y, w, h);
      const q = r();
      if (q < 0.16 && w > 100 && h > 90) {
        g.fillStyle = 'rgb(128,138,156)'; g.fillRect(x + 14, y + 14, w - 28, h - 28);
        g.strokeStyle = 'rgba(40,48,62,0.7)'; g.lineWidth = 1.5; g.strokeRect(x + 14, y + 14, w - 28, h - 28);
      } else if (q < 0.3 && w > 70 && h > 60) {
        const vw = Math.min(70, w - 24), vx = x + 12;
        g.fillStyle = 'rgba(34,40,54,0.85)';
        for (let i = 0; i < 6; i++) g.fillRect(vx, y + 14 + i * 7, vw, 3);
      } else if (q < 0.38 && w > 90) {
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? 'rgb(40,44,56)' : 'rgb(255,140,50)';
          g.beginPath(); const sx = x + 14 + i * 9;
          g.moveTo(sx, y + h - 26); g.lineTo(sx + 9, y + h - 26); g.lineTo(sx + 3, y + h - 14); g.lineTo(sx - 6, y + h - 14); g.fill();
        }
      } else if (q < 0.5) {
        g.fillStyle = r() < 0.5 ? 'rgb(56,200,255)' : 'rgb(255,70,150)';
        g.fillRect(x + w - 34, y + 10, 22, 5);
      }
      if (r() < 0.45) {
        g.fillStyle = 'rgba(60,70,88,0.55)';
        for (let px = x + 8; px < x + w - 6; px += 11) { g.beginPath(); g.arc(px, y + 6, 1.4, 0, Math.PI * 2); g.fill(); }
      }
    }
    for (const [x, y, w, h] of rects) {
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + 2.5, y + h - 2); g.lineTo(x + 2.5, y + 2.5); g.lineTo(x + w - 2, y + 2.5); g.stroke();
      g.strokeStyle = 'rgba(34,42,56,0.9)'; g.lineWidth = 2.4; g.strokeRect(x, y, w, h);
    }
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(40,50,64,${0.03 + r() * 0.06})`;
      g.fillRect(r() * S, r() * S, 1 + r() * 2.5, 1 + r() * 2.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.6, 0.6); t.anisotropy = 8;
    return t;
  }

  glowSprite(color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(size);
    return s;
  }

  // ------------------------------------------------------------------ player
  buildPlayer() {
    const M = this.M, root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const pts = [[0, 2.7], [0.2, 2.1], [0.44, 1.1], [0.62, -0.1], [0.62, -1.1], [0.5, -1.9], [0.0, -2.05]].map(([r, y]) => new THREE.Vector2(r, y));
    const fus = new THREE.LatheGeometry(pts, 6); fus.rotateX(-Math.PI / 2); fus.rotateZ(Math.PI / 6);
    const fuv = fus.attributes.uv;
    for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 3.4, fuv.getY(i) * 4.8);
    body.add(mesh(fus, M.hullW, [0, 0, 0], null, [1.2, 0.62, 1]));
    body.add(mesh(new THREE.BoxGeometry(0.5, 0.2, 2.6), M.hullD, [0, 0.26, 0.55]));
    body.add(mesh(new THREE.SphereGeometry(0.5, 20, 12), M.canopy, [0, 0.3, -0.55], null, [0.72, 0.55, 1.9]));
    const wing = plate([[0.3, 1.0], [2.55, -0.85], [2.62, -1.4], [0.3, -1.7]], 0.1);
    const stripe = new THREE.BoxGeometry(1.7, 0.05, 0.16);
    for (const s of [-1, 1]) {
      const w = mesh(wing, M.hullW, [0, -0.12, 0], [0, 0, s * -0.07], [s, 1, 1]);
      body.add(w);
      body.add(mesh(stripe, M.accent, [s * 1.5, -0.1, 0.12], [0, s * -0.69, s * -0.07]));
      body.add(mesh(alongZ(new THREE.CylinderGeometry(0.3, 0.37, 1.6, 10)), M.hullD, [s * 0.58, -0.04, 1.25]));
      body.add(mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 18), M.glowC, [s * 0.58, -0.04, 2.06]));
      body.add(mesh(new THREE.CircleGeometry(0.26, 18), M.nozzle, [s * 0.58, -0.04, 2.07]));
      body.add(mesh(alongZ(new THREE.CylinderGeometry(0.07, 0.08, 1.5, 6)), M.hullD, [s * 2.52, -0.1, -0.65]));
      body.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), M.glowC, [s * 2.52, -0.1, -1.42]));
      body.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), s < 0 ? M.glowR : M.glowG, [s * 2.62, -0.1, 0.6]));
      body.add(mesh(new THREE.BoxGeometry(0.06, 0.85, 0.95), M.hullW, [s * 0.42, 0.52, 1.2], [-0.35, 0, s * -0.38]));
      body.add(mesh(new THREE.BoxGeometry(0.07, 0.3, 0.5), M.accent, [s * 0.5, 0.78, 1.42], [-0.35, 0, s * -0.38]));
    }
    const flameMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform float uPower; varying vec2 vUv;
        void main(){ float t = 1.0 - vUv.y; float fl = 0.8 + 0.2 * sin(uTime * 60.0 + t * 20.0);
          vec3 c = mix(vec3(0.2, 0.1, 0.8), vec3(0.45, 0.95, 1.5), pow(t, 2.0)) * fl * uPower;
          gl_FragColor = vec4(c * pow(t, 1.6) * 0.75, 1.0); }`,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const flameGeo = new THREE.ConeGeometry(0.25, 2.4, 12, 1, true); flameGeo.rotateX(Math.PI / 2); flameGeo.translate(0, 0, 1.2);
    const flames = [];
    for (const s of [-1, 1]) { const f = mesh(flameGeo, flameMat, [s * 0.58, -0.04, 2.08]); f.renderOrder = 30; body.add(f); flames.push(f); }
    const core = this.glowSprite(hdr(1.2, 3.2, 4), 0.75);
    core.material.depthTest = false; core.renderOrder = 99; core.position.set(0, 0.1, 0);
    root.add(core);
    body.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    return { root, body, flames, flameMat, core, guns: [V(-2.52, -0.1, -1.5), V(2.52, -0.1, -1.5)], nozzles: [V(-0.58, -0.04, 2.3), V(0.58, -0.04, 2.3)] };
  }

  // ------------------------------------------------------------------ zako
  buildDart() {
    const M = this.M, g = new THREE.Group();
    g.add(mesh(new THREE.OctahedronGeometry(1, 0), M.eHull, null, null, [0.75, 0.45, 1.9]));
    g.add(mesh(new THREE.OctahedronGeometry(1, 0), M.eArmor, [0, 0.22, -0.3], null, [0.4, 0.3, 1.1]));
    const blade = plate([[0.3, -0.9], [2.2, -1.9], [2.3, -1.3], [0.4, 0.9]], 0.12);
    for (const s of [-1, 1]) {
      g.add(mesh(blade, M.eHull, [0, 0, 0], [0, 0, s * 0.12], [s, 1, 1]));
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 2.1), M.eGlow, [s * 1.25, 0.05, 1.4], [0, s * 1.09, 0]));
    }
    g.add(mesh(new THREE.SphereGeometry(0.3, 12, 8), M.eEye, [0, 0.05, 1.75]));
    g.add(mesh(new THREE.SphereGeometry(0.28, 8, 6), M.eGlow, [0, 0, -1.9]));
    return g;
  }

  buildOrb() {
    const M = this.M, g = new THREE.Group();
    const core = mesh(new THREE.IcosahedronGeometry(0.85, 0), M.eCore); core.name = 'spin';
    g.add(core);
    const ring = new THREE.Group(); ring.name = 'ring';
    ring.add(mesh(new THREE.TorusGeometry(1.75, 0.24, 6, 24), M.eHull));
    ring.add(mesh(new THREE.TorusGeometry(1.75, 0.07, 4, 32), M.eGlow, [0, 0, 0.22]));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const sp = mesh(new THREE.ConeGeometry(0.3, 1.2, 5), M.eArmor, [Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0], [0, 0, a - Math.PI / 2]);
      ring.add(sp);
    }
    g.add(ring);
    for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(1.15, 12, 8, 0, Math.PI * 2, 0, 1.0), M.eArmor, [0, 0, s * 0.35], [s * Math.PI / 2, 0, 0], [1, 0.6, 1]));
    return g;
  }

  buildHeavy() {
    const M = this.M, g = new THREE.Group();
    g.add(mesh(alongZ(new THREE.CylinderGeometry(1.9, 2.4, 2.8, 6)), M.eArmor, null, [0, 0, Math.PI / 6]));
    g.add(mesh(alongZ(new THREE.CylinderGeometry(1.5, 1.9, 0.6, 6)), M.eHull, [0, 0, 1.6], [0, 0, Math.PI / 6]));
    for (const [x, y] of [[0, 0.75], [-0.7, -0.4], [0.7, -0.4]]) {
      g.add(mesh(alongZ(new THREE.CylinderGeometry(0.22, 0.26, 1.6, 8)), M.eHull, [x, y, 2.3]));
      g.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), M.eEye, [x, y, 3.1]));
    }
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(2.4, 0.5, 3.2), M.eHull, [s * 2.9, 0, -0.2], [0, 0, s * -0.25]));
      g.add(mesh(new THREE.BoxGeometry(0.25, 0.25, 2.6), M.eGlow, [s * 3.9, -0.28, 0], [0, 0, s * -0.25]));
      g.add(mesh(new THREE.BoxGeometry(1.2, 1.6, 0.3), M.eCore, [s * 1.8, 0, 0.6]));
    }
    g.add(mesh(new THREE.SphereGeometry(0.55, 12, 8), M.eEye, [0, 0, 1.95], null, [1, 1, 0.5]));
    return g;
  }

  buildMissile() {
    const M = this.M, g = new THREE.Group();
    g.add(mesh(alongZ(new THREE.CylinderGeometry(0.28, 0.28, 2.0, 8)), M.eArmor));
    g.add(mesh(alongZ(new THREE.ConeGeometry(0.28, 0.7, 8)), M.eEye, [0, 0, 1.35]));
    for (let k = 0; k < 4; k++) g.add(mesh(new THREE.BoxGeometry(0.06, 0.8, 0.6), M.eHull, [0, 0, -0.8], [0, 0, (k * Math.PI) / 2]));
    g.add(mesh(new THREE.SphereGeometry(0.25, 8, 6), M.eGlow, [0, 0, -1.1]));
    return g;
  }

  instantiate(name) {
    const obj = this.protos[name].clone(true);
    return this.own(obj);
  }

  own(obj) {
    const map = new Map(), mats = [];
    obj.traverse((o) => {
      if (!o.isMesh || !o.material.isMeshStandardMaterial) return;
      let m = map.get(o.material);
      if (!m) { m = o.material.clone(); m.userData.e0 = m.emissive.clone(); m.userData.i0 = m.emissiveIntensity; map.set(o.material, m); mats.push(m); }
      o.material = m;
    });
    obj.userData.mats = mats;
    return obj;
  }

  static flash(obj, k) {
    for (const m of obj.userData.mats) {
      m.emissive.copy(m.userData.e0).lerp(WHITE, Math.min(1, k));
      m.emissiveIntensity = m.userData.i0 + k * 2.2;
    }
  }

  static dispose(obj) { for (const m of obj.userData.mats || []) m.dispose(); }

  // ------------------------------------------------------------------ mid boss
  buildMidBoss() {
    const M = this.M, g = new THREE.Group();
    g.add(mesh(alongZ(new THREE.CylinderGeometry(5.2, 6.4, 14, 6)), M.bArmor, [0, 0, 0], [0, 0, Math.PI / 6], [1.5, 0.55, 1]));
    g.add(mesh(alongZ(new THREE.ConeGeometry(6.0, 6.5, 6)), M.bHull, [0, 0, 10.2], [0, 0, Math.PI / 6], [1.45, 0.5, 1]));
    g.add(mesh(new THREE.BoxGeometry(6, 2.2, 9), M.bHull, [0, 3.2, -1.5]));
    g.add(mesh(new THREE.BoxGeometry(3.2, 1.6, 4), M.bArmor, [0, 4.8, -2.5]));
    g.add(mesh(new THREE.BoxGeometry(2.8, 0.25, 0.3), M.bGlowO, [0, 4.8, -0.45]));
    const core = mesh(new THREE.SphereGeometry(1.9, 28, 18), M.mCore, [0, 0.3, 13.9]);
    g.add(core);
    g.add(mesh(new THREE.TorusGeometry(2.4, 0.4, 8, 28), M.bArmor, [0, 0.3, 13.6]));
    for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.6, 0.6, 4), M.bArmor, [s * 2.2, 0.3, 12], [0, s * -0.25, 0]));
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(6, 1.6, 5), M.bHull, [s * 7.5, -0.4, 1], [0, 0, s * -0.12]));
      g.add(mesh(alongZ(new THREE.CylinderGeometry(2.2, 2.2, 12, 8)), M.bArmor, [s * 11, -0.8, 1.5], [0, 0, Math.PI / 8]));
      g.add(mesh(alongZ(new THREE.ConeGeometry(2.2, 3.5, 8)), M.bHull, [s * 11, -0.8, 9.2], [0, 0, Math.PI / 8]));
      g.add(mesh(new THREE.CircleGeometry(1.6, 16), M.bGlowB, [s * 11, -0.8, -4.55], [0, Math.PI, 0]));
      g.add(mesh(new THREE.BoxGeometry(0.35, 0.35, 10), M.bGlowO, [s * 13.1, -0.8, 1.5]));
      g.add(mesh(new THREE.BoxGeometry(0.4, 3.2, 5), M.bTrim, [s * 11, 2.2, -2.5], [0.3, 0, s * 0.2]));
      const tur = new THREE.Group(); tur.position.set(s * 11, 1.7, 4.5);
      tur.add(mesh(new THREE.SphereGeometry(1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.bHull));
      for (const bx of [-0.5, 0.5]) {
        tur.add(mesh(alongZ(new THREE.CylinderGeometry(0.22, 0.28, 2.8, 8)), M.bArmor, [bx, 0.55, 1.6]));
        tur.add(mesh(new THREE.SphereGeometry(0.24, 8, 6), M.bGlow, [bx, 0.55, 3.05]));
      }
      tur.name = s < 0 ? 'turL' : 'turR';
      g.add(tur);
    }
    for (let i = 0; i < 7; i++) g.add(mesh(new THREE.BoxGeometry(0.5, 0.2, 0.2), M.bGlowO, [(i - 3) * 1.6, -1.9, 6.5 - Math.abs(i - 3) * 0.8]));
    const out = this.own(g);
    return { group: out, core, turrets: [out.getObjectByName('turL'), out.getObjectByName('turR')] };
  }

  // ------------------------------------------------------------------ last boss
  buildFinalBoss() {
    const M = this.M, g = new THREE.Group();
    const coreGroup = new THREE.Group(); coreGroup.position.set(0, 0, 4);
    const core = mesh(new THREE.SphereGeometry(6, 48, 32), M.bCore);
    coreGroup.add(core);
    g.add(coreGroup);

    const petals = [];
    for (let k = 0; k < 4; k++) {
      const pg = new THREE.SphereGeometry(6.7, 20, 10, k * Math.PI / 2 + Math.PI / 4, Math.PI / 2 - 0.04, 0, 1.3);
      pg.rotateX(Math.PI / 2);
      pg.computeBoundingSphere();
      const c = pg.boundingSphere.center.clone(); c.z = 0; c.normalize();
      const pivot = new THREE.Group();
      pivot.add(mesh(pg, M.bArmor));
      const rib = mesh(new THREE.BoxGeometry(0.5, 0.5, 5), M.bGlow, [c.x * 5.6, c.y * 5.6, 3.6]);
      rib.lookAt(0, 0, 9); pivot.add(rib);
      pivot.userData.axis = V(-c.y, c.x, 0);
      pivot.userData.dir = c;
      coreGroup.add(pivot);
      petals.push(pivot);
    }

    const inner = new THREE.Group(); inner.position.z = 1.5;
    inner.add(mesh(new THREE.TorusGeometry(10.5, 1.2, 8, 48), M.bHull));
    inner.add(mesh(new THREE.TorusGeometry(10.5, 0.25, 6, 64), M.bGlow, [0, 0, 1.15]));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      inner.add(mesh(new THREE.BoxGeometry(2.6, 2.6, 3.4), M.bArmor, [Math.cos(a) * 10.5, Math.sin(a) * 10.5, 0], [0, 0, a]));
      inner.add(mesh(new THREE.SphereGeometry(0.45, 8, 6), M.bGlowO, [Math.cos(a) * 10.5, Math.sin(a) * 10.5, 1.8]));
    }
    g.add(inner);

    const outer = new THREE.Group(); outer.position.z = -1;
    outer.add(mesh(new THREE.TorusGeometry(16.5, 0.7, 6, 72), M.bArmor));
    outer.add(mesh(new THREE.TorusGeometry(16.5, 0.18, 4, 96), M.bGlow, [0, 0, 0.7]));
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      outer.add(mesh(new THREE.ConeGeometry(0.8, k % 3 === 0 ? 7 : 4, 5), M.bHull, [Math.cos(a) * (k % 3 === 0 ? 20.2 : 18.6), Math.sin(a) * (k % 3 === 0 ? 20.2 : 18.6), 0], [0, 0, a - Math.PI / 2]));
    }
    g.add(outer);

    g.add(mesh(alongZ(new THREE.CylinderGeometry(7.5, 4, 34, 8)), M.bHull, [0, 0, -20], [0, 0, Math.PI / 8]));
    g.add(mesh(alongZ(new THREE.CylinderGeometry(8.4, 8.4, 3, 8)), M.bTrim, [0, 0, -6], [0, 0, Math.PI / 8]));

    const turrets = [];
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(16, 5, 10), M.bArmor, [s * 18, 0.5, -3], [0, s * 0.08, s * -0.05]));
      g.add(mesh(new THREE.BoxGeometry(16, 1.2, 11), M.bTrim, [s * 18, 3.3, -3], [0, s * 0.08, s * -0.05]));
      g.add(mesh(new THREE.BoxGeometry(14, 3.4, 7), M.bHull, [s * 31, -1.8, -5], [0, s * 0.14, s * -0.14]));
      g.add(mesh(new THREE.BoxGeometry(14, 0.35, 0.4), M.bGlow, [s * 18, -1.7, 2.1], [0, s * 0.08, s * -0.05]));
      g.add(mesh(new THREE.BoxGeometry(12, 0.3, 0.35), M.bGlow, [s * 31, -3.2, -1.5], [0, s * 0.14, s * -0.14]));
      const blade = plate([[0, 4], [9, -2], [14, -14], [2, -6]], 1.0, 0.15);
      g.add(mesh(blade, M.bHull, [s * 36, -3, -8], [0, 0, s * -0.4 + (s < 0 ? Math.PI : 0)], [1, 1, 1]));
      for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(0.6, 0.6, 0.3), M.bGlowO, [s * (12 + i * 2.2), 2.2, 2.2]));
      for (const [tx, ty, tz] of [[s * 22, 4.2, 0], [s * 37, -2.4, -1.5]]) {
        const tur = new THREE.Group(); tur.position.set(tx, ty, tz);
        tur.add(mesh(new THREE.SphereGeometry(2.4, 16, 10), M.bArmor, null, null, [1, 0.8, 1]));
        tur.add(mesh(new THREE.TorusGeometry(2.4, 0.3, 6, 20), M.bTrim, [0, 0, 0.2]));
        const eye = mesh(new THREE.SphereGeometry(0.9, 12, 8), M.bGlow, [0, 0, 2.0]);
        tur.add(eye);
        for (const bx of [-0.9, 0.9]) tur.add(mesh(alongZ(new THREE.CylinderGeometry(0.28, 0.34, 3, 8)), M.bHull, [bx, -0.6, 2.2]));
        tur.userData.eye = eye;
        g.add(tur);
        turrets.push(tur);
      }
    }
    for (const s of [-1, 1]) {
      const fin = plate([[0, 0], [3, 1], [1.5, 16], [-0.5, 6]], 0.8, 0.12);
      g.add(mesh(fin, M.bArmor, [0, s * 7, -6], [Math.PI / 2 * s, 0, 0]));
      g.add(mesh(new THREE.BoxGeometry(0.4, 12, 0.4), M.bGlow, [0.6, s * 13, -5.2]));
    }
    const out = this.own(g);
    return { group: out, core, coreGroup, petals, inner, outer, turrets };
  }
}

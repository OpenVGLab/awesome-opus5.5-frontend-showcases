import * as THREE from 'three';
import { rand, pick, TAU, clamp, mat } from './util.js';
import * as L from './layout.js';

const birdMat = new THREE.MeshLambertMaterial({ color: '#4a433e' });
const birdBody = new THREE.SphereGeometry(1, 8, 6);
const wingGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.25, 0, 0, -0.2, 1, 0, -0.35, 0, 0, 0.25, 1, 0, -0.35, 0.9, 0, 0.05]), 3));
  g.computeVertexNormals();
  return g;
})();

function makeBird(scale = 1, color = null) {
  const b = new THREE.Group();
  const m = color ? new THREE.MeshLambertMaterial({ color }) : birdMat;
  const body = new THREE.Mesh(birdBody, m);
  body.scale.set(0.09, 0.08, 0.26);
  b.add(body);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    const mesh = new THREE.Mesh(wingGeo, new THREE.MeshLambertMaterial({ color: color || '#4a433e', side: THREE.DoubleSide }));
    mesh.scale.set(s * 0.5, 1, 0.5);
    w.add(mesh);
    b.add(w);
    wings.push(w);
  }
  const tail = new THREE.Mesh(birdBody, m);
  tail.scale.set(0.06, 0.02, 0.14);
  tail.position.z = -0.28;
  b.add(tail);
  b.scale.setScalar(scale);
  b.userData.wings = wings;
  return b;
}

const beakGeo = new THREE.ConeGeometry(1, 1, 6).rotateX(Math.PI / 2);
const sparrowPale = new THREE.MeshLambertMaterial({ color: '#dccbb0' });
const sparrowDark = new THREE.MeshLambertMaterial({ color: '#3a2e25' });
const sparrowWing = new THREE.MeshLambertMaterial({ color: '#5d4a3a', side: THREE.DoubleSide });

/* a right butterfly wing (forewing ahead, hindwing behind) hinged along the body at x = 0; mirror it for the left */
const butterflyWing = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.012);
  s.bezierCurveTo(0.05, -0.1, 0.16, -0.12, 0.17, -0.05);
  s.bezierCurveTo(0.175, -0.01, 0.12, 0, 0.07, 0.005);
  s.bezierCurveTo(0.14, 0.03, 0.12, 0.1, 0.06, 0.09);
  s.bezierCurveTo(0.03, 0.085, 0.01, 0.05, 0, 0.015);
  return new THREE.ShapeGeometry(s, 5).rotateX(-Math.PI / 2);
})();

/* a plump little ground bird; wings are groups so the flock flapping code can drive them */
function makeSparrow(color) {
  const b = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color });
  const add = (geo, mt, x, y, z, sx, sy, sz, rx = 0) => {
    const o = new THREE.Mesh(geo, mt);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.rotation.x = rx;
    b.add(o);
  };
  add(birdBody, m, 0, 0.03, 0, 0.075, 0.07, 0.11);
  add(birdBody, sparrowPale, 0, 0.015, 0.04, 0.062, 0.055, 0.075);
  add(birdBody, m, 0, 0.1, 0.085, 0.05, 0.05, 0.052);
  for (const s of [-1, 1]) add(birdBody, sparrowDark, s * 0.036, 0.11, 0.11, 0.011, 0.011, 0.011);
  add(beakGeo, sparrowDark, 0, 0.095, 0.145, 0.014, 0.014, 0.04);
  add(birdBody, sparrowDark, 0, 0.055, -0.13, 0.04, 0.012, 0.075, -0.35);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.x = s * 0.05;
    const mesh = new THREE.Mesh(wingGeo, sparrowWing);
    mesh.position.y = 0.05;
    mesh.scale.set(s * 0.3, 1, 0.4);
    w.add(mesh);
    b.add(w);
    wings.push(w);
  }
  b.scale.setScalar(1.5);
  b.userData.wings = wings;
  return b;
}

function flapBird(b, t, rate = 10, glide = 0) {
  const a = glide > 0.5 ? 0.12 + Math.sin(t * 2) * 0.05 : Math.sin(t * rate) * 0.9;
  b.userData.wings[0].rotation.z = a;
  b.userData.wings[1].rotation.z = -a;
}

function makeBiplane() {
  const g = new THREE.Group();
  const cream = mat('#efe6d2'), red = mat('#b8483d'), dark = mat('#4a3b2c');
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.22, 5.2, 10), cream);
  fus.rotation.x = Math.PI / 2;
  g.add(fus);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.6, 10), red);
  nose.rotation.x = Math.PI / 2; nose.position.z = 2.7;
  g.add(nose);
  for (const y of [-0.35, 0.95]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.1, 1.2), red);
    w.position.set(0, y, 0.7);
    g.add(w);
  }
  for (const x of [-2.4, 2.4]) for (const z of [0.3, 1.1]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.06), dark);
    s.position.set(x, 0.3, z);
    g.add(s);
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.9), red);
  fin.position.set(0, 0.55, -2.4);
  g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.7), red);
  stab.position.set(0, 0.1, -2.4);
  g.add(stab);
  for (const x of [-0.7, 0.7]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 10), dark);
    wh.rotation.z = Math.PI / 2; wh.position.set(x, -1.0, 1.2);
    g.add(wh);
  }
  const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat('#8a6a4b'));
  pilot.position.set(0, 0.55, -0.2);
  g.add(pilot);
  const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.7), mat('#f2eee6'));
  scarf.position.set(0, 0.42, -0.6);
  g.add(scarf);
  const prop = new THREE.Group();
  prop.position.z = 3.05;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.06), dark);
  prop.add(blade);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), new THREE.MeshBasicMaterial({ color: '#d8d0c0', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  prop.add(disc);
  g.add(prop);
  g.userData.prop = prop;
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

function makeBanner(text) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = '#f6efdf';
  c.fillRect(0, 0, 1024, 160);
  c.strokeStyle = '#b8483d'; c.lineWidth = 10;
  c.strokeRect(8, 8, 1008, 144);
  c.fillStyle = '#4a3b2c';
  c.font = 'italic 96px "IM Fell English", Georgia, serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 512, 86);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(19, 3, 24, 1);
  const m = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, m);
  mesh.userData.base = Float32Array.from(geo.attributes.position.array);
  return mesh;
}

function makeJet() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: '#f4f2ee' });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 14, 8), white);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 2.6), white);
  wing.position.z = 0.5;
  g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 2), white);
  tail.position.set(0, 1.5, -6);
  g.add(tail);
  return g;
}

/* A contrail ribbon that follows a jet across the sky */
function makeTrail(n = 48) {
  const pos = new Float32Array(n * 2 * 3);
  const col = new Float32Array(n * 2 * 4);
  const idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, m);
  mesh.frustumCulled = false;
  mesh.userData.pts = [];
  mesh.userData.n = n;
  return mesh;
}

export class Ambient {
  constructor(scene, world, audio, fx) {
    this.scene = scene;
    this.world = world;
    this.audio = audio;
    this.fx = fx;
    this.t = 0;
    this.flocks = [];
    this.planes = [];
    this.nextFlock = 4;
    this.nextPlane = 14;
    this.planeCount = 0;
    this.smokeT = 0;

    // buzzards circling high above the farm
    this.circlers = [0, 1].map((i) => {
      const b = makeBird(3.2, '#5b4f45');
      scene.add(b);
      return { b, r: 38 + i * 16, h: 58 + i * 9, sp: 0.09 + i * 0.03, a: i * 2.5, cx: -8 + i * 20, cz: -10 + i * 14 };
    });

    // sparrows hopping about on the ground
    this.sparrowSpots = [[-8, -3], [55, -12], [-26, 22], [6, 3], [-4, 30], [30, 28], [20, -30]];
    this.sparrows = [];
    for (let i = 0; i < 4; i++) this._spawnSparrows(this.sparrowSpots[i]);

    // butterflies
    this.butterflies = [];
    const spots = [[18, -44], [-45, 50], [-28, 26], [58, -8], [2, 36], [34, 22], [-6, 14], [14, -8]];
    const cols = ['#f4efe0', '#efd562', '#f0a64a', '#9fb4dd', '#f4efe0', '#efd562'];
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const wm = new THREE.MeshLambertMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide });
      const wings = [];
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        const m = new THREE.Mesh(butterflyWing, wm);
        m.scale.x = s;
        w.add(m);
        g.add(w);
        wings.push(w);
      }
      const home = spots[i % spots.length];
      g.position.set(home[0] + rand(-4, 4), world.heightAt(home[0], home[1]) + 1, home[1] + rand(-4, 4));
      scene.add(g);
      this.butterflies.push({ g, wings, home, vel: new THREE.Vector3(), t: rand(0, 10) });
    }
  }

  _spawnSparrows(spot) {
    const n = 3 + Math.floor(Math.random() * 3);
    const group = { birds: [], state: 'ground', t: 0, spot };
    for (let i = 0; i < n; i++) {
      const b = makeSparrow(pick(['#8a6d55', '#9a7d62', '#7d6450']));
      const x = spot[0] + rand(-2.5, 2.5), z = spot[1] + rand(-2.5, 2.5);
      b.position.set(x, this.world.heightAt(x, z) + 0.06, z);
      b.rotation.y = rand(0, TAU);
      b.userData.hop = rand(0, 2);
      b.userData.vel = new THREE.Vector3();
      this.scene.add(b);
      group.birds.push(b);
    }
    this.sparrows.push(group);
  }

  _spawnFlock() {
    const a = rand(0, TAU);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const start = dir.clone().multiplyScalar(-260).addScaledVector(side, rand(-80, 80));
    const h = rand(24, 46);
    const n = 3 + Math.floor(Math.random() * 6);
    const birds = [];
    for (let i = 0; i < n; i++) {
      const b = makeBird(rand(1.3, 1.7));
      const row = Math.ceil(i / 2), s = i % 2 ? 1 : -1;
      b.userData.off = new THREE.Vector3(side.x * s * row * 2.2, rand(-0.6, 0.6), side.z * s * row * 2.2).addScaledVector(dir, -row * 1.8);
      b.userData.ph = rand(0, TAU);
      this.scene.add(b);
      birds.push(b);
    }
    this.flocks.push({ birds, pos: start.setY(h), dir, speed: rand(7, 11), t: 0 });
  }

  _spawnPlane(first = false) {
    const jet = !first && Math.random() < 0.3;
    const a = rand(0, TAU);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const span = jet ? 1300 : 520;
    const start = dir.clone().multiplyScalar(-span / 2).addScaledVector(side, rand(-60, 60));
    const h = jet ? rand(320, 420) : rand(38, 60);
    const mesh = jet ? makeJet() : makeBiplane();
    mesh.position.copy(start).setY(h);
    mesh.lookAt(mesh.position.clone().add(dir));
    this.scene.add(mesh);
    const p = { mesh, dir, speed: jet ? 70 : rand(19, 24), span, jet, t: 0, dist: 0, h };
    p.vel = dir.clone().multiplyScalar(p.speed);
    p.engine = this.audio.engine(jet ? 'jet' : 'biplane');
    if (!jet && (first || Math.random() < 0.55)) {
      const texts = ['Hello from the sky!', 'Have a lovely day!', 'Bramblewick Fair on Sunday', 'Hooray for the farm!'];
      const banner = makeBanner(first ? texts[0] : pick(texts));
      this.scene.add(banner);
      p.banner = banner;
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), mat('#6b5a48'));
      this.scene.add(rope);
      p.rope = rope;
    }
    if (jet) { p.trail = makeTrail(); this.scene.add(p.trail); }
    this.planes.push(p);
  }

  update(dt, focus, camera) {
    this.t += dt;
    const t = this.t;

    // flocks
    this.nextFlock -= dt;
    if (this.nextFlock < 0) { this.nextFlock = rand(14, 32); this._spawnFlock(); }
    for (let i = this.flocks.length - 1; i >= 0; i--) {
      const f = this.flocks[i];
      f.t += dt;
      f.pos.addScaledVector(f.dir, f.speed * dt);
      const wave = Math.sin(f.t * 0.3) * 6;
      f.birds.forEach((b, k) => {
        b.position.copy(f.pos).add(b.userData.off);
        b.position.x += -f.dir.z * wave;
        b.position.z += f.dir.x * wave;
        b.position.y += Math.sin(f.t * 1.3 + k) * 0.5;
        b.lookAt(b.position.x + f.dir.x, b.position.y, b.position.z + f.dir.z);
        flapBird(b, f.t + b.userData.ph, 9, Math.sin(f.t * 0.5 + k) > 0.6 ? 1 : 0);
      });
      if (f.pos.length() > 300 && f.t > 5) {
        f.birds.forEach((b) => this.scene.remove(b));
        this.flocks.splice(i, 1);
      }
    }

    for (const c of this.circlers) {
      c.a += c.sp * dt;
      const x = c.cx + Math.cos(c.a) * c.r, z = c.cz + Math.sin(c.a) * c.r;
      c.b.position.set(x, c.h + Math.sin(t * 0.4 + c.r) * 2, z);
      c.b.lookAt(c.cx + Math.cos(c.a + 0.1) * c.r, c.b.position.y, c.cz + Math.sin(c.a + 0.1) * c.r);
      c.b.rotateZ(-0.35);
      flapBird(c.b, t * 1.3 + c.r, 5, Math.sin(t * 0.2 + c.r) > -0.7 ? 1 : 0);
    }

    // aeroplanes
    this.nextPlane -= dt;
    if (this.nextPlane < 0) {
      this._spawnPlane(this.planeCount === 0);
      this.planeCount++;
      this.nextPlane = rand(45, 95);
    }
    for (let i = this.planes.length - 1; i >= 0; i--) {
      const p = this.planes[i];
      p.t += dt;
      p.mesh.position.addScaledVector(p.dir, p.speed * dt);
      p.mesh.position.y = p.h + Math.sin(p.t * 0.25) * (p.jet ? 0 : 2.5);
      p.dist += p.speed * dt;
      if (!p.jet) {
        p.mesh.userData.prop.rotation.z += dt * 40;
        p.mesh.rotation.z = Math.sin(p.t * 0.3) * 0.08;
      }
      if (p.engine) { p.engine.pos = p.mesh.position; p.engine.vel = p.vel; }
      if (p.banner) {
        const back = p.mesh.position.clone().addScaledVector(p.dir, -19);
        p.banner.position.copy(back);
        p.banner.position.y -= 1.2;
        const side = new THREE.Vector3(-p.dir.z, 0, p.dir.x);
        if (camera && (camera.position.x - back.x) * side.x + (camera.position.z - back.z) * side.z < 0) side.negate();
        p.banner.lookAt(back.clone().add(side));
        const base = p.banner.userData.base;
        const pa = p.banner.geometry.attributes.position;
        for (let k = 0; k < pa.count; k++) {
          const x = base[k * 3];
          pa.setZ(k, Math.sin(x * 0.5 + p.t * 6) * 0.35 * (0.3 + Math.abs(x) / 9.5));
        }
        pa.needsUpdate = true;
        const ropeStart = p.mesh.position.clone().addScaledVector(p.dir, -2.6);
        const ropeEnd = back.clone().addScaledVector(p.dir, 9.5);
        ropeEnd.y -= 1.2;
        p.rope.position.copy(ropeStart).lerp(ropeEnd, 0.5);
        p.rope.scale.y = ropeStart.distanceTo(ropeEnd);
        p.rope.lookAt(ropeEnd);
        p.rope.rotateX(Math.PI / 2);
      }
      if (p.trail) this._updateTrail(p, dt);
      if (p.dist > p.span) {
        this.scene.remove(p.mesh);
        if (p.banner) { this.scene.remove(p.banner); this.scene.remove(p.rope); }
        if (p.trail) this.scene.remove(p.trail);
        if (p.engine) p.engine.stop();
        this.planes.splice(i, 1);
      }
    }

    // sparrows: peck and hop, scatter when someone big comes close
    for (let gi = this.sparrows.length - 1; gi >= 0; gi--) {
      const g = this.sparrows[gi];
      g.t += dt;
      if (g.state === 'ground') {
        const cx = g.birds[0].position.x, cz = g.birds[0].position.z;
        const d = Math.hypot(focus.x - cx, focus.z - cz);
        const running = focus.speed > 4;
        if (d < (running ? 7 : 4.2)) {
          g.state = 'fly';
          g.t = 0;
          const away = new THREE.Vector3(cx - focus.x, 0, cz - focus.z).normalize();
          g.birds.forEach((b) => b.userData.vel.set(away.x * rand(4, 7) + rand(-1, 1), rand(3, 5), away.z * rand(4, 7) + rand(-1, 1)));
          this.audio.chirp({ kind: 0, gain: 1.2 });
          this.audio.sfx('flap', { pos: g.birds[0].position, gain: 0.8 });
        }
        for (const b of g.birds) {
          b.userData.hop -= dt;
          if (b.userData.hop < 0) {
            b.userData.hop = rand(0.4, 1.6);
            if (Math.random() < 0.5) {
              b.rotation.y += rand(-1.2, 1.2);
              const nx = b.position.x + Math.sin(b.rotation.y) * 0.3, nz = b.position.z + Math.cos(b.rotation.y) * 0.3;
              if (Math.hypot(nx - g.spot[0], nz - g.spot[1]) < 3.5) { b.position.x = nx; b.position.z = nz; }
            }
            b.userData.peck = 0.25;
          }
          b.userData.peck = Math.max(0, (b.userData.peck || 0) - dt);
          const hopY = b.userData.hop > 0 && b.userData.peck > 0.15 ? Math.sin((0.25 - b.userData.peck) / 0.1 * Math.PI) * 0.06 : 0;
          b.position.y = this.world.heightAt(b.position.x, b.position.z) + 0.06 + hopY;
          b.rotation.x = b.userData.peck > 0 && b.userData.peck < 0.15 ? 0.5 : 0;
          b.userData.wings.forEach((w, k) => { w.scale.set(0.22, 1, 1); w.rotation.z = (k ? -1 : 1) * 0.5; w.position.y = 0.03; });
        }
      } else {
        for (const b of g.birds) {
          b.userData.wings.forEach((w) => { w.scale.set(1, 1, 1); w.position.y = 0; });
          b.position.addScaledVector(b.userData.vel, dt);
          b.userData.vel.y += dt * 0.5;
          b.lookAt(b.position.clone().add(b.userData.vel));
          flapBird(b, g.t * 3 + b.userData.hop, 22);
        }
        if (g.t > 7) {
          g.birds.forEach((b) => this.scene.remove(b));
          this.sparrows.splice(gi, 1);
          const spot = pick(this.sparrowSpots.filter((s) => Math.hypot(s[0] - focus.x, s[1] - focus.z) > 25));
          setTimeout(() => this._spawnSparrows(spot || this.sparrowSpots[0]), 9000);
        }
      }
    }

    // butterflies
    for (const bf of this.butterflies) {
      bf.t += dt;
      const g = bf.g;
      const home = new THREE.Vector3(bf.home[0], 0, bf.home[1]);
      const toHome = home.sub(g.position).setY(0);
      bf.vel.x += (Math.sin(bf.t * 1.7 + g.id) * 1.6 + toHome.x * 0.05) * dt * 3;
      bf.vel.z += (Math.cos(bf.t * 1.3 + g.id * 0.7) * 1.6 + toHome.z * 0.05) * dt * 3;
      bf.vel.multiplyScalar(Math.exp(-1.2 * dt));
      if (camera) {
        // veer off before drifting close enough to fill the view
        const dx = g.position.x - camera.position.x, dz = g.position.z - camera.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 4) {
          const push = ((4 - d) * 8 * dt) / Math.max(d, 0.2);
          bf.vel.x += dx * push;
          bf.vel.z += dz * push;
        }
      }
      g.position.addScaledVector(bf.vel, dt);
      const gy = this.world.heightAt(g.position.x, g.position.z);
      g.position.y = gy + 0.8 + Math.sin(bf.t * 2.3) * 0.4 + Math.sin(bf.t * 7) * 0.08;
      g.rotation.y = Math.atan2(bf.vel.x, bf.vel.z);
      const f = Math.sin(bf.t * 22) * 1.1;
      bf.wings[0].rotation.z = f;
      bf.wings[1].rotation.z = -f;
    }

    // chimney smoke
    this.smokeT -= dt;
    if (this.smokeT < 0) {
      this.smokeT = 0.35;
      const near = this.world.smoke.filter((p) => Math.hypot(p.x - focus.x, p.z - focus.z) < 110);
      if (near.length) {
        const p = pick(near);
        this.fx.spawn('smoke', p, { vel: new THREE.Vector3(0.35, 0.9, 0.15), life: 5, size: 0.7, grow: 2.4, grav: 0.05, drag: 0.2, alpha: 0.55, spin: rand(-0.3, 0.3), fadeIn: 0.6 });
      }
    }
  }

  _updateTrail(p, dt) {
    const tr = p.trail;
    const pts = tr.userData.pts;
    p.trailT = (p.trailT || 0) - dt;
    if (p.trailT <= 0) {
      p.trailT = 0.35;
      pts.unshift({ pos: p.mesh.position.clone().addScaledVector(p.dir, -8), age: 0 });
      if (pts.length > tr.userData.n) pts.pop();
    }
    for (const q of pts) q.age += dt;
    const pos = tr.geometry.attributes.position, col = tr.geometry.attributes.color;
    const side = new THREE.Vector3(-p.dir.z, 0, p.dir.x);
    for (let i = 0; i < tr.userData.n; i++) {
      const q = pts[Math.min(i, pts.length - 1)];
      if (!q) break;
      const w = 1.2 + q.age * 0.8;
      const a = pts.length > 1 ? clamp(1 - q.age / 17, 0, 1) * (i === 0 ? 0 : 0.75) : 0;
      pos.setXYZ(i * 2, q.pos.x + side.x * w, q.pos.y, q.pos.z + side.z * w);
      pos.setXYZ(i * 2 + 1, q.pos.x - side.x * w, q.pos.y, q.pos.z - side.z * w);
      col.setXYZW(i * 2, 1, 1, 1, a);
      col.setXYZW(i * 2 + 1, 1, 1, 1, a);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
}

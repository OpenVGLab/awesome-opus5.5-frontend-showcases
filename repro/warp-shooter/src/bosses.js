import * as THREE from 'three';
import { Models } from './models.js';

const T1 = new THREE.Vector3(), T2 = new THREE.Vector3(), T3 = new THREE.Vector3();
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

class BossBase {
  constructor(game) {
    this.g = game; this.s = game.s;
    this.t = 0; this.pat = 0; this.patT = 0; this.prevPatT = -1; this.flash = 0; this.parts = [];
  }
  at(t) { return this.prevPatT < t && this.patT >= t; }
  nextPat() { this.pat++; this.patT = 0; this.prevPatT = -1; this.acc = 0; }
  addPart(o) { const p = this.g.addPart({ boss: this, ghost: true, ...o }); p.prev = v3(0, 0, -400); this.parts.push(p); return p; }
  syncParts(dt) {
    this.group.updateMatrixWorld(true);
    for (const p of this.parts) {
      p.prev.copy(p.p);
      if (p.off) p.p.copy(p.off).applyMatrix4(p.anchor.matrixWorld); else p.anchor.getWorldPosition(p.p);
      if (dt > 0) p.v.subVectors(p.p, p.prev).divideScalar(dt);
    }
  }
  setGhost(v) { for (const p of this.parts) p.ghost = v; }
  partHit() { this.flash = Math.max(this.flash, 0.6); }
  randomPoint(ext, out) {
    out.set(rnd(-ext[0], ext[0]), rnd(-ext[1], ext[1]), rnd(-ext[2], ext[2]));
    return out.applyMatrix4(this.group.matrixWorld);
  }
  removeAll() {
    for (const p of this.parts) p.alive = false;
    this.s.scene.remove(this.group);
    Models.dispose(this.group);
  }
  destroy() { this.removeAll(); if (this.beam) this.s.scene.remove(this.beam.mesh, this.beam.glow); }
  beamThreat() { return null; }
}

// ====================================================================== mid boss
export class MidBoss extends BossBase {
  constructor(game) {
    super(game);
    const b = this.s.models.buildMidBoss();
    this.group = b.group; this.core = b.core; this.turrets = b.turrets;
    const S = 1.7;
    this.group.scale.setScalar(S);
    this.group.position.set(0, 16, -360);
    this.s.scene.add(this.group);
    this.kind = 'mid'; this.tag = 'MID BOSS'; this.name = '中型戦艦 GOLIATH'; this.style = '';
    this.hp = this.maxHp = 230; this.state = 'enter'; this.spin = 0; this.acc = 0;
    this.corePart = this.addPart({ shared: true, anchor: this.core, r: 2.9 * S, mult: 1.6, prio: 2 });
    this.addPart({ shared: true, anchor: this.group, off: v3(0, 0, 3), r: 6.8 * S });
    for (const t of this.turrets) this.addPart({ shared: true, anchor: t, r: 3.2 * S, prio: 1 });
    for (const s of [-1, 1]) this.addPart({ shared: true, anchor: this.group, off: v3(s * 11, -0.8, 1), r: 3.2 * S });
  }
  hpFrac() { return this.hp / this.maxHp; }
  barFrac() { return this.hp / this.maxHp; }
  progress() { return 1 - this.hpFrac(); }
  muzzle(i, out) { return out.set(0, 0.55, 3.2).applyMatrix4(this.turrets[i].matrixWorld); }

  hit(dmg) {
    if (this.state !== 'fight') return;
    this.hp -= dmg; this.flash = 1;
    if (this.hp <= 0) this.die();
  }

  die() {
    this.hp = 0; this.state = 'dying'; this.t = 0; this.setGhost(true);
    this.g.bossDefeated('mid');
    this.g.addScore(20000, this.corePart.p, true);
    this.s.audio.explode(2); this.g.shake(0.8);
  }

  update(dt, frozen) {
    this.t += dt;
    const gr = this.group, pp = this.g.player.p;
    if (this.state === 'enter') {
      const k = easeOut(this.t / 2.6);
      gr.position.set(Math.sin(this.t * 1.5) * 3 * (1 - k), lerp(16, 5, k), lerp(-360, -98, k));
      gr.rotation.set(lerp(0.35, 0, k), 0, Math.sin(this.t * 2) * 0.08 * (1 - k));
      if (this.t > 2.6) { this.state = 'fight'; this.t = 0; this.setGhost(false); }
    } else if (this.state === 'fight') {
      const t = this.t;
      gr.position.set(Math.sin(t * 0.55) * 8, 5 + Math.sin(t * 0.9) * 1.8, -98 + Math.sin(t * 0.35) * 6);
      gr.rotation.set(Math.sin(t * 0.7) * 0.05, Math.sin(t * 0.55) * -0.12, -Math.cos(t * 0.55) * 0.14);
      if (!frozen && this.g.state === 'play') this.attack(dt);
    } else if (this.state === 'dying') {
      const t = this.t;
      gr.position.y -= dt * 2.5; gr.position.z -= dt * 6;
      gr.rotation.z += dt * 0.35; gr.rotation.x += dt * 0.15;
      gr.position.x += rnd(-0.25, 0.25);
      this.acc = (this.acc || 0) + dt;
      while (this.acc > 0.1) {
        this.acc -= 0.1;
        this.randomPoint([13, 3, 9], T1);
        this.s.fx.explosion(T1, rnd(0.9, 1.8), 'fire', { debris: 3, dim: 0.5, n: 0.7 });
        this.s.audio.explode(Math.random() < 0.3 ? 1 : 0, clamp(T1.x / 30, -1, 1));
      }
      this.g.shake(0.35);
      this.flash = 0.5 + 0.5 * Math.sin(t * 30);
      if (t > 2.3) {
        const c = gr.position.clone();
        this.s.fx.bigExplosion(c, 3.4);
        this.s.fx.explosion(T1.set(c.x - 9, c.y, c.z), 2, 'fire'); this.s.fx.explosion(T1.set(c.x + 9, c.y, c.z), 2, 'fire');
        this.s.audio.explode(3); this.g.shake(1.4);
        this.g.cine.flash = 0.6; this.g.cine.flashCol = [1, 0.85, 0.6];
        this.removeAll();
        this.g.bossGone('mid');
        return;
      }
    }
    for (const tu of this.turrets) tu.lookAt(pp);
    this.syncParts(dt);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 8); Models.flash(gr, this.flash * (this.state === 'dying' ? 0.4 : 0.14)); }
    this.core.material.emissiveIntensity = 2.2 + Math.sin(this.t * 7) * 0.9 + this.flash * 1.5;
  }

  attack(dt) {
    const g = this.g, a = this.s.audio;
    this.prevPatT = this.patT; this.patT += dt;
    const core = this.corePart.p;
    switch (this.pat % 4) {
      case 0:
        if (this.at(0.3) || this.at(0.65) || this.at(1.0)) { for (let i = 0; i < 2; i++) g.aimed(this.muzzle(i, T2), 42, 0.34, 3, 'pink', 1.45); }
        if (this.patT > 2.1) this.nextPat();
        break;
      case 1:
        if (this.at(0.2)) g.ring(core, 20, 33, 0.14, 0, 'orange', 1.6);
        if (this.at(0.75)) { g.ring(core, 20, 33, 0.14, Math.PI / 20, 'orange', 1.6); g.aimed(core, 38, 0, 1, 'red', 2.2); }
        if (this.at(1.3)) g.ring(core, 24, 33, 0.1, 0, 'orange', 1.6);
        if (this.patT > 2.5) this.nextPat();
        break;
      case 2:
        this.acc += dt;
        while (this.acc > 0.08 && this.patT < 2.2) { this.acc -= 0.08; this.spin += 0.4; g.ring(core, 3, 30, 0.2, this.spin, 'violet', 1.3); }
        if (this.patT > 2.8) this.nextPat();
        break;
      case 3:
        if (this.at(0.2) || this.at(0.55) || this.at(0.9)) {
          for (const s of [-1, 1]) g.spawnMissile(T2.set(s * 11, -0.8, 6).applyMatrix4(this.group.matrixWorld), T3.set(s * 0.7, 0.55, 0.5).normalize());
          a.missile();
        }
        if (this.at(1.5)) for (let i = 0; i < 2; i++) g.aimed(this.muzzle(i, T2), 40, 0.6, 5, 'pink', 1.45);
        if (this.patT > 2.7) this.nextPat();
        break;
    }
  }
}

// ====================================================================== final boss
// Camera-facing ribbon between uStart and uEnd; x of the plane is the side (-1..1), y the length.
const BEAM_VERT = /* glsl */`
  uniform vec3 uStart, uEnd; uniform float uWidth;
  varying float vSide; varying float vT;
  void main() {
    float t = position.y + 0.5, side = position.x;
    vec3 P = mix(uStart, uEnd, t);
    vec3 axis = normalize(uEnd - uStart);
    vec3 sd = cross(axis, normalize(cameraPosition - P));
    sd = length(sd) > 1e-4 ? normalize(sd) : vec3(1.0, 0.0, 0.0);
    P += sd * side * uWidth;
    vSide = side; vT = t;
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
  }`;
const BEAM_FRAG = /* glsl */`
  uniform float uTime, uAlpha; uniform vec3 uCol;
  varying float vSide; varying float vT;
  void main() {
    float u = vSide;
    float core = exp(-u * u * 28.0), glow = exp(-u * u * 3.2);
    float n = 0.8 + 0.2 * sin(vT * 140.0 - uTime * 70.0);
    float ends = smoothstep(0.0, 0.02, vT) * smoothstep(1.0, 0.97, vT);
    vec3 col = uCol * glow * n + vec3(1.0) * core * 2.4;
    gl_FragColor = vec4(col * ends * uAlpha, 1.0);
  }`;

export class FinalBoss extends BossBase {
  constructor(game) {
    super(game);
    const b = this.s.models.buildFinalBoss();
    Object.assign(this, { group: b.group, core: b.core, coreGroup: b.coreGroup, petals: b.petals, inner: b.inner, outer: b.outer, turrets: b.turrets });
    const S = this.S = 1.35;
    this.base = v3(0, 9, -86);
    this.group.position.copy(this.base);
    this.group.scale.set(0.02, 0.02, 16);
    this.group.visible = false;
    this.s.scene.add(this.group);
    this.kind = 'final'; this.tag = 'LAST BOSS'; this.name = '要塞母艦 NEMESIS'; this.style = 'shield';
    this.state = 'warpin'; this.phase = 1; this.hot = false; this.spin = 0; this.spin2 = 0; this.acc = 0;
    this.coreHp = this.coreMax = 340; this.turMax = 38;
    this.turParts = this.turrets.map((t) => this.addPart({ anchor: t, r: 3.7 * S, hp: this.turMax, prio: 1, onKill: (p) => this.turretKilled(p) }));
    this.corePart = this.addPart({ shared: true, anchor: this.core, r: 7.2 * S, invuln: true, prio: 2 });
    for (const s of [-1, 1]) {
      this.addPart({ armor: true, anchor: this.group, off: v3(s * 15, 0.5, -1), r: 5 * S });
      this.addPart({ armor: true, anchor: this.group, off: v3(s * 29, -1.8, -4), r: 4 * S });
    }
    this.turT = [0.6, 1.1, 0.85, 1.35]; this.ringT = 2; this.podT = 3.2;
    this.makeBeam();
    this.s.audio.bossWarpIn();
    this.s.fx.flash(this.base, 22, 1.0, [2.4, 0.9, 1.8]);
  }

  makeBeam() {
    const geo = new THREE.PlaneGeometry(2, 1, 1, 32);
    const uni = { uTime: { value: 0 }, uAlpha: { value: 1 }, uCol: { value: new THREE.Vector3(3, 0.35, 1.6) },
      uStart: { value: new THREE.Vector3() }, uEnd: { value: new THREE.Vector3() }, uWidth: { value: 1 } };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: uni, vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 45;
    const glow = this.s.models.glowSprite(new THREE.Color(5, 1, 3), 16);
    glow.visible = false; glow.renderOrder = 46;
    this.s.scene.add(mesh, glow);
    this.beam = { mesh, glow, uni, mode: 'off', from: v3(0, 0, 0), to: v3(0, 0, 0), r: 0, x0: 0, x1: 0, y0: 0, y1: 0, t: 0, dur: 2.2 };
  }

  hpFrac() { return this.phase < 1.5 ? 1 : this.coreHp / this.coreMax; }
  turFrac() { return this.turParts.reduce((s, p) => s + Math.max(0, p.alive ? p.hp : 0), 0) / (this.turMax * 4); }
  barFrac() { return this.phase < 1.5 ? this.turFrac() : this.coreHp / this.coreMax; }
  progress() { return this.phase < 1.5 ? (1 - this.turFrac()) * 0.35 : 0.35 + (1 - this.coreHp / this.coreMax) * 0.65; }
  partHit(p) { this.flash = Math.max(this.flash, 0.35); p.flashT = 1; }

  hit(dmg) {
    if (this.state !== 'fight' || this.phase < 2) return;
    this.coreHp -= dmg; this.flash = 1;
    if (this.coreHp <= 0) this.die();
  }

  turretKilled(p) {
    const fx = this.s.fx;
    fx.explosion(p.p, 2.3, 'fire', { debris: 14, dim: 0.8 });
    fx.shock(p.p, 16, 0.7, [4, 2, 1], false);
    this.s.audio.explode(2, clamp(p.p.x / 30, -1, 1)); this.g.shake(0.7);
    this.g.addScore(3000, p.p, true);
    this.g.laserGauge = Math.min(1, this.g.laserGauge + 0.25);
    p.anchor.visible = false;
    if (this.turParts.every((t) => !t.alive)) {
      this.phase = 1.5; this.transT = 0; this.style = '';
      this.stopBeam();
      this.s.audio.shutter();
      this.g.cancelBullets(null, Infinity, true);
      this.g.shake(0.9);
      this.s.hud.banner('ARMOR BREAK', '装甲崩壊 ― コアが露出する！', 'hot');
    }
  }

  die() {
    this.coreHp = 0; this.state = 'dying'; this.t = 0; this.setGhost(true); this.stopBeam();
    this.s.hud.clearBanner();
    this.g.bossDefeated('final');
    this.g.addScore(100000, this.corePart.p, true);
    this.s.audio.explode(3); this.s.audio.stopSong(2.5);
    this.g.shake(1.2);
    this.g.cine.flash = 0.6; this.g.cine.flashCol = [1, 0.9, 0.8];
  }

  beamThreat() {
    const b = this.beam;
    if (b.mode === 'off') return null;
    return b.vertical ? { axis: 'x', v: b.x0 } : { axis: 'y', v: b.y0 };
  }

  stopBeam() { const b = this.beam; b.mode = 'off'; b.mesh.visible = false; b.glow.visible = false; }

  update(dt, frozen) {
    this.t += dt;
    const gr = this.group, g = this.g, fx = this.s.fx, pp = g.player.p;
    this.beam.uni.uTime.value += dt;
    if (this.state === 'warpin') {
      const t = this.t;
      if (t < 1.0) {
        fx.particle(this.base.x + rnd(-30, 30), this.base.y + rnd(-18, 18), this.base.z + rnd(-5, 5), 0, 0, 0, 0.4, rnd(1, 3), 0, [3, 1, 2.5], [0.5, 0.1, 1]);
        if (t > 0.5) g.shake(0.3);
      } else {
        if (!gr.visible) {
          gr.visible = true;
          fx.explosion(this.base, 2.6, 'pink', { debris: 0, dim: 0.5, noRing: true, noHeat: true });
          fx.flash(this.base, 34, 0.5, [1.3, 0.55, 1.1]);
          fx.shock(this.base, 90, 1.3, [1.4, 0.45, 1.15], false); fx.shock(this.base, 120, 1.6, [0.9, 0.45, 1.4], true);
          g.cine.flash = 0.6; g.cine.flashCol = [1, 0.75, 0.95]; g.cine.warp = 1; g.shake(1.4);
          this.flash = 1;
          this.s.audio.playSong('boss');
        }
        const k = clamp((t - 1.0) / 0.55, 0, 1), S = this.S;
        const e = 1 + Math.sin(k * Math.PI) * 0.12 * (1 - k);
        gr.scale.set(lerp(0.02, S, easeOut(k)) * e, lerp(0.02, S, easeOut(k)) * e, lerp(16, S, easeOut(k)));
      }
      if (t > 2.6) { this.state = 'fight'; this.t = 0; gr.scale.setScalar(this.S); for (const p of this.parts) if (p !== this.corePart || this.phase >= 2) p.ghost = false; this.corePart.ghost = false; }
    } else if (this.state === 'fight') {
      const t = this.t;
      gr.position.set(this.base.x + Math.sin(t * 0.35) * 6, this.base.y + Math.sin(t * 0.6) * 1.6, this.base.z + Math.sin(t * 0.25) * 4);
      gr.rotation.set(Math.sin(t * 0.5) * 0.03, Math.sin(t * 0.35) * -0.06, Math.sin(t * 0.3) * 0.05);
      if (this.phase === 1.5) this.openCore(dt);
      else if (!frozen && g.state === 'play') { if (this.phase === 1) this.attack1(dt); else this.attack2(dt); }
      if (frozen) this.stopBeam();
    } else if (this.state === 'dying') {
      this.dying(dt);
      if (!this.group.parent) return;
    }
    this.inner.rotation.z += dt * (this.hot ? 1.1 : 0.5);
    this.outer.rotation.z -= dt * (this.hot ? 0.5 : 0.2);
    for (const tp of this.turParts) {
      if (!tp.alive) {
        if (this.state !== 'dying' && Math.random() < 0.5) fx.particle(tp.p.x + rnd(-1, 1), tp.p.y + rnd(-1, 1), tp.p.z, rnd(-3, 3), rnd(3, 8), rnd(-2, 2), 0.6, rnd(1.5, 2.8), 0.4, [5, 2.2, 0.5], [0.6, 0.1, 0.05]);
        continue;
      }
      tp.anchor.lookAt(pp);
      if (tp.flashT > 0) { tp.flashT -= dt * 6; tp.anchor.userData.eye.scale.setScalar(1 + tp.flashT * 0.8); }
    }
    this.syncParts(dt);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 6); Models.flash(gr, this.flash * (this.state === 'fight' ? 0.12 : 0.6)); }
    const pulse = this.phase >= 2 ? 3 + Math.sin(this.t * (this.hot ? 14 : 7)) * 1.2 : 1.6;
    this.core.material.emissiveIntensity = pulse + this.flash * 2;
    this.updateBeam(dt);
  }

  openCore(dt) {
    this.transT += dt;
    const k = easeOut(this.transT / 1.8);
    for (const p of this.petals) {
      p.quaternion.setFromAxisAngle(p.userData.axis, k * 1.95);
      p.position.copy(p.userData.dir).multiplyScalar(k * 1.6);
    }
    if (Math.random() < 0.6) this.s.fx.sparks(this.corePart.p, 3, 25, 'fire', 0.5, 0.5);
    this.g.shake(0.25);
    if (this.transT >= 1.9) {
      this.phase = 2; this.corePart.invuln = false; this.nextPat();
      this.g.cine.flash = 0.5; this.g.cine.flashCol = [1, 0.4, 0.5];
      this.s.fx.shock(this.corePart.p, 40, 0.9, [4, 0.8, 1.5], false);
    }
  }

  muzzle(tp, out) { return out.set(0, -0.6, 3.8).applyMatrix4(tp.anchor.matrixWorld); }

  attack1(dt) {
    const g = this.g;
    for (let i = 0; i < 4; i++) {
      const tp = this.turParts[i];
      if (!tp.alive) continue;
      this.turT[i] -= dt;
      if (this.turT[i] <= 0) { this.turT[i] = 1.55; g.aimed(this.muzzle(tp, T2), 40, 0.32, 3, 'pink', 1.5); }
    }
    this.ringT -= dt;
    if (this.ringT <= 0) { this.ringT = 3.3; g.ring(this.corePart.p, 18, 31, 0.15, Math.random() * 6.28, 'orange', 1.6); }
    this.podT -= dt;
    if (this.podT <= 0) {
      this.podT = 4.4;
      this.inner.updateMatrixWorld(true);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        T3.set(Math.cos(a) * 10.5, Math.sin(a) * 10.5, 1.8).applyMatrix4(this.inner.matrixWorld);
        g.aimed(T3, 30, 0, 1, 'violet', 1.35);
      }
    }
  }

  attack2(dt) {
    const g = this.g, core = this.corePart.p;
    if (!this.hot && this.coreHp < this.coreMax * 0.4) {
      this.hot = true; this.s.audio.bossHot = true;
      g.cine.flash = 0.45; g.cine.flashCol = [1, 0.15, 0.25]; g.shake(0.8);
      this.s.hud.banner('DANGER', 'コア暴走 ― 最終攻撃形態', 'hot');
      this.s.audio.braam(this.s.audio.now, 2.2);
    }
    const sp = this.hot ? 1.3 : 1;
    this.prevPatT = this.patT; this.patT += dt * sp;
    switch (this.pat % 3) {
      case 0: {
        this.acc += dt * sp;
        while (this.acc > 0.1 && this.patT < 2.6) {
          this.acc -= 0.1; this.spin += 0.3; this.spin2 += 0.24;
          g.ring(core, 4, 29, 0.22, this.spin, 'pink', 1.3);
          g.ring(core, 4, 26, 0.3, -this.spin2, 'violet', 1.2);
        }
        if (this.hot && (this.at(0.8) || this.at(1.8))) g.aimed(core, 42, 0.3, 3, 'red', 2);
        if (this.patT > 3.0) this.nextPat();
        break;
      }
      case 1: {
        const b = this.beam;
        if (this.at(0.05)) {
          b.vertical = this.pat % 2 === 1;
          const px = g.player.p.x, py = g.player.p.y;
          if (b.vertical) { b.x0 = b.x1 = px; b.y0 = -9; b.y1 = 10; if (Math.random() < 0.5) [b.y0, b.y1] = [b.y1, b.y0]; }
          else { b.y0 = b.y1 = py; b.x0 = px < 0 ? 17 : -17; b.x1 = -b.x0; }
          b.mode = 'charge'; b.t = 0; b.dur = this.hot ? 1.7 : 2.2;
          this.s.audio.beamCharge(1.05);
        }
        if (b.mode === 'charge' && this.patT >= 1.15) { b.mode = 'fire'; b.t = 0; this.s.audio.beamFire(b.dur + 0.2); }
        if (b.mode === 'fire' && (this.at(1.5) || this.at(2.1) || this.at(2.7))) g.aimed(core, 36, 0.5, 4, 'orange', 1.4);
        if (b.mode === 'off' && this.patT > 1.4) this.nextPat();
        break;
      }
      case 2: {
        for (let i = 0; i < 4; i++) if (this.at(0.2 + i * 0.36)) g.ring(core, 22, 32, 0.15, i % 2 ? Math.PI / 22 : 0, i % 2 ? 'orange' : 'pink', 1.5);
        if (this.at(1.0)) g.aimed(core, 40, 0, 1, 'red', 2.4);
        if (this.hot && this.at(1.7)) g.ring(core, 30, 34, 0.08, 0, 'violet', 1.4);
        if (this.patT > 2.4) this.nextPat();
        break;
      }
    }
  }

  updateBeam(dt) {
    const b = this.beam;
    if (b.mode === 'off') return;
    b.t += dt;
    const from = b.from.copy(this.corePart.p); from.z += 6.5 * this.S;
    let k = 0;
    if (b.mode === 'fire') k = clamp(b.t / b.dur, 0, 1);
    const tx = lerp(b.x0, b.x1, k), ty = lerp(b.y0, b.y1, k);
    b.to.set(tx, ty, 0);
    const dir = T1.subVectors(b.to, from);
    const len = dir.length() * 1.06;
    let r;
    if (b.mode === 'charge') { r = 0.14 + 0.1 * Math.sin(b.t * 40); b.uni.uAlpha.value = 0.55 + 0.45 * Math.sin(b.t * 30); b.uni.uCol.value.set(4, 0.25, 0.5); }
    else {
      r = 1.6 * clamp(b.t / 0.12, 0, 1) * clamp((b.dur - b.t) / 0.15 + 0.001, 0, 1);
      b.uni.uAlpha.value = 1; b.uni.uCol.value.set(3, 0.35, 1.6);
      this.g.shake(0.3);
      const pp = this.g.player.p;
      const d = T2.subVectors(pp, from), tt = clamp(d.dot(dir) / dir.lengthSq(), 0, 1.06);
      T3.copy(from).addScaledVector(dir, tt);
      if (T3.distanceTo(pp) < r * 0.85 + 0.38) this.g.hurt();
      if (Math.random() < 0.9) this.s.fx.sparks(T3.set(tx, ty, 0.5), 3, 30, 'pink', 0.35, 0.5);
      if (b.t >= b.dur) { this.stopBeam(); return; }
    }
    b.mesh.visible = true; b.glow.visible = true;
    b.uni.uStart.value.copy(from);
    b.uni.uEnd.value.copy(from).addScaledVector(dir, len / dir.length());
    b.uni.uWidth.value = Math.max(0.02, b.mode === 'fire' ? r * 1.25 : 0.3);
    b.glow.position.copy(from);
    b.glow.scale.setScalar(b.mode === 'fire' ? 11 + Math.sin(b.t * 50) * 1.5 : 4 + b.t * 6);
  }

  dying(dt) {
    const t = this.t, gr = this.group, fx = this.s.fx;
    if (t < 3.2) {
      gr.position.x += rnd(-0.3, 0.3); gr.position.y -= dt * 1.2;
      gr.rotation.z += dt * 0.12;
      this.acc = (this.acc || 0) + dt;
      while (this.acc > 0.085) {
        this.acc -= 0.085;
        this.randomPoint([34, 12, 6], T1);
        fx.explosion(T1, rnd(1.0, 2.2), 'fire', { debris: 3, dim: 0.55, n: 0.75 });
        if (Math.random() < 0.5) this.s.audio.explode(Math.random() < 0.4 ? 1 : 0, clamp(T1.x / 40, -1, 1));
      }
      this.g.shake(0.5);
      this.flash = t > 2.5 ? 1 : 0.4 + 0.4 * Math.sin(t * 25);
      if (t > 2.5) fx.sparks(this.corePart.p, 8, 60, 'white', 0.6, 0.8);
    } else if (!this.brokeApart) {
      this.brokeApart = true;
      const c = this.corePart.p.clone();
      this.acc = 0;
      fx.bigExplosion(c, 6.5, 0.5);
      for (const s of [-1, 1]) { fx.bigExplosion(T1.set(c.x + s * 26, c.y - 2, c.z - 3), 3, 0.5); }
      fx.shock(c, 160, 1.8, [2.4, 1.8, 1.3], true);
      this.s.audio.explode(3); this.g.shake(1.6);
      this.g.cine.flash = 0.95; this.g.cine.flashCol = [1, 0.97, 0.92]; this.g.cine.warp = 1;
      this.core.visible = false;
      for (const ch of gr.children) {
        ch.userData.vel = ch.position.clone().setZ(0).normalize().multiplyScalar(rnd(12, 32)).add(v3(rnd(-6, 6), rnd(-6, 6), rnd(-10, 10)));
        ch.userData.spin = v3(rnd(-1.5, 1.5), rnd(-1.5, 1.5), rnd(-1.5, 1.5));
      }
    } else {
      for (const ch of gr.children) {
        if (!ch.userData.vel) continue;
        ch.position.addScaledVector(ch.userData.vel, dt);
        ch.rotation.x += ch.userData.spin.x * dt; ch.rotation.y += ch.userData.spin.y * dt; ch.rotation.z += ch.userData.spin.z * dt;
        ch.scale.multiplyScalar(Math.max(0, 1 - dt * 0.45));
      }
      this.acc += dt;
      const iv = 0.05 + (t - 3.2) * 0.05;
      while (this.acc > iv) {
        this.acc -= iv;
        gr.children[Math.floor(Math.random() * gr.children.length)].getWorldPosition(T1);
        fx.explosion(T1, rnd(0.6, 1.4), 'fire', { debris: 0, noRing: true, n: 0.7 });
      }
      if (t > 5.4) { this.destroy(); this.g.bossGone('final'); }
    }
  }
}

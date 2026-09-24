import * as THREE from 'three';
import { SPECIES, buildAnimal, disposeRig, animateRig, newPose } from './animals.js';
import { CALL_TEXT, GREET_TEXT } from './audio.js';
import { interDist } from './world.js';
import { clamp, lerp, damp, dampAngle, angleTo, wrapAngle, rand, pick, chance, TAU, smoothstep } from './util.js';
import * as L from './layout.js';

const GRAV = 30;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _camP = { x: 0, z: 0 };

/* ================================================================== base actor */

export class Actor {
  constructor(game, species, variant) {
    this.game = game;
    this.species = species;
    this.variant = variant;
    this.rig = buildAnimal(species, variant);
    this.pose = newPose();
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.speed = 0;
    this.moveSpeed = 0;
    game.scene.add(this.rig.root);
  }
  get radius() { return this.rig.world.radius; }
  get height() { return this.rig.world.height; }
  forward(out = _v) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  mouth(out = new THREE.Vector3()) {
    const m = this.rig.world.mouth;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    return out.set(this.pos.x + m.z * s, this.y + m.y, this.pos.z + m.z * c);
  }
  getLabelPos(v) { v.set(this.pos.x, this.y + this.height * 0.9, this.pos.z); return v; }
  groundAt(x, z) {
    const w = this.game.world;
    return Math.max(w.heightAt(x, z), w.colliders.standTop(x, z, this.y, 0.45));
  }
  place(x, z, yaw = this.yaw) {
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.y = this.groundAt(x, z);
    this.vy = 0;
    this.grounded = true;
  }
  hop(v = 4.2) {
    if (!this.grounded) return;
    this.vy = v;
    this.grounded = false;
  }
  verticalStep(dt, onLand) {
    const g = this.groundAt(this.pos.x, this.pos.z);
    if (!this.grounded) {
      this.vy -= GRAV * dt;
      this.y += this.vy * dt;
      if (this.y <= g) {
        const impact = -this.vy;
        this.y = g;
        this.vy = 0;
        this.grounded = true;
        if (onLand) onLand(impact);
      }
    } else if (this.y - g > 0.5) {
      this.grounded = false;
      this.vy = 0;
    } else {
      this.y = damp(this.y, g, 22, dt);
    }
    this.pose.air = damp(this.pose.air, this.grounded ? 0 : 1, 12, dt);
  }
  slopePitch() {
    const L2 = this.rig.world.len * 0.5;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const w = this.game.world;
    const hf = w.heightAt(this.pos.x + s * L2, this.pos.z + c * L2);
    const hb = w.heightAt(this.pos.x - s * L2, this.pos.z - c * L2);
    return clamp(-Math.atan2(hf - hb, L2 * 2), -0.4, 0.4);
  }
  sync(dt) {
    this.rig.root.position.set(this.pos.x, this.y, this.pos.z);
    this.rig.root.rotation.y = this.yaw;
    this.pose.speed = this.moveSpeed;
    animateRig(this.rig, this.pose, dt);
  }
  faceTowards(x, z, dt, k = 8) {
    this.yaw = dampAngle(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z), k, dt);
  }
  dispose() { disposeRig(this.rig); }
}

/* ================================================================== the player */

export class Player extends Actor {
  constructor(game, species) {
    super(game, species);
    this.stats = SPECIES[species];
    this.turnRate = 0;
    this.locked = false;
    this.jumpBuf = 0;
    this.coyote = 0;
    this.stepDist = 0;
    this.airTime = 0;
    this.speedAbs = 0;
  }

  requestJump() { this.jumpBuf = 0.14; }

  update(dt, input) {
    const S = this.stats;
    const g = this.game;
    let mv = 0, tr = 0, run = false;
    if (!this.locked) {
      mv = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
      tr = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      run = input.run;
    }
    const turnTarget = tr * S.turn * (this.grounded ? 1 : 0.7);
    this.turnRate = damp(this.turnRate, turnTarget, 11, dt);
    this.yaw = wrapAngle(this.yaw + this.turnRate * dt);
    const top = mv > 0 ? (run ? S.run : S.walk) : mv < 0 ? -S.walk * 0.5 : 0;
    this.speed = damp(this.speed, top, mv !== 0 ? (this.grounded ? 5 : 2.5) : 7, dt);
    if (this.locked) this.speed = damp(this.speed, 0, 10, dt);

    const ox = this.pos.x, oz = this.pos.z;
    const p = { x: ox + Math.sin(this.yaw) * this.speed * dt, z: oz + Math.cos(this.yaw) * this.speed * dt };
    this.collide(p);
    const moved = Math.hypot(p.x - ox, p.z - oz);
    this.pos.x = p.x;
    this.pos.z = p.z;
    this.moveSpeed = damp(this.moveSpeed, (moved / Math.max(dt, 1e-4)) * Math.sign(this.speed || 1), 14, dt);
    this.speedAbs = Math.abs(this.moveSpeed);

    // jumping with a little forgiveness either side of the ground
    this.coyote = this.grounded ? 0.12 : this.coyote - dt;
    this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && this.coyote > 0 && !this.locked) {
      this.jumpBuf = 0;
      this.coyote = 0;
      this.grounded = false;
      this.vy = Math.sqrt(2 * GRAV * S.jump);
      this.pose.squash = -0.6;
      g.audio.sfx('jump', { pitch: 1.4 / Math.sqrt(this.rig.world.height), gain: 0.8 });
      g.fx.dust(_w.set(this.pos.x, this.y + 0.1, this.pos.z), 4, 0.35 + this.radius * 0.4);
    }
    if (!this.scriptedY) this.verticalStep(dt, (impact) => this.onLand(impact));
    if (!this.grounded) this.airTime += dt; else this.airTime = 0;

    const P = this.pose;
    P.roll = damp(P.roll, -this.turnRate * Math.min(1, this.speedAbs / S.walk) * 0.13, 6, dt);
    P.pitch = damp(P.pitch, this.grounded ? this.slopePitch() : clamp(-this.vy * 0.025, -0.35, 0.3), 8, dt);
    P.wag = damp(P.wag, this.speedAbs > 0.5 ? 0.8 : 0.3, 3, dt);

    // footsteps
    if (this.grounded && this.speedAbs > 0.4) {
      this.stepDist += this.speedAbs * dt;
      const stride = this.rig.dims.stride * this.rig.scale * 0.5;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        const kind = g.world.groundKind(this.pos.x, this.pos.z);
        const surface = kind === 'path' || kind === 'yard' ? 'hard' : kind === 'wheat' ? 'crunch' : 'grass';
        const hoof = this.species === 'horse' || this.species === 'cow' || this.species === 'pig';
        g.audio.sfx('step', { surface, hoof, soft: this.species === 'cat', gain: this.species === 'cat' ? 0.5 : 0.9, pitch: hoof ? 1.5 / Math.sqrt(this.rig.world.height) : 1 });
        if (this.rig.dims.bell && Math.random() < 0.5) g.audio.sfx('bell', { gain: 0.35, pitch: rand(0.98, 1.02) });
        if (this.speedAbs > S.walk * 1.3 && kind !== 'grass') g.fx.dust(_w.set(this.pos.x, this.y + 0.05, this.pos.z), 1, 0.3 + this.radius * 0.3);
      }
    }
  }

  onLand(impact) {
    const g = this.game;
    if (impact > 5) {
      this.pose.squash = Math.min(1, impact / 12);
      g.audio.sfx('land', { hard: Math.min(1, impact / 10), pitch: 1.2 / Math.sqrt(this.rig.world.height) });
      g.fx.dust(_w.set(this.pos.x, this.y + 0.05, this.pos.z), 6, 0.4 + this.radius * 0.5);
      if (this.rig.dims.bell) g.audio.sfx('bell', { gain: 0.5 });
    }
  }

  collide(p) {
    const g = this.game;
    g.world.colliders.resolve(p, this.y + (this.grounded ? 0 : 0.3), this.radius);
    for (const n of g.npcs) {
      if (n.swim) continue;
      if (this.y > n.y + n.height * 0.75) continue;
      const dx = p.x - n.pos.x, dz = p.z - n.pos.z;
      const d = Math.hypot(dx, dz);
      const min = this.radius + n.radius * 0.9;
      if (d < min && d > 1e-4) {
        const push = min - d;
        p.x += (dx / d) * push * 0.75;
        p.z += (dz / d) * push * 0.75;
        n.pos.x -= (dx / d) * push * 0.25;
        n.pos.z -= (dz / d) * push * 0.25;
      }
    }
    const r = Math.hypot(p.x, p.z);
    if (r > L.WORLD_R) { p.x *= L.WORLD_R / r; p.z *= L.WORLD_R / r; }
  }

  /* slide towards a spot during a scripted moment, still respecting walls */
  approach(x, z, stopAt, dt, speed = 3) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d <= stopAt) return true;
    const step = Math.min(d - stopAt, speed * dt);
    const p = { x: this.pos.x + (dx / d) * step, z: this.pos.z + (dz / d) * step };
    this.collide(p);
    this.moveSpeed = damp(this.moveSpeed, Math.hypot(p.x - this.pos.x, p.z - this.pos.z) / dt, 12, dt);
    this.pos.x = p.x; this.pos.z = p.z;
    return false;
  }
}

/* ================================================================== the follow camera */

export class CameraRig {
  constructor(camera, world) {
    this.cam = camera;
    this.world = world;
    this.yaw = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.zoom = 1;
    this.userZoom = 1;
    this.idleOrbit = 0;
    this.scene = null;
    this.dodge = 0;
  }
  /* when the boom straight behind runs into a wall, lean round to the clearest side (sticking with the current side) */
  dodgeFor(pl, yaw, dist, y) {
    const C = this.world.colliders;
    const clipAt = (off) => C.clipSegment(pl.pos.x, pl.pos.z, pl.pos.x - Math.sin(yaw + off) * dist, pl.pos.z - Math.cos(yaw + off) * dist, y);
    let bestClip = clipAt(0), best = 0;
    if (bestClip > (Math.abs(this.dodge) > 0.1 ? 0.92 : 0.75)) return 0;
    const first = this.dodge < 0 ? -1 : 1;
    for (const off of [0.55, 1.1, 1.65]) {
      for (const s of [first, -first]) {
        const c = clipAt(s * off);
        if (c > bestClip + 0.2) { bestClip = c; best = s * off; }
      }
    }
    return best;
  }
  /* pick the orbit offset with the clearest view (walls, trunks, leaves) for a scripted moment */
  sideFor(pl, amount, zoom = 1, faceYaw = pl.yaw) {
    const S = pl.stats.cam;
    const C = this.world.colliders;
    const dist = S.dist * zoom, h = S.height * zoom * 1.1;
    let best = amount, bestScore = Infinity;
    for (const k of [1, 0.6, 1.45]) {
      for (const s of [1, -1]) {
        const yaw = faceYaw + s * amount * k;
        const tx = pl.pos.x - Math.sin(yaw) * dist, tz = pl.pos.z - Math.cos(yaw) * dist;
        const clip = C.clipSegment(pl.pos.x, pl.pos.z, tx, tz, pl.y + h * 0.6);
        const score = (1 - clip) * 4 + C.treePenalty(tx, pl.y + h, tz) + (k === 1 ? 0 : 0.35);
        if (score < bestScore - 0.05) { bestScore = score; best = s * amount * k; }
      }
    }
    return best;
  }
  follow(pl, dt, snap = false) {
    const S = pl.stats.cam;
    if (this.scene) {
      // a three-quarter view while two friends are busy together
      this.orbitYaw = damp(this.orbitYaw, this.scene.yaw, 2.2, dt);
      this.orbitPitch = damp(this.orbitPitch, 0.1, 2, dt);
      this.zoom = damp(this.zoom, this.scene.zoom, 2, dt);
    } else if (this.idleOrbit > 0) this.idleOrbit -= dt;
    else {
      this.orbitYaw = damp(this.orbitYaw, 0, 1.5, dt);
      this.orbitPitch = damp(this.orbitPitch, 0, 1.5, dt);
      if (this.userZoom !== undefined) this.zoom = damp(this.zoom, this.userZoom, 3, dt);
    }
    const dist = S.dist * this.zoom;
    const height = S.height * this.zoom * (1 + this.orbitPitch);
    const boomY = pl.y + height * 0.6;
    const want = this.scene || this.idleOrbit > 0 ? 0 : this.dodgeFor(pl, pl.yaw + this.orbitYaw, dist, boomY);
    this.dodge = snap ? want : damp(this.dodge, want, 2.5, dt);
    const targetYaw = pl.yaw + this.orbitYaw + this.dodge;
    const back = pl.moveSpeed < -0.3;
    this.yaw = snap ? targetYaw : dampAngle(this.yaw, targetYaw, back ? 1.2 : 3.4, dt);
    let tx = pl.pos.x - Math.sin(this.yaw) * dist;
    let tz = pl.pos.z - Math.cos(this.yaw) * dist;
    let ty = pl.y + height;
    let ahead = S.look * 2.2;
    const clip = this.world.colliders.clipSegment(pl.pos.x, pl.pos.z, tx, tz, boomY);
    if (clip < 1) {
      // stop at the wall and crane up rather than pushing the boom through it, still looking at the animal
      tx = lerp(pl.pos.x, tx, clip);
      tz = lerp(pl.pos.z, tz, clip);
      ty += (1 - clip) * height * 0.9;
      ahead *= 0.25 + 0.75 * clip;
    }
    _camP.x = tx; _camP.z = tz;
    this.world.colliders.clearTrunks(_camP, ty, 1.1);
    tx = _camP.x; tz = _camP.z;
    const gh = this.world.heightAt(tx, tz) + 0.7;
    if (ty < gh) ty = gh;
    const lookX = pl.pos.x + Math.sin(this.yaw) * ahead;
    const lookZ = pl.pos.z + Math.cos(this.yaw) * ahead;
    const lookY = pl.y + S.look;
    if (snap) {
      this.pos.set(tx, ty, tz);
      this.look.set(lookX, lookY, lookZ);
    } else {
      this.pos.x = damp(this.pos.x, tx, 7, dt);
      this.pos.z = damp(this.pos.z, tz, 7, dt);
      this.pos.y = damp(this.pos.y, ty, 5, dt);
      this.look.x = damp(this.look.x, lookX, 9, dt);
      this.look.z = damp(this.look.z, lookZ, 9, dt);
      this.look.y = damp(this.look.y, lookY, 6, dt);
    }
  }
  apply(cam = this.cam) {
    cam.position.copy(this.pos);
    cam.lookAt(this.look);
  }
}

/* ================================================================== NPCs */

const CALL_EVERY = {
  cow: [14, 30], horse: [16, 34], sheep: [10, 24], hen: [8, 18], duck: [9, 20], pig: [10, 22],
  dog: [12, 26], cat: [18, 36], rabbit: [25, 50], hedgehog: [25, 50],
};
const GRAZERS = new Set(['horse', 'cow', 'sheep', 'rabbit', 'hen', 'duck', 'pig']);

function inHome(h, x, z, m = 0) {
  if (h.type === 'rect') return x > h.x0 - m && x < h.x1 + m && z > h.z0 - m && z < h.z1 + m;
  return Math.hypot(x - h.x, z - h.z) < h.r + m;
}
function randomIn(h) {
  if (h.type === 'rect') return [rand(h.x0, h.x1), rand(h.z0, h.z1)];
  const a = rand(0, TAU), r = Math.sqrt(Math.random()) * h.r;
  return [h.x + Math.cos(a) * r, h.z + Math.sin(a) * r];
}

export class NPC extends Actor {
  constructor(game, def) {
    super(game, def.species, def.variant);
    this.isNPC = true;
    this.name = def.name;
    this.display = `${def.name} the ${SPECIES[def.species].label.toLowerCase()}`;
    this.home = L.HOMES[def.home];
    this.swim = !!def.swim;
    this.place(def.x, def.z, rand(0, TAU));
    if (this.swim) this.y = game.world.pond.level - 0.06;
    this.state = 'idle';
    this.timer = rand(0.5, 4);
    this.target = null;
    const ce = CALL_EVERY[this.species];
    this.callT = rand(3, ce[1]);
    this.busy = false;
    this.act = null;
    this.lastAct = null;
    this.met = false;
    this.fleeT = 0;
    this.scurryT = 0;
    this.progress = { d: Infinity, t: 0 };
    this.nearPlayer = false;
    this.walkSpeed = SPECIES[this.species].walk * (this.species === 'hen' ? 1 : 1);
  }

  rollInteraction(player) {
    const opts = ACTS.filter((a) => (!a.ok || a.ok(this, player)) && a.id !== this.lastAct);
    let total = 0;
    for (const a of opts) total += a.w;
    let r = Math.random() * total;
    for (const a of opts) { r -= a.w; if (r <= 0) { this.act = a; return a; } }
    this.act = opts[0];
    return this.act;
  }

  say(text, opts = {}) { this.game.fx.say(this, text, opts); }

  call(opts = {}) {
    const g = this.game;
    const d = g.audio.call(this.species, { pos: this.pos, pitch: opts.pitch ?? rand(0.95, 1.06), gain: opts.gain ?? 1 });
    if (opts.bubble !== false) this.say(opts.text || pick(CALL_TEXT[this.species]), { dur: Math.max(1.4, (d || 1) + 0.5) });
    this.pose.talk = 1;
    this.talkT = Math.max(0.5, d || 0.8);
    return d;
  }

  update(dt, player) {
    const g = this.game;
    const P = this.pose;
    const dp = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);

    // everyday calls
    this.callT -= dt;
    if (this.callT < 0) {
      const ce = CALL_EVERY[this.species];
      this.callT = rand(ce[0], ce[1]);
      if (!this.busy && dp < 55 && g.state !== 'paused') this.call({ bubble: dp < 32 });
    }
    if (this.talkT > 0) { this.talkT -= dt; if (this.talkT <= 0) P.talk = 0; }
    P.talk = damp(P.talk, this.talkT > 0 ? 1 : 0, 10, dt);

    // say hello when the player first wanders close
    const near = dp < 6;
    if (near && !this.nearPlayer && !this.busy && chance(0.35) && g.state === 'playing') {
      this.call({ pitch: rand(1.02, 1.12), gain: 0.8 });
      this.callT = Math.max(this.callT, 6);
    }
    this.nearPlayer = near;

    if (!this.busy) this.think(dt, player, dp);

    // look at the player when they are near
    let lookYaw = 0;
    if (dp < 8 && this.state !== 'graze' && this.state !== 'flee') {
      lookYaw = clamp(angleTo(this.yaw, Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z)), -1.1, 1.1);
    }
    if (!this.busy) P.lookYaw = damp(P.lookYaw, lookYaw, 4, dt);
    P.happy = damp(P.happy, this.happyT > 0 ? 1 : 0, 5, dt);
    if (this.happyT > 0) this.happyT -= dt;

    // physics
    if (this.swim) {
      this.y = g.world.pond.level - 0.06 + Math.sin(P.t * 1.8 + this.pos.x) * 0.02;
      this.vy = 0;
      this.grounded = true;
      P.air = 0;
      P.pitch = Math.sin(P.t * 1.3) * 0.04;
    } else {
      this.verticalStep(dt, (impact) => { if (impact > 4) P.squash = Math.min(1, impact / 10); });
      P.pitch = damp(P.pitch, this.grounded ? this.slopePitch() : clamp(-this.vy * 0.03, -0.3, 0.3), 8, dt);
    }
  }

  think(dt, player, dp) {
    const P = this.pose;
    this.timer -= dt;
    let speed = 0;

    // hens and ducks scatter from a galloping visitor
    if ((this.species === 'hen' || (this.species === 'duck' && !this.swim)) && dp < 3.2 && player.speedAbs > player.stats.walk * 1.1 && this.state !== 'scurry') {
      this.state = 'scurry';
      this.timer = 1.1;
      this.yaw = Math.atan2(this.pos.x - player.pos.x, this.pos.z - player.pos.z) + rand(-0.4, 0.4);
      if (this.scurryT <= 0) { this.call({ pitch: 1.2, gain: 0.8 }); this.game.audio.sfx('flap', { pos: this.pos, gain: 0.7 }); this.scurryT = 3; }
      this.hop(3);
    }
    this.scurryT -= dt;

    // a wanderer the camera swings in beside ambles out of shot
    const cam = this.game.camera.position;
    const cdx = this.pos.x - cam.x, cdz = this.pos.z - cam.z, cd = Math.hypot(cdx, cdz);
    if (cd < this.radius + 2.2 && !this.swim && this.state !== 'flee' && this.state !== 'scurry') {
      const a = Math.atan2(cdx, cdz);
      this.target = (this.target || new THREE.Vector3()).set(cam.x + Math.sin(a) * (cd + 3), 0, cam.z + Math.cos(a) * (cd + 3));
      if (this.state !== 'walk' || this.timer > 3) { this.state = 'walk'; this.progress = { d: Infinity, t: 0 }; }
      this.timer = 3;
    }

    switch (this.state) {
      case 'idle':
        P.headDown = damp(P.headDown, 0, 4, dt);
        P.nibble = 0;
        if (this.timer < 0) {
          const r = Math.random();
          if (GRAZERS.has(this.species) && r < 0.45) { this.state = 'graze'; this.timer = rand(3, 8); }
          else if (r < 0.9) {
            const [x, z] = randomIn(this.home);
            this.target = new THREE.Vector3(x, 0, z);
            this.state = 'walk';
            this.timer = 12;
            this.progress = { d: Infinity, t: 0 };
          } else { this.state = 'sniff'; this.timer = rand(1.5, 3); }
        }
        break;
      case 'graze':
      case 'sniff':
        P.headDown = damp(P.headDown, this.state === 'graze' ? 1 : 0.55, 3, dt);
        P.nibble = this.state === 'graze' ? 1 : 0;
        if (this.timer < 0) { this.state = 'idle'; this.timer = rand(1, 4); }
        break;
      case 'walk': {
        P.headDown = damp(P.headDown, 0.1, 4, dt);
        P.nibble = 0;
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        this.faceTowards(this.target.x, this.target.z, dt, 3);
        const facing = Math.cos(angleTo(this.yaw, Math.atan2(dx, dz)));
        speed = this.walkSpeed * clamp(facing, 0, 1) * smoothstep(0.2, 1.2, d);
        if (d < 0.5 || this.timer < 0) { this.state = 'idle'; this.timer = rand(1.5, 5); }
        this.progress.t += dt;
        if (this.progress.t > 1.6) {
          if (this.progress.d - d < 0.3) { this.state = 'idle'; this.timer = rand(0.5, 2); this.yaw += rand(1, 2.5); }
          this.progress = { d, t: 0 };
        }
        break;
      }
      case 'scurry':
        speed = this.walkSpeed * 2.4;
        P.flap = 1;
        if (this.timer < 0) { this.state = 'idle'; this.timer = rand(1, 3); P.flap = 0; }
        break;
      case 'flee': {
        const away = Math.atan2(this.pos.x - player.pos.x, this.pos.z - player.pos.z);
        let desired = away + Math.sin(P.t * 1.4) * 0.7;
        const r = Math.hypot(this.pos.x, this.pos.z);
        if (r > L.WORLD_R - 8) desired = Math.atan2(-this.pos.x, -this.pos.z) + Math.sin(P.t) * 0.5;
        if (this.stuckT > 0.5) { desired = away + (Math.random() < 0.5 ? 1.6 : -1.6); this.stuckT = 0; }
        this.yaw = dampAngle(this.yaw, desired, 5, dt);
        speed = this.fleeSpeed;
        P.headDown = damp(P.headDown, 0, 6, dt);
        P.flap = this.rig.wings.length ? 1 : 0;
        break;
      }
      default: break;
    }

    // move
    if (speed > 0.01) {
      const ox = this.pos.x, oz = this.pos.z;
      const p = { x: ox + Math.sin(this.yaw) * speed * dt, z: oz + Math.cos(this.yaw) * speed * dt };
      if (this.swim) {
        const h = this.home;
        const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz);
        if (d > h.r) { p.x = h.x + (dx / d) * h.r; p.z = h.z + (dz / d) * h.r; }
      } else {
        this.game.world.colliders.resolve(p, this.y, this.radius);
        const r = Math.hypot(p.x, p.z);
        if (r > L.WORLD_R) { p.x *= L.WORLD_R / r; p.z *= L.WORLD_R / r; }
      }
      const moved = Math.hypot(p.x - ox, p.z - oz);
      this.stuckT = moved < speed * dt * 0.3 ? (this.stuckT || 0) + dt : 0;
      this.pos.x = p.x; this.pos.z = p.z;
      this.moveSpeed = damp(this.moveSpeed, moved / Math.max(dt, 1e-4), 10, dt);
    } else {
      this.moveSpeed = damp(this.moveSpeed, 0, 8, dt);
    }
    // wandering outside home (after a game of tag, or a push) → head home
    if (this.state === 'idle' && !inHome(this.home, this.pos.x, this.pos.z, 1.5) && this.timer < 3) {
      const [x, z] = randomIn(this.home);
      this.target = new THREE.Vector3(x, 0, z);
      this.state = 'walk';
      this.timer = 25;
      this.progress = { d: Infinity, t: 0 };
    }
  }
}

/* ================================================================== interactions */

export const ACTS = [
  { id: 'boop', w: 3, verb: 'Boop' },
  { id: 'hello', w: 3, verb: 'Say hello to' },
  { id: 'sing', w: 1.6, verb: 'Sing a song with' },
  { id: 'leapfrog', w: 1.4, verb: 'Play leapfrog over', ok: (n) => !n.swim && n.height < 2.7 },
  { id: 'dance', w: 1.5, verb: 'Dance with', ok: (n) => !n.swim },
  { id: 'tag', w: 1.4, verb: 'Play tag with', ok: (n) => !n.swim && n.species !== 'hedgehog' },
  { id: 'nuzzle', w: 1.4, verb: 'Nuzzle' },
];

const OBJ_VERBS = {
  water: ['Have a drink from', 'Take a sip from', 'Slurp some water from'],
  hay: ['Munch', 'Nibble', 'Have a mouthful of'],
  fruit: ['Eat', 'Crunch', 'Gobble up'],
};
const REG = { horse: 0.5, cow: 0.25, pig: 0.5, cat: 1, dog: 0.5, sheep: 0.5, duck: 0.5, hen: 1, rabbit: 1, hedgehog: 1 };
const MOTIFS = [[523.25, 659.25, 783.99], [587.33, 739.99, 880], [659.25, 783.99, 987.77], [523.25, 587.33, 659.25]];

export class Interactions {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.active = null;
    this.verb = '';
    this.anchor = new THREE.Vector3();
    this.labelTarget = { getLabelPos: (v) => v.copy(this.anchor) };
  }

  reset() {
    if (this.active && this.active.npc) { this.active.npc.busy = false; this.active.npc.state = 'idle'; }
    this.active = null;
    this.game.camRig.scene = null;
    this.target = null;
    this.game.player && (this.game.player.locked = false);
    this.game.fx.setPrompt(null);
  }

  pick(pl) {
    const g = this.game;
    const m = pl.mouth(_w);
    const reach = 0.85 + pl.radius * 0.5;
    let best = null, bd = Infinity;
    for (const n of g.npcs) {
      if (n.busy) continue;
      const dm = Math.hypot(m.x - n.pos.x, m.z - n.pos.z) - n.radius;
      const db = Math.hypot(pl.pos.x - n.pos.x, pl.pos.z - n.pos.z) - n.radius - pl.radius;
      const d = Math.min(dm, db + 0.2);
      if (Math.abs(n.y - pl.y) > 1.8) continue;
      if (d < reach + 0.5 && d < bd) { bd = d; best = n; }
    }
    for (const it of g.world.interactables) {
      if (it.available && !it.available()) continue;
      const dm = interDist(it, m.x, m.z);
      const db = interDist(it, pl.pos.x, pl.pos.z) - pl.radius;
      const d = Math.min(dm, db + 0.25);
      if (d < reach && d < bd - 0.15) { bd = d; best = it; }
    }
    return best;
  }

  _anchorFor(it, pl) {
    if (it.edge) {
      const dx = pl.pos.x - it.x, dz = pl.pos.z - it.z, d = Math.hypot(dx, dz) || 1;
      this.anchor.set(it.x + (dx / d) * (it.shape.r + 0.5), it.y, it.z + (dz / d) * (it.shape.r + 0.5));
    } else this.anchor.set(it.x, it.y, it.z);
  }

  update(dt) {
    const g = this.game;
    const pl = g.player;
    if (this.active) {
      const a = this.active;
      a.t += dt;
      a.update(a.t, dt);
      if (a.t >= a.dur || a.done) this._finish();
      return;
    }
    if (g.state !== 'playing') { g.fx.setPrompt(null); return; }
    const t = this.pick(pl);
    if (t !== this.target) {
      this.target = t;
      if (t && t.isNPC) t.rollInteraction(pl);
      if (t && !t.isNPC) this.verb = pick(OBJ_VERBS[t.kind]);
    }
    if (!t) { g.fx.setPrompt(null); return; }
    if (t.isNPC) g.fx.setPrompt(t, t.act.verb, t.display);
    else {
      this._anchorFor(t, pl);
      g.fx.setPrompt(this.labelTarget, this.verb, t.fruitName && t.kind === 'fruit' ? t.fruitName : t.name);
    }
  }

  trigger() {
    const g = this.game;
    if (this.active || !this.target || g.state !== 'playing') return false;
    const t = this.target;
    this.target = null;
    g.fx.setPrompt(null);
    if (t.isNPC) this._startNPC(t, t.act.id);
    else this._startObj(t);
    return true;
  }

  _finish() {
    const a = this.active;
    this.active = null;
    this.game.camRig.scene = null;
    const pl = this.game.player;
    pl.locked = false;
    pl.scriptedY = false;
    const P = pl.pose;
    P.headDown = 0; P.nibble = 0; P.lean = 0; P.talk = 0; P.tilt = 0; P.spin = 0; P.hop = 0; P.tuck = 0;
    if (a.npc) {
      const n = a.npc;
      n.busy = false;
      n.pose.lean = 0; n.pose.talk = 0; n.pose.tilt = 0; n.pose.spin = 0; n.pose.hop = 0; n.pose.headDown = 0;
      if (n.state !== 'flee') { n.state = 'idle'; n.timer = rand(2, 4); }
      n.lastAct = a.id;
    }
    if (a.end) a.end();
  }

  /* ---------------------------------------------------------------- animals */

  _startNPC(n, id) {
    const g = this.game;
    const pl = g.player;
    const A = { id, npc: n, t: 0, dur: 2, update: () => {}, fired: new Set() };
    const once = (key, t, fn) => { if (A.t >= t && !A.fired.has(key)) { A.fired.add(key); fn(); } };
    n.busy = true;
    n.state = 'busy';
    n.moveSpeed = 0;
    pl.locked = true;
    const sizeP = Math.sqrt(pl.height);
    const between = () => pl.mouth(new THREE.Vector3()).lerp(n.mouth(new THREE.Vector3()), 0.5);
    const faceBoth = (dt, k = 7) => {
      pl.faceTowards(n.pos.x, n.pos.z, dt, k);
      n.faceTowards(pl.pos.x, pl.pos.z, dt, k);
      n.pose.lookYaw = damp(n.pose.lookYaw, 0, 6, dt);
    };
    const reward = (hearts = 1) => {
      g.addHearts(hearts, n);
      n.happyT = 2.5;
      g.event('friend', n);
    };
    const standoff = pl.radius + n.radius + 0.25;

    if (id === 'leapfrog') {
      const dx = n.pos.x - pl.pos.x, dz = n.pos.z - pl.pos.z, d = Math.hypot(dx, dz) || 1;
      const land = { x: n.pos.x + (dx / d) * (n.rig.world.len * 0.5 + pl.radius + 1.0), z: n.pos.z + (dz / d) * (n.rig.world.len * 0.5 + pl.radius + 1.0) };
      const test = { ...land };
      g.world.colliders.resolve(test, g.world.heightAt(land.x, land.z), pl.radius);
      const blocked = Math.hypot(test.x - land.x, test.z - land.z) > 0.2 || Math.hypot(land.x, land.z) > L.WORLD_R - 1 || g.world.groundKind(land.x, land.z) === 'pond';
      if (blocked) id = A.id = 'boop';
      else A.land = land;
    }

    switch (id) {
      case 'boop':
        A.dur = 1.9;
        A.update = (t, dt) => {
          faceBoth(dt, 9);
          if (t < 0.5) pl.approach(n.pos.x, n.pos.z, standoff, dt, 2.5);
          pl.pose.lean = damp(pl.pose.lean, t > 0.3 && t < 0.9 ? 1 : 0, 10, dt);
          n.pose.lean = damp(n.pose.lean, t > 0.35 && t < 0.9 ? 0.7 : 0, 10, dt);
          once('boop', 0.62, () => {
            g.audio.sfx('boop', { pitch: 1.25 / sizeP });
            g.fx.stars(between(), 8);
            g.fx.say(n, 'Boop!', { dur: 1.2, big: true, offset: 0.55 });
            n.pose.squash = 1;
            g.event('boop', n);
          });
          once('giggle', 0.95, () => {
            n.hop(3.2);
            n.call({ pitch: rand(1.15, 1.3), text: pick(['Hee hee!', 'That tickles!', 'Boop to you too!', 'Hehe!']) });
            g.fx.hearts(n.getLabelPos(new THREE.Vector3()), 4);
            reward(1);
          });
        };
        break;

      case 'hello':
        A.dur = 2.9;
        A.update = (t, dt) => {
          faceBoth(dt, 6);
          if (t < 0.45) pl.approach(n.pos.x, n.pos.z, standoff + 0.6, dt, 2);
          once('me', 0.2, () => {
            const d = g.audio.greet(pl.species, { pitch: 1 });
            g.fx.say(pl, GREET_TEXT[pl.species], { me: true, dur: Math.max(1.4, d + 0.3) });
            pl.talkUntil = 0.2 + Math.max(0.8, d);
          });
          pl.pose.talk = damp(pl.pose.talk, t > 0.2 && t < (pl.talkUntil || 1.2) ? 1 : 0, 10, dt);
          once('you', 1.45, () => { n.call({ pitch: rand(1.0, 1.1) }); g.fx.notes(n.getLabelPos(new THREE.Vector3()), 3); });
          once('happy', 2.2, () => { g.fx.hearts(between().setY(n.y + n.height), 3); reward(1); g.event('hello', n); });
        };
        break;

      case 'sing': {
        A.dur = 4.1;
        const motif = pick(MOTIFS);
        const answer = [...motif].reverse();
        A.update = (t, dt) => {
          faceBoth(dt, 6);
          if (t < 0.45) pl.approach(n.pos.x, n.pos.z, standoff + 0.8, dt, 2);
          motif.forEach((f, i) => once('p' + i, 0.25 + i * 0.42, () => {
            g.audio.sing(pl.species, f * REG[pl.species] * 2, { dur: 0.36 });
            g.fx.notes(pl.getLabelPos(new THREE.Vector3()), 1);
            pl.pose.talk = 1;
          }));
          answer.forEach((f, i) => once('n' + i, 1.65 + i * 0.42, () => {
            g.audio.sing(n.species, f * REG[n.species] * 2, { pos: n.pos, dur: 0.36 });
            g.fx.notes(n.getLabelPos(new THREE.Vector3()), 1);
            n.pose.talk = 1;
          }));
          once('lyric', 0.3, () => g.fx.say(pl, pick(['La la la!', 'Tra-la-la!', 'Doo-be-doo!']), { me: true, dur: 1.3 }));
          once('lyric2', 1.7, () => g.fx.say(n, pick(['La la laaa!', 'Tum-ti-tum!', 'Fa-la-la!']), { dur: 1.3 }));
          once('chord', 3.05, () => {
            g.audio.sing(pl.species, motif[0] * REG[pl.species] * 2, { dur: 0.7 });
            g.audio.sing(n.species, motif[2] * REG[n.species] * 2, { pos: n.pos, dur: 0.7 });
            g.audio.sfx('sparkle', { gain: 0.8 });
            g.fx.burst('sparkle', between().setY(Math.max(pl.y + pl.height, n.y + n.height)), 8, { size: 0.3, up: 1.5, speed: 1.5, life: 1.2 });
            pl.hop(3.5); n.hop(3.5);
            reward(2);
          });
          if (t % 0.42 > 0.3) { pl.pose.talk = damp(pl.pose.talk, 0, 8, dt); n.pose.talk = damp(n.pose.talk, 0, 8, dt); }
        };
        break;
      }

      case 'leapfrog': {
        A.dur = 2.4;
        const start = { x: pl.pos.x, z: pl.pos.z, y: pl.y };
        const land = A.land;
        const apex = Math.max(n.height + 0.7, 1.2);
        A.update = (t, dt) => {
          n.faceTowards(pl.pos.x, pl.pos.z, dt, 4);
          n.pose.headDown = damp(n.pose.headDown, 0.5, 6, dt);
          n.pose.squash = t > 0.3 && t < 1.3 ? 0.4 : n.pose.squash;
          if (t < 0.45) {
            pl.faceTowards(land.x, land.z, dt, 12);
            pl.pose.squash = 0.5;
            if (!A.said) { A.said = true; g.fx.say(pl, 'Ready... steady...', { me: true, dur: 1 }); }
          } else if (t < 1.35) {
            pl.scriptedY = true;
            const s = (t - 0.45) / 0.9;
            pl.pos.x = lerp(start.x, land.x, s);
            pl.pos.z = lerp(start.z, land.z, s);
            const gy = lerp(start.y, g.world.heightAt(land.x, land.z), s);
            pl.y = gy + apex * 4 * s * (1 - s);
            pl.grounded = false;
            pl.vy = 0;
            pl.pose.air = 1;
            pl.pose.pitch = (0.5 - s) * -0.6;
            pl.moveSpeed = 0;
            once('whoosh', 0.45, () => { g.audio.sfx('whoosh', { gain: 0.8 }); g.audio.sfx('jump', { pitch: 1.3 / sizeP }); });
          } else {
            once('land', 1.35, () => {
              pl.scriptedY = false;
              pl.y = pl.groundAt(pl.pos.x, pl.pos.z);
              pl.grounded = true;
              pl.pose.air = 0;
              pl.pose.squash = 0.8;
              g.audio.sfx('land', { pitch: 1.2 / sizeP });
              g.fx.dust(new THREE.Vector3(pl.pos.x, pl.y + 0.05, pl.pos.z), 6, 0.5);
              n.call({ pitch: 1.2, text: pick(['Wheee!', 'Over you go!', 'Again, again!']) });
              g.fx.hearts(n.getLabelPos(new THREE.Vector3()), 3);
              reward(2);
            });
            pl.yaw = dampAngle(pl.yaw, Math.atan2(n.pos.x - pl.pos.x, n.pos.z - pl.pos.z), 5, dt);
          }
        };
        break;
      }

      case 'dance':
        A.dur = 3.0;
        A.update = (t, dt) => {
          if (t < 0.3) faceBoth(dt, 8);
          if (t < 0.4) pl.approach(n.pos.x, n.pos.z, standoff + 0.5, dt, 2);
          const k = clamp((t - 0.3) / 2.2, 0, 1);
          const spin = easeSpin(k) * TAU * 2;
          pl.pose.spin = spin;
          n.pose.spin = -spin;
          const bounce = t > 0.3 && t < 2.5 ? Math.abs(Math.sin((t - 0.3) * Math.PI * 2.4)) : 0;
          pl.pose.hop = bounce * 0.22 * sizeP;
          n.pose.hop = bounce * 0.22 * Math.sqrt(n.height);
          once('start', 0.3, () => { g.audio.sfx('fanfare', { gain: 0.8 }); g.fx.say(n, pick(['Hooray!', 'Let\'s dance!', 'Twirl!']), { dur: 1.4 }); });
          for (let i = 0; i < 4; i++) once('note' + i, 0.4 + i * 0.5, () => { g.fx.notes(between().setY(n.y + n.height), 1); g.fx.burst('sparkle', between().setY(n.y + n.height * 0.6), 2, { size: 0.25, life: 0.8 }); });
          once('end', 2.5, () => { n.call({ pitch: 1.15 }); g.fx.hearts(between().setY(Math.max(pl.height, n.height) + pl.y), 4); reward(2); });
        };
        break;

      case 'tag': {
        A.dur = 16;
        A.update = (t, dt) => {
          if (t < 0.7) { faceBoth(dt, 8); return; }
          once('run', 0.7, () => {
            n.call({ pitch: 1.3, text: pick(['Can\'t catch me!', 'You\'re it!', 'Catch me if you can!']) });
            n.hop(4);
            n.busy = false;
            n.state = 'flee';
            n.fleeSpeed = Math.min(pl.stats.walk * 0.88, Math.max(2.2, pl.stats.walk * 0.7));
            pl.locked = false;
            g.fx.setPrompt(null);
            A.chasing = true;
          });
          if (!A.chasing) return;
          g.fx.setPrompt(n, 'Catch', n.name + '!');
          const d = Math.hypot(pl.pos.x - n.pos.x, pl.pos.z - n.pos.z) - pl.radius - n.radius;
          if (d < 1.05 && t > 1.2) {
            A.done = true;
            n.state = 'idle';
            n.timer = 3;
            g.fx.setPrompt(null);
            g.audio.sfx('chime');
            g.fx.say(n, pick(['You got me!', 'Tag! Well done!', 'Caught! Hee hee!']), { dur: 1.8 });
            g.fx.stars(n.getLabelPos(new THREE.Vector3()), 8);
            g.fx.hearts(n.getLabelPos(new THREE.Vector3()), 5);
            n.hop(4);
            setTimeout(() => n.call({ pitch: 1.2, bubble: false }), 300);
            reward(3);
            g.event('tag', n);
          } else if (t > 15.5) {
            A.done = true;
            n.state = 'idle';
            n.timer = 3;
            g.fx.setPrompt(null);
            g.fx.say(n, 'Too quick for you!', { dur: 1.8 });
            n.call({ pitch: 1.1, bubble: false });
            reward(1);
          }
        };
        break;
      }

      case 'nuzzle':
        A.dur = 2.5;
        A.update = (t, dt) => {
          faceBoth(dt, 7);
          if (t < 0.6) pl.approach(n.pos.x, n.pos.z, standoff - 0.05, dt, 2);
          const on = t > 0.4 && t < 2.0 ? 1 : 0;
          pl.pose.lean = damp(pl.pose.lean, on * 0.7, 6, dt);
          n.pose.lean = damp(n.pose.lean, on * 0.6, 6, dt);
          pl.pose.tilt = damp(pl.pose.tilt, on * 0.4, 5, dt);
          n.pose.tilt = damp(n.pose.tilt, -on * 0.4, 5, dt);
          once('pop', 0.7, () => {
            g.audio.sfx('pop', { pitch: 0.9 });
            g.fx.spawn('heart', between().add(new THREE.Vector3(0, 0.3, 0)), { vel: new THREE.Vector3(0, 0.8, 0), size: 0.8, life: 2, grav: 0, drag: 1 });
            g.fx.say(pl, pick(['Mmm, cosy!', 'Nuzzle nuzzle!', 'Awww!']), { me: true, dur: 1.4 });
          });
          once('reply', 1.35, () => { n.call({ pitch: 1.05, gain: 0.7, text: pick(['Aww!', 'Snug as a bug!', 'Mmm!']) }); reward(1); });
        };
        break;
      default: break;
    }
    A.end = () => { if (n.state === 'busy') n.state = 'idle'; };
    this.active = A;
    if (id !== 'tag') {
      const zoom = 1.18 + Math.min(0.4, n.height / Math.max(pl.height, 0.5) * 0.12);
      g.camRig.scene = { yaw: g.camRig.sideFor(pl, 0.95, zoom, Math.atan2(n.pos.x - pl.pos.x, n.pos.z - pl.pos.z)), zoom };
    }
  }

  /* ---------------------------------------------------------------- water, hay and fruit */

  _startObj(it) {
    const g = this.game;
    const pl = g.player;
    pl.locked = true;
    const A = { id: it.kind, t: 0, dur: it.kind === 'fruit' ? 2.1 : 2.6, fired: new Set() };
    const once = (key, t, fn) => { if (A.t >= t && !A.fired.has(key)) { A.fired.add(key); fn(); } };
    const mouthH = pl.rig.world.mouth.y;
    const baseY = g.world.heightAt(it.x, it.z);
    const targetY = baseY + it.headY;
    const rel = targetY - pl.y;
    const reachUp = rel > mouthH * 0.85;
    const down = clamp((mouthH - rel) / mouthH, 0, 1);
    const closest = () => {
      if (it.edge) {
        const dx = pl.pos.x - it.x, dz = pl.pos.z - it.z, d = Math.hypot(dx, dz) || 1;
        return { x: it.x + (dx / d) * it.shape.r, z: it.z + (dz / d) * it.shape.r };
      }
      if (it.shape.type === 'circle') return { x: it.x, z: it.z };
      const s = it.shape;
      const dx = pl.pos.x - it.x, dz = pl.pos.z - it.z;
      const lx = clamp(dx * s.cos - dz * s.sin, -s.hw, s.hw), lz = clamp(dx * s.sin + dz * s.cos, -s.hd, s.hd);
      return { x: it.x + lx * s.cos + lz * s.sin, z: it.z - lx * s.sin + lz * s.cos };
    };
    const spot = closest();
    const mouthPos = () => pl.mouth(new THREE.Vector3());
    A.update = (t, dt) => {
      pl.faceTowards(spot.x, spot.z, dt, 9);
      if (t < 0.6) {
        const m = pl.mouth(_w);
        const dm = it.shape.type === 'circle' && !it.edge ? Math.hypot(m.x - it.x, m.z - it.z) - it.shape.r : interDist(it, m.x, m.z);
        if (dm > 0.12) pl.approach(spot.x, spot.z, pl.rig.world.mouth.z * 0.95, dt, 2.2);
      }
      const on = t > 0.35 && t < A.dur - 0.35;
      pl.pose.headDown = damp(pl.pose.headDown, on ? (reachUp ? 0.1 : down) : 0, 6, dt);
      pl.pose.pitch = reachUp && on ? damp(pl.pose.pitch, -0.45, 5, dt) : pl.pose.pitch;
      pl.pose.nibble = on ? 1 : 0;
      if (it.kind === 'water') {
        once('snd', 0.4, () => { g.audio.sfx('drink', { pitch: 1.3 / Math.sqrt(pl.height) }); g.fx.say(pl, pick(['Slurp slurp!', 'Glug glug!', 'Lap lap lap!']), { me: true, dur: 1.4 }); });
        if (on && Math.random() < dt * 6) g.fx.spawn('drop', mouthPos().setY(targetY + 0.08), { vel: new THREE.Vector3(rand(-0.6, 0.6), rand(1, 2), rand(-0.6, 0.6)), size: 0.14, life: 0.6, grav: -7 });
        if (on && Math.random() < dt * 2) g.fx.spawn('ripple', mouthPos().setY(targetY + 0.02), { vel: new THREE.Vector3(0, 0, 0), size: 0.3, grow: 3, life: 0.9, grav: 0, alpha: 0.7, spin: 0 });
      } else {
        once('snd', 0.4, () => {
          g.audio.sfx('munch', { crisp: it.kind === 'fruit' });
          g.fx.say(pl, it.kind === 'hay' ? pick(['Munch munch!', 'Crunchy hay!', 'Nom nom nom!']) : pick(['Crunch! Yum!', 'Mmm, sweet!', 'Scrumptious!']), { me: true, dur: 1.5 });
          if (it.use) it.use(pl);
        });
        if (on && Math.random() < dt * 7) g.fx.spawn(it.kind === 'hay' ? 'crumb' : 'crunch', mouthPos().setY(pl.y + mouthH * (1 - down * 0.8)), { vel: new THREE.Vector3(rand(-1, 1), rand(0.5, 1.5), rand(-1, 1)), size: 0.16, life: 0.7, grav: -6 });
      }
    };
    A.end = () => {
      g.addHearts(1, null, mouthPos());
      g.event(it.kind === 'water' ? 'drink' : it.kind, it);
    };
    this.active = A;
    g.camRig.scene = { yaw: g.camRig.sideFor(pl, 0.75, 1, Math.atan2(spot.x - pl.pos.x, spot.z - pl.pos.z)), zoom: 1.0 };
  }
}

function easeSpin(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }

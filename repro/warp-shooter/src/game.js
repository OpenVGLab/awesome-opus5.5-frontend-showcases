import * as THREE from 'three';
import { Models } from './models.js';
import { MidBoss, FinalBoss } from './bosses.js';

export const UP = new THREE.Vector3(0, 1, 0);
const T1 = new THREE.Vector3(), T2 = new THREE.Vector3(), T3 = new THREE.Vector3(), T4 = new THREE.Vector3(), T5 = new THREE.Vector3();
const Q = new THREE.Quaternion(), ZAXIS = new THREE.Vector3(0, 0, 1), SV = new THREE.Vector3(), M4 = new THREE.Matrix4();
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeIn = (t) => Math.pow(clamp(t, 0, 1), 2.2);
export function bez(out, a, b, c, d, t) {
  const u = 1 - t;
  return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const BOUNDS = { x: 12.5, yMin: -6.2, yMax: 7.2 };
const PLAYER_R = 0.38;
const MAX_EB = 900, MAX_PB = 200;
const STATS = {
  dart: { hp: 3, r: 2.5, score: 100 }, orb: { hp: 6, r: 2.8, score: 150 },
  heavy: { hp: 34, r: 4.6, score: 1000 }, missile: { hp: 1, r: 1.5, score: 50 },
};
export const COLS = { pink: [1.0, 0.22, 0.65], orange: [1.0, 0.45, 0.08], violet: [0.62, 0.28, 1.0], red: [1.0, 0.12, 0.14], gold: [1.0, 0.8, 0.2] };

const EB_VERT = /* glsl */`
  attribute vec3 aColor; attribute float aSize; uniform float uScale;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale / max(1.0, -mv.z), 0.0, uScale * 0.075);
    vColor = aColor;
    if (aSize <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const EB_FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0; float r = length(c);
    if (r > 1.0) discard;
    float core = 1.0 - smoothstep(0.2, 0.32, r);
    float ring = smoothstep(0.24, 0.42, r) * (1.0 - smoothstep(0.6, 0.78, r));
    float halo = pow(1.0 - r, 3.0);
    vec3 col = vec3(1.0, 0.96, 0.98) * core * 1.5 + vColor * (ring * 1.9 + halo * 0.5);
    gl_FragColor = vec4(col, 1.0);
  }`;

export class Game {
  constructor(s) {
    this.s = s;
    this.time = 0; this.stateT = 0; this.state = 'title';
    this.input = { x: 0, y: 0, fire: false, slow: false, laser: false, mouseAim: false, mx: 0, my: 0, drag: null };
    this.aimPoint = v3(0, 0, -75); this.lock = null;
    this.reticle = { x: 0, y: 0, lock: false, visible: false };
    this.cine = { speed: 1500, speedTarget: 1500, fov: 64, fovTarget: 64, blur: 0.25, lines: 0.35, tunnel: 1, tunnelTarget: 1, flash: 0, flashCol: [1, 1, 1], damage: 0, warp: 0, kick: 0, shake: 0 };
    this.god = false; this.auto = false;
    this.hiscore = Number(localStorage.getItem('warpStriker.hi') || 0) || 0;
    this.enemies = []; this.lasers = []; this.boss = null;
    this.initPlayer();
    this.initBullets();
    this.resetRun();
  }

  // ------------------------------------------------------------------ setup
  initPlayer() {
    const m = this.s.models.buildPlayer();
    this.s.scene.add(m.root);
    this.player = { ...m, p: m.root.position, v: v3(0, 0, 0), bank: 0, pitch: 0, roll: 0, cool: 0, alive: true };
  }

  initBullets() {
    const geo = new THREE.OctahedronGeometry(1, 0); geo.scale(0.14, 0.14, 1.7);
    this.pbMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 3.2, 5.5) }), MAX_PB);
    this.pbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.pbMesh.frustumCulled = false; this.pbMesh.renderOrder = 15;
    this.s.scene.add(this.pbMesh);
    this.pb = [];
    for (let i = 0; i < MAX_PB; i++) this.pb.push({ p: v3(0, 0, 0), prev: v3(0, 0, 0), v: v3(0, 0, 0), life: 0, alive: false, target: null });

    this.eb = []; this.ebFree = [];
    for (let i = 0; i < MAX_EB; i++) { this.eb.push({ p: v3(0, 0, 0), prev: v3(0, 0, 0), v: v3(0, 0, 0), acc: null, col: COLS.pink, size: 0, r: 0.42, life: 0, alive: false }); this.ebFree.push(MAX_EB - 1 - i); }
    const g = new THREE.BufferGeometry();
    this.ebPos = new Float32Array(MAX_EB * 3); this.ebCol = new Float32Array(MAX_EB * 3); this.ebSize = new Float32Array(MAX_EB);
    g.setAttribute('position', new THREE.BufferAttribute(this.ebPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.ebCol, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.ebSize, 1).setUsage(THREE.DynamicDrawUsage));
    this.ebUni = { uScale: { value: 600 } };
    this.ebPoints = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.ebUni, vertexShader: EB_VERT, fragmentShader: EB_FRAG, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.ebPoints.frustumCulled = false; this.ebPoints.renderOrder = 40;
    this.s.scene.add(this.ebPoints);
  }

  resetRun() {
    this.score = 0; this.dispScore = 0; this.shield = 6; this.maxShield = 6; this.laserGauge = 0.35; this.laserWasFull = false;
    this.chain = 0; this.chainTimer = 0; this.maxChain = 0; this.kills = 0; this.damageTaken = 0; this.continues = 0;
    this.clock = 0; this.timerOn = false; this.clearTime = 0; this.invuln = 0; this.phase = null; this.phaseT = 0; this.progress = 0;
    this.warped = false; this.warpedOut = false; this.script = [];
    for (const e of this.enemies) if (e.kind !== 'part') { this.s.scene.remove(e.obj); Models.dispose(e.obj); }
    this.enemies = []; this.lasers = [];
    if (this.boss) { this.boss.destroy(); this.boss = null; }
    this.cancelBullets(null, Infinity, false);
    for (const b of this.pb) b.alive = false;
    const pl = this.player;
    pl.alive = true; pl.root.visible = true; pl.p.set(0, 0, 0); pl.v.set(0, 0, 0); pl.bank = 0; pl.pitch = 0; pl.roll = 0;
  }

  // ------------------------------------------------------------------ state flow
  toTitle() {
    this.resetRun();
    this.state = 'title'; this.stateT = 0;
    const c = this.cine;
    c.speedTarget = 1500; c.tunnelTarget = 1; c.fovTarget = 64; c.lines = 0.16; c.blur = 0;
    this.s.env.setWorld(false); this.s.env.setPalette('warp'); this.s.env.gateInterval = 0; this.s.env.towerHeightMul = 1;
    this.s.audio.playSong('title');
    this.s.hud.showTitle(true);
  }

  startGame() {
    this.resetRun();
    this.state = 'intro'; this.stateT = 0;
    this.s.hud.showTitle(false);
    this.s.hud.hudOn(true);
    this.s.audio.stopSong(0.4);
    this.s.audio.warpCharge(3.4);
    this.s.audio.select();
    this.s.hud.countdown('WARP OUT', '3');
    this.cdStep = 3;
  }

  warpOut() {
    this.warped = true;
    const c = this.cine, a = this.s.audio;
    c.flash = 1.15; c.flashCol = [1, 1, 1]; c.speed = 1400; c.speedTarget = 135; c.tunnelTarget = 0; c.fov = 112; c.fovTarget = 58;
    c.blur = 1.2; c.lines = 1; c.kick = 1; c.warp = 1;
    a.warpOut();
    a.playSong('stage', a.now + 0.02);
    this.s.env.setWorld(true); this.s.env.setPalette('zako');
    this.s.fx.shock(this.player.p, 30, 0.9, [1.2, 2.4, 5], false);
    this.s.fx.shock(this.player.p, 45, 1.0, [0.5, 1, 2.4], true);
    this.s.fx.sparks(this.player.p, 60, 60, 'blue', 0.8, 0.6);
    this.s.hud.countdown(null);
    this.s.hud.banner('MISSION START', 'ワープアウト完了 ― 敵艦隊を殲滅せよ');
    this.timerOn = true; this.clock = 0;
    this.progress = 0.02;
  }

  setPhase(name) {
    this.phase = name; this.phaseT = 0;
    const env = this.s.env, a = this.s.audio, hud = this.s.hud, c = this.cine;
    switch (name) {
      case 'zako':
        env.setPalette('zako'); env.gateInterval = 300; c.speedTarget = 135; c.fovTarget = 58;
        this.script = this.zakoScript(); this.progressNode = 1;
        break;
      case 'midWarn':
        env.gateInterval = 0; env.setPalette('mid'); c.speedTarget = 120;
        hud.warning('中型戦艦「ゴライアス」接近中'); a.warning(); a.stopSong(1.0);
        break;
      case 'mid':
        this.boss = new MidBoss(this); a.playSong('boss'); this.progressNode = 2;
        break;
      case 'boost':
        env.setPalette('boost'); env.gateInterval = 80; env.gateDist = 60; c.speedTarget = 380; c.fovTarget = 74; c.flash = 0.35; c.flashCol = [0.6, 0.9, 1];
        hud.banner('HYPER BOOST', '高速突破 ― 敵本隊へ急行せよ', 'hot'); a.playSong('stage'); a.jumpToBar(8); this.progressNode = 3;
        this.script = [{ t: 1.0, fn: () => this.waveHelix(8, 125, false) }, { t: 2.8, fn: () => this.waveHelix(8, 125, true) }];
        break;
      case 'bossWarn':
        env.gateInterval = 0; env.setPalette('boss'); env.towerHeightMul = 0.38; c.speedTarget = 320; c.fovTarget = 62;
        for (const gt of env.gates) if (gt.position.z < -120) gt.visible = false;
        hud.warning('超巨大ワープ反応 ― 要塞母艦「ネメシス」'); a.warning(); a.stopSong(1.2);
        break;
      case 'boss':
        this.boss = new FinalBoss(this); a.bossHot = false; this.progressNode = 4; c.speedTarget = 130; c.fovTarget = 60;
        break;
      case 'clear':
        env.setPalette('victory'); env.towerHeightMul = 1; c.speedTarget = 150; c.fovTarget = 58;
        hud.banner('MISSION COMPLETE', '敵要塞 撃破', 'gold'); a.playSong('victory');
        break;
    }
  }

  bossDefeated(kind) {
    if (kind === 'final') {
      this.timerOn = false; this.clearTime = this.clock;
      this.cancelBullets(null, Infinity, true);
      this.progress = 1;
    } else this.cancelBullets(null, Infinity, true);
  }

  bossGone(kind) {
    this.boss = null;
    if (kind === 'mid') this.setPhase('boost'); else this.setPhase('clear');
  }

  playerWarpOut() {
    this.warpedOut = true;
    const c = this.cine;
    this.s.audio.playerWarp();
    c.speedTarget = 1500; c.tunnelTarget = 1; c.fovTarget = 70; c.lines = 1; c.blur = 0.8; c.flash = 0.9; c.flashCol = [1, 1, 1];
    this.s.fx.flash(this.player.p, 40, 0.8, [3, 5, 8]);
    this.s.fx.shock(this.player.p, 30, 0.8, [1.5, 3, 6]);
    setTimeout(() => { if (this.state === 'play' || this.state === 'result') this.s.env.setWorld(false); }, 250);
  }

  finishRun(success) {
    const r = { success, clearTime: this.clearTime, kills: this.kills, maxChain: this.maxChain, damage: this.damageTaken, continues: this.continues, timeBonus: 0, shieldBonus: 0 };
    if (success) {
      r.timeBonus = Math.max(0, Math.round((100 - this.clearTime) * 4000 / 100) * 100);
      r.shieldBonus = this.shield * 25000 + (this.damageTaken === 0 ? 100000 : 0);
      this.score += r.timeBonus + r.shieldBonus;
      r.rank = this.continues > 0 ? 'C' : this.clearTime <= 70 && this.damageTaken <= 1 ? 'S' : this.clearTime <= 90 && this.damageTaken <= 3 ? 'A' : 'B';
    } else r.rank = '-';
    r.score = this.score;
    if (this.score > this.hiscore) { this.hiscore = this.score; try { localStorage.setItem('warpStriker.hi', String(this.hiscore)); } catch (e) { /* storage may be blocked */ } }
    r.hiscore = this.hiscore;
    this.state = 'result'; this.stateT = 0;
    this.s.hud.showResult(r);
  }

  continueGame() {
    this.state = 'play'; this.stateT = 0;
    this.shield = this.maxShield; this.invuln = 3; this.continues++;
    this.player.alive = true; this.player.root.visible = true;
    this.cancelBullets(null, Infinity, false);
    this.s.hud.showContinue(false);
    this.s.audio.select();
  }

  giveUp() { this.s.hud.showContinue(false); this.finishRun(false); }

  // ------------------------------------------------------------------ update
  update(dt) {
    this.time += dt; this.stateT += dt;
    const c = this.cine;
    if (this.state === 'title') {
      this.player.p.set(Math.sin(this.time * 0.9) * 0.4, Math.sin(this.time * 1.3) * 0.3, 0);
      this.player.bank = Math.sin(this.time * 0.9) * 0.25;
    } else if (this.state === 'intro') {
      const t = this.stateT;
      const cd = t < 1.2 ? 3 : t < 2.3 ? 2 : 1;
      if (!this.warped && cd !== this.cdStep) { this.cdStep = cd; this.s.hud.countdown('WARP OUT', String(cd)); this.s.audio.lock(); }
      if (!this.warped) {
        c.speedTarget = 1500 + t * 500; c.lines = 0.18 + t * 0.12; c.blur = 0.06 + t * 0.09; c.fovTarget = 64 + t * 9;
        this.player.p.set(Math.sin(t * 41) * 0.05 * t, Math.sin(t * 37) * 0.05 * t, 0);
        this.player.bank = Math.sin(t * 2) * 0.1;
        if (t >= 3.4) this.warpOut();
      } else {
        this.updatePlayer(dt, false);
        if (t >= 4.2) { this.state = 'play'; this.stateT = 0; this.setPhase('zako'); }
      }
      if (this.timerOn) this.clock += dt;
    } else if (this.state === 'play') {
      this.phaseT += dt;
      if (this.timerOn) this.clock += dt;
      this.updatePlayer(dt, true);
      this.updateDirector(dt);
      if (this.boss) this.boss.update(dt);
      this.updateEnemies(dt);
      this.updatePlayerBullets(dt);
      this.updateEnemyBullets(dt);
      this.updateLasers(dt);
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.chain = 0;
      const was = this.laserGauge >= 1;
      this.laserGauge = Math.min(1, this.laserGauge + dt / 6.5);
      if (!was && this.laserGauge >= 1) this.s.audio.laserReady();
      this.invuln -= dt;
    } else if (this.state === 'dead') {
      this.updateEnemies(dt); this.updateEnemyBullets(dt); this.updatePlayerBullets(dt); this.updateLasers(dt);
      if (this.boss) this.boss.update(dt, true);
      if (this.stateT > 1.8) { this.state = 'continue'; this.stateT = 0; this.contCount = 9; this.s.hud.showContinue(true, 9); }
    } else if (this.state === 'continue') {
      const n = Math.max(0, 9 - Math.floor(this.stateT));
      if (n !== this.contCount) { this.contCount = n; this.s.hud.showContinue(true, n); this.s.audio.lock(); }
      if (this.stateT >= 10) this.giveUp();
    }
    // cinematic parameters
    const kS = 1 - Math.exp(-dt * (c.speed > c.speedTarget ? 2.6 : 1.2));
    c.speed += (c.speedTarget - c.speed) * kS;
    c.fov += (c.fovTarget - c.fov) * (1 - Math.exp(-dt * 3));
    c.tunnel += (c.tunnelTarget - c.tunnel) * (1 - Math.exp(-dt * (c.tunnelTarget > c.tunnel ? 1.5 : 5)));
    const boostLines = this.phase === 'boost' ? 0.8 : this.state === 'title' ? 0.35 : 0;
    if (this.state === 'play' || (this.state === 'intro' && this.warped)) {
      c.lines += (Math.max(boostLines, c.speed > 600 ? 0.8 : 0) - c.lines) * (1 - Math.exp(-dt * 2.5));
      c.blur += ((this.phase === 'boost' ? 0.11 : c.speed > 700 ? 0.6 : 0) - c.blur) * (1 - Math.exp(-dt * 3));
    }
    c.flash = Math.max(0, c.flash - dt * (1.8 + c.flash * 2.4));
    c.damage = Math.max(0, c.damage - dt * 1.6);
    c.warp = Math.max(0, c.warp - dt * 1.2);
    c.kick = Math.max(0, c.kick - dt * 1.4);
    c.shake = Math.max(0, c.shake - dt * 2.2);
    this.dispScore += (this.score - this.dispScore) * Math.min(1, dt * 10);
    if (Math.abs(this.score - this.dispScore) < 1) this.dispScore = this.score;
  }

  shake(a) { this.cine.shake = Math.min(1.6, Math.max(this.cine.shake, a)); }

  updateDirector() {
    while (this.script.length && this.phaseT >= this.script[0].t) this.script.shift().fn();
    const zako = this.enemies.some((e) => e.alive && e.kind !== 'part');
    switch (this.phase) {
      case 'zako':
        this.progress = 0.05 + Math.min(1, this.phaseT / 17) * 0.2;
        if ((this.phaseT > 15.5 && !zako && !this.script.length) || this.phaseT > 19.5) this.setPhase('midWarn');
        break;
      case 'midWarn': this.progress = 0.25; if (this.phaseT > 2.8) this.setPhase('mid'); break;
      case 'mid': this.progress = 0.25 + (this.boss ? (1 - this.boss.hpFrac()) * 0.25 : 0.25); break;
      case 'boost': this.progress = 0.5 + Math.min(1, this.phaseT / 6) * 0.25; if (this.phaseT > 6) this.setPhase('bossWarn'); break;
      case 'bossWarn': this.progress = 0.75; if (this.phaseT > 3.4) this.setPhase('boss'); break;
      case 'boss': this.progress = 0.75 + (this.boss ? this.boss.progress() * 0.25 : 0.25); break;
      case 'clear':
        if (this.phaseT > 2.8 && !this.warpedOut) this.playerWarpOut();
        if (this.phaseT > 4.2) this.finishRun(true);
        break;
    }
  }

  // ------------------------------------------------------------------ player
  updatePlayer(dt, canAct) {
    const inp = this.input, pl = this.player;
    if (!pl.alive) return;
    if (this.warpedOut) { pl.p.z -= dt * 320 * Math.min(1, (this.phaseT - 2.8) * 1.5); pl.bank *= 0.95; return; }
    if (this.phase === 'clear') { canAct = false; const k = Math.min(1, this.phaseT / 1.3); pl.roll = ((1 - Math.cos(k * Math.PI)) / 2) * Math.PI * 2; }
    let ax = inp.x, ay = inp.y;
    if (this.auto && canAct) [ax, ay] = this.autopilot();
    const spd = inp.slow ? 11 : 24;
    const len = Math.hypot(ax, ay);
    if (len > 1) { ax /= len; ay /= len; }
    let tvx = ax * spd, tvy = ay * spd;
    if (inp.drag) { tvx = clamp((inp.drag.tx - pl.p.x) * 9, -28, 28); tvy = clamp((inp.drag.ty - pl.p.y) * 9, -28, 28); }
    const k = 1 - Math.exp(-dt * 14);
    pl.v.x += (tvx - pl.v.x) * k; pl.v.y += (tvy - pl.v.y) * k;
    pl.p.x = clamp(pl.p.x + pl.v.x * dt, -BOUNDS.x, BOUNDS.x);
    pl.p.y = clamp(pl.p.y + pl.v.y * dt, BOUNDS.yMin, BOUNDS.yMax);
    pl.p.z = 0;
    const kb = 1 - Math.exp(-dt * 8);
    pl.bank += (-pl.v.x / 24 * 0.8 - pl.bank) * kb;
    pl.pitch += (pl.v.y / 24 * 0.25 - pl.pitch) * kb;
    if (!canAct) return;
    pl.cool -= dt;
    if ((inp.fire || this.auto || inp.drag) && pl.cool <= 0) { this.fireShot(); pl.cool = 0.085; }
    if (inp.laser) { inp.laser = false; this.fireLasers(); }
  }

  fireShot() {
    const pl = this.player;
    pl.body.rotation.set(pl.pitch, 0, pl.bank);
    pl.root.updateMatrixWorld(true);
    for (const g of pl.guns) {
      const from = T1.copy(g).applyMatrix4(pl.body.matrixWorld);
      const v = T2.copy(this.aimPoint).sub(from).normalize().multiplyScalar(360);
      this.spawnPB(from, v);
      this.s.fx.particle(from.x, from.y, from.z, 0, 0, -20, 0.06, 0.85, 0.2, [1.2, 2.8, 4.8], [0.3, 0.6, 2]);
    }
    this.s.audio.shot();
  }

  spawnPB(from, v) {
    const b = this.pb.find((x) => !x.alive);
    if (!b) return;
    b.alive = true; b.p.copy(from); b.prev.copy(from); b.v.copy(v); b.life = 0.75; b.target = this.lock;
  }

  hurt() {
    if (this.god || this.invuln > 0 || this.state !== 'play' || !this.player.alive) return;
    this.shield--; this.damageTaken++; this.invuln = 1.8; this.chain = 0;
    const p = this.player.p;
    this.s.fx.sparks(p, 36, 32, 'white', 0.55, 0.5);
    this.s.fx.explosion(p, 0.7, 'blue', { debris: 4, noRing: true });
    this.s.audio.damage(); this.shake(0.9); this.cine.damage = 1;
    this.cancelBullets(p, 8, false);
    if (this.shield <= 0) {
      this.player.alive = false; this.player.root.visible = false;
      this.s.fx.bigExplosion(p, 1.3); this.s.audio.explode(2); this.shake(1.5);
      this.cine.flash = 0.6; this.cine.flashCol = [1, 0.4, 0.3];
      this.state = 'dead'; this.stateT = 0;
    }
  }

  // ------------------------------------------------------------------ bullets
  eBullet(p, v, col = 'pink', size = 1.4, r = 0.42, life = 7, acc = null) {
    const i = this.ebFree.pop();
    if (i === undefined) return null;
    const b = this.eb[i];
    b.alive = true; b.p.copy(p); b.prev.copy(p); b.v.copy(v); b.col = COLS[col] || COLS.pink; b.size = size; b.r = r; b.life = life; b.acc = acc;
    return b;
  }

  aimed(from, speed, spread = 0, n = 1, col = 'pink', size = 1.4, target = null) {
    const d = T3.subVectors(target || this.player.p, from).normalize();
    const u = T4.crossVectors(d, UP).normalize();
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread;
      T5.copy(d).multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a)).multiplyScalar(speed);
      this.eBullet(from, T5, col, size);
    }
  }

  ring(from, n, speed, cone, phase = 0, col = 'pink', size = 1.4, target = null) {
    const d = T3.subVectors(target || this.player.p, from).normalize();
    const u = T4.crossVectors(d, UP).normalize();
    const w = T2.crossVectors(u, d).normalize();
    const cc = Math.cos(cone), sc = Math.sin(cone);
    for (let i = 0; i < n; i++) {
      const th = phase + (i / n) * Math.PI * 2;
      T5.copy(d).multiplyScalar(cc).addScaledVector(u, Math.cos(th) * sc).addScaledVector(w, Math.sin(th) * sc).multiplyScalar(speed);
      this.eBullet(from, T5, col, size);
    }
  }

  cancelBullets(center, radius, score) {
    let n = 0;
    for (let i = 0; i < MAX_EB; i++) {
      const b = this.eb[i];
      if (!b.alive) continue;
      if (center && b.p.distanceTo(center) > radius) continue;
      b.alive = false; this.ebFree.push(i); n++;
      if (score) this.s.fx.particle(b.p.x, b.p.y, b.p.z, rnd(-3, 3), rnd(2, 6), rnd(-3, 3), 0.6, 1.0, 0.2, [5, 4, 1.2], [1.5, 0.6, 0.1]);
    }
    if (score && n) { this.score += n * 10; if (this.player.alive) this.s.hud.popup(`BULLET CANCEL +${n * 10}`, this.player.p, false, 'gold'); }
  }

  raycast(a, b) {
    let best = null, bt = 2;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const A = dx * dx + dy * dy + dz * dz;
    const zmin = Math.min(a.z, b.z), zmax = Math.max(a.z, b.z);
    for (const e of this.enemies) {
      if (!e.alive || e.hidden || e.ghost) continue;
      const c = e.p, r = e.r;
      if (c.z + r < zmin || c.z - r > zmax) continue;
      const fx = a.x - c.x, fy = a.y - c.y, fz = a.z - c.z;
      const B = 2 * (fx * dx + fy * dy + fz * dz), C = fx * fx + fy * fy + fz * fz - r * r;
      let t;
      if (C < 0) t = 0;
      else { const disc = B * B - 4 * A * C; if (disc < 0) continue; t = (-B - Math.sqrt(disc)) / (2 * A); if (t < 0 || t > 1) continue; }
      if (t < bt) { bt = t; best = e; }
    }
    if (!best) return null;
    return { e: best, point: T4.set(a.x + dx * bt, a.y + dy * bt, a.z + dz * bt) };
  }

  updatePlayerBullets(dt) {
    for (const b of this.pb) {
      if (!b.alive) continue;
      b.prev.copy(b.p);
      if (b.target && b.target.alive) {
        const d = T1.subVectors(b.target.p, b.p), dist = d.length();
        if (dist > 1 && dist < 140) b.v.lerp(d.multiplyScalar(360 / dist), clamp(dt * 7, 0, 1));
      }
      b.p.addScaledVector(b.v, dt);
      b.life -= dt;
      if (b.life <= 0 || b.p.z < -340) { b.alive = false; continue; }
      const hit = this.raycast(b.prev, b.p);
      if (hit) { b.alive = false; this.damage(hit.e, 1, hit.point); }
    }
  }

  updateEnemyBullets(dt) {
    const pl = this.player, pp = pl.p, vuln = pl.alive && this.state === 'play' && this.invuln <= 0 && !this.god;
    for (let i = 0; i < MAX_EB; i++) {
      const b = this.eb[i];
      if (!b.alive) continue;
      b.prev.copy(b.p);
      if (b.acc) b.v.addScaledVector(b.acc, dt);
      b.p.addScaledVector(b.v, dt);
      b.life -= dt;
      if (b.life <= 0 || b.p.z > 13 || Math.abs(b.p.x) > 160 || Math.abs(b.p.y) > 120) { b.alive = false; this.ebFree.push(i); continue; }
      if (vuln && b.prev.z <= pp.z + 1.2 && b.p.z >= pp.z - 1.2) {
        const R = PLAYER_R + b.r;
        const dx = b.p.x - b.prev.x, dy = b.p.y - b.prev.y, dz = b.p.z - b.prev.z;
        const L = dx * dx + dy * dy + dz * dz;
        let t = L > 0 ? ((pp.x - b.prev.x) * dx + (pp.y - b.prev.y) * dy + (pp.z - b.prev.z) * dz) / L : 0;
        t = clamp(t, 0, 1);
        const cx = b.prev.x + dx * t - pp.x, cy = b.prev.y + dy * t - pp.y, cz = b.prev.z + dz * t - pp.z;
        if (cx * cx + cy * cy + cz * cz < R * R) { b.alive = false; this.ebFree.push(i); this.hurt(); }
      }
    }
  }

  // ------------------------------------------------------------------ enemies
  spawn(kind, o) {
    const obj = this.s.models.instantiate(kind);
    obj.visible = false;
    this.s.scene.add(obj);
    const e = { kind, obj, p: v3(0, 0, -400), prev: v3(0, 0, -400), v: v3(0, 0, 0), t: 0, si: 0, alive: true, flash: 0, seed: Math.random() * 10, delay: 0, hidden: true, ...STATS[kind], ...o };
    e.maxHp = e.hp;
    this.enemies.push(e);
    return e;
  }

  addPart(o) {
    const e = { kind: 'part', p: v3(0, 0, -400), v: v3(0, 0, 0), alive: true, flash: 0, hp: 1, r: 3, score: 0, hidden: false, ...o };
    e.maxHp = e.hp;
    this.enemies.push(e);
    return e;
  }

  damage(e, dmg, point) {
    if (!e.alive) return false;
    const pan = clamp(point.x / 30, -1, 1);
    if (e.armor || e.invuln) {
      this.s.fx.sparks(point, 4, 16, 'white', 0.22, 0.3);
      this.s.audio.tink(pan);
      return false;
    }
    this.s.fx.sparks(point, 3, 18, e.kind === 'part' ? 'fire' : 'pink', 0.28, 0.32);
    this.s.audio.hit(pan);
    if (e.kind === 'part' && e.shared) { e.boss.hit(dmg * (e.mult || 1), point, e); return true; }
    e.hp -= dmg; e.flash = 1;
    if (e.kind === 'part' && e.boss) e.boss.partHit(e);
    if (e.hp <= 0) {
      if (e.kind === 'part') { e.alive = false; if (e.onKill) e.onKill(e); }
      else this.killEnemy(e, true);
    }
    return true;
  }

  killEnemy(e, byPlayer) {
    if (!e.alive) return;
    e.alive = false;
    const heavy = e.kind === 'heavy';
    this.s.fx.explosion(e.p, heavy ? 2.3 : e.kind === 'missile' ? 0.55 : 1.15, e.kind === 'orb' ? 'gold' : 'fire', { debris: heavy ? 10 : e.kind === 'missile' ? 0 : 4, dim: heavy ? 1 : 0.8 });
    this.s.audio.explode(heavy ? 1 : 0, clamp(e.p.x / 30, -1, 1));
    if (heavy) this.shake(0.45);
    if (byPlayer) { this.kills++; this.addScore(e.score, e.p, heavy); this.laserGauge = Math.min(1, this.laserGauge + (heavy ? 0.2 : 0.045)); }
    this.s.scene.remove(e.obj); Models.dispose(e.obj);
  }

  addScore(base, pos, big = false) {
    if (this.chainTimer > 0) this.chain++; else this.chain = 1;
    this.chainTimer = 1.6;
    this.maxChain = Math.max(this.maxChain, this.chain);
    const mult = Math.min(8, 1 + Math.floor((this.chain - 1) / 3));
    const pts = base * mult;
    this.score += pts;
    this.s.hud.popup(mult > 1 ? `${pts} ×${mult}` : String(pts), pos, big);
    if (this.chain > 1) this.s.audio.chain(this.chain);
  }

  updateEnemies(dt) {
    const pp = this.player.p, vuln = this.player.alive && this.state === 'play' && this.invuln <= 0 && !this.god;
    let dead = false;
    for (const e of this.enemies) {
      if (!e.alive) { dead = true; continue; }
      if (e.kind === 'part') continue;
      e.t += dt;
      e.prev.copy(e.p);
      e.hidden = e.t < e.delay;
      if (!e.hidden) e.move(e, dt, e.t - e.delay);
      if (dt > 0) e.v.subVectors(e.p, e.prev).divideScalar(dt);
      if (e.shots && !e.hidden) {
        while (e.si < e.shots.length && e.t - e.delay >= e.shots[e.si]) {
          if (e.p.z < -24 && e.p.z > -290 && this.state === 'play') e.fire(e, e.si);
          e.si++;
        }
      }
      if (e.escaped) { e.alive = false; dead = true; this.s.scene.remove(e.obj); Models.dispose(e.obj); continue; }
      if (vuln && !e.hidden && Math.abs(e.p.z - pp.z) < e.r + 1) {
        const R = e.r * 0.55 + PLAYER_R;
        if (e.p.distanceToSquared(pp) < R * R) { this.hurt(); this.killEnemy(e, true); dead = true; }
      }
    }
    if (dead) this.enemies = this.enemies.filter((e) => e.alive);
  }

  // ------------------------------------------------------------------ zako waves
  zakoScript() {
    return [
      { t: 0.3, fn: () => this.waveV() },
      { t: 2.7, fn: () => this.waveStrafe(1, 3.8) },
      { t: 4.5, fn: () => this.waveStrafe(-1, -0.8) },
      { t: 6.5, fn: () => this.waveRing() },
      { t: 10.1, fn: () => { this.waveHeavy(); this.waveHelix(10, 95, true); } },
      { t: 12.9, fn: () => this.waveCross() },
    ];
  }

  shot(col = 'pink', speed = 40) { return (e) => this.aimed(e.p, speed, 0, 1, col); }

  stationMove(from, st, exit, tIn, tHold, tOut) {
    const c1 = v3(from.x, from.y, lerp(from.z, st.z, 0.55)), c2 = v3(st.x, st.y + 5, st.z - 40);
    const hold = v3(0, 0, 0), e1 = v3(0, 0, 0);
    return (e, dt, t) => {
      if (t < tIn) bez(e.p, from, c1, c2, st, easeOut(t / tIn));
      else if (t < tIn + tHold) {
        const h = t - tIn;
        e.p.set(st.x + Math.sin(h * 2.3 + e.seed) * 1.3, st.y + Math.sin(h * 3.1 + e.seed) * 0.7, st.z);
        hold.copy(e.p);
      } else {
        const k = (t - tIn - tHold) / tOut;
        e1.set(hold.x, hold.y - 4, hold.z + 25);
        bez(e.p, hold, e1, v3(exit.x, exit.y + 6, exit.z - 30), exit, easeIn(k));
        if (k >= 1) e.escaped = true;
      }
    };
  }

  waveV() {
    for (let i = 0; i < 5; i++) {
      const k = i - 2, a = Math.abs(k);
      this.spawn('dart', {
        delay: a * 0.16,
        move: this.stationMove(v3(k * 7, 10 + a * 2, -330), v3(k * 4.8, 2.6 + a * 1.2, -60 - a * 5), v3(k * 12, -22, 30), 2.1, 1.9, 1.5),
        shots: [2.3 + i * 0.13, 3.4], fire: this.shot('pink', 40),
      });
    }
  }

  waveStrafe(dir, y) {
    for (let i = 0; i < 6; i++) {
      const z = -56 - i * 3.5;
      this.spawn('dart', {
        delay: i * 0.24,
        move: (e, dt, t) => {
          e.p.set(-dir * 78 + dir * t * 33, y + Math.sin(t * 2.6 + i) * 2.2, z + Math.sin(t * 1.4) * 4);
          if (t > 1 && Math.abs(e.p.x) > 82) e.escaped = true;
        },
        shots: [1.9, 2.5], fire: this.shot('violet', 38),
      });
    }
  }

  waveRing() {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      this.spawn('orb', {
        move: (e, dt, t) => {
          let cz, R;
          if (t < 2.4) { const k = easeOut(t / 2.4); cz = lerp(-330, -74, k); R = lerp(18, 9.5, k); }
          else if (t < 6.2) { const h = t - 2.4; cz = -74 + Math.sin(h * 1.2) * 6; R = 9.5 + Math.sin(h * 2.0) * 2.5; }
          else { const h = t - 6.2; cz = -74 - h * h * 12; R = 9.5 + h * h * 10; if (h > 2.4) e.escaped = true; }
          const a = a0 + t * 0.85;
          e.p.set(Math.cos(a) * R, 1.6 + Math.sin(a) * R * 0.78, cz);
        },
        shots: [2.7 + (i % 4) * 0.3, 4.6 + (i % 4) * 0.3], fire: this.shot('orange', 36),
      });
    }
  }

  waveHeavy() {
    for (const s of [-1, 1]) {
      this.spawn('heavy', {
        move: (e, dt, t) => {
          if (t < 2.2) { const k = easeOut(t / 2.2); e.p.set(s * lerp(34, 8.5, k), lerp(16, 2.4, k), lerp(-330, -82, k)); }
          else if (t < 8.6) { const h = t - 2.2; e.p.set(s * (8.5 + Math.sin(h * 0.8) * 3), 2.4 + Math.sin(h * 1.3 + s) * 1.6, -82 + Math.sin(h * 0.6) * 5); }
          else { const h = t - 8.6; e.p.set(s * (8.5 + h * h * 9), 2.4 + h * h * 6, -82 - h * 45); if (h > 2.4) e.escaped = true; }
        },
        shots: [2.6 + (s > 0 ? 0.5 : 0), 4.3 + (s > 0 ? 0.5 : 0), 6.0 + (s > 0 ? 0.5 : 0), 7.7 + (s > 0 ? 0.5 : 0)],
        fire: (e, i) => (i % 2 ? this.ring(e.p, 14, 36, 0.13, Math.random() * 6.28, 'orange', 1.5) : this.aimed(e.p, 40, 0.55, 5, 'orange', 1.5)),
      });
    }
  }

  waveHelix(n, speed, fires) {
    for (let i = 0; i < n; i++) {
      const ph = (i % 2) * Math.PI;
      this.spawn('dart', {
        delay: i * 0.19,
        move: (e, dt, t) => {
          const z = -330 + t * speed;
          const R = 7.5 + Math.max(0, (z + 70) * 0.06);
          const a = t * 2.3 + ph;
          e.p.set(Math.cos(a) * R, 1.5 + Math.sin(a) * R * 0.75, z);
          if (z > 30) e.escaped = true;
        },
        shots: fires ? [(330 - 85) / speed] : [], fire: this.shot('pink', 42),
      });
    }
  }

  waveCross() {
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const from = v3(s * -44, 15 - i, -310), c1 = v3(s * -30, 11, -130), c2 = v3(s * 8, 3, -64), to = v3(s * 46, -12 - i * 2, -24);
      this.spawn('dart', {
        delay: i * 0.26 + (s > 0 ? 0.55 : 0),
        move: (e, dt, t) => { const k = t / 3.4; bez(e.p, from, c1, c2, to, k < 1 ? k : 1); if (k >= 1) e.escaped = true; },
        shots: [2.0], fire: this.shot('violet', 40),
      });
    }
  }

  spawnMissile(from, dir) {
    const vel = dir.clone().multiplyScalar(14);
    return this.spawn('missile', {
      vel,
      move: (e, dt, t) => {
        const want = T1.subVectors(this.player.p, e.p).normalize().multiplyScalar(t < 0.7 ? 10 : 25);
        e.vel.lerp(want, clamp((t < 0.7 ? 0.8 : 1.7) * dt, 0, 1));
        e.p.addScaledVector(e.vel, dt);
        if (e.p.z > 12 || t > 9) e.escaped = true;
      },
      init: true,
    });
  }

  // ------------------------------------------------------------------ homing lasers
  targets() {
    return this.enemies.filter((e) => e.alive && !e.hidden && !e.armor && !e.invuln && !e.ghost && e.p.z < 2 && e.p.z > -300);
  }

  fireLasers() {
    if (this.laserGauge < 1 || !this.player.alive) return;
    this.laserGauge = 0;
    const pp = this.player.p;
    const tg = this.targets().sort((a, b) => (b.prio || 0) - (a.prio || 0) || a.p.distanceToSquared(pp) - b.p.distanceToSquared(pp));
    const n = 12;
    for (let i = 0; i < n; i++) {
      const target = tg.length ? tg[i % Math.min(tg.length, 6)] : null;
      const a = (i / n) * Math.PI * 2 + rnd(-0.2, 0.2);
      const v = v3(Math.cos(a) * 24, Math.sin(a) * 17 + 5, rnd(-16, -6));
      this.lasers.push({ p: pp.clone(), prev: pp.clone(), trail: pp.clone(), v, target, t: 0, life: 2.8, dmg: 4, hue: i % 2 });
    }
    this.s.audio.laserLaunch(n);
    this.s.fx.flash(pp, 3, 0.18, [1.5, 0.6, 1.2]);
  }

  updateLasers(dt) {
    let done = false;
    for (const L of this.lasers) {
      L.t += dt; L.life -= dt;
      if (L.target && !L.target.alive) { const tg = this.targets(); L.target = tg.length ? tg[Math.floor(Math.random() * tg.length)] : null; }
      const speed = 45 + Math.min(1, L.t / 0.6) * 270;
      const want = L.target ? T1.subVectors(L.target.p, L.p).normalize().multiplyScalar(speed) : T1.set(0, 0, -speed);
      L.v.lerp(want, clamp((2 + L.t * 16) * dt, 0, 1));
      L.p.addScaledVector(L.v, dt);
      if (L.target && L.p.distanceTo(L.target.p) < L.target.r + 1) {
        this.damage(L.target, L.dmg, L.p);
        this.s.fx.explosion(L.p, 0.4, L.hue ? 'pink' : 'blue', { debris: 0, noRing: true, dim: 0.6, n: 0.5 });
        L.life = 0;
      }
      if (L.life <= 0 || L.p.z < -360) done = true;
    }
    if (done) this.lasers = this.lasers.filter((L) => L.life > 0 && L.p.z >= -360);
  }

  // ------------------------------------------------------------------ autopilot (debug / demo)
  autopilot() {
    const pp = this.player.p;
    let tx = 0, ty = 0;
    const tg = this.lock || this.targets()[0];
    if (tg) { tx = clamp(tg.p.x * 0.9, -10, 10); ty = clamp(tg.p.y - 1.5, -5, 6); }
    let dx = 0, dy = 0;
    for (const b of this.eb) {
      if (!b.alive || b.v.z <= 0 || b.p.z > pp.z) continue;
      const tt = (pp.z - b.p.z) / b.v.z;
      if (tt > 0.9) continue;
      const bx = b.p.x + b.v.x * tt - pp.x, by = b.p.y + b.v.y * tt - pp.y;
      const d = Math.hypot(bx, by);
      if (d < 2.6) { dx -= bx / (d + 0.1) * (2.6 - d); dy -= by / (d + 0.1) * (2.6 - d); }
    }
    const bt = this.boss && this.boss.beamThreat();
    if (bt) {
      const off = (bt.axis === 'y' ? pp.y : pp.x) - bt.v;
      const push = Math.abs(off) < 5 ? (off >= 0 ? 1 : -1) * 3 : 0;
      if (bt.axis === 'y') { dy += push; ty = pp.y; } else { dx += push; tx = pp.x; }
    }
    if (this.laserGauge >= 1 && this.targets().length) this.input.laser = true;
    return [clamp((tx - pp.x) * 0.35 + dx * 1.4, -1, 1), clamp((ty - pp.y) * 0.35 + dy * 1.4, -1, 1)];
  }

  // ------------------------------------------------------------------ per-frame visuals
  toScreen(v, camera, w, h, out) {
    T5.copy(v).project(camera);
    out.x = (T5.x * 0.5 + 0.5) * w; out.y = (-T5.y * 0.5 + 0.5) * h;
    out.on = T5.z < 1 && Math.abs(T5.x) < 1.15 && Math.abs(T5.y) < 1.15;
    return out;
  }

  updateAim(camera, w, h) {
    const pl = this.player.p, inp = this.input, sc = this._sc || (this._sc = {}), fw = this._fw || (this._fw = {});
    const fwd = T1.set(pl.x, pl.y + 0.4, -75);
    this.toScreen(fwd, camera, w, h, fw);
    const R = h * 0.11, cone = 0.44;
    let best = null, bd = inp.mouseAim ? R * R : cone, bx = 0, by = 0;
    const playing = (this.state === 'play' && this.phase !== 'clear' && this.boss?.state !== 'dying') || (this.state === 'intro' && this.warped);
    if (playing) for (const e of this.enemies) {
      if (!e.alive || e.hidden || e.armor || e.invuln || e.ghost || e.p.z > -8 || e.p.z < -300) continue;
      let score;
      if (inp.mouseAim) {
        this.toScreen(e.p, camera, w, h, sc);
        if (!sc.on) continue;
        const dx = sc.x - inp.mx, dy = sc.y - inp.my;
        score = dx * dx + dy * dy - (e.prio || 0) * R * R * 0.3;
      } else {
        const dx = e.p.x - pl.x, dy = e.p.y - pl.y - 0.4, dz = pl.z - e.p.z;
        score = Math.atan2(Math.hypot(dx, dy), dz) - (e.prio || 0) * 0.07;
      }
      if (score < bd) { bd = score; best = e; }
    }
    if (best) { this.toScreen(best.p, camera, w, h, sc); bx = sc.x; by = sc.y; }
    if (best && best !== this.lock) this.s.audio.lock();
    this.lock = best;
    let tx, ty;
    if (best) {
      const dist = best.p.distanceTo(pl);
      this.aimPoint.copy(best.p).addScaledVector(best.v, dist / 360);
      tx = bx; ty = by;
    } else if (inp.mouseAim) {
      T2.set((inp.mx / w) * 2 - 1, -(inp.my / h) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
      const k = (-75 - camera.position.z) / T2.z;
      this.aimPoint.copy(camera.position).addScaledVector(T2, k);
      tx = inp.mx; ty = inp.my;
    } else { this.aimPoint.copy(fwd); tx = fw.x; ty = fw.y; }
    const r = this.reticle;
    if (!r.visible) { r.x = tx; r.y = ty; }
    const k = best ? 0.45 : 0.3;
    r.x += (tx - r.x) * k; r.y += (ty - r.y) * k;
    r.lock = !!best; r.visible = playing && this.player.alive;
  }

  sync(dt, camera) {
    const pl = this.player, c = this.cine;
    pl.body.rotation.set(pl.pitch, pl.bank * 0.1, pl.bank + pl.roll);
    pl.body.position.z = -c.kick * 5;
    const blink = this.invuln > 0 && this.state === 'play' && Math.floor(this.time * 20) % 2 === 0;
    pl.body.visible = !blink;
    const power = this.state === 'title' || c.speed > 600 ? 1.6 : this.phase === 'boost' ? 1.4 : 1 + Math.max(0, -pl.v.y * 0.01);
    pl.flameMat.uniforms.uTime.value = this.time;
    pl.flameMat.uniforms.uPower.value = power;
    for (const f of pl.flames) f.scale.set(1, 1, power * (0.85 + Math.random() * 0.3));
    pl.core.material.opacity = 0.6 + 0.4 * Math.sin(this.time * 10);
    if (pl.alive && pl.root.visible) {
      pl.root.updateMatrixWorld(true);
      for (const n of pl.nozzles) {
        if (Math.random() > dt * 60) continue;
        T1.copy(n).applyMatrix4(pl.body.matrixWorld);
        this.s.fx.particle(T1.x + rnd(-0.08, 0.08), T1.y + rnd(-0.08, 0.08), T1.z, rnd(-1, 1), rnd(-1, 1), 30 + c.speed * 0.05, 0.14, 0.5 * power, 0.08, [0.3, 0.7, 1.8], [0.25, 0.1, 0.7]);
      }
    }
    const pp = pl.p;
    for (const e of this.enemies) {
      if (e.kind === 'part' || !e.alive) continue;
      const o = e.obj;
      o.visible = !e.hidden;
      if (e.hidden) continue;
      o.position.copy(e.p);
      if (e.kind === 'dart' || e.kind === 'missile') {
        T1.copy(e.v);
        if (T1.lengthSq() < 9 || e.kind === 'dart') T1.lerp(T2.subVectors(pp, e.p).normalize().multiplyScalar(T1.length() + 20), e.kind === 'dart' ? 0.55 : 0);
        o.lookAt(T3.copy(e.p).add(T1));
        o.rotateZ(clamp(-e.v.x * 0.03, -0.9, 0.9));
        if (e.kind === 'missile' && Math.random() < dt * 48) this.s.fx.particle(e.p.x, e.p.y, e.p.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 0.35, 1.1, 0.3, [5, 2, 0.6], [0.6, 0.1, 0.05]);
      } else {
        o.lookAt(pp);
        if (e.kind === 'orb') { const ring = o.getObjectByName('ring'), sp = o.getObjectByName('spin'); if (ring) ring.rotation.z += dt * 2.5; if (sp) sp.rotation.y += dt * 3; }
        else o.rotateZ(Math.sin(this.time * 1.5 + e.seed) * 0.15);
      }
      if (e.flash > 0) { e.flash = Math.max(0, e.flash - dt * 7); Models.flash(o, e.flash); }
    }
    const arr = this.pbMesh.instanceMatrix.array;
    let n = 0;
    for (const b of this.pb) {
      if (!b.alive) continue;
      Q.setFromUnitVectors(ZAXIS, T1.copy(b.v).normalize());
      M4.compose(b.p, Q, SV.set(1, 1, 1));
      M4.toArray(arr, n * 16); n++;
    }
    this.pbMesh.count = n;
    this.pbMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < MAX_EB; i++) {
      const b = this.eb[i];
      if (!b.alive) { this.ebSize[i] = 0; continue; }
      this.ebPos[i * 3] = b.p.x; this.ebPos[i * 3 + 1] = b.p.y; this.ebPos[i * 3 + 2] = b.p.z;
      this.ebCol[i * 3] = b.col[0]; this.ebCol[i * 3 + 1] = b.col[1]; this.ebCol[i * 3 + 2] = b.col[2];
      const pulse = 1 + 0.12 * Math.sin(this.time * 18 + i);
      this.ebSize[i] = b.size * 0.85 * pulse * (b.p.z > -1 ? clamp((6 - b.p.z) / 7, 0, 1) : 1);
    }
    const g = this.ebPoints.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aColor.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
    const blue = [[0.8, 1.8, 3.7], [0.15, 0.22, 1.2]], pink = [[3.4, 0.8, 2.2], [0.9, 0.08, 0.6]];
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    for (const L of this.lasers) {
      // Spacing follows on-screen length (in world units at the segment's depth): a trail flying straight away
      // from the camera would otherwise stack dozens of sprites onto the same pixels.
      T1.copy(L.trail).project(camera); T2.copy(L.p).project(camera);
      const depth = Math.max(1, camera.position.z - (L.p.z + L.trail.z) / 2);
      const scr = Math.hypot((T2.x - T1.x) * camera.aspect, T2.y - T1.y) * depth * tanH;
      const d = L.p.distanceTo(L.trail), steps = d > 0 ? Math.min(48, Math.max(1, Math.ceil(Math.min(d, scr) / 0.65))) : 0;
      // All twelve trails start on top of the ship close to the lens; they ignite as they spread out.
      const pal = L.hue ? pink : blue, a = Math.min(1, 0.3 + L.t * 2.5);
      for (let s = 1; s <= steps; s++) {
        T1.lerpVectors(L.trail, L.p, s / steps);
        this.s.fx.trail(T1.x, T1.y, T1.z, pal[0], pal[1], 0.85, 0.3, a);
      }
      L.trail.copy(L.p);
    }
  }
}

import * as THREE from 'three';
import { Watercolor } from './post.js';
import { buildWorld } from './world.js';
import { SPECIES, PLAYABLE, buildAnimal } from './animals.js';
import { AudioEngine, CALL_TEXT } from './audio.js';
import { FX } from './fx.js';
import { Ambient } from './ambient.js';
import { Player, NPC, CameraRig, Interactions } from './actors.js';
import { UI } from './ui.js';
import * as L from './layout.js';
import { SHARED, clamp, lerp, damp, easeInOut, rand, pick, TAU, segDist } from './util.js';

const NPC_DEFS = [
  { species: 'horse', name: 'Barnaby', variant: 'bay', home: 'paddock', x: -24, z: -38 },
  { species: 'horse', name: 'Juniper', variant: 'grey', home: 'paddock', x: -34, z: -46 },
  { species: 'cow', name: 'Clover', home: 'meadow', x: 16, z: -38 },
  { species: 'cow', name: 'Buttercup', home: 'meadow', x: 27, z: -49 },
  { species: 'pig', name: 'Pip', home: 'sty', x: -35, z: 1 },
  { species: 'pig', name: 'Truffle', home: 'sty', x: -32.5, z: 2.6 },
  { species: 'cat', name: 'Tibbles', variant: 'grey', home: 'porch', x: 14, z: -5 },
  { species: 'dog', name: 'Kip', home: 'yard', x: 3, z: 3 },
  { species: 'sheep', name: 'Woolly', home: 'hillside', x: -42, z: 45 },
  { species: 'sheep', name: 'Bramble', home: 'hillside', x: -46, z: 51 },
  { species: 'sheep', name: 'Dot', home: 'hillside', x: -38, z: 49 },
  { species: 'duck', name: 'Dilly', variant: 'jemima', home: 'pondShore', x: -1, z: 34.5 },
  { species: 'duck', name: 'Puddle', variant: 'mallard', home: 'pond', swim: true, x: 4, z: 44 },
  { species: 'duck', name: 'Dabble', variant: 'white', home: 'pond', swim: true, x: 8, z: 47 },
  { species: 'hen', name: 'Henny', variant: 'brown', home: 'hens', x: 8, z: 7 },
  { species: 'hen', name: 'Speckles', variant: 'white', home: 'hens', x: 10, z: 9.5 },
  { species: 'hen', name: 'Marigold', variant: 'brown', home: 'hens', x: 6, z: 9 },
  { species: 'rabbit', name: 'Rufus', home: 'garden', x: -29, z: 21.5 },
  { species: 'hedgehog', name: 'Mrs. Prickles', home: 'village', x: 68, z: 5 },
  { species: 'cat', name: 'Marmalade', home: 'green', x: 56, z: -13 },
];

const TASKS = [
  { id: 'boop', text: 'Boop a friend on the nose' },
  { id: 'friends', text: 'Make friends with 4 kinds of animal', goal: 4 },
  { id: 'drink', text: 'Have a drink of water' },
  { id: 'hay', text: 'Munch some hay' },
  { id: 'fruit', text: 'Eat some fruit' },
  { id: 'rabbit', text: 'Find the rabbit in the blue jacket' },
  { id: 'village', text: 'Visit Bramblewick village' },
  { id: 'hill', text: 'Climb to the top of Lookout Hill' },
];

const MENU_ANGLE = 0.69;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

class Game {
  constructor() {
    this.state = 'loading';
    this.species = 'pig';
    this.hearts = 0;
    this.tasks = TASKS.map((t) => ({ ...t, done: false, n: 0 }));
    this.metSpecies = new Set();
    this.input = { forward: false, back: false, left: false, right: false, run: false };
    this.t = 0;
    this.trans = null;
    this.pauseK = 0;
    this.fade = 0;
    this.placeName = null;
    this.placeTimer = 0;
    this.lastPlaceShown = {};
    this.playTime = 0;
    this.debugCam = null;
    this.menuT = 0;
    this.menuHopT = 2;
  }

  async boot() {
    const ui = (this.ui = new UI(this));
    try {
      await Promise.race([
        Promise.all([document.fonts.load('italic 40px "IM Fell English"'), document.fonts.load('40px "IM Fell English SC"'), document.fonts.load('40px "IM Fell English"')]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch (e) { /* fonts are a nicety */ }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    } catch (e) {
      ui.error('This little farm needs WebGL, which this browser could not start. Please try another browser.');
      return;
    }
    this.renderer = renderer;
    this.quality = 2;
    this.perf = { t: 0, n: 0, sum: 0 };
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor('#efe8d6');
    document.getElementById('stage').appendChild(renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.2, 1500);
    this.post = new Watercolor(renderer);
    this.onResize();
    await nextFrame();

    this.world = buildWorld(this.scene, renderer);
    this.audio = new AudioEngine();
    this.audio.hives = this.world.hives;
    this.audio.pond = this.world.pond;
    this.audio.bell = this.world.bell;
    this.fx = new FX(this.scene, this.camera, document.getElementById('labels'));
    this.ambient = new Ambient(this.scene, this.world, this.audio, this.fx);
    this.world.onFruitLand = (f) => this.audio.sfx('thud', { pos: f.mesh.position, gain: 0.6 });
    this.npcs = NPC_DEFS.map((d) => new NPC(this, d));
    this.camRig = new CameraRig(this.camera, this.world);
    this.interactions = new Interactions(this);
    this.makePlayer(this.species);
    this.placeForMenu();

    await nextFrame();
    this.renderPortraits().catch((e) => console.warn('portraits', e));
    ui.setSelected(this.species);
    ui.setSound(this.audio.enabled);
    ui.renderJobs(this.tasks);
    ui.setHearts(0, false);

    this.bindInput();
    window.addEventListener('resize', () => this.onResize());
    this.state = 'menu';
    this.menuCamera(0, true);
    this.applyVignette(0, 0);
    renderer.compile(this.scene, this.camera);
    this.last = performance.now();
    this.render();
    ui.showMenu();
    ui.loaded();
    renderer.setAnimationLoop((now) => this.loop(now));
  }

  /* ---------------------------------------------------------------- player & menu */

  makePlayer(species) {
    if (this.player) this.player.dispose();
    this.species = species;
    this.player = new Player(this, species);
  }

  placeForMenu() {
    this.player.place(L.MENU_SPOT.x, L.MENU_SPOT.z, MENU_ANGLE - 0.55);
  }

  selectSpecies(s) {
    if (this.state !== 'menu' || s === this.species) {
      if (s === this.species && this.state === 'menu') this.menuHello();
      return;
    }
    this.makePlayer(s);
    this.placeForMenu();
    this.ui.setSelected(s);
    this.audio.sfx('page', { gain: 0.8 });
    this.menuHello();
  }

  menuHello() {
    const p = this.player;
    p.hop(3.5);
    p.pose.squash = -0.5;
    const d = this.audio.call(p.species, {});
    this.fx.say(p, pick(CALL_TEXT[p.species]), { me: true, dur: Math.max(1.5, d + 0.4) });
    p.pose.talk = 1;
    setTimeout(() => { if (this.player === p) p.pose.talk = 0; }, 900);
  }

  cycleSpecies(dir) {
    const i = PLAYABLE.indexOf(this.species);
    this.selectSpecies(PLAYABLE[(i + dir + PLAYABLE.length) % PLAYABLE.length]);
  }

  async renderPortraits() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#efe7d4');
    scene.add(new THREE.HemisphereLight('#e2eaee', '#8f8a62', 1.7));
    const sun = new THREE.DirectionalLight('#fff0d6', 2.6);
    sun.position.set(-2, 4, 3);
    scene.add(sun);
    const grass = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshLambertMaterial({ color: '#9fb36c' }));
    grass.rotation.x = -Math.PI / 2;
    scene.add(grass);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
    const jobs = [];
    for (const s of PLAYABLE) {
      const rig = buildAnimal(s);
      rig.root.rotation.y = 0.95;
      scene.add(rig.root);
      const h = rig.world.height, len = rig.world.len;
      const size = Math.max(h, len * 0.85);
      const fwd = new THREE.Vector3(Math.sin(0.95), 0, Math.cos(0.95));
      const target = new THREE.Vector3(0, h * 0.56, 0).addScaledVector(fwd, len * 0.12);
      const dist = size * 2.55;
      cam.position.set(target.x + Math.sin(0.12) * dist, h * 0.62 + size * 0.28, target.z + Math.cos(0.12) * dist);
      cam.lookAt(target);
      grass.scale.setScalar(size);
      const job = this.post.portrait(scene, cam, 200);
      rig.root.removeFromParent();
      jobs.push(job.then((url) => this.ui.setPortrait(s, url)));
    }
    await Promise.all(jobs);
  }

  menuCamera(dt, snap = false) {
    const p = this.player;
    const h = p.height, len = p.rig.world.len;
    const size = Math.max(h, len * 0.75);
    const a = MENU_ANGLE + Math.sin(this.menuT * 0.11) * 0.22;
    const dist = size * 2.2 + 1.4;
    const pos = new THREE.Vector3(p.pos.x + Math.sin(a) * dist, p.y + h * 0.55 + size * 0.35 + 0.3, p.pos.z + Math.cos(a) * dist);
    const look = new THREE.Vector3(p.pos.x, p.y + h * 0.5, p.pos.z);
    if (snap || !this.menuPos) { this.menuPos = pos.clone(); this.menuLook = look.clone(); }
    else {
      this.menuPos.lerp(pos, 1 - Math.exp(-3 * dt));
      this.menuLook.lerp(look, 1 - Math.exp(-4 * dt));
    }
    return { pos: this.menuPos, look: this.menuLook };
  }

  /* ---------------------------------------------------------------- states */

  start() {
    if (this.state !== 'menu') return;
    this.audio.init();
    this.audio.sfx('page');
    this.ui.hideMenu();
    this.fx.clearLabels();
    this.state = 'intro';
    const from = this.menuCamera(0);
    this.trans = { t: 0, dur: 1.7, fromPos: from.pos.clone(), fromLook: from.look.clone(), startYaw: Math.PI + 0.35 };
    this.camRig.yaw = this.player.yaw;
    this.camRig.follow(this.player, 0, true);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.audio.sfx('page', { gain: 0.7 });
    this.ui.showPause(this.species);
    this.ui.showHUD(false);
    this.fx.setPrompt(null);
    for (const k in this.input) this.input[k] = false;
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.audio.sfx('page', { gain: 0.7 });
    this.ui.hidePause();
    this.ui.showHUD(true);
    this.last = performance.now();
  }

  respawn() {
    this.interactions.reset();
    this.fx.clearLabels();
    this.player.place(L.SPAWN.x, L.SPAWN.z, L.SPAWN.yaw);
    this.player.speed = 0;
    this.player.moveSpeed = 0;
    this.camRig.orbitYaw = 0;
    this.camRig.follow(this.player, 0, true);
    this.fade = 1;
    if (this.state === 'paused') this.resume();
    this.ui.toast('Back to the farmyard!', 2.2);
  }

  toMenu() {
    this.interactions.reset();
    this.fx.clearLabels();
    this.ui.hidePause();
    this.ui.showHUD(false);
    this.state = 'menu';
    this.pauseK = 0;
    this.placeForMenu();
    this.menuCamera(0, true);
    this.fade = 1;
    this.ui.showMenu();
    this.ui.setSelected(this.species);
  }

  toggleSound() {
    this.audio.init();
    this.audio.setEnabled(!this.audio.enabled);
    this.ui.setSound(this.audio.enabled);
    if (this.audio.enabled) this.audio.sfx('click');
  }

  /* ---------------------------------------------------------------- tasks & rewards */

  addHearts(n, npc, pos) {
    this.hearts += n;
    this.ui.setHearts(this.hearts);
  }

  complete(id) {
    const t = this.tasks.find((k) => k.id === id);
    if (!t || t.done) return;
    t.done = true;
    this.ui.renderJobs(this.tasks, id);
    const all = this.tasks.every((k) => k.done);
    if (all) {
      this.audio.sfx('fanfare');
      this.ui.toast('<b>&#9829;</b> What a perfect day on the farm! Every little job is done. <b>&#9829;</b>', 6);
      const p = this.player;
      for (let i = 0; i < 3; i++) setTimeout(() => this.fx.hearts(p.getLabelPos(new THREE.Vector3()), 8, 0.45), i * 350);
    } else {
      this.audio.sfx('sparkle');
      this.ui.toast(`<b>&#10003;</b> ${t.text}!`, 3);
    }
  }

  event(kind, obj) {
    if (kind === 'boop') this.complete('boop');
    if (kind === 'friend' && obj && obj.species) {
      this.metSpecies.add(obj.species);
      const t = this.tasks.find((k) => k.id === 'friends');
      if (!t.done) {
        t.n = Math.min(t.goal, this.metSpecies.size);
        if (t.n >= t.goal) this.complete('friends'); else this.ui.renderJobs(this.tasks);
      }
      if (obj.species === 'rabbit') this.complete('rabbit');
    }
    if (kind === 'drink') this.complete('drink');
    if (kind === 'hay') this.complete('hay');
    if (kind === 'fruit') this.complete('fruit');
  }

  checkPlaces(dt) {
    this.placeTimer -= dt;
    if (this.placeTimer > 0) return;
    this.placeTimer = 0.4;
    const p = this.player.pos;
    let found = null;
    for (const pl of L.PLACES) {
      const inside = pl.type === 'circle' ? Math.hypot(p.x - pl.x, p.z - pl.z) < pl.r : p.x > pl.x0 && p.x < pl.x1 && p.z > pl.z0 && p.z < pl.z1;
      if (inside) { found = pl; break; }
    }
    const name = found ? found.name : null;
    if (name !== this.placeName) {
      this.placeName = name;
      if (found && (!this.lastPlaceShown[name] || this.playTime - this.lastPlaceShown[name] > 40)) {
        this.lastPlaceShown[name] = this.playTime;
        this.ui.place(found.name, found.sub);
      }
      if (name === 'Bramblewick Village') this.complete('village');
    }
    const hillTop = this.world.heightAt(L.HILL.x, L.HILL.z);
    if (Math.hypot(p.x - L.HILL.x, p.z - L.HILL.z) < 6.5 && this.player.y > hillTop - 1.2) this.complete('hill');
  }

  /* ---------------------------------------------------------------- input */

  bindInput() {
    const map = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run' };
    window.addEventListener('keydown', (e) => {
      if (this.state === 'loading') return;
      this.audio.init();
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
      if (this.state === 'menu') {
        if (k === 'ArrowLeft' || k === 'KeyA') this.cycleSpecies(-1);
        else if (k === 'ArrowRight' || k === 'KeyD') this.cycleSpecies(1);
        else if ((k === 'Enter' || k === 'Space') && !e.repeat) {
          const focusCard = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('animal-card');
          if (k === 'Enter' && document.activeElement && document.activeElement.tagName === 'BUTTON' && !focusCard) return;
          this.start();
        }
        return;
      }
      if (k === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        return;
      }
      if (this.state === 'paused') {
        if (k === 'Enter' && document.activeElement && document.activeElement.tagName === 'BUTTON') return;
        if (k === 'Enter' || k === 'Space') this.resume();
        return;
      }
      if (k === 'Tab') { this.ui.toggleJobs(); return; }
      if (map[k]) this.input[map[k]] = true;
      if (k === 'Space' && !e.repeat && this.state === 'playing') {
        if (!this.interactions.trigger()) this.player.requestJump();
        this.movedOrJumped = (this.movedOrJumped || 0) | 2;
      }
    });
    window.addEventListener('keyup', (e) => {
      const map2 = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run' };
      if (map2[e.code]) this.input[map2[e.code]] = false;
    });
    window.addEventListener('blur', () => { for (const k in this.input) this.input[k] = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    const cv = this.renderer.domElement;
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { this.audio.init(); if (this.state === 'playing') { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); } });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      this.camRig.orbitYaw -= dx * 0.006;
      this.camRig.orbitPitch = clamp(this.camRig.orbitPitch + dy * 0.004, -0.45, 0.9);
      this.camRig.idleOrbit = 2.5;
    });
    const end = () => { drag = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') return;
      e.preventDefault();
      this.camRig.userZoom = clamp(this.camRig.userZoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.6, 1.7);
    }, { passive: false });
    window.addEventListener('pointerdown', () => this.audio.init(), { once: true });
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.post.setSize(w, h, this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.W = w; this.H = h;
  }

  /*
   * Gentle adaptive quality for slower graphics chips: if play sits between roughly 4 and 29 fps,
   * step down the render resolution and anti-aliasing. Much slower than that means a software
   * renderer, where these steps would not help, so the picture is left alone.
   */
  adaptQuality(now) {
    const P = this.perf;
    const frame = now - (P.last || now);
    P.last = now;
    if (this.quality <= 0 || this.playTime < 2 || frame <= 0 || frame > 1000) return;
    P.sum += frame; P.n++;
    if (P.n < 90) return;
    const avg = P.sum / P.n;
    P.sum = 0; P.n = 0;
    if (avg > 34 && avg < 250) {
      this.quality--;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      this.renderer.setPixelRatio(this.quality === 1 ? Math.min(dpr, 1) : Math.min(dpr, 0.8));
      this.post.sceneRT.samples = this.quality === 1 ? 2 : 0;
      this.post.sceneRT.dispose();
      this.onResize();
      console.info(`Bramblewick: easing render quality to level ${this.quality} (avg frame ${avg.toFixed(0)} ms)`);
    }
  }

  /* ---------------------------------------------------------------- the page / vignette */

  pageLayout() {
    const W = this.W, H = this.H;
    const narrow = W / H < 1;
    const pageW = narrow ? 0 : W * 0.46;
    const cx = narrow ? 0.5 : (pageW + (W - pageW) / 2) / W;
    const ry = narrow ? 0.36 : 0.43;
    const rx = narrow ? 0.46 : Math.min(0.265, ry * (H / W) * 1.1);
    return { cx, cy: narrow ? 0.34 : 0.5, rx, ry };
  }

  /* k: 0 = storybook page (menu / pause), 1 = full illustration (playing) */
  applyVignette(k) {
    const u = this.post.material.uniforms;
    const pg = this.pageLayout();
    const e = easeInOut(clamp(k, 0, 1));
    u.vigCenter.value.set(lerp(pg.cx, 0.5, e), lerp(pg.cy, 0.5, e));
    u.vigRadius.value.set(lerp(pg.rx, 0.64, e), lerp(pg.ry, 0.68, e));
    u.vigPower.value = lerp(2.2, 5.5, e);
    u.vigSoft.value = lerp(0.36, 0.2, e);
    u.fadeToPaper.value = this.fade;
    // speech bubbles show only where the illustration does, never on the plain paper around it
    const mask = e < 0.99
      ? `radial-gradient(ellipse ${Math.round(u.vigRadius.value.x * this.W)}px ${Math.round(u.vigRadius.value.y * this.H)}px at ${Math.round(u.vigCenter.value.x * this.W)}px ${Math.round((1 - u.vigCenter.value.y) * this.H)}px, #000 ${Math.round((1 - u.vigSoft.value) * 100)}%, transparent 100%)`
      : '';
    if (mask !== this.labelMask) {
      this.labelMask = mask;
      const s = this.fx.labelsEl.style;
      s.maskImage = s.webkitMaskImage = mask;
    }
    const off = -(u.vigCenter.value.x - 0.5) * this.W;
    const offY = (u.vigCenter.value.y - 0.5) * this.H;
    if (Math.abs(off) > 0.5 || Math.abs(offY) > 0.5) this.camera.setViewOffset(this.W, this.H, off, offY, this.W, this.H);
    else this.camera.clearViewOffset();
  }

  /* ---------------------------------------------------------------- main loop */

  loop(now) {
    const dt = Math.min((now - this.last) / 1000, this.maxDt || 0.1);
    this.last = now;
    if (this.state === 'loading') return;
    const paused = this.state === 'paused';
    if (!paused) { this.t += dt; SHARED.time.value = this.t; }
    this.fade = damp(this.fade, 0, 3, dt);
    const pl = this.player;

    if (this.state === 'menu') {
      this.menuT += dt;
      pl.moveSpeed = 0;
      pl.verticalStep(dt, (imp) => { if (imp > 3) { pl.pose.squash = 0.6; this.fx.dust(new THREE.Vector3(pl.pos.x, pl.y + 0.05, pl.pos.z), 4, 0.4); } });
      pl.pose.lookYaw = Math.sin(this.menuT * 0.5) * 0.35;
      this.menuHopT -= dt;
      if (this.menuHopT < 0) { this.menuHopT = rand(5, 9); pl.hop(2.5); }
      pl.sync(dt);
      for (const n of this.npcs) { n.update(dt, pl); n.sync(dt); }
      const mc = this.menuCamera(dt);
      this.camera.position.copy(mc.pos);
      this.camera.lookAt(mc.look);
      this.applyVignette(0);
    } else if (this.state === 'intro') {
      const T = this.trans;
      T.t += dt;
      const k = clamp(T.t / T.dur, 0, 1);
      const e = easeInOut(k);
      pl.yaw = lerpAngle(pl.yaw, T.startYaw, 1 - Math.exp(-3.5 * dt));
      pl.moveSpeed = Math.abs(Math.sin(k * Math.PI)) * 1.2;
      pl.verticalStep(dt);
      pl.sync(dt);
      for (const n of this.npcs) { n.update(dt, pl); n.sync(dt); }
      this.camRig.follow(pl, dt, k < 0.05);
      this.camera.position.lerpVectors(T.fromPos, this.camRig.pos, e);
      const look = new THREE.Vector3().lerpVectors(T.fromLook, this.camRig.look, e);
      this.camera.lookAt(look);
      this.applyVignette(k);
      if (k >= 1) {
        this.state = 'playing';
        this.ui.showHUD(true);
        this.ui.hint(true);
        this.playTime = 0;
        this.placeName = null;
        this.camRig.follow(pl, 0, true);
        this.ui.toast(`You are a <b>${SPECIES[this.species].label.toLowerCase()}</b>! Wander about and say hello.`, 3.4);
      }
    } else if (this.state === 'playing') {
      this.playTime += dt;
      if (!this.skipRender) this.adaptQuality(now);
      pl.update(dt, this.input);
      this.interactions.update(dt);
      pl.sync(dt);
      for (const n of this.npcs) { n.update(dt, pl); n.sync(dt); }
      this.checkPlaces(dt);
      this.camRig.follow(pl, dt);
      this.camRig.apply();
      this.pauseK = damp(this.pauseK, 0, 6, dt);
      this.applyVignette(1 - this.pauseK);
      if (this.playTime > 16 || (this.playTime > 6 && pl.speedAbs > 0.5 && (this.movedOrJumped & 2))) this.ui.hint(false);
    } else if (paused) {
      this.pauseK = damp(this.pauseK, 1, 6, dt);
      this.camRig.apply();
      this.applyVignette(1 - this.pauseK);
    }

    if (this.debugCam) {
      this.camera.clearViewOffset();
      this.camera.position.copy(this.debugCam.pos);
      this.camera.lookAt(this.debugCam.look);
    }

    const focus = this.state === 'menu' ? pl.pos : pl.pos;
    if (!paused) {
      this.world.update(dt, this.t, this.camera, focus);
      this.ambient.update(dt, { x: pl.pos.x, z: pl.pos.z, speed: pl.speedAbs || 0 }, this.camera);
      this.fx.update(dt);
    } else {
      this.world.sky.position.copy(this.camera.position);
    }
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    this.audio.setListener(this.camera.position.x, this.camera.position.z, Math.atan2(dir.x, dir.z));
    this.audio.update(paused ? 0 : dt);
    this.fx.updateLabels(paused ? 0 : dt, this.W, this.H, this.fade);
    if (!this.skipRender) this.render();
  }

  render() {
    const info = this.renderer.info;
    info.autoReset = false;
    info.reset();
    this.post.render(this.scene, this.camera);
  }
}

function lerpAngle(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

/* ================================================================== boot + a small hook for testing */

const game = new Game();
window.__farm = {
  game,
  state: () => ({
    state: game.state, species: game.species, hearts: game.hearts,
    pos: game.player ? [+game.player.pos.x.toFixed(2), +game.player.y.toFixed(2), +game.player.pos.z.toFixed(2)] : null,
    yaw: game.player ? +game.player.yaw.toFixed(2) : null,
    target: game.interactions && game.interactions.target ? (game.interactions.target.display || game.interactions.target.name) : null,
    act: game.interactions && game.interactions.target && game.interactions.target.act ? game.interactions.target.act.id : null,
    active: game.interactions && game.interactions.active ? game.interactions.active.id : null,
    tasks: game.tasks ? game.tasks.filter((t) => t.done).map((t) => t.id) : [],
    calls: game.renderer ? game.renderer.info.render.calls : 0,
    tris: game.renderer ? game.renderer.info.render.triangles : 0,
  }),
  start: (s) => { if (s) game.selectSpecies(s); game.start(); },
  skip: () => { if (game.trans) game.trans.t = game.trans.dur; return true; },
  lowq: () => {
    game.renderer.setPixelRatio(0.5);
    game.renderer.shadowMap.enabled = false;
    game.post.sceneRT.samples = 0;
    game.onResize();
    return true;
  },
  slow: (v = 0.35) => { game.maxDt = v; return true; },
  /* run sec seconds of game time in fixed steps without drawing, then draw once */
  advance: (sec, step = 1 / 30) => {
    const real = game.last, max = game.maxDt;
    game.maxDt = step;
    game.skipRender = true;
    let now = real;
    try {
      for (let t = 0; t < sec - 1e-6; t += step) { now += step * 1000; game.loop(now); }
    } finally {
      game.skipRender = false;
      game.maxDt = max;
      game.last = real;
      game.perf.last = 0;
    }
    game.render();
    return true;
  },
  tp: (x, z, yaw) => {
    game.player.place(x, z, yaw ?? game.player.yaw);
    game.camRig.follow(game.player, 0, true);
    return true;
  },
  /* stand beside a friend on the side where the follow camera sees you both past walls and trunks */
  near: (name) => {
    const n = game.npcs.find((k) => k.name === name || k.species === name);
    if (!n) return false;
    const pl = game.player, C = game.world.colliders, S = pl.stats.cam;
    const d = n.radius + pl.radius + 0.9, dist = S.dist * game.camRig.zoom;
    const spot = new THREE.Vector3(), found = [];
    const a0 = rand(0, TAU);
    let best = null, bestScore = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = a0 + (i / 16) * TAU;
      const x = n.pos.x + Math.sin(a) * d, z = n.pos.z + Math.cos(a) * d, y = game.world.heightAt(x, z);
      const yaw = Math.atan2(n.pos.x - x, n.pos.z - z);
      const cx = x - Math.sin(yaw) * dist, cz = z - Math.cos(yaw) * dist, cy = y + S.height;
      spot.set(x, 0, z);
      C.resolve(spot, y, pl.radius);
      let score = Math.hypot(spot.x - x, spot.z - z) * 6;
      score += (1 - C.clipSegment(x, z, cx, cz, y + S.height * 0.6)) * 4 + C.treePenalty(cx, cy, cz);
      const ex = n.pos.x + Math.sin(yaw) * 1.5, ez = n.pos.z + Math.cos(yaw) * 1.5;
      for (const c of C.query((cx + ex) / 2, (cz + ez) / 2, (dist + d) / 2 + 2, found)) {
        if (c.tree && segDist(c.cx, c.cz, cx, cz, ex, ez) < c.r + 0.6) score += 2;
      }
      if (score < bestScore) { bestScore = score; best = { x, z, yaw }; }
    }
    pl.place(best.x, best.z, best.yaw);
    n.state = 'idle'; n.timer = 6; n.moveSpeed = 0;
    game.camRig.follow(pl, 0, true);
    return n.display;
  },
  act: (id) => { const t = game.interactions.target; if (t && t.isNPC) { t.act = { id, verb: id }; } return !!t; },
  press: () => game.interactions.trigger(),
  cam: (px, py, pz, lx, ly, lz) => { game.debugCam = px === undefined ? null : { pos: new THREE.Vector3(px, py, pz), look: new THREE.Vector3(lx, ly, lz) }; return true; },
  lineup: () => {
    const kinds = [['horse'], ['horse', 'bay'], ['cow'], ['pig'], ['dog'], ['cat'], ['cat', 'grey'], ['sheep'], ['duck', 'jemima'], ['duck', 'mallard'], ['hen'], ['hen', 'white'], ['rabbit'], ['hedgehog']];
    let x = -9;
    for (const [s, v] of kinds) {
      const r = buildAnimal(s, v);
      r.root.position.set(x, game.world.heightAt(x, 12), 12);
      r.root.rotation.y = 0.5;
      game.scene.add(r.root);
      x += Math.max(1.0, r.world.len * 0.8 + 0.4);
    }
    game.npcs.forEach((n) => { n.rig.root.visible = false; });
    game.player.rig.root.visible = false;
    game.debugCam = { pos: new THREE.Vector3(-1.5, game.world.heightAt(0, 12) + 2.4, 19.5), look: new THREE.Vector3(-1.5, game.world.heightAt(0, 12) + 0.7, 12) };
    return true;
  },
};
game.boot().catch((e) => {
  console.error(e);
  game.ui && game.ui.error('Something went wrong while painting the farm: ' + (e && e.message ? e.message : e));
});

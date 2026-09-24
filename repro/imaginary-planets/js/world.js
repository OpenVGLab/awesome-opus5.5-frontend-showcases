import * as THREE from 'three';
import {
  PLANET_VERT, PLANET_FRAG, CLOUD_FRAG, ATMO_FRAG, RING_VERT, RING_FRAG, AURORA_FRAG,
  STAR_FRAG, SKY_VERT, SKY_FRAG, STARS_VERT, STARS_FRAG,
} from './shaders.js';

export const TORUS_TUBE = 0.36;
const DEG = Math.PI / 180;

const geos = {};
function geo(name) {
  if (geos[name]) return geos[name];
  let g;
  switch (name) {
    case 'sphere': g = new THREE.SphereGeometry(1, 160, 100); break;
    case 'sphereMid': g = new THREE.SphereGeometry(1, 96, 64); break;
    case 'sphereLow': g = new THREE.SphereGeometry(1, 48, 32); break;
    case 'torus': g = new THREE.TorusGeometry(1, TORUS_TUBE, 110, 280).rotateX(Math.PI / 2); break;
    case 'torusCloud': g = new THREE.TorusGeometry(1, TORUS_TUBE * 1.03, 90, 240).rotateX(Math.PI / 2); break;
    case 'torusAtmo': g = new THREE.TorusGeometry(1, TORUS_TUBE * 1.14, 72, 200).rotateX(Math.PI / 2); break;
    default: throw new Error('unknown geometry ' + name);
  }
  geos[name] = g;
  return g;
}

const col = (hex) => new THREE.Color(hex);
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export function dirFromLatLon(lat, lon) {
  const la = lat * DEG, lo = lon * DEG;
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

function torusPoint(u, v) {
  const U = u * DEG, W = v * DEG;
  const ring = 1 + TORUS_TUBE * Math.cos(W);
  return {
    pos: new THREE.Vector3(ring * Math.cos(U), TORUS_TUBE * Math.sin(W), -ring * Math.sin(U)),
    normal: new THREE.Vector3(Math.cos(W) * Math.cos(U), Math.sin(W), -Math.cos(W) * Math.sin(U)),
  };
}

// Every planet-ish material reads from one uniform bag, so the surface, clouds,
// atmosphere, rings and aurora of a world always agree on sun direction, time, etc.
function baseUniforms(shared) {
  return {
    uTime: shared.uTime, uScan: shared.uScan, uScanMix: shared.uScanMix, uEnv: shared.uEnv,
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uSunColor: { value: new THREE.Color(1, 0.95, 0.88).multiplyScalar(1.8) },
    uAmbient: { value: new THREE.Vector3(0.012, 0.014, 0.022) },
    uTermCol: { value: new THREE.Color(1.0, 0.6, 0.38) },
    uSeed: { value: new THREE.Vector3() },
    uScale: { value: 1.5 }, uSea: { value: 0 }, uTemp: { value: 0.5 }, uBump: { value: 0.2 },
    uGlow: { value: 1 }, uReef: { value: 0 }, uLights: { value: 0 },
    uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uColC: { value: new THREE.Color() },
    uColD: { value: new THREE.Color() }, uColE: { value: new THREE.Color() },
    uGlowCol: { value: new THREE.Color() }, uAtmoCol: { value: new THREE.Color() }, uAtmoStr: { value: 0 },
    uStorm: { value: new THREE.Vector3(0, 1, 0) }, uStormP: { value: new THREE.Vector4(0, 0.2, 10, 0.8) },
    uCloudCover: { value: 0.5 }, uCloudScale: { value: 1.5 }, uCloudSeed: { value: new THREE.Vector3() },
    uCloudOffset: { value: 0 }, uCloudShadow: { value: 0 }, uCloudTint: { value: new THREE.Color(1, 1, 1) },
    uCloudOpacity: { value: 0.9 },
    uCenter: { value: new THREE.Vector3() }, uRadius: { value: 1 }, uRa: { value: 1.06 },
    uRingNormal: { value: new THREE.Vector3(0, 1, 0) }, uRingIn: { value: 1.4 }, uRingOut: { value: 2.3 },
    uRingColA: { value: new THREE.Color() }, uRingColB: { value: new THREE.Color() },
    uTorus: { value: new THREE.Vector2(1, TORUS_TUBE) },
    uAtmoShellCol: { value: new THREE.Color() }, uSunsetCol: { value: new THREE.Color() }, uAtmoShellStr: { value: 1 },
    uAurA: { value: new THREE.Color() }, uAurB: { value: new THREE.Color() }, uAurStr: { value: 1 },
    uHiCol: { value: new THREE.Color(1, 1, 1) }, uHighlight: { value: 0 },
  };
}

const _v = new THREE.Vector3(), _mw = new THREE.Vector3();

export class Planet {
  constructor(def, shared) {
    this.def = def;
    this.shared = shared;
    this.isTorus = def.shape === 'torus';
    this.u = baseUniforms(shared);
    this.applyParams(def);

    this.group = new THREE.Group();
    this.tilt = new THREE.Group();
    this.spin = new THREE.Group();
    this.group.add(this.tilt);
    this.tilt.add(this.spin);
    this.tilt.rotation.z = def.tilt || 0;

    this.build();

    this.omega = def.orbit && def.orbit.r ? 4.4 * Math.pow(def.orbit.r, -1.5) : 0;
    this.theta = def.orbit ? def.orbit.phase : 0;
    this.orbitPos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.lineupTarget = new THREE.Vector3();
    this.lineupCur = new THREE.Vector3();
    this.lineupInit = false;
    this.hiTarget = 0;
    this.appear = 1;
    this.visual = def.visual;
    this.trueScale = this.isTorus ? def.stats.radius / (1 + TORUS_TUBE) : def.stats.radius;
  }

  applyParams(def) {
    const u = this.u, P = def.params;
    u.uSunColor.value.setRGB(1, 0.95, 0.88).multiplyScalar(def.sunIntensity ?? 1.8);
    if (def.ambient) u.uAmbient.value.set(...def.ambient);
    u.uSeed.value.set(...P.seed);
    u.uScale.value = P.scale;
    u.uSea.value = P.sea ?? 0;
    u.uTemp.value = P.temp ?? 0.5;
    u.uBump.value = P.bump ?? 0.2;
    u.uGlow.value = P.glow ?? 1;
    u.uReef.value = P.reef ?? 0;
    u.uLights.value = P.lights ?? 0;
    for (const k of ['A', 'B', 'C', 'D', 'E']) u['uCol' + k].value.set(P['col' + k] || '#000000');
    u.uGlowCol.value.set(P.glowCol || '#000000');
    u.uAtmoCol.value.set(P.atmoCol || '#000000');
    u.uAtmoStr.value = P.atmoStr ?? 0;
    if (P.storm) {
      u.uStorm.value.copy(dirFromLatLon(P.storm.lat, P.storm.lon));
      u.uStormP.value.set(P.storm.strength, P.storm.size, P.bands ?? 10, P.turbulence ?? 0.8);
    } else {
      u.uStormP.value.set(0, 0.2, P.bands ?? 10, P.turbulence ?? 0.8);
    }
    const C = def.clouds;
    if (C) {
      u.uCloudCover.value = C.cover;
      u.uCloudScale.value = C.scale;
      u.uCloudSeed.value.set(...C.seed);
      u.uCloudShadow.value = C.shadow ?? 0;
      u.uCloudTint.value.set(C.tint || '#ffffff');
      u.uCloudOpacity.value = C.opacity ?? 0.9;
    }
    const A = def.atmosphere;
    if (A) {
      u.uAtmoShellCol.value.set(A.color);
      u.uSunsetCol.value.set(A.sunset || '#ff9466');
      u.uAtmoShellStr.value = A.strength ?? 1;
    }
    const R = def.rings;
    if (R) {
      u.uRingIn.value = R.inner;
      u.uRingOut.value = R.outer;
      u.uRingColA.value.set(R.colA);
      u.uRingColB.value.set(R.colB);
    }
    if (def.aurora) {
      u.uAurA.value.set(def.aurora.a);
      u.uAurB.value.set(def.aurora.b);
      u.uAurStr.value = def.aurora.strength ?? 1;
    }
    u.uHiCol.value.set(def.accent || '#ffffff');
  }

  build() {
    const def = this.def, u = this.u, torus = this.isTorus;
    const defines = { ['TYPE_' + def.type.toUpperCase()]: '' };
    if (torus) defines.SHAPE_TORUS = '';
    if (def.rings) defines.HAS_RINGS = '';
    if (def.clouds && def.clouds.style !== 'eye' && def.clouds.shadow) defines.HAS_CLOUD_SHADOW = '';
    this.surfaceMat = new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms: u, defines });
    this.surface = new THREE.Mesh(geo(torus ? 'torus' : 'sphere'), this.surfaceMat);
    this.spin.add(this.surface);

    this.clouds = null;
    if (def.clouds) {
      const cd = {};
      if (def.clouds.style === 'eye') cd.CLOUD_EYE = '';
      if (torus) cd.SHAPE_TORUS = '';
      const m = new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: CLOUD_FRAG, uniforms: u, defines: cd, transparent: true, depthWrite: false });
      this.clouds = new THREE.Mesh(geo(torus ? 'torusCloud' : 'sphere'), m);
      if (!torus) this.clouds.scale.setScalar(1.013);
      this.clouds.renderOrder = 1;
      this.spin.add(this.clouds);
    }

    this.atmo = null;
    if (def.atmosphere) {
      const m = new THREE.ShaderMaterial({
        vertexShader: PLANET_VERT, fragmentShader: ATMO_FRAG, uniforms: u, defines: torus ? { SHAPE_TORUS: '' } : {},
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      });
      this.atmo = new THREE.Mesh(geo(torus ? 'torusAtmo' : 'sphereMid'), m);
      if (!torus) this.atmo.scale.setScalar(1 + def.atmosphere.thickness);
      this.atmo.renderOrder = 3;
      this.tilt.add(this.atmo);
    }

    this.rings = null;
    if (def.rings) {
      const g = new THREE.RingGeometry(def.rings.inner, def.rings.outer, 288, 6).rotateX(-Math.PI / 2);
      const m = new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      this.rings = new THREE.Mesh(g, m);
      this.rings.renderOrder = 2;
      this.tilt.add(this.rings);
    }

    this.aurora = null;
    if (def.aurora) {
      const m = new THREE.ShaderMaterial({
        vertexShader: PLANET_VERT, fragmentShader: AURORA_FRAG, uniforms: u,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      this.aurora = new THREE.Mesh(geo('sphereMid'), m);
      this.aurora.scale.setScalar(1.045);
      this.aurora.renderOrder = 4;
      this.tilt.add(this.aurora);
    }

    this.moons = (def.moons || []).map((m) => {
      const mu = baseUniforms(this.shared);
      mu.uSunDir = u.uSunDir;
      mu.uSunColor = u.uSunColor;
      mu.uAmbient = u.uAmbient;
      mu.uTermCol.value.setRGB(1, 1, 1);
      mu.uSeed.value.set(m.seed, m.seed * 1.7, m.seed * 0.3);
      mu.uScale.value = 1.6;
      mu.uBump.value = 0.22;
      mu.uColA.value.set(m.colA);
      mu.uColB.value.set(m.colB);
      mu.uHiCol.value.set(def.accent || '#ffffff');
      const mat = new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms: mu, defines: { TYPE_MOON: '' } });
      const mesh = new THREE.Mesh(geo('sphereLow'), mat);
      mesh.scale.setScalar(m.size);
      this.tilt.add(mesh);
      return { def: m, mesh, angle: m.phase || 0 };
    });

    this.ringNormal = new THREE.Vector3(0, 1, 0).applyEuler(this.tilt.rotation);
    this.group.traverse((o) => o.layers.enable(1));
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.material) o.material.dispose();
      if (o.geometry && !Object.values(geos).includes(o.geometry)) o.geometry.dispose();
    });
  }

  setTilt(rad) {
    this.def.tilt = rad;
    this.tilt.rotation.z = rad;
    this.ringNormal.set(0, 1, 0).applyEuler(this.tilt.rotation);
  }

  get scale() { return this.group.scale.x; }

  // Radius of the body itself (no rings) in world units.
  bodyRadius() { return this.scale * (this.isTorus ? 1 + TORUS_TUBE : 1); }

  // Half-width that the planet occupies on the size chart, rings included.
  footprint(scale) {
    if (this.def.rings) return scale * this.def.rings.outer * 0.98;
    return scale * (this.isTorus ? 1 + TORUS_TUBE : 1);
  }

  viewDistance() { return this.scale * (this.def.view ? this.def.view.dist : 3.4); }

  update(state, dt, ctx) {
    const def = this.def;
    this.prevPos.copy(this.group.position);
    if (def.orbit && def.orbit.r) {
      const o = def.orbit;
      this.theta = o.phase + this.omega * state.simTime;
      this.orbitPos.set(o.r * Math.cos(this.theta), o.r * Math.sin(this.theta) * Math.sin(o.incl), -o.r * Math.sin(this.theta) * Math.cos(o.incl));
    }
    const k = def.reference ? 1 : state.compareEase;
    if (!this.lineupInit) { this.lineupCur.copy(this.lineupTarget); this.lineupInit = true; }
    this.lineupCur.x = damp(this.lineupCur.x, this.lineupTarget.x, 3.2, dt);
    this.lineupCur.y = damp(this.lineupCur.y, this.lineupTarget.y, 3.2, dt);
    this.lineupCur.z = damp(this.lineupCur.z, this.lineupTarget.z, 3.2, dt);
    this.group.position.copy(this.orbitPos).lerp(this.lineupCur, k);
    const sc = THREE.MathUtils.lerp(this.visual, this.trueScale, k) * this.appear;
    this.group.scale.setScalar(Math.max(sc, 1e-4));
    this.group.visible = this.appear > 0.002;

    if (def.locked) this.spin.rotation.y = this.theta + Math.PI;
    else this.spin.rotation.y += (def.spin || 0) * dt * state.spinRate;
    if (this.clouds) {
      this.clouds.rotation.y += (def.clouds.speed || 0) * dt * state.spinRate;
      this.u.uCloudOffset.value = this.clouds.rotation.y;
    }

    _v.copy(ctx.starPos).sub(this.group.position).normalize();
    this.u.uSunDir.value.copy(_v).lerp(ctx.compareLight, k).normalize();
    this.u.uCenter.value.copy(this.group.position);
    this.u.uRadius.value = sc;
    this.u.uRa.value = sc * (1 + (def.atmosphere ? def.atmosphere.thickness : 0.06));
    this.u.uRingNormal.value.copy(this.ringNormal);

    for (const m of this.moons) {
      m.angle += m.def.speed * dt * state.spinRate;
      const d = m.def.dist, a = m.angle, inc = m.def.incl || 0;
      if (m.def.through) m.mesh.position.set(d * Math.cos(a), d * Math.sin(a), 0);
      else m.mesh.position.set(d * Math.cos(a), d * Math.sin(a) * Math.sin(inc), -d * Math.sin(a) * Math.cos(inc));
      m.mesh.rotation.y += dt * 0.1;
      m.mesh.material.uniforms.uHighlight.value = this.u.uHighlight.value * 0.5;
    }

    this.u.uHighlight.value = damp(this.u.uHighlight.value, this.hiTarget, 8, dt);
  }

  // Moons shrink away when they would loom right in front of the lens (close-up views sit inside their orbits)
  // or when their disc would cross one of the given screen rects (UI cards) and glare through it.
  fadeMoons(camera, rects, dt) {
    const k = (0.5 * innerHeight) / Math.tan((camera.fov * DEG) / 2);
    const dp = Math.max(camera.position.distanceTo(this.group.position), 1e-3);
    for (const m of this.moons) {
      m.mesh.getWorldPosition(_mw);
      const dm = Math.max(_mw.distanceTo(camera.position), 1e-3);
      const r = (m.def.size * this.scale * k) / dm;
      _mw.project(camera);
      const x = (_mw.x * 0.5 + 0.5) * innerWidth, y = (-_mw.y * 0.5 + 0.5) * innerHeight;
      const hit = _mw.z > 1 || rects.some((b) => b.width > 0 && x + r > b.left && x - r < b.right && y + r > b.top && y - r < b.bottom);
      m.fade = damp(m.fade ?? 1, hit ? 0 : THREE.MathUtils.smoothstep(dm / dp, 0.5, 0.75), 6, dt);
      m.mesh.scale.setScalar(m.def.size * Math.max(m.fade, 1e-3));
      m.mesh.visible = m.fade > 0.01;
    }
  }

  // World-space position and outward normal of a point of interest.
  poi(i, outPos, outNormal) {
    const p = this.def.pois[i];
    this.group.updateMatrixWorld(true);
    let lp, ln;
    if (p.center) { lp = new THREE.Vector3(0, 0, 0); ln = new THREE.Vector3(0, 1, 0); }
    else if (this.isTorus) { const t = torusPoint(p.u, p.v); lp = t.pos; ln = t.normal; }
    else { ln = dirFromLatLon(p.lat, p.lon); lp = ln.clone().multiplyScalar(1.0); }
    outPos.copy(lp).applyMatrix4(this.spin.matrixWorld);
    const nm = new THREE.Matrix3().setFromMatrix4(this.spin.matrixWorld);
    outNormal.copy(ln).applyMatrix3(nm).normalize();
    return p;
  }
}

// ---------------------------------------------------------------------------

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture() {
  return canvasTexture(256, 256, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.1, 'rgba(255,244,220,0.9)');
    grd.addColorStop(0.3, 'rgba(255,200,140,0.32)');
    grd.addColorStop(0.62, 'rgba(255,150,90,0.07)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
}

function raysTexture() {
  return canvasTexture(512, 512, (g, w) => {
    const c = w / 2;
    g.globalCompositeOperation = 'lighter';
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 140; i++) {
      const a = rnd() * Math.PI * 2;
      const len = c * (0.25 + Math.pow(rnd(), 2) * 0.75);
      const grd = g.createLinearGradient(c, c, c + Math.cos(a) * len, c + Math.sin(a) * len);
      const alpha = 0.05 + rnd() * 0.14;
      grd.addColorStop(0, `rgba(255,236,200,${alpha})`);
      grd.addColorStop(1, 'rgba(255,200,150,0)');
      g.strokeStyle = grd;
      g.lineWidth = 0.6 + rnd() * 2.2;
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
      g.stroke();
    }
  });
}

function streakTexture() {
  return canvasTexture(512, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, 'rgba(255,200,160,0)');
    grd.addColorStop(0.5, 'rgba(255,235,210,0.9)');
    grd.addColorStop(1, 'rgba(255,200,160,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.5, 'rgba(0,0,0,1)');
    v.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  });
}

export function createStar(shared) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: STAR_FRAG, uniforms: { uTime: shared.uTime } });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4.2, 96, 64), mat);
  group.add(mesh);
  const glow = glowTexture();
  const mk = (map, color, opacity, scale) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(scale[0], scale[1], 1);
    s.userData.baseOpacity = opacity;
    group.add(s);
    return s;
  };
  const core = mk(glow, new THREE.Color(1.0, 0.78, 0.5), 0.95, [30, 30]);
  const halo = mk(glow, new THREE.Color(1.0, 0.5, 0.24), 0.38, [110, 110]);
  const rays = mk(raysTexture(), new THREE.Color(1.0, 0.85, 0.65), 0.55, [72, 72]);
  const streak = mk(streakTexture(), new THREE.Color(1.0, 0.8, 0.6), 0.28, [170, 5]);
  const sprites = [core, halo, rays, streak];
  return {
    group, mesh, sprites,
    update(dt, fade) {
      rays.material.rotation += dt * 0.01;
      for (const s of sprites) s.material.opacity = s.userData.baseOpacity * fade;
      mesh.scale.setScalar(Math.max(fade, 1e-3));
      group.visible = fade > 0.003;
    },
  };
}

export function createStarfield(shared, count = 9000) {
  const pos = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const axis = new THREE.Vector3(0.32, 1.0, -0.45).normalize();
  const palette = [[0.66, 0.78, 1.0], [0.82, 0.88, 1.0], [1, 1, 1], [1.0, 0.95, 0.86], [1.0, 0.84, 0.64], [1.0, 0.7, 0.52]];
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const d = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    d.set(r * Math.cos(a), z, r * Math.sin(a));
    if (rnd() < 0.45) d.addScaledVector(axis, -d.dot(axis) * (0.55 + rnd() * 0.45)).normalize();
    d.multiplyScalar(3000);
    pos.set([d.x, d.y, d.z], i * 3);
    const c = palette[Math.floor(rnd() * palette.length)];
    const b = 0.25 + 0.75 * Math.pow(rnd(), 2.2);
    color.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    size[i] = 1.4 + Math.pow(rnd(), 9) * 5.5;
    phase[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: STARS_VERT, fragmentShader: STARS_FRAG,
    uniforms: { uTime: shared.uTime, uPixelRatio: shared.uPixelRatio },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = -1;
  return pts;
}

export function bakeSky(renderer, size = 1024) {
  const rt = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType, generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
  });
  const cam = new THREE.CubeCamera(0.1, 100, rt);
  const sc = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 64, 32);
  const m = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false });
  sc.add(new THREE.Mesh(g, m));
  cam.update(renderer, sc);
  g.dispose();
  m.dispose();
  return rt.texture;
}

export function createOrbitLine(r, incl, color, dashed = false) {
  const pts = [];
  for (let i = 0; i <= 480; i++) {
    const a = (i / 480) * Math.PI * 2;
    pts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a) * Math.sin(incl), -r * Math.sin(a) * Math.cos(incl)));
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false, dashSize: 1.2, gapSize: 1.0 })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false });
  const line = new THREE.Line(g, m);
  if (dashed) line.computeLineDistances();
  return line;
}

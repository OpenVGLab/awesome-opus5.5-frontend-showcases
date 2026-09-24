import * as THREE from 'three';
import { glowTexture } from './fx.js';

const NOISE = /* glsl */`
  float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { v += a * vnoise(p); p = p * 2.02 + vec3(3.1, 1.7, 5.3); a *= 0.5; } return v; }
  float fbm3(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + vec3(3.1, 1.7, 5.3); a *= 0.5; } return v; }
`;

const DIR_VERT = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const SKY_BAKE_FRAG = NOISE + /* glsl */`
  uniform float uEnv;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(vec3(0.004, 0.005, 0.016), vec3(0.01, 0.008, 0.03), smoothstep(-0.6, 0.8, h));
    col += vec3(0.03, 0.036, 0.095) * exp(-abs(h) * 5.0);
    vec3 bn = normalize(vec3(0.35, 1.0, -0.25));
    float band = exp(-pow(dot(d, bn) * 2.4, 2.0));
    float n1 = fbm(d * 2.4 + 1.3);
    float n2 = fbm(d * 4.6 + vec3(n1 * 2.2));
    float neb = smoothstep(0.42, 0.92, n2);
    float mixer = fbm(d * 1.5 + 7.0);
    vec3 nebCol = mix(vec3(0.04, 0.22, 0.62), vec3(0.4, 0.07, 0.6), smoothstep(0.38, 0.62, mixer));
    nebCol = mix(nebCol, vec3(0.95, 0.22, 0.4), smoothstep(0.58, 0.8, fbm(d * 3.1 + 4.0)) * 0.55);
    col += nebCol * neb * (0.22 + 1.35 * band) * 0.85;
    col += vec3(0.55, 0.42, 0.75) * pow(band, 3.0) * smoothstep(0.45, 0.8, n1) * 0.4;
    float dust = smoothstep(0.52, 0.76, fbm(d * 7.5 + 11.0));
    col *= 1.0 - dust * band * 0.65;
    if (uEnv > 0.5) {
      col += vec3(1.0, 0.86, 0.72) * pow(max(dot(d, normalize(vec3(0.45, 0.75, 0.55))), 0.0), 10.0) * 5.0;
      col += vec3(0.3, 0.7, 1.0) * pow(max(dot(d, normalize(vec3(-0.6, 0.25, -0.75))), 0.0), 5.0) * 2.2;
      col += vec3(0.8, 0.3, 0.9) * pow(max(dot(d, normalize(vec3(0.7, -0.1, -0.7))), 0.0), 6.0) * 1.2;
      col += vec3(0.22, 0.28, 0.5) * smoothstep(-0.2, 0.9, h) * 0.7;
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

const SKY_FRAG = /* glsl */`
  uniform samplerCube uCube; uniform vec3 uTint; varying vec3 vDir;
  void main() { gl_FragColor = vec4(textureCube(uCube, normalize(vDir)).rgb * uTint, 1.0); }`;

const PLANET_VERT = /* glsl */`
  varying vec3 vObjN; varying vec3 vN; varying vec3 vW;
  void main() { vObjN = normal; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w; }`;
const PLANET_FRAG = NOISE + /* glsl */`
  uniform vec3 uSun; uniform float uTime; uniform vec3 uTint;
  varying vec3 vObjN; varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 n = normalize(vObjN);
    float turb = fbm(vec3(n.x * 2.5, n.y * 10.0, n.z * 2.5) + vec3(uTime * 0.004, 0.0, 0.0));
    float b = sin(n.y * 23.0 + turb * 6.0) * 0.5 + 0.5;
    vec3 c = mix(vec3(0.5, 0.27, 0.22), vec3(0.95, 0.76, 0.56), b);
    c = mix(c, vec3(0.3, 0.16, 0.34), smoothstep(0.52, 0.8, fbm(n * 5.0 + 2.0)) * 0.6);
    float storm = smoothstep(0.16, 0.0, length(vec2(atan(n.z, n.x) - 0.8, (n.y + 0.25) * 2.6)));
    c = mix(c, vec3(0.9, 0.4, 0.25), storm * 0.8);
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
    float lam = max(dot(N, uSun), 0.0);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.4);
    vec3 col = c * (0.015 + lam * 1.15) * uTint + vec3(0.35, 0.55, 1.0) * rim * (0.08 + lam * 1.1);
    gl_FragColor = vec4(col, 1.0);
  }`;
const ATMO_FRAG = /* glsl */`
  uniform vec3 uSun; varying vec3 vObjN; varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
    float f = pow(1.0 - abs(dot(N, V)), 3.0);
    float lam = 0.25 + 0.75 * max(dot(N, uSun), 0.0);
    gl_FragColor = vec4(vec3(0.3, 0.55, 1.2) * f * lam * 1.4, 1.0);
  }`;
const RING_FRAG = NOISE + /* glsl */`
  uniform vec3 uSun; varying vec3 vObjN; varying vec3 vN; varying vec3 vW; varying vec2 vUv2;
  void main() {
    float r = length(vUv2);
    float bands = hash12(vec2(floor(r * 90.0), 3.0)) * 0.6 + 0.4 * sin(r * 160.0);
    float a = smoothstep(1.3, 1.36, r) * smoothstep(2.25, 2.1, r) * (0.35 + 0.65 * bands);
    a *= 1.0 - smoothstep(1.72, 1.76, r) * smoothstep(1.83, 1.79, r) * 0.9;
    vec3 col = vec3(0.85, 0.7, 0.55) * (0.25 + 0.9 * max(dot(normalize(vN), uSun), 0.2));
    gl_FragColor = vec4(col * 0.9, a * 0.8);
  }`;

const FLOOR_VERT = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const FLOOR_FRAG = NOISE + /* glsl */`
  uniform float uScroll, uTime, uFogDensity;
  uniform vec3 uSeam, uLight, uFog, uLane;
  varying vec3 vW;
  float gridLine(vec2 f, float w) { vec2 e = min(f, 1.0 - f); vec2 fw = fwidth(f) * 1.2 + 1e-4; vec2 l = 1.0 - smoothstep(vec2(w) - fw, vec2(w) + fw, e); return max(l.x, l.y); }
  void main() {
    vec2 p = vec2(vW.x, vW.z - uScroll);
    vec2 g1 = p / 24.0; vec2 id1 = floor(g1); vec2 f1 = fract(g1);
    float h1 = hash12(id1);
    vec3 base = mix(vec3(0.02, 0.024, 0.034), vec3(0.05, 0.056, 0.075), h1);
    vec2 g2 = p / 6.0; vec2 f2 = fract(g2); float h2 = hash12(floor(g2) + 5.0);
    base *= 0.8 + 0.35 * h2;
    base *= 1.0 - gridLine(f2, 0.03) * 0.5;
    float seam = gridLine(f1, 0.01);
    float pulse = 0.55 + 0.45 * sin(uTime * 2.5 + h1 * 12.0 - p.y * 0.02);
    vec3 col = base + uSeam * seam * pulse * 0.75;
    vec2 g3 = p / vec2(3.0, 9.0); vec2 id3 = floor(g3); vec2 f3 = fract(g3);
    float h3 = hash12(id3 + 13.1);
    float win = step(0.965, h3) * (1.0 - smoothstep(0.3, 0.42, abs(f3.x - 0.5))) * (1.0 - smoothstep(0.3, 0.45, abs(f3.y - 0.5)));
    col += mix(uLight, uSeam, step(0.985, h3)) * win * 0.9;
    float lane = 1.0 - smoothstep(0.3, 0.9, abs(abs(vW.x) - 30.0));
    float dash = step(0.66, fract(p.y / 14.0));
    col += uLane * lane * dash * 1.5;
    float lane2 = 1.0 - smoothstep(0.15, 0.5, abs(vW.x));
    col += uLane * lane2 * step(0.88, fract(p.y / 7.0)) * 0.7;
    float dist = length(vW - cameraPosition);
    float fog = 1.0 - exp(-pow(dist * uFogDensity, 1.7));
    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
  }`;

const TOWER_VERT = /* glsl */`
  attribute float aSeed;
  varying vec3 vLocal; varying vec3 vNw; varying vec3 vW; varying float vSeed; varying float vH;
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 w = m * vec4(position, 1.0);
    vLocal = w.xyz - (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vNw = normalize(mat3(m) * normal);
    vW = w.xyz; vSeed = aSeed; vH = length(instanceMatrix[1].xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const TOWER_FRAG = NOISE + /* glsl */`
  uniform vec3 uFog, uWinA, uWinB, uEdge; uniform float uFogDensity, uTime;
  varying vec3 vLocal; varying vec3 vNw; varying vec3 vW; varying float vSeed; varying float vH;
  void main() {
    vec3 n = normalize(vNw);
    float lam = 0.3 + 0.7 * max(dot(n, normalize(vec3(0.45, 0.8, 0.5))), 0.0);
    vec3 col = vec3(0.045, 0.052, 0.07) * lam;
    float side = 1.0 - step(0.5, abs(n.y));
    vec2 uv = abs(n.x) > 0.5 ? vLocal.zy : vLocal.xy;
    vec2 cell = uv / vec2(1.7, 1.25); vec2 id = floor(cell); vec2 f = fract(cell);
    float h = hash12(id + vSeed * 31.7);
    float win = step(0.74, h) * step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.7) * side;
    vec3 wc = mix(uWinA, uWinB, step(0.8, hash12(id + 7.0 + vSeed)));
    col += wc * win * (0.75 + 0.25 * sin(uTime * 2.0 + h * 40.0)) * 0.5;
    float band = step(0.5, fract(vLocal.y / 9.0 + vSeed)) * step(fract(vLocal.y / 9.0 + vSeed), 0.525) * side;
    col += uEdge * band * 0.45;
    float top = smoothstep(vH - 0.8, vH - 0.2, vLocal.y) * side;
    col += uEdge * top * (0.9 + 0.5 * sin(uTime * 5.0 + vSeed * 20.0));
    col = mix(col, col * 0.25 + uEdge * 0.25, (1.0 - side) * step(0.5, n.y) * 0.4);
    float dist = length(vW - cameraPosition);
    float fog = 1.0 - exp(-pow(dist * uFogDensity, 1.7));
    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
  }`;

const STREAK_VERT = /* glsl */`
  attribute vec2 corner;
  attribute vec4 aPos;
  uniform float uScroll, uSpan, uNearZ, uLen, uWidth, uSpeedMul;
  uniform vec2 uRes;
  varying float vT; varying float vB; varying float vFar;
  void main() {
    float sp = uScroll * (1.0 + aPos.w * uSpeedMul);
    float z = mod(aPos.z + sp, uSpan) - uSpan + uNearZ;
    vec3 head = vec3(aPos.x, aPos.y, z);
    vec3 tail = head - vec3(0.0, 0.0, uLen * (0.6 + aPos.w * 0.8));
    vec4 vh = modelViewMatrix * vec4(head, 1.0);
    vec4 vt = modelViewMatrix * vec4(tail, 1.0);
    vT = corner.y; vB = aPos.w; vFar = clamp(-vt.z / uSpan, 0.0, 1.0);
    if (vt.z > -0.6) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    if (vh.z > -0.6) { float k = (-0.6 - vt.z) / (vh.z - vt.z); vh = mix(vt, vh, k); }
    vec4 ch = projectionMatrix * vh, ct = projectionMatrix * vt;
    vec2 sh = ch.xy / ch.w, st = ct.xy / ct.w;
    vec2 dir = (sh - st) * uRes;
    float l = length(dir);
    dir = l > 1e-4 ? dir / l : vec2(0.0, 1.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    vec4 c = mix(ch, ct, corner.y);
    c.xy += nrm * corner.x * uWidth / uRes * c.w;
    gl_Position = c;
  }`;
const STREAK_FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uAlpha;
  varying float vT; varying float vB; varying float vFar;
  void main() {
    float a = 1.0 - vT; a *= a;
    float fade = 1.0 - vFar * 0.8;
    gl_FragColor = vec4(uColor * (0.35 + vB) * a * uAlpha * fade, 1.0);
  }`;

const TUNNEL_FRAG = NOISE + /* glsl */`
  uniform float uScroll, uAlpha, uTime; varying vec2 vUv;
  void main() {
    float th = vUv.x * 6.2831853;
    float zz = vUv.y * 1600.0 - uScroll;
    vec2 cs = vec2(cos(th), sin(th));
    float haze = fbm3(vec3(cs * 2.0, zz * 0.006));
    float s1 = vnoise(vec3(cs * 16.0, zz * 0.0035));
    float s2 = vnoise(vec3(cs * 46.0, zz * 0.007 + 7.0));
    float streak = pow(smoothstep(0.63, 1.0, s1), 3.0) * 1.3 + pow(smoothstep(0.69, 1.0, s2), 4.0) * 2.0;
    vec3 c = mix(vec3(0.004, 0.012, 0.09), vec3(0.14, 0.02, 0.24), smoothstep(0.4, 0.75, haze)) * haze * 0.6;
    c += mix(vec3(0.25, 0.55, 1.3), vec3(0.95, 0.45, 1.3), s2) * streak;
    float ring = pow(0.5 + 0.5 * sin(zz * 0.04), 40.0) * 0.35;
    c += vec3(0.25, 0.4, 1.0) * ring;
    float endFade = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
    gl_FragColor = vec4(c * endFade * uAlpha, 1.0);
  }`;

const STAR_VERT = /* glsl */`
  attribute float aSize; attribute vec3 aCol; uniform float uPx; uniform float uTime;
  varying vec3 vCol;
  void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
    float tw = 0.75 + 0.25 * sin(uTime * (1.0 + aSize) + position.x);
    gl_PointSize = aSize * uPx; vCol = aCol * tw; }`;
const STAR_FRAG = /* glsl */`
  varying vec3 vCol;
  void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float d = dot(c, c); if (d > 1.0) discard; float a = pow(1.0 - d, 2.5); gl_FragColor = vec4(vCol * a, 1.0); }`;

const lerp = (a, b, t) => a + (b - a) * t;

export const PALETTES = {
  warp:    { seam: [0.1, 0.5, 1.4], light: [1.2, 0.7, 0.3], lane: [0.2, 0.9, 2.2], fog: [0.03, 0.036, 0.1], tint: [1, 1, 1], winA: [1.1, 0.7, 0.35], winB: [0.3, 0.9, 1.6], edge: [0.2, 0.8, 2.0], streak: [0.55, 0.8, 1.6] },
  zako:    { seam: [0.06, 0.55, 1.3], light: [1.3, 0.75, 0.3], lane: [0.25, 1.1, 2.4], fog: [0.028, 0.034, 0.095], tint: [1, 1, 1], winA: [1.2, 0.72, 0.32], winB: [0.3, 0.95, 1.7], edge: [0.2, 0.85, 2.1], streak: [0.55, 0.8, 1.6] },
  mid:     { seam: [1.2, 0.5, 0.08], light: [1.4, 0.6, 0.2], lane: [1.8, 0.8, 0.2], fog: [0.045, 0.03, 0.07], tint: [1.15, 0.9, 1.0], winA: [1.4, 0.6, 0.2], winB: [1.2, 0.3, 0.6], edge: [1.8, 0.6, 0.12], streak: [1.2, 0.8, 0.8] },
  boost:   { seam: [0.2, 0.9, 1.7], light: [0.6, 0.9, 1.4], lane: [0.4, 1.2, 2.3], fog: [0.03, 0.04, 0.1], tint: [0.95, 1.05, 1.2], winA: [0.5, 1.1, 1.7], winB: [1.2, 0.5, 1.4], edge: [0.4, 1.1, 2.0], streak: [0.7, 1.0, 1.8] },
  boss:    { seam: [1.5, 0.08, 0.3], light: [1.5, 0.3, 0.2], lane: [2.2, 0.2, 0.5], fog: [0.06, 0.02, 0.05], tint: [1.35, 0.72, 0.85], winA: [1.6, 0.3, 0.2], winB: [1.2, 0.2, 0.7], edge: [2.2, 0.15, 0.35], streak: [1.4, 0.6, 0.8] },
  victory: { seam: [1.3, 0.9, 0.3], light: [1.4, 1.0, 0.5], lane: [2.0, 1.4, 0.4], fog: [0.04, 0.036, 0.07], tint: [1.1, 1.0, 0.95], winA: [1.4, 1.0, 0.5], winB: [0.6, 1.0, 1.5], edge: [1.8, 1.2, 0.4], streak: [1.3, 1.1, 0.8] },
};

export class Environment {
  constructor(renderer, scene) {
    this.scene = scene;
    this.renderer = renderer;
    this.scroll = 0; this.time = 0;
    this.pal = JSON.parse(JSON.stringify(PALETTES.warp));
    this.palTarget = PALETTES.warp;
    this.fogDensity = 0.0026;
    this.towerHeightMul = 1;
    this.gateInterval = 0; this.gateDist = 0; this.onGatePass = null;
    this.buildSky();
    this.buildStars();
    this.buildPlanet();
    this.buildFloor();
    this.buildTowers();
    this.buildStreaks();
    this.buildTunnel();
    this.buildGates();
    this.world = [this.floor, this.towers, this.lanes, this.planetGroup, this.sunGroup, this.gateGroup];
  }

  bake(size, env) {
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
    const cam = new THREE.CubeCamera(0.1, 1000, rt);
    const s = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({ uniforms: { uEnv: { value: env ? 1 : 0 } }, vertexShader: DIR_VERT, fragmentShader: SKY_BAKE_FRAG, side: THREE.BackSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), mat);
    s.add(mesh);
    cam.update(this.renderer, s);
    mesh.geometry.dispose(); mat.dispose();
    return rt;
  }

  buildSky() {
    this.skyRT = this.bake(512, false);
    const envRT = this.bake(128, true);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pm.fromCubemap(envRT.texture).texture;
    pm.dispose(); envRT.dispose();
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { uCube: { value: this.skyRT.texture }, uTint: { value: new THREE.Vector3(1, 1, 1) } },
      vertexShader: DIR_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), this.skyMat);
    this.sky.renderOrder = -100; this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  buildStars() {
    const n = 2600, pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos[i * 3] = s * Math.cos(th) * 2500; pos[i * 3 + 1] = u * 2500; pos[i * 3 + 2] = s * Math.sin(th) * 2500;
      const b = Math.pow(Math.random(), 6);
      size[i] = 1.2 + b * 3.2;
      const warm = Math.random();
      const k = 0.5 + b * 3.5;
      col[i * 3] = (warm > 0.7 ? 1.0 : 0.75) * k; col[i * 3 + 1] = 0.85 * k; col[i * 3 + 2] = (warm > 0.7 ? 0.7 : 1.1) * k;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    this.starMat = new THREE.ShaderMaterial({ uniforms: { uPx: { value: 1 }, uTime: { value: 0 } }, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.renderOrder = -90; this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  buildPlanet() {
    const g = new THREE.Group();
    const sun = new THREE.Vector3(0.75, 0.35, 0.45).normalize();
    const uni = { uSun: { value: sun }, uTime: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) } };
    this.planetUni = uni;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG }));
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 64), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: PLANET_VERT, fragmentShader: ATMO_FRAG,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.BackSide }));
    const ringGeo = new THREE.RingGeometry(1.3, 2.25, 160, 1);
    const ring = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({ uniforms: uni,
      vertexShader: 'varying vec3 vObjN; varying vec3 vN; varying vec3 vW; varying vec2 vUv2; void main(){ vUv2 = position.xy; vObjN = normal; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.set(-1.25, 0.25, 0.35);
    g.add(planet, atmo, ring);
    g.scale.setScalar(360);
    this.planetOffset = new THREE.Vector3(-980, 430, -1750);
    g.position.copy(this.planetOffset);
    g.rotation.set(0.25, 0.4, -0.3);
    g.traverse((o) => { o.renderOrder = -80; o.frustumCulled = false; });
    this.planetGroup = g;
    this.scene.add(g);

    const sg = new THREE.Group();
    const tex = glowTexture(256);
    const mk = (s, c) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      m.scale.set(s[0], s[1], 1); m.renderOrder = -70; sg.add(m); return m; };
    mk([420, 420], new THREE.Color(0.9, 0.55, 0.4));
    mk([110, 110], new THREE.Color(2.4, 2.0, 1.6));
    mk([1500, 18], new THREE.Color(0.6, 0.45, 0.75));
    this.sunOffset = new THREE.Vector3(1250, 520, -2100);
    this.sunGroup = sg;
    this.scene.add(sg);
  }

  buildFloor() {
    this.floorUni = {
      uScroll: { value: 0 }, uTime: { value: 0 }, uFogDensity: { value: this.fogDensity },
      uSeam: { value: new THREE.Vector3() }, uLight: { value: new THREE.Vector3() }, uFog: { value: new THREE.Vector3() }, uLane: { value: new THREE.Vector3() },
    };
    const geo = new THREE.PlaneGeometry(1400, 1500);
    geo.rotateX(-Math.PI / 2);
    this.floor = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.floorUni, vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG }));
    this.floor.position.set(0, -22, -640);
    this.floor.renderOrder = -50;
    this.scene.add(this.floor);
  }

  buildTowers() {
    const n = 44 * 9;
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const seeds = new Float32Array(n);
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.towerUni = {
      uFog: { value: new THREE.Vector3() }, uWinA: { value: new THREE.Vector3() }, uWinB: { value: new THREE.Vector3() }, uEdge: { value: new THREE.Vector3() },
      uFogDensity: { value: this.fogDensity }, uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.towerUni, vertexShader: TOWER_VERT, fragmentShader: TOWER_FRAG });
    this.towers = new THREE.InstancedMesh(geo, mat, n);
    this.towers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.towers.frustumCulled = false;
    this.towerSeeds = geo.getAttribute('aSeed');
    this.towerData = [];
    this.towerSpan = 44 * 30;
    for (let r = 0; r < 44; r++) for (let k = 0; k < 9; k++) {
      const t = { z: 40 - r * 30 - Math.random() * 10, k };
      this.randomizeTower(t);
      this.towerData.push(t);
    }
    this.scene.add(this.towers);
  }

  randomizeTower(t) {
    const k = t.k;
    if (k < 3 || (k >= 3 && k < 6)) {
      const sgn = k < 3 ? -1 : 1, lane = k % 3;
      t.x = sgn * (44 + lane * 34 + Math.random() * 18);
      t.w = 10 + Math.random() * 14; t.d = 10 + Math.random() * 16;
      t.h = ((lane === 0 ? 14 : 24) + Math.random() * (lane === 0 ? 34 : 70)) * this.towerHeightMul;
    } else {
      t.x = (k - 7) * 18 + (Math.random() - 0.5) * 10;
      t.w = 6 + Math.random() * 8; t.d = 8 + Math.random() * 14; t.h = 1 + Math.random() * 6;
    }
    t.seed = Math.random();
    t.dirty = true;
  }

  buildStreaks() {
    const mk = (n, rMin, rMax, yMin, yMax, color) => {
      const base = new THREE.InstancedBufferGeometry();
      base.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
      base.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]), 2));
      base.setIndex([0, 2, 1, 1, 2, 3]);
      const a = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        let x, y;
        if (yMin === null) { const r = rMin + Math.sqrt(Math.random()) * (rMax - rMin), th = Math.random() * Math.PI * 2; x = Math.cos(th) * r; y = Math.sin(th) * r; }
        else { x = (Math.random() < 0.5 ? -1 : 1) * (rMin + Math.random() * (rMax - rMin)); y = yMin + Math.random() * (yMax - yMin); }
        a[i * 4] = x; a[i * 4 + 1] = y; a[i * 4 + 2] = -Math.random() * 1400; a[i * 4 + 3] = Math.pow(Math.random(), 2);
      }
      base.setAttribute('aPos', new THREE.InstancedBufferAttribute(a, 4));
      base.instanceCount = n;
      const uni = {
        uScroll: { value: 0 }, uSpan: { value: 1400 }, uNearZ: { value: 14 }, uLen: { value: 1 }, uWidth: { value: 1.6 }, uSpeedMul: { value: 0 },
        uRes: { value: new THREE.Vector2(1280, 720) }, uColor: { value: new THREE.Vector3(...color) }, uAlpha: { value: 1 },
      };
      const m = new THREE.Mesh(base, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
      m.frustumCulled = false; m.renderOrder = 5;
      this.scene.add(m);
      return { mesh: m, uni };
    };
    this.streaks = mk(1500, 14, 260, null, null, [0.55, 0.8, 1.6]);
    this.lanesS = mk(260, 60, 220, -20, 30, [1.6, 0.8, 0.3]);
    this.lanesS.uni.uSpeedMul.value = 0.9;
    this.lanes = this.lanesS.mesh;
  }

  buildTunnel() {
    const geo = new THREE.CylinderGeometry(26, 26, 1600, 72, 1, true);
    geo.rotateX(Math.PI / 2);
    this.tunnelUni = { uScroll: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 } };
    this.tunnel = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.tunnelUni, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: TUNNEL_FRAG, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.tunnel.position.z = -700;
    this.tunnel.renderOrder = -20; this.tunnel.frustumCulled = false;
    this.scene.add(this.tunnel);
  }

  buildGates() {
    this.gateGroup = new THREE.Group();
    this.scene.add(this.gateGroup);
    this.gateGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 3.2) });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, metalness: 0.85, roughness: 0.35, flatShading: true, envMap: this.envMap });
    const glowGeo = new THREE.TorusGeometry(25, 0.55, 6, 6);
    const frameGeo = new THREE.TorusGeometry(26.4, 1.7, 4, 6);
    const podGeo = new THREE.BoxGeometry(3.2, 3.2, 5);
    this.gates = [];
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(frameGeo, frameMat), new THREE.Mesh(glowGeo, this.gateGlow));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const pod = new THREE.Mesh(podGeo, frameMat);
        pod.position.set(Math.cos(a) * 26.4, Math.sin(a) * 26.4, 0); pod.rotation.z = a;
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 5.4), this.gateGlow);
        lamp.position.copy(pod.position).multiplyScalar(1.07); lamp.rotation.z = a;
        g.add(pod, lamp);
      }
      g.visible = false; g.position.set(0, 2, -1300);
      this.gateGroup.add(g);
      this.gates.push(g);
    }
  }

  spawnGate(z = -1250) {
    const g = this.gates.find((x) => !x.visible);
    if (!g) return;
    g.visible = true; g.position.z = z; g.rotation.z = 0; g.userData.passed = false;
  }

  setPalette(name) { this.palTarget = PALETTES[name] || PALETTES.zako; }
  setWorld(v) { for (const o of this.world) o.visible = v; if (!v) for (const g of this.gates) g.visible = false; this.worldOn = v; }

  resize(w, h, pr) {
    for (const s of [this.streaks, this.lanesS]) { s.uni.uRes.value.set(w * pr, h * pr); s.uni.uWidth.value = 1.7 * pr; }
    this.lanesS.uni.uWidth.value = 2.4 * pr;
    this.starMat.uniforms.uPx.value = pr * Math.max(1, h / 900);
  }

  update(dt, speed, camera, tunnelAlpha) {
    this.time += dt;
    const dz = speed * dt;
    this.scroll += dz;
    const p = this.pal, tg = this.palTarget, k = 1 - Math.exp(-dt * 1.6);
    for (const key in p) for (let i = 0; i < 3; i++) p[key][i] = lerp(p[key][i], tg[key][i], k);
    const set = (v, a) => v.set(a[0], a[1], a[2]);

    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    set(this.skyMat.uniforms.uTint.value, p.tint);
    this.starMat.uniforms.uTime.value = this.time;
    this.planetGroup.position.copy(camera.position).add(this.planetOffset);
    this.planetGroup.rotation.y += dt * 0.004;
    this.planetUni.uTime.value = this.time;
    set(this.planetUni.uTint.value, p.tint);
    this.sunGroup.position.copy(camera.position).add(this.sunOffset);

    const fu = this.floorUni;
    fu.uScroll.value = this.scroll; fu.uTime.value = this.time; fu.uFogDensity.value = this.fogDensity;
    set(fu.uSeam.value, p.seam); set(fu.uLight.value, p.light); set(fu.uFog.value, p.fog); set(fu.uLane.value, p.lane);
    const tu = this.towerUni;
    tu.uTime.value = this.time; tu.uFogDensity.value = this.fogDensity;
    set(tu.uFog.value, p.fog); set(tu.uWinA.value, p.winA); set(tu.uWinB.value, p.winB); set(tu.uEdge.value, p.edge);
    if (this.scene.fog) this.scene.fog.color.setRGB(p.fog[0], p.fog[1], p.fog[2]);

    const arr = this.towers.instanceMatrix.array;
    let seedsDirty = false;
    const camZ = camera.position.z;
    for (let i = 0; i < this.towerData.length; i++) {
      const t = this.towerData[i];
      t.z += dz;
      if (t.z - t.d * 0.5 > camZ + 30) { t.z -= this.towerSpan; this.randomizeTower(t); }
      if (t.dirty) { this.towerSeeds.array[i] = t.seed; seedsDirty = true; t.dirty = false; }
      const o = i * 16;
      arr[o] = t.w; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0;
      arr[o + 4] = 0; arr[o + 5] = t.h; arr[o + 6] = 0; arr[o + 7] = 0;
      arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = t.d; arr[o + 11] = 0;
      arr[o + 12] = t.x; arr[o + 13] = -22; arr[o + 14] = t.z; arr[o + 15] = 1;
    }
    this.towers.instanceMatrix.needsUpdate = true;
    if (seedsDirty) this.towerSeeds.needsUpdate = true;

    const su = this.streaks.uni;
    su.uScroll.value = this.scroll; su.uNearZ.value = camZ - 0.5;
    su.uLen.value = Math.min(160, Math.max(0.4, speed * 0.075));
    set(su.uColor.value, p.streak);
    su.uAlpha.value = Math.min(0.95, 0.45 + speed / 800);
    const lu = this.lanesS.uni;
    lu.uScroll.value = this.scroll; lu.uNearZ.value = camZ - 0.5;
    lu.uLen.value = Math.min(90, Math.max(4, speed * 0.12));
    set(lu.uColor.value, p.light);

    this.tunnel.visible = tunnelAlpha > 0.002;
    this.tunnelUni.uAlpha.value = tunnelAlpha;
    this.tunnelUni.uScroll.value = this.scroll;
    this.tunnelUni.uTime.value = this.time;
    this.tunnel.position.x = camera.position.x * 0.2;

    if (this.worldOn && this.gateInterval > 0) {
      this.gateDist += dz;
      if (this.gateDist >= this.gateInterval) { this.gateDist = 0; this.spawnGate(); }
    }
    for (const g of this.gates) {
      if (!g.visible) continue;
      g.position.z += dz;
      g.rotation.z += dt * 0.3;
      if (!g.userData.passed && g.position.z > camZ - 4) { g.userData.passed = true; if (this.onGatePass) this.onGatePass(); }
      if (g.position.z > camZ + 40) g.visible = false;
    }
    const gl = 0.7 + 0.3 * Math.sin(this.time * 6);
    this.gateGlow.color.setRGB(p.lane[0] * 1.3 * gl, p.lane[1] * 1.3 * gl, p.lane[2] * 1.3 * gl);
  }
}

import * as THREE from 'three';
import { clamp, lerp, Ease, mulberry32, smoothstep } from './util.js';
import { cardBack } from './cards.js';

export const TIER_HEX = ['#4fb4ff', '#ffc233', '#ff8af0'];
const IDLE_HEX = '#6f95ff';
export const CARD_DIST = 4.6;
const CRYSTAL_Y = 1.85;

export const POSES = {
  home: { pos: [0, 2.75, 10.8], look: [0, 1.6, 0] },
  charge: { pos: [0, 2.1, 7.1], look: [0, 1.95, 0] },
  reveal: { pos: [0, 1.9, 7.8], look: [0, 2.85, 0] },
  results: { pos: [0, 3.9, 13.2], look: [0, 2.4, 0] },
};

const HUE = /* glsl */ `
vec3 hue2rgb(float h) {
  h = fract(h);
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}`;

const VS_UV = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasTex(c, srgb = false) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function gauss(rng) {
  return (rng() + rng() + rng() + rng() - 2) / 2;
}

/* ------------------------------------------------------------------ textures */

function glowTexture() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.25)');
  grd.addColorStop(0.65, 'rgba(255,255,255,0.06)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return canvasTex(c);
}

function starTexture() {
  const S = 256, C = 128;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(C, C, 0, C, C, C * 0.55);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'lighter';
  for (const [len, w, rot] of [[C, 7, 0], [C, 7, Math.PI / 2], [C * 0.55, 5, Math.PI / 4], [C * 0.55, 5, -Math.PI / 4]]) {
    g.save();
    g.translate(C, C);
    g.rotate(rot);
    const lg = g.createLinearGradient(-len, 0, len, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(-len, 0);
    g.quadraticCurveTo(0, -w, len, 0);
    g.quadraticCurveTo(0, w, -len, 0);
    g.fill();
    g.restore();
  }
  return canvasTex(c);
}

function runeGlyph(g, x, y, w, h, rng) {
  const P = [];
  for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) P.push([x + (q * w) / 2, y + (r * h) / 3]);
  g.beginPath();
  const stem = rng() < 0.7 ? 1 : rng() < 0.5 ? 0 : 2;
  g.moveTo(...P[stem]);
  g.lineTo(...P[9 + stem]);
  const n = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(rng() * 12), b = Math.floor(rng() * 12);
    if (a !== b) {
      g.moveTo(...P[a]);
      g.lineTo(...P[b]);
    }
  }
  g.stroke();
  if (rng() < 0.25) {
    const p = P[Math.floor(rng() * 12)];
    g.beginPath();
    g.arc(p[0], p[1], w * 0.16, 0, Math.PI * 2);
    g.stroke();
  }
}

function ringTool(g) {
  return (r, w) => {
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  };
}

function circleOuterTexture(S) {
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const C = S / 2, u = C / 1024;
  const rng = mulberry32(11);
  g.translate(C, C);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const ring = ringTool(g);
  ring(C * 0.985, 7 * u);
  ring(C * 0.955, 2.5 * u);
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const l = i % 10 === 0 ? 0.028 : i % 5 === 0 ? 0.018 : 0.01;
    g.lineWidth = (i % 10 === 0 ? 3 : 1.6) * u;
    g.beginPath();
    g.moveTo(Math.cos(a) * C * 0.955, Math.sin(a) * C * 0.955);
    g.lineTo(Math.cos(a) * C * (0.955 + l), Math.sin(a) * C * (0.955 + l));
    g.stroke();
  }
  ring(C * 0.93, 2 * u);
  ring(C * 0.8, 2 * u);
  ring(C * 0.775, 6 * u);
  const N = 36, rh = C * 0.085, rw = C * 0.05;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.translate(0, -C * 0.865);
    g.lineWidth = 4.5 * u;
    runeGlyph(g, -rw / 2, -rh / 2, rw, rh, rng);
    g.restore();
    g.save();
    g.rotate(a + Math.PI / N);
    g.beginPath();
    g.arc(0, -C * 0.865, 5 * u, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.cos(a) * C * 0.7, y = Math.sin(a) * C * 0.7;
    g.lineWidth = 3 * u;
    g.beginPath();
    g.arc(x, y, C * 0.042, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(x, y, C * 0.013, 0, Math.PI * 2);
    g.fill();
  }
  ring(C * 0.7, 1.5 * u);
  g.setLineDash([12 * u, 18 * u]);
  ring(C * 0.64, 2 * u);
  g.setLineDash([]);
  return canvasTex(c);
}

function circleMidTexture(S) {
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const C = S / 2, u = C / 512;
  const rng = mulberry32(23);
  g.translate(C, C);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const ring = ringTool(g);
  ring(C * 0.97, 5 * u);
  ring(C * 0.93, 2 * u);
  g.lineWidth = 4 * u;
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + k * Math.PI + (i * Math.PI * 2) / 3;
      const x = Math.cos(a) * C * 0.93, y = Math.sin(a) * C * 0.93;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.stroke();
  }
  ring(C * 0.465, 3 * u);
  ring(C * 0.43, 1.5 * u);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    const x = Math.cos(a) * C * 0.93, y = Math.sin(a) * C * 0.93;
    g.save();
    g.translate(x, y);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(0, 0, C * 0.075, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 3 * u;
    g.beginPath();
    g.arc(0, 0, C * 0.075, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2.5 * u;
    runeGlyph(g, -C * 0.02, -C * 0.035, C * 0.04, C * 0.07, rng);
    g.restore();
  }
  const N = 24;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.translate(0, -C * 0.555);
    g.lineWidth = 2.5 * u;
    runeGlyph(g, -C * 0.018, -C * 0.035, C * 0.036, C * 0.07, rng);
    g.restore();
  }
  ring(C * 0.62, 1.5 * u);
  return canvasTex(c);
}

function circleInnerTexture(S) {
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const C = S / 2, u = C / 512;
  g.translate(C, C);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineJoin = 'round';
  const ring = ringTool(g);
  ring(C * 0.96, 4 * u);
  ring(C * 0.9, 1.5 * u);
  g.lineWidth = 3 * u;
  const V = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    V.push([Math.cos(a) * C * 0.9, Math.sin(a) * C * 0.9]);
  }
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const p = V[(i * 3) % 8];
    if (i === 0) g.moveTo(...p);
    else g.lineTo(...p);
  }
  g.stroke();
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    for (let i = 0; i <= 4; i++) {
      const p = V[(i * 2 + k) % 8];
      if (i === 0) g.moveTo(...p);
      else g.lineTo(...p);
    }
    g.stroke();
  }
  ring(C * 0.38, 3 * u);
  ring(C * 0.3, 1.5 * u);
  g.setLineDash([6 * u, 8 * u]);
  ring(C * 0.22, 2 * u);
  g.setLineDash([]);
  g.beginPath();
  const r1 = C * 0.16, r2 = C * 0.035;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  return canvasTex(c);
}

function runeStripTexture() {
  const W = 2048, H = 160;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const rng = mulberry32(31);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineWidth = 2;
  g.fillRect(0, 10, W, 3);
  g.fillRect(0, H - 14, W, 3);
  g.lineWidth = 4;
  const n = 40;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (W / n);
    runeGlyph(g, x - 16, 40, 32, 80, rng);
  }
  return canvasTex(c);
}

function pillarRuneTexture() {
  const W = 64, H = 640;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const rng = mulberry32(41);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineWidth = 3;
  g.fillRect(4, 0, 2, H);
  g.fillRect(W - 6, 0, 2, H);
  for (let i = 0; i < 9; i++) runeGlyph(g, 20, 20 + i * 68, 24, 44, rng);
  return canvasTex(c);
}

function cardGlowTexture() {
  const W = 460, H = 610;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.shadowColor = '#ffffff';
  g.fillStyle = '#ffffff';
  for (const b of [70, 30]) {
    g.shadowBlur = b;
    g.beginPath();
    g.roundRect(80, 80, 300, 450, 22);
    g.fill();
  }
  return canvasTex(c);
}

function skyCanvas() {
  const W = 4096, H = 1024;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const rng = mulberry32(2024);
  const yOf = (elev) => ((90 - elev) / 100.8) * H;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#010208');
  bg.addColorStop(0.3, '#030719');
  bg.addColorStop(0.6, '#070b2a');
  bg.addColorStop(0.82, '#131341');
  bg.addColorStop(0.893, '#2b1d55');
  bg.addColorStop(0.91, '#100c24');
  bg.addColorStop(1, '#040308');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const blob = (x, y, r, col, a) => {
    for (const ox of [0, -W, W]) {
      const X = x + ox;
      if (X + r < 0 || X - r > W) continue;
      const grd = g.createRadialGradient(X, y, 0, X, y, r);
      grd.addColorStop(0, col.replace('A', a));
      grd.addColorStop(1, col.replace('A', 0));
      g.fillStyle = grd;
      g.fillRect(X - r, y - r, r * 2, r * 2);
    }
  };
  const bandE = (x) => 36 + 24 * Math.sin((x / W) * Math.PI * 2 - Math.PI);
  g.globalCompositeOperation = 'lighter';
  const neb = ['rgba(70,50,170,A)', 'rgba(30,80,170,A)', 'rgba(140,50,160,A)', 'rgba(30,120,160,A)', 'rgba(110,70,200,A)'];
  for (let i = 0; i < 90; i++) {
    const x = rng() * W, y = yOf(8 + rng() * 60);
    blob(x, y, 70 + rng() * 260, neb[i % neb.length], 0.035 + rng() * 0.045);
  }
  // brighter clouds in front of the camera
  for (let i = 0; i < 40; i++) {
    const x = W * (0.62 + rng() * 0.26), y = yOf(14 + rng() * 34);
    blob(x, y, 60 + rng() * 200, ['rgba(170,60,190,A)', 'rgba(60,110,230,A)', 'rgba(230,90,170,A)'][i % 3], 0.03 + rng() * 0.04);
  }
  const band = ['rgba(110,90,210,A)', 'rgba(140,120,255,A)', 'rgba(180,140,255,A)', 'rgba(110,170,255,A)', 'rgba(255,150,220,A)'];
  for (let i = 0; i < 1100; i++) {
    const x = rng() * W;
    const y = yOf(bandE(x) + gauss(rng) * 7);
    blob(x, y, 14 + rng() * 80, band[i % band.length], 0.02 + rng() * 0.035);
  }
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 260; i++) {
    const x = rng() * W;
    const y = yOf(bandE(x) + gauss(rng) * 2.2);
    const r = 10 + rng() * 36;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(3,3,12,0.28)');
    grd.addColorStop(1, 'rgba(3,3,12,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12000; i++) {
    const nearBand = rng() < 0.45;
    const x = rng() * W;
    const e = nearBand ? bandE(x) + gauss(rng) * 9 : 2 + Math.pow(rng(), 0.8) * 80;
    const y = yOf(e);
    const big = rng() > 0.975;
    const r = big ? 1.1 + rng() * 1.3 : 0.4 + rng() * 0.8;
    const a = (0.25 + rng() * 0.75) * (e < 6 ? 0.4 : 1);
    g.fillStyle = `rgba(${(200 + rng() * 55) | 0},${(205 + rng() * 50) | 0},255,${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 110; i++) {
    const x = rng() * W, y = yOf(4 + rng() * 75);
    blob(x, y, 7 + rng() * 12, 'rgba(190,210,255,A)', 0.45);
  }
  const hz = g.createLinearGradient(0, yOf(12), 0, yOf(-3));
  hz.addColorStop(0, 'rgba(90,60,170,0)');
  hz.addColorStop(0.75, 'rgba(130,80,190,0.32)');
  hz.addColorStop(1, 'rgba(60,40,120,0)');
  g.fillStyle = hz;
  g.fillRect(0, yOf(12), W, yOf(-3) - yOf(12));
  return c;
}

/* ------------------------------------------------------------------ materials */

function circleMaterial(tex, S) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uIntensity: { value: 1 }, uTime: S.uTime, uTier: S.uTier, uRainbow: S.uRainbow, uFlare: S.uFlare },
    vertexShader: VS_UV,
    fragmentShader: /* glsl */ `
      ${HUE}
      uniform sampler2D uMap;
      uniform float uIntensity, uTime, uRainbow, uFlare;
      uniform vec3 uTier;
      varying vec2 vUv;
      void main() {
        float a = texture2D(uMap, vUv).a;
        vec2 p = vUv - 0.5;
        float ang = atan(p.y, p.x);
        float sweep = 0.62 + 0.38 * sin(ang * 3.0 - uTime * 2.4);
        vec3 rb = hue2rgb(ang / 6.2831853 + uTime * 0.12) * 1.1 + 0.08;
        vec3 col = mix(uTier, rb, uRainbow);
        col = col * (1.0 + uFlare * 0.8) + vec3(uFlare * 0.4);
        gl_FragColor = vec4(col * uIntensity * sweep, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function raysMaterial(uColor, uRainbow, uTime) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor, uRainbow, uTime, uIntensity: { value: 0 } },
    vertexShader: VS_UV,
    fragmentShader: /* glsl */ `
      ${HUE}
      uniform vec3 uColor;
      uniform float uRainbow, uTime, uIntensity;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float a = atan(p.y, p.x);
        float rays = pow(0.5 + 0.5 * sin(a * 14.0 + uTime * 0.7), 6.0) * 0.8
                   + pow(0.5 + 0.5 * sin(a * 9.0 - uTime * 0.45 + 1.7), 10.0) * 0.9
                   + pow(0.5 + 0.5 * sin(a * 23.0 + uTime * 1.1), 16.0) * 0.5;
        float fall = pow(clamp(1.0 - r, 0.0, 1.0), 1.7);
        float core = exp(-r * r * 16.0);
        vec3 tint = mix(uColor, hue2rgb(a / 6.2831853 + uTime * 0.15 + r * 0.4) * 1.1, uRainbow);
        vec3 col = tint * (rays * fall * 0.85 + core * 1.2) * uIntensity;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

const PARTICLE_VS = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(0.05, -mv.z), 0.0, 220.0);
  vColor = aColor;
  vAlpha = aAlpha;
}`;

const PARTICLE_FS = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float glow = pow(1.0 - d, 2.2);
  float hot = pow(max(0.0, 1.0 - d * 2.4), 2.0);
  gl_FragColor = vec4(vColor * glow + vec3(hot) * 0.85, vAlpha);
  #include <colorspace_fragment>
}`;

function hueInto(h, out, i) {
  h -= Math.floor(h);
  const r = clamp(Math.abs(h * 6 - 3) - 1), g = clamp(2 - Math.abs(h * 6 - 2)), b = clamp(2 - Math.abs(h * 6 - 4));
  out[i] = r * 0.85 + 0.15;
  out[i + 1] = g * 0.85 + 0.15;
  out[i + 2] = b * 0.85 + 0.15;
}

class Particles {
  constructor(max, renderOrder) {
    this.max = max;
    this.cur = 0;
    const F = (n) => new Float32Array(max * n);
    this.p = F(3); this.v = F(3); this.bc = F(3); this.tg = F(3);
    this.life = F(1); this.ml = F(1); this.sz = F(1); this.dr = F(1); this.gr = F(1);
    this.at = F(1); this.sw = F(1); this.hue = F(1).fill(-1); this.kr = F(1);
    this.aP = F(3); this.aC = F(3); this.aS = F(1); this.aA = F(1);
    const geo = new THREE.BufferGeometry();
    this.attrs = [
      ['position', new THREE.BufferAttribute(this.aP, 3)],
      ['aColor', new THREE.BufferAttribute(this.aC, 3)],
      ['aSize', new THREE.BufferAttribute(this.aS, 1)],
      ['aAlpha', new THREE.BufferAttribute(this.aA, 1)],
    ];
    for (const [k, a] of this.attrs) {
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(k, a);
    }
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 } },
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      transparent: true,
      depthWrite: false,
      depthTest: renderOrder < 10,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
  }

  spawn(o) {
    const i = this.cur;
    this.cur = (this.cur + 1) % this.max;
    const i3 = i * 3;
    this.p[i3] = o.x; this.p[i3 + 1] = o.y; this.p[i3 + 2] = o.z;
    this.v[i3] = o.vx || 0; this.v[i3 + 1] = o.vy || 0; this.v[i3 + 2] = o.vz || 0;
    this.bc[i3] = o.r ?? 1; this.bc[i3 + 1] = o.g ?? 1; this.bc[i3 + 2] = o.b ?? 1;
    this.life[i] = this.ml[i] = o.life || 1;
    this.sz[i] = o.size || 0.1;
    this.dr[i] = o.drag || 0;
    this.gr[i] = o.grav || 0;
    this.at[i] = o.attract || 0;
    this.sw[i] = o.swirl || 0;
    this.hue[i] = o.hue ?? -1;
    this.kr[i] = o.kill || 0;
    if (o.attract) {
      this.tg[i3] = o.tx; this.tg[i3 + 1] = o.ty; this.tg[i3 + 2] = o.tz;
    }
  }

  clear() {
    this.life.fill(0);
    this.aA.fill(0);
  }

  update(dt, time) {
    const { p, v, life, ml, aP, aA, aS, aC } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) {
        aA[i] = 0;
        continue;
      }
      life[i] -= dt;
      const i3 = i * 3;
      if (this.at[i] > 0) {
        const dx = this.tg[i3] - p[i3], dy = this.tg[i3 + 1] - p[i3 + 1], dz = this.tg[i3 + 2] - p[i3 + 2];
        const d = Math.hypot(dx, dy, dz) + 1e-4;
        const A = this.at[i], W = this.sw[i];
        v[i3] += ((dx / d) * A - (dz / d) * W) * dt;
        v[i3 + 1] += (dy / d) * A * dt;
        v[i3 + 2] += ((dz / d) * A + (dx / d) * W) * dt;
        if (d < this.kr[i]) life[i] = Math.min(life[i], 0.06);
      }
      v[i3 + 1] += this.gr[i] * dt;
      if (this.dr[i] > 0) {
        const f = Math.exp(-this.dr[i] * dt);
        v[i3] *= f; v[i3 + 1] *= f; v[i3 + 2] *= f;
      }
      p[i3] += v[i3] * dt; p[i3 + 1] += v[i3 + 1] * dt; p[i3 + 2] += v[i3 + 2] * dt;
      aP[i3] = p[i3]; aP[i3 + 1] = p[i3 + 1]; aP[i3 + 2] = p[i3 + 2];
      const k = Math.max(0, life[i] / ml[i]);
      aA[i] = Math.min(1, (1 - k) * 12) * Math.min(1, k * 3.2);
      aS[i] = this.sz[i] * (0.55 + 0.45 * k);
      if (this.hue[i] >= 0) hueInto(this.hue[i] + time * 0.45, aC, i3);
      else {
        aC[i3] = this.bc[i3]; aC[i3 + 1] = this.bc[i3 + 1]; aC[i3 + 2] = this.bc[i3 + 2];
      }
    }
    for (const [, a] of this.attrs) a.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ world */

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class World {
  constructor(canvas, clock) {
    this.clock = clock;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x02030a, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 1200);
    this.scene.add(this.camera);

    this.S = {
      uTime: { value: 0 },
      uTier: { value: new THREE.Color(IDLE_HEX) },
      uRainbow: { value: 0 },
      uFlare: { value: 0 },
    };
    this.tierTarget = new THREE.Color(IDLE_HEX);
    this.rainbowTarget = 0;
    this.tint = new THREE.Color(IDLE_HEX);
    this._hsl = new THREE.Color();
    this.time = 0;
    this.charge = 0;
    this.flare = 0;
    this.shakeAmp = 0;
    this.crystalScale = 1;
    this.crystalLift = 0;
    this.ringsFade = 1;
    this.cam = { pos: new THREE.Vector3(...POSES.home.pos), look: new THREE.Vector3(...POSES.home.look) };
    this.pointer = new THREE.Vector2();
    this.pointerS = new THREE.Vector2();
    this.ambientAcc = 0;
    this.spiralAcc = 0;
    this.shards = [];
    this.faceTextures = new Map();
    this.card = { spin: false, spinSpeed: 0, shake: 0, interactive: false, tilt: new THREE.Vector2() };

    this.tex = { glow: glowTexture(), star: starTexture() };
    this.buildSky();
    this.buildGround();
    this.buildAltar();
    this.buildPillars();
    this.buildCrystal();
    this.buildLights();
    this.particles = new Particles(3200, 6);
    this.front = new Particles(1600, 12);
    this.scene.add(this.particles.points, this.front.points);
    this.buildBeam();
    this.buildWaves();
    this.buildFlashes();
    this.buildCard();
  }

  /* ---------------------------------------------------------------- build */

  buildSky() {
    const tex = canvasTex(skyCanvas(), true);
    const geo = new THREE.SphereGeometry(500, 96, 32, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false }));
    sky.renderOrder = -10;
    this.scene.add(sky);

    const N = 1400;
    const pos = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N), col = new Float32Array(N * 3);
    const rng = mulberry32(5);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const az = rng() * Math.PI * 2;
      const el = Math.asin(0.04 + rng() * 0.94);
      const r = 420;
      pos[i * 3] = Math.cos(el) * Math.cos(az) * r;
      pos[i * 3 + 1] = Math.sin(el) * r;
      pos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r;
      size[i] = 1.4 + Math.pow(rng(), 7) * 7;
      phase[i] = rng();
      c.setHSL(rng() > 0.8 ? 0.1 : 0.6, 0.6, 0.85);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo2 = new THREE.BufferGeometry();
    geo2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo2.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo2.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo2.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    this.twinkleMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.S.uTime, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aColor;
        uniform float uTime, uScale;
        varying vec3 vColor;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.55 + 0.45 * sin(uTime * (0.8 + aPhase * 1.9) + aPhase * 40.0);
          gl_PointSize = aSize * (0.75 + 0.5 * tw) * uScale;
          vColor = aColor;
          vA = tw;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 2.5);
          float sp = max(0.0, 1.0 - abs(c.x) * 16.0) * max(0.0, 1.0 - abs(c.y) * 2.0)
                   + max(0.0, 1.0 - abs(c.y) * 16.0) * max(0.0, 1.0 - abs(c.x) * 2.0);
          gl_FragColor = vec4(vColor, (a + sp * 0.4) * vA);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(geo2, this.twinkleMat);
    stars.renderOrder = -9;
    stars.frustumCulled = false;
    this.scene.add(stars);
  }

  buildGround() {
    this.groundMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.S.uTime, uTier: this.S.uTier, uRainbow: this.S.uRainbow,
        uGlow: { value: 0.2 }, uHorizon: { value: new THREE.Color('#171333') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${HUE}
        uniform float uTime, uRainbow, uGlow;
        uniform vec3 uTier, uHorizon;
        varying vec3 vW;
        void main() {
          vec2 p = vW.xz;
          float r = length(p);
          float ang = atan(p.y, p.x);
          vec3 col = vec3(0.010, 0.012, 0.028);
          vec3 tint = mix(uTier, hue2rgb(ang / 6.2831853 + uTime * 0.1) * 1.1, uRainbow);
          float x1 = r * 0.5;
          float l1 = 1.0 - smoothstep(0.0, fwidth(x1) * 1.3, abs(fract(x1 - 0.5) - 0.5));
          float x2 = ang / 6.2831853 * 32.0;
          float w2 = min(fwidth(x2), fwidth(fract(x2 + 0.5)));
          float l2 = 1.0 - smoothstep(0.0, w2 * 1.3, abs(fract(x2 - 0.5) - 0.5));
          float grid = max(l1, l2 * 0.55) * smoothstep(36.0, 6.0, r) * smoothstep(4.5, 5.4, r);
          col += tint * grid * (0.08 + 0.4 * uGlow);
          col += tint * exp(-r * r / 22.0) * (0.10 + 0.6 * uGlow);
          col += tint * exp(-r * r / 260.0) * 0.035;
          float d = length(vW - cameraPosition);
          col = mix(col, uHorizon, smoothstep(30.0, 170.0, d));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), this.groundMat);
    m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
  }

  buildAltar() {
    const stone = new THREE.MeshStandardMaterial({ color: 0x1a1c2e, roughness: 0.7, metalness: 0.3 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.85, 0.28, 96), stone);
    top.position.y = 0.14;
    const step = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.45, 0.14, 96), stone);
    step.position.y = 0.07;
    this.scene.add(top, step);
    this.rimMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const [r, y, w] of [[3.71, 0.282, 0.022], [4.31, 0.142, 0.016]]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 220), this.rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = y;
      this.scene.add(rim);
    }
    const layers = [
      [circleOuterTexture(2048), 7.1, 0.05],
      [circleMidTexture(1024), 4.9, -0.085],
      [circleInnerTexture(1024), 2.8, 0.15],
    ];
    this.circles = layers.map(([tex, size, speed], i) => {
      const mat = circleMaterial(tex, this.S);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.29 + i * 0.003;
      m.renderOrder = 1;
      this.scene.add(m);
      return { mesh: m, speed, mat, rot: 0 };
    });
    // a floating copy of the middle circle that lights up while charging
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), circleMaterial(layers[1][0], this.S));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.95;
    halo.renderOrder = 1;
    halo.material.uniforms.uIntensity.value = 0;
    this.scene.add(halo);
    this.haloCircle = { mesh: halo, rot: 0 };

    const wallTex = runeStripTexture();
    wallTex.wrapS = THREE.RepeatWrapping;
    this.wallMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: wallTex }, uOpacity: { value: 0 }, uTime: this.S.uTime, uTier: this.S.uTier, uRainbow: this.S.uRainbow },
      vertexShader: VS_UV,
      fragmentShader: /* glsl */ `
        ${HUE}
        uniform sampler2D uMap;
        uniform float uOpacity, uTime, uRainbow;
        uniform vec3 uTier;
        varying vec2 vUv;
        void main() {
          float runes = vUv.y < 0.3 ? texture2D(uMap, vec2(vUv.x * 4.0 + uTime * 0.03, vUv.y / 0.3)).a : 0.0;
          float curtain = pow(1.0 - vUv.y, 2.4);
          float streak = 0.55 + 0.45 * sin(vUv.x * 251.3 + uTime * 1.5) * sin(vUv.x * 81.7 - uTime * 0.7);
          vec3 tint = mix(uTier, hue2rgb(vUv.x * 2.0 + uTime * 0.1), uRainbow);
          vec3 col = tint * (runes * 1.1 + curtain * 0.5 * streak);
          gl_FragColor = vec4(col * uOpacity, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.35, 1.9, 96, 1, true), this.wallMat);
    wall.position.y = 0.29 + 0.95;
    wall.renderOrder = 2;
    this.scene.add(wall);
  }

  buildPillars() {
    const stone = new THREE.MeshStandardMaterial({ color: 0x292d45, roughness: 0.85, metalness: 0.15, flatShading: true });
    const shaftGeo = new THREE.CylinderGeometry(0.3, 0.42, 4.4, 4, 1);
    shaftGeo.rotateY(Math.PI / 4);
    const capGeo = new THREE.ConeGeometry(0.44, 0.75, 4);
    capGeo.rotateY(Math.PI / 4);
    const baseGeo = new THREE.BoxGeometry(1.1, 0.35, 1.1);
    const stripTex = pillarRuneTexture();
    this.stripMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: stripTex }, uIntensity: { value: 0.4 }, uTier: this.S.uTier, uRainbow: this.S.uRainbow, uTime: this.S.uTime },
      vertexShader: VS_UV,
      fragmentShader: /* glsl */ `
        ${HUE}
        uniform sampler2D uMap;
        uniform float uIntensity, uRainbow, uTime;
        uniform vec3 uTier;
        varying vec2 vUv;
        void main() {
          float a = texture2D(uMap, vUv).a;
          float wave = 0.6 + 0.4 * sin(vUv.y * 12.0 - uTime * 3.0);
          vec3 tint = mix(uTier, hue2rgb(vUv.y + uTime * 0.2), uRainbow);
          gl_FragColor = vec4(tint * uIntensity * wave, a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.orbMats = [];
    const orbMat = new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.orbMats.push(orbMat);
    this.pillarOrbs = [];
    for (const deg of [50, 100, 150, -50, -100, -150]) {
      const a = (deg * Math.PI) / 180, R = 6.6;
      const grp = new THREE.Group();
      grp.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
      grp.lookAt(0, 0, 0);
      const base = new THREE.Mesh(baseGeo, stone);
      base.position.y = 0.175;
      const shaft = new THREE.Mesh(shaftGeo, stone);
      shaft.position.y = 0.35 + 2.2;
      const cap = new THREE.Mesh(capGeo, stone);
      cap.position.y = 0.35 + 4.4 + 0.375;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 3.6), this.stripMat);
      strip.position.set(0, 2.55, 0.268);
      strip.rotation.x = -0.0193;
      const orb = new THREE.Sprite(orbMat);
      orb.position.y = 5.8;
      orb.scale.setScalar(1.3);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      core.position.y = 5.8;
      grp.add(base, shaft, cap, strip, orb, core);
      this.pillarOrbs.push({ orb, core, phase: Math.random() * 6 });
      this.scene.add(grp);
    }
  }

  buildCrystal() {
    const g = (this.crystal = new THREE.Group());
    g.position.set(0, CRYSTAL_Y, 0);
    this.scene.add(g);
    const geo = new THREE.OctahedronGeometry(0.5, 0);
    geo.scale(0.78, 1.5, 0.78);
    this.crystalMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.S.uTime, uTier: this.S.uTier, uRainbow: this.S.uRainbow, uGlow: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        varying vec3 vP;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          vP = position;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        ${HUE}
        uniform vec3 uTier;
        uniform float uTime, uRainbow, uGlow;
        varying vec3 vN;
        varying vec3 vV;
        varying vec3 vP;
        void main() {
          vec3 n = normalize(vN);
          float f = 1.0 - abs(dot(n, normalize(vV)));
          float facet = 0.5 + 0.5 * dot(n, normalize(vec3(0.4, 0.8, 0.45)));
          vec3 tint = mix(uTier, hue2rgb(vP.y * 0.7 + uTime * 0.25 + atan(vP.z, vP.x) / 6.2831853), uRainbow);
          vec3 col = tint * (0.25 + 0.65 * facet) + vec3(1.0) * pow(f, 2.0) * 0.7 + tint * uGlow * 0.9 + vec3(pow(facet, 8.0)) * 0.5;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.crystalMesh = new THREE.Mesh(geo, this.crystalMat);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.crystalMesh.add(edges);
    g.add(this.crystalMesh);
    const spr = (map, size, opacity) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
      s.scale.setScalar(size);
      g.add(s);
      return s;
    };
    this.crystalHalo = spr(this.tex.glow, 4.2, 0.5);
    this.crystalCore = spr(this.tex.glow, 1.2, 0.9);
    this.crystalFlare = spr(this.tex.star, 2.6, 0.8);
    this.satellites = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), this.crystalMat);
      this.scene.add(m);
      this.satellites.push({ m, phase: (i / 3) * Math.PI * 2, r: 0.95 + i * 0.12, tilt: 0.3 + i * 0.35 });
    }
    this.crystalRays = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), raysMaterial(this.S.uTier, this.S.uRainbow, this.S.uTime));
    this.crystalRays.position.set(0, CRYSTAL_Y, -0.4);
    this.scene.add(this.crystalRays);

    this.rings = [];
    const tilts = [[1.2, 0.2, 0], [0.4, 0.9, 0.3], [-0.6, -0.4, 0.8]];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
      const r = 1.05 + i * 0.3;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012 + i * 0.003, 6, 180), mat);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), mat);
      bead.position.x = r;
      const bead2 = bead.clone();
      bead2.position.x = -r;
      ring.add(bead, bead2);
      const holder = new THREE.Group();
      holder.position.set(0, CRYSTAL_Y, 0);
      holder.rotation.set(...tilts[i]);
      holder.add(ring);
      this.scene.add(holder);
      this.rings.push({ holder, ring, mat, speed: [0.7, -0.5, 0.38][i], prec: [0.08, -0.06, 0.05][i] });
    }
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x5b6bd6, 0x07070f, 0.9));
    const moon = new THREE.DirectionalLight(0x9aa8ff, 1.1);
    moon.position.set(-5, 10, -6);
    this.scene.add(moon);
    this.pLight = new THREE.PointLight(0x88aaff, 30, 0, 2);
    this.pLight.position.set(0, CRYSTAL_Y, 0);
    this.scene.add(this.pLight);
  }

  buildBeam() {
    const geo = new THREE.CylinderGeometry(1, 1, 60, 48, 1, true);
    geo.translate(0, 30, 0);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.S.uTime, uTier: this.S.uTier, uRainbow: this.S.uRainbow, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vF;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normal);
          vF = abs(dot(n, normalize(-mv.xyz)));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        ${HUE}
        uniform float uTime, uRainbow, uOpacity;
        uniform vec3 uTier;
        varying vec2 vUv;
        varying float vF;
        void main() {
          float core = pow(vF, 2.5);
          float fade = pow(1.0 - vUv.y, 1.3);
          float streak = 0.65 + 0.35 * sin(vUv.x * 62.83 + uTime * 5.0 - vUv.y * 40.0);
          vec3 tint = mix(uTier, hue2rgb(vUv.y * 4.0 - uTime * 0.6), uRainbow);
          vec3 col = (tint * 1.3 + vec3(0.7) * core) * core * fade * streak * uOpacity;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.beam.position.set(0, 0.3, 0);
    this.beam.visible = false;
    this.scene.add(this.beam);
  }

  buildWaves() {
    this.waves = [];
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: this.S.uTime, uColor: { value: new THREE.Color() }, uRainbow: { value: 0 }, uOpacity: { value: 0 }, uThick: { value: 0.05 } },
        vertexShader: VS_UV,
        fragmentShader: /* glsl */ `
          ${HUE}
          uniform vec3 uColor;
          uniform float uTime, uRainbow, uOpacity, uThick;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - 0.5;
            float d = length(p) * 2.0;
            float ring = exp(-pow((d - 0.86) / uThick, 2.0));
            float inner = smoothstep(0.86, 0.2, d) * 0.1;
            float a = (ring + inner) * uOpacity * smoothstep(1.0, 0.94, d);
            vec3 tint = mix(uColor, hue2rgb(atan(p.y, p.x) / 6.2831853 + uTime * 0.3), uRainbow);
            gl_FragColor = vec4(tint * 1.3 + ring * 0.35, a);
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.visible = false;
      this.scene.add(m);
      this.waves.push({ mesh: m, mat, active: false, t: 0 });
    }
  }

  buildFlashes() {
    this.flashes = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
      s.visible = false;
      s.renderOrder = 13;
      this.scene.add(s);
      this.flashes.push({ s, active: false, t: 0 });
    }
  }

  buildCard() {
    const root = (this.cardRoot = new THREE.Group());
    root.position.set(0, 0, -CARD_DIST);
    root.visible = false;
    this.camera.add(root);
    this.cardTilt = new THREE.Group();
    root.add(this.cardTilt);
    this.cardPivot = new THREE.Group();
    this.cardTilt.add(this.cardPivot);
    const geo = new THREE.PlaneGeometry(1.5, 2.25);
    this.faceMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: null }, uTime: this.S.uTime, uHolo: { value: 0 }, uGlint: { value: -2 },
        uTilt: { value: new THREE.Vector2() }, uBright: { value: 1 },
      },
      vertexShader: VS_UV,
      fragmentShader: /* glsl */ `
        ${HUE}
        uniform sampler2D uMap;
        uniform float uTime, uHolo, uGlint, uBright;
        uniform vec2 uTilt;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec4 base = texture2D(uMap, vUv);
          if (base.a < 0.02) discard;
          vec3 col = base.rgb;
          float band = vUv.x * 0.9 + vUv.y * 1.3 + uTilt.x * 1.1 - uTilt.y * 0.8 + uTime * 0.05;
          vec3 rb = hue2rgb(band * 1.3);
          float stripes = 0.8 + 0.2 * sin((vUv.x - vUv.y) * 90.0 + uTime * 0.6);
          float sweep = 0.6 + 0.4 * sin(band * 4.0 - uTime * 0.8);
          float lum = dot(col, vec3(0.3, 0.59, 0.11));
          float artMask = mix(0.3, 1.0, smoothstep(0.24, 0.32, vUv.y));
          float holo = uHolo * 0.32 * stripes * sweep * (0.35 + 0.9 * lum) * artMask;
          col += rb * holo * 0.6;
          vec2 grid = vUv * vec2(60.0, 90.0);
          float h = hash(floor(grid));
          float tw = pow(max(0.0, sin(uTime * 3.0 + h * 40.0)), 12.0);
          float spk = smoothstep(0.35, 0.0, length(fract(grid) - 0.5)) * step(0.93, h) * tw;
          col += vec3(spk * uHolo);
          float gx = vUv.x + (1.0 - vUv.y) * 0.45;
          col += vec3(1.0, 0.95, 0.82) * exp(-pow((gx - uGlint) * 7.0, 2.0)) * 0.5;
          gl_FragColor = vec4(col * uBright, base.a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.face = new THREE.Mesh(geo, this.faceMat);
    this.face.renderOrder = 10;
    this.cardPivot.add(this.face);
    const backTex = canvasTex(cardBack(), true);
    this.backMat = new THREE.MeshBasicMaterial({ map: backTex, transparent: true, depthTest: false, depthWrite: false });
    this.back = new THREE.Mesh(geo, this.backMat);
    this.back.rotation.y = Math.PI;
    this.back.renderOrder = 10;
    this.cardPivot.add(this.back);

    this.cardColor = { value: new THREE.Color(TIER_HEX[0]) };
    this.cardRainbow = { value: 0 };
    this.cardGlowMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: cardGlowTexture() }, uTime: this.S.uTime, uColor: this.cardColor, uRainbow: this.cardRainbow, uIntensity: { value: 0 } },
      vertexShader: VS_UV,
      fragmentShader: /* glsl */ `
        ${HUE}
        uniform sampler2D uMap;
        uniform vec3 uColor;
        uniform float uRainbow, uIntensity, uTime;
        varying vec2 vUv;
        void main() {
          float a = texture2D(uMap, vUv).a;
          vec2 p = vUv - 0.5;
          float ang = atan(p.y, p.x * 0.75);
          vec3 tint = mix(uColor, hue2rgb(ang / 6.2831853 + uTime * 0.35) * 1.1, uRainbow);
          gl_FragColor = vec4(tint * 1.4, a * uIntensity);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.05), this.cardGlowMat);
    glow.position.z = -0.01;
    glow.renderOrder = 9;
    this.cardPivot.add(glow);

    this.cardRaysMat = raysMaterial(this.cardColor, this.cardRainbow, this.S.uTime);
    this.cardRaysMat.depthTest = false;
    const rays = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), this.cardRaysMat);
    rays.position.z = -0.4;
    rays.renderOrder = 8;
    root.add(rays);
    this.cardRays = rays;

    this.dimMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const dim = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), this.dimMat);
    dim.position.z = -6;
    dim.renderOrder = 5;
    this.camera.add(dim);
  }

  // Compile hidden materials (waves, beam, card...) ahead of the first summon to avoid a hitch.
  precompile() {
    this.renderer.initTexture(this.backMat.map);
    this.renderer.initTexture(this.cardGlowMat.uniforms.uMap.value);
    if (this.renderer.extensions.has('KHR_parallel_shader_compile')) {
      this.renderer.compileAsync(this.scene, this.camera).catch(() => {});
    } else {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  /* ---------------------------------------------------------------- layout */

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 60 : 40;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    const scale = (h * pr) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.particles.mat.uniforms.uScale.value = scale;
    this.front.mat.uniforms.uScale.value = scale;
    this.twinkleMat.uniforms.uScale.value = pr * Math.max(0.8, h / 900);
  }

  viewHalf(dist = CARD_DIST) {
    const hh = Math.tan((this.camera.fov * Math.PI) / 360) * dist;
    return { hh, hw: hh * this.camera.aspect };
  }

  // Where the revealed card rests so the info panel has room.
  cardRestPos() {
    const { hh, hw } = this.viewHalf();
    if (this.camera.aspect >= 1) return new THREE.Vector3(-hw * 0.4, 0, -CARD_DIST);
    return new THREE.Vector3(0, hh * 0.3, -CARD_DIST);
  }

  screenToCardLocal(px, py) {
    const { hh, hw } = this.viewHalf();
    return new THREE.Vector3((px / this.w) * 2 * hw - hw, hh - (py / this.h) * 2 * hh, -CARD_DIST);
  }

  /* ---------------------------------------------------------------- state */

  setTier(tier) {
    if (tier < 0) {
      this.tierTarget.set(IDLE_HEX);
      this.rainbowTarget = 0;
    } else {
      this.tierTarget.set(TIER_HEX[Math.min(tier, 1)]);
      if (tier === 2) this.tierTarget.set('#ffe0f6');
      this.rainbowTarget = tier === 2 ? 1 : 0;
    }
  }

  tweenCamera(name, dur, ease = Ease.inOutCubic) {
    const P = POSES[name];
    const p0 = this.cam.pos.clone(), l0 = this.cam.look.clone();
    const p1 = new THREE.Vector3(...P.pos), l1 = new THREE.Vector3(...P.look);
    return this.clock.tween(dur, (k) => {
      this.cam.pos.lerpVectors(p0, p1, k);
      this.cam.look.lerpVectors(l0, l1, k);
    }, ease);
  }

  shake(a) {
    this.shakeAmp = Math.max(this.shakeAmp, a);
  }

  pulse(a = 1) {
    this.flare = Math.max(this.flare, a);
  }

  colorOf(tier) {
    return new THREE.Color(TIER_HEX[tier]);
  }

  wave({ pos, flat = false, s0 = 0.5, s1 = 6, dur = 0.9, tier = 0, thick = 0.06, front = false }) {
    const w = this.waves.find((x) => !x.active) || this.waves[0];
    w.active = true;
    w.t = 0;
    w.dur = dur;
    w.s0 = s0;
    w.s1 = s1;
    w.flat = flat;
    w.thick = thick;
    w.mesh.visible = true;
    w.mesh.position.copy(pos);
    w.mesh.renderOrder = front ? 11 : 3;
    w.mat.depthTest = !front;
    w.mat.uniforms.uColor.value.set(tier === 2 ? '#ffffff' : TIER_HEX[tier]);
    w.mat.uniforms.uRainbow.value = tier === 2 ? 1 : 0;
    if (flat) w.mesh.rotation.set(-Math.PI / 2, 0, 0);
  }

  flashAt(pos, size, dur, tier = -1) {
    const f = this.flashes.find((x) => !x.active) || this.flashes[0];
    f.active = true;
    f.t = 0;
    f.dur = dur;
    f.size = size;
    f.tier = tier;
    f.s.visible = true;
    f.s.position.copy(pos);
    f.s.material.color.set(tier < 0 || tier === 2 ? '#ffffff' : TIER_HEX[tier]);
  }

  burst(sys, pos, n, { speed = 3, tier = 0, life = [0.6, 1.4], size = [0.05, 0.14], drag = 1.6, grav = -0.6, white = 0.25, up = 0 } = {}) {
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const sp = speed * (0.35 + Math.random() * 0.65);
      if (tier === 2) c.setRGB(1, 1, 1);
      else c.set(TIER_HEX[tier]).lerp(new THREE.Color(1, 1, 1), Math.random() * white);
      sys.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: s * Math.cos(th) * sp, vy: u * sp + up, vz: s * Math.sin(th) * sp,
        life: life[0] + Math.random() * (life[1] - life[0]),
        size: size[0] + Math.random() * (size[1] - size[0]),
        r: c.r, g: c.g, b: c.b,
        drag, grav,
        hue: tier === 2 ? Math.random() : -1,
      });
    }
  }

  cardWorldPos(out = new THREE.Vector3()) {
    this.camera.updateMatrixWorld();
    return this.cardRoot.getWorldPosition(out);
  }

  crystalWorldPos(out = new THREE.Vector3()) {
    return this.crystal.getWorldPosition(out);
  }

  /* ---------------------------------------------------------------- summon */

  explode(tier) {
    const cp = this.crystalWorldPos();
    this.crystal.visible = false;
    this.satellites.forEach((s) => (s.m.visible = false));
    this.clock.tween(0.6, (k) => (this.ringsFade = 1 - k));
    this.pulse(1.6);
    this.shake(0.7);
    this.wave({ pos: cp, s0: 0.5, s1: 14, dur: 1.1, tier, thick: 0.05 });
    this.wave({ pos: new THREE.Vector3(0, 0.33, 0), flat: true, s0: 1, s1: 22, dur: 1.4, tier, thick: 0.04 });
    this.wave({ pos: new THREE.Vector3(0, 0.34, 0), flat: true, s0: 1, s1: 12, dur: 1.0, tier, thick: 0.08 });
    this.burst(this.particles, cp, 520, { speed: 9, tier, life: [0.8, 2.2], size: [0.06, 0.2], drag: 1.2, grav: -1.2, up: 1.5 });
    this.beam.visible = true;
    this.clock.tween(1.5, (k) => {
      const r = k < 0.12 ? lerp(0.05, 1.5, k / 0.12) : lerp(1.5, 0.0, Ease.inQuad((k - 0.12) / 0.88));
      this.beam.scale.set(Math.max(0.001, r), 1, Math.max(0.001, r));
      this.beamMat.uniforms.uOpacity.value = k < 0.1 ? k * 10 : 1 - Ease.inQuad((k - 0.1) / 0.9);
    }).then(() => (this.beam.visible = false));
  }

  altarWave(tier) {
    this.wave({ pos: new THREE.Vector3(0, 0.34, 0), flat: true, s0: 1, s1: 9, dur: 1.2, tier, thick: 0.07 });
  }

  promoBurst(tier) {
    const cp = this.crystalWorldPos();
    this.wave({ pos: cp, s0: 0.6, s1: tier === 2 ? 10 : 7, dur: 0.9, tier, thick: 0.06 });
    this.wave({ pos: new THREE.Vector3(0, 0.34, 0), flat: true, s0: 1, s1: 11, dur: 1.0, tier, thick: 0.06 });
    this.burst(this.particles, cp, tier === 2 ? 280 : 170, { speed: 6, tier, life: [0.6, 1.5], size: [0.05, 0.15], drag: 1.6, grav: -0.4 });
  }

  prepareShards(disp) {
    this.clearShards();
    disp.forEach((tier, i) => {
      const mk = (map, size, opacity) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity }));
        s.scale.setScalar(size);
        s.renderOrder = 11;
        s.visible = false;
        this.scene.add(s);
        return s;
      };
      this.shards.push({
        i, tier, mode: 'hidden', t: 0, dur: 1, delay: 0,
        star: mk(this.tex.star, 0.9, 1), halo: mk(this.tex.glow, 1.7, 0.55),
        pos: new THREE.Vector3(), from: new THREE.Vector3(), ctrl: new THREE.Vector3(), to: new THREE.Vector3(),
        phase: Math.random() * 6, hue: Math.random(), done: null,
      });
    });
  }

  clearShards() {
    for (const s of this.shards) {
      this.scene.remove(s.star, s.halo);
      s.star.material.dispose();
      s.halo.material.dispose();
      if (s.done) s.done();
    }
    this.shards = [];
  }

  slotPositions(n) {
    const cam = new THREE.PerspectiveCamera(this.camera.fov, this.camera.aspect, 0.1, 100);
    cam.position.set(...POSES.reveal.pos);
    cam.lookAt(...POSES.reveal.look);
    cam.updateMatrixWorld();
    const d = 7;
    const { hh, hw } = this.viewHalf(d);
    const spread = this.camera.aspect >= 1 ? 0.6 : 0.8;
    const out = [];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const x = u * hw * spread;
      const y = hh * (0.82 - 0.1 * u * u);
      out.push(cam.localToWorld(new THREE.Vector3(x, y, -d)));
    }
    return out;
  }

  launchShards(dur) {
    const cp = this.crystalWorldPos();
    const slots = this.slotPositions(this.shards.length);
    let longest = 0;
    this.shards.forEach((s, i) => {
      s.from.copy(cp);
      s.to.copy(slots[i]);
      s.ctrl.set((Math.random() - 0.5) * 6 + slots[i].x * 0.4, cp.y + 3 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
      s.pos.copy(cp);
      s.delay = i * 0.045;
      s.dur = dur * (0.8 + Math.random() * 0.2);
      s.t = -s.delay;
      s.mode = 'fly';
      s.star.visible = s.halo.visible = true;
      longest = Math.max(longest, s.delay + s.dur);
    });
    return this.clock.wait(longest);
  }

  shardToCard(i, dur) {
    const s = this.shards[i];
    if (!s) return Promise.resolve();
    const target = this.cardWorldPosAtCenter();
    s.from.copy(s.pos);
    s.to.copy(target);
    s.ctrl.copy(s.from).lerp(target, 0.5);
    s.ctrl.y += 0.8;
    s.t = 0;
    s.delay = 0;
    s.dur = dur;
    s.mode = 'toCard';
    return new Promise((res) => (s.done = res));
  }

  cardWorldPosAtCenter() {
    this.camera.updateMatrixWorld();
    return this.camera.localToWorld(new THREE.Vector3(0, 0, -CARD_DIST));
  }

  /* ---------------------------------------------------------------- card */

  faceTexture(canvas) {
    if (!this.faceTextures.has(canvas)) {
      const t = canvasTex(canvas, true);
      t.anisotropy = 8;
      this.faceTextures.set(canvas, t);
    }
    return this.faceTextures.get(canvas);
  }

  setCardTier(tier) {
    this.cardColor.value.set(tier === 2 ? '#ffffff' : TIER_HEX[tier]);
    this.cardRainbow.value = tier === 2 ? 1 : 0;
  }

  cardShow(canvas, tier) {
    this.faceMat.uniforms.uMap.value = this.faceTexture(canvas);
    this.faceMat.uniforms.uHolo.value = 0;
    this.faceMat.uniforms.uGlint.value = -2;
    this.setCardTier(tier);
    const root = this.cardRoot;
    root.visible = true;
    root.position.set(0, 0, -CARD_DIST);
    root.scale.setScalar(0.001);
    this.cardPivot.rotation.set(0, Math.PI, 0);
    this.cardTilt.rotation.set(0, 0, 0);
    this.card.interactive = false;
    this.card.spin = false;
    this.card.spinSpeed = 0;
    this.card.shake = 0;
    this.cardRaysMat.uniforms.uIntensity.value = 0;
    const wp = this.cardWorldPos();
    this.flashAt(wp, 5, 0.5, tier);
    this.burst(this.front, wp, 90, { speed: 2.6, tier, life: [0.4, 1.0], size: [0.03, 0.08], drag: 2.5, grav: 0 });
    this.clock.tween(0.3, (k) => (this.cardGlowMat.uniforms.uIntensity.value = k * 0.9));
    return this.clock.tween(0.42, (k) => root.scale.setScalar(Math.max(0.001, k)), Ease.outBack);
  }

  cardFlip(dur, halfTurns = 1, ease = Ease.inOutCubic) {
    const r0 = this.cardPivot.rotation.y;
    const r1 = r0 + halfTurns * Math.PI;
    return this.clock.tween(dur, (k) => (this.cardPivot.rotation.y = lerp(r0, r1, k)), ease);
  }

  cardSpin(on) {
    this.card.spin = on;
  }

  cardSpinToFace(dur) {
    this.card.spin = false;
    const r0 = this.cardPivot.rotation.y;
    const TAU = Math.PI * 2;
    const r1 = Math.ceil((r0 + Math.PI * 1.5) / TAU) * TAU;
    return this.clock.tween(dur, (k) => (this.cardPivot.rotation.y = lerp(r0, r1, k)), Ease.outCubic);
  }

  cardShake(dur, amp) {
    return this.clock.tween(dur, (k) => (this.card.shake = amp * (0.3 + 0.7 * k))).then(() => (this.card.shake = 0));
  }

  cardSlideToRest(dur) {
    const p0 = this.cardRoot.position.clone();
    const p1 = this.cardRestPos();
    return this.clock.tween(dur, (k) => this.cardRoot.position.lerpVectors(p0, p1, k), Ease.inOutCubic);
  }

  cardExitTo(local, dur) {
    const p0 = this.cardRoot.position.clone();
    const s0 = this.cardRoot.scale.x;
    this.card.interactive = false;
    return this.clock.tween(dur, (k) => {
      this.cardRoot.position.lerpVectors(p0, local, k);
      this.cardRoot.scale.setScalar(lerp(s0, 0.12, k));
      this.cardGlowMat.uniforms.uIntensity.value = 0.9 * (1 - k);
    }, Ease.inCubic).then(() => this.cardHide());
  }

  cardExitToScreen(px, py, dur) {
    return this.cardExitTo(this.screenToCardLocal(px, py), dur);
  }

  cardFadeOut(dur) {
    const s0 = this.cardRoot.scale.x;
    const y0 = this.cardRoot.position.y;
    this.card.interactive = false;
    return this.clock.tween(dur, (k) => {
      this.cardRoot.scale.setScalar(Math.max(0.001, s0 * (1 - k)));
      this.cardRoot.position.y = y0 + k * 0.6;
      this.cardGlowMat.uniforms.uIntensity.value = 0.9 * (1 - k);
    }, Ease.inCubic).then(() => this.cardHide());
  }

  cardHide() {
    this.cardRoot.visible = false;
    this.card.interactive = false;
    this.cardRaysMat.uniforms.uIntensity.value = 0;
  }

  setRays(v, dur = 0.4) {
    const u = this.cardRaysMat.uniforms.uIntensity;
    const v0 = u.value;
    return this.clock.tween(dur, (k) => (u.value = lerp(v0, v, k)));
  }

  setDim(v, dur = 0.3) {
    const v0 = this.dimMat.opacity;
    return this.clock.tween(dur, (k) => (this.dimMat.opacity = lerp(v0, v, k)));
  }

  setHolo(v, dur = 0.6) {
    const u = this.faceMat.uniforms.uHolo;
    const v0 = u.value;
    return this.clock.tween(dur, (k) => (u.value = lerp(v0, v, k)));
  }

  glint(dur = 0.9) {
    const u = this.faceMat.uniforms.uGlint;
    return this.clock.tween(dur, (k) => (u.value = lerp(-0.6, 1.9, k)), Ease.inOutQuad).then(() => (u.value = -2));
  }

  cardBurst(tier) {
    const wp = this.cardWorldPos();
    const n = [110, 220, 320][tier];
    this.burst(this.front, wp, n, { speed: [3.2, 4.5, 6.5][tier], tier, life: [0.6, [1.2, 1.6, 2.0][tier]], size: [0.03, [0.09, 0.11, 0.12][tier]], drag: 1.8, grav: tier ? -0.7 : 0 });
    this.flashAt(wp, [5, 8, 12][tier], [0.45, 0.6, 0.9][tier], tier);
    this.wave({ pos: wp, s0: 1.2, s1: [5, 8, 12][tier], dur: [0.6, 0.8, 1.1][tier], tier, thick: 0.05, front: true });
  }

  resetSequence() {
    this.crystal.visible = true;
    this.satellites.forEach((s) => (s.m.visible = true));
    this.crystalScale = 1;
    this.crystalLift = 0;
    this.ringsFade = 1;
    this.beam.visible = false;
    this.cardHide();
    this.clearShards();
    this.dimMat.opacity = 0;
    this.charge = 0;
    this.setTier(-1);
  }

  /* ---------------------------------------------------------------- update */

  update(dt) {
    this.time += dt;
    const t = this.time;
    const S = this.S;
    const k = 1 - Math.exp(-dt * 5);
    S.uTier.value.lerp(this.tierTarget, k);
    S.uRainbow.value += (this.rainbowTarget - S.uRainbow.value) * k;
    S.uTime.value = t;
    this.flare = Math.max(0, this.flare - dt * 1.7);
    S.uFlare.value = this.flare;
    const rb = S.uRainbow.value;
    this._hsl.setHSL((t * 0.18) % 1, 0.9, 0.65);
    this.tint.copy(S.uTier.value).lerp(this._hsl, rb);
    const ch = this.charge, fl = this.flare;

    // magic circles
    this.circles.forEach((c, i) => {
      c.rot += dt * c.speed * (1 + ch * 9 + fl * 3);
      c.mesh.rotation.z = c.rot;
      c.mat.uniforms.uIntensity.value = (0.78 + ch * 1.1 + fl * 1.0) * (i === 0 ? 1 : 0.95) + 0.08 * Math.sin(t * 2 + i);
    });
    this.haloCircle.rot -= dt * (0.3 + ch * 3);
    this.haloCircle.mesh.rotation.z = this.haloCircle.rot;
    this.haloCircle.mesh.position.y = 0.6 + ch * 0.6;
    this.haloCircle.mesh.material.uniforms.uIntensity.value = smoothstep(0.1, 0.7, ch) * 1.2 + fl * 0.6;
    this.wallMat.uniforms.uOpacity.value = smoothstep(0.1, 0.9, ch) * 0.95 + fl * 0.3;
    this.rimMat.color.copy(this.tint).multiplyScalar(0.6 + ch * 0.8 + fl);
    this.stripMat.uniforms.uIntensity.value = 0.45 + ch * 1.1 + fl;
    this.orbMats[0].color.copy(this.tint);
    this.pillarOrbs.forEach((p) => {
      const s = 1.2 + 0.25 * Math.sin(t * 2 + p.phase) + ch * 0.8 + fl * 0.8;
      p.orb.scale.setScalar(s);
      p.core.rotation.y += dt * 1.5;
    });
    this.groundMat.uniforms.uGlow.value = 0.2 + ch * 0.9 + fl * 0.8;
    this.pLight.color.copy(this.tint);
    this.pLight.intensity = 26 + ch * 110 + fl * 160;

    // crystal
    const c = this.crystal;
    c.position.y = CRYSTAL_Y + Math.sin(t * 1.4) * 0.06 + this.crystalLift + ch * 0.2;
    this.crystalMesh.rotation.y += dt * (0.5 + ch * 9);
    this.crystalMesh.scale.setScalar(this.crystalScale * (1 + fl * 0.2));
    this.crystalMat.uniforms.uGlow.value = ch * 1.1 + fl;
    this.crystalHalo.material.color.copy(this.tint);
    this.crystalHalo.scale.setScalar((3.6 + ch * 2.6 + fl * 3) * (0.6 + 0.4 * this.crystalScale));
    this.crystalHalo.material.opacity = 0.45 + ch * 0.35;
    this.crystalCore.scale.setScalar(1.1 + ch * 1.3 + fl * 1.5);
    this.crystalFlare.material.color.copy(this.tint).lerp(new THREE.Color(1, 1, 1), 0.4);
    this.crystalFlare.material.rotation += dt * (0.2 + ch * 1.5);
    this.crystalFlare.scale.setScalar(2.2 + ch * 3.2 + fl * 4);
    this.crystalRays.position.y = c.position.y;
    this.crystalRays.quaternion.copy(this.camera.quaternion);
    this.crystalRays.material.uniforms.uIntensity.value = c.visible ? 0.12 + ch * 0.75 + fl * 0.6 : fl * 0.5;
    this.satellites.forEach((s, i) => {
      const a = s.phase + t * (0.8 + ch * 5) * (i % 2 ? -1 : 1);
      s.m.position.set(Math.cos(a) * s.r, c.position.y + Math.sin(a * 1.3 + s.tilt) * 0.35, Math.sin(a) * s.r);
      s.m.rotation.y += dt * 2;
    });
    this.rings.forEach((r) => {
      r.ring.rotation.z += dt * r.speed * (1 + ch * 7);
      r.holder.rotation.y += dt * r.prec * (1 + ch * 4);
      r.holder.position.y = c.position.y;
      r.holder.scale.setScalar(1 + ch * 0.22 + fl * 0.25 + (1 - this.ringsFade) * 1.5);
      r.mat.color.copy(this.tint);
      r.mat.opacity = (0.32 + ch * 0.55) * this.ringsFade;
    });

    // particles: ambient motes and inward spiral while charging
    this.ambientAcc += dt * 22;
    while (this.ambientAcc > 1) {
      this.ambientAcc -= 1;
      const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 6.5;
      const col = this.tint.clone().lerp(new THREE.Color(1, 1, 1), Math.random() * 0.5);
      this.particles.spawn({
        x: Math.cos(a) * r, y: 0.2 + Math.random() * 1.2, z: Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 0.1, vy: 0.2 + Math.random() * 0.35, vz: (Math.random() - 0.5) * 0.1,
        life: 3 + Math.random() * 4, size: 0.04 + Math.random() * 0.07, r: col.r, g: col.g, b: col.b,
        hue: rb > 0.5 ? Math.random() : -1,
      });
    }
    if (ch > 0.05 && c.visible) {
      this.spiralAcc += dt * ch * 320;
      const cp = c.position;
      while (this.spiralAcc > 1) {
        this.spiralAcc -= 1;
        const a = Math.random() * Math.PI * 2, r = 2.8 + Math.random() * 2.8;
        const col = this.tint.clone().lerp(new THREE.Color(1, 1, 1), Math.random() * 0.6);
        this.particles.spawn({
          x: Math.cos(a) * r, y: 0.3 + Math.random() * 3.2, z: Math.sin(a) * r,
          vx: -Math.sin(a) * 2.2, vy: 0, vz: Math.cos(a) * 2.2,
          life: 1.6 + Math.random() * 0.8, size: 0.05 + Math.random() * 0.1, r: col.r, g: col.g, b: col.b,
          attract: 7 + ch * 7, swirl: 2.2, tx: cp.x, ty: cp.y, tz: cp.z, kill: 0.3, drag: 1.1,
          hue: rb > 0.5 ? Math.random() : -1,
        });
      }
    }

    this.updateShards(dt, t);

    for (const w of this.waves) {
      if (!w.active) continue;
      w.t += dt;
      const q = Math.min(1, w.t / w.dur);
      const s = lerp(w.s0, w.s1, Ease.outCubic(q));
      w.mesh.scale.set(s, s, s);
      if (!w.flat) w.mesh.quaternion.copy(this.camera.quaternion);
      w.mat.uniforms.uOpacity.value = Math.pow(1 - q, 1.5);
      w.mat.uniforms.uThick.value = w.thick * (1 - q * 0.5);
      if (q >= 1) {
        w.active = false;
        w.mesh.visible = false;
      }
    }
    for (const f of this.flashes) {
      if (!f.active) continue;
      f.t += dt;
      const q = Math.min(1, f.t / f.dur);
      f.s.scale.setScalar(f.size * (0.6 + 0.6 * Ease.outCubic(q)));
      f.s.material.opacity = Math.pow(1 - q, 2);
      if (f.tier === 2) f.s.material.color.copy(this._hsl).lerp(new THREE.Color(1, 1, 1), 0.5);
      if (q >= 1) {
        f.active = false;
        f.s.visible = false;
      }
    }

    // card motion
    if (this.cardRoot.visible) {
      if (this.card.spin) {
        this.card.spinSpeed = Math.min(22, this.card.spinSpeed + dt * 18);
        this.cardPivot.rotation.y += this.card.spinSpeed * dt;
      }
      const tgt = this.card.tilt;
      if (this.card.interactive) tgt.set(this.pointerS.x * 0.32, this.pointerS.y * 0.22);
      else tgt.multiplyScalar(Math.exp(-dt * 4));
      const sh = this.card.shake;
      this.cardTilt.rotation.set(-tgt.y + (Math.random() - 0.5) * sh * 0.5, tgt.x + (Math.random() - 0.5) * sh * 0.3, (Math.random() - 0.5) * sh * 0.6);
      this.cardTilt.position.set((Math.random() - 0.5) * sh, Math.sin(t * 1.3) * 0.03 + (Math.random() - 0.5) * sh, 0);
      this.faceMat.uniforms.uTilt.value.copy(tgt);
      if (this.cardRainbow.value > 0.5 && Math.random() < dt * 30) {
        const wp = this.cardWorldPos(_v);
        const { hh } = this.viewHalf();
        this.front.spawn({
          x: wp.x + (Math.random() - 0.5) * 2.2, y: wp.y - hh * 0.2 + (Math.random() - 0.5) * 3, z: wp.z + (Math.random() - 0.5) * 0.5,
          vx: 0, vy: 0.4 + Math.random() * 0.6, vz: 0, life: 1.4 + Math.random(), size: 0.03 + Math.random() * 0.05, hue: Math.random(),
        });
      }
    }

    this.particles.update(dt, t);
    this.front.update(dt, t);

    // camera
    this.pointerS.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 1.6);
    const sa = this.shakeAmp * this.shakeAmp;
    const sx = (Math.random() - 0.5) * sa * 0.5, sy = (Math.random() - 0.5) * sa * 0.5;
    const par = this.card.interactive ? 0.25 : 1;
    this.camera.position.set(
      this.cam.pos.x + this.pointerS.x * 0.35 * par + sx + Math.sin(t * 0.3) * 0.08,
      this.cam.pos.y + this.pointerS.y * 0.18 * par + sy + Math.sin(t * 0.4) * 0.04,
      this.cam.pos.z,
    );
    this.camera.lookAt(this.cam.look.x + sx * 0.4, this.cam.look.y + sy * 0.4, this.cam.look.z);
    this.renderer.render(this.scene, this.camera);
  }

  updateShards(dt, t) {
    for (const s of this.shards) {
      if (s.mode === 'hidden') continue;
      const col = s.tier === 2 ? this._hsl.clone().setHSL((s.hue + t * 0.35) % 1, 1, 0.7) : this.colorOf(s.tier);
      s.star.material.color.copy(col).lerp(new THREE.Color(1, 1, 1), s.tier === 1 ? 0.12 : 0.3);
      s.halo.material.color.copy(col);
      if (s.mode === 'fly' || s.mode === 'toCard') {
        s.t += dt;
        const q = clamp(s.t / s.dur);
        if (s.t < 0) continue;
        const e = s.mode === 'fly' ? Ease.inOutCubic(q) : Ease.inCubic(q);
        const m = 1 - e;
        _v.copy(s.from).multiplyScalar(m * m).addScaledVector(s.ctrl, 2 * m * e).addScaledVector(s.to, e * e);
        _v2.copy(_v).sub(s.pos);
        s.pos.copy(_v);
        const steps = Math.min(6, Math.ceil(_v2.length() / 0.08));
        for (let j = 0; j < steps; j++) {
          const f = j / steps;
          this.particles.spawn({
            x: s.pos.x - _v2.x * f + (Math.random() - 0.5) * 0.05, y: s.pos.y - _v2.y * f + (Math.random() - 0.5) * 0.05, z: s.pos.z - _v2.z * f,
            life: 0.35 + Math.random() * 0.35, size: 0.08 + Math.random() * 0.08, r: col.r, g: col.g, b: col.b, drag: 2,
            hue: s.tier === 2 ? Math.random() : -1,
          });
        }
        const sc = s.mode === 'toCard' ? 1 + e * 1.6 : 1;
        s.star.scale.setScalar(0.9 * sc);
        s.halo.scale.setScalar(1.7 * sc);
        if (q >= 1) {
          if (s.mode === 'fly') s.mode = 'slot';
          else {
            s.mode = 'hidden';
            s.star.visible = s.halo.visible = false;
            if (s.done) s.done();
          }
        }
        s.star.position.copy(s.pos);
        s.halo.position.copy(s.pos);
      } else if (s.mode === 'slot') {
        const bob = Math.sin(t * 1.6 + s.phase) * 0.06;
        s.star.position.set(s.to.x, s.to.y + bob, s.to.z);
        s.halo.position.copy(s.star.position);
        s.pos.copy(s.star.position);
        const tw = 0.85 + 0.15 * Math.sin(t * 5 + s.phase * 3);
        s.star.scale.setScalar(0.85 * tw * (s.tier === 2 ? 1.2 : 1));
        s.star.material.rotation = Math.sin(t * 0.7 + s.phase) * 0.3;
        s.halo.scale.setScalar(1.6 * tw * (s.tier ? 1.15 : 1));
        if (Math.random() < dt * (2 + s.tier * 3)) {
          this.particles.spawn({
            x: s.pos.x, y: s.pos.y, z: s.pos.z, vx: (Math.random() - 0.5) * 0.4, vy: -0.3 - Math.random() * 0.4, vz: 0,
            life: 0.8, size: 0.05, r: col.r, g: col.g, b: col.b, hue: s.tier === 2 ? Math.random() : -1,
          });
        }
      }
    }
  }
}

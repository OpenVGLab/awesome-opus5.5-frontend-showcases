// Watercolour + ink composite: reads pigment, normals/ids and depth from one MRT pass.
import * as THREE from 'three';
import { shared } from './materials.js';

const VS = /* glsl */`
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FS = /* glsl */`
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform sampler2D tNoise;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uTime;
uniform float uPx;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec3 uSunDir;
in vec2 vUv;
layout(location = 0) out vec4 fragColor;

float linDepth(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
vec3 viewDirWorld(vec2 uv) {
  vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 v = normalize(p.xyz / p.w);
  return normalize(mat3(uCamWorld) * v);
}
vec3 skyCol(vec3 d) {
  float h = d.y;
  vec3 horizon = vec3(0.985, 0.925, 0.80);
  vec3 mid = vec3(0.80, 0.86, 0.88);
  vec3 zenith = vec3(0.45, 0.63, 0.83);
  vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h));
  c = mix(c, zenith, smoothstep(0.18, 0.8, h));
  c = mix(vec3(0.84, 0.85, 0.77), c, smoothstep(-0.2, 0.0, h));
  float sd = max(dot(d, uSunDir), 0.0);
  c = mix(c, vec3(1.0, 0.96, 0.84), pow(sd, 14.0) * 0.55);
  if (h > -0.02) {
    vec2 cp = d.xz / (h + 0.12);
    float n1 = texture(tNoise, cp * 0.085 + vec2(uTime * 0.0015, 0.0)).r;
    float n2 = texture(tNoise, cp * 0.29 + 0.5).a;
    float cl = n1 * 0.72 + n2 * 0.28;
    float cov = smoothstep(0.5, 0.63, cl) * smoothstep(-0.02, 0.14, h);
    vec3 cc = mix(vec3(1.0, 0.99, 0.96), vec3(0.75, 0.75, 0.87), smoothstep(0.64, 0.82, cl) * 0.85);
    c = mix(c, cc, cov * 0.9);
  }
  return c;
}
vec3 sceneAt(vec2 uv, vec3 sky) {
  vec4 c = texture(tColor, uv);
  return c.a < 0.2 ? sky : c.rgb;
}
void main() {
  vec2 px = 1.0 / uRes;
  vec2 fc = gl_FragCoord.xy;
  vec2 suv = fc / (380.0 * uPx);
  vec4 nA = texture(tNoise, suv * 0.45 + vec2(0.13, 0.71));
  vec4 nB = texture(tNoise, suv * 2.1 + vec2(0.57, 0.29));
  vec2 wob = (vec2(nA.g, nA.b) - 0.5) * px * 6.0 * uPx;
  vec2 cuv = vUv + wob;
  vec3 sky = skyCol(viewDirWorld(vUv));
  vec4 c0 = texture(tColor, cuv);
  bool isSky = c0.a < 0.2;
  vec3 col = isSky ? sky : c0.rgb;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472 + nA.r * 4.0;
    vec2 o = vec2(cos(a), sin(a)) * px * (2.0 + 3.0 * nB.g) * uPx;
    acc += sceneAt(cuv + o, sky);
  }
  vec3 avg = acc / 6.0;
  float edge = length(col - avg);
  col = mix(col, avg, 0.3);
  float z = linDepth(texture(tDepth, cuv).r);
  if (!isSky) col = mix(col, sky, (1.0 - exp(-z / 2600.0)) * 0.85);
  // pigment density: turbulence, edge darkening, granulation
  float turb = texture(tNoise, suv * 0.21 + 0.37).r;
  float turb2 = texture(tNoise, suv * 0.6 + 0.11).a;
  float gran = texture(tNoise, suv * 3.3).g;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float dens = 1.0 + (turb - 0.5) * 0.42 + (turb2 - 0.5) * 0.2 + edge * 1.4 + (gran - 0.5) * 0.4 * (1.0 - lum);
  col = clamp(col - (col - col * col) * (dens - 1.0), 0.0, 1.0);
  // ink
  vec2 iuv = vUv + (vec2(nB.r, nB.b) - 0.5) * px * 2.4 * uPx;
  float zc = linDepth(texture(tDepth, iuv).r);
  vec4 nc = texture(tNormal, iuv);
  vec3 ncv = nc.xyz * 2.0 - 1.0;
  float r1 = 1.0 * uPx;
  float r2 = 2.0 * uPx;
  vec2 o1[4] = vec2[4](vec2(r1, 0.0), vec2(-r1, 0.0), vec2(0.0, r1), vec2(0.0, -r1));
  float nEdge = 0.0;
  float idEdge = 0.0;
  float zs[4];
  for (int i = 0; i < 4; i++) {
    vec2 uv2 = iuv + o1[i] * px;
    zs[i] = linDepth(texture(tDepth, uv2).r);
    vec4 nn = texture(tNormal, uv2);
    nEdge = max(nEdge, 1.0 - dot(ncv, nn.xyz * 2.0 - 1.0));
    idEdge = max(idEdge, step(0.6 / 255.0, abs(nn.a - nc.a)));
  }
  float lap1 = abs(zs[0] + zs[1] - 2.0 * zc) + abs(zs[2] + zs[3] - 2.0 * zc);
  float zR = linDepth(texture(tDepth, iuv + vec2(r2, 0.0) * px).r);
  float zL = linDepth(texture(tDepth, iuv - vec2(r2, 0.0) * px).r);
  float zU = linDepth(texture(tDepth, iuv + vec2(0.0, r2) * px).r);
  float zD = linDepth(texture(tDepth, iuv - vec2(0.0, r2) * px).r);
  float lap2 = abs(zR + zL - 2.0 * zc) + abs(zU + zD - 2.0 * zc);
  float zmin = min(min(min(zR, zL), min(zU, zD)), min(zc, min(min(zs[0], zs[1]), min(zs[2], zs[3]))));
  float sil = smoothstep(0.06, 0.2, lap2 / zmin);
  float crease = smoothstep(0.22, 0.55, nEdge) * step(zc, uFar * 0.98);
  float thin = smoothstep(0.04, 0.12, lap1 / zmin);
  float line = max(sil, max(crease * 0.9, max(thin, idEdge * 0.8)));
  line *= 0.62 + 0.38 * smoothstep(0.2, 0.62, nB.a);
  line *= mix(1.0, 0.3, smoothstep(180.0, 2400.0, zmin));
  col = mix(col, vec3(0.13, 0.11, 0.17), clamp(line, 0.0, 1.0) * 0.88);
  // paper
  float g1 = texture(tNoise, fc / (256.0 * uPx)).g;
  float g2 = texture(tNoise, fc / (83.0 * uPx) + 0.3).g;
  float fib = texture(tNoise, vec2(fc.x / (700.0 * uPx), fc.y / (41.0 * uPx))).b;
  float paperV = (g1 * 0.5 + g2 * 0.5 - 0.5) * 0.08 + (fib - 0.5) * 0.05;
  col *= vec3(0.978, 0.960, 0.915) + paperV;
  vec2 q = vUv * (1.0 - vUv);
  col *= mix(0.83, 1.0, pow(clamp(16.0 * q.x * q.y, 0.0, 1.0), 0.16));
  fragColor = vec4(col, 1.0);
}
`;

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(1, 1, {
      count: 2, type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true,
    });
    this.rt.textures[1].minFilter = THREE.NearestFilter;
    this.rt.textures[1].magFilter = THREE.NearestFilter;
    this.rt.depthTexture = new THREE.DepthTexture(1, 1);
    this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.uniforms = {
      tColor: { value: this.rt.textures[0] },
      tNormal: { value: this.rt.textures[1] },
      tDepth: { value: this.rt.depthTexture },
      tNoise: shared.uNoise,
      uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.3 },
      uFar: { value: 9000 },
      uTime: shared.uTime,
      uPx: { value: 1 },
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uSunDir: shared.uSunDir,
    };
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(w, h, dpr) {
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    this.rt.setSize(W, H);
    this.uniforms.uRes.value.set(W, H);
    this.uniforms.uPx.value = dpr;
  }

  render(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    this.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    this.uniforms.uCamWorld.value.copy(camera.matrixWorld);
    this.uniforms.uNear.value = camera.near;
    this.uniforms.uFar.value = camera.far;
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }
}

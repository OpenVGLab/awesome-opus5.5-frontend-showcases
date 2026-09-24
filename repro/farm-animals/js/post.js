import * as THREE from 'three';
import { pnoise2 } from './util.js';

/*
 * Tileable paper texture, generated once:
 *   r – fine paper tooth / pigment granulation
 *   g – soft blotches (uneven washes)
 *   b, a – smooth noise used to wobble the picture like a hand-laid wash
 */
function makePaperTexture(size = 512) {
  const data = new Uint8Array(size * size * 4);
  const fbm = (u, v, base, oct, seed) => {
    let s = 0, a = 0.5, n = 0, f = base;
    for (let o = 0; o < oct; o++) {
      s += a * pnoise2(u * f, v * f, f, f, seed + o * 13);
      n += a; a *= 0.5; f *= 2;
    }
    return s / n;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const grain = fbm(u, v, 64, 3, 1) * 0.7 + pnoise2(u * 256, v * 256, 256, 256, 7) * 0.3;
      const fiber = pnoise2(u * 12, v * 128, 12, 128, 9);
      const blot = fbm(u, v, 4, 4, 21);
      const wx = fbm(u, v, 8, 3, 41);
      const wy = fbm(u, v, 8, 3, 61);
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, (grain * 0.85 + fiber * 0.15) * 255));
      data[i + 1] = blot * 255;
      data[i + 2] = wx * 255;
      data[i + 3] = wy * 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tPaper;
uniform vec2 resolution;
uniform float pixelScale;
uniform float cameraNear;
uniform float cameraFar;
uniform vec3 paperColor;
uniform vec3 inkColor;
uniform vec2 vigCenter;
uniform vec2 vigRadius;
uniform float vigPower;
uniform float vigSoft;
uniform float lineStrength;
uniform float fadeToPaper;
varying vec2 vUv;

float invDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  return (cameraFar - z * (cameraFar - cameraNear)) / (cameraNear * cameraFar);
}
vec3 toSRGB(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 col(vec2 uv) { return toSRGB(texture2D(tColor, uv).rgb); }

void main() {
  vec2 px = 1.0 / resolution;
  vec2 ps = px * pixelScale;
  vec2 fc = vUv * resolution / pixelScale;
  vec4 P = texture2D(tPaper, fc / 512.0);
  vec4 P2 = texture2D(tPaper, fc / 2400.0 + vec2(0.37, 0.71));
  vec4 P3 = texture2D(tPaper, fc / 150.0 + vec2(0.13, 0.29));

  // hand-laid wobble; the pen line is laid a little apart from the wash
  vec2 wob = (vec2(P.b, P.a) - 0.5) * 3.8 * ps;
  vec2 uv = vUv + wob;
  vec2 uvInk = vUv + wob * 0.35;

  // --- the wash: an edge-preserving smear turns texture into flat, even washes
  vec3 c0 = col(uv);
  vec3 acc = c0;
  float wsum = 1.0;
  float cEdge = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398 + 0.3;
    vec3 ci = col(uv + vec2(cos(a), sin(a)) * ps * 2.4);
    vec3 d = ci - c0;
    float w = exp(-dot(d, d) * 70.0);
    acc += ci * w;
    wsum += w;
    cEdge += length(d);
  }
  vec3 c = acc / wsum;
  cEdge /= 8.0;

  // --- ink: silhouettes and creases from inverse depth (planes have zero laplacian in 1/z)
  float iz = invDepth(uvInk);
  vec2 ox = vec2(ps.x, 0.0), oy = vec2(0.0, ps.y);
  float lap1 = (invDepth(uvInk - ox) + invDepth(uvInk + ox) + invDepth(uvInk - oy) + invDepth(uvInk + oy) - 4.0 * iz) / max(iz, 1e-6);
  float lap2 = (invDepth(uvInk - ox * 2.2) + invDepth(uvInk + ox * 2.2) + invDepth(uvInk - oy * 2.2) + invDepth(uvInk + oy * 2.2) - 4.0 * iz) / max(iz, 1e-6);
  float dist = 1.0 / max(iz, 1e-6);
  float sil = max(smoothstep(0.04, 0.22, -lap1), smoothstep(0.08, 0.4, -lap2) * 0.85);
  float crease = smoothstep(0.012, 0.06, max(abs(lap1), abs(lap2) * 0.45)) * 0.45;
  float near = 1.0 - smoothstep(22.0, 140.0, dist);
  float ink = max(sil, crease) * mix(0.18, 1.0, near);
  ink = max(ink, smoothstep(0.32, 0.62, cEdge) * 0.3 * near * sil);
  ink *= mix(0.35, 1.0, smoothstep(0.2, 0.72, P3.g));   // a broken, sketchy pen line

  float sky = smoothstep(600.0, 1200.0, dist);
  vec3 raw = c;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(lum), c, 0.9);                                     // softer than life
  c *= vec3(1.015, 1.0, 0.965);                                   // warm, like old paper
  float lq = (floor(lum * 5.0 + P.g * 0.9 + 0.2) + 0.5) / 5.0;
  c *= mix(1.0, clamp(lq / max(lum, 0.04), 0.7, 1.4), 0.08);      // layered washes
  c = mix(c, paperColor * 0.95, 0.17 * (1.0 - lum));              // airy, lifted darks
  c *= mix(0.93, 1.05, P.g);                                      // uneven wash
  c *= 1.0 - smoothstep(0.03, 0.26, cEdge) * mix(0.1, 0.26, max(sil, crease));   // pigment pools at the edges
  c *= 1.0 - (1.0 - lum) * (P.r - 0.45) * 0.42;                   // granulation in the darks
  c = mix(c, c * vec3(0.87, 0.91, 1.08), smoothstep(0.45, 0.1, lum) * 0.45);   // cool violet shadows
  c = mix(c, paperColor, smoothstep(0.78, 1.0, lum) * 0.55);      // paper glows through highlights
  c = mix(c, raw * mix(0.97, 1.03, P.g), sky * 0.75);             // keep the sky a clean wash
  c *= 0.96 + 0.06 * P.r;                                         // paper tooth everywhere

  c = mix(c, inkColor, clamp(ink * lineStrength, 0.0, 0.86));

  // --- vignette: the illustration fades into the page with a ragged, pooled edge
  vec2 dv = (vUv - vigCenter) / vigRadius;
  float dd = pow(pow(abs(dv.x), vigPower) + pow(abs(dv.y), vigPower), 1.0 / vigPower);
  dd += (P2.g - 0.5) * 0.3 + (P.g - 0.5) * 0.06;
  float m = smoothstep(1.0 - vigSoft, 1.0, dd);
  float rim = smoothstep(1.0 - vigSoft * 1.1, 1.0 - vigSoft * 0.35, dd) * (1.0 - m);
  c *= 1.0 - rim * 0.1;
  vec3 paper = paperColor * (0.968 + 0.045 * P.r + 0.03 * (P2.g - 0.5));
  c = mix(c, paper, max(m, fadeToPaper));

  gl_FragColor = vec4(c, 1.0);
}
`;

export class Watercolor {
  constructor(renderer) {
    this.renderer = renderer;
    this.samples = 4;
    this.sceneRT = this._makeSceneRT(2, 2, this.samples);
    this.paper = makePaperTexture(512);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        tPaper: { value: this.paper },
        resolution: { value: new THREE.Vector2(2, 2) },
        pixelScale: { value: 1 },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 1000 },
        paperColor: { value: new THREE.Vector3(0.957, 0.925, 0.859) },
        inkColor: { value: new THREE.Vector3(0.31, 0.235, 0.165) },
        vigCenter: { value: new THREE.Vector2(0.5, 0.5) },
        vigRadius: { value: new THREE.Vector2(0.62, 0.64) },
        vigPower: { value: 5 },
        vigSoft: { value: 0.16 },
        lineStrength: { value: 0.92 },
        fadeToPaper: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene();
    this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  _makeSceneRT(w, h, samples) {
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    return new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples,
      depthTexture: depth,
      depthBuffer: true,
    });
  }

  setSize(w, h, pr) {
    const W = Math.max(2, Math.round(w * pr)), H = Math.max(2, Math.round(h * pr));
    this.sceneRT.setSize(W, H);
    this.material.uniforms.resolution.value.set(W, H);
    this.material.uniforms.pixelScale.value = Math.max(0.75, H / 760);
  }

  render(scene, camera, opts = {}) {
    const r = this.renderer;
    const rt = opts.sceneRT || this.sceneRT;
    const u = this.material.uniforms;
    r.setRenderTarget(rt);
    r.clear();
    r.render(scene, camera);
    u.tColor.value = rt.texture;
    u.tDepth.value = rt.depthTexture;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    let saved = null;
    if (opts.uniforms) {
      saved = {};
      for (const k in opts.uniforms) {
        const cur = u[k].value;
        saved[k] = cur && cur.clone ? cur.clone() : cur;
        const nv = opts.uniforms[k];
        if (cur && cur.copy) cur.copy(nv); else u[k].value = nv;
      }
    }
    r.setRenderTarget(opts.target || null);
    r.render(this.qScene, this.qCam);
    if (saved) {
      for (const k in saved) {
        const cur = u[k].value;
        if (cur && cur.copy) cur.copy(saved[k]); else u[k].value = saved[k];
      }
    }
  }

  /* Render a small scene into a round, vignetted watercolour portrait; resolves to a data URL */
  async portrait(scene, camera, size) {
    const r = this.renderer;
    const sceneRT = this._makeSceneRT(size, size, this.samples);
    const outRT = new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType });
    const u = this.material.uniforms;
    const savedRes = u.resolution.value.clone();
    const savedScale = u.pixelScale.value;
    u.resolution.value.set(size, size);
    u.pixelScale.value = 0.8;
    this.render(scene, camera, {
      sceneRT,
      target: outRT,
      uniforms: {
        vigCenter: new THREE.Vector2(0.5, 0.5),
        vigRadius: new THREE.Vector2(0.47, 0.47),
        vigPower: 2,
        vigSoft: 0.3,
        lineStrength: 0.9,
        fadeToPaper: 0,
      },
    });
    r.setRenderTarget(null);
    u.resolution.value.copy(savedRes);
    u.pixelScale.value = savedScale;
    const buf = new Uint8Array(size * size * 4);
    await r.readRenderTargetPixelsAsync(outRT, 0, 0, size, size, buf);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * size * 4;
      img.data.set(buf.subarray(src, src + size * 4), y * size * 4);
    }
    ctx.putImageData(img, 0, 0);
    sceneRT.dispose();
    outRT.dispose();
    return cv.toDataURL('image/png');
  }
}

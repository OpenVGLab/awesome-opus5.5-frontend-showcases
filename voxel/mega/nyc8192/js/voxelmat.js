// Materials for instanced voxel quads (GLSL3) + sky.
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(-0.42, 0.74, 0.52).normalize();

const COMMON = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uCamPos;
vec3 skyTint(vec3 d) {
  float h = clamp(d.y, -0.2, 1.0);
  vec3 top = vec3(0.30, 0.52, 0.86), hor = vec3(0.80, 0.86, 0.92);
  vec3 c = mix(hor, top, pow(max(h, 0.0), 0.55));
  float s = max(dot(d, uSunDir), 0.0);
  c += vec3(1.0, 0.86, 0.62) * (pow(s, 8.0) * 0.18 + pow(s, 200.0) * 1.2);
  return c;
}
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 fromSRGB(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
`;

const VS = /* glsl */`
in vec2 corner;
in vec4 qa;   // x, y, z, dir | flags<<3
in vec4 qb;   // su, sv, mat / patLo, patHi
uniform float uCell;
out vec3 vWorld;
out float vLocalY;
out vec2 vFace;
flat out int vDir;
flat out int vMat;
flat out int vPat;
flat out float vH;
void main() {
  int dirf = int(qa.w + 0.5);
  int dir = dirf & 7;
  float x = qa.x, y = qa.y, z = qa.z, su = qb.x, sv = qb.y;
  vec3 p; float ly = 0.0; vec2 f;
  if (dir == 0) { p = vec3(x + 1.0, y + corner.x * sv, z + corner.y * su); ly = corner.x * sv; f = vec2(corner.y * su, ly); }
  else if (dir == 1) { p = vec3(x, y + corner.y * sv, z + corner.x * su); ly = corner.y * sv; f = vec2(corner.x * su, ly); }
  else if (dir == 2) { p = vec3(x + corner.y * su, y, z + corner.x * sv); f = vec2(corner.y * su, corner.x * sv); }
  else if (dir == 3) { p = vec3(x + corner.x * su, y, z + corner.y * sv); f = vec2(corner.x * su, corner.y * sv); }
  else if (dir == 4) { p = vec3(x + corner.x * su, y + corner.y * sv, z + 1.0); ly = corner.y * sv; f = vec2(corner.x * su, ly); }
  else { p = vec3(x + corner.y * su, y + corner.x * sv, z); ly = corner.x * sv; f = vec2(corner.y * su, ly); }
  vLocalY = ly;
  vFace = f;
  vDir = dir;
  vH = sv;
  int patHi = int(qb.w + 0.5);
  if (patHi == 0) { vMat = int(qb.z + 0.5); vPat = -1; }
  else { vMat = 0; vPat = (patHi - 1) * 65536 + int(qb.z + 0.5); }
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FS = /* glsl */`
precision highp float;
precision highp int;
${COMMON}
uniform sampler2D uPalette;   // 256 x 1, rgb = linear colour, a = flags / 255
uniform sampler2D uPattern;   // 2048 x h, r = material / 255
uniform float uCell;
uniform float uTime;
in vec3 vWorld;
in float vLocalY;
in vec2 vFace;
flat in int vDir;
flat in int vMat;
flat in int vPat;
flat in float vH;
out vec4 outColor;
void main() {
  int m = vMat;
  if (vPat >= 0) {
    int idx = vPat + int(floor(min(vLocalY, vH - 0.001)));
    m = int(texelFetch(uPattern, ivec2(idx & 2047, idx >> 11), 0).r * 255.0 + 0.5);
  }
  vec4 pc = texelFetch(uPalette, ivec2(m, 0), 0);
  pc.rgb = fromSRGB(pc.rgb);
  int flags = int(pc.a * 255.0 + 0.5);
  bool transparent = (flags & 1) != 0, glassy = (flags & 2) != 0, emissive = (flags & 4) != 0, veg = (flags & 32) != 0, water = (flags & 128) != 0;
  vec3 n = vDir == 0 ? vec3(1,0,0) : vDir == 1 ? vec3(-1,0,0) : vDir == 2 ? vec3(0,1,0) : vDir == 3 ? vec3(0,-1,0) : vDir == 4 ? vec3(0,0,1) : vec3(0,0,-1);
  vec3 toCam = uCamPos - vWorld;
  float dist = length(toCam);
  vec3 v = toCam / dist;
  // voxel cell (x/z in cells of uCell metres, y in metres)
  vec3 q = vec3(vWorld.x / uCell, vWorld.y, vWorld.z / uCell);
  vec3 cell = floor(q - n * 0.5);
  vec2 fq = vDir == 0 || vDir == 1 ? vec2(q.z, q.y) : vDir == 4 || vDir == 5 ? vec2(q.x, q.y) : vec2(q.x, q.z);
  vec2 fw = fwidth(fq);
  float detail = 1.0 - smoothstep(0.08, 0.35, max(fw.x, fw.y));
  vec2 e = min(fract(fq), 1.0 - fract(fq));
  vec2 lw = fw * 1.2 + 1e-4;
  float edge = 1.0 - min(smoothstep(0.0, lw.x, e.x), smoothstep(0.0, lw.y, e.y));
  float jit = hash13(cell) - 0.5;
  vec3 albedo = pc.rgb * (1.0 + jit * (veg ? 0.22 : 0.08) * mix(0.4, 1.0, detail));
  albedo *= 1.0 - edge * 0.13 * detail;
  // lighting
  float sun = max(dot(n, uSunDir), 0.0);
  float sky = 0.55 + 0.45 * n.y;
  float side = vDir == 0 || vDir == 1 ? 0.92 : vDir == 4 || vDir == 5 ? 0.84 : 1.0;
  // street-level ambient occlusion on walls: darker toward the local base of the face
  float ao = 1.0;
  if (vDir != 2 && vDir != 3) ao = mix(0.62, 1.0, smoothstep(0.0, 9.0, vLocalY + 0.6));
  vec3 light = vec3(1.0, 0.95, 0.86) * sun * 0.78 + vec3(0.62, 0.72, 0.88) * sky * 0.46 * ao * side + vec3(0.18, 0.16, 0.14) * (1.0 - n.y) * 0.25;
  vec3 col = albedo * light;
  float alpha = 1.0;
  if (glassy) {
    float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 r = reflect(-v, n);
    vec3 refl = skyTint(r) * 0.55;
    float lit = step(0.93, hash13(cell + 7.0));
    col = mix(col, refl, 0.18 + fr * 0.55) + albedo * lit * 0.35;
    float spec = pow(max(dot(r, uSunDir), 0.0), 60.0);
    col += vec3(1.0, 0.95, 0.85) * spec * 0.5;
  }
  // far-field levels carry 4-8 m vertical quanta: draw storey bands procedurally on glass
  if (glassy && uCell >= 8.0 && vDir != 2 && vDir != 3) {
    float fy = vWorld.y / 4.0;
    float fwy = fwidth(fy);
    float band = smoothstep(0.62, 0.72, fract(fy)) * (1.0 - smoothstep(0.92, 1.0, fract(fy)));
    float fade = 1.0 - smoothstep(0.25, 0.6, fwy);
    col *= 1.0 - band * 0.35 * fade;
  }
  if (emissive) col = albedo * 1.15;
  if (water) {
    vec2 wp = vWorld.xz;
    float wv = sin(wp.x * 0.21 + uTime * 0.9) * sin(wp.y * 0.17 - uTime * 0.7) + 0.6 * sin((wp.x + wp.y) * 0.11 + uTime * 0.5);
    vec3 wn = normalize(n + vec3(wv * 0.035, 0.0, wv * 0.03));
    float fr = pow(1.0 - max(dot(wn, v), 0.0), 4.0);
    vec3 r = reflect(-v, wn);
    col = mix(albedo * (0.55 + 0.35 * sun), skyTint(r), 0.22 + fr * 0.6);
    col += vec3(1.0, 0.92, 0.8) * pow(max(dot(r, uSunDir), 0.0), 120.0) * 1.6;
    alpha = mix(0.78, 0.97, fr);
    if (vDir != 2) alpha = 0.55;
  } else if (transparent) alpha = 0.6;
  // aerial perspective
  float fog = 1.0 - exp(-pow(dist * uFogDensity, 1.35));
  col = mix(col, uFogColor, fog);
  outColor = vec4(toSRGB(col), alpha);
}
`;

let paletteTex = null;
export function makePalette(palette) {
  // sRGB bytes + flags; the shader converts to linear
  const data = new Uint8Array(256 * 4);
  for (const p of palette) {
    const hex = p.color.replace('#', '');
    data[p.id * 4] = parseInt(hex.slice(0, 2), 16); data[p.id * 4 + 1] = parseInt(hex.slice(2, 4), 16); data[p.id * 4 + 2] = parseInt(hex.slice(4, 6), 16);
    let f = 0;
    for (const ch of p.flags) f |= { T: 1, G: 2, E: 4, K: 8, P: 16, V: 32, I: 64, W: 128 }[ch] || 0;
    data[p.id * 4 + 3] = f;
  }
  paletteTex = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  paletteTex.magFilter = THREE.NearestFilter; paletteTex.minFilter = THREE.NearestFilter; paletteTex.generateMipmaps = false;
  paletteTex.needsUpdate = true;
  return paletteTex;
}

export const sharedUniforms = {
  uSunDir: { value: SUN_DIR },
  uFogColor: { value: new THREE.Color(0.66, 0.76, 0.88) },
  uFogDensity: { value: 1 / 9000 },
  uCamPos: { value: new THREE.Vector3() },
  uTime: { value: 0 },
};

export function makeTileMaterial(patternTex, cell, transparent) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VS,
    fragmentShader: FS,
    uniforms: {
      ...sharedUniforms,
      uPalette: { value: paletteTex },
      uPattern: { value: patternTex },
      uCell: { value: cell },
    },
    transparent,
    depthWrite: !transparent,
    side: THREE.FrontSide,
  });
}

let baseQuad = null;
export function quadGeometry(opaque, n) {
  if (!baseQuad) {
    baseQuad = {
      corner: new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
      index: new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1),
    };
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('corner', baseQuad.corner);
  g.setIndex(baseQuad.index);
  const ib = new THREE.InstancedInterleavedBuffer(opaque, 8, 1);
  g.setAttribute('qa', new THREE.InterleavedBufferAttribute(ib, 4, 0, false));
  g.setAttribute('qb', new THREE.InterleavedBufferAttribute(ib, 4, 4, false));
  g.instanceCount = n;
  return g;
}

export function patternTexture(bytes, len) {
  const w = 2048, h = Math.max(1, Math.ceil(len / w));
  const data = new Uint8Array(w * h);
  data.set(bytes.subarray(0, Math.min(bytes.length, w * h)));
  const t = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

// sky dome
export function makeSky() {
  const g = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { ...sharedUniforms },
    vertexShader: /* glsl */`out vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`precision highp float; ${COMMON} in vec3 vDir; out vec4 outColor; void main() { vec3 d = normalize(vDir); vec3 c = skyTint(d); if (d.y < 0.0) c = mix(c, uFogColor, clamp(-d.y * 8.0, 0.0, 1.0)); outColor = vec4(toSRGB(c), 1.0); }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

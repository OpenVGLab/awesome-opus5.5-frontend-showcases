import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Runs after OutputPass, so it works on display-referred colors.
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1280, 720) },
    uAberr: { value: 0.0015 }, uBlur: { value: 0 }, uLines: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Vector3(1, 1, 1) },
    uVig: { value: 0.45 }, uDamage: { value: 0 }, uGrain: { value: 0.03 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uWarp: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uAberr, uBlur, uLines, uFlash, uVig, uDamage, uGrain, uWarp;
    uniform vec2 uRes, uCenter; uniform vec3 uFlashCol;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 asp = vec2(uRes.x / uRes.y, 1.0);
      vec2 d = vUv - uCenter;
      float r = length(d * asp);
      vec2 uv = uCenter + d * (1.0 - uWarp * 0.22 * r * r);
      d = uv - uCenter;
      vec3 col;
      if (uBlur > 0.001) {
        vec3 acc = vec3(0.0); float tw = 0.0;
        for (int i = 0; i < 16; i++) {
          float t = float(i) / 15.0;
          float s = 1.0 - uBlur * t * 0.3;
          float w = 1.0 - t * 0.7;
          float ab = uAberr * 4.0 + uBlur * 0.02 * t;
          acc.r += texture2D(tDiffuse, uCenter + d * s * (1.0 + ab)).r * w;
          acc.g += texture2D(tDiffuse, uCenter + d * s).g * w;
          acc.b += texture2D(tDiffuse, uCenter + d * s * (1.0 - ab)).b * w;
          tw += w;
        }
        col = acc / tw;
      } else {
        float ab = uAberr * (0.4 + r * 2.0);
        col.r = texture2D(tDiffuse, uCenter + d * (1.0 + ab)).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uCenter + d * (1.0 - ab)).b;
      }
      if (uLines > 0.001) {
        float ang = atan(d.y, d.x * asp.x);
        float seg = ang * 38.197;
        float id = floor(seg);
        float h = hash(vec2(id, floor(uTime * 20.0)));
        float h2 = hash(vec2(id * 1.37, 7.0));
        float w = 1.0 - smoothstep(0.0, 0.16 + 0.1 * h2, abs(fract(seg) - 0.5));
        float line = step(0.7, h) * w * smoothstep(0.32 + 0.3 * h2, 0.95, r);
        col += vec3(0.8, 0.92, 1.0) * line * uLines * 0.55;
      }
      col *= mix(1.0, smoothstep(1.3, 0.3, r), uVig);
      col = mix(col, vec3(0.9, 0.02, 0.08), uDamage * smoothstep(0.3, 1.05, r) * 0.85);
      col = mix(col, uFlashCol, clamp(uFlash, 0.0, 1.0));
      col += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPost(renderer, scene, camera, w, h, samples) {
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(Math.round(w * pr), Math.round(h * pr), { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.75, 0.42, 0.86);
  // Stacked additive blasts reach values in the hundreds; capping what feeds the blur keeps their halo local instead of whiting out the screen.
  const hp = bloom.materialHighPassFilter;
  hp.fragmentShader = hp.fragmentShader.replace('gl_FragColor = mix( outputColor, texel, alpha );',
    'texel.rgb *= min( 1.0, 6.0 / max( max( texel.r, max( texel.g, texel.b ) ), 1e-4 ) );\n\t\t\tgl_FragColor = mix( outputColor, texel, alpha );');
  hp.needsUpdate = true;
  const final = new ShaderPass(FinalShader);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(final);
  final.uniforms.uRes.value.set(w, h);
  return {
    composer, bloom, u: final.uniforms,
    setSize(nw, nh, npr) {
      composer.setPixelRatio(npr);
      composer.setSize(nw, nh);
      final.uniforms.uRes.value.set(nw, nh);
    },
    render() { composer.render(); },
  };
}

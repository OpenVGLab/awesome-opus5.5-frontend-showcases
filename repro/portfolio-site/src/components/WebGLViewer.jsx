// WebGL-powered transitions between project images (Three.js from the vendored r186 build,
// resolved through the page's import map). Renders on demand: idle frames cost nothing.
import { gsap } from 'gsap';
import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../lib/hooks';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D uFrom;
  uniform sampler2D uTo;
  uniform vec2 uRes;
  uniform vec2 uFromSize;
  uniform vec2 uToSize;
  uniform float uProgress;
  uniform float uEffect;
  uniform float uDir;
  uniform vec2 uMouse;
  varying vec2 vUv;

  vec2 cover(vec2 uv, vec2 img) {
    vec2 s = uRes / img;
    float k = max(s.x, s.y);
    vec2 size = img * k;
    vec2 offset = (uRes - size) * 0.5;
    return (uv * uRes - offset) / size;
  }

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { return noise(p) * 0.65 + noise(p * 2.7) * 0.35; }

  vec4 sampleFrom(vec2 uv) { return texture2D(uFrom, clamp(cover(uv, uFromSize), 0.0, 1.0)); }
  vec4 sampleTo(vec2 uv) { return texture2D(uTo, clamp(cover(uv, uToSize), 0.0, 1.0)); }

  void main() {
    vec2 uv = vUv + uMouse * 0.012;
    float p = uProgress;
    vec4 color;

    if (uEffect < 0.5) {
      // Noise displacement dissolve.
      float n = fbm(uv * 5.0);
      float e = smoothstep(0.0, 1.0, p);
      vec2 fromUv = uv + vec2(n * e * 0.3 * uDir, 0.0);
      vec2 toUv = uv - vec2(n * (1.0 - e) * 0.3 * uDir, 0.0);
      float edge = smoothstep(e - 0.18, e + 0.18, n * 0.8 + (uDir > 0.0 ? 1.0 - uv.x : uv.x) * 0.2);
      color = mix(sampleTo(toUv), sampleFrom(fromUv), edge);
    } else if (uEffect < 1.5) {
      // Radial ripple.
      vec2 c = uv - 0.5;
      c.x *= uRes.x / uRes.y;
      float d = length(c);
      float wave = sin(d * 38.0 - p * 18.0) * 0.025 * sin(p * 3.14159);
      vec2 off = normalize(c + 1e-5) * wave;
      float reveal = smoothstep(p * 1.25 - 0.15, p * 1.25, d);
      color = mix(sampleTo(uv + off), sampleFrom(uv - off), reveal);
    } else if (uEffect < 2.5) {
      // Directional slide with chromatic split.
      float e = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) / 2.0;
      float shift = sin(p * 3.14159) * 0.018;
      vec2 fromUv = uv + vec2(e * uDir, 0.0);
      vec2 toUv = uv + vec2((e - 1.0) * uDir, 0.0);
      bool showTo = uDir > 0.0 ? uv.x > 1.0 - e : uv.x < e;
      if (showTo) {
        color = vec4(sampleTo(toUv + vec2(shift, 0.0)).r, sampleTo(toUv).g, sampleTo(toUv - vec2(shift, 0.0)).b, 1.0);
      } else {
        color = vec4(sampleFrom(fromUv + vec2(shift, 0.0)).r, sampleFrom(fromUv).g, sampleFrom(fromUv - vec2(shift, 0.0)).b, 1.0);
      }
    } else {
      // Pixel mosaic.
      float cells = mix(uRes.x, 18.0, sin(p * 3.14159));
      vec2 grid = vec2(cells, cells * uRes.y / uRes.x);
      vec2 puv = (floor(uv * grid) + 0.5) / grid;
      color = mix(sampleFrom(puv), sampleTo(puv), smoothstep(0.35, 0.65, p));
    }

    float vignette = smoothstep(1.25, 0.35, length(vUv - 0.5));
    gl_FragColor = vec4(color.rgb * mix(0.86, 1.0, vignette), 1.0);
  }
`;

const textureUrl = (project) => project.image.src.replace(/\.webp$/, '-1200.webp');

export default function WebGLViewer({ projects, index, direction }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [fallback, setFallback] = useState(false);
  const reduce = usePrefersReducedMotion();
  const project = projects[index];

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setFallback(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const blank = new THREE.DataTexture(new Uint8Array([20, 20, 20, 255]), 1, 1);
    blank.needsUpdate = true;
    const uniforms = {
      uFrom: { value: blank },
      uTo: { value: blank },
      uRes: { value: new THREE.Vector2(1, 1) },
      uFromSize: { value: new THREE.Vector2(1, 1) },
      uToSize: { value: new THREE.Vector2(1, 1) },
      uProgress: { value: 0 },
      uEffect: { value: 0 },
      uDir: { value: 1 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const render = () => renderer.render(scene, camera);
    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect();
      renderer.setSize(width, height, false);
      uniforms.uRes.value.set(width, height);
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const loader = new THREE.TextureLoader();
    const cache = new Map();
    const load = (url) => {
      if (!cache.has(url)) {
        cache.set(
          url,
          loader.loadAsync(url).then((tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.generateMipmaps = false;
            return tex;
          }),
        );
      }
      return cache.get(url);
    };

    const mouse = { x: 0, y: 0 };
    const onMove = (e) => {
      const r = wrap.getBoundingClientRect();
      gsap.to(mouse, {
        x: (e.clientX - r.left) / r.width - 0.5,
        y: 0.5 - (e.clientY - r.top) / r.height,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: () => {
          uniforms.uMouse.value.set(mouse.x, mouse.y);
          render();
        },
      });
    };
    wrap.addEventListener('pointermove', onMove);

    stateRef.current = { renderer, uniforms, render, load, current: null, tween: null };
    return () => {
      stateRef.current?.tween?.kill();
      gsap.killTweensOf(mouse);
      wrap.removeEventListener('pointermove', onMove);
      ro.disconnect();
      cache.forEach((p) => p.then((t) => t.dispose()).catch(() => {}));
      material.dispose();
      mesh.geometry.dispose();
      blank.dispose();
      renderer.dispose();
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    const s = stateRef.current;
    if (!s || !project) return;
    let cancelled = false;
    const url = textureUrl(project);
    s.load(url).then((tex) => {
      if (cancelled || !stateRef.current) return;
      const { uniforms, render } = s;
      const size = new THREE.Vector2(tex.image.width, tex.image.height);
      // Preload neighbours so the next transition starts instantly.
      [1, -1].forEach((d) => s.load(textureUrl(projects[(index + d + projects.length) % projects.length])));
      s.tween?.kill();
      if (!s.current || reduce) {
        uniforms.uFrom.value = tex;
        uniforms.uFromSize.value.copy(size);
        uniforms.uProgress.value = 0;
        s.current = url;
        render();
        return;
      }
      if (s.current === url) return;
      uniforms.uTo.value = tex;
      uniforms.uToSize.value.copy(size);
      uniforms.uEffect.value = project.transition;
      uniforms.uDir.value = direction >= 0 ? 1 : -1;
      uniforms.uProgress.value = 0;
      s.tween = gsap.to(uniforms.uProgress, {
        value: 1,
        duration: project.transition === 3 ? 1.0 : 1.25,
        ease: 'power2.inOut',
        onUpdate: render,
        onComplete: () => {
          uniforms.uFrom.value = tex;
          uniforms.uFromSize.value.copy(size);
          uniforms.uProgress.value = 0;
          render();
        },
      });
      s.current = url;
    });
    return () => {
      cancelled = true;
    };
  }, [project, index, projects, direction, reduce]);

  return (
    <div ref={wrapRef} className="viewer">
      {fallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={project.id} className="viewer-fallback" src={textureUrl(project)} alt="" />
      ) : (
        <canvas ref={canvasRef} className="viewer-canvas" />
      )}
    </div>
  );
}

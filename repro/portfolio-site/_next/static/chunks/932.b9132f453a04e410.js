"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[932],{932:(e,o,r)=>{r.a(e,async(e,t)=>{try{r.r(o),r.d(o,{default:()=>c});var u=r(7876),i=r(6941),l=r(7957),s=r(4232),a=r(7256),v=e([l]);l=(v.then?(await v)():v)[0];let n=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`,f=`
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
`,m=e=>e.image.src.replace(/\.webp$/,"-1200.webp");function c({projects:e,index:o,direction:r}){let t=(0,s.useRef)(null),v=(0,s.useRef)(null),p=(0,s.useRef)(null),[h,d]=(0,s.useState)(!1),g=(0,a.jt)(),w=e[o];return(0,s.useEffect)(()=>{let e,o=v.current,r=t.current;try{e=new l.WebGLRenderer({canvas:o,antialias:!1,alpha:!1,powerPreference:"high-performance"})}catch{d(!0);return}e.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),e.outputColorSpace=l.SRGBColorSpace;let u=new l.Scene,s=new l.OrthographicCamera(-1,1,1,-1,0,1),a=new l.DataTexture(new Uint8Array([20,20,20,255]),1,1);a.needsUpdate=!0;let c={uFrom:{value:a},uTo:{value:a},uRes:{value:new l.Vector2(1,1)},uFromSize:{value:new l.Vector2(1,1)},uToSize:{value:new l.Vector2(1,1)},uProgress:{value:0},uEffect:{value:0},uDir:{value:1},uMouse:{value:new l.Vector2(0,0)}},m=new l.ShaderMaterial({uniforms:c,vertexShader:n,fragmentShader:f}),h=new l.Mesh(new l.PlaneGeometry(2,2),m);u.add(h);let g=()=>e.render(u,s),w=()=>{let{width:o,height:t}=r.getBoundingClientRect();e.setSize(o,t,!1),c.uRes.value.set(o,t),g()},x=new ResizeObserver(w);x.observe(r),w();let R=new l.TextureLoader,U=new Map,y={x:0,y:0},F=e=>{let o=r.getBoundingClientRect();i.os.to(y,{x:(e.clientX-o.left)/o.width-.5,y:.5-(e.clientY-o.top)/o.height,duration:.6,ease:"power2.out",onUpdate:()=>{c.uMouse.value.set(y.x,y.y),g()}})};return r.addEventListener("pointermove",F),p.current={renderer:e,uniforms:c,render:g,load:e=>(U.has(e)||U.set(e,R.loadAsync(e).then(e=>(e.colorSpace=l.SRGBColorSpace,e.minFilter=l.LinearFilter,e.generateMipmaps=!1,e))),U.get(e)),current:null,tween:null},()=>{p.current?.tween?.kill(),i.os.killTweensOf(y),r.removeEventListener("pointermove",F),x.disconnect(),U.forEach(e=>e.then(e=>e.dispose()).catch(()=>{})),m.dispose(),h.geometry.dispose(),a.dispose(),e.dispose(),p.current=null}},[]),(0,s.useEffect)(()=>{let t=p.current;if(!t||!w)return;let u=!1,s=m(w);return t.load(s).then(a=>{if(u||!p.current)return;let{uniforms:v,render:c}=t,n=new l.Vector2(a.image.width,a.image.height);if([1,-1].forEach(r=>t.load(m(e[(o+r+e.length)%e.length]))),t.tween?.kill(),!t.current||g){v.uFrom.value=a,v.uFromSize.value.copy(n),v.uProgress.value=0,t.current=s,c();return}t.current!==s&&(v.uTo.value=a,v.uToSize.value.copy(n),v.uEffect.value=w.transition,v.uDir.value=r>=0?1:-1,v.uProgress.value=0,t.tween=i.os.to(v.uProgress,{value:1,duration:3===w.transition?1:1.25,ease:"power2.inOut",onUpdate:c,onComplete:()=>{v.uFrom.value=a,v.uFromSize.value.copy(n),v.uProgress.value=0,c()}}),t.current=s)}),()=>{u=!0}},[w,o,e,r,g]),(0,u.jsx)("div",{ref:t,className:"viewer",children:h?(0,u.jsx)("img",{className:"viewer-fallback",src:m(w),alt:""},w.id):(0,u.jsx)("canvas",{ref:v,className:"viewer-canvas"})})}t()}catch(e){t(e)}})}}]);
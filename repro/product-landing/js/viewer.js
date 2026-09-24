import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHeadphones, createStudio, createShadow, BOUNDS } from './headphones.js';
import { qs, qsa, on, motionOK, clamp } from './core.js';
import { getConfig } from './commerce.js';

const HOTSPOTS = {
  band: ['Titanium-reinforced band', 'Flexes without fatigue and adds just 38 g.'],
  touch: ['Touch controls', 'Swipe for volume, tap to play or pause, hold to switch ANC modes.'],
  cushion: ['Memory-foam cushions', 'Magnetic and swappable in seconds — leather or knit.'],
  usb: ['USB-C fast charge', '5 minutes of charging gives 5 hours of playback.'],
  mics: ['8 microphones', 'Four cancel noise, four beamform onto your voice for calls.'],
};

export function initViewer(root) {
  let dirty = true;
  let explode = 0;
  let explodeTarget = 0;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  root.insertBefore(canvas, qs('[data-hotspots]', root));

  const scene = new THREE.Scene();
  createStudio(renderer, scene, { envIntensity: 1.05 });
  const cfg = getConfig();
  const hp = createHeadphones({ finish: cfg.finish, cushion: cfg.cushion, engraving: cfg.engraving });
  scene.add(hp.group);
  const shadow = createShadow(0.42);
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  const target = BOUNDS.center.clone();
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.8;
  controls.minPolarAngle = Math.PI * 0.2;
  controls.maxPolarAngle = Math.PI * 0.6;
  controls.autoRotate = motionOK();
  controls.autoRotateSpeed = 1.4;
  canvas.style.touchAction = 'pan-y';

  const sph = new THREE.Spherical();
  let baseDist = 52;
  let zoom = 1;
  const HOME = { theta: 0.62, phi: Math.PI * 0.44 };
  const placeCamera = (theta, phi, dist) => {
    sph.set(dist, phi, theta);
    camera.position.setFromSpherical(sph).add(target);
    camera.lookAt(target);
  };
  placeCamera(HOME.theta, HOME.phi, baseDist);

  let width = 1;
  let height = 1;
  const resize = () => {
    const r = root.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const vFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const fitV = BOUNDS.radius / Math.sin(vFov);
    const fitH = BOUNDS.radius / Math.sin(Math.atan(Math.tan(vFov) * camera.aspect));
    baseDist = Math.max(fitV, fitH) * 1.04;
    camera.updateProjectionMatrix();
    sph.setFromVector3(camera.position.clone().sub(target));
    placeCamera(sph.theta, sph.phi, baseDist * zoom);
    dirty = true;
  };

  // Hotspots
  const layer = qs('[data-hotspots]', root);
  const caption = qs('[data-hotspot-caption]', root);
  const spots = hp.hotspots.map((h) => {
    const [title, text] = HOTSPOTS[h.id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hotspot';
    btn.setAttribute('aria-label', `${title}: ${text}`);
    btn.innerHTML = '<span class="hotspot-label"></span>';
    btn.firstChild.textContent = title;
    layer.appendChild(btn);
    return { ...h, btn, title, text };
  });
  const tmp = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  let activeSpot = null;
  const updateHotspots = () => {
    hp.group.updateMatrixWorld();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hp.group.matrixWorld);
    spots.forEach((s) => {
      tmp.copy(s.pos).applyMatrix4(hp.group.matrixWorld);
      nrm.copy(s.normal).applyMatrix3(normalMatrix).normalize();
      toCam.copy(camera.position).sub(tmp).normalize();
      const facing = nrm.dot(toCam) > 0.12 && explode < 0.5;
      tmp.project(camera);
      const x = (tmp.x * 0.5 + 0.5) * width;
      const y = (-tmp.y * 0.5 + 0.5) * height;
      s.btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      s.btn.classList.toggle('is-hidden', !facing);
      s.btn.classList.toggle('flip', x > width * 0.62);
      s.btn.tabIndex = facing ? 0 : -1;
    });
  };
  const setCaption = (s) => {
    caption.textContent = '';
    if (!s) return;
    const b = document.createElement('b');
    b.textContent = s.title;
    caption.append(b, document.createTextNode(s.text));
  };

  // Camera tweening (azimuth/polar/zoom), shared by hotspots, keys, reset and engraving focus
  let camTween = null;
  const tweenCamera = (theta, phi, z = zoom, ms = 900) => {
    sph.setFromVector3(camera.position.clone().sub(target));
    let dTheta = theta - sph.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    camTween = { t0: performance.now(), ms: motionOK() ? ms : 1, from: { theta: sph.theta, phi: sph.phi, z: zoom }, d: { theta: dTheta, phi: phi - sph.phi, z: z - zoom } };
    dirty = true;
  };
  spots.forEach((s) => s.btn.addEventListener('click', () => {
    spots.forEach((o) => o.btn.classList.toggle('is-active', o === s));
    activeSpot = s;
    setCaption(s);
    setSpin(false);
    const wp = s.pos.clone().applyMatrix4(hp.group.matrixWorld).sub(target);
    const n = s.normal.clone().normalize();
    const dir = wp.normalize().multiplyScalar(0.4).add(n).normalize();
    const theta = Math.atan2(dir.x, dir.z);
    const phi = clamp(Math.acos(clamp(dir.y, -1, 1)), controls.minPolarAngle, controls.maxPolarAngle);
    tweenCamera(theta, phi, 0.9);
  }));

  // Tools
  const spinBtn = qs('[data-viewer="spin"]', root);
  const explodeBtn = qs('[data-viewer="explode"]', root);
  let spinEnabled = controls.autoRotate;
  let resumeTimer = 0;
  function setSpin(onState) {
    spinEnabled = onState;
    controls.autoRotate = onState;
    spinBtn.setAttribute('aria-pressed', String(onState));
    spinBtn.setAttribute('aria-label', onState ? 'Pause auto-rotate' : 'Start auto-rotate');
    qs('use', spinBtn).setAttribute('href', onState ? '#i-pause' : '#i-play');
    dirty = true;
  }
  setSpin(spinEnabled);
  spinBtn.addEventListener('click', () => setSpin(!spinEnabled));
  const setExplode = (onState) => {
    explodeTarget = onState ? 1 : 0;
    explodeBtn.setAttribute('aria-pressed', String(onState));
    explodeBtn.setAttribute('aria-label', onState ? 'Close exploded view' : 'Show exploded view');
    if (onState) {
      caption.textContent = '';
      const b = document.createElement('b');
      b.textContent = 'Exploded view';
      caption.append(b, document.createTextNode('40 mm drivers, magnetic cushions and the acoustic fabric.'));
      tweenCamera(1.05, Math.PI * 0.45, 0.95);
    } else setCaption(activeSpot);
    dirty = true;
  };
  explodeBtn.addEventListener('click', () => setExplode(explodeTarget === 0));
  const reset = () => {
    activeSpot = null;
    spots.forEach((o) => o.btn.classList.remove('is-active'));
    setCaption(null);
    setExplode(false);
    tweenCamera(HOME.theta, HOME.phi, 1);
  };
  qs('[data-viewer="reset"]', root).addEventListener('click', reset);
  qs('[data-viewer="full"]', root).addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => setTimeout(resize, 50));

  // Keyboard support on the focused viewer
  root.addEventListener('keydown', (e) => {
    if (e.target !== root) return;
    sph.setFromVector3(camera.position.clone().sub(target));
    const step = Math.PI / 12;
    let handled = true;
    if (e.key === 'ArrowLeft') tweenCamera(sph.theta - step, sph.phi, zoom, 300);
    else if (e.key === 'ArrowRight') tweenCamera(sph.theta + step, sph.phi, zoom, 300);
    else if (e.key === 'ArrowUp') tweenCamera(sph.theta, clamp(sph.phi - step / 2, controls.minPolarAngle, controls.maxPolarAngle), zoom, 300);
    else if (e.key === 'ArrowDown') tweenCamera(sph.theta, clamp(sph.phi + step / 2, controls.minPolarAngle, controls.maxPolarAngle), zoom, 300);
    else if (e.key === '+' || e.key === '=') tweenCamera(sph.theta, sph.phi, clamp(zoom - 0.12, 0.7, 1.3), 300);
    else if (e.key === '-' || e.key === '_') tweenCamera(sph.theta, sph.phi, clamp(zoom + 0.12, 0.7, 1.3), 300);
    else if (e.key.toLowerCase() === 'e') setExplode(explodeTarget === 0);
    else if (e.key.toLowerCase() === 'r') reset();
    else handled = false;
    if (handled) {
      e.preventDefault();
      if (e.key.startsWith('Arrow')) setSpin(false);
      root.classList.add('is-interacted');
    }
  });

  controls.addEventListener('start', () => {
    root.classList.add('is-interacted');
    camTween = null;
    controls.autoRotate = false;
    clearTimeout(resumeTimer);
  });
  controls.addEventListener('end', () => {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (spinEnabled) controls.autoRotate = true;
      dirty = true;
    }, 2500);
  });
  controls.addEventListener('change', () => { dirty = true; });

  // Dial
  const dialArc = qs('[data-dial-arc]', root);
  const dialDeg = qs('[data-dial-deg]', root);
  const updateDial = () => {
    const deg = ((THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()) % 360) + 360) % 360;
    dialDeg.textContent = `${Math.round(deg)}°`;
    const a = THREE.MathUtils.degToRad(Math.max(deg, 0.5));
    const x = 22 + 18 * Math.sin(a);
    const y = 22 - 18 * Math.cos(a);
    dialArc.setAttribute('d', `M22 4 A18 18 0 ${deg > 180 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`);
  };

  // Configurator sync
  let lastEngraving = cfg.engraving;
  let lastFinish = cfg.finish;
  on('config', (c) => {
    hp.setFinish(c.finish);
    hp.setCushion(c.cushion);
    hp.setEngraving(c.engraving);
    if (c.engraving && c.engraving !== lastEngraving) {
      setSpin(false);
      tweenCamera(-Math.PI / 2 + 0.25, Math.PI * 0.47, 0.9, 700);
    } else if (c.finish !== lastFinish && motionOK()) {
      sph.setFromVector3(camera.position.clone().sub(target));
      tweenCamera(sph.theta + 0.7, sph.phi, zoom, 900);
    }
    lastEngraving = c.engraving;
    lastFinish = c.finish;
    dirty = true;
  });

  // Render loop: only while visible, and only when something changes
  let visible = true;
  let last = performance.now();
  const clock = (now) => {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    let active = dirty || controls.autoRotate;
    if (camTween) {
      const k = clamp((now - camTween.t0) / camTween.ms, 0, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      zoom = camTween.from.z + camTween.d.z * e;
      placeCamera(camTween.from.theta + camTween.d.theta * e, camTween.from.phi + camTween.d.phi * e, baseDist * zoom);
      if (k >= 1) camTween = null;
      active = true;
    }
    if (Math.abs(explodeTarget - explode) > 0.001) {
      explode += (explodeTarget - explode) * (1 - Math.exp(-dt * (motionOK() ? 5 : 60)));
      if (Math.abs(explodeTarget - explode) < 0.002) explode = explodeTarget;
      hp.setExplode(explode);
      active = true;
    }
    if (hp.update(dt)) active = true;
    if (controls.update(dt)) active = true;
    if (active) {
      renderer.render(scene, camera);
      updateHotspots();
      updateDial();
      dirty = false;
      if (!root.classList.contains('is-ready')) root.classList.add('is-ready');
    }
  };
  const setLoop = () => renderer.setAnimationLoop(visible && !document.hidden ? clock : null);
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    last = performance.now();
    setLoop();
  }, { rootMargin: '100px 0px' }).observe(root);
  document.addEventListener('visibilitychange', setLoop);
  new ResizeObserver(resize).observe(root);
  resize();
  renderer.render(scene, camera);
  updateHotspots();
  updateDial();
  root.classList.add('is-ready');
  setLoop();
  qsa('[data-viewer-loading]', root).forEach((el) => el.setAttribute('aria-hidden', 'true'));
}

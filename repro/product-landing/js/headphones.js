// Procedural "Hush One" headphones. Units are centimetres; +Z is the wearer's front, cups sit on the X axis.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TAU = Math.PI * 2;
const sgnPow = (t, p) => Math.sign(t) * Math.pow(Math.abs(t), p);
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const FINISHES = {
  carbon: { label: 'Carbon', shell: '#1f1f21', metal: '#55565b', pad: '#18181a', logo: '#6a6a6f', engrave: '#a4a5a9', fabric: '#0d0d0e', driver: '#4a4a4e' },
  graphite: { label: 'Graphite', shell: '#606266', metal: '#b9bcc1', pad: '#2e2f32', logo: '#96989c', engrave: '#dcdee2', fabric: '#161618', driver: '#6a6a6e' },
  chalk: { label: 'Chalk', shell: '#e9e6df', metal: '#d6d3cc', pad: '#dcd7cd', logo: '#bebab1', engrave: '#8f8b83', fabric: '#3c3b38', driver: '#a8a6a1' },
};

const CUP = { a: 4.6, b: 3.7, n: 2.35 };
const BAND = { ax: 8.0, by: 7.2, cy: 4.2, n: 2.6 };
const CUP_Y = -3.4;
const CUP_OFFSET = -0.7;

export const BOUNDS = { center: new THREE.Vector3(0, 1.85, 0), radius: 13.6 };

function superOutline(a, b, n) {
  return (phi) => {
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    const y = a * sgnPow(s, 2 / n);
    const z = b * sgnPow(c, 2 / n);
    const gy = (Math.sign(y) * Math.pow(Math.abs(y / a), n - 1)) / a;
    const gz = (Math.sign(z) * Math.pow(Math.abs(z / b), n - 1)) / b;
    const l = Math.hypot(gy, gz) || 1;
    return { y, z, ny: gy / l, nz: gz / l };
  };
}

function roundedRect(hu, hv, r, seg = 6) {
  r = Math.min(r, hu, hv);
  const pts = [];
  const corners = [
    [hu - r, hv - r],
    [-hu + r, hv - r],
    [-hu + r, -hv + r],
    [hu - r, -hv + r],
  ];
  corners.forEach(([cu, cv], q) => {
    for (let i = 0; i <= seg; i++) {
      const a = ((q + i / seg) * Math.PI) / 2;
      pts.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]);
    }
  });
  return pts;
}

// Averages normals of duplicated seam vertices so the wrap-around is invisible.
function fixSeams(geo, rows, cols, closedRows) {
  const n = geo.attributes.normal;
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  const avg = (i, j) => {
    v.fromBufferAttribute(n, i);
    w.fromBufferAttribute(n, j);
    v.add(w).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
    n.setXYZ(j, v.x, v.y, v.z);
  };
  for (let r = 0; r < rows; r++) avg(r * cols, r * cols + cols - 1);
  if (closedRows) for (let c = 0; c < cols; c++) avg(c, (rows - 1) * cols + c);
  n.needsUpdate = true;
}

// Sweeps a (inset, axial) profile around a superellipse outline that lies in the YZ plane; the axis is X.
function ovalSweep(outline, profile, { J = 128, closed = false, capStart = false, flip = false } = {}) {
  const K = profile.length;
  const cols = J + 1;
  const rows = closed ? K + 1 : K;
  const pts = [];
  for (let j = 0; j <= J; j++) pts.push(outline(((j % J) / J) * TAU));
  const pos = [];
  const uv = [];
  const idx = [];
  for (let k = 0; k < rows; k++) {
    const [d, x] = profile[k % K];
    for (let j = 0; j < cols; j++) {
      const p = pts[j];
      pos.push(x, p.y - p.ny * d, p.z - p.nz * d);
      uv.push((j / J) * 6, k / (rows - 1));
    }
  }
  for (let k = 0; k < rows - 1; k++) {
    for (let j = 0; j < J; j++) {
      const a = k * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (flip) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  if (capStart) {
    const ci = pos.length / 3;
    pos.push(profile[0][1], 0, 0);
    uv.push(0.5, 0);
    for (let j = 0; j < J; j++) {
      if (flip) idx.push(ci, j + 1, j);
      else idx.push(ci, j, j + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  fixSeams(geo, rows, cols, closed);
  return geo;
}

// A flat oval facing -X (towards the head) or +X.
function ovalDisk(outline, inset, x, facing, J = 96) {
  const pos = [x, 0, 0];
  const uv = [0.5, 0.5];
  const idx = [];
  const ext = outline(Math.PI / 2).y - inset;
  const extZ = outline(0).z - inset;
  for (let j = 0; j <= J; j++) {
    const p = outline((j / J) * TAU);
    const y = p.y - p.ny * inset;
    const z = p.z - p.nz * inset;
    pos.push(x, y, z);
    uv.push(0.5 - z / (2 * extZ) * facing, 0.5 + y / (2 * ext));
  }
  for (let j = 1; j <= J; j++) {
    if (facing > 0) idx.push(0, j + 1, j);
    else idx.push(0, j, j + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Planar headband path in the XY plane, resampled by arc length. Frames: n points away from the arc centre.
function bandFrames(N) {
  const dense = [];
  for (let i = 0; i <= 4000; i++) {
    const th = Math.PI * (1 - i / 4000);
    dense.push(new THREE.Vector3(
      BAND.ax * sgnPow(Math.cos(th), 2 / BAND.n),
      BAND.cy + BAND.by * Math.pow(Math.abs(Math.sin(th)), 2 / BAND.n),
      0,
    ));
  }
  const acc = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + dense[i].distanceTo(dense[i - 1]));
  const total = acc[acc.length - 1];
  const pts = [];
  let k = 0;
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * total;
    while (k < acc.length - 2 && acc[k + 1] < s) k++;
    const f = (s - acc[k]) / (acc[k + 1] - acc[k] || 1);
    pts.push(dense[k].clone().lerp(dense[k + 1], f));
  }
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(N, i + 1)];
    const t = b.clone().sub(a).normalize();
    return { p, t: i / N, n: new THREE.Vector3(-t.y, t.x, 0), b: new THREE.Vector3(0, 0, 1) };
  });
}

function pathSweep(frames, profileAt, { flip = true } = {}) {
  const rows = frames.length;
  const M = profileAt(0).length;
  const cols = M + 1;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i < rows; i++) {
    const { p, n, b, t } = frames[i];
    const prof = profileAt(t);
    for (let j = 0; j < cols; j++) {
      const [u, v] = prof[j % M];
      pos.push(p.x + n.x * u + b.x * v, p.y + n.y * u + b.y * v, p.z + n.z * u + b.z * v);
      uv.push(t * 14, j / M);
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (flip) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  [0, rows - 1].forEach((i, e) => {
    const ci = pos.length / 3;
    const { p } = frames[i];
    pos.push(p.x, p.y, p.z);
    uv.push(0, 0);
    for (let j = 0; j < M; j++) {
      const a = i * cols + j;
      if ((e === 0) === flip) idx.push(ci, a + 1, a);
      else idx.push(ci, a, a + 1);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  fixSeams(geo, rows, cols, false);
  return geo;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function grainTexture(kind) {
  const size = 256;
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  let seed = kind === 'knit' ? 7 : 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v;
      if (kind === 'knit') {
        const row = Math.floor(y / 8);
        const cx = ((x + (row % 2) * 4) % 8) - 4;
        const cy = (y % 8) - 4;
        const stitch = Math.max(0, 1 - Math.hypot(cx * 0.9, cy * 1.6) / 4.2);
        v = 70 + stitch * 150 + rnd() * 30;
      } else {
        v = 128 + (rnd() - 0.5) * 70;
      }
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (kind !== 'knit') {
    g.globalAlpha = 0.5;
    g.filter = 'blur(1px)';
    g.drawImage(c, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function textTexture(draw, w = 1024, h = 256) {
  const c = canvas(w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const redraw = (...args) => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    draw(g, w, h, ...args);
    t.needsUpdate = true;
  };
  return { texture: t, redraw };
}

const HEAD_FONT = '"Inter Tight", "Inter", "Helvetica Neue", Arial, sans-serif';

function drawLogo(g, w, h) {
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${h * 0.62}px ${HEAD_FONT}`;
  if ('letterSpacing' in g) g.letterSpacing = `${-h * 0.02}px`;
  g.fillText('hush', w / 2, h * 0.52);
}

function drawEngraving(g, w, h, text) {
  if (!text) return;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = h * 0.74;
  g.font = `600 ${size}px ${HEAD_FONT}`;
  if ('letterSpacing' in g) g.letterSpacing = `${h * 0.06}px`;
  const label = text.toUpperCase();
  while (g.measureText(label).width > w * 0.92 && size > 10) {
    size -= 2;
    g.font = `600 ${size}px ${HEAD_FONT}`;
  }
  g.fillText(label, w / 2, h * 0.52);
}

function orientTo(obj, ny, nz) {
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, ny, nz).normalize());
}

export function createHeadphones({ finish = 'carbon', cushion = 'leather', engraving = '' } = {}) {
  const group = new THREE.Group();
  group.name = 'HushOne';

  const knitBump = grainTexture('knit');
  knitBump.repeat.set(1, 3);
  const leatherBump = grainTexture('leather');
  leatherBump.repeat.set(2, 6);

  const mats = {
    shell: new THREE.MeshPhysicalMaterial({ roughness: 0.52, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.35 }),
    metal: new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 1 }),
    pad: new THREE.MeshPhysicalMaterial({ roughness: 0.62, sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffffff'), bumpMap: leatherBump, bumpScale: 0.6 }),
    fabric: new THREE.MeshStandardMaterial({ roughness: 1, bumpMap: knitBump, bumpScale: 1.2 }),
    dark: new THREE.MeshStandardMaterial({ color: '#070707', roughness: 0.55 }),
    driver: new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.2, clearcoat: 0.6 }),
    accent: new THREE.MeshPhysicalMaterial({ color: '#ff5b14', roughness: 0.4, clearcoat: 0.5 }),
    led: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  };
  const logo = textTexture(drawLogo, 1024, 320);
  logo.redraw();
  const engrave = textTexture(drawEngraving, 1024, 192);
  let engravingText = engraving;
  engrave.redraw(engravingText);
  mats.logo = new THREE.MeshPhysicalMaterial({ map: logo.texture, transparent: true, roughness: 0.28, clearcoat: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  mats.engrave = new THREE.MeshPhysicalMaterial({ map: engrave.texture, transparent: true, roughness: 0.3, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.load(`800 80px ${HEAD_FONT}`).then(() => {
      logo.redraw();
      engrave.redraw(engravingText);
    }).catch(() => {});
  }

  // Headband: outer shell, a slim metal inlay on top and a cushion underneath.
  const frames = bandFrames(200);
  const bandHalfWidth = (t) => 1.15 + 0.35 * Math.pow(Math.sin(Math.PI * t), 0.8);
  const BAND_T = 0.36;
  const band = new THREE.Mesh(pathSweep(frames, (t) => roundedRect(BAND_T, bandHalfWidth(t), 0.33)), mats.shell);
  group.add(band);

  const inlayFrames = frames
    .filter((f) => f.t >= 0.06 && f.t <= 0.94)
    .map((f) => ({ ...f, p: f.p.clone().addScaledVector(f.n, BAND_T - 0.02), gt: f.t, t: (f.t - 0.06) / 0.88 }));
  const inlay = new THREE.Mesh(pathSweep(inlayFrames, (t) => {
    const s = smooth(0, 0.04, t) * smooth(1, 0.96, t);
    return roundedRect(0.05 * s + 0.004, 0.17 * s + 0.004, 0.05 * s + 0.003, 3);
  }), mats.metal);
  group.add(inlay);

  const t0 = 0.17;
  const t1 = 0.83;
  const PAD_T = 0.42;
  const padFrames = frames
    .filter((f) => f.t >= t0 && f.t <= t1)
    .map((f) => ({ ...f, p: f.p.clone().addScaledVector(f.n, -(BAND_T + PAD_T - 0.1)), gt: f.t, t: (f.t - t0) / (t1 - t0) }));
  const bandPadGeo = pathSweep(padFrames.map((f) => ({ ...f })), (t) => {
    const e = Math.sqrt(Math.max(0, smooth(0, 0.12, t) * smooth(1, 0.88, t)));
    const gt = t0 + t * (t1 - t0);
    const hu = PAD_T * e + 0.004;
    const hv = (bandHalfWidth(gt) - 0.1) * (0.55 + 0.45 * e) + 0.004;
    return roundedRect(hu, hv, hu * 0.96, 6);
  });
  const bandPad = new THREE.Mesh(bandPadGeo, mats.pad);
  group.add(bandPad);

  const housingGeo = new RoundedBoxGeometry(1.0, 1.35, 2.5, 5, 0.36);
  const sliderGeo = new RoundedBoxGeometry(0.26, 2.3, 1.25, 3, 0.11);
  const hingeGeo = new RoundedBoxGeometry(1.05, 0.72, 1.9, 5, 0.3);

  const outline = superOutline(CUP.a, CUP.b, CUP.n);
  const padOutline = superOutline(CUP.a + 0.02, CUP.b + 0.02, CUP.n);

  const shellProfile = [[1.25, 1.9]];
  for (let i = 0; i <= 12; i++) {
    const al = ((i / 12) * Math.PI) / 2;
    shellProfile.push([0.85 - 0.85 * Math.sin(al), 1.05 + 0.85 * Math.cos(al)]);
  }
  shellProfile.push([-0.03, 0.6], [-0.06, 0.05], [-0.07, -0.18], [-0.04, -0.26], [0.1, -0.3], [0.45, -0.3]);
  const shellGeo = ovalSweep(outline, shellProfile, { capStart: true, flip: true });

  const ringGeo = ovalSweep(outline, [[0.3, -0.25], [-0.04, -0.25], [-0.09, -0.29], [-0.095, -0.38], [-0.09, -0.47], [-0.05, -0.51], [0.3, -0.51]], { flip: true });

  const padProfile = [];
  const PC = { d: 0.97, x: -1.62, hr: 0.99, hx: 1.1 };
  for (let i = 0; i < 40; i++) {
    const ps = (i / 40) * TAU;
    const bulge = 1 + 0.05 * Math.max(0, -Math.sin(ps));
    padProfile.push([PC.d - PC.hr * sgnPow(Math.cos(ps), 2 / 2.9) * bulge, PC.x + PC.hx * sgnPow(Math.sin(ps), 2 / 2.9)]);
  }
  const padGeo = ovalSweep(padOutline, padProfile, { closed: true, flip: false, J: 128 });

  const fabricGeo = ovalDisk(outline, 1.72, -0.82, -1);
  const baffleGeo = ovalDisk(outline, 0.2, -0.32, -1);

  const driverProfile = [];
  for (let i = 0; i <= 24; i++) {
    const r = (i / 24) * 1.95;
    const cone = r < 0.55 ? 0.34 * Math.cos((r / 0.55) * Math.PI * 0.5) : -0.05 - 0.12 * Math.sin(((r - 0.55) / 1.4) * Math.PI);
    driverProfile.push(new THREE.Vector2(r, cone));
  }
  const driverGeo = new THREE.LatheGeometry(driverProfile, 64);
  driverGeo.rotateZ(Math.PI / 2);
  const driverRingGeo = new THREE.TorusGeometry(2.02, 0.09, 12, 72);
  driverRingGeo.rotateY(Math.PI / 2);

  const logoGeo = new THREE.PlaneGeometry(3.1, 0.97);
  logoGeo.rotateY(Math.PI / 2);
  const engraveGeo = new THREE.PlaneGeometry(3.4, 0.64);
  engraveGeo.rotateY(Math.PI / 2);
  const micGeo = new THREE.CircleGeometry(0.075, 20);
  micGeo.rotateY(Math.PI / 2);

  const exploders = [];
  const pivots = [];

  function buildCup(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * BAND.ax, CUP_Y, 0);
    pivot.rotation.y = side > 0 ? 0 : Math.PI;
    const cup = new THREE.Group();
    cup.position.x = CUP_OFFSET;
    pivot.add(cup);

    const shell = new THREE.Mesh(shellGeo, mats.shell);
    const ring = new THREE.Mesh(ringGeo, mats.metal);
    const pad = new THREE.Mesh(padGeo, mats.pad);
    const fabric = new THREE.Mesh(fabricGeo, mats.fabric);
    const baffle = new THREE.Mesh(baffleGeo, mats.dark);
    const driver = new THREE.Mesh(driverGeo, mats.driver);
    driver.position.x = -0.36;
    const driverRing = new THREE.Mesh(driverRingGeo, mats.metal);
    driverRing.position.x = -0.36;
    cup.add(shell, ring, pad, fabric, baffle, driver, driverRing);

    const logoMesh = new THREE.Mesh(logoGeo, mats.logo);
    logoMesh.position.set(1.905, side > 0 ? 0.15 : 0.55, 0);
    cup.add(logoMesh);
    let engraveMesh = null;
    if (side < 0) {
      engraveMesh = new THREE.Mesh(engraveGeo, mats.engrave);
      engraveMesh.position.set(1.905, -0.85, 0);
      cup.add(engraveMesh);
    }
    [[3.35, 0.32], [3.35, -0.32]].forEach(([y, z]) => {
      const m = new THREE.Mesh(micGeo, mats.dark);
      m.position.set(1.906, y, z);
      cup.add(m);
    });

    const hinge = new THREE.Mesh(hingeGeo, mats.metal);
    hinge.position.set(0, CUP.a + 0.36, 0);
    pivot.add(hinge);

    if (side > 0) {
      const onWall = (phi, x, geo, mat, lift = 0) => {
        const p = outline(phi);
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, p.y + p.ny * (0.06 + lift), p.z + p.nz * (0.06 + lift));
        orientTo(m, p.ny, p.nz);
        cup.add(m);
        return m;
      };
      const btn = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 24);
      onWall((TAU * 205) / 360, 0.5, btn, mats.accent);
      onWall((TAU * 228) / 360, 0.5, new THREE.CylinderGeometry(0.34, 0.34, 0.12, 28).scale(1, 1, 0.55), mats.shell);
      onWall((TAU * 190) / 360, 0.5, new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12), mats.led);
      const port = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.16, 0.9, 2, 0.07), mats.dark);
      port.position.set(0.42, -CUP.a - 0.02, 0);
      cup.add(port);
    }

    exploders.push({ pad, fabric, driver, driverRing, shell, ring, logoMesh, engraveMesh });
    pivots.push({ pivot, side });
    group.add(pivot);
    return pivot;
  }
  buildCup(1);
  buildCup(-1);

  [-1, 1].forEach((side) => {
    const housing = new THREE.Mesh(housingGeo, mats.shell);
    housing.position.set(side * BAND.ax, BAND.cy - 0.25, 0);
    const slider = new THREE.Mesh(sliderGeo, mats.metal);
    slider.position.set(side * BAND.ax, (CUP_Y + CUP.a + 0.36 + BAND.cy - 0.25) / 2, 0);
    group.add(housing, slider);
  });

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // Colour tweening between finishes (linear-space lerp towards targets).
  const current = {};
  const target = {};
  const keys = ['shell', 'metal', 'pad', 'logo', 'engrave', 'fabric', 'driver'];
  keys.forEach((k) => {
    current[k] = new THREE.Color();
    target[k] = new THREE.Color();
  });
  const apply = () => {
    mats.shell.color.copy(current.shell);
    mats.metal.color.copy(current.metal);
    mats.pad.color.copy(current.pad);
    mats.logo.color.copy(current.logo);
    mats.engrave.color.copy(current.engrave);
    mats.fabric.color.copy(current.fabric);
    mats.driver.color.copy(current.driver);
  };
  let finishName = finish;
  function setFinish(name, instant = false) {
    const f = FINISHES[name] || FINISHES.carbon;
    finishName = name;
    keys.forEach((k) => {
      target[k].set(f[k]);
      if (instant) current[k].copy(target[k]);
    });
    mats.pad.sheenColor.set(name === 'chalk' ? '#ffffff' : '#9a9a9a');
    apply();
  }
  let cushionType = cushion;
  function setCushion(type) {
    cushionType = type;
    if (type === 'knit') {
      mats.pad.roughness = 0.95;
      mats.pad.sheen = 1;
      mats.pad.sheenRoughness = 0.8;
      mats.pad.bumpMap = knitBump;
      mats.pad.bumpScale = 2.2;
    } else {
      mats.pad.roughness = 0.6;
      mats.pad.sheen = 0.6;
      mats.pad.sheenRoughness = 0.5;
      mats.pad.bumpMap = leatherBump;
      mats.pad.bumpScale = 0.6;
    }
    mats.pad.needsUpdate = true;
  }
  function setEngraving(text) {
    engravingText = (text || '').slice(0, 14);
    engrave.redraw(engravingText);
  }
  let explode = 0;
  function setExplode(t) {
    explode = t;
    exploders.forEach((e) => {
      e.pad.position.x = -3.1 * t;
      e.fabric.position.x = -2.0 * t;
      e.driver.position.x = -0.36 - 1.05 * t;
      e.driverRing.position.x = -0.36 - 1.05 * t;
      e.shell.position.x = 0.45 * t;
      e.logoMesh.position.x = 1.905 + 0.45 * t;
      if (e.engraveMesh) e.engraveMesh.position.x = 1.905 + 0.45 * t;
    });
    bandPad.position.y = -1.0 * t;
  }
  function setSwivel(t) {
    pivots.forEach(({ pivot, side }) => {
      pivot.rotation.y = (side > 0 ? 0 : Math.PI) - side * t * (Math.PI / 2);
    });
  }
  function update(dt) {
    let moving = false;
    const k = 1 - Math.exp(-dt * 6);
    keys.forEach((key) => {
      const c = current[key];
      const tg = target[key];
      if (Math.abs(c.r - tg.r) + Math.abs(c.g - tg.g) + Math.abs(c.b - tg.b) > 0.0005) {
        c.lerp(tg, k);
        moving = true;
      } else c.copy(tg);
    });
    apply();
    return moving;
  }

  setFinish(finish, true);
  setCushion(cushion);
  setExplode(0);

  // Hotspot anchors in group space, with outward normals for back-face hiding.
  const hotspots = [
    { id: 'band', pos: new THREE.Vector3(0, BAND.cy + BAND.by + 0.35, 0), normal: new THREE.Vector3(0, 1, 0.25) },
    { id: 'touch', pos: new THREE.Vector3(BAND.ax + CUP_OFFSET + 1.95, CUP_Y + 0.9, 0.9), normal: new THREE.Vector3(1, 0, 0.15) },
    { id: 'cushion', pos: new THREE.Vector3(-(BAND.ax + CUP_OFFSET - 1.6), CUP_Y - 1.4, CUP.b + 0.05), normal: new THREE.Vector3(0, 0, 1) },
    { id: 'usb', pos: new THREE.Vector3(BAND.ax + CUP_OFFSET + 0.45, CUP_Y - CUP.a - 0.1, 0), normal: new THREE.Vector3(0.3, -1, 0.35) },
    { id: 'mics', pos: new THREE.Vector3(-(BAND.ax + CUP_OFFSET + 1.95), CUP_Y + 3.35, 0), normal: new THREE.Vector3(-1, 0.2, 0.1) },
  ];

  return {
    group,
    hotspots,
    mats,
    setFinish,
    setCushion,
    setEngraving,
    setExplode,
    setSwivel,
    update,
    get state() {
      return { finish: finishName, cushion: cushionType, engraving: engravingText, explode };
    },
  };
}

export function createStudio(renderer, scene, { envIntensity = 1, keyIntensity = 2.2, rimIntensity = 1.6 } = {}) {
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const env = pmrem.fromScene(envScene, 0.03).texture;
  scene.environment = env;
  scene.environmentIntensity = envIntensity;
  envScene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  pmrem.dispose();
  const key = new THREE.DirectionalLight('#ffffff', keyIntensity);
  key.position.set(-14, 22, 18);
  const rim = new THREE.DirectionalLight('#ffffff', rimIntensity);
  rim.position.set(16, 10, -20);
  const fill = new THREE.HemisphereLight('#ffffff', '#303030', 0.35);
  scene.add(key, rim, fill);
  return { key, rim, fill, env };
}

export function createShadow(opacity = 0.5) {
  const c = canvas(512, 256);
  const g = c.getContext('2d');
  const blob = (x, y, rx, ry, a) => {
    g.save();
    g.translate(x, y);
    g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(0,0,0,${a})`);
    gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.45})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 1, 0, TAU);
    g.fill();
    g.restore();
  };
  blob(256, 128, 250, 100, 0.55);
  blob(256 - 150, 128, 70, 70, 0.85);
  blob(256 + 150, 128, 70, 70, 0.85);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity, color: '#000000' });
  mat.color.set('#ffffff');
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(27, 13.5), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = CUP_Y - CUP.a - 0.05;
  mesh.renderOrder = -1;
  return mesh;
}

export const LAYOUT = { CUP, BAND, CUP_Y, CUP_OFFSET };
export { superOutline, ovalSweep, ovalDisk, roundedRect, pathSweep, grainTexture };

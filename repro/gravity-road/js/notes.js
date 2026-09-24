// The melody as objects on the road: floating ink notes, their heads printed on the staff,
// watercolour blooms left where a note was played, splashes and little notes leaving the radio.
import * as THREE from 'three';
import { HW, NOTE_LIFT } from './config.js';
import { basicMaterial, noteDecalMaterial } from './materials.js';
import { makeFrame, appendRoadStrip, stripGeometry } from './track.js';

export function createBloom(track) {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 64;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return { canvas, ctx: canvas.getContext('2d'), tex, L: track.L };
}

const INK = 0x221d2b;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpE = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class NoteField {
  constructor(scene, track, song, bloom) {
    this.track = track;
    this.list = song.notes;
    this.bloom = bloom;
    this.nextIdx = -1;
    const F = makeFrame();
    const geo = {
      headF: new THREE.SphereGeometry(1, 18, 12).scale(0.63, 0.44, 0.26).rotateZ(0.36),
      headH: new THREE.TorusGeometry(0.47, 0.135, 8, 22).scale(1.2, 0.85, 1).rotateZ(0.36),
      stem: new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6).translate(0.58, 1.36, 0),
      dot: new THREE.SphereGeometry(0.16, 8, 6).translate(1.02, 0.24, 0),
    };
    this.list.forEach((n, i) => {
      const g = new THREE.Group();
      const mat = basicMaterial({ color: INK, id: 70 + (i % 18) });
      g.add(new THREE.Mesh(n.type === 0 ? geo.headF : geo.headH, mat));
      g.add(new THREE.Mesh(geo.stem, mat));
      if (n.type === 2) g.add(new THREE.Mesh(geo.dot, mat));
      track.frame(n.s, F);
      g.quaternion.setFromRotationMatrix(tmpM.makeBasis(F.b, F.n, F.t.clone().negate()));
      g.position.copy(F.p).addScaledVector(F.b, n.x).addScaledVector(F.n, NOTE_LIFT);
      scene.add(g);
      Object.assign(n, {
        obj: g, mat, basePos: g.position.clone(), up: F.n.clone(), fwd: F.t.clone(), right: F.b.clone(),
        state: 'fresh', gpos: 0, pendingVisual: false, anim: -1, animKind: '',
      });
    });

    // note heads (and, once the road is musical enough, stems) printed on the staff
    const arr = { pos: [], nor: [], uv: [], idx: [] };
    const aNote = [];
    const aLocal = [];
    for (const n of this.list) {
      const up = n.pos < 4 ? 1 : -1;
      const x0 = up > 0 ? n.x - 5 : n.x - 1.3;
      const x1 = up > 0 ? n.x + 1.3 : n.x + 5;
      const m = track.musicness(n.s);
      appendRoadStrip(arr, track, n.s - 1.6, n.s + 1.6, x0, x1, 0.04, 3, (u, j) => [u, j], (a, u, j) => {
        aNote.push(n.index, n.type, up, m);
        aLocal.push(-1.6 + 3.2 * u, (j ? x1 : x0) - n.x);
      });
    }
    this.stateData = new Uint8Array(this.list.length * 4);
    const c = new THREE.Color();
    this.list.forEach((n, i) => {
      c.setHex(n.color);
      this.stateData.set([c.r * 255, c.g * 255, c.b * 255, 0], i * 4);
    });
    this.stateTex = new THREE.DataTexture(this.stateData, this.list.length, 1, THREE.RGBAFormat);
    this.stateTex.needsUpdate = true;
    this.decalMat = noteDecalMaterial(this.stateTex, this.list.length);
    const decals = new THREE.Mesh(stripGeometry(arr, { aNote: [aNote, 4], aLocal: [aLocal, 2] }), this.decalMat);
    decals.renderOrder = 1;
    decals.frustumCulled = false;
    scene.add(decals);

    // splashes
    const pc = 360;
    this.pMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.34), basicMaterial({ color: 0xffffff, id: 90, flat: true }), pc);
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < pc; i++) { this.pMesh.setMatrixAt(i, ZERO); this.pMesh.setColorAt(i, white); }
    this.pMesh.frustumCulled = false;
    scene.add(this.pMesh);
    this.parts = Array.from({ length: pc }, () => ({
      life: 1, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), grav: new THREE.Vector3(),
      rot: new THREE.Vector3(), spin: new THREE.Vector3(), size: 1,
    }));
    this.pNext = 0;
    this.pActive = 0;

    // little notes that float off the radio
    this.glyphs = [];
    const gMat = basicMaterial({ color: INK, id: 91 });
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo.headF, gMat));
      g.add(new THREE.Mesh(geo.stem, gMat));
      g.visible = false;
      scene.add(g);
      this.glyphs.push({ g, life: 0, max: 1.5, vel: new THREE.Vector3(), active: false, spin: 0 });
    }
    this.gNext = 0;
  }

  setState(n, a) {
    this.stateData[n.index * 4 + 3] = a;
    this.stateTex.needsUpdate = true;
  }

  judge(n, hit, gpos) {
    n.state = hit ? 'hit' : 'miss';
    n.gpos = gpos;
    n.pendingVisual = true;
    this.setState(n, hit ? 128 : 255);
    if (hit) this.paintBloom(n);
  }

  reset(n) {
    n.state = 'fresh';
    n.pendingVisual = false;
    n.anim = -1;
    n.obj.visible = true;
    n.obj.scale.setScalar(1);
    n.obj.position.copy(n.basePos);
    n.mat.uniforms.uTintAmt.value = 0;
    this.setState(n, 0);
  }

  resetAll() {
    for (const n of this.list) this.reset(n);
    this.bloom.ctx.clearRect(0, 0, this.bloom.canvas.width, this.bloom.canvas.height);
    this.bloom.tex.needsUpdate = true;
  }

  fadeBlooms(s0, s1) {
    const g = this.bloom.ctx, W = this.bloom.canvas.width, H = this.bloom.canvas.height;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(s0 / this.bloom.L * W, 0, (s1 - s0) / this.bloom.L * W, H);
    g.restore();
    this.bloom.tex.needsUpdate = true;
  }

  paintBloom(n) {
    const g = this.bloom.ctx, W = this.bloom.canvas.width, H = this.bloom.canvas.height;
    const cx = n.s / this.bloom.L * W;
    const cy = (1 - (n.x + HW) / (2 * HW)) * H;
    const rx = 1.7 * W / this.bloom.L;
    const ry = 1.7 * H / (2 * HW);
    const c = new THREE.Color(n.color);
    const rgba = (a) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
    const blob = (x, y, r, a) => {
      g.save();
      g.translate(x, y);
      g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, rgba(0.2 * a));
      gr.addColorStop(0.62, rgba(0.36 * a));
      gr.addColorStop(0.86, rgba(0.62 * a));
      gr.addColorStop(1, rgba(0));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    blob(cx, cy, rx, 1);
    for (let k = 0; k < 4; k++) {
      const a = Math.random() * Math.PI * 2, r = rx * (0.9 + Math.random() * 0.8);
      blob(cx + Math.cos(a) * r, cy + Math.sin(a) * r * (ry / rx), rx * (0.18 + Math.random() * 0.22), 0.9);
    }
    this.bloom.tex.needsUpdate = true;
  }

  burst(n, speed) {
    const col = new THREE.Color(n.color);
    const inkC = new THREE.Color(0x2a2433);
    const light = col.clone().lerp(new THREE.Color(1, 1, 1), 0.45);
    for (let k = 0; k < 12; k++) {
      const i = this.pNext;
      this.pNext = (this.pNext + 1) % this.parts.length;
      const p = this.parts[i];
      p.life = 0;
      p.max = 0.55 + Math.random() * 0.45;
      p.pos.copy(n.obj.position);
      const rx = Math.random() * 2 - 1, ry = Math.random(), rz = Math.random() * 2 - 1;
      p.vel.copy(n.right).multiplyScalar(rx * 7).addScaledVector(n.up, 2 + ry * 7).addScaledVector(n.fwd, rz * 4 + speed * 0.6);
      p.grav.copy(n.up).multiplyScalar(-22);
      p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      p.spin.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
      p.size = 0.3 + Math.random() * 0.45;
      this.pMesh.setColorAt(i, k < 3 ? inkC : (k % 3 === 0 ? light : col));
    }
    this.pMesh.instanceColor.needsUpdate = true;
    this.pActive = 1;
  }

  emitGlyph(pos, up, fwd, speed) {
    const gl = this.glyphs[this.gNext];
    this.gNext = (this.gNext + 1) % this.glyphs.length;
    gl.active = true;
    gl.life = 0;
    gl.g.visible = true;
    gl.g.position.copy(pos);
    gl.g.up.copy(up);
    gl.vel.copy(up).multiplyScalar(3.5).addScaledVector(fwd, speed * 0.55);
    gl.spin = (Math.random() - 0.5) * 3;
    gl.fwd = fwd.clone();
    gl.upv = up.clone();
  }

  setNext(idx) {
    if (this.nextIdx === idx) return;
    if (this.nextIdx >= 0) this.list[this.nextIdx].mat.uniforms.uTintAmt.value = 0;
    this.nextIdx = idx;
    this.decalMat.uniforms.uNext.value = idx;
    if (idx >= 0) this.list[idx].mat.uniforms.uTint.value.setHex(this.list[idx].color);
  }

  update(dt, t, odo, car) {
    const L = this.track.L;
    for (const n of this.list) {
      if (n.pendingVisual && odo >= n.gpos - 0.6) {
        n.pendingVisual = false;
        n.anim = 0;
        n.animKind = n.state;
        if (n.state === 'hit') {
          this.burst(n, car.speed);
          this.emitGlyph(car.radioPos, car.up, car.fwd, car.speed);
        } else {
          n.mat.uniforms.uTint.value.setRGB(0.62, 0.6, 0.66);
        }
      }
      if (n.state !== 'fresh' && !n.pendingVisual && odo >= n.gpos + L * 0.5) this.reset(n);
      if (n.anim >= 0) {
        n.anim += dt;
        const a = n.anim;
        if (n.animKind === 'hit') {
          const sc = a < 0.05 ? 1 + a / 0.05 * 0.15 : 1.15 * (1 - (a - 0.05) / 0.15);
          if (sc <= 0.01) { n.obj.visible = false; n.anim = -1; } else n.obj.scale.setScalar(sc);
        } else {
          n.mat.uniforms.uTintAmt.value = Math.min(0.75, a * 4);
          n.obj.position.copy(n.basePos).addScaledVector(n.up, -1.6 * Math.min(a * 3, 1));
          n.obj.scale.setScalar(Math.max(0.05, 1 - a * 2.4));
          if (a > 0.4) { n.obj.visible = false; n.anim = -1; }
        }
      } else if (n.state === 'fresh') {
        n.obj.position.copy(n.basePos).addScaledVector(n.up, Math.sin(t * 2.2 + n.index * 0.7) * 0.14);
      }
    }
    if (this.nextIdx >= 0) {
      const nn = this.list[this.nextIdx];
      if (nn.state === 'fresh') nn.mat.uniforms.uTintAmt.value = 0.3 + 0.22 * Math.sin(t * 9);
    }
    // splashes
    if (this.pActive) {
      let any = false;
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i];
        if (p.life >= p.max) continue;
        p.life += dt;
        if (p.life >= p.max) { this.pMesh.setMatrixAt(i, ZERO); continue; }
        any = true;
        p.vel.addScaledVector(p.grav, dt);
        p.pos.addScaledVector(p.vel, dt);
        p.rot.addScaledVector(p.spin, dt);
        const k = p.life / p.max;
        tmpS.setScalar(p.size * (1 - k * k));
        tmpQ.setFromEuler(tmpE.set(p.rot.x, p.rot.y, p.rot.z));
        tmpM.compose(p.pos, tmpQ, tmpS);
        this.pMesh.setMatrixAt(i, tmpM);
      }
      this.pMesh.instanceMatrix.needsUpdate = true;
      if (!any) this.pActive = 0;
    }
    // radio glyphs
    for (const gl of this.glyphs) {
      if (!gl.active) continue;
      gl.life += dt;
      if (gl.life >= gl.max) { gl.active = false; gl.g.visible = false; continue; }
      gl.vel.multiplyScalar(1 - dt * 0.9);
      gl.g.position.addScaledVector(gl.vel, dt);
      const k = gl.life / gl.max;
      gl.g.scale.setScalar(0.42 * Math.sin(Math.PI * Math.min(1, k * 1.3 + 0.05)));
      tmpM.makeBasis(new THREE.Vector3().crossVectors(gl.fwd, gl.upv), gl.upv, gl.fwd.clone().negate());
      gl.g.quaternion.setFromRotationMatrix(tmpM);
      gl.g.rotateZ(Math.sin(gl.life * 5) * 0.4 + gl.spin * k);
    }
  }
}

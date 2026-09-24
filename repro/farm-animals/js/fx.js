import * as THREE from 'three';
import { rand, TAU } from './util.js';

/* Little hand-painted particle sprites, drawn once on canvases */
function makeTextures() {
  const T = {};
  const mk = (name, draw, size = 64) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    draw(g, size);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    T[name] = tex;
  };
  const ink = 'rgba(74, 59, 44, 0.85)';
  mk('heart', (g, s) => {
    g.translate(s / 2, s / 2 + 3);
    g.beginPath();
    g.moveTo(0, 18);
    g.bezierCurveTo(-26, 2, -20, -22, 0, -10);
    g.bezierCurveTo(20, -22, 26, 2, 0, 18);
    const grd = g.createRadialGradient(-6, -8, 2, 0, 0, 26);
    grd.addColorStop(0, '#f2a5ae'); grd.addColorStop(0.7, '#d9606e'); grd.addColorStop(1, '#c24d5c');
    g.fillStyle = grd; g.fill();
    g.lineWidth = 2.2; g.strokeStyle = ink; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.ellipse(-9, -7, 4, 2.5, -0.6, 0, TAU); g.fill();
  });
  mk('note', (g, s) => {
    g.fillStyle = '#5a4634';
    g.strokeStyle = '#5a4634';
    g.lineWidth = 3.2;
    g.beginPath(); g.ellipse(22, 44, 9, 6.5, -0.4, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(30, 42); g.lineTo(30, 12); g.stroke();
    g.beginPath(); g.moveTo(30, 12); g.quadraticCurveTo(44, 16, 46, 30); g.lineWidth = 4; g.stroke();
  });
  mk('star', (g, s) => {
    g.translate(s / 2, s / 2);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 10 : 24, a = (i / 10) * TAU - Math.PI / 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = '#f0cd5e'; g.fill();
    g.lineWidth = 2; g.strokeStyle = ink; g.stroke();
  });
  mk('sparkle', (g, s) => {
    g.translate(s / 2, s / 2);
    g.fillStyle = '#fff6d6';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 5 : 26, a = (i / 8) * TAU;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(200, 160, 60, 0.8)'; g.lineWidth = 1.5; g.stroke();
  });
  const puff = (c0, c1) => (g, s) => {
    for (let i = 0; i < 5; i++) {
      const x = s / 2 + (Math.random() - 0.5) * 14, y = s / 2 + (Math.random() - 0.5) * 14, r = 14 + Math.random() * 10;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, c0); grd.addColorStop(1, c1);
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  };
  mk('puff', puff('rgba(250, 245, 232, 0.8)', 'rgba(250, 245, 232, 0)'));
  mk('smoke', puff('rgba(215, 212, 206, 0.75)', 'rgba(215, 212, 206, 0)'));
  mk('dust', puff('rgba(200, 180, 140, 0.8)', 'rgba(200, 180, 140, 0)'));
  mk('drop', (g, s) => {
    g.translate(s / 2, s / 2);
    g.beginPath(); g.moveTo(0, -20); g.bezierCurveTo(14, -2, 14, 16, 0, 16); g.bezierCurveTo(-14, 16, -14, -2, 0, -20);
    g.fillStyle = '#8fb6c9'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(60, 90, 110, 0.8)'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-4, 3, 3, 5, 0.3, 0, TAU); g.fill();
  });
  mk('crumb', (g, s) => {
    g.strokeStyle = '#cdae5c'; g.lineWidth = 4; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) { g.beginPath(); const a = Math.random() * TAU; g.moveTo(32 - Math.cos(a) * 18, 32 - Math.sin(a) * 18); g.lineTo(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18); g.stroke(); }
  });
  mk('crunch', (g, s) => {
    g.fillStyle = '#f4ead0';
    g.beginPath(); g.arc(32, 32, 12, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(196, 71, 59, 0.9)'; g.lineWidth = 3; g.stroke();
  });
  mk('leaf', (g, s) => {
    g.translate(s / 2, s / 2); g.rotate(0.6);
    g.beginPath(); g.ellipse(0, 0, 10, 22, 0, 0, TAU); g.fillStyle = '#8aa556'; g.fill();
    g.strokeStyle = 'rgba(60, 80, 40, 0.8)'; g.lineWidth = 1.5; g.stroke();
    g.beginPath(); g.moveTo(0, -20); g.lineTo(0, 20); g.stroke();
  });
  mk('ripple', (g, s) => {
    g.strokeStyle = 'rgba(240, 248, 250, 0.9)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(32, 32, 26, 26, 0, 0, TAU); g.stroke();
  });
  return T;
}

export class FX {
  constructor(scene, camera, labelsEl) {
    this.scene = scene;
    this.camera = camera;
    this.tex = makeTextures();
    this.pool = [];
    this.live = [];
    this.labelsEl = labelsEl;
    this.bubbles = [];
    this.prompt = null;
    this.promptState = null;
    this._v = new THREE.Vector3();
  }

  _sprite(kind) {
    let s = this.pool.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: true }));
      s.renderOrder = 5;
      s.userData.p = {};
    }
    s.material.map = this.tex[kind] || this.tex.puff;
    s.material.needsUpdate = true;
    s.material.opacity = 1;
    s.material.color.set(0xffffff);
    s.material.rotation = 0;
    s.visible = true;
    this.scene.add(s);
    return s;
  }

  spawn(kind, pos, o = {}) {
    const s = this._sprite(kind);
    const p = s.userData.p;
    p.vel = o.vel ? o.vel.clone() : new THREE.Vector3(rand(-0.4, 0.4), rand(0.8, 1.6), rand(-0.4, 0.4));
    p.life = p.max = o.life ?? 1.4;
    p.size = o.size ?? 0.4;
    p.grow = o.grow ?? 0;
    p.grav = o.grav ?? -0.6;
    p.drag = o.drag ?? 0.6;
    p.spin = o.spin ?? rand(-1.5, 1.5);
    p.fadeIn = o.fadeIn ?? 0.08;
    p.alpha = o.alpha ?? 1;
    p.wobble = o.wobble ?? 0;
    p.t = 0;
    s.position.copy(pos);
    s.scale.setScalar(p.size);
    if (o.color) s.material.color.set(o.color);
    this.live.push(s);
    return s;
  }

  burst(kind, pos, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.5;
      const sp = o.speed ?? 1.4;
      this.spawn(kind, pos, {
        ...o,
        vel: new THREE.Vector3(Math.cos(a) * sp * rand(0.6, 1.1), (o.up ?? 1.6) * rand(0.7, 1.2), Math.sin(a) * sp * rand(0.6, 1.1)),
        size: (o.size ?? 0.35) * rand(0.8, 1.2),
      });
    }
  }

  hearts(pos, n = 4, size = 0.38) { this.burst('heart', pos, n, { size, up: 1.4, speed: 0.6, grav: -0.2, life: 1.8, drag: 1.2, wobble: 2 }); }
  notes(pos, n = 3) { this.burst('note', pos, n, { size: 0.36, up: 1.2, speed: 0.7, grav: -0.1, life: 1.9, drag: 1, wobble: 3 }); }
  stars(pos, n = 7) { this.burst('star', pos, n, { size: 0.3, up: 2.2, speed: 2.2, grav: -4, life: 0.9, drag: 1.5 }); }
  dust(pos, n = 6, size = 0.6) { this.burst('dust', pos, n, { size, up: 0.5, speed: 1.6, grav: 0.2, life: 0.8, grow: 1.2, alpha: 0.7, drag: 3 }); }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i];
      const p = s.userData.p;
      p.t += dt;
      p.life -= dt;
      if (p.life <= 0) {
        s.visible = false;
        this.scene.remove(s);
        this.live.splice(i, 1);
        this.pool.push(s);
        continue;
      }
      p.vel.y += p.grav * dt;
      p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      s.position.addScaledVector(p.vel, dt);
      if (p.wobble) s.position.x += Math.sin(p.t * p.wobble * 2) * dt * 0.3;
      const k = p.t / p.max;
      s.scale.setScalar(p.size * (1 + p.grow * k) * Math.min(1, p.t / 0.12 + 0.4));
      s.material.rotation += p.spin * dt;
      const fin = Math.min(1, p.t / p.fadeIn);
      const fout = Math.min(1, p.life / (p.max * 0.35));
      s.material.opacity = p.alpha * fin * fout;
    }
  }

  /* ---------------------------------------------------------------- HTML labels */

  say(target, text, { dur = 1.8, me = false, big = false, offset = 0.35 } = {}) {
    for (const b of this.bubbles) if (b.target === target) { b.t = Math.max(b.t, b.life - 0.3); }
    const el = document.createElement('div');
    el.className = 'bubble' + (me ? ' me' : '') + (big ? ' big' : '');
    el.textContent = text;
    this.labelsEl.appendChild(el);
    const b = { el, target, t: 0, life: dur, offset, shown: false };
    this.bubbles.push(b);
    return b;
  }

  setPrompt(target, verb, who) {
    if (!this.prompt) {
      this.prompt = document.createElement('div');
      this.prompt.className = 'prompt pulse';
      this.prompt.innerHTML = '<kbd class="wide">Space</kbd><span class="verb"></span>';
      this.labelsEl.appendChild(this.prompt);
      this.promptVerb = this.prompt.querySelector('.verb');
    }
    const key = target ? verb + '|' + (who || '') : null;
    if (key !== this.promptState) {
      this.promptState = key;
      if (target) this.promptVerb.innerHTML = who ? `${verb} <span class="who">${who}</span>` : verb;
    }
    this.promptTarget = target;
    this.prompt.classList.toggle('show', !!target);
  }

  _project(target, offset, w, h) {
    const v = this._v;
    if (target.isVector3) v.copy(target);
    else if (target.getLabelPos) target.getLabelPos(v);
    else v.copy(target.position);
    v.y += offset;
    const dist = v.distanceTo(this.camera.position);
    v.project(this.camera);
    if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return null;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, dist };
  }

  updateLabels(dt, w, h, veil = 0) {
    // labels fade in with the scene when the page washes back from plain paper
    const op = veil > 0.02 ? (1 - veil).toFixed(2) : '';
    if (op !== this._veilOp) { this._veilOp = op; this.labelsEl.style.opacity = op; }
    // a friend's speech bubble stacks above the Space prompt instead of covering it
    let lift = 0;
    if (this.prompt && this.promptTarget) {
      const p = this._project(this.promptTarget, 0.55, w, h);
      if (p) {
        this.prompt.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
        this.prompt.classList.add('show');
        lift = this.prompt.offsetHeight + 10;
      } else this.prompt.classList.remove('show');
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t += dt;
      if (b.t > b.life) {
        b.el.classList.remove('show');
        if (b.t > b.life + 0.3) { b.el.remove(); this.bubbles.splice(i, 1); }
        continue;
      }
      const p = this._project(b.target, b.offset + Math.min(b.t * 0.6, 0.25), w, h);
      if (!p || p.dist > 42) { b.el.classList.remove('show'); continue; }
      const sc = Math.max(0.6, Math.min(1.1, 9 / Math.max(p.dist, 1) + 0.45));
      const y = b.target === this.promptTarget ? p.y - lift : p.y;
      b.el.style.transform = `translate(${p.x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${sc.toFixed(3)})`;
      if (!b.el.classList.contains('show')) b.el.classList.add('show');
    }
  }

  clearLabels() {
    for (const b of this.bubbles) b.el.remove();
    this.bubbles.length = 0;
    this.setPrompt(null);
  }
}

// Screen-space effects drawn on a 2D canvas above the WebGL scene.
export class FX2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    this.crack = null;
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.dirty = true;
  }

  resize(w, h) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.dirty = true;
  }

  add(item) {
    item.t = 0;
    this.items.push(item);
    return item;
  }

  clear() {
    this.items = [];
    this.crack = null;
    this.dirty = true;
  }

  flash(color = '#fff', dur = 0.4, peak = 1) {
    return this.add({
      dur,
      draw: (g, it) => {
        const k = it.t / it.dur;
        g.globalAlpha = peak * Math.pow(1 - k, 2);
        g.fillStyle = color;
        g.fillRect(0, 0, this.w, this.h);
        g.globalAlpha = 1;
      },
    });
  }

  // Anime-style impact frames: a black frame, then a white one.
  impact() {
    return this.add({
      dur: 0.14,
      draw: (g, it) => {
        g.fillStyle = it.t < 0.06 ? '#000' : '#fff';
        g.globalAlpha = it.t < 0.06 ? 0.92 : 0.85 * (1 - (it.t - 0.06) / 0.08);
        g.fillRect(0, 0, this.w, this.h);
        g.globalAlpha = 1;
      },
    });
  }

  lightning(x0, y0, x1, y1, { color = '#bfe4ff', width = 1, life = 0.5 } = {}) {
    const main = bolt(x0, y0, x1, y1, Math.hypot(x1 - x0, y1 - y0) * 0.22, 7);
    const branches = [];
    for (let i = 0; i < 4; i++) {
      const p = main[Math.floor(main.length * (0.2 + Math.random() * 0.55))];
      const ang = Math.atan2(y1 - y0, x1 - x0) + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.7);
      const len = Math.hypot(x1 - x0, y1 - y0) * (0.15 + Math.random() * 0.25);
      branches.push(bolt(p[0], p[1], p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len, len * 0.3, 5));
    }
    return this.add({
      dur: life,
      draw: (g, it) => {
        const k = it.t / it.dur;
        const on = it.t < 0.07 || (it.t > 0.11 && it.t < 0.17) || it.t > 0.22;
        if (!on) return;
        const fade = it.t > 0.22 ? 1 - (it.t - 0.22) / (it.dur - 0.22) : 1;
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.lineJoin = 'round';
        g.lineCap = 'round';
        const passes = [[26, 0.12], [11, 0.3], [4, 0.75], [1.6, 1]];
        for (const [w, a] of passes) {
          g.globalAlpha = a * fade;
          g.strokeStyle = w < 3 ? '#ffffff' : color;
          g.lineWidth = w * width;
          strokePts(g, main);
          g.lineWidth = w * width * 0.5;
          branches.forEach((b) => strokePts(g, b));
        }
        g.restore();
        if (k < 0.1) {
          g.globalAlpha = 0.25 * (1 - k * 10);
          g.fillStyle = color;
          g.fillRect(0, 0, this.w, this.h);
          g.globalAlpha = 1;
        }
      },
    });
  }

  // Manga "concentration lines" converging on the centre.
  speedLines(dur, { color = 'rgba(255,255,255,0.9)', count = 120, inner = 0.3, cx = 0.5, cy = 0.5 } = {}) {
    let seedT = -1;
    let lines = [];
    return this.add({
      dur,
      draw: (g, it) => {
        if (it.t - seedT > 0.05) {
          seedT = it.t;
          lines = [];
          for (let i = 0; i < count; i++) {
            lines.push([Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.6, 0.003 + Math.random() * 0.011]);
          }
        }
        const fadeIn = Math.min(1, it.t / 0.12);
        const fadeOut = Math.min(1, (it.dur - it.t) / 0.3);
        const X = this.w * cx, Y = this.h * cy;
        const R = Math.hypot(this.w, this.h) * 0.6;
        const r0 = Math.min(this.w, this.h) * inner;
        g.save();
        g.globalAlpha = fadeIn * fadeOut;
        g.fillStyle = color;
        g.beginPath();
        for (const [a, rm, dw] of lines) {
          const ri = r0 * rm;
          g.moveTo(X + Math.cos(a - dw) * R, Y + Math.sin(a - dw) * R);
          g.lineTo(X + Math.cos(a + dw) * R, Y + Math.sin(a + dw) * R);
          g.lineTo(X + Math.cos(a) * ri, Y + Math.sin(a) * ri);
          g.closePath();
        }
        g.fill();
        g.restore();
      },
    });
  }

  cracks(cx, cy, level) {
    if (!this.crack) this.crack = makeCrack(cx, cy, Math.hypot(this.w, this.h));
    this.crack.level = level;
    this.crack.hit = 0;
    this.dirty = true;
  }

  shatter() {
    const c = this.crack;
    this.crack = null;
    const cx = c ? c.cx : this.w / 2, cy = c ? c.cy : this.h / 2;
    const shards = [];
    const unit = Math.min(this.w, this.h) / 720;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.7) * Math.hypot(this.w, this.h) * 0.45;
      const s = (10 + Math.pow(Math.random(), 2) * 55) * unit;
      const sp = (400 + Math.random() * 1100) * unit;
      shards.push({
        x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 250 * unit,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16,
        pts: [[0, -s], [s * (0.15 + Math.random() * 0.35), s * (0.3 + Math.random() * 0.5)], [-s * (0.15 + Math.random() * 0.35), s * (0.1 + Math.random() * 0.6)]],
        hue: Math.floor(Math.random() * 360),
      });
    }
    return this.add({
      dur: 1.1,
      draw: (g, it, dt) => {
        const k = it.t / it.dur;
        g.save();
        for (const s of shards) {
          s.vy += 1400 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.rot += s.vr * dt;
          g.save();
          g.translate(s.x, s.y);
          g.rotate(s.rot);
          g.globalAlpha = (1 - k) * 0.9;
          g.beginPath();
          g.moveTo(...s.pts[0]);
          g.lineTo(...s.pts[1]);
          g.lineTo(...s.pts[2]);
          g.closePath();
          g.fillStyle = `hsla(${s.hue},95%,78%,0.32)`;
          g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.95)';
          g.lineWidth = 1.2;
          g.stroke();
          g.restore();
        }
        g.restore();
      },
    });
  }

  update(dt) {
    for (const it of this.items) it.t += dt;
    this.items = this.items.filter((it) => it.t < it.dur);
    if (this.crack) this.crack.hit += dt;
    const active = this.items.length > 0 || this.crack;
    if (!active && !this.dirty) return;
    const g = this.ctx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    if (this.crack) drawCrack(g, this.crack);
    for (const it of this.items) it.draw(g, it, dt);
    this.dirty = active;
  }
}

function bolt(x0, y0, x1, y1, disp, depth) {
  let pts = [[x0, y0], [x1, y1]];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const off = (Math.random() - 0.5) * disp;
      next.push([(ax + bx) / 2 - (dy / len) * off, (ay + by) / 2 + (dx / len) * off]);
      next.push(pts[i + 1]);
    }
    pts = next;
    disp *= 0.55;
  }
  return pts;
}

function strokePts(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
}

function makeCrack(cx, cy, diag) {
  const n = 13;
  const rays = [];
  for (let i = 0; i < n; i++) {
    let a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const pts = [[cx, cy]];
    let x = cx, y = cy, r = 0;
    while (r < diag) {
      const step = 26 + Math.random() * 46;
      a += (Math.random() - 0.5) * 0.32;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      r = Math.hypot(x - cx, y - cy);
      pts.push([x, y, r]);
    }
    rays.push(pts);
  }
  const rings = [];
  for (const R of [55, 120, 210, 330, 480]) {
    const ring = [];
    for (let i = 0; i < n; i++) {
      const pa = rays[i].find((p) => p[2] >= R) || rays[i][rays[i].length - 1];
      const pb = rays[(i + 1) % n].find((p) => p[2] >= R * (0.85 + Math.random() * 0.3)) || rays[(i + 1) % n][rays[(i + 1) % n].length - 1];
      if (Math.random() < 0.82) ring.push([pa, pb, R]);
    }
    rings.push(ring);
  }
  return { cx, cy, rays, rings, level: 1, hit: 0 };
}

function drawCrack(g, c) {
  const maxR = c.level === 1 ? 260 : 99999;
  g.save();
  g.lineJoin = 'round';
  // darker offset for depth, then bright edge
  for (const [col, w, ox] of [['rgba(0,0,0,0.45)', 3.5, 1.5], ['rgba(255,255,255,0.95)', 1.6, 0]]) {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    for (const ray of c.rays) {
      g.moveTo(ray[0][0] + ox, ray[0][1] + ox);
      for (let i = 1; i < ray.length; i++) {
        if (ray[i][2] > maxR) break;
        g.lineTo(ray[i][0] + ox, ray[i][1] + ox);
      }
    }
    for (const ring of c.rings) {
      for (const [a, b, R] of ring) {
        if (R > maxR) continue;
        g.moveTo(a[0] + ox, a[1] + ox);
        g.lineTo((a[0] + b[0]) / 2 + 6 + ox, (a[1] + b[1]) / 2 - 4 + ox);
        g.lineTo(b[0] + ox, b[1] + ox);
      }
    }
    g.stroke();
  }
  // glassy highlights on a few cells
  g.globalCompositeOperation = 'lighter';
  const ring0 = c.rings[c.level === 1 ? 1 : 2];
  ring0.forEach(([a, b], i) => {
    if (i % 3) return;
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.beginPath();
    g.moveTo(c.cx, c.cy);
    g.lineTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.closePath();
    g.fill();
  });
  const k = Math.max(0, 1 - c.hit / 0.25);
  const glow = g.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, 160 + c.level * 60);
  glow.addColorStop(0, `rgba(255,255,255,${0.35 + 0.5 * k})`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(c.cx - 400, c.cy - 400, 800, 800);
  g.restore();
}

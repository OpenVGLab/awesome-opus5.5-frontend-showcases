// A faint honeycomb drawn on a canvas behind the dark sections. Random cells glow now and then;
// ripple(x, y) sends a wave of light through the comb (used when the hive is "consulted").
export class HexField {
  constructor(canvas, { size = 34, rgb = '244,175,45', twinkle = true } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = size;
    this.rgb = rgb;
    this.cells = [];
    this.glows = [];
    this.ripples = [];
    this.visible = false;
    this.raf = 0;
    this.w = 0;
    this.h = 0;
    this.base = document.createElement('canvas');
    this.frame = this.frame.bind(this);
    const host = canvas.parentElement;
    new ResizeObserver(() => this.resize()).observe(host);
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.kick();
    }, { rootMargin: '120px' }).observe(host);
    if (twinkle && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInterval(() => { if (this.visible && !document.hidden) this.twinkle(); }, 380);
    }
  }

  resize() {
    const host = this.canvas.parentElement;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || (w === this.w && h === this.h)) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w; this.h = h; this.dpr = dpr;
    for (const c of [this.canvas, this.base]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const s = this.size, cw = Math.sqrt(3) * s, rh = 1.5 * s;
    this.cells = [];
    for (let row = -1; (row - 1) * rh < h; row++) {
      for (let col = -1; (col - 1) * cw < w; col++) {
        this.cells.push({ x: col * cw + (row & 1 ? cw / 2 : 0), y: row * rh });
      }
    }
    const b = this.base.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, w, h);
    b.strokeStyle = `rgba(${this.rgb},.09)`;
    b.lineWidth = 1;
    b.beginPath();
    for (const c of this.cells) this.hex(b, c.x, c.y, s * 0.94);
    b.stroke();
    this.kick();
  }

  hex(ctx, x, y, r) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  twinkle() {
    if (!this.cells.length) return;
    const c = this.cells[(Math.random() * this.cells.length) | 0];
    this.glows.push({ c, t0: performance.now(), dur: 1600 + Math.random() * 1800, a: 0.35 + Math.random() * 0.45 });
    this.kick();
  }

  ripple(x, y) {
    this.ripples.push({ x, y, t0: performance.now() });
    this.kick();
  }

  kick() {
    if (!this.raf && this.visible && this.w) this.raf = requestAnimationFrame(this.frame);
  }

  frame(now) {
    this.raf = 0;
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.glows = this.glows.filter((g) => now - g.t0 < g.dur);
    for (const g of this.glows) this.lit(g.c, Math.sin(((now - g.t0) / g.dur) * Math.PI) * g.a);

    this.ripples = this.ripples.filter((r) => now - r.t0 < 2600);
    for (const r of this.ripples) {
      const t = (now - r.t0) / 1000;
      const rad = t * 900, fade = 1 - t / 2.6, band = 110;
      for (const c of this.cells) {
        const d = Math.hypot(c.x - r.x, c.y - r.y);
        const k = Math.exp(-(((d - rad) / band) ** 2));
        if (k > 0.03) this.lit(c, k * fade * 0.95);
      }
    }
    if (this.glows.length || this.ripples.length) this.kick();
  }

  lit(c, a) {
    const ctx = this.ctx;
    ctx.beginPath();
    this.hex(ctx, c.x, c.y, this.size * 0.94 - 1);
    ctx.fillStyle = `rgba(${this.rgb},${(a * 0.16).toFixed(3)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${this.rgb},${Math.min(1, a).toFixed(3)})`;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
}

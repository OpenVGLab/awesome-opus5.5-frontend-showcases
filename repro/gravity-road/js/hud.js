// Ink-on-paper HUD: the street card with its melody as a little score, the note count, captions.
import { BAR_BEATS } from './config.js';
import { drawClef } from './paint.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(song) {
    this.song = song;
    this.el = {
      hud: $('hud'), no: $('st-no'), name: $('st-name'), tag: $('st-tag'), staff: $('staff'),
      hits: $('hits'), total: $('total'), lap: $('lap'), bpm: $('bpm'), auto: $('auto'),
      caption: $('caption'), capNo: $('cap-no'), capName: $('cap-name'), capTag: $('cap-tag'),
      toast: $('toast'), hint: $('hint'),
    };
    this.el.total.textContent = song.notes.length;
    this.street = -1;
    this.capTimer = 0;
    this.toastTimer = 0;
    this.dirty = true;
    this.progress = 0;
    this.ctx = this.el.staff.getContext('2d');
  }

  show(v) { this.el.hud.classList.toggle('on', v); }

  setStreet(i, withCaption) {
    const st = this.song.streets[i];
    this.street = i;
    this.el.no.textContent = `Nº ${i + 1} · ${st.fm.toFixed(1)} FM`;
    this.el.name.textContent = st.name;
    this.el.tag.textContent = `${st.key} · ${st.tag}`;
    this.dirty = true;
    if (withCaption) {
      this.el.capNo.textContent = `Nº ${i + 1} · now tuned to ${st.fm.toFixed(1)} FM`;
      this.el.capName.textContent = st.name;
      this.el.capTag.textContent = st.tag;
      this.el.caption.classList.add('on');
      this.capTimer = 3.2;
    }
  }

  toast(text, secs = 3.5) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('on');
    this.toastTimer = secs;
  }

  setScore(hits, lap) { this.el.hits.textContent = hits; this.el.lap.textContent = Math.max(1, lap); }
  setBpm(bpm) { this.el.bpm.textContent = Math.round(bpm); }
  setAuto(on) { this.el.auto.classList.toggle('on', on); }

  update(dt, progressBeats) {
    if (this.capTimer > 0) { this.capTimer -= dt; if (this.capTimer <= 0) this.el.caption.classList.remove('on'); }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.el.toast.classList.remove('on'); }
    if (Math.abs(progressBeats - this.progress) > 0.04) { this.progress = progressBeats; this.dirty = true; }
    if (this.dirty && this.street >= 0) { this.dirty = false; this.drawStaff(); }
  }

  drawStaff() {
    const cv = this.el.staff;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = cv.clientWidth || 320, cssH = cv.clientHeight || 76;
    if (cv.width !== Math.round(cssW * dpr)) { cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);
    const st = this.song.streets[this.street];
    const gap = 6.5;
    const bottom = cssH / 2 + gap * 2;
    const x0 = 34, x1 = cssW - 8;
    g.strokeStyle = 'rgba(34,29,44,0.85)';
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(4, bottom - i * gap); g.lineTo(x1, bottom - i * gap); g.stroke(); }
    drawClef(g, 17, bottom - gap * 6.1, gap * 8.2, '#221d2c');
    if (st.sharps.includes('F')) {
      const sy = bottom - 4 * gap;
      g.lineWidth = 1;
      for (const sx of [27.5, 30]) { g.beginPath(); g.moveTo(sx, sy - 5); g.lineTo(sx, sy + 5); g.stroke(); }
      g.lineWidth = 1.6;
      for (const dy of [-1.8, 2]) { g.beginPath(); g.moveTo(26, sy + dy + 0.8); g.lineTo(31.5, sy + dy - 0.8); g.stroke(); }
    }
    const beats = st.beats - BAR_BEATS;
    const bx = (b) => x0 + (b - st.startBeat - BAR_BEATS) / beats * (x1 - x0 - 6);
    for (let b = st.startBeat + BAR_BEATS; b <= st.startBeat + st.beats; b += BAR_BEATS) {
      g.beginPath(); g.moveTo(bx(b) - 4, bottom); g.lineTo(bx(b) - 4, bottom - gap * 4); g.stroke();
    }
    // playhead wash
    const p = this.progress;
    if (p > 0) {
      g.fillStyle = 'rgba(236,160,70,0.28)';
      const px = Math.min(x1, bx(st.startBeat + BAR_BEATS + p));
      g.fillRect(x0 - 4, bottom - gap * 5.2, Math.max(0, px - x0 + 4), gap * 6.4);
    }
    for (const n of st.notes) {
      const x = bx(n.beat) + 4;
      const y = bottom - n.pos * gap / 2;
      let col = '#221d2c';
      if (n.state === 'hit') col = '#' + n.color.toString(16).padStart(6, '0');
      else if (n.state === 'miss') col = 'rgba(34,29,44,0.25)';
      g.fillStyle = col; g.strokeStyle = col;
      g.lineWidth = 1.3;
      if (n.pos <= -1) { g.beginPath(); g.moveTo(x - 6, bottom + gap); g.lineTo(x + 6, bottom + gap); g.stroke(); }
      if (n.pos >= 10) { g.beginPath(); g.moveTo(x - 6, bottom - 5 * gap); g.lineTo(x + 6, bottom - 5 * gap); g.stroke(); }
      g.save(); g.translate(x, y); g.rotate(-0.35);
      g.beginPath(); g.ellipse(0, 0, 3.9, 2.8, 0, 0, Math.PI * 2);
      if (n.type === 0) g.fill(); else { g.lineWidth = 1.4; g.stroke(); }
      g.restore();
      g.lineWidth = 1.1;
      const upStem = n.pos < 4;
      g.beginPath();
      if (upStem) { g.moveTo(x + 3.6, y); g.lineTo(x + 3.6, y - gap * 3.3); } else { g.moveTo(x - 3.6, y); g.lineTo(x - 3.6, y + gap * 3.3); }
      g.stroke();
      if (n.type === 2) { g.beginPath(); g.arc(x + 7.5, y - 1.5, 1.4, 0, Math.PI * 2); g.fill(); }
    }
  }
}

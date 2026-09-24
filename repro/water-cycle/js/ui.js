import * as THREE from 'three';
import { STAGES, stageIndexAt } from './timeline.js';
import { TAU, wrap01 } from './util.js';

const SVG = 'http://www.w3.org/2000/svg';
const R = 40;
const angle = (p) => -Math.PI / 2 + TAU * p;
const pt = (a) => `${(R * Math.cos(a)).toFixed(2)} ${(R * Math.sin(a)).toFixed(2)}`;

function arc(p0, p1) {
  const a0 = angle(p0), a1 = angle(p1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${pt(a0)} A ${R} ${R} 0 ${large} 1 ${pt(a1)}`;
}

// After a mouse click, hand focus back to the page so Space and the arrow keys keep driving the
// loop instead of re-pressing the button. Keyboard activation (detail === 0) keeps focus.
const releaseFocus = (e) => { if (e.detail > 0) e.currentTarget.blur(); };

export function createUI({ labels, onJump, onPhase, onPlay, onLabels, onSound }) {
  const root = document.getElementById('labels');
  const els = labels.map((def) => {
    const el = document.createElement('div');
    el.className = 'tag';
    el.style.setProperty('--c', def.color);
    el.innerHTML = `<div class="tag-inner"><span class="tag-text">${def.text}</span><span class="tag-line"></span><span class="tag-dot"></span></div>`;
    root.appendChild(el);
    return el;
  });

  const arcsG = document.getElementById('dialArcs');
  const arcEls = STAGES.map((s, i) => {
    const end = i + 1 < STAGES.length ? STAGES[i + 1].start : 1;
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', arc(s.start + 0.012, end - 0.012));
    path.setAttribute('class', 'dial-arc');
    path.style.stroke = s.color;
    arcsG.appendChild(path);
    return path;
  });
  const knob = document.getElementById('dialKnob');
  const tail = document.getElementById('dialTail');
  const dialNum = document.getElementById('dialNum');
  const stageNum = document.getElementById('stageNum');
  const stageName = document.getElementById('stageName');
  const stageText = document.getElementById('stageText');
  const chips = document.getElementById('chips');
  const chipEls = STAGES.map((s, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.style.setProperty('--c', s.color);
    b.textContent = s.name;
    b.addEventListener('click', (e) => { onJump(i); releaseFocus(e); });
    chips.appendChild(b);
    return b;
  });

  const dial = document.getElementById('dial');
  dial.addEventListener('click', (e) => {
    const r = dial.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    onPhase(wrap01((Math.atan2(y, x) + Math.PI / 2) / TAU));
  });

  const btnPlay = document.getElementById('btnPlay');
  const btnLabels = document.getElementById('btnLabels');
  const btnSound = document.getElementById('btnSound');
  btnPlay.addEventListener('click', (e) => { onPlay(); releaseFocus(e); });
  btnLabels.addEventListener('click', (e) => { onLabels(); releaseFocus(e); });
  btnSound.addEventListener('click', (e) => { onSound(); releaseFocus(e); });

  let current = -1;
  let labelsOn = true;
  const v = new THREE.Vector3();

  function setStage(si) {
    current = si;
    const s = STAGES[si];
    dialNum.textContent = String(si + 1).padStart(2, '0');
    stageNum.textContent = String(si + 1);
    stageName.textContent = s.name;
    stageName.style.setProperty('--c', s.color);
    stageText.textContent = s.text;
    arcEls.forEach((a, i) => a.classList.toggle('on', i === si));
    chipEls.forEach((c, i) => c.classList.toggle('on', i === si));
    for (const el of [stageName, stageText]) {
      el.classList.remove('swap');
      void el.offsetWidth;
      el.classList.add('swap');
    }
  }

  function update(p, camera, w, h) {
    labels.forEach((def, i) => {
      const el = els[i];
      const a = labelsOn ? def.active(p) : 0;
      if (a < 0.01) {
        if (el.dataset.vis !== '0') { el.style.opacity = '0'; el.dataset.vis = '0'; }
        return;
      }
      if (typeof def.anchor === 'function') def.anchor(p, v); else v.copy(def.anchor);
      v.project(camera);
      if (v.z > 1 || v.z < -1) { el.style.opacity = '0'; el.dataset.vis = '0'; return; }
      const x = Math.min(Math.max((v.x * 0.5 + 0.5) * w, 70), w - 70);
      const y = Math.min(Math.max((-v.y * 0.5 + 0.5) * h, 60), h - 8);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = a.toFixed(3);
      el.dataset.vis = '1';
    });
    const th = angle(p);
    knob.setAttribute('cx', (R * Math.cos(th)).toFixed(2));
    knob.setAttribute('cy', (R * Math.sin(th)).toFixed(2));
    const t0 = p - 0.07;
    tail.setAttribute('d', `M ${pt(angle(t0))} A ${R} ${R} 0 0 1 ${pt(th)}`);
    const si = stageIndexAt(p);
    if (si !== current) setStage(si);
  }

  return {
    update,
    setPlaying(on) { btnPlay.textContent = on ? 'Pause' : 'Play'; btnPlay.classList.toggle('on', !on); },
    setLabels(on) { labelsOn = on; btnLabels.classList.toggle('on', on); },
    setSound(on) { btnSound.classList.toggle('on', on); btnSound.textContent = on ? 'Sound on' : 'Sound'; },
    get labelsOn() { return labelsOn; },
  };
}

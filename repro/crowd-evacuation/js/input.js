// Pointer tools, hover inspector and keyboard shortcuts.
import { WORLD_W, WORLD_H, MAX_EXITS } from './core.js';
import { sampleAt } from './analysis.js';
import { closeScenarioMenu, hideReport } from './panel.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BRUSH = { people: 1.2, erase: 0.6 };

export function initInput(app) {
  const { sim, R, ui, state, $ } = app;
  const cv = $('view'), tip = $('tooltip');
  let drag = null, hover = null, lastEvt = null;

  const toWorld = (e) => R.toWorld(e.clientX, e.clientY);
  const inWorld = (p) => p.x >= 0 && p.y >= 0 && p.x <= WORLD_W && p.y <= WORLD_H;
  const snapGrid = (p, g = 0.25) => ({ x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g });

  function nearEnd(p, r) {
    let best = null, bd = r;
    for (const s of sim.segs) {
      if (s.kind !== 'wall') continue;
      for (const [x, y] of [[s.x0, s.y0], [s.x1, s.y1]]) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) { bd = d; best = { x, y }; }
      }
    }
    return best;
  }

  function wallEnd(a, p, free) {
    if (free) return nearEnd(p, 0.45) || snapGrid(p, 0.05);
    const dx = p.x - a.x, dy = p.y - a.y;
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const L = Math.round(Math.hypot(dx, dy) / 0.25) * 0.25;
    const e = { x: a.x + Math.cos(ang) * L, y: a.y + Math.sin(ang) * L };
    return nearEnd(e, 0.35) || e;
  }

  // An exit is a 0.8 m deep strip; dragged near a straight wall it centres itself on that wall.
  function exitRect(a, p) {
    const horiz = Math.abs(p.x - a.x) >= Math.abs(p.y - a.y);
    const q = (v) => Math.round(v * 10) / 10;
    let lo = horiz ? Math.min(a.x, p.x) : Math.min(a.y, p.y), hi = horiz ? Math.max(a.x, p.x) : Math.max(a.y, p.y);
    if (hi - lo < 0.9) { const c = (lo + hi) / 2; lo = c - 0.45; hi = c + 0.45; }
    lo = q(lo); hi = q(hi);
    let c = horiz ? a.y : a.x, bd = 0.9;
    for (const s of sim.segs) {
      if (s.kind !== 'wall') continue;
      if (horiz && Math.abs(s.y0 - s.y1) < 1e-6 && Math.min(s.x0, s.x1) <= hi && Math.max(s.x0, s.x1) >= lo) {
        const d = Math.abs(s.y0 - a.y);
        if (d < bd) { bd = d; c = s.y0; }
      } else if (!horiz && Math.abs(s.x0 - s.x1) < 1e-6 && Math.min(s.y0, s.y1) <= hi && Math.max(s.y0, s.y1) >= lo) {
        const d = Math.abs(s.x0 - a.x);
        if (d < bd) { bd = d; c = s.x0; }
      }
    }
    return horiz ? { x0: lo, y0: c - 0.4, x1: hi, y1: c + 0.4 } : { x0: c - 0.4, y0: lo, x1: c + 0.4, y1: hi };
  }

  function toggleExit(ex) {
    app.pushUndo();
    sim.toggleExit(ex);
    app.toast(ex.open ? `Exit ${ex.label} reopened` : `Exit ${ex.label} closed. The crowd re-routes.`);
  }

  function inspector(p, e) {
    const s = sampleAt(sim, p.x, p.y);
    if (!s || (s.dens < 0.05 && s.lost < 1)) return false;
    tip.innerHTML = `<h4>${esc(sim.nameAt(p.x, p.y))}</h4>`
      + `<div class="row">Density <b>${s.dens.toFixed(1)} /m²</b></div>`
      + `<div class="row">Walking speed <b>${s.spd.toFixed(2)} m/s</b></div>`
      + `<div class="row">Congestion <b>${Math.round(s.cong * 100)}%</b></div>`
      + `<div class="row">Body pressure <b>${(s.press / 1000).toFixed(2)} kN</b></div>`
      + `<div class="row">Time lost here <b>${(s.lost / 60).toFixed(1)} person-min</b></div>`;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + w > innerWidth - 8) x = e.clientX - w - 16;
    if (y + h > innerHeight - 8) y = e.clientY - h - 16;
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
    return true;
  }

  function updatePreview(e) {
    if (!e || !hover) return;
    const p = hover, t = ui.tool, onCanvas = drag || e.target === cv;
    ui.preview = null;
    cv.classList.remove('over-exit');
    let showTip = false;
    if (!onCanvas) { tip.hidden = true; return; }
    if (drag?.mode === 'wall') {
      const L = Math.hypot(drag.b.x - drag.a.x, drag.b.y - drag.a.y);
      ui.preview = { type: 'wall', x0: drag.a.x, y0: drag.a.y, x1: drag.b.x, y1: drag.b.y, label: `${L.toFixed(2)} m`, lx: drag.b.x, ly: drag.b.y };
    } else if (drag?.mode === 'exit' && drag.moved) {
      const r = exitRect(drag.a, drag.b);
      ui.preview = { type: 'exit', ...r, label: `${Math.max(r.x1 - r.x0, r.y1 - r.y0).toFixed(1)} m door`, lx: drag.b.x, ly: drag.b.y };
    } else if (t === 'people' || t === 'erase') {
      const red = t === 'erase' || drag?.mode === 'unspray';
      ui.preview = { type: 'brush', x: p.x, y: p.y, r: BRUSH[t], color: red ? '#ff8f8f' : '#8fd3ff', fill: red ? 'rgba(255,120,120,0.1)' : 'rgba(120,200,255,0.1)' };
    } else if (t === 'pillar') {
      const q = snapGrid(p, 0.05);
      ui.preview = { type: 'pillar', x: q.x, y: q.y, r: 0.4 };
    } else if ((t === 'inspect' || t === 'exit') && !drag) {
      const ex = sim.exitAt(p.x, p.y);
      if (ex) {
        ui.preview = { type: 'exitHover', exit: ex, label: `Exit ${ex.label}: click to ${ex.open ? 'close' : 'reopen'}`, lx: p.x, ly: p.y };
        cv.classList.add('over-exit');
      } else if (t === 'inspect' && inWorld(p)) showTip = inspector(p, e);
    }
    tip.hidden = !showTip;
  }

  cv.addEventListener('pointerdown', (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic pointers cannot be captured */ }
    const p = toWorld(e), t = ui.tool, b = e.button;
    hover = p; lastEvt = e;
    closeScenarioMenu();
    if (b === 1 || (b === 2 && t !== 'people')) { drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, x0: e.clientX, y0: e.clientY, moved: false }; return; }
    if (b !== 0 && b !== 2) return;
    if (t === 'inspect') {
      drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, exit: sim.exitAt(p.x, p.y) };
      return;
    }
    if (!inWorld(p)) return;
    if (t === 'wall') { const a = nearEnd(p, 0.45) || snapGrid(p); drag = { mode: 'wall', a, b: a }; }
    else if (t === 'pillar') { const q = snapGrid(p, 0.05); app.pushUndo(); sim.addPillar(q.x, q.y, 0.4); }
    else if (t === 'exit') drag = { mode: 'exit', a: p, b: p, exit: sim.exitAt(p.x, p.y), x0: e.clientX, y0: e.clientY, moved: false };
    else if (t === 'people') {
      drag = { mode: b === 2 ? 'unspray' : 'spray', p, acc: 0 };
      if (b === 2) sim.removeAgentsInCircle(p.x, p.y, BRUSH.people); else sim.addAgentsInCircle(p.x, p.y, BRUSH.people, 6);
    } else if (t === 'erase') {
      app.pushUndo();
      sim.holdRebuild = true;
      drag = { mode: 'erase', changed: sim.eraseAt(p.x, p.y, BRUSH.erase), last: performance.now() };
    }
    updatePreview(e);
  });

  window.addEventListener('pointermove', (e) => {
    const p = toWorld(e);
    hover = p; lastEvt = e;
    if (drag) {
      if (drag.mode === 'pan') {
        if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4) { drag.moved = true; cv.classList.add('panning'); }
        if (drag.moved) { R.panBy(e.clientX - drag.sx, e.clientY - drag.sy); state.viewTouched = true; }
        drag.sx = e.clientX; drag.sy = e.clientY;
      } else if (drag.mode === 'wall') drag.b = wallEnd(drag.a, p, e.shiftKey);
      else if (drag.mode === 'exit') { drag.b = p; if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) drag.moved = true; }
      else if (drag.mode === 'spray' || drag.mode === 'unspray') drag.p = p;
      else if (drag.mode === 'erase') {
        if (sim.eraseAt(p.x, p.y, BRUSH.erase)) drag.changed = true;
        if (sim.dirty && performance.now() - drag.last > 300) { sim.holdRebuild = false; sim.rebuild(); sim.holdRebuild = true; drag.last = performance.now(); }
      }
    }
    updatePreview(e);
  });

  function endDrag(e, commit) {
    if (!drag) return;
    const d = drag;
    drag = null;
    cv.classList.remove('panning');
    if (d.mode === 'erase') {
      sim.holdRebuild = false;
      if (!d.changed) { state.undo.pop(); $('undoBtn').disabled = !state.undo.length; }
    }
    if (!commit) return;
    if (d.mode === 'pan' && !d.moved && d.exit) toggleExit(d.exit);
    else if (d.mode === 'wall') {
      if (Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) >= 0.3) { app.pushUndo(); sim.addWall(d.a.x, d.a.y, d.b.x, d.b.y, 0.3); }
    } else if (d.mode === 'exit') {
      if (!d.moved && d.exit) toggleExit(d.exit);
      else if (d.moved) {
        if (sim.exits.length >= MAX_EXITS) app.toast(`Up to ${MAX_EXITS} exits`);
        else {
          app.pushUndo();
          const r = exitRect(d.a, d.b), ex = sim.addExit(r.x0, r.y0, r.x1, r.y1);
          if (ex) app.toast(`Exit ${ex.label} added`);
        }
      }
    }
    updatePreview(e);
  }
  window.addEventListener('pointerup', (e) => endDrag(e, true));
  window.addEventListener('pointercancel', (e) => endDrag(e, false));

  cv.addEventListener('pointerleave', () => { if (!drag) { ui.preview = null; tip.hidden = true; } });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    R.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    state.viewTouched = true;
    hover = toWorld(e);
  }, { passive: false });

  app.onFrame = (dt) => {
    if (drag?.mode === 'spray') {
      drag.acc += dt * 80;
      const k = Math.floor(drag.acc);
      if (k > 0) { drag.acc -= k; sim.addAgentsInCircle(drag.p.x, drag.p.y, BRUSH.people, k); }
    } else if (drag?.mode === 'unspray') sim.removeAgentsInCircle(drag.p.x, drag.p.y, BRUSH.people);
    if (ui.tool === 'inspect' && !drag && lastEvt && !tip.hidden) updatePreview(lastEvt);
  };

  const TOOLS = { v: 'inspect', w: 'wall', o: 'pillar', x: 'exit', p: 'people', e: 'erase' };
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.key !== 'Escape' && e.key !== ' ') return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); app.undo(); }
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === ' ') {
      e.preventDefault();
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      if (!e.repeat) app.togglePlay();
      return;
    }
    if (TOOLS[k]) { app.setTool(TOOLS[k]); return; }
    switch (k) {
      case 'r': app.restart(); break;
      case 'n': app.newCrowd(); break;
      case '1': app.setSpeed(1); break;
      case '2': app.setSpeed(2); break;
      case '3': app.setSpeed(4); break;
      case '4': app.setSpeed(8); break;
      case 'h': app.cycleHeat(); break;
      case 'c': app.toggleColor(); break;
      case 't': app.toggleTrails(); break;
      case 'g': app.toggleRoutes(); break;
      case 'f': app.fitView(); break;
      case '?': case '/': app.toggleHelp(); break;
      case 'Escape':
        if (drag) endDrag(lastEvt, false);
        app.toggleHelp(false); closeScenarioMenu(); hideReport();
        break;
      default: return;
    }
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') e.preventDefault(); });
}

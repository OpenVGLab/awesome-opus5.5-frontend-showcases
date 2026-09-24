// editor.js - what the mouse, finger and keyboard do on the workspace:
// drag parts in from the palette, move them, stretch wire ends, draw a new wire from a
// terminal, select, double-click for properties, rotate, delete, pan and zoom.
import { makePart, makeWire, terminalsOf, bboxOf, iconMarkup, WIRE_CYCLE } from './parts.js';
import { app, findPart, addPart, removePart, checkpoint, dropCheckpoint, nextWireColor } from './state.js';
import { snap, GRID } from './util.js';
import { pointKey } from './topology.js';

const DOUBLE_TAP_MS = 400;
const DRAG_START_PX = 4;

export function createEditor({ svg, renderer: R, actions }) {
  let mode = null;                 // current drag on the workspace
  let pal = null;                  // current drag from the palette
  let lastTap = { id: null, t: 0, toggled: false };

  // Wire ends lying on a part's terminals: they follow the part when it moves or rotates.
  function attachedWireEnds(p) {
    const T = terminalsOf(p), out = [];
    for (const w of app.parts) {
      if (w.type !== 'wire' || w === p) continue;
      T.forEach((t, term) => {
        if (w.x1 === t.x && w.y1 === t.y) out.push({ id: w.id, end: 0, term });
        if (w.x2 === t.x && w.y2 === t.y) out.push({ id: w.id, end: 1, term });
      });
    }
    return out;
  }
  function followWires(p, attached) {
    const T = terminalsOf(p);
    for (const a of attached) {
      const w = findPart(a.id);
      if (!w) continue;
      if (a.end === 0) { w.x1 = T[a.term].x; w.y1 = T[a.term].y; } else { w.x2 = T[a.term].x; w.y2 = T[a.term].y; }
    }
  }
  // A wire squashed to zero length is useless - remove it.
  const cleanupWires = () => {
    app.parts.filter((w) => w.type === 'wire' && w.x1 === w.x2 && w.y1 === w.y2).forEach((w) => removePart(w.id));
  };
  // Terminals of part p that currently touch something (green hint rings while dragging).
  function contactHints(p, ends = [0, 1]) {
    const topo = R.topo;
    if (!topo || !p) return [];
    return ends.map((t) => topo.pts[topo.tp(p.id, t)]).filter((pt) => pt && pt.attach.length >= 2);
  }
  function liveUpdate(hintPart, ends) {
    actions.changed({ live: true });
    R.snapPts = contactHints(hintPart, ends);
    R.drawOverlay();
  }
  function capture(e) { try { svg.setPointerCapture(e.pointerId); } catch (err) { /* not important */ } }

  // ---------- Pointer down on the workspace ----------
  svg.addEventListener('pointerdown', (e) => {
    if (pal) return;
    actions.unlockAudio();
    if (e.button === 1) { startPan(e, false); return; }
    if (e.button !== 0) return;
    e.preventDefault();
    const w = R.screenToWorld(e.clientX, e.clientY);
    const nodeEl = e.target.closest('[data-pt]');
    const partEl = e.target.closest('[data-id]');
    if (nodeEl && R.topo && R.topo.pts[+nodeEl.dataset.pt]) startFromPoint(e, R.topo.pts[+nodeEl.dataset.pt]);
    else if (partEl && findPart(partEl.dataset.id)) startPartDrag(e, findPart(partEl.dataset.id), w);
    else startPan(e, true);
  });

  function startPan(e, deselect) {
    mode = { kind: 'pan', sx: e.clientX, sy: e.clientY, tx0: app.view.tx, ty0: app.view.ty, moved: false, deselect };
    capture(e);
  }
  // Pressing on a terminal: grab a wire end there, otherwise start drawing a new wire.
  // (Hold Shift to always draw a new wire, e.g. to branch off an existing junction.)
  function startFromPoint(e, pt) {
    const ends = pt.attach.filter((a) => a.term >= 0 && (findPart(a.partId) || {}).type === 'wire');
    if (ends.length && !e.shiftKey) {
      const a = ends[ends.length - 1];
      mode = { kind: 'wire-end', id: a.partId, end: a.term, sx: e.clientX, sy: e.clientY, moved: false };
    } else {
      const owner = pt.attach.find((a) => a.term >= 0) || pt.attach[0];
      mode = { kind: 'draw', from: { x: pt.x, y: pt.y }, ownerId: owner.partId, sx: e.clientX, sy: e.clientY, moved: false };
    }
    capture(e);
  }
  function startPartDrag(e, p, w) {
    mode = { kind: p.type === 'wire' ? 'wire-move' : 'part', id: p.id, start: w, sx: e.clientX, sy: e.clientY, moved: false };
    if (p.type === 'wire') mode.orig = { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 };
    else { mode.orig = { x: p.x, y: p.y }; mode.attached = attachedWireEnds(p); }
    capture(e);
  }

  // ---------- Pointer move ----------
  window.addEventListener('pointermove', (e) => {
    if (pal) { movePalette(e); return; }
    if (!mode) { hover(e); return; }
    if (!mode.moved) {
      if (Math.hypot(e.clientX - mode.sx, e.clientY - mode.sy) < DRAG_START_PX) return;
      mode.moved = true;
      actions.hover(null);
      if (mode.kind !== 'pan') { checkpoint(); actions.dragStart(); }
    }
    const w = R.screenToWorld(e.clientX, e.clientY);
    const p = mode.id ? findPart(mode.id) : null;
    if (mode.kind === 'pan') {
      app.view.tx = mode.tx0 + e.clientX - mode.sx;
      app.view.ty = mode.ty0 + e.clientY - mode.sy;
      R.applyView();
    } else if (mode.kind === 'part' && p) {
      const nx = snap(mode.orig.x + w.x - mode.start.x), ny = snap(mode.orig.y + w.y - mode.start.y);
      if (nx !== p.x || ny !== p.y) { p.x = nx; p.y = ny; followWires(p, mode.attached); liveUpdate(p); }
    } else if (mode.kind === 'wire-move' && p) {
      const dx = snap(w.x - mode.start.x), dy = snap(w.y - mode.start.y);
      if (p.x1 !== mode.orig.x1 + dx || p.y1 !== mode.orig.y1 + dy) {
        Object.assign(p, { x1: mode.orig.x1 + dx, y1: mode.orig.y1 + dy, x2: mode.orig.x2 + dx, y2: mode.orig.y2 + dy });
        liveUpdate(p);
      }
    } else if (mode.kind === 'wire-end' && p) {
      const x = snap(w.x), y = snap(w.y);
      const other = mode.end === 0 ? [p.x2, p.y2] : [p.x1, p.y1];
      const cur = mode.end === 0 ? [p.x1, p.y1] : [p.x2, p.y2];
      if ((x !== cur[0] || y !== cur[1]) && (x !== other[0] || y !== other[1])) {
        if (mode.end === 0) { p.x1 = x; p.y1 = y; } else { p.x2 = x; p.y2 = y; }
        liveUpdate(p, [mode.end]);
      }
    } else if (mode.kind === 'draw') {
      const x = snap(w.x), y = snap(w.y);
      R.drawLine = { x1: mode.from.x, y1: mode.from.y, x2: x, y2: y };
      const hit = R.topo.pts.find((pt) => pt.x === x && pt.y === y && (x !== mode.from.x || y !== mode.from.y));
      R.snapPts = hit ? [hit] : [];
      R.drawOverlay();
    }
  });

  // ---------- Pointer up ----------
  window.addEventListener('pointerup', (e) => {
    if (pal) { endPalette(e); return; }
    if (!mode) return;
    const m = mode;
    mode = null;
    R.snapPts = [];
    if (m.kind === 'pan') {
      if (!m.moved && m.deselect) actions.select(null);
      return;
    }
    if (m.kind === 'draw') {
      const d = R.drawLine;
      R.drawLine = null;
      if (m.moved && d && (d.x2 !== d.x1 || d.y2 !== d.y1)) {
        const wire = addPart(makeWire(d.x1, d.y1, d.x2, d.y2, nextWireColor()));
        app.selectedId = wire.id;
        actions.sfx('place');
        actions.changed({});
      } else {
        if (m.moved) dropCheckpoint();
        R.drawOverlay();
        tap(m.ownerId);
      }
      return;
    }
    if (m.moved) { cleanupWires(); actions.changed({}); } else tap(m.id);
  });
  window.addEventListener('pointercancel', () => {
    if (pal) cancelPalette();
    if (mode && mode.moved && mode.kind !== 'pan') { cleanupWires(); actions.changed({}); }
    mode = null;
    R.drawLine = null;
    R.snapPts = [];
  });

  // A click without dragging: select; two quick clicks: properties; a click on a switch flips it.
  function tap(id) {
    const p = findPart(id);
    if (!p) return;
    const now = performance.now();
    if (lastTap.id === id && now - lastTap.t < DOUBLE_TAP_MS) {
      if (lastTap.toggled) actions.toggleSwitch(p, { undoLast: true, stale: lastTap.stale });
      lastTap = { id: null, t: 0, toggled: false };
      actions.openProps(id);
      return;
    }
    lastTap = { id, t: now, toggled: p.type === 'switch', stale: app.stale };
    actions.select(id);
    if (p.type === 'switch') actions.toggleSwitch(p);
  }

  // Hovering a part after a successful test shows its readings in a tooltip.
  function hover(e) {
    const el = e.target && e.target.closest ? e.target.closest('#board [data-id]') : null;
    actions.hover(el ? el.dataset.id : null, e.clientX, e.clientY);
  }

  // ---------- Zoom with the mouse wheel ----------
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    R.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
  }, { passive: false });

  // ---------- Palette: drag a new part onto the workspace (or just click it) ----------
  const peekColor = () => WIRE_CYCLE[app.wireColor % WIRE_CYCLE.length];
  function partAt(type, wx, wy) {
    const p = makePart(type, snap(wx), snap(wy), 0);
    if (type === 'wire') p.props.color = peekColor();
    return p;
  }
  function overBoard(e) {
    const r = svg.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  document.querySelectorAll('[data-palette]').forEach((card) => {
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      actions.unlockAudio();
      actions.applyProps();
      pal = { type: card.dataset.palette, sx: e.clientX, sy: e.clientY, started: false, ghost: null };
    });
    // Keyboard users: Enter / Space on a focused card adds the part (detail 0 = not a mouse click).
    card.addEventListener('click', (e) => { if (e.detail === 0) addAtFreeSpot(card.dataset.palette); });
  });
  function movePalette(e) {
    if (!pal.started) {
      if (Math.hypot(e.clientX - pal.sx, e.clientY - pal.sy) < DRAG_START_PX) return;
      pal.started = true;
      pal.ghost = document.createElement('div');
      pal.ghost.className = 'ghost';
      const s = app.view.s;
      pal.ghost.innerHTML = `<svg viewBox="-48 -30 96 60" width="${96 * s}" height="${60 * s}">${iconMarkup(pal.type)}</svg>`;
      document.body.appendChild(pal.ghost);
      actions.select(null);
    }
    if (overBoard(e)) {
      const w = R.screenToWorld(e.clientX, e.clientY);
      R.preview = partAt(pal.type, w.x, w.y);
      const keys = new Set(R.topo.pts.map((pt) => pointKey(pt.x, pt.y)));
      R.snapPts = terminalsOf(R.preview).filter((t) => keys.has(pointKey(t.x, t.y)));
      pal.ghost.style.display = 'none';
    } else {
      R.preview = null;
      R.snapPts = [];
      pal.ghost.style.display = 'block';
      pal.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    }
    R.drawOverlay();
  }
  function endPalette(e) {
    const { type, started } = pal;
    const pv = R.preview;
    cancelPalette();
    if (!started) { addAtFreeSpot(type); return; }
    if (pv && overBoard(e)) place(pv);
  }
  function cancelPalette() {
    if (pal && pal.ghost) pal.ghost.remove();
    pal = null;
    R.preview = null;
    R.snapPts = [];
    R.drawOverlay();
  }
  function place(p) {
    checkpoint();
    if (p.type === 'wire') p.props.color = nextWireColor();
    const added = addPart(p);
    app.selectedId = added.id;
    actions.sfx('place');
    actions.changed({});
  }
  // Clicking a palette card drops the part on a free spot near the middle of the view.
  function addAtFreeSpot(type) {
    const r = svg.getBoundingClientRect();
    const c = R.screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
    const cx = snap(c.x, 40), cy = snap(c.y, 40);
    const boxes = app.parts.map((q) => bboxOf(q, 12));
    const keys = new Set(R.topo.pts.map((pt) => pointKey(pt.x, pt.y)));
    for (let ring = 0; ring < 14; ring++) {
      for (let j = -ring; j <= ring; j++) {
        for (let i = -ring; i <= ring; i++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
          const p = partAt(type, cx + i * 40, cy + j * 40);
          const b = bboxOf(p, 4);
          const overlap = boxes.some((o) => !(b.x + b.w < o.x || o.x + o.w < b.x || b.y + b.h < o.y || o.y + o.h < b.y));
          if (!overlap && !terminalsOf(p).some((t) => keys.has(pointKey(t.x, t.y)))) { place(p); return; }
        }
      }
    }
    place(partAt(type, cx, cy));
  }

  // ---------- Commands (also used by the toolbar buttons) ----------
  function rotate(p) {
    if (!p) return;
    checkpoint();
    if (p.type === 'wire') {
      const cx = snap((p.x1 + p.x2) / 2), cy = snap((p.y1 + p.y2) / 2);
      const turn = (x, y) => [snap(cx - (y - cy)), snap(cy + (x - cx))];   // 90 degrees clockwise
      const [x1, y1] = turn(p.x1, p.y1), [x2, y2] = turn(p.x2, p.y2);
      Object.assign(p, { x1, y1, x2, y2 });
    } else {
      const attached = attachedWireEnds(p);
      p.rot = (p.rot + 1) % 4;
      followWires(p, attached);
    }
    cleanupWires();
    actions.sfx('tick');
    actions.changed({});
  }
  function remove(p) {
    if (!p) return;
    checkpoint();
    removePart(p.id);
    actions.sfx('delete');
    actions.changed({});
  }
  function nudge(p, dx, dy) {
    checkpoint();
    if (p.type === 'wire') Object.assign(p, { x1: p.x1 + dx, y1: p.y1 + dy, x2: p.x2 + dx, y2: p.y2 + dy });
    else { const att = attachedWireEnds(p); p.x += dx; p.y += dy; followWires(p, att); }
    cleanupWires();
    actions.changed({});
  }

  // ---------- Keyboard shortcuts ----------
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (actions.dialogOpen()) { if (e.key === 'Escape') actions.closeDialogs(); return; }
    const sel = findPart(app.selectedId);
    const key = e.key;
    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) actions.redo(); else actions.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'y') { e.preventDefault(); actions.redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const onButton = e.target.closest && e.target.closest('button');
    const arrows = { ArrowLeft: [-GRID, 0], ArrowRight: [GRID, 0], ArrowUp: [0, -GRID], ArrowDown: [0, GRID] };
    if (key === 'r' || key === 'R') rotate(sel);
    else if ((key === 'Delete' || key === 'Backspace') && sel) { e.preventDefault(); remove(sel); }
    else if (key === 'Escape') actions.select(null);
    else if ((key === 't' || key === 'T') || (key === 'Enter' && !onButton)) actions.test();
    else if ((key === 'e' || key === 'E' || key === 'F2') && sel) actions.openProps(sel.id);
    else if (key === ' ' && !onButton && sel && sel.type === 'switch') { e.preventDefault(); actions.toggleSwitch(sel); }
    else if (arrows[key] && sel) { e.preventDefault(); nudge(sel, ...arrows[key]); }
    else if (key === '+' || key === '=') actions.zoom(1.2);
    else if (key === '-' || key === '_') actions.zoom(1 / 1.2);
    else if (key === '0') actions.fit();
  });

  return { rotate, remove, addAtFreeSpot, attachedWireEnds };
}

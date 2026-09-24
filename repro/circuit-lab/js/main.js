// main.js - starts the lab and connects the pieces:
// state (data) -> render (workspace drawing) / ui (panels), editor (input) -> actions -> state.
import { app, setParts, checkpoint, dropCheckpoint, undo, redo, save, load, resetProgress } from './state.js';
import { analyze } from './circuit.js';
import { createRenderer } from './render.js';
import { createEditor } from './editor.js';
import { createProps } from './props.js';
import { createUI } from './ui.js';
import { EXAMPLES, STEPS, evaluateSteps } from './experiments.js';
import { sfx, unlockAudio, setMuted } from './audio.js';
import { fmtI, fmtV, fmtR } from './util.js';
import { ICONS } from './icons.js';

const $ = (id) => document.getElementById(id);
const svg = $('board');
const stage = $('stage');
let props = null;
let editor = null;
let testing = false;
let resultSeq = 0;

// Everything the other modules are allowed to ask for.
const actions = {
  changed, select, toggleSwitch, restoreStale, loadExample, goStep, unlockAudio, sfx,
  test: () => runTest(),
  undo: doUndo,
  redo: doRedo,
  openProps: (id) => props.open(id),
  applyProps: () => { if (props.isOpen()) props.close(true); },
  rotate: (p) => editor.rotate(p),
  remove: (p) => editor.remove(p),
  hover: (id, x, y) => props.hover(id, x, y),
  dragStart: () => props.hideSelbar(),
  dialogOpen: () => props.isOpen() || !$('help').hidden,
  closeDialogs,
  saveOnly: save,
  flashIssue: (n, on) => renderer.flashIssue(n, on),
  zoom: (f) => zoomBy(f),
  fit: () => fitView(),
};

const ui = createUI({ actions });           // builds the palette cards first: the editor needs them
const renderer = createRenderer(svg, app, {
  onContact: () => sfx('contact'),
  onView: () => { ui.zoomLabel(); if (props) { props.updateSelbar(); props.reposition(); } },
});
props = createProps({ stage, renderer, actions });
editor = createEditor({ svg, renderer, actions });

// Called after every change to the circuit. live = still dragging (lighter update).
function changed({ live = false, silent = false } = {}) {
  if (app.result && !app.stale) { app.stale = true; ui.renderResult(); }
  renderer.render({ contacts: live ? 'hold' : silent ? 'silent' : 'track' });
  ui.renderStatus(renderer.topo);
  if (live) return;
  props.updateSelbar();
  ui.updateButtons();
  save();
  if (app.autoTest && app.parts.length) runTest({ quick: true });
}
function select(id) {
  app.selectedId = id;
  renderer.render({ contacts: 'hold' });
  props.updateSelbar();
  ui.updateButtons();
}
// The circuit ended up exactly as it was tested (e.g. an edit was cancelled): bring back
// the old "result is up to date" flag. retest: an automatic test already ran in between.
function restoreStale(stale, { retest = false } = {}) {
  if (retest && app.autoTest) { changed({ silent: true }); return; }
  app.stale = stale;
  renderer.render({ contacts: 'silent' });
  ui.renderResult();
  ui.renderStatus(renderer.topo);
  props.updateSelbar();
  ui.updateButtons();
  save();
}
// undoLast: the first click of a double-click flipped the switch - flip it back quietly.
function toggleSwitch(p, { undoLast = false, stale = true } = {}) {
  if (!p || p.type !== 'switch') return;
  if (undoLast) {
    p.props.closed = !p.props.closed;
    dropCheckpoint();
    restoreStale(stale, { retest: true });
    return;
  }
  checkpoint();
  p.props.closed = !p.props.closed;
  sfx('switch');
  changed({});
}

// ---------- Start Test ----------
function runTest({ quick = false } = {}) {
  if (testing) return;
  if (props.isOpen()) props.close(true);
  const finish = () => {
    const res = analyze(app.parts);
    res.id = ++resultSeq;
    let n = 0;   // number the problems that can be pointed at on the workspace
    for (const iss of res.issues) {
      if (iss.sev !== 'info' && (iss.points.length || iss.parts.length || iss.gap || iss.path.length)) iss.num = ++n;
    }
    app.result = res;
    app.stale = false;
    if (res.status !== 'empty') record(res);
    const fresh = evaluateSteps(app, res);
    renderer.render({ contacts: 'hold' });
    ui.renderResult();
    ui.renderRecords();
    ui.renderSteps();
    ui.renderStatus(renderer.topo);
    save();
    if (!quick) sfx(res.status === 'ok' ? 'ok' : res.status === 'short' ? 'short' : 'fail');
    if (!quick && res.status === 'short') {
      stage.classList.remove('shake');
      void stage.offsetWidth;
      stage.classList.add('shake');
    }
    if (fresh.length) {
      setTimeout(() => sfx('step'), quick ? 0 : 450);
      ui.toast(`Step ${fresh[0] + 1} complete: ${STEPS[fresh[0]].title}!${fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ''}`, 'ok', 3400);
      if (app.done.every(Boolean)) setTimeout(() => ui.toast('All six experiment steps complete \u2013 well done!', 'ok', 4000), 900);
    }
  };
  if (quick) { finish(); return; }
  testing = true;
  ui.setTesting(true);
  sfx('scan');
  setTimeout(() => { testing = false; ui.setTesting(false); finish(); }, 650);
}
function record(res) {
  const labels = { ok: 'closed', open: 'open', short: 'short', nobattery: 'no battery', error: 'error' };
  const m = res.main;
  const n = (app.records.length ? app.records[app.records.length - 1].n : 0) + 1;
  app.records.push({
    n, status: res.status, label: labels[res.status] || res.status,
    U: m ? fmtV(m.U) : '\u2014', I: m ? fmtI(m.I) : '\u2014',
    R: m && !m.multi && isFinite(m.R) ? fmtR(m.R) : '\u2014',
  });
  if (app.records.length > 40) app.records.shift();
}

// ---------- Examples, steps, history ----------
function loadExample(key, { note = true } = {}) {
  const ex = EXAMPLES[key];
  if (!ex) return;
  if (props.isOpen()) props.close(false);
  checkpoint();
  setParts(ex.build());
  app.faultLoaded = key === 'faulty';
  app.result = null;
  app.stale = false;
  renderer.render({ contacts: 'silent' });
  fitView();
  ui.renderResult();
  ui.renderStatus(renderer.topo);
  ui.updateButtons();
  props.updateSelbar();
  save();
  if (note) ui.toast(`Loaded \u201c${ex.name}\u201d \u00b7 Ctrl+Z restores your circuit`, 'info', 2000);
}
// Moving to another step puts that step's starter parts on the workspace.
function goStep(i) {
  if (i < 0 || i >= STEPS.length || i === app.step) return;
  app.step = i;
  ui.renderSteps();
  loadExample(STEPS[i].starter, { note: false });
  ui.toast(`Step ${i + 1}: ${STEPS[i].title} \u2013 starter parts loaded.`, 'info', 2400);
}
function afterHistory() {
  if (app.result) app.stale = true;
  renderer.render({ contacts: 'silent' });
  ui.renderResult();
  ui.renderStatus(renderer.topo);
  ui.updateButtons();
  props.updateSelbar();
  save();
}
function doUndo() {
  if (props.isOpen()) props.close(false);
  if (undo()) { afterHistory(); sfx('tick'); }
}
function doRedo() {
  if (props.isOpen()) props.close(false);
  if (redo()) { afterHistory(); sfx('tick'); }
}
function clearAll() {
  if (!app.parts.length) return;
  if (props.isOpen()) props.close(false);
  checkpoint();
  setParts([]);
  app.faultLoaded = false;
  app.result = null;
  changed({ silent: true });
  ui.renderResult();
  ui.toast('Workspace cleared \u2013 Undo brings it back.', 'info');
}
function closeDialogs() {
  if (props.isOpen()) props.close(false);
  $('help').hidden = true;
}

// ---------- View ----------
function fitView() {
  const box = renderer.contentBox();
  if (!box) {
    const r = svg.getBoundingClientRect();
    Object.assign(app.view, { s: 1, tx: r.width / 2, ty: r.height / 2 });
    renderer.applyView();
    return;
  }
  const h = svg.getBoundingClientRect().height;
  renderer.fitTo(box, { top: ui.coachRoom(), max: Math.min(1.9, Math.max(1.5, h / 560)) });
}
function zoomBy(f) {
  const r = svg.getBoundingClientRect();
  renderer.zoomAt(f, r.left + r.width / 2, r.top + r.height / 2);
}
// Keep the drawing centred when the window size changes.
let lastSize = null;
new ResizeObserver(() => {
  const r = stage.getBoundingClientRect();
  if (lastSize && (r.width !== lastSize.w || r.height !== lastSize.h)) {
    app.view.tx += (r.width - lastSize.w) / 2;
    app.view.ty += (r.height - lastSize.h) / 2;
    renderer.applyView();
  }
  lastSize = { w: r.width, h: r.height };
}).observe(stage);

// ---------- Buttons ----------
const on = (id, fn) => $(id).addEventListener('click', fn);
on('btnTest', () => { unlockAudio(); runTest(); });
on('btnUndo', doUndo);
on('btnRedo', doRedo);
on('btnRotate', () => editor.rotate(app.parts.find((p) => p.id === app.selectedId)));
on('btnDelete', () => editor.remove(app.parts.find((p) => p.id === app.selectedId)));
on('btnZoomIn', () => zoomBy(1.2));
on('btnZoomOut', () => zoomBy(1 / 1.2));
on('btnFit', fitView);
on('btnClear', clearAll);
on('btnClearRecords', () => { app.records = []; ui.renderRecords(); save(); });
on('btnSound', () => { unlockAudio(); app.muted = !app.muted; setMuted(app.muted); ui.updateButtons(); save(); });
on('btnHelp', () => { $('help').hidden = false; });
on('btnResetProgress', () => {
  resetProgress();
  $('help').hidden = true;
  ui.renderSteps();
  ui.renderRecords();
  loadExample(STEPS[0].starter, { note: false });
  ui.toast('Progress reset \u2013 starting again from step 1.', 'info');
});
$('help').addEventListener('click', (e) => { if (e.target === $('help') || e.target.closest('[data-close]')) $('help').hidden = true; });
$('autoTest').addEventListener('change', (e) => { app.autoTest = e.target.checked; save(); if (app.autoTest && app.parts.length) runTest({ quick: true }); });
// Clicking the workspace while the properties card is open applies and closes it.
svg.addEventListener('pointerdown', () => { if (props.isOpen()) props.close(true); }, true);
document.querySelectorAll('[data-icon]').forEach((el) => { el.insertAdjacentHTML('afterbegin', ICONS[el.dataset.icon] || ''); });

// ---------- Start ----------
if (!load()) setParts(EXAMPLES.starter.build());
setMuted(app.muted);
renderer.render({ contacts: 'silent' });
ui.renderSteps();
ui.renderResult();
ui.renderRecords();
ui.renderStatus(renderer.topo);
ui.updateButtons();
fitView();
window.circuitLab = { app, analyze };   // handy for experiments in the browser console

// App shell: owns the simulation loop, scenario loading and the shared UI state.
import { Sim } from './sim.js';
import { DT } from './core.js';
import { Renderer, HEAT } from './render.js';
import { SCENARIOS, buildScenario } from './scenarios.js';
import { initPanel, updatePanel, showReport, hideReport, openScenarioMenu, closeScenarioMenu } from './panel.js';
import { initInput } from './input.js';

const $ = (id) => document.getElementById(id);
const sim = new Sim();
const R = new Renderer($('view'), sim);
const params = new URLSearchParams(location.search);

const ui = {
  tool: 'inspect', playing: true, speed: 1, heat: 'cong', color: 'speed', trails: false, routes: false,
  preview: null, highlight: null, now: 0, advanced: false,
};
const state = {
  scenario: null, layout: null, seed: 1234, people: 700, urgency: 25, aware: 15,
  history: [], ghost: null, undo: [], viewTouched: false, simRate: 1,
};

const HEAT_ORDER = ['off', 'cong', 'dens', 'jam', 'press'];
const app = {
  sim, R, ui, state, $, SCENARIOS,
  toast, loadScenario, populate, restart, newCrowd, pushUndo, undo, setTool, setHeat, setSpeed, togglePlay,
  fitView, applyParams, cycleHeat: () => setHeat(HEAT_ORDER[(HEAT_ORDER.indexOf(ui.heat) + 1) % HEAT_ORDER.length]),
  warp,
};
window.egress = app;

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function region() {
  const W = innerWidth, H = innerHeight;
  const tb = $('toolbar').getBoundingClientRect(), pn = $('panel').getBoundingClientRect(), bb = $('bottombar').getBoundingClientRect();
  const x0 = tb.right + 10, x1 = pn.left - 10, y0 = 116, y1 = Math.min(H - 8, bb.top - 8);
  return { x: x0, y: y0, w: Math.max(200, x1 - x0), h: Math.max(160, y1 - y0) };
}

// Screen areas covered by UI chrome; canvas labels are kept out of them.
function updateBlockers() {
  R.blockers = ['topbar', 'toolbar', 'panel', 'bottombar', 'zoomCtl', 'caption'].map((id) => {
    const r = $(id).getBoundingClientRect();
    return { x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 };
  }).filter((b) => b.w > 10 && b.h > 10);
}

function fitView() {
  R.region = region();
  R.fit(state.layout.view || { x0: 0, y0: 0, x1: 60, y1: 36 });
  state.viewTouched = false;
}

function resize() {
  R.resize(innerWidth, innerHeight, Math.min(2, window.devicePixelRatio || 1));
  R.region = region();
  if (!state.viewTouched && state.layout) fitView();
  updateBlockers();
}

function urgencyLabel(u) {
  const v = sim.v0.toFixed(1);
  const w = u < 15 ? 'calm walk' : u < 40 ? 'hurried' : u < 70 ? 'rushing' : 'panic';
  return `${w} · ${v} m/s`;
}
function awareLabel(a) {
  return a < 12 ? 'habit only' : a < 40 ? 'some signage' : a < 75 ? 'well signed' : 'fully informed';
}

function setSlider(el, v) {
  el.value = v;
  el.style.setProperty('--p', `${((v - el.min) / (el.max - el.min)) * 100}%`);
}

function applyParams() {
  sim.setUrgency(state.urgency / 100);
  sim.awareness = state.aware / 100;
  setSlider($('sN'), state.people); setSlider($('sU'), state.urgency); setSlider($('sA'), state.aware);
  $('vN').textContent = state.people;
  $('vU').textContent = urgencyLabel(state.urgency);
  $('vA').textContent = awareLabel(state.aware);
}

function loadScenario(id) {
  const L = buildScenario(id);
  state.layout = L; state.scenario = L.scenario;
  state.people = L.scenario.people; state.urgency = L.scenario.urgency; state.aware = L.scenario.aware;
  state.seed = 1234; state.ghost = null; state.undo = []; state.edited = false;
  ui.preview = null; ui.highlight = null;
  $('tooltip').hidden = true;
  sim.setLayout(L);
  applyParams();
  $('scenarioName').textContent = L.scenario.name;
  $('capTitle').textContent = L.scenario.name;
  $('capText').textContent = L.scenario.blurb;
  closeScenarioMenu();
  populate();
  fitView();
  setHeat('cong');
  updateUndo();
  updateBlockers();
}

function populate() {
  sim.populate(state.layout.spawns, state.people, state.seed, state.layout.fallback, state.layout.seats);
  hideReport();
  R.trailDirty = true;
  ui.playing = true;
  syncPlay();
}

function keepGhost() {
  if (sim.time > 8 && sim.samples.length > 4) state.ghost = sim.samples.slice();
}

function restart() { keepGhost(); populate(); toast('Restarted with the same crowd'); }
function newCrowd() { keepGhost(); state.seed = (state.seed * 7 + 13) % 100000; populate(); toast('New random crowd'); }

function pushUndo() {
  state.undo.push(sim.snapshot());
  if (state.undo.length > 40) state.undo.shift();
  state.edited = true;
  updateUndo();
}
function undo() {
  const s = state.undo.pop();
  if (!s) return;
  sim.restore(s);
  updateUndo();
  toast('Undid last edit');
}
function updateUndo() { $('undoBtn').disabled = !state.undo.length; }

const TOOL_HINTS = {
  wall: 'Drag to draw a wall. Hold <kbd>Shift</kbd> for any angle. Walls snap to 45° and to wall ends.',
  pillar: 'Click to place a pillar. Try one just in front of a busy door.',
  exit: 'Drag across a wall to cut a door with an exit. Click an existing exit to close or reopen it.',
  people: 'Drag to spray people in. Right-drag to remove them.',
  erase: 'Drag over walls, pillars or exits to erase them. Cutting a wall makes a doorway.',
};
function setTool(t) {
  ui.tool = t; ui.preview = null;
  document.querySelectorAll('.tool[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  const cv = $('view');
  cv.className = `tool-${t}`;
  const hint = TOOL_HINTS[t];
  $('caption').classList.toggle('tooling', !!hint);
  $('toolHint').innerHTML = hint || '';
  $('tooltip').hidden = true;
  updateBlockers();
}

function setHeat(h) {
  ui.heat = h;
  document.querySelectorAll('#heatSeg button').forEach((b) => b.classList.toggle('on', b.dataset.heat === h));
  const lg = document.querySelector('.legend'), info = HEAT[h];
  lg.classList.toggle('off', !info);
  const src = info || HEAT.cong;
  $('legendGrad').style.background = src.css;
  $('legendTicks').innerHTML = src.ticks.map((t) => `<span>${t}</span>`).join('');
  lg.title = src.unit;
}

function setSpeed(s) {
  ui.speed = s;
  document.querySelectorAll('#speedSeg button').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === s));
}

function syncPlay() { $('playBtn').classList.toggle('paused', !ui.playing); }
function togglePlay() {
  if (sim.complete && sim.n === 0) { restart(); return; }
  ui.playing = !ui.playing;
  syncPlay();
}

function warp(seconds) {
  const steps = Math.round(seconds / DT);
  for (let k = 0; k < steps && !sim.complete; k++) {
    sim.step();
    if (k % 8 === 7) sim.analyze(8 * DT);
  }
  sim.analyze(DT);
  updatePanel(app);
  return sim.time;
}

function onComplete() {
  const r = sim.report;
  const rec = {
    id: state.scenario.id, name: state.scenario.name, people: r.total, urgency: state.urgency, aware: state.aware,
    t: r.t100 ?? r.time, t90: r.t90, stalled: r.stalled, edited: state.edited,
  };
  const prev = [...state.history].reverse().find((h) => h.id === rec.id && !h.stalled);
  state.history.push(rec);
  showReport(app, r, prev);
  if (!r.stalled) setHeat('jam');
}

function fmtClock(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

function updateClock() {
  $('clock').textContent = fmtClock(sim.time);
  const p = $('statusPill');
  let cls = '', txt = 'RUNNING';
  if (sim.complete) { cls = sim.stalled ? 'stalled' : 'done'; txt = sim.stalled ? 'STALLED' : 'ALL OUT'; }
  else if (!sim.n) { cls = 'paused'; txt = 'EMPTY'; }
  else if (!ui.playing) { cls = 'paused'; txt = 'PAUSED'; }
  else if (state.simRate < ui.speed * 0.85 && ui.speed > 1) { cls = 'lag'; txt = `×${state.simRate.toFixed(1)}`; }
  if (p.textContent !== txt) p.textContent = txt;
  p.className = `status ${cls}`;
}

let last = performance.now(), acc = 0, panelT = 0;
function frame(now) {
  const dtw = Math.min(0.1, (now - last) / 1000);
  last = now;
  ui.now = now / 1000;
  let steps = 0;
  if (ui.playing && !sim.complete && sim.n > 0) {
    acc += dtw * ui.speed;
    const t0 = performance.now();
    while (acc >= DT) {
      sim.step(); acc -= DT; steps++;
      if (sim.complete) break;
      if ((steps & 7) === 0 && performance.now() - t0 > 13) break;
    }
    if (acc > 0.1) acc = 0.1;
    if (dtw > 0) state.simRate += ((steps * DT) / dtw - state.simRate) * 0.04;
  } else acc = 0;
  if (sim.dirty && !sim.holdRebuild && !steps) sim.rebuild();
  ui.advanced = steps > 0;
  if (steps) sim.analyze(steps * DT);
  if (sim.justCompleted) { sim.justCompleted = false; onComplete(); }
  else if (!sim.complete && !$('report').hidden) hideReport();
  app.onFrame?.(dtw);
  R.draw(ui);
  panelT += dtw;
  if (panelT >= 0.1) { panelT = 0; updatePanel(app); }
  updateClock();
  requestAnimationFrame(frame);
}

function boot() {
  initPanel(app);
  initInput(app);
  setSpeed(Number(params.get('speed')) || 1);
  setTool('inspect');
  resize();
  const sc = params.get('s');
  loadScenario(SCENARIOS.some((s) => s.id === sc) ? sc : 'hall');
  if (params.get('heat') && HEAT_ORDER.includes(params.get('heat'))) setHeat(params.get('heat'));
  if (params.get('t')) warp(Number(params.get('t')));
  window.addEventListener('resize', resize);
  $('scenarioBtn').addEventListener('click', (e) => { e.stopPropagation(); openScenarioMenu(app); });
  requestAnimationFrame((t) => { last = t; frame(t); });
  setTimeout(() => toast('Close an exit, draw a wall or spray in people, then watch where it jams.', 4200), 1200);
}

boot();

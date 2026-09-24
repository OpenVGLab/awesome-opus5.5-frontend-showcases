// state.js - the single source of truth: the parts on the workspace, the view,
// experiment progress, undo history and saving to the browser (localStorage).
import { PART_DEFS, WIRE_CYCLE } from './parts.js';

const STORAGE_KEY = 'circuit-lab.v1';

export const app = {
  parts: [],            // every component and wire on the workspace
  selectedId: null,
  view: { s: 1, tx: 0, ty: 0 },   // zoom (s) and pan (tx, ty) of the workspace
  result: null,         // result of the last "Start Test"
  stale: false,         // true once the circuit changed after the last test
  step: 0,              // index of the experiment step being shown
  done: [false, false, false, false, false, false],
  records: [],          // lab notebook rows
  autoTest: false,      // re-test automatically after every change
  muted: false,
  coachMin: false,      // experiment card collapsed?
  faultLoaded: false,   // the faulty circuit of step 6 is on the workspace
  wireColor: 0,
};

let seq = 1;
export const findPart = (id) => app.parts.find((p) => p.id === id) || null;

// Lowest free number for a prefix: R1, R2 ... (numbers of deleted parts are reused).
export function nextLabel(type) {
  const prefix = PART_DEFS[type].prefix;
  const used = new Set(app.parts.filter((p) => p.label.startsWith(prefix))
    .map((p) => Number(p.label.slice(prefix.length))));
  let n = 1;
  while (used.has(n)) n++;
  return prefix + n;
}
export function nextWireColor() {
  return WIRE_CYCLE[app.wireColor++ % WIRE_CYCLE.length];
}
export function addPart(p) {
  p.id = 'p' + seq++;
  if (!p.label) p.label = nextLabel(p.type);
  app.parts.push(p);
  return p;
}
export function removePart(id) {
  app.parts = app.parts.filter((p) => p.id !== id);
  if (app.selectedId === id) app.selectedId = null;
}
// Replaces the whole workspace (used by examples and "Clear").
export function setParts(list) {
  app.parts = [];
  app.selectedId = null;
  for (const p of list) addPart({ ...p, props: { ...p.props }, id: null, label: p.label || '' });
}
const syncSeq = () => {
  seq = 1 + app.parts.reduce((m, p) => Math.max(m, Number(String(p.id).slice(1)) || 0), 0);
};

// ---------- Undo / redo: snapshots of the parts list ----------
const undoStack = [];
const redoStack = [];
const snapshot = () => JSON.stringify(app.parts);
function restore(json) {
  app.parts = JSON.parse(json);
  syncSeq();
  if (!findPart(app.selectedId)) app.selectedId = null;
}
// Call BEFORE changing something, so the change can be undone.
export function checkpoint() {
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}
export function dropCheckpoint() { undoStack.pop(); }
export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  return true;
}
export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  return true;
}
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

// ---------- Saving in the browser ----------
export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1, parts: app.parts, step: app.step, done: app.done, records: app.records.slice(-40),
      autoTest: app.autoTest, muted: app.muted, coachMin: app.coachMin,
      faultLoaded: app.faultLoaded, wireColor: app.wireColor,
    }));
  } catch (e) { /* storage can be blocked (private mode); the lab still works */ }
}

const validPart = (p) => p && PART_DEFS[p.type] && typeof p.id === 'string' && p.props
  && (p.type === 'wire' ? [p.x1, p.y1, p.x2, p.y2] : [p.x, p.y, p.rot]).every(Number.isFinite);

// Returns true when a saved workspace was found and loaded.
export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!d || d.v !== 1 || !Array.isArray(d.parts)) return false;
    app.parts = d.parts.filter(validPart);
    syncSeq();
    app.step = Math.min(5, Math.max(0, d.step | 0));
    if (Array.isArray(d.done) && d.done.length === 6) app.done = d.done.map(Boolean);
    if (Array.isArray(d.records)) app.records = d.records;
    Object.assign(app, { autoTest: !!d.autoTest, muted: !!d.muted, coachMin: !!d.coachMin,
      faultLoaded: !!d.faultLoaded, wireColor: d.wireColor | 0 });
    return app.parts.length > 0;
  } catch (e) {
    return false;
  }
}
export function resetProgress() {
  app.step = 0;
  app.done = app.done.map(() => false);
  app.records = [];
  app.faultLoaded = false;
}

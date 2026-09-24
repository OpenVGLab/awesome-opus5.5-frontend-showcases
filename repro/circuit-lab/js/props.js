// props.js - the properties card (opened by double-clicking a component), the small
// floating toolbar above the selected component, and the readings tooltip.
import { PART_DEFS, WIRE_COLORS, bboxOf, iconMarkup, bulbResistance } from './parts.js';
import { app, findPart, checkpoint, dropCheckpoint } from './state.js';
import { fmtR, fmtI, fmtV, fmtP, trimNum, escapeHtml, clamp } from './util.js';
import { ICONS } from './icons.js';

// Which settings each component type has.
const FIELDS = {
  battery: [
    { key: 'emf', label: 'Voltage (EMF)', unit: 'V', min: 0.5, max: 24, step: 0.5, slider: true, presets: [1.5, 3, 4.5, 6, 9, 12] },
    { key: 'r', label: 'Internal resistance', unit: '\u03a9', min: 0, max: 20, step: 0.1, presets: [0, 0.5, 1, 2] },
  ],
  resistor: [
    { key: 'R', label: 'Resistance', unit: '\u03a9', min: 0.1, max: 1e6, step: 'any', log: true, presets: [5, 10, 20, 47, 100, 220, 1000] },
  ],
  bulb: [
    { key: 'ratedV', label: 'Rated voltage', unit: 'V', min: 0.5, max: 24, step: 0.1, presets: [1.5, 2.5, 3, 3.8, 6, 12] },
    { key: 'ratedP', label: 'Rated power', unit: 'W', min: 0.05, max: 50, step: 0.05, presets: [0.3, 0.6, 0.9, 1.8, 3] },
  ],
  switch: [{ key: 'closed', label: 'State', seg: [[false, 'Open'], [true, 'Closed']] }],
  ammeter: [{ key: 'range', label: 'Range', seg: [[0.6, '0 \u2013 0.6 A'], [3, '0 \u2013 3 A']] }],
  voltmeter: [{ key: 'range', label: 'Range', seg: [[3, '0 \u2013 3 V'], [15, '0 \u2013 15 V']] }],
  wire: [{ key: 'color', label: 'Colour', swatch: true }],
};
const NOTES = {
  battery: () => 'Current leaves through the + terminal. Internal resistance 0 \u03a9 means an ideal battery.',
  resistor: () => 'The colour bands on the resistor change with its value.',
  bulb: (p) => `Filament resistance R = U\u00b2 \u00f7 P = ${fmtR(bulbResistance(p.props))}. It shines fully at its rated voltage.`,
  switch: () => 'Tip: a single click on a switch also flips it.',
  ammeter: () => 'Ideal ammeter (0 \u03a9). Connect it in series, so current enters its + terminal.',
  voltmeter: () => 'Ideal voltmeter (\u221e \u03a9). Connect it across (in parallel with) a component.',
  wire: () => 'Ideal wire (0 \u03a9). Drag its ends onto terminals to connect things.',
};

export function createProps({ stage, renderer: R, actions }) {
  const card = document.getElementById('props');
  const selbar = document.getElementById('selbar');
  const tip = document.getElementById('tip');
  let editing = null;   // { id, original props, original label }

  // ---------- Properties card ----------
  function fieldHtml(p, f) {
    const v = p.props[f.key];
    if (f.seg) {
      return `<div class="field"><label>${f.label}</label><div class="seg">${f.seg.map(([val, txt]) =>
        `<button type="button" data-seg="${f.key}" data-val="${val}" class="${val === v ? 'on' : ''}">${txt}</button>`).join('')}</div></div>`;
    }
    if (f.swatch) {
      return `<div class="field"><label>${f.label}</label><div class="swatches">${Object.entries(WIRE_COLORS).map(([k, c]) =>
        `<button type="button" data-swatch="${k}" class="${k === v ? 'on' : ''}" style="--c:${c.fill}" title="${c.name}" aria-label="${c.name}"></button>`).join('')}</div></div>`;
    }
    const slider = f.slider ? `<input type="range" data-slider="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">` : '';
    return `<div class="field"><label for="f-${f.key}">${f.label}</label>
      <div class="num"><input id="f-${f.key}" type="number" data-num="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}"><span>${f.unit}</span></div>
      ${slider}
      <div class="chips">${f.presets.map((x) => `<button type="button" data-preset="${f.key}" data-val="${x}">${f.key === 'R' ? fmtR(x) : trimNum(x) + ' ' + f.unit}</button>`).join('')}</div>
      <div class="err" data-err="${f.key}">Allowed: ${trimNum(f.min)} \u2013 ${f.max >= 1e6 ? '1 M' : trimNum(f.max)} ${f.unit}</div></div>`;
  }

  function open(id) {
    const p = findPart(id);
    if (!p) return;
    if (editing) close(true);
    checkpoint();
    editing = { id, props: JSON.stringify(p.props), label: p.label, stale: app.stale };
    const def = PART_DEFS[p.type];
    card.innerHTML = `
      <div class="props-head">
        <div class="props-icon"><svg viewBox="-48 -30 96 60">${iconMarkup(p.type)}</svg></div>
        <div class="props-titles"><div class="props-title">${def.name}${p.type === 'wire' ? '' : ' ' + escapeHtml(p.label)}</div><div class="props-sub">Set its properties</div></div>
        <button type="button" class="icon-btn" data-act="cancel" title="Close (Esc)" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="props-body">
        ${FIELDS[p.type].map((f) => fieldHtml(p, f)).join('')}
        ${p.type === 'wire' ? '' : `<div class="field field-inline"><label for="f-label">Label</label><input id="f-label" type="text" maxlength="6" value="${escapeHtml(p.label)}" data-label></div>`}
        <p class="props-note" data-note>${NOTES[p.type](p)}</p>
      </div>
      <div class="props-foot">
        <button type="button" class="btn danger" data-act="delete">${ICONS.trash}Delete</button>
        <span class="grow"></span>
        <button type="button" class="btn" data-act="cancel">Cancel</button>
        <button type="button" class="btn primary" data-act="apply">Apply</button>
      </div>`;
    card.hidden = false;
    tip.hidden = true;
    hideSelbar();
    place(p);
    const first = card.querySelector('input[type=number]');
    if (first) { first.focus(); first.select(); }
  }

  // Put the card beside the component, inside the workspace.
  function place(p) {
    const sr = stage.getBoundingClientRect();
    const b = bboxOf(p, 6);
    const a = R.worldToScreen(b.x, b.y), z = R.worldToScreen(b.x + b.w, b.y + b.h);
    const w = card.offsetWidth, h = card.offsetHeight;
    let x = z.x - sr.left + 14;
    if (x + w > sr.width - 12) x = a.x - sr.left - w - 14;
    x = clamp(x, 12, Math.max(12, sr.width - w - 12));
    const y = clamp((a.y + z.y) / 2 - sr.top - h / 2, 12, Math.max(12, sr.height - h - 12));
    card.style.left = x + 'px';
    card.style.top = y + 'px';
  }

  // Changes are shown on the workspace straight away (live preview).
  function setProp(key, value) {
    const p = findPart(editing.id);
    p.props[key] = value;
    const note = card.querySelector('[data-note]');
    if (note) note.textContent = NOTES[p.type](p);
    actions.changed({ live: true });
  }
  card.addEventListener('input', (e) => {
    if (!editing) return;
    const t = e.target;
    const key = t.dataset.num || t.dataset.slider;
    if (key) {
      const p = findPart(editing.id);
      const f = FIELDS[p.type].find((x) => x.key === key);
      const v = parseFloat(t.value);
      const ok = Number.isFinite(v) && v >= f.min && v <= f.max;
      card.querySelector(`[data-err="${key}"]`).classList.toggle('show', !ok);
      card.querySelector(`[data-num="${key}"]`).classList.toggle('bad', !ok);
      if (!ok) return;
      if (t.dataset.slider) card.querySelector(`[data-num="${key}"]`).value = v;
      const s = card.querySelector(`[data-slider="${key}"]`);
      if (s && t.dataset.num) s.value = v;
      setProp(key, v);
    }
  });
  card.addEventListener('click', (e) => {
    if (!editing) return;
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.seg) {
      const val = b.dataset.val === 'true' ? true : b.dataset.val === 'false' ? false : parseFloat(b.dataset.val);
      card.querySelectorAll(`[data-seg="${b.dataset.seg}"]`).forEach((x) => x.classList.toggle('on', x === b));
      setProp(b.dataset.seg, val);
    } else if (b.dataset.swatch) {
      card.querySelectorAll('[data-swatch]').forEach((x) => x.classList.toggle('on', x === b));
      setProp('color', b.dataset.swatch);
    } else if (b.dataset.preset) {
      const input = card.querySelector(`[data-num="${b.dataset.preset}"]`);
      input.value = b.dataset.val;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (b.dataset.act === 'apply') close(true);
    else if (b.dataset.act === 'cancel') close(false);
    else if (b.dataset.act === 'delete') {
      const p = findPart(editing.id);
      close(false);
      actions.remove(p);
    }
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); close(true); }
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
  });

  // apply = keep the new values; otherwise restore the old ones.
  function close(apply) {
    if (!editing) return;
    const p = findPart(editing.id);
    const ed = editing;
    editing = null;
    card.hidden = true;
    if (!p) return;
    const labelInput = card.querySelector('[data-label]');
    if (apply && labelInput) {
      const txt = labelInput.value.trim().replace(/[^\w.-]/g, '').slice(0, 6);
      if (txt) p.label = txt;
    }
    if (!apply) { p.props = JSON.parse(ed.props); p.label = ed.label; }
    if (JSON.stringify(p.props) !== ed.props || p.label !== ed.label) {
      actions.changed({});
      actions.sfx('tick');
    } else {
      // Nothing really changed, so the last test result is still valid.
      dropCheckpoint();
      actions.restoreStale(ed.stale);
    }
  }

  // ---------- Floating toolbar above the selected component ----------
  selbar.innerHTML = `
    <button type="button" data-sel="rotate" title="Rotate (R)" aria-label="Rotate">${ICONS.rotate}</button>
    <button type="button" data-sel="props" title="Properties (double-click)" aria-label="Properties">${ICONS.sliders}</button>
    <button type="button" data-sel="toggle" title="Open / close (Space)" aria-label="Flip switch">${ICONS.power}</button>
    <button type="button" data-sel="delete" title="Delete (Del)" aria-label="Delete">${ICONS.trash}</button>`;
  selbar.addEventListener('pointerdown', (e) => e.stopPropagation());
  selbar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sel]');
    const p = findPart(app.selectedId);
    if (!b || !p) return;
    if (b.dataset.sel === 'rotate') actions.rotate(p);
    if (b.dataset.sel === 'props') open(p.id);
    if (b.dataset.sel === 'toggle') actions.toggleSwitch(p);
    if (b.dataset.sel === 'delete') actions.remove(p);
  });
  function updateSelbar() {
    const p = findPart(app.selectedId);
    if (!p || editing) { hideSelbar(); return; }
    selbar.querySelector('[data-sel="toggle"]').style.display = p.type === 'switch' ? '' : 'none';
    selbar.hidden = false;
    const sr = stage.getBoundingClientRect();
    const b = bboxOf(p, 8);
    // Horizontal parts carry their label above them: keep the toolbar above the label.
    const labelRoom = p.type !== 'wire' && p.rot % 2 === 0 ? 18 : 0;
    const a = R.worldToScreen(b.x, b.y - labelRoom), z = R.worldToScreen(b.x + b.w, b.y + b.h);
    const w = selbar.offsetWidth, h = selbar.offsetHeight;
    let y = a.y - sr.top - h - 6;
    if (y < 8) y = z.y - sr.top + 8;
    selbar.style.left = clamp((a.x + z.x) / 2 - sr.left - w / 2, 8, Math.max(8, sr.width - w - 8)) + 'px';
    selbar.style.top = clamp(y, 8, Math.max(8, sr.height - h - 8)) + 'px';
  }
  function hideSelbar() { selbar.hidden = true; }

  // ---------- Tooltip with the readings of one component ----------
  function hover(id, cx, cy) {
    const res = app.result && !app.stale && app.result.status === 'ok' ? app.result : null;
    const p = id ? findPart(id) : null;
    const inf = p && res ? res.info.get(p.id) : null;
    if (!inf || editing) { tip.hidden = true; return; }
    const rows = [];
    if (p.type === 'ammeter') rows.push(['Reading', (inf.reading < 0 ? '\u2212' : '') + fmtI(inf.reading)]);
    else if (p.type === 'voltmeter') rows.push(['Reading', (inf.reading < 0 ? '\u2212' : '') + fmtV(inf.reading)]);
    else {
      if (inf.U !== undefined) rows.push([p.type === 'battery' ? 'Terminal voltage' : 'Voltage U', fmtV(inf.U)]);
      if (inf.I !== undefined) rows.push(['Current I', fmtI(inf.I)]);
      if (inf.P !== undefined) rows.push([p.type === 'battery' ? 'Power delivered' : 'Power P', fmtP(inf.P)]);
      if (inf.brightness !== undefined) rows.push(['Brightness', Math.round(Math.min(inf.brightness, 9.99) * 100) + ' %']);
    }
    const name = p.type === 'wire' ? `${(WIRE_COLORS[p.props.color] || WIRE_COLORS.red).name} wire` : `${escapeHtml(p.label)} \u00b7 ${PART_DEFS[p.type].name}`;
    tip.innerHTML = `<b>${name}</b>${rows.map(([k, v]) => `<div><span>${k}</span><em>${v}</em></div>`).join('')}`;
    tip.hidden = false;
    const sr = stage.getBoundingClientRect();
    const x = clamp(cx - sr.left + 16, 8, sr.width - tip.offsetWidth - 8);
    const y = clamp(cy - sr.top + 18, 8, sr.height - tip.offsetHeight - 8);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  return { open, close, isOpen: () => !!editing, updateSelbar, hideSelbar, hover, reposition: () => { if (editing) place(findPart(editing.id)); } };
}

// ui.js - everything around the workspace: component palette, examples, experiment
// steps, the test result panel, readings table, lab notebook, status line and toasts.
import { PART_DEFS, PALETTE_ORDER, iconMarkup } from './parts.js';
import { EXAMPLES, EXAMPLE_MENU, STEPS } from './experiments.js';
import { app, findPart, canUndo, canRedo } from './state.js';
import { fmtI, fmtV, fmtR, fmtP, escapeHtml } from './util.js';
import { ICONS } from './icons.js';

const $ = (id) => document.getElementById(id);
const DASH = '\u2014';
const sign = (v) => (v < -1e-9 ? '\u2212' : '');
// "0.300 A" -> ["0.300", "A"] so the unit can be drawn smaller.
const splitUnit = (s) => { const i = s.lastIndexOf(' '); return [s.slice(0, i), s.slice(i + 1)]; };

export function createUI({ actions }) {
  // ---------- Palette and examples (built once) ----------
  $('palette').innerHTML = PALETTE_ORDER.map((type) => {
    const def = PART_DEFS[type];
    return `<button type="button" class="pcard" data-palette="${type}" title="Drag ${def.name.toLowerCase()} onto the workspace (or click to add)">
      <svg viewBox="-48 -30 96 60" aria-hidden="true">${iconMarkup(type)}</svg>
      <span class="ptext"><span class="pname">${def.name}</span><span class="pblurb">${def.blurb}</span></span></button>`;
  }).join('');
  $('examples').innerHTML = EXAMPLE_MENU.map((k) => `<button type="button" class="ex ex-${k}" data-example="${k}" title="${EXAMPLES[k].desc}">
      <span class="ex-dot"></span><span class="ex-name">${EXAMPLES[k].name}</span>${ICONS.arrowRight}</button>`).join('');
  $('examples').addEventListener('click', (e) => {
    const b = e.target.closest('[data-example]');
    if (b) actions.loadExample(b.dataset.example);
  });

  // ---------- Experiment steps: stepper in the header + instruction card ----------
  function renderSteps() {
    $('stepper').innerHTML = STEPS.map((s, i) => `${i ? `<span class="stp-line${app.done[i - 1] ? ' done' : ''}"></span>` : ''}
      <button type="button" class="stp${app.done[i] ? ' done' : ''}${i === app.step ? ' active' : ''}" data-step="${i}" title="Step ${i + 1}: ${s.title}">
        <span class="stp-dot">${app.done[i] ? ICONS.check : i + 1}</span><span class="stp-txt">${s.short}</span></button>`).join('');
    renderCoach();
  }
  $('stepper').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b) actions.goStep(+b.dataset.step);
  });

  function renderCoach() {
    const i = app.step, s = STEPS[i], done = app.done[i], el = $('coach');
    el.classList.toggle('min', app.coachMin);
    if (app.coachMin) {
      el.innerHTML = `<button type="button" class="coach-pill" data-coach="max" title="Show the instructions">${ICONS.flask}
        <span>Step ${i + 1}/${STEPS.length} \u00b7 ${s.title}</span>${done ? `<span class="pill-ok">${ICONS.check}</span>` : ''}${ICONS.chevronDown}</button>`;
      return;
    }
    el.innerHTML = `
      <div class="coach-top"><span class="kicker">${ICONS.flask}Experiment \u00b7 step ${i + 1} of ${STEPS.length}</span>
        <button type="button" class="icon-btn sm" data-coach="min" title="Hide the instructions" aria-label="Hide the instructions">${ICONS.chevronUp}</button></div>
      <h3>${s.title}</h3>
      <p>${s.text}</p>
      <div class="goal${done ? ' done' : ''}">${done ? ICONS.check : ICONS.target}<span>${done ? 'Done! ' : 'Goal: '}${s.goal}</span></div>
      <div class="coach-actions">
        <button type="button" class="btn sm" data-coach="prev" ${i === 0 ? 'disabled' : ''} title="Previous step" aria-label="Previous step">${ICONS.arrowLeft}</button>
        <button type="button" class="btn sm" data-coach="starter" title="Put the parts for this step on the workspace">${ICONS.layers}Load starter</button>
        <span class="grow"></span>
        <button type="button" class="btn sm${done ? ' primary pulse' : ''}" data-coach="next" ${i === STEPS.length - 1 ? 'disabled' : ''}>Next${ICONS.arrowRight}</button>
      </div>`;
  }
  $('coach').addEventListener('click', (e) => {
    const b = e.target.closest('[data-coach]');
    if (!b) return;
    const a = b.dataset.coach;
    if (a === 'min' || a === 'max') { app.coachMin = a === 'min'; renderCoach(); actions.saveOnly(); }
    else if (a === 'prev') actions.goStep(app.step - 1);
    else if (a === 'next') actions.goStep(app.step + 1);
    else if (a === 'starter') actions.loadExample(STEPS[app.step].starter);
  });

  // ---------- Test result panel ----------
  const head = (icon, title, sub) => `<div class="res-head"><span class="res-icon">${icon}</span><div><div class="res-title">${title}</div>${sub ? `<div class="res-sub">${sub}</div>` : ''}</div></div>`;

  function renderResult() {
    const r = app.result, el = $('result');
    if (!r) {
      el.className = 'res res-idle';
      el.innerHTML = head(ICONS.flask, 'Ready to test', 'Build a circuit, then press <b>Start Test</b> to check whether it is closed.');
      renderReadings();
      return;
    }
    let html = app.stale ? `<div class="stale">${ICONS.info}<span>The circuit changed \u2013 press Start Test again.</span></div>` : '';
    if (r.status === 'ok') {
      const m = r.main;
      const [num, unit] = splitUnit(fmtI(m.I));
      html += head(ICONS.okCircle, 'Circuit closed', m.I > 1e-9
        ? `Current flows out of the + terminal of ${escapeHtml(m.battery)}, round the loop and back to its \u2212 terminal.`
        : 'The loop is closed, but no current flows.');
      html += `<div class="big"><div class="big-label">Current intensity (I)</div><div class="big-value">${num}<small>${unit}</small></div></div>
        <div class="stats"><div><span>Voltage U</span><b>${fmtV(m.U)}</b></div>
        <div><span>Resistance R</span><b>${m.multi || !isFinite(m.R) ? DASH : fmtR(m.R)}</b></div>
        <div><span>Power P</span><b>${fmtP(m.P)}</b></div></div>`;
    } else if (r.status === 'open') {
      html += head(ICONS.xCircle, 'Circuit is open', 'No current can flow. The disconnected spots are highlighted in red on the workspace.');
    } else if (r.status === 'short') {
      html += head(ICONS.bolt, 'Short circuit!', 'Nothing limits the current. The dangerous path is highlighted.');
    } else if (r.status === 'nobattery') {
      html += head(ICONS.alert, 'No power source', '');
    } else if (r.status === 'empty') {
      html += head(ICONS.flask, 'Nothing to test', '');
    } else {
      html += head(ICONS.alert, 'Cannot solve the circuit', '');
    }
    if (r.issues.length) {
      html += `<ul class="issues">${r.issues.map((iss) => `<li class="sev-${iss.sev}"${iss.num ? ` data-num="${iss.num}"` : ''}>
        ${iss.num ? `<span class="num">${iss.num}</span>` : `<span class="dot">${iss.sev === 'info' ? ICONS.info : ICONS.alert}</span>`}
        <span class="txt">${escapeHtml(iss.text)}</span></li>`).join('')}</ul>`;
    }
    const kind = r.status === 'ok' ? 'ok' : r.status === 'empty' ? 'idle' : 'bad';
    el.className = `res res-${kind}${app.stale ? ' is-stale' : ''} pop-in`;
    el.innerHTML = html;
    renderReadings();
  }
  // Pointing at a problem in the list makes its marker on the workspace flash.
  $('result').addEventListener('mouseover', (e) => {
    const li = e.target.closest('li[data-num]');
    if (li) actions.flashIssue(+li.dataset.num, true);
  });
  $('result').addEventListener('mouseout', (e) => {
    const li = e.target.closest('li[data-num]');
    if (li) actions.flashIssue(+li.dataset.num, false);
  });

  // ---------- Readings of every component ----------
  function renderReadings() {
    const r = app.result, box = $('readings');
    if (!r || r.status !== 'ok' || app.stale) { box.hidden = true; return; }
    const order = ['battery', 'resistor', 'bulb', 'switch', 'ammeter', 'voltmeter'];
    const list = app.parts.filter((p) => p.type !== 'wire').sort((a, b) =>
      order.indexOf(a.type) - order.indexOf(b.type) || a.label.localeCompare(b.label, undefined, { numeric: true }));
    box.querySelector('tbody').innerHTML = list.map((p) => {
      const inf = r.info.get(p.id) || {};
      let U = DASH, I = DASH, P = DASH;
      if (p.type === 'ammeter') I = sign(inf.reading) + fmtI(inf.reading);
      else if (p.type === 'voltmeter') U = sign(inf.reading) + fmtV(inf.reading);
      else {
        if (inf.U !== undefined) U = fmtV(inf.U);
        if (inf.I !== undefined) I = sign(inf.I) + fmtI(inf.I);
        if (inf.P !== undefined) P = sign(inf.P) + fmtP(inf.P);
      }
      const bar = p.type === 'bulb' ? `<i class="bright" title="Brightness" style="--b:${Math.min(1, inf.brightness || 0).toFixed(2)}"></i>` : '';
      return `<tr><td><span class="tag tag-${p.type}">${escapeHtml(p.label)}</span>${bar}</td><td>${U}</td><td>${I}</td><td>${P}</td></tr>`;
    }).join('');
    box.hidden = false;
  }

  // ---------- Lab notebook: one row per test ----------
  function renderRecords() {
    const rows = app.records.slice(-8).reverse();
    $('records').querySelector('tbody').innerHTML = rows.length
      ? rows.map((x) => `<tr class="rec-${x.status}"><td>${x.n}</td><td><span class="rec-tag">${x.label}</span></td><td>${x.U}</td><td>${x.I}</td><td>${x.R}</td></tr>`).join('')
      : `<tr class="empty"><td colspan="5">Every test you run is written down here.</td></tr>`;
  }

  // ---------- Small things ----------
  function renderStatus(topo) {
    const n = app.parts.length, c = topo ? topo.contacts.length : 0, l = topo ? topo.loose.length : 0;
    $('status').innerHTML = `<span>${n} part${n === 1 ? '' : 's'}</span><span><i class="dot-c"></i>${c} contact point${c === 1 ? '' : 's'}</span><span><i class="dot-l"></i>${l} loose end${l === 1 ? '' : 's'}</span>`;
    $('emptyHint').hidden = n > 0;
  }
  function toast(msg, kind = 'info', ms = 2800) {
    const box = $('toasts');
    const t = document.createElement('div');
    t.className = 'toast toast-' + kind;
    t.innerHTML = (kind === 'ok' ? ICONS.check : kind === 'bad' ? ICONS.alert : ICONS.info) + `<span>${msg}</span>`;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); }, ms);
  }
  function setTesting(on) {
    $('btnTest').classList.toggle('testing', on);
    $('btnTest').disabled = on;
    $('btnTestLabel').textContent = on ? 'Testing\u2026' : 'Start Test';
    $('stage').classList.toggle('scanning', on);
  }
  function updateButtons() {
    $('btnUndo').disabled = !canUndo();
    $('btnRedo').disabled = !canRedo();
    const sel = findPart(app.selectedId);
    $('btnRotate').disabled = !sel;
    $('btnDelete').disabled = !sel;
    $('btnSound').innerHTML = app.muted ? ICONS.mute : ICONS.sound;
    $('btnSound').title = app.muted ? 'Sound is off' : 'Sound is on';
    $('autoTest').checked = app.autoTest;
  }
  const zoomLabel = () => { $('zoomPct').textContent = Math.round(app.view.s * 100) + '%'; };
  // Space taken by the instruction card at the top of the workspace.
  const coachRoom = () => { const el = $('coach'); return el.offsetTop + el.offsetHeight + 12; };

  return { renderSteps, renderCoach, renderResult, renderReadings, renderRecords, renderStatus, toast, setTesting, updateButtons, zoomLabel, coachRoom };
}

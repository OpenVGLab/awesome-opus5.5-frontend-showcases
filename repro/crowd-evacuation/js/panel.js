// Side panel, report card, scenario gallery and hover tips.
import { DANGER } from './core.js';
import { EXIT_COLORS, EXIT_GREEN, drawChart } from './render.js';
import { buildScenario } from './scenarios.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtMin = (sec) => { const m = sec / 60; return m >= 10 ? m.toFixed(0) : m.toFixed(1); };
const fmtT = (t) => (t == null ? '–' : t >= 60 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}` : `${t.toFixed(1)} s`);

let exitKey = '', jamKey = '';

export function initPanel(app) {
  const { state, ui, sim } = app;
  const sN = $('sN'), sU = $('sU'), sA = $('sA');
  const fill = (el) => el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
  sN.addEventListener('input', () => { $('vN').textContent = sN.value; fill(sN); });
  sN.addEventListener('change', () => {
    state.people = Number(sN.value);
    app.populate();
    app.toast(`Restarted with ${sim.n} people`);
  });
  sU.addEventListener('input', () => { state.urgency = Number(sU.value); app.applyParams(); });
  sA.addEventListener('input', () => { state.aware = Number(sA.value); app.applyParams(); });

  document.querySelectorAll('#heatSeg button').forEach((b) => b.addEventListener('click', () => app.setHeat(b.dataset.heat)));
  document.querySelectorAll('#speedSeg button').forEach((b) => b.addEventListener('click', () => app.setSpeed(Number(b.dataset.speed))));
  document.querySelectorAll('.tool[data-tool]').forEach((b) => b.addEventListener('click', () => app.setTool(b.dataset.tool)));
  $('playBtn').addEventListener('click', app.togglePlay);
  $('resetBtn').addEventListener('click', app.restart);
  $('shuffleBtn').addEventListener('click', app.newCrowd);
  $('undoBtn').addEventListener('click', app.undo);
  $('clearCrowdBtn').addEventListener('click', () => {
    sim.n = 0; sim.resetStats(); app.R.trailDirty = true; hideReport();
    app.toast('Crowd removed. Use the People tool to add some.');
  });
  $('restoreBtn').addEventListener('click', () => { app.loadScenario(state.scenario.id); app.toast('Original floor plan restored'); });

  const tColor = $('tColor'), tTrails = $('tTrails'), tRoutes = $('tRoutes');
  app.toggleColor = () => {
    ui.color = ui.color === 'speed' ? 'exit' : 'speed';
    tColor.querySelector('span').textContent = ui.color === 'speed' ? 'Speed' : 'By exit';
    tColor.querySelector('.dot').className = `dot ${ui.color}`;
    tColor.classList.toggle('on', ui.color === 'exit');
  };
  app.toggleTrails = () => { ui.trails = !ui.trails; app.R.trailDirty = true; tTrails.classList.toggle('on', ui.trails); };
  app.toggleRoutes = () => { ui.routes = !ui.routes; tRoutes.classList.toggle('on', ui.routes); };
  tColor.addEventListener('click', app.toggleColor);
  tTrails.addEventListener('click', app.toggleTrails);
  tRoutes.addEventListener('click', app.toggleRoutes);

  const zoomCenter = (f) => { const r = app.R.region; app.R.zoomAt(r.x + r.w / 2, r.y + r.h / 2, f); state.viewTouched = true; };
  $('zoomIn').addEventListener('click', () => zoomCenter(1.25));
  $('zoomOut').addEventListener('click', () => zoomCenter(0.8));
  $('zoomFit').addEventListener('click', app.fitView);

  app.toggleHelp = (show) => { const h = $('help'); h.hidden = show === undefined ? !h.hidden : !show; };
  $('helpBtn').addEventListener('click', () => app.toggleHelp());
  $('helpClose').addEventListener('click', () => app.toggleHelp(false));
  $('help').addEventListener('click', (e) => { if (e.target.id === 'help') app.toggleHelp(false); });

  const jl = $('jamList');
  jl.addEventListener('mouseover', (e) => { const r = e.target.closest('.jam-row'); ui.highlight = r ? Number(r.dataset.id) || null : null; });
  jl.addEventListener('mouseleave', () => { ui.highlight = null; });

  initTips();
}

function initTips() {
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.hidden = true;
  document.body.appendChild(tip);
  let cur = null;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el === cur) return;
    cur = el;
    if (!el || e.pointerType === 'touch') { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    let x, y;
    if (el.closest('#toolbar')) { x = r.right + 10; y = r.top + r.height / 2 - h / 2; }
    else if (el.closest('#bottombar') || el.closest('#zoomCtl')) { x = r.left + r.width / 2 - w / 2; y = r.top - h - 8; }
    else { x = r.left + r.width / 2 - w / 2; y = r.bottom + 8; }
    tip.style.left = `${Math.max(6, Math.min(innerWidth - w - 6, x))}px`;
    tip.style.top = `${Math.max(6, Math.min(innerHeight - h - 6, y))}px`;
  });
  document.addEventListener('pointerdown', () => { tip.hidden = true; cur = null; });
}

function exitFlow(e, now) {
  let k = e.times.length - 1, c = 0;
  while (k >= 0 && e.times[k] > now - 5) { c++; k--; }
  return c / Math.min(5, Math.max(1, now));
}

function renderExits(app) {
  const { sim, ui } = app, box = $('exitList');
  const key = sim.exits.map((e) => `${e.label}${e.open ? 1 : 0}${e.familiar ? 1 : 0}${e.name}`).join('|') + ui.color;
  if (key !== exitKey) {
    exitKey = key;
    box.innerHTML = '';
    if (!sim.exits.length) box.innerHTML = '<div class="exit-empty">No exits. Use the Exit tool to add one.</div>';
    sim.exits.forEach((e, k) => {
      const col = ui.color === 'exit' ? EXIT_COLORS[k % EXIT_COLORS.length] : EXIT_GREEN;
      const b = document.createElement('button');
      b.className = `exit-row${e.open ? '' : ' closed'}`;
      b.innerHTML = `<span class="badge" style="background:${col}">${e.label}</span>`
        + `<span class="nm">${esc(e.name)}${e.familiar ? '' : '<em>unfamiliar</em>'}</span>`
        + `<span class="meter"><i style="background:${col}"></i></span><span class="ct">0</span><span class="fl">–</span>`;
      b.addEventListener('click', () => {
        app.pushUndo();
        sim.toggleExit(e);
        app.toast(e.open ? `Exit ${e.label} reopened` : `Exit ${e.label} closed. The crowd re-routes.`);
      });
      box.appendChild(b);
    });
  }
  const max = Math.max(1, ...sim.exits.map((e) => e.count));
  [...box.querySelectorAll('.exit-row')].forEach((row, k) => {
    const e = sim.exits[k];
    if (!e) return;
    row.querySelector('.ct').textContent = e.count;
    row.querySelector('.fl').textContent = e.open ? `${exitFlow(e, sim.time).toFixed(1)}/s` : 'shut';
    row.querySelector('.meter i').style.width = `${(e.count / max) * 100}%`;
  });
}

function renderJams(app) {
  const { sim, ui } = app;
  const whole = ui.heat === 'jam' || sim.complete;
  const items = whole
    ? sim.jamPins.slice(0, 3).map((p, k) => ({ id: `p${k}`, name: p.name, stat: `${fmtMin(p.sec)} person-min` }))
    : sim.hotspots.slice(0, 3).map((h) => ({ id: h.id, name: h.name, stat: `${Math.round(h.ppl)} people · ${h.peak.toFixed(1)}/m²` }));
  const key = `${whole}|${items.map((i) => i.id + i.name + i.stat).join('|')}|${sim.n > 0}`;
  if (key === jamKey) return;
  jamKey = key;
  $('jamHint').textContent = whole ? 'whole run · time lost' : 'live · queueing now';
  $('jamList').innerHTML = items.length
    ? items.map((it, k) => `<div class="jam-row${k ? ' cool' : ''}" data-id="${it.id}"><span class="n">${k + 1}</span><span class="t">${esc(it.name)}</span><span class="s">${it.stat}</span></div>`).join('')
    : `<div class="jam-none">${!sim.n ? 'Nobody inside.' : whole ? 'Nothing has jammed yet.' : 'No jams right now: the crowd is flowing.'}</div>`;
}

export function updatePanel(app) {
  const { sim, state } = app;
  const tot = sim.total, pct = tot ? (sim.evacuated / tot) * 100 : 0;
  $('kEvac').textContent = sim.evacuated;
  $('kEvacOf').textContent = `/ ${tot}`;
  $('kPct').textContent = `${pct.toFixed(0)}%`;
  $('kBar').style.width = `${pct}%`;
  $('kFlow').textContent = sim.flow.toFixed(1);
  $('kDens').textContent = sim.curMaxDensity.toFixed(1);
  $('kStuck').textContent = sim.stuckCount;
  $('kRisk').textContent = sim.dangerCount;
  $('kRisk').parentElement.classList.toggle('on', sim.dangerCount > 0);
  drawChart($('chart'), sim, state.ghost);
  renderExits(app);
  renderJams(app);
}

function tipFor(r) {
  if (r.stalled) return `${r.trapped} people have no route to an open exit. Reopen an exit or erase a wall to let them out.`;
  const tot = r.evacuated || 1, open = r.exits.filter((e) => e.open);
  const idle = open.filter((e) => e.count / tot < 0.05);
  const busiest = open.reduce((a, e) => (!a || e.count > a.count ? e : a), null);
  if (r.peakPressure > DANGER) return `Body pressure reached ${(r.peakPressure / 1000).toFixed(1)} kN, the level where people get crushed. Lower the urgency, widen the choke point or put a pillar in front of it.`;
  if (idle.length && busiest && busiest.count / tot > 0.35) {
    return `Exit${idle.length > 1 ? 's' : ''} ${idle.map((e) => e.label).join(', ')} carried almost nobody while exit ${busiest.label} took ${Math.round((busiest.count / tot) * 100)}%. Raise exit knowledge and run again.`;
  }
  if (r.spots[0]) return `Most time was lost at ${r.spots[0].name}. Widen it with the eraser or add an exit nearby, then run again to compare.`;
  return 'Close the busiest exit or draw a wall, then run again to compare.';
}

export function showReport(app, r, prev) {
  const el = $('report');
  const t = r.t100 ?? r.time;
  let delta = '';
  if (prev && !r.stalled) {
    const d = t - prev.t;
    if (Math.abs(d) >= 0.05) delta = `<span class="delta ${d < 0 ? 'better' : 'worse'}">${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(1)} s vs last run</span>`;
  }
  const spots = r.spots.length
    ? `<h5>Worst jams · person-minutes lost</h5><ol>${r.spots.map((s, k) => `<li><i>${k + 1}</i><b>${esc(s.name)}</b><span>${fmtMin(s.sec)}</span></li>`).join('')}</ol>`
    : '';
  el.className = `glass${r.stalled ? ' stalled' : ''}`;
  el.innerHTML = `<button class="x" data-a="close" aria-label="Close">×</button>
    <div class="head"><small>${r.stalled ? 'Evacuation stalled' : 'Everyone is out'}</small>${delta}</div>
    <h2>${r.stalled ? `${r.trapped} people trapped` : `All ${r.total} out in <span>${fmtT(t)}</span>`}</h2>
    <div class="stats">
      <div><label>90% out</label><b>${fmtT(r.t90)}</b></div>
      <div><label>Max density</label><b>${r.peakDensity.toFixed(1)}/m²</b></div>
      <div><label>Avg. stuck</label><b>${r.avgStuck.toFixed(0)} s</b></div>
      <div><label>Peak push</label><b>${(r.peakPressure / 1000).toFixed(1)} kN</b></div>
    </div>
    ${spots}
    <p class="tip">${esc(tipFor(r))}</p>
    <div class="actions"><button class="primary" data-a="again">Run again</button><button data-a="map">${app.ui.heat === 'jam' ? 'Live view' : 'Jam map'}</button><button data-a="close">Close</button></div>`;
  el.hidden = false;
  el.onclick = (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'again') app.restart();
    else if (a === 'map') { app.setHeat(app.ui.heat === 'jam' ? 'cong' : 'jam'); hideReport(); }
    else if (a === 'close') hideReport();
  };
}

export function hideReport() { $('report').hidden = true; }

function drawThumb(cv, L) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = 96, H = 60;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'), v = L.view;
  const s = Math.min(W / (v.x1 - v.x0), H / (v.y1 - v.y0));
  const ox = (W - (v.x1 - v.x0) * s) / 2 - v.x0 * s, oy = (H - (v.y1 - v.y0) * s) / 2 - v.y0 * s;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
  ctx.fillStyle = '#101a2e';
  for (const f of L.floors) ctx.fillRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  ctx.fillStyle = 'rgba(112,200,255,0.35)';
  for (const sp of L.spawns) ctx.fillRect(sp.x0, sp.y0, sp.x1 - sp.x0, sp.y1 - sp.y0);
  for (const st of L.seats) ctx.fillRect(st.x - 0.25, st.y - 0.25, 0.5, 0.5);
  ctx.lineCap = 'square';
  for (const sg of L.segs) {
    ctx.strokeStyle = sg.kind === 'wall' ? '#cdd7ea' : sg.kind === 'seat' ? '#55648a' : '#34426a';
    ctx.lineWidth = Math.max(sg.t, 1.1 / s);
    ctx.beginPath(); ctx.moveTo(sg.x0, sg.y0); ctx.lineTo(sg.x1, sg.y1); ctx.stroke();
  }
  ctx.fillStyle = '#cdd7ea';
  for (const p of L.pillars) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = EXIT_GREEN;
  for (const e of L.exits) ctx.fillRect(e.x0 - 0.3, e.y0 - 0.3, e.x1 - e.x0 + 0.6, e.y1 - e.y0 + 0.6);
}

let outside = null;
export function openScenarioMenu(app) {
  const m = $('scenarioMenu');
  if (!m.hidden) { closeScenarioMenu(); return; }
  if (!m.childElementCount) {
    for (const sc of app.SCENARIOS) {
      const b = document.createElement('button');
      b.className = 'sc-card'; b.dataset.id = sc.id;
      b.innerHTML = `<canvas></canvas><div><b>${esc(sc.name)}</b><small>${esc(sc.blurb)}</small></div>`;
      b.addEventListener('click', () => app.loadScenario(sc.id));
      m.appendChild(b);
      drawThumb(b.querySelector('canvas'), buildScenario(sc.id));
    }
  }
  m.querySelectorAll('.sc-card').forEach((c) => c.classList.toggle('on', c.dataset.id === app.state.scenario.id));
  const r = $('scenarioBtn').getBoundingClientRect();
  m.style.left = `${Math.max(8, Math.min(innerWidth - 568, r.left))}px`;
  m.hidden = false;
  outside = (e) => { if (!m.contains(e.target) && !$('scenarioBtn').contains(e.target)) closeScenarioMenu(); };
  setTimeout(() => document.addEventListener('pointerdown', outside), 0);
}

export function closeScenarioMenu() {
  $('scenarioMenu').hidden = true;
  if (outside) { document.removeEventListener('pointerdown', outside); outside = null; }
}

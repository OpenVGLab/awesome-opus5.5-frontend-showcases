// render.js - draws the workspace (SVG): components, wires, contact points, moving
// current dots, problem highlights, labels and the selection box.
// Everything lives inside <g id="world">, which is panned / zoomed by the view transform.
import { partMarkup, wireMarkup, bboxOf, valueText, PART_DEFS } from './parts.js';
import { buildTopology, pointKey } from './topology.js';
import { fmtI, fmtV, clamp, escapeHtml } from './util.js';
import { findPart } from './state.js';

const NS = 'http://www.w3.org/2000/svg';
const LABEL_FONT = '600 11px "Segoe UI", system-ui, -apple-system, "DejaVu Sans", "Liberation Sans", sans-serif';

export function createRenderer(svg, app, hooks = {}) {
  const layer = (id) => svg.querySelector('#' + id);
  const world = layer('world');
  const L = {
    glow: layer('lyGlow'), hilite: layer('lyHilite'), parts: layer('lyParts'), wires: layer('lyWires'),
    flow: layer('lyFlow'), nodes: layer('lyNodes'), issues: layer('lyIssues'), labels: layer('lyLabels'),
    overlay: layer('lyOverlay'), fx: layer('lyFx'),
  };
  const groups = new Map();     // part id -> { el, key } so unchanged parts are not redrawn
  let baseline = null;          // contact points that existed after the last committed change
  let flowEls = [];
  let flowKey = null;
  let issueKey = null;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = LABEL_FONT;
  const textWidth = (s) => ctx.measureText(s).width;

  // Things the editor draws temporarily (drag preview, wire being drawn, snap hints).
  const api = { topo: null, preview: null, drawLine: null, snapPts: [] };

  // ---------- View (pan & zoom) ----------
  function applyView() {
    const v = app.view;
    world.setAttribute('transform', `translate(${v.tx.toFixed(2)} ${v.ty.toFixed(2)}) scale(${v.s.toFixed(4)})`);
    if (hooks.onView) hooks.onView();
  }
  api.applyView = applyView;
  api.screenToWorld = (cx, cy) => {
    const r = svg.getBoundingClientRect();
    return { x: (cx - r.left - app.view.tx) / app.view.s, y: (cy - r.top - app.view.ty) / app.view.s };
  };
  api.worldToScreen = (x, y) => {
    const r = svg.getBoundingClientRect();
    return { x: r.left + app.view.tx + x * app.view.s, y: r.top + app.view.ty + y * app.view.s };
  };
  api.zoomAt = (factor, cx, cy) => {
    const r = svg.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top, s0 = app.view.s;
    const s1 = clamp(s0 * factor, 0.35, 2.5);
    app.view.tx = px - (px - app.view.tx) * (s1 / s0);
    app.view.ty = py - (py - app.view.ty) * (s1 / s0);
    app.view.s = s1;
    applyView();
  };
  // Box around all parts, with room for the labels.
  api.contentBox = (parts = app.parts) => {
    if (!parts.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of parts) {
      const b = bboxOf(p);
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
    }
    return { x: x0 - 24, y: y0 - 34, w: x1 - x0 + 110, h: y1 - y0 + 58 };
  };
  // Zoom and centre the view so that "box" fits inside the free area of the workspace.
  api.fitTo = (box, room = {}) => {
    const r = svg.getBoundingClientRect();
    const top = room.top ?? 24, bottom = room.bottom ?? 76, left = room.left ?? 24, right = room.right ?? 24;
    const aw = Math.max(120, r.width - left - right), ah = Math.max(120, r.height - top - bottom);
    const s = clamp(Math.min(aw / box.w, ah / box.h), 0.35, room.max ?? 1.5);
    app.view.s = s;
    app.view.tx = left + (aw - box.w * s) / 2 - box.x * s;
    app.view.ty = top + (ah - box.h * s) / 2 - box.y * s;
    applyView();
  };

  // ---------- Components and wires ----------
  function drawParts(res) {
    const seen = new Set();
    for (const p of app.parts) {
      seen.add(p.id);
      const wire = p.type === 'wire';
      const vis = res ? res.info.get(p.id) : null;
      let visKey = '';
      if (vis && p.type === 'bulb') visKey = (vis.brightness || 0).toFixed(3);
      if (vis && typeof vis.reading === 'number') visKey = vis.reading.toFixed(5);
      const key = wire ? `${p.x1},${p.y1},${p.x2},${p.y2},${p.props.color}` : `${p.rot}|${JSON.stringify(p.props)}|${visKey}`;
      let g = groups.get(p.id);
      if (!g) {
        const el = document.createElementNS(NS, 'g');
        el.setAttribute('class', `part part-${p.type}`);
        el.dataset.id = p.id;
        (wire ? L.wires : L.parts).appendChild(el);
        g = { el, key: null };
        groups.set(p.id, g);
      }
      if (g.key !== key) { g.el.innerHTML = wire ? wireMarkup(p) : partMarkup(p, vis); g.key = key; }
      if (!wire) g.el.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${(p.rot & 3) * 90})`);
      g.el.classList.toggle('selected', p.id === app.selectedId);
    }
    for (const [id, g] of groups) if (!seen.has(id)) { g.el.remove(); groups.delete(id); }
  }

  // ---------- Contact points and free terminals ----------
  // mode "track": new contacts pop + callback; "hold": during a drag; "silent": reset quietly.
  function drawNodes(topo, mode) {
    let html = '';
    for (const pt of topo.pts) {
      const n = pt.attach.length;
      const dot = n >= 2
        ? `<circle class="contact-dot" cx="${pt.x}" cy="${pt.y}" r="${n > 2 ? 5.4 : 4.5}"/>`
        : `<circle class="loose-ring" cx="${pt.x}" cy="${pt.y}" r="4"/>`;
      html += `<g class="node ${n >= 2 ? 'contact' : 'loose'}" data-pt="${pt.id}"><circle class="node-hit" cx="${pt.x}" cy="${pt.y}" r="9"/>${dot}</g>`;
    }
    L.nodes.innerHTML = html;
    if (mode === 'hold') return;
    const keys = new Set(topo.contacts.map((pt) => pointKey(pt.x, pt.y)));
    if (mode === 'track' && baseline) {
      const fresh = topo.contacts.filter((pt) => !baseline.has(pointKey(pt.x, pt.y)));
      fresh.forEach((pt) => pop(pt.x, pt.y));
      if (fresh.length && hooks.onContact) hooks.onContact(fresh.length);
    }
    baseline = keys;
  }
  function pop(x, y) {
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<circle class="pop-ring" cx="${x}" cy="${y}" r="6"/><circle class="pop-core" cx="${x}" cy="${y}" r="6"/>`;
    L.fx.appendChild(g);
    setTimeout(() => g.remove(), 800);
  }

  // ---------- Glow of lit bulbs ----------
  function drawGlow(res) {
    let html = '';
    if (res) {
      for (const p of app.parts) {
        const b = p.type === 'bulb' ? (res.info.get(p.id) || {}).brightness || 0 : 0;
        if (b > 0.02) {
          html += `<circle cx="${p.x}" cy="${p.y}" r="${(30 + 50 * Math.min(1.4, b)).toFixed(1)}" fill="url(#gGlow)" opacity="${Math.min(1, 0.25 + 0.75 * b).toFixed(2)}"/>`;
        }
      }
    }
    L.glow.innerHTML = html;
  }

  // ---------- Moving dots = conventional current (from + through the circuit to -) ----------
  function drawFlows(res) {
    const key = res ? res.id : null;
    if (key === flowKey) return;
    flowKey = key;
    L.flow.innerHTML = '';
    flowEls = [];
    if (!res) return;
    const imax = res.flows.reduce((m, f) => Math.max(m, Math.abs(f.I)), 0) || 1;
    for (const f of res.flows) {
      const el = document.createElementNS(NS, 'path');
      el.setAttribute('d', f.I > 0 ? `M${f.x1} ${f.y1}L${f.x2} ${f.y2}` : `M${f.x2} ${f.y2}L${f.x1} ${f.y1}`);
      el.setAttribute('class', 'flow');
      L.flow.appendChild(el);
      // bigger current = faster dots (square root keeps weak branches visible)
      flowEls.push({ el, v: 18 + 102 * Math.sqrt(Math.abs(f.I) / imax) });
    }
  }
  const t0 = performance.now();
  (function tick(now) {
    const t = (now - t0) / 1000;
    for (const f of flowEls) f.el.style.strokeDashoffset = String(-((t * f.v) % 18));
    requestAnimationFrame(tick);
  })(t0);

  // ---------- Problem highlights (red = error, amber = warning) ----------
  function drawIssues(res) {
    const key = res ? res.id : null;
    if (key === issueKey) return;
    issueKey = key;
    let under = '', over = '', badges = '';
    for (const iss of res ? res.issues : []) {
      const cls = 'sev-' + iss.sev;
      let anchor = null, body = '';
      for (const s of iss.path) {
        under += `<line class="short-glow" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`;
        body += `<line class="short-line" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`;
      }
      for (const id of iss.parts) {
        const p = findPart(id);
        if (!p) continue;
        const b = bboxOf(p, 8);
        body += `<rect class="iss-box ${cls}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10"/>`;
        anchor = anchor || { x: b.x + b.w, y: b.y };
      }
      if (iss.gap) {
        const g = iss.gap;
        body += `<line class="iss-gap ${cls}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}"/>`;
        anchor = { x: (g.x1 + g.x2) / 2, y: (g.y1 + g.y2) / 2 - 16 };
      }
      for (const pt of iss.points) {
        body += `<circle class="ring-pulse ${cls}" cx="${pt.x}" cy="${pt.y}" r="9"/><circle class="ring-core ${cls}" cx="${pt.x}" cy="${pt.y}" r="8.5"/>`;
        anchor = anchor || { x: pt.x + 12, y: pt.y - 14 };
      }
      over += `<g class="iss" data-num="${iss.num || 0}">${body}</g>`;
      if (iss.num && anchor) {
        badges += `<g class="iss-badge ${cls}" transform="translate(${anchor.x} ${anchor.y})"><circle r="9.5"/><text y="3.9">${iss.num}</text></g>`;
      }
    }
    L.hilite.innerHTML = under;
    L.issues.innerHTML = over + badges;
  }
  api.flashIssue = (num, on) => {
    L.issues.querySelectorAll(`.iss[data-num="${num}"]`).forEach((el) => el.classList.toggle('flash', on));
  };

  // ---------- Labels ("R1 10 ohm"); meters show their reading after a test ----------
  function drawLabels(res) {
    let html = '';
    for (const p of app.parts) {
      if (p.type === 'wire') continue;
      const inf = res ? res.info.get(p.id) : null;
      let val = valueText(p), live = false;
      if (inf && typeof inf.reading === 'number') {
        val = (inf.reading < -1e-9 ? '\u2212' : '') + (p.type === 'ammeter' ? fmtI(inf.reading) : fmtV(inf.reading));
        live = true;
      }
      const w = textWidth(p.label) + textWidth(val) + 22;
      const half = PART_DEFS[p.type].half, horiz = p.rot % 2 === 0;
      const x = horiz ? p.x - w / 2 : p.x + half + 8;
      const y = horiz ? p.y - half - 14 : p.y;
      html += `<g class="lbl${live ? ' live' : ''}" transform="translate(${x.toFixed(1)} ${y})"><rect width="${w.toFixed(1)}" height="18" y="-9" rx="9"/>`
        + `<text x="8" y="4"><tspan class="lbl-name">${escapeHtml(p.label)}</tspan><tspan class="lbl-val" dx="6">${escapeHtml(val)}</tspan></text></g>`;
    }
    L.labels.innerHTML = html;
  }

  // ---------- Selection, drag preview, wire being drawn ----------
  function drawOverlay() {
    let html = '';
    const sel = findPart(app.selectedId);
    if (sel && sel.type === 'wire') {
      html += `<line class="sel-wire" x1="${sel.x1}" y1="${sel.y1}" x2="${sel.x2}" y2="${sel.y2}"/>`
        + `<circle class="sel-end" cx="${sel.x1}" cy="${sel.y1}" r="7"/><circle class="sel-end" cx="${sel.x2}" cy="${sel.y2}" r="7"/>`;
    } else if (sel) {
      const b = bboxOf(sel, 6);
      html += `<rect class="sel-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="9"/>`;
    }
    const pv = api.preview;
    if (pv) {
      html += pv.type === 'wire' ? `<g class="preview">${wireMarkup(pv)}</g>`
        : `<g class="preview" transform="translate(${pv.x} ${pv.y}) rotate(${(pv.rot & 3) * 90})">${partMarkup(pv, null)}</g>`;
    }
    if (api.drawLine) {
      const d = api.drawLine;
      html += `<line class="draw-line" x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}"/><circle class="draw-end" cx="${d.x2}" cy="${d.y2}" r="5"/>`;
    }
    for (const s of api.snapPts) html += `<circle class="snap-hint" cx="${s.x}" cy="${s.y}" r="11"/>`;
    L.overlay.innerHTML = html;
  }
  api.drawOverlay = drawOverlay;

  // Full redraw. The last test result is only shown while it still matches the circuit.
  api.render = (opts = {}) => {
    applyView();
    const res = app.result && !app.stale ? app.result : null;
    const ok = res && res.status === 'ok' ? res : null;
    api.topo = buildTopology(app.parts);
    drawParts(ok);
    drawNodes(api.topo, opts.contacts || 'track');
    drawGlow(ok);
    drawFlows(ok);
    drawIssues(res);
    drawLabels(ok);
    drawOverlay();
  };
  return api;
}

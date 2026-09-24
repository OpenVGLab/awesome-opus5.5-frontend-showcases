// circuit.js - the brain behind the "Start Test" button.
//  1. Is there a battery? Is it short-circuited?
//  2. Is the circuit closed (a path from the + terminal back to the - terminal)?
//  3. If yes: solve it with Ohm's law (U = I * R) and Kirchhoff's current law
//     ("current flowing into a node = current flowing out") -> nodal analysis.
//  4. If not: find where it is broken (gaps, loose ends, open switches ...).
import { buildTopology, describePoint, describePart } from './topology.js';
import { bulbResistance, terminalsOf } from './parts.js';
import { fmtI, fmtV, trimNum, dist } from './util.js';

const TINY = 1e-9;

// Every problem found becomes an "issue": sev = error | warn | info.
// parts / points / gap / path tell the workspace what to highlight.
const makeIssue = (sev, text, extra = {}) => ({ sev, text, parts: [], points: [], gap: null, path: [], ...extra });

// Gaussian elimination with partial pivoting: solves A x = z.
// Returns null when there is no single answer (e.g. two ideal batteries fighting).
function solveLinear(A, z) {
  const n = z.length;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    [z[c], z[piv]] = [z[piv], z[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      z[r] -= f * z[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = z[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}
const zeros = (n) => Array.from({ length: n }, () => new Array(n).fill(0));

// Adds conductance g (= 1 / R) between matrix rows i and j; -1 means "ground" (0 V).
function stamp(A, i, j, g) {
  if (i >= 0) A[i][i] += g;
  if (j >= 0) A[j][j] += g;
  if (i >= 0 && j >= 0) { A[i][j] -= g; A[j][i] -= g; }
}

// For each net: the elements (resistor, bulb, battery) touching it and the net on their other side.
function adjacency(netCount, elems) {
  const adj = Array.from({ length: netCount }, () => []);
  for (const e of elems) { adj[e.a].push({ e, to: e.b }); adj[e.b].push({ e, to: e.a }); }
  return adj;
}
// Every net reachable from "start" without going through element "skip".
function reachable(adj, start, skip) {
  const seen = new Set([start]), stack = [start];
  while (stack.length) {
    const k = stack.pop();
    for (const { e, to } of adj[k]) if (e !== skip && !seen.has(to)) { seen.add(to); stack.push(to); }
  }
  return seen;
}

// Nodal analysis of one connected group. Unknowns: the voltage of each net (the - terminal
// of the first battery is 0 V) and the current of each battery. Results are written into V and e.I.
function solveGroup(nets, elems, V) {
  const sources = elems.filter((e) => e.kind === 'E');
  const ground = sources[0].a;
  const row = new Map();
  let n = 0;
  for (const k of nets) if (k !== ground) row.set(k, n++);
  const inner = new Map();   // hidden node between the ideal cell and its internal resistance
  for (const s of sources) if (s.r > 0) inner.set(s, n++);
  const nV = n, N = n + sources.length;
  const A = zeros(N), z = new Array(N).fill(0);
  const node = (k) => (k === ground ? -1 : row.get(k));
  for (const e of elems) if (e.kind === 'R') stamp(A, node(e.a), node(e.b), 1 / e.R);
  sources.forEach((s, i) => {
    const r = nV + i, neg = node(s.a), pos = s.r > 0 ? inner.get(s) : node(s.b);
    if (s.r > 0) stamp(A, pos, node(s.b), 1 / s.r);
    // The battery current leaves through its + side (enters "pos") and returns into "neg".
    if (pos >= 0) { A[pos][r] -= 1; A[r][pos] += 1; }
    if (neg >= 0) { A[neg][r] += 1; A[r][neg] -= 1; }
    z[r] = s.E;              // V(+) - V(-) = EMF
  });
  const x = solveLinear(A, z);
  if (!x) return false;
  for (const k of nets) V[k] = k === ground ? 0 : x[row.get(k)];
  sources.forEach((s, i) => { s.I = x[nV + i]; });
  return true;
}

// Wires are ideal (0 ohm), so voltages alone cannot tell how current splits between them.
// Inside each net we share it like real wires would (a longer wire has a little more
// resistance). For ordinary tree-shaped wiring this gives the exact answer.
function conductorCurrents(topo, elems) {
  const inj = new Array(topo.pts.length).fill(0);
  for (const e of elems) {        // current runs through an element from terminal 0 to terminal 1
    inj[topo.tp(e.p.id, 0)] -= e.I;
    inj[topo.tp(e.p.id, 1)] += e.I;
  }
  const byNet = new Map();
  for (const c of topo.conductors) {
    const k = topo.netOf[c.a];
    if (!byNet.has(k)) byNet.set(k, []);
    byNet.get(k).push(c);
  }
  for (const cs of byNet.values()) {
    const ids = [...new Set(cs.flatMap((c) => [c.a, c.b]))];
    if (ids.every((id) => Math.abs(inj[id]) < TINY)) continue;
    const loc = new Map(ids.map((id, i) => [id, i - 1]));   // the first point is the reference
    const A = zeros(ids.length - 1), z = ids.slice(1).map((id) => inj[id]);
    for (const c of cs) stamp(A, loc.get(c.a), loc.get(c.b), 1 / Math.max(c.len, 1));
    const phi = solveLinear(A, z);
    if (!phi) continue;
    const at = (id) => (loc.get(id) < 0 ? 0 : phi[loc.get(id)]);
    for (const c of cs) c.I = (at(c.a) - at(c.b)) / Math.max(c.len, 1);
  }
}

// ---------- Main entry ----------
export function analyze(parts) {
  const topo = buildTopology(parts);
  const res = { status: 'ok', topo, info: new Map(), flows: [], issues: [], main: null };
  if (!parts.length) {
    res.status = 'empty';
    res.issues.push(makeIssue('info', 'The workspace is empty. Drag a battery, a resistor and some wires onto it.'));
    return res;
  }
  const net = (p, t) => topo.netOf[topo.tp(p.id, t)];
  const elems = [];
  for (const p of parts) {
    if (p.type === 'resistor' || p.type === 'bulb') {
      elems.push({ kind: 'R', p, a: net(p, 0), b: net(p, 1), R: p.type === 'bulb' ? bulbResistance(p.props) : p.props.R, I: 0 });
    } else if (p.type === 'battery') {
      elems.push({ kind: 'E', p, a: net(p, 0), b: net(p, 1), E: p.props.emf, r: p.props.r || 0, I: 0 });
    }
  }
  const batteries = elems.filter((e) => e.kind === 'E');
  if (!batteries.length) {
    res.status = 'nobattery';
    res.issues.push(makeIssue('error', 'There is no battery. Without a power source no current can flow \u2013 drag a battery onto the workspace.'));
    return res;
  }
  const shorted = batteries.filter((b) => b.a === b.b);
  if (shorted.length) { explainShort(res, topo, shorted); return res; }

  const adj = adjacency(topo.netCount, elems);
  const closed = batteries.filter((b) => reachable(adj, b.b, b).has(b.a));
  if (!closed.length) { explainOpen(res, topo, parts, batteries, adj); return res; }

  // Solve every connected group that contains a battery.
  const V = new Array(topo.netCount).fill(null);
  const group = new Array(topo.netCount).fill(-1);
  let g = 0;
  for (const b of batteries) {
    if (group[b.a] >= 0) continue;
    const nets = [...reachable(adj, b.a, null)];
    for (const k of nets) group[k] = g;
    const ge = elems.filter((e) => group[e.a] === g);
    g++;
    if (!solveGroup(nets, ge, V)) {
      res.status = 'error';
      res.issues.push(makeIssue('error', 'The circuit cannot settle: batteries are joined in parallel with nothing between them, which acts like a short circuit. Put a resistor between them or remove one battery.',
        { parts: ge.filter((e) => e.kind === 'E').map((e) => e.p.id) }));
      return res;
    }
  }
  for (const e of elems) if (e.kind === 'R' && V[e.a] !== null && V[e.b] !== null) e.I = (V[e.a] - V[e.b]) / e.R;
  conductorCurrents(topo, elems);
  describeResults(res, topo, parts, elems, closed, V, group);
  return res;
}

// Readings for every component, current-flow arrows and friendly warnings.
function describeResults(res, topo, parts, elems, closed, V, group) {
  const pts = topo.pts;
  const elemOf = new Map(elems.map((e) => [e.p.id, e]));
  const condOf = new Map();
  for (const c of topo.conductors) {
    if (!condOf.has(c.partId)) condOf.set(c.partId, []);
    condOf.get(c.partId).push(c);
  }
  const ptOf = (p, t) => pts[topo.tp(p.id, t)];
  const volt = (p, t) => V[topo.netOf[topo.tp(p.id, t)]];
  const grp = (p, t) => group[topo.netOf[topo.tp(p.id, t)]];
  const say = (sev, text, extra) => res.issues.push(makeIssue(sev, text, extra));
  const mentioned = new Set();

  for (const p of parts) {
    const info = {}, e = elemOf.get(p.id), cs = condOf.get(p.id) || [];
    if (p.type === 'resistor' || p.type === 'bulb') {
      info.I = Math.abs(e.I); info.U = info.I * e.R; info.P = info.I * info.I * e.R; info.R = e.R;
      if (p.type === 'bulb') info.brightness = info.P / p.props.ratedP;
      if (e.a === e.b) {
        say('warn', `${p.label} is bypassed: a wire joins both of its ends, so the current skips it.`, { parts: [p.id] });
      } else if (info.I < TINY) {
        const lp = [0, 1].map((t) => ptOf(p, t)).filter((pt) => pt.attach.length === 1);
        lp.forEach((pt) => mentioned.add(pt.id));
        say('warn', `No current flows through ${p.label} \u2013 it is not part of a closed loop.`, { parts: [p.id], points: lp });
      } else if (p.type === 'bulb' && info.brightness > 1.44) {
        say('warn', `${p.label} gets ${fmtV(info.U)} but is made for ${trimNum(p.props.ratedV)} V \u2013 a real bulb would burn out.`, { parts: [p.id] });
      } else if (p.type === 'bulb' && info.brightness < 0.04) {
        say('info', `${p.label} is too dim to see: it gets only ${Math.max(1, Math.round(info.brightness * 100))} % of its rated power.`, { parts: [p.id] });
      }
    } else if (p.type === 'battery') {
      const up = volt(p, 1), um = volt(p, 0);
      info.I = e.I; info.U = up !== null && um !== null ? up - um : e.E; info.P = e.E * e.I;
      if (!closed.includes(e)) say('warn', `${p.label} is not part of a closed loop, so it delivers no current.`, { parts: [p.id] });
      else if (e.I < -TINY) say('info', `Current is pushed backwards through ${p.label} \u2013 a stronger battery is charging it.`, { parts: [p.id] });
    } else if (p.type === 'switch') {
      info.I = p.props.closed && cs[0] ? Math.abs(cs[0].I) : 0;
      if (!p.props.closed) {
        const va = volt(p, 0), vb = volt(p, 1);
        if (va !== null && vb !== null && grp(p, 0) === grp(p, 1)) info.U = Math.abs(va - vb);
        if (ptOf(p, 0).attach.length > 1 || ptOf(p, 1).attach.length > 1) {
          say('info', `Switch ${p.label} is open, so its branch carries no current.`, { parts: [p.id] });
        }
      }
    } else if (p.type === 'ammeter') {
      const I = cs[0] ? -cs[0].I : 0;      // positive when current enters the + terminal
      info.reading = I; info.I = Math.abs(I);
      if (I < -TINY) say('warn', `Ammeter ${p.label} is connected the wrong way round \u2013 swap its leads so current enters the + terminal.`, { parts: [p.id] });
      else if (I > p.props.range) say('warn', `Ammeter ${p.label} is over its ${trimNum(p.props.range)} A range \u2013 pick the bigger range.`, { parts: [p.id] });
    } else if (p.type === 'voltmeter') {
      const va = volt(p, 0), vb = volt(p, 1);
      const ok = va !== null && vb !== null && grp(p, 0) === grp(p, 1);
      info.reading = ok ? vb - va : 0; info.U = Math.abs(info.reading);
      if (!ok) say('info', `Voltmeter ${p.label} is not connected across a powered part, so it reads 0 V.`, { parts: [p.id] });
      else if (info.reading < -TINY) say('warn', `Voltmeter ${p.label} is connected the wrong way round \u2013 its + lead should go to the side nearer the battery's +.`, { parts: [p.id] });
      else if (info.reading > p.props.range) say('warn', `Voltmeter ${p.label} is over its ${trimNum(p.props.range)} V range \u2013 pick the bigger range.`, { parts: [p.id] });
    } else if (p.type === 'wire') {
      info.I = cs.reduce((m, c) => Math.max(m, Math.abs(c.I)), 0);
    }
    res.info.set(p.id, info);
  }

  const loose = topo.loose.filter((pt) => !mentioned.has(pt.id));
  if (loose.length) {
    say('info', `${loose.length} loose end${loose.length > 1 ? 's are' : ' is'} not connected to anything.`, { points: loose });
  }

  // Moving dots show the current: from terminal 0 to 1 when I > 0, backwards when I < 0.
  for (const e of elems) {
    if (Math.abs(e.I) < TINY) continue;
    const [t0, t1] = terminalsOf(e.p);
    res.flows.push({ x1: t0.x, y1: t0.y, x2: t1.x, y2: t1.y, I: e.I });
  }
  for (const c of topo.conductors) {
    if (Math.abs(c.I) > TINY) res.flows.push({ x1: pts[c.a].x, y1: pts[c.a].y, x2: pts[c.b].x, y2: pts[c.b].y, I: c.I });
  }

  // Headline numbers: the battery carrying the largest current.
  const main = closed.reduce((m, b) => (Math.abs(b.I) > Math.abs(m.I) ? b : m));
  const I = Math.abs(main.I), U = res.info.get(main.p.id).U;
  res.main = {
    battery: main.p.label, I, E: main.E, U, R: I > TINY ? U / I : Infinity, multi: closed.length > 1,
    P: elems.filter((e) => e.kind === 'E').reduce((s, b) => s + b.E * b.I, 0),
  };
  if (I < TINY) say('info', 'The batteries push against each other, so no net current flows.', {});
  const rank = { error: 0, warn: 1, info: 2 };
  res.issues.sort((a, b) => rank[a.sev] - rank[b.sev]);
}

// ---------- Short circuit ----------
function conductorPath(topo, from, to) {
  const adj = new Map();
  const add = (k, v) => { if (!adj.has(k)) adj.set(k, []); adj.get(k).push(v); };
  for (const c of topo.conductors) { add(c.a, [c, c.b]); add(c.b, [c, c.a]); }
  const prev = new Map([[from, null]]), queue = [from];
  while (queue.length) {
    const k = queue.shift();
    if (k === to) break;
    for (const [c, nb] of adj.get(k) || []) if (!prev.has(nb)) { prev.set(nb, [c, k]); queue.push(nb); }
  }
  const path = [];
  for (let k = to; prev.get(k); k = prev.get(k)[1]) path.push(prev.get(k)[0]);
  return path;
}

function explainShort(res, topo, shorted) {
  res.status = 'short';
  const pts = topo.pts;
  for (const b of shorted) {
    const path = conductorPath(topo, topo.tp(b.p.id, 1), topo.tp(b.p.id, 0));
    const meter = path.find((c) => c.kind === 'ammeter');
    const seg = path.map((c) => ({ x1: pts[c.a].x, y1: pts[c.a].y, x2: pts[c.b].x, y2: pts[c.b].y }));
    const text = meter
      ? `Short circuit! Ammeter ${topo.byId.get(meter.partId).label} is connected straight across ${b.p.label}. An ammeter has almost no resistance \u2013 always put it in series with a component.`
      : `Short circuit! The + and \u2212 terminals of ${b.p.label} are joined by wires with no component in between. The current would be ${b.r > 0 ? 'about ' + fmtI(b.E / b.r) : 'extremely large'} and the battery would overheat.`;
    res.issues.push(makeIssue('error', text, { parts: [b.p.id].concat(meter ? [meter.partId] : []), path: seg }));
  }
}

// ---------- Open circuit: find where it is broken ----------
function explainOpen(res, topo, parts, batteries, adj) {
  res.status = 'open';
  const pts = topo.pts;
  const netOfPt = (pt) => topo.netOf[pt.id];
  const isLoose = (p, t) => pts[topo.tp(p.id, t)].attach.length === 1;
  // Explain the battery that has the most things connected to it.
  const size = (b) => reachable(adj, b.b, b).size + reachable(adj, b.a, b).size - isLoose(b.p, 0) - isLoose(b.p, 1);
  const bat = batteries.reduce((m, b) => (size(b) > size(m) ? b : m));

  // Split the nets into regions: joined to the + side, joined to the - side, loose islands.
  const region = new Array(topo.netCount).fill(-1);
  let next = 0;
  const flood = (k) => {
    if (region[k] >= 0) return;
    for (const n of reachable(adj, k, bat)) region[n] = next;
    next++;
  };
  flood(bat.b); flood(bat.a);
  for (let k = 0; k < topo.netCount; k++) flood(k);
  const PLUS = region[bat.b], MINUS = region[bat.a];
  const main = (r) => r === PLUS || r === MINUS;
  const list = [];

  for (const p of parts) {
    if (p.type === 'switch' && !p.props.closed && (!isLoose(p, 0) || !isLoose(p, 1))) {
      list.push(makeIssue('error', `Switch ${p.label} is open. Click it to close the circuit.`, { parts: [p.id] }));
    }
    if (p.type === 'voltmeter') {
      const ra = region[topo.netOf[topo.tp(p.id, 0)]], rb = region[topo.netOf[topo.tp(p.id, 1)]];
      if (ra !== rb && main(ra) && main(rb)) {
        list.push(makeIssue('error', `Voltmeter ${p.label} is connected in series. It lets almost no current through \u2013 connect it across a component instead.`, { parts: [p.id] }));
      }
    }
  }

  // Gaps = pairs of loose ends in different regions. Near misses first, then the pair that
  // would join the + side to the - side, then other close pairs.
  const loose = topo.loose;
  const owner = (pt) => pt.attach[0].partId;
  const pairs = [];
  for (let i = 0; i < loose.length; i++) {
    for (let j = i + 1; j < loose.length; j++) {
      const p = loose[i], q = loose[j];
      const rp = region[netOfPt(p)], rq = region[netOfPt(q)];
      if (rp === rq || owner(p) === owner(q) || !(main(rp) || main(rq))) continue;
      const d = dist(p.x, p.y, q.x, q.y);
      const tier = d <= 60 ? 0 : (main(rp) && main(rq) ? 1 : (d <= 200 ? 2 : 9));
      if (tier < 9) pairs.push({ p, q, d, tier });
    }
  }
  pairs.sort((m, n) => m.tier - n.tier || m.d - n.d);
  const used = new Set();
  for (const g of pairs) {
    if (used.size >= 8 || used.has(g.p.id) || used.has(g.q.id)) continue;
    used.add(g.p.id); used.add(g.q.id);
    list.push(makeIssue('error', `Gap between ${describePoint(topo, g.p)} and ${describePoint(topo, g.q)}${g.d <= 40 ? ' \u2013 they almost touch' : ''}. Drag one end onto the other to connect them.`,
      { points: [g.p, g.q], gap: { x1: g.p.x, y1: g.p.y, x2: g.q.x, y2: g.q.y } }));
  }

  // Loose ends that are left: on the battery's side they are errors, on loose islands warnings.
  const rest = loose.filter((pt) => !used.has(pt.id));
  const onMain = rest.filter((pt) => main(region[netOfPt(pt)]));
  onMain.slice(0, 3).forEach((pt) => list.push(makeIssue('error', `${describePoint(topo, pt)} is not connected to anything.`, { points: [pt] })));
  if (onMain.length > 3) list.push(makeIssue('error', `\u2026and ${onMain.length - 3} more loose ends on the battery's side.`, { points: onMain.slice(3) }));
  const islands = new Map();
  for (const pt of rest.filter((q) => !main(region[netOfPt(q)]))) {
    const label = describePart(topo.byId.get(owner(pt)));
    if (!islands.has(label)) islands.set(label, []);
    islands.get(label).push(pt);
  }
  for (const [label, ptsOf] of islands) {
    list.push(makeIssue('warn', `${label} is not connected to the battery.`, { points: ptsOf }));
  }
  if (!list.length) {
    list.push(makeIssue('error', `There is no closed path from the + terminal of ${bat.p.label} back to its \u2212 terminal.`, { parts: [bat.p.id] }));
  }
  res.issues = list;
}

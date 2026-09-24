// topology.js - finds the contact points of the circuit.
//
// A "point" is a spot where one or more component terminals sit. When two or more
// terminals share the same spot (or a terminal touches the middle of a wire) the
// components touch, and that spot becomes a contact point.
//
// Points joined by ideal conductors (wires, closed switches and ammeters, all 0 ohm)
// always have the same voltage. Such a group is called a "net" (a node of the circuit).
import { terminalsOf, centerOf, WIRE_COLORS } from './parts.js';
import { projectOnSegment, dist } from './util.js';

// Union-Find: a tiny structure that merges groups quickly ("are A and B connected?").
class UnionFind {
  constructor(n) { this.parent = Array.from({ length: n }, (_, i) => i); }
  find(a) {
    while (this.parent[a] !== a) { this.parent[a] = this.parent[this.parent[a]]; a = this.parent[a]; }
    return a;
  }
  union(a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.parent[b] = a; }
}

export const pointKey = (x, y) => `${Math.round(x)},${Math.round(y)}`;

export function buildTopology(parts) {
  const pts = [];                 // { id, x, y, attach: [{ partId, term }] }  term -1 = middle of a wire
  const byKey = new Map();
  const termPt = new Map();       // "partId:term" -> point id
  const byId = new Map(parts.map((p) => [p.id, p]));

  const pointAt = (x, y) => {
    const k = pointKey(x, y);
    let id = byKey.get(k);
    if (id === undefined) {
      id = pts.length;
      pts.push({ id, x: Math.round(x), y: Math.round(y), attach: [] });
      byKey.set(k, id);
    }
    return id;
  };

  // 1) Every terminal creates (or joins) a point.
  for (const p of parts) {
    terminalsOf(p).forEach((t, i) => {
      const id = pointAt(t.x, t.y);
      pts[id].attach.push({ partId: p.id, term: i });
      termPt.set(p.id + ':' + i, id);
    });
  }
  const tp = (partId, term) => termPt.get(partId + ':' + term);

  // 2) A terminal resting on the middle of a wire also touches that wire ("T-junction").
  const wires = parts.filter((p) => p.type === 'wire');
  const inner = new Map(wires.map((w) => [w.id, []]));
  for (const w of wires) {
    const a = tp(w.id, 0), b = tp(w.id, 1);
    for (const pt of pts) {
      if (pt.id === a || pt.id === b) continue;
      const { t, d } = projectOnSegment(pt.x, pt.y, w.x1, w.y1, w.x2, w.y2);
      if (d <= 1.5 && t > 0.0001 && t < 0.9999) {
        pt.attach.push({ partId: w.id, term: -1 });
        inner.get(w.id).push({ id: pt.id, t });
      }
    }
  }

  // 3) Ideal conductors. A wire with T-junctions is cut into several short segments,
  //    so the current in every piece can be shown separately.
  const conductors = [];          // { kind, partId, a, b, len, I }
  for (const w of wires) {
    const chain = [{ id: tp(w.id, 0), t: 0 }, ...inner.get(w.id).sort((m, n) => m.t - n.t), { id: tp(w.id, 1), t: 1 }];
    for (let i = 0; i + 1 < chain.length; i++) {
      const a = chain[i].id, b = chain[i + 1].id;
      if (a !== b) conductors.push({ kind: 'wire', partId: w.id, a, b, len: dist(pts[a].x, pts[a].y, pts[b].x, pts[b].y), I: 0 });
    }
  }
  for (const p of parts) {
    if ((p.type === 'switch' && p.props.closed) || p.type === 'ammeter') {
      conductors.push({ kind: p.type, partId: p.id, a: tp(p.id, 0), b: tp(p.id, 1), len: 40, I: 0 });
    }
  }

  // 4) Merge points joined by conductors into nets and number the nets 0, 1, 2 ...
  const uf = new UnionFind(pts.length);
  for (const c of conductors) uf.union(c.a, c.b);
  const netIndex = new Map();
  const netOf = pts.map((pt) => {
    const root = uf.find(pt.id);
    if (!netIndex.has(root)) netIndex.set(root, netIndex.size);
    return netIndex.get(root);
  });

  return {
    pts, tp, byId, conductors, netOf, netCount: netIndex.size,
    contacts: pts.filter((pt) => pt.attach.length >= 2),   // where components touch
    loose: pts.filter((pt) => pt.attach.length === 1),     // terminals touching nothing
  };
}

// Friendly names for places on the board, e.g. "B1 (+)", "R2 (left end)", "Blue wire (top end)".
// Wires have no visible label, so they are named by their colour.
export function describePart(p) {
  return p.type === 'wire' ? `${(WIRE_COLORS[p.props.color] || WIRE_COLORS.red).name} wire` : p.label;
}
export function describeTerminal(p, term) {
  if (term < 0) return `${describePart(p)} (middle)`;
  if (p.type === 'battery' || p.type === 'ammeter' || p.type === 'voltmeter') {
    return `${p.label} (${term === 1 ? '+' : '\u2212'})`;
  }
  const t = terminalsOf(p)[term], c = centerOf(p);
  const dx = t.x - c.x, dy = t.y - c.y;
  const side = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
  return `${describePart(p)} (${side} end)`;
}
export function describePoint(topo, pt) {
  const a = pt.attach.find((x) => x.term >= 0) || pt.attach[0];
  return describeTerminal(topo.byId.get(a.partId), a.term);
}

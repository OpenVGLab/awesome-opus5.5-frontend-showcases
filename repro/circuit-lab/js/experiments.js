// experiments.js - the guided multi-step experiment and the ready-made example circuits.
// Coordinates are world units around (0, 0); the view is fitted to them when loaded.
import { makePart as P, makeWire as W } from './parts.js';

// ---------- Example circuits (demo data) ----------
// Reminder: rot 1 = terminal 0 on top, rot 3 = terminal 1 on top (a battery's + is terminal 1).
const loopBase = (emf = 3) => [
  P('battery', -160, 0, 3, { emf }),
  P('resistor', 160, 0, 1, { R: 10 }),
  W(-160, -40, 160, -40, 'red'),
];

export const EXAMPLES = {
  // Step 1: the loop is missing its bottom wire; a spare wire lies below.
  starter: { name: 'Starter kit', build: () => [...loopBase(), W(-160, 140, 160, 140, 'blue')] },

  loop: { name: 'Simple loop', desc: '3 V battery + 10 \u03a9 resistor', build: () => [...loopBase(), W(-160, 40, 160, 40, 'blue')] },

  // Step 3: a gap in the top wire, exactly as long as a resistor.
  seriesKit: { name: 'Series kit', build: () => [
    P('battery', -160, 0, 3, { emf: 3 }), P('resistor', 160, 0, 1, { R: 10 }),
    W(-160, -40, -40, -40, 'red'), W(40, -40, 160, -40, 'red'), W(-160, 40, 160, 40, 'blue'),
    P('resistor', 0, 140, 0, { R: 20 }),
  ] },

  // Step 4: R2 stands next to R1, two spare wires lie below.
  parallelKit: { name: 'Parallel kit', build: () => [
    ...loopBase(), W(-160, 40, 160, 40, 'blue'),
    P('resistor', 300, 0, 1, { R: 20 }),
    W(20, 140, 160, 140, 'yellow'), W(20, 200, 160, 200, 'yellow'),
  ] },

  // Step 5: a gap for the ammeter, a voltmeter and two spare wires.
  metersKit: { name: 'Meters kit', build: () => [
    P('battery', -160, 0, 3, { emf: 6 }), P('resistor', 160, 0, 1, { R: 20 }),
    W(-160, -40, -40, -40, 'red'), W(40, -40, 160, -40, 'red'), W(-160, 40, 160, 40, 'blue'),
    P('ammeter', 0, 140, 2, { range: 0.6 }), P('voltmeter', 300, 0, 3, { range: 15 }),
    W(120, 200, 240, 200, 'green'), W(120, 250, 240, 250, 'green'),
  ] },

  series: { name: 'Series circuit', desc: '6 V, R1 + R2 + bulb in one loop', build: () => [
    P('battery', -200, 0, 3, { emf: 6 }),
    W(-200, -40, -200, -120, 'red'), W(-200, -120, -120, -120, 'red'),
    P('resistor', -80, -120, 0, { R: 10 }), W(-40, -120, 40, -120, 'red'),
    P('resistor', 80, -120, 0, { R: 5 }), W(120, -120, 200, -120, 'red'), W(200, -120, 200, -40, 'red'),
    P('bulb', 200, 0, 1, { ratedV: 3, ratedP: 0.6 }),
    W(200, 40, 200, 120, 'blue'), W(200, 120, -200, 120, 'blue'), W(-200, 120, -200, 40, 'blue'),
  ] },

  // The branch wires end on the middle of the rails: T-junction contact points.
  parallel: { name: 'Parallel circuit', desc: 'Resistor and bulb side by side', build: () => [
    P('battery', -200, 0, 3, { emf: 6 }),
    W(-200, -40, -200, -120, 'red'), W(-200, -120, 200, -120, 'red'),
    W(0, -120, 0, -40, 'red'), P('resistor', 0, 0, 1, { R: 20 }), W(0, 40, 0, 120, 'blue'),
    W(200, -120, 200, -40, 'red'), P('bulb', 200, 0, 1, { ratedV: 6, ratedP: 1.8 }), W(200, 40, 200, 120, 'blue'),
    W(200, 120, -200, 120, 'blue'), W(-200, 120, -200, 40, 'blue'),
  ] },

  ohm: { name: "Ohm's law", desc: 'Switch, ammeter and voltmeter', build: () => [
    P('battery', -200, 0, 3, { emf: 6 }),
    W(-200, -40, -200, -120, 'red'), W(-200, -120, -160, -120, 'red'),
    P('switch', -120, -120, 0, { closed: true }), W(-80, -120, 0, -120, 'red'),
    P('ammeter', 40, -120, 2, { range: 0.6 }), W(80, -120, 200, -120, 'red'), W(200, -120, 200, -40, 'red'),
    P('resistor', 200, 0, 1, { R: 20 }),
    W(200, 40, 200, 120, 'blue'), W(200, 120, -200, 120, 'blue'), W(-200, 120, -200, 40, 'blue'),
    P('voltmeter', 320, 0, 3, { range: 15 }), W(200, -40, 320, -40, 'yellow'), W(200, 40, 320, 40, 'yellow'),
  ] },

  // Two hidden faults: the switch is open and the bottom wire stops 20 units short.
  faulty: { name: 'Faulty circuit', desc: 'Find and fix the breaks', build: () => [
    P('battery', -200, 0, 3, { emf: 4.5 }),
    W(-200, -40, -200, -120, 'red'), W(-200, -120, -120, -120, 'red'),
    P('switch', -80, -120, 0, { closed: false }), W(-40, -120, 40, -120, 'red'),
    P('bulb', 80, -120, 0, { ratedV: 4.5, ratedP: 1.35 }), W(120, -120, 200, -120, 'red'), W(200, -120, 200, -40, 'red'),
    P('resistor', 200, 0, 1, { R: 5 }),
    W(200, 40, 200, 120, 'blue'), W(200, 120, -180, 120, 'blue'), W(-200, 120, -200, 40, 'blue'),
  ] },

  // A wire across the middle joins the top and bottom wires: the battery is shorted.
  short: { name: 'Short circuit', desc: 'What not to do', build: () => [
    ...loopBase(), W(-160, 40, 160, 40, 'blue'), W(0, -40, 0, 40, 'yellow'),
  ] },
};
export const EXAMPLE_MENU = ['loop', 'series', 'parallel', 'ohm', 'faulty', 'short'];

// ---------- Step checks (run after every test) ----------
const MIN_I = 1e-6;
const resistive = (parts) => parts.filter((p) => p.type === 'resistor' || p.type === 'bulb');
const nets = (r, p) => [0, 1].map((t) => r.topo.netOf[r.topo.tp(p.id, t)]).sort((a, b) => a - b);
const sameNets = (r, a, b) => { const x = nets(r, a), y = nets(r, b); return x[0] === y[0] && x[1] === y[1] && x[0] !== x[1]; };
const current = (r, p) => (r.info.get(p.id) || {}).I || 0;

function seriesCheck(r, parts) {
  const list = resistive(parts).filter((p) => current(r, p) > MIN_I);
  return list.some((a, i) => list.slice(i + 1).some((b) =>
    Math.abs(current(r, a) - current(r, b)) < 1e-6 * Math.max(1, current(r, a)) && !sameNets(r, a, b)));
}
function parallelCheck(r, parts) {
  const list = resistive(parts).filter((p) => current(r, p) > MIN_I);
  return list.some((a, i) => list.slice(i + 1).some((b) => sameNets(r, a, b)));
}
function metersCheck(r, parts) {
  const amm = parts.some((p) => p.type === 'ammeter' && (r.info.get(p.id) || {}).reading > MIN_I);
  const volt = parts.some((v) => v.type === 'voltmeter' && (r.info.get(v.id) || {}).reading > 1e-4
    && resistive(parts).some((p) => sameNets(r, v, p)));
  return amm && volt;
}

export const STEPS = [
  { short: 'Loop', title: 'Close the loop', starter: 'starter',
    text: 'Drag the loose blue wire up onto the two free ends \u2013 or draw a new wire from a terminal \u2013 then press Start Test.',
    goal: 'Current flows through the resistor',
    check: (r, parts) => resistive(parts).some((p) => p.type === 'resistor' && current(r, p) > MIN_I) },
  { short: 'Voltage', title: 'Change the voltage', starter: 'loop',
    text: 'Double-click the battery, set it to 6 V and test again. Twice the voltage gives twice the current (I = U \u00f7 R).',
    goal: 'A closed circuit with a 6 V battery',
    check: (r, parts) => parts.some((p) => p.type === 'battery' && Math.abs(p.props.emf - 6) < 1e-9 && Math.abs(current(r, p)) > MIN_I) },
  { short: 'Series', title: 'Resistors in series', starter: 'seriesKit',
    text: 'Drag resistor R2 into the gap in the top wire, so the current passes through both resistors in turn. Test and compare.',
    goal: 'Two resistors in series, same current',
    check: seriesCheck },
  { short: 'Parallel', title: 'Parallel branches', starter: 'parallelKit',
    text: 'Use the spare wires to join the top ends and the bottom ends of R1 and R2, so the current splits into two branches.',
    goal: 'Two resistors side by side (parallel)',
    check: parallelCheck },
  { short: 'Meters', title: 'Measure with meters', starter: 'metersKit',
    text: 'Put the ammeter into the gap (in series) and wire the voltmeter across R1 (in parallel). Then check Ohm\u2019s law: U \u00f7 I = R.',
    goal: 'Both meters connected and reading',
    check: metersCheck },
  { short: 'Fault', title: 'Find the fault', starter: 'faulty',
    text: 'This circuit hides two faults. Press Start Test to see where it is broken, repair the highlighted spots and test until the bulb lights.',
    goal: 'The faulty circuit repaired \u2013 bulb on',
    check: (r, parts, app) => app.faultLoaded && parts.some((p) => p.type === 'bulb' && ((r.info.get(p.id) || {}).brightness || 0) > 0.05) },
];

// Marks every step whose goal is met by this (successful) test. Returns the newly finished indexes.
export function evaluateSteps(app, result) {
  if (!result || result.status !== 'ok') return [];
  const fresh = [];
  STEPS.forEach((s, i) => {
    if (!app.done[i] && s.check(result, app.parts, app)) { app.done[i] = true; fresh.push(i); }
  });
  return fresh;
}

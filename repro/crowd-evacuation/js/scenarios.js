// Preset floor plans. Coordinates are metres in a 60 x 36 m world, y pointing down.
import { cutRect } from './core.js';

function builder() {
  const L = { segs: [], pillars: [], exits: [], spawns: [], fallback: [], seats: [], zones: [], floors: [], deco: [], view: null };
  const b = {
    L,
    wall(x0, y0, x1, y1, t = 0.3, kind = 'wall') { L.segs.push({ x0, y0, x1, y1, t, kind }); },
    box(x0, y0, x1, y1, t = 0.3) {
      b.wall(x0, y0, x1, y0, t); b.wall(x1, y0, x1, y1, t); b.wall(x1, y1, x0, y1, t); b.wall(x0, y1, x0, y0, t);
    },
    block(x0, y0, x1, y1, kind = 'block') {
      const w = x1 - x0, h = y1 - y0;
      if (w >= h) L.segs.push({ x0: x0 + h / 2, y0: (y0 + y1) / 2, x1: x1 - h / 2, y1: (y0 + y1) / 2, t: h, kind });
      else L.segs.push({ x0: (x0 + x1) / 2, y0: y0 + w / 2, x1: (x0 + x1) / 2, y1: y1 - w / 2, t: w, kind });
    },
    seat(x0, y, x1) { L.segs.push({ x0, y0: y, x1, y1: y, t: 0.12, kind: 'seat' }); },
    seats(x0, y, x1, pitch) { for (let x = x0; x <= x1 + 1e-6; x += pitch) L.seats.push({ x, y }); },
    pillar(x, y, r = 0.4) { L.pillars.push({ x, y, r }); },
    door(x0, y0, x1, y1, name) {
      L.segs = cutRect(L.segs, x0, y0, x1, y1);
      if (name) L.zones.push({ x0: x0 - 1.6, y0: y0 - 1.6, x1: x1 + 1.6, y1: y1 + 1.6, name, pri: 1 });
    },
    exit(x0, y0, x1, y1, label, name, familiar = true) {
      L.segs = cutRect(L.segs, x0, y0, x1, y1);
      L.exits.push({ x0, y0, x1, y1, label, name, familiar, open: true });
    },
    spawn(x0, y0, x1, y1, w) { L.spawns.push({ x0, y0, x1, y1, w: w ?? (x1 - x0) * (y1 - y0) }); },
    extra(x0, y0, x1, y1) { L.fallback.push({ x0, y0, x1, y1, w: (x1 - x0) * (y1 - y0) }); },
    zone(x0, y0, x1, y1, name) { L.zones.push({ x0, y0, x1, y1, name }); },
    floor(x0, y0, x1, y1, kind = 'floor') { L.floors.push({ x0, y0, x1, y1, kind }); },
    stairs(x0, y0, x1, y1) { L.deco.push({ type: 'stairs', x0, y0, x1, y1 }); },
    strip(x0, y, x1) { L.deco.push({ type: 'strip', x0, y, x1 }); },
    rails(x0, y, x1) { L.deco.push({ type: 'rails', x0, y, x1 }); },
    label(x, y, text) { L.deco.push({ type: 'label', x, y, text }); },
    view(x0, y0, x1, y1) { L.view = { x0, y0, x1, y1 }; },
  };
  return b;
}

function concertHall(b) {
  b.floor(4, 3, 56, 33);
  b.box(4, 3, 56, 33, 0.4);
  b.block(16, 3.2, 44, 8, 'stage');
  b.label(30, 5.6, 'STAGE');
  b.wall(4, 28.5, 56, 28.5, 0.3);
  b.door(13, 28.1, 16, 28.9, 'Foyer door west');
  b.door(28.5, 28.1, 31.5, 28.9, 'Foyer door centre');
  b.door(44, 28.1, 47, 28.9, 'Foyer door east');
  const secs = [[7, 21], [23, 37], [39, 53]], y0 = 11, pitch = 0.95, rows = 16;
  for (const [a, c] of secs) {
    for (let i = 0; i < rows; i++) b.seat(a, y0 + i * pitch, c);
    for (let i = 0; i < rows - 1; i++) b.seats(a + 0.4, y0 + (i + 0.5) * pitch, c - 0.4, 0.62);
  }
  b.extra(4.5, 25.7, 55.5, 28.1); b.extra(4.5, 29, 55.5, 32.5);
  b.exit(9, 32.6, 11.4, 33.4, 'A', 'Rear west');
  b.exit(28.8, 32.6, 31.2, 33.4, 'B', 'Main entrance');
  b.exit(48.6, 32.6, 51, 33.4, 'C', 'Rear east');
  b.exit(3.6, 9, 4.4, 10.6, 'D', 'Stage door west', false);
  b.exit(55.6, 9, 56.4, 10.6, 'E', 'Stage door east', false);
  b.label(30, 31, 'FOYER');
  b.zone(4, 8, 7, 28.5, 'West side aisle');
  b.zone(21, 8, 23, 28.5, 'West aisle');
  b.zone(37, 8, 39, 28.5, 'East aisle');
  b.zone(53, 8, 56, 28.5, 'East side aisle');
  b.zone(4, 8, 56, 11, 'Front cross-aisle');
  b.zone(4, 25.2, 56, 28.5, 'Rear cross-aisle');
  b.zone(4, 28.5, 56, 33, 'Foyer');
  b.zone(7, 11, 21, 25.3, 'West seating rows');
  b.zone(23, 11, 37, 25.3, 'Centre seating rows');
  b.zone(39, 11, 53, 25.3, 'East seating rows');
  b.view(2.4, 2, 57.6, 34.6);
}

function bottleneck(b, pillar) {
  b.floor(18, 9, 36, 27);
  b.box(18, 9, 36, 27, 0.3);
  b.exit(35.6, 17.4, 36.4, 18.6, 'A', 'Door');
  if (pillar) b.pillar(33.1, 17.6, 0.55);
  b.spawn(18.5, 9.5, 33.2, 26.5);
  b.zone(32.2, 15.2, 36.6, 20.8, 'In front of the door');
  b.view(16, 8, 40, 28);
}

function office(b) {
  b.floor(3, 4, 57, 32);
  b.box(3, 4, 57, 32, 0.35);
  b.wall(3, 16.8, 57, 16.8, 0.2);
  b.wall(3, 19.2, 57, 19.2, 0.2);
  for (const x of [22, 30, 38]) b.wall(x, 4, x, 16.8, 0.2);
  for (const x of [13, 24, 36, 46]) b.wall(x, 19.2, x, 32, 0.2);
  b.door(7, 16.6, 8.2, 17, 'West office door 1');
  b.door(16, 16.6, 17.2, 17, 'West office door 2');
  b.door(25.4, 16.6, 26.6, 17, 'Meeting room 1 door');
  b.door(33.4, 16.6, 34.6, 17, 'Meeting room 2 door');
  b.door(42, 16.6, 43.2, 17, 'East office door 1');
  b.door(51, 16.6, 52.2, 17, 'East office door 2');
  b.door(7.4, 19, 8.6, 19.4, 'Office W1 door');
  b.door(18, 19, 19.2, 19.4, 'Office W2 door');
  b.door(27, 19, 33, 19.4);
  b.door(40.4, 19, 41.6, 19.4, 'Office E1 door');
  b.door(51, 19, 52.2, 19.4, 'Office E2 door');
  b.exit(2.6, 17.4, 3.4, 18.6, 'A', 'West stair');
  b.exit(56.6, 17.4, 57.4, 18.6, 'B', 'East stair');
  b.exit(28.5, 31.6, 31.5, 32.4, 'C', 'Lobby doors');
  for (const ox of [5, 40]) {
    for (let kx = 0; kx < 4; kx++) for (let ky = 0; ky < 3; ky++) {
      const x = ox + kx * 4.2, y = 6 + ky * 3.4;
      b.block(x, y, x + 3.2, y + 1.4);
    }
  }
  b.block(24, 8, 28, 12.8); b.block(32, 8, 36, 12.8);
  for (const [a, c] of [[5, 11], [15, 22], [38, 44], [48, 55]]) { b.block(a, 23, c, 24.2); b.block(a, 27, c, 28.2); }
  b.block(27.5, 23.5, 32.5, 24.7);
  b.pillar(26, 28, 0.35); b.pillar(34, 28, 0.35);
  b.label(30, 26.2, 'LOBBY');
  for (const [x0, x1, w] of [[3, 22, 1], [22, 30, 1.6], [30, 38, 1.6], [38, 57, 1]]) b.spawn(x0 + 0.5, 4.5, x1 - 0.5, 16.3, (x1 - x0) * 12 * w);
  for (const [x0, x1] of [[3, 13], [13, 24], [36, 46], [46, 57]]) b.spawn(x0 + 0.5, 19.7, x1 - 0.5, 31.5);
  b.spawn(24.5, 19.7, 35.5, 31.5, 25);
  b.zone(3, 16.8, 6.5, 19.2, 'West stair door');
  b.zone(53.5, 16.8, 57, 19.2, 'East stair door');
  b.zone(6.5, 16.8, 24, 19.2, 'West corridor');
  b.zone(24, 16.8, 36, 19.2, 'Central corridor');
  b.zone(36, 16.8, 53.5, 19.2, 'East corridor');
  b.zone(3, 4, 22, 16.8, 'West open office');
  b.zone(22, 4, 30, 16.8, 'Meeting room 1');
  b.zone(30, 4, 38, 16.8, 'Meeting room 2');
  b.zone(38, 4, 57, 16.8, 'East open office');
  b.zone(3, 19.2, 13, 32, 'Office W1');
  b.zone(13, 19.2, 24, 32, 'Office W2');
  b.zone(24, 19.2, 36, 32, 'Lobby');
  b.zone(36, 19.2, 46, 32, 'Office E1');
  b.zone(46, 19.2, 57, 32, 'Office E2');
  b.view(1.4, 2.6, 58.6, 33.4);
}

function metro(b) {
  b.floor(3, 3, 57, 33);
  b.box(3, 3, 57, 33, 0.4);
  b.block(3.2, 3.2, 56.8, 6.2, 'track');
  b.rails(3.4, 4.7, 56.6);
  b.strip(3.4, 6.6, 56.6);
  b.wall(3, 14, 57, 14, 0.3);
  b.door(12, 13.6, 15, 14.4);
  b.door(45, 13.6, 48, 14.4);
  b.wall(12, 14, 12, 19, 0.25); b.wall(15, 14, 15, 19, 0.25);
  b.wall(45, 14, 45, 19, 0.25); b.wall(48, 14, 48, 19, 0.25);
  b.stairs(12.15, 14.3, 14.85, 19); b.stairs(45.15, 14.3, 47.85, 19);
  for (const px of [8, 20, 26, 34, 40, 52]) b.pillar(px, 10.3, 0.45);
  b.wall(3, 25, 20.85, 25, 0.3);
  b.wall(39.15, 25, 57, 25, 0.3);
  for (let k = 0; k <= 18; k++) { const gx = 21 + k; b.block(gx - 0.15, 24.3, gx + 0.15, 25.7, 'gate'); }
  b.pillar(24, 20.5, 0.5); b.pillar(36, 20.5, 0.5);
  b.exit(8, 32.6, 12, 33.4, 'A', 'Street west');
  b.exit(28, 32.6, 32, 33.4, 'B', 'Street main');
  b.exit(48, 32.6, 52, 33.4, 'C', 'Street east');
  b.exit(2.6, 8.4, 3.4, 10.4, 'D', 'Platform end west', false);
  b.exit(56.6, 8.4, 57.4, 10.4, 'E', 'Platform end east', false);
  b.label(30, 12.9, 'PLATFORM');
  b.label(30, 29, 'TICKET HALL');
  b.spawn(3.6, 6.9, 56.4, 13.6);
  b.spawn(3.6, 14.5, 56.4, 24.4, 60);
  b.zone(9, 10, 18, 14.6, 'Stair 1 head');
  b.zone(42, 10, 51, 14.6, 'Stair 2 head');
  b.zone(12, 14.6, 15, 19, 'Stair 1');
  b.zone(45, 14.6, 48, 19, 'Stair 2');
  b.zone(19.5, 22.4, 40.5, 26.4, 'Fare gates');
  b.zone(3, 6, 57, 14, 'Platform');
  b.zone(3, 14, 57, 25, 'Upper concourse');
  b.zone(3, 25, 57, 33, 'Ticket hall');
  b.L.zones.forEach((z) => { if (z.name.endsWith('head') || z.name === 'Fare gates') z.pri = 1; });
  b.view(1.5, 1.8, 58.5, 34.4);
}

function nightclub(b) {
  b.floor(16, 5, 52, 31);
  b.floor(8, 22.5, 16, 24.5);
  b.floor(3, 18, 8, 31);
  b.floor(22, 11, 40, 26, 'dance');
  b.box(16, 5, 52, 31, 0.35);
  b.door(15.6, 22.6, 16.4, 24.4, 'Corridor mouth');
  b.box(3, 18, 8, 31, 0.3);
  b.door(7.6, 22.6, 8.4, 24.4);
  b.wall(8, 22.5, 16, 22.5, 0.2);
  b.wall(8, 24.5, 16, 24.5, 0.2);
  b.exit(4.5, 30.6, 6.5, 31.4, 'A', 'Main entrance');
  b.block(3.2, 25, 4.8, 28, 'bar');
  b.block(22, 5.2, 40, 8.6, 'bar');
  b.label(31, 6.9, 'BAR');
  b.block(46, 11, 51.8, 23, 'stage');
  b.label(48.9, 17, 'DJ');
  b.block(20, 28.6, 25, 30.8); b.block(28, 28.6, 33, 30.8); b.block(36, 28.6, 41, 30.8);
  for (const [px, py] of [[22, 14], [22, 22], [40, 14], [40, 22]]) b.pillar(px, py, 0.45);
  b.exit(51.6, 25, 52.4, 26.4, 'B', 'Fire exit (stage)', false);
  b.exit(45, 30.6, 46.4, 31.4, 'C', 'Fire exit (lounge)', false);
  b.label(5.5, 20, 'LOBBY');
  b.spawn(17, 9.2, 45, 27.6);
  b.spawn(17, 27.6, 44, 30.6, 20);
  b.zone(8, 22.5, 14.4, 24.5, 'Entrance corridor');
  b.zone(3, 18, 8, 31, 'Lobby');
  b.zone(22, 11, 40, 26, 'Dance floor');
  b.zone(16, 8.6, 45, 11, 'Bar front');
  b.zone(42, 10, 52, 27, 'Stage side');
  b.zone(16, 26, 52, 31, 'Lounge');
  b.zone(16, 5, 52, 31, 'Club floor');
  b.view(1.6, 3.6, 53.6, 32.4);
}

function sandbox(b) {
  b.floor(8, 6, 52, 30);
  b.box(8, 6, 52, 30, 0.3);
  b.exit(51.6, 17.2, 52.4, 18.8, 'A', 'Exit');
  b.spawn(9, 7, 26, 29);
  b.view(5.5, 4, 54.5, 32);
}

export const SCENARIOS = [
  {
    id: 'hall', name: 'Concert hall', build: concertHall, people: 700, urgency: 25, aware: 15,
    blurb: 'Seated audience, 5 exits. People head back the way they came in, so the rear doors and aisle ends clog while the stage doors stay empty.',
  },
  {
    id: 'bottleneck', name: 'Bottleneck', build: (b) => bottleneck(b, false), people: 350, urgency: 55, aware: 0,
    blurb: 'The classic experiment: one 1.2 m door. Push urgency up and watch arches form and body pressure climb. Past a point, rushing gets nobody out faster.',
  },
  {
    id: 'pillar', name: 'Door + pillar', build: (b) => bottleneck(b, true), people: 350, urgency: 55, aware: 0,
    blurb: 'Same room with a pillar just in front of the door. It takes the crowd\'s weight off the doorway, so peak body pressure drops by about a quarter. Compare with the plain bottleneck.',
  },
  {
    id: 'office', name: 'Office floor', build: office, people: 520, urgency: 20, aware: 35,
    blurb: 'Nine rooms empty into one corridor with stairs at both ends. Room doors and the stair doors are the choke points.',
  },
  {
    id: 'metro', name: 'Metro platform', build: metro, people: 850, urgency: 20, aware: 20,
    blurb: 'A packed platform after a train arrives. Two stairways feed a line of fare gates. See which one jams first.',
  },
  {
    id: 'club', name: 'Nightclub', build: nightclub, people: 650, urgency: 45, aware: 0,
    blurb: 'Everyone knows the one corridor to the main entrance and nobody knows the fire exits. Raise exit knowledge and compare.',
  },
  {
    id: 'sandbox', name: 'Sandbox', build: sandbox, people: 250, urgency: 30, aware: 50,
    blurb: 'An empty room with one exit. Draw walls, doors, pillars and exits, add people, and see where it jams.',
  },
];

export function buildScenario(id) {
  const sc = SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
  const b = builder();
  sc.build(b);
  return { ...b.L, scenario: sc };
}

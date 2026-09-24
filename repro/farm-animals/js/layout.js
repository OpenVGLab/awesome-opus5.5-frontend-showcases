/*
 * The map of Bramblewick. +x is east, +z is south; buildings face local +z (their door side).
 * Everything that is placed, painted or collided with is described here once.
 */

export const WORLD_R = 88;          // playable radius
export const PAINT_SIZE = 320;      // metres covered by the painted ground texture

export const SPAWN = { x: 0, z: 7, yaw: Math.PI };
export const MENU_SPOT = { x: -2.5, z: 1.5 };

export const HILL = { x: -50, z: 58, r: 24, h: 7.5 };
export const POND = { x: 6, z: 44, r: 9 };
export const LAKE = { x: -30, z: 225, r: 95 };
export const GREEN = { x: 58, z: -8, r: 13 };
export const YARD = { x: -2, z: -3, r: 15 };

export const BUILDINGS = [
  { id: 'barn', kind: 'barn', x: -16, z: -15, w: 14, d: 10, rot: 0 },
  { id: 'farmhouse', kind: 'farmhouse', x: 18, z: -16, w: 11, d: 7.5, rot: 0 },
  { id: 'cot1', kind: 'cottage', x: 46, z: -28, w: 8, d: 6, rot: 0, wall: 'white', roof: 'slate', door: '#6f8f73', h: 3.3 },
  { id: 'cot2', kind: 'cottage', x: 61, z: -30, w: 9, d: 6.5, rot: 0, wall: 'stone', roof: 'slate', door: '#a8584a', h: 5.2 },
  { id: 'cot3', kind: 'cottage', x: 77, z: -16, w: 8, d: 6, rot: -Math.PI / 2, wall: 'white', roof: 'thatch', door: '#6e8ca8', h: 3.2 },
  { id: 'cot4', kind: 'cottage', x: 78, z: 2, w: 9, d: 6, rot: -Math.PI / 2, wall: 'stone', roof: 'slate', door: '#6f8f73', h: 3.5 },
  { id: 'cot5', kind: 'cottage', x: 66, z: 15, w: 8, d: 6, rot: Math.PI, wall: 'white', roof: 'slate', door: '#b0874f', h: 5 },
  { id: 'chapel', kind: 'chapel', x: 45, z: 14, w: 7, d: 12, rot: Math.PI },
  { id: 'henhouse', kind: 'henhouse', x: 11, z: 6, w: 2.2, d: 1.7, rot: -0.35 },
  { id: 'kennel', kind: 'kennel', x: -8.5, z: 7, w: 1.3, d: 1.5, rot: Math.PI / 2 },
  { id: 'shelter', kind: 'shelter', x: -34, z: -2.6, w: 5, d: 2.6, rot: 0 },
  { id: 'shed', kind: 'shed', x: -36.5, z: 30.5, w: 3, d: 2.4, rot: Math.PI / 2 },
];

/* Paths: polylines in metres; width in metres */
export const PATHS = [
  { id: 'lane', w: 4.4, pts: [[8, 0], [20, -3.5], [32, -6], [45.5, -8]] },
  { id: 'villageNE', w: 3.8, pts: [[67.5, -17.5], [73, -28], [79, -40], [85, -54], [93, -68], [104, -86]] },
  { id: 'north', w: 3.4, pts: [[-1, -8], [0.5, -20], [1, -32], [-0.5, -48], [-3, -66], [-7, -96]] },
  { id: 'south', w: 3, pts: [[1, 10], [2.5, 20], [2, 30]] },
  { id: 'west', w: 3.4, pts: [[-11, 3], [-21, 7], [-30, 8.5], [-42, 9], [-54, 7], [-72, 5], [-100, 3]] },
  { id: 'garden', w: 2.2, pts: [[-13, 5], [-15.5, 15], [-18, 23.5]] },
  { id: 'hill', w: 2, pts: [[2, 30], [-8, 35], [-22, 41], [-36, 49], [-48.5, 57.5]] },
  { id: 'orchard', w: 2.4, pts: [[2.5, 20], [13, 21], [22, 25]] },
  { id: 'porch', w: 2, pts: [[18, -12], [18, -8], [16, -3], [12, -1]] },
  { id: 'cot1', w: 1.6, pts: [[46, -25], [48, -19]] },
  { id: 'cot2', w: 1.6, pts: [[61, -26.8], [60, -21]] },
  { id: 'cot3', w: 1.6, pts: [[74, -16], [70.5, -13]] },
  { id: 'cot4', w: 1.6, pts: [[75, 2], [70.5, -2]] },
  { id: 'cot5', w: 1.6, pts: [[66, 12], [64, 4.5]] },
  { id: 'chapel', w: 2, pts: [[45, 8], [48.5, 1]] },
];
export const RING_ROAD = { x: GREEN.x, z: GREEN.z, r: 13, w: 3.6 };

/* Fields and enclosures (axis-aligned rects: x0,x1,z0,z1) */
export const WHEAT = [
  { x0: -84, x1: -55, z0: -30, z1: 2.5 },
  { x0: -84, x1: -55, z0: 10, z1: 24 },
];
export const PADDOCK = { x0: -44, x1: -10, z0: -54, z1: -27, gate: { side: 'e', a: -43, b: -39 } };
export const MEADOW = { x0: 5, x1: 38, z0: -58, z1: -28, gate: { side: 'w', a: -46, b: -41 } };
export const STY = { x0: -38.5, x1: -29.5, z0: -4.2, z1: 4.2 };
export const GARDEN = { x0: -40, x1: -18, z0: 14, z1: 34, gate: { side: 'e', a: 22, b: 25 } };
export const ORCHARD = { x0: 20, x1: 48, z0: 12, z1: 42 };

/* Picket fence in front of the farmhouse, with a gate gap */
export const FARM_GARDEN = [[[12.5, -12.25], [12.5, -8.5], [16.9, -8.5]], [[19.1, -8.5], [23.5, -8.5], [23.5, -12.25]]];

export const APPLE_TREES = [];
for (const x of [26, 35, 44]) for (const z of [18, 27, 36]) APPLE_TREES.push([x + (z % 2) * 0.8, z + (x % 3) * 0.6]);
export const PEAR_TREES = [[6, -23], [71, -23]];

export const OAKS = [
  [-31, -25, 1.15], [22, -44, 1.3], [66, -2, 1.05], [-50, 58, 1.25], [-7, 25, 0.95], [41, -42, 1.0],
  [-62, 38, 1.1], [-60, -42, 1.2], [-20, 62, 1.0], [54, 46, 1.1], [72, -42, 0.95], [12, -72, 1.2],
  [-36, -72, 1.1], [30, 58, 1.0], [-72, 52, 1.0], [84, 22, 0.9], [-48, -22, 0.9], [26, -22, 0.8],
];
export const BIRCHES = [[52, 30], [58, 36], [-68, 44], [-14, -34], [36, 62], [-4, -62], [60, 28]];
export const WILLOWS = [[-4, 52], [16, 52]];

/* Water sources */
export const TROUGHS = [
  { x: -3, z: -7, rot: 0, w: 2.4, d: 0.8 },
  { x: -14, z: -33, rot: Math.PI / 2, w: 2.4, d: 0.8 },
  { x: -31.3, z: 2, rot: Math.PI / 2, w: 1.6, d: 0.7 },
  { x: 34, z: -53, rot: 0.3, w: 2.4, d: 0.8 },
];
export const WELL = { x: GREEN.x, z: GREEN.z };

/* Hay */
export const BALES = [
  { x: -10.3, z: -7.4, rot: 0.1, stack: 3 },
  { x: -13.2, z: -6.6, rot: -0.3, stack: 1 },
  { x: -21.6, z: -7.6, rot: 0.5, stack: 2 },
  { x: 31, z: -35, rot: 0.8, stack: 1 },
  { x: 29.2, z: -33.4, rot: 0.2, stack: 1 },
];
export const RICK = { x: -27.5, z: -10, r: 2.3 };
export const HAYRACK = { x: -38, z: -48, rot: 0.2 };

/* Fruit that never runs out */
export const MARKET = { x: 49.5, z: -3.5, rot: -Math.PI / 2 };
export const STRAWBERRIES = { x: -23.5, z: 30, w: 6, d: 2.2 };
export const BRAMBLE = { x: -29, z: 40 };

/* Where the animals like to be */
export const HOMES = {
  paddock: { type: 'rect', x0: -41, x1: -13, z0: -51, z1: -30 },
  meadow: { type: 'rect', x0: 8, x1: 35, z0: -55, z1: -31 },
  hillside: { type: 'circle', x: -42, z: 47, r: 11 },
  sty: { type: 'rect', x0: -37, x1: -31, z0: -0.6, z1: 3.4 },
  porch: { type: 'circle', x: 14, z: -5, r: 4.5 },
  yard: { type: 'circle', x: -1, z: 1, r: 8 },
  hens: { type: 'circle', x: 8, z: 8, r: 5.5 },
  pond: { type: 'circle', x: POND.x, z: POND.z, r: 5.6 },
  pondShore: { type: 'circle', x: -1, z: 34.5, r: 3 },
  garden: { type: 'circle', x: -29, z: 21.5, r: 4.5 },
  village: { type: 'circle', x: 68, z: 5, r: 3.5 },
  green: { type: 'circle', x: 57, z: -12, r: 5 },
};

export const PLACES = [
  { name: 'The Farmyard', sub: 'Bramblewick Farm', type: 'circle', x: -1, z: -2, r: 16 },
  { name: 'The Paddock', sub: 'where the horses graze', type: 'rect', x0: -44, x1: -10, z0: -54, z1: -27 },
  { name: 'Top Meadow', sub: 'buttercups and cows', type: 'rect', x0: 5, x1: 38, z0: -58, z1: -28 },
  { name: 'The Pig Sty', sub: 'mind the mud', type: 'rect', x0: -39, x1: -29, z0: -5, z1: 5 },
  { name: 'The Kitchen Garden', sub: 'cabbages, carrots and strawberries', type: 'rect', x0: -40, x1: -18, z0: 14, z1: 34 },
  { name: 'The Orchard', sub: 'apples for the taking', type: 'rect', x0: 20, x1: 48, z0: 12, z1: 42 },
  { name: 'The Duck Pond', sub: 'quack', type: 'circle', x: POND.x, z: POND.z, r: 14 },
  { name: 'Bramblewick Village', sub: 'please mind the washing', type: 'circle', x: 60, z: -6, r: 26 },
  { name: 'Lookout Hill', sub: 'the whole farm spread out below', type: 'circle', x: HILL.x, z: HILL.z, r: 12 },
  { name: 'The Wheat Field', sub: 'golden and tickly', type: 'rect', x0: -86, x1: -54, z0: -32, z1: 26 },
];

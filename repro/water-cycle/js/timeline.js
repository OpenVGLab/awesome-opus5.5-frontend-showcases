import { win, wrap01 } from './util.js';

export const LOOP_SECONDS = 32;

export const STAGES = [
  {
    key: 'evaporation', name: 'Evaporation', start: 0.0, color: '#ffc46b',
    text: 'The sun warms the sea. Water escapes as invisible vapour and rises on warm air, while plants breathe out more through their leaves.',
  },
  {
    key: 'condensation', name: 'Condensation', start: 0.25, color: '#dfeaf5',
    text: 'Higher up the air is cold. Vapour condenses on specks of dust into countless tiny droplets: clouds are born, and the wind carries them inland.',
  },
  {
    key: 'precipitation', name: 'Precipitation', start: 0.47, color: '#79b8ff',
    text: 'Droplets collide and grow until they are too heavy to float. They fall as rain on the hills and as snow on the cold peaks.',
  },
  {
    key: 'collection', name: 'Collection', start: 0.70, color: '#4fd6c4',
    text: 'Water runs off into streams and rivers or soaks into the ground as groundwater. Both find their way back to the sea, and the cycle begins again.',
  },
];

export function stageIndexAt(p) {
  for (let i = STAGES.length - 1; i >= 0; i--) if (p >= STAGES[i].start) return i;
  return 0;
}

// Lightning: phase, source cloud and where it strikes relative to the cloud
export const BOLTS = [
  { at: 0.553, cloud: 2, dx: 0.6, dz: 0.3 },
  { at: 0.596, cloud: 1, dx: -1.3, dz: 2.1 },
  { at: 0.637, cloud: 0, dx: -0.9, dz: 1.3 },
];
const BOLT_LEN = 0.0095;

export function lightning(p) {
  for (let i = 0; i < BOLTS.length; i++) {
    const d = wrap01(p - BOLTS[i].at);
    if (d < BOLT_LEN) {
      const k = d / BOLT_LEN;
      return { index: i, v: (1 - k) * (0.55 + 0.45 * Math.cos(k * 26)) };
    }
  }
  return { index: -1, v: 0 };
}

export const evapLevel = (p) => 0.18 + 0.82 * win(p, 0.86, 0.42, 0.10, 0.12);
export const transpLevel = (p) => 0.08 + 0.92 * win(p, 0.90, 0.38, 0.08, 0.10);

export function envelopes(p) {
  const storm = win(p, 0.40, 0.80, 0.10, 0.10);
  const bolt = lightning(p);
  return {
    storm,
    sun: 1 - 0.62 * storm,
    evap: evapLevel(p),
    transp: transpLevel(p),
    rain: win(p, 0.47, 0.72, 0.035, 0.06),
    snowfall: win(p, 0.48, 0.70, 0.04, 0.06),
    snow: win(p, 0.50, 0.40, 0.17, 0.66),
    runoff: win(p, 0.50, 0.95, 0.08, 0.12),
    flow: win(p, 0.53, 0.05, 0.14, 0.24),
    infil: win(p, 0.54, 0.92, 0.08, 0.12),
    ground: 0.3 + 0.7 * win(p, 0.60, 0.20, 0.12, 0.20),
    wet: win(p, 0.49, 0.02, 0.08, 0.30),
    rainbow: win(p, 0.705, 0.885, 0.035, 0.07),
    wind: 0.25 + 0.75 * win(p, 0.22, 0.76, 0.10, 0.10),
    flash: bolt.v,
    boltIndex: bolt.index,
  };
}

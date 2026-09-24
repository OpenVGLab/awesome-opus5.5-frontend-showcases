// Shared constants, the four streets and their melodies.

export const BEAT = 15;          // world units per beat at base speed
export const BAR_BEATS = 3;      // every street is a waltz
export const BAR = BEAT * BAR_BEATS;
export const HW = 8.2;           // half width of the road
export const THICK = 0.6;        // the road is a strip with a little thickness
export const STEP = 1.3;         // lateral distance between a staff line and the next space
export const V0 = 30;            // base speed (120 bpm)
export const TOL = 0.9;          // how close the car has to be to a note to play it
export const NOTE_LIFT = 1.5;
export const X_LIMIT = 6.9;

// Staff position p: 0 = E4 (bottom line) ... 8 = F5 (top line). High notes sit on the driver's left.
export const laneX = (p) => (4 - p) * STEP;
export const laneOfX = (x) => Math.max(-1, Math.min(9, Math.round(4 - x / STEP)));

export const PITCH_COLORS = {
  C: 0xe0553f, D: 0xeb903a, E: 0xeec13d, F: 0x7db04a, G: 0x39a095, A: 0x4a6ec4, B: 0x8a5ab4,
};

export const CHORDS = {
  C: [60, 64, 67], G: [59, 62, 67], F: [60, 65, 69], G7: [59, 62, 65, 67],
  Am: [60, 64, 69], Em: [59, 64, 67], D: [62, 66, 69], Dm: [62, 65, 69],
};
export const BASS = { C: 48, G: 43, F: 41, G7: 43, Am: 45, Em: 40, D: 50, Dm: 50 };

// Each street: one intro bar (the radio tunes in) followed by its melody.
export const STREETS = [
  {
    name: 'Ochre Street', fm: 88.1, key: 'C major', tag: 'the ground floor', bars: 9, sharps: [],
    chords: ['C', 'C', 'G', 'F', 'C', 'G', 'G7', 'C', 'C'],
    melody: 'G4 C5 E5 | D5:2 C5 | A4 C5 F5 | E5:3 | D5 B4 G4 | B4 C5 D5 | E5 C5 G4 | C5:3',
    style: 'waltz',
  },
  {
    name: 'Yellow Wall', fm: 92.4, key: 'G major', tag: 'the road folds 90° up the wall', bars: 9, sharps: ['F'],
    chords: ['G', 'G', 'C', 'D', 'G', 'Em', 'C', 'D', 'G'],
    melody: 'G4 B4 D5 | E5:2 D5 | A4 D5 F5 | G5:3 | E5 G5 E5 | C5 E5 G5 | F5 D5 A4 | G4:3',
    style: 'climb',
  },
  {
    name: 'Ceiling Row', fm: 97.7, key: 'A minor', tag: 'upside down: Ochre Street’s tune, inverted', bars: 9, sharps: [],
    chords: ['Am', 'F', 'Em', 'C', 'Am', 'G7', 'G', 'F', 'Am'],
    melody: 'F5 C5 A4 | B4:2 C5 | E5 C5 G4 | A4:3 | B4 D5 F5 | D5 C5 B4 | A4 C5 F5 | C5:3',
    style: 'night',
  },
  {
    name: 'Sheet Music Coda', fm: 104.3, key: 'C major', tag: 'the road turns into the score', bars: 13, sharps: [],
    chords: ['C', 'C', 'G7', 'Am', 'G', 'Am', 'Em', 'F', 'C', 'F', 'C', 'G7', 'C'],
    melody: 'G5 F5 E5 | F5 E5 D5 | E5 D5 C5 | D5 C5 B4 | C5 B4 A4 | B4 A4 G4 | A4 G4 F4 | G4 F4 E4 | A4 C5 F5 | E5 G5 E5 | D5 F5 B4 | C5:3',
    style: 'coda',
  },
];

const LETTERS = 'CDEFGAB';
const SEMIS = [0, 2, 4, 5, 7, 9, 11];

export function buildSong() {
  const streets = [];
  const notes = [];
  let startBeat = 0;
  STREETS.forEach((st, si) => {
    const beats = st.bars * BAR_BEATS;
    const street = {
      ...st, index: si, startBeat, beats, s0: startBeat * BEAT, s1: (startBeat + beats) * BEAT, notes: [],
    };
    let beat = startBeat + BAR_BEATS;
    for (const tok of st.melody.split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const [name, dur] = tok.split(':');
      const len = dur ? Number(dur) : 1;
      if (name !== 'r') {
        const letter = name[0];
        const octave = Number(name.slice(1));
        const li = LETTERS.indexOf(letter);
        const pos = (octave - 4) * 7 + li - 2;
        const acc = st.sharps.includes(letter) ? 1 : 0;
        const midi = 12 * (octave + 1) + SEMIS[li] + acc;
        const note = {
          index: notes.length, street: si, idxInStreet: street.notes.length, beat, beats: len,
          letter, octave, pos, acc, midi, freq: 440 * Math.pow(2, (midi - 69) / 12),
          s: beat * BEAT, x: laneX(pos), color: PITCH_COLORS[letter],
          type: len >= 3 ? 2 : len >= 2 ? 1 : 0,
        };
        notes.push(note);
        street.notes.push(note);
      }
      beat += len;
    }
    streets.push(street);
    startBeat += beats;
  });
  return { streets, notes, totalBeats: startBeat, L: startBeat * BEAT };
}

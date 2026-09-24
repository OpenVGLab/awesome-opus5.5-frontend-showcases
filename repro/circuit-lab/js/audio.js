// audio.js - small sound effects made on the fly with the Web Audio API (no sound files).
// Browsers only allow sound after the first click, so unlockAudio() is called on the first press.
let ctx = null;
let muted = false;

export function setMuted(m) { muted = m; }
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch (e) {
    ctx = null;   // no sound available - everything else keeps working
  }
}

// One short tone: frequency (Hz), length (s), waveform, volume, delay (s), optional pitch slide.
function tone(freq, len, type = 'sine', vol = 0.12, delay = 0, slideTo = null) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + len);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

// A burst of filtered noise, like the snap of a switch or a spark.
function noise(len, vol = 0.1, freq = 3000, delay = 0) {
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = buf;
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t);
}

export function sfx(name) {
  if (muted || !ctx || ctx.state !== 'running') return;
  switch (name) {
    case 'contact': tone(1760, 0.06, 'triangle', 0.1); tone(2640, 0.05, 'sine', 0.05, 0.02); break;
    case 'place': tone(520, 0.07, 'triangle', 0.08); break;
    case 'tick': tone(900, 0.04, 'square', 0.03); break;
    case 'switch': noise(0.05, 0.25, 2500); tone(180, 0.05, 'square', 0.03); break;
    case 'delete': tone(420, 0.12, 'triangle', 0.08, 0, 160); break;
    case 'scan': tone(600, 0.35, 'sine', 0.04, 0, 1400); break;
    case 'ok': tone(660, 0.16, 'sine', 0.11); tone(880, 0.16, 'sine', 0.1, 0.1); tone(1320, 0.3, 'sine', 0.09, 0.2); break;
    case 'fail': tone(220, 0.22, 'square', 0.05); tone(165, 0.3, 'square', 0.05, 0.18); break;
    case 'short': noise(0.35, 0.35, 1200); tone(90, 0.4, 'sawtooth', 0.06); break;
    case 'step': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.08, i * 0.08)); break;
    default: break;
  }
}

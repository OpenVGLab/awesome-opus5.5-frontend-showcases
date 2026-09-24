---
title: Generative Music in the Browser with the Web Audio API
description: Build a tiny lo-fi generator with oscillators, filters, a lookahead scheduler and a convolution reverb — the same engine behind this site's music player.
pubDate: 2026-04-02
tags: [web-audio, creative-coding, javascript]
cover: images/blog/generative-music-with-the-web-audio-api.webp
coverAlt: Layered sine waves in violet and coral forming a soft sound wave pattern
keywords: Web Audio API, generative music, JavaScript audio, creative coding, oscillators
---

The little player in the corner of my [homepage](/) does not stream an MP3. Every note is synthesised in real time by about 200 lines of JavaScript. Here is how that engine works, from the audio graph to the visualiser.

## The audio graph

Web Audio is a graph of nodes. Sources (oscillators, noise buffers) flow through processors (filters, gains, reverb) into the destination — your speakers.

```js
const ctx = new AudioContext();
const master = ctx.createGain();
const compressor = ctx.createDynamicsCompressor();
const analyser = ctx.createAnalyser();

master.gain.value = 0.6;
master.connect(compressor).connect(analyser).connect(ctx.destination);
```

## A lookahead scheduler

JavaScript timers are imprecise, but the audio clock is not. The trick, described by Chris Wilson years ago, is to wake up often with `setInterval` and schedule any notes that fall within the next 100 milliseconds using exact audio-clock times.

```js
const LOOKAHEAD = 0.1;
let nextNoteTime = ctx.currentTime;
let step = 0;

setInterval(() => {
  while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
    playStep(step, nextNoteTime);
    nextNoteTime += 60 / 76 / 2; // eighth notes at 76 BPM
    step = (step + 1) % 32;
  }
}, 25);
```

## Chords that never clash

Generative music sounds random when notes are random. Restrict every voice to the notes of the current chord and it will always sound intentional.

```js
const progression = [
  [53, 57, 60, 64], // Fmaj7
  [52, 55, 59, 62], // Em7
  [50, 53, 57, 60], // Dm7
  [48, 52, 55, 59], // Cmaj7
];
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
```

## Making it feel warm

Dry oscillators sound like a test tone. A low-pass filter softens them, slight detuning thickens them, and a convolution reverb puts them in a room. You do not need an impulse-response file — decaying noise works surprisingly well.

```js
function makeImpulse(seconds = 2.5) {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(2, rate * seconds, rate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    }
  }
  return buffer;
}
```

> [!WARNING]
> Browsers only allow audio to start after a user gesture. Create or resume the `AudioContext` inside a click handler, and never autoplay background music — always give people a clear play and pause control.

## Visualising the output

An `AnalyserNode` exposes the frequency spectrum every frame. The equaliser bars in the player simply read five frequency bands and map them to heights.

```js
const bins = new Uint8Array(analyser.frequencyBinCount);
function draw() {
  analyser.getByteFrequencyData(bins);
  bars.forEach((bar, i) => {
    bar.style.transform = `scaleY(${0.2 + bins[i * 6] / 320})`;
  });
  requestAnimationFrame(draw);
}
```

That is the entire engine. The same scheduling ideas power the [Sonic Garden installation](/#work), which ran for six months without a restart.

// Renders the 16-second "motion system breakdown" clip used by the blog's custom video player:
// SVG frames rasterised with sharp, a synthesised soundtrack, then ffmpeg (VP9/Opus + H.264/AAC).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { fonts, text, svg } from './lib.mjs';

const W = 1280, H = 720, FPS = 24, DURATION = 16;
const f = fonts;
const INK = '#161616', CREAM = '#F4EFE6', CORAL = '#FF4D2E', INDIGO = '#3D5AFE', MUTED = '#6F6860';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, start, dur) => clamp((t - start) / dur);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIn = (x) => x * x * x;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const spring = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(11 * x));
const lerp = (a, b, x) => a + (b - a) * x;

// Pre-built text paths; each frame only changes transforms and opacity.
const T = {
  title: text(f.serif, 'Motion system', 0, 0, 132, { fill: INK, anchor: 'middle' }),
  subtitle: text(f.sans, 'Easing · Choreography · Restraint', 0, 0, 36, { fill: MUTED, anchor: 'middle' }),
  s1: text(f.mono, '1 · EASING', 0, 0, 26, { fill: CORAL, tracking: 0.2 }),
  s2: text(f.mono, '2 · CHOREOGRAPHY', 0, 0, 26, { fill: CORAL, tracking: 0.2 }),
  linear: text(f.sansMedium, 'Linear', 0, 0, 32, { fill: INK, anchor: 'end' }),
  easeOut: text(f.sansMedium, 'Ease-out', 0, 0, 32, { fill: INK, anchor: 'end' }),
  spring: text(f.sansMedium, 'Spring', 0, 0, 32, { fill: INK, anchor: 'end' }),
  capB: text(f.sans, 'Enter with ease-out. Can people grab it? Use a spring.', 0, 0, 30, { fill: MUTED, anchor: 'middle' }),
  capC: text(f.sans, 'Container, then primary content, then details — 60 ms stagger.', 0, 0, 30, { fill: MUTED, anchor: 'middle' }),
  end: text(f.serif, 'Restraint is a feature.', 0, 0, 96, { fill: INK, anchor: 'middle' }),
  url: text(f.mono, 'maraellison.dev', 0, 0, 30, { fill: MUTED, anchor: 'middle' }),
  n1: text(f.sansSemi, '1', 0, 0, 26, { fill: '#fff', anchor: 'middle' }),
  n2: text(f.sansSemi, '2', 0, 0, 26, { fill: '#fff', anchor: 'middle' }),
  n3: text(f.sansSemi, '3', 0, 0, 26, { fill: '#fff', anchor: 'middle' }),
};
const place = (p, x, y, o = 1, s = 1) => (o <= 0.001 ? '' : `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})" opacity="${o.toFixed(3)}">${p}</g>`);

const grid = Array.from({ length: 17 }, (_, i) => `<line x1="${i * 80}" x2="${i * 80}" y1="0" y2="${H}" stroke="${INK}" stroke-opacity="0.045"/>`).join('') +
  Array.from({ length: 10 }, (_, i) => `<line x1="0" x2="${W}" y1="${i * 80}" y2="${i * 80}" stroke="${INK}" stroke-opacity="0.045"/>`).join('');

function frame(t) {
  let body = `<rect width="${W}" height="${H}" fill="${CREAM}"/>${grid}`;

  if (t < 3.3) {
    const inP = easeOut(prog(t, 0.2, 0.9));
    const out = easeIn(prog(t, 2.7, 0.5));
    const y = lerp(60, 0, inP) - out * 60;
    body += `<circle cx="${1010}" cy="${230}" r="${(90 * spring(prog(t, 0.4, 1.1)) * (1 - out)).toFixed(1)}" fill="${CORAL}"/>`;
    body += `<circle cx="${270}" cy="${520}" r="${(40 * spring(prog(t, 0.6, 1.1)) * (1 - out)).toFixed(1)}" fill="${INDIGO}"/>`;
    body += place(T.title, W / 2, 360 + y, inP * (1 - out));
    body += place(T.subtitle, W / 2, 430 + y * 0.6, easeOut(prog(t, 0.8, 0.6)) * (1 - out));
  }

  if (t >= 3.1 && t < 9.4) {
    const vis = easeOut(prog(t, 3.2, 0.4)) * (1 - easeIn(prog(t, 8.9, 0.4)));
    body += `<g opacity="${vis.toFixed(3)}">`;
    body += place(T.s1, 120, 110, 1);
    const tracks = [[T.linear, (x) => x, INK], [T.easeOut, easeOut, CORAL], [T.spring, spring, INDIGO]];
    tracks.forEach(([label, fn, color], i) => {
      const y = 250 + i * 130;
      const x0 = 300, x1 = 1080;
      body += place(label, 250, y + 11, 1);
      body += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${INK}" stroke-opacity="0.15" stroke-width="4" stroke-linecap="round"/>`;
      const fwd = prog(t, 3.7, 1.6), back = prog(t, 6.2, 1.6);
      const pos = t < 6.2 ? fn(fwd) : 1 - fn(back);
      for (let g = 1; g <= 4; g++) {
        const tg = t - g * 0.05;
        const pg = tg < 6.2 ? fn(prog(tg, 3.7, 1.6)) : 1 - fn(prog(tg, 6.2, 1.6));
        body += `<circle cx="${lerp(x0, x1, pg).toFixed(1)}" cy="${y}" r="${24 - g * 3}" fill="${color}" opacity="${(0.22 - g * 0.04).toFixed(2)}"/>`;
      }
      body += `<circle cx="${lerp(x0, x1, pos).toFixed(1)}" cy="${y}" r="24" fill="${color}"/>`;
    });
    body += place(T.capB, W / 2, 650, easeOut(prog(t, 5.4, 0.5)));
    body += `</g>`;
  }

  if (t >= 9.2 && t < 14.2) {
    const vis = 1 - easeIn(prog(t, 13.6, 0.5));
    body += `<g opacity="${vis.toFixed(3)}">`;
    body += place(T.s2, 120, 110, easeOut(prog(t, 9.2, 0.4)));
    const c = easeOut(prog(t, 9.4, 0.45));
    const s = 0.94 + 0.06 * c;
    body += `<g transform="translate(640 390) scale(${s.toFixed(3)}) translate(-640 -390)" opacity="${c.toFixed(3)}"><rect x="250" y="170" width="780" height="440" rx="36" fill="#fff" stroke="${INK}" stroke-opacity="0.08" stroke-width="2"/></g>`;
    const p = easeOut(prog(t, 9.9, 0.4));
    body += `<g opacity="${p.toFixed(3)}" transform="translate(0 ${lerp(24, 0, p).toFixed(1)})"><rect x="300" y="220" width="420" height="42" rx="12" fill="${INK}"/><rect x="300" y="282" width="560" height="20" rx="10" fill="${INK}" fill-opacity="0.18"/><rect x="300" y="318" width="480" height="20" rx="10" fill="${INK}" fill-opacity="0.18"/></g>`;
    [0, 1, 2].forEach((k) => {
      const q = easeOut(prog(t, 10.4 + k * 0.06, 0.45));
      const x = 300 + k * 240;
      body += `<g opacity="${q.toFixed(3)}" transform="translate(0 ${lerp(30, 0, q).toFixed(1)})"><rect x="${x}" y="380" width="200" height="180" rx="22" fill="${[CORAL, INDIGO, '#2A9D8F'][k]}" fill-opacity="0.9"/><rect x="${x + 24}" y="508" width="120" height="16" rx="8" fill="#fff" fill-opacity="0.7"/></g>`;
    });
    const badge = (n, x, y, start) => {
      const b = spring(prog(t, start, 0.6));
      return b > 0.01 ? `<g transform="translate(${x} ${y}) scale(${b.toFixed(3)})"><circle r="24" fill="${INK}"/>${place(n, 0, 9, 1)}</g>` : '';
    };
    body += badge(T.n1, 1030, 170, 9.7) + badge(T.n2, 740, 240, 10.2) + badge(T.n3, 1000, 380, 10.7);
    body += place(T.capC, W / 2, 668, easeOut(prog(t, 11.2, 0.5)));
    body += `</g>`;
  }

  if (t >= 14.0) {
    const a = easeOut(prog(t, 14.2, 0.7));
    const pulse = 1 + 0.08 * Math.sin((t - 14) * 6);
    body += `<circle cx="${W / 2}" cy="240" r="${(34 * spring(prog(t, 14.1, 0.8)) * pulse).toFixed(1)}" fill="${CORAL}"/>`;
    body += place(T.end, W / 2, 400 + lerp(40, 0, a), a);
    body += place(T.url, W / 2, 470, easeOut(prog(t, 14.7, 0.6)));
  }

  return svg(W, H, body);
}

function soundtrack(file) {
  const rate = 44100, n = rate * DURATION;
  const L = new Float32Array(n), R = new Float32Array(n);
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const chord = chords[Math.floor(t / 4) % 4];
    const local = t % 4;
    const env = Math.min(1, local / 0.8) * Math.min(1, (4 - local) / 0.6) * Math.min(1, (DURATION - t) / 1.2);
    let s = 0;
    chord.forEach((m, k) => {
      s += Math.sin(2 * Math.PI * hz(m) * t + k) * 0.05 + Math.sin(2 * Math.PI * hz(m) * 1.003 * t) * 0.03;
    });
    s += Math.sin(2 * Math.PI * hz(chord[0] - 12) * t) * 0.06;
    L[i] += s * env;
    R[i] += s * env * 0.92;
  }
  const blip = (at, freq, amp = 0.25) => {
    for (let i = 0; i < rate * 0.25; i++) {
      const t = i / rate, idx = Math.floor(at * rate) + i;
      if (idx >= n) break;
      const v = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 28) * amp;
      L[idx] += v; R[idx] += v;
    }
  };
  const whoosh = (at, dur = 0.6) => {
    let y = 0;
    for (let i = 0; i < rate * dur; i++) {
      const t = i / rate, idx = Math.floor(at * rate) + i;
      if (idx >= n) break;
      const k = 0.02 + 0.2 * Math.sin((Math.PI * t) / dur);
      y += k * ((Math.random() * 2 - 1) - y);
      const v = y * Math.sin((Math.PI * t) / dur) * 0.35;
      L[idx] += v; R[idx] += v * 0.8;
    }
  };
  [5.3, 7.8].forEach((at) => { blip(at, 880); blip(at + 0.05, 1320, 0.12); });
  [9.7, 10.2, 10.7].forEach((at, k) => blip(at, 660 + k * 220, 0.2));
  whoosh(2.8); whoosh(8.8); whoosh(13.6); blip(14.2, 523, 0.3); blip(14.3, 784, 0.2);

  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(clamp(L[i], -1, 1) * 32000), 44 + i * 4);
    buf.writeInt16LE(Math.round(clamp(R[i], -1, 1) * 32000), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

const captions = `WEBVTT

00:00.000 --> 00:03.000
Designing a motion system: easing, choreography and restraint.

00:03.200 --> 00:06.000
Linear motion feels mechanical. Ease-out arrives and settles.

00:06.000 --> 00:09.000
Springs respond to velocity — perfect for anything people can grab.

00:09.200 --> 00:12.000
Choreography: the container first, then primary content, then details.

00:12.000 --> 00:14.000
A 60 millisecond stagger reads as intentional.

00:14.000 --> 00:16.000
And remember: restraint is a feature.
`;

const chapters = `WEBVTT

00:00.000 --> 00:03.200
Intro

00:03.200 --> 00:09.200
Easing

00:09.200 --> 00:14.000
Choreography

00:14.000 --> 00:16.000
Restraint
`;

export async function renderVideo(outDir, ffmpeg) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repro-portfolio-video-'));
  const total = FPS * DURATION;
  for (let i = 0; i < total; i++) {
    await sharp(Buffer.from(frame(i / FPS))).png({ compressionLevel: 1 }).toFile(path.join(tmp, `f${String(i).padStart(4, '0')}.png`));
  }
  const wav = path.join(tmp, 'audio.wav');
  soundtrack(wav);
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, 'motion-system-breakdown');
  const input = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png'), '-i', wav];
  execFileSync(ffmpeg, [...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', '-pix_fmt', 'yuv420p', '-c:a', 'libopus', '-b:a', '64k', '-shortest', `${base}.webm`]);
  execFileSync(ffmpeg, [...input, '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', '-shortest', `${base}.mp4`]);
  await sharp(path.join(tmp, `f${String(Math.round(1.6 * FPS)).padStart(4, '0')}.png`)).jpeg({ quality: 82, mozjpeg: true }).toFile(`${base}-poster.jpg`);
  fs.writeFileSync(`${base}.en.vtt`, captions);
  fs.writeFileSync(`${base}.chapters.vtt`, chapters);
  fs.rmSync(tmp, { recursive: true, force: true });
  return ['webm', 'mp4'].map((e) => [`${base}.${e}`, fs.statSync(`${base}.${e}`).size]);
}

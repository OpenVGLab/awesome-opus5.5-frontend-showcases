// Generates every binary asset the site uses: responsive project art, the illustrated headshot,
// blog covers, Open Graph cards, icons, the 404 Lottie animation, the demo video and a sample brief.
// Usage: node scripts/generate-assets.mjs [--force] [--only=projects,portrait,covers,icons,lottie,video,pdf]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { PROJECTS, PERSON } from '../content/shared.js';
import { writeResponsive, writeImage } from './assets/lib.mjs';
import { projectArt } from './assets/projects.mjs';
import { portrait } from './assets/portrait.mjs';
import { coverArt, ogOverlay, homeOg, icon } from './assets/covers.mjs';
import { lostInSpace } from './assets/lottie.mjs';
import { renderVideo } from './assets/video.mjs';

const PUBLIC = path.resolve('public');
const force = process.argv.includes('--force');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;
const want = (k) => !only || only.has(k);
const exists = (p) => fs.existsSync(p) && !force;
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;

async function projects() {
  for (const p of PROJECTS) {
    const out = path.join(PUBLIC, p.image.src);
    if (exists(out.replace('.webp', '-1600.webp'))) continue;
    const size = await writeResponsive(projectArt[p.id](), out);
    console.log(`project ${p.id}: ${kb(size)} across 5 widths`);
  }
}

async function headshot() {
  const out = path.join(PUBLIC, PERSON.headshot.src);
  if (exists(out.replace('.webp', '-1600.webp'))) return;
  const size = await writeResponsive(portrait(), out, { quality: 82 });
  console.log(`headshot: ${kb(size)}`);
}

async function covers() {
  const posts = JSON.parse(fs.readFileSync('data/posts.json', 'utf8'));
  for (const post of posts) {
    const out = path.join(PUBLIC, post.cover);
    const og = out.replace('.webp', '-og.jpg');
    if (!exists(out.replace('.webp', '-1600.webp'))) {
      const size = await writeResponsive(coverArt[post.slug](), out);
      console.log(`cover ${post.slug}: ${kb(size)}`);
    }
    if (!exists(og)) {
      const base = await sharp(Buffer.from(coverArt[post.slug]())).resize({ width: 1200, height: 630, fit: 'cover' }).png().toBuffer();
      const overlay = await sharp(Buffer.from(ogOverlay(post.title, post.tags))).png().toBuffer();
      await sharp(base).composite([{ input: overlay }]).jpeg({ quality: 82, mozjpeg: true }).toFile(og);
    }
  }
  const homeOgFile = path.join(PUBLIC, PERSON.ogImage);
  if (!exists(homeOgFile)) console.log(`home og: ${kb(await writeImage(homeOg(portrait()), homeOgFile, { quality: 86 }))}`);
}

async function icons() {
  const svgFile = path.join(PUBLIC, 'favicon.svg');
  if (exists(svgFile)) return;
  fs.writeFileSync(svgFile, icon(64));
  await writeImage(icon(512), path.join(PUBLIC, 'icons/favicon-32.png'), { width: 32, format: 'png' });
  await writeImage(icon(512), path.join(PUBLIC, 'icons/apple-touch-icon.png'), { width: 180, format: 'png' });
  await writeImage(icon(512), path.join(PUBLIC, 'icons/icon-192.png'), { width: 192, format: 'png' });
  await writeImage(icon(512), path.join(PUBLIC, 'icons/icon-512.png'), { width: 512, format: 'png' });
  await writeImage(icon(512, { maskable: true }), path.join(PUBLIC, 'icons/icon-maskable-512.png'), { width: 512, format: 'png' });
  const manifest = {
    name: 'Mara Ellison — Creative Frontend Developer',
    short_name: 'Mara Ellison',
    description: 'Portfolio and blog of Mara Ellison, creative frontend developer in Lisbon.',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#F4F1EA',
    theme_color: '#141414',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  fs.writeFileSync(path.join(PUBLIC, 'site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('icons + manifest written');
}

function lottie() {
  const out = path.join(PUBLIC, 'lottie/lost-in-space.json');
  if (exists(out)) return;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(lostInSpace()));
  console.log(`lottie: ${kb(fs.statSync(out).size)}`);
}

async function video() {
  const out = path.join(PUBLIC, 'media/motion-system-breakdown.webm');
  if (exists(out)) return;
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  const files = await renderVideo(path.join(PUBLIC, 'media'), ffmpeg);
  files.forEach(([f, s]) => console.log(`video ${path.basename(f)}: ${kb(s)}`));
}

function pdf() {
  const out = path.join(PUBLIC, 'media/sample-project-brief.pdf');
  if (exists(out)) return;
  const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const lines = [
    ['F1', 24, 'Project brief: Nordlys winter campaign'],
    ['F2', 12, 'Prepared for Mara Ellison Studio - sample document for the contact form demo'],
    ['F1', 14, 'Goal'],
    ['F2', 12, 'Launch an interactive WebGL lookbook for the new Arctic Parka line.'],
    ['F1', 14, 'Audience'],
    ['F2', 12, 'Outdoor enthusiasts, 25-45, mostly on mobile (68% of traffic).'],
    ['F1', 14, 'Timeline'],
    ['F2', 12, 'Kickoff 10 November 2026 - launch 2 February 2027.'],
    ['F1', 14, 'Budget'],
    ['F2', 12, 'EUR 25k - 50k, including a two-week performance hardening sprint.'],
    ['F1', 14, 'Must-haves'],
    ['F2', 12, '- Real-time 3D configurator with shareable URLs'],
    ['F2', 12, '- WCAG 2.2 AA, LCP under 2.5 s on 4G'],
    ['F2', 12, '- Localised in English, Norwegian and German'],
  ];
  let y = 740;
  const ops = ['BT'];
  for (const [font, size, str] of lines) {
    y -= size === 24 ? 0 : size === 14 ? 30 : 20;
    ops.push(`/${font} ${size} Tf`, `1 0 0 1 72 ${y} Tm`, `(${esc(str)}) Tj`);
    if (size === 24) y -= 16;
  }
  ops.push('ET');
  const stream = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Title (Sample project brief) /Author (Mara Ellison Studio) >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body);
  console.log(`sample brief pdf: ${kb(fs.statSync(out).size)}`);
}

if (want('projects')) await projects();
if (want('portrait')) await headshot();
if (want('covers')) await covers();
if (want('icons')) await icons();
if (want('lottie')) lottie();
if (want('pdf')) pdf();
if (want('video')) await video();

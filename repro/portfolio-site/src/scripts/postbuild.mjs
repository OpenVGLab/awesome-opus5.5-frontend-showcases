// Merges the Next.js export (out/) and the Astro blog (dist-blog/) into release/, rewrites every
// root-relative URL to a relative one (so the site runs from any sub-folder, e.g. GitHub Pages or a
// showcase directory), and writes sitemap.xml, robots.txt and Netlify-style _headers/_redirects.
import fs from 'node:fs';
import path from 'node:path';
import { relativizeNextExport } from './relativize-next.mjs';

const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'out');
const BLOG = path.join(ROOT, 'dist-blog');
const RELEASE = path.join(ROOT, 'release');
const SITE = (process.env.SITE_URL || 'https://maraellison.dev').replace(/\/$/, '');
const TODAY = new Date().toISOString().slice(0, 10);

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });

// Guard against shipping a prerender that is missing sections (it would fail hydration).
for (const page of ['index.html', 'zh.html']) {
  const html = fs.readFileSync(path.join(OUT, page), 'utf8');
  const missing = ['top', 'about', 'skills', 'work', 'testimonials', 'experience', 'locations', 'blog', 'faq', 'contact'].filter((id) => !html.includes(`id="${id}"`));
  if (missing.length) throw new Error(`${page} prerender is missing sections: ${missing.join(', ')}`);
}

fs.rmSync(RELEASE, { recursive: true, force: true });
fs.cpSync(OUT, RELEASE, { recursive: true });
relativizeNextExport(RELEASE);
const nextPages = new Set(fs.readdirSync(RELEASE).filter((f) => f.endsWith('.html')));
fs.cpSync(BLOG, RELEASE, { recursive: true });

// ---------- Relativize the Astro output ----------
function prefixFor(file) {
  const depth = path.relative(RELEASE, file).split(path.sep).length - 1;
  return depth === 0 ? './' : '../'.repeat(depth);
}

function relativizeHtml(html, prefix) {
  const fix = (url) => (url.startsWith('/') && !url.startsWith('//') ? prefix + url.slice(1) : url);
  return html
    .replace(/(\s(?:href|src|action|poster|data-src)=")([^"]*)"/g, (_, attr, url) => `${attr}${fix(url)}"`)
    .replace(/(\ssrcset=")([^"]*)"/g, (_, attr, list) => `${attr}${list.split(',').map((part) => fix(part.trim())).join(', ')}"`)
    .replace(/url\((['"]?)\/(?!\/)/g, `url($1${prefix}`)
    .replace(/((?:from|import)\s*\(?\s*["'])\/_astro\//g, `$1${prefix}_astro/`);
}

let htmlCount = 0;
for (const file of walk(RELEASE)) {
  const rel = path.relative(RELEASE, file);
  if (file.endsWith('.html') && !(nextPages.has(rel) && !rel.includes(path.sep))) {
    fs.writeFileSync(file, relativizeHtml(fs.readFileSync(file, 'utf8'), prefixFor(file)));
    htmlCount++;
  } else if (rel.startsWith(`_astro${path.sep}`) && file.endsWith('.css')) {
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/url\((['"]?)\/_astro\//g, 'url($1./'));
  }
}

// ---------- Sitemap ----------
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/posts.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const urls = [];
const homeAlternates = [
  ['en', `${SITE}/`],
  ['zh-Hans', `${SITE}/zh`],
  ['x-default', `${SITE}/`],
];
urls.push({ loc: `${SITE}/`, lastmod: TODAY, priority: '1.0', changefreq: 'weekly', alternates: homeAlternates, images: [[`${SITE}/images/og/mara-ellison-portfolio-og.jpg`, 'Mara Ellison — creative frontend developer']] });
urls.push({ loc: `${SITE}/zh`, lastmod: TODAY, priority: '0.9', changefreq: 'weekly', alternates: homeAlternates });

const blogDirs = walk(path.join(RELEASE, 'blog'))
  .filter((f) => f.endsWith(`${path.sep}index.html`))
  .map((f) => path.relative(RELEASE, path.dirname(f)).split(path.sep).join('/'))
  .filter((p) => !p.startsWith('blog/amp') && p !== 'blog/newsletter')
  .sort();
for (const dir of blogDirs) {
  const slug = dir.split('/')[1];
  const post = posts.find((p) => p.slug === slug && dir === `blog/${slug}`);
  const entry = { loc: `${SITE}/${dir}/`, lastmod: post ? post.updatedDate || post.pubDate : TODAY, priority: post ? '0.8' : dir === 'blog' ? '0.8' : '0.5', changefreq: post ? 'monthly' : 'weekly' };
  if (post) {
    entry.images = [[`${SITE}/${post.cover.replace('.webp', '-1600.webp')}`, post.coverAlt]];
    if (post.hasVideo) {
      entry.video = {
        thumb: `${SITE}/media/motion-system-breakdown-poster.jpg`,
        title: 'Motion system breakdown — easing, choreography and restraint',
        description: "A 16-second breakdown of the three principles behind this portfolio's motion system.",
        content: `${SITE}/media/motion-system-breakdown.mp4`,
        duration: 16,
        date: post.pubDate,
      };
    }
  }
  urls.push(entry);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls
  .map(
    (u) => `  <url>
    <loc>${esc(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${(u.alternates || []).map(([lang, href]) => `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${esc(href)}"/>`).join('')}${(u.images || [])
      .map(([loc, title]) => `\n    <image:image><image:loc>${esc(loc)}</image:loc><image:title>${esc(title)}</image:title></image:image>`)
      .join('')}${
      u.video
        ? `\n    <video:video><video:thumbnail_loc>${esc(u.video.thumb)}</video:thumbnail_loc><video:title>${esc(u.video.title)}</video:title><video:description>${esc(u.video.description)}</video:description><video:content_loc>${esc(u.video.content)}</video:content_loc><video:duration>${u.video.duration}</video:duration><video:publication_date>${u.video.date}</video:publication_date></video:video>`
        : ''
    }
  </url>`,
  )
  .join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(RELEASE, 'sitemap.xml'), sitemap);

fs.writeFileSync(
  path.join(RELEASE, 'robots.txt'),
  `# Mara Ellison — portfolio & blog
User-agent: *
Allow: /
Disallow: /blog/newsletter/

Sitemap: ${SITE}/sitemap.xml
`,
);

// Netlify reads these from the publish directory (vercel.json in src/ mirrors them for Vercel).
fs.writeFileSync(
  path.join(RELEASE, '_headers'),
  `/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  X-Frame-Options: SAMEORIGIN
/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
/_astro/*
  Cache-Control: public, max-age=31536000, immutable
/images/*
  Cache-Control: public, max-age=2592000, stale-while-revalidate=86400
/media/*
  Cache-Control: public, max-age=2592000
`,
);
fs.writeFileSync(
  path.join(RELEASE, '_redirects'),
  `http://maraellison.dev/*  https://maraellison.dev/:splat  301!
/blog/feed  /blog/rss.xml  301
/feed.xml   /blog/rss.xml  301
/*          /404.html      404
`,
);

const size = walk(RELEASE).reduce((n, f) => n + fs.statSync(f).size, 0);
console.log(`release/: ${walk(RELEASE).length} files, ${(size / 1024 / 1024).toFixed(1)} MB; relativized ${htmlCount} blog pages; sitemap ${urls.length} URLs`);

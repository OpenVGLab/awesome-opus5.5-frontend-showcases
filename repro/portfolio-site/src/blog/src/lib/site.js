export const SITE = {
  name: 'Mara Ellison',
  title: 'Mara Ellison — Blog',
  description: 'Long-form articles on WebGL, web performance, motion design, accessibility and the web platform by creative frontend developer Mara Ellison.',
  author: 'Mara Ellison',
  email: 'hello@maraellison.dev',
  twitter: '@maraellison',
  ogImage: 'images/og/mara-ellison-portfolio-og.jpg',
  avatar: 'images/mara-ellison-creative-frontend-developer-headshot-256.webp',
};

export const COVER_WIDTHS = [480, 800, 1200, 1600];

export const postPath = (slug) => `/blog/${slug}/`;
export const tagPath = (tag) => `/blog/tags/${tag}/`;
export const ampPath = (slug) => `/blog/amp/${slug}/`;

export const absolute = (site, path) => new URL(path.replace(/^\/?/, '/'), site).href;

export const coverSrc = (cover, width) => `/${cover.replace(/\.webp$/, `-${width}.webp`)}`;
export const coverSrcset = (cover) => COVER_WIDTHS.map((w) => `${coverSrc(cover, w)} ${w}w`).join(', ');
export const ogImageFor = (cover) => cover.replace(/\.webp$/, '-og.jpg');

export function formatDate(date, opts = { year: 'numeric', month: 'long', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(date);
}

export const isoDate = (date) => date.toISOString().slice(0, 10);

export function tagLabel(tag) {
  const special = { webgl: 'WebGL', threejs: 'Three.js', nextjs: 'Next.js', seo: 'SEO', css: 'CSS', 'json-ld': 'JSON-LD', 'web-audio': 'Web Audio' };
  return special[tag] || tag.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const sortByDate = (posts) => [...posts].sort((a, b) => b.data.pubDate - a.data.pubDate);

export function relatedPosts(post, all, limit = 3) {
  return all
    .filter((p) => p.id !== post.id)
    .map((p) => ({ p, score: p.data.tags.filter((t) => post.data.tags.includes(t)).length }))
    .sort((a, b) => b.score - a.score || b.p.data.pubDate - a.p.data.pubDate)
    .slice(0, limit)
    .map(({ p }) => p);
}

// Astro.glob() results (index + archive) expose raw frontmatter; normalise them for cards.
export function fromGlob(mod) {
  const slug = mod.file.split('/').pop().replace(/\.md$/, '');
  const fm = mod.frontmatter;
  return {
    slug,
    title: fm.title,
    description: fm.description,
    pubDate: new Date(fm.pubDate),
    updatedDate: fm.updatedDate ? new Date(fm.updatedDate) : null,
    tags: fm.tags,
    cover: fm.cover,
    coverAlt: fm.coverAlt,
    featured: Boolean(fm.featured),
    minutesRead: fm.minutesRead,
    hasVideo: Boolean(fm.video),
  };
}

export function fromEntry(entry, minutesRead) {
  return {
    slug: entry.id,
    title: entry.data.title,
    description: entry.data.description,
    pubDate: entry.data.pubDate,
    updatedDate: entry.data.updatedDate || null,
    tags: entry.data.tags,
    cover: entry.data.cover,
    coverAlt: entry.data.coverAlt,
    featured: entry.data.featured,
    minutesRead,
    hasVideo: Boolean(entry.data.video),
  };
}

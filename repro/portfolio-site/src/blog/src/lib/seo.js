import { SITE, absolute, coverSrc, ogImageFor, postPath } from './site';

export const personId = (site) => `${absolute(site, '/')}#person`;
export const websiteId = (site) => `${absolute(site, '/')}#website`;
export const blogId = (site) => `${absolute(site, '/blog/')}#blog`;

export function breadcrumbJsonLd(site, items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absolute(site, item.path) })),
  };
}

export function blogJsonLd(site, posts) {
  return {
    '@type': 'Blog',
    '@id': blogId(site),
    url: absolute(site, '/blog/'),
    name: SITE.title,
    description: SITE.description,
    inLanguage: 'en',
    publisher: { '@id': personId(site) },
    isPartOf: { '@id': websiteId(site) },
    blogPost: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: absolute(site, postPath(p.slug)), datePublished: p.pubDate.toISOString() })),
  };
}

export function personJsonLd(site) {
  return {
    '@type': 'Person',
    '@id': personId(site),
    name: SITE.author,
    url: absolute(site, '/'),
    jobTitle: 'Creative Frontend Developer',
    image: absolute(site, SITE.avatar),
    sameAs: ['https://github.com/maraellison', 'https://www.linkedin.com/in/maraellison', 'https://x.com/maraellison'],
  };
}

export function postingJsonLd(site, entry, meta) {
  const url = absolute(site, postPath(entry.id));
  const d = entry.data;
  const node = {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: d.title,
    description: d.description,
    image: [absolute(site, coverSrc(d.cover, 1600)), absolute(site, ogImageFor(d.cover))],
    datePublished: d.pubDate.toISOString(),
    dateModified: (d.updatedDate || d.pubDate).toISOString(),
    author: { '@id': personId(site) },
    publisher: { '@id': personId(site) },
    isPartOf: { '@id': blogId(site) },
    inLanguage: 'en',
    keywords: d.keywords || d.tags.join(', '),
    articleSection: d.tags[0],
    wordCount: meta.words,
    timeRequired: `PT${meta.minutesRead}M`,
  };
  if (d.video) node.video = { '@id': `${url}#video` };
  return node;
}

export function videoJsonLd(site, entry) {
  const v = entry.data.video;
  const url = absolute(site, postPath(entry.id));
  return {
    '@type': 'VideoObject',
    '@id': `${url}#video`,
    name: v.title,
    description: v.description,
    thumbnailUrl: [absolute(site, v.poster)],
    uploadDate: v.uploadDate.toISOString(),
    duration: v.duration,
    contentUrl: absolute(site, v.mp4),
    embedUrl: `${url}#video`,
    inLanguage: 'en',
    hasPart: [
      { '@type': 'Clip', name: 'Intro', startOffset: 0, endOffset: 3, url: `${url}?t=0#video` },
      { '@type': 'Clip', name: 'Easing', startOffset: 3, endOffset: 9, url: `${url}?t=3#video` },
      { '@type': 'Clip', name: 'Choreography', startOffset: 9, endOffset: 14, url: `${url}?t=9#video` },
      { '@type': 'Clip', name: 'Restraint', startOffset: 14, endOffset: 16, url: `${url}?t=14#video` },
    ],
  };
}

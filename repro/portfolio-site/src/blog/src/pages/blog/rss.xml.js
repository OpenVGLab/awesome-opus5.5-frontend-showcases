import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE, coverSrc, postPath, sortByDate } from '../../lib/site';

export async function GET(context) {
  const posts = sortByDate(await getCollection('blog'));
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postPath(post.id),
      categories: post.data.tags,
      author: `${SITE.email} (${SITE.author})`,
      enclosure: { url: new URL(coverSrc(post.data.cover, 1200), context.site).href, type: 'image/webp', length: 0 },
    })),
    customData: '<language>en</language><copyright>© 2026 Mara Ellison</copyright>',
  });
}

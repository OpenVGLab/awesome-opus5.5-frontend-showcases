// Extracts blog metadata for the Next.js homepage (featured carousel, latest posts, footer).
// The Astro blog reads the same Markdown files through its content collection.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

const dir = path.resolve('blog/src/content/blog');
const posts = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .map((file) => {
    const { data, content } = matter(fs.readFileSync(path.join(dir, file), 'utf8'));
    const slug = file.replace(/\.md$/, '');
    return {
      slug,
      title: data.title,
      description: data.description,
      pubDate: new Date(data.pubDate).toISOString().slice(0, 10),
      updatedDate: data.updatedDate ? new Date(data.updatedDate).toISOString().slice(0, 10) : null,
      tags: data.tags || [],
      cover: data.cover,
      coverAlt: data.coverAlt,
      featured: Boolean(data.featured),
      hasVideo: Boolean(data.video),
      minutes: Math.max(1, Math.round(readingTime(content).minutes)),
    };
  })
  .sort((a, b) => b.pubDate.localeCompare(a.pubDate));

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/posts.json', JSON.stringify(posts, null, 2) + '\n');
// Written once per build so the server render and the client bundle always agree on it.
fs.writeFileSync('data/build.json', JSON.stringify({ date: new Date().toISOString().slice(0, 10) }) + '\n');
console.log(`data/posts.json: ${posts.length} posts (${posts.filter((p) => p.featured).length} featured)`);

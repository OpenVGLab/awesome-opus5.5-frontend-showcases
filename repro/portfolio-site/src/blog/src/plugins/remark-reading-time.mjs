import { toString } from 'mdast-util-to-string';
import getReadingTime from 'reading-time';

// Adds `minutesRead` and `words` to every post's frontmatter (read via remarkPluginFrontmatter).
export function remarkReadingTime() {
  return (tree, { data }) => {
    const stats = getReadingTime(toString(tree));
    data.astro.frontmatter.minutesRead = Math.max(1, Math.round(stats.minutes));
    data.astro.frontmatter.words = stats.words;
  };
}

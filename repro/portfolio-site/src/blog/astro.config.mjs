import { defineConfig } from 'astro/config';
import { rehypeCodeBlocks } from './src/plugins/rehype-code-blocks.mjs';
import { remarkCallouts } from './src/plugins/remark-callouts.mjs';
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs';

// Static blog that is merged into the portfolio export under /blog/ (see scripts/postbuild.mjs).
export default defineConfig({
  site: process.env.SITE_URL || 'https://maraellison.dev',
  outDir: '../dist-blog',
  trailingSlash: 'always',
  build: { format: 'directory', assets: '_astro', inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: { light: 'github-light-high-contrast', dark: 'github-dark-dimmed' },
      wrap: false,
    },
    remarkPlugins: [remarkReadingTime, remarkCallouts],
    rehypePlugins: [rehypeCodeBlocks],
  },
  vite: {
    build: { assetsInlineLimit: 0, modulePreload: false },
  },
});

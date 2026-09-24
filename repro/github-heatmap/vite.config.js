import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Sources (including the index.html template and public/examples) live in src/.
// `npm run build` writes the static site to dist/; the index.html, assets/ and
// examples/ next to this file are a copy of that output.
export default defineConfig({
  root: 'src',
  base: './',
  plugins: [vue()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
  },
});

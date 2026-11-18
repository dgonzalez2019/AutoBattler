import { defineConfig } from 'vite';

// `base` is relative so the build works on GitHub Pages under /<repo>/.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});

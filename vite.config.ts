import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The site is published as a GitHub Pages project site
 * (https://tmeta22.github.io/catalive/), so every asset is referenced
 * relative to the document. The app routes with the hash, so the relative
 * base keeps working on any path or domain.
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});

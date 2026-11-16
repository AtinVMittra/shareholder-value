import { defineConfig } from 'vite';

// Relative base so the built site works from any path on any static host.
export default defineConfig({
  base: './',
  server: { port: 5183, strictPort: true },
  build: { chunkSizeWarningLimit: 900 },
});

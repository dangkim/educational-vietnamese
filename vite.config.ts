import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // Listen on all local IP addresses
    port: 5173,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    // Useful for certain environments where the terminal and browser might mismatch
    watch: {
      usePolling: true,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

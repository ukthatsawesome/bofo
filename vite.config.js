const { defineConfig } = require('vite');
const path = require('path');

module.exports = defineConfig({
  root: 'src/renderer',
  base: './', // Makes paths relative (e.g., "assets/icon.png") which works better for Electron file://
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0', // Allow access from local network
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
});

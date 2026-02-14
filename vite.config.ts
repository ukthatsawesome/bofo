import { defineConfig } from 'vite';
import * as path from 'path';
import preact from '@preact/preset-vite';

// ==================== PATH CONSTANTS ====================

const ROOT_DIR = 'src/renderer';
const DIST_DIR = '../../dist/renderer';

// ==================== CONFIG ====================

export default defineConfig({
    plugins: [preact()],

    // Project Structure
    root: ROOT_DIR,

    resolve: {
        alias: {
            // Maps '@' to the renderer source directory
            '@': path.resolve(__dirname, ROOT_DIR),
        },
    },

    build: {
        outDir: DIST_DIR,
        emptyOutDir: true,
        sourcemap: true,
    },

    server: {
        port: 5173,
        strictPort: true,
        host: '0.0.0.0', // Allow access from local network
    },

    // Electron Requirement: Relative paths are required for the file:// protocol
    base: './',
});
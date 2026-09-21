import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { resolve } from 'path';

const WASM_PACKAGES = [
  '@midnight-ntwrk/compact-runtime',
  '@midnightntwrk/onchain-runtime-v4',
  '@verishield/shared',
  '@verishield/contracts',
];

export default defineConfig({
  plugins: [react(), wasm()],
  // Load .env from the repo root (single source of truth for all VITE_ vars).
  envDir: resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    exclude: WASM_PACKAGES,
    // @midnight-ntwrk/compact-runtime (excluded, WASM) does a static default
    // import of the CommonJS 'object-inspect' (dist/error.js). Excluded
    // packages are never scanned, so 'object-inspect' was served as raw CJS
    // with no ESM 'default' export in the browser. Force pre-bundling so the
    // import resolves with proper CJS->ESM interop.
    include: ['object-inspect'],
    esbuildOptions: { target: 'esnext' },
  },
  esbuild: {
    target: 'esnext',
  },
  build: {
    target: 'esnext',
    outDir: resolve(__dirname, '../../dist'),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});

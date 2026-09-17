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
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    exclude: WASM_PACKAGES,
    esbuildOptions: { target: 'esnext' },
  },
  esbuild: {
    target: 'esnext',
  },
  build: {
    target: 'esnext',
  },
  server: {
    port: 3000,
  },
});

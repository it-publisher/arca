import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const page = (name) => resolve(import.meta.dirname, 'web', `${name}.html`);

export default defineConfig({
  root: 'web',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // The polyfill would need an inline script, which our CSP forbids.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { index: page('index'), note: page('note'), login: page('login') },
    },
  },
});

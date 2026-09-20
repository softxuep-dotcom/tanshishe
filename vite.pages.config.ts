import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';

export default defineConfig({
  root: path.resolve('pages'),
  base: '/tanshishe/',
  publicDir: path.resolve('public'),
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: path.resolve('dist/pages'), emptyOutDir: true },
});

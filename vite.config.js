import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`         -> dist/ (index.html + assets) para Vercel, Netlify, GitHub Pages…
// `npm run build:single`  -> dist-single/index.html autocontenido (un solo archivo).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', chunkSizeWarningLimit: 1200 },
  server: { host: '127.0.0.1', port: 5173 }
}));

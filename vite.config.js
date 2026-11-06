import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// `npm run build`         -> dist/ (index.html + assets) para Vercel, Netlify, GitHub Pages…
// `npm run build:single`  -> dist-single/index.html autocontenido (un solo archivo).

// Los resultados de los modelos se sirven tal cual desde modelos/: en desarrollo Vite los entrega
// desde la raíz; en el build se copian los CSV y JSON a dist/modelos/ (los .pkl y .py no).
function servirModelos() {
  return {
    name: 'servir-modelos',
    apply: 'build',
    generateBundle() {
      for (const dir of readdirSync('modelos', { withFileTypes: true }).filter((d) => d.isDirectory())) {
        for (const f of readdirSync(join('modelos', dir.name)).filter((n) => /\.(csv|json)$/i.test(n))) {
          this.emitFile({ type: 'asset', fileName: `modelos/${dir.name}/${f}`, source: readFileSync(join('modelos', dir.name, f)) });
        }
      }
    }
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  // La portada lee los CSV de modelos/ al cargar, así que ambos builds los copian.
  plugins: mode === 'single' ? [viteSingleFile(), servirModelos()] : [servirModelos()],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist', chunkSizeWarningLimit: 1200,
    // El modo de un solo archivo publica solo la portada (index.html); el build normal publica también las otras páginas.
    rollupOptions: mode === 'single' ? {} : { input: { main: 'index.html', pliego: 'pliego.html', globo: 'globo.html', vuelo: 'vuelo.html' } }
  },
  server: { host: '127.0.0.1', port: 5173 }
}));

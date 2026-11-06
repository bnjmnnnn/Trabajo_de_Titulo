// Genera data.js para la composición: polígonos proyectados (como mapa3d.js) + valor 2023 por región.
// Uso: node videos/vuelo-chile/generar-datos.mjs  (desde la raíz del repo)
import { readFileSync, writeFileSync } from 'node:fs';
const geo = JSON.parse(readFileSync('src/data/regiones-chile.json', 'utf8'));
const CODREGEO_A_INE = { 1: 15, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 13, 8: 6, 9: 7, 10: 16, 11: 8, 12: 9, 13: 14, 14: 10, 15: 11, 16: 12 };
const [cab, ...filas] = readFileSync('modelos/conteo_random_forest/predicciones_test_conteo_crecimiento.csv', 'utf8').trim().split(/\r?\n/);
const cols = cab.split(',');
const valor = {};
for (const f of filas) { const r = Object.fromEntries(f.split(',').map((v, i) => [cols[i], v])); valor[CODREGEO_A_INE[r.CODREGEO]] = Number(r.estimation); }
const KX = Math.cos(-36 * Math.PI / 180);
const p = ([lon, lat]) => [+((lon + 71) * KX).toFixed(3), +(lat + 36).toFixed(3)];
// Se descartan anillos diminutos (islas de pocos puntos) para aligerar la escena.
const regiones = geo.regiones.map((r) => ({
  c: r.codigo, v: valor[r.codigo],
  poligonos: r.poligonos.filter((pol) => pol[0].length >= 6).map((pol) => pol.map((a) => a.map(p)))
}));
writeFileSync('videos/vuelo-chile/data.js', `// Generado por generar-datos.mjs — no editar a mano.\nwindow.CHILE = ${JSON.stringify({ anio: 2023, regiones })};\n`);
console.log('regiones', regiones.length, 'bytes', readFileSync('videos/vuelo-chile/data.js').length, valor);

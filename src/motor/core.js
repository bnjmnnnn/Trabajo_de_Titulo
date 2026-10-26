// core.js — utilidades comunes a las tres propuestas: datos, formato, ranking, silueta, serie.
import geo from '../data/regiones-chile.json';
import ejemplo from '../data/ejemplo.json';
import { normalizar, desdeCSV, fuentes, serieDe, CODIGOS, OBSERVADO_ID } from './datos.js';
import { proyectar } from './mapa3d.js';

export { geo, fuentes, serieDe, CODIGOS, OBSERVADO_ID };
export const NOMBRE = Object.fromEntries(geo.regiones.map((r) => [r.codigo, r.nombre]));
// Numeración romana tradicional de las regiones (como se enseña en el colegio).
export const ROMANO = { 15: 'XV', 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 13: 'RM', 6: 'VI', 7: 'VII', 16: 'XVI', 8: 'VIII', 9: 'IX', 14: 'XIV', 10: 'X', 11: 'XI', 12: 'XII' };

/** Si existe datos/predicciones.json junto a la página, se usa; si no, el ejemplo sintético. */
export async function datosIniciales() {
  try {
    const r = await fetch('./datos/predicciones.json', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return { datos: normalizar(await r.json()), esEjemplo: false };
  } catch { /* sin archivo: ejemplo */ }
  return { datos: normalizar(ejemplo), esEjemplo: true };
}

export async function leerArchivos(archivos) {
  const json = archivos.find((f) => /\.json$/i.test(f.name));
  if (json) return normalizar(JSON.parse(await json.text()));
  const textos = await Promise.all(archivos.filter((f) => /\.(csv|txt)$/i.test(f.name)).map(async (f) => ({ f, t: await f.text() })));
  const cab = (t) => t.split(/\r?\n/)[0].toLowerCase();
  const pred = textos.find(({ t }) => cab(t).includes('prediccion'));
  const obs = textos.find(({ t }) => !cab(t).includes('prediccion') && cab(t).includes('valor'));
  if (!pred) throw new Error('falta un CSV con la columna "prediccion"');
  return normalizar(desdeCSV(pred.t, obs?.t, { titulo: pred.f.name.replace(/\.\w+$/, '') }));
}

/** Escala fija para todo el horizonte temporal: así un año se compara con otro. */
export function dominio(datos, fuente) {
  let max = -Infinity, min = Infinity;
  for (const c of CODIGOS) for (const v of serieDe(datos, fuente, c)) if (v) { max = Math.max(max, v.p); min = Math.min(min, v.p); }
  return Number.isFinite(max) ? { min: Math.min(0, min), max: max || 1 } : { min: 0, max: 1 };
}

export const formato = (datos) => (v, unidad = true) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const d = datos.meta.decimales ?? 2;
  return v.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }) + (unidad && datos.meta.unidad ? ` ${datos.meta.unidad}` : '');
};

export function ranking(datos, fuente, i) {
  return CODIGOS.map((c) => ({ c, v: serieDe(datos, fuente, c)[i]?.p ?? null })).sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
}

export const esProyeccion = (datos, i) => datos.observadoHasta != null && datos.periodos[i] > datos.observadoHasta;

/** Ficha de una región en un periodo: lo que muestran los detalles de las tres propuestas. */
export function ficha(datos, fuente, cod, i) {
  const s = serieDe(datos, fuente, cod)[i];
  const obs = fuente === OBSERVADO_ID ? null : datos.observado?.[cod]?.[i] ?? null;
  const rk = ranking(datos, fuente, i);
  return { valor: s?.p ?? null, lo: s?.lo ?? null, hi: s?.hi ?? null, observado: obs?.p ?? null,
    puesto: rk.findIndex((r) => r.c === cod) + 1, total: CODIGOS.length, proyeccion: esProyeccion(datos, i) };
}

/** Silueta SVG de una región (norte arriba), escalada a una caja w×h. */
export function silueta(cod, w, h, pad = 4) {
  const r = geo.regiones.find((x) => x.codigo === cod);
  const pts = r.poligonos.flatMap((p) => p[0]).map(([lon, lat]) => proyectar(lon, lat));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (y1 - y0 || 1));
  const ox = (w - (x1 - x0) * k) / 2, oy = (h - (y1 - y0) * k) / 2;
  return r.poligonos.map((p) => p.map((anillo) => 'M' + anillo.map(([lon, lat]) => {
    const q = proyectar(lon, lat); return `${(ox + (q.x - x0) * k).toFixed(1)},${(oy + (y1 - q.y) * k).toFixed(1)}`;
  }).join('L') + 'Z').join('')).join('');
}

/** Serie mínima en SVG: la fuente activa fuerte, el observado en puntos, el año actual marcado. */
export function serieSVG(datos, fuente, cod, i, { w = 260, h = 64, clase = 'serie' } = {}) {
  const s = serieDe(datos, fuente, cod), o = fuente === OBSERVADO_ID ? [] : datos.observado?.[cod] ?? [];
  const vals = [...s, ...o].filter(Boolean).map((v) => v.p);
  if (!vals.length) return '';
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
  const n = datos.periodos.length;
  const X = (k) => 2 + (k / Math.max(1, n - 1)) * (w - 4), Y = (v) => 4 + (1 - (v - lo) / (hi - lo)) * (h - 8);
  const linea = s.map((v, k) => (v ? `${X(k).toFixed(1)},${Y(v.p).toFixed(1)}` : null)).filter(Boolean).join(' ');
  const iCorte = datos.observadoHasta != null ? datos.periodos.findIndex((p) => p > datos.observadoHasta) : -1;
  const corte = iCorte > 0 ? `<line class="corte" x1="${(X(iCorte - 1) + X(iCorte)) / 2}" x2="${(X(iCorte - 1) + X(iCorte)) / 2}" y1="0" y2="${h}"/>` : '';
  const puntos = o.map((v, k) => (v ? `<circle class="obs" cx="${X(k).toFixed(1)}" cy="${Y(v.p).toFixed(1)}" r="1.8"/>` : '')).join('');
  const ahora = s[i] ? `<circle class="ahora" cx="${X(i)}" cy="${Y(s[i].p)}" r="3.2"/>` : '';
  return `<svg class="${clase}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${corte}<polyline points="${linea}"/>${puntos}${ahora}</svg>`;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mezclar(stops, t) {
  t = Math.min(1, Math.max(0, t));
  const x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  const a = parseInt(stops[i].slice(1), 16), b = parseInt(stops[i + 1].slice(1), 16);
  return '#' + [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f).toString(16).padStart(2, '0')).join('');
}

/** Teclado común: ← → cambian el año, Esc cierra el detalle. */
export function teclado({ anterior, siguiente, cerrar }) {
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input,select,textarea')) return;
    if (e.key === 'ArrowLeft') anterior(); else if (e.key === 'ArrowRight') siguiente(); else if (e.key === 'Escape') cerrar();
  });
}

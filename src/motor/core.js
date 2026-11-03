// core.js — utilidades del mapa: datos, vista por modelo, formato, ranking, silueta.
import geo from '../data/regiones-chile.json';
import tt1 from '../data/tt1.json';
import { normalizar, desdeCSV, fuentes, serieDe, CODIGOS, OBSERVADO_ID } from './datos.js';
import { proyectar } from './mapa3d.js';

export { geo, fuentes, serieDe, CODIGOS, OBSERVADO_ID };
export const NOMBRE = Object.fromEntries(geo.regiones.map((r) => [r.codigo, r.nombre]));
// Numeración romana tradicional de las regiones (como se enseña en el colegio).
export const ROMANO = { 15: 'XV', 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 13: 'RM', 6: 'VI', 7: 'VII', 16: 'XVI', 8: 'VIII', 9: 'IX', 14: 'XIV', 10: 'X', 11: 'XI', 12: 'XII' };

/** Si existe datos/predicciones.json junto a la página, se usa; si no, los valores de TT1 incrustados. */
export async function datosIniciales() {
  try {
    const r = await fetch('./datos/predicciones.json', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return { datos: normalizar(await r.json()), esEjemplo: false };
  } catch { /* sin archivo: datos de TT1 */ }
  return { datos: normalizar(tt1), esEjemplo: false };
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

/**
 * La vista de un modelo: los datos con su propia unidad, registro y escala encima de los globales.
 * Todo lo que sigue recibe una vista, no los datos crudos.
 */
export function vista(datos, fuente) {
  const m = datos.modelos.find((x) => x.id === fuente);
  if (!m) return { ...datos, fuente, escala: 'secuencial' };
  return { ...datos, fuente, meta: { ...datos.meta, ...(m.meta ?? {}) }, escala: m.escala,
    observado: m.observado ?? datos.observado, observadoHasta: m.observadoHasta ?? datos.observadoHasta };
}

/**
 * Lo que pinta el mapa por año: la predicción del modelo y, en los años sin predicción, el registro.
 * origen: 'proyeccion' (después del último registro) | 'prueba' (predicción con registro) | 'registro'.
 */
export function serieMapa(v, cod) {
  const s = serieDe(v, v.fuente, cod), o = v.fuente === OBSERVADO_ID ? [] : v.observado?.[cod] ?? [];
  return v.periodos.map((p, i) => {
    if (s[i]) return { ...s[i], origen: v.fuente === OBSERVADO_ID ? 'registro' : esProyeccion(v, i) ? 'proyeccion' : 'prueba' };
    return o[i] ? { ...o[i], origen: 'registro' } : null;
  });
}

/** Origen de un año en la vista (el de cualquier región con dato), o null si ninguna tiene dato. */
export const origenAnio = (v, i) => CODIGOS.map((c) => serieMapa(v, c)[i]).find(Boolean)?.origen ?? null;

/** Escala fija para todo el horizonte temporal: así un año se compara con otro. Divergente: simétrica en 0. */
export function dominio(v) {
  let max = -Infinity, min = Infinity;
  for (const c of CODIGOS) for (const x of serieMapa(v, c)) if (x) { max = Math.max(max, x.p); min = Math.min(min, x.p); }
  if (!Number.isFinite(max)) return { min: 0, max: 1 };
  if (v.escala === 'divergente') { const m = Math.max(Math.abs(min), Math.abs(max)) || 1; return { min: -m, max: m }; }
  return { min: Math.min(0, min), max: max || 1 };
}

export const formato = (v) => (x, unidad = true) => {
  if (x == null || !Number.isFinite(x)) return '—';
  const d = v.meta.decimales ?? 2;
  return x.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d, signDisplay: v.escala === 'divergente' ? 'exceptZero' : 'auto' })
    + (unidad && v.meta.unidad ? ` ${v.meta.unidad}` : '');
};

export function ranking(v, i) {
  return CODIGOS.map((c) => ({ c, v: serieMapa(v, c)[i]?.p ?? null })).sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
}

export const esProyeccion = (datos, i) => datos.observadoHasta != null && datos.periodos[i] > datos.observadoHasta;

/** Ficha de una región en un periodo: lo que muestra el extendido. */
export function ficha(v, cod, i) {
  const s = serieMapa(v, cod)[i];
  const obs = v.fuente === OBSERVADO_ID ? null : v.observado?.[cod]?.[i] ?? null;
  const rk = ranking(v, i);
  return { valor: s?.p ?? null, lo: s?.lo ?? null, hi: s?.hi ?? null, origen: s?.origen ?? null,
    observado: s?.origen === 'registro' ? null : obs?.p ?? null,
    puesto: rk.findIndex((r) => r.c === cod) + 1, total: CODIGOS.length, proyeccion: esProyeccion(v, i) };
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

// datos.js — carga, validación y consultas sobre las predicciones.
// Formato (ver README): { meta, periodos, observadoHasta, modelos:[{id,nombre,valores,metricas}], observado }
// valores[codigoRegion][iPeriodo] = [prediccion] | [prediccion, limInf, limSup] | null

export const CODIGOS = [15, 1, 2, 3, 4, 5, 13, 6, 7, 16, 8, 9, 14, 10, 11, 12];
export const OBSERVADO_ID = '__observado';

/** Valida y normaliza un objeto de predicciones. Lanza Error con mensaje legible. */
export function normalizar(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('El archivo no contiene un objeto JSON.');
  const periodos = raw.periodos;
  if (!Array.isArray(periodos) || !periodos.length) throw new Error('Falta "periodos" (lista de años/periodos).');
  if (!Array.isArray(raw.modelos) || !raw.modelos.length) throw new Error('Falta "modelos" (al menos uno).');
  const n = periodos.length;
  const serie = (s, quien, cod) => {
    if (s == null) return new Array(n).fill(null);
    if (!Array.isArray(s) || s.length !== n)
      throw new Error(`${quien}, región ${cod}: se esperaban ${n} valores (uno por periodo).`);
    return s.map((v) => {
      if (v == null) return null;
      const arr = Array.isArray(v) ? v : [v];
      const nums = arr.map(Number);
      if (nums.some((x) => !Number.isFinite(x))) return null;
      return nums.length >= 3 ? { p: nums[0], lo: Math.min(nums[1], nums[2]), hi: Math.max(nums[1], nums[2]) } : { p: nums[0] };
    });
  };
  const modelos = raw.modelos.map((m, i) => {
    const nombre = String(m.nombre ?? m.id ?? `Modelo ${i + 1}`);
    const valores = {};
    for (const c of CODIGOS) valores[c] = serie(m.valores?.[c] ?? m.valores?.[String(c)], nombre, c);
    return { id: String(m.id ?? nombre), nombre, valores, metricas: m.metricas ?? null, metricasOrigen: m.metricasOrigen ?? null };
  });
  const observado = {};
  let hayObs = false;
  for (const c of CODIGOS) {
    const s = raw.observado?.[c] ?? raw.observado?.[String(c)];
    observado[c] = serie(s == null ? null : s.map((v) => (v == null ? null : [v].flat()[0])), 'Observado', c);
    if (observado[c].some(Boolean)) hayObs = true;
  }
  const meta = { titulo: 'Predicciones por región', variable: 'Valor', unidad: '', decimales: 2, nota: '', ...(raw.meta ?? {}) };
  return { meta, periodos, observadoHasta: raw.observadoHasta ?? null, modelos, observado: hayObs ? observado : null };
}

/** Serie (por periodo) de una "fuente": un modelo o el observado. */
export function serieDe(datos, fuenteId, codigo) {
  if (fuenteId === OBSERVADO_ID) return datos.observado?.[codigo] ?? [];
  return datos.modelos.find((m) => m.id === fuenteId)?.valores[codigo] ?? [];
}

export function fuentes(datos) {
  const f = datos.modelos.map((m) => ({ id: m.id, nombre: m.nombre }));
  if (datos.observado) f.push({ id: OBSERVADO_ID, nombre: 'Observado (real)' });
  return f;
}

/**
 * Valor que muestra el mapa para una región, según el modo.
 *  - valor:   predicción de la fuente A
 *  - comparar: A − B
 *  - error:   A − observado
 * Devuelve null si falta algún dato.
 */
export function valorModo(datos, estado, codigo, i = estado.iPeriodo) {
  const a = serieDe(datos, estado.fuenteA, codigo)[i];
  if (!a) return null;
  if (estado.modo === 'valor') return a.p;
  const b = estado.modo === 'comparar' ? serieDe(datos, estado.fuenteB, codigo)[i] : datos.observado?.[codigo]?.[i];
  return b ? a.p - b.p : null;
}

/** Dominio estable para TODO el horizonte temporal (así la altura es comparable entre años). */
export function dominio(datos, estado) {
  let min = Infinity, max = -Infinity;
  for (const c of CODIGOS) for (let i = 0; i < datos.periodos.length; i++) {
    const v = valorModo(datos, estado, c, i);
    if (v == null) continue;
    let hi = v;
    if (estado.modo === 'valor') hi = serieDe(datos, estado.fuenteA, c)[i]?.hi ?? v;
    min = Math.min(min, v); max = Math.max(max, hi);
  }
  if (!Number.isFinite(min)) return { min: 0, max: 1 };
  if (estado.modo !== 'valor') { const m = Math.max(Math.abs(min), Math.abs(max)) || 1; return { min: -m, max: m }; }
  return { min: Math.min(0, min), max: max || 1 };
}

// ---------- CSV en el navegador (mismo formato que scripts/exportar_predicciones.py) ----------
function parseCSV(texto) {
  const filas = [];
  let fila = [], campo = '', comillas = false;
  const sep = (texto.split('\n')[0].match(/;/g)?.length ?? 0) > (texto.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') comillas = false; else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((x) => x.trim() !== '')) filas.push(fila);
      fila = [];
    } else campo += ch;
  }
  fila.push(campo); if (fila.some((x) => x.trim() !== '')) filas.push(fila);
  const cab = filas.shift().map((h) => h.replace(/^﻿/, '').trim().toLowerCase());
  return filas.map((f) => Object.fromEntries(cab.map((h, j) => [h, (f[j] ?? '').trim()])));
}
const num = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : null; };

/** Construye el JSON a partir de un CSV de predicciones y (opcional) uno de observados. */
export function desdeCSV(textoPred, textoObs, meta = {}) {
  const pred = parseCSV(textoPred);
  const req = ['modelo', 'codigo_region', 'periodo', 'prediccion'];
  const falta = req.filter((k) => !(k in (pred[0] ?? {})));
  if (falta.length) throw new Error(`El CSV de predicciones necesita las columnas: ${req.join(', ')}. Faltan: ${falta.join(', ')}.`);
  const obs = textoObs ? parseCSV(textoObs) : [];
  const periodos = [...new Set([...pred, ...obs].map((r) => Math.round(num(r.periodo))))].filter(Number.isFinite).sort((a, b) => a - b);
  const ip = new Map(periodos.map((p, i) => [p, i]));
  const vacio = () => Object.fromEntries(CODIGOS.map((c) => [c, new Array(periodos.length).fill(null)]));
  const modelos = new Map();
  for (const r of pred) {
    const c = Math.round(num(r.codigo_region));
    if (!CODIGOS.includes(c)) throw new Error(`codigo_region desconocido: "${r.codigo_region}" (usa 1–16).`);
    if (!modelos.has(r.modelo)) modelos.set(r.modelo, { id: r.modelo, nombre: r.modelo, valores: vacio() });
    const p = num(r.prediccion), lo = num(r.lim_inf), hi = num(r.lim_sup);
    modelos.get(r.modelo).valores[c][ip.get(Math.round(num(r.periodo)))] = p == null ? null : lo == null || hi == null ? [p] : [p, lo, hi];
  }
  const observado = vacio();
  for (const r of obs) {
    const c = Math.round(num(r.codigo_region));
    if (CODIGOS.includes(c)) observado[c][ip.get(Math.round(num(r.periodo)))] = num(r.valor);
  }
  let observadoHasta = null;
  for (const c of CODIGOS) observado[c].forEach((v, i) => { if (v != null) observadoHasta = Math.max(observadoHasta ?? -Infinity, periodos[i]); });
  for (const m of modelos.values()) {
    const e = [];
    for (const c of CODIGOS) m.valores[c].forEach((v, i) => { const o = observado[c][i]; if (v && o != null) e.push([v[0], o]); });
    if (e.length) {
      const d = e.map(([p, o]) => p - o);
      const conO = e.filter(([, o]) => o);
      m.metricas = { MAE: d.reduce((s, x) => s + Math.abs(x), 0) / d.length,
        RMSE: Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length),
        'MAPE %': (100 * conO.reduce((s, [p, o]) => s + Math.abs(p - o) / Math.abs(o), 0)) / Math.max(1, conO.length), n: d.length };
      m.metricasOrigen = 'calculadas contra observado';
    }
  }
  return { version: 1, meta: { titulo: 'Predicciones por región', variable: 'Valor', unidad: '', decimales: 2, ...meta },
    periodos, observadoHasta, modelos: [...modelos.values()], observado: obs.length ? observado : null };
}

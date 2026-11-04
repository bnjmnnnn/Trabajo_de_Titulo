// datos.js — lee los resultados directamente de la carpeta modelos/ (CSV de cada modelo).
// Nada se inventa aquí: cada cifra sale de un archivo de modelos/ o de una cuenta sobre ellos.

// CODREGEO de TT1 (norte a sur, 1 = Arica … 7 = RM … 16 = Magallanes) → código INE del mapa.
const CODREGEO_A_INE = { 1: 15, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 13, 8: 6, 9: 7, 10: 16, 11: 8, 12: 9, 13: 14, 14: 10, 15: 11, 16: 12 };

const RUTAS = {
  conteoPrueba: 'modelos/conteo_random_forest/predicciones_test_conteo_crecimiento.csv',
  conteoProy: 'modelos/conteo_random_forest/proyeccion_modelo_2024_2028.csv',
  conteoMet: 'modelos/conteo_random_forest/metricas_conteo_crecimiento.csv',
  gbPred: 'modelos/modelo_4_gradient_boosting/predicciones_gb.csv',
  gbMet: 'modelos/modelo_4_gradient_boosting/metricas_modelo4.csv'
};
export const ARCHIVOS = RUTAS;

function csv(texto) {
  const [cab, ...filas] = texto.trim().split(/\r?\n/);
  const cols = cab.split(',');
  return filas.filter(Boolean).map((f) => Object.fromEntries(f.split(',').map((v, i) => [cols[i], v])));
}
async function leer(ruta) {
  const r = await fetch(new URL(ruta, document.baseURI), { cache: 'no-store' });
  if (!r.ok) throw new Error(`no se encontró ${ruta} (HTTP ${r.status})`);
  return csv(await r.text());
}
const ine = (f) => CODREGEO_A_INE[Number(f.CODREGEO)];

/**
 * Devuelve los dos modelos con la misma forma:
 * { id, nombre, unidad, escala, anios: [{anio, origen, valores: Map(ine → {v, obs?})}], skill: {anio: s} }
 */
export async function cargarModelos() {
  const [cp, cy, cm, gp, gm] = await Promise.all(Object.values(RUTAS).map(leer));

  // ---- Conteo · Random Forest (personas) ----
  const registro2022 = new Map(cp.map((f) => [ine(f), { v: Number(f.estimation_lag1) }]));
  const prueba2023 = new Map(cp.map((f) => [ine(f), { v: Number(f.pred_random_forest_conteo), obs: Number(f.estimation) }]));
  const proy = {};
  for (const f of cy) (proy[f.ANIO] ??= new Map()).set(ine(f), { v: Number(f.estimacion_proyectada) });
  // Skill de Murphy: 1 − MSE del modelo / MSE de repetir el año anterior (persistencia), en el test 2023.
  const rf = cm.find((f) => f.modelo === 'random_forest_conteo' && f.split === 'test');
  const msePers = cp.reduce((s, f) => s + (Number(f.estimation) - Number(f.estimation_lag1)) ** 2, 0) / cp.length;
  const conteo = {
    id: 'conteo', nombre: 'Conteo', algoritmo: 'Random Forest',
    pregunta: '¿Cuántas personas inmigrantes hay en cada región?',
    unidad: 'personas', decimales: 0, escala: 'secuencial',
    anios: [
      { anio: 2022, origen: 'registro', valores: registro2022 },
      { anio: 2023, origen: 'prueba', valores: prueba2023 },
      ...Object.keys(proy).sort().map((a) => ({ anio: Number(a), origen: 'proyeccion', valores: proy[a] }))
    ],
    skill: { 2023: 1 - Number(rf.rmse) ** 2 / msePers },
    r2: { 2023: Number(rf.r2) }, rmse: { 2023: Number(rf.rmse) }
  };

  // ---- Redistribución · Gradient Boosting (puntos porcentuales de participación) ----
  const gbAnios = {};
  for (const f of gp) (gbAnios[f.ANIO] ??= new Map()).set(ine(f), { v: 100 * Number(f.predicho), obs: 100 * Number(f.redistribucion) });
  const skillGb = {}, rmseGb = {};
  for (const f of gm) if (f.pregunta === 'redistribucion' && f.conjunto === 'seleccionadas' && f.modelo === 'gradient_boosting') {
    skillGb[f.anio_test] = Number(f.skill); rmseGb[f.anio_test] = 100 * Number(f.rmse);
  }
  const distribucion = {
    id: 'distribucion', nombre: 'Distribución', algoritmo: 'Gradient Boosting',
    pregunta: '¿Qué regiones ganan o pierden parte del total nacional?',
    unidad: 'pp', decimales: 2, escala: 'divergente',
    anios: Object.keys(gbAnios).sort().map((a) => ({ anio: Number(a), origen: 'prueba', valores: gbAnios[a] })),
    skill: skillGb, rmse: rmseGb
  };

  // Comparación de algoritmos (para la sección de evidencia)
  const compGb = gm.filter((f) => f.pregunta === 'redistribucion' && f.conjunto === 'seleccionadas' && f.anio_test === '2023')
    .map((f) => ({ modelo: f.modelo, skill: Number(f.skill) }));
  const pers = gm.find((f) => f.pregunta === 'redistribucion' && f.anio_test === '2023' && f.modelo === '-');
  const compConteo = cm.filter((f) => f.split === 'test').map((f) => ({ modelo: f.modelo.replace('_conteo', ''), skill: 1 - Number(f.rmse) ** 2 / msePers }));

  return { modelos: [conteo, distribucion], comparacion: { conteo: compConteo, distribucion: compGb, persistencia: pers ? Number(pers.skill) : 0 } };
}

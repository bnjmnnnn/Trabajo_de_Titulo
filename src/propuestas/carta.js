/* PROPUESTA 3 — CARTA
THESIS: una hoja topográfica: el valor se lee como altitud con tintas hipsométricas y curvas de nivel en las paredes de cada región; rechaza la barra de color genérica y los paneles flotantes.
OWN-WORLD: hoja blanca con marco de coordenadas (neatline) y marginalia; mar celeste con retícula; tierra en tintas hipsométricas; cuadro de título abajo a la derecha; escala gráfica de segmentos blanco/negro que es la línea de tiempo.
STORY: el visitante reconoce un mapa "oficial", lee qué regiones están más altas, recorre los años en la escala y toca una región para ver su cuadro de datos.
FIRST VIEWPORT: hoja a toda pantalla, Chile vertical a la izquierda del centro, cuadro de título con leyenda y escala en el margen derecho.
FORM: carta topográfica, 3 de 7 de la lista propia, seed e728d33b. */
import './carta.css';
import { crearMapa } from '../motor/mapa3d.js';
import { geo, NOMBRE, ROMANO, OBSERVADO_ID, CODIGOS, fuentes, serieDe, datosIniciales, leerArchivos, dominio, formato, ficha, serieSVG, esc, teclado } from '../motor/core.js';

const TINTAS = ['#bcd7b4', '#dfe3ad', '#e7cf92', '#d9a873', '#b97a53', '#8c5640'];
const BANDAS = 6;

export async function iniciar(raiz) {
  raiz.innerHTML = `
  <main class="ct">
    <div class="hoja">
      <div class="marco">
        <div class="carta-lienzo"><canvas aria-hidden="true"></canvas><div class="capa-etq"></div></div>
        <div class="tip" hidden></div>
      </div>
      <p class="margen m-arriba">República de Chile · Carta de predicciones por región</p>
      <p class="margen m-abajo">Proyección equirectangular · altura exagerada, no representa distancia · <span class="ct-fuente"></span></p>
      <section class="rotulo" aria-label="Cuadro de título">
        <h1>Carta de Chile</h1>
        <p class="ct-var"></p>
        <label class="ct-campo"><span>Levantamiento</span><select class="ct-modelo" aria-label="Modelo"></select></label>
        <div class="ct-leyenda" aria-label="Tintas hipsométricas"><p class="ct-sub">Tintas</p><ol></ol></div>
        <div class="ct-escala"><p class="ct-sub">Edición <output class="ct-anio" aria-live="polite"></output></p>
          <div class="segmentos" role="radiogroup" aria-label="Año"></div>
          <p class="seg-leyenda"><i class="o"></i>con registro <i class="p"></i>proyectado</p>
        </div>
        <p class="ct-pie"><span class="ct-ej"></span><button type="button" class="ct-cargar">Cargar datos</button></p>
      </section>
      <aside class="cuadro" hidden aria-live="polite">
        <button type="button" class="cu-cerrar" aria-label="Cerrar">×</button>
        <p class="cu-num"></p>
        <h2 class="cu-nombre"></h2>
        <p class="cu-valor"></p>
        <dl class="cu-datos"></dl>
        <figure class="cu-perfil"><div></div><figcaption></figcaption></figure>
      </aside>
    </div>
    <input type="file" class="sr ct-archivo" accept=".json,.csv,.txt" multiple tabindex="-1" />
    <p class="aviso" role="status" hidden></p>
  </main>`;
  const $ = (s) => raiz.querySelector(s);
  let { datos, esEjemplo } = await datosIniciales();
  const est = { fuente: datos.modelos[0].id, i: 0, sel: null };

  const mapa = crearMapa({
    canvas: $('canvas'), capaEtiquetas: $('.capa-etq'), geo,
    tema: { material: 'terrazas', tinta: '#4a3326', rampa: TINTAS, suelo: '#d6e6ec', sueloVisible: true,
      reticula: { visible: true, meridianos: true, etiquetas: true, color: '#7fa6b8', opacidad: 0.55 },
      borde: { color: '#3d2c22', opacidad: 0.55 }, orientacion: 'vertical', escalaAltura: 5,
      inclinacion: { horizontal: [0.72, 0.69], vertical: [0.8, 0.6] } },
    alSeleccionar: (c) => seleccionar(c),
    alHover: (c, pos) => tip(c, pos)
  });

  function margen() {
    const movil = innerWidth <= 720;
    const m = $('.marco').getBoundingClientRect(), r = $('.rotulo').getBoundingClientRect();
    mapa.setMargen(movil ? { izq: 0, der: 0, arr: 8, aba: 8 } : { izq: 0, der: Math.max(0, m.right - r.left) + 16, arr: 8, aba: 8 });
  }

  function todo(ms) {
    const f = formato(datos), dom = dominio(datos, est.fuente);
    const m = new Map();
    for (const c of CODIGOS) {
      const v = serieDe(datos, est.fuente, c)[est.i];
      m.set(c, v ? { t: (v.p - dom.min) / (dom.max - dom.min || 1) } : null);
    }
    mapa.actualizar(m, { ms });
    $('.ct-modelo').innerHTML = fuentes(datos).map((x) => `<option value="${esc(x.id)}" ${x.id === est.fuente ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('');
    // Leyenda: cada banda de tinta con su rango de valores (escala fija para toda la serie).
    const paso = (dom.max - dom.min) / BANDAS;
    $('.ct-leyenda ol').innerHTML = TINTAS.map((t, k) => `<li style="--t:${t}"><span>${f(dom.min + paso * k, false)}</span>${k === BANDAS - 1 ? `<span class="max">${f(dom.max, false)}</span>` : ''}</li>`).join('');
    // Escala gráfica = línea de tiempo
    $('.segmentos').innerHTML = datos.periodos.map((p, k) => {
      const proy = datos.observadoHasta != null && p > datos.observadoHasta;
      return `<button type="button" role="radio" aria-checked="${k === est.i}" aria-label="${p}" data-k="${k}" class="${proy ? 'p' : 'o'} ${k % 2 ? 'impar' : ''}"><span>${k === 0 || k === datos.periodos.length - 1 || k === est.i ? p : ''}</span></button>`;
    }).join('');
    $('.ct-anio').textContent = datos.periodos[est.i];
    $('.ct-var').textContent = `${datos.meta.variable}${datos.meta.unidad ? ` (${datos.meta.unidad})` : ''} · altura y tinta según el valor`;
    $('.ct-ej').textContent = esEjemplo ? 'Datos de ejemplo, no reales.' : '';
    $('.ct-fuente').textContent = 'Límites: BCN, simplificados';
    if (est.sel) cuadro();
  }
  $('.ct-modelo').addEventListener('change', (e) => { est.fuente = e.target.value; todo(); });
  $('.segmentos').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { est.i = Number(b.dataset.k); todo(); } });

  function seleccionar(c) {
    est.sel = c; mapa.setSeleccion(c); $('.cuadro').hidden = !c;
    if (c) { mapa.enfocarRegion(c); cuadro(); } else mapa.vista('general');
  }
  function cuadro() {
    const f = formato(datos), c = est.sel, d = ficha(datos, est.fuente, c, est.i);
    $('.cu-num').textContent = `Región ${ROMANO[c]}`;
    $('.cu-nombre').textContent = NOMBRE[c];
    $('.cu-valor').innerHTML = d.valor == null ? 'Sin dato' : `${esc(f(d.valor, false))}<small>${esc(datos.meta.unidad ?? '')}</small>`;
    const filas = [
      ['Edición', `${datos.periodos[est.i]}${d.proyeccion ? ' (proyectada)' : ''}`],
      d.observado != null && ['Registro', f(d.observado)],
      d.lo != null && ['Intervalo', `${f(d.lo, false)}–${f(d.hi, false)}`],
      d.valor != null && ['Orden', `${d.puesto} de ${d.total}`]
    ].filter(Boolean);
    $('.cu-datos').innerHTML = filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    $('.cu-perfil div').innerHTML = serieSVG(datos, est.fuente, c, est.i, { w: 240, h: 56, clase: 'perfil' });
    $('.cu-perfil figcaption').textContent = `Perfil ${datos.periodos[0]}–${datos.periodos.at(-1)}${est.fuente !== OBSERVADO_ID && datos.observado ? ' · puntos: registro' : ''}`;
  }
  $('.cu-cerrar').addEventListener('click', () => seleccionar(null));

  function tip(c, pos) {
    const el = $('.tip');
    if (!c || !pos) { el.hidden = true; return; }
    const v = serieDe(datos, est.fuente, c)[est.i];
    el.innerHTML = `<b>${esc(NOMBRE[c])}</b> ${esc(formato(datos)(v?.p))}`;
    const b = $('.marco').getBoundingClientRect();
    el.style.transform = `translate(${pos.x - b.left + 14}px, ${pos.y - b.top - 32}px)`;
    el.hidden = false;
  }

  const mover = (dx) => { const n = Math.min(datos.periodos.length - 1, Math.max(0, est.i + dx)); if (n !== est.i) { est.i = n; todo(); } };
  teclado({ anterior: () => mover(-1), siguiente: () => mover(1), cerrar: () => est.sel && seleccionar(null) });

  $('.ct-cargar').addEventListener('click', () => $('.ct-archivo').click());
  $('.ct-archivo').addEventListener('change', async (e) => {
    try { datos = await leerArchivos([...e.target.files]); esEjemplo = false; arrancar(); aviso('Datos cargados.'); }
    catch (err) { aviso(`No se pudieron leer los datos: ${err.message}.`); }
    e.target.value = '';
  });
  function aviso(t) { const a = $('.aviso'); a.textContent = t; a.hidden = false; clearTimeout(aviso.k); aviso.k = setTimeout(() => (a.hidden = true), 4200); }

  function arrancar() {
    est.fuente = datos.modelos[0].id;
    const iObs = datos.observadoHasta != null ? datos.periodos.indexOf(datos.observadoHasta) : -1;
    est.i = iObs >= 0 ? iObs : 0;
    seleccionar(null); todo(900);
  }
  addEventListener('resize', () => { margen(); mapa.vista('general', 0); });
  arrancar(); margen(); mapa.vista('general', 0);
}

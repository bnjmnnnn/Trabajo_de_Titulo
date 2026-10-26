/* PROPUESTA 1 — EMISIÓN CHILE
THESIS: Chile como estampilla grabada; rechaza el mapa-dashboard oscuro con brillos y paneles.
OWN-WORLD: página negra de clasificador filatélico; estampilla de papel blanco con borde perforado; una tinta por "emisión" (modelo); tramado de líneas cuya densidad es el valor; matasellos circular.
STORY: el visitante ve el país entero elevado por los datos, cambia de emisión (modelo) y de año con el matasellos, y toca una región para ver su estampilla con el valor como denominación.
FIRST VIEWPORT: estampilla a casi toda pantalla, Chile horizontal adentro; "CHILE" grabado arriba a la izquierda; emisiones arriba a la derecha; matasellos abajo a la derecha montado sobre el borde.
FORM: dirección 5 de 7 (estampillas), seed e728d33b, sorteo degradado sin desafiantes. */
import './emision.css';
import { crearMapa } from '../motor/mapa3d.js';
import { geo, NOMBRE, ROMANO, OBSERVADO_ID, CODIGOS, fuentes, serieDe, datosIniciales, leerArchivos, dominio, formato, ficha, silueta, esc, teclado } from '../motor/core.js';

const TINTAS = ['#b0243a', '#24408f', '#1d6a49', '#7a3f8c', '#8a5a14'];
const TINTA_OBS = '#3b3330';
const PAPEL = '#f3f2ee';

export async function iniciar(raiz) {
  raiz.innerHTML = `
  <main class="em">
    <section class="sello" aria-label="Mapa de Chile">
      <div class="sello-papel">
        <div class="lienzo"><canvas aria-hidden="true"></canvas><div class="capa-etq"></div></div>
        <div class="filete" aria-hidden="true"></div>
        <header class="em-titulo">
          <h1>Chile</h1>
          <p class="em-variable"></p>
        </header>
        <div class="em-emisiones" role="radiogroup" aria-label="Emisión (modelo)"></div>
        <p class="em-pie"><span class="em-serie"></span><button type="button" class="em-cargar">Cargar datos</button></p>
        <div class="tip" hidden></div>
      </div>
    </section>
    <div class="matasellos" role="group" aria-label="Año">
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <defs><path id="anillo" d="M110,110 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0"/></defs>
        <g class="ondas">${[0, 1, 2, 3, 4, 5].map((k) => `<path d="M-260,${70 + k * 16} q20,-9 40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0" />`).join('')}</g>
        <circle cx="110" cy="110" r="100" class="aro"/>
        <circle cx="110" cy="110" r="64" class="aro fino"/>
        <text class="anillo-txt"><textPath href="#anillo" startOffset="50%" text-anchor="middle"></textPath></text>
      </svg>
      <button type="button" class="ms-prev" aria-label="Año anterior">‹</button>
      <output class="ms-anio" aria-live="polite"></output>
      <button type="button" class="ms-next" aria-label="Año siguiente">›</button>
    </div>
    <aside class="ficha" hidden aria-live="polite">
      <div class="ficha-papel">
        <button type="button" class="ficha-cerrar" aria-label="Cerrar">×</button>
        <p class="ficha-num"></p>
        <svg class="ficha-silueta" viewBox="0 0 150 150" aria-hidden="true"></svg>
        <h2 class="ficha-nombre"></h2>
        <p class="ficha-valor"></p>
        <dl class="ficha-datos"></dl>
      </div>
    </aside>
    <input type="file" class="sr em-archivo" accept=".json,.csv,.txt" multiple tabindex="-1" />
    <p class="aviso" role="status" hidden></p>
  </main>`;
  const $ = (s) => raiz.querySelector(s);
  let { datos, esEjemplo } = await datosIniciales();
  const est = { fuente: datos.modelos[0].id, i: 0, sel: null };
  const tinta = (id) => id === OBSERVADO_ID ? TINTA_OBS : TINTAS[Math.max(0, datos.modelos.findIndex((m) => m.id === id)) % TINTAS.length];

  const mapa = crearMapa({
    canvas: $('canvas'), capaEtiquetas: $('.capa-etq'), geo,
    tema: { material: 'grabado', papel: PAPEL, tinta: TINTAS[0], borde: { color: '#1e1b1a', opacidad: 0.7 }, orientacion: 'auto', frecuencia: 6.5,
      inclinacion: { horizontal: [0.7, 0.71], vertical: [0.92, 0.4] } },
    alSeleccionar: (c) => seleccionar(c),
    alHover: (c, pos) => tip(c, pos)
  });

  function margen() {
    const b = $('.sello-papel').getBoundingClientRect();
    const t = $('.em-titulo').getBoundingClientRect(), p = $('.em-pie').getBoundingClientRect();
    const e = $('.em-emisiones').getBoundingClientRect();
    mapa.setMargen(innerWidth > 720 ? { izq: 0, der: 0, arr: t.bottom - b.top, aba: b.bottom - p.top } : { izq: 0, der: 0, arr: e.bottom - b.top + 6, aba: b.bottom - p.top + 150 });
  }

  function pintarEmisiones() {
    $('.em-emisiones').innerHTML = '<span class="em-etq">Emisión</span>' + fuentes(datos).map((f) =>
      `<button type="button" role="radio" aria-checked="${f.id === est.fuente}" data-id="${esc(f.id)}" style="--t:${tinta(f.id)}"><i></i>${esc(f.nombre)}</button>`).join('');
  }
  $('.em-emisiones').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { est.fuente = b.dataset.id; todo(); } });

  function todo(ms) {
    const f = formato(datos);
    const t = tinta(est.fuente);
    raiz.querySelector('.em').style.setProperty('--tinta', t);
    const dom = dominio(datos, est.fuente);
    const m = new Map();
    for (const c of CODIGOS) {
      const v = serieDe(datos, est.fuente, c)[est.i];
      m.set(c, v ? { t: (v.p - dom.min) / (dom.max - dom.min || 1) } : null);
    }
    mapa.actualizar(m, { ms });
    mapa.setTinta(t); // el tramado se imprime con la tinta de la emisión
    pintarEmisiones();
    const anio = datos.periodos[est.i];
    const proy = datos.observadoHasta != null && anio > datos.observadoHasta;
    $('.ms-anio').textContent = anio;
    $('.anillo-txt textPath').textContent = `${proy ? 'PROYECCIÓN' : 'OBSERVADO'} · ${anio} · ${proy ? 'PROYECCIÓN' : 'OBSERVADO'}`;
    $('.matasellos').classList.toggle('proy', proy);
    $('.ms-prev').disabled = est.i === 0;
    $('.ms-next').disabled = est.i === datos.periodos.length - 1;
    $('.em-variable').textContent = `${datos.meta.variable}${datos.meta.unidad ? ` · ${datos.meta.unidad}` : ''}`;
    $('.em-serie').innerHTML = `<span class="em-leer">Más alto y más tramado: mayor valor. </span>Serie ${datos.periodos[0]}–${datos.periodos.at(-1)}${esEjemplo ? ' · datos de ejemplo' : ''}`;
    if (est.sel) pintarFicha();
  }

  function seleccionar(c) {
    est.sel = c; mapa.setSeleccion(c);
    $('.ficha').hidden = !c;
    if (c) { mapa.enfocarRegion(c); pintarFicha(); } else mapa.vista('general');
  }
  function pintarFicha() {
    const f = formato(datos), c = est.sel, d = ficha(datos, est.fuente, c, est.i);
    $('.ficha-num').textContent = `${ROMANO[c]} · ${datos.periodos[est.i]}`;
    $('.ficha-silueta').innerHTML = `<defs><pattern id="tr" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" /></pattern></defs><path d="${silueta(c, 150, 150, 8)}"/>`;
    $('.ficha-nombre').textContent = NOMBRE[c];
    $('.ficha-valor').innerHTML = d.valor == null ? 'Sin dato' : esc(f(d.valor, false)) + (datos.meta.unidad ? `<small>${esc(datos.meta.unidad)}</small>` : '');
    const filas = [
      ['Emisión', fuentes(datos).find((x) => x.id === est.fuente)?.nombre],
      d.observado != null && ['Observado', f(d.observado)],
      d.lo != null && ['Intervalo', `${f(d.lo, false)} – ${f(d.hi, false)}`],
      d.valor != null && ['Puesto', `${d.puesto} de ${d.total}`]
    ].filter(Boolean);
    $('.ficha-datos').innerHTML = filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  }
  $('.ficha-cerrar').addEventListener('click', () => seleccionar(null));

  function tip(c, pos) {
    const el = $('.tip');
    if (!c || !pos) { el.hidden = true; return; }
    const v = serieDe(datos, est.fuente, c)[est.i];
    el.innerHTML = `<b>${esc(NOMBRE[c])}</b> ${esc(formato(datos)(v?.p))}`;
    const b = $('.sello-papel').getBoundingClientRect();
    el.style.transform = `translate(${pos.x - b.left + 14}px, ${pos.y - b.top - 34}px)`;
    el.hidden = false;
  }

  const mover = (d) => { const n = Math.min(datos.periodos.length - 1, Math.max(0, est.i + d)); if (n !== est.i) { est.i = n; todo(); } };
  $('.ms-prev').addEventListener('click', () => mover(-1));
  $('.ms-next').addEventListener('click', () => mover(1));
  teclado({ anterior: () => mover(-1), siguiente: () => mover(1), cerrar: () => est.sel && seleccionar(null) });

  $('.em-cargar').addEventListener('click', () => $('.em-archivo').click());
  $('.em-archivo').addEventListener('change', async (e) => {
    try { datos = await leerArchivos([...e.target.files]); esEjemplo = false; arrancar(); aviso('Datos cargados.'); }
    catch (err) { aviso(`No se pudieron leer los datos: ${err.message}.`); }
    e.target.value = '';
  });
  function aviso(t) { const a = $('.aviso'); a.textContent = t; a.hidden = false; clearTimeout(aviso.k); aviso.k = setTimeout(() => (a.hidden = true), 4200); }

  function arrancar() {
    est.fuente = datos.modelos[0].id;
    const iObs = datos.observadoHasta != null ? datos.periodos.indexOf(datos.observadoHasta) : -1;
    est.i = iObs >= 0 ? iObs : 0;
    seleccionar(null);
    todo(900);
  }
  addEventListener('resize', () => { margen(); mapa.vista('general', 0); });
  margen(); arrancar(); mapa.vista('general', 0);
}

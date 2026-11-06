/* PROPUESTA 2 — PRONÓSTICO
THESIS: el mapa del tiempo de la tele chilena: Chile vertical, cifras grandes al costado; rechaza el dashboard con paneles y leyendas.
OWN-WORLD: azul de estudio de TV a toda pantalla; tierra en colores planos de "temperatura" (arena → naranjo → rojo); rótulos blancos con cifra condensada unidos por líneas guía; barra inferior de años como zócalo.
STORY: el visitante lee el país de norte a sur como un pronóstico, cambia de modelo como de canal y de año en el zócalo; al tocar una región ve "los próximos años" como el extendido del tiempo.
FIRST VIEWPORT: título a la izquierda, Chile al centro-izquierda en vertical, columna de 16 rótulos a su derecha, zócalo de años abajo.
FORM: propuesta adicional pedida por el usuario (mapa del tiempo, 2 de 7), seed e728d33b. */
import './pronostico.css';
import { crearMapa } from '../motor/mapa3d.js';
import { geo, NOMBRE, OBSERVADO_ID, CODIGOS, fuentes, vista, serieMapa, origenAnio, datosIniciales, leerArchivos, dominio, formato, ficha, esc, mezclar, teclado } from '../motor/core.js';

const CALOR = ['#f7ecc2', '#f6cf7a', '#f29a45', '#e1592b', '#b52a24', '#7e1c22'];
// Divergente (redistribución): la región que gana parte del total en calor, la que pierde en verde agua.
const GANA = ['#f4efe4', '#f6cf7a', '#f29a45', '#e1592b', '#b52a24'];
const PIERDE = ['#f4efe4', '#b5e3d4', '#5fbfa4', '#25907c', '#0e6158'];
const ORIGEN = { registro: 'Registro', prueba: 'Prueba del modelo', proyeccion: 'Proyección' };

/** Altura (t, 0–1) y color de un valor en la escala de la vista. */
function tono(v, dom, x) {
  // Raíz: la RM mueve ~0,5 pp y el resto ~0,05; sin ella los cambios chicos quedarían invisibles.
  if (v.escala === 'divergente') { const t = Math.sqrt(Math.min(1, Math.abs(x) / (dom.max || 1))); return { t, color: mezclar(x < 0 ? PIERDE : GANA, t) }; }
  const t = (x - dom.min) / (dom.max - dom.min || 1);
  return { t, color: mezclar(CALOR, t) };
}

export async function iniciar(raiz, { entrada = false } = {}) {
  raiz.innerHTML = `
  <main class="tv">
    <div class="tv-escena"><canvas aria-hidden="true"></canvas><div class="capa-etq"></div>
      <svg class="guias" aria-hidden="true"></svg>
      <ol class="rotulos" aria-label="Valor por región"></ol>
    </div>
    <header class="tv-cab">
      <h1><span class="tv-var"></span><span class="tv-anio"></span></h1>
      <div class="canales" role="radiogroup" aria-label="Modelo"></div>
      <p class="tv-leyenda" hidden><span><i style="--c:${GANA[3]}"></i>Gana</span><span><i style="--c:${PIERDE[3]}"></i>Pierde</span></p>
      <p class="tv-desc"></p>
      <p class="tv-nota"><span class="tv-ej"></span><button type="button" class="tv-cargar">Cargar datos</button></p>
      <a class="tv-globo" href="./globo.html">← Volver al globo</a>
    </header>
    <aside class="extendido" hidden aria-live="polite">
      <button type="button" class="ext-cerrar" aria-label="Cerrar">×</button>
      <h2 class="ext-nombre"></h2>
      <p class="ext-valor"></p>
      <p class="ext-meta"></p>
      <ul class="ext-dias"></ul>
    </aside>
    <footer class="zocalo">
      <div class="anios" role="radiogroup" aria-label="Año"></div>
    </footer>
    <input type="file" class="sr tv-archivo" accept=".json,.csv,.txt" multiple tabindex="-1" />
    <p class="aviso" role="status" hidden></p>
  </main>`;
  const $ = (s) => raiz.querySelector(s);
  let { datos, esEjemplo } = await datosIniciales();
  const est = { fuente: datos.modelos[0].id, i: 0, sel: null };
  const V = () => vista(datos, est.fuente);
  // Años con dato en la vista; al cambiar de modelo, si el año no existe se va al último con predicción y registro.
  const visibles = (v) => v.periodos.map((_, k) => k).filter((k) => origenAnio(v, k));
  function anioInicial(v) {
    const ks = visibles(v);
    return ks.filter((k) => origenAnio(v, k) === 'prueba').at(-1) ?? ks.filter((k) => origenAnio(v, k) === 'registro').at(-1) ?? ks[0] ?? 0;
  }

  const mapa = crearMapa({
    canvas: $('canvas'), capaEtiquetas: $('.capa-etq'), geo,
    tema: { material: 'solido', borde: { color: '#ffffff', opacidad: 0.85 }, orientacion: 'vertical', escalaAltura: 3.2,
      inclinacion: { horizontal: [0.7, 0.71], vertical: [0.93, 0.36] } },
    alSeleccionar: (c) => seleccionar(c),
    alCuadro: () => guias()
  });

  const rotulos = new Map();
  $('.rotulos').innerHTML = CODIGOS.map((c, k) => `<li style="--k:${k}"><button type="button" data-c="${c}"><span class="r-nom">${esc(NOMBRE[c])}</span><span class="r-val"></span></button></li>`).join('');
  raiz.querySelectorAll('.rotulos button').forEach((b) => rotulos.set(Number(b.dataset.c), b));
  $('.rotulos').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) seleccionar(Number(b.dataset.c)); });

  function margen() {
    const W = innerWidth, movil = W <= 720;
    const cab = $('.tv-cab').getBoundingClientRect(), zo = $('.zocalo').getBoundingClientRect();
    // El mapa se corre a la izquierda para dejar la columna de rótulos.
    mapa.setMargen(movil
      ? { izq: 0, der: W * 0.5, arr: cab.bottom + 8, aba: innerHeight - zo.top + 8 }
      : { izq: Math.min(W * 0.18, 300), der: Math.min(W * 0.42, 560), arr: 24, aba: innerHeight - zo.top + 8 });
  }

  // Columna de rótulos a la derecha del mapa, con líneas guía (se recalcula cada cuadro).
  function guias() {
    const escena = $('.tv-escena').getBoundingClientRect();
    const pts = CODIGOS.map((c) => ({ c, p: mapa.enPantalla(c) })).filter((x) => x.p);
    if (!pts.length) return;
    const gap = 4;
    const tope0 = $('.zocalo').getBoundingClientRect().top - escena.top - 6;
    const techo = innerWidth <= 720 ? $('.tv-cab').getBoundingClientRect().bottom - escena.top + 8 : 16;
    // los 16 rótulos deben caber entre el título y el zócalo
    const alto = Math.max(20, Math.min(34, Math.floor((tope0 - techo - gap * 15) / 16)));
    if (alto !== guias.alto) { guias.alto = alto; rotulos.forEach((b) => (b.style.height = `${alto}px`)); $('.rotulos').style.setProperty('--fs', alto / 34); }
    // orden norte→sur por y en pantalla; repartir sin solaparse
    pts.sort((a, b) => a.p.y - b.p.y);
    let y = techo - alto - gap;
    const xs = Math.max(...pts.map((x) => x.p.x));
    const colX = Math.min(escena.width - 12 - (innerWidth <= 720 ? 190 : 250), xs + (innerWidth <= 720 ? 22 : 70));
    const pos = pts.map(({ c, p }) => { y = Math.max(p.y - alto / 2, y + alto + gap); return { c, p, y }; });
    // si se pasa del borde inferior, subir todo
    const tope = tope0;
    const exceso = pos.at(-1).y + alto - tope;
    if (exceso > 0) { for (let k = pos.length - 1; k >= 0; k--) { pos[k].y -= exceso; if (k > 0 && pos[k - 1].y + alto + gap > pos[k].y) pos[k - 1].y = pos[k].y - alto - gap; } }
    // si no caben siguiendo a sus regiones, se reparten en casilleros parejos
    if (pos[0].y < techo || pos.at(-1).y + alto > tope) {
      const paso = (tope - techo - alto) / (pos.length - 1);
      pos.forEach((x, k) => (x.y = techo + paso * k));
    }
    let d = '';
    for (const { c, p, y: ry } of pos) {
      const b = rotulos.get(c);
      b.style.transform = `translate(${colX}px, ${ry}px)`;
      const yc = ry + alto / 2;
      d += `M${p.x.toFixed(1)},${p.y.toFixed(1)}L${(colX - 14).toFixed(1)},${yc.toFixed(1)}L${colX},${yc.toFixed(1)}`;
    }
    $('.guias').innerHTML = `<path d="${d}"/>` + pos.map(({ p }) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.6"/>`).join('');
  }

  function canales() {
    $('.canales').innerHTML = fuentes(datos).map((f) =>
      `<button type="button" role="radio" aria-checked="${f.id === est.fuente}" data-id="${esc(f.id)}">${esc(f.id === OBSERVADO_ID ? 'Registro' : f.nombre)}</button>`).join('');
  }
  $('.canales').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]'); if (!b || b.dataset.id === est.fuente) return;
    est.fuente = b.dataset.id;
    const v = V(); if (!visibles(v).includes(est.i)) est.i = anioInicial(v);
    todo(900);
  });

  function anios(v) {
    let antes = null;
    $('.anios').innerHTML = visibles(v).map((k) => {
      const o = origenAnio(v, k), marca = o !== antes && o !== 'registro' ? `<span class="corte">${o === 'proyeccion' ? 'proyección' : 'prueba'}</span>` : '';
      antes = o;
      return `${marca}<button type="button" role="radio" aria-checked="${k === est.i}" data-k="${k}" class="${o === 'proyeccion' ? 'proy' : o}">${v.periodos[k]}</button>`;
    }).join('');
  }
  $('.anios').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { est.i = Number(b.dataset.k); todo(); } });

  function todo(ms) {
    const v = V(), f = formato(v), dom = dominio(v);
    const m = new Map();
    for (const c of CODIGOS) {
      const x = serieMapa(v, c)[est.i], k = x ? tono(v, dom, x.p) : null;
      m.set(c, k);
      const b = rotulos.get(c);
      b.querySelector('.r-val').textContent = x ? f(x.p, false) : '—';
      b.style.setProperty('--c', k ? k.color : '#9aa4b3');
      b.classList.toggle('activo', c === est.sel);
    }
    mapa.actualizar(m, { ms });
    canales(); anios(v);
    $('.tv-var').textContent = `${v.meta.variable}${v.meta.unidad ? ` (${v.meta.unidad})` : ''}`;
    $('.tv-anio').textContent = v.periodos[est.i];
    $('.tv-anio').dataset.origen = ORIGEN[origenAnio(v, est.i)] ?? '';
    $('.tv-desc').textContent = v.meta.nota ?? '';
    $('.tv-leyenda').hidden = v.escala !== 'divergente';
    $('.tv-ej').textContent = esEjemplo ? 'Datos de ejemplo, no reales.' : '';
    if (est.sel) extendido();
  }

  function seleccionar(c) {
    est.sel = c; mapa.setSeleccion(c); $('.extendido').hidden = !c;
    rotulos.forEach((b, k) => b.classList.toggle('activo', k === c));
    if (c) extendido();
  }
  function extendido() {
    const v = V(), f = formato(v), c = est.sel, d = ficha(v, c, est.i);
    $('.ext-nombre').textContent = NOMBRE[c];
    $('.ext-valor').innerHTML = d.valor == null ? 'Sin dato' : `${esc(f(d.valor, false))}<small>${esc(v.meta.unidad ?? '')}</small>`;
    $('.ext-meta').textContent = [ORIGEN[d.origen], d.observado != null ? `registro ${f(d.observado)}` : null,
      d.observado != null ? `error ${f(d.valor - d.observado)}` : null,
      d.lo != null ? `rango ${f(d.lo, false)}–${f(d.hi, false)}` : null, d.valor != null ? `${d.puesto}.º de ${d.total}` : null].filter(Boolean).join(' · ');
    const s = serieMapa(v, c), ks = visibles(v), j = ks.indexOf(est.i);
    const sig = ks.slice(j + 1, j + 5);
    const lista = sig.length ? sig : ks.slice(Math.max(0, j - 3), j);
    const dom = dominio(v);
    $('.ext-dias').innerHTML = lista.map((k) => {
      const x = s[k];
      return `<li style="--c:${x ? tono(v, dom, x.p).color : '#9aa4b3'}"><span>${v.periodos[k]}</span><b>${x ? esc(f(x.p, false)) : '—'}</b></li>`;
    }).join('');
  }
  $('.ext-cerrar').addEventListener('click', () => seleccionar(null));

  const mover = (dx) => { const ks = visibles(V()), n = ks[ks.indexOf(est.i) + dx]; if (n != null) { est.i = n; todo(); } };
  teclado({ anterior: () => mover(-1), siguiente: () => mover(1), cerrar: () => est.sel && seleccionar(null) });

  $('.tv-cargar').addEventListener('click', () => $('.tv-archivo').click());
  $('.tv-archivo').addEventListener('change', async (e) => {
    try { datos = await leerArchivos([...e.target.files]); esEjemplo = false; arrancar(); aviso('Datos cargados.'); }
    catch (err) { aviso(`No se pudieron leer los datos: ${err.message}.`); }
    e.target.value = '';
  });
  function aviso(t) { const a = $('.aviso'); a.textContent = t; a.hidden = false; clearTimeout(aviso.k); aviso.k = setTimeout(() => (a.hidden = true), 4200); }

  function arrancar() {
    est.fuente = datos.modelos[0].id;
    est.i = anioInicial(V());
    seleccionar(null); todo(900);
  }
  addEventListener('resize', () => { margen(); mapa.vista('general', 0); });
  if (!entrada) { arrancar(); margen(); mapa.vista('general', 0); return null; }

  // Llegada desde el globo: el mapa espera invisible hasta que el globo termina de viajar.
  const tv = raiz.querySelector('.tv');
  tv.classList.add('esperando');
  est.fuente = datos.modelos[0].id;
  est.i = anioInicial(V());
  margen(); mapa.vista('general', 0);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return {
    /** Dónde queda Chile en pantalla y con qué color se pinta cada región (para que el globo calce). */
    llegada() {
      const caja = $('.tv-escena').getBoundingClientRect();
      const n = mapa.enPantalla(15), sur = mapa.enPantalla(12), rm = mapa.enPantalla(13);
      const v = V(), dom = dominio(v);
      const colores = new Map(CODIGOS.map((c) => {
        const x = serieMapa(v, c)[est.i];
        return [c, x ? tono(v, dom, x.p).color : '#9aa4b3'];
      }));
      return { cx: caja.left + rm.x, cy: caja.top + (n.y + sur.y) / 2, altoChile: (sur.y - n.y) * 1.08, colores };
    },
    revelar() {
      tv.classList.remove('esperando'); tv.classList.add('entrando');
      seleccionar(null); todo(1500);
      setTimeout(() => tv.classList.remove('entrando'), 2600);
    }
  };
}

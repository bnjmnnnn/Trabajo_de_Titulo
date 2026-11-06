// pliego.js — Chile impreso como un pliego de la Lira Popular.
// Reusa el motor de datos (core.js) sin tocar la propuesta anterior.
import './pliego.css';
import { crearMapa } from '../motor/mapa3d.js';
import { mezclar, geo, NOMBRE, ROMANO, CODIGOS, OBSERVADO_ID, fuentes, vista, serieMapa, origenAnio, datosIniciales, leerArchivos, dominio, formato, ficha, esc, teclado } from '../motor/core.js';

// Cada modelo se imprime en un papel distinto; la segunda tinta cambia con el papel para mantener el contraste.
const PAPELES = [
  { papel: '#f4f5f2', claro: '#ffffff', tinta2: '#d2361f' }, // blanco de imprenta
  { papel: '#f8eef2', claro: '#fffafc', tinta2: '#2549b0' }, // rosa pálido
  { papel: '#edf5f1', claro: '#fbfffd', tinta2: '#c8321d' }, // verde pálido
  { papel: '#eef3fa', claro: '#fbfdff', tinta2: '#c8321d' }  // celeste pálido
];
// Densidad de achurado: 6 niveles, de trama abierta a casi sólido.
const GAP = [12, 8.5, 6.2, 4.6, 3.4, 2.5];
const ANCHO = [0.8, 1.05, 1.3, 1.5, 1.7, 1.9];
const ORIGEN = { registro: 'Registro', prueba: 'Prueba del modelo', proyeccion: 'Proyección · techo' };
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function montar(raiz) {
  raiz.innerHTML = `
  <div class="pliego imprimiendo">
    <div class="pregon" aria-hidden="true"><div class="pregon-pista"><p></p><p></p></div></div>
    <header class="cabezal" style="--d:0">
      <h1 class="cabezal-nombre">Pliego de Chile<span>Predicción de la población inmigrante por región · Trabajo de Título</span></h1>
      <div class="pliegos" role="radiogroup" aria-label="Modelo"></div>
    </header>
    <section class="portada" aria-live="polite">
      <p class="anio" style="--d:120" aria-label="Año"></p>
      <div class="titular" style="--d:220">
        <div class="titular-fila"><span class="timbre"></span></div>
        <h2></h2>
        <p class="bajada"></p>
        <div class="prensa" role="radiogroup" aria-label="Año"></div>
      </div>
    </section>
    <section class="cuerpo" aria-label="Mapa y valores por región">
      <div class="mapa-caja" style="--d:320">
        <div class="mapa-barra">
          <div class="vistas" role="group" aria-label="Encuadre del mapa">
            <button type="button" data-vista="general" aria-pressed="true">Todo Chile</button>
            <button type="button" data-vista="norte" aria-pressed="false">Norte</button>
            <button type="button" data-vista="centro" aria-pressed="false">Centro</button>
            <button type="button" data-vista="sur" aria-pressed="false">Sur</button>
          </div>
          <p class="mapa-ayuda">Arrastra para girar · rueda o pellizco para acercar · clic en una región</p>
        </div>
        <div class="escena">
          <canvas aria-label="Mapa 3D de Chile: cada región se eleva y se entinta según su valor"></canvas>
          <div class="capa" aria-hidden="true"></div>
          <p class="rotulo" hidden aria-hidden="true"></p>
          <span class="rosa" aria-hidden="true">N ←</span>
        </div>
      </div>
      <svg class="hilos" aria-hidden="true"></svg>
      <ol class="columnas"></ol>
    </section>
    <footer class="colofon" style="--d:420">
      <div>
        <p class="nota"></p>
        <div class="acciones">
          <button type="button" class="cargar">Cargar otros datos</button>
          <a href="./globo.html">Ver la propuesta del globo</a>
        </div>
      </div>
      <div class="leyenda">
        <h3>Cómo leer la tinta</h3>
        <div class="escala" aria-hidden="true"></div>
        <div class="escala-ext"><span class="e-min"></span><span class="e-max"></span></div>
        <small class="e-txt"></small>
      </div>
    </footer>
    <aside class="boleto" hidden aria-live="polite" aria-label="Detalle de la región">
      <button type="button" class="boleto-cerrar" aria-label="Cerrar detalle">×</button>
      <h3></h3>
      <p class="boleto-valor"></p>
      <span class="timbre"></span>
      <p class="boleto-meta"></p>
      <ol class="boleto-serie" aria-label="Serie por año"></ol>
    </aside>
    <input type="file" class="sr archivo" accept=".json,.csv,.txt" multiple tabindex="-1" />
    <p class="aviso" role="status" hidden></p>
  </div>`;
  const $ = (s, r = raiz) => r.querySelector(s);
  const pliego = $('.pliego');

  let { datos } = await datosIniciales();
  const est = { fuente: datos.modelos[0].id, i: 0, sel: null, foco: null, play: null };
  const V = () => vista(datos, est.fuente);
  const visibles = (v) => v.periodos.map((_, k) => k).filter((k) => origenAnio(v, k));
  const anioInicial = (v) => { const ks = visibles(v); return ks.filter((k) => origenAnio(v, k) === 'prueba').at(-1) ?? ks.at(-1) ?? 0; };

  // ---------- Escala de tinta (fija para todo el horizonte, así los años se comparan) ----------
  function escala(v) {
    if (v.escala === 'divergente') {
      const m = dominio(v).max || 1;
      return { tipo: 'div', t: (x) => Math.sqrt(Math.min(1, Math.abs(x) / m)), inv: (t) => t * t * m, max: m };
    }
    let mn = Infinity, mx = -Infinity;
    for (const c of CODIGOS) for (const x of serieMapa(v, c)) if (x && x.p > 0) { mn = Math.min(mn, x.p); mx = Math.max(mx, x.p); }
    if (!Number.isFinite(mn)) return { tipo: 'lin', t: () => 0, inv: () => 0 };
    // La Metropolitana es ~25 veces la región que le sigue: en escala lineal quince regiones se verían iguales.
    if (mx / mn > 20) {
      const a = Math.log(mn), b = Math.log(mx);
      return { tipo: 'log', t: (x) => (x > 0 ? (Math.log(x) - a) / (b - a || 1) : 0), inv: (t) => Math.exp(a + t * (b - a)), min: mn, max: mx };
    }
    return { tipo: 'lin', t: (x) => x / (mx || 1), inv: (t) => t * mx, min: 0, max: mx };
  }
  const nivel = (t) => Math.max(0, Math.min(5, Math.round(t * 5)));
  /** Tinta de un valor: nivel de trama, tinta (negra o segunda) y ángulo. */
  function tinta(v, esc_, x) {
    if (!x) return null;
    const t = esc_.t(x.p), n = nivel(t);
    if (esc_.tipo === 'div') return { t, n, ink: x.p < 0 ? 'r' : 'n', ang: x.p < 0 ? -45 : 45, neg: x.p < 0 };
    return { t, n, ink: x.origen === 'proyeccion' ? 'r' : 'n', ang: 45, neg: false };
  }
  const cssTinta = (k) => k ? `--tc:${k.ink === 'r' ? 'var(--tinta2)' : 'var(--tinta)'};--ang:${k.ang}deg;--g:${GAP[k.n]}px;--w:${ANCHO[k.n]}px` : '--tc:var(--tinta);--g:14px;--w:.6px';

  // ---------- Mapa 3D interactivo (motor Three.js existente) entintado como grabado ----------
  // Tonos de tinta por densidad: papel → negro; la segunda tinta para proyección y para "pierde".
  const RAMPA = { n: ['#e4e3de', '#a9a8a4', '#5f5e62', '#17161a'], r: ['#f3dcd6', '#e8907f', '#d2361f', '#8e1d10'], a: ['#dfe5f4', '#8fa3d8', '#2549b0', '#132a6e'] };
  const movil = () => innerWidth <= 820;
  let ultimoToque = null;
  $('.escena canvas').addEventListener('pointerdown', (e) => (ultimoToque = { x: e.clientX, y: e.clientY }));
  const mapa = crearMapa({
    canvas: $('.escena canvas'), capaEtiquetas: $('.escena .capa'), geo,
    tema: { material: 'solido', borde: { color: '#17161a', opacidad: 0.9 }, orientacion: movil() ? 'vertical' : 'horizontal', escalaAltura: 5.2,
      sinDato: '#d9d8d3', inclinacion: { horizontal: [0.78, 0.62], vertical: [0.93, 0.4] } },
    alSeleccionar: (c) => { if (c && ultimoToque) salpicar(ultimoToque.x, ultimoToque.y); seleccionar(c && c === est.sel ? null : c); },
    alHover: (c, pos) => { rotular(c, pos); enfocar(c); },
    alCuadro: () => hilos()
  });

  function pintarMapa(ms = 800) {
    const v = V(), e = escala(v), dark = PAPELES[Math.max(0, fuentes(datos).findIndex((f) => f.id === est.fuente)) % PAPELES.length].tinta2;
    const m = new Map();
    for (const c of CODIGOS) {
      const k = tinta(v, e, serieMapa(v, c)[est.i]);
      if (!k) { m.set(c, null); continue; }
      const rampa = k.ink === 'n' ? RAMPA.n : dark === '#2549b0' ? RAMPA.a : RAMPA.r;
      m.set(c, { t: Math.max(0.04, k.t), color: mezclar(rampa, 0.12 + k.t * 0.88) });
    }
    mapa.actualizar(m, { ms });
    mapa.setSeleccion(est.sel);
  }

  // Rótulo de imprenta que sigue al cursor sobre el mapa
  const etq = $('.escena .rotulo');
  function rotular(c, pos) {
    etq.hidden = !c || !pos;
    if (!c || !pos) return;
    const v = V(), x = serieMapa(v, c)[est.i], r = $('.escena').getBoundingClientRect();
    etq.innerHTML = `${esc(NOMBRE[c])}<b>${x ? esc(formato(v)(x.p)) : '—'}</b>`;
    etq.classList.toggle('proyeccion', x?.origen === 'proyeccion');
    etq.style.transform = `translate(${pos.x - r.left + 14}px, ${pos.y - r.top + 14}px)`;
  }
  $('.vistas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-vista]'); if (!b) return;
    raiz.querySelectorAll('.vistas button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    mapa.vista(b.dataset.vista);
  });

  // ---------- Columnas-noticia ----------
  $('.columnas').innerHTML = CODIGOS.map((c, k) => `<li><button type="button" class="col" data-c="${c}" style="--k:${k}">
    <span class="col-rom" aria-hidden="true">${ROMANO[c]}</span>
    <span class="col-pozo" aria-hidden="true"><span class="col-barra"></span></span>
    <span class="col-pie"><span class="col-cifra"></span><span class="col-nom">${esc(NOMBRE[c])}</span></span>
  </button></li>`).join('');
  const cols = new Map([...raiz.querySelectorAll('.col')].map((b) => [Number(b.dataset.c), b]));

  // ---------- Hilos: de cada región (donde esté al girar el mapa) a su columna ----------
  function hilos() {
    const h = $('.hilos');
    if (movil()) { if (h.innerHTML) h.innerHTML = ''; return; }
    const caja = $('.cuerpo').getBoundingClientRect(), m = $('.escena').getBoundingClientRect();
    const yBase = m.bottom - caja.top + 6;
    let d = '';
    for (const c of CODIGOS) {
      const p = mapa.enPantalla(c), b = cols.get(c).querySelector('.col-rom').getBoundingClientRect();
      const cx = b.left + b.width / 2 - caja.left, cy = b.top - caja.top - 4;
      if (!p || !p.visible || p.x < 0 || p.x > m.width || p.y < 0 || p.y > m.height) { d += `<path data-c="${c}" d="M${cx.toFixed(1)},${(yBase).toFixed(1)}L${cx.toFixed(1)},${cy.toFixed(1)}"/>`; continue; }
      const px = m.left - caja.left + p.x, py = m.top - caja.top + p.y;
      d += `<path data-c="${c}" d="M${px.toFixed(1)},${py.toFixed(1)}V${yBase.toFixed(1)}L${cx.toFixed(1)},${(cy - 6).toFixed(1)}V${cy.toFixed(1)}"/><circle data-c="${c}" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.6"/>`;
    }
    h.innerHTML = d;
    if (est.foco) h.querySelectorAll(`[data-c="${est.foco}"]`).forEach((x) => x.classList.add('foco'));
  }

  // ---------- Foco (hover) y selección ----------
  function enfocar(c) {
    if (c === est.foco) return;
    est.foco = c;
    if (c) pliego.dataset.foco = c; else delete pliego.dataset.foco;
    cols.forEach((b, k) => b.classList.toggle('foco', k === c));
    raiz.querySelectorAll('.hilos [data-c]').forEach((p) => p.classList.toggle('foco', Number(p.dataset.c) === c));
  }
  function seleccionar(c) {
    est.sel = c;
    $('.boleto').hidden = !c;
    cols.forEach((b, k) => { b.classList.toggle('sel', k === c); b.setAttribute('aria-pressed', String(k === c)); });
    mapa.setSeleccion(c);
    if (c) { mapa.enfocarRegion(c); boleto(true); } else mapa.vista('general');
    raiz.querySelectorAll('.vistas button').forEach((x) => x.setAttribute('aria-pressed', String(!c && x.dataset.vista === 'general')));
  }

  $('.columnas').addEventListener('pointerover', (e) => { const b = e.target.closest('.col'); enfocar(b ? Number(b.dataset.c) : null); });
  $('.columnas').addEventListener('pointerleave', () => enfocar(null));
  $('.columnas').addEventListener('focusin', (e) => { const b = e.target.closest('.col'); if (b) enfocar(Number(b.dataset.c)); });
  $('.columnas').addEventListener('focusout', () => enfocar(null));
  $('.columnas').addEventListener('click', (e) => {
    const b = e.target.closest('.col'); if (!b) return;
    const c = Number(b.dataset.c);
    if (e.detail) salpicar(e.clientX, e.clientY);
    seleccionar(est.sel === c ? null : c);
  });
  $('.boleto-cerrar').addEventListener('click', () => { const c = est.sel; seleccionar(null); cols.get(c)?.focus(); });

  // ---------- Pliegos (modelos) ----------
  function pliegos() {
    $('.pliegos').innerHTML = fuentes(datos).map((f, k) => {
      const p = PAPELES[k % PAPELES.length], v = vista(datos, f.id);
      const nombre = f.id === OBSERVADO_ID ? 'Registro' : f.nombre;
      const [a, b] = nombre.split(' · ');
      return `<button type="button" role="radio" aria-checked="${f.id === est.fuente}" data-id="${esc(f.id)}" style="--hoja:${p.papel}">
        <b>${esc(a)}</b><small>${esc(b ?? v.meta.unidad ?? '')}</small></button>`;
    }).join('');
  }
  function aplicarPapel() {
    const k = Math.max(0, fuentes(datos).findIndex((f) => f.id === est.fuente)), p = PAPELES[k % PAPELES.length];
    const r = document.documentElement.style;
    r.setProperty('--papel', p.papel); r.setProperty('--papel-claro', p.claro); r.setProperty('--tinta2', p.tinta2);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.papel);
  }
  $('.pliegos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]'); if (!b || b.dataset.id === est.fuente) return;
    const cambiar = () => {
      est.fuente = b.dataset.id;
      const v = V(); if (!visibles(v).includes(est.i)) est.i = anioInicial(v);
      parar(); todo({ sinAnimar: true });
    };
    const r = b.getBoundingClientRect();
    document.documentElement.style.setProperty('--vx', `${r.left + r.width / 2}px`);
    document.documentElement.style.setProperty('--vy', `${r.top + r.height / 2}px`);
    if (document.startViewTransition && !reducido) document.startViewTransition(cambiar); else cambiar();
  });

  // ---------- Prensa (años) ----------
  function prensa(v) {
    const grupos = [];
    for (const k of visibles(v)) {
      const o = origenAnio(v, k);
      if (!grupos.length || grupos.at(-1).o !== o) grupos.push({ o, ks: [] });
      grupos.at(-1).ks.push(k);
    }
    const nombre = { registro: 'registro', prueba: 'prueba del modelo', proyeccion: 'proyección (techo)' };
    $('.prensa').innerHTML = grupos.map((g) => `<div class="prensa-grupo ${g.o}"><span>${nombre[g.o]}</span><div class="prensa-tipos">${g.ks.map((k) =>
      `<button type="button" role="radio" class="tipo ${g.o}" aria-checked="${k === est.i}" data-k="${k}">${v.periodos[k]}</button>`).join('')}</div></div>`).join('')
      + (visibles(v).length > 1 ? `<button type="button" class="imprimir" aria-pressed="${!!est.play}"><svg viewBox="0 0 16 16" aria-hidden="true">${est.play ? '<path d="M3 2h4v12H3zM9 2h4v12H9z"/>' : '<path d="M3 1.5v13L14 8z"/>'}</svg><span>${est.play ? 'Detener' : 'Imprimir la serie'}</span></button>` : '');
  }
  $('.prensa').addEventListener('click', (e) => {
    const t = e.target.closest('[data-k]');
    if (t) { parar(); est.i = Number(t.dataset.k); todo(); return; }
    if (e.target.closest('.imprimir')) { if (est.play) parar(); else reproducir(); prensa(V()); $('.imprimir')?.focus(); }
  });
  // Tipos magnéticos: el bloque se acerca al cursor
  $('.prensa').addEventListener('pointermove', (e) => {
    if (reducido || e.pointerType === 'touch') return;
    raiz.querySelectorAll('.tipo').forEach((b) => {
      const r = b.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy);
      b.style.transform = d < 90 ? `translate(${dx * 0.18}px, ${dy * 0.22}px)` : '';
    });
  });
  $('.prensa').addEventListener('pointerleave', () => raiz.querySelectorAll('.tipo').forEach((b) => (b.style.transform = '')));

  function reproducir() {
    const ks = visibles(V());
    est.play = setInterval(() => { const j = ks.indexOf(est.i); est.i = ks[(j + 1) % ks.length]; todo(); }, 1700);
  }
  function parar() { if (est.play) { clearInterval(est.play); est.play = null; } }

  // ---------- Efectos de imprenta ----------
  function contar(el, hasta, fmt) {
    const desde = Number(el.dataset.v ?? hasta);
    el.dataset.v = hasta;
    if (reducido || desde === hasta || !Number.isFinite(desde)) { el.textContent = fmt(hasta); return; }
    const t0 = performance.now(), ms = 750;
    cancelAnimationFrame(el._raf);
    const paso = (ahora) => {
      const k = Math.min(1, (ahora - t0) / ms), s = 1 - Math.pow(2, -10 * k);
      el.textContent = fmt(desde + (hasta - desde) * (k >= 1 ? 1 : s));
      if (k < 1) el._raf = requestAnimationFrame(paso);
    };
    el._raf = requestAnimationFrame(paso);
  }
  // El año se compone como tipos sueltos que el cajista va asentando
  function componer(el, texto) {
    if (el.textContent === texto) return;
    if (reducido || !el.textContent) { el.textContent = texto; return; }
    let f = 0; clearInterval(el._int);
    el._int = setInterval(() => {
      f++;
      el.textContent = [...texto].map((ch, j) => (j < f / 2 ? ch : String((Math.random() * 10) | 0))).join('');
      if (f / 2 >= texto.length) { clearInterval(el._int); el.textContent = texto; }
    }, 34);
  }
  function salpicar(x, y) {
    if (reducido) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'salpica'); s.setAttribute('viewBox', '-45 -45 90 90');
    s.style.left = `${x}px`; s.style.top = `${y}px`;
    s.innerHTML = Array.from({ length: 9 }, (_, j) => {
      const a = (j / 9) * Math.PI * 2 + Math.random() * 0.4, r0 = 10, r1 = 22 + Math.random() * 18;
      return `<line x1="${(Math.cos(a) * r0).toFixed(1)}" y1="${(Math.sin(a) * r0).toFixed(1)}" x2="${(Math.cos(a) * r1).toFixed(1)}" y2="${(Math.sin(a) * r1).toFixed(1)}"/>`;
    }).join('');
    document.body.append(s);
    s.animate([{ opacity: 1, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.25)' }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => s.remove();
  }
  function timbrar(el, origen) {
    const txt = ORIGEN[origen] ?? '', cambio = el.textContent !== txt;
    el.textContent = txt; el.className = `timbre ${origen ?? ''}`; el.hidden = !txt;
    if (cambio && !reducido) { void el.offsetWidth; el.classList.add('golpe'); }
  }

  // ---------- Titular calculado de los datos ----------
  function titular(v, f) {
    const xs = CODIGOS.map((c) => ({ c, x: serieMapa(v, c)[est.i]?.p })).filter((r) => r.x != null);
    if (!xs.length) return { h: 'Sin datos para este año', b: '' };
    if (v.escala === 'divergente') {
      const orden = [...xs].sort((a, b) => b.x - a.x), g = orden[0], p = orden.at(-1);
      return {
        h: `${esc(NOMBRE[g.c])} gana <em>${esc(f(g.x))}</em>; ${esc(NOMBRE[p.c])} ${p.x < 0 ? `cede <em>${esc(f(Math.abs(p.x)).replace(/^\+/, ''))}</em>` : `suma apenas <em>${esc(f(p.x))}</em>`}`,
        b: `${esc(v.meta.variable)}. Cuánto se mueve la parte de cada región en el total de inmigrantes respecto del año anterior.`
      };
    }
    const total = xs.reduce((s, r) => s + r.x, 0), rm = xs.find((r) => r.c === 13), max = [...xs].sort((a, b) => b.x - a.x)[0];
    const cuota = (rm ?? max).x / total;
    const pct = (cuota * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 });
    const quien = rm ? 'la Región Metropolitana' : NOMBRE[max.c];
    // La fracción simple más cercana (denominador ≤ 10) para decirlo como se dice en la calle.
    let fr = { a: 1, b: 2, err: Infinity };
    for (let b = 2; b <= 10; b++) { const a = Math.round(cuota * b), err = Math.abs(a / b - cuota); if (a > 0 && err < fr.err - 0.004) fr = { a, b, err }; }
    const N = ['', 'Una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
    const cuantas = fr.a === 1 ? 'Una' : N[fr.a][0].toUpperCase() + N[fr.a].slice(1);
    return {
      h: `${cuantas} de cada <em>${N[fr.b]}</em> personas inmigrantes ${fr.a === 1 ? 'vive' : 'viven'} en ${esc(quien)}`,
      b: `${esc(f(total))} en las 16 regiones; ${esc(quien)} reúne el ${pct} %.${origenAnio(v, est.i) === 'proyeccion' ? ' Proyección con las condiciones promedio 2021–2023: un techo, no un pronóstico central.' : ''}`
    };
  }

  // ---------- Dibujo completo ----------
  function todo({ sinAnimar = false } = {}) {
    const v = V(), f = formato(v), e = escala(v), dec = v.meta.decimales ?? 2;
    aplicarPapel(); pliegos(); prensa(v);
    pliego.classList.toggle('div', e.tipo === 'div');
    $('.columnas').classList.toggle('div', e.tipo === 'div');
    const o = origenAnio(v, est.i);
    componer($('.anio'), String(v.periodos[est.i]));
    timbrar($('.portada .timbre'), o);
    const t = titular(v, f);
    $('.titular h2').innerHTML = t.h; $('.bajada').innerHTML = t.b;

    const fmtN = (x) => x.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec, signDisplay: e.tipo === 'div' ? 'exceptZero' : 'auto' });
    for (const c of CODIGOS) {
      const x = serieMapa(v, c)[est.i], k = tinta(v, e, x), b = cols.get(c);
      const barra = b.querySelector('.col-barra'), cifra = b.querySelector('.col-cifra');
      barra.style.cssText = `${cssTinta(k)};--h:${k ? Math.max(0.015, k.t) : 0}`;
      barra.classList.toggle('neg', !!k?.neg);
      cifra.classList.toggle('proyeccion', x?.origen === 'proyeccion');
      if (x) { if (sinAnimar) { cifra.dataset.v = x.p; cifra.textContent = fmtN(x.p); } else contar(cifra, x.p, fmtN); } else { cifra.textContent = '—'; delete cifra.dataset.v; }
      b.setAttribute('aria-label', `${NOMBRE[c]}: ${x ? f(x.p) : 'sin dato'}${x ? `, ${ORIGEN[x.origen].toLowerCase()}` : ''}`);
    }
    pintarMapa();

    // Pregón
    const linea = CODIGOS.map((c) => { const x = serieMapa(v, c)[est.i]; return `${esc(NOMBRE[c])} <b>${x ? esc(f(x.p)) : '—'}</b>`; }).join('<i>❧</i>') + '<i>❧</i>';
    raiz.querySelectorAll('.pregon p').forEach((p) => (p.innerHTML = `${v.periodos[est.i]} <i>❧</i>${linea}`));

    // Colofón y leyenda
    $('.nota').textContent = v.meta.nota ?? '';
    $('.escala').innerHTML = GAP.map((g, n) => `<i style="--tc:${e.tipo === 'div' && n === 0 ? 'var(--tinta)' : 'var(--tinta)'};--g:${g}px;--w:${ANCHO[n]}px"></i>`).join('');
    if (e.tipo === 'div') {
      $('.e-min').textContent = '0'; $('.e-max').textContent = `±${fmtN(e.max)} ${v.meta.unidad ?? ''}`;
      $('.e-txt').innerHTML = 'Más tinta, más movimiento. Trama <b>en segunda tinta</b> e inclinada al revés: la región pierde parte del total. Escala de raíz cuadrada, fija para todos los años.';
    } else {
      $('.e-min').textContent = fmtN(e.min ?? 0); $('.e-max').textContent = `${fmtN(e.max ?? 0)} ${v.meta.unidad ?? ''}`;
      $('.e-txt').innerHTML = `Más tinta, más personas. Escala ${e.tipo === 'log' ? 'logarítmica (cada salto de trama multiplica el valor)' : 'lineal'} y fija para todos los años. Lo impreso <b>en segunda tinta</b> es proyección: un techo, no un pronóstico.`;
    }
    if (est.sel) boleto(false);
    requestAnimationFrame(hilos);
  }

  function boleto(nuevo) {
    const v = V(), f = formato(v), c = est.sel, d = ficha(v, c, est.i), e = escala(v);
    $('.boleto h3').innerHTML = `<span>Región ${ROMANO[c]} · ${v.periodos[est.i]}</span>${esc(NOMBRE[c])}`;
    const val = $('.boleto-valor');
    val.className = `boleto-valor ${d.origen ?? ''}`;
    val.innerHTML = d.valor == null ? 'Sin dato' : `<span>${esc(f(d.valor, false))}</span><small>${esc(v.meta.unidad ?? '')}</small>`;
    timbrar($('.boleto .timbre'), d.origen);
    $('.boleto-meta').textContent = [
      d.valor != null ? `Puesto ${d.puesto} de ${d.total}` : null,
      d.observado != null ? `registro ${f(d.observado)}` : null,
      d.observado != null ? `error del modelo ${f(d.valor - d.observado)}` : null,
      d.lo != null ? `rango ${f(d.lo, false)}–${f(d.hi, false)}` : null
    ].filter(Boolean).join(' · ') || 'Sin más información para este año.';
    const s = serieMapa(v, c);
    $('.boleto-serie').innerHTML = visibles(v).map((k) => {
      const x = s[k], t = tinta(v, e, x);
      return `<li class="${k === est.i ? 'ahora' : ''}" aria-label="${v.periodos[k]}: ${x ? esc(f(x.p)) : 'sin dato'}"><i style="${cssTinta(t)};--h:${t ? Math.max(0.03, t.t) : 0}"></i><span>${String(v.periodos[k]).slice(2)}’</span></li>`;
    }).join('');
    if (nuevo) { const b = $('.boleto'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
  }

  // ---------- Teclado, carga de datos, tamaño ----------
  const mover = (dx) => { parar(); const ks = visibles(V()), n = ks[ks.indexOf(est.i) + dx]; if (n != null) { est.i = n; todo(); } };
  teclado({ anterior: () => mover(-1), siguiente: () => mover(1), cerrar: () => est.sel && seleccionar(null) });
  $('.cargar').addEventListener('click', () => $('.archivo').click());
  $('.archivo').addEventListener('change', async (e) => {
    try { datos = await leerArchivos([...e.target.files]); est.fuente = datos.modelos[0].id; est.i = anioInicial(V()); seleccionar(null); todo(); aviso('Datos cargados: el pliego se volvió a imprimir.'); }
    catch (err) { aviso(`No se pudieron leer los datos: ${err.message}. Usa el JSON de exportar_predicciones.py o los CSV con columna "prediccion".`); }
    e.target.value = '';
  });
  function aviso(t) { const a = $('.aviso'); a.textContent = t; a.hidden = false; clearTimeout(aviso.k); aviso.k = setTimeout(() => (a.hidden = true), 5000); }
  let rz, eraMovil = movil();
  addEventListener('resize', () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => {
      if (movil() !== eraMovil) { eraMovil = movil(); mapa.setOrientacion(eraMovil ? 'vertical' : 'horizontal'); }
      if (!est.sel) mapa.vista('general', 0);
      hilos();
    });
  });
  document.fonts?.ready.then(() => requestAnimationFrame(hilos));

  est.i = anioInicial(V());
  todo({ sinAnimar: true });
  mapa.vista('general', 0);
  pintarMapa(reducido ? 0 : 1600); // las regiones crecen desde el papel en la entrada
  setTimeout(() => { pliego.classList.remove('imprimiendo'); hilos(); }, reducido ? 0 : 1900);
}

montar(document.getElementById('pliego'));

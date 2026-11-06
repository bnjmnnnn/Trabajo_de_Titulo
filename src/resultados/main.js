// main.js — landing de resultados: explorador reactivo de los dos modelos, alimentado por modelos/*.csv
import './estilos.css';
import { cargarModelos, ARCHIVOS } from './datos.js';
import { crearMapa } from '../motor/mapa3d.js';
import { geo, NOMBRE, CODIGOS, mezclar, esc } from '../motor/core.js';

// ---------- Íconos Phosphor (regular) ----------
const iconos = import.meta.glob('/node_modules/@phosphor-icons/core/assets/regular/{arrow-right,caret-left,caret-right,play,pause,target,calendar,scales,arrows-left-right,check-circle,database,tree-structure,trend-up,warning,download-simple,x,info}.svg', { query: '?raw', import: 'default', eager: true });
const icono = (n) => iconos[`/node_modules/@phosphor-icons/core/assets/regular/${n}.svg`] ?? '';
const ponerIconos = (raiz = document) => raiz.querySelectorAll('i[data-icon]').forEach((i) => { if (!i.innerHTML) i.innerHTML = icono(i.dataset.icon); });
ponerIconos();

const $ = (s, r = document) => r.querySelector(s);
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ORIGEN = { registro: 'Registro', prueba: 'Prueba del modelo', proyeccion: 'Proyección (techo)' };
// Cada modelo nombra su proyección: el conteo es un techo; la distribución, un escenario.
const origen = (m, a) => (a.origen === 'proyeccion' && m.etiquetaProy) || ORIGEN[a.origen];
const SEC = ['#e6f4f1', '#a7dccf', '#4db3a2', '#0f766e', '#0b4a45'];
const GANA = ['#e6f4f1', '#7cc8b8', '#0f766e'];
const PIERDE = ['#fde3d3', '#f09a6b', '#c2410c'];
const PROY = ['#fdf0dc', '#f3c27c', '#d97706', '#b45309', '#7c3a06'];

// Números en es-CL con signo menos tipográfico (sin guiones en el texto).
const fmtNum = (x, d = 0, signo = false) => x.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d, signDisplay: signo ? 'exceptZero' : 'auto' }).replace('-', '−');
const fmt = (m, x) => `${fmtNum(x, m.decimales, m.escala === 'divergente')} ${m.unidad}`;

// ---------- Navegación ----------
const menuBtn = $('.nav-menu'), panel = $('#panel-menu');
function menu(abrir) {
  menuBtn.setAttribute('aria-expanded', String(abrir)); menuBtn.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
  panel.hidden = !abrir; document.body.style.overflow = abrir ? 'hidden' : '';
}
menuBtn.addEventListener('click', () => menu(panel.hidden));
panel.addEventListener('click', (e) => { if (e.target.closest('a')) menu(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) menu(false); });
// Sección actual marcada en la navegación
const enlaces = [...document.querySelectorAll('.nav-links a')];
// Indicador circular: sigue al cursor entre los enlaces (con un leve tirón hacia él) y vuelve a la sección actual.
const listaNav = $('.nav-links');
const indicador = document.createElement('span');
indicador.className = 'nav-indicador'; indicador.setAttribute('aria-hidden', 'true');
listaNav.prepend(indicador);
let sobreNav = false;
function ponerIndicador(a, dx = 0, actual = false) {
  if (!a) { indicador.style.opacity = '0'; return; }
  const li = a.parentElement;
  indicador.style.opacity = '1';
  indicador.style.width = `${li.offsetWidth}px`;
  indicador.style.transform = `translateX(${li.offsetLeft + dx}px)`;
  indicador.style.setProperty('--punto', actual ? '1' : '0');
}
const enlaceActual = () => enlaces.find((a) => a.getAttribute('aria-current') === 'true');
listaNav.addEventListener('pointermove', (e) => {
  const a = e.target.closest('a'); if (!a) return;
  sobreNav = true;
  const r = a.getBoundingClientRect();
  ponerIndicador(a, reducido ? 0 : (e.clientX - (r.left + r.width / 2)) * 0.12, a === enlaceActual());
});
listaNav.addEventListener('pointerleave', () => { sobreNav = false; ponerIndicador(enlaceActual(), 0, true); });
listaNav.addEventListener('focusin', (e) => { const a = e.target.closest('a'); if (a) ponerIndicador(a, 0, a === enlaceActual()); });
listaNav.addEventListener('focusout', () => { if (!sobreNav) ponerIndicador(enlaceActual(), 0, true); });
const obsNav = new IntersectionObserver((ents) => ents.forEach((en) => {
  if (!en.isIntersecting) return;
  enlaces.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === `#${en.target.id}`)));
  if (!sobreNav) ponerIndicador(enlaceActual(), 0, true);
}), { rootMargin: '-45% 0px -50% 0px' });
['explorar', 'impacto', 'modelos', 'evidencia', 'preguntas'].forEach((id) => obsNav.observe(document.getElementById(id)));

// ---------- Revelado de secciones (una vez) ----------
const obsRev = new IntersectionObserver((ents) => ents.forEach((en) => {
  if (en.isIntersecting) { en.target.classList.add('revelado'); obsRev.unobserve(en.target); }
}), { threshold: 0.08 });
document.querySelectorAll('.revelar').forEach((s) => obsRev.observe(s));

// ---------- Cuenta animada ----------
function contar(el, hasta, f) {
  const desde = Number(el.dataset.v ?? NaN);
  el.dataset.v = hasta;
  if (reducido || !Number.isFinite(desde) || desde === hasta) { el.textContent = f(hasta); return; }
  const t0 = performance.now(); cancelAnimationFrame(el._r);
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / 600), s = 1 - Math.pow(1 - k, 4);
    el.textContent = f(desde + (hasta - desde) * s);
    if (k < 1) el._r = requestAnimationFrame(paso);
  };
  el._r = requestAnimationFrame(paso);
}

// ---------- Arranque con datos ----------
let D;
try { D = await cargarModelos(); }
catch (err) {
  const e = $('[data-error]');
  e.hidden = false;
  e.textContent = `No se pudieron leer los resultados: ${err.message}. Revisa que la carpeta modelos esté publicada junto a esta página y recarga.`;
  $('[data-prueba]').textContent = '';
  throw err;
}
const [CONTEO, DISTRIB] = D.modelos;

// Prueba social del hero: el skill real del conteo
$('[data-prueba]').innerHTML = `<i data-icon>${icono('check-circle')}</i><span>Skill <b class="num">${fmtNum(CONTEO.skill[2023], 3, true)}</b> frente a repetir el año anterior en la prueba 2023 del modelo de conteo</span>`;

// Hero visual: RM frente al resto, 2023 (dato real) y 2028 (techo)
{
  const total = (m) => [...m.values()].reduce((s, x) => s + x, 0);
  const obs23 = new Map([...CONTEO.anios.find((a) => a.anio === 2023).valores].map(([c, x]) => [c, x.obs]));
  const p28 = CONTEO.anios.at(-1);
  const fila = (titulo, m, clase) => {
    const t = total(m), rm = m.get(13) / t;
    return `<div class="hv-fila ${clase}"><div class="hv-cab"><span class="title-4">${titulo}</span><span class="hv-total num">${fmtNum(t)}</span></div>
      <div class="hv-barra" role="img" aria-label="${titulo}: Región Metropolitana ${fmtNum(rm * 100, 1)} %, resto ${fmtNum((1 - rm) * 100, 1)} %">
        <span class="rm caption-3" style="width:${(rm * 100).toFixed(1)}%">RM ${fmtNum(rm * 100, 1)} %</span>
        <span class="resto caption-3" style="width:${((1 - rm) * 100).toFixed(1)}%;animation-delay:.15s">Resto ${fmtNum((1 - rm) * 100, 1)} %</span></div></div>`;
  };
  $('[data-hero-visual]').innerHTML = fila('2023 · dato registrado', obs23, '') + fila(`${p28.anio} · proyección techo`, new Map([...p28.valores].map(([c, x]) => [c, x.v])), 'proy');
  $('[data-hero-nota]').textContent = 'Personas inmigrantes estimadas por el modelo de conteo. La cifra de 2028 supone condiciones promedio de 2021 a 2023.';
}

// ---------- Estado del explorador ----------
const est = { m: CONTEO, i: CONTEO.anios.findIndex((a) => a.origen === 'prueba'), sel: null, play: null, foco: null };
const anioAct = () => est.m.anios[est.i];

// Escala fija por modelo (para comparar años): log en conteo, raíz simétrica en distribución
function escala(m) {
  const vs = m.anios.flatMap((a) => [...a.valores.values()].map((x) => x.v));
  if (m.escala === 'divergente') { const mx = Math.max(...vs.map(Math.abs)); return { t: (v) => Math.sqrt(Math.min(1, Math.abs(v) / mx)), max: mx }; }
  const mn = Math.min(...vs), mx = Math.max(...vs), a = Math.log(mn), b = Math.log(mx);
  return { t: (v) => (Math.log(Math.max(v, mn)) - a) / (b - a), min: mn, max: mx };
}
function color(m, a, v, t) {
  if (m.escala === 'divergente') return mezclar(v < 0 ? PIERDE : GANA, t);
  return mezclar(a.origen === 'proyeccion' ? PROY : SEC, 0.08 + t * 0.92);
}

// ---------- Mapa 3D ----------
const movil = () => innerWidth <= 1024;
let ultimoClic = null;
$('.escena canvas').addEventListener('pointerdown', (e) => (ultimoClic = e));
const mapa = crearMapa({
  canvas: $('.escena canvas'), capaEtiquetas: $('.escena .capa'), geo,
  tema: { material: 'solido', borde: { color: '#1c1917', opacidad: 0.35 }, orientacion: 'vertical', escalaAltura: 4.2, sinDato: '#e7e5e4',
    inclinacion: { horizontal: [0.78, 0.62], vertical: [0.9, 0.44] } },
  alSeleccionar: (c) => seleccionar(c && c === est.sel ? null : c),
  alHover: (c, pos) => { rotular(c, pos); enfocar(c); }
});
function rotular(c, pos) {
  const r = $('.rotulo'); r.hidden = !c || !pos; if (!c || !pos) return;
  const x = anioAct().valores.get(c), caja = $('.escena').getBoundingClientRect();
  r.innerHTML = `<span>${esc(NOMBRE[c])}</span><span class="num">${x ? esc(fmt(est.m, x.v)) : '—'}</span>`;
  r.style.transform = `translate(${pos.x - caja.left + 12}px, ${pos.y - caja.top + 12}px)`;
}
$('.vistas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-vista]'); if (!b) return;
  document.querySelectorAll('.vistas .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  mapa.vista(b.dataset.vista);
});

// ---------- Controles reactivos ----------
const segm = $('[data-modelos]');
segm.insertAdjacentHTML('beforeend', D.modelos.map((m) => `<button type="button" role="radio" data-id="${m.id}">
  <span class="button-sm">${m.nombre}</span><span class="caption-5">${m.algoritmo} · ${m.unidad}</span></button>`).join(''));
function moverPastilla(cont, pastilla, activo) {
  if (!activo) return;
  pastilla.style.width = `${activo.offsetWidth}px`;
  pastilla.style.transform = `translateX(${activo.offsetLeft}px)`;
}
segm.addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]'); if (!b || b.dataset.id === est.m.id) return;
  parar();
  const previo = anioAct().anio;
  est.m = D.modelos.find((m) => m.id === b.dataset.id);
  const j = est.m.anios.findIndex((a) => a.anio === previo);
  est.i = j >= 0 ? j : est.m.anios.findIndex((a) => a.origen === 'prueba');
  render(true);
});
segm.addEventListener('keydown', (e) => teclasRadio(e, segm, '[data-id]'));

const anios = $('[data-anios]');
anios.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { parar(); est.i = Number(b.dataset.k); render(); } });
anios.addEventListener('keydown', (e) => teclasRadio(e, anios, '[data-k]'));
document.querySelectorAll('[data-paso]').forEach((b) => b.addEventListener('click', () => { parar(); mover(Number(b.dataset.paso)); }));
function mover(dx) { const n = est.i + dx; if (n >= 0 && n < est.m.anios.length) { est.i = n; render(); } }
function teclasRadio(e, cont, sel) {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  const bs = [...cont.querySelectorAll(sel)], k = bs.indexOf(cont.querySelector('[aria-checked="true"]'));
  const n = bs[Math.max(0, Math.min(bs.length - 1, k + (e.key === 'ArrowRight' ? 1 : -1)))];
  n.click(); n.focus();
}
const playBtn = $('[data-play]');
playBtn.addEventListener('click', () => {
  if (est.play) { parar(); return; }
  if (est.i === est.m.anios.length - 1) est.i = 0;
  est.play = setInterval(() => { if (est.i >= est.m.anios.length - 1) parar(); else mover(1); }, 1500);
  pintarPlay(); render();
});
function parar() { if (est.play) { clearInterval(est.play); est.play = null; pintarPlay(); } }
function pintarPlay() {
  playBtn.setAttribute('aria-pressed', String(!!est.play));
  playBtn.innerHTML = `<i data-icon="${est.play ? 'pause' : 'play'}"></i><span>${est.play ? 'Pausar' : 'Recorrer años'}</span>`;
  ponerIconos(playBtn);
}

// ---------- Ranking (filas que se reordenan con transform) ----------
const lista = $('[data-ranking]');
lista.innerHTML = CODIGOS.map((c) => `<li data-c="${c}"><button type="button" class="fila" data-c="${c}">
  <span class="fila-pos caption-4 num"></span><span class="fila-nom body-5">${esc(NOMBRE[c])}</span>
  <span class="fila-pista" aria-hidden="true"><span class="fila-barra"></span></span><span class="fila-val body-5 num"></span></button></li>`).join('');
const filas = new Map([...lista.querySelectorAll('li')].map((li) => [Number(li.dataset.c), li]));
lista.addEventListener('click', (e) => { const b = e.target.closest('.fila'); if (b) { const c = Number(b.dataset.c); seleccionar(est.sel === c ? null : c); } });
lista.addEventListener('pointerover', (e) => { const b = e.target.closest('.fila'); enfocar(b ? Number(b.dataset.c) : null); });
lista.addEventListener('pointerleave', () => enfocar(null));

function enfocar(c) {
  if (c === est.foco) return; est.foco = c;
  filas.forEach((li, k) => li.firstElementChild.classList.toggle('foco', k === c));
}
function seleccionar(c) {
  est.sel = c;
  filas.forEach((li, k) => { li.firstElementChild.classList.toggle('sel', k === c); li.firstElementChild.setAttribute('aria-pressed', String(k === c)); });
  mapa.setSeleccion(c);
  if (c) mapa.enfocarRegion(c); else mapa.vista('general');
  document.querySelectorAll('.vistas .chip').forEach((x) => x.setAttribute('aria-pressed', String(!c && x.dataset.vista === 'general')));
  detalle();
}

// ---------- KPIs ----------
function kpis() {
  const m = est.m, a = anioAct(), xs = [...a.valores].map(([c, x]) => ({ c, ...x }));
  let items;
  if (m.escala === 'divergente') {
    const o = [...xs].sort((p, q) => q.v - p.v), sk = m.skill[a.anio];
    // En la proyección no hay skill (no hay dato con qué comparar): se muestra cuánto acumula la RM desde 2023.
    const rmAcum = m.anios.filter((y) => y.origen === 'proyeccion' && y.anio <= a.anio).reduce((s, y) => s + (y.valores.get(13)?.v ?? 0), 0);
    items = [
      { l: 'Región que más gana', v: o[0].v, f: (x) => fmt(m, x), sub: NOMBRE[o[0].c] },
      { l: 'Región que más pierde', v: o.at(-1).v, f: (x) => fmt(m, x), sub: NOMBRE[o.at(-1).c] },
      a.origen === 'proyeccion'
        ? { l: 'Cambio acumulado de la RM desde 2023', v: rmAcum, f: (x) => fmt(m, x), sub: 'escenario con condiciones promedio 2021-2023' }
        : { l: `Skill en la prueba ${a.anio}`, v: sk ?? 0, f: (x) => fmtNum(x, 3, true), sub: 'frente a repetir el año anterior' }
    ];
  } else {
    const tot = xs.reduce((s, x) => s + x.v, 0), rm = xs.find((x) => x.c === 13).v / tot;
    const base = m.anios.find((x) => x.anio === 2023), obs23 = [...base.valores.values()].reduce((s, x) => s + x.obs, 0);
    const tercero = a.origen === 'prueba'
      ? { l: 'Error del total frente al dato', v: (tot - obs23) / obs23 * 100, f: (x) => `${fmtNum(x, 1, true)} %`, sub: `dato registrado ${fmtNum(obs23)} personas` }
      : a.origen === 'proyeccion'
        ? { l: 'Crecimiento desde 2023', v: (tot / obs23 - 1) * 100, f: (x) => `${fmtNum(x, 1, true)} %`, sub: 'escenario techo, no pronóstico central' }
        : { l: 'Skill del modelo en 2023', v: m.skill[2023], f: (x) => fmtNum(x, 3, true), sub: 'frente a repetir el año anterior' };
    items = [
      { l: `Total nacional ${a.anio}`, v: tot, f: (x) => fmtNum(x), sub: 'personas inmigrantes' },
      { l: 'Parte de la Región Metropolitana', v: rm * 100, f: (x) => `${fmtNum(x, 1)} %`, sub: 'del total nacional' },
      tercero
    ];
  }
  const cont = $('[data-kpis]');
  if (!cont.querySelector('.kpi-valor')) cont.innerHTML = items.map(() => `<div class="kpi tarjeta"><p class="caption-4 tenue"></p><p class="kpi-valor num"></p><p class="caption-5 tenue"></p></div>`).join('');
  [...cont.children].forEach((k, j) => {
    const it = items[j];
    k.children[0].textContent = it.l; k.children[2].textContent = it.sub;
    k.children[1].className = `kpi-valor num ${m.escala === 'divergente' && it.v < 0 ? 'neg' : a.origen}`;
    if (k.dataset.m !== m.id + j) { k.dataset.m = m.id + j; delete k.children[1].dataset.v; }
    contar(k.children[1], it.v, it.f);
  });
}

// ---------- Detalle de región ----------
function detalle() {
  const box = $('[data-detalle]'), c = est.sel;
  box.hidden = !c; if (!c) return;
  const m = est.m, a = anioAct(), x = a.valores.get(c), e = escala(m);
  const orden = [...a.valores].sort((p, q) => q[1].v - p[1].v).findIndex(([k]) => k === c) + 1;
  const datos = [`<div><span class="caption-4 tenue">Puesto</span><span class="body-4 num">${orden} de 16</span></div>`];
  if (x?.obs != null) datos.push(`<div><span class="caption-4 tenue">Dato registrado</span><span class="body-4 num">${esc(fmt(m, x.obs))}</span></div>`,
    `<div><span class="caption-4 tenue">Error del modelo</span><span class="body-4 num">${esc(fmt(m, x.v - x.obs))}</span></div>`);
  box.innerHTML = `<div class="detalle-cabeza"><div><p class="caption-4 tenue">${a.anio} · ${m.nombre}</p><h3 class="heading-5">${esc(NOMBRE[c])}</h3></div>
      <button class="boton-icono" type="button" data-cerrar aria-label="Cerrar detalle"><i data-icon="x"></i></button></div>
    <div><p class="detalle-valor num">${x ? esc(fmt(m, x.v)) : 'Sin dato'}</p><span class="etiqueta caption-4 ${a.origen}">${origen(m, a)}</span></div>
    <div class="detalle-datos">${datos.join('')}</div>
    <ol class="serie" aria-label="Valor por año">${m.anios.map((y, k) => {
      const v = y.valores.get(c)?.v, t = v == null ? 0 : e.t(v);
      return `<li class="${k === est.i ? 'ahora' : ''} ${v < 0 ? 'neg' : ''}"><button type="button" data-k="${k}" aria-label="${y.anio}: ${v == null ? 'sin dato' : esc(fmt(m, v))}">
        <i style="--h:${Math.max(0.04, t).toFixed(3)};--c:${color(m, y, v ?? 0, t)}"></i></button><span class="caption-5 num">${y.anio}</span></li>`;
    }).join('')}</ol>`;
  ponerIconos(box);
}
$('[data-detalle]').addEventListener('click', (e) => {
  if (e.target.closest('[data-cerrar]')) { const c = est.sel; seleccionar(null); filas.get(c)?.firstElementChild.focus(); return; }
  const b = e.target.closest('[data-k]'); if (b) { parar(); est.i = Number(b.dataset.k); render(); }
});

// ---------- Render ----------
function render(cambioModelo = false) {
  const m = est.m, a = anioAct(), e = escala(m);
  // Modelo
  segm.querySelectorAll('[data-id]').forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.id === m.id)); b.tabIndex = b.dataset.id === m.id ? 0 : -1; });
  moverPastilla(segm, $('.segmentado-pastilla'), segm.querySelector('[aria-checked="true"]'));
  // Años
  if (cambioModelo || !anios.querySelector('[data-k]')) {
    anios.querySelectorAll('[data-k]').forEach((b) => b.remove());
    anios.insertAdjacentHTML('beforeend', m.anios.map((y, k) => `<button type="button" role="radio" class="${y.origen}" data-k="${k}">
      <span class="button-sm num">${y.anio}</span><span class="origen caption-5">${y.origen === 'proyeccion' ? 'proyección' : y.origen}</span></button>`).join(''));
  }
  anios.querySelectorAll('[data-k]').forEach((b) => { const on = Number(b.dataset.k) === est.i; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  const activo = anios.querySelector('[aria-checked="true"]');
  moverPastilla(anios, $('.anios-pastilla'), activo);
  if (anios.scrollWidth > anios.clientWidth) anios.scrollTo({ left: activo.offsetLeft - anios.clientWidth / 2 + activo.offsetWidth / 2, behavior: reducido ? 'auto' : 'smooth' });
  document.querySelector('[data-paso="-1"]').disabled = est.i === 0;
  document.querySelector('[data-paso="1"]').disabled = est.i === m.anios.length - 1;
  $('[data-pregunta]').innerHTML = `<i data-icon>${icono('info')}</i><span>${m.pregunta} <span class="tenue">${a.anio}: ${origen(m, a).toLowerCase()}.</span></span>`;

  // Mapa
  const datosMapa = new Map();
  for (const c of CODIGOS) { const x = a.valores.get(c); datosMapa.set(c, x ? { t: Math.max(0.03, e.t(x.v)), color: color(m, a, x.v, e.t(x.v)) } : null); }
  mapa.actualizar(datosMapa, { ms: 700 });

  // Leyenda
  const rampa = m.escala === 'divergente' ? [...PIERDE].reverse().concat(GANA.slice(1)) : a.origen === 'proyeccion' ? PROY : SEC;
  $('[data-leyenda]').innerHTML = `<div class="leyenda-barra" style="background:linear-gradient(90deg,${rampa.join(',')})"></div>
    <div class="leyenda-ext caption-5 num">${m.escala === 'divergente'
      ? `<span>pierde ${esc(fmt(m, -e.max))}</span><span>0</span><span>gana ${esc(fmt(m, e.max))}</span>`
      : `<span>${fmtNum(e.min)}</span><span>escala logarítmica</span><span>${fmtNum(e.max)} personas</span>`}</div>`;

  // Ranking
  lista.classList.toggle('div', m.escala === 'divergente');
  const orden = [...a.valores].sort((p, q) => q[1].v - p[1].v);
  const alto = innerWidth <= 720 ? 56 : 40;
  orden.forEach(([c, x], k) => {
    const li = filas.get(c), b = li.firstElementChild;
    li.style.transform = `translateY(${k * alto}px)`;
    b.querySelector('.fila-pos').textContent = k + 1;
    const barra = b.querySelector('.fila-barra'), t = e.t(x.v);
    barra.classList.toggle('neg', x.v < 0);
    barra.style.setProperty('--x', Math.max(0.02, t).toFixed(3));
    barra.style.setProperty('--c', color(m, a, x.v, Math.max(0.35, t)));
    const val = b.querySelector('.fila-val');
    if (cambioModelo) delete val.dataset.v;
    contar(val, x.v, (y) => fmtNum(y, m.decimales, m.escala === 'divergente'));
    b.setAttribute('aria-label', `${k + 1}. ${NOMBRE[c]}: ${fmt(m, x.v)}`);
  });
  $('[data-ranking-nota]').textContent = `${m.unidad === 'pp' ? 'Puntos porcentuales' : 'Personas'} · ${a.anio}`;
  kpis(); detalle();
}

addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, [role="radiogroup"]')) return;
  if (e.key === 'Escape' && est.sel) seleccionar(null);
});
let rz; addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { render(); if (!est.sel) mapa.vista('general', 0); }); });

// ---------- Evidencia: skill por algoritmo, directo de las métricas ----------
{
  const NOM = { regresion_lineal: 'Regresión lineal', lineal: 'Regresión lineal', random_forest: 'Random Forest', gradient_boosting: 'Gradient Boosting', gradient_boosting_6: 'Gradient Boosting · 6 var.', gradient_boosting_5: 'Gradient Boosting · 5 var.', knn_5: 'KNN (k = 5)' };
  const bloque = (titulo, sub, filasM, elegido) => {
    const mn = Math.min(0, ...filasM.map((f) => f.skill)), mx = Math.max(1, ...filasM.map((f) => f.skill));
    const cero = (-mn / (mx - mn)) * 100;
    return `<div class="tarjeta"><div><h3 class="heading-6">${titulo}</h3><p class="caption-2 tenue">${sub}</p></div>
      <ul class="barras" style="--cero:${cero.toFixed(1)}%">${[...filasM].sort((a, b) => b.skill - a.skill).map((f) => {
        const neg = f.skill < 0, x = neg ? f.skill / mn : f.skill / mx;
        return `<li class="${f.modelo === elegido ? 'elegido' : ''}"><span class="body-6">${NOM[f.modelo] ?? f.modelo}</span>
          <span class="pista"><span class="b ${neg ? 'neg' : ''}" style="--x:${Math.min(1, Math.abs(x)).toFixed(3)}"></span></span><span class="body-5 num">${fmtNum(f.skill, 3, true)}</span></li>`;
      }).join('')}</ul><p class="caption-5 tenue">La línea vertical es cero: repetir el año anterior.</p></div>`;
  };
  $('[data-evidencia]').innerHTML =
    bloque('Conteo de personas', 'Prueba 2023 · el elegido en verde', D.comparacion.conteo, 'random_forest') +
    bloque('Distribución entre regiones', 'Prueba 2023 · el modelo final usa 5 variables', D.comparacion.distribucion, 'gradient_boosting_5');
}

// ---------- Descargas ----------
const NOMBRES = { conteoPrueba: 'Conteo · prueba 2023', conteoProy: 'Conteo · proyección 2024 a 2028', conteoMet: 'Conteo · métricas', gbPred: 'Distribución · predicciones', gbMet: 'Distribución · comparación de algoritmos', gb5: 'Distribución · métricas del modelo final', gbProy: 'Distribución · proyección 2024 a 2028' };
$('[data-descargas]').innerHTML = Object.entries(ARCHIVOS).map(([k, r]) => `<li><a class="caption-1" href="./${r}" download><i data-icon>${icono('download-simple')}</i>${NOMBRES[k]}</a></li>`).join('');

render(true);
mapa.vista('general', 0);

/* LANDING — GLOBO
THESIS: antes del pronóstico, la Tierra vista desde lejos, con corrientes de viento animadas (a la manera de earth.nullschool.net); un clic baja hasta Chile y el globo se convierte en el mapa del tiempo. Rechaza el hero con foto y botón centrado.
OWN-WORLD: noche azul profunda; globo ortográfico con costas finas; trazos de viento que se desvanecen; Chile marcado en el globo; tipografía Archivo del mundo Pronóstico; lectura de coordenadas bajo el cursor.
STORY: el visitante ve el planeta moverse, lee el título del trabajo, presiona "Empezar recorrido" y viaja hasta Chile, donde aparece el mapa interactivo.
FIRST VIEWPORT: título del trabajo arriba a la izquierda; globo grande centrado algo bajo; botón abajo a la izquierda; coordenadas abajo a la derecha.
FORM: extensión del mundo Pronóstico (propuesta 2 elegida por el usuario), seed e728d33b.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md */
import './landing.css';
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoArea, geoInterpolate } from 'd3-geo';
import { feature } from 'topojson-client';
import tierra from 'world-atlas/land-110m.json';
import { geo } from '../motor/core.js';

// Edita aquí el título y la línea de autoría del trabajo.
export const TRABAJO = {
  titulo: 'Predicción de la concentración de población inmigrante por región en Chile',
  linea: 'Trabajo de Título · Modelos de aprendizaje automático · 16 regiones'
};

const VIENTO = ['#2f5f9e', '#3f8fb0', '#6cc3b4', '#cfe9c8', '#f5e9b0', '#f3b562'];

export function montarLanding(raiz, { alEmpezar }) {
  raiz.innerHTML = `
  <section class="ld" aria-labelledby="ld-titulo">
    <canvas class="ld-globo" aria-hidden="true"></canvas>
    <canvas class="ld-viento" aria-hidden="true"></canvas>
    <header class="ld-cab">
      <h1 id="ld-titulo">${TRABAJO.titulo}</h1>
      <p>${TRABAJO.linea}</p>
    </header>
    <div class="ld-accion">
      <button type="button" class="ld-empezar">
        <span>Empezar recorrido</span>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" /></svg>
      </button>
      <p class="ld-ayuda">Arrastra para girar el globo</p>
    </div>
    <p class="ld-coord" aria-hidden="true"><span class="ld-lat"></span><span class="ld-lon"></span></p>
    <p class="ld-nota">Viento animado con fines ilustrativos, no son datos meteorológicos.</p>
    <div class="ld-velo" aria-hidden="true"></div>
  </section>`;
  const $ = (s) => raiz.querySelector(s);
  const cGlobo = $('.ld-globo'), cViento = $('.ld-viento');
  const gG = cGlobo.getContext('2d'), gV = cViento.getContext('2d');
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Geografía ----
  const land = feature(tierra, tierra.objects.land);
  const sanear = (anillo) => { // d3 espera anillos exteriores en sentido horario
    const f = { type: 'Polygon', coordinates: [anillo] };
    return geoArea(f) > 2 * Math.PI ? [...anillo].reverse() : anillo;
  };
  const chile = {
    type: 'FeatureCollection',
    features: geo.regiones.map((r) => ({ type: 'Feature', properties: { c: r.codigo },
      geometry: { type: 'MultiPolygon', coordinates: r.poligonos.map((p) => p.map((a) => sanear([...a, a[0]]))) } }))
  };
  const reticula = geoGraticule10();

  // ---- Proyección ----
  const proy = geoOrthographic().clipAngle(90).precision(0.4);
  let W = 1, H = 1, dpr = 1;
  const vista = { rot: [62, 18, 0], escala: 1, cx: 0, cy: 0 };
  function base() { return Math.min(W, H) * (W < 720 ? 0.44 : 0.42); }
  function medir() {
    dpr = Math.min(devicePixelRatio, 2);
    W = innerWidth; H = innerHeight;
    for (const c of [cGlobo, cViento]) { c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; }
    gG.setTransform(dpr, 0, 0, dpr, 0, 0); gV.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!transicion) { vista.cx = W < 720 ? W / 2 : W * 0.62; vista.cy = H * (W < 720 ? 0.56 : 0.54); }
    sucio = true; limpiarViento();
  }
  const aplicar = () => proy.rotate(vista.rot).scale(base() * vista.escala).translate([vista.cx, vista.cy]);

  // ---- Dibujo del globo (solo cuando cambia la vista) ----
  let sucio = true, colorChile = 0, rellenos = null;
  function dibujarGlobo() {
    aplicar();
    const p = geoPath(proy, gG);
    gG.clearRect(0, 0, W, H);
    const r = proy.scale();
    // halo atmosférico
    const halo = gG.createRadialGradient(vista.cx, vista.cy, r * 0.96, vista.cx, vista.cy, r * 1.18);
    halo.addColorStop(0, 'rgba(90,150,230,.28)'); halo.addColorStop(1, 'rgba(90,150,230,0)');
    gG.fillStyle = halo; gG.beginPath(); gG.arc(vista.cx, vista.cy, r * 1.18, 0, Math.PI * 2); gG.fill();
    // océano
    gG.beginPath(); p({ type: 'Sphere' });
    const mar = gG.createRadialGradient(vista.cx - r * 0.35, vista.cy - r * 0.4, r * 0.1, vista.cx, vista.cy, r);
    mar.addColorStop(0, '#12305c'); mar.addColorStop(1, '#07142b');
    gG.fillStyle = mar; gG.fill();
    gG.beginPath(); p(reticula); gG.strokeStyle = 'rgba(140,180,230,.10)'; gG.lineWidth = 0.7; gG.stroke();
    gG.beginPath(); p(land); gG.fillStyle = 'rgba(28,52,92,.9)'; gG.fill();
    gG.strokeStyle = 'rgba(210,228,255,.55)'; gG.lineWidth = 0.8; gG.stroke();
    // Chile: contorno, y en la llegada se rellena con los colores del pronóstico
    for (const f of chile.features) {
      gG.beginPath(); p(f);
      if (rellenos && colorChile > 0) { gG.globalAlpha = colorChile; gG.fillStyle = rellenos.get(f.properties.c) ?? '#f7ecc2'; gG.fill(); gG.globalAlpha = 1; }
      gG.strokeStyle = colorChile > 0 ? `rgba(255,255,255,${0.5 + colorChile * 0.4})` : 'rgba(243,181,98,.85)';
      gG.lineWidth = colorChile > 0 ? 0.8 : 1.1; gG.stroke();
    }
    gG.beginPath(); p({ type: 'Sphere' }); gG.strokeStyle = 'rgba(160,200,255,.35)'; gG.lineWidth = 1; gG.stroke();
    sucio = false;
  }

  // ---- Viento: campo de flujo sintético sobre la esfera ----
  const N = innerWidth < 720 ? 1400 : 3200;
  const parts = Array.from({ length: N }, () => nueva({}));
  function nueva(q) { q.lon = Math.random() * 360 - 180; q.lat = Math.asin(Math.random() * 2 - 1) * 180 / Math.PI; q.vida = 40 + Math.random() * 80; return q; }
  function campo(lon, lat, t) {
    const f = lat * Math.PI / 180, l = lon * Math.PI / 180;
    // alisios en el trópico, oestes en latitudes medias, más remolinos suaves
    let u = -Math.cos(3 * f) * 0.9 + 0.55 * Math.sin(3 * l + 2 * f + t) + 0.35 * Math.sin(5 * l - 3 * f - t * 0.6);
    let v = 0.45 * Math.cos(2.3 * l - 3 * f + t * 0.7) + 0.3 * Math.sin(4 * l + 5 * f - t * 0.4);
    if (lat < -38 && lat > -62) u += 0.9; // corriente de los oestes del sur, la que llega a Chile
    return [u, v];
  }
  function limpiarViento() { gV.clearRect(0, 0, W, H); }
  let t = 0;
  function pasoViento() {
    const centro = [-vista.rot[0], -vista.rot[1]];
    gV.globalCompositeOperation = 'destination-in';
    gV.fillStyle = 'rgba(0,0,0,0.92)'; gV.fillRect(0, 0, W, H);
    gV.globalCompositeOperation = 'source-over';
    gV.lineWidth = W < 720 ? 0.9 : 1.1;
    const lotes = VIENTO.map(() => []);
    const k = 0.22;
    t += 0.004;
    for (const q of parts) {
      const [u, v] = campo(q.lon, q.lat, t);
      const lon2 = q.lon + (u * k) / Math.max(0.2, Math.cos(q.lat * Math.PI / 180)), lat2 = q.lat + v * k;
      if (--q.vida < 0 || Math.abs(lat2) > 84) { nueva(q); continue; }
      if (geoDistance([q.lon, q.lat], centro) < 1.5 && geoDistance([lon2, lat2], centro) < 1.5) {
        const a = proy([q.lon, q.lat]), b = proy([lon2, lat2]);
        if (a && b) lotes[Math.min(VIENTO.length - 1, Math.floor(Math.hypot(u, v) * 2.6))].push(a[0], a[1], b[0], b[1]);
      }
      q.lon = ((lon2 + 540) % 360) - 180; q.lat = lat2;
    }
    lotes.forEach((s, i) => {
      if (!s.length) return;
      gV.beginPath();
      for (let j = 0; j < s.length; j += 4) { gV.moveTo(s[j], s[j + 1]); gV.lineTo(s[j + 2], s[j + 3]); }
      gV.strokeStyle = VIENTO[i]; gV.globalAlpha = 0.85; gV.stroke(); gV.globalAlpha = 1;
    });
  }

  // ---- Interacción: arrastrar para girar, coordenadas bajo el cursor ----
  let arrastre = null, ultimoToque = performance.now();
  cViento.style.pointerEvents = 'none';
  cGlobo.addEventListener('pointerdown', (e) => { if (transicion) return; arrastre = { x: e.clientX, y: e.clientY, rot: [...vista.rot] }; cGlobo.setPointerCapture(e.pointerId); });
  cGlobo.addEventListener('pointermove', (e) => {
    const ll = proy.invert?.([e.clientX, e.clientY]);
    const dentro = ll && geoDistance(ll, [-vista.rot[0], -vista.rot[1]]) < Math.PI / 2;
    $('.ld-lat').textContent = dentro ? `${Math.abs(ll[1]).toFixed(2)}° ${ll[1] < 0 ? 'S' : 'N'}` : '';
    $('.ld-lon').textContent = dentro ? `${Math.abs(ll[0]).toFixed(2)}° ${ll[0] < 0 ? 'O' : 'E'}` : '';
    if (!arrastre) return;
    const k = 90 / (base() * vista.escala);
    vista.rot = [arrastre.rot[0] + (e.clientX - arrastre.x) * k, Math.max(-70, Math.min(70, arrastre.rot[1] - (e.clientY - arrastre.y) * k)), 0];
    sucio = true; limpiarViento(); ultimoToque = performance.now();
  });
  const soltar = () => { arrastre = null; ultimoToque = performance.now(); };
  cGlobo.addEventListener('pointerup', soltar); cGlobo.addEventListener('pointercancel', soltar);

  // ---- Bucle ----
  let vivo = true, transicion = null;
  function cuadro(ahora) {
    if (!vivo) return;
    if (transicion) avanzarTransicion(ahora);
    else if (!arrastre && !reducido && ahora - ultimoToque > 1800) { vista.rot[0] += 0.045; sucio = true; }
    if (sucio) { dibujarGlobo(); if (arrastre) limpiarViento(); }
    // Durante el viaje el viento se apaga (como en earth.nullschool al mover el globo).
    if (transicion) { if (!transicion.sinViento) { limpiarViento(); transicion.sinViento = true; } }
    else if (!reducido) pasoViento();
    requestAnimationFrame(cuadro);
  }

  // ---- Transición: viajar a Chile y entregar al mapa ----
  const suave = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function avanzarTransicion(ahora) {
    const tr = transicion, k = Math.min(1, (ahora - tr.t0) / tr.ms), s = suave(k);
    const centro = tr.interp(s);
    vista.rot = [-centro[0], -centro[1], 0];
    vista.escala = tr.e0 + (tr.e1 - tr.e0) * s;
    vista.cx = tr.x0 + (tr.x1 - tr.x0) * s; vista.cy = tr.y0 + (tr.y1 - tr.y0) * s;
    colorChile = Math.max(0, (k - 0.55) / 0.45);
    sucio = true;
    if (k >= 1 && !tr.listo) { tr.listo = true; tr.fin(); }
  }

  medir(); addEventListener('resize', medir);
  requestAnimationFrame(cuadro);

  $('.ld-empezar').addEventListener('click', () => {
    if (transicion) return;
    raiz.querySelector('.ld').classList.add('saliendo');
    alEmpezar({
      /** El mapa entrega dónde quedará Chile en pantalla y los colores de cada región. */
      viajar({ cx, cy, altoChile, colores }, fin) {
        rellenos = colores;
        const centro = [-vista.rot[0], -vista.rot[1]];
        const destino = [-71.5, -37.5];
        // Chile ocupa ~0,68 rad de latitud; elegimos la escala para que mida altoChile px.
        const e1 = altoChile / (0.68 * base());
        transicion = { t0: performance.now(), ms: reducido ? 1 : 2600, interp: geoInterpolate(centro, destino),
          e0: vista.escala, e1, x0: vista.cx, x1: cx, y0: vista.cy, y1: cy, fin };
      },
      cerrar() { vivo = false; raiz.querySelector('.ld')?.classList.add('fuera'); setTimeout(() => raiz.remove(), 900); }
    });
  });
  return { destruir() { vivo = false; removeEventListener('resize', medir); raiz.innerHTML = ''; } };
}

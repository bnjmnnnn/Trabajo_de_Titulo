// vuelo.html — recorrido scrubbeado por scroll (motor scroll-world) con clips renderizados por HyperFrames
// (videos/vuelo-chile). El texto de cada zona se calcula de los CSV de modelos/.
import { mountScrollWorld } from './scroll-world.js';
import { cargarModelos } from '../resultados/datos.js';
import { NOMBRE } from '../motor/core.js';

// Mismas zonas y orden que la composición (videos/vuelo-chile/index.html)
const ZONAS = [
  { id: 'norte-grande', nombre: 'Norte grande', reg: [15, 1, 2] },
  { id: 'norte-chico', nombre: 'Norte chico', reg: [3, 4] },
  { id: 'santiago', nombre: 'Santiago y Valparaíso', reg: [13, 5] },
  { id: 'centro-sur', nombre: 'Centro sur', reg: [6, 7, 16, 8] },
  { id: 'sur', nombre: 'Sur', reg: [9, 14, 10] },
  { id: 'austral', nombre: 'Austral', reg: [11, 12] }
];
const ACENTO = ['#0f766e', '#0f766e', '#0b4a45', '#0f766e', '#0f766e', '#0f766e'];
const n = (x) => Math.round(x).toLocaleString('es-CL');
const pct = (x) => (x * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 });

try {
  const { modelos: [conteo] } = await cargarModelos();
  // Dato registrado 2023 (columna estimation del CSV de prueba del modelo de conteo)
  const reg23 = new Map([...conteo.anios.find((a) => a.anio === 2023).valores].map(([c, x]) => [c, x.obs]));
  const proy = conteo.anios.at(-1);
  const total = [...reg23.values()].reduce((s, v) => s + v, 0);

  const sections = ZONAS.map((z, i) => {
    const suma = z.reg.reduce((s, c) => s + reg23.get(c), 0);
    const mayor = [...z.reg].sort((a, b) => reg23.get(b) - reg23.get(a))[0];
    const suma28 = z.reg.reduce((s, c) => s + proy.valores.get(c).v, 0);
    const sec = {
      id: z.id, label: z.nombre,
      still: `./vuelo/${z.id}.jpg`, clip: `./vuelo/${z.id}.mp4`, clipMobile: `./vuelo/${z.id}-m.mp4`,
      accent: ACENTO[i],
      eyebrow: `${z.nombre} · 2023`,
      title: `${n(suma)} personas inmigrantes`,
      body: `${pct(suma / total)} % del total nacional. ${NOMBRE[mayor]} concentra la mayor parte de la zona. En el escenario techo del modelo, la zona llegaría a ${n(suma28)} personas en ${proy.anio}.`,
      tags: z.reg.map((c) => `${NOMBRE[c]} ${n(reg23.get(c))}`)
    };
    if (i === 0) {
      sec.eyebrow = 'Recorrido de norte a sur · dato registrado 2023';
      sec.title = 'Dónde vive la población inmigrante de Chile';
      sec.body = `${n(total)} personas en 16 regiones. Cada región se eleva según cuántas viven en ella. Empieza en el ${z.nombre.toLowerCase()}: ${n(suma)} personas, ${pct(suma / total)} % del país.`;
    }
    if (i === ZONAS.length - 1) {
      sec.cta = { primary: { label: 'Explorar las predicciones', href: './#explorar' },
        secondary: { label: 'Ver la evidencia', href: './#evidencia' } };
    }
    return sec;
  });

  mountScrollWorld(document.getElementById('world'), {
    nav: false, atmosphere: false, hint: 'Desplázate para recorrer Chile',
    diveScroll: 1.4, connScroll: 0.8, sections,
    connectors: ZONAS.slice(0, -1).map((z, i) => `./vuelo/conector-${i + 1}.mp4`),
    connectorsMobile: ZONAS.slice(0, -1).map((z, i) => `./vuelo/conector-${i + 1}-m.mp4`)
  });
} catch (err) {
  const e = document.querySelector('.estado');
  e.hidden = false;
  e.textContent = `No se pudieron leer los datos del recorrido: ${err.message}. Recarga la página o abre los resultados.`;
}

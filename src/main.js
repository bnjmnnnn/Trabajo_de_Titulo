// main.js — recorrido: globo (landing) → mapa Pronóstico.
// ?p=1 (Emisión) y ?p=3 (Carta) siguen disponibles para comparar; ?p=2 abre el mapa directo.
import './comun.css';
const PROPUESTAS = {
  1: () => import('./propuestas/emision.js'),
  2: () => import('./propuestas/pronostico.js'),
  3: () => import('./propuestas/carta.js')
};
const p = new URLSearchParams(location.search).get('p');
const app = document.getElementById('app');

if (PROPUESTAS[p]) {
  document.documentElement.dataset.propuesta = p;
  const nav = document.querySelector('.propuestas');
  nav.hidden = false;
  nav.querySelector(`[data-p="${p}"]`)?.setAttribute('aria-current', 'page');
  PROPUESTAS[p]().then((m) => m.iniciar(app));
} else {
  document.documentElement.dataset.propuesta = '2';
  const capa = document.createElement('div');
  document.body.append(capa);
  // El mapa se prepara debajo, invisible, mientras se ve el globo.
  const mapa = import('./propuestas/pronostico.js').then((m) => m.iniciar(app, { entrada: true }));
  import('./landing/landing.js').then(({ montarLanding }) => {
    montarLanding(capa, {
      async alEmpezar(landing) {
        const llegada = await mapa;
        landing.viajar(llegada.llegada(), () => { llegada.revelar(); landing.cerrar(); });
      }
    });
  });
}

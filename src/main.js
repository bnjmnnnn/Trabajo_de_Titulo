// main.js — recorrido: globo (landing) → mapa Pronóstico. ?p=2 abre el mapa directo.
import './comun.css';
const app = document.getElementById('app');
document.documentElement.dataset.propuesta = '2';

if (new URLSearchParams(location.search).get('p') === '2') {
  import('./propuestas/pronostico.js').then((m) => m.iniciar(app));
} else {
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

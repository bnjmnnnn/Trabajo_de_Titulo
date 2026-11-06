# Modelos de predicción de conteo y distribución de inmigrantes

Sitio del Trabajo de Título: presenta los resultados de dos modelos que estiman la población inmigrante
por región en Chile, para la comisión y para quienes diseñan política pública.

## Páginas
| Página | Qué es |
| :-- | :-- |
| `index.html` | **Portada.** Explorador reactivo de los dos modelos (conteo y distribución) por año, con mapa 3D, ranking, cifras clave y detalle por región; evidencia, cómo funciona y preguntas frecuentes. |
| `vuelo.html` | Recorrido scrubbeado por scroll de norte a sur (motor scroll-world), con clips renderizados con HyperFrames en `videos/vuelo-chile/`. |
| `pliego.html` | Propuesta alternativa con estética de Lira Popular. |
| `globo.html` | Diseño anterior (globo nocturno y mapa tipo pronóstico), conservado como referencia. `?p=2` abre el mapa directo. |

## Datos
La portada y el recorrido leen en vivo los CSV de `modelos/` (ver `modelos/README.md`). Si se reentrenan los
modelos y se reemplazan esos archivos, la página muestra los nuevos resultados sin cambiar código.
El build copia los CSV y JSON a `dist/modelos/` y además guarda una copia de respaldo dentro del JavaScript,
que se usa solo si la página no puede pedir los archivos (por ejemplo, el build de un solo archivo).

El video del recorrido sí hay que regenerarlo cuando cambian los datos:
```bash
node videos/vuelo-chile/generar-datos.mjs
cd videos/vuelo-chile && npm run render -- -o renders/vuelo.mp4 --quality delivery
cd ../.. && node videos/vuelo-chile/cortar.mjs videos/vuelo-chile/renders/vuelo.mp4
```

## Comandos
```bash
npm run dev           # desarrollo en http://127.0.0.1:5173
npm run build         # dist/ con todas las páginas, los CSV y los clips
npm run build:single  # dist-single/index.html autocontenido (solo la portada)
```

## Notas del mapa
- Códigos de región oficiales: 15 Arica y Parinacota · 1 Tarapacá · 2 Antofagasta · 3 Atacama ·
  4 Coquimbo · 5 Valparaíso · 13 Metropolitana · 6 O'Higgins · 7 Maule · 16 Ñuble · 8 Biobío ·
  9 La Araucanía · 14 Los Ríos · 10 Los Lagos · 11 Aysén · 12 Magallanes.
- Límites regionales: BCN vía github.com/caracena/chile-geojson, simplificados (~1 km) para la web.
  Se omiten Rapa Nui, Juan Fernández y el Territorio Antártico (el valor regional se ve igual en el continente).
- La altura es una exageración visual, no una distancia. La escala es fija para todo el horizonte temporal
  (logarítmica en el conteo), así los años se pueden comparar entre sí.

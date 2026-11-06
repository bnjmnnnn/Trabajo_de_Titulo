---
workflow: general-video
flow: automation
storyboard: no
message: "De norte a sur, Chile se levanta región por región según cuántas personas inmigrantes viven en ella"
destination: web, video scrubbeado por scroll (motor scroll-world) en resultados.html
aspect: "16:9"
language: es
audience: comisión universitaria y tomadores de decisión de política pública
length: ~39 s continuos, cortados en 6 inmersiones y 5 conectores
---

## Intent
Vuelo de cámara continuo sobre un mapa 3D de Chile, de Arica a Magallanes, en 6 zonas:
Norte grande, Norte chico, Santiago, Centro sur, Sur y Austral. Al llegar a cada zona sus regiones
se elevan según la población inmigrante registrada en 2023 (modelo de conteo, columna `estimation`).
El video no lleva texto: el texto de cada zona lo pone el motor scroll-world encima, en la página.

## Assets
- Geometría: `src/data/regiones-chile.json` del repo (BCN, simplificada).
- Datos: `modelos/conteo_random_forest/predicciones_test_conteo_crecimiento.csv` (estimation 2023).

## Customizations
- Paleta de la landing: fondo #fafaf9, regiones en rampa verde azulado (#e6f4f1 → #0b4a45), bordes tinta 35 %.
- Sin audio (los clips de scroll no llevan sonido).

## Notes
- Elegido por el usuario: HyperFrames + scroll-world, sin storyboard, automático, 6 zonas.
- Seams: un solo render continuo cortado con ffmpeg en cuadros exactos, así las uniones calzan por construcción.

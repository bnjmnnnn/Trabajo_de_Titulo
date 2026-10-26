# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Público general en Chile que llega a una página web pública y quiere ver, región por región, qué predicen los modelos de Benjamín (estudiante universitario, autor del proyecto). No son especialistas en ML.

## Product Purpose
Un mapa 3D interactivo de Chile (Three.js) alimentado por las salidas de varios modelos de predicción por región (16 regiones, varios periodos). El éxito es que cualquiera entienda de un vistazo cómo se distribuye la variable predicha a lo largo del país y pueda explorar por año y por modelo.

## Positioning
El mapa es el producto: la forma larga de Chile, elevada por los datos, es lo que se ve y se recuerda. No es un dashboard.

## Capabilities and Constraints
- Alcance confirmado: "mapa + mínimo": elegir modelo y año; el detalle aparece al tocar una región. Sin paneles de dashboard.
- Datos por región (códigos oficiales 1–16), varios modelos, periodos con dato observado y proyectados, intervalos opcionales.
- Entrada de datos: JSON en `public/datos/predicciones.json` (generado con `scripts/exportar_predicciones.py` desde CSV); carga manual de CSV/JSON se mantiene.
- Stack existente: Vite + Three.js 0.180, JS vanilla. Despliegue como página estática única (destino aún no decidido).

## Brand Commitments
- Idioma: español de Chile.
- Rechazo explícito del usuario: el diseño anterior "se veía muy IA made". Evitar la estética genérica de IA.

## Evidence on Hand
- Geometría regional BCN simplificada: `src/data/regiones-chile.json`.
- Datos de ejemplo SINTÉTICOS: `src/data/ejemplo.json` (población inmigrante %, 3 modelos, 2017–2030). Deben rotularse como ejemplo; los datos reales de la tesis aún no están.
- No inventar métricas, fuentes ni afirmaciones sobre los modelos reales.

## Product Principles
1. El mapa lidera; la interfaz se retira.
2. Lo predicho se distingue siempre de lo observado.
3. Comprensible para no especialistas en segundos.
4. Honestidad con los datos: ejemplo rotulado, escala fija en el tiempo.

## Accessibility & Inclusion
Navegación por teclado, contraste AA, respeto de prefers-reduced-motion, uso cómodo en móvil.

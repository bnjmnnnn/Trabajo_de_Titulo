# PRODUCT — Atlas Predictivo Chile

## Qué es
Visualización interactiva de un Trabajo de Título: predicción de la población inmigrante por región en Chile
con modelos de aprendizaje automático. Dos modelos, cada uno con su unidad:
- **Cantidad · Conteo RF** (Random Forest): personas inmigrantes por región. Prueba 2023 (skill +0,744 contra
  persistencia) y proyección 2024–2028 que es un techo, no un pronóstico central (3.183.352 personas en 2028).
- **Redistribución · Modelo 4** (Gradient Boosting): cambio en la participación de cada región sobre el total
  (puntos porcentuales; escala divergente: gana / pierde).

16 regiones continentales, de Arica y Parinacota a Magallanes. La Metropolitana concentra ~1 de cada 2 personas.

## Audiencia y escena
- La comisión evaluadora durante la defensa, en proyector (lectura a distancia, presentación en vivo).
- Cualquier persona con el link público, en computador o celular, explorando sola.

## Lo que el visitante debe lograr
Entender en segundos dónde se concentra la población inmigrante, cómo cambia año a año, y qué es registro,
qué es prueba del modelo y qué es proyección. Comparar regiones y modelos sin perderse.

## Verdad y restricciones
- Los datos vienen de `src/data/tt1.json` (o `datos/predicciones.json`). No inventar cifras.
- Siempre distinguir registro / prueba / proyección; la proyección es un techo.
- Tema social: tratar a las personas como personas, no como "flujos" amenazantes.
- Stack: Vite + JS vanilla + Three.js + d3-geo. Sin framework.
- La propuesta actual (globo + mapa Pronóstico) se conserva intacta; las propuestas nuevas viven aparte.

## Tono pedido
Expresivo y audaz: debe impresionar al primer vistazo, con movimiento y reactividad, sin caer en el look
genérico de IA.

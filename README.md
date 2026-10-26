# Atlas Predictivo Chile — mapa 3D por región (Three.js)

Mapa interactivo de las 16 regiones de Chile. Cada región se eleva según el valor que entregan tus
modelos de predicción. Todo queda en **una sola página web** (estática) que puedes desplegar donde quieras.

## Tres propuestas de diseño
La página trae tres propuestas sobre el mismo motor 3D. Se cambia con `?p=1`, `?p=2` o `?p=3`
(o con el selector abajo a la derecha, que se elimina cuando elijas una):

1. **Emisión Chile** (`src/propuestas/emision.*`): estampilla grabada; el tramado y la altura marcan el valor; el año se cambia en el matasellos.
2. **Pronóstico** (`src/propuestas/pronostico.*`): mapa del tiempo de la TV; Chile vertical con las 16 cifras al costado y el zócalo de años.
3. **Carta** (`src/propuestas/carta.*`): carta topográfica; tintas hipsométricas, curvas de nivel y la escala gráfica como línea de tiempo.

En las tres: eliges modelo y año, y al tocar una región aparece su detalle. Teclado: ← → cambian el año, Esc cierra.
Diseño hecho con las skills impeccable, design-taste-frontend-v1 y ui-ux-pro-max (instalada en `.claude/skills/`).

## Empezar
```bash
npm install
npm run dev            # http://127.0.0.1:5173
```

## Conectar tus modelos
Exporta desde Python un CSV en formato largo:

| modelo | codigo_region | periodo | prediccion | lim_inf | lim_sup |
|---|---|---|---|---|---|
| Random Forest | 13 | 2025 | 12.4 | 11.8 | 13.1 |

`lim_inf` / `lim_sup` son opcionales. El observado va aparte: `codigo_region,periodo,valor`.
Métricas propias (opcional): `modelo,metrica,valor` (por ejemplo `XGBoost,R2,0.91`).

Códigos de región oficiales: 15 Arica y Parinacota · 1 Tarapacá · 2 Antofagasta · 3 Atacama ·
4 Coquimbo · 5 Valparaíso · 13 Metropolitana · 6 O'Higgins · 7 Maule · 16 Ñuble · 8 Biobío ·
9 La Araucanía · 14 Los Ríos · 10 Los Lagos · 11 Aysén · 12 Magallanes.

```python
# desde tu notebook
df[["modelo","codigo_region","periodo","prediccion","lim_inf","lim_sup"]].to_csv("predicciones.csv", index=False)
obs[["codigo_region","periodo","valor"]].to_csv("observado.csv", index=False)
```

Tienes dos caminos:
1. **Probar al tiro**: botón *Cargar mis predicciones…* (o arrastra los CSV/JSON sobre el mapa).
2. **Dejarlo fijo en la web**: convierte a JSON y ponlo en `public/datos/predicciones.json`:
   ```bash
   python scripts/exportar_predicciones.py --pred predicciones.csv --obs observado.csv \
     --titulo "Concentración de población inmigrante" --variable "Población inmigrante" --unidad "%"
   ```
   Al abrir la página, si existe `datos/predicciones.json` se usa; si no, se muestran los datos de ejemplo.

## Desplegar (una sola página)
```bash
npm run build          # carpeta dist/ → súbela a Vercel, Netlify o GitHub Pages
npm run build:single   # dist-single/index.html → un único archivo autocontenido
```
En Vercel: importa la carpeta/repositorio, framework “Vite”, comando `npm run build`, salida `dist`.

## Estructura
```
src/main.js              elige la propuesta (?p=1|2|3)
src/motor/mapa3d.js      motor Three.js (extrusión, shader grabado/sólido/terrazas, cámara, selección)
src/motor/core.js        utilidades comunes (datos, formato, ranking, silueta)
src/motor/datos.js       formato de datos, validación, lectura de CSV
src/propuestas/          las tres propuestas (JS + CSS)
src/data/          geometría de regiones + datos de ejemplo
scripts/           exportar_predicciones.py, generar_ejemplo.py, preparar_geo.py
.claude/skills/3dviz-pro-max/   skill instalada (MIT, github.com/viettranx/3dviz-pro-max)
```

## Datos reales de TT1
**`dist-single/index.html` es el mapa listo**: un solo archivo que abre con doble clic y trae incrustados
(desde `src/data/tt1.json`) los valores reales de los dos modelos elegidos en TT1:

- **Modelo 4 · Gradient Boosting (redistribución)**: el que le gana a la persistencia en el reparto
  territorial según el skill score de Murphy (1988): +0,648 (test 2023) y +0,694 (test 2022).
- **Conteo · Random Forest**: skill +0,744 en personas (test 2023) y proyección 2024-2028 con las
  condiciones promedio 2021-2023 (un techo, no un pronóstico central).

Todo va como % del total nacional (tasa de concentración); el observado es 2020-2023. Para regenerarlo
desde la carpeta del TT (los CSV intermedios quedan en `scripts/tt1/`):
```bash
python scripts/importar_tt1.py --tt1 ../TT1
npm run build:single
```
Si se deja un `datos/predicciones.json` junto a la página, ese archivo reemplaza a los datos incrustados.

## Notas y límites
- `src/data/ejemplo.json` es sintético: solo se usa si falta `public/datos/predicciones.json`.
- Límites regionales: BCN vía github.com/caracena/chile-geojson, simplificados (~1 km) para la web.
  Se omiten Rapa Nui, Juan Fernández y el Territorio Antártico (el valor regional se ve igual en el continente).
- La altura es una exageración visual, no una distancia. La escala de color/altura es fija para todo
  el horizonte temporal, así los años se pueden comparar entre sí.

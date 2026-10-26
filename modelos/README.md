# Modelos seleccionados

Los dos modelos de TT1 que alimentan el mapa, con sus scripts, el modelo entrenado (`.pkl`) y sus salidas.
Los archivos son copias sin cambios de [bnjmnnnn/TT1](https://github.com/bnjmnnnn/TT1)
(rama `reevaluacion-de-modelos`); el único script nuevo es `modelo_4_gradient_boosting/predecir_gb.py`.

El criterio de selección es el **skill score de Murphy (1988)** contra la persistencia (repetir el año
anterior): `skill = 1 − MSE_modelo / MSE_persistencia`. Positivo, el modelo le gana a no hacer nada.

| Rol | Modelo | Skill | Carpeta |
| :-- | :-- | :-: | :-- |
| Reparto territorial | **Modelo 4 · Gradient Boosting** sobre la redistribución | +0,648 (test 2023) · +0,694 (test 2022) | `modelo_4_gradient_boosting/` |
| Cantidad de personas | **Random Forest de conteo** (modo crecimiento) | +0,744 (test 2023) | `conteo_random_forest/` |

## Modelo 4 · Gradient Boosting (`modelo_4_gradient_boosting/`)
Predice la **redistribución**: `rate(r, t) − rate(r, t−1)`, el cambio en la participación de cada región
en el total nacional. `GradientBoostingRegressor(n_estimators=200, learning_rate=0.05, max_depth=2,
min_samples_leaf=2, random_state=42)` con las 6 variables `seleccionadas`: `sol_otorgadas_lag1`,
`sol_share_lag1`, `sol_total_lag1`, `pct_peru_lag1`, `mean_age_lag1`, `rate_lag2`.

| Archivo | Qué es |
| :-- | :-- |
| `train_modelo4.py` | Entrena y compara los 4 algoritmos; el gradient boosting es el elegido |
| `explorar_variables.py`, `probar_ronda2.py` | Arman el panel y las variables derivadas que usa `train_modelo4.py` |
| `redistribucion_gradient_boosting.pkl` | El modelo entrenado con 2021-2022 (test 2023) |
| `metricas_modelo4.csv` | Métricas de todos los algoritmos, conjuntos y años de prueba |
| `predecir_gb.py` | Tabla por región con el gradient boosting y chequeo de que el skill coincide |
| `predicciones_gb.csv` | Predicciones por región, test 2022 y 2023 (las que muestra el mapa) |

Ojo: `train_modelo4.py` escribe su tabla por región (`predicciones_redistribucion_2023.csv`) con el
**random forest**, no con el gradient boosting. Por eso existe `predecir_gb.py`.

## Conteo · Random Forest (`conteo_random_forest/`)
Predice la **cantidad de personas** por región. Entrena sobre el crecimiento `log(t / t−1)` y lo vuelve a
convertir en personas. `RandomForestRegressor(n_estimators=200, max_depth=3, min_samples_leaf=2,
random_state=42)` con 8 variables (ver `hiperparametros_conteo_crecimiento.json`).

| Archivo | Qué es |
| :-- | :-- |
| `train_conteo.py` | Entrena regresión lineal, random forest y gradient boosting con búsqueda en grilla |
| `proyectar_2024_2028.py` | Reentrena el random forest con 2021-2023 y proyecta de forma iterativa |
| `random_forest_conteo_crecimiento.pkl` | El modelo entrenado (test 2023) |
| `hiperparametros_conteo_crecimiento.json` | Variables y mejores hiperparámetros |
| `metricas_conteo_crecimiento.csv` | RMSE, MAE y R² de train y test |
| `predicciones_test_conteo_crecimiento.csv` | Predicciones por región, test 2023 |
| `proyeccion_modelo_2024_2028.csv` | Proyección por región (condiciones promedio 2021-2023). Es un **techo**, no un pronóstico central |
| `proyeccion_modelo_por_region.csv` | Proyección 2028 comparada con la tendencia log-lineal |

## Cómo correrlos
Los scripts leen datos y módulos con rutas relativas a la raíz de TT1 (`src/common/config.py`, el panel
`src/modelo_2_regional_v2/outputs/dataset_region_v2.csv`, `dataset_combinado.csv`, etc.), así que
se corren **desde el repositorio TT1**, en sus carpetas originales (`src/modelo_4_variables/` y
`src/modelo_3_conteo/`). `config.py` y `requirements.txt` van aquí como referencia.

```bash
pip install -r modelos/requirements.txt
python modelos/modelo_4_gradient_boosting/predecir_gb.py --tt1 ../TT1
python scripts/importar_tt1.py --tt1 ../TT1
npm run build:single
```

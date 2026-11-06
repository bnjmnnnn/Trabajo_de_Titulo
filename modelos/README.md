# Modelos seleccionados

Los dos modelos de TT1 que alimentan el mapa, con sus scripts, el modelo entrenado (`.pkl`) y sus salidas.
Los archivos son copias sin cambios de [bnjmnnnn/TT1](https://github.com/bnjmnnnn/TT1)
(rama `reevaluacion-de-modelos`). Lo nuevo es `modelo_4_gradient_boosting/predecir_gb.py`, que arma el Modelo 4
con 5 variables tras la ronda 3 (ver más abajo).

El criterio de selección es el **skill score de Murphy (1988)** contra la persistencia (repetir el año
anterior): `skill = 1 − MSE_modelo / MSE_persistencia`. Positivo, el modelo le gana a no hacer nada.

| Rol | Modelo | Skill | Carpeta |
| :-- | :-- | :-: | :-- |
| Reparto territorial | **Modelo 4 · Gradient Boosting** sobre la redistribución, 5 variables | +0,671 (test 2023) · +0,683 (test 2022) | `modelo_4_gradient_boosting/` |
| Cantidad de personas | **Random Forest de conteo** (modo crecimiento) | +0,744 (test 2023) | `conteo_random_forest/` |

## Modelo 4 · Gradient Boosting (`modelo_4_gradient_boosting/`)
Predice la **redistribución**: `rate(r, t) − rate(r, t−1)`, el cambio en la participación de cada región
en el total nacional. `GradientBoostingRegressor(n_estimators=200, learning_rate=0.05, max_depth=2,
min_samples_leaf=2, random_state=42)` con 5 variables: `sol_otorgadas_lag1`, `sol_share_lag1`,
`sol_total_lag1`, `mean_age_lag1`, `rate_lag2`.

**Por qué 5 y no las 6 `seleccionadas` de TT1.** La ronda 3 (`reporte_ronda3.md`, código en
`TT1/src/modelo_4_ronda3/`) probó con un criterio fijado de antemano qué variables sobran y 7 variables nuevas.
Quitar `pct_peru_lag1` empata el skill (+0,683 / +0,671, antes +0,694 / +0,648), mejora el Monte Carlo de regiones
y fue el único cambio que cumplió el criterio. Ninguna variable nueva lo cumplió.

| Archivo | Qué es |
| :-- | :-- |
| `train_modelo4.py` | Entrena y compara los 4 algoritmos; el gradient boosting es el elegido |
| `explorar_variables.py`, `probar_ronda2.py` | Arman el panel y las variables derivadas que usa `train_modelo4.py` |
| `redistribucion_gradient_boosting_5var.pkl` | El modelo de 5 variables entrenado con 2021-2022 (test 2023) |
| `metricas_modelo4.csv` | Métricas de TT1: todos los algoritmos, conjuntos y años de prueba (con 6 variables) |
| `metricas_gb_5var.csv` | Skill, RMSE, p de permutación y Monte Carlo del modelo de 5 variables |
| `reporte_ronda3.md` | Ablación y variables nuevas: qué se probó, con qué criterio y qué resultó |
| `predecir_gb.py` | Entrena el modelo de 5 variables por corte, comprueba el skill de la ronda 3 y arma la tabla por región |
| `proyectar_gb_2024_2028.py` | Reentrena con 2021-2023 y proyecta 2024-2028 de forma recursiva, con las condiciones promedio 2021-2023 (mismo supuesto que el conteo) |
| `proyeccion_gb_2024_2028.csv` | Redistribución y participación proyectadas por región. Es un escenario: el modelo solo se validó a un año |
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

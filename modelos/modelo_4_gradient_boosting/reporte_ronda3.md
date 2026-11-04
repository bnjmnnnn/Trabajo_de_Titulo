# Modelo 4 · Ronda 3: resultado

**Fecha:** 4 de noviembre de 2026. Plan y criterio fijados antes de correr nada: `PLAN.md`.
Banco de evaluación: `banco.py`. Reproduce exactamente el modelo actual: +0,6943 en 2022 y +0,6476 en 2023,
con diferencia 0.

## Respuesta corta
1. **El % de peruanos sobra.** Al quitarlo el modelo empata (+0,683 / +0,671) y queda más robusto. Es el único
   cambio que cumple el criterio del plan.
2. **La edad media no se puede quitar**: sin ella el skill de 2023 cae a +0,608. Por eso el pronóstico más allá
   de 2024 sigue bloqueado, porque la estimación SERMIG termina en 2023.
3. **Ninguna de las 7 variables nuevas cumple el criterio.** No hay evidencia de que alguna mejore el modelo.

En total se hicieron 16 pruebas, cada una con los dos años de prueba: 9 conjuntos de ablación y 7 candidatas.

## Ablación (`ablacion.csv`, `ablacion.md`)
| conjunto | skill 2022 | skill 2023 | p 2022 | p 2023 | MC 2022 | MC 2023 | se puede quitar |
| :-- | --: | --: | --: | --: | --: | --: | :-- |
| actual (6) | +0,694 | +0,648 | 0,016 | 0,010 | −0,233 | +0,105 | — |
| sin `pct_peru_lag1` | +0,683 | +0,671 | 0,002 | 0,006 | −0,142 | +0,118 | **sí** |
| sin `mean_age_lag1` | +0,709 | +0,608 | 0,020 | 0,014 | −0,258 | −0,019 | no |
| sin `rate_lag2` | +0,641 | +0,626 | 0,032 | 0,024 | −0,354 | +0,118 | no |
| 3 de solicitudes + `rate_lag2` | +0,658 | +0,570 | 0,000 | 0,004 | +0,009 | +0,015 | no |

(El resto de los conjuntos está en `ablacion.md`.) MC = mediana del skill al dejar 4 regiones fuera, en 300 corridas.

## Candidatas sobre la base de 5 (`candidatas.csv`, `variables_ronda3.md`)
Para aceptar una candidata se le pide, frente al modelo actual:
- mejorar el skill en al menos +0,03 en los dos años;
- un p de permutación menor que 0,05 en los dos años;
- que el Monte Carlo no empeore.

| + candidata | skill 2022 | skill 2023 | p 2022 | p 2023 | MC 2022 | MC 2023 | pasa |
| :-- | --: | --: | --: | --: | --: | --: | :-: |
| (base 5, sin candidata) | +0,683 | +0,671 | 0,002 | 0,006 | −0,142 | +0,118 | — |
| `rt_otorgadas_lag1` | +0,676 | +0,667 | 0,006 | 0,008 | +0,095 | +0,126 | no |
| `rt_share_lag1` | +0,672 | +0,661 | 0,008 | 0,014 | +0,055 | +0,111 | no |
| `rt_presion_lag1` | +0,605 | +0,640 | 0,046 | 0,004 | −0,348 | +0,186 | no |
| `rt_share_cambio_lag1` | +0,468 | +0,737 | 0,012 | 0,004 | −0,169 | +0,270 | no |
| `sol_share_cambio_lag1` | +0,421 | +0,530 | 0,060 | 0,010 | −0,286 | +0,123 | no |
| `rd_pct_venezuela_lag1` | +0,590 | +0,617 | 0,010 | 0,012 | −0,554 | +0,021 | no |
| `acogidas_share_lag1` | +0,684 | +0,666 | 0,006 | 0,006 | +0,056 | +0,127 | no |
| `rt_exterior_lag1` | — | — | — | — | — | — | no se pudo construir |

## Lectura
- **Las variables de aceleración son inestables.** `rt_share_cambio` sube 2023 a +0,737 pero hunde 2022 a +0,468.
  Elegirla por su resultado en 2023 sería justo el sobreajuste que el criterio busca evitar.
- **Tres candidatas empatan en skill, pero mejoran el Monte Carlo de 2022**: `rt_otorgadas`, `rt_share` y
  `acogidas_share`. Su mediana pasa de −0,14 a entre +0,06 y +0,09. Indica que el modelo dependería menos de qué
  regiones se usan para entrenar. No cumple el criterio, así que **no se adopta**; queda anotado como pista para
  cuando el panel tenga más años. Además, `rt_otorgadas` tiene un quiebre en 2022: SERMIG deja sin región las
  temporales pedidas desde el exterior (`variables_ronda3.md`).
- Esto confirma la conclusión de TT1: con 32 filas de entrenamiento, el límite está en los años de datos, no en
  las variables. Ampliar el panel a 2019-2020 sigue siendo lo que más podría mover el resultado, y requiere la
  autorización del profesor (`docs/ampliacion_panel.md`).

## Recomendación
- Reportar el Modelo 4 con **5 variables** (sin `pct_peru_lag1`): +0,683 en 2022 y +0,671 en 2023. Es más simple, más
  robusto en el Monte Carlo y se defiende mejor.
- Si se prefiere no tocar el número ya escrito (+0,694 / +0,648), mencionar la ablación como evidencia de que el
  % de peruanos no aporta.
- Informar en la tesis que se probaron 7 variables nuevas con un criterio fijado de antemano y que ninguna pasó.
  Es un resultado negativo, pero medido, igual que el de la ENE.

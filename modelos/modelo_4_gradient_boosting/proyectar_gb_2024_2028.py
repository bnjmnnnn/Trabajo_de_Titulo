"""Proyección 2024-2028 del Modelo 4 (redistribución, gradient boosting de 5 variables).

Mismo esquema que la proyección del conteo (TT1/src/modelo_3_conteo/proyectar_2024_2028.py), para que las
dos se lean igual:
  1. Reconstruye las variables por región-año (solicitudes del xlsx de SERMIG y edad media de
     dataset_combinado.csv) con las mismas funciones de TT1, y comprueba que reproducen las columnas _lag1
     del panel v2.
  2. Reentrena el modelo con los 48 registros (2021-2023). La evaluación (entrenar antes de T, probar en T)
     ya está en predecir_gb.py; para proyectar lo estándar es reentrenar con todo.
  3. Proyecta de forma recursiva, región por región:
         rate_t = rate_{t-1} + redistribución predicha_t
     `rate_lag2` se actualiza con la propia proyección; las demás variables (solicitudes y edad media) quedan
     en su PROMEDIO 2021-2023, el mismo supuesto de "condiciones promedio" del conteo.

No es un pronóstico validado: el modelo se probó a un año (skill +0,683 / +0,671). Desde 2025 la proyección
depende del supuesto de condiciones fijas, y con condiciones fijas repite casi el mismo cambio cada año.

  python modelos/modelo_4_gradient_boosting/proyectar_gb_2024_2028.py --tt1 ../TT1
"""
import argparse, pathlib, sys

import pandas as pd
from sklearn.base import clone

AQUI = pathlib.Path(__file__).resolve().parent
ANIOS_PROY = range(2024, 2029)
ANIOS_COND = [2021, 2022, 2023]

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tt1", default=str(AQUI.parents[2] / "TT1"))
    a = ap.parse_args()
    tt1 = pathlib.Path(a.tt1).resolve()
    for d in ("src/modelo_4_variables", "src/modelo_2_regional_v2", "src/modelo_3_conteo", "src/common"):
        sys.path.insert(0, str(tt1 / d))
    from train_modelo4 import MODELOS, agregar_derivadas, cargar_panel  # noqa: E402
    from build_dataset_v2 import features_solicitudes  # noqa: E402
    from proyectar_2024_2028 import features_demograficas  # noqa: E402
    from predecir_gb import COLUMNAS  # noqa: E402  (este mismo directorio)

    p = agregar_derivadas(cargar_panel())
    p["redistribucion"] = p["rate"] - p["rate_lag1"]

    # --- 1. variables reconstruidas + validación contra el panel ---
    sol = features_solicitudes()
    dem = features_demograficas()[["CODREGEO", "ANIO", "mean_age"]]
    base = sol.merge(dem, on=["CODREGEO", "ANIO"], how="inner")
    crudas = {"sol_otorgadas_lag1": "sol_otorgadas", "sol_share_lag1": "sol_share",
              "sol_total_lag1": "sol_total", "mean_age_lag1": "mean_age"}
    for anio in (2021, 2022, 2023):
        mio = base[base.ANIO == anio - 1].set_index("CODREGEO")
        pan = p[p.ANIO == anio].set_index("CODREGEO")
        for lag, col in crudas.items():
            d = (mio[col] - pan[lag]).abs().max()
            assert d < 1e-9, f"{lag} {anio}: no reproduce el panel (dif {d})"
    print("variables reconstruidas = columnas _lag1 del panel v2 (2021-2023)")

    # --- 2. reentrenar con todo ---
    modelo = clone(MODELOS["gradient_boosting"]).fit(p[COLUMNAS].to_numpy(), p["redistribucion"].to_numpy())

    # --- 3. proyección recursiva ---
    cond = base[base.ANIO.isin(ANIOS_COND)].groupby("CODREGEO")[list(crudas.values())].mean()
    cond.columns = list(crudas.keys())
    rate = {anio: p[p.ANIO == anio].set_index("CODREGEO")["rate"] for anio in (2022, 2023)}
    region = p[p.ANIO == 2023].set_index("CODREGEO")["REGION"]
    filas = []
    for anio in ANIOS_PROY:
        X = cond.assign(rate_lag2=rate[anio - 2])[COLUMNAS]
        delta = pd.Series(modelo.predict(X.to_numpy()), index=X.index)
        rate[anio] = rate[anio - 1] + delta
        for c in X.index:
            filas.append({"CODREGEO": c, "REGION": region[c], "ANIO": anio, "rate_lag1": rate[anio - 1][c],
                          "redistribucion_proyectada": delta[c], "rate_proyectado": rate[anio][c]})
        print(f"{anio}: suma de participaciones {100 * rate[anio].sum():.2f}% · RM {100 * delta[7]:+.3f} pp")
    pd.DataFrame(filas).to_csv(AQUI / "proyeccion_gb_2024_2028.csv", index=False)
    print(f"OK {AQUI / 'proyeccion_gb_2024_2028.csv'}")

if __name__ == "__main__":
    main()

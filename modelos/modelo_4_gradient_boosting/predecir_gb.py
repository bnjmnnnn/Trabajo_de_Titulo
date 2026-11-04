"""Predicciones por región del Modelo 4: gradient boosting sobre la redistribución, con 5 variables.

La ronda 3 (TT1/src/modelo_4_ronda3/reporte_ronda3.md) mostró que `pct_peru_lag1` no aporta: sin ella el skill
empata (+0,683 en 2022, +0,671 en 2023, frente a +0,694 / +0,648 con 6) y el Monte Carlo de regiones mejora.
Es el único cambio que cumplió el criterio fijado de antemano, así que el modelo elegido usa estas 5:
  sol_otorgadas_lag1, sol_share_lag1, sol_total_lag1, mean_age_lag1, rate_lag2

Mismo algoritmo e hiperparámetros que train_modelo4.py (MODELOS["gradient_boosting"], semilla 42). Para cada
corte de prueba T (2022, 2023) entrena con los años < T, comprueba que el skill coincide con el de la ronda 3 y
escribe la tabla por región. El modelo del corte 2023 se guarda en redistribucion_gradient_boosting_5var.pkl.

Se corre contra la carpeta del TT, porque necesita su panel y sus funciones:
  python modelos/modelo_4_gradient_boosting/predecir_gb.py --tt1 ../TT1
"""
import argparse, pathlib, sys

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone

AQUI = pathlib.Path(__file__).resolve().parent
COLUMNAS = ["sol_otorgadas_lag1", "sol_share_lag1", "sol_total_lag1", "mean_age_lag1", "rate_lag2"]

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tt1", default=str(AQUI.parents[2] / "TT1"))
    a = ap.parse_args()
    tt1 = pathlib.Path(a.tt1).resolve()
    sys.path.insert(0, str(tt1 / "src" / "modelo_4_variables"))
    from train_modelo4 import MODELOS, skill, agregar_derivadas, cargar_panel  # noqa: E402

    p = agregar_derivadas(cargar_panel())
    p["redistribucion"] = p["rate"] - p["rate_lag1"]
    ronda3 = pd.read_csv(tt1 / "src" / "modelo_4_ronda3" / "candidatas.csv")
    ronda3 = ronda3[ronda3.conjunto == "base_5"].set_index("anio_test")

    tablas, metricas = [], []
    for anio in (2022, 2023):
        tr, te = p[p["ANIO"] < anio], p[p["ANIO"] == anio]
        modelo = clone(MODELOS["gradient_boosting"]).fit(tr[COLUMNAS].to_numpy(), tr["redistribucion"].to_numpy())
        pred = modelo.predict(te[COLUMNAS].to_numpy())
        y = te["redistribucion"].to_numpy()
        s = skill(y, pred, np.zeros_like(y))
        assert abs(s - ronda3.loc[anio, "skill"]) < 1e-9, f"{anio}: skill {s} no coincide con la ronda 3"
        print(f"{anio}: skill {s:+.4f} (coincide con la ronda 3)")
        if anio == 2023:
            joblib.dump(modelo, AQUI / "redistribucion_gradient_boosting_5var.pkl")
        metricas.append({"anio_test": anio, "skill": s, "rmse": float(np.sqrt(np.mean((pred - y) ** 2))),
                         "p_permutacion": ronda3.loc[anio, "p_perm"], "mc_mediana": ronda3.loc[anio, "mc_mediana"],
                         "variables": " ".join(COLUMNAS)})
        t = te[["CODREGEO", "REGION", "ANIO", "rate_lag1", "rate", "redistribucion"]].copy()
        t["predicho"] = pred
        t["error"] = pred - y
        t["rate_predicho"] = t["rate_lag1"] + pred
        tablas.append(t)
    pd.concat(tablas).sort_values(["ANIO", "CODREGEO"]).to_csv(AQUI / "predicciones_gb.csv", index=False)
    pd.DataFrame(metricas).to_csv(AQUI / "metricas_gb_5var.csv", index=False)
    print(f"OK {AQUI / 'predicciones_gb.csv'} y metricas_gb_5var.csv")

if __name__ == "__main__":
    main()

"""Predicciones por región del Modelo 4 con el algoritmo elegido (gradient boosting).

train_modelo4.py guarda la tabla por región (predicciones_redistribucion_2023.csv) con el
random forest, no con el gradient boosting que se reporta como Modelo 4. Este script arma esa
tabla con el gradient boosting, para los dos cortes de prueba (2023 y 2022), y comprueba que
el skill coincida con el de metricas_modelo4.csv antes de escribir nada.

  2023: usa redistribucion_gradient_boosting.pkl (entrenado con 2021-2022).
  2022: reentrena la misma configuración con 2021 (semilla 42, determinista).

Se corre contra la carpeta del TT, porque necesita su panel y sus funciones:
  python modelos/modelo_4_gradient_boosting/predecir_gb.py --tt1 ../TT1
"""
import argparse, pathlib, sys

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone

AQUI = pathlib.Path(__file__).resolve().parent

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tt1", default=str(AQUI.parents[2] / "TT1"))
    a = ap.parse_args()
    m4 = pathlib.Path(a.tt1).resolve() / "src" / "modelo_4_variables"
    sys.path.insert(0, str(m4))
    from train_modelo4 import SETS, MODELOS, skill, agregar_derivadas, cargar_panel  # noqa: E402

    p = agregar_derivadas(cargar_panel())
    p["redistribucion"] = p["rate"] - p["rate_lag1"]
    cols = SETS["redistribucion"]["seleccionadas"]
    reportado = pd.read_csv(AQUI / "metricas_modelo4.csv")
    reportado = reportado[(reportado.pregunta == "redistribucion") & (reportado.conjunto == "seleccionadas")
                          & (reportado.modelo == "gradient_boosting")].set_index("anio_test")["skill"]

    tablas = []
    for anio in (2023, 2022):
        tr, te = p[p["ANIO"] < anio], p[p["ANIO"] == anio]
        if anio == 2023:
            modelo = joblib.load(AQUI / "redistribucion_gradient_boosting.pkl")
        else:
            modelo = clone(MODELOS["gradient_boosting"]).fit(tr[cols].to_numpy(), tr["redistribucion"].to_numpy())
        pred = modelo.predict(te[cols].to_numpy())
        y = te["redistribucion"].to_numpy()
        s = skill(y, pred, np.zeros_like(y))
        assert abs(s - reportado[anio]) < 1e-9, f"{anio}: skill {s} no coincide con el reportado {reportado[anio]}"
        print(f"{anio}: skill {s:+.4f} (coincide con metricas_modelo4.csv)")
        t = te[["CODREGEO", "REGION", "ANIO", "rate_lag1", "rate", "redistribucion"]].copy()
        t["predicho"] = pred
        t["error"] = pred - y
        t["rate_predicho"] = t["rate_lag1"] + pred
        tablas.append(t)
    pd.concat(tablas).sort_values(["ANIO", "CODREGEO"]).to_csv(AQUI / "predicciones_gb.csv", index=False)
    print(f"OK {AQUI / 'predicciones_gb.csv'}")

if __name__ == "__main__":
    main()

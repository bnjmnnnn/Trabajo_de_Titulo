"""Lleva al mapa los valores reales de los dos modelos elegidos en TT1.

Modelos (ver TT1/docs/plan_avance_tt2.md, §6 "Decisiones tomadas"):
  - Modelo 4 · Gradient Boosting (redistribución): el único que le gana a la persistencia en el
    reparto territorial según el skill score de Murphy (1988). Predicciones de test 2022 y 2023
    (modelos/modelo_4_gradient_boosting/predicciones_gb.csv, generadas con predecir_gb.py).
  - Conteo · Random Forest (modo crecimiento): skill +0,744 en cantidad de personas.
    Predicción de test 2023 + proyección 2024-2028 (condiciones promedio 2021-2023, es un techo).

El mapa tiene una sola unidad, así que todo se expresa como % del total nacional (16 regiones),
que es la tasa de concentración, variable objetivo principal del trabajo:
  - Modelo 4: rate_predicho = rate(t-1) + redistribución predicha.
  - Conteo:   personas predichas de la región / suma de las 16 regiones del mismo año.

Los valores de los modelos salen de modelos/; de TT1 solo se lee el observado.

Uso:
  python scripts/importar_tt1.py --tt1 ../TT1
  (luego scripts/exportar_predicciones.py arma src/data/tt1.json, que va incrustado en el build)
"""
import argparse, csv, math, pathlib, subprocess, sys

# CODREGEO de TT1 (norte a sur, 1=Arica ... 7=RM ... 16=Magallanes) -> código oficial INE del mapa.
CODREGEO_A_INE = {1: 15, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 13, 8: 6, 9: 7, 10: 16, 11: 8, 12: 9,
                  13: 14, 14: 10, 15: 11, 16: 12}
M4 = "Modelo 4 · Gradient Boosting (redistribución)"
RF = "Conteo · Random Forest"

def leer(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

def escribir(path, cab, filas):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(cab); w.writerows(filas)

def pct(x):
    return round(100 * x, 4)

def main():
    aqui = pathlib.Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tt1", default=str(aqui.parent.parent / "TT1"))
    ap.add_argument("--dir", default=str(aqui / "tt1"), help="carpeta de los CSV intermedios")
    a = ap.parse_args()
    src = pathlib.Path(a.tt1) / "src"
    m4, rf_dir = aqui.parent / "modelos/modelo_4_gradient_boosting", aqui.parent / "modelos/conteo_random_forest"
    out = pathlib.Path(a.dir); out.mkdir(parents=True, exist_ok=True)

    # --- observado: tasa de concentración real (2020 sale del rezago de 2021) ---
    obs = {}
    for r in leer(src / "modelo_2_regional_v2/outputs/dataset_region_v2.csv"):
        c, anio = CODREGEO_A_INE[int(r["CODREGEO"])], int(r["ANIO"])
        obs[(c, anio)] = float(r["rate"])
        if anio == 2021:
            obs[(c, 2020)] = float(r["rate_lag1"])
    for anio in sorted({k[1] for k in obs}):
        s = sum(v for (c, y), v in obs.items() if y == anio)
        assert abs(s - 1) < 1e-6, f"el observado {anio} no suma 1 ({s})"

    pred = []
    # --- Modelo 4: test 2022 y 2023 ---
    for r in leer(m4 / "predicciones_gb.csv"):
        pred.append((M4, CODREGEO_A_INE[int(r["CODREGEO"])], int(r["ANIO"]), pct(float(r["rate_predicho"]))))

    # --- Conteo RF: test 2023 + proyección 2024-2028, normalizados a % del país ---
    por_anio = {}
    for r in leer(rf_dir / "predicciones_test_conteo_crecimiento.csv"):
        por_anio.setdefault(int(r["ANIO"]), {})[CODREGEO_A_INE[int(r["CODREGEO"])]] = float(r["pred_random_forest_conteo"])
    for r in leer(rf_dir / "proyeccion_modelo_2024_2028.csv"):
        por_anio.setdefault(int(r["ANIO"]), {})[CODREGEO_A_INE[int(r["CODREGEO"])]] = float(r["estimacion_proyectada"])
    totales = {}
    for anio, regiones in sorted(por_anio.items()):
        assert len(regiones) == 16, f"conteo {anio}: {len(regiones)} regiones"
        totales[anio] = sum(regiones.values())
        pred += [(RF, c, anio, pct(v / totales[anio])) for c, v in regiones.items()]

    # --- métricas reportadas en TT1 (en la unidad nativa de cada modelo) ---
    met = {}
    for r in leer(m4 / "metricas_modelo4.csv"):
        if r["pregunta"] == "redistribucion" and r["conjunto"] == "seleccionadas" and r["modelo"] == "gradient_boosting":
            met[f"Skill {r['anio_test']}"] = float(r["skill"])
            met[f"RMSE {r['anio_test']} (pp)"] = 100 * float(r["rmse"])
    metricas = [(M4, k, v) for k, v in sorted(met.items())]
    rf = next(r for r in leer(rf_dir / "metricas_conteo_crecimiento.csv")
              if r["modelo"] == "random_forest_conteo" and r["split"] == "test")
    # Persistencia (repetir 2023 = estimation_lag1) sobre el mismo test, para el skill de Murphy.
    t = leer(rf_dir / "predicciones_test_conteo_crecimiento.csv")
    mse_pers = sum((float(r["estimation"]) - float(r["estimation_lag1"])) ** 2 for r in t) / len(t)
    rmse_rf = float(rf["rmse"])
    metricas += [(RF, "Skill 2023", 1 - rmse_rf ** 2 / mse_pers), (RF, "R2 2023", float(rf["r2"])),
                 (RF, "RMSE 2023 (personas)", rmse_rf), (RF, "MAE 2023 (personas)", float(rf["mae"]))]

    escribir(out / "predicciones.csv", ["modelo", "codigo_region", "periodo", "prediccion"], pred)
    escribir(out / "observado.csv", ["codigo_region", "periodo", "valor"],
             [(c, y, pct(v)) for (c, y), v in sorted(obs.items(), key=lambda kv: (kv[0][1], kv[0][0]))])
    escribir(out / "metricas.csv", ["modelo", "metrica", "valor"], metricas)

    t28 = totales.get(2028)
    nota = ("Valores reales de TT1. Modelo 4 (gradient boosting sobre la redistribución): test 2022 y 2023, "
            f"skill {met.get('Skill 2023', float('nan')):+.3f} (2023) / {met.get('Skill 2022', float('nan')):+.3f} (2022) "
            "contra la persistencia. Conteo (Random Forest): test 2023 y proyección 2024-2028 con las condiciones "
            f"promedio 2021-2023, expresada como % del país; es un techo, no un pronóstico central"
            + (f" ({t28:,.0f} personas en 2028).".replace(",", ".") if t28 else "."))
    subprocess.run([sys.executable, str(aqui / "exportar_predicciones.py"),
                    "--pred", str(out / "predicciones.csv"), "--obs", str(out / "observado.csv"),
                    "--metricas", str(out / "metricas.csv"),
                    "--titulo", "Concentración de población inmigrante por región",
                    "--variable", "Población inmigrante sobre el total nacional", "--unidad", "%",
                    "--decimales", "2", "--nota", nota,
                    "--salida", str(aqui.parent / "src/data/tt1.json")], check=True)

if __name__ == "__main__":
    main()

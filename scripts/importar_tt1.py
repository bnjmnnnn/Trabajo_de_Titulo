"""Lleva al mapa los valores reales de los dos modelos elegidos en TT1, cada uno en su propia unidad.

Modelos (ver TT1/docs/plan_avance_tt2.md, §6 "Decisiones tomadas"):
  - Conteo · Random Forest (modo crecimiento): estima la CANTIDAD de personas inmigrantes por región.
    Skill +0,744 contra la persistencia. Prueba 2023 + proyección 2024-2028 (condiciones promedio
    2021-2023, es un techo). Registro: personas estimadas 2021-2023.
  - Modelo 4 · Gradient Boosting: estima la REDISTRIBUCIÓN, el cambio en la participación de cada
    región en el total nacional, rate(t) − rate(t−1), en puntos porcentuales. El único que le gana a
    la persistencia en el reparto territorial según el skill de Murphy (1988). Con 5 variables (sin
    pct_peru_lag1, ver la ronda 3). Prueba 2022 y 2023 (modelos/modelo_4_gradient_boosting/
    predicciones_gb.csv y metricas_gb_5var.csv, generadas con predecir_gb.py).
    Registro: redistribución observada 2021-2023.

Los modelos responden preguntas distintas, así que no se mezclan: cada uno es una vista del mapa con
su unidad, su registro y su escala (secuencial para personas, divergente gana/pierde para la
redistribución). Los valores de los modelos salen de modelos/; de TT1 solo se lee el registro.

Uso:
  python scripts/importar_tt1.py --tt1 ../TT1
  (escribe src/data/tt1.json, que va incrustado en el build)
"""
import argparse, csv, json, pathlib

# CODREGEO de TT1 (norte a sur, 1=Arica ... 7=RM ... 16=Magallanes) -> código oficial INE del mapa.
CODREGEO_A_INE = {1: 15, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 13, 8: 6, 9: 7, 10: 16, 11: 8, 12: 9,
                  13: 14, 14: 10, 15: 11, 16: 12}
CODIGOS = [15, 1, 2, 3, 4, 5, 13, 6, 7, 16, 8, 9, 14, 10, 11, 12]
PERIODOS = list(range(2021, 2029))
OBSERVADO_HASTA = 2023

def leer(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

def serie(valores, envolver):
    """{(codigo, anio): v} -> {codigo: [v por periodo]} con null donde no hay dato."""
    return {str(c): [envolver(valores[(c, p)]) if (c, p) in valores else None for p in PERIODOS] for c in CODIGOS}

def completo(valores, anios, quien):
    for p in anios:
        n = sum(1 for (c, y) in valores if y == p)
        assert n == 16, f"{quien} {p}: {n} regiones"

def main():
    aqui = pathlib.Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tt1", default=str(aqui.parent.parent / "TT1"))
    ap.add_argument("--salida", default=str(aqui.parent / "src/data/tt1.json"))
    a = ap.parse_args()
    panel = leer(pathlib.Path(a.tt1) / "src/modelo_2_regional_v2/outputs/dataset_region_v2.csv")
    m4, rf_dir = aqui.parent / "modelos/modelo_4_gradient_boosting", aqui.parent / "modelos/conteo_random_forest"
    ine = lambda r: CODREGEO_A_INE[int(r["CODREGEO"])]

    # --- Conteo: personas ---
    obs_rf = {(ine(r), int(r["ANIO"])): round(float(r["estimation"])) for r in panel}
    pred_rf = {(ine(r), int(r["ANIO"])): round(float(r["pred_random_forest_conteo"]))
               for r in leer(rf_dir / "predicciones_test_conteo_crecimiento.csv")}
    pred_rf |= {(ine(r), int(r["ANIO"])): round(float(r["estimacion_proyectada"]))
                for r in leer(rf_dir / "proyeccion_modelo_2024_2028.csv")}
    completo(obs_rf, [2021, 2022, 2023], "registro conteo"); completo(pred_rf, range(2023, 2029), "conteo")

    rf = next(r for r in leer(rf_dir / "metricas_conteo_crecimiento.csv")
              if r["modelo"] == "random_forest_conteo" and r["split"] == "test")
    # Persistencia (repetir 2022 = estimation_lag1) sobre el mismo test, para el skill de Murphy.
    t = leer(rf_dir / "predicciones_test_conteo_crecimiento.csv")
    mse_pers = sum((float(r["estimation"]) - float(r["estimation_lag1"])) ** 2 for r in t) / len(t)
    skill_rf = 1 - float(rf["rmse"]) ** 2 / mse_pers
    t28 = sum(v for (c, y), v in pred_rf.items() if y == 2028)

    # --- Modelo 4: redistribución en puntos porcentuales ---
    obs_m4 = {(ine(r), int(r["ANIO"])): round(100 * (float(r["rate"]) - float(r["rate_lag1"])), 4) for r in panel}
    pred_m4 = {(ine(r), int(r["ANIO"])): round(100 * float(r["predicho"]), 4) for r in leer(m4 / "predicciones_gb.csv")}
    completo(obs_m4, [2021, 2022, 2023], "registro redistribución"); completo(pred_m4, [2022, 2023], "Modelo 4")
    for r in leer(m4 / "predicciones_gb.csv"):  # el registro del panel calza con el que vio el modelo
        assert abs(100 * float(r["redistribucion"]) - obs_m4[(ine(r), int(r["ANIO"]))]) < 1e-3, r["REGION"]
    met = {}
    for r in leer(m4 / "metricas_gb_5var.csv"):
        met[f"Skill {r['anio_test']}"] = float(r["skill"])
        met[f"RMSE {r['anio_test']} (pp)"] = 100 * float(r["rmse"])

    coma = lambda x, d=3: f"{x:+.{d}f}".replace(".", ",")
    puntos = lambda x: f"{x:,.0f}".replace(",", ".")
    modelos = [
        {"id": "conteo", "nombre": "Cantidad · Conteo RF",
         "meta": {"variable": "Población inmigrante estimada", "unidad": "personas", "decimales": 0,
                  "nota": f"Personas por región. Prueba 2023 con skill {coma(skill_rf)} contra la persistencia. "
                          f"2024-2028 es una proyección con las condiciones promedio 2021-2023: un techo, no un "
                          f"pronóstico central ({puntos(t28)} personas en 2028)."},
         "escala": "secuencial", "observadoHasta": OBSERVADO_HASTA,
         "valores": serie(pred_rf, lambda v: [v]), "observado": serie(obs_rf, lambda v: v),
         "metricas": {"Skill 2023": skill_rf, "R2 2023": float(rf["r2"]), "RMSE 2023 (personas)": float(rf["rmse"]),
                      "MAE 2023 (personas)": float(rf["mae"])}, "metricasOrigen": "entregadas"},
        {"id": "modelo-4", "nombre": "Redistribución · Modelo 4",
         "meta": {"variable": "Cambio en la participación del total nacional", "unidad": "pp", "decimales": 2,
                  "nota": f"Cuánto gana o pierde cada región en su parte del total de inmigrantes respecto del año "
                          f"anterior, en puntos porcentuales. Prueba 2022 y 2023 con skill {coma(met['Skill 2022'])} "
                          f"y {coma(met['Skill 2023'])} contra la persistencia. El modelo no proyecta después de 2023."},
         "escala": "divergente", "observadoHasta": OBSERVADO_HASTA,
         "valores": serie(pred_m4, lambda v: [v]), "observado": serie(obs_m4, lambda v: v),
         "metricas": met, "metricasOrigen": "entregadas"},
    ]
    datos = {"version": 2,
             "meta": {"titulo": "Población inmigrante por región", "variable": "Valor", "unidad": "", "decimales": 2,
                      "nota": "Valores reales de TT1. Cada vista es un modelo con su propia unidad."},
             "periodos": PERIODOS, "observadoHasta": OBSERVADO_HASTA, "modelos": modelos, "observado": None}
    pathlib.Path(a.salida).write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"OK {a.salida} · conteo skill {skill_rf:+.4f} · {t28:,} personas en 2028 · Modelo 4 {met}")

if __name__ == "__main__":
    main()

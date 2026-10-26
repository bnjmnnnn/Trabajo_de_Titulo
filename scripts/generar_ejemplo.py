"""Genera CSV de EJEMPLO (sintéticos) para probar el mapa. No son datos reales."""
import csv, math, random, pathlib
random.seed(7)
D = pathlib.Path(__file__).resolve().parent / "ejemplo"; D.mkdir(exist_ok=True)
base = {15: 13, 1: 16, 2: 17, 3: 7, 4: 3.5, 5: 4.5, 13: 11.5, 6: 3, 7: 2.6, 16: 1.8, 8: 2.2,
        9: 1.9, 14: 2.0, 10: 2.8, 11: 3.2, 12: 5.5}
crec = {c: random.uniform(0.04, 0.09) for c in base}
anios = list(range(2017, 2031)); hasta = 2023
real = {c: {a: base[c]*(1+crec[c])**(a-2022)*(1+random.gauss(0, .03)) for a in anios} for c in base}
modelos = {"Regresión lineal": (0.9, .08, .10), "Random Forest": (1.0, .04, .06), "XGBoost": (1.03, .03, .05)}
with open(D/"observado.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["codigo_region", "periodo", "valor"])
    for c in base:
        for a in anios:
            if a <= hasta: w.writerow([c, a, round(real[c][a], 3)])
with open(D/"predicciones.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["modelo", "codigo_region", "periodo", "prediccion", "lim_inf", "lim_sup"])
    for m, (sesgo, ruido, ancho) in modelos.items():
        for c in base:
            for a in anios:
                k = 1 + (sesgo-1)*max(0, a-hasta)/7
                p = real[c][a]*k*(1+random.gauss(0, ruido))
                h = ancho*(1+0.12*max(0, a-hasta))
                w.writerow([m, c, a, round(p, 3), round(p*(1-h), 3), round(p*(1+h), 3)])
print("CSV de ejemplo en", D)

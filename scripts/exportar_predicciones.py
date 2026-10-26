"""Convierte las salidas de tus modelos (CSV) al JSON que lee el mapa.

Entradas (formato largo, una fila por modelo-región-periodo):
  predicciones.csv  -> modelo,codigo_region,periodo,prediccion[,lim_inf,lim_sup]
  observado.csv     -> codigo_region,periodo,valor            (opcional)
  metricas.csv      -> modelo,metrica,valor                   (opcional; si falta,
                        se calculan MAE, RMSE y MAPE donde haya dato observado)

codigo_region usa la codificación oficial (1=Tarapacá ... 13=RM ... 15=Arica, 16=Ñuble).

Ejemplo:
  python scripts/exportar_predicciones.py --pred predicciones.csv --obs observado.csv \
      --titulo "Población inmigrante por región" --variable "Población inmigrante" --unidad "%" \
      --salida public/datos/predicciones.json

Desde pandas puedes generar el CSV con:
  df[["modelo","codigo_region","periodo","prediccion","lim_inf","lim_sup"]].to_csv("predicciones.csv", index=False)
"""
import argparse, csv, json, math, pathlib
from collections import defaultdict

CODIGOS = [15, 1, 2, 3, 4, 5, 13, 6, 7, 16, 8, 9, 14, 10, 11, 12]

def num(v):
    try:
        x = float(str(v).replace(",", "."))
        return None if math.isnan(x) else x
    except (TypeError, ValueError):
        return None

def leer(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return [{k.strip().lower(): v for k, v in fila.items()} for fila in csv.DictReader(f)]

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pred", required=True); ap.add_argument("--obs"); ap.add_argument("--metricas")
    ap.add_argument("--titulo", default="Predicciones por región")
    ap.add_argument("--variable", default="Valor predicho"); ap.add_argument("--unidad", default="")
    ap.add_argument("--decimales", type=int, default=2)
    ap.add_argument("--nota", default="")
    ap.add_argument("--salida", default="public/datos/predicciones.json")
    a = ap.parse_args()

    pred = leer(a.pred)
    obs = leer(a.obs) if a.obs else []
    periodos = sorted({int(float(r["periodo"])) for r in pred} | {int(float(r["periodo"])) for r in obs})
    ip = {p: i for i, p in enumerate(periodos)}
    vacio = lambda: {str(c): [None]*len(periodos) for c in CODIGOS}

    modelos = {}
    for r in pred:
        m = r["modelo"].strip()
        mod = modelos.setdefault(m, {"id": m.lower().replace(" ", "-"), "nombre": m, "valores": vacio()})
        c = str(int(float(r["codigo_region"])))
        if c not in mod["valores"]:
            raise SystemExit(f"codigo_region desconocido: {c}")
        p, lo, hi = num(r.get("prediccion")), num(r.get("lim_inf")), num(r.get("lim_sup"))
        mod["valores"][c][ip[int(float(r["periodo"]))]] = None if p is None else (
            [p] if lo is None or hi is None else [p, lo, hi])

    observado = vacio()
    for r in obs:
        observado[str(int(float(r["codigo_region"])))][ip[int(float(r["periodo"]))]] = num(r["valor"])

    met_in = defaultdict(dict)
    if a.metricas:
        for r in leer(a.metricas):
            met_in[r["modelo"].strip()][r["metrica"].strip()] = num(r["valor"])
    for nombre, mod in modelos.items():
        if met_in.get(nombre):
            mod["metricas"] = met_in[nombre]; mod["metricasOrigen"] = "entregadas"
            continue
        err = [(v[0], observado[c][i]) for c, serie in mod["valores"].items()
               for i, v in enumerate(serie) if v and observado[c][i] is not None]
        if err:
            e = [p - o for p, o in err]
            mod["metricas"] = {"MAE": sum(map(abs, e))/len(e), "RMSE": math.sqrt(sum(x*x for x in e)/len(e)),
                               "MAPE %": 100*sum(abs(p-o)/abs(o) for p, o in err if o)/max(1, sum(1 for _, o in err if o)),
                               "n": len(e)}
            mod["metricasOrigen"] = "calculadas contra observado"

    ultimo_obs = max((periodos[i] for s in observado.values() for i, v in enumerate(s) if v is not None), default=None)
    out = {"version": 1, "meta": {"titulo": a.titulo, "variable": a.variable, "unidad": a.unidad,
                                  "decimales": a.decimales, "nota": a.nota},
           "periodos": periodos, "observadoHasta": ultimo_obs,
           "modelos": list(modelos.values()), "observado": observado}
    dest = pathlib.Path(a.salida); dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"OK {dest} · {len(modelos)} modelos · {len(periodos)} periodos ({periodos[0]}–{periodos[-1]})")

if __name__ == "__main__":
    main()

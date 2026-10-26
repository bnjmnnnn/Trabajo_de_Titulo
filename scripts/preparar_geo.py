"""Simplifica el GeoJSON de regiones (fuente: github.com/caracena/chile-geojson, límites BCN)
y genera src/data/regiones-chile.json, compacto para el navegador.

- Quita islas oceánicas (Rapa Nui, Juan Fernández, Desventuradas: lon < -78).
- Quita islotes muy pequeños para aligerar Aysén y Magallanes.
- Simplifica bordes con Douglas-Peucker (~1 km).
Uso: python scripts/preparar_geo.py
"""
import json, math, pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
TOL = 0.01          # grados (~1 km)
AREA_MIN = 0.004    # grados² (~40 km²)

NOMBRES = {15: "Arica y Parinacota", 1: "Tarapacá", 2: "Antofagasta", 3: "Atacama", 4: "Coquimbo",
           5: "Valparaíso", 13: "Metropolitana", 6: "O'Higgins", 7: "Maule", 16: "Ñuble", 8: "Biobío",
           9: "La Araucanía", 14: "Los Ríos", 10: "Los Lagos", 11: "Aysén", 12: "Magallanes"}
ORDEN = [15, 1, 2, 3, 4, 5, 13, 6, 7, 16, 8, 9, 14, 10, 11, 12]  # norte → sur

def area(r):
    return abs(sum(r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1] for i in range(len(r)-1)))/2

def dp(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0]-a[0], b[1]-a[1]; n = math.hypot(dx, dy) or 1e-12
    best, idx = 0, 0
    for i in range(1, len(pts)-1):
        d = abs(dy*pts[i][0]-dx*pts[i][1]+b[0]*a[1]-b[1]*a[0])/n if n > 1e-12 else math.dist(pts[i], a)
        if d > best: best, idx = d, i
    if best > tol:
        return dp(pts[:idx+1], tol)[:-1] + dp(pts[idx:], tol)
    return [a, b]

def simplificar_anillo(r):
    r = r[:-1] if r[0] == r[-1] else r
    k = len(r)//2
    s = dp(r[:k+1], TOL)[:-1] + dp(r[k:] + [r[0]], TOL)[:-1]
    s = [[round(x, 3), round(y, 3)] for x, y in s]
    out = [p for i, p in enumerate(s) if p != s[i-1]]
    return out if len(out) >= 3 else None

src = json.load(open(RAIZ/"scripts"/"regiones_bcn_raw.json", encoding="utf-8"))
regiones = {}
for f in src["features"]:
    cod = f["properties"]["codregion"]
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    polys = [p for p in polys if min(x for x, _ in p[0]) > -78]
    polys.sort(key=lambda p: -area(p[0]))
    keep = [p for i, p in enumerate(polys) if i == 0 or area(p[0]) >= AREA_MIN]
    salida = []
    for p in keep:
        anillos = [simplificar_anillo(r) for r in p]
        if anillos[0] is None: continue
        salida.append([a for a in anillos if a])
    regiones[cod] = {"codigo": cod, "nombre": NOMBRES[cod], "poligonos": salida}

res = [regiones[c] for c in ORDEN]
dest = RAIZ/"src"/"data"/"regiones-chile.json"
json.dump({"fuente": "Límites regionales BCN vía github.com/caracena/chile-geojson (simplificado)",
           "regiones": res}, open(dest, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(dest, dest.stat().st_size, "bytes;", sum(len(a) for r in res for p in r["poligonos"] for a in p), "vértices")

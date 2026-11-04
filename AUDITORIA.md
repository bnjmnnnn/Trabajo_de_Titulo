# Auditoría de diseño — Atlas Predictivo Chile

## Diagnóstico: por qué el sitio actual se ve hecho por IA
| Hallazgo | Dónde | Por qué importa |
|---|---|---|
| Noche azul + globo con halo y viento: la portada típica de "producto tech" | `src/landing/*` | Se parece a cientos de landings generadas; no dice nada de Chile ni de migración. |
| Azul saturado radial a pantalla completa (`#1662c4 → #0a2c6e`) | `pronostico.css` | Es el tono "AI blue": resplandor, sin materia, cansa en proyector. |
| Todo en mayúsculas condensadas (Archivo) | ambos CSS | Sin jerarquía real: título, rótulos y botones hablan con la misma voz. |
| **Escala lineal con la RM como valor atípico** | `tono()` en `pronostico.js` | La RM es ~25 veces la región que le sigue: 15 de 16 regiones salen del mismo beige. El mapa no se puede leer; es el problema más grave. |
| Columnas 3D apenas visibles en Chile vertical | `mapa3d.js` | El 3D cuesta 540 kB y no aporta lectura. |
| Selector de años chico al pie, sin distinguir bien prueba y proyección | zócalo | Es el control principal y es el menos visible. |
| Texto explicativo de 13 px en blanco sobre azul | `.tv-desc` | Se pierde en proyector. |

## Propuesta: "Pliego de Chile" (`pliego.html`)
Chile impreso como un pliego de la **Lira Popular**: la noticia callejera chilena del siglo XIX, en papel claro, tinta negra y una segunda tinta.

- **El valor se lee como densidad de tinta** (achurado de grabado, 6 niveles) en **escala logarítmica** fija para todos los años: las 16 regiones se distinguen.
- **La segunda tinta tiene significado**: lo impreso en rojo es proyección (un techo); en redistribución, la trama azul invertida es "pierde parte del total".
- **Titular calculado de los datos**: "Tres de cada cinco personas inmigrantes viven en la Región Metropolitana" (fracción simple más cercana, con el % real abajo).
- **Mapa 3D interactivo** (el mismo motor Three.js del sitio actual) entintado en grises y segunda tinta: Chile acostado en escritorio, vertical en celular; se gira, se acerca, tiene encuadres Todo Chile / Norte / Centro / Sur y al hacer clic vuela a la región. Hilos que siguen a cada región mientras giras la llevan a 16 columnas-noticia. En celular las columnas pasan a una lista con barras horizontales.
- **Cada modelo es un pliego de otro color**: al cambiarlo, la hoja nueva se entinta en círculo desde el botón (View Transitions).

### Componentes interactivos (adaptados de patrones tipo React Bits / EasyUI, en JS sin framework)
| Patrón | Versión en el pliego |
|---|---|
| Marquee | Pregón con las cifras del año (se pausa al pasar el cursor) |
| Count Up | Las cifras cuentan hasta el valor nuevo al cambiar de año |
| Decrypted / Scramble Text | El año se "compone" como tipos sueltos |
| Magnet | Los años son tipos de madera que se acercan al cursor |
| Lens / Spotlight | Cuentahílos (lupa de imprenta ×3,2) sobre el mapa |
| Click Spark | Salpicadura de tinta al marcar una región |
| Stamp | Timbre "Prueba del modelo / Proyección · techo" que golpea al cambiar |
| Ticket card | Boleto troquelado con el detalle y la serie de años |
| Autoplay | "Imprimir la serie" recorre 2021→2028 |

Accesibilidad: columnas como botones con `aria-label`, grupos de radio para modelo y año, ← → y Esc, foco visible, `prefers-reduced-motion` desactiva todo el movimiento.

## Pendiente
- Las barras animan `height`/`width` (16 elementos; el detector lo marca como aviso, sin impacto visible).
- El build de un solo archivo (`npm run build:single`) sigue publicando solo el globo.

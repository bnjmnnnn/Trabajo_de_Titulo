# DESIGN — Modelos de predicción de conteo y distribución de inmigrantes

Sistema visual de la portada (`index.html`) y del recorrido (`vuelo.html`), construido con la skill
`landing-page-design`. La fuente de verdad es el código: `src/resultados/estilos.css`, `src/resultados/main.js`,
`src/vuelo/*`, `videos/vuelo-chile/index.html`. El diseño anterior (globo nocturno + mapa tipo pronóstico)
sigue en `globo.html` y no forma parte de este sistema.

## Idea
Un informe de resultados que se explora, no un dashboard: una pregunta por modelo, el año como control
principal y cada cifra marcada como registro, prueba del modelo o proyección (techo). Tema claro y sobrio
para leer en proyector y en celular.

## Color (fondos planos, tema claro)
| Rol | Valor |
|---|---|
| Fondo | `#fafaf9` · superficie `#ffffff` · borde `#e7e5e4` |
| Texto | `#1c1917` · secundario `#57534e` |
| Acento (conteo, prueba, "gana") | `#0f766e`, suave `#ccebe6` |
| Proyección (techo) | `#b45309`, suave `#fbe7c6` |
| "Pierde" (distribución) | `#c2410c`, suave `#fde3d3` |
| Rampa secuencial | `#e6f4f1 #a7dccf #4db3a2 #0f766e #0b4a45` |

Único degradado: el texto del título principal (`#000` → `#666`).

## Tipografía
Geist en todo el sitio; Geist Mono solo para cifras. Estilos con nombre de la skill (`heading-1` … `caption-5`),
tamaños de la escala de Tailwind, sin cursivas ni pesos 900, sin guiones en el texto.

## Espaciado y forma
Solo los pasos 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80 y 96 px. Tarjetas `16px` de radio; elementos internos
con la fórmula radio exterior menos separación. Botones principales 8 × 12 px.

## Componentes
- **Menú flotante** translúcido con desenfoque; en celular, panel a pantalla completa con enlaces escalonados.
- **Selector de modelo** segmentado con pastilla que se desliza.
- **Selector de año** con etiqueta de origen por año, flechas, teclado y "Recorrer años".
- **Mapa 3D** (motor `src/motor/mapa3d.js`) con encuadres por zona y detalle al hacer clic.
- **Ranking** de 16 filas que se reordenan con `transform`; barra centrada cuando hay valores negativos.
- **Frase grande** que se activa palabra por palabra al hacer scroll.
- **Recorrido**: motor scroll-world sobre clips de HyperFrames; texto calculado de los CSV.

## Movimiento
Curva `cubic-bezier(.22, 1, .36, 1)`, 500 ms para posición y 300 ms para color. Revelado de secciones con
`IntersectionObserver`, una sola vez. `prefers-reduced-motion` quita el movimiento y deja los cambios de opacidad.

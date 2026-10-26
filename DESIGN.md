# DESIGN — Chile en Relieve (mundo Pronóstico)

Registro del mundo visual construido. La fuente de verdad es el código: `src/landing/*`, `src/propuestas/pronostico.*`, `src/motor/mapa3d.js`.

## Recorrido
1. **Landing / globo** — noche azul profunda, globo ortográfico (d3-geo, canvas 2D) con costas finas, retícula tenue y trazos de viento animados que se desvanecen (campo de flujo sintético, rotulado como ilustrativo). Chile marcado con contorno ámbar. Título del trabajo arriba a la izquierda, botón "Empezar recorrido" abajo a la izquierda, coordenadas bajo el cursor abajo a la derecha. Arrastrar gira el globo; gira solo en reposo.
2. **Viaje** — al presionar el botón el texto se retira, el globo gira (interpolación geodésica) y se acerca hasta Chile, que se pinta con los colores del pronóstico justo donde quedará en el mapa 3D.
3. **Mapa Pronóstico** — fundido al estudio azul; las columnas crecen, los rótulos entran en cascada de norte a sur.

## Color
| Rol | Valor |
|---|---|
| Noche (landing) | `#030814`, centro `#0a1a38` |
| Océano del globo | `#12305c` → `#07142b` |
| Estudio TV | `#1662c4` → `#0f3f93` → `#0a2c6e` (radial) |
| Texto sobre azul | `#ffffff` / `#eef3fb`; secundario `#9fb2cf` |
| Tinta (rótulos) | `#0a1f47` |
| Escala de valor ("calor") | `#f7ecc2 #f6cf7a #f29a45 #e1592b #b52a24 #7e1c22` |
| Viento | `#2f5f9e #3f8fb0 #6cc3b4 #cfe9c8 #f5e9b0 #f3b562` |
| Acento / proyección | ámbar `#f3b562`, años proyectados `#ffd98a`; foco `#ffd34d` |

Estrategia: Committed (el azul es la superficie). La escala de valor es fija para todo el horizonte temporal.

## Tipografía
Archivo (variable, ejes `wdth` y `wght`) en todo el recorrido.
- Año gigante: 900, `font-stretch` 70%, 72–132px.
- Título del trabajo: 800, 82%, 30–64px, `text-wrap: balance`.
- Rótulos: nombre 600 mayúsculas 13px; cifra 800, 75%, cifras tabulares.
- Interfaz: 600–700, mayúsculas con tracking .04em.

## Componentes
- **Rótulo de región**: rectángulo blanco 4px de radio, franja izquierda con el color del valor, sombra dura `0 3px 0` (gráfica de TV). Columna a la derecha del mapa con líneas guía blancas; si no caben, casilleros parejos.
- **Canales** (modelos): botones rectangulares translúcidos; el activo es blanco con tinta.
- **Zócalo de años**: tira inferior con degradado; separador "PRONÓSTICO" en ámbar antes de los años proyectados.
- **Extendido**: tarjeta blanca con nombre, cifra grande y los próximos cuatro años como casilleros.
- **Botón Empezar recorrido**: blanco, 54px de alto, flecha que avanza al pasar el cursor.

## Movimiento
- Curva base `cubic-bezier(.16, 1, .3, 1)`; viaje del globo 2,6 s en ease-in-out cúbico.
- Un solo momento coreografiado: globo → Chile → estudio (fundido 1 s, rótulos con 55 ms de desfase).
- `prefers-reduced-motion`: sin viento, sin giro automático, viaje instantáneo.

## 3D
Shader propio en `mapa3d.js`, material `solido`: tapa con el color del valor, paredes oscurecidas por luz; bordes blancos al 85%. Chile vertical, cámara inclinada (0,93 / 0,36), encuadre calculado para que todo el país quepa en el área libre.

# Identidad visual de Hubly: logo «Secuencia» y mascota «Hubi»

Este directorio conserva la fuente de verdad de los activos gráficos de identidad aprobados por el dueño (Issue #53) y documenta el proceso reproducible de limpieza, vectorización y exportación para la web.

## 1. Estructura de recursos

- `docs/marca/originales/`: fuentes maestras de alta resolución (`1254×1254` para las variantes de Hubi y `1672×941` para la lámina de referencia `secuencia-h.png`). **No se sirven directamente en producción.**
- `apps/web/public/marca/`: derivados optimizados en formato WebP (2× del tamaño de uso en interfaz) e iconos PNG de aplicación web instalable (`192×192`, `512×512` y `512×512` *maskable*).
- `apps/web/src/app/`: iconos de convención de Next.js App Router (`favicon.ico` multirresolución `16×16` y `32×32`, `icon.png` `32×32` y `apple-icon.png` `180×180`) junto con `manifest.ts`.

## 2. Herramienta y parámetros de limpieza y conversión

La limpieza y generación de derivados se ejecuta una sola vez fuera del árbol de dependencias de Node (`riesgo:normal`, sin añadir paquetes a `package.json`) empleando:

- **Entorno:** `Python 3.12.10` con `Pillow 13.0.0`.
- **Limpieza de canal alfa y halo en los 8 PNG de cuerpo entero (`{origen|volumen}-{claro|oscuro}[-laptop].png`):**
  1. **Umbralizado de alfa:** todo píxel con `alfa < 8` pasa a `(R=0, G=0, B=0, A=0)` para eliminar el ruido residual de fondo (`alfa = 1`), y todo píxel con `alfa > 247` pasa a `A = 255` para corregir la semitransparencia accidental (`253–254`) del cuerpo.
  2. **Eliminación de halo y píxeles sueltos alrededor de la oreja azul:** se eliminan los residuos blanquecinos de baja opacidad (`alfa < 48` con `R, G, B > 210`), se filtran componentes conexas en 8-vecindad conservando exclusivamente la componente principal del cuerpo del gato y se ajusta el color de borde semitransparente de la oreja azul al píxel opaco interior más cercano, sin alterar la silueta ni las proporciones.
- **Exportación WebP (`apps/web/public/marca/`):**
  - Redimensionado con filtro `Image.Resampling.LANCZOS` y compresión `format="WEBP", quality=88, method=6`:
    - `hubi-origen-claro-256.webp` y `hubi-origen-oscuro-256.webp` (`256×256`, < 10 KB; límite < 60 KB).
    - `hubi-origen-claro-laptop-256.webp` y `hubi-origen-oscuro-laptop-256.webp` (`256×256`, < 10 KB; límite < 60 KB).
    - `hubi-volumen-claro-256.webp` y `hubi-volumen-oscuro-256.webp` (`256×256`, < 10 KB; límite < 60 KB).
    - `hubi-volumen-claro-laptop-512.webp` y `hubi-volumen-oscuro-laptop-512.webp` (`512×512`, < 20 KB; límite < 150 KB).
- **Iconos de aplicación a partir de `origen-oscuro-icono.png`:**
  - `apps/web/src/app/icon.png` (`32×32`, LANCZOS).
  - `apps/web/src/app/favicon.ico` (`16×16` y `32×32` embebidos; la oreja azul y los ojos mantienen legibilidad en ambos tamaños).
  - `apps/web/src/app/apple-icon.png` (`180×180`, LANCZOS).
  - `apps/web/public/marca/icon-192.png` (`192×192`, LANCZOS) e `icon-512.png` (`512×512`, LANCZOS).
  - `apps/web/public/marca/icon-maskable-512.png` (`512×512`): se escala el icono maestro al `74.2 %` (`380×380`) centrado sobre un lienzo de `512×512` con el mismo fondo grafito del icono original, garantizando que toda la cabeza y las orejas queden dentro del círculo de zona segura del `80 %` (radio máximo real `150.4 px <= 204.8 px`).

## 3. Logo vectorial «Secuencia» (`HublySymbol` y `HublyWordmark`)

- Implementado en `packages/ui/src/components/brand/HublyLogo.tsx` como SVG vectorial en línea redibujado desde cero a partir de la geometría de `secuencia-h.png`.
- **Autoría y licencia de trazos:** tanto los cinco módulos inclinados de la `H` (`HublySymbol`) como los contornos vectoriales `<path>` de las letras `H`, `u`, `b`, `l`, `y` (`HublyWordmark`) son trazos geométricos propios del repositorio convertidos directamente a curvas Bézier, sin etiquetas `<text>` ni dependencia de fuentes tipográficas externas.
- **Colores gobernados por tokens semánticos (#52):**
  - Módulos exteriores de la `H` y letras de «Hubly»: `var(--text-primary, currentColor)`.
  - Barra horizontal central de la `H`: `var(--accent-primary)`.
  - Cero valores hexadecimales incrustados en el SVG.

## Isologo de Hubi (#101, #111)

La firma activa de Hubly combina `HubiFace` con las letras de «Hubly» en `HubiWordmark`. El trazado SVG toma como referencia la cabeza de Hubi de cuerpo completo en `origen-claro.png` y `origen-oscuro.png`. La silueta tiene una relación de ancho a alto de aproximadamente 1,47:1, incluidas las orejas. Conserva la frente casi horizontal, la barbilla ancha y la posición de los rasgos al escalarse a 24, 28 y 32 px.

El tema solo cambia los colores, a través de `--text-primary` para la silueta, `--accent-primary` para la oreja azul y `--surface-canvas` para los ojos y la boca. Los iconos de instalación y las ilustraciones de cuerpo entero conservan sus propios recursos.

## Fraunces para la landing (#101)

Los WOFF2 de [Fraunces](https://github.com/undercasetype/Fraunces) proceden de Google Fonts CSS2 (revisión de distribución `v38`, versión interna `1.000` en el commit `b76b70a41`). La licencia [SIL OFL 1.1](fraunces-OFL.txt) se conserva junto a este documento.

Se incluyen solo `latin` y `latin-ext` en normal e itálica (eje `ital` en la consulta CSS2). Los archivos conservan los ejes variables `opsz` (9–144), `wght` (100–900), `SOFT` (0–100) y `WONK` (0–1). Hubly usa tamaño óptico automático, `SOFT=100`, `WONK=0`, peso 400 en titulares y 500 en tarjetas.

Next.js carga los archivos con `next/font/local` solo en `/`. Los titulares usan `--font-display`; el resto conserva la fuente del sistema. No se consulta Google Fonts en tiempo de ejecución.

## Poses de bienvenida y error (#114)

`Hubi` admite tres poses con acabado Volumen. La ilustración es decorativa y se acompaña del mensaje y de la acción de cada pantalla.

| Pose | Uso |
| --- | --- |
| `bienvenida` | Saluda en el diálogo al entrar después de confirmar la cuenta. |
| `buscar` | Usa la lupa en la página no encontrada (404). |
| `reparar` | Sostiene una llave en el error al cargar Hoy, junto a «Reintentar». |

Las seis imágenes se generaron con la herramienta integrada de ImageGen, usando `volumen-claro.png` y `volumen-oscuro.png` como referencias. Los PNG maestros se guardan como `volumen-{pose}-{tema}.png` en `originales/`. Los WebP de producción se exportaron con Sharp 0.35.5 a `256×256`, Lanczos3, calidad 88 y alfa 100, tras limpiar píxeles sueltos del borde. [Prompts de generación](poses-hubi-prompts.md).

# Página de enlaces sociales (`/bio` y `hubly.mx/@usuario`)

Estado: **Borrador en curso** — sin aprobación de Prisma ni del dueño
Issue: #262 (paraguas) · ADR pendiente en #263

> **Dónde quedó el trabajo.** Están definidas y verificadas las paletas de las 6 plantillas (sección 2). Faltan las secciones 3 a 6 (anatomía de la tarjeta pública, editor, marco de vista previa y movimiento) y la maqueta visual. Las decisiones de las secciones 3 a 6 que ya se tomaron están apuntadas como notas para no perderlas.

## 1. Decisiones de base

- **Ámbito de tokens propio.** La página pública no usa el tema claro u oscuro de quien la visita ni los estilos del espacio interno. Cada plantilla define sus variables `--bio-*` en un contenedor `[data-bio-plantilla="<id>"]`; no se sobrescribe ninguna variable global de `tokens.css`.
- **La plantilla ya es el modo.** Hay plantillas claras y oscuras; no cambian con `prefers-color-scheme`.
- **Sin color libre.** Solo las 6 plantillas cerradas, para garantizar AA.
- **Iconos de plataforma.** Las marcas de terceros se usan solo para identificar el enlace (uso nominativo), sin alterarlas, y su origen y licencia se anotan en [procedencia-de-assets.md](procedencia-de-assets.md) antes de integrarlas. Nada imita la apariencia de un competidor (Constitución, Producto n.º 4).
- **Fraunces** hoy solo se carga en la landing (`apps/web/src/fonts/fraunces.ts`). La ruta pública `/@usuario` tendrá que cargarlo también cuando la plantilla use `serif`.
- **`--glass-radius-panel` no existe** en `tokens.css`: los paneles del espacio usan `rounded-2xl` con `.hubly-glass`. El editor seguirá eso.

## 2. Plantillas: tokens y contraste

Verificación: `node docs/diseno/evidencia/pagina-social-contraste.mjs` → **90 parejas, todas cumplen AA** (texto ≥ 4,5:1; bordes, acento y foco ≥ 3:1). En las plantillas con degradado se mide contra cada parada y se toma el peor valor. Los colores traslúcidos se componen sobre el fondo antes de medir.

| Token | Uso |
|---|---|
| `--bio-fondo` | Fondo de la página (color o degradado) |
| `--bio-texto` / `--bio-texto-2` | Nombre y títulos / bio, usuario secundario y sello |
| `--bio-enlace-bg` / `--bio-enlace-bg-hover` | Fila de red social en reposo / hover y pulsado |
| `--bio-enlace-texto` / `--bio-enlace-texto-2` | Nombre de la red / etiqueta o usuario |
| `--bio-enlace-borde` | Borde de la fila (≥ 3:1 contra el fondo, porque la fila no siempre contrasta por relleno) |
| `--bio-cristal-bg` / `--bio-cristal-borde` | Relleno y borde del estilo de botón `glass` |
| `--bio-acento` / `--bio-sobre-acento` | Botones de contacto directo / su texto e icono |
| `--bio-acento-suave` / `--bio-acento-suave-texto` | Respaldo del avatar / su inicial |
| `--bio-foco` | Anillo de foco (≥ 3:1 contra fondo y contra la fila) |

### Valores

| Plantilla | fondo | texto | texto-2 | enlace-bg | enlace-bg-hover | enlace-borde | cristal-bg | cristal-borde | acento | sobre-acento | acento-suave | acento-suave-texto | foco |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `editorial-claro` | `#F4EFE6` | `#1F1B17` | `#5A5047` | `#FBF8F2` | `#EFE7DA` | `#8C8074` | `rgba(255,255,255,.55)` | `rgba(31,27,23,.52)` | `#A3452A` | `#FFFFFF` | `#F1DED3` | `#7A3018` | `#A3452A` |
| `nocturno-grafito` | `#121314` | `#F2EDE4` | `#BDB5A8` | `#1D1F21` | `#272A2D` | `#6B675F` | `rgba(242,237,228,.06)` | `rgba(242,237,228,.40)` | `#4FC79A` | `#0B1511` | `#16302A` | `#8FE0BF` | `#E8B04B` |
| `cristal-bruma` | degradado `#D9E3F0 → #EDF0F6 → #E3E1EE` | `#121722` | `#3C4557` | `rgba(255,255,255,.62)` | `rgba(255,255,255,.82)` | `rgba(18,23,34,.50)` | `rgba(255,255,255,.62)` | `rgba(18,23,34,.50)` | `#2F4A8A` | `#FFFFFF` | `rgba(47,74,138,.12)` | `#22386E` | `#2F4A8A` |
| `cristal-abismo` | degradado `#0B1222 → #141B33 → #0E1A24` | `#EEF2FA` | `#B4BED3` | `rgba(255,255,255,.07)` | `rgba(255,255,255,.13)` | `rgba(176,204,255,.50)` | `rgba(255,255,255,.07)` | `rgba(176,204,255,.50)` | `#8FB4FF` | `#0B1222` | `rgba(143,180,255,.16)` | `#C4D6FF` | `#A9C7FF` |
| `monocromo-tinta` | `#FFFFFF` | `#000000` | `#3A3A3A` | `#FFFFFF` | `#F0F0F0` | `#000000` | `rgba(0,0,0,.04)` | `rgba(0,0,0,.62)` | `#000000` | `#FFFFFF` | `#EDEDED` | `#000000` | `#000000` |
| `salvia-natural` | `#E8E6DF` | `#1C241E` | `#4A544C` | `#F4F3EE` | `#E2E5DC` | `#7A8179` | `rgba(255,255,255,.45)` | `rgba(28,36,30,.52)` | `#4B6852` | `#FFFFFF` | `#D5DDD3` | `#33493A` | `#3A5341` |

### Contraste más bajo por plantilla

| Plantilla | texto-2/fondo | texto-2/hover | borde/fondo | sobre-acento/acento | acento/fondo | foco/fondo |
|---|---|---|---|---|---|---|
| `editorial-claro` | 6,86 | 6,40 | 3,36 | 6,10 | 5,33 | 5,33 |
| `nocturno-grafito` | 9,16 | 7,10 | 3,30 | 8,82 | 8,83 | 9,52 |
| `cristal-bruma` | 7,43 | 9,20 | 3,20 | 8,51 | 6,56 | 6,56 |
| `cristal-abismo` | 9,11 | 6,16 | 3,61 | 9,02 | 8,22 | 9,97 |
| `monocromo-tinta` | 11,37 | 9,98 | 21,00 | 21,00 | 21,00 | 21,00 |
| `salvia-natural` | 6,31 | 6,19 | 3,21 | 6,17 | 4,94 | 6,74 |

### Estilos de botón

| Estilo | Radio | Relleno | Borde |
|---|---|---|---|
| `pill` | `--radius-full` | `--bio-enlace-bg` | `--bio-enlace-borde` |
| `rounded` | `--radius-xl` (16 px) | `--bio-enlace-bg` | `--bio-enlace-borde` |
| `sharp` | `--radius-sm` (4 px) | `--bio-enlace-bg` | `--bio-enlace-borde` |
| `glass` | `--radius-xl` | `--bio-cristal-bg` + desenfoque | `--bio-cristal-borde` |

Con `prefers-reduced-transparency: reduce`, `glass` se pinta con `--bio-enlace-bg` sin desenfoque.

## 3. Tarjeta pública (`SocialPagePublicView`) — pendiente

Notas ya decididas:
- Móvil: ancho completo con margen lateral `--space-5`; escritorio: columna centrada de 440 px (`27.5rem`, igual que `--container-access`).
- Orden: avatar → nombre → bio → fila de contacto directo (botones rellenos con `--bio-acento`, uno por canal activo, repartidos a partes iguales, mínimo 44 px de alto) → lista de redes (filas a todo lo ancho con icono, nombre o etiqueta, usuario en `--bio-enlace-texto-2` e indicador de enlace externo) → «Hecho con Hubly».
- Avatar sin imagen: inicial en Fraunces sobre `--bio-acento-suave`.
- Falta: medidas del avatar, escala tipográfica y estados de hover, foco y pulsado.

## 4. Editor (`/bio`) — pendiente

Falta: barra superior (selector de página en agencias, URL pública, copiar enlace, estado y Publicar), columnas de escritorio (paneles Perfil, Canales, Redes y Apariencia + vista previa), conmutador `Editar | Vista previa` en móvil, estado vacío y modo lectura.

## 5. Marco de vista previa — pendiente

## 6. Movimiento — pendiente

Debe seguir [movimiento.md](movimiento.md): solo `transform` y `opacity`, ≤ 300 ms, `--motion-ease` al responder y `--motion-ease-move` al reordenar, con su regla de movimiento reducido.

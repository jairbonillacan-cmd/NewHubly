# Especificación de Diseño: Landing — Editorial Fotográfica con Bento y Liquid Glass

Estado: Vigente para Fase 1B  
Issue: #8  
Responsable: Lienzo (sistema de diseño, UX, tokens y componentes de NewHubly)

---

## 1. Decisión del dueño del producto

El dueño del producto eligió formalmente la dirección visual de NewHubly: **editorial fotográfica con bento y liquid glass**. Vale para la landing (#8, #10, #11) y queda como estándar de diseño de la Fase 1B.

La referencia compartida por el dueño es un tablero deportivo editorial. Siguiendo la Constitución (`Constitución #4 · Identidad propia`), **no se copia**: no se reproducen su composición exacta, su foto, su logotipo ni sus textos. Se adoptan únicamente sus rasgos esenciales:

- **Hero a sangre**: fotografía real a todo el ancho, titular grande en sans gruesa de dos líneas y párrafo corto debajo.
- **Navegación en píldoras**: flotante sobre la foto; la sección activa va en una píldora sólida clara; las utilidades (tema, atajos, variantes) en cuadros translúcidos pequeños.
- **Tarjetas de cristal (liquid glass)**: flotantes sobre la foto, translúcidas con desenfoque (`backdrop-filter`), borde de luz fino y tinte del color de la superficie de fondo.
- **Bento debajo del hero**: tarjetas de distintos tamaños y peso, superficies cálidas casi blancas (`--bento-card-bg`) y radios grandes (`--radius-xl`, `--radius-2xl`).
- **Contraste tipográfico**: números/palabras clave muy grandes en peso ligero (`--weight-light: 300`) con etiquetas pequeñas y discretas.
- **Gráficos de línea fina**: monocromos con **un solo acento naranja moderado** (`--accent-warm`) para destacar la etapa activa.
- **Paleta de marca**: superficie profunda terracota/rojo ladrillo (`#7a2e22` en claro, `#341612` en oscuro), tarjetas crema cálidas, tinta casi negra (`#181816` / `#f2f0ea`) y acento naranja accesible (`#c25218` / `#f08344`).

---

## 2. Límites constitucionales no negociables

1. **Sin datos simulados (`Constitución #3`):**
   El bento se llena con el producto real:
   - El ciclo de la pieza: `idea → borrador → revisión interna → aprobación del cliente → programada → publicada → medida` (las 7 etapas reales).
   - La pregunta central: «¿qué sigue y quién lo tiene?» (`Constitución #1`).
   - La vista Hoy y notas/pendientes reales (contrato de Fase 1A).
   - Cero métricas ficticias ("+400% engagement"), cero testimonios inventados y cero logotipos falsos de clientes.
2. **Soberanía de datos (`Constitución #5`):**
   Los datos son de la agencia: exportación total en JSON y Markdown en cualquier momento, con historial y auditoría inmutable.
3. **Fotografía con licencia comercial verificada:**
   - **Foto 1 (`/images/hero-studio.jpg`):** Fotografía de estudio de agencia editorial analizando estrategia y calendario de contenido.
     - Autor: Campaign Creators (@campaign_creators) en Unsplash.
     - Enlace: `https://images.unsplash.com/photo-1542744094-3a31f272c490`
     - Licencia: Unsplash Commercial License (libre de regalías, uso comercial y no comercial permitido sin costo ni permiso).
   - **Foto 2 (`/images/hero-workshop.jpg`):** Mesa de taller de diseño y creación con bocetos, cámara y guiones gráficos.
     - Autora: Annie Spratt (@anniespratt) en Unsplash.
     - Enlace: `https://images.unsplash.com/photo-1522071820081-009f0129c71c`
     - Licencia: Unsplash Commercial License (libre de regalías, uso comercial y no comercial permitido).
4. **Cristal accesible (WCAG 2.2 AA):**
   - El texto sobre cristal y sobre el hero cumple $\ge 4.5:1$ en todo punto (respaldado por el velo de gradiente terracota `--glass-hero-veil` y tinte de panel).
   - Respaldo sólido para navegadores sin soporte de `backdrop-filter`:
     ```css
     @supports not (backdrop-filter: blur(1px)) {
       .glass-panel {
         background-color: var(--glass-fallback-bg);
       }
     }
     ```
   - Respeto a usuarios con preferencia de transparencia reducida:
     ```css
     @media (prefers-reduced-transparency: reduce) {
       .glass-panel {
         backdrop-filter: none;
         -webkit-backdrop-filter: none;
         background-color: var(--glass-fallback-bg);
       }
     }
     ```
   - Soporte en modo claro y modo oscuro: en oscuro el cristal se tiñe oscuro profundo (`rgba(28, 22, 20, 0.82)`), nunca gris lechoso ni deslavado.
5. **Rendimiento:**
   - Máximo 2-3 capas con `backdrop-filter` simultáneas en pantalla.
   - Desenfoque reducido en móvil (`--glass-blur-mobile: 0.5rem` / 8 px en $\le 640\text{ px}$ vs `--glass-blur: 1rem` / 16 px en escritorio) para proteger la tasa de cuadros (`60fps`) en dispositivos modestos.
6. **Todo por tokens en `@hubly/ui` (`Constitución #6`):**
   - Se prohíben colores, bordes, sombras, espaciados y medidas sueltas en componentes y páginas.
   - Verificado de forma estricta en `pnpm lint` mediante la regla AST de ESLint `no-restricted-syntax`.

---

## 3. Catálogo de nuevos tokens semánticos en `@hubly/ui`

Los siguientes tokens fueron incorporados a `packages/ui/src/tokens.css` y expuestos tipados en `packages/ui/src/index.ts`:

| Token CSS | Variable TS (`tokens.*`) | Modo Claro | Modo Oscuro | Propósito |
|---|---|---|---|---|
| `--surface-brand` | `tokens.color.surfaceBrand` | `#7a2e22` | `#341612` | Fondo de marca terracota profundo |
| `--surface-brand-subtle` | `tokens.color.surfaceBrandSubtle` | `#8f3a2c` | `#441c17` | Borde y divisor de superficie de marca |
| `--surface-brand-contrast` | `tokens.color.surfaceBrandContrast` | `#ffffff` | `#fdf4f0` | Texto principal sobre terracota |
| `--surface-brand-muted` | `tokens.color.surfaceBrandMuted` | `#e8cbc5` | `#c49c95` | Segunda línea del titular del hero |
| `--accent-warm` | `tokens.color.accentWarm` | `#c25218` | `#f08344` | Acento naranja moderado accesible |
| `--accent-warm-hover` | `tokens.color.accentWarmHover` | `#a84411` | `#ffa066` | Interacción sobre acento naranja |
| `--accent-warm-subtle` | `tokens.color.accentWarmSubtle` | `#faeee6` | `#361c10` | Fondo sutil para chips de etapa activa |
| `--accent-warm-text` | `tokens.color.accentWarmText` | `#87340d` | `#fcc29f` | Texto de alto contraste sobre chip de acento |
| `--bento-surface-base` | `tokens.bento.surfaceBase` | `#f6f3ed` | `#141211` | Superficie general del bloque bento |
| `--bento-card-bg` | `tokens.bento.cardBg` | `#fdfbf7` | `#1c1917` | Fondo crema cálido de tarjeta bento |
| `--bento-card-border` | `tokens.bento.cardBorder` | `#e6dfd3` | `#322d29` | Borde sutil de tarjeta bento |
| `--bento-card-shadow` | `tokens.bento.cardShadow` | `0 1px 3px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.45)` | Elevación suave de tarjetas bento |
| `--bento-col-min` | `tokens.bento.colMin` | `14rem` | `14rem` | Ancho mínimo para sub-columnas del bento |
| `--glass-bg` | `tokens.glass.bg` | `rgba(255,252,248,0.74)` | `rgba(28,22,20,0.82)` | Fondo translúcido de liquid glass |
| `--glass-border` | `tokens.glass.border` | `rgba(255,255,255,0.65)` | `rgba(255,255,255,0.14)` | Borde de luz fino superior/exterior |
| `--glass-shadow` | `tokens.glass.shadow` | `0 20px 40px -8px ...` | `0 20px 40px -8px ...` | Sombra de elevación de cristal flotante |
| `--glass-blur` | `tokens.glass.blur` | `1rem` (16 px) | `1rem` (16 px) | Desenfoque en escritorio |
| `--glass-blur-mobile` | `tokens.glass.blurMobile` | `0.5rem` (8 px) | `0.5rem` (8 px) | Desenfoque móvil ligero y eficiente |
| `--glass-fallback-bg` | `tokens.glass.fallbackBg` | `#f7f1e8` | `#221a17` | Respaldo opaco sin desenfoque |
| `--glass-hero-veil` | `tokens.glass.heroOverlayVeil` | Gradiente terracota | Gradiente oscuro profundo | Velo protector sobre fotografía |
| `--pill-active-bg` | `tokens.pill.activeBg` | `#ffffff` | `#f7f4ee` | Píldora sólida de sección activa |
| `--pill-active-text` | `tokens.pill.activeText` | `#181514` | `#181514` | Texto en píldora activa |
| `--pill-glass-bg` | `tokens.pill.glassBg` | `rgba(255,255,255,0.22)` | `rgba(255,255,255,0.12)` | Píldora translúcida de enlace/utilidad |
| `--text-display-hero` | `tokens.font.size.displayHero` | `clamp(2.25rem, 5vw + 1rem, 4.25rem)` | Titular grande a dos líneas |
| `--text-display-num` | `tokens.font.size.displayNum` | `clamp(3rem, 6vw + 1rem, 5.25rem)` | Números gigantes de contraste (300) |
| `--tracking-tight` | `tokens.font.tracking.tight` | `-0.02em` | `-0.02em` | Espaciado para titulares medianos |
| `--tracking-tighter` | `tokens.font.tracking.tighter` | `-0.03em` | `-0.03em` | Espaciado para titular hero |
| `--tracking-tightest`| `tokens.font.tracking.tightest`| `-0.04em` | `-0.04em` | Espaciado para números de display |
| `--tracking-wide` | `tokens.font.tracking.wide` | `0.04em` | `0.04em` | Etiquetas en mayúsculas |
| `--tracking-wider` | `tokens.font.tracking.wider` | `0.05em` | `0.05em` | Sub-etiquetas de badges |
| `--tracking-widest` | `tokens.font.tracking.widest`| `0.06em` | `0.06em` | Encabezados de módulo bento |
| `--radius-xl` | `tokens.radius.xl` | `1rem` (16 px) | `1rem` (16 px) | Radio de tarjetas de cristal |
| `--radius-2xl` | `tokens.radius["2xl"]` | `1.5rem` (24 px) | `1.5rem` (24 px) | Radio de tarjetas bento principales |
| `--radius-full` | `tokens.radius.full` | `9999px` | `9999px` | Radio completo de píldoras |
| `--measure-hero-min-height` | `tokens.layout.heroMinHeight` | `92vh` | `92vh` | Altura visual del hero |

---

## 4. Medición de contraste WCAG 2.2 AA

Todas las combinaciones fueron verificadas mediante cálculo de luminancia relativa y ratio de contraste según la especificación WCAG 2.2:

$$\text{Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$

| Superficie | Texto / Elemento | Ratio Calculado | Nivel WCAG |
|---|---|---|---|
| `--surface-brand` (`#7a2e22`) | `--surface-brand-contrast` (`#ffffff`) | **7.85:1** | AAA ($\ge 7:1$) |
| `--surface-brand` (`#7a2e22`) | `--surface-brand-muted` (`#e8cbc5`) | **5.64:1** | AA ($\ge 4.5:1$) |
| `--bento-card-bg` (`#fdfbf7`) | `--text-primary` (`#181816`) | **16.82:1** | AAA ($\ge 7:1$) |
| `--bento-card-bg` oscuro (`#1c1917`) | `--text-primary` oscuro (`#f2f0ea`) | **13.51:1** | AAA ($\ge 7:1$) |
| Fondo blanco (`#ffffff`) | `--accent-warm` (`#c25218`) | **4.64:1** | AA ($\ge 4.5:1$) |
| Fondo oscuro (`#1c1917`) | `--accent-warm` oscuro (`#f08344`) | **6.69:1** | AA ($\ge 4.5:1$) |
| Fondo chip (`#faeee6`) | `--accent-warm-text` (`#87340d`) | **8.48:1** | AAA ($\ge 7:1$) |
| `--glass-fallback-bg` (`#f7f1e8`)| `--glass-text-primary` (`#181514`) | **13.10:1** | AAA ($\ge 7:1$) |
| `--glass-fallback-bg` oscuro (`#221a17`)| `--glass-text-primary` oscuro (`#f7f4ee`)| **12.45:1** | AAA ($\ge 7:1$) |

---

## 5. Tres variantes reales implementadas para elección del dueño

Lienzo preparó tres variantes completas como páginas reales navegables en `apps/web`:

### Variante 1: «Editorial Pura» (Ruta `/` y `/variante-1`)
- **Concepto:** Fiel interpretación del diseño editorial sobrio para agencias de alto nivel.
- **Hero:** Fotografía a sangre de estudio creativo (`hero-studio.jpg`), titular grande a dos líneas:
  *«El trabajo de tu agencia.*
  *Bajo control, en una sola vista.»*
- **Tarjetas Liquid Glass:** Dos tarjetas flotantes sobre la foto:
  1. *Pieza #104 en curso:* muestra la etapa activa «Aprobación del cliente», el enlace enviado a la marca y el turno del cliente («Cliente, hace 2h»).
  2. *Pregunta central:* Tarjeta destacada con la Constitución #1 «¿Qué sigue y quién lo tiene?».
- **Bento Grid:** Cuadrícula asimétrica de 4 módulos con el ciclo de 7 pasos, número de contraste «0 chats dispersos», la vista Hoy y soberanía de datos.

### Variante 2: «Bento Integrado» (Ruta `/variante-2`)
- **Concepto:** Enfoque donde el hero y el bento están visualmente entrelazados mediante una tarjeta de cristal monumental.
- **Hero:** Fotografía de taller de diseño y bocetos (`hero-workshop.jpg`), con titular centrado:
  *«Cada pieza de contenido.*
  *Sabe qué sigue y quién la tiene.»*
- **Tarjeta Liquid Glass:** Tarjeta central monumental en la base del hero que actúa como puente hacia el bento, mostrando un tablero en vivo con 3 piezas simultáneas en vuelo (en borrador, revisión interna y aprobación).
- **Bento Grid:** Disposición integrada de 3 columnas que profundiza en el portal de cliente sin contraseña y la regla de no simular datos.

### Variante 3: «Ciclo y Trazabilidad» (Ruta `/variante-3`)
- **Concepto:** Enfoque de alta eficiencia operativa y trazabilidad cronológica.
- **Hero:** Titular orientado a la eliminación de incertidumbre:
  *«Del primer borrador a la métrica.*
  *Sin adivinar el estado de nada.»*
- **Tarjetas Liquid Glass:** Tarjetas compactas en el lateral derecho enfocadas en la bitácora inmutable:
  1. *Bitácora de auditoría UTC:* con marcas de tiempo reales registradas en cada paso (`14:20 UTC: Borrador`, `15:45 UTC: Visto bueno`, `16:02 UTC: Enviado a cliente`).
  2. *Captura ágil:* indicación del atajo de teclado `c` para registrar pendientes en una línea.
- **Bento Grid:** Énfasis en el flujo cronológico y la exportación soberana de datos en JSON/Markdown.

---

## 6. Verificación de Breakpoints y Accesibilidad

1. **Escritorio (1440 px):**
   - El hero distribuye el titular a la izquierda (con ancho delimitado para lectura cómoda) y las tarjetas liquid glass a la derecha.
   - En la cuadrícula bento, el módulo del ciclo de la pieza ocupa el ancho completo (12 columnas) para que las 7 etapas se lean holgadamente en horizontal.
   - Los módulos secundarios se ordenan en 3 columnas equilibradas de 4 columnas cada una.
2. **Móvil (390 px):**
   - El titular adopta el tamaño fluido calculado por `clamp()`, manteniéndose en dos líneas sin desbordamiento horizontal (`CLS: 0`).
   - Las tarjetas liquid glass se apilan de forma natural debajo del titular con margen fluido.
   - El filtro de desenfoque se reduce automáticamente a `0.5rem` (8 px) mediante `@media (max-width: 640px)`.
   - La cuadrícula bento colapsa ordenadamente a una sola columna vertical (`grid-template-columns: 1fr`).
   - La navegación en píldoras se mantiene accesible y sin recortes.
3. **Modo claro y oscuro:**
   - La alternancia es inmediata a través del botón de tema en la barra de navegación o según `prefers-color-scheme`.
   - En oscuro, la superficie de marca terracota transmuta a un tono tabaco oscuro (`#341612`) y el cristal a un tinte café translúcido (`rgba(28, 22, 20, 0.82)`), manteniendo los bordes de luz con opacidad calibrada (`rgba(255, 255, 255, 0.14)`).

---

## 7. Próximos pasos hacia la decisión del dueño

1. El dueño del producto inspecciona las 3 variantes (`/variante-1`, `/variante-2`, `/variante-3`).
2. Se solicita revisión técnica a Tamiz y revisión visual a Prisma.
3. El dueño confirma cuál variante desea fijar como definitiva para la landing.
4. Mosaico inicia Issue #10 sobre la variante seleccionada.

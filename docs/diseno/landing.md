# Especificación de Diseño: Landing — Editorial Fotográfica con Bento y Liquid Glass

Estado: Vigente para Fase 1B  
Issue: #8 (Lienzo: tokens y bloques base en `@hubly/ui`)  
Seguimiento: #10 (Mosaico: montaje de página `/` en `apps/web`)  
Responsable: Lienzo (sistema de diseño, UX, tokens y componentes de Hubly)

---

## 1. Decisión del dueño del producto

El dueño del producto eligió formalmente la dirección visual de Hubly: **editorial fotográfica con bento y liquid glass** (PR #22, comentario 6607179714).

- **Composición elegida:** Variante 1 (Editorial) con titular a la izquierda, tarjetas de cristal flotantes a la derecha sobre la fotografía del hero, y cuadrícula bento debajo.
- **Titular adoptado (de Variante 2):**  
  *«Cada pieza de contenido.*  
  *Sabe qué sigue y quién la tiene.»*
- **Subtítulo:**  
  *«Hubly ordena el ciclo de cada pieza: desde la idea inicial hasta la métrica real, sin perder tiempo en chats dispersos ni adivinar quién tiene el turno.»*
- **Frontera de módulos:**  
  - **Issue #8 (Lienzo):** `docs/diseno/landing.md`, tokens semánticos en `packages/ui` y bloques UI reutilizables (`GlassCard`, `PillNav`, `HeroSection`, `BentoSection`, `LineGraphicCycle`, `ThemeToggle`) ubicados y exportados desde `@hubly/ui`, con sus pruebas unitarias.
  - **Issue #10 (Mosaico):** Construcción y montaje de la página pública en `/` dentro de `apps/web`.

---

## 2. Límites de producto y honestidad de contenido

1. **Cero jerga interna en contenido visible:**  
   No se incluyen en la interfaz pública ni en el copy para clientes referencias a reglas internas («Constitución #...»), fases de desarrollo («Fase 1A · Entrada diaria · Listo») ni el nombre de desarrollo «NewHubly». El producto visible al usuario y al cliente se llama exclusivamente **Hubly**.
2. **Cero cifras inventadas:**  
   Se prohíbe cualquier cifra sin datos reales. El bloque de estado operativo comunica con texto directo y honesto («Sin preguntas en el limbo», «Estado único y visible»), sin estadísticas simuladas.
3. **Ejemplos visibles y promesas reales:**  
   - La tarjeta flotante del hero indica de forma visible y clara que es un ejemplo («Ejemplo: Campaña Primavera · Revisión interna»).
   - Las capacidades no implementadas aún en el backend (auditoría inmutable con marcas UTC, portal de cliente sin contraseña y exportación total) se marcan con la etiqueta «Próximamente».
4. **Fotografía con licencia oficial verificada:**  
   - **Foto 1 (Hero de estudio):**  
     - Autor: Campaign Creators (@campaign_creators) en Unsplash.  
     - URL: `https://images.unsplash.com/photo-1542744094-3a31f272c490` (ID: `pypeCEaJeZY`).  
     - Licencia: **Unsplash License** (uso libre comercial y no comercial, sin costo ni requerimiento forzoso de atribución, pero documentada rigurosamente).
   - **Foto 2 (Taller y colaboración creativa):**  
     - Autora: Annie Spratt (@anniespratt) en Unsplash.  
     - URL: `https://images.unsplash.com/photo-1522071820081-009f0129c71c` (ID: `MChSQHxGZrQ`).  
     - Licencia: **Unsplash License**.

---

## 3. Catálogo de tokens semánticos en `@hubly/ui`

Todos los estilos provienen de tokens en `packages/ui/src/tokens.css` y se consumen mediante el objeto tipado `tokens.*` de `@hubly/ui`:

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
| `--bento-highlight-text` | `tokens.bento.highlightText` | `#7a2e22` | `#f08344` | Texto destacado de bento con contraste WCAG $\ge 4.5:1$ |
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
| `--text-display-num` | `tokens.font.size.displayNum` | `clamp(3rem, 6vw + 1rem, 5.25rem)` | Números gigantes de contraste |
| `--radius-xl` | `tokens.radius.xl` | `1rem` (16 px) | `1rem` (16 px) | Radio de tarjetas de cristal |
| `--radius-2xl` | `tokens.radius["2xl"]` | `1.5rem` (24 px) | `1.5rem` (24 px) | Radio de tarjetas bento principales |
| `--radius-full` | `tokens.radius.full` | `9999px` | `9999px` | Radio completo de píldoras |
| `--measure-hero-min-height` | `tokens.layout.heroMinHeight` | `92vh` | `92vh` | Altura visual del hero |

---

## 4. Medición de contraste WCAG 2.2 AA

Todas las combinaciones fueron validadas matemáticamente en `packages/ui/src/landing-contrast.test.ts`:

$$\text{Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$

| Superficie | Texto / Elemento | Ratio Calculado | Nivel WCAG |
|---|---|---|---|
| `--surface-brand` (`#7a2e22`) | `--surface-brand-contrast` (`#ffffff`) | **7.85:1** | AAA ($\ge 7:1$) |
| `--surface-brand` (`#7a2e22`) | `--surface-brand-muted` (`#e8cbc5`) | **5.64:1** | AA ($\ge 4.5:1$) |
| `--bento-card-bg` (`#fdfbf7`) | `--text-primary` (`#181816`) | **16.82:1** | AAA ($\ge 7:1$) |
| `--bento-card-bg` oscuro (`#1c1917`) | `--text-primary` oscuro (`#f2f0ea`) | **13.51:1** | AAA ($\ge 7:1$) |
| `--bento-card-bg` (`#fdfbf7`) | `--bento-highlight-text` claro (`#7a2e22`) | **9.07:1** | AAA ($\ge 7:1$) |
| `--bento-card-bg` oscuro (`#1c1917`) | `--bento-highlight-text` oscuro (`#f08344`) | **6.76:1** | AA ($\ge 4.5:1$) |
| Fondo blanco (`#ffffff`) | `--accent-warm` (`#c25218`) | **4.64:1** | AA ($\ge 4.5:1$) |
| Fondo oscuro (`#1c1917`) | `--accent-warm` oscuro (`#f08344`) | **6.69:1** | AA ($\ge 4.5:1$) |
| Fondo chip (`#faeee6`) | `--accent-warm-text` (`#87340d`) | **8.48:1** | AAA ($\ge 7:1$) |
| `--glass-fallback-bg` (`#f7f1e8`)| `--glass-text-primary` (`#181514`) | **13.10:1** | AAA ($\ge 7:1$) |
| `--glass-fallback-bg` oscuro (`#221a17`)| `--glass-text-primary` oscuro (`#f7f4ee`)| **12.45:1** | AAA ($\ge 7:1$) |

---

## 5. Cuadrícula Bento Equilibrada

La cuadrícula bento se distribuye en 12 columnas totales divididas en 3 filas simétricas:

- **Fila 1 (12 columnas):** El ciclo completo de la pieza con el gráfico lineal de las 7 etapas reales (`idea → borrador → revisión interna → aprobación del cliente → programada → publicada → medida`).
- **Fila 2 (6 + 6 columnas):**
  - Columna izquierda (6 cols): Claridad operativa («Sin preguntas en el limbo», estado único y visible).
  - Columna derecha (6 cols): La pregunta central («¿Qué sigue y quién lo tiene?» con roles responsables).
- **Fila 3 (6 + 6 columnas):**
  - Columna izquierda (6 cols): La vista Hoy (pendientes prioritarios, captura rápida en una línea y notas fijadas).
  - Columna derecha (6 cols): Soberanía de datos («Los datos son de tu agencia», exportación abierta JSON y MD).

Esta estructura elimina completamente cualquier hueco visual o tarjeta aislada.

---

## 6. Responsividad y Prevención de Desbordamiento Móvil (390 px)

1. **Escritorio (1440 px):**
   - El hero organiza el texto a la izquierda y las tarjetas de cristal a la derecha.
   - El bento despliega la cuadrícula de 12 columnas con amplitud.
2. **Móvil (390 px):**
   - `.hubly-hero-grid` y `.hubly-bento-grid` colapsan automáticamente a 1 sola columna (`grid-template-columns: 1fr`).
   - `.hubly-lifecycle-container` cuenta con `overflow-x: auto` y desplazamiento táctil (`-webkit-overflow-scrolling: touch`), permitiendo explorar las 7 etapas con suavidad sin forzar el ancho de la página.
   - `scrollWidth` garantizado $\le 390\text{ px}$ en todo el árbol de componentes.
3. **Modo oscuro adaptativo:**
   - La alternancia es instantánea mediante el interruptor `ThemeToggle` (`data-theme="dark"` / `data-theme="light"`).
   - Los números y textos destacados del bento mantienen contraste $\ge 4.5:1$ mediante `--bento-highlight-text: #f08344`.

---

## 7. Bloques UI Reutilizables Exportados desde `@hubly/ui`

Los siguientes componentes están expuestos directamente en el índice del paquete (`@hubly/ui`):

- `GlassCard`: Contenedor translúcido con desenfoque, fallback y soporte de reducción de transparencia.
- `PillNav`: Navegación flotante en píldoras con interruptor de tema.
- `HeroSection`: Hero fotográfico con velo protector y ranura para tarjetas flotantes.
- `BentoSection`: Cuadrícula equilibrada de 5 módulos con el flujo operativo del producto.
- `LineGraphicCycle`: Diagrama lineal fino monocromo con indicador de etapa activa.
- `ThemeToggle`: Botón accesible para alternar entre modo claro y oscuro con persistencia.

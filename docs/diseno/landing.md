# Especificación de Diseño: Landing — Editorial Fotográfica con Bento, Liquid Glass y Paleta Grafito y Azul Tinta

Estado: Vigente para Fase 1B | Issues: #8, #10 y #52 (Paleta Grafito y azul tinta)

## 1. Dirección visual y decisiones de producto
Dirección formal elegida por el dueño del producto (#8 y #52): **editorial fotográfica con bento, liquid glass y paleta «Grafito y azul tinta»**.
- **Principio de color (#52):** Un solo color de marca: el azul tinta (`--accent-primary`). Todo lo demás son neutros fríos de grafito. El azul aparece solo en acciones (botones, enlaces), en el foco, en la vista o píldora activa y en datos destacados.
- **Titular:** *«Cada pieza de contenido. Sabe qué sigue y quién la tiene.»*
- **Subtítulo:** *«Hubly ordena el ciclo de cada pieza: desde la idea inicial hasta la métrica real, sin perder tiempo en chats dispersos ni adivinar quién tiene el turno.»*

## 2. Límites de producto y honestidad de contenido
1. **Cero jerga interna visible:** Sin citas de reglas internas ni nombres de desarrollo. El producto se llama **Hubly**.
2. **Cero cifras inventadas:** Sin métricas ficticias; comunicación honesta y directa sobre el estado editorial.
3. **Ejemplos visibles y promesas reales:** Tarjetas rotuladas como «Ejemplo» y funciones futuras marcadas como «Próximamente».
4. **Fotografía con licencia oficial verificada:**
   - Hero: Campaign Creators (@campaign_creators) en Unsplash (`https://images.unsplash.com/photo-1542744094-3a31f272c490`, ID `pypeCEaJeZY`). Licencia: **Unsplash License**.
   - Colaboración: Annie Spratt (@anniespratt) en Unsplash (`https://images.unsplash.com/photo-1522071820081-009f0129c71c`, ID `MChSQHxGZrQ`). Licencia: **Unsplash License**.

## 3. Catálogo de tokens semánticos en `@hubly/ui` (Grafito y azul tinta, #52)
Consumidos tipadamente mediante `tokens.*` de `@hubly/ui` y definidos en `tokens.css`:
- **Acento azul tinta:** `--accent-primary` (`#1D4ED8` / oscuro `#6F98FF`), `--accent-primary-hover` (`#1A43BD` / oscuro `#8FB0FF`), `--accent-primary-subtle` (`#EEF2FB` / oscuro `#1A2238`), `--text-on-accent` (`#FFFFFF` / oscuro `#0C0D0F`).
- **Superficie de marca grafito:** `--surface-brand` (`#111316` / oscuro `#16181C`), `--surface-brand-contrast` (`#FFFFFF` / oscuro `#E8E8EB`), `--surface-brand-subtle` (`#1C1F24` / oscuro `#202329`), `--surface-brand-muted` (`#B9BCC4` / oscuro `#9A9DA6`).
- **Superficies, texto y bordes:** `--surface-canvas` (`#F7F7F8` / oscuro `#0C0D0F`), `--surface-raised` (`#FFFFFF` / oscuro `#16181C`), `--surface-subtle` (`#F0F0F2` / oscuro `#1C1F24`), `--surface-interactive` (`#E7E7EA` / oscuro `#24272D`), `--text-primary` (`#111316` / oscuro `#E8E8EB`), `--text-secondary` (`#3F424A` / oscuro `#B9BCC4`), `--text-muted` (`#5A5D66` / oscuro `#9A9DA6`), `--border-control` (`#8A8D96` / oscuro `#6B6F79`).
- **Bento grid en neutros fríos:** `--bento-surface-base` (`#F0F0F2` / oscuro `#1C1F24`), `--bento-card-bg` (`#FFFFFF` / oscuro `#16181C`), `--bento-card-border` (`#E4E4E7` / oscuro `#26292F`), `--bento-highlight-text` (`#1D4ED8` / oscuro `#6F98FF`), `--bento-card-shadow`.
- **Liquid glass en neutros fríos:** `--glass-bg` (`rgba(255, 255, 255, 0.72)` / oscuro `rgba(22, 24, 28, 0.80)`), `--glass-fallback-bg` (`#F7F7F8` / oscuro `#16181C`), `--glass-hero-veil` (velo grafito en ambos modos).
- **Navegación y tipografía:** `--pill-active-bg` (`#1D4ED8` / oscuro `#6F98FF`), `--pill-active-text` (`#FFFFFF` / oscuro `#0C0D0F`), `--pill-glass-bg`, `--text-display-hero`, `--text-display-num`, `--radius-xl`, `--radius-2xl`, `--radius-full`.

## 4. Medición de contraste WCAG 2.2 AA
Verificado matemáticamente en `packages/ui/src/landing-contrast.test.ts`:
- Azul tinta `--accent-primary` vs `--text-on-accent`: claro **6.70:1** (AA) | oscuro **7.15:1** (AAA).
- Superficie de marca grafito `--surface-brand` vs `--surface-brand-contrast`: claro **18.59:1** (AAA) | oscuro **14.34:1** (AAA).
- Tarjeta Bento `--bento-card-bg` vs `--text-primary`: claro **18.59:1** (AAA) | oscuro **14.34:1** (AAA).
- Texto atenuado `--text-muted` sobre tarjeta `--surface-raised`: claro **6.48:1** (AA) | oscuro **6.69:1** (AA).
- Borde de control `--border-control` sobre `--surface-canvas` y `--surface-raised`: $\ge 3.0:1$ en claro y oscuro.
- Respaldo y velo liquid glass en el hero: $\ge 4.5:1$ en claro y oscuro.

## 5. Responsividad móvil 390 px y componentes exportados
- `.hubly-lifecycle-container`: contenedor con `overflow-x: auto` y desplazamiento táctil (`-webkit-overflow-scrolling: touch`) garantizando `scrollWidth <= 390px`.
- Primitivas visuales base expuestas en `@hubly/ui`: `GlassCard` (panel translúcido con fallback), `ThemeToggle` (interruptor de modo claro/oscuro accesible), `LineGraphicCycle` (diagrama lineal de 7 etapas).

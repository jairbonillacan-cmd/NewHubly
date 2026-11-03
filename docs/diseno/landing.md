# Especificación de Diseño: Landing — Editorial Fotográfica con Bento y Liquid Glass

Estado: Vigente para Fase 1B | Issue: #8 (Lienzo: tokens y bloques base en `@hubly/ui`) | Seguimiento: #10 (Mosaico: montaje `/` en `apps/web`)

## 1. Dirección visual y decisiones de producto
Dirección formal elegida por el dueño del producto (PR #22, comentario 6607179714): **editorial fotográfica con bento y liquid glass**.
- **Titular:** *«Cada pieza de contenido. Sabe qué sigue y quién la tiene.»*
- **Subtítulo:** *«Hubly ordena el ciclo de cada pieza: desde la idea inicial hasta la métrica real, sin perder tiempo en chats dispersos ni adivinar quién tiene el turno.»*
- **Fronteras:** Issue #8 aporta documentación, tokens y primitivas base en `@hubly/ui`. Issue #10 montará la página en `apps/web`.

## 2. Límites de producto y honestidad de contenido
1. **Cero jerga interna visible:** Sin citas de reglas internas ni nombres de desarrollo. El producto se llama **Hubly**.
2. **Cero cifras inventadas:** Sin métricas ficticias; comunicación honesta y directa sobre el estado editorial.
3. **Ejemplos visibles y promesas reales:** Tarjetas rotuladas como «Ejemplo» y funciones futuras marcadas como «Próximamente».
4. **Fotografía con licencia oficial verificada:**
   - Hero: Campaign Creators (@campaign_creators) en Unsplash (`https://images.unsplash.com/photo-1542744094-3a31f272c490`, ID `pypeCEaJeZY`). Licencia: **Unsplash License**.
   - Colaboración: Annie Spratt (@anniespratt) en Unsplash (`https://images.unsplash.com/photo-1522071820081-009f0129c71c`, ID `MChSQHxGZrQ`). Licencia: **Unsplash License**.

## 3. Catálogo de tokens semánticos en `@hubly/ui`
Consumidos tipadamente mediante `tokens.*` de `@hubly/ui` y definidos en `tokens.css`:
- **Superficie de marca:** `--surface-brand` (`#7a2e22` / oscuro `#341612`), `--surface-brand-contrast` (`#ffffff` / oscuro `#fdf4f0`), `--surface-brand-muted` (`#e8cbc5` / oscuro `#c49c95`).
- **Acento cálido:** `--accent-warm` (`#c25218` / oscuro `#f08344`), `--accent-warm-hover` (`#a84411` / oscuro `#ffa066`), `--accent-warm-subtle` (`#faeee6` / oscuro `#361c10`), `--accent-warm-text` (`#87340d` / oscuro `#fcc29f`).
- **Bento grid:** `--bento-surface-base`, `--bento-card-bg` (`#fdfbf7` / oscuro `#1c1917`), `--bento-card-border`, `--bento-highlight-text` (`#7a2e22` / oscuro `#f08344`), `--bento-card-shadow`.
- **Liquid glass:** `--glass-bg`, `--glass-border`, `--glass-shadow`, `--glass-blur` (1rem / móvil 0.5rem), `--glass-fallback-bg`, `--glass-hero-veil`.
- **Navegación y tipografía:** `--pill-active-bg`, `--pill-glass-bg`, `--text-display-hero`, `--text-display-num`, `--radius-xl`, `--radius-2xl`, `--radius-full`.

## 4. Medición de contraste WCAG 2.2 AA
Verificado matemáticamente en `packages/ui/src/landing-contrast.test.ts`:
- Terracota `--surface-brand` vs texto blanco: **7.85:1** (AAA).
- Bento claro `--bento-card-bg` vs `--text-primary`: **16.82:1** (AAA) | Bento oscuro vs texto: **13.51:1** (AAA).
- Bento destacado `--bento-highlight-text`: claro **9.07:1** (AAA) | oscuro **6.76:1** (AA $\ge 4.5:1$).
- Acento cálido `--accent-warm`: sobre blanco **4.64:1** (AA) | sobre fondo oscuro **6.69:1** (AA).
- Respaldo sólido liquid glass: claro **13.10:1** (AAA) | oscuro **12.45:1** (AAA).

## 5. Responsividad móvil 390 px y componentes exportados
- `.hubly-lifecycle-container`: contenedor con `overflow-x: auto` y desplazamiento táctil (`-webkit-overflow-scrolling: touch`) garantizando `scrollWidth <= 390px`.
- Primitivas visuales base expuestas en `@hubly/ui`: `GlassCard` (panel translúcido con fallback), `ThemeToggle` (interruptor de modo claro/oscuro accesible), `LineGraphicCycle` (diagrama lineal de 7 etapas).

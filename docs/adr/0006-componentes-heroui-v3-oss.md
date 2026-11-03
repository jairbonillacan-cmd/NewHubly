# 0006. Adopción de HeroUI v3 OSS para componentes base

Estado: Propuesto
Fecha: 2026-11-03
Issue: #32

## Contexto

El plan inicial de arquitectura (ADR 0002 y `docs/PLAN.md`) contemplaba el uso de Radix Primitives junto a Tailwind 4 para proveer primitivas interactivas accesibles sin estilos en `packages/ui`.

El 3 de noviembre de 2026, el dueño del producto emitió la siguiente decisión directiva:
> «Haz que se use https://heroui.com/ para el proyecto. Para los componentes que no existan en la versión gratuita, que es la que usaremos, guíense en cómo recrearla si fuera parte de HeroUI.»

HeroUI v3 (`@heroui/react` y `@heroui/styles`, versión 3.2.7) se distribuye bajo licencia libre Apache-2.0 y está construido nativamente sobre React Aria y Tailwind CSS v4, con peer dependencies estándar (`react-aria`, `react-aria-components`, `@react-aria/ssr`, `@react-aria/utils`, `@internationalized/date` y `tailwindcss >= 4`). Proporciona accesibilidad para teclado y lectores de pantalla (WCAG 2.2 AA), gestión de estados y un sistema declarativo de variantes y slots con `tailwind-variants`.

Esta adopción permite acelerar la entrega de la Fase 1B («Dirección visual y componentes») garantizando uniformidad visual y solidez técnica. No obstante, exige normar de forma rigurosa la frontera entre la versión comunitaria OSS y los productos comerciales (HeroUI Pro), la soberanía de nuestros tokens de diseño (Constitución #6) y el encapsulamiento dentro del monorepo (ADR 0002).

## Decisión

### 1. Sustitución de Radix Primitives por HeroUI v3 OSS
Se sustituye Radix Primitives por **HeroUI v3 OSS** (`@heroui/react` y `@heroui/styles`) como base de primitivas y componentes interactivos dentro de `packages/ui`.
- Se actualiza `docs/PLAN.md` reflejando HeroUI v3 OSS y React Aria en la capa de UI.
- Las dependencias de HeroUI se instalan exclusivamente en `packages/ui`.

### 2. Prohibición estricta y absoluta de HeroUI Pro
- Queda terminantemente prohibido el uso, instalación o referencia a `@heroui-pro/react`, `@heroui-pro/*`, plantillas comerciales o cualquier recurso bajo licencia de pago.
- Solo se autorizan paquetes públicos y abiertos bajo licencia Apache-2.0.
- En estricto apego a la Constitución de Hubly #4 («Identidad propia... No se copia ni se imita a ningún competidor, y no se usa material obtenido por ingeniería inversa de otros productos»), se prohíbe copiar o calcar código fuente o assets procedentes de HeroUI Pro o de repositorios comerciales cerrados.

### 3. Recreación de componentes ausentes en packages/ui
Para aquellos componentes que no formen parte de la versión gratuita OSS de HeroUI:
- Se construirán desde cero dentro de `packages/ui` sobre **React Aria Components**.
- Seguirán la arquitectura y convenciones de HeroUI: nombres canónicos de slots (`base`, `wrapper`, `content`, `trigger`, etc.), variantes con `tailwind-variants`, nomenclatura de props y consumo de variables de diseño semánticas.
- Mantendrán identidad propia y lógica original, sin copia de implementaciones privadas de terceros.

### 4. Tokens semánticos de @hubly/ui como única fuente de verdad
Conforme a la Constitución #6 («Diseño por tokens. Se prohíben colores y medidas sueltas...»):
- Los tokens semánticos definidos en `packages/ui` (`tokens.css` y `tokens.ts`) son la **única fuente de verdad** estética y funcional de Hubly.
- El tema de HeroUI se configura y mapea derivando sus variables CSS desde nuestros tokens semánticos (`--surface-*`, `--glass-*`, `--surface-brand*`, `--text-*`, `--border-*`, radios y tipografías).
- Se prohíbe el uso de valores hexadecimales, RGB o dimensiones fijas arbitrarias en componentes o temas.
- Selector canónico para modo oscuro: `[data-theme="dark"]`, garantizando coherencia con el componente `ThemeToggle` y la infraestructura existente.

### 5. Frontera arquitectónica estricta
Conforme al ADR 0002 («Fronteras entre paquetes»):
- `apps/web` (y cualquier aplicación futura) consume exclusivamente `@hubly/ui`.
- Queda prohibido importar `@heroui/*` o `@heroui/styles` de manera directa desde `apps/web` o desde cualquier paquete que no sea `packages/ui`.
- Todo componente de HeroUI consumido en la aplicación debe exponerse y encapsularse a través de la API pública de `@hubly/ui`.
- Esta restricción se valida automáticamente en CI mediante reglas de `dependency-cruiser`, `eslint-plugin-boundaries` / `no-restricted-imports` y pruebas automatizadas en `packages/config`.

### 6. Componentes preexistentes en packages/ui
Las primitivas visuales ya construidas y fusionadas en `packages/ui` (Issue #8 / PR #22: `GlassCard`, `ThemeToggle` y `LineGraphicCycle`):
- Se conservan como componentes propios de Hubly.
- Se adaptan visualmente para armonizar con el lenguaje estético de HeroUI, preservando íntegra su API, funcionalidad y contratos de accesibilidad.

### 7. Verificación de calidad y accesibilidad
- Cero valores sueltos en CSS y TSX mediante análisis estático y expresiones regulares.
- Cumplimiento de accesibilidad WCAG 2.2 AA verificado mediante `axe-core` en pruebas unitarias y de integración.
- Pruebas automatizadas en CI que aseguran la imposibilidad de importar `@heroui/*` fuera de `packages/ui` y bloquean cualquier mención a `@heroui-pro/*`.

## Consecuencias

### Positivas
- **Aceleración en Fase 1B:** Disponibilidad inmediata de componentes complejos (menús, modales, formularios, dropdowns) accesibles por teclado y con soporte de lectores de pantalla.
- **Desacoplamiento total:** Al aislar HeroUI dentro de `packages/ui`, la capa de aplicación (`apps/web`) desconoce los detalles de la librería externa, facilitando refactorizaciones, cambios de versión o sustitución de componentes sin impacto en las vistas.
- **Seguridad legal y presupuestal:** Garantía de uso de licencias Apache-2.0 públicas sin costes ocultos ni contingencias de propiedad intelectual.
- **Coherencia visual:** Los tokens semánticos propios continúan rigiendo el sistema de diseño completo.

### Negativas y compromisos operativos
- **Mantenimiento de componentes propios:** La construcción de componentes no incluidos en la versión gratuita requiere disciplina para seguir las convenciones de React Aria Components y `tailwind-variants` con alta fidelidad arquitectónica.
- **Capa de mapeo de tokens:** Es necesario mantener sincronizadas las variables CSS de HeroUI con los tokens de `@hubly/ui`.

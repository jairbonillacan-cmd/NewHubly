# Contrato UX de Fase 1A — Notas y pendientes y pantalla terminada

Estado: Vigente para Fase 1A (actualizado por decisiones del dueño en Issues #47 y #52)
Issues: #5, #8, #26, #35, #47, #52, #53, #56

## 1. Principios de esta entrega

- **Pregunta central (`Constitución #1`):** la pantalla de entrada es **Hoy**, nunca un listado plano ni un tablero decorativo. Primero responde qué requiere atención hoy (pendientes vencidos y de hoy) y mantiene las notas fijadas a mano.
- **Dirección visual unificada desde 1A (`Issues #8, #47 y #52`):** la app aplica desde ahora la dirección visual y la paleta **«Grafito y azul tinta»** elegidas por el dueño: estructura **editorial con bento y liquid glass**, un único color de marca en azul tinta (`--accent-primary` `#1D4ED8` / `#6F98FF`, `--accent-primary-hover`, `--accent-primary-subtle`), superficie de marca grafito (`--surface-brand` `#111316` / `#16181C`, `--surface-brand-contrast`, `--surface-brand-subtle`, `--surface-brand-muted`), tarjetas del bento en neutros fríos (`--bento-surface-base` `#F0F0F2` / `#1C1F24`, `--bento-card-bg` `#FFFFFF` / `#16181C`, `--bento-card-border` `#E4E4E7` / `#26292F`), paneles de cristal frío (`--glass-bg` blanco al 72 % en claro y grafito al 80 % en oscuro), navegación en píldoras (`--pill-*`), conteos numéricos grandes en peso ligero (`--text-display-num`, `--weight-light`) y radios amplios (`--radius-xl`, `--radius-2xl`, `--radius-full`).
- **Componentes reales de HeroUI v3 OSS (`ADR 0006`, `Issue #47`):** las pantallas y bloques de la app consumen los componentes reales de `@heroui/react` (`Button`, `Card`, `Tabs`, `Checkbox`, `TextField`, `Input`, `TextArea`, `Chip`, `Kbd`, `Switch`, `EmptyState`, etc.) envueltos y exportados desde `@hubly/ui` para aprovechar la accesibilidad y navegación por teclado de React Aria Components. Importar únicamente `buttonVariants` o `cardVariants` sobre etiquetas HTML sueltas no basta.
- **Sin simulación (`Constitución #3`, `ADR 0003`):** en 1A cada elemento es privado del autor (`created_by = auth.uid()`). **Se prohíbe** mostrar selectores de responsable, avatares de terceros o etiquetas repetidas de «Asignado a: Tú». Los conteos numéricos se calculan exclusivamente con datos reales (si es `0`, se muestra `0`). El reparto entre personas, agencias, roles, invitaciones y Storybook permanecen en la Fase 1B.

## 2. Arquitectura de la vista y flujos (Mosaico y Obra)

1. **Entrada en Hoy, disposición única por breakpoint y orden móvil:**
   - Cabecera sobre la superficie de marca grafito (`--surface-brand`) con la fecha y la pregunta «¿Qué sigue?», conteos reales en números grandes y ligeros (`--text-display-num`, `--weight-light`) y selector de vistas en píldoras (`Tabs` con `--pill-*`, activa sólida en azul tinta `--accent-primary`).
   - Vistas de pendientes: **Hoy** (vencidos + fecha de hoy), **Próximos** (con fecha futura, ordenados por fecha), **Sin fecha** y **Hechos**.
   - **Disposición de escritorio ($\ge 1024\text{ px}$):** dos columnas asimétricas dentro de `--container-workspace`; columna principal izquierda para la captura rápida en cristal (`Card` + `TextField` + `Kbd`) y la vista activa de pendientes en tarjetas del bento (`Card` + `Checkbox` + `Chip`), y columna secundaria derecha para **Notas fijadas**, buscador de notas (`título` y contenido) y filtro de archivadas en tarjetas del bento (`--bento-card-bg`).
   - **Disposición móvil y tableta ($< 1024\text{ px}$):** una sola columna con este orden vertical exacto: (1) cabecera y selector de vista (**Hoy**, **Próximos**, **Sin fecha**, **Hechos**), (2) barra de captura rápida de una línea, (3) lista de pendientes de la vista activa (vencidos arriba, luego los de hoy), (4) bloque de **Notas fijadas** y (5) buscador y lista de notas con acceso a exportación.
2. **Captura rápida en una línea:**
   - Barra de captura siempre visible en la parte superior de la vista activa sobre tarjeta de cristal (`--glass-*`), con borde `--border-control` ($\ge 3:1$), atajo visible en `Kbd` (`c` o `/` fuera de campos de texto) y `TextField`/`Input`, sin abrir modal.
   - `Enter` guarda al instante con valores por defecto (fecha de hoy si se está en **Hoy**, sin fecha en el resto). Permite indicar prioridad (`baja`, `media`, `alta`) y fecha opcional sin bloquear la captura.
3. **Editor de nota y autoguardado con estado visible:**
   - Tarjeta del bento (`Card` con `--bento-card-bg`), título y cuerpo con `TextField` (`Input` y `TextArea`), acciones con `Button` de **Fijar / Desfijar** y **Archivar / Restaurar**.
   - Autoguardado por versión con indicador `Chip` sobrio y permanente en la cabecera de la nota (nunca toasts por cada pulsación):
     - `Guardando…` mientras hay cambios en vuelo.
     - `Guardado` (`--status-success-bg` / `--status-success-text`) cuando la versión coincide con el servidor.
     - `No se pudo guardar · Reintentar` (`--status-danger-bg` / `--status-danger-text`, con `Button` real de reintento y conservación del borrador local si falla la red o hay conflicto de versión).
4. **Vínculo nota → pendiente:**
   - Desde una nota abierta o seleccionada, acción directa `Button` **«Crear pendiente desde esta nota»** que conserva `note_id` (dentro del mismo `workspace_id`, `ADR 0003`).
   - El pendiente muestra un enlace navegable de regreso a su nota de origen, y la nota lista los pendientes derivados con su estado (`hecho` / `pendiente`).
5. **Exportación de datos del cliente (`Constitución #5`):**
   - Acción accesible para descargar todas las notas y pendientes propios en **JSON** y **Markdown**, sin datos simulados.

## 3. Definición de «pantalla terminada»

Ningún PR de interfaz se aprueba si no cumple los ocho puntos siguientes:

1. **Cuatro estados obligatorios con acción concreta (sin emojis como iconos; Hubi permitido en pantalla vacía como acompañamiento):**
   - **Carga:** estructura estable con reserva de espacio que evite saltos de layout (`CLS`).
   - **Vacío:** `EmptyState` con texto específico en español, `Button` de acción directa y la mascota `Hubi` (`acabado="origen"`, `pose="sentado"`, decorativa) como acompañamiento visual, nunca en sustitución del texto ni de la acción concreta (ej. en **Hoy**: *«No tienes pendientes para hoy. Escribe arriba para capturar el primero o revisa Sin fecha.»*).
   - **Error:** causa comprensible y `Button` real **«Reintentar»**. Hubi puede acompañar una pantalla de error como ilustración decorativa (`pose="reparar"` al fallar la carga de Hoy). En el 404, `pose="buscar"` acompaña el enlace **«Volver al inicio»** (#114).
   - **Sin permiso / sesión caducada:** explicación clara y `Button` para volver a iniciar sesión o regresar a **Hoy**.
2. **Cero valores sueltos:** todo color, espacio, tipografía, radio, borde y alto de ventana proviene de `@hubly/ui` (validado en `pnpm lint` y `pnpm test`). Los controles interactivos usan `--border-control` ($\ge 3:1$).
3. **Teclado completo:** todas las acciones (capturar, marcar hecho, cambiar vista, fijar, archivar, crear pendiente vinculado, exportar) funcionan sin ratón mediante las primitivas de React Aria / HeroUI y con `:focus-visible` de alto contraste.
4. **Contraste y accesibilidad (WCAG 2.2 AA):** contraste $\ge 4.5:1$ en texto normal, $\ge 3:1$ en bordes de controles interactivos y controles con nombre accesible.
5. **Responsivo real:** verificado en `1440 px` (escritorio) y `390 px` (móvil) sin scroll horizontal ni controles truncados.
6. **Claro y oscuro desde el primer día:** verificado en ambos temas (`color-scheme: light` y `color-scheme: dark`) con las variantes claras y oscuras de los mismos tokens y capturas adjuntas al PR.
7. **Prueba automatizada:** cada pantalla o flujo principal incluye su prueba de estado o flujo antes de pedir revisión a Prisma y Tamiz.
8. **Sin señales de interfaz genérica (`Issue #56`):**
   - **Color y superficies**
     - Nada de degradados de varios colores en superficies, botones ni fondos. Se permite un cambio de tono dentro del mismo neutro y el velo de la foto del hero.
     - Nada de texto con degradado.
     - Nada de sombras o brillos de color, ni bordes neón. Las sombras son neutras y suaves (`--bento-card-shadow`).
     - Nada de manchas o blobs de color decorativos.
     - Un solo color de acento, el azul tinta del #52, y solo en acciones, foco, vista activa y datos destacados. Los colores de estado, solo en mensajes y estados.
   - **Espaciado y tamaño**
     - Todo en la escala de `--space-*` (rejilla de 4 px). Valores fuera de la escala solo para centrar con exactitud dentro de un control pequeño, y justificados.
     - Los elementos del mismo tipo comparten tamaño, padding y radio: tarjetas del bento, píldoras, botones de una misma fila.
   - **Iconos y texto**
     - Nada de emojis como iconos (ya lo dice el punto 1 del contrato).
     - Un solo set de iconos. Si se añade uno, es dependencia nueva y `riesgo:alto`. Tamaño 16 o 18 px y trazo uniforme.
     - Textos concretos de Hubly. Nada de frases de relleno («potencia tu flujo», «todo en un solo lugar») ni de afirmaciones o cifras que no se puedan comprobar (Constitución #3).
     - La tipografía la deciden los tokens. No se cambia por gusto.
   - **Criterio general**
     - No se rediseña una pantalla que ya cumple solo por cambiarla. La crítica de Prisma señala qué incumple y por qué, no preferencias.

Lista adaptada de *unslop* de Damir Sokolovsky (https://github.com/heydamir/unslop), CC BY 4.0.

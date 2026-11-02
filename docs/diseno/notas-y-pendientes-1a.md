# Contrato UX de Fase 1A — Notas y pendientes y pantalla terminada

Estado: Vigente para Fase 1A
Issue: #5

## 1. Principios de esta entrega

- **Pregunta central (`Constitución #1`):** la pantalla de entrada es **Hoy**, nunca un listado plano ni un tablero decorativo. Primero responde qué requiere atención hoy (pendientes vencidos y de hoy) y mantiene las notas fijadas a mano.
- **Neutralidad en 1A (`Plan 1A / 1B`):** 1A usa únicamente los tokens semánticos base de `@hubly/ui` (`tokens.css` y `tokens`) con la pila tipográfica nativa del sistema. Es estructuralmente completa, sobria y editorial, sin adelantar las propuestas de dirección visual ni Storybook (que pertenecen a 1B).
- **Sin simulación (`Constitución #3`, `ADR 0003`):** en 1A cada elemento es privado del autor (`created_by = auth.uid()`). **Se prohíbe** mostrar selectores de responsable, avatares de terceros o etiquetas repetidas de «Asignado a: Tú». El reparto entre personas llega en 1B con los roles de agencia.

## 2. Arquitectura de la vista y flujos (Mosaico y Obra)

1. **Entrada en Hoy, disposición única por breakpoint y orden móvil:**
   - Vistas de pendientes: **Hoy** (vencidos + fecha de hoy), **Próximos** (con fecha futura, ordenados por fecha), **Sin fecha** y **Hechos**.
   - **Disposición de escritorio ($\ge 1024\text{ px}$):** dos columnas asimétricas dentro de `--container-workspace`; columna principal izquierda para la captura rápida y la vista activa de pendientes, y columna secundaria derecha para **Notas fijadas**, buscador de notas (`título` y contenido) y filtro de archivadas.
   - **Disposición móvil y tableta ($< 1024\text{ px}$):** una sola columna con este orden vertical exacto: (1) cabecera y selector de vista (**Hoy**, **Próximos**, **Sin fecha**, **Hechos**), (2) barra de captura rápida de una línea, (3) lista de pendientes de la vista activa (vencidos arriba, luego los de hoy), (4) bloque de **Notas fijadas** y (5) buscador y lista de notas con acceso a exportación.
2. **Captura rápida en una línea:**
   - Barra de captura siempre visible en la parte superior de la vista activa, con borde `--border-control` ($\ge 3:1$), enfocable con atajo de teclado (`c` o `/` fuera de campos de texto), sin abrir modal.
   - `Enter` guarda al instante con valores por defecto (fecha de hoy si se está en **Hoy**, sin fecha en el resto). Permite indicar prioridad (`baja`, `media`, `alta`) y fecha opcional sin bloquear la captura.
3. **Editor de nota y autoguardado con estado visible:**
   - Título y cuerpo con formato simple, acciones de **Fijar / Desfijar** y **Archivar / Restaurar**.
   - Autoguardado por versión con indicador sobrio y permanente en la cabecera de la nota (nunca toasts por cada pulsación):
     - `Guardando…` mientras hay cambios en vuelo.
     - `Guardado` (`--status-success-bg` / `--status-success-text`) cuando la versión coincide con el servidor.
     - `No se pudo guardar · Reintentar` (`--status-danger-bg` / `--status-danger-text`, con botón real de reintento y conservación del borrador local si falla la red o hay conflicto de versión).
4. **Vínculo nota → pendiente:**
   - Desde una nota abierta o seleccionada, acción directa **«Crear pendiente desde esta nota»** que conserva `note_id` (dentro del mismo `workspace_id`, `ADR 0003`).
   - El pendiente muestra un enlace navegable de regreso a su nota de origen, y la nota lista los pendientes derivados con su estado (`hecho` / `pendiente`).
5. **Exportación de datos del cliente (`Constitución #5`):**
   - Acción accesible para descargar todas las notas y pendientes propios en **JSON** y **Markdown**, sin datos simulados.

## 3. Definición de «pantalla terminada»

Ningún PR de interfaz se aprueba si no cumple los siete puntos siguientes:

1. **Cuatro estados obligatorios con acción concreta (sin ilustraciones de relleno ni emojis como iconos):**
   - **Carga:** estructura estable con reserva de espacio que evite saltos de layout (`CLS`).
   - **Vacío:** texto específico en español y acción directa (ej. en **Hoy**: *«No tienes pendientes para hoy. Escribe arriba para capturar el primero o revisa Sin fecha.»*).
   - **Error:** causa comprensible y botón real **«Reintentar»**.
   - **Sin permiso / sesión caducada:** explicación clara y acción para volver a iniciar sesión o regresar a **Hoy**.
2. **Cero valores sueltos:** todo color, espacio, tipografía, radio, borde y alto de ventana proviene de `@hubly/ui` (validado en `pnpm lint` y `pnpm test`). Los controles interactivos usan `--border-control` ($\ge 3:1$).
3. **Teclado completo:** todas las acciones (capturar, marcar hecho, cambiar vista, fijar, archivar, crear pendiente vinculado, exportar) funcionan sin ratón y con `:focus-visible` de alto contraste.
4. **Contraste y accesibilidad (WCAG 2.2 AA):** contraste $\ge 4.5:1$ en texto normal, $\ge 3:1$ en bordes de controles interactivos y controles con nombre accesible.
5. **Responsivo real:** verificado en `1440 px` (escritorio) y `390 px` (móvil) sin scroll horizontal ni controles truncados.
6. **Claro y oscuro desde el primer día:** verificado en ambos temas (`color-scheme: light` y `color-scheme: dark`) con capturas adjuntas al PR.
7. **Prueba automatizada:** cada pantalla o flujo principal incluye su prueba de estado o flujo antes de pedir revisión a Prisma y Tamiz.

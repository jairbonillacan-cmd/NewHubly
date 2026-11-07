# Movimiento y sensación de velocidad

Estado: Vigente para toda la interfaz del producto
Issue: #187

Hubly debe sentirse inmediato. El movimiento sirve para confirmar una acción o explicar un cambio de contexto, nunca para adornar ni para disimular una espera ([visión](../producto/vision.md): se evitan «las animaciones que no informan»). Estas reglas se aplican a todo componente o pantalla nueva y a cualquier animación existente que se modifique.

## Curvas

- **Entradas y respuestas a la persona:** curva de salida (`ease-out`), que arranca rápido y frena al final. Se usa el token `--motion-ease`.
- **Algo que ya está en pantalla y cambia de lugar** (un panel que se desliza, una pieza que se reordena): curva de entrada y salida (`ease-in-out`).
- **Salidas:** pueden usar `ease-in`, porque lo que se va no necesita atención.
- **Prohibido** usar `ease-in` en la respuesta a un clic o una tecla: se siente lento justo cuando se espera respuesta.
- Nada de `linear` salvo en indicadores de progreso continuos.
- Las curvas viven en tokens de `packages/ui/src/tokens.css`, nunca como valores sueltos en un componente (Constitución, Ingeniería n.º 6).

## Duraciones

| Tipo de cambio | Duración | Ejemplos |
|---|---|---|
| Respuesta inmediata | 100–150 ms | hover, foco, pulsación, casillas |
| Elemento pequeño | 150–200 ms | menús, tooltips, popovers, chips |
| Superficie | 200–250 ms | diálogos, hojas inferiores, paneles |
| Cambio de contexto | 250–300 ms | cambiar de espacio o de herramienta |

- Nada de la interfaz del producto pasa de **300 ms**. Las duraciones largas (`--motion-base`, `--motion-slow`) son solo para la landing.
- **Cerrar es más rápido que abrir:** la salida dura aproximadamente dos tercios de la entrada.
- Los escalonados (`--motion-step`) suman como máximo 300 ms en total, aunque la lista sea larga.
- Se animan solo `transform` y `opacity`. Nunca `width`, `height`, `top` ni `left`, que provocan saltos y tirones.

## Movimiento reducido

- Con `prefers-reduced-motion: reduce` no hay desplazamientos, escalas ni rebotes. Se permite como máximo un fundido de 100 ms, o un cambio instantáneo.
- Toda animación nueva incluye su regla de movimiento reducido en el mismo PR.

## Excepción: fondos ilustrados animados

Decisión del dueño (#250). Un fondo ilustrado puede moverse en bucle, aunque sea decorativo, si se cumplen todas estas condiciones:

- **Lo elige la persona.** En Apariencia hay que activar «Con movimiento» (#251); nunca viene activado por defecto.
- **Va detrás de todo.** El movimiento es lento y ambiental (lluvia, vapor, un movimiento de cámara sin salto) y queda bajo el velo del fondo y los paneles.
- **Respeta el movimiento reducido.** Con `prefers-reduced-motion: reduce` solo se descarga y se muestra la versión estática.
- **Se puede apagar desde la interfaz** en cualquier momento, sin ir a los ajustes del sistema (WCAG 2.2.2).

Nada más en la interfaz del producto usa bucles decorativos: los indicadores y las miniaturas se quedan quietos.

## Esperas: primero que no se note

1. **Actualización optimista.** Si una acción casi nunca falla (marcar hecho, mover, renombrar, reprogramar), la interfaz cambia al instante. Si el servidor falla, se revierte y se explica qué pasó con una acción de reintento.
2. **Mantener lo anterior.** Al recargar datos del mismo espacio, el contenido actual sigue visible y usable mientras llega el nuevo.
3. **Esqueletos con la forma real.** Si no hay nada que mostrar, se reserva el espacio con la forma del contenido final para evitar saltos de diseño. No se usa un indicador giratorio genérico en medio de la pantalla.
4. **Indicador retrasado.** Ningún indicador de carga aparece antes de unos 300 ms. Si aparece, dura al menos unos 500 ms para no parpadear.
5. **Botones en curso.** Un botón que espera al servidor queda en estado pendiente (`isPending`), conserva su tamaño y no acepta un segundo clic.

## Seguridad durante las transiciones

Al cambiar de espacio, en especial entre agencias, **nunca** se muestra ni un instante contenido del espacio anterior. La regla 2 no aplica entre espacios. Si los datos nuevos no están listos, se muestra el estado de carga del espacio nuevo.

## Comprobación en cada PR

- Las duraciones y curvas usan tokens.
- Se probó con `prefers-reduced-motion` activado.
- La interacción principal responde visualmente en el primer fotograma, sin esperar al servidor, salvo cuando una actualización optimista no es segura.
- No hay saltos de diseño al terminar una carga.

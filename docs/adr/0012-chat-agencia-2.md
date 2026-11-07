# 0012. Chat de agencia 2.0

Estado: Propuesto
Fecha: 2026-11-06
Issue: #197, #199
Enmienda: [0010](0010-chat-interno-de-agencia.md)

## Contexto

El [ADR 0010](0010-chat-interno-de-agencia.md) puso en marcha el piloto de chat interno de agencia con canales, conversaciones directas de dos personas, mensajes de texto e indicadores de lectura. En el uso real aparecieron limitaciones de experiencia y de gobernanza de datos:

1. **Identidad y avatares en equipo:** `private.chat_directory` solo expone `display_name` (que queda `NULL` si la persona nunca configuró su nombre, mostrando «Miembro XXXX» en el cliente), se consulta únicamente tras una sincronización exitosa y el bucket privado `user-avatars` solo permite que cada persona lea su propia foto, impidiendo ver el avatar de un compañero de agencia.
2. **Interacción de equipo:** faltan citas de respuesta en línea, hilos por mensaje, reacciones rápidas con emojis, menciones con avisos dentro de la aplicación, indicador efímero de quién está escribiendo, adjuntos de imágenes y documentos, y animaciones acordes a las reglas de movimiento del producto.
3. **Exportación y privacidad entre miembros (Constitución #5):** la barra de exportación con enlaces JSON y Markdown en la vista de chat afea la interfaz y permite que cualquier miembro descargue conversaciones; al mismo tiempo, la limitación del ADR 0010 dejaba sin resolver la exportación completa de la agencia por parte de su titular.

## Decisión

Este ADR **enmienda el [ADR 0010](0010-chat-interno-de-agencia.md)** conservando su modelo de aislamiento por `workspace_id`, escrituras mediante funciones `security definer` en el esquema `private` y activación por `HUBLY_CHAT_PILOT_WORKSPACE_IDS`, e incorpora las siguientes decisiones:

### 1. Identidad, presencia y avatares entre compañeros

- **Directorio al montar y nombres claros:** el cliente solicita el directorio (`op=directory`) desde el montaje de la pantalla y muestra un estado de error con acción de reintento si falla. Si la persona autenticada aún no tiene nombre configurado, el chat la invita a definirlo al entrar; mientras un miembro no tenga nombre, la interfaz muestra una inicial neutra en lugar de «Miembro XXXX».
- **Lectura de avatares entre compañeros (`user-avatars`):**
  - Se añade una política `SELECT` en `storage.objects` para el bucket privado `user-avatars` que autoriza la lectura cuando el solicitante comparte al menos un espacio con el titular del objeto mediante `private.shares_workspace_with(target_user_id uuid)` (`security definer`, `stable`, `set search_path = ''`). La subida, actualización y borrado siguen restringidos exclusivamente al propio titular (`(storage.foldername(name))[1] = (select auth.uid())::text`).
  - `private.chat_directory` devuelve el booleano `has_avatar` por miembro y el servidor firma URLs temporales (1 hora) para los avatares de compañeros desde `profile.ts`, siempre con la sesión verificada del usuario y sin `service_role`.
- **Presencia:** se reutiliza `public.user_presence` (`online | away | dnd`) devuelta por el directorio y el indicador visual `PresenceDot` de `@hubly/ui`.

### 2. Respuestas en línea, hilos, reacciones, menciones y estado «escribiendo»

- **Citas e hilos en `private.chat_messages`:**
  - Se añaden `reply_to_id uuid` (cita en línea dentro de la misma conversación) y `thread_root_id uuid` (mensaje raíz de un hilo dentro de la misma conversación), junto con los contadores de respuestas del hilo en el mensaje raíz.
  - Todas las referencias validan pertenencia a la misma conversación y agencia.
- **Reacciones (`private.chat_reactions`):**
  - Tabla en el esquema `private` con unicidad en `(message_id, user_id, emoji)`.
  - El campo `emoji` se valida en base de datos y en contratos Zod: exactamente un grafema pictográfico y como máximo 16 bytes UTF-8.
  - Se alterna mediante función `private.chat_toggle_reaction` (`security definer`, `set search_path = ''`) con límite de frecuencia y respuesta idéntica si la conversación no existe o el actor no tiene permiso.
- **Menciones (`private.chat_mentions`):**
  - Tabla en el esquema `private` poblada dentro de `private.chat_send_message`, que valida que cada persona mencionada sea miembro con acceso a la conversación (miembro de la agencia en canales o participante en un directo).
  - Registra el estado de lectura (`read_at`) de cada mención y se marca como leída mediante función `security definer` (`set search_path = ''`) cuando la persona visualiza el mensaje.
- **Estado «escribiendo» (`private.chat_typing`):**
  - Tabla efímera con `expires_at` (~6 segundos desde la marca).
  - La función `private.chat_set_typing` (`security definer`, `set search_path = ''`) aplica un enfriamiento mínimo de 3 segundos por persona y conversación, exige permiso de escritura en la conversación y devuelve la misma respuesta ante inexistencia o falta de acceso.

### 3. Tiempo real por sondeo y respuesta unificada de `sync`

- Se mantiene el **sondeo autenticado contra el servidor** y se descarta Supabase Realtime, en cumplimiento del [ADR 0004](0004-rls.md).
- Con la conversación abierta y la pestaña visible, el intervalo de sondeo baja a **2 segundos**; en el resto de casos activos permanece en **3 segundos**, pausándose cuando la pestaña está oculta.
- La operación `sync` devuelve en una sola respuesta los mensajes nuevos o editados, las reacciones agregadas, quién está escribiendo (filas con `expires_at > now()`) y las menciones sin leer de la persona autenticada.

### 4. Notificaciones de menciones dentro de la aplicación

Las menciones se resuelven íntegramente dentro de la aplicación (sin push externo ni correo):
- Resaltado visual de la mención dentro del cuerpo del mensaje.
- Contador de menciones sin leer en el carril de navegación y en el chip del chat en Hoy (`EspacioHoy`).
- Número de menciones sin leer en el título de la pestaña del navegador (`document.title`).
- Aviso mediante la `Notification API` del navegador únicamente cuando la pestaña está oculta y la persona ha otorgado permiso desde un botón explícito («Activar avisos del navegador»).

### 5. Adjuntos en bucket privado con limpieza de metadatos

- **Almacenamiento y catálogo:** bucket privado `chat-attachments` con rutas `<workspaceId>/<conversationId>/<uuid>` y tabla `private.chat_attachments` vinculada al mensaje (`message_id`, `conversation_id`, `workspace_id`, nombre seguro, tipo MIME verificado, tamaño en bytes y dimensiones opcionales para imágenes).
- **Aislamiento y ciclo de vida:** solo los miembros con acceso de lectura a la conversación pueden leer sus adjuntos. Al retirar un mensaje, sus adjuntos dejan de servirse.
- **Subida con saneado en servidor:**
  - Lista blanca estricta de tipos comprobada por firma binaria real: `image/jpeg`, `image/png`, `image/webp`, `image/gif` y `application/pdf`.
  - Límite máximo de **10 MB** por archivo y hasta **5 adjuntos por mensaje**.
  - Limpieza de metadatos (EXIF, XMP, IPTC, comentarios) en el servidor reutilizando `sanitizeWallpaperImage` ([ADR 0008](0008-fondo-propio-storage-privado.md)) sin añadir dependencias externas.
  - Entrega mediante URL firmada de **1 hora** generada en el servidor con la sesión del usuario; las descargas se sirven con `Content-Disposition: attachment`.
- **Flujo de subida (reserve → PUT → commit):** `POST /api/chat/attachments` solo acepta JSON. Con `op: "reserve"` el servidor crea una reserva de 10 minutos y devuelve una URL firmada de subida a `<workspaceId>/<conversationId>/quarantine/<id>`; el navegador hace el `PUT` directo a Storage (sin pasar por el límite de 4,5 MB de las funciones). Con `op: "commit"` el servidor descarga la copia en cuarentena, la sanea, sube el resultado limpio a la ruta final, registra el adjunto en una transacción y borra la cuarentena con `bucket.remove`. Antes de reservar, las reservas vencidas de quien sube se borran de Storage por la API.
- **Borrado por la API de Storage:** nunca se borran filas de `storage.objects` por SQL, porque eso deja el archivo físico huérfano. Al retirar un mensaje, la ruta del chat borra sus archivos con `bucket.remove` **antes** de retirarlo; si la purga falla, el mensaje no se retira y se devuelve un error. Pueden purgar el autor o un `owner`/`admin` de la agencia que pueda leer la conversación (canales y directos en los que participa). El disparador SQL queda como red de seguridad y solo borra las filas de catálogo y reservas.
- **PDF rechazados:** se admiten enlaces normales (`/URI`). Se rechazan, también ocultos con escapes `#xx`, los PDF con acciones automáticas o scripts (`/JavaScript`, `/JS`, `/Launch`, `/OpenAction`, `/AA`, `/SubmitForm`, `/ImportData`, `/GoToR`, `/GoToE`), archivos o medios incrustados (`/EmbeddedFile(s)`, `/RichMedia`), formularios XFA y flujos de objetos comprimidos (`/ObjStm`, que no podemos revisar). Esto incluye muchos PDF exportados desde procesadores de texto; el mensaje de error pide exportarlo de nuevo como PDF sencillo.
- **Riesgo aceptado:** las URL firmadas ya emitidas siguen válidas hasta 1 hora aunque a la persona le bajen el rol o salga de la agencia, porque Storage no las revoca. Las URL nuevas sí respetan los permisos vigentes.

### 6. Exportación exclusiva del propietario (`owner`)

- Se retira de la vista del chat la barra con enlaces JSON y Markdown y se elimina la operación `exportOwn` para miembros.
- Para cumplir la Constitución #5 («Los datos son del cliente. Siempre se pueden exportar»), únicamente el `owner` de la agencia puede exportar el chat desde los ajustes del equipo (`EquipoDialog`) mediante `exportAgency`, verificando el rol `owner` tanto en el servicio de aplicación como en RLS/SQL.
- La exportación del `owner` incluye todos los canales de la agencia y únicamente las conversaciones directas en las que el propio `owner` participa, **nunca** los directos entre terceras personas. Un texto de ayuda en la interfaz informa a los miembros de que el propietario de la agencia puede exportar los canales.

### 7. Componentes propios, movimiento y accesibilidad

- **Sin dependencias nuevas:** el selector de emojis (`EmojiPicker` en `@hubly/ui`) es propio, con lista curada por categorías y búsqueda en español, además de admitir emojis nativos del teclado.
- **Partición y movimiento:** la interfaz se divide en `ConversationHeader`, `MessageList`, `MessageItem`, `Composer`, `MemberList` y `ThreadPanel`. Los mensajes nuevos entran en 150–200 ms con curva `ease-out` (`--motion-ease`), el historial cargado no se anima, las imágenes reservan su espacio para evitar saltos de diseño y toda animación respeta `prefers-reduced-motion: reduce`.
- **Accesibilidad (WCAG 2.2 AA):** todas las acciones de mensaje (reaccionar, responder, abrir hilo, editar, retirar) funcionan con ratón, pulsación larga en móvil y teclado; el autocompletado de `@` y el indicador «escribiendo…» se anuncian de forma accesible.

## Consecuencias

- **Privacidad y soberanía de datos:** los directos entre miembros permanecen privados frente a terceros (incluido el `owner` cuando no participa), mientras la agencia conserva la exportación completa de sus canales a través del `owner`.
- **Seguridad uniforme:** todas las escrituras sociales (`chat_toggle_reaction`, `chat_set_typing`, `chat_mark_mentions_read`, `chat_send_message`) y los accesos a Storage (`user-avatars` y `chat-attachments`) mantienen el estándar de funciones `security definer` endurecidas, cuotas por operación, limpieza binaria sin dependencias y pruebas contra Postgres real.

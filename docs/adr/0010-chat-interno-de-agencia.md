# 0010. Chat interno de agencia

Estado: Aceptado
Fecha: 2026-11-05
Issue: #153

## Contexto

Hoy es la entrada a Hubly. El chat permite coordinarse dentro de una agencia y volver a Hoy para decidir qué sigue. La primera entrega cubre canales, conversaciones directas de dos personas, mensajes de texto e indicadores de lectura. El piloto depende de verificar Equipo con dos cuentas y de mantener las garantías de [multi-tenancy](0003-multi-tenancy.md) y [acceso a datos](0004-rls.md).

## Decisión

### Identidad y permisos

La unidad de aislamiento es el `workspace_id` de una agencia. Los espacios personales y el portal de clientes quedan fuera del piloto. Cada solicitud verifica la sesión, el piloto habilitado y la membresía actual. La base aplica RLS forzada y revoca los permisos de `anon` y `public`.

| Operación | Propietario o administrador | Editor | Visor |
|---|---|---|---|
| Leer canales y marcar lectura | Sí | Sí | Sí |
| Crear, renombrar y archivar canales | Sí | | |
| Enviar texto y editar o retirar mensajes propios | Sí | Sí | |
| Abrir o leer un directo | Solo si participa | Solo si participa | |

- El canal `#general` se crea de forma idempotente al abrir por primera vez el chat de una agencia habilitada. Se conserva su nombre y permanece activo. Archivar otro canal conserva su historial y lo deja en solo lectura: bloquea envíos, ediciones y retiros.
- Cada par de participantes tiene un directo único por agencia, sin importar quién lo abre. Las dos personas deben tener un rol que permita escribir para enviar un mensaje nuevo. Si una sale de la agencia o pasa a visor, pierde acceso al directo. La otra conserva su historial en solo lectura.
- El directorio expone nombre de perfil e iniciales de compañeros de la agencia. El perfil sin nombre muestra «Miembro» con un identificador corto para distinguirlo. La presencia reutiliza el estado elegido por cada persona. Las fotos privadas y los correos conservan sus permisos actuales.

### Persistencia y sincronización

- Las tablas `chat_conversations`, `chat_messages` y `chat_reads` viven en el esquema privado. Todas tienen referencias al espacio y claves compuestas para las relaciones entre recursos del chat. Los repositorios consultan con `withUserContext`. Las operaciones SQL que necesiten privilegios para cambiar contadores o proteger la idempotencia derivan la identidad de `auth.uid()` y comprueban permisos explícitamente. Son `security definer` con `set search_path = ''`, nombres calificados y `execute` revocado a `public` y `anon`; las auxiliares tampoco las ejecuta `authenticated`.
- Cada conversación serializa sus escrituras y asigna un orden estable a los mensajes y un cursor a cada cambio. El envío usa una clave de reintento única por conversación y autor. La primera escritura devuelve el mensaje original en los reintentos. En cada agencia se aceptan hasta 30 envíos nuevos por persona y minuto. Los reintentos reconocidos no consumen cuota.
- El historial carga 50 mensajes por página. Editar mantiene la posición original y actualiza el cursor de cambios. Retirar borra el cuerpo persistido y conserva su posición como «Mensaje eliminado». El cursor de lectura aumenta hasta el último mensaje visible. Los envíos propios y los mensajes retirados no cuentan como nuevos.
- El navegador consulta un endpoint autenticado del mismo origen cada tres segundos con el chat visible. Se descarta Supabase Realtime en el piloto porque el [ADR 0004](0004-rls.md) no permite que el navegador lea tablas de negocio directamente; toda lectura pasa por el servidor con la sesión verificada. Al ocultarse la pestaña pausa las consultas y vuelve a sincronizar al recuperar el foco o la conexión. La respuesta no se almacena en caché. Una denegación de acceso elimina la conversación de la vista. La sesión continúa en cookies `HttpOnly`.
- La exportación independiente de chat ofrece JSON y Markdown para los mensajes propios de conversaciones que aún son accesibles, sin el cuerpo de los retirados. Limitación conocida: quien pasa a visor deja de exportar sus mensajes de directos. Se revisará contra la Constitución #5 antes de abrir el chat fuera del piloto.

## Consecuencias

El piloto reutiliza la sesión, el marco de Tu espacio y los servicios existentes de Hubly. Un control de servidor por agencia permite desactivar el acceso conservando los datos. El lanzamiento exige aprobación de Prisma para el diseño, revisión de Claude para los cambios de riesgo alto y aprobación humana en el entorno `production` para la migración. Hilos, menciones, búsqueda y crear pendientes desde mensajes se planifican después de validar el piloto.

## Notas de implementación

- **Escrituras por operaciones controladas.** A diferencia de la regla general del [ADR 0004](0004-rls.md) (políticas `insert`/`update` con `with check`), el chat no concede escritura directa sobre sus tablas. Todas las escrituras pasan por las funciones `private.chat_*`, como en el precedente del [ADR 0007](0007-roles-invitaciones-y-visibilidad-agencia.md). Cada función comprueba la membresía antes de bloquear la conversación y responde igual si no existe o no hay permiso (#178).
- **Catálogo.** La prueba de catálogo del ADR 0004 cubre también las tablas `private.chat_*` y las funciones del chat.
- **Activación.** El piloto se habilita por agencia con la variable de servidor `HUBLY_CHAT_PILOT_WORKSPACE_IDS` (UUID separados por comas). Sin ella el chat queda apagado para todos. Vaciarla lo desactiva sin borrar datos.

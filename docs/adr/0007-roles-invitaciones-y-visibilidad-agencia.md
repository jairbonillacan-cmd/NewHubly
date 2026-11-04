# 0007. Modelo de roles de agencia, invitaciones con token hasheado y visibilidad compartida en RLS

Estado: Propuesto
Fecha: 2026-11-04
Issue: #60

## Contexto

La Fase 1A entregó espacios de trabajo individuales donde el creador es `owner` y todas las notas y pendientes son privados por autor (`created_by = (select auth.uid())`), conforme a los [ADR 0003](0003-multi-tenancy.md) y [ADR 0004](0004-rls.md). La Fase 1B habilita el trabajo en equipo dentro de una agencia (que sigue siendo una fila de `public.workspaces`), incorporando cuatro roles (`owner`, `admin`, `editor`, `viewer`), invitaciones de un solo uso con enlace copiable y visibilidad por elemento (`private` o `workspace`).

Toda regla de autorización debe aplicarse tanto en los casos de uso de `@hubly/application` como en Postgres mediante Row Level Security (RLS) forzado y funciones/triggers en el esquema `private`, sin usar jamás `service_role` en `apps/web` y manteniendo intactos los datos y garantías de aislamiento de la Fase 1A.

## Decisión

### 1. Jerarquía de roles, protección del último `owner`, prohibición de auto-escalado y transferencia de propiedad

La columna `public.workspace_members.role` se restringe con `check (role in ('owner', 'admin', 'editor', 'viewer'))`. Se define la función auxiliar `private.workspace_role(lookup_workspace_id uuid) returns text` (`language sql`, `security definer`, `stable`, `set search_path = ''`, con `revoke execute from public, anon` y `grant execute to authenticated`) que devuelve el rol del `(select auth.uid())` en ese `workspace_id` o `null` si no es miembro.

#### Matriz de permisos por operación y rol

| Recurso / Operación | `owner` | `admin` | `editor` | `viewer` |
|---|---|---|---|---|
| `workspaces`: `SELECT` | Sí (miembro) | Sí (miembro) | Sí (miembro) | Sí (miembro) |
| `workspaces`: `UPDATE` (nombre/slug) | Sí | Sí | No | No |
| `workspace_members`: `SELECT` | Sí (miembros de su agencia) | Sí (miembros de su agencia) | Sí (miembros de su agencia) | Sí (miembros de su agencia) |
| `workspace_members`: gestionar `editor` / `viewer` | Sí | Sí (solo otros usuarios) | No | No |
| `workspace_members`: gestionar `admin` / `owner` | Sí (protegiendo último `owner`) | No | No | No |
| `workspace_invitations`: crear / listar / revocar | Sí (roles `admin`, `editor`, `viewer`) | Sí (solo roles `editor`, `viewer`) | No | No |
| `notes` / `todos` (`visibility = 'private'`) | CRUD solo si `created_by = auth.uid()` | CRUD solo si `created_by = auth.uid()` | CRUD solo si `created_by = auth.uid()` | Lectura/edición solo de sus propios `'private'` |
| `notes` / `todos` (`visibility = 'workspace'`): `SELECT` | Sí | Sí | Sí | Sí (solo lectura) |
| `notes` / `todos` (`visibility = 'workspace'`): `INSERT` | Sí | Sí | Sí | No |
| `notes` / `todos` (`visibility = 'workspace'`): `UPDATE` / `DELETE` | Sí (cualquier autor de la agencia) | Sí (cualquier autor de la agencia) | Sí (contenido/estado; `DELETE` solo si es `created_by`) | No |
| Cambiar `visibility` (`'private' ↔ 'workspace'`) | Solo si `created_by = auth.uid()` | Solo si `created_by = auth.uid()` | Solo si `created_by = auth.uid()` | No |

#### Invariantes de seguridad sobre membresías y roles

1. **El último `owner` no se puede eliminar ni degradar:**
   - Un trigger `BEFORE UPDATE OR DELETE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION private.prevent_last_owner_loss()` verifica que, cuando `old.role = 'owner'` y la operación es `DELETE` o un `UPDATE` con `new.role <> 'owner'`, exista al menos otro `owner` en el mismo `workspace_id` (`exists (select 1 from public.workspace_members where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id)`). Si no existe, lanza excepción con código `23514` (`'El espacio de trabajo debe conservar al menos un propietario (owner)'`).
2. **Un `admin` no nombra `owner` ni modifica o elimina a otros `admin` ni a `owner`:**
   - En `workspace_members`, las políticas `UPDATE` y `DELETE` permiten actuar a un `admin` únicamente cuando la fila objetivo cumple `user_id <> (select auth.uid())` y `role in ('editor', 'viewer')` tanto en `USING` (rol actual del miembro objetivo) como en `WITH CHECK` (nuevo rol asignado).
   - En `workspace_invitations`, la política `INSERT` y `UPDATE` (revocación) exige que si el actor es `admin`, el campo `role` de la invitación sea estrictamente `in ('editor', 'viewer')`. Solo un `owner` puede invitar con `role = 'admin'`.
3. **Nadie puede subirse de rol a sí mismo (comprobado en RLS):**
   - La política `workspace_members_update` prohíbe cualquier auto-promoción:
     - En `USING`: `(private.workspace_role(workspace_id) = 'owner' and (user_id <> (select auth.uid()) or role = 'owner')) or (private.workspace_role(workspace_id) = 'admin' and user_id <> (select auth.uid()) and role in ('editor', 'viewer'))`.
     - En `WITH CHECK`: `(private.workspace_role(workspace_id) = 'owner' and role in ('owner', 'admin', 'editor', 'viewer')) or (private.workspace_role(workspace_id) = 'admin' and user_id <> (select auth.uid()) and role in ('editor', 'viewer'))`.
     - De este modo, ningún `admin`, `editor` ni `viewer` puede ejecutar `UPDATE` sobre su propia fila (`user_id = (select auth.uid())`), y un `owner` solo puede modificar su propia fila para degradarse cuando ya existe un segundo `owner` (validado por `private.prevent_last_owner_loss()`).
4. **Transferencia de propiedad:**
   - Se realiza en dos pasos explícitos:
     1. El `owner` actual promueve primero a otro miembro existente de la agencia a `role = 'owner'` (`UPDATE public.workspace_members SET role = 'owner' WHERE workspace_id = $1 AND user_id = $2`), quedando la agencia con `>= 2` propietarios.
     2. Una vez que existen al menos 2 filas con `role = 'owner'`, el propietario anterior puede cambiar su propio rol a `'admin'`, `'editor'` o `'viewer'`, o salir de la agencia (`DELETE`), sin dejar jamás a la agencia sin `owner`.

---

### 2. Invitaciones de un solo uso con correo verificado, enlace copiable y límite por agencia

#### Esquema de `public.workspace_invitations`

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references public.workspaces(id) on delete cascade`
- `email text not null check (email = lower(btrim(email)) and position('@' in email) > 1)`
- `role text not null check (role in ('admin', 'editor', 'viewer'))` (no se invita directamente como `owner`; la propiedad se transfiere a un miembro existente)
- `token_hash text not null unique check (char_length(token_hash) = 64)` (hash SHA-256 en hexadecimal de un token criptográfico aleatorio de 32 bytes / 256 bits; el token en claro nunca se almacena en la base ni se escribe en logs)
- `invited_by uuid not null`
- `expires_at timestamptz not null default (now() + interval '7 days')`
- `accepted_at timestamptz`
- `accepted_by uuid`
- `revoked_at timestamptz`
- `created_at timestamptz not null default now()`
- Índice único parcial: `create unique index workspace_invitations_active_email_idx on public.workspace_invitations (workspace_id, email) where accepted_at is null and revoked_at is null;`
- Índice por agencia: `create index workspace_invitations_workspace_status_idx on public.workspace_invitations (workspace_id, accepted_at, revoked_at, expires_at);`

#### Flujo sin envío de correo en Fase 1B y aceptación verificada

- **Enlace copiable una sola vez:** en la Fase 1B no se integra proveedor SMTP. Al crear la invitación, el servidor genera 32 bytes aleatorios (`raw_token` en base64url), persiste únicamente `token_hash = encode(sha256(convert_to(raw_token, 'UTF8')), 'hex')` y devuelve en la respuesta de la acción el enlace `/invitacion/<raw_token>` para que el `owner` o `admin` lo copie. Consultas posteriores a `workspace_invitations` solo exponen metadatos (`id`, `email`, `role`, `expires_at`, estado), nunca el token ni su hash.
- **Verificación de correo contra `auth.users` en `private.accept_workspace_invitation(raw_token text)`:**
  - Función `security definer set search_path = ''` ejecutable solo por `authenticated`.
  - Calcula `v_hash := encode(sha256(convert_to(btrim(raw_token), 'UTF8')), 'hex')`.
  - Selecciona y bloquea (`FOR UPDATE`) la invitación en `public.workspace_invitations` donde `token_hash = v_hash`.
  - Verifica que exista y que `accepted_at is null and revoked_at is null and expires_at > now()`; en caso contrario lanza excepción (`'Invitación inválida, vencida o ya utilizada'`).
  - Consulta el correo verificado del usuario autenticado directamente en `auth.users`:
    ```sql
    select lower(btrim(u.email)) into v_user_email
    from auth.users u
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
    ```
  - Si `v_user_email is null` o `v_user_email <> v_invitation.email`, lanza excepción (`'El correo verificado de tu cuenta no coincide con el correo de la invitación'`).
  - Inserta `(v_invitation.workspace_id, (select auth.uid()), v_invitation.role)` en `public.workspace_members` (si ya era miembro, lanza error claro sin consumir el token) y marca `accepted_at = now(), accepted_by = (select auth.uid())` en la misma transacción (garantía de un solo uso).
- **Límite por agencia:** cada agencia puede tener como máximo **20 invitaciones pendientes activas** (`accepted_at is null and revoked_at is null and expires_at > now()`). Este límite se valida en el caso de uso y se refuerza en Postgres con un trigger `BEFORE INSERT ON public.workspace_invitations` (`private.enforce_workspace_invitation_limit()`) que bloquea el `workspace_id` y rechaza la inserción si `count(*) >= 20`.

---

### 3. Qué pasa con los elementos compartidos y privados cuando alguien sale o es removido

1. **Pertenencia al tenant (`workspace_id`):** todas las filas de `public.notes` y `public.todos` tienen FK a `public.workspaces(id) on delete cascade`, pero `created_by` **no** tiene `on delete cascade` hacia `public.workspace_members`.
2. **Elementos compartidos (`visibility = 'workspace'`):** cuando un miembro sale de la agencia o es removido por un `owner`/`admin`, todas las notas y pendientes con `visibility = 'workspace'` que hubiera creado **permanecen en la agencia**, siguen siendo visibles para los miembros activos y editables por `owner`, `admin` y `editor`, conservando `created_by` como registro histórico de autoría.
3. **Pérdida inmediata de acceso del exmiembro:** al eliminarse su fila de `public.workspace_members`, el usuario removido deja de cumplir `private.is_workspace_member(workspace_id)` y `private.workspace_role(workspace_id) is not null`. En la siguiente transacción pierde el 100 % de acceso de lectura y escritura tanto a los elementos `'workspace'` como a los elementos `'private'` alojados en ese `workspace_id`.
4. **Elementos privados (`visibility = 'private'`) del exmiembro en esa agencia:** no se exponen nunca a los demás miembros de la agencia (ni siquiera a `owner` o `admin`), porque la política de elementos `'private'` exige siempre `created_by = (select auth.uid())`. El miembro puede exportarlos, compartirlos o eliminarlos antes de abandonar la agencia.

---

### 4. Quién puede cambiar la visibilidad (`private` ↔ `workspace`) y qué pasa cuando un elemento compartido vuelve a privado

1. **Solo el autor (`created_by`) con rol `owner`, `admin` o `editor` puede cambiar `visibility`:**
   - Un elemento nace con `visibility = 'private'` por defecto (o `'workspace'` si el creador tiene rol `owner`, `admin` o `editor` y así lo elige). Un `viewer` jamás puede crear ni pasar elementos a `'workspace'`.
   - El cambio de `visibility` (`'private' → 'workspace'` o `'workspace' → 'private'`) está reservado exclusivamente al autor (`created_by = (select auth.uid())` con rol `in ('owner', 'admin', 'editor')`).
   - Ningún otro miembro —ni siquiera un `owner` o `admin` distinto de `created_by`— puede cambiar a `'private'` una nota o pendiente de otro autor, porque dicho elemento tiene `created_by` del autor original y al pasar a `'private'` desaparecería inmediatamente para quien ejecutó el cambio.
   - Los roles `owner` y `admin` sí pueden editar título/contenido/prioridad/fecha, fijar, archivar, marcar como hecho o eliminar cualquier nota o pendiente con `visibility = 'workspace'`, manteniendo `created_by` inmutable y `visibility = 'workspace'`. Un trigger `BEFORE UPDATE ON public.notes` y `public.todos` (`private.enforce_item_ownership_and_visibility()`) garantiza que `new.created_by = old.created_by`, `new.workspace_id = old.workspace_id` y que si `old.visibility <> new.visibility` entonces `old.created_by = (select auth.uid())`.
2. **Efecto de volver un elemento compartido (`'workspace'`) a `'private'`:**
   - El elemento deja de inmediato de ser visible o editable para el resto de miembros de la agencia y vuelve a estar restringido únicamente a `created_by = (select auth.uid())`.
   - **Coherencia del vínculo `todos.note_id → notes.id`:**
     - Un pendiente con `visibility = 'workspace'` solo puede vincularse (`note_id is not null`) a una nota del mismo `workspace_id` que también tenga `visibility = 'workspace'`.
     - Un pendiente con `visibility = 'private'` solo puede vincularse a una nota del mismo `workspace_id` que sea visible para su autor (`visibility = 'workspace'` o `(visibility = 'private' and created_by = (select auth.uid()))`).
     - Cuando una **nota** pasa de `visibility = 'workspace'` a `visibility = 'private'`, el trigger `AFTER UPDATE OF visibility ON public.notes` desvincula automáticamente (`update public.todos set note_id = null where workspace_id = new.workspace_id and note_id = new.id and not (visibility = 'private' and created_by = new.created_by)`) cualquier pendiente compartido o perteneciente a otros miembros que apuntara a dicha nota, evitando que pendientes compartidos referencien una nota que ahora es privada.

---

### 5. Migración SQL de Fase 1B: reemplazo de políticas de `notes` y `todos` y compatibilidad con 1A

La migración hacia adelante de la Fase 1B (`supabase/migrations/20261104000000_fase1b_agency_roles_invitations_visibility.sql`) ejecuta en una sola transacción:

1. **Columna aditiva con preservación total de datos de 1A:**
   - `alter table public.notes add column visibility text not null default 'private' check (visibility in ('private', 'workspace'));`
   - `alter table public.todos add column visibility text not null default 'private' check (visibility in ('private', 'workspace'));`
   - Todas las filas existentes de la Fase 1A quedan automáticamente con `visibility = 'private'`, manteniendo exactamente su comportamiento privado por autor.
   - Nuevos índices compuestos: `(workspace_id, visibility, is_archived)` en `public.notes` y `(workspace_id, visibility, is_done, due_date)` en `public.todos`.
2. **Reemplazo explícito (`DROP POLICY` + `CREATE POLICY`) en `public.notes` y `public.todos`:**
   - Se eliminan las 8 políticas de 1A (`notes_select`, `notes_insert`, `notes_update`, `notes_delete`, `todos_select`, `todos_insert`, `todos_update`, `todos_delete`) y se crean las políticas de 1B:
     - `SELECT` (`notes_select` / `todos_select`):
       `private.workspace_role(workspace_id) is not null and (visibility = 'workspace' or created_by = (select auth.uid()))`
     - `INSERT` (`notes_insert` / `todos_insert`):
       `created_by = (select auth.uid()) and ((visibility = 'private' and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor')))` (más la validación de `note_id` coherente en `todos_insert`).
     - `UPDATE` (`notes_update` / `todos_update`):
       - `USING`: `(created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor'))`
       - `WITH CHECK`: `((visibility = 'private' and created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor')))` (reforzado por el trigger `private.enforce_item_ownership_and_visibility()` y la validación de `note_id` en `todos_update`).
     - `DELETE` (`notes_delete` / `todos_delete`):
       `(created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin'))`
3. **Reversión documentada y pruebas de regresión obligatorias:**
   - La migración incluye en comentarios el script SQL de reversión (`DROP POLICY` de 1B, restauración de las 8 políticas de 1A, `DROP TABLE public.workspace_invitations`, `DROP COLUMN visibility`).
   - La suite de 1A (`packages/db/tests/rls-catalog.test.ts`, `packages/db/tests/rls-isolation.test.ts` y `apps/web/tests/e2e/workspace-flow.test.tsx`) debe seguir pasando sin debilitar un solo chequeo, junto con la nueva suite de aislamiento por rol, protección del último `owner`, prohibición de auto-escalado, invitaciones verificadas y transición de visibilidad `'private' ↔ 'workspace'`.

## Consecuencias

- Ninguna nota ni pendiente de la Fase 1A cambia de visibilidad al desplegar la Fase 1B: todo permanece `'private'` hasta que su autor decida compartirlo con la agencia.
- La seguridad no depende solo de la interfaz o de las Server Actions: Postgres impide en RLS y triggers que una agencia quede sin `owner`, que un usuario se suba de rol a sí mismo, que un `admin` toque a otro `admin`/`owner`, que un `viewer` escriba elementos compartidos o que una invitación sea aceptada por un correo distinto al destinatario.
- El límite de 20 invitaciones pendientes por agencia y el uso de `token_hash` SHA-256 evitan abuso de almacenamiento y exposición de tokens en la base de datos.

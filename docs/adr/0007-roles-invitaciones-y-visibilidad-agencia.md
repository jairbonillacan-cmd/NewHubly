# 0007. Modelo de roles de agencia, invitaciones con token hasheado y visibilidad compartida en RLS

Estado: Propuesto
Fecha: 2026-11-04
Issue: #60

## Contexto

La Fase 1A entregó espacios de trabajo individuales donde el creador es `owner` y todas las notas y pendientes son privados por autor (`created_by = (select auth.uid())`), conforme a los [ADR 0003](0003-multi-tenancy.md) y [ADR 0004](0004-rls.md). La Fase 1B habilita el trabajo en equipo dentro de una agencia (que sigue siendo una fila de `public.workspaces`), distinguiendo espacios personales (`kind = 'personal'`) de agencias (`kind = 'agency'`) e incorporando cuatro roles (`owner`, `admin`, `editor`, `viewer`), invitaciones de un solo uso con enlace copiable y visibilidad por elemento (`private` o `workspace`).

Toda regla de autorización debe aplicarse tanto en los casos de uso de `@hubly/application` como en Postgres mediante Row Level Security (RLS) forzado, privilegios a nivel de columna y funciones/triggers en el esquema `private`, sin usar jamás `service_role` en `apps/web` y manteniendo intactos los datos y garantías de aislamiento de la Fase 1A.

## Decisión

### 1. Jerarquía de roles, tipo de espacio (`workspaces.kind`), protección del último `owner`, prohibición de auto-escalado y transferencia de propiedad

- **Distinción entre espacio personal y agencia (`public.workspaces.kind`) y creación controlada de agencias:**
  - Se añade a `public.workspaces` la columna `kind text not null default 'personal' check (kind in ('personal', 'agency'))`. `private.create_personal_workspace` crea espacios con `kind = 'personal'`.
  - Se define `private.create_agency_workspace(workspace_name text, workspace_slug text default null) returns uuid` (`language plpgsql security definer set search_path = ''`, ejecutable solo por `authenticated`), que serializa por usuario (`pg_advisory_xact_lock`), verifica un límite máximo de 10 agencias (`kind = 'agency'`) creadas donde el usuario es `owner`, inserta la fila en `public.workspaces` con `kind = 'agency'` e inserta al `(select auth.uid())` como `owner` en `public.workspace_members`.
- **Rol en agencia (`public.workspace_members.role`) y privilegios de columna:**
  - `public.workspace_members.role` se restringe con `check (role in ('owner', 'admin', 'editor', 'viewer'))`.
  - Se define `private.workspace_role(lookup_workspace_id uuid) returns text` (`language sql security definer stable set search_path = ''`, con `revoke execute from public, anon` y `grant execute to authenticated`) que devuelve el rol del `(select auth.uid())` en ese `workspace_id` o `null` si no es miembro.
  - **Solo se puede actualizar la columna `role` en `workspace_members`:** se aplican privilegios explícitos a nivel de columna:
    ```sql
    revoke update on public.workspace_members from authenticated;
    grant update (role) on public.workspace_members to authenticated;
    ```
    Además, el trigger `BEFORE UPDATE ON public.workspace_members` rechaza cualquier intento de modificar `user_id` o `workspace_id` (`if new.user_id <> old.user_id or new.workspace_id <> old.workspace_id then raise exception 'No se permite cambiar user_id ni workspace_id'; end if;`).

#### Matriz de permisos por operación y rol

| Recurso / Operación | `owner` | `admin` | `editor` | `viewer` |
|---|---|---|---|---|
| `workspaces`: `SELECT` | Sí (miembro) | Sí (miembro) | Sí (miembro) | Sí (miembro) |
| `workspaces`: `UPDATE` (nombre/slug) | Sí | Sí | No | No |
| `workspace_members`: `SELECT` | Sí (miembros de su agencia) | Sí (miembros de su agencia) | Sí (miembros de su agencia) | Sí (miembros de su agencia) |
| `workspace_members`: gestionar `editor` / `viewer` | Sí | Sí (solo otros usuarios) | No | No |
| `workspace_members`: gestionar `admin` / `owner` | Sí (protegiendo último `owner`) | No | No | No |
| `workspace_members`: `DELETE` propia fila (salir) | Sí (solo si queda otro `owner` en `kind = 'agency'`) | Sí (en `kind = 'agency'`) | Sí (en `kind = 'agency'`) | Sí (en `kind = 'agency'`) |
| `workspace_invitations`: crear / listar / revocar (solo `kind = 'agency'`) | Sí (roles `admin`, `editor`, `viewer`) | Sí (`SELECT` todas; crear/revocar solo `editor`, `viewer`) | No | No |
| `notes` / `todos` (`visibility = 'private'`) | CRUD solo si `created_by = auth.uid()` | CRUD solo si `created_by = auth.uid()` | CRUD solo si `created_by = auth.uid()` | CRUD solo si `created_by = auth.uid()` |
| `notes` / `todos` (`visibility = 'workspace'`): `SELECT` | Sí | Sí | Sí | Sí (solo lectura) |
| `notes` / `todos` (`visibility = 'workspace'`): `INSERT` | Sí | Sí | Sí | No |
| `notes` / `todos` (`visibility = 'workspace'`): `UPDATE` / `DELETE` | Sí (cualquier autor de la agencia) | Sí (cualquier autor de la agencia) | Sí (contenido/estado; `DELETE` solo si es `created_by`) | No |
| Cambiar `visibility` (`'private' ↔ 'workspace'`) | Solo si `created_by = auth.uid()` | Solo si `created_by = auth.uid()` | Solo si `created_by = auth.uid()` | No |

#### Invariantes de seguridad sobre membresías y roles

1. **Protección del último `owner` con serialización contra degradación concurrente y soporte de `ON DELETE CASCADE`:**
   - El trigger `BEFORE UPDATE OR DELETE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION private.prevent_last_owner_loss()` (`language plpgsql security definer set search_path = ''`):
     1. En `UPDATE`, rechaza si `new.user_id <> old.user_id or new.workspace_id <> old.workspace_id`.
     2. Cuando `old.role = 'owner'` y la operación es `DELETE` o un `UPDATE` con `new.role <> 'owner'`, bloquea primero la fila del espacio en `public.workspaces`:
        ```sql
        perform 1 from public.workspaces where id = old.workspace_id for update;
        if not found then
          return old; -- Borrado en cascada del workspace completo (ON DELETE CASCADE)
        end if;
        perform pg_advisory_xact_lock(hashtext('workspace_owners:' || old.workspace_id::text));
        ```
     3. Con el bloqueo exclusivo adquirido (impidiendo que dos `owner` se degraden o eliminen en transacciones concurrentes), verifica `exists (select 1 from public.workspace_members where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id)` y, si no existe otro `owner` o el espacio es `kind = 'personal'`, lanza excepción con código `23514` (`'El espacio de trabajo debe conservar al menos un propietario (owner)'`).
2. **Un `admin` no nombra `owner` ni modifica o elimina a otros `admin` ni a `owner`, y cualquier miembro puede salir por cuenta propia:**
   - En `workspace_members_update`, un `admin` solo puede actuar cuando la fila objetivo cumple `user_id <> (select auth.uid())` y `role in ('editor', 'viewer')` tanto en `USING` como en `WITH CHECK`.
   - En `workspace_members_delete`, la política `USING` permite:
     - Que cualquier miembro salga por cuenta propia (`user_id = (select auth.uid())`), sujeto siempre al trigger `private.prevent_last_owner_loss()` que impide salir al último `owner` o abandonar el espacio `personal`.
     - Que un `owner` remueva a otros miembros (`private.workspace_role(workspace_id) = 'owner' and user_id <> (select auth.uid())`).
     - Que un `admin` remueva únicamente a `editor` o `viewer` (`private.workspace_role(workspace_id) = 'admin' and user_id <> (select auth.uid()) and role in ('editor', 'viewer')`).
   - En `workspace_invitations`, `INSERT` y `UPDATE` (revocación) exigen que si el actor es `admin`, el campo `role` de la invitación sea estrictamente `in ('editor', 'viewer')`. Solo un `owner` puede invitar o revocar invitaciones con `role = 'admin'`.
3. **Nadie puede subirse de rol a sí mismo (comprobado en RLS):**
   - `workspace_members_update` define:
     - `USING`: `(private.workspace_role(workspace_id) = 'owner' and (user_id <> (select auth.uid()) or role = 'owner')) or (private.workspace_role(workspace_id) = 'admin' and user_id <> (select auth.uid()) and role in ('editor', 'viewer'))`.
     - `WITH CHECK`: `(private.workspace_role(workspace_id) = 'owner' and role in ('owner', 'admin', 'editor', 'viewer')) or (private.workspace_role(workspace_id) = 'admin' and user_id <> (select auth.uid()) and role in ('editor', 'viewer'))`.
   - Ningún `admin`, `editor` ni `viewer` puede hacer `UPDATE` sobre su propia fila (`user_id = (select auth.uid())`), y un `owner` solo puede modificar su propia fila para degradarse cuando ya existe un segundo `owner`.
4. **Transferencia de propiedad en 2 pasos:**
   1. El `owner` actual promueve primero a otro miembro existente de la agencia a `role = 'owner'` (`>= 2` propietarios).
   2. Habiendo al menos 2 `owner`, el propietario anterior puede cambiar su rol a `'admin'`, `'editor'` o `'viewer'`, o salir de la agencia (`DELETE`).

---

### 2. Invitaciones de un solo uso con correo verificado, fragmento URL sin fuga de token y privilegios de columna

#### Esquema y privilegios de columna de `public.workspace_invitations`

- Columnas: `id uuid primary key default gen_random_uuid()`, `workspace_id uuid not null references public.workspaces(id) on delete cascade`, `email text not null check (email = lower(btrim(email)) and position('@' in email) > 1)`, `role text not null check (role in ('admin', 'editor', 'viewer'))`, `token_hash text not null unique check (char_length(token_hash) = 64)` (SHA-256 hex de 32 bytes aleatorios), `invited_by uuid not null`, `expires_at timestamptz not null default (now() + interval '7 days')`, `accepted_at timestamptz`, `accepted_by uuid`, `revoked_at timestamptz`, `created_at timestamptz not null default now()`.
- Índices: `workspace_invitations_active_email_idx` único parcial en `(workspace_id, email) where accepted_at is null and revoked_at is null` e índice `(workspace_id, accepted_at, revoked_at, expires_at)`.
- **Ocultación de `token_hash` a nivel de privilegios de columna y restricción de `SELECT` a `owner` y `admin`:**
  Como RLS filtra filas pero no columnas, se revocan privilegios de tabla y se otorgan por lista explícita de columnas excluyendo `token_hash` en `SELECT`:
  ```sql
  revoke all on public.workspace_invitations from anon, authenticated;
  grant select (id, workspace_id, email, role, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at) on public.workspace_invitations to authenticated;
  grant insert (workspace_id, email, role, token_hash, invited_by, expires_at) on public.workspace_invitations to authenticated;
  grant update (revoked_at) on public.workspace_invitations to authenticated;
  ```
  - La política `workspace_invitations_select` permite listar invitaciones únicamente a `private.workspace_role(workspace_id) in ('owner', 'admin')` (`editor` y `viewer` no pueden listar invitaciones ni correos invitados).
  - Tanto la política `workspace_invitations_insert` como el trigger `private.enforce_workspace_invitation_limit()` exigen que el espacio tenga `kind = 'agency'` (`exists (select 1 from public.workspaces w where w.id = workspace_id and w.kind = 'agency')`), prohibiendo emitir invitaciones a un espacio `personal`.

#### Enlace con fragmento URL (`/invitacion#<raw_token>`), confirmación de correo en producción y límite de 20 pendientes

- **Token fuera de la ruta HTTP (`/invitacion#<raw_token>`) y `Referrer-Policy: no-referrer`:**
  - En la Fase 1B no se envía correo por SMTP. Al crear la invitación, el servidor genera 32 bytes aleatorios (`raw_token` en base64url), persiste solo `token_hash` (SHA-256) y devuelve por única vez el enlace `/invitacion#<raw_token>`.
  - Al viajar en el fragmento URL (`#`), el navegador **nunca** envía `<raw_token>` en la petición HTTP GET al servidor, ni en logs de acceso, ni en la cabecera `Referer`.
  - La ruta `/invitacion` envía la cabecera `Referrer-Policy: no-referrer`, lee `window.location.hash` en el cliente, limpia de inmediato el fragmento con `window.history.replaceState(null, "", "/invitacion")` y envía el token en el cuerpo de un `POST` (Server Action) hacia `private.accept_workspace_invitation(raw_token text)`.
- **Verificación de correo en `private.accept_workspace_invitation(raw_token text)` y requisito de producción:**
  - Función `language plpgsql security definer set search_path = ''` ejecutable solo por `authenticated`.
  - Calcula `v_hash := encode(sha256(convert_to(btrim(raw_token), 'UTF8')), 'hex')`, bloquea (`FOR UPDATE`) la invitación activa (`accepted_at is null and revoked_at is null and expires_at > now()`) y verifica que el espacio sea `kind = 'agency'`.
  - Verifica en `auth.users` que `u.id = (select auth.uid())`, `u.email_confirmed_at is not null` y `lower(btrim(u.email)) = v_invitation.email`; de lo contrario lanza excepción sin consumir la invitación.
  - **Regla obligatoria de producción (Issue #59):** en el proyecto de Supabase de producción debe estar activada la confirmación obligatoria de correo (`enable_confirmations = true` / `mailer_autoconfirm = false`) para que `auth.users.email_confirmed_at` garantice posesión criptográfica del buzón; su verificación forma parte de la lista de control de despliegue del Issue #59.
- **Límite por agencia:** máximo **20 invitaciones pendientes activas** (`accepted_at is null and revoked_at is null and expires_at > now()`) por espacio `kind = 'agency'`, reforzado con el trigger `BEFORE INSERT ON public.workspace_invitations` (`private.enforce_workspace_invitation_limit()`).

---

### 3. Qué pasa con los elementos compartidos y privados cuando alguien sale o es removido (Constitución #5)

1. **Elementos compartidos (`visibility = 'workspace'`):** cuando un miembro sale voluntariamente o es removido por un `owner`/`admin`, todas las notas y pendientes con `visibility = 'workspace'` que hubiera creado **permanecen en la agencia**, siguen siendo visibles para los miembros activos y editables por `owner`, `admin` y `editor`, conservando `created_by` como registro histórico de autoría (`created_by` no tiene `on delete cascade` hacia `workspace_members`).
2. **Pérdida inmediata de acceso a la agencia:** al eliminarse su fila de `public.workspace_members`, el exmiembro deja de cumplir `private.is_workspace_member(workspace_id)` y `private.workspace_role(workspace_id) is not null`, perdiendo de inmediato todo acceso a la agencia.
3. **Preservación y reubicación automática de los elementos privados (`visibility = 'private'`) del miembro saliente (Constitución #5: los datos son del cliente):**
   - Nunca se exponen a los demás miembros de la agencia (ni a `owner` ni a `admin`).
   - Antes de salir voluntariamente, la interfaz ofrece al miembro exportar sus elementos privados de esa agencia.
   - Además, un trigger `BEFORE DELETE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION private.relocate_or_cleanup_member_private_items()` (`language plpgsql security definer set search_path = ''`, con `revoke execute from public, anon, authenticated`):
     - Si la agencia aún existe en `public.workspaces` (no es un borrado en cascada del espacio), busca el espacio personal del usuario (`select w.id from public.workspaces w join public.workspace_members wm on wm.workspace_id = w.id where wm.user_id = old.user_id and wm.role = 'owner' and w.kind = 'personal' order by w.created_at asc limit 1`).
     - Si el usuario tiene espacio personal, **reubica automáticamente** sus notas y pendientes con `visibility = 'private'` y `created_by = old.user_id` de `old.workspace_id` hacia su `workspace_id` personal (desvinculando `note_id = null` en aquellos pendientes privados que apuntaran a una nota con `visibility = 'workspace'` que permanece en la agencia, y conservando `note_id` cuando tanto la nota como el pendiente eran `'private'` del mismo usuario). Si no existiera espacio personal (p. ej. borrado total de cuenta), elimina dichas filas `'private'`. Así el usuario **jamás pierde sus borradores privados** y nunca quedan filas huérfanas inaccesibles en la agencia.

---

### 4. Quién puede cambiar la visibilidad (`private` ↔ `workspace`) y trigger `SECURITY DEFINER` al privatizar una nota

1. **Solo el autor (`created_by`) con rol `owner`, `admin` o `editor` puede cambiar `visibility`:**
   - Un elemento nace con `visibility = 'private'` por defecto (o `'workspace'` si el creador tiene rol `owner`, `admin` o `editor` y así lo elige). Un `viewer` jamás puede crear ni pasar elementos a `'workspace'`.
   - El cambio de `visibility` (`'private' ↔ 'workspace'`) está reservado exclusivamente al autor (`created_by = (select auth.uid())` con rol `in ('owner', 'admin', 'editor')`). Ni siquiera un `owner` o `admin` distinto de `created_by` puede pasar a `'private'` un elemento de otro autor.
   - Un trigger `BEFORE UPDATE ON public.notes` y `public.todos` (`private.enforce_item_ownership_and_visibility()`) garantiza que `new.created_by = old.created_by`, `new.workspace_id = old.workspace_id` (salvo cuando actúa el trigger interno de reubicación al salir de la agencia) y que si `old.visibility <> new.visibility` entonces `old.created_by = (select auth.uid())`.
2. **Desvinculación de pendientes ajenos o compartidos mediante trigger `SECURITY DEFINER` al volver una nota a `'private'`:**
   - Un pendiente con `visibility = 'workspace'` solo puede vincularse (`note_id is not null`) a una nota del mismo `workspace_id` que tenga `visibility = 'workspace'`.
   - Un pendiente con `visibility = 'private'` solo puede vincularse a una nota del mismo `workspace_id` visible para su autor (`visibility = 'workspace'` o `(visibility = 'private' and created_by = (select auth.uid()))`).
   - Cuando una **nota** pasa de `visibility = 'workspace'` a `visibility = 'private'`, el autor de la nota no tiene visibilidad RLS sobre los pendientes con `visibility = 'private'` que otros miembros hayan vinculado a esa nota. Por ello, la función del trigger `AFTER UPDATE OF visibility ON public.notes` (`private.unlink_todos_on_note_privatized()`) se define obligatoriamente como `language plpgsql security definer set search_path = ''` (con `revoke execute on function private.unlink_todos_on_note_privatized() from public, anon, authenticated;`) y ejecuta:
     ```sql
     update public.todos
     set note_id = null
     where workspace_id = new.workspace_id
       and note_id = new.id
       and (created_by <> new.created_by or visibility = 'workspace');
     ```
     Esto garantiza que también se desvinculen los pendientes privados de otros miembros sin que RLS filtre las filas en silencio, y se verifica con una prueba específica contra Postgres real.

---

### 5. Migración SQL de Fase 1B: reemplazo de políticas de `notes` y `todos` y compatibilidad con 1A

La migración hacia adelante de la Fase 1B (`supabase/migrations/20261104000000_fase1b_agency_roles_invitations_visibility.sql`) ejecuta en una sola transacción:

1. **Columnas aditivas con preservación total de datos de 1A:**
   - `alter table public.workspaces add column kind text not null default 'personal' check (kind in ('personal', 'agency'));`
   - `alter table public.notes add column visibility text not null default 'private' check (visibility in ('private', 'workspace'));`
   - `alter table public.todos add column visibility text not null default 'private' check (visibility in ('private', 'workspace'));`
   - Todas las filas existentes de la Fase 1A quedan con `workspaces.kind = 'personal'` y `visibility = 'private'`, conservando intacto su aislamiento.
   - Nuevos índices compuestos: `(workspace_id, visibility, is_archived)` en `public.notes` y `(workspace_id, visibility, is_done, due_date)` en `public.todos`.
2. **Reemplazo explícito (`DROP POLICY` + `CREATE POLICY`) en `public.notes` y `public.todos`:**
   - Se eliminan las 8 políticas de 1A (`notes_select`, `notes_insert`, `notes_update`, `notes_delete`, `todos_select`, `todos_insert`, `todos_update`, `todos_delete`) y se crean las políticas de 1B:
     - `SELECT` (`notes_select` / `todos_select`):
       `private.workspace_role(workspace_id) is not null and (visibility = 'workspace' or created_by = (select auth.uid()))`
     - `INSERT` (`notes_insert` / `todos_insert`):
       `created_by = (select auth.uid()) and ((visibility = 'private' and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor')))` (más la validación de `note_id` coherente en `todos_insert`).
     - `UPDATE` (`notes_update` / `todos_update`):
       - `USING`: `(created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor'))`
       - `WITH CHECK`: `((visibility = 'private' and created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor')))` (reforzado por `private.enforce_item_ownership_and_visibility()` y la validación de `note_id` en `todos_update`).
     - `DELETE` (`notes_delete` / `todos_delete`):
       `(created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin'))`
3. **Reversión documentada y pruebas de regresión obligatorias:**
   - La migración incluye en comentarios el script SQL de reversión (`DROP POLICY` de 1B, restauración de políticas y ` GRANTS` de 1A, `DROP TABLE public.workspace_invitations`, `DROP COLUMN visibility`, `DROP COLUMN kind`).
   - La suite de 1A (`packages/db/tests/rls-catalog.test.ts`, `packages/db/tests/rls-isolation.test.ts` y `apps/web/tests/e2e/workspace-flow.test.tsx`) debe seguir pasando sin debilitar un solo chequeo, junto con las pruebas de 1B contra Postgres real (jerarquía de roles, privilegios de columna en `workspace_members` y `workspace_invitations`, bloqueo concurrente del último `owner` y `ON DELETE CASCADE`, prohibición de invitar al espacio `personal`, reubicación de elementos `'private'` al salir de una agencia, y desvinculación `SECURITY DEFINER` de pendientes privados de otros miembros al privatizar una nota).

## Consecuencias

- Ninguna nota ni pendiente de la Fase 1A cambia de visibilidad al desplegar la Fase 1B, y ningún miembro pierde sus borradores `'private'` al salir o ser removido de una agencia porque se reubican automáticamente en su espacio `personal`.
- Los tokens de invitación nunca viajan en rutas HTTP ni se exponen en `SELECT` gracias al fragmento URL `/invitacion#<raw_token>`, `Referrer-Policy: no-referrer`, `token_hash` SHA-256 y privilegios de columna en `public.workspace_invitations`.

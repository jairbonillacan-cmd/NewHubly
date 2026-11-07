# Reporte de Auditoría de Seguridad — Corrida Base (`run-1`)

## 1. Parámetros de la Corrida y Alcance

- **Perfil y alcance:** `standard`, alcance completo del repositorio (`scope_paths: ["."]`).
- **Metodología:** Auditoría estructurada en 6 fases (`security-audit`), con **17 subagentes** independientes (`4` en Fase 1 Reconocimiento, `6` Hunters en Fase 2 Ola 1, `1` Post-Wave Coverage Critic, `1` Final-Clean Coverage Critic, `3` Verificadores Adversariales en Fase 3 y `2` Verificadores de Registros Finales en Fase 5).
- **Referencia de código auditada:** `f0776506e3c078bdbba9f86d26c921aee8389c9c` (`main` en `8c202f362040376640d157d92e541555e0d41315`).
- **Política de ejecución:** Análisis estático profundo de código fuente (`method: "source"`, `artifact: null`) sin contactar servicios externos ni ejecutar tráfico contra entornos desplegados.
- **Cobertura diferida o fuera de alcance:** `0` unidades `deferred`, `0` unidades `out_of_scope`, `0` unidades `blocked`.

---

## 2. Resumen de Postura de Seguridad

La arquitectura de **Hubly** muestra una postura defensiva sólida y alineada con [docs/CONSTITUCION.md](../CONSTITUCION.md):

- **Aislamiento multi-tenant y base de datos:** Todas las tablas de negocio (`public.workspaces`, `public.workspace_members`, `public.workspace_invitations`, `public.notes`, `public.todos`, `public.user_preferences`, `public.user_presence` y `private.chat_*`) tienen `ENABLE` y `FORCE ROW LEVEL SECURITY`, revocan privilegios a `anon`/`public`, restringen permisos a nivel de columna (ocultando `token_hash` en `workspace_invitations` y restringiendo `UPDATE` en `workspace_members` únicamente a `role`) y ejecutan todas las consultas Drizzle dentro de `withUserContext` (`SET LOCAL ROLE authenticated` + `request.jwt.claims`).
- **Operaciones críticas en SQL (`SECURITY DEFINER`):** Las funciones en el esquema `private` fijan `search_path = ''`, usan bloqueos transaccionales (`pg_advisory_xact_lock`) y bloqueos de fila (`FOR UPDATE` / `FOR SHARE`) en orden determinista para evitar pérdida del último propietario (`trg_01_prevent_last_owner_loss`), limitar agencias por propietario (`10`), limitar invitaciones pendientes (`20`) y aplicar límites de tasa en chat (`30` mensajes/minuto y `2` segundos entre ediciones).
- **Superficies HTTP, archivos y cliente:** Las sesiones usan cookies `HttpOnly`, `SameSite=Lax` y `Secure` (en producción); los tokens de invitación viajan en el fragmento URL (`/invitacion#<token>`) con `Referrer-Policy: no-referrer` y limpieza inmediata del historial; las imágenes subidas pasan por un parser binario en memoria (`sanitizeWallpaperImage`) que valida firmas mágicas (JPEG/PNG/WebP hasta 5 MB) y elimina metadatos EXIF/GPS/XMP/IPTC/comentarios antes de subirlas a buckets privados; y las reglas estáticas (`check-boundaries.mjs` / `boundaries-report.mjs`) impiden el uso de `service_role` en web, bloquean `dangerouslySetInnerHTML`/`innerHTML` y restringen las claves de `localStorage`.

**Resultado de hallazgos:**
- **0 vulnerabilidades `confirmed`**.
- **2 candidatos en `needs_validation`** (uno por un defecto lógico real en `ensurePersonalWorkspace` + `relocate_or_cleanup_member_private_items` cuya reproducción dinámica requiere Postgres 17 local, y otro que depende de la configuración externa de confirmación de correo en Supabase Auth de producción).
- **1 candidato `rejected`** (`newhubly:chat:csrf-same-origin-forwarded-headers`, refutado en Fase 3).

---

## 3. Hallazgos Confirmados (`confirmed`)

No se registraron hallazgos con veredicto `confirmed` en esta corrida.

---

## 4. Candidatos Pendientes de Validación (`needs_validation`)

Estos registros representan hipótesis de frontera fundamentadas en el código fuente cuya confirmación final depende de ejecución local con PostgreSQL 17 o de un hecho de configuración externo. Conforme a la metodología de auditoría, no llevan severidad asignada y sus planes de resolución son estrictamente locales o de observación pasiva por el propietario.

### 4.1. `newhubly:db:ensure-personal-workspace-agency-only-relocation-loss`

- **Título:** Miembro solo de agencia sin espacio personal aprovisionado pierde sus notas y pendientes privados al ser removido de la agencia.
- **Frontera afectada:** Preservación de datos privados del miembro saliente al ser removido de una agencia (`private.relocate_or_cleanup_member_private_items` / [Constitución #5](../CONSTITUCION.md) y [ADR 0007 §3.3](../adr/0007-roles-invitaciones-y-visibilidad-agencia.md)).
- **Causa raíz reclamada:** `acceptWorkspaceInvitationByToken` (`apps/web/src/server/composition/invitations.ts:35-42`) y `private.accept_workspace_invitation` (`supabase/migrations/20261104000000_fase1b_agency_roles_invitations_visibility.sql:119-136`) agregan a un usuario a un espacio `kind = 'agency'` sin asegurar que exista un espacio `kind = 'personal'`, mientras que `DrizzleWorkspaceRepository.ensurePersonalWorkspace` (`packages/db/src/repositories/index.ts:205-218`) retorna `members[0]?.workspaceId` siempre que exista al menos una membresía (línea 213) sin verificar `kind = 'personal'`, dejando `v_personal_ws` en `NULL` dentro de `private.relocate_or_cleanup_member_private_items()` (`supabase/migrations/20261104000000_fase1b_agency_roles_invitations_visibility.sql:70-88`) de modo que el trigger elimina permanentemente las notas y pendientes `visibility = 'private'` al remover la membresía (líneas 83-86).
- **Traza en el repositorio:**
  1. `[entrypoint]` `apps/web/src/actions/index.ts:109` (`acceptWorkspaceInvitationAction`) — Server Action que acepta un token de invitación de agencia de un usuario autenticado sin invocar `ensureAuthenticatedWorkspace()` ni `ensurePersonalWorkspace()`.
  2. `[propagation]` `apps/web/src/server/composition/invitations.ts:35` (`acceptWorkspaceInvitationByToken`) — Verifica la sesión mediante `getVerifiedServerSession()`, ejecuta `wsRepo.acceptInvitation(rawToken)` y guarda el ID de la agencia en la cookie `hubly_ws` sin aprovisionar un espacio personal.
  3. `[propagation]` `packages/db/src/repositories/index.ts:205` (`DrizzleWorkspaceRepository.ensurePersonalWorkspace`) — Consulta `workspace_members` para `claims.sub` (línea 208), solo busca `w.kind = 'personal'` cuando `members.length > 1` (líneas 209-212) y retorna `members[0]?.workspaceId` en la línea 213 aunque todas las membresías existentes sean `kind = 'agency'`, sin llamar nunca a `private.create_personal_workspace`.
  4. `[propagation]` `apps/web/src/actions/index.ts:115` (`removeOrLeaveWorkspaceMemberAction`) — Invoca `removeOrLeaveMemberUseCase` → `DrizzleWorkspaceRepository.removeMember` para eliminar la fila del miembro en `public.workspace_members`.
  5. `[sink]` `supabase/migrations/20261104000000_fase1b_agency_roles_invitations_visibility.sql:70` (`private.relocate_or_cleanup_member_private_items`) — Trigger `BEFORE DELETE` en `public.workspace_members` que busca un espacio con `wm.role = 'owner' and w.kind = 'personal'` (líneas 74-75); cuando `v_personal_ws` es `NULL`, la rama `else` (líneas 83-86) ejecuta `DELETE FROM public.todos` y `DELETE FROM public.notes` sobre los elementos `visibility = 'private'` del miembro en esa agencia.
- **Evidencia verificada:**
  - `apps/web/src/server/composition/invitations.ts:39`: `acceptWorkspaceInvitationByToken` llama a `new DrizzleWorkspaceRepository(claims, db).acceptInvitation(rawToken)` y fija `hubly_ws` sin llamar a `ensurePersonalWorkspace()`.
  - `apps/web/src/server/composition/index.ts:84`: `ensureAuthenticatedWorkspace` resuelve `cookieWsId` directamente cuando `wsRepo.findMember(cookieWsId, claims.sub)` tiene éxito, omitiendo `wsRepo.ensurePersonalWorkspace()` mientras `hubly_ws` apunte a la agencia.
  - `packages/db/src/repositories/index.ts:209`: `ensurePersonalWorkspace` solo consulta `w.kind = 'personal'` cuando `members.length > 1` y cae en la línea 213 retornando `members[0]?.workspaceId` siempre que exista al menos una membresía de agencia.
  - `supabase/migrations/20261104000000_fase1b_agency_roles_invitations_visibility.sql:83`: En `private.relocate_or_cleanup_member_private_items()`, cuando `v_personal_ws` es `NULL`, las líneas 84-85 ejecutan `DELETE FROM public.todos` y `DELETE FROM public.notes` para los elementos privados de `old.user_id` en `old.workspace_id`.
  - `apps/web/tests/agency-actions.test.ts:83`: Prueba de integración existente que inserta a `viewer` en `auth.users`, acepta una invitación de agencia vía `acceptWorkspaceInvitationAction` sin aprovisionar antes un espacio personal y crea una nota privada en la agencia en la línea 91.
- **Bloqueadores:**
  - Ausencia de una instancia activa de Postgres 17 durante la corrida estática para ejecutar la reproducción dinámica del trigger.
  - Los puntos de entrada web estándar (`signInWithPasswordAction`, `signUpWithPasswordAction`, `GET /auth/confirm` y `GET /auth/callback` vía `completeEmailLinkSignIn`) llaman a `ensureAuthenticatedWorkspace()` antes de retornar, por lo que llegar a `acceptWorkspaceInvitationAction` sin un espacio personal en producción requiere un fallo transitorio de base de datos después de que Supabase Auth establezca las cookies de sesión, o una sesión establecida fuera de `completeEmailLinkSignIn`.
- **Plan de validación:**
  - **Local:** Con Postgres 17 y las migraciones aplicadas, ejecutar una prueba Vitest en `apps/web/tests/agency-actions.test.ts` donde un usuario confirmado acepte una invitación vía `acceptWorkspaceInvitationAction` sin aprovisionamiento previo de `ensurePersonalWorkspace()`, cree una nota y un pendiente `visibility = 'private'` en la agencia y sea removido por el `owner` mediante `removeOrLeaveWorkspaceMemberAction`; comprobar que `trg_02_relocate_member_private_items` elimina los ítems privados y corregir `ensurePersonalWorkspace`.
  - **Despliegue:** Ejecutar una consulta SQL de solo lectura en producción para comprobar si algún miembro de agencia carece de espacio personal:
    ```sql
    SELECT wm.user_id
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE w.kind = 'agency'
      AND NOT EXISTS (
        SELECT 1
        FROM public.workspace_members wm2
        JOIN public.workspaces w2 ON w2.id = wm2.workspace_id
        WHERE wm2.user_id = wm.user_id
          AND wm2.role = 'owner'
          AND w2.kind = 'personal'
      );
    ```

### 4.2. `newhubly:auth:invitation-email-confirmation-supabase-config`

- **Título:** La vinculación de titularidad del correo en invitaciones de agencia depende de la configuración externa de confirmación en Supabase Auth.
- **Frontera afectada:** Verificación de posesión del buzón de correo electrónico al aceptar invitaciones de agencia (`private.accept_workspace_invitation` / [ADR 0007 §2](../adr/0007-roles-invitaciones-y-visibilidad-agencia.md)).
- **Causa raíz reclamada:** `private.accept_workspace_invitation` (`supabase/migrations/20261104000000_fase1b_agency_roles_invitations_visibility.sql:119-136`) valida la posesión del correo invitado únicamente comprobando `u.email_confirmed_at is not null and lower(btrim(u.email)) = v_inv.email` en `auth.users` (líneas 130-131), mientras que `signUpWithPasswordAction` (`apps/web/src/actions/auth.ts:25-41`) contempla registros autoconfirmados cuando `data.session` se devuelve de inmediato (líneas 38-40) y `supabase/config.toml` no define `[auth.email] enable_confirmations = true`.
- **Traza en el repositorio:**
  1. `[entrypoint]` `apps/web/src/actions/auth.ts:25` (`signUpWithPasswordAction`) — Server Action que invoca `supabase.auth.signUp` con correo y contraseña provistos por el usuario y, cuando Supabase Auth devuelve una sesión no nula, aprovisiona de inmediato la sesión autenticada con `requiresEmailConfirmation: false` en las líneas 38-40.
  2. `[propagation]` `apps/web/src/actions/index.ts:109` (`acceptWorkspaceInvitationAction`) — Server Action que recibe `{ token }` del cliente y lo delega a `acceptWorkspaceInvitationSafely(input.token)`.
  3. `[propagation]` `apps/web/src/server/composition/invitations.ts:35` (`acceptWorkspaceInvitationByToken`) — Valida el token de invitación, resuelve la sesión verificada con `getVerifiedServerSession()` y llama a `DrizzleWorkspaceRepository.acceptInvitation(rawToken)`.
  4. `[propagation]` `packages/db/src/repositories/index.ts:251` (`DrizzleWorkspaceRepository.acceptInvitation`) — Ejecuta `select private.accept_workspace_invitation(rawToken)` dentro del contexto transaccional del usuario autenticado.
  5. `[sink]` `supabase/migrations/20261104000000_fase1b_agency_roles_invitations_visibility.sql:119` (`private.accept_workspace_invitation`) — Función `SECURITY DEFINER` que comprueba `auth.users.email_confirmed_at is not null and lower(btrim(u.email)) = v_inv.email` en las líneas 130-131 antes de insertar al usuario en `public.workspace_members` en la línea 133.
- **Bloqueadores:** Si el proyecto Supabase Auth desplegado tiene activada la confirmación obligatoria de correo (`enable_confirmations = true` / `mailer_autoconfirm = false`) es una configuración externa del plano de control fuera de las migraciones SQL del repositorio.
- **Plan de validación:**
  - **Local:** Añadir `[auth.email] enable_confirmations = true` en `supabase/config.toml` y verificar contra el stack local de Supabase que `supabase.auth.signUp` devuelva `data.session === null` con `email_confirmed_at = null` hasta que `/auth/confirm` complete la verificación OTP.
  - **Despliegue:** Verificar en el panel del proyecto Supabase de producción (`Authentication -> Providers -> Email`) que *Confirm email* esté habilitado (`enable_confirmations = true` / `mailer_autoconfirm = false`).

---

## 5. Candidato Refutado (`rejected`)

- **`newhubly:chat:csrf-same-origin-forwarded-headers`:** Se evaluó si `sameOrigin` en `POST /api/chat` (`apps/web/src/app/api/chat/route.ts:75-93`) permitía CSRF cross-origin cuando falta `Origin` o mediante cabeceras `x-forwarded-host`. Fue refutado en Fase 3 porque `POST /api/chat` exige `Content-Type: application/json` (`apps/web/src/app/api/chat/route.ts:96`), lo que obliga a cualquier navegador cross-origin a enviar un preflight CORS `OPTIONS` que falla al no existir cabeceras `Access-Control-Allow-Origin`, además de usar cookies de sesión con `SameSite=Lax`.

---

## 6. Recomendaciones de Endurecimiento (Defensa en Profundidad)

1. **Corregir `ensurePersonalWorkspace` y asegurar espacio personal al reubicar (`packages/db/src/repositories/index.ts:205-218`, `supabase/migrations/20261104000000_fase1b_agency_roles_invitations_visibility.sql:70-88`):**
   - Consultar directamente `w.kind = 'personal'` en `DrizzleWorkspaceRepository.ensurePersonalWorkspace` sin condicionar a `if (members.length > 1)` ni retornar `members[0]?.workspaceId` cuando este sea `agency`. En `private.relocate_or_cleanup_member_private_items()`, si el usuario aún existe en `auth.users` y `v_personal_ws IS NULL`, aprovisionar su espacio personal antes de reubicar en vez de eliminar sus notas y pendientes privados.
2. **Implementar cabeceras de seguridad globales y CSP con nonce (`apps/web/next.config.ts:8-10`, `apps/web/src/middleware.ts`, `docs/CONSTITUCION.md:29`):**
   - Añadir `Content-Security-Policy` con nonce (incluyendo `frame-ancestors 'none'` y cubriendo el script inline `THEME_BOOTSTRAP` en `apps/web/src/app/layout.tsx:51`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin` de forma global.
3. **Evitar acceso a propiedades de `Object.prototype` en `linkErrorMessage` (`apps/web/src/app/(public)/login/page.tsx:24-28`):**
   - Sustituir `LINK_ERRORS[code]` por `Object.hasOwn(LINK_ERRORS, code) ? LINK_ERRORS[code] : null` para evitar que `?error=__proto__` o `?error=constructor` devuelvan una función heredada y provoquen un error de renderizado en React.
4. **Añadir `.claude/` a `.gitignore` (`.gitignore:1-20`):**
   - Ignorar `.claude/` junto a `.agents/` para impedir que archivos locales de configuración o credenciales de prueba puedan agregarse por accidente al índice de Git.
5. **Limpiar la cookie `hubly_ws` al cerrar sesión (`apps/web/src/actions/auth.ts:61-64`):**
   - Invocar `await persistActiveWorkspaceCookie(null)` dentro de `signOutAction()`.
6. **Validar con Zod argumentos primitivos en Server Actions y escapar comodines `ILIKE` (`apps/web/src/actions/index.ts:64-87`, `packages/db/src/repositories/index.ts:65-68`, `packages/contracts/src/index.ts:26-37`):**
   - Validar `todoId`, `noteId`, `isPinned`, `isArchived`, `view` y `filter` con esquemas Zod en `@hubly/contracts`, añadir un límite explícito `.max(100_000)` a `note.content` y escapar `%`, `_` y `\` en `ilike(notes.title, ...)`.
7. **Ajustar predicado RLS de objetos en Storage al nombre exacto (`supabase/migrations/20261106000000_user_wallpapers_storage.sql:21-29`, `supabase/migrations/20261108000000_user_avatars_storage.sql:16-24`):**
   - Restringir `name = (select auth.uid())::text || '/fondo'` y `name = (select auth.uid())::text || '/foto'` en las políticas RLS de `storage.objects` para reflejar en SQL la invariante de objeto único por usuario del [ADR 0008](../adr/0008-fondo-propio-storage-privado.md).
8. **Fijar `sameOrigin` a `resolveSiteUrl()` y validar rama en `supabase-produccion.yml` (`apps/web/src/app/api/chat/route.ts:88-92`, `.github/workflows/supabase-produccion.yml:42-45`):**
   - Comparar `Origin` contra `new URL(resolveSiteUrl()).origin` además de `reqUrl.origin`, y verificar en GitHub que la política de despliegue del entorno `production` acepte únicamente la rama `produccion`.

---

## 7. Resumen del Libro Mayor de Cobertura (`11 / 11` Unidades)

| ID de Unidad | Superficie / Componente | Estado |
|---|---|---|
| `web-auth-entrypoints` | Login, registro, `/auth/confirm`, `/auth/callback`, cookies SSR y redirecciones | `covered` |
| `web-workspace-and-invitations` | Composición de espacios, aceptación de invitaciones y `ensurePersonalWorkspace` | `candidate` (`4.1`, `4.2`) |
| `web-notes-todos-actions` | Server Actions de notas/pendientes y contratos Zod (`@hubly/contracts`) | `covered` |
| `web-agency-chat-api` | `GET`/`POST /api/chat`, `sameOrigin`, paginación y acciones de chat | `covered` |
| `web-media-upload-and-storage` | Subida de fondos/avatares, `sanitizeWallpaperImage` y políticas de `storage.objects` | `covered` |
| `db-rls-and-definer-core` | Políticas RLS de tablas públicas, triggers de agencias/invitaciones y reubicación | `candidate` (`4.1`, `4.2`) |
| `db-chat-and-presence-rls` | Esquema `private.chat_*`, rate-limits SQL, bloqueos de concurrencia y presencia | `covered` |
| `db-drizzle-repositories` | `withUserContext`, inyección de claims JWT y repositorios Drizzle | `covered` |
| `client-ui-and-storage` | Páginas públicas/privadas, captura de hash en `/invitacion`, `localStorage` y `packages/ui` | `covered` |
| `ci-cd-and-guardrails` | Workflows de GitHub Actions (`ci.yml`, `supabase-produccion.yml`) y scripts de fronteras | `covered` |
| `supply-chain-and-workspace-config` | `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `supabase/config.toml` y secretos | `covered` |

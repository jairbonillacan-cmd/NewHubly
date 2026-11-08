# Reporte de Auditoría de Seguridad — Corrida `run-2`

Fecha: 8 de noviembre de 2026. Base auditada: `c9ef7cc` (`main`). Alcance: repositorio completo (`apps/web`, `packages/*`, `supabase/`, `.github/`, historial de git y dependencias).

**Importante:** la corrida fue **solo de fuente** — el host no garantizó el sandbox que la metodología exige para ejecutar código del objetivo (builds, tests, Postgres, Storage), así que no se ejecutó nada. Por eso **no hay hallazgos confirmados ni severidades**: hay 12 pistas `needs_validation`, cada una con su bloqueador exacto y un plan de validación no destructivo (local con datos dummy, o de observación del dueño). Ninguna pista es una vulnerabilidad hasta que su validación la confirme. El seguimiento está en #275.

## 1. Parámetros de la corrida

- **Perfil:** `standard`, alcance completo, 28 unidades canónicas de cobertura (superficie × frontera × subsistema × clase de ataque).
- **Metodología:** la skill `security-audit` en sus 6 fases: 5 agentes de reconocimiento, 12 hunters en 3 olas, 3 críticos de cobertura (los dos post-ola aceptaron 2 lagunas que se cubrieron; el crítico final-distinto devolvió parada limpia sin lagunas), 12 verificadores adversariales de candidatos y 12 verificadores finales de registros (39 agentes en total). Ambos validadores de la skill (findings y coverage ledger) en verde.
- **Fuente:** `c9ef7cc`. A mitad de corrida el árbol local avanzó con commits de tema/UI; la unidad afectada (render de cliente y localStorage) fue reverificada sobre ese árbol sin materialidad ni candidatos nuevos, y `main` quedó en la base auditada.
- **Corrida previa:** los 2 leads `needs_validation` de run-1 (#248) se re-verificaron contra la fuente actual con el mismo fingerprint (siguen como NV-1 y NV-2); el registro `rejected` de run-1 (CSRF por forwarded headers en `/api/chat`) se re-cazó porque la fuente cambió con el chat 2.0 y su rechazo se sostiene.
- **Verificación de citas:** a diferencia de run-1 (#254), todas las citas `archivo:línea` de este reporte fueron contrastadas dos veces contra el árbol real por verificadores independientes de la propia metodología.

## 2. Resumen de postura

La postura es sólida y mantiene lo que run-1 verificó: RLS `ENABLE+FORCE` en todas las tablas con `withUserContext` (claims del servidor, nunca del cliente; `anon` sin grants), escrituras de negocio en funciones `SECURITY DEFINER` con `search_path = ''` y locks ordenados, chat con cuotas en BD (30 mensajes/min, 60 reacciones/min, 60 menciones leídas/min, 2 s entre ediciones), adjuntos con cuarentena (TTL 10 min), saneado binario por firmas mágicas (JPEG/PNG/WebP/GIF/PDF, PDF sin `/JavaScript`, `/ObjStm`, etc.), tokens de invitación de 256 bits con solo su SHA-256 en BD, `sameOrigin()` + JSON obligatorio en los POST del API, y CI con acciones fijadas por SHA, `contents: read` y migración a producción gated por entorno con revisores.

## 3. Pistas pendientes de validación

Las rutas y líneas corresponden al árbol de `c9ef7cc` y fueron verificadas. Plan de validación completo en #275.

| # | Pista | Dónde | Bloqueador principal |
|---|---|---|---|
| NV-1 | Miembro solo-agencia sin espacio personal pierde sus notas y pendientes privados al ser removido | `packages/db/src/repositories/index.ts:213`, `supabase/migrations/20261104000000_fase1b_agency_roles_invitations_visibility.sql:83-85` | Repro requiere Postgres 17 local; el conteo del dueño decide si el estado existe hoy |
| NV-2 | La propiedad del correo en invitaciones depende de `enable_confirmations` de Supabase Auth producción | `apps/web/src/actions/auth.ts:38`, migración fase 1b `:130-133` | Config del panel de Supabase, invisible en el repo |
| NV-3 | El workflow de migración a producción acepta despachos desde `main` (gate temporal) | `.github/workflows/supabase-produccion.yml:26` | Branch protection y ramas del entorno `production`: hechos hosted |
| NV-4 | Políticas de avatares por carpeta: objetos plantados quedan legibles y sin ciclo de vida | `supabase/migrations/20261119000000_chat_coworker_avatars.sql:19-28` | Comportamiento real de Storage + interpretación del dueño (ADR 0012) |
| NV-5 | Reservas de adjuntos abandonadas acumulan objetos de cuarentena permanentes | `supabase/migrations/20261120000000_chat_attachments.sql:81-85` | Cuota/reglas de ciclo de vida del bucket, fuera del repo |
| NV-6 | Reinvitar un correo con invitación admin vencida bloquea al admin con 23505 | `packages/db/src/repositories/index.ts:242-243` | Observar el 23505 requiere Postgres 17 con RLS |
| NV-7 | `note.content` sin tope y dashboard sin paginación: crecimiento persistente y lectura amplificada | `packages/contracts/src/index.ts:28,34`, `packages/db/src/repositories/index.ts:70` | Topes desplegados (cuotas de Supabase, hosting) fuera del repo |
| NV-8 | Fan-out de correo GoTrue pre-auth sin tope en el repo (magic link y registro) | `apps/web/src/actions/auth.ts:30,47` | Rate limit de GoTrue: dashboard externo; el endpoint es alcanzable directo por la anon key pública |
| NV-9 | El alcance piloto del chat es solo flag de app; la capa SQL habilita chat para todas las agencias | `apps/web/src/server/composition/chat.ts:8`, `supabase/migrations/20261111000000_chat_writes.sql:199` | Exposed schemas del proyecto hospedado |
| NV-10 | `.gitignore` versionado no cubre `.claude/` (contraseña de prueba en claro) | `.gitignore:18-20`, `.claude/usuario-prueba.md:6` | Estado del remoto y de producción no observables offline |
| NV-11 | `?error=constructor/__proto__` atraviesa la lista blanca LINK_ERRORS y rompe el render de /login | `apps/web/src/app/(public)/login/page.tsx:24-28,177` | Render de React no ejecutable en corrida source-only |
| NV-12 | `workspaceId` sin validar se interpola en mensajes de Error que Next 16 registra completos en logs | `apps/web/src/server/composition/index.ts:82,94` | Salida real en ejecución y captura de logs de la plataforma |

### 3.1 NV-1 — Reubicación de privados al remover miembro (heredado de run-1, re-verificado)

`ensurePersonalWorkspace` devuelve `members[0].workspaceId` sin filtrar `kind='personal'` cuando hay una sola membresía (la búsqueda de personal solo corre con más de una), y la aceptación de invitaciones no aprovisiona espacio personal. Si un miembro queda con la agencia como única membresía y es removido, el trigger `relocate_or_cleanup_member_private_items` entra en su rama `else` y **borra** sus notas y pendientes privados en vez de reubicarlos (`delete from public.todos/notes ... visibility = 'private'`), pese a existir `private.create_personal_workspace`. Verificación nueva: ningún flujo actual de la app produce ese estado, pero la política `workspace_members_delete` permite al propio usuario eliminar su membresía personal vía PostgREST directo, lo que crea el estado sin cuentas externas. **Bloqueadores:** repro con Postgres 17 + conteo del dueño (consulta de solo lectura de miembros sin ningún workspace `kind='personal'`).

### 3.2 NV-2 — Confirmación de correo (heredado de run-1, re-verificado)

`accept_workspace_invitation` prueba la posesión del buzón solo con `email_confirmed_at is not null` y la igualdad de correo; la semántica de esa columna la fija la configuración de GoTrue en producción (`enable_confirmations`, `secure_email_change_enabled`), que no está en el repo (`supabase/config.toml` es dev y no fija ninguna de las dos; el ADR 0007 la declara regla de despliegue a verificar). Con autoconfirm, pre-registrar el correo invitado otorgaría la membresía con el rol invitado. **Bloqueador:** el panel de producción; validación local con `supabase start` en ambas configuraciones.

### 3.3 NV-3 — Dispatch de migraciones desde `main`

El gate `if: github.ref == 'refs/heads/produccion' || github.ref == 'refs/heads/main'` es temporal y documentado (#257): la rama `produccion` del ADR 0013 aún no existe y la policy del entorno `production` contiene `main` hoy (commit `7adf642`: «el entorno production sigue limitado a main»). Consecuencia: un usuario con permiso de dispatch puede migrar el HEAD de `main` sin el PR de promoción que exige la política; `workflow_dispatch` no es un push, así que la branch protection de `main` no lo impide, y el chequeo del workflow solo verifica revisores del entorno, no la lista de ramas. **Compensa:** `sha_simulado` estricto, dry-run previo, `persist-credentials: false`, permisos mínimos. **Cierre:** crear `produccion`, retirar el gate y ajustar el entorno.

### 3.4 NV-4 — Avatares por carpeta

La rama de compañeros de `user_avatars_select_own` autoriza por primer segmento de ruta (cualquier objeto bajo `uid/`), no por el nombre exacto `uid/foto` que es lo único que consume la app (`chat_directory`); la INSERT acepta cualquier nombre bajo la carpeta propia y `removeUserAvatar` solo borra `uid/foto`. Un titular puede plantar `user-avatars/<uid>/extra` por la Storage API y sus compañeros de cualquier workspace compartido (la población amplia la eligió el ADR 0012 a propósito) pueden leerlo, y el objeto sobrevive a «quitar la foto». La lectura por carpeta puede leerse dentro de la letra del ADR 0012 («el titular del objeto»): la interpretación del dueño decide si se endurece al nombre exacto (run-1 rec 7) o se acepta como diseño. **Bloqueadores:** comportamiento real de Storage (`allowed_mime_types` sobre el tipo declarado del PUT) y drift de políticas del panel.

### 3.5 NV-5 — Cuarentena huérfana de adjuntos

El tope de 5 reservas por mensaje cuenta solo reservas activas (`expires_at > clock_timestamp()`) más adjuntos registrados, así que alternar mensajes propios (cuota 30/min) permite ciclos infinitos de reservar→subir→abandonar sin commit. La única limpieza de vencidas es por mensaje y al re-reservar; el trigger de retiro borra filas, nunca `storage.objects`; no hay `pg_cron` ni regla de ciclo de vida en el repo. Agravante: al purgar la fila vencida, el objeto queda sin fila que lo referencie y ninguna cláusula de `chat_can_delete_attachment_object` lo cubre: **deja de ser borrable incluso por su autor**. Sin commit no hay exposición (fail-closed). **Cierre:** job de purga con `service_role` o cota agregada; conteo de huérfanos en producción.

### 3.6 NV-6 — Invitación admin vencida bloquea al admin

La revocación previa al insert corre con los privilegios del invitante (`set local role authenticated`, sin DEFINER): la política de update solo deja al admin tocar filas `role in ('editor','viewer')`, así que para una vencida `role='admin'` el revoke afecta 0 filas en silencio (sin chequeo de filas afectadas, a diferencia de `revokeInvitation`) y el INSERT viola el índice único parcial (su predicado ignora rol y caducidad) con 23505. La vencida es invisible en la UI para todos y nadie la limpia; el admin queda bloqueado para ese correo hasta que un owner reinvierta (el revoke interno del owner sí pasa el USING). Fail-closed y sin ganancia de privilegio. **Cierre:** revocación de vencidas en una función `SECURITY DEFINER`, ampliar el USING a vencidas, o incluir `expires_at` en el predicado del índice (riesgo alto: RLS).

### 3.7 NV-7 — Notas sin tope y sin paginación

`createNoteSchema.content` y `updateNoteSchema.content` no tienen `.max()` (title 200 y detail 1000 sí), la columna es `text` sin CHECK, `findByWorkspace` hace select completo sin `LIMIT` y el dashboard devuelve el corpus íntegro a cada miembro en cada carga (el chat hermano tiene las tres protecciones: cuota 30/min, body ≤ 4000 y paginación). El efecto compartido (egreso de la BD a cargo del operador, latencia del resto de miembros) requiere medición; los topes desplegados (cuotas de Supabase, hosting) viven fuera del repo. **Cierre:** `.max()` en contratos, CHECK en BD, paginación y cuota — espejo de lo que el chat ya hace.

### 3.8 NV-8 — Fan-out de correo GoTrue pre-auth

`signInWithMagicLinkAction` y `signUpWithPasswordAction` reenvían el email arbitrario a GoTrue por petición sin ningún tope en el repo (el patrón P0429 de chat es post-auth y no tiene equivalente pre-auth): sin cooldown servidor (el de 60 s es solo estado de UI), captcha, cola ni límite por email/IP; el middleware deja pasar las Server Actions y el resultado de `signInWithOtp` se descarta sin registro (el operador no observa el coste). Agravante: la anon key es `NEXT_PUBLIC_` (pública por diseño), así que `/auth/v1/otp` es invocable directo y un tope solo en la acción no cerraría el camino. Impacto: coste SMTP del operador y email bombing a terceros. **Cierre:** rate limit de GoTrue en el dashboard (observación del dueño) + captcha si hace falta.

### 3.9 NV-9 — Piloto del chat solo en capa app

`HUBLY_CHAT_PILOT_WORKSPACE_IDS` es la única implementación del alcance piloto (falla cerrada si falta, y pruebe todas las superficies de la app), pero ningún objeto de la BD lo codifica: los grants de las funciones de chat a `authenticated` los exige el propio canal Drizzle de la app y habilitan chat para cualquier agencia. Bajo los esquemas expuestos por defecto (`public`, `storage`, `graphql_public`) no hay otro canal; si el proyecto hospedado expusiera `private`, un miembro de una agencia fuera del piloto podría llamar `rpc/chat_*` con su propio JWT y la anon key: abuso de feature en su propia agencia (con los límites SQL intactos), no cruce de tenant. **Cierre:** confirmar Exposed schemas en el panel; opcionalmente codificar el piloto en SQL.

### 3.10 NV-10 — `.claude/` fuera del `.gitignore` versionado

El bloque «Archivos locales de agentes» (#172) cubre `.agents/` y `apps/web/AGENTS.md` pero no `.claude/`, que contiene una contraseña de prueba en claro (`dueno@hubly.test`, documentada como válida solo en localhost) y configuración local del dueño. Hoy están ignorados solo por `.git/info/exclude:7`, regla no versionada que no se replica en clones: en un clon limpio del repo público, `git add .` los registraría; gitleaks en CI es detector posterior. La historia local está limpia (sin rastro de la cadena). **Cierre:** añadir `.claude/` al `.gitignore` versionado; buscar la cadena en GitHub y activar push protection.

### 3.11 NV-11 — Prototipo en `?error=`

`LINK_ERRORS[clave]` usa indexado directo sobre un objeto literal sin `Object.hasOwn`: claves heredadas (`constructor`, `toString`, `__proto__`) devuelven funciones u objetos que sobreviven al `?? null`, entran al estado React y se renderizan como hijo de `Alert.Title` (HeroUI pasa los children sin coerción); React lanzaría «Functions/Objects are not valid as a React child» en el re-render del cliente tras la hidratación, rompiendo `/login` para quien abra el enlace fabricado (sin `error.tsx` propio, solo el fallback raíz). Es la rec 3 de run-1, aún sin aplicar. **Cierre:** `Object.hasOwn` o Map + tests de regresión con claves de prototipo.

### 3.12 NV-12 — Log injection en Server Actions

El argumento `workspaceId` de las Server Actions llega sin esquema (los demás inputs pasan por Zod) y se interpola tal cual en `Error('No autorizado en el espacio de trabajo: ${workspaceId}')`; el mismo valor va parametrizado a la query (sin SQLi). El runtime de Next 16.4.3 instalado registra el error completo en el servidor cuando el cliente solo recibe el digest (verificado leyendo la fuente de `node_modules`, sin ejecutar): con saltos de línea un usuario autenticado fabrica líneas de log. El repo trata log injection como in-scope en el path de render (`hub/page.tsx` usa mensaje fijo citando CodeQL) pero el throw quedó sin tratar. **Cierre:** validar UUID en la acción o usar un mensaje fijo con el valor acotado.

## 4. Endurecimiento (no son hallazgos)

- Recs de run-1 abiertas: sin CSP/`X-Frame-Options`/`nosniff` globales (rec 2); `signOutAction` no limpia `hubly_ws` (rec 5); ILIKE sin escapar comodines y filtro de notas sin Zod (rec 6); predicado de storage por carpeta también en wallpapers (rec 7).
- `sameOrigin()` duplicado en `/api/chat` y `/api/chat/attachments` (extraer a utilidad compartida); los redirects del middleware derivan de `request.url` (dependen de la normalización del proxy; derivarlos de `resolveSiteUrl()` la quitaría).
- Export de chat/workspace sin paginación ni tope para el owner; sync devuelve todas las conversaciones; sin tope de canales por agencia.
- El guard de export de chat vive en capa app + query (sin función SQL); consolidarlo en SQL evitaría dependencia de una sola capa.
- `pnpm-workspace.yaml` solo deniega los scripts de build de `esbuild`: fijar política explícita para `fsevents`/`sharp`/`unrs-resolver`; imagen de CI por tag, no por digest.
- `.env.example` ausente pese a `!.env.example` en `.gitignore`; las plantillas de correo de producción se pegan a mano en el panel (drift panel↔repo) y `enlace-magico.html` usa `type=email` en vez de `type=magiclink` (verificación funcional recomendada).
- La validación de menciones no bloquea las filas de membresía (huérfanos fail-closed); la heurística `@tú` permite spoofing cosmético de mención; `normalizeDisplayName` no filtra caracteres de control no-espacio.

## 5. Revisado sin problemas

- **Aislamiento multi-tenant:** RLS `ENABLE+FORCE` en todas las tablas (incluido el esquema `private`), `anon` sin grants por defecto, `withUserContext` con claims del servidor; los repositorios siempre filtran por el workspace del ctx verificado.
- **Chat:** solo-lectura por GRANT (escrituras exclusivamente por DEFINER), locks ordenados membresía→conversación, monotonicidad de contadores respaldada por UNIQUE, idempotencia por `retry_key` sin consumir cuota, cuotas con errcode `P0429`.
- **Invitaciones:** CSPRNG de 256 bits, solo SHA-256 en BD, `token_hash` no seleccionable por grants de columna, entrega por fragmento con `Referrer-Policy: no-referrer` y limpieza del historial; aceptación con `FOR UPDATE` y single-use verificada.
- **Adjuntos:** parsers binarios que siempre avanzan (sin OOB ni bucles infinitos), PDF con prefijo obligatorio en byte 0 y barrido crudo + `#XX` decodificado, re-validación completa en commit, sin política UPDATE (sin sobrescritura), purga con el mismo derecho que el retiro.
- **CSRF/origen:** `sameOrigin()` falla cerrado (Origin ausente o `null` → rechazo) y los POST exigen JSON exacto (preflight cross-origin sin ACAO); el rechazo de run-1 se sostiene sobre la fuente reescrita.
- **CI/CD:** acciones por SHA completo, `contents: read`, `pull_request` (no `pull_request_target`), gitleaks, CodeQL `security-extended`, lockfile con `--frozen-lockfile`, sin registros alternos ni `patch:`.
- **Fail-closed generalizado:** envs de producción obligatorias (throw si faltan), flag piloto deshabilita todo si falta, sin `service_role` en la app, `seedAuthUserForTests` inalcanzable desde producción (triple capa).
- **Export:** solo elementos propios (fix `465c6d5` verificado), chat export owner-only con triple gate, markdown neutralizado por sangría, `Content-Disposition: attachment` con nombre fijo.

## 6. Verificación

- Validadores de la skill: `validate-findings.cjs` (12 registros) y `validate-coverage-ledger.cjs` (28 unidades): en verde.
- Citas del reporte contrastadas línea a línea por los verificadores de Fase 3 y 5 de la metodología, y las 8 citas centrales re-contrastadas a mano sobre el árbol de `c9ef7cc` antes de publicar.
- **Sin comprobar (por diseño de la corrida):** nada contra el proyecto real de Supabase, Storage real, GitHub hosted ni producción; nada que requiera ejecutar código del objetivo. Esos hechos son los bloqueadores de las pistas y su plan está en #275.

## 7. Lo que debes hacer en persona

1. **Validar antes de remediar** (#275): Postgres de CI local para NV-1/NV-6, `supabase start` local para NV-2/NV-4/NV-8/NV-9, Node aislado para NV-7/NV-11/NV-12.
2. **Solo lectura en producción:** consulta de miembros sin espacio personal (NV-1), panel de Auth (NV-2), Exposed schemas (NV-9), rate limits de GoTrue (NV-8), huérfanos de cuarentena (NV-5), `pg_policies` vs migraciones (NV-4).
3. **GitHub:** crear `produccion` y retirar el gate #257 (NV-3); buscar la cadena de la contraseña de prueba y activar push protection (NV-10).
4. Remediar solo después, con una rama y un PR por issue; lo que toque RLS, migraciones o CI es `riesgo:alto` y requiere APROBADO de un revisor de Claude.

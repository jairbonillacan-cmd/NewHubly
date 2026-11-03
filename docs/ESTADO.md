# Estado del Proyecto NewHubly — 3 de noviembre de 2026

Punto de control formal del estado del repositorio, monorepo, decisiones arquitectónicas, fases, PRs fusionados y PRs abiertos en revisión al 3 de noviembre de 2026.

---

## 1. Resumen Ejecutivo de la Sesión

1. **Modelo y Gobernanza (ADR 0005 y reglas de riesgo alto):**
   - Todo el equipo opera con Gemini 4 Argon High; las revisiones independientes se ejecutan en clones limpios sin el razonamiento del autor.
   - Todo PR de `riesgo:alto` (auth, RLS, migraciones, pagos, tokens, webhooks, CI, dependencias nuevas y **cualquier cambio en Server Actions, rutas de API, middleware o sesión**) requiere CI en verde, revisión independiente de Gemini y veredicto `APROBADO` de Claude lanzado por el dueño antes de fusionarse.

2. **Fase 0 y Cimientos de Fase 1A / 1B Fusionados en `main`:**
   - **Esquema DB y RLS (#23 — PR #30 y #33, `riesgo:alto`)**: Tablas `workspaces`, `workspace_members`, `notes` y `todos` con RLS activado y forzado, FK compuesta `(workspace_id, note_id)` con `ON DELETE SET NULL`, RPC `private.create_personal_workspace` (`SECURITY DEFINER`), frontera `@hubly/db/internal` y `withUserContext` certificado contra `public.ecr.aws/supabase/postgres:17.11.0.011`.
   - **Dominio, Contratos Zod y Casos de Uso (#24 y #36 — PR #29 y #37)**: Entidades puras `Note` y `Todo`, concurrencia optimista por `version`, `sortTodosForView` (`Hoy` con vencidos primero, luego prioridad y fecha; `Próximos` por fecha), validación de calendario real `isValidCalendarDate`, esquemas Zod en `@hubly/contracts` y casos de uso en `@hubly/application` con autorización por autor (`createdBy === userId`).
   - **HeroUI v3 OSS + Tailwind 4 (#32 y #35 — PR #34 y #38, `riesgo:alto`)**: ADR 0006, instalación de `@heroui/react@3.2.7`, `@heroui/styles@3.2.7`, `tailwindcss@4.3.3` y `@tailwindcss/postcss@4.3.3`, prohibición verificada de HeroUI Pro y prueba de humo de compilación PostCSS.
   - **Repositorios Drizzle y Composición (#25 — PR #39)**: `DrizzleNoteRepository`, `DrizzleTodoRepository`, `DrizzleWorkspaceRepository` y raíz de composición `apps/web/src/server/composition/index.ts`.
   - **Bloques Editoriales de Landing (#8 — PR #22 y #31, `riesgo:alto`)**: `docs/diseno/landing.md`, tokens semánticos de dirección visual, `GlassCard`, `LineGraphicCycle`, `ThemeToggle`, `PillNav`, `HeroSection` y `BentoSection` verificados a `1440x900` y `390x844` (claro y oscuro).
   - **Componentes y Flujo Inicial 1A (#26, #27 y #28 — PR #40, #41 y #42)** e **Invalidación de caché CSS en Turbo (#16 — PR #43)**: Fusionados en `main` con 55/55 pruebas en verde contra Postgres real en CI.

3. **Prioridad Activa de Cierre de Fase 1A (Issues #46 y #47):**
   - Por instrucción del dueño tras revisión de Claude en local, la Fase 1A no se declara terminada hasta cerrar el **Issue #46** (sesión verificada en servidor, login con Supabase Auth y pantalla `/hoy` conectada a la base de datos real) junto con el **Issue #47** (aplicar desde ya a la app la dirección visual elegida y los componentes completos de `@heroui/react`).

---

## 2. Historial de Commits Recientes en `main`

| Commit | Mensaje | Issue / PR |
|---|---|---|
| `a0774b7` | fix(config): invalidar caché de turbo test al cambiar archivos CSS (#16) (#43) | #16 / PR #43 |
| `fd55fca` | feat(ui): bloques compuestos para landing (Hero, Bento, PillNav) (#31) | #8 / PR #31 |
| `fae7d73` | test(fase-1a): aislamiento multi-inquilino RLS y flujo E2E con Postgres real (#28) (#42) | #28 / PR #42 |
| `6776223` | feat(web): pantalla interactiva Hoy, captura rápida, Server Actions y exportación (#27) (#41) | #27 / PR #41 |
| `2e1e9bb` | feat(ui): componentes accesibles de notas y pendientes con tokens semanticos (#26) (#40) | #26 / PR #40 |
| `1dcba41` | feat(ui,web): instalar heroui v3 oss, tailwind 4 + postcss e integrar tokens semanticos (#35) (#38) | #35 / PR #38 |
| `3512276` | feat(db,web): repositorios Drizzle con withUserContext y raíz de composición (#25) (#39) | #25 / PR #39 |
| `7d44e45` | test(db): suite de aislamiento multi-inquilino y servicio CI con Postgres (#23) (#33) | #23 / PR #33 |
| `11904d7` | feat(db): esquema inicial, migraciones SQL versionadas y helper withUserContext (#23) (#30) | #23 / PR #30 |
| `ba51562` | fix(domain,contracts,application): ordenar vistas de pendientes y validar calendario en dueDate (#36) (#37) | #36 / PR #37 |
| `f0cc3ce` | docs(adr): 0006 adopcion de heroui v3 oss para componentes base (#32) (#34) | #32 / PR #34 |
| `e45c9e3` | feat: [Fase 1A] Entidades de dominio, contratos Zod y puertos de aplicación (#24) (#29) | #24 / PR #29 |
| `d4557d2` | feat(landing): primitivas visuales base y tokens semanticos (#8) (#22) | #8 / PR #22 |

---

## 3. Pull Requests Abiertos en GitHub

| PR | Rama | Issue | Nivel de Riesgo | Alcance y Estado |
|---|---|---|---|---|
| **PR #48** | `feat/46-auth-supabase-login-espacio-personal` | #46 (Parte 1/3) | `riesgo:alto` | Inicio de sesión con Supabase Auth (`@supabase/ssr@0.12.7`, `@supabase/supabase-js@2.118.0`), cookies `httpOnly`, `getVerifiedServerSession()` con `supabase.auth.getUser()`, alta idempotente del espacio personal al primer inicio (`ensurePersonalWorkspace`) y pantalla `/login`. **10/10 checks de CI en verde**. Pendiente de revisión de Gemini y Claude. |
| **PR #49** | `feat/47-direccion-visual-heroui-app` | #47 | `riesgo:normal` | Elimina «Neutralidad en 1A» en `docs/diseno/notas-y-pendientes-1a.md`, reexporta los componentes reales de `@heroui/react` desde `@hubly/ui` y adapta `ViewSelector`, `QuickCaptureBar`, `TodoItemCard`, `NoteEditorCard` y `WorkspaceEmptyState` con la dirección visual elegida. |
| **PR #44** | `feat/11-paginas-legales-landing` | #11 | `riesgo:normal` | Páginas públicas legales `/privacidad` y `/terminos` con navegación de pie y pruebas. **10/10 checks de CI en verde**. En pausa hasta cerrar el #46. |
| **PR #45** | `feat/10-landing-page-web` | #10 | `riesgo:normal` | Página principal pública (`/`) en `apps/web/src/app/page.tsx` y pruebas. **10/10 checks de CI en verde**. En pausa hasta cerrar el #46. |

---

## 4. Próximos Pasos en Orden de Prioridad

1. **Cerrar PR #48 (`riesgo:alto`, Parte 1 del #46 — Forja):**
   - Completar revisión independiente de Gemini y revisión de Claude lanzada por el dueño, y fusionar en `main`.
2. **Abrir y revisar Parte 2 del #46 (`riesgo:alto` — Forja):**
   - Eliminar `claims`, `userId` y `db` de todos los parámetros públicos de `apps/web/src/actions/index.ts`; resolver la identidad exclusivamente desde `getVerifiedServerSession()` en el servidor y añadir la prueba negativa que demuestra que un `sub` ajeno no lee ni modifica nada.
3. **Cerrar PR #49 (Issue #47 — Lienzo):**
   - Revisar con Prisma y Tamiz y fusionar los componentes de HeroUI con la dirección visual en `packages/ui`.
4. **Abrir y revisar Parte 3 del #46 (`riesgo:alto` — Mosaico/Cimiento):**
   - Rehacer `/hoy` (`apps/web/src/app/(workspace)/hoy/page.tsx` y `WorkspaceScreen.tsx`) con la dirección visual (#47) conectada a las Server Actions reales y a Supabase local, con prueba E2E que recarga la página y comprueba que los datos persisten en Postgres. Verificación en local por el dueño antes de dar por cerrada la Fase 1A.
5. **Retomar PRs #44 (#11) y #45 (#10) de Landing.**

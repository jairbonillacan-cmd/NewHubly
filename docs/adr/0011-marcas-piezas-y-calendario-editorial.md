# 0011. Marcas, piezas y calendario editorial

Estado: Aceptado
Fecha: 2026-11-06
Issue: #189, #190

## Contexto

La Constitución establece que cada pantalla responde «¿qué sigue y quién lo tiene?», que la pieza es la columna vertebral del producto (`idea → borrador → revisión interna → aprobación del cliente → programada → publicada → medida`) con cada transición auditada, y que los datos son siempre exportables por el cliente.

### Estado actual

1. **Espacios y aislamiento ([ADR 0003](0003-multi-tenancy.md), [ADR 0004](0004-rls.md)):** `public.workspaces` modela tanto espacios personales (`kind = 'personal'`) como agencias (`kind = 'agency'`), con acceso exclusivo mediante `withUserContext` y RLS forzada.
2. **Roles y visibilidad ([ADR 0007](0007-roles-invitaciones-y-visibilidad-agencia.md)):** cuatro roles (`owner`, `admin`, `editor`, `viewer`) y visibilidad por elemento (`private` o `workspace`).
3. **Piloto por espacio ([ADR 0010](0010-chat-interno-de-agencia.md)):** activación controlada desde el servidor mediante lista blanca de UUIDs en variables de entorno, sin exponer tablas de negocio a la Data API del navegador.
4. **Incompatibilidad resuelta (sección 6 de [visión de producto](../producto/vision.md)):** evaluar si una marca debe ser un espacio separado o vivir dentro de un espacio. Crear un espacio por marca fragmentaría el calendario semanal de una agencia (obligando a cambiar de espacio para ver qué entregas chocan el mismo día) y duplicaría miembros e invitaciones. Por ello, **la marca vive dentro del espacio (`workspace_id`) como tabla ligera**, sirviendo por igual a «Tu marca» (una sola marca en espacio personal) y a «Tu agencia» (varias marcas con un calendario común filtrable).

## Decisión

### 1. Alcance funcional y activación del piloto

- Es un **calendario de contenido y campañas**: muestra piezas editoriales, no reuniones.
- Funciona **solo dentro de Hubly**: no sincroniza con Google Calendar, no publica en redes y no ofrece enlace de suscripción externa.
- Exporta en **JSON**, **Markdown** e **.ics** descargable (`/api/contenido`), y amplía «Descargar mis datos» (`exportWorkspaceData`) para incluir marcas y piezas.
- Se activa en piloto por espacio (personal o agencia) con la variable de servidor `HUBLY_CONTENT_PILOT_WORKSPACE_IDS` (UUIDs separados por comas), siguiendo el patrón de `HUBLY_CHAT_PILOT_WORKSPACE_IDS`.

### 2. Modelo de datos y RLS (`public`)

Las tres tablas viven en `public` con Drizzle (`packages/db/src/schema.ts`), `enable row level security` y `force row level security`, revocando todo permiso a `anon` y `public`:

1. **`public.brands`:**
   - Columnas: `id uuid primary key default gen_random_uuid()`, `workspace_id uuid not null references public.workspaces(id) on delete cascade`, `created_by uuid not null`, `visibility text not null default 'workspace' check (visibility in ('private', 'workspace'))`, `name text not null check (btrim(name) <> '' and char_length(name) <= 80)`, `color text not null default 'azul' check (color in ('azul', 'arena', 'verde', 'lila'))` (claves de la paleta semántica de `tokens.css`, nunca hexadecimal), `archived_at timestamptz`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`, `unique (workspace_id, id)`.
   - Gestión: `owner` y `admin` en agencia; `owner` en espacio personal.
2. **`public.content_pieces`:**
   - Contenido: `brand_id uuid` con clave foránea compuesta `(workspace_id, brand_id) references public.brands(workspace_id, id) on delete set null (brand_id)`, `title text not null check (btrim(title) <> '' and char_length(title) <= 200)`, `brief text not null default '' check (char_length(brief) <= 4000)`, `campaign text not null default '' check (char_length(campaign) <= 120)`.
   - Canal: `channel text not null default 'instagram' check (channel in ('instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube', 'blog', 'email', 'otro'))`.
   - Agenda: `planned_date date not null`, `planned_time time null` (hora local del espacio) y `assignee_id uuid null`.
   - Ciclo de vida: `status text not null default 'idea'`, `published_date date null`, `visibility text not null default 'workspace' check (visibility in ('private', 'workspace'))`, `archived_at timestamptz null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`, `unique (workspace_id, id)`.
   - Índices: `(workspace_id, planned_date)` y `(workspace_id, brand_id)`.
3. **`public.content_piece_events`:**
   - Historial inmutable de solo lectura: `id uuid primary key default gen_random_uuid()`, `workspace_id uuid not null references public.workspaces(id) on delete cascade`, `piece_id uuid not null`, `kind text not null check (kind in ('created', 'status', 'rescheduled', 'assigned'))`, `"from" text null`, `"to" text null`, `actor_id uuid not null`, `at timestamptz not null default clock_timestamp()`, con FK compuesta `(workspace_id, piece_id) references public.content_pieces(workspace_id, id) on delete cascade`.
   - Nadie tiene permiso `INSERT`, `UPDATE` ni `DELETE` sobre `content_piece_events`. Lo escriben exclusivamente triggers `security definer` con `set search_path = ''` a partir de `(select auth.uid())`.

### 3. Máquina de estados y permisos por rol

- El dominio modela el ciclo completo de la Constitución (`idea`, `borrador`, `revision`, `aprobacion_cliente`, `programada`, `aprobada`, `publicada`, `medida`), pero **en v1 solo se permiten estas transiciones**:
  - `idea ↔ borrador → revision → aprobada`
  - `aprobada → publicada` (marcada a mano con su fecha real `published_date`).
  - «Aprobación del cliente» y «programada» llegan en la Fase 3.
- Matriz de roles ([ADR 0007](0007-roles-invitaciones-y-visibilidad-agencia.md)), validada en el caso de uso y en RLS:

| Operación | `owner` / `admin` | `editor` | `viewer` |
|---|---|---|---|
| Leer marcas, piezas visibles e historial | Sí | Sí | Sí |
| Crear, editar, archivar y borrar marcas | Sí | No | No |
| Crear y editar piezas (`private` propias o `workspace`) | Sí | Sí | No |
| Borrar piezas | Sí (propias o `workspace`) | Solo propias (`created_by = auth.uid()`) | No |

### 4. Implementación por partes y riesgos de migración

1. **Riesgo de migración y aislamiento:** migración puramente aditiva (`20261114000000_content_schema.sql`) sin alterar tablas existentes. El aislamiento entre agencias y la privacidad entre miembros se verifican contra Postgres real en `rls-content.test.ts` y `rls-catalog.test.ts`.
2. **Secuencia de entregas:** (1) ADR y plan, (2) esquema SQL y RLS (`riesgo:alto`), (3) dominio, contratos Zod y servicio de aplicación, (4) repositorio Drizzle con `withUserContext`, (5) composición web, acciones y `/api/contenido`, (6) componentes visuales en `@hubly/ui` con Storybook, y (7) pantalla `/calendario` integrada con el carril y `EspacioHoy`.

## Consecuencias

- Un mismo modelo soporta espacios personales y agencias multimarca sin romper las fronteras ni debilitar el aislamiento RLS por `workspace_id`.
- Cada cambio de estado, fecha/hora o responsable queda auditado en `content_piece_events` desde la base de datos sin depender del cliente.

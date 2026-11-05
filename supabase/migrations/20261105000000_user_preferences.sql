-- Preferencias visuales por persona del espacio de Hoy (#83, propuesta B #75): fondo, opacidad, distribución, paneles y tema.
-- «Solo lo ves tú»: ni los miembros ni los dueños de una agencia leen o cambian las preferencias de otra persona.
-- Sustituye la clave temporal «hubly-espacio» de localStorage. Migración aditiva: no toca tablas existentes.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wallpaper text not null default 'contornos' check (wallpaper in ('contornos', 'patron', 'tinta', 'grafito')),
  panel_opacity integer not null default 80 check (panel_opacity between 60 and 98),
  layout_mode text not null default 'free' check (layout_mode in ('free', 'side_by_side', 'focus')),
  visible_panels jsonb not null default '["today", "open_note", "pinned_notes"]'::jsonb
    check (jsonb_typeof(visible_panels) = 'array' and visible_panels <@ '["today", "open_note", "pinned_notes"]'::jsonb),
  -- El claro es el tema predeterminado por decisión del dueño (#85); «system» queda disponible para quien lo elija.
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

revoke all on public.user_preferences from anon, public;
grant select, insert, update, delete on public.user_preferences to authenticated;

alter table public.user_preferences enable row level security, force row level security;

create policy user_preferences_select_own on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_preferences_insert_own on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_preferences_update_own on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_preferences_delete_own on public.user_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

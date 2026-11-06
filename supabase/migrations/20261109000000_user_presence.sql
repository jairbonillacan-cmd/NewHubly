-- Estado de presencia (issue 143): En línea, Ausente o No molestar, elegido por la persona.
-- Lo leen ella y quienes comparten un espacio con ella (para el chat y los avisos que vienen); solo ella lo cambia.

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'online' check (status in ('online', 'away', 'dnd')),
  updated_at timestamptz not null default now()
);

revoke all on public.user_presence from anon, public;
grant select, insert, update on public.user_presence to authenticated;

alter table public.user_presence enable row level security, force row level security;

-- ¿La persona de la sesión comparte algún espacio con otra? security definer para no depender del RLS de workspace_members.
create or replace function private.shares_workspace_with(other_user_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members me
    join public.workspace_members them on them.workspace_id = me.workspace_id
    where me.user_id = (select auth.uid()) and them.user_id = other_user_id
  );
$$;
revoke all on function private.shares_workspace_with(uuid) from public, anon;
grant execute on function private.shares_workspace_with(uuid) to authenticated;

create policy user_presence_select_own_or_teammates on public.user_presence for select to authenticated
  using (user_id = (select auth.uid()) or private.shares_workspace_with(user_id));
create policy user_presence_insert_own on public.user_presence for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_presence_update_own on public.user_presence for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

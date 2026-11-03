create schema if not exists private;
revoke usage on schema private from public, anon;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public, anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null, role text not null default 'owner',
  created_at timestamptz not null default now(), primary key (workspace_id, user_id)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null, title text not null default '', content text not null default '',
  is_pinned boolean not null default false, is_archived boolean not null default false, version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (workspace_id, id)
);
create index if not exists notes_workspace_created_archived_idx on public.notes (workspace_id, created_by, is_archived);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null, note_id uuid, title text not null, detail text not null default '', due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  is_done boolean not null default false, done_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (workspace_id, id),
  foreign key (workspace_id, note_id) references public.notes (workspace_id, id) on delete set null (note_id)
);
create index if not exists todos_workspace_created_done_due_idx on public.todos (workspace_id, created_by, is_done, due_date);

revoke all on public.workspaces, public.workspace_members, public.notes, public.todos from anon;
grant select, update on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert, update, delete on public.notes, public.todos to authenticated;

create or replace function private.is_workspace_member(lookup_workspace_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.workspace_members where workspace_id = lookup_workspace_id and user_id = (select auth.uid()));
$$;

create or replace function private.create_personal_workspace(
  workspace_name text default 'Mi Espacio', workspace_slug text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_workspace_id uuid := gen_random_uuid();
  current_user_id uuid := (select auth.uid());
  resolved_slug text;
begin
  if current_user_id is null then raise exception 'Usuario no autenticado al crear espacio personal'; end if;
  resolved_slug := coalesce(workspace_slug, 'workspace-' || substr(new_workspace_id::text, 1, 8));
  insert into public.workspaces (id, name, slug) values (new_workspace_id, coalesce(workspace_name, 'Mi Espacio'), resolved_slug);
  insert into public.workspace_members (workspace_id, user_id, role) values (new_workspace_id, current_user_id, 'owner');
  return new_workspace_id;
end;
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.create_personal_workspace(text, text) to authenticated;

alter table public.workspaces enable row level security, force row level security;
alter table public.workspace_members enable row level security, force row level security;
alter table public.notes enable row level security, force row level security;
alter table public.todos enable row level security, force row level security;

create policy workspaces_select_member on public.workspaces for select to authenticated using (private.is_workspace_member(id));
create policy workspaces_update_member on public.workspaces for update to authenticated using (private.is_workspace_member(id)) with check (private.is_workspace_member(id));
create policy workspace_members_select_member on public.workspace_members for select to authenticated using (private.is_workspace_member(workspace_id));
create policy notes_select on public.notes for select to authenticated using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));
create policy notes_insert on public.notes for insert to authenticated with check (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));
create policy notes_update on public.notes for update to authenticated using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id)) with check (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));
create policy notes_delete on public.notes for delete to authenticated using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));
create policy todos_select on public.todos for select to authenticated using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));
create policy todos_insert on public.todos for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_workspace_member(workspace_id)
  and (note_id is null or exists (select 1 from public.notes n where n.id = note_id and n.workspace_id = todos.workspace_id and n.created_by = (select auth.uid())))
);
create policy todos_update on public.todos for update to authenticated using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id)) with check (
  created_by = (select auth.uid()) and private.is_workspace_member(workspace_id)
  and (note_id is null or exists (select 1 from public.notes n where n.id = note_id and n.workspace_id = todos.workspace_id and n.created_by = (select auth.uid())))
);
create policy todos_delete on public.todos for delete to authenticated using (created_by = (select auth.uid()) and private.is_workspace_member(workspace_id));

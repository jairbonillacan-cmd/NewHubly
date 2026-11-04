-- Fase 1B (ADR 0007, Issue #62): Roles de agencia, invitaciones con token hasheado y visibilidad compartida en RLS.
-- Reversión: drop triggers trg_notes_unlink_todos_on_privatized, trg_notes_enforce_ownership_visibility,
-- trg_todos_enforce_ownership_visibility, trg_workspace_invitations_limit, trg_02_relocate_member_private_items,
-- trg_01_prevent_last_owner_loss; drop table public.workspace_invitations; drop columns visibility y kind.
alter table public.workspaces add column if not exists kind text not null default 'personal' constraint workspaces_kind_check check (kind in ('personal', 'agency'));
update public.workspace_members set role = 'editor' where role not in ('owner', 'admin', 'editor', 'viewer');
alter table public.workspace_members drop constraint if exists workspace_members_role_check, add constraint workspace_members_role_check check (role in ('owner', 'admin', 'editor', 'viewer'));

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1), role text not null check (role in ('admin', 'editor', 'viewer')),
  token_hash text not null unique check (char_length(token_hash) = 64), invited_by uuid not null,
  expires_at timestamptz not null default (now() + interval '7 days'), accepted_at timestamptz, accepted_by uuid, revoked_at timestamptz, created_at timestamptz not null default now()
);
create unique index if not exists workspace_invitations_active_email_idx on public.workspace_invitations (workspace_id, email) where accepted_at is null and revoked_at is null;
create index if not exists workspace_invitations_workspace_status_idx on public.workspace_invitations (workspace_id, accepted_at, revoked_at, expires_at);

alter table public.notes add column if not exists visibility text not null default 'private' constraint notes_visibility_check check (visibility in ('private', 'workspace'));
create index if not exists notes_workspace_visibility_archived_idx on public.notes (workspace_id, visibility, is_archived);
alter table public.todos add column if not exists visibility text not null default 'private' constraint todos_visibility_check check (visibility in ('private', 'workspace'));
create index if not exists todos_workspace_visibility_done_due_idx on public.todos (workspace_id, visibility, is_done, due_date);
alter table public.todos drop constraint if exists todos_workspace_id_note_id_fkey, drop constraint if exists todos_workspace_note_fk,
  add constraint todos_workspace_note_fk foreign key (workspace_id, note_id) references public.notes (workspace_id, id) on delete set null (note_id) deferrable initially immediate;

revoke update on public.workspaces from authenticated; grant update (name, slug, updated_at) on public.workspaces to authenticated;
revoke all on public.workspace_members from anon, authenticated; grant select, delete on public.workspace_members to authenticated; grant update (role) on public.workspace_members to authenticated;
alter table public.workspace_invitations enable row level security, force row level security;
revoke all on public.workspace_invitations from anon, authenticated;
grant select (id, workspace_id, email, role, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at) on public.workspace_invitations to authenticated;
grant insert (workspace_id, email, role, token_hash, invited_by, expires_at) on public.workspace_invitations to authenticated;
grant update (revoked_at) on public.workspace_invitations to authenticated;

create or replace function private.workspace_role(lookup_workspace_id uuid) returns text language sql security definer stable set search_path = '' as $$
  select role from public.workspace_members where workspace_id = lookup_workspace_id and user_id = (select auth.uid());
$$;

create or replace function private.create_agency_workspace(workspace_name text, workspace_slug text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ws_id uuid := gen_random_uuid(); v_uid uuid := (select auth.uid()); v_name text := btrim(coalesce(workspace_name, '')); v_slug text; v_count integer;
begin
  if v_uid is null then raise exception 'Usuario no autenticado' using errcode = '42501'; end if;
  if v_name = '' then raise exception 'El nombre de la agencia es obligatorio' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('create_agency:' || v_uid::text));
  select count(*) into v_count from public.workspace_members wm join public.workspaces w on w.id = wm.workspace_id where wm.user_id = v_uid and wm.role = 'owner' and w.kind = 'agency';
  if v_count >= 10 then raise exception 'Límite máximo de 10 agencias como propietario alcanzado' using errcode = '23514'; end if;
  v_slug := coalesce(nullif(btrim(workspace_slug), ''), 'agency-' || substr(v_ws_id::text, 1, 8));
  insert into public.workspaces (id, name, slug, kind) values (v_ws_id, v_name, v_slug, 'agency');
  insert into public.workspace_members (workspace_id, user_id, role) values (v_ws_id, v_uid, 'owner');
  return v_ws_id;
end; $$;

create or replace function private.prevent_last_owner_loss() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_kind text;
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.workspace_id <> old.workspace_id then raise exception 'No se permite cambiar user_id ni workspace_id' using errcode = '23514'; end if;
    if old.role <> 'owner' or new.role = 'owner' then return new; end if;
  end if;
  if old.role = 'owner' then
    select kind into v_kind from public.workspaces where id = old.workspace_id for update;
    if not found then return old; end if;
    perform pg_advisory_xact_lock(hashtext('workspace_owners:' || old.workspace_id::text));
    if v_kind = 'personal' or not exists (select 1 from public.workspace_members where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id) then
      raise exception 'El espacio de trabajo debe conservar al menos un propietario (owner)' using errcode = '23514';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

create or replace function private.relocate_or_cleanup_member_private_items() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_personal_ws uuid;
begin
  if not exists (select 1 from public.workspaces where id = old.workspace_id) then return old; end if;
  select w.id into v_personal_ws from public.workspaces w join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = old.user_id and wm.role = 'owner' and w.kind = 'personal' and w.id <> old.workspace_id order by w.created_at asc limit 1;
  if v_personal_ws is not null then
    set constraints public.todos_workspace_note_fk deferred;
    update public.todos t set note_id = null where t.workspace_id = old.workspace_id and t.created_by = old.user_id and t.visibility = 'private' and t.note_id is not null
      and not exists (select 1 from public.notes n where n.id = t.note_id and n.workspace_id = old.workspace_id and n.created_by = old.user_id and n.visibility = 'private');
    update public.notes set workspace_id = v_personal_ws where workspace_id = old.workspace_id and created_by = old.user_id and visibility = 'private';
    update public.todos set workspace_id = v_personal_ws where workspace_id = old.workspace_id and created_by = old.user_id and visibility = 'private';
    set constraints public.todos_workspace_note_fk immediate;
  else
    delete from public.todos where workspace_id = old.workspace_id and created_by = old.user_id and visibility = 'private';
    delete from public.notes where workspace_id = old.workspace_id and created_by = old.user_id and visibility = 'private';
  end if;
  return old;
end; $$;

create or replace function private.enforce_item_ownership_and_visibility() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.created_by <> old.created_by then raise exception 'No se permite cambiar el autor (created_by) del elemento' using errcode = '23514'; end if;
  if new.workspace_id <> old.workspace_id and not (pg_trigger_depth() > 1 and current_user not in ('authenticated', 'anon')) then
    raise exception 'No se permite mover elementos entre espacios de trabajo' using errcode = '23514';
  end if;
  if new.visibility <> old.visibility then
    if old.created_by is distinct from (select auth.uid()) then raise exception 'Solo el autor puede cambiar la visibilidad del elemento' using errcode = '42501'; end if;
    if private.workspace_role(new.workspace_id) not in ('owner', 'admin', 'editor') then raise exception 'El rol actual no permite cambiar la visibilidad' using errcode = '42501'; end if;
  end if;
  return new;
end; $$;

create or replace function private.unlink_todos_on_note_privatized() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.todos set note_id = null where workspace_id = new.workspace_id and note_id = new.id and (created_by <> new.created_by or visibility = 'workspace');
  return new;
end; $$;

create or replace function private.enforce_workspace_invitation_limit() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_kind text; v_count integer;
begin
  select kind into v_kind from public.workspaces where id = new.workspace_id for update;
  if v_kind is distinct from 'agency' then raise exception 'Solo se pueden emitir invitaciones en espacios de tipo agencia' using errcode = '23514'; end if;
  select count(*) into v_count from public.workspace_invitations where workspace_id = new.workspace_id and accepted_at is null and revoked_at is null and expires_at > now();
  if v_count >= 20 then raise exception 'Se alcanzó el límite máximo de 20 invitaciones pendientes activas por agencia' using errcode = '23514'; end if;
  return new;
end; $$;

create or replace function private.accept_workspace_invitation(raw_token text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_token text := btrim(coalesce(raw_token, '')); v_hash text; v_inv record; v_email text;
begin
  if v_uid is null then raise exception 'Usuario no autenticado' using errcode = '42501'; end if;
  if v_token = '' then raise exception 'Token de invitación requerido' using errcode = '22023'; end if;
  v_hash := encode(sha256(convert_to(v_token, 'UTF8')), 'hex');
  select i.id, i.workspace_id, i.email, i.role, i.accepted_at, i.revoked_at, i.expires_at, w.kind into v_inv
  from public.workspace_invitations i join public.workspaces w on w.id = i.workspace_id where i.token_hash = v_hash for update of i;
  if not found or v_inv.kind <> 'agency' or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'Invitación inválida, vencida o ya utilizada' using errcode = '22023';
  end if;
  select lower(btrim(u.email)) into v_email from auth.users u where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null or v_email <> v_inv.email then raise exception 'El correo verificado de tu cuenta no coincide con el correo de la invitación' using errcode = '42501'; end if;
  if exists (select 1 from public.workspace_members where workspace_id = v_inv.workspace_id and user_id = v_uid) then raise exception 'El usuario ya es miembro de esta agencia' using errcode = '23505'; end if;
  insert into public.workspace_members (workspace_id, user_id, role) values (v_inv.workspace_id, v_uid, v_inv.role);
  update public.workspace_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.workspace_id;
end; $$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_workspace_member(uuid), private.workspace_role(uuid), private.create_personal_workspace(text, text), private.create_agency_workspace(text, text), private.accept_workspace_invitation(text) to authenticated;

drop trigger if exists trg_01_prevent_last_owner_loss on public.workspace_members;
create trigger trg_01_prevent_last_owner_loss before update or delete on public.workspace_members for each row execute function private.prevent_last_owner_loss();
drop trigger if exists trg_02_relocate_member_private_items on public.workspace_members;
create trigger trg_02_relocate_member_private_items before delete on public.workspace_members for each row execute function private.relocate_or_cleanup_member_private_items();
drop trigger if exists trg_notes_enforce_ownership_visibility on public.notes;
create trigger trg_notes_enforce_ownership_visibility before update on public.notes for each row execute function private.enforce_item_ownership_and_visibility();
drop trigger if exists trg_todos_enforce_ownership_visibility on public.todos;
create trigger trg_todos_enforce_ownership_visibility before update on public.todos for each row execute function private.enforce_item_ownership_and_visibility();
drop trigger if exists trg_notes_unlink_todos_on_privatized on public.notes;
create trigger trg_notes_unlink_todos_on_privatized after update of visibility on public.notes for each row when (old.visibility = 'workspace' and new.visibility = 'private') execute function private.unlink_todos_on_note_privatized();
drop trigger if exists trg_workspace_invitations_limit on public.workspace_invitations;
create trigger trg_workspace_invitations_limit before insert on public.workspace_invitations for each row execute function private.enforce_workspace_invitation_limit();

drop policy if exists workspaces_update_member on public.workspaces;
create policy workspaces_update_member on public.workspaces for update to authenticated using (private.workspace_role(id) in ('owner', 'admin')) with check (private.workspace_role(id) in ('owner', 'admin'));
drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members for update to authenticated
  using ((private.workspace_role(workspace_id) = 'owner' and (user_id <> (select auth.uid()) or role = 'owner')) or (private.workspace_role(workspace_id) = 'admin' and user_id <> (select auth.uid()) and role in ('editor', 'viewer')))
  with check ((private.workspace_role(workspace_id) = 'owner' and role in ('owner', 'admin', 'editor', 'viewer')) or (private.workspace_role(workspace_id) = 'admin' and user_id <> (select auth.uid()) and role in ('editor', 'viewer')));
drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members for delete to authenticated
  using (user_id = (select auth.uid()) or (private.workspace_role(workspace_id) = 'owner' and user_id <> (select auth.uid())) or (private.workspace_role(workspace_id) = 'admin' and user_id <> (select auth.uid()) and role in ('editor', 'viewer')));

drop policy if exists workspace_invitations_select on public.workspace_invitations;
create policy workspace_invitations_select on public.workspace_invitations for select to authenticated using (private.workspace_role(workspace_id) in ('owner', 'admin'));
drop policy if exists workspace_invitations_insert on public.workspace_invitations;
create policy workspace_invitations_insert on public.workspace_invitations for insert to authenticated
  with check (invited_by = (select auth.uid()) and exists (select 1 from public.workspaces w where w.id = workspace_id and w.kind = 'agency') and ((private.workspace_role(workspace_id) = 'owner' and role in ('admin', 'editor', 'viewer')) or (private.workspace_role(workspace_id) = 'admin' and role in ('editor', 'viewer'))));
drop policy if exists workspace_invitations_update on public.workspace_invitations;
create policy workspace_invitations_update on public.workspace_invitations for update to authenticated
  using (accepted_at is null and (private.workspace_role(workspace_id) = 'owner' or (private.workspace_role(workspace_id) = 'admin' and role in ('editor', 'viewer'))))
  with check (revoked_at is not null and (private.workspace_role(workspace_id) = 'owner' or (private.workspace_role(workspace_id) = 'admin' and role in ('editor', 'viewer'))));

drop policy if exists notes_select on public.notes; drop policy if exists notes_insert on public.notes; drop policy if exists notes_update on public.notes; drop policy if exists notes_delete on public.notes;
create policy notes_select on public.notes for select to authenticated using (private.workspace_role(workspace_id) is not null and (visibility = 'workspace' or created_by = (select auth.uid())));
create policy notes_insert on public.notes for insert to authenticated with check (created_by = (select auth.uid()) and ((visibility = 'private' and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor'))));
create policy notes_update on public.notes for update to authenticated
  using ((created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor')))
  with check ((visibility = 'private' and created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor')));
create policy notes_delete on public.notes for delete to authenticated using ((created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin')));

drop policy if exists todos_select on public.todos; drop policy if exists todos_insert on public.todos; drop policy if exists todos_update on public.todos; drop policy if exists todos_delete on public.todos;
create policy todos_select on public.todos for select to authenticated using (private.workspace_role(workspace_id) is not null and (visibility = 'workspace' or created_by = (select auth.uid())));
create policy todos_insert on public.todos for insert to authenticated
  with check (created_by = (select auth.uid()) and ((visibility = 'private' and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor'))) and (note_id is null or exists (select 1 from public.notes n where n.id = note_id and n.workspace_id = todos.workspace_id and (n.visibility = 'workspace' or (todos.visibility = 'private' and n.created_by = (select auth.uid()))))));
create policy todos_update on public.todos for update to authenticated
  using ((created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor')))
  with check (((visibility = 'private' and created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin', 'editor'))) and (note_id is null or exists (select 1 from public.notes n where n.id = note_id and n.workspace_id = todos.workspace_id and (n.visibility = 'workspace' or (todos.visibility = 'private' and n.created_by = (select auth.uid()))))));
create policy todos_delete on public.todos for delete to authenticated using ((created_by = (select auth.uid()) and private.workspace_role(workspace_id) is not null) or (visibility = 'workspace' and private.workspace_role(workspace_id) in ('owner', 'admin')));

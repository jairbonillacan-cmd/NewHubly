-- Fase 2 / Piloto de calendario editorial (ADR 0011, Issue #191): Marcas, piezas y bitácora de eventos con RLS.
begin;

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  color text not null default 'azul' check (color in ('azul', 'arena', 'verde', 'lila')),
  visibility text not null default 'workspace' check (visibility in ('private', 'workspace')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brands_workspace_archived_idx on public.brands (workspace_id, archived_at);

create table public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 280),
  brief text not null default '' check (char_length(brief) <= 10000),
  campaign text not null default '' check (char_length(campaign) <= 120),
  channel text not null default 'instagram' check (channel in ('instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube', 'blog', 'email', 'otro')),
  planned_date date not null,
  planned_time time,
  assignee_id uuid references auth.users(id) on delete set null,
  status text not null default 'idea' check (status in ('idea', 'borrador', 'revision', 'aprobacion_cliente', 'programada', 'aprobada', 'publicada', 'medida')),
  published_date date,
  visibility text not null default 'workspace' check (visibility in ('private', 'workspace')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_pieces_workspace_planned_date_idx on public.content_pieces (workspace_id, planned_date);
create index content_pieces_workspace_brand_idx on public.content_pieces (workspace_id, brand_id);

create table public.content_piece_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  piece_id uuid not null references public.content_pieces(id) on delete cascade,
  kind text not null check (kind in ('created', 'status', 'rescheduled', 'assigned')),
  "from" text,
  "to" text,
  actor_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index content_piece_events_piece_at_idx on public.content_piece_events (piece_id, at asc);

revoke all on public.brands, public.content_pieces, public.content_piece_events from public, anon;
revoke insert, update, delete on public.content_piece_events from authenticated, anon;
grant select on public.brands, public.content_pieces, public.content_piece_events to authenticated;
grant insert, update, delete on public.brands, public.content_pieces to authenticated;

create or replace function private.has_workspace_role(lookup_workspace_id uuid, allowed_roles text[])
returns boolean language sql security definer stable set search_path = '' as $$
  select coalesce(private.workspace_role(lookup_workspace_id) = any(allowed_roles), false);
$$;

create or replace function private.can_read_workspace_item(lookup_workspace_id uuid, item_created_by uuid, item_visibility text)
returns boolean language sql security definer stable set search_path = '' as $$
  select private.workspace_role(lookup_workspace_id) is not null
    and (item_visibility = 'workspace' or item_created_by = (select auth.uid()));
$$;

create or replace function private.can_write_workspace(lookup_workspace_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select private.has_workspace_role(lookup_workspace_id, array['owner', 'admin', 'editor']);
$$;

create or replace function private.can_update_workspace_item(lookup_workspace_id uuid, item_created_by uuid, item_visibility text)
returns boolean language sql security definer stable set search_path = '' as $$
  select private.has_workspace_role(lookup_workspace_id, array['owner', 'admin', 'editor'])
    and (item_visibility = 'workspace' or item_created_by = (select auth.uid()));
$$;

create or replace function private.can_delete_workspace_item(lookup_workspace_id uuid, item_created_by uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select private.has_workspace_role(lookup_workspace_id, array['owner', 'admin'])
    or (private.has_workspace_role(lookup_workspace_id, array['editor']) and item_created_by = (select auth.uid()));
$$;

create or replace function private.enforce_brand_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
  else
    if new.id is distinct from old.id or new.workspace_id is distinct from old.workspace_id
       or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'immutable_brand_fields' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  return new;
end; $$;

create or replace function private.enforce_content_piece_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.brands b where b.id = new.brand_id and b.workspace_id = new.workspace_id) then
    raise exception 'brand_workspace_mismatch' using errcode = '23514';
  end if;
  if new.assignee_id is not null and not exists (
    select 1 from public.workspace_members wm where wm.workspace_id = new.workspace_id and wm.user_id = new.assignee_id
  ) then
    raise exception 'assignee_not_workspace_member' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('idea', 'borrador') or new.published_date is not null then
      raise exception 'invalid_content_status_transition' using errcode = '23514';
    end if;
    new.created_by := coalesce((select auth.uid()), new.created_by);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
  else
    if new.id is distinct from old.id or new.workspace_id is distinct from old.workspace_id
       or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'immutable_content_piece_fields' using errcode = '23514';
    end if;
    if new.status is distinct from old.status then
      if not (
        (old.status = 'idea' and new.status = 'borrador')
        or (old.status = 'borrador' and new.status in ('idea', 'revision'))
        or (old.status = 'revision' and new.status in ('borrador', 'aprobada'))
        or (old.status = 'aprobada' and new.status in ('revision', 'publicada'))
      ) then
        raise exception 'invalid_content_status_transition' using errcode = '23514';
      end if;
    end if;
    if new.status = 'publicada' then
      new.published_date := coalesce(new.published_date, current_date);
    else
      new.published_date := null;
    end if;
    new.updated_at := now();
  end if;
  return new;
end; $$;

create or replace function private.record_content_piece_events() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := coalesce((select auth.uid()), new.created_by);
begin
  if tg_op = 'INSERT' then
    insert into public.content_piece_events (workspace_id, piece_id, kind, "from", "to", actor_id)
    values (new.workspace_id, new.id, 'created', null, new.status, v_actor);
  else
    if old.status is distinct from new.status then
      insert into public.content_piece_events (workspace_id, piece_id, kind, "from", "to", actor_id)
      values (new.workspace_id, new.id, 'status', old.status, new.status, v_actor);
    end if;
    if old.planned_date is distinct from new.planned_date or old.planned_time is distinct from new.planned_time then
      insert into public.content_piece_events (workspace_id, piece_id, kind, "from", "to", actor_id)
      values (
        new.workspace_id, new.id, 'rescheduled',
        old.planned_date::text || coalesce(' ' || to_char(old.planned_time, 'HH24:MI'), ''),
        new.planned_date::text || coalesce(' ' || to_char(new.planned_time, 'HH24:MI'), ''),
        v_actor
      );
    end if;
    if old.assignee_id is distinct from new.assignee_id then
      insert into public.content_piece_events (workspace_id, piece_id, kind, "from", "to", actor_id)
      values (new.workspace_id, new.id, 'assigned', old.assignee_id::text, new.assignee_id::text, v_actor);
    end if;
  end if;
  return new;
end; $$;

revoke all on function
  private.has_workspace_role(uuid, text[]),
  private.can_read_workspace_item(uuid, uuid, text),
  private.can_write_workspace(uuid),
  private.can_update_workspace_item(uuid, uuid, text),
  private.can_delete_workspace_item(uuid, uuid)
from public, anon;

grant execute on function
  private.has_workspace_role(uuid, text[]),
  private.can_read_workspace_item(uuid, uuid, text),
  private.can_write_workspace(uuid),
  private.can_update_workspace_item(uuid, uuid, text),
  private.can_delete_workspace_item(uuid, uuid)
to authenticated;

revoke all on function
  private.enforce_brand_write(),
  private.enforce_content_piece_write(),
  private.record_content_piece_events()
from public, anon, authenticated;

create trigger trg_brands_enforce_write before insert or update on public.brands
  for each row execute function private.enforce_brand_write();

create trigger trg_content_pieces_enforce_write before insert or update on public.content_pieces
  for each row execute function private.enforce_content_piece_write();

create trigger trg_content_pieces_record_events after insert or update on public.content_pieces
  for each row execute function private.record_content_piece_events();

alter table public.brands enable row level security, force row level security;
alter table public.content_pieces enable row level security, force row level security;
alter table public.content_piece_events enable row level security, force row level security;

create policy brands_select on public.brands for select to authenticated
  using (private.can_read_workspace_item(workspace_id, created_by, visibility));
create policy brands_insert on public.brands for insert to authenticated
  with check (created_by = (select auth.uid()) and private.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy brands_update on public.brands for update to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (private.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy brands_delete on public.brands for delete to authenticated
  using (private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy content_pieces_select on public.content_pieces for select to authenticated
  using (private.can_read_workspace_item(workspace_id, created_by, visibility));
create policy content_pieces_insert on public.content_pieces for insert to authenticated
  with check (created_by = (select auth.uid()) and private.can_write_workspace(workspace_id));
create policy content_pieces_update on public.content_pieces for update to authenticated
  using (private.can_update_workspace_item(workspace_id, created_by, visibility))
  with check (private.can_update_workspace_item(workspace_id, created_by, visibility));
create policy content_pieces_delete on public.content_pieces for delete to authenticated
  using (private.can_delete_workspace_item(workspace_id, created_by));

create policy content_piece_events_select on public.content_piece_events for select to authenticated
  using (exists (
    select 1 from public.content_pieces p
    where p.id = content_piece_events.piece_id
      and p.workspace_id = content_piece_events.workspace_id
      and private.can_read_workspace_item(p.workspace_id, p.created_by, p.visibility)
  ));

commit;

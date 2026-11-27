-- Auditoría integral (#295): índice compuesto en workspace_members por user_id,
-- tope de longitud en public.notes.content (NV-7) y aprovisionamiento defensivo
-- de espacio personal al reubicar elementos privados de un miembro que sale (NV-1).
-- Reversión: drop index if exists public.workspace_members_user_workspace_idx;
-- alter table public.notes drop constraint if exists notes_content_max_len;
-- y restaurar la versión previa de private.relocate_or_cleanup_member_private_items().

create index if not exists workspace_members_user_workspace_idx
  on public.workspace_members (user_id, workspace_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notes_content_max_len'
      and conrelid = 'public.notes'::regclass
  ) then
    alter table public.notes
      add constraint notes_content_max_len
      check (char_length(content) <= 100000) not valid;
  end if;
end;
$$;

alter table public.notes validate constraint notes_content_max_len;

create or replace function private.relocate_or_cleanup_member_private_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_personal_ws uuid;
  v_has_private boolean;
begin
  if not exists (select 1 from public.workspaces where id = old.workspace_id) then
    return old;
  end if;

  select w.id into v_personal_ws
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = old.user_id
    and wm.role = 'owner'
    and w.kind = 'personal'
    and w.id <> old.workspace_id
  order by w.created_at asc
  limit 1;

  -- Defensa en profundidad (NV-1): si la persona aún existe en auth.users y tiene notas o pendientes
  -- privados en la agencia pero no tenía espacio personal previo, se aprovisiona uno para no perder datos.
  if v_personal_ws is null then
    select exists (
      select 1 from public.notes
      where workspace_id = old.workspace_id and created_by = old.user_id and visibility = 'private'
      union all
      select 1 from public.todos
      where workspace_id = old.workspace_id and created_by = old.user_id and visibility = 'private'
    ) into v_has_private;

    if v_has_private and exists (select 1 from auth.users where id = old.user_id) then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('personal_ws:' || old.user_id::text));
      select w.id into v_personal_ws
      from public.workspaces w
      join public.workspace_members wm on wm.workspace_id = w.id
      where wm.user_id = old.user_id
        and wm.role = 'owner'
        and w.kind = 'personal'
        and w.id <> old.workspace_id
      order by w.created_at asc
      limit 1;

      if v_personal_ws is null then
        v_personal_ws := pg_catalog.gen_random_uuid();
        insert into public.workspaces (id, name, slug, kind)
        values (v_personal_ws, 'Mi Espacio', 'workspace-' || substr(replace(v_personal_ws::text, '-', ''), 1, 12), 'personal');
        insert into public.workspace_members (workspace_id, user_id, role)
        values (v_personal_ws, old.user_id, 'owner');
      end if;
    end if;
  end if;

  if v_personal_ws is not null then
    set constraints public.todos_workspace_note_fk deferred;
    update public.todos t
    set note_id = null
    where t.workspace_id = old.workspace_id
      and t.created_by = old.user_id
      and t.visibility = 'private'
      and t.note_id is not null
      and not exists (
        select 1
        from public.notes n
        where n.id = t.note_id
          and n.workspace_id = old.workspace_id
          and n.created_by = old.user_id
          and n.visibility = 'private'
      );
    update public.notes
    set workspace_id = v_personal_ws
    where workspace_id = old.workspace_id
      and created_by = old.user_id
      and visibility = 'private';
    update public.todos
    set workspace_id = v_personal_ws
    where workspace_id = old.workspace_id
      and created_by = old.user_id
      and visibility = 'private';
    set constraints public.todos_workspace_note_fk immediate;
  else
    delete from public.todos
    where workspace_id = old.workspace_id
      and created_by = old.user_id
      and visibility = 'private';
    delete from public.notes
    where workspace_id = old.workspace_id
      and created_by = old.user_id
      and visibility = 'private';
  end if;

  return old;
end;
$$;

revoke execute on function private.relocate_or_cleanup_member_private_items() from public, anon, authenticated;

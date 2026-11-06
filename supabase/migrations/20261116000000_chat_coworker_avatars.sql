-- Avatares entre compañeros de espacio y bandera has_avatar en directorio de chat (#203, ADR 0012).
begin;

create or replace function private.shares_workspace_with(other_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members me
    join public.workspace_members them on them.workspace_id = me.workspace_id
    where me.user_id = (select auth.uid()) and them.user_id = other_user_id
  );
$$;

revoke all on function private.shares_workspace_with(uuid) from public, anon;
grant execute on function private.shares_workspace_with(uuid) to authenticated;

drop policy if exists user_avatars_select_own on storage.objects;
drop policy if exists user_avatars_select_teammates on storage.objects;

create policy user_avatars_select_own on storage.objects for select to authenticated
  using (
    bucket_id = 'user-avatars'
    and case
      when (storage.foldername(name))[1] = (select auth.uid())::text then true
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then private.shares_workspace_with(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

drop function private.chat_directory(uuid);

create function private.chat_directory(agency_id uuid)
returns table (user_id uuid, display_name text, role text, status text, has_avatar boolean)
language sql stable security definer set search_path = '' as $$
  select m.user_id,
    nullif(left(btrim(regexp_replace(
      case when jsonb_typeof(u.raw_user_meta_data -> 'display_name') = 'string'
        then u.raw_user_meta_data ->> 'display_name' else '' end,
      '[[:space:]]+', ' ', 'g'
    )), 60), ''),
    m.role,
    p.status,
    exists (
      select 1 from storage.objects o
      where o.bucket_id = 'user-avatars' and o.name = m.user_id::text || '/foto'
    )
  from public.workspace_members m
  left join auth.users u on u.id = m.user_id
  left join public.user_presence p on p.user_id = m.user_id
  where m.workspace_id = agency_id and private.chat_agency_role(agency_id) is not null
  order by m.created_at, m.user_id;
$$;

revoke all on function private.chat_directory(uuid) from public, anon;
grant execute on function private.chat_directory(uuid) to authenticated;

commit;

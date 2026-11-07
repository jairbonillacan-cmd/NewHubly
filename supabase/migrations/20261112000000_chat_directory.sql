-- Migración aditiva. El directorio comparte únicamente nombre y presencia con la agencia.
begin;

create function private.chat_directory(agency_id uuid)
returns table (user_id uuid, display_name text, role text, status text)
language sql stable security definer set search_path = '' as $$
  select m.user_id,
    nullif(left(btrim(regexp_replace(
      case when jsonb_typeof(u.raw_user_meta_data -> 'display_name') = 'string'
        then u.raw_user_meta_data ->> 'display_name' else '' end,
      '[[:space:]]+', ' ', 'g'
    )), 60), ''),
    m.role, p.status
  from public.workspace_members m
  left join auth.users u on u.id = m.user_id
  left join public.user_presence p on p.user_id = m.user_id
  where m.workspace_id = agency_id and private.chat_agency_role(agency_id) is not null
  order by m.created_at, m.user_id;
$$;

revoke all on function private.chat_directory(uuid) from public, anon;
grant execute on function private.chat_directory(uuid) to authenticated;

commit;

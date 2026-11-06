-- Migración aditiva. Cada función pública para el repositorio verifica identidad y alcance.
begin;

create function private.chat_lock_agency_role(agency_id uuid) returns text
language sql set search_path = '' as $$
  select m.role from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.workspace_id = agency_id and w.kind = 'agency' and m.user_id = (select auth.uid())
  for share of m;
$$;

create function private.chat_require_direct_writers(agency_id uuid, first_member uuid, second_member uuid)
returns void language plpgsql set search_path = '' as $$
declare eligible_count integer;
begin
  select count(*) into eligible_count from (
    select m.user_id from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.workspace_id = agency_id and w.kind = 'agency'
      and m.user_id in (first_member, second_member) and m.role in ('owner', 'admin', 'editor')
    order by m.user_id
    for share of m
  ) eligible;
  if eligible_count <> 2 then
    raise exception 'El directo no admite mensajes' using errcode = '42501';
  end if;
end;
$$;

create function private.chat_ensure_general(agency_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result_id uuid;
begin
  if private.chat_lock_agency_role(agency_id) is null then
    raise exception 'Chat fuera de la agencia' using errcode = '42501';
  end if;
  insert into private.chat_conversations (workspace_id, kind, slug) values (agency_id, 'channel', 'general')
  on conflict (workspace_id, slug) do nothing;
  select id into result_id from private.chat_conversations where workspace_id = agency_id and slug = 'general';
  return result_id;
end;
$$;

create function private.chat_open_direct(agency_id uuid, recipient_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
declare low_id uuid := least(actor_id, recipient_id);
declare high_id uuid := greatest(actor_id, recipient_id);
declare result_id uuid;
begin
  if actor_id is null or recipient_id is null or actor_id = recipient_id then
    raise exception 'Destinatario inválido' using errcode = '22023';
  end if;
  perform private.chat_require_direct_writers(agency_id, low_id, high_id);
  insert into private.chat_conversations (workspace_id, kind, member_low, member_high)
    values (agency_id, 'direct', low_id, high_id)
    on conflict (workspace_id, member_low, member_high) do nothing;
  select id into result_id from private.chat_conversations
    where workspace_id = agency_id and member_low = low_id and member_high = high_id;
  return result_id;
end;
$$;

create function private.chat_manage_channel(agency_id uuid, channel_id uuid, new_slug text, archive_channel boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result_id uuid;
begin
  if not coalesce(private.chat_lock_agency_role(agency_id) in ('owner', 'admin'), false) then
    raise exception 'No autorizado para administrar canales' using errcode = '42501';
  end if;
  if new_slug = 'general' or archive_channel is null
    or (archive_channel and (channel_id is null or new_slug is not null))
    or (not archive_channel and new_slug is null) then
    raise exception 'Operación de canal inválida' using errcode = '22023';
  end if;
  if channel_id is null then
    insert into private.chat_conversations (workspace_id, kind, slug) values (agency_id, 'channel', new_slug)
      returning id into result_id;
  else
    update private.chat_conversations
      set slug = coalesce(new_slug, slug),
          archived_at = case when archive_channel then coalesce(archived_at, clock_timestamp()) else null end
      where workspace_id = agency_id and id = channel_id and kind = 'channel' and slug <> 'general'
        and (archive_channel or archived_at is null)
      returning id into result_id;
    if not found then
      raise exception 'Canal no disponible para esta operación' using errcode = '42501';
    end if;
  end if;
  return result_id;
end;
$$;

create function private.chat_lock_writable(agency_id uuid, target_id uuid) returns private.chat_conversations
language plpgsql set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
declare conversation private.chat_conversations;
begin
  select * into conversation from private.chat_conversations
    where workspace_id = agency_id and id = target_id and archived_at is null
    for update;
  if not found or actor_id is null then
    raise exception 'Conversación no disponible' using errcode = '42501';
  end if;
  if conversation.kind = 'direct' then
    if actor_id not in (conversation.member_low, conversation.member_high) then
      raise exception 'Conversación no disponible' using errcode = '42501';
    end if;
    perform private.chat_require_direct_writers(agency_id, conversation.member_low, conversation.member_high);
  elsif not coalesce(private.chat_lock_agency_role(agency_id) in ('owner', 'admin', 'editor'), false) then
    raise exception 'No autorizado para escribir' using errcode = '42501';
  end if;
  return conversation;
end;
$$;

create function private.chat_send_message(agency_id uuid, target_id uuid, client_key uuid, message_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
declare conversation private.chat_conversations;
declare result_id uuid;
declare sent_at timestamptz;
begin
  if actor_id is null or agency_id is null then
    raise exception 'Conversación no disponible' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(agency_id::text || ':' || actor_id::text, 0));
  conversation := private.chat_lock_writable(agency_id, target_id);
  select id into result_id from private.chat_messages
    where workspace_id = agency_id and conversation_id = target_id and author_id = actor_id and retry_key = client_key;
  if found then
    return result_id;
  end if;
  sent_at := clock_timestamp();
  if (select count(*) from private.chat_messages where workspace_id = agency_id
      and author_id = actor_id and created_at > sent_at - interval '1 minute') >= 30 then
    raise exception 'Límite de envíos alcanzado' using errcode = 'P0429';
  end if;
  insert into private.chat_messages
    (workspace_id, conversation_id, author_id, retry_key, message_number, change_number, body, created_at)
    values (agency_id, target_id, actor_id, client_key, conversation.last_message_number + 1,
      conversation.last_change_number + 1, message_body, sent_at)
    returning id into result_id;
  update private.chat_conversations set last_message_number = last_message_number + 1, last_change_number = last_change_number + 1
    where workspace_id = agency_id and id = target_id;
  return result_id;
end;
$$;

create function private.chat_change_message(agency_id uuid, target_id uuid, message_id uuid, new_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
declare conversation private.chat_conversations;
begin
  conversation := private.chat_lock_writable(agency_id, target_id);
  update private.chat_messages set body = new_body, change_number = conversation.last_change_number + 1,
    edited_at = case when new_body is not null then clock_timestamp() else edited_at end,
    deleted_at = case when new_body is null then clock_timestamp() else null end
    where workspace_id = agency_id and conversation_id = target_id and id = message_id
      and author_id = actor_id and deleted_at is null;
  if not found then
    raise exception 'Mensaje no disponible para esta operación' using errcode = '42501';
  end if;
  update private.chat_conversations set last_change_number = last_change_number + 1
    where workspace_id = agency_id and id = target_id;
end;
$$;

create function private.chat_mark_read(agency_id uuid, target_id uuid, visible_message integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
declare actor_role text := private.chat_lock_agency_role(agency_id);
declare conversation private.chat_conversations;
declare result_number integer;
begin
  select * into conversation from private.chat_conversations where workspace_id = agency_id and id = target_id;
  if not found or actor_role is null or (conversation.kind = 'direct'
      and (actor_role = 'viewer' or actor_id not in (conversation.member_low, conversation.member_high))) then
    raise exception 'Conversación no disponible' using errcode = '42501';
  end if;
  if not exists (select 1 from private.chat_messages
      where workspace_id = agency_id and conversation_id = target_id and message_number = visible_message) then
    raise exception 'Cursor de lectura inválido' using errcode = '22023';
  end if;
  insert into private.chat_reads (workspace_id, conversation_id, user_id, message_number)
    values (agency_id, target_id, actor_id, visible_message)
    on conflict (workspace_id, conversation_id, user_id) do update
      set message_number = greatest(chat_reads.message_number, excluded.message_number)
    returning message_number into result_number;
  return result_number;
end;
$$;

revoke all on function private.chat_lock_agency_role(uuid), private.chat_require_direct_writers(uuid, uuid, uuid),
  private.chat_lock_writable(uuid, uuid) from public, anon, authenticated;
revoke all on function private.chat_ensure_general(uuid), private.chat_open_direct(uuid, uuid),
  private.chat_manage_channel(uuid, uuid, text, boolean), private.chat_send_message(uuid, uuid, uuid, text),
  private.chat_change_message(uuid, uuid, uuid, text), private.chat_mark_read(uuid, uuid, integer) from public, anon;
grant execute on function private.chat_ensure_general(uuid), private.chat_open_direct(uuid, uuid),
  private.chat_manage_channel(uuid, uuid, text, boolean), private.chat_send_message(uuid, uuid, uuid, text),
  private.chat_change_message(uuid, uuid, uuid, text), private.chat_mark_read(uuid, uuid, integer) to authenticated;

commit;

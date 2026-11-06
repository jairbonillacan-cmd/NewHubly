-- Endurece las escrituras del chat (#178). Migración aditiva: solo reemplaza funciones existentes.
begin;

-- La pertenencia a la agencia se comprueba y bloquea antes de tocar la conversación:
-- alguien ajeno ya no puede bloquear la fila ni distinguir si existe, y el orden de bloqueos
-- (membresía → conversación) coincide con el de chat_manage_channel.
create or replace function private.chat_lock_writable(agency_id uuid, target_id uuid) returns private.chat_conversations
language plpgsql set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
declare actor_role text;
declare conversation private.chat_conversations;
begin
  actor_role := private.chat_lock_agency_role(agency_id);
  if actor_id is null or actor_role is null then
    raise exception 'Conversación no disponible' using errcode = '42501';
  end if;
  select * into conversation from private.chat_conversations
    where workspace_id = agency_id and id = target_id and archived_at is null
    for update;
  if not found
      or (conversation.kind = 'direct' and actor_id not in (conversation.member_low, conversation.member_high))
      or (conversation.kind = 'channel' and actor_role not in ('owner', 'admin', 'editor')) then
    raise exception 'Conversación no disponible' using errcode = '42501';
  end if;
  if conversation.kind = 'direct' then
    perform private.chat_require_direct_writers(agency_id, conversation.member_low, conversation.member_high);
  end if;
  return conversation;
end;
$$;

-- Un mismo mensaje no puede editarse más de una vez cada 2 segundos: evita ráfagas que inflan
-- last_change_number y hacen trabajar de más a la sincronización. Retirar no tiene espera.
create or replace function private.chat_change_message(agency_id uuid, target_id uuid, message_id uuid, new_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
declare conversation private.chat_conversations;
begin
  conversation := private.chat_lock_writable(agency_id, target_id);
  if new_body is not null and exists (select 1 from private.chat_messages
      where workspace_id = agency_id and conversation_id = target_id and id = message_id
        and author_id = actor_id and deleted_at is null and edited_at > clock_timestamp() - interval '2 seconds') then
    raise exception 'Espera un momento antes de volver a editar' using errcode = 'P0429';
  end if;
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

revoke all on function private.chat_lock_writable(uuid, uuid) from public, anon, authenticated;
revoke all on function private.chat_change_message(uuid, uuid, uuid, text) from public, anon;
grant execute on function private.chat_change_message(uuid, uuid, uuid, text) to authenticated;

comment on function private.chat_send_message(uuid, uuid, uuid, text) is
  'Envía un mensaje. Es idempotente por (agencia, conversación, autor, client_key): un reintento con la misma clave devuelve el id del mensaje original aunque el texto haya cambiado.';

commit;

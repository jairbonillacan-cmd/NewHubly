-- Migración aditiva (#200, ADR 0012): respuestas en línea, hilos, reacciones, menciones y estado escribiendo.
begin;

alter table private.chat_conversations add column quotas jsonb not null default '{}'::jsonb;

alter table private.chat_messages
  add column reply_to_id uuid,
  add column thread_root_id uuid,
  add column thread_reply_count integer not null default 0 check (thread_reply_count >= 0),
  add column thread_last_reply_at timestamptz,
  add constraint chat_messages_reply_to_fk foreign key (workspace_id, conversation_id, reply_to_id)
    references private.chat_messages(workspace_id, conversation_id, id),
  add constraint chat_messages_thread_root_fk foreign key (workspace_id, conversation_id, thread_root_id)
    references private.chat_messages(workspace_id, conversation_id, id),
  add constraint chat_messages_thread_check check (
    reply_to_id is distinct from id and thread_root_id is distinct from id
    and (thread_root_id is null or (thread_reply_count = 0 and thread_last_reply_at is null))
  );
create index chat_messages_thread_idx
  on private.chat_messages(workspace_id, conversation_id, thread_root_id, message_number) where thread_root_id is not null;

create table private.chat_reactions (
  workspace_id uuid not null, conversation_id uuid not null, message_id uuid not null, user_id uuid not null,
  emoji text not null check (
    octet_length(emoji) <= 16
    and emoji ~ '^([\U0001F1E6-\U0001F1FF]{2}|([\u203C\u2049\u2122\u2139\u2194-\u21AA\u2300-\u27BF\u2934-\u2935\u2B05-\u2B55\u3030\u303D\u3297\u3299\U0001F000-\U0001F1E5\U0001F200-\U0001F3FA\U0001F400-\U0001FAFF]\uFE0F?[\U0001F3FB-\U0001F3FF]?\uFE0F?)(\u200D[\u203C\u2049\u2122\u2139\u2194-\u21AA\u2300-\u27BF\u2934-\u2935\u2B05-\u2B55\u3030\u303D\u3297\u3299\U0001F000-\U0001F1E5\U0001F200-\U0001F3FA\U0001F400-\U0001FAFF]\uFE0F?[\U0001F3FB-\U0001F3FF]?\uFE0F?)*)$'
  ),
  created_at timestamptz not null default now(),
  primary key (workspace_id, conversation_id, message_id, user_id, emoji),
  unique (message_id, user_id, emoji),
  foreign key (workspace_id, conversation_id, message_id)
    references private.chat_messages(workspace_id, conversation_id, id) on delete cascade
);

create table private.chat_mentions (
  workspace_id uuid not null, conversation_id uuid not null, message_id uuid not null, mentioned_user_id uuid not null,
  created_at timestamptz not null default now(), read_at timestamptz,
  primary key (workspace_id, conversation_id, message_id, mentioned_user_id),
  foreign key (workspace_id, conversation_id, message_id)
    references private.chat_messages(workspace_id, conversation_id, id) on delete cascade
);
create index chat_mentions_unread_idx
  on private.chat_mentions(workspace_id, mentioned_user_id, conversation_id) where read_at is null;

create table private.chat_typing (
  workspace_id uuid not null, conversation_id uuid not null, user_id uuid not null,
  updated_at timestamptz not null default now(), expires_at timestamptz not null,
  primary key (workspace_id, conversation_id, user_id),
  foreign key (workspace_id, conversation_id) references private.chat_conversations(workspace_id, id) on delete cascade,
  check (expires_at > updated_at)
);

revoke all on private.chat_reactions, private.chat_mentions, private.chat_typing from public, anon, authenticated;
grant select on private.chat_reactions, private.chat_mentions, private.chat_typing to authenticated;
alter table private.chat_reactions enable row level security, force row level security;
alter table private.chat_mentions enable row level security, force row level security;
alter table private.chat_typing enable row level security, force row level security;

create policy chat_reactions_read on private.chat_reactions for select to authenticated
  using (exists (select 1 from private.chat_conversations c
    where c.workspace_id = chat_reactions.workspace_id and c.id = chat_reactions.conversation_id));
create policy chat_mentions_read on private.chat_mentions for select to authenticated
  using (exists (select 1 from private.chat_conversations c
    where c.workspace_id = chat_mentions.workspace_id and c.id = chat_mentions.conversation_id));
create policy chat_typing_read on private.chat_typing for select to authenticated
  using (exists (select 1 from private.chat_conversations c
    where c.workspace_id = chat_typing.workspace_id and c.id = chat_typing.conversation_id));

drop function private.chat_send_message(uuid, uuid, uuid, text);
create function private.chat_send_message(
  agency_id uuid, target_id uuid, client_key uuid, message_body text,
  reply_to uuid default null, thread_root uuid default null, mentioned_users uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); conversation private.chat_conversations;
declare result_id uuid; sent_at timestamptz; next_change integer; mentioned_ids uuid[];
begin
  if actor_id is null or agency_id is null then raise exception 'Conversación no disponible' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(agency_id::text || ':' || actor_id::text, 0));
  conversation := private.chat_lock_writable(agency_id, target_id);
  select id into result_id from private.chat_messages
    where workspace_id = agency_id and conversation_id = target_id and author_id = actor_id and retry_key = client_key;
  if found then return result_id; end if;
  sent_at := clock_timestamp();
  if (select count(*) from private.chat_messages where workspace_id = agency_id
      and author_id = actor_id and created_at > sent_at - interval '1 minute') >= 30 then
    raise exception 'Límite de envíos alcanzado' using errcode = 'P0429';
  end if;
  if reply_to is not null and not exists (select 1 from private.chat_messages
      where workspace_id = agency_id and conversation_id = target_id and id = reply_to) then
    raise exception 'Mensaje citado inválido' using errcode = '22023';
  end if;
  if thread_root is not null and not exists (select 1 from private.chat_messages
      where workspace_id = agency_id and conversation_id = target_id and id = thread_root and thread_root_id is null) then
    raise exception 'Raíz de hilo inválida' using errcode = '22023';
  end if;
  if array_position(mentioned_users, null) is not null then raise exception 'Mención inválida' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct u), '{}') into mentioned_ids from unnest(coalesce(mentioned_users, '{}')) as u;
  if cardinality(mentioned_ids) > 0 and (
    select count(*) from unnest(mentioned_ids) as u
    join public.workspace_members m on m.workspace_id = agency_id and m.user_id = u
    where conversation.kind = 'channel' or u in (conversation.member_low, conversation.member_high)
  ) <> cardinality(mentioned_ids) then
    raise exception 'Mención fuera de la conversación' using errcode = '22023';
  end if;
  if thread_root is not null then
    update private.chat_messages set thread_reply_count = thread_reply_count + 1,
      thread_last_reply_at = sent_at, change_number = conversation.last_change_number + 1
      where workspace_id = agency_id and conversation_id = target_id and id = thread_root;
    next_change := conversation.last_change_number + 2;
  else
    next_change := conversation.last_change_number + 1;
  end if;
  insert into private.chat_messages
    (workspace_id, conversation_id, author_id, retry_key, message_number, change_number, body, reply_to_id, thread_root_id, created_at)
    values (agency_id, target_id, actor_id, client_key, conversation.last_message_number + 1,
      next_change, message_body, reply_to, thread_root, sent_at)
    returning id into result_id;
  if cardinality(mentioned_ids) > 0 then
    insert into private.chat_mentions (workspace_id, conversation_id, message_id, mentioned_user_id, created_at)
      select agency_id, target_id, result_id, u, sent_at from unnest(mentioned_ids) as u;
  end if;
  update private.chat_conversations set last_message_number = last_message_number + 1, last_change_number = next_change
    where workspace_id = agency_id and id = target_id;
  return result_id;
end; $$;

create or replace function private.chat_change_message(agency_id uuid, target_id uuid, message_id uuid, new_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); conversation private.chat_conversations;
declare parent_thread_id uuid; next_change integer;
begin
  conversation := private.chat_lock_writable(agency_id, target_id);
  if new_body is not null and exists (select 1 from private.chat_messages
      where workspace_id = agency_id and conversation_id = target_id and id = message_id
        and author_id = actor_id and deleted_at is null and edited_at > clock_timestamp() - interval '2 seconds') then
    raise exception 'Espera un momento antes de volver a editar' using errcode = 'P0429';
  end if;
  next_change := conversation.last_change_number + 1;
  update private.chat_messages set body = new_body, change_number = next_change,
    edited_at = case when new_body is not null then clock_timestamp() else edited_at end,
    deleted_at = case when new_body is null then clock_timestamp() else null end
    where workspace_id = agency_id and conversation_id = target_id and id = message_id
      and author_id = actor_id and deleted_at is null
    returning thread_root_id into parent_thread_id;
  if not found then raise exception 'Mensaje no disponible para esta operación' using errcode = '42501'; end if;
  if new_body is null then
    delete from private.chat_reactions r where r.workspace_id = agency_id and r.conversation_id = target_id and r.message_id = chat_change_message.message_id;
    delete from private.chat_mentions m where m.workspace_id = agency_id and m.conversation_id = target_id and m.message_id = chat_change_message.message_id;
    if parent_thread_id is not null then
      next_change := next_change + 1;
      update private.chat_messages set thread_reply_count = greatest(thread_reply_count - 1, 0),
        thread_last_reply_at = (select max(created_at) from private.chat_messages
          where workspace_id = agency_id and conversation_id = target_id and thread_root_id = parent_thread_id and deleted_at is null),
        change_number = next_change
        where workspace_id = agency_id and conversation_id = target_id and id = parent_thread_id;
    end if;
  end if;
  update private.chat_conversations set last_change_number = next_change where workspace_id = agency_id and id = target_id;
end; $$;

create function private.chat_toggle_reaction(agency_id uuid, target_id uuid, target_message_id uuid, reaction_emoji text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); conversation private.chat_conversations;
declare now_ts timestamptz := clock_timestamp(); quota_key text;
declare quota_bucket text := (extract(epoch from now_ts)::bigint / 60)::text; added boolean;
begin
  if actor_id is null or agency_id is null then raise exception 'Conversación no disponible' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(agency_id::text || ':react:' || actor_id::text, 0));
  conversation := private.chat_lock_writable(agency_id, target_id);
  if reaction_emoji is null then raise exception 'Emoji inválido' using errcode = '22023'; end if;
  quota_key := 'r:' || actor_id::text;
  if (select coalesce(sum(case when c.quotas -> quota_key ->> 'b' = quota_bucket then (c.quotas -> quota_key ->> 'n')::int else 0 end), 0)
      from private.chat_conversations c where c.workspace_id = agency_id) >= 60 then
    raise exception 'Límite de reacciones alcanzado' using errcode = 'P0429';
  end if;
  update private.chat_messages set change_number = conversation.last_change_number + 1
    where workspace_id = agency_id and conversation_id = target_id and id = target_message_id and deleted_at is null;
  if not found then raise exception 'Mensaje no disponible para esta operación' using errcode = '42501'; end if;
  delete from private.chat_reactions where workspace_id = agency_id and conversation_id = target_id
    and message_id = target_message_id and user_id = actor_id and emoji = reaction_emoji;
  if found then
    added := false;
  else
    begin
      insert into private.chat_reactions (workspace_id, conversation_id, message_id, user_id, emoji, created_at)
        values (agency_id, target_id, target_message_id, actor_id, reaction_emoji, now_ts);
    exception when check_violation then raise exception 'Emoji inválido' using errcode = '22023'; end;
    added := true;
  end if;
  update private.chat_conversations set last_change_number = last_change_number + 1,
    quotas = jsonb_set(quotas, array[quota_key], jsonb_build_object('b', quota_bucket, 'n',
      case when quotas -> quota_key ->> 'b' = quota_bucket then (quotas -> quota_key ->> 'n')::int + 1 else 1 end))
    where workspace_id = agency_id and id = target_id;
  return added;
end; $$;

create function private.chat_set_typing(agency_id uuid, target_id uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); now_ts timestamptz; result_expires timestamptz;
begin
  if actor_id is null or agency_id is null then raise exception 'Conversación no disponible' using errcode = '42501'; end if;
  perform private.chat_lock_writable(agency_id, target_id);
  now_ts := clock_timestamp();
  if exists (select 1 from private.chat_typing where workspace_id = agency_id and conversation_id = target_id
      and user_id = actor_id and updated_at > now_ts - interval '3 seconds') then
    raise exception 'Espera antes de actualizar el estado de escritura' using errcode = 'P0429';
  end if;
  insert into private.chat_typing (workspace_id, conversation_id, user_id, updated_at, expires_at)
    values (agency_id, target_id, actor_id, now_ts, now_ts + interval '6 seconds')
    on conflict (workspace_id, conversation_id, user_id) do update
      set updated_at = excluded.updated_at, expires_at = excluded.expires_at
    returning expires_at into result_expires;
  return result_expires;
end; $$;

create function private.chat_mark_mentions_read(agency_id uuid, target_id uuid, up_to_message_number integer default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); actor_role text; conversation private.chat_conversations;
declare now_ts timestamptz := clock_timestamp(); quota_key text;
declare quota_bucket text := (extract(epoch from now_ts)::bigint / 60)::text; updated_count integer;
begin
  if actor_id is null or agency_id is null then raise exception 'Conversación no disponible' using errcode = '42501'; end if;
  actor_role := private.chat_lock_agency_role(agency_id);
  if actor_role is null then raise exception 'Conversación no disponible' using errcode = '42501'; end if;
  select * into conversation from private.chat_conversations where workspace_id = agency_id and id = target_id;
  if not found or (conversation.kind = 'direct'
      and (actor_role = 'viewer' or actor_id not in (conversation.member_low, conversation.member_high))) then
    raise exception 'Conversación no disponible' using errcode = '42501';
  end if;
  if up_to_message_number is not null and up_to_message_number <= 0 then
    raise exception 'Cursor de lectura inválido' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(agency_id::text || ':mentions:' || actor_id::text, 0));
  quota_key := 'm:' || actor_id::text;
  if (select coalesce(sum(case when c.quotas -> quota_key ->> 'b' = quota_bucket then (c.quotas -> quota_key ->> 'n')::int else 0 end), 0)
      from private.chat_conversations c where c.workspace_id = agency_id) >= 60 then
    raise exception 'Límite de lecturas de menciones alcanzado' using errcode = 'P0429';
  end if;
  update private.chat_conversations set quotas = jsonb_set(quotas, array[quota_key], jsonb_build_object('b', quota_bucket, 'n',
      case when quotas -> quota_key ->> 'b' = quota_bucket then (quotas -> quota_key ->> 'n')::int + 1 else 1 end))
    where workspace_id = agency_id and id = target_id;
  update private.chat_mentions m set read_at = now_ts from private.chat_messages msg
    where m.workspace_id = agency_id and m.conversation_id = target_id and m.mentioned_user_id = actor_id and m.read_at is null
      and msg.workspace_id = m.workspace_id and msg.conversation_id = m.conversation_id and msg.id = m.message_id
      and msg.deleted_at is null and (up_to_message_number is null or msg.message_number <= up_to_message_number);
  get diagnostics updated_count = row_count;
  return updated_count;
end; $$;

revoke all on function
  private.chat_send_message(uuid, uuid, uuid, text, uuid, uuid, uuid[]), private.chat_change_message(uuid, uuid, uuid, text),
  private.chat_toggle_reaction(uuid, uuid, uuid, text), private.chat_set_typing(uuid, uuid),
  private.chat_mark_mentions_read(uuid, uuid, integer) from public, anon;
grant execute on function
  private.chat_send_message(uuid, uuid, uuid, text, uuid, uuid, uuid[]), private.chat_change_message(uuid, uuid, uuid, text),
  private.chat_toggle_reaction(uuid, uuid, uuid, text), private.chat_set_typing(uuid, uuid),
  private.chat_mark_mentions_read(uuid, uuid, integer) to authenticated;

comment on function private.chat_send_message(uuid, uuid, uuid, text, uuid, uuid, uuid[]) is
  'Envía un mensaje con cita, hilo y menciones opcionales. Es idempotente por (agencia, conversación, autor, client_key).';

commit;

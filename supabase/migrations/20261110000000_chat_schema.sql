-- Migración aditiva. Las mutaciones se exponen mediante operaciones controladas en la entrega siguiente.
begin;

create table private.chat_conversations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  kind text not null check (kind in ('channel', 'direct')),
  slug text check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 48),
  member_low uuid,
  member_high uuid,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  last_message_number integer not null default 0 check (last_message_number >= 0),
  last_change_number integer not null default 0 check (last_change_number >= last_message_number),
  primary key (workspace_id, id),
  unique (workspace_id, slug),
  unique (workspace_id, member_low, member_high),
  check (
    (kind = 'channel' and slug is not null and member_low is null and member_high is null
      and (slug <> 'general' or archived_at is null))
    or
    (kind = 'direct' and slug is null and archived_at is null
      and member_low is not null and member_high is not null and member_low < member_high)
  )
);

create table private.chat_messages (
  workspace_id uuid not null,
  conversation_id uuid not null,
  id uuid not null default gen_random_uuid(),
  author_id uuid not null,
  retry_key uuid not null,
  message_number integer not null check (message_number > 0),
  change_number integer not null check (change_number >= message_number),
  body text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  primary key (workspace_id, conversation_id, id),
  foreign key (workspace_id, conversation_id) references private.chat_conversations(workspace_id, id) on delete cascade,
  unique (workspace_id, conversation_id, author_id, retry_key),
  unique (workspace_id, conversation_id, message_number),
  unique (workspace_id, conversation_id, change_number),
  check (
    (deleted_at is null and body is not null and char_length(body) <= 4000 and body ~ '[^[:space:]]')
    or (deleted_at is not null and body is null)
  )
);
create index chat_messages_author_created_idx on private.chat_messages(workspace_id, author_id, created_at);

create table private.chat_reads (
  workspace_id uuid not null,
  conversation_id uuid not null,
  user_id uuid not null,
  message_number integer not null,
  primary key (workspace_id, conversation_id, user_id),
  foreign key (workspace_id, conversation_id, message_number)
    references private.chat_messages(workspace_id, conversation_id, message_number) on delete cascade
);

create function private.chat_agency_role(agency_id uuid) returns text
language sql stable set search_path = '' as $$
  select private.workspace_role(agency_id)
  where exists (select 1 from public.workspaces where id = agency_id and kind = 'agency');
$$;

revoke all on function private.chat_agency_role(uuid) from public, anon;
grant execute on function private.chat_agency_role(uuid) to authenticated;
revoke all on private.chat_conversations, private.chat_messages, private.chat_reads from public, anon, authenticated;
grant select on private.chat_conversations, private.chat_messages, private.chat_reads to authenticated;

alter table private.chat_conversations enable row level security, force row level security;
alter table private.chat_messages enable row level security, force row level security;
alter table private.chat_reads enable row level security, force row level security;

create policy chat_conversations_read on private.chat_conversations for select to authenticated
  using (
    (kind = 'channel' and private.chat_agency_role(workspace_id) is not null)
    or
    (kind = 'direct' and private.chat_agency_role(workspace_id) in ('owner', 'admin', 'editor')
      and (select auth.uid()) in (member_low, member_high))
  );

create policy chat_messages_read on private.chat_messages for select to authenticated
  using (exists (
    select 1 from private.chat_conversations c
    where c.workspace_id = chat_messages.workspace_id and c.id = chat_messages.conversation_id
  ));

create policy chat_reads_read on private.chat_reads for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from private.chat_conversations c
    where c.workspace_id = chat_reads.workspace_id and c.id = chat_reads.conversation_id
  ));

commit;

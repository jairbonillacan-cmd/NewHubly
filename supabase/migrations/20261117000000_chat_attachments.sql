-- Adjuntos del chat en bucket privado con aislamiento por conversación y retiro inmediato (#205, ADR 0012).
-- Reversión: drop policy if exists chat_attachments_select_member, chat_attachments_insert_writer on storage.objects; drop function if exists private.chat_register_attachment(uuid,uuid,uuid,uuid,text,text,integer,integer,integer), private.chat_can_read_attachment_object(text), private.chat_can_upload_attachment_object(text); drop table if exists private.chat_attachments; delete from storage.buckets where id = 'chat-attachments';
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table private.chat_attachments (
  workspace_id uuid not null, conversation_id uuid not null, message_id uuid not null,
  id uuid not null default gen_random_uuid(), object_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 255 and file_name ~ '[^[:space:]]'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  width integer check (width is null or width > 0), height integer check (height is null or height > 0),
  created_at timestamptz not null default now(),
  primary key (workspace_id, conversation_id, message_id, id), unique (object_path),
  foreign key (workspace_id, conversation_id, message_id) references private.chat_messages(workspace_id, conversation_id, id) on delete cascade,
  check (object_path = workspace_id::text || '/' || conversation_id::text || '/' || id::text)
);
revoke all on private.chat_attachments from public, anon, authenticated;
grant select on private.chat_attachments to authenticated;
alter table private.chat_attachments enable row level security, force row level security;

create policy chat_attachments_read on private.chat_attachments for select to authenticated using (
  exists (select 1 from private.chat_conversations c where c.workspace_id = chat_attachments.workspace_id and c.id = chat_attachments.conversation_id)
  and exists (select 1 from private.chat_messages m where m.workspace_id = chat_attachments.workspace_id
    and m.conversation_id = chat_attachments.conversation_id and m.id = chat_attachments.message_id and m.deleted_at is null)
);

create or replace function private.chat_can_read_attachment_object(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); declare ws_id uuid; declare conv_id uuid; declare att_id uuid; declare role_name text;
begin
  if actor_id is null or object_name is null or object_name !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
  ws_id := split_part(object_name, '/', 1)::uuid; conv_id := split_part(object_name, '/', 2)::uuid; att_id := split_part(object_name, '/', 3)::uuid;
  role_name := private.chat_agency_role(ws_id); if role_name is null then return false; end if;
  return exists (
    select 1 from private.chat_attachments a
    join private.chat_conversations c on c.workspace_id = a.workspace_id and c.id = a.conversation_id
    join private.chat_messages m on m.workspace_id = a.workspace_id and m.conversation_id = a.conversation_id and m.id = a.message_id
    where a.workspace_id = ws_id and a.conversation_id = conv_id and a.id = att_id and a.object_path = object_name and m.deleted_at is null
      and (c.kind = 'channel' or (c.kind = 'direct' and role_name in ('owner', 'admin', 'editor') and actor_id in (c.member_low, c.member_high)))
  );
end; $$;

create or replace function private.chat_can_upload_attachment_object(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); declare ws_id uuid; declare conv_id uuid; declare role_name text;
begin
  if actor_id is null or object_name is null or object_name !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
  ws_id := split_part(object_name, '/', 1)::uuid; conv_id := split_part(object_name, '/', 2)::uuid;
  role_name := private.chat_agency_role(ws_id); if role_name is null or role_name not in ('owner', 'admin', 'editor') then return false; end if;
  return exists (
    select 1 from private.chat_conversations c where c.workspace_id = ws_id and c.id = conv_id and c.archived_at is null
      and (c.kind = 'channel' or (c.kind = 'direct' and actor_id in (c.member_low, c.member_high)
        and (select count(*) from public.workspace_members wm where wm.workspace_id = ws_id and wm.user_id in (c.member_low, c.member_high) and wm.role in ('owner', 'admin', 'editor')) = 2))
  );
end; $$;

create or replace function private.chat_register_attachment(
  agency_id uuid, target_id uuid, target_message_id uuid, attachment_id uuid,
  original_name text, content_type text, size_bytes integer, img_width integer default null, img_height integer default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); declare conversation private.chat_conversations;
begin
  conversation := private.chat_lock_writable(agency_id, target_id);
  if attachment_id is null or target_message_id is null then raise exception 'Adjunto inválido' using errcode = '22023'; end if;
  perform 1 from private.chat_messages where workspace_id = agency_id and conversation_id = target_id and id = target_message_id and author_id = actor_id and deleted_at is null for update;
  if not found then raise exception 'Mensaje no disponible para adjuntar archivos' using errcode = '42501'; end if;
  if (select count(*) from private.chat_attachments where workspace_id = agency_id and conversation_id = target_id and message_id = target_message_id) >= 5 then
    raise exception 'Máximo 5 adjuntos por mensaje' using errcode = '22023';
  end if;
  insert into private.chat_attachments (workspace_id, conversation_id, message_id, id, object_path, file_name, mime_type, byte_size, width, height)
    values (agency_id, target_id, target_message_id, attachment_id, agency_id::text || '/' || target_id::text || '/' || attachment_id::text, original_name, content_type, size_bytes, img_width, img_height);
  update private.chat_messages set change_number = conversation.last_change_number + 1 where workspace_id = agency_id and conversation_id = target_id and id = target_message_id;
  update private.chat_conversations set last_change_number = last_change_number + 1 where workspace_id = agency_id and id = target_id;
  return attachment_id;
end; $$;

drop policy if exists chat_attachments_select_member on storage.objects;
create policy chat_attachments_select_member on storage.objects for select to authenticated using (bucket_id = 'chat-attachments' and private.chat_can_read_attachment_object(name));
drop policy if exists chat_attachments_insert_writer on storage.objects;
create policy chat_attachments_insert_writer on storage.objects for insert to authenticated with check (bucket_id = 'chat-attachments' and private.chat_can_upload_attachment_object(name));
revoke all on function private.chat_can_read_attachment_object(text), private.chat_can_upload_attachment_object(text), private.chat_register_attachment(uuid, uuid, uuid, uuid, text, text, integer, integer, integer) from public, anon;
grant execute on function private.chat_can_read_attachment_object(text), private.chat_can_upload_attachment_object(text), private.chat_register_attachment(uuid, uuid, uuid, uuid, text, text, integer, integer, integer) to authenticated;
commit;

-- Adjuntos del chat en bucket privado con cuarentena, reserva anti-huérfanos y retiro inmediato (#205, ADR 0012).
-- Reversión: drop trigger if exists chat_messages_purge_attachments_on_delete on private.chat_messages; drop policy if exists chat_attachments_select_member, chat_attachments_insert_writer, chat_attachments_delete_author on storage.objects; drop function if exists private.chat_purge_deleted_message_attachments(), private.chat_expired_reservation_paths(uuid,uuid,uuid), private.chat_message_attachment_paths(uuid,uuid,uuid), private.chat_can_delete_attachment_object(text), private.chat_can_purge_message_attachments(uuid,uuid,uuid), private.chat_register_attachment(uuid,uuid,uuid,uuid,text,text,integer,integer,integer), private.chat_reserve_attachment_upload(uuid,uuid,uuid,text,text,integer), private.chat_can_read_attachment_object(text), private.chat_can_upload_attachment_object(text); drop table if exists private.chat_attachment_reservations, private.chat_attachments; delete from storage.buckets where id = 'chat-attachments';
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table private.chat_attachments (
  workspace_id uuid not null, conversation_id uuid not null, message_id uuid not null,
  id uuid not null default gen_random_uuid(), object_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 255 and file_name ~ '[^[:space:]]'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  width integer check (width is null or width > 0), height integer check (height is null or height > 0),
  created_at timestamptz not null default now(),
  primary key (workspace_id, conversation_id, message_id, id), unique (object_path),
  foreign key (workspace_id, conversation_id, message_id) references private.chat_messages(workspace_id, conversation_id, id) on delete cascade,
  check (object_path = workspace_id::text || '/' || conversation_id::text || '/' || id::text)
);

create table private.chat_attachment_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null, conversation_id uuid not null, message_id uuid not null, author_id uuid not null,
  file_name text not null check (char_length(file_name) between 1 and 255 and file_name ~ '[^[:space:]]'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  quarantine_path text not null unique, final_path text not null unique, expires_at timestamptz not null,
  foreign key (workspace_id, conversation_id, message_id) references private.chat_messages(workspace_id, conversation_id, id) on delete cascade,
  check (quarantine_path = workspace_id::text || '/' || conversation_id::text || '/quarantine/' || id::text
    and final_path = workspace_id::text || '/' || conversation_id::text || '/' || id::text)
);

revoke all on private.chat_attachments, private.chat_attachment_reservations from public, anon, authenticated;
grant select on private.chat_attachments, private.chat_attachment_reservations to authenticated;
alter table private.chat_attachments enable row level security, force row level security;
alter table private.chat_attachment_reservations enable row level security, force row level security;

create policy chat_attachments_read on private.chat_attachments for select to authenticated using (
  exists (select 1 from private.chat_conversations c where c.workspace_id = chat_attachments.workspace_id and c.id = chat_attachments.conversation_id)
  and exists (select 1 from private.chat_messages m where m.workspace_id = chat_attachments.workspace_id
    and m.conversation_id = chat_attachments.conversation_id and m.id = chat_attachments.message_id and m.deleted_at is null)
);

create policy chat_attachment_reservations_read_own on private.chat_attachment_reservations for select to authenticated
  using (author_id = (select auth.uid()) and expires_at > clock_timestamp());

create or replace function private.chat_can_read_attachment_object(object_name text) returns boolean
language sql stable set search_path = '' as $$
  select object_name is not null and (
    exists (
      select 1 from private.chat_attachments a
      join private.chat_messages m on m.workspace_id = a.workspace_id and m.conversation_id = a.conversation_id and m.id = a.message_id
      join private.chat_conversations c on c.workspace_id = a.workspace_id and c.id = a.conversation_id
      where a.object_path = object_name and m.deleted_at is null
    )
    or exists (
      select 1 from private.chat_attachment_reservations r
      where r.quarantine_path = object_name and r.author_id = (select auth.uid()) and r.expires_at > clock_timestamp()
    )
  );
$$;

create or replace function private.chat_can_upload_attachment_object(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select object_name is not null and exists (
    select 1 from private.chat_attachment_reservations r
    where r.author_id = (select auth.uid()) and r.expires_at > clock_timestamp()
      and (r.quarantine_path = object_name or r.final_path = object_name)
  );
$$;

create or replace function private.chat_reserve_attachment_upload(
  agency_id uuid, target_id uuid, msg_id uuid, name text, mime text, size_bytes integer
) returns private.chat_attachment_reservations language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); declare res_id uuid := gen_random_uuid(); declare reservation private.chat_attachment_reservations;
begin
  perform private.chat_lock_writable(agency_id, target_id);
  if msg_id is null or name is null or mime is null or size_bytes is null then raise exception 'Adjunto inválido' using errcode = '22023'; end if;
  perform 1 from private.chat_messages where workspace_id = agency_id and conversation_id = target_id and id = msg_id and author_id = actor_id and deleted_at is null for update;
  if not found then raise exception 'Mensaje no disponible para adjuntar archivos' using errcode = '42501'; end if;
  delete from private.chat_attachment_reservations where workspace_id = agency_id and conversation_id = target_id and message_id = msg_id and expires_at <= clock_timestamp();
  if (
    (select count(*) from private.chat_attachments where workspace_id = agency_id and conversation_id = target_id and message_id = msg_id)
    + (select count(*) from private.chat_attachment_reservations where workspace_id = agency_id and conversation_id = target_id and message_id = msg_id and expires_at > clock_timestamp())
  ) >= 5 then
    raise exception 'Máximo 5 adjuntos por mensaje' using errcode = '22023';
  end if;
  insert into private.chat_attachment_reservations (id, workspace_id, conversation_id, message_id, author_id, file_name, mime_type, byte_size, quarantine_path, final_path, expires_at)
    values (res_id, agency_id, target_id, msg_id, actor_id, name, mime, size_bytes,
      agency_id::text || '/' || target_id::text || '/quarantine/' || res_id::text,
      agency_id::text || '/' || target_id::text || '/' || res_id::text,
      clock_timestamp() + interval '10 minutes')
    returning * into reservation;
  return reservation;
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
  delete from private.chat_attachment_reservations
    where id = attachment_id and workspace_id = agency_id and conversation_id = target_id and message_id = target_message_id and author_id = actor_id and expires_at > clock_timestamp();
  if not found then raise exception 'Reserva de adjunto inválida o vencida' using errcode = '22023'; end if;
  insert into private.chat_attachments (workspace_id, conversation_id, message_id, id, object_path, file_name, mime_type, byte_size, width, height)
    values (agency_id, target_id, target_message_id, attachment_id, agency_id::text || '/' || target_id::text || '/' || attachment_id::text, original_name, content_type, size_bytes, img_width, img_height);
  -- La copia en cuarentena NO se borra aquí: borrar su fila del catálogo de Storage por SQL deja el archivo físico
  -- huérfano. La aplicación la borra por la API de Storage (bucket.remove) tras registrar con éxito.
  update private.chat_messages set change_number = conversation.last_change_number + 1 where workspace_id = agency_id and conversation_id = target_id and id = target_message_id;
  update private.chat_conversations set last_change_number = last_change_number + 1 where workspace_id = agency_id and id = target_id;
  return attachment_id;
end; $$;

-- Quién puede borrar los archivos de un mensaje vigente: su autor (si sigue en la agencia) o un owner/admin
-- de la agencia que pueda leer la conversación (canales, o directos en los que participa).
create or replace function private.chat_can_purge_message_attachments(agency_id uuid, target_id uuid, msg_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.chat_agency_role(agency_id) is not null and exists (
    select 1 from private.chat_messages m
    join private.chat_conversations c on c.workspace_id = m.workspace_id and c.id = m.conversation_id
    where m.workspace_id = agency_id and m.conversation_id = target_id and m.id = msg_id and m.deleted_at is null
      and (m.author_id = (select auth.uid())
        or (private.chat_agency_role(agency_id) in ('owner', 'admin') and (c.kind = 'channel' or (select auth.uid()) in (c.member_low, c.member_high))))
  );
$$;

-- Política de borrado en Storage: el autor de una reserva (vigente o vencida) puede borrar su cuarentena y su
-- ruta final; quien pueda purgar el mensaje puede borrar el adjunto registrado, su cuarentena residual y las
-- reservas pendientes de ese mensaje.
create or replace function private.chat_can_delete_attachment_object(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select object_name is not null and (
    exists (select 1 from private.chat_attachment_reservations r
      where r.author_id = (select auth.uid()) and (r.quarantine_path = object_name or r.final_path = object_name))
    or exists (select 1 from private.chat_attachments a
      where (a.object_path = object_name or a.workspace_id::text || '/' || a.conversation_id::text || '/quarantine/' || a.id::text = object_name)
        and private.chat_can_purge_message_attachments(a.workspace_id, a.conversation_id, a.message_id))
    or exists (select 1 from private.chat_attachment_reservations r
      where (r.quarantine_path = object_name or r.final_path = object_name)
        and private.chat_can_purge_message_attachments(r.workspace_id, r.conversation_id, r.message_id))
  );
$$;

-- Rutas que la aplicación borra por la API de Storage ANTES de retirar el mensaje. `required` marca los
-- adjuntos registrados, cuyo borrado debe confirmarse; el resto (cuarentena y reservas) puede no existir.
create or replace function private.chat_message_attachment_paths(agency_id uuid, target_id uuid, msg_id uuid)
returns table (object_path text, required boolean) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.chat_can_purge_message_attachments(agency_id, target_id, msg_id) then
    raise exception 'Mensaje no disponible para esta operación' using errcode = '42501';
  end if;
  return query
    select a.object_path, true from private.chat_attachments a where a.workspace_id = agency_id and a.conversation_id = target_id and a.message_id = msg_id
    union all
    select a.workspace_id::text || '/' || a.conversation_id::text || '/quarantine/' || a.id::text, false from private.chat_attachments a where a.workspace_id = agency_id and a.conversation_id = target_id and a.message_id = msg_id
    union all
    select r.quarantine_path, false from private.chat_attachment_reservations r where r.workspace_id = agency_id and r.conversation_id = target_id and r.message_id = msg_id
    union all
    select r.final_path, false from private.chat_attachment_reservations r where r.workspace_id = agency_id and r.conversation_id = target_id and r.message_id = msg_id;
end; $$;

-- Rutas de las reservas vencidas de quien llama en un mensaje, para borrarlas por la API antes de que
-- chat_reserve_attachment_upload elimine esas reservas.
create or replace function private.chat_expired_reservation_paths(agency_id uuid, target_id uuid, msg_id uuid) returns setof text
language sql stable security definer set search_path = '' as $$
  select p from private.chat_attachment_reservations r, lateral (values (r.quarantine_path), (r.final_path)) v(p)
  where r.workspace_id = agency_id and r.conversation_id = target_id and r.message_id = msg_id
    and r.author_id = (select auth.uid()) and r.expires_at <= clock_timestamp();
$$;

-- Red de seguridad al retirar un mensaje: borra solo las filas del catálogo y las reservas. NO borra filas de
-- storage.objects: hacerlo por SQL (desactivando storage.protect_delete) deja el archivo físico huérfano y ya no
-- se podría borrar por la API. Los archivos se borran antes, por la API de Storage, desde la aplicación; si
-- alguno quedara, su fila en storage.objects sigue existiendo (sin política de lectura que la sirva) y puede
-- limpiarse después por la API.
create or replace function private.chat_purge_deleted_message_attachments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from private.chat_attachment_reservations where workspace_id = new.workspace_id and conversation_id = new.conversation_id and message_id = new.id;
  delete from private.chat_attachments where workspace_id = new.workspace_id and conversation_id = new.conversation_id and message_id = new.id;
  return new;
end; $$;

drop trigger if exists chat_messages_purge_attachments_on_delete on private.chat_messages;
create trigger chat_messages_purge_attachments_on_delete
  after update of deleted_at on private.chat_messages
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function private.chat_purge_deleted_message_attachments();

drop policy if exists chat_attachments_select_member on storage.objects;
create policy chat_attachments_select_member on storage.objects for select to authenticated using (bucket_id = 'chat-attachments' and private.chat_can_read_attachment_object(name));
drop policy if exists chat_attachments_insert_writer on storage.objects;
create policy chat_attachments_insert_writer on storage.objects for insert to authenticated with check (bucket_id = 'chat-attachments' and private.chat_can_upload_attachment_object(name));
drop policy if exists chat_attachments_delete_author on storage.objects;
-- Sin política UPDATE a propósito: nadie puede sobrescribir un objeto del bucket (la subida usa upsert: false).
create policy chat_attachments_delete_author on storage.objects for delete to authenticated using (
  bucket_id = 'chat-attachments' and private.chat_can_delete_attachment_object(name)
);

revoke all on function private.chat_purge_deleted_message_attachments() from public, anon, authenticated;
revoke all on function private.chat_can_read_attachment_object(text), private.chat_can_upload_attachment_object(text), private.chat_reserve_attachment_upload(uuid, uuid, uuid, text, text, integer), private.chat_register_attachment(uuid, uuid, uuid, uuid, text, text, integer, integer, integer),
  private.chat_can_purge_message_attachments(uuid, uuid, uuid), private.chat_can_delete_attachment_object(text), private.chat_message_attachment_paths(uuid, uuid, uuid), private.chat_expired_reservation_paths(uuid, uuid, uuid) from public, anon;
grant execute on function private.chat_can_read_attachment_object(text), private.chat_can_upload_attachment_object(text), private.chat_reserve_attachment_upload(uuid, uuid, uuid, text, text, integer), private.chat_register_attachment(uuid, uuid, uuid, uuid, text, text, integer, integer, integer),
  private.chat_can_purge_message_attachments(uuid, uuid, uuid), private.chat_can_delete_attachment_object(text), private.chat_message_attachment_paths(uuid, uuid, uuid), private.chat_expired_reservation_paths(uuid, uuid, uuid) to authenticated;
commit;

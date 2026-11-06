-- Foto de perfil (issue 135): bucket privado de Supabase Storage, una carpeta por persona, con las mismas reglas que
-- «Tu imagen» (ADR 0008). Nadie más (ni los dueños de su agencia) puede leer, firmar, reemplazar ni borrar la foto ajena.

-- 1. Bucket privado con tope de 5 MB y solo JPEG, PNG y WebP (además de la validación por firma en el servidor).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-avatars', 'user-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 2. RLS: solo la carpeta <user_id>/ de la persona de la sesión.
drop policy if exists user_avatars_select_own on storage.objects;
drop policy if exists user_avatars_insert_own on storage.objects;
drop policy if exists user_avatars_update_own on storage.objects;
drop policy if exists user_avatars_delete_own on storage.objects;

create policy user_avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy user_avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy user_avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy user_avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

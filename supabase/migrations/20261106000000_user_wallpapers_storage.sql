-- «Tu imagen» (#84, ADR 0008): fondo propio en un bucket privado de Supabase Storage, una carpeta por persona.
-- Nadie más (ni los dueños de su agencia) puede leer, firmar, reemplazar ni borrar el fondo ajeno.

-- 1. La preferencia de fondo acepta «imagen» (la imagen vive en Storage, no en la tabla).
alter table public.user_preferences drop constraint if exists user_preferences_wallpaper_check;
alter table public.user_preferences add constraint user_preferences_wallpaper_check
  check (wallpaper in ('contornos', 'patron', 'tinta', 'grafito', 'imagen'));

-- 2. Bucket privado con tope de 5 MB y solo JPEG, PNG y WebP (además de la validación por firma en el servidor).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-wallpapers', 'user-wallpapers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3. RLS: solo la carpeta <user_id>/ de la persona de la sesión.
drop policy if exists user_wallpapers_select_own on storage.objects;
drop policy if exists user_wallpapers_insert_own on storage.objects;
drop policy if exists user_wallpapers_update_own on storage.objects;
drop policy if exists user_wallpapers_delete_own on storage.objects;

create policy user_wallpapers_select_own on storage.objects for select to authenticated
  using (bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy user_wallpapers_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy user_wallpapers_update_own on storage.objects for update to authenticated
  using (bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy user_wallpapers_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text);

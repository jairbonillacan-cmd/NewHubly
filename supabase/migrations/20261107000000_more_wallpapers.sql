-- Más fondos para el espacio (issue 134): la preferencia acepta los nuevos fondos dibujados.
-- Solo amplía la lista permitida; ningún valor guardado deja de ser válido.
alter table public.user_preferences drop constraint if exists user_preferences_wallpaper_check;
alter table public.user_preferences add constraint user_preferences_wallpaper_check
  check (wallpaper in ('contornos', 'patron', 'tinta', 'grafito', 'puntos', 'cuadricula', 'aurora', 'hubis', 'arena', 'imagen'));

-- Fondos ilustrados para el espacio: doce imágenes de la casa (seis con versión animada).
-- Solo amplía la lista permitida; ningún valor guardado deja de ser válido.
alter table public.user_preferences drop constraint if exists user_preferences_wallpaper_check;
alter table public.user_preferences add constraint user_preferences_wallpaper_check
  check (wallpaper in (
    'contornos', 'patron', 'tinta', 'grafito', 'puntos', 'cuadricula', 'aurora', 'hubis', 'arena',
    'aurora-polar', 'bosque-de-niebla', 'dunas-de-cobre', 'herbario-de-tinta', 'jardin-japones', 'jardin-submarino',
    'lluvia-en-casa', 'luz-de-cantera', 'marea-lenta', 'papel-plegado', 'refugio-alpino', 'tokio-nocturno',
    'imagen'
  ));

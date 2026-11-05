# 0008. «Tu imagen»: fondo propio en Supabase Storage privado, sin metadatos y con URL firmada

Estado: Propuesto
Fecha: 2026-11-05
Issue: #84

## Contexto

La propuesta B (#75) deja elegir el fondo del espacio de Hoy. Con #83 las preferencias viven en `public.user_preferences`, con RLS por persona. Falta «Tu imagen»: que cada persona suba su propia foto. Es un fondo personal: **solo lo ve quien lo subió**, ni siquiera los dueños de su agencia.

Las fotos de teléfono suelen llevar metadatos (EXIF con coordenadas GPS, modelo de cámara y fecha; XMP; IPTC; textos). Guardarlos expondría, por ejemplo, la ubicación de la casa de alguien. Además, no se puede confiar en la extensión ni en el `Content-Type` que manda el navegador: un SVG con script o un HTML renombrado a `.jpg` no deben llegar al bucket.

El dueño decidió **no añadir dependencias** de procesamiento de imágenes (descartada `sharp`, con binarios nativos y `riesgo:alto` por dependencia) y limpiar los metadatos con código propio.

## Decisión

1. **Bucket privado `user-wallpapers`** (`public = false`), con un límite de 5 MB y solo `image/jpeg`, `image/png` e `image/webp` también en la configuración del bucket.
   - Cada persona guarda **un solo archivo**, `<user_id>/fondo`. Al subir otro se reemplaza (`upsert`), así que no se acumulan versiones.
2. **RLS en `storage.objects`:** cuatro políticas (select, insert, update y delete) que solo valen cuando:
   ```sql
   bucket_id = 'user-wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text
   ```
   Nunca se usa `service_role` en `apps/web`: la subida, la firma y el borrado se hacen con la sesión de la persona, así que RLS decide.
3. **Validación en el servidor**, en `apps/web/src/server/composition/wallpaper-image.ts`, con funciones puras y probadas:
   - Tamaño máximo de 5 MB; vacío, rechazado.
   - Tipo real por firma binaria: JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A` y WebP `RIFF…WEBP`. Lo demás se rechaza, incluidos SVG y GIF.
   - Además se recorre la estructura de cada formato. Un archivo truncado o mal formado se rechaza.
4. **Limpieza de metadatos sin volver a comprimir** (la imagen no pierde calidad):
   - **JPEG:** se quitan APP1 (EXIF y XMP), APP13 (IPTC/Photoshop), el resto de APPn y COM. Se conservan APP0 (JFIF), APP2 `ICC_PROFILE` (color) y APP14 (Adobe). Desde SOS se copia tal cual.
   - **PNG:** se quitan `eXIf`, `tEXt`, `zTXt`, `iTXt` y `tIME`. Se conservan los fragmentos de imagen y el perfil de color.
   - **WebP:** se quitan los fragmentos `EXIF` y `XMP `, se apagan sus banderas en `VP8X` y se recalcula el tamaño del `RIFF`.
5. **Entrega con URL firmada de una hora**, creada en el servidor con la sesión de la persona al cargar `/hoy` y al subir. La imagen nunca tiene URL pública.
6. **Preferencia:** `user_preferences.wallpaper` acepta el valor `imagen`. Al quitar la imagen se borra el objeto y el fondo vuelve a `contornos`.
7. **Server Actions:** el límite de cuerpo sube a 6 MB (`experimental.serverActions.bodySizeLimit`) para admitir 5 MB más la sobrecarga del formulario. Es la única ruta que recibe archivos.

## Consecuencias

- **Privacidad:** ni el bucket ni la tabla dejan que otra persona lea, firme, reemplace o borre el fondo ajeno, aunque comparta agencia. Los metadatos de ubicación no llegan a guardarse.
- **Sin dependencias nuevas.** El costo es mantener un analizador pequeño de tres formatos, cubierto con pruebas sintéticas y verificado con imágenes reales generadas con Pillow.
- **Límites conocidos:**
  - No se reescala ni se recomprime: una foto de 5 MB se sirve tal cual.
  - Una URL firmada caduca a la hora; recargar `/hoy` la renueva.
  - La limpieza no inspecciona los datos de imagen en sí: una foto puede mostrar algo privado. Eso es elección de la persona.
- **CI:** la imagen de Postgres del CI no trae el esquema `storage` de Supabase. El CI crea un esquema mínimo (`buckets`, `objects` y `foldername`) para probar las políticas, igual que ya hace con `auth`. La subida real a Storage no se prueba en CI.

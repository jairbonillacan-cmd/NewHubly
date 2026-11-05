import "server-only";
import { createSupabaseServerClient } from "./auth";
import { sanitizeWallpaperImage } from "./wallpaper-image";

// «Tu imagen» en Supabase Storage (#84, ADR 0008). Siempre con la sesión de la persona: RLS decide; nunca service_role.

export const WALLPAPER_BUCKET = "user-wallpapers";
export const WALLPAPER_SIGNED_URL_SECONDS = 60 * 60;

/** Un solo archivo por persona, en su carpeta: subir otro lo reemplaza. */
export const wallpaperObjectPath = (userId: string) => `${userId}/fondo`;

/** Valida, limpia los metadatos y sube la imagen; devuelve una URL firmada de una hora. */
export async function uploadUserWallpaper(userId: string, input: Uint8Array): Promise<string> {
  const { bytes, contentType } = sanitizeWallpaperImage(input);
  const bucket = (await createSupabaseServerClient()).storage.from(WALLPAPER_BUCKET);
  const { error } = await bucket.upload(wallpaperObjectPath(userId), bytes, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw new Error("No se pudo subir tu imagen. Inténtalo de nuevo.");
  const signed = await signUserWallpaper(userId);
  if (!signed) throw new Error("La imagen se subió, pero no se pudo mostrar. Recarga la página.");
  return signed;
}

/** URL firmada del fondo propio, o null si no hay imagen o no se puede firmar. */
export async function signUserWallpaper(userId: string): Promise<string | null> {
  const bucket = (await createSupabaseServerClient()).storage.from(WALLPAPER_BUCKET);
  const { data, error } = await bucket.createSignedUrl(wallpaperObjectPath(userId), WALLPAPER_SIGNED_URL_SECONDS);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

export async function removeUserWallpaper(userId: string): Promise<void> {
  const bucket = (await createSupabaseServerClient()).storage.from(WALLPAPER_BUCKET);
  const { error } = await bucket.remove([wallpaperObjectPath(userId)]);
  if (error) throw new Error("No se pudo quitar tu imagen.");
}

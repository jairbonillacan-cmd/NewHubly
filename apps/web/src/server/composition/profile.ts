import "server-only";
import { createSupabaseServerClient } from "./auth";
import { sanitizeWallpaperImage } from "./wallpaper-image";

// Perfil de la persona (issue 135): nombre visible en los metadatos de Auth y foto en un bucket privado, una carpeta
// por persona, igual que «Tu imagen» (ADR 0008). Siempre con la sesión de la persona: RLS decide; nunca service_role.

export const AVATAR_BUCKET = "user-avatars";
export const AVATAR_SIGNED_URL_SECONDS = 60 * 60;
export const DISPLAY_NAME_MAX = 60;

/** Un solo archivo por persona, en su carpeta: subir otra foto la reemplaza. */
export const avatarObjectPath = (userId: string) => `${userId}/foto`;

export interface UserProfile { name: string | null; avatarUrl: string | null }

/** URL firmada de la foto; si no hay foto, la firma falla y queda en null. El nombre llega con la sesión.
 *  El perfil es accesorio: si no se puede leer, Hoy carga igual con la inicial del correo. */
export async function loadUserProfile(userId: string, displayName: string | null): Promise<UserProfile> {
  try {
    return { name: displayName, avatarUrl: await signUserAvatar(userId) };
  } catch {
    return { name: displayName, avatarUrl: null };
  }
}

/** Limpia espacios repetidos y corta al máximo; un nombre vacío no se guarda. */
export function normalizeDisplayName(input: string): string | null {
  const name = input.replace(/\s+/g, " ").trim().slice(0, DISPLAY_NAME_MAX);
  return name || null;
}

export async function saveUserDisplayName(input: string): Promise<string> {
  const name = normalizeDisplayName(input);
  if (!name) throw new Error("Escribe tu nombre.");
  const { error } = await (await createSupabaseServerClient()).auth.updateUser({ data: { display_name: name } });
  if (error) throw new Error("No se pudo guardar tu nombre. Inténtalo de nuevo.");
  return name;
}

/** Valida, limpia los metadatos y sube la foto; devuelve una URL firmada de una hora. */
export async function uploadUserAvatar(userId: string, input: Uint8Array): Promise<string> {
  const { bytes, contentType } = sanitizeWallpaperImage(input);
  const bucket = (await createSupabaseServerClient()).storage.from(AVATAR_BUCKET);
  const { error } = await bucket.upload(avatarObjectPath(userId), bytes, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw new Error("No se pudo subir tu foto. Inténtalo de nuevo.");
  const signed = await signUserAvatar(userId);
  if (!signed) throw new Error("La foto se subió, pero no se pudo mostrar. Recarga la página.");
  return signed;
}

export async function signUserAvatar(userId: string): Promise<string | null> {
  const bucket = (await createSupabaseServerClient()).storage.from(AVATAR_BUCKET);
  const { data, error } = await bucket.createSignedUrl(avatarObjectPath(userId), AVATAR_SIGNED_URL_SECONDS);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

export async function removeUserAvatar(userId: string): Promise<void> {
  const bucket = (await createSupabaseServerClient()).storage.from(AVATAR_BUCKET);
  const { error } = await bucket.remove([avatarObjectPath(userId)]);
  if (error) throw new Error("No se pudo quitar tu foto.");
}

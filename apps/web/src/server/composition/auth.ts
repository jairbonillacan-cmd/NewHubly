import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { UserClaims } from "@hubly/db";

export const GENERIC_AUTH_ERROR = "No se pudo iniciar sesión";
export const GENERIC_MAGIC_LINK_MESSAGE = "Si el correo es válido, te enviamos un mensaje";
export const HUBLY_TIMEZONE_COOKIE = "hubly_tz";
export const DEFAULT_APP_TIMEZONE = "America/Mexico_City";

export function isValidIanaTimeZone(tz: string | null | undefined): tz is string {
  if (!tz || typeof tz !== "string" || !tz.trim()) return false;
  try { Intl.DateTimeFormat(undefined, { timeZone: tz.trim() }); return true; } catch { return false; }
}

let testTimeZoneResolver: (() => string | Promise<string>) | null = null;
export function setTimeZoneResolverForTests(fn: (() => string | Promise<string>) | null): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Solo permitido en entorno de pruebas");
  testTimeZoneResolver = fn;
}

export async function resolveRequestTimeZone(): Promise<string> {
  const fallbackTz = isValidIanaTimeZone(process.env.HUBLY_DEFAULT_TIMEZONE) ? process.env.HUBLY_DEFAULT_TIMEZONE.trim() : DEFAULT_APP_TIMEZONE;
  if (process.env.NODE_ENV === "test" && testTimeZoneResolver) {
    const candidate = await testTimeZoneResolver();
    return isValidIanaTimeZone(candidate) ? candidate.trim() : fallbackTz;
  }
  try {
    const raw = (await cookies()).get(HUBLY_TIMEZONE_COOKIE)?.value;
    const decoded = raw ? decodeURIComponent(raw) : undefined;
    return isValidIanaTimeZone(decoded) ? decoded.trim() : fallbackTz;
  } catch { return fallbackTz; }
}

export interface CookieStoreAdapter {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options: CookieOptions): void;
}

export const enforceHttpOnlyCookieOptions = (options?: CookieOptions): CookieOptions => ({
  ...options, httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production",
});

export const createHttpOnlyCookieMethods = (store: CookieStoreAdapter) => ({
  getAll: () => store.getAll(),
  setAll: (list: Array<{ name: string; value: string; options?: CookieOptions }>) => {
    for (const { name, value, options } of list) store.set(name, value, enforceHttpOnlyCookieOptions(options));
  },
});

export function resolveSupabaseConfig(env: NodeJS.ProcessEnv = process.env): { url: string; anonKey: string } {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if ((!url || !anonKey) && env.NODE_ENV !== "development" && env.NODE_ENV !== "test") throw new Error("Configuración de Supabase incompleta");
  return { url: url || "http://127.0.0.1:54321", anonKey: anonKey || "local-dev-anon-key" };
}

export function resolveSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.NEXT_PUBLIC_SITE_URL || env.SITE_URL;
  if (!raw && env.NODE_ENV !== "development" && env.NODE_ENV !== "test") throw new Error("URL del sitio no configurada");
  return (raw || "http://127.0.0.1:3100").replace(/\/+$/, "");
}

export type SupabaseServerClient = ReturnType<typeof createServerClient>;
export type SupabaseClientFactory = (cookieMethods?: ReturnType<typeof createHttpOnlyCookieMethods>) => Promise<SupabaseServerClient> | SupabaseServerClient;
let customClientFactory: SupabaseClientFactory | null = null;

export function setSupabaseServerClientFactoryForTests(f: SupabaseClientFactory | null): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Solo permitido en entorno de pruebas");
  customClientFactory = f;
}

export async function createSupabaseServerClient(cookieMethodsOverride?: ReturnType<typeof createHttpOnlyCookieMethods>): Promise<SupabaseServerClient> {
  if (process.env.NODE_ENV === "test" && customClientFactory) return await customClientFactory(cookieMethodsOverride);
  const { url, anonKey } = resolveSupabaseConfig();
  const cookieMethods = cookieMethodsOverride ?? createHttpOnlyCookieMethods(await cookies());
  return createServerClient(url, anonKey, { cookies: cookieMethods });
}

export async function getVerifiedServerSession(): Promise<{ claims: UserClaims; email: string | null }> {
  const { data, error } = await (await createSupabaseServerClient()).auth.getUser();
  if (error || !data?.user?.id) throw new Error("Sesión caducada");
  return { claims: { sub: data.user.id, role: "authenticated" }, email: data.user.email ?? null };
}

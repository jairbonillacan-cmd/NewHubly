import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { UserClaims } from "@hubly/db";

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

export type SupabaseServerClient = ReturnType<typeof createServerClient>;
let customClientFactory: (() => Promise<SupabaseServerClient> | SupabaseServerClient) | null = null;
export const setSupabaseServerClientFactoryForTests = (f: typeof customClientFactory): void => { customClientFactory = f; };

export async function createSupabaseServerClient(): Promise<SupabaseServerClient> {
  if (customClientFactory) return await customClientFactory();
  const { url, anonKey } = resolveSupabaseConfig();
  return createServerClient(url, anonKey, { cookies: createHttpOnlyCookieMethods(await cookies()) });
}

export async function getVerifiedServerSession(): Promise<{ claims: UserClaims; email: string | null }> {
  const { data, error } = await (await createSupabaseServerClient()).auth.getUser();
  if (error || !data?.user?.id) throw new Error("Sesión caducada");
  return { claims: { sub: data.user.id, role: "authenticated" }, email: data.user.email ?? null };
}

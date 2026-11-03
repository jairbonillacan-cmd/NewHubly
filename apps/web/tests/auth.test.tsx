import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { signInWithMagicLinkAction, signInWithPasswordAction, signUpWithPasswordAction } from "../src/actions/auth";
import { LoginScreen } from "../src/app/(public)/login/page";
import {
  createHttpOnlyCookieMethods, enforceHttpOnlyCookieOptions, getVerifiedServerSession,
  resolveSupabaseConfig, setSupabaseServerClientFactoryForTests, setWorkspaceDbForTests,
} from "../src/server/composition";

describe("Autenticación con Supabase Auth, cookies httpOnly y alta de espacio personal (#46)", () => {
  afterEach(() => { setSupabaseServerClientFactoryForTests(null); setWorkspaceDbForTests(undefined); });

  it("fuerza siempre httpOnly, sameSite lax y path / en el adaptador de cookies y valida config", () => {
    expect(enforceHttpOnlyCookieOptions({ httpOnly: false, sameSite: "none", path: "/custom" })).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    const recorded: Array<{ name: string; value: string; options: unknown }> = [];
    const adapter = createHttpOnlyCookieMethods({ getAll: () => [], set: (name, value, options) => recorded.push({ name, value, options }) });
    adapter.setAll([{ name: "sb-access-token", value: "tok", options: { httpOnly: false } }]);
    expect(recorded[0]?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(() => resolveSupabaseConfig({ NODE_ENV: "production" })).toThrow("Configuración de Supabase incompleta");
  });

  it("getVerifiedServerSession exige usuario verificado en servidor y lanza 'Sesión caducada' si no hay sesión", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }) } }) as any);
    await expect(getVerifiedServerSession()).rejects.toThrow("Sesión caducada");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-verified", email: "ana@agencia.es" } }, error: null }) } }) as any);
    expect(await getVerifiedServerSession()).toEqual({ claims: { sub: "u-verified", role: "authenticated" }, email: "ana@agencia.es" });
  });

  it("signInWithPasswordAction, signUpWithPasswordAction y signInWithMagicLinkAction validan con Zod y crean el espacio al primer inicio", async () => {
    await expect(signInWithPasswordAction({ email: "invalido", password: "123" })).rejects.toThrow();
    await expect(signUpWithPasswordAction({ email: "ana@agencia.es", password: "corto" })).rejects.toThrow();
    await expect(signInWithMagicLinkAction({ email: "sin-arroba" })).rejects.toThrow();
    const members: Array<{ workspaceId: string; userId: string; role: string }> = [];
    const tx = {
      execute: vi.fn().mockImplementation(async () => {
        if (members.length === 0 && tx.execute.mock.calls.length >= 4) {
          members.push({ workspaceId: "ws-primer-inicio", userId: "u-login", role: "owner" });
          return [{ id: "ws-primer-inicio" }];
        }
        return [];
      }),
      select: vi.fn().mockImplementation(() => ({ from: () => ({ where: () => ({ limit: async (c: number) => members.slice(0, c) }) }) })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setWorkspaceDbForTests({ transaction: vi.fn().mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) } as any);
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    setSupabaseServerClientFactoryForTests(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-login", email: "ana@agencia.es" } }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: "u-login", email: "ana@agencia.es" } }, error: null }),
        signUp: vi.fn().mockResolvedValue({ data: { user: { id: "u-login", email: "ana@agencia.es" }, session: { access_token: "ok" } }, error: null }),
        signInWithOtp,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
    expect(await signInWithPasswordAction({ email: "ana@agencia.es", password: "password123" })).toEqual({ ok: true, workspaceId: "ws-primer-inicio", userId: "u-login" });
    expect(await signUpWithPasswordAction({ email: "ana@agencia.es", password: "password123", workspaceName: "Agencia Ana" })).toEqual({ ok: true, workspaceId: "ws-primer-inicio", requiresEmailConfirmation: false });
    expect(await signInWithMagicLinkAction({ email: "ana@agencia.es" })).toEqual({ ok: true });
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "ana@agencia.es" });
  });

  it("renderiza la pantalla /login en español usando tokens de @hubly/ui en sus tres modos", () => {
    expect(renderToStaticMarkup(<LoginScreen initialMode="signin" />)).toContain("Entrar a Hoy");
    expect(renderToStaticMarkup(<LoginScreen initialMode="signup" />)).toContain("Crear cuenta y espacio personal");
    expect(renderToStaticMarkup(<LoginScreen initialMode="magic" />)).toContain("Enviar enlace mágico");
  });
});

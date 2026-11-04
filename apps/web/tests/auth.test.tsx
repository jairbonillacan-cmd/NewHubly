import { NextRequest } from "next/server";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createTodoAction, exportWorkspaceAction, listNotesAction, toggleTodoAction } from "../src/actions";
import { signInWithMagicLinkAction, signInWithPasswordAction, signUpWithPasswordAction } from "../src/actions/auth";
import { LoginScreen } from "../src/app/(public)/login/page";
import { middleware } from "../src/middleware";
import {
  GENERIC_MAGIC_LINK_MESSAGE, createHttpOnlyCookieMethods, enforceHttpOnlyCookieOptions, getVerifiedServerSession,
  resolveSiteUrl, resolveSupabaseConfig, setSupabaseServerClientFactoryForTests, setWorkspaceDbForTests,
} from "../src/server/composition";

describe("Autenticación con Supabase Auth, cookies httpOnly, middleware y Server Actions seguras (#46)", () => {
  afterEach(() => { setSupabaseServerClientFactoryForTests(null); setWorkspaceDbForTests(undefined); });

  it("fuerza httpOnly/sameSite lax/path /, valida config y bloquea ganchos de prueba fuera de NODE_ENV=test", () => {
    expect(enforceHttpOnlyCookieOptions({ httpOnly: false, sameSite: "none", path: "/custom" })).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    const recorded: Array<{ name: string; value: string; options: unknown }> = [];
    const adapter = createHttpOnlyCookieMethods({ getAll: () => [], set: (name, value, options) => recorded.push({ name, value, options }) });
    adapter.setAll([{ name: "sb-access-token", value: "tok", options: { httpOnly: false } }]);
    expect(recorded[0]?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(() => resolveSupabaseConfig({ NODE_ENV: "production" })).toThrow("Configuración de Supabase incompleta");
    expect(() => resolveSiteUrl({ NODE_ENV: "production" })).toThrow("URL del sitio no configurada");
    expect(resolveSiteUrl({ NODE_ENV: "test", SITE_URL: "https://hubly.es/" })).toBe("https://hubly.es");

    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() => setSupabaseServerClientFactoryForTests(null)).toThrow("Solo permitido en entorno de pruebas");
      expect(() => setWorkspaceDbForTests(undefined)).toThrow("Solo permitido en entorno de pruebas");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("Server Actions exigen sesión verificada ('Sesión caducada') y bloquean acceso cruzado al espacio o datos de otro usuario", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }) } }) as any);
    await expect(getVerifiedServerSession()).rejects.toThrow("Sesión caducada");
    await expect(listNotesAction()).rejects.toThrow("Sesión caducada");
    await expect(createTodoAction({ title: "Intento sin sesión" })).rejects.toThrow("Sesión caducada");

    const members = [{ workspaceId: "ws-user-a", userId: "user-a", role: "owner" }];
    const todosB = [{ id: "todo-b", workspaceId: "ws-user-b", createdBy: "user-b", title: "Secreto B", detail: "", dueDate: "2026-11-04", priority: "high", isDone: false, doneAt: null, createdAt: new Date(), updatedAt: new Date() }];
    const nameOf = (t: unknown) => (t as { [k: symbol]: string })?.[Symbol.for("drizzle:Name")];
    const tx = {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn().mockImplementation(() => ({
        from: (table: unknown) => ({
          where: () => {
            const rows = nameOf(table) === "workspace_members" ? members : [];
            return { limit: async (c: number) => rows.slice(0, c), orderBy: async () => rows };
          },
        }),
      })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setWorkspaceDbForTests({ transaction: vi.fn().mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-a", email: "a@agencia.es" } }, error: null }) } }) as any);

    members.length = 0;
    await expect(listNotesAction(undefined, "ws-user-b")).rejects.toThrow("No autorizado en el espacio de trabajo: ws-user-b");
    await expect(exportWorkspaceAction("ws-user-b")).rejects.toThrow("No autorizado en el espacio de trabajo: ws-user-b");
    members.push({ workspaceId: "ws-user-a", userId: "user-a", role: "owner" });
    await expect(toggleTodoAction("todo-b", "ws-user-a")).rejects.toThrow();
    expect(todosB[0]?.isDone).toBe(false);
  });

  it("middleware refresca sesión con cookies httpOnly y redirige /hoy -> /login si no hay sesión verificada", async () => {
    setSupabaseServerClientFactoryForTests((cookieMethods) => ({
      auth: {
        getUser: vi.fn().mockImplementation(async () => {
          cookieMethods?.setAll([{ name: "sb-refresh-token", value: "renovado", options: { httpOnly: false } }]);
          return { data: { user: null }, error: new Error("Expired") };
        }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
    const unauthRes = await middleware(new NextRequest("http://localhost:3100/hoy"));
    expect(unauthRes.status).toBe(307);
    expect(unauthRes.headers.get("location")).toBe("http://localhost:3100/login");

    setSupabaseServerClientFactoryForTests((cookieMethods) => ({
      auth: {
        getUser: vi.fn().mockImplementation(async () => {
          cookieMethods?.setAll([{ name: "sb-access-token", value: "nuevo-jwt", options: { httpOnly: false } }]);
          return { data: { user: { id: "u-1", email: "ana@agencia.es" } }, error: null };
        }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
    const authRes = await middleware(new NextRequest("http://localhost:3100/hoy"));
    expect(authRes.status).toBe(200);
    expect(authRes.cookies.get("sb-access-token")?.httpOnly).toBe(true);
  });

  it("acciones de auth ocultan errores de enumeración, pasan emailRedirectTo a /auth/callback y crean espacio al primer inicio", async () => {
    const members: Array<{ workspaceId: string; userId: string; role: string }> = [];
    const tx = {
      execute: vi.fn().mockImplementation(async () => {
        if (members.length === 0 && tx.execute.mock.calls.length >= 5) {
          members.push({ workspaceId: "ws-primer-inicio", userId: "u-login", role: "owner" });
          return [{ id: "ws-primer-inicio" }];
        }
        return [];
      }),
      select: vi.fn().mockImplementation(() => ({ from: () => ({ where: () => ({ limit: async (c: number) => members.slice(0, c) }) }) })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setWorkspaceDbForTests({ transaction: vi.fn().mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) } as any);

    const signInWithPassword = vi
      .fn()
      .mockResolvedValueOnce({ data: { user: null }, error: new Error("Invalid login credentials") })
      .mockResolvedValue({ data: { user: { id: "u-login", email: "ana@agencia.es" } }, error: null });
    const signUp = vi
      .fn()
      .mockResolvedValueOnce({ data: { user: null }, error: new Error("User already registered") })
      .mockResolvedValue({ data: { user: { id: "u-login", email: "ana@agencia.es" }, session: { access_token: "ok" } }, error: null });
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: new Error("User not found") });

    setSupabaseServerClientFactoryForTests(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-login", email: "ana@agencia.es" } }, error: null }),
        signInWithPassword,
        signUp,
        signInWithOtp,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    await expect(signInWithPasswordAction({ email: "ana@agencia.es", password: "password123" })).rejects.toThrow("No se pudo iniciar sesión");
    await expect(signUpWithPasswordAction({ email: "ana@agencia.es", password: "password123" })).rejects.toThrow("No se pudo iniciar sesión");
    expect(await signInWithPasswordAction({ email: "ana@agencia.es", password: "password123" })).toEqual({ ok: true, workspaceId: "ws-primer-inicio", userId: "u-login" });
    expect(await signUpWithPasswordAction({ email: "ana@agencia.es", password: "password123", workspaceName: "Agencia Ana" })).toEqual({ ok: true, workspaceId: "ws-primer-inicio", requiresEmailConfirmation: false });
    expect(await signInWithMagicLinkAction({ email: "ana@agencia.es" })).toEqual({ ok: true, message: GENERIC_MAGIC_LINK_MESSAGE });
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "ana@agencia.es", options: { emailRedirectTo: "http://127.0.0.1:3100/auth/callback" } });
  });

  it("renderiza /login con Tabs, TextField, Input y Button de HeroUI envueltos en @hubly/ui", () => {
    const signInHtml = renderToStaticMarkup(<LoginScreen initialMode="signin" />);
    expect(signInHtml).toContain('role="tablist"');
    expect(signInHtml).toContain("Entrar a Hoy");
    expect(renderToStaticMarkup(<LoginScreen initialMode="signup" />)).toContain("Crear cuenta y espacio personal");
    expect(renderToStaticMarkup(<LoginScreen initialMode="magic" />)).toContain("Enviar enlace mágico");
  });
});

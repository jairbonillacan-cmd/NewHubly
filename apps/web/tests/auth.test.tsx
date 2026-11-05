import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import manifest from "../src/app/manifest";
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

type LoginNode = React.ReactElement<Record<string, unknown>>;

function loginNode(tree: React.ReactNode, matches: (node: LoginNode) => boolean): LoginNode | undefined {
  for (const child of React.Children.toArray(tree)) {
    if (!React.isValidElement<Record<string, unknown>>(child)) continue;
    if (matches(child)) return child;
    const match = loginNode(child.props.children as React.ReactNode, matches);
    if (match) return match;
  }
}

// Vitest usa Node. Se ejecutan los callbacks de la vista y se observa la referencia
// del encabezado sin instalar un DOM. El navegador comprueba el foco real.
function loginHarness() {
  const states: unknown[] = [], refs: React.RefObject<unknown>[] = [], dependencies: unknown[] = [];
  const focus = vi.fn();
  function render() {
    let stateIndex = 0, refIndex = 0, effectIndex = 0;
    const effects: React.EffectCallback[] = [];
    const state = vi.spyOn(React, "useState").mockImplementation((initial?: unknown) => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value: unknown) => { states[index] = value; }];
    });
    const ref = vi.spyOn(React, "useRef").mockImplementation((initial) => refs[refIndex++] ??= { current: initial });
    const effect = vi.spyOn(React, "useEffect").mockImplementation((callback, deps) => {
      const index = effectIndex++;
      const previous = dependencies[index] as React.DependencyList | undefined;
      if (!previous || deps?.some((value, i) => !Object.is(value, previous[i]))) effects.push(callback);
      dependencies[index] = deps;
    });
    try {
      const tree = LoginScreen({});
      const heading = loginNode(tree, (node) => node.type === "h1")?.props.ref as React.RefObject<unknown>;
      heading.current = { focus };
      effects.forEach((run) => run());
      return tree;
    } finally {
      state.mockRestore();
      ref.mockRestore();
      effect.mockRestore();
    }
  }
  return { focus, render };
}

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
    // Sin sesión, las acciones redirigen a /login: en producción un error lanzado no llega legible al cliente (#92).
    await expect(listNotesAction()).rejects.toEqual(expect.objectContaining({ digest: expect.stringMatching(/^NEXT_REDIRECT;[a-z]+;\/login;/) }));
    await expect(createTodoAction({ title: "Intento sin sesión" })).rejects.toEqual(expect.objectContaining({ digest: expect.stringMatching(/^NEXT_REDIRECT;[a-z]+;\/login;/) }));

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

  it("middleware omite getUser en rutas públicas estáticas, refresca sesión con cookies httpOnly y redirige /hoy -> /login si no hay sesión", async () => {
    const getUserSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: getUserSpy } }) as any);
    const publicRes = await middleware(new NextRequest("http://localhost:3100/privacidad"));
    expect(publicRes.status).toBe(200);
    expect(getUserSpy).not.toHaveBeenCalled();

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
    // Una Server Action sin sesión no se redirige en el middleware: la acción misma redirige con NEXT_REDIRECT (#92).
    const actionRes = await middleware(new NextRequest("http://localhost:3100/hoy", { method: "POST", headers: { "next-action": "abc123" } }));
    expect(actionRes.status).toBe(200);
    expect(actionRes.headers.get("location")).toBeNull();

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

    // Los fallos de autenticación se devuelven con un mensaje genérico, para que lleguen al cliente en producción (#92).
    expect(await signInWithPasswordAction({ email: "ana@agencia.es", password: "password123" })).toEqual({ ok: false, message: "No se pudo iniciar sesión" });
    expect(await signUpWithPasswordAction({ email: "ana@agencia.es", password: "password123" })).toEqual({ ok: false, message: "No se pudo iniciar sesión" });
    expect(await signInWithPasswordAction({ email: "no-es-correo", password: "password123" })).toEqual({ ok: false, message: "Correo electrónico inválido" });
    expect(await signInWithPasswordAction({ email: "ana@agencia.es", password: "password123" })).toEqual({ ok: true, workspaceId: "ws-primer-inicio", userId: "u-login" });
    expect(await signUpWithPasswordAction({ email: "ana@agencia.es", password: "password123", workspaceName: "Agencia Ana" })).toEqual({ ok: true, workspaceId: "ws-primer-inicio", requiresEmailConfirmation: false });
    expect(await signInWithMagicLinkAction({ email: "ana@agencia.es" })).toEqual({ ok: true, message: GENERIC_MAGIC_LINK_MESSAGE });
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "ana@agencia.es", options: { emailRedirectTo: "http://127.0.0.1:3100/auth/callback" } });
  });

  it("renderiza /login con campos etiquetados y acciones de HeroUI, sin pestañas", () => {
    const signInHtml = renderToStaticMarkup(<LoginScreen initialMode="signin" />);
    expect(signInHtml).not.toContain('role="tablist"');
    expect(signInHtml).toMatch(/<label[^>]*>Correo electrónico/);
    expect(signInHtml).toMatch(/<label[^>]*>Contraseña/);
    expect(signInHtml).toMatch(/<button[^>]*type="submit"[^>]*>Entrar<\/button>/);
    expect(renderToStaticMarkup(<LoginScreen initialMode="signup" />)).toMatch(/<button[^>]*type="submit"[^>]*>Crear cuenta<\/button>/);
    expect(renderToStaticMarkup(<LoginScreen initialMode="magic" />)).toMatch(/<button[^>]*type="submit"[^>]*>Enviar enlace<\/button>/);
    expect(signInHtml).not.toContain("¿La olvidaste?");
    expect(signInHtml).toContain("/marca/hubi-cara-claro-128.webp");
    expect(signInHtml).toContain("/marca/hubi-cara-oscuro-128.webp");
    expect(signInHtml).not.toMatch(/viewBox="0 0 (?:380 220|1210 264)"/);
    expect(signInHtml).toContain("/marca/hubi-volumen-claro-laptop-512.webp");
    const m = manifest();
    expect(m.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/marca/icon-192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/marca/icon-512.png", sizes: "512x512", purpose: "any" }),
        expect.objectContaining({ src: "/marca/icon-maskable-512.png", sizes: "512x512", purpose: "maskable" }),
      ]),
    );
    const repoRoot = resolve(process.cwd(), "../..");
    for (const rel of [
      "apps/web/src/app/icon.png", "apps/web/src/app/favicon.ico", "apps/web/src/app/apple-icon.png",
      "apps/web/public/marca/icon-192.png", "apps/web/public/marca/icon-512.png", "apps/web/public/marca/icon-maskable-512.png",
      "docs/marca/originales/secuencia-h.png", "docs/marca/originales/origen-claro.png", "docs/marca/originales/origen-oscuro-icono.png",
    ]) {
      expect(existsSync(resolve(repoRoot, rel)), `Falta ${rel}`).toBe(true);
    }
    for (const w256 of ["origen-claro", "origen-oscuro", "origen-claro-laptop", "origen-oscuro-laptop", "volumen-claro", "volumen-oscuro"]) {
      expect(statSync(resolve(repoRoot, `apps/web/public/marca/hubi-${w256}-256.webp`)).size).toBeLessThan(60 * 1024);
    }
    for (const w512 of ["volumen-claro-laptop", "volumen-oscuro-laptop"]) {
      expect(statSync(resolve(repoRoot, `apps/web/public/marca/hubi-${w512}-512.webp`)).size).toBeLessThan(150 * 1024);
    }
    expect(readFileSync(resolve(repoRoot, "docs/marca/README.md"), "utf8")).not.toContain("C:\\");
  });

  it("pasa por los cinco estados, muestra el error recibido y enfoca el h1 al cambiar", async () => {
    setSupabaseServerClientFactoryForTests(() => ({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("Invalid login credentials") }),
        signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
        signUp: vi.fn().mockResolvedValue({ data: { user: { id: "u-nuevo" }, session: null }, error: null }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
    vi.stubGlobal("window", { setInterval: vi.fn(), clearInterval: vi.fn() });
    try {
      const { render, focus } = loginHarness();
      let tree = render();
      const checkScreen = (title: string, focusCount: number) => {
        tree = render();
        expect(loginNode(tree, (node) => node.type === "h1")?.props.children).toBe(title);
        expect(focus).toHaveBeenCalledTimes(focusCount);
        return renderToStaticMarkup(tree);
      };
      const press = (label: string) => {
        const button = loginNode(tree, (node) => node.props.children === label && typeof node.props.onPress === "function");
        (button?.props.onPress as () => void)();
      };
      const fill = (name: string, value: string) => {
        const field = loginNode(tree, (node) => node.props.name === name && typeof node.props.onChange === "function");
        (field?.props.onChange as (value: string) => void)(value);
      };
      const submit = async () => {
        const form = loginNode(tree, (node) => node.type === "form");
        await (form?.props.onSubmit as (event: { preventDefault(): void }) => Promise<void>)({ preventDefault: vi.fn() });
      };

      checkScreen("Entra a tu espacio", 0);
      fill("email", "ana@agencia.es");
      fill("password", "password123");
      tree = render();
      await submit();
      expect(checkScreen("No se pudo iniciar sesión.", 1)).toMatch(/role="alert"[\s\S]*No se pudo iniciar sesión\.[\s\S]*Revisa el correo y la contraseña/);
      press("Crea tu cuenta");
      expect(checkScreen("Crea tu cuenta", 2)).toContain('value="Mi espacio"');
      await submit();
      expect(checkScreen("Revisa tu correo", 3)).toMatch(/role="status"[\s\S]*Te enviamos un correo a <strong>ana@agencia.es<\/strong> para confirmar la cuenta/);
      press("Usar otro correo");
      expect(checkScreen("Entra sin contraseña", 4)).toContain('value="ana@agencia.es"');
      press("← Entrar con contraseña");
      checkScreen("Entra a tu espacio", 5);
      const magic = loginNode(tree, (node) => node.props.fullWidth === true && node.props.variant === "secondary");
      (magic?.props.onPress as () => void)();
      checkScreen("Entra sin contraseña", 6);
      await submit();
      const sent = checkScreen("Revisa tu correo", 7);
      expect(sent).toContain("Si <strong>ana@agencia.es</strong> tiene cuenta en Hubly, te llegará un enlace para entrar.");
      expect(sent).toMatch(/<button[^>]*disabled[^>]*>Reenviar en 60 s<\/button>/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

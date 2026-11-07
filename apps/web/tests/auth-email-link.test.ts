import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { hasActiveSessionAction, signUpWithPasswordAction } from "../src/actions/auth";
import { linkErrorMessage } from "../src/app/(public)/login/page";
import { GET as callback } from "../src/app/auth/callback/route";
import { GET as confirm } from "../src/app/auth/confirm/route";
import { setSupabaseServerClientFactoryForTests, setWorkspaceDbForTests } from "../src/server/composition";
import { EMAIL_CONFIRM_PATH, destinationAfterEmailLink, isEmailLinkType, workspaceNameFromMetadata } from "../src/server/composition/email-link";

const SITE = "http://127.0.0.1:3100";

/** Base simulada: el quinto execute crea el espacio personal, como en auth.test.tsx. Guarda cada consulta para inspeccionarla. */
function fakeWorkspaceDb() {
  const members: Array<{ workspaceId: string; userId: string; role: string }> = [];
  const tx = {
    execute: vi.fn().mockImplementation(async () => {
      if (members.length === 0 && tx.execute.mock.calls.length >= 5) {
        members.push({ workspaceId: "ws-nuevo", userId: "u-nuevo", role: "owner" });
        return [{ id: "ws-nuevo" }];
      }
      return [];
    }),
    select: vi.fn().mockImplementation(() => ({ from: () => ({ where: () => ({ limit: async (c: number) => members.slice(0, c) }) }) })),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setWorkspaceDbForTests({ transaction: vi.fn().mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) } as any);
  return tx;
}

function fakeAuth(overrides: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) {
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-nuevo", email: "ana@agencia.es", user_metadata: metadata } }, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
    ...overrides,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSupabaseServerClientFactoryForTests(() => ({ auth }) as any);
  return auth;
}

const location = (res: Response) => res.headers.get("location");

describe("Enlaces de los correos: /auth/confirm, registro con bienvenida y nombre del espacio", () => {
  afterEach(() => { setSupabaseServerClientFactoryForTests(null); setWorkspaceDbForTests(undefined); });

  it("/auth/confirm valida el token en el servidor y lleva a Hoy con la bienvenida solo en el registro", async () => {
    fakeWorkspaceDb();
    const auth = fakeAuth();
    const res = await confirm(new Request(`${SITE}/auth/confirm?token_hash=abc&type=email&flujo=registro`));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
    expect(location(res)).toBe(`${SITE}/hub?bienvenida=1`);

    fakeWorkspaceDb();
    fakeAuth();
    expect(location(await confirm(new Request(`${SITE}/auth/confirm?token_hash=abc&type=email`)))).toBe(`${SITE}/hub`);
  });

  it("/auth/confirm nunca redirige a una ruta tomada de la URL", async () => {
    fakeWorkspaceDb();
    fakeAuth();
    const res = await confirm(new Request(`${SITE}/auth/confirm?token_hash=abc&type=email&flujo=${encodeURIComponent("https://malo.example")}&next=//malo.example`));
    expect(location(res)).toBe(`${SITE}/hub`);
  });

  it("/auth/confirm rechaza enlaces sin token, con tipos desconocidos o de recuperación, y explica los caducados", async () => {
    const auth = fakeAuth({ verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: new Error("Token has expired or is invalid") }) });
    expect(location(await confirm(new Request(`${SITE}/auth/confirm?type=email`)))).toBe(`${SITE}/login?error=enlace-invalido`);
    expect(location(await confirm(new Request(`${SITE}/auth/confirm?token_hash=abc&type=recovery`)))).toBe(`${SITE}/login?error=enlace-invalido`);
    expect(location(await confirm(new Request(`${SITE}/auth/confirm?token_hash=abc&type=cualquiera`)))).toBe(`${SITE}/login?error=enlace-invalido`);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(location(await confirm(new Request(`${SITE}/auth/confirm?token_hash=abc&type=email`)))).toBe(`${SITE}/login?error=enlace-caducado`);
  });

  it("crea el espacio personal con el nombre elegido al registrarse, que viaja en los metadatos", async () => {
    const tx = fakeWorkspaceDb();
    fakeAuth({}, { workspace_name: "  Agencia Ana  " });
    await confirm(new Request(`${SITE}/auth/confirm?token_hash=abc&type=email&flujo=registro`));
    expect(JSON.stringify(tx.execute.mock.calls)).toContain("Agencia Ana");
  });

  it("/auth/callback (PKCE) sigue funcionando como respaldo y respeta el flujo de registro", async () => {
    fakeWorkspaceDb();
    const auth = fakeAuth();
    expect(location(await callback(new Request(`${SITE}/auth/callback?code=xyz&flujo=registro`)))).toBe(`${SITE}/hub?bienvenida=1`);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
    expect(location(await callback(new Request(`${SITE}/auth/callback`)))).toBe(`${SITE}/login?error=enlace-invalido`);
    fakeAuth({ exchangeCodeForSession: vi.fn().mockResolvedValue({ data: {}, error: new Error("invalid flow state") }) });
    expect(location(await callback(new Request(`${SITE}/auth/callback?code=xyz`)))).toBe(`${SITE}/login?error=enlace-caducado`);
  });

  it("el registro indica adónde volver y guarda el nombre del espacio en los metadatos", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: { id: "u-nuevo" }, session: null }, error: null });
    fakeAuth({ signUp });
    expect(await signUpWithPasswordAction({ email: "ana@agencia.es", password: "password123", workspaceName: "Agencia Ana" }))
      .toEqual({ ok: true, workspaceId: null, requiresEmailConfirmation: true });
    expect(signUp).toHaveBeenCalledWith({
      email: "ana@agencia.es", password: "password123",
      options: { emailRedirectTo: `${SITE}/auth/callback?flujo=registro`, data: { workspace_name: "Agencia Ana" } },
    });
    await signUpWithPasswordAction({ email: "ana@agencia.es", password: "password123" });
    expect(signUp).toHaveBeenLastCalledWith({ email: "ana@agencia.es", password: "password123", options: { emailRedirectTo: `${SITE}/auth/callback?flujo=registro` } });
  });

  it("el nombre de los metadatos se valida como en el formulario: si no vale, se usa el de por defecto", () => {
    expect(workspaceNameFromMetadata({ workspace_name: "  Mi agencia " })).toBe("Mi agencia");
    expect(workspaceNameFromMetadata({ workspace_name: "x".repeat(81) })).toBeUndefined();
    expect(workspaceNameFromMetadata({ workspace_name: "   " })).toBeUndefined();
    expect(workspaceNameFromMetadata({ workspace_name: 42 })).toBeUndefined();
    expect(workspaceNameFromMetadata(null)).toBeUndefined();
    expect(destinationAfterEmailLink("registro")).toBe("/hub?bienvenida=1");
    expect(destinationAfterEmailLink("/admin")).toBe("/hub");
    expect(isEmailLinkType("recovery")).toBe(false);
    expect(isEmailLinkType("magiclink")).toBe(true);
  });

  it("la pantalla de «Revisa tu correo» sabe si la cuenta ya se confirmó en otra pestaña", async () => {
    fakeAuth();
    expect(await hasActiveSessionAction()).toBe(true);
    fakeAuth({ getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }) });
    expect(await hasActiveSessionAction()).toBe(false);
  });

  it("/login explica los enlaces caducados o inválidos e ignora cualquier otro valor", () => {
    expect(linkErrorMessage("?error=enlace-caducado")).toMatch(/caducó o ya se usó/);
    expect(linkErrorMessage("?error=enlace-invalido")).toMatch(/no es válido/);
    expect(linkErrorMessage("?error=<script>")).toBeNull();
    expect(linkErrorMessage("")).toBeNull();
  });

  it("las plantillas de correo apuntan a /auth/confirm con un tipo aceptado y no usan el enlace PKCE", () => {
    const dir = resolve(__dirname, "../../../supabase/templates");
    const templates = readdirSync(dir).filter((file) => file.endsWith(".html"));
    expect(templates).toHaveLength(5);
    for (const file of templates) {
      const html = readFileSync(resolve(dir, file), "utf8");
      expect(html, file).not.toContain("{{ .ConfirmationURL }}");
      for (const [, type] of html.matchAll(/\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&amp;type=([a-z_]+)/g)) expect(isEmailLinkType(type ?? null), file).toBe(true);
      if (file !== "reautenticacion.html") expect(html, file).toContain(`{{ .SiteURL }}${EMAIL_CONFIRM_PATH}?token_hash={{ .TokenHash }}`);
    }
    expect(readFileSync(resolve(dir, "confirmacion.html"), "utf8")).toContain("flujo=registro");
  });

  it("las plantillas de correo muestran a Hubi en PNG ligero servido por la propia web (issue 125)", () => {
    const dir = resolve(__dirname, "../../../supabase/templates");
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".html"))) {
      const images = [...readFileSync(resolve(dir, file), "utf8").matchAll(/<img src="\{\{ \.SiteURL \}\}\/([^"]+)"/g)].map(([, path]) => path ?? "");
      expect(images, file).toHaveLength(1);
      for (const path of images) {
        expect(path, file).toMatch(/^marca\/correo\/hubi-[a-z]+-192\.png$/);
        expect(statSync(resolve(__dirname, "../public", path)).size, path).toBeLessThan(40_000);
      }
    }
  });
});

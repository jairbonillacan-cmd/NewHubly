import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { middleware } from "../src/middleware";
import { buildContentSecurityPolicy, createNonce, staticSecurityHeaders } from "../src/security-headers";
import { setSupabaseServerClientFactoryForTests } from "../src/server/composition";

describe("CSP con nonce y cabeceras estrictas (#91)", () => {
  afterEach(() => setSupabaseServerClientFactoryForTests(null));

  it("la CSP de producción no permite scripts en línea ni eval, ni que otra web enmarque la app", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc", isDev: false, supabaseUrl: "https://proyecto.supabase.co/auth/v1" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("connect-src 'self' https://proyecto.supabase.co");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy({ nonce: "abc", isDev: true })).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ nonce: "abc", isDev: false, supabaseUrl: "no es url" })).toContain("connect-src 'self';");
  });

  it("cada nonce es distinto y tiene 128 bits", () => {
    const a = createNonce(), b = createNonce();
    expect(a).not.toBe(b);
    expect(atob(a)).toHaveLength(16);
  });

  it("HSTS solo en producción", () => {
    expect(staticSecurityHeaders(true)["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
    expect(staticSecurityHeaders(false)["Strict-Transport-Security"]).toBeUndefined();
  });

  it("el middleware pone las cabeceras en páginas públicas, en /hoy y en la redirección a /login", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("sin sesión") }) } }) as any);
    for (const url of ["http://localhost:3100/", "http://localhost:3100/privacidad", "http://localhost:3100/hoy"]) {
      const res = await middleware(new NextRequest(url));
      const csp = res.headers.get("content-security-policy") ?? "";
      expect(csp, url).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      expect(res.headers.get("x-frame-options"), url).toBe("DENY");
      expect(res.headers.get("x-content-type-options"), url).toBe("nosniff");
      expect(res.headers.get("referrer-policy"), url).toBe("strict-origin-when-cross-origin");
    }
    expect((await middleware(new NextRequest("http://localhost:3100/hoy"))).status).toBe(307);
    // En /invitacion manda no-referrer: el token del enlace no debe salir en ningún Referer (#64).
    const inv = await middleware(new NextRequest("http://localhost:3100/invitacion"));
    expect(inv.headers.get("referrer-policy")).toBe("no-referrer");
    expect(inv.headers.get("content-security-policy")).toMatch(/'nonce-/);
  });
});

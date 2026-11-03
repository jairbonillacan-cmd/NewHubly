import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { withUserContext } from "../src/context";
import { resolveDatabaseUrl } from "../src/client";
import * as dbExports from "../src/index";

describe("withUserContext & boundaries (ADR 0004 & Issue #23)", () => {
  it("valida claims requeridos", async () => {
    // @ts-expect-error invalid claims
    await expect(withUserContext(null, async () => {})).rejects.toThrow("claims object is required");
    // @ts-expect-error missing sub
    await expect(withUserContext({ role: "authenticated" }, async () => {})).rejects.toThrow("valid sub claim is required");
    await expect(withUserContext({ sub: "   ", role: "authenticated" }, async () => {})).rejects.toThrow("valid sub claim is required");
    await expect(withUserContext({ sub: "u1", role: "anon" }, async () => {})).rejects.toThrow("role must be 'authenticated'");
  });

  it("ejecuta transacción aplicando role y claims", async () => {
    const mockTx = { execute: vi.fn().mockResolvedValue([]) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDb = { transaction: vi.fn().mockImplementation((cb: (tx: any) => Promise<any>) => cb(mockTx)) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await withUserContext({ sub: "u1", role: "authenticated", email: "a@b.com" }, async () => "ok", mockDb as any)).toBe("ok");
    expect(mockTx.execute).toHaveBeenCalledTimes(3);
  });

  it("resuelve DATABASE_URL y falla fuera de test/dev", () => {
    const orig = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(resolveDatabaseUrl("postgresql://c:5432/d")).toBe("postgresql://c:5432/d");
    process.env.DATABASE_URL = "postgresql://e:5432/d";
    expect(resolveDatabaseUrl()).toBe("postgresql://e:5432/d");
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = "test";
    expect(resolveDatabaseUrl()).toContain("127.0.0.1:54322");
    process.env.NODE_ENV = "production";
    expect(() => resolveDatabaseUrl()).toThrow("DATABASE_URL no está definida");
    if (orig) process.env.DATABASE_URL = orig;
  });

  it("no expone getDb ni createDbClient en el index público", () => {
    expect("getDb" in dbExports || "createDbClient" in dbExports).toBe(false);
    expect(typeof dbExports.withUserContext).toBe("function");
    expect(dbExports.schema).toBeDefined();
  });
});

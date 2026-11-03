import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { withUserContext } from "../src/context";

describe("withUserContext (ADR 0004 & Issue #23)", () => {
  it("rechaza llamadas con claims nulos o indefinidos", async () => {
    // @ts-expect-error probando entrada inválida
    await expect(withUserContext(null, async () => {})).rejects.toThrow("claims object is required");
    // @ts-expect-error probando entrada inválida
    await expect(withUserContext(undefined, async () => {})).rejects.toThrow("claims object is required");
  });

  it("rechaza llamadas sin sub o con sub vacío", async () => {
    // @ts-expect-error probando sub ausente
    await expect(withUserContext({ role: "authenticated" }, async () => {})).rejects.toThrow("valid sub claim is required");
    await expect(withUserContext({ sub: "   ", role: "authenticated" }, async () => {})).rejects.toThrow("valid sub claim is required");
  });

  it("rechaza llamadas con rol diferente a 'authenticated'", async () => {
    await expect(withUserContext({ sub: "user-123", role: "anon" }, async () => {})).rejects.toThrow("role must be 'authenticated'");
    await expect(withUserContext({ sub: "user-123", role: "admin" as unknown as "authenticated" }, async () => {})).rejects.toThrow("role must be 'authenticated'");
  });

  it("ejecuta la transacción aplicando role y claims de seguridad", async () => {
    const executedQueries: unknown[] = [];
    const mockTx = {
      execute: vi.fn().mockImplementation((q) => { executedQueries.push(q); return Promise.resolve([]); }),
    };
    const mockDb = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(mockTx)),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await withUserContext({ sub: "usr-1", role: "authenticated", email: "a@b.com" }, async () => "ok", mockDb as any);
    expect(res).toBe("ok");
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.execute).toHaveBeenCalledTimes(3);
  });
});

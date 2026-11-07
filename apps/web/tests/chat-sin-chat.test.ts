import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/actions", () => ({ loadWorkspaceDashboardAction: vi.fn().mockResolvedValue({ chat: null }) }));

import { HoyPage } from "../src/app/(workspace)/hoy/page";

describe("/chat en un espacio sin chat (issue 212)", () => {
  it("lleva a Hoy en vez de dar 404 al volver atrás o recargar", async () => {
    const error = await HoyPage({ chatMode: true }).then(() => null, (err: unknown) => err);
    expect(error).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;[^;]*;\/hoy;/) });
  });
});

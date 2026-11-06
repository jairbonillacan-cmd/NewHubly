import { ChatAccessError } from "@hubly/application";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionExpiredError, getVerifiedServerSession } from "../src/server/composition/auth";
import { getChatService, isChatEnabled } from "../src/server/composition/chat";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/composition/auth", async (original) => ({
  ...await original<typeof import("../src/server/composition/auth")>(),
  getVerifiedServerSession: vi.fn(),
}));
const listUserWorkspaces = vi.fn();
vi.mock("@hubly/db", async (original) => ({
  ...await original<typeof import("@hubly/db")>(),
  DrizzleWorkspaceRepository: vi.fn(function () { return { listUserWorkspaces }; }),
}));

const agency = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const personal = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const session = { claims: { sub: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" } } as Awaited<ReturnType<typeof getVerifiedServerSession>>;

describe("Composición autenticada del chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HUBLY_CHAT_PILOT_WORKSPACE_IDS", `${agency.toUpperCase()}, ${personal}`);
    listUserWorkspaces.mockResolvedValue([
      { id: agency, name: "Agencia", slug: "agencia", kind: "agency", role: "editor" },
      { id: personal, name: "Personal", slug: "personal", kind: "personal", role: "owner" },
    ]);
  });

  it("normaliza mayúsculas y espacios de la lista de pilotos", () => {
    expect(isChatEnabled(agency.toUpperCase())).toBe(true);
    expect(isChatEnabled("")).toBe(false);
  });

  it("exige sesión antes de consultar espacios", async () => {
    vi.mocked(getVerifiedServerSession).mockRejectedValue(new SessionExpiredError());
    await expect(getChatService(agency)).rejects.toBeInstanceOf(SessionExpiredError);
    expect(listUserWorkspaces).not.toHaveBeenCalled();
  });

  it("niega agencias fuera del piloto, espacios personales y espacios ajenos", async () => {
    vi.mocked(getVerifiedServerSession).mockResolvedValue(session);
    await expect(getChatService("dddddddd-dddd-4ddd-8ddd-dddddddddddd")).rejects.toBeInstanceOf(ChatAccessError);
    expect(listUserWorkspaces).not.toHaveBeenCalled();
    await expect(getChatService(personal)).rejects.toBeInstanceOf(ChatAccessError);
    listUserWorkspaces.mockResolvedValue([]);
    await expect(getChatService(agency)).rejects.toBeInstanceOf(ChatAccessError);
  });

  it("compone el servicio con el rol que viene de la membresía", async () => {
    vi.mocked(getVerifiedServerSession).mockResolvedValue(session);
    const chat = await getChatService(agency);
    await expect(chat.command({ kind: "createChannel", workspaceId: agency, slug: "produccion" })).rejects.toBeInstanceOf(ChatAccessError);
  });
});

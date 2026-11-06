import { ChatAccessError } from "@hubly/application";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionExpiredError, getVerifiedServerSession } from "../src/server/composition/auth";
import { getChatService, isChatEnabled } from "../src/server/composition/chat";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/composition/auth", async (original) => ({
  ...await original<typeof import("../src/server/composition/auth")>(),
  getVerifiedServerSession: vi.fn(),
}));
// Sustituto sin importar @hubly/db: las pruebas de web no pueden depender de infraestructura (ADR 0002).
const { listUserWorkspaces } = vi.hoisted(() => ({ listUserWorkspaces: vi.fn() }));
vi.mock("@hubly/db", () => ({
  DrizzleWorkspaceRepository: vi.fn(function () { return { listUserWorkspaces }; }),
  DrizzleChatRepository: vi.fn(function () { return {}; }),
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

  it("normaliza mayúsculas y espacios de la lista de pilotos y del espacio", async () => {
    expect(isChatEnabled(agency.toUpperCase())).toBe(true);
    expect(isChatEnabled("")).toBe(false);
    vi.mocked(getVerifiedServerSession).mockResolvedValue(session);
    const chat = await getChatService(agency.toUpperCase());
    await expect(chat.command({ kind: "createChannel", workspaceId: agency.toUpperCase(), slug: "produccion" }))
      .rejects.toBeInstanceOf(ChatAccessError);
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

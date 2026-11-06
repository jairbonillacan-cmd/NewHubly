import { describe, expect, it, vi } from "vitest";
import { ChatAccessError, ChatRequestError, createChatService, type ChatContext, type ChatRepository } from "./chat";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";
const ctx: ChatContext = { workspaceId, userId: "33333333-3333-4333-8333-333333333333", role: "owner", workspaceKind: "agency", enabled: true };

function repo(overrides: Partial<ChatRepository> = {}): ChatRepository {
  return {
    conversations: vi.fn().mockResolvedValue([]),
    conversation: vi.fn().mockResolvedValue({ id: conversationId, kind: "channel", slug: "produccion", peerId: null, archived: false, writable: true, unread: false, changeCursor: 0 }),
    canContact: vi.fn().mockResolvedValue(true),
    ownsMessage: vi.fn().mockResolvedValue(true),
    history: vi.fn().mockResolvedValue(null),
    sync: vi.fn().mockResolvedValue({ conversations: [], conversationAvailable: true, changes: [], after: 0, hasMore: false }),
    ensureGeneral: vi.fn().mockResolvedValue(conversationId),
    command: vi.fn().mockResolvedValue({ conversationId }),
    agencyExportMessages: vi.fn().mockResolvedValue([]),
    directory: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("Servicio de chat", () => {
  it("valida las entradas aunque el adaptador no haya aplicado el contrato", async () => {
    const storage = repo();
    const chat = createChatService(ctx, storage);
    await expect(chat.command({ kind: "send", workspaceId, conversationId, retryKey: conversationId, body: "   " }))
      .rejects.toBeInstanceOf(ChatRequestError);
    await expect(chat.sync(workspaceId, "no-es-uuid", 0)).rejects.toBeInstanceOf(ChatRequestError);
    await expect(chat.history(workspaceId, conversationId, -1)).rejects.toBeInstanceOf(ChatRequestError);
    expect(storage.command).not.toHaveBeenCalled();
    expect(storage.sync).not.toHaveBeenCalled();
  });

  it("normaliza el nombre del canal antes de llegar al repositorio", async () => {
    const storage = repo();
    await createChatService(ctx, storage).command({ kind: "createChannel", workspaceId, slug: " Produccion " });
    expect(storage.command).toHaveBeenCalledWith({ kind: "createChannel", workspaceId, slug: "produccion" });
  });

  it("traduce los códigos de Postgres a errores de aplicación", async () => {
    const failing = (code: string) => createChatService(ctx, repo({ command: vi.fn().mockRejectedValue({ cause: { code } }) }))
      .command({ kind: "createChannel", workspaceId, slug: "produccion" });
    await expect(failing("23505")).rejects.toMatchObject({ reason: "conflict" });
    await expect(failing("P0429")).rejects.toMatchObject({ reason: "rate-limit" });
    await expect(failing("22023")).rejects.toMatchObject({ reason: "invalid" });
    await expect(failing("42501")).rejects.toBeInstanceOf(ChatAccessError);
    const unknown = new Error("fallo de red");
    await expect(createChatService(ctx, repo({ conversations: vi.fn().mockRejectedValue(unknown) })).list(workspaceId)).rejects.toBe(unknown);
  });

  it("permite exportar el chat de la agencia solo al owner y rechaza a admin, editor y viewer", async () => {
    const sample = [{
      id: conversationId, conversationId, authorId: ctx.userId, body: "Mensaje en canal",
      number: 1, change: 1, sentAt: "2026-11-05T15:00:00.000Z", editedAt: null, deletedAt: null,
    }];
    const storage = repo({ agencyExportMessages: vi.fn().mockResolvedValue(sample) });
    await expect(createChatService(ctx, storage).exportAgency(workspaceId)).resolves.toEqual(sample);
    expect(storage.agencyExportMessages).toHaveBeenCalledTimes(1);

    for (const role of ["admin", "editor", "viewer"] as const) {
      const memberRepo = repo();
      await expect(createChatService({ ...ctx, role }, memberRepo).exportAgency(workspaceId))
        .rejects.toBeInstanceOf(ChatAccessError);
      expect(memberRepo.agencyExportMessages).not.toHaveBeenCalled();
    }
  });
});

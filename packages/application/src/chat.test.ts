import { describe, expect, it, vi } from "vitest";
import { ChatAccessError, ChatRequestError, createChatService, type ChatCommand, type ChatContext, type ChatRepository } from "./chat";

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

  it("exige rol de escritura para reacciones, escribiendo y envíos con cita, hilo y menciones", async () => {
    const messageId = "44444444-4444-4444-8444-444444444444";
    const social: ChatCommand[] = [
      { kind: "toggleReaction", workspaceId, conversationId, messageId, emoji: "👍" },
      { kind: "typing", workspaceId, conversationId },
      { kind: "send", workspaceId, conversationId, retryKey: messageId, body: "Hola @Ana", replyToId: messageId,
        threadRootId: messageId, mentionedUserIds: [ctx.userId] },
    ];
    for (const command of social) {
      const storage = repo();
      await createChatService({ ...ctx, role: "editor" }, storage).command(command);
      expect(storage.command).toHaveBeenCalledWith(command);
      const viewerRepo = repo();
      await expect(createChatService({ ...ctx, role: "viewer" }, viewerRepo).command(command)).rejects.toBeInstanceOf(ChatAccessError);
      expect(viewerRepo.command).not.toHaveBeenCalled();
      const readOnly = repo({ conversation: vi.fn().mockResolvedValue({
        id: conversationId, kind: "channel", slug: "general", peerId: null, archived: true, writable: false, unread: false, changeCursor: 0,
      }) });
      await expect(createChatService(ctx, readOnly).command(command)).rejects.toBeInstanceOf(ChatAccessError);
    }
    await expect(createChatService(ctx, repo()).command({ kind: "toggleReaction", workspaceId, conversationId, messageId, emoji: "" }))
      .rejects.toBeInstanceOf(ChatRequestError);
  });

  it("deja marcar menciones leídas a cualquier lector y traduce la cuota a límite", async () => {
    const command = { kind: "markMentionsRead", workspaceId, conversationId, upToNumber: 3 } as const;
    const storage = repo({ conversation: vi.fn().mockResolvedValue({
      id: conversationId, kind: "channel", slug: "general", peerId: null, archived: false, writable: false, unread: false, changeCursor: 0,
    }) });
    await createChatService({ ...ctx, role: "viewer" }, storage).command(command);
    expect(storage.command).toHaveBeenCalledWith(command);
    const limited = repo({ command: vi.fn().mockRejectedValue({ cause: { code: "P0429" } }) });
    await expect(createChatService(ctx, limited).command(command)).rejects.toMatchObject({ reason: "rate-limit" });
    const hidden = repo({ conversation: vi.fn().mockResolvedValue(null) });
    await expect(createChatService(ctx, hidden).command(command)).rejects.toBeInstanceOf(ChatAccessError);
  });

  it("pasa el hilo al historial y valida su identificador", async () => {
    const storage = repo({ history: vi.fn().mockResolvedValue({ conversation: {}, messages: [], before: null }) });
    const chat = createChatService(ctx, storage);
    await chat.history(workspaceId, conversationId, undefined, conversationId);
    expect(storage.history).toHaveBeenCalledWith(conversationId, undefined, conversationId);
    await expect(chat.history(workspaceId, conversationId, undefined, "no-es-uuid")).rejects.toBeInstanceOf(ChatRequestError);
  });
});

import { randomUUID } from "node:crypto";
import { ChatAccessError } from "@hubly/application";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../src/app/api/chat/route";
import { SessionExpiredError } from "../src/server/composition/auth";
import { getChatService } from "../src/server/composition/chat";
import { signCoworkerAvatars } from "../src/server/composition/profile";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/composition/chat", () => ({ getChatService: vi.fn() }));
vi.mock("../src/server/composition/profile", () => ({ signCoworkerAvatars: vi.fn() }));

const host = "https://hubly.test";
const workspaceId = randomUUID();
const conversationId = randomUUID();
const command = { kind: "send", workspaceId, conversationId, retryKey: randomUUID(), body: "Prueba" };
const makeGet = (query: string) => new Request(`${host}/api/chat?workspaceId=${workspaceId}&${query}`);
const makePost = (value: unknown, origin = host) => new Request(`${host}/api/chat`, {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value),
});
const sampleMessage = {
  id: randomUUID(), conversationId, authorId: randomUUID(), body: "Mi mensaje", number: 1, change: 1,
  sentAt: "2026-11-05T18:00:00.000Z", editedAt: null, deletedAt: null,
};

describe("API privada de chat", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rechaza mutaciones de otro origen y comandos inválidos antes de acceder a datos", async () => {
    expect((await POST(makePost(command, "https://otro.test"))).status).toBe(403);
    expect((await POST(makePost({ ...command, body: " " }))).status).toBe(400);
    expect(getChatService).not.toHaveBeenCalled();
  });

  it("acepta el origen del navegador cuando Next normaliza el host del mismo sitio", async () => {
    const send = vi.fn().mockResolvedValue({ conversationId, message: sampleMessage });
    vi.mocked(getChatService).mockResolvedValue({ command: send } as unknown as Awaited<ReturnType<typeof getChatService>>);
    const request = new Request("http://localhost:3100/api/chat", {
      method: "POST", body: JSON.stringify(command),
      headers: { origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100", "content-type": "application/json" },
    });
    expect((await POST(request)).status).toBe(200);
    expect(send).toHaveBeenCalledWith(command);
  });

  it("distingue sesión caducada y falta de acceso sin exponer el recurso", async () => {
    vi.mocked(getChatService).mockRejectedValueOnce(new SessionExpiredError()).mockRejectedValueOnce(new ChatAccessError());
    expect((await GET(makeGet("op=sync"))).status).toBe(401);
    const forbidden = await GET(makeGet(`op=history&conversationId=${conversationId}`));
    expect(forbidden.status).toBe(404);
    expect(await forbidden.json()).toEqual({ error: "Chat o conversación no disponible." });
  });

  it("valida los cursores y devuelve sincronización sin caché", async () => {
    const value = { conversations: [], conversationAvailable: true, changes: [], after: 5, hasMore: false };
    const sync = vi.fn().mockResolvedValue(value);
    vi.mocked(getChatService).mockResolvedValue({ sync } as unknown as Awaited<ReturnType<typeof getChatService>>);
    expect((await GET(makeGet("op=sync&after=-1"))).status).toBe(400);
    const response = await GET(makeGet(`op=sync&after=5&conversationId=${conversationId}`));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(value);
    expect(sync).toHaveBeenCalledWith(workspaceId, conversationId, 5);
  });

  it("conserva la clave de reintento, sanitiza los errores y sirve exportaciones del owner como descargas", async () => {
    const send = vi.fn().mockRejectedValueOnce({ cause: { code: "P0429" } });
    const exportAgency = vi.fn().mockResolvedValue([sampleMessage]);
    vi.mocked(getChatService).mockResolvedValue({ command: send, exportAgency } as unknown as Awaited<ReturnType<typeof getChatService>>);
    expect((await POST(makePost(command))).status).toBe(429);
    expect(send).toHaveBeenCalledWith(command);

    const json = await GET(makeGet("op=export&format=json"));
    expect(json.headers.get("content-disposition")).toContain("hubly-chat.json");
    expect(await json.json()).toEqual({ version: 1, messages: [sampleMessage] });
    expect(exportAgency).toHaveBeenCalledWith(workspaceId);
    const markdown = await GET(makeGet("op=export&format=md"));
    expect(markdown.headers.get("content-disposition")).toContain("hubly-chat.md");
    const markdownText = await markdown.text();
    expect(markdownText).toContain("# Mensajes de la agencia en Hubly");
    expect(markdownText).toContain("    Mi mensaje");

    exportAgency.mockRejectedValueOnce(new ChatAccessError());
    expect((await GET(makeGet("op=export&format=json"))).status).toBe(404);
  });

  it("firma solo los avatares de compañeros con foto en el directorio", async () => {
    const withPhoto = randomUUID();
    const withoutPhoto = randomUUID();
    const directory = vi.fn().mockResolvedValue([
      { id: withPhoto, name: "Ana", role: "editor", status: "online", hasAvatar: true },
      { id: withoutPhoto, name: null, role: "viewer", status: null, hasAvatar: false },
    ]);
    vi.mocked(getChatService).mockResolvedValue({ directory } as unknown as Awaited<ReturnType<typeof getChatService>>);
    vi.mocked(signCoworkerAvatars).mockResolvedValue(new Map([[withPhoto, "https://firmada.test/ana"], [withoutPhoto, null]]));
    const response = await GET(makeGet("op=directory"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: withPhoto, name: "Ana", role: "editor", status: "online", hasAvatar: true, avatarUrl: "https://firmada.test/ana" },
      { id: withoutPhoto, name: null, role: "viewer", status: null, hasAvatar: false, avatarUrl: null },
    ]);
    expect(signCoworkerAvatars).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: withPhoto, hasAvatar: true })]));
  });

  it("pasa el hilo al historial y acepta reacciones, escribiendo y menciones leídas", async () => {
    const history = vi.fn().mockResolvedValue({
      conversation: { id: conversationId, kind: "channel", slug: "general", peerId: null, archived: false, writable: true, unread: false, changeCursor: 3 },
      messages: [{ ...sampleMessage, threadRootId: conversationId, reactions: [{ emoji: "👍", count: 1, userIds: [sampleMessage.authorId] }] }],
      before: null,
    });
    const command = vi.fn().mockResolvedValue({ conversationId, added: true });
    vi.mocked(getChatService).mockResolvedValue({ history, command } as unknown as Awaited<ReturnType<typeof getChatService>>);
    const root = randomUUID();
    expect((await GET(makeGet(`op=history&conversationId=${conversationId}&threadRootId=${root}`))).status).toBe(200);
    expect(history).toHaveBeenCalledWith(workspaceId, conversationId, undefined, root);
    expect((await GET(makeGet(`op=history&conversationId=${conversationId}&threadRootId=raiz`))).status).toBe(400);

    const messageId = randomUUID();
    for (const input of [
      { kind: "toggleReaction", workspaceId, conversationId, messageId, emoji: "🎉" },
      { kind: "typing", workspaceId, conversationId },
      { kind: "markMentionsRead", workspaceId, conversationId, upToNumber: 2 },
    ]) {
      const response = await POST(makePost(input));
      expect(response.status).toBe(200);
      expect(command).toHaveBeenLastCalledWith(input);
    }
    expect(await (await POST(makePost({ kind: "toggleReaction", workspaceId, conversationId, messageId, emoji: "🎉" }))).json())
      .toEqual({ conversationId, added: true });
    expect((await POST(makePost({ kind: "toggleReaction", workspaceId, conversationId, messageId, emoji: "" }))).status).toBe(400);
    command.mockRejectedValueOnce({ cause: { code: "P0429" } });
    expect((await POST(makePost({ kind: "typing", workspaceId, conversationId }))).status).toBe(429);
  });
});

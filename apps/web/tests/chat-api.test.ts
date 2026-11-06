import { randomUUID } from "node:crypto";
import { ChatAccessError } from "@hubly/application";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../src/app/api/chat/route";
import { SessionExpiredError } from "../src/server/composition/auth";
import { getChatService } from "../src/server/composition/chat";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/composition/chat", () => ({ getChatService: vi.fn() }));

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

  it("conserva la clave de reintento, sanitiza los errores y sirve exportaciones como descargas", async () => {
    const send = vi.fn().mockRejectedValueOnce({ cause: { code: "P0429" } });
    const exportOwn = vi.fn().mockResolvedValue([sampleMessage]);
    vi.mocked(getChatService).mockResolvedValue({ command: send, exportOwn } as unknown as Awaited<ReturnType<typeof getChatService>>);
    expect((await POST(makePost(command))).status).toBe(429);
    expect(send).toHaveBeenCalledWith(command);

    const json = await GET(makeGet("op=export&format=json"));
    expect(json.headers.get("content-disposition")).toContain("hubly-chat.json");
    expect(await json.json()).toEqual({ version: 1, messages: [sampleMessage] });
    const markdown = await GET(makeGet("op=export&format=md"));
    expect(markdown.headers.get("content-disposition")).toContain("hubly-chat.md");
    expect(await markdown.text()).toContain("    Mi mensaje");
  });
});

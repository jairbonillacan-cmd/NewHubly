import { randomUUID } from "node:crypto";
import { createChatService } from "@hubly/application";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { DrizzleChatRepository } from "../src/repositories/chat";

const db = postgres(process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
const workspaceId = randomUUID();
const editor = randomUUID();
const viewer = randomUUID();
let general: string;

const makeService = (userId: string, role: "editor" | "viewer", enabled = true) =>
  createChatService({ workspaceId, userId, role, workspaceKind: "agency", enabled },
    new DrizzleChatRepository({ sub: userId, role: "authenticated" }, workspaceId));
const writer = makeService(editor, "editor");
const reader = makeService(viewer, "viewer");
const send = (body: string) => writer.command({
  kind: "send", workspaceId, conversationId: general, body, retryKey: randomUUID(),
});

describe("Chat: casos de uso y repositorio", () => {
  beforeAll(async () => {
    await db.begin(async (tx) => {
      await tx`insert into public.workspaces (id, name, slug, kind) values (${workspaceId}, 'Agencia', ${workspaceId}, 'agency')`;
      await tx`insert into public.workspace_members (workspace_id, user_id, role)
        values (${workspaceId}, ${randomUUID()}, 'owner'), (${workspaceId}, ${editor}, 'editor'), (${workspaceId}, ${viewer}, 'viewer')`;
    });
    general = await writer.bootstrap(workspaceId);
  });

  afterAll(async () => {
    try {
      await db`delete from public.workspaces where id = ${workspaceId}`;
    } finally {
      await db.end();
    }
  });

  it("comprueba agencia, habilitación y rol antes de cambiar el chat", async () => {
    await expect(makeService(editor, "editor", false).list(workspaceId)).rejects.toThrow("no disponible");
    await expect(writer.list(randomUUID())).rejects.toThrow("no disponible");
    await expect(reader.command({ kind: "createChannel", workspaceId, slug: "tema" })).rejects.toThrow("no disponible");
    await expect(writer.command({ kind: "openDirect", workspaceId, recipientId: viewer })).rejects.toThrow("no disponible");
  });

  it("sincroniza ediciones y retiros, cuenta no leídos y exporta solo mensajes propios vigentes", async () => {
    const { message } = await send("Texto inicial");
    const original = message!;
    expect((await writer.list(workspaceId))[0]?.unread).toBe(false);
    expect((await reader.list(workspaceId))[0]?.unread).toBe(true);

    await writer.command({ kind: "edit", workspaceId, conversationId: general, messageId: original.id, body: "Texto editado" });
    const sync = await reader.sync(workspaceId, general, original.change);
    expect(sync.changes).toMatchObject([{ id: original.id, number: original.number, body: "Texto editado" }]);
    await reader.command({ kind: "read", workspaceId, conversationId: general, through: original.number });
    expect((await reader.list(workspaceId))[0]?.unread).toBe(false);
    expect(await reader.exportOwn(workspaceId)).toEqual([]);
    expect(await writer.exportOwn(workspaceId)).toMatchObject([{ body: "Texto editado" }]);

    await writer.command({ kind: "remove", workspaceId, conversationId: general, messageId: original.id });
    expect((await reader.sync(workspaceId, general, sync.after)).changes).toMatchObject([{ id: original.id, body: null }]);
    expect(await writer.exportOwn(workspaceId)).toEqual([]);
  });

  it("limita el directorio a nombre, rol y presencia dentro de la agencia", async () => {
    try {
      await db`insert into auth.users (id, email, raw_user_meta_data)
        values (${editor}, ${editor + "@example.test"}, '{"display_name":"  Ana   Pérez  "}'::jsonb)`;
      await db`insert into public.user_presence (user_id, status) values (${editor}, 'dnd')`;
      expect((await reader.directory(workspaceId)).find((person) => person.id === editor))
        .toEqual({ id: editor, name: "Ana Pérez", role: "editor", status: "dnd" });
      const outsider = new DrizzleChatRepository({ sub: randomUUID(), role: "authenticated" }, workspaceId);
      expect(await outsider.directory()).toEqual([]);
    } finally {
      await db`delete from auth.users where id = ${editor}`;
    }
  });

  it("pagina por orden del servidor y entrega los cambios faltantes sin saltos", async () => {
    const channel = randomUUID();
    await db.begin(async (tx) => {
      await tx`insert into private.chat_conversations
        (workspace_id, id, kind, slug, last_message_number, last_change_number)
        values (${workspaceId}, ${channel}, 'channel', 'historial', 54, 54)`;
      await tx`insert into private.chat_messages
        (workspace_id, conversation_id, author_id, retry_key, message_number, change_number, body)
        select ${workspaceId}, ${channel}, ${editor}, gen_random_uuid(), n, n, 'Mensaje ' || n
        from generate_series(1, 54) n`;
    });
    const newest = await reader.history(workspaceId, channel);
    expect(newest.messages.map((message) => message.number)).toEqual(Array.from({ length: 50 }, (_, i) => i + 5));
    expect(newest.before).toBe(5);
    expect((await reader.history(workspaceId, channel, newest.before!)).messages.map((message) => message.number)).toEqual([1, 2, 3, 4]);

    const first = await reader.sync(workspaceId, channel, 0);
    expect(first.changes).toHaveLength(50);
    expect(first.hasMore).toBe(true);
    expect((await reader.sync(workspaceId, channel, first.after)).changes.map((message) => message.number)).toEqual([51, 52, 53, 54]);
    expect((await reader.sync(workspaceId, randomUUID(), 0)).conversationAvailable).toBe(false);
  });
});

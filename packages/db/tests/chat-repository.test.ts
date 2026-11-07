import { randomUUID } from "node:crypto";
import { createChatService } from "@hubly/application";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { DrizzleChatRepository } from "../src/repositories/chat";

const db = postgres(process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
const workspaceId = randomUUID();
const owner = randomUUID();
const editor = randomUUID();
const peer = randomUUID();
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

describe("Chat: casos de uso y repositorio", { timeout: 30000 }, () => {
  beforeAll(async () => {
    await db.begin(async (tx) => {
      await tx`insert into public.workspaces (id, name, slug, kind) values (${workspaceId}, 'Agencia', ${workspaceId}, 'agency')`;
      await tx`insert into public.workspace_members (workspace_id, user_id, role)
        values (${workspaceId}, ${owner}, 'owner'), (${workspaceId}, ${editor}, 'editor'), (${workspaceId}, ${peer}, 'editor'), (${workspaceId}, ${viewer}, 'viewer')`;
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

  it("crea, renombra y archiva canales y abre directos desde el repositorio", async () => {
    const admin = createChatService({ workspaceId, userId: owner, role: "owner", workspaceKind: "agency", enabled: true },
      new DrizzleChatRepository({ sub: owner, role: "authenticated" }, workspaceId));
    const { conversationId: channel } = await admin.command({ kind: "createChannel", workspaceId, slug: "campanas" });
    await admin.command({ kind: "renameChannel", workspaceId, conversationId: channel, slug: "produccion" });
    // Antes de #176 llega el código de Postgres; después, el error de aplicación ya traducido.
    await expect(admin.command({ kind: "createChannel", workspaceId, slug: "produccion" })).rejects
      .toSatisfy((error: { reason?: string; cause?: { code?: string } }) => error.reason === "conflict" || error.cause?.code === "23505");
    await admin.command({ kind: "archiveChannel", workspaceId, conversationId: channel });
    const archived = (await admin.list(workspaceId)).find((item) => item.id === channel);
    expect(archived).toMatchObject({ slug: "produccion", archived: true, writable: false });

    const { conversationId: directId } = await writer.command({ kind: "openDirect", workspaceId, recipientId: peer });
    expect((await writer.command({ kind: "openDirect", workspaceId, recipientId: peer })).conversationId).toBe(directId);
    expect((await writer.list(workspaceId)).find((item) => item.id === directId)).toMatchObject({ kind: "direct", peerId: peer, writable: true });
  });

  it("comprueba agencia, habilitación y rol antes de cambiar el chat", async () => {
    await expect(makeService(editor, "editor", false).list(workspaceId)).rejects.toThrow("no disponible");
    await expect(writer.list(randomUUID())).rejects.toThrow("no disponible");
    await expect(reader.command({ kind: "createChannel", workspaceId, slug: "tema" })).rejects.toThrow("no disponible");
    await expect(writer.command({ kind: "openDirect", workspaceId, recipientId: viewer })).rejects.toThrow("no disponible");
  });

  it("sincroniza ediciones y retiros, cuenta no leídos y exporta solo para el owner canales y sus propios directos", async () => {
    const ownerRepo = new DrizzleChatRepository({ sub: owner, role: "authenticated" }, workspaceId);
    const ownerService = createChatService(
      { workspaceId, userId: owner, role: "owner", workspaceKind: "agency", enabled: true },
      ownerRepo,
    );
    const editorRepo = new DrizzleChatRepository({ sub: editor, role: "authenticated" }, workspaceId);

    const { message } = await send("Texto inicial");
    const original = message!;
    expect((await writer.list(workspaceId))[0]?.unread).toBe(false);
    expect((await reader.list(workspaceId))[0]?.unread).toBe(true);

    await writer.command({ kind: "edit", workspaceId, conversationId: general, messageId: original.id, body: "Texto editado" });
    const sync = await reader.sync(workspaceId, general, original.change);
    expect(sync.changes).toMatchObject([{ id: original.id, number: original.number, body: "Texto editado" }]);
    await reader.command({ kind: "read", workspaceId, conversationId: general, through: original.number });
    expect((await reader.list(workspaceId))[0]?.unread).toBe(false);

    const { conversationId: peerDirect } = await writer.command({ kind: "openDirect", workspaceId, recipientId: peer });
    await writer.command({ kind: "send", workspaceId, conversationId: peerDirect, body: "Directo entre editores", retryKey: randomUUID() });

    const { conversationId: ownerDirect } = await ownerService.command({ kind: "openDirect", workspaceId, recipientId: editor });
    await writer.command({ kind: "send", workspaceId, conversationId: ownerDirect, body: "Directo con el owner", retryKey: randomUUID() });

    await expect(reader.exportAgency(workspaceId)).rejects.toThrow("no disponible");
    await expect(writer.exportAgency(workspaceId)).rejects.toThrow("no disponible");
    expect(await editorRepo.agencyExportMessages()).toEqual([]);

    const exported = await ownerService.exportAgency(workspaceId);
    expect(exported.map((entry) => entry.body)).toEqual(["Texto editado", "Directo con el owner"]);
    expect(exported.some((entry) => entry.conversationId === peerDirect)).toBe(false);

    await writer.command({ kind: "remove", workspaceId, conversationId: general, messageId: original.id });
    expect((await reader.sync(workspaceId, general, sync.after)).changes).toMatchObject([{ id: original.id, body: null }]);
    expect((await ownerService.exportAgency(workspaceId)).map((entry) => entry.body)).toEqual(["Directo con el owner"]);
  });

  it("limita el directorio a nombre, rol y presencia dentro de la agencia", async () => {
    try {
      await db`insert into auth.users (id, email, raw_user_meta_data)
        values (${editor}, ${editor + "@example.test"}, '{"display_name":"  Ana   Pérez  "}'::jsonb)`;
      await db`insert into public.user_presence (user_id, status) values (${editor}, 'dnd')`;
      expect((await reader.directory(workspaceId)).find((person) => person.id === editor))
        .toEqual({ id: editor, name: "Ana Pérez", role: "editor", status: "dnd", hasAvatar: false });
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

  it("guarda citas, hilos, reacciones agregadas, escribiendo y menciones sin leer", async () => {
    const colleague = makeService(peer, "editor");
    // La prueba de paginación inserta 54 mensajes del editor en el último minuto: la raíz la escribe otra persona.
    const root = (await colleague.command({ kind: "send", workspaceId, conversationId: general, retryKey: randomUUID(), body: "Raíz del hilo" })).message!;
    const quoted = (await colleague.command({
      kind: "send", workspaceId, conversationId: general, retryKey: randomUUID(), body: "Te cito, @Ana",
      replyToId: root.id, mentionedUserIds: [editor],
    })).message!;
    expect(quoted).toMatchObject({ replyToId: root.id, threadRootId: null, reactions: [] });
    const threadReply = (await colleague.command({
      kind: "send", workspaceId, conversationId: general, retryKey: randomUUID(), body: "Respuesta en hilo", threadRootId: root.id,
    })).message!;
    expect(threadReply.threadRootId).toBe(root.id);

    const main = await writer.history(workspaceId, general);
    expect(main.messages.some((entry) => entry.id === threadReply.id)).toBe(false);
    expect(main.messages.find((entry) => entry.id === root.id)).toMatchObject({ threadReplyCount: 1 });
    expect(main.messages.find((entry) => entry.id === root.id)?.threadLastReplyAt).toEqual(expect.any(String));
    // Leer hasta el último mensaje principal deja la conversación leída aunque la respuesta de hilo tenga un número mayor.
    expect(threadReply.number).toBeGreaterThan(quoted.number);
    await writer.command({ kind: "read", workspaceId, conversationId: general, through: quoted.number });
    expect((await writer.list(workspaceId)).find((entry) => entry.id === general)?.unread).toBe(false);
    expect((await writer.history(workspaceId, general, undefined, root.id)).messages.map((entry) => entry.id)).toEqual([threadReply.id]);

    const before = (await writer.history(workspaceId, general)).conversation.changeCursor;
    expect(await writer.command({ kind: "toggleReaction", workspaceId, conversationId: general, messageId: root.id, emoji: "👍" }))
      .toMatchObject({ added: true });
    await colleague.command({ kind: "toggleReaction", workspaceId, conversationId: general, messageId: root.id, emoji: "👍" });
    await colleague.command({ kind: "toggleReaction", workspaceId, conversationId: general, messageId: root.id, emoji: "🎉" });
    const expected = [{ emoji: "👍", count: 2, userIds: [editor, peer] }, { emoji: "🎉", count: 1, userIds: [peer] }];
    const reacted = await reader.sync(workspaceId, general, before);
    expect(reacted.changes.find((entry) => entry.id === root.id)?.reactions).toEqual(expected);
    expect(reacted.reactions?.[root.id]).toEqual(expected);
    expect(await writer.command({ kind: "toggleReaction", workspaceId, conversationId: general, messageId: root.id, emoji: "👍" }))
      .toMatchObject({ added: false });
    await expect(writer.command({ kind: "toggleReaction", workspaceId, conversationId: general, messageId: root.id, emoji: "ab" }))
      .rejects.toMatchObject({ reason: "invalid" });
    await expect(reader.command({ kind: "toggleReaction", workspaceId, conversationId: general, messageId: root.id, emoji: "👍" }))
      .rejects.toThrow("no disponible");

    expect((await colleague.command({ kind: "typing", workspaceId, conversationId: general })).expiresAt).toEqual(expect.any(String));
    await expect(colleague.command({ kind: "typing", workspaceId, conversationId: general })).rejects.toMatchObject({ reason: "rate-limit" });
    expect((await writer.sync(workspaceId, general, 0)).typingUserIds).toEqual([peer]);
    expect((await colleague.sync(workspaceId, general, 0)).typingUserIds).toEqual([]);

    expect((await writer.sync(workspaceId, undefined, 0)).unreadMentions).toMatchObject([{ messageId: quoted.id, conversationId: general }]);
    expect(await reader.command({ kind: "markMentionsRead", workspaceId, conversationId: general })).toMatchObject({ cleared: 0 });
    expect(await writer.command({ kind: "markMentionsRead", workspaceId, conversationId: general, upToNumber: quoted.number }))
      .toMatchObject({ cleared: 1 });
    expect((await writer.sync(workspaceId, general, 0)).unreadMentions).toEqual([]);
  });

  it("indica qué compañeros tienen foto en el directorio", async () => {
    await db`insert into storage.objects (bucket_id, name) values ('user-avatars', ${peer + "/foto"})`;
    try {
      const people = await writer.directory(workspaceId);
      expect(people.find((person) => person.id === peer)?.hasAvatar).toBe(true);
      expect(people.find((person) => person.id === viewer)?.hasAvatar).toBe(false);
    } finally {
      await db.begin(async (tx) => {
        await tx`select set_config('storage.allow_delete_query', 'true', true)`;
        await tx`delete from storage.objects where bucket_id = 'user-avatars' and name = ${peer + "/foto"}`;
      });
    }
  });
});

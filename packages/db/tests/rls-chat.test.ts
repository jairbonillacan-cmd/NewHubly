import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = postgres(process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
const agency = randomUUID();
const otherAgency = randomUUID();
const personal = randomUUID();
const owner = randomUUID();
const admin = randomUUID();
const editor = randomUUID();
const peer = randomUUID();
const viewer = randomUUID();
const outsider = randomUUID();
const general = randomUUID();
const direct = randomUUID();
const channelMsg = randomUUID();
const directMsg = randomUUID();
const personalChannel = randomUUID();
const [memberLow, memberHigh] = editor < peer ? [editor, peer] as const : [peer, editor] as const;
const spaces = [agency, otherAgency, personal];

function asMember<T>(userId: string, query: (tx: postgres.TransactionSql) => Promise<T>) {
  return db.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    return await query(tx);
  });
}

describe("Chat: aislamiento en Postgres", { timeout: 30000 }, () => {
  beforeAll(async () => {
    await db.begin(async (tx) => {
      await tx`insert into public.workspaces (id, name, slug, kind) values
        (${agency}, 'Agencia de chat', ${agency}, 'agency'),
        (${otherAgency}, 'Otra agencia', ${otherAgency}, 'agency'),
        (${personal}, 'Espacio personal', ${personal}, 'personal')`;
      await tx`insert into public.workspace_members (workspace_id, user_id, role) values
        (${agency}, ${owner}, 'owner'), (${agency}, ${admin}, 'admin'),
        (${agency}, ${editor}, 'editor'), (${agency}, ${peer}, 'editor'),
        (${agency}, ${viewer}, 'viewer'), (${otherAgency}, ${outsider}, 'owner'),
        (${personal}, ${owner}, 'owner')`;
      await tx`insert into private.chat_conversations (workspace_id, id, kind, slug, last_message_number, last_change_number) values
        (${agency}, ${general}, 'channel', 'general', 1, 1),
        (${personal}, ${personalChannel}, 'channel', 'general', 0, 0)`;
      await tx`insert into private.chat_conversations (workspace_id, id, kind, member_low, member_high, last_message_number, last_change_number)
        values (${agency}, ${direct}, 'direct', ${memberLow}, ${memberHigh}, 1, 1)`;
      await tx`insert into private.chat_messages (workspace_id, conversation_id, id, author_id, retry_key, message_number, change_number, body)
        values (${agency}, ${general}, ${channelMsg}, ${editor}, ${randomUUID()}, 1, 1, 'Mensaje de canal'),
        (${agency}, ${direct}, ${directMsg}, ${editor}, ${randomUUID()}, 1, 1, 'Mensaje directo')`;
      await tx`insert into private.chat_reads (workspace_id, conversation_id, user_id, message_number)
        values (${agency}, ${general}, ${viewer}, 1), (${agency}, ${direct}, ${editor}, 1)`;
      await tx`insert into private.chat_reactions (workspace_id, conversation_id, message_id, user_id, emoji)
        values (${agency}, ${general}, ${channelMsg}, ${editor}, '👍'), (${agency}, ${direct}, ${directMsg}, ${editor}, '🔥')`;
      await tx`insert into private.chat_mentions (workspace_id, conversation_id, message_id, mentioned_user_id)
        values (${agency}, ${general}, ${channelMsg}, ${viewer}), (${agency}, ${direct}, ${directMsg}, ${peer})`;
      await tx`insert into private.chat_typing (workspace_id, conversation_id, user_id, updated_at, expires_at)
        values (${agency}, ${general}, ${editor}, now(), now() + interval '6 seconds'),
        (${agency}, ${direct}, ${editor}, now(), now() + interval '6 seconds')`;
    });
  });

  afterAll(async () => {
    try {
      await db`delete from public.workspaces where id in ${db(spaces)}`;
    } finally {
      await db.end();
    }
  });

  it("fuerza RLS en las seis tablas y reserva escrituras para operaciones controladas", async () => {
    const tables = ["chat_conversations", "chat_messages", "chat_reads", "chat_reactions", "chat_mentions", "chat_typing"];
    const rows = await db`select relname, relrowsecurity, relforcerowsecurity,
      has_table_privilege('anon', oid, 'select') as anonymous_read,
      has_table_privilege('authenticated', oid, 'insert,update,delete') as direct_write
      from pg_class where relnamespace = 'private'::regnamespace and relname in ${db(tables)}`;
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row).toMatchObject({
        relrowsecurity: true, relforcerowsecurity: true, anonymous_read: false, direct_write: false,
      });
    }
  });

  it("deja al visor leer canales, reacciones, menciones, escritura y su cursor, y oculta datos a otra agencia", async () => {
    expect(await asMember(viewer, async (tx) => {
      const messages = await tx`select body from private.chat_messages where workspace_id = ${agency}`;
      const cursors = await tx`select user_id from private.chat_reads where workspace_id = ${agency}`;
      const reactions = await tx`select emoji from private.chat_reactions where workspace_id = ${agency}`;
      const mentions = await tx`select mentioned_user_id from private.chat_mentions where workspace_id = ${agency}`;
      const typing = await tx`select conversation_id from private.chat_typing where workspace_id = ${agency}`;
      return { messages: [...messages], cursors: [...cursors], reactions: [...reactions], mentions: [...mentions], typing: [...typing] };
    })).toEqual({
      messages: [{ body: "Mensaje de canal" }], cursors: [{ user_id: viewer }],
      reactions: [{ emoji: "👍" }], mentions: [{ mentioned_user_id: viewer }], typing: [{ conversation_id: general }],
    });
    for (const table of ["chat_conversations", "chat_reactions", "chat_mentions", "chat_typing"]) {
      expect(await asMember(outsider, (tx) => tx`select 1 from ${tx("private." + table)} where workspace_id = ${agency}`)).toHaveLength(0);
    }
    expect(await asMember(owner, (tx) => tx`select id from private.chat_conversations where workspace_id = ${personal}`)).toHaveLength(0);
  });

  it("reserva los directos (mensajes, reacciones, menciones y escribiendo) para los participantes", async () => {
    await Promise.all([owner, admin, viewer, outsider].map(async (nonParticipant) => {
      expect(await asMember(nonParticipant, async (tx) => [
        ...(await tx`select body from private.chat_messages where conversation_id = ${direct}`),
        ...(await tx`select member_low from private.chat_conversations where id = ${direct}`),
        ...(await tx`select emoji from private.chat_reactions where conversation_id = ${direct}`),
        ...(await tx`select mentioned_user_id from private.chat_mentions where conversation_id = ${direct}`),
        ...(await tx`select user_id from private.chat_typing where conversation_id = ${direct}`),
      ])).toHaveLength(0);
    }));
    expect(await asMember(peer, async (tx) => ({
      messages: [...(await tx`select body from private.chat_messages where conversation_id = ${direct}`)],
      reactions: [...(await tx`select emoji from private.chat_reactions where conversation_id = ${direct}`)],
      mentions: [...(await tx`select mentioned_user_id from private.chat_mentions where conversation_id = ${direct}`)],
      typing: [...(await tx`select user_id from private.chat_typing where conversation_id = ${direct}`)],
      reads: [...(await tx`select user_id from private.chat_reads where conversation_id = ${direct}`)],
    }))).toEqual({
      messages: [{ body: "Mensaje directo" }],
      reactions: [{ emoji: "🔥" }],
      mentions: [{ mentioned_user_id: peer }],
      typing: [{ user_id: editor }],
      reads: [],
    });
  });

  it("revoca acceso tras bajar el rol o salir de la agencia", async () => {
    await db`update public.workspace_members set role = 'viewer' where workspace_id = ${agency} and user_id = ${peer}`;
    try {
      expect(await asMember(peer, (tx) => tx`select body from private.chat_messages where conversation_id = ${direct}`)).toHaveLength(0);
      expect(await asMember(peer, (tx) => tx`select body from private.chat_messages where conversation_id = ${general}`)).toHaveLength(1);
      await db`delete from public.workspace_members where workspace_id = ${agency} and user_id = ${peer}`;
      expect(await asMember(peer, (tx) => tx`select body from private.chat_messages where workspace_id = ${agency}`)).toHaveLength(0);
      expect(await asMember(editor, (tx) => tx`select body from private.chat_messages where conversation_id = ${direct}`)).toHaveLength(1);
    } finally {
      await db`insert into public.workspace_members (workspace_id, user_id, role) values (${agency}, ${peer}, 'editor')
        on conflict (workspace_id, user_id) do update set role = excluded.role`;
    }
  });

  it("rechaza cruce de conversación/agencia, duplicados de directo y emojis inválidos en tabla", async () => {
    await expect(db`insert into private.chat_messages (workspace_id, conversation_id, author_id, retry_key, message_number, change_number, body)
      values (${otherAgency}, ${general}, ${outsider}, ${randomUUID()}, 2, 2, 'Cruce de agencia')`).rejects.toMatchObject({ code: "23503" });
    await expect(db`insert into private.chat_messages (workspace_id, conversation_id, author_id, retry_key, message_number, change_number, body, reply_to_id)
      values (${agency}, ${general}, ${editor}, ${randomUUID()}, 2, 2, 'Cita de directo en canal', ${directMsg})`).rejects.toMatchObject({ code: "23503" });
    await expect(db`insert into private.chat_conversations (workspace_id, kind, member_low, member_high)
      values (${agency}, 'direct', ${memberLow}, ${memberHigh})`).rejects.toMatchObject({ code: "23505" });
    for (const invalidEmoji of ["", "ok", "👍👍", "👨‍👩‍👧‍👦"]) {
      await expect(db`insert into private.chat_reactions (workspace_id, conversation_id, message_id, user_id, emoji)
        values (${agency}, ${general}, ${channelMsg}, ${editor}, ${invalidEmoji})`).rejects.toMatchObject({ code: "23514" });
    }
  });
});

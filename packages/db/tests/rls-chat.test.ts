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

describe("Chat: aislamiento en Postgres", () => {
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
      await tx`insert into private.chat_messages (workspace_id, conversation_id, author_id, retry_key, message_number, change_number, body)
        values (${agency}, ${general}, ${editor}, ${randomUUID()}, 1, 1, 'Mensaje de canal'),
        (${agency}, ${direct}, ${editor}, ${randomUUID()}, 1, 1, 'Mensaje directo')`;
      await tx`insert into private.chat_reads (workspace_id, conversation_id, user_id, message_number)
        values (${agency}, ${general}, ${viewer}, 1), (${agency}, ${direct}, ${editor}, 1)`;
    });
  });

  afterAll(async () => {
    try {
      await db`delete from public.workspaces where id in ${db(spaces)}`;
    } finally {
      await db.end();
    }
  });

  it("fuerza RLS en las tres tablas y reserva escrituras para operaciones controladas", async () => {
    const tables = ["chat_conversations", "chat_messages", "chat_reads"];
    const rows = await db`select relname, relrowsecurity, relforcerowsecurity,
      has_table_privilege('anon', oid, 'select') as anonymous_read,
      has_table_privilege('authenticated', oid, 'insert,update,delete') as direct_write
      from pg_class where relnamespace = 'private'::regnamespace and relname in ${db(tables)}`;
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toMatchObject({
        relrowsecurity: true, relforcerowsecurity: true, anonymous_read: false, direct_write: false,
      });
    }
  });

  it("deja al visor leer canales y su cursor y oculta los datos a otra agencia", async () => {
    expect(await asMember(viewer, async (tx) => {
      const messages = await tx`select body from private.chat_messages where workspace_id = ${agency}`;
      const cursors = await tx`select user_id from private.chat_reads where workspace_id = ${agency}`;
      return { messages: [...messages], cursors: [...cursors] };
    })).toEqual({ messages: [{ body: "Mensaje de canal" }], cursors: [{ user_id: viewer }] });
    expect(await asMember(outsider, (tx) => tx`select id from private.chat_conversations where workspace_id = ${agency}`)).toHaveLength(0);
    expect(await asMember(owner, (tx) => tx`select id from private.chat_conversations where workspace_id = ${personal}`)).toHaveLength(0);
  });

  it("reserva los directos para los participantes y los cursores para sus dueños", async () => {
    for (const nonParticipant of [owner, admin, viewer, outsider]) {
      expect(await asMember(nonParticipant, (tx) => tx`select body from private.chat_messages where conversation_id = ${direct}`)).toHaveLength(0);
      expect(await asMember(nonParticipant, (tx) => tx`select member_low, member_high from private.chat_conversations where id = ${direct}`)).toHaveLength(0);
    }
    expect(await asMember(peer, (tx) => tx`select body from private.chat_messages where conversation_id = ${direct}`))
      .toEqual([{ body: "Mensaje directo" }]);
    expect(await asMember(peer, (tx) => tx`select user_id from private.chat_reads where conversation_id = ${direct}`)).toHaveLength(0);
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

  it("rechaza el cruce de agencia y la repetición de un directo para la misma pareja", async () => {
    await expect(db`insert into private.chat_messages (workspace_id, conversation_id, author_id, retry_key, message_number, change_number, body)
      values (${otherAgency}, ${general}, ${outsider}, ${randomUUID()}, 2, 2, 'Cruce de agencia')`).rejects.toMatchObject({ code: "23503" });
    await expect(db`insert into private.chat_conversations (workspace_id, kind, member_low, member_high)
      values (${agency}, 'direct', ${memberLow}, ${memberHigh})`).rejects.toMatchObject({ code: "23505" });
  });
});

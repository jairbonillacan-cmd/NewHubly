import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const db = postgres(process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
const workspaces: string[] = [];
const owner = randomUUID();
const editor = randomUUID();
const peer = randomUUID();
const viewer = randomUUID();
const stranger = randomUUID();

function asMember<T>(id: string, run: (tx: postgres.TransactionSql) => Promise<T>) {
  return db.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: id, role: "authenticated" })}, true),
      set_config('request.jwt.claim.sub', ${id}, true)`;
    return await run(tx);
  });
}

async function makeAgency() {
  const agency = randomUUID();
  workspaces.push(agency);
  await db.begin(async (tx) => {
    await tx`insert into public.workspaces (id, name, slug, kind) values (${agency}, 'Prueba de chat', ${agency}, 'agency')`;
    await tx`insert into public.workspace_members (workspace_id, user_id, role) values
      (${agency}, ${owner}, 'owner'), (${agency}, ${editor}, 'editor'),
      (${agency}, ${peer}, 'editor'), (${agency}, ${viewer}, 'viewer')`;
  });
  return agency;
}

function general(agency: string, user = viewer) {
  return asMember(user, async (tx) => (await tx<{ id: string }[]>`select private.chat_ensure_general(${agency}) as id`)[0]!.id);
}

function direct(agency: string, user: string, recipient: string) {
  return asMember(user, async (tx) => (await tx<{ id: string }[]>`select private.chat_open_direct(${agency}, ${recipient}) as id`)[0]!.id);
}

function send(agency: string, conversation: string, user: string, body: string, key = randomUUID()) {
  return asMember(user, async (tx) => (await tx<{ id: string }[]>`select private.chat_send_message(${agency}, ${conversation}, ${key}, ${body}) as id`)[0]!.id);
}

afterAll(async () => {
  try {
    if (workspaces.length) await db`delete from public.workspaces where id in ${db(workspaces)}`;
  } finally {
    await db.end();
  }
});

describe("Chat: operaciones transaccionales", { timeout: 30000 }, () => {
  it("crea un solo general y protege creación, renombre y archivado", async () => {
    const agency = await makeAgency();
    const [channel, sameChannel] = await Promise.all([general(agency), general(agency, editor)]);
    expect(channel).toBe(sameChannel);
    await expect(general(agency, stranger)).rejects.toMatchObject({ code: "42501" });
    await expect(asMember(editor, (tx) => tx`select private.chat_manage_channel(${agency}, null, 'campanas', false)`))
      .rejects.toMatchObject({ code: "42501" });
    await expect(asMember(owner, (tx) => tx`select private.chat_manage_channel(${agency}, ${channel}, null, true)`))
      .rejects.toMatchObject({ code: "42501" });

    const topic = await asMember(owner, async (tx) => (await tx<{ id: string }[]>`
      select private.chat_manage_channel(${agency}, null, 'campanas', false) as id`)[0]!.id);
    await asMember(owner, (tx) => tx`select private.chat_manage_channel(${agency}, ${topic}, 'produccion', false)`);
    await send(agency, topic, editor, "Historial conservado");
    await asMember(owner, (tx) => tx`select private.chat_manage_channel(${agency}, ${topic}, null, true)`);
    await expect(send(agency, topic, editor, "No se escribe")).rejects.toMatchObject({ code: "42501" });
    expect(await asMember(viewer, (tx) => tx`select c.slug, m.body from private.chat_conversations c
      join private.chat_messages m on m.workspace_id = c.workspace_id and m.conversation_id = c.id
      where c.workspace_id = ${agency} and c.id = ${topic}`))
      .toEqual([{ slug: "produccion", body: "Historial conservado" }]);
  });

  it("abre un directo único por pareja y bloquea escrituras después de revocar a un participante", async () => {
    const agency = await makeAgency();
    const [id, reversed] = await Promise.all([direct(agency, editor, peer), direct(agency, peer, editor)]);
    expect(id).toBe(reversed);
    await expect(direct(agency, editor, viewer)).rejects.toMatchObject({ code: "42501" });
    await expect(direct(agency, editor, stranger)).rejects.toMatchObject({ code: "42501" });
    await expect(direct(agency, editor, editor)).rejects.toMatchObject({ code: "22023" });
    await expect(send(agency, id, owner, "Administrador ajeno")).rejects.toMatchObject({ code: "42501" });
    await send(agency, id, editor, "Primer directo");
    await db`delete from public.workspace_members where workspace_id = ${agency} and user_id = ${peer}`;
    await expect(send(agency, id, editor, "Destinatario revocado")).rejects.toMatchObject({ code: "42501" });
    await expect(asMember(peer, (tx) => tx`select private.chat_mark_read(${agency}, ${id}, 1)`))
      .rejects.toMatchObject({ code: "42501" });
    expect(await asMember(editor, (tx) => tx`select body from private.chat_messages where conversation_id = ${id}`))
      .toEqual([{ body: "Primer directo" }]);
  });

  it("deduplica reintentos concurrentes, asigna orden y conserva la posición al editar o retirar", async () => {
    const agency = await makeAgency();
    const id = await general(agency);
    const key = randomUUID();
    const [first, retry, second] = await Promise.all([
      send(agency, id, editor, "Un mensaje", key),
      send(agency, id, editor, "Un mensaje", key),
      send(agency, id, peer, "Otro mensaje"),
    ]);
    expect(retry).toBe(first);
    expect(second).not.toBe(first);
    await expect(send(agency, id, viewer, "Visor sin escritura")).rejects.toMatchObject({ code: "42501" });
    await expect(asMember(peer, (tx) => tx`select private.chat_change_message(${agency}, ${id}, ${first}, 'Ajeno')`))
      .rejects.toMatchObject({ code: "42501" });
    await asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${id}, ${first}, 'Editado')`);
    const [edited] = await db`select message_number, change_number, body from private.chat_messages where id = ${first}`;
    expect(edited).toMatchObject({ change_number: 3, body: "Editado" });
    await asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${id}, ${first}, null)`);
    expect((await db`select message_number, change_number, body from private.chat_messages where id = ${first}`)[0])
      .toMatchObject({ message_number: edited?.message_number, change_number: 4, body: null });
    await expect(asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${id}, ${first}, 'Restaurado')`))
      .rejects.toMatchObject({ code: "42501" });

    await asMember(viewer, (tx) => tx`select private.chat_mark_read(${agency}, ${id}, 2)`);
    await asMember(viewer, (tx) => tx`select private.chat_mark_read(${agency}, ${id}, 1)`);
    expect(await asMember(viewer, (tx) => tx`select message_number from private.chat_reads where conversation_id = ${id}`))
      .toEqual([{ message_number: 2 }]);
    await expect(asMember(viewer, (tx) => tx`select private.chat_mark_read(${agency}, ${id}, 3)`))
      .rejects.toMatchObject({ code: "22023" });
  });

  it("no revela si existe una conversación ajena y limita ediciones seguidas del mismo mensaje", async () => {
    const agency = await makeAgency();
    const id = await general(agency);
    const failures = await Promise.all([
      send(agency, id, stranger, "Intruso").catch((error: { code?: string; message?: string }) => error),
      send(agency, randomUUID(), stranger, "Intruso").catch((error: { code?: string; message?: string }) => error),
      send(agency, randomUUID(), editor, "Inexistente").catch((error: { code?: string; message?: string }) => error),
    ]);
    for (const failure of failures) expect(failure).toMatchObject({ code: "42501", message: "Conversación no disponible" });

    const message = await send(agency, id, editor, "Original");
    await asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${id}, ${message}, 'Primera edición')`);
    await expect(asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${id}, ${message}, 'Ráfaga')`))
      .rejects.toMatchObject({ code: "P0429" });
    await new Promise((resolve) => setTimeout(resolve, 2100));
    await asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${id}, ${message}, 'Tras la espera')`);
    await asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${id}, ${message}, null)`);
    expect((await db`select body from private.chat_messages where id = ${message}`)[0]).toMatchObject({ body: null });
  });

  it("aplica la cuota en toda la agencia y permite reintentar un envío ya guardado", async () => {
    const agency = await makeAgency();
    const id = await general(agency);
    const other = await direct(agency, editor, peer);
    const key = randomUUID();
    const first = await send(agency, id, editor, "Primero", key);
    await Promise.all(Array.from({ length: 29 }, () => send(agency, other, editor, "Dentro de la cuota")));
    await expect(send(agency, id, editor, "Excede la cuota")).rejects.toMatchObject({ code: "P0429" });
    expect(await send(agency, id, editor, "Primero", key)).toBe(first);
    await expect(send(agency, id, peer, "Cuota de otra persona")).resolves.toEqual(expect.any(String));
  });

  it("gestiona citas, hilos sin anidación de segundo nivel y actualiza contadores al responder o retirar", async () => {
    const agency = await makeAgency();
    const channel = await general(agency);
    const other = await direct(agency, editor, peer);
    const root = await send(agency, channel, editor, "Mensaje raíz");
    const otherMsg = await send(agency, other, editor, "En otra conversación");

    await expect(asMember(peer, (tx) => tx`select private.chat_send_message(${agency}, ${channel}, ${randomUUID()}, 'Cita ajena', ${otherMsg})`)).rejects.toMatchObject({ code: "22023" });
    await expect(asMember(peer, (tx) => tx`select private.chat_send_message(${agency}, ${channel}, ${randomUUID()}, 'Hilo ajeno', null, ${otherMsg})`)).rejects.toMatchObject({ code: "22023" });

    const reply1 = await asMember(peer, async (tx) => (await tx<{ id: string }[]>`select private.chat_send_message(${agency}, ${channel}, ${randomUUID()}, 'Primera respuesta', ${root}, ${root}) as id`)[0]!.id);
    const reply2 = await asMember(editor, async (tx) => (await tx<{ id: string }[]>`select private.chat_send_message(${agency}, ${channel}, ${randomUUID()}, 'Segunda respuesta', ${reply1}, ${root}) as id`)[0]!.id);
    await expect(asMember(editor, (tx) => tx`select private.chat_send_message(${agency}, ${channel}, ${randomUUID()}, 'Subhilo prohibido', null, ${reply1})`)).rejects.toMatchObject({ code: "22023" });

    expect((await db`select thread_reply_count, thread_last_reply_at is not null as has_last, change_number from private.chat_messages where id = ${root}`)[0])
      .toMatchObject({ thread_reply_count: 2, has_last: true, change_number: 4 });
    await asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${channel}, ${reply2}, null)`);
    expect((await db`select thread_reply_count, thread_last_reply_at is not null as has_last, change_number from private.chat_messages where id = ${root}`)[0])
      .toMatchObject({ thread_reply_count: 1, has_last: true, change_number: 7 });
    await asMember(peer, (tx) => tx`select private.chat_change_message(${agency}, ${channel}, ${reply1}, null)`);
    expect((await db`select thread_reply_count, thread_last_reply_at from private.chat_messages where id = ${root}`)[0])
      .toMatchObject({ thread_reply_count: 0, thread_last_reply_at: null });
    await asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${channel}, ${root}, null)`);
    await expect(asMember(peer, (tx) => tx`select private.chat_send_message(${agency}, ${channel}, ${randomUUID()}, 'En raíz retirada', null, ${root})`)).rejects.toMatchObject({ code: "22023" });
    await expect(asMember(peer, (tx) => tx`select private.chat_send_message(${agency}, ${channel}, ${randomUUID()}, 'Citando retirada', ${root})`)).rejects.toMatchObject({ code: "22023" });
  });

  it("alterna reacciones con validación de emoji, limpia al retirar y aplica cuota por minuto", async () => {
    const agency = await makeAgency();
    const channel = await general(agency);
    const msg = await send(agency, channel, editor, "Mensaje para reaccionar");

    for (const emoji of ["👍🏽", "❤️", "👩‍💻", "🇲🇽"]) {
      expect((await asMember(peer, (tx) => tx<{ ok: boolean }[]>`select private.chat_toggle_reaction(${agency}, ${channel}, ${msg}, ${emoji}) as ok`))[0]!.ok).toBe(true);
    }
    expect((await asMember(peer, (tx) => tx<{ ok: boolean }[]>`select private.chat_toggle_reaction(${agency}, ${channel}, ${msg}, '❤️') as ok`))[0]!.ok).toBe(false);
    expect(await asMember(viewer, (tx) => tx`select emoji from private.chat_reactions where message_id = ${msg} order by emoji`))
      .toEqual([{ emoji: "🇲🇽" }, { emoji: "👍🏽" }, { emoji: "👩‍💻" }]);
    for (const bad of ["", "a", " ", "👍👍", "👍a", "👨‍👩‍👧‍👦"]) {
      await expect(asMember(peer, (tx) => tx`select private.chat_toggle_reaction(${agency}, ${channel}, ${msg}, ${bad})`)).rejects.toMatchObject({ code: "22023" });
    }
    await asMember(editor, (tx) => tx`select private.chat_toggle_reaction(${agency}, ${channel}, ${msg}, '🔥') from generate_series(1, 60)`);
    await expect(asMember(editor, (tx) => tx`select private.chat_toggle_reaction(${agency}, ${channel}, ${msg}, '🔥')`)).rejects.toMatchObject({ code: "P0429" });

    await asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${channel}, ${msg}, null)`);
    expect(await db`select 1 from private.chat_reactions where message_id = ${msg}`).toHaveLength(0);
    await expect(asMember(peer, (tx) => tx`select private.chat_toggle_reaction(${agency}, ${channel}, ${msg}, '👍')`)).rejects.toMatchObject({ code: "42501" });
  });

  it("valida pertenencia de menciones, marca leídas con cuota y controla estado escribiendo (3s/6s) sin filtrar existencia", async () => {
    const agency = await makeAgency();
    const channel = await general(agency);
    const dm = await direct(agency, editor, peer);

    await expect(asMember(editor, (tx) => tx`select private.chat_send_message(${agency}, ${channel}, ${randomUUID()}, 'Intruso', null, null, ${[stranger]}::uuid[])`)).rejects.toMatchObject({ code: "22023" });
    await expect(asMember(editor, (tx) => tx`select private.chat_send_message(${agency}, ${dm}, ${randomUUID()}, 'Fuera del directo', null, null, ${[owner]}::uuid[])`)).rejects.toMatchObject({ code: "22023" });

    const m1 = (await asMember(editor, (tx) => tx<{ id: string }[]>`select private.chat_send_message(${agency}, ${channel}, ${randomUUID()}, 'Hola @visor y @par', null, null, ${[viewer, peer, viewer]}::uuid[]) as id`))[0]!.id;
    const m2 = (await asMember(editor, (tx) => tx<{ id: string }[]>`select private.chat_send_message(${agency}, ${channel}, ${randomUUID()}, 'Segunda mención', null, null, ${[viewer]}::uuid[]) as id`))[0]!.id;
    expect(await asMember(viewer, (tx) => tx`select message_id from private.chat_mentions where mentioned_user_id = ${viewer} and read_at is null`)).toHaveLength(2);

    expect((await asMember(viewer, (tx) => tx<{ c: number }[]>`select private.chat_mark_mentions_read(${agency}, ${channel}, 1) as c`))[0]!.c).toBe(1);
    await asMember(editor, (tx) => tx`select private.chat_change_message(${agency}, ${channel}, ${m2}, null)`);
    expect(await db`select 1 from private.chat_mentions where message_id = ${m2}`).toHaveLength(0);
    expect(await db`select 1 from private.chat_mentions where message_id = ${m1} and mentioned_user_id = ${viewer} and read_at is not null`).toHaveLength(1);

    await asMember(viewer, (tx) => tx`select private.chat_mark_mentions_read(${agency}, ${channel}) from generate_series(1, 59)`);
    await expect(asMember(viewer, (tx) => tx`select private.chat_mark_mentions_read(${agency}, ${channel})`)).rejects.toMatchObject({ code: "P0429" });

    const [expRow] = await asMember(editor, (tx) => tx<{ exp: Date }[]>`select private.chat_set_typing(${agency}, ${channel}) as exp`);
    const [typingRow] = await db<{ diff: number }[]>`select extract(epoch from (expires_at - updated_at))::int as diff from private.chat_typing where workspace_id = ${agency} and conversation_id = ${channel} and user_id = ${editor}`;
    expect(expRow?.exp).toBeInstanceOf(Date);
    expect(typingRow?.diff).toBe(6);
    await expect(asMember(editor, (tx) => tx`select private.chat_set_typing(${agency}, ${channel})`)).rejects.toMatchObject({ code: "P0429" });

    const denied = await Promise.all([
      asMember(stranger, (tx) => tx`select private.chat_toggle_reaction(${agency}, ${channel}, ${m1}, '👍')`).catch((e: unknown) => e),
      asMember(viewer, (tx) => tx`select private.chat_toggle_reaction(${agency}, ${channel}, ${m1}, '👍')`).catch((e: unknown) => e),
      asMember(owner, (tx) => tx`select private.chat_toggle_reaction(${agency}, ${dm}, ${m1}, '👍')`).catch((e: unknown) => e),
      asMember(editor, (tx) => tx`select private.chat_toggle_reaction(${agency}, ${randomUUID()}, ${m1}, '👍')`).catch((e: unknown) => e),
      asMember(stranger, (tx) => tx`select private.chat_set_typing(${agency}, ${channel})`).catch((e: unknown) => e),
      asMember(viewer, (tx) => tx`select private.chat_set_typing(${agency}, ${channel})`).catch((e: unknown) => e),
      asMember(owner, (tx) => tx`select private.chat_set_typing(${agency}, ${dm})`).catch((e: unknown) => e),
      asMember(editor, (tx) => tx`select private.chat_set_typing(${agency}, ${randomUUID()})`).catch((e: unknown) => e),
      asMember(stranger, (tx) => tx`select private.chat_mark_mentions_read(${agency}, ${channel})`).catch((e: unknown) => e),
      asMember(viewer, (tx) => tx`select private.chat_mark_mentions_read(${agency}, ${dm})`).catch((e: unknown) => e),
      asMember(owner, (tx) => tx`select private.chat_mark_mentions_read(${agency}, ${dm})`).catch((e: unknown) => e),
      asMember(viewer, (tx) => tx`select private.chat_mark_mentions_read(${agency}, ${randomUUID()})`).catch((e: unknown) => e),
    ]);
    for (const err of denied) expect(err).toMatchObject({ code: "42501", message: "Conversación no disponible" });
  });
});

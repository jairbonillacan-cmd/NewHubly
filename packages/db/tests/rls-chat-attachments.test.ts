import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { withUserContext } from "../src/context";
import { getDb } from "../src/internal";

describe("Chat: adjuntos en bucket privado, cuarentena y retiro inmediato (Issue 205, ADR 0012)", { timeout: 30000 }, () => {
  const db = getDb(), runId = Math.random().toString(36).slice(2, 10);
  const agency = crypto.randomUUID(), otherAgency = crypto.randomUUID();
  const owner = crypto.randomUUID(), editor = crypto.randomUUID(), third = crypto.randomUUID(), viewer = crypto.randomUUID(), outsider = crypto.randomUUID();
  const as = <T extends Record<string, unknown>>(sub: string, query: ReturnType<typeof sql>) =>
    withUserContext({ sub, role: "authenticated" }, (tx) => tx.execute<T>(query));

  beforeAll(async () => {
    for (const id of [owner, editor, third, viewer, outsider]) {
      await db.execute(sql`insert into auth.users (id, email, email_confirmed_at) values (${id}::uuid, ${`${id}-${runId}@test.local`}, now())`);
    }
    await db.execute(sql`insert into public.workspaces (id, name, slug, kind) values (${agency}::uuid, 'Agencia Adjuntos', ${`adj-${runId}`}, 'agency'), (${otherAgency}::uuid, 'Otra Agencia', ${`otra-${runId}`}, 'agency')`);
    await db.execute(sql`insert into public.workspace_members (workspace_id, user_id, role) values (${agency}::uuid, ${owner}::uuid, 'owner'), (${agency}::uuid, ${editor}::uuid, 'editor'), (${agency}::uuid, ${third}::uuid, 'editor'), (${agency}::uuid, ${viewer}::uuid, 'viewer'), (${otherAgency}::uuid, ${outsider}::uuid, 'owner')`);
  });

  afterAll(async () => {
    await db.execute(sql`select set_config('storage.allow_delete_query', 'true', false)`);
    await db.execute(sql`delete from storage.objects where bucket_id = 'chat-attachments' and name like ${`${agency}/%`}`);
    await db.execute(sql`delete from public.workspaces where id in (${agency}::uuid, ${otherAgency}::uuid)`);
    await db.execute(sql`delete from auth.users where id in (${owner}::uuid, ${editor}::uuid, ${third}::uuid, ${viewer}::uuid, ${outsider}::uuid)`);
  });

  it("endurece catálogo, RLS forzado y privilegios de chat_attachments, reservas y funciones de Storage", async () => {
    for (const rel of ["chat_attachments", "chat_attachment_reservations"]) {
      const [tbl] = await db.execute<{ rls: boolean; forced: boolean; anon_priv: boolean; auth_write: boolean }>(sql`
        select c.relrowsecurity as rls, c.relforcerowsecurity as forced,
          has_table_privilege('anon', ${`private.${rel}`}, 'select, insert, update, delete') as anon_priv,
          has_table_privilege('authenticated', ${`private.${rel}`}, 'insert, update, delete') as auth_write
        from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'private' and c.relname = ${rel}`);
      expect(tbl).toEqual({ rls: true, forced: true, anon_priv: false, auth_write: false });
    }
    for (const fn of [
      "private.chat_can_read_attachment_object(text)", "private.chat_can_upload_attachment_object(text)",
      "private.chat_reserve_attachment_upload(uuid,uuid,uuid,text,text,integer)",
      "private.chat_register_attachment(uuid,uuid,uuid,uuid,text,text,integer,integer,integer)",
      "private.chat_purge_deleted_message_attachments()",
    ]) {
      const [p] = await db.execute<{ a: boolean; pub: boolean }>(sql`select has_function_privilege('anon', ${fn}, 'execute') as a, has_function_privilege('public', ${fn}, 'execute') as pub`);
      expect(p).toEqual({ a: false, pub: false });
    }
  });

  it("exige reserva previa anti-huérfanos, aísla por conversación, impone topes 5/10 MB y purga Storage al retirar", async () => {
    const [{ id: general }] = await as<{ id: string }>(owner, sql`select private.chat_ensure_general(${agency}::uuid) as id`);
    const [{ id: direct }] = await as<{ id: string }>(owner, sql`select private.chat_open_direct(${agency}::uuid, ${editor}::uuid) as id`);
    const [{ id: chMsg }] = await as<{ id: string }>(owner, sql`select private.chat_send_message(${agency}::uuid, ${general}::uuid, ${crypto.randomUUID()}::uuid, 'Con adjuntos') as id`);
    const [{ id: dmMsg }] = await as<{ id: string }>(owner, sql`select private.chat_send_message(${agency}::uuid, ${direct}::uuid, ${crypto.randomUUID()}::uuid, 'Directo con PDF') as id`);

    await expect(as(owner, sql`insert into storage.objects (bucket_id, name, owner) values ('chat-attachments', ${`${agency}/${general}/${crypto.randomUUID()}`}, ${owner}::uuid)`)).rejects.toThrow();

    const reserved: Array<{ id: string; quarantine_path: string; final_path: string }> = [];
    for (let idx = 0; idx < 5; idx += 1) {
      const [res] = await as<{ id: string; quarantine_path: string; final_path: string }>(
        owner, sql`select id, quarantine_path, final_path from private.chat_reserve_attachment_upload(${agency}::uuid, ${general}::uuid, ${chMsg}::uuid, ${`foto-${idx}.png`}, 'image/png', 1024)`,
      );
      reserved.push(res!);
    }
    await expect(as(owner, sql`select id from private.chat_reserve_attachment_upload(${agency}::uuid, ${general}::uuid, ${chMsg}::uuid, 'sexto.png', 'image/png', 512)`)).rejects.toMatchObject({ cause: { code: "22023" } });

    for (const [idx, res] of reserved.entries()) {
      await as(owner, sql`insert into storage.objects (bucket_id, name, owner) values ('chat-attachments', ${res.quarantine_path}, ${owner}::uuid), ('chat-attachments', ${res.final_path}, ${owner}::uuid)`);
      await as(owner, sql`select private.chat_register_attachment(${agency}::uuid, ${general}::uuid, ${chMsg}::uuid, ${res.id}::uuid, ${`foto-${idx}.png`}, 'image/png', 1024, 320, 240)`);
    }
    await expect(as(owner, sql`select private.chat_register_attachment(${agency}::uuid, ${general}::uuid, ${chMsg}::uuid, ${crypto.randomUUID()}::uuid, 'sin-reserva.png', 'image/png', 512, 10, 10)`)).rejects.toMatchObject({ cause: { code: "22023" } });

    const [dmRes] = await as<{ id: string; final_path: string }>(owner, sql`select id, final_path from private.chat_reserve_attachment_upload(${agency}::uuid, ${direct}::uuid, ${dmMsg}::uuid, 'plan d''action.pdf', 'application/pdf', 4096)`);
    await as(owner, sql`insert into storage.objects (bucket_id, name, owner) values ('chat-attachments', ${dmRes!.final_path}, ${owner}::uuid)`);
    await as(owner, sql`select private.chat_register_attachment(${agency}::uuid, ${direct}::uuid, ${dmMsg}::uuid, ${dmRes!.id}::uuid, 'plan d''action.pdf', 'application/pdf', 4096, null, null)`);
    await expect(as(owner, sql`select id from private.chat_reserve_attachment_upload(${agency}::uuid, ${direct}::uuid, ${dmMsg}::uuid, 'grande.pdf', 'application/pdf', 10485761)`)).rejects.toMatchObject({ cause: { code: "23514" } });

    expect(await as(viewer, sql`select id from private.chat_attachments where message_id = ${chMsg}::uuid`)).toHaveLength(5);
    expect(await as(viewer, sql`select name from storage.objects where bucket_id = 'chat-attachments' and name = ${reserved[0]!.final_path}`)).toHaveLength(1);
    expect(await as(outsider, sql`select id from private.chat_attachments where message_id = ${chMsg}::uuid`)).toHaveLength(0);
    expect(await as(outsider, sql`select name from storage.objects where bucket_id = 'chat-attachments' and name = ${reserved[0]!.final_path}`)).toHaveLength(0);
    expect(await as(editor, sql`select id from private.chat_attachments where message_id = ${dmMsg}::uuid`)).toHaveLength(1);
    expect(await as(third, sql`select id from private.chat_attachments where message_id = ${dmMsg}::uuid`)).toHaveLength(0);
    expect(await as(third, sql`select name from storage.objects where bucket_id = 'chat-attachments' and name = ${dmRes!.final_path}`)).toHaveLength(0);
    await expect(as(third, sql`insert into storage.objects (bucket_id, name, owner) values ('chat-attachments', ${`${agency}/${direct}/${crypto.randomUUID()}`}, ${third}::uuid)`)).rejects.toThrow();

    await as(owner, sql`select private.chat_change_message(${agency}::uuid, ${general}::uuid, ${chMsg}::uuid, null)`);
    const [remainingAtt] = await db.execute<{ n: number }>(sql`select count(*)::int as n from private.chat_attachments where message_id = ${chMsg}::uuid`);
    const [remainingObj] = await db.execute<{ n: number }>(sql`select count(*)::int as n from storage.objects where bucket_id = 'chat-attachments' and name like ${`${agency}/${general}/%`}`);
    expect(remainingAtt?.n).toBe(0);
    expect(remainingObj?.n).toBe(0);
  });
});

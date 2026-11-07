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
      "private.chat_can_purge_message_attachments(uuid,uuid,uuid)", "private.chat_can_delete_attachment_object(text)",
      "private.chat_message_attachment_paths(uuid,uuid,uuid)", "private.chat_expired_reservation_paths(uuid,uuid,uuid)",
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
    expect(remainingAtt?.n).toBe(0);
    // El disparador ya no borra filas de storage.objects por SQL (dejaría el archivo físico huérfano): la app borra
    // por la API antes de retirar. Las filas que quedaran ya no se sirven a nadie.
    const [remainingObj] = await db.execute<{ n: number }>(sql`select count(*)::int as n from storage.objects where bucket_id = 'chat-attachments' and name = ${reserved[0]!.final_path}`);
    expect(remainingObj?.n).toBe(1);
    expect(await as(viewer, sql`select name from storage.objects where bucket_id = 'chat-attachments' and name = ${reserved[0]!.final_path}`)).toHaveLength(0);
    expect(await as(owner, sql`select name from storage.objects where bucket_id = 'chat-attachments' and name = ${reserved[0]!.final_path}`)).toHaveLength(0);
  });

  it("no tiene política UPDATE en Storage y el registro conserva la cuarentena para borrarla por la API", async () => {
    const [policies] = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('UPDATE', 'ALL')
        and (coalesce(qual, '') like '%chat-attachments%' or coalesce(with_check, '') like '%chat-attachments%' or policyname like 'chat_attachments%')`);
    expect(policies?.n).toBe(0);
    const [fnSrc] = await db.execute<{ src: string }>(sql`select prosrc as src from pg_proc where oid = 'private.chat_register_attachment(uuid,uuid,uuid,uuid,text,text,integer,integer,integer)'::regprocedure`);
    expect(fnSrc?.src).not.toMatch(/storage\.objects|allow_delete_query/);
    const [trgSrc] = await db.execute<{ src: string }>(sql`select prosrc as src from pg_proc where oid = 'private.chat_purge_deleted_message_attachments()'::regprocedure`);
    expect(trgSrc?.src).not.toMatch(/storage\.objects|allow_delete_query/);

    const [{ id: general }] = await as<{ id: string }>(owner, sql`select private.chat_ensure_general(${agency}::uuid) as id`);
    const [{ id: msg }] = await as<{ id: string }>(editor, sql`select private.chat_send_message(${agency}::uuid, ${general}::uuid, ${crypto.randomUUID()}::uuid, 'Adjunto del editor') as id`);
    const [res] = await as<{ id: string; quarantine_path: string; final_path: string }>(editor, sql`select id, quarantine_path, final_path from private.chat_reserve_attachment_upload(${agency}::uuid, ${general}::uuid, ${msg}::uuid, 'foto.png', 'image/png', 2048)`);
    await as(editor, sql`insert into storage.objects (bucket_id, name, owner) values ('chat-attachments', ${res!.quarantine_path}, ${editor}::uuid), ('chat-attachments', ${res!.final_path}, ${editor}::uuid)`);
    await as(editor, sql`select private.chat_register_attachment(${agency}::uuid, ${general}::uuid, ${msg}::uuid, ${res!.id}::uuid, 'foto.png', 'image/png', 2048, 10, 10)`);
    const [quarantine] = await db.execute<{ n: number }>(sql`select count(*)::int as n from storage.objects where bucket_id = 'chat-attachments' and name = ${res!.quarantine_path}`);
    expect(quarantine?.n).toBe(1);

    const canDelete = async (sub: string, path: string) =>
      (await as<{ ok: boolean }>(sub, sql`select private.chat_can_delete_attachment_object(${path}) as ok`))[0]?.ok;
    // El autor puede borrar la cuarentena ya registrada (limpieza tras commit) y el archivo final.
    expect(await canDelete(editor, res!.quarantine_path)).toBe(true);
    expect(await canDelete(editor, res!.final_path)).toBe(true);
    // Solo quien puede retirar el mensaje (su autor) purga sus adjuntos: ni el owner, ni otro editor, ni un viewer, ni alguien de fuera.
    expect(await canDelete(owner, res!.final_path)).toBe(false);
    expect(await canDelete(third, res!.final_path)).toBe(false);
    expect(await canDelete(viewer, res!.final_path)).toBe(false);
    expect(await canDelete(outsider, res!.final_path)).toBe(false);

    const authorPaths = await as<{ object_path: string; required: boolean }>(editor, sql`select object_path, required from private.chat_message_attachment_paths(${agency}::uuid, ${general}::uuid, ${msg}::uuid)`);
    expect(authorPaths.filter((r: { required: boolean }) => r.required).map((r: { object_path: string }) => r.object_path)).toEqual([res!.final_path]);
    expect(authorPaths.map((r: { object_path: string }) => r.object_path)).toContain(res!.quarantine_path);
    for (const other of [owner, third]) {
      await expect(as(other, sql`select object_path from private.chat_message_attachment_paths(${agency}::uuid, ${general}::uuid, ${msg}::uuid)`)).rejects.toMatchObject({ cause: { code: "42501" } });
    }

    // Repetible: un adjunto ya borrado de Storage en un intento anterior deja de ser obligatorio.
    await db.execute(sql`select set_config('storage.allow_delete_query', 'true', false)`);
    await db.execute(sql`delete from storage.objects where bucket_id = 'chat-attachments' and name = ${res!.final_path}`);
    const retry = await as<{ object_path: string; required: boolean }>(editor, sql`select object_path, required from private.chat_message_attachment_paths(${agency}::uuid, ${general}::uuid, ${msg}::uuid)`);
    expect(retry.filter((r: { required: boolean }) => r.required)).toHaveLength(0);

    // Si el autor pasa a viewer, ya no puede retirar ni, por tanto, purgar.
    await db.execute(sql`update public.workspace_members set role = 'viewer' where workspace_id = ${agency}::uuid and user_id = ${editor}::uuid`);
    expect(await canDelete(editor, res!.final_path)).toBe(false);
    await db.execute(sql`update public.workspace_members set role = 'editor' where workspace_id = ${agency}::uuid and user_id = ${editor}::uuid`);
    // Con la conversación archivada tampoco (general no se puede archivar: se usa otro canal).
    const [{ id: side }] = await as<{ id: string }>(owner, sql`select private.chat_manage_channel(${agency}::uuid, null, ${`adjuntos-${runId}`}, false) as id`);
    const [{ id: sideMsg }] = await as<{ id: string }>(editor, sql`select private.chat_send_message(${agency}::uuid, ${side}::uuid, ${crypto.randomUUID()}::uuid, 'Adjunto en canal que se archiva') as id`);
    const [sideRes] = await as<{ id: string; quarantine_path: string; final_path: string }>(editor, sql`select id, quarantine_path, final_path from private.chat_reserve_attachment_upload(${agency}::uuid, ${side}::uuid, ${sideMsg}::uuid, 'doc.png', 'image/png', 1024)`);
    await as(editor, sql`insert into storage.objects (bucket_id, name, owner) values ('chat-attachments', ${sideRes!.final_path}, ${editor}::uuid)`);
    await as(editor, sql`select private.chat_register_attachment(${agency}::uuid, ${side}::uuid, ${sideMsg}::uuid, ${sideRes!.id}::uuid, 'doc.png', 'image/png', 1024, 10, 10)`);
    expect(await canDelete(editor, sideRes!.final_path)).toBe(true);
    await as(owner, sql`select private.chat_manage_channel(${agency}::uuid, ${side}::uuid, null, true)`);
    expect(await canDelete(editor, sideRes!.final_path)).toBe(false);

    // Reservas vencidas: su autor obtiene las rutas para borrarlas por la API y puede borrarlas aunque estén vencidas.
    const [stale] = await as<{ id: string; quarantine_path: string; final_path: string }>(editor, sql`select id, quarantine_path, final_path from private.chat_reserve_attachment_upload(${agency}::uuid, ${general}::uuid, ${msg}::uuid, 'tarde.png', 'image/png', 512)`);
    await db.execute(sql`update private.chat_attachment_reservations set expires_at = now() - interval '1 minute' where id = ${stale!.id}::uuid`);
    const expired = await as<{ p: string }>(editor, sql`select p from private.chat_expired_reservation_paths(${agency}::uuid, ${general}::uuid, ${msg}::uuid) as p`);
    expect(expired.map((r: { p: string }) => r.p).sort()).toEqual([stale!.final_path, stale!.quarantine_path].sort());
    expect(await as(owner, sql`select p from private.chat_expired_reservation_paths(${agency}::uuid, ${general}::uuid, ${msg}::uuid) as p`)).toHaveLength(0);
    expect(await canDelete(editor, stale!.quarantine_path)).toBe(true);
  });
});

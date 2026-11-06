import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const EXPECTED_PUBLIC_TABLES = [
  "workspaces", "workspace_members", "workspace_invitations", "notes", "todos", "user_preferences",
  "brands", "content_pieces", "content_piece_events",
];

const EXPECTED_SECURITY_DEFINER_FUNCTIONS = [
  "is_workspace_member", "workspace_role", "create_personal_workspace", "create_agency_workspace",
  "accept_workspace_invitation", "chat_ensure_general", "chat_open_direct", "chat_manage_channel",
  "chat_send_message", "chat_change_message", "chat_mark_read", "chat_directory",
  "has_workspace_role", "can_read_workspace_item", "can_write_workspace",
  "can_update_workspace_item", "can_delete_workspace_item",
  "enforce_brand_write", "enforce_content_piece_write", "record_content_piece_events",
];

describe("Catálogo RLS y Seguridad (ADR 0004, ADR 0007, ADR 0011, Issue #23, #62 & #191)", () => {
  const sql = postgres(connectionString);
  afterAll(async () => { await sql.end(); });

  it("el 100% de tablas de negocio en public tienen RLS activado y forzado", async () => {
    const rows = await sql<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ${sql(EXPECTED_PUBLIC_TABLES)};
    `;
    expect(rows.length).toBe(EXPECTED_PUBLIC_TABLES.length);
    for (const r of rows) {
      expect(r.relrowsecurity, `RLS activado en ${r.relname}`).toBe(true);
      expect(r.relforcerowsecurity, `RLS forzado en ${r.relname}`).toBe(true);
    }
  });

  it("el rol anon no tiene ningún privilegio sobre tablas de negocio ni authenticated lee token_hash", async () => {
    for (const t of EXPECTED_PUBLIC_TABLES) {
      const [s] = await sql<Array<{ p: boolean }>>`select has_table_privilege('anon', ${"public." + t}, 'select') as p;`;
      const [i] = await sql<Array<{ p: boolean }>>`select has_table_privilege('anon', ${"public." + t}, 'insert') as p;`;
      expect(s?.p, `anon no select ${t}`).toBe(false);
      expect(i?.p, `anon no insert ${t}`).toBe(false);
    }
    const [th] = await sql<Array<{ p: boolean }>>`select has_column_privilege('authenticated', 'public.workspace_invitations', 'token_hash', 'select') as p;`;
    const [mu] = await sql<Array<{ p: boolean }>>`select has_column_privilege('authenticated', 'public.workspace_members', 'user_id', 'update') as p;`;
    const [mr] = await sql<Array<{ p: boolean }>>`select has_column_privilege('authenticated', 'public.workspace_members', 'role', 'update') as p;`;
    const [ei] = await sql<Array<{ p: boolean }>>`select has_table_privilege('authenticated', 'public.content_piece_events', 'insert') as p;`;
    expect(th?.p).toBe(false); expect(mu?.p).toBe(false); expect(mr?.p).toBe(true); expect(ei?.p).toBe(false);
  });

  it("las tablas del chat en private tienen RLS forzado y anon no las lee", async () => {
    const chatTables = ["chat_conversations", "chat_messages", "chat_reads"];
    const rows = await sql<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'private' and c.relname in ${sql(chatTables)};
    `;
    expect(rows.length).toBe(chatTables.length);
    for (const r of rows) {
      expect(r.relrowsecurity && r.relforcerowsecurity, `RLS forzado en private.${r.relname}`).toBe(true);
      const [s] = await sql<Array<{ p: boolean }>>`select has_table_privilege('anon', ${"private." + r.relname}, 'select') as p;`;
      expect(s?.p, `anon no select private.${r.relname}`).toBe(false);
    }
  });

  it("las funciones internas del chat y triggers de contenido no las ejecuta ni authenticated", async () => {
    for (const fn of [
      "private.chat_lock_agency_role(uuid)", "private.chat_require_direct_writers(uuid,uuid,uuid)", "private.chat_lock_writable(uuid,uuid)",
      "private.enforce_brand_write()", "private.enforce_content_piece_write()", "private.record_content_piece_events()",
    ]) {
      const [fa] = await sql<Array<{ p: boolean }>>`select has_function_privilege('authenticated', ${fn}, 'execute') as p;`;
      expect(fa?.p, `authenticated no ejecuta ${fn}`).toBe(false);
    }
  });

  it("las funciones en esquema private están presentes y no tienen permiso de ejecución para anon ni public", async () => {
    const rows = await sql<Array<{ proname: string; prosecdef: boolean; anon_exec: boolean; pub_exec: boolean }>>`
      select p.proname, p.prosecdef,
        has_function_privilege('anon', p.oid, 'execute') as anon_exec,
        has_function_privilege('public', p.oid, 'execute') as pub_exec
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private';
    `;
    const names = new Set(rows.filter((r) => r.prosecdef).map((r) => r.proname));
    for (const expected of EXPECTED_SECURITY_DEFINER_FUNCTIONS) {
      expect(names.has(expected), `security definer ${expected}`).toBe(true);
    }
    for (const r of rows) {
      expect(r.anon_exec, `anon no ejecuta private.${r.proname}`).toBe(false);
      expect(r.pub_exec, `public no ejecuta private.${r.proname}`).toBe(false);
    }
  });
});

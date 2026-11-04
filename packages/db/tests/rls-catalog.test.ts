import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

describe("Catálogo RLS y Seguridad (ADR 0004, ADR 0007, Issue #23 & #62)", () => {
  const sql = postgres(connectionString);
  const tables = ["workspaces", "workspace_members", "workspace_invitations", "notes", "todos"];
  afterAll(async () => { await sql.end(); });

  it("el 100% de tablas de negocio en public tienen RLS activado y forzado", async () => {
    const rows = await sql<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ${sql(tables)};
    `;
    expect(rows.length).toBe(tables.length);
    for (const r of rows) {
      expect(r.relrowsecurity, `RLS activado en ${r.relname}`).toBe(true);
      expect(r.relforcerowsecurity, `RLS forzado en ${r.relname}`).toBe(true);
    }
  });

  it("el rol anon no tiene ningún privilegio sobre tablas de negocio ni authenticated lee token_hash", async () => {
    for (const t of tables) {
      const [s] = await sql<Array<{ p: boolean }>>`select has_table_privilege('anon', ${'public.' + t}, 'select') as p;`;
      const [i] = await sql<Array<{ p: boolean }>>`select has_table_privilege('anon', ${'public.' + t}, 'insert') as p;`;
      expect(s?.p, `anon no select ${t}`).toBe(false);
      expect(i?.p, `anon no insert ${t}`).toBe(false);
    }
    const [th] = await sql<Array<{ p: boolean }>>`select has_column_privilege('authenticated', 'public.workspace_invitations', 'token_hash', 'select') as p;`;
    const [mu] = await sql<Array<{ p: boolean }>>`select has_column_privilege('authenticated', 'public.workspace_members', 'user_id', 'update') as p;`;
    const [mr] = await sql<Array<{ p: boolean }>>`select has_column_privilege('authenticated', 'public.workspace_members', 'role', 'update') as p;`;
    expect(th?.p).toBe(false); expect(mu?.p).toBe(false); expect(mr?.p).toBe(true);
  });

  it("las funciones en esquema private no tienen permiso de ejecución para anon ni public", async () => {
    for (const fn of ["private.is_workspace_member(uuid)", "private.workspace_role(uuid)", "private.create_personal_workspace(text,text)", "private.create_agency_workspace(text,text)", "private.accept_workspace_invitation(text)"]) {
      const [fa] = await sql<Array<{ p: boolean }>>`select has_function_privilege('anon', ${fn}, 'execute') as p;`;
      const [fp] = await sql<Array<{ p: boolean }>>`select has_function_privilege('public', ${fn}, 'execute') as p;`;
      expect(fa?.p).toBe(false); expect(fp?.p).toBe(false);
    }
  });
});

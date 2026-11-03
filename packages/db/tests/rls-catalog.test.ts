import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

describe("Catálogo RLS y Seguridad (ADR 0004 & Issue #23)", () => {
  const sql = postgres(connectionString);
  const tables = ["workspaces", "workspace_members", "notes", "todos"];
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

  it("el rol anon no tiene ningún privilegio sobre tablas de negocio", async () => {
    for (const t of tables) {
      const [s] = await sql<Array<{ p: boolean }>>`select has_table_privilege('anon', ${'public.' + t}, 'select') as p;`;
      const [i] = await sql<Array<{ p: boolean }>>`select has_table_privilege('anon', ${'public.' + t}, 'insert') as p;`;
      expect(s?.p, `anon no select ${t}`).toBe(false);
      expect(i?.p, `anon no insert ${t}`).toBe(false);
    }
  });

  it("las funciones en esquema private no tienen permiso de ejecución para anon ni public", async () => {
    const [ma] = await sql<Array<{ p: boolean }>>`select has_function_privilege('anon', 'private.is_workspace_member(uuid)', 'execute') as p;`;
    const [mp] = await sql<Array<{ p: boolean }>>`select has_function_privilege('public', 'private.is_workspace_member(uuid)', 'execute') as p;`;
    const [ca] = await sql<Array<{ p: boolean }>>`select has_function_privilege('anon', 'private.create_personal_workspace(text,text)', 'execute') as p;`;
    const [cp] = await sql<Array<{ p: boolean }>>`select has_function_privilege('public', 'private.create_personal_workspace(text,text)', 'execute') as p;`;
    expect(ma?.p).toBe(false); expect(mp?.p).toBe(false);
    expect(ca?.p).toBe(false); expect(cp?.p).toBe(false);
  });
});

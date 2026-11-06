import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { withUserContext } from "../src/context";
import { getDb } from "../src/internal";

describe("Avatares entre compañeros de espacio y directorio (#203, ADR 0012)", { timeout: 30000 }, () => {
  const db = getDb();
  const runId = Math.random().toString(36).slice(2, 10);
  const agency = crypto.randomUUID(), otherAgency = crypto.randomUUID();
  const ana = crypto.randomUUID(), beto = crypto.randomUUID(), carla = crypto.randomUUID();
  const asUser = (sub: string) => ({ sub, role: "authenticated" as const });
  const as = <T extends Record<string, unknown> = Record<string, unknown>>(sub: string, statement: ReturnType<typeof sql>) =>
    withUserContext(asUser(sub), (tx) => tx.execute<T>(statement));

  beforeAll(async () => {
    for (const [id, email, name] of [
      [ana, `ana-av-${runId}@hubly.local`, "Ana"],
      [beto, `beto-av-${runId}@hubly.local`, "Beto"],
      [carla, `carla-av-${runId}@hubly.local`, "Carla"],
    ] as const) {
      await db.execute(sql`
        insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
        values (${id}::uuid, ${email}, now(), ${JSON.stringify({ display_name: name })}::jsonb)
        on conflict (id) do nothing
      `);
    }
    await db.execute(sql`
      insert into public.workspaces (id, name, slug, kind) values
      (${agency}::uuid, 'Agencia Avatares', ${`ag-av-${runId}`}, 'agency'),
      (${otherAgency}::uuid, 'Otra Agencia', ${`ag-other-${runId}`}, 'agency')
    `);
    await db.execute(sql`
      insert into public.workspace_members (workspace_id, user_id, role) values
      (${agency}::uuid, ${ana}::uuid, 'owner'),
      (${agency}::uuid, ${beto}::uuid, 'editor'),
      (${otherAgency}::uuid, ${carla}::uuid, 'owner')
    `);
  });

  afterAll(async () => {
    await db.execute(sql`delete from storage.objects where bucket_id = 'user-avatars' and name in (${`${ana}/foto`}, ${`${beto}/foto`}, ${`carpeta-invalida-${runId}/foto`})`);
    await db.execute(sql`delete from public.workspaces where id in (${agency}::uuid, ${otherAgency}::uuid)`);
    await db.execute(sql`delete from auth.users where id in (${ana}::uuid, ${beto}::uuid, ${carla}::uuid)`);
  });

  it("endurece shares_workspace_with y chat_directory con security definer, search_path vacío y sin acceso anónimo", async () => {
    for (const fn of ["private.shares_workspace_with(uuid)", "private.chat_directory(uuid)"]) {
      const [priv] = await db.execute<{ anon_exec: boolean; pub_exec: boolean; auth_exec: boolean }>(sql`
        select has_function_privilege('anon', ${fn}, 'execute') as anon_exec,
          has_function_privilege('public', ${fn}, 'execute') as pub_exec,
          has_function_privilege('authenticated', ${fn}, 'execute') as auth_exec
      `);
      expect(priv).toEqual({ anon_exec: false, pub_exec: false, auth_exec: true });
    }
    const procs = await db.execute<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(sql`
      select p.proname, p.prosecdef, p.proconfig from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and p.proname in ('shares_workspace_with', 'chat_directory')
    `);
    expect(procs).toHaveLength(2);
    for (const proc of procs) {
      expect(proc.prosecdef).toBe(true);
      expect(proc.proconfig).toContain('search_path=""');
    }
  });

  it("permite a compañeros leer avatares mutuos, expone has_avatar en chat_directory y tolera rutas no UUID", async () => {
    await as(ana, sql`insert into storage.objects (bucket_id, name, owner) values ('user-avatars', ${`${ana}/foto`}, ${ana}::uuid)`);
    await db.execute(sql`insert into storage.objects (bucket_id, name) values ('user-avatars', ${`carpeta-invalida-${runId}/foto`})`);

    const [shared] = await as<{ ok: boolean }>(beto, sql`select private.shares_workspace_with(${ana}::uuid) as ok`);
    expect(shared?.ok).toBe(true);

    const visibleToBeto = await as<{ name: string }>(
      beto,
      sql`select name from storage.objects where bucket_id = 'user-avatars' and name in (${`${ana}/foto`}, ${`carpeta-invalida-${runId}/foto`})`,
    );
    expect(visibleToBeto).toEqual([{ name: `${ana}/foto` }]);

    const directory = await as<{ user_id: string; display_name: string; has_avatar: boolean }>(
      beto,
      sql`select user_id, display_name, has_avatar from private.chat_directory(${agency}::uuid) order by display_name asc`,
    );
    expect(directory).toEqual([
      { user_id: ana, display_name: "Ana", has_avatar: true },
      { user_id: beto, display_name: "Beto", has_avatar: false },
    ]);
  });

  it("impide que un compañero reemplace, suba o borre el avatar ajeno (solo lectura)", async () => {
    await expect(
      as(beto, sql`insert into storage.objects (bucket_id, name, owner) values ('user-avatars', ${`${ana}/otra`}, ${beto}::uuid)`),
    ).rejects.toThrow();
    expect(
      await as(beto, sql`update storage.objects set metadata = '{"x":1}'::jsonb where bucket_id = 'user-avatars' and name = ${`${ana}/foto`} returning name`),
    ).toHaveLength(0);
    expect(
      await as(beto, sql`delete from storage.objects where bucket_id = 'user-avatars' and name = ${`${ana}/foto`} returning name`),
    ).toHaveLength(0);
  });

  it("bloquea a personas de otra agencia y revoca la lectura cuando el compañero sale del espacio", async () => {
    const [strangerShare] = await as<{ ok: boolean }>(carla, sql`select private.shares_workspace_with(${ana}::uuid) as ok`);
    expect(strangerShare?.ok).toBe(false);
    expect(await as(carla, sql`select name from storage.objects where bucket_id = 'user-avatars' and name = ${`${ana}/foto`}`)).toHaveLength(0);
    await expect(
      as(carla, sql`insert into storage.objects (bucket_id, name, owner) values ('user-avatars', ${`${ana}/foto`}, ${carla}::uuid)`),
    ).rejects.toThrow();
    expect(
      await as(carla, sql`update storage.objects set metadata = '{}'::jsonb where bucket_id = 'user-avatars' and name = ${`${ana}/foto`} returning name`),
    ).toHaveLength(0);
    expect(
      await as(carla, sql`delete from storage.objects where bucket_id = 'user-avatars' and name = ${`${ana}/foto`} returning name`),
    ).toHaveLength(0);
    expect(await as(carla, sql`select user_id from private.chat_directory(${agency}::uuid)`)).toHaveLength(0);

    await db.execute(sql`delete from public.workspace_members where workspace_id = ${agency}::uuid and user_id = ${beto}::uuid`);
    try {
      const [afterRemoval] = await as<{ ok: boolean }>(beto, sql`select private.shares_workspace_with(${ana}::uuid) as ok`);
      expect(afterRemoval?.ok).toBe(false);
      expect(await as(beto, sql`select name from storage.objects where bucket_id = 'user-avatars' and name = ${`${ana}/foto`}`)).toHaveLength(0);
    } finally {
      await db.execute(sql`insert into public.workspace_members (workspace_id, user_id, role) values (${agency}::uuid, ${beto}::uuid, 'editor')`);
    }
  });
});

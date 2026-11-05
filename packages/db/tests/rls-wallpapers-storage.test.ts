import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { withUserContext } from "../src/context";
import { getDb } from "../src/internal";

describe("«Tu imagen» en Storage con RLS (#84, ADR 0008): cada persona solo toca su carpeta del bucket privado", { timeout: 30000 }, () => {
  const db = getDb();
  const runId = Math.random().toString(36).slice(2, 10);
  const ana = crypto.randomUUID(), beto = crypto.randomUUID();
  const asUser = (sub: string) => ({ sub, role: "authenticated" as const });
  const as = (sub: string, statement: ReturnType<typeof sql>) => withUserContext(asUser(sub), (tx) => tx.execute<Record<string, unknown>>(statement));

  beforeAll(async () => {
    for (const [id, email] of [[ana, `ana-img-${runId}@hubly.local`], [beto, `beto-img-${runId}@hubly.local`]] as const) {
      await db.execute(sql`insert into auth.users (id, email, email_confirmed_at) values (${id}::uuid, ${email}, now()) on conflict (id) do nothing`);
    }
  });

  it("el bucket es privado, limita a 5 MB y solo admite JPEG, PNG y WebP; existen las cuatro políticas", async () => {
    const [bucket] = await db.execute<{ public: boolean; file_size_limit: string | number; allowed_mime_types: string[] }>(sql`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'user-wallpapers'`);
    expect(bucket?.public).toBe(false);
    expect(Number(bucket?.file_size_limit)).toBe(5 * 1024 * 1024);
    expect([...(bucket?.allowed_mime_types ?? [])].sort()).toEqual(["image/jpeg", "image/png", "image/webp"]);
    const policies = await db.execute<{ policyname: string }>(sql`select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'user_wallpapers_%'`);
    expect(policies.map((p) => p.policyname).sort()).toEqual(["user_wallpapers_delete_own", "user_wallpapers_insert_own", "user_wallpapers_select_own", "user_wallpapers_update_own"]);
  });

  it("la persona sube, lee y reemplaza su fondo en su carpeta; no puede escribir en la de otra", async () => {
    await as(ana, sql`insert into storage.objects (bucket_id, name, owner) values ('user-wallpapers', ${`${ana}/fondo`}, ${ana}::uuid)`);
    expect(await as(ana, sql`select name from storage.objects where bucket_id = 'user-wallpapers' and name = ${`${ana}/fondo`}`)).toHaveLength(1);
    expect(await as(ana, sql`update storage.objects set metadata = '{"size": 1}'::jsonb where bucket_id = 'user-wallpapers' and name = ${`${ana}/fondo`} returning name`)).toHaveLength(1);
    await expect(as(ana, sql`insert into storage.objects (bucket_id, name, owner) values ('user-wallpapers', ${`${beto}/fondo`}, ${ana}::uuid)`)).rejects.toThrow();
    await expect(as(ana, sql`insert into storage.objects (bucket_id, name, owner) values ('user-wallpapers', 'fondo-suelto', ${ana}::uuid)`)).rejects.toThrow();
  });

  it("otra persona no puede ver, reemplazar ni borrar el fondo ajeno", async () => {
    expect(await as(beto, sql`select name from storage.objects where bucket_id = 'user-wallpapers' and name = ${`${ana}/fondo`}`)).toHaveLength(0);
    expect(await as(beto, sql`update storage.objects set metadata = '{}'::jsonb where bucket_id = 'user-wallpapers' and name = ${`${ana}/fondo`} returning name`)).toHaveLength(0);
    expect(await as(beto, sql`delete from storage.objects where bucket_id = 'user-wallpapers' and name = ${`${ana}/fondo`} returning name`)).toHaveLength(0);
    expect(await as(ana, sql`select name from storage.objects where bucket_id = 'user-wallpapers' and name = ${`${ana}/fondo`}`)).toHaveLength(1);
    expect(await as(ana, sql`delete from storage.objects where bucket_id = 'user-wallpapers' and name = ${`${ana}/fondo`} returning name`)).toHaveLength(1);
  });

  it("la preferencia de fondo acepta «imagen» y sigue rechazando valores desconocidos", async () => {
    const [row] = await as(beto, sql`insert into public.user_preferences (user_id, wallpaper) values (${beto}::uuid, 'imagen') returning wallpaper`);
    expect(row?.wallpaper).toBe("imagen");
    await expect(as(beto, sql`update public.user_preferences set wallpaper = 'mi-foto' where user_id = ${beto}::uuid`)).rejects.toThrow();
  });
});

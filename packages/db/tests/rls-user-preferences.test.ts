import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { withUserContext } from "../src/context";
import { getDb } from "../src/internal";
import { DrizzleUserPreferencesRepository } from "../src/repositories";
import { userPreferences } from "../src/schema";

const sha256Hex = (raw: string): string => createHash("sha256").update(raw, "utf8").digest("hex");
const prefs: Parameters<DrizzleUserPreferencesRepository["upsert"]>[1] = { wallpaper: "tinta", panelOpacity: 64, layoutMode: "side_by_side", visiblePanels: ["today", "pinned_notes"], theme: "dark" };

describe("Preferencias por persona con RLS (#83): solo las ve y las cambia su dueño, también dentro de una agencia", { timeout: 30000 }, () => {
  const db = getDb();
  const runId = Math.random().toString(36).slice(2, 10);
  const ana = crypto.randomUUID(), beto = crypto.randomUUID();
  const asUser = (sub: string) => ({ sub, role: "authenticated" as const });

  beforeAll(async () => {
    for (const [id, email] of [[ana, `ana-${runId}@hubly.local`], [beto, `beto-${runId}@hubly.local`]] as const) {
      await db.execute(sql`insert into auth.users (id, email, email_confirmed_at) values (${id}::uuid, ${email}, now()) on conflict (id) do nothing`);
    }
    // Ana y Beto comparten agencia: Ana es propietaria y Beto entra como editor con una invitación real.
    const agencyId = await withUserContext(asUser(ana), async (tx) => (await tx.execute<{ id: string }>(sql`select private.create_agency_workspace('Agencia Pref', ${`ag-pref-${runId}`}) as id`))[0]!.id);
    const rawToken = `tok-pref-${runId}-0123456789`;
    await withUserContext(asUser(ana), (tx) => tx.execute(sql`insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by, expires_at) values (${agencyId}::uuid, ${`beto-${runId}@hubly.local`}, 'editor', ${sha256Hex(rawToken)}, ${ana}::uuid, ${new Date(Date.now() + 3600000).toISOString()}::timestamptz)`));
    await withUserContext(asUser(beto), (tx) => tx.execute(sql`select private.accept_workspace_invitation(${rawToken})`));
  });

  it("sin registro no hay fila; al guardar, la persona lee exactamente lo suyo", async () => {
    const repo = new DrizzleUserPreferencesRepository(asUser(ana));
    expect(await repo.get(ana)).toBeNull();
    expect(await repo.upsert(ana, prefs)).toEqual(prefs);
    expect(await repo.get(ana)).toEqual(prefs);
    expect(await repo.upsert(ana, { ...prefs, panelOpacity: 90, theme: "light" })).toMatchObject({ panelOpacity: 90, theme: "light" });
  });

  it("otra persona de la misma agencia no puede leer, cambiar, crear ni borrar las preferencias ajenas", async () => {
    const betoRepo = new DrizzleUserPreferencesRepository(asUser(beto));
    expect(await betoRepo.get(ana)).toBeNull();
    await withUserContext(asUser(beto), async (tx) => {
      expect(await tx.execute(sql`select user_id from public.user_preferences where user_id = ${ana}::uuid`)).toHaveLength(0);
      expect(await tx.execute(sql`update public.user_preferences set wallpaper = 'grafito' where user_id = ${ana}::uuid returning user_id`)).toHaveLength(0);
      expect(await tx.execute(sql`delete from public.user_preferences where user_id = ${ana}::uuid returning user_id`)).toHaveLength(0);
    });
    await expect(betoRepo.upsert(ana, prefs)).rejects.toThrow();
    expect(await new DrizzleUserPreferencesRepository(asUser(ana)).get(ana)).toMatchObject({ wallpaper: "tinta", panelOpacity: 90 });
  });

  it("cada fondo del esquema, ilustrados incluidos, se guarda y se relee igual (issue 238)", async () => {
    const repo = new DrizzleUserPreferencesRepository(asUser(ana));
    const wallpapers = userPreferences.wallpaper.enumValues;
    expect(wallpapers).toContain("bosque-de-niebla");
    for (const wallpaper of wallpapers) {
      await repo.upsert(ana, { ...prefs, wallpaper });
      expect((await repo.get(ana))?.wallpaper, wallpaper).toBe(wallpaper);
    }
    await repo.upsert(ana, { ...prefs, panelOpacity: 90, theme: "light" });
  });

  it("las restricciones de la tabla rechazan valores fuera del contrato", async () => {
    const run = (statement: ReturnType<typeof sql>) => withUserContext(asUser(beto), (tx) => tx.execute(statement));
    await expect(run(sql`insert into public.user_preferences (user_id, panel_opacity) values (${beto}::uuid, 120)`)).rejects.toThrow();
    await expect(run(sql`insert into public.user_preferences (user_id, wallpaper) values (${beto}::uuid, 'mi-foto')`)).rejects.toThrow();
    await expect(run(sql`insert into public.user_preferences (user_id, layout_mode) values (${beto}::uuid, 'libre')`)).rejects.toThrow();
    await expect(run(sql`insert into public.user_preferences (user_id, visible_panels) values (${beto}::uuid, '["today", "otro"]'::jsonb)`)).rejects.toThrow();
    await expect(run(sql`insert into public.user_preferences (user_id, visible_panels) values (${beto}::uuid, '{"today": true}'::jsonb)`)).rejects.toThrow();
    const [row] = await run(sql`insert into public.user_preferences (user_id) values (${beto}::uuid) returning wallpaper, panel_opacity, layout_mode, visible_panels, theme`);
    expect(row).toMatchObject({ wallpaper: "contornos", panel_opacity: 80, layout_mode: "free", visible_panels: ["today", "open_note", "pinned_notes"], theme: "light" });
  });

  it("sin sesión (anon) no hay ningún privilegio sobre la tabla", async () => {
    for (const privilege of ["select", "insert", "update", "delete"]) {
      const [row] = await db.execute<{ p: boolean }>(sql`select has_table_privilege('anon', 'public.user_preferences', ${privilege}) as p`);
      expect(row?.p, `anon ${privilege}`).toBe(false);
    }
  });
});

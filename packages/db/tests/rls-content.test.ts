import { asc, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { withUserContext } from "../src/context";
import { getDb } from "../src/internal";
import { brands, contentPieceEvents, contentPieces, workspaceMembers } from "../src/schema";

const expectPgError = async (fn: () => Promise<unknown>, pattern: RegExp, code?: string) => {
  let caught: { code?: string; message?: string; cause?: { code?: string; message?: string } } | undefined;
  try { await fn(); } catch (e) { caught = e as typeof caught; }
  expect(caught?.cause?.message ?? caught?.message ?? "").toMatch(pattern);
  if (code) expect(caught?.cause?.code ?? caught?.code).toBe(code);
};

describe("Fase 2 · Marcas, piezas y eventos del calendario editorial con RLS (ADR 0011, Issue #191)", { timeout: 30000 }, () => {
  const db = getDb();
  const runId = Math.random().toString(36).slice(2, 10);
  const ownerA = crypto.randomUUID(), adminA = crypto.randomUUID(), editorA = crypto.randomUUID(), viewerA = crypto.randomUUID();
  const ownerB = crypto.randomUUID();
  let agencyAId = "", agencyBId = "", brandAId = "", brandBId = "";

  beforeAll(async () => {
    for (const [id, email] of [
      [ownerA, `ownera-cnt-${runId}@hubly.local`], [adminA, `admina-cnt-${runId}@hubly.local`],
      [editorA, `editora-cnt-${runId}@hubly.local`], [viewerA, `viewera-cnt-${runId}@hubly.local`],
      [ownerB, `ownerb-cnt-${runId}@hubly.local`],
    ] as const) {
      await db.execute(sql`insert into auth.users (id, email, email_confirmed_at) values (${id}::uuid, ${email}, now()) on conflict (id) do nothing`);
    }
    agencyAId = await withUserContext({ sub: ownerA, role: "authenticated" }, async (tx) =>
      (await tx.execute<{ id: string }>(sql`select private.create_agency_workspace('Agencia Contenido A', ${`ag-cnt-a-${runId}`}) as id`))[0]!.id);
    agencyBId = await withUserContext({ sub: ownerB, role: "authenticated" }, async (tx) =>
      (await tx.execute<{ id: string }>(sql`select private.create_agency_workspace('Agencia Contenido B', ${`ag-cnt-b-${runId}`}) as id`))[0]!.id);

    await db.insert(workspaceMembers).values([
      { workspaceId: agencyAId, userId: adminA, role: "admin" },
      { workspaceId: agencyAId, userId: editorA, role: "editor" },
      { workspaceId: agencyAId, userId: viewerA, role: "viewer" },
    ]);

    brandAId = await withUserContext({ sub: ownerA, role: "authenticated" }, async (tx) =>
      (await tx.insert(brands).values({ workspaceId: agencyAId, createdBy: ownerA, name: "Marca A", color: "azul" }).returning())[0]!.id);
    brandBId = await withUserContext({ sub: ownerB, role: "authenticated" }, async (tx) =>
      (await tx.insert(brands).values({ workspaceId: agencyBId, createdBy: ownerB, name: "Marca B", color: "verde" }).returning())[0]!.id);
  });

  it("1. Aislamiento entre agencias: una agencia no ve ni modifica marcas, piezas ni eventos de otra agencia", async () => {
    const [pieceA] = await withUserContext({ sub: ownerA, role: "authenticated" }, (tx) =>
      tx.insert(contentPieces).values({
        workspaceId: agencyAId, brandId: brandAId, createdBy: ownerA,
        title: "Pieza Agencia A", plannedDate: "2026-11-15", visibility: "workspace",
      }).returning());

    await withUserContext({ sub: ownerB, role: "authenticated" }, async (tx) => {
      expect(await tx.select().from(brands).where(eq(brands.workspaceId, agencyAId))).toEqual([]);
      expect(await tx.select().from(contentPieces).where(eq(contentPieces.workspaceId, agencyAId))).toEqual([]);
      expect(await tx.select().from(contentPieceEvents).where(eq(contentPieceEvents.pieceId, pieceA!.id))).toEqual([]);
      expect(await tx.update(contentPieces).set({ title: "Intruso" }).where(eq(contentPieces.id, pieceA!.id)).returning()).toEqual([]);
      expect(await tx.delete(contentPieces).where(eq(contentPieces.id, pieceA!.id)).returning()).toEqual([]);
    });

    await expect(withUserContext({ sub: ownerB, role: "authenticated" }, (tx) =>
      tx.insert(contentPieces).values({ workspaceId: agencyAId, brandId: brandAId, createdBy: ownerB, title: "X", plannedDate: "2026-11-15" }),
    )).rejects.toThrow();

    await expectPgError(() => withUserContext({ sub: ownerA, role: "authenticated" }, (tx) =>
      tx.insert(contentPieces).values({ workspaceId: agencyAId, brandId: brandBId, createdBy: ownerA, title: "Marca cruzada", plannedDate: "2026-11-15" }),
    ), /brand_workspace_mismatch/);
  });

  it("2. Privacidad entre miembros de la misma agencia (private vs workspace)", async () => {
    const [privOwner, sharedOwner] = await withUserContext({ sub: ownerA, role: "authenticated" }, async (tx) => {
      const [p] = await tx.insert(contentPieces).values({
        workspaceId: agencyAId, brandId: brandAId, createdBy: ownerA,
        title: "Idea privada Owner", plannedDate: "2026-11-16", visibility: "private",
      }).returning();
      const [s] = await tx.insert(contentPieces).values({
        workspaceId: agencyAId, brandId: brandAId, createdBy: ownerA,
        title: "Pieza compartida Owner", plannedDate: "2026-11-16", visibility: "workspace",
      }).returning();
      return [p!, s!];
    });

    const [privEditor] = await withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => {
      const rows = await tx.select().from(contentPieces).where(eq(contentPieces.workspaceId, agencyAId));
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(sharedOwner.id);
      expect(ids).not.toContain(privOwner.id);
      expect(await tx.select().from(contentPieceEvents).where(eq(contentPieceEvents.pieceId, privOwner.id))).toEqual([]);
      return tx.insert(contentPieces).values({
        workspaceId: agencyAId, brandId: brandAId, createdBy: editorA,
        title: "Borrador privado Editor", plannedDate: "2026-11-17", visibility: "private",
      }).returning();
    });

    await withUserContext({ sub: adminA, role: "authenticated" }, async (tx) => {
      const ids = (await tx.select().from(contentPieces).where(eq(contentPieces.workspaceId, agencyAId))).map((r) => r.id);
      expect(ids).toContain(sharedOwner.id);
      expect(ids).not.toContain(privEditor!.id);
    });
  });

  it("3. Rol viewer solo lee: no puede insertar, editar ni borrar marcas ni piezas", async () => {
    await withUserContext({ sub: viewerA, role: "authenticated" }, async (tx) => {
      expect((await tx.select().from(brands).where(eq(brands.workspaceId, agencyAId))).length).toBeGreaterThan(0);
      expect((await tx.select().from(contentPieces).where(eq(contentPieces.workspaceId, agencyAId))).length).toBeGreaterThan(0);
      expect(await tx.update(brands).set({ name: "Hack" }).where(eq(brands.id, brandAId)).returning()).toEqual([]);
      expect(await tx.delete(brands).where(eq(brands.id, brandAId)).returning()).toEqual([]);
    });

    await expect(withUserContext({ sub: viewerA, role: "authenticated" }, (tx) =>
      tx.insert(brands).values({ workspaceId: agencyAId, createdBy: viewerA, name: "Marca Viewer" }),
    )).rejects.toThrow();

    await expect(withUserContext({ sub: viewerA, role: "authenticated" }, (tx) =>
      tx.insert(contentPieces).values({ workspaceId: agencyAId, brandId: brandAId, createdBy: viewerA, title: "Pieza Viewer", plannedDate: "2026-11-18" }),
    )).rejects.toThrow();
  });

  it("4. Rol editor crea/edita piezas, solo borra las propias y no gestiona marcas", async () => {
    await expect(withUserContext({ sub: editorA, role: "authenticated" }, (tx) =>
      tx.insert(brands).values({ workspaceId: agencyAId, createdBy: editorA, name: "Marca Editor" }),
    )).rejects.toThrow();

    await withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => {
      expect(await tx.update(brands).set({ name: "No" }).where(eq(brands.id, brandAId)).returning()).toEqual([]);
      expect(await tx.delete(brands).where(eq(brands.id, brandAId)).returning()).toEqual([]);
    });

    const [ownerPiece] = await withUserContext({ sub: ownerA, role: "authenticated" }, (tx) =>
      tx.insert(contentPieces).values({
        workspaceId: agencyAId, brandId: brandAId, createdBy: ownerA,
        title: "Pieza de Owner", plannedDate: "2026-11-19", visibility: "workspace",
      }).returning());

    await withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => {
      const [edPiece] = await tx.insert(contentPieces).values({
        workspaceId: agencyAId, brandId: brandAId, createdBy: editorA,
        title: "Pieza de Editor", plannedDate: "2026-11-19", visibility: "workspace",
      }).returning();
      expect((await tx.update(contentPieces).set({ title: "Editada por Editor" }).where(eq(contentPieces.id, ownerPiece!.id)).returning())).toHaveLength(1);
      expect(await tx.delete(contentPieces).where(eq(contentPieces.id, ownerPiece!.id)).returning()).toEqual([]);
      expect(await tx.delete(contentPieces).where(eq(contentPieces.id, edPiece!.id)).returning()).toHaveLength(1);
    });
  });

  it("5. Transiciones v1 e historial inmutable por trigger en content_piece_events", async () => {
    const [piece] = await withUserContext({ sub: editorA, role: "authenticated" }, (tx) =>
      tx.insert(contentPieces).values({
        workspaceId: agencyAId, brandId: brandAId, createdBy: editorA,
        title: "Lanzamiento Q4", plannedDate: "2026-11-20", plannedTime: "09:30:00", status: "idea",
      }).returning());

    await expectPgError(() => withUserContext({ sub: editorA, role: "authenticated" }, (tx) =>
      tx.update(contentPieces).set({ status: "aprobada" }).where(eq(contentPieces.id, piece!.id)),
    ), /invalid_content_status_transition/);

    await withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => {
      await tx.update(contentPieces).set({ status: "borrador", plannedDate: "2026-11-21", plannedTime: "14:00:00", assigneeId: editorA }).where(eq(contentPieces.id, piece!.id));
      await tx.update(contentPieces).set({ status: "revision" }).where(eq(contentPieces.id, piece!.id));
    });

    await withUserContext({ sub: adminA, role: "authenticated" }, async (tx) => {
      await tx.update(contentPieces).set({ status: "aprobada" }).where(eq(contentPieces.id, piece!.id));
      const [pub] = await tx.update(contentPieces).set({ status: "publicada" }).where(eq(contentPieces.id, piece!.id)).returning();
      expect(pub?.publishedDate).toBeTruthy();

      const events = await tx.select().from(contentPieceEvents).where(eq(contentPieceEvents.pieceId, piece!.id)).orderBy(asc(contentPieceEvents.at));
      expect(events.map((e) => `${e.kind}:${e.from ?? ""}->${e.to ?? ""}`)).toEqual([
        "created:->idea",
        "status:idea->borrador",
        "rescheduled:2026-11-20 09:30->2026-11-21 14:00",
        `assigned:->${editorA}`,
        "status:borrador->revision",
        "status:revision->aprobada",
        "status:aprobada->publicada",
      ]);
      const [monotonic] = await tx.execute<{ ok: boolean }>(sql`
        select bool_and(next_at > at) as ok from (
          select at, lead(at) over (order by at asc) as next_at
          from public.content_piece_events where piece_id = ${piece!.id}::uuid
        ) s where next_at is not null
      `);
      expect(monotonic?.ok).toBe(true);
    });

    await expect(withUserContext({ sub: ownerA, role: "authenticated" }, (tx) =>
      tx.execute(sql`insert into public.content_piece_events (workspace_id, piece_id, kind, actor_id) values (${agencyAId}::uuid, ${piece!.id}::uuid, 'created', ${ownerA}::uuid)`),
    )).rejects.toThrow();
    await expect(withUserContext({ sub: ownerA, role: "authenticated" }, (tx) =>
      tx.execute(sql`delete from public.content_piece_events where piece_id = ${piece!.id}::uuid`),
    )).rejects.toThrow();
    await expectPgError(() =>
      db.execute(sql`insert into public.content_piece_events (workspace_id, piece_id, kind, actor_id) values (${agencyBId}::uuid, ${piece!.id}::uuid, 'created', ${ownerA}::uuid)`),
      /content_piece_events_workspace_piece_fk/, "23503",
    );
  });

  it("6. Regresiones de auditoría: TRUNCATE denegado (42501), marca privada protegida, borrado de marca con set null y edición tras baja de assignee", async () => {
    for (const table of ["public.brands", "public.content_pieces", "public.content_piece_events"]) {
      await expectPgError(
        () => withUserContext({ sub: ownerA, role: "authenticated" }, (tx) => tx.execute(sql.raw(`truncate ${table}`))),
        /permission denied/i, "42501",
      );
    }

    const [privBrandOwner] = await withUserContext({ sub: ownerA, role: "authenticated" }, (tx) =>
      tx.insert(brands).values({ workspaceId: agencyAId, createdBy: ownerA, name: "Marca Privada Owner", visibility: "private" }).returning());
    await withUserContext({ sub: adminA, role: "authenticated" }, async (tx) => {
      expect(await tx.update(brands).set({ name: "Intruso Admin" }).where(eq(brands.id, privBrandOwner!.id)).returning()).toEqual([]);
      expect(await tx.delete(brands).where(eq(brands.id, privBrandOwner!.id)).returning()).toEqual([]);
    });
    await expectPgError(() => withUserContext({ sub: editorA, role: "authenticated" }, (tx) =>
      tx.insert(contentPieces).values({
        workspaceId: agencyAId, brandId: privBrandOwner!.id, createdBy: editorA,
        title: "Intento con marca privada ajena", plannedDate: "2026-11-22",
      }),
    ), /brand_workspace_mismatch/, "23514");

    const [tempBrand] = await withUserContext({ sub: adminA, role: "authenticated" }, (tx) =>
      tx.insert(brands).values({ workspaceId: agencyAId, createdBy: adminA, name: "Marca Temporal" }).returning());
    const exMember = crypto.randomUUID();
    await db.insert(workspaceMembers).values({ workspaceId: agencyAId, userId: exMember, role: "editor" });
    const [pieceWithBrand] = await withUserContext({ sub: editorA, role: "authenticated" }, (tx) =>
      tx.insert(contentPieces).values({
        workspaceId: agencyAId, brandId: tempBrand!.id, createdBy: editorA,
        title: "Pieza sobreviviente", plannedDate: "2026-11-23", assigneeId: exMember,
      }).returning());

    await withUserContext({ sub: adminA, role: "authenticated" }, (tx) =>
      tx.delete(brands).where(eq(brands.id, tempBrand!.id)));
    await db.execute(sql`delete from public.workspace_members where workspace_id = ${agencyAId}::uuid and user_id = ${exMember}::uuid`);

    const [updatedAfterExit] = await withUserContext({ sub: editorA, role: "authenticated" }, (tx) =>
      tx.update(contentPieces).set({ status: "borrador", plannedDate: "2026-11-24" }).where(eq(contentPieces.id, pieceWithBrand!.id)).returning());
    expect(updatedAfterExit?.brandId).toBeNull();
    expect(updatedAfterExit?.assigneeId).toBe(exMember);
    expect(updatedAfterExit?.status).toBe("borrador");
  });
});

import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { withUserContext } from "../src/context";
import { getDb, resolveDatabaseUrl } from "../src/internal";
import * as schema from "../src/schema";
import { notes, todos, workspaceInvitations, workspaceMembers, workspaces } from "../src/schema";

const sha256Hex = (raw: string): string => createHash("sha256").update(raw, "utf8").digest("hex");
const expectPgError = async (fn: () => Promise<unknown>, pattern: RegExp) => {
  let caught: { message?: string; cause?: { message?: string } } | undefined;
  try { await fn(); } catch (e) { caught = e as typeof caught; }
  expect(caught?.cause?.message ?? caught?.message ?? "").toMatch(pattern);
};

describe("Fase 1B · Roles de agencia, invitaciones, visibilidad, reubicación y concurrencia RLS (ADR 0007)", { timeout: 30000 }, () => {
  const db = getDb();
  const runId = Math.random().toString(36).slice(2, 10);
  const ownerA = crypto.randomUUID(), adminA = crypto.randomUUID(), editorA = crypto.randomUUID(), viewerA = crypto.randomUUID();
  const ownerB = crypto.randomUUID(), unconfirmedU = crypto.randomUUID();
  let agencyAId = "", agencyBId = "", editorPersonalWsId = "";

  const insertInv = (tx: Parameters<Parameters<typeof withUserContext>[1]>[0], wsId: string, email: string, role: string, rawToken: string, invitedBy: string, offsetMs = 3600000) =>
    tx.execute(sql`insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by, expires_at) values (${wsId}::uuid, ${email}, ${role}, ${sha256Hex(rawToken)}, ${invitedBy}::uuid, ${new Date(Date.now() + offsetMs).toISOString()}::timestamptz)`);

  beforeAll(async () => {
    for (const [id, email, confirmed] of [
      [ownerA, `ownera-${runId}@hubly.local`, true], [adminA, `admina-${runId}@hubly.local`, true],
      [editorA, `editora-${runId}@hubly.local`, true], [viewerA, `viewera-${runId}@hubly.local`, true],
      [ownerB, `ownerb-${runId}@hubly.local`, true], [unconfirmedU, `unconf-${runId}@hubly.local`, false],
    ] as const) {
      await db.execute(sql`insert into auth.users (id, email, email_confirmed_at) values (${id}::uuid, ${email}, ${confirmed ? sql`now()` : sql`null`}) on conflict (id) do nothing`);
    }
    editorPersonalWsId = await withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => (await tx.execute<{ id: string }>(sql`select private.create_personal_workspace('Personal Editor', ${`p-ed-${runId}`}) as id`))[0]!.id);
    agencyAId = await withUserContext({ sub: ownerA, role: "authenticated" }, async (tx) => (await tx.execute<{ id: string }>(sql`select private.create_agency_workspace('Agencia A', ${`ag-a-${runId}`}) as id`))[0]!.id);
    agencyBId = await withUserContext({ sub: ownerB, role: "authenticated" }, async (tx) => (await tx.execute<{ id: string }>(sql`select private.create_agency_workspace('Agencia B', ${`ag-b-${runId}`}) as id`))[0]!.id);
  });

  it("1. Invitaciones: prohibición en espacio personal, correo verificado, uso único, revocación, caducidad y tope de 20", async () => {
    const tAdmin = `tok-adm-${runId}`, tEditor = `tok-ed-${runId}`, tViewer = `tok-vw-${runId}`, tRev = `tok-rev-${runId}`, tExp = `tok-exp-${runId}`;
    await expect(withUserContext({ sub: editorA, role: "authenticated" }, (tx) => insertInv(tx, editorPersonalWsId, `x-${runId}@hubly.local`, "editor", `p-${runId}`, editorA))).rejects.toThrow();
    await withUserContext({ sub: ownerA, role: "authenticated" }, async (tx) => {
      await insertInv(tx, agencyAId, `admina-${runId}@hubly.local`, "admin", tAdmin, ownerA);
      await insertInv(tx, agencyAId, `unconf-${runId}@hubly.local`, "viewer", `unconf-${runId}`, ownerA);
      await insertInv(tx, agencyAId, `rev-${runId}@hubly.local`, "viewer", tRev, ownerA);
      await insertInv(tx, agencyAId, `exp-${runId}@hubly.local`, "viewer", tExp, ownerA, -60000);
    });
    await expect(withUserContext({ sub: ownerB, role: "authenticated" }, (tx) => tx.execute(sql`select private.accept_workspace_invitation(${tAdmin})`))).rejects.toThrow();
    await expect(withUserContext({ sub: unconfirmedU, role: "authenticated" }, (tx) => tx.execute(sql`select private.accept_workspace_invitation(${`unconf-${runId}`})`))).rejects.toThrow();
    await expect(withUserContext({ sub: adminA, role: "authenticated" }, (tx) => tx.execute(sql`select private.accept_workspace_invitation(${tExp})`))).rejects.toThrow();
    await withUserContext({ sub: adminA, role: "authenticated" }, (tx) => tx.execute(sql`select private.accept_workspace_invitation(${tAdmin})`));
    await expect(withUserContext({ sub: adminA, role: "authenticated" }, (tx) => tx.execute(sql`select private.accept_workspace_invitation(${tAdmin})`))).rejects.toThrow();

    await expect(withUserContext({ sub: adminA, role: "authenticated" }, (tx) => insertInv(tx, agencyAId, `badadm-${runId}@hubly.local`, "admin", `bad-${runId}`, adminA))).rejects.toThrow();
    await withUserContext({ sub: adminA, role: "authenticated" }, async (tx) => {
      await insertInv(tx, agencyAId, `editora-${runId}@hubly.local`, "editor", tEditor, adminA);
      await insertInv(tx, agencyAId, `viewera-${runId}@hubly.local`, "viewer", tViewer, adminA);
      await tx.update(workspaceInvitations).set({ revokedAt: new Date() }).where(and(eq(workspaceInvitations.workspaceId, agencyAId), eq(workspaceInvitations.email, `rev-${runId}@hubly.local`)));
    });
    await expect(withUserContext({ sub: viewerA, role: "authenticated" }, (tx) => tx.execute(sql`select private.accept_workspace_invitation(${tRev})`))).rejects.toThrow();
    await withUserContext({ sub: editorA, role: "authenticated" }, (tx) => tx.execute(sql`select private.accept_workspace_invitation(${tEditor})`));
    await withUserContext({ sub: viewerA, role: "authenticated" }, (tx) => tx.execute(sql`select private.accept_workspace_invitation(${tViewer})`));
    await withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => {
      expect(await tx.execute(sql`select id, email, role from public.workspace_invitations where workspace_id = ${agencyAId}::uuid`)).toEqual([]);
    });
    await expect(withUserContext({ sub: ownerA, role: "authenticated" }, (tx) => tx.execute(sql`select token_hash from public.workspace_invitations limit 1`))).rejects.toThrow();
    await withUserContext({ sub: ownerB, role: "authenticated" }, async (tx) => {
      for (let i = 0; i < 20; i++) await insertInv(tx, agencyBId, `u${i}-${runId}@hubly.local`, "viewer", `b-${i}-${runId}`, ownerB);
    });
    await expectPgError(() => withUserContext({ sub: ownerB, role: "authenticated" }, (tx) => insertInv(tx, agencyBId, `u20-${runId}@hubly.local`, "viewer", `b-20-${runId}`, ownerB)), /20 invitaciones/);
  });

  it("2. Aislamiento entre agencias: otra agencia no puede leer ni modificar notas, miembros ni invitaciones", async () => {
    await withUserContext({ sub: ownerA, role: "authenticated" }, (tx) => tx.insert(notes).values({ workspaceId: agencyAId, createdBy: ownerA, visibility: "workspace", title: "Nota Agencia A" }));
    await withUserContext({ sub: ownerB, role: "authenticated" }, async (tx) => {
      expect(await tx.select().from(notes).where(eq(notes.workspaceId, agencyAId))).toEqual([]);
      expect(await tx.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, agencyAId))).toEqual([]);
      expect(await tx.execute(sql`select id from public.workspace_invitations where workspace_id = ${agencyAId}::uuid`)).toEqual([]);
    });
    await expect(withUserContext({ sub: ownerB, role: "authenticated" }, (tx) => tx.insert(notes).values({ workspaceId: agencyAId, createdBy: ownerB, visibility: "workspace", title: "Intruso" }))).rejects.toThrow();
  });

  it("3. Visibilidad private vs workspace, permisos por rol y desvinculación al privatizar nota (Detalle 1 de Claude)", async () => {
    const [nPrivOwner, nSharedOwner] = await withUserContext({ sub: ownerA, role: "authenticated" }, async (tx) => {
      const [p] = await tx.insert(notes).values({ workspaceId: agencyAId, createdBy: ownerA, visibility: "private", title: "Privada Owner" }).returning();
      const [s] = await tx.insert(notes).values({ workspaceId: agencyAId, createdBy: ownerA, visibility: "workspace", title: "Compartida Owner" }).returning();
      return [p!, s!];
    });
    const vPriv = await withUserContext({ sub: viewerA, role: "authenticated" }, async (tx) => {
      const visibleIds = (await tx.select().from(notes).where(eq(notes.workspaceId, agencyAId))).map((n) => n.id);
      expect(visibleIds).toContain(nSharedOwner.id);
      expect(visibleIds).not.toContain(nPrivOwner.id);
      const [vp] = await tx.insert(notes).values({ workspaceId: agencyAId, createdBy: viewerA, visibility: "private", title: "Privada Viewer" }).returning();
      expect(await tx.update(notes).set({ title: "Hack" }).where(eq(notes.id, nSharedOwner.id)).returning()).toEqual([]);
      return vp!;
    });
    await expect(withUserContext({ sub: viewerA, role: "authenticated" }, (tx) => tx.insert(notes).values({ workspaceId: agencyAId, createdBy: viewerA, visibility: "workspace", title: "X" }))).rejects.toThrow();
    await expect(withUserContext({ sub: viewerA, role: "authenticated" }, (tx) => tx.update(notes).set({ visibility: "workspace" }).where(eq(notes.id, vPriv.id)))).rejects.toThrow();

    const [nSharedEditor, tPrivEditorOnOwnerNote, tSharedEditorOnOwnerNote] = await withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => {
      expect((await tx.update(notes).set({ title: "Compartida Editada" }).where(eq(notes.id, nSharedOwner.id)).returning())[0]?.title).toBe("Compartida Editada");
      expect(await tx.delete(notes).where(eq(notes.id, nSharedOwner.id)).returning()).toEqual([]);
      const [ne] = await tx.insert(notes).values({ workspaceId: agencyAId, createdBy: editorA, visibility: "workspace", title: "Compartida Editor" }).returning();
      const [tp] = await tx.insert(todos).values({ workspaceId: agencyAId, createdBy: editorA, visibility: "private", noteId: nSharedOwner.id, title: "Todo Privado Editor" }).returning();
      const [ts] = await tx.insert(todos).values({ workspaceId: agencyAId, createdBy: editorA, visibility: "workspace", noteId: nSharedOwner.id, title: "Todo Compartido" }).returning();
      return [ne!, tp!, ts!];
    });
    await expect(withUserContext({ sub: editorA, role: "authenticated" }, (tx) => tx.update(notes).set({ visibility: "private" }).where(eq(notes.id, nSharedOwner.id)))).rejects.toThrow();
    await expect(withUserContext({ sub: ownerA, role: "authenticated" }, (tx) => tx.update(notes).set({ visibility: "private" }).where(eq(notes.id, nSharedEditor.id)))).rejects.toThrow();

    const [tPrivOwnerOnOwnerNote] = await withUserContext({ sub: ownerA, role: "authenticated" }, async (tx) => {
      const [to] = await tx.insert(todos).values({ workspaceId: agencyAId, createdBy: ownerA, visibility: "private", noteId: nSharedOwner.id, title: "Todo Privado Owner" }).returning();
      await tx.update(notes).set({ visibility: "private" }).where(eq(notes.id, nSharedOwner.id));
      return [to!];
    });
    expect((await db.select().from(todos).where(eq(todos.id, tPrivOwnerOnOwnerNote.id)))[0]?.noteId).toBe(nSharedOwner.id);
    expect((await db.select().from(todos).where(eq(todos.id, tPrivEditorOnOwnerNote.id)))[0]?.noteId).toBeNull();
    expect((await db.select().from(todos).where(eq(todos.id, tSharedEditorOnOwnerNote.id)))[0]?.noteId).toBeNull();

    await expectPgError(() => withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => {
      await tx.execute(sql`select set_config('hubly.relocating_private_items', 'on', true)`);
      await tx.update(notes).set({ workspaceId: editorPersonalWsId }).where(eq(notes.id, nSharedEditor.id));
    }), /No se permite mover elementos entre espacios de trabajo/);
  });

  it("4. Jerarquía de roles, prohibición de auto-escalado y protección del último owner (trg_01 antes de trg_02)", async () => {
    await withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => {
      expect(await tx.update(workspaceMembers).set({ role: "admin" }).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.userId, editorA))).returning()).toEqual([]);
    });
    await withUserContext({ sub: adminA, role: "authenticated" }, async (tx) => {
      expect(await tx.update(workspaceMembers).set({ role: "admin" }).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.userId, adminA))).returning()).toEqual([]);
      expect(await tx.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.userId, ownerA))).returning()).toEqual([]);
    });
    await expect(withUserContext({ sub: adminA, role: "authenticated" }, (tx) => tx.update(workspaceMembers).set({ role: "owner" }).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.userId, viewerA))))).rejects.toThrow();
    await expectPgError(() => withUserContext({ sub: ownerA, role: "authenticated" }, (tx) => tx.update(workspaceMembers).set({ role: "admin" }).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.userId, ownerA)))), /al menos un propietario/);
    await expectPgError(() => withUserContext({ sub: ownerA, role: "authenticated" }, (tx) => tx.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.userId, ownerA)))), /al menos un propietario/);
    expect((await db.select().from(notes).where(and(eq(notes.workspaceId, agencyAId), eq(notes.createdBy, ownerA)))).length).toBeGreaterThanOrEqual(2);
  });

  it("5. Reubicación de elementos privados al salir de la agencia conservando note_id con FK diferible (Detalles 2 y 3 de Claude)", async () => {
    const [nSharedA] = await withUserContext({ sub: ownerA, role: "authenticated" }, (tx) => tx.insert(notes).values({ workspaceId: agencyAId, createdBy: ownerA, visibility: "workspace", title: "Nota Agencia Persistente" }).returning());
    const [nPrivEd, tPrivLinkedPriv, tPrivLinkedShared, nSharedEd] = await withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => {
      const [np] = await tx.insert(notes).values({ workspaceId: agencyAId, createdBy: editorA, visibility: "private", title: "Borrador Privado Editor" }).returning();
      const [tp1] = await tx.insert(todos).values({ workspaceId: agencyAId, createdBy: editorA, visibility: "private", noteId: np!.id, title: "Pendiente Privado Ligado a Nota Privada" }).returning();
      const [tp2] = await tx.insert(todos).values({ workspaceId: agencyAId, createdBy: editorA, visibility: "private", noteId: nSharedA!.id, title: "Pendiente Privado Ligado a Nota Agencia" }).returning();
      const [ns] = await tx.insert(notes).values({ workspaceId: agencyAId, createdBy: editorA, visibility: "workspace", title: "Entregable Compartido Editor" }).returning();
      return [np!, tp1!, tp2!, ns!];
    });
    await withUserContext({ sub: editorA, role: "authenticated" }, (tx) => tx.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.userId, editorA))));

    await withUserContext({ sub: editorA, role: "authenticated" }, async (tx) => {
      expect(await tx.select().from(notes).where(eq(notes.workspaceId, agencyAId))).toEqual([]);
      const [relocNote] = await tx.select().from(notes).where(eq(notes.id, nPrivEd.id));
      const [relocTodo1] = await tx.select().from(todos).where(eq(todos.id, tPrivLinkedPriv.id));
      const [relocTodo2] = await tx.select().from(todos).where(eq(todos.id, tPrivLinkedShared.id));
      expect(relocNote?.workspaceId).toBe(editorPersonalWsId);
      expect(relocTodo1?.workspaceId).toBe(editorPersonalWsId);
      expect(relocTodo1?.noteId).toBe(nPrivEd.id);
      expect(relocTodo2?.workspaceId).toBe(editorPersonalWsId);
      expect(relocTodo2?.noteId).toBeNull();
    });
    expect((await db.select().from(notes).where(eq(notes.id, nSharedEd.id)))[0]?.workspaceId).toBe(agencyAId);
  });

  it("6. Concurrencia real del último owner con dos conexiones independientes (FOR UPDATE + pg_advisory_xact_lock)", async () => {
    await withUserContext({ sub: ownerA, role: "authenticated" }, (tx) =>
      tx.update(workspaceMembers).set({ role: "owner" }).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.userId, adminA))),
    );
    const url = resolveDatabaseUrl();
    const sql1 = postgres(url, { max: 1, prepare: false }), sql2 = postgres(url, { max: 1, prepare: false });
    const db1 = drizzle(sql1, { schema }), db2 = drizzle(sql2, { schema });
    try {
      let ready = 0;
      let release!: () => void;
      const barrier = new Promise<void>((r) => { release = r; });
      const arrive = async () => { if (++ready === 2) release(); await barrier; };

      const results = await Promise.allSettled([
        withUserContext({ sub: ownerA, role: "authenticated" }, async (tx) => {
          await arrive();
          await tx.update(workspaceMembers).set({ role: "admin" }).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.userId, ownerA)));
        }, db1),
        withUserContext({ sub: adminA, role: "authenticated" }, async (tx) => {
          await arrive();
          await tx.update(workspaceMembers).set({ role: "admin" }).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.userId, adminA)));
        }, db2),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const errMsg = String(rejected[0]?.reason?.cause?.message ?? rejected[0]?.reason?.message ?? "");
      expect(errMsg).toMatch(/al menos un propietario/);

      const remainingOwners = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, agencyAId), eq(workspaceMembers.role, "owner")));
      expect(remainingOwners).toHaveLength(1);
    } finally {
      await Promise.all([sql1.end(), sql2.end()]);
    }
    await db.delete(workspaces).where(eq(workspaces.id, agencyBId));
    expect(await db.select().from(workspaces).where(eq(workspaces.id, agencyBId))).toEqual([]);
  });
});

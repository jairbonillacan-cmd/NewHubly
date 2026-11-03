import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import { withUserContext } from "../src/context";
import { notes, todos, workspaces, workspaceMembers } from "../src/schema";
import { getDb } from "../src/internal";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function isPostgresAvailable(): Promise<boolean> {
  try {
    const client = postgres(connectionString, { connect_timeout: 1, max: 1 });
    await client`select 1`;
    await client.end();
    return true;
  } catch {
    return false;
  }
}

describe("Aislamiento Multi-inquilino y RLS en Docker (ADR 0003, ADR 0004 & Issue #23)", { timeout: 30000 }, () => {
  const db = getDb();

  beforeAll(async () => {
    const available = await isPostgresAvailable();
    if (!available) {
      throw new Error(
        "Base de datos Postgres no disponible: la suite de aislamiento requiere Postgres en ejecución (Constitución Ingeniería #3 y Claude Punto 2)",
      );
    }
  });

  // IDs únicos generados por ejecución para garantizar idempotencia
  const runId = Math.random().toString(36).slice(2, 10);
  const slugA = `espacio-a-${runId}`;
  const slugB = `espacio-b-${runId}`;
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const userC = crypto.randomUUID();

  it("creación atómica de espacio personal via private.create_personal_workspace()", async () => {
    const wsId = await withUserContext({ sub: userA, role: "authenticated" }, async (tx) => {
      const res = await tx.execute<{ create_personal_workspace: string }>(
        sql`select private.create_personal_workspace('Espacio Personal A', ${slugA}) as create_personal_workspace`,
      );
      return res[0]?.create_personal_workspace;
    });

    expect(wsId).toBeDefined();

    // Comprobar que el espacio y la membresía existen
    const ws = await db.select().from(workspaces).where(eq(workspaces.id, wsId!));
    expect(ws.length).toBe(1);
    expect(ws[0]?.name).toBe("Espacio Personal A");

    const member = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, wsId!));
    expect(member.length).toBe(1);
    expect(member[0]?.userId).toBe(userA);
    expect(member[0]?.role).toBe("owner");
  });

  it("Escenario 1: Cross-tenant (Usuario B en Workspace B no accede a registros de Usuario A en Workspace A)", async () => {
    // Provisión de Workspace B para Usuario B
    const wsBId = await withUserContext({ sub: userB, role: "authenticated" }, async (tx) => {
      const res = await tx.execute<{ create_personal_workspace: string }>(
        sql`select private.create_personal_workspace('Espacio B', ${slugB}) as create_personal_workspace`,
      );
      return res[0]?.create_personal_workspace;
    });

    // Obtener Workspace A
    const [wsA] = await db.select().from(workspaces).where(eq(workspaces.slug, slugA));
    expect(wsA).toBeDefined();
    const wsAId = wsA!.id;

    // Usuario A crea una nota y un pendiente en su espacio
    const [noteA] = await withUserContext({ sub: userA, role: "authenticated" }, async (tx) => {
      return await tx
        .insert(notes)
        .values({
          workspaceId: wsAId,
          createdBy: userA,
          title: "Nota confidencial A",
          content: "Contenido de A",
        })
        .returning();
    });
    expect(noteA).toBeDefined();

    const [todoA] = await withUserContext({ sub: userA, role: "authenticated" }, async (tx) => {
      return await tx
        .insert(todos)
        .values({
          workspaceId: wsAId,
          createdBy: userA,
          title: "Pendiente confidencial A",
        })
        .returning();
    });
    expect(todoA).toBeDefined();

    // 1. Usuario B intenta leer notas de A -> debe retornar 0 notas
    const notesSeenByB = await withUserContext({ sub: userB, role: "authenticated" }, async (tx) => {
      return await tx.select().from(notes).where(eq(notes.id, noteA!.id));
    });
    expect(notesSeenByB.length).toBe(0);

    // 2. Usuario B intenta leer pendientes de A -> debe retornar 0 pendientes
    const todosSeenByB = await withUserContext({ sub: userB, role: "authenticated" }, async (tx) => {
      return await tx.select().from(todos).where(eq(todos.id, todoA!.id));
    });
    expect(todosSeenByB.length).toBe(0);

    // 3. Usuario B intenta insertar una nota con el workspace_id de A -> bloqueado por RLS (with check)
    await expect(
      withUserContext({ sub: userB, role: "authenticated" }, async (tx) => {
        await tx.insert(notes).values({
          workspaceId: wsAId,
          createdBy: userB,
          title: "Infiltración B en A",
        });
      }),
    ).rejects.toThrow();

    // 4. Usuario B intenta modificar la nota de A -> RLS deniega y no modifica filas
    const updateResult = await withUserContext({ sub: userB, role: "authenticated" }, async (tx) => {
      return await tx
        .update(notes)
        .set({ title: "Título alterado por B" })
        .where(eq(notes.id, noteA!.id))
        .returning();
    });
    expect(updateResult.length).toBe(0);

    // 5. Usuario B intenta eliminar la nota de A -> RLS deniega y no elimina filas
    const deleteResult = await withUserContext({ sub: userB, role: "authenticated" }, async (tx) => {
      return await tx.delete(notes).where(eq(notes.id, noteA!.id)).returning();
    });
    expect(deleteResult.length).toBe(0);

    // 6. Usuario B crea una nota en su Workspace B e intenta moverla al Workspace A -> bloqueado
    const [noteB] = await withUserContext({ sub: userB, role: "authenticated" }, async (tx) => {
      return await tx
        .insert(notes)
        .values({
          workspaceId: wsBId!,
          createdBy: userB,
          title: "Nota legítima B",
        })
        .returning();
    });

    await expect(
      withUserContext({ sub: userB, role: "authenticated" }, async (tx) => {
        await tx
          .update(notes)
          .set({ workspaceId: wsAId })
          .where(eq(notes.id, noteB!.id));
      }),
    ).rejects.toThrow();
  });

  it("Escenario 2: Same-workspace private items y prevención de vincular nota ajena (Punto 4 - Claude)", async () => {
    const [wsA] = await db.select().from(workspaces).where(eq(workspaces.slug, slugA));
    const wsAId = wsA!.id;

    // Agregar Usuario C como miembro de Workspace A
    await db.insert(workspaceMembers).values({
      workspaceId: wsAId,
      userId: userC,
      role: "member",
    });

    // Usuario A crea una nota y un pendiente en Workspace A
    const [notePrivateA] = await withUserContext({ sub: userA, role: "authenticated" }, async (tx) => {
      return await tx
        .insert(notes)
        .values({
          workspaceId: wsAId,
          createdBy: userA,
          title: "Nota privada autor A",
          content: "Solo visible para A en 1A",
        })
        .returning();
    });

    const [todoPrivateA] = await withUserContext({ sub: userA, role: "authenticated" }, async (tx) => {
      return await tx
        .insert(todos)
        .values({
          workspaceId: wsAId,
          createdBy: userA,
          title: "Pendiente privado autor A",
        })
        .returning();
    });

    // 1. Usuario C (mismo workspace) consulta notas -> no ve la nota privada de A
    const notesSeenByC = await withUserContext({ sub: userC, role: "authenticated" }, async (tx) => {
      return await tx.select().from(notes).where(eq(notes.workspaceId, wsAId));
    });
    expect(notesSeenByC.some((n) => n.id === notePrivateA!.id)).toBe(false);

    // 2. Usuario C consulta pendientes -> no ve el pendiente privado de A
    const todosSeenByC = await withUserContext({ sub: userC, role: "authenticated" }, async (tx) => {
      return await tx.select().from(todos).where(eq(todos.workspaceId, wsAId));
    });
    expect(todosSeenByC.some((t) => t.id === todoPrivateA!.id)).toBe(false);

    // 3. Usuario C no puede actualizar ni borrar la nota de A
    const updateByC = await withUserContext({ sub: userC, role: "authenticated" }, async (tx) => {
      return await tx
        .update(notes)
        .set({ title: "Alterado por C" })
        .where(eq(notes.id, notePrivateA!.id))
        .returning();
    });
    expect(updateByC.length).toBe(0);

    const deleteByC = await withUserContext({ sub: userC, role: "authenticated" }, async (tx) => {
      return await tx.delete(notes).where(eq(notes.id, notePrivateA!.id)).returning();
    });
    expect(deleteByC.length).toBe(0);

    // 4. Usuario C intenta crear un pendiente vinculado a la nota de Usuario A -> bloqueado (Punto 4 - Claude)
    await expect(
      withUserContext({ sub: userC, role: "authenticated" }, async (tx) => {
        await tx.insert(todos).values({
          workspaceId: wsAId,
          createdBy: userC,
          noteId: notePrivateA!.id,
          title: "Pendiente de C intentando ligarse a nota ajena de A",
        });
      }),
    ).rejects.toThrow();

    // 5. Usuario C crea un pendiente legítimo e intenta actualizarlo ligándolo a la nota ajena de A -> bloqueado (Punto 4 - Claude)
    const [todoC] = await withUserContext({ sub: userC, role: "authenticated" }, async (tx) => {
      return await tx
        .insert(todos)
        .values({
          workspaceId: wsAId,
          createdBy: userC,
          title: "Pendiente legítimo de C",
        })
        .returning();
    });

    await expect(
      withUserContext({ sub: userC, role: "authenticated" }, async (tx) => {
        await tx
          .update(todos)
          .set({ noteId: notePrivateA!.id })
          .where(eq(todos.id, todoC!.id));
      }),
    ).rejects.toThrow();
  });

  it("Escenario 3: Integridad de FK compuesta on delete set null (note_id) al borrar nota (Punto 1 - Claude)", async () => {
    const [wsA] = await db.select().from(workspaces).where(eq(workspaces.slug, slugA));
    const wsAId = wsA!.id;

    // Usuario A crea nota y pendiente enlazado con FK compuesta (workspace_id, note_id)
    const [noteLinked] = await withUserContext({ sub: userA, role: "authenticated" }, async (tx) => {
      return await tx
        .insert(notes)
        .values({
          workspaceId: wsAId,
          createdBy: userA,
          title: "Nota para probar FK compuesta",
        })
        .returning();
    });

    const [todoLinked] = await withUserContext({ sub: userA, role: "authenticated" }, async (tx) => {
      return await tx
        .insert(todos)
        .values({
          workspaceId: wsAId,
          createdBy: userA,
          noteId: noteLinked!.id,
          title: "Pendiente ligado a nota",
        })
        .returning();
    });
    expect(todoLinked!.noteId).toBe(noteLinked!.id);

    // Usuario A borra la nota enlazada
    await withUserContext({ sub: userA, role: "authenticated" }, async (tx) => {
      await tx.delete(notes).where(eq(notes.id, noteLinked!.id));
    });

    // El pendiente debe persistir con note_id = null y su workspace_id inalterado
    const [persistedTodo] = await withUserContext({ sub: userA, role: "authenticated" }, async (tx) => {
      return await tx.select().from(todos).where(eq(todos.id, todoLinked!.id));
    });

    expect(persistedTodo).toBeDefined();
    expect(persistedTodo!.noteId).toBeNull();
    expect(persistedTodo!.workspaceId).toBe(wsAId);
  });

  it("Certificación Issue #28 (1-5): SELECT aislado, SELECT por ID, INSERT inyectado, UPDATE cruzado y DELETE cruzado de pendiente", async () => {
    const [wsA] = await db.select().from(workspaces).where(eq(workspaces.slug, slugA));
    const wsAId = wsA!.id;
    const [nA, tA1, tA2] = await withUserContext({ sub: userA, role: "authenticated" }, async (tx) => {
      const [n] = await tx.insert(notes).values({ workspaceId: wsAId, createdBy: userA, title: "Nota 28-A", content: "Secreto" }).returning();
      const [t1] = await tx.insert(todos).values({ workspaceId: wsAId, createdBy: userA, title: "Todo 28-A1" }).returning();
      const [t2] = await tx.insert(todos).values({ workspaceId: wsAId, createdBy: userA, title: "Todo 28-A2" }).returning();
      return [n!, t1!, t2!];
    });
    await withUserContext({ sub: userB, role: "authenticated" }, async (tx) => {
      expect(await tx.select().from(notes).where(eq(notes.workspaceId, wsAId))).toEqual([]);
      expect(await tx.select().from(todos).where(eq(todos.workspaceId, wsAId))).toEqual([]);
      expect(await tx.select().from(notes).where(eq(notes.id, nA.id))).toEqual([]);
      expect(await tx.select().from(todos).where(eq(todos.id, tA1.id))).toEqual([]);
      expect(await tx.select().from(todos).where(eq(todos.id, tA2.id))).toEqual([]);
    });
    await expect(withUserContext({ sub: userB, role: "authenticated" }, (tx) => tx.insert(notes).values({ workspaceId: wsAId, createdBy: userB, title: "X" }))).rejects.toThrow();
    await expect(withUserContext({ sub: userB, role: "authenticated" }, (tx) => tx.insert(todos).values({ workspaceId: wsAId, createdBy: userB, title: "X" }))).rejects.toThrow();
    const upd = await withUserContext({ sub: userB, role: "authenticated" }, (tx) => tx.update(notes).set({ title: "Hack" }).where(eq(notes.id, nA.id)).returning());
    expect(upd).toEqual([]);
    expect((await db.select().from(notes).where(eq(notes.id, nA.id)))[0]?.title).toBe("Nota 28-A");
    const del = await withUserContext({ sub: userB, role: "authenticated" }, (tx) => tx.delete(todos).where(eq(todos.id, tA1.id)).returning());
    expect(del).toEqual([]);
    expect((await db.select().from(todos).where(eq(todos.id, tA1.id)))[0]?.title).toBe("Todo 28-A1");
  });

  it("Certificación Issue #28 (6-7): FK compuesta cross-workspace (ADR 0003) y rechazo de petición anónima", async () => {
    const [wsA] = await db.select().from(workspaces).where(eq(workspaces.slug, slugA));
    const [wsB] = await db.select().from(workspaces).where(eq(workspaces.slug, slugB));
    const [noteA] = await db.select().from(notes).where(eq(notes.workspaceId, wsA!.id)).limit(1);
    await expect(withUserContext({ sub: userB, role: "authenticated" }, (tx) => tx.insert(todos).values({ workspaceId: wsB!.id, createdBy: userB, noteId: noteA!.id, title: "Cross FK" }))).rejects.toThrow();
    await expect(db.insert(todos).values({ workspaceId: wsB!.id, createdBy: userB, noteId: noteA!.id, title: "Cross FK raw" })).rejects.toThrow();
    await expect(withUserContext({ sub: "", role: "anon" }, async () => {})).rejects.toThrow();
    await expect(db.transaction(async (tx) => { await tx.execute(sql`set local role anon`); await tx.select().from(notes); })).rejects.toThrow();
    await expect(db.transaction(async (tx) => { await tx.execute(sql`set local role anon`); await tx.select().from(todos); })).rejects.toThrow();
  });
});

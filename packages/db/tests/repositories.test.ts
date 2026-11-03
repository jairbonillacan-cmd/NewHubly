import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { ConcurrencyError } from "@hubly/domain";
import { DrizzleNoteRepository, DrizzleTodoRepository, DrizzleWorkspaceRepository, type UserClaims } from "../src/index";

function createMockDb(state: {
  notes: Record<string, unknown>[]; todos: Record<string, unknown>[];
  workspaces: Record<string, unknown>[]; members: Record<string, unknown>[];
}) {
  const nameOf = (t: unknown) => (t as { [k: symbol]: string })?.[Symbol.for("drizzle:Name")];
  const tx = {
    execute: vi.fn().mockImplementation(async () => [{ id: "w-provisioned" }]),
    select: vi.fn().mockImplementation(() => ({
      from: (table: unknown) => ({
        where: () => {
          const n = nameOf(table);
          const rows = n === "notes" ? state.notes : n === "todos" ? state.todos : n === "workspaces" ? state.workspaces : state.members;
          return {
            limit: async (c: number) => rows.slice(0, c),
            orderBy: async () => [...rows],
            then: (res: (v: unknown[]) => unknown) => Promise.resolve([...rows]).then(res),
          };
        },
      }),
    })),
    insert: vi.fn().mockImplementation((table: unknown) => ({
      values: async (val: Record<string, unknown>) => {
        const n = nameOf(table);
        if (n === "notes") state.notes.push(val);
        if (n === "todos") state.todos.push(val);
      },
    })),
    update: vi.fn().mockImplementation((table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          const n = nameOf(table);
          if (n === "notes") {
            const target = state.notes[0];
            if (!target || target.conflict) return { returning: async () => [] };
            Object.assign(target, vals);
            return { returning: async () => [{ version: vals.version }] };
          }
          if (n === "todos" && state.todos[0]) Object.assign(state.todos[0], vals);
          return Promise.resolve([]);
        },
      }),
    })),
    delete: vi.fn().mockImplementation((table: unknown) => ({
      where: async () => {
        const n = nameOf(table);
        if (n === "notes") state.notes.length = 0;
        if (n === "todos") state.todos.length = 0;
      },
    })),
  };
  return { tx, db: { transaction: vi.fn().mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) } };
}

describe("Repositorios Drizzle y aislamiento con withUserContext (#25)", () => {
  const claims: UserClaims = { sub: "u-1", role: "authenticated" };

  it("DrizzleNoteRepository ejecuta cada operación dentro de withUserContext y verifica concurrencia atómica", async () => {
    const state = { notes: [] as Record<string, unknown>[], todos: [], workspaces: [], members: [] };
    const { db, tx } = createMockDb(state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new DrizzleNoteRepository(claims, "w-1", db as any);
    const now = "2026-11-03T10:00:00.000Z";
    await repo.save({ id: "n-1", workspaceId: "w-1", createdBy: "u-1", title: "Nota 1", content: "Texto", isPinned: false, isArchived: false, version: 1, createdAt: now, updatedAt: now });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.execute).toHaveBeenCalledTimes(3);
    expect((await repo.findById("n-1"))?.title).toBe("Nota 1");
    await repo.save({ id: "n-1", workspaceId: "w-1", createdBy: "u-1", title: "Nota 1 editada", content: "Texto 2", isPinned: true, isArchived: false, version: 2, createdAt: now, updatedAt: now });
    expect((await repo.listByWorkspace("w-1", "u-1", { isPinned: true, query: "editada" }))[0]?.version).toBe(2);
    state.notes[0]!.conflict = true;
    await expect(repo.save({ id: "n-1", workspaceId: "w-1", createdBy: "u-1", title: "Conflicto", content: "X", isPinned: true, isArchived: false, version: 3, createdAt: now, updatedAt: now })).rejects.toThrow(ConcurrencyError);
    await repo.delete("n-1");
    expect(state.notes).toHaveLength(0);
  });

  it("DrizzleTodoRepository y DrizzleWorkspaceRepository operan con withUserContext y ordenan Hoy", async () => {
    const now = new Date("2026-11-03T10:00:00.000Z");
    const state = {
      notes: [],
      todos: [
        { id: "t-today", workspaceId: "w-1", createdBy: "u-1", noteId: null, title: "Hoy", detail: "", dueDate: "2026-11-03", priority: "low", isDone: false, doneAt: null, createdAt: now, updatedAt: now },
        { id: "t-over", workspaceId: "w-1", createdBy: "u-1", noteId: "n-1", title: "Vencido", detail: "D", dueDate: "2026-11-01", priority: "high", isDone: false, doneAt: null, createdAt: now, updatedAt: now },
      ] as Record<string, unknown>[],
      workspaces: [{ id: "w-1", name: "Hubly", slug: "hubly", createdAt: now, updatedAt: now }],
      members: [{ workspaceId: "w-1", userId: "u-1", role: "owner", createdAt: now }],
    };
    const { db } = createMockDb(state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todoRepo = new DrizzleTodoRepository(claims, "w-1", db as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wsRepo = new DrizzleWorkspaceRepository(claims, db as any);
    expect((await todoRepo.findTodayAndOverdue("w-1", "u-1", "2026-11-03")).map((t) => t.id)).toEqual(["t-over", "t-today"]);
    expect((await todoRepo.listByNoteId("w-1", "n-1")).length).toBeGreaterThan(0);
    expect((await wsRepo.findById("w-1"))?.slug).toBe("hubly");
    expect((await wsRepo.findMember("w-1", "u-1"))?.role).toBe("owner");
    expect(await wsRepo.ensurePersonalWorkspace("Mi Espacio")).toBe("w-1");
    state.members.length = 0;
    expect(await wsRepo.ensurePersonalWorkspace("Nuevo Espacio")).toBe("w-provisioned");
  });
});

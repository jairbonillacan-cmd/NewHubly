import "server-only";
import { and, asc, desc, eq, ilike, isNull, lte, or, sql } from "drizzle-orm";
import type { Note as DomainNote, Todo as DomainTodo } from "@hubly/domain";
import { ConcurrencyError, sortTodosForView } from "@hubly/domain";
import type { NoteFilter, NoteRepository, TodoFilter, TodoRepository } from "@hubly/application";
import { withUserContext, type UserClaims } from "../context";
import { notes, todos, workspaceMembers, workspaces, type Workspace, type WorkspaceMember } from "../schema";

type DbInstance = Parameters<typeof withUserContext>[2];
export interface NoteSearchFilter extends NoteFilter { query?: string; }
export interface WorkspaceRepository {
  findById(workspaceId: string): Promise<Workspace | null>;
  findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  createPersonalWorkspace(name: string, slug?: string | null): Promise<string>;
  ensurePersonalWorkspace(defaultName?: string): Promise<string>;
}

const toIso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export class DrizzleNoteRepository implements NoteRepository {
  private readVersions = new Map<string, number>();
  constructor(private readonly claims: UserClaims, private readonly workspaceId: string, private readonly db?: DbInstance) {}

  private mapRow(r: typeof notes.$inferSelect): DomainNote {
    this.readVersions.set(r.id, r.version);
    return { id: r.id, workspaceId: r.workspaceId, createdBy: r.createdBy, title: r.title, content: r.content, isPinned: r.isPinned, isArchived: r.isArchived, version: r.version, createdAt: toIso(r.createdAt), updatedAt: toIso(r.updatedAt) };
  }

  async findById(idOrWs: string, createdBy?: string, noteId?: string): Promise<DomainNote | null> {
    const [wsId, uId, id] = noteId !== undefined ? [idOrWs, createdBy!, noteId] : [this.workspaceId, this.claims.sub, idOrWs];
    return withUserContext(this.claims, async (tx) => {
      const [row] = await tx.select().from(notes).where(and(eq(notes.id, id), eq(notes.workspaceId, wsId), eq(notes.createdBy, uId))).limit(1);
      return row ? this.mapRow(row) : null;
    }, this.db);
  }

  async findByWorkspace(workspaceId: string, userId: string, filter?: NoteSearchFilter): Promise<DomainNote[]> {
    return withUserContext(this.claims, async (tx) => {
      const conds = [eq(notes.workspaceId, workspaceId), eq(notes.createdBy, userId)];
      if (filter?.isPinned !== undefined) conds.push(eq(notes.isPinned, filter.isPinned));
      if (filter?.isArchived !== undefined) conds.push(eq(notes.isArchived, filter.isArchived));
      if (filter?.query?.trim()) {
        const q = `%${filter.query.trim()}%`;
        const searchCond = or(ilike(notes.title, q), ilike(notes.content, q));
        if (searchCond) conds.push(searchCond);
      }
      const rows = await tx.select().from(notes).where(and(...conds)).orderBy(desc(notes.isPinned), desc(notes.updatedAt));
      return rows.map((r) => this.mapRow(r));
    }, this.db);
  }

  listByWorkspace(workspaceId: string, createdBy: string, filter?: NoteSearchFilter): Promise<DomainNote[]> {
    return this.findByWorkspace(workspaceId, createdBy, filter);
  }

  async save(note: DomainNote): Promise<void> {
    await withUserContext(this.claims, async (tx) => {
      const [existing] = await tx.select().from(notes).where(and(eq(notes.id, note.id), eq(notes.workspaceId, note.workspaceId), eq(notes.createdBy, this.claims.sub))).limit(1);
      if (!existing) {
        if (note.version !== 1) throw new ConcurrencyError(note.version - 1, 0);
        await tx.insert(notes).values({ id: note.id, workspaceId: note.workspaceId, createdBy: note.createdBy, title: note.title, content: note.content, isPinned: note.isPinned, isArchived: note.isArchived, version: note.version, createdAt: new Date(note.createdAt), updatedAt: new Date(note.updatedAt) });
        this.readVersions.set(note.id, note.version);
        return;
      }
      const expectedVersion = this.readVersions.get(note.id) ?? (note.version > 1 ? note.version - 1 : existing.version);
      const updated = await tx.update(notes).set({ title: note.title, content: note.content, isPinned: note.isPinned, isArchived: note.isArchived, version: note.version, updatedAt: new Date(note.updatedAt) }).where(and(eq(notes.id, note.id), eq(notes.workspaceId, note.workspaceId), eq(notes.createdBy, this.claims.sub), eq(notes.version, expectedVersion))).returning({ version: notes.version });
      if (updated.length === 0) throw new ConcurrencyError(expectedVersion, existing.version);
      this.readVersions.set(note.id, note.version);
    }, this.db);
  }

  async delete(idOrWs: string, createdBy?: string, noteId?: string): Promise<void> {
    const [wsId, uId, id] = noteId !== undefined ? [idOrWs, createdBy!, noteId] : [this.workspaceId, this.claims.sub, idOrWs];
    await withUserContext(this.claims, async (tx) => {
      await tx.delete(notes).where(and(eq(notes.id, id), eq(notes.workspaceId, wsId), eq(notes.createdBy, uId)));
    }, this.db);
  }
}

export class DrizzleTodoRepository implements TodoRepository {
  constructor(private readonly claims: UserClaims, private readonly workspaceId: string, private readonly db?: DbInstance) {}

  private mapRow(r: typeof todos.$inferSelect): DomainTodo {
    return { id: r.id, workspaceId: r.workspaceId, createdBy: r.createdBy, noteId: r.noteId ?? null, title: r.title, detail: r.detail, dueDate: r.dueDate ?? null, priority: r.priority, isDone: r.isDone, doneAt: r.doneAt ? toIso(r.doneAt) : null, createdAt: toIso(r.createdAt), updatedAt: toIso(r.updatedAt) };
  }

  async findById(idOrWs: string, createdBy?: string, todoId?: string): Promise<DomainTodo | null> {
    const [wsId, uId, id] = todoId !== undefined ? [idOrWs, createdBy!, todoId] : [this.workspaceId, this.claims.sub, idOrWs];
    return withUserContext(this.claims, async (tx) => {
      const [row] = await tx.select().from(todos).where(and(eq(todos.id, id), eq(todos.workspaceId, wsId), eq(todos.createdBy, uId))).limit(1);
      return row ? this.mapRow(row) : null;
    }, this.db);
  }

  async findByWorkspace(workspaceId: string, userId: string, filter?: TodoFilter): Promise<DomainTodo[]> {
    return withUserContext(this.claims, async (tx) => {
      const conds = [eq(todos.workspaceId, workspaceId), eq(todos.createdBy, userId)];
      if (filter?.noteId !== undefined) conds.push(filter.noteId === null ? isNull(todos.noteId) : eq(todos.noteId, filter.noteId));
      if (filter?.isDone !== undefined) conds.push(eq(todos.isDone, filter.isDone));
      const rows = await tx.select().from(todos).where(and(...conds)).orderBy(asc(todos.dueDate), asc(todos.createdAt));
      return rows.map((r) => this.mapRow(r));
    }, this.db);
  }

  listByWorkspace(workspaceId: string, createdBy: string, filter?: TodoFilter): Promise<DomainTodo[]> {
    return this.findByWorkspace(workspaceId, createdBy, filter);
  }

  async findTodayAndOverdue(workspaceId: string, userId: string, refDate: string): Promise<DomainTodo[]> {
    const rows = await withUserContext(this.claims, async (tx) => {
      const res = await tx.select().from(todos).where(and(eq(todos.workspaceId, workspaceId), eq(todos.createdBy, userId), eq(todos.isDone, false), lte(todos.dueDate, refDate)));
      return res.map((r) => this.mapRow(r));
    }, this.db);
    return sortTodosForView(rows, "today", refDate);
  }

  async listByNoteId(workspaceId: string, noteId: string): Promise<DomainTodo[]> {
    return this.findByWorkspace(workspaceId, this.claims.sub, { noteId });
  }

  async save(todo: DomainTodo): Promise<void> {
    await withUserContext(this.claims, async (tx) => {
      const [existing] = await tx.select().from(todos).where(and(eq(todos.id, todo.id), eq(todos.workspaceId, todo.workspaceId), eq(todos.createdBy, this.claims.sub))).limit(1);
      const values = { title: todo.title, detail: todo.detail, noteId: todo.noteId ?? null, dueDate: todo.dueDate ?? null, priority: todo.priority, isDone: todo.isDone, doneAt: todo.doneAt ? new Date(todo.doneAt) : null, updatedAt: new Date(todo.updatedAt) };
      if (!existing) {
        await tx.insert(todos).values({ id: todo.id, workspaceId: todo.workspaceId, createdBy: todo.createdBy, createdAt: new Date(todo.createdAt), ...values });
        return;
      }
      await tx.update(todos).set(values).where(and(eq(todos.id, todo.id), eq(todos.workspaceId, todo.workspaceId), eq(todos.createdBy, this.claims.sub)));
    }, this.db);
  }

  async delete(idOrWs: string, createdBy?: string, todoId?: string): Promise<void> {
    const [wsId, uId, id] = todoId !== undefined ? [idOrWs, createdBy!, todoId] : [this.workspaceId, this.claims.sub, idOrWs];
    await withUserContext(this.claims, async (tx) => {
      await tx.delete(todos).where(and(eq(todos.id, id), eq(todos.workspaceId, wsId), eq(todos.createdBy, uId)));
    }, this.db);
  }
}

export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly claims: UserClaims, private readonly db?: DbInstance) {}

  async findById(workspaceId: string): Promise<Workspace | null> {
    return withUserContext(this.claims, async (tx) => {
      const [row] = await tx.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
      return row ?? null;
    }, this.db);
  }

  async findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return withUserContext(this.claims, async (tx) => {
      const [row] = await tx.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))).limit(1);
      return row ?? null;
    }, this.db);
  }

  async createPersonalWorkspace(name: string, slug?: string | null): Promise<string> {
    return withUserContext(this.claims, async (tx) => {
      const res = await tx.execute<{ id: string }>(sql`select private.create_personal_workspace(${name}, ${slug ?? null}) as id`);
      if (!res[0]?.id) throw new Error("No se pudo provisionar el espacio personal");
      return res[0].id;
    }, this.db);
  }

  async ensurePersonalWorkspace(defaultName = "Mi Espacio"): Promise<string> {
    return withUserContext(this.claims, async (tx) => {
      const [existing] = await tx.select().from(workspaceMembers).where(eq(workspaceMembers.userId, this.claims.sub)).limit(1);
      if (existing?.workspaceId) return existing.workspaceId;
      const name = defaultName.trim() || "Mi Espacio";
      const res = await tx.execute<{ id: string }>(sql`select private.create_personal_workspace(${name}, null) as id`);
      if (!res[0]?.id) throw new Error("No se pudo provisionar el espacio personal");
      return res[0].id;
    }, this.db);
  }
}

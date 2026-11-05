import "server-only";
import { and, asc, desc, eq, ilike, isNull, lte, or, sql } from "drizzle-orm";
import type { ItemVisibility, Note as DomainNote, Todo as DomainTodo, WorkspaceKind, WorkspaceRole } from "@hubly/domain";
import { ConcurrencyError, sortTodosForView } from "@hubly/domain";
import type { NoteFilter, NoteRepository, TodoFilter, TodoRepository } from "@hubly/application";
import { withUserContext, type UserClaims } from "../context";
import { notes, todos, workspaceMembers, workspaces, type Workspace, type WorkspaceMember } from "../schema";

type DbInstance = Parameters<typeof withUserContext>[2];
export interface NoteSearchFilter extends NoteFilter { query?: string; }
export type UserWorkspaceSummary = { id: string; name: string; slug: string; kind: WorkspaceKind; role: WorkspaceRole };
export interface WorkspaceInvitationRecord {
  id: string; workspaceId: string; email: string; role: "admin" | "editor" | "viewer"; invitedBy: string;
  expiresAt: string; acceptedAt: string | null; acceptedBy: string | null; revokedAt: string | null; createdAt: string;
}
export interface WorkspaceRepository {
  findById(workspaceId: string): Promise<Workspace | null>;
  findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  createPersonalWorkspace(name: string, slug?: string | null): Promise<string>;
  ensurePersonalWorkspace(defaultName?: string): Promise<string>;
  listUserWorkspaces(): Promise<UserWorkspaceSummary[]>;
  createAgencyWorkspace(name: string, slug?: string | null): Promise<string>;
  listMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  updateMemberRole(workspaceId: string, targetUserId: string, role: WorkspaceRole): Promise<void>;
  removeMember(workspaceId: string, targetUserId: string): Promise<void>;
  listPendingInvitations(workspaceId: string): Promise<WorkspaceInvitationRecord[]>;
  createInvitationWithTokenHash(input: { workspaceId: string; email: string; role: "admin" | "editor" | "viewer"; tokenHash: string; expiresAt?: Date | string }): Promise<WorkspaceInvitationRecord>;
  revokeInvitation(workspaceId: string, invitationId: string): Promise<void>;
  acceptInvitation(rawToken: string): Promise<string>;
}

const toIso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
const toOptIso = (d: unknown): string | null => (d instanceof Date || typeof d === "string" ? toIso(d) : null);
const unwrapPg = async <T>(p: Promise<T>): Promise<T> => { try { return await p; } catch (e) { throw (e as { cause?: unknown })?.cause instanceof Error ? (e as { cause: Error }).cause : e; } };
const mapInvitationRow = (r: Record<string, unknown>): WorkspaceInvitationRecord => ({
  id: String(r.id), workspaceId: String(r.workspace_id ?? r.workspaceId), email: String(r.email), role: r.role as "admin" | "editor" | "viewer",
  invitedBy: String(r.invited_by ?? r.invitedBy), expiresAt: toIso((r.expires_at ?? r.expiresAt) as Date | string),
  acceptedAt: toOptIso(r.accepted_at ?? r.acceptedAt), acceptedBy: r.accepted_by || r.acceptedBy ? String(r.accepted_by ?? r.acceptedBy) : null,
  revokedAt: toOptIso(r.revoked_at ?? r.revokedAt), createdAt: toIso((r.created_at ?? r.createdAt) as Date | string),
});

export class DrizzleNoteRepository implements NoteRepository {
  private readVersions = new Map<string, number>();
  constructor(private readonly claims: UserClaims, private readonly workspaceId: string, private readonly db?: DbInstance) {}

  private mapRow(r: typeof notes.$inferSelect): DomainNote {
    this.readVersions.set(r.id, r.version);
    return { id: r.id, workspaceId: r.workspaceId, createdBy: r.createdBy, title: r.title, content: r.content, isPinned: r.isPinned, isArchived: r.isArchived, visibility: r.visibility ?? "private", version: r.version, createdAt: toIso(r.createdAt), updatedAt: toIso(r.updatedAt) };
  }

  async findById(idOrWs: string, _createdBy?: string, noteId?: string): Promise<DomainNote | null> {
    const [wsId, id] = noteId !== undefined ? [idOrWs, noteId] : [this.workspaceId, idOrWs];
    return withUserContext(this.claims, async (tx) => {
      const [row] = await tx.select().from(notes).where(and(eq(notes.id, id), eq(notes.workspaceId, wsId))).limit(1);
      return row ? this.mapRow(row) : null;
    }, this.db);
  }

  async findByWorkspace(workspaceId: string, _userId: string, filter?: NoteSearchFilter): Promise<DomainNote[]> {
    return withUserContext(this.claims, async (tx) => {
      const conds = [eq(notes.workspaceId, workspaceId)];
      if (filter?.isPinned !== undefined) conds.push(eq(notes.isPinned, filter.isPinned));
      if (filter?.isArchived !== undefined) conds.push(eq(notes.isArchived, filter.isArchived));
      if (filter?.visibility !== undefined) conds.push(eq(notes.visibility, filter.visibility));
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
    await unwrapPg(withUserContext(this.claims, async (tx) => {
      const [existing] = await tx.select().from(notes).where(and(eq(notes.id, note.id), eq(notes.workspaceId, note.workspaceId))).limit(1);
      const visibility = note.visibility ?? existing?.visibility ?? "private";
      if (!existing) {
        if (note.version !== 1) throw new ConcurrencyError(note.version - 1, 0);
        await tx.insert(notes).values({ id: note.id, workspaceId: note.workspaceId, createdBy: note.createdBy, title: note.title, content: note.content, isPinned: note.isPinned, isArchived: note.isArchived, visibility, version: note.version, createdAt: new Date(note.createdAt), updatedAt: new Date(note.updatedAt) });
        this.readVersions.set(note.id, note.version);
        return;
      }
      const expectedVersion = this.readVersions.get(note.id) ?? (note.version > 1 ? note.version - 1 : existing.version);
      const updated = await tx.update(notes).set({ title: note.title, content: note.content, isPinned: note.isPinned, isArchived: note.isArchived, visibility, version: note.version, updatedAt: new Date(note.updatedAt) }).where(and(eq(notes.id, note.id), eq(notes.workspaceId, note.workspaceId), eq(notes.version, expectedVersion))).returning({ version: notes.version });
      if (updated.length === 0) throw new ConcurrencyError(expectedVersion, existing.version);
      this.readVersions.set(note.id, note.version);
    }, this.db));
  }

  async updateVisibility(noteId: string, visibility: ItemVisibility): Promise<DomainNote | null> {
    return unwrapPg(withUserContext(this.claims, async (tx) => {
      const [row] = await tx.update(notes).set({ visibility, updatedAt: new Date() }).where(and(eq(notes.id, noteId), eq(notes.workspaceId, this.workspaceId))).returning();
      return row ? this.mapRow(row) : null;
    }, this.db));
  }

  async delete(idOrWs: string, _createdBy?: string, noteId?: string): Promise<void> {
    const [wsId, id] = noteId !== undefined ? [idOrWs, noteId] : [this.workspaceId, idOrWs];
    await unwrapPg(withUserContext(this.claims, async (tx) => {
      await tx.delete(notes).where(and(eq(notes.id, id), eq(notes.workspaceId, wsId)));
    }, this.db));
  }
}

export class DrizzleTodoRepository implements TodoRepository {
  constructor(private readonly claims: UserClaims, private readonly workspaceId: string, private readonly db?: DbInstance) {}

  private mapRow(r: typeof todos.$inferSelect): DomainTodo {
    return { id: r.id, workspaceId: r.workspaceId, createdBy: r.createdBy, noteId: r.noteId ?? null, title: r.title, detail: r.detail, dueDate: r.dueDate ?? null, priority: r.priority, visibility: r.visibility ?? "private", isDone: r.isDone, doneAt: r.doneAt ? toIso(r.doneAt) : null, createdAt: toIso(r.createdAt), updatedAt: toIso(r.updatedAt) };
  }

  async findById(idOrWs: string, _createdBy?: string, todoId?: string): Promise<DomainTodo | null> {
    const [wsId, id] = todoId !== undefined ? [idOrWs, todoId] : [this.workspaceId, idOrWs];
    return withUserContext(this.claims, async (tx) => {
      const [row] = await tx.select().from(todos).where(and(eq(todos.id, id), eq(todos.workspaceId, wsId))).limit(1);
      return row ? this.mapRow(row) : null;
    }, this.db);
  }

  async findByWorkspace(workspaceId: string, _userId: string, filter?: TodoFilter): Promise<DomainTodo[]> {
    return withUserContext(this.claims, async (tx) => {
      const conds = [eq(todos.workspaceId, workspaceId)];
      if (filter?.noteId !== undefined) conds.push(filter.noteId === null ? isNull(todos.noteId) : eq(todos.noteId, filter.noteId));
      if (filter?.isDone !== undefined) conds.push(eq(todos.isDone, filter.isDone));
      if (filter?.visibility !== undefined) conds.push(eq(todos.visibility, filter.visibility));
      const rows = await tx.select().from(todos).where(and(...conds)).orderBy(asc(todos.dueDate), asc(todos.createdAt));
      return rows.map((r) => this.mapRow(r));
    }, this.db);
  }

  listByWorkspace(workspaceId: string, createdBy: string, filter?: TodoFilter): Promise<DomainTodo[]> {
    return this.findByWorkspace(workspaceId, createdBy, filter);
  }

  async findTodayAndOverdue(workspaceId: string, _userId: string, refDate: string): Promise<DomainTodo[]> {
    const rows = await withUserContext(this.claims, async (tx) => {
      const res = await tx.select().from(todos).where(and(eq(todos.workspaceId, workspaceId), eq(todos.isDone, false), lte(todos.dueDate, refDate)));
      return res.map((r) => this.mapRow(r));
    }, this.db);
    return sortTodosForView(rows, "today", refDate);
  }

  async listByNoteId(workspaceId: string, noteId: string): Promise<DomainTodo[]> {
    return this.findByWorkspace(workspaceId, this.claims.sub, { noteId });
  }

  async save(todo: DomainTodo): Promise<void> {
    await unwrapPg(withUserContext(this.claims, async (tx) => {
      const [existing] = await tx.select().from(todos).where(and(eq(todos.id, todo.id), eq(todos.workspaceId, todo.workspaceId))).limit(1);
      const values = { title: todo.title, detail: todo.detail, noteId: todo.noteId ?? null, dueDate: todo.dueDate ?? null, priority: todo.priority, visibility: todo.visibility ?? existing?.visibility ?? "private", isDone: todo.isDone, doneAt: todo.doneAt ? new Date(todo.doneAt) : null, updatedAt: new Date(todo.updatedAt) };
      if (!existing) {
        await tx.insert(todos).values({ id: todo.id, workspaceId: todo.workspaceId, createdBy: todo.createdBy, createdAt: new Date(todo.createdAt), ...values });
        return;
      }
      await tx.update(todos).set(values).where(and(eq(todos.id, todo.id), eq(todos.workspaceId, todo.workspaceId)));
    }, this.db));
  }

  async updateVisibility(todoId: string, visibility: ItemVisibility): Promise<DomainTodo | null> {
    return unwrapPg(withUserContext(this.claims, async (tx) => {
      const [row] = await tx.update(todos).set({ visibility, updatedAt: new Date() }).where(and(eq(todos.id, todoId), eq(todos.workspaceId, this.workspaceId))).returning();
      return row ? this.mapRow(row) : null;
    }, this.db));
  }

  async delete(idOrWs: string, _createdBy?: string, todoId?: string): Promise<void> {
    const [wsId, id] = todoId !== undefined ? [idOrWs, todoId] : [this.workspaceId, idOrWs];
    await unwrapPg(withUserContext(this.claims, async (tx) => {
      await tx.delete(todos).where(and(eq(todos.id, id), eq(todos.workspaceId, wsId)));
    }, this.db));
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
    return unwrapPg(withUserContext(this.claims, async (tx) => {
      const res = await tx.execute<{ id: string }>(sql`select private.create_personal_workspace(${name}, ${slug ?? null}) as id`);
      if (!res[0]?.id) throw new Error("No se pudo provisionar el espacio personal");
      return res[0].id;
    }, this.db));
  }

  async ensurePersonalWorkspace(defaultName = "Mi Espacio"): Promise<string> {
    return unwrapPg(withUserContext(this.claims, async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${this.claims.sub}))`);
      const members = await tx.select().from(workspaceMembers).where(eq(workspaceMembers.userId, this.claims.sub)).limit(20);
      if (members.length > 1) {
        const personal = await tx.execute<{ id: string }>(sql`select w.id from public.workspaces w join public.workspace_members m on m.workspace_id = w.id where m.user_id = ${this.claims.sub}::uuid and w.kind = 'personal' limit 1`);
        if (personal[0]?.id) return personal[0].id;
      }
      if (members[0]?.workspaceId) return members[0].workspaceId;
      const name = defaultName.trim() || "Mi Espacio";
      const res = await tx.execute<{ id: string }>(sql`select private.create_personal_workspace(${name}, null) as id`);
      if (!res[0]?.id) throw new Error("No se pudo provisionar el espacio personal");
      return res[0].id;
    }, this.db));
  }

  listUserWorkspaces(): Promise<UserWorkspaceSummary[]> {
    return withUserContext(this.claims, async (tx) => [...(await tx.execute<UserWorkspaceSummary>(sql`select w.id, w.name, w.slug, w.kind, m.role from public.workspaces w join public.workspace_members m on m.workspace_id = w.id where m.user_id = ${this.claims.sub}::uuid order by case when w.kind = 'personal' then 0 else 1 end, w.created_at asc`))], this.db);
  }
  createAgencyWorkspace(name: string, slug?: string | null): Promise<string> {
    return unwrapPg(withUserContext(this.claims, async (tx) => (await tx.execute<{ id: string }>(sql`select private.create_agency_workspace(${name}, ${slug ?? null}) as id`))[0]?.id ?? (() => { throw new Error("No se pudo crear el espacio de agencia"); })(), this.db));
  }
  listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return withUserContext(this.claims, (tx) => tx.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId)).orderBy(asc(workspaceMembers.createdAt)), this.db);
  }
  async updateMemberRole(workspaceId: string, targetUserId: string, role: WorkspaceRole): Promise<void> {
    await unwrapPg(withUserContext(this.claims, async (tx) => { if ((await tx.execute(sql`update public.workspace_members set role = ${role} where workspace_id = ${workspaceId}::uuid and user_id = ${targetUserId}::uuid returning user_id`)).length === 0) throw new Error("No autorizado para cambiar el rol de este miembro"); }, this.db));
  }
  async removeMember(workspaceId: string, targetUserId: string): Promise<void> {
    await unwrapPg(withUserContext(this.claims, async (tx) => { if ((await tx.execute(sql`delete from public.workspace_members where workspace_id = ${workspaceId}::uuid and user_id = ${targetUserId}::uuid returning user_id`)).length === 0) throw new Error("No autorizado para remover a este miembro"); }, this.db));
  }
  listPendingInvitations(workspaceId: string): Promise<WorkspaceInvitationRecord[]> {
    return withUserContext(this.claims, async (tx) => (await tx.execute<Record<string, unknown>>(sql`select id, workspace_id, email, role, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at from public.workspace_invitations where workspace_id = ${workspaceId}::uuid and accepted_at is null and revoked_at is null and expires_at > now() order by created_at desc`)).map(mapInvitationRow), this.db);
  }
  createInvitationWithTokenHash(input: { workspaceId: string; email: string; role: "admin" | "editor" | "viewer"; tokenHash: string; expiresAt?: Date | string }): Promise<WorkspaceInvitationRecord> {
    return unwrapPg(withUserContext(this.claims, async (tx) => {
      const normalizedEmail = input.email.trim().toLowerCase(), expIso = input.expiresAt ? toIso(input.expiresAt) : new Date(Date.now() + 7 * 86400_000).toISOString();
      await tx.execute(sql`update public.workspace_invitations set revoked_at = now() where workspace_id = ${input.workspaceId}::uuid and lower(email) = lower(trim(${normalizedEmail})) and accepted_at is null and revoked_at is null and expires_at <= now()`);
      const [row] = await tx.execute<Record<string, unknown>>(sql`insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by, expires_at) values (${input.workspaceId}::uuid, ${normalizedEmail}, ${input.role}, ${input.tokenHash}, ${this.claims.sub}::uuid, ${expIso}::timestamptz) returning id, workspace_id, email, role, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at`);
      if (!row) throw new Error("No se pudo crear la invitación");
      return mapInvitationRow(row);
    }, this.db));
  }
  async revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
    await unwrapPg(withUserContext(this.claims, async (tx) => { if ((await tx.execute(sql`update public.workspace_invitations set revoked_at = now() where workspace_id = ${workspaceId}::uuid and id = ${invitationId}::uuid and accepted_at is null and revoked_at is null returning id`)).length === 0) throw new Error("No se pudo revocar la invitación"); }, this.db));
  }
  acceptInvitation(rawToken: string): Promise<string> {
    return unwrapPg(withUserContext(this.claims, async (tx) => (await tx.execute<{ workspace_id: string }>(sql`select private.accept_workspace_invitation(${rawToken}) as workspace_id`))[0]?.workspace_id ?? (() => { throw new Error("No se pudo aceptar la invitación"); })(), this.db));
  }
}

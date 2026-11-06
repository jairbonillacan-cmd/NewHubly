// Casos de uso y puertos. Sin framework ni base de datos (ADR 0002, ADR 0007).
import type { ItemVisibility, Note, Todo, TodoView, WorkspaceEntity, WorkspaceInvitationEntity, WorkspaceMemberEntity, WorkspaceRole } from '@hubly/domain';
import {
  AgencyLimitExceededError, ConcurrencyError, ForbiddenWorkspaceActionError, InvitationError, LastOwnerProtectionError,
  MAX_AGENCIES_PER_OWNER, NoteNotFoundError, TodoNotFoundError, UnauthorizedWorkspaceError,
  archiveNote as domainArchiveNote, canChangeMemberRole, canCreateWithVisibility, canEditItem, canLinkTodoToNote,
  canManageInvitation, canReadItem, canRemoveOrLeaveMember, changeItemVisibility, emailsMatchNormalized,
  getEffectiveVisibility, getInvitationStatus, isDoneView, isNoDate, isToday, isUpcoming, normalizeInvitationEmail,
  pinNote as domainPinNote, sortTodosForView, toggleTodo as domainToggleTodo, unlinkIncompatibleTodosOnNotePrivatized,
} from '@hubly/domain';
export { addDaysToDateString, canEditItem, parseQuickCapture, suggestOverdueTodos, type QuickCaptureAnalysis } from '@hubly/domain';
import {
  changeMemberRoleInputSchema, createAgencyInputSchema, inviteMemberInputSchema, removeMemberInputSchema, revokeInvitationInputSchema,
  type ChangeMemberRoleInput, type CreateAgencyInput, type CreateNoteInput, type CreateTodoInput, type ExportData,
  type InviteMemberInput, type RemoveMemberInput, type RevokeInvitationInput, type UpdateNoteInput, type UpdateTodoInput,
  DEFAULT_USER_PREFERENCES, updateUserPreferencesSchema, userPreferencesSchema, type UpdateUserPreferencesInput, type UserPreferences,
} from '@hubly/contracts';

export interface Clock { now(): Date; todayString(): string; }
export interface IdGenerator { generate(): string; }
export interface AppContext { workspaceId: string; userId: string; role?: WorkspaceRole | undefined; }
export interface NoteFilter { isPinned?: boolean; isArchived?: boolean; visibility?: ItemVisibility; }
export interface TodoFilter { noteId?: string | null; isDone?: boolean; visibility?: ItemVisibility; }

export interface NoteRepository {
  findById(id: string): Promise<Note | null>;
  findByWorkspace(workspaceId: string, userId: string, filter?: NoteFilter): Promise<Note[]>;
  save(note: Note): Promise<void>; delete(id: string): Promise<void>;
}
export interface TodoRepository {
  findById(id: string): Promise<Todo | null>;
  findByWorkspace(workspaceId: string, userId: string, filter?: TodoFilter): Promise<Todo[]>;
  findTodayAndOverdue(workspaceId: string, userId: string, refDate: string): Promise<Todo[]>;
  save(todo: Todo): Promise<void>; delete(id: string): Promise<void>;
}
export interface AgencyWorkspaceRepository {
  findWorkspaceById(id: string): Promise<WorkspaceEntity | null>;
  countAgenciesOwnedBy(userId: string): Promise<number>;
  saveWorkspace(ws: WorkspaceEntity): Promise<void>;
  findMember(workspaceId: string, userId: string): Promise<WorkspaceMemberEntity | null>;
  listMembers(workspaceId: string): Promise<WorkspaceMemberEntity[]>;
  saveMember(member: WorkspaceMemberEntity): Promise<void>;
  deleteMember(workspaceId: string, userId: string): Promise<void>;
  findInvitationById(id: string): Promise<WorkspaceInvitationEntity | null>;
  findInvitationByTokenHash(tokenHash: string): Promise<WorkspaceInvitationEntity | null>;
  listInvitations(workspaceId: string): Promise<WorkspaceInvitationEntity[]>;
  saveInvitation(inv: WorkspaceInvitationEntity): Promise<void>;
}

export class InMemoryNoteRepository implements NoteRepository {
  private items = new Map<string, Note>();
  async findById(id: string) { return this.items.get(id) ?? null; }
  async findByWorkspace(wId: string, uId: string, f?: NoteFilter) {
    return Array.from(this.items.values()).filter(n => n.workspaceId === wId && (n.createdBy === uId || getEffectiveVisibility(n) === 'workspace') && (f?.isPinned === undefined || n.isPinned === f.isPinned) && (f?.isArchived === undefined || n.isArchived === f.isArchived) && (f?.visibility === undefined || getEffectiveVisibility(n) === f.visibility));
  }
  async save(n: Note) { this.items.set(n.id, n); } async delete(id: string) { this.items.delete(id); }
}

export class InMemoryTodoRepository implements TodoRepository {
  private items = new Map<string, Todo>();
  async findById(id: string) { return this.items.get(id) ?? null; }
  async findByWorkspace(wId: string, uId: string, f?: TodoFilter) {
    return Array.from(this.items.values()).filter(t => t.workspaceId === wId && (t.createdBy === uId || getEffectiveVisibility(t) === 'workspace') && (f?.noteId === undefined || t.noteId === f.noteId) && (f?.isDone === undefined || t.isDone === f.isDone) && (f?.visibility === undefined || getEffectiveVisibility(t) === f.visibility));
  }
  async findTodayAndOverdue(wId: string, uId: string, ref: string) {
    const filtered = Array.from(this.items.values()).filter(t => t.workspaceId === wId && (t.createdBy === uId || getEffectiveVisibility(t) === 'workspace') && isToday(t, ref));
    return sortTodosForView(filtered, 'today', ref);
  }
  async save(t: Todo) { this.items.set(t.id, t); } async delete(id: string) { this.items.delete(id); }
}

export class InMemoryAgencyWorkspaceRepository implements AgencyWorkspaceRepository {
  private workspaces = new Map<string, WorkspaceEntity>();
  private members = new Map<string, WorkspaceMemberEntity>();
  private invitations = new Map<string, WorkspaceInvitationEntity>();
  private mKey = (wId: string, uId: string) => `${wId}:${uId}`;
  async findWorkspaceById(id: string) { return this.workspaces.get(id) ?? null; }
  async countAgenciesOwnedBy(uId: string) { return Array.from(this.members.values()).filter(m => m.userId === uId && m.role === 'owner' && this.workspaces.get(m.workspaceId)?.kind === 'agency').length; }
  async saveWorkspace(ws: WorkspaceEntity) { this.workspaces.set(ws.id, ws); }
  async findMember(wId: string, uId: string) { return this.members.get(this.mKey(wId, uId)) ?? null; }
  async listMembers(wId: string) { return Array.from(this.members.values()).filter(m => m.workspaceId === wId); }
  async saveMember(m: WorkspaceMemberEntity) { this.members.set(this.mKey(m.workspaceId, m.userId), m); }
  async deleteMember(wId: string, uId: string) { this.members.delete(this.mKey(wId, uId)); }
  async findInvitationById(id: string) { return this.invitations.get(id) ?? null; }
  async findInvitationByTokenHash(hash: string) { return Array.from(this.invitations.values()).find(i => i.tokenHash === hash) ?? null; }
  async listInvitations(wId: string) { return Array.from(this.invitations.values()).filter(i => i.workspaceId === wId); }
  async saveInvitation(inv: WorkspaceInvitationEntity) { this.invitations.set(inv.id, inv); }
}

const roleOf = (ctx: AppContext): WorkspaceRole => ctx.role ?? 'owner';

export async function createNote(repo: NoteRepository, clock: Clock, idGen: IdGenerator, input: CreateNoteInput, ctx: AppContext): Promise<Note> {
  const vis = input.visibility ?? 'private';
  if (!canCreateWithVisibility(roleOf(ctx), vis)) throw new ForbiddenWorkspaceActionError('Un lector no puede crear notas compartidas en la agencia');
  const ts = clock.now().toISOString();
  const note: Note = { id: idGen.generate(), workspaceId: ctx.workspaceId, createdBy: ctx.userId, title: input.title ?? '', content: input.content ?? '', isPinned: false, isArchived: false, visibility: vis, version: 1, createdAt: ts, updatedAt: ts };
  await repo.save(note); return note;
}

export async function updateNote(repo: NoteRepository, clock: Clock, input: UpdateNoteInput, ctx: AppContext): Promise<Note> {
  const note = await repo.findById(input.id), role = roleOf(ctx), now = clock.now().toISOString();
  if (!note || note.workspaceId !== ctx.workspaceId || !canReadItem(ctx.userId, role, note)) throw new NoteNotFoundError(input.id);
  if (!canEditItem(ctx.userId, role, note)) throw new ForbiddenWorkspaceActionError('Sin permisos para editar esta nota');
  if (input.expectedVersion !== undefined && note.version !== input.expectedVersion) throw new ConcurrencyError(input.expectedVersion, note.version);
  const nextVis = input.visibility !== undefined ? changeItemVisibility(note, input.visibility, ctx.userId, role, now).visibility : note.visibility;
  const title = input.title ?? note.title, content = input.content !== undefined ? input.content : note.content;
  const updated: Note = { ...note, title, content, isPinned: input.isPinned !== undefined ? input.isPinned : note.isPinned, isArchived: input.isArchived !== undefined ? input.isArchived : note.isArchived, ...(nextVis !== undefined ? { visibility: nextVis } : {}), version: (title !== note.title || content !== note.content) ? note.version + 1 : note.version, updatedAt: now };
  await repo.save(updated); return updated;
}

export async function pinNote(r: NoteRepository, c: Clock, id: string, isPinned: boolean, ctx: AppContext) {
  const note = await r.findById(id), role = roleOf(ctx);
  if (!note || note.workspaceId !== ctx.workspaceId || !canReadItem(ctx.userId, role, note)) throw new NoteNotFoundError(id);
  if (!canEditItem(ctx.userId, role, note)) throw new ForbiddenWorkspaceActionError('Sin permisos para fijar esta nota');
  const updated = domainPinNote(note, isPinned, c.now().toISOString());
  await r.save(updated); return updated;
}

export async function archiveNote(r: NoteRepository, c: Clock, id: string, isArchived: boolean, ctx: AppContext) {
  const note = await r.findById(id), role = roleOf(ctx);
  if (!note || note.workspaceId !== ctx.workspaceId || !canReadItem(ctx.userId, role, note)) throw new NoteNotFoundError(id);
  if (!canEditItem(ctx.userId, role, note)) throw new ForbiddenWorkspaceActionError('Sin permisos para archivar esta nota');
  const updated = domainArchiveNote(note, isArchived, c.now().toISOString());
  await r.save(updated); return updated;
}

export const listNotes = (r: NoteRepository, ctx: AppContext, f?: NoteFilter) => r.findByWorkspace(ctx.workspaceId, ctx.userId, f);

export async function createTodo(repo: TodoRepository, clock: Clock, idGen: IdGenerator, input: CreateTodoInput, ctx: AppContext, noteRepo?: NoteRepository): Promise<Todo> {
  const vis = input.visibility ?? 'private', role = roleOf(ctx);
  if (!canCreateWithVisibility(role, vis)) throw new ForbiddenWorkspaceActionError('Un lector no puede crear pendientes compartidos en la agencia');
  if (input.noteId) {
    const note = noteRepo ? await noteRepo.findById(input.noteId) : null;
    if (!note || note.workspaceId !== ctx.workspaceId || !canReadItem(ctx.userId, role, note)) throw new NoteNotFoundError(input.noteId);
    if (!canLinkTodoToNote(ctx.userId, vis, note, ctx.workspaceId)) throw new ForbiddenWorkspaceActionError('Un pendiente compartido no puede vincularse a una nota privada');
  }
  const ts = clock.now().toISOString();
  const todo: Todo = { id: idGen.generate(), workspaceId: ctx.workspaceId, createdBy: ctx.userId, noteId: input.noteId ?? null, title: input.title, detail: input.detail ?? '', dueDate: input.dueDate ?? null, priority: input.priority ?? 'medium', visibility: vis, isDone: false, doneAt: null, createdAt: ts, updatedAt: ts };
  await repo.save(todo); return todo;
}

export async function updateTodo(repo: TodoRepository, clock: Clock, input: UpdateTodoInput, ctx: AppContext, noteRepo?: NoteRepository): Promise<Todo> {
  const todo = await repo.findById(input.id), role = roleOf(ctx), now = clock.now().toISOString();
  if (!todo || todo.workspaceId !== ctx.workspaceId || !canReadItem(ctx.userId, role, todo)) throw new TodoNotFoundError(input.id);
  if (!canEditItem(ctx.userId, role, todo)) throw new ForbiddenWorkspaceActionError('Sin permisos para editar este pendiente');
  const nextVis = input.visibility !== undefined ? changeItemVisibility(todo, input.visibility, ctx.userId, role, now).visibility : getEffectiveVisibility(todo);
  const targetNoteId = input.noteId !== undefined ? input.noteId : todo.noteId;
  if (targetNoteId) {
    const note = noteRepo ? await noteRepo.findById(targetNoteId) : null;
    if (!note || note.workspaceId !== ctx.workspaceId || !canReadItem(ctx.userId, role, note)) throw new NoteNotFoundError(targetNoteId);
    if (!canLinkTodoToNote(ctx.userId, nextVis ?? 'private', note, ctx.workspaceId)) throw new ForbiddenWorkspaceActionError('Un pendiente compartido no puede vincularse a una nota privada');
  }
  const updated: Todo = { ...todo, title: input.title ?? todo.title, detail: input.detail !== undefined ? (input.detail ?? '') : todo.detail, dueDate: input.dueDate !== undefined ? input.dueDate : todo.dueDate, priority: input.priority ?? todo.priority, ...(nextVis !== undefined ? { visibility: nextVis } : {}), isDone: input.isDone !== undefined ? input.isDone : todo.isDone, doneAt: input.isDone !== undefined ? (input.isDone ? (todo.doneAt ?? now) : null) : todo.doneAt, noteId: targetNoteId, updatedAt: now };
  await repo.save(updated); return updated;
}

export async function toggleTodoDone(repo: TodoRepository, clock: Clock, id: string, ctx: AppContext): Promise<Todo> {
  const todo = await repo.findById(id), role = roleOf(ctx);
  if (!todo || todo.workspaceId !== ctx.workspaceId || !canReadItem(ctx.userId, role, todo)) throw new TodoNotFoundError(id);
  if (!canEditItem(ctx.userId, role, todo)) throw new ForbiddenWorkspaceActionError('Sin permisos para completar este pendiente');
  const updated = domainToggleTodo(todo, clock.now().toISOString());
  await repo.save(updated); return updated;
}

export async function listTodosByView(repo: TodoRepository, clock: Clock, view: TodoView, ctx: AppContext): Promise<Todo[]> {
  const all = await repo.findByWorkspace(ctx.workspaceId, ctx.userId), ref = clock.todayString();
  const filtered = all.filter(t => (view === 'done' ? isDoneView(t) : view === 'today' ? isToday(t, ref) : view === 'upcoming' ? isUpcoming(t, ref) : isNoDate(t)));
  return sortTodosForView(filtered, view, ref);
}

export async function createTodoFromNote(tRepo: TodoRepository, nRepo: NoteRepository, c: Clock, idGen: IdGenerator, noteId: string, input: Omit<CreateTodoInput, 'noteId'>, ctx: AppContext): Promise<Todo> {
  const note = await nRepo.findById(noteId), role = roleOf(ctx);
  if (!note || note.workspaceId !== ctx.workspaceId || !canReadItem(ctx.userId, role, note)) throw new NoteNotFoundError(noteId);
  return createTodo(tRepo, c, idGen, { ...input, noteId }, ctx, nRepo);
}

export async function exportWorkspaceData(nRepo: NoteRepository, tRepo: TodoRepository, c: Clock, ctx: AppContext): Promise<{ json: ExportData; markdown: string }> {
  // Solo los elementos propios: en una agencia RLS deja leer lo compartido por otros, pero la exportación es de la persona (ADR 0007).
  const [allNotes, allTodos] = await Promise.all([nRepo.findByWorkspace(ctx.workspaceId, ctx.userId), tRepo.findByWorkspace(ctx.workspaceId, ctx.userId)]);
  const notes = allNotes.filter((n) => n.createdBy === ctx.userId), todos = allTodos.filter((t) => t.createdBy === ctx.userId);
  const json: ExportData = { version: 1, exportedAt: c.now().toISOString(), workspaceId: ctx.workspaceId, notes, todos };
  const prios: Record<string, string> = { high: 'ALTA', medium: 'NORMAL', low: 'BAJA' };
  const mdNotes = notes.map(n => {
    const flags = [n.isPinned && 'Fijada', n.isArchived && 'Archivada'].filter(Boolean).join(', ');
    return `## ${n.title}${flags ? ` [${flags}]` : ''}\n${n.content}`;
  }).join('\n\n');
  const mdTodos = todos.map(t => {
    const meta = [`- [${t.isDone ? 'x' : ' '}]`, `[${prios[t.priority] || 'NORMAL'}]`, t.title];
    if (t.dueDate) meta.push(`(Vence: ${t.dueDate})`);
    if (t.noteId) meta.push(`(Nota: ${t.noteId})`);
    return t.detail ? `${meta.join(' ')}\n  ${t.detail}` : meta.join(' ');
  }).join('\n');
  return { json, markdown: `# Exportación de datos\n\n# Notas\n${mdNotes || 'Sin notas.'}\n\n# Pendientes\n${mdTodos || 'Sin pendientes.'}\n` };
}

export async function createAgency(repo: AgencyWorkspaceRepository, clock: Clock, idGen: IdGenerator, input: CreateAgencyInput, userId: string): Promise<{ workspace: WorkspaceEntity; ownerMember: WorkspaceMemberEntity }> {
  const parsed = createAgencyInputSchema.parse(input);
  if ((await repo.countAgenciesOwnedBy(userId)) >= MAX_AGENCIES_PER_OWNER) throw new AgencyLimitExceededError();
  const now = clock.now().toISOString(), workspace: WorkspaceEntity = { id: idGen.generate(), name: parsed.name, slug: parsed.slug ?? null, kind: 'agency', createdAt: now };
  const ownerMember: WorkspaceMemberEntity = { workspaceId: workspace.id, userId, role: 'owner', createdAt: now };
  await repo.saveWorkspace(workspace); await repo.saveMember(ownerMember); return { workspace, ownerMember };
}

export async function inviteWorkspaceMember(repo: AgencyWorkspaceRepository, clock: Clock, idGen: IdGenerator, input: InviteMemberInput, tokenHash: string, actorUserId: string): Promise<WorkspaceInvitationEntity> {
  const parsed = inviteMemberInputSchema.parse(input);
  if (!/^[0-9a-f]{64}$/i.test(tokenHash)) throw new InvitationError('El hash del token de invitación debe ser SHA-256 hexadecimal de 64 caracteres');
  const ws = await repo.findWorkspaceById(parsed.workspaceId), actor = await repo.findMember(parsed.workspaceId, actorUserId);
  if (!ws || !actor) throw new UnauthorizedWorkspaceError(parsed.workspaceId);
  const nowDate = clock.now(), nowIso = nowDate.toISOString(), email = normalizeInvitationEmail(parsed.email);
  const active = (await repo.listInvitations(parsed.workspaceId)).filter(i => getInvitationStatus(i, nowIso) === 'pending');
  const check = canManageInvitation({ workspaceKind: ws.kind, actorRole: actor.role, invitedRole: parsed.role, pendingCount: active.length });
  if (!check.allowed) throw new ForbiddenWorkspaceActionError(check.reason ?? 'No autorizado para invitar');
  if (active.some(i => emailsMatchNormalized(i.email, email))) throw new InvitationError('Ya existe una invitación pendiente activa para este correo');
  const inv: WorkspaceInvitationEntity = { id: idGen.generate(), workspaceId: ws.id, email, role: parsed.role, tokenHash: tokenHash.toLowerCase(), invitedBy: actorUserId, expiresAt: new Date(nowDate.getTime() + 7 * 86400_000).toISOString(), acceptedAt: null, acceptedBy: null, revokedAt: null, createdAt: nowIso };
  await repo.saveInvitation(inv); return inv;
}

export async function acceptWorkspaceInvitation(repo: AgencyWorkspaceRepository, clock: Clock, tokenHash: string, acceptor: { userId: string; email: string; emailConfirmed: boolean }): Promise<WorkspaceMemberEntity> {
  const inv = await repo.findInvitationByTokenHash(tokenHash.toLowerCase()), nowIso = clock.now().toISOString();
  if (!inv || getInvitationStatus(inv, nowIso) !== 'pending') throw new InvitationError('Invitación inválida, caducada o ya utilizada');
  const ws = await repo.findWorkspaceById(inv.workspaceId);
  if (!ws || ws.kind !== 'agency') throw new InvitationError('El espacio de la invitación no es una agencia válida');
  if (!acceptor.emailConfirmed || !emailsMatchNormalized(acceptor.email, inv.email)) throw new InvitationError('El correo verificado de tu cuenta no coincide con el destinatario de la invitación');
  await repo.saveInvitation({ ...inv, acceptedAt: nowIso, acceptedBy: acceptor.userId });
  const existing = await repo.findMember(inv.workspaceId, acceptor.userId);
  if (existing) return existing;
  const member: WorkspaceMemberEntity = { workspaceId: inv.workspaceId, userId: acceptor.userId, role: inv.role, createdAt: nowIso };
  await repo.saveMember(member); return member;
}

export async function revokeWorkspaceInvitation(repo: AgencyWorkspaceRepository, clock: Clock, input: RevokeInvitationInput, actorUserId: string): Promise<WorkspaceInvitationEntity> {
  const parsed = revokeInvitationInputSchema.parse(input);
  const ws = await repo.findWorkspaceById(parsed.workspaceId), actor = await repo.findMember(parsed.workspaceId, actorUserId), inv = await repo.findInvitationById(parsed.invitationId);
  if (!ws || !actor) throw new UnauthorizedWorkspaceError(parsed.workspaceId);
  if (!inv || inv.workspaceId !== parsed.workspaceId) throw new InvitationError('Invitación no encontrada');
  const check = canManageInvitation({ workspaceKind: ws.kind, actorRole: actor.role, invitedRole: inv.role });
  if (!check.allowed) throw new ForbiddenWorkspaceActionError(check.reason ?? 'Sin permisos para revocar esta invitación');
  const revoked: WorkspaceInvitationEntity = { ...inv, revokedAt: clock.now().toISOString() };
  await repo.saveInvitation(revoked); return revoked;
}

export async function changeWorkspaceMemberRole(repo: AgencyWorkspaceRepository, input: ChangeMemberRoleInput, actorUserId: string): Promise<WorkspaceMemberEntity> {
  const parsed = changeMemberRoleInputSchema.parse(input);
  const ws = await repo.findWorkspaceById(parsed.workspaceId), actor = await repo.findMember(parsed.workspaceId, actorUserId), target = await repo.findMember(parsed.workspaceId, parsed.targetUserId);
  if (!ws || !actor || !target) throw new UnauthorizedWorkspaceError(parsed.workspaceId);
  const ownerCount = (await repo.listMembers(parsed.workspaceId)).filter(m => m.role === 'owner').length;
  const check = canChangeMemberRole({ workspaceKind: ws.kind, actorId: actorUserId, actorRole: actor.role, targetUserId: target.userId, targetCurrentRole: target.role, nextRole: parsed.nextRole, ownerCount });
  if (!check.allowed) throw check.reason?.includes('al menos un propietario') ? new LastOwnerProtectionError() : new ForbiddenWorkspaceActionError(check.reason ?? 'Cambio de rol no permitido');
  const updated: WorkspaceMemberEntity = { ...target, role: parsed.nextRole };
  await repo.saveMember(updated); return updated;
}

export async function removeOrLeaveWorkspaceMember(repo: AgencyWorkspaceRepository, input: RemoveMemberInput, actorUserId: string, relocation?: { noteRepo: NoteRepository; todoRepo: TodoRepository; personalWorkspaceId: string; clock: Clock }): Promise<void> {
  const parsed = removeMemberInputSchema.parse(input);
  const ws = await repo.findWorkspaceById(parsed.workspaceId), actor = await repo.findMember(parsed.workspaceId, actorUserId), target = await repo.findMember(parsed.workspaceId, parsed.targetUserId);
  if (!ws || !actor || !target) throw new UnauthorizedWorkspaceError(parsed.workspaceId);
  const ownerCount = (await repo.listMembers(parsed.workspaceId)).filter(m => m.role === 'owner').length;
  const check = canRemoveOrLeaveMember({ workspaceKind: ws.kind, actorId: actorUserId, actorRole: actor.role, targetUserId: target.userId, targetCurrentRole: target.role, ownerCount });
  if (!check.allowed) throw check.reason?.includes('al menos un propietario') ? new LastOwnerProtectionError() : new ForbiddenWorkspaceActionError(check.reason ?? 'No se puede remover al miembro');
  if (relocation) {
    const now = relocation.clock.now().toISOString(), privateNoteIds = new Set<string>();
    for (const n of await relocation.noteRepo.findByWorkspace(parsed.workspaceId, target.userId)) if (n.createdBy === target.userId && getEffectiveVisibility(n) === 'private') { privateNoteIds.add(n.id); await relocation.noteRepo.save({ ...n, workspaceId: relocation.personalWorkspaceId, updatedAt: now }); }
    for (const t of await relocation.todoRepo.findByWorkspace(parsed.workspaceId, target.userId)) if (t.createdBy === target.userId && getEffectiveVisibility(t) === 'private') { await relocation.todoRepo.save({ ...t, workspaceId: relocation.personalWorkspaceId, noteId: t.noteId && privateNoteIds.has(t.noteId) ? t.noteId : null, updatedAt: now }); }
  }
  await repo.deleteMember(parsed.workspaceId, target.userId);
}

export async function changeNoteVisibility(noteRepo: NoteRepository, todoRepo: TodoRepository, clock: Clock, noteId: string, nextVisibility: ItemVisibility, ctx: AppContext, allWorkspaceTodos?: Todo[]): Promise<Note> {
  const note = await noteRepo.findById(noteId), role = roleOf(ctx), now = clock.now().toISOString();
  if (!note || note.workspaceId !== ctx.workspaceId || !canReadItem(ctx.userId, role, note)) throw new NoteNotFoundError(noteId);
  const updated = changeItemVisibility(note, nextVisibility, ctx.userId, role, now);
  await noteRepo.save(updated);
  if (getEffectiveVisibility(note) === 'workspace' && nextVisibility === 'private') {
    const candidates = allWorkspaceTodos ?? await todoRepo.findByWorkspace(ctx.workspaceId, ctx.userId);
    for (const t of unlinkIncompatibleTodosOnNotePrivatized(updated, candidates, now)) if (t.noteId === null && candidates.find(orig => orig.id === t.id)?.noteId === note.id) await todoRepo.save(t);
  }
  return updated;
}

export async function changeTodoVisibility(todoRepo: TodoRepository, noteRepo: NoteRepository, clock: Clock, todoId: string, nextVisibility: ItemVisibility, ctx: AppContext): Promise<Todo> {
  const todo = await todoRepo.findById(todoId), role = roleOf(ctx), now = clock.now().toISOString();
  if (!todo || todo.workspaceId !== ctx.workspaceId || !canReadItem(ctx.userId, role, todo)) throw new TodoNotFoundError(todoId);
  if (todo.noteId) {
    const note = await noteRepo.findById(todo.noteId);
    if (!note || !canLinkTodoToNote(ctx.userId, nextVisibility, note, ctx.workspaceId)) throw new ForbiddenWorkspaceActionError('Un pendiente compartido no puede permanecer vinculado a una nota privada');
  }
  const updated = changeItemVisibility(todo, nextVisibility, ctx.userId, role, now);
  await todoRepo.save(updated); return updated;
}

// Preferencias visuales por persona (#83). La tabla solo deja leer y escribir las propias (RLS); aquí se validan y se completan.
export interface UserPreferencesRepository {
  get(userId: string): Promise<UserPreferences | null>;
  upsert(userId: string, preferences: UserPreferences): Promise<UserPreferences>;
}

export async function getUserPreferences(repo: UserPreferencesRepository, ctx: Pick<AppContext, 'userId'>): Promise<UserPreferences> {
  const stored = await repo.get(ctx.userId);
  const parsed = stored ? userPreferencesSchema.safeParse(stored) : null;
  return parsed?.success ? parsed.data : { ...DEFAULT_USER_PREFERENCES, visiblePanels: [...DEFAULT_USER_PREFERENCES.visiblePanels] };
}

export async function saveUserPreferences(repo: UserPreferencesRepository, patch: UpdateUserPreferencesInput, ctx: Pick<AppContext, 'userId'>): Promise<UserPreferences> {
  const changes = updateUserPreferencesSchema.parse(patch);
  const current = await getUserPreferences(repo, ctx);
  return repo.upsert(ctx.userId, userPreferencesSchema.parse({ ...current, ...changes }));
}


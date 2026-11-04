// Entidades y reglas de negocio puras (ADR 0002, ADR 0007).
export type Priority = 'low' | 'medium' | 'high';
export type TodoView = 'today' | 'upcoming' | 'no_date' | 'done';
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type InvitationRole = 'admin' | 'editor' | 'viewer';
export type WorkspaceKind = 'personal' | 'agency';
export type ItemVisibility = 'private' | 'workspace';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export const MAX_PENDING_INVITATIONS_PER_WORKSPACE = 20;
export const MAX_AGENCIES_PER_OWNER = 10;

export interface WorkspaceEntity { id: string; name: string; slug?: string | null | undefined; kind: WorkspaceKind; createdAt: string; }
export interface WorkspaceMemberEntity { workspaceId: string; userId: string; role: WorkspaceRole; createdAt: string; }
export interface WorkspaceInvitationEntity {
  id: string; workspaceId: string; email: string; role: InvitationRole; tokenHash: string; invitedBy: string;
  expiresAt: string; acceptedAt?: string | null | undefined; acceptedBy?: string | null | undefined; revokedAt?: string | null | undefined; createdAt: string;
}
export interface Note {
  id: string; workspaceId: string; createdBy: string; title: string; content: string;
  isPinned: boolean; isArchived: boolean; visibility?: ItemVisibility | undefined; version: number; createdAt: string; updatedAt: string;
}
export interface Todo {
  id: string; workspaceId: string; createdBy: string; noteId?: string | null | undefined;
  title: string; detail: string; dueDate?: string | null | undefined;
  priority: Priority; visibility?: ItemVisibility | undefined; isDone: boolean; doneAt?: string | null | undefined; createdAt: string; updatedAt: string;
}
export type TodoItem = Todo;

export class DomainError extends Error {
  constructor(message: string) { super(message); this.name = this.constructor.name; }
}
export class NoteNotFoundError extends DomainError { constructor(id: string) { super(`Nota no encontrada: ${id}`); } }
export class TodoNotFoundError extends DomainError { constructor(id: string) { super(`Pendiente no encontrado: ${id}`); } }
export class UnauthorizedWorkspaceError extends DomainError { constructor(id: string) { super(`No autorizado: ${id}`); } }
export class ForbiddenWorkspaceActionError extends DomainError {}
export class LastOwnerProtectionError extends DomainError { constructor() { super('El espacio de trabajo debe conservar al menos un propietario (owner)'); } }
export class InvitationError extends DomainError {}
export class AgencyLimitExceededError extends DomainError { constructor() { super(`Límite máximo de ${MAX_AGENCIES_PER_OWNER} agencias por propietario alcanzado`); } }
export class InvalidTodoStateError extends DomainError {}
export class ConcurrencyError extends DomainError { constructor(exp: number, act: number) { super(`Conflicto versión: esperada ${exp}, actual ${act}`); } }

export const getEffectiveVisibility = (item: { visibility?: ItemVisibility | undefined }): ItemVisibility => item.visibility ?? 'private';
export const normalizeInvitationEmail = (email: string): string => email.trim().toLowerCase();
export const emailsMatchNormalized = (a: string, b: string): boolean => normalizeInvitationEmail(a) === normalizeInvitationEmail(b);

export const getInvitationStatus = (inv: Pick<WorkspaceInvitationEntity, 'acceptedAt' | 'revokedAt' | 'expiresAt'>, nowIso: string): InvitationStatus =>
  inv.revokedAt ? 'revoked' : inv.acceptedAt ? 'accepted' : inv.expiresAt <= nowIso ? 'expired' : 'pending';

export const canReadItem = (actorId: string, actorRole: WorkspaceRole | null, item: { createdBy: string; visibility?: ItemVisibility | undefined }): boolean =>
  actorRole !== null && (getEffectiveVisibility(item) === 'workspace' || item.createdBy === actorId);

export const canCreateWithVisibility = (actorRole: WorkspaceRole | null, visibility: ItemVisibility): boolean =>
  actorRole !== null && (visibility === 'private' || actorRole !== 'viewer');

export const canEditItem = (actorId: string, actorRole: WorkspaceRole | null, item: { createdBy: string; visibility?: ItemVisibility | undefined }): boolean =>
  actorRole !== null && (getEffectiveVisibility(item) === 'private' ? item.createdBy === actorId : actorRole !== 'viewer');

export const canDeleteItem = (actorId: string, actorRole: WorkspaceRole | null, item: { createdBy: string; visibility?: ItemVisibility | undefined }): boolean =>
  actorRole !== null && (getEffectiveVisibility(item) === 'private' ? item.createdBy === actorId : item.createdBy === actorId || actorRole === 'owner' || actorRole === 'admin');

export const canChangeItemVisibility = (actorId: string, actorRole: WorkspaceRole | null, item: { createdBy: string }, next: ItemVisibility): boolean =>
  actorRole !== null && actorRole !== 'viewer' && item.createdBy === actorId && (next === 'private' || next === 'workspace');

export function canLinkTodoToNote(actorId: string, todoVisibility: ItemVisibility, note: Pick<Note, 'workspaceId' | 'createdBy' | 'visibility'>, workspaceId: string): boolean {
  if (note.workspaceId !== workspaceId) return false;
  const noteVis = getEffectiveVisibility(note);
  return todoVisibility === 'workspace' ? noteVis === 'workspace' : noteVis === 'workspace' || note.createdBy === actorId;
}

export function changeItemVisibility<T extends Note | Todo>(item: T, nextVisibility: ItemVisibility, actorId: string, actorRole: WorkspaceRole | null, now: string): T {
  if (!canChangeItemVisibility(actorId, actorRole, item, nextVisibility)) throw new ForbiddenWorkspaceActionError('Solo el autor con permisos de edición puede cambiar la visibilidad');
  return { ...item, visibility: nextVisibility, updatedAt: now };
}

export const unlinkIncompatibleTodosOnNotePrivatized = (note: Pick<Note, 'id' | 'workspaceId' | 'createdBy'>, todos: readonly Todo[], now: string): Todo[] =>
  todos.map(t => (t.workspaceId === note.workspaceId && t.noteId === note.id && (t.createdBy !== note.createdBy || getEffectiveVisibility(t) === 'workspace') ? { ...t, noteId: null, updatedAt: now } : t));

export function canChangeMemberRole(p: { workspaceKind: WorkspaceKind; actorId: string; actorRole: WorkspaceRole | null; targetUserId: string; targetCurrentRole: WorkspaceRole; nextRole: WorkspaceRole; ownerCount: number }): { allowed: boolean; reason?: string } {
  if (p.workspaceKind === 'personal') return { allowed: false, reason: 'No se pueden cambiar roles en un espacio personal' };
  if (p.actorRole !== 'owner' && p.actorRole !== 'admin') return { allowed: false, reason: 'Rol sin permisos para gestionar miembros' };
  if (p.actorId === p.targetUserId) {
    if (p.actorRole !== 'owner' || p.nextRole === 'owner') return { allowed: false, reason: 'Nadie puede escalar o autoasignar su propio rol' };
    return p.ownerCount < 2 ? { allowed: false, reason: 'El espacio de trabajo debe conservar al menos un propietario (owner)' } : { allowed: true };
  }
  if (p.actorRole === 'admin') {
    if (p.targetCurrentRole === 'owner' || p.targetCurrentRole === 'admin') return { allowed: false, reason: 'Un administrador no puede modificar a propietarios ni a otros administradores' };
    return p.nextRole === 'owner' || p.nextRole === 'admin' ? { allowed: false, reason: 'Un administrador solo puede asignar roles de editor o lector' } : { allowed: true };
  }
  return p.targetCurrentRole === 'owner' && p.nextRole !== 'owner' && p.ownerCount < 2
    ? { allowed: false, reason: 'El espacio de trabajo debe conservar al menos un propietario (owner)' }
    : { allowed: true };
}

export function canRemoveOrLeaveMember(p: { workspaceKind: WorkspaceKind; actorId: string; actorRole: WorkspaceRole | null; targetUserId: string; targetCurrentRole: WorkspaceRole; ownerCount: number }): { allowed: boolean; reason?: string } {
  if (p.workspaceKind === 'personal') return { allowed: false, reason: 'No se puede abandonar ni eliminar miembros de un espacio personal' };
  if (p.actorRole === null) return { allowed: false, reason: 'No pertenece al espacio de trabajo' };
  if (p.targetCurrentRole === 'owner' && p.ownerCount < 2) return { allowed: false, reason: 'El espacio de trabajo debe conservar al menos un propietario (owner)' };
  if (p.actorId === p.targetUserId || p.actorRole === 'owner') return { allowed: true };
  if (p.actorRole === 'admin' && (p.targetCurrentRole === 'editor' || p.targetCurrentRole === 'viewer')) return { allowed: true };
  return { allowed: false, reason: 'Sin permisos para remover a este miembro' };
}

export function canManageInvitation(p: { workspaceKind: WorkspaceKind; actorRole: WorkspaceRole | null; invitedRole: InvitationRole; pendingCount?: number }): { allowed: boolean; reason?: string } {
  if (p.workspaceKind !== 'agency') return { allowed: false, reason: 'Solo se permiten invitaciones en espacios de tipo agencia' };
  if (p.actorRole !== 'owner' && p.actorRole !== 'admin') return { allowed: false, reason: 'Solo propietarios y administradores pueden gestionar invitaciones' };
  if (p.actorRole === 'admin' && p.invitedRole === 'admin') return { allowed: false, reason: 'Solo un propietario puede invitar o revocar administradores' };
  if (p.pendingCount !== undefined && p.pendingCount >= MAX_PENDING_INVITATIONS_PER_WORKSPACE) return { allowed: false, reason: `Se alcanzó el límite de ${MAX_PENDING_INVITATIONS_PER_WORKSPACE} invitaciones pendientes` };
  return { allowed: true };
}

export const isOverdue = (t: Todo, ref: string) => !t.isDone && Boolean(t.dueDate && t.dueDate < ref);
export const isToday = (t: Todo, ref: string) => !t.isDone && (t.dueDate === ref || isOverdue(t, ref));
export const isUpcoming = (t: Todo, ref: string) => !t.isDone && Boolean(t.dueDate && t.dueDate > ref);
export const isNoDate = (t: Todo) => !t.isDone && !t.dueDate;
export const isDoneView = (t: Todo) => t.isDone;

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function classifyTodoView(t: Todo, ref: string): TodoView {
  if (isDoneView(t)) return 'done';
  if (isToday(t, ref)) return 'today';
  if (isUpcoming(t, ref)) return 'upcoming';
  return 'no_date';
}

export function sortTodosForView(todos: readonly Todo[], view: TodoView, ref: string): Todo[] {
  const list = [...todos];
  if (view === 'today') {
    return list.sort((a, b) => {
      const aOver = isOverdue(a, ref) ? 0 : 1, bOver = isOverdue(b, ref) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pDiff !== 0) return pDiff;
      return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
    });
  }
  if (view === 'upcoming') {
    return list.sort((a, b) => {
      const dDiff = (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
      return dDiff !== 0 ? dDiff : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });
  }
  return list;
}

export const toggleTodo = (t: Todo, now: string): Todo =>
  t.isDone ? { ...t, isDone: false, doneAt: null, updatedAt: now } : { ...t, isDone: true, doneAt: now, updatedAt: now };
export const completeTodo = (t: Todo, now: string): Todo => t.isDone ? t : { ...t, isDone: true, doneAt: now, updatedAt: now };
export const reopenTodo = (t: Todo, now: string): Todo => !t.isDone ? t : { ...t, isDone: false, doneAt: null, updatedAt: now };
export const updateNoteContent = (n: Note, title: string, content: string, now: string): Note =>
  ({ ...n, title, content, version: n.version + 1, updatedAt: now });
export const pinNote = (n: Note, isPinned: boolean, now: string): Note => ({ ...n, isPinned, updatedAt: now });
export const archiveNote = (n: Note, isArchived: boolean, now: string): Note => ({ ...n, isArchived, updatedAt: now });

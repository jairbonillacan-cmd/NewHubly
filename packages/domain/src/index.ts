// Entidades y reglas de negocio puras (ADR 0002).
export type Priority = 'low' | 'medium' | 'high';
export type TodoView = 'today' | 'upcoming' | 'no_date' | 'done';

export interface Note {
  id: string; workspaceId: string; createdBy: string; title: string; content: string;
  isPinned: boolean; isArchived: boolean; version: number; createdAt: string; updatedAt: string;
}
export interface Todo {
  id: string; workspaceId: string; createdBy: string; noteId?: string | null | undefined;
  title: string; detail?: string | null | undefined; dueDate?: string | null | undefined;
  priority: Priority; isDone: boolean; doneAt?: string | null | undefined; createdAt: string; updatedAt: string;
}

export class DomainError extends Error {
  constructor(message: string) { super(message); this.name = this.constructor.name; }
}
export class NoteNotFoundError extends DomainError { constructor(id: string) { super(`Nota no encontrada: ${id}`); } }
export class TodoNotFoundError extends DomainError { constructor(id: string) { super(`Pendiente no encontrado: ${id}`); } }
export class UnauthorizedWorkspaceError extends DomainError { constructor(id: string) { super(`No autorizado: ${id}`); } }
export class InvalidTodoStateError extends DomainError {}
export class ConcurrencyError extends DomainError {
  constructor(exp: number, act: number) { super(`Conflicto versión: esperada ${exp}, actual ${act}`); }
}

export const isOverdue = (t: Todo, ref: string) => !t.isDone && Boolean(t.dueDate && t.dueDate < ref);
export const isToday = (t: Todo, ref: string) => !t.isDone && (t.dueDate === ref || isOverdue(t, ref));
export const isUpcoming = (t: Todo, ref: string) => !t.isDone && Boolean(t.dueDate && t.dueDate > ref);
export const isNoDate = (t: Todo) => !t.isDone && !t.dueDate;
export const isDoneView = (t: Todo) => t.isDone;

export function classifyTodoView(t: Todo, ref: string): TodoView {
  if (isDoneView(t)) return 'done';
  if (isToday(t, ref)) return 'today';
  if (isUpcoming(t, ref)) return 'upcoming';
  return 'no_date';
}

export const toggleTodo = (t: Todo, now: string): Todo =>
  t.isDone ? { ...t, isDone: false, doneAt: null, updatedAt: now } : { ...t, isDone: true, doneAt: now, updatedAt: now };
export const completeTodo = (t: Todo, now: string): Todo => t.isDone ? t : { ...t, isDone: true, doneAt: now, updatedAt: now };
export const reopenTodo = (t: Todo, now: string): Todo => !t.isDone ? t : { ...t, isDone: false, doneAt: null, updatedAt: now };
export const updateNoteContent = (n: Note, title: string, content: string, now: string): Note =>
  ({ ...n, title, content, version: n.version + 1, updatedAt: now });
export const pinNote = (n: Note, isPinned: boolean, now: string): Note => ({ ...n, isPinned, updatedAt: now });
export const archiveNote = (n: Note, isArchived: boolean, now: string): Note => ({ ...n, isArchived, updatedAt: now });

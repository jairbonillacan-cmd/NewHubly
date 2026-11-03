// Casos de uso y puertos. Sin framework ni base de datos (ADR 0002).
import type { Note, Todo, TodoView } from '@hubly/domain';
import {
  isToday, isUpcoming, isNoDate, isDoneView, sortTodosForView, ConcurrencyError, NoteNotFoundError, TodoNotFoundError,
  pinNote as domainPinNote, archiveNote as domainArchiveNote, toggleTodo as domainToggleTodo,
} from '@hubly/domain';
import type { CreateNoteInput, UpdateNoteInput, CreateTodoInput, UpdateTodoInput, ExportData } from '@hubly/contracts';

export interface Clock { now(): Date; todayString(): string; }
export interface IdGenerator { generate(): string; }
export interface AppContext { workspaceId: string; userId: string; }
export interface NoteFilter { isPinned?: boolean; isArchived?: boolean; }
export interface TodoFilter { noteId?: string | null; isDone?: boolean; }

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

export class InMemoryNoteRepository implements NoteRepository {
  private items = new Map<string, Note>();
  async findById(id: string) { return this.items.get(id) ?? null; }
  async findByWorkspace(wId: string, uId: string, f?: NoteFilter) {
    return Array.from(this.items.values()).filter(n => n.workspaceId === wId && n.createdBy === uId && (f?.isPinned === undefined || n.isPinned === f.isPinned) && (f?.isArchived === undefined || n.isArchived === f.isArchived));
  }
  async save(n: Note) { this.items.set(n.id, n); } async delete(id: string) { this.items.delete(id); }
}

export class InMemoryTodoRepository implements TodoRepository {
  private items = new Map<string, Todo>();
  async findById(id: string) { return this.items.get(id) ?? null; }
  async findByWorkspace(wId: string, uId: string, f?: TodoFilter) {
    return Array.from(this.items.values()).filter(t => t.workspaceId === wId && t.createdBy === uId && (f?.noteId === undefined || t.noteId === f.noteId) && (f?.isDone === undefined || t.isDone === f.isDone));
  }
  async findTodayAndOverdue(wId: string, uId: string, ref: string) {
    const filtered = Array.from(this.items.values()).filter(t => t.workspaceId === wId && t.createdBy === uId && isToday(t, ref));
    return sortTodosForView(filtered, 'today', ref);
  }
  async save(t: Todo) { this.items.set(t.id, t); } async delete(id: string) { this.items.delete(id); }
}

export async function createNote(repo: NoteRepository, clock: Clock, idGen: IdGenerator, input: CreateNoteInput, ctx: AppContext): Promise<Note> {
  const ts = clock.now().toISOString();
  const note: Note = { id: idGen.generate(), workspaceId: ctx.workspaceId, createdBy: ctx.userId, title: input.title ?? '', content: input.content ?? '', isPinned: false, isArchived: false, version: 1, createdAt: ts, updatedAt: ts };
  await repo.save(note); return note;
}

export async function updateNote(repo: NoteRepository, clock: Clock, input: UpdateNoteInput, ctx: AppContext): Promise<Note> {
  const note = await repo.findById(input.id);
  if (!note || note.workspaceId !== ctx.workspaceId || note.createdBy !== ctx.userId) throw new NoteNotFoundError(input.id);
  if (input.expectedVersion !== undefined && note.version !== input.expectedVersion) throw new ConcurrencyError(input.expectedVersion, note.version);
  const title = input.title ?? note.title, content = input.content !== undefined ? input.content : note.content;
  const updated: Note = { ...note, title, content, isPinned: input.isPinned !== undefined ? input.isPinned : note.isPinned, isArchived: input.isArchived !== undefined ? input.isArchived : note.isArchived, version: (title !== note.title || content !== note.content) ? note.version + 1 : note.version, updatedAt: clock.now().toISOString() };
  await repo.save(updated); return updated;
}

export async function pinNote(r: NoteRepository, c: Clock, id: string, isPinned: boolean, ctx: AppContext) {
  const note = await r.findById(id);
  if (!note || note.workspaceId !== ctx.workspaceId || note.createdBy !== ctx.userId) throw new NoteNotFoundError(id);
  const updated = domainPinNote(note, isPinned, c.now().toISOString());
  await r.save(updated); return updated;
}

export async function archiveNote(r: NoteRepository, c: Clock, id: string, isArchived: boolean, ctx: AppContext) {
  const note = await r.findById(id);
  if (!note || note.workspaceId !== ctx.workspaceId || note.createdBy !== ctx.userId) throw new NoteNotFoundError(id);
  const updated = domainArchiveNote(note, isArchived, c.now().toISOString());
  await r.save(updated); return updated;
}

export const listNotes = (r: NoteRepository, ctx: AppContext, f?: NoteFilter) => r.findByWorkspace(ctx.workspaceId, ctx.userId, f);

export async function createTodo(repo: TodoRepository, clock: Clock, idGen: IdGenerator, input: CreateTodoInput, ctx: AppContext, noteRepo?: NoteRepository): Promise<Todo> {
  if (input.noteId) {
    const note = noteRepo ? await noteRepo.findById(input.noteId) : null;
    if (!note || note.workspaceId !== ctx.workspaceId || note.createdBy !== ctx.userId) throw new NoteNotFoundError(input.noteId);
  }
  const ts = clock.now().toISOString();
  const todo: Todo = { id: idGen.generate(), workspaceId: ctx.workspaceId, createdBy: ctx.userId, noteId: input.noteId ?? null, title: input.title, detail: input.detail ?? '', dueDate: input.dueDate ?? null, priority: input.priority ?? 'medium', isDone: false, doneAt: null, createdAt: ts, updatedAt: ts };
  await repo.save(todo); return todo;
}

export async function updateTodo(repo: TodoRepository, clock: Clock, input: UpdateTodoInput, ctx: AppContext, noteRepo?: NoteRepository): Promise<Todo> {
  const todo = await repo.findById(input.id);
  if (!todo || todo.workspaceId !== ctx.workspaceId || todo.createdBy !== ctx.userId) throw new TodoNotFoundError(input.id);
  if (input.noteId) {
    const note = noteRepo ? await noteRepo.findById(input.noteId) : null;
    if (!note || note.workspaceId !== ctx.workspaceId || note.createdBy !== ctx.userId) throw new NoteNotFoundError(input.noteId);
  }
  const now = clock.now().toISOString();
  const updated: Todo = { ...todo, title: input.title ?? todo.title, detail: input.detail !== undefined ? (input.detail ?? '') : todo.detail, dueDate: input.dueDate !== undefined ? input.dueDate : todo.dueDate, priority: input.priority ?? todo.priority, isDone: input.isDone !== undefined ? input.isDone : todo.isDone, doneAt: input.isDone !== undefined ? (input.isDone ? (todo.doneAt ?? now) : null) : todo.doneAt, noteId: input.noteId !== undefined ? input.noteId : todo.noteId, updatedAt: now };
  await repo.save(updated); return updated;
}

export async function toggleTodoDone(repo: TodoRepository, clock: Clock, id: string, ctx: AppContext): Promise<Todo> {
  const todo = await repo.findById(id);
  if (!todo || todo.workspaceId !== ctx.workspaceId || todo.createdBy !== ctx.userId) throw new TodoNotFoundError(id);
  const updated = domainToggleTodo(todo, clock.now().toISOString());
  await repo.save(updated); return updated;
}

export async function listTodosByView(repo: TodoRepository, clock: Clock, view: TodoView, ctx: AppContext): Promise<Todo[]> {
  const all = await repo.findByWorkspace(ctx.workspaceId, ctx.userId), ref = clock.todayString();
  const filtered = all.filter(t => (view === 'done' ? isDoneView(t) : view === 'today' ? isToday(t, ref) : view === 'upcoming' ? isUpcoming(t, ref) : isNoDate(t)));
  return sortTodosForView(filtered, view, ref);
}

export async function createTodoFromNote(tRepo: TodoRepository, nRepo: NoteRepository, c: Clock, idGen: IdGenerator, noteId: string, input: Omit<CreateTodoInput, 'noteId'>, ctx: AppContext): Promise<Todo> {
  const note = await nRepo.findById(noteId);
  if (!note || note.workspaceId !== ctx.workspaceId || note.createdBy !== ctx.userId) throw new NoteNotFoundError(noteId);
  return createTodo(tRepo, c, idGen, { ...input, noteId }, ctx, nRepo);
}

export async function exportWorkspaceData(nRepo: NoteRepository, tRepo: TodoRepository, c: Clock, ctx: AppContext): Promise<{ json: ExportData; markdown: string }> {
  const [notes, todos] = await Promise.all([nRepo.findByWorkspace(ctx.workspaceId, ctx.userId), tRepo.findByWorkspace(ctx.workspaceId, ctx.userId)]);
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

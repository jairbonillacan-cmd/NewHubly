// Casos de uso y puertos. Sin framework ni base de datos (ADR 0002).
import type { Note, Todo, TodoView } from '@hubly/domain';
import {
  isToday, isUpcoming, isNoDate, isDoneView,
  ConcurrencyError, NoteNotFoundError, TodoNotFoundError, UnauthorizedWorkspaceError,
} from '@hubly/domain';
import type { CreateNoteInput, UpdateNoteInput, CreateTodoInput, UpdateTodoInput, ExportData } from '@hubly/contracts';

export interface Clock { now(): Date; todayString(): string; }
export interface IdGenerator { generate(): string; }
export interface AppContext { workspaceId: string; userId: string; }
export interface NoteFilter { isPinned?: boolean; isArchived?: boolean; }
export interface TodoFilter { noteId?: string | null; isDone?: boolean; }

export interface NoteRepository {
  findById(id: string): Promise<Note | null>;
  findByWorkspace(workspaceId: string, filter?: NoteFilter): Promise<Note[]>;
  save(note: Note): Promise<void>;
  delete(id: string): Promise<void>;
}
export interface TodoRepository {
  findById(id: string): Promise<Todo | null>;
  findByWorkspace(workspaceId: string, filter?: TodoFilter): Promise<Todo[]>;
  findTodayAndOverdue(workspaceId: string, refDate: string): Promise<Todo[]>;
  save(todo: Todo): Promise<void>;
  delete(id: string): Promise<void>;
}

export class InMemoryNoteRepository implements NoteRepository {
  private items = new Map<string, Note>();
  async findById(id: string) { return this.items.get(id) ?? null; }
  async findByWorkspace(wId: string, filter?: NoteFilter) {
    return Array.from(this.items.values()).filter(n => n.workspaceId === wId && (filter?.isPinned === undefined || n.isPinned === filter.isPinned) && (filter?.isArchived === undefined || n.isArchived === filter.isArchived));
  }
  async save(note: Note) { this.items.set(note.id, note); }
  async delete(id: string) { this.items.delete(id); }
}

export class InMemoryTodoRepository implements TodoRepository {
  private items = new Map<string, Todo>();
  async findById(id: string) { return this.items.get(id) ?? null; }
  async findByWorkspace(wId: string, filter?: TodoFilter) {
    return Array.from(this.items.values()).filter(t => t.workspaceId === wId && (filter?.noteId === undefined || t.noteId === filter.noteId) && (filter?.isDone === undefined || t.isDone === filter.isDone));
  }
  async findTodayAndOverdue(wId: string, refDate: string) {
    return Array.from(this.items.values()).filter(t => t.workspaceId === wId && isToday(t, refDate));
  }
  async save(todo: Todo) { this.items.set(todo.id, todo); }
  async delete(id: string) { this.items.delete(id); }
}

export async function createNote(repo: NoteRepository, clock: Clock, idGen: IdGenerator, input: CreateNoteInput, ctx: AppContext): Promise<Note> {
  const ts = clock.now().toISOString();
  const note: Note = {
    id: idGen.generate(), workspaceId: ctx.workspaceId, createdBy: ctx.userId,
    title: input.title, content: input.content ?? '', isPinned: false, isArchived: false,
    version: 1, createdAt: ts, updatedAt: ts,
  };
  await repo.save(note);
  return note;
}

export async function updateNote(repo: NoteRepository, clock: Clock, input: UpdateNoteInput, ctx: AppContext): Promise<Note> {
  const note = await repo.findById(input.id);
  if (!note) throw new NoteNotFoundError(input.id);
  if (note.workspaceId !== ctx.workspaceId) throw new UnauthorizedWorkspaceError(ctx.workspaceId);
  if (input.expectedVersion !== undefined && note.version !== input.expectedVersion) throw new ConcurrencyError(input.expectedVersion, note.version);
  const updated: Note = {
    ...note,
    title: input.title ?? note.title,
    content: input.content !== undefined ? input.content : note.content,
    isPinned: input.isPinned !== undefined ? input.isPinned : note.isPinned,
    isArchived: input.isArchived !== undefined ? input.isArchived : note.isArchived,
    version: note.version + 1, updatedAt: clock.now().toISOString(),
  };
  await repo.save(updated);
  return updated;
}

export const pinNote = (r: NoteRepository, c: Clock, id: string, isPinned: boolean, ctx: AppContext) => updateNote(r, c, { id, isPinned }, ctx);
export const archiveNote = (r: NoteRepository, c: Clock, id: string, isArchived: boolean, ctx: AppContext) => updateNote(r, c, { id, isArchived }, ctx);
export const listNotes = (r: NoteRepository, ctx: AppContext, f?: NoteFilter) => r.findByWorkspace(ctx.workspaceId, f);

export async function createTodo(repo: TodoRepository, clock: Clock, idGen: IdGenerator, input: CreateTodoInput, ctx: AppContext): Promise<Todo> {
  const ts = clock.now().toISOString();
  const todo: Todo = {
    id: idGen.generate(), workspaceId: ctx.workspaceId, createdBy: ctx.userId,
    noteId: input.noteId ?? null, title: input.title, detail: input.detail ?? null,
    dueDate: input.dueDate ?? null, priority: input.priority ?? 'medium', isDone: false,
    doneAt: null, createdAt: ts, updatedAt: ts,
  };
  await repo.save(todo);
  return todo;
}

export async function updateTodo(repo: TodoRepository, clock: Clock, input: UpdateTodoInput, ctx: AppContext): Promise<Todo> {
  const todo = await repo.findById(input.id);
  if (!todo) throw new TodoNotFoundError(input.id);
  if (todo.workspaceId !== ctx.workspaceId) throw new UnauthorizedWorkspaceError(ctx.workspaceId);
  const updated: Todo = {
    ...todo,
    title: input.title ?? todo.title, detail: input.detail !== undefined ? input.detail : todo.detail,
    dueDate: input.dueDate !== undefined ? input.dueDate : todo.dueDate, priority: input.priority ?? todo.priority,
    isDone: input.isDone !== undefined ? input.isDone : todo.isDone,
    doneAt: input.isDone !== undefined ? (input.isDone ? clock.now().toISOString() : null) : todo.doneAt,
    noteId: input.noteId !== undefined ? input.noteId : todo.noteId, updatedAt: clock.now().toISOString(),
  };
  await repo.save(updated);
  return updated;
}

export async function toggleTodoDone(repo: TodoRepository, clock: Clock, id: string, ctx: AppContext): Promise<Todo> {
  const todo = await repo.findById(id);
  if (!todo) throw new TodoNotFoundError(id);
  if (todo.workspaceId !== ctx.workspaceId) throw new UnauthorizedWorkspaceError(ctx.workspaceId);
  const now = clock.now().toISOString();
  const updated: Todo = todo.isDone ? { ...todo, isDone: false, doneAt: null, updatedAt: now } : { ...todo, isDone: true, doneAt: now, updatedAt: now };
  await repo.save(updated);
  return updated;
}

export async function listTodosByView(repo: TodoRepository, clock: Clock, view: TodoView, ctx: AppContext): Promise<Todo[]> {
  const all = await repo.findByWorkspace(ctx.workspaceId);
  const ref = clock.todayString();
  return all.filter(t => (view === 'done' ? isDoneView(t) : view === 'today' ? isToday(t, ref) : view === 'upcoming' ? isUpcoming(t, ref) : isNoDate(t)));
}

export async function createTodoFromNote(tRepo: TodoRepository, nRepo: NoteRepository, c: Clock, idGen: IdGenerator, noteId: string, input: Omit<CreateTodoInput, 'noteId'>, ctx: AppContext): Promise<Todo> {
  const note = await nRepo.findById(noteId);
  if (!note || note.workspaceId !== ctx.workspaceId) throw new NoteNotFoundError(noteId);
  return createTodo(tRepo, c, idGen, { ...input, noteId }, ctx);
}

export async function exportWorkspaceData(nRepo: NoteRepository, tRepo: TodoRepository, c: Clock, ctx: AppContext): Promise<{ json: ExportData; markdown: string }> {
  const notes = await nRepo.findByWorkspace(ctx.workspaceId);
  const todos = await tRepo.findByWorkspace(ctx.workspaceId);
  const json: ExportData = { version: 1, exportedAt: c.now().toISOString(), workspaceId: ctx.workspaceId, notes, todos };
  const mdNotes = notes.map(n => `## ${n.title}\n${n.content}`).join('\n\n');
  const mdTodos = todos.map(t => `- [${t.isDone ? 'x' : ' '}] ${t.title}${t.dueDate ? ` (Vence: ${t.dueDate})` : ''}`).join('\n');
  return { json, markdown: `# Exportación de datos\n\n# Notas\n${mdNotes || 'Sin notas.'}\n\n# Pendientes\n${mdTodos || 'Sin pendientes.'}\n` };
}

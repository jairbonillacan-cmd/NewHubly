import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryNoteRepository, InMemoryTodoRepository,
  createNote, updateNote, pinNote, archiveNote, listNotes,
  createTodo, updateTodo, toggleTodoDone, listTodosByView,
  createTodoFromNote, exportWorkspaceData, type Clock, type IdGenerator,
} from './index.js';
import { ConcurrencyError, NoteNotFoundError, TodoNotFoundError } from '@hubly/domain';

const makeClock = (dt = '2026-11-03T10:00:00.000Z'): Clock => ({ now: () => new Date(dt), todayString: () => dt.slice(0, 10) });
const makeIdGen = (): IdGenerator => { let n = 0; return { generate: () => `id-${++n}` }; };

describe('Application: Use cases', () => {
  let noteRepo: InMemoryNoteRepository;
  let todoRepo: InMemoryTodoRepository;
  let clock: Clock;
  let idGen: IdGenerator;
  const ctx1 = { workspaceId: 'w-1', userId: 'u-1' };
  const ctx2 = { workspaceId: 'w-1', userId: 'u-2' };

  beforeEach(() => {
    noteRepo = new InMemoryNoteRepository();
    todoRepo = new InMemoryTodoRepository();
    clock = makeClock();
    idGen = makeIdGen();
  });

  it('controla ciclo de notas y concurrencia optimista sin conflicto al fijar', async () => {
    const note = await createNote(noteRepo, clock, idGen, { title: 'Borrador', content: 'Inicio' }, ctx1);
    const updated = await updateNote(noteRepo, clock, { id: note.id, content: 'Modificado', expectedVersion: 1 }, ctx1);
    expect(updated.version).toBe(2);
    await expect(updateNote(noteRepo, clock, { id: note.id, expectedVersion: 1 }, ctx1)).rejects.toThrow(ConcurrencyError);
    expect((await pinNote(noteRepo, clock, note.id, true, ctx1)).version).toBe(2);
    expect((await archiveNote(noteRepo, clock, note.id, true, ctx1)).version).toBe(2);
    expect(await listNotes(noteRepo, ctx1)).toHaveLength(1);
  });

  it('gestiona pendientes y ordena vistas Hoy (vencidos, prioridad, fecha) y Próximos (por fecha)', async () => {
    const todayLow = await createTodo(todoRepo, clock, idGen, { title: 'Hoy baja', dueDate: '2026-11-03', priority: 'low' }, ctx1);
    const todayHigh = await createTodo(todoRepo, clock, idGen, { title: 'Hoy alta', dueDate: '2026-11-03', priority: 'high' }, ctx1);
    const overdueMed2 = await createTodo(todoRepo, clock, idGen, { title: 'Vencido 2', dueDate: '2026-11-02', priority: 'medium' }, ctx1);
    const overdueMed1 = await createTodo(todoRepo, clock, idGen, { title: 'Vencido 1', dueDate: '2026-11-01', priority: 'medium' }, ctx1);
    const overdueHigh = await createTodo(todoRepo, clock, idGen, { title: 'Vencido alta', dueDate: '2026-11-02', priority: 'high' }, ctx1);
    const upcoming2 = await createTodo(todoRepo, clock, idGen, { title: 'Pasado mañana', dueDate: '2026-11-05', priority: 'high' }, ctx1);
    const upcoming1 = await createTodo(todoRepo, clock, idGen, { title: 'Mañana', dueDate: '2026-11-04', priority: 'low' }, ctx1);
    const noDate = await createTodo(todoRepo, clock, idGen, { title: 'Sin fecha' }, ctx1);
    expect(noDate.detail).toBe('');
    expect((await listTodosByView(todoRepo, clock, 'today', ctx1)).map(t => t.id)).toEqual([
      overdueHigh.id,
      overdueMed1.id,
      overdueMed2.id,
      todayHigh.id,
      todayLow.id,
    ]);
    expect((await listTodosByView(todoRepo, clock, 'upcoming', ctx1)).map(t => t.id)).toEqual([upcoming1.id, upcoming2.id]);
    expect((await listTodosByView(todoRepo, clock, 'no_date', ctx1)).map(t => t.id)).toEqual([noDate.id]);
    expect((await toggleTodoDone(todoRepo, clock, todayLow.id, ctx1)).isDone).toBe(true);
    expect((await listTodosByView(todoRepo, clock, 'done', ctx1)).map(t => t.id)).toEqual([todayLow.id]);
    expect((await updateTodo(todoRepo, clock, { id: noDate.id, title: 'Con fecha', detail: 'D' }, ctx1)).detail).toBe('D');
  });

  it('exporta markdown completo incluyendo detail, prioridad, estado y vínculo', async () => {
    const note = await createNote(noteRepo, clock, idGen, { title: 'Reunión', content: 'Contenido' }, ctx1);
    await pinNote(noteRepo, clock, note.id, true, ctx1);
    const todo = await createTodoFromNote(todoRepo, noteRepo, clock, idGen, note.id, { title: 'Minuta', priority: 'high', detail: 'Enviar resumen' }, ctx1);
    expect(todo.noteId).toBe(note.id);
    const exp = await exportWorkspaceData(noteRepo, todoRepo, clock, ctx1);
    expect(exp.json.version).toBe(1);
    expect(exp.markdown).toContain('## Reunión [Fijada]');
    expect(exp.markdown).toContain('- [ ] [ALTA] Minuta (Nota: id-1)\n  Enviar resumen');
  });

  it('aísla estrictamente por autor impidiendo acceso y fuga a un segundo usuario', async () => {
    const note = await createNote(noteRepo, clock, idGen, { title: 'Privada' }, ctx1);
    const todo = await createTodo(todoRepo, clock, idGen, { title: 'Privado' }, ctx1);
    expect(await listNotes(noteRepo, ctx2)).toHaveLength(0);
    expect(await listTodosByView(todoRepo, clock, 'today', ctx2)).toHaveLength(0);
    const exp = await exportWorkspaceData(noteRepo, todoRepo, clock, ctx2);
    expect(exp.json.notes).toHaveLength(0);
    expect(exp.json.todos).toHaveLength(0);
    await expect(updateNote(noteRepo, clock, { id: note.id }, ctx2)).rejects.toThrow(NoteNotFoundError);
    await expect(pinNote(noteRepo, clock, note.id, true, ctx2)).rejects.toThrow(NoteNotFoundError);
    await expect(archiveNote(noteRepo, clock, note.id, true, ctx2)).rejects.toThrow(NoteNotFoundError);
    await expect(updateTodo(todoRepo, clock, { id: todo.id }, ctx2)).rejects.toThrow(TodoNotFoundError);
    await expect(toggleTodoDone(todoRepo, clock, todo.id, ctx2)).rejects.toThrow(TodoNotFoundError);
    await expect(createTodoFromNote(todoRepo, noteRepo, clock, idGen, note.id, { title: 'X' }, ctx2)).rejects.toThrow(NoteNotFoundError);
    const u2Todo = await createTodo(todoRepo, clock, idGen, { title: 'Propio' }, ctx2);
    await expect(updateTodo(todoRepo, clock, { id: u2Todo.id, noteId: note.id }, ctx2, noteRepo)).rejects.toThrow(NoteNotFoundError);
  });
});

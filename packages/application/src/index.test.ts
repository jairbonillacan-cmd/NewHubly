import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryNoteRepository, InMemoryTodoRepository,
  createNote, updateNote, pinNote, archiveNote, listNotes,
  createTodo, updateTodo, toggleTodoDone, listTodosByView,
  createTodoFromNote, exportWorkspaceData, type Clock, type IdGenerator,
} from './index.js';
import { ConcurrencyError, NoteNotFoundError } from '@hubly/domain';

class FakeClock implements Clock {
  constructor(private dt = '2026-11-03T10:00:00.000Z') {}
  now() { return new Date(this.dt); }
  todayString() { return this.dt.slice(0, 10); }
}
class FakeIdGen implements IdGenerator {
  private n = 0;
  generate() { return `id-${++this.n}`; }
}

describe('Application: Use cases', () => {
  let noteRepo: InMemoryNoteRepository;
  let todoRepo: InMemoryTodoRepository;
  let clock: FakeClock;
  let idGen: FakeIdGen;
  const ctx = { workspaceId: 'w-1', userId: 'u-1' };

  beforeEach(() => {
    noteRepo = new InMemoryNoteRepository();
    todoRepo = new InMemoryTodoRepository();
    clock = new FakeClock();
    idGen = new FakeIdGen();
  });

  it('controla ciclo de notas y concurrencia optimista', async () => {
    const note = await createNote(noteRepo, clock, idGen, { title: 'Borrador', content: 'Inicio' }, ctx);
    const updated = await updateNote(noteRepo, clock, { id: note.id, content: 'Modificado', expectedVersion: 1 }, ctx);
    expect(updated.version).toBe(2);
    await expect(updateNote(noteRepo, clock, { id: note.id, expectedVersion: 1 }, ctx)).rejects.toThrow(ConcurrencyError);
    expect((await pinNote(noteRepo, clock, note.id, true, ctx)).isPinned).toBe(true);
    expect((await archiveNote(noteRepo, clock, note.id, true, ctx)).isArchived).toBe(true);
    expect(await listNotes(noteRepo, ctx)).toHaveLength(1);
  });

  it('gestiona pendientes y filtros de vistas', async () => {
    const overdue = await createTodo(todoRepo, clock, idGen, { title: 'Vencido', dueDate: '2026-11-02' }, ctx);
    const today = await createTodo(todoRepo, clock, idGen, { title: 'Hoy', dueDate: '2026-11-03' }, ctx);
    const upcoming = await createTodo(todoRepo, clock, idGen, { title: 'Mañana', dueDate: '2026-11-04' }, ctx);
    const noDate = await createTodo(todoRepo, clock, idGen, { title: 'Sin fecha' }, ctx);

    expect((await listTodosByView(todoRepo, clock, 'today', ctx)).map(t => t.id)).toEqual([overdue.id, today.id]);
    expect((await listTodosByView(todoRepo, clock, 'upcoming', ctx)).map(t => t.id)).toEqual([upcoming.id]);
    expect((await listTodosByView(todoRepo, clock, 'no_date', ctx)).map(t => t.id)).toEqual([noDate.id]);

    const done = await toggleTodoDone(todoRepo, clock, today.id, ctx);
    expect(done.isDone).toBe(true);
    expect((await listTodosByView(todoRepo, clock, 'done', ctx)).map(t => t.id)).toEqual([today.id]);
    expect((await updateTodo(todoRepo, clock, { id: noDate.id, title: 'Con fecha' }, ctx)).title).toBe('Con fecha');
  });

  it('crea pendiente desde nota y exporta datos de workspace', async () => {
    const note = await createNote(noteRepo, clock, idGen, { title: 'Reunión' }, ctx);
    const todo = await createTodoFromNote(todoRepo, noteRepo, clock, idGen, note.id, { title: 'Seguimiento' }, ctx);
    expect(todo.noteId).toBe(note.id);
    await expect(createTodoFromNote(todoRepo, noteRepo, clock, idGen, 'fake-id', { title: 'Fallo' }, ctx)).rejects.toThrow(NoteNotFoundError);

    const exp = await exportWorkspaceData(noteRepo, todoRepo, clock, ctx);
    expect(exp.json.version).toBe(1);
    expect(exp.markdown).toContain('## Reunión');
    expect(exp.markdown).toContain('- [ ] Seguimiento');
  });
});

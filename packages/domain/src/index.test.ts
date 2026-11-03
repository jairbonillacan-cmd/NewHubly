import { describe, it, expect } from 'vitest';
import { classifyTodoView, isOverdue, isToday, isUpcoming, isNoDate, isDoneView, toggleTodo, completeTodo, reopenTodo, updateNoteContent, pinNote, archiveNote, NoteNotFoundError, TodoNotFoundError, ConcurrencyError, type Todo, type Note } from './index.js';

const baseTodo: Todo = {
  id: 't-1', workspaceId: 'w-1', createdBy: 'u-1', title: 'T', priority: 'medium',
  isDone: false, createdAt: '2026-11-03T10:00:00Z', updatedAt: '2026-11-03T10:00:00Z',
};
const baseNote: Note = {
  id: 'n-1', workspaceId: 'w-1', createdBy: 'u-1', title: 'N', content: 'C',
  isPinned: false, isArchived: false, version: 1, createdAt: '2026-11-03T10:00:00Z', updatedAt: '2026-11-03T10:00:00Z',
};

describe('Domain logic', () => {
  const ref = '2026-11-03';
  it('clasifica vistas de pendientes correctamente', () => {
    expect(classifyTodoView({ ...baseTodo, dueDate: '2026-11-02' }, ref)).toBe('today');
    expect(classifyTodoView({ ...baseTodo, dueDate: '2026-11-03' }, ref)).toBe('today');
    expect(classifyTodoView({ ...baseTodo, dueDate: '2026-11-04' }, ref)).toBe('upcoming');
    expect(classifyTodoView({ ...baseTodo, dueDate: null }, ref)).toBe('no_date');
    expect(classifyTodoView({ ...baseTodo, isDone: true, doneAt: '2026-11-03T10:00:00Z' }, ref)).toBe('done');
    expect(isOverdue({ ...baseTodo, dueDate: '2026-11-02' }, ref)).toBe(true);
    expect(isToday({ ...baseTodo, dueDate: '2026-11-03' }, ref)).toBe(true);
    expect(isUpcoming({ ...baseTodo, dueDate: '2026-11-04' }, ref)).toBe(true);
    expect(isNoDate({ ...baseTodo, dueDate: null })).toBe(true);
    expect(isDoneView({ ...baseTodo, isDone: true })).toBe(true);
  });

  it('ejecuta transiciones puras de Todo y Note', () => {
    const now = '2026-11-03T12:00:00Z';
    const done = toggleTodo(baseTodo, now);
    expect(done.isDone && done.doneAt === now).toBe(true);
    expect(toggleTodo(done, now).isDone).toBe(false);
    expect(completeTodo(baseTodo, now).isDone).toBe(true);
    expect(reopenTodo(done, now).isDone).toBe(false);

    const updated = updateNoteContent(baseNote, 'T2', 'C2', now);
    expect(updated.version === 2 && updated.title === 'T2' && updated.content === 'C2').toBe(true);
    expect(pinNote(baseNote, true, now).isPinned).toBe(true);
    expect(archiveNote(baseNote, true, now).isArchived).toBe(true);
    expect(new NoteNotFoundError('x').message).toContain('x');
    expect(new TodoNotFoundError('y').message).toContain('y');
    expect(new ConcurrencyError(1, 2).message).toContain('esperada 1');
  });
});

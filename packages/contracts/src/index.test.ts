import { describe, it, expect } from 'vitest';
import { createNoteSchema, updateNoteSchema, createTodoSchema, updateTodoSchema, exportDataSchema } from './index.js';

describe('Contracts: Zod schemas', () => {
  it('valida notas rechazando entradas inválidas y admitiendo válidas', () => {
    expect(createNoteSchema.safeParse({ title: ' ' }).error?.issues[0]?.message).toBe('El título no puede estar vacío');
    expect(createNoteSchema.safeParse({ title: 'a'.repeat(201) }).error?.issues[0]?.message).toContain('200');
    expect(updateNoteSchema.safeParse({ id: '1', expectedVersion: 0 }).error?.issues[0]?.message).toContain('positivo');
  });

  it('valida pendientes con rechazos claros en español y valores por defecto', () => {
    expect(createTodoSchema.safeParse({ title: '' }).error?.issues[0]?.message).toBe('El título es obligatorio');
    expect(createTodoSchema.safeParse({ title: 'A', priority: 'x' as unknown as 'low' }).error?.issues[0]?.message).toBe('Prioridad inválida');
    expect(createTodoSchema.safeParse({ title: 'A', dueDate: '03-11' }).error?.issues[0]?.message).toContain('YYYY-MM-DD');
    expect(createTodoSchema.safeParse({ title: 'A', noteId: 'bad' }).error?.issues[0]?.message).toContain('UUID');
    const valid = createTodoSchema.safeParse({ title: 'Ok' });
    expect(valid.success && valid.data.priority).toBe('medium');
    expect(updateTodoSchema.safeParse({ id: 't-1', isDone: true }).success).toBe(true);
  });

  it('valida estructura de exportDataSchema', () => {
    expect(exportDataSchema.safeParse({ version: 1, exportedAt: '2026-11-03', workspaceId: 'w-1', notes: [], todos: [] }).success).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { createNoteSchema, updateNoteSchema, createTodoSchema, updateTodoSchema, exportDataSchema } from './index.js';

describe('Contracts: Zod schemas', () => {
  it('valida notas admitiendo título vacío por defecto y rechazando longitud excesiva', () => {
    expect(createNoteSchema.safeParse({}).data?.title).toBe('');
    expect(createNoteSchema.safeParse({ title: 'a'.repeat(201) }).error?.issues[0]?.message).toContain('200');
    expect(updateNoteSchema.safeParse({ id: '1', expectedVersion: 0 }).error?.issues[0]?.message).toContain('positivo');
  });

  it('valida pendientes y exportDataSchema con valores por defecto y rechazos', () => {
    expect(createTodoSchema.safeParse({ title: '' }).error?.issues[0]?.message).toBe('El título es obligatorio');
    expect(createTodoSchema.safeParse({ title: 'A', priority: 'x' as unknown as 'low' }).error?.issues[0]?.message).toBe('Prioridad inválida');
    expect(createTodoSchema.safeParse({ title: 'A', dueDate: '03-11' }).error?.issues[0]?.message).toContain('YYYY-MM-DD');
    expect(createTodoSchema.safeParse({ title: 'A', noteId: '' }).error?.issues[0]?.message).toContain('ID de nota');
    const valid = createTodoSchema.safeParse({ title: 'Ok', detail: null });
    expect(valid.success && valid.data.priority === 'medium' && valid.data.detail === '').toBe(true);
    expect(updateTodoSchema.safeParse({ id: 't-1', isDone: true }).success).toBe(true);
    expect(exportDataSchema.safeParse({ version: 1, exportedAt: '2026-11-03', workspaceId: 'w-1', notes: [], todos: [] }).success).toBe(true);
  });

  it('rechaza fechas imposibles de calendario en dueDate y acepta bisiestos válidos', () => {
    expect(createTodoSchema.safeParse({ title: 'A', dueDate: '2026-02-31' }).success).toBe(false);
    expect(createTodoSchema.safeParse({ title: 'A', dueDate: '2026-02-31' }).error?.issues[0]?.message).toContain('calendario');
    expect(createTodoSchema.safeParse({ title: 'A', dueDate: '2025-02-29' }).success).toBe(false);
    expect(createTodoSchema.safeParse({ title: 'A', dueDate: '2026-04-31' }).success).toBe(false);
    expect(updateTodoSchema.safeParse({ id: 't-1', dueDate: '2026-02-31' }).success).toBe(false);
    expect(createTodoSchema.safeParse({ title: 'A', dueDate: '2024-02-29' }).success).toBe(true);
  });
});

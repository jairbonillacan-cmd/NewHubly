import { describe, it, expect } from 'vitest';
import {
  createNoteSchema, updateNoteSchema, createTodoSchema, updateTodoSchema, exportDataSchema,
  workspaceRoleSchema, invitationRoleSchema, workspaceKindSchema, itemVisibilitySchema,
  createAgencyInputSchema, inviteMemberInputSchema, acceptInvitationInputSchema,
  changeMemberRoleInputSchema, removeMemberInputSchema, changeItemVisibilityInputSchema,
  noteSchema, todoSchema,
} from './index.js';

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

  it('valida contratos de Fase 1B (roles, agencias, invitaciones y visibilidad por defecto private)', () => {
    expect(workspaceRoleSchema.safeParse('owner').success).toBe(true);
    expect(invitationRoleSchema.safeParse('owner').success).toBe(false);
    expect(workspaceKindSchema.safeParse('agency').success).toBe(true);
    expect(itemVisibilitySchema.safeParse('workspace').success).toBe(true);
    expect(createAgencyInputSchema.safeParse({ name: 'Agencia Norte', slug: 'agencia-norte' }).success).toBe(true);
    expect(createAgencyInputSchema.safeParse({ name: 'A', slug: 'Slug Invalido!' }).success).toBe(false);
    const inv = inviteMemberInputSchema.safeParse({ workspaceId: 'w-1', email: '  Ana@Agencia.es ', role: 'editor' });
    expect(inv.success && inv.data.email === 'ana@agencia.es').toBe(true);
    expect(acceptInvitationInputSchema.safeParse({ rawToken: 'corto' }).success).toBe(false);
    expect(changeMemberRoleInputSchema.safeParse({ workspaceId: 'w-1', targetUserId: 'u-2', nextRole: 'admin' }).success).toBe(true);
    expect(removeMemberInputSchema.safeParse({ workspaceId: 'w-1', targetUserId: 'u-2' }).success).toBe(true);
    expect(changeItemVisibilityInputSchema.safeParse({ workspaceId: 'w-1', itemId: 'n-1', itemType: 'note', visibility: 'workspace' }).success).toBe(true);
    expect(noteSchema.parse({ id: 'n', workspaceId: 'w', createdBy: 'u', title: 'T', content: '', isPinned: false, isArchived: false, version: 1, createdAt: '2026-11-04', updatedAt: '2026-11-04' }).visibility).toBe('private');
    expect(todoSchema.parse({ id: 't', workspaceId: 'w', createdBy: 'u', title: 'T', detail: '', priority: 'low', isDone: false, createdAt: '2026-11-04', updatedAt: '2026-11-04' }).visibility).toBe('private');
  });
});

describe('Preferencias por persona (#83)', () => {
  it('acepta las preferencias por defecto y valida rangos, valores y paneles repetidos', async () => {
    const { DEFAULT_USER_PREFERENCES, userPreferencesSchema, updateUserPreferencesSchema } = await import('./index');
    expect(userPreferencesSchema.parse(DEFAULT_USER_PREFERENCES)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(DEFAULT_USER_PREFERENCES.theme).toBe('light');
    expect(updateUserPreferencesSchema.safeParse({ panelOpacity: 59 }).success).toBe(false);
    expect(updateUserPreferencesSchema.safeParse({ panelOpacity: 99 }).success).toBe(false);
    expect(updateUserPreferencesSchema.safeParse({ panelOpacity: 70.5 }).success).toBe(false);
    expect(updateUserPreferencesSchema.safeParse({ wallpaper: 'mi-foto' }).success).toBe(false);
    expect(updateUserPreferencesSchema.safeParse({ layoutMode: 'libre' }).success).toBe(false);
    expect(updateUserPreferencesSchema.safeParse({ visiblePanels: ['today', 'today'] }).success).toBe(false);
    expect(updateUserPreferencesSchema.safeParse({}).success).toBe(false);
    expect(updateUserPreferencesSchema.parse({ wallpaper: 'tinta', visiblePanels: [] })).toEqual({ wallpaper: 'tinta', visiblePanels: [] });
  });
});

describe('Calendario editorial: contratos Zod (#192)', () => {
  const brandId = '11111111-1111-4111-8111-111111111111';
  const pieceId = '22222222-2222-4222-8222-222222222222';

  it('valida creación y edición de marcas y piezas con valores por defecto y normalización de hora', async () => {
    const {
      isValidCalendarDate, isValidTimeOfDay, createBrandSchema, updateBrandSchema,
      createContentPieceSchema, updateContentPieceSchema,
    } = await import('./index.js');
    expect(isValidCalendarDate('2026-11-06') && !isValidCalendarDate('2026-02-30')).toBe(true);
    expect(isValidTimeOfDay('09:30') && isValidTimeOfDay('14:05:00') && !isValidTimeOfDay('24:00')).toBe(true);

    const brand = createBrandSchema.parse({ name: '  Lumen  ' });
    expect(brand).toEqual({ name: 'Lumen', color: 'azul', visibility: 'workspace' });
    expect(createBrandSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(updateBrandSchema.safeParse({ brandId, color: 'verde', archived: true }).success).toBe(true);

    const piece = createContentPieceSchema.parse({
      brandId, title: '  Lanzamiento de invierno ', plannedDate: '2026-11-10', plannedTime: '09:30:00',
    });
    expect(piece).toEqual({
      brandId, title: 'Lanzamiento de invierno', brief: '', campaign: '', channel: 'instagram',
      plannedDate: '2026-11-10', plannedTime: '09:30', assigneeId: null, status: 'idea', visibility: 'workspace',
    });
    expect(createContentPieceSchema.safeParse({ brandId, title: 'X', plannedDate: '2026-11-10', status: 'publicada' }).success).toBe(false);
    expect(updateContentPieceSchema.safeParse({ pieceId, channel: 'linkedin', assigneeId: null }).success).toBe(true);
  });

  it('valida transiciones, reprogramación, borrado, filtros de rango y formatos de exportación', async () => {
    const {
      transitionContentPieceStatusSchema, rescheduleContentPieceSchema, deleteContentPieceSchema,
      contentRangeFilterSchema, contentExportQuerySchema,
    } = await import('./index.js');
    expect(transitionContentPieceStatusSchema.safeParse({ pieceId, status: 'publicada', publishedDate: '2026-11-06' }).success).toBe(true);
    expect(transitionContentPieceStatusSchema.safeParse({ pieceId, status: 'publicada' }).success).toBe(true);
    expect(transitionContentPieceStatusSchema.safeParse({ pieceId, status: 'borrador', publishedDate: '2026-11-06' }).success).toBe(false);
    expect(transitionContentPieceStatusSchema.safeParse({ pieceId, status: 'programada' }).success).toBe(false);

    expect(rescheduleContentPieceSchema.parse({ pieceId, plannedDate: '2026-11-12', plannedTime: '18:00:00' }).plannedTime).toBe('18:00');
    expect(deleteContentPieceSchema.safeParse({ pieceId }).success).toBe(true);

    expect(contentRangeFilterSchema.safeParse({ from: '2026-11-01', to: '2026-11-30', channel: 'tiktok' }).success).toBe(true);
    expect(contentRangeFilterSchema.safeParse({ from: '2026-11-30', to: '2026-11-01' }).success).toBe(false);
    expect(contentExportQuerySchema.parse({ from: '2026-11-01', to: '2026-11-30' }).format).toBe('json');
    expect(contentExportQuerySchema.parse({ format: 'ics' }).format).toBe('ics');
    expect(contentExportQuerySchema.safeParse({ format: 'csv' }).success).toBe(false);
  });
});



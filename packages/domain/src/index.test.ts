import { describe, it, expect } from 'vitest';
import {
  classifyTodoView, sortTodosForView, isOverdue, isToday, isUpcoming, isNoDate, isDoneView, toggleTodo, completeTodo, reopenTodo, updateNoteContent, pinNote, archiveNote, NoteNotFoundError, TodoNotFoundError, ConcurrencyError,
  ForbiddenWorkspaceActionError, MAX_AGENCIES_PER_OWNER, MAX_PENDING_INVITATIONS_PER_WORKSPACE, getEffectiveVisibility, normalizeInvitationEmail, emailsMatchNormalized, getInvitationStatus, canReadItem, canCreateWithVisibility, canEditItem, canDeleteItem, canChangeItemVisibility, canLinkTodoToNote, changeItemVisibility, unlinkIncompatibleTodosOnNotePrivatized, canChangeMemberRole, canRemoveOrLeaveMember, canManageInvitation,
  type Todo, type Note,
} from './index.js';

const baseTodo: Todo = {
  id: 't-1', workspaceId: 'w-1', createdBy: 'u-1', title: 'T', detail: '', priority: 'medium',
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
    expect(isOverdue({ ...baseTodo, dueDate: '2026-11-02' }, ref) && isToday({ ...baseTodo, dueDate: '2026-11-03' }, ref)).toBe(true);
    expect(isUpcoming({ ...baseTodo, dueDate: '2026-11-04' }, ref) && isNoDate(baseTodo) && isDoneView({ ...baseTodo, isDone: true })).toBe(true);
  });

  it('ordena vistas Hoy (vencidos primero, prioridad y fecha) y Próximos (por fecha)', () => {
    const tTodayHigh: Todo = { ...baseTodo, id: 'today-high', dueDate: '2026-11-03', priority: 'high' };
    const tTodayLow: Todo = { ...baseTodo, id: 'today-low', dueDate: '2026-11-03', priority: 'low' };
    const tOverdueLowOld: Todo = { ...baseTodo, id: 'over-low-1', dueDate: '2026-11-01', priority: 'low' };
    const tOverdueLowNew: Todo = { ...baseTodo, id: 'over-low-2', dueDate: '2026-11-02', priority: 'low' };
    const tOverdueHigh: Todo = { ...baseTodo, id: 'over-high', dueDate: '2026-11-02', priority: 'high' };

    const sortedToday = sortTodosForView(
      [tTodayLow, tTodayHigh, tOverdueLowNew, tOverdueLowOld, tOverdueHigh],
      'today',
      ref,
    );
    expect(sortedToday.map(t => t.id)).toEqual([
      'over-high',
      'over-low-1',
      'over-low-2',
      'today-high',
      'today-low',
    ]);

    const uLaterHigh: Todo = { ...baseTodo, id: 'up-2', dueDate: '2026-11-10', priority: 'high' };
    const uSoonerLow: Todo = { ...baseTodo, id: 'up-1-low', dueDate: '2026-11-04', priority: 'low' };
    const uSoonerHigh: Todo = { ...baseTodo, id: 'up-1-high', dueDate: '2026-11-04', priority: 'high' };
    const sortedUpcoming = sortTodosForView([uLaterHigh, uSoonerLow, uSoonerHigh], 'upcoming', ref);
    expect(sortedUpcoming.map(t => t.id)).toEqual(['up-1-high', 'up-1-low', 'up-2']);
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

  it('aplica reglas puras del ADR 0007: visibilidad, permisos por rol, miembros e invitaciones (#61)', () => {
    const now = '2026-11-04T12:00:00Z', sharedNote: Note = { ...baseNote, visibility: 'workspace' };
    expect(MAX_AGENCIES_PER_OWNER === 10 && MAX_PENDING_INVITATIONS_PER_WORKSPACE === 20 && getEffectiveVisibility(baseNote) === 'private').toBe(true);
    expect(canReadItem('u-2', 'owner', baseNote) === false && canReadItem('u-2', 'viewer', sharedNote) === true).toBe(true);
    expect(canCreateWithVisibility('viewer', 'private') === true && canCreateWithVisibility('viewer', 'workspace') === false).toBe(true);
    expect(canEditItem('u-2', 'editor', sharedNote) === true && canEditItem('u-2', 'viewer', sharedNote) === false).toBe(true);
    expect(canDeleteItem('u-2', 'editor', sharedNote) === false && canDeleteItem('u-2', 'admin', sharedNote) === true).toBe(true);
    expect(canChangeItemVisibility('u-1', 'editor', baseNote, 'workspace') === true && canChangeItemVisibility('u-2', 'owner', baseNote, 'workspace') === false && canChangeItemVisibility('u-1', 'viewer', baseNote, 'workspace') === false).toBe(true);
    expect(() => changeItemVisibility(baseNote, 'workspace', 'u-2', 'owner', now)).toThrow(ForbiddenWorkspaceActionError);
    expect(changeItemVisibility(baseNote, 'workspace', 'u-1', 'editor', now).visibility).toBe('workspace');
    expect(canLinkTodoToNote('u-1', 'workspace', baseNote, 'w-1') === false && canLinkTodoToNote('u-1', 'workspace', sharedNote, 'w-1') === true).toBe(true);
    const unlinked = unlinkIncompatibleTodosOnNotePrivatized(baseNote, [{ ...baseTodo, id: 't-ap', noteId: 'n-1', visibility: 'private' }, { ...baseTodo, id: 't-as', noteId: 'n-1', visibility: 'workspace' }, { ...baseTodo, id: 't-op', createdBy: 'u-2', noteId: 'n-1', visibility: 'private' }], now);
    expect(unlinked.map(t => t.noteId)).toEqual(['n-1', null, null]);

    expect(canChangeMemberRole({ workspaceKind: 'personal', actorId: 'u-1', actorRole: 'owner', targetUserId: 'u-2', targetCurrentRole: 'editor', nextRole: 'admin', ownerCount: 1 }).allowed).toBe(false);
    expect(canChangeMemberRole({ workspaceKind: 'agency', actorId: 'u-2', actorRole: 'admin', targetUserId: 'u-2', targetCurrentRole: 'admin', nextRole: 'owner', ownerCount: 1 }).allowed).toBe(false);
    expect(canChangeMemberRole({ workspaceKind: 'agency', actorId: 'u-2', actorRole: 'admin', targetUserId: 'u-3', targetCurrentRole: 'editor', nextRole: 'owner', ownerCount: 1 }).allowed).toBe(false);
    expect(canChangeMemberRole({ workspaceKind: 'agency', actorId: 'u-2', actorRole: 'admin', targetUserId: 'u-1', targetCurrentRole: 'owner', nextRole: 'editor', ownerCount: 2 }).allowed).toBe(false);
    expect(canChangeMemberRole({ workspaceKind: 'agency', actorId: 'u-2', actorRole: 'admin', targetUserId: 'u-3', targetCurrentRole: 'editor', nextRole: 'viewer', ownerCount: 1 }).allowed).toBe(true);
    expect(canChangeMemberRole({ workspaceKind: 'agency', actorId: 'u-1', actorRole: 'owner', targetUserId: 'u-1', targetCurrentRole: 'owner', nextRole: 'admin', ownerCount: 1 }).allowed).toBe(false);
    expect(canChangeMemberRole({ workspaceKind: 'agency', actorId: 'u-1', actorRole: 'owner', targetUserId: 'u-2', targetCurrentRole: 'admin', nextRole: 'owner', ownerCount: 1 }).allowed).toBe(true);
    expect(canChangeMemberRole({ workspaceKind: 'agency', actorId: 'u-1', actorRole: 'owner', targetUserId: 'u-1', targetCurrentRole: 'owner', nextRole: 'admin', ownerCount: 2 }).allowed).toBe(true);
    expect(canRemoveOrLeaveMember({ workspaceKind: 'agency', actorId: 'u-1', actorRole: 'owner', targetUserId: 'u-1', targetCurrentRole: 'owner', ownerCount: 1 }).allowed).toBe(false);
    expect(canRemoveOrLeaveMember({ workspaceKind: 'agency', actorId: 'u-1', actorRole: 'owner', targetUserId: 'u-1', targetCurrentRole: 'owner', ownerCount: 2 }).allowed).toBe(true);
    expect(canRemoveOrLeaveMember({ workspaceKind: 'agency', actorId: 'u-2', actorRole: 'admin', targetUserId: 'u-3', targetCurrentRole: 'admin', ownerCount: 1 }).allowed).toBe(false);
    expect(canRemoveOrLeaveMember({ workspaceKind: 'agency', actorId: 'u-3', actorRole: 'viewer', targetUserId: 'u-3', targetCurrentRole: 'viewer', ownerCount: 1 }).allowed).toBe(true);
    expect(canManageInvitation({ workspaceKind: 'personal', actorRole: 'owner', invitedRole: 'editor' }).allowed).toBe(false);
    expect(canManageInvitation({ workspaceKind: 'agency', actorRole: 'admin', invitedRole: 'admin' }).allowed).toBe(false);
    expect(canManageInvitation({ workspaceKind: 'agency', actorRole: 'admin', invitedRole: 'editor', pendingCount: 20 }).allowed).toBe(false);
    expect(canManageInvitation({ workspaceKind: 'agency', actorRole: 'owner', invitedRole: 'admin', pendingCount: 19 }).allowed).toBe(true);
    expect(normalizeInvitationEmail('  Equipo@Agencia.ES ') === 'equipo@agencia.es' && emailsMatchNormalized('Equipo@Agencia.ES ', 'equipo@agencia.es')).toBe(true);
    expect(getInvitationStatus({ expiresAt: '2026-11-10T00:00:00Z' }, '2026-11-04T00:00:00Z') === 'pending' && getInvitationStatus({ expiresAt: '2026-11-01T00:00:00Z' }, '2026-11-04T00:00:00Z') === 'expired').toBe(true);
  });
});

describe('Captura inteligente (#80)', () => {
  it('detecta fecha, prioridad y nota, y guarda el título sin esas palabras', async () => {
    const { parseQuickCapture } = await import('./index.js');
    expect(parseQuickCapture('Llamar a Lumen mañana !alta @aurora', '2026-11-04')).toEqual({
      title: 'Llamar a Lumen', dueDate: '2026-11-05', dueKeyword: 'mañana', priority: 'high', noteQuery: 'aurora',
    });
    expect(parseQuickCapture('  revisar copys hoy  !baja ', '2026-11-04')).toMatchObject({ title: 'revisar copys', dueDate: '2026-11-04', priority: 'low', noteQuery: null });
    expect(parseQuickCapture('Pedir fotos', '2026-11-04')).toEqual({ title: 'Pedir fotos', dueDate: null, dueKeyword: null, priority: null, noteQuery: null });
  });

  it('cruza fin de mes y de año al calcular «mañana», y acepta «manana» sin tilde', async () => {
    const { parseQuickCapture, addDaysToDateString } = await import('./index.js');
    expect(parseQuickCapture('cierre mañana', '2026-12-31').dueDate).toBe('2027-01-01');
    expect(parseQuickCapture('cierre manana', '2026-02-28').dueDate).toBe('2026-03-01');
    expect(addDaysToDateString('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('no confunde palabras que solo contienen las claves ni una arroba sola', async () => {
    const { parseQuickCapture } = await import('./index.js');
    expect(parseQuickCapture('ahora mañanera @ !altamente', '2026-11-04')).toEqual({
      title: 'ahora mañanera @ !altamente', dueDate: null, dueKeyword: null, priority: null, noteQuery: null,
    });
  });
});

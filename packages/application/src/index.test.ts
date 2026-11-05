import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryNoteRepository, InMemoryTodoRepository, InMemoryAgencyWorkspaceRepository,
  createNote, updateNote, pinNote, archiveNote, listNotes, createTodo, updateTodo, toggleTodoDone, listTodosByView,
  createTodoFromNote, exportWorkspaceData, createAgency, inviteWorkspaceMember, acceptWorkspaceInvitation,
  revokeWorkspaceInvitation, changeWorkspaceMemberRole, removeOrLeaveWorkspaceMember, changeNoteVisibility, changeTodoVisibility,
  type Clock, type IdGenerator,
} from './index.js';
import { AgencyLimitExceededError, ConcurrencyError, ForbiddenWorkspaceActionError, InvitationError, LastOwnerProtectionError, NoteNotFoundError, TodoNotFoundError } from '@hubly/domain';

const makeClock = (dt = '2026-11-03T10:00:00.000Z'): Clock => ({ now: () => new Date(dt), todayString: () => dt.slice(0, 10) });
const makeIdGen = (): IdGenerator => { let n = 0; return { generate: () => `id-${++n}` }; };

describe('Application: Use cases', () => {
  let noteRepo: InMemoryNoteRepository;
  let todoRepo: InMemoryTodoRepository;
  let agencyRepo: InMemoryAgencyWorkspaceRepository;
  let clock: Clock;
  let idGen: IdGenerator;
  const ctx1 = { workspaceId: 'w-1', userId: 'u-1' };
  const ctx2 = { workspaceId: 'w-1', userId: 'u-2' };

  beforeEach(() => {
    noteRepo = new InMemoryNoteRepository();
    todoRepo = new InMemoryTodoRepository();
    agencyRepo = new InMemoryAgencyWorkspaceRepository();
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

  it('gestiona agencias, límite de 10, invitaciones, transferencia de owner, visibilidad y desvinculación al privatizar (#61)', async () => {
    for (let i = 0; i < 10; i++) await createAgency(agencyRepo, clock, idGen, { name: `Agencia ${i}` }, 'u-limit');
    await expect(createAgency(agencyRepo, clock, idGen, { name: 'Agencia 11' }, 'u-limit')).rejects.toThrow(AgencyLimitExceededError);
    const { workspace } = await createAgency(agencyRepo, clock, idGen, { name: 'Agencia Central', slug: 'agencia-central' }, 'u-owner');
    const hash1 = 'a'.repeat(64), hash2 = 'b'.repeat(64);
    const invAdmin = await inviteWorkspaceMember(agencyRepo, clock, idGen, { workspaceId: workspace.id, email: ' Admin@Agencia.es ', role: 'admin' }, hash1, 'u-owner');
    await expect(acceptWorkspaceInvitation(agencyRepo, clock, hash1, { userId: 'u-admin', email: 'otro@agencia.es', emailConfirmed: true })).rejects.toThrow(InvitationError);
    await expect(acceptWorkspaceInvitation(agencyRepo, clock, hash1, { userId: 'u-admin', email: 'admin@agencia.es', emailConfirmed: false })).rejects.toThrow(InvitationError);
    expect((await acceptWorkspaceInvitation(agencyRepo, clock, hash1, { userId: 'u-admin', email: 'ADMIN@agencia.es', emailConfirmed: true })).role).toBe('admin');
    expect(invAdmin.email).toBe('admin@agencia.es');

    await expect(inviteWorkspaceMember(agencyRepo, clock, idGen, { workspaceId: workspace.id, email: 'x@agencia.es', role: 'admin' }, hash2, 'u-admin')).rejects.toThrow(ForbiddenWorkspaceActionError);
    const invEditor = await inviteWorkspaceMember(agencyRepo, clock, idGen, { workspaceId: workspace.id, email: 'editor@agencia.es', role: 'editor' }, hash2, 'u-admin');
    expect((await revokeWorkspaceInvitation(agencyRepo, clock, { workspaceId: workspace.id, invitationId: invEditor.id }, 'u-admin')).revokedAt).toBeTruthy();

    await expect(changeWorkspaceMemberRole(agencyRepo, { workspaceId: workspace.id, targetUserId: 'u-owner', nextRole: 'admin' }, 'u-owner')).rejects.toThrow(LastOwnerProtectionError);
    await expect(removeOrLeaveWorkspaceMember(agencyRepo, { workspaceId: workspace.id, targetUserId: 'u-owner' }, 'u-owner')).rejects.toThrow(LastOwnerProtectionError);
    await changeWorkspaceMemberRole(agencyRepo, { workspaceId: workspace.id, targetUserId: 'u-admin', nextRole: 'owner' }, 'u-owner');
    expect((await changeWorkspaceMemberRole(agencyRepo, { workspaceId: workspace.id, targetUserId: 'u-owner', nextRole: 'admin' }, 'u-owner')).role).toBe('admin');

    const cEditor = { workspaceId: workspace.id, userId: 'u-ed', role: 'editor' as const };
    const cAdmin = { workspaceId: workspace.id, userId: 'u-owner', role: 'admin' as const };
    const cViewer = { workspaceId: workspace.id, userId: 'u-vw', role: 'viewer' as const };
    await expect(createNote(noteRepo, clock, idGen, { title: 'No', visibility: 'workspace' }, cViewer)).rejects.toThrow(ForbiddenWorkspaceActionError);
    const sharedNote = await createNote(noteRepo, clock, idGen, { title: 'Brief', visibility: 'workspace' }, cEditor);
    const privNote = await createNote(noteRepo, clock, idGen, { title: 'Borrador', visibility: 'private' }, cAdmin);
    const tShared = await createTodo(todoRepo, clock, idGen, { title: 'T1', noteId: sharedNote.id, visibility: 'workspace' }, cEditor, noteRepo);
    const tOtherPriv = await createTodo(todoRepo, clock, idGen, { title: 'T2', noteId: sharedNote.id, visibility: 'private' }, cAdmin, noteRepo);
    const tOwnPriv = await createTodo(todoRepo, clock, idGen, { title: 'T3', noteId: sharedNote.id, visibility: 'private' }, cEditor, noteRepo);
    await expect(updateNote(noteRepo, clock, { id: sharedNote.id, title: 'X' }, cViewer)).rejects.toThrow(ForbiddenWorkspaceActionError);
    await expect(changeNoteVisibility(noteRepo, todoRepo, clock, sharedNote.id, 'private', cAdmin)).rejects.toThrow(ForbiddenWorkspaceActionError);
    await changeNoteVisibility(noteRepo, todoRepo, clock, sharedNote.id, 'private', cEditor, [tShared, tOtherPriv, tOwnPriv]);
    expect([(await todoRepo.findById(tShared.id))?.noteId, (await todoRepo.findById(tOtherPriv.id))?.noteId, (await todoRepo.findById(tOwnPriv.id))?.noteId]).toEqual([null, null, sharedNote.id]);
    await expect(changeTodoVisibility(todoRepo, noteRepo, clock, tOwnPriv.id, 'workspace', cEditor)).rejects.toThrow(ForbiddenWorkspaceActionError);

    await removeOrLeaveWorkspaceMember(agencyRepo, { workspaceId: workspace.id, targetUserId: 'u-owner' }, 'u-owner', { noteRepo, todoRepo, personalWorkspaceId: 'w-personal-u1', clock });
    expect((await noteRepo.findById(privNote.id))?.workspaceId).toBe('w-personal-u1');
    expect((await todoRepo.findById(tOtherPriv.id))?.workspaceId).toBe('w-personal-u1');
  });
});

describe('Preferencias por persona (#83)', () => {
  it('devuelve los valores por defecto sin registro y guarda cambios parciales sobre lo existente', async () => {
    const { getUserPreferences, saveUserPreferences } = await import('./index.js');
    const store = new Map<string, unknown>();
    const repo = {
      get: async (userId: string) => (store.get(userId) as never) ?? null,
      upsert: async (userId: string, prefs: never) => { store.set(userId, prefs); return prefs; },
    };
    expect(await getUserPreferences(repo, { userId: 'u-1' })).toEqual({ wallpaper: 'contornos', panelOpacity: 80, layoutMode: 'free', visiblePanels: ['today', 'open_note', 'pinned_notes'], theme: 'light' });
    await saveUserPreferences(repo, { wallpaper: 'tinta', panelOpacity: 64 }, { userId: 'u-1' });
    const saved = await saveUserPreferences(repo, { theme: 'dark' }, { userId: 'u-1' });
    expect(saved).toMatchObject({ wallpaper: 'tinta', panelOpacity: 64, theme: 'dark', layoutMode: 'free' });
    expect(await getUserPreferences(repo, { userId: 'u-2' })).toMatchObject({ wallpaper: 'contornos' });
    await expect(saveUserPreferences(repo, { panelOpacity: 20 }, { userId: 'u-1' })).rejects.toThrow();
  });

  it('ignora un registro guardado que ya no cumple el contrato y vuelve a los valores por defecto', async () => {
    const { getUserPreferences } = await import('./index.js');
    const repo = { get: async () => ({ wallpaper: 'borrado', panelOpacity: 80, layoutMode: 'free', visiblePanels: [], theme: 'light' }) as never, upsert: async (_u: string, p: never) => p };
    expect((await getUserPreferences(repo, { userId: 'u-1' })).wallpaper).toBe('contornos');
  });
});


import { describe, expect, it, vi } from 'vitest';
import {
  ContentAccessError, ContentRequestError, createContentService, formatContentIcs, formatContentMarkdown,
  type Brand, type ContentPiece, type ContentRepository, type ContentServiceContext,
} from './content';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const brandId = '22222222-2222-4222-8222-222222222222';
const pieceId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';
const otherUserId = '55555555-5555-4555-8555-555555555555';

const baseBrand: Brand = {
  id: brandId, workspaceId, createdBy: userId, name: 'Lumen', color: 'azul',
  visibility: 'workspace', archivedAt: null, createdAt: '2026-11-06T10:00:00Z', updatedAt: '2026-11-06T10:00:00Z',
};
const basePiece: ContentPiece = {
  id: pieceId, workspaceId, brandId, createdBy: userId, title: 'Reel de temporada', brief: 'Guion breve, claro; con gancho.',
  campaign: 'Invierno', channel: 'instagram', plannedDate: '2026-11-10', plannedTime: '09:30', assigneeId: userId,
  status: 'idea', publishedDate: null, visibility: 'workspace', archivedAt: null,
  createdAt: '2026-11-06T10:00:00Z', updatedAt: '2026-11-06T10:00:00Z',
};
const baseCtx: ContentServiceContext = { userId, workspaceId, workspaceKind: 'agency', role: 'owner', enabled: true };

function makeRepo(overrides: Partial<ContentRepository> = {}): ContentRepository {
  return {
    listBrands: vi.fn().mockResolvedValue([baseBrand]),
    findBrandById: vi.fn().mockResolvedValue(baseBrand),
    createBrand: vi.fn().mockImplementation(async (i) => ({ ...baseBrand, ...i })),
    updateBrand: vi.fn().mockImplementation(async (i) => ({ ...baseBrand, ...i })),
    listPieces: vi.fn().mockResolvedValue([basePiece]),
    findPieceById: vi.fn().mockResolvedValue(basePiece),
    listPieceEvents: vi.fn().mockResolvedValue([{ id: 'e-1', workspaceId, pieceId, kind: 'created', from: null, to: 'idea', actorId: userId, at: '2026-11-06T10:00:00Z' }]),
    createPiece: vi.fn().mockImplementation(async (i) => ({ ...basePiece, ...i })),
    updatePiece: vi.fn().mockImplementation(async (i) => ({ ...basePiece, ...i })),
    transitionPieceStatus: vi.fn().mockImplementation(async (i) => ({ ...basePiece, status: i.status, publishedDate: i.publishedDate })),
    reschedulePiece: vi.fn().mockImplementation(async (i) => ({ ...basePiece, plannedDate: i.plannedDate, plannedTime: i.plannedTime ?? null })),
    deletePiece: vi.fn().mockResolvedValue(true),
    countPiecesInRange: vi.fn().mockResolvedValue(3),
    listMembers: vi.fn().mockResolvedValue([{ userId, role: 'owner', displayName: 'Ana' }]),
    ...overrides,
  };
}

describe('Servicio de calendario editorial (#192)', () => {
  it('funciona tanto en espacio personal como en agencia cuando el piloto está habilitado y bloquea si no lo está', async () => {
    const personal = createContentService({ ...baseCtx, workspaceKind: 'personal' }, makeRepo());
    const snap = await personal.getSnapshot({ from: '2026-11-01', to: '2026-11-30' });
    expect(snap.campaigns).toEqual(['Invierno']);
    expect(await personal.countPiecesForWeek('2026-11-09', '2026-11-15')).toBe(3);

    const disabled = createContentService({ ...baseCtx, enabled: false }, makeRepo());
    await expect(disabled.getSnapshot()).rejects.toMatchObject({ code: 'PILOT_DISABLED' });
    const unauth = createContentService({ ...baseCtx, userId: null }, makeRepo());
    await expect(unauth.getSnapshot()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('aplica permisos por rol en marcas y piezas (owner/admin vs editor vs viewer)', async () => {
    const editorSvc = createContentService({ ...baseCtx, role: 'editor' }, makeRepo());
    await expect(editorSvc.createBrand({ name: 'Nueva' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await editorSvc.createPiece({ brandId, title: 'Post', plannedDate: '2026-11-10' })).title).toBe('Post');
    await expect(editorSvc.deletePiece({ pieceId })).resolves.toBeUndefined();

    const editorNotAuthor = createContentService(
      { ...baseCtx, role: 'editor', userId: otherUserId },
      makeRepo({ findPieceById: vi.fn().mockResolvedValue(basePiece) }),
    );
    await expect(editorNotAuthor.deletePiece({ pieceId })).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const viewerSvc = createContentService({ ...baseCtx, role: 'viewer' }, makeRepo());
    await expect(viewerSvc.createPiece({ brandId, title: 'Post', plannedDate: '2026-11-10' })).rejects.toBeInstanceOf(ContentAccessError);
  });

  it('valida transiciones de estado v1, asigna publishedDate al publicar y traduce códigos Postgres', async () => {
    const repo = makeRepo({
      findPieceById: vi.fn()
        .mockResolvedValueOnce(basePiece)
        .mockResolvedValueOnce({ ...basePiece, status: 'aprobada' }),
    });
    const svc = createContentService(baseCtx, repo);
    await expect(svc.transitionPieceStatus({ pieceId, status: 'publicada' })).rejects.toMatchObject({ code: 'CONFLICT' });

    const published = await svc.transitionPieceStatus({ pieceId, status: 'publicada' });
    expect(published.status === 'publicada' && /^\d{4}-\d{2}-\d{2}$/.test(published.publishedDate ?? '')).toBe(true);

    const failing = (err: unknown) => createContentService(baseCtx, makeRepo({ createBrand: vi.fn().mockRejectedValue(err) }))
      .createBrand({ name: 'Marca' });
    await expect(failing({ cause: { code: '23505' } })).rejects.toMatchObject({ code: 'CONFLICT', reason: 'conflict' });
    await expect(failing({ cause: { code: '23514' } })).rejects.toMatchObject({ code: 'VALIDATION', reason: 'invalid' });
    await expect(failing({ cause: { code: '42501' } })).rejects.toBeInstanceOf(ContentAccessError);
    await expect(failing(new Error('invalid_content_status_transition'))).rejects.toBeInstanceOf(ContentRequestError);
  });

  it('formatea exportaciones Markdown e ICS conforme a RFC 5545', () => {
    const payload = { brands: [baseBrand], pieces: [basePiece], exportedAt: '2026-11-06T12:00:00Z' };
    const md = formatContentMarkdown(payload);
    expect(md).toContain('# Calendario editorial');
    expect(md).toContain('### Reel de temporada');

    const ics = formatContentIcs(payload);
    expect(ics.includes('\r\n') && ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('PRODID:-//Hubly//Calendario Editorial//ES');
    expect(ics).toContain('DTSTART:20261110T093000');
    expect(ics).toContain('SUMMARY:[Lumen] Reel de temporada');
    expect(ics).toContain('\r\n ');
    expect(ics.replace(/\r\n /g, '')).toContain('Guion breve\\, claro\\; con gancho.');
  });
});

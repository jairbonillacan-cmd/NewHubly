// Casos de uso, puerto y formateadores de exportación del calendario editorial (ADR 0011, #192).
import {
  calendarDateSchema, contentRangeFilterSchema, createBrandSchema, createContentPieceSchema,
  deleteContentPieceSchema, rescheduleContentPieceSchema, transitionContentPieceStatusSchema,
  updateBrandSchema, updateContentPieceSchema,
} from '@hubly/contracts';
import {
  canDeleteContentPiece, canManageBrands, canTransitionContentStatus, canWriteContentPiece,
  type Brand, type BrandColor, type ContentChannel, type ContentPiece, type ContentPieceEvent,
  type ContentPieceStatus, type ContentV1Status, type ItemVisibility, type WorkspaceKind,
  type WorkspaceMemberSummary, type WorkspaceRole,
} from '@hubly/domain';

export type { Brand, BrandColor, ContentChannel, ContentPiece, ContentPieceEvent, ContentPieceStatus, ContentV1Status, WorkspaceMemberSummary } from '@hubly/domain';

export type ContentErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION' | 'PILOT_DISABLED';
export type ContentFailure = 'conflict' | 'invalid';

export class ContentAccessError extends Error {
  readonly code: ContentErrorCode;
  constructor(code: ContentErrorCode = 'FORBIDDEN', message?: string) {
    super(message ?? (code === 'UNAUTHENTICATED' ? 'Sesión no autenticada.' : code === 'PILOT_DISABLED' ? 'El piloto de calendario editorial no está habilitado en este espacio.' : code === 'NOT_FOUND' ? 'El recurso de contenido solicitado no está disponible.' : 'No tienes permisos para realizar esta acción en el calendario editorial.'));
    this.name = 'ContentAccessError'; this.code = code;
  }
}

export class ContentRequestError extends Error {
  readonly code: ContentErrorCode;
  readonly reason: ContentFailure;
  constructor(codeOrReason: ContentErrorCode | ContentFailure = 'VALIDATION', message?: string) {
    const isConflict = codeOrReason === 'CONFLICT' || codeOrReason === 'conflict';
    super(message ?? (isConflict ? 'Conflicto en la operación de contenido.' : 'La solicitud de contenido no es válida.'));
    this.name = 'ContentRequestError';
    this.code = codeOrReason === 'conflict' ? 'CONFLICT' : codeOrReason === 'invalid' ? 'VALIDATION' : codeOrReason;
    this.reason = isConflict ? 'conflict' : 'invalid';
  }
}

export interface ContentServiceContext {
  userId: string | null; workspaceId: string; workspaceKind: WorkspaceKind; role: WorkspaceRole | null; enabled: boolean;
}
export interface ContentPieceFilter {
  from?: string; to?: string; brandId?: string; channel?: ContentChannel; status?: ContentPieceStatus;
  assigneeId?: string; campaign?: string; includeArchived?: boolean;
}
export interface ContentWorkspaceSnapshot {
  workspaceId: string; brands: Brand[]; pieces: ContentPiece[]; campaigns: string[]; members: WorkspaceMemberSummary[];
}

export interface ContentRepository {
  listBrands(workspaceId: string, includeArchived?: boolean): Promise<Brand[]>;
  findBrandById(workspaceId: string, brandId: string): Promise<Brand | null>;
  createBrand(input: { workspaceId: string; createdBy: string; name: string; color: BrandColor; visibility: ItemVisibility }): Promise<Brand>;
  updateBrand(input: { workspaceId: string; brandId: string; name?: string; color?: BrandColor; visibility?: ItemVisibility; archived?: boolean }): Promise<Brand | null>;
  listPieces(workspaceId: string, filter?: ContentPieceFilter): Promise<ContentPiece[]>;
  findPieceById(workspaceId: string, pieceId: string): Promise<ContentPiece | null>;
  listPieceEvents(workspaceId: string, pieceId: string): Promise<ContentPieceEvent[]>;
  createPiece(input: { workspaceId: string; brandId: string; createdBy: string; title: string; brief: string; campaign: string; channel: ContentChannel; plannedDate: string; plannedTime: string | null; assigneeId: string | null; status: 'idea' | 'borrador'; visibility: ItemVisibility }): Promise<ContentPiece>;
  updatePiece(input: { workspaceId: string; pieceId: string; brandId?: string; title?: string; brief?: string; campaign?: string; channel?: ContentChannel; assigneeId?: string | null; visibility?: ItemVisibility; archived?: boolean }): Promise<ContentPiece | null>;
  transitionPieceStatus(input: { workspaceId: string; pieceId: string; status: ContentV1Status; publishedDate: string | null }): Promise<ContentPiece | null>;
  reschedulePiece(input: { workspaceId: string; pieceId: string; plannedDate: string; plannedTime?: string | null }): Promise<ContentPiece | null>;
  deletePiece(workspaceId: string, pieceId: string): Promise<boolean>;
  countPiecesInRange(workspaceId: string, from: string, to: string): Promise<number>;
  listMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]>;
}

function translate(error: unknown): never {
  if (error instanceof ContentAccessError || error instanceof ContentRequestError) throw error;
  const failure = error as { code?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } } | null;
  const code = String(failure?.cause?.code ?? failure?.code ?? ''), msg = String(failure?.cause?.message ?? failure?.message ?? '');
  if (code === '42501') throw new ContentAccessError('FORBIDDEN');
  if (code === '23505' || code === 'invalid_content_status_transition' || msg.includes('invalid_content_status_transition')) {
    throw new ContentRequestError('CONFLICT', msg.includes('invalid_content_status_transition') || code === 'invalid_content_status_transition' ? 'Transición de estado de pieza no permitida.' : undefined);
  }
  if (code === '23503' || code === '23514' || code === '22023') throw new ContentRequestError('VALIDATION');
  throw error;
}

const guarded = <T>(run: () => Promise<T>) => run().catch(translate);
const stripUndefined = <T extends Record<string, unknown>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export function createContentService(ctx: ContentServiceContext, repo: ContentRepository) {
  function requireAccess(): { userId: string; role: WorkspaceRole } {
    if (!ctx.enabled) throw new ContentAccessError('PILOT_DISABLED');
    if (!ctx.userId || !ctx.role || !ctx.workspaceId) throw new ContentAccessError('UNAUTHENTICATED');
    return { userId: ctx.userId, role: ctx.role };
  }
  function requireManageBrands() {
    const actor = requireAccess();
    if (!canManageBrands(actor.role)) throw new ContentAccessError('FORBIDDEN');
    return actor;
  }
  function requireWritePiece() {
    const actor = requireAccess();
    if (!canWriteContentPiece(actor.role)) throw new ContentAccessError('FORBIDDEN');
    return actor;
  }

  return {
    async getSnapshot(filter?: unknown): Promise<ContentWorkspaceSnapshot> {
      requireAccess();
      let cleanFilter: ContentPieceFilter | undefined;
      if (filter !== undefined) {
        const parsed = contentRangeFilterSchema.safeParse(filter);
        if (!parsed.success) throw new ContentRequestError('VALIDATION');
        cleanFilter = stripUndefined(parsed.data) as ContentPieceFilter;
      }
      const [brands, pieces, members] = await guarded(() => Promise.all([
        repo.listBrands(ctx.workspaceId, cleanFilter?.includeArchived),
        repo.listPieces(ctx.workspaceId, cleanFilter),
        repo.listMembers(ctx.workspaceId),
      ]));
      const campaigns = Array.from(new Set(pieces.map((p) => p.campaign.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
      return { workspaceId: ctx.workspaceId, brands, pieces, campaigns, members };
    },
    async getPieceDetail(pieceId: string): Promise<{ piece: ContentPiece; events: ContentPieceEvent[] }> {
      requireAccess();
      if (!deleteContentPieceSchema.safeParse({ pieceId }).success) throw new ContentRequestError('VALIDATION');
      const [piece, events] = await guarded(() => Promise.all([repo.findPieceById(ctx.workspaceId, pieceId), repo.listPieceEvents(ctx.workspaceId, pieceId)]));
      if (!piece) throw new ContentAccessError('NOT_FOUND');
      return { piece, events };
    },
    async countPiecesForWeek(from: string, to: string): Promise<number> {
      requireAccess();
      if (!calendarDateSchema.safeParse(from).success || !calendarDateSchema.safeParse(to).success || from > to) throw new ContentRequestError('VALIDATION');
      return await guarded(() => repo.countPiecesInRange(ctx.workspaceId, from, to));
    },
    async createBrand(raw: unknown): Promise<Brand> {
      const actor = requireManageBrands(), parsed = createBrandSchema.safeParse(raw);
      if (!parsed.success) throw new ContentRequestError('VALIDATION');
      return await guarded(() => repo.createBrand({ workspaceId: ctx.workspaceId, createdBy: actor.userId, ...parsed.data }));
    },
    async updateBrand(raw: unknown): Promise<Brand> {
      requireManageBrands();
      const parsed = updateBrandSchema.safeParse(raw);
      if (!parsed.success) throw new ContentRequestError('VALIDATION');
      const updated = await guarded(() => repo.updateBrand({ ...(stripUndefined(parsed.data) as Parameters<ContentRepository['updateBrand']>[0]), workspaceId: ctx.workspaceId, brandId: parsed.data.brandId }));
      if (!updated) throw new ContentAccessError('NOT_FOUND');
      return updated;
    },
    async createPiece(raw: unknown): Promise<ContentPiece> {
      const actor = requireWritePiece(), parsed = createContentPieceSchema.safeParse(raw);
      if (!parsed.success) throw new ContentRequestError('VALIDATION');
      const brand = await guarded(() => repo.findBrandById(ctx.workspaceId, parsed.data.brandId));
      if (!brand) throw new ContentAccessError('NOT_FOUND', 'La marca indicada no existe en este espacio.');
      return await guarded(() => repo.createPiece({ workspaceId: ctx.workspaceId, createdBy: actor.userId, ...parsed.data }));
    },
    async updatePiece(raw: unknown): Promise<ContentPiece> {
      requireWritePiece();
      const parsed = updateContentPieceSchema.safeParse(raw);
      if (!parsed.success) throw new ContentRequestError('VALIDATION');
      const updated = await guarded(() => repo.updatePiece({ ...(stripUndefined(parsed.data) as Parameters<ContentRepository['updatePiece']>[0]), workspaceId: ctx.workspaceId, pieceId: parsed.data.pieceId }));
      if (!updated) throw new ContentAccessError('NOT_FOUND');
      return updated;
    },
    async transitionPieceStatus(raw: unknown): Promise<ContentPiece> {
      requireWritePiece();
      const parsed = transitionContentPieceStatusSchema.safeParse(raw);
      if (!parsed.success) throw new ContentRequestError('VALIDATION');
      const current = await guarded(() => repo.findPieceById(ctx.workspaceId, parsed.data.pieceId));
      if (!current) throw new ContentAccessError('NOT_FOUND');
      if (!canTransitionContentStatus(current.status, parsed.data.status)) throw new ContentRequestError('CONFLICT', 'Transición de estado de pieza no permitida.');
      const publishedDate = parsed.data.status === 'publicada' ? (parsed.data.publishedDate ?? new Date().toISOString().slice(0, 10)) : null;
      const updated = await guarded(() => repo.transitionPieceStatus({ workspaceId: ctx.workspaceId, pieceId: parsed.data.pieceId, status: parsed.data.status, publishedDate }));
      if (!updated) throw new ContentAccessError('NOT_FOUND');
      return updated;
    },
    async reschedulePiece(raw: unknown): Promise<ContentPiece> {
      requireWritePiece();
      const parsed = rescheduleContentPieceSchema.safeParse(raw);
      if (!parsed.success) throw new ContentRequestError('VALIDATION');
      const updated = await guarded(() => repo.reschedulePiece({
        workspaceId: ctx.workspaceId, pieceId: parsed.data.pieceId, plannedDate: parsed.data.plannedDate,
        ...(parsed.data.plannedTime !== undefined ? { plannedTime: parsed.data.plannedTime } : {}),
      }));
      if (!updated) throw new ContentAccessError('NOT_FOUND');
      return updated;
    },
    async deletePiece(raw: unknown): Promise<void> {
      const actor = requireAccess(), parsed = deleteContentPieceSchema.safeParse(raw);
      if (!parsed.success) throw new ContentRequestError('VALIDATION');
      const current = await guarded(() => repo.findPieceById(ctx.workspaceId, parsed.data.pieceId));
      if (!current) throw new ContentAccessError('NOT_FOUND');
      if (!canDeleteContentPiece(actor.role, current.createdBy === actor.userId)) throw new ContentAccessError('FORBIDDEN');
      if (!await guarded(() => repo.deletePiece(ctx.workspaceId, parsed.data.pieceId))) throw new ContentAccessError('NOT_FOUND');
    },
  };
}

export function formatContentMarkdown(data: { brands: Brand[]; pieces: ContentPiece[]; exportedAt: string }): string {
  const brandById = new Map(data.brands.map((b) => [b.id, b.name]));
  const mdBrands = data.brands.map((b) => `- **${b.name}** (${b.color})${b.archivedAt ? ' [Archivada]' : ''}`).join('\n');
  const mdPieces = data.pieces.map((p) => {
    const when = p.plannedTime ? `${p.plannedDate} ${p.plannedTime}` : p.plannedDate;
    const meta = [`Marca: ${brandById.get(p.brandId) ?? 'Sin marca'}`, `Canal: ${p.channel}`, `Estado: ${p.status}`, `Fecha: ${when}`];
    if (p.campaign) meta.push(`Campaña: ${p.campaign}`);
    if (p.publishedDate) meta.push(`Publicada: ${p.publishedDate}`);
    return `### ${p.title}\n- ${meta.join(' · ')}${p.brief ? `\n\n${p.brief}` : ''}`;
  }).join('\n\n');
  return `# Calendario editorial\n\nExportado: ${data.exportedAt}\n\n## Marcas\n${mdBrands || 'Sin marcas.'}\n\n## Piezas\n${mdPieces || 'Sin piezas.'}\n`;
}

const escapeIcsText = (v: string): string => v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const utf8Bytes = (s: string): number => encodeURIComponent(s).replace(/%[A-F\d]{2}/gi, 'U').length;

function foldIcsLine(line: string): string {
  if (utf8Bytes(line) <= 75) return line;
  const parts: string[] = [];
  let current = '', limit = 75;
  for (const ch of line) {
    if (utf8Bytes(current + ch) > limit) { parts.push(current); current = ch; limit = 74; } else current += ch;
  }
  if (current) parts.push(current);
  return parts.join('\r\n ');
}

export function formatContentIcs(data: { brands: Brand[]; pieces: ContentPiece[]; exportedAt: string }): string {
  const brandById = new Map(data.brands.map((b) => [b.id, b.name])), parsedDate = new Date(data.exportedAt);
  const dtStamp = (Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hubly//Calendario Editorial//ES', 'CALSCALE:GREGORIAN'];
  for (const p of data.pieces) {
    const brandName = brandById.get(p.brandId), ymd = p.plannedDate.replace(/-/g, '');
    const dtStart = p.plannedTime ? `DTSTART:${ymd}T${p.plannedTime.slice(0, 5).replace(':', '')}00` : `DTSTART;VALUE=DATE:${ymd}`;
    const descParts = [`Canal: ${p.channel}`, `Estado: ${p.status}`, ...(p.campaign ? [`Campaña: ${p.campaign}`] : []), ...(p.brief ? [p.brief] : [])];
    lines.push(
      'BEGIN:VEVENT', `UID:${p.id}@hubly.local`, `DTSTAMP:${dtStamp}`, dtStart,
      `SUMMARY:${escapeIcsText(brandName ? `[${brandName}] ${p.title}` : p.title)}`,
      `DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`,
      `CATEGORIES:${[p.channel, p.campaign].filter(Boolean).map(escapeIcsText).join(',')}`,
      `STATUS:${p.status === 'aprobada' || p.status === 'publicada' ? 'CONFIRMED' : 'TENTATIVE'}`, 'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

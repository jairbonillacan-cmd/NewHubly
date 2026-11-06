// Contratos Zod del calendario editorial: marcas, piezas, filtros y exportación (ADR 0011, #192).
import { BRAND_COLORS, CONTENT_CHANNELS, CONTENT_PIECE_STATUSES, CONTENT_V1_STATUSES } from '@hubly/domain';
import { z } from 'zod';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/, TIME_SEC_RE = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

export function isValidCalendarDate(v: string): boolean {
  const [y = 0, m = 0, d = 0] = v.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCFullYear(y);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const isValidTimeOfDay = (v: string): boolean => TIME_RE.test(TIME_SEC_RE.test(v) ? v.slice(0, 5) : v);

export const calendarDateSchema = z.string().regex(DATE_RE, 'Formato de fecha inválido (debe ser YYYY-MM-DD)').refine(isValidCalendarDate, 'Fecha de calendario inválida');
export const timeOfDaySchema = z.string().trim().transform((v) => (TIME_SEC_RE.test(v) ? v.slice(0, 5) : v)).refine(isValidTimeOfDay, 'Formato de hora inválido (debe ser HH:MM)');

const visibilitySchema = z.enum(['private', 'workspace'] as const, { message: 'Visibilidad inválida' });

export const brandColorSchema = z.enum(BRAND_COLORS, { message: 'Color de marca inválido' });
export const contentChannelSchema = z.enum(CONTENT_CHANNELS, { message: 'Canal inválido' });
export const contentPieceStatusSchema = z.enum(CONTENT_PIECE_STATUSES, { message: 'Estado de pieza inválido' });
export const contentV1StatusSchema = z.enum(CONTENT_V1_STATUSES, { message: 'Estado de pieza inválido en v1' });
export const contentExportFormatSchema = z.enum(['json', 'md', 'ics'] as const, { message: 'Formato de exportación inválido' });

export const createBrandSchema = z.object({
  name: z.string().trim().min(1, 'El nombre de la marca es obligatorio').max(120, 'El nombre no puede superar los 120 caracteres'),
  color: brandColorSchema.default('azul'),
  visibility: visibilitySchema.default('workspace'),
});

export const updateBrandSchema = z.object({
  brandId: z.string().uuid('ID de marca inválido'),
  name: z.string().trim().min(1, 'El nombre de la marca es obligatorio').max(120, 'El nombre no puede superar los 120 caracteres').optional(),
  color: brandColorSchema.optional(),
  visibility: visibilitySchema.optional(),
  archived: z.boolean().optional(),
});

export const createContentPieceSchema = z.object({
  brandId: z.string().uuid('ID de marca inválido'),
  title: z.string().trim().min(1, 'El título es obligatorio').max(280, 'El título no puede superar los 280 caracteres'),
  brief: z.string().max(10000, 'El brief no puede superar los 10000 caracteres').default(''),
  campaign: z.string().trim().max(120, 'La campaña no puede superar los 120 caracteres').default(''),
  channel: contentChannelSchema.default('instagram'),
  plannedDate: calendarDateSchema,
  plannedTime: timeOfDaySchema.nullable().optional().default(null),
  assigneeId: z.string().uuid('ID de responsable inválido').nullable().optional().default(null),
  status: z.enum(['idea', 'borrador'] as const, { message: 'Estado inicial inválido' }).default('idea'),
  visibility: visibilitySchema.default('workspace'),
});

export const updateContentPieceSchema = z.object({
  pieceId: z.string().uuid('ID de pieza inválido'),
  brandId: z.string().uuid('ID de marca inválido').optional(),
  title: z.string().trim().min(1, 'El título es obligatorio').max(280, 'El título no puede superar los 280 caracteres').optional(),
  brief: z.string().max(10000, 'El brief no puede superar los 10000 caracteres').optional(),
  campaign: z.string().trim().max(120, 'La campaña no puede superar los 120 caracteres').optional(),
  channel: contentChannelSchema.optional(),
  assigneeId: z.string().uuid('ID de responsable inválido').nullable().optional(),
  visibility: visibilitySchema.optional(),
  archived: z.boolean().optional(),
});

export const transitionContentPieceStatusSchema = z.object({
  pieceId: z.string().uuid('ID de pieza inválido'),
  status: contentV1StatusSchema,
  publishedDate: calendarDateSchema.nullable().optional(),
}).refine((v) => v.status === 'publicada' || !v.publishedDate, {
  message: 'La fecha de publicación solo se permite al pasar a estado publicada', path: ['publishedDate'],
});

export const rescheduleContentPieceSchema = z.object({
  pieceId: z.string().uuid('ID de pieza inválido'),
  plannedDate: calendarDateSchema,
  plannedTime: timeOfDaySchema.nullable().optional(),
});

export const deleteContentPieceSchema = z.object({ pieceId: z.string().uuid('ID de pieza inválido') });

const contentRangeFilterBaseSchema = z.object({
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  brandId: z.string().uuid('ID de marca inválido').optional(),
  channel: contentChannelSchema.optional(),
  status: contentPieceStatusSchema.optional(),
  assigneeId: z.string().uuid('ID de responsable inválido').optional(),
  campaign: z.string().trim().max(120, 'La campaña no puede superar los 120 caracteres').optional(),
  includeArchived: z.boolean().optional(),
});

const isValidRange = (v: { from?: string | undefined; to?: string | undefined }) => !v.from || !v.to || v.from <= v.to;
const rangeError = { message: 'La fecha inicial no puede ser posterior a la fecha final', path: ['to'] };

export const contentRangeFilterSchema = contentRangeFilterBaseSchema.refine(isValidRange, rangeError);
export const contentExportQuerySchema = contentRangeFilterBaseSchema.extend({ format: contentExportFormatSchema.default('json') }).refine(isValidRange, rangeError);

export type ContentExportFormat = z.infer<typeof contentExportFormatSchema>;
export type CreateBrandInput = z.input<typeof createBrandSchema>;
export type UpdateBrandInput = z.input<typeof updateBrandSchema>;
export type CreateContentPieceInput = z.input<typeof createContentPieceSchema>;
export type UpdateContentPieceInput = z.input<typeof updateContentPieceSchema>;
export type TransitionContentPieceStatusInput = z.input<typeof transitionContentPieceStatusSchema>;
export type RescheduleContentPieceInput = z.input<typeof rescheduleContentPieceSchema>;
export type DeleteContentPieceInput = z.input<typeof deleteContentPieceSchema>;
export type ContentRangeFilterInput = z.input<typeof contentRangeFilterSchema>;
export type ContentExportQueryInput = z.input<typeof contentExportQuerySchema>;

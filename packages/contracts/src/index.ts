// Esquemas Zod compartidos para validar cada frontera (ADR 0002).
import { z } from 'zod';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TITLE_MSG = 'El título no puede superar los 200 caracteres';

function isValidCalendarDate(v: string): boolean {
  const [y = 0, m = 0, d = 0] = v.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCFullYear(y);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const dueDateSchema = z
  .string()
  .regex(DATE_RE, 'Formato de fecha inválido (debe ser YYYY-MM-DD)')
  .refine(isValidCalendarDate, 'Fecha de calendario inválida')
  .optional()
  .nullable();

export const createNoteSchema = z.object({
  title: z.string().trim().max(200, TITLE_MSG).default(''),
  content: z.string().optional().default(''),
});
export const updateNoteSchema = z.object({
  id: z.string().min(1, 'El ID es obligatorio'),
  title: z.string().trim().max(200, TITLE_MSG).optional(),
  content: z.string().optional(), isPinned: z.boolean().optional(), isArchived: z.boolean().optional(),
  expectedVersion: z.number().int().positive('La versión esperada debe ser un entero positivo').optional(),
});
export const createTodoSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(200, TITLE_MSG),
  detail: z.string().max(1000).nullish().transform(v => v ?? ''),
  dueDate: dueDateSchema,
  priority: z.enum(['low', 'medium', 'high'] as const, { message: 'Prioridad inválida' }).default('medium'),
  noteId: z.string().min(1, 'El ID de nota no puede estar vacío').optional().nullable(),
});
export const updateTodoSchema = z.object({
  id: z.string().min(1, 'El ID es obligatorio'),
  title: z.string().trim().min(1, 'El título no puede estar vacío').max(200, TITLE_MSG).optional(),
  detail: z.string().max(1000).optional(),
  dueDate: dueDateSchema,
  priority: z.enum(['low', 'medium', 'high'] as const, { message: 'Prioridad inválida' }).optional(),
  isDone: z.boolean().optional(),
  noteId: z.string().min(1, 'El ID de nota no puede estar vacío').optional().nullable(),
});
export const exportDataSchema = z.object({
  version: z.literal(1), exportedAt: z.string(), workspaceId: z.string(),
  notes: z.array(z.object({ id: z.string(), title: z.string(), content: z.string(), isPinned: z.boolean(), isArchived: z.boolean(), version: z.number(), createdAt: z.string(), updatedAt: z.string() })),
  todos: z.array(z.object({ id: z.string(), noteId: z.string().nullable().optional(), title: z.string(), detail: z.string(), dueDate: z.string().nullable().optional(), priority: z.enum(['low', 'medium', 'high'] as const), isDone: z.boolean(), doneAt: z.string().nullable().optional(), createdAt: z.string(), updatedAt: z.string() })),
});
const emailField = z.string().trim().email('Correo electrónico inválido');
const passField = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128);
export const signInWithPasswordSchema = z.object({ email: emailField, password: passField });
export const signUpWithPasswordSchema = z.object({ email: emailField, password: passField, workspaceName: z.string().trim().min(1).max(80).optional() });
export const signInWithMagicLinkSchema = z.object({ email: emailField });

export type CreateNoteInput = z.input<typeof createNoteSchema>; export type UpdateNoteInput = z.input<typeof updateNoteSchema>;
export type CreateTodoInput = z.input<typeof createTodoSchema>; export type UpdateTodoInput = z.input<typeof updateTodoSchema>;
export type ExportData = z.infer<typeof exportDataSchema>;
export type SignInWithPasswordInput = z.input<typeof signInWithPasswordSchema>;
export type SignUpWithPasswordInput = z.input<typeof signUpWithPasswordSchema>;
export type SignInWithMagicLinkInput = z.input<typeof signInWithMagicLinkSchema>;

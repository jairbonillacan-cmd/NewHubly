// Esquemas Zod compartidos para validar cada frontera (ADR 0002, ADR 0007).
import { z } from 'zod';
import { isValidCalendarDate } from './content';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TITLE_MSG = 'El título no puede superar los 200 caracteres';

const dueDateSchema = z
  .string()
  .regex(DATE_RE, 'Formato de fecha inválido (debe ser YYYY-MM-DD)')
  .refine(isValidCalendarDate, 'Fecha de calendario inválida')
  .optional()
  .nullable();

export const workspaceRoleSchema = z.enum(['owner', 'admin', 'editor', 'viewer'] as const, { message: 'Rol de espacio inválido' });
export const invitationRoleSchema = z.enum(['admin', 'editor', 'viewer'] as const, { message: 'Rol de invitación inválido' });
export const workspaceKindSchema = z.enum(['personal', 'agency'] as const, { message: 'Tipo de espacio inválido' });
export const itemVisibilitySchema = z.enum(['private', 'workspace'] as const, { message: 'Visibilidad inválida' });

export const createNoteSchema = z.object({
  title: z.string().trim().max(200, TITLE_MSG).default(''),
  content: z.string().optional().default(''),
  visibility: itemVisibilitySchema.optional(),
});
export const updateNoteSchema = z.object({
  id: z.string().min(1, 'El ID es obligatorio'),
  title: z.string().trim().max(200, TITLE_MSG).optional(),
  content: z.string().optional(), isPinned: z.boolean().optional(), isArchived: z.boolean().optional(),
  visibility: itemVisibilitySchema.optional(),
  expectedVersion: z.number().int().positive('La versión esperada debe ser un entero positivo').optional(),
});
export const createTodoSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(200, TITLE_MSG),
  detail: z.string().max(1000).nullish().transform(v => v ?? ''),
  dueDate: dueDateSchema,
  priority: z.enum(['low', 'medium', 'high'] as const, { message: 'Prioridad inválida' }).default('medium'),
  visibility: itemVisibilitySchema.optional(),
  noteId: z.string().min(1, 'El ID de nota no puede estar vacío').optional().nullable(),
});
export const updateTodoSchema = z.object({
  id: z.string().min(1, 'El ID es obligatorio'),
  title: z.string().trim().min(1, 'El título no puede estar vacío').max(200, TITLE_MSG).optional(),
  detail: z.string().max(1000).optional(),
  dueDate: dueDateSchema,
  priority: z.enum(['low', 'medium', 'high'] as const, { message: 'Prioridad inválida' }).optional(),
  visibility: itemVisibilitySchema.optional(),
  isDone: z.boolean().optional(),
  noteId: z.string().min(1, 'El ID de nota no puede estar vacío').optional().nullable(),
});
export const noteSchema = z.object({
  id: z.string().min(1), workspaceId: z.string().min(1), createdBy: z.string().min(1),
  title: z.string().max(200), content: z.string(), isPinned: z.boolean(), isArchived: z.boolean(),
  visibility: itemVisibilitySchema.default('private'), version: z.number().int().positive(), createdAt: z.string(), updatedAt: z.string(),
});
export const todoSchema = z.object({
  id: z.string().min(1), workspaceId: z.string().min(1), createdBy: z.string().min(1),
  noteId: z.string().nullable().optional(), title: z.string().min(1).max(200), detail: z.string().max(1000),
  dueDate: dueDateSchema, priority: z.enum(['low', 'medium', 'high'] as const),
  visibility: itemVisibilitySchema.default('private'), isDone: z.boolean(), doneAt: z.string().nullable().optional(), createdAt: z.string(), updatedAt: z.string(),
});
export const exportDataSchema = z.object({
  version: z.literal(1), exportedAt: z.string(), workspaceId: z.string(),
  notes: z.array(z.object({ id: z.string(), title: z.string(), content: z.string(), isPinned: z.boolean(), isArchived: z.boolean(), visibility: itemVisibilitySchema.optional(), version: z.number(), createdAt: z.string(), updatedAt: z.string() })),
  todos: z.array(z.object({ id: z.string(), noteId: z.string().nullable().optional(), title: z.string(), detail: z.string(), dueDate: z.string().nullable().optional(), priority: z.enum(['low', 'medium', 'high'] as const), visibility: itemVisibilitySchema.optional(), isDone: z.boolean(), doneAt: z.string().nullable().optional(), createdAt: z.string(), updatedAt: z.string() })),
});
const emailField = z.string().trim().email('Correo electrónico inválido');
const passField = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128);
export const signInWithPasswordSchema = z.object({ email: emailField, password: passField });
export const signUpWithPasswordSchema = z.object({ email: emailField, password: passField, workspaceName: z.string().trim().min(1).max(80).optional() });
export const signInWithMagicLinkSchema = z.object({ email: emailField });

export const createAgencyInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre de la agencia es obligatorio').max(80, 'El nombre no puede superar los 80 caracteres'),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo admite minúsculas, números y guiones').max(64).optional().nullable(),
});
export const inviteMemberInputSchema = z.object({ workspaceId: z.string().min(1, 'El ID de agencia es obligatorio'), email: emailField.transform(v => v.toLowerCase()), role: invitationRoleSchema });
export const acceptInvitationInputSchema = z.object({ rawToken: z.string().trim().min(16, 'El token de invitación es inválido') });
export const revokeInvitationInputSchema = z.object({ workspaceId: z.string().min(1, 'El ID de agencia es obligatorio'), invitationId: z.string().min(1, 'El ID de invitación es obligatorio') });
export const changeMemberRoleInputSchema = z.object({ workspaceId: z.string().min(1, 'El ID de agencia es obligatorio'), targetUserId: z.string().min(1, 'El ID de usuario es obligatorio'), nextRole: workspaceRoleSchema });
export const removeMemberInputSchema = z.object({ workspaceId: z.string().min(1, 'El ID de agencia es obligatorio'), targetUserId: z.string().min(1, 'El ID de usuario es obligatorio') });
export const changeItemVisibilityInputSchema = z.object({ workspaceId: z.string().min(1, 'El ID de espacio es obligatorio'), itemId: z.string().min(1, 'El ID del elemento es obligatorio'), itemType: z.enum(['note', 'todo'] as const, { message: 'Tipo de elemento inválido' }), visibility: itemVisibilitySchema });

// Preferencias visuales por persona del espacio de Hoy (#83). Mismos valores que los check de public.user_preferences.
export const wallpaperSchema = z.enum(['contornos', 'patron', 'tinta', 'grafito', 'puntos', 'cuadricula', 'aurora', 'hubis', 'arena', 'imagen'] as const, { message: 'Fondo inválido' });
export const layoutModeSchema = z.enum(['free', 'side_by_side', 'focus'] as const, { message: 'Distribución inválida' });
export const preferencePanelSchema = z.enum(['today', 'open_note', 'pinned_notes'] as const, { message: 'Panel inválido' });
// Estado de presencia (issue 143). Mismos valores que el check de public.user_presence.
export const presenceStatusSchema = z.enum(['online', 'away', 'dnd'] as const, { message: 'Estado inválido' });
export type PresenceStatus = z.infer<typeof presenceStatusSchema>;
export const themePreferenceSchema = z.enum(['light', 'dark', 'system'] as const, { message: 'Tema inválido' });
export const userPreferencesSchema = z.object({
  wallpaper: wallpaperSchema,
  panelOpacity: z.number().int('La opacidad debe ser un número entero').min(60, 'La opacidad mínima es 60').max(98, 'La opacidad máxima es 98'),
  layoutMode: layoutModeSchema,
  visiblePanels: z.array(preferencePanelSchema).max(3).refine((panels) => new Set(panels).size === panels.length, 'Paneles repetidos'),
  theme: themePreferenceSchema,
});
export const updateUserPreferencesSchema = userPreferencesSchema.partial().refine((patch) => Object.keys(patch).length > 0, 'No hay preferencias que guardar');
export const DEFAULT_USER_PREFERENCES: UserPreferences = { wallpaper: 'contornos', panelOpacity: 80, layoutMode: 'free', visiblePanels: ['today', 'open_note', 'pinned_notes'], theme: 'light' };

export type CreateNoteInput = z.input<typeof createNoteSchema>; export type UpdateNoteInput = z.input<typeof updateNoteSchema>;
export type CreateTodoInput = z.input<typeof createTodoSchema>; export type UpdateTodoInput = z.input<typeof updateTodoSchema>;
export type ExportData = z.infer<typeof exportDataSchema>;
export type SignInWithPasswordInput = z.input<typeof signInWithPasswordSchema>;
export type SignUpWithPasswordInput = z.input<typeof signUpWithPasswordSchema>;
export type SignInWithMagicLinkInput = z.input<typeof signInWithMagicLinkSchema>;
export type CreateAgencyInput = z.input<typeof createAgencyInputSchema>; export type InviteMemberInput = z.input<typeof inviteMemberInputSchema>;
export type AcceptInvitationInput = z.input<typeof acceptInvitationInputSchema>; export type RevokeInvitationInput = z.input<typeof revokeInvitationInputSchema>;
export type ChangeMemberRoleInput = z.input<typeof changeMemberRoleInputSchema>; export type RemoveMemberInput = z.input<typeof removeMemberInputSchema>;
export type ChangeItemVisibilityInput = z.input<typeof changeItemVisibilityInputSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>; export type UpdateUserPreferencesInput = z.input<typeof updateUserPreferencesSchema>;

export * from "./chat";
export * from "./content";


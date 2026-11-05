import "server-only";
import { redirect } from "next/navigation";
import {
  archiveNote, changeTodoVisibility, createNote, createTodo, createTodoFromNote, exportWorkspaceData,
  getUserPreferences, listNotes, listTodosByView, pinNote, saveUserPreferences, toggleTodoDone, updateNote, updateTodo,
  type AppContext, type Clock, type IdGenerator, type NoteFilter,
} from "@hubly/application";
import {
  changeItemVisibilityInputSchema, changeMemberRoleInputSchema, createAgencyInputSchema, createNoteSchema, createTodoSchema,
  removeMemberInputSchema, updateNoteSchema, updateTodoSchema, type CreateNoteInput, type CreateTodoInput, type UpdateNoteInput, type UpdateTodoInput, type UpdateUserPreferencesInput,
} from "@hubly/contracts";
import { DrizzleNoteRepository, DrizzleTodoRepository, DrizzleUserPreferencesRepository, DrizzleWorkspaceRepository, withUserContext, type ItemVisibility, type UserClaims, type UserWorkspaceSummary, type WorkspaceInvitationRecord, type WorkspaceKind, type WorkspaceRole } from "@hubly/db";
import {
  DEFAULT_APP_TIMEZONE, GENERIC_AUTH_ERROR, GENERIC_MAGIC_LINK_MESSAGE, HUBLY_TIMEZONE_COOKIE, HUBLY_WORKSPACE_COOKIE,
  createHttpOnlyCookieMethods, createSupabaseServerClient, enforceHttpOnlyCookieOptions,
  SessionExpiredError, getVerifiedServerSession, isSessionExpiredError, isValidIanaTimeZone, persistActiveWorkspaceCookie, resolveActiveWorkspaceCookie, resolveRequestTimeZone, resolveSiteUrl,
  resolveSupabaseConfig, setActiveWorkspaceCookieForTests, setSupabaseServerClientFactoryForTests, setTimeZoneResolverForTests,
} from "./auth";
import { WALLPAPER_BUCKET, removeUserWallpaper, signUserWallpaper, uploadUserWallpaper, wallpaperObjectPath } from "./wallpaper-storage";
import { WALLPAPER_MAX_BYTES, WallpaperImageError, sanitizeWallpaperImage } from "./wallpaper-image";
import { acceptWorkspaceInvitationByToken, acceptWorkspaceInvitationSafely, classifyInvitationError, currentSessionEmail, issueWorkspaceInvitation, revokePendingWorkspaceInvitation, type AcceptInvitationResult } from "./invitations";
export {
  WALLPAPER_BUCKET, WALLPAPER_MAX_BYTES, WallpaperImageError, removeUserWallpaper, sanitizeWallpaperImage, signUserWallpaper, uploadUserWallpaper, wallpaperObjectPath,
  DEFAULT_APP_TIMEZONE, GENERIC_AUTH_ERROR, GENERIC_MAGIC_LINK_MESSAGE, HUBLY_TIMEZONE_COOKIE, HUBLY_WORKSPACE_COOKIE,
  acceptWorkspaceInvitationByToken, acceptWorkspaceInvitationSafely, classifyInvitationError, currentSessionEmail, type AcceptInvitationResult, createHttpOnlyCookieMethods, createSupabaseServerClient, enforceHttpOnlyCookieOptions,
  SessionExpiredError, getVerifiedServerSession, isSessionExpiredError, isValidIanaTimeZone, issueWorkspaceInvitation, persistActiveWorkspaceCookie, resolveActiveWorkspaceCookie,
  resolveRequestTimeZone, resolveSiteUrl, resolveSupabaseConfig, revokePendingWorkspaceInvitation,
  setActiveWorkspaceCookieForTests, setSupabaseServerClientFactoryForTests, setTimeZoneResolverForTests, type UserWorkspaceSummary, type WorkspaceInvitationRecord,
};

type DbInstance = Parameters<typeof withUserContext>[2];
let testDbOverride: DbInstance | undefined;
let testClockNowOverride: (() => Date) | null = null;
export function setWorkspaceDbForTests(db: DbInstance | undefined): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Solo permitido en entorno de pruebas");
  testDbOverride = db;
}
export function setClockNowForTests(fn: (() => Date) | null): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Solo permitido en entorno de pruebas");
  testClockNowOverride = fn;
}

export interface CompositionContext extends AppContext {
  claims: UserClaims; role: WorkspaceRole; workspaceKind: WorkspaceKind; workspaceName: string; workspaceSlug: string | null;
  timezone: string; todayDate: string; db?: DbInstance;
}

export function createSystemClock(timezone = DEFAULT_APP_TIMEZONE): Clock & { todayIsoDate: () => string } {
  const safeTz = isValidIanaTimeZone(timezone) ? timezone.trim() : DEFAULT_APP_TIMEZONE;
  const now = () => (process.env.NODE_ENV === "test" && testClockNowOverride ? testClockNowOverride() : new Date());
  const todayString = () => new Intl.DateTimeFormat("en-CA", { timeZone: safeTz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now());
  return { now, todayString, todayIsoDate: todayString };
}

export const systemIdGenerator: IdGenerator = { generate: () => crypto.randomUUID() };

export async function ensureAuthenticatedWorkspace(workspaceId?: string, defaultName?: string): Promise<CompositionContext> {
  const [{ claims }, timezone, cookieWsId] = await Promise.all([
    // En producción Next oculta el mensaje de los errores de una Server Action; una redirección sí llega al cliente (#92).
    getVerifiedServerSession().catch((err: unknown) => { if (isSessionExpiredError(err)) redirect("/login"); throw err; }),
    resolveRequestTimeZone(), resolveActiveWorkspaceCookie(),
  ]);
  const resolvedDb = process.env.NODE_ENV === "test" ? testDbOverride : undefined;
  const wsRepo = new DrizzleWorkspaceRepository(claims, resolvedDb);
  let resolvedWorkspaceId: string | undefined, member = null;
  if (workspaceId) {
    member = await wsRepo.findMember(workspaceId, claims.sub);
    if (!member) throw new Error(`No autorizado en el espacio de trabajo: ${workspaceId}`);
    resolvedWorkspaceId = workspaceId;
  } else if (cookieWsId) {
    member = await wsRepo.findMember(cookieWsId, claims.sub);
    if (member) resolvedWorkspaceId = cookieWsId;
    else await persistActiveWorkspaceCookie(null);
  }
  if (!resolvedWorkspaceId) {
    resolvedWorkspaceId = await wsRepo.ensurePersonalWorkspace(defaultName);
    member = await wsRepo.findMember(resolvedWorkspaceId, claims.sub);
  }
  const ws = await wsRepo.findById(resolvedWorkspaceId);
  if (!member) throw new Error(`No autorizado en el espacio de trabajo: ${resolvedWorkspaceId}`);
  const role: WorkspaceRole = member.role as WorkspaceRole, workspaceKind: WorkspaceKind = (ws?.kind as WorkspaceKind | undefined) ?? "personal";
  const todayDate = createSystemClock(timezone).todayIsoDate();
  return { claims, workspaceId: resolvedWorkspaceId, userId: claims.sub, role, workspaceKind, workspaceName: ws?.name ?? defaultName ?? "Mi Espacio", workspaceSlug: ws?.slug ?? null, timezone, todayDate, ...(resolvedDb ? { db: resolvedDb } : {}) };
}

export const getWorkspaceContext = ensureAuthenticatedWorkspace;

const repos = (ctx: CompositionContext) => ({
  noteRepo: new DrizzleNoteRepository(ctx.claims, ctx.workspaceId, ctx.db),
  todoRepo: new DrizzleTodoRepository(ctx.claims, ctx.workspaceId, ctx.db),
  wsRepo: new DrizzleWorkspaceRepository(ctx.claims, ctx.db),
  clock: createSystemClock(ctx.timezone),
});

export const createNoteUseCase = (ctx: CompositionContext) => (input: CreateNoteInput) =>
  createNote(repos(ctx).noteRepo, repos(ctx).clock, systemIdGenerator, createNoteSchema.parse(input), ctx);
export const updateNoteUseCase = (ctx: CompositionContext) => (input: UpdateNoteInput) =>
  updateNote(repos(ctx).noteRepo, repos(ctx).clock, updateNoteSchema.parse(input), ctx);
export const pinNoteUseCase = (ctx: CompositionContext) => (noteId: string, isPinned: boolean) =>
  pinNote(repos(ctx).noteRepo, repos(ctx).clock, noteId, isPinned, ctx);
export const archiveNoteUseCase = (ctx: CompositionContext) => (noteId: string, isArchived: boolean) =>
  archiveNote(repos(ctx).noteRepo, repos(ctx).clock, noteId, isArchived, ctx);
export const listNotesUseCase = (ctx: CompositionContext) => (filter?: NoteFilter) =>
  listNotes(repos(ctx).noteRepo, ctx, filter);
export const createTodoUseCase = (ctx: CompositionContext) => (input: CreateTodoInput) => {
  const { todoRepo, noteRepo, clock } = repos(ctx);
  return createTodo(todoRepo, clock, systemIdGenerator, createTodoSchema.parse(input), ctx, noteRepo);
};
export const updateTodoUseCase = (ctx: CompositionContext) => (input: UpdateTodoInput) => {
  const { todoRepo, noteRepo, clock } = repos(ctx);
  return updateTodo(todoRepo, clock, updateTodoSchema.parse(input), ctx, noteRepo);
};
export const toggleTodoUseCase = (ctx: CompositionContext) => (todoId: string) =>
  toggleTodoDone(repos(ctx).todoRepo, repos(ctx).clock, todoId, ctx);
export const listTodosUseCase = (ctx: CompositionContext) => (view: Parameters<typeof listTodosByView>[2]) =>
  listTodosByView(repos(ctx).todoRepo, repos(ctx).clock, view, ctx);
export const createTodoFromNoteUseCase = (ctx: CompositionContext) => (noteId: string, input: Omit<CreateTodoInput, "noteId">) => {
  const { todoRepo, noteRepo, clock } = repos(ctx);
  return createTodoFromNote(todoRepo, noteRepo, clock, systemIdGenerator, noteId, createTodoSchema.omit({ noteId: true }).parse(input), ctx);
};
export const exportDataUseCase = (ctx: CompositionContext) => () => {
  const { noteRepo, todoRepo, clock } = repos(ctx);
  return exportWorkspaceData(noteRepo, todoRepo, clock, ctx);
};
export const changeNoteVisibilityUseCase = (ctx: CompositionContext) => async (noteId: string, visibility: ItemVisibility) => {
  const parsed = changeItemVisibilityInputSchema.parse({ workspaceId: ctx.workspaceId, itemId: noteId, itemType: "note", visibility });
  const { noteRepo } = repos(ctx), note = await noteRepo.findById(parsed.itemId);
  if (!note || note.workspaceId !== ctx.workspaceId) throw new Error(`Nota no encontrada: ${parsed.itemId}`);
  if (ctx.role === "viewer" || note.createdBy !== ctx.userId) throw new Error("Solo el autor con permisos de edición puede cambiar la visibilidad");
  const updated = await noteRepo.updateVisibility(parsed.itemId, parsed.visibility);
  if (!updated) throw new Error("No se pudo actualizar la visibilidad de la nota");
  return updated;
};
export const changeTodoVisibilityUseCase = (ctx: CompositionContext) => async (todoId: string, visibility: ItemVisibility) => {
  const parsed = changeItemVisibilityInputSchema.parse({ workspaceId: ctx.workspaceId, itemId: todoId, itemType: "todo", visibility }), { todoRepo, noteRepo, clock } = repos(ctx);
  return changeTodoVisibility(todoRepo, noteRepo, clock, parsed.itemId, parsed.visibility, ctx);
};
export const createAgencyWorkspaceUseCase = (ctx: CompositionContext) => async (input: { name: string; slug?: string | null }): Promise<UserWorkspaceSummary> => {
  const parsed = createAgencyInputSchema.parse(input), { wsRepo } = repos(ctx), id = await wsRepo.createAgencyWorkspace(parsed.name, parsed.slug ?? null);
  await persistActiveWorkspaceCookie(id);
  const ws = await wsRepo.findById(id);
  return { id, name: ws?.name ?? parsed.name, slug: ws?.slug ?? parsed.slug ?? id, kind: "agency", role: "owner" };
};
export const listUserWorkspacesUseCase = (ctx: CompositionContext) => () => repos(ctx).wsRepo.listUserWorkspaces();
export const listWorkspaceMembersUseCase = (ctx: CompositionContext) => async () =>
  (await repos(ctx).wsRepo.listMembers(ctx.workspaceId)).map((m) => ({ workspaceId: m.workspaceId, userId: m.userId, role: m.role, createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt).toISOString() }));
export const listPendingInvitationsUseCase = (ctx: CompositionContext) => () =>
  ctx.workspaceKind === "agency" && (ctx.role === "owner" || ctx.role === "admin") ? repos(ctx).wsRepo.listPendingInvitations(ctx.workspaceId) : Promise.resolve([]);
export const changeMemberRoleUseCase = (ctx: CompositionContext) => async (targetUserId: string, nextRole: WorkspaceRole): Promise<void> => {
  const parsed = changeMemberRoleInputSchema.parse({ workspaceId: ctx.workspaceId, targetUserId, nextRole });
  if (ctx.workspaceKind === "personal") throw new Error("No se pueden cambiar roles en un espacio personal");
  await repos(ctx).wsRepo.updateMemberRole(ctx.workspaceId, parsed.targetUserId, parsed.nextRole);
};
export const removeOrLeaveMemberUseCase = (ctx: CompositionContext) => async (targetUserId: string): Promise<{ leftCurrentWorkspace: boolean }> => {
  const parsed = removeMemberInputSchema.parse({ workspaceId: ctx.workspaceId, targetUserId });
  if (ctx.workspaceKind === "personal") throw new Error("No se puede abandonar ni eliminar miembros de un espacio personal");
  await repos(ctx).wsRepo.removeMember(ctx.workspaceId, parsed.targetUserId);
  if (parsed.targetUserId === ctx.userId) await persistActiveWorkspaceCookie(null);
  return { leftCurrentWorkspace: parsed.targetUserId === ctx.userId };
};
// Preferencias visuales por persona (#83): no dependen del espacio activo, solo del usuario de la sesión.
export const getUserPreferencesUseCase = (ctx: CompositionContext) => () =>
  getUserPreferences(new DrizzleUserPreferencesRepository(ctx.claims, ctx.db), ctx);
export const saveUserPreferencesUseCase = (ctx: CompositionContext) => (patch: UpdateUserPreferencesInput) =>
  saveUserPreferences(new DrizzleUserPreferencesRepository(ctx.claims, ctx.db), patch, ctx);


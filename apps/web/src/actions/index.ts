"use server";
import type { NoteFilter } from "@hubly/application";
import { createNoteSchema, presenceStatusSchema, type PresenceStatus, createTodoSchema, exportDataSchema, updateNoteSchema, updateTodoSchema, updateUserPreferencesSchema, type CreateNoteInput, type CreateTodoInput, type ExportData, type UpdateNoteInput, type UpdateTodoInput, type UpdateUserPreferencesInput, type UserPreferences } from "@hubly/contracts";
import {
  acceptWorkspaceInvitationSafely, archiveNoteUseCase, changeMemberRoleUseCase, changeNoteVisibilityUseCase,
  changeTodoVisibilityUseCase, createAgencyWorkspaceUseCase, createNoteUseCase, createTodoFromNoteUseCase,
  createTodoUseCase, ensureAuthenticatedWorkspace, exportDataUseCase, getUserPreferencesUseCase, issueWorkspaceInvitation, listNotesUseCase,
  listPendingInvitationsUseCase, listTodosUseCase, listUserWorkspacesUseCase, listWorkspaceMembersUseCase,
  WallpaperImageError, persistActiveWorkspaceCookie, pinNoteUseCase, removeOrLeaveMemberUseCase, removeUserWallpaper, revokePendingWorkspaceInvitation, saveUserPreferencesUseCase,
  signUserWallpaper, uploadUserWallpaper, loadUserProfile, removeUserAvatar, saveUserDisplayName, saveUserPresence, uploadUserAvatar,
  toggleTodoUseCase, updateNoteUseCase, updateTodoUseCase, type AcceptInvitationResult, type UserWorkspaceSummary, type WorkspaceInvitationRecord,
} from "../server/composition";

import { composeChatService, isChatEnabled } from "../server/composition/chat";

export type WorkspaceNote = Awaited<ReturnType<ReturnType<typeof listNotesUseCase>>>[number];
export type WorkspaceTodo = Awaited<ReturnType<ReturnType<typeof listTodosUseCase>>>[number];
export type WorkspaceTodoView = Parameters<ReturnType<typeof listTodosUseCase>>[0];
export type WorkspaceSummary = UserWorkspaceSummary;
export type WorkspaceMemberSummary = Awaited<ReturnType<ReturnType<typeof listWorkspaceMembersUseCase>>>[number];
export type WorkspaceInvitationSummary = WorkspaceInvitationRecord;
export interface WorkspaceDashboardData {
  notes: WorkspaceNote[]; todos: WorkspaceTodo[]; todayDate: string; timezone: string; currentUserId: string;
  activeWorkspace: WorkspaceSummary; workspaces: WorkspaceSummary[]; members: WorkspaceMemberSummary[]; pendingInvitations: WorkspaceInvitationSummary[];
  preferences: UserPreferences;
  /** URL firmada (1 h) de «Tu imagen» si es el fondo elegido; null en otro caso (#84). */
  wallpaperImageUrl: string | null;
  /** Correo de la sesión, para la inicial del avatar. */
  currentUserEmail: string | null;
  /** Nombre visible y URL firmada (1 h) de la foto de perfil, si la hay (issue 135). */
  currentUserName: string | null;
  avatarUrl: string | null;
  /** Estado de presencia elegido (issue 143). */
  presence: PresenceStatus;
  chat?: { unread: number | null } | null;
}

const autosaveNoteSchema = updateNoteSchema.required({ expectedVersion: true });

export async function loadWorkspaceDashboardAction(workspaceId?: string): Promise<WorkspaceDashboardData> {
  const ctx = await ensureAuthenticatedWorkspace(workspaceId);
  const listView = listTodosUseCase(ctx);
  const [notes, todayTodos, upcomingTodos, noDateTodos, doneTodos, userWorkspaces, members, pendingInvitations, preferences, profile] = await Promise.all([
    listNotesUseCase(ctx)(), listView("today"), listView("upcoming"), listView("no_date"), listView("done"),
    listUserWorkspacesUseCase(ctx)(), listWorkspaceMembersUseCase(ctx)(), listPendingInvitationsUseCase(ctx)(), getUserPreferencesUseCase(ctx)(), loadUserProfile(ctx.userId, ctx.userDisplayName),
  ]);
  const seen = new Set<string>();
  const todos = [...todayTodos, ...upcomingTodos, ...noDateTodos, ...doneTodos].filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  const activeWorkspace: WorkspaceSummary = { id: ctx.workspaceId, name: ctx.workspaceName, slug: ctx.workspaceSlug ?? ctx.workspaceId, kind: ctx.workspaceKind, role: ctx.role };
  const wallpaperImageUrl = preferences.wallpaper === "imagen" ? await signUserWallpaper(ctx.userId) : null;
  const chat = activeWorkspace.kind === "agency" && isChatEnabled(activeWorkspace.id)
    ? { unread: await composeChatService(activeWorkspace, ctx.claims).list(activeWorkspace.id)
      .then((conversations) => conversations.filter((item) => item.unread).length, () => null) }
    : null;
  return { notes, todos, todayDate: ctx.todayDate, timezone: ctx.timezone, currentUserId: ctx.userId, activeWorkspace, workspaces: userWorkspaces.length > 0 ? userWorkspaces : [activeWorkspace], members, pendingInvitations, preferences, wallpaperImageUrl, currentUserEmail: ctx.userEmail, currentUserName: profile.name, avatarUrl: profile.avatarUrl, presence: profile.presence, chat };
}

export async function createTodoAction(input: CreateTodoInput, workspaceId?: string): Promise<WorkspaceTodo> {
  return createTodoUseCase(await ensureAuthenticatedWorkspace(workspaceId))(createTodoSchema.parse(input));
}
export async function updateTodoAction(input: UpdateTodoInput, workspaceId?: string): Promise<WorkspaceTodo> {
  return updateTodoUseCase(await ensureAuthenticatedWorkspace(workspaceId))(updateTodoSchema.parse(input));
}
export async function toggleTodoAction(todoId: string, workspaceId?: string): Promise<WorkspaceTodo> {
  return toggleTodoUseCase(await ensureAuthenticatedWorkspace(workspaceId))(todoId);
}
export async function listTodosByViewAction(view: WorkspaceTodoView, workspaceId?: string): Promise<WorkspaceTodo[]> {
  return listTodosUseCase(await ensureAuthenticatedWorkspace(workspaceId))(view);
}
export async function createTodoFromNoteAction(noteId: string, input: Omit<CreateTodoInput, "noteId">, workspaceId?: string): Promise<WorkspaceTodo> {
  return createTodoFromNoteUseCase(await ensureAuthenticatedWorkspace(workspaceId))(noteId, createTodoSchema.omit({ noteId: true }).parse(input));
}
export async function createNoteAction(input: CreateNoteInput, workspaceId?: string): Promise<WorkspaceNote> {
  return createNoteUseCase(await ensureAuthenticatedWorkspace(workspaceId))(createNoteSchema.parse(input));
}
export async function saveNoteAction(input: UpdateNoteInput, workspaceId?: string): Promise<WorkspaceNote> {
  return updateNoteUseCase(await ensureAuthenticatedWorkspace(workspaceId))(autosaveNoteSchema.parse(input));
}
export async function pinNoteAction(noteId: string, isPinned: boolean, workspaceId?: string): Promise<WorkspaceNote> {
  return pinNoteUseCase(await ensureAuthenticatedWorkspace(workspaceId))(noteId, isPinned);
}
export async function archiveNoteAction(noteId: string, isArchived: boolean, workspaceId?: string): Promise<WorkspaceNote> {
  return archiveNoteUseCase(await ensureAuthenticatedWorkspace(workspaceId))(noteId, isArchived);
}
export async function listNotesAction(filter?: NoteFilter, workspaceId?: string): Promise<WorkspaceNote[]> {
  return listNotesUseCase(await ensureAuthenticatedWorkspace(workspaceId))(filter);
}
export async function exportWorkspaceAction(workspaceId?: string): Promise<{ jsonFilename: string; mdFilename: string; jsonContent: string; markdownContent: string; data: ExportData }> {
  const ctx = await ensureAuthenticatedWorkspace(workspaceId);
  const res = await exportDataUseCase(ctx)();
  const validated = exportDataSchema.parse(res.json), date = ctx.todayDate;
  return { jsonFilename: `hubly-export-${date}.json`, mdFilename: `hubly-export-${date}.md`, jsonContent: JSON.stringify(validated, null, 2), markdownContent: res.markdown, data: validated };
}
export async function createAgencyWorkspaceAction(input: { name: string; slug?: string | null }): Promise<WorkspaceSummary> {
  return createAgencyWorkspaceUseCase(await ensureAuthenticatedWorkspace())(input);
}
export async function selectActiveWorkspaceAction(workspaceId: string): Promise<WorkspaceSummary> {
  const ctx = await ensureAuthenticatedWorkspace(workspaceId);
  await persistActiveWorkspaceCookie(ctx.workspaceId);
  return { id: ctx.workspaceId, name: ctx.workspaceName, slug: ctx.workspaceSlug ?? ctx.workspaceId, kind: ctx.workspaceKind, role: ctx.role };
}
export async function inviteWorkspaceMemberAction(input: { workspaceId?: string; email: string; role: "admin" | "editor" | "viewer" }): Promise<{ invitation: WorkspaceInvitationSummary; invitationPath: string }> {
  return issueWorkspaceInvitation(await ensureAuthenticatedWorkspace(input.workspaceId), { email: input.email, role: input.role });
}
export async function revokeWorkspaceInvitationAction(input: { workspaceId?: string; invitationId: string }): Promise<void> {
  return revokePendingWorkspaceInvitation(await ensureAuthenticatedWorkspace(input.workspaceId), input.invitationId);
}
/** Devuelve un resultado con código en vez de lanzar: así el aviso en español llega también en producción. */
export async function acceptWorkspaceInvitationAction(input: { token: string }): Promise<AcceptInvitationResult> {
  return acceptWorkspaceInvitationSafely(input.token);
}
export async function changeWorkspaceMemberRoleAction(input: { workspaceId?: string; targetUserId: string; role: "owner" | "admin" | "editor" | "viewer" }): Promise<void> {
  return changeMemberRoleUseCase(await ensureAuthenticatedWorkspace(input.workspaceId))(input.targetUserId, input.role);
}
export async function removeOrLeaveWorkspaceMemberAction(input: { workspaceId?: string; targetUserId: string }): Promise<{ leftCurrentWorkspace: boolean }> {
  return removeOrLeaveMemberUseCase(await ensureAuthenticatedWorkspace(input.workspaceId))(input.targetUserId);
}
export async function changeNoteVisibilityAction(input: { noteId: string; visibility: "private" | "workspace" }, workspaceId?: string): Promise<WorkspaceNote> {
  return changeNoteVisibilityUseCase(await ensureAuthenticatedWorkspace(workspaceId))(input.noteId, input.visibility);
}
export async function changeTodoVisibilityAction(input: { todoId: string; visibility: "private" | "workspace" }, workspaceId?: string): Promise<WorkspaceTodo> {
  return changeTodoVisibilityUseCase(await ensureAuthenticatedWorkspace(workspaceId))(input.todoId, input.visibility);
}

/** Guarda las preferencias visuales de la persona de la sesión (#83). Solo puede tocar las suyas: lo impone RLS. */
export async function saveUserPreferencesAction(patch: UpdateUserPreferencesInput): Promise<UserPreferences> {
  return saveUserPreferencesUseCase(await ensureAuthenticatedWorkspace())(updateUserPreferencesSchema.parse(patch));
}

export type UploadWallpaperResult = { ok: true; url: string } | { ok: false; message: string };

/** Sube «Tu imagen» (#84): valida tipo real y tamaño, quita metadatos y la elige como fondo. Devuelve el error como dato,
 *  porque en producción Next.js oculta el mensaje de los errores lanzados (#92). */
export async function uploadWallpaperAction(formData: FormData): Promise<UploadWallpaperResult> {
  const file = formData.get("imagen");
  if (!(file instanceof File)) return { ok: false, message: "Elige una imagen JPEG, PNG o WebP." };
  const ctx = await ensureAuthenticatedWorkspace();
  try {
    const url = await uploadUserWallpaper(ctx.userId, new Uint8Array(await file.arrayBuffer()));
    await saveUserPreferencesUseCase(ctx)({ wallpaper: "imagen" });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, message: err instanceof WallpaperImageError || err instanceof Error ? err.message : "No se pudo subir tu imagen." };
  }
}

/** Quita «Tu imagen» y vuelve al fondo «Contornos». */
export async function removeWallpaperAction(): Promise<UserPreferences> {
  const ctx = await ensureAuthenticatedWorkspace();
  await removeUserWallpaper(ctx.userId);
  return saveUserPreferencesUseCase(ctx)({ wallpaper: "contornos" });
}


export type ProfileResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** Sube la foto de perfil (issue 135) con las mismas validaciones que «Tu imagen». Devuelve el error como dato (#92). */
export async function uploadAvatarAction(formData: FormData): Promise<ProfileResult<string>> {
  const file = formData.get("foto");
  if (!(file instanceof File)) return { ok: false, message: "Elige una imagen JPEG, PNG o WebP." };
  const ctx = await ensureAuthenticatedWorkspace();
  try {
    return { ok: true, value: await uploadUserAvatar(ctx.userId, new Uint8Array(await file.arrayBuffer())) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "No se pudo subir tu foto." };
  }
}

export async function removeAvatarAction(): Promise<ProfileResult<null>> {
  const ctx = await ensureAuthenticatedWorkspace();
  try {
    await removeUserAvatar(ctx.userId);
    return { ok: true, value: null };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "No se pudo quitar tu foto." };
  }
}

export async function saveDisplayNameAction(name: string): Promise<ProfileResult<string>> {
  await ensureAuthenticatedWorkspace();
  try {
    return { ok: true, value: await saveUserDisplayName(String(name)) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "No se pudo guardar tu nombre." };
  }
}

/** Cambia el estado de presencia de la persona de la sesión (issue 143). Solo puede tocar el suyo: lo impone RLS. */
export async function savePresenceAction(status: PresenceStatus): Promise<ProfileResult<PresenceStatus>> {
  const parsed = presenceStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, message: "Estado inválido." };
  const ctx = await ensureAuthenticatedWorkspace();
  try {
    return { ok: true, value: await saveUserPresence(ctx.userId, parsed.data) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "No se pudo cambiar tu estado." };
  }
}

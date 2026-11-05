"use server";
import type { NoteFilter } from "@hubly/application";
import { createNoteSchema, createTodoSchema, exportDataSchema, updateNoteSchema, updateTodoSchema, updateUserPreferencesSchema, type CreateNoteInput, type CreateTodoInput, type ExportData, type UpdateNoteInput, type UpdateTodoInput, type UpdateUserPreferencesInput, type UserPreferences } from "@hubly/contracts";
import {
  acceptWorkspaceInvitationSafely, archiveNoteUseCase, changeMemberRoleUseCase, changeNoteVisibilityUseCase,
  changeTodoVisibilityUseCase, createAgencyWorkspaceUseCase, createNoteUseCase, createTodoFromNoteUseCase,
  createTodoUseCase, ensureAuthenticatedWorkspace, exportDataUseCase, getUserPreferencesUseCase, issueWorkspaceInvitation, listNotesUseCase,
  listPendingInvitationsUseCase, listTodosUseCase, listUserWorkspacesUseCase, listWorkspaceMembersUseCase,
  persistActiveWorkspaceCookie, pinNoteUseCase, removeOrLeaveMemberUseCase, revokePendingWorkspaceInvitation, saveUserPreferencesUseCase,
  toggleTodoUseCase, updateNoteUseCase, updateTodoUseCase, type AcceptInvitationResult, type UserWorkspaceSummary, type WorkspaceInvitationRecord,
} from "../server/composition";

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
}

const autosaveNoteSchema = updateNoteSchema.required({ expectedVersion: true });

export async function loadWorkspaceDashboardAction(workspaceId?: string): Promise<WorkspaceDashboardData> {
  const ctx = await ensureAuthenticatedWorkspace(workspaceId);
  const listView = listTodosUseCase(ctx);
  const [notes, todayTodos, upcomingTodos, noDateTodos, doneTodos, userWorkspaces, members, pendingInvitations, preferences] = await Promise.all([
    listNotesUseCase(ctx)(), listView("today"), listView("upcoming"), listView("no_date"), listView("done"),
    listUserWorkspacesUseCase(ctx)(), listWorkspaceMembersUseCase(ctx)(), listPendingInvitationsUseCase(ctx)(), getUserPreferencesUseCase(ctx)(),
  ]);
  const seen = new Set<string>();
  const todos = [...todayTodos, ...upcomingTodos, ...noDateTodos, ...doneTodos].filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  const activeWorkspace: WorkspaceSummary = { id: ctx.workspaceId, name: ctx.workspaceName, slug: ctx.workspaceSlug ?? ctx.workspaceId, kind: ctx.workspaceKind, role: ctx.role };
  return { notes, todos, todayDate: ctx.todayDate, timezone: ctx.timezone, currentUserId: ctx.userId, activeWorkspace, workspaces: userWorkspaces.length > 0 ? userWorkspaces : [activeWorkspace], members, pendingInvitations, preferences };
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


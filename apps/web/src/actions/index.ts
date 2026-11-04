"use server";
import type { NoteFilter } from "@hubly/application";
import { createNoteSchema, createTodoSchema, exportDataSchema, updateNoteSchema, updateTodoSchema, type CreateNoteInput, type CreateTodoInput, type ExportData, type UpdateNoteInput, type UpdateTodoInput } from "@hubly/contracts";
import { archiveNoteUseCase, createNoteUseCase, createTodoFromNoteUseCase, createTodoUseCase, ensureAuthenticatedWorkspace, exportDataUseCase, listNotesUseCase, listTodosUseCase, pinNoteUseCase, toggleTodoUseCase, updateNoteUseCase, updateTodoUseCase } from "../server/composition";

export type WorkspaceNote = Awaited<ReturnType<ReturnType<typeof listNotesUseCase>>>[number];
export type WorkspaceTodo = Awaited<ReturnType<ReturnType<typeof listTodosUseCase>>>[number];
export type WorkspaceTodoView = Parameters<ReturnType<typeof listTodosUseCase>>[0];
export interface WorkspaceDashboardData { notes: WorkspaceNote[]; todos: WorkspaceTodo[]; todayDate: string; timezone: string; }

const autosaveNoteSchema = updateNoteSchema.required({ expectedVersion: true });

export async function loadWorkspaceDashboardAction(workspaceId?: string): Promise<WorkspaceDashboardData> {
  const ctx = await ensureAuthenticatedWorkspace(workspaceId);
  const listView = listTodosUseCase(ctx);
  const [notes, todayTodos, upcomingTodos, noDateTodos, doneTodos] = await Promise.all([
    listNotesUseCase(ctx)(), listView("today"), listView("upcoming"), listView("no_date"), listView("done"),
  ]);
  const seen = new Set<string>();
  const todos = [...todayTodos, ...upcomingTodos, ...noDateTodos, ...doneTodos].filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  return { notes, todos, todayDate: ctx.todayDate, timezone: ctx.timezone };
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

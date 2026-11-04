"use server";
import type { NoteFilter } from "@hubly/application";
import { createNoteSchema, createTodoSchema, exportDataSchema, updateNoteSchema, updateTodoSchema, type CreateNoteInput, type CreateTodoInput, type ExportData, type UpdateNoteInput, type UpdateTodoInput } from "@hubly/contracts";
import { archiveNoteUseCase, createNoteUseCase, createTodoFromNoteUseCase, createTodoUseCase, ensureAuthenticatedWorkspace, exportDataUseCase, listNotesUseCase, listTodosUseCase, pinNoteUseCase, toggleTodoUseCase, updateNoteUseCase, updateTodoUseCase } from "../server/composition";

export type WorkspaceNote = Awaited<ReturnType<ReturnType<typeof listNotesUseCase>>>[number];
export type WorkspaceTodo = Awaited<ReturnType<ReturnType<typeof listTodosUseCase>>>[number];
export type WorkspaceTodoView = Parameters<ReturnType<typeof listTodosUseCase>>[0];

const autosaveNoteSchema = updateNoteSchema.required({ expectedVersion: true });

export async function createTodoAction(input: CreateTodoInput, workspaceId?: string): Promise<WorkspaceTodo> {
  return createTodoUseCase(await ensureAuthenticatedWorkspace(workspaceId))(createTodoSchema.parse(input));
}
export async function updateTodoAction(input: UpdateTodoInput, workspaceId?: string): Promise<WorkspaceTodo> {
  return updateTodoUseCase(await ensureAuthenticatedWorkspace(workspaceId))(updateTodoSchema.parse(input));
}
export const toggleTodoAction = async (todoId: string, workspaceId?: string) =>
  toggleTodoUseCase(await ensureAuthenticatedWorkspace(workspaceId))(todoId);
export const listTodosByViewAction = async (view: WorkspaceTodoView, workspaceId?: string) =>
  listTodosUseCase(await ensureAuthenticatedWorkspace(workspaceId))(view);
export async function createTodoFromNoteAction(noteId: string, input: Omit<CreateTodoInput, "noteId">, workspaceId?: string): Promise<WorkspaceTodo> {
  return createTodoFromNoteUseCase(await ensureAuthenticatedWorkspace(workspaceId))(noteId, createTodoSchema.omit({ noteId: true }).parse(input));
}
export async function createNoteAction(input: CreateNoteInput, workspaceId?: string): Promise<WorkspaceNote> {
  return createNoteUseCase(await ensureAuthenticatedWorkspace(workspaceId))(createNoteSchema.parse(input));
}
export async function saveNoteAction(input: UpdateNoteInput, workspaceId?: string): Promise<WorkspaceNote> {
  return updateNoteUseCase(await ensureAuthenticatedWorkspace(workspaceId))(autosaveNoteSchema.parse(input));
}
export const pinNoteAction = async (noteId: string, isPinned: boolean, workspaceId?: string) =>
  pinNoteUseCase(await ensureAuthenticatedWorkspace(workspaceId))(noteId, isPinned);
export const archiveNoteAction = async (noteId: string, isArchived: boolean, workspaceId?: string) =>
  archiveNoteUseCase(await ensureAuthenticatedWorkspace(workspaceId))(noteId, isArchived);
export const listNotesAction = async (filter?: NoteFilter, workspaceId?: string) =>
  listNotesUseCase(await ensureAuthenticatedWorkspace(workspaceId))(filter);
export async function exportWorkspaceAction(workspaceId?: string): Promise<{ jsonFilename: string; mdFilename: string; jsonContent: string; markdownContent: string; data: ExportData }> {
  const res = await exportDataUseCase(await ensureAuthenticatedWorkspace(workspaceId))();
  const validated = exportDataSchema.parse(res.json), date = validated.exportedAt.slice(0, 10);
  return { jsonFilename: `hubly-export-${date}.json`, mdFilename: `hubly-export-${date}.md`, jsonContent: JSON.stringify(validated, null, 2), markdownContent: res.markdown, data: validated };
}

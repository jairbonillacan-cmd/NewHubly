"use server";
import type { NoteFilter } from "@hubly/application";
import { createNoteSchema, createTodoSchema, exportDataSchema, updateNoteSchema, updateTodoSchema, type CreateNoteInput, type CreateTodoInput, type ExportData, type UpdateNoteInput, type UpdateTodoInput } from "@hubly/contracts";
import { archiveNoteUseCase, createNoteUseCase, createTodoFromNoteUseCase, createTodoUseCase, exportDataUseCase, getWorkspaceContext, listNotesUseCase, listTodosUseCase, pinNoteUseCase, provisionPersonalWorkspace, toggleTodoUseCase, updateNoteUseCase, updateTodoUseCase } from "../server/composition";

export type SessionInput = Parameters<typeof getWorkspaceContext>[0];
export type DbOverride = Parameters<typeof getWorkspaceContext>[1];
export type WorkspaceNote = Awaited<ReturnType<ReturnType<typeof listNotesUseCase>>>[number];
export type WorkspaceTodo = Awaited<ReturnType<ReturnType<typeof listTodosUseCase>>>[number];
export type WorkspaceTodoView = Parameters<ReturnType<typeof listTodosUseCase>>[0];

const autosaveNoteSchema = updateNoteSchema.required({ expectedVersion: true });
export const provisionPersonalWorkspaceAction = async (claims: SessionInput["claims"], name: string, slug: string, db?: DbOverride): Promise<string> =>
  provisionPersonalWorkspace(claims, name, slug, db);

export async function createTodoAction(s: SessionInput, input: CreateTodoInput, db?: DbOverride): Promise<WorkspaceTodo> {
  const parsed = createTodoSchema.parse(input);
  return createTodoUseCase(await getWorkspaceContext(s, db))(parsed);
}
export async function updateTodoAction(s: SessionInput, input: UpdateTodoInput, db?: DbOverride): Promise<WorkspaceTodo> {
  const parsed = updateTodoSchema.parse(input);
  return updateTodoUseCase(await getWorkspaceContext(s, db))(parsed);
}
export const toggleTodoAction = async (s: SessionInput, todoId: string, db?: DbOverride) => toggleTodoUseCase(await getWorkspaceContext(s, db))(todoId);
export const listTodosByViewAction = async (s: SessionInput, view: WorkspaceTodoView, db?: DbOverride) => listTodosUseCase(await getWorkspaceContext(s, db))(view);
export async function createTodoFromNoteAction(s: SessionInput, noteId: string, input: Omit<CreateTodoInput, "noteId">, db?: DbOverride): Promise<WorkspaceTodo> {
  const parsed = createTodoSchema.omit({ noteId: true }).parse(input);
  return createTodoFromNoteUseCase(await getWorkspaceContext(s, db))(noteId, parsed);
}
export async function createNoteAction(s: SessionInput, input: CreateNoteInput, db?: DbOverride): Promise<WorkspaceNote> {
  const parsed = createNoteSchema.parse(input);
  return createNoteUseCase(await getWorkspaceContext(s, db))(parsed);
}
export async function saveNoteAction(s: SessionInput, input: UpdateNoteInput, db?: DbOverride): Promise<WorkspaceNote> {
  const parsed = autosaveNoteSchema.parse(input);
  return updateNoteUseCase(await getWorkspaceContext(s, db))(parsed);
}
export const pinNoteAction = async (s: SessionInput, noteId: string, isPinned: boolean, db?: DbOverride) => pinNoteUseCase(await getWorkspaceContext(s, db))(noteId, isPinned);
export const archiveNoteAction = async (s: SessionInput, noteId: string, isArchived: boolean, db?: DbOverride) => archiveNoteUseCase(await getWorkspaceContext(s, db))(noteId, isArchived);
export const listNotesAction = async (s: SessionInput, filter?: NoteFilter, db?: DbOverride) => listNotesUseCase(await getWorkspaceContext(s, db))(filter);
export async function exportWorkspaceAction(s: SessionInput, db?: DbOverride): Promise<{ jsonFilename: string; mdFilename: string; jsonContent: string; markdownContent: string; data: ExportData }> {
  const res = await exportDataUseCase(await getWorkspaceContext(s, db))();
  const validated = exportDataSchema.parse(res.json), date = validated.exportedAt.slice(0, 10);
  return { jsonFilename: `hubly-export-${date}.json`, mdFilename: `hubly-export-${date}.md`, jsonContent: JSON.stringify(validated, null, 2), markdownContent: res.markdown, data: validated };
}

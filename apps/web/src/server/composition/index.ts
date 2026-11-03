import "server-only";
import { randomUUID } from "node:crypto";
import {
  archiveNote, createNote, createTodo, createTodoFromNote, exportWorkspaceData,
  listNotes, listTodosByView, pinNote, toggleTodoDone, updateNote, updateTodo,
  type AppContext, type Clock, type IdGenerator, type NoteFilter,
} from "@hubly/application";
import {
  createNoteSchema, createTodoSchema, updateNoteSchema, updateTodoSchema,
  type CreateNoteInput, type CreateTodoInput, type UpdateNoteInput, type UpdateTodoInput,
} from "@hubly/contracts";
import { DrizzleNoteRepository, DrizzleTodoRepository, DrizzleWorkspaceRepository, withUserContext, type UserClaims } from "@hubly/db";

type DbInstance = Parameters<typeof withUserContext>[2];

export interface CompositionContext extends AppContext {
  claims: UserClaims;
  timezone?: string;
  db?: DbInstance;
}

export function createSystemClock(timezone = "UTC"): Clock {
  return {
    now: () => new Date(),
    todayString: () => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
  };
}

export const systemIdGenerator: IdGenerator = { generate: () => randomUUID() };

export async function getWorkspaceContext(
  input: { claims: UserClaims; workspaceId: string; timezone?: string },
  db?: DbInstance,
): Promise<CompositionContext> {
  if (!input.claims?.sub || input.claims.role !== "authenticated") throw new Error("Sesión no autenticada");
  const wsRepo = new DrizzleWorkspaceRepository(input.claims, db);
  const member = await wsRepo.findMember(input.workspaceId, input.claims.sub);
  if (!member) throw new Error(`No autorizado en el espacio de trabajo: ${input.workspaceId}`);
  return {
    claims: input.claims, workspaceId: input.workspaceId, userId: input.claims.sub,
    ...(input.timezone ? { timezone: input.timezone } : {}), ...(db ? { db } : {}),
  };
}

const repos = (ctx: CompositionContext) => ({
  noteRepo: new DrizzleNoteRepository(ctx.claims, ctx.workspaceId, ctx.db),
  todoRepo: new DrizzleTodoRepository(ctx.claims, ctx.workspaceId, ctx.db),
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

"use client";
import { parseQuickCapture } from "@hubly/application";
import { createTodoSchema } from "@hubly/contracts";
import { EspacioEstado, EspacioHoy, type CaptureInput, type EspacioNote, type EspacioTodo, type NoteSaveState } from "@hubly/ui";
import React, { useEffect, useState } from "react";
import {
  archiveNoteAction, createNoteAction, createTodoAction, createTodoFromNoteAction,
  exportWorkspaceAction, pinNoteAction, saveNoteAction, toggleTodoAction,
  type WorkspaceNote, type WorkspaceTodo, type WorkspaceTodoView,
} from "../actions";
import { signOutAction } from "../actions/auth";

export type ScreenStatus = "loading" | "unauthenticated" | "error" | "ready";
export type AutosaveState = NoteSaveState;
export interface ActionErrorState { message: string; retry: () => Promise<void>; }
export interface WorkspaceScreenProps {
  initialStatus?: ScreenStatus; errorMessage?: string; todayDate?: string; initialTimezone?: string; initialView?: WorkspaceTodoView;
  initialTodos?: WorkspaceTodo[]; initialNotes?: WorkspaceNote[]; initialActionError?: ActionErrorState | null;
  onRetry?: () => void; onLoginRedirect?: () => void; onTimezoneRefresh?: () => void; onSignOut?: () => Promise<void>;
  onSaveNote?: (note: WorkspaceNote, nextTitle: string, nextContent: string) => Promise<WorkspaceNote>;
  onCreateTodo?: (input: { title: string; priority: "low" | "medium" | "high"; dueDate: string | null; noteId: string | null }) => Promise<WorkspaceTodo>;
  onToggleTodo?: (todoId: string) => Promise<WorkspaceTodo | void>;
  onExport?: (format: "json" | "md") => Promise<{ filename: string; content: string } | void>;
}

export const TZ_REFRESH_STORAGE_KEY = "hubly_tz_refresh_attempted";

export function shouldTriggerQuickCaptureShortcut(key: string, targetTag?: string, isContentEditable?: boolean): boolean {
  if (key !== "c" && key !== "/") return false;
  const tag = (targetTag ?? "").toUpperCase();
  return tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !isContentEditable;
}

export function classifyTodoItemForView(t: WorkspaceTodo, refDate: string): WorkspaceTodoView {
  if (t.isDone) return "done";
  if (t.dueDate && t.dueDate <= refDate) return "today";
  return t.dueDate && t.dueDate > refDate ? "upcoming" : "no_date";
}

export function syncTimeZoneAndMaybeRefresh(
  browserTz: string | undefined,
  initialTimezone: string | undefined,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined,
  onRefresh: () => void,
  setCookie?: (cookie: string) => void,
): boolean {
  if (!browserTz) return false;
  setCookie?.(`hubly_tz=${encodeURIComponent(browserTz)}; path=/; max-age=31536000; SameSite=Lax`);
  if (!initialTimezone || initialTimezone === browserTz) return false;
  if (storage?.getItem(TZ_REFRESH_STORAGE_KEY) === browserTz) return false;
  storage?.setItem(TZ_REFRESH_STORAGE_KEY, browserTz);
  onRefresh();
  return true;
}

export async function executeProtectedAction(
  fallbackMsg: string, fn: () => Promise<void>, onSessionExpired: () => void, onActionError: (state: ActionErrorState | null) => void,
): Promise<void> {
  onActionError(null);
  try { await fn(); } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Sesión caducada") || msg.includes("No hay una sesión activa")) { onSessionExpired(); return; }
    // Una Server Action que llama a redirect() rechaza su promesa con un digest «NEXT_REDIRECT;…» mientras Next navega.
    // Es la sesión caducada (#92): se avisa y no se muestra como fallo.
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) { onSessionExpired(); return; }
    // En producción Next sustituye el mensaje de los errores del servidor por uno genérico en inglés y añade «digest».
    // Ese texto no ayuda a la persona: se muestra el mensaje propio de la acción (#92).
    const sanitizedByServer = typeof (err as { digest?: unknown } | null)?.digest === "string";
    onActionError({ message: sanitizedByServer || !msg ? fallbackMsg : msg, retry: () => executeProtectedAction(fallbackMsg, fn, onSessionExpired, onActionError) });
  }
}

const toEspacioTodo = (t: WorkspaceTodo): EspacioTodo => ({ id: t.id, title: t.title, detail: t.detail, priority: t.priority, dueDate: t.dueDate ?? null, isDone: t.isDone, noteId: t.noteId ?? null });
const toEspacioNote = (n: WorkspaceNote): EspacioNote => ({ id: n.id, title: n.title, content: n.content, isPinned: n.isPinned, isArchived: n.isArchived });

export function WorkspaceScreen({
  initialStatus = "ready", errorMessage = "No se pudo cargar tu espacio de trabajo.",
  todayDate = "2026-11-04", initialTimezone, initialTodos = [], initialNotes = [], initialActionError = null,
  onRetry, onLoginRedirect, onTimezoneRefresh, onSignOut, onSaveNote, onCreateTodo, onToggleTodo, onExport,
}: WorkspaceScreenProps) {
  const [todos, setTodos] = useState<WorkspaceTodo[]>(initialTodos);
  const [notes, setNotes] = useState<WorkspaceNote[]>(initialNotes);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionErrorState | null>(initialActionError);
  const [noteStatus, setNoteStatus] = useState<Record<string, NoteSaveState>>({});
  const redirectLogin = () => { if (onLoginRedirect) onLoginRedirect(); else if (typeof window !== "undefined") window.location.assign("/login"); };
  const runSafe = (fallbackMsg: string, fn: () => Promise<void>) => executeProtectedAction(fallbackMsg, fn, redirectLogin, setActionError);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof document !== "undefined" && typeof window !== "undefined") {
      syncTimeZoneAndMaybeRefresh(
        tz, initialTimezone, window.sessionStorage,
        () => { if (onTimezoneRefresh) onTimezoneRefresh(); else window.location.reload(); },
        (c) => { document.cookie = c; },
      );
    }
  }, [initialTimezone, onTimezoneRefresh]);

  if (initialStatus !== "ready") {
    if (initialStatus === "loading") return <EspacioEstado busy message="Cargando tu espacio de trabajo…" />;
    if (initialStatus === "unauthenticated") {
      return (
        <EspacioEstado
          title="Sesión caducada o sin permiso"
          message="Tu sesión ha caducado o no tienes permiso para acceder a este espacio. Inicia sesión nuevamente para continuar en Hoy."
          action={{ label: "Volver a iniciar sesión", onPress: redirectLogin }}
        />
      );
    }
    return <EspacioEstado title="No se pudo cargar Hoy" message={errorMessage} action={{ label: "Reintentar", onPress: () => { if (onRetry) onRetry(); else window.location.reload(); } }} />;
  }

  const handleCapture = async (input: CaptureInput): Promise<boolean> => {
    const parsed = createTodoSchema.safeParse({ title: input.title, priority: input.priority, dueDate: input.dueDate, noteId: input.noteId });
    if (!parsed.success) { setCaptureError(parsed.error.issues[0]?.message ?? "Datos inválidos"); return false; }
    setCaptureError(null);
    let created = false;
    await runSafe("No se pudo crear el pendiente.", async () => {
      const todo = onCreateTodo
        ? await onCreateTodo({ title: parsed.data.title, priority: parsed.data.priority, dueDate: parsed.data.dueDate ?? null, noteId: parsed.data.noteId ?? null })
        : parsed.data.noteId
          ? await createTodoFromNoteAction(parsed.data.noteId, { title: parsed.data.title, priority: parsed.data.priority, dueDate: parsed.data.dueDate ?? todayDate })
          : await createTodoAction({ title: parsed.data.title, priority: parsed.data.priority, dueDate: parsed.data.dueDate ?? null });
      setTodos((prev) => [todo, ...prev.filter((t) => t.id !== todo.id)]);
      created = true;
    });
    return created;
  };

  const handleToggleTodo = (id: string) => runSafe("No se pudo actualizar el pendiente.", async () => {
    const updated = onToggleTodo ? await onToggleTodo(id) : await toggleTodoAction(id);
    setTodos((prev) => prev.map((t) => (t.id === id ? (updated ?? { ...t, isDone: !t.isDone, doneAt: !t.isDone ? `${todayDate}T12:00:00.000Z` : null }) : t)));
  });

  const handleCreateNote = async (): Promise<string | null> => {
    let createdId: string | null = null;
    await runSafe("No se pudo crear la nota.", async () => {
      const created = await createNoteAction({ title: "Nueva nota", content: "" });
      setNotes((prev) => [created, ...prev]); setNoteStatus((prev) => ({ ...prev, [created.id]: "saved" }));
      createdId = created.id;
    });
    return createdId;
  };

  const handleSaveNote = (id: string, nextTitle: string, nextContent: string) => {
    const note = notes.find((n) => n.id === id); if (!note) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: nextTitle, content: nextContent } : n)));
    setNoteStatus((prev) => ({ ...prev, [id]: "saving" }));
    void executeProtectedAction("No se pudo guardar la nota.", async () => {
      const saved = onSaveNote ? await onSaveNote(note, nextTitle, nextContent) : await saveNoteAction({ id, title: nextTitle, content: nextContent, expectedVersion: note.version });
      setNotes((prev) => prev.map((n) => (n.id === id ? saved : n))); setNoteStatus((prev) => ({ ...prev, [id]: "saved" }));
    }, redirectLogin, (errState) => {
      if (errState) setNoteStatus((prev) => ({ ...prev, [id]: "error" }));
      setActionError(errState);
    });
  };

  const handleTogglePin = (id: string) => runSafe("No se pudo fijar la nota.", async () => {
    const target = notes.find((n) => n.id === id); if (!target) return;
    const saved = await pinNoteAction(id, !target.isPinned);
    setNotes((prev) => prev.map((n) => (n.id === id ? saved : n)));
  });

  const handleToggleArchive = (id: string) => runSafe("No se pudo archivar la nota.", async () => {
    const target = notes.find((n) => n.id === id); if (!target) return;
    const saved = await archiveNoteAction(id, !target.isArchived);
    setNotes((prev) => prev.map((n) => (n.id === id ? saved : n)));
  });

  const handleDownloadExport = (format: "json" | "md") => runSafe("No se pudo exportar tu espacio.", async () => {
    const custom = onExport ? await onExport(format) : undefined;
    const remote = custom ? undefined : await exportWorkspaceAction();
    const filename = custom?.filename ?? (format === "json" ? remote!.jsonFilename : remote!.mdFilename);
    const content = custom?.content ?? (format === "json" ? remote!.jsonContent : remote!.markdownContent);
    if (typeof document !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(new Blob([content], { type: format === "json" ? "application/json" : "text/markdown;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }
  });

  const handleSignOut = () => runSafe("No se pudo cerrar la sesión.", async () => {
    if (onSignOut) await onSignOut();
    else await signOutAction();
    redirectLogin();
  });

  return (
    <EspacioHoy
      todayDate={todayDate}
      timezone={initialTimezone}
      todos={todos.map(toEspacioTodo)}
      notes={notes.map(toEspacioNote)}
      noteSaveStates={noteStatus}
      actionError={actionError ? { message: actionError.message, onRetry: () => { void actionError.retry(); } } : null}
      captureError={captureError}
      analyzeCapture={(text) => parseQuickCapture(text, todayDate)}
      onCapture={handleCapture}
      onToggleTodo={handleToggleTodo}
      onCreateNote={handleCreateNote}
      onSaveNote={handleSaveNote}
      onTogglePin={(id) => void handleTogglePin(id)}
      onToggleArchive={(id) => void handleToggleArchive(id)}
      onExport={(format) => void handleDownloadExport(format)}
      onSignOut={() => void handleSignOut()}
    />
  );
}

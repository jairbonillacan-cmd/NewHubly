"use client";
import { createTodoSchema } from "@hubly/contracts";
import {
  Button, Card, HublySymbol, Input, NoteEditorCard, type NoteSaveStatus, QuickCaptureBar,
  type QuickCapturePayload, TextField, ThemeToggle, TodoItemCard, ViewSelector,
  WorkspaceEmptyState, tokens,
} from "@hubly/ui";
import React, { useEffect, useRef, useState } from "react";
import {
  archiveNoteAction, createNoteAction, createTodoAction, createTodoFromNoteAction,
  exportWorkspaceAction, pinNoteAction, saveNoteAction, toggleTodoAction,
  type WorkspaceNote, type WorkspaceTodo, type WorkspaceTodoView,
} from "../actions";
import { signOutAction } from "../actions/auth";

export type ScreenStatus = "loading" | "unauthenticated" | "error" | "ready";
export type AutosaveState = NoteSaveStatus;
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
const ctrlBorder = `${tokens.border.thin} solid ${tokens.color.borderControl}`, cardBorder = `${tokens.border.thin} solid ${tokens.bento.cardBorder}`;
const btnStyle = { border: ctrlBorder, borderRadius: tokens.radius.full, paddingBlock: tokens.space[1], paddingInline: tokens.space[3], backgroundColor: tokens.bento.cardBg, color: tokens.color.textPrimary, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, cursor: "pointer" } as const;
const inputStyle = { border: ctrlBorder, borderRadius: tokens.radius.md, paddingBlock: tokens.space[2], paddingInline: tokens.space[3], backgroundColor: tokens.bento.cardBg, color: tokens.color.textPrimary, fontSize: tokens.font.size.sm } as const;
const cardStyle = { backgroundColor: tokens.bento.cardBg, border: cardBorder, borderRadius: tokens.radius.xl, padding: tokens.space[5], boxShadow: tokens.bento.cardShadow, display: "flex", flexDirection: "column", gap: tokens.space[3] } as const;

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
    // En producción Next sustituye el mensaje de los errores del servidor por uno genérico en inglés y añade «digest».
    // Ese texto no ayuda a la persona: se muestra el mensaje propio de la acción (#92).
    const sanitizedByServer = typeof (err as { digest?: unknown } | null)?.digest === "string";
    onActionError({ message: sanitizedByServer || !msg ? fallbackMsg : msg, retry: () => executeProtectedAction(fallbackMsg, fn, onSessionExpired, onActionError) });
  }
}

export function WorkspaceScreen({
  initialStatus = "ready", errorMessage = "No se pudo cargar tu espacio de trabajo.",
  todayDate = "2026-11-04", initialTimezone, initialView = "today", initialTodos = [], initialNotes = [], initialActionError = null,
  onRetry, onLoginRedirect, onTimezoneRefresh, onSignOut, onSaveNote, onCreateTodo, onToggleTodo, onExport,
}: WorkspaceScreenProps) {
  const [view, setView] = useState<WorkspaceTodoView>(initialView);
  const [todos, setTodos] = useState<WorkspaceTodo[]>(initialTodos);
  const [notes, setNotes] = useState<WorkspaceNote[]>(initialNotes);
  const [captureTitle, setCaptureTitle] = useState("");
  const [capturePriority, setCapturePriority] = useState<"low" | "medium" | "high">("medium");
  const [captureDueDate, setCaptureDueDate] = useState<string | null>(null);
  const [captureNoteId, setCaptureNoteId] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionErrorState | null>(initialActionError);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [noteStatus, setNoteStatus] = useState<Record<string, NoteSaveStatus>>({});
  const captureInputRef = useRef<HTMLInputElement | null>(null);
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
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (shouldTriggerQuickCaptureShortcut(e.key, el?.tagName, el?.isContentEditable)) { e.preventDefault(); captureInputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [initialTimezone, onTimezoneRefresh]);

  if (initialStatus !== "ready") {
    const isErr = initialStatus === "error", isUnauth = initialStatus === "unauthenticated";
    return (
      <main aria-busy={initialStatus === "loading"} role={initialStatus === "loading" ? "status" : "alert"} style={{ minHeight: tokens.layout.viewportHeight, backgroundColor: tokens.bento.surfaceBase, color: tokens.color.textPrimary, padding: tokens.space[6] }}>
        <Card style={{ ...cardStyle, maxWidth: tokens.layout.readingWidth, marginInline: "auto", backgroundColor: isErr ? tokens.color.statusDangerBg : tokens.bento.cardBg, color: isErr ? tokens.color.statusDangerText : tokens.color.textPrimary, border: isErr ? ctrlBorder : cardBorder }}>
          <Card.Content style={{ display: "flex", flexDirection: "column", gap: tokens.space[3] }}>
            {initialStatus === "loading" ? <p style={{ margin: tokens.space[0], color: tokens.color.textSecondary }}>Cargando tu espacio de trabajo…</p> : (
              <>
                <h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size.xl }}>{isUnauth ? "Sesión caducada o sin permiso" : "No se pudo cargar Hoy"}</h1>
                <p style={{ margin: tokens.space[0] }}>{isUnauth ? "Tu sesión ha caducado o no tienes permiso para acceder a este espacio. Inicia sesión nuevamente para continuar en Hoy." : errorMessage}</p>
                <Button type="button" variant={isUnauth ? "primary" : "secondary"} size="sm" onPress={() => { if (isUnauth) redirectLogin(); else if (onRetry) onRetry(); else window.location.reload(); }} style={{ ...btnStyle, alignSelf: "flex-start", backgroundColor: isUnauth ? tokens.color.accentPrimary : tokens.bento.cardBg, color: isUnauth ? tokens.color.textOnAccent : tokens.color.textPrimary }}>{isUnauth ? "Volver a iniciar sesión" : "Reintentar"}</Button>
              </>
            )}
          </Card.Content>
        </Card>
      </main>
    );
  }

  const visibleTodos = todos.filter((t) => classifyTodoItemForView(t, todayDate) === view);
  const pinnedNotes = notes.filter((n) => n.isPinned && !n.isArchived);
  const q = searchQuery.trim().toLowerCase();
  const filteredNotes = notes.filter((n) => (showArchived ? true : !n.isArchived) && (!q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)));
  const linkedCaptureNote = captureNoteId ? notes.find((n) => n.id === captureNoteId) : undefined;
  const overdueCount = todos.filter((t) => !t.isDone && Boolean(t.dueDate && t.dueDate < todayDate)).length;
  const counts = {
    today: todos.filter((t) => classifyTodoItemForView(t, todayDate) === "today").length,
    upcoming: todos.filter((t) => classifyTodoItemForView(t, todayDate) === "upcoming").length,
    no_date: todos.filter((t) => classifyTodoItemForView(t, todayDate) === "no_date").length,
    done: todos.filter((t) => classifyTodoItemForView(t, todayDate) === "done").length,
  };

  const handleCaptureSubmit = async (payload: QuickCapturePayload) => {
    const resolvedDue = payload.dueDate ? payload.dueDate : view === "today" ? todayDate : null;
    const parsed = createTodoSchema.safeParse({ title: payload.title, priority: payload.priority, dueDate: resolvedDue, noteId: captureNoteId });
    if (!parsed.success) { setCaptureError(parsed.error.issues[0]?.message ?? "Datos inválidos"); return; }
    setCaptureError(null);
    await runSafe("No se pudo crear el pendiente.", async () => {
      const created = onCreateTodo
        ? await onCreateTodo({ title: parsed.data.title, priority: parsed.data.priority, dueDate: parsed.data.dueDate ?? null, noteId: parsed.data.noteId ?? null })
        : parsed.data.noteId
          ? await createTodoFromNoteAction(parsed.data.noteId, { title: parsed.data.title, priority: parsed.data.priority, dueDate: parsed.data.dueDate ?? todayDate })
          : await createTodoAction({ title: parsed.data.title, priority: parsed.data.priority, dueDate: parsed.data.dueDate ?? null });
      setTodos((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
      setCaptureTitle(""); setCaptureDueDate(null); setCaptureNoteId(null);
    });
  };

  const handleToggleTodo = (id: string) => runSafe("No se pudo actualizar el pendiente.", async () => {
    const updated = onToggleTodo ? await onToggleTodo(id) : await toggleTodoAction(id);
    setTodos((prev) => prev.map((t) => (t.id === id ? (updated ?? { ...t, isDone: !t.isDone, doneAt: !t.isDone ? `${todayDate}T12:00:00.000Z` : null }) : t)));
  });

  const handleCreateNote = () => runSafe("No se pudo crear la nota.", async () => {
    const created = await createNoteAction({ title: "Nueva nota", content: "" });
    setNotes((prev) => [created, ...prev]); setNoteStatus((prev) => ({ ...prev, [created.id]: "saved" }));
  });

  const triggerAutosave = async (note: WorkspaceNote, nextTitle: string, nextContent: string) => {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, title: nextTitle, content: nextContent } : n)));
    setNoteStatus((prev) => ({ ...prev, [note.id]: "saving" }));
    await executeProtectedAction("No se pudo guardar la nota.", async () => {
      const saved = onSaveNote ? await onSaveNote(note, nextTitle, nextContent) : await saveNoteAction({ id: note.id, title: nextTitle, content: nextContent, expectedVersion: note.version });
      setNotes((prev) => prev.map((n) => (n.id === note.id ? saved : n))); setNoteStatus((prev) => ({ ...prev, [note.id]: "saved" }));
    }, redirectLogin, (errState) => {
      if (errState) setNoteStatus((prev) => ({ ...prev, [note.id]: "error" }));
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
    <main style={{ minHeight: tokens.layout.viewportHeight, backgroundColor: tokens.bento.surfaceBase, color: tokens.color.textPrimary }}>
      <header style={{ backgroundColor: tokens.color.surfaceBrand, color: tokens.color.surfaceBrandContrast, paddingBlock: tokens.space[6], paddingInline: tokens.space[4], borderBlockEnd: `${tokens.border.thin} solid ${tokens.color.borderDefault}` }}>
        <div style={{ maxWidth: tokens.layout.workspaceWidth, marginInline: "auto", display: "flex", flexDirection: "column", gap: tokens.space[4] }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.space[3] }}>
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[1] }}>
              <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.surfaceBrandMuted, letterSpacing: tokens.font.tracking.wider, textTransform: "uppercase" }}>Espacio personal · {todayDate}</span>
              <div style={{ display: "flex", alignItems: "center", gap: tokens.space[3] }}><HublySymbol size={22} ariaLabel="Hubly" /><h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size["2xl"], fontWeight: tokens.font.weight.bold, letterSpacing: tokens.font.tracking.tight }}>Hoy — ¿Qué sigue?</h1></div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.space[2] }}>
              <Button type="button" variant="secondary" size="sm" onPress={() => void handleDownloadExport("json")} style={btnStyle}>Exportar JSON</Button>
              <Button type="button" variant="secondary" size="sm" onPress={() => void handleDownloadExport("md")} style={btnStyle}>Exportar Markdown</Button>
              <ThemeToggle />
              <Button type="button" variant="ghost" size="sm" onPress={() => void handleSignOut()} style={btnStyle}>Cerrar sesión</Button>
            </div>
          </div>
          <ViewSelector activeView={view} counts={counts} onSelectView={setView} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12" style={{ maxWidth: tokens.layout.workspaceWidth, marginInline: "auto", gap: tokens.space[6], paddingBlock: tokens.space[6], paddingInline: tokens.space[4] }}>
        {actionError && (
          <div role="alert" className="lg:col-span-12" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[3], padding: tokens.space[4], backgroundColor: tokens.color.statusDangerBg, color: tokens.color.statusDangerText, border: ctrlBorder, borderRadius: tokens.radius.lg }}>
            <span>{actionError.message}</span>
            <Button type="button" variant="secondary" size="sm" onPress={() => { void actionError.retry(); }} style={btnStyle}>Reintentar</Button>
          </div>
        )}
        <div className="lg:col-span-7 min-w-0" style={{ display: "flex", flexDirection: "column", gap: tokens.space[5] }}>
          <section aria-label="Resumen de pendientes" className="grid grid-cols-3" style={{ gap: tokens.space[3] }}>
            {[{ label: "Vencidos", value: overdueCount }, { label: "Hoy", value: counts.today }, { label: "Próximos", value: counts.upcoming }].map((stat) => (
              <Card key={stat.label} style={{ ...cardStyle, padding: tokens.space[4], gap: tokens.space[1] }}>
                <Card.Content style={{ display: "flex", flexDirection: "column", gap: tokens.space[1] }}>
                  <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.textSecondary, fontWeight: tokens.font.weight.medium }}>{stat.label}</span>
                  <strong style={{ fontSize: tokens.font.size.displayNum, fontWeight: tokens.font.weight.light, lineHeight: tokens.font.leading.tight, color: tokens.color.textPrimary }}>{stat.value}</strong>
                </Card.Content>
              </Card>
            ))}
          </section>

          <QuickCaptureBar
            title={captureTitle} priority={capturePriority} dueDate={captureDueDate}
            linkedNoteTitle={linkedCaptureNote ? linkedCaptureNote.title || "Nota sin título" : captureNoteId}
            inputRef={captureInputRef} onTitleChange={setCaptureTitle} onPriorityChange={setCapturePriority}
            onDueDateChange={setCaptureDueDate} onClearLinkedNote={() => setCaptureNoteId(null)}
            onSubmit={(payload) => void handleCaptureSubmit(payload)}
          />
          {captureError && <p role="alert" style={{ margin: tokens.space[0], fontSize: tokens.font.size.xs, color: tokens.color.statusDangerText }}>{captureError}</p>}

          <section aria-label="Lista de pendientes" style={{ display: "flex", flexDirection: "column", gap: tokens.space[3] }}>
            {visibleTodos.length === 0 ? (
              <WorkspaceEmptyState view={view} actionLabel="Capturar pendiente" onAction={() => captureInputRef.current?.focus()} />
            ) : visibleTodos.map((t) => {
              const overdue = !t.isDone && Boolean(t.dueDate && t.dueDate < todayDate);
              const originNote = t.noteId ? notes.find((n) => n.id === t.noteId) : undefined;
              return (
                <TodoItemCard
                  key={t.id} id={t.id} title={t.title} detail={t.detail} priority={t.priority} dueDate={t.dueDate ?? null}
                  isDone={t.isDone} isOverdue={overdue} isToday={!t.isDone && t.dueDate === todayDate}
                  noteId={t.noteId ?? null} noteTitle={originNote?.title ?? t.noteId ?? null} onToggle={(id) => void handleToggleTodo(id)}
                />
              );
            })}
          </section>
        </div>

        <aside className="lg:col-span-5 min-w-0" style={{ display: "flex", flexDirection: "column", gap: tokens.space[5] }}>
          <Card aria-label="Notas fijadas" style={cardStyle}>
            <Card.Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[2] }}>
              <h2 style={{ margin: tokens.space[0], fontSize: tokens.font.size.lg, fontWeight: tokens.font.weight.semibold }}>Notas fijadas</h2>
              <Button type="button" variant="primary" size="sm" onPress={() => void handleCreateNote()} style={{ ...btnStyle, backgroundColor: tokens.color.accentPrimary, color: tokens.color.textOnAccent, borderColor: tokens.color.accentPrimary }}>Nueva nota</Button>
            </Card.Header>
            <Card.Content style={{ display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
              {pinnedNotes.length === 0 ? <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}>No tienes notas fijadas. Fija una nota para tenerla siempre a mano en Hoy.</p> : pinnedNotes.map((n) => (
                <div key={n.id} style={{ padding: tokens.space[3], backgroundColor: tokens.bento.surfaceBase, border: cardBorder, borderRadius: tokens.radius.lg }}>
                  <strong style={{ display: "block", fontSize: tokens.font.size.sm }}>{n.title || "Nota sin título"}</strong>
                  <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.xs, color: tokens.color.textSecondary }}>{n.content}</p>
                </div>
              ))}
            </Card.Content>
          </Card>

          <section aria-label="Notas y exportación" style={{ display: "flex", flexDirection: "column", gap: tokens.space[4] }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.space[2], alignItems: "center", justifyContent: "space-between" }}>
              <TextField aria-label="Buscar notas" value={searchQuery} onChange={setSearchQuery} fullWidth style={{ flex: 1 }}>
                <Input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.currentTarget.value)} placeholder="Buscar notas por título o contenido…" aria-label="Buscar notas" style={{ ...inputStyle, width: "100%" }} />
              </TextField>
              <label style={{ display: "flex", alignItems: "center", gap: tokens.space[1], fontSize: tokens.font.size.xs, color: tokens.color.textSecondary }}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Archivadas</label>
            </div>

            {filteredNotes.map((n) => (
              <NoteEditorCard
                key={n.id} id={n.id} title={n.title} content={n.content} isPinned={n.isPinned} isArchived={n.isArchived}
                saveStatus={noteStatus[n.id] ?? "saved"} linkedTodos={todos.filter((t) => t.noteId === n.id).map((t) => ({ id: t.id, title: t.title, isDone: t.isDone }))}
                onTitleChange={(_, nextTitle) => void triggerAutosave(n, nextTitle, n.content)}
                onContentChange={(_, nextContent) => void triggerAutosave(n, n.title, nextContent)}
                onTogglePin={(id) => void handleTogglePin(id)}
                onToggleArchive={(id) => void handleToggleArchive(id)}
                onCreateTodoFromNote={(id) => { setCaptureNoteId(id); captureInputRef.current?.focus(); }}
                onRetrySave={() => void triggerAutosave(n, n.title, n.content)}
              />
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}

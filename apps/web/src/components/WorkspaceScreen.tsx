"use client";
import { createTodoSchema } from "@hubly/contracts";
import {
  HublySymbol, NoteEditorCard,
  type NoteSaveStatus,
  QuickCaptureBar,
  type QuickCapturePayload,
  TodoItemCard,
  ViewSelector,
  WorkspaceEmptyState,
  tokens,
} from "@hubly/ui";
import React, { useEffect, useRef, useState } from "react";
import type { WorkspaceNote, WorkspaceTodo, WorkspaceTodoView } from "../actions";

export type ScreenStatus = "loading" | "unauthenticated" | "error" | "ready";
export type AutosaveState = NoteSaveStatus;
export interface WorkspaceScreenProps {
  initialStatus?: ScreenStatus; errorMessage?: string; todayDate?: string; initialView?: WorkspaceTodoView;
  initialTodos?: WorkspaceTodo[]; initialNotes?: WorkspaceNote[]; onRetry?: () => void; onLoginRedirect?: () => void;
  onSaveNote?: (note: WorkspaceNote, nextTitle: string, nextContent: string) => Promise<WorkspaceNote>;
  onCreateTodo?: (input: { title: string; priority: "low" | "medium" | "high"; dueDate: string | null; noteId: string | null }) => Promise<WorkspaceTodo>;
  onToggleTodo?: (todoId: string) => Promise<WorkspaceTodo | void>;
  onExport?: (format: "json" | "md") => Promise<{ filename: string; content: string } | void>;
}

const ctrlBorder = `${tokens.border.thin} solid ${tokens.color.borderControl}`, cardBorder = `${tokens.border.thin} solid ${tokens.color.borderDefault}`;
const btnStyle = { border: ctrlBorder, borderRadius: tokens.radius.sm, paddingBlock: tokens.space[1], paddingInline: tokens.space[2], backgroundColor: tokens.color.surfaceSubtle, color: tokens.color.textPrimary, cursor: "pointer" } as const;
const inputStyle = { border: ctrlBorder, borderRadius: tokens.radius.sm, padding: tokens.space[2], backgroundColor: tokens.color.surfaceCanvas, color: tokens.color.textPrimary } as const;
const cardStyle = { backgroundColor: tokens.color.surfaceRaised, border: cardBorder, borderRadius: tokens.radius.md, padding: tokens.space[4], display: "flex", flexDirection: "column", gap: tokens.space[3] } as const;

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

export function WorkspaceScreen({
  initialStatus = "ready", errorMessage = "No se pudo cargar tu espacio de trabajo.",
  todayDate = "2026-11-03", initialView = "today", initialTodos = [], initialNotes = [],
  onRetry, onLoginRedirect, onSaveNote, onCreateTodo, onToggleTodo, onExport,
}: WorkspaceScreenProps) {
  const [view, setView] = useState<WorkspaceTodoView>(initialView);
  const [todos, setTodos] = useState<WorkspaceTodo[]>(initialTodos);
  const [notes, setNotes] = useState<WorkspaceNote[]>(initialNotes);
  const [captureTitle, setCaptureTitle] = useState("");
  const [capturePriority, setCapturePriority] = useState<"low" | "medium" | "high">("medium");
  const [captureDueDate, setCaptureDueDate] = useState<string | null>(null);
  const [captureNoteId, setCaptureNoteId] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [noteStatus, setNoteStatus] = useState<Record<string, NoteSaveStatus>>({});
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (shouldTriggerQuickCaptureShortcut(e.key, el?.tagName, el?.isContentEditable)) { e.preventDefault(); captureInputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (initialStatus !== "ready") {
    const isErr = initialStatus === "error", isUnauth = initialStatus === "unauthenticated";
    return (
      <main aria-busy={initialStatus === "loading"} role={initialStatus === "loading" ? "status" : "alert"} style={{ minHeight: tokens.layout.viewportHeight, backgroundColor: tokens.color.surfaceCanvas, color: tokens.color.textPrimary, padding: tokens.space[6] }}>
        <div style={{ ...cardStyle, maxWidth: tokens.layout.readingWidth, marginInline: "auto", backgroundColor: isErr ? tokens.color.statusDangerBg : tokens.color.surfaceRaised, color: isErr ? tokens.color.statusDangerText : tokens.color.textPrimary, border: isErr ? ctrlBorder : cardBorder }}>
          {initialStatus === "loading" ? <p style={{ margin: tokens.space[0], color: tokens.color.textSecondary }}>Cargando tu espacio de trabajo…</p> : (
            <>
              <h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size.xl }}>{isUnauth ? "Sesión caducada o sin permiso" : "No se pudo cargar Hoy"}</h1>
              <p style={{ margin: tokens.space[0] }}>{isUnauth ? "Tu sesión ha caducado o no tienes permiso para acceder a este espacio. Inicia sesión nuevamente para continuar en Hoy." : errorMessage}</p>
              <button type="button" onClick={isUnauth ? onLoginRedirect : onRetry} style={{ ...btnStyle, alignSelf: "flex-start", backgroundColor: isUnauth ? tokens.color.accentPrimary : tokens.color.surfaceRaised, color: isUnauth ? tokens.color.textOnAccent : tokens.color.textPrimary }}>{isUnauth ? "Volver a iniciar sesión" : "Reintentar"}</button>
            </>
          )}
        </div>
      </main>
    );
  }

  const visibleTodos = todos.filter((t) => classifyTodoItemForView(t, todayDate) === view);
  const pinnedNotes = notes.filter((n) => n.isPinned && !n.isArchived);
  const q = searchQuery.trim().toLowerCase();
  const filteredNotes = notes.filter((n) => (showArchived ? true : !n.isArchived) && (!q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)));
  const linkedCaptureNote = captureNoteId ? notes.find((n) => n.id === captureNoteId) : undefined;
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
    const created: WorkspaceTodo = onCreateTodo
      ? await onCreateTodo({ title: parsed.data.title, priority: parsed.data.priority, dueDate: parsed.data.dueDate ?? null, noteId: parsed.data.noteId ?? null })
      : { id: `todo-${todos.length + 1}`, workspaceId: "w-local", createdBy: "u-local", noteId: parsed.data.noteId ?? null, title: parsed.data.title, detail: "", dueDate: parsed.data.dueDate ?? null, priority: parsed.data.priority, isDone: false, doneAt: null, createdAt: `${todayDate}T10:00:00.000Z`, updatedAt: `${todayDate}T10:00:00.000Z` };
    setTodos((prev) => [created, ...prev]); setCaptureTitle(""); setCaptureDueDate(null); setCaptureNoteId(null);
  };

  const handleToggleTodo = async (id: string) => {
    await onToggleTodo?.(id);
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, isDone: !t.isDone, doneAt: !t.isDone ? `${todayDate}T12:00:00.000Z` : null } : t)));
  };

  const triggerAutosave = async (note: WorkspaceNote, nextTitle: string, nextContent: string) => {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, title: nextTitle, content: nextContent } : n)));
    setNoteStatus((prev) => ({ ...prev, [note.id]: "saving" }));
    try {
      const saved = onSaveNote ? await onSaveNote(note, nextTitle, nextContent) : { ...note, title: nextTitle, content: nextContent, version: note.version + 1 };
      setNotes((prev) => prev.map((n) => (n.id === note.id ? saved : n)));
      setNoteStatus((prev) => ({ ...prev, [note.id]: "saved" }));
    } catch { setNoteStatus((prev) => ({ ...prev, [note.id]: "error" })); }
  };

  const handleDownloadExport = async (format: "json" | "md") => {
    const custom = await onExport?.(format);
    const filename = custom?.filename ?? `hubly-export-${todayDate}.${format}`;
    const content = custom?.content ?? (format === "json" ? JSON.stringify({ version: 1, exportedAt: `${todayDate}T12:00:00.000Z`, notes, todos }, null, 2) : `# Exportación de datos\n\n# Notas\n${notes.map((n) => `## ${n.title}\n${n.content}`).join("\n\n")}\n\n# Pendientes\n${todos.map((t) => `- [${t.isDone ? "x" : " "}] ${t.title}`).join("\n")}\n`);
    if (typeof document !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(new Blob([content], { type: format === "json" ? "application/json" : "text/markdown;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }
  };

  return (
    <main style={{ minHeight: tokens.layout.viewportHeight, backgroundColor: tokens.color.surfaceCanvas, color: tokens.color.textPrimary, paddingBlock: tokens.space[6], paddingInline: tokens.space[4] }}>
      <div className="grid grid-cols-1 lg:grid-cols-12" style={{ maxWidth: tokens.layout.workspaceWidth, marginInline: "auto", gap: tokens.space[6] }}>
        <div className="lg:col-span-7 min-w-0" style={{ display: "flex", flexDirection: "column", gap: tokens.space[5] }}>
          <header style={{ display: "flex", flexDirection: "column", gap: tokens.space[3] }}>
            <div style={{ display: "flex", alignItems: "center", gap: tokens.space[3] }}><HublySymbol size={22} ariaLabel="Hubly" /><h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size["2xl"], fontWeight: tokens.font.weight.semibold }}>Hoy — ¿Qué sigue?</h1></div>
            <ViewSelector activeView={view} counts={counts} onSelectView={setView} />
          </header>

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
          <section aria-label="Notas fijadas" style={cardStyle}>
            <h2 style={{ margin: tokens.space[0], fontSize: tokens.font.size.lg, fontWeight: tokens.font.weight.semibold }}>Notas fijadas</h2>
            {pinnedNotes.length === 0 ? <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}>No tienes notas fijadas. Fija una nota para tenerla siempre a mano en Hoy.</p> : pinnedNotes.map((n) => (
              <div key={n.id} style={{ padding: tokens.space[3], backgroundColor: tokens.color.surfaceSubtle, borderRadius: tokens.radius.sm }}>
                <strong style={{ display: "block", fontSize: tokens.font.size.sm }}>{n.title || "Nota sin título"}</strong>
                <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.xs, color: tokens.color.textSecondary }}>{n.content}</p>
              </div>
            ))}
          </section>

          <section aria-label="Notas y exportación" style={{ display: "flex", flexDirection: "column", gap: tokens.space[4] }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.space[2], alignItems: "center", justifyContent: "space-between" }}>
              <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar notas por título o contenido…" aria-label="Buscar notas" style={{ ...inputStyle, flex: 1, backgroundColor: tokens.color.surfaceRaised }} />
              <label style={{ display: "flex", alignItems: "center", gap: tokens.space[1], fontSize: tokens.font.size.xs }}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Archivadas</label>
            </div>

            {filteredNotes.map((n) => (
              <NoteEditorCard
                key={n.id} id={n.id} title={n.title} content={n.content} isPinned={n.isPinned} isArchived={n.isArchived}
                saveStatus={noteStatus[n.id] ?? "saved"} linkedTodos={todos.filter((t) => t.noteId === n.id).map((t) => ({ id: t.id, title: t.title, isDone: t.isDone }))}
                onTitleChange={(_, nextTitle) => void triggerAutosave(n, nextTitle, n.content)}
                onContentChange={(_, nextContent) => void triggerAutosave(n, n.title, nextContent)}
                onTogglePin={(id) => setNotes((prev) => prev.map((item) => (item.id === id ? { ...item, isPinned: !item.isPinned } : item)))}
                onToggleArchive={(id) => setNotes((prev) => prev.map((item) => (item.id === id ? { ...item, isArchived: !item.isArchived } : item)))}
                onCreateTodoFromNote={(id) => { setCaptureNoteId(id); captureInputRef.current?.focus(); }}
                onRetrySave={() => void triggerAutosave(n, n.title, n.content)}
              />
            ))}

            <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.space[2], paddingTop: tokens.space[2], borderTop: cardBorder }}>
              <button type="button" onClick={() => void handleDownloadExport("json")} style={{ ...btnStyle, backgroundColor: tokens.color.surfaceRaised }}>Exportar JSON</button>
              <button type="button" onClick={() => void handleDownloadExport("md")} style={{ ...btnStyle, backgroundColor: tokens.color.surfaceRaised }}>Exportar Markdown</button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

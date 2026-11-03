import { buttonVariants, cardVariants } from "@heroui/react";
import { tokens } from "../../tokens";

export type NoteSaveStatus = "saving" | "saved" | "error";
export interface LinkedTodoSummary { id: string; title: string; isDone: boolean; }
export interface NoteEditorCardProps {
  id: string; title: string; content: string; isPinned: boolean; isArchived: boolean;
  saveStatus: NoteSaveStatus; linkedTodos?: readonly LinkedTodoSummary[];
  onTitleChange?: (id: string, title: string) => void; onContentChange?: (id: string, content: string) => void;
  onTogglePin?: (id: string) => void; onToggleArchive?: (id: string) => void;
  onCreateTodoFromNote?: (id: string) => void; onRetrySave?: (id: string) => void;
}

const SAVE_STATUS_META: Record<NoteSaveStatus, { text: string; bg: string; color: string }> = {
  saving: { text: "Guardando…", bg: tokens.color.surfaceSubtle, color: tokens.color.textSecondary },
  saved: { text: "Guardado", bg: tokens.color.statusSuccessBg, color: tokens.color.statusSuccessText },
  error: { text: "No se pudo guardar · Reintentar", bg: tokens.color.statusDangerBg, color: tokens.color.statusDangerText },
};

export function NoteEditorCard({
  id, title, content, isPinned, isArchived, saveStatus, linkedTodos = [],
  onTitleChange, onContentChange, onTogglePin, onToggleArchive, onCreateTodoFromNote, onRetrySave,
}: NoteEditorCardProps) {
  const statusMeta = SAVE_STATUS_META[saveStatus];
  const controlStyle = {
    border: `${tokens.border.thin} solid ${tokens.color.borderControl}`, borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surfaceRaised, color: tokens.color.textPrimary,
    paddingBlock: tokens.space[2], paddingInline: tokens.space[3], fontSize: tokens.font.size.sm,
  } as const;

  return (
    <section
      id={`nota-${id}`} aria-label={`Editor de nota ${title || "sin título"}`} className={cardVariants().base()}
      style={{ display: "flex", flexDirection: "column", gap: tokens.space[3], padding: tokens.space[4], backgroundColor: tokens.color.surfaceRaised, border: `${tokens.border.thin} solid ${tokens.color.borderDefault}`, borderRadius: tokens.radius.lg }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[2], flexWrap: "wrap" }}>
        <div role="status" aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2], backgroundColor: statusMeta.bg, color: statusMeta.color, paddingInline: tokens.space[2], paddingBlock: tokens.space[1], borderRadius: tokens.radius.sm, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.medium }}>
          <span>{statusMeta.text}</span>
          {saveStatus === "error" ? (
            <button type="button" onClick={() => onRetrySave?.(id)} aria-label="Reintentar guardado de nota" style={controlStyle}>Reintentar</button>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2], flexWrap: "wrap" }}>
          <button type="button" aria-pressed={isPinned} aria-label={isPinned ? "Desfijar nota" : "Fijar nota"} onClick={() => onTogglePin?.(id)} className={buttonVariants({ variant: "secondary", size: "sm" })} style={controlStyle}>
            {isPinned ? "Desfijar" : "Fijar"}
          </button>
          <button type="button" aria-pressed={isArchived} aria-label={isArchived ? "Restaurar nota" : "Archivar nota"} onClick={() => onToggleArchive?.(id)} className={buttonVariants({ variant: "secondary", size: "sm" })} style={controlStyle}>
            {isArchived ? "Restaurar" : "Archivar"}
          </button>
          <button type="button" onClick={() => onCreateTodoFromNote?.(id)} className={buttonVariants({ variant: "primary", size: "sm" })} style={controlStyle}>
            Crear pendiente desde esta nota
          </button>
        </div>
      </header>
      <input
        type="text" aria-label="Título de la nota" value={title} placeholder="Título de la nota"
        onChange={(e) => onTitleChange?.(id, e.currentTarget.value)}
        style={{ ...controlStyle, fontSize: tokens.font.size.base, fontWeight: tokens.font.weight.semibold }}
      />
      <textarea
        aria-label="Contenido de la nota" value={content} rows={4} placeholder="Escribe tu nota con formato simple…"
        onChange={(e) => onContentChange?.(id, e.currentTarget.value)}
        style={{ ...controlStyle, fontFamily: tokens.font.sans, lineHeight: tokens.font.leading.relaxed }}
      />
      {linkedTodos.length > 0 ? (
        <div style={{ borderBlockStart: `${tokens.border.thin} solid ${tokens.color.borderSubtle}`, paddingBlockStart: tokens.space[2] }}>
          <p style={{ marginBlock: tokens.space[1], fontSize: tokens.font.size.xs, color: tokens.color.textSecondary }}>Pendientes derivados ({linkedTodos.length})</p>
          <ul style={{ margin: tokens.space[0], paddingInlineStart: tokens.space[4], fontSize: tokens.font.size.sm }}>
            {linkedTodos.map((todo) => (
              <li key={todo.id} style={{ color: todo.isDone ? tokens.color.textMuted : tokens.color.textPrimary }}>
                {todo.title} · {todo.isDone ? "Hecho" : "Pendiente"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

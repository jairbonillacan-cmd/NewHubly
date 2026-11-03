import { cardVariants, chipVariants } from "@heroui/react";
import type { KeyboardEvent } from "react";
import { tokens } from "../../tokens";
import type { TodoPriorityValue } from "./QuickCaptureBar";

export interface TodoItemCardProps {
  id: string; title: string; detail?: string; priority: TodoPriorityValue; dueDate?: string | null;
  isDone: boolean; isOverdue?: boolean; isToday?: boolean;
  noteId?: string | null; noteTitle?: string | null; noteHref?: string;
  onToggle?: (id: string) => void; onSelectNote?: (noteId: string) => void;
}

const PRIORITY_STYLE: Record<TodoPriorityValue, { label: string; bg: string; color: string }> = {
  low: { label: "Baja", bg: tokens.color.surfaceSubtle, color: tokens.color.textSecondary },
  medium: { label: "Media", bg: tokens.color.statusWarningBg, color: tokens.color.statusWarningText },
  high: { label: "Alta", bg: tokens.color.statusDangerBg, color: tokens.color.statusDangerText },
};

export function TodoItemCard({
  id, title, detail = "", priority, dueDate = null, isDone,
  isOverdue = false, isToday = false, noteId = null, noteTitle = null, noteHref, onToggle, onSelectNote,
}: TodoItemCardProps) {
  const priorityMeta = PRIORITY_STYLE[priority];
  const handleCheckboxKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " " || e.key === "Spacebar") { e.preventDefault?.(); onToggle?.(id); }
  };

  return (
    <article
      className={cardVariants().base()}
      style={{ display: "flex", flexDirection: "column", gap: tokens.space[2], padding: tokens.space[3], backgroundColor: tokens.color.surfaceRaised, border: `${tokens.border.thin} solid ${tokens.color.borderDefault}`, borderRadius: tokens.radius.md }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[3], flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: tokens.space[2], cursor: "pointer", flex: "1 1 auto" }}>
          <input
            type="checkbox" role="checkbox" checked={isDone} aria-checked={isDone}
            aria-label={`Marcar "${title}" como ${isDone ? "pendiente" : "hecho"}`}
            onChange={() => onToggle?.(id)} onKeyDown={handleCheckboxKeyDown}
            style={{ accentColor: tokens.color.accentPrimary, border: `${tokens.border.thin} solid ${tokens.color.borderControl}` }}
          />
          <span style={{ fontWeight: tokens.font.weight.medium, color: isDone ? tokens.color.textMuted : tokens.color.textPrimary, textDecoration: isDone ? "line-through" : "none" }}>
            {title}
          </span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2], flexWrap: "wrap" }}>
          <span className={chipVariants().base()} style={{ backgroundColor: priorityMeta.bg, color: priorityMeta.color, paddingInline: tokens.space[2], paddingBlock: tokens.space[1], borderRadius: tokens.radius.sm, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.medium }}>
            Prioridad: {priorityMeta.label}
          </span>
          {dueDate ? (
            <span style={{ backgroundColor: isOverdue ? tokens.color.statusDangerBg : isToday ? tokens.color.accentWarmSubtle : tokens.color.surfaceSubtle, color: isOverdue ? tokens.color.statusDangerText : isToday ? tokens.color.accentWarmText : tokens.color.textSecondary, paddingInline: tokens.space[2], paddingBlock: tokens.space[1], borderRadius: tokens.radius.sm, fontSize: tokens.font.size.xs }}>
              {isOverdue ? `Vencido · ${dueDate}` : isToday ? `Hoy · ${dueDate}` : dueDate}
            </span>
          ) : null}
        </div>
      </div>
      {detail ? (
        <details style={{ fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}>
          <summary style={{ cursor: "pointer", color: tokens.color.textSecondary }}>Ver detalle</summary>
          <p style={{ marginBlockStart: tokens.space[1], marginBlockEnd: tokens.space[0] }}>{detail}</p>
        </details>
      ) : null}
      {noteId ? (
        <a
          href={noteHref ?? `#nota-${noteId}`}
          onClick={(e) => { if (onSelectNote) { e.preventDefault?.(); onSelectNote(noteId); } }}
          style={{ fontSize: tokens.font.size.xs, color: tokens.color.accentPrimary, textDecoration: "underline", alignSelf: "flex-start" }}
        >
          Nota de origen: {noteTitle ?? "Ver nota vinculada"}
        </a>
      ) : null}
    </article>
  );
}

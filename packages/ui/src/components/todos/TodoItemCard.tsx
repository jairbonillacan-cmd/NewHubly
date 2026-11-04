"use client";
import { Card, Checkbox, Chip } from "@heroui/react";
import { tokens } from "../../tokens";
import type { TodoPriorityValue } from "./QuickCaptureBar";

export interface TodoItemCardProps {
  id: string; title: string; detail?: string; priority: TodoPriorityValue; dueDate?: string | null;
  isDone: boolean; isOverdue?: boolean; isToday?: boolean;
  noteId?: string | null; noteTitle?: string | null; noteHref?: string;
  onToggle?: (id: string) => void; onSelectNote?: (noteId: string) => void;
}

const PRIORITY_STYLE: Record<TodoPriorityValue, { label: string; bg: string; color: string }> = {
  low: { label: "Baja", bg: tokens.bento.surfaceBase, color: tokens.color.textSecondary },
  medium: { label: "Media", bg: tokens.color.statusWarningBg, color: tokens.color.statusWarningText },
  high: { label: "Alta", bg: tokens.color.statusDangerBg, color: tokens.color.statusDangerText },
};

export function TodoItemCard({
  id, title, detail = "", priority, dueDate = null, isDone,
  isOverdue = false, isToday = false, noteId = null, noteTitle = null, noteHref, onToggle, onSelectNote,
}: TodoItemCardProps) {
  const priorityMeta = PRIORITY_STYLE[priority];

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: tokens.space[2], padding: tokens.space[4], backgroundColor: tokens.bento.cardBg, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, borderRadius: tokens.radius.xl, boxShadow: tokens.bento.cardShadow }}>
      <Card.Content style={{ display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[3], flexWrap: "wrap" }}>
          <Checkbox
            isSelected={isDone} onChange={() => onToggle?.(id)}
            aria-label={`Marcar "${title}" como ${isDone ? "pendiente" : "hecho"}`}
            style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2], flex: "1 1 auto" }}
          >
            <Checkbox.Content style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2], cursor: "pointer" }}>
              <Checkbox.Control style={{ border: `${tokens.border.thin} solid ${tokens.color.borderControl}`, borderRadius: tokens.radius.sm, backgroundColor: isDone ? tokens.color.accentPrimary : tokens.bento.surfaceBase, color: tokens.color.textOnAccent }}>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <span style={{ fontWeight: tokens.font.weight.medium, color: isDone ? tokens.color.textMuted : tokens.color.textPrimary, textDecoration: isDone ? "line-through" : "none" }}>
                {title}
              </span>
            </Checkbox.Content>
          </Checkbox>
          <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2], flexWrap: "wrap" }}>
            <Chip size="sm" variant="soft" style={{ backgroundColor: priorityMeta.bg, color: priorityMeta.color, paddingInline: tokens.space[3], paddingBlock: tokens.space[1], borderRadius: tokens.radius.full, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold }}>
              Prioridad: {priorityMeta.label}
            </Chip>
            {dueDate ? (
              <Chip size="sm" variant="soft" style={{ backgroundColor: isOverdue ? tokens.color.statusDangerBg : isToday ? tokens.color.accentPrimarySubtle : tokens.bento.surfaceBase, color: isOverdue ? tokens.color.statusDangerText : isToday ? tokens.color.accentPrimary : tokens.color.textSecondary, paddingInline: tokens.space[3], paddingBlock: tokens.space[1], borderRadius: tokens.radius.full, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.medium }}>
                {isOverdue ? `Vencido · ${dueDate}` : isToday ? `Hoy · ${dueDate}` : dueDate}
              </Chip>
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
            style={{ fontSize: tokens.font.size.xs, color: tokens.color.accentPrimary, fontWeight: tokens.font.weight.semibold, textDecoration: "underline", alignSelf: "flex-start" }}
          >
            Nota de origen: {noteTitle ?? "Ver nota vinculada"}
          </a>
        ) : null}
      </Card.Content>
    </Card>
  );
}

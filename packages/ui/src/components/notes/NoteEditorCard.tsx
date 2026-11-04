"use client";
import { Button, Card, Chip, Input, TextArea, TextField } from "@heroui/react";
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
  saving: { text: "Guardando…", bg: tokens.bento.surfaceBase, color: tokens.color.textSecondary },
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
    backgroundColor: tokens.bento.surfaceBase, color: tokens.color.textPrimary,
    paddingBlock: tokens.space[2], paddingInline: tokens.space[3], fontSize: tokens.font.size.sm,
  } as const;

  return (
    <Card id={`nota-${id}`} aria-label={`Editor de nota ${title || "sin título"}`} style={{ display: "flex", flexDirection: "column", gap: tokens.space[3], padding: tokens.space[5], backgroundColor: tokens.bento.cardBg, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, borderRadius: tokens.radius.xl, boxShadow: tokens.bento.cardShadow }}>
      <Card.Header style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space[2], flexWrap: "wrap" }}>
        <div role="status" aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2] }}>
          <Chip size="sm" variant="soft" style={{ backgroundColor: statusMeta.bg, color: statusMeta.color, paddingInline: tokens.space[3], paddingBlock: tokens.space[1], borderRadius: tokens.radius.full, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold }}>
            {statusMeta.text}
          </Chip>
          {saveStatus === "error" ? (
            <Button type="button" variant="secondary" size="sm" onPress={() => onRetrySave?.(id)} onClick={() => onRetrySave?.(id)} aria-label="Reintentar guardado de nota" style={controlStyle}>Reintentar</Button>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2], flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" size="sm" aria-pressed={isPinned} aria-label={isPinned ? "Desfijar nota" : "Fijar nota"} onPress={() => onTogglePin?.(id)} onClick={() => onTogglePin?.(id)} style={controlStyle}>
            {isPinned ? "Desfijar" : "Fijar"}
          </Button>
          <Button type="button" variant="secondary" size="sm" aria-pressed={isArchived} aria-label={isArchived ? "Restaurar nota" : "Archivar nota"} onPress={() => onToggleArchive?.(id)} onClick={() => onToggleArchive?.(id)} style={controlStyle}>
            {isArchived ? "Restaurar" : "Archivar"}
          </Button>
          <Button type="button" variant="primary" size="sm" onPress={() => onCreateTodoFromNote?.(id)} onClick={() => onCreateTodoFromNote?.(id)} style={{ ...controlStyle, backgroundColor: tokens.color.accentPrimary, color: tokens.color.textOnAccent, borderColor: tokens.color.accentPrimary, borderRadius: tokens.radius.full, paddingInline: tokens.space[4], fontWeight: tokens.font.weight.semibold, cursor: "pointer" }}>
            Crear pendiente desde esta nota
          </Button>
        </div>
      </Card.Header>
      <Card.Content style={{ display: "flex", flexDirection: "column", gap: tokens.space[3] }}>
        <TextField aria-label="Título de la nota" value={title} onChange={(val) => onTitleChange?.(id, val)} fullWidth>
          <Input type="text" aria-label="Título de la nota" value={title} placeholder="Título de la nota" onChange={(e) => onTitleChange?.(id, e.currentTarget.value)} style={{ ...controlStyle, fontSize: tokens.font.size.base, fontWeight: tokens.font.weight.semibold, width: "100%" }} />
        </TextField>
        <TextField aria-label="Contenido de la nota" value={content} onChange={(val) => onContentChange?.(id, val)} fullWidth>
          <TextArea aria-label="Contenido de la nota" value={content} rows={4} placeholder="Escribe tu nota con formato simple…" onChange={(e) => onContentChange?.(id, e.currentTarget.value)} style={{ ...controlStyle, fontFamily: tokens.font.sans, lineHeight: tokens.font.leading.relaxed, width: "100%" }} />
        </TextField>
      </Card.Content>
      {linkedTodos.length > 0 ? (
        <Card.Footer style={{ borderBlockStart: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, paddingBlockStart: tokens.space[3], display: "flex", flexDirection: "column", gap: tokens.space[1] }}>
          <p style={{ marginBlock: tokens.space[0], fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, color: tokens.color.textSecondary }}>Pendientes derivados ({linkedTodos.length})</p>
          <ul style={{ margin: tokens.space[0], paddingInlineStart: tokens.space[4], fontSize: tokens.font.size.sm }}>
            {linkedTodos.map((todo) => (
              <li key={todo.id} style={{ color: todo.isDone ? tokens.color.textMuted : tokens.color.textPrimary }}>
                {todo.title} · {todo.isDone ? "Hecho" : "Pendiente"}
              </li>
            ))}
          </ul>
        </Card.Footer>
      ) : null}
    </Card>
  );
}

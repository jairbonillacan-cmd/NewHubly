"use client";
import { Button, Card, Input, Kbd, TextField } from "@heroui/react";
import type { FormEvent, KeyboardEvent, Ref } from "react";
import { tokens } from "../../tokens";

export type TodoPriorityValue = "low" | "medium" | "high";
export interface QuickCapturePayload { title: string; priority: TodoPriorityValue; dueDate: string | null; }
export interface QuickCaptureBarProps {
  title?: string; priority?: TodoPriorityValue; dueDate?: string | null; linkedNoteTitle?: string | null;
  inputId?: string; inputRef?: Ref<HTMLInputElement>;
  onTitleChange?: (value: string) => void; onPriorityChange?: (priority: TodoPriorityValue) => void;
  onDueDateChange?: (dueDate: string | null) => void; onClearLinkedNote?: () => void;
  onSubmit?: (payload: QuickCapturePayload) => void;
}

export function QuickCaptureBar({
  title = "", priority = "medium", dueDate = null, linkedNoteTitle = null,
  inputId = "hubly-quick-capture-input", inputRef,
  onTitleChange, onPriorityChange, onDueDateChange, onClearLinkedNote, onSubmit,
}: QuickCaptureBarProps) {
  const triggerSubmit = () => {
    const trimmed = title.trim();
    if (trimmed) onSubmit?.({ title: trimmed, priority, dueDate: dueDate || null });
  };
  const handleFormSubmit = (e?: FormEvent<HTMLFormElement>) => { e?.preventDefault?.(); triggerSubmit(); };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault?.(); triggerSubmit(); }
  };
  const controlStyle = {
    border: `${tokens.border.thin} solid ${tokens.color.borderControl}`, borderRadius: tokens.radius.md,
    backgroundColor: tokens.bento.cardBg, color: tokens.color.textPrimary,
    paddingBlock: tokens.space[2], paddingInline: tokens.space[3], fontSize: tokens.font.size.sm,
  } as const;

  return (
    <Card variant="transparent" className="glass-panel" style={{ padding: tokens.space[4], backgroundColor: tokens.glass.bg, border: `${tokens.border.thin} solid ${tokens.color.borderControl}`, borderRadius: tokens.radius.xl, boxShadow: tokens.glass.shadow }}>
      <Card.Content>
        <form aria-label="Captura rápida de pendiente" onSubmit={handleFormSubmit} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.space[2] }}>
          <Kbd aria-hidden="true" style={{ backgroundColor: tokens.bento.cardBg, color: tokens.color.accentPrimary, border: `${tokens.border.thin} solid ${tokens.color.borderControl}`, borderRadius: tokens.radius.sm, paddingInline: tokens.space[2], paddingBlock: tokens.space[1], fontSize: tokens.font.size.xs }}>
            <Kbd.Content>c /</Kbd.Content>
          </Kbd>
          <TextField aria-label="Capturar pendiente rápido" value={title} onChange={(val) => onTitleChange?.(val)} fullWidth style={{ flex: "1 1 auto" }}>
            <Input
              ref={inputRef} id={inputId} type="text" value={title}
              aria-label="Capturar pendiente rápido" placeholder="Capturar pendiente rápido… [Enter]"
              onChange={(e) => onTitleChange?.(e.currentTarget.value)} onKeyDown={handleKeyDown}
              style={{ ...controlStyle, width: "100%" }}
            />
          </TextField>
          <select aria-label="Prioridad del pendiente" value={priority} onChange={(e) => onPriorityChange?.(e.currentTarget.value as TodoPriorityValue)} style={controlStyle}>
            <option value="low">Prioridad baja</option>
            <option value="medium">Prioridad media</option>
            <option value="high">Prioridad alta</option>
          </select>
          <input type="date" aria-label="Fecha límite opcional" value={dueDate ?? ""} onChange={(e) => onDueDateChange?.(e.currentTarget.value || null)} style={controlStyle} />
          {linkedNoteTitle ? (
            <Button type="button" variant="secondary" size="sm" onPress={() => onClearLinkedNote?.()} onClick={() => onClearLinkedNote?.()} aria-label={`Quitar vínculo con nota ${linkedNoteTitle}`} style={controlStyle}>Nota: {linkedNoteTitle} ×</Button>
          ) : null}
          <Button type="submit" variant="primary" size="sm" onPress={triggerSubmit} style={{ ...controlStyle, backgroundColor: tokens.color.accentPrimary, color: tokens.color.textOnAccent, borderColor: tokens.color.accentPrimary, borderRadius: tokens.radius.full, paddingInline: tokens.space[4], fontWeight: tokens.font.weight.semibold, cursor: "pointer" }}>Guardar</Button>
        </form>
      </Card.Content>
    </Card>
  );
}

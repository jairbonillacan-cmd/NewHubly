import { buttonVariants, kbdVariants } from "@heroui/react";
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
    backgroundColor: tokens.color.surfaceRaised, color: tokens.color.textPrimary,
    paddingBlock: tokens.space[2], paddingInline: tokens.space[3], fontSize: tokens.font.size.sm,
  } as const;

  return (
    <form
      aria-label="Captura rápida de pendiente" onSubmit={handleFormSubmit}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.space[2], padding: tokens.space[3], backgroundColor: tokens.color.surfaceRaised, border: `${tokens.border.thin} solid ${tokens.color.borderControl}`, borderRadius: tokens.radius.lg }}
    >
      <span className={kbdVariants().base()} aria-hidden="true" style={{ fontSize: tokens.font.size.xs, color: tokens.color.textSecondary }}>c /</span>
      <input
        ref={inputRef} id={inputId} type="text" value={title}
        aria-label="Capturar pendiente rápido" placeholder="Capturar pendiente rápido… [Enter]"
        onChange={(e) => onTitleChange?.(e.currentTarget.value)} onKeyDown={handleKeyDown}
        style={{ ...controlStyle, flex: "1 1 auto" }}
      />
      <select aria-label="Prioridad del pendiente" value={priority} onChange={(e) => onPriorityChange?.(e.currentTarget.value as TodoPriorityValue)} style={controlStyle}>
        <option value="low">Prioridad baja</option>
        <option value="medium">Prioridad media</option>
        <option value="high">Prioridad alta</option>
      </select>
      <input type="date" aria-label="Fecha límite opcional" value={dueDate ?? ""} onChange={(e) => onDueDateChange?.(e.currentTarget.value || null)} style={controlStyle} />
      {linkedNoteTitle ? (
        <button type="button" onClick={onClearLinkedNote} aria-label={`Quitar vínculo con nota ${linkedNoteTitle}`} style={controlStyle}>Nota: {linkedNoteTitle} ×</button>
      ) : null}
      <button type="submit" className={buttonVariants({ variant: "primary", size: "sm" })} style={controlStyle}>Guardar</button>
    </form>
  );
}

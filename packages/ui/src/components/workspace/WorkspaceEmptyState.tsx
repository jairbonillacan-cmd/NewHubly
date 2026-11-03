import { EmptyState } from "@heroui/react";
import { tokens } from "../../tokens";
import type { TodoViewKey } from "./ViewSelector";

export const WORKSPACE_EMPTY_MESSAGES: Record<TodoViewKey, string> = {
  today: "No tienes pendientes para hoy. Escribe arriba para capturar el primero o revisa Sin fecha.",
  upcoming: "No tienes pendientes programados para los próximos días.",
  no_date: "Todos tus pendientes tienen fecha asignada.",
  done: "Aún no has completado ningún pendiente.",
};
export interface WorkspaceEmptyStateProps { view: TodoViewKey; actionLabel?: string; onAction?: () => void; }

export function WorkspaceEmptyState({ view, actionLabel, onAction }: WorkspaceEmptyStateProps) {
  return (
    <EmptyState
      role="status" aria-live="polite"
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.space[2], padding: tokens.space[5], backgroundColor: tokens.color.surfaceSubtle, border: `${tokens.border.thin} solid ${tokens.color.borderDefault}`, borderRadius: tokens.radius.lg, color: tokens.color.textSecondary, fontSize: tokens.font.size.sm }}
    >
      <p style={{ margin: tokens.space[0], color: tokens.color.textPrimary, fontWeight: tokens.font.weight.medium }}>{WORKSPACE_EMPTY_MESSAGES[view]}</p>
      {actionLabel && onAction ? (
        <button
          type="button" onClick={onAction}
          style={{ border: `${tokens.border.thin} solid ${tokens.color.borderControl}`, borderRadius: tokens.radius.md, backgroundColor: tokens.color.surfaceRaised, color: tokens.color.textPrimary, paddingBlock: tokens.space[1], paddingInline: tokens.space[3], fontSize: tokens.font.size.xs, cursor: "pointer" }}
        >
          {actionLabel}
        </button>
      ) : null}
    </EmptyState>
  );
}

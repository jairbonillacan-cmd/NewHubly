"use client";
import { Button, EmptyState } from "@heroui/react";
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
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.space[3], padding: tokens.space[6], backgroundColor: tokens.bento.cardBg, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, borderRadius: tokens.radius.xl, boxShadow: tokens.bento.cardShadow, color: tokens.color.textSecondary, fontSize: tokens.font.size.sm }}
    >
      <p style={{ margin: tokens.space[0], color: tokens.color.textPrimary, fontWeight: tokens.font.weight.medium }}>{WORKSPACE_EMPTY_MESSAGES[view]}</p>
      {actionLabel && onAction ? (
        <Button
          type="button" variant="primary" size="sm" onPress={() => onAction()} onClick={() => onAction()}
          style={{ border: `${tokens.border.thin} solid ${tokens.color.accentPrimary}`, borderRadius: tokens.radius.full, backgroundColor: tokens.color.accentPrimary, color: tokens.color.textOnAccent, paddingBlock: tokens.space[2], paddingInline: tokens.space[4], fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, cursor: "pointer" }}
        >
          {actionLabel}
        </Button>
      ) : null}
    </EmptyState>
  );
}

import { buttonVariants } from "@heroui/react";
import type { KeyboardEvent } from "react";
import { tokens } from "../../tokens";

export type TodoViewKey = "today" | "upcoming" | "no_date" | "done";
export const TODO_VIEW_ITEMS: ReadonlyArray<{ key: TodoViewKey; label: string }> = [
  { key: "today", label: "Hoy" },
  { key: "upcoming", label: "Próximos" },
  { key: "no_date", label: "Sin fecha" },
  { key: "done", label: "Hechos" },
];
export interface ViewSelectorProps {
  activeView: TodoViewKey; counts?: Partial<Record<TodoViewKey, number>>; onSelectView?: (view: TodoViewKey) => void;
}

export function ViewSelector({ activeView, counts = {}, onSelectView }: ViewSelectorProps) {
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault?.();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextItem = TODO_VIEW_ITEMS[(index + delta + TODO_VIEW_ITEMS.length) % TODO_VIEW_ITEMS.length];
      if (nextItem) onSelectView?.(nextItem.key);
    } else if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault?.();
      const currentItem = TODO_VIEW_ITEMS[index];
      if (currentItem) onSelectView?.(currentItem.key);
    }
  };

  return (
    <div
      role="tablist" aria-label="Vistas de pendientes"
      style={{ display: "inline-flex", flexWrap: "wrap", gap: tokens.space[2], padding: tokens.space[1], backgroundColor: tokens.color.surfaceSubtle, border: `${tokens.border.thin} solid ${tokens.color.borderControl}`, borderRadius: tokens.radius.lg }}
    >
      {TODO_VIEW_ITEMS.map((item, idx) => {
        const isSelected = activeView === item.key;
        const count = counts[item.key] ?? 0;
        return (
          <button
            key={item.key} type="button" role="tab" aria-selected={isSelected} tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelectView?.(item.key)} onKeyDown={(e) => handleKeyDown(idx, e)}
            className={buttonVariants({ variant: isSelected ? "primary" : "ghost", size: "sm" })}
            style={{
              display: "inline-flex", alignItems: "center", gap: tokens.space[2], paddingBlock: tokens.space[2], paddingInline: tokens.space[3],
              borderRadius: tokens.radius.md, border: `${tokens.border.thin} solid ${isSelected ? tokens.color.accentPrimary : tokens.color.borderControl}`,
              backgroundColor: isSelected ? tokens.color.accentPrimary : tokens.color.surfaceRaised,
              color: isSelected ? tokens.color.textOnAccent : tokens.color.textPrimary,
              fontWeight: isSelected ? tokens.font.weight.semibold : tokens.font.weight.medium, fontSize: tokens.font.size.sm, cursor: "pointer",
            }}
          >
            <span>{item.label}</span>
            <span aria-label={`${count} pendientes en ${item.label}`} style={{ fontSize: tokens.font.size.xs }}>({count})</span>
          </button>
        );
      })}
    </div>
  );
}

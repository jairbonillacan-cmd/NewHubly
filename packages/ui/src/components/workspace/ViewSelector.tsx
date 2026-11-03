"use client";
import { Chip, Tabs } from "@heroui/react";
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
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLElement>) => {
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
    <Tabs
      selectedKey={activeView}
      onSelectionChange={(key) => onSelectView?.(String(key) as TodoViewKey)}
      aria-label="Vistas de pendientes"
    >
      <Tabs.List
        aria-label="Vistas de pendientes"
        style={{
          display: "inline-flex", flexWrap: "wrap", gap: tokens.space[2], padding: tokens.space[1],
          backgroundColor: tokens.pill.glassBg, border: `${tokens.border.thin} solid ${tokens.color.borderControl}`,
          borderRadius: tokens.radius.full,
        }}
      >
        {TODO_VIEW_ITEMS.map((item, idx) => {
          const isSelected = activeView === item.key;
          const count = counts[item.key] ?? 0;
          return (
            <Tabs.Tab
              key={item.key} id={item.key}
              onClick={() => onSelectView?.(item.key)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              style={{
                display: "inline-flex", alignItems: "center", gap: tokens.space[2],
                paddingBlock: tokens.space[2], paddingInline: tokens.space[4], borderRadius: tokens.radius.full,
                border: `${tokens.border.thin} solid ${isSelected ? tokens.pill.activeBg : tokens.color.borderControl}`,
                backgroundColor: isSelected ? tokens.pill.activeBg : tokens.bento.cardBg,
                color: isSelected ? tokens.pill.activeText : tokens.color.textPrimary,
                fontWeight: isSelected ? tokens.font.weight.semibold : tokens.font.weight.medium,
                fontSize: tokens.font.size.sm, cursor: "pointer",
              }}
            >
              <span>{item.label}</span>
              <Chip
                size="sm" variant="soft"
                aria-label={`${count} pendientes en ${item.label}`}
                style={{
                  backgroundColor: isSelected ? tokens.color.accentWarmSubtle : tokens.bento.surfaceBase,
                  color: isSelected ? tokens.color.accentWarmText : tokens.color.textSecondary,
                  borderRadius: tokens.radius.full, paddingInline: tokens.space[2],
                  fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.light,
                }}
              >
                ({count})
              </Chip>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
    </Tabs>
  );
}

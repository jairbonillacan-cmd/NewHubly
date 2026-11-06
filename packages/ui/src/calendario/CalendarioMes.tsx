"use client";

import { useState } from "react";
import { PiezaChip } from "./PiezaChip";
import { CALENDARIO_WEEKDAYS_SHORT, buildMonthGrid, sortPiezasByHora, type CalendarioPiezaItem } from "./types";

export interface CalendarioMesProps {
  anchorDate: string; todayDate?: string | undefined; piezas: readonly CalendarioPiezaItem[];
  maxVisiblePerDay?: number | undefined; defaultExpandedDates?: readonly string[] | undefined; canEdit?: boolean | undefined;
  selectedPiezaId?: string | null | undefined; onSelectPieza?: ((piezaId: string) => void) | undefined;
  onCreateOnDate?: ((isoDate: string) => void) | undefined; onMoreClick?: ((isoDate: string) => void) | undefined;
  onDropPieceOnDate?: ((piezaId: string, targetIsoDate: string) => void) | undefined; className?: string | undefined;
}

/** Cuadrícula mensual de 7 columnas (Lun a Dom) con hasta N piezas visibles por celda e indicador «+N más». */
export function CalendarioMes({
  anchorDate, todayDate = anchorDate, piezas, maxVisiblePerDay = 3, defaultExpandedDates,
  canEdit = true, selectedPiezaId, onSelectPieza, onCreateOnDate, onMoreClick, onDropPieceOnDate, className,
}: CalendarioMesProps) {
  const weeks = buildMonthGrid(anchorDate, todayDate);
  const [expandedDates, setExpandedDates] = useState<ReadonlySet<string>>(() => new Set(defaultExpandedDates));
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const byDate = new Map<string, CalendarioPiezaItem[]>();
  for (const pieza of piezas) byDate.set(pieza.fecha, [...(byDate.get(pieza.fecha) ?? []), pieza]);

  return (
    <section aria-label="Calendario mensual" className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div role="row" className="grid grid-cols-7 gap-2 px-1 text-center text-xs font-semibold text-(--text-secondary)">
        {CALENDARIO_WEEKDAYS_SHORT.map((day) => <div key={day} role="columnheader" className="py-1">{day}</div>)}
      </div>
      <div className="flex flex-col gap-2">
        {weeks.map((week, weekIdx) => (
          <div key={week[0]?.date ?? weekIdx} className="grid grid-cols-7 gap-2">
            {week.map((cell) => {
              const dayItems = sortPiezasByHora(byDate.get(cell.date) ?? []);
              const visibleItems = expandedDates.has(cell.date) ? dayItems : dayItems.slice(0, maxVisiblePerDay);
              const hiddenCount = dayItems.length - visibleItems.length;
              return (
                <div
                  key={cell.date} data-date={cell.date} data-in-month={cell.inCurrentMonth ? "true" : "false"} {...(cell.isToday ? { "data-today": "true" } : {})}
                  onDragOver={(e) => { if (canEdit && onDropPieceOnDate) { e.preventDefault(); setDragOverDate(cell.date); } }}
                  onDragLeave={() => setDragOverDate((cur) => (cur === cell.date ? null : cur))}
                  onDrop={(e) => {
                    if (!canEdit || !onDropPieceOnDate) return;
                    e.preventDefault(); setDragOverDate(null);
                    const id = e.dataTransfer?.getData("text/plain");
                    if (id) onDropPieceOnDate(id, cell.date);
                  }}
                  className={`flex min-h-28 flex-col gap-1.5 rounded-xl border p-2 transition-colors ${
                    dragOverDate === cell.date ? "border-(--accent-primary) bg-(--accent-primary-subtle)"
                    : cell.inCurrentMonth ? "border-(--border-subtle) bg-(--surface-raised)" : "border-(--border-subtle) bg-(--surface-subtle) opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${cell.isToday ? "bg-(--accent-primary) text-(--text-on-accent)" : cell.inCurrentMonth ? "text-(--text-primary)" : "text-(--text-muted)"}`}>{cell.dayNumber}</span>
                    {canEdit && onCreateOnDate && <button type="button" aria-label={`Crear pieza el ${cell.date}`} onClick={() => onCreateOnDate(cell.date)} className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-xs font-bold text-(--text-secondary) hover:bg-(--surface-interactive) hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring-color)">+</button>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {visibleItems.map((pieza) => <PiezaChip key={pieza.id} pieza={pieza} compact draggable={canEdit && Boolean(onDropPieceOnDate)} selected={selectedPiezaId === pieza.id} onSelect={onSelectPieza} />)}
                    {hiddenCount > 0 && <button type="button" onClick={() => { setExpandedDates((prev) => new Set(prev).add(cell.date)); onMoreClick?.(cell.date); }} className="cursor-pointer rounded-md px-2 py-1 text-left text-xs font-semibold text-(--accent-primary) hover:bg-(--accent-primary-subtle) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring-color)">+{hiddenCount} más</button>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { PiezaChip } from "./PiezaChip";
import { buildWeekDays, sortPiezasByHora, type CalendarioPiezaItem } from "./types";

export interface CalendarioSemanaProps {
  anchorDate: string; todayDate?: string | undefined; piezas: readonly CalendarioPiezaItem[]; canEdit?: boolean | undefined;
  selectedPiezaId?: string | null | undefined; onSelectPieza?: ((piezaId: string) => void) | undefined;
  onCreateOnDate?: ((isoDate: string) => void) | undefined; onDropPieceOnDate?: ((piezaId: string, targetIsoDate: string) => void) | undefined;
  className?: string | undefined;
}

/** Vista semanal de 7 columnas (Lun a Dom) con todas las piezas ordenadas por hora y soporte de arrastrar y soltar. */
export function CalendarioSemana({
  anchorDate, todayDate = anchorDate, piezas, canEdit = true, selectedPiezaId, onSelectPieza, onCreateOnDate, onDropPieceOnDate, className,
}: CalendarioSemanaProps) {
  const days = buildWeekDays(anchorDate, todayDate);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const byDate = new Map<string, CalendarioPiezaItem[]>();
  for (const pieza of piezas) byDate.set(pieza.fecha, [...(byDate.get(pieza.fecha) ?? []), pieza]);

  return (
    <section aria-label="Calendario semanal" className={`grid grid-cols-1 gap-2 md:grid-cols-7 ${className ?? ""}`}>
      {days.map((day) => {
        const items = sortPiezasByHora(byDate.get(day.date) ?? []);
        return (
          <div
            key={day.date} data-date={day.date} {...(day.isToday ? { "data-today": "true" } : {})}
            onDragOver={(e) => { if (canEdit && onDropPieceOnDate) { e.preventDefault(); setDragOverDate(day.date); } }}
            onDragLeave={() => setDragOverDate((cur) => (cur === day.date ? null : cur))}
            onDrop={(e) => {
              if (!canEdit || !onDropPieceOnDate) return;
              e.preventDefault(); setDragOverDate(null);
              const id = e.dataTransfer?.getData("text/plain");
              if (id) onDropPieceOnDate(id, day.date);
            }}
            className={`flex min-h-48 flex-col gap-2 rounded-xl border p-2.5 transition-colors ${dragOverDate === day.date ? "border-(--accent-primary) bg-(--accent-primary-subtle)" : "border-(--border-subtle) bg-(--surface-raised)"}`}
          >
            <header className="flex items-center justify-between gap-1 border-b border-(--border-subtle) pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-(--text-secondary)">{day.weekdayLabel}</span>
                <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${day.isToday ? "bg-(--accent-primary) text-(--text-on-accent)" : "text-(--text-primary)"}`}>{day.dayNumber}</span>
              </div>
              {canEdit && onCreateOnDate && <button type="button" aria-label={`Crear pieza el ${day.date}`} onClick={() => onCreateOnDate(day.date)} className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-xs font-bold text-(--text-secondary) hover:bg-(--surface-interactive) hover:text-(--text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring-color)">+</button>}
            </header>
            <div className="flex flex-col gap-1.5">
              {items.length === 0 ? <p className="m-0 py-4 text-center text-xs text-(--text-muted)">Sin entregas</p>
                : items.map((pieza) => <PiezaChip key={pieza.id} pieza={pieza} draggable={canEdit && Boolean(onDropPieceOnDate)} selected={selectedPiezaId === pieza.id} onSelect={onSelectPieza} />)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

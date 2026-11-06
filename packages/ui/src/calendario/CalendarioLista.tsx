"use client";

import { Button } from "@heroui/react";
import { PiezaChip } from "./PiezaChip";
import { formatCalendarioDateLong, sortPiezasByHora, type CalendarioPiezaItem } from "./types";

export interface CalendarioListaProps {
  piezas: readonly CalendarioPiezaItem[]; todayDate?: string | undefined; canEdit?: boolean | undefined;
  selectedPiezaId?: string | null | undefined; onSelectPieza?: ((piezaId: string) => void) | undefined;
  onCreatePieza?: ((isoDate?: string) => void) | undefined; emptyTitle?: string | undefined;
  emptyMessage?: string | undefined; className?: string | undefined;
}

/** Vista de agenda/lista agrupada por fecha (vista por defecto en móvil) con estado vacío accionable. */
export function CalendarioLista({
  piezas, todayDate, canEdit = true, selectedPiezaId, onSelectPieza, onCreatePieza,
  emptyTitle = "Sin piezas en este periodo", emptyMessage = "Aún no hay entregas programadas para estas fechas.", className,
}: CalendarioListaProps) {
  if (piezas.length === 0) {
    return (
      <section aria-label="Agenda editorial" role="status" className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-(--border-subtle) bg-(--surface-raised) p-8 text-center ${className ?? ""}`}>
        <h3 className="m-0 text-base font-bold text-(--text-primary)">{emptyTitle}</h3>
        <p className="m-0 max-w-md text-sm text-(--text-secondary)">{emptyMessage}</p>
        {canEdit && onCreatePieza && <Button variant="primary" size="sm" onPress={() => onCreatePieza(todayDate)}>Nueva pieza</Button>}
      </section>
    );
  }

  const dates = Array.from(new Set(piezas.map((p) => p.fecha))).sort();
  return (
    <section aria-label="Agenda editorial" className={`flex flex-col gap-3 ${className ?? ""}`}>
      {dates.map((fecha) => {
        const dayItems = sortPiezasByHora(piezas.filter((p) => p.fecha === fecha));
        return (
          <article key={fecha} data-date-group={fecha} className="flex flex-col gap-2 rounded-xl border border-(--border-subtle) bg-(--surface-raised) p-3">
            <header className="flex items-center justify-between gap-2 border-b border-(--border-subtle) pb-2">
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-sm font-bold text-(--text-primary)">{formatCalendarioDateLong(fecha)}</h3>
                {fecha === todayDate && <span className="rounded-md bg-(--accent-primary-subtle) px-2 py-0.5 text-xs font-semibold text-(--accent-primary)">Hoy</span>}
              </div>
              <span className="text-xs font-medium text-(--text-secondary)">{dayItems.length === 1 ? "1 pieza" : `${dayItems.length} piezas`}</span>
            </header>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {dayItems.map((pieza) => <PiezaChip key={pieza.id} pieza={pieza} selected={selectedPiezaId === pieza.id} onSelect={onSelectPieza} />)}
            </div>
          </article>
        );
      })}
    </section>
  );
}

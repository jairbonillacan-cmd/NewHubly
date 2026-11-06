"use client";

import { CANAL_INFO, ESTADO_PIEZA_LABEL, MARCA_COLOR_BG, MARCA_COLOR_TOKEN, type CalendarioCanal, type CalendarioEstadoPieza, type CalendarioPiezaItem } from "./types";

const CANAL_SVG_PATH: Record<CalendarioCanal, string> = {
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm5.2-1.7h.01",
  facebook: "M14 8h3V4h-3a5 5 0 0 0-5 5v3H6v4h3v5h4v-5h3l1-4h-4V9a1 1 0 0 1 1-1z",
  tiktok: "M14 3v11.5a3.5 3.5 0 1 1-3-3.46V7.5a7 7 0 1 0 6 6.93V8.5a5.5 5.5 0 0 0 4 1.5V6.5A4 4 0 0 1 17 3h-3z",
  linkedin: "M4 4h16v16H4zM8 10v6M8 7.5v.01M12 16v-3.5a2 2 0 0 1 4 0V16M12 10v6",
  x: "M4 4l16 16M20 4L4 20",
  youtube: "M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zm7 2.5v5l4.5-2.5L10 9.5z",
  blog: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4",
  email: "M4 6h16v12H4zM4 7l8 6 8-6",
  otro: "M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3z",
};

const ESTADO_BADGE_CLASS: Record<CalendarioEstadoPieza, string> = {
  idea: "bg-(--surface-raised) text-(--text-secondary)", borrador: "bg-(--surface-raised) text-(--text-secondary)",
  revision: "bg-(--status-warning-bg) text-(--status-warning-text)", aprobacion_cliente: "bg-(--status-warning-bg) text-(--status-warning-text)",
  programada: "bg-(--accent-primary-subtle) text-(--accent-primary)", aprobada: "bg-(--accent-primary-subtle) text-(--accent-primary)",
  publicada: "bg-(--status-success-bg) text-(--status-success-text)", medida: "bg-(--status-success-bg) text-(--status-success-text)",
};

export interface PiezaChipProps {
  pieza: CalendarioPiezaItem; onSelect?: ((piezaId: string) => void) | undefined;
  draggable?: boolean | undefined; compact?: boolean | undefined; selected?: boolean | undefined; className?: string | undefined;
}

/** Ficha compacta de una pieza editorial con tinte de marca, canal, hora opcional y estado. */
export function PiezaChip({ pieza, onSelect, draggable = false, compact = false, selected, className }: PiezaChipProps) {
  const canal = CANAL_INFO[pieza.canal], estadoLabel = ESTADO_PIEZA_LABEL[pieza.estado], hora = pieza.hora ? pieza.hora.slice(0, 5) : null;
  return (
    <button
      type="button" data-piece-id={pieza.id} data-brand-color={pieza.marcaColor} draggable={draggable}
      {...(selected !== undefined ? { "aria-pressed": selected } : {})}
      aria-label={`${pieza.titulo} · ${pieza.marcaNombre} · ${canal.label} · ${estadoLabel}${hora ? ` · ${hora}` : ""}`}
      onClick={() => onSelect?.(pieza.id)}
      onDragStart={(e) => { if (draggable) { e.dataTransfer.setData("text/plain", pieza.id); e.dataTransfer.effectAllowed = "move"; } }}
      style={{ backgroundColor: MARCA_COLOR_TOKEN[pieza.marcaColor] }}
      className={`group flex w-full min-w-0 cursor-pointer flex-col gap-1 rounded-lg border border-(--border-default) p-2 text-left text-(--text-primary) transition-colors hover:border-(--border-control) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring-color) ${MARCA_COLOR_BG[pieza.marcaColor]} ${selected ? "ring-2 ring-(--accent-primary)" : ""} ${className ?? ""}`}
    >
      <span className="flex w-full items-center justify-between gap-1.5">
        <span className="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-(--text-secondary)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5 shrink-0">
            <path d={CANAL_SVG_PATH[pieza.canal]} />
          </svg>
          <span>{canal.abbr}</span>
          {hora && <span className="whitespace-nowrap font-mono text-(--text-secondary)">· {hora}</span>}
        </span>
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${ESTADO_BADGE_CLASS[pieza.estado]}`}>{estadoLabel}</span>
      </span>
      <span className="w-full truncate text-xs font-semibold text-(--text-primary)">{pieza.titulo}</span>
      {!compact && <span className="w-full truncate text-xs text-(--text-secondary)">{pieza.marcaNombre}{pieza.campana ? ` · ${pieza.campana}` : ""}{pieza.responsableNombre ? ` · ${pieza.responsableNombre}` : ""}</span>}
    </button>
  );
}

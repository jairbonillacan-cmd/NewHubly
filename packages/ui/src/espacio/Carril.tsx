"use client";

import { Button, Tooltip } from "@heroui/react";
import { HerramientaIcono, HERRAMIENTAS, type Herramienta, type HerramientaId } from "./herramientas";
import { Icon } from "./icons";

export interface CarrilProps {
  expandido: boolean;
  onToggleExpandido: () => void;
  activa: HerramientaId;
  onSelect: (id: HerramientaId) => void;
  /** Pendientes de Hoy sin hacer (vencidos y de hoy): la ficha de Hoy. */
  hoyPendientes: number;
  /** Pendientes de esta semana: hechos y totales, para la tarjeta «Tu semana». */
  semana: { hechos: number; total: number };
}

const ITEM = "relative w-full min-h-11 cursor-pointer rounded-xl border-0 transition-colors";

function Item({ herramienta, activa, expandido, ficha, onSelect }: { herramienta: Herramienta; activa: boolean; expandido: boolean; ficha: string | null; onSelect: () => void }) {
  const tono = activa
    ? "bg-(--accent-primary) text-(--text-on-accent)"
    : herramienta.disponible ? "bg-transparent text-(--text-primary) data-[hovered]:bg-(--glass-hover)" : "bg-transparent text-(--text-secondary) data-[hovered]:bg-(--glass-hover)";
  const etiqueta = herramienta.disponible ? herramienta.nombre : `${herramienta.nombre}, próximamente`;
  const boton = (
    <Button variant="ghost" aria-label={etiqueta} {...(activa ? { "aria-current": "page" as const } : {})} onPress={onSelect}
      className={`${ITEM} ${tono} ${expandido ? "h-11 justify-start gap-3 px-3" : "h-auto flex-col gap-1 px-1 py-2"}`}>
      <span className="relative">
        <HerramientaIcono id={herramienta.id} activo={activa} />
        {!herramienta.disponible && !expandido && (
          <span aria-hidden="true" className="absolute -top-0.5 -right-1 size-2 rounded-full border-2 border-(--text-muted)" />
        )}
      </span>
      <span className={expandido ? "grow text-left text-sm font-semibold" : "text-xs font-semibold"}>{herramienta.nombre}</span>
      {expandido && ficha && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activa ? "bg-(--icon-fill-active)" : herramienta.disponible ? "bg-(--accent-primary-subtle) text-(--accent-primary)" : "bg-(--glass-hover) text-(--text-secondary)"}`}>{ficha}</span>
      )}
    </Button>
  );
  if (expandido) return boton;
  return (
    <Tooltip delay={400}>
      {boton}
      <Tooltip.Content placement="right">{etiqueta}</Tooltip.Content>
    </Tooltip>
  );
}

/** Carril izquierdo (#105, sección 3): Hoy primero y el grupo «Herramientas»; compacto (64 px) o completo (232 px). */
export function Carril({ expandido, onToggleExpandido, activa, onSelect, hoyPendientes, semana }: CarrilProps) {
  const [hoy, ...herramientas] = HERRAMIENTAS;
  const ficha = (herramienta: Herramienta) => herramienta.id === "hoy" ? (hoyPendientes > 0 ? String(hoyPendientes) : null) : "Pronto";
  return (
    <nav aria-label="Herramientas" data-delay="1"
      className={`hubly-glass hubly-enter flex h-full flex-col gap-1 overflow-y-auto rounded-(--glass-radius-access-bar) p-2 transition-[width] ${expandido ? "w-58" : "w-16"}`}>
      <Item herramienta={hoy!} activa={activa === "hoy"} expandido={expandido} ficha={ficha(hoy!)} onSelect={() => onSelect("hoy")} />
      <span aria-hidden="true" className="mx-2 my-1.5 h-px bg-(--glass-line-strong)" />
      {expandido && <p className="m-0 px-3 pb-1 text-xs font-semibold tracking-wide text-(--text-secondary) uppercase">Herramientas</p>}
      <ul aria-label="Herramientas" className="m-0 flex list-none flex-col gap-1 p-0">
        {herramientas.map((herramienta) => (
          <li key={herramienta.id}>
            <Item herramienta={herramienta} activa={activa === herramienta.id} expandido={expandido} ficha={ficha(herramienta)} onSelect={() => onSelect(herramienta.id)} />
          </li>
        ))}
      </ul>
      <Button variant="ghost" isDisabled aria-label="Agregar una herramienta, muy pronto"
        className={`${ITEM} mt-1 border border-dashed border-(--glass-line-strong) bg-transparent text-(--text-secondary) ${expandido ? "h-11 justify-start gap-3 px-3" : "h-11 px-0"}`}>
        <Icon name="mas" className="size-5" />
        {expandido && <span className="grow text-left text-sm">Agregar una herramienta</span>}
        {expandido && <span className="text-xs">Muy pronto</span>}
      </Button>
      <span className="grow" />
      {expandido && (
        <div className="mb-1 flex flex-col gap-2 rounded-xl bg-(--glass-hover) p-3">
          <p className="m-0 text-sm font-semibold">Tu semana</p>
          <p className="m-0 text-xs text-(--text-secondary)">{semana.hechos} de {semana.total} pendientes hechos</p>
          <progress value={semana.hechos} max={Math.max(semana.total, 1)} aria-label="Pendientes hechos esta semana"
            className="h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-(--accent-primary) [&::-webkit-progress-bar]:bg-(--glass-line-strong) [&::-webkit-progress-value]:bg-(--accent-primary)" />
        </div>
      )}
      <Button variant="ghost" aria-expanded={expandido} aria-label={expandido ? "Contraer el carril" : "Expandir el carril"} onPress={onToggleExpandido}
        className={`${ITEM} h-11 bg-transparent text-(--text-secondary) data-[hovered]:bg-(--glass-hover) data-[hovered]:text-(--text-primary) ${expandido ? "justify-start gap-3 px-3" : "px-0"}`}>
        <Icon name={expandido ? "contraer" : "expandir"} className="size-5" />
        {expandido && <span className="text-sm">Contraer</span>}
      </Button>
    </nav>
  );
}

/** Página de una herramienta que todavía no existe: su icono, su nombre y lo que hará. Sin datos inventados. */
export function Proximamente({ herramienta }: { herramienta: Herramienta }) {
  return (
    <section aria-labelledby="proximamente-titulo" className="hubly-glass hubly-enter flex min-h-96 grow flex-col items-center justify-center gap-4 rounded-2xl px-6 py-12 text-center">
      <HerramientaIcono id={herramienta.id} className="size-18 text-(--text-secondary)" />
      <p className="m-0 text-xs font-semibold tracking-wide text-(--accent-primary) uppercase">Próximamente</p>
      <h2 id="proximamente-titulo" className="m-0 text-2xl font-bold">{herramienta.nombre}</h2>
      <p className="m-0 max-w-md text-sm leading-relaxed text-(--text-secondary)">{herramienta.descripcion}</p>
      <p className="m-0 max-w-md text-xs text-(--text-muted)">Hubly construye las herramientas una a una, alrededor de Hoy. Esta llega en una próxima entrega.</p>
    </section>
  );
}

/** Pendientes con fecha en la semana de hoy (lunes a domingo): hechos y totales. */
export function resumenSemana(todos: { dueDate: string | null; isDone: boolean }[], todayDate: string): { hechos: number; total: number } {
  const hoy = new Date(`${todayDate}T00:00:00Z`);
  const lunes = new Date(hoy);
  lunes.setUTCDate(hoy.getUTCDate() - ((hoy.getUTCDay() + 6) % 7));
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);
  const [desde, hasta] = [lunes, domingo].map((fecha) => fecha.toISOString().slice(0, 10));
  const semana = todos.filter((todo) => todo.dueDate !== null && todo.dueDate >= desde! && todo.dueDate <= hasta!);
  return { hechos: semana.filter((todo) => todo.isDone).length, total: semana.length };
}

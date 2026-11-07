"use client";

import { Button, Popover } from "@heroui/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { GlassPanel } from "./GlassPanel";
import { Icon, type IconName } from "./icons";
import type { EspacioTodo } from "./types";

/** Widgets del Hub: piezas pequeñas que viven en el lienzo junto a los paneles. Solo muestran datos reales. */
export type WidgetId = "reloj" | "enfoque" | "semana" | "vencidos";

export const WIDGETS: { id: WidgetId; nombre: string; descripcion: string; icon: IconName }[] = [
  { id: "reloj", nombre: "Reloj", descripcion: "La hora y la fecha en tu zona horaria.", icon: "reloj" },
  { id: "enfoque", nombre: "Enfoque", descripcion: "Temporizador de 25 minutos con descansos de 5.", icon: "enfoque" },
  { id: "semana", nombre: "Tu semana", descripcion: "Cuánto llevas de los pendientes de esta semana.", icon: "hoy" },
  { id: "vencidos", nombre: "Vencidos", descripcion: "Lo que se quedó atrás, para cerrarlo de una vez.", icon: "check" },
];

/** Dónde aparece cada widget la primera vez: a la derecha de los paneles, en columna. */
export const WIDGET_INICIAL: Record<WidgetId, { x: number; y: number; w: number; h: number }> = {
  reloj: { x: 1148, y: 0, w: 300, h: 176 },
  enfoque: { x: 1148, y: 200, w: 300, h: 236 },
  semana: { x: 1148, y: 460, w: 300, h: 180 },
  vencidos: { x: 1472, y: 0, w: 300, h: 320 },
};

// Qué widgets están puestos: es acomodo del lienzo, como el resto de su disposición, y se guarda en este navegador.
const KEY = "hubly-widgets";
const isWidget = (value: unknown): value is WidgetId => WIDGETS.some((widget) => widget.id === value);
let activos: WidgetId[] | null = null;
const listeners = new Set<() => void>();

function leer(): WidgetId[] {
  if (activos) return activos;
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    activos = Array.isArray(parsed) ? parsed.filter(isWidget) : [];
  } catch { activos = []; }
  return activos;
}

export function toggleWidget(id: WidgetId): void {
  const actuales = leer();
  activos = actuales.includes(id) ? actuales.filter((other) => other !== id) : [...actuales, id];
  try { window.localStorage.setItem(KEY, JSON.stringify(activos)); } catch { /* sin almacenamiento: solo esta visita */ }
  listeners.forEach((listener) => listener());
}

const SIN_WIDGETS: WidgetId[] = [];
export function useWidgets() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    leer,
    () => SIN_WIDGETS,
  );
}

/** Cajón de widgets: galería para ponerlos o quitarlos del lienzo. */
export function WidgetsCajon({ activos: puestos, onToggle, triggerClassName }: { activos: readonly WidgetId[]; onToggle: (id: WidgetId) => void; triggerClassName: string }) {
  return (
    <Popover>
      <Button isIconOnly variant="ghost" aria-label="Widgets" className={triggerClassName}>
        <Icon name="widgets" className="size-5" />
      </Button>
      <Popover.Content placement="top end" className="hubly-pop-surface w-80 rounded-2xl p-3 text-(--text-primary)">
        <Popover.Dialog aria-label="Widgets del Hub" className="hubly-sin-anillo flex flex-col gap-3 outline-none">
          <div className="flex items-baseline justify-between px-1">
            <Popover.Heading className="m-0 text-sm font-semibold">Widgets</Popover.Heading>
            <span className="text-xs text-(--text-muted)">Se acomodan en tu lienzo</span>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
            {WIDGETS.map((widget) => {
              const puesto = puestos.includes(widget.id);
              return (
                <li key={widget.id}>
                  <button type="button" aria-pressed={puesto} onClick={() => onToggle(widget.id)}
                    className={`flex h-full w-full cursor-pointer flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left focus-visible:ring-2 focus-visible:ring-(--accent-primary) ${puesto ? "border-(--accent-primary) bg-(--hover-acento)" : "border-(--glass-line) hover:bg-(--hover-acento)"}`}>
                    <span className="flex w-full items-center justify-between">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-(--accent-primary-subtle) text-(--accent-primary)"><Icon name={widget.icon} className="size-4" /></span>
                      <span className="text-xs font-semibold text-(--accent-primary)">{puesto ? "Quitar" : "Agregar"}</span>
                    </span>
                    <span className="text-sm font-semibold">{widget.nombre}</span>
                    <span className="text-xs leading-snug text-(--text-muted)">{widget.descripcion}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function Reloj({ timezone }: { timezone: string }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const hora = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(ahora);
  const fecha = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", timeZone: timezone }).format(ahora);
  return (
    <div className="flex h-full flex-col justify-center gap-1 px-4 py-3">
      <time dateTime={ahora.toISOString()} className="text-4xl font-semibold tracking-tight tabular-nums">{hora}</time>
      <span className="text-sm text-(--text-secondary) first-letter:uppercase">{fecha}</span>
      <span className="text-xs text-(--text-muted)">{timezone.replaceAll("_", " ")}</span>
    </div>
  );
}

const DURACION = { enfoque: 25 * 60, descanso: 5 * 60 } as const;
function Enfoque() {
  const [modo, setModo] = useState<keyof typeof DURACION>("enfoque");
  const [restante, setRestante] = useState<number>(DURACION.enfoque);
  const [corriendo, setCorriendo] = useState(false);
  useEffect(() => {
    if (!corriendo) return;
    const timer = setInterval(() => setRestante((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [corriendo]);
  useEffect(() => {
    if (restante > 0 || !corriendo) return;
    const siguiente = modo === "enfoque" ? "descanso" : "enfoque";
    setCorriendo(false);
    setModo(siguiente);
    setRestante(DURACION[siguiente]);
  }, [restante, corriendo, modo]);
  const mm = String(Math.floor(restante / 60)).padStart(2, "0");
  const ss = String(restante % 60).padStart(2, "0");
  const avance = 1 - restante / DURACION[modo];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-3">
      <span className="text-xs font-semibold tracking-wide text-(--text-secondary) uppercase">{modo === "enfoque" ? "Enfoque" : "Descanso"}</span>
      <span role="timer" aria-live="off" className="text-4xl font-semibold tabular-nums">{mm}:{ss}</span>
      <span aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-(--glass-line-strong)">
        <span className="hubly-widget-avance block h-full rounded-full bg-(--accent-primary)" data-avance={Math.round(avance * 20) * 5} />
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onPress={() => setCorriendo((c) => !c)}>{corriendo ? "Pausar" : "Empezar"}</Button>
        <Button size="sm" variant="ghost" onPress={() => { setCorriendo(false); setRestante(DURACION[modo]); }}>Reiniciar</Button>
      </div>
    </div>
  );
}

function Semana({ hechos, total }: { hechos: number; total: number }) {
  const pct = total ? Math.round((100 * hechos) / total) : 0;
  return (
    <div className="flex h-full items-center gap-4 px-4 py-3">
      <svg viewBox="0 0 36 36" className="size-20 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-(--glass-line-strong)" />
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" pathLength="100" strokeDasharray={`${pct} 100`} strokeLinecap="round" className="stroke-(--accent-primary)" />
      </svg>
      <div className="flex flex-col gap-0.5">
        <span className="text-2xl font-semibold tabular-nums">{pct} %</span>
        <span className="text-sm text-(--text-secondary)">{total ? `${hechos} de ${total} pendientes hechos` : "Sin pendientes esta semana"}</span>
      </div>
    </div>
  );
}

function Vencidos({ todos, todayDate, onToggleTodo }: { todos: readonly EspacioTodo[]; todayDate: string; onToggleTodo: (id: string) => void }) {
  const vencidos = todos.filter((todo) => !todo.isDone && todo.dueDate !== null && todo.dueDate < todayDate);
  if (!vencidos.length) return <p className="m-0 flex h-full items-center justify-center px-4 text-center text-sm text-(--text-secondary)">Nada vencido. Vas al día.</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-2">
      {vencidos.map((todo) => (
        <li key={todo.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-(--hover-acento)">
          <button type="button" onClick={() => onToggleTodo(todo.id)} aria-label={`Marcar como hecho: ${todo.title}`}
            className="size-4 shrink-0 cursor-pointer rounded border border-(--border-control) focus-visible:ring-2 focus-visible:ring-(--accent-primary)" />
          <span className="min-w-0 grow truncate text-sm">{todo.title}</span>
          <span className="shrink-0 text-xs text-(--status-danger-text)">{todo.dueDate}</span>
        </li>
      ))}
    </ul>
  );
}

/** Un widget dentro del lienzo, con su cabecera para moverlo y su botón para quitarlo. */
export function WidgetPanel({ id, timezone, todos, todayDate, semana, onToggleTodo, onRemove }: {
  id: WidgetId; timezone: string; todos: readonly EspacioTodo[]; todayDate: string; semana: { hechos: number; total: number };
  onToggleTodo: (id: string) => void; onRemove: () => void;
}) {
  const widget = WIDGETS.find((entry) => entry.id === id)!;
  return (
    <GlassPanel id={`widget-${id}`} title={widget.nombre} icon={widget.icon} onClose={onRemove} className="h-full">
      {id === "reloj" && <Reloj timezone={timezone} />}
      {id === "enfoque" && <Enfoque />}
      {id === "semana" && <Semana {...semana} />}
      {id === "vencidos" && <Vencidos todos={todos} todayDate={todayDate} onToggleTodo={onToggleTodo} />}
    </GlassPanel>
  );
}

"use client";

import { Button, Popover } from "@heroui/react";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { GlassPanel, IconButton } from "./GlassPanel";
import { Icon, type IconName } from "./icons";
import type { EspacioTodo } from "./types";

/** Widgets del Hub: piezas pequeñas que viven en el lienzo o ancladas a la bandeja. Solo muestran datos reales. */
export type WidgetId = "reloj" | "enfoque" | "semana" | "vencidos";
export type WidgetLugar = "lienzo" | "bandeja";

export const WIDGETS: { id: WidgetId; nombre: string; descripcion: string; icon: IconName }[] = [
  { id: "reloj", nombre: "Reloj", descripcion: "La hora y la fecha en tu zona horaria.", icon: "reloj" },
  { id: "enfoque", nombre: "Enfoque", descripcion: "Temporizador de 25 minutos con descansos de 5.", icon: "enfoque" },
  { id: "semana", nombre: "Tu semana", descripcion: "Cuánto llevas de los pendientes de esta semana.", icon: "hoy" },
  { id: "vencidos", nombre: "Vencidos", descripcion: "Lo que se quedó atrás, para cerrarlo de una vez.", icon: "check" },
];

/** Dónde aparece cada widget la primera vez en el lienzo: a la derecha de los paneles, en columna. */
export const WIDGET_INICIAL: Record<WidgetId, { x: number; y: number; w: number; h: number }> = {
  reloj: { x: 1148, y: 0, w: 300, h: 176 },
  enfoque: { x: 1148, y: 200, w: 300, h: 236 },
  semana: { x: 1148, y: 460, w: 300, h: 180 },
  vencidos: { x: 1472, y: 0, w: 300, h: 320 },
};

// ---------- Qué widgets están puestos y dónde: es acomodo del espacio y se guarda en este navegador. ----------
const KEY = "hubly-widgets";
const isWidget = (value: unknown): value is WidgetId => WIDGETS.some((widget) => widget.id === value);
type Lugares = Partial<Record<WidgetId, WidgetLugar>>;
let lugares: Lugares | null = null;
const listeners = new Set<() => void>();

function leer(): Lugares {
  if (lugares) return lugares;
  let parsed: unknown = null;
  try { parsed = JSON.parse((typeof window === "undefined" ? null : window.localStorage.getItem(KEY)) ?? "null"); } catch { /* valor dañado */ }
  const next: Lugares = {};
  // Antes se guardaba una lista: esos widgets estaban en el lienzo.
  if (Array.isArray(parsed)) for (const id of parsed) { if (isWidget(id)) next[id] = "lienzo"; }
  else if (parsed && typeof parsed === "object") {
    for (const [id, lugar] of Object.entries(parsed)) if (isWidget(id) && (lugar === "lienzo" || lugar === "bandeja")) next[id] = lugar;
  }
  lugares = next;
  return lugares;
}

function guardar(next: Lugares) {
  lugares = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin almacenamiento: solo esta visita */ }
  listeners.forEach((listener) => listener());
}

/** Pone el widget en el lienzo o lo quita de donde esté. */
export function toggleWidget(id: WidgetId): void {
  const actuales = { ...leer() };
  if (actuales[id]) delete actuales[id];
  else actuales[id] = "lienzo";
  guardar(actuales);
}

/** Lleva un widget al lienzo o lo ancla a la bandeja. */
export function moverWidget(id: WidgetId, lugar: WidgetLugar): void {
  guardar({ ...leer(), [id]: lugar });
}

const VACIO: Lugares = {};
export function useWidgets() {
  const actuales = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    leer,
    () => VACIO,
  );
  return useMemo(() => {
    const ids = WIDGETS.map((widget) => widget.id);
    return {
      puestos: ids.filter((id) => actuales[id]),
      lienzo: ids.filter((id) => actuales[id] === "lienzo"),
      bandeja: ids.filter((id) => actuales[id] === "bandeja"),
    };
  }, [actuales]);
}

// ---------- Temporizador de Enfoque compartido: no se reinicia al mover el widget entre el lienzo y la bandeja. ----------
const DURACION = { enfoque: 25 * 60, descanso: 5 * 60 } as const;
type EstadoEnfoque = { modo: keyof typeof DURACION; restante: number; corriendo: boolean };
let enfoque: EstadoEnfoque = { modo: "enfoque", restante: DURACION.enfoque, corriendo: false };
let reloj: ReturnType<typeof setInterval> | undefined;
const enfoqueListeners = new Set<() => void>();
const avisar = () => enfoqueListeners.forEach((listener) => listener());

function tic() {
  if (enfoque.restante > 1) { enfoque = { ...enfoque, restante: enfoque.restante - 1 }; avisar(); return; }
  const siguiente = enfoque.modo === "enfoque" ? "descanso" : "enfoque";
  clearInterval(reloj); reloj = undefined;
  enfoque = { modo: siguiente, restante: DURACION[siguiente], corriendo: false };
  avisar();
}
export function alternarEnfoque() {
  if (enfoque.corriendo) { clearInterval(reloj); reloj = undefined; enfoque = { ...enfoque, corriendo: false }; }
  else { reloj = setInterval(tic, 1000); enfoque = { ...enfoque, corriendo: true }; }
  avisar();
}
export function reiniciarEnfoque() {
  clearInterval(reloj); reloj = undefined;
  enfoque = { ...enfoque, restante: DURACION[enfoque.modo], corriendo: false };
  avisar();
}
const INICIAL_ENFOQUE = enfoque;
function useEnfoque() {
  return useSyncExternalStore(
    (listener) => { enfoqueListeners.add(listener); return () => { enfoqueListeners.delete(listener); }; },
    () => enfoque,
    () => INICIAL_ENFOQUE,
  );
}
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function useAhora(cadaMs: number) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), cadaMs);
    return () => clearInterval(timer);
  }, [cadaMs]);
  return ahora;
}

// ---------- Cajón para ponerlos o quitarlos ----------
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
            <span className="text-xs text-(--text-muted)">En el lienzo o anclados a la bandeja</span>
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

// ---------- Widgets en el lienzo ----------
function Reloj({ timezone }: { timezone: string }) {
  const ahora = useAhora(1000);
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

function Enfoque() {
  const { modo, restante, corriendo } = useEnfoque();
  const avance = 1 - restante / DURACION[modo];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-3">
      <span className="text-xs font-semibold tracking-wide text-(--text-secondary) uppercase">{modo === "enfoque" ? "Enfoque" : "Descanso"}</span>
      <span role="timer" aria-live="off" className="text-4xl font-semibold tabular-nums">{mmss(restante)}</span>
      <span aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-(--glass-line-strong)">
        <span className="hubly-widget-avance block h-full rounded-full bg-(--accent-primary)" data-avance={Math.round(avance * 20) * 5} />
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onPress={alternarEnfoque}>{corriendo ? "Pausar" : "Empezar"}</Button>
        <Button size="sm" variant="ghost" onPress={reiniciarEnfoque}>Reiniciar</Button>
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

const vencidosDe = (todos: readonly EspacioTodo[], todayDate: string) => todos.filter((todo) => !todo.isDone && todo.dueDate !== null && todo.dueDate < todayDate);

function Vencidos({ todos, todayDate, onToggleTodo }: { todos: readonly EspacioTodo[]; todayDate: string; onToggleTodo: (id: string) => void }) {
  const vencidos = vencidosDe(todos, todayDate);
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

export interface WidgetDatos { timezone: string; todos: readonly EspacioTodo[]; todayDate: string; semana: { hechos: number; total: number }; onToggleTodo: (id: string) => void }

/** Un widget dentro del lienzo: se mueve desde su cabecera, se ancla a la bandeja o se quita. */
export function WidgetPanel({ id, timezone, todos, todayDate, semana, onToggleTodo }: { id: WidgetId } & WidgetDatos) {
  const widget = WIDGETS.find((entry) => entry.id === id)!;
  return (
    <GlassPanel id={`widget-${id}`} title={widget.nombre} icon={widget.icon} onClose={() => toggleWidget(id)} className="h-full"
      actions={<IconButton icon="pin" label={`Anclar ${widget.nombre} a la bandeja`} onPress={() => moverWidget(id, "bandeja")} />}>
      {id === "reloj" && <Reloj timezone={timezone} />}
      {id === "enfoque" && <Enfoque />}
      {id === "semana" && <Semana {...semana} />}
      {id === "vencidos" && <Vencidos todos={todos} todayDate={todayDate} onToggleTodo={onToggleTodo} />}
    </GlassPanel>
  );
}

// ---------- Bandeja: abajo a la izquierda, con tu semana y los widgets anclados ----------
function FilaBandeja({ icon, titulo, detalle, children, onLienzo }: { icon: IconName; titulo: string; detalle: string; children?: ReactNode; onLienzo?: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-(--hover-acento)">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--accent-primary-subtle) text-(--accent-primary)"><Icon name={icon} className="size-4" /></span>
      <span className="flex min-w-0 grow flex-col">
        <span className="truncate text-sm font-semibold">{titulo}</span>
        <span className="truncate text-xs text-(--text-secondary)">{detalle}</span>
      </span>
      {children}
      {onLienzo && <IconButton icon="libre" label={`Llevar ${titulo} al lienzo`} onPress={onLienzo} />}
    </li>
  );
}

/** Bandeja del Hub: siempre a mano, con el avance de la semana y los widgets que anclaste. */
export function Bandeja({ datos, anclados }: { datos: WidgetDatos; anclados: readonly WidgetId[] }) {
  const { semana, todos, todayDate, timezone } = datos;
  const enfoqueActual = useEnfoque();
  const ahora = useAhora(15000);
  const pct = semana.total ? Math.round((100 * semana.hechos) / semana.total) : 0;
  const vencidos = vencidosDe(todos, todayDate).length;
  const paraHoy = todos.filter((todo) => !todo.isDone && todo.dueDate === todayDate).length;
  const hora = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(ahora);
  return (
    <Popover>
      <Button variant="ghost" aria-label={`Bandeja: ${semana.hechos} de ${semana.total} pendientes de la semana hechos`}
        className="hubly-glass h-(--frame-dock-h) gap-2 rounded-(--glass-radius-access-card) px-3 text-xs font-semibold text-(--text-primary)">
        <svg viewBox="0 0 36 36" className="size-5 -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r="14" fill="none" strokeWidth="5" className="stroke-(--glass-line-strong)" />
          <circle cx="18" cy="18" r="14" fill="none" strokeWidth="5" pathLength="100" strokeDasharray={`${pct} 100`} strokeLinecap="round" className="stroke-(--accent-primary)" />
        </svg>
        <span className="tabular-nums">{semana.hechos}/{semana.total}</span>
        {enfoqueActual.corriendo && <span className="rounded-full bg-(--accent-primary-subtle) px-1.5 text-(--accent-primary) tabular-nums">{mmss(enfoqueActual.restante)}</span>}
        <Icon name="chevron" className="size-3.5 -rotate-90 text-(--text-muted)" />
      </Button>
      <Popover.Content placement="top start" className="hubly-pop-surface w-80 rounded-2xl p-2 text-(--text-primary)">
        <Popover.Dialog aria-label="Bandeja" className="hubly-sin-anillo outline-none">
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            <FilaBandeja icon="hoy" titulo="Tu semana" detalle={semana.total ? `${semana.hechos} de ${semana.total} hechos · ${pct} %` : "Sin pendientes esta semana"}>
              <span className="flex shrink-0 flex-col items-end text-xs">
                <span className={vencidos ? "font-semibold text-(--status-danger-text)" : "text-(--text-muted)"}>{vencidos} vencidos</span>
                <span className="text-(--text-muted)">{paraHoy} para hoy</span>
              </span>
            </FilaBandeja>
            {anclados.map((id) => {
              const widget = WIDGETS.find((entry) => entry.id === id)!;
              const alLienzo = () => moverWidget(id, "lienzo");
              if (id === "reloj") return <FilaBandeja key={id} icon="reloj" titulo={hora} detalle={timezone.replaceAll("_", " ")} onLienzo={alLienzo} />;
              if (id === "enfoque") return (
                <FilaBandeja key={id} icon="enfoque" titulo={`${enfoqueActual.modo === "enfoque" ? "Enfoque" : "Descanso"} · ${mmss(enfoqueActual.restante)}`}
                  detalle={enfoqueActual.corriendo ? "En marcha" : "En pausa"} onLienzo={alLienzo}>
                  <IconButton icon={enfoqueActual.corriendo ? "pausa" : "reproducir"} label={enfoqueActual.corriendo ? "Pausar" : "Empezar"} onPress={alternarEnfoque} />
                </FilaBandeja>
              );
              if (id === "semana") return <FilaBandeja key={id} icon="hoy" titulo={`${pct} % de la semana`} detalle={`${semana.hechos} de ${semana.total} pendientes`} onLienzo={alLienzo} />;
              return <FilaBandeja key={id} icon={widget.icon} titulo={`${vencidos} vencidos`} detalle={vencidos ? "Ciérralos desde el lienzo" : "Vas al día"} onLienzo={alLienzo} />;
            })}
          </ul>
          {!anclados.length && <p className="m-0 px-2 pt-1 pb-2 text-xs text-(--text-muted)">Ancla aquí un widget con el alfiler de su cabecera.</p>}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

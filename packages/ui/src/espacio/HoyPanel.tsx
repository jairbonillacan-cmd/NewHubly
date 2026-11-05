"use client";

import { Button, Checkbox, Chip, Disclosure, Kbd } from "@heroui/react";
import { Hubi } from "../components/brand/Hubi";
import { GlassPanel, IconButton } from "./GlassPanel";
import {
  PRIORITY_LABEL, TODO_GROUP_LABEL, relativeDateLabel, todoGroup,
  type EspacioNote, type EspacioTodo, type EspacioVisibility, type HoyFilter, type TodoGroupId,
} from "./types";

const GROUP_ORDER: TodoGroupId[] = ["vencidos", "hoy", "proximos", "sin_fecha"];
const GROUP_COLOR: Record<TodoGroupId, string> = {
  vencidos: "text-(--status-danger-text)",
  hoy: "text-(--accent-primary)",
  proximos: "text-(--text-muted)",
  sin_fecha: "text-(--text-muted)",
};
const PRIORITY_COLOR = { high: "warning", medium: "default", low: "default" } as const;

export interface HoyPanelProps {
  todos: EspacioTodo[];
  notes: EspacioNote[];
  todayDate: string;
  filter: HoyFilter;
  /** Pendientes marcados en esta visita: se quedan en su grupo, tachados, para poder deshacer. */
  recentlyDone: ReadonlySet<string>;
  /** Pendientes recién creados: entran con animación. */
  freshIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onChangeVisibility?: ((id: string, visibility: EspacioVisibility) => void) | undefined;
  onClearFilter: () => void;
  onClose?: (() => void) | undefined;
  className?: string | undefined;
}

function TodoRow({ todo, note, todayDate, fresh, onToggle, onChangeVisibility }: { todo: EspacioTodo; note?: EspacioNote | undefined; todayDate: string; fresh: boolean; onToggle: (id: string) => void; onChangeVisibility?: HoyPanelProps["onChangeVisibility"] }) {
  const overdue = !todo.isDone && Boolean(todo.dueDate && todo.dueDate < todayDate);
  const meta = note ? `Nota de origen: ${note.title || "Nota sin título"}` : todo.detail || null;
  return (
    <li id={`pendiente-${todo.id}`} className={`${fresh ? "hubly-pop" : ""} flex scroll-mt-4 items-center rounded-lg pr-1 transition-colors hover:bg-(--glass-hover)`}>
      <Checkbox isSelected={todo.isDone} onChange={() => onToggle(todo.id)} className="min-w-0 grow">
        <Checkbox.Content className="flex w-full min-w-0 cursor-pointer flex-row items-center gap-3 px-4 py-2.5 text-left">
          <Checkbox.Control className="size-4.5 shrink-0 rounded-md">
            <Checkbox.Indicator />
          </Checkbox.Control>
          <span className="flex min-w-0 grow flex-col gap-0.5">
            <span className={`text-sm font-medium transition-colors ${todo.isDone ? "text-(--text-muted) line-through" : "text-(--text-primary)"}`}>{todo.title}</span>
            {meta && <span className="truncate text-xs text-(--text-muted)">{meta}</span>}
            {todo.visibility === "workspace" && <span className="text-xs text-(--accent-primary)">Compartido con la agencia</span>}
          </span>
          {todo.priority !== "low" && (
            <Chip color={PRIORITY_COLOR[todo.priority]} variant="soft" size="sm" className="hidden shrink-0 sm:inline-flex">{PRIORITY_LABEL[todo.priority]}</Chip>
          )}
          <span className={`w-14 shrink-0 text-right text-xs font-medium ${overdue ? "text-(--status-danger-text)" : "text-(--text-muted)"}`}>
            {relativeDateLabel(todo.dueDate, todayDate)}
          </span>
        </Checkbox.Content>
      </Checkbox>
      {todo.canChangeVisibility && onChangeVisibility && (
        <IconButton
          icon={todo.visibility === "workspace" ? "candado" : "compartir"}
          label={todo.visibility === "workspace" ? `Hacer privado: ${todo.title}` : `Compartir con la agencia: ${todo.title}`}
          onPress={() => onChangeVisibility(todo.id, todo.visibility === "workspace" ? "private" : "workspace")}
        />
      )}
    </li>
  );
}

/** Panel «Hoy» del espacio (#75, sección 1): vencidos, hoy, próximos y sin fecha; los hechos quedan aparte. */
export function HoyPanel({ todos, notes, todayDate, filter, recentlyDone, freshIds, onToggle, onChangeVisibility, onClearFilter, onClose, className }: HoyPanelProps) {
  const notesById = new Map(notes.map((note) => [note.id, note]));
  const active = todos.filter((todo) => !todo.isDone || recentlyDone.has(todo.id));
  const done = todos.filter((todo) => todo.isDone && !recentlyDone.has(todo.id));
  const visibleGroups = GROUP_ORDER.filter((group) => !filter || (filter === "vencidos" ? group === "vencidos" : group === "hoy"));
  const grouped = visibleGroups
    .map((group) => ({ group, items: active.filter((todo) => todoGroup(todo, todayDate) === group) }))
    .filter((entry) => entry.items.length > 0);
  const nothingToday = !active.some((todo) => !todo.isDone && todo.dueDate !== null && todo.dueDate <= todayDate);

  return (
    <GlassPanel
      id="panel-hoy"
      title={filter === "vencidos" ? "Hoy · solo vencidos" : filter === "hoy" ? "Hoy · solo para hoy" : "Hoy"}
      icon="sol"
      onClose={onClose}
      className={className}
      actions={
        filter && (
          <Button size="sm" variant="tertiary" onPress={onClearFilter} className="hubly-pop">
            Quitar filtro ×
          </Button>
        )
      }
    >
      {nothingToday && !filter && (
        <div className="hubly-pop flex items-center gap-4 px-4 pt-4 pb-2">
          <Hubi acabado="volumen" tamano={64} decorativo className="hubly-float" />
          <p className="m-0 text-sm leading-relaxed text-(--text-secondary)">
            No tienes pendientes para hoy. Captura el primero abajo o pulsa <Kbd><Kbd.Content>C</Kbd.Content></Kbd>.
          </p>
        </div>
      )}
      {grouped.map(({ group, items }) => (
        <div key={group} className="pb-1">
          <h3 className={`m-0 px-4 pt-3 pb-1 text-xs font-semibold tracking-(--tracking-wider) uppercase ${GROUP_COLOR[group]}`}>
            {TODO_GROUP_LABEL[group]} · {items.filter((todo) => !todo.isDone).length}
          </h3>
          <ul className="m-0 list-none px-1 py-0">
            {items.map((todo) => (
              <TodoRow key={todo.id} todo={todo} note={todo.noteId ? notesById.get(todo.noteId) : undefined} todayDate={todayDate} fresh={freshIds.has(todo.id)} onToggle={onToggle} onChangeVisibility={onChangeVisibility} />
            ))}
          </ul>
        </div>
      ))}
      {filter && grouped.length === 0 && (
        <p className="m-0 px-4 py-6 text-sm text-(--text-secondary)">{filter === "vencidos" ? "No tienes nada vencido." : "No tienes pendientes para hoy."}</p>
      )}
      {!filter && done.length > 0 && (
        <Disclosure className="border-t border-(--glass-line) px-1 pb-2">
          <Disclosure.Heading>
            <Disclosure.Trigger className="flex w-full cursor-pointer items-center justify-between rounded-lg border-0 bg-transparent px-3 py-3 text-xs font-semibold tracking-(--tracking-wider) text-(--text-muted) uppercase hover:bg-(--glass-hover)">
              Hechos · {done.length}
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <ul className="m-0 list-none p-0">
              {done.map((todo) => (
                <TodoRow key={todo.id} todo={todo} note={todo.noteId ? notesById.get(todo.noteId) : undefined} todayDate={todayDate} fresh={false} onToggle={onToggle} onChangeVisibility={onChangeVisibility} />
              ))}
            </ul>
          </Disclosure.Content>
        </Disclosure>
      )}
    </GlassPanel>
  );
}

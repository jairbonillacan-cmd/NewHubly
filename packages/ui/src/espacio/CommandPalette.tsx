"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Kbd } from "@heroui/react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { Icon, type IconName } from "./icons";
import type { EspacioNote, EspacioTodo } from "./types";

export interface PaletteAction {
  id: string;
  label: string;
  /** Línea corta bajo el nombre: qué pasa al elegirla. */
  hint?: string;
  icon: IconName;
  run: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PaletteAction[];
  notes: EspacioNote[];
  todos: EspacioTodo[];
  onOpenNote: (id: string) => void;
  onFocusTodo: (id: string) => void;
  onCreateTodo?: (title: string) => void;
  examples?: readonly string[];
}

interface Option {
  key: string;
  group: "Acciones" | "Notas" | "Pendientes";
  label: string;
  hint?: string | undefined;
  icon: IconName;
  run: () => void;
}

const MAX_PER_GROUP = 6;

/** Ejemplos que se escriben solos en el campo vacío (issue 133); con movimiento reducido se queda el primero. */
export const PALETTE_EXAMPLES = ["Nueva nota", "Busca una nota o un pendiente", "Cambiar fondo", "Crear agencia", "Modo enfoque"] as const;
const TYPE_MS = 55;
const HOLD_MS = 1600;

function useTypedPlaceholder(active: boolean, examples: readonly string[]) {
  const [text, setText] = useState<string>(examples[0] ?? "");
  useEffect(() => {
    if (!active || !examples.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(examples[0] ?? "");
      return;
    }
    let example = 0;
    let length = 0;
    let erasing = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const target = examples[example]!;
      if (!erasing && length < target.length) length += 1;
      else if (!erasing) { erasing = true; timer = setTimeout(tick, HOLD_MS); return; }
      else if (length > 0) length -= 1;
      else { erasing = false; example = (example + 1) % examples.length; }
      setText(examples[example]!.slice(0, length));
      timer = setTimeout(tick, erasing ? TYPE_MS / 2 : TYPE_MS);
    };
    setText("");
    timer = setTimeout(tick, TYPE_MS * 4);
    return () => clearTimeout(timer);
  }, [active, examples]);
  return text;
}

/** Paleta de comandos (#81, rediseño issue 133): acciones, notas y pendientes; Enter sin resultados crea el pendiente. */
export function CommandPalette({ isOpen, onOpenChange, actions, notes, todos, onOpenNote, onFocusTodo, onCreateTodo, examples = PALETTE_EXAMPLES }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const placeholder = useTypedPlaceholder(isOpen && query === "", examples);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActive(0);
    }
  }, [isOpen]);

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (text: string) => !q || text.toLowerCase().includes(q);
    const actionOptions = actions.filter((action) => match(action.label)).map<Option>((action) => ({ key: `a-${action.id}`, group: "Acciones", label: action.label, hint: action.hint, icon: action.icon, run: action.run }));
    const noteOptions = notes
      .filter((note) => !note.isArchived && (match(note.title) || match(note.content)))
      .slice(0, MAX_PER_GROUP)
      .map<Option>((note) => ({ key: `n-${note.id}`, group: "Notas", label: note.title || "Nota sin título", hint: note.isPinned ? "Nota fijada" : "Abre la nota", icon: "nota", run: () => onOpenNote(note.id) }));
    const todoOptions = todos
      .filter((todo) => !todo.isDone && match(todo.title))
      .slice(0, MAX_PER_GROUP)
      .map<Option>((todo) => ({ key: `t-${todo.id}`, group: "Pendientes", label: todo.title, hint: "Lo muestra en Hoy", icon: "check", run: () => onFocusTodo(todo.id) }));
    return [...actionOptions, ...noteOptions, ...todoOptions];
  }, [query, actions, notes, todos, onOpenNote, onFocusTodo]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => onOpenChange(false);
  const runOption = (option: Option) => {
    close();
    option.run();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (options.length ? (index + 1) % options.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (options.length ? (index - 1 + options.length) % options.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[active];
      if (option) runOption(option);
      else if (query.trim() && onCreateTodo) {
        close();
        onCreateTodo(query.trim());
      }
    }
  };

  const groups = (["Acciones", "Notas", "Pendientes"] as const).map((group) => ({ group, items: options.map((option, index) => ({ option, index })).filter(({ option }) => option.group === group) }));
  const activeId = options[active] ? `${listId}-${options[active].key}` : undefined;

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="hubly-palette-overlay fixed inset-0 z-50 flex items-start justify-center bg-(--glass-hover) px-3 pt-20 backdrop-blur-sm">
      <Modal className="hubly-palette w-full max-w-2xl">
        <Dialog aria-label="Buscar o ejecutar" className="hubly-pop-surface flex max-h-160 flex-col overflow-hidden rounded-3xl text-(--text-primary) outline-none">
          <div className="flex items-center gap-4 border-b border-(--glass-line) px-6">
            <Icon name="buscar" className="size-6 shrink-0 text-(--text-muted)" strokeWidth={2.25} />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              aria-label="Buscar o ejecutar"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="hubly-palette-input h-18 min-w-0 grow border-0 bg-transparent text-xl text-(--text-primary) placeholder:text-(--text-muted)"
            />
            <Kbd className="hidden sm:inline-flex"><Kbd.Abbr keyValue="ctrl" /><Kbd.Content>K</Kbd.Content></Kbd>
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Resultados" className="m-0 min-h-0 grow list-none overflow-y-auto p-0 pb-2">
            {groups.map(({ group, items }) =>
              items.length === 0 ? null : (
                <li key={group} role="presentation">
                  <p className="m-0 px-6 pt-5 pb-2 text-xs font-bold tracking-(--tracking-widest) text-(--text-muted) uppercase">{group}</p>
                  <ul role="group" aria-label={group} className="m-0 list-none p-0">
                    {items.map(({ option, index }) => (
                      <li
                        key={option.key}
                        id={`${listId}-${option.key}`}
                        role="option"
                        aria-selected={index === active}
                        data-index={index}
                        onMouseMove={() => setActive(index)}
                        onClick={() => runOption(option)}
                        className="hubly-palette-row group flex cursor-pointer items-center gap-4 px-6 py-3 aria-selected:bg-(--accent-primary-subtle)"
                      >
                        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-(--glass-hover) text-(--text-secondary) transition-colors group-aria-selected:bg-(--accent-primary) group-aria-selected:text-(--text-on-accent)">
                          <Icon name={option.icon} className="size-5" />
                        </span>
                        <span className="flex min-w-0 grow flex-col">
                          <span className="truncate text-base font-semibold group-aria-selected:text-(--accent-primary)">{option.label}</span>
                          {option.hint && <span className="truncate text-sm text-(--text-secondary)">{option.hint}</span>}
                        </span>
                        <Icon name="chevron" className="size-4 shrink-0 text-(--text-muted) transition-transform group-aria-selected:translate-x-0.5 group-aria-selected:text-(--accent-primary)" />
                      </li>
                    ))}
                  </ul>
                </li>
              ),
            )}
            {options.length === 0 && (
              <li role="presentation" className="px-6 py-8 text-center text-sm text-(--text-secondary)">
                Nada coincide con «{query}».{onCreateTodo && " Pulsa Enter para crearlo como pendiente."}
              </li>
            )}
          </ul>
          <div aria-hidden="true" className="flex items-center gap-4 border-t border-(--glass-line) bg-(--glass-hover) px-6 py-3 text-xs text-(--text-secondary)">
            <span className="flex items-center gap-1.5"><Kbd><Kbd.Content>↑</Kbd.Content></Kbd><Kbd><Kbd.Content>↓</Kbd.Content></Kbd> Navegar</span>
            <span className="flex items-center gap-1.5"><Kbd><Kbd.Content>↵</Kbd.Content></Kbd> Abrir</span>
            <button type="button" tabIndex={-1} onClick={close} className="ml-auto flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs text-(--text-secondary)"><Kbd><Kbd.Content>Esc</Kbd.Content></Kbd> Cerrar</button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

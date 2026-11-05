"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button, Kbd } from "@heroui/react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { Icon, type IconName } from "./icons";
import type { EspacioNote, EspacioTodo } from "./types";

export interface PaletteAction {
  id: string;
  label: string;
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
  onCreateTodo: (title: string) => void;
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

/** Paleta de comandos (#81): acciones, notas y pendientes; Enter sin resultados crea el pendiente. */
export function CommandPalette({ isOpen, onOpenChange, actions, notes, todos, onOpenNote, onFocusTodo, onCreateTodo }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActive(0);
    }
  }, [isOpen]);

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (text: string) => !q || text.toLowerCase().includes(q);
    const actionOptions = actions.filter((action) => match(action.label)).map<Option>((action) => ({ key: `a-${action.id}`, group: "Acciones", label: action.label, icon: action.icon, run: action.run }));
    const noteOptions = notes
      .filter((note) => !note.isArchived && (match(note.title) || match(note.content)))
      .slice(0, MAX_PER_GROUP)
      .map<Option>((note) => ({ key: `n-${note.id}`, group: "Notas", label: note.title || "Nota sin título", hint: note.isPinned ? "Fijada" : undefined, icon: "nota", run: () => onOpenNote(note.id) }));
    const todoOptions = todos
      .filter((todo) => !todo.isDone && match(todo.title))
      .slice(0, MAX_PER_GROUP)
      .map<Option>((todo) => ({ key: `t-${todo.id}`, group: "Pendientes", label: todo.title, icon: "check", run: () => onFocusTodo(todo.id) }));
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
      else if (query.trim()) {
        close();
        onCreateTodo(query.trim());
      }
    }
  };

  const groups = (["Acciones", "Notas", "Pendientes"] as const).map((group) => ({ group, items: options.map((option, index) => ({ option, index })).filter(({ option }) => option.group === group) }));
  const activeId = options[active] ? `${listId}-${options[active].key}` : undefined;

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="fixed inset-0 z-50 flex items-start justify-center bg-(--glass-hover) px-3 pt-24 backdrop-blur-xs">
      <Modal className="hubly-pop w-full max-w-xl">
        <Dialog aria-label="Buscar o ejecutar" className="hubly-pop-surface overflow-hidden rounded-2xl text-(--text-primary) outline-none">
          <div className="flex items-center gap-3 border-b border-(--glass-line) px-4">
            <Icon name="buscar" className="size-5 text-(--text-muted)" />
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
              placeholder="Busca notas y pendientes, o escribe una acción"
              className="h-14 min-w-0 grow border-0 bg-transparent text-base text-(--text-primary) outline-none placeholder:text-(--text-muted)"
            />
            <Button size="sm" variant="ghost" onPress={close} aria-label="Cerrar (Esc)">
              <Kbd><Kbd.Content>Esc</Kbd.Content></Kbd>
            </Button>
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Resultados" className="m-0 max-h-96 list-none overflow-y-auto p-2">
            {groups.map(({ group, items }) =>
              items.length === 0 ? null : (
                <li key={group} role="presentation">
                  <p className="m-0 px-2.5 pt-2 pb-1 text-xs font-semibold text-(--text-muted)">{group}</p>
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
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-(--accent-primary-subtle) aria-selected:text-(--accent-primary)"
                      >
                        <Icon name={option.icon} />
                        <span className="grow truncate">{option.label}</span>
                        {option.hint && <span className="text-xs text-(--text-muted)">{option.hint}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ),
            )}
            {options.length === 0 && (
              <li role="presentation" className="px-3 py-6 text-center text-sm text-(--text-secondary)">
                Nada coincide con «{query}». Pulsa Enter para crearlo como pendiente.
              </li>
            )}
          </ul>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

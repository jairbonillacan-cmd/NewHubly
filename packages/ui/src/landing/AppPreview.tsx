"use client";

import { Button, Checkbox, Chip } from "@heroui/react";
import { useState, type FormEvent } from "react";
import { Hubi } from "../components/brand/Hubi";

type Priority = "Alta" | "Media";

interface PreviewTodo {
  id: number;
  title: string;
  priority: Priority;
  date: "Ayer" | "Hoy";
  done: boolean;
}

const INITIAL_TODOS: PreviewTodo[] = [
  { id: 1, title: "Mandar minuta a Café Aurora", priority: "Alta", date: "Ayer", done: false },
  { id: 2, title: "Revisar copys de noviembre", priority: "Alta", date: "Hoy", done: false },
  { id: 3, title: "Pedir fotos de producto al estudio", priority: "Media", date: "Hoy", done: false },
  { id: 4, title: "Proponer la parrilla de diciembre", priority: "Media", date: "Hoy", done: false },
];

const NOTE_TODO = "Preparar las 12 piezas de noviembre";
const MAX_TODOS = 7;

/** Vista de ejemplo de Hoy que se puede usar: marcar pendientes, agregar uno y crear uno desde la nota. No guarda nada. */
export function AppPreview() {
  const [todos, setTodos] = useState(INITIAL_TODOS);
  const [draft, setDraft] = useState("Llamar a Lumen para el shooting");
  const [noteUsed, setNoteUsed] = useState(false);

  const overdue = todos.filter((todo) => todo.date === "Ayer" && !todo.done).length;
  const today = todos.filter((todo) => todo.date === "Hoy" && !todo.done).length;

  const toggle = (id: number) => setTodos((list) => list.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)));
  const add = (title: string, priority: Priority) =>
    setTodos((list) => [...list, { id: Date.now(), title, priority, date: "Hoy" as const, done: false }].slice(-MAX_TODOS));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    add(title, "Media");
    setDraft("");
  };

  return (
    <section aria-label="Prueba la pantalla Hoy" className="relative mx-auto mt-16 w-full max-w-6xl px-4 lg:mt-28 lg:px-6">
      <div className="hubly-enter overflow-hidden rounded-3xl border border-(--border-default) bg-(--surface-subtle) shadow-(--glass-shadow)" data-delay="4">
        <div className="flex h-13 items-center gap-3 border-b border-(--border-default) bg-(--surface-raised) px-5">
          <span className="text-sm font-semibold text-(--text-primary)">Espacio personal</span>
          <span className="hidden text-sm text-(--text-muted) sm:inline">› Hoy</span>
          <span className="grow" />
          <span aria-live="polite" className="flex gap-2">
            <Chip key={`v${overdue}`} color="danger" variant="soft" size="sm" className="hubly-pop">
              {overdue} {overdue === 1 ? "vencido" : "vencidos"}
            </Chip>
            <Chip key={`h${today}`} color="accent" variant="soft" size="sm" className="hubly-pop">
              {today} para hoy
            </Chip>
          </span>
        </div>
        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:p-6">
          <div className="overflow-hidden rounded-2xl border border-(--border-default) bg-(--surface-raised)">
            <div className="border-b border-(--border-default) px-5 py-4 text-base font-bold text-(--text-primary)">Hoy</div>
            <ul className="m-0 list-none p-0 py-1">
              {todos.map((todo) => (
                <li key={todo.id} className="hubly-pop">
                  <Checkbox isSelected={todo.done} onChange={() => toggle(todo.id)} className="w-full">
                    <Checkbox.Content className="flex w-full cursor-pointer flex-row items-center gap-3.5 px-5 py-3 text-left hover:bg-(--surface-subtle)">
                      <Checkbox.Control className="size-4.5 shrink-0 rounded-md">
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <span className={`grow text-sm font-medium transition-colors lg:text-base ${todo.done ? "text-(--text-muted) line-through" : "text-(--text-primary)"}`}>{todo.title}</span>
                      <Chip color={todo.priority === "Alta" ? "warning" : "default"} variant="soft" size="sm" className="hidden sm:inline-flex">
                        {todo.priority}
                      </Chip>
                      <span className={`w-11 text-right text-sm font-medium ${todo.date === "Ayer" && !todo.done ? "text-(--status-danger-text)" : "text-(--text-muted)"}`}>{todo.date}</span>
                    </Checkbox.Content>
                  </Checkbox>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-5">
            <div className="hidden flex-col gap-2.5 rounded-2xl border border-(--border-default) bg-(--surface-raised) px-5 py-4 lg:flex">
              <span className="text-base font-bold text-(--text-primary)">Junta con Café Aurora</span>
              <span className="text-sm leading-relaxed text-(--text-secondary)">Quedamos en 12 piezas para noviembre, tono cercano. Las promos van en historias.</span>
              <Button
                variant={noteUsed ? "ghost" : "outline"}
                size="sm"
                isDisabled={noteUsed}
                onPress={() => {
                  add(NOTE_TODO, "Alta");
                  setNoteUsed(true);
                }}
                className="self-start"
              >
                {noteUsed ? "Pendiente creado ✓" : "Crear pendiente de esta nota"}
              </Button>
            </div>
            <form onSubmit={submit} className="flex items-center gap-2.5 rounded-2xl border border-(--border-default) bg-(--surface-raised) py-2.5 pr-2.5 pl-5 focus-within:border-(--accent-primary)">
              <label htmlFor="hubly-preview-capture" className="sr-only">
                Nuevo pendiente
              </label>
              <input
                id="hubly-preview-capture"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escribe un pendiente…"
                maxLength={60}
                className="min-w-0 grow border-0 bg-transparent text-base text-(--text-primary) outline-none placeholder:text-(--text-muted) lg:text-sm"
              />
              <Button type="submit" variant="primary" size="sm" className="shrink-0">
                Agregar
              </Button>
            </form>
          </div>
        </div>
      </div>
      <p className="mt-3 mb-0 text-center text-xs text-(--text-muted)">Ejemplo ilustrativo: márcalo o agrega un pendiente. No se guarda nada.</p>
      <span className="pointer-events-none absolute -top-36 right-2 hidden lg:block">
        <span className="hubly-float block">
          <Hubi acabado="volumen" pose="laptop" tamano={180} decorativo />
        </span>
      </span>
    </section>
  );
}

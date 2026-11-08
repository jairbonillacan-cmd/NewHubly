import type { ReactNode } from "react";
import type { IconName } from "./icons";
import type { LayoutId } from "./preferencias";
import { PRIORITY_LABEL, type CaptureAnalysis, type EspacioNote, type EspacioTodo, type HoyFilter, type NoteSaveState } from "./types";

export interface Shortcut { key: string; label: string; run: () => void }
type DockAction = Shortcut & { icon: IconName };

export interface CaptureFieldProps {
  label: string;
  hint: string;
  shortcut: string;
  submitIcon?: ReactNode;
  chips: (text: string) => { label: string; color: "accent" | "warning" | "success" | "default" }[];
  linked?: { label: string; remove: () => void } | undefined;
  onSubmit: (text: string) => void;
  error?: string | null | undefined;
}

export interface DockSuggestion { message: string; action?: { label: string; run: () => void; pending?: boolean } }

export interface DockConfig {
  label: string;
  context: string;
  actions: DockAction[];
  entry: CaptureFieldProps;
  waiting: { detail: string; items: { id: string; title: string }[]; filters: { label: string; selected: boolean; run: () => void }[] };
  pace: { done: number; total: number; label: string };
  views: { id: string; label: string; icon: IconName; selected: boolean; run: () => void }[];
  saved: string;
  suggestion?: DockSuggestion | null;
}

export function createShortcutRegistry(shortcuts: readonly Shortcut[]) {
  const byKey = new Map<string, Shortcut>();
  for (const shortcut of shortcuts) {
    const key = shortcut.key.toLowerCase();
    if (byKey.has(key)) throw new Error(`Atajo duplicado: ${shortcut.key}`);
    byKey.set(key, shortcut);
  }
  return (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey) return;
    const withModifier = event.ctrlKey || event.metaKey;
    const target = event.target as HTMLElement | null;
    // Mientras se escribe, las teclas sueltas son texto; las combinaciones con Ctrl o Cmd (Ctrl K) siguen activas.
    if (!withModifier && (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? ""))) return;
    const shortcut = byKey.get(`${withModifier ? "ctrl " : ""}${event.key.toLowerCase()}`);
    if (shortcut) {
      event.preventDefault();
      shortcut.run();
    }
  };
}

const VIEWS = [
  { id: "libre", label: "Libre", icon: "libre" },
  { id: "lado", label: "Lado a lado", icon: "lado" },
  { id: "enfoque", label: "Enfoque", icon: "enfoque" },
] as const;
const SAVED = { saved: "Todo guardado", saving: "Guardando…", error: "Sin guardar" };

export function createTodayDock({ todos, date, layout, onLayout, filter, onFilter, entry, createNote, saveState, suggestion = null }: {
  todos: EspacioTodo[]; date: string; layout: LayoutId; onLayout: (layout: LayoutId) => void;
  filter: HoyFilter; onFilter: (filter: HoyFilter) => void; entry: CaptureFieldProps;
  createNote: () => void; saveState: NoteSaveState; suggestion?: DockSuggestion | null;
}): DockConfig {
  const due = todos.filter((todo) => todo.dueDate === date);
  const pending = due.filter((todo) => !todo.isDone);
  const overdue = todos.filter((todo) => !todo.isDone && todo.dueDate && todo.dueDate < date);
  return {
    label: "Dock de Hoy", context: "Todo tu espacio",
    actions: [{ key: "N", label: "Nota", icon: "nota", run: createNote }],
    entry,
    waiting: { detail: `${overdue.length} ${overdue.length === 1 ? "vencido" : "vencidos"} · ${pending.length} para hoy`, items: [...overdue, ...pending],
      filters: (["vencidos", "hoy"] as const).map((id) => ({ label: id === "hoy" ? "Para hoy" : "Vencidos", selected: filter === id, run: () => onFilter(filter === id ? null : id) })) },
    pace: { done: due.length - pending.length, total: due.length, label: `${due.length - pending.length} de ${due.length} · hechos hoy` },
    views: VIEWS.map((view) => ({ ...view, selected: view.id === layout, run: () => onLayout(view.id) })),
    saved: SAVED[saveState], suggestion,
  };
}

export function findNoteByQuery(notes: EspacioNote[], query: string | null): EspacioNote | null {
  if (!query) return null;
  return notes.find((note) => !note.isArchived && note.title.toLowerCase().includes(query.toLowerCase())) ?? null;
}

export function captureChips(analysis: CaptureAnalysis, notes: EspacioNote[]): ReturnType<CaptureFieldProps["chips"]> {
  const chips: ReturnType<CaptureFieldProps["chips"]> = [];
  if (analysis.dueKeyword) chips.push({ label: analysis.dueKeyword === "hoy" ? "Hoy" : "Mañana", color: "accent" });
  if (analysis.priority) chips.push({ label: PRIORITY_LABEL[analysis.priority], color: "warning" });
  if (analysis.noteQuery) {
    const note = findNoteByQuery(notes, analysis.noteQuery);
    chips.push(note ? { label: `Nota: ${note.title}`, color: "success" } : { label: `Sin nota «${analysis.noteQuery}»`, color: "default" });
  }
  return chips;
}

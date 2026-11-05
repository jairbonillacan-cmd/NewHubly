// Datos que pinta el espacio de Hoy (#75). La app web los adapta desde sus Server Actions; aquí no hay acceso a datos.

export type EspacioPriority = "low" | "medium" | "high";
export type NoteSaveState = "saved" | "saving" | "error";
export type HoyFilter = "vencidos" | "hoy" | null;

export interface EspacioTodo {
  id: string;
  title: string;
  detail?: string;
  priority: EspacioPriority;
  dueDate: string | null;
  isDone: boolean;
  noteId: string | null;
}

export interface EspacioNote {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isArchived: boolean;
}

export interface CaptureAnalysis {
  title: string;
  dueDate: string | null;
  dueKeyword: "hoy" | "mañana" | null;
  priority: EspacioPriority | null;
  noteQuery: string | null;
}

export interface CaptureInput {
  title: string;
  priority: EspacioPriority;
  dueDate: string | null;
  noteId: string | null;
}

export const PRIORITY_LABEL: Record<EspacioPriority, string> = { high: "Alta", medium: "Media", low: "Baja" };

const dayIndex = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

/** «Ayer», «Hoy», «Mañana» o la fecha corta («4 nov»), relativa al día local de la persona. */
export function relativeDateLabel(date: string | null, today: string): string {
  if (!date) return "Sin fecha";
  const diff = dayIndex(date) - dayIndex(today);
  if (diff === 0) return "Hoy";
  if (diff === -1) return "Ayer";
  if (diff === 1) return "Mañana";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)).replace(".", "");
}

/** «martes 4 de noviembre». */
export function longDateLabel(date: string): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export type TodoGroupId = "vencidos" | "hoy" | "proximos" | "sin_fecha";

export const TODO_GROUP_LABEL: Record<TodoGroupId, string> = { vencidos: "Vencidos", hoy: "Hoy", proximos: "Próximos", sin_fecha: "Sin fecha" };

export function todoGroup(todo: Pick<EspacioTodo, "dueDate">, today: string): TodoGroupId {
  if (!todo.dueDate) return "sin_fecha";
  if (todo.dueDate < today) return "vencidos";
  return todo.dueDate === today ? "hoy" : "proximos";
}

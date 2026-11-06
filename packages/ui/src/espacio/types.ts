// Datos que pinta el espacio de Hoy (#75). La app web los adapta desde sus Server Actions; aquí no hay acceso a datos.

export type EspacioPriority = "low" | "medium" | "high";
export type NoteSaveState = "saved" | "saving" | "error";
export type HoyFilter = "vencidos" | "hoy" | null;
/** Visibilidad de un elemento en una agencia (ADR 0007): privado para su autor o compartido con la agencia. */
export type EspacioVisibility = "private" | "workspace";
export type EspacioRole = "owner" | "admin" | "editor" | "viewer";
export type EspacioInviteRole = Exclude<EspacioRole, "owner">;

export interface EspacioWorkspace { id: string; name: string; kind: "personal" | "agency"; role: EspacioRole }
export interface EspacioMember { userId: string; role: EspacioRole; isCurrentUser: boolean }
export interface EspacioInvitation { id: string; email: string; role: EspacioInviteRole; expiresAt: string }

export const ROLE_LABEL: Record<EspacioRole, string> = { owner: "Propietario", admin: "Administrador", editor: "Editor", viewer: "Lectura" };

/** Roles que la persona puede asignar a un miembro. Refleja las políticas RLS de la migración 1B; el servidor decide. */
export function assignableRoles(actor: EspacioRole, member: EspacioMember, ownerCount: number): EspacioRole[] {
  if (member.isCurrentUser) return actor === "owner" && ownerCount >= 2 ? ["owner", "admin", "editor", "viewer"] : [];
  if (actor === "owner") return member.role === "owner" && ownerCount < 2 ? [] : ["owner", "admin", "editor", "viewer"];
  if (actor === "admin" && (member.role === "editor" || member.role === "viewer")) return ["editor", "viewer"];
  return [];
}

export function canRemoveMember(actor: EspacioRole, member: EspacioMember, ownerCount: number): boolean {
  if (member.isCurrentUser) return false;
  if (actor === "owner") return member.role !== "owner" || ownerCount >= 2;
  return actor === "admin" && (member.role === "editor" || member.role === "viewer");
}

export interface EspacioTodo {
  id: string;
  title: string;
  detail?: string;
  priority: EspacioPriority;
  dueDate: string | null;
  isDone: boolean;
  noteId: string | null;
  visibility?: EspacioVisibility;
  /** Solo su autor, con rol distinto de lectura, puede cambiar la visibilidad. */
  canChangeVisibility?: boolean;
}

export interface EspacioNote {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isArchived: boolean;
  visibility?: EspacioVisibility;
  canChangeVisibility?: boolean;
  /** Nota compartida que la persona no puede editar (rol de lectura o sin permiso). */
  readOnly?: boolean;
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

export type ProfileOutcome<T> = { ok: true; value: T } | { ok: false; message: string };

/** Perfil de la persona (issue 135): nombre visible, foto y cómo cambiarlos. El servidor valida todo otra vez. */
export interface EspacioProfile {
  name: string | null;
  avatarUrl: string | null;
  onUploadAvatar: (file: File) => Promise<ProfileOutcome<string>>;
  onRemoveAvatar: () => Promise<ProfileOutcome<null>>;
  onSaveName: (name: string) => Promise<ProfileOutcome<string>>;
  /** Estado de presencia (issue 143); sin `onChangePresence`, el menú no ofrece cambiarlo. */
  presence?: EspacioPresence | undefined;
  onChangePresence?: ((status: EspacioPresence) => Promise<ProfileOutcome<EspacioPresence>>) | undefined;
}

export type EspacioPresence = "online" | "away" | "dnd";

export const PRESENCE: Record<EspacioPresence, { label: string; hint: string }> = {
  online: { label: "En línea", hint: "Tu equipo ve que estás disponible" },
  away: { label: "Ausente", hint: "Vuelves en un rato" },
  dnd: { label: "No molestar", hint: "Silencia los avisos y el chat" },
};

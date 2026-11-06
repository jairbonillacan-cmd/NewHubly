"use client";
import { canEditItem, parseQuickCapture, suggestOverdueTodos } from "@hubly/application";
import { createTodoSchema, type PresenceStatus, type UserPreferences } from "@hubly/contracts";
import { BienvenidaDialog, EspacioEstado, EspacioHoy, type HerramientaId, type CaptureInput, type EspacioNote, type EspacioTodo, type EspacioVisibility, type EspacioWorkspace, type NoteSaveState } from "@hubly/ui";
import React, { useEffect, useRef, useState } from "react";
import {
  archiveNoteAction, changeNoteVisibilityAction, changeTodoVisibilityAction, changeWorkspaceMemberRoleAction, createAgencyWorkspaceAction,
  createNoteAction, createTodoAction, createTodoFromNoteAction, exportWorkspaceAction, inviteWorkspaceMemberAction, loadWorkspaceDashboardAction,
  pinNoteAction, removeOrLeaveWorkspaceMemberAction, removeWallpaperAction, revokeWorkspaceInvitationAction, saveNoteAction, saveUserPreferencesAction, selectActiveWorkspaceAction, toggleTodoAction,
  updateTodoAction, uploadWallpaperAction, removeAvatarAction, saveDisplayNameAction, savePresenceAction, uploadAvatarAction,
  type WorkspaceInvitationSummary, type WorkspaceMemberSummary, type WorkspaceNote, type WorkspaceSummary, type WorkspaceTodo, type WorkspaceTodoView,
} from "../actions";
import { signOutAction } from "../actions/auth";
import { fromEspacioPreferencias, toEspacioPreferencias } from "./preferences";

export type ScreenStatus = "loading" | "unauthenticated" | "error" | "ready";
export type AutosaveState = NoteSaveState;
export interface ActionErrorState { message: string; retry: () => Promise<void>; }
export interface WorkspaceScreenProps {
  initialStatus?: ScreenStatus; errorMessage?: string; todayDate?: string; initialTimezone?: string; initialView?: WorkspaceTodoView;
  initialTodos?: WorkspaceTodo[]; initialNotes?: WorkspaceNote[]; initialActionError?: ActionErrorState | null;
  currentUserId?: string; initialActiveWorkspace?: WorkspaceSummary; initialWorkspaces?: WorkspaceSummary[];
  initialMembers?: WorkspaceMemberSummary[]; initialPendingInvitations?: WorkspaceInvitationSummary[];
  /** Preferencias visuales guardadas (#83); sin ellas el espacio usa las de por defecto. */
  initialPreferences?: UserPreferences;
  /** URL firmada de «Tu imagen» si es el fondo elegido (#84). */
  initialWallpaperImageUrl?: string | null;
  /** Primera entrada después de confirmar la cuenta: se abre la bienvenida (?bienvenida=1). */
  showWelcome?: boolean;
  /** Correo de la sesión, para la inicial del avatar. */
  currentUserEmail?: string | null;
  /** Nombre visible y foto de perfil firmada (issue 135). */
  currentUserName?: string | null;
  initialAvatarUrl?: string | null;
  initialPresence?: PresenceStatus;
  /** Herramienta abierta al cargar (?herramienta=). */
  initialHerramienta?: HerramientaId;
  onSavePreferences?: (patch: Partial<UserPreferences>) => Promise<unknown>;
  onRetry?: () => void; onLoginRedirect?: () => void; onTimezoneRefresh?: () => void; onSignOut?: () => Promise<void>;
  onSaveNote?: (note: WorkspaceNote, nextTitle: string, nextContent: string) => Promise<WorkspaceNote>;
  onCreateTodo?: (input: { title: string; priority: "low" | "medium" | "high"; dueDate: string | null; noteId: string | null }) => Promise<WorkspaceTodo>;
  onToggleTodo?: (todoId: string) => Promise<WorkspaceTodo | void>;
  onExport?: (format: "json" | "md") => Promise<{ filename: string; content: string } | void>;
}

export const TZ_REFRESH_STORAGE_KEY = "hubly_tz_refresh_attempted";
export const PREFERENCES_SAVE_DELAY_MS = 600;

export function shouldTriggerQuickCaptureShortcut(key: string, targetTag?: string, isContentEditable?: boolean): boolean {
  if (key !== "c" && key !== "/") return false;
  const tag = (targetTag ?? "").toUpperCase();
  return tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !isContentEditable;
}

export function classifyTodoItemForView(t: WorkspaceTodo, refDate: string): WorkspaceTodoView {
  if (t.isDone) return "done";
  if (t.dueDate && t.dueDate <= refDate) return "today";
  return t.dueDate && t.dueDate > refDate ? "upcoming" : "no_date";
}

export function syncTimeZoneAndMaybeRefresh(
  browserTz: string | undefined,
  initialTimezone: string | undefined,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined,
  onRefresh: () => void,
  setCookie?: (cookie: string) => void,
): boolean {
  if (!browserTz) return false;
  setCookie?.(`hubly_tz=${encodeURIComponent(browserTz)}; path=/; max-age=31536000; SameSite=Lax`);
  if (!initialTimezone || initialTimezone === browserTz) return false;
  if (storage?.getItem(TZ_REFRESH_STORAGE_KEY) === browserTz) return false;
  storage?.setItem(TZ_REFRESH_STORAGE_KEY, browserTz);
  onRefresh();
  return true;
}

export async function executeProtectedAction(
  fallbackMsg: string, fn: () => Promise<void>, onSessionExpired: () => void, onActionError: (state: ActionErrorState | null) => void,
): Promise<void> {
  onActionError(null);
  try { await fn(); } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Sesión caducada") || msg.includes("No hay una sesión activa")) { onSessionExpired(); return; }
    // Una Server Action que llama a redirect() rechaza su promesa con un digest «NEXT_REDIRECT;…» mientras Next navega.
    // Es la sesión caducada (#92): se avisa y no se muestra como fallo.
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) { onSessionExpired(); return; }
    // En producción Next sustituye el mensaje de los errores del servidor por uno genérico en inglés y añade «digest».
    // Ese texto no ayuda a la persona: se muestra el mensaje propio de la acción (#92).
    const sanitizedByServer = typeof (err as { digest?: unknown } | null)?.digest === "string";
    onActionError({ message: sanitizedByServer || !msg ? fallbackMsg : msg, retry: () => executeProtectedAction(fallbackMsg, fn, onSessionExpired, onActionError) });
  }
}

/** Permisos de interfaz por elemento en una agencia. Solo orientan: RLS y los casos de uso deciden en el servidor (ADR 0007). */
export function itemPermissions(ws: WorkspaceSummary | undefined, currentUserId: string, createdBy: string) {
  if (!ws || ws.kind !== "agency") return {};
  const isAuthor = Boolean(currentUserId) && createdBy === currentUserId;
  return { canChangeVisibility: isAuthor && ws.role !== "viewer", readOnly: !isAuthor && ws.role === "viewer" };
}

const toEspacioTodo = (t: WorkspaceTodo, ws: WorkspaceSummary | undefined, userId: string): EspacioTodo => {
  const { canChangeVisibility } = itemPermissions(ws, userId, t.createdBy);
  return { id: t.id, title: t.title, detail: t.detail, priority: t.priority, dueDate: t.dueDate ?? null, isDone: t.isDone, noteId: t.noteId ?? null, ...(ws?.kind === "agency" ? { visibility: t.visibility ?? "private", canChangeVisibility: Boolean(canChangeVisibility) } : {}) };
};
const toEspacioNote = (n: WorkspaceNote, ws: WorkspaceSummary | undefined, userId: string): EspacioNote => {
  const { canChangeVisibility, readOnly } = itemPermissions(ws, userId, n.createdBy);
  return { id: n.id, title: n.title, content: n.content, isPinned: n.isPinned, isArchived: n.isArchived, ...(ws?.kind === "agency" ? { visibility: n.visibility ?? "private", canChangeVisibility: Boolean(canChangeVisibility), readOnly: Boolean(readOnly) } : {}) };
};
const toEspacioWorkspace = (w: WorkspaceSummary): EspacioWorkspace => ({ id: w.id, name: w.name, kind: w.kind, role: w.role });

export function WorkspaceScreen({
  initialStatus = "ready", errorMessage = "No se pudo cargar tu espacio de trabajo.",
  todayDate = "2026-11-04", initialTimezone, initialTodos = [], initialNotes = [], initialActionError = null,
  currentUserId = "", initialActiveWorkspace, initialWorkspaces, initialMembers = [], initialPendingInvitations = [], initialPreferences, initialWallpaperImageUrl = null, showWelcome = false, currentUserEmail = null, currentUserName = null, initialAvatarUrl = null, initialPresence = "online", initialHerramienta, onSavePreferences,
  onRetry, onLoginRedirect, onTimezoneRefresh, onSignOut, onSaveNote, onCreateTodo, onToggleTodo, onExport,
}: WorkspaceScreenProps) {
  const [todos, setTodos] = useState<WorkspaceTodo[]>(initialTodos);
  const [movingOverdue, setMovingOverdue] = useState(false);
  const movingOverdueRef = useRef(false);
  const [notes, setNotes] = useState<WorkspaceNote[]>(initialNotes);
  const [activeWs, setActiveWs] = useState<WorkspaceSummary | undefined>(initialActiveWorkspace);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>(initialWorkspaces ?? (initialActiveWorkspace ? [initialActiveWorkspace] : []));
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>(initialMembers);
  const [invitations, setInvitations] = useState<WorkspaceInvitationSummary[]>(initialPendingInvitations);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(showWelcome);
  // Se quita ?bienvenida=1 de la URL para que recargar la página no la vuelva a abrir.
  const closeWelcome = () => {
    setWelcomeOpen(false);
    window.history.replaceState(window.history.state, "", window.location.pathname);
  };
  const prefsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefs = useRef<Partial<UserPreferences>>({});
  // Al salir de la pantalla o cerrar la pestaña, el cambio pendiente se envía en vez de perderse.
  const flushRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    const onPageHide = () => { void flushRef.current(); };
    window.addEventListener("pagehide", onPageHide);
    return () => { window.removeEventListener("pagehide", onPageHide); void flushRef.current(); };
  }, []);
  const wsId = activeWs?.id;
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionErrorState | null>(initialActionError);
  const [noteStatus, setNoteStatus] = useState<Record<string, NoteSaveState>>({});
  const redirectLogin = () => { if (onLoginRedirect) onLoginRedirect(); else if (typeof window !== "undefined") window.location.assign("/login"); };
  const runSafe = (fallbackMsg: string, fn: () => Promise<void>) => executeProtectedAction(fallbackMsg, fn, redirectLogin, setActionError);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof document !== "undefined" && typeof window !== "undefined") {
      syncTimeZoneAndMaybeRefresh(
        tz, initialTimezone, window.sessionStorage,
        () => { if (onTimezoneRefresh) onTimezoneRefresh(); else window.location.reload(); },
        (c) => { document.cookie = c; },
      );
    }
  }, [initialTimezone, onTimezoneRefresh]);

  if (initialStatus !== "ready") {
    if (initialStatus === "loading") return <EspacioEstado busy message="Cargando tu espacio de trabajo…" />;
    if (initialStatus === "unauthenticated") {
      return (
        <EspacioEstado
          title="Sesión caducada o sin permiso"
          message="Tu sesión ha caducado o no tienes permiso para acceder a este espacio. Inicia sesión nuevamente para continuar en Hoy."
          action={{ label: "Volver a iniciar sesión", onPress: redirectLogin }}
        />
      );
    }
    return <EspacioEstado pose="reparar" title="No se pudo cargar Hoy" message={errorMessage} action={{ label: "Reintentar", onPress: () => { if (onRetry) onRetry(); else window.location.reload(); } }} />;
  }

  const handleCapture = async (input: CaptureInput): Promise<boolean> => {
    const parsed = createTodoSchema.safeParse({ title: input.title, priority: input.priority, dueDate: input.dueDate, noteId: input.noteId });
    if (!parsed.success) { setCaptureError(parsed.error.issues[0]?.message ?? "Datos inválidos"); return false; }
    setCaptureError(null);
    let created = false;
    await runSafe("No se pudo crear el pendiente.", async () => {
      const todo = onCreateTodo
        ? await onCreateTodo({ title: parsed.data.title, priority: parsed.data.priority, dueDate: parsed.data.dueDate ?? null, noteId: parsed.data.noteId ?? null })
        : parsed.data.noteId
          ? await createTodoFromNoteAction(parsed.data.noteId, { title: parsed.data.title, priority: parsed.data.priority, dueDate: parsed.data.dueDate ?? todayDate }, wsId)
          : await createTodoAction({ title: parsed.data.title, priority: parsed.data.priority, dueDate: parsed.data.dueDate ?? null }, wsId);
      setTodos((prev) => [todo, ...prev.filter((t) => t.id !== todo.id)]);
      created = true;
    });
    return created;
  };

  const handleToggleTodo = (id: string) => runSafe("No se pudo actualizar el pendiente.", async () => {
    const updated = onToggleTodo ? await onToggleTodo(id) : await toggleTodoAction(id, wsId);
    setTodos((prev) => prev.map((t) => (t.id === id ? (updated ?? { ...t, isDone: !t.isDone, doneAt: !t.isDone ? `${todayDate}T12:00:00.000Z` : null }) : t)));
  });

  const overdue = suggestOverdueTodos(todos.filter((todo) => canEditItem(currentUserId, activeWs?.role ?? "owner", todo)), todayDate);
  const moveOverdueToToday = (ids: readonly string[]) => {
    const remaining = new Set(ids);
    return runSafe("No se pudieron pasar los pendientes a hoy.", async () => {
      if (movingOverdueRef.current) return;
      movingOverdueRef.current = true;
      setMovingOverdue(true);
      try {
        for (const id of remaining) {
          const updated = await updateTodoAction({ id, dueDate: todayDate }, wsId);
          setTodos((prev) => prev.map((todo) => todo.id === id ? { ...todo, dueDate: updated.dueDate } : todo));
          remaining.delete(id);
        }
      } finally {
        movingOverdueRef.current = false;
        setMovingOverdue(false);
      }
    });
  };

  const handleCreateNote = async (): Promise<string | null> => {
    let createdId: string | null = null;
    await runSafe("No se pudo crear la nota.", async () => {
      const created = await createNoteAction({ title: "Nueva nota", content: "" }, wsId);
      setNotes((prev) => [created, ...prev]); setNoteStatus((prev) => ({ ...prev, [created.id]: "saved" }));
      createdId = created.id;
    });
    return createdId;
  };

  const handleSaveNote = (id: string, nextTitle: string, nextContent: string) => {
    const note = notes.find((n) => n.id === id); if (!note) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: nextTitle, content: nextContent } : n)));
    setNoteStatus((prev) => ({ ...prev, [id]: "saving" }));
    void executeProtectedAction("No se pudo guardar la nota.", async () => {
      const saved = onSaveNote ? await onSaveNote(note, nextTitle, nextContent) : await saveNoteAction({ id, title: nextTitle, content: nextContent, expectedVersion: note.version }, wsId);
      setNotes((prev) => prev.map((n) => (n.id === id ? saved : n))); setNoteStatus((prev) => ({ ...prev, [id]: "saved" }));
    }, redirectLogin, (errState) => {
      if (errState) setNoteStatus((prev) => ({ ...prev, [id]: "error" }));
      setActionError(errState);
    });
  };

  const handleTogglePin = (id: string) => runSafe("No se pudo fijar la nota.", async () => {
    const target = notes.find((n) => n.id === id); if (!target) return;
    const saved = await pinNoteAction(id, !target.isPinned, wsId);
    setNotes((prev) => prev.map((n) => (n.id === id ? saved : n)));
  });

  const handleToggleArchive = (id: string) => runSafe("No se pudo archivar la nota.", async () => {
    const target = notes.find((n) => n.id === id); if (!target) return;
    const saved = await archiveNoteAction(id, !target.isArchived, wsId);
    setNotes((prev) => prev.map((n) => (n.id === id ? saved : n)));
  });

  const handleDownloadExport = (format: "json" | "md") => runSafe("No se pudo exportar tu espacio.", async () => {
    const custom = onExport ? await onExport(format) : undefined;
    const remote = custom ? undefined : await exportWorkspaceAction(wsId);
    const filename = custom?.filename ?? (format === "json" ? remote!.jsonFilename : remote!.mdFilename);
    const content = custom?.content ?? (format === "json" ? remote!.jsonContent : remote!.markdownContent);
    if (typeof document !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(new Blob([content], { type: format === "json" ? "application/json" : "text/markdown;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }
  });

  const reload = async (nextWsId?: string) => {
    const fresh = await loadWorkspaceDashboardAction(nextWsId);
    setActiveWs(fresh.activeWorkspace); setWorkspaces(fresh.workspaces); setMembers(fresh.members); setInvitations(fresh.pendingInvitations);
    setNotes(fresh.notes); setTodos(fresh.todos); setNoteStatus({});
  };
  const handleSelectWorkspace = (id: string) => runSafe("No se pudo cambiar de espacio.", async () => { await selectActiveWorkspaceAction(id); setInviteLink(null); await reload(id); });
  const handleCreateAgency = async (name: string): Promise<boolean> => {
    let ok = false;
    await runSafe("No se pudo crear la agencia.", async () => { const created = await createAgencyWorkspaceAction({ name }); setInviteLink(null); await reload(created.id); ok = true; });
    return ok;
  };
  const handleInvite = (email: string, role: "admin" | "editor" | "viewer") => runSafe("No se pudo generar la invitación.", async () => {
    const res = await inviteWorkspaceMemberAction({ ...(wsId ? { workspaceId: wsId } : {}), email, role });
    setInviteLink(res.invitationPath); setInvitations((prev) => [res.invitation, ...prev.filter((i) => i.id !== res.invitation.id)]);
  });
  const handleCopyInvite = (link: string) => { if (typeof window !== "undefined") void window.navigator.clipboard?.writeText(`${window.location.origin}${link}`); };
  const handleRevoke = (invitationId: string) => runSafe("No se pudo revocar la invitación.", async () => {
    await revokeWorkspaceInvitationAction({ ...(wsId ? { workspaceId: wsId } : {}), invitationId }); setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
  });
  const handleChangeRole = (targetUserId: string, role: "owner" | "admin" | "editor" | "viewer") => runSafe("No se pudo cambiar el rol.", async () => {
    await changeWorkspaceMemberRoleAction({ ...(wsId ? { workspaceId: wsId } : {}), targetUserId, role }); await reload(wsId);
  });
  const handleRemove = (targetUserId: string) => runSafe("No se pudo quitar al miembro.", async () => {
    await removeOrLeaveWorkspaceMemberAction({ ...(wsId ? { workspaceId: wsId } : {}), targetUserId }); await reload(wsId);
  });
  const handleLeave = () => runSafe("No se pudo salir de la agencia.", async () => {
    const res = await removeOrLeaveWorkspaceMemberAction({ ...(wsId ? { workspaceId: wsId } : {}), targetUserId: currentUserId }); setInviteLink(null);
    await reload(res.leftCurrentWorkspace ? undefined : wsId);
  });
  const handleNoteVisibility = (noteId: string, visibility: EspacioVisibility) => runSafe("No se pudo cambiar la visibilidad de la nota.", async () => {
    const saved = await changeNoteVisibilityAction({ noteId, visibility }, wsId);
    setNotes((prev) => prev.map((n) => (n.id === noteId ? saved : n)));
    // Al privatizar, el servidor desliga los pendientes de otros o compartidos; se recarga para reflejarlo.
    if (visibility === "private") await reload(wsId);
  });
  const handleTodoVisibility = (todoId: string, visibility: EspacioVisibility) => runSafe("No se pudo cambiar la visibilidad del pendiente.", async () => {
    const saved = await changeTodoVisibilityAction({ todoId, visibility }, wsId);
    setTodos((prev) => prev.map((t) => (t.id === todoId ? saved : t)));
  });

  // El slider de opacidad cambia muchas veces seguidas: se guarda una sola vez cuando la persona se detiene.
  // Los cambios se acumulan en un solo envío, así un cambio de tema no descarta un cambio de fondo pendiente.
  const flushPreferences = async () => {
    if (prefsTimer.current) { clearTimeout(prefsTimer.current); prefsTimer.current = null; }
    const toSave = pendingPrefs.current;
    if (Object.keys(toSave).length === 0) return;
    pendingPrefs.current = {};
    await runSafe("No se pudieron guardar tus preferencias.", async () => { await (onSavePreferences ?? saveUserPreferencesAction)(toSave); });
  };
  const persistPreferences = (patch: Partial<UserPreferences>, delayMs = PREFERENCES_SAVE_DELAY_MS) => {
    pendingPrefs.current = { ...pendingPrefs.current, ...patch };
    if (prefsTimer.current) clearTimeout(prefsTimer.current);
    prefsTimer.current = setTimeout(() => { void flushPreferences(); }, delayMs);
  };
  flushRef.current = flushPreferences;

  const handleSignOut = () => runSafe("No se pudo cerrar la sesión.", async () => {
    await flushPreferences();
    if (onSignOut) await onSignOut();
    else await signOutAction();
    redirectLogin();
  });

  return (
    <>
    <BienvenidaDialog isOpen={welcomeOpen} onClose={closeWelcome} {...(activeWs ? { workspaceName: activeWs.name } : {})} />
    <EspacioHoy
      todayDate={todayDate}
      {...(initialPreferences ? { initialPreferences: toEspacioPreferencias(initialPreferences), initialThemePreference: initialPreferences.theme } : {})}
      onPreferencesChange={(prefs) => persistPreferences(fromEspacioPreferencias(prefs))}
      onThemeChange={(theme) => persistPreferences({ theme }, 0)}
      wallpaperImageUrl={initialWallpaperImageUrl}
      userEmail={currentUserEmail}
      profile={{
        name: currentUserName,
        avatarUrl: initialAvatarUrl,
        presence: initialPresence,
        onChangePresence: async (status) => { try { return await savePresenceAction(status); } catch { return { ok: false as const, message: "No se pudo cambiar tu estado." }; } },
        onUploadAvatar: async (file) => {
          const form = new FormData();
          form.set("foto", file);
          try { return await uploadAvatarAction(form); } catch { return { ok: false as const, message: "No se pudo subir tu foto. Inténtalo de nuevo." }; }
        },
        onRemoveAvatar: async () => { try { return await removeAvatarAction(); } catch { return { ok: false as const, message: "No se pudo quitar tu foto." }; } },
        onSaveName: async (name) => { try { return await saveDisplayNameAction(name); } catch { return { ok: false as const, message: "No se pudo guardar tu nombre." }; } },
      }}
      initialHerramienta={initialHerramienta}
      onUploadWallpaper={async (file) => {
        const form = new FormData();
        form.set("imagen", file);
        try {
          return await uploadWallpaperAction(form);
        } catch {
          return { ok: false as const, message: "No se pudo subir tu imagen. Inténtalo de nuevo." };
        }
      }}
      onRemoveWallpaper={() => runSafe("No se pudo quitar tu imagen.", async () => { await removeWallpaperAction(); })}
      timezone={initialTimezone}
      todos={todos.map((t) => toEspacioTodo(t, activeWs, currentUserId))}
      notes={notes.map((n) => toEspacioNote(n, activeWs, currentUserId))}
      noteSaveStates={noteStatus}
      actionError={actionError ? { message: actionError.message, onRetry: () => { void actionError.retry(); } } : null}
      captureError={captureError}
      overdueSuggestion={overdue ? { message: overdue.message, action: { label: overdue.actionLabel, run: () => void moveOverdueToToday(overdue.todoIds), pending: movingOverdue } } : null}
      analyzeCapture={(text) => parseQuickCapture(text, todayDate)}
      onCapture={handleCapture}
      onToggleTodo={handleToggleTodo}
      onCreateNote={handleCreateNote}
      onSaveNote={handleSaveNote}
      onTogglePin={(id) => void handleTogglePin(id)}
      onToggleArchive={(id) => void handleToggleArchive(id)}
      onExport={(format) => void handleDownloadExport(format)}
      onSignOut={() => void handleSignOut()}
      {...(activeWs ? { activeWorkspace: toEspacioWorkspace(activeWs), workspaces: workspaces.map(toEspacioWorkspace) } : {})}
      members={members.map((m) => ({ userId: m.userId, role: m.role as EspacioWorkspace["role"], isCurrentUser: m.userId === currentUserId }))}
      invitations={invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt }))}
      inviteLink={inviteLink}
      onSelectWorkspace={(id) => void handleSelectWorkspace(id)}
      onCreateAgency={handleCreateAgency}
      onInvite={(email, role) => void handleInvite(email, role)}
      onCopyInvite={handleCopyInvite}
      onRevokeInvite={(id) => void handleRevoke(id)}
      onChangeRole={(userId, role) => void handleChangeRole(userId, role)}
      onRemoveMember={(userId) => void handleRemove(userId)}
      onLeaveAgency={() => void handleLeave()}
      onChangeNoteVisibility={(id, v) => void handleNoteVisibility(id, v)}
      onChangeTodoVisibility={(id, v) => void handleTodoVisibility(id, v)}
    />
    </>
  );
}

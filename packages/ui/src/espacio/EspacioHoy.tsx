"use client";

import { Button, Dropdown } from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HubiFace } from "../components/brand/HublyLogo";
import { Hubi, type HubiPose } from "../components/brand/Hubi";
import { hydrateThemePreference, useHublyTheme, useHublyThemePreference, type HublyThemePreference } from "../landing/ThemeToggle";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { EquipoDialog, type EquipoDialogMode } from "./EquipoDialog";
import { BackgroundPicker, CaptureField, Dock, DockMore, DockStatus, type WallpaperImageControls } from "./Dock";
import { captureChips, createShortcutRegistry, createTodayDock, findNoteByQuery, type DockSuggestion } from "./dockConfig";
import { Carril, Proximamente, resumenSemana } from "./Carril";
import { HERRAMIENTAS, herramientaPorId, isHerramientaId, type HerramientaId } from "./herramientas";
import { Icon } from "./icons";
import { HoyPanel } from "./HoyPanel";
import { Lienzo, LienzoBarra, type LienzoBarraProps, type LienzoItem } from "./Lienzo";
import { NotaPanel } from "./NotaPanel";
import { NotasPanel } from "./NotasPanel";
import { FotoRecorte } from "./FotoRecorte";
import { PerfilDialog, avatarFileError } from "./PerfilDialog";
import { useEspacioPreferencias, type EspacioPreferencias } from "./preferencias";
import { TopBar } from "./TopBar";
import {
  relativeDateLabel, type CaptureAnalysis, type CaptureInput, type EspacioInvitation, type EspacioInviteRole, type EspacioMember,
  type EspacioNote, type EspacioPresence, type EspacioProfile, type EspacioRole, type EspacioTodo, type EspacioVisibility, type EspacioWorkspace, type HoyFilter, type NoteSaveState,
} from "./types";
import { Wallpaper } from "./Wallpaper";

const TOAST_MS = 5000;
const CHAT_PALETTE_EXAMPLES = ["Volver a Hoy", "Equipo e invitaciones", "Editar perfil"] as const;
/** Ancho a partir del cual se usa la distribución de escritorio (coincide con el punto «lg» de Tailwind). */
const DESKTOP_MIN_WIDTH = 1024;

export interface EspacioHoyProps {
  todayDate: string;
  /** Preferencias guardadas de la persona (#83). Sin ellas se usan las de por defecto. */
  initialPreferences?: EspacioPreferencias | undefined;
  /** Se llama con las preferencias completas cada vez que cambian (fondo, opacidad, distribución o paneles). */
  onPreferencesChange?: ((prefs: EspacioPreferencias) => void) | undefined;
  /** Tema guardado de la persona, incluido «system» (#105); si llega, manda sobre el del navegador al entrar. */
  initialThemePreference?: HublyThemePreference | undefined;
  /** Se llama cuando la persona cambia de tema desde el menú del perfil o la paleta. */
  onThemeChange?: ((theme: HublyThemePreference) => void) | undefined;
  /** «Tu imagen» (#84): URL firmada inicial y acciones de subir y quitar. Sin acciones, el mosaico sale como no disponible. */
  wallpaperImageUrl?: string | null | undefined;
  onUploadWallpaper?: WallpaperImageControls["onUpload"] | undefined;
  onRemoveWallpaper?: (() => Promise<void>) | undefined;
  timezone?: string | undefined;
  todos: EspacioTodo[];
  notes: EspacioNote[];
  noteSaveStates: Record<string, NoteSaveState>;
  actionError?: { message: string; onRetry: () => void } | null;
  captureError?: string | null;
  overdueSuggestion?: DockSuggestion | null;
  analyzeCapture: (text: string) => CaptureAnalysis;
  onCapture: (input: CaptureInput) => Promise<boolean | void>;
  onToggleTodo: (id: string) => Promise<void> | void;
  onCreateNote: () => Promise<string | null | void>;
  onSaveNote: (id: string, title: string, content: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onExport: (format: "json" | "md") => void;
  onSignOut: () => void;
  /** Espacio activo y los demás de la persona; sin agencias, solo el personal (#64, #78). */
  workspaces?: EspacioWorkspace[];
  activeWorkspace?: EspacioWorkspace;
  members?: EspacioMember[];
  invitations?: EspacioInvitation[];
  inviteLink?: string | null;
  /** Espacio al que se está cambiando: mientras llega, se oculta lo del anterior y se muestra un estado de carga (#215). */
  switchingTo?: string | null;
  onSelectWorkspace?: (id: string) => void;
  onCreateAgency?: (name: string) => Promise<boolean | void> | void;
  onInvite?: (email: string, role: EspacioInviteRole) => void;
  onCopyInvite?: (link: string) => void;
  onRevokeInvite?: (id: string) => void;
  onChangeRole?: (userId: string, role: EspacioRole) => void;
  onRemoveMember?: (userId: string) => void;
  onLeaveAgency?: () => void;
  onChangeNoteVisibility?: (id: string, visibility: EspacioVisibility) => void;
  onChangeTodoVisibility?: (id: string, visibility: EspacioVisibility) => void;
  /** Correo de la sesión, para la inicial del avatar. */
  userEmail?: string | null | undefined;
  /** Nombre, foto y cómo cambiarlos (issue 135). Sin él, editar el perfil sale como «Muy pronto». */
  profile?: EspacioProfile | undefined;
  /** Herramienta abierta al cargar (?herramienta=); por defecto, Hoy. */
  initialHerramienta?: HerramientaId | undefined;
  chat?: { href: string; todayHref: string; unreadHref: string; unread: number | null; active: boolean; content?: ReactNode };
}

/** Acomodo inicial de los paneles en el lienzo de escritorio (issue 136), en píxeles del lienzo. */
const LIENZO_INICIAL = {
  hoy: { x: 0, y: 0, w: 620, h: 640 },
  nota: { x: 644, y: 0, w: 480, h: 400 },
  notas: { x: 644, y: 424, w: 480, h: 216 },
} as const;

/** true desde el ancho de escritorio; en el servidor y en pruebas, false (se ve la versión apilada). */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

/** Carril compacto o completo; se recuerda en este navegador hasta que exista su preferencia en la cuenta. */
const CARRIL_STORAGE_KEY = "hubly-carril";

export const PERSONAL_WORKSPACE: EspacioWorkspace = { id: "personal", name: "Espacio personal", kind: "personal", role: "owner" };
const noop = () => {};

interface ToastState { id: number; message: string; undo?: (() => void) | undefined }

/** Espacio de Hoy con paneles de cristal sobre fondo personal (propuesta B, #75). Sin datos propios: todo llega por props. */
export function EspacioHoy(props: EspacioHoyProps) {
  const { todayDate, timezone, todos, notes, noteSaveStates, actionError, captureError, analyzeCapture, onCapture, onToggleTodo, onCreateNote, onSaveNote, onTogglePin, onToggleArchive, onExport, onSignOut } = props;
  const chat = props.chat;
  const activeWorkspace = props.activeWorkspace ?? PERSONAL_WORKSPACE;
  const workspaces = props.workspaces ?? [activeWorkspace];
  const switching = props.switchingTo != null;
  const target = workspaces.find((ws) => ws.id === props.switchingTo);
  const targetName = target ? (target.kind === "agency" ? target.name : "Espacio personal") : "tu espacio";
  const targetKind = target?.kind ?? "agency";
  // La entrada animada solo se usa después de un cambio: al abrir la página ya entran los paneles.
  const [switched, setSwitched] = useState(false);
  if (switching && !switched) setSwitched(true);
  const hide = switching ? { "data-cambiando": "", inert: true } : {};
  const [teamMode, setTeamMode] = useState<EquipoDialogMode | null>(null);
  const [prefs, setPrefs] = useEspacioPreferencias(props.initialPreferences, props.onPreferencesChange);
  const [theme, setTheme] = useHublyTheme();
  const [themePreference] = useHublyThemePreference();
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(props.wallpaperImageUrl ?? null);
  const imagenControls: WallpaperImageControls | undefined = props.onUploadWallpaper && props.onRemoveWallpaper
    ? {
        url: wallpaperUrl,
        onUpload: async (file) => {
          const result = await props.onUploadWallpaper!(file);
          if (result.ok) setWallpaperUrl(result.url);
          return result;
        },
        onRemove: async () => {
          await props.onRemoveWallpaper!();
          setWallpaperUrl(null);
          setPrefs({ fondo: "contornos" });
        },
      }
    : undefined;
  const onThemeChangeRef = useRef(props.onThemeChange);
  onThemeChangeRef.current = props.onThemeChange;
  const initialPreference = props.initialThemePreference ?? null;
  const lastPersistedTheme = useRef<HublyThemePreference | null>(initialPreference);
  const skipFirstTheme = useRef(true);

  // El tema guardado en el servidor manda al entrar; después, cada cambio de preferencia se guarda una sola vez.
  useEffect(() => {
    if (initialPreference) hydrateThemePreference(initialPreference);
    // Solo al montar: initialPreference es el valor con el que se cargó la página.
  }, []);
  useEffect(() => {
    if (skipFirstTheme.current) {
      skipFirstTheme.current = false;
      if (lastPersistedTheme.current === null) lastPersistedTheme.current = themePreference;
      return;
    }
    if (themePreference === lastPersistedTheme.current) return;
    lastPersistedTheme.current = themePreference;
    onThemeChangeRef.current?.(themePreference);
  }, [themePreference]);
  const [filter, setFilter] = useState<HoyFilter>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(() => notes.find((n) => n.isPinned && !n.isArchived)?.id ?? notes.find((n) => !n.isArchived)?.id ?? null);
  const [linkedNoteId, setLinkedNoteId] = useState<string | null>(null);
  const [recentlyDone, setRecentlyDone] = useState<ReadonlySet<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState<"desktop" | "mobile" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [herramienta, setHerramienta] = useState<HerramientaId>(props.initialHerramienta ?? "hoy");
  const [carrilExpandido, setCarrilExpandido] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(props.profile?.name ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(props.profile?.avatarUrl ?? null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [recorte, setRecorte] = useState<{ file: File; error: string | null } | null>(null);
  const [presence, setPresence] = useState<EspacioPresence>(props.profile?.presence ?? "online");

  useEffect(() => {
    try { setCarrilExpandido(localStorage.getItem(CARRIL_STORAGE_KEY) === "completo"); } catch { /* sin almacenamiento: compacto */ }
    const onPopState = () => {
      const id = new URLSearchParams(window.location.search).get("herramienta");
      setHerramienta(isHerramientaId(id) ? id : "hoy");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const toggleCarril = () => {
    const next = !carrilExpandido;
    setCarrilExpandido(next);
    try { localStorage.setItem(CARRIL_STORAGE_KEY, next ? "completo" : "compacto"); } catch { /* se queda solo en esta visita */ }
  };

  // Cambiar de herramienta no recarga la página: el marco se queda y la URL guarda cuál está abierta.
  const selectHerramienta = (id: HerramientaId) => {
    if (chat?.active) {
      window.location.assign(id === "hoy" ? chat.todayHref : `${chat.todayHref}&herramienta=${id}`);
      return;
    }
    if (id === herramienta) return;
    setHerramienta(id);
    const url = new URL(window.location.href);
    if (id === "hoy") url.searchParams.delete("herramienta");
    else url.searchParams.set("herramienta", id);
    window.history.pushState(window.history.state, "", url);
    document.getElementById("contenido")?.focus();
  };
  const desktop = useIsDesktop();
  const [barraSlot, setBarraSlot] = useState<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const desktopCapture = useRef<HTMLInputElement>(null);
  const mobileCapture = useRef<HTMLInputElement>(null);
  const initialIds = useRef(new Set(todos.map((todo) => todo.id)));
  const freshIds = useMemo(() => new Set(todos.filter((todo) => !initialIds.current.has(todo.id)).map((todo) => todo.id)), [todos]);

  // La opacidad elegida se aplica como variable CSS del contenedor; es un valor calculado en tiempo de ejecución.
  useEffect(() => {
    rootRef.current?.style.setProperty("--panel-alpha", String(prefs.opacidad / 100));
  }, [prefs.opacidad]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const isDesktop = () => typeof window !== "undefined" && window.innerWidth >= DESKTOP_MIN_WIDTH;
  const focusCapture = useCallback(() => {
    const target = isDesktop() ? desktopCapture.current : mobileCapture.current;
    target?.focus();
  }, []);

  const showToast = (message: string, undo?: () => void) => setToast({ id: Date.now(), message, undo });

  const toggleTodo = async (id: string) => {
    const todo = todos.find((item) => item.id === id);
    if (!todo) return;
    setRecentlyDone((current) => new Set(current).add(id));
    await onToggleTodo(id);
    if (!todo.isDone) showToast(`Hecho: ${todo.title}`, () => void onToggleTodo(id));
  };

  useEffect(() => {
    if (captureError) setToast({ id: Date.now(), message: captureError });
  }, [captureError]);

  const submitCapture = async (text: string) => {
    const analysis = analyzeCapture(text);
    if (!analysis.title) {
      showToast("Escribe qué hay que hacer, además de la fecha o la prioridad.");
      return;
    }
    const noteId = linkedNoteId ?? findNoteByQuery(notes, analysis.noteQuery)?.id ?? null;
    const dueDate = analysis.dueDate ?? todayDate;
    const ok = await onCapture({ title: analysis.title, priority: analysis.priority ?? "medium", dueDate, noteId });
    if (ok === false) return;
    setLinkedNoteId(null);
    setFilter(null);
    showToast(dueDate === todayDate ? "Agregado a Hoy" : `Agregado a Próximos (${relativeDateLabel(dueDate, todayDate).toLowerCase()})`);
  };

  const createNote = async () => {
    selectHerramienta("hoy");
    const id = await onCreateNote();
    if (id) {
      setOpenNoteId(id);
      setPrefs({ paneles: { nota: true } });
    }
  };

  const openNote = (id: string) => {
    selectHerramienta("hoy");
    setOpenNoteId(id);
    setPrefs({ paneles: { nota: true } });
    if (!isDesktop()) document.getElementById("panel-nota")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const linkCaptureToNote = (id: string) => {
    setLinkedNoteId(id);
    focusCapture();
  };

  const openBackground = () => {
    selectHerramienta("hoy");
    setPickerOpen(isDesktop() ? "desktop" : "mobile");
  };

  // Elegir una foto abre el recorte (issue 150); se sube lo que la persona encuadra.
  const pickAvatar = (file: File) => {
    if (!props.profile) return;
    const invalid = avatarFileError(file);
    if (invalid) return showToast(invalid);
    setRecorte({ file, error: null });
  };
  const uploadRecorte = async (file: File) => {
    if (!props.profile || !recorte) return;
    setAvatarBusy(true);
    const result = await props.profile.onUploadAvatar(file);
    setAvatarBusy(false);
    if (!result.ok) return setRecorte({ ...recorte, error: result.message });
    setAvatarUrl(result.value);
    setRecorte(null);
    showToast("Foto actualizada");
  };

  // El punto cambia al instante; si el servidor no lo guarda, vuelve al anterior y avisa.
  const changePresence = async (status: EspacioPresence) => {
    const onChange = props.profile?.onChangePresence;
    if (!onChange || status === presence) return;
    const previous = presence;
    setPresence(status);
    const result = await onChange(status);
    if (!result.ok) { setPresence(previous); showToast(result.message); }
  };

  const paletteActions: PaletteAction[] = [
    ...(chat?.active ? [{ id: "hoy", label: "Volver a Hoy", hint: "Retoma tus pendientes", icon: "hoy" as const, run: () => selectHerramienta("hoy") }] : []),
    ...(chat && !chat.active ? [{ id: "chat", label: "Abrir chat", hint: "Canales y mensajes de tu agencia", icon: "chat" as const,
      run: () => window.location.assign(chat.href) }] : []),
    { id: "pendiente", label: "Nuevo pendiente", hint: "Escríbelo en la captura de Hoy", icon: "mas", run: () => { selectHerramienta("hoy"); setTimeout(focusCapture, 0); } },
    { id: "nota", label: "Nueva nota", hint: "Se abre lista para escribir", icon: "nota", run: () => void createNote() },
    { id: "fondo", label: "Cambiar fondo", hint: "Elige el fondo de tu espacio", icon: "imagen", run: () => setTimeout(openBackground, 0) },
    prefs.distribucion === "enfoque"
      ? { id: "libre", label: "Salir del modo enfoque", hint: "Vuelven todos tus paneles", icon: "libre", run: () => setPrefs({ distribucion: "libre" }) }
      : { id: "enfoque", label: "Modo enfoque", hint: "Solo el panel de Hoy", icon: "enfoque", run: () => setPrefs({ distribucion: "enfoque" }) },
    { id: "tema", label: theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro", hint: "Cambia los colores de tu espacio", icon: theme === "dark" ? "sol" : "luna", run: () => setTheme(theme === "dark" ? "light" : "dark") },
    ...(props.profile ? [{ id: "perfil", label: "Editar perfil", hint: "Tu nombre y tu foto", icon: "usuario" as const, run: () => setTimeout(() => setProfileOpen(true), 0) }] : []),
    { id: "agencia", label: "Crear agencia", hint: "Para trabajar con tu equipo", icon: "mas", run: () => setTimeout(() => setTeamMode("crear"), 0) },
    ...(activeWorkspace.kind === "agency" ? [{ id: "equipo", label: "Equipo e invitaciones", hint: "Quién está y a quién invitaste", icon: "equipo" as const, run: () => setTimeout(() => setTeamMode("equipo"), 0) }] : []),
    { id: "json", label: "Exportar en JSON", hint: "Descarga todo lo que escribiste", icon: "descargar", run: () => onExport("json") },
    { id: "md", label: "Exportar en Markdown", hint: "Descarga tus notas como texto", icon: "descargar", run: () => onExport("md") },
  ];

  const openedNote = notes.find((note) => note.id === openNoteId) ?? null;
  const overdueCount = todos.filter((todo) => !todo.isDone && todo.dueDate !== null && todo.dueDate < todayDate).length;
  const todayCount = todos.filter((todo) => !todo.isDone && todo.dueDate === todayDate).length;
  const saveValues = Object.values(noteSaveStates);
  const saveState: NoteSaveState = saveValues.includes("error") ? "error" : saveValues.includes("saving") ? "saving" : "saved";
  const layout = prefs.distribucion;
  const panels = layout === "enfoque" ? { hoy: true, nota: false, notas: false } : { ...prefs.paneles, hoy: prefs.paneles.hoy || (!prefs.paneles.nota && !prefs.paneles.notas) };
  const sideCount = Number(panels.nota) + Number(panels.notas);

  const hoyClass = layout === "enfoque" ? "lg:w-full lg:max-w-3xl" : layout === "libre" && sideCount > 0 ? "lg:row-span-2" : "";
  const sideClass = layout === "libre" && sideCount === 1 ? "lg:row-span-2" : "";
  const gridClass =
    layout === "enfoque"
      ? "lg:flex lg:justify-center"
      : layout === "libre" && panels.hoy && sideCount > 0
        ? "lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)]"
        : "lg:grid lg:auto-cols-fr lg:grid-flow-col";

  const linkedNote = notes.find((note) => note.id === linkedNoteId);
  const suggestion = toast
    ? { message: toast.message, ...(toast.undo ? { action: { label: "Deshacer", run: () => { toast.undo?.(); setToast(null); } } } : {}) }
    : props.overdueSuggestion ?? null;
  const dock = !chat?.active && herramienta === "hoy" ? createTodayDock({
    todos, date: todayDate, layout, onLayout: (distribucion) => setPrefs({ distribucion }),
    filter, onFilter: (next) => { setFilter(next); setPrefs({ paneles: { hoy: true } }); },
    createNote: () => void createNote(), exportData: () => onExport("json"), saveState, suggestion,
    entry: {
      label: "Capturar pendiente", hint: "Captura… prueba «llamar a Lumen mañana !alta»", shortcut: "C",
      submitIcon: <HubiFace className="size-5" />,
      linked: linkedNote ? { label: linkedNote.title || "sin título", remove: () => setLinkedNoteId(null) } : undefined,
      chips: (text) => captureChips(analyzeCapture(text), notes),
      onSubmit: (text) => void submitCapture(text), error: captureError,
    },
  }) : null;
  const shortcuts = [
    { key: "Ctrl K", label: "Buscar o ejecutar", run: () => setPaletteOpen(true) },
    { key: "/", label: "Abrir la búsqueda", run: () => setPaletteOpen(true) },
    ...(dock ? [{ key: dock.entry.shortcut, label: "Escribir un pendiente", run: focusCapture }, ...dock.actions] : []),
  ];

  // Un solo oyente de teclado durante toda la visita; en cada render solo cambia el registro al que apunta.
  const dispatchShortcut = useRef<(event: KeyboardEvent) => void>(noop);
  dispatchShortcut.current = createShortcutRegistry(shortcuts);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => dispatchShortcut.current(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hoyPanel = (className: string) => (
    <HoyPanel
      todos={todos}
      notes={notes}
      todayDate={todayDate}
      filter={filter}
      recentlyDone={recentlyDone}
      freshIds={freshIds}
      onToggle={(id) => void toggleTodo(id)}
      onChangeVisibility={props.onChangeTodoVisibility}
      onClearFilter={() => setFilter(null)}
      className={className}
    />
  );
  const notaPanel = (className: string) => (
    <NotaPanel
      note={openedNote}
      linkedTodos={openedNote ? todos.filter((todo) => todo.noteId === openedNote.id) : []}
      saveState={openedNote ? (noteSaveStates[openedNote.id] ?? "saved") : "saved"}
      onSave={onSaveNote}
      onTogglePin={onTogglePin}
      onToggleArchive={onToggleArchive}
      onChangeVisibility={props.onChangeNoteVisibility}
      onCreateTodoFromNote={linkCaptureToNote}
      onCreateNote={() => void createNote()}
      onClose={() => setPrefs({ paneles: { nota: false } })}
      className={className}
    />
  );
  const notasPanel = (className: string) => (
    <NotasPanel
      notes={notes}
      openNoteId={openNoteId}
      onOpen={openNote}
      onCreateNote={() => void createNote()}
      onClose={() => setPrefs({ paneles: { notas: false } })}
      className={className}
    />
  );
  const enLienzo = !chat?.active && desktop && layout === "libre" && herramienta === "hoy";
  // El fondo se elige desde la tuerca; el selector se ancla, invisible, a la barra del lienzo.
  const barraProps: Omit<LienzoBarraProps, "lienzo"> = {
    layout, onLayout: (distribucion) => setPrefs({ distribucion }), onOpenFondo: openBackground,
    fondo: <BackgroundPicker imagen={imagenControls} prefs={prefs} onChange={setPrefs} isOpen={pickerOpen === "desktop"}
      onOpenChange={(open) => setPickerOpen(open ? "desktop" : null)} triggerClassName="pointer-events-none invisible absolute right-2 bottom-full size-0 min-w-0 p-0" />,
  };
  const lienzoItems: LienzoItem[] = [
    ...(panels.hoy ? [{ id: "hoy", rect: LIENZO_INICIAL.hoy, node: hoyPanel("h-full") }] : []),
    ...(panels.nota ? [{ id: "nota", rect: LIENZO_INICIAL.nota, node: notaPanel("h-full") }] : []),
    ...(panels.notas ? [{ id: "notas", rect: LIENZO_INICIAL.notas, node: notasPanel("h-full") }] : []),
  ];

  return (
    // Marco fijo (#105): en escritorio, una cuadrícula con la barra superior, el carril y el dock fijos; solo el contenido se desliza.
    <div ref={rootRef} className={`relative isolate min-h-dvh text-(--text-primary) lg:grid lg:h-dvh lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-[var(--frame-topbar-h)_minmax(0,1fr)_auto] lg:gap-3 lg:overflow-hidden lg:p-3 ${chat?.active ? "flex h-dvh flex-col overflow-hidden" : ""}`}>
      <Wallpaper fondo={prefs.fondo === "imagen" && !wallpaperUrl ? "contornos" : prefs.fondo} imagenUrl={wallpaperUrl} />
      <a href="#contenido" className="sr-only z-50 rounded-lg bg-(--surface-raised) px-3 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Saltar al contenido</a>

      <div className="hubly-marco-arriba sticky top-0 z-30 shrink-0 p-3 lg:static lg:col-span-2 lg:p-0">
        <TopBar
          todayDate={todayDate}
          timezone={timezone}
          shortcuts={shortcuts}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenBackground={openBackground}
          onExport={onExport}
          onSignOut={onSignOut}
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          {...(switching ? { switchingTo: { name: targetName, kind: targetKind } } : {})}
          onSelectWorkspace={props.onSelectWorkspace ?? noop}
          onCreateAgency={() => setTeamMode("crear")}
          onOpenTeam={() => setTeamMode("equipo")}
          toolName={chat?.active ? "Chat" : herramientaPorId(herramienta).nombre}
          panels={prefs.paneles}
          onTogglePanel={(id) => setPrefs({ distribucion: layout === "enfoque" ? "libre" : layout, paneles: { [id]: !prefs.paneles[id] } })}
          focusMode={layout === "enfoque"}
          onToggleFocus={() => setPrefs({ distribucion: layout === "enfoque" ? "libre" : "enfoque" })}
          userEmail={props.userEmail}
          userName={profileName}
          avatarUrl={avatarUrl}
          avatarBusy={avatarBusy}
          presence={presence}
          {...(props.profile?.onChangePresence ? { onChangePresence: (status: EspacioPresence) => void changePresence(status) } : {})}
          {...(props.profile ? { onEditProfile: () => setProfileOpen(true), onPickAvatar: pickAvatar } : {})}
        />
      </div>

      <div className="z-20 hidden min-h-0 lg:col-start-1 lg:row-span-2 lg:row-start-2 lg:block">
        <Carril
          expandido={carrilExpandido}
          onToggleExpandido={toggleCarril}
          activa={chat?.active ? undefined : herramienta}
          chat={chat}
          onSelect={selectHerramienta}
          cargando={switching}
          hoyPendientes={overdueCount + todayCount}
          semana={resumenSemana(todos, todayDate)}
        />
      </div>

      <main id="contenido" tabIndex={-1} className={`relative flex flex-col gap-3 px-3 outline-none lg:col-start-2 lg:row-start-2 lg:min-h-0 lg:p-0 ${chat?.active ? "min-h-0 grow overflow-hidden pb-20" : "pb-44 lg:overflow-y-auto"}`} aria-busy={switching}>
      <div key={activeWorkspace.id} className={`hubly-espacio-escena flex min-h-0 grow flex-col gap-3 ${switched ? "hubly-espacio-entra" : ""}`} {...hide}>
      {actionError && (
        <div role="alert" className="hubly-pop hubly-glass relative z-30 flex shrink-0 items-center justify-between gap-3 rounded-xl border-(--status-danger-text) px-4 py-3 text-sm text-(--status-danger-text)">
          <span>{actionError.message}</span>
          <Button size="sm" variant="danger-soft" onPress={actionError.onRetry}>Reintentar</Button>
        </div>
      )}
      {chat && !chat.active && herramienta === "hoy" && <a href={chat.unread ? chat.unreadHref : chat.href}
        className="hubly-glass flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-(--glass-hover)">
        <Icon name="chat" className="size-5" />
        <span>{chat.unread === null ? "Abrir chat" : chat.unread === 0 ? "Chat al día" : chat.unread === 1 ? "1 conversación sin leer" : `${chat.unread} conversaciones sin leer`}</span>
      </a>}
      {chat?.active ? chat.content : herramienta !== "hoy" ? <Proximamente herramienta={herramientaPorId(herramienta)} /> : enLienzo ? (
        <Lienzo items={lienzoItems} barra={{ slot: barraSlot, ...barraProps }} />
      ) : (
      <div className={`flex flex-col gap-3 lg:min-h-144 lg:grow ${gridClass}`}>
        {panels.hoy && hoyPanel(`max-h-160 lg:max-h-none ${hoyClass}`)}
        {panels.nota && notaPanel(`min-h-72 ${sideClass}`)}
        {panels.notas && notasPanel(sideClass)}
      </div>
      )}
      </div>
      {switching && <div role="status" className="hubly-espacio-carga hubly-glass pointer-events-none absolute inset-x-3 top-0 flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold lg:inset-x-0">Abriendo {targetName}…</div>}
      </main>

      {dock && <div className="hubly-espacio-escena z-20 hidden min-w-0 gap-3 lg:col-start-2 lg:row-start-3 lg:flex lg:items-end" {...hide}>
        <div className="min-w-0 grow"><Dock ref={desktopCapture} config={dock} sinVista /></div>
        {/* Barra propia del lienzo (issue 147): en el lienzo libre la llena el propio lienzo; si no, solo el modo y el fondo. */}
        <div ref={setBarraSlot} className="contents">
          {!enLienzo && <LienzoBarra {...barraProps} />}
        </div>
      </div>}

      <div {...(dock ? { role: "toolbar", "aria-label": dock.label } : {})} className="hubly-glass hubly-barra-movil fixed z-30 flex flex-col gap-2 rounded-(--glass-radius-access-card) p-2 lg:hidden">
        {dock && <div className="hubly-espacio-escena flex flex-col gap-2" {...hide}><DockStatus suggestion={dock.suggestion ?? null} /><CaptureField ref={mobileCapture} {...dock.entry} /></div>}
        <nav aria-label="Navegación del espacio" className={`grid ${chat ? dock ? "grid-cols-5" : "grid-cols-3" : "grid-cols-4"}`}>
          <Button variant="ghost" className="min-h-11" {...(!chat?.active && herramienta === "hoy" ? { "aria-current": "page" } : {})} onPress={() => {
            selectHerramienta("hoy");
            document.getElementById("panel-hoy")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}>Hoy</Button>
          {chat && <a href={chat.href} aria-current={chat.active ? "page" : undefined}
            className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold hover:bg-(--glass-hover)">Chat</a>}
          <Dropdown>
            <Dropdown.Trigger className="min-h-11 px-1 text-xs">Herramientas</Dropdown.Trigger>
            <Dropdown.Popover placement="top" className="hubly-pop-surface hubly-popover-scroll rounded-xl p-1">
              <Dropdown.Menu aria-label="Herramientas" onAction={(id) => { if (typeof id === "string" && isHerramientaId(id)) selectHerramienta(id); }}>
                {HERRAMIENTAS.filter((tool) => tool.id !== "hoy").map((tool) => <Dropdown.Item key={tool.id} id={tool.id} className="min-h-11">{tool.nombre} · Pronto</Dropdown.Item>)}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          {dock && <>
            <BackgroundPicker imagen={imagenControls} prefs={prefs} onChange={setPrefs} isOpen={pickerOpen === "mobile"}
              onOpenChange={(open) => setPickerOpen(open ? "mobile" : null)} triggerLabel="Fondo" triggerClassName="min-h-11 w-full" />
            <DockMore config={dock} extra={<Button variant="ghost" className="min-h-11" onPress={() => document.getElementById("panel-notas")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Notas</Button>} />
          </>}
        </nav>
      </div>

      {herramienta !== "hoy" && toast && (
        <div role="status" key={toast.id} className="hubly-pop hubly-pop-surface fixed bottom-36 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-(--text-primary) lg:bottom-28">
          <span className="max-w-64 truncate">{toast.message}</span>
          {toast.undo && (
            <Button size="sm" variant="ghost" onPress={() => { toast.undo?.(); setToast(null); }} className="text-(--accent-primary)">Deshacer</Button>
          )}
        </div>
      )}

      <EquipoDialog
        mode={teamMode}
        onClose={() => setTeamMode(null)}
        workspace={activeWorkspace}
        members={props.members ?? []}
        invitations={props.invitations ?? []}
        inviteLink={props.inviteLink ?? null}
        onCreateAgency={(name) => { void Promise.resolve(props.onCreateAgency?.(name)).then((ok) => { if (ok !== false) setTeamMode(null); }); }}
        onInvite={props.onInvite ?? noop}
        onCopyInvite={(link) => { props.onCopyInvite?.(link); showToast("Enlace copiado"); }}
        onRevokeInvite={props.onRevokeInvite ?? noop}
        onChangeRole={props.onChangeRole ?? noop}
        onRemoveMember={props.onRemoveMember ?? noop}
        onLeave={() => { setTeamMode(null); props.onLeaveAgency?.(); }}
        onExportOwn={() => onExport("json")}
      />

      {props.profile && (
        <PerfilDialog
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          profile={{ ...props.profile, name: profileName, avatarUrl, email: props.userEmail ?? null, initial: (profileName || props.userEmail)?.trim().charAt(0).toUpperCase() || null }}
          onNameSaved={(name) => { setProfileName(name); showToast("Perfil guardado"); }}
          onAvatarChanged={setAvatarUrl}
          onPickAvatar={pickAvatar}
          avatarBusy={avatarBusy}
        />
      )}
      <FotoRecorte file={recorte?.file ?? null} busy={avatarBusy} error={recorte?.error ?? null} onCancel={() => setRecorte(null)} onConfirm={(file) => void uploadRecorte(file)} />

      <CommandPalette
        isOpen={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={chat?.active ? paletteActions.filter(({ id }) => ["hoy", "tema", "perfil", "equipo", "json", "md"].includes(id)) : paletteActions}
        notes={chat?.active ? [] : notes}
        todos={chat?.active ? [] : todos}
        {...(chat?.active ? { examples: CHAT_PALETTE_EXAMPLES } : {})}
        onOpenNote={openNote}
        onFocusTodo={(id) => {
          selectHerramienta("hoy");
          setFilter(null);
          setPrefs({ paneles: { hoy: true } });
          setTimeout(() => document.getElementById(`pendiente-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
        }}
        {...(!chat?.active ? { onCreateTodo: (title: string) => { selectHerramienta("hoy"); void submitCapture(title); } } : {})}
      />
    </div>
  );
}

export interface EspacioEstadoProps {
  title?: string;
  message: string;
  busy?: boolean;
  pose?: HubiPose;
  action?: { label: string; onPress: () => void };
  children?: ReactNode;
}

/** Estados de carga, sin sesión y error del espacio, sobre el mismo fondo y con Hubi (#75). */
export function EspacioEstado({ title, message, busy, pose = "sentado", action }: EspacioEstadoProps) {
  return (
    <main aria-busy={busy} role={busy ? "status" : "alert"} className="relative isolate flex min-h-dvh items-center justify-center p-4 text-(--text-primary)">
      <Wallpaper fondo="contornos" />
      <div className="hubly-glass hubly-enter flex w-full max-w-md flex-col items-center gap-4 rounded-2xl px-6 py-8 text-center">
        <Hubi acabado="volumen" pose={pose} tamano={96} decorativo {...(busy ? { className: "hubly-float" } : {})} />
        {title && <h1 className="m-0 text-xl font-bold">{title}</h1>}
        <p className="m-0 text-sm leading-relaxed text-(--text-secondary)">{message}</p>
        {action && (
          <Button variant="primary" onPress={action.onPress}>
            {action.label}
          </Button>
        )}
      </div>
    </main>
  );
}

"use client";

import { Button } from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Hubi, type HubiPose } from "../components/brand/Hubi";
import { useHublyTheme, type HublyTheme } from "../landing/ThemeToggle";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { EquipoDialog, type EquipoDialogMode } from "./EquipoDialog";
import { BackgroundPicker, CaptureField, Dock, findNoteByQuery, type WallpaperImageControls } from "./Dock";
import { Carril, Proximamente, resumenSemana } from "./Carril";
import { herramientaPorId, isHerramientaId, type HerramientaId } from "./herramientas";
import { HoyPanel } from "./HoyPanel";
import { Icon } from "./icons";
import { NotaPanel } from "./NotaPanel";
import { NotasPanel } from "./NotasPanel";
import { useEspacioPreferencias, type EspacioPreferencias } from "./preferencias";
import { TopBar } from "./TopBar";
import {
  relativeDateLabel, type CaptureAnalysis, type CaptureInput, type EspacioInvitation, type EspacioInviteRole, type EspacioMember,
  type EspacioNote, type EspacioRole, type EspacioTodo, type EspacioVisibility, type EspacioWorkspace, type HoyFilter, type NoteSaveState,
} from "./types";
import { Wallpaper } from "./Wallpaper";

const TOAST_MS = 5000;
/** Ancho a partir del cual se usa la distribución de escritorio (coincide con el punto «lg» de Tailwind). */
const DESKTOP_MIN_WIDTH = 1024;

export interface EspacioHoyProps {
  todayDate: string;
  /** Preferencias guardadas de la persona (#83). Sin ellas se usan las de por defecto. */
  initialPreferences?: EspacioPreferencias | undefined;
  /** Se llama con las preferencias completas cada vez que cambian (fondo, opacidad, distribución o paneles). */
  onPreferencesChange?: ((prefs: EspacioPreferencias) => void) | undefined;
  /** Tema guardado de la persona; si llega, manda sobre el del navegador al entrar. */
  initialTheme?: HublyTheme | undefined;
  /** Se llama cuando la persona cambia de tema desde el menú de cuenta o la paleta. */
  onThemeChange?: ((theme: HublyTheme) => void) | undefined;
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
  /** Herramienta abierta al cargar (?herramienta=); por defecto, Hoy. */
  initialHerramienta?: HerramientaId | undefined;
}

/** Carril compacto o completo; se recuerda en este navegador hasta que exista su preferencia en la cuenta. */
const CARRIL_STORAGE_KEY = "hubly-carril";

export const PERSONAL_WORKSPACE: EspacioWorkspace = { id: "personal", name: "Espacio personal", kind: "personal", role: "owner" };
const noop = () => {};

interface ToastState { id: number; message: string; undo?: (() => void) | undefined }

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  const tag = el?.tagName ?? "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el?.isContentEditable);
};

/** Espacio de Hoy con paneles de cristal sobre fondo personal (propuesta B, #75). Sin datos propios: todo llega por props. */
export function EspacioHoy(props: EspacioHoyProps) {
  const { todayDate, timezone, todos, notes, noteSaveStates, actionError, captureError, analyzeCapture, onCapture, onToggleTodo, onCreateNote, onSaveNote, onTogglePin, onToggleArchive, onExport, onSignOut } = props;
  const activeWorkspace = props.activeWorkspace ?? PERSONAL_WORKSPACE;
  const workspaces = props.workspaces ?? [activeWorkspace];
  const [teamMode, setTeamMode] = useState<EquipoDialogMode | null>(null);
  const [prefs, setPrefs] = useEspacioPreferencias(props.initialPreferences, props.onPreferencesChange);
  const [theme, setTheme] = useHublyTheme();
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

  // El tema guardado en el servidor manda al entrar; después, cualquier cambio de data-theme (menú de cuenta o paleta) se guarda.
  useEffect(() => {
    if (props.initialTheme && document.documentElement.getAttribute("data-theme") !== props.initialTheme) setTheme(props.initialTheme);
    let last = document.documentElement.getAttribute("data-theme");
    const observer = new MutationObserver(() => {
      const current = document.documentElement.getAttribute("data-theme");
      if (current !== last && (current === "light" || current === "dark")) onThemeChangeRef.current?.(current);
      last = current;
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
    // Solo al montar: initialTheme es el valor con el que se cargó la página.
  }, []);
  const [filter, setFilter] = useState<HoyFilter>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(() => notes.find((n) => n.isPinned && !n.isArchived)?.id ?? notes.find((n) => !n.isArchived)?.id ?? null);
  const [linkedNoteId, setLinkedNoteId] = useState<string | null>(null);
  const [recentlyDone, setRecentlyDone] = useState<ReadonlySet<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState<"desktop" | "mobile" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [herramienta, setHerramienta] = useState<HerramientaId>(props.initialHerramienta ?? "hoy");
  const [carrilExpandido, setCarrilExpandido] = useState(false);

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
    if (id === herramienta) return;
    setHerramienta(id);
    window.history.pushState(window.history.state, "", id === "hoy" ? window.location.pathname : `${window.location.pathname}?herramienta=${id}`);
    document.getElementById("contenido")?.focus();
  };
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        focusCapture();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusCapture]);

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
    const id = await onCreateNote();
    if (id) {
      setOpenNoteId(id);
      setPrefs({ paneles: { nota: true } });
    }
  };

  const openNote = (id: string) => {
    setOpenNoteId(id);
    setPrefs({ paneles: { nota: true } });
    if (!isDesktop()) document.getElementById("panel-nota")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const linkCaptureToNote = (id: string) => {
    setLinkedNoteId(id);
    focusCapture();
  };

  const openBackground = () => setPickerOpen(isDesktop() ? "desktop" : "mobile");

  const paletteActions: PaletteAction[] = [
    { id: "pendiente", label: "Nuevo pendiente", icon: "mas", run: () => setTimeout(focusCapture, 0) },
    { id: "nota", label: "Nueva nota", icon: "nota", run: () => void createNote() },
    { id: "fondo", label: "Cambiar fondo", icon: "imagen", run: () => setTimeout(openBackground, 0) },
    prefs.distribucion === "enfoque"
      ? { id: "libre", label: "Salir del modo enfoque", icon: "libre", run: () => setPrefs({ distribucion: "libre" }) }
      : { id: "enfoque", label: "Modo enfoque", icon: "enfoque", run: () => setPrefs({ distribucion: "enfoque" }) },
    { id: "tema", label: theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro", icon: "sol", run: () => setTheme(theme === "dark" ? "light" : "dark") },
    { id: "agencia", label: "Crear agencia", icon: "mas", run: () => setTimeout(() => setTeamMode("crear"), 0) },
    ...(activeWorkspace.kind === "agency" ? [{ id: "equipo", label: "Equipo e invitaciones", icon: "equipo" as const, run: () => setTimeout(() => setTeamMode("equipo"), 0) }] : []),
    { id: "json", label: "Exportar en JSON", icon: "descargar", run: () => onExport("json") },
    { id: "md", label: "Exportar en Markdown", icon: "descargar", run: () => onExport("md") },
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

  const mobileNav: { label: string; icon: "sol" | "pin" | "buscar"; run: () => void }[] = [
    { label: "Hoy", icon: "sol", run: () => document.getElementById("panel-hoy")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
    { label: "Notas", icon: "pin", run: () => document.getElementById("panel-notas")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
    { label: "Buscar", icon: "buscar", run: () => setPaletteOpen(true) },
  ];

  const captureProps = {
    notes,
    linkedNote: notes.find((note) => note.id === linkedNoteId) ?? null,
    onUnlinkNote: () => setLinkedNoteId(null),
    analyze: analyzeCapture,
    onSubmit: (text: string) => void submitCapture(text),
    error: captureError,
  };

  return (
    // Marco fijo (#105): en escritorio, una cuadrícula con la barra superior, el carril y el dock fijos; solo el contenido se desliza.
    <div ref={rootRef} className="relative isolate min-h-dvh text-(--text-primary) lg:grid lg:h-dvh lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-[3.5rem_minmax(0,1fr)_auto] lg:gap-3 lg:overflow-hidden lg:p-3">
      <Wallpaper fondo={prefs.fondo === "imagen" && !wallpaperUrl ? "contornos" : prefs.fondo} imagenUrl={wallpaperUrl} />
      <a href="#contenido" className="sr-only z-50 rounded-lg bg-(--surface-raised) px-3 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Saltar al contenido</a>

      <div className="sticky top-0 z-30 p-3 lg:static lg:col-span-2 lg:p-0">
        <TopBar
          todayDate={todayDate}
          timezone={timezone}
          overdueCount={overdueCount}
          todayCount={todayCount}
          filter={filter}
          saveState={saveState}
          onFilter={setFilter}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenBackground={openBackground}
          onExport={onExport}
          onSignOut={onSignOut}
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onSelectWorkspace={props.onSelectWorkspace ?? noop}
          onCreateAgency={() => setTeamMode("crear")}
          onOpenTeam={() => setTeamMode("equipo")}
          toolName={herramientaPorId(herramienta).nombre}
          panels={prefs.paneles}
          onTogglePanel={(id) => setPrefs({ distribucion: layout === "enfoque" ? "libre" : layout, paneles: { [id]: !prefs.paneles[id] } })}
          focusMode={layout === "enfoque"}
          onToggleFocus={() => setPrefs({ distribucion: layout === "enfoque" ? "libre" : "enfoque" })}
          userEmail={props.userEmail}
        />
      </div>

      <div className="z-20 hidden min-h-0 lg:col-start-1 lg:row-span-2 lg:row-start-2 lg:block">
        <Carril
          expandido={carrilExpandido}
          onToggleExpandido={toggleCarril}
          activa={herramienta}
          onSelect={selectHerramienta}
          hoyPendientes={overdueCount + todayCount}
          semana={resumenSemana(todos, todayDate)}
        />
      </div>

      <main id="contenido" tabIndex={-1} className="flex flex-col gap-3 px-3 pb-44 outline-none lg:col-start-2 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto lg:p-0">
      {actionError && (
        <div role="alert" className="hubly-pop hubly-glass relative z-30 flex shrink-0 items-center justify-between gap-3 rounded-xl border-(--status-danger-text) px-4 py-3 text-sm text-(--status-danger-text)">
          <span>{actionError.message}</span>
          <Button size="sm" variant="danger-soft" onPress={actionError.onRetry}>Reintentar</Button>
        </div>
      )}
      {herramienta !== "hoy" ? <Proximamente herramienta={herramientaPorId(herramienta)} /> : (
      <div className={`flex flex-col gap-3 lg:min-h-144 lg:grow ${gridClass}`}>
        {panels.hoy && (
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
            className={`max-h-160 lg:max-h-none ${hoyClass}`}
          />
        )}
        {panels.nota && (
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
            className={`min-h-72 ${sideClass}`}
          />
        )}
        {panels.notas && (
          <NotasPanel
            notes={notes}
            openNoteId={openNoteId}
            onOpen={openNote}
            onCreateNote={() => void createNote()}
            onClose={() => setPrefs({ paneles: { notas: false } })}
            className={sideClass}
          />
        )}
      </div>
      )}
      </main>

      <div className="z-20 hidden justify-center lg:col-start-2 lg:row-start-3 lg:flex">
        <Dock ref={desktopCapture} imagen={imagenControls} prefs={prefs} onPrefs={setPrefs} pickerOpen={pickerOpen === "desktop"} onPickerOpenChange={(open) => setPickerOpen(open ? "desktop" : null)} {...captureProps} />
      </div>

      <div className="hubly-glass fixed inset-x-2 bottom-2 z-30 flex flex-col gap-2 rounded-2xl p-2 lg:hidden">
        <CaptureField ref={mobileCapture} {...captureProps} />
        <nav aria-label="Navegación del espacio" className="grid grid-cols-4">
          {mobileNav.map((item) => (
            <Button key={item.label} variant="ghost" onPress={item.run} className="h-auto min-h-11 flex-col gap-0.5 text-xs text-(--text-secondary)">
              <Icon name={item.icon} className="size-5" />
              {item.label}
            </Button>
          ))}
          <BackgroundPicker
            imagen={imagenControls}
            prefs={prefs}
            onChange={setPrefs}
            isOpen={pickerOpen === "mobile"}
            onOpenChange={(open) => setPickerOpen(open ? "mobile" : null)}
            triggerLabel="Fondo"
            triggerClassName="h-auto min-h-11 w-full flex-col gap-0.5 text-xs text-(--text-secondary)"
          />
        </nav>
      </div>

      {toast && (
        <div role="status" key={toast.id} className="hubly-pop hubly-pop-surface fixed bottom-36 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-(--text-primary) lg:bottom-28">
          <span className="max-w-64 truncate">{toast.message}</span>
          {toast.undo && (
            <Button size="sm" variant="ghost" onPress={() => { toast.undo?.(); setToast(null); }} className="text-(--accent-primary)">
              <Icon name="deshacer" className="size-3.5" /> Deshacer
            </Button>
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

      <CommandPalette
        isOpen={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={paletteActions}
        notes={notes}
        todos={todos}
        onOpenNote={openNote}
        onFocusTodo={(id) => {
          setFilter(null);
          setPrefs({ paneles: { hoy: true } });
          setTimeout(() => document.getElementById(`pendiente-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
        }}
        onCreateTodo={(title) => void submitCapture(title)}
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

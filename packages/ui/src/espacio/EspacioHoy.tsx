"use client";

import { Button, Tooltip } from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Hubi } from "../components/brand/Hubi";
import { useHublyTheme } from "../landing/ThemeToggle";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { EquipoDialog, type EquipoDialogMode } from "./EquipoDialog";
import { BackgroundPicker, CaptureField, Dock, findNoteByQuery } from "./Dock";
import { IconButton } from "./GlassPanel";
import { HoyPanel } from "./HoyPanel";
import { Icon } from "./icons";
import { NotaPanel } from "./NotaPanel";
import { NotasPanel } from "./NotasPanel";
import { useEspacioPreferencias, type PanelId } from "./preferencias";
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
}

export const PERSONAL_WORKSPACE: EspacioWorkspace = { id: "personal", name: "Espacio personal", kind: "personal", role: "owner" };
const noop = () => {};

interface ToastState { id: number; message: string; undo?: (() => void) | undefined }

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  const tag = el?.tagName ?? "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el?.isContentEditable);
};

interface RailProps {
  overdueCount: number;
  panels: Record<PanelId, boolean>;
  onTogglePanel: (id: PanelId) => void;
  workspaces: EspacioWorkspace[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreateAgency: () => void;
}

function Rail({ overdueCount, panels, onTogglePanel, workspaces, activeId, onSelect, onCreateAgency }: RailProps) {
  const railButton = "relative flex size-9 cursor-pointer items-center justify-center rounded-lg border-2 text-sm font-bold";
  return (
    <nav aria-label="Espacios y paneles" className="hubly-glass hubly-enter flex w-14 flex-col items-center gap-2 rounded-xl py-2.5" data-delay="1">
      <span className="text-xs font-semibold text-(--text-muted)">Espacios</span>
      {workspaces.map((ws) => {
        const active = ws.id === activeId;
        const name = ws.kind === "personal" ? "Espacio personal" : ws.name;
        return (
          <Tooltip key={ws.id} delay={400}>
          <Button isIconOnly variant={active ? "primary" : "tertiary"} onPress={() => { if (!active) onSelect(ws.id); }}
            className={`${railButton} ${active ? "border-(--accent-primary)" : "border-transparent data-[hovered]:border-(--glass-line-strong)"}`}>
            {ws.kind === "personal" ? <Icon name="usuario" /> : <span aria-hidden="true">{ws.name.trim().charAt(0).toUpperCase() || "A"}</span>}
            <span className="sr-only">{name}{active ? " (activo)" : ""}</span>
            {active && overdueCount > 0 && (
              <span key={overdueCount} className="hubly-pop absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--status-danger-text) px-1 text-xs font-bold text-(--surface-raised)">
                {overdueCount}
              </span>
            )}
          </Button>
          <Tooltip.Content placement="right">{name}{active ? " · activo" : ""}</Tooltip.Content>
          </Tooltip>
        );
      })}
      <IconButton icon="mas" label="Crear agencia" onPress={onCreateAgency} className="border border-dashed border-(--glass-line-strong)" />
      <span aria-hidden="true" className="my-1 h-px w-7 bg-(--glass-line-strong)" />
      <span className="text-xs font-semibold text-(--text-muted)">Paneles</span>
      <IconButton icon="sol" label="Panel Hoy" pressed={panels.hoy} onPress={() => onTogglePanel("hoy")} />
      <IconButton icon="nota" label="Panel Nota abierta" pressed={panels.nota} onPress={() => onTogglePanel("nota")} />
      <IconButton icon="pin" label="Panel Notas fijadas" pressed={panels.notas} onPress={() => onTogglePanel("notas")} />
    </nav>
  );
}

/** Espacio de Hoy con paneles de cristal sobre fondo personal (propuesta B, #75). Sin datos propios: todo llega por props. */
export function EspacioHoy(props: EspacioHoyProps) {
  const { todayDate, timezone, todos, notes, noteSaveStates, actionError, captureError, analyzeCapture, onCapture, onToggleTodo, onCreateNote, onSaveNote, onTogglePin, onToggleArchive, onExport, onSignOut } = props;
  const activeWorkspace = props.activeWorkspace ?? PERSONAL_WORKSPACE;
  const workspaces = props.workspaces ?? [activeWorkspace];
  const [teamMode, setTeamMode] = useState<EquipoDialogMode | null>(null);
  const [prefs, setPrefs] = useEspacioPreferencias();
  const [theme, setTheme] = useHublyTheme();
  const [filter, setFilter] = useState<HoyFilter>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(() => notes.find((n) => n.isPinned && !n.isArchived)?.id ?? notes.find((n) => !n.isArchived)?.id ?? null);
  const [linkedNoteId, setLinkedNoteId] = useState<string | null>(null);
  const [recentlyDone, setRecentlyDone] = useState<ReadonlySet<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState<"desktop" | "mobile" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
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
    <div ref={rootRef} className="relative isolate min-h-dvh text-(--text-primary) lg:h-dvh lg:overflow-hidden">
      <Wallpaper fondo={prefs.fondo} />

      <div className="sticky top-0 z-30 p-3 lg:absolute lg:inset-x-3 lg:top-3 lg:p-0">
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
        />
      </div>

      <div className="absolute top-18 left-3 z-20 hidden lg:block">
        <Rail
          overdueCount={overdueCount}
          panels={prefs.paneles}
          onTogglePanel={(id) => setPrefs({ distribucion: layout === "enfoque" ? "libre" : layout, paneles: { [id]: !prefs.paneles[id] } })}
          workspaces={workspaces}
          activeId={activeWorkspace.id}
          onSelect={props.onSelectWorkspace ?? noop}
          onCreateAgency={() => setTeamMode("crear")}
        />
      </div>

      {actionError && (
        <div role="alert" className="hubly-pop hubly-glass relative z-30 mx-3 mb-3 flex items-center justify-between gap-3 rounded-xl border-(--status-danger-text) px-4 py-3 text-sm text-(--status-danger-text) lg:absolute lg:top-18 lg:right-3 lg:left-20 lg:mx-0">
          <span>{actionError.message}</span>
          <Button size="sm" variant="danger-soft" onPress={actionError.onRetry}>Reintentar</Button>
        </div>
      )}

      <main className={`flex flex-col gap-3 px-3 pb-44 lg:absolute lg:top-18 lg:right-3 lg:bottom-24 lg:left-20 lg:gap-3 lg:p-0 ${gridClass} ${actionError ? "lg:top-32" : ""}`}>
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
      </main>

      <div className="absolute inset-x-0 bottom-4 z-20 hidden justify-center px-24 lg:flex">
        <Dock ref={desktopCapture} prefs={prefs} onPrefs={setPrefs} pickerOpen={pickerOpen === "desktop"} onPickerOpenChange={(open) => setPickerOpen(open ? "desktop" : null)} {...captureProps} />
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
  action?: { label: string; onPress: () => void };
  children?: ReactNode;
}

/** Estados de carga, sin sesión y error del espacio, sobre el mismo fondo y con Hubi (#75). */
export function EspacioEstado({ title, message, busy, action }: EspacioEstadoProps) {
  return (
    <main aria-busy={busy} role={busy ? "status" : "alert"} className="relative isolate flex min-h-dvh items-center justify-center p-4 text-(--text-primary)">
      <Wallpaper fondo="contornos" />
      <div className="hubly-glass hubly-enter flex w-full max-w-md flex-col items-center gap-4 rounded-2xl px-6 py-8 text-center">
        <Hubi acabado="volumen" tamano={96} decorativo {...(busy ? { className: "hubly-float" } : {})} />
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

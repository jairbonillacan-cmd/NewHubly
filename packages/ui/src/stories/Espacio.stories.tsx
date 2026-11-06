import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { EspacioEstado, EspacioHoy } from "../espacio/EspacioHoy";
import { BienvenidaDialog } from "../espacio/BienvenidaDialog";
import type { CaptureAnalysis, CaptureInput, EspacioInvitation, EspacioMember, EspacioNote, EspacioTodo, EspacioWorkspace, NoteSaveState } from "../espacio/types";

const TODAY = "2026-11-04";

const NOTES: EspacioNote[] = [
  { id: "n1", title: "Reunión Café Aurora · 3 nov", content: "Acordamos 12 piezas para noviembre con tono cercano. Sin descuentos en el feed; las promos van en historias.", isPinned: true, isArchived: false },
  { id: "n2", title: "Ideas de ganchos para reels", content: "Antes y después del estudio, un día con el equipo…", isPinned: true, isArchived: false },
  { id: "n3", title: "Brief de Lumen", content: "Sesión de fotos de producto, fondo claro.", isPinned: false, isArchived: false },
];

const TODOS: EspacioTodo[] = [
  { id: "t1", title: "Enviar minuta de la reunión con Café Aurora", priority: "high", dueDate: "2026-11-03", isDone: false, noteId: "n1" },
  { id: "t2", title: "Revisar copys de la parrilla de noviembre", priority: "high", dueDate: TODAY, isDone: false, noteId: null },
  { id: "t3", title: "Pedir fotos de producto al estudio", priority: "medium", dueDate: TODAY, isDone: false, noteId: null },
  { id: "t4", title: "Proponer parrilla de noviembre a Café Aurora", priority: "medium", dueDate: TODAY, isDone: false, noteId: "n1" },
  { id: "t5", title: "Llamar a Lumen para el shooting", priority: "low", dueDate: "2026-11-06", isDone: false, noteId: null },
  { id: "t6", title: "Actualizar plantilla de reporte", priority: "low", dueDate: null, isDone: true, noteId: null },
];

// Versión simple del análisis de @hubly/domain, solo para la historia.
function analyze(text: string): CaptureAnalysis {
  const words = text.trim().split(/\s+/);
  const has = (w: string) => words.some((x) => x.toLowerCase() === w);
  const note = words.find((w) => w.startsWith("@") && w.length > 1);
  return {
    title: words.filter((w) => !["hoy", "mañana", "!alta", "!media", "!baja"].includes(w.toLowerCase()) && !w.startsWith("@")).join(" "),
    dueKeyword: has("mañana") ? "mañana" : has("hoy") ? "hoy" : null,
    dueDate: has("mañana") ? "2026-11-05" : has("hoy") ? TODAY : null,
    priority: has("!alta") ? "high" : has("!baja") ? "low" : has("!media") ? "medium" : null,
    noteQuery: note ? note.slice(1) : null,
  };
}

const PERSONAL: EspacioWorkspace = { id: "p", name: "Mi Espacio", kind: "personal", role: "owner" };
const AGENCIA: EspacioWorkspace = { id: "a", name: "Agencia Pulso", kind: "agency", role: "owner" };
const MIEMBROS: EspacioMember[] = [
  { userId: "u-0001-yo", role: "owner", isCurrentUser: true },
  { userId: "u-0002-ana", role: "editor", isCurrentUser: false },
  { userId: "u-0003-leo", role: "viewer", isCurrentUser: false },
];
const INVITACIONES: EspacioInvitation[] = [{ id: "i1", email: "equipo@agencia.es", role: "editor", expiresAt: "2026-11-11T00:00:00.000Z" }];

interface DemoProps { todos?: EspacioTodo[]; notes?: EspacioNote[]; agencia?: boolean }

function EspacioDemo({ todos: initialTodos = TODOS, notes: initialNotes = NOTES, agencia = false }: DemoProps) {
  const [todos, setTodos] = useState(initialTodos);
  const [notes, setNotes] = useState(initialNotes);
  const [saves, setSaves] = useState<Record<string, NoteSaveState>>({});
  const patchNote = (id: string, patch: Partial<EspacioNote>) => setNotes((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  return (
    <EspacioHoy
      todayDate={TODAY}
      timezone="America/Mexico_City"
      todos={todos}
      notes={notes}
      noteSaveStates={saves}
      analyzeCapture={analyze}
      onCapture={async (input: CaptureInput) => {
        setTodos((list) => [{ id: `t${Date.now()}`, isDone: false, ...input }, ...list]);
        return true;
      }}
      onToggleTodo={(id) => setTodos((list) => list.map((t) => (t.id === id ? { ...t, isDone: !t.isDone } : t)))}
      onCreateNote={async () => {
        const id = `n${Date.now()}`;
        setNotes((list) => [{ id, title: "Nueva nota", content: "", isPinned: false, isArchived: false }, ...list]);
        return id;
      }}
      onSaveNote={(id, title, content) => {
        patchNote(id, { title, content });
        setSaves((s) => ({ ...s, [id]: "saving" }));
        setTimeout(() => setSaves((s) => ({ ...s, [id]: "saved" })), 600);
      }}
      onTogglePin={(id) => patchNote(id, { isPinned: !notes.find((n) => n.id === id)?.isPinned })}
      onToggleArchive={(id) => patchNote(id, { isArchived: !notes.find((n) => n.id === id)?.isArchived })}
      onExport={() => undefined}
      // En la historia «Tu imagen» se muestra con una URL local; en la app la sube el servidor tras validarla (#84).
      onUploadWallpaper={async (file) => ({ ok: true as const, url: URL.createObjectURL(file) })}
      onRemoveWallpaper={async () => undefined}
      onSignOut={() => undefined}
      {...(agencia ? {
        workspaces: [PERSONAL, AGENCIA], activeWorkspace: AGENCIA, members: MIEMBROS, invitations: INVITACIONES, inviteLink: "/invitacion#ejemplo",
        onChangeNoteVisibility: (id: string, visibility: "private" | "workspace") => patchNote(id, { visibility }),
        onChangeTodoVisibility: (id: string, visibility: "private" | "workspace") => setTodos((list) => list.map((t) => (t.id === id ? { ...t, visibility } : t))),
      } : {})}
    />
  );
}

const meta: Meta<typeof EspacioDemo> = {
  title: "Espacio/Hoy",
  component: EspacioDemo,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof EspacioDemo>;

export const ConPendientes: Story = {};

export const SinPendientes: Story = { args: { todos: [], notes: [] } };

export const Cargando: Story = { render: () => <EspacioEstado busy message="Cargando tu espacio de trabajo…" /> };

export const ErrorAlCargar: Story = {
  render: () => (
    <EspacioEstado
      pose="reparar"
      title="No se pudo cargar Hoy"
      message="No se pudo cargar tu espacio de trabajo."
      action={{ label: "Reintentar", onPress: () => window.location.reload() }}
    />
  ),
};

/** Agencia activa (#64, #78): menú de espacios, equipo e invitaciones y visibilidad de notas y pendientes. */
export const Agencia: Story = {
  args: {
    agencia: true,
    todos: TODOS.map((t, i) => ({ ...t, visibility: i % 2 === 0 ? "workspace" : "private", canChangeVisibility: true })),
    notes: NOTES.map((n, i) => ({ ...n, visibility: i === 0 ? "workspace" : "private", canChangeVisibility: true })),
  },
};

/** Primera entrada después de confirmar la cuenta: la bienvenida sobre el espacio (?bienvenida=1). */
export const Bienvenida: Story = {
  args: { todos: [], notes: [] },
  render: (args) => (
    <>
      <EspacioDemo {...args} />
      <BienvenidaDialog isOpen onClose={() => {}} workspaceName="Mi espacio" />
    </>
  ),
};

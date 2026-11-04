import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { NoteEditorCard } from "../components/notes/NoteEditorCard";
import { QuickCaptureBar } from "../components/todos/QuickCaptureBar";
import { TodoItemCard } from "../components/todos/TodoItemCard";
import { ViewSelector } from "../components/workspace/ViewSelector";
import { WorkspaceEmptyState } from "../components/workspace/WorkspaceEmptyState";
import { tokens } from "../tokens";

const meta: Meta<typeof ViewSelector> = {
  title: "Workspace/Notas y Pendientes",
  component: ViewSelector,
};

export default meta;
type Story = StoryObj<typeof ViewSelector>;

export const SelectorDeVistas: Story = {
  render: () => (
    <ViewSelector activeView="today" counts={{ today: 4, upcoming: 7, no_date: 2, done: 12 }} />
  ),
};

export const BarraDeCapturaRapida: Story = {
  render: () => (
    <QuickCaptureBar
      title="Revisar guion de lanzamiento con dirección creativa"
      priority="high"
      dueDate="2026-11-04"
      linkedNoteTitle="Pauta editorial de noviembre"
    />
  ),
};

export const TarjetasDePendiente: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[3] }}>
      <TodoItemCard
        id="todo-vencido"
        title="Entregar parrilla de contenidos de la semana"
        detail="Confirmar copys definitivos y formatos verticales antes de programar."
        priority="high"
        dueDate="2026-11-02"
        isDone={false}
        isOverdue
        noteId="nota-1"
        noteTitle="Reunión de arranque mensual"
      />
      <TodoItemCard
        id="todo-hoy"
        title="Validar métricas de cierre de campaña"
        priority="medium"
        dueDate="2026-11-04"
        isDone={false}
        isToday
      />
      <TodoItemCard
        id="todo-hecho"
        title="Actualizar calendario de publicaciones"
        priority="low"
        dueDate="2026-11-01"
        isDone
      />
    </div>
  ),
};

export const EditorDeNotaConAutoguardado: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[4] }}>
      <NoteEditorCard
        id="nota-guardada"
        title="Acuerdos de campaña trimestral"
        content="Priorizar piezas en vídeo corto y publicar reportes los viernes a primera hora."
        isPinned
        isArchived={false}
        saveStatus="saved"
        linkedTodos={[
          { id: "t-1", title: "Entregar parrilla de contenidos de la semana", isDone: false },
          { id: "t-2", title: "Definir calendario de grabación", isDone: true },
        ]}
      />
      <NoteEditorCard
        id="nota-error"
        title="Borrador con fallo de conexión"
        content="El borrador local se conserva íntegro para reintentar el guardado sin perder cambios."
        isPinned={false}
        isArchived={false}
        saveStatus="error"
      />
    </div>
  ),
};

export const EstadosVaciosConHubi: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[3] }}>
      <WorkspaceEmptyState view="today" actionLabel="Capturar pendiente" onAction={() => {}} />
      <WorkspaceEmptyState view="upcoming" />
    </div>
  ),
};

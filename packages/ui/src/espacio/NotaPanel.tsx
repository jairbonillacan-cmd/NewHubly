"use client";

import { Button, ToggleButton } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { GlassPanel } from "./GlassPanel";
import { Icon } from "./icons";
import type { EspacioNote, EspacioTodo, EspacioVisibility, NoteSaveState } from "./types";

const AUTOSAVE_DELAY_MS = 700;

export interface NotaPanelProps {
  note: EspacioNote | null;
  linkedTodos: EspacioTodo[];
  saveState: NoteSaveState;
  onSave: (id: string, title: string, content: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onCreateTodoFromNote: (id: string) => void;
  onCreateNote: () => void;
  onChangeVisibility?: ((id: string, visibility: EspacioVisibility) => void) | undefined;
  onClose?: (() => void) | undefined;
  className?: string | undefined;
}

const SAVE_LABEL: Record<NoteSaveState, string> = { saved: "Guardado", saving: "Guardando…", error: "No se guardó" };

/** Panel «Nota abierta» (#75): edición con guardado automático, pendiente desde la nota, fijar y archivar. */
export function NotaPanel({ note, linkedTodos, saveState, onSave, onTogglePin, onToggleArchive, onCreateTodoFromNote, onCreateNote, onChangeVisibility, onClose, className }: NotaPanelProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteId = note?.id ?? null;

  useEffect(() => {
    setTitle(note?.title ?? "");
    setContent(note?.content ?? "");
    // Solo al cambiar de nota: mientras se escribe manda el estado local.
  }, [noteId]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const readOnly = Boolean(note?.readOnly);
  const schedule = (nextTitle: string, nextContent: string) => {
    if (!noteId || readOnly) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(noteId, nextTitle, nextContent), AUTOSAVE_DELAY_MS);
  };

  if (!note) {
    return (
      <GlassPanel id="panel-nota" title="Nota abierta" icon="nota" onClose={onClose} className={className} retraso={1}>
        <div className="flex flex-col items-start gap-3 px-5 py-6">
          <p className="m-0 text-sm leading-relaxed text-(--text-secondary)">Abre una nota desde «Notas» o crea una nueva para apuntar acuerdos e ideas.</p>
          <Button variant="primary" size="sm" onPress={onCreateNote}>
            <Icon name="mas" /> Nueva nota
          </Button>
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel
      id="panel-nota"
      title={note.title || "Nota sin título"}
      icon="nota"
      onClose={onClose}
      className={className}
      retraso={1}
      actions={
        <span aria-live="polite" className={`text-xs ${saveState === "error" ? "text-(--status-danger-text)" : "text-(--text-muted)"}`}>
          {saveState === "error" ? (
            <Button size="sm" variant="danger-soft" onPress={() => onSave(note.id, title, content)}>
              {SAVE_LABEL.error} · Reintentar
            </Button>
          ) : (
            SAVE_LABEL[saveState]
          )}
        </span>
      }
    >
      <div key={note.id} className="hubly-pop flex h-full flex-col gap-3 px-5 py-4">
        {note.visibility && (
          <p className="m-0 flex items-center gap-1.5 text-xs text-(--text-muted)">
            <Icon name={note.visibility === "workspace" ? "equipo" : "candado"} className="size-3.5" />
            {note.visibility === "workspace" ? "Compartida con la agencia" : "Privada: solo tú la ves"}
            {readOnly && " · Solo lectura"}
          </p>
        )}
        <label className="sr-only" htmlFor="nota-titulo">Título de la nota</label>
        <input
          id="nota-titulo"
          value={title}
          readOnly={readOnly}
          onChange={(event) => { setTitle(event.target.value); schedule(event.target.value, content); }}
          placeholder="Título"
          className="hubly-editor w-full border-0 bg-transparent p-0 text-lg font-semibold text-(--text-primary) outline-none placeholder:text-(--text-muted)"
        />
        <label className="sr-only" htmlFor="nota-contenido">Contenido de la nota</label>
        <textarea
          id="nota-contenido"
          value={content}
          readOnly={readOnly}
          onChange={(event) => { setContent(event.target.value); schedule(title, event.target.value); }}
          placeholder="Escribe aquí…"
          rows={6}
          className="hubly-editor min-h-32 w-full grow resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-(--text-secondary) outline-none placeholder:text-(--text-muted)"
        />
        {linkedTodos.length > 0 && (
          <ul aria-label="Pendientes de esta nota" className="m-0 flex list-none flex-col gap-1 border-t border-(--glass-line) p-0 pt-3">
            {linkedTodos.map((todo) => (
              <li key={todo.id} className={`text-xs ${todo.isDone ? "text-(--text-muted) line-through" : "text-(--text-secondary)"}`}>
                {todo.title} · {todo.isDone ? "Hecho" : "Pendiente"}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {note.canChangeVisibility && onChangeVisibility && (
            <Button size="sm" variant="outline" onPress={() => onChangeVisibility(note.id, note.visibility === "workspace" ? "private" : "workspace")}>
              <Icon name={note.visibility === "workspace" ? "candado" : "compartir"} className="size-3.5" /> {note.visibility === "workspace" ? "Hacer privada" : "Compartir con la agencia"}
            </Button>
          )}
          <Button size="sm" variant="secondary" onPress={() => onCreateTodoFromNote(note.id)}>
            Crear pendiente desde esta nota
          </Button>
          <ToggleButton size="sm" variant="ghost" isSelected={note.isPinned} onChange={() => onTogglePin(note.id)} className="data-[selected]:bg-(--accent-primary-subtle) data-[selected]:text-(--accent-primary)">
            <Icon name="pin" className="size-3.5" /> {note.isPinned ? "Fijada" : "Fijar"}
          </ToggleButton>
          <ToggleButton size="sm" variant="ghost" isSelected={note.isArchived} onChange={() => onToggleArchive(note.id)}>
            <Icon name="archivar" className="size-3.5" /> {note.isArchived ? "Desarchivar" : "Archivar"}
          </ToggleButton>
        </div>
      </div>
    </GlassPanel>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { GlassPanel } from "./GlassPanel";
import { Icon } from "./icons";
import type { EspacioNote, EspacioTodo, NoteSaveState } from "./types";

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
  onClose?: (() => void) | undefined;
  className?: string | undefined;
}

const SAVE_LABEL: Record<NoteSaveState, string> = { saved: "Guardado", saving: "Guardando…", error: "No se guardó" };

/** Panel «Nota abierta» (#75): edición con guardado automático, pendiente desde la nota, fijar y archivar. */
export function NotaPanel({ note, linkedTodos, saveState, onSave, onTogglePin, onToggleArchive, onCreateTodoFromNote, onCreateNote, onClose, className }: NotaPanelProps) {
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

  const schedule = (nextTitle: string, nextContent: string) => {
    if (!noteId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(noteId, nextTitle, nextContent), AUTOSAVE_DELAY_MS);
  };

  if (!note) {
    return (
      <GlassPanel id="panel-nota" title="Nota abierta" icon="nota" onClose={onClose} className={className} retraso={1}>
        <div className="flex flex-col items-start gap-3 px-5 py-6">
          <p className="m-0 text-sm leading-relaxed text-(--text-secondary)">Abre una nota desde «Notas» o crea una nueva para apuntar acuerdos e ideas.</p>
          <button type="button" onClick={onCreateNote} className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border-0 bg-(--accent-primary) px-3.5 text-sm font-semibold text-(--text-on-accent) transition-transform hover:bg-(--accent-primary-hover) active:scale-95">
            <Icon name="mas" /> Nueva nota
          </button>
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
            <button type="button" onClick={() => onSave(note.id, title, content)} className="cursor-pointer border-0 bg-transparent p-0 text-xs text-(--status-danger-text) underline">
              {SAVE_LABEL.error} · Reintentar
            </button>
          ) : (
            SAVE_LABEL[saveState]
          )}
        </span>
      }
    >
      <div key={note.id} className="hubly-pop flex h-full flex-col gap-3 px-5 py-4">
        <label className="sr-only" htmlFor="nota-titulo">Título de la nota</label>
        <input
          id="nota-titulo"
          value={title}
          onChange={(event) => { setTitle(event.target.value); schedule(event.target.value, content); }}
          placeholder="Título"
          className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-(--text-primary) outline-none placeholder:text-(--text-muted)"
        />
        <label className="sr-only" htmlFor="nota-contenido">Contenido de la nota</label>
        <textarea
          id="nota-contenido"
          value={content}
          onChange={(event) => { setContent(event.target.value); schedule(title, event.target.value); }}
          placeholder="Escribe aquí…"
          rows={6}
          className="min-h-32 w-full grow resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-(--text-secondary) outline-none placeholder:text-(--text-muted)"
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
          <button type="button" onClick={() => onCreateTodoFromNote(note.id)} className="h-8 cursor-pointer rounded-lg border border-(--glass-line-strong) bg-(--glass-hover) px-3 text-xs font-medium text-(--text-primary) transition-transform hover:bg-(--accent-primary-subtle) active:scale-95">
            Crear pendiente desde esta nota
          </button>
          <button type="button" aria-pressed={note.isPinned} onClick={() => onTogglePin(note.id)} className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-(--glass-line-strong) bg-transparent px-3 text-xs text-(--text-secondary) transition-colors aria-pressed:border-(--accent-primary) aria-pressed:text-(--accent-primary)">
            <Icon name="pin" className="size-3.5" /> {note.isPinned ? "Fijada" : "Fijar"}
          </button>
          <button type="button" aria-pressed={note.isArchived} onClick={() => onToggleArchive(note.id)} className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-(--glass-line-strong) bg-transparent px-3 text-xs text-(--text-secondary) transition-colors hover:bg-(--glass-hover)">
            <Icon name="archivar" className="size-3.5" /> {note.isArchived ? "Desarchivar" : "Archivar"}
          </button>
        </div>
      </div>
    </GlassPanel>
  );
}

"use client";

import { Button } from "@heroui/react";
import { GlassPanel, IconButton } from "./GlassPanel";
import type { EspacioNote } from "./types";

const RECENT_LIMIT = 6;

export interface NotasPanelProps {
  notes: EspacioNote[];
  openNoteId: string | null;
  onOpen: (id: string) => void;
  onCreateNote: () => void;
  onClose?: (() => void) | undefined;
  className?: string | undefined;
}

function NoteButton({ note, active, onOpen }: { note: EspacioNote; active: boolean; onOpen: (id: string) => void }) {
  return (
    <li>
      <Button
        variant="ghost"
        fullWidth
        onPress={() => onOpen(note.id)}
        {...(active ? { "aria-label": `${note.title || "Nota sin título"} (abierta)` } : {})}
        className={`h-auto flex-col items-start gap-0.5 px-3 py-2 text-left ${active ? "bg-(--accent-primary-subtle)" : ""}`}
      >
        <span className="text-sm font-semibold text-(--text-primary)">{note.title || "Nota sin título"}</span>
        {note.content && <span className="line-clamp-1 w-full text-xs font-normal text-(--text-muted)">{note.content}</span>}
      </Button>
    </li>
  );
}

/** Panel «Notas» (#75): fijadas arriba y recientes debajo; al pulsar una se abre en el panel de nota. */
export function NotasPanel({ notes, openNoteId, onOpen, onCreateNote, onClose, className }: NotasPanelProps) {
  const live = notes.filter((note) => !note.isArchived);
  const pinned = live.filter((note) => note.isPinned);
  const recent = live.filter((note) => !note.isPinned).slice(0, RECENT_LIMIT);

  return (
    <GlassPanel
      id="panel-notas"
      title="Notas fijadas"
      icon="pin"
      onClose={onClose}
      className={className}
      retraso={2}
      actions={<IconButton icon="mas" label="Nueva nota" onPress={onCreateNote} />}
    >
      <div className="flex flex-col gap-2 p-2">
        {pinned.length === 0 ? (
          <p className="m-0 px-3 py-2 text-xs leading-relaxed text-(--text-muted)">Fija una nota para tenerla siempre a mano en Hoy.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {pinned.map((note) => <NoteButton key={note.id} note={note} active={note.id === openNoteId} onOpen={onOpen} />)}
          </ul>
        )}
        {recent.length > 0 && (
          <>
            <h3 className="m-0 px-3 pt-2 text-xs font-semibold tracking-(--tracking-wider) text-(--text-muted) uppercase">Recientes</h3>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {recent.map((note) => <NoteButton key={note.id} note={note} active={note.id === openNoteId} onOpen={onOpen} />)}
            </ul>
          </>
        )}
      </div>
    </GlassPanel>
  );
}

/**
 * Cola serializada de autoguardado por nota (#290):
 * - Como máximo un guardado en vuelo por `noteId`.
 * - Si llegan más cambios mientras uno viaja, se fusionan (gana el último junto con su persist/callbacks más recientes)
 *   y esperan al terminar el actual, encadenando la versión más reciente devuelta por el servidor.
 * - Cada `clear()` incrementa la generación para ignorar respuestas o errores tardíos de un espacio anterior.
 */
export interface NoteSavePayload {
  id: string;
  title: string;
  content: string;
  expectedVersion: number;
}

export interface SavedNoteVersion {
  id: string;
  version: number;
}

export interface NoteSaveCallbacks<TNote extends SavedNoteVersion> {
  onSaving: (id: string) => void;
  onSaved: (saved: TNote, hasMorePending: boolean) => void;
  onError: (id: string, error: unknown, retry: () => Promise<void>) => void;
}

interface PendingNoteSave<TNote extends SavedNoteVersion> {
  title: string;
  content: string;
  persist: (payload: NoteSavePayload) => Promise<TNote>;
  callbacks: NoteSaveCallbacks<TNote>;
  generation: number;
}

export function createNoteSaveQueue<TNote extends SavedNoteVersion>() {
  const inFlight = new Map<string, number>();
  const pending = new Map<string, PendingNoteSave<TNote>>();
  const versions = new Map<string, number>();
  let generation = 0;

  async function drain(id: string): Promise<void> {
    const runGeneration = generation;
    if (inFlight.get(id) === runGeneration) return;
    inFlight.set(id, runGeneration);
    let failure: { task: PendingNoteSave<TNote>; error: unknown } | null = null;
    try {
      while (pending.has(id)) {
        const next = pending.get(id)!;
        pending.delete(id);
        if (next.generation !== generation) return;
        const expectedVersion = versions.get(id) ?? 1;
        next.callbacks.onSaving(id);
        try {
          const saved = await next.persist({ id, title: next.title, content: next.content, expectedVersion });
          if (next.generation !== generation) return;
          versions.set(id, saved.version);
          next.callbacks.onSaved(saved, pending.has(id));
        } catch (error) {
          if (next.generation !== generation) return;
          // Conserva el último texto que falló si no llegó otro más nuevo mientras viajaba.
          if (!pending.has(id)) pending.set(id, next);
          failure = { task: next, error };
          break;
        }
      }
    } finally {
      if (inFlight.get(id) === runGeneration) inFlight.delete(id);
    }
    if (failure && failure.task.generation === generation) {
      failure.task.callbacks.onError(id, failure.error, () => drain(id));
    }
  }

  return {
    enqueue(
      id: string,
      title: string,
      content: string,
      knownVersion: number,
      persist: (payload: NoteSavePayload) => Promise<TNote>,
      callbacks: NoteSaveCallbacks<TNote>,
    ): Promise<void> {
      const current = versions.get(id);
      if (current === undefined || knownVersion > current) versions.set(id, knownVersion);
      pending.set(id, { title, content, persist, callbacks, generation });
      return drain(id);
    },
    isActive(id: string): boolean {
      return inFlight.get(id) === generation || pending.has(id);
    },
    clear(): void {
      generation += 1;
      pending.clear();
      versions.clear();
    },
  };
}

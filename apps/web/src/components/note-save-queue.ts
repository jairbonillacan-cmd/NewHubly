/**
 * Cola serializada de autoguardado por nota (#290):
 * - Como máximo un guardado en vuelo por `noteId`.
 * - Si llegan más cambios mientras uno viaja, se fusionan (gana el último) y esperan al terminar el actual,
 *   usando siempre la versión más reciente devuelta por el servidor (sin falsos ConcurrencyError).
 * - Cuando aún hay cambios pendientes locales, la respuesta intermedia actualiza la versión sin pisar el texto nuevo.
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

export function createNoteSaveQueue<TNote extends SavedNoteVersion>() {
  const inFlight = new Set<string>();
  const pending = new Map<string, { title: string; content: string }>();
  const versions = new Map<string, number>();

  async function drain(
    id: string,
    persist: (payload: NoteSavePayload) => Promise<TNote>,
    callbacks: {
      onSaving: (id: string) => void;
      onSaved: (saved: TNote, hasMorePending: boolean) => void;
      onError: (id: string, error: unknown, retry: () => Promise<void>) => void;
    },
  ): Promise<void> {
    if (inFlight.has(id)) return;
    inFlight.add(id);
    try {
      while (pending.has(id)) {
        const next = pending.get(id)!;
        pending.delete(id);
        const expectedVersion = versions.get(id) ?? 1;
        callbacks.onSaving(id);
        try {
          const saved = await persist({ id, title: next.title, content: next.content, expectedVersion });
          versions.set(id, saved.version);
          callbacks.onSaved(saved, pending.has(id));
        } catch (error) {
          // Conserva el último texto que falló si no llegó otro más nuevo mientras viajaba.
          if (!pending.has(id)) pending.set(id, next);
          callbacks.onError(id, error, () => drain(id, persist, callbacks));
          return;
        }
      }
    } finally {
      inFlight.delete(id);
    }
  }

  return {
    enqueue(
      id: string,
      title: string,
      content: string,
      knownVersion: number,
      persist: (payload: NoteSavePayload) => Promise<TNote>,
      callbacks: {
        onSaving: (id: string) => void;
        onSaved: (saved: TNote, hasMorePending: boolean) => void;
        onError: (id: string, error: unknown, retry: () => Promise<void>) => void;
      },
    ): Promise<void> {
      const current = versions.get(id);
      if (current === undefined || knownVersion > current) versions.set(id, knownVersion);
      pending.set(id, { title, content });
      return drain(id, persist, callbacks);
    },
    syncVersion(id: string, version: number): void {
      versions.set(id, version);
    },
    clear(): void {
      pending.clear();
      versions.clear();
    },
  };
}

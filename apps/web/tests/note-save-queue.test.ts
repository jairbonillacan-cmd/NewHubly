import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createNoteSaveQueue, type NoteSavePayload } from "../src/components/note-save-queue";
import { mergeChatPollResult, mergeChatUnreadMentions, mergeReloadedNotes } from "../src/components/WorkspaceScreen";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe("Cola serializada de autoguardado de notas (issue 290)", () => {
  it("serializa guardados concurrentes, encadena expectedVersion sin ConcurrencyError y no pisa el texto más nuevo", async () => {
    const queue = createNoteSaveQueue<{ id: string; title: string; content: string; version: number }>();
    const first = deferred<{ id: string; title: string; content: string; version: number }>();
    const second = deferred<{ id: string; title: string; content: string; version: number }>();
    const calls: NoteSavePayload[] = [];
    const savedEvents: Array<{ version: number; hasMorePending: boolean; content: string }> = [];

    const persist = vi.fn((payload: NoteSavePayload) => {
      calls.push(payload);
      return calls.length === 1 ? first.promise : second.promise;
    });
    const callbacks = {
      onSaving: vi.fn(),
      onSaved: (saved: { id: string; title: string; content: string; version: number }, hasMorePending: boolean) => {
        savedEvents.push({ version: saved.version, hasMorePending, content: saved.content });
      },
      onError: vi.fn(),
    };

    const p1 = queue.enqueue("n-1", "Título", "borrador 1", 1, persist, callbacks);
    // Mientras el primer guardado sigue en vuelo, llegan dos ediciones rápidas: se fusionan en «borrador 3».
    const p2 = queue.enqueue("n-1", "Título", "borrador 2", 1, persist, callbacks);
    const p3 = queue.enqueue("n-1", "Título", "borrador 3", 1, persist, callbacks);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ id: "n-1", title: "Título", content: "borrador 1", expectedVersion: 1 });

    first.resolve({ id: "n-1", title: "Título", content: "borrador 1", version: 2 });
    await new Promise((r) => setTimeout(r, 0));

    expect(savedEvents[0]).toEqual({ version: 2, hasMorePending: true, content: "borrador 1" });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ id: "n-1", title: "Título", content: "borrador 3", expectedVersion: 2 });

    second.resolve({ id: "n-1", title: "Título", content: "borrador 3", version: 3 });
    await Promise.all([p1, p2, p3]);

    expect(savedEvents[1]).toEqual({ version: 3, hasMorePending: false, content: "borrador 3" });
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("conserva el borrador fallido y permite reintentar limpiamente con la última versión", async () => {
    const queue = createNoteSaveQueue<{ id: string; title: string; content: string; version: number }>();
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error("Fallo temporal"))
      .mockResolvedValueOnce({ id: "n-1", title: "T", content: "Texto recuperado", version: 4 });
    let retryFn: (() => Promise<void>) | null = null;
    const onSaved = vi.fn();

    await queue.enqueue("n-1", "T", "Texto recuperado", 3, persist, {
      onSaving: vi.fn(),
      onSaved,
      onError: (_id, _err, retry) => { retryFn = retry; },
    });

    expect(onSaved).not.toHaveBeenCalled();
    expect(retryFn).not.toBeNull();
    await retryFn!();
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith({ id: "n-1", title: "T", content: "Texto recuperado", expectedVersion: 3 });
    expect(onSaved).toHaveBeenCalledWith({ id: "n-1", title: "T", content: "Texto recuperado", version: 4 }, false);
  });

  it("permite invocar retry() de forma síncrona dentro de onError y usa los cierres más recientes al fusionar ediciones", async () => {
    const queue = createNoteSaveQueue<{ id: string; title: string; content: string; version: number }>();
    const first = deferred<{ id: string; title: string; content: string; version: number }>();
    const firstPersist = vi.fn(() => first.promise);
    const latestPersist = vi.fn()
      .mockRejectedValueOnce(new Error("Corte breve"))
      .mockResolvedValueOnce({ id: "n-1", title: "T2", content: "C2", version: 3 });
    const latestSaved = vi.fn();
    let syncRetryPromise: Promise<void> | null = null;

    const p1 = queue.enqueue("n-1", "T1", "C1", 1, firstPersist, {
      onSaving: vi.fn(),
      onSaved: vi.fn(),
      onError: vi.fn(),
    });
    const p2 = queue.enqueue("n-1", "T2", "C2", 1, latestPersist, {
      onSaving: vi.fn(),
      onSaved: latestSaved,
      onError: (_id, _err, retry) => { syncRetryPromise = retry(); },
    });

    first.resolve({ id: "n-1", title: "T1", content: "C1", version: 2 });
    await Promise.all([p1, p2]);
    expect(syncRetryPromise).not.toBeNull();
    await syncRetryPromise;

    expect(firstPersist).toHaveBeenCalledTimes(1);
    expect(latestPersist).toHaveBeenCalledTimes(2);
    expect(latestPersist).toHaveBeenLastCalledWith({ id: "n-1", title: "T2", content: "C2", expectedVersion: 2 });
    expect(latestSaved).toHaveBeenCalledWith({ id: "n-1", title: "T2", content: "C2", version: 3 }, false);
  });

  it("clear() invalida por generación los guardados en vuelo al cambiar de espacio y mergeReloadedNotes preserva borradores activos en el mismo espacio", async () => {
    const queue = createNoteSaveQueue<{ id: string; title: string; content: string; version: number }>();
    const inFlightSave = deferred<{ id: string; title: string; content: string; version: number }>();
    const onSaved = vi.fn();
    const onError = vi.fn();

    const pending = queue.enqueue("n-a", "Espacio A", "Texto A", 1, () => inFlightSave.promise, {
      onSaving: vi.fn(),
      onSaved,
      onError,
    });
    expect(queue.isActive("n-a")).toBe(true);
    queue.clear();
    inFlightSave.reject(new Error("Fallo tardío de espacio anterior"));
    await pending;

    expect(onSaved).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(queue.isActive("n-a")).toBe(false);

    const merged = mergeReloadedNotes(
      [{ id: "n-1", title: "Local", content: "Borrador sin subir", version: 1 }],
      [
        { id: "n-1", title: "Servidor", content: "Viejo", version: 1 },
        { id: "n-2", title: "Otra", content: "Fresca", version: 2 },
      ],
      (id) => id === "n-1",
    );
    expect(merged).toEqual([
      { id: "n-1", title: "Local", content: "Borrador sin subir", version: 1 },
      { id: "n-2", title: "Otra", content: "Fresca", version: 2 },
    ]);
  });
});

describe("Sincronización de menciones del chat sin bucles de re-render (issue 290)", () => {
  it("devuelve la misma referencia cuando unreadMentions no cambia y evita ciclos en /chat", () => {
    const initial = { unread: 2, unreadMentions: 1 };
    expect(mergeChatUnreadMentions(initial, 1)).toBe(initial);
    expect(mergeChatUnreadMentions(null, 3)).toBeNull();
    expect(mergeChatUnreadMentions(initial, 3)).toEqual({ unread: 2, unreadMentions: 3 });
  });

  it("actualiza unread y unreadMentions desde el sondeo de WorkspaceScreen y omite re-renders sin cambios", () => {
    const initial = { unread: 0 };
    const updated = mergeChatPollResult(initial, {
      conversations: [{ unread: true }, { unread: false }],
      unreadMentions: [{ messageId: "m-1" }, { messageId: "m-2" }],
    });
    expect(updated).toEqual({ unread: 1, unreadMentions: 2 });
    const unchanged = mergeChatPollResult(updated, {
      conversations: [{ unread: true }, { unread: false }],
      unreadMentions: [{ messageId: "m-1" }, { messageId: "m-2" }],
    });
    expect(unchanged).toBe(updated);
  });
});

import type { ChatMessage } from "@hubly/contracts";

export const CHAT_POLL_MS = 3000;

export function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const rows = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    const previous = rows.get(entry.id);
    if (!previous || entry.change > previous.change) rows.set(entry.id, entry);
  }
  return [...rows.values()].sort((left, right) => left.number - right.number);
}

export function incomingChatNotice(total: number): string {
  return total === 1 ? "Llegó un mensaje nuevo." : `Han llegado ${total} mensajes nuevos desde que abriste la conversación.`;
}

/** Mensajes nuevos de otras personas en la conversación principal; las respuestas de hilo no avisan ni cuentan (#204). */
export function incomingMainMessages<T extends Pick<ChatMessage, "number" | "authorId" | "body" | "threadRootId">>(
  changes: readonly T[], previousLatest: number, userId: string,
): T[] {
  return changes.filter((item) => item.number > previousLatest && item.authorId !== userId && item.body !== null && !item.threadRootId);
}

export function isMessageEndVisible(end: number, history: Pick<DOMRect, "top" | "bottom">, viewportHeight: number): boolean {
  return end > Math.max(history.top, 0) && end <= Math.min(history.bottom, viewportHeight) + 1;
}

export function startChatPolling(
  run: () => Promise<boolean>, windowEvents: Window = window, page: Document = document,
  intervalMs: () => number = () => CHAT_POLL_MS,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let pending = false;
  let stopped = false;
  function refresh() {
    clearTimeout(timer);
    if (stopped || page.hidden || windowEvents.navigator.onLine === false) return;
    // Si ya hay una sincronización en curso, se encola otra inmediata en lugar de descartarla.
    if (running) { pending = true; return; }
    running = true;
    pending = false;
    let more = false;
    void run().then((result) => { more = result; }, () => {}).finally(() => {
      running = false;
      if (!stopped && !page.hidden && windowEvents.navigator.onLine !== false) {
        timer = setTimeout(refresh, more || pending ? 0 : intervalMs());
      }
    });
  }
  page.addEventListener("visibilitychange", refresh);
  windowEvents.addEventListener("focus", refresh);
  windowEvents.addEventListener("online", refresh);
  windowEvents.addEventListener("offline", refresh);
  refresh();
  return {
    refresh,
    stop() {
      stopped = true;
      clearTimeout(timer);
      page.removeEventListener("visibilitychange", refresh);
      windowEvents.removeEventListener("focus", refresh);
      windowEvents.removeEventListener("online", refresh);
      windowEvents.removeEventListener("offline", refresh);
    },
  };
}

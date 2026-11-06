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

export function startChatPolling(run: () => Promise<boolean>, windowEvents: Window = window, page: Document = document) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let stopped = false;
  function refresh() {
    clearTimeout(timer);
    if (stopped || page.hidden || running || windowEvents.navigator.onLine === false) return;
    running = true;
    let more = false;
    void run().then((result) => { more = result; }, () => {}).finally(() => {
      running = false;
      if (!stopped && !page.hidden && windowEvents.navigator.onLine !== false) {
        timer = setTimeout(refresh, more ? 0 : CHAT_POLL_MS);
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

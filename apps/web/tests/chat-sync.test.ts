import type { ChatMessage } from "@hubly/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeChatMessages, startChatPolling } from "../src/components/chat/sync";

const base = {
  id: "one", conversationId: "canal", authorId: "autor", body: "Primero", number: 1, change: 1,
  sentAt: "2026-11-05T15:00:00.000Z", editedAt: null, deletedAt: null,
} satisfies ChatMessage;

describe("Sincronización de chat en el navegador", () => {
  afterEach(() => vi.useRealTimers());

  it("ordena y combina el historial con cambios fuera de orden sin restaurar mensajes retirados", () => {
    const second = { ...base, id: "two", number: 2, change: 2 };
    const tombstone = { ...base, body: null, change: 4, deletedAt: base.sentAt };
    expect(mergeChatMessages([second, tombstone], [base, second])).toEqual([tombstone, second]);
    expect(mergeChatMessages([second], [tombstone, { ...base, change: 3 }])).toEqual([tombstone, second]);
  });

  it("sincroniza cada tres segundos, pausa al ocultarse y retoma en foco o al reconectar", async () => {
    vi.useFakeTimers();
    const page = Object.assign(new EventTarget(), { hidden: false });
    const win = Object.assign(new EventTarget(), { navigator: { onLine: true } });
    const sync = vi.fn().mockResolvedValue(false);
    const poll = startChatPolling(sync, win as unknown as Window, page as unknown as Document);
    await vi.advanceTimersByTimeAsync(2999);
    expect(sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sync).toHaveBeenCalledTimes(2);

    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(6000);
    expect(sync).toHaveBeenCalledTimes(2);
    page.hidden = false;
    win.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(3);

    win.navigator.onLine = false;
    win.dispatchEvent(new Event("offline"));
    await vi.advanceTimersByTimeAsync(6000);
    expect(sync).toHaveBeenCalledTimes(3);
    win.navigator.onLine = true;
    win.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(4);
    poll.stop();
    win.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(3000);
    expect(sync).toHaveBeenCalledTimes(4);
  });
});

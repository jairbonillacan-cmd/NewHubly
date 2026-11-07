import type { ChatMessage } from "@hubly/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { incomingChatNotice, incomingMainMessages, isMessageEndVisible, mergeChatMessages, startChatPolling } from "../src/components/chat/sync";
import { chatTransport, resolveChatPollIntervalMs } from "../src/components/chat/transport";

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

  it("cambia el aviso accesible cuando llegan mensajes en consultas consecutivas", () => {
    expect(incomingChatNotice(1)).toBe("Llegó un mensaje nuevo.");
    expect(incomingChatNotice(2)).toContain("2 mensajes nuevos");
    expect(incomingChatNotice(3)).toContain("3 mensajes nuevos");
  });

  it("marca la lectura solo cuando el final del mensaje queda dentro del historial y la pantalla", () => {
    expect(isMessageEndVisible(440, { top: 100, bottom: 440 }, 800)).toBe(true);
    expect(isMessageEndVisible(451, { top: 100, bottom: 440 }, 800)).toBe(false);
    expect(isMessageEndVisible(660, { top: 100, bottom: 700 }, 650)).toBe(false);
    expect(isMessageEndVisible(99, { top: 100, bottom: 440 }, 800)).toBe(false);
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

  it("encola una sincronización inmediata si se pide mientras otra sigue en curso", async () => {
    vi.useFakeTimers();
    const page = Object.assign(new EventTarget(), { hidden: false });
    const win = Object.assign(new EventTarget(), { navigator: { onLine: true } });
    let finish: (value: boolean) => void = () => {};
    const sync = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const poll = startChatPolling(sync, win as unknown as Window, page as unknown as Document);
    expect(sync).toHaveBeenCalledTimes(1);
    poll.refresh();
    expect(sync).toHaveBeenCalledTimes(1);
    finish(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(2);
    poll.stop();
  });

  it("sondea cada 2 s con la conversación abierta y la pestaña visible, y cada 3 s en el resto", async () => {
    expect(resolveChatPollIntervalMs({ hasOpenConversation: true, visibilityState: "visible" })).toBe(2000);
    expect(resolveChatPollIntervalMs({ hasOpenConversation: true, visibilityState: "hidden" })).toBe(3000);
    expect(resolveChatPollIntervalMs({ hasOpenConversation: false, visibilityState: "visible" })).toBe(3000);
    expect(resolveChatPollIntervalMs({ hasOpenConversation: false, visibilityState: undefined })).toBe(3000);

    vi.useFakeTimers();
    const page = Object.assign(new EventTarget(), { hidden: false });
    const win = Object.assign(new EventTarget(), { navigator: { onLine: true } });
    const sync = vi.fn().mockResolvedValue(false);
    const poll = startChatPolling(sync, win as unknown as Window, page as unknown as Document,
      () => resolveChatPollIntervalMs({ hasOpenConversation: true, visibilityState: "visible" }));
    await vi.advanceTimersByTimeAsync(1999);
    expect(sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sync).toHaveBeenCalledTimes(2);
    poll.stop();
  });
});

describe("Transporte social del chat", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pide el historial de un hilo y envía reacciones, escribiendo y menciones leídas", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({ conversationId: "c" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const workspaceId = "11111111-1111-4111-8111-111111111111";
    const api = chatTransport(workspaceId);
    await api.history("c", null, new AbortController().signal, "raiz");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("threadRootId=raiz");
    await api.history("c", null, new AbortController().signal);
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("threadRootId");
    for (const input of [
      { kind: "toggleReaction", workspaceId, conversationId: "c", messageId: "m", emoji: "👍" },
      { kind: "typing", workspaceId, conversationId: "c" },
      { kind: "markMentionsRead", workspaceId, conversationId: "c", upToNumber: 4 },
    ] as const) {
      await api.command(input);
      expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toEqual(input);
    }
  });
});

describe("Avisos de mensajes nuevos con hilos (issue 204)", () => {
  it("solo avisan los mensajes principales nuevos de otras personas, no las respuestas de hilo", () => {
    const me = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002";
    const changes = [
      { id: "a", number: 4, authorId: other, body: "viejo", threadRootId: null },
      { id: "b", number: 6, authorId: other, body: "principal", threadRootId: null },
      { id: "c", number: 7, authorId: other, body: "en hilo", threadRootId: "b" },
      { id: "d", number: 8, authorId: me, body: "mío", threadRootId: null },
      { id: "e", number: 9, authorId: other, body: null, threadRootId: null },
    ];
    expect(incomingMainMessages(changes, 5, me).map((item) => item.id)).toEqual(["b"]);
  });
});

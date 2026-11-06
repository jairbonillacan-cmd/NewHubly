"use client";

import type { ChatConversation, ChatMessage, ChatParticipant } from "@hubly/contracts";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatView, type ChatViewCommand } from "./ChatView";
import { CHAT_POLL_MS, incomingChatNotice, mergeChatMessages, startChatPolling } from "./sync";
import { ChatRequestError, chatTransport } from "./transport";

interface ChatScreenProps {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  role: ChatParticipant["role"];
  initiallyUnread?: boolean;
}

interface Draft { text: string; key?: string; sending: boolean; failed: boolean }
const emptyDraft: Draft = { text: "", sending: false, failed: false };
const displayError = (error: unknown) => error instanceof ChatRequestError ? error.message : "Se interrumpió la conexión con el chat.";
const hasStatus = (error: unknown, status: number) => error instanceof ChatRequestError && error.status === status;

export function ChatScreen({ workspaceId, workspaceName, userId, role, initiallyUnread = false }: ChatScreenProps) {
  const api = useMemo(() => chatTransport(workspaceId), [workspaceId]);
  const [unreadOnly, setUnreadOnly] = useState(initiallyUnread);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [people, setPeople] = useState<ChatParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [accessLost, setAccessLost] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [listReady, setListReady] = useState(false);
  const announced = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const readRetryAt = useRef(new Map<string, number>());
  const active = useRef<string | null>(null);
  const bootstrapped = useRef(false);
  const directoryAt = useRef(0);
  const refresh = useRef<() => void>(() => {});
  const selection = useRef<AbortController | null>(null);
  const older = useRef<AbortController | null>(null);
  const readThrough = useRef(new Map<string, number>());
  const sending = useRef(new Set<string>());
  const mutations = useRef(new Set<AbortController>());
  const draft = currentId ? drafts[currentId] ?? emptyDraft : emptyDraft;

  useEffect(() => () => {
    clearTimeout(noticeTimer.current);
    older.current?.abort();
    for (const controller of mutations.current) controller.abort();
  }, []);

  const select = useCallback((id: string | null) => {
    if (active.current === id) return;
    selection.current?.abort();
    older.current?.abort();
    older.current = null;
    active.current = id;
    setCurrentId(id);
    setMessages([]);
    setBefore(null);
    setLoadingOlder(false);
    setLoading(id !== null);
    setActionError(null);
    setNotice(null);
    announced.current = 0;
  }, []);

  const revokeConversation = useCallback((id: string, reason: string) => {
    setDrafts((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== id)));
    readThrough.current.delete(id);
    select(null);
    setActionError(reason);
  }, [select]);

  useEffect(() => {
    if (accessLost) return;
    const controller = new AbortController();
    selection.current = controller;
    const { signal } = controller;
    let cursor = 0;
    let latestNumber = 0;
    let loaded = !currentId;
    async function update() {
      try {
        if (!bootstrapped.current) {
          await api.bootstrap(signal);
          if (signal.aborted) return false;
          bootstrapped.current = true;
        }
        if (currentId && !loaded) {
          const page = await api.history(currentId, null, signal).catch((error: unknown) => {
            if (!hasStatus(error, 404)) throw error;
            return null;
          });
          if (signal.aborted) return false;
          if (!page) {
            revokeConversation(currentId, "La conversación ya no está disponible.");
            return false;
          }
          cursor = page.conversation.changeCursor;
          latestNumber = page.messages.at(-1)?.number ?? 0;
          setMessages(page.messages);
          setBefore(page.before);
          loaded = true;
        }
        const update = await api.sync(currentId, cursor, signal);
        if (signal.aborted) return false;
        setConversations(update.conversations);
        setListReady(true);
        if (currentId && !update.conversationAvailable) {
          revokeConversation(currentId, "La conversación ya no está disponible.");
          return false;
        }
        cursor = update.after;
        if (update.changes.length) {
          setMessages((previous) => mergeChatMessages(previous, update.changes));
          const incoming = update.changes.filter((item) => item.number > latestNumber && item.authorId !== userId && item.body !== null).length;
          latestNumber = Math.max(latestNumber, ...update.changes.map((item) => item.number));
          if (incoming) {
            announced.current += incoming;
            clearTimeout(noticeTimer.current);
            setNotice(incomingChatNotice(announced.current));
          }
        }
        setLoading(false);
        setConnectionError(null);
        if (Date.now() - directoryAt.current >= 30_000 && !document.hidden) {
          try {
            const directory = await api.directory(signal);
            if (signal.aborted) return false;
            setPeople(directory);
            directoryAt.current = Date.now();
          } catch (error) {
            if (hasStatus(error, 401) || hasStatus(error, 404)) throw error;
          }
        }
        return update.hasMore;
      } catch (error) {
        if (signal.aborted) return false;
        setListReady(true);
        setConnectionError(displayError(error));
        if (hasStatus(error, 401) || hasStatus(error, 404)) {
          poll.stop();
          setAccessLost(true);
          setConversations([]);
          setPeople([]);
          setDrafts({});
          readThrough.current.clear();
          select(null);
          if (hasStatus(error, 401)) window.location.assign("/login");
        }
        return false;
      }
    }
    const poll = startChatPolling(update);
    refresh.current = poll.refresh;
    return () => {
      controller.abort();
      poll.stop();
    };
  }, [accessLost, api, currentId, revokeConversation, select, userId]);

  async function submit(input: ChatViewCommand): Promise<boolean> {
    const controller = new AbortController();
    mutations.current.add(controller);
    setActionError(null);
    try {
      const result = await api.command({ ...input, workspaceId }, controller.signal);
      if (input.kind === "createChannel" || input.kind === "openDirect") select(result.conversationId);
      if (input.kind === "send" && result.message && active.current === result.conversationId) {
        const message = result.message;
        setMessages((previous) => mergeChatMessages(previous, [message]));
      }
      refresh.current();
      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        setActionError(displayError(error));
        if (hasStatus(error, 401) || hasStatus(error, 404)) refresh.current();
      }
      return false;
    } finally {
      mutations.current.delete(controller);
    }
  }

  async function send() {
    const id = currentId;
    const body = draft.text.trim();
    if (!id || active.current !== id || !body || sending.current.has(id)) return;
    const key = draft.key ?? crypto.randomUUID();
    sending.current.add(id);
    setDrafts((previous) => ({ ...previous, [id]: { text: draft.text, key, sending: true, failed: false } }));
    const ok = await submit({ kind: "send", conversationId: id, retryKey: key, body });
    sending.current.delete(id);
    setDrafts((previous) => previous[id]?.key !== key ? previous : {
      ...previous, [id]: ok ? emptyDraft : { text: draft.text, key, sending: false, failed: true },
    });
  }

  async function loadOlder() {
    const id = currentId;
    if (!id || active.current !== id || before === null || older.current) return;
    const controller = new AbortController();
    older.current = controller;
    setLoadingOlder(true);
    try {
      const page = await api.history(id, before, controller.signal);
      if (controller.signal.aborted) return;
      setMessages((previous) => mergeChatMessages(previous, page.messages));
      setBefore(page.before);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (hasStatus(error, 404)) revokeConversation(id, displayError(error));
      else setActionError(displayError(error));
    } finally {
      if (older.current === controller) {
        older.current = null;
        setLoadingOlder(false);
      }
    }
  }

  function markVisible(conversationId: string, number: number) {
    // La vista indica de qué conversación es el número: tras un cambio rápido de conversación no se marca la equivocada.
    const id = active.current;
    if (!id || id !== conversationId || (readThrough.current.get(id) ?? 0) >= number) return;
    // Tras un fallo se espera a la siguiente sincronización en vez de reintentar en cada render.
    if (Date.now() < (readRetryAt.current.get(id) ?? 0)) return;
    // El aviso se borra unos segundos después: vaciarlo en el mismo render impediría que el lector de pantalla lo anuncie.
    if (announced.current) {
      announced.current = 0;
      clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 5000);
    }
    readThrough.current.set(id, number);
    const signal = selection.current?.signal;
    void api.command({ kind: "read", workspaceId, conversationId: id, through: number }, signal)
      .then(() => { if (!signal?.aborted) refresh.current(); }, (error: unknown) => {
        if (readThrough.current.get(id) === number) readThrough.current.delete(id);
        readRetryAt.current.set(id, Date.now() + CHAT_POLL_MS);
        if (hasStatus(error, 401) || hasStatus(error, 404)) refresh.current();
      });
  }

  if (accessLost) return <section className="hubly-glass rounded-2xl p-4" aria-labelledby="chat-access">
    <h1 id="chat-access" className="text-lg font-semibold">Chat</h1>
    <p role="alert" className="mt-2 text-sm text-(--text-secondary)">{connectionError ?? "Chat o conversación no disponible."}</p>
    <a href="/hoy" className="mt-2 inline-flex min-h-11 items-center font-semibold text-(--accent-primary)">Volver a Hoy</a>
  </section>;

  return <ChatView workspaceName={workspaceName} userId={userId} canManage={role === "owner" || role === "admin"}
    canSend={role !== "viewer"} unreadOnly={unreadOnly} conversations={conversations} people={people} currentId={currentId}
    listLoading={!listReady} messages={before === null ? messages : messages.filter((entry) => entry.number >= before)} loading={loading} hasOlder={before !== null} loadingOlder={loadingOlder}
    draft={draft.text} sending={draft.sending} failedSend={draft.failed} error={actionError ?? connectionError} notice={notice}
    download={api.download} onFilter={setUnreadOnly} onSelect={select} onOlder={() => void loadOlder()}
    onVisible={markVisible} onCommand={submit}
    onDraft={(text) => {
      // Se conserva la clave de reintento mientras el texto enviado no cambie: así un reintento no duplica un envío que sí llegó.
      if (currentId) setDrafts((previous) => {
        const old = previous[currentId];
        const keep = old?.key !== undefined && old.text.trim() === text.trim();
        return { ...previous, [currentId]: keep && old.key ? { text, key: old.key, sending: false, failed: old.failed } : { text, sending: false, failed: false } };
      });
    }} onSend={() => void send()} />;
}

"use client";

import type { ChatConversation, ChatMessage, ChatParticipant } from "@hubly/contracts";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatView, type BrowserNotificationPermission, type ChatViewCommand } from "./ChatView";
import { readBrowserNotificationPermission } from "./ConversationHeader";
import { conversationName, personName } from "./MemberList";
import { messageMentionsViewer } from "./MessageItem";
import { CHAT_POLL_MS, incomingChatNotice, mergeChatMessages, startChatPolling } from "./sync";
import { ChatRequestError, chatTransport } from "./transport";

export interface ChatScreenProps {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  role: ChatParticipant["role"];
  initiallyUnread?: boolean;
  initialUnreadMentions?: number;
  onUnreadMentionsChange?: (count: number) => void;
}

const stripTitlePrefix = (title: string): string => title.replace(/^\(\d+\)\s*/, "").trim() || "Hubly";

export function formatDocumentTitleWithMentions(baseTitle: string, unreadMentionsCount: number): string {
  const clean = stripTitlePrefix(baseTitle);
  const count = Math.max(0, Math.floor(unreadMentionsCount));
  return count > 0 ? `(${count}) ${clean}` : clean;
}

export function syncDocumentTitleMentions(
  doc: { title: string } | null | undefined,
  unreadMentionsCount: number,
): () => void {
  if (!doc) return () => {};
  const baseTitle = stripTitlePrefix(doc.title);
  doc.title = formatDocumentTitleWithMentions(baseTitle, unreadMentionsCount);
  return () => {
    doc.title = baseTitle;
  };
}

export function discountUnreadMentions(params: {
  unreadMentionIds: ReadonlySet<string>;
  extraUnreadMentions: number;
  readMessageIds: readonly string[];
}): { unreadMentionIds: ReadonlySet<string>; extraUnreadMentions: number } {
  if (params.readMessageIds.length === 0) {
    return {
      unreadMentionIds: params.unreadMentionIds,
      extraUnreadMentions: params.extraUnreadMentions,
    };
  }
  let changed = false;
  let extraDiscount = 0;
  const next = new Set(params.unreadMentionIds);
  for (const id of params.readMessageIds) {
    if (next.delete(id)) {
      changed = true;
    } else {
      extraDiscount += 1;
    }
  }
  return {
    unreadMentionIds: changed ? next : params.unreadMentionIds,
    extraUnreadMentions: Math.max(0, params.extraUnreadMentions - extraDiscount),
  };
}

export function notifyHiddenTabMention(params: {
  authorName: string;
  conversationTitle: string;
  body: string;
  visibilityState?: DocumentVisibilityState | undefined;
  permission?: BrowserNotificationPermission | undefined;
  explicitlyEnabled?: boolean | undefined;
  createNotification?: ((title: string, options: { body: string; tag?: string }) => unknown) | undefined;
  messageId?: string | undefined;
}): boolean {
  if (params.visibilityState !== "hidden") return false;
  if (params.permission !== "granted") return false;
  if (params.explicitlyEnabled === false) return false;
  const title = `${params.authorName} te mencionó en ${params.conversationTitle}`;
  const options: { body: string; tag?: string } = {
    body: params.body,
    ...(params.messageId ? { tag: `hubly-mention-${params.messageId}` } : {}),
  };
  if (params.createNotification) {
    params.createNotification(title, options);
    return true;
  }
  if (typeof window !== "undefined" && "Notification" in window && typeof window.Notification === "function") {
    new window.Notification(title, options);
    return true;
  }
  return false;
}

interface Draft { text: string; key?: string; sending: boolean; failed: boolean }
const emptyDraft: Draft = { text: "", sending: false, failed: false };
const displayError = (error: unknown) => error instanceof ChatRequestError ? error.message : "Se interrumpió la conexión con el chat.";
const hasStatus = (error: unknown, status: number) => error instanceof ChatRequestError && error.status === status;

export function ChatScreen({
  workspaceId, workspaceName, userId, role, initiallyUnread = false,
  initialUnreadMentions = 0, onUnreadMentionsChange,
}: ChatScreenProps) {
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
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [listReady, setListReady] = useState(false);
  const [unreadMentionIds, setUnreadMentionIds] = useState<ReadonlySet<string>>(() => new Set());
  const [extraUnreadMentions, setExtraUnreadMentions] = useState<number>(() => Math.max(0, initialUnreadMentions));
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>(
    () => readBrowserNotificationPermission(),
  );
  const notificationsExplicitlyEnabled = useRef(false);
  const notifiedMentionIds = useRef(new Set<string>());
  const peopleRef = useRef<ChatParticipant[]>([]);
  const announced = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const readRetryAt = useRef(new Map<string, number>());
  const active = useRef<string | null>(null);
  const bootstrapped = useRef(false);
  const directoryAt = useRef(0);
  const directoryController = useRef<AbortController | null>(null);
  const refresh = useRef<() => void>(() => {});
  const selection = useRef<AbortController | null>(null);
  const older = useRef<AbortController | null>(null);
  const readThrough = useRef(new Map<string, number>());
  const sending = useRef(new Set<string>());
  const mutations = useRef(new Set<AbortController>());
  const draft = currentId ? drafts[currentId] ?? emptyDraft : emptyDraft;
  const unreadMentionsCount = extraUnreadMentions + unreadMentionIds.size;

  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    return syncDocumentTitleMentions(document, unreadMentionsCount);
  }, [unreadMentionsCount]);

  useEffect(() => {
    onUnreadMentionsChange?.(unreadMentionsCount);
  }, [onUnreadMentionsChange, unreadMentionsCount]);

  const requestNotificationPermission = useCallback(async () => {
    if (
      typeof window === "undefined"
      || !("Notification" in window)
      || typeof window.Notification?.requestPermission !== "function"
    ) {
      setNotificationPermission("unsupported");
      return "unsupported" as const;
    }
    const result = await window.Notification.requestPermission();
    setNotificationPermission(result);
    if (result === "granted") {
      notificationsExplicitlyEnabled.current = true;
    }
    return result;
  }, []);

  useEffect(() => () => {
    clearTimeout(noticeTimer.current);
    older.current?.abort();
    directoryController.current?.abort();
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

  const handleFatalAccess = useCallback((error: unknown) => {
    setAccessLost(true);
    setConversations([]);
    setPeople([]);
    setDrafts({});
    readThrough.current.clear();
    select(null);
    if (hasStatus(error, 401)) window.location.assign("/login");
  }, [select]);

  const loadDirectory = useCallback(async (externalSignal?: AbortSignal) => {
    directoryController.current?.abort();
    const controller = new AbortController();
    directoryController.current = controller;
    if (externalSignal) {
      if (externalSignal.aborted) return;
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const directory = await api.directory(controller.signal);
      if (controller.signal.aborted) return;
      setPeople(directory);
      setDirectoryError(null);
      directoryAt.current = Date.now();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (hasStatus(error, 401) || hasStatus(error, 404)) {
        setConnectionError(displayError(error));
        handleFatalAccess(error);
        return;
      }
      setDirectoryError(
        error instanceof ChatRequestError ? error.message : "No se pudo cargar el directorio del equipo.",
      );
    }
  }, [api, handleFatalAccess]);

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

    // Se solicita el directorio al montar en paralelo con la carga inicial.
    if (directoryAt.current === 0 && !document.hidden) {
      void loadDirectory(signal);
    }

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
          const previousLatest = latestNumber;
          setMessages((previous) => mergeChatMessages(previous, update.changes));
          const incomingItems = update.changes.filter(
            (item) => item.number > previousLatest && item.authorId !== userId && item.body !== null,
          );
          const incoming = incomingItems.length;
          latestNumber = Math.max(latestNumber, ...update.changes.map((item) => item.number));
          if (incoming) {
            announced.current += incoming;
            clearTimeout(noticeTimer.current);
            setNotice(incomingChatNotice(announced.current));
            const peopleMap = new Map(peopleRef.current.map((person) => [person.id, person]));
            const mentionItems = incomingItems.filter((item) => messageMentionsViewer(item, peopleMap, userId));
            if (mentionItems.length > 0) {
              setUnreadMentionIds((previous) => {
                const next = new Set(previous);
                for (const item of mentionItems) next.add(item.id);
                return next;
              });
              for (const item of mentionItems) {
                if (notifiedMentionIds.current.has(item.id)) continue;
                const conv = update.conversations.find((entry) => entry.id === item.conversationId);
                const convTitle = conv ? conversationName(conv, peopleMap) : workspaceName;
                const authorName = personName(item.authorId, peopleMap.get(item.authorId));
                if (
                  notifyHiddenTabMention({
                    authorName,
                    conversationTitle: convTitle,
                    body: item.body ?? "",
                    visibilityState: typeof document !== "undefined" ? document.visibilityState : "visible",
                    permission: readBrowserNotificationPermission(),
                    explicitlyEnabled: notificationsExplicitlyEnabled.current,
                    messageId: item.id,
                  })
                ) {
                  notifiedMentionIds.current.add(item.id);
                }
              }
            }
          }
        }
        setLoading(false);
        setConnectionError(null);
        if (Date.now() - directoryAt.current >= 30_000 && !document.hidden) {
          void loadDirectory(signal);
        }
        return update.hasMore;
      } catch (error) {
        if (signal.aborted) return false;
        setListReady(true);
        setConnectionError(displayError(error));
        if (hasStatus(error, 401) || hasStatus(error, 404)) {
          poll.stop();
          handleFatalAccess(error);
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
  }, [accessLost, api, currentId, handleFatalAccess, loadDirectory, revokeConversation, select, userId, workspaceName]);

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
    const id = active.current;
    if (!id || id !== conversationId || (readThrough.current.get(id) ?? 0) >= number) return;
    if (Date.now() < (readRetryAt.current.get(id) ?? 0)) return;
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

  function handleMarkMentionsRead(conversationId: string, upToNumber: number, messageIds: string[]) {
    if (messageIds.length === 0) return;
    const extraDiscount = messageIds.filter((id) => !unreadMentionIds.has(id)).length;
    setUnreadMentionIds((previous) => {
      let changed = false;
      const next = new Set(previous);
      for (const id of messageIds) {
        if (next.delete(id)) changed = true;
      }
      return changed ? next : previous;
    });
    if (extraDiscount > 0) {
      setExtraUnreadMentions((previous) => Math.max(0, previous - extraDiscount));
    }
    markVisible(conversationId, upToNumber);
  }

  if (accessLost) return <section className="hubly-glass rounded-2xl p-4" aria-labelledby="chat-access">
    <h1 id="chat-access" className="text-lg font-semibold">Chat</h1>
    <p role="alert" className="mt-2 text-sm text-(--text-secondary)">{connectionError ?? "Chat o conversación no disponible."}</p>
    <a href="/hoy" className="mt-2 inline-flex min-h-11 items-center font-semibold text-(--accent-primary)">Volver a Hoy</a>
  </section>;

  return <ChatView workspaceName={workspaceName} userId={userId} canManage={role === "owner" || role === "admin"}
    canSend={role !== "viewer"} unreadOnly={unreadOnly} conversations={conversations} people={people} currentId={currentId}
    listLoading={!listReady} messages={before === null ? messages : messages.filter((entry) => entry.number >= before)} loading={loading} hasOlder={before !== null} loadingOlder={loadingOlder}
    draft={draft.text} sending={draft.sending} failedSend={draft.failed} error={actionError ?? connectionError}
    directoryError={directoryError} onRetryDirectory={() => void loadDirectory()} notice={notice}
    unreadMentionsCount={unreadMentionsCount} unreadMentionMessageIds={unreadMentionIds}
    notificationPermission={notificationPermission}
    onRequestNotificationPermission={requestNotificationPermission}
    onMarkMentionsRead={handleMarkMentionsRead}
    onFilter={setUnreadOnly} onSelect={select} onOlder={() => void loadOlder()}
    onVisible={markVisible} onCommand={submit}
    onDraft={(text) => {
      if (currentId) setDrafts((previous) => {
        const old = previous[currentId];
        const keep = old?.key !== undefined && old.text.trim() === text.trim();
        return { ...previous, [currentId]: keep && old.key ? { text, key: old.key, sending: false, failed: old.failed } : { text, sending: false, failed: false } };
      });
    }} onSend={() => void send()} />;
}

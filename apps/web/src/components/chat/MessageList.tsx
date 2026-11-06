"use client";

import type { ChatConversation, ChatMessage, ChatParticipant } from "@hubly/contracts";
import { Button } from "@hubly/ui";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { personName, type ChatViewCommand } from "./MemberList";
import {
  MessageItem, jumpToQuotedMessage, messageMentionsViewer, type ChatMessageView, type ChatReactionSummary,
} from "./MessageItem";
import { isMessageEndVisible } from "./sync";

const control = "min-h-11";
export const CHAT_GROUP_WINDOW_MS = 5 * 60 * 1000;
export const dayKey = (iso: string): string => new Date(iso).toISOString().slice(0, 10);
const dayNumber = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

export function collectVisibleUnreadMentions(params: {
  conversationId: string;
  visibleThroughNumber: number;
  visibilityState?: DocumentVisibilityState | undefined;
  messages: readonly ChatMessageView[];
  unreadMentionIds?: ReadonlySet<string> | undefined;
  alreadyReportedIds?: ReadonlySet<string> | undefined;
  viewerId: string;
  people: Map<string, ChatParticipant>;
}): { messageIds: string[]; maxMessageNumber: number | null } {
  if (params.visibilityState === "hidden") {
    return { messageIds: [], maxMessageNumber: null };
  }
  const messageIds: string[] = [];
  let maxMessageNumber: number | null = null;
  for (const entry of params.messages) {
    if (entry.conversationId !== params.conversationId || entry.number > params.visibleThroughNumber) continue;
    if (params.alreadyReportedIds?.has(entry.id)) continue;
    const isUnreadMention = (params.unreadMentionIds?.has(entry.id) ?? false)
      || entry.unreadMention === true
      || (
        params.unreadMentionIds === undefined
        && entry.unreadMention !== false
        && Boolean(params.viewerId && entry.body && messageMentionsViewer(entry, params.people, params.viewerId))
      );
    if (!isUnreadMention) continue;
    messageIds.push(entry.id);
    if (maxMessageNumber === null || entry.number > maxMessageNumber) {
      maxMessageNumber = entry.number;
    }
  }
  return { messageIds, maxMessageNumber };
}

export function daySeparatorLabel(iso: string, now: Date = new Date()): string {
  const targetKey = dayKey(iso);
  const diff = dayNumber(targetKey) - dayNumber(dayKey(now.toISOString()));
  if (diff === 0) return "Hoy";
  if (diff === -1) return "Ayer";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${targetKey}T00:00:00Z`));
}

type GroupedFields = Pick<ChatMessage, "authorId" | "sentAt">;

export function shouldGroupMessages(previous: GroupedFields | undefined, current: GroupedFields): boolean {
  if (!previous || previous.authorId !== current.authorId || dayKey(previous.sentAt) !== dayKey(current.sentAt)) return false;
  const delta = Date.parse(current.sentAt) - Date.parse(previous.sentAt);
  return delta >= 0 && delta <= CHAT_GROUP_WINDOW_MS;
}

export function MessageList({
  conversation, messages, people, userId, loading, hasOlder, loadingOlder, freshMessageIds,
  highlightedMessageId, reactionsByMessage, reactionErrorsByMessage, unreadMentionMessageIds, now,
  onOlder, onVisible, onMarkMentionsRead, onCommand, onReply, onOpenThread, onJumpToMessage, onToggleReaction,
}: {
  conversation: ChatConversation; messages: readonly ChatMessageView[]; people: Map<string, ChatParticipant>; userId: string;
  loading: boolean; hasOlder: boolean; loadingOlder: boolean; freshMessageIds?: ReadonlySet<string> | undefined;
  highlightedMessageId?: string | null | undefined;
  reactionsByMessage?: Readonly<Record<string, readonly ChatReactionSummary[]>> | undefined;
  reactionErrorsByMessage?: Readonly<Record<string, string | null | undefined>> | undefined;
  unreadMentionMessageIds?: ReadonlySet<string> | undefined;
  now?: Date | undefined; onOlder: () => void; onVisible: (conversationId: string, number: number) => void;
  onMarkMentionsRead?: ((conversationId: string, upToMessageNumber: number, messageIds: string[]) => void) | undefined;
  onCommand: (input: ChatViewCommand) => Promise<boolean>;
  onReply?: ((message: ChatMessageView) => void) | undefined;
  onOpenThread?: ((message: ChatMessageView) => void) | undefined;
  onJumpToMessage?: ((messageId: string) => void) | undefined;
  onToggleReaction?: ((messageId: string, emoji: string) => Promise<boolean | void> | boolean | void) | undefined;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const earlier = useRef<{ height: number; top: number } | null>(null);
  const baselineMax = useRef<number | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedMentionIds = useRef<Set<string>>(new Set());
  const [localHighlightId, setLocalHighlightId] = useState<string | null>(null);

  if (!loading && baselineMax.current === null) {
    baselineMax.current = messages.reduce((max, item) => Math.max(max, item.number), 0);
  }

  useEffect(() => () => {
    if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
  }, []);

  function visible() {
    const element = scroll.current;
    if (!element || loading) return;
    pinned.current = element.scrollHeight - element.clientHeight - element.scrollTop < 32;
    const latest = messages.at(-1);
    const end = element.querySelector("li:last-child")?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const endVisible = Boolean(end && isMessageEndVisible(end.bottom, rect, window.innerHeight));
    if (pinned.current && latest && !document.hidden) {
      if (endVisible) {
        onVisible(conversation.id, latest.number);
      }
      if (onMarkMentionsRead && (endVisible || (rect.bottom === 0 && (end?.bottom ?? 0) === 0))) {
        const unread = collectVisibleUnreadMentions({
          conversationId: conversation.id,
          visibleThroughNumber: latest.number,
          visibilityState: document.visibilityState,
          messages,
          unreadMentionIds: unreadMentionMessageIds,
          alreadyReportedIds: reportedMentionIds.current,
          viewerId: userId,
          people,
        });
        if (unread.messageIds.length > 0 && unread.maxMessageNumber !== null) {
          for (const id of unread.messageIds) {
            reportedMentionIds.current.add(id);
          }
          onMarkMentionsRead(conversation.id, unread.maxMessageNumber, unread.messageIds);
        }
      }
    }
  }

  useEffect(() => {
    window.addEventListener("scroll", visible, { passive: true });
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("scroll", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  });

  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element || loading) return;
    if (earlier.current && !loadingOlder) {
      element.scrollTop = earlier.current.top + element.scrollHeight - earlier.current.height;
      earlier.current = null;
    } else if (pinned.current && !earlier.current) {
      element.scrollTop = element.scrollHeight;
    }
    visible();
  });

  function handleJump(targetId: string) {
    onJumpToMessage?.(targetId);
    const reduced = typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    jumpToQuotedMessage(targetId, null, reduced);
    setLocalHighlightId(targetId);
    if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setLocalHighlightId(null), 1800);
  }

  const messagesById = new Map(messages.map((item) => [item.id, item]));
  const activeHighlight = highlightedMessageId ?? localHighlightId;

  return <div ref={scroll} onScroll={visible} tabIndex={0} aria-label="Historial de la conversación" className="min-h-0 grow overflow-y-auto px-3">
    {hasOlder && <Button variant="ghost" size="sm" className={control} isPending={loadingOlder} onPress={() => {
      if (scroll.current) earlier.current = { height: scroll.current.scrollHeight, top: scroll.current.scrollTop };
      onOlder();
    }}>{loadingOlder ? "Cargando mensajes…" : "Ver mensajes anteriores"}</Button>}
    {loading ? <p role="status" className="p-4 text-sm">Cargando conversación…</p>
      : messages.length ? <ol aria-label="Mensajes" className="space-y-0.5 py-2">
        {messages.map((entry, index) => {
          const previous = messages[index - 1];
          const showDaySeparator = !previous || dayKey(previous.sentAt) !== dayKey(entry.sentAt);
          const grouped = !showDaySeparator && shouldGroupMessages(previous, entry);
          const isOwn = entry.authorId === userId;
          const isNew = freshMessageIds ? freshMessageIds.has(entry.id) : baselineMax.current !== null && entry.number > baselineMax.current;
          const dayLabel = showDaySeparator ? daySeparatorLabel(entry.sentAt, now) : null;
          const quoted = entry.replyToId ? messagesById.get(entry.replyToId) ?? undefined : undefined;
          return <React.Fragment key={entry.id}>
            {dayLabel && <li className="my-2 px-2">
              <div role="separator" aria-label={dayLabel} className="flex items-center gap-2 text-xs font-semibold text-(--text-muted)">
                <span aria-hidden="true" className="h-px grow bg-(--border-subtle)" />
                <span>{dayLabel}</span>
                <span aria-hidden="true" className="h-px grow bg-(--border-subtle)" />
              </div>
            </li>}
            <MessageItem entry={entry} name={isOwn ? "Tú" : personName(entry.authorId, people.get(entry.authorId))}
              person={people.get(entry.authorId)} people={people} viewerId={userId} isOwn={isOwn}
              writable={conversation.writable} canEdit={conversation.writable && isOwn}
              grouped={grouped} isNew={isNew} highlighted={activeHighlight === entry.id}
              quotedMessage={quoted} reactions={reactionsByMessage?.[entry.id] ?? entry.reactions}
              reactionError={reactionErrorsByMessage?.[entry.id]} now={now} onCommand={onCommand}
              onReply={onReply} onOpenThread={onOpenThread} onJumpToMessage={handleJump}
              onToggleReaction={onToggleReaction} />
          </React.Fragment>;
        })}
      </ol> : <p className="p-4 text-sm text-(--text-secondary)">Todavía no hay mensajes.</p>}
  </div>;
}

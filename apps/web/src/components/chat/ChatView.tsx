"use client";

import type { ChatConversation, ChatParticipant } from "@hubly/contracts";
import { Alert, Button } from "@hubly/ui";
import React, { useEffect, useRef, useState } from "react";
import { Composer } from "./Composer";
import { ChannelForm, ConversationHeader, type BrowserNotificationPermission } from "./ConversationHeader";
import {
  ChatAvatar, DirectoryErrorBanner, MemberList, MissingNameBanner, conversationName, personName, type ChatViewCommand,
} from "./MemberList";
import type { ChatMessageView, ChatReactionSummary } from "./MessageItem";
import { MessageList } from "./MessageList";
import { ThreadPanel } from "./ThreadPanel";

export type { BrowserNotificationPermission } from "./ConversationHeader";
export type { ChatViewCommand } from "./MemberList";
export type { ChatMessageView, ChatReactionSummary } from "./MessageItem";

export interface ChatViewProps {
  workspaceName: string;
  userId: string;
  canManage: boolean;
  canSend: boolean;
  unreadOnly: boolean;
  conversations: ChatConversation[];
  people: ChatParticipant[];
  currentId: string | null;
  messages: ChatMessageView[];
  listLoading?: boolean;
  loading: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  draft: string;
  sending: boolean;
  failedSend: boolean;
  error: string | null;
  directoryError?: string | null;
  notice: string | null;
  freshMessageIds?: ReadonlySet<string>;
  highlightedMessageId?: string | null;
  activeThreadRootId?: string | null;
  threadMessages?: readonly ChatMessageView[];
  replyingToMessageId?: string | null;
  reactionsByMessage?: Readonly<Record<string, readonly ChatReactionSummary[]>>;
  reactionErrorsByMessage?: Readonly<Record<string, string | null | undefined>>;
  unreadMentionsCount?: number | undefined;
  unreadMentionMessageIds?: ReadonlySet<string> | undefined;
  notificationPermission?: BrowserNotificationPermission | undefined;
  now?: Date;
  onRetryDirectory?: () => void;
  onFilter: (enabled: boolean) => void;
  onSelect: (id: string | null) => void;
  onOlder: () => void;
  onVisible: (conversationId: string, number: number) => void;
  onMarkMentionsRead?: (conversationId: string, upToMessageNumber: number, messageIds: string[]) => void;
  onRequestNotificationPermission?: () => Promise<BrowserNotificationPermission | void> | BrowserNotificationPermission | void;
  onCommand: (input: ChatViewCommand) => Promise<boolean>;
  onDraft: (value: string) => void;
  onSend: () => void;
  onReplyToMessage?: (message: ChatMessageView | null) => void;
  onOpenThread?: (message: ChatMessageView | null) => void;
  onJumpToMessage?: (messageId: string) => void;
  onSendThreadReply?: (rootMessageId: string, body: string) => Promise<boolean | void> | boolean | void;
  onToggleReaction?: (messageId: string, emoji: string) => Promise<boolean | void> | boolean | void;
}

const control = "min-h-11";
const sectionLabel = "text-xs font-semibold tracking-wide text-(--text-secondary) uppercase";

function ConversationView({ props, conversation, people }: {
  props: ChatViewProps; conversation: ChatConversation; people: Map<string, ChatParticipant>;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [threadRootId, setThreadRootId] = useState<string | null>(props.activeThreadRootId ?? null);
  const [replyingToId, setReplyingToId] = useState<string | null>(props.replyingToMessageId ?? null);

  useEffect(() => {
    if (props.activeThreadRootId !== undefined) setThreadRootId(props.activeThreadRootId);
  }, [props.activeThreadRootId]);

  useEffect(() => {
    if (props.replyingToMessageId !== undefined) setReplyingToId(props.replyingToMessageId);
  }, [props.replyingToMessageId]);

  useEffect(() => {
    if (conversation.archived && document.activeElement === document.body) heading.current?.focus({ preventScroll: true });
  }, [conversation.archived]);
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, []);

  const replyingTo = replyingToId ? props.messages.find((item) => item.id === replyingToId) ?? null : null;
  const threadRoot = threadRootId ? props.messages.find((item) => item.id === threadRootId) ?? null : null;
  const threadReplies = threadRoot
    ? (props.threadMessages ?? props.messages.filter((item) => item.threadRootId === threadRoot.id))
    : [];

  return (
    <div className="flex min-h-0 min-w-0 grow gap-3">
      <section className="hubly-glass flex min-h-0 min-w-0 grow flex-col overflow-hidden rounded-2xl" aria-labelledby="chat-conversation">
        <ConversationHeader conversation={conversation} people={people} canManage={props.canManage}
          headingRef={heading} notificationPermission={props.notificationPermission}
          onRequestNotificationPermission={props.onRequestNotificationPermission}
          onSelect={props.onSelect} onCommand={props.onCommand} />
        <MessageList conversation={conversation} messages={props.messages} people={people} userId={props.userId}
          loading={props.loading} hasOlder={props.hasOlder} loadingOlder={props.loadingOlder}
          freshMessageIds={props.freshMessageIds} highlightedMessageId={props.highlightedMessageId}
          reactionsByMessage={props.reactionsByMessage} reactionErrorsByMessage={props.reactionErrorsByMessage}
          unreadMentionMessageIds={props.unreadMentionMessageIds}
          now={props.now} onOlder={props.onOlder} onVisible={props.onVisible}
          onMarkMentionsRead={props.onMarkMentionsRead} onCommand={props.onCommand}
          onReply={(message) => { setReplyingToId(message.id); props.onReplyToMessage?.(message); }}
          onOpenThread={(message) => { setThreadRootId(message.id); props.onOpenThread?.(message); }}
          onJumpToMessage={props.onJumpToMessage}
          onToggleReaction={props.onToggleReaction} />
        {replyingTo && conversation.writable && (
          <div role="status" aria-label="Contexto de respuesta" className="flex flex-wrap items-center justify-between gap-2 border-t border-(--border-subtle) bg-(--surface-sunken) px-3 py-2 text-xs">
            <div className="min-w-0 truncate">
              <span className="font-semibold text-(--accent-primary)">
                Respondiendo a {replyingTo.authorId === props.userId ? "Tú" : personName(replyingTo.authorId, people.get(replyingTo.authorId))}:
              </span>{" "}
              <span className="text-(--text-secondary)">{replyingTo.body ?? "Mensaje eliminado"}</span>
            </div>
            <Button size="sm" variant="ghost" className="min-h-8 text-xs"
              onPress={() => { setReplyingToId(null); props.onReplyToMessage?.(null); }}>
              Cancelar respuesta
            </Button>
          </div>
        )}
        <Composer writable={conversation.writable} loading={props.loading} draft={props.draft}
          sending={props.sending} failedSend={props.failedSend} onDraft={props.onDraft} onSend={props.onSend} />
      </section>
      {threadRoot && (
        <ThreadPanel rootMessage={threadRoot} replies={threadReplies} people={people} userId={props.userId}
          writable={conversation.writable} now={props.now} sending={props.sending}
          onClose={() => { setThreadRootId(null); props.onOpenThread?.(null); }}
          onSendReply={props.onSendThreadReply} />
      )}
    </div>
  );
}

export function ChatView(props: ChatViewProps) {
  const people = new Map(props.people.map((person) => [person.id, person]));
  const conversation = props.conversations.find((entry) => entry.id === props.currentId);
  const rows = props.unreadOnly ? props.conversations.filter((entry) => entry.unread) : props.conversations;
  const unreadCount = props.conversations.filter((entry) => entry.unread).length;
  const listHeading = useRef<HTMLHeadingElement>(null);

  const unreadMentions = Math.max(0, props.unreadMentionsCount ?? 0);

  return <div className="flex min-h-0 min-w-0 grow flex-col gap-3">
    {conversation && <h1 className="sr-only lg:hidden">Chat</h1>}
    <header className={`hubly-glass shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl p-3 ${conversation ? "hidden lg:flex" : "flex"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <p className={sectionLabel}>{props.workspaceName}</p>
          <h1 className="text-2xl font-semibold">Chat</h1>
        </div>
        {unreadMentions > 0 && (
          <span
            data-chat-unread-mentions={unreadMentions}
            aria-label={unreadMentions === 1 ? "1 mención sin leer" : `${unreadMentions} menciones sin leer`}
            className="inline-flex min-h-5 items-center rounded-full bg-(--accent-primary) px-2 py-0.5 text-xs font-semibold text-(--text-on-accent) tabular-nums"
          >
            {unreadMentions === 1 ? "1 mención sin leer" : `${unreadMentions} menciones sin leer`}
          </span>
        )}
      </div>
      <p className="text-xs text-(--text-secondary)">
        El propietario de la agencia puede exportar los canales desde los ajustes de equipo.
      </p>
    </header>
    <MissingNameBanner userId={props.userId} people={people} />
    <DirectoryErrorBanner error={props.directoryError} onRetry={props.onRetryDirectory} />
    {props.error && <Alert status="danger" role="alert" className="bg-(--status-danger-bg) text-(--status-danger-text)">
      <Alert.Indicator />
      <Alert.Content><Alert.Title className="text-(--status-danger-text)">{props.error}</Alert.Title></Alert.Content>
    </Alert>}
    <span role="status" className="sr-only">{props.notice}</span>
    <div className="grid min-h-0 grow grid-rows-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(var(--chat-list-min),var(--chat-list-max))_minmax(0,1fr)]">
      <aside className={`hubly-glass min-h-0 min-w-0 overflow-y-auto rounded-2xl p-3 ${conversation ? "hidden lg:block" : ""}`} aria-labelledby="chat-list-title">
        <h2 ref={listHeading} id="chat-list-title" tabIndex={-1} className="mb-2 text-base font-semibold">Conversaciones</h2>
        <div className="flex flex-wrap gap-1 pb-2">
          <Button size="sm" variant={props.unreadOnly ? "ghost" : "secondary"} className={control} aria-pressed={!props.unreadOnly} onPress={() => props.onFilter(false)}>Todas</Button>
          <Button size="sm" variant={props.unreadOnly ? "secondary" : "ghost"} className={control} aria-pressed={props.unreadOnly} onPress={() => props.onFilter(true)}>Sin leer {unreadCount}</Button>
        </div>
        {props.canManage && <ChannelForm onCommand={props.onCommand} />}
        <MemberList people={props.people} userId={props.userId} canSend={props.canSend} onCommand={props.onCommand} />
        {(["channel", "direct"] as const).map((kind) => {
          const group = rows.filter((entry) => entry.kind === kind);
          if (!group.length) return null;
          return <section key={kind} className="mt-3">
            <h3 className={sectionLabel}>{kind === "channel" ? "Canales" : "Mensajes directos"}</h3>
            <ul className="mt-1 space-y-1">{group.map((entry) => {
              const name = conversationName(entry, people);
              const current = entry.id === conversation?.id;
              return <li key={entry.id}>
                <Button size="sm" variant={current ? "secondary" : "ghost"} fullWidth aria-current={current}
                  className={`${control} justify-start text-left`} onPress={() => props.onSelect(entry.id)}>
                  {entry.kind === "direct" && <ChatAvatar person={entry.peerId ? people.get(entry.peerId) : undefined} />}
                  <span className="min-w-0 grow wrap-anywhere">{name}</span>
                  {entry.unread && <span className="text-xs text-(--accent-primary)">Sin leer</span>}
                  {entry.archived && <span className="text-xs text-(--text-muted)">Archivado</span>}
                </Button>
              </li>;
            })}</ul>
          </section>;
        })}
        {props.listLoading ? <p role="status" className="mt-3 text-sm text-(--text-secondary)">Cargando conversaciones…</p>
          : !rows.length && <p className="mt-3 text-sm text-(--text-secondary)">{props.unreadOnly ? "Ya estás al día." : "Aún no hay conversaciones."}</p>}
      </aside>
      {conversation ? <ConversationView key={conversation.id} conversation={conversation} people={people} props={{
        ...props, onSelect: (id) => { props.onSelect(id); if (!id) requestAnimationFrame(() => { window.scrollTo(0, 0); listHeading.current?.focus({ preventScroll: true }); }); },
      }} /> : <div className="hubly-glass hidden items-center justify-center rounded-2xl p-6 text-sm text-(--text-secondary) lg:flex">
        Elige una conversación para leer sus mensajes.
      </div>}
    </div>
  </div>;
}

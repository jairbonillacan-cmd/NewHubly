"use client";

import type { ChatConversation, ChatMessage, ChatParticipant } from "@hubly/contracts";
import { Alert, Button } from "@hubly/ui";
import React, { useEffect, useRef } from "react";
import { Composer } from "./Composer";
import { ChannelForm, ConversationHeader } from "./ConversationHeader";
import { ChatAvatar, DirectoryErrorBanner, MemberList, MissingNameBanner, conversationName, type ChatViewCommand } from "./MemberList";
import { MessageList } from "./MessageList";

export type { ChatViewCommand } from "./MemberList";

export interface ChatViewProps {
  workspaceName: string;
  userId: string;
  canManage: boolean;
  canSend: boolean;
  unreadOnly: boolean;
  conversations: ChatConversation[];
  people: ChatParticipant[];
  currentId: string | null;
  messages: ChatMessage[];
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
  now?: Date;
  onRetryDirectory?: () => void;
  onFilter: (enabled: boolean) => void;
  onSelect: (id: string | null) => void;
  onOlder: () => void;
  onVisible: (conversationId: string, number: number) => void;
  onCommand: (input: ChatViewCommand) => Promise<boolean>;
  onDraft: (value: string) => void;
  onSend: () => void;
}

const control = "min-h-11";
const sectionLabel = "text-xs font-semibold tracking-wide text-(--text-secondary) uppercase";

function ConversationView({ props, conversation, people }: {
  props: ChatViewProps; conversation: ChatConversation; people: Map<string, ChatParticipant>;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (conversation.archived && document.activeElement === document.body) heading.current?.focus({ preventScroll: true });
  }, [conversation.archived]);
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, []);

  return <section className="hubly-glass flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl" aria-labelledby="chat-conversation">
    <ConversationHeader conversation={conversation} people={people} canManage={props.canManage}
      headingRef={heading} onSelect={props.onSelect} onCommand={props.onCommand} />
    <MessageList conversation={conversation} messages={props.messages} people={people} userId={props.userId}
      loading={props.loading} hasOlder={props.hasOlder} loadingOlder={props.loadingOlder}
      freshMessageIds={props.freshMessageIds} now={props.now} onOlder={props.onOlder}
      onVisible={props.onVisible} onCommand={props.onCommand} />
    <Composer writable={conversation.writable} loading={props.loading} draft={props.draft}
      sending={props.sending} failedSend={props.failedSend} onDraft={props.onDraft} onSend={props.onSend} />
  </section>;
}

export function ChatView(props: ChatViewProps) {
  const people = new Map(props.people.map((person) => [person.id, person]));
  const conversation = props.conversations.find((entry) => entry.id === props.currentId);
  const rows = props.unreadOnly ? props.conversations.filter((entry) => entry.unread) : props.conversations;
  const unreadCount = props.conversations.filter((entry) => entry.unread).length;
  const listHeading = useRef<HTMLHeadingElement>(null);

  return <div className="flex min-h-0 min-w-0 grow flex-col gap-3">
    {conversation && <h1 className="sr-only lg:hidden">Chat</h1>}
    <header className={`hubly-glass shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl p-3 ${conversation ? "hidden lg:flex" : "flex"}`}>
      <div>
        <p className={sectionLabel}>{props.workspaceName}</p>
        <h1 className="text-2xl font-semibold">Chat</h1>
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

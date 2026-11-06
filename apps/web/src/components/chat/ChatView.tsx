"use client";

import type { ChatCommand, ChatConversation, ChatMessage, ChatParticipant } from "@hubly/contracts";
import { Icon, IconoHubly } from "@hubly/ui";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

type LocalCommand = ChatCommand extends infer C ? C extends ChatCommand ? Omit<C, "workspaceId"> : never : never;
export type ChatViewCommand = LocalCommand;

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
  loading: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  draft: string;
  sending: boolean;
  failedSend: boolean;
  error: string | null;
  notice: string | null;
  download: (format: "json" | "md") => string;
  onFilter: (enabled: boolean) => void;
  onSelect: (id: string | null) => void;
  onOlder: () => void;
  onVisible: (number: number) => void;
  onCommand: (input: LocalCommand) => Promise<boolean>;
  onDraft: (value: string) => void;
  onSend: () => void;
}

const control = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-(--surface-interactive) disabled:cursor-not-allowed disabled:opacity-60";
const outline = `${control} border border-(--border-control)`;
const primary = `${control} bg-(--accent-primary) text-(--text-on-accent) hover:bg-(--accent-primary-hover)`;
const input = "min-h-11 w-full rounded-xl border border-(--border-control) bg-(--surface-raised) px-3 py-2 text-sm text-(--text-primary)";
const sectionLabel = "text-xs font-semibold tracking-wide text-(--text-secondary) uppercase";
const statusLabel = { online: "En línea", away: "Ausente", dnd: "No molestar" };
const statusIcon = { online: "en-linea", away: "ausente", dnd: "no-molestar" } as const;

function personName(id: string, person?: ChatParticipant) {
  return person?.name || `Miembro ${id.slice(0, 4).toUpperCase()}`;
}

function conversationName(conversation: ChatConversation, people: Map<string, ChatParticipant>) {
  return conversation.kind === "channel" ? `#${conversation.slug}`
    : conversation.peerId ? personName(conversation.peerId, people.get(conversation.peerId)) : "Mensaje directo";
}

function Avatar({ name, person }: { name: string; person?: ChatParticipant | undefined }) {
  const initials = name.split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0] ?? "").join("").toUpperCase();
  return <span className="relative grid size-8 shrink-0 place-items-center rounded-xl bg-(--accent-primary-subtle) text-xs font-semibold text-(--accent-primary)">
    <span aria-hidden="true">{initials}</span>
    {person?.status && <span className="absolute -right-1 -bottom-1 rounded-full bg-(--surface-raised)" title={statusLabel[person.status]}>
      <IconoHubly name={statusIcon[person.status]} className="size-4" />
      <span className="sr-only">{statusLabel[person.status]}</span>
    </span>}
  </span>;
}

function ChannelForm({ conversation, onCommand }: { conversation?: ChatConversation; onCommand: ChatViewProps["onCommand"] }) {
  const details = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  async function apply(command: LocalCommand, form?: HTMLFormElement) {
    if (busy) return;
    setBusy(true);
    try {
      if (await onCommand(command)) {
        form?.reset();
        if (details.current) details.current.open = false;
      }
    } finally {
      setBusy(false);
      setConfirmArchive(false);
    }
  }
  return <details ref={details} className="text-sm">
    <summary className="min-h-11 cursor-pointer rounded-xl px-2 py-3 font-semibold">
      {conversation ? "Administrar canal" : "Nuevo canal"}
    </summary>
    <form className="space-y-2 p-2" onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const slug = String(new FormData(form).get("slug") ?? "");
      void apply(conversation ? { kind: "renameChannel", conversationId: conversation.id, slug } : { kind: "createChannel", slug }, form);
    }}>
      <label className="block">
        <span className="mb-1 block text-xs">Nombre del canal</span>
        <input name="slug" required maxLength={48} defaultValue={conversation?.slug ?? ""} placeholder="produccion" className={input} />
      </label>
      <p className="text-xs text-(--text-muted)">Usa letras sin acento, números y guiones.</p>
      <button type="submit" className={outline} disabled={busy}>{conversation ? "Guardar nombre" : "Crear canal"}</button>
      {conversation && !confirmArchive && <button type="button" className={control} onClick={() => setConfirmArchive(true)}>Archivar canal</button>}
      {conversation && confirmArchive && <div className="flex flex-wrap gap-2">
        <button type="button" className={outline} disabled={busy} onClick={() => void apply({ kind: "archiveChannel", conversationId: conversation.id })}>Confirmar archivo</button>
        <button type="button" className={control} onClick={() => setConfirmArchive(false)}>Cancelar</button>
      </div>}
    </form>
  </details>;
}

function DirectForm({ people, userId, onCommand }: Pick<ChatViewProps, "people" | "userId" | "onCommand">) {
  const details = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const eligible = people.filter((person) => person.id !== userId && person.role !== "viewer");
  return <details ref={details} className="text-sm">
    <summary className="min-h-11 cursor-pointer rounded-xl px-2 py-3 font-semibold">Nuevo directo</summary>
    {eligible.length ? <form className="space-y-2 p-2" onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      const recipientId = String(new FormData(event.currentTarget).get("recipient") ?? "");
      setBusy(true);
      try {
        if (await onCommand({ kind: "openDirect", recipientId }) && details.current) details.current.open = false;
      } finally { setBusy(false); }
    }}>
      <label className="block">
        <span className="mb-1 block text-xs">Persona</span>
        <select name="recipient" aria-label="Persona" className={input} required>
          <option value="">Elige una persona</option>
          {eligible.map((person) => <option key={person.id} value={person.id}>{personName(person.id, person)}</option>)}
        </select>
      </label>
      <button type="submit" className={outline} disabled={busy}>Abrir conversación</button>
    </form> : <p className="p-2 text-(--text-muted)">No hay compañeros disponibles para un directo.</p>}
  </details>;
}

function MessageItem({ entry, name, person, canEdit, onCommand }: {
  entry: ChatMessage; name: string; person?: ChatParticipant | undefined; canEdit: boolean; onCommand: ChatViewProps["onCommand"];
}) {
  const [mode, setMode] = useState<"edit" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);
  const editInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (mode === "edit") editInput.current?.focus(); }, [mode]);
  async function save(command: LocalCommand) {
    if (busy) return;
    setBusy(true);
    try { if (await onCommand(command)) setMode(null); }
    finally { setBusy(false); }
  }
  return <li className="flex gap-3 rounded-xl px-2 py-3">
    <Avatar name={name} person={person} />
    <div className="min-w-0 grow">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-semibold">{name}</span>
        <time dateTime={entry.sentAt} className="text-xs text-(--text-muted)" suppressHydrationWarning>
          {new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.sentAt))}
        </time>
        {entry.editedAt && entry.body !== null && <span className="text-xs text-(--text-muted)">Editado</span>}
      </div>
      {mode === "edit" && entry.body !== null ? <form className="mt-2 space-y-2" onSubmit={(event) => {
        event.preventDefault();
        const body = String(new FormData(event.currentTarget).get("body") ?? "");
        void save({ kind: "edit", conversationId: entry.conversationId, messageId: entry.id, body });
      }}>
        <textarea ref={editInput} aria-label="Editar mensaje" name="body" className={input} defaultValue={entry.body} required maxLength={4000} />
        <button className={primary} type="submit" disabled={busy}>Guardar</button>
        <button className={control} type="button" onClick={() => setMode(null)}>Cancelar</button>
      </form> : <p className={`text-sm wrap-anywhere whitespace-pre-wrap ${entry.body === null ? "text-(--text-muted) italic" : ""}`}>
        {entry.body ?? "Mensaje eliminado"}
      </p>}
      {canEdit && entry.body !== null && mode === null && <div className="flex gap-1">
        <button type="button" className={control} onClick={() => setMode("edit")}><Icon name="lapiz" /> Editar</button>
        <button type="button" className={control} onClick={() => setMode("remove")}>Retirar</button>
      </div>}
      {canEdit && entry.body !== null && mode === "remove" && <div className="flex flex-wrap gap-2">
        <button type="button" className={outline} disabled={busy} onClick={() => void save({ kind: "remove", conversationId: entry.conversationId, messageId: entry.id })}>Confirmar retiro</button>
        <button type="button" className={control} onClick={() => setMode(null)}>Cancelar</button>
      </div>}
    </div>
  </li>;
}

function ConversationView({ props, conversation, people }: { props: ChatViewProps; conversation: ChatConversation; people: Map<string, ChatParticipant> }) {
  const scroll = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pinned = useRef(true);
  const earlier = useRef<{ height: number; top: number } | null>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, []);

  function visible() {
    const element = scroll.current;
    if (!element || props.loading) return;
    pinned.current = element.scrollHeight - element.clientHeight - element.scrollTop < 32;
    const latest = props.messages.at(-1);
    const end = element.querySelector("li:last-child")?.getBoundingClientRect();
    if (pinned.current && latest && end && end.bottom <= window.innerHeight + 1 && end.bottom > 0 && !document.hidden) {
      props.onVisible(latest.number);
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
    if (!element || props.loading) return;
    if (earlier.current && !props.loadingOlder) {
      element.scrollTop = earlier.current.top + element.scrollHeight - earlier.current.height;
      earlier.current = null;
    } else if (pinned.current && !earlier.current) {
      element.scrollTop = element.scrollHeight;
    }
    visible();
  });

  return <section className="hubly-glass flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl" aria-labelledby="chat-conversation">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-(--border-default) p-3">
      <div className="min-w-0">
        <button type="button" className={`${control} lg:hidden`} onClick={() => props.onSelect(null)}>← Conversaciones</button>
        <h2 ref={heading} id="chat-conversation" tabIndex={-1} className="text-lg font-semibold wrap-anywhere">{conversationName(conversation, people)}</h2>
        <p className="text-xs text-(--text-secondary)">
          {conversation.archived ? "Canal archivado" : conversation.kind === "channel" ? "Canal de la agencia" : "Conversación privada"}
        </p>
      </div>
      {props.canManage && conversation.kind === "channel" && conversation.slug !== "general" && !conversation.archived &&
        <ChannelForm key={conversation.id} conversation={conversation} onCommand={props.onCommand} />}
    </header>
    <div ref={scroll} onScroll={visible} tabIndex={0} aria-label="Historial de la conversación"
      className="min-h-0 grow overflow-y-auto px-3">
      {props.hasOlder && <button type="button" className={control} disabled={props.loadingOlder} onClick={() => {
        if (scroll.current) earlier.current = { height: scroll.current.scrollHeight, top: scroll.current.scrollTop };
        props.onOlder();
      }}>{props.loadingOlder ? "Cargando mensajes…" : "Ver mensajes anteriores"}</button>}
      {props.loading ? <p role="status" className="p-4 text-sm">Cargando conversación…</p>
        : props.messages.length ? <ol aria-label="Mensajes" className="divide-y divide-(--border-subtle)">
          {props.messages.map((entry) => <MessageItem key={entry.id} entry={entry}
            name={entry.authorId === props.userId ? "Tú" : personName(entry.authorId, people.get(entry.authorId))}
            person={people.get(entry.authorId)} canEdit={conversation.writable && entry.authorId === props.userId} onCommand={props.onCommand} />)}
        </ol> : <p className="p-4 text-sm text-(--text-secondary)">Todavía no hay mensajes.</p>}
    </div>
    {conversation.writable && !props.loading ? <form className="grid shrink-0 gap-2 border-t border-(--border-default) p-3 sm:grid-cols-[1fr_auto] sm:items-end"
      onSubmit={(event) => { event.preventDefault(); props.onSend(); }}>
      <label className="min-w-0">
        <span className="mb-1 block text-sm font-semibold">Mensaje</span>
        <textarea className={input} rows={2} value={props.draft} disabled={props.sending} maxLength={4000}
          onChange={(event) => props.onDraft(event.target.value)} placeholder="Escribe un mensaje…" />
      </label>
      <button type="submit" className={primary} disabled={props.sending || !props.draft.trim()}>
        {props.sending ? "Enviando…" : props.failedSend ? "Reintentar envío" : "Enviar"}
      </button>
    </form> : !props.loading && <p className="border-t border-(--border-default) p-3 text-sm text-(--text-secondary)">Conversación de solo lectura.</p>}
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
      <div className="flex gap-2">
        <a className={control} href={props.download("json")} aria-label="Descargar mis mensajes en JSON"><Icon name="descargar" /> JSON</a>
        <a className={control} href={props.download("md")} aria-label="Descargar mis mensajes en Markdown"><Icon name="descargar" /> Markdown</a>
      </div>
    </header>
    {props.error && <p role="alert" className="rounded-xl bg-(--status-danger-bg) p-3 text-sm text-(--status-danger-text)">{props.error}</p>}
    <span role="status" className="sr-only">{props.notice}</span>
    <div className="grid min-h-0 grow grid-rows-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(var(--chat-list-min),var(--chat-list-max))_minmax(0,1fr)]">
      <aside className={`hubly-glass min-h-0 min-w-0 overflow-y-auto rounded-2xl p-3 ${conversation ? "hidden lg:block" : ""}`} aria-labelledby="chat-list-title">
        <h2 ref={listHeading} id="chat-list-title" tabIndex={-1} className="mb-2 text-base font-semibold">Conversaciones</h2>
        <div className="flex flex-wrap gap-1 pb-2">
          <button type="button" className={`${control} aria-pressed:bg-(--accent-primary-subtle) aria-pressed:text-(--accent-primary)`} aria-pressed={!props.unreadOnly} onClick={() => props.onFilter(false)}>Todas</button>
          <button type="button" className={`${control} aria-pressed:bg-(--accent-primary-subtle) aria-pressed:text-(--accent-primary)`} aria-pressed={props.unreadOnly} onClick={() => props.onFilter(true)}>Sin leer {unreadCount}</button>
        </div>
        {props.canManage && <ChannelForm onCommand={props.onCommand} />}
        {props.canSend && <DirectForm people={props.people} userId={props.userId} onCommand={props.onCommand} />}
        {(["channel", "direct"] as const).map((kind) => {
          const group = rows.filter((entry) => entry.kind === kind);
          if (!group.length) return null;
          return <section key={kind} className="mt-3">
            <h3 className={sectionLabel}>{kind === "channel" ? "Canales" : "Mensajes directos"}</h3>
            <ul className="mt-1 space-y-1">{group.map((entry) => {
              const name = conversationName(entry, people);
              return <li key={entry.id}>
                <button type="button" aria-current={entry.id === conversation?.id ? "true" : undefined}
                  className={`${control} w-full justify-start text-left ${entry.id === conversation?.id ? "bg-(--accent-primary-subtle)" : ""}`}
                  onClick={() => props.onSelect(entry.id)}>
                  {entry.kind === "direct" && <Avatar name={name} person={entry.peerId ? people.get(entry.peerId) : undefined} />}
                  <span className="min-w-0 grow wrap-anywhere">{name}</span>
                  {entry.unread && <span className="text-xs text-(--accent-primary)">Sin leer</span>}
                  {entry.archived && <span className="text-xs text-(--text-muted)">Archivado</span>}
                </button>
              </li>;
            })}</ul>
          </section>;
        })}
        {!rows.length && <p className="mt-3 text-sm text-(--text-secondary)">{props.unreadOnly ? "Ya estás al día." : "Aún no hay conversaciones."}</p>}
      </aside>
      {conversation ? <ConversationView key={conversation.id} conversation={conversation} people={people} props={{
        ...props, onSelect: (id) => { props.onSelect(id); if (!id) requestAnimationFrame(() => { window.scrollTo(0, 0); listHeading.current?.focus({ preventScroll: true }); }); },
      }} /> : <div className="hubly-glass hidden items-center justify-center rounded-2xl p-6 text-sm text-(--text-secondary) lg:flex">
        Elige una conversación para leer sus mensajes.
      </div>}
    </div>
  </div>;
}

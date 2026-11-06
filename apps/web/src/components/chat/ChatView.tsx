"use client";

import type { ChatCommand, ChatConversation, ChatMessage, ChatParticipant } from "@hubly/contracts";
import { Alert, Button, Icon, IconoHubly, Input, Label, ListBox, Select, TextArea, TextField, buttonLinkClass } from "@hubly/ui";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isMessageEndVisible } from "./sync";

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
  listLoading?: boolean;
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
  onVisible: (conversationId: string, number: number) => void;
  onCommand: (input: LocalCommand) => Promise<boolean>;
  onDraft: (value: string) => void;
  onSend: () => void;
}

// Los controles son Button de HeroUI (#165): cada variante trae su propio hover, sin clases que compitan entre sí.
const control = "min-h-11";
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
  const archiveButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const focusAfter = useRef<"confirm" | "archive" | null>(null);
  useEffect(() => {
    if (focusAfter.current === "confirm") confirmButton.current?.focus();
    if (focusAfter.current === "archive") archiveButton.current?.focus();
    focusAfter.current = null;
  }, [confirmArchive]);
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
      <TextField name="slug" isRequired maxLength={48} defaultValue={conversation?.slug ?? ""} className="block">
        <Label className="mb-1 block text-xs">Nombre del canal</Label>
        <Input placeholder="produccion" className="w-full" />
      </TextField>
      <p className="text-xs text-(--text-muted)">Usa letras sin acento, números y guiones.</p>
      <Button type="submit" variant="outline" size="sm" className={control} isDisabled={busy}>{conversation ? "Guardar nombre" : "Crear canal"}</Button>
      {conversation && !confirmArchive && <Button ref={archiveButton} variant="ghost" size="sm" className={control}
        onPress={() => { focusAfter.current = "confirm"; setConfirmArchive(true); }}>Archivar canal</Button>}
      {conversation && confirmArchive && <div className="flex flex-wrap gap-2">
        <Button ref={confirmButton} variant="danger-soft" size="sm" className={control} isDisabled={busy}
          onPress={() => void apply({ kind: "archiveChannel", conversationId: conversation.id })}>Confirmar archivo</Button>
        <Button variant="ghost" size="sm" className={control}
          onPress={() => { focusAfter.current = "archive"; setConfirmArchive(false); }}>Cancelar</Button>
      </div>}
    </form>
  </details>;
}

function DirectForm({ people, userId, onCommand }: Pick<ChatViewProps, "people" | "userId" | "onCommand">) {
  const details = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const eligible = people.filter((person) => person.id !== userId && person.role !== "viewer");
  const [selected, setSelected] = useState<string | null>(null);
  const recipientId = eligible.find((person) => person.id === selected)?.id;
  return <details ref={details} className="text-sm">
    <summary className="min-h-11 cursor-pointer rounded-xl px-2 py-3 font-semibold">Nuevo directo</summary>
    {eligible.length ? <form className="space-y-2 p-2" onSubmit={async (event) => {
      event.preventDefault();
      if (busy || !recipientId) return;
      setBusy(true);
      try {
        if (await onCommand({ kind: "openDirect", recipientId }) && details.current) details.current.open = false;
      } finally { setBusy(false); }
    }}>
      <Select selectedKey={recipientId ?? null} placeholder="Elige una persona"
        onSelectionChange={(key) => setSelected(typeof key === "string" ? key : null)} className="w-full">
        <Label className="mb-1 text-xs">Persona</Label>
        <Select.Trigger className="min-h-11 w-full">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {eligible.map((person) => {
              const name = personName(person.id, person);
              return <ListBox.Item key={person.id} id={person.id} textValue={name}>
                {name}<ListBox.ItemIndicator />
              </ListBox.Item>;
            })}
          </ListBox>
        </Select.Popover>
      </Select>
      <Button type="submit" variant="outline" size="sm" className={control} isDisabled={busy || !recipientId}>Abrir conversación</Button>
    </form> : <p className="p-2 text-(--text-muted)">No hay compañeros disponibles para un directo.</p>}
  </details>;
}

function MessageItem({ entry, name, person, canEdit, onCommand }: {
  entry: ChatMessage; name: string; person?: ChatParticipant | undefined; canEdit: boolean; onCommand: ChatViewProps["onCommand"];
}) {
  const [mode, setMode] = useState<"edit" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);
  const editInput = useRef<HTMLTextAreaElement>(null);
  const confirmRemove = useRef<HTMLButtonElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const item = useRef<HTMLLIElement>(null);
  const returnFocus = useRef(false);
  const removedHere = useRef(false);
  // Solo tras una retirada iniciada aquí: el mensaje ya no tiene «Editar» y el foco pasa al propio mensaje.
  useEffect(() => {
    if (entry.body === null && removedHere.current) {
      removedHere.current = false;
      if (document.activeElement === document.body) item.current?.focus({ preventScroll: true });
    }
  }, [entry.body]);
  // Al abrir una acción el foco entra en ella; al cerrarla vuelve a «Editar» para no perderse en <body>.
  useEffect(() => {
    if (mode === "edit") editInput.current?.focus();
    if (mode === "remove") confirmRemove.current?.focus();
    if (mode === null && returnFocus.current) editButton.current?.focus();
    returnFocus.current = mode !== null;
  }, [mode]);
  async function save(command: LocalCommand) {
    if (busy) return;
    setBusy(true);
    try { if (await onCommand(command)) setMode(null); }
    finally { setBusy(false); }
  }
  return <li ref={item} tabIndex={-1} className="flex gap-3 rounded-xl px-2 py-3 outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)">
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
        <TextArea ref={editInput} aria-label="Editar mensaje" name="body" fullWidth defaultValue={entry.body} required maxLength={4000}
          onKeyDown={(event) => { if (event.key === "Escape") setMode(null); }} />
        <Button type="submit" variant="primary" size="sm" className={control} isPending={busy}>Guardar</Button>
        <Button variant="ghost" size="sm" className={control} onPress={() => setMode(null)}>Cancelar</Button>
      </form> : <p className={`text-sm wrap-anywhere whitespace-pre-wrap ${entry.body === null ? "text-(--text-muted) italic" : ""}`}>
        {entry.body ?? "Mensaje eliminado"}
      </p>}
      {canEdit && entry.body !== null && mode === null && <div className="flex gap-1">
        <Button ref={editButton} variant="ghost" size="sm" className={control} onPress={() => setMode("edit")}><Icon name="lapiz" /> Editar</Button>
        <Button variant="ghost" size="sm" className={control} onPress={() => setMode("remove")}>Retirar</Button>
      </div>}
      {canEdit && entry.body !== null && mode === "remove" && <div className="flex flex-wrap gap-2">
        <Button ref={confirmRemove} variant="danger-soft" size="sm" className={control} isPending={busy}
          onPress={() => { removedHere.current = true; void save({ kind: "remove", conversationId: entry.conversationId, messageId: entry.id }); }}>Confirmar retiro</Button>
        <Button variant="ghost" size="sm" className={control} onPress={() => setMode(null)}>Cancelar</Button>
      </div>}
    </div>
  </li>;
}

function ConversationView({ props, conversation, people }: { props: ChatViewProps; conversation: ChatConversation; people: Map<string, ChatParticipant> }) {
  const scroll = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const pinned = useRef(true);
  const earlier = useRef<{ height: number; top: number } | null>(null);
  // Al archivar con éxito desaparece «Administrar canal»; el foco pasa al título para no caer en <body>.
  useEffect(() => {
    if (conversation.archived && document.activeElement === document.body) heading.current?.focus({ preventScroll: true });
  }, [conversation.archived]);
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
    // El contenedor deduplica por conversación y número, y vuelve a permitir el aviso si la marca de lectura falla.
    if (pinned.current && latest && end && !document.hidden &&
        isMessageEndVisible(end.bottom, element.getBoundingClientRect(), window.innerHeight)) {
      props.onVisible(conversation.id, latest.number);
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
        <Button variant="ghost" size="sm" className={`${control} lg:hidden`} onPress={() => props.onSelect(null)}>
          <span aria-hidden="true">←</span> Conversaciones
        </Button>
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
      {props.hasOlder && <Button variant="ghost" size="sm" className={control} isPending={props.loadingOlder} onPress={() => {
        if (scroll.current) earlier.current = { height: scroll.current.scrollHeight, top: scroll.current.scrollTop };
        props.onOlder();
      }}>{props.loadingOlder ? "Cargando mensajes…" : "Ver mensajes anteriores"}</Button>}
      {props.loading ? <p role="status" className="p-4 text-sm">Cargando conversación…</p>
        : props.messages.length ? <ol aria-label="Mensajes" className="divide-y divide-(--border-subtle)">
          {props.messages.map((entry) => <MessageItem key={entry.id} entry={entry}
            name={entry.authorId === props.userId ? "Tú" : personName(entry.authorId, people.get(entry.authorId))}
            person={people.get(entry.authorId)} canEdit={conversation.writable && entry.authorId === props.userId} onCommand={props.onCommand} />)}
        </ol> : <p className="p-4 text-sm text-(--text-secondary)">Todavía no hay mensajes.</p>}
    </div>
    {conversation.writable && !props.loading ? <form className="grid shrink-0 gap-2 border-t border-(--border-default) p-3 sm:grid-cols-[1fr_auto] sm:items-end"
      onSubmit={(event) => { event.preventDefault(); if (props.sending) return; composer.current?.focus(); props.onSend(); }}>
      <label className="min-w-0">
        <span className="mb-1 block text-sm font-semibold">Mensaje</span>
        {/* Mientras se envía el campo queda en solo lectura, no deshabilitado, para que el foco siga en el compositor. */}
        <TextArea ref={composer} fullWidth rows={2} value={props.draft} readOnly={props.sending} aria-busy={props.sending} maxLength={4000}
          onChange={(event) => props.onDraft(event.target.value)} placeholder="Escribe un mensaje…" />
      </label>
      <Button type="submit" variant="primary" className={control} isPending={props.sending} isDisabled={!props.sending && !props.draft.trim()}>
        {props.sending ? "Enviando…" : props.failedSend ? "Reintentar envío" : "Enviar"}
      </Button>
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
        <a className={buttonLinkClass("ghost", "sm", control)} href={props.download("json")} aria-label="Descargar mis mensajes en JSON"><Icon name="descargar" /> JSON</a>
        <a className={buttonLinkClass("ghost", "sm", control)} href={props.download("md")} aria-label="Descargar mis mensajes en Markdown"><Icon name="descargar" /> Markdown</a>
      </div>
    </header>
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
        {props.canSend && <DirectForm people={props.people} userId={props.userId} onCommand={props.onCommand} />}
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
                  {entry.kind === "direct" && <Avatar name={name} person={entry.peerId ? people.get(entry.peerId) : undefined} />}
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

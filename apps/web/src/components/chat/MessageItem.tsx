"use client";

import type { ChatMessage, ChatParticipant } from "@hubly/contracts";
import { Button, EmojiPicker, Icon, TextArea } from "@hubly/ui";
import React, { useEffect, useRef, useState } from "react";
import { ChatAvatar, personName, type ChatViewCommand } from "./MemberList";

const control = "min-h-11";
const hhmm = (iso: string) => new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(iso));

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"] as const;
export const LONG_PRESS_MS = 400;

export interface ChatReactionSummary { emoji: string; userIds: readonly string[] }
export interface ChatMessageView extends ChatMessage {
  replyToId?: string | null | undefined;
  threadRootId?: string | null | undefined;
  threadReplyCount?: number | undefined;
  threadLastReplyAt?: string | null | undefined;
  reactions?: readonly ChatReactionSummary[] | undefined;
}

export function formatMessageTime(sentAt: string, now?: Date): string {
  const timeStr = hhmm(sentAt);
  if (!now) return timeStr;
  const diffMs = now.getTime() - Date.parse(sentAt);
  if (diffMs >= 0 && diffMs < 60_000) return `Ahora · ${timeStr}`;
  const diffMin = Math.floor(diffMs / 60_000);
  return diffMin >= 1 && diffMin < 60 ? `hace ${diffMin} min · ${timeStr}` : timeStr;
}

export function applyOptimisticReaction(current: readonly ChatReactionSummary[], emoji: string, userId: string): ChatReactionSummary[] {
  const existing = current.find((item) => item.emoji === emoji);
  if (!existing) return [...current.map((item) => ({ emoji: item.emoji, userIds: [...item.userIds] })), { emoji, userIds: [userId] }];
  const hasUser = existing.userIds.includes(userId);
  return current.flatMap((item) => {
    if (item.emoji !== emoji) return [{ emoji: item.emoji, userIds: [...item.userIds] }];
    const nextUsers = hasUser ? item.userIds.filter((id) => id !== userId) : [...item.userIds, userId];
    return nextUsers.length > 0 ? [{ emoji: item.emoji, userIds: nextUsers }] : [];
  });
}

export async function executeOptimisticReaction(params: {
  current: readonly ChatReactionSummary[]; emoji: string; userId: string;
  applyState: (next: readonly ChatReactionSummary[], error: string | null) => void;
  persist: (emoji: string) => Promise<boolean | void> | boolean | void;
}): Promise<{ ok: boolean; reactions: readonly ChatReactionSummary[]; error: string | null }> {
  const snapshot = params.current.map((item) => ({ emoji: item.emoji, userIds: [...item.userIds] }));
  const optimistic = applyOptimisticReaction(snapshot, params.emoji, params.userId);
  params.applyState(optimistic, null);
  try {
    if ((await params.persist(params.emoji)) === false) throw new Error("rejected");
    return { ok: true, reactions: optimistic, error: null };
  } catch {
    const message = "No se pudo guardar la reacción.";
    params.applyState(snapshot, message);
    return { ok: false, reactions: snapshot, error: message };
  }
}

export function formatReactorNames(userIds: readonly string[], viewerId: string, people: Map<string, ChatParticipant>): string {
  const names = userIds.map((id) => (id === viewerId ? "Tú" : personName(id, people.get(id))));
  if (names.length <= 1) return names[0] ?? "";
  return names.length === 2 ? `${names[0]} y ${names[1]}` : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

export function createLongPressController(onTrigger: () => void, delayMs = LONG_PRESS_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    start() { if (timer !== null) clearTimeout(timer); timer = setTimeout(() => { timer = null; onTrigger(); }, delayMs); },
    cancel() { if (timer !== null) { clearTimeout(timer); timer = null; } },
  };
}

export function jumpToQuotedMessage(
  targetId: string, doc?: { getElementById: (id: string) => HTMLElement | null } | null, prefersReducedMotion = false,
): boolean {
  const rootDoc = doc ?? (typeof document !== "undefined" ? document : null);
  const element = rootDoc?.getElementById(`chat-msg-${targetId}`) ?? null;
  if (!element) return false;
  element.scrollIntoView?.({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
  element.focus?.({ preventScroll: true });
  return true;
}

export interface MessageItemProps {
  entry: ChatMessageView; name: string; person?: ChatParticipant | undefined;
  people?: Map<string, ChatParticipant> | undefined; viewerId?: string | undefined;
  isOwn?: boolean; writable?: boolean; canEdit: boolean; grouped?: boolean; isNew?: boolean;
  highlighted?: boolean; now?: Date | undefined; quotedMessage?: ChatMessageView | null | undefined;
  quotedAuthorName?: string | undefined; reactions?: readonly ChatReactionSummary[] | undefined;
  reactionError?: string | null | undefined; initialActionsOpen?: boolean; initialPickerOpen?: boolean;
  onCommand: (input: ChatViewCommand) => Promise<boolean>;
  onReply?: ((message: ChatMessageView) => void) | undefined;
  onOpenThread?: ((message: ChatMessageView) => void) | undefined;
  onJumpToMessage?: ((messageId: string) => void) | undefined;
  onToggleReaction?: ((messageId: string, emoji: string) => Promise<boolean | void> | boolean | void) | undefined;
}

export function MessageItem({
  entry, name, person, people, viewerId, isOwn = false, writable = true, canEdit,
  grouped = false, isNew = false, highlighted = false, now, quotedMessage, quotedAuthorName,
  reactions, reactionError, initialActionsOpen = false, initialPickerOpen = false,
  onCommand, onReply, onOpenThread, onJumpToMessage, onToggleReaction,
}: MessageItemProps) {
  const effectiveViewerId = viewerId ?? (isOwn ? entry.authorId : "");
  const peopleMap = people ?? new Map<string, ChatParticipant>();
  const [mode, setMode] = useState<"edit" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(initialActionsOpen);
  const [pickerOpen, setPickerOpen] = useState(initialPickerOpen);
  const [localReactions, setLocalReactions] = useState<readonly ChatReactionSummary[]>(reactions ?? entry.reactions ?? []);
  const [localError, setLocalError] = useState<{ emoji: string; message: string } | null>(
    reactionError ? { emoji: QUICK_REACTIONS[0], message: reactionError } : null,
  );
  const editInput = useRef<HTMLTextAreaElement>(null);
  const confirmRemove = useRef<HTMLButtonElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const item = useRef<HTMLLIElement>(null);
  const returnFocus = useRef(false);
  const removedHere = useRef(false);
  const longPress = useRef(createLongPressController(() => setActionsOpen(true)));

  useEffect(() => { setLocalReactions(reactions ?? entry.reactions ?? []); }, [reactions, entry.reactions]);
  useEffect(() => () => longPress.current.cancel(), []);
  useEffect(() => {
    if (entry.body === null && removedHere.current) {
      removedHere.current = false;
      if (document.activeElement === document.body) item.current?.focus({ preventScroll: true });
    }
  }, [entry.body]);
  useEffect(() => {
    if (mode === "edit") editInput.current?.focus();
    if (mode === "remove") confirmRemove.current?.focus();
    if (mode === null && returnFocus.current) editButton.current?.focus();
    returnFocus.current = mode !== null;
  }, [mode]);

  async function save(command: ChatViewCommand) {
    if (busy) return;
    setBusy(true);
    try { if (await onCommand(command)) setMode(null); }
    finally { setBusy(false); }
  }

  async function triggerReaction(emoji: string) {
    if (!writable || !effectiveViewerId) return;
    await executeOptimisticReaction({
      current: localReactions, emoji, userId: effectiveViewerId,
      applyState: (next, err) => { setLocalReactions(next); setLocalError(err ? { emoji, message: err } : null); },
      persist: (chosen) => (onToggleReaction ? onToggleReaction(entry.id, chosen) : true),
    });
  }

  const replyCount = entry.threadReplyCount ?? 0;
  const quotedAuthor = quotedAuthorName
    ?? (quotedMessage ? (quotedMessage.authorId === effectiveViewerId ? "Tú" : personName(quotedMessage.authorId, peopleMap.get(quotedMessage.authorId))) : "Mensaje original");
  const quotedBody = quotedMessage === undefined ? "Mensaje original" : quotedMessage === null || quotedMessage.body === null ? "Mensaje eliminado" : quotedMessage.body;
  const displayedError = localError?.message ?? reactionError ?? null;

  return <li ref={item} id={`chat-msg-${entry.id}`} data-message-id={entry.id} tabIndex={-1}
    data-grouped={grouped ? "true" : undefined} data-highlighted={highlighted ? "true" : undefined}
    onPointerDown={() => longPress.current.start()} onPointerUp={() => longPress.current.cancel()}
    onPointerCancel={() => longPress.current.cancel()} onPointerLeave={() => longPress.current.cancel()}
    onKeyDown={(event) => { if (event.key === "Escape" && (pickerOpen || actionsOpen)) { event.stopPropagation(); setPickerOpen(false); setActionsOpen(false); } }}
    className={`group flex gap-3 rounded-xl px-2 outline-none transition-colors duration-(--motion-fast) ease-(--motion-ease) focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) motion-reduce:transition-none ${grouped ? "py-1" : "py-2.5"} ${highlighted ? "bg-(--accent-primary-subtle) ring-1 ring-(--accent-primary)" : ""} ${isNew ? "hubly-chat-msg-enter" : ""}`}>
    {grouped ? <span className="flex w-8 shrink-0 items-baseline justify-center pt-0.5">
      <time dateTime={entry.sentAt} className="text-xs text-(--text-muted)" suppressHydrationWarning>{hhmm(entry.sentAt)}</time>
    </span> : <ChatAvatar person={person} fallbackName={isOwn ? "Tú" : undefined} />}
    <div className="min-w-0 grow">
      {!grouped && <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-semibold">{name}</span>
        <time dateTime={entry.sentAt} className="text-xs text-(--text-muted)" suppressHydrationWarning>{formatMessageTime(entry.sentAt, now)}</time>
        {entry.editedAt && entry.body !== null && <span className="text-xs text-(--text-muted)">Editado</span>}
      </div>}
      {grouped && entry.editedAt && entry.body !== null && <span className="text-xs text-(--text-muted)">Editado</span>}
      {entry.replyToId && <button type="button" onClick={() => onJumpToMessage?.(entry.replyToId!)} aria-label={`Ir al mensaje citado de ${quotedAuthor}`}
        className="my-1 flex max-w-full cursor-pointer items-center gap-2 rounded-lg border-l-2 border-(--accent-primary) bg-(--surface-sunken) px-2.5 py-1 text-left text-xs text-(--text-secondary) hover:bg-(--glass-hover) focus-visible:outline-2 focus-visible:outline-(--focus-ring-color)">
        <span className="shrink-0 font-semibold text-(--text-primary)">{quotedAuthor}</span>
        <span className="truncate">{quotedBody}</span>
      </button>}
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
      {localReactions.length > 0 && entry.body !== null && <div role="group" aria-label={`Reacciones del mensaje de ${name}`} className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {localReactions.map(({ emoji, userIds }) => {
          const reactedByMe = userIds.includes(effectiveViewerId);
          const who = formatReactorNames(userIds, effectiveViewerId, peopleMap);
          return <button key={emoji} type="button" disabled={!writable} aria-pressed={reactedByMe}
            aria-label={`${emoji} ${userIds.length}, reaccionaron: ${who}`} title={`${emoji} · ${who}`} onClick={() => void triggerReaction(emoji)}
            className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-(--motion-fast) ease-(--motion-ease) motion-reduce:transition-none ${reactedByMe ? "border-(--accent-primary) bg-(--accent-primary-subtle) text-(--accent-primary)" : "border-(--border-subtle) bg-(--surface-raised) text-(--text-secondary) hover:bg-(--glass-hover)"}`}>
            <span aria-hidden="true">{emoji}</span><span>{userIds.length}</span><span className="sr-only">Reaccionaron: {who}</span>
          </button>;
        })}
      </div>}
      {displayedError && <div role="alert" className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl bg-(--status-danger-bg) px-2.5 py-1 text-xs text-(--status-danger-text)">
        <span>{displayedError}</span>
        <Button size="sm" variant="ghost" className="min-h-8 text-xs" onPress={() => void triggerReaction(localError?.emoji ?? QUICK_REACTIONS[0])}>Reintentar reacción</Button>
      </div>}
      {replyCount > 0 && entry.body !== null && <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" className="min-h-8 text-xs" onPress={() => onOpenThread?.(entry)}>
          {`${replyCount} ${replyCount === 1 ? "respuesta" : "respuestas"} · Ver hilo`}
        </Button>
        {entry.threadLastReplyAt && <time dateTime={entry.threadLastReplyAt} className="text-xs text-(--text-muted)" suppressHydrationWarning>Última a las {hhmm(entry.threadLastReplyAt)}</time>}
      </div>}
      {entry.body !== null && mode === null && <div role="toolbar" aria-label={`Acciones del mensaje de ${name}`}
        data-actions-open={actionsOpen || pickerOpen ? "true" : undefined}
        className={`mt-1 flex flex-wrap items-center gap-1 transition-opacity duration-(--motion-fast) ease-(--motion-ease) motion-reduce:transition-none ${actionsOpen || pickerOpen ? "opacity-100" : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"}`}>
        {writable && QUICK_REACTIONS.map((emoji) => {
          const reacted = localReactions.some((r) => r.emoji === emoji && r.userIds.includes(effectiveViewerId));
          return <button key={emoji} type="button" aria-label={`Reaccionar con ${emoji}`} aria-pressed={reacted} onClick={() => void triggerReaction(emoji)}
            className="flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg border border-(--border-subtle) bg-(--surface-raised) px-1.5 text-sm hover:bg-(--glass-hover) focus-visible:outline-2 focus-visible:outline-(--focus-ring-color)">
            <span aria-hidden="true">{emoji}</span>
          </button>;
        })}
        {writable && <Button variant="ghost" size="sm" className={control} aria-label="Más emojis" aria-expanded={pickerOpen} onPress={() => setPickerOpen((prev) => !prev)}>Más emojis</Button>}
        {writable && <Button variant="ghost" size="sm" className={control} onPress={() => onReply?.(entry)}>Responder</Button>}
        <Button variant="ghost" size="sm" className={control} onPress={() => onOpenThread?.(entry)}>Abrir hilo</Button>
        {canEdit && <>
          <Button ref={editButton} variant="ghost" size="sm" className={control} onPress={() => setMode("edit")}><Icon name="lapiz" /> Editar</Button>
          <Button variant="ghost" size="sm" className={control} onPress={() => setMode("remove")}>Retirar</Button>
        </>}
      </div>}
      {pickerOpen && entry.body !== null && mode === null && <div className="mt-1">
        <EmojiPicker onSelect={(emoji) => { setPickerOpen(false); void triggerReaction(emoji); }} onClose={() => setPickerOpen(false)} />
      </div>}
      {canEdit && entry.body !== null && mode === "remove" && <div className="flex flex-wrap gap-2">
        <Button ref={confirmRemove} variant="danger-soft" size="sm" className={control} isPending={busy}
          onPress={() => { removedHere.current = true; void save({ kind: "remove", conversationId: entry.conversationId, messageId: entry.id }); }}>Confirmar retiro</Button>
        <Button variant="ghost" size="sm" className={control} onPress={() => setMode(null)}>Cancelar</Button>
      </div>}
    </div>
  </li>;
}

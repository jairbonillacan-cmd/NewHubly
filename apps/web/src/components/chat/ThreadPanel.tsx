"use client";

import type { ChatParticipant } from "@hubly/contracts";
import { Button, TextArea } from "@hubly/ui";
import React, { useEffect, useRef, useState } from "react";
import { ChatAvatar, personName } from "./MemberList";
import { ChatAttachmentList, type ChatAttachmentItem } from "./ChatAttachmentView";
import { formatMessageTime, type ChatMessageView } from "./MessageItem";

const control = "min-h-11";
export type ThreadMessageView = ChatMessageView & { attachments?: readonly ChatAttachmentItem[] | undefined };

export interface ThreadPanelProps {
  rootMessage: ThreadMessageView; replies: readonly ThreadMessageView[];
  people: Map<string, ChatParticipant>; userId: string; writable: boolean;
  now?: Date | undefined; initialDraft?: string; sending?: boolean;
  onClose: () => void;
  onSendReply?: ((rootMessageId: string, body: string) => Promise<boolean | void> | boolean | void) | undefined;
}

/** Debajo de `lg` (1024 px, el mismo corte que EspacioHoy) el hilo se muestra a pantalla completa. */
const LG_MIN_WIDTH = 1024;
const narrowQuery = () => `(max-width: ${LG_MIN_WIDTH - 1}px)`;
function useNarrowViewport(): boolean {
  // Se lee al montar (el hilo solo se abre en el cliente) para que el papel de diálogo exista desde el primer pintado.
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia(narrowQuery()).matches);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(narrowQuery());
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Mantiene el foco dentro de `container`: del último control vuelve al primero y al revés. */
export function trapTab(event: Pick<KeyboardEvent, "shiftKey" | "preventDefault">, container: HTMLElement): void {
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => !el.hasAttribute("inert") && (typeof el.getClientRects !== "function" || el.getClientRects().length > 0));
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) { event.preventDefault(); return; }
  // El foco puede estar en el título o en el propio panel (tabIndex -1), que no están en la lista: índice -1.
  const index = items.indexOf(container.ownerDocument.activeElement as HTMLElement);
  if (event.shiftKey && index <= 0) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (index === -1 || index === items.length - 1)) { event.preventDefault(); first.focus(); }
}

export function ThreadPanel({
  rootMessage, replies, people, userId, writable, now, initialDraft = "", sending = false, onClose, onSendReply,
}: ThreadPanelProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);

  const title = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const narrow = useNarrowViewport();

  // Al abrir, el foco entra al hilo; al cerrar, vuelve al control que lo abrió («Abrir hilo» o «Ver hilo»).
  useEffect(() => {
    const opener = typeof document === "undefined" ? null : document.activeElement;
    title.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    // Escape cierra el hilo salvo que otro control ya lo haya usado (p. ej. la lista de @menciones).
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const rootAuthor = rootMessage.authorId === userId ? "Tú" : personName(rootMessage.authorId, people.get(rootMessage.authorId));
  const rootPerson = people.get(rootMessage.authorId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || sending || !writable) return;
    setBusy(true);
    try { if ((onSendReply ? await onSendReply(rootMessage.id, text) : true) !== false) setDraft(""); }
    finally { setBusy(false); }
  }

  // En pantallas estrechas el hilo cubre la vista: es una capa modal que respeta zonas seguras y el teclado (#186).
  return <aside ref={panel} role={narrow ? "dialog" : "region"} aria-modal={narrow ? true : undefined} aria-labelledby="chat-thread-title" tabIndex={-1}
    onKeyDown={(event) => {
      if (event.key === "Escape" && !event.defaultPrevented) { event.stopPropagation(); onClose(); return; }
      // Como capa modal en pantallas estrechas, Tab y Mayús+Tab no salen del hilo.
      if (event.key === "Tab" && narrow && panel.current) trapTab(event, panel.current);
    }}
    className="hubly-glass hubly-pop hubly-hilo fixed inset-x-0 top-0 z-40 flex min-h-0 w-full flex-col overflow-hidden lg:static lg:rounded-2xl lg:z-auto lg:w-96 lg:shrink-0">
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-(--border-subtle) px-3 py-2.5">
      <div>
        <h3 ref={title} id="chat-thread-title" tabIndex={-1} className="text-base font-semibold outline-none">Hilo</h3>
        <p className="text-xs text-(--text-secondary)">{`${replies.length} ${replies.length === 1 ? "respuesta" : "respuestas"}`}</p>
      </div>
      <Button size="sm" variant="ghost" className={control} onPress={onClose}>Cerrar hilo</Button>
    </div>
    <div className="min-h-0 grow space-y-3 overflow-y-auto p-3">
      <article aria-label="Mensaje principal del hilo" className="flex gap-2.5 rounded-xl border border-(--border-subtle) bg-(--surface-sunken) p-3">
        <ChatAvatar person={rootPerson} fallbackName={rootMessage.authorId === userId ? "Tú" : undefined} />
        <div className="min-w-0 grow">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{rootAuthor}</span>
            <time dateTime={rootMessage.sentAt} className="text-xs text-(--text-muted)" suppressHydrationWarning>{formatMessageTime(rootMessage.sentAt, now)}</time>
          </div>
          <p className={`mt-1 text-sm wrap-anywhere whitespace-pre-wrap ${rootMessage.body === null ? "text-(--text-muted) italic" : ""}`}>{rootMessage.body ?? "Mensaje eliminado"}</p>
          {rootMessage.body !== null && <ChatAttachmentList attachments={rootMessage.attachments} />}
        </div>
      </article>
      {replies.length > 0 ? <ol aria-label="Respuestas del hilo" className="space-y-2">
        {replies.map((reply) => {
          const isOwn = reply.authorId === userId;
          const author = isOwn ? "Tú" : personName(reply.authorId, people.get(reply.authorId));
          return <li key={reply.id} className="hubly-chat-msg-enter flex gap-2.5 rounded-xl bg-(--surface-raised) p-2.5">
            <ChatAvatar person={people.get(reply.authorId)} fallbackName={isOwn ? "Tú" : undefined} />
            <div className="min-w-0 grow">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold">{author}</span>
                <time dateTime={reply.sentAt} className="text-xs text-(--text-muted)" suppressHydrationWarning>{formatMessageTime(reply.sentAt, now)}</time>
              </div>
              <p className={`mt-0.5 text-sm wrap-anywhere whitespace-pre-wrap ${reply.body === null ? "text-(--text-muted) italic" : ""}`}>{reply.body ?? "Mensaje eliminado"}</p>
              {reply.body !== null && <ChatAttachmentList attachments={reply.attachments} />}
            </div>
          </li>;
        })}
      </ol> : <p className="py-2 text-xs text-(--text-secondary)">Todavía no hay respuestas en este hilo.</p>}
    </div>
    {writable && rootMessage.body !== null && <form onSubmit={(event) => void handleSubmit(event)} className="shrink-0 space-y-2 border-t border-(--border-subtle) p-3">
      <TextArea aria-label="Responder en el hilo" placeholder="Responder en el hilo…" value={draft}
        onChange={(event) => setDraft(event.target.value)} rows={2} maxLength={4000} fullWidth />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" className={control} isPending={busy || sending} isDisabled={!draft.trim() || busy || sending}>Enviar al hilo</Button>
      </div>
    </form>}
  </aside>;
}

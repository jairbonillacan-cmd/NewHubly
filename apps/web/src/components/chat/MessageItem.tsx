"use client";

import type { ChatMessage, ChatParticipant } from "@hubly/contracts";
import { Button, Icon, TextArea } from "@hubly/ui";
import React, { useEffect, useRef, useState } from "react";
import { ChatAvatar, type ChatViewCommand } from "./MemberList";

const control = "min-h-11";
const hhmm = (iso: string) => new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(iso));

export function formatMessageTime(sentAt: string, now?: Date): string {
  const timeStr = hhmm(sentAt);
  if (!now) return timeStr;
  const diffMs = now.getTime() - Date.parse(sentAt);
  if (diffMs >= 0 && diffMs < 60_000) return `Ahora · ${timeStr}`;
  const diffMin = Math.floor(diffMs / 60_000);
  return diffMin >= 1 && diffMin < 60 ? `hace ${diffMin} min · ${timeStr}` : timeStr;
}

export interface MessageItemProps {
  entry: ChatMessage;
  name: string;
  person?: ChatParticipant | undefined;
  isOwn?: boolean;
  canEdit: boolean;
  grouped?: boolean;
  isNew?: boolean;
  now?: Date | undefined;
  onCommand: (input: ChatViewCommand) => Promise<boolean>;
}

export function MessageItem({ entry, name, person, isOwn = false, canEdit, grouped = false, isNew = false, now, onCommand }: MessageItemProps) {
  const [mode, setMode] = useState<"edit" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);
  const editInput = useRef<HTMLTextAreaElement>(null);
  const confirmRemove = useRef<HTMLButtonElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const item = useRef<HTMLLIElement>(null);
  const returnFocus = useRef(false);
  const removedHere = useRef(false);

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

  return <li ref={item} tabIndex={-1} data-grouped={grouped ? "true" : undefined}
    className={`flex gap-3 rounded-xl px-2 outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) ${grouped ? "py-1" : "py-2.5"} ${isNew ? "hubly-chat-msg-enter" : ""}`}>
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

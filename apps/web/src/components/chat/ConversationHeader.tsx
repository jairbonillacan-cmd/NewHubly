"use client";

import type { ChatConversation, ChatParticipant } from "@hubly/contracts";
import { Button, Input, Label, PresenceDot, TextField } from "@hubly/ui";
import React, { useEffect, useRef, useState } from "react";
import { conversationName, statusLabel, type ChatViewCommand } from "./MemberList";

const control = "min-h-11";
export type BrowserNotificationPermission = NotificationPermission | "unsupported";

export function readBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") return "unsupported";
  return window.Notification.permission;
}

export function ChannelForm({ conversation, onCommand }: {
  conversation?: ChatConversation; onCommand: (input: ChatViewCommand) => Promise<boolean>;
}) {
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
  async function apply(command: ChatViewCommand, form?: HTMLFormElement) {
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

export function ConversationHeader({
  conversation, people, canManage, headingRef, notificationPermission,
  onRequestNotificationPermission, onSelect, onCommand,
}: {
  conversation: ChatConversation; people: Map<string, ChatParticipant>; canManage: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  notificationPermission?: BrowserNotificationPermission | undefined;
  onRequestNotificationPermission?: (() => Promise<BrowserNotificationPermission | void> | BrowserNotificationPermission | void) | undefined;
  onSelect: (id: string | null) => void;
  onCommand: (input: ChatViewCommand) => Promise<boolean>;
}) {
  const peer = conversation.kind === "direct" && conversation.peerId ? people.get(conversation.peerId) : undefined;
  const totalMembers = people.size;
  const onlineCount = [...people.values()].filter((p) => p.status === "online").length;
  const [permission, setPermission] = useState<BrowserNotificationPermission>(
    () => notificationPermission ?? readBrowserNotificationPermission(),
  );

  useEffect(() => {
    if (notificationPermission !== undefined) setPermission(notificationPermission);
  }, [notificationPermission]);

  async function requestNotifications() {
    if (onRequestNotificationPermission) {
      const next = await onRequestNotificationPermission();
      if (next) setPermission(next);
      return;
    }
    if (typeof window !== "undefined" && typeof window.Notification?.requestPermission === "function") {
      const next = await window.Notification.requestPermission();
      setPermission(next);
    }
  }

  return <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-(--border-default) px-3 py-2.5">
    <div className="min-w-0">
      <Button variant="ghost" size="sm" className={`${control} lg:hidden`} onPress={() => onSelect(null)}>
        <span aria-hidden="true">←</span> Conversaciones
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <h2 ref={headingRef} id="chat-conversation" tabIndex={-1} className="text-base font-semibold wrap-anywhere">
          {conversationName(conversation, people)}
        </h2>
        {conversation.kind === "direct" && peer?.status && <span className="inline-flex items-center gap-1.5 text-xs text-(--text-secondary)">
          <PresenceDot status={peer.status} className="size-2.5 border-0" />
          <span>{statusLabel[peer.status]}</span>
        </span>}
      </div>
      <p className="flex flex-wrap items-center gap-2 text-xs text-(--text-secondary)">
        <span>{conversation.archived ? "Canal archivado" : conversation.kind === "channel" ? "Canal de la agencia" : "Conversación privada"}</span>
        {conversation.kind === "channel" && totalMembers > 0 && <span>· {totalMembers} {totalMembers === 1 ? "miembro" : "miembros"}</span>}
        {conversation.kind === "channel" && onlineCount > 0 && <span className="inline-flex items-center gap-1">
          <PresenceDot status="online" className="size-2 border-0" />
          <span>{onlineCount} en línea</span>
        </span>}
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {permission === "default" && (
        <Button variant="outline" size="sm" className={control} onPress={() => void requestNotifications()}>
          Activar avisos del navegador
        </Button>
      )}
      {permission === "granted" && (
        <span role="status" className="text-xs text-(--text-muted)">Avisos del navegador activos</span>
      )}
      {permission === "denied" && (
        <span role="status" className="text-xs text-(--text-muted)">Avisos del navegador bloqueados</span>
      )}
      {canManage && conversation.kind === "channel" && conversation.slug !== "general" && !conversation.archived &&
        <ChannelForm key={conversation.id} conversation={conversation} onCommand={onCommand} />}
    </div>
  </header>;
}

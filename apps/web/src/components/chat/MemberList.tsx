"use client";

import type { ChatCommand, ChatConversation, ChatParticipant } from "@hubly/contracts";
import { Alert, Button, Label, ListBox, PresenceDot, Select } from "@hubly/ui";
import React, { useRef, useState } from "react";

export type ChatViewCommand = ChatCommand extends infer C ? C extends ChatCommand ? Omit<C, "workspaceId"> : never : never;

const control = "min-h-11";
export const statusLabel = { online: "En línea", away: "Ausente", dnd: "No molestar" } as const;

export const hasConfiguredName = (person?: ChatParticipant): boolean => Boolean(person?.name?.trim());
export const personName = (_id: string, person?: ChatParticipant): string => person?.name?.trim() || "Compañero sin nombre";

export function avatarInitial(person?: ChatParticipant, fallbackName?: string): string {
  const trimmed = person?.name?.trim();
  if (trimmed) return trimmed.split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0] ?? "").join("").toUpperCase();
  return fallbackName === "Tú" ? "T" : "?";
}

export function conversationName(conversation: ChatConversation, people: Map<string, ChatParticipant>): string {
  return conversation.kind === "channel" ? `#${conversation.slug}`
    : conversation.peerId ? personName(conversation.peerId, people.get(conversation.peerId)) : "Mensaje directo";
}

export function ChatAvatar({ person, fallbackName }: { person?: ChatParticipant | undefined; fallbackName?: string | undefined }) {
  const initial = avatarInitial(person, fallbackName);
  const unnamed = !hasConfiguredName(person) && fallbackName !== "Tú";
  return <span className="relative grid size-8 shrink-0 place-items-center rounded-xl bg-(--accent-primary-subtle) text-xs font-semibold text-(--accent-primary)">
    <span aria-hidden="true">{initial}</span>
    {unnamed && <span className="sr-only">Sin nombre</span>}
    {person?.status && <span className="absolute -right-0.5 -bottom-0.5" title={statusLabel[person.status]}>
      <PresenceDot status={person.status} className="size-3" />
      <span className="sr-only">{statusLabel[person.status]}</span>
    </span>}
  </span>;
}

export function MissingNameBanner({ userId, people }: { userId: string; people: Map<string, ChatParticipant> }) {
  const viewer = people.get(userId);
  if (!viewer || hasConfiguredName(viewer)) return null;
  return <div role="status" className="hubly-glass flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-(--border-default) px-3 py-2 text-xs text-(--text-secondary)">
    <span>Aún no tienes un nombre configurado. Abre «Editar perfil» en el menú de tu cuenta para que tu equipo te identifique en el chat.</span>
  </div>;
}

export function DirectoryErrorBanner({ error, onRetry }: { error: string | null | undefined; onRetry?: (() => void) | undefined }) {
  if (!error) return null;
  return <Alert status="warning" role="alert" className="bg-(--status-warning-bg) text-(--status-warning-text)">
    <Alert.Indicator />
    <Alert.Content className="w-full sm:flex-row">
      <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:flex-row">
        <Alert.Title className="text-(--status-warning-text)">{error}</Alert.Title>
        {onRetry && <Button size="sm" variant="ghost" className={control} onPress={onRetry}>Reintentar directorio</Button>}
      </div>
    </Alert.Content>
  </Alert>;
}

export function MemberList({ people, userId, canSend, onCommand }: {
  people: ChatParticipant[]; userId: string; canSend: boolean; onCommand: (input: ChatViewCommand) => Promise<boolean>;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const eligible = people.filter((person) => person.id !== userId && person.role !== "viewer");
  const [selected, setSelected] = useState<string | null>(null);
  const recipientId = eligible.find((person) => person.id === selected)?.id;
  if (!canSend) return null;

  return <details ref={details} className="text-sm">
    <summary className="min-h-11 cursor-pointer rounded-xl px-2 py-3 font-semibold">Nuevo directo</summary>
    {eligible.length ? <form className="space-y-2 p-2" onSubmit={async (event) => {
      event.preventDefault();
      if (busy || !recipientId) return;
      setBusy(true);
      try { if (await onCommand({ kind: "openDirect", recipientId }) && details.current) details.current.open = false; }
      finally { setBusy(false); }
    }}>
      <Select selectedKey={recipientId ?? null} placeholder="Elige una persona"
        onSelectionChange={(key) => setSelected(typeof key === "string" ? key : null)} className="w-full">
        <Label className="mb-1 text-xs">Persona</Label>
        <Select.Trigger className="min-h-11 w-full"><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover className="hubly-pop-surface hubly-popover-scroll rounded-xl p-1 text-(--text-primary)">
          <ListBox>
            {eligible.map((person) => {
              const name = personName(person.id, person);
              return <ListBox.Item key={person.id} id={person.id} textValue={name}>{name}<ListBox.ItemIndicator /></ListBox.Item>;
            })}
          </ListBox>
        </Select.Popover>
      </Select>
      <Button type="submit" variant="outline" size="sm" className={control} isDisabled={busy || !recipientId}>Abrir conversación</Button>
    </form> : <p className="p-2 text-(--text-muted)">No hay compañeros disponibles para un directo.</p>}
  </details>;
}

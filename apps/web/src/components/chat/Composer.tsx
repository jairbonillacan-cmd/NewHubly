"use client";

import type { ChatParticipant } from "@hubly/contracts";
import { Button, EmojiPicker, TextArea } from "@hubly/ui";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatAttachmentBytes, type ChatAttachmentItem } from "./ChatAttachmentView";
import { ChatAvatar, personName, statusLabel } from "./MemberList";

const control = "min-h-11";
export const MAX_CHAT_ATTACHMENTS = 5;
export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const TYPING_COOLDOWN_MS = 3000;
export const ALLOWED_CHAT_ATTACHMENT_MIMES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
] as const;

export interface ComposerAttachmentDraft {
  id: string;
  file: File;
  fileName: string;
  mimeType: string;
  byteSize: number;
  previewUrl?: string | null | undefined;
}

/** Libera la memoria de una vista previa creada con URL.createObjectURL. */
export function revokePreviewUrl(url: string | null | undefined): void {
  if (url?.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
}
const revokeAttachmentPreview = (item: ComposerAttachmentDraft) => revokePreviewUrl(item.previewUrl);

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function detectMentionQuery(text: string, caretIndex = text.length): { query: string; start: number; end: number } | null {
  const slice = text.slice(0, caretIndex);
  const match = /(?:^|\s)@([^\s@]*)$/.exec(slice);
  if (!match) return null;
  const query = match[1] ?? "";
  return { query, start: slice.length - query.length - 1, end: caretIndex };
}

export function filterMentionCandidates(
  members: readonly ChatParticipant[], query: string, excludeUserId?: string,
): ChatParticipant[] {
  const q = normalize(query);
  return members.filter((person) => {
    if (excludeUserId && person.id === excludeUserId) return false;
    return !q || normalize(personName(person.id, person)).includes(q);
  });
}

export function applyMentionSelection(
  text: string, match: { start: number; end: number }, person: ChatParticipant,
): { nextDraft: string; insertedName: string } {
  const insertedName = personName(person.id, person);
  const nextDraft = `${text.slice(0, match.start)}@${insertedName} ${text.slice(match.end)}`;
  return { nextDraft, insertedName };
}

export function validateAndAddAttachments(
  current: readonly ComposerAttachmentDraft[], incoming: readonly File[],
): { attachments: ComposerAttachmentDraft[]; error: string | null } {
  if (!incoming.length) return { attachments: [...current], error: null };
  if (current.length + incoming.length > MAX_CHAT_ATTACHMENTS) {
    return { attachments: [...current], error: "Solo puedes adjuntar hasta 5 archivos por mensaje." };
  }
  const added: ComposerAttachmentDraft[] = [];
  for (const file of incoming) {
    if (!(ALLOWED_CHAT_ATTACHMENT_MIMES as readonly string[]).includes(file.type)) {
      return { attachments: [...current], error: "Formato no permitido. Usa imágenes JPEG, PNG, WebP, GIF o documentos PDF." };
    }
    if (file.size <= 0) {
      return { attachments: [...current], error: "El archivo seleccionado está vacío." };
    }
    if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
      return { attachments: [...current], error: "Cada archivo adjunto puede pesar como máximo 10 MB." };
    }
    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage && typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file) : null;
    added.push({
      id: `${file.name}-${file.size}-${current.length + added.length}`,
      file, fileName: file.name, mimeType: file.type, byteSize: file.size, previewUrl,
    });
  }
  return { attachments: [...current, ...added], error: null };
}

export function formatTypingIndicator(
  typingUserIds: readonly string[], people: Map<string, ChatParticipant>,
  viewerId?: string, explicitNames?: readonly string[],
): string | null {
  const names = explicitNames?.length
    ? explicitNames.filter(Boolean)
    : typingUserIds.filter((id) => id !== viewerId).map((id) => personName(id, people.get(id)));
  if (!names.length) return null;
  if (names.length === 1) return `${names[0]} está escribiendo…`;
  if (names.length === 2) return `${names[0]} y ${names[1]} están escribiendo…`;
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)} están escribiendo…`;
}

export async function uploadComposerAttachments(options: {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  attachments: readonly ComposerAttachmentDraft[];
  fetchImpl?: typeof fetch | undefined;
  onProgress?: ((percent: number) => void) | undefined;
}): Promise<ChatAttachmentItem[]> {
  const { workspaceId, conversationId, messageId, attachments, fetchImpl = fetch, onProgress } = options;
  if (!attachments.length) return [];
  onProgress?.(0);
  const reserveRes = await fetchImpl("/api/chat/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "reserve",
      workspaceId,
      conversationId,
      messageId,
      files: attachments.map((a) => ({ fileName: a.fileName, mimeType: a.mimeType, byteSize: a.byteSize })),
    }),
  });
  const reserveJson = (await reserveRes.json().catch(() => null)) as {
    reservations?: Array<{ id: string; signedUrl: string }>;
    error?: string;
  } | null;
  if (!reserveRes.ok || !reserveJson?.reservations || reserveJson.reservations.length !== attachments.length) {
    throw new Error(reserveJson?.error ?? "No se pudo reservar la subida de archivos adjuntos.");
  }
  for (const [idx, reservation] of reserveJson.reservations.entries()) {
    const draft = attachments[idx]!;
    const putRes = await fetchImpl(reservation.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": draft.mimeType },
      body: draft.file,
    });
    if (!putRes.ok) throw new Error(`No se pudo subir el archivo ${draft.fileName}.`);
    onProgress?.(Math.round(((idx + 1) / (attachments.length + 1)) * 100));
  }
  const commitRes = await fetchImpl("/api/chat/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "commit",
      workspaceId,
      conversationId,
      messageId,
      reservationIds: reserveJson.reservations.map((r) => r.id),
    }),
  });
  const commitJson = (await commitRes.json().catch(() => null)) as {
    attachments?: ChatAttachmentItem[];
    error?: string;
  } | null;
  if (!commitRes.ok || !commitJson?.attachments) {
    throw new Error(commitJson?.error ?? "No se pudo registrar los archivos adjuntos.");
  }
  onProgress?.(100);
  return commitJson.attachments;
}

export interface ComposerProps {
  writable: boolean;
  loading: boolean;
  draft: string;
  sending: boolean;
  failedSend: boolean;
  onDraft: (value: string) => void;
  onSend: () => void;
  userId?: string | undefined;
  members?: readonly ChatParticipant[] | undefined;
  mentionedUserIds?: readonly string[] | undefined;
  onMentionsChange?: ((userIds: string[]) => void) | undefined;
  attachments?: readonly ComposerAttachmentDraft[] | undefined;
  onAttachmentsChange?: ((files: ComposerAttachmentDraft[]) => void) | undefined;
  uploadProgress?: number | null | undefined;
  attachmentError?: string | null | undefined;
  typingUserIds?: readonly string[] | undefined;
  typingNames?: readonly string[] | undefined;
  onTyping?: (() => void) | undefined;
  onSubmitWithExtras?: ((payload: {
    body: string;
    mentionedUserIds: string[];
    attachments: ComposerAttachmentDraft[];
  }) => void) | undefined;
  /** Sin la vista de adjuntos en los mensajes no se ofrece adjuntar (Constitución: nada se simula). */
  attachmentsEnabled?: boolean | undefined;
}

export function Composer({
  writable, loading, draft, sending, failedSend, onDraft, onSend,
  userId, members = [], mentionedUserIds, onMentionsChange,
  attachments, onAttachmentsChange, uploadProgress, attachmentError,
  typingUserIds = [], typingNames, onTyping, onSubmitWithExtras, attachmentsEnabled = true,
}: ComposerProps) {
  const composer = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastTypingAt = useRef(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [dismissedMentionAt, setDismissedMentionAt] = useState<string | null>(null);
  const [localMentions, setLocalMentions] = useState<string[]>([]);
  const [localAttachments, setLocalAttachments] = useState<ComposerAttachmentDraft[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const activeMentions = mentionedUserIds ?? localMentions;
  const activeAttachments = attachments ?? localAttachments;
  const peopleMap = useMemo(() => new Map(members.map((p) => [p.id, p])), [members]);
  const typingText = useMemo(
    () => formatTypingIndicator(typingUserIds, peopleMap, userId, typingNames),
    [typingUserIds, peopleMap, userId, typingNames],
  );
  const mentionMatch = useMemo(() => detectMentionQuery(draft), [draft]);
  const candidates = useMemo(
    () => (mentionMatch ? filterMentionCandidates(members, mentionMatch.query, userId) : []),
    [mentionMatch, members, userId],
  );
  const mentionKey = mentionMatch ? `${mentionMatch.start}:${mentionMatch.query}` : null;
  const mentionOpen = Boolean(mentionMatch && candidates.length > 0 && dismissedMentionAt !== mentionKey);
  const safeMentionIndex = candidates.length ? Math.min(mentionIndex, candidates.length - 1) : 0;
  const activeCandidate = mentionOpen ? candidates[safeMentionIndex] : undefined;
  const displayedError = localError ?? attachmentError ?? null;

  // Si el padre controla los adjuntos y los limpia tras enviar, revoca las vistas previas que ya no se muestran.
  const shownPreviews = useRef<Set<string>>(new Set());
  useEffect(() => {
    const current = new Set(activeAttachments.map((item) => item.previewUrl).filter((url): url is string => Boolean(url?.startsWith("blob:"))));
    for (const url of shownPreviews.current) if (!current.has(url)) revokePreviewUrl(url);
    shownPreviews.current = current;
  }, [activeAttachments]);

  if (loading) return null;
  if (!writable) return <p className="border-t border-(--border-default) p-3 text-sm text-(--text-secondary)">Conversación de solo lectura.</p>;

  function selectMention(person: ChatParticipant) {
    if (!mentionMatch) return;
    const { nextDraft } = applyMentionSelection(draft, mentionMatch, person);
    const nextIds = activeMentions.includes(person.id) ? [...activeMentions] : [...activeMentions, person.id];
    setLocalMentions(nextIds);
    onMentionsChange?.(nextIds);
    setDismissedMentionAt(null);
    setMentionIndex(0);
    onDraft(nextDraft);
    composer.current?.focus();
  }

  function handleFiles(incoming: readonly File[]) {
    const result = validateAndAddAttachments(activeAttachments, incoming);
    setLocalError(result.error);
    if (!result.error) {
      setLocalAttachments(result.attachments);
      onAttachmentsChange?.(result.attachments);
    }
  }

  function removeAttachment(id: string) {
    const removed = activeAttachments.find((item) => item.id === id);
    if (removed) revokeAttachmentPreview(removed);
    const next = activeAttachments.filter((item) => item.id !== id);
    setLocalAttachments(next);
    setLocalError(null);
    onAttachmentsChange?.(next);
  }

  function handleDraftChange(nextValue: string) {
    onDraft(nextValue);
    setDismissedMentionAt(null);
    setMentionIndex(0);
    if (onTyping && nextValue.trim()) {
      const now = Date.now();
      if (now - lastTypingAt.current >= TYPING_COOLDOWN_MS) {
        lastTypingAt.current = now;
        onTyping();
      }
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionOpen) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMentionIndex((prev) => (prev + 1) % candidates.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setMentionIndex((prev) => (prev - 1 + candidates.length) % candidates.length);
    } else if ((event.key === "Enter" || event.key === "Tab") && activeCandidate) {
      event.preventDefault();
      selectMention(activeCandidate);
    } else if (event.key === "Escape" && mentionKey) {
      event.preventDefault();
      setDismissedMentionAt(mentionKey);
    }
  }

  return <div data-dragging={dragging ? "true" : undefined}
    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
    onDragLeave={() => setDragging(false)}
    onDrop={(event) => {
      event.preventDefault();
      setDragging(false);
      handleFiles(Array.from(event.dataTransfer?.files ?? []));
    }}
    className={`relative shrink-0 border-t border-(--border-default) p-3 ${dragging ? "bg-(--accent-primary-subtle)" : ""}`}>
    {typingText && <div role="status" aria-live="polite" className="mb-1.5 flex items-center gap-2 text-xs text-(--text-secondary)">
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="hubly-typing-dot" />
        <span className="hubly-typing-dot" />
        <span className="hubly-typing-dot" />
      </span>
      <span>{typingText}</span>
    </div>}
    {mentionOpen && <ul id="chat-mention-listbox" role="listbox" aria-label="Mencionar a un compañero"
      className="hubly-pop-surface absolute bottom-full left-3 z-20 mb-2 max-h-52 w-72 overflow-y-auto rounded-2xl p-1.5">
      {candidates.map((person, idx) => {
        const selected = idx === safeMentionIndex;
        const name = personName(person.id, person);
        // Sin <button> dentro: role="option" ya es interactivo y el foco lo lleva el campo con aria-activedescendant.
        // onMouseDown evita que el campo pierda el foco antes del clic; el teclado se maneja en handleKeyDown.
        return <li key={person.id} id={`chat-mention-opt-${person.id}`} role="option" aria-selected={selected}
          onMouseDown={(event) => event.preventDefault()} onClick={() => selectMention(person)}
          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm ${selected ? "bg-(--accent-primary-subtle) text-(--text-primary)" : "hover:bg-(--glass-hover)"}`}>
          <ChatAvatar person={person} />
          <span className="min-w-0 grow truncate font-medium">{name}</span>
          {person.status && <span className="shrink-0 text-xs text-(--text-secondary)">{statusLabel[person.status]}</span>}
        </li>;
      })}
    </ul>}
    {emojiOpen && <div className="absolute bottom-full left-3 z-20 mb-2">
      <EmojiPicker
        onSelect={(emoji) => { onDraft(`${draft}${emoji}`); setEmojiOpen(false); composer.current?.focus(); }}
        onClose={() => { setEmojiOpen(false); composer.current?.focus(); }} />
    </div>}
    {activeAttachments.length > 0 && <ul aria-label="Archivos adjuntos pendientes" className="mb-2 flex flex-wrap gap-2">
      {activeAttachments.map((item) => (
        <li key={item.id} className="flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-(--surface-sunken) px-2.5 py-1.5 text-xs">
          {item.mimeType.startsWith("image/") ? (
            <img src={item.previewUrl ?? ""} alt={`Vista previa de ${item.fileName}`} width={40} height={40}
              className="size-10 shrink-0 rounded-lg bg-(--surface-canvas) object-cover" />
          ) : (
            <span className="shrink-0 rounded-md bg-(--accent-primary-subtle) px-1.5 py-0.5 font-semibold text-(--accent-primary)">PDF</span>
          )}
          <div className="min-w-0">
            <p className="max-w-36 truncate font-medium text-(--text-primary)">{item.fileName}</p>
            <p className="text-(--text-muted)">{formatAttachmentBytes(item.byteSize)}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" aria-label={`Quitar adjunto ${item.fileName}`}
            className="min-h-8 px-2 text-xs" onPress={() => removeAttachment(item.id)}>Quitar</Button>
        </li>
      ))}
    </ul>}
    {uploadProgress !== null && uploadProgress !== undefined && (
      <div role="progressbar" aria-label="Subiendo archivos adjuntos" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.max(0, Math.min(100, Math.round(uploadProgress)))}
        className="mb-2 rounded-xl border border-(--border-subtle) bg-(--surface-sunken) px-3 py-1.5 text-xs text-(--text-secondary)">
        <span>{`Subiendo adjuntos… ${Math.max(0, Math.min(100, Math.round(uploadProgress)))}%`}</span>
      </div>
    )}
    {displayedError && <p role="alert" className="mb-2 rounded-xl bg-(--status-danger-bg) px-3 py-1.5 text-xs text-(--status-danger-text)">
      {displayedError}
    </p>}
    <form className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (sending) return;
        setEmojiOpen(false);
        composer.current?.focus();
        onSubmitWithExtras?.({ body: draft, mentionedUserIds: [...activeMentions], attachments: [...activeAttachments] });
        onSend();
        if (attachments === undefined) {
          activeAttachments.forEach(revokeAttachmentPreview);
          setLocalAttachments([]);
        }
        if (mentionedUserIds === undefined) setLocalMentions([]);
      }}>
      <label className="min-w-0">
        <span className="mb-1 block text-sm font-semibold">Mensaje</span>
        {/* Mientras se envía el campo queda en solo lectura, no deshabilitado, para que el foco siga en el compositor. */}
        <TextArea ref={composer} fullWidth rows={2} value={draft} readOnly={sending} aria-busy={sending} maxLength={4000}
          aria-autocomplete="list" aria-controls={mentionOpen ? "chat-mention-listbox" : undefined}
          aria-activedescendant={activeCandidate ? `chat-mention-opt-${activeCandidate.id}` : undefined}
          onChange={(event) => handleDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={(event) => {
            const pasted = attachmentsEnabled ? Array.from(event.clipboardData?.files ?? []) : [];
            if (pasted.length > 0) {
              event.preventDefault();
              handleFiles(pasted);
            }
          }}
          placeholder="Escribe un mensaje…" />
      </label>
      <div className="flex items-center justify-end gap-2">
        {attachmentsEnabled && <>
          <input ref={fileInput} type="file" multiple accept={ALLOWED_CHAT_ATTACHMENT_MIMES.join(",")}
            aria-label="Seleccionar archivos adjuntos" className="sr-only"
            onChange={(event) => {
              handleFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }} />
          <Button type="button" variant="ghost" size="sm" aria-label="Adjuntar archivo"
            className={control} onPress={() => fileInput.current?.click()}>📎</Button>
        </>}
        <Button type="button" variant="ghost" size="sm" aria-label="Insertar emoji" aria-expanded={emojiOpen}
          className={control} onPress={() => setEmojiOpen((open) => !open)}>😊</Button>
        <Button type="submit" variant="primary" className={control} isPending={sending}
          isDisabled={!propsCanSend(sending, draft, activeAttachments.length)}>
          {sending ? "Enviando…" : failedSend ? "Reintentar envío" : "Enviar"}
        </Button>
      </div>
    </form>
  </div>;
}

const propsCanSend = (sending: boolean, draft: string, attachmentsCount = 0) =>
  sending || Boolean(draft.trim()) || attachmentsCount > 0;

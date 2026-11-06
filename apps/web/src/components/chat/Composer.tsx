"use client";

import { Button, EmojiPicker, TextArea } from "@hubly/ui";
import React, { useRef, useState } from "react";

const control = "min-h-11";

export interface ComposerProps {
  writable: boolean;
  loading: boolean;
  draft: string;
  sending: boolean;
  failedSend: boolean;
  onDraft: (value: string) => void;
  onSend: () => void;
}

export function Composer({ writable, loading, draft, sending, failedSend, onDraft, onSend }: ComposerProps) {
  const composer = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  if (loading) return null;
  if (!writable) return <p className="border-t border-(--border-default) p-3 text-sm text-(--text-secondary)">Conversación de solo lectura.</p>;

  return <div className="relative shrink-0 border-t border-(--border-default) p-3">
    {emojiOpen && <div className="absolute bottom-full left-3 z-20 mb-2">
      <EmojiPicker
        onSelect={(emoji) => { onDraft(`${draft}${emoji}`); setEmojiOpen(false); composer.current?.focus(); }}
        onClose={() => { setEmojiOpen(false); composer.current?.focus(); }} />
    </div>}
    <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      onSubmit={(event) => { event.preventDefault(); if (sending) return; setEmojiOpen(false); composer.current?.focus(); onSend(); }}>
      <label className="min-w-0">
        <span className="mb-1 block text-sm font-semibold">Mensaje</span>
        {/* Mientras se envía el campo queda en solo lectura, no deshabilitado, para que el foco siga en el compositor. */}
        <TextArea ref={composer} fullWidth rows={2} value={draft} readOnly={sending} aria-busy={sending} maxLength={4000}
          onChange={(event) => onDraft(event.target.value)} placeholder="Escribe un mensaje…" />
      </label>
      <Button type="button" variant="ghost" size="sm" aria-label="Insertar emoji" aria-expanded={emojiOpen}
        className={control} onPress={() => setEmojiOpen((open) => !open)}>😊</Button>
      <Button type="submit" variant="primary" className={control} isPending={sending} isDisabled={!propsCanSend(sending, draft)}>
        {sending ? "Enviando…" : failedSend ? "Reintentar envío" : "Enviar"}
      </Button>
    </form>
  </div>;
}

const propsCanSend = (sending: boolean, draft: string) => sending || Boolean(draft.trim());

"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { useEffect, useState, type FormEvent } from "react";
import { Dialog, FileTrigger, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Icon } from "./icons";
import type { EspacioProfile } from "./types";

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Revisión inmediata en el navegador; la de verdad (firma binaria y tamaño) la hace el servidor. */
export function avatarFileError(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return "Elige una imagen JPEG, PNG o WebP.";
  if (file.size > AVATAR_MAX_BYTES) return "La foto pesa más de 5 MB.";
  return null;
}

/** Foto de perfil o, sin ella, la inicial sobre el color de acento. */
export function Avatar({ url, initial, className, iconClassName = "size-5" }: { url: string | null; initial: string | null; className: string; iconClassName?: string }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--accent-primary) font-bold text-(--text-on-accent) ${className}`}>
      {url ? <img src={url} alt="" className="size-full object-cover" /> : initial ?? <Icon name="usuario" className={iconClassName} />}
    </span>
  );
}

export interface PerfilDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: EspacioProfile & { email: string | null; initial: string | null };
  onNameSaved: (name: string) => void;
  onAvatarChanged: (url: string | null) => void;
}

/** «Editar perfil» (issue 135): cambiar la foto y el nombre visible. */
export function PerfilDialog({ isOpen, onClose, profile, onNameSaved, onAvatarChanged }: PerfilDialogProps) {
  const [name, setName] = useState(profile.name ?? "");
  const [busy, setBusy] = useState<"foto" | "nombre" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(profile.name ?? "");
      setError(null);
    }
  }, [isOpen, profile.name]);

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const invalid = avatarFileError(file);
    if (invalid) return setError(invalid);
    setBusy("foto");
    setError(null);
    const result = await profile.onUploadAvatar(file);
    setBusy(null);
    if (result.ok) onAvatarChanged(result.value);
    else setError(result.message);
  };

  const remove = async () => {
    setBusy("foto");
    setError(null);
    const result = await profile.onRemoveAvatar();
    setBusy(null);
    if (result.ok) onAvatarChanged(null);
    else setError(result.message);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError("Escribe tu nombre.");
    setBusy("nombre");
    setError(null);
    const result = await profile.onSaveName(name);
    setBusy(null);
    if (!result.ok) return setError(result.message);
    onNameSaved(result.value);
    onClose();
  };

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} isDismissable className="fixed inset-0 z-50 flex items-start justify-center bg-(--glass-hover) px-3 pt-20 backdrop-blur-xs">
      <Modal className="hubly-pop w-full max-w-md">
        <Dialog className="hubly-pop-surface flex flex-col overflow-hidden rounded-2xl text-(--text-primary) outline-none">
          <div className="flex items-center gap-2.5 border-b border-(--glass-line) px-4 py-3">
            <Icon name="lapiz" className="size-4 text-(--accent-primary)" />
            <Heading slot="title" className="m-0 grow text-base font-semibold">Editar perfil</Heading>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Cerrar" onPress={onClose}><Icon name="cerrar" /></Button>
          </div>
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5 px-4 py-5">
            <div className="flex items-center gap-4">
              <Avatar url={profile.avatarUrl} initial={profile.initial} className="size-20 text-3xl" iconClassName="size-8" />
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <FileTrigger acceptedFileTypes={AVATAR_TYPES} onSelect={(files) => void upload(files)}>
                    <Button size="sm" variant="secondary" isDisabled={busy !== null} className="min-h-11">
                      <Icon name="camara" /> {busy === "foto" ? "Subiendo…" : profile.avatarUrl ? "Cambiar foto" : "Subir foto"}
                    </Button>
                  </FileTrigger>
                  {profile.avatarUrl && (
                    <Button size="sm" variant="ghost" isDisabled={busy !== null} onPress={() => void remove()} className="min-h-11">Quitar</Button>
                  )}
                </div>
                <p className="m-0 text-xs text-(--text-muted)">JPEG, PNG o WebP · hasta 5 MB · sin datos de ubicación</p>
              </div>
            </div>
            <TextField value={name} onChange={setName} maxLength={60} autoFocus>
              <Label>Tu nombre</Label>
              <Input placeholder="Cómo quieres que te vea tu equipo" />
            </TextField>
            {profile.email && <p className="m-0 text-sm text-(--text-secondary)">Entras con <span className="font-semibold text-(--text-primary)">{profile.email}</span></p>}
            {error && <p role="alert" className="hubly-pop m-0 text-sm text-(--status-danger-text)">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onPress={onClose}>Cancelar</Button>
              <Button type="submit" variant="primary" isDisabled={busy !== null}>{busy === "nombre" ? "Guardando…" : "Guardar"}</Button>
            </div>
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

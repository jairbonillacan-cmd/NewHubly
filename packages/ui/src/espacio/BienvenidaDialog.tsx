"use client";

import { Button } from "@heroui/react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Hubi } from "../components/brand/Hubi";

export interface BienvenidaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Nombre del espacio personal recién creado. */
  workspaceName?: string;
}

const PRIMEROS_PASOS = [
  { tecla: "C", texto: "Escribe un pendiente en la barra de abajo: «mañana», «!alta» o «@nota» se entienden solos." },
  { tecla: "Ctrl K", texto: "Busca o haz cualquier cosa sin soltar el teclado." },
  { tecla: "Fondo", texto: "Elige tu fondo y el tema claro u oscuro desde el dock." },
] as const;

/** Se abre una sola vez, al entrar a Hoy después de confirmar la cuenta. */
export function BienvenidaDialog({ isOpen, onClose, workspaceName }: BienvenidaDialogProps) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} isDismissable className="hubly-modal-overlay fixed inset-0 z-50 bg-(--glass-hover) backdrop-blur-xs">
      <Modal className="hubly-pop hubly-modal max-w-sm">
        <Dialog className="hubly-pop-surface flex flex-col overflow-hidden rounded-2xl text-(--text-primary) outline-none">
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pt-5 pb-3 sm:px-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="[@media(max-height:30rem)]:hidden"><Hubi pose="bienvenida" tamano={72} decorativo /></div>
            <Heading slot="title" className="m-0 text-xl leading-tight font-bold tracking-(--tracking-tight)">¡Te damos la bienvenida a Hubly!</Heading>
            <p className="m-0 text-sm text-(--text-secondary)">
              Tu cuenta está confirmada y {workspaceName ? <>tu espacio <strong className="text-(--text-primary)">{workspaceName}</strong></> : "tu espacio"} ya está listo.
              Es privado: lo que guardes solo lo ves tú.
            </p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {PRIMEROS_PASOS.map((paso) => (
              <li key={paso.tecla} className="flex items-start gap-3 rounded-lg bg-(--glass-hover) px-3 py-2 text-xs leading-snug">
                <kbd className="min-w-14 shrink-0 rounded-md border border-(--glass-line-strong) px-1.5 py-0.5 text-center font-sans text-xs font-semibold">{paso.tecla}</kbd>
                <span>{paso.texto}</span>
              </li>
            ))}
          </ul>
          </div>
          <div className="shrink-0 border-t border-(--glass-line) px-5 pt-3 pb-4 sm:px-6">
            <Button variant="primary" className="min-h-11" fullWidth onPress={onClose} autoFocus>Empezar</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

"use client";

import { Button } from "@heroui/react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Icon } from "./icons";

// Recorte de la foto de perfil (issue 150): acercar, mover y rotar antes de subirla. Sale un cuadrado de 512 px en JPEG;
// el servidor la vuelve a validar y le quita los metadatos.

/** Lado del visor circular en pantalla y de la foto que se sube. */
export const RECORTE_VISOR = 256;
export const RECORTE_SALIDA = 512;
export const RECORTE_ZOOM_MAX = 4;

export interface Encuadre { zoom: number; rotacion: 0 | 90 | 180 | 270; x: number; y: number }
const INICIAL: Encuadre = { zoom: 1, rotacion: 0, x: 0, y: 0 };

/** Escala con la que la imagen, ya rotada, cubre justo el visor. */
export function escalaBase(ancho: number, alto: number, rotacion: Encuadre["rotacion"], visor = RECORTE_VISOR): number {
  const [w, h] = rotacion % 180 === 0 ? [ancho, alto] : [alto, ancho];
  return Math.max(visor / w, visor / h);
}

/** Limita el desplazamiento para que la imagen siempre cubra todo el visor (sin huecos en el círculo). */
export function limitarEncuadre(e: Encuadre, ancho: number, alto: number, visor = RECORTE_VISOR): Encuadre {
  const [w, h] = e.rotacion % 180 === 0 ? [ancho, alto] : [alto, ancho];
  const escala = escalaBase(ancho, alto, e.rotacion, visor) * e.zoom;
  const maxX = Math.max(0, (w * escala - visor) / 2), maxY = Math.max(0, (h * escala - visor) / 2);
  return { ...e, x: Math.min(maxX, Math.max(-maxX, e.x)), y: Math.min(maxY, Math.max(-maxY, e.y)) };
}

export interface FotoRecorteProps {
  /** Archivo elegido; null cierra la ventana. */
  file: File | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

export function FotoRecorte({ file, busy, error, onCancel, onConfirm }: FotoRecorteProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [encuadre, setEncuadre] = useState<Encuadre>(INICIAL);
  const imgRef = useRef<HTMLImageElement>(null);
  const arrastre = useRef<{ x: number; y: number; e: Encuadre } | null>(null);

  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file);
    setUrl(next);
    setImg(null);
    setEncuadre(INICIAL);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const ajustar = (e: Encuadre) => setEncuadre(img ? limitarEncuadre(e, img.naturalWidth, img.naturalHeight) : e);

  // La imagen se coloca con variables CSS: el tamaño natural y el encuadre cambian en tiempo de ejecución.
  useEffect(() => {
    const el = imgRef.current;
    if (!el || !img) return;
    const escala = escalaBase(img.naturalWidth, img.naturalHeight, encuadre.rotacion) * encuadre.zoom;
    el.style.setProperty("--foto-w", `${img.naturalWidth}px`);
    el.style.setProperty("--foto-h", `${img.naturalHeight}px`);
    el.style.setProperty("--foto-x", `${encuadre.x}px`);
    el.style.setProperty("--foto-y", `${encuadre.y}px`);
    el.style.setProperty("--foto-rot", `${encuadre.rotacion}deg`);
    el.style.setProperty("--foto-escala", String(escala));
  }, [img, encuadre]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    arrastre.current = { x: event.clientX, y: event.clientY, e: encuadre };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const inicio = arrastre.current;
    if (inicio) ajustar({ ...inicio.e, x: inicio.e.x + event.clientX - inicio.x, y: inicio.e.y + event.clientY - inicio.y });
  };
  const rotar = (giro: 90 | -90) => ajustar({ ...encuadre, rotacion: (((encuadre.rotacion + giro) % 360 + 360) % 360) as Encuadre["rotacion"] });

  const guardar = () => {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = RECORTE_SALIDA;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const k = RECORTE_SALIDA / RECORTE_VISOR;
    const escala = escalaBase(img.naturalWidth, img.naturalHeight, encuadre.rotacion) * encuadre.zoom * k;
    ctx.translate(RECORTE_SALIDA / 2 + encuadre.x * k, RECORTE_SALIDA / 2 + encuadre.y * k);
    ctx.rotate((encuadre.rotacion * Math.PI) / 180);
    ctx.scale(escala, escala);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    canvas.toBlob((blob) => { if (blob) onConfirm(new File([blob], "foto.jpg", { type: "image/jpeg" })); }, "image/jpeg", 0.9);
  };

  return (
    <ModalOverlay isOpen={file !== null} onOpenChange={(open) => { if (!open && !busy) onCancel(); }} isDismissable={!busy} className="hubly-modal-overlay fixed inset-0 z-60 bg-(--glass-hover) backdrop-blur-xs">
      <Modal className="hubly-pop hubly-modal max-w-sm">
        <Dialog className="hubly-pop-surface flex flex-col overflow-hidden rounded-2xl text-(--text-primary) outline-none">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-(--glass-line) px-4 py-3">
            <Icon name="camara" className="size-4 text-(--accent-primary)" />
            <Heading slot="title" className="m-0 grow text-base font-semibold">Ajusta tu foto</Heading>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Cerrar" isDisabled={busy} onPress={onCancel}><Icon name="cerrar" /></Button>
          </div>
          <div className="flex min-h-0 flex-col items-center gap-4 overflow-y-auto px-4 py-5">
            <div
              role="img"
              aria-label="Vista previa de tu foto. Arrástrala para moverla."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => { arrastre.current = null; }}
              className="hubly-recorte-visor relative size-64 cursor-grab touch-none overflow-hidden rounded-full bg-(--glass-hover) active:cursor-grabbing"
            >
              {url && <img ref={imgRef} src={url} alt="" draggable={false} onLoad={(event) => setImg(event.currentTarget)} className="hubly-recorte-foto" />}
            </div>
            <label className="flex w-full items-center gap-3 text-sm text-(--text-secondary)">
              <Icon name="menos" className="size-4" />
              <span className="sr-only">Acercar</span>
              <input type="range" min={1} max={RECORTE_ZOOM_MAX} step={0.01} value={encuadre.zoom} onChange={(event) => ajustar({ ...encuadre, zoom: Number(event.target.value) })}
                className="grow accent-(--accent-primary)" />
              <Icon name="mas" className="size-4" />
            </label>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="secondary" onPress={() => rotar(-90)} className="min-h-11"><Icon name="deshacer" /> Girar a la izquierda</Button>
              <Button size="sm" variant="secondary" onPress={() => rotar(90)} className="min-h-11"><span className="-scale-x-100"><Icon name="deshacer" /></span> Girar a la derecha</Button>
              <Button size="sm" variant="ghost" onPress={() => setEncuadre(INICIAL)} className="min-h-11">Restablecer</Button>
            </div>
            {error && <p role="alert" className="hubly-pop m-0 text-sm text-(--status-danger-text)">{error}</p>}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-(--glass-line) px-4 py-3">
            <Button variant="ghost" isDisabled={busy} onPress={onCancel}>Cancelar</Button>
            <Button variant="primary" isDisabled={busy || !img} onPress={guardar}>{busy ? "Guardando…" : "Guardar foto"}</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

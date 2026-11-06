"use client";

import { Button, Tooltip } from "@heroui/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// Lienzo infinito de Hoy (issue 136): los paneles flotan en un plano que se arrastra y se acerca o aleja.
// El acomodo se recuerda en este navegador hasta que exista su preferencia en la cuenta, igual que el carril.

export interface LienzoRect { x: number; y: number; w: number; h: number }
export interface LienzoView { x: number; y: number; zoom: number }
export interface LienzoItem { id: string; rect: LienzoRect; node: ReactNode }

export const LIENZO_ZOOM_MIN = 0.4;
export const LIENZO_ZOOM_MAX = 1.6;
const PANEL_MIN = { w: 320, h: 200 };
const STORAGE_KEY = "hubly-lienzo";
const ZOOM_STEP = 1.2;
const FIT_PADDING = 32;

export const clampZoom = (zoom: number) => Math.min(LIENZO_ZOOM_MAX, Math.max(LIENZO_ZOOM_MIN, zoom));

/** Cambia el zoom dejando quieto el punto (px, py) de la pantalla, como en un mapa. */
export function zoomAt(view: LienzoView, nextZoom: number, px: number, py: number): LienzoView {
  const zoom = clampZoom(nextZoom);
  const k = zoom / view.zoom;
  return { zoom, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}

/** Encuadre que muestra todos los paneles centrados, sin acercar más del 100 %. */
export function fitView(rects: readonly LienzoRect[], width: number, height: number, padding = FIT_PADDING): LienzoView {
  if (rects.length === 0 || width <= 0 || height <= 0) return { x: 0, y: 0, zoom: 1 };
  const minX = Math.min(...rects.map((r) => r.x)), minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w)), maxY = Math.max(...rects.map((r) => r.y + r.h));
  const zoom = clampZoom(Math.min(1, (width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY)));
  return { zoom, x: (width - (maxX - minX) * zoom) / 2 - minX * zoom, y: (height - (maxY - minY) * zoom) / 2 - minY * zoom };
}

interface Saved { view?: LienzoView; rects?: Record<string, LienzoRect> }

function readSaved(): Saved {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Saved) : {};
  } catch {
    return {};
  }
}

function writeSaved(saved: Saved) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* sin almacenamiento: dura esta visita */ }
}

type Gesture =
  | { kind: "pan"; startX: number; startY: number; view: LienzoView }
  | { kind: "item"; id: string; startX: number; startY: number; rect: LienzoRect };

const NOT_DRAG = "button, a, input, textarea, select, [contenteditable='true'], [role='button'], [role='menuitem'], [role='switch'], [role='checkbox']";

function Control({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Tooltip delay={400}>
      <Button isIconOnly size="sm" variant="ghost" aria-label={label} onPress={onPress} className="size-11 min-w-11 text-(--text-secondary) data-[hovered]:text-(--text-primary)">
        <Icon name={icon} className="size-4" />
      </Button>
      <Tooltip.Content placement="top">{label}</Tooltip.Content>
    </Tooltip>
  );
}

/** Lienzo infinito: se arrastra desde el fondo, la rueda lo mueve y Ctrl + rueda (o pellizcar) acerca o aleja.
 *  Cada panel se mueve desde su cabecera y cambia de tamaño desde su esquina. */
export function Lienzo({ items }: { items: readonly LienzoItem[] }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<LienzoView>({ x: 0, y: 0, zoom: 1 });
  const [rects, setRects] = useState<Record<string, LienzoRect>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const gesture = useRef<Gesture | null>(null);

  const rectOf = useCallback((item: LienzoItem) => rects[item.id] ?? item.rect, [rects]);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) setView(fitView(items.map(rectOf), canvas.clientWidth, canvas.clientHeight));
  }, [items, rectOf]);

  // Al montar: recupera el acomodo guardado o encuadra todos los paneles.
  useLayoutEffect(() => {
    const saved = readSaved();
    if (saved.rects) setRects(saved.rects);
    const canvas = canvasRef.current;
    if (saved.view && Number.isFinite(saved.view.zoom)) setView({ ...saved.view, zoom: clampZoom(saved.view.zoom) });
    else if (canvas) setView(fitView(items.map((item) => saved.rects?.[item.id] ?? item.rect), canvas.clientWidth, canvas.clientHeight));
    setReady(true);
    // Solo al montar: después manda lo que la persona mueva.
  }, []);

  useEffect(() => {
    layerRef.current?.style.setProperty("--lienzo-x", `${view.x}px`);
    layerRef.current?.style.setProperty("--lienzo-y", `${view.y}px`);
    layerRef.current?.style.setProperty("--lienzo-zoom", String(view.zoom));
  }, [view]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => writeSaved({ view, rects }), 250);
    return () => clearTimeout(timer);
  }, [view, rects, ready]);

  // La rueda necesita un listener no pasivo para poder evitar el desplazamiento de la página.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const box = canvas.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        // Pellizcar da pasos pequeños; una rueda de ratón, grandes: se recorta para que cada paso sea suave.
        const delta = Math.max(-50, Math.min(50, event.deltaY));
        setView((current) => zoomAt(current, current.zoom * Math.exp(-delta * 0.004), event.clientX - box.left, event.clientY - box.top));
      } else if (!(event.target instanceof Element && event.target.closest("[data-lienzo-item]"))) {
        event.preventDefault();
        setView((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    const itemEl = event.target.closest<HTMLElement>("[data-lienzo-item]");
    if (itemEl) {
      const id = itemEl.dataset.lienzoItem!;
      setOrder((current) => [...current.filter((other) => other !== id), id]);
      if (!event.target.closest("[data-lienzo-asa]") || event.target.closest(NOT_DRAG)) return;
      const item = items.find((candidate) => candidate.id === id);
      if (!item) return;
      gesture.current = { kind: "item", id, startX: event.clientX, startY: event.clientY, rect: rectOf(item) };
    } else {
      gesture.current = { kind: "pan", startX: event.clientX, startY: event.clientY, view };
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.arrastrando = "true";
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current) return;
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY;
    if (current.kind === "pan") setView({ ...current.view, x: current.view.x + dx, y: current.view.y + dy });
    else setRects((all) => ({ ...all, [current.id]: { ...current.rect, x: Math.round(current.rect.x + dx / view.zoom), y: Math.round(current.rect.y + dy / view.zoom) } }));
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    gesture.current = null;
    delete event.currentTarget.dataset.arrastrando;
  };

  const onResize = useCallback((id: string, w: number, h: number) => {
    setRects((all) => {
      const item = items.find((candidate) => candidate.id === id);
      const base = all[id] ?? item?.rect;
      if (!base || (Math.abs(base.w - w) < 2 && Math.abs(base.h - h) < 2)) return all;
      return { ...all, [id]: { ...base, w: Math.max(PANEL_MIN.w, Math.round(w)), h: Math.max(PANEL_MIN.h, Math.round(h)) } };
    });
  }, [items]);

  const zoomBy = (factor: number) => {
    const canvas = canvasRef.current;
    if (canvas) setView((current) => zoomAt(current, current.zoom * factor, canvas.clientWidth / 2, canvas.clientHeight / 2));
  };

  const resetLayout = () => {
    setRects({});
    const canvas = canvasRef.current;
    if (canvas) setView(fitView(items.map((item) => item.rect), canvas.clientWidth, canvas.clientHeight));
  };

  const zIndex = (id: string) => order.indexOf(id) + 1;

  return (
    <div className="relative min-h-0 grow">
      <div
        ref={canvasRef}
        role="region"
        aria-label="Lienzo de Hoy: arrastra el fondo para moverte; Ctrl y la rueda para acercar o alejar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        className="hubly-lienzo absolute inset-0 overflow-hidden rounded-2xl"
      >
        <div ref={layerRef} className={`hubly-lienzo-capa ${ready ? "" : "invisible"}`}>
          {items.map((item) => (
            <LienzoPanel key={item.id} id={item.id} rect={rectOf(item)} z={zIndex(item.id)} onResize={onResize}>{item.node}</LienzoPanel>
          ))}
        </div>
      </div>
      <div role="toolbar" aria-label="Controles del lienzo" className="hubly-glass absolute right-3 bottom-3 z-10 flex items-center gap-0.5 rounded-xl p-1">
        <Control icon="menos" label="Alejar" onPress={() => zoomBy(1 / ZOOM_STEP)} />
        <span aria-live="polite" className="min-w-12 text-center text-xs font-semibold text-(--text-secondary) tabular-nums">{Math.round(view.zoom * 100)} %</span>
        <Control icon="mas" label="Acercar" onPress={() => zoomBy(ZOOM_STEP)} />
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-(--glass-line-strong)" />
        <Control icon="encuadrar" label="Ver todos los paneles" onPress={fit} />
        <Control icon="deshacer" label="Volver al acomodo inicial" onPress={resetLayout} />
      </div>
    </div>
  );
}

function LienzoPanel({ id, rect, z, onResize, children }: { id: string; rect: LienzoRect; z: number; onResize: (id: string, w: number, h: number) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--item-x", `${rect.x}px`);
    el.style.setProperty("--item-y", `${rect.y}px`);
    el.style.setProperty("--item-w", `${rect.w}px`);
    el.style.setProperty("--item-h", `${rect.h}px`);
    el.style.setProperty("--item-z", String(z));
    // La esquina nativa deja un ancho y alto en línea; ya quedaron en las variables, así que se quitan.
    el.style.removeProperty("width");
    el.style.removeProperty("height");
  }, [rect, z]);

  // El tamaño cambia con la esquina nativa (resize de CSS); se guarda en unidades del lienzo, sin el zoom.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => onResize(id, el.offsetWidth, el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, onResize]);

  return (
    <div ref={ref} data-lienzo-item={id} className="hubly-lienzo-item">
      {children}
    </div>
  );
}

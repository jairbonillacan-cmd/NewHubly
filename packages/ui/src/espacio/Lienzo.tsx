"use client";

import { Button, Dropdown, ToggleButton, Tooltip } from "@heroui/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Key } from "react-aria-components";
import { Icon, type IconName } from "./icons";
import type { LayoutId } from "./preferencias";

// Lienzo infinito de Hoy (issues 136, 141 y 147): los paneles flotan en un plano que se arrastra y se acerca o aleja.
// El acomodo y las opciones se recuerdan en este navegador hasta que exista su preferencia en la cuenta, igual que el carril.

export interface LienzoRect { x: number; y: number; w: number; h: number }
export interface LienzoView { x: number; y: number; zoom: number }
export interface LienzoItem { id: string; rect: LienzoRect; node: ReactNode }
export interface LienzoOpciones { mapa: boolean; iman: boolean }
/** Borde desde el que se cambia el tamaño: lados y esquinas. */
export type LienzoBorde = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const LIENZO_ZOOM_MIN = 0.4;
export const LIENZO_ZOOM_MAX = 1.6;
/** Paso del imán: los paneles se alinean a esta cuadrícula al moverlos o cambiarles el tamaño. */
export const LIENZO_PASO = 24;
export const PANEL_MIN = { w: 320, h: 200 };
const STORAGE_KEY = "hubly-lienzo";
const ZOOM_STEP = 1.2;
const FIT_PADDING = 32;
const MAPA = { w: 176, h: 112, margen: 160 };
/** Lo que dura el asentamiento del panel al soltarlo; coincide con la animación hubly-asentar. */
const ASENTAR_MS = 520;
const BORDES: readonly LienzoBorde[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export const clampZoom = (zoom: number) => Math.min(LIENZO_ZOOM_MAX, Math.max(LIENZO_ZOOM_MIN, zoom));
export const alinear = (value: number, iman: boolean) => (iman ? Math.round(value / LIENZO_PASO) * LIENZO_PASO : Math.round(value));

/** Cambia el zoom dejando quieto el punto (px, py) de la pantalla, como en un mapa. */
export function zoomAt(view: LienzoView, nextZoom: number, px: number, py: number): LienzoView {
  const zoom = clampZoom(nextZoom);
  const k = zoom / view.zoom;
  return { zoom, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}

function bounds(rects: readonly LienzoRect[]) {
  const minX = Math.min(...rects.map((r) => r.x)), minY = Math.min(...rects.map((r) => r.y));
  return { minX, minY, maxX: Math.max(...rects.map((r) => r.x + r.w)), maxY: Math.max(...rects.map((r) => r.y + r.h)) };
}

/** Encuadre que muestra todos los paneles centrados, sin acercar más del 100 %. */
export function fitView(rects: readonly LienzoRect[], width: number, height: number, padding = FIT_PADDING): LienzoView {
  if (rects.length === 0 || width <= 0 || height <= 0) return { x: 0, y: 0, zoom: 1 };
  const { minX, minY, maxX, maxY } = bounds(rects);
  const zoom = clampZoom(Math.min(1, (width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY)));
  return { zoom, x: (width - (maxX - minX) * zoom) / 2 - minX * zoom, y: (height - (maxY - minY) * zoom) / 2 - minY * zoom };
}

/** Lo que se ve de la pantalla, en coordenadas del lienzo. */
export const visibleRect = (view: LienzoView, width: number, height: number): LienzoRect =>
  ({ x: -view.x / view.zoom, y: -view.y / view.zoom, w: width / view.zoom, h: height / view.zoom });

/** Nuevo rectángulo al arrastrar un borde (dx, dy en unidades del lienzo). El lado opuesto queda quieto y nunca
 *  baja del tamaño mínimo. */
export function redimensionar(rect: LienzoRect, borde: LienzoBorde, dx: number, dy: number, iman = false): LienzoRect {
  let { x, y, w, h } = rect;
  if (borde.includes("e")) w = Math.max(PANEL_MIN.w, alinear(rect.w + dx, iman));
  if (borde.includes("s")) h = Math.max(PANEL_MIN.h, alinear(rect.h + dy, iman));
  if (borde.includes("w")) { w = Math.max(PANEL_MIN.w, alinear(rect.w - dx, iman)); x = rect.x + rect.w - w; }
  if (borde.includes("n")) { h = Math.max(PANEL_MIN.h, alinear(rect.h - dy, iman)); y = rect.y + rect.h - h; }
  return { x, y, w, h };
}

interface Saved { view?: LienzoView; rects?: Record<string, LienzoRect>; opciones?: Partial<LienzoOpciones> }

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
  | { kind: "item"; id: string; startX: number; startY: number; rect: LienzoRect }
  | { kind: "borde"; id: string; borde: LienzoBorde; startX: number; startY: number; rect: LienzoRect };

const NOT_DRAG = "button, a, input, textarea, select, [contenteditable='true'], [role='button'], [role='menuitem'], [role='switch'], [role='checkbox']";
const MENU = "hubly-pop-surface min-w-64 rounded-xl p-1.5 text-(--text-primary)";
const ITEM = "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[focused]:bg-(--glass-hover)";
const CONTROL = "size-11 min-w-11 text-(--text-secondary) data-[hovered]:text-(--text-primary)";
const MODOS: { id: LayoutId; label: string; icon: IconName }[] = [
  { id: "libre", label: "Lienzo libre", icon: "libre" },
  { id: "lado", label: "Lado a lado", icon: "lado" },
  { id: "enfoque", label: "Enfoque", icon: "enfoque" },
];

function Control({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Tooltip delay={400}>
      <Button isIconOnly size="sm" variant="ghost" aria-label={label} onPress={onPress} className={CONTROL}>
        <Icon name={icon} className="size-5" />
      </Button>
      <Tooltip.Content placement="top">{label}</Tooltip.Content>
    </Tooltip>
  );
}

/** Controles del lienzo cuando está activo: zoom, mapa, imán y acomodo. */
export interface LienzoControles {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  opciones: LienzoOpciones;
  onOpciones: (opciones: LienzoOpciones) => void;
}

export interface LienzoBarraProps {
  layout: LayoutId;
  onLayout: (layout: LayoutId) => void;
  /** Abre el selector de fondo; `fondo` es ese selector, anclado a la barra. */
  onOpenFondo: () => void;
  fondo?: ReactNode;
  /** Solo en el lienzo libre de escritorio; sin ellos, la barra ofrece el modo de paneles y el fondo. */
  lienzo?: LienzoControles | undefined;
}

/** Barra propia del lienzo (issue 147), a la derecha del dock: tuerca con modos, mapa, imán, fondo y acomodo, y zoom. */
export function LienzoBarra({ layout, onLayout, onOpenFondo, fondo, lienzo }: LienzoBarraProps) {
  const onMenu = (key: Key) => {
    if (key === "libre" || key === "lado" || key === "enfoque") onLayout(key);
    else if (key === "fondo") onOpenFondo();
    else if (key === "mapa" && lienzo) lienzo.onOpciones({ ...lienzo.opciones, mapa: !lienzo.opciones.mapa });
    else if (key === "iman" && lienzo) lienzo.onOpciones({ ...lienzo.opciones, iman: !lienzo.opciones.iman });
    else if (key === "encuadrar") lienzo?.onFit();
    else if (key === "restablecer") lienzo?.onReset();
  };
  const check = (on: boolean) => on && <Icon name="check" className="size-4 text-(--accent-primary)" />;
  return (
    <div role="toolbar" aria-label="Lienzo y vista" data-delay="3" className="hubly-glass hubly-enter relative flex h-16 shrink-0 items-center gap-0.5 rounded-(--glass-radius-access-card) px-2">
      <Dropdown>
        <Dropdown.Trigger aria-label="Opciones del lienzo" className={`flex cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent hover:bg-(--glass-hover) ${CONTROL}`}>
          <Icon name="tuerca" className="size-5" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="top end" className={MENU}>
          <Dropdown.Menu aria-label="Opciones del lienzo" onAction={onMenu}>
            <Dropdown.Section aria-label="Modo de los paneles" className="border-b border-(--glass-line) pb-1.5">
              {MODOS.map((modo) => (
                <Dropdown.Item key={modo.id} id={modo.id} textValue={modo.label} className={ITEM}>
                  <Icon name={modo.icon} /> <span className="grow">{modo.label}</span>{check(layout === modo.id)}
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
            <Dropdown.Section aria-label="Vista" className="py-1.5">
              <Dropdown.Item id="fondo" textValue="Fondo y opacidad" className={ITEM}><Icon name="imagen" /> <span className="grow">Fondo y opacidad</span></Dropdown.Item>
              {lienzo ? <>
                <Dropdown.Item id="mapa" textValue="Mostrar el mapa" className={ITEM}><Icon name="mapa" /> <span className="grow">Mostrar el mapa</span>{check(lienzo.opciones.mapa)}</Dropdown.Item>
                <Dropdown.Item id="iman" textValue="Alinear a la cuadrícula" className={ITEM}><Icon name="paneles" /> <span className="grow">Alinear a la cuadrícula</span>{check(lienzo.opciones.iman)}</Dropdown.Item>
              </> : null}
            </Dropdown.Section>
            {lienzo ? (
              <Dropdown.Section aria-label="Acomodo" className="border-t border-(--glass-line) pt-1.5">
                <Dropdown.Item id="encuadrar" textValue="Ver todos los paneles" className={ITEM}><Icon name="encuadrar" /> Ver todos los paneles</Dropdown.Item>
                <Dropdown.Item id="restablecer" textValue="Volver al acomodo inicial" className={ITEM}><Icon name="deshacer" /> Volver al acomodo inicial</Dropdown.Item>
              </Dropdown.Section>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {lienzo && (
        <>
          <Tooltip delay={400}>
            <ToggleButton isIconOnly size="sm" variant="ghost" aria-label="Mapa del lienzo" isSelected={lienzo.opciones.mapa} onChange={(mapa) => lienzo.onOpciones({ ...lienzo.opciones, mapa })}
              className={`${CONTROL} data-[selected]:bg-(--accent-primary-subtle)`}>
              <Icon name="mapa" className="size-5" />
            </ToggleButton>
            <Tooltip.Content placement="top">Mapa del lienzo</Tooltip.Content>
          </Tooltip>
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-(--glass-line-strong)" />
          <Control icon="menos" label="Alejar" onPress={lienzo.onZoomOut} />
          <span aria-live="polite" className="min-w-12 text-center text-xs font-semibold text-(--text-secondary) tabular-nums">{Math.round(lienzo.zoom * 100)} %</span>
          <Control icon="mas" label="Acercar" onPress={lienzo.onZoomIn} />
          <Control icon="encuadrar" label="Ver todos los paneles" onPress={lienzo.onFit} />
        </>
      )}
      {fondo}
    </div>
  );
}

export interface LienzoProps {
  items: readonly LienzoItem[];
  /** Dónde va la barra del lienzo (en la fila del dock) y lo que necesita para su tuerca. */
  barra?: { slot: HTMLElement | null } & Omit<LienzoBarraProps, "lienzo"> | undefined;
}

/** Lienzo infinito: se arrastra desde el fondo, la rueda lo mueve y Ctrl + rueda (o pellizcar) acerca o aleja.
 *  Cada panel se mueve desde su cabecera y cambia de tamaño desde cualquier borde. */
export function Lienzo({ items, barra }: LienzoProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<LienzoView>({ x: 0, y: 0, zoom: 1 });
  const [rects, setRects] = useState<Record<string, LienzoRect>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [opciones, setOpciones] = useState<LienzoOpciones>({ mapa: true, iman: false });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activo, setActivo] = useState<{ id: string; modo: "flotando" | "borde" | "asentando" } | null>(null);
  const [ready, setReady] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const asentarTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const rectOf = useCallback((item: LienzoItem) => rects[item.id] ?? item.rect, [rects]);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) setView(fitView(items.map(rectOf), canvas.clientWidth, canvas.clientHeight));
  }, [items, rectOf]);

  // Al montar: recupera el acomodo guardado o encuadra todos los paneles.
  useLayoutEffect(() => {
    const saved = readSaved();
    if (saved.rects) setRects(saved.rects);
    if (saved.opciones) setOpciones((current) => ({ ...current, ...saved.opciones }));
    const canvas = canvasRef.current;
    if (saved.view && Number.isFinite(saved.view.zoom)) setView({ ...saved.view, zoom: clampZoom(saved.view.zoom) });
    else if (canvas) setView(fitView(items.map((item) => saved.rects?.[item.id] ?? item.rect), canvas.clientWidth, canvas.clientHeight));
    setReady(true);
    // Solo al montar: después manda lo que la persona mueva.
  }, []);

  useEffect(() => () => clearTimeout(asentarTimer.current), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setSize({ w: canvas.clientWidth, h: canvas.clientHeight }));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    layerRef.current?.style.setProperty("--lienzo-x", `${view.x}px`);
    layerRef.current?.style.setProperty("--lienzo-y", `${view.y}px`);
    layerRef.current?.style.setProperty("--lienzo-zoom", String(view.zoom));
  }, [view]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => writeSaved({ view, rects, opciones }), 250);
    return () => clearTimeout(timer);
  }, [view, rects, opciones, ready]);

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
      const item = items.find((candidate) => candidate.id === id);
      setOrder((current) => [...current.filter((other) => other !== id), id]);
      if (!item) return;
      const borde = event.target.closest<HTMLElement>("[data-lienzo-borde]")?.dataset.lienzoBorde as LienzoBorde | undefined;
      if (borde) {
        gesture.current = { kind: "borde", id, borde, startX: event.clientX, startY: event.clientY, rect: rectOf(item) };
        setActivo({ id, modo: "borde" });
      } else if (event.target.closest("[data-lienzo-asa]") && !event.target.closest(NOT_DRAG)) {
        gesture.current = { kind: "item", id, startX: event.clientX, startY: event.clientY, rect: rectOf(item) };
        clearTimeout(asentarTimer.current);
        setActivo({ id, modo: "flotando" });
      } else return;
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
    else if (current.kind === "item") setRects((all) => ({ ...all, [current.id]: { ...current.rect, x: alinear(current.rect.x + dx / view.zoom, opciones.iman), y: alinear(current.rect.y + dy / view.zoom, opciones.iman) } }));
    else setRects((all) => ({ ...all, [current.id]: redimensionar(current.rect, current.borde, dx / view.zoom, dy / view.zoom, opciones.iman) }));
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    gesture.current = null;
    delete event.currentTarget.dataset.arrastrando;
    if (current?.kind === "item") {
      // Al soltarlo, el panel baja y se asienta con un pequeño rebote antes de quedar quieto.
      setActivo({ id: current.id, modo: "asentando" });
      asentarTimer.current = setTimeout(() => setActivo(null), ASENTAR_MS);
    } else setActivo(null);
  };

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
  const panelRects = items.map((item) => ({ id: item.id, rect: rectOf(item) }));
  const controles: LienzoControles = {
    zoom: view.zoom, onZoomIn: () => zoomBy(ZOOM_STEP), onZoomOut: () => zoomBy(1 / ZOOM_STEP), onFit: fit, onReset: resetLayout, opciones, onOpciones: setOpciones,
  };

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
            <LienzoPanel key={item.id} id={item.id} rect={rectOf(item)} z={zIndex(item.id)} estado={activo?.id === item.id ? activo.modo : undefined}>{item.node}</LienzoPanel>
          ))}
        </div>
      </div>
      {opciones.mapa && size.w > 0 && (
        <div className="absolute right-3 bottom-3 z-10">
          <MiniMapa panels={panelRects} view={view} size={size} onCenter={(x, y) => setView((current) => ({ ...current, x: size.w / 2 - x * current.zoom, y: size.h / 2 - y * current.zoom }))} />
        </div>
      )}
      {barra?.slot && createPortal(<LienzoBarra {...barra} lienzo={controles} />, barra.slot)}
    </div>
  );
}

/** Mapa del lienzo: los paneles a escala y el recuadro de lo que se ve. Al tocarlo o arrastrarlo, la vista va ahí. */
function MiniMapa({ panels, view, size, onCenter }: { panels: { id: string; rect: LienzoRect }[]; view: LienzoView; size: { w: number; h: number }; onCenter: (x: number, y: number) => void }) {
  const visible = visibleRect(view, size.w, size.h);
  const all = bounds([...panels.map((panel) => panel.rect), visible]);
  const minX = all.minX - MAPA.margen, minY = all.minY - MAPA.margen;
  const scale = Math.min(MAPA.w / (all.maxX - all.minX + MAPA.margen * 2), MAPA.h / (all.maxY - all.minY + MAPA.margen * 2));
  const svgRef = useRef<SVGSVGElement>(null);
  const arrastrando = useRef(false);

  const go = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (box) onCenter(minX + (event.clientX - box.left) / scale, minY + (event.clientY - box.top) / scale);
  };
  const r = (rect: LienzoRect) => ({ x: (rect.x - minX) * scale, y: (rect.y - minY) * scale, width: Math.max(2, rect.w * scale), height: Math.max(2, rect.h * scale) });

  return (
    <div className="hubly-glass hubly-pop rounded-xl p-1.5">
      <svg ref={svgRef} role="img" aria-label="Mapa del lienzo: toca un punto para ir ahí" viewBox={`0 0 ${MAPA.w} ${MAPA.h}`} width={MAPA.w} height={MAPA.h}
        className="block cursor-pointer touch-none"
        onPointerDown={(event) => { arrastrando.current = true; event.currentTarget.setPointerCapture(event.pointerId); go(event); }}
        onPointerMove={(event) => { if (arrastrando.current) go(event); }}
        onPointerUp={() => { arrastrando.current = false; }}>
        {panels.map((panel) => <rect key={panel.id} {...r(panel.rect)} rx={3} fill="var(--accent-primary-subtle)" stroke="var(--accent-primary)" strokeOpacity={0.5} />)}
        <rect {...r(visible)} rx={4} fill="none" stroke="var(--accent-primary)" strokeWidth={1.5} />
      </svg>
    </div>
  );
}

function LienzoPanel({ id, rect, z, estado, children }: { id: string; rect: LienzoRect; z: number; estado: "flotando" | "borde" | "asentando" | undefined; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--item-x", `${rect.x}px`);
    el.style.setProperty("--item-y", `${rect.y}px`);
    el.style.setProperty("--item-w", `${rect.w}px`);
    el.style.setProperty("--item-h", `${rect.h}px`);
    el.style.setProperty("--item-z", String(z));
  }, [rect, z]);

  return (
    <div ref={ref} data-lienzo-item={id} data-estado={estado} className="hubly-lienzo-item">
      <div className="hubly-lienzo-cuerpo">{children}</div>
      {/* Bordes invisibles para cambiar el tamaño desde cualquier lado o esquina. */}
      {BORDES.map((borde) => <span key={borde} aria-hidden="true" data-lienzo-borde={borde} className="hubly-lienzo-borde" />)}
    </div>
  );
}

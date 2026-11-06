"use client";

import { Button, Dropdown, ToggleButton, Tooltip } from "@heroui/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Key, Selection } from "react-aria-components";
import { Icon, type IconName } from "./icons";
import type { LayoutId } from "./preferencias";

// Lienzo infinito de Hoy (issues 136 y 141): los paneles flotan en un plano que se arrastra y se acerca o aleja.
// El acomodo y las opciones se recuerdan en este navegador hasta que exista su preferencia en la cuenta, igual que el carril.

export interface LienzoRect { x: number; y: number; w: number; h: number }
export interface LienzoView { x: number; y: number; zoom: number }
export interface LienzoItem { id: string; rect: LienzoRect; node: ReactNode }
export interface LienzoOpciones { mapa: boolean; iman: boolean }

export const LIENZO_ZOOM_MIN = 0.4;
export const LIENZO_ZOOM_MAX = 1.6;
/** Paso del imán: los paneles se alinean a esta cuadrícula al moverlos o cambiarles el tamaño. */
export const LIENZO_PASO = 24;
const PANEL_MIN = { w: 320, h: 200 };
const STORAGE_KEY = "hubly-lienzo";
const ZOOM_STEP = 1.2;
const FIT_PADDING = 32;
const MAPA = { w: 176, h: 112, margen: 160 };

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
  | { kind: "item"; id: string; startX: number; startY: number; rect: LienzoRect };

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
        <Icon name={icon} className="size-4" />
      </Button>
      <Tooltip.Content placement="top">{label}</Tooltip.Content>
    </Tooltip>
  );
}

export interface LienzoProps {
  items: readonly LienzoItem[];
  /** Modo de paneles actual y cómo cambiarlo desde la tuerca. */
  layout?: LayoutId;
  onLayout?: (layout: LayoutId) => void;
}

/** Lienzo infinito: se arrastra desde el fondo, la rueda lo mueve y Ctrl + rueda (o pellizcar) acerca o aleja.
 *  Cada panel se mueve desde su cabecera y cambia de tamaño desde su esquina. */
export function Lienzo({ items, layout = "libre", onLayout }: LienzoProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<LienzoView>({ x: 0, y: 0, zoom: 1 });
  const [rects, setRects] = useState<Record<string, LienzoRect>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [opciones, setOpciones] = useState<LienzoOpciones>({ mapa: true, iman: false });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [flotando, setFlotando] = useState<string | null>(null);
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
    if (saved.opciones) setOpciones((current) => ({ ...current, ...saved.opciones }));
    const canvas = canvasRef.current;
    if (saved.view && Number.isFinite(saved.view.zoom)) setView({ ...saved.view, zoom: clampZoom(saved.view.zoom) });
    else if (canvas) setView(fitView(items.map((item) => saved.rects?.[item.id] ?? item.rect), canvas.clientWidth, canvas.clientHeight));
    setReady(true);
    // Solo al montar: después manda lo que la persona mueva.
  }, []);

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
      setOrder((current) => [...current.filter((other) => other !== id), id]);
      if (!event.target.closest("[data-lienzo-asa]") || event.target.closest(NOT_DRAG)) return;
      const item = items.find((candidate) => candidate.id === id);
      if (!item) return;
      gesture.current = { kind: "item", id, startX: event.clientX, startY: event.clientY, rect: rectOf(item) };
      setFlotando(id);
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
    else setRects((all) => ({ ...all, [current.id]: { ...current.rect, x: alinear(current.rect.x + dx / view.zoom, opciones.iman), y: alinear(current.rect.y + dy / view.zoom, opciones.iman) } }));
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    gesture.current = null;
    setFlotando(null);
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

  const onMenu = (key: Key) => {
    if (key === "encuadrar") fit();
    else if (key === "restablecer") resetLayout();
  };
  const onModo = (selection: Selection) => {
    if (selection === "all") return;
    const next = [...selection][0];
    if (next === "libre" || next === "lado" || next === "enfoque") onLayout?.(next);
  };
  const onOpciones = (selection: Selection) => {
    if (selection === "all") return;
    setOpciones({ mapa: selection.has("mapa"), iman: selection.has("iman") });
  };

  const zIndex = (id: string) => order.indexOf(id) + 1;
  const panelRects = items.map((item) => ({ id: item.id, rect: rectOf(item) }));

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
            <LienzoPanel key={item.id} id={item.id} rect={rectOf(item)} z={zIndex(item.id)} flotando={flotando === item.id} iman={opciones.iman} onResize={onResize}>{item.node}</LienzoPanel>
          ))}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-10 flex flex-col items-start gap-2">
        {opciones.mapa && size.w > 0 && <MiniMapa panels={panelRects} view={view} size={size} onCenter={(x, y) => setView((current) => ({ ...current, x: size.w / 2 - x * current.zoom, y: size.h / 2 - y * current.zoom }))} />}
        <div className="hubly-glass flex items-center rounded-xl p-1">
          <Tooltip delay={400}>
            <ToggleButton isIconOnly size="sm" variant="ghost" aria-label="Mapa del lienzo" isSelected={opciones.mapa} onChange={(mapa) => setOpciones((current) => ({ ...current, mapa }))}
              className={`${CONTROL} data-[selected]:bg-(--accent-primary-subtle) data-[selected]:text-(--accent-primary)`}>
              <Icon name="mapa" className="size-4" />
            </ToggleButton>
            <Tooltip.Content placement="top">Mapa del lienzo</Tooltip.Content>
          </Tooltip>
        </div>
      </div>

      <div role="toolbar" aria-label="Controles del lienzo" className="hubly-glass absolute right-3 bottom-3 z-10 flex items-center gap-0.5 rounded-xl p-1">
        <Dropdown>
          <Dropdown.Trigger aria-label="Opciones del lienzo" className={`flex cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent hover:bg-(--glass-hover) ${CONTROL}`}>
            <Icon name="tuerca" className="size-4" />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="top end" className={MENU}>
            <Dropdown.Menu aria-label="Opciones del lienzo" onAction={onMenu} className="hubly-sin-anillo">
              <Dropdown.Section aria-label="Modo de los paneles" selectionMode="single" selectedKeys={[layout]} onSelectionChange={onModo} className="border-b border-(--glass-line) pb-1.5">
                {MODOS.map((modo) => (
                  <Dropdown.Item key={modo.id} id={modo.id} textValue={modo.label} className={ITEM}>
                    <Icon name={modo.icon} /> <span className="grow">{modo.label}</span>{layout === modo.id && <Icon name="check" className="size-4 text-(--accent-primary)" />}
                  </Dropdown.Item>
                ))}
              </Dropdown.Section>
              <Dropdown.Section aria-label="Opciones" selectionMode="multiple" selectedKeys={[...(opciones.mapa ? ["mapa"] : []), ...(opciones.iman ? ["iman"] : [])]} onSelectionChange={onOpciones} className="border-b border-(--glass-line) py-1.5">
                <Dropdown.Item id="mapa" textValue="Mostrar el mapa" className={ITEM}><Icon name="mapa" /> <span className="grow">Mostrar el mapa</span>{opciones.mapa && <Icon name="check" className="size-4 text-(--accent-primary)" />}</Dropdown.Item>
                <Dropdown.Item id="iman" textValue="Alinear a la cuadrícula" className={ITEM}><Icon name="paneles" /> <span className="grow">Alinear a la cuadrícula</span>{opciones.iman && <Icon name="check" className="size-4 text-(--accent-primary)" />}</Dropdown.Item>
              </Dropdown.Section>
              <Dropdown.Section aria-label="Acomodo" className="pt-1.5">
                <Dropdown.Item id="encuadrar" textValue="Ver todos los paneles" className={ITEM}><Icon name="encuadrar" /> Ver todos los paneles</Dropdown.Item>
                <Dropdown.Item id="restablecer" textValue="Volver al acomodo inicial" className={ITEM}><Icon name="deshacer" /> Volver al acomodo inicial</Dropdown.Item>
              </Dropdown.Section>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-(--glass-line-strong)" />
        <Control icon="menos" label="Alejar" onPress={() => zoomBy(1 / ZOOM_STEP)} />
        <span aria-live="polite" className="min-w-12 text-center text-xs font-semibold text-(--text-secondary) tabular-nums">{Math.round(view.zoom * 100)} %</span>
        <Control icon="mas" label="Acercar" onPress={() => zoomBy(ZOOM_STEP)} />
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-(--glass-line-strong)" />
        <Control icon="encuadrar" label="Ver todos los paneles" onPress={fit} />
      </div>
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
    <div className="hubly-glass hubly-pop overflow-hidden rounded-xl p-1.5">
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

function LienzoPanel({ id, rect, z, flotando, iman, onResize, children }: { id: string; rect: LienzoRect; z: number; flotando: boolean; iman: boolean; onResize: (id: string, w: number, h: number) => void; children: ReactNode }) {
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
    const observer = new ResizeObserver(() => onResize(id, alinear(el.offsetWidth, iman), alinear(el.offsetHeight, iman)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, iman, onResize]);

  return (
    <div ref={ref} data-lienzo-item={id} data-flotando={flotando || undefined} className="hubly-lienzo-item">
      <div className="hubly-lienzo-cuerpo">{children}</div>
      <span aria-hidden="true" className="hubly-lienzo-esquina" />
    </div>
  );
}

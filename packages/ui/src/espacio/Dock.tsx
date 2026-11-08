"use client";

import { Button, Chip, Kbd, Popover, Slider, Switch, ToggleButton } from "@heroui/react";
import { forwardRef, useId, useState, type FormEvent, type ReactNode } from "react";
import { ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, ColorSwatchPickerItem, ColorThumb, FileTrigger, Input, Radio, RadioGroup, SliderTrack, parseColor, type Color } from "react-aria-components";
import { HubiFace } from "../components/brand/HublyLogo";
import { HUBLY_ACCENTS, HUBLY_ESTILOS, HUBLY_HUD, setAccentColor, useHublyAccent, useHublyAccentColor, useHublyEstilo, useHublyHud, useHublyTheme, type HublyAccent, type HublyEstilo, type HublyHud } from "../landing/ThemeToggle";
import { Icon } from "./icons";
import { FONDOS_ILUSTRADOS, WALLPAPERS, WALLPAPERS_ILUSTRADOS, type EspacioPreferencias, type PreferenciasPatch } from "./preferencias";
import type { CaptureFieldProps, DockConfig, DockSuggestion } from "./dockConfig";
import { WallpaperSwatch } from "./Wallpaper";
import { useFondoMovimiento } from "./fondoMovimiento";

const DOCK_GROUP = "hubly-glass flex h-(--frame-dock-h) shrink-0 items-center gap-1 rounded-(--glass-radius-access-card) px-1.5";
const DOCK_BUTTON = "size-(--dock-control) shrink-0 text-(--text-secondary) data-[hovered]:text-(--text-primary)";

/** «Tu imagen» (#84): URL firmada actual y acciones del servidor. Sin esto, el selector la muestra como no disponible. */
export interface WallpaperImageControls {
  url: string | null;
  onUpload: (file: File) => Promise<{ ok: true; url: string } | { ok: false; message: string }>;
  onRemove: () => Promise<void>;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Mosaico «Tu imagen»: elegirla si ya existe, subir o cambiarla, y quitarla. El servidor vuelve a validar todo. */
function TuImagenTile({ controls, selected, onSelect }: { controls: WallpaperImageControls; selected: boolean; onSelect: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    // Aviso inmediato; la validación de verdad (firma binaria y tamaño) la hace el servidor.
    if (!IMAGE_TYPES.includes(file.type)) return setError("Elige una imagen JPEG, PNG o WebP.");
    if (file.size > IMAGE_MAX_BYTES) return setError("La imagen pesa más de 5 MB.");
    setBusy(true);
    setError(null);
    const result = await controls.onUpload(file);
    setBusy(false);
    if (result.ok) onSelect();
    else setError(result.message);
  };
  return (
    <div className="col-span-3 flex flex-col gap-2 rounded-xl border border-dashed border-(--glass-line-strong) p-2">
      <div className="flex items-center gap-2">
        {controls.url ? (
          <ToggleButton
            isSelected={selected}
            onChange={onSelect}
            aria-label="Usar tu imagen como fondo"
            className="h-12 w-16 min-w-0 shrink-0 overflow-hidden rounded-lg border-2 border-transparent bg-transparent p-0 data-[selected]:border-(--accent-primary)"
          >
            <img src={controls.url} alt="" className="size-full object-cover" />
          </ToggleButton>
        ) : (
          <span aria-hidden="true" className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-(--glass-hover) text-(--text-muted)">
            <Icon name="imagen" />
          </span>
        )}
        <span className="flex min-w-0 grow flex-col">
          <span className="text-xs font-semibold text-(--text-primary)">Tu imagen</span>
          <span className="text-xs text-(--text-muted)">JPEG, PNG o WebP · hasta 5 MB · sin datos de ubicación</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <FileTrigger acceptedFileTypes={IMAGE_TYPES} onSelect={(files) => void upload(files)}>
          <Button size="sm" variant="secondary" isDisabled={busy}>
            {busy ? "Subiendo…" : controls.url ? "Cambiar imagen" : "Subir imagen"}
          </Button>
        </FileTrigger>
        {controls.url && (
          <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => { setError(null); void controls.onRemove(); }}>
            Quitar
          </Button>
        )}
      </div>
      {error && <p role="alert" className="hubly-pop m-0 text-xs text-(--status-danger-text)">{error}</p>}
    </div>
  );
}

export interface BackgroundPickerProps {
  imagen?: WallpaperImageControls | undefined;
  prefs: EspacioPreferencias;
  onChange: (patch: PreferenciasPatch) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
  triggerLabel?: string;
  /** Hacia dónde se abre: arriba desde el dock, abajo desde la barra superior. */
  placement?: "top" | "bottom end";
}

function WallpaperTile({ wallpaper, label, selected, onSelect }: { wallpaper: (typeof WALLPAPERS)[number]; label: string; selected: boolean; onSelect: () => void }) {
  return (
    <ToggleButton
      aria-label={label}
      isSelected={selected}
      onChange={onSelect}
      className="hubly-fondo-tile relative h-auto w-full min-w-0 rounded-xl border-2 border-transparent bg-transparent p-0.5 data-[hovered]:border-(--glass-line-strong) data-[selected]:border-(--accent-primary)"
    >
      <WallpaperSwatch fondo={wallpaper.id} className="h-12" />
    </ToggleButton>
  );
}

/** Selector de fondo y opacidad de los paneles (#75, sección 3). «Tu imagen» llega con Storage (#84). */
const SECCION = "text-xs font-semibold text-(--text-secondary)";
const ANIMADOS: ReadonlySet<string> = new Set(FONDOS_ILUSTRADOS.filter((fondo) => fondo.animado).map((fondo) => fondo.id));

/** Colores sugeridos del selector libre; se leen del token para no fijar colores en el código. */
const SUGERIDOS = ["--sugerido-1", "--sugerido-2", "--sugerido-3", "--sugerido-4", "--sugerido-5", "--sugerido-6", "--sugerido-7", "--sugerido-8"];
const leerToken = (nombre: string) => (typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(nombre).trim());
const aColor = (valor: string) => { try { return parseColor(valor); } catch { return null; } };

/** Saturación mínima (HSB, en %) del acento libre: por debajo, «Agregar» o «Crear pendiente» parecen desactivados (#251). */
export const SATURACION_MINIMA_ACENTO = 35;

/**
 * Sube la saturación del color elegido hasta el mínimo, conservando su brillo y su tono. Un gris no tiene tono propio:
 * se usa el que ya tenía el selector, para no teñirlo de rojo (el tono 0).
 */
export function conSaturacionMinima(next: Color, anterior: Color | null): Color {
  const hsb = next.toFormat("hsb");
  const saturacion = hsb.getChannelValue("saturation");
  if (saturacion >= SATURACION_MINIMA_ACENTO) return next;
  const tono = saturacion === 0 && anterior ? anterior.toFormat("hsb").getChannelValue("hue") : hsb.getChannelValue("hue");
  return hsb.withChannelValue("hue", tono).withChannelValue("saturation", SATURACION_MINIMA_ACENTO);
}

/** Acento libre: área de saturación y brillo, tono, hexadecimal y sugeridos, con vista previa del texto encima. */
function SelectorColor({ seleccionado, valor }: { seleccionado: boolean; valor: string }) {
  const inicial = aColor(valor) ?? aColor(leerToken("--accent-personalizado-inicial"));
  const [color, setColor] = useState<Color | null>(inicial);
  // El tono se ajusta para que se lea en el tema (acentoAccesible): se lee el que quedó aplicado para decírselo a la persona.
  const [aplicado, setAplicado] = useState(() => (seleccionado ? leerToken("--accent-custom") : ""));
  const [subido, setSubido] = useState(false);
  const aplicar = (next: Color | null) => {
    if (!next) return;
    const final = conSaturacionMinima(next, color);
    setSubido(final !== next);
    setColor(final);
    setAccentColor(final.toString("hex"));
    setAplicado(leerToken("--accent-custom"));
  };
  const ajustado = seleccionado && aplicado.startsWith("#") && color !== null && aplicado.toLowerCase() !== color.toString("hex").toLowerCase();
  const nota = subido
    ? "Le dimos un poco más de color para que los botones no parezcan desactivados."
    : ajustado ? `Ajustado a ${aplicado.toUpperCase()} para que se lea en este tema.` : "Si hace falta, Hubly ajusta el tono para que se lea.";
  const sugeridos = SUGERIDOS.map(leerToken).filter((hex) => hex.startsWith("#"));
  return (
    <Popover>
      <Button isIconOnly variant="ghost" aria-label={seleccionado ? "Color de acento personalizado, elegido. Cambiar el color" : "Elegir un color de acento personalizado"}
        className={`size-11 min-w-11 rounded-full border-2 p-0 ${seleccionado ? "border-(--text-primary)" : "border-transparent"}`}>
        {/* Mismo tamaño que los demás acentos: el color elegido o, si aún no hay, un círculo con «+». */}
        {seleccionado
          ? <span className="hubly-acento-elegido size-7 rounded-full" />
          : <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-(--border-control) text-(--text-secondary)"><Icon name="mas" /></span>}
      </Button>
      <Popover.Content placement="left" className="hubly-pop-surface w-64 rounded-2xl p-3 text-(--text-primary)">
        <Popover.Dialog aria-label="Color de acento personalizado" className="hubly-sin-anillo outline-none">
          {color && (
            <ColorPicker value={color} onChange={aplicar}>
              <div className="flex flex-col gap-3">
                <ColorArea colorSpace="hsb" xChannel="saturation" yChannel="brightness" className="hubly-color-area h-36 w-full rounded-xl">
                  <ColorThumb className="hubly-color-pomo size-5 rounded-full" />
                </ColorArea>
                <ColorSlider colorSpace="hsb" channel="hue" aria-label="Tono">
                  <SliderTrack className="h-3 w-full rounded-full">
                    <ColorThumb className="hubly-color-pomo top-1/2 size-5 rounded-full" />
                  </SliderTrack>
                </ColorSlider>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <ColorSwatch className="size-8 shrink-0 rounded-lg" />
                    <ColorField aria-label="Color en hexadecimal" className="min-w-0 grow">
                      <Input className="h-8 w-full rounded-lg border border-(--glass-line-strong) bg-(--glass-field) px-2 font-mono text-sm text-(--text-primary) uppercase outline-none focus:border-(--accent-primary)" />
                    </ColorField>
                    <span className="flex h-8 shrink-0 items-center rounded-lg bg-(--accent-primary) px-2 text-xs font-semibold text-(--text-on-accent)">Aa</span>
                  </div>
                  <p aria-live="polite" className="m-0 text-xs text-(--text-muted)">{nota}</p>
                </div>
                {sugeridos.length > 0 && (
                  <ColorSwatchPicker aria-label="Colores sugeridos" className="grid grid-cols-4 gap-1.5">
                    {sugeridos.map((hex) => (
                      <ColorSwatchPickerItem key={hex} color={hex} className="hubly-color-sugerido flex size-11 cursor-pointer items-center justify-center rounded-full outline-none">
                        <ColorSwatch className="size-8 rounded-full" />
                      </ColorSwatchPickerItem>
                    ))}
                  </ColorSwatchPicker>
                )}
              </div>
            </ColorPicker>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** Tema y acento de la apariencia: se guardan para esta persona (tema en su cuenta, acento en este navegador). */
function TemaYAcento() {
  const [estilo, setEstiloValue] = useHublyEstilo();
  const [accent, setAccentValue] = useHublyAccent();
  const accentColor = useHublyAccentColor();
  const [hud, setHudValue] = useHublyHud();
  const accentName = HUBLY_ACCENTS.find((entry) => entry.id === accent)?.nombre ?? "";
  const estiloName = HUBLY_ESTILOS.find((entry) => entry.id === estilo)?.nombre ?? "";
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="flex justify-between"><span className={SECCION}>Tema</span><span className="text-xs text-(--text-muted)">{estiloName}</span></span>
        {/* Grupos de radio de React Aria: las flechas mueven la selección y el tabulador entra y sale del grupo (issue 239). */}
        <RadioGroup aria-label="Tema" orientation="horizontal" value={estilo} onChange={(value) => setEstiloValue(value as HublyEstilo)} className="grid grid-cols-4 gap-2">
          {HUBLY_ESTILOS.map((entry) => (
            <Radio key={entry.id} value={entry.id} aria-label={entry.nombre}
              className={({ isSelected, isHovered, isFocusVisible }) => `flex min-h-11 cursor-pointer rounded-xl border-2 p-0.5 outline-none ${isFocusVisible ? "ring-2 ring-(--accent-primary)" : ""} ${isSelected ? "border-(--accent-primary)" : isHovered ? "border-(--glass-line-strong)" : "border-transparent"}`}>
              <span data-estilo-muestra={entry.id} className="hubly-estilo-muestra flex min-h-9 w-full flex-col justify-between overflow-hidden rounded-lg border border-(--glass-line-strong) p-1.5">
                <span className="hubly-estilo-muestra-barra h-1.5 w-full rounded-full" />
                <span className="size-2 rounded-full bg-(--accent-primary)" />
              </span>
            </Radio>
          ))}
        </RadioGroup>
      </div>
      <div className="flex flex-col gap-2">
        <span className="flex justify-between"><span className={SECCION}>Acento</span><span className="text-xs text-(--text-muted)">{accentName}</span></span>
        {/* El color libre abre un diálogo: va fuera del grupo de radio para no mezclar dos patrones en una sola parada de tabulador. */}
        {/* 7 zonas de 44 px no caben en una fila: van en la misma rejilla de 4 columnas que el tema (subgrid), y el color libre
            ocupa la tercera celda de la segunda fila, alineado con el resto en vez de caer suelto en otra línea. */}
        <div className="grid grid-cols-4 grid-rows-2 justify-items-center gap-x-2 gap-y-1">
          <RadioGroup aria-label="Color de acento" orientation="horizontal" value={accent === "personalizado" ? null : accent} onChange={(value) => setAccentValue(value as HublyAccent)} className="col-span-4 col-start-1 row-span-2 row-start-1 grid grid-cols-subgrid grid-rows-subgrid justify-items-center">
            {HUBLY_ACCENTS.filter((entry) => entry.id !== "personalizado").map((entry) => (
              <Radio key={entry.id} value={entry.id} aria-label={entry.nombre}
                className={({ isSelected, isFocusVisible }) => `flex size-11 cursor-pointer items-center justify-center rounded-full border-2 outline-none ${isFocusVisible ? "ring-2 ring-(--accent-primary)" : ""} ${isSelected ? "border-(--text-primary)" : "border-transparent"}`}>
                <span data-acento={entry.id} className="hubly-acento-muestra size-7 rounded-full" />
              </Radio>
            ))}
          </RadioGroup>
          <div className="col-start-3 row-start-2"><SelectorColor seleccionado={accent === "personalizado"} valor={accentColor} /></div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className={SECCION}>Tamaño del HUD</span>
        <RadioGroup aria-label="Tamaño del HUD" orientation="horizontal" value={hud} onChange={(value) => setHudValue(value as HublyHud)} className="grid grid-cols-3 gap-1 rounded-xl bg-(--glass-hover) p-1">
          {HUBLY_HUD.map((entry) => (
            <Radio key={entry.id} value={entry.id}
              className={({ isSelected, isHovered, isFocusVisible }) => `flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-xs font-semibold outline-none ${isFocusVisible ? "ring-2 ring-(--accent-primary)" : ""} ${isSelected ? "bg-(--surface-raised) text-(--text-primary) shadow-sm" : isHovered ? "bg-(--hover-acento) text-(--text-primary)" : "text-(--text-secondary)"}`}>
              {entry.nombre}
            </Radio>
          ))}
        </RadioGroup>
      </div>
    </>
  );
}

export function BackgroundPicker({ imagen, prefs, onChange, isOpen, onOpenChange, triggerClassName, triggerLabel, placement = "top" }: BackgroundPickerProps) {
  const [theme] = useHublyTheme();
  const elegido = [...WALLPAPERS, ...WALLPAPERS_ILUSTRADOS].find((wallpaper) => wallpaper.id === prefs.fondo);
  const [movimiento, setMovimiento] = useFondoMovimiento();
  const nombreFondo = prefs.fondo === "imagen" ? "Tu imagen" : elegido ? `${theme === "dark" ? elegido.oscuro : elegido.claro}${ANIMADOS.has(elegido.id) && movimiento === "animado" ? " · animado" : ""}` : "";
  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button variant="ghost" isIconOnly={!triggerLabel} aria-label="Apariencia" className={triggerClassName ?? DOCK_BUTTON}>
        <Icon name="imagen" className="size-5" />
        {triggerLabel && <span className="text-xs">{triggerLabel}</span>}
      </Button>
      <Popover.Content placement={placement} className="hubly-pop-surface hubly-popover-scroll w-88 max-w-full rounded-2xl p-4 text-(--text-primary)">
        <Popover.Dialog aria-label="Apariencia" className="hubly-sin-anillo flex flex-col gap-4 outline-none">
          <div className="flex items-baseline justify-between">
            <Popover.Heading className="m-0 text-sm font-semibold">Apariencia</Popover.Heading>
            <span className="text-xs text-(--text-muted)">Solo lo ves tú</span>
          </div>
          <TemaYAcento />
          <span className="flex justify-between"><span className={SECCION}>Fondo</span><span className="text-xs text-(--text-muted)">{nombreFondo}</span></span>
          <div className="hubly-scroll -mx-1 flex max-h-80 flex-col gap-3 overflow-x-hidden overflow-y-auto px-1">
            {/* Una sola rejilla de ilustraciones; si se mueven o no lo decide el interruptor, apagado por defecto (#251, movimiento.md). */}
            <span className="flex items-center justify-between gap-2">
              <span className="text-xs text-(--text-muted)">Ilustraciones</span>
              <Switch size="sm" isSelected={movimiento === "animado"} onChange={(on) => setMovimiento(on ? "animado" : "quieto")}>
                <Switch.Content className="flex min-h-11 flex-row items-center gap-2 text-xs text-(--text-secondary)">
                  Con movimiento
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch.Content>
              </Switch>
            </span>
            <div role="group" aria-label="Ilustraciones" className="grid grid-cols-4 gap-1.5">
              {WALLPAPERS_ILUSTRADOS.map((wallpaper) => (
                <WallpaperTile key={wallpaper.id} wallpaper={wallpaper} label={wallpaper.claro}
                  selected={prefs.fondo === wallpaper.id} onSelect={() => onChange({ fondo: wallpaper.id })} />
              ))}
            </div>
            <span className="text-xs text-(--text-muted)">Patrones</span>
            <div role="group" aria-label="Patrones" className="grid grid-cols-4 gap-1.5">
              {WALLPAPERS.filter((wallpaper) => wallpaper.id !== "patron").map((wallpaper) => (
                <WallpaperTile key={wallpaper.id} wallpaper={wallpaper} label={theme === "dark" ? wallpaper.oscuro : wallpaper.claro}
                  selected={prefs.fondo === wallpaper.id} onSelect={() => onChange({ fondo: wallpaper.id })} />
              ))}
            </div>
            {imagen ? (
              <TuImagenTile controls={imagen} selected={prefs.fondo === "imagen"} onSelect={() => onChange({ fondo: "imagen" })} />
            ) : (
              <span className="flex items-center gap-2 rounded-xl border border-dashed border-(--glass-line-strong) p-2 text-xs text-(--text-muted)">
                <Icon name="imagen" /> Tu imagen · pronto
              </span>
            )}
          </div>
          <Slider
            aria-label="Opacidad de los paneles"
            minValue={60}
            maxValue={98}
            step={2}
            value={prefs.opacidad}
            onChange={(value) => onChange({ opacidad: Array.isArray(value) ? (value[0] ?? prefs.opacidad) : value })}
            className="flex flex-col gap-2"
          >
            <span className="flex items-baseline justify-between">
              <span className={SECCION}>Opacidad de los paneles</span>
              <Slider.Output className="text-xs font-semibold text-(--text-primary) tabular-nums">{() => `${prefs.opacidad} %`}</Slider.Output>
            </span>
            <Slider.Track className="hubly-opacidad-pista h-1 w-full rounded-full">
              <Slider.Fill className="rounded-full bg-(--accent-primary)" />
              <Slider.Thumb className="hubly-opacidad-pomo size-4 rounded-full border-0" />
            </Slider.Track>
            <span aria-hidden="true" className="flex justify-between text-xs text-(--text-muted)"><span>Más cristal</span><span>Más sólido</span></span>
          </Slider>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

export const CaptureField = forwardRef<HTMLInputElement, CaptureFieldProps>(function CaptureField({ label, hint, shortcut, submitIcon, chips, linked, onSubmit, error }, ref) {
  const [text, setText] = useState("");
  const tokens = text.trim() ? chips(text) : [];
  const errorId = useId();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    onSubmit(text);
    setText("");
  };
  return (
    <form onSubmit={submit} className="relative flex min-w-0 grow items-center gap-1.5">
      {(tokens.length > 0 || linked) && (
        <div className="hubly-pop hubly-pop-surface absolute right-0 bottom-full left-0 mb-2 flex flex-wrap items-center gap-1 rounded-xl p-2">
          {linked && <Button size="sm" variant="secondary" onPress={linked.remove} aria-label={`Quitar el vínculo con la nota ${linked.label}`} className="min-h-(--dock-control)">Nota: {linked.label} ×</Button>}
          {tokens.map((chip) => <Chip key={chip.label} color={chip.color} variant="soft" size="sm">{chip.label}</Chip>)}
        </div>
      )}
      <label className="flex h-(--dock-control) min-w-0 grow items-center gap-2 rounded-xl border border-(--glass-line) bg-(--glass-field) px-3 focus-within:border-(--accent-primary)">
        <span className="sr-only">{label}</span>
        <input ref={ref} value={text} onChange={(event) => setText(event.target.value)} placeholder={hint} aria-describedby={error ? errorId : undefined}
          className="min-w-0 grow border-0 bg-transparent text-base text-(--text-primary) outline-none placeholder:text-(--text-muted) lg:text-sm" />
        <Kbd className="hidden shrink-0 xl:inline-flex"><Kbd.Content>{shortcut}</Kbd.Content></Kbd>
      </label>
      <Button type="submit" variant="primary" className="h-(--dock-control) shrink-0 gap-1 px-2">{submitIcon} Agregar</Button>
      {error && <span id={errorId} role="alert" className="sr-only">{error}</span>}
    </form>
  );
});

function Waiting({ waiting }: Pick<DockConfig, "waiting">) {
  return (
    <Popover>
      <Button variant="ghost" className="h-(--dock-control) shrink-0 gap-1 px-2 text-xs" aria-label={`Te esperan: ${waiting.detail}`}>
        <span>Te esperan <strong className="text-(--status-danger-text)">{waiting.items.length}</strong></span>
      </Button>
      <Popover.Content placement="top" className="hubly-pop-surface hubly-popover-scroll w-64 rounded-xl p-3">
        <Popover.Dialog aria-label="Pendientes que te esperan">
          <Popover.Heading className="text-sm font-semibold">Te esperan</Popover.Heading>
          {waiting.items.length ? <ul className="my-2 max-h-48 list-disc overflow-y-auto ps-5 text-sm">{waiting.items.map((item) => <li key={item.id}>{item.title}</li>)}</ul> : <p className="my-2 text-sm">Estás al día.</p>}
          <div className="flex flex-wrap gap-1">{waiting.filters.map((filter) => (
            <ToggleButton key={filter.label} variant="default" className="min-h-(--dock-control)" isSelected={filter.selected} onChange={filter.run}>{filter.label}</ToggleButton>
          ))}</div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function DockDetails({ config, sinVista = false }: { config: DockConfig; sinVista?: boolean }) {
  const name = useId();
  const { done, total } = config.pace;
  return (
    <>
      <Waiting waiting={config.waiting} />
      <div className={`shrink-0 items-center gap-1 text-xs text-(--text-secondary) ${sinVista ? "hidden xl:flex" : "flex"}`}>
        <svg viewBox="0 0 24 24" className="size-7 text-(--accent-primary)" aria-hidden="true" fill="none" strokeWidth={2.5}>
          <circle cx="12" cy="12" r="9" className="stroke-(--glass-line-strong)" />
          <circle cx="12" cy="12" r="9" pathLength="100" stroke="currentColor" strokeDasharray={`${total ? 100 * done / total : 0} 100`} transform="rotate(-90 12 12)" />
        </svg>
        <span className="lg:sr-only xl:not-sr-only">{config.pace.label}</span>
      </div>
      {!sinVista && <><div role="radiogroup" aria-label="Distribución" className="flex shrink-0 rounded-lg bg-(--glass-hover)">
        {config.views.map((view) => (
          <label key={view.id} title={view.label} className="cursor-pointer">
            <input type="radio" name={name} aria-label={view.label} checked={view.selected} onChange={view.run} className="peer sr-only" />
            <span className="flex size-(--dock-control) items-center justify-center rounded-md text-(--text-secondary) peer-checked:bg-(--surface-raised) peer-checked:text-(--accent-primary) peer-focus-visible:ring-2 peer-focus-visible:ring-(--accent-primary)"><Icon name={view.icon} /></span>
          </label>
        ))}
      </div>
      <span aria-live="polite" title={config.saved} className="shrink-0 text-xs text-(--text-secondary) lg:sr-only xl:not-sr-only">{config.saved}</span></>}
    </>
  );
}

function DockActions({ actions }: Pick<DockConfig, "actions">) {
  return actions.map((action) => (
    <button key={action.key} type="button" onClick={action.run} title={`${action.label} (${action.key})`} className="flex h-(--dock-control) shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-(--text-secondary) hover:bg-(--hover-acento) focus-visible:ring-2 focus-visible:ring-(--accent-primary)">
      <Icon name={action.icon} className="size-4 rounded-sm bg-(--icon-fill) text-(--accent-primary)" />{action.label}
    </button>
  ));
}

export function DockStatus({ suggestion }: { suggestion: DockSuggestion | null }) {
  if (!suggestion) return null;
  return (
    <div role="status" className="hubly-pop-surface relative mx-auto flex h-7.5 w-fit max-w-full items-center gap-2 rounded-t-xl px-3 text-xs text-(--text-primary)">
      <HubiFace className="size-5" />
      <span className="min-w-0 truncate">{suggestion.message}</span>
      {suggestion.action && <Button variant="ghost" onPress={suggestion.action.run} isDisabled={suggestion.action.pending ?? false} className="-mt-3.5 h-(--dock-control) min-h-(--dock-control) shrink-0 px-2 pt-3.5 text-xs text-(--accent-primary)">{suggestion.action.label}</Button>}
    </div>
  );
}

/** El marco elige la configuración. El dock solo presenta sus controles. */
/** `sinVista`: el modo de paneles, el guardado y el fondo van en la barra del lienzo (issue 147). */
export const Dock = forwardRef<HTMLInputElement, { config: DockConfig; extra?: ReactNode; sinVista?: boolean }>(function Dock({ config, extra, sinVista = false }, ref) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <DockStatus suggestion={config.suggestion ?? null} />
      {/* Dock en cápsulas separadas: acciones, captura y estado, cada una con su propio cristal. */}
      <div role="toolbar" aria-label={config.label} data-delay="3" className="hubly-enter flex max-w-full min-w-0 items-center gap-2">
        <div className={DOCK_GROUP}>
          <span className={`shrink-0 px-1.5 text-xs font-semibold ${sinVista ? "hidden xl:block" : ""}`}>{config.context}</span>
          <DockActions actions={config.actions} />
        </div>
        <div className={`${DOCK_GROUP} w-72 min-w-0 shrink 2xl:w-96`}>
          <CaptureField ref={ref} {...config.entry} />
        </div>
        <div className={DOCK_GROUP}>
          <DockDetails config={config} sinVista={sinVista} />
          {extra}
        </div>
      </div>
    </div>
  );
});

export function DockMore({ config, extra }: { config: DockConfig; extra?: ReactNode }) {
  return (
    <Popover>
      <Button variant="ghost" className="min-h-(--dock-control)">Más</Button>
      <Popover.Content placement="top" className="hubly-pop-surface hubly-popover-scroll w-72 rounded-xl p-3">
        <Popover.Dialog aria-label={`Más opciones · ${config.label}`} className="flex flex-wrap items-center gap-2">
          <DockDetails config={config} />
          <DockActions actions={config.actions} />
          {extra}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

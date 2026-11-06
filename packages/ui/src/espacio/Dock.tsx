"use client";

import { Button, Chip, Kbd, Popover, Slider, ToggleButton } from "@heroui/react";
import { forwardRef, useId, useState, type FormEvent, type ReactNode } from "react";
import { FileTrigger } from "react-aria-components";
import { HubiFace } from "../components/brand/HublyLogo";
import { useHublyTheme } from "../landing/ThemeToggle";
import { Icon } from "./icons";
import { WALLPAPERS, type EspacioPreferencias, type PreferenciasPatch } from "./preferencias";
import type { CaptureFieldProps, DockConfig, DockSuggestion } from "./dockConfig";
import { WallpaperSwatch } from "./Wallpaper";

const DOCK_BUTTON = "size-11 shrink-0 text-(--text-secondary) data-[hovered]:text-(--text-primary)";

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
}

/** Selector de fondo y opacidad de los paneles (#75, sección 3). «Tu imagen» llega con Storage (#84). */
export function BackgroundPicker({ imagen, prefs, onChange, isOpen, onOpenChange, triggerClassName, triggerLabel }: BackgroundPickerProps) {
  const [theme] = useHublyTheme();
  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button variant="ghost" isIconOnly={!triggerLabel} aria-label="Fondo" className={triggerClassName ?? DOCK_BUTTON}>
        <Icon name="imagen" className="size-5" />
        {triggerLabel && <span className="text-xs">{triggerLabel}</span>}
      </Button>
      <Popover.Content placement="top" className="hubly-pop-surface hubly-popover-scroll w-80 rounded-2xl p-4 text-(--text-primary)">
        <Popover.Dialog aria-label="Elegir fondo" className="hubly-sin-anillo flex flex-col gap-4 outline-none">
          <div className="flex items-baseline justify-between">
            <Popover.Heading className="m-0 text-sm font-semibold">Fondo de tu espacio</Popover.Heading>
            <span className="text-xs text-(--text-muted)">Solo lo ves tú</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {WALLPAPERS.map((wallpaper) => {
              const label = theme === "dark" ? wallpaper.oscuro : wallpaper.claro;
              return (
                <ToggleButton
                  key={wallpaper.id}
                  isSelected={prefs.fondo === wallpaper.id}
                  onChange={() => onChange({ fondo: wallpaper.id })}
                  className="h-auto w-full min-w-0 flex-col items-stretch justify-start text-center gap-1.5 rounded-xl border-2 border-transparent bg-transparent p-1 text-xs font-normal text-(--text-secondary) transition-transform data-[hovered]:-translate-y-0.5 data-[selected]:border-(--accent-primary) data-[selected]:bg-transparent data-[selected]:text-(--text-primary)"
                >
                  <WallpaperSwatch fondo={wallpaper.id} />
                  {label}
                </ToggleButton>
              );
            })}
            {imagen ? (
              <TuImagenTile controls={imagen} selected={prefs.fondo === "imagen"} onSelect={() => onChange({ fondo: "imagen" })} />
            ) : (
              <span className="flex flex-col gap-1.5 p-1 text-xs text-(--text-muted)">
                <span className="flex h-14 items-center justify-center rounded-lg border border-dashed border-(--glass-line-strong)">
                  <Icon name="imagen" />
                </span>
                Tu imagen · pronto
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
            <span className="flex justify-between text-xs text-(--text-secondary)">
              Opacidad de los paneles
              <Slider.Output className="font-semibold text-(--text-primary)">{() => `${prefs.opacidad} %`}</Slider.Output>
            </span>
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
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
    <form onSubmit={submit} className="relative flex min-w-44 grow items-center gap-2">
      {(tokens.length > 0 || linked) && (
        <div className="hubly-pop hubly-pop-surface absolute right-0 bottom-full left-0 mb-2 flex flex-wrap items-center gap-1 rounded-xl p-2">
          {linked && <Button size="sm" variant="secondary" onPress={linked.remove} aria-label={`Quitar el vínculo con la nota ${linked.label}`} className="min-h-11">Nota: {linked.label} ×</Button>}
          {tokens.map((chip) => <Chip key={chip.label} color={chip.color} variant="soft" size="sm">{chip.label}</Chip>)}
        </div>
      )}
      <label className="flex h-11 min-w-0 grow items-center gap-2 rounded-xl border border-(--glass-line) bg-(--glass-field) px-3 focus-within:border-(--accent-primary)">
        <span className="sr-only">{label}</span>
        <input ref={ref} value={text} onChange={(event) => setText(event.target.value)} placeholder={hint} aria-describedby={error ? errorId : undefined}
          className="min-w-0 grow border-0 bg-transparent text-base text-(--text-primary) outline-none placeholder:text-(--text-muted) lg:text-sm" />
        <Kbd className="hidden shrink-0 xl:inline-flex"><Kbd.Content>{shortcut}</Kbd.Content></Kbd>
      </label>
      <Button type="submit" variant="primary" className="h-11 shrink-0 gap-1 px-2">{submitIcon} Agregar</Button>
      {error && <span id={errorId} role="alert" className="sr-only">{error}</span>}
    </form>
  );
});

function Waiting({ waiting }: Pick<DockConfig, "waiting">) {
  return (
    <Popover>
      <Button variant="ghost" className="h-11 shrink-0 flex-col gap-0 px-1 text-xs" aria-label={`Te esperan: ${waiting.detail}`}>
        <span>Te esperan <strong className="text-(--status-danger-text)">{waiting.items.length}</strong></span>
        <span className="text-(--text-secondary)">{waiting.detail}</span>
      </Button>
      <Popover.Content placement="top" className="hubly-pop-surface hubly-popover-scroll w-64 rounded-xl p-3">
        <Popover.Dialog aria-label="Pendientes que te esperan">
          <Popover.Heading className="text-sm font-semibold">Te esperan</Popover.Heading>
          {waiting.items.length ? <ul className="my-2 max-h-48 list-disc overflow-y-auto ps-5 text-sm">{waiting.items.map((item) => <li key={item.id}>{item.title}</li>)}</ul> : <p className="my-2 text-sm">Estás al día.</p>}
          <div className="flex flex-wrap gap-1">{waiting.filters.map((filter) => (
            <ToggleButton key={filter.label} variant="default" className="min-h-11" isSelected={filter.selected} onChange={filter.run}>{filter.label}</ToggleButton>
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
            <span className="flex size-11 items-center justify-center rounded-md text-(--text-secondary) peer-checked:bg-(--surface-raised) peer-checked:text-(--accent-primary) peer-focus-visible:ring-2 peer-focus-visible:ring-(--accent-primary)"><Icon name={view.icon} /></span>
          </label>
        ))}
      </div>
      <span aria-live="polite" title={config.saved} className="shrink-0 text-xs text-(--text-secondary) lg:sr-only xl:not-sr-only">{config.saved}</span></>}
    </>
  );
}

function DockActions({ actions }: Pick<DockConfig, "actions">) {
  return actions.map((action) => (
    <button key={action.key} type="button" onClick={action.run} title={`${action.label} (${action.key})`} className="flex size-11 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg text-xs text-(--text-secondary) hover:bg-(--glass-hover) focus-visible:ring-2 focus-visible:ring-(--accent-primary)">
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
      {suggestion.action && <Button variant="ghost" onPress={suggestion.action.run} isDisabled={suggestion.action.pending ?? false} className="-mt-3.5 h-11 min-h-11 shrink-0 px-2 pt-3.5 text-xs text-(--accent-primary)">{suggestion.action.label}</Button>}
    </div>
  );
}

/** El marco elige la configuración. El dock solo presenta sus controles. */
/** `sinVista`: el modo de paneles, el guardado y el fondo van en la barra del lienzo (issue 147). */
export const Dock = forwardRef<HTMLInputElement, { config: DockConfig; extra?: ReactNode; sinVista?: boolean }>(function Dock({ config, extra, sinVista = false }, ref) {
  return (
    <div>
      <DockStatus suggestion={config.suggestion ?? null} />
      <div role="toolbar" aria-label={config.label} data-delay="3" className="hubly-glass hubly-enter flex h-(--frame-dock-h) w-full min-w-0 items-center gap-1 rounded-(--glass-radius-access-card) px-2">
        <span className={`w-16 shrink-0 px-1 text-xs font-semibold ${sinVista ? "hidden xl:block" : ""}`}>{config.context}</span>
        <DockActions actions={config.actions} />
        <CaptureField ref={ref} {...config.entry} />
        <DockDetails config={config} sinVista={sinVista} />
        {extra}
      </div>
    </div>
  );
});

export function DockMore({ config, extra }: { config: DockConfig; extra?: ReactNode }) {
  return (
    <Popover>
      <Button variant="ghost" className="min-h-11">Más</Button>
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

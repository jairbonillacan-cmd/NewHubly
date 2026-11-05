"use client";

import { Dropdown, Popover, Slider, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { forwardRef, useState, type FormEvent } from "react";
import type { Selection } from "react-aria-components";
import { useHublyTheme } from "../landing/ThemeToggle";
import { Icon, type IconName } from "./icons";
import { WALLPAPERS, type EspacioPreferencias, type LayoutId, type PanelId, type PreferenciasPatch } from "./preferencias";
import { PRIORITY_LABEL, type CaptureAnalysis, type EspacioNote } from "./types";
import { WallpaperSwatch } from "./Wallpaper";

const PANEL_LABEL: Record<PanelId, string> = { hoy: "Hoy", nota: "Nota abierta", notas: "Notas fijadas" };
const LAYOUTS: { id: LayoutId; label: string; icon: IconName }[] = [
  { id: "libre", label: "Paneles libres", icon: "libre" },
  { id: "lado", label: "Lado a lado", icon: "lado" },
  { id: "enfoque", label: "Modo enfoque", icon: "enfoque" },
];
const DOCK_BUTTON = "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-(--text-secondary) transition-colors hover:bg-(--glass-hover) hover:text-(--text-primary)";

export interface BackgroundPickerProps {
  prefs: EspacioPreferencias;
  onChange: (patch: PreferenciasPatch) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

/** Selector de fondo y opacidad de los paneles (#75, sección 3). «Tu imagen» llega con Storage (#84). */
export function BackgroundPicker({ prefs, onChange, isOpen, onOpenChange, triggerClassName, triggerLabel }: BackgroundPickerProps) {
  const [theme] = useHublyTheme();
  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger>
        <button type="button" aria-label="Fondo" title="Fondo" className={triggerClassName ?? DOCK_BUTTON}>
          <Icon name="imagen" className="size-5" />
          {triggerLabel && <span className="text-xs">{triggerLabel}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Content placement="top" className="hubly-pop-surface w-80 rounded-2xl p-4 text-(--text-primary)">
        <Popover.Dialog aria-label="Elegir fondo" className="flex flex-col gap-4 outline-none">
          <div className="flex items-baseline justify-between">
            <Popover.Heading className="m-0 text-sm font-semibold">Fondo de tu espacio</Popover.Heading>
            <span className="text-xs text-(--text-muted)">Solo lo ves tú</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {WALLPAPERS.map((wallpaper) => {
              const label = theme === "dark" ? wallpaper.oscuro : wallpaper.claro;
              return (
                <button
                  key={wallpaper.id}
                  type="button"
                  aria-pressed={prefs.fondo === wallpaper.id}
                  onClick={() => onChange({ fondo: wallpaper.id })}
                  className="flex cursor-pointer flex-col gap-1.5 rounded-xl border-2 border-transparent bg-transparent p-1 text-xs text-(--text-secondary) transition-transform hover:-translate-y-0.5 aria-pressed:border-(--accent-primary) aria-pressed:text-(--text-primary)"
                >
                  <WallpaperSwatch fondo={wallpaper.id} />
                  {label}
                </button>
              );
            })}
            <span className="flex flex-col gap-1.5 p-1 text-xs text-(--text-muted)">
              <span className="flex h-14 items-center justify-center rounded-lg border border-dashed border-(--glass-line-strong)">
                <Icon name="imagen" />
              </span>
              Tu imagen · pronto
            </span>
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

function PanelsMenu({ prefs, onChange }: { prefs: EspacioPreferencias; onChange: (patch: PreferenciasPatch) => void }) {
  const selected = (Object.keys(prefs.paneles) as PanelId[]).filter((id) => prefs.paneles[id]);
  const onSelectionChange = (selection: Selection) => {
    const keys = selection === "all" ? new Set<string>(["hoy", "nota", "notas"]) : new Set([...selection].map(String));
    onChange({ paneles: { hoy: keys.has("hoy"), nota: keys.has("nota"), notas: keys.has("notas") } });
  };
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label="Paneles visibles" className={DOCK_BUTTON}>
        <Icon name="paneles" className="size-5" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="top" className="hubly-pop-surface min-w-56 rounded-xl p-1.5 text-(--text-primary)">
        <Dropdown.Menu aria-label="Mostrar paneles" selectionMode="multiple" selectedKeys={selected} onSelectionChange={onSelectionChange}>
          {(Object.keys(PANEL_LABEL) as PanelId[]).map((id) => (
            <Dropdown.Item key={id} id={id} textValue={PANEL_LABEL[id]} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[focused]:bg-(--glass-hover)">
              <span className="grow">{PANEL_LABEL[id]}</span>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function LayoutSwitch({ value, onChange }: { value: LayoutId; onChange: (layout: LayoutId) => void }) {
  return (
    <ToggleButtonGroup
      aria-label="Distribución"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next === "libre" || next === "lado" || next === "enfoque") onChange(next);
      }}
      className="flex gap-0.5 rounded-lg bg-(--glass-hover) p-0.5"
    >
      {LAYOUTS.map((layout) => (
        <ToggleButton
          key={layout.id}
          id={layout.id}
          aria-label={layout.label}
          className="flex size-9 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-(--text-secondary) transition-colors data-[selected]:bg-(--surface-raised) data-[selected]:text-(--accent-primary) data-[selected]:shadow-sm"
        >
          <Icon name={layout.icon} />
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export interface CaptureFieldProps {
  notes: EspacioNote[];
  linkedNote: EspacioNote | null;
  onUnlinkNote: () => void;
  analyze: (text: string) => CaptureAnalysis;
  onSubmit: (text: string) => void;
  error?: string | null | undefined;
  className?: string | undefined;
}

export function findNoteByQuery(notes: EspacioNote[], query: string | null): EspacioNote | null {
  if (!query) return null;
  const q = query.toLowerCase();
  return notes.find((note) => !note.isArchived && note.title.toLowerCase().includes(q)) ?? null;
}

/** Captura inteligente (#80): las palabras clave se ven como etiquetas antes de guardar. */
export const CaptureField = forwardRef<HTMLInputElement, CaptureFieldProps>(function CaptureField({ notes, linkedNote, onUnlinkNote, analyze, onSubmit, error, className }, ref) {
  const [text, setText] = useState("");
  const analysis = text.trim() ? analyze(text) : null;
  const queryNote = findNoteByQuery(notes, analysis?.noteQuery ?? null);
  const chips: { label: string; tone: string }[] = [];
  if (analysis?.dueKeyword) chips.push({ label: analysis.dueKeyword === "hoy" ? "Hoy" : "Mañana", tone: "bg-(--accent-primary-subtle) text-(--accent-primary)" });
  if (analysis?.priority) chips.push({ label: PRIORITY_LABEL[analysis.priority], tone: "bg-(--status-warning-bg) text-(--status-warning-text)" });
  if (analysis?.noteQuery) chips.push(queryNote ? { label: `Nota: ${queryNote.title}`, tone: "bg-(--status-success-bg) text-(--status-success-text)" } : { label: `Sin nota «${analysis.noteQuery}»`, tone: "bg-(--glass-hover) text-(--text-muted)" });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    onSubmit(text);
    setText("");
  };

  return (
    <form onSubmit={submit} className={`flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <label className="flex h-11 min-w-0 grow items-center gap-2 rounded-xl border border-(--glass-line) bg-(--glass-field) px-3 transition-colors focus-within:border-(--accent-primary)">
        <Icon name="mas" className="size-4 shrink-0 text-(--accent-primary)" />
        <span className="sr-only">Capturar pendiente</span>
        <input
          ref={ref}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Captura… prueba «llamar a Lumen mañana !alta»"
          aria-describedby={error ? "captura-error" : undefined}
          className="min-w-0 grow border-0 bg-transparent text-base text-(--text-primary) outline-none placeholder:text-(--text-muted) lg:text-sm"
        />
        {linkedNote && (
          <button type="button" onClick={onUnlinkNote} title="Quitar vínculo" className="hubly-pop shrink-0 cursor-pointer rounded-full border-0 bg-(--status-success-bg) px-2 py-0.5 text-xs font-semibold text-(--status-success-text)">
            Nota: {linkedNote.title || "sin título"} ×
          </button>
        )}
        {chips.map((chip) => (
          <span key={chip.label} className={`hubly-pop hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold sm:inline ${chip.tone}`}>{chip.label}</span>
        ))}
        <kbd className="hidden shrink-0 rounded border border-(--glass-line-strong) px-1.5 text-xs font-semibold text-(--text-muted) lg:inline">C</kbd>
      </label>
      <button type="submit" className="h-11 shrink-0 cursor-pointer rounded-xl border-0 bg-(--accent-primary) px-4 text-sm font-semibold text-(--text-on-accent) transition-transform hover:bg-(--accent-primary-hover) active:scale-95">
        Agregar
      </button>
      {error && <span id="captura-error" role="alert" className="sr-only">{error}</span>}
    </form>
  );
});

export interface DockProps extends CaptureFieldProps {
  prefs: EspacioPreferencias;
  onPrefs: (patch: PreferenciasPatch) => void;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
}

/** Dock flotante de escritorio (#75): fondo, paneles, distribución y captura. */
export const Dock = forwardRef<HTMLInputElement, DockProps>(function Dock({ prefs, onPrefs, pickerOpen, onPickerOpenChange, ...capture }, ref) {
  return (
    <div className="hubly-glass hubly-enter flex w-full max-w-4xl items-center gap-1.5 rounded-2xl p-2" data-delay="3">
      <BackgroundPicker prefs={prefs} onChange={onPrefs} isOpen={pickerOpen} onOpenChange={onPickerOpenChange} />
      <PanelsMenu prefs={prefs} onChange={onPrefs} />
      <LayoutSwitch value={prefs.distribucion} onChange={(distribucion) => onPrefs({ distribucion })} />
      <span aria-hidden="true" className="mx-1 h-7 w-px bg-(--glass-line-strong)" />
      <CaptureField ref={ref} {...capture} className="grow" />
    </div>
  );
});

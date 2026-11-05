"use client";

import { Dropdown } from "@heroui/react";
import type { Key, Selection } from "react-aria-components";
import { HubiFace } from "../components/brand/HublyLogo";
import { useHublyTheme } from "../landing/ThemeToggle";
import { Icon } from "./icons";
import { longDateLabel, type HoyFilter, type NoteSaveState } from "./types";

export interface TopBarProps {
  todayDate: string;
  timezone?: string | undefined;
  overdueCount: number;
  todayCount: number;
  filter: HoyFilter;
  saveState: NoteSaveState;
  onFilter: (filter: HoyFilter) => void;
  onOpenPalette: () => void;
  onOpenBackground: () => void;
  onExport: (format: "json" | "md") => void;
  onSignOut: () => void;
}

const MENU = "hubly-pop-surface min-w-64 rounded-xl p-1.5 text-(--text-primary)";
const ITEM = "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[focused]:bg-(--glass-hover) data-[disabled]:cursor-default data-[disabled]:opacity-60";

const SAVE_CHIP: Record<NoteSaveState, { label: string; className: string }> = {
  saved: { label: "Todo guardado", className: "bg-(--status-success-bg) text-(--status-success-text)" },
  saving: { label: "Guardando…", className: "bg-(--glass-hover) text-(--text-secondary)" },
  error: { label: "Sin guardar", className: "bg-(--status-danger-bg) text-(--status-danger-text)" },
};

function SpaceMenu() {
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label="Cambiar de espacio" className="flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-sm font-semibold whitespace-nowrap text-(--text-primary) hover:bg-(--glass-hover)">
        <span aria-hidden="true" className="hidden size-5 items-center justify-center rounded-md bg-(--accent-primary) text-(--text-on-accent) sm:flex"><Icon name="usuario" className="size-3.5" /></span>
        Espacio personal
        <Icon name="chevrones" className="size-3.5 text-(--text-muted)" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start" className={MENU}>
        <Dropdown.Menu aria-label="Tus espacios" disabledKeys={["crear-agencia", "invitacion"]}>
          <Dropdown.Item id="personal" textValue="Espacio personal" className={ITEM}>
            <span className="grow">Espacio personal</span>
            <Icon name="check" className="size-4 text-(--accent-primary)" />
          </Dropdown.Item>
          <Dropdown.Item id="crear-agencia" textValue="Crear agencia" className={ITEM}>
            <Icon name="mas" /> <span className="grow">Crear agencia</span> <span className="text-xs text-(--text-muted)">Pronto</span>
          </Dropdown.Item>
          <Dropdown.Item id="invitacion" textValue="Aceptar una invitación" className={ITEM}>
            <Icon name="sobre" /> <span className="grow">Aceptar una invitación</span> <span className="text-xs text-(--text-muted)">Pronto</span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function AccountMenu({ timezone, onOpenBackground, onExport, onSignOut }: Pick<TopBarProps, "timezone" | "onOpenBackground" | "onExport" | "onSignOut">) {
  const [theme, setTheme] = useHublyTheme();
  const onAction = (key: Key) => {
    if (key === "fondo") onOpenBackground();
    else if (key === "json") onExport("json");
    else if (key === "md") onExport("md");
    else if (key === "salir") onSignOut();
  };
  const onTheme = (selection: Selection) => {
    const next = selection === "all" ? null : [...selection][0];
    if (next === "light" || next === "dark") setTheme(next);
  };
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label="Menú de tu cuenta" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--glass-line-strong) bg-(--glass-hover) text-(--text-primary) transition-transform hover:scale-105">
        <Icon name="usuario" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className={MENU}>
        <p className="m-0 px-2.5 pt-2 pb-1 text-sm font-semibold">Tu cuenta</p>
        {timezone && <p className="m-0 px-2.5 pb-2 text-xs text-(--text-muted)">Zona horaria: {timezone.replaceAll("_", " ")}</p>}
        <Dropdown.Menu aria-label="Opciones de tu cuenta" onAction={onAction}>
          <Dropdown.Section aria-label="Tema" selectionMode="single" selectedKeys={[theme]} onSelectionChange={onTheme} className="border-b border-(--glass-line) pb-1.5">
            <Dropdown.Item id="light" textValue="Tema claro" className={ITEM}>
              <span className="grow">Tema claro</span>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
            <Dropdown.Item id="dark" textValue="Tema oscuro" className={ITEM}>
              <span className="grow">Tema oscuro</span>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section aria-label="Acciones" className="pt-1.5">
            <Dropdown.Item id="fondo" textValue="Cambiar fondo" className={ITEM}><Icon name="imagen" /> Cambiar fondo</Dropdown.Item>
            <Dropdown.Item id="json" textValue="Exportar en JSON" className={ITEM}><Icon name="descargar" /> Exportar en JSON</Dropdown.Item>
            <Dropdown.Item id="md" textValue="Exportar en Markdown" className={ITEM}><Icon name="descargar" /> Exportar en Markdown</Dropdown.Item>
            <Dropdown.Item id="salir" textValue="Cerrar sesión" className={`${ITEM} text-(--status-danger-text)`}><Icon name="salir" /> Cerrar sesión</Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function FilterBadges({ overdueCount, todayCount, filter, onFilter }: Pick<TopBarProps, "overdueCount" | "todayCount" | "filter" | "onFilter">) {
  const badge = "h-7 shrink-0 cursor-pointer rounded-full border-2 px-2.5 text-xs font-semibold transition-transform active:scale-95";
  return (
    <div role="group" aria-label="Filtrar el panel Hoy" className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={filter === "vencidos"}
        onClick={() => onFilter(filter === "vencidos" ? null : "vencidos")}
        className={`${badge} bg-(--status-danger-bg) text-(--status-danger-text) ${filter === "vencidos" ? "border-(--status-danger-text)" : "border-transparent"}`}
      >
        <span key={overdueCount} className="hubly-pop inline-block">{overdueCount} {overdueCount === 1 ? "vencido" : "vencidos"}</span>
      </button>
      <button
        type="button"
        aria-pressed={filter === "hoy"}
        onClick={() => onFilter(filter === "hoy" ? null : "hoy")}
        className={`${badge} bg-(--accent-primary-subtle) text-(--accent-primary) ${filter === "hoy" ? "border-(--accent-primary)" : "border-transparent"}`}
      >
        <span key={todayCount} className="hubly-pop inline-block">{todayCount} para hoy</span>
      </button>
    </div>
  );
}

/** Barra superior flotante (#75): espacio, fecha, filtros, guardado, búsqueda y cuenta. En móvil se compacta. */
export function TopBar(props: TopBarProps) {
  const { todayDate, saveState, onOpenPalette } = props;
  const save = SAVE_CHIP[saveState];
  return (
    <div className="flex flex-col gap-2">
      <header className="hubly-glass hubly-enter flex h-13 items-center gap-2 rounded-xl pr-2 pl-3 lg:h-12 lg:gap-3">
        <a href="/" aria-label="Hubly, inicio" className="flex items-center">
          <HubiFace className="size-7" />
        </a>
        <span aria-hidden="true" className="hidden h-5 w-px bg-(--glass-line-strong) lg:block" />
        <SpaceMenu />
        <span aria-hidden="true" className="hidden text-sm text-(--text-muted) lg:inline">›</span>
        <h1 className="m-0 hidden text-sm font-semibold lg:block">Hoy</h1>
        <span className="hidden text-sm text-(--text-muted) first-letter:uppercase xl:inline">{longDateLabel(todayDate)}</span>
        <span className="grow" />
        <div className="hidden lg:block">
          <FilterBadges {...props} />
        </div>
        <span aria-live="polite" className={`hidden h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold lg:flex ${save.className}`}>
          {saveState === "saved" && <Icon name="check" className="size-3" strokeWidth={2.5} />}
          {save.label}
        </span>
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Buscar o ejecutar (Ctrl K)"
          className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-(--glass-line) bg-(--glass-field) px-2.5 text-sm text-(--text-muted) transition-colors hover:text-(--text-primary) lg:w-60"
        >
          <Icon name="buscar" />
          <span className="hidden grow text-left lg:inline">Buscar o ejecutar…</span>
          <kbd className="hidden rounded border border-(--glass-line-strong) px-1.5 text-xs font-semibold lg:inline">Ctrl K</kbd>
        </button>
        <AccountMenu {...props} />
      </header>
      <div className="flex items-center justify-between gap-2 px-1 lg:hidden">
        <FilterBadges {...props} />
        <span className="truncate text-xs text-(--text-muted) first-letter:uppercase">{longDateLabel(todayDate)}</span>
      </div>
    </div>
  );
}

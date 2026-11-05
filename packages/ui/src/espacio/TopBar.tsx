"use client";

import { Avatar, Button, Chip, Dropdown, Kbd, ToggleButton } from "@heroui/react";
import type { Key, Selection } from "react-aria-components";
import { HubiFace } from "../components/brand/HublyLogo";
import { useHublyTheme } from "../landing/ThemeToggle";
import { Icon } from "./icons";
import { ROLE_LABEL, longDateLabel, type EspacioWorkspace, type HoyFilter, type NoteSaveState } from "./types";

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
  workspaces: EspacioWorkspace[];
  activeWorkspace: EspacioWorkspace;
  onSelectWorkspace: (id: string) => void;
  onCreateAgency: () => void;
  onOpenTeam: () => void;
}

const MENU = "hubly-pop-surface min-w-64 rounded-xl p-1.5 text-(--text-primary)";
const ITEM = "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[focused]:bg-(--glass-hover) data-[disabled]:cursor-default data-[disabled]:opacity-60";

const SAVE_CHIP: Record<NoteSaveState, { label: string; color: "success" | "default" | "danger" }> = {
  saved: { label: "Todo guardado", color: "success" },
  saving: { label: "Guardando…", color: "default" },
  error: { label: "Sin guardar", color: "danger" },
};

function SpaceMenu({ workspaces, activeWorkspace, onSelectWorkspace, onCreateAgency, onOpenTeam }: Pick<TopBarProps, "workspaces" | "activeWorkspace" | "onSelectWorkspace" | "onCreateAgency" | "onOpenTeam">) {
  const isAgency = activeWorkspace.kind === "agency";
  const label = isAgency ? activeWorkspace.name : "Espacio personal";
  const onAction = (key: Key) => {
    if (key === "crear-agencia") onCreateAgency();
    else if (key === "equipo") onOpenTeam();
    else if (typeof key === "string" && key.startsWith("ws:")) onSelectWorkspace(key.slice(3));
  };
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={`Cambiar de espacio (actual: ${label})`} className="flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-sm font-semibold whitespace-nowrap text-(--text-primary) hover:bg-(--glass-hover)">
        <span aria-hidden="true" className="hidden size-5 items-center justify-center rounded-md bg-(--accent-primary) text-(--text-on-accent) sm:flex"><Icon name={isAgency ? "equipo" : "usuario"} className="size-3.5" /></span>
        <span className="max-w-40 truncate">{label}</span>
        <Icon name="chevrones" className="size-3.5 text-(--text-muted)" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start" className={MENU}>
        <Dropdown.Menu aria-label="Tus espacios" onAction={onAction}>
          <Dropdown.Section aria-label="Espacios" className="border-b border-(--glass-line) pb-1.5">
            {workspaces.map((ws) => (
              <Dropdown.Item key={ws.id} id={`ws:${ws.id}`} textValue={ws.kind === "personal" ? "Espacio personal" : ws.name} className={ITEM}>
                <Icon name={ws.kind === "personal" ? "usuario" : "equipo"} />
                <span className="grow truncate">{ws.kind === "personal" ? "Espacio personal" : ws.name}</span>
                {ws.kind === "agency" && <span className="text-xs text-(--text-muted)">{ROLE_LABEL[ws.role]}</span>}
                {ws.id === activeWorkspace.id && <Icon name="check" className="size-4 text-(--accent-primary)" />}
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
          <Dropdown.Section aria-label="Agencias" className="pt-1.5">
            {isAgency ? <Dropdown.Item id="equipo" textValue="Equipo e invitaciones" className={ITEM}><Icon name="equipo" /> <span className="grow">Equipo e invitaciones</span></Dropdown.Item> : null}
            <Dropdown.Item id="crear-agencia" textValue="Crear agencia" className={ITEM}><Icon name="mas" /> <span className="grow">Crear agencia</span></Dropdown.Item>
          </Dropdown.Section>
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
      <Dropdown.Trigger aria-label="Menú de tu cuenta" className="size-9 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 transition-transform data-[hovered]:scale-105">
        <Avatar size="sm" color="accent" variant="soft">
          <Avatar.Fallback><Icon name="usuario" /></Avatar.Fallback>
        </Avatar>
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
  const badge = "h-7 min-w-0 rounded-full border-2 border-transparent px-2.5 text-xs font-semibold";
  return (
    <div role="group" aria-label="Filtrar el panel Hoy" className="flex items-center gap-2">
      <ToggleButton
        size="sm"
        isSelected={filter === "vencidos"}
        onChange={(on) => onFilter(on ? "vencidos" : null)}
        className={`${badge} bg-(--status-danger-bg) text-(--status-danger-text) data-[selected]:border-(--status-danger-text) data-[selected]:bg-(--status-danger-bg)`}
      >
        <span key={overdueCount} className="hubly-pop inline-block">{overdueCount} {overdueCount === 1 ? "vencido" : "vencidos"}</span>
      </ToggleButton>
      <ToggleButton
        size="sm"
        isSelected={filter === "hoy"}
        onChange={(on) => onFilter(on ? "hoy" : null)}
        className={`${badge} bg-(--accent-primary-subtle) text-(--accent-primary) data-[selected]:border-(--accent-primary) data-[selected]:bg-(--accent-primary-subtle)`}
      >
        <span key={todayCount} className="hubly-pop inline-block">{todayCount} para hoy</span>
      </ToggleButton>
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
        <SpaceMenu {...props} />
        <span aria-hidden="true" className="hidden text-sm text-(--text-muted) lg:inline">›</span>
        <h1 className="m-0 hidden text-sm font-semibold lg:block">Hoy</h1>
        <span className="hidden text-sm text-(--text-muted) first-letter:uppercase xl:inline">{longDateLabel(todayDate)}</span>
        <span className="grow" />
        <div className="hidden lg:block">
          <FilterBadges {...props} />
        </div>
        <span aria-live="polite" className="hidden lg:inline-flex">
          <Chip color={save.color} variant="soft" size="sm">
            {saveState === "saved" && <Icon name="check" className="size-3" strokeWidth={2.5} />}
            {save.label}
          </Chip>
        </span>
        <Button variant="tertiary" size="sm" onPress={onOpenPalette} aria-label="Buscar o ejecutar (Ctrl K)" className="text-(--text-muted) lg:w-60 lg:justify-start">
          <Icon name="buscar" />
          <span className="hidden grow text-left lg:inline">Buscar o ejecutar…</span>
          <Kbd className="hidden lg:inline-flex"><Kbd.Abbr keyValue="ctrl" /><Kbd.Content>K</Kbd.Content></Kbd>
        </Button>
        <AccountMenu {...props} />
      </header>
      <div className="flex items-center justify-between gap-2 px-1 lg:hidden">
        <FilterBadges {...props} />
        <span className="truncate text-xs text-(--text-muted) first-letter:uppercase">{longDateLabel(todayDate)}</span>
      </div>
    </div>
  );
}

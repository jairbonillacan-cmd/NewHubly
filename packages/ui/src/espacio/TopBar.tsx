"use client";

import { Button, Chip, Dropdown, Kbd, Popover, ToggleButton, Tooltip } from "@heroui/react";
import type { ReactNode } from "react";
import { FileTrigger, type Key, type Selection } from "react-aria-components";
import { HubiFace } from "../components/brand/HublyLogo";
import { useHublyTheme, useHublyThemePreference } from "../landing/ThemeToggle";
import { Icon, type IconName } from "./icons";
import type { Shortcut } from "./dockConfig";
import { AVATAR_TYPES, Avatar } from "./PerfilDialog";
import type { PanelId } from "./preferencias";
import { ROLE_LABEL, longDateLabel, type EspacioWorkspace } from "./types";

export interface TopBarProps {
  todayDate: string;
  timezone?: string | undefined;
  shortcuts: readonly Shortcut[];
  onOpenPalette: () => void;
  onOpenBackground: () => void;
  onExport: (format: "json" | "md") => void;
  onSignOut: () => void;
  workspaces: EspacioWorkspace[];
  activeWorkspace: EspacioWorkspace;
  onSelectWorkspace: (id: string) => void;
  onCreateAgency: () => void;
  onOpenTeam: () => void;
  /** Herramienta abierta en el carril; su nombre va junto al espacio. */
  toolName: string;
  /** Paneles visibles de Hoy; se encienden y se apagan desde Ajustes. */
  panels: Record<PanelId, boolean>;
  onTogglePanel: (id: PanelId) => void;
  /** «Modo enfoque» del espacio (#79): el grupo de controles lo activa y lo desactiva. */
  focusMode: boolean;
  onToggleFocus: () => void;
  /** Correo de la sesión: da la inicial del avatar. */
  userEmail?: string | null | undefined;
  /** Nombre visible y foto (issue 135); sin `onEditProfile`, editar sale como «Muy pronto». */
  userName?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  avatarBusy?: boolean | undefined;
  onEditProfile?: (() => void) | undefined;
  onPickAvatar?: ((file: File) => void) | undefined;
}

const MENU = "hubly-pop-surface min-w-64 rounded-xl p-1.5 text-(--text-primary)";
const ITEM = "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[focused]:bg-(--glass-hover) data-[disabled]:cursor-default data-[disabled]:opacity-60";

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
              <Dropdown.Item key={ws.id} id={`ws:${ws.id}`} textValue={ws.kind === "personal" ? "Espacio personal" : ws.name}
                {...(ws.id === activeWorkspace.id ? { "aria-label": `${label} (activo)${isAgency ? `, ${ROLE_LABEL[ws.role]}` : ""}` } : {})} className={ITEM}>
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

const initialOf = (email: string | null | undefined) => email?.trim().charAt(0).toUpperCase() || null;

/** Nombre guardado o, sin él, uno derivado del correo, sin inventar datos. */
export function profileName(email: string | null | undefined, saved?: string | null): string {
  if (saved?.trim()) return saved.trim();
  const local = email?.split("@")[0]?.trim();
  if (!local) return "Tu cuenta";
  return local.split(/[._-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function AccountMenu({ timezone, userEmail, userName, avatarUrl, avatarBusy, onEditProfile, onPickAvatar, shortcuts, onExport, onSignOut }: Pick<TopBarProps, "timezone" | "userEmail" | "userName" | "avatarUrl" | "avatarBusy" | "onEditProfile" | "onPickAvatar" | "shortcuts" | "onExport" | "onSignOut">) {
  const initial = initialOf(userName || userEmail);
  const pick = (files: FileList | null) => { const file = files?.[0]; if (file) onPickAvatar?.(file); };
  const photoLabel = avatarUrl ? "Cambiar foto" : "Subir foto";
  const [preference, , setThemePreference] = useHublyThemePreference();
  const onAction = (key: Key) => {
    if (key === "json") onExport("json");
    else if (key === "md") onExport("md");
    else if (key === "salir") onSignOut();
    else if (key === "editar") onEditProfile?.();
  };
  const onTheme = (selection: Selection) => {
    if (selection === "all") return;
    const next = [...selection][0];
    if (next === "light" || next === "dark" || next === "system") setThemePreference(next);
  };
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label="Menú de tu cuenta" className="relative size-11 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 transition-transform data-[hovered]:scale-105">
        <Avatar url={avatarUrl ?? null} initial={initial} className="size-11 text-base" />
        <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 flex size-4.5 items-center justify-center rounded-full border-2 border-(--surface-raised) bg-(--surface-raised) text-(--text-primary)">
          <Icon name="lapiz" className="size-2.5" strokeWidth={2.5} />
        </span>
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className={`${MENU} w-80`}>
        <div className="flex flex-col gap-3 border-b border-(--glass-line) px-2.5 pt-2 pb-3">
          <div className="flex items-start gap-3">
            <span className="relative shrink-0">
              <Avatar url={avatarUrl ?? null} initial={initial} className="size-16 text-2xl" iconClassName="size-7" />
              {onPickAvatar ? (
                <FileTrigger acceptedFileTypes={AVATAR_TYPES} onSelect={pick}>
                  <Button isIconOnly isDisabled={avatarBusy === true} aria-label={photoLabel} className="absolute -right-1 -bottom-1 size-11 rounded-full border-2 border-(--surface-raised) bg-(--surface-raised) text-(--text-secondary)">
                    <Icon name="camara" className="size-4" />
                  </Button>
                </FileTrigger>
              ) : (
                <Button isIconOnly isDisabled aria-label="Cambiar foto, muy pronto" className="absolute -right-1 -bottom-1 size-11 rounded-full border-2 border-(--surface-raised) bg-(--surface-raised) text-(--text-secondary)">
                  <Icon name="camara" className="size-4" />
                </Button>
              )}
            </span>
            <div className="min-w-0 grow pt-1">
              <p className="m-0 truncate text-sm font-semibold">{profileName(userEmail, userName)}</p>
              {userEmail && <p className="m-0 truncate text-xs text-(--text-secondary)">{userEmail}</p>}
              {timezone && <p className="m-0 truncate text-xs text-(--text-muted)">Zona horaria: {timezone.replaceAll("_", " ")}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onPickAvatar ? (
              <FileTrigger acceptedFileTypes={AVATAR_TYPES} onSelect={pick}>
                <Button size="sm" variant="secondary" isDisabled={avatarBusy === true} className="min-h-11">{avatarBusy ? "Subiendo…" : photoLabel}</Button>
              </FileTrigger>
            ) : (
              <>
                <Button size="sm" variant="secondary" isDisabled aria-label="Cambiar foto, muy pronto" className="min-h-11">Cambiar foto</Button>
                <Chip size="sm" variant="soft">Muy pronto</Chip>
              </>
            )}
          </div>
        </div>
        <Dropdown.Menu aria-label="Menú de tu perfil" onAction={onAction} className="pt-1.5">
          <Dropdown.Section aria-label="Perfil">
            {onEditProfile ? (
              <Dropdown.Item id="editar" textValue="Editar perfil" className={ITEM}><Icon name="lapiz" /> <span className="grow">Editar perfil</span></Dropdown.Item>
            ) : (
              <Dropdown.Item id="editar" isDisabled textValue="Editar perfil" aria-label="Editar perfil, muy pronto" className={ITEM}>
                <Icon name="lapiz" /> <span className="grow">Editar perfil</span><span className="text-xs text-(--text-muted)">Muy pronto</span>
              </Dropdown.Item>
            )}
          </Dropdown.Section>
          <Dropdown.Section aria-label="Tema" selectionMode="single" selectedKeys={[preference]} onSelectionChange={onTheme} className="border-y border-(--glass-line) py-1.5">
            <Dropdown.Item id="light" textValue="Tema claro" className={ITEM}><span className="grow">Claro</span>{preference === "light" && <Icon name="check" className="size-4 text-(--accent-primary)" />}</Dropdown.Item>
            <Dropdown.Item id="dark" textValue="Tema oscuro" className={ITEM}><span className="grow">Oscuro</span>{preference === "dark" && <Icon name="check" className="size-4 text-(--accent-primary)" />}</Dropdown.Item>
            <Dropdown.Item id="system" textValue="Tema del sistema" className={ITEM}><span className="grow">Sistema</span>{preference === "system" && <Icon name="check" className="size-4 text-(--accent-primary)" />}</Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section aria-label="Tus datos" className="pt-1.5">
            <Dropdown.Item id="json" textValue="Exportar mis datos en JSON" className={ITEM}><Icon name="descargar" /> <span className="grow">Exportar mis datos (JSON)</span></Dropdown.Item>
            <Dropdown.Item id="md" textValue="Exportar mis datos en Markdown" className={ITEM}><Icon name="descargar" /> <span className="grow">Exportar mis datos (Markdown)</span></Dropdown.Item>
            <Dropdown.SubmenuTrigger>
              <Dropdown.Item id="atajos" textValue="Atajos de teclado" className={ITEM}>
                <Icon name="teclado" /> <span className="grow">Atajos de teclado</span><Dropdown.SubmenuIndicator />
              </Dropdown.Item>
              <Dropdown.Popover placement="right top" className={MENU}>
                <Dropdown.Menu aria-label="Atajos de teclado">
                  {shortcuts.map((shortcut) => (
                    <Dropdown.Item key={shortcut.key} id={`atajo:${shortcut.key}`} isDisabled textValue={`${shortcut.label}: ${shortcut.key}`} className={ITEM}>
                      <span className="grow">{shortcut.label}</span>
                      <Kbd><Kbd.Content>{shortcut.key}</Kbd.Content></Kbd>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.SubmenuTrigger>
          </Dropdown.Section>
          <Dropdown.Section aria-label="Sesión" className="border-t border-(--glass-line) pt-1.5">
            <Dropdown.Item id="salir" textValue="Cerrar sesión" className={`${ITEM} text-(--status-danger-text)`}><Icon name="salir" /> Cerrar sesión</Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

const CONTROL = "size-11 min-w-11 text-(--text-secondary) data-[hovered]:text-(--text-primary)";

/** Botón de icono del grupo de controles, con su nombre en el tooltip. */
function Control({ icon, label, onPress, pressed }: { icon: IconName; label: string; onPress?: () => void; pressed?: boolean }) {
  return (
    <Tooltip delay={400}>
      {pressed === undefined ? (
        <Button isIconOnly variant="ghost" aria-label={label} onPress={() => onPress?.()} className={CONTROL}><Icon name={icon} className="size-5" /></Button>
      ) : (
        <ToggleButton isIconOnly variant="ghost" aria-label={label} isSelected={pressed} onChange={() => onPress?.()}
          className={`${CONTROL} data-[selected]:bg-(--accent-primary-subtle) data-[selected]:text-(--accent-primary)`}>
          <Icon name={icon} className="size-5" />
        </ToggleButton>
      )}
      <Tooltip.Content placement="bottom">{label}</Tooltip.Content>
    </Tooltip>
  );
}

/** Botón de icono que abre una ventanita (avisos y ayuda). */
function ControlPopover({ icon, label, title, children }: { icon: IconName; label: string; title: string; children: ReactNode }) {
  return (
    <Popover>
      <Popover.Trigger>
        <Button isIconOnly variant="ghost" aria-label={label} className={CONTROL}><Icon name={icon} className="size-5" /></Button>
      </Popover.Trigger>
      <Popover.Content placement="bottom end" className="hubly-pop-surface w-72 rounded-2xl p-4 text-(--text-primary)">
        <Popover.Dialog aria-label={title} className="flex flex-col gap-3 outline-none">
          <Popover.Heading className="m-0 text-sm font-semibold">{title}</Popover.Heading>
          {children}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

const PANELES: { id: PanelId; label: string; icon: IconName }[] = [
  { id: "hoy", label: "Panel Hoy", icon: "hoy" },
  { id: "nota", label: "Panel Nota abierta", icon: "nota" },
  { id: "notas", label: "Panel Notas fijadas", icon: "pin" },
];

/** Grupo de controles de la barra superior (#105, sección 2), en el orden de la maqueta. */
function Controls({ focusMode, onToggleFocus, onOpenPalette, onOpenBackground, onExport, panels, onTogglePanel, shortcuts }: Pick<TopBarProps, "focusMode" | "onToggleFocus" | "onOpenPalette" | "onOpenBackground" | "onExport" | "panels" | "onTogglePanel" | "shortcuts">) {
  const [theme, setTheme] = useHublyTheme();
  return (
    <div role="toolbar" aria-label="Controles del espacio" className="flex items-center gap-0.5">
      <Button variant="ghost" onPress={onOpenPalette} aria-label="Buscar o ejecutar (Ctrl K)" className="h-11 gap-2 px-3 text-sm text-(--text-secondary) data-[hovered]:text-(--text-primary)">
        <Icon name="buscar" className="size-5" />
        <span className="hidden lg:inline">Buscar</span>
        <Kbd className="hidden lg:inline-flex"><Kbd.Abbr keyValue="ctrl" /><Kbd.Content>K</Kbd.Content></Kbd>
      </Button>
      <ToggleButton isSelected={focusMode} onChange={onToggleFocus}
        className="hidden h-11 gap-2 rounded-xl border-0 bg-transparent px-3 text-sm font-semibold text-(--text-secondary) data-[hovered]:text-(--text-primary) data-[selected]:bg-(--accent-primary-subtle) data-[selected]:text-(--accent-primary) lg:inline-flex">
        <Icon name="enfoque" className="size-5" /> Enfoque
      </ToggleButton>
      <span aria-hidden="true" className="mx-1.5 hidden h-6 w-px bg-(--glass-line-strong) lg:block" />
      <div className="hidden items-center gap-0.5 lg:flex">
        <ControlPopover icon="campana" label="Avisos" title="Avisos">
          <p className="m-0 text-sm text-(--text-secondary)">Aquí llegarán los avisos de tu espacio.</p>
          <Chip size="sm" variant="soft" className="self-start">Próximamente</Chip>
        </ControlPopover>
        <Control icon={theme === "dark" ? "sol" : "luna"} label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} onPress={() => setTheme(theme === "dark" ? "light" : "dark")} />
        <ControlPopover icon="ayuda" label="Ayuda y atajos" title="Atajos de teclado">
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {shortcuts.map((shortcut) => (
              <li key={shortcut.key} className="flex items-center justify-between gap-3">
                <span className="text-(--text-secondary)">{shortcut.label}</span>
                <span className="flex gap-1"><Kbd><Kbd.Content>{shortcut.key}</Kbd.Content></Kbd></span>
              </li>
            ))}
          </ul>
        </ControlPopover>
        <Dropdown>
          <Dropdown.Trigger aria-label="Ajustes" className={`flex cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent hover:bg-(--glass-hover) ${CONTROL}`}>
            <Icon name="ajustes" className="size-5" />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" className={MENU}>
            <Dropdown.Menu aria-label="Ajustes del espacio" onAction={(key) => { if (key === "fondo") onOpenBackground(); else if (key === "json" || key === "md") onExport(key); }}>
              <Dropdown.Section aria-label="Paneles de Hoy" selectionMode="multiple" selectedKeys={PANELES.filter((panel) => panels[panel.id]).map((panel) => panel.id)}
                onSelectionChange={(selection) => {
                  if (selection === "all") return;
                  const changed = PANELES.find((panel) => selection.has(panel.id) !== panels[panel.id]);
                  if (changed) onTogglePanel(changed.id);
                }} className="border-b border-(--glass-line) pb-1.5">
                {PANELES.map((panel) => (
                  <Dropdown.Item key={panel.id} id={panel.id} textValue={panel.label} className={ITEM}>
                    <Icon name={panel.icon} /> <span className="grow">{panel.label}</span>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                ))}
              </Dropdown.Section>
              <Dropdown.Section aria-label="Acciones" className="pt-1.5">
                <Dropdown.Item id="fondo" textValue="Cambiar fondo" className={ITEM}><Icon name="imagen" /> Cambiar fondo</Dropdown.Item>
                <Dropdown.Item id="json" textValue="Exportar en JSON" className={ITEM}><Icon name="descargar" /> Exportar en JSON</Dropdown.Item>
                <Dropdown.Item id="md" textValue="Exportar en Markdown" className={ITEM}><Icon name="descargar" /> Exportar en Markdown</Dropdown.Item>
              </Dropdown.Section>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </div>
  );
}

/** Barra superior fija (#105): Hubi, espacio, herramienta activa y fecha; a la derecha, los controles y el avatar. */
export function TopBar(props: TopBarProps) {
  const { todayDate } = props;
  return (
    <div className="flex flex-col gap-2">
      <header className="hubly-glass hubly-enter flex h-14 items-center gap-2 rounded-(--glass-radius-access-bar) pr-1.5 pl-3 lg:gap-3">
        <a href="/" aria-label="Hubly, inicio" className="flex min-h-11 items-center">
          <HubiFace className="size-7" />
        </a>
        <SpaceMenu {...props} />
        <span aria-hidden="true" className="hidden text-sm text-(--text-muted) lg:inline">/</span>
        <h1 className="m-0 text-sm font-semibold">{props.toolName}</h1>
        <span className="hidden text-sm text-(--text-muted) first-letter:uppercase 2xl:inline">{longDateLabel(todayDate)}</span>
        <span className="grow" />
        <Controls {...props} />
        <AccountMenu {...props} />
      </header>
    </div>
  );
}

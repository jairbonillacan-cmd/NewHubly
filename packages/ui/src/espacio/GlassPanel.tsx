import { Button, ToggleButton, Tooltip } from "@heroui/react";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export interface GlassPanelProps {
  id?: string;
  title: string;
  icon: IconName;
  actions?: ReactNode;
  onClose?: (() => void) | undefined;
  children: ReactNode;
  className?: string | undefined;
  /** Escalón de la animación de entrada (0 a 4). */
  retraso?: 0 | 1 | 2 | 3 | 4;
}

/** Panel de cristal con cabecera (icono, título, acciones y cerrar), como en la propuesta B (#75, sección 1). */
export function GlassPanel({ id, title, icon, actions, onClose, children, className, retraso = 0 }: GlassPanelProps) {
  const headingId = id ? `${id}-titulo` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-delay={retraso || undefined}
      className={`hubly-glass hubly-enter flex min-h-0 flex-col overflow-hidden rounded-2xl text-(--text-primary) ${className ?? ""}`}
    >
      <div data-lienzo-asa className="flex items-center gap-2.5 border-b border-(--glass-line) py-2.5 pr-2.5 pl-3.5">
        <span className="text-(--accent-primary)">
          <Icon name={icon} />
        </span>
        <h2 id={headingId} className="m-0 grow truncate text-sm font-semibold">
          {title}
        </h2>
        {actions}
        {onClose && <IconButton icon="cerrar" label={`Cerrar el panel ${title}`} onPress={onClose} />}
      </div>
      <div className="min-h-0 grow overflow-y-auto">{children}</div>
    </section>
  );
}

/** Botón de icono del espacio: Button de HeroUI (o ToggleButton si alterna) con Tooltip que repite la etiqueta. */
export function IconButton({ icon, label, onPress, pressed, className }: { icon: IconName; label: string; onPress: () => void; pressed?: boolean | undefined; className?: string | undefined }) {
  const tone = "text-(--text-secondary) data-[hovered]:text-(--text-primary)";
  return (
    <Tooltip delay={400}>
      {pressed === undefined ? (
        <Button isIconOnly size="sm" variant="ghost" aria-label={label} onPress={onPress} className={`${tone} ${className ?? ""}`}>
          <Icon name={icon} />
        </Button>
      ) : (
        <ToggleButton
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={label}
          isSelected={pressed}
          onChange={onPress}
          className={`${tone} data-[selected]:bg-(--accent-primary-subtle) data-[selected]:text-(--accent-primary) ${className ?? ""}`}
        >
          <Icon name={icon} />
        </ToggleButton>
      )}
      <Tooltip.Content placement="right">{label}</Tooltip.Content>
    </Tooltip>
  );
}

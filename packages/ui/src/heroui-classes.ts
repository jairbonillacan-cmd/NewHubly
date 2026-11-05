import { buttonVariants, chipVariants } from "@heroui/styles";

// Clases de HeroUI para elementos que no pueden ser su componente (por ejemplo, un <a> con aspecto de botón).

type ButtonVariant = "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "danger" | "danger-soft";
type Size = "sm" | "md" | "lg";

/** Enlace con el aspecto exacto de un Button de HeroUI. */
export function buttonLinkClass(variant: ButtonVariant = "primary", size: Size = "md", extra = ""): string {
  return `${buttonVariants({ variant, size })} no-underline ${extra}`.trim();
}

type ChipColor = "accent" | "danger" | "default" | "success" | "warning";
type ChipVariant = "primary" | "secondary" | "soft" | "tertiary";

/** Etiqueta no interactiva con el aspecto de un Chip de HeroUI (para insignias dentro de otros controles). */
export function chipClass(color: ChipColor = "default", variant: ChipVariant = "soft", size: Size = "sm", extra = ""): string {
  return `${chipVariants({ color, variant, size }).base()} ${extra}`.trim();
}

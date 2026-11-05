// Catálogo tipado de tokens semánticos de Hubly (Fase 0 / 1A / 1B).
export { tokens, type DesignTokens } from "./tokens";

// Primitivas reales de HeroUI v3 OSS reexportadas desde @hubly/ui (ADR 0006, Issue #47)
export { Button, Card, Checkbox, Chip, EmptyState, Input, Kbd, Label, SearchField, Switch, Tabs, TextArea, TextField } from "@heroui/react";
export type { ButtonProps, CardProps, CheckboxProps, ChipProps, EmptyStateProps, InputProps, KbdProps, SwitchProps, TabsProps, TextAreaProps, TextFieldProps } from "@heroui/react";

// Identidad de marca: logo Secuencia (SVG) y mascota Hubi reactiva a tema (Issue #53)
export * from "./components/brand/HublyLogo";
export * from "./components/brand/Hubi";

// Tema y clases de HeroUI para enlaces con aspecto de botón y etiquetas
export * from "./landing/ThemeToggle";
export * from "./heroui-classes";

// Bloques del landing de marketing (Issue #85)
export * from "./landing/LandingNav";
export * from "./landing/LandingHero";
export * from "./landing/AppPreview";
export * from "./landing/Reveal";
export * from "./landing/FeatureGrid";
export * from "./landing/LandingSections";
export * from "./landing/LegalPage";

// Espacio de Hoy con paneles de cristal sobre fondo personal (propuesta B, #75)
export * from "./espacio";

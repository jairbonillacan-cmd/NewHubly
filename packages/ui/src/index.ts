// Catálogo tipado de tokens semánticos de Hubly (Fase 0 / 1A / 1B).
export { tokens, type DesignTokens } from "./tokens";

// Primitivas reales de HeroUI v3 OSS reexportadas desde @hubly/ui (ADR 0006, Issue #47)
export { Button, Card, Checkbox, Chip, EmptyState, Input, Kbd, Label, SearchField, Switch, Tabs, TextArea, TextField } from "@heroui/react";
export type { ButtonProps, CardProps, CheckboxProps, ChipProps, EmptyStateProps, InputProps, KbdProps, SwitchProps, TabsProps, TextAreaProps, TextFieldProps } from "@heroui/react";

// Identidad de marca: logo Secuencia (SVG) y mascota Hubi reactiva a tema (Issue #53)
export * from "./components/brand/HublyLogo";
export * from "./components/brand/Hubi";

// Primitivas visuales base de las páginas públicas (Issue #8)
export * from "./landing/GlassCard";
export * from "./landing/ThemeToggle";
export * from "./landing/PillNav";

// Bloques del landing de marketing (Issue #85)
export * from "./landing/LandingNav";
export * from "./landing/LandingHero";
export * from "./landing/AppPreview";
export * from "./landing/Reveal";
export * from "./landing/FeatureGrid";
export * from "./landing/LandingSections";

// Componentes de Notas y Pendientes de Fase 1A con dirección visual y HeroUI (Issues #26 y #47)
export * from "./components/notes/NoteEditorCard";
export * from "./components/todos/QuickCaptureBar";
export * from "./components/todos/TodoItemCard";
export * from "./components/workspace/ViewSelector";
export * from "./components/workspace/WorkspaceEmptyState";

// Catálogo tipado de tokens semánticos de Hubly (Fase 0 / 1A).
// Las pantallas y componentes solo consumen variables CSS a través de estos tokens (Constitución #6).

export const tokens = {
  color: {
    surfaceCanvas: "var(--surface-canvas)",
    surfaceRaised: "var(--surface-raised)",
    surfaceSubtle: "var(--surface-subtle)",
    surfaceInteractive: "var(--surface-interactive)",
    textPrimary: "var(--text-primary)",
    textSecondary: "var(--text-secondary)",
    textMuted: "var(--text-muted)",
    textOnAccent: "var(--text-on-accent)",
    borderSubtle: "var(--border-subtle)",
    borderDefault: "var(--border-default)",
    borderControl: "var(--border-control)",
    borderStrong: "var(--border-strong)",
    accentPrimary: "var(--accent-primary)",
    accentPrimaryHover: "var(--accent-primary-hover)",
    statusSuccessBg: "var(--status-success-bg)",
    statusSuccessText: "var(--status-success-text)",
    statusWarningBg: "var(--status-warning-bg)",
    statusWarningText: "var(--status-warning-text)",
    statusDangerBg: "var(--status-danger-bg)",
    statusDangerText: "var(--status-danger-text)",
  },
  font: {
    sans: "var(--font-sans)",
    mono: "var(--font-mono)",
    size: { xs: "var(--text-xs)", sm: "var(--text-sm)", base: "var(--text-base)", lg: "var(--text-lg)", xl: "var(--text-xl)", "2xl": "var(--text-2xl)" },
    leading: { tight: "var(--leading-tight)", normal: "var(--leading-normal)", relaxed: "var(--leading-relaxed)" },
    weight: { regular: "var(--weight-regular)", medium: "var(--weight-medium)", semibold: "var(--weight-semibold)" },
  },
  space: {
    0: "var(--space-0)",
    1: "var(--space-1)",
    2: "var(--space-2)",
    3: "var(--space-3)",
    4: "var(--space-4)",
    5: "var(--space-5)",
    6: "var(--space-6)",
    8: "var(--space-8)",
    10: "var(--space-10)",
    12: "var(--space-12)",
  },
  radius: { sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)" },
  border: { thin: "var(--border-width-thin)" },
  focus: { ringColor: "var(--focus-ring-color)", ringWidth: "var(--focus-ring-width)", ringOffset: "var(--focus-ring-offset)" },
  layout: {
    readingWidth: "var(--container-reading)",
    workspaceWidth: "var(--container-workspace)",
    viewportHeight: "var(--measure-viewport-height)",
  },
} as const;

export type DesignTokens = typeof tokens;

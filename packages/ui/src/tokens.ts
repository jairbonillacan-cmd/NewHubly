// Catálogo tipado de tokens semánticos de Hubly (Fase 0 / 1A / 1B).
// Paleta de marca: Grafito y azul tinta (Issue #52). Las pantallas y componentes solo consumen variables CSS a través de estos tokens (Constitución #6).

export const tokens = {
  color: {
    surfaceCanvas: "var(--surface-canvas)", surfaceRaised: "var(--surface-raised)", surfaceSubtle: "var(--surface-subtle)", surfaceInteractive: "var(--surface-interactive)",
    textPrimary: "var(--text-primary)", textSecondary: "var(--text-secondary)", textMuted: "var(--text-muted)", textOnAccent: "var(--text-on-accent)",
    borderSubtle: "var(--border-subtle)", borderDefault: "var(--border-default)", borderControl: "var(--border-control)", borderStrong: "var(--border-strong)",
    accentPrimary: "var(--accent-primary)", accentPrimaryHover: "var(--accent-primary-hover)", accentPrimarySubtle: "var(--accent-primary-subtle)",
    statusSuccessBg: "var(--status-success-bg)", statusSuccessText: "var(--status-success-text)",
    statusWarningBg: "var(--status-warning-bg)", statusWarningText: "var(--status-warning-text)",
    statusDangerBg: "var(--status-danger-bg)", statusDangerText: "var(--status-danger-text)",
    surfaceBrand: "var(--surface-brand)", surfaceBrandSubtle: "var(--surface-brand-subtle)", surfaceBrandContrast: "var(--surface-brand-contrast)", surfaceBrandMuted: "var(--surface-brand-muted)",
  },
  bento: {
    surfaceBase: "var(--bento-surface-base)", cardBg: "var(--bento-card-bg)", cardBorder: "var(--bento-card-border)",
    cardHover: "var(--bento-card-hover)", cardShadow: "var(--bento-card-shadow)", colMin: "var(--bento-col-min)", highlightText: "var(--bento-highlight-text)",
  },
  glass: {
    bg: "var(--glass-bg)", border: "var(--glass-border)", borderStrong: "var(--glass-border-strong)", shadow: "var(--glass-shadow)",
    blur: "var(--glass-blur)", blurMobile: "var(--glass-blur-mobile)", fallbackBg: "var(--glass-fallback-bg)",
    textPrimary: "var(--glass-text-primary)", textSecondary: "var(--glass-text-secondary)", textMuted: "var(--glass-text-muted)", heroOverlayVeil: "var(--glass-hero-veil)",
  },
  landing: {
    tintBlue: "var(--tint-blue)", tintSand: "var(--tint-sand)", tintGreen: "var(--tint-green)", tintLilac: "var(--tint-lilac)", textFaint: "var(--text-faint)",
  },
  espacio: {
    wallpaperContornos: "var(--wallpaper-contornos)", wallpaperPatron: "var(--wallpaper-patron)", wallpaperTinta: "var(--wallpaper-tinta)", wallpaperGrafito: "var(--wallpaper-grafito)",
    wallpaperLine: "var(--wallpaper-line)", wallpaperLineAccent: "var(--wallpaper-line-accent)", wallpaperPattern: "var(--wallpaper-pattern)", wallpaperPatternAccent: "var(--wallpaper-pattern-accent)",
    glassLine: "var(--glass-line)", glassLineStrong: "var(--glass-line-strong)", glassHover: "var(--glass-hover)", glassField: "var(--glass-field)", popBg: "var(--pop-bg)",
  },
  pill: {
    activeBg: "var(--pill-active-bg)", activeText: "var(--pill-active-text)", glassBg: "var(--pill-glass-bg)", glassBorder: "var(--pill-glass-border)", glassText: "var(--pill-glass-text)",
  },
  font: {
    sans: "var(--font-sans)", display: "var(--font-display)", mono: "var(--font-mono)",
    size: {
      xs: "var(--text-xs)", sm: "var(--text-sm)", base: "var(--text-base)", lg: "var(--text-lg)", xl: "var(--text-xl)",
      "2xl": "var(--text-2xl)", "3xl": "var(--text-3xl)", "4xl": "var(--text-4xl)", "5xl": "var(--text-5xl)", displayHero: "var(--text-display-hero)", displayNum: "var(--text-display-num)",
    },
    tracking: {
      tightest: "var(--tracking-tightest)", tighter: "var(--tracking-tighter)", tight: "var(--tracking-tight)",
      normal: "var(--tracking-normal)", wide: "var(--tracking-wide)", wider: "var(--tracking-wider)", widest: "var(--tracking-widest)",
    },
    leading: { tight: "var(--leading-tight)", normal: "var(--leading-normal)", relaxed: "var(--leading-relaxed)" },
    weight: { light: "var(--weight-light)", regular: "var(--weight-regular)", medium: "var(--weight-medium)", semibold: "var(--weight-semibold)", bold: "var(--weight-bold)" },
  },
  space: {
    0: "var(--space-0)", 1: "var(--space-1)", 2: "var(--space-2)", 3: "var(--space-3)", 4: "var(--space-4)", 5: "var(--space-5)",
    6: "var(--space-6)", 8: "var(--space-8)", 10: "var(--space-10)", 12: "var(--space-12)",
  },
  radius: {
    sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", xl: "var(--radius-xl)", "2xl": "var(--radius-2xl)", full: "var(--radius-full)",
  },
  border: { thin: "var(--border-width-thin)" },
  focus: { ringColor: "var(--focus-ring-color)", ringWidth: "var(--focus-ring-width)", ringOffset: "var(--focus-ring-offset)" },
  layout: {
    readingWidth: "var(--container-reading)", workspaceWidth: "var(--container-workspace)", heroWidth: "var(--container-hero)",
    bentoWidth: "var(--container-bento)", heroMinHeight: "var(--measure-hero-min-height)", viewportHeight: "var(--measure-viewport-height)",
  },
} as const;

export type DesignTokens = typeof tokens;

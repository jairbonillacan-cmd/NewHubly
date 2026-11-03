import { describe, expect, it } from "vitest";
import { tokens } from "./index";

function collectLeafValues(node: unknown): string[] {
  if (typeof node === "string") {
    return [node];
  }
  if (typeof node === "object" && node !== null) {
    return Object.values(node).flatMap(collectLeafValues);
  }
  return [];
}

describe("tokens semánticos de @hubly/ui", () => {
  it("expone únicamente referencias var(--*) sin colores ni medidas sueltas", () => {
    const values = collectLeafValues(tokens);
    expect(values.length).toBeGreaterThan(25);
    for (const val of values) {
      expect(val).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
  });

  it("cubre superficies, texto, bordes (incluido borderControl), tipografía, espacio, radios, foco y alto de ventana", () => {
    expect(tokens.color.surfaceCanvas).toBe("var(--surface-canvas)");
    expect(tokens.color.textPrimary).toBe("var(--text-primary)");
    expect(tokens.color.borderDefault).toBe("var(--border-default)");
    expect(tokens.color.borderControl).toBe("var(--border-control)");
    expect(tokens.focus.ringColor).toBe("var(--focus-ring-color)");
    expect(tokens.space[4]).toBe("var(--space-4)");
    expect(tokens.radius.md).toBe("var(--radius-md)");
    expect(tokens.layout.viewportHeight).toBe("var(--measure-viewport-height)");
  });

  it("cubre tokens de marca, bento, liquid glass, píldoras y tipografía display (Fase 1B / Issue #8)", () => {
    expect(tokens.color.surfaceBrand).toBe("var(--surface-brand)");
    expect(tokens.color.accentWarm).toBe("var(--accent-warm)");
    expect(tokens.bento.surfaceBase).toBe("var(--bento-surface-base)");
    expect(tokens.bento.cardBg).toBe("var(--bento-card-bg)");
    expect(tokens.bento.cardBorder).toBe("var(--bento-card-border)");
    expect(tokens.glass.bg).toBe("var(--glass-bg)");
    expect(tokens.glass.border).toBe("var(--glass-border)");
    expect(tokens.glass.shadow).toBe("var(--glass-shadow)");
    expect(tokens.glass.blur).toBe("var(--glass-blur)");
    expect(tokens.glass.blurMobile).toBe("var(--glass-blur-mobile)");
    expect(tokens.glass.fallbackBg).toBe("var(--glass-fallback-bg)");
    expect(tokens.pill.activeBg).toBe("var(--pill-active-bg)");
    expect(tokens.pill.glassBg).toBe("var(--pill-glass-bg)");
    expect(tokens.font.size.displayHero).toBe("var(--text-display-hero)");
    expect(tokens.font.size.displayNum).toBe("var(--text-display-num)");
    expect(tokens.font.weight.light).toBe("var(--weight-light)");
    expect(tokens.radius.xl).toBe("var(--radius-xl)");
    expect(tokens.radius["2xl"]).toBe("var(--radius-2xl)");
    expect(tokens.radius.full).toBe("var(--radius-full)");
    expect(tokens.bento.cardShadow).toBe("var(--bento-card-shadow)");
    expect(tokens.glass.heroOverlayVeil).toBe("var(--glass-hero-veil)");
    expect(tokens.font.tracking.wide).toBe("var(--tracking-wide)");
    expect(tokens.layout.heroWidth).toBe("var(--container-hero)");
    expect(tokens.layout.bentoWidth).toBe("var(--container-bento)");
    expect(tokens.layout.heroMinHeight).toBe("var(--measure-hero-min-height)");
  });
});


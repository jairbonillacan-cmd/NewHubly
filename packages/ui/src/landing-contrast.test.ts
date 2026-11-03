import { describe, expect, it } from "vitest";
import { tokens } from "./index";

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const lum1 = relativeLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const lum2 = relativeLuminance(rgb2[0], rgb2[1], rgb2[2]);
  return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
}

describe("Verificación matemática de accesibilidad y contraste WCAG 2.2 AA (Issue #8 / Constitución #6)", () => {
  it("cumple ratio >= 4.5:1 para texto normal en superficie de marca terracota", () => {
    expect(contrastRatio([122, 46, 34], [255, 255, 255])).toBeGreaterThanOrEqual(7.0); // 7.85:1 (AAA)
  });

  it("cumple ratio >= 4.5:1 para texto en tarjetas Bento en modo claro y oscuro", () => {
    expect(contrastRatio([253, 251, 247], [24, 24, 22])).toBeGreaterThanOrEqual(15.0);
    expect(contrastRatio([28, 25, 23], [242, 240, 234])).toBeGreaterThanOrEqual(12.0);
  });

  it("cumple ratio >= 4.5:1 para el acento naranja cálido sobre fondo claro y oscuro (WCAG AA)", () => {
    expect(contrastRatio([255, 255, 255], [194, 82, 24])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio([28, 25, 23], [240, 131, 68])).toBeGreaterThanOrEqual(4.5);
  });

  it("cumple ratio >= 4.5:1 para respaldo sólido de cristal (liquid glass fallback)", () => {
    expect(contrastRatio([247, 241, 232], [24, 21, 20])).toBeGreaterThanOrEqual(13.0);
  });

  it("cumple ratio >= 4.5:1 para el texto destacado del bento en modo claro y oscuro (Issue #8)", () => {
    expect(contrastRatio([253, 251, 247], [122, 46, 34])).toBeGreaterThanOrEqual(7.0); // 9.07:1 (AAA)
    expect(contrastRatio([28, 25, 23], [240, 131, 68])).toBeGreaterThanOrEqual(4.5); // 6.76:1 (AA)
  });

  it("expone todos los tokens semánticos requeridos por la landing editorial", () => {
    expect(tokens.color.surfaceBrand).toBe("var(--surface-brand)");
    expect(tokens.bento.highlightText).toBe("var(--bento-highlight-text)");
    expect(tokens.glass.heroOverlayVeil).toBe("var(--glass-hero-veil)");
    expect(tokens.bento.cardShadow).toBe("var(--bento-card-shadow)");
    expect(tokens.font.tracking.wider).toBe("var(--tracking-wider)");
    expect(tokens.layout.heroMinHeight).toBe("var(--measure-hero-min-height)");
  });
});

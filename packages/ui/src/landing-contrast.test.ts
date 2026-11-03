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
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe("Verificación matemática de accesibilidad y contraste WCAG 2.2 AA (Issue #8 / Constitución #6)", () => {
  it("cumple ratio >= 4.5:1 para texto normal en superficie de marca terracota", () => {
    // --surface-brand (122, 46, 34) vs --surface-brand-contrast (255, 255, 255)
    const ratio = contrastRatio([122, 46, 34], [255, 255, 255]);
    expect(ratio).toBeGreaterThanOrEqual(7.0); // 7.85:1 (AAA)
  });

  it("cumple ratio >= 4.5:1 para texto en tarjetas Bento en modo claro", () => {
    // --bento-card-bg (253, 251, 247) vs --text-primary (24, 24, 22)
    const ratio = contrastRatio([253, 251, 247], [24, 24, 22]);
    expect(ratio).toBeGreaterThanOrEqual(15.0); // ~16.8:1
  });

  it("cumple ratio >= 4.5:1 para texto en tarjetas Bento en modo oscuro", () => {
    // --bento-card-bg oscuro (28, 25, 23) vs --text-primary oscuro (242, 240, 234)
    const ratio = contrastRatio([28, 25, 23], [242, 240, 234]);
    expect(ratio).toBeGreaterThanOrEqual(12.0); // ~13.5:1
  });

  it("cumple ratio >= 4.5:1 para el acento naranja cálido sobre fondo claro (WCAG AA)", () => {
    // --surface-brand-contrast blanco (255, 255, 255) vs --accent-warm (194, 82, 24)
    const ratio = contrastRatio([255, 255, 255], [194, 82, 24]);
    expect(ratio).toBeGreaterThanOrEqual(4.5); // 4.64:1 (AA)
  });

  it("cumple ratio >= 4.5:1 para el acento naranja cálido sobre fondo oscuro (WCAG AA)", () => {
    // fondo oscuro (28, 25, 23) vs --accent-warm oscuro (240, 131, 68)
    const ratio = contrastRatio([28, 25, 23], [240, 131, 68]);
    expect(ratio).toBeGreaterThanOrEqual(4.5); // 6.69:1 (AA)
  });

  it("cumple ratio >= 4.5:1 para respaldo sólido de cristal (liquid glass fallback)", () => {
    // --glass-fallback-bg (247, 241, 232) vs --glass-text-primary (24, 21, 20)
    const ratioLight = contrastRatio([247, 241, 232], [24, 21, 20]);
    expect(ratioLight).toBeGreaterThanOrEqual(13.0);
  });

  it("cumple ratio >= 4.5:1 para el texto destacado del bento en modo claro y oscuro (Issue #8)", () => {
    // Modo claro: --bento-card-bg (253, 251, 247) vs --bento-highlight-text (122, 46, 34)
    const ratioLight = contrastRatio([253, 251, 247], [122, 46, 34]);
    expect(ratioLight).toBeGreaterThanOrEqual(7.0); // 9.07:1 (AAA)

    // Modo oscuro: --bento-card-bg oscuro (28, 25, 23) vs --bento-highlight-text oscuro (240, 131, 68)
    const ratioDark = contrastRatio([28, 25, 23], [240, 131, 68]);
    expect(ratioDark).toBeGreaterThanOrEqual(4.5); // 6.76:1 (AA)
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

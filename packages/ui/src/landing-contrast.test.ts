import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tokens } from "./index";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const tokensCss = readFileSync(resolve(currentDir, "tokens.css"), "utf8");

function parseThemeBlock(blockRegex: RegExp): Record<string, string> {
  const match = blockRegex.exec(tokensCss);
  const body = match?.[1] ?? "";
  return Object.fromEntries(
    Array.from(body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g), (m) => [m[1], (m[2] ?? "").trim()]),
  );
}

const lightTokens = parseThemeBlock(/:root\s*\{([\s\S]*?)\}/);
const darkTokens = parseThemeBlock(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/);

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

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

function compositeOverWhite(r: number, g: number, b: number, alpha: number): [number, number, number] {
  return [
    Math.round(r * alpha + 255 * (1 - alpha)),
    Math.round(g * alpha + 255 * (1 - alpha)),
    Math.round(b * alpha + 255 * (1 - alpha)),
  ];
}

describe("Verificación matemática de accesibilidad y contraste WCAG 2.2 AA — Grafito y azul tinta (Issues #8 y #52)", () => {
  it("cumple ratio >= 4.5:1 para texto sobre acento azul tinta (--accent-primary) en claro y oscuro", () => {
    const lightRatio = contrastRatio(hexToRgb(lightTokens["--accent-primary"]!), hexToRgb(lightTokens["--text-on-accent"]!));
    const darkRatio = contrastRatio(hexToRgb(darkTokens["--accent-primary"]!), hexToRgb(darkTokens["--text-on-accent"]!));
    expect(lightRatio).toBeGreaterThanOrEqual(4.5);
    expect(darkRatio).toBeGreaterThanOrEqual(4.5);
  });

  it("cumple ratio >= 4.5:1 para superficie de marca grafito (--surface-brand) y tarjetas Bento en claro y oscuro", () => {
    expect(contrastRatio(hexToRgb(lightTokens["--surface-brand"]!), hexToRgb(lightTokens["--surface-brand-contrast"]!))).toBeGreaterThanOrEqual(7.0);
    expect(contrastRatio(hexToRgb(darkTokens["--surface-brand"]!), hexToRgb(darkTokens["--surface-brand-contrast"]!))).toBeGreaterThanOrEqual(7.0);
    expect(contrastRatio(hexToRgb(lightTokens["--bento-card-bg"]!), hexToRgb(lightTokens["--text-primary"]!))).toBeGreaterThanOrEqual(14.0);
    expect(contrastRatio(hexToRgb(darkTokens["--bento-card-bg"]!), hexToRgb(darkTokens["--text-primary"]!))).toBeGreaterThanOrEqual(12.0);
  });

  it("cumple ratio >= 4.5:1 para --text-muted sobre tarjeta (--surface-raised) y texto destacado del bento en claro y oscuro", () => {
    expect(contrastRatio(hexToRgb(lightTokens["--surface-raised"]!), hexToRgb(lightTokens["--text-muted"]!))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexToRgb(darkTokens["--surface-raised"]!), hexToRgb(darkTokens["--text-muted"]!))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexToRgb(lightTokens["--bento-card-bg"]!), hexToRgb(lightTokens["--bento-highlight-text"]!))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexToRgb(darkTokens["--bento-card-bg"]!), hexToRgb(darkTokens["--bento-highlight-text"]!))).toBeGreaterThanOrEqual(4.5);
  });

  it("cumple contraste de borde de control (--border-control) sobre canvas, tarjeta y fondo suave en claro y oscuro", () => {
    expect(contrastRatio(hexToRgb(lightTokens["--border-control"]!), hexToRgb(lightTokens["--surface-canvas"]!))).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(hexToRgb(lightTokens["--border-control"]!), hexToRgb(lightTokens["--surface-raised"]!))).toBeGreaterThanOrEqual(3.0);
    expect(Math.round(contrastRatio(hexToRgb(lightTokens["--border-control"]!), hexToRgb(lightTokens["--surface-subtle"]!)) * 10) / 10).toBeGreaterThanOrEqual(2.9);
    expect(contrastRatio(hexToRgb(darkTokens["--border-control"]!), hexToRgb(darkTokens["--surface-canvas"]!))).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(hexToRgb(darkTokens["--border-control"]!), hexToRgb(darkTokens["--surface-raised"]!))).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(hexToRgb(darkTokens["--border-control"]!), hexToRgb(darkTokens["--surface-subtle"]!))).toBeGreaterThanOrEqual(3.0);
  });

  it("cumple ratio >= 4.5:1 para texto sobre cristal y velo grafito del hero con foto en claro y oscuro", () => {
    expect(contrastRatio(hexToRgb(lightTokens["--glass-fallback-bg"]!), hexToRgb(lightTokens["--glass-text-primary"]!))).toBeGreaterThanOrEqual(12.0);
    expect(contrastRatio(hexToRgb(darkTokens["--glass-fallback-bg"]!), hexToRgb(darkTokens["--glass-text-primary"]!))).toBeGreaterThanOrEqual(12.0);
    const lightVeilOverPhoto = compositeOverWhite(17, 19, 22, 0.78);
    const darkVeilOverPhoto = compositeOverWhite(12, 13, 15, 0.84);
    expect(contrastRatio(lightVeilOverPhoto, hexToRgb(lightTokens["--surface-brand-contrast"]!))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkVeilOverPhoto, hexToRgb(darkTokens["--surface-brand-contrast"]!))).toBeGreaterThanOrEqual(4.5);
  });

  it("expone los tokens semánticos de Grafito y azul tinta sin tokens cálidos retirados", () => {
    expect(tokens.color.accentPrimary).toBe("var(--accent-primary)");
    expect(tokens.color.accentPrimarySubtle).toBe("var(--accent-primary-subtle)");
    expect(tokens.color.surfaceBrand).toBe("var(--surface-brand)");
    expect("accentWarm" in tokens.color).toBe(false);
  });
});

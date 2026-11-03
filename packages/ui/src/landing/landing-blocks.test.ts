import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BentoSection,
  GlassCard,
  HeroSection,
  LIFECYCLE_STAGES,
  LineGraphicCycle,
  PillNav,
  ThemeToggle,
} from "../index";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const tokensCssPath = resolve(currentDir, "../tokens.css");

function extractAllStrings(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(extractAllStrings);
  if (typeof node === "object" && node !== null) {
    const obj = node as Record<string, unknown>;
    const children = obj.props && typeof obj.props === "object" ? Object.values(obj.props) : Object.values(obj);
    return children.flatMap(extractAllStrings);
  }
  return [];
}

describe("Bloques UI reutilizables de landing (@hubly/ui)", () => {
  it("exporta todos los componentes requeridos del Issue #8", () => {
    expect(typeof GlassCard).toBe("function");
    expect(typeof PillNav).toBe("function");
    expect(typeof HeroSection).toBe("function");
    expect(typeof BentoSection).toBe("function");
    expect(typeof LineGraphicCycle).toBe("function");
    expect(typeof ThemeToggle).toBe("function");
    expect(LIFECYCLE_STAGES).toHaveLength(7);
  });

  it("HeroSection utiliza el titular de la Variante 2 y marca visiblemente el ejemplo", () => {
    const allStrings = extractAllStrings(HeroSection({})).join(" ");
    expect(allStrings).toContain("Cada pieza de contenido.");
    expect(allStrings).toContain("Sabe qué sigue y quién la tiene.");
    expect(allStrings).toContain("Ejemplo");
    expect(allStrings).toContain("Campaña Primavera");
    expect(allStrings).toContain("Auditoría (próximamente)");
  });

  it("BentoSection y HeroSection no contienen jerga interna ni métricas inventadas (Constitución #3)", () => {
    const heroStrings = extractAllStrings(HeroSection({})).join(" ");
    const bentoStrings = extractAllStrings(BentoSection()).join(" ");
    const combined = `${heroStrings} ${bentoStrings}`;
    const forbidden = [
      "Constitución #1", "Constitución #2", "Constitución #5",
      "Fase 1A · Entrada diaria · Listo", "Honestidad operativa",
      "Sin datos simulados ni métricas inventadas",
      "Trazabilidad editorial para agencias", "NewHubly",
    ];
    for (const term of forbidden) {
      expect(combined).not.toContain(term);
    }
    expect(bentoStrings).not.toMatch(/0\s*·?\s*Preguntas/i);
    expect(bentoStrings).toContain("Sin preguntas en el limbo");
    expect(bentoStrings).toContain("Estado único y visible");
  });

  it("BentoSection tiene una cuadrícula equilibrada sin tarjetas aisladas ni overflowX oculto en section (Issue #8)", () => {
    const bentoTree = BentoSection();
    const jsonStr = JSON.stringify(bentoTree);
    expect(bentoTree.props.style.overflowX).toBeUndefined();
    expect(jsonStr).toContain("hubly-bento-card-12");
    expect(jsonStr).toContain("hubly-bento-card-6");
    expect(jsonStr).toContain("Los datos son de tu agencia");
  });

  it("aplica minmax(0, 1fr), min-width: 0 y espaciado móvil anti-solapamiento en tokens.css y bloques", () => {
    const css = readFileSync(tokensCssPath, "utf8");
    expect(css).toContain(".hubly-bento-card {");
    expect(css).toMatch(/\.hubly-bento-card\s*\{[^}]*min-width:\s*0;/);
    expect(css).toMatch(/\.hubly-hero-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(css).toMatch(/\.hubly-bento-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    const lineGraphicTree = LineGraphicCycle({});
    expect(lineGraphicTree.props.className).toBe("hubly-lifecycle-container");
    expect(lineGraphicTree.props.children.props.className).toBe("hubly-lifecycle-track");
    expect(JSON.stringify(HeroSection({}))).toContain("hubly-hero-content");
    expect(JSON.stringify(PillNav({}))).toContain("hubly-pill-links");
  });
});

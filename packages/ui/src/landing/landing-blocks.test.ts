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
    const heroTree = HeroSection({});
    const allStrings = extractAllStrings(heroTree).join(" ");

    // Titular acordado de la Variante 2
    expect(allStrings).toContain("Cada pieza de contenido.");
    expect(allStrings).toContain("Sabe qué sigue y quién la tiene.");

    // Tarjeta de cristal con indicador visible de ejemplo
    expect(allStrings).toContain("Ejemplo");
    expect(allStrings).toContain("Campaña Primavera");

    // Funciones backend futuras marcadas como próximamente
    expect(allStrings).toContain("Auditoría (próximamente)");
  });

  it("BentoSection y HeroSection no contienen jerga interna ni métricas inventadas (Constitución #3)", () => {
    const heroStrings = extractAllStrings(HeroSection({})).join(" ");
    const bentoStrings = extractAllStrings(BentoSection()).join(" ");
    const combined = `${heroStrings} ${bentoStrings}`;

    // Términos prohibidos por el dueño del producto
    const forbidden = [
      "Constitución #1",
      "Constitución #2",
      "Constitución #5",
      "Fase 1A · Entrada diaria · Listo",
      "Honestidad operativa",
      "Sin datos simulados ni métricas inventadas",
      "Trazabilidad editorial para agencias",
      "NewHubly",
    ];

    for (const term of forbidden) {
      expect(combined).not.toContain(term);
    }

    // Cero cifras inventadas: no debe haber «0 · Preguntas de "¿en qué quedó este post?"»
    expect(bentoStrings).not.toMatch(/0\s*·?\s*Preguntas/i);
    expect(bentoStrings).toContain("Sin preguntas en el limbo");
    expect(bentoStrings).toContain("Estado único y visible");
  });

  it("BentoSection tiene una cuadrícula equilibrada sin tarjetas aisladas (Issue #8)", () => {
    const bentoTree = BentoSection();
    const jsonStr = JSON.stringify(bentoTree);

    // Debe contener 1 módulo de 12 columnas y 4 módulos de 6 columnas (12 + 6*4 = 36 cols = 3 filas completas)
    expect(jsonStr).toContain("hubly-bento-card-12");
    expect(jsonStr).toContain("hubly-bento-card-6");

    // «Los datos son de tu agencia» está en una tarjeta de 6 columnas junto a la vista Hoy
    expect(jsonStr).toContain("Los datos son de tu agencia");
  });

  it("aplica clases de contenedor y grillas responsivas para prevenir desbordamiento móvil", () => {
    const lineGraphicTree = LineGraphicCycle({});
    expect(lineGraphicTree.props.className).toBe("hubly-lifecycle-container");
    expect(lineGraphicTree.props.children.props.className).toBe("hubly-lifecycle-track");

    const heroStr = JSON.stringify(HeroSection({}));
    expect(heroStr).toContain("hubly-hero-grid");

    const bentoStr = JSON.stringify(BentoSection());
    expect(bentoStr).toContain("hubly-bento-grid");
  });
});

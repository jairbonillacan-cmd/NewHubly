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
});

import { describe, expect, it } from "vitest";
import { contrasteConBlanco, textoSobreAcento } from "./ThemeToggle";

// El selector del sistema entrega colores hexadecimales; aquí se arman a partir de sus canales RGB.
const rgb = (r: number, g: number, b: number) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;

describe("Acento personalizado", () => {
  it("usa texto claro sobre acentos oscuros y oscuro sobre acentos claros (AA)", () => {
    expect(textoSobreAcento(rgb(29, 78, 216))).toBe("var(--accent-on-claro)");
    expect(textoSobreAcento(rgb(250, 204, 21))).toBe("var(--accent-on-oscuro)");
  });

  it("calcula el contraste con el blanco como WCAG", () => {
    expect(contrasteConBlanco(rgb(0, 0, 0))).toBeCloseTo(21, 0);
    expect(contrasteConBlanco(rgb(255, 255, 255))).toBeCloseTo(1, 5);
  });
});

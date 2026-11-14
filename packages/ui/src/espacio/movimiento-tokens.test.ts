import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Clases de la landing de marketing: sus duraciones largas vienen de #127 y quedan fuera (movimiento.md). */
const LANDING = ["hubly-wiggle", "hubly-marquee", "hubly-peek", "hubly-drop", "hubly-underline"];

describe("Movimiento con tokens en tokens.css (issue 252)", () => {
  it("ninguna regla del producto usa segundos ni cubic-bezier sueltos", () => {
    const lines = readFileSync(new URL("../tokens.css", import.meta.url), "utf8").split(/\r?\n/);
    // Tiempo suelto pegado al número (0.5s, 40ms); no matchea «300 ms» en comentarios.
    const rawTime = /(?<![\w#.-])(?:\d+(?:\.\d+)?)(?:ms|s)\b/;
    const failures: string[] = [];
    lines.forEach((line, index) => {
      if (line.includes("--motion-")) return; // definiciones de tokens
      if (line.includes("exento-movimiento")) return; // mascota y fondos elegidos, con deuda anotada
      if (LANDING.some((name) => line.includes(name))) return;
      if (rawTime.test(line) || line.includes("cubic-bezier(")) failures.push(`${index + 1}: ${line.trim()}`);
    });
    expect(failures, `Duraciones o curvas sueltas fuera de tokens:\n${failures.join("\n")}`).toEqual([]);
  });

  it("el carril y el lienzo solo animan transform y opacity con tokens de duración", () => {
    const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/\.hubly-carril\s*\{[^}]*transition:[^}]*\swidth\b/);
    expect(css).not.toContain("will-change: width");
    expect(css).not.toMatch(/\.hubly-lienzo-item\s*\{[^}]*transition:[^}]*0\.5s/);
    expect(css).not.toContain("hubly-flotar 2.4s");
    expect(css).not.toContain("hubly-asentar 0.52s");
    // El bucle de flotar desapareció: el elemento levantado queda quieto.
    expect(css).not.toContain("@keyframes hubly-flotar");
  });
});

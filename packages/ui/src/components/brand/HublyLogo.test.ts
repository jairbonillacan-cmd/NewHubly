import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HubiWordmark, HublyWordmark } from "./HublyLogo";

const tokensCss = readFileSync(resolve(fileURLToPath(new URL(".", import.meta.url)), "../../tokens.css"), "utf8");

describe("logo «Hubly Pop Editorial»", () => {
  it("se anuncia como imagen «Hubly» y su tamaño sigue la altura sin deformarse", () => {
    const html = renderToStaticMarkup(createElement(HublyWordmark, { height: 36 }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Hubly"');
    expect(html).toContain('viewBox="0 0 402 132"');
    expect(html).toContain('height="36"');
    expect(html).toContain('width="110"');
  });

  it("decorativo se oculta a los lectores de pantalla", () => {
    const html = renderToStaticMarkup(createElement(HublyWordmark, { decorative: true }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("role=");
  });

  it("toma su color de currentColor, sin colores propios", () => {
    for (const html of [renderToStaticMarkup(createElement(HublyWordmark)), renderToStaticMarkup(createElement(HubiWordmark))]) {
      expect(html).toContain('fill="currentColor"');
      expect(html).toContain("hubly-logo");
      expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });

  it("la firma con Hubi conserva su etiqueta accesible", () => {
    const html = renderToStaticMarkup(createElement(HubiWordmark));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Hubly"');
  });

  it("el token --logo-color es marca en claro y texto en oscuro", () => {
    expect(tokensCss).toMatch(/:root\s*\{[^}]*--logo-color:\s*var\(--accent-primary\)/);
    expect(tokensCss).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*--logo-color:\s*var\(--text-primary\)/);
  });
});

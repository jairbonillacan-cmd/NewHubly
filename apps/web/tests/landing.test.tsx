import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "../src/app/page";

describe("Landing pública de Hubly en apps/web (#85)", () => {
  it("renderiza la barra flotante, el titular, el problema, el producto, los datos, las preguntas, la llamada final y el pie", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('aria-label="Principal"');
    expect(html).toContain("glass-panel");
    expect(html).toContain("Un solo espacio para");
    expect(html).toContain("todo tu marketing.");
    expect(html).toContain("Para tu marca");
    expect(html).toContain("Para tu agencia");
    expect(html).toContain("Deja de repartir tu trabajo entre tantas herramientas.");
    expect(html).toContain("Así se trabaja en Hubly.");
    expect(html).toContain("Tu espacio crece contigo.");
    expect(html).toContain("Hubi te acompaña en la app.");
    expect(html).toContain("Tu trabajo, conectado.");
    expect(html).toContain("Lo de tus clientes se queda contigo.");
    expect(html).toContain("Lo que nos preguntan.");
    expect(html).toContain("Tu marketing tiene su lugar.");
    expect(html).toContain("/marca/hubi-volumen-claro-laptop-512.webp");
    expect(html).toContain("/marca/hubi-volumen-oscuro-laptop-512.webp");
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("todos los enlaces apuntan a rutas o secciones reales, sin href vacíos ni «#»", () => {
    const html = renderToStaticMarkup(<HomePage />);
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1] ?? "");
    const ids = new Set([...html.matchAll(/id="([^"]*)"/g)].map((m) => m[1]));

    for (const route of ["/", "/login", "/privacidad", "/terminos"]) expect(hrefs).toContain(route);
    for (const href of hrefs) {
      expect(href).toMatch(/^(\/$|\/[a-z#]|#[a-z])/);
      if (href.startsWith("#") || href.startsWith("/#")) expect(ids.has(href.slice(href.indexOf("#") + 1))).toBe(true);
    }
  });
});

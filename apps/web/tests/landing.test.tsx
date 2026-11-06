import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "../src/app/page";

describe("Landing pública de Hubly en apps/web (#85)", () => {
  it("renderiza la barra flotante, el titular, el problema, el producto, los datos, las preguntas, la llamada final y el pie", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('aria-label="Principal"');
    expect(html).toContain("glass-panel");
    expect(html).toContain("Deja de preguntar");
    expect(html).toContain("«¿quién tiene esto?»");
    expect(html).toContain("Todo está en algún lado.");
    expect(html).toContain("Así se ve un día con Hubly.");
    expect(html).toContain("Hubi te acompaña en la app.");
    expect(html).toContain("Lo que ya usas y lo que viene.");
    expect(html).toContain("Lo de tus clientes se queda contigo.");
    expect(html).toContain("Lo que nos preguntan.");
    expect(html).toContain("Empieza con tu día de hoy.");
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
      expect(href).toMatch(/^(\/$|\/[a-z]|#[a-z])/);
      if (href.startsWith("#")) expect(ids.has(href.slice(1))).toBe(true);
    }
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "../src/app/page";

describe("Landing pública de Hubly en apps/web (#10)", () => {
  it("renderiza PillNav (con HublyWordmark/HublySymbol y /login), HeroSection (con Hubi volumen/laptop), BentoSection, CTA hacia /hoy y pie de página semántico", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('aria-label="Navegación principal de Hubly"');
    expect(html).toContain("Iniciar sesión");
    expect(html).toContain("Ir a Hoy");
    expect(html).toContain("Cada pieza de contenido.");
    expect(html).toContain("Sabe qué sigue y quién la tiene.");
    expect(html).toContain("photo-1542744094-3a31f272c490");
    expect(html).toContain("/marca/hubi-volumen-claro-laptop-512.webp");
    expect(html).toContain("/marca/hubi-volumen-oscuro-laptop-512.webp");

    expect(html).toContain("El ciclo completo de la pieza");
    expect(html).toContain("el ciclo real de una pieza");
    expect(html).toContain("«¿Qué sigue y quién lo tiene?»");
    expect(html).toContain("¿quién tiene el turno?");
    expect(html).toContain("La vista Hoy");
    expect(html).toContain("Los datos son de tu agencia");

    expect(html).toContain("Empieza hoy con tus notas y pendientes");
    expect(html).toContain("Entrar a Hoy");
    expect(html).toContain('role="contentinfo"');
  });

  it("todos los enlaces apuntan a destinos reales y no existen href='#' vacíos, colores retirados ni frases genéricas de relleno (#52, #53, #56)", () => {
    const html = renderToStaticMarkup(<HomePage />);
    const hrefMatches = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1] ?? "");

    expect(hrefMatches.length).toBeGreaterThanOrEqual(12);
    expect(hrefMatches).toContain("/");
    expect(hrefMatches).toContain("/login");
    expect(hrefMatches).toContain("/hoy");
    expect(hrefMatches).toContain("#hero");
    expect(hrefMatches).toContain("#ciclo");
    expect(hrefMatches).toContain("#pregunta");
    expect(hrefMatches).toContain("#hoy");
    expect(hrefMatches).toContain("/privacidad");
    expect(hrefMatches).toContain("/terminos");

    for (const href of hrefMatches) {
      expect(href).not.toBe("");
      expect(href).not.toBe("#");
      expect(href).toMatch(/^(\/$|\/[a-z]|#[a-z]|https:\/\/)/);
    }

    expect(html).not.toMatch(/lorem ipsum|potencia tu flujo|todo en un solo lugar/i);
    expect(html).not.toMatch(/--accent-warm/i);
  });

  it("incluye la atribución fotográfica verificada de Unsplash License", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("Campaign Creators");
    expect(html).toContain("pypeCEaJeZY");
    expect(html).toContain("Annie Spratt");
    expect(html).toContain("MChSQHxGZrQ");
    expect(html).toContain("Unsplash License");
  });
});

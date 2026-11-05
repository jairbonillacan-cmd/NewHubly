import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  AppPreview,
  DataSection,
  FaqSection,
  FeatureGrid,
  FinalCta,
  LANDING_FAQ,
  LANDING_FEATURES,
  LANDING_NAV_LINKS,
  LandingFooter,
  LandingHero,
  LandingNav,
  PainSection,
  LegalPage,
  ThemeToggle,
} from "../index";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const tokensCssPath = resolve(currentDir, "../tokens.css");

const render = (component: (props: never) => unknown) => renderToStaticMarkup(createElement(component as () => null));

describe("Bloques del landing de marketing (@hubly/ui, #85)", () => {
  it("exporta los bloques del landing y conserva las primitivas de las páginas legales", () => {
    for (const block of [LandingNav, LandingHero, AppPreview, PainSection, FeatureGrid, DataSection, FaqSection, FinalCta, LandingFooter, LegalPage, ThemeToggle]) {
      expect(typeof block).toBe("function");
    }
  });

  it("la barra apunta a secciones que existen en la página", () => {
    const sectionIds = ["producto", "privacidad", "preguntas"];
    expect(LANDING_NAV_LINKS.map((link) => link.href.slice(1))).toEqual(sectionIds);
    const html = [FeatureGrid, DataSection, FaqSection].map(render).join("");
    for (const id of sectionIds) expect(html).toContain(`id="${id}"`);
  });

  it("solo marca como disponible lo que existe hoy y etiqueta el resto (Constitución #3)", () => {
    const available = LANDING_FEATURES.filter((feature) => feature.status === "disponible").map((feature) => feature.id);
    expect(available).toEqual(["hoy", "captura"]);
    const html = render(FeatureGrid);
    expect(html).toContain("Ya disponible");
    expect(html).toContain("Muy pronto");
    expect(html).toContain("Próximamente");
  });

  it("los ejemplos de la app se marcan como ilustrativos", () => {
    expect(render(AppPreview)).toContain("Ejemplo ilustrativo");
    expect(render(FeatureGrid)).toContain("Ejemplo ilustrativo");
  });

  it("no promete precios, cifras ni testimonios, ni usa frases genéricas (#56)", () => {
    const html = [LandingHero, AppPreview, PainSection, FeatureGrid, DataSection, FaqSection, FinalCta].map(render).join(" ");
    expect(html).not.toMatch(/gratis|\$\s?\d|\+\d[\d,.]*\s|testimonio|lorem ipsum|potencia tu|todo en un solo lugar|sin fricción/i);
    expect(LANDING_FAQ).toHaveLength(4);
  });

  it("el modo claro es el predeterminado: el oscuro solo se activa con [data-theme=\"dark\"], no por la preferencia del sistema", () => {
    const css = readFileSync(tokensCssPath, "utf8");
    expect(css).not.toContain("prefers-color-scheme");
    expect(css).toContain(':root[data-theme="dark"] {');
  });

  it("las animaciones se apagan con movimiento reducido y no ocultan nada sin JavaScript", () => {
    const css = readFileSync(tokensCssPath, "utf8");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(/\.hubly-motion \.hubly-reveal:not\(\[data-visible="true"\]\)/);
    expect(css).not.toMatch(/^\.hubly-reveal:not/m);
  });

  it("la firma del landing usa la cara de Hubi en claro y oscuro", () => {
    const html = render(LandingNav);
    expect(html).toContain("/marca/hubi-cara-claro-128.webp");
    expect(html).toContain("/marca/hubi-cara-oscuro-128.webp");
  });

  it("los colores y medidas del landing salen de tokens, con tintes definidos en claro y oscuro", () => {
    const css = readFileSync(tokensCssPath, "utf8");
    for (const token of ["--tint-blue", "--tint-sand", "--tint-green", "--tint-lilac", "--text-faint"]) {
      expect(css.split(`${token}:`).length - 1).toBe(2);
    }
    const sources = ["LandingNav.tsx", "LandingHero.tsx", "AppPreview.tsx", "FeatureGrid.tsx", "FeatureVisuals.tsx", "LandingSections.tsx", "Reveal.tsx"].map((file) => readFileSync(resolve(currentDir, file), "utf8")).join("\n");
    expect(sources).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(sources).not.toContain("style={{");
  });
});

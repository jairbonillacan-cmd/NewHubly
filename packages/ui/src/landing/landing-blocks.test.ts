import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  AppPreview, AudienceSection, DataSection, DiaSection, FaqSection, FeatureGrid, FinalCta, LANDING_FAQ, LANDING_FEATURES, LANDING_NAV_LINKS,
  GrowSection, HubiSection, LandingFooter, LandingHero, LandingNav, LegalPage, PLANES, PricingSection, formatPrecio, PainSection, RoadmapSection, ShortcutsSection, ThemeToggle, WorkspaceSection,
} from "../index";
import { FaqAccordion, nextFaqIndex } from "./FaqAccordion";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const tokensCssPath = resolve(currentDir, "../tokens.css");
const blocks = [LandingNav, LandingHero, AudienceSection, PainSection, DiaSection, FeatureGrid, WorkspaceSection, ShortcutsSection, GrowSection, HubiSection, RoadmapSection, DataSection, FaqSection, FinalCta, LandingFooter];

const render = (component: (props: never) => unknown) => renderToStaticMarkup(createElement(component as () => null));
const htmlForLanding = () => blocks.map(render).join("\n");
const listItems = (html: string) => html.match(/<li\b.*?<\/li>/gs) ?? [];

describe("Bloques de la landing de marketing (@hubly/ui, issue 101)", () => {
  it("exporta los bloques y conserva las primitivas de las páginas legales", () => {
    for (const block of [...blocks, AppPreview, LegalPage, ThemeToggle]) {
      expect(typeof block).toBe("function");
    }
  });

  it("la barra apunta a secciones que existen en la página", () => {
    const sectionIds = ["producto", "lo-que-viene", "preguntas"];
    expect(LANDING_NAV_LINKS.filter((link) => link.href.startsWith("#")).map((link) => link.href.slice(1))).toEqual(sectionIds);
    expect(LANDING_NAV_LINKS.map((link) => link.href)).toContain("/precios");
    const html = [FeatureGrid, RoadmapSection, DataSection, FaqSection].map(render).join("");
    for (const id of sectionIds) expect(html).toContain(`id="${id}"`);
  });

  it("solo marca como disponible el producto que existe en la base y etiqueta el resto (Constitución #3)", () => {
    const available = LANDING_FEATURES.filter((feature) => feature.status === "disponible").map((feature) => feature.id);
    expect(available).toEqual(["hoy", "captura"]);
    const html = render(FeatureGrid);
    const rows = html.match(/<article\b.*?<\/article>/gs) ?? [];
    expect(rows).toHaveLength(4);
    ["Ya disponible", "Ya disponible", "Muy pronto", "Próximamente"].forEach((status, index) => {
      expect(rows[index]).toContain(`>${status}</span>`);
    });
    expect(html).toContain("Invita y gestiona a quienes editan o solo ven.");
    expect(render(LandingHero)).toContain("Ya disponible: tu espacio personal");
    expect(render(PainSection)).toContain("Así se verá cada pieza · <strong>Próximamente</strong>");
    expect(render(WorkspaceSection)).toContain(">Ya disponible</span>");
    expect(render(WorkspaceSection)).toContain("Tu imagen · Muy pronto");
    const shortcuts = listItems(render(ShortcutsSection));
    expect(shortcuts).toHaveLength(3);
    for (const item of shortcuts) expect(item).toContain(">Ya disponible</span>");
  });

  it("marca Idea como la única etapa disponible y las otras seis como Próximamente", () => {
    const stages = listItems(render(RoadmapSection));
    const names = ["Idea", "Borrador", "Revisión interna", "Aprobación del cliente", "Programada", "Publicada", "Medida"];
    expect(stages).toHaveLength(names.length);
    names.forEach((name, index) => {
      expect(stages[index]).toContain(`>${name}</h3>`);
      expect(stages[index]).toContain(index === 0 ? ">Disponible</span>" : ">Próximamente</span>");
    });
  });

  it("los ejemplos de la app se marcan como ilustrativos y no incluyen controles interactivos", () => {
    for (const html of [render(AppPreview), render(FeatureGrid)]) {
      expect(html).toContain("Ejemplo ilustrativo");
      expect(html).not.toMatch(/<(?:button|input|select|textarea)\b|tabindex=/i);
    }
    expect(render(AppPreview)).not.toContain("<a ");
  });

  it("no promete precios, cifras ni testimonios, ni usa frases genéricas (#56)", () => {
    expect(htmlForLanding()).not.toMatch(/gratis|\$\s?\d|\+\d[\d,.]*\s|testimonio|lorem ipsum|potencia tu|todo en un solo lugar|sin fricción|revoluciona|siguiente nivel|desbloquea|sin precedentes|transforma tu|impulsad[ao] por (?:la )?IA|solución definitiva|marketing os/i);
    expect(LANDING_FAQ).toHaveLength(6);
  });

  it("el acordeón abre, cambia y cierra la respuesta con aria-expanded", () => {
    const buttons = (expanded: number | null) => {
      const html = renderToStaticMarkup(createElement(FaqAccordion, { expanded, onToggle() {} }));
      return html.match(/<button\b[^>]*>/g) ?? [];
    };
    const opened = nextFaqIndex(null, 2);
    const switched = nextFaqIndex(opened, 4);
    const closed = nextFaqIndex(switched, 4);
    expect(buttons(opened)).toHaveLength(6);
    expect(buttons(opened)[2]).toMatch(/aria-expanded="true".*aria-controls=/);
    expect(buttons(switched)[2]).toContain('aria-expanded="false"');
    expect(buttons(switched)[4]).toContain('aria-expanded="true"');
    expect(buttons(closed).filter((button) => button.includes('aria-expanded="true"'))).toHaveLength(0);
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
    // Lo que se asoma solo se oculta dentro de un bloque que aún no aparece y con JavaScript (issue 127).
    expect(css).toMatch(/\.hubly-motion \.hubly-reveal:not\(\[data-visible="true"\]\) \.hubly-peek/);
    expect(css).not.toMatch(/^\.hubly-peek:not|^\.hubly-motion \.hubly-peek/m);
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .hubly-reveal"));
    for (const name of ["hubly-peek", "hubly-wiggle", "hubly-marquee", "hubly-float"]) expect(reduced, name).toContain(name);
    expect(htmlForLanding()).not.toMatch(/\banimate-/);
  });

  it("el día con Hubly solo usa lo que ya funciona y la tira de Hubi duplica sus tarjetas ocultas a lectores (issue 127)", () => {
    const dia = render(DiaSection);
    expect(listItems(dia)).toHaveLength(4);
    for (const promised of ["aprob", "cliente lo", "programa", "publica"]) expect(dia.toLowerCase()).not.toContain(promised);
    const tira = render(HubiSection);
    const items = listItems(tira);
    expect(items.length % 2).toBe(0);
    expect(items.slice(items.length / 2).every((item) => item.includes('aria-hidden="true"'))).toBe(true);
    expect(tira).not.toContain("campana");
    expect(htmlForLanding()).not.toContain("hubi-volumen-campana");
  });

  it("la navegación y el pie muestran la firma accesible de Hubly con la cara de Hubi", () => {
    for (const html of [render(LandingNav), render(LandingFooter)]) {
      expect(html).toContain('role="img" aria-label="Hubly"');
      expect(html).toMatch(/<svg\b[^>]*aria-hidden="true"[^>]*class="hubly-hubi-face\b/);
    }
    expect(htmlForLanding()).not.toMatch(/viewBox="0 0 (?:380 220|1210 264)"|M68 0 L150 0/);
  });

  it("los titulares de la landing usan el token de Fraunces", () => {
    const html = htmlForLanding();
    const headings = html.match(/<h[1-3]\b[^>]*>/g) ?? [];
    const displayHeadings = headings.filter((heading) => heading.includes("landing-display"));
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(displayHeadings).toHaveLength(headings.length - LANDING_FAQ.length);
    expect(html).toMatch(/<h1\b[^>]*class="landing-display /);
    expect(readFileSync(tokensCssPath, "utf8")).toMatch(/\.landing-display\s*\{\s*font-family: var\(--font-display,/);
  });

  it("los colores y medidas salen de tokens en claro y oscuro, sin estilos en línea", () => {
    const css = readFileSync(tokensCssPath, "utf8");
    for (const token of ["--tint-blue", "--tint-sand", "--tint-green", "--tint-lilac", "--text-faint", "--landing-mist", "--landing-ice", "--landing-paper", "--landing-end"]) {
      expect(css.split(`${token}:`).length - 1).toBe(2);
    }
    const sources = readdirSync(currentDir).filter((file) => file.endsWith(".tsx"))
      .map((file) => readFileSync(resolve(currentDir, file), "utf8")).join("\n");
    expect(sources).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(sources).not.toContain("style={{");
    expect(htmlForLanding()).not.toContain(" style=");
  });

  it("los precios salen en «Próximamente» y se muestran en pesos en cuanto se pongan (issue 129)", () => {
    expect(PLANES.map((plan) => plan.id)).toEqual(["personal", "equipo", "agencia"]);
    for (const plan of PLANES) expect(formatPrecio(plan, "mensual").monto).toBe("Próximamente");
    const conPrecio = { ...PLANES[1]!, precio: { mensual: 499, anual: 399 } };
    expect(formatPrecio(conPrecio, "mensual").monto).toMatch(/^\$\s?499 \/mes$/);
    expect(formatPrecio(conPrecio, "anual")).toEqual({ monto: expect.stringMatching(/399 \/mes$/), detalle: "Se paga una vez al año" });
    const html = render(PricingSection);
    expect(html.match(/>Próximamente<\/p>/g)).toHaveLength(3);
    expect(html).not.toMatch(/\$\s?\d|gratis/i);
    expect(html).toContain('role="radiogroup"');
  });

  it("el pie enlaza a rutas y secciones que existen y ofrece cambiar el tema", () => {
    const html = render(LandingFooter);
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1] ?? "");
    for (const href of hrefs) expect(href).toMatch(/^\/(?:$|#(?:producto|dia|crece|lo-que-viene|hubi|privacidad|preguntas)$|precios$|login(?:\?modo=registro)?$|hoy$|privacidad$|terminos$)/);
    expect(html).toContain("Cambiar a tema");
  });
});

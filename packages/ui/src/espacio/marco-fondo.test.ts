import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { selectorDeFondo } from "./EspacioHoy";

const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), "utf8");

describe("Marco del espacio (issue 241)", () => {
  it("fuera del Hub, «Cambiar fondo» abre el selector de la barra de arriba en ambos tamaños", () => {
    for (const escritorio of [true, false]) {
      expect(selectorDeFondo("dock", { escritorio, hayDock: false })).toBe("arriba");
      expect(selectorDeFondo("arriba", { escritorio, hayDock: false })).toBe("arriba");
    }
  });

  it("en el Hub se usa el selector del dock en escritorio y el de la barra móvil en el teléfono", () => {
    expect(selectorDeFondo("dock", { escritorio: true, hayDock: true })).toBe("desktop");
    expect(selectorDeFondo("dock", { escritorio: false, hayDock: true })).toBe("mobile");
    expect(selectorDeFondo("arriba", { escritorio: true, hayDock: true })).toBe("arriba");
    expect(selectorDeFondo("arriba", { escritorio: false, hayDock: true })).toBe("mobile");
  });

  it("el selector de la barra de arriba está montado fuera del bloque del Hub", () => {
    const hub = leer("./EspacioHoy.tsx");
    const arriba = hub.indexOf('isOpen={pickerOpen === "arriba"}');
    const bloqueHub = hub.indexOf("{dock && <div");
    expect(arriba).toBeGreaterThan(0);
    expect(bloqueHub === -1 || arriba < bloqueHub).toBe(true);
  });

  it("el asa del carril y el botón de reintento tienen una zona táctil de 44 px", () => {
    let zona = "";
    postcss.parse(leer("../tokens.css")).walkRules(".hubly-zona-tactil::before", (rule) => {
      rule.walkDecls((decl) => { zona += `${decl.prop}:${decl.value};`; });
    });
    expect(zona).toMatch(/width:max\(100%, 2\.75rem\);/);
    expect(zona).toMatch(/height:max\(100%, 2\.75rem\);/);
    expect(leer("./Carril.tsx")).toMatch(/hubly-carril-asa hubly-zona-tactil absolute/);
    expect(leer("./EspacioHoy.tsx")).toMatch(/className="hubly-zona-tactil relative[^"]*"[^>]*onPress=\{actionError\.onRetry\}/);
  });
});

describe("Marco del espacio: revisión de Prisma (PR 247)", () => {
  const css = postcss.parse(leer("../tokens.css"));
  const decls = (selector: string) => {
    let texto = "";
    css.walkRules((rule) => { if (rule.selector === selector && rule.parent?.type === "root") rule.walkDecls((decl) => { texto += `${decl.prop}:${decl.value};`; }); });
    return texto;
  };

  it("el carril y el cambio de sección se mueven con tokens y sin pasar de 300 ms (movimiento.md)", () => {
    for (const selector of [".hubly-carril", ".hubly-carril-item", ".hubly-carril-item svg", ".hubly-seccion-entra", ".hubly-seccion-fundido", ".hubly-palette-overlay", ".hubly-palette-overlay[data-exiting]"]) {
      const valor = decls(selector);
      expect(valor, selector).not.toMatch(/\d(\.\d+)?m?s\b/);
      expect(valor, selector).not.toMatch(/cubic-bezier/);
    }
    expect(decls(":root")).toMatch(/--motion-space:\s*(\d+)ms/);
    expect(Number(/--motion-space:\s*(\d+)ms/.exec(decls(":root"))![1])).toBeLessThanOrEqual(300);
  });

  it("la herramienta activa del carril no lleva un halo de color (punto 8)", () => {
    expect(decls('.hubly-carril-item[aria-current="page"]')).not.toMatch(/accent/);
  });

  it("el aviso de error ocupa el ancho disponible en móvil y no tapa la barra inferior", () => {
    const aviso = /className="hubly-aviso [^"]*"/.exec(leer("./EspacioHoy.tsx"))![0];
    expect(aviso).toContain("inset-x-3");
    expect(aviso).toContain("w-fit");
    expect(aviso).not.toContain("left-1/2");
    // En móvil no depende del dock (la barra inferior es más alta); en escritorio sí.
    expect(decls(".hubly-aviso")).not.toContain("--frame-dock-h");
    let escritorio = "";
    css.walkAtRules("media", (regla) => { if (/min-width/.test(regla.params)) regla.walkRules(".hubly-aviso", (rule) => { rule.walkDecls((decl) => { escritorio += decl.value; }); }); });
    expect(escritorio).toContain("--frame-dock-h");
  });

  it("la bandeja concuerda en número: «1 vencido», «2 vencidos»", () => {
    const widgets = leer("./widgets.tsx");
    expect(widgets).not.toMatch(/\{vencidos\} vencidos/);
    expect(widgets.match(/vencidos === 1 \? "vencido" : "vencidos"/g)).toHaveLength(2);
  });
});

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

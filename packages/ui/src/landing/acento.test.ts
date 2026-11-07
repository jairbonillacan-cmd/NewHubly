import { readFileSync } from "node:fs";
import { parseColor } from "@heroui/react";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { conSaturacionMinima, SATURACION_MINIMA_ACENTO } from "../espacio/Dock";
import { acentoAccesible, contraste, contrasteConBlanco, type ReferenciasAcento } from "./ThemeToggle";

// El selector del sistema entrega colores hexadecimales; aquí se arman a partir de sus canales RGB.
const rgb = (r: number, g: number, b: number) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;

/** Superficies y textos de cada tema y estilo, leídos de tokens.css para que la prueba siga a los tokens reales. */
function referencias(): Array<[string, ReferenciasAcento]> {
  const css = postcss.parse(readFileSync(new URL("../tokens.css", import.meta.url), "utf8"));
  const decls = (selector: string) => {
    const found = new Map<string, string>();
    css.walkRules((rule) => { if (rule.selector.trim() === selector) rule.walkDecls((decl) => { found.set(decl.prop, decl.value.trim()); }); });
    return found;
  };
  const raiz = decls(":root"), oscuro = decls(':root[data-theme="dark"]');
  const SUPERFICIES = ["--surface-canvas", "--surface-raised", "--surface-subtle", "--surface-interactive"];
  const ref = (vars: Map<string, string>, esOscuro: boolean): ReferenciasAcento => ({
    oscuro: esOscuro, superficies: SUPERFICIES.map((name) => vars.get(name)!), textoClaro: raiz.get("--accent-on-claro")!, textoOscuro: raiz.get("--accent-on-oscuro")!,
  });
  const casos: Array<[string, ReferenciasAcento]> = [["claro", ref(raiz, false)], ["oscuro", ref(new Map([...raiz, ...oscuro]), true)]];
  for (const estilo of ["papel", "niebla"]) casos.push([estilo, ref(new Map([...raiz, ...decls(`:root[data-theme="light"][data-estilo="${estilo}"]`)]), false)]);
  for (const estilo of ["calido", "medianoche", "carbon"]) casos.push([estilo, ref(new Map([...raiz, ...oscuro, ...decls(`:root[data-theme="dark"][data-estilo="${estilo}"]`)]), true)]);
  return casos;
}

describe("Acento personalizado (issue 239)", () => {
  it("calcula el contraste con el blanco como WCAG", () => {
    expect(contrasteConBlanco(rgb(0, 0, 0))).toBeCloseTo(21, 0);
    expect(contrasteConBlanco(rgb(255, 255, 255))).toBeCloseTo(1, 5);
  });

  it("en cada tema y estilo, cualquier color cumple como texto, foco, fondo con texto, hover y sobre su fondo suave", () => {
    const casos = referencias();
    expect(casos).toHaveLength(7);
    const colores = [rgb(119, 119, 119), rgb(250, 204, 21), rgb(29, 78, 216), rgb(0, 0, 0), rgb(255, 255, 255)];
    for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) colores.push(rgb(r, g, b));
    for (const [nombre, ref] of casos) {
      // Un acento idéntico a cada superficie del tema, el caso que dejaba invisible el foco.
      const todos = [...colores, ...ref.superficies];
      const texto = ref.oscuro ? ref.textoOscuro : ref.textoClaro;
      for (const color of todos) {
        const { acento, hover, suave } = acentoAccesible(color, ref);
        for (const superficie of ref.superficies) expect(contraste(acento, superficie), `${nombre} ${color}: acento sobre ${superficie}`).toBeGreaterThanOrEqual(4.5);
        expect(contraste(acento, texto), `${nombre} ${color}: texto sobre el acento`).toBeGreaterThanOrEqual(4.5);
        expect(contraste(hover, texto), `${nombre} ${color}: texto sobre el hover`).toBeGreaterThanOrEqual(4.5);
        expect(contraste(acento, suave), `${nombre} ${color}: acento sobre su fondo suave`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("no cambia un acento que ya cumple y corrige el gris que quedaba por debajo de 4,5:1", () => {
    const [, claro] = referencias()[0]!;
    expect(acentoAccesible(rgb(29, 78, 216), claro).acento).toBe(rgb(29, 78, 216).toUpperCase());
    const gris = acentoAccesible(rgb(119, 119, 119), claro);
    expect(gris.texto).toBe("var(--accent-on-claro)");
    expect(contraste(gris.acento, claro.textoClaro)).toBeGreaterThanOrEqual(4.5);
  });

  it("eleva la saturación de un gris o color apagado al mínimo para que no parezca desactivado (issue 251)", () => {
    const azul = parseColor(rgb(29, 78, 216));
    expect(conSaturacionMinima(azul, null).toString("hex")).toBe(azul.toString("hex"));
    const gris = parseColor(rgb(119, 119, 119));
    const saturado = conSaturacionMinima(gris, azul).toFormat("hsb");
    expect(saturado.getChannelValue("saturation")).toBeGreaterThanOrEqual(SATURACION_MINIMA_ACENTO);
    expect(Math.round(saturado.getChannelValue("hue"))).toBe(Math.round(azul.toFormat("hsb").getChannelValue("hue")));
  });
});

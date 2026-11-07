import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FONDOS_ILUSTRADOS } from "./fondos";
import { Wallpaper, WallpaperSwatch } from "./Wallpaper";

const source = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
/** ¿Empieza el módulo, tras comentarios y espacios, con la directiva "use client"? Sin expresiones regulares para no arriesgar retroceso exponencial. */
function isClientModule(code: string): boolean {
  let rest = code.trimStart();
  for (;;) {
    if (rest.startsWith("//")) rest = rest.slice(rest.indexOf("\n") === -1 ? rest.length : rest.indexOf("\n") + 1).trimStart();
    else if (rest.startsWith("/*")) rest = rest.slice(rest.indexOf("*/") === -1 ? rest.length : rest.indexOf("*/") + 2).trimStart();
    else break;
  }
  return rest.startsWith('"use client"') || rest.startsWith("'use client'");
}

describe("Fondos ilustrados (issue 238)", () => {
  it("el fondo ilustrado sirve la versión animada solo sin reducción de movimiento y la estática siempre", () => {
    const html = renderToStaticMarkup(createElement(Wallpaper, { fondo: "bosque-de-niebla" }));
    expect(html).toContain('<source media="(prefers-reduced-motion: no-preference)" srcSet="/fondos/bosque-de-niebla-animado.webp" type="image/webp"/>');
    expect(html).toContain('src="/fondos/bosque-de-niebla.webp"');
    expect(html).toContain("bg-(--wallpaper-grafito)");
  });

  it("los fondos dibujados no descargan ninguna imagen ilustrada", () => {
    const html = renderToStaticMarkup(createElement(Wallpaper, { fondo: "contornos" }));
    expect(html).not.toContain("/fondos/");
    expect(html).not.toContain("<picture");
  });

  it("cada ilustración tiene miniatura propia en el selector", () => {
    for (const { id } of FONDOS_ILUSTRADOS) {
      expect(renderToStaticMarkup(createElement(WallpaperSwatch, { fondo: id }))).toContain(`src="/fondos/${id}-mini.webp"`);
    }
  });

  // /login y la página 404 renderizan Wallpaper en el servidor. Si Wallpaper o algo que importa como valor
  // pasa a ser un módulo "use client", Next no puede llamar a sus funciones en el servidor y ambas páginas se rompen.
  it("Wallpaper y lo que importa como valor siguen siendo módulos aptos para el servidor", () => {
    const wallpaper = source("./Wallpaper.tsx");
    expect(isClientModule(wallpaper)).toBe(false);
    const valueImports = [...wallpaper.matchAll(/^import\s+(?!type\b)[^;]*?from\s+["'](\.[^"']+)["']/gm)].map((match) => match[1]!);
    expect(valueImports).toContain("./fondos");
    for (const path of valueImports) {
      expect(isClientModule(source(`${path}.ts`)), `${path} no debe ser "use client"`).toBe(false);
    }
  });

  it("la detección de módulos de cliente reconoce la directiva", () => {
    expect(isClientModule('"use client";\nexport {}')).toBe(true);
    expect(isClientModule(source("./preferencias.ts"))).toBe(true);
  });
});

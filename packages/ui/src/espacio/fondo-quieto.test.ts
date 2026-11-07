import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Wallpaper } from "./Wallpaper";

describe("Fondo ilustrado quieto o animado (issue 239)", () => {
  it("con el fondo quieto no se ofrece la versión animada, solo la estática", () => {
    const html = renderToStaticMarkup(createElement(Wallpaper, { fondo: "bosque-de-niebla", animado: false }));
    expect(html).not.toContain("-animado.webp");
    expect(html).toContain('src="/fondos/bosque-de-niebla.webp"');
  });

  it("con el fondo animado se ofrece la versión animada solo sin reducción de movimiento", () => {
    const html = renderToStaticMarkup(createElement(Wallpaper, { fondo: "bosque-de-niebla", animado: true }));
    expect(html).toContain('media="(prefers-reduced-motion: no-preference)" srcSet="/fondos/bosque-de-niebla-animado.webp"');
  });

  it("el Hub pasa al fondo la preferencia guardada de movimiento", () => {
    const hub = readFileSync(new URL("./EspacioHoy.tsx", import.meta.url), "utf8");
    expect(hub).toContain("useFondoMovimiento()");
    expect(hub).toMatch(/<Wallpaper [^>]*animado=\{(?:fondoM|m)ovimiento === "animado"\}/);
  });

  it("ofrece una sola rejilla de Ilustraciones con interruptor Con movimiento y viene quieto por defecto (issue 251)", () => {
    const store = readFileSync(new URL("./fondoMovimiento.ts", import.meta.url), "utf8");
    expect(store).toContain('stored === "animado" ? "animado" : "quieto"');
    const dock = readFileSync(new URL("./Dock.tsx", import.meta.url), "utf8");
    expect(dock).toContain('aria-label="Ilustraciones"');
    expect(dock).toContain("Con movimiento");
    expect(dock).not.toContain('aria-label="Estáticos"');
    expect(dock).not.toContain('aria-label="Animados"');
    expect(dock).not.toContain("hubly-fondo-vivo");
  });
});

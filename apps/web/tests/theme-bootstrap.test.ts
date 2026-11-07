import { HUBLY_ACCENTS, HUBLY_ESTILOS } from "@hubly/ui";
import { describe, expect, it } from "vitest";
import { BOOTSTRAP_ACCENTS, THEME_BOOTSTRAP } from "../src/app/theme-bootstrap";

describe("Arranque del tema antes de pintar (issue 239)", () => {
  it("acepta exactamente los acentos de @hubly/ui salvo el azul, que no lleva data-accent", () => {
    expect([...BOOTSTRAP_ACCENTS].sort()).toEqual(HUBLY_ACCENTS.map((accent) => accent.id).filter((id) => id !== "azul").sort());
  });

  it("acepta exactamente los estilos que cambian colores", () => {
    const originales = ["sistema", "hubly-claro", "hubly-oscuro"];
    const variantes = HUBLY_ESTILOS.map((estilo) => estilo.id).filter((id) => !originales.includes(id));
    expect(THEME_BOOTSTRAP).toContain(`/^(${variantes.join("|")})$/`);
  });

  it("descarta acentos desconocidos antes de pintar", () => {
    const run = (stored: Record<string, string>) => {
      const attributes = new Map<string, string>();
      const element = { classList: { add() {} }, setAttribute: (name: string, value: string) => attributes.set(name, value), style: { setProperty() {} } };
      const storage = { getItem: (key: string) => stored[key] ?? null };
      new Function("document", "localStorage", "window", THEME_BOOTSTRAP)({ documentElement: element }, storage, { matchMedia: () => ({ matches: false }) });
      return attributes.get("data-accent");
    };
    expect(run({ "hubly-accent": "rojo" })).toBeUndefined();
    expect(run({ "hubly-accent": "azul" })).toBeUndefined();
    expect(run({ "hubly-accent": "verde" })).toBe("verde");
  });
});

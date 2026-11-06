import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
const css = read("../tokens.css");
const DIALOGS = ["BienvenidaDialog", "EquipoDialog", "PerfilDialog", "FotoRecorte", "CommandPalette"] as const;

describe("Modales que no se cortan", () => {
  it("las zonas seguras y la altura del visor gobiernan el contenedor de los modales", () => {
    const overlay = /\.hubly-modal-overlay \{[^}]*\}/.exec(css)![0];
    expect(overlay).toMatch(/height: var\(--visual-viewport-height, \d+dvh\)/);
    for (const side of ["top", "right", "bottom", "left"]) expect(overlay).toContain(`env(safe-area-inset-${side})`);
    expect(css).toMatch(/\.hubly-modal \{[^}]*max-height: min\(100%, var\(--modal-max-h\)\)/);
    expect(css).toContain(".hubly-popover-scroll");
  });

  it.each(DIALOGS)("%s usa el contenedor común y no vuelve a fijar alturas ni posiciones propias", (name) => {
    const source = read(`./${name}.tsx`);
    expect(source).toContain("hubly-modal-overlay");
    expect(source).toContain("hubly-modal ");
    expect(source).not.toMatch(/max-h-160|items-start justify-center|pt-20|pt-16/);
  });

  it("cada modal con cuerpo largo lo desplaza por dentro y deja cabecera y acciones fijas", () => {
    for (const name of DIALOGS) expect(read(`./${name}.tsx`), name).toMatch(/min-h-0[^"]*overflow-y-auto/);
    for (const name of ["PerfilDialog", "FotoRecorte", "BienvenidaDialog", "CommandPalette"]) expect(read(`./${name}.tsx`), name).toMatch(/shrink-0[^"]*border-t/);
    for (const name of ["PerfilDialog", "FotoRecorte", "EquipoDialog", "CommandPalette"]) expect(read(`./${name}.tsx`), name).toMatch(/shrink-0[^"]*border-b/);
    expect(read("./FotoRecorte.tsx")).toMatch(/hubly-recorte-visor[^"]*shrink-0/);
  });

  it("los menús y ventanas emergentes se desplazan si no caben", () => {
    expect(read("./TopBar.tsx")).toContain("hubly-popover-scroll");
    expect(read("./EquipoDialog.tsx")).toContain("hubly-popover-scroll");
    expect(read("./Dock.tsx").match(/hubly-popover-scroll/g)).toHaveLength(3);
  });

  it("la barra inferior móvil y la superior respetan las zonas seguras", () => {
    expect(css).toMatch(/\.hubly-barra-movil \{[^}]*env\(safe-area-inset-bottom\)/);
    expect(css).toMatch(/\.hubly-marco-arriba \{[^}]*env\(safe-area-inset-top\)/);
    expect(read("./EspacioHoy.tsx")).toContain("hubly-barra-movil");
  });
});

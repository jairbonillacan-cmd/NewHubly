import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EspacioHoy, type EspacioHoyProps } from "../index";

const noop = () => {};
const agency = { id: "ag-1", name: "Agencia Pulso", kind: "agency" as const, role: "editor" as const };
const personal = { id: "p-1", name: "Mi espacio", kind: "personal" as const, role: "owner" as const };
const base: EspacioHoyProps = {
  todayDate: "2026-11-05", todos: [], notes: [], noteSaveStates: {}, analyzeCapture: (text: string) => ({ title: text, dueDate: null, dueKeyword: null, priority: null, noteQuery: null }),
  onCapture: async () => true, onToggleTodo: noop, onCreateNote: async () => null, onSaveNote: noop, onTogglePin: noop, onToggleArchive: noop, onExport: noop, onSignOut: noop,
  workspaces: [personal, agency], activeWorkspace: personal,
};
const render = (props: Partial<EspacioHoyProps> = {}) => renderToStaticMarkup(createElement(EspacioHoy, { ...base, ...props }));
const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");

describe("Animación al cambiar de espacio", () => {
  it("mientras llega el espacio nuevo oculta y desactiva lo del anterior, anuncia el estado y muestra ya el nombre de destino", () => {
    const html = render({ switchingTo: "ag-1" });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Abriendo Agencia Pulso…");
    expect(html).toContain("Cambiar de espacio (actual: Agencia Pulso)");
    // El contenido, el dock y el aviso móvil quedan ocultos e inertes; el carril se atenúa con el dock.
    expect(html.match(/data-cambiando=""/g)!.length).toBeGreaterThanOrEqual(3);
    expect(html.match(/inert=""/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("en reposo no oculta nada, no anima la primera carga y no muestra el aviso", () => {
    const html = render();
    expect(html).not.toContain("data-cambiando");
    expect(html).not.toContain("inert");
    expect(html).not.toContain("hubly-espacio-entra");
    expect(html).not.toContain("Abriendo");
    expect(html).toContain('aria-busy="false"');
  });

  it("la escena se vuelve a montar con el id del espacio y dura entre 200 y 300 ms", () => {
    const ms = Number(/--motion-space:\s*(\d+)ms/.exec(css)![1]);
    expect(ms).toBeGreaterThanOrEqual(200);
    expect(ms).toBeLessThanOrEqual(300);
    expect(css).toMatch(/\.hubly-espacio-escena\[data-cambiando\] \{[^}]*visibility: hidden/);
  });

  it("con movimiento reducido el cambio es instantáneo", () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{ \.hubly-espacio-escena \{ transition: none; \} \.hubly-espacio-entra, \.hubly-espacio-carga \{ animation: none; \} \}/;
    expect(css).toMatch(reduced);
  });
});

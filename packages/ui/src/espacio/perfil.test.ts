import { Dropdown } from "@heroui/react";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EspacioHoy, type EspacioHoyProps } from "../index";

const noop = () => {};
const base: EspacioHoyProps = {
  todayDate: "2026-11-05", todos: [], notes: [], noteSaveStates: {},
  analyzeCapture: (text: string) => ({ title: text, dueDate: null, dueKeyword: null, priority: null, noteQuery: null }),
  onCapture: async () => true, onToggleTodo: noop, onCreateNote: async () => null, onSaveNote: noop,
  onTogglePin: noop, onToggleArchive: noop, onExport: noop, onSignOut: noop,
};

describe("Menú del perfil", () => {
  it("reúne foto, nombre, correo, tema, datos, atajos y cerrar sesión", () => {
    using popover = vi.spyOn(Dropdown, "Popover").mockImplementation(({ children }) => createElement(Fragment, null, children));
    const html = renderToStaticMarkup(createElement(EspacioHoy, { ...base, userEmail: "ana.perez@agencia.es", timezone: "America/Mexico_City" }));
    for (const text of [
      "Menú de tu perfil", "Ana Perez", "ana.perez@agencia.es", "Cambiar foto", "Muy pronto", "Editar perfil",
      "Claro", "Oscuro", "Sistema", "Zona horaria: America/Mexico City",
      "Exportar mis datos (JSON)", "Exportar mis datos (Markdown)", "Atajos de teclado", "Cerrar sesión",
    ]) expect(html).toContain(text);
    expect(popover).toHaveBeenCalled();
    expect(html).toMatch(/aria-label="Menú de tu perfil"[^>]*role="menu"/);
    expect(html).toMatch(/<button[^>]*aria-label="Cambiar foto, muy pronto"[^>]*data-disabled="true"/);
    expect(html).toMatch(/<div[^>]*aria-disabled="true"[^>]*aria-label="Editar perfil, muy pronto"/);
  });
});

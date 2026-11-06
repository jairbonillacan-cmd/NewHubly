import { Dropdown } from "@heroui/react";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EspacioHoy, HoyPanel, NotaPanel, assignableRoles, canRemoveMember, type EspacioMember } from "../index";

const member = (role: EspacioMember["role"], isCurrentUser = false): EspacioMember => ({ userId: `u-${role}-${String(isCurrentUser)}`, role, isCurrentUser });
const noop = () => {};

describe("Agencias en el espacio de Hoy (#64, #78)", () => {
  it("asigna roles igual que las políticas RLS: el admin solo toca editores y lectores; el último owner no se degrada", () => {
    expect(assignableRoles("admin", member("editor"), 1)).toEqual(["editor", "viewer"]);
    expect(assignableRoles("admin", member("admin"), 1)).toEqual([]);
    expect(assignableRoles("admin", member("owner"), 1)).toEqual([]);
    expect(assignableRoles("owner", member("owner", true), 1)).toEqual([]);
    expect(assignableRoles("owner", member("owner", true), 2)).toEqual(["owner", "admin", "editor", "viewer"]);
    expect(assignableRoles("owner", member("owner"), 1)).toEqual([]);
    expect(assignableRoles("editor", member("viewer"), 1)).toEqual([]);
    expect(canRemoveMember("admin", member("viewer"), 1)).toBe(true);
    expect(canRemoveMember("admin", member("admin"), 1)).toBe(false);
    expect(canRemoveMember("owner", member("owner"), 1)).toBe(false);
    expect(canRemoveMember("owner", member("editor", true), 1)).toBe(false);
  });

  it("muestra la agencia activa y las acciones de espacios en el selector, y la visibilidad de notas y pendientes", () => {
    const agency = { id: "ag-1", name: "Agencia Pulso", kind: "agency" as const, role: "editor" as const };
    // Renderiza el contenido del selector sin el portal del navegador.
    using popover = vi.spyOn(Dropdown, "Popover").mockImplementation(({ children }) => createElement(Fragment, null, children));
    const html = renderToStaticMarkup(createElement(EspacioHoy, {
      todayDate: "2026-11-05", todos: [], notes: [], noteSaveStates: {}, analyzeCapture: (text: string) => ({ title: text, dueDate: null, dueKeyword: null, priority: null, noteQuery: null }),
      onCapture: async () => true, onToggleTodo: noop, onCreateNote: async () => null, onSaveNote: noop, onTogglePin: noop, onToggleArchive: noop, onExport: noop, onSignOut: noop,
      workspaces: [{ id: "p-1", name: "Mi Espacio", kind: "personal" as const, role: "owner" as const }, agency], activeWorkspace: agency,
    }));
    expect(html).toContain("Cambiar de espacio (actual: Agencia Pulso)");
    expect(popover).toHaveBeenCalled();
    const menu = html.slice(html.indexOf('aria-label="Tus espacios"'), html.indexOf('aria-label="Menú de tu cuenta"'));
    expect(menu).toContain('aria-label="Agencia Pulso (activo), Editor"');
    expect(menu).toContain(">Espacio personal<");
    expect(menu).toContain(">Crear agencia<");

    const shared = { id: "n-1", title: "Pauta", content: "", isPinned: false, isArchived: false, visibility: "workspace" as const, canChangeVisibility: true };
    const notaHtml = renderToStaticMarkup(createElement(NotaPanel, { note: shared, linkedTodos: [], saveState: "saved", onSave: noop, onTogglePin: noop, onToggleArchive: noop, onCreateTodoFromNote: noop, onCreateNote: noop, onChangeVisibility: noop }));
    expect(notaHtml).toContain("Compartida con la agencia");
    expect(notaHtml).toContain("Hacer privada");
    const lectura = renderToStaticMarkup(createElement(NotaPanel, { note: { ...shared, canChangeVisibility: false, readOnly: true }, linkedTodos: [], saveState: "saved", onSave: noop, onTogglePin: noop, onToggleArchive: noop, onCreateTodoFromNote: noop, onCreateNote: noop, onChangeVisibility: noop }));
    expect(lectura).toContain("Solo lectura");
    expect(lectura).not.toContain("Hacer privada");
    expect(lectura).toContain("readOnly");

    const todo = { id: "t-1", title: "Publicar copy", priority: "medium" as const, dueDate: "2026-11-05", isDone: false, noteId: null, visibility: "private" as const, canChangeVisibility: true };
    const hoyHtml = renderToStaticMarkup(createElement(HoyPanel, { todos: [todo], notes: [], todayDate: "2026-11-05", filter: null, recentlyDone: new Set<string>(), freshIds: new Set<string>(), onToggle: noop, onClearFilter: noop, onChangeVisibility: noop }));
    expect(hoyHtml).toContain("Compartir con la agencia: Publicar copy");
  });
});

describe("Preferencias del espacio sin almacenamiento del navegador (#83)", () => {
  it("el espacio ya no lee ni escribe localStorage para sus preferencias", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(fileURLToPath(new URL("./preferencias.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/localStorage\s*\./);
    expect(source).not.toContain("hubly-espacio");
  });
});

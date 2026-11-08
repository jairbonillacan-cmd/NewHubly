import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DockStatus } from "./Dock";
import { createShortcutRegistry, createTodayDock } from "./dockConfig";
import type { EspacioTodo } from "./types";

describe("Dock de Hoy", () => {
  it("conecta acciones, vistas y pendientes del día", () => {
    const note = vi.fn(), onLayout = vi.fn(), onFilter = vi.fn();
    const date = "2026-11-05";
    const todo = (id: string, dueDate: string, isDone = false): EspacioTodo => ({ id, title: id, dueDate, isDone, priority: "low", noteId: null });
    const config = createTodayDock({
      date, layout: "libre", onLayout, filter: null, onFilter, createNote: note, saveState: "saved",
      entry: { label: "Capturar pendiente", hint: "Captura", shortcut: "C", chips: () => [], onSubmit: vi.fn() },
      todos: [todo("vencido", "2026-11-04"), todo("hoy", date), todo("hecho", date, true), todo("mañana", "2026-11-06")],
    });
    expect(config.actions.map(({ label, key }) => [label, key])).toEqual([["Nota", "N"]]);
    config.actions.forEach((action) => action.run());
    expect(note).toHaveBeenCalledOnce();
    expect(config.views.map(({ id, selected }) => [id, selected])).toEqual([["libre", true], ["lado", false], ["enfoque", false]]);
    config.views.find((view) => view.id === "lado")?.run();
    expect(onLayout).toHaveBeenCalledWith("lado");
    expect(config.waiting.detail).toBe("1 vencido · 1 para hoy");
    expect(config.waiting.items.map((item) => item.id)).toEqual(["vencido", "hoy"]);
    config.waiting.filters[0]?.run();
    expect(onFilter).toHaveBeenCalledWith("vencidos");
    expect(config.pace).toEqual({ done: 1, total: 2, label: "1 de 2 · hechos hoy" });
  });
});

describe("Registro de atajos", () => {
  it("rechaza dos acciones con la misma tecla aunque cambie la caja", () => {
    expect(() => createShortcutRegistry([
      { key: "N", label: "Nota", run: vi.fn() }, { key: "n", label: "Otra acción", run: vi.fn() },
    ])).toThrow("Atajo duplicado: n");
  });

  it("dispara teclas registradas y respeta campos de escritura y modificadores", () => {
    const run = vi.fn(), search = vi.fn(), preventDefault = vi.fn();
    const dispatch = createShortcutRegistry([{ key: "N", label: "Nota", run }, { key: "Ctrl K", label: "Buscar", run: search }]);
    for (const target of [{ tagName: "INPUT" }, { tagName: "TEXTAREA" }, { tagName: "SELECT" }, { isContentEditable: true }]) {
      dispatch({ key: "n", target, preventDefault } as unknown as KeyboardEvent);
    }
    dispatch({ key: "n", ctrlKey: true, preventDefault } as unknown as KeyboardEvent);
    expect(run).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    dispatch({ key: "N", preventDefault } as unknown as KeyboardEvent);
    dispatch({ key: "k", metaKey: true, preventDefault } as unknown as KeyboardEvent);
    expect(run).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it("mientras se escribe en un campo, Ctrl K sigue abriendo la búsqueda y las letras sueltas no", () => {
    const run = vi.fn(), search = vi.fn();
    const dispatch = createShortcutRegistry([{ key: "N", label: "Nota", run }, { key: "Ctrl K", label: "Buscar", run: search }]);
    const input = { tagName: "INPUT" };
    dispatch({ key: "k", ctrlKey: true, target: input, preventDefault: vi.fn() } as unknown as KeyboardEvent);
    dispatch({ key: "n", target: input, preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(search).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
  });

  it("en cualquier campo de escritura, Ctrl K y Cmd K abren la búsqueda y evitan la acción del navegador (issue 269)", () => {
    const run = vi.fn(), search = vi.fn();
    const dispatch = createShortcutRegistry([{ key: "N", label: "Nota", run }, { key: "Ctrl K", label: "Buscar", run: search }]);
    const fields = [{ tagName: "INPUT" }, { tagName: "TEXTAREA" }, { tagName: "DIV", isContentEditable: true }];
    for (const target of fields) {
      for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
        const preventDefault = vi.fn();
        dispatch({ key: "k", ...modifier, target, preventDefault } as unknown as KeyboardEvent);
        expect(preventDefault).toHaveBeenCalledOnce();
      }
      dispatch({ key: "n", target, preventDefault: vi.fn() } as unknown as KeyboardEvent);
    }
    expect(search).toHaveBeenCalledTimes(fields.length * 2);
    expect(run).not.toHaveBeenCalled();
  });

  it("con IME, Alt o la tecla mantenida no se dispara nada, aunque lleve Ctrl o Cmd (issue 269)", () => {
    const search = vi.fn(), preventDefault = vi.fn();
    const dispatch = createShortcutRegistry([{ key: "Ctrl K", label: "Buscar", run: search }]);
    const input = { tagName: "INPUT" };
    for (const extra of [{ isComposing: true }, { altKey: true }, { repeat: true }]) {
      dispatch({ key: "k", ctrlKey: true, target: input, preventDefault, ...extra } as unknown as KeyboardEvent);
      dispatch({ key: "k", metaKey: true, target: input, preventDefault, ...extra } as unknown as KeyboardEvent);
    }
    expect(search).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe("Lengüeta de Hubi", () => {
  it("se oculta cuando no hay nada útil que decir", () => {
    expect(renderToStaticMarkup(createElement(DockStatus, { suggestion: null }))).toBe("");
  });

  it("muestra una sola sugerencia y su acción", () => {
    const run = vi.fn();
    const html = renderToStaticMarkup(createElement(DockStatus, {
      suggestion: { message: "Tienes 2 vencidos", action: { label: "Pasarlos a hoy", run } },
    }));
    expect(html).toContain('role="status"');
    expect(html).toContain("Tienes 2 vencidos");
    expect(html).toContain("Pasarlos a hoy");
  });
});

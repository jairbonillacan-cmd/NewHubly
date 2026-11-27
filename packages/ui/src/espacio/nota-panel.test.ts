import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createShortcutRegistry } from "./dockConfig";
import { attachStableKeydownListener, computeFreshTodoIds } from "./EspacioHoy";
import { NotaPanel, createNoteAutosaveScheduler } from "./NotaPanel";

describe("Autoguardado de NotaPanel sin pérdida al desmontar o cambiar de nota (issue 290)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hace flush inmediato del último cambio pendiente sin duplicar al vencer el temporizador", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const scheduler = createNoteAutosaveScheduler(onSave, 700);

    scheduler.schedule("nota-1", "Inicial", "Borrador 1");
    scheduler.schedule("nota-1", "Inicial", "Texto antes de cerrar");
    expect(onSave).not.toHaveBeenCalled();

    // Flush antes de los 700 ms (al cerrar el panel, cambiar de nota o en pagehide).
    scheduler.flush();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("nota-1", "Inicial", "Texto antes de cerrar");

    // Un segundo flush o el avance del reloj no duplican el guardado.
    scheduler.flush();
    vi.advanceTimersByTime(1000);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("guarda automáticamente al vencer el debounce usando el último manejador y renderiza NotaPanel", () => {
    vi.useFakeTimers();
    const firstHandler = vi.fn();
    const latestHandler = vi.fn();
    const scheduler = createNoteAutosaveScheduler(firstHandler, 700);

    scheduler.schedule("nota-2", "Título", "Contenido");
    scheduler.setHandler(latestHandler);
    vi.advanceTimersByTime(700);

    expect(firstHandler).not.toHaveBeenCalled();
    expect(latestHandler).toHaveBeenCalledTimes(1);
    expect(latestHandler).toHaveBeenCalledWith("nota-2", "Título", "Contenido");

    const html = renderToStaticMarkup(createElement(NotaPanel, {
      note: { id: "nota-2", title: "Título", content: "Contenido", isPinned: false, isArchived: false },
      linkedTodos: [],
      saveState: "saved",
      onSave: latestHandler,
      onTogglePin: vi.fn(),
      onToggleArchive: vi.fn(),
      onCreateTodoFromNote: vi.fn(),
      onCreateNote: vi.fn(),
    }));
    expect(html).toContain("Título");
    expect(html).toContain("Guardado");
  });

  it("reinicia la línea base de pendientes nuevos al cambiar de espacio y registra un único listener keydown (issue 290)", () => {
    const initial = new Set(["t-1"]);
    expect([...computeFreshTodoIds([{ id: "t-1" }, { id: "t-2" }], initial, true)]).toEqual(["t-2"]);
    // Al cambiar de espacio (incluso con la misma referencia de arreglo) no marca falsos «nuevos».
    expect([...computeFreshTodoIds([{ id: "t-1" }, { id: "t-2" }], initial, false)]).toEqual([]);

    const listeners: Array<(e: KeyboardEvent) => void> = [];
    const fakeWindow = {
      addEventListener: vi.fn((_type: string, fn: (e: KeyboardEvent) => void) => { listeners.push(fn); }),
      removeEventListener: vi.fn((_type: string, fn: (e: KeyboardEvent) => void) => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      }),
    };
    const firstRun = vi.fn();
    const updatedRun = vi.fn();
    let activeHandler = createShortcutRegistry([{ key: "c", label: "Capturar", run: firstRun }]);
    const cleanup = attachStableKeydownListener(fakeWindow as unknown as Window, () => activeHandler);

    expect(fakeWindow.addEventListener).toHaveBeenCalledTimes(1);
    activeHandler = createShortcutRegistry([{ key: "c", label: "Capturar", run: updatedRun }]);
    listeners[0]?.({ key: "c", ctrlKey: false, metaKey: false, altKey: false, target: null, preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(firstRun).not.toHaveBeenCalled();
    expect(updatedRun).toHaveBeenCalledTimes(1);

    cleanup();
    expect(fakeWindow.removeEventListener).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(0);
  });
});

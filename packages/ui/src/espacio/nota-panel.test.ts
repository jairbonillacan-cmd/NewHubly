import { afterEach, describe, expect, it, vi } from "vitest";
import { createNoteAutosaveScheduler } from "./NotaPanel";

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

  it("guarda automáticamente al vencer el debounce usando el último manejador", () => {
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
  });
});

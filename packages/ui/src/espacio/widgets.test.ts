import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarEnfoque, alternarEnfoque, estadoEnfoque, moverWidget, reiniciarEnfoque, segundosRestantes, toggleWidget, WidgetPanel } from "./widgets";

const T0 = 1_800_000_000_000;
const MIN = 60_000;

describe("Temporizador de Enfoque (issue 240)", () => {
  beforeEach(() => { vi.useFakeTimers(); reiniciarEnfoque(T0); });
  afterEach(() => { reiniciarEnfoque(T0); vi.useRealTimers(); });

  it("cuenta con la hora límite: aunque el navegador frene los intervalos, el tiempo restante es exacto", () => {
    alternarEnfoque(T0);
    // Diez minutos sin ningún pulso, como una pestaña en segundo plano.
    actualizarEnfoque(T0 + 10 * MIN);
    expect(segundosRestantes(estadoEnfoque())).toBe(15 * 60);
    alternarEnfoque(T0 + 10 * MIN + 500);
    expect(estadoEnfoque().corriendo).toBe(false);
    actualizarEnfoque(T0 + 60 * MIN);
    expect(segundosRestantes(estadoEnfoque()), "en pausa no corre").toBe(15 * 60);
  });

  it("al pasar la hora límite cambia a descanso y se detiene", () => {
    alternarEnfoque(T0);
    actualizarEnfoque(T0 + 25 * MIN + 1);
    expect(estadoEnfoque()).toMatchObject({ modo: "descanso", corriendo: false });
    expect(segundosRestantes(estadoEnfoque())).toBe(5 * 60);
  });

  it("sin nadie que lo muestre no deja intervalos vivos", () => {
    alternarEnfoque(T0);
    expect(estadoEnfoque().corriendo).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("quitar el widget cancela la sesión; moverlo entre lienzo y bandeja la conserva", () => {
    toggleWidget("enfoque");
    alternarEnfoque(T0);
    moverWidget("enfoque", "bandeja");
    moverWidget("enfoque", "lienzo");
    expect(estadoEnfoque().corriendo).toBe(true);
    toggleWidget("enfoque");
    expect(estadoEnfoque()).toMatchObject({ modo: "enfoque", corriendo: false });
    expect(segundosRestantes(estadoEnfoque())).toBe(25 * 60);
  });
});

describe("Widget de vencidos (issue 240)", () => {
  it("toda la fila, de al menos 44 px, marca el pendiente como hecho", () => {
    const html = renderToStaticMarkup(createElement(WidgetPanel, {
      id: "vencidos", timezone: "America/Mexico_City", todayDate: "2026-11-07", semana: { hechos: 0, total: 1 }, onToggleTodo: () => {},
      todos: [{ id: "t1", title: "Enviar minuta", dueDate: "2026-11-05", isDone: false, priority: "high", noteId: null }],
    }));
    const boton = /<button[^>]*aria-label="Marcar como hecho: Enviar minuta[^"]*"[^>]*>([\s\S]*?)<\/button>/.exec(html);
    expect(boton?.[0]).toContain("min-h-11");
    expect(boton?.[0]).toContain("hubly-fila-tactil");
    expect(boton?.[0]).toContain("w-full");
    expect(boton?.[1]).toContain("Enviar minuta");
  });
});

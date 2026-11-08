// @vitest-environment happy-dom
import type { EspacioHoyProps } from "@hubly/ui";
import React, { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Montaje real con efectos: solo este archivo usa DOM (issue 267). El resto de pruebas sigue en Node.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => {};
const base: EspacioHoyProps = {
  todayDate: "2026-11-05", todos: [], notes: [], noteSaveStates: {},
  analyzeCapture: (text: string) => ({ title: text, dueDate: null, dueKeyword: null, priority: null, noteQuery: null }),
  onCapture: async () => true, onToggleTodo: noop, onCreateNote: async () => null, onSaveNote: noop, onTogglePin: noop, onToggleArchive: noop, onExport: noop, onSignOut: noop,
};

let root: Root | null = null;
let container: HTMLElement | null = null;

// El almacén del tema vive en el módulo: cada prueba carga @hubly/ui de cero, como una página recién abierta.
async function mount(props: Partial<EspacioHoyProps>) {
  const ui = await import("@hubly/ui");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<StrictMode><ui.EspacioHoy {...base} {...props} /></StrictMode>);
  });
  return ui;
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("Montar EspacioHoy en modo estricto no guarda el tema (issues 265 y 267)", () => {
  it("con tema en la cuenta y otro en el navegador, entrar aplica el de la cuenta sin volver a guardarlo", async () => {
    localStorage.setItem("hubly-theme", "light");
    const onThemeChange = vi.fn();
    await mount({ initialThemePreference: "dark", onThemeChange });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(onThemeChange).not.toHaveBeenCalled();
  });

  it("sin tema en la cuenta, entrar tampoco guarda el del navegador", async () => {
    localStorage.setItem("hubly-theme", "dark");
    const onThemeChange = vi.fn();
    await mount({ onThemeChange });
    expect(onThemeChange).not.toHaveBeenCalled();
  });

  it("lo que elige la persona después se guarda una sola vez", async () => {
    const onThemeChange = vi.fn();
    const ui = await mount({ initialThemePreference: "light", onThemeChange });
    await act(async () => ui.setThemePreference("dark"));
    await act(async () => ui.setThemePreference("dark"));
    expect(onThemeChange.mock.calls).toEqual([["dark"]]);
  });
});

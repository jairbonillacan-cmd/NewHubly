import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Los colores se arman a partir de sus canales RGB, como en acento.test.ts.
const rgb = (r: number, g: number, b: number) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

// Una pestaña mínima: localStorage, matchMedia, eventos de window, atributos y variables de <html>, y los tokens
// de color que lee el acento libre. El almacén del tema se carga de cero en cada prueba.
function fakeTab(initial: string | null) {
  const store = new Map<string, string>(initial ? [["hubly-theme", initial]] : []);
  const target = new EventTarget();
  const html = new Map<string, string>();
  const vars = new Map<string, string>();
  const setItem = vi.fn((k: string, v: string) => void store.set(k, v));
  const tokens: Record<string, string> = { "--surface-canvas": rgb(255, 255, 255), "--accent-on-claro": rgb(255, 255, 255), "--accent-on-oscuro": rgb(17, 17, 17) };
  vi.stubGlobal("document", {
    documentElement: {
      setAttribute: (k: string, v: string) => void html.set(k, v),
      getAttribute: (k: string) => html.get(k) ?? null,
      removeAttribute: (k: string) => void html.delete(k),
      style: { setProperty: (k: string, v: string) => void vars.set(k, v) },
    },
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: (k: string) => tokens[k] ?? "" }));
  vi.stubGlobal("window", {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    addEventListener: target.addEventListener.bind(target),
  });
  const otherTabSets = (newValue: string | null, key: string | null = "hubly-theme") => {
    const event = Object.assign(new Event("storage"), { key, newValue });
    target.dispatchEvent(event);
  };
  return { otherTabSets, setItem, attr: (k: string) => html.get(k), cssVar: (k: string) => vars.get(k), dataTheme: () => html.get("data-theme") };
}

// Se importa sin window (como en el servidor) y la pestaña aparece después: el almacén mira window al iniciarse,
// así la prueba no depende de lo que @heroui/react consulta al importarse.
async function openTab(initial: string | null) {
  const theme = await import("./ThemeToggle");
  const tab = fakeTab(initial);
  theme.getThemePreference(); // como al montar: el almacén se inicia y empieza a escuchar
  return { theme, tab };
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("Tema entre pestañas (issue 271)", () => {
  it("lo que elige otra pestaña se ve aquí y avisa a la vista, sin volver a guardarlo en la cuenta", async () => {
    const { theme, tab } = await openTab("dark");
    const save = vi.fn(), view = vi.fn();
    theme.onThemePreferenceChosen(save);
    theme.subscribeToTheme(view);
    expect(tab.dataTheme()).toBe("dark");
    tab.otherTabSets("light");
    expect(theme.getThemePreference()).toBe("light");
    expect(tab.dataTheme()).toBe("light");
    expect(view).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });

  it("después, elegir aquí el tema que esta pestaña mostraba antes sí se guarda", async () => {
    const { theme, tab } = await openTab("dark");
    const save = vi.fn();
    theme.onThemePreferenceChosen(save);
    tab.otherTabSets("light");
    theme.setThemePreference("dark");
    expect(save.mock.calls).toEqual([["dark"]]);
  });

  it("ignora otras claves, valores no válidos y borrados", async () => {
    const { theme, tab } = await openTab("dark");
    tab.otherTabSets("light", "hubly-accent");
    tab.otherTabSets("morado");
    tab.otherTabSets(null);
    tab.otherTabSets("light", null);
    expect(theme.getThemePreference()).toBe("dark");
  });
});

describe("Estilo, acento y tamaño del HUD entre pestañas (issue 273)", () => {
  it("el estilo de otra pestaña se ve aquí y avisa a la vista, sin guardarlo de nuevo", async () => {
    const { theme, tab } = await openTab("dark");
    const save = vi.fn(), view = vi.fn();
    theme.onThemePreferenceChosen(save);
    theme.subscribeToEstilo(view);
    tab.otherTabSets("medianoche", "hubly-estilo");
    expect(tab.attr("data-estilo")).toBe("medianoche");
    tab.otherTabSets("hubly-oscuro", "hubly-estilo");
    expect(tab.attr("data-estilo")).toBeUndefined();
    expect(view).toHaveBeenCalledTimes(2);
    expect(save).not.toHaveBeenCalled();
    expect(tab.setItem).not.toHaveBeenCalled();
  });

  it("el acento y su color libre de otra pestaña se ven aquí, ajustados al tema, sin guardarlos de nuevo", async () => {
    const { theme, tab } = await openTab("light");
    const view = vi.fn();
    theme.subscribeToAccent(view);
    tab.otherTabSets("verde", "hubly-accent");
    expect(tab.attr("data-accent")).toBe("verde");
    tab.otherTabSets(rgb(255, 255, 0), "hubly-accent-color"); // llega antes que el acento, como cuando la otra pestaña elige un color libre
    expect(tab.cssVar("--accent-custom")).toBeUndefined(); // aún no es el acento elegido
    tab.otherTabSets("personalizado", "hubly-accent");
    const acento = tab.cssVar("--accent-custom");
    expect(acento).toMatch(/^#[0-9A-F]{6}$/);
    expect(acento).not.toBe(rgb(255, 255, 0)); // amarillo sobre blanco no se lee: se oscurece
    tab.otherTabSets(rgb(0, 0, 170), "hubly-accent-color"); // ya es el elegido: cambia solo el color
    expect(tab.cssVar("--accent-custom")).toBe(rgb(0, 0, 170));
    tab.otherTabSets("azul", "hubly-accent");
    expect(tab.attr("data-accent")).toBeUndefined();
    expect(view).toHaveBeenCalledTimes(5);
    expect(tab.setItem).not.toHaveBeenCalled();
  });

  it("el tamaño del HUD de otra pestaña se ve aquí y avisa a la vista, sin guardarlo de nuevo", async () => {
    const { theme, tab } = await openTab("light");
    const view = vi.fn();
    theme.subscribeToHud(view);
    tab.otherTabSets("muy-grande", "hubly-hud");
    expect(tab.attr("data-hud")).toBe("muy-grande");
    tab.otherTabSets("normal", "hubly-hud");
    expect(tab.attr("data-hud")).toBeUndefined();
    expect(view).toHaveBeenCalledTimes(2);
    expect(tab.setItem).not.toHaveBeenCalled();
  });

  it("ignora valores no válidos y borrados de estilo, acento, color y HUD", async () => {
    const { theme, tab } = await openTab("light");
    const view = vi.fn();
    theme.subscribeToEstilo(view);
    theme.subscribeToAccent(view);
    theme.subscribeToHud(view);
    for (const key of ["hubly-estilo", "hubly-accent", "hubly-accent-color", "hubly-hud"]) {
      tab.otherTabSets("morado", key);
      tab.otherTabSets(null, key);
    }
    tab.otherTabSets(rgb(1, 2, 3).slice(0, -1), "hubly-accent-color"); // cinco cifras
    expect([tab.attr("data-estilo"), tab.attr("data-accent"), tab.attr("data-hud"), tab.cssVar("--accent-custom")]).toEqual([undefined, undefined, undefined, undefined]);
    expect(view).not.toHaveBeenCalled();
  });
});

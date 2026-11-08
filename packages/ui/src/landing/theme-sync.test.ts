import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Una pestaña mínima: localStorage, matchMedia, eventos de window y el atributo data-theme de <html>.
// El almacén del tema se carga de cero en cada prueba.
function fakeTab(initial: string | null) {
  const store = new Map<string, string>(initial ? [["hubly-theme", initial]] : []);
  const target = new EventTarget();
  const html = new Map<string, string>();
  vi.stubGlobal("document", {
    documentElement: { setAttribute: (k: string, v: string) => void html.set(k, v), getAttribute: (k: string) => html.get(k) ?? null },
  });
  vi.stubGlobal("window", {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    addEventListener: target.addEventListener.bind(target),
  });
  const otherTabSets = (newValue: string | null, key: string | null = "hubly-theme") => {
    const event = Object.assign(new Event("storage"), { key, newValue });
    target.dispatchEvent(event);
  };
  return { otherTabSets, dataTheme: () => html.get("data-theme") };
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

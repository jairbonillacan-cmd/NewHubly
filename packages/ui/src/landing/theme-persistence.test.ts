import { describe, expect, it, vi } from "vitest";
import { getThemePreference, hydrateThemePreference, onThemePreferenceChosen, setEstilo, setThemePreference } from "./ThemeToggle";

describe("Guardar el tema en la cuenta (issue 265)", () => {
  it("hidratar el tema del servidor al entrar lo aplica pero no lo vuelve a guardar", () => {
    const save = vi.fn();
    const stop = onThemePreferenceChosen(save);
    hydrateThemePreference("dark");
    hydrateThemePreference("light");
    expect(getThemePreference()).toBe("light");
    expect(save).not.toHaveBeenCalled();
    stop();
  });

  it("guarda cada tema que elige la persona una sola vez, y no repite si elige el que ya tiene", () => {
    hydrateThemePreference("dark");
    const save = vi.fn();
    const stop = onThemePreferenceChosen(save);
    setThemePreference("dark");
    setThemePreference("system");
    setThemePreference("system");
    setThemePreference("light");
    expect(save.mock.calls).toEqual([["system"], ["light"]]);
    stop();
  });

  it("con el doble montaje del modo estricto (suscribir, soltar y volver a suscribir) cada elección se guarda una vez", () => {
    hydrateThemePreference("light");
    const save = vi.fn();
    onThemePreferenceChosen(save)();
    const stop = onThemePreferenceChosen(save);
    hydrateThemePreference("dark");
    setThemePreference("system");
    expect(save.mock.calls).toEqual([["system"]]);
    stop();
  });

  it("elegir un estilo de otra base cuenta como elección; uno de la misma base no cambia el tema", () => {
    hydrateThemePreference("light");
    const save = vi.fn();
    const stop = onThemePreferenceChosen(save);
    setEstilo("papel");
    setEstilo("medianoche");
    expect(save.mock.calls).toEqual([["dark"]]);
    stop();
  });

  it("al dejar de escuchar ya no se guarda nada", () => {
    hydrateThemePreference("light");
    const save = vi.fn();
    onThemePreferenceChosen(save)();
    setThemePreference("dark");
    expect(save).not.toHaveBeenCalled();
  });
});

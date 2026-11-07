import { DEFAULT_USER_PREFERENCES, userPreferencesSchema, type UserPreferences } from "@hubly/contracts";
import { describe, expect, it } from "vitest";
import { fromEspacioPreferencias, toEspacioPreferencias } from "../src/components/preferences";

describe("Preferencias del espacio entre @hubly/ui y user_preferences (#83)", () => {
  it("traduce los valores por defecto al vocabulario del espacio", () => {
    expect(toEspacioPreferencias(DEFAULT_USER_PREFERENCES)).toEqual({ fondo: "contornos", opacidad: 80, distribucion: "libre", paneles: { hoy: true, nota: true, notas: true } });
  });

  it("ida y vuelta sin pérdidas para todas las distribuciones y combinaciones de paneles", () => {
    for (const layoutMode of ["free", "side_by_side", "focus"] as const) {
      for (const visiblePanels of [[], ["today"], ["open_note", "pinned_notes"], ["today", "open_note", "pinned_notes"]] as UserPreferences["visiblePanels"][]) {
        const prefs: UserPreferences = { wallpaper: "patron", panelOpacity: 72, layoutMode, visiblePanels, theme: "dark" };
        const back = { ...fromEspacioPreferencias(toEspacioPreferencias(prefs)), theme: prefs.theme };
        expect(back).toEqual(prefs);
        expect(userPreferencesSchema.safeParse(back).success).toBe(true);
      }
    }
  });
});

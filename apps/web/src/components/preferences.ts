import type { UserPreferences } from "@hubly/contracts";
import type { EspacioPreferencias, LayoutId } from "@hubly/ui";

// Traducción entre el vocabulario del espacio (@hubly/ui) y el de la tabla user_preferences (#83).

const LAYOUT_TO_UI: Record<UserPreferences["layoutMode"], LayoutId> = { free: "libre", side_by_side: "lado", focus: "enfoque" };
const LAYOUT_FROM_UI: Record<LayoutId, UserPreferences["layoutMode"]> = { libre: "free", lado: "side_by_side", enfoque: "focus" };

export function toEspacioPreferencias(prefs: UserPreferences): EspacioPreferencias {
  return {
    fondo: prefs.wallpaper,
    opacidad: prefs.panelOpacity,
    distribucion: LAYOUT_TO_UI[prefs.layoutMode],
    paneles: {
      hoy: prefs.visiblePanels.includes("today"),
      nota: prefs.visiblePanels.includes("open_note"),
      notas: prefs.visiblePanels.includes("pinned_notes"),
    },
  };
}

export function fromEspacioPreferencias(prefs: EspacioPreferencias): Omit<UserPreferences, "theme"> {
  const visiblePanels: UserPreferences["visiblePanels"] = [];
  if (prefs.paneles.hoy) visiblePanels.push("today");
  if (prefs.paneles.nota) visiblePanels.push("open_note");
  if (prefs.paneles.notas) visiblePanels.push("pinned_notes");
  return { wallpaper: prefs.fondo, panelOpacity: prefs.opacidad, layoutMode: LAYOUT_FROM_UI[prefs.distribucion], visiblePanels };
}

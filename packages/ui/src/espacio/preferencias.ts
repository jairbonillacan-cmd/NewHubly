"use client";

import { useCallback, useRef, useState } from "react";

export type WallpaperId = "contornos" | "patron" | "tinta" | "grafito" | "puntos" | "cuadricula" | "aurora" | "hubis" | "arena" | "imagen";
export type LayoutId = "libre" | "lado" | "enfoque";
export type PanelId = "hoy" | "nota" | "notas";

export interface EspacioPreferencias {
  fondo: WallpaperId;
  /** Opacidad de los paneles en porcentaje (60–98). */
  opacidad: number;
  distribucion: LayoutId;
  paneles: Record<PanelId, boolean>;
}

export const WALLPAPERS: { id: WallpaperId; claro: string; oscuro: string }[] = [
  { id: "contornos", claro: "Contornos", oscuro: "Contornos" },
  { id: "patron", claro: "Patrón H", oscuro: "Patrón H" },
  { id: "tinta", claro: "Niebla", oscuro: "Tinta" },
  { id: "grafito", claro: "Papel", oscuro: "Grafito" },
  { id: "puntos", claro: "Puntos", oscuro: "Puntos" },
  { id: "cuadricula", claro: "Cuadrícula", oscuro: "Cuadrícula" },
  { id: "aurora", claro: "Aurora", oscuro: "Aurora" },
  { id: "hubis", claro: "Hubis", oscuro: "Hubis" },
  { id: "arena", claro: "Arena", oscuro: "Medianoche" },
];

/** Cambio parcial: también los paneles se pueden cambiar uno a uno. */
export type PreferenciasPatch = Partial<Omit<EspacioPreferencias, "paneles">> & { paneles?: Partial<Record<PanelId, boolean>> };

export const DEFAULT_PREFERENCIAS: EspacioPreferencias = {
  fondo: "contornos",
  opacidad: 80,
  distribucion: "libre",
  paneles: { hoy: true, nota: true, notas: true },
};

/** Preferencias del espacio por persona (#83). Las trae el servidor (tabla user_preferences con RLS) y cada cambio se avisa
 *  a quien las guarda; sin `onChange` (Storybook) solo viven en memoria. Nada se guarda en el navegador. */
export function useEspacioPreferencias(initial: EspacioPreferencias = DEFAULT_PREFERENCIAS, onChange?: (prefs: EspacioPreferencias) => void) {
  const [prefs, setPrefs] = useState<EspacioPreferencias>(initial);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const update = useCallback((patch: PreferenciasPatch) => {
    setPrefs((current) => {
      const next: EspacioPreferencias = {
        ...current,
        ...patch,
        opacidad: Math.min(98, Math.max(60, Math.round(patch.opacidad ?? current.opacidad))),
        paneles: { ...current.paneles, ...(patch.paneles ?? {}) },
      };
      queueMicrotask(() => onChangeRef.current?.(next));
      return next;
    });
  }, []);

  return [prefs, update] as const;
}

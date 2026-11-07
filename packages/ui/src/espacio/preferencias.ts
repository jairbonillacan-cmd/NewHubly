"use client";

import { useCallback, useRef, useState } from "react";

/** Fondos ilustrados servidos desde /fondos/ (apps/web/public). Los marcados como animados traen además «-animado.webp». */
export const FONDOS_ILUSTRADOS = [
  { id: "aurora-polar", nombre: "Aurora polar", animado: true },
  { id: "bosque-de-niebla", nombre: "Bosque de niebla", animado: true },
  { id: "dunas-de-cobre", nombre: "Dunas de cobre", animado: true },
  { id: "jardin-japones", nombre: "Jardín japonés", animado: true },
  { id: "lluvia-en-casa", nombre: "Lluvia en casa", animado: true },
  { id: "marea-lenta", nombre: "Marea lenta", animado: true },
  { id: "herbario-de-tinta", nombre: "Herbario de tinta", animado: false },
  { id: "jardin-submarino", nombre: "Jardín submarino", animado: false },
  { id: "luz-de-cantera", nombre: "Luz de cantera", animado: false },
  { id: "papel-plegado", nombre: "Papel plegado", animado: false },
  { id: "refugio-alpino", nombre: "Refugio alpino", animado: false },
  { id: "tokio-nocturno", nombre: "Tokio nocturno", animado: false },
] as const;

export type FondoIlustradoId = (typeof FONDOS_ILUSTRADOS)[number]["id"];

export function fondoIlustrado(id: string) {
  return FONDOS_ILUSTRADOS.find((fondo) => fondo.id === id);
}

export type WallpaperId ="contornos" | "patron" | "tinta" | "grafito" | "puntos" | "cuadricula" | "aurora" | "hubis" | "arena" | FondoIlustradoId | "imagen";
export type LayoutId = "libre" | "lado" | "enfoque";
export type PanelId = "hoy" | "nota" | "notas";

export interface EspacioPreferencias {
  fondo: WallpaperId;
  /** Opacidad de los paneles en porcentaje (60–98). */
  opacidad: number;
  distribucion: LayoutId;
  paneles: Record<PanelId, boolean>;
}

export const WALLPAPERS_ILUSTRADOS: { id: WallpaperId; claro: string; oscuro: string }[] = FONDOS_ILUSTRADOS.map(({ id, nombre }) => ({ id, claro: nombre, oscuro: nombre }));

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

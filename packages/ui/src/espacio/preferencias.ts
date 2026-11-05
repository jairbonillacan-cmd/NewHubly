"use client";

import { useCallback, useEffect, useState } from "react";

export type WallpaperId = "contornos" | "patron" | "tinta" | "grafito";
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
];

/** Cambio parcial: también los paneles se pueden cambiar uno a uno. */
export type PreferenciasPatch = Partial<Omit<EspacioPreferencias, "paneles">> & { paneles?: Partial<Record<PanelId, boolean>> };

export const DEFAULT_PREFERENCIAS: EspacioPreferencias = {
  fondo: "contornos",
  opacidad: 80,
  distribucion: "libre",
  paneles: { hoy: true, nota: true, notas: true },
};

/** Clave en localStorage mientras llega la tabla user_preferences (#83). Está en la lista blanca de @hubly/config. */
export const ESPACIO_STORAGE_KEY = "hubly-espacio";

const isWallpaper = (v: unknown): v is WallpaperId => v === "contornos" || v === "patron" || v === "tinta" || v === "grafito";
const isLayout = (v: unknown): v is LayoutId => v === "libre" || v === "lado" || v === "enfoque";

export function parsePreferencias(raw: string | null): EspacioPreferencias {
  if (!raw) return DEFAULT_PREFERENCIAS;
  try {
    const data = JSON.parse(raw) as Partial<EspacioPreferencias>;
    const opacidad = typeof data.opacidad === "number" ? Math.min(98, Math.max(60, Math.round(data.opacidad))) : DEFAULT_PREFERENCIAS.opacidad;
    const paneles = { ...DEFAULT_PREFERENCIAS.paneles, ...(data.paneles ?? {}) };
    return {
      fondo: isWallpaper(data.fondo) ? data.fondo : DEFAULT_PREFERENCIAS.fondo,
      opacidad,
      distribucion: isLayout(data.distribucion) ? data.distribucion : DEFAULT_PREFERENCIAS.distribucion,
      paneles: { hoy: paneles.hoy !== false, nota: paneles.nota !== false, notas: paneles.notas !== false },
    };
  } catch {
    return DEFAULT_PREFERENCIAS;
  }
}

/** Preferencias del espacio por persona; empiezan en los valores por defecto para que el servidor y el cliente coincidan. */
export function useEspacioPreferencias() {
  const [prefs, setPrefs] = useState<EspacioPreferencias>(DEFAULT_PREFERENCIAS);

  useEffect(() => {
    try {
      setPrefs(parsePreferencias(window.localStorage.getItem(ESPACIO_STORAGE_KEY)));
    } catch {
      // Sin acceso al almacenamiento: se quedan los valores por defecto.
    }
  }, []);

  const update = useCallback((patch: PreferenciasPatch) => {
    setPrefs((current) => {
      const next = { ...current, ...patch, paneles: { ...current.paneles, ...(patch.paneles ?? {}) } };
      try {
        window.localStorage.setItem(ESPACIO_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Si no se puede guardar, la preferencia vale solo para esta visita.
      }
      return next;
    });
  }, []);

  return [prefs, update] as const;
}

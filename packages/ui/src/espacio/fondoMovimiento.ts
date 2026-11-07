import { useSyncExternalStore } from "react";

/** Si el fondo ilustrado se mueve o se queda quieto. Se guarda en este navegador; el fondo elegido, en la cuenta. */
export type FondoMovimiento = "animado" | "quieto";
const KEY = "hubly-fondo-movimiento";
let actual: FondoMovimiento | null = null;
const listeners = new Set<() => void>();

function leer(): FondoMovimiento {
  if (actual) return actual;
  let stored: string | null = null;
  try { stored = typeof window === "undefined" ? null : window.localStorage.getItem(KEY); } catch { /* sin almacenamiento */ }
  actual = stored === "quieto" ? "quieto" : "animado";
  return actual;
}

export function setFondoMovimiento(next: FondoMovimiento): void {
  actual = next;
  try { window.localStorage.setItem(KEY, next); } catch { /* sin almacenamiento: solo esta visita */ }
  listeners.forEach((listener) => listener());
}

export function useFondoMovimiento() {
  const value = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    leer,
    () => "animado" as FondoMovimiento,
  );
  return [value, setFondoMovimiento] as const;
}

"use client";

import { Button } from "@heroui/react";
import { useSyncExternalStore } from "react";

export interface ThemeToggleProps {
  /** «pastilla» con texto (por defecto) o «icono» para barras compactas como la del landing (#85). */
  variante?: "pastilla" | "icono";
}

export type HublyTheme = "light" | "dark";
/** Preferencia guardada: un tema fijo o el del sistema. */
export type HublyThemePreference = HublyTheme | "system";

const THEME_STORAGE_KEY = "hubly-theme";

const systemTheme = (): HublyTheme => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const storedPreference = (): HublyThemePreference => {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" || stored === "system" ? stored : "light";
  } catch {
    return "light";
  }
};

let preference: HublyThemePreference = "light";
let currentTheme: HublyTheme = "light";
let initialized = false;
let systemMedia: MediaQueryList | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

function apply(next: HublyThemePreference): void {
  preference = next;
  currentTheme = next === "system" ? systemTheme() : next;
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", currentTheme);
}

function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  apply(storedPreference());
  systemMedia = window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
  systemMedia?.addEventListener?.("change", () => {
    if (preference !== "system") return;
    apply("system");
    notify();
  });
}

function subscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Cambia el tema y lo guarda para esta persona en el navegador; «system» sigue al sistema operativo. */
export function setThemePreference(next: HublyThemePreference): void {
  ensureInitialized();
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* sin almacenamiento: solo esta visita */ }
  }
  apply(next);
  notify();
}

/** Aplica la preferencia que llega del servidor sin volver a guardarla en la cuenta. */
export function hydrateThemePreference(next: HublyThemePreference): void {
  ensureInitialized();
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* sin almacenamiento: solo esta visita */ }
  }
  apply(next);
  notify();
}

export function getThemePreference(): HublyThemePreference {
  ensureInitialized();
  return preference;
}

/** Tema resuelto y forma de cambiarlo; lo comparten la barra superior, el espacio y el landing (#75, #85). */
export function useHublyTheme() {
  ensureInitialized();
  const theme = useSyncExternalStore(subscribe, () => currentTheme, () => "light" as HublyTheme);
  return [theme, setThemePreference] as const;
}

/** Preferencia guardada (incluye «system») y tema resuelto; la usa el menú del perfil (issue 105). */
export function useHublyThemePreference() {
  ensureInitialized();
  const currentPreference = useSyncExternalStore(subscribe, () => preference, () => "light" as HublyThemePreference);
  const theme = useSyncExternalStore(subscribe, () => currentTheme, () => "light" as HublyTheme);
  return [currentPreference, theme, setThemePreference] as const;
}

export function ThemeToggle({ variante = "pastilla" }: ThemeToggleProps = {}) {
  const [theme, setTheme] = useHublyTheme();
  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const label = `Cambiar a tema ${theme === "light" ? "oscuro" : "claro"}`;
  const icon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {theme === "light" ? (
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
    </svg>
  );

  if (variante === "icono") {
    return (
      <Button isIconOnly variant="ghost" aria-label={label} onPress={toggleTheme}>
        {icon}
      </Button>
    );
  }

  return (
    <Button variant="secondary" size="sm" aria-label={label} onPress={toggleTheme}>
      {icon}
      {theme === "light" ? "Oscuro" : "Claro"}
    </Button>
  );
}

/** Color de acento (apariencia): se guarda en este navegador y se aplica con data-accent en <html>. */
export const HUBLY_ACCENTS = [
  { id: "azul", nombre: "Azul tinta" },
  { id: "violeta", nombre: "Violeta" },
  { id: "turquesa", nombre: "Turquesa" },
  { id: "verde", nombre: "Verde" },
  { id: "ambar", nombre: "Ámbar" },
  { id: "rosa", nombre: "Rosa" },
] as const;
export type HublyAccent = (typeof HUBLY_ACCENTS)[number]["id"];
const ACCENT_STORAGE_KEY = "hubly-accent";
const isAccent = (value: unknown): value is HublyAccent => HUBLY_ACCENTS.some((accent) => accent.id === value);
let accent: HublyAccent | null = null;
const accentListeners = new Set<() => void>();

function readAccent(): HublyAccent {
  if (accent) return accent;
  let stored: string | null = null;
  try { stored = typeof window === "undefined" ? null : window.localStorage.getItem(ACCENT_STORAGE_KEY); } catch { /* sin almacenamiento */ }
  accent = isAccent(stored) ? stored : "azul";
  return accent;
}

export function setAccent(next: HublyAccent): void {
  accent = next;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(ACCENT_STORAGE_KEY, next); } catch { /* sin almacenamiento: solo esta visita */ }
  }
  if (typeof document !== "undefined") {
    if (next === "azul") document.documentElement.removeAttribute("data-accent");
    else document.documentElement.setAttribute("data-accent", next);
  }
  accentListeners.forEach((listener) => listener());
}

export function useHublyAccent() {
  const current = useSyncExternalStore(
    (listener) => { accentListeners.add(listener); return () => { accentListeners.delete(listener); }; },
    readAccent,
    () => "azul" as HublyAccent,
  );
  return [current, setAccent] as const;
}

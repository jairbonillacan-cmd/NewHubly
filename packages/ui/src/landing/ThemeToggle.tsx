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

const isThemePreference = (value: unknown): value is HublyThemePreference => value === "light" || value === "dark" || value === "system";

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
  reajustarAcento();
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
  // Otra pestaña eligió tema (issue 271): se aplica aquí también, sin volver a guardarlo en la cuenta, que ya lo guardó la otra.
  window.addEventListener?.("storage", (event) => {
    if (event.key !== THEME_STORAGE_KEY || !isThemePreference(event.newValue) || event.newValue === preference) return;
    apply(event.newValue);
    notify();
  });
}

function subscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Quienes guardan el tema en la cuenta: solo se enteran de lo que elige la persona, nunca de la carga ni de la hidratación. */
const choiceListeners = new Set<(next: HublyThemePreference) => void>();

function storeAndApply(next: HublyThemePreference): void {
  ensureInitialized();
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* sin almacenamiento: solo esta visita */ }
  }
  apply(next);
  notify();
}

/** La persona elige un tema; se guarda en el navegador y se avisa para guardarlo en su cuenta. «system» sigue al sistema operativo. */
export function setThemePreference(next: HublyThemePreference): void {
  ensureInitialized();
  const changed = next !== preference;
  storeAndApply(next);
  if (changed) choiceListeners.forEach((listener) => listener(next));
}

/** Aplica la preferencia que llega del servidor al entrar. No es una elección de la persona: no se vuelve a guardar en la cuenta (issue 265). */
export function hydrateThemePreference(next: HublyThemePreference): void {
  storeAndApply(next);
}

/** Avisa cada vez que la persona elige otro tema (menú, paleta, apariencia o el botón del landing). Devuelve cómo dejar de escuchar. */
export function onThemePreferenceChosen(listener: (next: HublyThemePreference) => void): () => void {
  choiceListeners.add(listener);
  return () => { choiceListeners.delete(listener); };
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
  { id: "personalizado", nombre: "Personalizado" },
] as const;
export type HublyAccent = (typeof HUBLY_ACCENTS)[number]["id"];
const ACCENT_STORAGE_KEY = "hubly-accent";
const ACCENT_COLOR_STORAGE_KEY = "hubly-accent-color";
const HEX = /^#[0-9a-f]{6}$/i;

/** Luminancia relativa WCAG de un color hexadecimal de seis cifras. */
export function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Contraste WCAG entre dos colores hexadecimales de seis cifras. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** Contraste del color con el blanco (luminancia 1). */
export const contrasteConBlanco = (hex: string) => 1.05 / (luminancia(hex) + 0.05);

const canales = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const aHex = (rgb: number[]) => `#${rgb.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
/** Mezcla `peso` de `hacia` sobre `desde`, como color-mix en sRGB. */
const mezclar = (desde: string, hacia: string, peso: number) => { const a = canales(desde), b = canales(hacia); return aHex(a.map((n, i) => n * (1 - peso) + b[i]! * peso)); };

/** Colores del tema actual que el acento libre tiene que respetar; todos salen de tokens. */
export interface ReferenciasAcento {
  oscuro: boolean;
  /** Superficies sobre las que el acento se usa como texto, borde o anillo de foco. */
  superficies: string[];
  /** Texto que va encima del acento en tema claro y en oscuro. */
  textoClaro: string;
  textoOscuro: string;
}

export interface AcentoAccesible { acento: string; hover: string; suave: string; texto: "var(--accent-on-claro)" | "var(--accent-on-oscuro)" }

/**
 * Ajusta un color libre para que funcione en todos sus usos (issue 239):
 * - como texto, borde o foco sobre cada superficie del tema, a 4,5:1 (cubre también el 3:1 de los indicadores);
 * - con su texto encima, a 4,5:1, en reposo y al pasar el ratón;
 * - como texto sobre su propio fondo suave, a 4,5:1.
 * En claro se oscurece y lleva texto claro; en oscuro se aclara y lleva texto oscuro. El hover se aleja más en la misma
 * dirección, así que su contraste solo puede subir.
 */
export function acentoAccesible(hex: string, ref: ReferenciasAcento): AcentoAccesible {
  const hacia = ref.oscuro ? ref.textoClaro : ref.textoOscuro;
  const texto = ref.oscuro ? ref.textoOscuro : ref.textoClaro;
  const base = ref.superficies[0] ?? texto;
  const suaveDe = (color: string) => (ref.oscuro ? mezclar(base, color, 0.22) : mezclar(ref.textoClaro, color, 0.12));
  const cumple = (color: string) => [...ref.superficies, texto, suaveDe(color)].every((fondo) => contraste(color, fondo) >= 4.5);
  let acento = aHex(canales(hex));
  for (let paso = 0; paso < 80 && !cumple(acento); paso++) acento = mezclar(acento, hacia, 0.05);
  return { acento, hover: mezclar(acento, hacia, 0.15), suave: suaveDe(acento), texto: ref.oscuro ? "var(--accent-on-oscuro)" : "var(--accent-on-claro)" };
}

const HEX_TOKEN = /^#[0-9a-f]{6}$/i;
function referenciasDelTema(): ReferenciasAcento | null {
  if (typeof document === "undefined") return null;
  const estilos = getComputedStyle(document.documentElement);
  const token = (nombre: string) => estilos.getPropertyValue(nombre).trim();
  const superficies = ["--surface-canvas", "--surface-raised", "--surface-subtle", "--surface-interactive"].map(token).filter((valor) => HEX_TOKEN.test(valor));
  const textoClaro = token("--accent-on-claro"), textoOscuro = token("--accent-on-oscuro");
  if (superficies.length === 0 || !HEX_TOKEN.test(textoClaro) || !HEX_TOKEN.test(textoOscuro)) return null;
  return { oscuro: document.documentElement.getAttribute("data-theme") === "dark", superficies, textoClaro, textoOscuro };
}

let accentColor: string | null = null;
function colorInicial(): string {
  if (typeof document === "undefined") return "";
  const token = getComputedStyle(document.documentElement).getPropertyValue("--accent-personalizado-inicial").trim();
  return HEX.test(token) ? token : "";
}
function readAccentColor(): string {
  if (accentColor) return accentColor;
  let stored: string | null = null;
  try { stored = typeof window === "undefined" ? null : window.localStorage.getItem(ACCENT_COLOR_STORAGE_KEY); } catch { /* sin almacenamiento */ }
  accentColor = stored && HEX.test(stored) ? stored : colorInicial();
  return accentColor;
}

/** Aplica el acento libre ajustado al tema y estilo actuales; se vuelve a llamar cuando cambian. */
function aplicarColorPersonalizado(hex: string) {
  if (typeof document === "undefined" || !HEX.test(hex)) return;
  const ref = referenciasDelTema();
  if (!ref) return;
  const ajustado = acentoAccesible(hex, ref);
  const estilo = document.documentElement.style;
  estilo.setProperty("--accent-custom", ajustado.acento);
  estilo.setProperty("--accent-custom-hover", ajustado.hover);
  estilo.setProperty("--accent-custom-subtle", ajustado.suave);
  estilo.setProperty("--accent-custom-on", ajustado.texto);
}

/** Tras cambiar tema o estilo, las superficies cambian: se recalcula el acento libre si es el elegido. */
function reajustarAcento() {
  if (typeof document === "undefined" || document.documentElement.getAttribute("data-accent") !== "personalizado") return;
  aplicarColorPersonalizado(readAccentColor());
}

/** Elige un color libre como acento; se guarda en este navegador. */
export function setAccentColor(hex: string): void {
  if (!HEX.test(hex)) return;
  accentColor = hex;
  try { window.localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, hex); } catch { /* sin almacenamiento: solo esta visita */ }
  aplicarColorPersonalizado(hex);
  setAccent("personalizado");
}
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
    if (next === "personalizado") aplicarColorPersonalizado(readAccentColor());
  }
  accentListeners.forEach((listener) => listener());
}

export function useHublyAccentColor() {
  return useSyncExternalStore(
    (listener) => { accentListeners.add(listener); return () => { accentListeners.delete(listener); }; },
    readAccentColor,
    () => "",
  );
}

export function useHublyAccent() {
  const current = useSyncExternalStore(
    (listener) => { accentListeners.add(listener); return () => { accentListeners.delete(listener); }; },
    readAccent,
    () => "azul" as HublyAccent,
  );
  return [current, setAccent] as const;
}

/** Estilos de tema: variantes de claro u oscuro. Los originales (Hubly claro y oscuro) no cambian nada. */
export const HUBLY_ESTILOS = [
  { id: "sistema", nombre: "Sistema", base: "system" },
  { id: "hubly-claro", nombre: "Hubly claro", base: "light" },
  { id: "papel", nombre: "Papel", base: "light" },
  { id: "niebla", nombre: "Niebla", base: "light" },
  { id: "hubly-oscuro", nombre: "Hubly oscuro", base: "dark" },
  { id: "calido", nombre: "Oscuro cálido", base: "dark" },
  { id: "medianoche", nombre: "Medianoche", base: "dark" },
  { id: "carbon", nombre: "Carbón", base: "dark" },
] as const;
export type HublyEstilo = (typeof HUBLY_ESTILOS)[number]["id"];
const ESTILO_STORAGE_KEY = "hubly-estilo";
const ORIGINALES: readonly string[] = ["sistema", "hubly-claro", "hubly-oscuro"];
const isEstilo = (value: unknown): value is HublyEstilo => HUBLY_ESTILOS.some((estilo) => estilo.id === value);
let estiloActual: HublyEstilo | null = null;
const estiloListeners = new Set<() => void>();

function readEstilo(): HublyEstilo | null {
  if (estiloActual) return estiloActual;
  let stored: string | null = null;
  try { stored = typeof window === "undefined" ? null : window.localStorage.getItem(ESTILO_STORAGE_KEY); } catch { /* sin almacenamiento */ }
  estiloActual = isEstilo(stored) ? stored : null;
  return estiloActual;
}

/** Elige un estilo: fija la base (claro, oscuro o sistema) y la variante de colores. */
export function setEstilo(next: HublyEstilo): void {
  const estilo = HUBLY_ESTILOS.find((entry) => entry.id === next)!;
  estiloActual = next;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(ESTILO_STORAGE_KEY, next); } catch { /* sin almacenamiento: solo esta visita */ }
  }
  if (typeof document !== "undefined") {
    if (ORIGINALES.includes(next)) document.documentElement.removeAttribute("data-estilo");
    else document.documentElement.setAttribute("data-estilo", next);
  }
  setThemePreference(estilo.base);
  reajustarAcento();
  estiloListeners.forEach((listener) => listener());
}

/** Estilo elegido; si no hay uno guardado, el original que corresponde a la preferencia de tema. */
export function useHublyEstilo() {
  const [preference] = useHublyThemePreference();
  const guardado = useSyncExternalStore(
    (listener) => { estiloListeners.add(listener); return () => { estiloListeners.delete(listener); }; },
    readEstilo,
    () => null,
  );
  const base = HUBLY_ESTILOS.find((entry) => entry.id === guardado)?.base;
  const actual: HublyEstilo = guardado && base === preference ? guardado : preference === "system" ? "sistema" : preference === "dark" ? "hubly-oscuro" : "hubly-claro";
  return [actual, setEstilo] as const;
}

/** Tamaño del HUD (barra superior, dock y carril): se guarda en este navegador y se aplica con data-hud en <html>. */
export const HUBLY_HUD = [
  { id: "normal", nombre: "Normal" },
  { id: "grande", nombre: "Grande" },
  { id: "muy-grande", nombre: "Muy grande" },
] as const;
export type HublyHud = (typeof HUBLY_HUD)[number]["id"];
const HUD_KEY = "hubly-hud";
let hudActual: HublyHud | null = null;
const hudListeners = new Set<() => void>();

function readHud(): HublyHud {
  if (hudActual) return hudActual;
  let stored: string | null = null;
  try { stored = typeof window === "undefined" ? null : window.localStorage.getItem(HUD_KEY); } catch { /* sin almacenamiento */ }
  hudActual = stored === "grande" || stored === "muy-grande" ? stored : "normal";
  return hudActual;
}

export function setHud(next: HublyHud): void {
  hudActual = next;
  try { window.localStorage.setItem(HUD_KEY, next); } catch { /* sin almacenamiento: solo esta visita */ }
  if (typeof document !== "undefined") {
    if (next === "normal") document.documentElement.removeAttribute("data-hud");
    else document.documentElement.setAttribute("data-hud", next);
  }
  hudListeners.forEach((listener) => listener());
}

export function useHublyHud() {
  const current = useSyncExternalStore(
    (listener) => { hudListeners.add(listener); return () => { hudListeners.delete(listener); }; },
    readHud,
    () => "normal" as HublyHud,
  );
  return [current, setHud] as const;
}

// Al cargar en el navegador, el acento libre que pintó el arranque se ajusta al tema y estilo reales (issue 239).
if (typeof window !== "undefined") queueMicrotask(reajustarAcento);

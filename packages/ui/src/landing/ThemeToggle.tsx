"use client";

import { useCallback, useEffect, useState } from "react";
import { tokens } from "../tokens";

export interface ThemeToggleProps {
  /** «pastilla» con texto (por defecto) o «icono» para barras compactas como la del landing (#85). */
  variante?: "pastilla" | "icono";
}

export type HublyTheme = "light" | "dark";

/** Tema activo y forma de cambiarlo; lo comparten este botón y el menú de cuenta del espacio (#75). */
export function useHublyTheme() {
  const [theme, setThemeState] = useState<HublyTheme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("hubly-theme");
    // El modo claro es el predeterminado; solo cambia si la persona eligió el oscuro (#85).
    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const setTheme = useCallback((next: HublyTheme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("hubly-theme", next);
  }, []);

  return [theme, setTheme] as const;
}

export function ThemeToggle({ variante = "pastilla" }: ThemeToggleProps = {}) {
  const [theme, setTheme] = useHublyTheme();
  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  if (variante === "icono") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Cambiar a modo ${theme === "light" ? "oscuro" : "claro"}`}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border border-(--border-default) bg-transparent text-(--text-secondary) hover:bg-(--surface-subtle)"
      >
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
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Cambiar a modo ${theme === "light" ? "oscuro" : "claro"}`}
      title={`Modo actual: ${theme === "light" ? "Claro" : "Oscuro"}. Clic para alternar.`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: tokens.space[1],
        paddingBlock: tokens.space[2], paddingInline: tokens.space[3], backgroundColor: tokens.pill.glassBg,
        color: tokens.pill.glassText, border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`,
        borderRadius: tokens.radius.full, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.medium,
        cursor: "pointer", backdropFilter: `blur(${tokens.glass.blurMobile})`, WebkitBackdropFilter: `blur(${tokens.glass.blurMobile})`,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: tokens.font.size.sm }}>{theme === "light" ? "☾" : "☼"}</span>
      <span>{theme === "light" ? "Oscuro" : "Claro"}</span>
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { tokens } from "../tokens";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("hubly-theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("hubly-theme", nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Cambiar a modo ${theme === "light" ? "oscuro" : "claro"}`}
      title={`Modo actual: ${theme === "light" ? "Claro" : "Oscuro"}. Clic para alternar.`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.space[1],
        paddingBlock: tokens.space[2],
        paddingInline: tokens.space[3],
        backgroundColor: tokens.pill.glassBg,
        color: tokens.pill.glassText,
        border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`,
        borderRadius: tokens.radius.full,
        fontSize: tokens.font.size.xs,
        fontWeight: tokens.font.weight.medium,
        cursor: "pointer",
        backdropFilter: `blur(${tokens.glass.blurMobile})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blurMobile})`,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: tokens.font.size.sm }}>
        {theme === "light" ? "☾" : "☼"}
      </span>
      <span>{theme === "light" ? "Oscuro" : "Claro"}</span>
    </button>
  );
}

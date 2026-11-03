"use client";

import { tokens } from "@hubly/ui";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export interface PillNavProps {
  currentVariant?: "variante-1" | "variante-2" | "variante-3";
  activeSection?: string;
}

export function PillNav({ currentVariant = "variante-1", activeSection = "inicio" }: PillNavProps) {
  return (
    <header
      role="banner"
      style={{
        position: "absolute",
        top: tokens.space[6],
        left: tokens.space[0],
        right: tokens.space[0],
        zIndex: 20,
        display: "flex",
        justifyContent: "center",
        paddingInline: tokens.space[4],
      }}
    >
      <nav
        aria-label="Navegación principal de Hubly"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.space[3],
          width: "100%",
          maxWidth: tokens.layout.heroWidth,
          flexWrap: "wrap",
        }}
      >
        {/* Marca / Identificador */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: tokens.space[2],
            paddingBlock: tokens.space[2],
            paddingInline: tokens.space[4],
            backgroundColor: tokens.pill.glassBg,
            border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`,
            borderRadius: tokens.radius.full,
            color: tokens.pill.glassText,
            textDecoration: "none",
            backdropFilter: `blur(${tokens.glass.blurMobile})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blurMobile})`,
          }}
        >
          <span
            style={{
              width: tokens.space[3],
              height: tokens.space[3],
              borderRadius: tokens.radius.full,
              backgroundColor: tokens.color.accentWarm,
            }}
            aria-hidden="true"
          />
          <strong
            style={{
              fontSize: tokens.font.size.base,
              fontWeight: tokens.font.weight.bold,
              letterSpacing: tokens.font.tracking.tight,
            }}
          >
            Hubly
          </strong>
        </Link>

        {/* Píldoras de navegación de secciones */}
        <ul
          style={{
            display: "inline-flex",
            alignItems: "center",
            listStyle: "none",
            margin: tokens.space[0],
            padding: tokens.space[1],
            gap: tokens.space[1],
            backgroundColor: tokens.pill.glassBg,
            border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`,
            borderRadius: tokens.radius.full,
            backdropFilter: `blur(${tokens.glass.blurMobile})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blurMobile})`,
          }}
        >
          <li>
            <a
              href="#hero"
              style={{
                display: "inline-block",
                paddingBlock: tokens.space[2],
                paddingInline: tokens.space[4],
                borderRadius: tokens.radius.full,
                backgroundColor: activeSection === "inicio" ? tokens.pill.activeBg : "transparent",
                color: activeSection === "inicio" ? tokens.pill.activeText : tokens.pill.glassText,
                fontSize: tokens.font.size.xs,
                fontWeight: tokens.font.weight.semibold,
                textDecoration: "none",
                transition: "background-color 0.15s ease",
              }}
            >
              Inicio
            </a>
          </li>
          <li>
            <a
              href="#ciclo"
              style={{
                display: "inline-block",
                paddingBlock: tokens.space[2],
                paddingInline: tokens.space[4],
                borderRadius: tokens.radius.full,
                backgroundColor: activeSection === "ciclo" ? tokens.pill.activeBg : "transparent",
                color: activeSection === "ciclo" ? tokens.pill.activeText : tokens.pill.glassText,
                fontSize: tokens.font.size.xs,
                fontWeight: tokens.font.weight.medium,
                textDecoration: "none",
              }}
            >
              El Ciclo
            </a>
          </li>
          <li>
            <a
              href="#pregunta"
              style={{
                display: "inline-block",
                paddingBlock: tokens.space[2],
                paddingInline: tokens.space[4],
                borderRadius: tokens.radius.full,
                backgroundColor: activeSection === "pregunta" ? tokens.pill.activeBg : "transparent",
                color: activeSection === "pregunta" ? tokens.pill.activeText : tokens.pill.glassText,
                fontSize: tokens.font.size.xs,
                fontWeight: tokens.font.weight.medium,
                textDecoration: "none",
              }}
            >
              ¿Quién lo tiene?
            </a>
          </li>
          <li>
            <a
              href="#hoy"
              style={{
                display: "inline-block",
                paddingBlock: tokens.space[2],
                paddingInline: tokens.space[4],
                borderRadius: tokens.radius.full,
                backgroundColor: activeSection === "hoy" ? tokens.pill.activeBg : "transparent",
                color: activeSection === "hoy" ? tokens.pill.activeText : tokens.pill.glassText,
                fontSize: tokens.font.size.xs,
                fontWeight: tokens.font.weight.medium,
                textDecoration: "none",
              }}
            >
              Vista Hoy
            </a>
          </li>
        </ul>

        {/* Píldoras de utilidades: selector de variantes + alternador de tema */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: tokens.space[2],
          }}
        >
          {/* Selector de variantes para el dueño */}
          <div
            role="group"
            aria-label="Selector de variantes para decisión del dueño"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: tokens.space[1],
              gap: tokens.space[1],
              backgroundColor: tokens.pill.glassBg,
              border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`,
              borderRadius: tokens.radius.full,
              backdropFilter: `blur(${tokens.glass.blurMobile})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blurMobile})`,
            }}
          >
            <Link
              href="/variante-1"
              aria-current={currentVariant === "variante-1" ? "page" : undefined}
              style={{
                display: "inline-block",
                paddingBlock: tokens.space[1],
                paddingInline: tokens.space[3],
                borderRadius: tokens.radius.full,
                backgroundColor: currentVariant === "variante-1" ? tokens.color.accentWarm : "transparent",
                color: currentVariant === "variante-1" ? tokens.color.textOnAccent : tokens.pill.glassText,
                fontSize: tokens.font.size.xs,
                fontWeight: tokens.font.weight.semibold,
                textDecoration: "none",
              }}
              title="Variante 1: Editorial Pura con Hero a sangre y tarjetas gemelas"
            >
              V1
            </Link>
            <Link
              href="/variante-2"
              aria-current={currentVariant === "variante-2" ? "page" : undefined}
              style={{
                display: "inline-block",
                paddingBlock: tokens.space[1],
                paddingInline: tokens.space[3],
                borderRadius: tokens.radius.full,
                backgroundColor: currentVariant === "variante-2" ? tokens.color.accentWarm : "transparent",
                color: currentVariant === "variante-2" ? tokens.color.textOnAccent : tokens.pill.glassText,
                fontSize: tokens.font.size.xs,
                fontWeight: tokens.font.weight.semibold,
                textDecoration: "none",
              }}
              title="Variante 2: Bento Integrado con tarjeta central monumental"
            >
              V2
            </Link>
            <Link
              href="/variante-3"
              aria-current={currentVariant === "variante-3" ? "page" : undefined}
              style={{
                display: "inline-block",
                paddingBlock: tokens.space[1],
                paddingInline: tokens.space[3],
                borderRadius: tokens.radius.full,
                backgroundColor: currentVariant === "variante-3" ? tokens.color.accentWarm : "transparent",
                color: currentVariant === "variante-3" ? tokens.color.textOnAccent : tokens.pill.glassText,
                fontSize: tokens.font.size.xs,
                fontWeight: tokens.font.weight.semibold,
                textDecoration: "none",
              }}
              title="Variante 3: Flujo y Tiempos con trazabilidad estricta"
            >
              V3
            </Link>
          </div>

          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

import type { ReactNode } from "react";
import { tokens } from "../tokens";
import { ThemeToggle } from "./ThemeToggle";

export interface NavLinkItem { href: string; label: string; active?: boolean; }
export interface PillNavProps {
  brandName?: string;
  brandHref?: string;
  activeSection?: string;
  navLinks?: NavLinkItem[];
  actionsSlot?: ReactNode;
}

const DEFAULT_LINKS: NavLinkItem[] = [
  { href: "#hero", label: "Inicio" },
  { href: "#ciclo", label: "El Ciclo" },
  { href: "#pregunta", label: "¿Quién lo tiene?" },
  { href: "#hoy", label: "Vista Hoy" },
];

export function PillNav({
  brandName = "Hubly",
  brandHref = "/",
  activeSection = "inicio",
  navLinks = DEFAULT_LINKS,
  actionsSlot,
}: PillNavProps) {
  return (
    <header role="banner" className="hubly-pill-header" style={{ position: "absolute", top: tokens.space[6], left: tokens.space[0], right: tokens.space[0], zIndex: 20, display: "flex", justifyContent: "center", paddingInline: tokens.space[4], width: "100%", boxSizing: "border-box" }}>
      <nav aria-label="Navegación principal de Hubly" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[3], width: "100%", maxWidth: tokens.layout.heroWidth, flexWrap: "wrap", boxSizing: "border-box" }}>
        <a href={brandHref} style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2], paddingBlock: tokens.space[2], paddingInline: tokens.space[4], backgroundColor: tokens.pill.glassBg, border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`, borderRadius: tokens.radius.full, color: tokens.pill.glassText, textDecoration: "none", backdropFilter: `blur(${tokens.glass.blurMobile})`, WebkitBackdropFilter: `blur(${tokens.glass.blurMobile})` }}>
          <span style={{ width: tokens.space[3], height: tokens.space[3], borderRadius: tokens.radius.full, backgroundColor: tokens.color.accentWarm }} aria-hidden="true" />
          <strong style={{ fontSize: tokens.font.size.base, fontWeight: tokens.font.weight.bold, letterSpacing: tokens.font.tracking.tight }}>{brandName}</strong>
        </a>

        <ul className="hubly-pill-links" style={{ display: "inline-flex", alignItems: "center", listStyle: "none", margin: tokens.space[0], padding: tokens.space[1], gap: tokens.space[1], backgroundColor: tokens.pill.glassBg, border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`, borderRadius: tokens.radius.full, backdropFilter: `blur(${tokens.glass.blurMobile})`, WebkitBackdropFilter: `blur(${tokens.glass.blurMobile})`, flexWrap: "wrap" }}>
          {navLinks.map((link) => {
            const isActive = link.active ?? ((link.href === "#hero" && activeSection === "inicio") || (link.href === "#ciclo" && activeSection === "ciclo") || (link.href === "#pregunta" && activeSection === "pregunta") || (link.href === "#hoy" && activeSection === "hoy"));
            return (
              <li key={link.href}>
                <a href={link.href} className="hubly-pill-link" style={{ display: "inline-block", paddingBlock: tokens.space[2], paddingInline: tokens.space[4], borderRadius: tokens.radius.full, backgroundColor: isActive ? tokens.pill.activeBg : "transparent", color: isActive ? tokens.pill.activeText : tokens.pill.glassText, fontSize: tokens.font.size.xs, fontWeight: isActive ? tokens.font.weight.semibold : tokens.font.weight.medium, textDecoration: "none" }}>
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>

        <div style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2] }}>
          {actionsSlot ?? <ThemeToggle />}
        </div>
      </nav>
    </header>
  );
}

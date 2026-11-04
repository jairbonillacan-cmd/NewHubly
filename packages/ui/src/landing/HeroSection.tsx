import type { ReactNode } from "react";
import { Hubi } from "../components/brand/Hubi";
import { tokens } from "../tokens";
import { GlassCard } from "./GlassCard";

export interface HeroSectionProps {
  imageSrc?: string;
  headlineLine1?: string;
  headlineLine2?: string;
  subheadline?: string;
  glassCardsSlot?: ReactNode;
}

export function HeroSection({
  imageSrc = "/images/hero-studio.jpg",
  headlineLine1 = "Cada pieza de contenido.",
  headlineLine2 = "Sabe qué sigue y quién la tiene.",
  subheadline = "Hubly ordena el ciclo de cada pieza: desde la idea inicial hasta la métrica real, sin perder tiempo en chats dispersos ni adivinar quién tiene el turno.",
  glassCardsSlot,
}: HeroSectionProps) {
  return (
    <section id="hero" aria-label="Presentación principal de Hubly" style={{ position: "relative", minHeight: tokens.layout.heroMinHeight, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: tokens.color.surfaceBrand, color: tokens.color.surfaceBrandContrast, paddingTop: tokens.space[12], paddingBottom: tokens.space[10], paddingInline: tokens.space[4], boxSizing: "border-box", width: "100%" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: tokens.space[0], backgroundImage: `url(${imageSrc})`, backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: tokens.space[0], background: tokens.glass.heroOverlayVeil, zIndex: 1 }} />

      <div className="hubly-hero-content" style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: tokens.layout.heroWidth, marginInline: "auto", display: "flex", flexDirection: "column", gap: tokens.space[8], paddingTop: tokens.space[8], boxSizing: "border-box" }}>
        <div className="hubly-hero-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[5] }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2], paddingBlock: tokens.space[1], paddingInline: tokens.space[3], backgroundColor: tokens.pill.glassBg, border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`, borderRadius: tokens.radius.full, alignSelf: "flex-start", backdropFilter: `blur(${tokens.glass.blurMobile})`, WebkitBackdropFilter: `blur(${tokens.glass.blurMobile})` }}>
              <span style={{ width: tokens.space[2], height: tokens.space[2], borderRadius: tokens.radius.full, backgroundColor: tokens.color.accentPrimary }} aria-hidden="true" />
              <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, letterSpacing: tokens.font.tracking.wide, textTransform: "uppercase", color: tokens.pill.glassText }}>
                Flujo editorial para agencias
              </span>
            </div>

            <h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size.displayHero, lineHeight: tokens.font.leading.tight, fontWeight: tokens.font.weight.bold, letterSpacing: tokens.font.tracking.tighter, color: tokens.color.surfaceBrandContrast }}>
              <span style={{ display: "block" }}>{headlineLine1}</span>
              <span style={{ display: "block", color: tokens.color.surfaceBrandMuted }}>{headlineLine2}</span>
            </h1>

            <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.lg, lineHeight: tokens.font.leading.relaxed, color: tokens.color.surfaceBrandContrast, maxWidth: tokens.layout.readingWidth, opacity: 0.95 }}>
              {subheadline}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: tokens.space[4], flexWrap: "wrap", paddingTop: tokens.space[2] }}>
              <a href="#ciclo" style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2], paddingBlock: tokens.space[3], paddingInline: tokens.space[6], backgroundColor: tokens.color.surfaceBrandContrast, color: tokens.color.surfaceBrand, borderRadius: tokens.radius.full, fontWeight: tokens.font.weight.bold, fontSize: tokens.font.size.sm, textDecoration: "none" }}>
                <span>Conocer el ciclo</span>
                <span aria-hidden="true">→</span>
              </a>
              <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.surfaceBrandMuted }}>
                Sin tarjeta de crédito · Despliegue en tu agencia
              </span>
            </div>
          </div>

          {glassCardsSlot ?? (
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[4], width: "100%" }}>
              <GlassCard aria-label="Ejemplo de pieza editorial en Hubly">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[2] }}>
                  <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2] }}>
                    <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.bold, textTransform: "uppercase", letterSpacing: tokens.font.tracking.wider, paddingBlock: tokens.space[1], paddingInline: tokens.space[2], backgroundColor: tokens.glass.border, borderRadius: tokens.radius.sm, color: tokens.glass.textPrimary }}>Ejemplo</span>
                    <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, color: tokens.glass.textMuted }}>Campaña Primavera</span>
                  </div>
                  <span style={{ paddingBlock: tokens.space[1], paddingInline: tokens.space[2], backgroundColor: tokens.color.accentPrimarySubtle, color: tokens.color.accentPrimary, borderRadius: tokens.radius.sm, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold }}>Revisión interna</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[1] }}>
                  <h3 style={{ margin: tokens.space[0], fontSize: tokens.font.size.base, fontWeight: tokens.font.weight.semibold, color: tokens.glass.textPrimary }}>Carrusel: 5 aprendizajes de la campaña de primavera</h3>
                  <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, lineHeight: tokens.font.leading.normal, color: tokens.glass.textSecondary }}>Borrador completado y listo para revisión del director de arte antes de solicitar visto bueno.</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: tokens.space[2], fontSize: tokens.font.size.xs, color: tokens.glass.textMuted, gap: tokens.space[2], flexWrap: "wrap" }}>
                  <span>¿Quién la tiene?: <strong>Equipo creativo (hace 2h)</strong></span>
                  <span style={{ color: tokens.color.accentPrimary, fontWeight: tokens.font.weight.semibold }}>Auditoría (próximamente)</span>
                </div>
              </GlassCard>

              <GlassCard aria-label="La pregunta central de Hubly">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[3] }}>
                  <div style={{ display: "flex", alignItems: "center", gap: tokens.space[3] }}>
                    <Hubi acabado="volumen" pose="laptop" tamano={64} decorativo />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.bold, textTransform: "uppercase", letterSpacing: tokens.font.tracking.wide, color: tokens.glass.textMuted }}>Pregunta central</span>
                      <strong style={{ fontSize: tokens.font.size.sm, color: tokens.glass.textPrimary }}>«¿Qué sigue y quién lo tiene?»</strong>
                    </div>
                  </div>
                </div>
                <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.xs, lineHeight: tokens.font.leading.normal, color: tokens.glass.textSecondary }}>Cada miembro de la agencia y cada cliente saben exactamente quién tiene la acción en cada instante, sin reuniones de estatus ni hojas de cálculo.</p>
              </GlassCard>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

import { tokens } from "@hubly/ui";
import type { Metadata } from "next";
import { BentoSection } from "../../components/landing/BentoSection";
import { GlassCard } from "../../components/landing/GlassCard";
import { HeroSection } from "../../components/landing/HeroSection";
import { PillNav } from "../../components/landing/PillNav";
import { VariantBanner } from "../../components/landing/VariantBanner";

export const metadata: Metadata = {
  title: "Hubly · Variante 3: Ciclo y Trazabilidad (Landing)",
  description: "Variante enfocada en auditoría inmutable, marcas de tiempo UTC y flujo de publicación sin fricción.",
};

export default function Variante3Page() {
  const cardsSlot = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.space[4],
      }}
    >
      <GlassCard aria-label="Auditoría inmutable de transiciones de pieza">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: tokens.font.size.xs,
              fontWeight: tokens.font.weight.bold,
              textTransform: "uppercase",
              letterSpacing: tokens.font.tracking.wider,
              color: tokens.glass.textMuted,
            }}
          >
            Bitácora inmutable
          </span>
          <span
            style={{
              fontSize: tokens.font.size.xs,
              color: tokens.color.accentWarmText,
              fontWeight: tokens.font.weight.bold,
            }}
          >
            UTC audit
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
          <div
            style={{
              fontSize: tokens.font.size.xs,
              padding: tokens.space[2],
              backgroundColor: tokens.pill.glassBg,
              borderRadius: tokens.radius.sm,
              border: `${tokens.border.thin} solid ${tokens.glass.border}`,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span><strong>14:20 UTC:</strong> Borrador completado</span>
            <span style={{ color: tokens.glass.textMuted }}>@copywriter</span>
          </div>

          <div
            style={{
              fontSize: tokens.font.size.xs,
              padding: tokens.space[2],
              backgroundColor: tokens.pill.glassBg,
              borderRadius: tokens.radius.sm,
              border: `${tokens.border.thin} solid ${tokens.glass.border}`,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span><strong>15:45 UTC:</strong> Visto bueno interno</span>
            <span style={{ color: tokens.glass.textMuted }}>@director</span>
          </div>

          <div
            style={{
              fontSize: tokens.font.size.xs,
              padding: tokens.space[2],
              backgroundColor: tokens.color.accentWarmSubtle,
              color: tokens.color.accentWarmText,
              borderRadius: tokens.radius.sm,
              border: `${tokens.border.thin} solid ${tokens.color.accentWarm}`,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span><strong>16:02 UTC:</strong> Enviado a aprobación</span>
            <strong>En espera</strong>
          </div>
        </div>

        <p
          style={{
            margin: tokens.space[0],
            fontSize: tokens.font.size.xs,
            color: tokens.glass.textSecondary,
          }}
        >
          Constitución #2: La pieza es la columna vertebral. Cada transición queda auditada.
        </p>
      </GlassCard>

      <GlassCard aria-label="Entrada rápida sin modales">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong style={{ fontSize: tokens.font.size.sm, color: tokens.glass.textPrimary }}>
            Captura ágil en 1 línea
          </strong>
          <kbd
            style={{
              paddingBlock: tokens.space[0],
              paddingInline: tokens.space[2],
              backgroundColor: tokens.pill.glassBg,
              border: `${tokens.border.thin} solid ${tokens.glass.border}`,
              borderRadius: tokens.radius.sm,
              fontSize: tokens.font.size.xs,
              fontFamily: tokens.font.mono,
              color: tokens.glass.textPrimary,
            }}
          >
            c
          </kbd>
        </div>
        <p
          style={{
            margin: tokens.space[0],
            fontSize: tokens.font.size.xs,
            color: tokens.glass.textSecondary,
            lineHeight: tokens.font.leading.normal,
          }}
        >
          Presiona «c» o «/» para capturar una idea o pendiente al instante sin salir de tu flujo de trabajo.
        </p>
      </GlassCard>
    </div>
  );

  return (
    <div style={{ position: "relative", minHeight: tokens.layout.viewportHeight }}>
      <VariantBanner currentVariant="variante-3" />
      <PillNav currentVariant="variante-3" activeSection="inicio" />
      <main>
        <HeroSection
          variant="variante-3"
          imageSrc="/images/hero-studio.jpg"
          headlineLine1="Del primer borrador a la métrica."
          headlineLine2="Sin adivinar el estado de nada."
          subheadline="Trazabilidad matemática para cada publicación: fechas, autores, estados y aprobaciones auditadas en un sistema transparente."
          glassCardsSlot={cardsSlot}
        />
        <BentoSection layoutVariant="timeline" />
      </main>
    </div>
  );
}

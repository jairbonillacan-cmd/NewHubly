import { tokens } from "@hubly/ui";
import type { Metadata } from "next";
import { BentoSection } from "../../components/landing/BentoSection";
import { GlassCard } from "../../components/landing/GlassCard";
import { HeroSection } from "../../components/landing/HeroSection";
import { PillNav } from "../../components/landing/PillNav";
import { VariantBanner } from "../../components/landing/VariantBanner";

export const metadata: Metadata = {
  title: "Hubly · Variante 2: Bento Integrado (Landing)",
  description: "Variante con titular centrado y tarjeta de cristal monumental conectando con el bento.",
};

export default function Variante2Page() {
  const centralCardSlot = (
    <div
      style={{
        maxWidth: tokens.layout.readingWidth,
        marginInline: "auto",
        width: "100%",
        paddingTop: tokens.space[4],
      }}
    >
      <GlassCard aria-label="Tablero vivo de piezas activas y turno de cliente">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `${tokens.border.thin} solid ${tokens.glass.border}`,
            paddingBottom: tokens.space[3],
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2] }}>
            <span
              style={{
                width: tokens.space[2],
                height: tokens.space[2],
                borderRadius: tokens.radius.full,
                backgroundColor: tokens.color.accentWarm,
              }}
              aria-hidden="true"
            />
            <strong style={{ fontSize: tokens.font.size.sm, color: tokens.glass.textPrimary }}>
              Piezas en vuelo · Vista de cuenta
            </strong>
          </div>
          <span
            style={{
              fontSize: tokens.font.size.xs,
              paddingBlock: tokens.space[1],
              paddingInline: tokens.space[2],
              backgroundColor: tokens.color.accentWarmSubtle,
              color: tokens.color.accentWarmText,
              borderRadius: tokens.radius.sm,
              fontWeight: tokens.font.weight.semibold,
            }}
          >
            3 piezas activas
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[3] }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: tokens.space[3],
              backgroundColor: tokens.pill.glassBg,
              borderRadius: tokens.radius.md,
              border: `${tokens.border.thin} solid ${tokens.glass.border}`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[0] }}>
              <span style={{ fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold, color: tokens.glass.textPrimary }}>
                Pieza #104 · Carrusel campaña primavera
              </span>
              <span style={{ fontSize: tokens.font.size.xs, color: tokens.glass.textSecondary }}>
                Turno: <strong>Cliente de la marca (hace 2h)</strong>
              </span>
            </div>
            <span
              style={{
                fontSize: tokens.font.size.xs,
                color: tokens.color.accentWarmText,
                fontWeight: tokens.font.weight.bold,
              }}
            >
              Aprobación del cliente
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: tokens.space[3],
              backgroundColor: tokens.pill.glassBg,
              borderRadius: tokens.radius.md,
              border: `${tokens.border.thin} solid ${tokens.glass.border}`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[0] }}>
              <span style={{ fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold, color: tokens.glass.textPrimary }}>
                Pieza #105 · Video corto: Lanzamiento producto B
              </span>
              <span style={{ fontSize: tokens.font.size.xs, color: tokens.glass.textSecondary }}>
                Turno: <strong>Director creativo (hace 35m)</strong>
              </span>
            </div>
            <span
              style={{
                fontSize: tokens.font.size.xs,
                color: tokens.glass.textMuted,
                fontWeight: tokens.font.weight.medium,
              }}
            >
              Revisión interna
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: tokens.font.size.xs,
            color: tokens.glass.textMuted,
            paddingTop: tokens.space[1],
          }}
        >
          <span>Constitución #1: «¿Qué sigue y quién lo tiene?»</span>
          <span style={{ color: tokens.color.accentWarmText }}>Auditoría inmutable activa</span>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <div style={{ position: "relative", minHeight: tokens.layout.viewportHeight }}>
      <VariantBanner currentVariant="variante-2" />
      <PillNav currentVariant="variante-2" activeSection="inicio" />
      <main>
        <HeroSection
          variant="variante-2"
          imageSrc="/images/hero-workshop.jpg"
          headlineLine1="Cada pieza de contenido."
          headlineLine2="Sabe qué sigue y quién la tiene."
          subheadline="Un modelo operativo para agencias que sustituye el caos de mensajes por transiciones claras, auditoría rigurosa y aprobación de clientes en un solo clic."
          glassCardsSlot={centralCardSlot}
        />
        <BentoSection layoutVariant="integrated" />
      </main>
    </div>
  );
}

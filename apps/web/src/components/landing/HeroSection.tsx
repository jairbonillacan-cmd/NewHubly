import { tokens } from "@hubly/ui";
import type { ReactNode } from "react";
import { GlassCard } from "./GlassCard";

export interface HeroSectionProps {
  variant?: "variante-1" | "variante-2" | "variante-3";
  imageSrc?: string;
  headlineLine1?: string;
  headlineLine2?: string;
  subheadline?: string;
  glassCardsSlot?: ReactNode;
}

export function HeroSection({
  variant = "variante-1",
  imageSrc = "/images/hero-studio.jpg",
  headlineLine1 = "El trabajo de tu agencia.",
  headlineLine2 = "Bajo control, en una sola vista.",
  subheadline = "Hubly ordena el ciclo de cada pieza: desde la idea inicial hasta la métrica real, sin perder tiempo en chats dispersos ni adivinar quién tiene el turno.",
  glassCardsSlot,
}: HeroSectionProps) {
  return (
    <section
      id="hero"
      aria-label="Presentación principal de Hubly"
      style={{
        position: "relative",
        minHeight: tokens.layout.heroMinHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: tokens.color.surfaceBrand,
        color: tokens.color.surfaceBrandContrast,
        paddingTop: tokens.space[12],
        paddingBottom: tokens.space[10],
        paddingInline: tokens.space[4],
      }}
    >
      {/* Fotografía editorial real de fondo a sangre */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: tokens.space[0],
          backgroundImage: `url(${imageSrc})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          zIndex: 0,
        }}
      />

      {/* Velo cálido terracota y gradiente protector para garantizar contraste WCAG 2.2 AA (>= 4.5:1) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: tokens.space[0],
          background: tokens.glass.heroOverlayVeil,
          zIndex: 1,
        }}
      />

      {/* Contenido principal del hero */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: tokens.layout.heroWidth,
          marginInline: "auto",
          display: "flex",
          flexDirection: "column",
          gap: tokens.space[8],
          paddingTop: tokens.space[8],
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: variant === "variante-2" ? "1fr" : "minmax(0, 1.25fr) minmax(0, 0.95fr)",
            gap: tokens.space[8],
            alignItems: "center",
          }}
        >
          {/* Bloque de texto editorial: Titular grande de 2 líneas + párrafo */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.space[5],
              maxWidth: variant === "variante-2" ? tokens.layout.readingWidth : "none",
              marginInline: variant === "variante-2" ? "auto" : "0",
              textAlign: variant === "variante-2" ? "center" : "left",
            }}
          >
            {/* Píldora de estado de producto real */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: tokens.space[2],
                paddingBlock: tokens.space[1],
                paddingInline: tokens.space[3],
                backgroundColor: tokens.pill.glassBg,
                border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`,
                borderRadius: tokens.radius.full,
                alignSelf: variant === "variante-2" ? "center" : "flex-start",
                backdropFilter: `blur(${tokens.glass.blurMobile})`,
                WebkitBackdropFilter: `blur(${tokens.glass.blurMobile})`,
              }}
            >
              <span
                style={{
                  width: tokens.space[2],
                  height: tokens.space[2],
                  borderRadius: tokens.radius.full,
                  backgroundColor: tokens.color.accentWarm,
                }}
                aria-hidden="true"
              />
              <span
                style={{
                  fontSize: tokens.font.size.xs,
                  fontWeight: tokens.font.weight.semibold,
                  letterSpacing: tokens.font.tracking.wide,
                  textTransform: "uppercase",
                  color: tokens.pill.glassText,
                }}
              >
                Trazabilidad editorial para agencias
              </span>
            </div>

            {/* Titular en sans gruesa de dos líneas exactas */}
            <h1
              style={{
                margin: tokens.space[0],
                fontSize: tokens.font.size.displayHero,
                lineHeight: tokens.font.leading.tight,
                fontWeight: tokens.font.weight.bold,
                letterSpacing: tokens.font.tracking.tighter,
                color: tokens.color.surfaceBrandContrast,
              }}
            >
              <span style={{ display: "block" }}>{headlineLine1}</span>
              <span style={{ display: "block", color: tokens.color.surfaceBrandMuted }}>{headlineLine2}</span>
            </h1>

            {/* Párrafo corto honesto */}
            <p
              style={{
                margin: tokens.space[0],
                fontSize: tokens.font.size.lg,
                lineHeight: tokens.font.leading.relaxed,
                color: tokens.color.surfaceBrandContrast,
                maxWidth: tokens.layout.readingWidth,
                opacity: 0.95,
              }}
            >
              {subheadline}
            </p>

            {/* Acciones principales */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: tokens.space[4],
                paddingTop: tokens.space[2],
                flexWrap: "wrap",
                justifyContent: variant === "variante-2" ? "center" : "flex-start",
              }}
            >
              <a
                href="#ciclo"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: tokens.space[2],
                  paddingBlock: tokens.space[3],
                  paddingInline: tokens.space[6],
                  backgroundColor: tokens.color.surfaceBrandContrast,
                  color: tokens.color.surfaceBrand,
                  borderRadius: tokens.radius.full,
                  fontSize: tokens.font.size.sm,
                  fontWeight: tokens.font.weight.semibold,
                  textDecoration: "none",
                  boxShadow: tokens.glass.shadow,
                }}
              >
                Explorar el ciclo de la pieza →
              </a>
              <a
                href="#pregunta"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: tokens.space[2],
                  paddingBlock: tokens.space[3],
                  paddingInline: tokens.space[5],
                  backgroundColor: tokens.pill.glassBg,
                  color: tokens.pill.glassText,
                  border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`,
                  borderRadius: tokens.radius.full,
                  fontSize: tokens.font.size.sm,
                  fontWeight: tokens.font.weight.medium,
                  textDecoration: "none",
                  backdropFilter: `blur(${tokens.glass.blurMobile})`,
                  WebkitBackdropFilter: `blur(${tokens.glass.blurMobile})`,
                }}
              >
                Ver pregunta central
              </a>
            </div>
          </div>

          {/* Tarjetas de cristal (liquid glass) flotantes sobre la foto */}
          {glassCardsSlot ? (
            glassCardsSlot
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: tokens.space[4],
              }}
            >
              {/* Tarjeta de Cristal 1: Pieza en curso */}
              <GlassCard aria-label="Ejemplo real: Pieza en curso con etapa y responsable actual">
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
                        fontSize: tokens.font.size.xs,
                        fontWeight: tokens.font.weight.bold,
                        textTransform: "uppercase",
                        letterSpacing: tokens.font.tracking.wider,
                        color: tokens.glass.textMuted,
                      }}
                    >
                      Pieza #104 · Instagram
                    </span>
                  </div>
                  <span
                    style={{
                      paddingBlock: tokens.space[1],
                      paddingInline: tokens.space[2],
                      backgroundColor: tokens.color.accentWarmSubtle,
                      color: tokens.color.accentWarmText,
                      borderRadius: tokens.radius.sm,
                      fontSize: tokens.font.size.xs,
                      fontWeight: tokens.font.weight.semibold,
                    }}
                  >
                    Aprobación del cliente
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
                  <h3
                    style={{
                      margin: tokens.space[0],
                      fontSize: tokens.font.size.base,
                      fontWeight: tokens.font.weight.semibold,
                      color: tokens.glass.textPrimary,
                    }}
                  >
                    Carrusel: 5 aprendizajes de la campaña de primavera
                  </h3>
                  <p
                    style={{
                      margin: tokens.space[0],
                      fontSize: tokens.font.size.sm,
                      lineHeight: tokens.font.leading.normal,
                      color: tokens.glass.textSecondary,
                    }}
                  >
                    Enlace de portal enviado a <strong>cliente@marca.com</strong>. Esperando validación o ajustes en una sola vista sin login.
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: tokens.space[2],
                    fontSize: tokens.font.size.xs,
                    color: tokens.glass.textMuted,
                  }}
                >
                  <span>¿Quién lo tiene?: <strong>Cliente (hace 2h)</strong></span>
                  <span style={{ color: tokens.color.accentWarmText, fontWeight: tokens.font.weight.semibold }}>Auditoría activa</span>
                </div>
              </GlassCard>

              {/* Tarjeta de Cristal 2: La regla de oro */}
              <GlassCard aria-label="La pregunta central de Hubly">
                <div style={{ display: "flex", alignItems: "center", gap: tokens.space[3] }}>
                  <div
                    style={{
                      width: tokens.space[8],
                      height: tokens.space[8],
                      borderRadius: tokens.radius.full,
                      backgroundColor: tokens.color.surfaceBrand,
                      color: tokens.color.surfaceBrandContrast,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: tokens.font.size.base,
                      fontWeight: tokens.font.weight.bold,
                    }}
                    aria-hidden="true"
                  >
                    ?
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontSize: tokens.font.size.xs,
                        fontWeight: tokens.font.weight.bold,
                        textTransform: "uppercase",
                        letterSpacing: tokens.font.tracking.wide,
                        color: tokens.glass.textMuted,
                      }}
                    >
                      Constitución #1
                    </span>
                    <strong style={{ fontSize: tokens.font.size.sm, color: tokens.glass.textPrimary }}>
                      «¿Qué sigue y quién lo tiene?»
                    </strong>
                  </div>
                </div>
                <p
                  style={{
                    margin: tokens.space[0],
                    fontSize: tokens.font.size.xs,
                    lineHeight: tokens.font.leading.normal,
                    color: tokens.glass.textSecondary,
                  }}
                >
                  Cada miembro de la agencia y cada cliente saben exactamente quién tiene la acción en cada instante, sin reuniones de estatus ni hojas de cálculo.
                </p>
              </GlassCard>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

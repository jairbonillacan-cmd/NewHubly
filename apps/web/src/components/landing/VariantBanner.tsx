import { tokens } from "@hubly/ui";
import Link from "next/link";

export interface VariantBannerProps {
  currentVariant: "variante-1" | "variante-2" | "variante-3";
}

export function VariantBanner({ currentVariant }: VariantBannerProps) {
  const descriptions = {
    "variante-1": "Variante 1: Editorial Pura · Hero a sangre con tarjetas gemelas de cristal y bento clásico asimétrico.",
    "variante-2": "Variante 2: Bento Integrado · Hero con titular centrado, tarjeta de cristal monumental y puente visual al bento.",
    "variante-3": "Variante 3: Ciclo y Trazabilidad · Foco en auditoría cronológica, marcas de tiempo UTC y flujo de publicación.",
  };

  return (
    <aside
      aria-label="Panel de variantes para decisión del dueño de NewHubly"
      style={{
        backgroundColor: tokens.color.surfaceBrand,
        color: tokens.color.surfaceBrandContrast,
        borderBottom: `${tokens.border.thin} solid ${tokens.color.surfaceBrandSubtle}`,
        paddingBlock: tokens.space[2],
        paddingInline: tokens.space[4],
        fontSize: tokens.font.size.xs,
      }}
    >
      <div
        style={{
          maxWidth: tokens.layout.heroWidth,
          marginInline: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: tokens.space[2],
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2] }}>
          <span
            style={{
              paddingBlock: tokens.space[0],
              paddingInline: tokens.space[2],
              backgroundColor: tokens.color.accentWarm,
              borderRadius: tokens.radius.sm,
              fontWeight: tokens.font.weight.bold,
              textTransform: "uppercase",
              fontSize: tokens.font.size.xs,
              color: tokens.color.textOnAccent,
            }}
          >
            Fase 1B · Issue #8
          </span>
          <span style={{ fontWeight: tokens.font.weight.medium }}>
            {descriptions[currentVariant]}
          </span>
        </div>

        <nav aria-label="Cambiar entre variantes de la landing" style={{ display: "flex", alignItems: "center", gap: tokens.space[1] }}>
          <span style={{ color: tokens.color.surfaceBrandMuted, marginRight: tokens.space[1] }}>Elegir variante:</span>
          <Link
            href="/variante-1"
            style={{
              paddingBlock: tokens.space[1],
              paddingInline: tokens.space[2],
              borderRadius: tokens.radius.sm,
              backgroundColor: currentVariant === "variante-1" ? tokens.color.surfaceBrandContrast : "transparent",
              color: currentVariant === "variante-1" ? tokens.color.surfaceBrand : tokens.color.surfaceBrandContrast,
              fontWeight: currentVariant === "variante-1" ? tokens.font.weight.bold : tokens.font.weight.regular,
              textDecoration: "none",
            }}
          >
            V1: Editorial
          </Link>
          <Link
            href="/variante-2"
            style={{
              paddingBlock: tokens.space[1],
              paddingInline: tokens.space[2],
              borderRadius: tokens.radius.sm,
              backgroundColor: currentVariant === "variante-2" ? tokens.color.surfaceBrandContrast : "transparent",
              color: currentVariant === "variante-2" ? tokens.color.surfaceBrand : tokens.color.surfaceBrandContrast,
              fontWeight: currentVariant === "variante-2" ? tokens.font.weight.bold : tokens.font.weight.regular,
              textDecoration: "none",
            }}
          >
            V2: Bento Integrado
          </Link>
          <Link
            href="/variante-3"
            style={{
              paddingBlock: tokens.space[1],
              paddingInline: tokens.space[2],
              borderRadius: tokens.radius.sm,
              backgroundColor: currentVariant === "variante-3" ? tokens.color.surfaceBrandContrast : "transparent",
              color: currentVariant === "variante-3" ? tokens.color.surfaceBrand : tokens.color.surfaceBrandContrast,
              fontWeight: currentVariant === "variante-3" ? tokens.font.weight.bold : tokens.font.weight.regular,
              textDecoration: "none",
            }}
          >
            V3: Trazabilidad
          </Link>
        </nav>
      </div>
    </aside>
  );
}

import type { CSSProperties } from "react";

export type HubiFinish = "origen" | "volumen";
export type HubiPose = "sentado" | "laptop";

export interface HubiProps {
  acabado?: HubiFinish;
  pose?: HubiPose;
  tamano?: number;
  alt?: string;
  decorativo?: boolean;
  className?: string;
  style?: CSSProperties;
  sizing?: "fixed" | "css";
  prioridad?: "alta" | "diferida";
}

const HUBI_ASSET_MAP: Record<HubiFinish, Record<HubiPose, { light: string; dark: string }>> = {
  origen: {
    sentado: {
      light: "/marca/hubi-origen-claro-256.webp",
      dark: "/marca/hubi-origen-oscuro-256.webp",
    },
    laptop: {
      light: "/marca/hubi-origen-claro-laptop-256.webp",
      dark: "/marca/hubi-origen-oscuro-laptop-256.webp",
    },
  },
  volumen: {
    sentado: {
      light: "/marca/hubi-volumen-claro-256.webp",
      dark: "/marca/hubi-volumen-oscuro-256.webp",
    },
    laptop: {
      light: "/marca/hubi-volumen-claro-laptop-512.webp",
      dark: "/marca/hubi-volumen-oscuro-laptop-512.webp",
    },
  },
};

export function Hubi({
  acabado = "origen",
  pose = "sentado",
  tamano = 128,
  alt,
  decorativo,
  className,
  style,
  sizing = "fixed",
  prioridad,
}: HubiProps) {
  const isDecorative = decorativo ?? !alt;
  const resolvedAlt = isDecorative ? "" : (alt ?? "Hubi, mascota de Hubly");
  const pair = HUBI_ASSET_MAP[acabado][pose];

  return (
    <span
      className={className ? `hubly-hubi ${className}` : "hubly-hubi"}
      aria-hidden={isDecorative ? "true" : undefined}
      style={sizing === "css" ? style : { width: tamano, height: tamano, ...style }}
    >
      <img
        src={pair.light}
        alt={resolvedAlt}
        width={tamano}
        height={tamano}
        decoding="async"
        loading={prioridad === "diferida" ? "lazy" : undefined}
        fetchPriority={prioridad === "alta" ? "high" : undefined}
        className="hubly-hubi-img hubly-hubi-light"
      />
      <img
        src={pair.dark}
        alt={resolvedAlt}
        width={tamano}
        height={tamano}
        decoding="async"
        loading={prioridad === "diferida" ? "lazy" : undefined}
        fetchPriority={prioridad === "alta" ? "high" : undefined}
        className="hubly-hubi-img hubly-hubi-dark"
      />
    </span>
  );
}

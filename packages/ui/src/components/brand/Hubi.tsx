import type { CSSProperties } from "react";

export type HubiFinish = "origen" | "volumen";
type HubiBasePose = "sentado" | "laptop";
type HubiStatePose = "bienvenida" | "buscar" | "reparar";
export type HubiPose = HubiBasePose | HubiStatePose;

export type HubiProps = {
  tamano?: number;
  alt?: string;
  decorativo?: boolean;
  className?: string;
  style?: CSSProperties;
  sizing?: "fixed" | "css";
  priority?: "high" | "deferred";
} & (
  | { acabado?: HubiFinish; pose?: HubiBasePose }
  | { acabado?: "volumen"; pose: HubiStatePose }
);

type ThemeAssets = { light: string; dark: string };

const HUBI_ASSET_MAP: Record<HubiFinish, Record<HubiBasePose, ThemeAssets>> = {
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

const HUBI_STATE_ASSETS: Record<HubiStatePose, ThemeAssets> = {
  bienvenida: {
    light: "/marca/hubi-volumen-bienvenida-claro-256.webp",
    dark: "/marca/hubi-volumen-bienvenida-oscuro-256.webp",
  },
  buscar: {
    light: "/marca/hubi-volumen-buscar-claro-256.webp",
    dark: "/marca/hubi-volumen-buscar-oscuro-256.webp",
  },
  reparar: {
    light: "/marca/hubi-volumen-reparar-claro-256.webp",
    dark: "/marca/hubi-volumen-reparar-oscuro-256.webp",
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
  priority,
}: HubiProps) {
  const isDecorative = decorativo ?? !alt;
  const resolvedAlt = isDecorative ? "" : (alt ?? "Hubi, mascota de Hubly");
  const pair = pose === "sentado" || pose === "laptop"
    ? HUBI_ASSET_MAP[acabado][pose]
    : HUBI_STATE_ASSETS[pose];

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
        loading={priority === "deferred" ? "lazy" : undefined}
        fetchPriority={priority === "high" ? "high" : undefined}
        className="hubly-hubi-img hubly-hubi-light"
      />
      <img
        src={pair.dark}
        alt={resolvedAlt}
        width={tamano}
        height={tamano}
        decoding="async"
        loading={priority === "deferred" ? "lazy" : undefined}
        fetchPriority={priority === "high" ? "high" : undefined}
        className="hubly-hubi-img hubly-hubi-dark"
      />
    </span>
  );
}

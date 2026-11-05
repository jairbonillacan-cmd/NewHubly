import type { CSSProperties } from "react";

export interface HublySymbolProps {
  size?: number;
  decorative?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export interface HublyWordmarkProps {
  height?: number;
  decorative?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

function SymbolModules() {
  return (
    <g>
      <path
        d="M68 0 L150 0 Q164 0 160.8 13.6 L146.8 46.4 Q143.6 60 129.6 60 L54 60 Q40 60 43.2 46.4 L57.2 13.6 Q60.4 0 68 0 Z"
        fill="var(--text-primary, currentColor)"
      />
      <path
        d="M276 0 L358 0 Q372 0 368.8 13.6 L354.8 46.4 Q351.6 60 337.6 60 L262 60 Q248 60 251.2 46.4 L265.2 13.6 Q268.4 0 276 0 Z"
        fill="var(--text-primary, currentColor)"
      />
      <path
        d="M50 78 L344 78 Q358 78 354.8 91.6 L339.8 128.4 Q336.6 142 322.6 142 L35 142 Q21 142 24.2 128.4 L39.2 91.6 Q42.4 78 50 78 Z"
        fill="var(--accent-primary)"
      />
      <path
        d="M30 160 L112 160 Q126 160 122.8 173.6 L108.8 206.4 Q105.6 220 91.6 220 L16 220 Q2 220 5.2 206.4 L19.2 173.6 Q22.4 160 30 160 Z"
        fill="var(--text-primary, currentColor)"
      />
      <path
        d="M244 160 L326 160 Q340 160 336.8 173.6 L322.8 206.4 Q319.6 220 305.6 220 L230 220 Q216 220 219.2 206.4 L233.2 173.6 Q236.4 160 244 160 Z"
        fill="var(--text-primary, currentColor)"
      />
    </g>
  );
}

function WordmarkLetters() {
  return (
    <g fill="var(--text-primary, currentColor)" fillRule="evenodd">
      {/* H */}
      <path d="M448 0 H472 Q480 0 480 8 V78 H552 V8 Q552 0 560 0 H584 Q592 0 592 8 V190 Q592 198 584 198 H560 Q552 198 552 190 V114 H480 V190 Q480 198 472 198 H448 Q440 198 440 190 V8 Q440 0 448 0 Z" />
      {/* u */}
      <path d="M625 53 H649 Q657 53 657 61 V142 Q657 166 683 166 Q709 166 713 142 V61 Q713 53 721 53 H745 Q753 53 753 61 V190 Q753 198 745 198 H723 Q715 198 715 190 V180 Q699 201 671 201 Q617 201 617 146 V61 Q617 53 625 53 Z" />
      {/* b */}
      <path d="M784 0 H808 Q816 0 816 8 V68 Q832 50 858 50 Q914 50 914 125 Q914 201 858 201 Q830 201 814 182 V190 Q814 198 806 198 H784 Q776 198 776 190 V8 Q776 0 784 0 Z M846 84 Q816 84 816 125 Q816 167 846 167 Q874 167 874 125 Q874 84 846 84 Z" />
      {/* l */}
      <path d="M930 0 H994 Q1002 0 1002 8 V164 H1035 Q1043 164 1043 172 V190 Q1043 198 1035 198 H930 Q922 198 922 190 V172 Q922 164 930 164 H962 V34 H930 Q922 34 922 26 V8 Q922 0 930 0 Z" />
      {/* y */}
      <path d="M1054 53 H1080 Q1087 53 1090 60 L1123 152 L1156 60 Q1159 53 1166 53 H1190 Q1199 53 1195 62 L1133 224 Q1117 264 1076 264 H1060 Q1052 264 1052 256 V238 Q1052 230 1060 230 H1073 Q1093 230 1101 208 L1105 197 L1047 62 Q1043 53 1054 53 Z" />
    </g>
  );
}

export function HublySymbol({
  size = 28,
  decorative = false,
  ariaLabel = "Hubly",
  className,
  style,
}: HublySymbolProps) {
  const width = Math.round((size * 380) / 220);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 380 220"
      width={width}
      height={size}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative ? "true" : undefined}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
    >
      <SymbolModules />
    </svg>
  );
}

export function HublyWordmark({
  height = 28,
  decorative = false,
  ariaLabel = "Hubly",
  className,
  style,
}: HublyWordmarkProps) {
  const width = Math.round((height * 1210) / 264);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1210 264"
      width={width}
      height={height}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative ? "true" : undefined}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
    >
      <g aria-hidden="true" transform="translate(0, 6)">
        <SymbolModules />
      </g>
      <WordmarkLetters />
    </svg>
  );
}

/** Cara de Hubi según el tema activo; decorativa (la etiqueta la pone quien la usa). */
export function HubiFace({ className = "size-8" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`hubly-hubi-face relative inline-block shrink-0 ${className}`}>
      <img src="/marca/hubi-cara-claro-128.webp" alt="" width={64} height={64} className={`hubly-hubi-light ${className}`} />
      <img src="/marca/hubi-cara-oscuro-128.webp" alt="" width={64} height={64} className={`hubly-hubi-dark ${className}`} />
    </span>
  );
}

export interface HubiWordmarkProps {
  /** «md» para barras de navegación, «sm» para pies de página. */
  tamano?: "md" | "sm";
  className?: string;
}

const HUBI_WORDMARK_SIZE = {
  md: { face: "size-8", letters: "h-5" },
  sm: { face: "size-6", letters: "h-4" },
} as const;

/** Firma del landing (#85): la cara de Hubi según el tema activo junto a las letras de «Hubly». */
export function HubiWordmark({ tamano = "md", className }: HubiWordmarkProps) {
  const size = HUBI_WORDMARK_SIZE[tamano];
  return (
    <span role="img" aria-label="Hubly" className={`hubly-hubi-wordmark inline-flex items-center gap-2 ${className ?? ""}`}>
      <HubiFace className={size.face} />
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="436 -4 768 272" aria-hidden="true" className={`w-auto shrink-0 ${size.letters}`}>
        <WordmarkLetters />
      </svg>
    </span>
  );
}

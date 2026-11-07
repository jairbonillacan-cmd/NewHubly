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

/** Letras de «Hubly Pop Editorial» (viewBox 0 0 402 132). El color sale de `currentColor`, que el logo toma de `--logo-color`. */
const WORDMARK_VIEWBOX = "0 0 402 132";
const WORDMARK_RATIO = 402 / 132;

function WordmarkLetters() {
  return (
    <g fill="currentColor" fillRule="evenodd">
      {/* H */}
      <path d="M4 16 Q3 11 12 10 Q21 8 30 3 Q38 0 38 9 V45 Q48 35 61 35 Q85 35 85 58 V79 Q85 86 90 87 Q96 89 94 94 Q94 98 87 98 H61 Q54 98 54 94 Q53 90 58 87 Q62 85 62 79 V61 Q62 53 54 53 Q45 53 38 62 V78 Q38 85 43 87 Q49 90 47 94 Q47 98 40 98 H12 Q4 98 4 93 Q4 90 10 87 Q15 85 15 78 V27 Q15 21 10 21 Q5 21 4 16 Z" />
      {/* u */}
      <path d="M97 39 L120 35 Q126 34 126 40 V72 Q126 81 135 81 Q144 81 149 73 V51 Q149 46 144 46 Q139 46 139 42 Q139 38 145 38 L166 35 Q172 34 172 40 V80 Q172 86 177 87 Q182 88 181 93 Q181 98 174 98 H156 Q150 98 149 92 Q142 100 128 100 Q103 100 103 76 V52 Q103 47 98 46 Q92 46 92 43 Q92 40 97 39 Z" />
      {/* b */}
      <path d="M185 15 Q185 11 192 10 Q201 9 210 4 Q218 1 218 9 V43 Q227 35 241 35 Q266 35 269 61 Q271 91 251 98 Q232 105 216 91 L215 94 Q213 98 208 98 H192 Q185 98 185 93 Q185 90 191 87 Q195 85 195 79 V28 Q195 22 191 21 Q185 21 185 15 Z M228 53 Q218 56 217 69 Q217 82 228 84 Q240 86 243 72 Q246 57 235 53 Q232 52 228 53 Z" />
      {/* l */}
      <path d="M275 15 Q275 11 282 10 Q292 8 299 4 Q306 1 306 9 V76 Q306 86 312 88 Q318 90 318 94 Q317 98 310 98 H281 Q273 98 273 93 Q274 90 280 87 Q284 85 284 79 V28 Q284 22 280 21 Q275 21 275 15 Z" />
      {/* y */}
      <path d="M320 42 Q320 37 327 37 H353 Q360 37 360 42 Q360 45 355 48 Q352 51 354 56 L364 76 L373 54 Q375 49 370 47 Q366 45 367 41 Q367 37 373 37 H394 Q400 37 400 42 Q400 46 394 48 Q390 50 388 56 L367 105 Q356 129 337 129 Q323 129 320 120 Q317 111 325 108 Q331 105 337 110 Q343 115 350 106 Q353 102 354 99 L332 56 Q329 50 325 48 Q320 47 320 42 Z" />
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

/** Logo «Hubly Pop Editorial»: SVG en línea que se ajusta por altura sin deformarse y toma su color de `--logo-color`. */
export function HublyWordmark({
  height = 28,
  decorative = false,
  ariaLabel = "Hubly",
  className,
  style,
}: HublyWordmarkProps) {
  const width = Math.round(height * WORDMARK_RATIO);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={WORDMARK_VIEWBOX}
      width={width}
      height={height}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative ? "true" : undefined}
      className={`hubly-logo ${className ?? ""}`.trim()}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
    >
      <WordmarkLetters />
    </svg>
  );
}

/** Cara basada en Hubi Origen de cuerpo completo; decorativa. */
export function HubiFace({ className = "size-8" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 320"
      width={32}
      height={32}
      aria-hidden="true"
      focusable="false"
      className={`hubly-hubi-face shrink-0 ${className}`}
    >
      <path d="M40 137 C49 107 62 66 75 66 C88 66 101 88 113 111 Z" fill="var(--text-primary)" />
      <path d="M207 111 C222 89 235 66 247 66 C263 66 273 99 283 137 Z" fill="var(--accent-primary)" />
      <path
        d="M108 109 H207 C240 109 265 116 281 135 C292 148 298 166 298 186 C298 225 269 253 229 254 H91 C51 253 22 225 22 186 C22 165 29 148 41 133 C57 114 80 109 108 109 Z"
        fill="var(--text-primary)"
      />
      <g fill="var(--surface-canvas)">
        <ellipse cx={110} cy={178} rx={8.5} ry={14} />
        <ellipse cx={210} cy={178} rx={8.5} ry={14} />
      </g>
      <path
        d="M140 194 C143 204 156 204 160 194 C164 204 177 204 180 194"
        fill="none"
        stroke="var(--surface-canvas)"
        strokeWidth={8.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

/** Firma de Hubly (#101): la cara de Hubi junto a las letras de «Hubly». */
export function HubiWordmark({ tamano = "md", className }: HubiWordmarkProps) {
  const size = HUBI_WORDMARK_SIZE[tamano];
  return (
    <span role="img" aria-label="Hubly" className={`hubly-hubi-wordmark inline-flex items-center gap-2 ${className ?? ""}`}>
      <HubiFace className={size.face} />
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={WORDMARK_VIEWBOX} aria-hidden="true" className={`hubly-logo w-auto shrink-0 ${size.letters}`}>
        <WordmarkLetters />
      </svg>
    </span>
  );
}

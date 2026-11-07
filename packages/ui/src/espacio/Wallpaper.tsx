import { fondoIlustrado } from "./fondos";
import type { WallpaperId } from "./preferencias";

// Las curvas se calculan una sola vez al cargar el módulo, no en cada render (#85, rendimiento).
const CONTOUR_PATHS = Array.from({ length: 24 }, (_, k) => {
  const base = -20 + k * 40;
  let d = "";
  for (let x = -20; x <= 1460; x += 20) {
    const y = base + 22 * Math.sin(x / 150 + k * 0.45) + 11 * Math.sin(x / 61 + k * 1.3) + 6 * Math.sin(x / 23 + k);
    d += `${x === -20 ? "M" : "L"}${x},${y.toFixed(1)} `;
  }
  return { d, accent: k % 5 === 2 };
});

const WALLPAPER_BG: Partial<Record<WallpaperId, string>> = {
  contornos: "bg-(--wallpaper-contornos)",
  patron: "bg-(--wallpaper-patron)",
  tinta: "bg-(--wallpaper-tinta)",
  grafito: "bg-(--wallpaper-grafito)",
  puntos: "bg-(--wallpaper-puntos)",
  cuadricula: "bg-(--wallpaper-cuadricula)",
  aurora: "bg-(--wallpaper-aurora)",
  hubis: "bg-(--wallpaper-hubis)",
  arena: "bg-(--wallpaper-arena)",
  imagen: "bg-(--wallpaper-grafito)",
};

/** Los fondos ilustrados no tienen color propio: mientras carga la imagen se ve grafito. */
const bgDe = (fondo: WallpaperId) => WALLPAPER_BG[fondo] ?? "bg-(--wallpaper-grafito)";

/** Fondos dibujados con un patrón SVG; el selector reutiliza los mismos patrones en sus miniaturas. */
const PATTERN_ID: Partial<Record<WallpaperId, string>> = {
  patron: "hubly-patron-h",
  puntos: "hubly-patron-puntos",
  cuadricula: "hubly-patron-cuadricula",
  hubis: "hubly-patron-hubis",
};

/** Silueta de Hubi (cabeza y orejas) a escala 0.12 del isologo; la oreja derecha va en el acento. */
function HubiSilueta() {
  return (
    <g transform="translate(18 14) scale(0.12)">
      <path d="M40 137 C49 107 62 66 75 66 C88 66 101 88 113 111 Z" fill="var(--wallpaper-pattern)" />
      <path d="M207 111 C222 89 235 66 247 66 C263 66 273 99 283 137 Z" fill="var(--wallpaper-pattern-accent)" />
      <path d="M108 109 H207 C240 109 265 116 281 135 C292 148 298 166 298 186 C298 225 269 253 229 254 H91 C51 253 22 225 22 186 C22 165 29 148 41 133 C57 114 80 109 108 109 Z" fill="var(--wallpaper-pattern)" />
    </g>
  );
}

function PatternDefs() {
  return (
    <defs>
      <pattern id="hubly-patron-h" width="132" height="96" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
        <polygon points="20,22 38,22 35,32 17,32" fill="var(--wallpaper-pattern)" />
        <polygon points="46,22 64,22 61,32 43,32" fill="var(--wallpaper-pattern)" />
        <polygon points="17,35 67,35 64,45 14,45" fill="var(--wallpaper-pattern-accent)" />
        <polygon points="14,48 32,48 29,58 11,58" fill="var(--wallpaper-pattern)" />
        <polygon points="40,48 58,48 55,58 37,58" fill="var(--wallpaper-pattern)" />
      </pattern>
      <pattern id="hubly-patron-puntos" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="12" cy="12" r="1.4" fill="var(--wallpaper-dot)" />
      </pattern>
      <pattern id="hubly-patron-cuadricula" width="128" height="128" patternUnits="userSpaceOnUse">
        <path d="M32 0V128M64 0V128M96 0V128M0 32H128M0 64H128M0 96H128" fill="none" stroke="var(--wallpaper-line)" strokeWidth="1" />
        <path d="M0 0.5H128M0.5 0V128" fill="none" stroke="var(--wallpaper-line-accent)" strokeWidth="1" />
      </pattern>
      <pattern id="hubly-patron-hubis" width="96" height="84" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)">
        <HubiSilueta />
        <g transform="translate(48 42)"><HubiSilueta /></g>
      </pattern>
    </defs>
  );
}

/** Fondo personal del espacio: contornos, patrones, aurora o color liso. Solo lo ve la persona (#75, sección 3; issue 134). */
export function Wallpaper({ fondo, imagenUrl, preview, animado = true }: { fondo: WallpaperId; imagenUrl?: string | null | undefined; preview?: "light" | "dark"; animado?: boolean }) {
  if (preview) {
    const background = fondo === "tinta" ? "bg-(--landing-swatch-mist)" : preview === "dark" ? "bg-(--landing-swatch-dark)" : "bg-(--landing-swatch-light)";
    return (
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 ${background}`}>
        {fondo === "contornos" && (
          <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={`size-full ${preview === "dark" ? "text-(--landing-swatch-dark-line)" : "text-(--landing-swatch-light-line)"}`}>
            {CONTOUR_PATHS.map(({ d, accent }, index) => (
              <path key={index} d={d} fill="none" stroke="currentColor" strokeOpacity={accent ? 0.75 : 0.3} strokeWidth="3" />
            ))}
          </svg>
        )}
      </div>
    );
  }

  const pattern = PATTERN_ID[fondo];
  const ilustrado = fondoIlustrado(fondo);
  return (
    <div aria-hidden="true" className={`hubly-wallpaper pointer-events-none fixed inset-0 -z-10 overflow-hidden ${bgDe(fondo)}`}>
      {ilustrado && (
        <>
          {/* La versión animada solo se descarga si la persona no pidió reducir el movimiento. */}
          <picture>
            {ilustrado.animado && animado && <source media="(prefers-reduced-motion: no-preference)" srcSet={`/fondos/${ilustrado.id}-animado.webp`} type="image/webp" />}
            <img src={`/fondos/${ilustrado.id}.webp`} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />
          </picture>
          <span className="absolute inset-0 bg-(--wallpaper-image-veil)" />
        </>
      )}
      {fondo === "imagen" && imagenUrl && (
        <>
          <img src={imagenUrl} alt="" className="absolute inset-0 size-full object-cover" />
          {/* Velo para que el texto sobre el cristal se lea igual con una foto clara que con una oscura (#84). */}
          <span className="absolute inset-0 bg-(--wallpaper-image-veil)" />
        </>
      )}
      {fondo === "aurora" && (
        <>
          <span className="hubly-aurora hubly-aurora-1 bg-(--wallpaper-aurora-1)" />
          <span className="hubly-aurora hubly-aurora-2 bg-(--wallpaper-aurora-2)" />
          <span className="hubly-aurora hubly-aurora-3 bg-(--wallpaper-aurora-3)" />
        </>
      )}
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={`absolute inset-0 size-full ${fondo === "contornos" ? "opacity-100" : "opacity-0"}`}>
        {CONTOUR_PATHS.map((path, index) => (
          <path key={index} d={path.d} fill="none" stroke={path.accent ? "var(--wallpaper-line-accent)" : "var(--wallpaper-line)"} strokeWidth="1.2" />
        ))}
      </svg>
      <svg className="absolute inset-0 size-full">
        <PatternDefs />
        {pattern && <rect width="100%" height="100%" fill={`url(#${pattern})`} />}
      </svg>
    </div>
  );
}

/** Miniatura de cada fondo para el selector. */
export function WallpaperSwatch({ fondo, className = "h-14" }: { fondo: WallpaperId; className?: string }) {
  const pattern = PATTERN_ID[fondo];
  const ilustrado = fondoIlustrado(fondo);
  return (
    <span aria-hidden="true" className={`relative block ${className} w-full overflow-hidden rounded-lg border border-(--glass-line-strong) ${bgDe(fondo)}`}>
      {ilustrado && <img src={`/fondos/${ilustrado.id}-mini.webp`} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />}
      {fondo === "contornos" && (
        <svg viewBox="0 0 120 56" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <path d="M0,14 C30,4 60,24 120,10 M0,30 C35,20 70,40 120,26 M0,46 C40,36 80,56 120,42" fill="none" stroke="var(--wallpaper-line-accent)" strokeWidth="1" />
        </svg>
      )}
      {fondo === "aurora" && (
        <>
          <span className="absolute -top-4 -left-3 size-12 rounded-full bg-(--wallpaper-aurora-1) blur-md" />
          <span className="absolute -right-2 -bottom-5 size-14 rounded-full bg-(--wallpaper-aurora-2) blur-md" />
          <span className="absolute top-2 left-1/2 size-8 rounded-full bg-(--wallpaper-aurora-3) blur-md" />
        </>
      )}
      {pattern && (
        <svg className="absolute inset-0 size-full">
          <PatternDefs />
          <rect width="100%" height="100%" fill={`url(#${pattern})`} />
        </svg>
      )}
    </span>
  );
}

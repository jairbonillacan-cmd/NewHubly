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

const WALLPAPER_BG: Record<WallpaperId, string> = {
  contornos: "bg-(--wallpaper-contornos)",
  patron: "bg-(--wallpaper-patron)",
  tinta: "bg-(--wallpaper-tinta)",
  grafito: "bg-(--wallpaper-grafito)",
};

/** Fondo personal del espacio: contornos, patrón H o color liso. Solo lo ve la persona (#75, sección 3). */
export function Wallpaper({ fondo }: { fondo: WallpaperId }) {
  return (
    <div aria-hidden="true" className={`hubly-wallpaper pointer-events-none fixed inset-0 -z-10 ${WALLPAPER_BG[fondo]}`}>
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className={`absolute inset-0 size-full ${fondo === "contornos" ? "opacity-100" : "opacity-0"}`}>
        {CONTOUR_PATHS.map((path, index) => (
          <path key={index} d={path.d} fill="none" stroke={path.accent ? "var(--wallpaper-line-accent)" : "var(--wallpaper-line)"} strokeWidth="1.2" />
        ))}
      </svg>
      <svg className={`absolute inset-0 size-full ${fondo === "patron" ? "opacity-100" : "opacity-0"}`}>
        <defs>
          <pattern id="hubly-patron-h" width="132" height="96" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
            <polygon points="20,22 38,22 35,32 17,32" fill="var(--wallpaper-pattern)" />
            <polygon points="46,22 64,22 61,32 43,32" fill="var(--wallpaper-pattern)" />
            <polygon points="17,35 67,35 64,45 14,45" fill="var(--wallpaper-pattern-accent)" />
            <polygon points="14,48 32,48 29,58 11,58" fill="var(--wallpaper-pattern)" />
            <polygon points="40,48 58,48 55,58 37,58" fill="var(--wallpaper-pattern)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hubly-patron-h)" />
      </svg>
    </div>
  );
}

/** Miniatura de cada fondo para el selector. */
export function WallpaperSwatch({ fondo }: { fondo: WallpaperId }) {
  return (
    <span aria-hidden="true" className={`relative block h-14 w-full overflow-hidden rounded-lg border border-(--glass-line-strong) ${WALLPAPER_BG[fondo]}`}>
      {fondo === "contornos" && (
        <svg viewBox="0 0 120 56" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <path d="M0,14 C30,4 60,24 120,10 M0,30 C35,20 70,40 120,26 M0,46 C40,36 80,56 120,42" fill="none" stroke="var(--wallpaper-line-accent)" strokeWidth="1" />
        </svg>
      )}
      {fondo === "patron" && (
        <svg viewBox="0 0 120 56" className="absolute inset-0 size-full">
          <rect width="120" height="56" fill="url(#hubly-patron-h)" />
        </svg>
      )}
    </span>
  );
}

// Set único de iconos del espacio (#75): trazos propios de 24×24, sin dependencias nuevas.

const PATHS = {
  sol: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  nota: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  pin: "M9 4h6l-1 6 3 3H7l3-3zM12 13v7",
  mas: "M12 5v14M5 12h14",
  cerrar: "M6 6l12 12M18 6L6 18",
  buscar: "M11 5a6 6 0 1 0 0 12a6 6 0 1 0 0-12M20 20l-4.5-4.5",
  imagen: "M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6",
  paneles: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  libre: "M3 4h11v16H3zM16 4h5v7h-5zM16 13h5v7h-5z",
  lado: "M3 4h5v16H3zM9.5 4h5v16h-5zM16 4h5v16h-5z",
  enfoque: "M7 4h10v16H7z",
  descargar: "M12 4v11M7 10l5 5 5-5M5 20h14",
  salir: "M10 5H5v14h5M14 8l4 4-4 4M18 12H9",
  check: "M5 12l5 5 9-10",
  chevrones: "M8 9l4-4 4 4M8 15l4 4 4-4",
  usuario: "M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8M4 21c1-4 4-6 8-6s7 2 8 6",
  sobre: "M4 7l8 6 8-6M4 7h16v11H4z",
  ajustes: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M8 10v4M16 16v4",
  archivar: "M4 5h16v4H4zM6 9v10h12V9M10 13h4",
  deshacer: "M9 14l-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-3",
  teclado: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  hoy: "M5 5h14v15H5zM5 9h14M9 3v4M15 3v4",
  equipo: "M9 5a3 3 0 1 0 0 6a3 3 0 1 0 0-6M3 19c.6-3 3-5 6-5s5.4 2 6 5M16 6a3 3 0 0 1 0 5M18 14c1.6.6 2.7 2.4 3 5",
  candado: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  compartir: "M12 3v12M7 8l5-5 5 5M5 14v6h14v-6",
  campana: "M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9M10.3 20.5a2 2 0 0 0 3.4 0",
  luna: "M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10",
  ayuda: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M9.6 9.2a2.5 2.5 0 0 1 4.9.6c0 1.6-2.5 2.2-2.5 3.7M12 16.8h.01",
  engrane: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9",
  lapiz: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  camara: "M4 8h3l1.5-2h7L18 8h2v12H4zM12 17a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7",
  expandir: "M4 5h16v14H4zM9 5v14M13 10l2 2-2 2",
  contraer: "M4 5h16v14H4zM9 5v14M15 10l-2 2 2 2",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className, strokeWidth = 1.75 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className ?? "size-4"}>
      <path d={PATHS[name]} />
    </svg>
  );
}

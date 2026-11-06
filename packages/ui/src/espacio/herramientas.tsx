// Herramientas del carril (#105, ADR 0009). Hoy es el centro; las demás llegan una a una y, mientras tanto, solo
// muestran su página «Próximamente»: nada de datos inventados.

export type HerramientaId = "hoy" | "calendario" | "contenido" | "clientes" | "anuncios" | "reportes";

export interface Herramienta {
  id: HerramientaId;
  nombre: string;
  /** Qué hará cuando llegue; se muestra en su página «Próximamente». */
  descripcion: string;
  disponible: boolean;
}

export const HERRAMIENTAS: readonly Herramienta[] = [
  { id: "hoy", nombre: "Hoy", descripcion: "Tus pendientes y notas del día.", disponible: true },
  { id: "calendario", nombre: "Calendario", descripcion: "Las piezas de cada cliente por día, semana o mes, para mover lo que cambie sin rehacer la hoja de cálculo.", disponible: false },
  { id: "contenido", nombre: "Contenido", descripcion: "Cada pieza con su copy, sus medios, su estado y quién la tiene, de la idea a la aprobación.", disponible: false },
  { id: "clientes", nombre: "Clientes", descripcion: "Cada marca con su estrategia, su voz y sus audiencias, en un solo lugar.", disponible: false },
  { id: "anuncios", nombre: "Anuncios", descripcion: "Las campañas pagadas de cada cliente junto a su contenido.", disponible: false },
  { id: "reportes", nombre: "Reportes", descripcion: "El reporte del mes de cada cliente, con datos reales de cada red y listo para compartir.", disponible: false },
];

export const isHerramientaId = (value: string | null | undefined): value is HerramientaId =>
  HERRAMIENTAS.some((herramienta) => herramienta.id === value);

export const herramientaPorId = (id: HerramientaId): Herramienta => HERRAMIENTAS.find((herramienta) => herramienta.id === id) ?? HERRAMIENTAS[0]!;

// Trazos propios de 24×24: relleno suave, contorno y un detalle en el color de acento.
const ICONOS: Record<HerramientaId, { relleno: string; trazo: string; acento: string }> = {
  hoy: { relleno: "M6 15a6 6 0 0 1 12 0z", trazo: "M3 15h18M7 19h10M6 15a6 6 0 0 1 12 0", acento: "M12 4v2M5.6 7.6l1.4 1.4M18.4 7.6L17 9" },
  calendario: { relleno: "M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", trazo: "M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 9h16M8 3v4M16 3v4", acento: "M14 14h2.5v2.5H14z" },
  contenido: { relleno: "M9 7h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z", trazo: "M4 15V6a2 2 0 0 1 2-2h9M9 7h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM7 17l3.5-3.5 2.5 2.5 2-2 5 5", acento: "M16.5 10.5h.01" },
  clientes: { relleno: "M14 6h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5z", trazo: "M5 6h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 16.5a2.5 2.5 0 0 1 5 0M8.5 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM14 6h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5", acento: "M17 10h1.5M17 13h1.5" },
  anuncios: { relleno: "M5 9h1l7-3v12l-7-3H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z", trazo: "M5 9h1l7-3v12l-7-3H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM7 15l1.2 4H10l-1-3.6", acento: "M16.5 9l2.5-1.2M16.5 12H19.5M16.5 15l2.5 1.2" },
  reportes: { relleno: "M5 14h3v6H5zM10.5 11h3v9h-3zM16 13h3v7h-3z", trazo: "M3 20h18M5 14h3v6H5zM10.5 11h3v9h-3zM16 13h3v7h-3z", acento: "M5 9.5l5-4 4 3 5-4.5" },
};

/** Icono a dos tonos de una herramienta. Activo, el relleno y el acento pasan a los colores sobre el acento. */
export function HerramientaIcono({ id, activo = false, className = "size-6" }: { id: HerramientaId; activo?: boolean; className?: string }) {
  const icono = ICONOS[id];
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={icono.relleno} className={activo ? "fill-(--icon-fill-active)" : "fill-(--icon-fill)"} />
      <path d={icono.trazo} stroke="currentColor" strokeWidth={1.5} />
      <path d={icono.acento} strokeWidth={1.8} className={activo ? "stroke-(--text-on-accent)" : "stroke-(--accent-primary)"} />
    </svg>
  );
}

import { IconoHubly } from "./icons";

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
  { id: "hoy", nombre: "Hub", descripcion: "Tu centro: pendientes, notas y todo tu trabajo en un solo lugar.", disponible: true },
  { id: "calendario", nombre: "Calendario", descripcion: "Las piezas de cada cliente por día, semana o mes, para mover lo que cambie sin rehacer la hoja de cálculo.", disponible: false },
  { id: "contenido", nombre: "Contenido", descripcion: "Cada pieza con su copy, sus medios, su estado y quién la tiene, de la idea a la aprobación.", disponible: false },
  { id: "clientes", nombre: "Clientes", descripcion: "Cada marca con su estrategia, su voz y sus audiencias, en un solo lugar.", disponible: false },
  { id: "anuncios", nombre: "Anuncios", descripcion: "Las campañas pagadas de cada cliente junto a su contenido.", disponible: false },
  { id: "reportes", nombre: "Reportes", descripcion: "El reporte del mes de cada cliente, con datos reales de cada red y listo para compartir.", disponible: false },
];

export const isHerramientaId = (value: string | null | undefined): value is HerramientaId =>
  HERRAMIENTAS.some((herramienta) => herramienta.id === value);

export const herramientaPorId = (id: HerramientaId): Herramienta => HERRAMIENTAS.find((herramienta) => herramienta.id === id) ?? HERRAMIENTAS[0]!;

/** Cada herramienta tiene una URL limpia propia (#212): /hub, /calendario, /contenido… El Hub guarda el id «hoy». */
export const herramientaHref = (id: HerramientaId): string => (id === "hoy" ? "/hub" : `/${id}`);

/** La herramienta de una ruta («/calendario» → calendario); cualquier otra ruta es el Hub. */
export const herramientaDeRuta = (pathname: string): HerramientaId => {
  const id = pathname.split("/").filter(Boolean)[0];
  return isHerramientaId(id) ? id : "hoy";
};

/** Icono de cada herramienta en la identidad nueva (issue 148); activo, usa su versión sobre el acento. */
export function HerramientaIcono({ id, activo = false, className = "size-6" }: { id: HerramientaId; activo?: boolean; className?: string }) {
  return <IconoHubly name={id} activo={activo} className={className} />;
}

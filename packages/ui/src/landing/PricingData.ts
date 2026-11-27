import type { FeatureStatus } from "./StatusBadge";

export type Periodo = "mensual" | "anual";

export interface Plan {
  id: "personal" | "equipo" | "agencia";
  nombre: string;
  para: string;
  /** Precio por mes en pesos mexicanos; `null` muestra «Próximamente». En anual es el equivalente mensual. */
  precio: Record<Periodo, number | null>;
  incluye: readonly { texto: string; estado: FeatureStatus }[];
  cta: { href: string; label: string };
  destacado?: boolean;
}

// Para publicar precios basta con poner los montos aquí (issue 129). Hasta entonces, «Próximamente».
export const PLANES: readonly Plan[] = [
  {
    id: "personal", nombre: "Personal", para: "Para ordenar tu propio día.",
    precio: { mensual: null, anual: null },
    incluye: [
      { texto: "Tu lista de Hoy con lo vencido arriba", estado: "disponible" },
      { texto: "Notas y captura en una línea", estado: "disponible" },
      { texto: "Tu fondo y el modo oscuro", estado: "disponible" },
      { texto: "Descargas todo cuando quieras", estado: "disponible" },
    ],
    cta: { href: "/registro", label: "Crear cuenta" },
  },
  {
    id: "equipo", nombre: "Equipo", para: "Para equipos de redes que trabajan juntos.", destacado: true,
    precio: { mensual: null, anual: null },
    incluye: [
      { texto: "Todo lo de Personal", estado: "disponible" },
      { texto: "Tu agencia con tu equipo dentro", estado: "pronto" },
      { texto: "Quién edita y quién solo ve", estado: "pronto" },
      { texto: "Notas compartidas con la agencia", estado: "pronto" },
    ],
    cta: { href: "/registro", label: "Empieza con Personal" },
  },
  {
    id: "agencia", nombre: "Agencia", para: "Para agencias con varios clientes.",
    precio: { mensual: null, anual: null },
    incluye: [
      { texto: "Todo lo de Equipo", estado: "pronto" },
      { texto: "Cada cliente con su estrategia y su voz", estado: "proximamente" },
      { texto: "Calendario y contenido por cliente", estado: "proximamente" },
      { texto: "El cliente aprueba con un enlace", estado: "proximamente" },
      { texto: "El reporte del mes de cada cliente", estado: "proximamente" },
    ],
    cta: { href: "/registro", label: "Empieza con Personal" },
  },
];

const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** Texto del precio de un plan: el monto con «/mes» o «Próximamente» mientras no haya precio. */
export function formatPrecio(plan: Plan, periodo: Periodo): { monto: string; detalle: string | null } {
  const precio = plan.precio[periodo];
  if (precio === null) return { monto: "Próximamente", detalle: null };
  return { monto: `${MXN.format(precio)} /mes`, detalle: periodo === "anual" ? "Se paga una vez al año" : null };
}

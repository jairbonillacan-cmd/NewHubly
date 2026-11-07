"use client";

import { useState } from "react";
import { Hubi } from "../components/brand/Hubi";
import { Reveal } from "./Reveal";
import { SectionIntro } from "./SectionIntro";
import { StatusBadge, type FeatureStatus } from "./StatusBadge";

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

const PREGUNTAS = [
  ["¿Cuándo se publican los precios?", "Cuando lo de equipo funcione de verdad. Antes de cobrarte cualquier cosa, te lo diremos con tiempo."],
  ["¿Puedo usar Hubly mientras tanto?", "Sí. Tu espacio personal ya funciona: crea tu cuenta y empieza hoy."],
  ["¿Pierdo lo que escribí si cambio de plan?", "No. Tus pendientes y tus notas se quedan contigo."],
] as const;

export function PricingSection() {
  const [periodo, setPeriodo] = useState<Periodo>("mensual");
  return (
    <section aria-labelledby="precios-titulo" data-landing-section="precios" className="mx-auto max-w-(--landing-width) px-4 pt-12 lg:pt-20">
      <div className="hubly-enter">
        <SectionIntro id="precios-titulo" label="Precios" title="Un plan para cada forma de trabajar." body="Hoy ya puedes usar tu espacio personal. Los precios llegan junto con lo de equipo." />
      </div>
      <div role="radiogroup" aria-label="Forma de pago" data-delay="1" className="hubly-enter mx-auto mt-8 flex w-fit gap-1 rounded-full bg-(--landing-ice) p-1">
        {(["mensual", "anual"] as const).map((opcion) => (
          <button key={opcion} type="button" role="radio" aria-checked={periodo === opcion} onClick={() => setPeriodo(opcion)}
            className="min-h-11 cursor-pointer rounded-full px-5 text-sm font-semibold text-(--text-secondary) aria-checked:bg-(--landing-card) aria-checked:text-(--text-primary) aria-checked:shadow-(--landing-shadow)">
            {opcion === "mensual" ? "Mensual" : "Anual"}
          </button>
        ))}
      </div>
      <ul className="mt-14 grid list-none gap-5 p-0 lg:grid-cols-3">
        {PLANES.map((plan, index) => {
          const { monto, detalle } = formatPrecio(plan, periodo);
          return (
            <li key={plan.id} className="flex">
              <Reveal retraso={(index + 1) as 1 | 2 | 3} className="flex w-full">
                <article aria-labelledby={`plan-${plan.id}`} className={`relative flex w-full flex-col gap-4 rounded-(--landing-panel-radius) p-6 lg:p-7 ${plan.destacado ? "bg-(--landing-end) text-(--landing-on-end)" : "border border-(--border-default) bg-(--landing-card)"}`}>
                  {plan.destacado && (
                    <div aria-hidden="true" className="hubly-peek absolute -top-14 right-6">
                      <Hubi pose="comunidad" tamano={96} decorativo priority="deferred" className="hubly-wiggle size-24" sizing="css" />
                    </div>
                  )}
                  <h2 id={`plan-${plan.id}`} className="landing-display text-3xl font-medium">{plan.nombre}</h2>
                  <p className={plan.destacado ? "text-(--landing-end-muted)" : "text-(--text-secondary)"}>{plan.para}</p>
                  <p className="landing-display text-3xl leading-tight">{monto}</p>
                  {detalle && <p className="text-sm">{detalle}</p>}
                  <ul className="grid list-none gap-2.5 p-0 text-sm">
                    {plan.incluye.map((item) => (
                      <li key={item.texto} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
                        <span aria-hidden="true">✓</span>
                        <span>{item.texto}{item.estado !== "disponible" && <span className="ml-2 inline-block align-middle"><StatusBadge status={item.estado} short /></span>}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={plan.cta.href} className={`mt-auto inline-flex min-h-12 items-center justify-center rounded-full px-6 font-semibold hover:underline ${plan.destacado ? "bg-(--landing-on-end) text-(--landing-end)" : "bg-(--accent-primary) text-(--text-on-accent)"}`}>{plan.cta.label}</a>
                </article>
              </Reveal>
            </li>
          );
        })}
      </ul>
      <dl className="mx-auto mt-16 grid max-w-3xl gap-3 lg:mt-20">
        {PREGUNTAS.map(([pregunta, respuesta]) => (
          <div key={pregunta} className="rounded-2xl border border-(--border-default) bg-(--landing-card) px-5 py-4">
            <dt className="font-semibold">{pregunta}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-(--text-secondary)">{respuesta}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

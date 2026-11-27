"use client";

import { useState } from "react";
import { Hubi } from "../components/brand/Hubi";
import { PLANES, formatPrecio, type Periodo } from "./PricingData";
import { Reveal } from "./Reveal";
import { StatusBadge } from "./StatusBadge";

/** Isla cliente mínima para el selector mensual/anual y las tarjetas de planes (issue 291). */
export function PricingPlans() {
  const [periodo, setPeriodo] = useState<Periodo>("mensual");
  return (
    <>
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
    </>
  );
}

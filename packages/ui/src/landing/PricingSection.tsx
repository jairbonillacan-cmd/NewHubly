import { PricingPlans } from "./PricingPlans";
import { SectionIntro } from "./SectionIntro";

export { PLANES, formatPrecio, type Periodo, type Plan } from "./PricingData";

const PREGUNTAS = [
  ["¿Cuándo se publican los precios?", "Cuando lo de equipo funcione de verdad. Antes de cobrarte cualquier cosa, te lo diremos con tiempo."],
  ["¿Puedo usar Hubly mientras tanto?", "Sí. Tu espacio personal ya funciona: crea tu cuenta y empieza hoy."],
  ["¿Pierdo lo que escribí si cambio de plan?", "No. Tus pendientes y tus notas se quedan contigo."],
] as const;

export function PricingSection() {
  return (
    <section aria-labelledby="precios-titulo" data-landing-section="precios" className="mx-auto max-w-(--landing-width) px-4 pt-12 lg:pt-20">
      <div className="hubly-enter">
        <SectionIntro id="precios-titulo" label="Precios" title="Un plan para cada forma de trabajar." body="Hoy ya puedes usar tu espacio personal. Los precios llegan junto con lo de equipo." />
      </div>
      <PricingPlans />
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

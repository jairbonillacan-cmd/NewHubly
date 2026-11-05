import { SectionIntro } from "./SectionIntro";
import { StatusBadge, type FeatureStatus } from "./StatusBadge";

const STAGES: readonly { name: string; body: string; status: FeatureStatus }[] = [
  { name: "Idea", body: "Notas y pendientes para no perder nada.", status: "disponible" },
  { name: "Borrador", body: "El copy y los medios de cada pieza.", status: "proximamente" },
  { name: "Revisión interna", body: "Tu equipo comenta y aprueba.", status: "proximamente" },
  { name: "Aprobación del cliente", body: "Con un enlace, sin crear cuenta.", status: "proximamente" },
  { name: "Programada", body: "Eliges día y hora por red.", status: "proximamente" },
  { name: "Publicada", body: "Sale sola y nunca se duplica.", status: "proximamente" },
  { name: "Medida", body: "Datos reales para el reporte.", status: "proximamente" },
];

export function RoadmapSection() {
  return (
    <section id="lo-que-viene" aria-labelledby="etapas-titulo" data-landing-section="etapas" className="mx-auto max-w-(--landing-width) scroll-mt-6 px-4 pt-20 lg:pt-28">
      <SectionIntro id="etapas-titulo" label="Lo que viene" title="De la idea a la métrica." body="Cada pieza recorre siete etapas. Hoy funciona la primera; el resto llega por partes y lo marcamos aquí cuando esté listo." />
      <ol className="mt-8 grid gap-2.5 lg:mt-11 lg:grid-cols-7">
        {STAGES.map((stage, index) => {
          const available = stage.status === "disponible";
          const tone = available ? "bg-(--accent-primary) text-(--text-on-accent)" : "border border-(--border-default) bg-(--landing-card)";
          const numberTone = available ? "bg-(--text-on-accent) text-(--accent-primary)" : "bg-(--landing-ice) text-(--landing-accent-text)";
          return (
            <li key={stage.name} className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-3xl p-3.5 lg:grid-cols-1 lg:content-start lg:gap-4 ${tone}`}>
              <span aria-hidden="true" className={`grid size-8 place-items-center rounded-full text-sm font-bold ${numberTone}`}>{index + 1}</span>
              <div className="grid gap-2">
                <h3 className="landing-display text-xl leading-tight font-medium lg:min-h-13">{stage.name}</h3>
                <p className={`text-sm lg:min-h-16 ${available ? "" : "text-(--text-secondary)"}`}>{stage.body}</p>
                <StatusBadge status={stage.status} short />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

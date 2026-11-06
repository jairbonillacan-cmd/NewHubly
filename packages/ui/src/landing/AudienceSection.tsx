import { Hubi, type HubiPose } from "../components/brand/Hubi";
import { Reveal } from "./Reveal";
import { SectionIntro } from "./SectionIntro";
import { StatusBadge, type FeatureStatus } from "./StatusBadge";

// Dos maneras de usar el mismo Hubly (docs/producto/vision.md): nadie elige un tipo de cuenta para empezar.
const MANERAS: readonly { id: string; titulo: string; texto: string; puntos: readonly { texto: string; estado: FeatureStatus }[]; pose: Exclude<HubiPose, "sentado" | "laptop">; tono: string }[] = [
  {
    id: "marca", titulo: "Para tu marca", pose: "ideas", tono: "bg-(--landing-mist)",
    texto: "Organiza el marketing de tu negocio, aunque trabajes por tu cuenta.",
    puntos: [
      { texto: "Tus ideas, notas y pendientes, en orden", estado: "disponible" },
      { texto: "Sin crear clientes ni invitar a nadie", estado: "disponible" },
      { texto: "Tu contenido y tu calendario", estado: "proximamente" },
    ],
  },
  {
    id: "agencia", titulo: "Para tu agencia", pose: "comunidad", tono: "bg-(--landing-paper)",
    texto: "Lleva varias marcas, proyectos y personas desde el mismo espacio.",
    puntos: [
      { texto: "Tu equipo dentro, cada quien con su rol", estado: "pronto" },
      { texto: "Cada marca separada de las demás", estado: "proximamente" },
      { texto: "Tu cliente revisa sin crear cuenta", estado: "proximamente" },
    ],
  },
];

export function AudienceSection() {
  return (
    <section aria-labelledby="audiencia-titulo" data-landing-section="audiencia" className="mx-auto max-w-(--landing-width) px-4 pt-20 lg:pt-28">
      <Reveal>
        <SectionIntro id="audiencia-titulo" label="Para quién" title="Una marca o varias." body="Es el mismo Hubly. Empiezas con lo que necesitas y sumas lo demás cuando haga falta." />
      </Reveal>
      <div className="mt-14 grid gap-14 lg:mt-16 lg:grid-cols-2 lg:gap-6">
        {MANERAS.map((manera, index) => (
          <Reveal key={manera.id} retraso={(index + 1) as 1 | 2} className="h-full">
            <article aria-labelledby={`manera-${manera.id}`} className={`relative h-full rounded-(--landing-panel-radius) px-6 pt-8 pb-7 lg:px-9 ${manera.tono}`}>
              <div aria-hidden="true" className="hubly-peek absolute -top-12 right-6 lg:right-9">
                <Hubi pose={manera.pose} tamano={112} decorativo priority="deferred" className="hubly-wiggle size-24 lg:size-28" sizing="css" />
              </div>
              <h3 id={`manera-${manera.id}`} className="landing-display text-3xl font-medium lg:text-4xl">{manera.titulo}</h3>
              <p className="mt-2 max-w-sm leading-relaxed text-(--text-secondary)">{manera.texto}</p>
              <ul className="mt-5 grid list-none gap-2 p-0 text-sm">
                {manera.puntos.map((punto) => (
                  <li key={punto.texto} className="flex flex-wrap items-center gap-2.5 rounded-xl bg-(--landing-card) px-3.5 py-2.5">
                    <span aria-hidden="true" className="text-(--landing-accent-text)">✓</span>
                    <span className="grow">{punto.texto}</span>
                    {punto.estado !== "disponible" && <StatusBadge status={punto.estado} short />}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

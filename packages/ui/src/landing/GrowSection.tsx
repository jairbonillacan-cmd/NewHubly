import { Hubi, type HubiPose } from "../components/brand/Hubi";
import { Reveal } from "./Reveal";
import { SectionIntro } from "./SectionIntro";
import { StatusBadge, type FeatureStatus } from "./StatusBadge";

// De una marca a varias (docs/producto/vision.md). No es una tabla de planes: es el mismo espacio que crece.
const PASOS: readonly { titulo: string; texto: string; estado: FeatureStatus; pose: Exclude<HubiPose, "sentado" | "laptop"> }[] = [
  { titulo: "Empiezas con tu marca", texto: "Tu espacio con tus ideas, notas y pendientes. Sin configurar nada.", estado: "disponible", pose: "bienvenida" },
  { titulo: "Sumas a tu equipo", texto: "Creas tu agencia, invitas con un enlace y cada quien ve lo que le toca.", estado: "pronto", pose: "comunidad" },
  { titulo: "Llevas más marcas", texto: "Cada marca con su contenido, su calendario y sus reportes, sin mezclarse.", estado: "proximamente", pose: "metricas" },
];

export function GrowSection() {
  return (
    <section id="crece" aria-labelledby="crece-titulo" data-landing-section="crece" className="mx-auto max-w-(--landing-width) scroll-mt-6 px-4 pt-20 lg:pt-28">
      <Reveal>
        <SectionIntro id="crece-titulo" label="Crece a tu manera" title="Tu espacio crece contigo." body="Lo que no usas no te estorba. Cuando el trabajo crece, Hubly te acompaña sin cambiar de herramienta." />
      </Reveal>
      <ol className="mt-14 grid list-none gap-14 p-0 lg:mt-16 lg:grid-cols-3 lg:gap-5">
        {PASOS.map((paso, index) => (
          <li key={paso.titulo} className="flex">
            <Reveal retraso={(index + 1) as 1 | 2 | 3} className="flex w-full">
              <article className="relative flex w-full flex-col gap-3 rounded-3xl border border-(--border-default) bg-(--landing-card) px-6 pt-10 pb-6">
                <div aria-hidden="true" className="hubly-peek absolute -top-12 right-5">
                  <Hubi pose={paso.pose} tamano={96} decorativo priority="deferred" className="hubly-wiggle size-24" sizing="css" />
                </div>
                <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-(--landing-ice) text-sm font-bold text-(--landing-accent-text)">{index + 1}</span>
                <h3 className="landing-display text-2xl leading-tight font-medium">{paso.titulo}</h3>
                <p className="text-sm leading-relaxed text-(--text-secondary)">{paso.texto}</p>
                <div className="mt-auto pt-1"><StatusBadge status={paso.estado} /></div>
              </article>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

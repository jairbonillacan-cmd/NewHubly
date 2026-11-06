import { Hubi, type HubiPose } from "../components/brand/Hubi";
import { Reveal } from "./Reveal";
import { SectionIntro } from "./SectionIntro";

type Pose = Exclude<HubiPose, "sentado" | "laptop">;

// Un martes de una cuenta inventada, solo con lo que ya funciona (Constitución #3).
const MOMENTOS: readonly { hora: string; titulo: string; texto: string; ejemplo: string; pose: Pose; tono: string }[] = [
  { hora: "9:02", titulo: "Abres Hubly", texto: "Arriba, en rojo, lo que se te pasó ayer. Debajo, lo de hoy.", ejemplo: "2 vencidos · 5 para hoy", pose: "bienvenida", tono: "bg-(--landing-mist)" },
  { hora: "11:40", titulo: "Sales de la junta", texto: "Lo escribes tal cual, en una línea, y queda para mañana.", ejemplo: "Mandar propuesta a Aurora mañana", pose: "ideas", tono: "bg-(--landing-paper)" },
  { hora: "16:15", titulo: "«¿Me pasas lo de octubre?»", texto: "Lo buscas y aparece entre tus notas y pendientes.", ejemplo: "Buscar: octubre", pose: "buscar", tono: "bg-(--landing-ice)" },
  { hora: "19:05", titulo: "Cierras el día", texto: "Lo de hoy está hecho. Lo de mañana ya tiene fecha.", ejemplo: "5 de 5 · hechos hoy", pose: "celebrar", tono: "bg-(--tint-green)" },
];

export function DiaSection() {
  return (
    <section aria-labelledby="dia-titulo" data-landing-section="dia" className="mx-auto max-w-(--landing-width) px-4 pt-20 lg:pt-28">
      <Reveal>
        <SectionIntro id="dia-titulo" label="Un martes cualquiera" title="Así se ve un día con Hubly." body="Lo que ya puedes hacer hoy, en el orden en que te pasa." />
      </Reveal>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
        {MOMENTOS.map((momento, index) => (
          <li key={momento.hora}>
            <Reveal retraso={(index + 1) as 1 | 2 | 3 | 4} className="h-full">
              <article className={`relative flex h-full flex-col gap-2 rounded-3xl px-5 pt-16 pb-5 ${momento.tono}`}>
                <div aria-hidden="true" className="hubly-peek absolute -top-10 right-3">
                  <Hubi pose={momento.pose} tamano={96} decorativo priority="deferred" className="hubly-wiggle size-24" sizing="css" />
                </div>
                <time className="w-fit rounded-full bg-(--landing-card) px-3 py-1 font-mono text-xs font-semibold text-(--landing-accent-text)">{momento.hora}</time>
                <h3 className="landing-display text-2xl leading-tight font-medium">{momento.titulo}</h3>
                <p className="text-sm leading-relaxed text-(--text-secondary)">{momento.texto}</p>
                <p aria-hidden="true" className="mt-auto rounded-xl bg-(--landing-card) px-3 py-2 font-mono text-xs wrap-anywhere text-(--text-secondary)">{momento.ejemplo}</p>
              </article>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

import { Hubi, type HubiPose } from "../components/brand/Hubi";
import { Reveal } from "./Reveal";
import { SectionIntro } from "./SectionIntro";

type Pose = Exclude<HubiPose, "sentado" | "laptop">;

// Dónde aparece Hubi dentro de la app; lo que todavía no existe lleva «Próximamente».
const POSES: readonly { pose: Pose; texto: string; pronto?: boolean }[] = [
  { pose: "bienvenida", texto: "Te recibe cuando confirmas tu cuenta" },
  { pose: "correo", texto: "Te pide que revises tu correo" },
  { pose: "ideas", texto: "Te espera cuando Hoy está vacío" },
  { pose: "celebrar", texto: "Celebra cuando terminas lo de hoy" },
  { pose: "buscar", texto: "Busca contigo si una página no existe" },
  { pose: "reparar", texto: "Da la cara cuando algo falla" },
  { pose: "privacidad", texto: "Cuida la página de privacidad" },
  { pose: "contenido", texto: "Prepara la herramienta Contenido", pronto: true },
  { pose: "metricas", texto: "Calienta para los reportes", pronto: true },
];

function Tarjeta({ pose, texto, pronto, copia }: (typeof POSES)[number] & { copia?: boolean }) {
  return (
    <li {...(copia ? { "data-copia": "", "aria-hidden": true } : {})} className="mr-4 flex w-44 shrink-0 flex-col items-center gap-2 rounded-3xl bg-(--landing-card) px-3 pt-3 pb-4 text-center">
      <Hubi pose={pose} tamano={112} decorativo priority="deferred" className="hubly-wiggle size-28" sizing="css" />
      <p className="text-sm leading-snug font-medium">{texto}</p>
      {pronto && <span className="rounded-full bg-(--landing-ice) px-2.5 py-0.5 text-xs font-semibold text-(--landing-accent-text)">Próximamente</span>}
    </li>
  );
}

export function HubiSection() {
  return (
    <section id="hubi" aria-labelledby="hubi-titulo" data-landing-section="hubi" className="scroll-mt-6 pt-20 lg:pt-28">
      <Reveal className="mx-auto max-w-(--landing-width) px-4">
        <SectionIntro id="hubi-titulo" label="Conoce a Hubi" title="Hubi te acompaña en la app." body="No es un asistente que opina de todo. Aparece cuando algo pasa y se va." />
      </Reveal>
      <div className="mt-10 overflow-hidden bg-(--landing-mist) py-6 lg:mt-12 lg:py-8">
        <ul aria-label="Dónde aparece Hubi" className="hubly-marquee flex">
          {POSES.map((item) => <Tarjeta key={item.pose} {...item} />)}
          {POSES.map((item) => <Tarjeta key={`copia-${item.pose}`} {...item} copia />)}
        </ul>
      </div>
    </section>
  );
}
